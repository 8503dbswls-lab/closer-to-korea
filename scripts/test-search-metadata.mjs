// Run from the repository root: node scripts/test-search-metadata.mjs
// Uses only Node built-ins. Browser smoke tests should additionally cover both
// rendered metadata on static pages and the legacy detail routes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const data=Object.fromEntries(['products','articles','categories','site-copy','monetization'].map(name=>[name,JSON.parse(read(`data/${name}.json`))]));
const main=read('js/main.js');
const decode=value=>value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const attribute=(tag,name)=>decode(tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`,'i'))?.[2]||'');
function metadata(html){
  const description=(html.match(/<meta\b[^>]*>/gi)||[]).find(tag=>attribute(tag,'name')==='description');
  return {title:decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||''),description:description===undefined?null:attribute(description,'content')};
}
async function loadMain(initial,pathname='/index.html',detailFirst=false){
  const meta=initial.description===null?null:{content:initial.description};
  const document={title:initial.title,querySelector:selector=>selector==='meta[name="description"]'?meta:null,querySelectorAll:()=>[],addEventListener(){},body:{classList:{toggle(){}}}};
  const sandbox={document,location:new URL(`https://closertokorea.com${pathname}`),URLSearchParams,URL,console,window:{matchMedia:()=>({matches:false}),addEventListener(){}},fetch:async file=>({ok:true,json:async()=>data[file.match(/data\/(.*)\.json/)[1]]})};
  const context=vm.createContext(sandbox);
  vm.runInContext(main.replace('\nloadData();','\nglobalThis.ready=loadData();'),context);
  if(detailFirst){document.title='Specific detail title';meta.content='Specific detail description';}
  await context.ready;
  return {context,document,meta};
}

