import Promise from 'bluebird';

export default class NeuronListener {
  constructor(robot, messageFormat) {
    this.robot_ = robot;
    this.messageFormat = messageFormat;
    this.matcher = this._createMatcher(messageFormat);
    this.commandInfo = this._createCommandInfo(messageFormat);

    // pre-defined handle 'method' with rejected promise
    this.handle = () => Promise.reject(new Error('Unknown handle'));
  }

  desc(description) {
    if (typeof description !== 'string' || !description) {
      throw new TypeError('Description must be non-empty string');
    }

    this.description = description;
    return this;
  }

  acl(aclFn) {
    if (typeof aclFn !== 'function') {
      throw new TypeError('ACL callback must be a function');
    }

    this.aclFn = aclFn;
    return this;
  }

  handler(action) {
    if (typeof action !== 'function') {
      throw new TypeError('Action must be a function');
    }

    this.handle = action;
  }

  respondTo(req, res) {
    if (!(req.message.text.match(this.matcher))) {
      return {match: false, allowed: false};
    }

    this.robot_.logger.info(`Received ${req.message.text} from ${req.user.name}`);

    if (typeof this.aclFn !== 'function') {
      return {match: true, allowed: true};
    }

    req.param = this._getParam(req.message.text);
    req.matches = this._getMatches(req.message.text);

    var allowed = this.aclFn(req, res);
    return {match: true, allowed};
  }

  _createCommandInfo(messageFormat) {
    if (messageFormat instanceof RegExp) {
      return messageFormat.toString();
    }

    return messageFormat.replace(/(:[a-zA-Z]+)\(([^\)]*)\)/g, '$1');
  }

  _createMatcher(messageFormat) {
    if (messageFormat instanceof RegExp) {
      return messageFormat;
    }

    var messageExpression = messageFormat.replace(/:[a-zA-Z]+\(([^\)]*)\)/g, '($1)');
    return new RegExp(messageExpression);
  }

  _getParam(messageText) {
    var payload = {};
    var payloadList = this.messageFormat.match(/:[a-zA-Z]+/g);

    if (!payloadList) {
      return payload;
    }

    // remove leading : in named regex
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

  _getMatches(messageText) {
    var matches = messageText.match(this.matcher);

    // first regex match always return the message and we don't need it
    // we only care about other matches so we remove it from result
    matches.shift();

    return Reflect.apply(Array.prototype.slice, matches);
  }
}
