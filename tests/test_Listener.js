import chai from 'chai';
import sinon from 'sinon';
import sinon_chai from 'sinon-chai';
import chai_as_promised from 'chai-as-promised';
import Response from '../lib/Response';
import Listener from '../lib/Listener';

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

class FakeAction extends Response {
  constructor(robot) {
    super(robot);
  }
}

describe('lib/Listener', () => {
  it('should be able to create a matcher from string', () => {
    var messageFormat = 'test :param([a-zA-Z]+) from :angle([0-9]{3})';
    var neuronListener = new Listener(robot, messageFormat);
    'test siPUt from 120'.should.match(neuronListener.matcher);
    'test kAMBin6 from 79'.should.not.match(neuronListener.matcher);
    'test kuda lumping from 135'.should.not.match(neuronListener.matcher);
  });

  it('should be able to create a matcher from regex', () => {
    var messageFormat = /test ([a-zA-Z]+) from ([0-9]{3})/;
    var neuronListener = new Listener(robot, messageFormat);
    'test siPUt from 120'.should.match(neuronListener.matcher);
    'test kAMBin6 from 79'.should.not.match(neuronListener.matcher);
    'test kuda lumping from 135'.should.not.match(neuronListener.matcher);
  });

  it('should be able to create a command info', () => {
    var messageFormat = 'test :param([a-zA-Z]+) from :angle([0-9]{3})';
    var neuronListener = new Listener(robot, messageFormat);
    neuronListener.commandInfo.should.be.equal('test :param from :angle');
  });

  it('should be able to add description', () => {
    var description = 'random description';
    var neuronListener = new Listener(robot, messageFormat);
    neuronListener.desc(description);

    neuronListener.description.should.be.equal(description);
  });

  it('should validate description', () => {
    var descriptionError = 'Description must be non-empty string';
    var neuronListener = new Listener(robot, messageFormat);
    var wrongDescription1 = () => { neuronListener.desc(''); }
    var wrongDescription2 = () => { neuronListener.desc({key: 'value'}); }

    wrongDescription1.should.throw(descriptionError);
    wrongDescription2.should.throw(descriptionError);
  });

  it('should be able to add acl', () => {
    var acl = sinon.spy();
    var neuronListener = new Listener(robot, messageFormat);
    neuronListener.acl(acl);

    neuronListener.aclFn.should.be.equal(acl);
  });

  it('should validate acl callback', () => {
    var aclError = 'ACL callback must be a function';
    var neuronListener = new Listener(robot, messageFormat);
    var wrongAcl1 = () => { neuronListener.acl({not: 'a function'}); }
    var wrongAcl2 = () => { neuronListener.acl(['1']); }

    wrongAcl1.should.throw(aclError);
    wrongAcl2.should.throw(aclError);
  });

  it('should be able to add action', () => {
    function action() {};
    var neuronListener = new Listener(robot, messageFormat);
    neuronListener.handler(action);

    neuronListener.handle.should.be.deep.equal(action);
  });

  it('should set rejected promise as default handle', () => {
    var neuronListener = new Listener(robot, messageFormat);

    neuronListener.handle().should.be.rejectedWith('Unknown handle');
  });

  it('should validate action callback', () => {
    var actionError = 'Action must be a function';
    var neuronListener = new Listener(robot, messageFormat);
    var wrongAction1 = () => { neuronListener.handler('not a function'); }
    var wrongAction2 = () => { neuronListener.handler(new Error()); }

    wrongAction1.should.throw(actionError);
    wrongAction2.should.throw(actionError);
  });

  it('should be able to ignore unmatched command', () => {
    var messageFormat = 'not matched';
    var req = {
      message: {
        text: 'not match'
      }
    };
    var res = {};

    var neuronListener = new Listener(robot, messageFormat);
    var response = neuronListener.respondTo(req, res);

    response.match.should.be.equal(false);
  });

  it('should allow command without acl', () => {
    var messageFormat = 'command without :acl([a-z]+)';
    var req = {
      message: {
        text: 'command without acl'
      },
      user: {
        name: 'goat'
      }
    };
    var res = {};

    var neuronListener = new Listener(robot, messageFormat);
    var response = neuronListener.respondTo(req, res);

    response.match.should.be.equal(true);
    response.allowed.should.be.equal(true);
    robot.logger.info.should.be.calledWith(`Received command without acl from goat`);
  });

  it('should prevent command if not allowed by acl', () => {
    var messageFormat = 'command without :acl([a-z]+)';
    var req = {
      message: {
        text: 'command without acl'
      },
      user: {
        name: 'goat'
      }
    };
    var res = {};
    var aclFn = sinon.stub().returns(false);

    var neuronListener = new Listener(robot, messageFormat);
    neuronListener.acl(aclFn);

    var response = neuronListener.respondTo(req, res);
    response.match.should.be.equal(true);
    response.allowed.should.be.equal(false);
  });

  it('should allow command if acl callback return true', () => {
    var messageFormat = 'command without :acl([a-z]+)';
    var req = {
      message: {
        text: 'command without acl'
      },
      user: {
        name: 'goat'
      }
    };
    var res = {};
    var aclFn = () => { return true };

    var neuronListener = new Listener(robot, messageFormat);
    neuronListener.acl(aclFn);

    var response = neuronListener.respondTo(req, res);
    response.match.should.be.equal(true);
    response.allowed.should.be.equal(true);
  });

  it('should be send request and response to acl', () => {
    var messageFormat = 'command without :something([a-z]+)';
    var req = {
      message: {
        text: 'command without acl'
      },
      user: {
        name: 'goat'
      }
    };
    var res = {};
    var aclFn = sinon.stub().returns(true);

    var neuronListener = new Listener(robot, messageFormat);
    neuronListener.acl(aclFn);

    var response = neuronListener.respondTo(req, res);
    aclFn.should.be.calledWith(req, res);
  });

  it('should handle action callback correctly', () => {
    var messageFormat = 'command without :acl([a-z]+)';
    var req = {
      message: {
        text: 'command without nope'
      },
      user: {
        name: 'goat'
      }
    };
    var res = {};
    var responseMock = {status: 'ok'};
    var action = sinon.stub().returns(Promise.resolve(responseMock));

    var neuronListener = new Listener(robot, messageFormat);
    neuronListener.handler(action);

    neuronListener.handle(req, res).should.become(responseMock);
  });

  it('should handle propagate error from action callback', () => {
    var messageFormat = 'command without :acl([a-z]+)';
    var req = {
      message: {
        text: 'command without acl'
      },
      user: {
        name: 'goat'
      }
    };
    var res = {};
    var errorMessage = 'random action execution';
    var errorMock = new Error(errorMock);
    var action = sinon.stub().returns(Promise.reject(errorMock));
    var neuronListener = new Listener(robot, messageFormat);

    neuronListener.handler(action);
    neuronListener.handle(req, res).should.be.rejectedWith(errorMock);
  });

  it('should be able to get correct payload parameter', () => {
    var messageFormat = 'get :animal([a-z]+) from :year([0-9]{4})';
    var messageText = 'get kambing from 2010';
    var expectedParam = {animal: 'kambing', year: '2010'};
    var neuronListener = new Listener(robot, messageFormat);

    neuronListener._getParam(messageText).should.be.deep.equal(expectedParam);
  });

  it('should be return empty object if payload is not found', () => {
    var messageFormat = 'command without payload';
    var messageText = 'command without payload';
    var expectedParam = {};
    var neuronListener = new Listener(robot, messageFormat);

    neuronListener._getParam(messageText).should.be.deep.equal(expectedParam);
  });

  it('should be able to get matches & param if messageFormat is regex', () => {
    var messageFormat = /get ([a-z]+) from ([0-9]{4})/;
    var messageText = 'get kambing from 2010';
    var expectedMatches = ['kambing', '2010'];
    var neuronListener = new Listener(robot, messageFormat);

    neuronListener._getMatches(messageText).should.be.deep.equal(expectedMatches);
    neuronListener._getParam(messageText).should.be.deep.equal({});
  });

  it('should be able to return empty array if there is no more regex group', () => {
    var messageFormat = /regex without other match/;
    var messageText = 'regex without other match';
    var expectedMatches = [];
    var neuronListener = new Listener(robot, messageFormat);

    neuronListener._getMatches(messageText).should.be.deep.equal(expectedMatches);
  });

});
