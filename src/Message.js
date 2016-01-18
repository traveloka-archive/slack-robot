import { EVENTS } from 'slack-client';
import { stripEmoji } from './util';

const MESSAGE_TYPE = EVENTS.API.EVENTS;

/**
 * @public
 * @param {Object} bot
 * @param {SlackDataStore} dataStore
 * @param {Object} messageObject
 * @return {Object}
 */
export default class Message {
  constructor(bot, dataStore, messageObject) {
    const type = messageObject.type;
    const from = dataStore.getUserById(messageObject.user);

    let to;
    let channelId;
    let value = {};
    let timestamp;

    switch (messageObject.type) {
      case MESSAGE_TYPE.MESSAGE:
        channelId = messageObject.channel;
        value = parseTextMessage(dataStore, bot, messageObject.text);
        timestamp = messageObject.ts;
        break;
      case MESSAGE_TYPE.REACTION_ADDED:
        channelId = messageObject.item.channel;
        timestamp = messageObject.item.ts;
        value = { emoji: stripEmoji(messageObject.reaction) };
        break;
      default:
    }

    if (channelId) {
      to = dataStore.getChannelGroupOrDMById(channelId);
    }

    this.from = from;
    this.to = to;
    this.timestamp = timestamp;
    this.type = type;
    this.value = value;
  }
}
/**
 * Parse message text and convert user/channel reference and links
 *
 * @private
 * @param {SlackDataStore} dataStore
 * @param {Object} bot
 * @param {?string} textMessage
 * @see Ref: https://github.com/slackhq/hubot-slack/blob/master/src/slack.coffee#L153
 * @return {object}
 */
function parseTextMessage(dataStore, bot, textMessage) {
  let mentioned = false;

  if (!textMessage) {
    textMessage = '';
  }

  let text = textMessage.replace(/<([@#!])?([^>|]+)(?:\|([^>]+))?>/g, (m, type, link, label) => {
    let user, channel;
    switch (type) {
      case '@':
        if (label) {
          return `@${label}`;
        }

        user = dataStore.getUserById(link);
        if (user) {
          return `@${user.name}`;
        }

      case '#':
        if (label) {
          return `#${label}`;
        }

        channel = dataStore.getChannelById(link);
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
        return link.replace(/https?:\/\//, '');
    }
  });
  text = text.split(' ').filter(x => x !== '').join(' ');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&amp;/g, '&');

  const botMatcher = new RegExp(`@?${bot.name}:?`);
  if (text.match(botMatcher)) {
    mentioned = true;
    text = text.split(botMatcher).map(x => x.trim()).join(' ').trim();
  }

  return {
    text,
    mentioned
  };
}
