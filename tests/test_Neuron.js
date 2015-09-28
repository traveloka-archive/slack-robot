/* eslint-env mocha */
/* eslint no-unused-expressions:0 */
/* eslint camelcase:0 */

import chai from 'chai';
import sinon from 'sinon';
import Neuron from '../src/Neuron';
import Listener from '../src/Listener';
import Request from '../src/Request';
import Response from '../src/Response';

chai.should();

var robot = {
  id: 'UR08OT',
  options: {
    ignoreMessageInGeneral: true,
    mentionToRespond: true,
    skipDMMention: true
  }
};

describe('lib/Neuron', () => {
  var requestMock = {
    message: {
      text: 'Yo dawg',
      isDirect: false,
      withMention: false
    },
    user: {
      id: 'U28RF4HEW',
      name: 'muchuser'
    },
    channel: {
      id: 'C3RT34RAD',
      name: 'such-channel'
    }
  };
  var responseMock = {
    send: sinon.spy(),
    sendDM: sinon.spy(),
    reply: sinon.spy()
  };
  var requestGenerator, responseGenerator;

  before(() => {
    requestGenerator = sinon.stub(Request.prototype, 'parse');
    responseGenerator = sinon.stub(Response.prototype, 'parse');
  });

  beforeEach(() => {
    requestGenerator.reset();
    responseGenerator.reset();

    responseMock.send.reset();
    responseMock.sendDM.reset();
    responseMock.reply.reset();
  });

  after(() => {
    requestGenerator.restore();
    responseGenerator.restore();
  });

  it('should start with empty array of listener', () => {
    var neuron = new Neuron(robot);
    neuron.listeners.should.be.deep.equal([]);
  });

  it('should store robot instance', () => {
    var neuron = new Neuron(robot);
    neuron._robot.should.be.deep.equal(robot);
  });

  it('should be able to add one listener', () => {
    var neuron = new Neuron(robot);
    var neuronListener = neuron.listen('test');

    neuron.listeners.length.should.be.equal(1);
    neuron.listeners[0].should.be.equal(neuronListener);
    neuronListener.constructor.should.be.equal(Listener);
  });

  it('should be able to add multiple listener', () => {
    var neuron = new Neuron(robot);
    neuron.listen('test');
    neuron.listen('multiple');
    neuron.listen('listener');

    neuron.listeners.length.should.be.equal(3);
  });

  it('should ignore message with unknown channel / user', () => {
    var unknownChannel = Object.assign({}, requestMock, {
      channel: null,
      user: null
    });
    var dispatchStub = sinon.stub(Neuron.prototype, '_dispatchHandler');

    requestGenerator.returns(unknownChannel);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.handle();

    dispatchStub.callCount.should.be.equal(0);
    dispatchStub.restore();
  });

  it('should ignore message from self', () => {
    var selfMessage = Object.assign({}, requestMock, {
      user: {
        id: robot.id
      }
    });
    var dispatchStub = sinon.stub(Neuron.prototype, '_dispatchHandler');

    requestGenerator.returns(selfMessage);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.handle();

    dispatchStub.callCount.should.be.equal(0);
    dispatchStub.restore();
  });

  it('should ignore message in general by default', () => {
    var generalChannel = Object.assign({}, requestMock, {
      channel: {
        name: 'general'
      }
    });
    var dispatchStub = sinon.stub(Neuron.prototype, '_dispatchHandler');

    requestGenerator.returns(generalChannel);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.handle();

    dispatchStub.callCount.should.be.equal(0);
    dispatchStub.restore();
  });

  it('should not ignore message in general if such option is specified', () => {
    var customRobot = Object.assign({}, robot, {
      options: {
        ignoreMessageInGeneral: false
      }
    });
    var generalChannel = Object.assign({}, requestMock, {
      channel: {
        name: 'general'
      }
    });
    var dispatchStub = sinon.stub(Neuron.prototype, '_dispatchHandler');

    requestGenerator.returns(generalChannel);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(customRobot);
    neuron.handle();

    dispatchStub.callCount.should.be.equal(1);
    dispatchStub.restore();
  });

  it('should ignore message without mention by default', () => {
    var randomNoMention = Object.assign({}, requestMock, {
      message: {
        isDirect: false,
        withMention: false
      },
      channel: {
        name: 'random'
      }
    });
    var dispatchStub = sinon.stub(Neuron.prototype, '_dispatchHandler');

    requestGenerator.returns(randomNoMention);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.handle();

    dispatchStub.callCount.should.be.equal(0);
    dispatchStub.restore();
  });

  it('should not ignore message without mention if such option is specified', () => {
    var customRobot = Object.assign({}, robot, {
      options: {
        mentionToRespond: false
      }
    });
    var dispatchStub = sinon.stub(Neuron.prototype, '_dispatchHandler');

    requestGenerator.returns(requestMock);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(customRobot);
    neuron.handle();

    dispatchStub.callCount.should.be.equal(1);
    dispatchStub.restore();
  });

  it('should always respond to DM by default', () => {
    var directMessage = Object.assign({}, requestMock, {
      message: {
        isDirect: true
      }
    });
    var dispatchStub = sinon.stub(Neuron.prototype, '_dispatchHandler');

    requestGenerator.returns(directMessage);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.handle();

    dispatchStub.callCount.should.be.equal(1);
    dispatchStub.restore();
  });

  it('should check for mention in DM if option is specified', () => {
    var directMessage = Object.assign({}, requestMock, {
      message: {
        withMention: false,
        isDirect: true
      }
    });
    var customRobot = Object.assign({}, robot, {
      options: {
        mentionToRespond: true,
        skipDMMention: false
      }
    });
    var dispatchStub = sinon.stub(Neuron.prototype, '_dispatchHandler');

    requestGenerator.returns(directMessage);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(customRobot);
    neuron.handle();

    dispatchStub.callCount.should.be.equal(0);
    dispatchStub.restore();
  });

  it('should be able to show help for empty listener', () => {
    var helpMessage = Object.assign({}, requestMock, {
      message: {
        text: 'help',
        isDirect: true,
        withMention: true
      }
    });
    requestGenerator.returns(helpMessage);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.handle();

    responseMock.send.should.be.calledWith({text: 'There is no command available yet'});
  });

  it('should be able to show help for every listener', () => {
    var helpMessage = Object.assign({}, requestMock, {
      message: {
        text: 'help',
        isDirect: true,
        withMention: true
      }
    });
    requestGenerator.returns(helpMessage);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.listeners = [
      {commandInfo: 'test', description: 'just testing'},
      {commandInfo: 'testing :something in :environment', description: 'another test'}
    ];

    neuron.handle();

    var helpText = 'just testing\nCommand: *test*\n\nanother test\nCommand: *testing :something in :environment*';
    var expectedResponse = {
      attachments: [
        {
          fallback: 'Available commands:',
          title: 'Available commands:',
          text: helpText,
          mrkdwn_in: ['text']
        }
      ]
    };
    responseMock.send.should.be.calledWith(expectedResponse);
  });

  it('should be able to skip help without description', () => {
    var helpMessage = Object.assign({}, requestMock, {
      message: {
        text: 'help',
        isDirect: true,
        withMention: true
      }
    });
    requestGenerator.returns(helpMessage);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.listeners = [
      {commandInfo: 'test', description: 'just testing'},
      {commandInfo: 'command without :description'}
    ];

    neuron.handle();

    var helpText = 'just testing\nCommand: *test*';
    var expectedResponse = {
      attachments: [
        {
          fallback: 'Available commands:',
          title: 'Available commands:',
          text: helpText,
          mrkdwn_in: ['text']
        }
      ]
    };
    responseMock.send.should.be.calledWith(expectedResponse);
  });

  it('should be able to respond if no commands have a descrption', () => {
    var helpMessage = Object.assign({}, requestMock, {
      message: {
        text: 'help',
        isDirect: true,
        withMention: true
      }
    });
    requestGenerator.returns(helpMessage);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.listeners = [
      {commandInfo: 'test'},
      {commandInfo: 'another command without :description'}
    ];

    neuron.handle();

    var helpText = 'Sorry, no description yet for any available commands';
    responseMock.send.should.be.calledWith({text: helpText});
  });

  it('should be able to respond using "show help"', () => {
    var helpMessage = Object.assign({}, requestMock, {
      message: {
        text: 'show help',
        isDirect: true,
        withMention: true
      }
    });
    requestGenerator.returns(helpMessage);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.handle();
    responseMock.send.should.be.calledOnce;
  });

  it('should be able to notify user when asking for help in channel/group', () => {
    var helpMessage = Object.assign({}, requestMock, {
      message: {
        text: 'show help',
        isDirect: false,
        withMention: true
      }
    });
    requestGenerator.returns(helpMessage);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.handle();
    responseMock.reply.should.be.calledWith('please check your direct message');
    responseMock.sendDM.should.be.calledOnce;
  });

  it('should be able to respond if there is no matching listener', () => {
    var needListener = Object.assign({}, requestMock, {
      message: {
        text: 'yolo',
        isDirect: false,
        withMention: true
      }
    });
    requestGenerator.returns(needListener);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.handle();

    responseMock.reply.should.be.calledWith('sorry I didn\'t understand your command');
  });

  it('should be able to run action handler if listener found', () => {
    var listenerMock = {
      respondTo: sinon.stub().returns({match: true, allowed: true}),
      handle: sinon.stub().returns(Promise.resolve())
    };
    var needListener = Object.assign({}, requestMock, {
      message: {
        text: 'yolo',
        isDirect: false,
        withMention: true
      }
    });
    requestGenerator.returns(needListener);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.listeners = [listenerMock];
    neuron.handle();

    listenerMock.handle.should.be.calledOnce;
  });

  it('should not run action handler if not allowed by ACL', () => {
    var listenerMock = {
      respondTo: sinon.stub().returns({match: true, allowed: false}),
      handle: sinon.stub().returns(Promise.resolve())
    };
    var needListener = Object.assign({}, requestMock, {
      message: {
        text: 'yolo',
        isDirect: false,
        withMention: true
      }
    });
    requestGenerator.returns(needListener);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.listeners = [listenerMock];
    neuron.handle();

    listenerMock.handle.callCount.should.be.equal(0);
  });

  it('should be able to respond if there is an error when executing action', () => {
    var errorMessage = 'Action error';
    var errorMock = new Error(errorMessage);
    var listenerMock = {
      respondTo: sinon.stub().returns({match: true, allowed: true}),
      handle: sinon.stub().returns(Promise.reject(errorMock))
    };
    var needListener = Object.assign({}, requestMock, {
      message: {
        text: 'yolo',
        isDirect: false,
        withMention: true
      }
    });
    requestGenerator.returns(needListener);
    responseGenerator.returns(responseMock);

    var neuron = new Neuron(robot);
    neuron.listeners = [listenerMock];

    // testing private method because async
    neuron._dispatchHandler(needListener, responseMock).then(() => {
      responseMock.send.should.be.calledWith({
        as_user: true,
        attachments: [
          {
            title: 'There\s an error when executing your command',
            text: `Error message: Execution error`,
            color: 'danger',
            mrkdwn_in: ['text']
          }
        ]
      });
    });
  });
});
