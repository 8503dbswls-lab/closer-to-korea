import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {loadEditorialMaster} from './editorial-source.mjs';
import {writePublicContent} from './export-public-content.mjs';
const require=createRequire(import.meta.url);
const {createPublicBundle,assertPublicContent}=require('../js/public-content.js');
const root=process.cwd();
const at=process.argv.indexOf('--source');
if(at>=0){
  const master=loadEditorialMaster(root,process.argv[at+1]);
  writePublicContent(root,master.data);
  console.log('Generated public content from the complete private master; source unchanged.');
}else{
  // Rebuilding an already-public fallback is safe; it is never authoring input.
  const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
  const source={products:read('data/products.json'),articles:read('data/articles.json'),categories:read('data/categories.json'),siteCopy:read('data/site-copy.json'),monetization:read('data/monetization.json'),searchAliases:read('data/search-aliases.json')};
  assertPublicContent(source);
  const bundle=createPublicBundle(source);
  fs.writeFileSync(path.join(root,'data/content-data.js'),`window.__CTK_DATA__ = ${JSON.stringify(bundle)};\n`,'utf8');
  console.log(`Generated public fallback with ${bundle.products.length} products and ${bundle.articles.length} articles.`);
}
