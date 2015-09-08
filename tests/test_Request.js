/* eslint-env mocha */
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import Request from '../src/Request';

chai.use(sinonChai);
chai.use(chaiAsPromised);
var should = chai.should();

var slack = {
  getUserByID: sinon.stub(),
  getChannelByID: sinon.stub(),
  getChannelGroupOrDMByID: sinon.stub()
};
var slackMessage = {
  text: 'Hey @fe-bot, See <@U999> in <#C999>',
  channel: 'C238EYDH',
  user: 'U233REWD',
  getChannelType: sinon.stub()
};
var robotMention = /.*@fe-bot,?:?/;
var channelInstanceMock = {id: 'C238EYDH', name: 'secret-base', postMessage: sinon.spy()};
var userInstanceMock = {id: 'U233REWD', name: 'someuser'};
var u999Mock = {id: 'U999', name: 'nein'};
var c999Mock = {id: 'C999', name: 'nei-ne'};

describe('lib/Request', () => {
  beforeEach(() => {
    slack.getUserByID.reset();
    slack.getChannelByID.reset();
    slack.getChannelGroupOrDMByID.reset();
    slackMessage.getChannelType.reset();

    slackMessage.getChannelType.returns('DM');
    slack.getUserByID.withArgs('U999').returns(u999Mock);
    slack.getChannelByID.withArgs('C999').returns(c999Mock);
  });

  it('should be able to set message object', () => {
    var expectedMessage = {
      text: 'See @nein in #nei-ne',
      isDirect: true,
      withMention: true
    };

    slack.getChannelGroupOrDMByID.withArgs(slackMessage.channel).returns(channelInstanceMock);
    slack.getUserByID.withArgs(slackMessage.user).returns(userInstanceMock);

    var req = new Request(slack, robotMention);
    req.parse(slackMessage);
    req.message.should.be.deep.equal(expectedMessage);
  });

  it('should be able to ignore extra space', () => {
    var expectedMessage = {
      text: 'See     @nein      in     #nei-ne',
      isDirect: true,
      withMention: true
    };
    var expectedResult = {
      text: 'See @nein in #nei-ne',
      isDirect: true,
      withMention: true
    };

    slack.getChannelGroupOrDMByID.withArgs(slackMessage.channel).returns(channelInstanceMock);
    slack.getUserByID.withArgs(slackMessage.user).returns(userInstanceMock);

    var req = new Request(slack, robotMention);
    req.parse(slackMessage);
    req.message.should.be.deep.equal(expectedResult);
  });

  it('should be able to set user object', () => {
    var expectedUser = {
      id: 'U233REWD',
      name: 'someuser'
    };

    slack.getChannelGroupOrDMByID.withArgs(slackMessage.channel).returns(channelInstanceMock);
    slack.getUserByID.withArgs(slackMessage.user).returns(userInstanceMock);

    var req = new Request(slack, robotMention);
    req.parse(slackMessage);
    req.user.should.be.deep.equal(expectedUser);
  });

  it('should not set user property if not found', () => {
    slack.getChannelGroupOrDMByID.withArgs(slackMessage.channel).returns(channelInstanceMock);
    slack.getUserByID.withArgs(slackMessage.user).returns(undefined);

    var req = new Request(slack, robotMention);
    req.parse(slackMessage);
    should.not.exist(req.user);
    should.exist(req.channel);
  });

  it('should be able to set channel object', () => {
    var expectedChannel = {
      id: 'C238EYDH',
      name: 'secret-base'
    };

    slack.getChannelGroupOrDMByID.withArgs(slackMessage.channel).returns(channelInstanceMock);
    slack.getUserByID.withArgs(slackMessage.user).returns(userInstanceMock);

    var req = new Request(slack, robotMention);
    req.parse(slackMessage);
    req.channel.should.be.deep.equal(expectedChannel);
  });

  it('should not set channel property if not found', () => {
    slack.getChannelGroupOrDMByID.withArgs(slackMessage.channel).returns(undefined);
    slack.getUserByID.withArgs(slackMessage.user).returns(userInstanceMock);

    var req = new Request(slack, robotMention);
    req.parse(slackMessage);
    should.exist(req.user);
    should.not.exist(req.channel);
  });

  it('should work regardless of message', () => {
    var message = Object.assign(slackMessage, {
      text: ''
    });
    slack.getChannelGroupOrDMByID.withArgs(slackMessage.channel).returns(undefined);
    slack.getUserByID.withArgs(slackMessage.user).returns(userInstanceMock);

    var req = new Request(slack, robotMention);
    req.parse(message);
    req.message.text.should.be.equal('');
  });

  it('should work using label mention', () => {
    var message = Object.assign(slackMessage, {
      text: '<@U999|@nein> <#C999|#nei-ne>'
    });
    slack.getChannelGroupOrDMByID.withArgs(slackMessage.channel).returns(undefined);
    slack.getUserByID.withArgs(slackMessage.user).returns(userInstanceMock);

    var req = new Request(slack, robotMention);
    req.parse(message);
    req.message.text.should.be.equal('@nein #nei-ne');
  });

  it('should work on link and group', () => {
    var message = Object.assign(slackMessage, {
      text: '<!group> <hahaha> <yolo|lol>'
    });
    slack.getChannelGroupOrDMByID.withArgs(slackMessage.channel).returns(undefined);
    slack.getUserByID.withArgs(slackMessage.user).returns(userInstanceMock);

    var req = new Request(slack, robotMention);
    req.parse(message);
    req.message.text.should.be.equal('@group hahaha lol(yolo)');
  });
});
