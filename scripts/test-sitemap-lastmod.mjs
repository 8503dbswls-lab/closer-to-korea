import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {contentLastmod} from './sitemap-lastmod.mjs';

const date=item=>contentLastmod(item,'2026-10-28');
assert.equal(date({publishedAt:'2026-10-01',updatedAt:'2026-10-18'}),'2026-10-18');
assert.equal(date({publishedAt:'2024-02-29'}),'2024-02-29');
for(const updatedAt of [undefined,null,''])assert.equal(date({publishedAt:'2026-10-01',updatedAt}),'2026-10-01');
for(const updatedAt of ['2026-02-30','2026-13-01','2026-10-29','2026-09-30','yesterday','2026-10-18T00:00:00Z']){
  assert.equal(date({publishedAt:'2026-10-01',updatedAt}),null);
}
for(const publishedAt of [undefined,'','2025-02-29','2026-10-29'])assert.equal(date({publishedAt,updatedAt:'2026-10-18'}),null);
assert.equal(date({publishedAt:'2026-10-01',draft:true}),null);
assert.equal(date({publishedAt:'2026-10-01',hidden:true}),null);
const root=process.cwd();
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'ctk-lastmod-'));
const read=file=>fs.readFileSync(path.join(scratch,file),'utf8');
const entries=xml=>new Map([...xml.matchAll(/<url><loc>(.*?)<\/loc>(?:<lastmod>(.*?)<\/lastmod>)?<\/url>/g)].map(m=>[m[1],m[2]||null]));
try{
  fs.cpSync(root,scratch,{recursive:true,filter:src=>!['.git','node_modules'].includes(path.basename(src))});
  const before=entries(read('sitemap.xml'));
  const protectedFiles=new Map(fs.readdirSync(scratch).filter(f=>f.endsWith('.html')||f==='robots.txt').map(f=>[f,read(f)]));
  const run=()=>{
    const result=spawnSync(process.execPath,['scripts/sync-site-structure.mjs'],{cwd:scratch,encoding:'utf8'});
    assert.equal(result.status,0,result.stdout+result.stderr);
    return read('sitemap.xml');
  };
  const xml=run();
  const after=entries(xml);
  assert.deepEqual([...after.keys()],[...before.keys()],'Preserve URL order and set');
  const content=new Map();
  for(const kind of ['articles','products'])for(const item of JSON.parse(read(`data/${kind}.json`))){
    if(item.draft||(kind==='products'&&item.hidden))continue;
    content.set(`https://closertokorea.com/${kind==='products'?'product-':''}${encodeURIComponent(item.slug)}.html`,item);
  }
  for(const [url,lastmod] of after)assert.equal(lastmod,content.has(url)?contentLastmod(content.get(url)):null,url);
  for(const slug of ['korean-restaurant-table-utensil-drawer','korean-kimchi-cutter-container','korea-remove-shoes-home-accommodation'])assert.equal(after.get(`https://closertokorea.com/${slug}.html`),'2026-10-18');
  for(const [file,original] of protectedFiles)assert.equal(read(file),original,`${file} unchanged (including canonical and robots)`);
  assert.equal(run(),xml,'Idempotent regeneration');
  const articles=JSON.parse(read('data/articles.json'));
  articles[0].updatedAt='2026-10-20';
  const added={...articles[0],slug:'lastmod-published-fixture',publishedAt:'2026-10-21',updatedAt:''};
  articles.push(added,{...added,slug:'lastmod-draft-fixture',draft:true});
  fs.writeFileSync(path.join(scratch,'data/articles.json'),JSON.stringify(articles));
  const changed=entries(run());
  assert.equal(changed.get(`https://closertokorea.com/${articles[0].slug}.html`),'2026-10-20');
  assert.equal(changed.get('https://closertokorea.com/lastmod-published-fixture.html'),'2026-10-21');
  assert.ok(!changed.has('https://closertokorea.com/lastmod-draft-fixture.html'));
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
console.log('PASS: date validation, publication fallback, uncertain-date omission, 3 October updates, URL and HTML/robots preservation, idempotence, automatic publish/edit regeneration.');
