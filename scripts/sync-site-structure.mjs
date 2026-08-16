import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root=process.cwd();
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const articles=readJson('data/articles.json');
const products=readJson('data/products.json');
const categories=readJson('data/categories.json');
const base='https://closertokorea.com';
const publicArticles=articles
  .filter(item=>!item.draft)
  .sort((a,b)=>Number(b.featured)-Number(a.featured)||String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
const publicProducts=products.filter(item=>!item.draft&&!item.hidden);
const sections=(categories.editorialSections||[]).filter(item=>item.active!==false);
const brandSocialImage='assets/images/social/closer-to-korea-social-card.png';

function absoluteAssetUrl(value){
  const src=String(value||'').trim();
  if(/^https?:\/\//i.test(src))return src;
  return `${base}/${src.replace(/^\/+/, '')}`;
}

function replaceMetaTag(html,attribute,key,content){
  const tagPattern=/<meta\b[^>]*>/gi;
  const keyPattern=new RegExp(`${attribute}=[\"']${key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[\"']`,'i');
  const replacement=attribute==='property'
    ?`<meta property="${key}" content="${content}">`
    :`<meta name="${key}" content="${content}">`;
  let found=false;
  html=html.replace(tagPattern,tag=>{
    if(!keyPattern.test(tag))return tag;
    found=true;
    return replacement;
  });
  if(!found){
    if(!html.includes('</head>'))throw new Error(`Cannot place ${key}: missing </head>`);
    html=html.replace('</head>',`  ${replacement}\n</head>`);
  }
  return html;
}

function syncSocialImage(filename,image){
  const full=path.join(root,filename);
  if(!fs.existsSync(full))throw new Error(`Social-image page does not exist: ${filename}`);
  const absolute=absoluteAssetUrl(image||brandSocialImage);
  let html=fs.readFileSync(full,'utf8');
  html=replaceMetaTag(html,'property','og:image',absolute);
  html=replaceMetaTag(html,'name','twitter:image',absolute);
  fs.writeFileSync(full,html,'utf8');
}

function featuredArticleFor({sectionKey='',contentType=''}){
  return publicArticles.find(article=>(!sectionKey||article.sectionKey===sectionKey)&&(!contentType||article.contentType===contentType))||null;
}

function normalizeRobots(filename,noindex){
  const full=path.join(root,filename);
  if(!fs.existsSync(full))throw new Error(`Section page does not exist: ${filename}`);
  let html=fs.readFileSync(full,'utf8');
  // Remove all existing robots meta tags and adjacent horizontal whitespace/newline.
  html=html.replace(/\n?[ \t]*<meta\s+[^>]*name=["']robots["'][^>]*>\s*/gi,'\n');
  if(noindex){
    const canonical=/<link\s+rel=["']canonical["'][^>]*>/i;
    const match=html.match(canonical);
    const tag='  <meta name="robots" content="noindex,follow">';
    if(match){
      html=html.replace(match[0],`${match[0]}\n${tag}`);
    }else if(html.includes('</head>')){
      html=html.replace('</head>',`${tag}\n</head>`);
    }else{
      throw new Error(`Cannot place robots meta in ${filename}: missing </head>`);
    }
  }
  // Canonical formatting: collapse excessive blank lines introduced by managed robots toggles.
  html=html.replace(/\n{3,}/g,'\n\n');
  fs.writeFileSync(full,html,'utf8');
}

for(const section of sections){
  const matching=publicArticles.filter(article=>article.sectionKey===section.key);
  normalizeRobots(section.href,matching.length===0);
  syncSocialImage(section.href,featuredArticleFor({sectionKey:section.key})?.heroImage||brandSocialImage);
}
const productGuideArticles=publicArticles.filter(article=>article.contentType==='product-guide');
const productGuideCount=productGuideArticles.length;
normalizeRobots('product-guides.html',productGuideCount===0);
syncSocialImage('product-guides.html',featuredArticleFor({contentType:'product-guide'})?.heroImage||brandSocialImage);

for(const page of [
  'index.html','about.html','contact.html','editorial-policy.html','privacy-policy.html','terms.html',
  'affiliate-disclosure.html','advertising-disclosure.html'
]) syncSocialImage(page,brandSocialImage);

const urls=[];
const add=url=>{if(!urls.includes(url))urls.push(url)};
add(`${base}/`);
for(const section of sections){
  if(publicArticles.some(article=>article.sectionKey===section.key))add(`${base}/${section.href}`);
}
if(productGuideCount>0)add(`${base}/product-guides.html`);
for(const article of publicArticles){
  add(`${base}/article.html?slug=${encodeURIComponent(article.slug)}`);
}
for(const product of publicProducts){
  add(`${base}/product.html?slug=${encodeURIComponent(product.slug)}`);
}
for(const page of [
  'about.html','contact.html','editorial-policy.html','privacy-policy.html','terms.html',
  'affiliate-disclosure.html','advertising-disclosure.html'
]) add(`${base}/${page}`);

const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url=>`  <url><loc>${url.replace(/&/g,'&amp;')}</loc></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(root,'sitemap.xml'),xml,'utf8');
console.log(`Synced section indexing and sitemap: ${publicArticles.length} public article(s), ${publicProducts.length} public product(s), ${urls.length} URL(s).`);
