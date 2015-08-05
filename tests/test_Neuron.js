import chai from 'chai';
import sinon from 'sinon';
import sinon_chai from 'sinon-chai';
import Neuron from '../lib/Neuron';
import NeuronListener from '../lib/NeuronListener';

var robot = {
  slack_: {
    openDM: sinon.stub(),
    getDMById: sinon.stub()
  },
  logger: {
    info: sinon.spy()
  }
}

describe('src/robot/Neuron', () => {
  it('should start with empty array of listener', () => {
    var neuron = new Neuron(robot);
    neuron.listeners.should.be.deep.equal([]);
  });

  it('should store robot instance', () => {
    var neuron = new Neuron(robot);
    neuron.robot_.should.be.deep.equal(robot);
  });

  it('should be able to add one listener', () => {
    var neuron = new Neuron(robot);
    var neuronListener = neuron.listen('test');

    neuron.listeners.length.should.be.equal(1);
    neuron.listeners[0].should.be.equal(neuronListener);
    neuronListener.constructor.should.be.equal(NeuronListener);
  });

  it('should be able to add multiple listener', () => {
    var neuron = new Neuron(robot);
    neuron.listen('test');
    neuron.listen('multiple');
    neuron.listen('listener');

    neuron.listeners.length.should.be.equal(3);
  });

  it('should be able to show help for empty listener', () => {
    var neuron = new Neuron(robot);
    var message = {text: 'help', getChannelType: sinon.stub()};
    var user = {};
    var channel = {postMessage: sinon.spy()};

    message.getChannelType.returns('DM');
    neuron.handle(message, user, channel);
    channel.postMessage.should.be.calledWith({as_user: true, text: 'There is no command available yet'});
  });

  it('should be able to show help for every listener', () => {
    var neuron = new Neuron(robot);
    var message = {text: 'help', getChannelType: sinon.stub()};
    var user = {};
    var channel = {postMessage: sinon.spy()};

    neuron.listeners = [
      {commandInfo: 'test', description: 'just testing'},
      {commandInfo: 'testing :something in :environment', description: 'another test'}
    ];

    var helpText = 'just testing\nCommand: *test*\n\nanother test\nCommand: *testing :something in :environment*';

    message.getChannelType.returns('DM');
    neuron.handle(message, user, channel);
    channel.postMessage.should.be.calledWith({as_user: true, text: helpText});
  });

  it('should be able to skip help without description', () => {
    var neuron = new Neuron(robot);
    var message = {text: 'help', getChannelType: sinon.stub()};
    var user = {};
    var channel = {postMessage: sinon.spy()};

    neuron.listeners = [
      {commandInfo: 'test', description: 'just testing'},
      {commandInfo: 'command without :description'}
    ];

    var helpText = 'just testing\nCommand: *test*';

    message.getChannelType.returns('DM');
    neuron.handle(message, user, channel);
    channel.postMessage.should.be.calledWith({as_user: true, text: helpText});
  });

  it('should be able to respond if no commands have a descrption', () => {
    var neuron = new Neuron(robot);
    var message = {text: 'help', getChannelType: sinon.stub()};
    var user = {};
    var channel = {postMessage: sinon.spy()};

    neuron.listeners = [
      {commandInfo: 'test'},
      {commandInfo: 'another command without :description'}
    ];

    var helpText = 'Sorry, no description yet for any available commands';

    message.getChannelType.returns('DM');
    neuron.handle(message, user, channel);
    channel.postMessage.should.be.calledWith({as_user: true, text: helpText});
  });

  it('should be able to respond using "show help"', () => {
    var neuron = new Neuron(robot);
    var message = {text: 'show help', getChannelType: sinon.stub()};
    var user = {};
    var channel = {postMessage: sinon.spy()};

    message.getChannelType.returns('DM');
    neuron.handle(message, user, channel);
    channel.postMessage.should.be.calledOnce;
  });

  it('should be able to notify user when asking for help in channel/group', () => {
    var neuron = new Neuron(robot);
    var message = {text: 'show help', getChannelType: sinon.stub()};
    var user = {id: 'x'};
    var channel = {postMessage: sinon.spy()};
    var dm = {postMessage: sinon.spy()};

    message.getChannelType.returns('channel');
    robot.slack_.openDM.withArgs(user.id).callsArgWith(1);
    robot.slack_.getDMById.withArgs(user.id).returns(dm);
    neuron.handle(message, user, channel);
    channel.postMessage.should.be.calledWith({as_user: true, text: 'Please check your direct message'});
    dm.postMessage.should.be.calledOnce;
  });

  it('should be able to respond if there is no matching listener', () => {
    var neuron = new Neuron(robot);
    var message = {text: 'do something'};
    var user = {};
    var channel = {postMessage: sinon.spy()};

    neuron.handle(message, user, channel);
    channel.postMessage.should.be.calledWith({as_user: true, text: 'Sorry I didn\'t understand your command'});
  });

  it('should be able to run action handler if listener found', () => {
    var respondStub = sinon.stub(NeuronListener.prototype, 'respondTo');
    var handleStub = sinon.stub(NeuronListener.prototype, 'handle');
    var neuron = new Neuron(robot);
    var message = {text: 'do something'};
    var user = {};
    var channel = {postMessage: sinon.spy()};

    respondStub.returns({match: true, allowed: true});
    handleStub.returns(Promise.resolve());
    neuron.listen('do something');

    neuron.handle(message, user, channel);
    handleStub.should.be.calledWith(message, user, channel);

    respondStub.restore();
    handleStub.restore();
  });

  it('should not run action handler if not allowed by ACL', () => {
    var respondStub = sinon.stub(NeuronListener.prototype, 'respondTo');
    var handleSpy = sinon.spy(NeuronListener.prototype, 'handle');
    var neuron = new Neuron(robot);
    var message = {text: 'do something'};
    var user = {};
    var channel = {postMessage: sinon.spy()};

    respondStub.returns({match: true, allowed: false});
    neuron.listen('do something');

    neuron.handle(message, user, channel);
    handleSpy.callCount.should.be.equal(0);

    respondStub.restore();
    handleSpy.restore();
  });

  it('should be able to respond if there is an error when executing action', () => {
    var respondStub = sinon.stub(NeuronListener.prototype, 'respondTo');
    var handleStub = sinon.stub(NeuronListener.prototype, 'handle');
    var neuron = new Neuron(robot);
    var message = {text: 'do something'};
    var user = {};
    var channel = {postMessage: sinon.spy()};
    var error = 'Execution error';
    var errorMock = new Error(error);

    respondStub.returns({match: true, allowed: true});
    handleStub.returns(Promise.reject(errorMock));
    neuron.listen('do something');

    neuron.handle(message, user, channel).then(() => {
      channel.postMessage.should.be.calledWith({
        as_user: true,
        attachments: [
          {
            title: 'There\s an error when executing your command',
            text: `Error message: Execution error`,
            color: 'danger'
          }
        ]
      });
    });

    respondStub.restore();
    handleStub.restore();
  });

});
