/* @flow */
import Slack from 'slack-client';
import Promise from 'bluebird';

export default class Response {
  _slack: Slack;

  _user: Slack.User;

  _channel: Slack.Channel;

  constructor(slack: Slack) {
    this._slack = slack;
  }

  parse(slackMessage: Slack.Message): Response {
    this._user = this._slack.getUserByID(slackMessage.user);
    this._channel = this._slack.getChannelGroupOrDMByID(slackMessage.channel);
    return this;
  }

  send(response : Slack.Response) {
    /* eslint-disable */
    response.as_user = true;
    /* eslint-enable */
    if (response.text) {
      response.text = this._autoMention(response.text);
    }

    return new Promise(resolve => {
      this._channel.postMessage(response);
      resolve();
    });
  }

  sendText(text: string): Promise {
    return this.send({ text });
  }

  sendDM(response: Slack.Response): Promise {
    /* eslint-disable */
    response.as_user = true;
    /* eslint-enable */
    if (response.text) {
      response.text = this._autoMention(response.text);
    }

    return new Promise((resolve, reject) => {
      this._slack.openDM(this._user.id, () => {
        try {
          var dm = this._slack.getDMByName(this._user.name);
          dm.postMessage(response);
          resolve();
        } catch (ex) {
          reject(ex);
        }
      });
    });
  }

  sendTextDM(text: string): Promise {
    return this.sendDM({ text });
  }

  sendTo(name: string, response: Slack.Response): Promise {
    /* eslint-disable */
    response.as_user = true;
    /* eslint-enable */
    if (response.text) {
      response.text = this._autoMention(response.text);
    }

    return new Promise(resolve => {
      var target = this._slack.getChannelGroupOrDMByName(name);
      target.postMessage(response);
      return resolve();
    });
  }

  sendTextTo(name: string, text: string): Promise {
    return this.sendTo(name, { text });
  }

  reply(text: string): Promise {
    if (typeof text !== 'string') {
      return Promise.reject(new TypeError('You can only reply using simple string'));
    }

    text = `@${this._user.name}: ${text}`;
    return this.sendText(text);
  }

  _autoMention(text: string): Promise {
    return text.replace(/([\@\#])([a-z\.]+)/g, (user, tag, target) => {
      if (['channel', 'group', 'everyone'].indexOf(target) !== -1 && tag === '@') {
        return `<!${target}>`;
      }
      return `<${tag}${target}>`;
    });
  }

}
