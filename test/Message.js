import chai from "chai";
import sinon from "sinon";
import sinonChai from "sinon-chai";
import { describe, it } from "mocha";
import Message from "../src/Message";

chai.use(sinonChai);
const should = chai.should();

const bot = {
  name: "slackbot"
};

const dataStore = {
  getUserById: sinon.stub(),
  getChannelById: sinon.stub(),
  getChannelGroupOrDMById: sinon.stub()
};
const channelIdMock = "C2345441";
const userIdMock = "D2345441";
const channelMock = {
  id: channelIdMock,
  name: "mock-channel"
};
const userMock = {
  id: userIdMock,
  name: "mock-user"
};
const timestampMock = "14127324.00023";

dataStore.getUserById.withArgs(userIdMock).returns(userMock);
dataStore.getChannelById.withArgs(channelIdMock).returns(channelMock);
dataStore.getChannelGroupOrDMById.withArgs(channelIdMock).returns(channelMock);

describe("Message", () => {
  it("should parse text message", () => {
    const msg = {
      type: "message",
      user: userIdMock,
      channel: channelIdMock,
      text: "Hello",
      ts: timestampMock
    };
    const message = new Message(bot, dataStore, msg);
    message.type.should.be.equal("message");
    message.from.should.be.deep.equal(userMock);
    message.to.should.be.deep.equal(channelMock);
    message.timestamp.should.be.equal(timestampMock);
    message.value.should.be.deep.equal({ text: "Hello", mentioned: false });
  });

  it("should parse text with mention", () => {
    const msg = {
      type: "message",
      user: userIdMock,
      channel: channelIdMock,
      text: "Hello @slackbot",
      ts: timestampMock
    };
    const message = new Message(bot, dataStore, msg);
    message.value.should.be.deep.equal({ text: "Hello", mentioned: true });
  });

  it("should parse text with soft mention", () => {
    const msg = {
      type: "message",
      user: userIdMock,
      channel: channelIdMock,
      text: "Hello slackbot",
      ts: timestampMock
    };
    const message = new Message(bot, dataStore, msg);
    message.value.should.be.deep.equal({ text: "Hello", mentioned: true });
  });

  it("should parse reaction message", () => {
    const msg = {
      type: "reaction_added",
      user: userIdMock,
      reaction: ":grinning:",
      item: {
        channel: channelIdMock,
        ts: timestampMock
      }
    };
    const message = new Message(bot, dataStore, msg);
    message.type.should.be.equal("reaction_added");
    message.from.should.be.deep.equal(userMock);
    message.to.should.be.deep.equal(channelMock);
    message.timestamp.should.be.equal(timestampMock);
    message.value.should.be.deep.equal({ emoji: "grinning" });
  });

  it("should parse reaction message with skin tone", () => {
    const msg = {
      type: "reaction_added",
      user: userIdMock,
      reaction: ":+1::skin-tone-4:",
      item: {
        channel: channelIdMock,
        ts: timestampMock
      }
    };
    const message = new Message(bot, dataStore, msg);
    message.type.should.be.equal("reaction_added");
    message.from.should.be.deep.equal(userMock);
    message.to.should.be.deep.equal(channelMock);
    message.timestamp.should.be.equal(timestampMock);
    message.value.should.be.deep.equal({ emoji: "+1" });
  });

  it("should parse message with no channel", () => {
    const msg = {
      type: "message"
    };
    const message = new Message(bot, dataStore, msg);
    should.not.exist(message.to);
  });

  it("should remove username formatting", () => {
    const msg = {
      type: "message",
      text: "hello <@D1234|satya>"
    };
    const message = new Message(bot, dataStore, msg);
    message.value.should.be.deep.equal({
      text: "hello @satya",
      mentioned: false
    });
  });

  it("should remove channel formatting", () => {
    const msg = {
      type: "message",
      text: "in <#C1214|general>"
    };
    const message = new Message(bot, dataStore, msg);
    message.value.should.be.deep.equal({
      text: "in #general",
      mentioned: false
    });
  });

  it("should change userId to username", () => {
    const msg = {
      type: "message",
      text: "hello <@D1234>"
    };

    dataStore.getUserById.withArgs("D1234").returns({ name: "satya" });
    const message = new Message(bot, dataStore, msg);
    message.value.should.be.deep.equal({
      text: "hello @satya",
      mentioned: false
    });
  });

  it("should change channel to username", () => {
    const msg = {
      type: "message",
      text: "in <#C1214>"
    };

    dataStore.getChannelById.withArgs("C1214").returns({ name: "general" });
    const message = new Message(bot, dataStore, msg);
    message.value.should.be.deep.equal({
      text: "in #general",
      mentioned: false
    });
  });

  it("should change group mention using @", () => {
    const msg = {
      type: "message",
      text: "hi <!channel>"
    };

    const message = new Message(bot, dataStore, msg);
    message.value.should.be.deep.equal({
      text: "hi @channel",
      mentioned: false
    });
  });

  it("should format incoming link", () => {
    const msg = {
      type: "message",
      text: "check out <http://www.google.com|the world>"
    };

    const message = new Message(bot, dataStore, msg);
    message.value.should.be.deep.equal({
      text: "check out the world(http://www.google.com)",
      mentioned: false
    });
  });

  it("should strip protocol in bare link", () => {
    const msg = {
      type: "message",
      text: "check out <http://staging05.example.com>"
    };

    const message = new Message(bot, dataStore, msg);
    message.value.should.be.deep.equal({
      text: "check out staging05.example.com",
      mentioned: false
    });
  });

  it("should pass through unknown object", () => {
    const msg = {
      type: "unknown",
      text: "<@wat>"
    };

    const message = new Message(bot, dataStore, msg);
    message.value.should.be.deep.equal({});
  });

  it("should pass through unknown format", () => {
    const msg = {
      type: "message",
      text: "<@wat> @slackbot"
    };

    const message = new Message(bot, dataStore, msg);
    message.value.should.be.deep.equal({ text: "wat", mentioned: true });
  });
});
