// The complete editable source must live outside the public repository/webroot.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const MASTER_SCHEMA='ctk-editorial-master-v1';
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function assertEditorialMaster(data){
  if(data?.schemaVersion!==MASTER_SCHEMA)throw new Error('Import the complete private editorial master, not a public export.');
  for(const kind of ['articles','products']){
    if(!Array.isArray(data[kind]))throw new Error(`Editorial master requires ${kind}.`);
    const ids=new Set();
    for(const item of data[kind]){
      if(!item||typeof item.id!=='string'||!item.id||ids.has(item.id))throw new Error(`Invalid or duplicate ${kind} ID in master.`);
      if(typeof item.draft!=='boolean')throw new Error(`${kind} ${item.id}: draft must be explicitly true or false.`);
      if(item.hidden!==undefined&&typeof item.hidden!=='boolean')throw new Error(`${kind} ${item.id}: hidden must be boolean.`);
      ids.add(item.id);
    }
  }
  for(const key of ['categories','siteCopy','monetization'])if(!data[key]||typeof data[key]!=='object'||Array.isArray(data[key]))throw new Error(`Editorial master requires ${key}.`);
  return data;
}
export function externalMasterPath(root,explicitPath=process.env.CTK_EDITORIAL_MASTER){
  if(!explicitPath||!path.isAbsolute(explicitPath))throw new Error('Set CTK_EDITORIAL_MASTER to the absolute path of your complete private master outside the public repository.');
  const realRoot=fs.realpathSync(root),resolved=fs.realpathSync(explicitPath),relative=path.relative(realRoot,resolved);
  if(!relative||(!relative.startsWith(`..${path.sep}`)&&relative!=='..'&&!path.isAbsolute(relative)))throw new Error('The private editorial master must be outside the public repository/webroot.');
  if(!fs.statSync(resolved).isFile())throw new Error('Editorial master path must be a file.');
  return resolved;
}
export function loadEditorialMaster(root,explicitPath){
  const file=externalMasterPath(root,explicitPath),bytes=fs.readFileSync(file);
  return {path:file,data:assertEditorialMaster(JSON.parse(bytes)),digest:digest(bytes)};
}
export function saveEditorialMaster(root,data,{path:masterPath,expectedDigest}={}){
  const current=loadEditorialMaster(root,masterPath);
  if(!expectedDigest||current.digest!==expectedDigest)throw new Error('Private master changed. Reload it before saving; no source was overwritten.');
  const next=assertEditorialMaster({...current.data,...data});
  for(const kind of ['articles','products']){
    const ids=new Set(next[kind].map(item=>item.id));
    const missing=current.data[kind].filter(item=>!ids.has(item.id));
    if(missing.length)throw new Error(`Save would remove ${missing.length} existing ${kind} records. Import the complete master; mark unwanted records as drafts instead of deleting them.`);
  }
  const bytes=Buffer.from(JSON.stringify(next,null,2)+'\n');
  const backupDir=path.join(path.dirname(current.path),'.ctk-editorial-backups');
  fs.mkdirSync(backupDir,{recursive:true});
  const backup=path.join(backupDir,`${Date.now()}-${current.digest.slice(0,12)}.json`);
  fs.copyFileSync(current.path,backup,fs.constants.COPYFILE_EXCL);
  const temp=`${current.path}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp,bytes,{flag:'wx'});
  // Recheck after backup to catch a concurrent source edit before the rename.
  if(digest(fs.readFileSync(current.path))!==current.digest){fs.unlinkSync(temp);throw new Error('Private master changed during save. Reload before saving.');}
  fs.renameSync(temp,current.path);
  return {path:current.path,data:next,digest:digest(bytes)};
}
