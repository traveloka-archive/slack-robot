/* eslint no-unused-expressions: 0 */
import chai from 'chai';
import { describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import helpGenerator from '../../src/plugins/help-generator';

chai.use(sinonChai);
const should = chai.should();

describe('plugins/help-generator', () => {
  it('should be able to add new listener if enabled', () => {
    const robot = {
      listen: sinon.stub(),
      acls: {
        dynamicMention: sinon.spy()
      },
      removeListener: sinon.stub()
    };
    const listener = {
      desc: sinon.stub(),
      acl: sinon.stub()
    };

    robot.listen.returns(listener);
    listener.desc.returns(listener);

    helpGenerator({ enable: true })(robot);
    robot.listen.should.be.calledOne;
    should.equal(robot.listen.getCall(0).args[0].test('help'), true);
    should.equal(robot.listen.getCall(0).args[0].test('help me'), true);
    should.equal(robot.listen.getCall(0).args[0].test('send me help'), true);
  });

  it('should not remove existing listener if disabled without enabling first', () => {
    const robot = {
      listen: sinon.stub(),
      removeListener: sinon.stub()
    };

    helpGenerator({ enable: false })(robot);
    robot.listen.should.notCalled;
    robot.removeListener.should.notCalled;
  });

  it('should remove existing listener if disabled', () => {
    const robot = {
      listen: sinon.stub(),
      acls: {
        dynamicMention: sinon.spy()
      },
      removeListener: sinon.stub()
    };
    const listener = {
      id: 5,
      desc: sinon.stub(),
      acl: sinon.stub()
    };

    robot.listen.returns(listener);
    listener.desc.returns(listener);
    listener.acl.returns(listener);

    helpGenerator({ enable: true })(robot);
    helpGenerator({ enable: false })(robot);

    robot.listen.should.notCalled;
    robot.removeListener.should.be.calledWithExactly(5);
  });

  it('should send help command via snippet', () => {
    const robot = {
      listen: sinon.stub(),
      desc: sinon.stub(),
      acls: {
        dynamicMention: sinon.spy()
      },
      removeListener: sinon.stub(),
      getAllListeners: sinon.stub()
    };
    const req = {

    };
    const res = {
      upload: sinon.stub(),
      send: sinon.spy()
    };

    const listenersMock = [
      {
        type: 'message',
        value: /help/,
        description: 'Show this message'
      },
      {
        type: 'message',
        value: 'deploy :branch([a-z\/\-]+) to :env([a-z]+)',
        description: ''
      },
      {
        type: 'reaction_added',
        value: '\\+1',
        description: 'If you +1 my post, I will thank you'
      }
    ];

    const helpTextMock = 'type: message (regex)\n' +
    'command: /help/\n' +
    'description: Show this message\n\n' +
    'type: message\n' +
    'command: deploy :branch([a-z/-]+) to :env([a-z]+)\n' +
    'description: -\n\n' +
    'type: reaction_added\n' +
    'command: +1\n' +
    'description: If you +1 my post, I will thank you';

    const listener = {
      id: 5,
      desc: sinon.stub(),
      acl: sinon.stub()
    };

    robot.listen.returns(listener);
    listener.desc.returns(listener);
    listener.acl.returns(listener);

    robot.listen.callsArgWith(1, req, res);
    robot.getAllListeners.returns(listenersMock);
    res.upload.returns(res);

    helpGenerator({ enable: true })(robot);
    res.upload.should.be.calledWithExactly('command-list.txt', helpTextMock);
    res.send.should.be.calledOnce;
  });
});
