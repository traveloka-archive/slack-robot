import Log from 'log';
import EventEmitter from 'eventemitter3';
import Promise from 'bluebird';
import { RtmClient, WebClient, EVENTS } from 'slack-client';
import { MemoryDataStore } from 'slack-client/lib/data-store';
import Listeners from './Listeners';
import Message from './Message';
import Request from './Request';
import Response from './Response';

const logger = new Log('info');
const RTM_EVENTS = EVENTS.CLIENT.RTM;
const MESSAGE_TYPE = EVENTS.API.EVENTS;

export default class Robot extends EventEmitter {
  constructor(token) {
    if (!token) {
      throw new Error('Invalid slack access token');
    }

    super();

    /**
     * Bot information
     *
     * @public
     */
    this.bot = null;

    /**
     * Bot properties
     *
     * @private
     */
    this._vars = {
      concurrency: 1
    };

    /**
     *
     */
    this._messageQueue = [];

    /**
     *
     */
    this._plugins = [];

    /**
     * Ignore all listener in this channel
     *
     * @private
     */
    this._ignoredChannels = [];

    /**
     * Use slack-client it to simplify user & channel mapping
     * instead of creating our own, websocket listener is also
     * already handled
     *
     * @param {string} token
     * @private
     */
    this._rtm = new RtmClient(token, { dataStore: new MemoryDataStore() });

    /**
     * API call via slack-client WebClient
     *
     * @param {string} token
     * @private
     */
    this._api = new WebClient(token);

    /**
     *
     * @private
     */
    this._listeners = new Listeners();
  }

  /**
   * Shortcut for listening text message
   *
   * @public
   * @param {?string|RegExp} message
   * @param {?function} callback
   * @returns {Listener}
   */
  listen(message, callback) {
    return this.when('message', message, callback);
  }

  /**
   * Generic listener
   *
   * @param {string} type
   * @param {string|RegExp} value
   * @param {function} callback
   */
  when(type, value, callback) {
    if (!type || typeof type !== 'string') {
      throw new TypeError('Invalid listener type');
    }

    if (!value || (typeof value !== 'string' && value instanceof RegExp === false)) {
      throw new TypeError('Invalid message to listen');
    }

    if (!callback || typeof callback !== 'function') {
      throw new TypeError('Callback must be a function');
    }

    const listener = this._listeners.add(type, value, callback);
    return listener;
  }

  /**
   * @public
   * @param {...string} channels
   */
  ignore(...channels) {
    this._ignoredChannels = this._ignoredChannels.concat(channels);
  }

  /**
   * @param {function} plugin
   */
  use(plugin) {
    if (typeof plugin !== 'function') {
      throw new Error('Invalid plugin type');
    }

    /* eslint no-implicit-coercion: 0 */
    if (!~this._plugins.indexOf(plugin)) {
      plugin(this);
      this._plugins.push(plugin);
    }
  }

  /**
   * Change bot property
   *
   * @public
   * @param {string} property
   * @param {any} value
   */
  set(property, value) {
    if (value !== null && value !== undefined) {
      this._vars[property] = value;
    }
  }

  /**
   * Send robot response by without listener
   *
   * Caveat: .reaction. .async is disabled
   * @param {string} target
   */
  to(target, callback) {
    if (this.bot === null) {
      // not connected
      return setTimeout(() => {
        this.to(target, callback);
      }, 100);
    }

    const req = { to: { id: target }, message: {} };
    const res = new Response(this._api, this._rtm.dataStore, req, this._vars.concurrency);

    ['reaction', 'async'].forEach(invalidMethod => {
      Object.defineProperty(res, invalidMethod, {
        get() {
          return function invalid() {
            throw new Error(`Cannot use method .${invalidMethod}() in robot.to()`);
          };
        }
      });
    });

    callback(res);
  }

