import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {spawnSync} from 'node:child_process';

const scriptDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(scriptDir,'..');
const host='127.0.0.1';
const port=Number(process.env.CTK_ADMIN_PORT||8787);
const sessionToken=crypto.randomBytes(32).toString('hex');
const stagingRoot=fs.mkdtempSync(path.join(os.tmpdir(),'ctk-local-publish-'));
const stagedImages=new Map();
const allowedImageTypes=new Map([['image/jpeg','jpg'],['image/png','png'],['image/webp','webp']]);
const maxImageBytes=12*1024*1024;

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

function safePath(urlPath){
  const decoded=decodeURIComponent(urlPath.split('?')[0]);
  const relative=decoded==='/'?'index.html':decoded.replace(/^\/+/, '');
  const resolved=path.resolve(root,relative);
  const rel=path.relative(root,resolved);
  if(rel.startsWith('..')||path.isAbsolute(rel))return null;
  return resolved;
}

function validLocalOrigin(req){
  const origin=req.headers.origin;
  if(!origin)return true;
  return origin===`http://${host}:${port}` || origin===`http://localhost:${port}`;
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

function rollbackTo(head){
  const reset=git(["reset","--hard",head]);
  const clean=git(["clean","-fd"]);
  return reset.status===0 && clean.status===0;
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
  if(!payload || typeof payload!=="object")throw Object.assign(new Error("Publish payload is required."),{statusCode:400});
  if(!Array.isArray(payload.products) || !Array.isArray(payload.articles)){
    throw Object.assign(new Error("Publish payload must contain products and articles arrays."),{statusCode:400});
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
  (payload.products||[]).forEach(product=>{
    if(product?.image)paths.add(String(product.image));
  });
  (payload.articles||[]).forEach(article=>{
    if(article?.heroImage)paths.add(String(article.heroImage));
    (article?.body||[]).forEach(block=>{
      if(block?.type==="image"&&block.src)paths.add(String(block.src));
    });
  });
  return paths;
}

function copyReferencedStagedImages(payload){
  const copied=[];
  for(const relativePath of referencedImagePaths(payload)){
    const staged=stagedImages.get(relativePath);
    if(!staged)continue;
    const target=path.resolve(root,relativePath);
    const rel=path.relative(root,target);
    if(rel.startsWith("..")||path.isAbsolute(rel))throw Object.assign(new Error("A staged image resolved outside the project folder."),{statusCode:400});
    if(!rel.replaceAll("\\","/").startsWith("assets/images/uploads/"))throw Object.assign(new Error("Staged images may only publish under assets/images/uploads/."),{statusCode:400});
    if(fs.existsSync(target)){
      const existing=fs.readFileSync(target);
      const stagedBytes=fs.readFileSync(staged.tempPath);
      if(!existing.equals(stagedBytes))throw Object.assign(new Error(`Image target already exists with different contents: ${relativePath}`),{statusCode:409});
      continue;
    }
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.copyFileSync(staged.tempPath,target);
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
  const info=gitInfo();
  if(!info.available)throw Object.assign(new Error("This folder is not a Git repository."),{statusCode:409});
  if(!info.branch)throw Object.assign(new Error("Publishing from a detached Git HEAD is not allowed."),{statusCode:409});
  if(!info.hasOrigin)throw Object.assign(new Error("Git origin is not configured. Clone the real repository or configure origin before publishing."),{statusCode:409});
  if(workingTreeStatus())throw Object.assign(new Error("The Git working tree is not clean. Commit, discard, or back up local changes before publishing."),{statusCode:409});

  const headBefore=gitText(["rev-parse","HEAD"]);
  const fetch=git(["fetch","--quiet","origin",info.branch]);
  if(fetch.status!==0)throw Object.assign(new Error(`Could not fetch origin/${info.branch}: ${(fetch.stderr||fetch.stdout||"fetch failed").trim()}`),{statusCode:502});
  let remoteHead;
  try{
    remoteHead=gitText(["rev-parse",`refs/remotes/origin/${info.branch}`]);
  }catch{
    throw Object.assign(new Error(`origin/${info.branch} was not found after fetch.`),{statusCode:409});
  }
  if(headBefore!==remoteHead){
    throw Object.assign(new Error(`Local ${info.branch} is not synchronized with origin/${info.branch}. Update the local repository before publishing.`),{statusCode:409});
  }

  let wroteFiles=false;
  let copiedImages=[];
  try{
    atomicWriteJson("data/products.json",payload.products);
    atomicWriteJson("data/articles.json",payload.articles);
    wroteFiles=true;
    copiedImages=copyReferencedStagedImages(payload);

    const prepare=run(process.execPath,["scripts/prepare-deploy.mjs"]);
    if(prepare.status!==0){
      const details=[prepare.stdout,prepare.stderr].filter(Boolean).join("\n").trim();
      throw Object.assign(new Error(`Deployment validation failed.\n${details}`.trim()),{statusCode:422});
    }

    const status=workingTreeStatus();
    if(!status){
      return {ok:true,noChanges:true,message:"Validation passed. There were no file changes to publish."};
    }

    const add=git(["add","--all"]);
    if(add.status!==0)throw Object.assign(new Error((add.stderr||add.stdout||"git add failed").trim()),{statusCode:500});
    const commitMessage=`Publish content from local admin ${new Date().toISOString().replace(/\.\d{3}Z$/,"Z")}`;
    const commit=git(["commit","-m",commitMessage]);
    if(commit.status!==0)throw Object.assign(new Error((commit.stderr||commit.stdout||"git commit failed").trim()),{statusCode:500});

    const push=git(["push","origin",`HEAD:${info.branch}`]);
    if(push.status!==0)throw Object.assign(new Error(`Git push failed: ${(push.stderr||push.stdout||"push failed").trim()}`),{statusCode:502});

    const headAfter=gitText(["rev-parse","HEAD"]);
    clearPublishedStagedImages(copiedImages);
    return {
      ok:true,
      noChanges:false,
      commit:headAfter,
      branch:info.branch,
      publishedImages:copiedImages,
      message:`Published successfully to origin/${info.branch}.`
    };
  }catch(error){
    if(wroteFiles){
      const rolledBack=rollbackTo(headBefore);
      if(!rolledBack)error.message=`${error.message}\nAutomatic rollback also failed. Stop and inspect the local repository manually.`;
    }
    throw error;
  }
}

const server=http.createServer(async (req,res)=>{
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
    try{
      const payload=await readJsonBody(req);
      const result=await publishWorkingCopy(payload);
      return json(res,200,result);
    }catch(error){
      const status=Number(error?.statusCode)||500;
      return json(res,status,{ok:false,error:error?.message||'Local publish failed.'});
    }
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
