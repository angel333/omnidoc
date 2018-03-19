const fs = require('mz/fs'); // promisified fs
const path = require('path');
const crypto = require('crypto');

const R = require('ramda');
const fg = require('fast-glob');
const matter = require('gray-matter');
const toml = require('toml');
const marked = require('marked');

module.exports = {
  parseDirectory,
  mergeCatalogs,
  docInherit,
  docParseMacros,
  docParseMarkdown,
  docResolvePaths,
  resolvePathExpression,
  parseFile,
  markdownFrontMatterParse,
};

/**
 * Parses a directory and returns resulting catalog.
 *
 * The following extensions are parsed: md, markdown, json, toml.
 *
 * @param {string} dirPath Path do the directory to be parsed.
 * @param {string} docClass Document class filter.
 * @param {Object} config Configuration.
 * @return {Promise} A promise on a catalog (object)
 */
function parseDirectory(dirPath, docClass, config = {}) {
  return fg(`**/*.${docClass}.[md|markdown|json|toml]`, { cwd: dirPath, absolute: true })
    .then(R.map(parseFile))
    .then(R.reduce(mergeCatalogs, {}))
    .then(R.map(docParseMacros))
    .then(R.map(doc => docParseMarkdown(doc, config.markdownFields || [])));
}

/**
 * Merges two catalogs while ensuring no fields are conflicting.
 *
 * Note that documents can clash. Fields cannot.
 *
 * @param {...Object} catalogs Catalogs of documents
 */
function mergeCatalogs(...catalogs) {
  return catalogs.reduce(
    (cat1, cat2) => {
      const resultingCatalog = cat1;

      // Walk through documents in cat2 and add them to resultingCatalog (cat1).
      R.forEachObjIndexed((doc, docId) => {
        // Make it so that both catalogs have the document.
        if (!R.has(docId, resultingCatalog)) resultingCatalog[docId] = {};

        // Check if there are conflicts.
        const conflicts = R.intersection(R.keys(resultingCatalog[docId]), R.keys(cat2[docId]));
        if (conflicts.length > 0) {
          throw new Error('ERROR: Found document conflicts! ' +
          `ID: ${docId}; conflicts: ${R.join(', ', conflicts)}.`);
        }
        // No conflicts, let's merge the documents.
        resultingCatalog[docId] = R.merge(resultingCatalog[docId], cat2[docId]);
      }, cat2);

      return resultingCatalog;
    },
    {},
    catalogs
  );
}

/**
 * Inherits from another document
 *
 * @param {Object} doc Document.
 * @param {Object} ancestor Document from which to inherit.
 */
function docInherit(doc, ancestor) {
  let data = R.merge(ancestor, doc);

  data = R.mapObjIndexed((field, key) => {
    // We're only interested in arrays
    if (!(field instanceof Array)) return field;
    return R.reduce(
      (acc, item) => ('^' === item ? R.concat(acc, ancestor[key]) : R.append(item, acc)),
      [], field
    );
  }, data);

  return data;
}

/**
 * Parses macros in a document
 *
 * Macro is a field named '$...'. All such fields are removed form the
 * document and are used as macros. Whenever macro name is used in any
 * other field, it will be replaced by the macro value.
 *
 * E.g. this document:
 *
 *   { title: 'Hello $X!', $X: 'world'}
 *
 * becomes this document:
 *
 *   { title: 'Hello world!' }
 *
 * For more information, check the tests.
 *
 * @param {Object} doc Document
 */
function docParseMacros(doc) {
  // Macro tuples - [search, replace]
  const macros = R.toPairs(R.pickBy((val, key) => R.test(/^\$/, key), doc));
  const docWithoutMacros = R.omit(R.pluck(0, macros), doc);

  return R.map((field) => {
    if ('string' !== typeof field) return field;
    return R.reduce(
      (str, macro) => R.replace(macro[0], macro[1], str),
      field,
      macros
    );
  }, docWithoutMacros);
}

/**
 * Parses specified fields through the Markdown parser.
 *
 * @param {Object} doc Document
 * @param {Array<string>} fields Only fields specified here are parsed.
 */
