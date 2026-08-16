import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root=process.cwd();
const monetizationPath=path.join(root,"data","monetization.json");
const monetization=JSON.parse(fs.readFileSync(monetizationPath,"utf8"));
const adsense=monetization.adsense||{};
const enabled=adsense.connectionEnabled===true;
const publisherId=String(adsense.publisherId||"").trim();
const pages=Array.isArray(adsense.connectionPages)?adsense.connectionPages:[];
const start='<!-- CTK:ADSENSE-CONNECTION:START -->';
const end='<!-- CTK:ADSENSE-CONNECTION:END -->';
const blockPattern=/\n?\s*<!-- CTK:ADSENSE-CONNECTION:START -->[\s\S]*?<!-- CTK:ADSENSE-CONNECTION:END -->\s*\n?/g;

if(enabled&&!/^ca-pub-\d{16}$/.test(publisherId)){
  console.error('AdSense connection is enabled, but publisherId must look like ca-pub-1234567890123456.');
  process.exit(1);
}
if(enabled&&!pages.length){
  console.error('AdSense connection is enabled, but adsense.connectionPages is empty.');
  process.exit(1);
}

const snippet=`${start}\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}" crossorigin="anonymous"></script>\n${end}`;

const targetSet=new Set(pages);
const htmlFiles=fs.readdirSync(root).filter(name=>name.endsWith('.html'));
for(const filename of htmlFiles){
  const full=path.join(root,filename);
  let html=fs.readFileSync(full,'utf8');
  html=html.replace(blockPattern,'\n');

  if(enabled&&targetSet.has(filename)){
    if(!html.includes('</head>')){
      console.error(`Cannot insert AdSense connection code: ${filename} has no </head>.`);
      process.exit(1);
    }
    html=html.replace('</head>',`${snippet}\n</head>`);
  }
  fs.writeFileSync(full,html,'utf8');
}

for(const filename of pages){
  if(!fs.existsSync(path.join(root,filename))){
    console.error(`AdSense connection page does not exist: ${filename}`);
    process.exit(1);
  }
}

console.log(enabled
  ?`Synced AdSense connection code to ${pages.length} page(s) for ${publisherId}.`
  :'AdSense connection is OFF. Removed managed AdSense connection code from HTML pages.');
