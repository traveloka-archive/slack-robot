import { bind } from 'lodash';
import async from 'async';
import fs from 'fs';
import request from 'request';
import Promise from 'bluebird';
import EventEmitter from 'eventemitter3';
import { WebClient } from 'slack-client';

import {
  stripEmoji,
  getFileExtension
} from './util';

const USER_PREFIX = 'user__';
const MPIM_PREFIX = 'mpim__';

const DEFAUT_POST_MESSAGE_OPTS = {
  as_user: true,
  parse: 'full'
};

const TASK_TYPES = {
  TEXT: 'text',
  ATTACHMENT: 'attachments',
  UPLOAD: 'file',
  REACTION: 'reaction'
};

export default class Response extends EventEmitter {
  /**
   * @constructor
   * @param {WebClient} api
   * @param {SlackDataStore} dataStore
   * @param {Request} request
   * @param {number} concurrency (defaults to 1 to allow serial response sending)
   */
  constructor(slackToken, dataStore, request, concurrency = 1) {
    super();

    this._dataStore = dataStore;
    this._defaultTarget = [request.to.id];
    this._messageTimestamp = request.message.timestamp;

    concurrency = parseInt(concurrency, 10);

    /**
     * We use new instance of WebClient instead of passing from robot
     * to allow different concurrency option
     *
     * @type {WebClient}
     */
    this._api = new WebClient(slackToken, { maxRequestConcurrency: concurrency });

    /**
     * This is where we queue our response before actually sending them
     * by default every new item added the queue will not be processed
     * automatically (the queue will be paused) until the user explicitly
     * call .send()
     *
     * @type {AsyncQueue}
     */
    this._queue = async.queue(
      bind(this._send, this),
      concurrency
    );
  }

  /**
   * Change default target, only used internally in robot.to() method.
   * Because robot.to is supposed to used by human, it's possible
   * that given array of target contain user name or channel name
   * and not an id, so we need to convert them first
   *
   * @internal
   * @param {Array.<string>} defaultTarget
   */
  setDefaultTarget(defaultTarget) {
    this._defaultTarget = this._mapTargetToId(defaultTarget);
  }

  /**
   * Send basic text message
   *
   * @public
   * @param {string} text
   * @param {=Array.<string>|string} optTargets
   * @return {Response}
   */
  text(text, ...optTargets) {
    const targets = this._mapTargetToId(optTargets);
    const base = {
      type: TASK_TYPES.TEXT,
      value: text
    };

    // do not send until told otherwise
    this._queue.pause();
    this._addToQueues(base, targets);
    return this;
  }

  /**
   * Send message with attachment
   *
   * @public
   * @param {string} text
   * @param {Array.<Object>|Object} attachment
   * @param {=Array.<string>|string} optTargets
   * @see https://api.slack.com/docs/attachments
   *
   * Also support sending attachment without text with two params
   * @param {Array.<Object>|Object} attachment
   * @param {=Array.<string>|string} optTargets
   */
  attachment(...args) {
    let text, attachments, optTargets;

    if (typeof args[0] === 'string') {
      text = args[0];
      attachments = args[1];

      if (args.length > 2) {
        optTargets = args.splice(2);
      }
    } else {
      attachments = args[0];
      if (arguments.length > 1) {
        optTargets = args.splice(1);
      }
    }

    const targets = this._mapTargetToId(optTargets);
    const base = {
      type: TASK_TYPES.ATTACHMENT,
      value: {
        text,
        attachments: [attachments]
      }
    };

    if (attachments.length) {
      base.value.attachments = attachments;
    }

    // do not send until told otherwise
    this._queue.pause();
    this._addToQueues(base, targets);
    return this;
  }

  /**
   * Send a file from a string or stream
   *
   * @public
   * @param {string} filename
   * @param {string|ReadStream} content
   * @param {=Array.<string>|string} optTargets
   * @see https://nodejs.org/api/fs.html
   */
  upload(filename, content, ...optTargets) {
    const targets = this._mapTargetToId(optTargets);
    const base = {
      type: TASK_TYPES.UPLOAD,
      value: {
        filename,
        content
      }
    };

    // do not send until told otherwise
    this._queue.pause();
    this._addToQueues(base, targets);
    return this;
  }

