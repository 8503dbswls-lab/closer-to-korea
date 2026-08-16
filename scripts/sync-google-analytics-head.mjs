import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const configPath=path.join(root,'data','analytics.json');
if(!fs.existsSync(configPath))throw new Error('Missing data/analytics.json');
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
const ga=config.googleAnalytics||{};
const enabled=ga.enabled===true;
const measurementId=String(ga.measurementId||'').trim();
const excluded=new Set((ga.excludePages||[]).map(String));
const markerStart='<!-- BEGIN Google Analytics (GA4) -->';
const markerEnd='<!-- END Google Analytics (GA4) -->';
const managedBlock=new RegExp(`\\s*${markerStart.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}[\\s\\S]*?${markerEnd.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\s*`,'g');

if(enabled&&!/^G-[A-Z0-9]+$/i.test(measurementId)){
  throw new Error(`Invalid Google Analytics measurement ID: ${measurementId||'(empty)'}`);
}

const tag=enabled?`${markerStart}
<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${measurementId}');
</script>
${markerEnd}`:'';

const htmlFiles=fs.readdirSync(root).filter(name=>name.endsWith('.html'));
let updated=0;
let skipped=0;
for(const filename of htmlFiles){
  const full=path.join(root,filename);
  let html=fs.readFileSync(full,'utf8');
  html=html.replace(managedBlock,'\n');
  if(excluded.has(filename)||!enabled){
    skipped++;
  }else{
    const headMatch=/<head\b[^>]*>/i.exec(html);
    if(!headMatch)throw new Error(`Cannot place Google Analytics tag in ${filename}: missing <head>`);
    const insertAt=headMatch.index+headMatch[0].length;
    html=`${html.slice(0,insertAt)}\n${tag}\n${html.slice(insertAt)}`;
    updated++;
  }
  fs.writeFileSync(full,html,'utf8');
}
console.log(`Google Analytics sync complete: ${updated} page(s) tagged, ${skipped} page(s) excluded/disabled.`);
