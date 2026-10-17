// Rebuild only the payment article from its editorial data.
// Run from the repository root. Does not publish or change shared page design.
import fs from 'node:fs';
const slug='korean-restaurant-payment';
const article=JSON.parse(fs.readFileSync('data/articles.json','utf8')).find(a=>a.slug===slug);
if(!article||article.draft)throw new Error('Published payment article record required');
const esc=(s='')=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=`https://closertokorea.com/${slug}.html`;
const imageUrl=`https://closertokorea.com/${article.heroImage}`;
let template=fs.readFileSync('korean-bbq-ssam-lettuce-perilla-wraps.html','utf8');
template=template.replace(/data-article-slug="[^"]*"/,`data-article-slug="${slug}"`);
template=template.replace(/<title>[\s\S]*?<\/title>/,`<title>${esc(article.seoTitle)}</title>`);
template=template.replace(/<meta\b[^>]*(?:name="(?:description|twitter:[^"]+)"|property="og:[^"]+")[^>]*>/g,'')
 .replace(/<link\b[^>]*rel="canonical"[^>]*>/g,'')
 .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g,'');
const structured={'@context':'https://schema.org','@type':'Article',headline:article.title,description:article.metaDescription,image:imageUrl,datePublished:article.publishedAt,dateModified:article.updatedAt,author:{'@type':'Organization',name:'Closer to Korea'},mainEntityOfPage:url};
const meta=[['name','description',article.metaDescription],['property','og:type','article'],['property','og:site_name','Closer to Korea'],['property','og:title',article.seoTitle],['property','og:description',article.metaDescription],['property','og:url',url],['property','og:image',imageUrl],['name','twitter:card','summary_large_image'],['name','twitter:title',article.seoTitle],['name','twitter:description',article.metaDescription],['name','twitter:image',imageUrl]].map(([attr,key,value])=>`<meta ${attr}="${key}" content="${esc(value)}">`).join('\n');
template=template.replace('</head>',`<script type="application/ld+json">${JSON.stringify(structured).replaceAll('<','\\u003c')}</script>\n${meta}\n<link rel="canonical" href="${url}">\n</head>`);
const inlineLinks=new Map();
function linkText(text){
 let result=esc(text);
 for(const [label,href] of inlineLinks){
   const external=/^https:/.test(href);
   result=result.replace(esc(label),`<a href="${esc(href)}"${external?' target="_blank" rel="noopener"':''}>${esc(label)}</a>`);
 }
 return result;
}
const body=article.body.map(block=>{
 if(block.type==='paragraph')return `<p>${linkText(block.text)}</p>`;
 if(block.type==='heading')return `<h2>${esc(block.text)}</h2>`;
 if(block.type==='list')return `<ul>${block.items.map(item=>`<li>${esc(item)}</li>`).join('')}</ul>`;
 if(block.type==='definition-list')return `<dl class="article-definition-list">${block.items.map(item=>`<div><dt>${esc(item.term)}</dt><dd>${esc(item.description)}</dd></div>`).join('')}</dl>`;
 throw new Error(`Unexpected article block type: ${block.type}`);
}).join('\n');
const main=`<main id="main" class="data-article-page">
<nav class="article-breadcrumb"><a href="index.html">Home</a> / <a href="everyday-korea.html">Everyday Korea</a></nav>
<article data-article><header class="data-article-header"><p class="eyebrow">Everyday Korea</p><h1>${esc(article.title)}</h1><p class="legal-lede">${esc(article.excerpt)}</p><p class="article-dates">Published ${esc(article.publishedAt)}</p></header>
<figure><img class="data-article-hero" src="${esc(article.heroImage)}" alt="${esc(article.heroImageAlt)}" width="${article.heroImageWidth}" height="${article.heroImageHeight}" style="height:auto;max-height:none;object-fit:contain" fetchpriority="high"><figcaption>${esc(article.heroImageCaption)}</figcaption></figure>
<div class="data-article-layout"><div class="data-article-body">${body}</div><aside class="data-article-sidebar"><button class="round-button" type="button" data-share-page>Share guide</button><button class="round-button" type="button" data-copy-link>Copy link</button><p data-share-status aria-live="polite"></p></aside></div>
<section class="article-sources-footer"><details><summary>Sources &amp; References</summary><ul>${article.sources.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul></details></section>
</article></main>`;
template=template.replace(/<main\b[\s\S]*?<\/main>/,main);
// Version this page's bundle to keep its first render on the publication's data.
template=template.replace('data/content-data.js?v=3','data/content-data.js?v=payments-20261017');
fs.writeFileSync(`${slug}.html`,template);
console.log(`Generated ${slug}.html from article data.`);
