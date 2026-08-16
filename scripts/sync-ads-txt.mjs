import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const config=JSON.parse(fs.readFileSync(path.join(root,'data','monetization.json'),'utf8'));
const adsense=config.adsense||{};
const enabled=adsense.connectionEnabled===true;
const publisherId=String(adsense.publisherId||'').trim();
const file=path.join(root,'ads.txt');
const start='# CTK:ADSENSE:START';
const end='# CTK:ADSENSE:END';
const blockPattern=/\n?\s*# CTK:ADSENSE:START[\s\S]*?# CTK:ADSENSE:END\s*\n?/g;

if(enabled&&!/^ca-pub-\d{16}$/.test(publisherId)){
  console.error('Cannot generate ads.txt: publisherId must use ca-pub- followed by 16 digits.');
  process.exit(1);
}

let existing=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
existing=existing.replace(blockPattern,'\n').trim();

if(enabled){
  const pubId=publisherId.replace(/^ca-/, '');
  const managed=`${start}\ngoogle.com, ${pubId}, DIRECT, f08c47fec0942fa0\n${end}`;
  const next=[existing,managed].filter(Boolean).join('\n\n')+'\n';
  fs.writeFileSync(file,next,'utf8');
  console.log(`Synced ads.txt for ${pubId}.`);
}else if(existing){
  fs.writeFileSync(file,existing+'\n','utf8');
  console.log('AdSense connection is OFF. Removed managed AdSense entry from ads.txt and preserved other entries.');
}else if(fs.existsSync(file)){
  fs.unlinkSync(file);
  console.log('AdSense connection is OFF. Removed empty managed ads.txt.');
}else{
  console.log('AdSense connection is OFF. No ads.txt change needed.');
}
