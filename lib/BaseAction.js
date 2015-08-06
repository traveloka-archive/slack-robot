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

    return this.sendDM_(user, response);
  }

  replyTextDM(message) {
    return this.replyDM({text: message});
  }

  sendTo(name, response) {
    response.as_user = true;

    return new Promise((resolve, reject) => {
      var target = this.robot_.slack_.getChannelGroupOrDMByName(name);
      target.postMessage(response);
      return resolve();
    });
  }

  sendTextTo(name, message) {
    return this.sendTo(name, {text: message});
  }

  sendDM_(user, response) {
    return new Promise((resolve, reject) => {
      this.robot_.slack_.openDM(user.id, () => {
        var dm = this.robot_.slack_.getDMByName(user.name);
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
