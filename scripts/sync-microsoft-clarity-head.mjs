import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const configPath=path.join(root,'data','clarity.json');
if(!fs.existsSync(configPath))throw new Error('Missing data/clarity.json');
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
const clarity=config.microsoftClarity||{};
const enabled=clarity.enabled===true;
const projectId=String(clarity.projectId||'').trim();
const excluded=new Set((clarity.excludePages||[]).map(String));
const markerStart='<!-- BEGIN Microsoft Clarity -->';
const markerEnd='<!-- END Microsoft Clarity -->';
const escapeRegExp=(value)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const managedBlock=new RegExp(`\\s*${escapeRegExp(markerStart)}[\\s\\S]*?${escapeRegExp(markerEnd)}\\s*`,'g');

if(enabled&&!/^[a-z0-9]+$/i.test(projectId)){
  throw new Error(`Invalid Microsoft Clarity project ID: ${projectId||'(empty)'}`);
}

const tag=enabled?`${markerStart}
<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${projectId}");
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
    if(!headMatch)throw new Error(`Cannot place Microsoft Clarity tag in ${filename}: missing <head>`);
    const insertAt=headMatch.index+headMatch[0].length;
    html=`${html.slice(0,insertAt)}\n${tag}\n${html.slice(insertAt)}`;
    updated++;
  }
  fs.writeFileSync(full,html,'utf8');
}
console.log(`Microsoft Clarity sync complete: ${updated} page(s) tagged, ${skipped} page(s) excluded/disabled.`);
