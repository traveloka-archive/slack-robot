/* @flow */
import Log from 'log';
import Store from 'imstore';
import Slack from 'slack-client';
import Neuron from './Neuron';

type RobotOptions = {
  ignoreMessageInGeneral: boolean,
  mentionToRespond: boolean,
  skipDMMention: boolean
}

type SlackOptions = {
  token: string,
  autoReconnect: boolean,
  autoMark: boolean
}

export default class Robot {
  id: string;

  name: string;

  mention: RegExp;

  options: RobotOptions;

  logger: Log;

  brain: Store;

  _slack: Slack;

  _neuron: Neuron;

  constructor(slackOptions: string|SlackOptions, robotOptions: ?Object) {
    if (!slackOptions || (typeof slackOptions === 'object' && !slackOptions.token)) {
      throw new Error('Invalid slack access token');
    }

    if (typeof slackOptions === 'string') {
      slackOptions = this._mergeSlackOptions({token: slackOptions});
    } else {
      slackOptions = this._mergeSlackOptions(slackOptions);
    }

    if (!robotOptions || typeof robotOptions !== 'object') {
      robotOptions = this._mergeRobotOptions({});
    } else {
      robotOptions = this._mergeRobotOptions(robotOptions);
    }

    this.options = robotOptions;
    this.brain = new Store();
    this.logger = new Log(process.env.SLACK_ROBOT_LOG_LEVEL || 'info');

    this._slack = new Slack(slackOptions.token, slackOptions.autoReconnect, slackOptions.autoMark);
    this._neuron = new Neuron(this);
    this._init();
  }

  listen(messageFormat: string|RegExp) {
    return this._neuron.listen(messageFormat);
  }

  _mergeSlackOptions(options: Object) : SlackOptions {
    var DEFAULT_OPTS = {
      autoReconnect: true,
      autoMark: true
    };

    return Object.assign(DEFAULT_OPTS, options);
  }

  _mergeRobotOptions(options: Object) : RobotOptions {
    var DEFAULT_OPTS = {
      ignoreMessageInGeneral: true,
      mentionToRespond: true,
      skipDMMention: true
    };

    return Object.assign(DEFAULT_OPTS, options);
  }

  _init() {
    this._slack.on('loggedIn', bot => {
      this.id = bot.id;
      this.name = bot.name;
      this.mention = new RegExp(`.*@${bot.name}:?`);
      this.logger.info(`Logged in as ${bot.name}`);
    });

    this._slack.on('message', message => {
      this._neuron.handle(message);
    });

    this._slack.on('error', err => {
      this.logger.error(err);
    });

    this._slack.login();
  }
}
