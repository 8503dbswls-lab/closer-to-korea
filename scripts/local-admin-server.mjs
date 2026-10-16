import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {loadEditorialMaster,saveEditorialMaster} from './editorial-source.mjs';
const require=createRequire(import.meta.url);
const {projectContent,createPublicBundle,assertPublicContent}=require('../js/public-content.js');

const scriptDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(scriptDir,'..');
const host='127.0.0.1';
const port=Number(process.env.CTK_ADMIN_PORT||8787);
const sessionToken=crypto.randomBytes(32).toString('hex');
const stagingRoot=fs.mkdtempSync(path.join(os.tmpdir(),'ctk-local-publish-'));
const stagedImages=new Map();
const allowedImageTypes=new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]);
const maxImageBytes=12*1024*1024;
let mutationPending=false;

const mimeTypes={
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.xml':'application/xml; charset=utf-8',
  '.txt':'text/plain; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.ico':'image/x-icon'
};

function json(res,status,payload){
  res.writeHead(status,{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  });
  res.end(JSON.stringify(payload));
}

function gitInfo(){
  const inside=spawnSync('git',['rev-parse','--is-inside-work-tree'],{cwd:root,encoding:'utf8'});
  const branch=spawnSync('git',['branch','--show-current'],{cwd:root,encoding:'utf8'});
  const remote=spawnSync('git',['remote','get-url','origin'],{cwd:root,encoding:'utf8'});
  return {
    available:inside.status===0 && inside.stdout.trim()==='true',
    branch:branch.status===0?branch.stdout.trim():'',
    hasOrigin:remote.status===0 && Boolean(remote.stdout.trim())
  };
}

function isInside(parent,candidate){
  const relative=path.relative(parent,candidate);
  return relative==='' || (!relative.startsWith(`..${path.sep}`) && relative!=='..' && !path.isAbsolute(relative));
}

function safePath(urlPath){
  let decoded;
  try{decoded=decodeURIComponent(urlPath.split('?')[0]);}catch{return null;}
  const relative=decoded==='/'?'index.html':decoded.replace(/^\/+/, '');
  if(relative.split(/[\\/]/).some(part=>part.startsWith('.')))return null;
  if(!/^(?:[^/]+\.(?:html|txt|xml|ico)|(?:assets|css|js|data)\/)/.test(relative))return null;
  const resolved=path.resolve(root,relative);
  if(!isInside(root,resolved))return null;
  try{if(!isInside(fs.realpathSync(root),fs.realpathSync(resolved)))return null;}catch{return null;}
  return resolved;
}

function validLocalOrigin(req){
  const allowedHosts=new Set([`${host}:${port}`,`localhost:${port}`]);
  if(!allowedHosts.has(req.headers.host))return false;
  const origin=req.headers.origin;
  if(origin && origin!==`http://${host}:${port}` && origin!==`http://localhost:${port}`)return false;
  return !req.headers['sec-fetch-site'] || ['same-origin','none'].includes(req.headers['sec-fetch-site']);
}

function run(command,args,{cwd=root}={}){
  return spawnSync(command,args,{cwd,encoding:"utf8",maxBuffer:20*1024*1024});
}

function git(args){
  return run("git",args);
}

function gitText(args){
  const result=git(args);
  if(result.status!==0)throw new Error((result.stderr||result.stdout||`git ${args.join(" ")} failed`).trim());
  return result.stdout.trim();
}

function workingTreeStatus(){
  return gitText(["status","--porcelain"]);
}

// Only generated paths owned by this operation can be restored or staged.
const generatedFiles=new Set([
  'data/products.json','data/articles.json','data/search-aliases.json','data/categories.json',
  'data/site-copy.json','data/monetization.json','data/content-data.js','sitemap.xml','ads.txt',
  'about.html',
  'admin.html',
  'advertising-disclosure.html',
  'affiliate-disclosure.html',
  'article-daiso-egg-maker.html',
  'article.html',
  'contact.html',
  'editorial-policy.html',
  'everyday-korea.html',
  'index.html',
  'k-beauty.html',
  'korea-remove-shoes-home-accommodation.html',
  'korean-bbq-ssam-lettuce-perilla-wraps.html',
  'korean-coin-tissue.html',
  'korean-kimchi-cutter-container.html',
  'korean-kitchen.html',
  'korean-microwave-steamed-egg-cooker.html',
  'korean-restaurant-banchan-refills.html',
  'korean-restaurant-call-buttons.html',
  'korean-restaurant-table-utensil-drawer.html',
  'privacy-policy.html',
  'product-egg-steamer.html',
  'product-grape-wakppubol.html',
  'product-guides.html',
  'product-kimchi-cutter-container.html',
  'product.html',
  'scissor-style-tongs-lee-guk-joo.html',
  'search.html',
  'seen-online.html',
  'seoul-finds.html',
  'storage-chairs-korean-bbq-restaurants.html',
  'terms.html',
  'trending-now.html',
  'trends-finds.html',
  'what-is-wakppubol-korean-wax-cracking-toy.html',
]);

