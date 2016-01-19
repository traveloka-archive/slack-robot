import chai from 'chai';
import { describe, it } from 'mocha';
import {
  stripEmoji,
  getFileExtension
} from '../src/util';

chai.should();

describe('util.stripEmoji', () => {
  it('should remove : before emoji', () => {
    stripEmoji(':grinning').should.be.equal('grinning');
    stripEmoji(':sweat_smile').should.be.equal('sweat_smile');
    stripEmoji(':+1').should.be.equal('+1');
  });

  it('should remove : after emoji', () => {
    stripEmoji('grinning:').should.be.equal('grinning');
    stripEmoji('sweat_smile:').should.be.equal('sweat_smile');
    stripEmoji('+1:').should.be.equal('+1');
  });

  it('should remove : before and after emoji', () => {
    stripEmoji(':grinning:').should.be.equal('grinning');
    stripEmoji(':sweat_smile:').should.be.equal('sweat_smile');
    stripEmoji(':+1:').should.be.equal('+1');
  });

  it('should have no effect on cleaned emoji', () => {
    stripEmoji('grinning').should.be.equal('grinning');
    stripEmoji('sweat_smile').should.be.equal('sweat_smile');
    stripEmoji('+1').should.be.equal('+1');
  });
});

describe('util.getFileExtension', () => {
  it('should get any extension', () => {
    getFileExtension('package.json').should.be.equal('json');
    getFileExtension('movie.3gp').should.be.equal('3gp');
    getFileExtension('avatar.mpeg4').should.be.equal('mpeg4');
  });

  it('should work on files with multiple dot(.)', () => {
    getFileExtension('movie.part.mp4').should.be.equal('mp4');
    getFileExtension('first.snippet.txt.zip').should.be.equal('zip');
  });
});
