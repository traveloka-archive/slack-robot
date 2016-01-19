import chai from 'chai';
import { describe, it } from 'mocha';
import Listener from '../src/Listener';

chai.should();

function callback() {}

describe('Listener', () => {
  it('should store correct value', () => {
    const listener = new Listener('message', 'hi', callback);

    listener.type.should.be.equal('message');
    listener.matcher.should.be.deep.equal(/^hi$/);
    listener.callback.should.be.equal(callback);
    listener.description.should.be.equal('');
  });

  it('should be able to store description', () => {
    const listener = new Listener('message', 'hi', callback);
    const description = 'Some description message';
    listener.desc(description);

    listener.description.should.be.equal(description);
  });

  it('should be able to store acl', () => {
    const listener = new Listener('message', 'hi', callback);
    const description = 'Some description message';
    listener.desc(description);

    listener.description.should.be.equal(description);
  });

  it('should be able to store multiple acl', () => {
    const acl1 = function acl1() {};
    const acl2 = function acl2() {};
    const listener = new Listener('message', 'hi', callback)
    .acl(acl1, acl2);

    listener.acls.should.be.deep.equal([acl1, acl2]);
  });

  it('should store correct regex value', () => {
    const regex = /hi/ig;
    const listener = new Listener('message', regex, callback);
    listener.matcher.should.be.equal(regex);
  });

  it('should store correct named-param', () => {
    const listener = new Listener('message', 'hi :a([a-z]+) :b([0-9.]+)', callback);
    listener.matcher.should.be.deep.equal(/^hi ([a-z]+) ([0-9.]+)$/);
  });

  it('should store reaction differently', () => {
    const listener = new Listener('reaction_added', 'sweat_smile', callback);

    listener.type.should.be.equal('reaction_added');
    listener.matcher.should.be.deep.equal(/^sweat_smile$/);
  });

  it('should properly escape reaction', () => {
    const listener = new Listener('reaction_added', ':+1:', callback);

    listener.type.should.be.equal('reaction_added');
    listener.matcher.should.be.deep.equal(/^\+1$/);
  });

  it('should handle generic type', () => {
    const listener = new Listener('generic_type', 'jajaja', callback);

    listener.type.should.be.equal('generic_type');
    listener.matcher.should.be.deep.equal(/^jajaja$/);
  });
});
