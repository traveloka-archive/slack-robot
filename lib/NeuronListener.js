import BaseAction from '../action/BaseAction';

export default class NeuronListener {
  constructor(robot, messageFormat) {
    this.robot_ = robot;
    this.messageFormat = messageFormat;
    this.matcher = this.createMatcher_(messageFormat);
    this.commandInfo = this.createCommandInfo_(messageFormat);
  }

  desc(description) {
    if (typeof description !== 'string' || !description) throw new TypeError('Description must be non-empty string');
    this.description = description;
    return this;
  }

  acl(aclFn) {
    if (typeof aclFn !== 'function') throw new TypeError('ACL callback must be a function');
    this.aclFn = aclFn;
    return this;
  }

  handler(action) {
    if (!(action instanceof BaseAction)) throw new TypeError('Action must be instance of BaseAction');
    this.action = action;
  }

  respondTo(message, user, channel) {
    if (!(message.text.match(this.matcher))) {
      return {match: false, allowed: false};
    }

    this.robot_.logger.info(`Received ${message.text} from ${user.name}`);

    // message match, but there is no ACL associated with this message,
    // immediately execute handler for this message
    if (typeof this.aclFn !== 'function') {
      return {match: true, allowed: true};
    }

    var param = this.getPayloadParam_(message.text);
    var payload = {message, user, channel, param};
    var action = new BaseAction(this.robot_);
    action.payload(payload);
    var allowed = this.aclFn(payload, action);
    return {match: true, allowed: allowed};
  }

  handle(message, user, channel) {
    var param = this.getPayloadParam_(message.text);
    var payload = {message, user, channel, param};

    return this.action.payload(payload).execute();
  }

  createCommandInfo_(messageFormat) {
    return messageFormat.replace(/(:[a-zA-Z]+)\(([^\)]*)\)/g, '$1');
  }

  createMatcher_(messageFormat) {
    var messageExpression = messageFormat.replace(/:[a-zA-Z]+\(([^\)]*)\)/g, '($1)');
    return new RegExp(messageExpression);
  }

  getPayloadParam_(messageText) {
    var payload = {};
    var payloadList = this.messageFormat.match(/:[a-zA-Z]+/g);

    if (!payloadList) return payload;

    // remove leading : in named regex
    payloadList = payloadList.map(v => {
      return v.replace(/^:/, '')
    });

    for (var i = 0; i < payloadList.length; i++) {
      var regexIndex = '$' + (i+1);
      var payloadName = payloadList[i];
      payload[payloadName] = messageText.replace(this.matcher, regexIndex);
    }

    return payload;
  }
}
