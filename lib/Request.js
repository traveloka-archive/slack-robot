/* @flow */
import Slack from 'slack-client';

type RequestMessage = {
  text: string,
  type: string
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

  message: RequestMessage;

  user: ?RequestUser;

  channel: ?RequestChannel;

  param: Object;

  matches: Array<string>;

  constructor(slack : Slack, slackMessage: Slack.Message, botMention : RegExp) {
    this._slack = slack;

    // Public properties
    this.message = this._createMessageObject(slackMessage, botMention);
    this.user = this._createUserObject(slackMessage);
    this.channel = this._createChannelObject(slackMessage);
  }

  _createMessageObject(slackMessage: Slack.Message, botMention : RegExp): RequestMessage {
    var message = {};
    message.text = this._removeSlackFormatting(slackMessage.text, botMention);
    message.type = slackMessage.getChannelType();

    return message;
  }

  _createUserObject(slackMessage: Slack.Message): ?RequestUser {
    var user = {};
    var slackUserObject: SlackUserObject = this._slack.getUserByID(slackMessage.user);

    if (!slackUserObject) {
      return;
    }

    user.id = slackUserObject.id;
    user.name = slackUserObject.name;

    return user;
  }

  _createChannelObject(slackMessage: Slack.Message): ?RequestChannel {
    var channel = {};
    var slackChannelObject = this._slack.getChannelGroupOrDMByID(slackMessage.channel);

    if (!slackChannelObject) {
      return;
    }

    channel.id = slackChannelObject.id;
    channel.name = slackChannelObject.name;

    return channel;
  }

  // Ref: https://github.com/slackhq/hubot-slack/blob/master/src/slack.coffee#L153
  _removeSlackFormatting(text: string, botMention: RegExp): string {
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
    text = text.replace(botMention, '').trim()

    return text;
  }
}

export default Request;
