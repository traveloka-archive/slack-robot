/* @flow */
import Slack from 'slack-client';

type RequestMessage = {
  text: string,
  isDirect: boolean,
  withMention: boolean
}

type RequestUser = {
  id: string,
  name: string
}

type RequestChannel = {
  name: string
}

type SlackUserObject = {
  id: string,
  name: string
}

class Request {
  _slack: Slack;

  _botMention: RegExp;

  message: RequestMessage;

  user: ?RequestUser;

  channel: ?RequestChannel;

  param: Object;

  matches: Array<string>;

  constructor(slack: Slack, botMention: RegExp) {
    this._slack = slack;
    this._botMention = botMention;
  }

  parse(slackMessage: Slack.Message): Request {
    this.message = this._createMessageObject(slackMessage, this._botMention);
    this.user = this._createUserObject(slackMessage);
    this.channel = this._createChannelObject(slackMessage);
    return this;
  }

  _createMessageObject(slackMessage: Slack.Message, botMention : RegExp): RequestMessage {
    var text = slackMessage.text;

    if (!text) {
      text = '';
    }

    // Ref: https://github.com/slackhq/hubot-slack/blob/master/src/slack.coffee#L153
    text = text.replace(/<([@#!])?([^>|]+)(?:\|([^>]+))?>/g, (m, type, link, label) => {
      var user, channel;
      switch (type) {
        case '@':
          if (label) {
            return label;
          }
          user = this._slack.getUserByID(link);
          if (user) {
            return `@${user.name}`;
          }

        case '#':
          if (label) {
            return label;
          }

          channel = this._slack.getChannelByID(link);
          if (channel) {
            return `#${channel.name}`;
          }

        case '!':
          if (['channel', 'group', 'everyone'].indexOf(link) !== -1) {
            return `@${link}`;
          }

        default:
          link = link.replace('/^mailto:/', '');
          if ((label) && (link.indexOf(label) === -1)) {
            return `${label}(${link})`;
          }
          return link;
      }
    });
    text = text.split(' ').filter(x => x !== '').join(' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    return {
      text: text.replace(botMention, '').trim(),
      isDirect: slackMessage.getChannelType() === 'DM',
      withMention: Boolean(text.match(botMention))
    };
  }

  _createUserObject(slackMessage: Slack.Message): ?RequestUser {
    var user = {};
    var slackUserObject: SlackUserObject = this._slack.getUserByID(slackMessage.user);

    if (!slackUserObject) {
      return null;
    }

    user.id = slackUserObject.id;
    user.name = slackUserObject.name;

    return user;
  }

  _createChannelObject(slackMessage: Slack.Message): ?RequestChannel {
    var channel = {};
    var slackChannelObject = this._slack.getChannelGroupOrDMByID(slackMessage.channel);

    if (!slackChannelObject) {
      return null;
    }

    channel.id = slackChannelObject.id;
    channel.name = slackChannelObject.name;

    return channel;
  }
}

export default Request;
