import Listener from './Listener';
import { find } from 'lodash';

export default class Listeners {
  constructor() {
    this._entries = [];
  }

  /**
   * @public
   * @param {string} type
   * @param {string|RegExp} value
   * @param {function (req, res)} callback
   * @return {Object} listener
   */
  add(type, value, callback) {
    const entry = new Listener(type, value, callback);
    this._entries.push(entry);
    return entry;
  }

  /**
   * @public
   * @param {string} id
   * @return {?Object} listener
   */
  get(id) {
    return find(this._entries, 'id', id);
  }

  /**
   * @public
   * @param {Message} message
   * @return {?Object} listener
   */
  find(message) {
    let value = '';
    const type = message.type;

    switch (type) {
      case 'message':
        value = message.value.text;
        break;
      case 'reaction_added':
        value = message.value.emoji;
        break;
      default:
    }

    const entries = this._entries.filter(entry => entry.type === type);

    for (let i = 0; i < entries.length; i++) {
      // get first entry, or first match
      if (!entries[i].matcher || value.match(entries[i].matcher)) {
        return entries[i];
      }
    }

    return null;
  }
}
