import chai from 'chai';
import sinon from 'sinon';
import sinon_chai from 'sinon-chai';
import Slack from 'slack-client';
import Log from 'log';
import Robot from '../lib/Robot';
import Neuron from '../lib/Neuron';

chai.use(sinon_chai);
chai.should();

describe('lib/robot', function() {
  var botInfo = {id: 'x', name: 'x-men'};
  var slackLoginStub, slackEventStub, slackGetTargetStub, slackGetChannelStub, slackGetUserStub;
  var neuronStub;

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
  })

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

  it('should login to slack', () => {
    var robot = new Robot({}, {});
    slackLoginStub.should.be.calledOnce;
  });

  it('should store bot information after login', () => {
    var loggerStub = sinon.stub(Log.prototype, 'info');
    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);

    var robot = new Robot({}, {});
    robot.bot_.should.be.deep.equal(botInfo);
    loggerStub.should.be.calledWith('Logged in as x-men');
    loggerStub.restore();
  });

  it('should be able to add listener', () => {
    var robot = new Robot({}, {});
    var listenStub = sinon.stub(Neuron.prototype, 'listen');
    robot.listen('x');
    listenStub.should.be.calledWith('x');
  });

  it('should ignore message with unknown channel / user', () => {
    var message = {text: 'hack'};

    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);
    slackEventStub.withArgs('message').callsArgWith(1, message);
    slackGetUserStub.withArgs('U123').returns(null);
    slackGetChannelStub.withArgs('C122').returns(null);

    var handleSpy = sinon.spy(Robot.prototype, 'handle_');
    var robot = new Robot({}, {});

    handleSpy.callCount.should.be.equal(0);
    handleSpy.restore();
  })

  it('should parse message correctly', () => {
    var message = {text: '<!channel> call <@U123> and <@U124|@weirduser> from <#C122> or <#C121|#frontend> <google|google.com> <twitter.com>', user: 'x', channel: 'y'};
    var userMock = {id: 'x', name: 'x-men'};
    var channelMock = {id: 'y', name: 'Y combinator'};
    var expectedMessage = {text: '@channel call @randomuser and @weirduser from #release-hotfix or #frontend google.com(google) twitter.com', user: 'x', channel: 'y'};

    var handleSpy = sinon.spy(Robot.prototype, 'handle_');
    var loggerStub = sinon.stub(Log.prototype, 'info');

    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);
    slackEventStub.withArgs('message').callsArgWith(1, message);
    slackGetUserStub.withArgs('U123').returns({id: 'U123', name: 'randomuser'});
    slackGetChannelStub.withArgs('C122').returns({id: 'C122', name: 'release-hotfix'});
    slackGetUserStub.withArgs(userMock.id).returns(userMock);
    slackGetTargetStub.withArgs(channelMock.id).returns(channelMock);

    var robot = new Robot({}, {});
    handleSpy.should.be.calledWith(expectedMessage, userMock, channelMock);

    loggerStub.restore();
    handleSpy.restore();
  });

  it('should ignore message from self', () => {
    var message = {text: 'test message', user: 'x', channel: 'y'};
    var userMock = {id: 'x', name: 'x-men'};
    var channelMock = {id: 'y', name: 'Y combinator'};

    var handleSpy = sinon.spy(Robot.prototype, 'handle_');
    var loggerStub = sinon.stub(Log.prototype, 'info');

    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);
    slackEventStub.withArgs('message').callsArgWith(1, message);
    slackGetUserStub.withArgs(userMock.id).returns(userMock);
    slackGetTargetStub.withArgs(channelMock.id).returns(channelMock);

    var robot = new Robot({}, {});
    neuronStub.callCount.should.be.equal(0);
    handleSpy.should.be.calledWith(message, userMock, channelMock);

    loggerStub.restore();
    handleSpy.restore();
  });

  it('should ignore message in general by default', () => {
    var message = {text: '', user: 'y', channel: 'g'};
    var userMock = {id: 'y', name: 'y-men'};
    var channelMock = {id: 'g', name: 'general'};

    var handleSpy = sinon.spy(Robot.prototype, 'handle_');
    var loggerStub = sinon.stub(Log.prototype, 'info');

    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);
    slackEventStub.withArgs('message').callsArgWith(1, message);
    slackGetUserStub.withArgs(userMock.id).returns(userMock);
    slackGetTargetStub.withArgs(channelMock.id).returns(channelMock);

    var robot = new Robot({}, {});
    neuronStub.callCount.should.be.equal(0);
    handleSpy.should.be.calledWith(message, userMock, channelMock);

    loggerStub.restore();
    handleSpy.restore();
  });

  it('should not ignore message in general if such option is specified', () => {
    var message = {text: '@x-men: test message', user: 'y', channel: 'g'};
    var userMock = {id: 'y', name: 'y-men'};
    var channelMock = {id: 'g', name: 'general'};

    var handleSpy = sinon.spy(Robot.prototype, 'handle_');
    var loggerStub = sinon.stub(Log.prototype, 'info');

    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);
    slackEventStub.withArgs('message').callsArgWith(1, message);
    slackGetUserStub.withArgs(userMock.id).returns(userMock);
    slackGetTargetStub.withArgs(channelMock.id).returns(channelMock);

    var robot = new Robot({ignoreMessageInGeneral: false}, {});
    neuronStub.callCount.should.be.equal(1);
    handleSpy.should.be.calledWith(message, userMock, channelMock);

    loggerStub.restore();
    handleSpy.restore();
  });

  it('should ignore message without mention by default', () => {
    var message = {text: 'test message', user: 'y', channel: 'r', getChannelType: sinon.stub() };
    var userMock = {id: 'y', name: 'y-men'};
    var channelMock = {id: 'r', name: 'release'};

    var handleSpy = sinon.spy(Robot.prototype, 'handle_');
    var loggerStub = sinon.stub(Log.prototype, 'info');

    message.getChannelType.returns('channel');
    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);
    slackEventStub.withArgs('message').callsArgWith(1, message);
    slackGetUserStub.withArgs(userMock.id).returns(userMock);
    slackGetTargetStub.withArgs(channelMock.id).returns(channelMock);

    var robot = new Robot({}, {});
    neuronStub.callCount.should.be.equal(0);
    handleSpy.should.be.calledWith(message, userMock, channelMock);

    loggerStub.restore();
    handleSpy.restore();
  });

  it('should not ignore message without mention if such option is specified', () => {
    var message = {text: 'send link', user: 'y', channel: 'r', getChannelType: sinon.stub() };
    var userMock = {id: 'y', name: 'y-men'};
    var channelMock = {id: 'r', name: 'release'};

    var handleSpy = sinon.spy(Robot.prototype, 'handle_');
    var loggerStub = sinon.stub(Log.prototype, 'info');

    message.getChannelType.returns('channel');
    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);
    slackEventStub.withArgs('message').callsArgWith(1, message);
    slackGetUserStub.withArgs(userMock.id).returns(userMock);
    slackGetTargetStub.withArgs(channelMock.id).returns(channelMock);

    var robot = new Robot({mentionToRespond: false}, {});
    neuronStub.callCount.should.be.equal(1);
    handleSpy.should.be.calledWith(message, userMock, channelMock);

    loggerStub.restore();
    handleSpy.restore();
  });

  it('should skip checking mention in DM by default', () => {
    var message = {text: 'send link', user: 'y', channel: 'r', getChannelType: sinon.stub() };
    var userMock = {id: 'y', name: 'y-men'};
    var channelMock = {id: 'r', name: 'release'};

    var handleSpy = sinon.spy(Robot.prototype, 'handle_');
    var loggerStub = sinon.stub(Log.prototype, 'info');

    message.getChannelType.returns('DM');
    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);
    slackEventStub.withArgs('message').callsArgWith(1, message);
    slackGetUserStub.withArgs(userMock.id).returns(userMock);
    slackGetTargetStub.withArgs(channelMock.id).returns(channelMock);

    var robot = new Robot({}, {});
    neuronStub.callCount.should.be.equal(1);
    handleSpy.should.be.calledWith(message, userMock, channelMock);

    loggerStub.restore();
    handleSpy.restore();
  });

  it('should skip checking mention in DM by default', () => {
    var message = {text: 'send link', user: 'y', channel: 'r', getChannelType: sinon.stub() };
    var userMock = {id: 'y', name: 'y-men'};
    var channelMock = {id: 'r', name: 'release'};

    var handleSpy = sinon.spy(Robot.prototype, 'handle_');
    var loggerStub = sinon.stub(Log.prototype, 'info');

    message.getChannelType.returns('DM');
    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);
    slackEventStub.withArgs('message').callsArgWith(1, message);
    slackGetUserStub.withArgs(userMock.id).returns(userMock);
    slackGetTargetStub.withArgs(channelMock.id).returns(channelMock);

    var robot = new Robot({skipDMMention: false}, {});
    neuronStub.callCount.should.be.equal(0);
    handleSpy.should.be.calledWith(message, userMock, channelMock);

    loggerStub.restore();
    handleSpy.restore();
  });

  it('should remove bot mention by default', () => {
    var message = {text: '@x-men: test message', user: 'y', channel: 'r'};
    var cleanMessage = {text: 'test message', user: 'y', channel: 'r'};
    var userMock = {id: 'y', name: 'y-men'};
    var channelMock = {id: 'r', name: 'release'};

    var loggerStub = sinon.stub(Log.prototype, 'info');

    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);
    slackEventStub.withArgs('message').callsArgWith(1, message);
    slackGetUserStub.withArgs(userMock.id).returns(userMock);
    slackGetTargetStub.withArgs(channelMock.id).returns(channelMock);

    var robot = new Robot({mentionToRespond: false}, {});
    neuronStub.getCall(0).args[0].should.be.deep.equal(cleanMessage);

    loggerStub.restore();
  });

  it('should not remove bot mention if such option is specified', () => {
    var message = {text: '@x-men: test message', user: 'y', channel: 'r'};
    var expectedMessage = {text: '@x-men: test message', user: 'y', channel: 'r'};
    var userMock = {id: 'y', name: 'y-men'};
    var channelMock = {id: 'r', name: 'release'};

    var loggerStub = sinon.stub(Log.prototype, 'info');

    slackEventStub.withArgs('loggedIn').callsArgWith(1, botInfo);
    slackEventStub.withArgs('message').callsArgWith(1, message);
    slackGetUserStub.withArgs(userMock.id).returns(userMock);
    slackGetTargetStub.withArgs(channelMock.id).returns(channelMock);

    var robot = new Robot({removeBotMention: false}, {});
    neuronStub.getCall(0).args[0].should.be.deep.equal(expectedMessage);

    loggerStub.restore();
  });

  it('should log error from slack', () => {
    var loggerStub = sinon.stub(Log.prototype, 'error');
    var error = 'Random slack error';

    slackEventStub.withArgs('error').callsArgWith(1, error);

    var robot = new Robot({}, {});
    loggerStub.should.be.calledWith(error);
    loggerStub.restore();

  });
});
