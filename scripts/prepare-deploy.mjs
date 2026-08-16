import {spawnSync} from 'node:child_process';
import process from 'node:process';

const steps=[
  ['Build content bundles',['scripts/build-content-bundle.mjs']],
  ['Sync section indexing and sitemap',['scripts/sync-site-structure.mjs']],
  ['Sync AdSense head code',['scripts/sync-adsense-head.mjs']],
  ['Sync ads.txt',['scripts/sync-ads-txt.mjs']],
  ['Validate content and deployment safety',['scripts/validate-content.mjs']]
];

for(const [label,args] of steps){
  console.log(`\n== ${label} ==`);
  const result=spawnSync(process.execPath,args,{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
console.log('\nDeployment preparation completed successfully.');
