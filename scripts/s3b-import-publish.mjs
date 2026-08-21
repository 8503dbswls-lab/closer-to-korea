import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : "";

const touchedFiles = [
  path.join(root,"data","articles.json"),
  path.join(root,"data","content-data.js"),
  path.join(root,"data","search-aliases.json"),
  path.join(root,"sitemap.xml")
];
const backupDir = path.join(root,`backup_before_S3B_html_only_${new Date().toISOString().replace(/[:.]/g,"-")}`);

function fail(message){
  console.error("\nERROR:", message);
  process.exit(1);
}
function readJson(file){
  return JSON.parse(fs.readFileSync(file,"utf8"));
}
function writeJson(file,value){
  fs.writeFileSync(file,JSON.stringify(value,null,2)+"\n","utf8");
}
function esc(value=""){
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function ymd(){
  return new Date().toISOString().slice(0,10);
}
function normalizeSearchHelp(draft){
  const s=draft.search_help || draft.searchHelp || null;
  if(!s) return null;
  return {
    heading:s.heading || "Not sure what to search for?",
    koreanTerms:[...(s.korean_terms||s.koreanTerms||[])],
    romanizedTerms:[...(s.romanized_terms||s.romanizedTerms||[])],
    soundAlikeTerms:[...(s.sound_alike_terms||s.soundAlikeTerms||[])],
    descriptionSearches:[...(s.description_searches||s.descriptionSearches||[])]
  };
}
function splitParagraphs(text){
  return String(text||"").split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
}
function siteArticleFromPayload(payload,existing=null){
  if(payload?.schema_version!=="CTK_S3A_PUBLISH_PAYLOAD_V1"){
    fail("Unsupported publish payload schema. Expected CTK_S3A_PUBLISH_PAYLOAD_V1.");
  }
  if(payload.final_decision!=="승인"){
    fail(`Publish is blocked because final_decision is "${payload.final_decision||"(empty)"}", not "승인".`);
  }
  if(!payload?.publishing_guard?.approved_for_publish_preparation){
    fail("Publishing guard does not approve this payload.");
  }

  const d=payload.article_draft;
  if(!d || typeof d!=="object") fail("article_draft is missing.");
  const seo=d.seo||{};
  const slug=String(seo.slug||d.slug||"").trim();
  if(!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail("A valid lowercase hyphenated slug is required.");
  const title=String(seo.title||d.title||"").trim();
  if(!title) fail("SEO title is missing.");

  const body=[];
  const article=d.article||{};
  for(const section of (article.sections||[])){
    if(section?.heading) body.push({type:"heading",text:String(section.heading)});
    for(const p of splitParagraphs(section?.body)){
      body.push({type:"paragraph",text:p});
    }
  }
  if(article.closing){
    body.push({type:"heading",text:"Final Takeaway"});
    for(const p of splitParagraphs(article.closing)) body.push({type:"paragraph",text:p});
  }
  if(Array.isArray(d.faq) && d.faq.length){
    body.push({
      type:"definition-list",
      items:d.faq.map(x=>({term:String(x.question||""),description:String(x.answer||"")})).filter(x=>x.term&&x.description)
    });
  }

  const searchHelp=normalizeSearchHelp(d);
  if(searchHelp){
    body.push({type:"heading",text:searchHelp.heading});
    const items=[];
    if(searchHelp.koreanTerms.length) items.push({term:"Korean",description:searchHelp.koreanTerms.join(", ")});
    if(searchHelp.romanizedTerms.length) items.push({term:"Romanized",description:searchHelp.romanizedTerms.join(", ")});
    if(searchHelp.soundAlikeTerms.length) items.push({term:"You might type",description:searchHelp.soundAlikeTerms.join(", ")});
    if(searchHelp.descriptionSearches.length) items.push({term:"Describe it",description:searchHelp.descriptionSearches.join(" · ")});
    if(items.length) body.push({type:"definition-list",items});
  }

  const tags=[...(seo.tags||[])].map(String);
  const date=ymd();

  const heroImage =
    payload?.publish_settings?.heroImage ||
    existing?.heroImage ||
    "assets/images/everyday-korea.svg";

  const heroImageAlt =
    payload?.publish_settings?.heroImageAlt ||
    existing?.heroImageAlt ||
    "Editorial illustration representing everyday life in Korea";

  const sources = [
    ...(payload?.publish_settings?.sources || existing?.sources || [])
  ];

  const requestedSourceRequirement =
    payload?.publish_settings?.sourceRequirement ||
    existing?.sourceRequirement ||
    "";

  if (
    requestedSourceRequirement === "required" &&
    !sources.length
  ) {
    fail(
      "Sources are required for this approved article, but publish_settings.sources is empty. " +
      "Return to S3A and regenerate the publish JSON after source collection."
    );
  }

  const rawLanguageBonus =
    payload?.publish_settings?.languageBonus !== undefined
      ? payload.publish_settings.languageBonus
      : (existing?.languageBonus || null);

  let languageBonus = null;

  if (
    rawLanguageBonus &&
    rawLanguageBonus.approved === true
  ) {
    const korean = String(rawLanguageBonus.korean || "").trim();
    const explanation = String(rawLanguageBonus.explanation || "").trim();

    if (!korean || !explanation) {
      fail(
        "languageBonus is marked approved, but korean/explanation is incomplete."
      );
    }

    languageBonus = {
      approved: true,
      korean,
      romanized: String(rawLanguageBonus.romanized || "").trim(),
      explanation,
      closer: String(rawLanguageBonus.closer || "").trim()
    };
  }

  return {
    id:existing?.id || slug,
    slug,
    seoTitle:title,
    metaDescription:String(seo.meta_description||seo.metaDescription||article.dek||"").trim(),
    primaryKeyword:String(seo.primary_keyword||seo.primaryKeyword||"").trim(),
    secondaryKeywords:[...(seo.secondary_keywords||seo.secondaryKeywords||[])].map(String),
    title,
    excerpt:String(article.dek||seo.meta_description||"").trim(),
    body,
    categoryKey:payload?.publish_settings?.categoryKey || existing?.categoryKey || "everyday-korea",
    categoryLabel:payload?.publish_settings?.categoryLabel || existing?.categoryLabel || "Everyday Korea",
    tags,
    heroImage,
    heroImageAlt,
    heroImageWidth:Number(payload?.publish_settings?.heroImageWidth || existing?.heroImageWidth || 1200),
    heroImageHeight:Number(payload?.publish_settings?.heroImageHeight || existing?.heroImageHeight || 760),
    relatedProductIds:[...(payload?.publish_settings?.relatedProductIds||existing?.relatedProductIds||[])],
    sources,
    publishedAt:existing?.publishedAt || date,
    updatedAt:date,
    featured:existing?.featured ?? false,
    draft:false,
    sourceRequirement:
      requestedSourceRequirement ||
      (sources.length ? "required" : "optional"),
    sectionKey:payload?.publish_settings?.sectionKey || existing?.sectionKey || "everyday-korea",
    contentType:payload?.publish_settings?.contentType || existing?.contentType || "culture-everyday",
    koreaContextConfidence:payload?.publish_settings?.koreaContextConfidence || existing?.koreaContextConfidence || "context-dependent",
    monetizationProfile:payload?.publish_settings?.monetizationProfile || existing?.monetizationProfile || "default",
    searchHelp:searchHelp || existing?.searchHelp || undefined,
    languageBonus
  };
}
function renderBody(blocks=[]){
  return blocks.map(block=>{
    if(block.type==="heading") return `<h2>${esc(block.text)}</h2>`;
    if(block.type==="list") return `<ul>${(block.items||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`;
    if(block.type==="quote") return `<blockquote>${esc(block.text)}</blockquote>`;
    if(block.type==="definition-list"){
      return `<dl class="article-definition-list">${(block.items||[]).map(x=>`<div><dt>${esc(x.term)}</dt><dd>${esc(x.description)}</dd></div>`).join("")}</dl>`;
    }
    if(block.type==="image"){
      const caption=block.caption?`<figcaption>${esc(block.caption)}</figcaption>`:"";
      return `<figure class="data-article-inline-image"><img src="${esc(block.src)}" alt="${esc(block.alt||"")}" width="${Number(block.width)||1200}" height="${Number(block.height)||800}" loading="lazy" decoding="async">${caption}</figure>`;
    }
    return `<p>${esc(block.text||"")}</p>`;
  }).join("\n");
}
function renderLanguage(article){
  const b=article.languageBonus;
  if(!b || b.approved!==true) return "";

  const korean=String(b.korean||"").trim();
  const romanized=String(b.romanized||"").trim();
  const explanation=String(b.explanation||"").trim();
  const closer=String(b.closer||"").trim();

  if(!korean || !explanation) return "";

  return `<details class="language-bonus" data-article-language>
  <summary><span class="language-bonus__sparkle" aria-hidden="true">*</span><span><strong>A little Korean</strong><small>A Korean phrase chosen with local context</small></span></summary>
  <div class="language-bonus__content">
    <p class="language-bonus__name"><strong lang="ko">${esc(korean)}</strong>${romanized?` <span>- <i>${esc(romanized)}</i></span>`:""}</p>
    <p>${esc(explanation)}</p>
    ${closer?`<p class="language-bonus__closer">${esc(closer)}</p>`:""}
  </div>
</details>`;
}
function renderStatic(article){
  const canonical=`https://closertokorea.com/${article.slug}.html`;
  const heroAbs=/^https?:\/\//.test(article.heroImage)?article.heroImage:`https://closertokorea.com/${String(article.heroImage).replace(/^\/+/,"")}`;
  const schema=JSON.stringify({
    "@context":"https://schema.org",
    "@type":"Article",
    headline:article.title,
    description:article.metaDescription||article.excerpt,
    image:heroAbs,
    datePublished:article.publishedAt,
    dateModified:article.updatedAt,
    author:{"@type":"Person",name:"Closer to Korea curator"},
    mainEntityOfPage:canonical
  });
  const sources=(article.sources||[]).length
    ? `<ul>${article.sources.map(s=>{
        if(typeof s==="string") return `<li>${esc(s)}</li>`;
        const label=s.label||s.url||"Source";
        return s.url?`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(label)}</a></li>`:`<li>${esc(label)}</li>`;
      }).join("")}</ul>`
    : "<p>No external sources are listed on this page.</p>";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="shortcut icon" href="/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<title>${esc(article.seoTitle||article.title)}</title>
<meta name="description" content="${esc(article.metaDescription||article.excerpt)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="theme-color" content="#FFF9FC">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Closer to Korea">
<meta property="og:title" content="${esc(article.seoTitle||article.title)}">
<meta property="og:description" content="${esc(article.metaDescription||article.excerpt)}">
<meta property="og:image" content="${esc(heroAbs)}">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${schema}</script>
<link rel="stylesheet" href="css/styles.css">
<link rel="stylesheet" href="css/responsive-patch.css">
<link rel="stylesheet" href="css/mobile-header-fix.css?v=1">
<link rel="stylesheet" href="css/site-footer-v2.css?v=1">
<link rel="stylesheet" href="css/content-links.css">
<link rel="stylesheet" href="css/article-sticky.css?v=1">
<link rel="stylesheet" href="css/article-bonus.css?v=1">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="header-inner"><a class="brand" href="index.html">Closer <span>to</span> Korea</a><nav class="desktop-nav" aria-label="Primary" data-navigation></nav><div class="header-actions actions"><a class="round-button site-search-link" href="search.html" aria-label="Search Closer to Korea">Search</a><button class="round-button menu-button" type="button" aria-controls="mobile-menu" aria-expanded="false" aria-label="Open menu" data-menu-toggle>Menu</button></div></div><nav class="mobile-menu" aria-label="Mobile navigation" data-mobile-menu data-mobile-navigation id="mobile-menu"></nav></header>
<main id="main" class="data-article-page">
<nav class="article-breadcrumb" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="index.html#guides">Articles</a><span aria-hidden="true">/</span><span>${esc(article.title)}</span></nav>
<article data-article>
<header class="data-article-header"><p class="eyebrow">${esc(article.categoryLabel||article.categoryKey)}</p><h1>${esc(article.title)}</h1><p class="legal-lede">${esc(article.excerpt)}</p><p class="article-dates"><span>Published ${esc(article.publishedAt)}</span><span>Updated ${esc(article.updatedAt)}</span></p></header>
<img class="data-article-hero" src="${esc(article.heroImage)}" width="${Number(article.heroImageWidth)||1200}" height="${Number(article.heroImageHeight)||760}" fetchpriority="high" alt="${esc(article.heroImageAlt||"")}">
<div class="data-article-layout"><div class="data-article-body">${renderBody(article.body)}</div><aside class="data-article-sidebar">${renderLanguage(article)}<button class="round-button" type="button" data-share-page>Share guide</button><button class="round-button" type="button" data-copy-link>Copy link</button><p data-share-status aria-live="polite"></p></aside></div>
<section class="article-sources-footer"><details><summary>Sources &amp; References</summary><div>${sources}</div></details></section>
</article></main>
<footer class="site-footer site-footer-v2"><div class="site-footer-v2__top"><div class="site-footer-v2__brand"><a class="brand" href="index.html">Closer <span>to</span> Korea</a><p>Korean everyday life, products, and small cultural details - explained with clear local context.</p><div class="site-footer-v2__contact"><p>Questions, corrections, or something Korean you want us to explain?</p><a href="mailto:contact@closertokorea.com">contact@closertokorea.com</a></div></div><div class="site-footer-v2__links"><nav aria-label="Explore"><strong>Explore</strong><a href="index.html#categories-quick">Explore Korea</a><a href="product-guides.html">Product Guides</a><a href="search.html">Search</a></nav><nav aria-label="About and standards"><strong>About</strong><a href="about.html">About Closer to Korea</a><a href="contact.html">Contact</a><a href="editorial-policy.html">Editorial Policy</a></nav><nav aria-label="Legal"><strong>Legal</strong><a href="privacy-policy.html">Privacy Policy</a><a href="terms.html">Terms</a><a href="affiliate-disclosure.html">Affiliate Disclosure</a><a href="advertising-disclosure.html">Advertising Disclosure</a></nav></div></div><div class="site-footer-v2__bottom"><p>&copy; 2026 Closer to Korea. All rights reserved.</p><p>Made to help curious readers understand everyday Korea a little better.</p></div></footer>
<script src="data/content-data.js?v=3"></script>
<script src="js/main.js"></script>
<script>(()=>{const s=document.querySelector('[data-share-page]'),c=document.querySelector('[data-copy-link]'),m=document.querySelector('[data-share-status]');const show=t=>{if(!m)return;m.textContent=t;setTimeout(()=>m.textContent='',2500)};s?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:document.title,url:location.href});else{await navigator.clipboard.writeText(location.href);show('Link copied.')}}catch{}});c?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);show('Link copied.')}catch{show('Copy the URL from your browser.')}})})();</script>
</body></html>`;
}
function updateContentData(article){
  const file=path.join(root,"data","content-data.js");
  const text=fs.readFileSync(file,"utf8");
  const match=text.match(/^\s*window\.__CTK_DATA__\s*=\s*(\{[\s\S]*\})\s*;\s*$/);
  if(!match) fail("Could not parse data/content-data.js.");
  const data=JSON.parse(match[1]);
  data.articles=Array.isArray(data.articles)?data.articles:[];
  const i=data.articles.findIndex(x=>x.slug===article.slug);
  if(i>=0)data.articles[i]=article; else data.articles.push(article);
  fs.writeFileSync(file,`window.__CTK_DATA__ = ${JSON.stringify(data)};\n`,"utf8");
}
function updateSearchAliases(article){
  const file=path.join(root,"data","search-aliases.json");
  const data=readJson(file);
  data.articles ||= {};
  const s=article.searchHelp;
  const aliases=[
    ...(s?.koreanTerms||[]),
    ...(s?.romanizedTerms||[]),
    ...(s?.soundAlikeTerms||[]),
    ...(s?.descriptionSearches||[]),
    article.primaryKeyword,
    ...(article.secondaryKeywords||[])
  ].filter(Boolean);
  data.articles[article.slug]=[...new Set(aliases)];
  writeJson(file,data);
}
function updateSitemap(slug){
  const file=path.join(root,"sitemap.xml");
  let text=fs.readFileSync(file,"utf8");
  const url=`https://closertokorea.com/${slug}.html`;
  const dynamicRe=/\s*<url><loc>https:\/\/closertokorea\.com\/article\.html\?slug=[^<]+<\/loc><\/url>/g;
  text=text.replace(dynamicRe,"");
  if(!text.includes(`<loc>${url}</loc>`)){
    text=text.replace("</urlset>",`  <url><loc>${url}</loc></url>\n</urlset>`);
  }
  fs.writeFileSync(file,text,"utf8");
}

