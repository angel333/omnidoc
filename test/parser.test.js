const path = require('path');

const parser = require('../lib/parser');

const dataDir = path.resolve(path.join(__dirname, 'fake_fs'));

test('docInherit', () => {
  const doc = {
    a: 'from document',
    b: 'from document',
    list: ['^', 1, 2, 3, '^', '^', 4, 5, 6, '^'],
  };
  const defaults = {
    a: 'from defaults',
    c: 'from defaults',
    list: ['a', 'b', 'c'],
  };
  const expected = {
    a: 'from document', // in doc and defaults, doc wins
    b: 'from document', // only in doc
    c: 'from defaults', // only in defaults
    list: ['a', 'b', 'c', 1, 2, 3, 'a', 'b', 'c', 'a', 'b', 'c',
      4, 5, 6, 'a', 'b', 'c'],
  };
  expect(parser.docInherit(doc, defaults)).toEqual(expected);
});

test('docResolvePaths', () => {
  /* eslint no-multi-spaces: 0 */
  const doc = {
    noop: 'asdf',
    content: ['noop', '@**/*t*.txt'], // @ loads content of the files
    hashes: ['#**/*t*.txt', 'noop'],  // @ loads content of the files
    escaped: ['@@**/*', '##**/*'],    // escaped (doubled)
    single_content: '@file_one.txt',  // no globbing
    single_hash: '#file_one.txt',     // no globbing
    noop2: 'asdf',
  };
  const expected = {
    noop: 'asdf',
    content: ['noop', 'three', 'two', 'deep three', 'deep two'],
    hashes: [
      'b802f384302cb24fbab0a44997e820bf2e8507bb',
      'ad782ecdac770fc6eb9a62e44f90873fb97fb26b',
      '3990de5925c14d8e885107e21b9f6b7cc1adb3a5',
      '7025490c0db4ad2061ce1803607c13ea4b83a606',
      'noop',
    ],
    escaped: ['@**/*', '#**/*'],
    single_content: 'one',
    single_hash: 'fe05bcdcdc4928012781a5f1a2a77cbb5398e106',
    noop2: 'asdf',
  };
  expect(parser.docResolvePaths(doc, dataDir)).toEqual(expected);
});

test('docParseMacros', () => {
  const doc = {
    text: 'x $MACRO_ONE x $MACRO_TWO',
    $MACRO_ONE: 'one',
    $MACRO_TWO: 'two',
  };
  const expected = {
    text: 'x one x two',
  };
  expect(parser.docParseMacros(doc)).toEqual(expected);
});

test('docParseMarkdown', () => {
  const doc = {
    text: '**x**',
  };
  const fields = ['text'];
  const expected = {
    text: '<p><strong>x</strong></p>\n',
  };
  expect(parser.docParseMarkdown(doc, fields)).toEqual(expected);
});