  /**
   * Login and start actually listening to message
   *
   * @public
   */
  start() {
    this._rtm.on(RTM_EVENTS.AUTHENTICATED, () => {
      this.bot = this._rtm.dataStore.getUserById(this._rtm.activeUserId);
      logger.info(`Logged in as ${this.bot.name}`);
    });

    this._rtm.on(MESSAGE_TYPE.MESSAGE, message => {
      if (message.subtype === 'message_changed') {
        /**
         * This is a follow up from reaction_added event added to file object
         * contain current message object and previous message object.
         * Currently it's the only possible scenario, because the bot
         * cannot edit message yet
         */
        return this._processQueuedMessage(message);
      }

      this._onMessage(message);
    });

    this._rtm.on(MESSAGE_TYPE.REACTION_ADDED, message => {
      /**
       * reaction_added event on file does not send info about
       * current channel, so we can't use it to respond correctly.
       * Instead of automatically triggering response for reaction_added
       * event, queue them until "message_changed" event arrived. Note
       * that this is not applicable for text/attachment
       */
      if (message.item.type !== 'message') {
        return this._queueMessage(message);
      }

      this._onMessage(message);
    });

    this._rtm.start();
  }

  /**
   * Handle message object from websocket connection
   *
   * @private
   * @param {Object} msg
   */
  _onMessage(msg) {
    const message = new Message(this.bot, this._rtm.dataStore, msg);

    if (!message.from) {
      // ignore invalid message (no sender)
      this.emit('message_no_sender', msg);
      return;
    }

    if (!message.to) {
      this.emit('message_no_channel', msg);
      return;
    }

    if (message.from.id === this.bot.id) {
      // ignore own message
      this.emit('own_message', message);
      return;
    }

    for (let i = 0; i < this._ignoredChannels.length; i++) {
      if (message.to.name && this._ignoredChannels[i].indexOf(message.to.name) > -1) {
        this.emit('ignored_channel', message);
        return;
      }
    }

    const listener = this._listeners.find(message);
    if (!listener) {
      this.emit('no_listener_match', message);
      return;
    }

    // set concurrency based on current data
    let concurrency = parseInt(this._vars.concurrency, 10);
    /* istanbul ignore if */
    if (!concurrency) {
      concurrency = 1;
    }
    this._api._requestQueue.concurrency = concurrency;

    const request = new Request(message, listener);
    const response = new Response(this._api, this._rtm.dataStore, request, concurrency);
    response.on('task_error', err => this.emit('response_failed', err));

    // wrap in "new Promise()"" instead of "Promise.resolve()"
    // because using Promise.resolve won't catch any uncaught
    // exception in listener.callback
    new Promise(resolve => {
      return resolve(listener.callback(request, response));
    })
    .then(() => this.emit('message_handled', message))
    .catch(err => this.emit('error', err));
  }

  /**
   * Queue message that have no channel information
   *
   * @private
   * @param {Object} message
   */
  _queueMessage(message) {
    const entry = this._getQueueEntry(message);

    // currently we have no way of returning null because
    // we only handle reaction_added event, so this branch
    // is safe to be excluded from code coverage
    /* istanbul ignore if */
    if (!entry) {
      return;
    }

    this._messageQueue.push(entry);
  }

  /**
   * Queue message that have no channel information
   *
   * @private
   * @param {Object} message
   * @return {MessageQueue}
   */
  _getQueueEntry(message) {
    switch (message.type) {
      case 'reaction_added':
        if (message.item.type === 'file') {
          return {
            id: message.item.file,
            user: message.user,
            type: message.item.type,
            reaction: message.reaction,
            originalType: message.type
          };
        }
        // item.type === 'file_comment'
        return {
          id: message.item.file,
          user: message.user,
          type: message.item.type,
          reaction: message.reaction,
          originalType: message.type
        };
      /* istanbul ignore next */
      default:
        return null;
    }
  }

  /**
   * Find queued message that match current message
   *
   * @private
   * @param {Object} message
   */
  _processQueuedMessage(message) {
    for (let i = 0; i < this._messageQueue.length; i++) {
      const entry = this._messageQueue[i];

      /* istanbul ignore else */
      if (this._isReactionAddEvent(entry, message)) {
        const msg = {
          type: entry.originalType,
          user: entry.user,
          reaction: entry.reaction,
          item: {
            type: 'message',
            channel: message.channel,
            ts: message.message.ts
          },
          eventTs: message.eventTs,
          ts: message.ts
        };
        this._messageQueue.splice(i, 1);
        this._onMessage(msg);
        break;
      }
    }
  }

  _isReactionAddEvent(entry, message) {
    /* istanbul ignore else */
    if (message.message.file && message.message.file.id === entry.id) {
      return true;
    }

    // apparently istanbul doesn't recognize this else pattern
    // so we should add another Ignore
    /* istanbul ignore next */
    return false;
  }
}