function snapshotFiles(paths){
  return new Map([...paths].map(relative=>{
    const filename=path.join(root,relative);
    return [relative,fs.existsSync(filename)?fs.readFileSync(filename):null];
  }));
}

function restoreFiles(snapshot){
  for(const [relative,bytes] of snapshot){
    const filename=path.join(root,relative);
    if(bytes===null)fs.rmSync(filename,{force:true});
    else fs.writeFileSync(filename,bytes);
  }
}

function changedPaths(){
  return [...new Set([
    ...gitText(['diff','--name-only','-z']).split('\0'),
    ...gitText(['diff','--cached','--name-only','-z']).split('\0'),
    ...gitText(['ls-files','--others','--exclude-standard','-z']).split('\0')
  ].filter(Boolean))];
}

function atomicWriteJson(relativePath,value){
  const target=path.join(root,relativePath);
  const temp=`${target}.ctk-${process.pid}.tmp`;
  fs.writeFileSync(temp,`${JSON.stringify(value,null,2)}\n`,"utf8");
  fs.renameSync(temp,target);
}

function readJsonBody(req,maxBytes=5*1024*1024){
  return new Promise((resolve,reject)=>{
    const chunks=[];
    let size=0;
    req.on("data",chunk=>{
      size+=chunk.length;
      if(size>maxBytes){
        reject(Object.assign(new Error("Publish payload is too large."),{statusCode:413}));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end",()=>{
      try{
        const text=Buffer.concat(chunks).toString("utf8");
        resolve(JSON.parse(text||"{}"));
      }catch{
        reject(Object.assign(new Error("Publish payload must be valid JSON."),{statusCode:400}));
      }
    });
    req.on("error",reject);
  });
}

function validatePublishPayload(payload){
  if(!payload || typeof payload!=="object" || payload.master?.schemaVersion!=="ctk-editorial-master-v1" ||
    !Array.isArray(payload.master.products) || !Array.isArray(payload.master.articles) ||
    typeof payload.expectedDigest!=="string" || !/^[a-f0-9]{64}$/.test(payload.expectedDigest)){
    throw Object.assign(new Error("A complete private master and its loaded revision digest are required. Public arrays are not an editorial source."),{statusCode:400});
  }
}

function safeImageStem(filename="image"){
  const parsed=path.parse(String(filename));
  const stem=parsed.name.toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,48);
  return stem||"image";
}

function detectImageMime(bytes){
  if(bytes.length>=3 && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff)return "image/jpeg";
  if(bytes.length>=8 && bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return "image/png";
  if(bytes.length>=12 && bytes.subarray(0,4).toString("ascii")==='RIFF' && bytes.subarray(8,12).toString("ascii")==='WEBP')return "image/webp";
  return "";
}

function decodeBase64Strict(value){
  const compact=String(value||"").replace(/\s+/g,"");
  if(!compact || compact.length%4!==0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)){
    throw Object.assign(new Error("Image data is not valid base64."),{statusCode:400});
  }
  const bytes=Buffer.from(compact,"base64");
  if(bytes.toString("base64").replace(/=+$/,'')!==compact.replace(/=+$/,'')){
    throw Object.assign(new Error("Image data is not valid base64."),{statusCode:400});
  }
  return bytes;
}

