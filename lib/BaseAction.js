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
        var dm;
        var dmId = this.robot_.slack_.getDMById(user.id);
        var dmName = this.robot_.slack_.getDMByName(user.name);

        if (dmId && dmId.postMessage) {
          dm = dmId;
        }
        else if (dmName && dmName.postMessage) {
          dm = dmName;
        }

        if (dm) {
          dm.postMessage(response);
          return resolve();
        }
        else {
          return reject(new Error('Cannot get dm instance'));
        }

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
