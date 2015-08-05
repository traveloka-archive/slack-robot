import NeuronListener from './NeuronListener';

export default class Neuron {
  constructor(robot) {
    this.robot_ = robot;
    this.listeners = [];
  }

  listen(messageFormat) {
    var listener = new NeuronListener(this.robot_, messageFormat);
    this.listeners.push(listener);

    return listener;
  }

  handle(message, user, channel) {
    if (message.text.match(/(show )?help/)) {
      this.showHelp_(message, user, channel);
      return;
    }

    var listener;
    var listenerResponse = { match: false };
    for (var i = 0; i < this.listeners.length; i++) {
      listener = this.listeners[i];
      listenerResponse = listener.respondTo(message, user, channel);
      if (listenerResponse.match) break;
    }

    if (!listenerResponse.match) {
      channel.postMessage({ as_user: true, text: 'Sorry I didn\'t understand your command' });
    }
    else if (listenerResponse.allowed) {
      return listener.handle(message, user, channel).catch(err => {
        channel.postMessage(this.getExecutionErrorResponse_(err.message));
      });
    }
  }

  showHelp_(message, user, channel) {
    var helpText = this.convertHandlerAsHelp_();

    if (message.getChannelType() === 'DM') {
      channel.postMessage({ as_user: true, text: helpText });
      return;
    }

    // do not show help text directly in channel, use direct message instead
    channel.postMessage({ as_user: true, text: 'Please check your direct message' });
    this.robot_.slack_.openDM(user.id, () => {
      var dm = this.robot_.slack_.getDMById(user.id);
      dm.postMessage({ as_user: true, text: helpText });
    });
  }

  convertHandlerAsHelp_() {
    var helpText = '';

    if (!this.listeners.length) {
      return 'There is no command available yet';
    }

    for (var i = 0; i < this.listeners.length; i++) {
      let listener = this.listeners[i];
      if (!listener.description) continue;

      helpText += listener.description + '\n';
      helpText += `Command: *${listener.commandInfo}*\n`;
      helpText += '\n';
    }

    if (!helpText) {
      helpText = 'Sorry, no description yet for any available commands';
    }

    return helpText.trim();
  }

  getExecutionErrorResponse_(errorMessage) {
    return {
      as_user: true,
      attachments: [
        {
          title: 'There\s an error when executing your command',
          text: `Error message: ${errorMessage}`,
          color: 'danger'
        }
      ]
    }
  }
}