function stageImagePayload(payload){
  if(!payload||typeof payload!=="object")throw Object.assign(new Error("Image payload is required."),{statusCode:400});
  const declaredMimeType=String(payload.mimeType||"").toLowerCase();
  if(!allowedImageTypes.has(declaredMimeType))throw Object.assign(new Error("Only JPG, PNG, and WebP images can be staged."),{statusCode:415});
  const bytes=decodeBase64Strict(payload.dataBase64);
  if(!bytes.length)throw Object.assign(new Error("The selected image is empty."),{statusCode:400});
  if(bytes.length>maxImageBytes)throw Object.assign(new Error("Images must be 12 MB or smaller."),{statusCode:413});

  const detectedMimeType=detectImageMime(bytes);
  if(!detectedMimeType)throw Object.assign(new Error("The selected file is not a valid JPG, PNG, or WebP image."),{statusCode:415});
  if(detectedMimeType!==declaredMimeType){
    throw Object.assign(new Error(`Image type mismatch: the browser reported ${declaredMimeType}, but the file contents are ${detectedMimeType}.`),{statusCode:415});
  }
  const extension=allowedImageTypes.get(detectedMimeType);
  const hash=crypto.createHash("sha256").update(bytes).digest("hex").slice(0,10);
  const stem=safeImageStem(payload.filename);
  const relativePath=`assets/images/uploads/${stem}-${hash}.${extension}`;
  const tempPath=path.join(stagingRoot,`${hash}.${extension}`);
  if(!fs.existsSync(tempPath))fs.writeFileSync(tempPath,bytes);
  stagedImages.set(relativePath,{tempPath,mimeType:detectedMimeType,size:bytes.length,originalName:String(payload.filename||"")});
  return {path:relativePath,mimeType:detectedMimeType,size:bytes.length};
}

function referencedImagePaths(payload){
  const paths=new Set();
  const add=value=>{if(typeof value==='string' && value)paths.add(value);};
  for(const product of payload.products||[]){
    add(product.image); add(product.cardImage);
    for(const image of product.images||product.gallery||[])add(typeof image==='string'?image:image?.src||image?.image);
  }
  for(const article of payload.articles||[]){
    add(article.heroImage); add(article.cardImage);
    for(const block of article.body||[]){
      if(block?.type==='image')add(block.src);
      if(block?.type==='gallery')for(const image of block.images||block.items||[])add(typeof image==='string'?image:image?.src||image?.image);
    }
  }
  return paths;
}

function privateAssetPath(masterPath,relativePath){
  if(!/^assets\/images\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/.test(relativePath))return null;
  const assetRoot=`${masterPath}.assets`;
  // The source module verifies that the master is outside the checkout; reject symlinked media directories too.
  let ancestor=assetRoot;
  while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);
  if(isInside(fs.realpathSync(root),fs.realpathSync(ancestor)))throw new Error('Private images must stay outside the public project.');
  const target=path.join(assetRoot,relativePath);
  ancestor=target;
  while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);
  if(!isInside(fs.realpathSync(path.dirname(masterPath)),fs.realpathSync(ancestor)))throw new Error('Private image path escapes its private source folder.');
  return target;
}

function persistPrivateImages(master){
  for(const relativePath of referencedImagePaths(master.data)){
    const staged=stagedImages.get(relativePath);
    if(!staged)continue;
    const target=privateAssetPath(master.path,relativePath);
    if(!target)throw new Error('Invalid staged private image path.');
    fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
    if(fs.existsSync(target)){
      if(!fs.readFileSync(target).equals(fs.readFileSync(staged.tempPath)))throw new Error(`Private image collision: ${relativePath}`);
    }else fs.copyFileSync(staged.tempPath,target,fs.constants.COPYFILE_EXCL);
    fs.chmodSync(target,0o600);
  }
}

function savePrivateWorkingCopy(payload){
  validatePublishPayload(payload);
  const loaded=loadEditorialMaster(root);
  if(loaded.digest!==payload.expectedDigest)throw Object.assign(new Error('The private master changed. Reload it and merge your edits before saving.'),{statusCode:409});
  persistPrivateImages({path:loaded.path,data:payload.master});
  return saveEditorialMaster(root,payload.master,{path:loaded.path,expectedDigest:payload.expectedDigest});
}

function publicAssetSource(masterPath,relativePath){
  const staged=stagedImages.get(relativePath);
  if(staged)return staged.tempPath;
  const privatePath=privateAssetPath(masterPath,relativePath);
  return privatePath && fs.existsSync(privatePath)?privatePath:null;
}

