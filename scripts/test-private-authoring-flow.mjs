import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {loadEditorialMaster,saveEditorialMaster} from './editorial-source.mjs';
const require=createRequire(import.meta.url);
const projection=require('../js/public-content.js');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'ctk-private-tests-'));
const root=path.join(temp,'public'); fs.mkdirSync(root);
const masterPath=path.join(temp,'private-master.json');
const master={schemaVersion:'ctk-editorial-master-v1',products:[{id:'draft-product',draft:true,privateNotes:'KEEP',images:[]}],articles:[{id:'draft-article',draft:true,unknownEvidence:{keep:true}}],categories:{},siteCopy:{},monetization:{},searchAliases:{},unknownTopLevel:{keep:true}};
fs.writeFileSync(masterPath,JSON.stringify(master));
const previous=process.env.CTK_EDITORIAL_MASTER;
process.env.CTK_EDITORIAL_MASTER=masterPath;
let handler;let gitCalls=0;
const fakeProcess={...process,env:{...process.env,CTK_ADMIN_PORT:'18787'},once(){},exit(){throw new Error('unexpected exit');}};
const context={fs,path,crypto,os,process:fakeProcess,console,URL,Buffer,setTimeout,clearTimeout,loadEditorialMaster,saveEditorialMaster,...projection,
  fileURLToPath:()=>'/tmp/fixture/scripts/local-admin-server.mjs',
  spawn(){throw new Error('Unexpected process spawn');},spawnSync(){gitCalls++;return {status:1,stdout:'',stderr:'Blocked in focused test'};},
  http:{createServer(fn){handler=fn;return {listen(){}};}}
};
let script=fs.readFileSync(new URL('./local-admin-server.mjs',import.meta.url),'utf8')
 .replace(/^import .*;\n/gm,'')
 .replace("const require=createRequire(import.meta.url);\n",'')
 .replace("const {projectContent,createPublicBundle,assertPublicContent}=require('../js/public-content.js');\n",'')
 .replace("const scriptDir=path.dirname(fileURLToPath(import.meta.url));", "const scriptDir='/tmp/fixture/scripts';")
 .replace("const root=path.resolve(scriptDir,'..');",`const root=${JSON.stringify(root)};`);
script+='\nglobalThis.testApi={sessionToken,stageImagePayload,referencedImagePaths,savePrivateWorkingCopy,copyReferencedStagedImages,publicAssetSource,cleanupStaging,validLocalOrigin,safePath};';
vm.createContext(context);vm.runInContext(script,context);
const api=context.testApi;
try{
  const req={headers:{host:'127.0.0.1:18787'}};
  assert.equal(api.validLocalOrigin(req),true);
  assert.equal(api.validLocalOrigin({headers:{host:'evil.example:18787'}}),false);
  assert.equal(api.validLocalOrigin({headers:{host:'127.0.0.1:18787',origin:'https://evil.example'}}),false);
  assert.equal(api.safePath('/.git/config'),null);
  assert.equal(api.safePath('/../private-master.json'),null);
  assert.equal(api.safePath('/scripts/local-admin-server.mjs'),null);
  const request=async(url,headers={})=>{let status,body;const res={writeHead(code){status=code;},end(value){body=value;}};await handler({url,method:'GET',headers:{host:'127.0.0.1:18787',...headers}},res);return {status,body:JSON.parse(body)};};
  assert.equal((await request('/api/editorial-source')).status,403);
  const read=await request('/api/editorial-source',{'x-ctk-publish-token':api.sessionToken});
  assert.equal(read.status,200);assert.equal(read.body.master.products[0].privateNotes,'KEEP');
  assert.match(read.body.digest,/^[a-f0-9]{64}$/);
  const imageBytes=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1,2,3]);
  const staged=api.stageImagePayload({filename:'draft-photo.png',mimeType:'image/png',dataBase64:imageBytes.toString('base64')});
  const next=structuredClone(master);next.products[0].images=[{src:staged.path,alt:'Draft gallery'}];next.articles[0].cardImage=staged.path;
  assert(api.referencedImagePaths(next).has(staged.path));
  const saved=api.savePrivateWorkingCopy({master:next,expectedDigest:read.body.digest});
  assert.equal(saved.data.products[0].privateNotes,'KEEP');assert.equal(saved.data.unknownTopLevel.keep,true);
  assert(fs.existsSync(path.join(`${masterPath}.assets`,staged.path)));
  assert(!fs.existsSync(path.join(root,staged.path)));
  assert.equal(fs.readdirSync(path.join(temp,'.ctk-editorial-backups')).length,1);
  assert.throws(()=>api.savePrivateWorkingCopy({master:next,expectedDigest:read.body.digest}),/changed/);
  const missing=structuredClone(next);missing.products=[];
  assert.throws(()=>api.savePrivateWorkingCopy({master:missing,expectedDigest:saved.digest}),/remove/);
  assert.throws(()=>api.savePrivateWorkingCopy({products:[],articles:[]}),/complete private master/);
  assert.deepEqual([...api.copyReferencedStagedImages({products:[],articles:[]},masterPath)],[]);
  assert(!fs.existsSync(path.join(root,staged.path)));
  const copied=api.copyReferencedStagedImages({products:[{images:[{src:staged.path}]}],articles:[]},masterPath);
  assert.equal(copied[0],staged.path);assert(fs.readFileSync(path.join(root,staged.path)).equals(imageBytes));
  assert.equal(gitCalls,0,'No Git or other external process calls were allowed in these tests');
  console.log('PASS: 22 focused checks: token/host/origin/path boundaries, private master/digest preservation, stale/missing-ID rejection, private gallery/card image durability, draft exclusion from public copies, explicit public referenced copying. No Git or publish actions.');
}finally{
  api.cleanupStaging();
  if(previous===undefined)delete process.env.CTK_EDITORIAL_MASTER;else process.env.CTK_EDITORIAL_MASTER=previous;
  fs.rmSync(temp,{recursive:true,force:true});
}