  /**
   * Add reaction to sent message
   *
   * @public
   * @param {string} emoji
   */
  reaction(emoji) {
    const task = {
      type: TASK_TYPES.REACTION,
      // also include target prop to prevent error when checking targetId
      target: this._defaultTarget,
      value: {
        emoji: stripEmoji(emoji),
        channel: this._defaultTarget[0],
        timestamp: this._messageTimestamp
      }
    };

    this._queue.pause();
    this._addToQueue(task);
    return this;
  }

  /**
   * Wrap asynchronous task
   * @param {function} asyncTaskFn
   */
  async(asyncTaskFn) {
    const superPromise = new Promise((resolve, reject) => {
      asyncTaskFn(err => {
        if (err) {
          return reject(err);
        }

        return resolve();
      });
    });

    // add shortcut to send all pending queues
    superPromise.send = () => {
      return superPromise.then(() => {
        return this.send();
      });
    };

    return superPromise;
  }

  /**
   * Start queue processing
   *
   */
  send() {
    this._queue.resume();

    return new Promise(resolve => {
      this._queue.drain = function () {
        return resolve();
      };
    });
  }

  /**
   * Add response to queue for all target
   *
   * @param {Object} base response object
   * @param {Array.<string>} targets list of channel
   */
  _addToQueues(base, targets) {
    targets.forEach(target => {
      const task = { target, ...base };
      this._addToQueue(task);
    });
  }

  /**
   * Add task to queue, emit error events if task
   * failed to finish
   *
   * @private
   * @param {Object} task
   */
  _addToQueue(task) {
    this._queue.push(task, (err, data) => {
      if (err) {
        return this.emit('task_error', err);
      }

      this.emit('task_finished', task, data);
    });
  }

  /**
   * Send response to correct target
   *
   * @private
   * @param {Object} task
   * @param {function} callback
   */
  _send(task, callback) {
    if (task.target.indexOf(USER_PREFIX) > -1) {
      const userId = task.target.replace(USER_PREFIX, '');

      return this._api.dm.open(userId, (err, data) => {
        if (err) {
          return callback(err);
        }

        if (!data.ok) {
          return callback(new Error(data.error));
        }

        task.target = data.channel.id;
        this._sendResponse(task, callback);
      });
    } else if (task.target.indexOf(MPIM_PREFIX) > -1) {
      const userIds = task.target.replace(MPIM_PREFIX, '');

      return this._api.mpim.open(userIds, (err, data) => {
        if (err) {
          return callback(err);
        }

        if (!data.ok) {
          return callback(new Error(data.error));
        }

        task.target = data.group.id;
        this._sendResponse(task, callback);
      });
    }

    this._sendResponse(task, callback);
  }

  /**
   * Send response based on response type
   *
   * @private
   * @param {Object} task
   * @param {function} callback
   */
  _sendResponse(task, callback) {
    switch (task.type) {
      case TASK_TYPES.TEXT:
        this._sendTextResponse(task.target, task.value, callback);
        break;
      case TASK_TYPES.ATTACHMENT:
        this._sendAttachmentResponse(task.target, task.value, callback);
        break;
      case TASK_TYPES.UPLOAD:
        this._sendFileResponse(task.target, task.value, callback);
        break;
      case TASK_TYPES.REACTION:
        this._sendReactionResponse(task.value, callback);
        break;
      default:
        callback(null, { message: `Unknown task type ${task.type}` });
    }
  }

  /**
   * @private
   * @param {string} id channel id
   * @param {string} text
   * @param {function} callback
   */
  _sendTextResponse(id, text, callback) {
    this._api.chat.postMessage(id, text, DEFAUT_POST_MESSAGE_OPTS, (err, res) => {
      if (err) {
        return callback(err);
      }

      callback(null, res);
    });
  }

