import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildSearchDocuments, searchDocuments} from '../js/search-core.mjs';

const require = createRequire(import.meta.url);
const projector = require('../js/public-content.js');
const {projectContent, createPublicBundle, assertPublicContent, assertPublicBundle, isPublished} = projector;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
const source = {
  articles: read('data/articles.json'),
  products: read('data/products.json'),
  categories: read('data/categories.json'),
  siteCopy: read('data/site-copy.json'),
  monetization: read('data/monetization.json'),
  searchAliases: read('data/search-aliases.json')
};
function freezeDeep(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}
const sourceBefore = JSON.stringify(source);
freezeDeep(source);
const output = projectContent(source);
const bundle = createPublicBundle(source);
assert.equal(JSON.stringify(source), sourceBefore, 'projecting must leave full authoring records untouched');
assert.equal(output.articles.length, source.articles.filter(item => item.draft === false && item.hidden !== true).length);
assert.equal(output.products.length, source.products.filter(item => item.draft === false && item.hidden !== true).length);
assert.deepEqual(bundle.articles, output.articles, 'JSON and bundle articles must share one projection');
assert.deepEqual(bundle.products, output.products, 'JSON and bundle products must share one projection');
for (const key of ['categories', 'siteCopy', 'monetization']) {
  assert.deepEqual(bundle[key], source[key], `current ${key} values must be preserved`);
  assert.notEqual(bundle[key], source[key], `${key} must be cloned, not shared`);
}
assertPublicContent(output);
assertPublicBundle(bundle);
assert.deepEqual(projectContent(output), output, 'projection must be idempotent');
assert.deepEqual(createPublicBundle(bundle), bundle, 'bundle projection must be idempotent');
for (const kind of ['articles', 'products']) {
  for (const item of output[kind]) {
    const original = source[kind].find(record => record.id === item.id);
    for (const [key, value] of Object.entries(item)) {
      if (['draft', 'hidden', 'searchAliases', 'relatedProductIds', 'relatedArticleSlugs'].includes(key)) continue;
      // Nested projections are checked separately with hostile fixtures below.
      if (value === null || typeof value !== 'object') assert.deepEqual(value, original[key], `${kind}.${item.id}.${key} changed`);
    }
    assert.equal(item.draft, false);
    assert.equal(item.hidden, false);
  }
}

