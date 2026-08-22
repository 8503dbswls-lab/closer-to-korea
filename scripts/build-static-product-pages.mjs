import fs from "fs";
import path from "path";

const root = process.cwd();
const productsPath = path.join(root, "data", "products.json");
const articlesPath = path.join(root, "data", "articles.json");
const sitemapPath = path.join(root, "sitemap.xml");

function fail(message) {
  console.error("\nERROR:", message);
  process.exit(1);
}
function esc(value="") {
  return String(value ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file,"utf8"));
}
function productFileName(product) {
  const slug = String(product.slug || product.id || "").trim();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fail("Invalid product slug: " + slug);
  }
  return `product-${slug}.html`;
}
function abs(url) {
  if (/^https?:\/\//i.test(String(url||""))) return String(url);
  return "https://closertokorea.com/" + String(url||"").replace(/^\/+/,"");
}
function fmtDate(value) {
  if (!value) return "Not yet checked";
  const d = new Date(value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
}
function matchClass(key) {
  return ({
    confirmed:"exact",
    likely:"similar",
    similar:"alternative",
    "culture-inspired":"trend"
  })[key] || "alternative";
}
function uniqueByKey(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = String(item.slug || item.id || item.name || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
function relatedArticleFor(product, articles) {
  const explicit = Array.isArray(product.relatedArticleSlugs)
    ? product.relatedArticleSlugs.map(String)
    : [];

  let found = null;

  if (explicit.length) {
    found = articles
      .filter(a => !a.draft && explicit.includes(a.slug))
      .sort((a,b)=>String(b.publishedAt||"").localeCompare(String(a.publishedAt||"")))[0] || null;
  }

  if (!found) {
    found = articles
      .filter(a => !a.draft && Array.isArray(a.relatedProductIds) && a.relatedProductIds.includes(product.id))
      .sort((a,b)=>String(b.publishedAt||"").localeCompare(String(a.publishedAt||"")))[0] || null;
  }

  return found;
}
function gallery(product) {
  const items = Array.isArray(product.images) && product.images.length
    ? product.images
    : [{
        src: product.image,
        alt: product.imageAlt || product.name,
        caption: ""
      }];

  if (!items.length || !items[0].src) return "";

  const main = items[0];

  const thumbs = items.map((item,index)=>`
    <button
      class="product-gallery__thumb"
      type="button"
      aria-label="View product photo ${index + 1} of ${items.length}"
      aria-current="${index===0 ? "true" : "false"}"
      data-product-gallery-thumb
      data-src="${esc(item.src)}"
      data-alt="${esc(item.alt || product.name)}"
      data-caption="${esc(item.caption || "")}"
      data-width="${Number(item.width)||800}"
      data-height="${Number(item.height)||800}">
      <img src="${esc(item.src)}" alt="" loading="lazy" decoding="async">
    </button>
  `).join("");

  return `
    <div class="product-gallery-shell">
      <figure class="product-gallery-main">
        <img
          data-product-gallery-main
          src="${esc(main.src)}"
          width="${Number(main.width)||800}"
          height="${Number(main.height)||800}"
          fetchpriority="high"
          alt="${esc(main.alt || product.name)}">
        <figcaption class="product-gallery__caption" data-product-gallery-caption>${esc(main.caption || "")}</figcaption>
      </figure>

      ${items.length > 1 ? `
        <div class="product-gallery__thumbs" aria-label="${esc(product.name)} photo gallery">
          ${thumbs}
        </div>
      ` : ""}
    </div>
  `;
}

if (!fs.existsSync(productsPath)) fail("data/products.json not found");
if (!fs.existsSync(articlesPath)) fail("data/articles.json not found");
if (!fs.existsSync(sitemapPath)) fail("sitemap.xml not found");

const allProducts = readJson(productsPath);
const articles = readJson(articlesPath);

const published = uniqueByKey(
  allProducts
    .filter(p => !p.draft && !p.hidden)
    .sort((a,b) =>
      Number(b.featured)-Number(a.featured) ||
      String(b.publishedAt||"").localeCompare(String(a.publishedAt||"")) ||
      String(a.name||"").localeCompare(String(b.name||""))
    )
);

const generatedFiles = [];

for (const product of published) {
  const filename = productFileName(product);
  const canonical = `https://closertokorea.com/${filename}`;
  const related = relatedArticleFor(product, articles);
  const imageAbs = abs(product.image || "");
  const verification = (product.verificationLabels || [])
    .map(label=>`<span>${esc(label)}</span>`).join("");

  const affiliateHref = String(product.affiliateUrl || product.amazonUrl || "").trim();
  const cta = affiliateHref && product.activePurchaseCta !== false
    ? `<a class="jelly-button primary" href="${esc(affiliateHref)}" target="_blank" rel="sponsored nofollow noopener">${esc(product.cta||"View product")}</a>
       <p class="affiliate-note">Paid link: Closer to Korea may earn a commission. Price and availability can change.</p>`
    : "";

  const schema = {
    "@context":"https://schema.org",
    "@type":"Product",
    name:product.name,
    description:product.summary || "",
    image:Array.isArray(product.images)&&product.images.length
      ? product.images.map(x=>abs(x.src)).filter(Boolean)
      : (product.image?[imageAbs]:[]),
    category:product.category || product.categoryKey || ""
  };

  const relatedHtml = related ? `
    <section class="related-article-panel">
      <p class="eyebrow">Learn more about the Korean context</p>
      <h2>Related Article</h2>
      <div>
        <a class="related-article-card" href="${esc(related.slug)}.html">
          <img src="${esc(related.heroImage)}" alt="${esc(related.heroImageAlt||related.title)}" loading="lazy" decoding="async">
          <span>
            <strong>${esc(related.title)}</strong>
            <small>${esc(related.excerpt||"Learn how this product fits into Korean life.")}</small>
            <b>Read the full article →</b>
          </span>
        </a>
      </div>
    </section>` : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","y37qppo4d2");</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-EVRM967TSL"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','G-EVRM967TSL');</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
<link rel="shortcut icon" href="/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<title>${esc(product.name)} | Closer to Korea</title>
<meta name="description" content="${esc(product.summary||"Korean product guide")}">
<link rel="canonical" href="${canonical}">
<meta name="theme-color" content="#FFF9FC">
<meta property="og:type" content="product">
<meta property="og:site_name" content="Closer to Korea">
<meta property="og:title" content="${esc(product.name)} | Closer to Korea">
<meta property="og:description" content="${esc(product.summary||"")}">
<meta property="og:image" content="${esc(imageAbs)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(imageAbs)}">
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<link rel="stylesheet" href="css/styles.css">
<link rel="stylesheet" href="css/responsive-patch.css">
<link rel="stylesheet" href="css/mobile-header-fix.css?v=1">
<link rel="stylesheet" href="css/site-footer-v2.css?v=1">
<link rel="stylesheet" href="css/content-links.css">
<link rel="stylesheet" href="css/product-hero-layout.css?v=1">
<style>
.product-gallery-shell{min-width:0}
.product-gallery-main{margin:0}
.product-gallery-main>[data-product-gallery-main]{width:100%;height:auto;display:block;border-radius:24px;transition:opacity .15s ease}
.product-gallery__caption{margin:.55rem .1rem 0;color:var(--muted);font-size:.88rem;min-height:1.2em}
.product-gallery__thumbs{display:flex;gap:.65rem;overflow-x:auto;padding:.7rem .1rem .2rem;scroll-snap-type:x proximity}
.product-gallery__thumb{flex:0 0 82px;width:82px;height:82px;padding:3px;border:2px solid transparent;border-radius:16px;background:#fff;cursor:pointer;scroll-snap-align:start;box-shadow:0 8px 20px rgba(93,72,120,.08)}
.product-gallery__thumb[aria-current="true"]{border-color:#ff5b9c}
.product-gallery__thumb:focus-visible{outline:3px solid var(--cherry);outline-offset:2px}
.product-gallery__thumb img{width:100%;height:100%;object-fit:cover;border-radius:11px}
@media(min-width:700px){.product-gallery__thumb{flex-basis:92px;width:92px;height:92px}}
</style>
</head>
<body>
<div class="cursor-sparkle" aria-hidden="true">✦</div>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header"><div class="header-inner"><a class="brand" href="index.html">Closer <span>to</span> Korea</a><nav class="desktop-nav" aria-label="Primary" data-navigation></nav><div class="header-actions actions"><a class="round-button site-search-link" href="search.html" aria-label="Search Closer to Korea">Search</a><button class="round-button menu-button" type="button" aria-controls="mobile-menu" aria-expanded="false" aria-label="Open menu" data-menu-toggle>Menu</button></div></div><nav class="mobile-menu" aria-label="Mobile navigation" data-mobile-menu data-mobile-navigation id="mobile-menu"></nav></header>

<main id="main" class="data-product-page">
  <nav class="article-breadcrumb" aria-label="Breadcrumb"><a href="index.html">Home</a><span aria-hidden="true">/</span><a href="product-guides.html">Product Guides</a><span aria-hidden="true">/</span><span>${esc(product.name)}</span></nav>

  <article>
    <div class="data-product-hero">
      ${gallery(product)}
      <div class="data-product-summary">
        <p class="eyebrow">${esc(product.category||product.categoryKey||"Product Guide")}</p>
        <h1>${esc(product.name)}</h1>
        <p class="legal-lede">${esc(product.summary||"")}</p>
        <div class="verification-row">${verification}</div>
        <p>Last checked ${esc(fmtDate(product.lastCheckedAt))}</p>
        ${cta}
      </div>
    </div>

    <div class="data-product-layout">
      <section class="data-product-context">
        <h2>Product details &amp; buying context</h2>
        <dl class="product-context">
          <div><dt>Where it was found or used in Korea</dt><dd>${esc(product.seenInKorea||"")}</dd></div>
          <div><dt>Who it is relevant for</dt><dd>${esc(product.usedBy||"")}</dd></div>
          <div><dt>Why this product matters</dt><dd>${esc(product.whyItMatters||"")}</dd></div>
          <div><dt>Verification status</dt><dd>${esc(product.koreanProductStatus||"Verification pending")}</dd></div>
        </dl>
        ${product.productMatchType!=="confirmed"&&product.usDifference?`<p class="match-note">${esc(product.usDifference)}</p>`:""}
      </section>

      <aside class="data-product-sidebar">
        <section>
          <h2>Product record</h2>
          <dl class="record-list">
            <div><dt>Published</dt><dd>${esc(fmtDate(product.publishedAt))}</dd></div>
            <div><dt>Last checked</dt><dd>${esc(fmtDate(product.lastCheckedAt))}</dd></div>
            <div><dt>Trend status</dt><dd>${esc(product.trendLabel||product.trendStatus||"")}</dd></div>
            ${affiliateHref?`<div><dt>Amazon status</dt><dd>${esc(product.amazonLabel||product.amazonAvailability||"Under review")}</dd></div>`:""}
          </dl>
        </section>
        <button class="round-button" type="button" data-share-page>Share product</button>
        <button class="round-button" type="button" data-copy-link>Copy link</button>
        <p data-share-status aria-live="polite"></p>
      </aside>
    </div>

    ${relatedHtml}
  </article>
</main>

<footer class="site-footer site-footer-v2"><div class="site-footer-v2__top"><div class="site-footer-v2__brand"><a class="brand" href="index.html">Closer <span>to</span> Korea</a><p>Korean everyday life, products, and small cultural details—explained with clear local context.</p><div class="site-footer-v2__contact"><p>Questions, corrections, or something Korean you want us to explain?</p><a href="mailto:contact@closertokorea.com">contact@closertokorea.com</a></div></div><div class="site-footer-v2__links"><nav aria-label="Explore"><strong>Explore</strong><a href="index.html#categories-quick">Explore Korea</a><a href="product-guides.html">Product Guides</a><a href="search.html">Search</a></nav><nav aria-label="About and standards"><strong>About</strong><a href="about.html">About Closer to Korea</a><a href="contact.html">Contact</a><a href="editorial-policy.html">Editorial Policy</a></nav><nav aria-label="Legal"><strong>Legal</strong><a href="privacy-policy.html">Privacy Policy</a><a href="terms.html">Terms</a><a href="affiliate-disclosure.html">Affiliate Disclosure</a><a href="advertising-disclosure.html">Advertising Disclosure</a></nav></div></div><div class="site-footer-v2__bottom"><p>&copy; 2026 Closer to Korea. All rights reserved.</p><p>Made to help curious readers understand everyday Korea a little better.</p></div></footer>

<script src="data/content-data.js?v=3"></script>
<script src="js/monetization.js"></script>
<script src="js/main.js"></script>
<script>
(() => {
  const main = document.querySelector('[data-product-gallery-main]');
  const caption = document.querySelector('[data-product-gallery-caption]');
  const thumbs = [...document.querySelectorAll('[data-product-gallery-thumb]')];
  if (!main || !thumbs.length) return;

  thumbs.forEach(button => {
    button.addEventListener('click', () => {
      main.style.opacity = '.45';

      main.src = button.dataset.src || main.src;
      main.alt = button.dataset.alt || main.alt;

      const width = Number(button.dataset.width || 0);
      const height = Number(button.dataset.height || 0);

      if (width) main.width = width;
      if (height) main.height = height;
      if (caption) caption.textContent = button.dataset.caption || '';

      thumbs.forEach(t => t.setAttribute('aria-current','false'));
      button.setAttribute('aria-current','true');

      requestAnimationFrame(() => {
        main.style.opacity = '1';
      });
    });
  });
})();
</script>
<script>(()=>{const s=document.querySelector('[data-share-page]'),c=document.querySelector('[data-copy-link]'),m=document.querySelector('[data-share-status]');const show=t=>{if(!m)return;m.textContent=t;setTimeout(()=>m.textContent='',2500)};s?.addEventListener('click',async()=>{try{if(navigator.share)await navigator.share({title:document.title,url:location.href});else{await navigator.clipboard.writeText(location.href);show('Link copied.')}}catch{}});c?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.href);show('Link copied.')}catch{show('Copy the URL from your browser.')}})})();</script>
</body>
</html>`;

  fs.writeFileSync(path.join(root, filename), html, "utf8");
  generatedFiles.push(filename);
}

// Sitemap: remove old dynamic product URL + all product-*.html entries, then add current published static product URLs.
let sitemap = fs.readFileSync(sitemapPath,"utf8");

sitemap = sitemap
  .replace(/\s*<url>\s*<loc>https:\/\/closertokorea\.com\/product\.html\?slug=[^<]+<\/loc>[\s\S]*?<\/url>/g, "")
  .replace(/\s*<url>\s*<loc>https:\/\/closertokorea\.com\/product-[^<]+\.html<\/loc>[\s\S]*?<\/url>/g, "");

const entries = published.map(product => {
  const filename = productFileName(product);
  const lastmod = product.lastCheckedAt || product.publishedAt || new Date().toISOString().slice(0,10);
  return `  <url>
    <loc>https://closertokorea.com/${filename}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`;
}).join("\n");

if (!/<\/urlset>\s*$/.test(sitemap)) fail("Unexpected sitemap.xml structure");
sitemap = sitemap.replace(/<\/urlset>\s*$/, (entries ? entries + "\n" : "") + "</urlset>\n");
fs.writeFileSync(sitemapPath, sitemap, "utf8");

console.log("");
console.log("STATIC PRODUCT HTML BUILD SUCCESS");
console.log("Generated product pages:", generatedFiles.length);
generatedFiles.forEach(x=>console.log("  - " + x));
console.log("Updated sitemap.xml");
