/* eslint no-underscore-dangle: 0 */
import uuid from "uuid";
import { stripEmoji } from "./util";

export default class Listener {
  constructor(type, value, callback) {
    this.id = uuid.v4();
    this.type = type;

    this.value = this._parseValue(type, value);
    this.matcher = this._createMatcher(this.value);
    this.callback = callback;
    this.description = "";
    this.acls = [];
  }

  desc(description) {
    this.description = description;
    return this;
  }

  acl(...acls) {
    this.acls = this.acls.concat(acls);
    return this;
  }

  // eslint-disable-next-line class-methods-use-this
  _parseValue(type, value) {
    switch (type) {
      case "message":
        return value;
      case "reaction_added":
        return stripEmoji(value).replace("+", "\\+");
      default:
        return value;
    }
  }

  /**
   * Convert value to regular expression for message checking
   *
   * @private
   * @param {?string|RegExp} value
   * @return {RegExp}
   */
  // eslint-disable-next-line class-methods-use-this
  _createMatcher(value) {
    if (value instanceof RegExp) {
      return value;
    }

    // eslint-disable-next-line no-useless-escape
    const expr = value.replace(/:[a-zA-Z]+\(([^\)]*)\)/g, "($1)");
    return new RegExp(`^${expr}$`);
  }
}