const article = overrides => ({
  id: 'public-article', slug: 'public-article', draft: false, hidden: false,
  title: 'Public article', body: [{type: 'paragraph', text: 'Public prose'}], tags: ['public'],
  relatedProductIds: ['public-product', 'private-product', 'missing-product'],
  ...overrides
});
const product = overrides => ({
  id: 'public-product', slug: 'public-product', draft: false, hidden: false,
  name: 'Public product', tags: ['public'], relatedArticleSlugs: ['public-article', 'private-article', 'missing-article'],
  ...overrides
});
const SENTINEL = 'PRIVATE_EDITORIAL_SENTINEL';
const hostile = {
  articles: [article({
    personalNotes: SENTINEL,
    contentId: SENTINEL,
    primaryKeyword: SENTINEL,
    secondaryKeywords: [SENTINEL],
    searchHelp: {koreanTerms: [SENTINEL], romanizedTerms: [SENTINEL], soundAlikeTerms: [SENTINEL], descriptionSearches: [SENTINEL], heading: SENTINEL},
    languageBonus: {approved: true, korean: SENTINEL, explanation: SENTINEL},
    searchAliases: ['explicit alias', 'explicit alias'], aliases: ['another public alias'],
    languageGuide: {koreanName: '공개', pronunciation: 'gonggae', literalMeaning: 'public', naturalEnglish: 'Public', notes: SENTINEL, parts: [{korean: '공개', romanization: 'gonggae', meaning: 'public', private: SENTINEL}]},
    sources: [{label: 'Public source', url: 'https://example.com/reference', notes: SENTINEL}],
    body: [
      {type: 'paragraph', text: 'Public prose', notes: SENTINEL},
      {type: 'heading', text: 'Public heading', metadata: {notes: SENTINEL}},
      {type: 'quote', text: 'Public quote', attributionNotes: SENTINEL},
      {type: 'list', items: ['Public item'], private: SENTINEL},
      {type: 'definition-list', items: [{term: 'Public term', description: 'Public description', notes: SENTINEL}]},
      {type: 'image', src: 'public-image.png', alt: 'Public image', caption: 'Public caption', width: 1200, height: 800, rightsNotes: SENTINEL},
      {type: 'ad-break', slot: 'article-mid', planning: SENTINEL}
    ]
  }), article({id: 'private-article', slug: 'private-article', draft: true, body: SENTINEL}), article({id: 'hidden-article', slug: 'hidden-article', hidden: true, title: SENTINEL}), {id: 'missing-flag', slug: 'missing-flag', title: SENTINEL}],
  products: [product({
    personalUseNotes: SENTINEL, modelEvidence: SENTINEL, sourceUrls: [SENTINEL], safetyNotes: SENTINEL,
    publicImageStatus: SENTINEL, linkLastCheckedAt: SENTINEL, relatedArticleIds: [SENTINEL],
    amazonUrl: 'https://example.com/public-purchase',
    images: [{src: 'public-product.png', alt: 'Public product', caption: 'Public caption', width: 100, height: 100, notes: SENTINEL}]
  }), product({id: 'private-product', slug: 'private-product', draft: true, name: SENTINEL}), product({id: 'hidden-product', slug: 'hidden-product', hidden: true, name: SENTINEL}), {id: 'missing-product-flag', slug: 'missing-product-flag', name: SENTINEL}],
  searchAliases: {articles: {'public-article': ['external public alias', 'explicit alias'], 'private-article': [SENTINEL], 'hidden-article': [SENTINEL], 'missing-flag': [SENTINEL], orphan: [SENTINEL]}, products: {'public-product': ['public product alias'], 'private-product': [SENTINEL]}},
  categories: {categories: [{key: 'public', label: 'Public', internalNotes: SENTINEL}], internalNotes: SENTINEL},
  siteCopy: {hero: {title: 'Public title', notes: ['Public display note'], internalNotes: SENTINEL}, navigation: [{label: 'Public nav', href: 'public.html', internalNotes: SENTINEL, children: [{label: 'Child', href: 'child.html', internalNotes: SENTINEL}]}], internalNotes: SENTINEL},
  monetization: {adsense: {publisherId: '', connectionEnabled: false, secret: SENTINEL, slots: {'article-mid': '123', notes: SENTINEL}}, internalNotes: SENTINEL},
  internalNotes: SENTINEL
};
const hostileBefore = JSON.stringify(hostile);
freezeDeep(hostile);
const clean = projectContent(hostile);
const cleanBundle = createPublicBundle(hostile);
assert.equal(JSON.stringify(hostile), hostileBefore);
assert.equal(clean.articles.length, 1);
assert.equal(clean.products.length, 1);
assert.equal(JSON.stringify(clean).includes(SENTINEL), false, 'private authoring metadata must never become public aliases or content');
assert.equal(JSON.stringify(cleanBundle).includes(SENTINEL), false, 'nested config metadata must not leak through bundles');
assert.deepEqual(clean.articles[0].relatedProductIds, ['public-product']);
assert.deepEqual(clean.products[0].relatedArticleSlugs, ['public-article']);
assert.deepEqual(clean.articles[0].searchAliases, ['explicit alias', 'another public alias', 'external public alias']);
assert.deepEqual(Object.keys(clean.searchAliases.articles), ['public-article']);
assert.deepEqual(Object.keys(clean.searchAliases.products), ['public-product']);
assert.equal(clean.products[0].amazonUrl, 'https://example.com/public-purchase', 'static build fallback compatibility');
assert.deepEqual(clean.articles[0].body[4].items, [{term: 'Public term', description: 'Public description'}]);
assert.deepEqual(clean.articles[0].sources, [{label: 'Public source', url: 'https://example.com/reference'}]);
assertPublicContent(clean);
assertPublicBundle(cleanBundle);
assert.deepEqual(projectContent(clean), clean);

