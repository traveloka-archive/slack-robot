/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
/* eslint no-new:0 */
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import Log from 'log';
import Slack from 'slack-client';
import Robot from '../src/Robot';
import Neuron from '../src/Neuron';

chai.use(sinonChai);
chai.should();

describe('lib/Robot', () => {
  const SLACK_ACCESS_TOKEN = 'xqwd-0asdaus7dha3ejwdkajdnq3ui';
  const botInfo = { id: 'x', name: 'x-men', mention: new RegExp('.*@x-men:?') };
  let slackLoginStub, slackEventStub, slackGetTargetStub, slackGetChannelStub, slackGetUserStub;
  let neuronStub;

  before(() => {
    slackLoginStub = sinon.stub(Slack.prototype, 'login');
  });

  beforeEach(() => {
    slackGetTargetStub = sinon.stub(Slack.prototype, 'getChannelGroupOrDMByID');
    slackGetChannelStub = sinon.stub(Slack.prototype, 'getChannelByID');
    slackGetUserStub = sinon.stub(Slack.prototype, 'getUserByID');
    slackEventStub = sinon.stub(Slack.prototype, 'on');
    neuronStub = sinon.stub(Neuron.prototype, 'handle');
    slackLoginStub.reset();
  });

  afterEach(() => {
    slackEventStub.restore();
    slackGetTargetStub.restore();
    slackGetChannelStub.restore();
    slackGetUserStub.restore();
    neuronStub.restore();
  });

  after(() => {
    slackLoginStub.restore();
  });

  it('should accept token string in constructor', () => {
    (() => new Robot(SLACK_ACCESS_TOKEN))();
    slackLoginStub.should.be.calledOnce;
  });

  it('should accept slack option object in constructor', () => {
    new Robot({ token: SLACK_ACCESS_TOKEN });
    slackLoginStub.should.be.calledOnce;
  });

  it('should throw error if no token is defined', () => {
    const expectedError = 'Invalid slack access token';
    const undefinedToken = () => new Robot();
    const nullToken = () => new Robot(null);
    const noTokenProperty = () => new Robot({});

    undefinedToken.should.throw(expectedError);
    nullToken.should.throw(expectedError);
    noTokenProperty.should.throw(expectedError);
  });

  it('should get default robot options if not specified', () => {
    const botDefaultOptions = {
      ignoreMessageInGeneral: true,
      mentionToRespond: true,
      skipDMMention: true
    };

    const robot = new Robot(SLACK_ACCESS_TOKEN);
    robot.options.should.be.deep.equal(botDefaultOptions);
  });

  it('should replace default robot options if specified', () => {
    const customBotOption = {
      mentionToRespond: false,
      skipDMMention: false
    };
    const expectedBotOption = {
      ignoreMessageInGeneral: true,
      mentionToRespond: false,
      skipDMMention: false
    };

    const robot = new Robot(SLACK_ACCESS_TOKEN, customBotOption);
    robot.options.should.be.deep.equal(expectedBotOption);
  });

  it('should login to slack', () => {
    new Robot(SLACK_ACCESS_TOKEN);
    slackLoginStub.should.be.calledOnce;
  });

  it('should store bot information after login', () => {
    const loggerStub = sinon.stub(Log.prototype, 'info');
    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);

    const robot = new Robot(SLACK_ACCESS_TOKEN);

    robot.id.should.be.deep.equal(botInfo.id);
    robot.name.should.be.deep.equal(botInfo.name);
    robot.mention.should.be.deep.equal(botInfo.mention);
    loggerStub.should.be.calledWith('Logged in as x-men');

    loggerStub.restore();
  });

  it('should be able to add listener', () => {
    const listenStub = sinon.stub(Neuron.prototype, 'listen');

    const robot = new Robot(SLACK_ACCESS_TOKEN);
    robot.listen('x');

    listenStub.should.be.calledWith('x');
  });

  it('should be pass message to neuron', () => {
    const message = { text: 'test' };

    slackEventStub.withArgs('message').callsArgWith(1, message);

    const robot = new Robot(SLACK_ACCESS_TOKEN);
    robot.listen('x');

    neuronStub.should.be.calledWith(message);
  });

  it('should log error from slack', () => {
    const loggerStub = sinon.stub(Log.prototype, 'error');
    const error = 'Random slack error';

    slackEventStub.withArgs('error').callsArgWith(1, error);

    new Robot(SLACK_ACCESS_TOKEN);
    loggerStub.should.be.calledWith(error);
    loggerStub.restore();
  });
});
