/* One public-data boundary for browser exports and Node publishers.
 * Authoring records are never modified. Missing publication flags fail closed.
 * Keep the full authoring master outside the public repository and webroot.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CTKPublicContent = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const fail = (where, expected) => { throw new TypeError(`${where}: ${expected}`); };
  const STRING = (value, where) => typeof value === 'string' ? value : fail(where, 'expected a string');
  const BOOLEAN = (value, where) => typeof value === 'boolean' ? value : fail(where, 'expected a boolean');
  const NUMBER = (value, where) => typeof value === 'number' && Number.isFinite(value) ? value : fail(where, 'expected a finite number');
  const strings = (value, where) => array(value, where).map((item, index) => STRING(item, `${where}[${index}]`));
  const array = (value, where) => Array.isArray(value) ? value : fail(where, 'expected an array');
  const scalarFields = (names, check = STRING) => Object.fromEntries(names.split(/\s+/).filter(Boolean).map(name => [name, check]));
  function pick(value, schema, where) {
    if (!object(value)) fail(where, 'expected an object');
    const result = {};
    for (const [key, check] of Object.entries(schema)) {
      if (own(value, key)) result[key] = check(value[key], `${where}.${key}`);
    }
    return result;
  }
  const record = schema => (value, where) => pick(value, schema, where);
  const records = schema => (value, where) => array(value, where).map((item, index) => pick(item, schema, `${where}[${index}]`));

  const imageSchema = {
    ...scalarFields('src alt caption'),
    ...scalarFields('width height', NUMBER)
  };
  const languageSchema = {
    ...scalarFields('koreanName pronunciation literalMeaning naturalEnglish'),
    parts: records(scalarFields('korean romanization meaning'))
  };
  const bodySchemas = {
    paragraph: scalarFields('type text'),
    heading: scalarFields('type text'),
    quote: scalarFields('type text'),
    list: {type: STRING, items: strings},
    'definition-list': {type: STRING, items: records(scalarFields('term description'))},
    image: {type: STRING, ...imageSchema},
    'ad-break': scalarFields('type slot')
  };
  function body(value, where) {
    return array(value, where).map((block, index) => {
      const location = `${where}[${index}]`;
      if (!object(block) || typeof block.type !== 'string' || !own(bodySchemas, block.type)) fail(location, 'unsupported body block type');
      return pick(block, bodySchemas[block.type], location);
    });
  }
  function sources(value, where) {
    return array(value, where).map((item, index) => typeof item === 'string'
      ? item : pick(item, scalarFields('label url'), `${where}[${index}]`));
  }
  const sharedSearchSchema = {
    ...scalarFields('koreanName romanization'),
    searchAliases: strings,
    aliases: strings,
    languageGuide: record(languageSchema)
  };
  const articleSchema = {
    ...scalarFields('id slug title seoTitle excerpt metaDescription categoryKey categoryLabel sectionKey contentType heroImage heroImageAlt heroImageCaption cardImage publishedAt updatedAt monetizationProfile'),
    ...scalarFields('heroImageWidth heroImageHeight', NUMBER),
    featured: BOOLEAN,
    tags: strings,
    relatedProductIds: strings,
    body,
    sources,
    ...sharedSearchSchema
  };
  const productSchema = {
    ...scalarFields('id slug name summary category categoryKey image imageAlt seenInKorea usedBy whyItMatters koreanProductStatus usDifference productMatchType productMatchLabel affiliateUrl amazonUrl amazonAvailability amazonLabel cta publishedAt lastCheckedAt trendStatus trendLabel brand modelNumber'),
    ...scalarFields('personallyUsed activePurchaseCta featured newlyAdded soldOut', BOOLEAN),
    tags: strings,
    verificationStatus: strings,
    verificationLabels: strings,
    relatedArticleSlugs: strings,
    images: records(imageSchema),
    ...sharedSearchSchema
  };
  const ARTICLE_FIELDS = Object.freeze([...Object.keys(articleSchema), 'draft', 'hidden']);
  const PRODUCT_FIELDS = Object.freeze([...Object.keys(productSchema), 'draft', 'hidden']);

  function isPublished(value, where = 'record') {
    if (!object(value)) fail(where, 'expected an object');
    if (own(value, 'draft')) BOOLEAN(value.draft, `${where}.draft`);
    if (own(value, 'hidden')) BOOLEAN(value.hidden, `${where}.hidden`);
    return own(value, 'draft') && value.draft === false && value.hidden !== true;
  }
  function published(records, kind) {
    return array(records, kind).filter((value, index) => isPublished(value, `${kind}[${index}]`));
  }
  function identifiers(records, kind) {
    const ids = new Set();
    const slugs = new Set();
    records.forEach((value, index) => {
      const location = `${kind}[${index}]`;
      const id = STRING(value.id, `${location}.id`);
      const slug = STRING(value.slug, `${location}.slug`);
      if (!id.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(location, 'published records require a nonblank id and lowercase kebab-case slug');
      if (ids.has(id) || slugs.has(slug)) fail(location, 'duplicate published id or slug');
      ids.add(id);
      slugs.add(slug);
    });
    return {ids, slugs};
  }
  function compiledAliases(value, external, where) {
    const result = [];
    const add = values => {
      for (const text of values) {
        const normalized = text.trim();
        if (normalized && !result.includes(normalized)) result.push(normalized);
      }
    };
    for (const key of ['searchAliases', 'aliases']) {
      if (own(value, key)) add(strings(value[key], `${where}.${key}`));
    }
    // Editorial keywords and searchHelp stay private. Only explicit public
    // aliases enter the index; normal title/body/tags remain searchable.
    if (external !== undefined) add(strings(external, `${where}.externalSearchAliases`));
    return result;
  }
  function projectContent(source = {}) {
    if (!object(source)) fail('source', 'expected an object');
    const articles = published(source.articles === undefined ? [] : source.articles, 'articles');
    const products = published(source.products === undefined ? [] : source.products, 'products');
    const articleKeys = identifiers(articles, 'articles');
    const productKeys = identifiers(products, 'products');
    const aliases = source.searchAliases === undefined ? {} : source.searchAliases;
    if (!object(aliases)) fail('searchAliases', 'expected an object');
    for (const kind of ['articles', 'products']) {
      if (own(aliases, kind) && !object(aliases[kind])) fail(`searchAliases.${kind}`, 'expected an object');
    }
    const searchAliases = {articles: {}, products: {}};
    const project = (value, schema, kind, index) => {
      const location = `${kind}[${index}]`;
      const result = pick(value, schema, location);
      result.draft = false;
      result.hidden = false;
      const bucket = aliases[kind];
      const external = bucket && own(bucket, value.slug) ? bucket[value.slug] : undefined;
      const terms = compiledAliases(value, external, location);
      if (terms.length) {
        result.searchAliases = terms;
        // defineProperty safely supports a slug such as "constructor".
        Object.defineProperty(searchAliases[kind], value.slug, {value: terms.slice(), enumerable: true, configurable: true, writable: true});
      } else if (own(result, 'searchAliases')) {
        result.searchAliases = [];
      }
      return result;
    };
    const publicArticles = articles.map((value, index) => {
      const result = project(value, articleSchema, 'articles', index);
      if (result.relatedProductIds) result.relatedProductIds = result.relatedProductIds.filter(id => productKeys.ids.has(id));
      return result;
    });
    const publicProducts = products.map((value, index) => {
      const result = project(value, productSchema, 'products', index);
      if (result.relatedArticleSlugs) result.relatedArticleSlugs = result.relatedArticleSlugs.filter(slug => articleKeys.slugs.has(slug));
      return result;
    });
    return {articles: publicArticles, products: publicProducts, searchAliases};
  }

  // Public configuration is also projected, so adding authoring notes cannot leak
  // through a future bundle export. These are UI labels/settings, not credentials.
  const taxonomySchema = {
    ...scalarFields('key label shortLabel description uiClass href icon homeBlurb'),
    ...scalarFields('order featuredMinArticles', NUMBER),
    ...scalarFields('active showWhenEmpty', BOOLEAN)
  };
  const categoriesSchema = Object.fromEntries('categories curationFilters matchTypes verificationOptions trendStatuses editorialSections contentTypes contextConfidence monetizationProfiles'.split(' ').map(key => [key, records(taxonomySchema)]));
  const linkSchema = scalarFields('label href');
  const sectionSchema = {...scalarFields('eyebrow title description emptyTitle emptyText button loading errorTitle errorText cta text demoMessage'), paragraphs: strings};
  const siteCopySchema = {
    site: record(scalarFields('name tagline defaultTitle defaultDescription')),
    navigation: records({...linkSchema, children: records(linkSchema)}),
    hero: record({
      ...scalarFields('badge eyebrow title description image imageAlt cameraStamp'),
      primaryCta: record(linkSchema), secondaryCta: record(linkSchema), trustItems: strings, notes: strings
    }),
    ticker: strings,
    sections: record(Object.fromEntries('newlyAdded trending actuallyUsed categories productGuide guides curator disclosure newsletter'.split(' ').map(key => [key, record(sectionSchema)]))),
    productCard: record(scalarFields('detailsLabel seenLabel usedByLabel whyLabel statusLabel inactiveAffiliateText activeAffiliateText')),
    footer: record(scalarFields('shareButton copyButton'))
  };
  const monetizationSchema = {
    adsense: record({
      ...scalarFields('connectionEnabled manualAdsEnabled', BOOLEAN), publisherId: STRING,
      slots: record(scalarFields('home-mid home-lower article-mid article-late category-feed')), connectionPages: strings
    }),
    amazonAssociates: record({enabled: BOOLEAN, ...scalarFields('associateTag siteDisclosure inlineDisclosure')}),
    articleProfiles: record(Object.fromEntries(['default', 'light', 'none', 'custom'].map(key => [key, record({manualSlots: strings})])))
  };
  function createPublicBundle(source = {}) {
    const projected = projectContent(source);
    return {
      products: projected.products,
      articles: projected.articles,
      categories: pick(source.categories === undefined ? {} : source.categories, categoriesSchema, 'categories'),
      siteCopy: pick(source.siteCopy === undefined ? {} : source.siteCopy, siteCopySchema, 'siteCopy'),
      monetization: pick(source.monetization === undefined ? {} : source.monetization, monetizationSchema, 'monetization')
    };
  }
  function equal(left, right) {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => equal(value, right[index]));
    if (!object(left) || !object(right)) return false;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => own(right, key) && equal(left[key], right[key]));
  }
  function assertPublicContent(value) {
    const projected = projectContent(value);
    const expected = {articles: projected.articles, products: projected.products};
    const actual = {articles: value.articles, products: value.products};
    if (own(value, 'searchAliases')) {
      expected.searchAliases = projected.searchAliases;
      actual.searchAliases = value.searchAliases;
    }
    if (!equal(actual, expected)) throw new Error('Public content contains unpublished records, non-public fields, invalid relationships, or uncompiled aliases.');
    return true;
  }
  function assertPublicBundle(value) {
    if (!equal(value, createPublicBundle(value))) throw new Error('Public bundle is not the canonical public projection.');
    return true;
  }
  return Object.freeze({
    ARTICLE_FIELDS, PRODUCT_FIELDS, isPublished, projectContent, createPublicBundle,
    assertPublicContent, assertPublicBundle
  });
});
