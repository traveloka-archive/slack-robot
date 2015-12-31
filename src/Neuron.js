/* @flow */
import Slack from 'slack-client';
import Robot from './Robot';
import Listener from './Listener';
import Request from './Request';
import Response from './Response';

class Neuron {
  _robot: Robot;

  listeners: Array<Listener>;

  constructor(robot: Robot) {
    this._robot = robot;
    this.listeners = [];
  }

  listen(messageFormat: string|RegExp) {
    const listener = new Listener(this._robot, messageFormat);
    this.listeners.push(listener);

    return listener;
  }

  handle(slackMessage: Slack.Message) {
    let req = new Request(this._robot._slack, this._robot.mention);
    let res = new Response(this._robot._slack);

    req = req.parse(slackMessage);
    res = res.parse(slackMessage);

    if (!req.user || !req.channel) {
      return;
    }

    if (req.user.id === this._robot.id) {
      return;
    }

    if (this._robot.options.ignoreMessageInGeneral && req.channel.name === 'general') {
      return;
    }

    if (!req.message.withMention) {
      // not mentioned
      if (req.message.isDirect) {
        // in direct message
        if (this._robot.options.skipDMMention) {
          // handle: do not return early
        } else if (this._robot.options.mentionToRespond) {
          // should mention even in DM, but didn't
          // do not handle, return early
          return;
        }
      } else if (this._robot.options.mentionToRespond) {
        // should be mentioned, but didn't
        // do not handle, return early
        return;
      }
    }

    this._dispatchHandler(req, res);
  }

  handleReaction(reactionMessage) {
    let req = new Request(this._robot._slack, this._robot.mention);
    let res = new Response(this._robot._slack);

    req = req.parseRawReaction(reactionMessage);
    res = res.parseRawReaction(reactionMessage);

    if (!req.user || !req.channel) {
      return;
    }

    if (req.user.id === this._robot.id) {
      return;
    }

    if (this._robot.options.ignoreMessageInGeneral && req.channel.name === 'general') {
      return;
    }

    this._dispatchHandler(req, res);
  }

  _dispatchHandler(req: Request, res: Response) {
    if (req.message.text.match(/(show )?help/)) {
      return this._showHelp(req, res);
    }

    let listener;
    let listenerResponse = { match: false, allowed: false };
    for (let i = 0; i < this.listeners.length; i++) {
      listener = this.listeners[i];
      listenerResponse = listener.respondTo(req, res);
      if (listenerResponse.match) {
        break;
      }
    }

    if (!listener || !listenerResponse.match) {
      return res.reply('sorry I didn\'t understand your command');
    } else if (listenerResponse.allowed) {
      return listener.handle(req, res).catch(err => {
        return res.send(this.getExecutionErrorResponse_(err.stack));
      });
    }
  }

  _showHelp(req: Request, res: Response): Promise {
    const helpText = this._convertHandlerAsHelp();

    if (req.message.isDirect) {
      return res.send(helpText);
    }

    // do not show help text directly in channel, use direct message instead
    res.reply('please check your direct message');
    return res.sendDM(helpText);
  }

  _convertHandlerAsHelp(): Object {
    let helpText = '';

    if (!this.listeners.length) {
      return { text: 'There is no command available yet' };
    }

    for (let i = 0; i < this.listeners.length; i++) {
      const listener = this.listeners[i];

      if (listener.description) {
        helpText += `${listener.description}\n`;
        helpText += `Command: *${listener.commandInfo}*\n`;
        helpText += '\n';
      }
    }

    if (!helpText) {
      return { text: 'Sorry, no description yet for any available commands' };
    }

    return {
      attachments: [
        {
          fallback: 'Available commands:',
          title: 'Available commands:',
          text: helpText.trim(),
          mrkdwn_in: ['text']
        }
      ]
    };
  }

  getExecutionErrorResponse_(errorMessage: string): Slack.Response {
    return {
      as_user: true,
      attachments: [
        {
          title: 'There\s an error when executing your command',
          text: `Error message: ${errorMessage}`,
          color: 'danger',
          mrkdwn_in: ['text']
        }
      ]
    };
  }
}

export default Neuron;
