// Read-only with respect to the private master. Generates only public projections.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {loadEditorialMaster,assertEditorialMaster} from './editorial-source.mjs';
const require=createRequire(import.meta.url);
const publicContent=require('../js/public-content.js');
export function writePublicContent(root,master){
  assertEditorialMaster(master);
  const projected=publicContent.projectContent(master);
  publicContent.assertPublicContent(projected);
  const bundle=publicContent.createPublicBundle(master);
  const files={
    'data/articles.json':JSON.stringify(projected.articles,null,2)+'\n',
    'data/products.json':JSON.stringify(projected.products,null,2)+'\n',
    'data/search-aliases.json':JSON.stringify(projected.searchAliases,null,2)+'\n',
    'data/categories.json':JSON.stringify(bundle.categories,null,2)+'\n',
    'data/site-copy.json':JSON.stringify(bundle.siteCopy,null,2)+'\n',
    'data/monetization.json':JSON.stringify(bundle.monetization,null,2)+'\n',
    'data/content-data.js':`window.__CTK_DATA__ = ${JSON.stringify(bundle)};\n`
  };
  for(const [name,text] of Object.entries(files))fs.writeFileSync(path.join(root,name),text,'utf8');
  return Object.keys(files);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const at=process.argv.indexOf('--source');
  const loaded=loadEditorialMaster(process.cwd(),at>=0?process.argv[at+1]:undefined);
  const files=writePublicContent(process.cwd(),loaded.data);
  console.log(`Generated ${files.length} public-only files. The complete private master was not changed.`);
}
