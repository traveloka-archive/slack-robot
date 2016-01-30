/* eslint no-unused-expressions: 0 */
import chai from 'chai';
import { describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import Robot from '../src/Robot';
import Listeners from '../src/Listeners';
import Response from '../src/Response';
import Log from 'log';
import { RtmClient, WebClient } from 'slack-client';
import plugins from '../src/plugins';

chai.use(sinonChai);
const should = chai.should();

describe('Robot', () => {
  it('should set some sensible defaults', () => {
    const robot = new Robot('token');
    should.not.exist(robot.bot);
    robot._vars.concurrency.should.be.equal(1);
    robot._ignoredChannels.should.be.deep.equal([]);
    robot._rtm.should.be.instanceof(RtmClient);
    robot._api.should.be.instanceof(WebClient);
    robot._listeners.should.be.instanceof(Listeners);

    // check event emitter
    robot.on.should.be.instanceof(Function);
    robot.emit.should.be.instanceof(Function);
  });

  it('should throw on missing token', () => {
    const fakeRobot = function () {
      return new Robot();
    };

    fakeRobot.should.throw('Invalid slack access token');
  });

  it('should be able to listen to text message', () => {
    const robot = new Robot('token');
    const addListenerStub = sinon.stub(Listeners.prototype, 'add');
    const callback = function () {};

    robot.listen('hello adele', callback);
    addListenerStub.calledWithExactly('message', 'hello adele', callback).should.be.equal(true);
    addListenerStub.restore();
  });

  it('should be able to listen to any message type', () => {
    const robot = new Robot('token');
    const addListenerStub = sinon.stub(Listeners.prototype, 'add');
    const callback = function () {};

    robot.when('reaction_type', '+1', callback);
    addListenerStub.calledWithExactly('reaction_type', '+1', callback).should.be.equal(true);
    addListenerStub.restore();
  });

  it('should throw on invalid listener', () => {
    const robot = new Robot('token');
    const callback = function () {};
    const wrongType = function () {
      robot.when(null, 'value', callback);
    };
    const wrongValue = function () {
      robot.when('message', null, callback);
    };
    const wrongCallback = function () {
      robot.when('message', /yolo/);
    };

    wrongType.should.throw('Invalid listener type');
    wrongValue.should.throw('Invalid message to listen');
    wrongCallback.should.throw('Callback must be a function');
  });

  it('should be able to add ignored channels', () => {
    const robot = new Robot('token');
    robot.ignore('#general');
    robot._ignoredChannels.should.be.deep.equal(['#general']);
  });

  it('should be able to add ignored channels multiple times', () => {
    const robot = new Robot('token');
    robot.ignore('#random');
    robot.ignore('#general');
    robot._ignoredChannels.should.be.deep.equal(['#random', '#general']);
  });

  it('should ignore adding same ignored channels multiple times', () => {
    const robot = new Robot('token');
    robot.ignore('#random');
    robot.ignore('#random');
    robot.ignore('#general');
    robot.ignore('#random');
    robot.ignore('#random');
    robot._ignoredChannels.should.be.deep.equal(['#random', '#general']);
  });

  it('should be able to add ignored channels using var args', () => {
    const robot = new Robot('token');
    robot.ignore('#general', '#random');
    robot._ignoredChannels.should.be.deep.equal(['#general', '#random']);
  });

  it('should provide plugin API', () => {
    const robot = new Robot('token');
    const defaultState = { a: 3 };
    const plugin = robot => {
      robot.state = defaultState;
    };

    robot.use(plugin);
    robot.state.should.be.equal(defaultState);
  });

  it('should only initialized plugin once', () => {
    const robot = new Robot('token');
    const plugin = sinon.spy();

    robot.use(plugin);
    robot.use(plugin);
    robot.use(plugin);
    robot.use(plugin);
    plugin.should.be.calledOne;
  });

  it('should throw on invalid plugin', () => {
    const robot = new Robot('token');
    const invalidPlugin = function () {
      robot.use(2);
    };
    invalidPlugin.should.throw('Invalid plugin type');
  });

  it('should be able to set internal variables', () => {
    const robot = new Robot('token');
    robot.set('concurrency', 5);
    robot._vars.concurrency.should.be.equal(5);
  });

  it('should ignore setting invalid internal variables', () => {
    const robot = new Robot('token');
    robot.set('concurrency', null);
    robot._vars.concurrency.should.be.equal(1);

    robot.set('concurrency', undefined);
    robot._vars.concurrency.should.be.equal(1);
  });

  it('should be able to get internal variables', () => {
    const robot = new Robot('token');
    const something = { a: { b: { c: { d: 'e' } } } };
    robot.set('something', something);

    robot.get('concurrency').should.be.equal(1);
    robot.get('something').should.be.deep.equal(something);
  });

  it('should be able to send without listening', () => {
    const robot = new Robot('token');
    const callback = sinon.spy();

    // fake logged in
    robot.bot = { id: 'U123123' };
    robot.to('@user', callback);

    callback.should.be.calledOnce;
  });

  it('should be able wait sending via .to until logged in', () => {
    const robot = new Robot('token');
    const callback = sinon.spy();
    const clock = sinon.useFakeTimers();

    // fake async login
    setTimeout(() => {
      robot.bot = { id: 'U123123' };
    }, 500);

    robot.to('@user', callback);
    callback.callCount.should.be.equal(0);

    clock.tick(100);
    callback.callCount.should.be.equal(0);

    clock.tick(200);
    callback.callCount.should.be.equal(0);

    // finally loggedin
    clock.tick(200);
    callback.should.be.calledOnce;

    clock.restore();
  });

  it('should provide similar API with Response in .to', done => {
    const robot = new Robot('token');

    // fake login
    robot.bot = { id: 'U123123' };

    robot.to('@user', res => {
      res.should.be.instanceof(Response);
      done();
    });
  });

  it('should throw when using .reaction or .async in .to', done => {
    const robot = new Robot('token');

    // fake login
    robot.bot = { id: 'U123123' };

    robot.to('@user', res => {
      const invalidReaction = function () {
        return res.reaction('+1');
      };
      const invalidAsync = function () {
        return res.async(() => {});
      };

      invalidReaction.should.throw('Cannot use method .reaction() in robot.to()');
      invalidAsync.should.throw('Cannot use method .async() in robot.to()');
      done();
    });
  });

  it('should call listeners.get when getAllListeners called', () => {
    const robot = new Robot('token');
    const getSpy = sinon.spy(Listeners.prototype, 'get');

    robot.getAllListeners();
    getSpy.should.be.calledOnce;
    getSpy.restore();
  });

  it('should call listeners.get when getListener called', () => {
    const robot = new Robot('token');
    const getSpy = sinon.spy(Listeners.prototype, 'get');

    robot.getListener('wewe');
    getSpy.should.be.calledWithExactly('wewe');
    getSpy.restore();
  });

  it('should call listeners.remove when removeListener called', () => {
    const robot = new Robot('token');
    const removeSpy = sinon.spy(Listeners.prototype, 'remove');

    robot.removeListener('wewe');
    removeSpy.should.be.calledWithExactly('wewe');
    removeSpy.restore();
  });

  it('should use help-generator-plugin when enabled', () => {
    const robot = new Robot('token');
    const robotPluginSpy = sinon.spy(Robot.prototype, 'use');
    const generatorSpy = sinon.stub(plugins, 'helpGenerator');
    const pluginSpy = sinon.spy();

    generatorSpy.withArgs({ enable: true }).returns(pluginSpy);

    robot.set('help_generator', true);
    generatorSpy.should.be.calledWithExactly({ enable: true });
    robotPluginSpy.should.be.calledWith(pluginSpy);
    robotPluginSpy.restore();
    generatorSpy.restore();
  });

  it('should only connect to websocket when started', () => {
    // use stub to prevent actual call to websocket
    const robot = new Robot('token');
    const wsStartStub = sinon.stub(RtmClient.prototype, 'start');

    robot.start();
    wsStartStub.should.be.calledOnce;
    wsStartStub.restore();
  });

  it('should listen to authenticated event from websocket', () => {
    // use stub to prevent actual call to websocket
    const robot = new Robot('token');
    const wsStartStub = sinon.stub(RtmClient.prototype, 'start');
    const wsMessageStub = sinon.stub(RtmClient.prototype, 'on');
    const loggerStub = sinon.stub(Log.prototype, 'info');

    // mock dataStore
    const botUserMock = {
      id: 5,
      name: 'slackbot'
    };
    robot._rtm.activeUserId = 5;
    robot._rtm.dataStore = {
      getUserById: sinon.stub().withArgs(robot._rtm.activeUserId).returns(botUserMock)
    };

    wsMessageStub.withArgs('authenticated').callsArg(1);

    // start to listen
    robot.start();

    robot.bot.should.be.deep.equal(botUserMock);
    loggerStub.should.be.calledWithExactly('Logged in as slackbot');

    // cleanup
    wsStartStub.restore();
    wsMessageStub.restore();
    loggerStub.restore();
  });

  it('should listen to message event from websocket', () => {
    // use stub to prevent actual call to websocket
    const robot = new Robot('token');
    const wsStartStub = sinon.stub(RtmClient.prototype, 'start');
    const wsMessageStub = sinon.stub(RtmClient.prototype, 'on');
    const messageHandlerStub = sinon.stub(Robot.prototype, '_onMessage');
    const messageDataMock = {
      type: 'message',
      user: 'U1234',
      channel: 'C254123',
      text: 'hello'
    };

    wsMessageStub.withArgs('message').callsArgWith(1, messageDataMock);

    // start to listen
    robot.start();
    messageHandlerStub.should.be.calledWithExactly(messageDataMock);

    // cleanup
    wsStartStub.restore();
    wsMessageStub.restore();
    messageHandlerStub.restore();
  });

  it('should listen to reaction_added event from websocket', () => {
    // use stub to prevent actual call to websocket
    const robot = new Robot('token');
    const wsStartStub = sinon.stub(RtmClient.prototype, 'start');
    const wsMessageStub = sinon.stub(RtmClient.prototype, 'on');
    const messageHandlerStub = sinon.stub(Robot.prototype, '_onMessage');
    const reactionDataMock = {
      type: 'reaction_added',
      reaction: 'grinning',
      item: {
        type: 'message',
        channel: 'C341912',
        ts: '12524123.000234'
      }
    };

    robot.bot = { id: 'bot-id' };
    robot._api.reactions.get = sinon.stub().withArgs({
      channel: 'C341912',
      timestamp: '12524123.000234'
    }).callsArgWith(1, null, {
      ok: true,
      message: {
        user: 'bot-id'
      }
    });
    wsMessageStub.withArgs('reaction_added').callsArgWith(1, reactionDataMock);

    // start to listen
    robot.start();
    messageHandlerStub.should.be.calledWithExactly(reactionDataMock);

    // cleanup
    wsStartStub.restore();
    wsMessageStub.restore();
    messageHandlerStub.restore();
  });

  it('should only listen reaction_added event in bot own message', () => {
    // use stub to prevent actual call to websocket
    const robot = new Robot('token');
    const wsStartStub = sinon.stub(RtmClient.prototype, 'start');
    const wsMessageStub = sinon.stub(RtmClient.prototype, 'on');
    const messageHandlerStub = sinon.stub(Robot.prototype, '_onMessage');
    const reactionDataMock = {
      type: 'reaction_added',
      reaction: 'grinning',
      item: {
        type: 'message',
        channel: 'C341912',
        ts: '12524123.000234'
      }
    };

    robot.bot = { id: 'bot-id' };
    robot._api.reactions.get = sinon.stub().withArgs({
      channel: 'C341912',
      timestamp: '12524123.000234'
    }).callsArgWith(1, null, {
      ok: true,
      message: {
        user: 'not-from-bot'
      }
    });
    wsMessageStub.withArgs('reaction_added').callsArgWith(1, reactionDataMock);

    // start to listen
    robot.start();
    messageHandlerStub.should.notCalled;

    // cleanup
    wsStartStub.restore();
    wsMessageStub.restore();
    messageHandlerStub.restore();
  });

  it('should queue reaction_added event in file', () => {
    // use stub to prevent actual call to websocket
    const robot = new Robot('token');
    const wsStartStub = sinon.stub(RtmClient.prototype, 'start');
    const wsMessageStub = sinon.stub(RtmClient.prototype, 'on');
    const messageHandlerStub = sinon.stub(Robot.prototype, '_onMessage');
    const reactionDataMock = {
      type: 'reaction_added',
      reaction: ':joy:',
      user: 'D12523',
      item: {
        type: 'file',
        file: 'F341912'
      }
    };

    const msgQueueMock = {
      id: 'F341912',
      user: 'D12523',
      type: 'file',
      reaction: ':joy:',
      originalType: 'reaction_added'
    };

    wsMessageStub.withArgs('reaction_added').callsArgWith(1, reactionDataMock);

    // start to listen
    robot.start();
    robot._messageQueue[0].should.be.deep.equal(msgQueueMock);

    // cleanup
    wsStartStub.restore();
    wsMessageStub.restore();
    messageHandlerStub.restore();
  });

  it('should queue reaction_added event in file comment', () => {
    // use stub to prevent actual call to websocket
    const robot = new Robot('token');
    const wsStartStub = sinon.stub(RtmClient.prototype, 'start');
    const wsMessageStub = sinon.stub(RtmClient.prototype, 'on');
    const messageHandlerStub = sinon.stub(Robot.prototype, '_onMessage');
    const reactionDataMock = {
      type: 'reaction_added',
      reaction: ':joy:',
      user: 'C0G9QF9GZ',
      item: {
        type: 'file_comment',
        file_comment: 'Fc0HS2KBEZ',
        file: 'F0HS27V1Z'
      }
    };

    const msgQueueMock = {
      id: 'F0HS27V1Z',
      user: 'C0G9QF9GZ',
      type: 'file_comment',
      reaction: ':joy:',
      originalType: 'reaction_added'
    };

    wsMessageStub.withArgs('reaction_added').callsArgWith(1, reactionDataMock);

    // start to listen
    robot.start();
    robot._messageQueue[0].should.be.deep.equal(msgQueueMock);

    // cleanup
    wsStartStub.restore();
    wsMessageStub.restore();
    messageHandlerStub.restore();
  });

  it('should flush message queue if found matching message_changed event', () => {
    // use stub to prevent actual call to websocket
    const robot = new Robot('token');
    const wsStartStub = sinon.stub(RtmClient.prototype, 'start');
    const wsMessageStub = sinon.stub(RtmClient.prototype, 'on');
    const messageHandlerStub = sinon.stub(Robot.prototype, '_onMessage');
    const reactionDataMock = {
      type: 'reaction_added',
      reaction: ':joy:',
      user: 'U12523',
      item: {
        type: 'file',
        file: 'F341912'
      }
    };
    const messageChangedMock = {
      type: 'message',
      subtype: 'message_changed',
      channel: 'C247221',
      message: {
        user: 'bot-id',
        ts: '123908013.00390',
        file: {
          id: 'F341912'
        }
      },
      eventTs: '123908013.00392',
      ts: '123908013.00412'
    };
    const reactionParsedMessageMock = {
      type: 'reaction_added',
      reaction: ':joy:',
      user: 'U12523',
      item: {
        type: 'message',
        channel: 'C247221',
        ts: '123908013.00390'
      },
      eventTs: '123908013.00392',
      ts: '123908013.00412'
    };

    robot.bot = { id: 'bot-id' };
    wsMessageStub.withArgs('reaction_added').onFirstCall().callsArgWith(1, reactionDataMock);
    robot.start();

    // Because the event listener is stubbed, callsArgWith will only be called
    // after the stub is executed (.on is called via robot.start).
    // By running robot.start() after reaction_added event, we're sure that
    // no more callback stub are stored, so we can add another callback stub
    // and run robot.start() again to process this new callback
    // This is done to make sure message event is received after reaction_added
    wsMessageStub.withArgs('message').callsArgWith(1, messageChangedMock);
    robot.start();

    messageHandlerStub.should.be.calledWithExactly(reactionParsedMessageMock);

    // cleanup
    wsStartStub.restore();
    wsMessageStub.restore();
    messageHandlerStub.restore();
  });

  it('should emit message_no_sender, if no user specified in message payload', done => {
    const robot = new Robot('token');
    robot.bot = { id: 'U834975', name: 'mockbot' };
    const messagePayload = {
      type: 'message'
    };

    robot.on('message_no_sender', () => {
      done();
    });

    robot._onMessage(messagePayload);
  });

  it('should emit message_no_channel, if no user specified in message payload', done => {
    const robot = new Robot('token');
    robot.bot = { id: 'U834975', name: 'mockbot' };
    robot._rtm.dataStore = {
      getUserById: sinon.stub()
    };
    const messagePayload = {
      type: 'message',
      user: 'U123213'
    };

    const userMock = {
      id: 'U123213',
      name: 'hacker'
    };

    robot.on('message_no_channel', () => {
      done();
    });

    robot._rtm.dataStore.getUserById.withArgs(messagePayload.user).returns(userMock);

    robot._onMessage(messagePayload);
  });

  it('should emit own_message, if message comes from itself', done => {
    const robot = new Robot('token');
    robot.bot = { id: 'U834975', name: 'mockbot' };
    robot._rtm.dataStore = {
      getUserById: sinon.stub(),
      getChannelGroupOrDMById: sinon.stub()
    };
    const messagePayload = {
      type: 'message',
      user: robot.bot.id,
      channel: 'C341912'
    };
    const channelMock = {
      id: 'C341912',
      name: 'general'
    };

    robot._rtm.dataStore.getUserById.withArgs(messagePayload.user).returns(robot.bot);
    robot._rtm.dataStore.getChannelGroupOrDMById.withArgs(messagePayload.channel).returns(channelMock);

    robot.on('own_message', () => {
      done();
    });

    robot._onMessage(messagePayload);
  });

  it('should emit ignored_channel, if message comes from ignored channel', done => {
    const robot = new Robot('token');
    robot.bot = { id: 'U834975', name: 'mockbot' };
    robot._ignoredChannels = ['#ignore-this-channel'];
    robot._rtm.dataStore = {
      getUserById: sinon.stub(),
      getChannelGroupOrDMById: sinon.stub()
    };
    const messagePayload = {
      type: 'message',
      user: 'U123213',
      channel: 'C341912'
    };
    const userMock = {
      id: messagePayload.user,
      name: 'not.a.bot'
    };
    const channelMock = {
      id: messagePayload.channel,
      name: 'ignore-this-channel'
    };

    robot._rtm.dataStore.getUserById.withArgs(messagePayload.user).returns(userMock);
    robot._rtm.dataStore.getChannelGroupOrDMById.withArgs(messagePayload.channel).returns(channelMock);

    robot.on('ignored_channel', () => {
      done();
    });

    robot._onMessage(messagePayload);
  });

  it('should emit no_listener_match, if no listener matches', done => {
    const robot = new Robot('token');
    // add ignored_channel to make sure this message is not ignored
    robot._ignoredChannels = ['#ignore-this-channel'];
    robot.bot = { id: 'U834975', name: 'mockbot' };
    robot._rtm.dataStore = {
      getUserById: sinon.stub(),
      getChannelGroupOrDMById: sinon.stub()
    };
    const messagePayload = {
      type: 'message',
      user: 'U413552',
      channel: 'C724030'
    };
    const userMock = {
      id: messagePayload.user,
      name: 'anonymouse'
    };
    const channelMock = {
      id: messagePayload.channel,
      name: 'general'
    };
    const listenerStub = sinon.stub(Listeners.prototype, 'find').returns(null);

    robot._rtm.dataStore.getUserById.withArgs(messagePayload.user).returns(userMock);
    robot._rtm.dataStore.getChannelGroupOrDMById.withArgs(messagePayload.channel).returns(channelMock);

    robot.on('no_listener_match', () => {
      listenerStub.restore();
      done();
    });

    robot._onMessage(messagePayload);
  });

  it('should run all acls', done => {
    const robot = new Robot('token');
    robot.bot = { id: 'U834975', name: 'mockbot' };
    robot._rtm.dataStore = {
      getUserById: sinon.stub(),
      getChannelGroupOrDMById: sinon.stub()
    };
    const messagePayload = {
      type: 'message',
      text: 'hello dear',
      user: 'U413552',
      channel: 'C724030'
    };
    const userMock = {
      id: messagePayload.user,
      name: 'anonymouse'
    };
    const channelMock = {
      id: messagePayload.channel,
      name: 'general'
    };
    const aclStub1 = sinon.stub();
    const aclStub2 = sinon.stub();
    const listenerMock = {
      type: 'message',
      value: 'hello ([a-z]+)',
      matcher: /^hello ([a-z]+)$/,
      acls: [aclStub1, aclStub2],
      callback: sinon.spy()
    };

    const listenerStub = sinon.stub(Listeners.prototype, 'find').returns(listenerMock);

    robot._rtm.dataStore.getUserById.withArgs(messagePayload.user).returns(userMock);
    robot._rtm.dataStore.getChannelGroupOrDMById.withArgs(messagePayload.channel).returns(channelMock);
    aclStub1.callsArg(2);
    aclStub2.callsArg(2);

    robot.on('request_handled', () => {
      aclStub1.should.be.calledOnce;
      aclStub2.should.be.calledOnce;
      listenerMock.callback.should.be.calledOnce;
      listenerStub.restore();
      done();
    });

    robot._onMessage(messagePayload);
  });

  it('should emit request_handled if done successfully', done => {
    const robot = new Robot('token');
    robot.bot = { id: 'U834975', name: 'mockbot' };
    robot._rtm.dataStore = {
      getUserById: sinon.stub(),
      getChannelGroupOrDMById: sinon.stub()
    };
    const messagePayload = {
      type: 'message',
      text: 'hello dear',
      user: 'U413552',
      channel: 'C724030'
    };
    const userMock = {
      id: messagePayload.user,
      name: 'anonymouse'
    };
    const channelMock = {
      id: messagePayload.channel,
      name: 'general'
    };
    const listenerMock = {
      type: 'message',
      value: 'hello ([a-z]+)',
      matcher: /^hello ([a-z]+)$/,
      acls: [],
      callback: sinon.spy()
    };

    const listenerStub = sinon.stub(Listeners.prototype, 'find').returns(listenerMock);

    robot._rtm.dataStore.getUserById.withArgs(messagePayload.user).returns(userMock);
    robot._rtm.dataStore.getChannelGroupOrDMById.withArgs(messagePayload.channel).returns(channelMock);

    robot.on('request_handled', () => {
      listenerMock.callback.should.be.calledOnce;
      listenerStub.restore();
      done();
    });

    robot._onMessage(messagePayload);
  });

  it('should emit task_error, if response failed to send', done => {
    const robot = new Robot('token');
    robot.bot = { id: 'U834975', name: 'mockbot' };
    robot._rtm.dataStore = {
      getUserById: sinon.stub(),
      getChannelGroupOrDMById: sinon.stub()
    };
    const messagePayload = {
      type: 'message',
      text: 'hello dear',
      user: 'U413552',
      channel: 'C724030'
    };
    const userMock = {
      id: messagePayload.user,
      name: 'anonymouse'
    };
    const channelMock = {
      id: messagePayload.channel,
      name: 'general'
    };
    const listenerMock = {
      type: 'message',
      value: 'hello ([a-z]+)',
      matcher: /^hello ([a-z]+)$/,
      acls: [],
      callback: (req, res) => {
        return res.text('failed').send();
      }
    };
    const errorMock = new Error('something happened');

    const listenerStub = sinon.stub(Listeners.prototype, 'find').returns(listenerMock);

    robot._rtm.dataStore.getUserById.withArgs(messagePayload.user).returns(userMock);
    robot._rtm.dataStore.getChannelGroupOrDMById.withArgs(messagePayload.channel).returns(channelMock);
    robot._api.chat.postMessage = sinon.stub().callsArgWith(3, errorMock);

    robot.on('response_failed', err => {
      err.should.be.equal(errorMock);
      listenerStub.restore();
      done();
    });

    robot._onMessage(messagePayload);
  });

  it('should emit error, if there is error in callback', done => {
    const robot = new Robot('token');
    robot.bot = { id: 'U834975', name: 'mockbot' };
    robot._rtm.dataStore = {
      getUserById: sinon.stub(),
      getChannelGroupOrDMById: sinon.stub()
    };
    const messagePayload = {
      type: 'message',
      text: 'hello dear',
      user: 'U413552',
      channel: 'C724030'
    };
    const userMock = {
      id: messagePayload.user,
      name: 'anonymouse'
    };
    const channelMock = {
      id: messagePayload.channel,
      name: 'general'
    };
    const errorMock = new Error('something happened in callback');
    const listenerMock = {
      type: 'message',
      value: 'hello ([a-z]+)',
      matcher: /^hello ([a-z]+)$/,
      acls: [],
      callback: (req, res) => {
        throw errorMock;
      }
    };

    const listenerStub = sinon.stub(Listeners.prototype, 'find').returns(listenerMock);

    robot._rtm.dataStore.getUserById.withArgs(messagePayload.user).returns(userMock);
    robot._rtm.dataStore.getChannelGroupOrDMById.withArgs(messagePayload.channel).returns(channelMock);
    robot._api.chat.postMessage = sinon.stub().callsArgWith(3, errorMock);

    robot.on('error', err => {
      err.should.be.equal(errorMock);
      listenerStub.restore();
      done();
    });

    robot._onMessage(messagePayload);
  });
});
