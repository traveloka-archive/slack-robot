import Log from 'log';
import Store from 'imstore';
import Slack from 'slack-client';
import Neuron from './Neuron';

export default class Robot {
  constructor(slackOptions, robotOptions) {
    if (!slackOptions || (typeof slackOptions === 'object' && !slackOptions.token)) {
      throw new Error('Invalid slack access token');
    }

    if (typeof slackOptions === 'string') {
      slackOptions = this._mergeSlackOptions({token: slackOptions});
    } else {
      slackOptions = this._mergeSlackOptions(slackOptions);
    }

    if (!robotOptions || typeof robotOptions !== 'object') {
      robotOptions = this._mergeRobotOptions({});
    } else {
      robotOptions = this._mergeRobotOptions(robotOptions);
    }

    this.brain = new Store();
    this.logger = new Log(process.env.SLACK_ROBOT_LOG_LEVEL || 'info');

    this._slack = new Slack(slackOptions.token, slackOptions.autoReconnect, slackOptions.autoMark);
    this._neuron = new Neuron(this);
    this._botOptions = robotOptions;

    this._init();
  }

  listen(messageFormat) {
    return this._neuron.listen(messageFormat);
  }

  _mergeSlackOptions(options) {
    const DEFAULT_OPTS = {
      autoReconnect: true,
      autoMark: true
    };

    return Object.assign(DEFAULT_OPTS, options);
  }

  _mergeRobotOptions(options) {
    const DEFAULT_OPTS = {
      ignoreMessageInGeneral: true,
      mentionToRespond: true,
      skipDMMention: true,
      removeBotMention: true
    };

    return Object.assign(DEFAULT_OPTS, options);
  }

  _init() {
    this._initSlack();
  }

  _initSlack() {
    this._slack.on('loggedIn', bot => {
      this.logger.info(`Logged in as ${bot.name}`);
      bot.mention = new RegExp(`.*@${bot.name}:?`);
      this._bot = bot;
    });

    this._slack.on('message', message => {
      var channel = this._slack.getChannelGroupOrDMByID(message.channel);
      var user = this._slack.getUserByID(message.user);

      // ignore unknown user/channel
      if (!channel || !user) {
        return;
      }

      message.text = this.removeSlackFormatting_(message.text);
      this.handle_(message, user, channel);
    });

    this._slack.on('error', err => {
      this.logger.error(err);
    });

    this._slack.login();
  }

  handle_(message, user, channel) {
    if (user.id === this._bot.id) {
      return;
    }

    if (this._botOptions.ignoreMessageInGeneral && channel.name === 'general') {
      return;
    }

    if (!message.text.match(this._bot.mention)) {
      // not mentioned
      if (message.getChannelType() === 'DM') {
        // in direct message
        if (this._botOptions.skipDMMention) {
          // handle: do not return
        } else if (this._botOptions.mentionToRespond) {
          // should mention even in DM, but didn't
          // do not handle, return early
          return;
        }
      } else if (this._botOptions.mentionToRespond) {
        // should be mentioned, but didn't
        // do not handle, return early
        return;
      }
    }

    if (this._botOptions.removeBotMention) {
      message.text = message.text.replace(this._bot.mention, '').trim();
    }

    this._neuron.handle(message, user, channel);
  }

  // Ref: https://github.com/slackhq/hubot-slack/blob/master/src/slack.coffee#L153
  removeSlackFormatting_(text) {
    if (!text) {
      return '';
    }

    text = text.replace(/<([@#!])?([^>|]+)(?:\|([^>]+))?>/g, (m, type, link, label) => {
      var user, channel;
      switch (type) {
        case '@':
          if (label) {
            return label;
          }
          user = this._slack.getUserByID(link);
          if (user) {
            return '@' + user.name;
          }

        case '#':
          if (label) {
            return label;
          }

          channel = this._slack.getChannelByID(link);
          if (channel) {
            return '#' + channel.name;
          }

        case '!':
          if (['channel', 'group', 'everyone'].indexOf(link) !== -1) {
            return '@' + link;
          }

        default:
          link = link.replace('/^mailto:/', '');
          if ((label) && (link.indexOf(label) === -1)) {
            return label + '(' + link + ')';
          }
          return link;
      }
    });
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');

    return text;
  }
}
