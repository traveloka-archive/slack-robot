export default class BaseAction {
  constructor(robot) {
    this.robot_ = robot;
  }

  payload(messagePayload) {
    this.messagePayload = messagePayload;
    return this;
  }

  reply(response) {
    var {channel} = this.messagePayload;
    response.as_user = true;

    return new Promise((resolve, reject) => {
      channel.postMessage(response);
      return resolve();
    });
  }

  replyText(message) {
    return this.reply({text: message});
  }

  replyDM(response) {
    var {user} = this.messagePayload;
    response.as_user = true;

    return this.sendDM_(user.name, response);
  }

  replyTextDM(message) {
    return this.replyDM({text: message});
  }

  replyTo(name, response) {
    response.as_user = true;

    if (name[0] === '@') {
      return this.sendDM_(name, response);
    }

    return new Promise((resolve, reject) => {
      var target = this.robot_.slack_.getChannelGroupOrDMByName(name);
      target.postMessage(response);
      return resolve();
    });
  }

  replyTextTo(name, message) {
    return this.replyTo(name, {text: message});
  }

  sendDM_(userName, response) {
    return new Promise((resolve, reject) => {
      this.robot_.slack_.openDM(userName, () => {
        var dm = this.robot_.slack_.getDMByName(userName);
        dm.postMessage(response);
        return resolve();
      });
    });
  }

  mentionUser(userName) {
    if (userName[0] !== '@') {
      return `<@${userName}>`;
    }

    return `<${userName}>`;
  }

  mentionChannel(channelName) {
    if (channelName[0] !== '#') {
      return `<#${channelName}>`;
    }

    return `<${channelName}>`;
  }
}