assert.equal(isPublished({}), false);
assert.equal(isPublished({draft: true}), false);
assert.equal(isPublished({draft: false}), true);
assert.equal(isPublished({draft: false, hidden: true}), false);
for (const flag of ['draft', 'hidden']) {
  for (const value of [null, undefined, 0, 1, 'false', 'true', {}, []]) {
    assert.throws(() => projectContent({articles: [article({[flag]: value})]}), /expected a boolean/);
    assert.throws(() => projectContent({products: [product({[flag]: value})]}), /expected a boolean/);
  }
}
for (const value of [null, 'false', [], 4]) assert.throws(() => isPublished(value), /expected an object/);
assert.throws(() => projectContent({articles: [article({body: [{type: 'list', items: [{text: 'text', notes: SENTINEL}]}]})]}), /expected a string/);
assert.throws(() => projectContent({articles: [article({title: {text: 'text', notes: SENTINEL}})]}), /expected a string/);
assert.throws(() => projectContent({articles: [article({body: [{type: 'internal-note', text: SENTINEL}]})]}), /unsupported body block/);
assert.throws(() => projectContent({articles: [article({heroImageWidth: Infinity})]}), /finite number/);
assert.throws(() => projectContent({articles: [article(), article()]}), /duplicate/);
assert.throws(() => projectContent({products: [product(), product()]}), /duplicate/);
assert.throws(() => projectContent({articles: [article({slug: '../private'})]}), /kebab-case/);
assert.throws(() => assertPublicContent({articles: [article({notes: SENTINEL})], products: []}), /non-public fields/);
assert.throws(() => assertPublicContent({articles: [article({draft: true})], products: []}), /unpublished/);
assert.throws(() => assertPublicContent({articles: [article({draft: false, hidden: true})], products: []}), /unpublished/);
assert.throws(() => assertPublicBundle({...cleanBundle, private: SENTINEL}), /canonical/);
const tampered = clone(clean);
tampered.articles[0].body[0].notes = SENTINEL;
assert.throws(() => assertPublicContent(tampered), /non-public fields/);
const staleAliases = clone(clean);
staleAliases.searchAliases.articles['private-article'] = ['private'];
assert.throws(() => assertPublicContent(staleAliases), /uncompiled aliases/);
const mismatch = clone(cleanBundle);
mismatch.articles[0].relatedProductIds.push('private-product');
assert.throws(() => assertPublicBundle(mismatch), /canonical/);
const safeConstructor = projectContent({articles: [article({id: 'constructor', slug: 'constructor', aliases: ['public']})]});
assert.equal(Object.hasOwn(safeConstructor.searchAliases.articles, 'constructor'), true);
assert.deepEqual(safeConstructor.searchAliases.articles.constructor, ['public']);
assert.equal(Object.getPrototypeOf(safeConstructor.searchAliases.articles), Object.prototype);

// Public source references, metadata, and existing alias discovery survive the projection.
const originalDocuments = buildSearchDocuments(source);
const publicDocuments = buildSearchDocuments({...source, ...output});
assert.deepEqual(publicDocuments.map(({kind, id, title, excerpt, href, image, imageAlt, publishedAt}) => ({kind, id, title, excerpt, href, image, imageAlt, publishedAt})), originalDocuments.map(({kind, id, title, excerpt, href, image, imageAlt, publishedAt}) => ({kind, id, title, excerpt, href, image, imageAlt, publishedAt})));
for (const [kind, bucket] of Object.entries(source.searchAliases)) {
  for (const [slug, aliases] of Object.entries(bucket)) {
    const publishedItem = output[kind].find(item => item.slug === slug);
    if (!publishedItem) continue;
    for (const alias of aliases) {
      assert.ok(searchDocuments(publicDocuments, alias).some(item => item.kind === (kind === 'articles' ? 'article' : 'product') && item.id === publishedItem.id), `lost searchable public alias: ${slug}: ${alias}`);
    }
  }
}
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'js/public-content.js'), 'utf8'), context);
assert.equal(typeof context.CTKPublicContent.projectContent, 'function', 'browser UMD global is available without Node');
const browserOutput = context.CTKPublicContent.projectContent(clone(hostile));
assert.deepEqual(JSON.parse(JSON.stringify(browserOutput)), clean, 'browser and Node projections are identical');

const sourceOption = process.argv.indexOf('--source');
const privateMasterPath = sourceOption >= 0 ? process.argv[sourceOption + 1] : process.env.CTK_TEST_MASTER_SOURCE;
if (sourceOption >= 0 && !privateMasterPath) throw new Error('--source requires a private master path');
if (privateMasterPath) {
  const bytesBefore = fs.readFileSync(privateMasterPath);
  const master = JSON.parse(bytesBefore.toString('utf8'));
  const masterBefore = JSON.stringify(master);
  freezeDeep(master);
  const masterPublic = projectContent(master);
  const masterBundle = createPublicBundle(master);
  assertPublicContent(masterPublic);
  assertPublicBundle(masterBundle);
  assert.deepEqual(masterBundle.articles, masterPublic.articles);
  assert.deepEqual(masterBundle.products, masterPublic.products);
  assert.equal(JSON.stringify(master), masterBefore, 'private master object changed');
  assert.deepEqual(fs.readFileSync(privateMasterPath), bytesBefore, 'private master file changed');
  for (const key of ['categories', 'siteCopy', 'monetization']) assert.deepEqual(masterBundle[key], master[key], `private master ${key} must be preserved`);
  console.log(`PASS: private master remains byte-for-byte unchanged; ${master.articles.length} articles / ${master.products.length} products retained in source.`);
}

console.log(`PASS: ${output.articles.length} public articles / ${output.products.length} public products; untouched source and public configs; recursive allowlists; explicit flags; private keyword exclusion; relation/alias pruning; bundle equality; search compatibility; browser/Node parity.`);
