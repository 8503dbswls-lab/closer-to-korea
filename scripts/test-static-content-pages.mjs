// Standalone regression suite: node scripts/test-static-content-pages.mjs
// No dependencies, network, private source, or working-tree writes required.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {buildStaticContentPages,innerContent} from './build-static-content-pages.mjs';
import {renderHome,renderArticle,articleRenderers,RenderElement} from './prerender-runtime.mjs';

const root=process.cwd();
const read=(file,base=root)=>fs.readFileSync(path.join(base,file),'utf8');
const articles=JSON.parse(read('data/articles.json'));
const products=JSON.parse(read('data/products.json'));
const coin=articles.find(item=>item.slug==='korean-coin-tissue');
const withoutComments=html=>html.replace(/<!--[\s\S]*?-->/g,'');
const head=html=>html.slice(0,html.indexOf('</head>')+7);
const footer=html=>html.slice(html.indexOf('<footer'));
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'ctk-static-parity-'));
try {
  for(const directory of ['data','js']) fs.cpSync(path.join(root,directory),path.join(scratch,directory),{recursive:true});
  for(const filename of ['index.html','korean-coin-tissue.html']) fs.copyFileSync(path.join(root,filename),path.join(scratch,filename));
  const originals=Object.fromEntries(['index.html','korean-coin-tissue.html'].map(file=>[file,read(file,scratch)]));
  await buildStaticContentPages(scratch);
  const index=read('index.html',scratch);
  const page=read('korean-coin-tissue.html',scratch);
  const home=await renderHome(scratch,articles,products);
  const detail=renderArticle(scratch,coin,products);
  assert.equal(withoutComments(innerContent(index,'data-home-latest')),home.latest,'Featured card markup exactly matches the browser renderer');
  assert.equal(withoutComments(innerContent(index,'data-home-article-grid')),home.articles,'Article card markup exactly matches the browser renderer');
  assert.equal(innerContent(page,'data-article-body'),detail.body,'All body blocks exactly match the browser renderer');
  assert.equal(innerContent(page,'data-article-sources'),detail.sources);
  assert.equal(innerContent(page,'data-article-title'),detail.title);
  assert.equal(innerContent(page,'data-article-excerpt'),detail.excerpt);
  assert.equal(innerContent(page,'data-article-published'),detail.published);
  assert.equal(innerContent(page,'data-article-updated'),detail.updated);
  assert.match(page,/<article data-article data-prerendered="true">/,'Article is visible without JavaScript');
  assert.match(page,/<div data-article-loading[^>]* hidden="">/);
  assert.equal((page.match(/class="data-article-hero-caption"/g)||[]).length,1);
  assert.ok(innerContent(page,'data-article-body').includes('동전티슈'));
  for(const file of Object.keys(originals)) {
    const output=read(file,scratch);
    assert.equal(head(output),head(originals[file]),`${file}: metadata, ownership, analytics and head untouched`);
    assert.equal(footer(output),footer(originals[file]),`${file}: footer and scripts untouched`);
  }
  for(const attribute of ['data-home-product-grid','data-home-trending-grid']) {
    assert.equal(innerContent(index,attribute),innerContent(originals['index.html'],attribute),`${attribute} is out of scope`);
  }
  assert.deepEqual(await buildStaticContentPages(scratch),[],'Second build is byte-identical');
  assert.deepEqual(await buildStaticContentPages(scratch,{check:true}),[]);

  // Changes to public data flow through both outputs, with no copied formatter.
  const fixture=structuredClone(articles);
  const fixtureCoin=fixture.find(item=>item.slug===coin.slug);
  fixtureCoin.body.push({type:'paragraph',text:'Parity fixture: <script>& "quotes" and 한글'});
  fixtureCoin.heroImageCaption='Updated <caption> & text';
  fixtureCoin.publishedAt='2030-01-02';
  fixtureCoin.sources.push({label:'Source <text>',url:'https://example.com/?a=1&b=2'});
  fs.writeFileSync(path.join(scratch,'data/articles.json'),JSON.stringify(fixture));
  await assert.rejects(buildStaticContentPages(scratch,{check:true}),/Static content is stale/);
  assert.equal(read('korean-coin-tissue.html',scratch),page,'Check mode is read-only');
  await buildStaticContentPages(scratch);
  const updated=read('korean-coin-tissue.html',scratch);
  assert.ok(updated.includes('Parity fixture: &lt;script&gt;&amp; &quot;quotes&quot; and 한글'));
  assert.ok(updated.includes('Updated &lt;caption&gt; &amp; text'));
  assert.equal((updated.match(/class="data-article-hero-caption"/g)||[]).length,1);
  assert.ok(updated.includes('https://example.com/?a=1&amp;b=2'));
  assert.deepEqual(await buildStaticContentPages(scratch),[]);
  for(const flag of ['draft','hidden']) {
    const unpublished=structuredClone(fixture);
    unpublished.find(item=>item.slug===coin.slug)[flag]=true;
    fs.writeFileSync(path.join(scratch,'data/articles.json'),JSON.stringify(unpublished));
    await assert.rejects(buildStaticContentPages(scratch),/not published/);
    assert.equal(read('korean-coin-tissue.html',scratch),updated,'Unpublishing requires a reviewed route removal, never silently generates stale/draft content');
  }

  // Exercise every supported body block and escaping path against real code.
  const renderer=articleRenderers(root);
  const body=new RenderElement('div');
  renderer.renderArticleBody(body,[
    {type:'heading',text:'A <heading>'},{type:'paragraph',text:'Text & text'},
    {type:'list',items:['One <item>','Two']},{type:'quote',text:'Quoted <text>'},
    {type:'image',src:'image.jpg',alt:'Image <alt>',caption:'Caption & text',width:640,height:480},
    {type:'definition-list',items:[{term:'A <term>',description:'A & description'}]},
    {type:'ad-break',slot:'article-mid'}
  ],coin);
  assert.match(body.innerHTML,/<h2>A &lt;heading&gt;<\/h2>/);
  assert.match(body.innerHTML,/<ul><li>One &lt;item&gt;<\/li><li>Two<\/li><\/ul>/);
  assert.match(body.innerHTML,/<blockquote>Quoted &lt;text&gt;<\/blockquote>/);
  assert.match(body.innerHTML,/<figure class="data-article-inline-image"><img[^>]*width="640"[^>]*height="480"/);
  assert.match(body.innerHTML,/<figcaption>Caption &amp; text<\/figcaption>/);
  assert.match(body.innerHTML,/<dl class="article-definition-list"><div><dt>A &lt;term&gt;<\/dt><dd>A &amp; description<\/dd>/);
  assert.doesNotMatch(body.innerHTML,/ad-slot|adsbygoogle/,'Prerender does not activate or insert ads');

  // The real failure path keeps only a known static fallback, not withdrawn data.
  async function failureState({prerendered=true,loadedArticles=null}) {
    const loading={hidden:false};
    const article={hidden:false,dataset:prerendered?{prerendered:'true'}:{}};
    const error={hidden:true};
    const nodes={'[data-article-loading]':loading,'[data-article]':article,'[data-article-error]':error};
    const context=vm.createContext({
      URLSearchParams,window:{},location:{search:''},
      document:{documentElement:{dataset:{articleSlug:coin.slug}},querySelector:selector=>nodes[selector]||null},
      fetch:async filename=>{
        if(loadedArticles===null)throw new Error('offline');
        return {ok:true,json:async()=>filename.includes('articles')?loadedArticles:[]};
      }
    });
    vm.runInContext(read('js/article.js').replace(/\nloadArticle\(\);\s*$/,'\nglobalThis.ready=loadArticle();'),context);
    await context.ready;
    return {loading:loading.hidden,article:article.hidden,error:error.hidden};
  }
  assert.deepEqual(await failureState({}),{loading:true,article:false,error:true},'No JSON or bundle: retain static article');
  assert.deepEqual(await failureState({prerendered:false}),{loading:true,article:true,error:false},'Generic routes retain their error state');
  assert.deepEqual(await failureState({loadedArticles:[]}),{loading:true,article:true,error:false},'Successful response withdrawing the article is respected');
  assert.deepEqual(await failureState({loadedArticles:[{...coin,draft:true}]}),{loading:true,article:true,error:false});
} finally {
  fs.rmSync(scratch,{recursive:true,force:true});
}
console.log('PASS: exact runtime parity; full no-JS article; preserved head/footer/product grids; two-pass idempotence; read-only stale checks; changed public content; escaping; all body blocks; withdrawn routes; offline fallback; no ad activation.');
