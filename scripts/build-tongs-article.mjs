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
const body=article.body.map((b,i)=>{
 if(b.type!=='paragraph')throw new Error('Unexpected tongs article block');
 let text=esc(b.text);
 if(i===0)for(const [label,href] of links)text=text.replace(esc(label),`<a href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`);
 return `<p>${text}</p>`;
}).join('\n');
const main=`<main id="main" class="data-article-page">
<nav class="article-breadcrumb"><a href="index.html">Home</a> / <a href="seen-online.html">Seen Online</a></nav>
<article data-article><header class="data-article-header"><p class="eyebrow">Seen Online</p><h1>${esc(article.title)}</h1><p class="legal-lede">${esc(article.excerpt)}</p><p class="article-dates">Published ${esc(article.publishedAt)}</p></header>
<figure><img class="data-article-hero" src="${esc(article.heroImage)}" alt="${esc(article.heroImageAlt)}" width="${article.heroImageWidth}" height="${article.heroImageHeight}" style="height:auto;max-height:none;object-fit:contain" fetchpriority="high"><figcaption>${esc(article.heroImageCaption)}</figcaption></figure>
<div class="data-article-layout"><div class="data-article-body">${body}</div><aside class="data-article-sidebar"><button class="round-button" type="button" data-share-page>Share guide</button><button class="round-button" type="button" data-copy-link>Copy link</button><p data-share-status aria-live="polite"></p></aside></div>
<section class="article-sources-footer"><details><summary>Sources &amp; References</summary><ul>${article.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul></details></section>
</article></main>`;
template=template.replace(/<main\b[\s\S]*?<\/main>/,main);
fs.writeFileSync(`${slug}.html`,template);
console.log(`Generated ${slug}.html from article data.`);
