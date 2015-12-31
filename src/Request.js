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

  /* @deprecated in v3.x */
  param: Object;

  params: Object;

  matches: Array<string>;

  constructor(slack: Slack, botMention: RegExp) {
    this._slack = slack;
    this._botMention = botMention;
  }

  get param() {
    console.warn('Request.param is deprecated, use Request.params instead');
    return this.params;
  }

  parse(slackMessage: Slack.Message): Request {
    this.message = this._createMessageObject(slackMessage, this._botMention);
    this.user = this._createUserObject(slackMessage.user);
    this.channel = this._createChannelObject(slackMessage.channel);
    return this;
  }

  parseRawReaction(slackRawReactionMessage): Request {
    this.message = {
      text: '/reaction ${slackRawReactionMessage.name}',
      isDirect: false,
      withMention: false
    };
    this._createMessageObject(slackRawReactionMessage.name, this._botMention);
    this.user = this._createUserObject(slackRawReactionMessage.user);
    this.channel = this._createChannelObject(slackRawReactionMessage.item.channel);
    return this;
  }

  _createMessageObject(slackMessage: Slack.Message, botMention : RegExp): RequestMessage {
    let text = slackMessage.text;

    if (!text) {
      text = '';
    }

    // Ref: https://github.com/slackhq/hubot-slack/blob/master/src/slack.coffee#L153
    text = text.replace(/<([@#!])?([^>|]+)(?:\|([^>]+))?>/g, (m, type, link, label) => {
      let user, channel;
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

  _createUserObject(userId: String): ?RequestUser {
    const user = {};
    const slackUserObject: SlackUserObject = this._slack.getUserByID(userId);

    if (!slackUserObject) {
      return null;
    }

    user.id = slackUserObject.id;
    user.name = slackUserObject.name;

    return user;
  }

  _createChannelObject(channelId: String): ?RequestChannel {
    const channel = {};
    const slackChannelObject = this._slack.getChannelGroupOrDMByID(channelId);

    if (!slackChannelObject) {
      return null;
    }

    channel.id = slackChannelObject.id;
    channel.name = slackChannelObject.name;

    return channel;
  }
}

export default Request;