  /**
   * @private
   * @param {string} id channel id
   * @param {object} attachment
   * @param {function} callback
   */
  _sendAttachmentResponse(id, attachment, callback) {
    const { text, attachments } = attachment;
    const opts = {
      ...DEFAUT_POST_MESSAGE_OPTS,
      attachments: JSON.stringify(attachments)
    };

    this._api.chat.postMessage(id, text, opts, (err, res) => {
      if (err) {
        return callback(err);
      }

      callback(null, res);
    });
  }

  /**
   * @private
   * @param {object} reaction
   * @param {function} callback
   */
  _sendReactionResponse(reaction, callback) {
    const opts = {
      channel: reaction.channel,
      timestamp: reaction.timestamp
    };

    this._api.reactions.add(reaction.emoji, opts, (err, res) => {
      if (err) {
        return callback(err);
      }

      callback(null, res);
    });
  }

  /**
   * Instead of using WebClient, use "request" with multipart support
   * for uploading binary
   * TODO use WebClient when this is fixed
   *
   * @private
   * @param {string} id channel id
   * @param {object} file
   * @param {function} callback
   */
  _sendFileResponse(id, file, callback) {
    const url = 'https://slack.com/api/files.upload';

    const r = request.post(url, (err, res, body) => {
      if (err) {
        return callback(err);
      }

      const data = JSON.parse(body);

      if (!data.ok) {
        return callback(new Error(data.error));
      }

      callback(null, data);
    });

    const form = r.form();

    form.append('token', this._api._token);
    form.append('channels', id);
    form.append('filename', file.filename);
    form.append('filetype', getFileExtension(file.filename));

    /**
     * Slack API expect one of two fields, file or content.
     * file is used when sending multipart/form-data, content
     * is used when sending urlencodedform
     * @see https://api.slack.com/methods/files.upload
     */
    if (file.content instanceof fs.ReadStream) {
      form.append('file', file.content);
    } else {
      form.append('content', file.content);
    }
  }

  /**
   * Convert given array of target into array of id.
   * If no target is specified, use defaultTarget
   *
   * @private
   * @param {=Array.<string>} targets
   * @return {Array.<string>}
   */
  _mapTargetToId(optTargets) {
    const targets = optTargets && optTargets.length > 0 ? optTargets : this._defaultTarget;
    const idFormat = ['C', 'G', 'D'];

    return targets.map(target => {
      if (Array.isArray(target)) {
        return this._getMpimTarget(target);
      }

      // skip mapping if already an id
      if (idFormat.indexOf(target.substring(0, 1)) > -1) {
        return target;
      }

      const channel = this._dataStore.getChannelOrGroupByName(target);

      if (!channel) {
        // not a channel or group, use user id
        // prefix with u__ to mark that we need to "open im" first
        // before we can send message
        const user = this._dataStore.getUserByName(target.replace('@', ''));

        if (!user) {
          return null;
        }

        return USER_PREFIX + user.id;
      }

      return channel.id;
    }).filter(target => target !== null);
  }

  /**
   * MPIM target is marked by specifying array of target,
   * we need to get list of user id (if not already),
   * and exclude invalid target (channel, group, etc)
   *
   * @param {Array.<string>} users
   * @return {string}
   */
  _getMpimTarget(users) {
    const userIds = users.map(t => {
      const mark = t.substring(0, 1);
      switch (mark) {
        // direct message, we need to get the user id
        case 'D': {
          const dm = this._dataStore.getDMById(t);

          if (!dm) {
            return null;
          }

          return dm.user;
        }

        case 'U':
          return t;

        // invalid input
        case 'C':
        case 'G':
          return null;

        // treat other target as user name
        default: {
          const user = this._dataStore.getUserByName(t.replace('@', ''));

          if (!user) {
            return null;
          }

          return user.id;
        }
      }
    }).filter(user => user !== null);

    return MPIM_PREFIX + userIds.join(',');
  }
}
