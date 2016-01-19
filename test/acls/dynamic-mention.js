/* eslint no-unused-expressions: 0 */
import chai from 'chai';
import { describe, it } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import dynamicMention from '../../src/acls/dynamic-mention';

chai.use(sinonChai);
chai.should();

describe('acls/dynamic-mention', () => {
  it('should skip mention for dm', () => {
    const next = sinon.spy();
    const req = {
      message: {
        value: {
          mentioned: false
        }
      },
      channel: {
        type: 'dm'
      }
    };
    const res = {};

    dynamicMention(req, res, next);
    next.should.be.calledOnce;
  });

  it('should need mention for group', () => {
    const next = sinon.spy();
    const req = {
      message: {
        value: {
          mentioned: false
        }
      },
      channel: {
        type: 'group'
      }
    };
    const res = {};

    dynamicMention(req, res, next);
    next.should.notCalled;
  });

  it('should need mention for channel', () => {
    const next = sinon.spy();
    const req = {
      message: {
        value: {
          mentioned: false
        }
      },
      channel: {
        type: 'channel'
      }
    };
    const res = {};

    dynamicMention(req, res, next);
    next.should.notCalled;
  });

  it('should respond if mentioned in group', () => {
    const next = sinon.spy();
    const req = {
      message: {
        value: {
          mentioned: true
        }
      },
      channel: {
        type: 'group'
      }
    };
    const res = {};

    dynamicMention(req, res, next);
    next.should.be.calledOnce;
  });

  it('should respond if mentioned in channel', () => {
    const next = sinon.spy();
    const req = {
      message: {
        value: {
          mentioned: true
        }
      },
      channel: {
        type: 'channel'
      }
    };
    const res = {};

    dynamicMention(req, res, next);
    next.should.be.calledOnce;
  });
});