function copyReferencedStagedImages(payload,masterPath){
  const copied=[];
  for(const relativePath of referencedImagePaths(payload)){
    const source=publicAssetSource(masterPath,relativePath);
    if(!source)continue;
    const target=path.resolve(root,relativePath);
    if(!isInside(root,target)||!/^assets\/images\/uploads\/[a-z0-9-]+\.(jpg|png|webp)$/.test(relativePath))throw new Error('Invalid public image target.');
    let ancestor=target;
    while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);
    if(!isInside(fs.realpathSync(root),fs.realpathSync(ancestor)))throw new Error('Public image path escapes the project.');
    if(fs.existsSync(target)){
      if(!fs.readFileSync(target).equals(fs.readFileSync(source)))throw Object.assign(new Error(`Image target already exists with different contents: ${relativePath}`),{statusCode:409});
      continue;
    }
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);
    copied.push(relativePath);
  }
  return copied;
}

function clearPublishedStagedImages(paths){
  paths.forEach(relativePath=>{
    const staged=stagedImages.get(relativePath);
    if(staged){
      try{fs.rmSync(staged.tempPath,{force:true});}catch{}
      stagedImages.delete(relativePath);
    }
  });
}

async function publishWorkingCopy(payload){
  validatePublishPayload(payload);
  // Saving the full private source happens first, before any projection, Git or public-file changes.
  const saved=savePrivateWorkingCopy(payload);
  let snapshot=null;
  let stagedPaths=[];
  let commitCreated=false;
  try{
    const sourceCheck=run(process.execPath,["scripts/validate-content.mjs","--source",saved.path,"--evidence-only"]);
    if(sourceCheck.status!==0)throw Object.assign(new Error(`Private editorial evidence validation failed.\n${[sourceCheck.stdout,sourceCheck.stderr].filter(Boolean).join("\n").trim()}`),{statusCode:422});
    const projection=projectContent(saved.data);
    const bundle=createPublicBundle(saved.data);
    assertPublicContent(projection); assertPublicContent(bundle);
    const info=gitInfo();
    if(!info.available)throw Object.assign(new Error("This folder is not a Git repository."),{statusCode:409});
    if(!info.branch)throw Object.assign(new Error("Publishing from a detached Git HEAD is not allowed."),{statusCode:409});
    if(!info.hasOrigin)throw Object.assign(new Error("Git origin is not configured."),{statusCode:409});
    if(workingTreeStatus())throw Object.assign(new Error("The Git working tree is not clean. Keep or commit existing changes separately before publishing."),{statusCode:409});
    const headBefore=gitText(['rev-parse','HEAD']);
    const fetch=git(['fetch','--quiet','origin',info.branch]);
    if(fetch.status!==0)throw Object.assign(new Error(`Could not fetch origin/${info.branch}: ${(fetch.stderr||fetch.stdout||'fetch failed').trim()}`),{statusCode:502});
    const remoteHead=gitText(['rev-parse',`refs/remotes/origin/${info.branch}`]);
    if(headBefore!==remoteHead)throw Object.assign(new Error(`Local ${info.branch} is not synchronized with origin/${info.branch}. Update the repository before publishing.`),{statusCode:409});

    const publicAssets=[...referencedImagePaths(projection)].filter(relative=>publicAssetSource(saved.path,relative));
    const allowedPaths=new Set([...generatedFiles,...publicAssets]);
    snapshot=snapshotFiles(allowedPaths);
    atomicWriteJson('data/products.json',projection.products);
    atomicWriteJson('data/articles.json',projection.articles);
    atomicWriteJson('data/search-aliases.json',projection.searchAliases);
    atomicWriteJson('data/categories.json',bundle.categories);
    atomicWriteJson('data/site-copy.json',bundle.siteCopy);
    atomicWriteJson('data/monetization.json',bundle.monetization);
    const bundleFile=path.join(root,'data/content-data.js');
    const bundleTemp=`${bundleFile}.ctk-${process.pid}.tmp`;
    fs.writeFileSync(bundleTemp,`window.__CTK_DATA__ = ${JSON.stringify(bundle)};\n`,'utf8');
    fs.renameSync(bundleTemp,bundleFile);
    const copiedImages=copyReferencedStagedImages(projection,saved.path);
    const prepare=run(process.execPath,['scripts/prepare-deploy.mjs']);
    if(prepare.status!==0)throw Object.assign(new Error(`Deployment validation failed.\n${[prepare.stdout,prepare.stderr].filter(Boolean).join('\n').trim()}`),{statusCode:422});
    const changed=changedPaths();
    const unexpected=changed.filter(relative=>!allowedPaths.has(relative));
    if(unexpected.length)throw new Error(`Unexpected generated changes were not staged: ${unexpected.join(', ')}`);
    if(!changed.length)return {ok:true,noChanges:true,masterDigest:saved.digest,message:'Private master saved. Validation passed; no public changes to publish.'};
    stagedPaths=changed;
    const add=git(['add','--',...stagedPaths]);
    if(add.status!==0)throw new Error((add.stderr||add.stdout||'git add failed').trim());
    const stagedNow=gitText(['diff','--cached','--name-only','-z']).split('\0').filter(Boolean);
    if(stagedNow.some(relative=>!allowedPaths.has(relative)))throw new Error('Unexpected staged files detected. Publishing stopped.');
    const commitMessage=`Publish public content from local admin ${new Date().toISOString().replace(/\.\d{3}Z$/,'Z')}`;
    const commit=git(['commit','-m',commitMessage]);
    if(commit.status!==0)throw new Error((commit.stderr||commit.stdout||'git commit failed').trim());
    commitCreated=true;
    const headAfter=gitText(['rev-parse','HEAD']);
    const push=git(['push','origin',`HEAD:${info.branch}`]);
    if(push.status!==0)throw Object.assign(new Error(`Git push was not confirmed. Local commit ${headAfter} and the private master are preserved. Check the remote before retrying. ${(push.stderr||push.stdout||'push failed').trim()}`),{statusCode:502});
    const remoteCheck=git(['ls-remote','origin',`refs/heads/${info.branch}`]);
    if(remoteCheck.status!==0 || remoteCheck.stdout.trim().split(/\s+/)[0]!==headAfter)throw Object.assign(new Error(`Push returned success, but remote verification was inconclusive. Local commit ${headAfter} and the private master are preserved. Check origin before retrying.`),{statusCode:502});
    clearPublishedStagedImages(copiedImages);
    return {ok:true,noChanges:false,commit:headAfter,branch:info.branch,publishedImages:copiedImages,masterDigest:saved.digest,message:`Private master saved; public content published to origin/${info.branch}.`};
  }catch(error){
    error.masterDigest=saved.digest;
    error.message=`${error.message}\nYour complete private master was saved outside the public project.`;
    if(snapshot && !commitCreated){
      try{
        if(stagedPaths.length){
          const unstage=git(['reset','--quiet','HEAD','--',...stagedPaths]);
          if(unstage.status!==0)throw new Error('Could not unstage generated files.');
        }
        restoreFiles(snapshot);
      }catch(rollbackError){error.message+=`\nGenerated-file restoration failed: ${rollbackError.message}. Inspect the checkout before retrying.`;}
    }
    throw error;
  }
}

