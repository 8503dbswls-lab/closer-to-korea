import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {loadEditorialMaster,saveEditorialMaster} from './editorial-source.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ctk-master-test-'));
try{
 const root=path.join(dir,'public'),privateDir=path.join(dir,'private');fs.mkdirSync(root);fs.mkdirSync(privateDir);
 const file=path.join(privateDir,'source.json');
 const full={schemaVersion:'ctk-editorial-master-v1',articles:[{id:'public-example',draft:false,title:'Example'},{id:'private-example',draft:true,notes:'synthetic private sentinel'}],products:[],categories:{},siteCopy:{},monetization:{},searchAliases:{articles:{},products:{}},privateMetadata:'synthetic source metadata'};
 fs.writeFileSync(file,JSON.stringify(full));const first=loadEditorialMaster(root,file);
 assert.throws(()=>loadEditorialMaster(root),/CTK_EDITORIAL_MASTER/);
 const inside=path.join(root,'source.json');fs.writeFileSync(inside,JSON.stringify(full));assert.throws(()=>loadEditorialMaster(root,inside),/outside/);
 fs.symlinkSync(inside,path.join(privateDir,'inside-link'));assert.throws(()=>loadEditorialMaster(root,path.join(privateDir,'inside-link')),/outside/);
 assert.throws(()=>saveEditorialMaster(root,{...full,articles:[full.articles[0]]},{path:file,expectedDigest:first.digest}),/remove/);
 assert.equal(loadEditorialMaster(root,file).digest,first.digest);
 assert.throws(()=>saveEditorialMaster(root,full,{path:file,expectedDigest:'stale'}),/changed/);
 const next=structuredClone(full);next.articles.push({id:'new-example',draft:false,title:'New example'});
 const saved=saveEditorialMaster(root,next,{path:file,expectedDigest:first.digest});
 assert.deepEqual(saved.data.articles.slice(0,2),full.articles);assert.equal(saved.data.privateMetadata,full.privateMetadata);
 assert.equal(fs.readdirSync(path.join(privateDir,'.ctk-editorial-backups')).length,1);
 const backup=path.join(privateDir,'.ctk-editorial-backups',fs.readdirSync(path.join(privateDir,'.ctk-editorial-backups'))[0]);
 assert.deepEqual(JSON.parse(fs.readFileSync(backup,'utf8')),full);
 assert.throws(()=>saveEditorialMaster(root,next,{path:file,expectedDigest:first.digest}),/changed/);
 console.log('PASS: external-only master; no partial-source record loss; optimistic concurrency; preserved draft/internal fields; recoverable external backup.');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
