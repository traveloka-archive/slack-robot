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

const USER_PREFIX = 'u__';

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
    this._defaultTarget = request.to.id;
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
   * Send basic text message
   *
   * @public
   * @param {string} text
   * @param {=Array.<string>|string} optTargets
   * @return {Response}
   */
  text(text, optTargets) {
    const targets = this._getTargets(optTargets);
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

      if (arguments.length === 3) {
        optTargets = arguments[2];
      }
    } else {
      attachments = args[0];
      if (arguments.length === 2) {
        optTargets = arguments[1];
      }
    }

    const targets = this._getTargets(optTargets);
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
  upload(filename, content, optTargets) {
    const targets = this._getTargets(optTargets);
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
        channel: this._defaultTarget,
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

      this._api.dm.open(userId, (err, data) => {
        if (err) {
          return callback(err);
        }

        if (!data.ok) {
          return callback(new Error(data.error));
        }

        task.target = data.channel.id;
        this._sendResponse(task, callback);
      });

      return;
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
   * @param {string} target channel id
   * @param {string} text
   * @param {function} callback
   */
  _sendTextResponse(target, text, callback) {
    this._api.chat.postMessage(target, text, DEFAUT_POST_MESSAGE_OPTS, (err, res) => {
      if (err) {
        return callback(err);
      }

      callback(null, res);
    });
  }

  /**
   * @private
   * @param {string} target channel id
   * @param {object} attachment
   * @param {function} callback
   */
  _sendAttachmentResponse(target, attachment, callback) {
    const { text, attachments } = attachment;
    const opts = {
      ...DEFAUT_POST_MESSAGE_OPTS,
      attachments: JSON.stringify(attachments)
    };

    this._api.chat.postMessage(target, text, opts, (err, res) => {
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
   * @param {string} target channel id
   * @param {object} file
   * @param {function} callback
   */
  _sendFileResponse(target, file, callback) {
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
    form.append('channels', target);
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
   * Check whether use supplied target or default target
   *
   * @private
   * @param {=string|Array.<string>} optTargets
   * @return {Array.<string>}
   */
  _getTargets(optTargets) {
    let targets;

    if (optTargets) {
      targets = optTargets;

      if (typeof optTargets === 'string') {
        targets = [optTargets];
      }
    } else {
      targets = [this._defaultTarget];
    }

    return targets.map(target => {
      const idFormat = ['C', 'G', 'D'];
      const firstChar = target.substring(0, 1);

      // skip mapping if already an id
      if (idFormat.indexOf(firstChar) > -1) {
        return target;
      }

      const channel = this._dataStore.getChannelOrGroupByName(target);

      if (!channel) {
        // not a channel or group, use user id
        // prefix with u__ to mark that we need to "open im" first
        // before we can send message
        const username = target.replace('@', '');
        const user = this._dataStore.getUserByName(username);

        if (!user) {
          return null;
        }

        return USER_PREFIX + user.id;
      }

      return channel.id;
    }).filter(target => target !== null);
  }
}
