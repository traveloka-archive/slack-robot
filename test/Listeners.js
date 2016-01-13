import chai from 'chai';
import { describe, it } from 'mocha';
import Listeners from '../src/Listeners';
import Listener from '../src/Listener';

const should = chai.should();

describe('Listeners', () => {
  it('should initally contain empty array', () => {
    const l = new Listeners();
    l._entries.should.be.deep.equal([]);
  });

  it('should be able to add listener', () => {
    const l = new Listeners();
    l.add('message', 'value', () => {});
    l._entries.length.should.be.equal(1);
  });

  it('should return instance of Listener', () => {
    const l = new Listeners();
    const listener = l.add('message', 'value', () => {});
    listener.should.be.instanceof(Listener);
  });

  it('should be able to find listener by id', () => {
    const l = new Listeners();
    const listener = l.add('message', 'value', () => {});
    l.get(listener.id).should.be.deep.equal(listener);
  });

  it('should return null for invalid id', () => {
    const l = new Listeners();
    should.not.exist(l.get('random'));
  });

  it('should find text message', () => {
    const l = new Listeners();
    const message = {
      type: 'message',
      value: {
        text: 'hello world'
      }
    };
    l.add('message', 'hi', () => {});
    const ml = l.add('message', 'hello :text([a-z]+)', () => {});

    l.find(message).should.be.equal(ml);
  });

  it('should find reaction message', () => {
    const l = new Listeners();
    const message = {
      type: 'reaction_added',
      value: {
        emoji: '+1'
      }
    };
    l.add('message', 'hi', () => {});
    const rl = l.add('reaction_added', ':+1:', () => {});

    l.find(message).should.be.equal(rl);
  });

  it('should return null for unknown message', () => {
    const l = new Listeners();
    const message = {
      type: 'unknown',
      value: {}
    };
    l.add('message', 'hi', () => {});
    l.add('reaction_added', ':+1:', () => {});
    should.not.exist(l.find(message));
  });
});
