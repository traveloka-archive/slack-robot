import chai from 'chai';
import { describe, it } from 'mocha';
import Request from '../src/Request';

chai.should();

describe('Request', () => {
  it('should parse Message and Listener into request', () => {
    const msg = {
      type: 'message',
      value: {
        text: 'something',
        mentioned: false
      },
      from: {
        id: 'D12321',
        name: 'anonymous'
      },
      to: {
        id: 'C21234',
        name: 'public-channel'
      },
      timestamp: '1324873.03284'
    };
    const listener = {
      value: 'something',
      matcher: /^something$/
    };

    const channel = {
      id: 'C21234',
      name: 'public-channel',
      type: 'channel'
    };

    const messageReq = {
      type: 'message',
      value: {
        text: 'something',
        mentioned: false
      },
      timestamp: '1324873.03284'
    };

    const req = new Request(msg, listener);
    req.message.should.be.deep.equal(messageReq);
    req.from.should.be.deep.equal(msg.from);
    req.to.should.be.deep.equal(channel);
    req.params.should.be.deep.equal({});
    req.matches.should.be.deep.equal([]);
    req.listener.should.be.deep.equal(listener);
  });

  it('should have hidden channel and user object', () => {
    const msg = {
      type: 'message',
      value: {
        text: 'something',
        mentioned: false
      },
      from: {
        id: 'D12321',
        name: 'anonymous'
      },
      to: {
        id: 'G21234',
        name: 'private-group'
      },
      timestamp: '1324873.03284'
    };
    const listener = {
      value: 'something',
      matcher: /^something$/
    };
    const channel = {
      id: 'G21234',
      name: 'private-group',
      type: 'group'
    };

    const req = new Request(msg, listener);
    req.user.should.be.deep.equal(msg.from);
    req.channel.should.be.deep.equal(channel);
  });

  it('should have add channel type for dm message', () => {
    const msg = {
      type: 'message',
      value: {
        text: 'something',
        mentioned: false
      },
      from: {
        id: 'D12321',
        name: 'anonymous'
      },
      to: {
        id: 'D21234',
        name: 'slackbot'
      },
      timestamp: '1324873.03284'
    };
    const listener = {
      value: 'something',
      matcher: /^something$/
    };
    const channel = {
      id: 'D21234',
      name: 'slackbot',
      type: 'dm'
    };

    const req = new Request(msg, listener);
    req.channel.should.be.deep.equal(channel);
  });

  it('should get named-params', () => {
    const msg = {
      type: 'message',
      value: {
        text: 'something you need',
        mentioned: false
      }
    };
    const listener = {
      value: 'something :target([a-z]+) need',
      matcher: /^something ([a-z]+) need$/
    };
    const params = {
      target: 'you'
    };
    const matches = [];

    const req = new Request(msg, listener);
    req.params.should.be.deep.equal(params);
    req.matches.should.be.deep.equal(matches);
  });

  it('should get array of matches', () => {
    const msg = {
      type: 'message',
      value: {
        text: 'something you need',
        mentioned: false
      }
    };
    const listener = {
      value: /something ([a-z]+) need/,
      matcher: /something ([a-z]+) need/
    };
    const params = {};
    const matches = ['you'];

    const req = new Request(msg, listener);
    req.params.should.be.deep.equal(params);
    req.matches.should.be.deep.equal(matches);
  });

  it('should not parse params and matches execpt in message', () => {
    const msg = {
      type: 'reaction_added',
      value: {
        emoji: '+1'
      }
    };
    const listener = {
      value: /something ([a-z]+) need/,
      matcher: /something ([a-z]+) need/
    };

    const req = new Request(msg, listener);
    req.params.should.be.deep.equal({});
    req.matches.should.be.deep.equal([]);
  });
});
