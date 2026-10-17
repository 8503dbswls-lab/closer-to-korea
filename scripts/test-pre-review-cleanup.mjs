// Scope-specific regression checks. Run from repository root.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(p,'utf8');
const products=JSON.parse(read('data/products.json'));
assert.equal(products.length,3);
for(const p of products){
 const html=read(`product-${p.slug}.html`);
 assert(!/Any future|any future link|Original product photos will be added/.test(html));
 assert(html.includes(p.usDifference));
 if(!p.trendLabel&&!p.trendStatus)assert(!html.includes('<dt>Trend status</dt>'));
 assert(html.includes(`https://closertokorea.com/product-${p.slug}.html`));
}
const grape=products.find(p=>p.id==='grape-wakppubol');
assert.equal(grape.lastCheckedAt,'2026-08-23');assert.equal(grape.trendStatus,'');
assert(!grape.verificationStatus.includes('trend-verified'));
assert.equal(grape.categoryKey,'culture');
assert.match(grape.trendLabel,/summer 2026/);
const kimchi=products.find(p=>p.id==='kimchi-cutter-container');
assert.match(kimchi.images[0].caption,/AI-generated illustration/);
assert.match(kimchi.images[0].caption,/not a photograph/);
assert(read('about.html').includes('one or more of the following criteria'));
assert(!read('about.html').includes('<h2>Weekly updates</h2>'));
const home=read('index.html');
assert(home.includes('<meta name="google-adsense-account" content="ca-pub-9155014807430545">'));
assert(!/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle/.test(home));
const monetization=JSON.parse(read('data/monetization.json'));
assert.equal(monetization.adsense.connectionEnabled,false);assert.equal(monetization.adsense.manualAdsEnabled,false);
// Exercise the actual empty-row logic with a small DOM node adapter.
const script=read('js/product.js');
const code=script.slice(script.indexOf("const trend=document.querySelector('[data-product-trend]');"),script.indexOf("document.querySelector('[data-product-amazon-status]')"));
for(const product of products){const row={hidden:false},node={textContent:'',closest:()=>row};vm.runInNewContext(code,{product,document:{querySelector:()=>node}});assert.equal(row.hidden,!(product.trendLabel||product.trendStatus));assert.equal(node.textContent,product.trendLabel||product.trendStatus||'');}
console.log('PASS: all 3 product pages, empty trend rows, dated claims, truthful AI disclosure, reader-facing copy, About criteria, ownership tag and ads-off state.');
