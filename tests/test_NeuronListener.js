import chai from 'chai';
import sinon from 'sinon';
import sinon_chai from 'sinon-chai';
import chai_as_promised from 'chai-as-promised';
import BaseAction from '../action/BaseAction';
import NeuronListener from '../lib/NeuronListener';

chai.use(sinon_chai);
chai.use(chai_as_promised);
chai.should();

var robot = {
  slack_: {},
  brain : {},
  logger: {
    info: sinon.spy()
  }
}
var messageFormat = 'test';

class FakeAction extends BaseAction {
  constructor(robot) {
    super(robot);
  }
}

describe('src/robot/NeuronListener', () => {
  it('should be able to create a matcher', () => {
    var messageFormat = 'test :param([a-zA-Z]+) from :angle([0-9]{3})';
    var neuronListener = new NeuronListener(robot, messageFormat);
    'test siPUt from 120'.should.match(neuronListener.matcher);
    'test kAMBin6 from 79'.should.not.match(neuronListener.matcher);
    'test kuda lumping from 135'.should.not.match(neuronListener.matcher);
  });

  it('should be able to create a command info', () => {
    var messageFormat = 'test :param([a-zA-Z]+) from :angle([0-9]{3})';
    var neuronListener = new NeuronListener(robot, messageFormat);
    neuronListener.commandInfo.should.be.equal('test :param from :angle');
  });

  it('should be able to add description', () => {
    var description = 'random description';
    var neuronListener = new NeuronListener(robot, messageFormat);
    neuronListener.desc(description);

    neuronListener.description.should.be.equal(description);
  });

  it('should validate description', () => {
    var descriptionError = 'Description must be non-empty string';
    var neuronListener = new NeuronListener(robot, messageFormat);
    var wrongDescription1 = () => { neuronListener.desc(''); }
    var wrongDescription2 = () => { neuronListener.desc({key: 'value'}); }

    wrongDescription1.should.throw(descriptionError);
    wrongDescription2.should.throw(descriptionError);
  });

  it('should be able to add acl', () => {
    var acl = sinon.spy();
    var neuronListener = new NeuronListener(robot, messageFormat);
    neuronListener.acl(acl);

    neuronListener.aclFn.should.be.equal(acl);
  });

  it('should validate acl callback', () => {
    var aclError = 'ACL callback must be a function';
    var neuronListener = new NeuronListener(robot, messageFormat);
    var wrongAcl1 = () => { neuronListener.acl({not: 'a function'}); }
    var wrongAcl2 = () => { neuronListener.acl(['1']); }

    wrongAcl1.should.throw(aclError);
    wrongAcl2.should.throw(aclError);
  });

  it('should be able to add action', () => {
    var action = new FakeAction(robot);
    var neuronListener = new NeuronListener(robot, messageFormat);
    neuronListener.handler(action);

    neuronListener.action.should.be.deep.equal(action);
  });

  it('should validate action callback', () => {
    var actionError = 'Action must be instance of BaseAction';
    var neuronListener = new NeuronListener(robot, messageFormat);
    var wrongAction1 = () => { neuronListener.handler('not a function'); }
    var wrongAction2 = () => { neuronListener.handler(new Error()); }

    wrongAction1.should.throw(actionError);
    wrongAction2.should.throw(actionError);
  });

  it('should be able to ignore unmatched command', () => {
    var messageFormat = 'not matched';
    var message = { text: 'not match' };
    var user = {};
    var channel = {};

    var neuronListener = new NeuronListener(robot, messageFormat);
    var response = neuronListener.respondTo(message, user, channel);

    response.match.should.be.equal(false);
  });

  it('should allow command without acl', () => {
    var messageFormat = 'command without :acl([a-z]+)';
    var message = { text: 'command without acl' };
    var user = {name: 'goat'};
    var channel = {};

    var neuronListener = new NeuronListener(robot, messageFormat);
    var response = neuronListener.respondTo(message, user, channel);

    response.match.should.be.equal(true);
    response.allowed.should.be.equal(true);
    robot.logger.info.should.be.calledWith(`Received command without acl from goat`);
  });

  it('should prevent command if not allowed by acl', () => {
    var messageFormat = 'command without :acl([a-z]+)';
    var message = { text: 'command without acl' };
    var user = {};
    var channel = {};
    var aclFn = () => { return false };

    var neuronListener = new NeuronListener(robot, messageFormat);
    neuronListener.acl(aclFn);

    var response = neuronListener.respondTo(message, user, channel);
    response.match.should.be.equal(true);
    response.allowed.should.be.equal(false);
  });

  it('should allow command if acl callback return true', () => {
    var messageFormat = 'command without :acl([a-z]+)';
    var message = { text: 'command without acl' };
    var user = {};
    var channel = {};
    var aclFn = () => { return true };

    var neuronListener = new NeuronListener(robot, messageFormat);
    neuronListener.acl(aclFn);

    var response = neuronListener.respondTo(message, user, channel);
    response.match.should.be.equal(true);
    response.allowed.should.be.equal(true);
  });

  it('should be send payload, robot instance, and action instance to ACL', () => {
    var messageFormat = 'command without :acl([a-z]+)';
    var message = { text: 'command without acl' };
    var user = {};
    var channel = {};
    var aclFn = sinon.stub().returns(true);
    var param = {acl: 'acl'};
    var messagePayload = {message, user, channel, param};
    var action = new FakeAction(robot);

    var neuronListener = new NeuronListener(robot, messageFormat);
    neuronListener.acl(aclFn);

    var response = neuronListener.respondTo(message, user, channel);
    aclFn.should.be.calledWith(messagePayload, action);
  });

  it('should handle action callback correctly', done => {
    var messageFormat = 'command without :acl([a-z]+)';
    var message = { text: 'command without nope' };
    var user = {};
    var channel = {};
    var responseMock = {status: 'ok'};
    var param = {acl: 'nope'};
    var expectedPayload = {message, user, channel, param};
    var action = new FakeAction();
    action.execute = sinon.stub().returns(Promise.resolve(responseMock));

    var neuronListener = new NeuronListener(robot, messageFormat);
    neuronListener.handler(action);

    neuronListener.handle(message, user, channel).then(response => {
      neuronListener.action.messagePayload.should.be.deep.equal(expectedPayload);
      response.should.be.deep.equal(responseMock);
      done();
    });
  });

  it('should handle propagate error from action callback', () => {
    var messageFormat = 'command without :acl([a-z]+)';
    var message = { text: 'command without acl' };
    var user = {};
    var channel = {};
    var errorMessage = 'random action execution';
    var errorMock = new Error(errorMock);
    var action = new FakeAction();
    var neuronListener = new NeuronListener(robot, messageFormat);

    action.execute = sinon.stub().returns(Promise.reject(errorMock));
    neuronListener.handler(action);
    neuronListener.handle(message, user, channel).should.be.rejectedWith(errorMock);
  });

  it('should be able to get correct payload parameter', () => {
    var messageFormat = 'get :animal([a-z]+) from :year([0-9]{4})';
    var messageText = 'get kambing from 2010';
    var user = {};
    var channel = {};
    var expectedParam = {animal: 'kambing', year: '2010'};
    var neuronListener = new NeuronListener(robot, messageFormat);

    neuronListener.getPayloadParam_(messageText).should.be.deep.equal(expectedParam);
  });

  it('should be return empty object if payload is not found', () => {
    var messageFormat = 'command without payload';
    var messageText = 'command without payload';
    var user = {};
    var channel = {};
    var expectedParam = {};
    var neuronListener = new NeuronListener(robot, messageFormat);

    neuronListener.getPayloadParam_(messageText).should.be.deep.equal(expectedParam);
  });

});
