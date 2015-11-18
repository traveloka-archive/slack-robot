/* eslint-env mocha */
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import Listener from '../src/Listener';

chai.use(sinonChai);
chai.use(chaiAsPromised);
chai.should();

const robot = {
  _slack: {},
  brain: {},
  logger: {
    info: sinon.spy()
  }
};
const messageFormat = 'test';

describe('lib/Listener', () => {
  it('should be able to create a matcher from string', () => {
    const messageFormat = 'test :param([a-zA-Z]+) from :angle([0-9]{3})';
    const neuronListener = new Listener(robot, messageFormat);
    'test siPUt from 120'.should.match(neuronListener.matcher);
    'test kAMBin6 from 79'.should.not.match(neuronListener.matcher);
    'test kuda lumping from 135'.should.not.match(neuronListener.matcher);
  });

  it('should be able to create a matcher from regex', () => {
    const messageFormat = /test ([a-zA-Z]+) from ([0-9]{3})/;
    const neuronListener = new Listener(robot, messageFormat);
    'test siPUt from 120'.should.match(neuronListener.matcher);
    'test kAMBin6 from 79'.should.not.match(neuronListener.matcher);
    'test kuda lumping from 135'.should.not.match(neuronListener.matcher);
  });

  it('should be able to create a command info', () => {
    const messageFormat = 'test :param([a-zA-Z]+) from :angle([0-9]{3})';
    const neuronListener = new Listener(robot, messageFormat);
    neuronListener.commandInfo.should.be.equal('test :param from :angle');
  });

  it('should be able to add description', () => {
    const description = 'random description';
    const neuronListener = new Listener(robot, messageFormat);
    neuronListener.desc(description);

    neuronListener.description.should.be.equal(description);
  });

  it('should validate description', () => {
    const descriptionError = 'Description must be non-empty string';
    const neuronListener = new Listener(robot, messageFormat);
    const wrongDescription1 = () => neuronListener.desc('');
    const wrongDescription2 = () => neuronListener.desc({ key: 'value' });

    wrongDescription1.should.throw(descriptionError);
    wrongDescription2.should.throw(descriptionError);
  });

  it('should be able to add acl', () => {
    const acl = sinon.spy();
    const neuronListener = new Listener(robot, messageFormat);
    neuronListener.acl(acl);

    neuronListener.aclFn.should.be.equal(acl);
  });

  it('should validate acl callback', () => {
    const aclError = 'ACL callback must be a function';
    const neuronListener = new Listener(robot, messageFormat);
    const wrongAcl1 = () => neuronListener.acl({ not: 'a function' });
    const wrongAcl2 = () => neuronListener.acl(['1']);

    wrongAcl1.should.throw(aclError);
    wrongAcl2.should.throw(aclError);
  });

  it('should be able to add action', () => {
    function action() {}
    const neuronListener = new Listener(robot, messageFormat);
    neuronListener.handler(action);

    neuronListener.handle.should.be.deep.equal(action);
  });

  it('should set rejected promise as default handle', () => {
    const neuronListener = new Listener(robot, messageFormat);

    neuronListener.handle().should.be.rejectedWith('Unknown handle');
  });

  it('should validate action callback', () => {
    const actionError = 'Action must be a function';
    const neuronListener = new Listener(robot, messageFormat);
    const wrongAction1 = () => neuronListener.handler('not a function');
    const wrongAction2 = () => neuronListener.handler(new Error());

    wrongAction1.should.throw(actionError);
    wrongAction2.should.throw(actionError);
  });

  it('should be able to ignore unmatched command', () => {
    const messageFormat = 'not matched';
    const req = {
      message: {
        text: 'not match'
      }
    };
    const res = {};

    const neuronListener = new Listener(robot, messageFormat);
    const response = neuronListener.respondTo(req, res);

    response.match.should.be.equal(false);
  });

  it('should allow command without acl', () => {
    const messageFormat = 'command without :acl([a-z]+)';
    const req = {
      message: {
        text: 'command without acl'
      },
      user: {
        name: 'goat'
      }
    };
    const res = {};

    const neuronListener = new Listener(robot, messageFormat);
    const response = neuronListener.respondTo(req, res);

    response.match.should.be.equal(true);
    response.allowed.should.be.equal(true);
    robot.logger.info.should.be.calledWith(`Received command without acl from goat`);
  });

  it('should prevent command if not allowed by acl', () => {
    const messageFormat = 'command without :acl([a-z]+)';
    const req = {
      message: {
        text: 'command without acl'
      },
      user: {
        name: 'goat'
      }
    };
    const res = {};
    const aclFn = sinon.stub().returns(false);

    const neuronListener = new Listener(robot, messageFormat);
    neuronListener.acl(aclFn);

    const response = neuronListener.respondTo(req, res);
    response.match.should.be.equal(true);
    response.allowed.should.be.equal(false);
  });

  it('should allow command if acl callback return true', () => {
    const messageFormat = 'command without :acl([a-z]+)';
    const req = {
      message: {
        text: 'command without acl'
      },
      user: {
        name: 'goat'
      }
    };
    const res = {};
    const aclFn = () => true;

    const neuronListener = new Listener(robot, messageFormat);
    neuronListener.acl(aclFn);

    const response = neuronListener.respondTo(req, res);
    response.match.should.be.equal(true);
    response.allowed.should.be.equal(true);
  });

  it('should be send request and response to acl', () => {
    const messageFormat = 'command without :something([a-z]+)';
    const req = {
      message: {
        text: 'command without acl'
      },
      user: {
        name: 'goat'
      }
    };
    const res = {};
    const aclFn = sinon.stub().returns(true);

    const neuronListener = new Listener(robot, messageFormat);
    neuronListener.acl(aclFn);

    neuronListener.respondTo(req, res);
    aclFn.should.be.calledWith(req, res);
  });

  it('should handle action callback correctly', () => {
    const messageFormat = 'command without :acl([a-z]+)';
    const req = {
      message: {
        text: 'command without nope'
      },
      user: {
        name: 'goat'
      }
    };
    const res = {};
    const responseMock = { status: 'ok' };
    const action = sinon.stub().returns(Promise.resolve(responseMock));

    const neuronListener = new Listener(robot, messageFormat);
    neuronListener.handler(action);

    neuronListener.handle(req, res).should.become(responseMock);
  });

  it('should handle propagate error from action callback', () => {
    const messageFormat = 'command without :acl([a-z]+)';
    const req = {
      message: {
        text: 'command without acl'
      },
      user: {
        name: 'goat'
      }
    };
    const res = {};
    const errorMessage = 'random action execution';
    const errorMock = new Error(errorMessage);
    const action = sinon.stub().returns(Promise.reject(errorMock));
    const neuronListener = new Listener(robot, messageFormat);

    neuronListener.handler(action);
    neuronListener.handle(req, res).should.be.rejectedWith(errorMock);
  });

  it('should be able to get correct payload parameter', () => {
    const messageFormat = 'get :animal([a-z]+) from :year([0-9]{4})';
    const messageText = 'get kambing from 2010';
    const expectedParam = { animal: 'kambing', year: '2010' };
    const neuronListener = new Listener(robot, messageFormat);

    neuronListener._getParam(messageText).should.be.deep.equal(expectedParam);
  });

  it('should be return empty object if payload is not found', () => {
    const messageFormat = 'command without payload';
    const messageText = 'command without payload';
    const expectedParam = {};
    const neuronListener = new Listener(robot, messageFormat);

    neuronListener._getParam(messageText).should.be.deep.equal(expectedParam);
  });

  it('should be able to get matches & param if messageFormat is regex', () => {
    const messageFormat = /get ([a-z]+) from ([0-9]{4})/;
    const messageText = 'get kambing from 2010';
    const expectedMatches = ['kambing', '2010'];
    const neuronListener = new Listener(robot, messageFormat);

    neuronListener._getMatches(messageText).should.be.deep.equal(expectedMatches);
    neuronListener._getParam(messageText).should.be.deep.equal({});
  });

  it('should be able to return empty array if there is no more regex group', () => {
    const messageFormat = /regex without other match/;
    const messageText = 'regex without other match';
    const expectedMatches = [];
    const neuronListener = new Listener(robot, messageFormat);

    neuronListener._getMatches(messageText).should.be.deep.equal(expectedMatches);
  });
});
