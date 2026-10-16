import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const {assertPublicContent,assertPublicBundle,createPublicBundle}=createRequire(import.meta.url)('../js/public-content.js');
const root=process.cwd();
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'data',name+'.json'),'utf8'));
const source={articles:read('articles'),products:read('products'),searchAliases:read('search-aliases'),categories:read('categories'),siteCopy:read('site-copy'),monetization:read('monetization')};
assertPublicContent(source);
const text=fs.readFileSync(path.join(root,'data/content-data.js'),'utf8');
const match=text.match(/^window\.__CTK_DATA__ = (\{[\s\S]*\});\s*$/);
assert.ok(match,'Public fallback must be a single data assignment');
const bundle=JSON.parse(match[1]);assertPublicBundle(bundle);
assert.deepEqual(bundle,createPublicBundle(source),'Public fallback must match canonical public JSON');
function inspect(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(entry.name==='.git'||entry.name==='node_modules')continue;
  const file=path.join(dir,entry.name),relative=path.relative(root,file).replaceAll('\\','/');
  assert.ok(!/(^|\/)(backup_before_[^/]*|\.ctk-editorial-backups|private-source)(\/|$)|(^|\/)[^/]*editorial-master[^/]*\.json$/i.test(relative),`Private source/backup path found in public tree: ${relative}`);
  assert.ok(!/\.ctk-\d+\.tmp$/.test(relative),`Temporary source file found: ${relative}`);
  if(entry.isDirectory())inspect(file);
  else if(entry.name.endsWith('.json')){
   const value=JSON.parse(fs.readFileSync(file,'utf8'));
   assert.notEqual(value?.schemaVersion,'ctk-editorial-master-v1',`Full private master found in public tree: ${relative}`);
  }
 }
}
inspect(root);
const articleSlugs=new Set(source.articles.map(item=>item.slug));
for(const name of fs.readdirSync(root).filter(name=>name.endsWith('.html'))){
 const html=fs.readFileSync(path.join(root,name),'utf8');
 const match=html.match(/data-article-slug=["']([^"']+)["']/);
 if(match)assert.ok(articleSlugs.has(match[1]),`Unpublished static article still exists: ${name}. Back up and remove it from the public output before publishing.`);
}

console.log(`PASS: public-only JSON/bundle boundary, ${source.articles.length} articles and ${source.products.length} products; no private master or backup paths.`);
