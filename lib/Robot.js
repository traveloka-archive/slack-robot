import Log from 'log';
import Store from 'imstore';
import Slack from 'slack-client';
import Neuron from './Neuron';

export default class Robot {
  constructor(botOpts, slackOpts) {
    this.brain = new Store();
    this.logger = new Log(process.env.SLACK_ROBOT_LOG_LEVEL || 'info');
    this.slack_ = new Slack(slackOpts.token, slackOpts.autoReconnect, slackOpts.autoMark);
    this.neuron_ = new Neuron(this);
    this.botOptions_ = this.getBotOptions_(botOpts);

    this.init_();
  }

  listen(messageFormat) {
    return this.neuron_.listen(messageFormat);
  }

  getBotOptions_(botOpts) {
    const DEFAULT_OPTS = {
      ignoreMessageInGeneral: true,
      mentionToRespond: true,
      removeBotMention: true
    };

    return Object.assign(DEFAULT_OPTS, botOpts);
  }

  init_() {
    this.initSlack_();
  }

  initSlack_() {
    this.slack_.on('loggedIn', bot => {
      this.logger.info(`Logged in as ${bot.name}`);

      bot.mention = new RegExp(`.*@${bot.name}:?`)
      this.bot_ = bot;
    });

    this.slack_.on('message', message => {
      var channel = this.slack_.getChannelGroupOrDMByID(message.channel);
      var user = this.slack_.getUserByID(message.user);
      message.text = this.removeSlackFormatting_(message.text);
      this.handle_(message, user, channel);
    });

    this.slack_.on('error', err => {
      this.logger.error(err);
    });

    this.slack_.login();
  }

  handle_(message, user, channel) {
    if (user.id === this.bot_.id) {
      return;
    }

    if (this.botOptions_.ignoreMessageInGeneral && channel.name == 'general') {
      return;
    }

    if (this.botOptions_.mentionToRespond && !message.text.match(this.bot_.mention)) {
      return;
    }

    if (this.botOptions_.removeBotMention) {
      message.text = message.text.replace(this.bot_.mention, '').trim();
    }

    this.neuron_.handle(message, user, channel);
  }

  // Ref: https://github.com/slackhq/hubot-slack/blob/master/src/slack.coffee#L153
  removeSlackFormatting_(text) {
    if (!text) return '';
    text = text.replace(/<([@#!])?([^>|]+)(?:\|([^>]+))?>/g, (m, type, link, label) => {
      var user, channel, link;
      switch(type) {
        case '@':
          if (label) return label;
          user = this.slack_.getUserByID(link);
          if (user) return '@' + user.name;

        case '#':
          if (label) return label;
          channel = this.slack_.getChannelByID(link);
          if (channel) return '#' + channel.name;

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