const server=http.createServer(async (req,res)=>{
  if(!validLocalOrigin(req))return json(res,403,{ok:false,error:'Local host and same-origin access required.'});
  const url=new URL(req.url||'/',`http://${host}:${port}`);

  if(url.pathname==='/api/session' && req.method==='GET'){
    if(!validLocalOrigin(req))return json(res,403,{ok:false,error:'Origin not allowed.'});
    return json(res,200,{
      ok:true,
      localAdmin:true,
      token:sessionToken,
      git:gitInfo()
    });
  }

  if(url.pathname==='/api/editorial-source'){
    if(!['GET','POST'].includes(req.method))return json(res,405,{ok:false,error:'Method not allowed.'});
    if(req.headers['x-ctk-publish-token']!==sessionToken)return json(res,403,{ok:false,error:'Invalid local publish token.'});
    if(req.method==='GET'){
      try{
        const loaded=loadEditorialMaster(root);
        return json(res,200,{ok:true,master:loaded.data,digest:loaded.digest});
      }catch(error){return json(res,409,{ok:false,error:error.message});}
    }
    if(!String(req.headers['content-type']||'').toLowerCase().includes('application/json'))return json(res,415,{ok:false,error:'Content-Type must be application/json.'});
    if(mutationPending)return json(res,409,{ok:false,error:'Another save or publish is in progress.'});
    mutationPending=true;
    try{
      const saved=savePrivateWorkingCopy(await readJsonBody(req));
      return json(res,200,{ok:true,masterDigest:saved.digest,message:'Complete private master and referenced staged photos saved outside the public project. Nothing published.'});
    }catch(error){return json(res,Number(error.statusCode)||409,{ok:false,error:error.message});}
    finally{mutationPending=false;}
  }

  if(url.pathname==='/api/stage-image'){
    if(req.method!=='POST')return json(res,405,{ok:false,error:'Method not allowed.'});
    if(!validLocalOrigin(req))return json(res,403,{ok:false,error:'Origin not allowed.'});
    if(req.headers['x-ctk-publish-token']!==sessionToken)return json(res,403,{ok:false,error:'Invalid local publish token.'});
    if(!String(req.headers['content-type']||'').toLowerCase().includes('application/json'))return json(res,415,{ok:false,error:'Content-Type must be application/json.'});
    try{
      const payload=await readJsonBody(req,18*1024*1024);
      const staged=stageImagePayload(payload);
      return json(res,200,{ok:true,...staged});
    }catch(error){
      const status=Number(error?.statusCode)||500;
      return json(res,status,{ok:false,error:error?.message||'Image staging failed.'});
    }
  }

  if(url.pathname==='/api/publish'){
    if(req.method!=='POST')return json(res,405,{ok:false,error:'Method not allowed.'});
    if(!validLocalOrigin(req))return json(res,403,{ok:false,error:'Origin not allowed.'});
    if(req.headers['x-ctk-publish-token']!==sessionToken)return json(res,403,{ok:false,error:'Invalid local publish token.'});
    if(!String(req.headers['content-type']||'').toLowerCase().includes('application/json'))return json(res,415,{ok:false,error:'Content-Type must be application/json.'});
    if(mutationPending)return json(res,409,{ok:false,error:'Another save or publish is in progress.'});
    mutationPending=true;
    try{
      const payload=await readJsonBody(req);
      const result=await publishWorkingCopy(payload);
      return json(res,200,result);
    }catch(error){
      const status=Number(error?.statusCode)||500;
      return json(res,status,{ok:false,error:error?.message||'Local publish failed.',masterDigest:error.masterDigest||null});
    }finally{mutationPending=false;}
  }

  if(req.method!=='GET' && req.method!=='HEAD'){
    res.writeHead(405,{'Content-Type':'text/plain; charset=utf-8'});
    return res.end('Method not allowed');
  }

  const target=safePath(url.pathname);
  if(!target)return json(res,400,{ok:false,error:'Invalid path.'});
  let stat;
  try{stat=fs.statSync(target);}catch{return json(res,404,{ok:false,error:'Not found.'});}
  const file=stat.isDirectory()?path.join(target,'index.html'):target;
  if(!fs.existsSync(file))return json(res,404,{ok:false,error:'Not found.'});
  if(!isInside(fs.realpathSync(root),fs.realpathSync(file)))return json(res,403,{ok:false,error:'Path not allowed.'});

  const ext=path.extname(file).toLowerCase();
  res.writeHead(200,{
    'Content-Type':mimeTypes[ext]||'application/octet-stream',
    'Cache-Control':ext==='.html'?'no-store':'no-cache',
    'X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
  });
  if(req.method==='HEAD')return res.end();
  fs.createReadStream(file).pipe(res);
});

server.listen(port,host,()=>{
  const url=`http://${host}:${port}/admin.html`;
  console.log(`Closer to Korea local admin: ${url}`);
  console.log('This server listens on this PC only. Press Ctrl+C to stop.');
  if(process.env.CTK_OPEN_BROWSER==='1' && process.platform==='win32'){
    const child=spawn('cmd',['/c','start','',url],{detached:true,stdio:'ignore'});
    child.unref();
  }
});

function cleanupStaging(){
  try{fs.rmSync(stagingRoot,{recursive:true,force:true});}catch{}
}
process.once("exit",cleanupStaging);
process.once("SIGINT",()=>{cleanupStaging();process.exit(0);});
process.once("SIGTERM",()=>{cleanupStaging();process.exit(0);});
