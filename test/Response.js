import chai from 'chai';
import { describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import nock from 'nock';
import fs from 'fs';
import Response from '../src/Response';

chai.use(sinonChai);
chai.should();

const token = 'xxxx-yyyyyyyyy-zzzz';
const apiMock = {
  chat: {
    postMessage: sinon.stub()
  },
  reactions: {
    add: sinon.stub()
  },
  dm: {
    open: sinon.stub()
  },
  mpim: {
    open: sinon.stub()
  },
  _token: 'xxxx'
};

const dataStoreMock = {
  getDMById: sinon.stub(),
  getChannelOrGroupByName: sinon.stub(),
  getUserByName: sinon.stub()
};

const requestMock = {
  to: {
    id: 'D123124'
  },
  message: {
    timestamp: '12412313.00012'
  }
};

describe('Response', () => {
  it('should initialize correct value', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    res._api._token.should.be.equal(token);
    res._api._requestQueue.concurrency.should.be.equal(1);
    res._queue.concurrency.should.be.equal(1);
  });

  it('should create queue with correct concurrency', () => {
    const res = new Response(token, dataStoreMock, requestMock, 5);
    res._api._requestQueue.concurrency.should.be.equal(5);
    res._queue.concurrency.should.be.equal(5);
  });

  it('should store default target and message timestamp', () => {
    const res = new Response(token, dataStoreMock, requestMock, 5);
    res._defaultTarget.should.be.equal(requestMock.to.id);
    res._messageTimestamp.should.be.equal(requestMock.message.timestamp);
  });

  it('should queue text task without running it', () => {
    const res = new Response(token, dataStoreMock, requestMock, 5);
    res.text('yolo');

    res._queue.paused.should.be.equal(true);
    res._queue.length().should.be.equal(1);
    res._queue.tasks[0].data.should.deep.equal({
      target: requestMock.to.id,
      type: 'text',
      value: 'yolo'
    });
  });

  it('should queue attachment task without running it', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    res.attachment('superb', {});

    res._queue.paused.should.be.equal(true);
    res._queue.length().should.be.equal(1);
    res._queue.tasks[0].data.should.deep.equal({
      target: requestMock.to.id,
      type: 'attachments',
      value: {
        text: 'superb',
        attachments: [{}]
      }
    });
  });

  it('should allow array of attachment in res.attachment()', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    res.attachment('hello', [
      { a: 'b' }, { c: 'd' }, { e: 'f' }
    ]);

    res._queue.length().should.be.equal(1);
    res._queue.tasks[0].data.should.deep.equal({
      target: requestMock.to.id,
      type: 'attachments',
      value: {
        text: 'hello',
        attachments: [
          { a: 'b' },
          { c: 'd' },
          { e: 'f' }
        ]
      }
    });
  });

  it('should allow sending attachment without text', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    res.attachment({ key: 'value' });

    res._queue.length().should.be.equal(1);
    res._queue.tasks[0].data.should.deep.equal({
      target: requestMock.to.id,
      type: 'attachments',
      value: {
        text: undefined,
        attachments: [
          { key: 'value' }
        ]
      }
    });
  });

  it('should queue upload task without running it', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    res.upload('a.txt', 'aaa');

    res._queue.paused.should.be.equal(true);
    res._queue.length().should.be.equal(1);
    res._queue.tasks[0].data.should.deep.equal({
      target: requestMock.to.id,
      type: 'file',
      value: {
        filename: 'a.txt',
        content: 'aaa'
      }
    });
  });

  it('should queue reaction task without running it', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    res.reaction(':+1:');

    res._queue.paused.should.be.equal(true);
    res._queue.length().should.be.equal(1);
    res._queue.tasks[0].data.should.deep.equal({
      target: requestMock.to.id,
      type: 'reaction',
      value: {
        emoji: '+1',
        channel: requestMock.to.id,
        timestamp: requestMock.message.timestamp
      }
    });
  });

  it('should add text task as many as targets', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    res.text('yolo', 'D1234', 'C2345');

    res._queue.length().should.be.equal(2);
    res._queue.tasks[0].data.should.deep.equal({
      target: 'D1234',
      type: 'text',
      value: 'yolo'
    });
    res._queue.tasks[1].data.should.deep.equal({
      target: 'C2345',
      type: 'text',
      value: 'yolo'
    });
  });

  it('should add attachment task as many as targets', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    res.attachment('hello', {}, 'C13552', 'G27924');

    res._queue.length().should.be.equal(2);
    res._queue.tasks[0].data.should.deep.equal({
      target: 'C13552',
      type: 'attachments',
      value: {
        text: 'hello',
        attachments: [{}]
      }
    });
    res._queue.tasks[1].data.should.deep.equal({
      target: 'G27924',
      type: 'attachments',
      value: {
        text: 'hello',
        attachments: [{}]
      }
    });
  });

  it('should add file task as many as targets', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    res.upload('snippet.txt', 'snippet', 'C13552', 'G27924');

    res._queue.length().should.be.equal(2);
    res._queue.tasks[0].data.should.deep.equal({
      target: 'C13552',
      type: 'file',
      value: {
        filename: 'snippet.txt',
        content: 'snippet'
      }
    });
    res._queue.tasks[1].data.should.deep.equal({
      target: 'G27924',
      type: 'file',
      value: {
        filename: 'snippet.txt',
        content: 'snippet'
      }
    });
  });

  it('should filter unknown target', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    res.upload('snippet.txt', 'snippet', 'C13552', '@unknown');

    res._queue.length().should.be.equal(1);
    res._queue.tasks[0].data.should.deep.equal({
      target: 'C13552',
      type: 'file',
      value: {
        filename: 'snippet.txt',
        content: 'snippet'
      }
    });
  });

  it('allow single entry to be passed in optTargets', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    res.text('hello', 'D1234');

    res._queue.length().should.be.equal(1);
    res._queue.tasks[0].data.should.deep.equal({
      target: 'D1234',
      type: 'text',
      value: 'hello'
    });
  });

  it('allow channel name (not id) to be passed in optTargets', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    const channelMock = {
      id: 'C557445',
      name: 'general'
    };

    dataStoreMock.getChannelOrGroupByName.withArgs('#general').returns(channelMock);

    res.text('hello', '#general');
    res._queue.length().should.be.equal(1);
    res._queue.tasks[0].data.should.deep.equal({
      target: 'C557445',
      type: 'text',
      value: 'hello'
    });
  });

  it('allow username (not id) to be passed in optTargets', () => {
    const res = new Response(token, dataStoreMock, requestMock);
    const userMock = {
      id: 'U269430',
      name: 'anon'
    };

    dataStoreMock.getUserByName.withArgs('anon').returns(userMock);

    res.text('hello', '@anon');
    res._queue.length().should.be.equal(1);
    res._queue.tasks[0].data.should.deep.equal({
      target: 'user__U269430',
      type: 'text',
      value: 'hello'
    });
  });

  it('should flush queue when .send() is called', done => {
    const res = new Response(token, dataStoreMock, requestMock, 5);

    res._api = apiMock;
    apiMock.chat.postMessage.callsArgWith(3, null, {});
    apiMock.reactions.add.callsArgWith(2, null, {});

    res.text('hello');
    res.attachment([{}], 'C124542');
    res.reaction(':grinning:');

    res.send().then(() => {
      res._queue.length().should.be.equal(0);
      done();
    });
  });

  it('should open dm first when sending to username', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const dmOpenApiMock = {
      ok: true,
      channel: {
        id: 'D532512'
      }
    };

    const spy = sinon.spy(Response.prototype, '_sendResponse');

    res._api = apiMock;
    dataStoreMock.getUserByName.withArgs('daendels').returns({ id: 'U532122' });
    apiMock.dm.open.callsArgWith(1, null, dmOpenApiMock);
    apiMock.chat.postMessage.callsArgWith(3, null, {});

    res.text('try dm', '@daendels').send().then(() => {
      const fixedTask = {
        type: 'text',
        target: dmOpenApiMock.channel.id,
        value: 'try dm'
      };

      spy.calledWith(fixedTask).should.be.equal(true);
    })
    .finally(() => {
      spy.restore();
      done();
    });
  });

  it('should open mpim first when sending to multi-party direct message', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const mpimOpenApiMock = {
      ok: true,
      group: {
        id: 'G532512'
      }
    };

    const spy = sinon.spy(Response.prototype, '_sendResponse');

    res._api = apiMock;
    dataStoreMock.getUserByName.withArgs('daendels').returns({ id: 'U532122' });
    dataStoreMock.getDMById.withArgs('D123124').returns({ user: 'U124523' });
    apiMock.mpim.open.callsArgWith(1, null, mpimOpenApiMock);
    apiMock.chat.postMessage.callsArgWith(3, null, {});

    res.text('try mpim', [
      '@daendels',
      'U41452',
      '@unknown_user',
      'D_invalidDM',
      'C52321',
      'D123124'
    ]);

    res.send().then(() => {
      const fixedTask = {
        type: 'text',
        target: mpimOpenApiMock.group.id,
        value: 'try mpim'
      };

      spy.calledWith(fixedTask).should.be.equal(true);
      apiMock.mpim.open.should.be.calledWith('U532122,U41452,U124523');
    })
    .finally(() => {
      spy.restore();
      done();
    });
  });

  it('should emit error when failed to open dm (network error)', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const dmOpenApiMock = new Error('Network error');

    res._api = apiMock;
    dataStoreMock.getUserByName.withArgs('daendels').returns({ id: 'U532122' });
    apiMock.dm.open.callsArgWith(1, dmOpenApiMock);

    res.on('task_error', err => {
      err.should.be.equal(dmOpenApiMock);
      done();
    });

    res.text('try dm', '@daendels').send();
  });

  it('should emit error when failed to open dm (failed api)', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const errorMessage = 'not_authed';
    const dmOpenApiMock = {
      ok: false,
      error: errorMessage
    };

    res._api = apiMock;
    dataStoreMock.getUserByName.withArgs('daendels').returns({ id: 'U532122' });
    apiMock.dm.open.callsArgWith(1, null, dmOpenApiMock);

    res.on('task_error', err => {
      err.message.should.be.equal(errorMessage);
      done();
    });

    res.text('try dm', '@daendels').send();
  });

  it('should emit error when failed to open mpim (network error)', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const dmOpenApiMock = new Error('Network error');

    res._api = apiMock;
    dataStoreMock.getUserByName.withArgs('daendels').returns({ id: 'U532122' });
    apiMock.mpim.open.callsArgWith(1, dmOpenApiMock);

    res.on('task_error', err => {
      err.should.be.equal(dmOpenApiMock);
      done();
    });

    res.text('try error mpim', ['@daendels']).send();
  });

  it('should emit error when failed to open mpim (failed api)', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const errorMessage = 'not_authed';
    const dmOpenApiMock = {
      ok: false,
      error: errorMessage
    };

    res._api = apiMock;
    dataStoreMock.getUserByName.withArgs('daendels').returns({ id: 'U532122' });
    apiMock.mpim.open.callsArgWith(1, null, dmOpenApiMock);

    res.on('task_error', err => {
      err.message.should.be.equal(errorMessage);
      done();
    });

    res.text('try error mpim', ['@daendels']).send();
  });

  it('should emit error if failed sending task', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const errorMock = new Error('failed to post message');

    res._api = apiMock;
    apiMock.chat.postMessage.callsArgWith(3, errorMock);

    res.on('task_error', err => {
      err.should.be.equal(errorMock);
      done();
    });

    res.text('hello').send().then(() => {
      res._queue.length().should.be.equal(0);
    });
  });

  it('should emit error if failed sending attachment', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const errorMock = new Error('failed to post attachment');

    res._api = apiMock;
    apiMock.chat.postMessage.callsArgWith(3, errorMock);

    res.on('task_error', err => {
      err.should.be.equal(errorMock);
      done();
    });

    res.attachment('hello', {}).send().then(() => {
      res._queue.length().should.be.equal(0);
    });
  });

  it('should emit error if failed sending reaction', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const errorMock = new Error('failed to add reaction');

    res._api = apiMock;
    apiMock.reactions.add.callsArgWith(2, errorMock);

    res.on('task_error', err => {
      err.should.be.equal(errorMock);
      done();
    });

    res.reaction(':+1:').send().then(() => {
      res._queue.length().should.be.equal(0);
    });
  });

  it('should not handle unknown task type', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const unknownTask = {
      type: '???',
      target: '???',
      value: '???'
    };

    res.on('task_finished', (task, data) => {
      task.should.be.deep.equal(unknownTask);
      data.should.be.deep.equal({ message: `Unknown task type ${unknownTask.type}` });
      done();
    });

    // directly add to queue
    res._addToQueue(unknownTask);
    res.send();
  });

  it('should be able to send file', done => {
    const res = new Response(token, dataStoreMock, requestMock);

    nock('https://slack.com')
    .post('/api/files.upload')
    .reply(200, (uri, body) => {
      (body.indexOf('Content-Disposition: form-data; name="file"') === -1).should.be.equal(true);
      (body.indexOf('Content-Disposition: form-data; name="content"') > -1).should.be.equal(true);
      return {
        ok: true,
        id: 'F306471'
      };
    });

    res.upload('snippet.txt', 'xxxx').send().then(() => {
      done();
    });
  });

  it('should emit error if network error when uploading file', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const errorMessage = 'Some network error';

    nock('https://slack.com')
    .post('/api/files.upload')
    .replyWithError(errorMessage);

    res.upload('snippet.txt', 'xxxx').send();

    res.on('task_error', err => {
      err.message.should.be.equal(errorMessage);
      done();
    });
  });

  it('should emit error if files.upload api failed', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const errorMessage = 'not_authed';

    nock('https://slack.com')
    .post('/api/files.upload')
    .reply(200, {
      ok: false,
      error: errorMessage
    });

    res.upload('snippet.txt', 'xxxx').send();

    res.on('task_error', err => {
      err.message.should.be.equal(errorMessage);
      done();
    });
  });

  it('should allow use file opts when using readable stream', done => {
    const res = new Response(token, dataStoreMock, requestMock);

    nock('https://slack.com')
    .post('/api/files.upload')
    .reply((uri, body) => {
      // HACK sending png gives us binary, we can't check Content-Disposition header
      // TODO find a way to check when the "file" field is sent
      (body.indexOf('Content-Disposition: form-data; name="content"') === -1).should.be.equal(true);
      done();
    });

    res.upload('Response.js', fs.createReadStream('test/fixtures/img.png')).send();
  });

  it('should be able to wrap async task', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    res._api = apiMock;

    res.async(end => {
      // simulate async task
      setTimeout(() => {
        res.text('hello');
        res.text('world');
        end();
      }, 0);
    })
    .then(() => {
      apiMock.chat.postMessage.callsArgWith(3, null, {});

      res._queue.paused.should.be.equal(true);
      res._queue.length().should.be.equal(2);
      return res.send();
    })
    .then(() => {
      // all queues should be flushed already
      res._queue.length().should.be.equal(0);
      done();
    });
  });

  it('should give shortcut to end response for async wrapper', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    res._api = apiMock;

    const r = res.async(end => {
      // simulate async task
      setTimeout(() => {
        res.text('hello');
        res.text('world');
        end();
      }, 0);
    });

    r.send.should.be.instanceof(Function);
    r.send().then(() => {
      // all queues should be flushed already
      res._queue.length().should.be.equal(0);
      done();
    });
  });

  it('should give shortcut to end response for async wrapper', done => {
    const res = new Response(token, dataStoreMock, requestMock);
    const errorMock = new Error('some async error');
    res._api = apiMock;

    const r = res.async(end => {
      // simulate async task
      setTimeout(() => {
        end(errorMock);
      }, 0);
    });

    r.send().catch(err => {
      err.should.be.equal(errorMock);
      done();
    });
  });
});
