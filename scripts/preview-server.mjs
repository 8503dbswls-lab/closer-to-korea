import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';

const scriptDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(scriptDir,'..');
const host='127.0.0.1';
const port=8080;

const mimeTypes={
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.webp':'image/webp',
  '.ico':'image/x-icon'
};

function safePath(urlPath){
  const decoded=decodeURIComponent(urlPath.split('?')[0]);
  const relative=decoded==='/'?'index.html':decoded.replace(/^\/+/, '');
  const resolved=path.resolve(root,relative);
  const rel=path.relative(root,resolved);
  if(rel.startsWith('..')||path.isAbsolute(rel))return null;
  return resolved;
}

const server=http.createServer((req,res)=>{
  if(req.method!=='GET'&&req.method!=='HEAD'){
    res.writeHead(405,{'Content-Type':'text/plain; charset=utf-8'});
    return res.end('Method not allowed');
  }

  const target=safePath(req.url||'/');
  if(!target){
    res.writeHead(400,{'Content-Type':'text/plain; charset=utf-8'});
    return res.end('Invalid path');
  }

  let file=target;
  try{
    if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  }catch{
    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    return res.end('Not found');
  }

  if(!fs.existsSync(file)){
    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    return res.end('Not found');
  }

  const ext=path.extname(file).toLowerCase();
  res.writeHead(200,{
    'Content-Type':mimeTypes[ext]||'application/octet-stream',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'
  });
  if(req.method==='HEAD')return res.end();
  fs.createReadStream(file).pipe(res);
});

server.listen(port,host,()=>{
  const url=`http://${host}:${port}/article.html?slug=korean-restaurant-table-utensil-drawer`;
  console.log(`Closer to Korea preview: ${url}`);
  console.log('Preview only. No files are modified or published. Press Ctrl+C to stop.');
  if(process.platform==='win32'){
    const child=spawn('cmd',['/c','start','',url],{detached:true,stdio:'ignore'});
    child.unref();
  }
});