let pageCount=0;
for(const filename of fs.readdirSync(root).filter(file=>file.endsWith('.html'))){
  const html=read(filename);
  if(!html.includes('js/main.js'))continue;
  const original=metadata(html);
  const {document,meta}=await loadMain(original,`/${filename}`);
  assert.equal(document.title,original.title,`${filename}: preserve authored title`);
  assert.equal(meta?.content??null,original.description,`${filename}: preserve authored description`);
  pageCount++;
}
for(const blank of ['', ' \n\t ']){
  const {document,meta}=await loadMain({title:blank,description:blank});
  assert.equal(document.title,data['site-copy'].site.defaultTitle);
  assert.equal(meta.content,data['site-copy'].site.defaultDescription);
}
const missing=await loadMain({title:'Page without description',description:null});
assert.equal(missing.document.title,'Page without description');
// Exercise the actual legacy detail scripts against a minimal DOM adapter. The
// renderer checks below fail if a detail load falls into its error branch.
function detailElement(){
  return {content:'',children:[],dataset:{},style:{},classList:{add(){},toggle(){}},
    setAttribute(name,value){this[name]=value;},append(...children){this.children.push(...children);},
    appendChild(child){this.children.push(child);return child;},replaceChildren(...children){this.children=children;},
    insertAdjacentElement(){},addEventListener(){},querySelector(){return null;},querySelectorAll(){return [];},closest(){return null;}};
}
for(const kind of ['article','product']){
  const items=kind==='article'?data.articles.filter(item=>!item.draft):data.products.filter(item=>!item.draft&&!item.hidden);
  for(const item of items){
  const route=`/${kind}.html?slug=${item.slug}`;
  const expectedTitle=kind==='article'?(item.seoTitle||`${item.title} | Closer to Korea`):`${item.name} | Closer to Korea`;
  const expectedDescription=kind==='article'?(item.metaDescription||item.excerpt):item.summary;
  const expectedCanonical=`https://closertokorea.com/${kind==='product'?'product-':''}${item.slug}.html`;
  for(const detailFirst of [false,true]){
    const {context,document,meta}=await loadMain({title:'Generic detail page',description:'Generic detail description'},route);
    const nodes=new Map([['meta[name="description"]',meta]]);
    const dataSelectors=[...read(`js/${kind}.js`).matchAll(/document\.querySelector\('([^']+)'\)/g)].map(match=>match[1]).filter(selector=>selector.startsWith('[data-'));
    for(const selector of dataSelectors)nodes.set(selector,detailElement());
    document.documentElement={dataset:{}};
    document.head=detailElement();
    document.createElement=()=>detailElement();
    document.getElementById=()=>null;
    document.querySelector=selector=>nodes.get(selector)||null;
    // Register newly created head nodes for the same selectors the renderer uses.
    document.head.appendChild=function(element){
      this.children.push(element);
      if(element.rel==='canonical')nodes.set('link[rel="canonical"]',element);
      if(element.property)nodes.set(`meta[property="${element.property}"]`,element);
      if(element.name)nodes.set(`meta[name="${element.name}"]`,element);
      return element;
    };
    const detailCall=kind==='article'?'loadArticle()':'loadProductDetail()';
    const detailScript=read(`js/${kind}.js`).replace(`\n${detailCall};`,`\nglobalThis.detailReady=${detailCall};`);
    // Reset to generic metadata so each real detail renderer owns the transition.
    document.title='Generic detail page';meta.content='Generic detail description';
    if(!detailFirst)await vm.runInContext('loadData()',context);
    vm.runInContext(detailScript,context);
    await context.detailReady;
    if(detailFirst)await vm.runInContext('loadData()',context);
    assert.equal(nodes.get(`[data-${kind}-error]`).hidden,true,`${route}: actual detail renderer succeeds`);
    vm.runInContext('applySiteCopy(); applySiteCopy();',context);
    assert.equal(document.title,expectedTitle,`${route}: preserve real detail title in either completion order`);
    assert.equal(meta.content,expectedDescription,`${route}: preserve real detail description`);
    assert.equal(nodes.get('link[rel="canonical"]').href,expectedCanonical);
    assert.equal(nodes.get('meta[property="og:url"]').content,expectedCanonical);
    if(kind==='product'){
      const schema=document.head.children.find(element=>element.type==='application/ld+json');
      assert.equal(JSON.parse(schema.textContent).url,expectedCanonical,'Product JSON-LD uses the static canonical');
    }
  }
}

}

const publicArticles=data.articles.filter(item=>!item.draft);
const publicProducts=data.products.filter(item=>!item.draft&&!item.hidden);
const contentPaths=[...publicArticles.map(item=>`${item.slug}.html`),...publicProducts.map(item=>`product-${item.slug}.html`)];
for(const filename of contentPaths){
  assert.ok(fs.existsSync(path.join(root,filename)),`Static route exists: ${filename}`);
  const canonical=(read(filename).match(/<link\b[^>]*>/gi)||[]).find(tag=>attribute(tag,'rel')==='canonical');
  assert.equal(attribute(canonical||'','href'),`https://closertokorea.com/${filename}`,`${filename}: static canonical`);
}
const sitemapUrls=xml=>[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>decode(match[1])).sort();
const expected=sitemapUrls(read('sitemap.xml'));
assert.equal(new Set(expected).size,expected.length,'No duplicate sitemap URLs');
for(const filename of contentPaths)assert.ok(expected.includes(`https://closertokorea.com/${filename}`));
assert.ok(!expected.some(url=>/\/(article|product)\.html\?/.test(url)),'No legacy URLs in sitemap');

// Preparation also manages unrelated social/analytics markup. Keep every one of
// those writes in a disposable copy, never in the working tree being tested.
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'ctk-search-regression-'));
try{
  fs.cpSync(root,scratch,{recursive:true,filter:source=>!['.git','node_modules'].includes(path.basename(source))});
  let previous;
  for(let pass=1;pass<=2;pass++){
    const result=spawnSync(process.execPath,['scripts/prepare-deploy.mjs'],{cwd:scratch,encoding:'utf8'});
    assert.ifError(result.error);
    const output=result.stdout+result.stderr;
    assert.match(output,/Validate content and deployment safety/,'Preparation reaches validator');
    assert.doesNotMatch(output,/- (Sitemap|Runtime):/,'No sitemap/canonical regression');
    const xml=fs.readFileSync(path.join(scratch,'sitemap.xml'),'utf8');
    assert.deepEqual(sitemapUrls(xml),expected,`Preparation ${pass}: preserve current static URL set`);
    if(previous)assert.equal(xml,previous,'Repeated preparation is sitemap-idempotent');
    previous=xml;
    if(result.status!==0)console.log(`Preparation ${pass}: unrelated aggregate validation failures remain; search-specific assertions passed.`);
  }
  // Publishing flags must still exclude content even when static files remain.
  const fixtureArticles=structuredClone(data.articles);
  fixtureArticles.find(item=>item.slug===publicArticles[0].slug).draft=true;
  const fixtureProducts=structuredClone(data.products);
  fixtureProducts.find(item=>item.slug===publicProducts[0].slug).hidden=true;
  fs.writeFileSync(path.join(scratch,'data/articles.json'),JSON.stringify(fixtureArticles));
  fs.writeFileSync(path.join(scratch,'data/products.json'),JSON.stringify(fixtureProducts));
  const filtered=spawnSync(process.execPath,['scripts/sync-site-structure.mjs'],{cwd:scratch,encoding:'utf8'});
  assert.equal(filtered.status,0,filtered.stderr);
  const filteredUrls=sitemapUrls(fs.readFileSync(path.join(scratch,'sitemap.xml'),'utf8'));
  assert.ok(!filteredUrls.includes(`https://closertokorea.com/${publicArticles[0].slug}.html`));
  assert.ok(!filteredUrls.includes(`https://closertokorea.com/product-${publicProducts[0].slug}.html`));
  fs.writeFileSync(path.join(scratch,'data/articles.json'),read('data/articles.json'));
  fs.writeFileSync(path.join(scratch,'data/products.json'),read('data/products.json'));
  // A legacy URL must still be rejected, not accepted alongside the static URL.
  const sitemapFile=path.join(scratch,'sitemap.xml');
  fs.writeFileSync(sitemapFile,previous.replace(`https://closertokorea.com/${publicArticles[0].slug}.html`,`https://closertokorea.com/article.html?slug=${publicArticles[0].slug}`));
  const invalid=spawnSync(process.execPath,['scripts/validate-content.mjs'],{cwd:scratch,encoding:'utf8'});
  assert.notEqual(invalid.status,0);
  assert.match(invalid.stdout+invalid.stderr,/Sitemap: missing https:\/\/closertokorea.com\/[^\s?]+\.html/);
  assert.match(invalid.stdout+invalid.stderr,/Sitemap: unexpected https:\/\/closertokorea.com\/article\.html\?slug=/);
}finally{
  fs.rmSync(scratch,{recursive:true,force:true});
}
console.log(`PASS: ${pageCount} authored page metadata pairs; blank fallback; both detail/shared completion orders; ${contentPaths.length} static canonicals; repeated preparation; draft/hidden exclusion; legacy sitemap rejection.`);
