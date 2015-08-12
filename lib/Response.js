/* @flow */
import Slack from 'slack-client';
import Promise from 'bluebird';

export default class Response {
  _slack: Slack;

  channel: Slack.Channel;

  user: Slack.User;

  constructor(slack: Slack, slackMessage : Slack.Message) {
    this._slack = slack;
    this.channel = slack.getChannelGroupOrDMByID(slackMessage.channel);
    this.user = slack.getUserByID(slackMessage.user);
  }

  send(response : Slack.Response) {
    response.as_user = true;
    if (response.text) {
      response.text = this._autoMention(response.text);
    }

    return new Promise((resolve, reject) => {
      this.channel.postMessage(response);
      resolve();
    });
  }

  sendText(text: string): Promise {
    return this.send({text});
  }

  sendDM(response: Slack.Response): Promise {
    response.as_user = true;
    if (response.text) {
      response.text = this._autoMention(response.text);
    }

    return new Promise((resolve, reject) => {
      this._slack.openDM(this.user.id, () => {
        try {
          var dm = this._slack.getDMByID(this.user.id);
          dm.postMessage(response);
          resolve();
        }
        catch (ex) {
          reject(ex);
        }
      });
    });
  }

  sendTextDM(text: string): Promise {
    return this.sendDM({text});
  }

  sendTo(name: string, response: Slack.Response): Promise {
    response.as_user = true;
    if (response.text) {
      response.text = this._autoMention(response.text);
    }

    return new Promise((resolve, reject) => {
      var target = this._slack.getChannelGroupOrDMByName(name);
      target.postMessage(response);
      return resolve();
    });
  }

  sendTextTo(name: string, text: string): Promise {
    return this.sendTo(name, {text});
  }

  reply(text: string): Promise {
    if (typeof text !== 'string') {
      return Promise.reject(new TypeError('You can only reply using simple string'));
    }

    text = `@${this.user.name}: ${text}`;
    return this.sendText(text);
  }

  _autoMention(text: string): Promise {
    return text.replace(/([\@\#])([a-z]+)/g, (user, tag, target) => {
      if (['channel', 'group', 'everyone'].indexOf(target) !== -1 && tag === '@') {
        return `<!${target}>`;
      }
      return `<${tag}${target}>`;
    });
  }


}