function docParseMarkdown(doc, fields) {
  return R.merge(doc, R.map(marked, R.pickAll(fields, doc)));
}

/**
 * Resolves file paths in a document into file contents or hashes
 *
 * - If a field is an array, it resolves each of its items.
 * - If a field is NOT an array and glob matches multiple files, this
 *   function will throw an error.
 *
 * Glob matching is supported.
 *
 * What is resolved:
 * - '@...' resolves to contents of matched files.
 * - '#...' resolves to hashes of contents of matched files.
 * - '@@...' resolves to '@...' (escaping)
 * - '##...' resolves to '#...' (escaping)
 *
 * Note that only if '@' or '#' is the first character, it needs to be escaped.
 *
 * See tests for more info.
 *
 * @param {Object} doc Document to be parsed
 * @param {string} dir Base directory of the files
 */
function docResolvePaths(doc, dir) {
  return R.map((field) => {
    // Field contains an array with possibly multiple expressions.
    if (field instanceof Array) {
      return R.reduce(
        (acc, item) => R.concat(acc, resolvePathExpression(item, dir)),
        [],
        field
      );
    }
    // Field is just a single string, possibly an expression.
    if ('string' === typeof field) {
      const resolved = resolvePathExpression(field, dir);
      if (0 === resolved.length) return '';
      if (resolved.length > 1) {
        throw new Error('Expression matched multiple files.');
      }
      return resolved[0];
    }
    // Any other type (number, ...)
    return field;
  }, doc);
}

/**
 * Resolves a file path expression.
 *
 * See docResolvePaths() and tests for more info.
 *
 * @param {string} expr Expression
 * @param {string} dir Base directory of the files
 * @returns {Array} Absolute file paths
 */
function resolvePathExpression(expr, dir) {
  if (R.test(/^@@/, expr)) return [R.replace(/^@@/, '@', expr)]; // escaped @
  if (R.test(/^##/, expr)) return [R.replace(/^##/, '#', expr)]; // escaped #
  if (R.test(/^@[^@]/, expr)) { // @ but not @@
    const glob = R.replace(/^@/, '', expr);
    const filePaths = fg.sync(glob, { cwd: dir, absolute: true });
    return R.map(R.curry(fs.readFileSync)(R.__, 'utf8'), filePaths);
  }
  if (R.test(/^#[^#]/, expr)) { // # but not ##
    const glob = R.replace(/^#/, '', expr);
    const filePaths = fg.sync(glob, { cwd: dir, absolute: true });
    return R.map((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const hash = crypto.createHash('sha1');
      hash.update(content);
      return hash.digest('hex');
    }, filePaths);
  }
  return [expr];
}

/**
 * Parses a file into a product object, resolving the following:
 *
 * - resolving the '@' character (files)
 * - resolving the '^' character (mergin arrays with defaults)
 *
 *  Note: Markdown itself isn't parsed because there might be more macros.
 *
 * @param {String} filePath File path to parse
 * @return {Promise.<any>} A promise on a catalog
 */
function parseFile(filePath) {
  return fs.readFile(filePath, 'utf8')
    .then(markdownFrontMatterParse)
    .then(R.map(x => docResolvePaths(x, path.dirname(filePath))))
    .then((documents) => {
      const defaults = documents['*'] || {};
      return R.map(doc => docInherit(doc, defaults), R.omit('*', documents));
    });
}

/**
 * Returns a parsed product from a Markdown file with front matter.
 *
 * @param {string} content File content
 */
function markdownFrontMatterParse(content) {
  const parsed = matter(content, {
    excerpt: true,
    excerpt_separator: '<!---->',
    language: 'toml',
    delims: '+++',
    engines: {
      toml: toml.parse.bind(toml),
    },
  });

  const { data } = parsed;

  if ('' !== parsed.content) data['*'].short_description = parsed.excerpt;
  if ('' !== parsed.content) data['*'].description = parsed.content;
  // FIXME hardcoded

  return data;
}