if(!inputPath || !fs.existsSync(inputPath)) fail("Select a valid S3A publish JSON file.");
fs.mkdirSync(backupDir,{recursive:true});
for(const file of touchedFiles){
  if(fs.existsSync(file)){
    const rel=path.relative(root,file);
    const target=path.join(backupDir,rel);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(file,target);
  }
}

const payload=readJson(inputPath);
const articlesPath=path.join(root,"data","articles.json");
const articles=readJson(articlesPath);
if(!Array.isArray(articles)) fail("data/articles.json must be an array.");
const existing=articles.find(x=>x.slug===(payload.article_draft?.seo?.slug||payload.article_draft?.slug))||null;
const article=siteArticleFromPayload(payload,existing);

const idx=articles.findIndex(x=>x.slug===article.slug);
if(idx>=0) articles[idx]=article; else articles.push(article);
writeJson(articlesPath,articles);
updateContentData(article);
updateSearchAliases(article);
updateSitemap(article.slug);
{
  const htmlPath=path.join(root,`${article.slug}.html`);
  if(fs.existsSync(htmlPath)){
    const target=path.join(backupDir,`${article.slug}.html`);
    fs.copyFileSync(htmlPath,target);
  }
  fs.writeFileSync(htmlPath,renderStatic(article),"utf8");
}



console.log("\nS3B HTML-only generation completed.");
console.log("Generated files are ready for your manual review.");
console.log("Article:",article.title);
console.log("Static URL:",`https://closertokorea.com/${article.slug}.html`);
console.log("\nUpdated:");
console.log(" - data/articles.json");
console.log(" - data/content-data.js");
console.log(" - data/search-aliases.json");
console.log(" - sitemap.xml");
console.log(` - ${article.slug}.html`);

console.log("\nAutomatic publishing was not performed. Review the generated files and upload them manually.");
