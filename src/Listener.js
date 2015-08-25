/* @flow */
/* eslint prefer-reflect:0 */
import Robot from './Robot';
import Request from './Request';
import Response from './Response';
import Promise from 'bluebird';

type ListenerResponse = {
  match: boolean,
  allowed: boolean
};

class Listener {
  robot_: Robot;

  messageFormat: string|RegExp;

  matcher: RegExp;

  commandInfo: string;

  description: ?string;

  aclFn: ?Function;

  handle: Function;

  constructor(robot: Robot, messageFormat: string|RegExp) {
    this.robot_ = robot;
    this.messageFormat = messageFormat;
    this.matcher = this._createMatcher(messageFormat);
    this.commandInfo = this._createCommandInfo(messageFormat);

    // pre-defined handle 'method' with rejected promise
    this.handle = () => Promise.reject(new Error('Unknown handle'));
  }

  desc(description: string): Listener {
    if (typeof description !== 'string' || !description) {
      throw new TypeError('Description must be non-empty string');
    }

    this.description = description;
    return this;
  }

  acl(aclFn: Function): Listener {
    if (typeof aclFn !== 'function') {
      throw new TypeError('ACL callback must be a function');
    }

    this.aclFn = aclFn;
    return this;
  }

  handler(action: Function) {
    if (typeof action !== 'function') {
      throw new TypeError('Action must be a function');
    }

    this.handle = action;
  }

  respondTo(req: Request, res: Response): ListenerResponse {
    if (!(req.message.text.match(this.matcher))) {
      return {match: false, allowed: false};
    }

    if (req.user && req.user.name) {
      this.robot_.logger.info(`Received ${req.message.text} from ${req.user.name}`);
    }

    req.param = this._getParam(req.message.text);
    req.matches = this._getMatches(req.message.text);

    if (typeof this.aclFn === 'function') {
      var allowed = this.aclFn(req, res);
      return {match: true, allowed};
    }

    return {match: true, allowed: true};
  }

  _createCommandInfo(messageFormat: string|RegExp): string {
    if (messageFormat instanceof RegExp) {
      return messageFormat.toString();
    }

    return messageFormat.replace(/(:[a-zA-Z]+)\(([^\)]*)\)/g, '$1');
  }

  _createMatcher(messageFormat: string|RegExp): RegExp {
    if (messageFormat instanceof RegExp) {
      return messageFormat;
    }

    var messageExpression = messageFormat.replace(/:[a-zA-Z]+\(([^\)]*)\)/g, '($1)');
    return new RegExp(messageExpression);
  }

  _getParam(messageText: string): Object {
    var payload = {};

    if (this.messageFormat instanceof RegExp) {
      return payload;
    }

    var payloadList = this.messageFormat.match(/:[a-zA-Z]+/g);

    if (!payloadList) {
      return payload;
    }

    // remove leading ":" in named regex
    payloadList = payloadList.map(v => {
      return v.replace(/^:/, '');
    });

    for (var i = 0; i < payloadList.length; i++) {
      var regexIndex = '$' + (i + 1);
      var payloadName = payloadList[i];
      payload[payloadName] = messageText.replace(this.matcher, regexIndex);
    }

    return payload;
  }

  _getMatches(messageText: string): Array<string> {
    var matches = messageText.match(this.matcher);

    // first regex match always return the message and we don't need it
    // we only care about other matches so we remove it from result
    matches.shift();

    return Array.prototype.slice.call(matches);
  }
}

export default Listener;
