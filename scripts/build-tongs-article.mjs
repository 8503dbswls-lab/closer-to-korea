// Rebuild the tongs article's static page from its editorial data.
// No publishing, network requests, or shared layout changes.
import fs from 'node:fs';
const slug='scissor-style-tongs-lee-guk-joo';
const article=JSON.parse(fs.readFileSync('data/articles.json','utf8')).find(a=>a.slug===slug);
if(!article||article.draft)throw new Error('Published tongs article record required');
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=`https://closertokorea.com/${slug}.html`;
const links=new Map([['official MBC clip',article.sources[0].url],["MBC’s episode recap",article.sources[1].url]]);
let template=fs.readFileSync('korean-bbq-ssam-lettuce-perilla-wraps.html','utf8');
template=template.replace(/data-article-slug="[^"]*"/,`data-article-slug="${slug}"`);
template=template.replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(article.seoTitle)}</title>`);
// Remove article-specific metadata from the template, then write only this article's values.
template=template.replace(/<meta\b[^>]*(?:name="(?:description|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/g,'')
 .replace(/<link\b[^>]*rel="canonical"[^>]*>/g,'');
template=template.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'');
const structured={'@context':'https://schema.org','@type':'Article',headline:article.title,description:article.metaDescription,image:`https://closertokorea.com/${article.heroImage}`,datePublished:article.publishedAt,dateModified:article.updatedAt,author:{'@type':'Organization',name:'Closer to Korea'},mainEntityOfPage:url};
template=template.replace('</head>',`<script type="application/ld+json">${JSON.stringify(structured).replaceAll('<','\\u003c')}</script>\n</head>`);
const meta=[['name','description',article.metaDescription],['property','og:type','article'],['property','og:site_name','Closer to Korea'],['property','og:title',article.title],['property','og:description',article.metaDescription],['property','og:url',url],['property','og:image',`https://closertokorea.com/${article.heroImage}`],['name','twitter:card','summary_large_image'],['name','twitter:title',article.title],['name','twitter:description',article.metaDescription],['name','twitter:image',`https://closertokorea.com/${article.heroImage}`]].map(([attr,key,value])=>`<meta ${attr}="${key}" content="${esc(value)}">`).join('\n');
template=template.replace('</head>',`${meta}\n<link rel="canonical" href="${url}">\n</head>`);
const videoReference=`<section class="article-video-reference" aria-labelledby="mbc-clip-title">
<h2 id="mbc-clip-title">Watch the MBC clip</h2>
<p>The Manager (전지적 참견 시점), episode 226 · November 26, 2022. Watch Lee Guk-joo prepare French toast in MBC’s official clip.</p>
<p id="mbc-player-privacy">Load the player to connect to YouTube (Google). YouTube may process data under its <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Privacy Policy</a>. The player and its preview do not load until you choose.</p>
<div class="article-video-player" data-mbc-player>
<button class="jelly-button primary" type="button" data-load-mbc-video aria-describedby="mbc-player-privacy">Load 14-second excerpt · 12:12–12:26</button>
</div>
<p data-mbc-video-status aria-live="polite">After loading, press Play for the 12:12–12:26 excerpt. Automatic playback is off.</p>
<p><a href="${esc(article.sources[0].url)}&amp;t=732s" target="_blank" rel="noopener">Watch the original on MBC’s YouTube channel from 12:12 (no end cutoff) <span class="sr-only">(opens in a new tab)</span></a></p>
<p><a href="${esc(article.sources[1].url)}" target="_blank" rel="noopener">Read MBC’s episode recap <span class="sr-only">(opens in a new tab)</span></a></p>
</section>`;
template=template.replace('</head>',`<style>
.article-video-reference { margin: 1.5rem 0; padding: clamp(1rem, 4vw, 1.75rem); border: 2px solid #c6b7e2; border-radius: 20px; background: #f5f0ff; }
.article-video-player { width: 100%; aspect-ratio: 16 / 9; min-height: 200px; display: grid; place-items: center; border-radius: 12px; overflow: hidden; background: #e9e1f5; }
.article-video-player iframe { width: 100%; height: 100%; border: 0; }
.article-video-reference h2 { margin-top: 0; }
.article-video-reference .jelly-button { max-width: 100%; white-space: normal; text-align: center; overflow-wrap: anywhere; }
.article-video-reference a:focus-visible { outline: 3px solid #45226b; outline-offset: 4px; }
</style>\n</head>`);
const body=article.body.map((b,i)=>{
 if(b.type!=='paragraph')throw new Error('Unexpected tongs article block');
 let text=esc(b.text);
 if(i===0)for(const [label,href] of links)text=text.replace(esc(label),`<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`);
 return `<p>${text}</p>${i===0?videoReference:""}`;
}).join('\n');
const main=`<main id="main" class="data-article-page">
<nav class="article-breadcrumb"><a href="index.html">Home</a> / <a href="seen-online.html">Seen Online</a></nav>
<article data-article><header class="data-article-header"><p class="eyebrow">Seen Online</p><h1>${esc(article.title)}</h1><p class="legal-lede">${esc(article.excerpt)}</p><p class="article-dates">Published ${esc(article.publishedAt)}</p></header>
<figure><img class="data-article-hero" src="${esc(article.heroImage)}" alt="${esc(article.heroImageAlt)}" width="${article.heroImageWidth}" height="${article.heroImageHeight}" style="height:auto;max-height:none;object-fit:contain" fetchpriority="high"><figcaption>${esc(article.heroImageCaption)}</figcaption></figure>
<div class="data-article-layout"><div class="data-article-body">${body}</div><aside class="data-article-sidebar"><button class="round-button" type="button" data-share-page>Share guide</button><button class="round-button" type="button" data-copy-link>Copy link</button><p data-share-status aria-live="polite"></p></aside></div>
<section class="article-sources-footer"><details><summary>Sources &amp; References</summary><ul>${article.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul></details></section>
</article></main>`;
template=template.replace(/<main\b[\s\S]*?<\/main>/,main);
template=template.replace('</body>','<script src="js/tongs-video.js?v=cutoff-guard-746-v2"></script></body>');
fs.writeFileSync(`${slug}.html`,template);
console.log(`Generated ${slug}.html from article data.`);
