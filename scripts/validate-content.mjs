import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root=process.cwd();
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),"utf8"));
const products=readJson("data/products.json");
const articles=readJson("data/articles.json");
const categoryData=readJson("data/categories.json");
const siteCopy=readJson("data/site-copy.json");
const monetization=readJson("data/monetization.json");

const errors=[];
const warnings=[];
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const httpsPattern=/^https:\/\//i;
const sourceRequirements=new Set(["required","optional","not-applicable"]);
const allowedImageStatuses=new Set(["original-photo","licensed","amazon-compliant","original-illustration","placeholder"]);
const allowedAmazonAvailability=new Set(["under-review","available","sold-out","unavailable",""]);
const categoryKeys=new Set(categoryData.categories.filter(item=>item.active!==false).map(item=>item.key));
const editorialSections=(categoryData.editorialSections||[]).filter(item=>item.active!==false);
const editorialSectionKeys=new Set(editorialSections.map(item=>item.key));
const contentTypeKeys=new Set((categoryData.contentTypes||[]).map(item=>item.key));
const contextConfidenceKeys=new Set((categoryData.contextConfidence||[]).map(item=>item.key));
const monetizationProfileKeys=new Set((categoryData.monetizationProfiles||[]).map(item=>item.key));
const allowedArticleBlockTypes=new Set(["paragraph","heading","list","quote","image","definition-list","ad-break"]);
const allowedArticleAdSlots=new Set(Object.keys(monetization.adsense?.slots||{}).filter(key=>key.startsWith("article-")));
const articleAdEligibleTypes=new Set(["paragraph","list","quote","definition-list"]);
const adsenseConnectionStart='<!-- CTK:ADSENSE-CONNECTION:START -->';
const adsenseConnectionEnd='<!-- CTK:ADSENSE-CONNECTION:END -->';
const adsenseScriptNeedle='pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=';

function requiredArticleManualSlots(article){
  if(!article||article.draft)return[];
  const profileName=article.monetizationProfile||"default";
  if(profileName==="none")return[];
  if(profileName==="custom"){
    return [...new Set((article.body||[])
      .filter(block=>block?.type==="ad-break"&&allowedArticleAdSlots.has(block.slot))
      .map(block=>block.slot))];
  }

  const eligibleCount=(article.body||[]).filter(block=>articleAdEligibleTypes.has(block?.type)).length;
  if(eligibleCount<5)return[];

  const profileSlots=Array.isArray(monetization.articleProfiles?.[profileName]?.manualSlots)
    ?monetization.articleProfiles[profileName].manualSlots
    :[];
  if(profileName==="light")return profileSlots.slice(0,1);
  if(profileName==="default"&&eligibleCount<10)return profileSlots.slice(0,1);
  return profileSlots;
}
const matchMap=new Map(categoryData.matchTypes.map(item=>[item.key,item]));
const verificationMap=new Map(categoryData.verificationOptions.map(item=>[item.key,item]));
const trendKeys=new Set(categoryData.trendStatuses.map(item=>item.key));
const oldMatchKeys=new Set(["exact","alternative","trend"]);

// Editorial-section discovery metadata must stay complete because it drives
// the shared navigation and the home Explore cards.
for(const section of editorialSections){
  const label=`Editorial section ${section.key||"(missing key)"}`;
  if(blank(section.key))errors.push(`${label}: key must not be blank`);
  if(blank(section.label))errors.push(`${label}: label must not be blank`);
  if(blank(section.href))errors.push(`${label}: href must not be blank`);
  if(blank(section.icon))errors.push(`${label}: icon must not be blank`);
  if(blank(section.homeBlurb))errors.push(`${label}: homeBlurb must not be blank`);
  if(typeof section.showWhenEmpty!=="boolean")errors.push(`${label}: showWhenEmpty must be boolean`);
}
const exploreNavigation=(siteCopy.navigation||[]).find(item=>item.label==="Explore Korea");
const exploreChildren=new Set((exploreNavigation?.children||[]).map(item=>item.href));
for(const section of editorialSections){
  if(!exploreChildren.has(section.href))errors.push(`Navigation: Explore Korea is missing editorial section ${section.key} (${section.href})`);
}
const requiredProductFields=[
  "id","slug","name","summary","categoryKey","tags","image","imageAlt",
  "seenInKorea","usedBy","whyItMatters","productMatchType",
  "verificationStatus","amazonUrl","affiliateUrl","publishedAt",
  "lastCheckedAt","featured","soldOut","draft"
];
const requiredArticleFields=[
  "id","slug","title","excerpt","body","categoryKey","tags","heroImage",
  "heroImageAlt","relatedProductIds","sources","sourceRequirement",
  "publishedAt","updatedAt","featured","draft",
  "sectionKey","contentType","koreaContextConfidence","monetizationProfile"
];

function missing(record,field){
  return record[field]===undefined||record[field]===null;
}
function blank(value){
  return typeof value!=="string"||!value.trim();
}
function requireText(record,fields,label){
  for(const field of fields){
    if(blank(record[field]))errors.push(`${label}: ${field} must not be blank`);
  }
}
function required(record,fields,label){
  for(const field of fields){
    if(missing(record,field))errors.push(`${label}: missing required field "${field}"`);
  }
}
function checkDate(value,label,field,{required=false}={}){
  if(required&&!value)errors.push(`${label}: ${field} is required`);
  if(value&&!datePattern.test(value))errors.push(`${label}: ${field} must use YYYY-MM-DD`);
}
function checkUrl(value,label,field){
  if(value&&!httpsPattern.test(value))errors.push(`${label}: ${field} must use HTTPS`);
}
function checkImage(file,label){
  if(file&&!fs.existsSync(path.join(root,file)))errors.push(`${label}: image does not exist: ${file}`);
}
function readPngSize(file,label){
  const full=path.join(root,file);
  if(!fs.existsSync(full)){
    errors.push(`${label}: PNG file does not exist: ${file}`);
    return null;
  }
  const buffer=fs.readFileSync(full);
  const pngSignature=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if(buffer.length<24||!buffer.subarray(0,8).equals(pngSignature)){
    errors.push(`${label}: expected a valid PNG file: ${file}`);
    return null;
  }
  return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
}
function validateBrandSocialImage(file){
  if(!/\.png$/i.test(file))errors.push('Brand social image: fallback must be a PNG for broad social-preview compatibility');
  const size=readPngSize(file,'Brand social image');
  if(size&&(size.width!==1200||size.height!==630))errors.push(`Brand social image: expected 1200x630, got ${size.width}x${size.height}`);
}

function textIncludesAny(value,terms){
  const normalized=String(value||"").toLowerCase();
  return terms.some(term=>normalized.includes(term));
}
function isPlaceholderImage(product){
  return product.publicImageStatus==="placeholder"||/placeholder|development/i.test(product.imageAlt||"")||/\.svg$/i.test(product.image||"");
}
function officialVerificationLabels(keys){
  return keys.map(key=>verificationMap.get(key)?.label).filter(Boolean);
}
function absoluteAssetUrl(value){
  const src=String(value||'').trim();
  if(/^https?:\/\//i.test(src))return src;
  return `https://closertokorea.com/${src.replace(/^\/+/, '')}`;
}
function metaValue(html,attribute,key){
  const tags=html.match(/<meta\b[^>]*>/gi)||[];
  for(const tag of tags){
    const keyMatch=tag.match(new RegExp(`${attribute}=[\"']([^\"']+)[\"']`,'i'));
    if(!keyMatch||keyMatch[1].toLowerCase()!==key.toLowerCase())continue;
    const contentMatch=tag.match(/content=[\"']([^\"']*)[\"']/i);
    return contentMatch?contentMatch[1]:'';
  }
  return '';
}
function expectedFeaturedArticle(publicArticles,{sectionKey='',contentType=''}){
  return publicArticles.find(article=>(!sectionKey||article.sectionKey===sectionKey)&&(!contentType||article.contentType===contentType))||null;
}

const productIds=new Set();
const productSlugs=new Set();

products.forEach((product,index)=>{
  const label=`products[${index}] ${product.id||"(missing id)"}`;
  required(product,requiredProductFields,label);

  if(productIds.has(product.id))errors.push(`${label}: duplicate id`);
  if(productSlugs.has(product.slug))errors.push(`${label}: duplicate slug`);
  productIds.add(product.id);
  productSlugs.add(product.slug);

  if(product.slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug))errors.push(`${label}: slug must be lowercase kebab-case`);
  if(product.categoryKey&&!categoryKeys.has(product.categoryKey))errors.push(`${label}: unknown categoryKey "${product.categoryKey}"`);

  if(oldMatchKeys.has(product.productMatchType)){
    errors.push(`${label}: deprecated Product Match key "${product.productMatchType}" is not allowed`);
  }
  if(!matchMap.has(product.productMatchType)){
    errors.push(`${label}: productMatchType must be confirmed, likely, similar, or culture-inspired`);
  }else if(product.productMatchLabel&&product.productMatchLabel!==matchMap.get(product.productMatchType).label){
    errors.push(`${label}: productMatchLabel "${product.productMatchLabel}" does not match central label "${matchMap.get(product.productMatchType).label}"`);
  }

  if(!Array.isArray(product.tags))errors.push(`${label}: tags must be an array`);
  if(!Array.isArray(product.verificationStatus))errors.push(`${label}: verificationStatus must be an array`);
  if(!Array.isArray(product.verificationLabels||[]))errors.push(`${label}: verificationLabels must be an array`);
  if(!Array.isArray(product.sourceUrls||[]))errors.push(`${label}: sourceUrls must be an array`);

  const verificationKeys=Array.isArray(product.verificationStatus)?product.verificationStatus:[];
  for(const key of verificationKeys){
    if(!verificationMap.has(key))errors.push(`${label}: unsupported verificationStatus "${key}"`);
  }
  const expectedLabels=officialVerificationLabels(verificationKeys);
  const actualLabels=product.verificationLabels||[];
  if(JSON.stringify(expectedLabels)!==JSON.stringify(actualLabels)){
    errors.push(`${label}: verificationLabels must match the central verification labels and order`);
  }

  if(product.personallyUsed===true&&!verificationKeys.includes("personally-used")){
    warnings.push(`${label}: personallyUsed=true but personally-used verification is missing`);
  }
  if(verificationKeys.includes("personally-used")&&product.personallyUsed!==true){
    warnings.push(`${label}: personally-used verification is present but personallyUsed is not true`);
  }
  if(verificationKeys.includes("personally-purchased-in-korea")){
    const purchaseText=[product.seenInKorea,product.koreanProductStatus,product.personalUseNotes,product.modelEvidence].join(" ");
    if(!textIncludesAny(purchaseText,["purchased","bought","purchase"])||!textIncludesAny(purchaseText,["korea","korean"])){
      warnings.push(`${label}: personally-purchased-in-korea needs a clear purchase-in-Korea explanation`);
    }
  }
  if(product.personallyUsed===true&&verificationKeys.length===1&&verificationKeys[0]==="research-based"){
    warnings.push(`${label}: a personally used product should not use research-based as its only verification`);
  }
  if(product.productMatchType==="likely"&&!product.modelNumber&&!verificationKeys.includes("model-unverified")){
    warnings.push(`${label}: Likely Match without a model number should include model-unverified`);
  }
  if(product.productMatchType!=="confirmed"&&!product.modelNumber&&!verificationKeys.includes("model-unverified")&&!product.draft){
    warnings.push(`${label}: public non-confirmed product has no model number and no model-unverified status`);
  }

  if(product.productMatchType==="confirmed"){
    const hasBrand=String(product.brand||"").trim().length>1;
    const hasIdentifier=String(product.modelNumber||"").trim().length>1;
    const hasEvidence=String(product.modelEvidence||"").trim().length>12;
    const hasSource=Array.isArray(product.sourceUrls)&&product.sourceUrls.length>0;
    if(!hasBrand||!hasIdentifier||!hasEvidence||!hasSource){
      errors.push(`${label}: Confirmed Match requires brand, modelNumber/unique identifier, modelEvidence, and at least one source URL`);
    }
    if(textIncludesAny(product.name,["puff","fan","timer","container","cap"])&&!hasIdentifier){
      errors.push(`${label}: general product category cannot be Confirmed Match without a unique identifier`);
    }
  }

  checkUrl(product.amazonUrl,label,"amazonUrl");
  checkUrl(product.affiliateUrl,label,"affiliateUrl");
  (product.sourceUrls||[]).forEach((url,sourceIndex)=>checkUrl(url,label,`sourceUrls[${sourceIndex}]`));

  if(product.affiliateUrl&&!product.linkLastCheckedAt){
    errors.push(`${label}: affiliateUrl requires linkLastCheckedAt`);
  }
  if(product.affiliateUrl&&product.amazonAvailability==="under-review"){
    errors.push(`${label}: affiliateUrl cannot be active while amazonAvailability is under-review`);
  }
  if(product.activePurchaseCta===true&&!product.affiliateUrl){
    errors.push(`${label}: activePurchaseCta requires affiliateUrl`);
  }
  if(product.activePurchaseCta===true&&product.amazonAvailability!=="available"){
    errors.push(`${label}: activePurchaseCta requires amazonAvailability "available"`);
  }
  if(product.amazonAvailability==="under-review"&&product.activePurchaseCta===true){
    errors.push(`${label}: under-review Amazon status requires an inactive CTA`);
  }
  if((product.verificationLabels||[]).includes("Available on Amazon US")&&!product.affiliateUrl){
    errors.push(`${label}: Available on Amazon US cannot be shown without affiliateUrl`);
  }
  if(product.soldOut&&product.activePurchaseCta===true){
    errors.push(`${label}: soldOut product cannot have an active purchase CTA`);
  }
  if(product.productMatchType==="confirmed"&&product.affiliateUrl&&!product.modelNumber){
    warnings.push(`${label}: Confirmed Match with an active Amazon CTA has no model number`);
  }
  if(product.amazonAvailability&&!allowedAmazonAvailability.has(product.amazonAvailability)){
    warnings.push(`${label}: unrecognized amazonAvailability "${product.amazonAvailability}"`);
  }

  checkDate(product.publishedAt,label,"publishedAt");
  checkDate(product.lastCheckedAt,label,"lastCheckedAt",{required:product.draft===false});
  checkDate(product.linkLastCheckedAt,label,"linkLastCheckedAt");
  checkImage(product.image,label);

  if(product.trendStatus!==undefined&&!trendKeys.has(product.trendStatus)){
    errors.push(`${label}: unsupported trendStatus "${product.trendStatus}"`);
  }
  if(product.verificationStatus?.includes("trend-verified")&&!["rising","trending"].includes(product.trendStatus)){
    warnings.push(`${label}: trend-verified is present but trendStatus is not Rising or Trending`);
  }

  if(product.publicImageStatus&&!allowedImageStatuses.has(product.publicImageStatus)){
    errors.push(`${label}: unsupported publicImageStatus "${product.publicImageStatus}"`);
  }
  if(product.draft===false){
    requireText(product,["id","slug","name","summary","categoryKey","image","imageAlt","seenInKorea","usedBy","whyItMatters","productMatchType"],label);
    if(!Array.isArray(product.verificationStatus)||product.verificationStatus.length===0)errors.push(`${label}: public product requires at least one verificationStatus`);
    if(!String(product.publicImageStatus||"").trim())errors.push(`${label}: public product requires publicImageStatus`);
    if(!String(product.publishedAt||"").trim())errors.push(`${label}: public product requires publishedAt`);
    if(!String(product.lastCheckedAt||"").trim())errors.push(`${label}: public product requires lastCheckedAt`);
    if(!matchMap.has(product.productMatchType))errors.push(`${label}: public product is missing a valid Product Match`);
    if(isPlaceholderImage(product))warnings.push(`${label}: public product uses a development SVG/placeholder image`);
  }else{
    if(product.featured)errors.push(`${label}: draft product must not be featured`);
    if(product.newlyAdded)errors.push(`${label}: draft product must not appear in Newly Added`);
    if(product.activePurchaseCta===true)errors.push(`${label}: draft product must not have an active purchase CTA`);
  }
});

const articleIds=new Set();
const articleSlugs=new Set();

articles.forEach((article,index)=>{
  const label=`articles[${index}] ${article.id||"(missing id)"}`;
  required(article,requiredArticleFields,label);

  if(articleIds.has(article.id))errors.push(`${label}: duplicate id`);
  if(articleSlugs.has(article.slug))errors.push(`${label}: duplicate slug`);
  articleIds.add(article.id);
  articleSlugs.add(article.slug);

  if(article.slug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug))errors.push(`${label}: slug must be lowercase kebab-case`);
  if(article.categoryKey&&!categoryKeys.has(article.categoryKey))errors.push(`${label}: unknown categoryKey "${article.categoryKey}"`);
  if(article.sectionKey&&!editorialSectionKeys.has(article.sectionKey))errors.push(`${label}: unknown or inactive sectionKey "${article.sectionKey}"`);
  if(article.contentType&&!contentTypeKeys.has(article.contentType))errors.push(`${label}: unknown contentType "${article.contentType}"`);
  if(article.koreaContextConfidence&&!contextConfidenceKeys.has(article.koreaContextConfidence))errors.push(`${label}: unknown koreaContextConfidence "${article.koreaContextConfidence}"`);
  if(article.monetizationProfile&&!monetizationProfileKeys.has(article.monetizationProfile))errors.push(`${label}: unknown monetizationProfile "${article.monetizationProfile}"`);
  if(!Array.isArray(article.body))errors.push(`${label}: body must be an array`);
  if(!Array.isArray(article.relatedProductIds))errors.push(`${label}: relatedProductIds must be an array`);
  if(!Array.isArray(article.sources))errors.push(`${label}: sources must be an array`);

  if(!sourceRequirements.has(article.sourceRequirement)){
    errors.push(`${label}: sourceRequirement must be required, optional, or not-applicable`);
  }
  if(article.sourceRequirement==="required"&&(!Array.isArray(article.sources)||article.sources.length===0)){
    errors.push(`${label}: sources are required but empty`);
  }
  if(article.koreaContextConfidence==="broadly-verified"&&(!Array.isArray(article.sources)||article.sources.length===0)){
    warnings.push(`${label}: Broadly Verified is selected without a listed source; confirm broad support before publication`);
  }
  if(article.contentType==="product-guide"&&(!Array.isArray(article.relatedProductIds)||article.relatedProductIds.length===0)){
    warnings.push(`${label}: Product Guide has no related product IDs`);
  }

  for(const productId of article.relatedProductIds||[]){
    const product=products.find(item=>item.id===productId);
    if(!product){
      warnings.push(`${label}: related product does not exist: ${productId}`);
    }else if(article.draft===false&&(product.draft||product.hidden)){
      warnings.push(`${label}: related product "${productId}" is draft/hidden and will not render publicly`);
    }
  }

  checkDate(article.publishedAt,label,"publishedAt",{required:article.draft===false});
  checkDate(article.updatedAt,label,"updatedAt",{required:article.draft===false});
  checkImage(article.heroImage,label);
  const adBreakSlots=new Set();
  let adBreakCount=0;
  for(const [blockIndex,block] of (article.body||[]).entries()){
    if(!allowedArticleBlockTypes.has(block.type))errors.push(`${label}: unknown body block type "${block.type}" at block ${blockIndex}`);
    if(["paragraph","heading","quote"].includes(block.type)&&!String(block.text||"").trim())errors.push(`${label}: ${block.type} block ${blockIndex} must not be blank`);
    if(block.type==="list"&&(!Array.isArray(block.items)||block.items.length===0||block.items.some(item=>!String(item||"").trim())))errors.push(`${label}: list block ${blockIndex} requires non-blank items`);
    if(block.type==="definition-list"&&(!Array.isArray(block.items)||block.items.length===0||block.items.some(item=>!String(item?.term||"").trim()||!String(item?.description||"").trim())))errors.push(`${label}: definition-list block ${blockIndex} requires term and description for every item`);
    if(block.type==="image"){
      if(!block.src)errors.push(`${label}: body image block ${blockIndex} requires src`);
      if(!String(block.alt||"").trim())errors.push(`${label}: body image block ${blockIndex} requires alt`);
      if(!Number(block.width)||!Number(block.height))warnings.push(`${label}: body image block ${blockIndex} should include width and height`);
      checkImage(block.src,`${label} body image ${blockIndex}`);
    }
    if(block.type==="ad-break"){
      adBreakCount+=1;
      if(article.monetizationProfile!=="custom")errors.push(`${label}: ad-break block ${blockIndex} requires monetizationProfile "custom"`);
      if(!allowedArticleAdSlots.has(block.slot))errors.push(`${label}: ad-break block ${blockIndex} uses unknown article ad slot "${block.slot||""}"`);
      if(adBreakSlots.has(block.slot))errors.push(`${label}: ad-break slot "${block.slot}" is used more than once`);
      adBreakSlots.add(block.slot);
      if(blockIndex<2 || blockIndex>(article.body||[]).length-3)errors.push(`${label}: ad-break block ${blockIndex} must have at least two content blocks before and after it`);
      if((article.body||[])[blockIndex-1]?.type==="ad-break" || (article.body||[])[blockIndex+1]?.type==="ad-break")errors.push(`${label}: adjacent ad-break blocks are not allowed`);
    }
  }
  if(article.monetizationProfile==="custom" && adBreakCount===0)warnings.push(`${label}: custom monetization profile has no ad-break block`);

  if(article.draft===false){
    requireText(article,["id","slug","title","seoTitle","excerpt","metaDescription","categoryKey","sectionKey","contentType","koreaContextConfidence","monetizationProfile","heroImage","heroImageAlt","publishedAt","updatedAt"],label);
    if(!String(article.primaryKeyword||"").trim())warnings.push(`${label}: public article has no primaryKeyword`);
    if(!Array.isArray(article.body)||article.body.length===0)errors.push(`${label}: public article requires body content`);
    if(!Number(article.heroImageWidth)||!Number(article.heroImageHeight))errors.push(`${label}: public article requires heroImageWidth and heroImageHeight`);
    if(/sample|placeholder|draft/i.test(`${article.title} ${article.excerpt}`)){
      warnings.push(`${label}: public article still appears to contain sample/draft wording`);
    }
    if(/\.svg$/i.test(article.heroImage||"")||/placeholder|development/i.test(article.heroImageAlt||"")){
      warnings.push(`${label}: public article uses a development SVG/placeholder image`);
    }
  }else if(article.featured){
    errors.push(`${label}: draft article must not be featured`);
  }
});

// AdSense connection-code deployment checks.
{
  const adsense=monetization.adsense||{};
  const connectionPages=Array.isArray(adsense.connectionPages)?adsense.connectionPages:[];
  const connectionSet=new Set(connectionPages);
  const publisherId=String(adsense.publisherId||'').trim();
  const connectionEnabled=adsense.connectionEnabled===true;
  const htmlFiles=fs.readdirSync(root).filter(name=>name.endsWith('.html'));

  if(connectionEnabled&&!/^ca-pub-\d{16}$/.test(publisherId)){
    errors.push('monetization: AdSense publisherId must use ca-pub- followed by 16 digits when connection is enabled');
  }
  if(connectionEnabled&&!connectionPages.length){
    errors.push('monetization: AdSense connectionPages cannot be empty when connection is enabled');
  }
  for(const filename of connectionPages){
    if(!fs.existsSync(path.join(root,filename))){
      errors.push(`monetization: AdSense connection page does not exist: ${filename}`);
    }
    if(['admin.html','article-daiso-egg-maker.html','trending-now.html'].includes(filename)){
      errors.push(`monetization: AdSense connection page must not be an admin/legacy page: ${filename}`);
    }
  }

  for(const filename of htmlFiles){
    const html=fs.readFileSync(path.join(root,filename),'utf8');
    const hasStart=html.includes(adsenseConnectionStart);
    const hasEnd=html.includes(adsenseConnectionEnd);
    const hasScript=html.includes(adsenseScriptNeedle);
    const shouldHave=connectionEnabled&&connectionSet.has(filename);

    if(hasStart!==hasEnd)errors.push(`AdSense head sync: incomplete managed marker block in ${filename}`);
    if(shouldHave){
      if(!hasStart||!hasScript)errors.push(`AdSense head sync: connection code missing from ${filename}`);
      if(!html.includes(`client=${publisherId}`))errors.push(`AdSense head sync: publisher ID mismatch in ${filename}`);
      const startCount=html.split(adsenseConnectionStart).length-1;
      if(startCount!==1)errors.push(`AdSense head sync: expected exactly one managed connection block in ${filename}`);
    }else if(hasStart||hasEnd||hasScript){
      errors.push(`AdSense head sync: connection code must not be present in ${filename}`);
    }
  }
}

// ads.txt must track the same AdSense publisher ID when the connection is enabled.
{
  const adsense=monetization.adsense||{};
  const adsTxtPath=path.join(root,'ads.txt');
  const enabled=adsense.connectionEnabled===true;
  const publisherId=String(adsense.publisherId||'').trim();
  const expectedPubId=publisherId.replace(/^ca-/,'');
  const expectedLine=`google.com, ${expectedPubId}, DIRECT, f08c47fec0942fa0`;
  const adsTxt=fs.existsSync(adsTxtPath)?fs.readFileSync(adsTxtPath,'utf8'):'';
  const hasManagedStart=adsTxt.includes('# CTK:ADSENSE:START');
  const hasManagedEnd=adsTxt.includes('# CTK:ADSENSE:END');

  if(enabled){
    if(!fs.existsSync(adsTxtPath))errors.push('ads.txt: file is missing while AdSense connection is enabled');
    if(!adsTxt.includes(expectedLine))errors.push('ads.txt: managed Google seller line is missing or does not match the current publisher ID');
    if(!hasManagedStart||!hasManagedEnd)errors.push('ads.txt: CTK-managed AdSense markers are incomplete');
  }else if(hasManagedStart||hasManagedEnd){
    errors.push('ads.txt: managed AdSense entry must not remain while AdSense connection is disabled');
  }
}

// Section indexability and sitemap must match the public content state.
{
  const publicArticles=articles
    .filter(item=>!item.draft)
    .sort((a,b)=>Number(b.featured)-Number(a.featured)||String(b.publishedAt||'').localeCompare(String(a.publishedAt||'')));
  const publicProducts=products.filter(item=>!item.draft&&!item.hidden);
  const sections=editorialSections;
  const brandSocialImage='assets/images/social/closer-to-korea-social-card.png';
  validateBrandSocialImage(brandSocialImage);
  const hasNoindex=html=>/<meta\s+[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html)
    || /<meta\s+[^>]*content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']/i.test(html);

  for(const section of sections){
    const pagePath=path.join(root,section.href);
    if(!fs.existsSync(pagePath)){
      errors.push(`Section page does not exist: ${section.href}`);
      continue;
    }
    const html=fs.readFileSync(pagePath,'utf8');
    const count=publicArticles.filter(article=>article.sectionKey===section.key).length;
    if(count===0&&!hasNoindex(html))errors.push(`Section indexing: empty section ${section.key} must be noindex`);
    if(count>0&&hasNoindex(html))errors.push(`Section indexing: populated section ${section.key} must not be noindex`);
    if(!html.includes(`data-section-key="${section.key}"`))errors.push(`Section rendering: ${section.href} must declare data-section-key="${section.key}"`);
    const featured=expectedFeaturedArticle(publicArticles,{sectionKey:section.key});
    const expectedImage=absoluteAssetUrl(featured?.heroImage||brandSocialImage);
    if(metaValue(html,'property','og:image')!==expectedImage)errors.push(`Section social image: ${section.href} og:image must match the featured article or brand fallback`);
    if(metaValue(html,'name','twitter:image')!==expectedImage)errors.push(`Section social image: ${section.href} twitter:image must match og:image`);
  }

  const productGuideHtml=fs.readFileSync(path.join(root,'product-guides.html'),'utf8');
  const productGuideCount=publicArticles.filter(article=>article.contentType==='product-guide').length;
  if(productGuideCount===0&&!hasNoindex(productGuideHtml))errors.push('Product Guides: empty page must be noindex');
  if(productGuideCount>0&&hasNoindex(productGuideHtml))errors.push('Product Guides: populated page must not be noindex');
  const productGuideFeatured=expectedFeaturedArticle(publicArticles,{contentType:'product-guide'});
  const expectedProductGuideImage=absoluteAssetUrl(productGuideFeatured?.heroImage||brandSocialImage);
  if(metaValue(productGuideHtml,'property','og:image')!==expectedProductGuideImage)errors.push('Product Guides social image: og:image must match the featured product guide or brand fallback');
  if(metaValue(productGuideHtml,'name','twitter:image')!==expectedProductGuideImage)errors.push('Product Guides social image: twitter:image must match og:image');

  for(const page of ['index.html','about.html','contact.html','editorial-policy.html','privacy-policy.html','terms.html','affiliate-disclosure.html','advertising-disclosure.html']){
    const html=fs.readFileSync(path.join(root,page),'utf8');
    const expectedImage=absoluteAssetUrl(brandSocialImage);
    if(metaValue(html,'property','og:image')!==expectedImage)errors.push(`Static social image: ${page} must use the Closer to Korea brand fallback`);
    if(metaValue(html,'name','twitter:image')!==expectedImage)errors.push(`Static social image: ${page} twitter:image must match the brand fallback`);
  }

  const expected=new Set(['https://closertokorea.com/']);
  for(const section of sections){
    if(publicArticles.some(article=>article.sectionKey===section.key))expected.add(`https://closertokorea.com/${section.href}`);
  }
  if(productGuideCount>0)expected.add('https://closertokorea.com/product-guides.html');
  for(const article of publicArticles)expected.add(`https://closertokorea.com/article.html?slug=${encodeURIComponent(article.slug)}`);
  for(const product of publicProducts)expected.add(`https://closertokorea.com/product.html?slug=${encodeURIComponent(product.slug)}`);
  for(const page of ['about.html','contact.html','editorial-policy.html','privacy-policy.html','terms.html','affiliate-disclosure.html','advertising-disclosure.html'])expected.add(`https://closertokorea.com/${page}`);

  const sitemapPath=path.join(root,'sitemap.xml');
  if(!fs.existsSync(sitemapPath))errors.push('Sitemap: sitemap.xml is missing');
  else{
    const sitemap=fs.readFileSync(sitemapPath,'utf8');
    const actual=new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>match[1].replace(/&amp;/g,'&')));
    for(const url of expected)if(!actual.has(url))errors.push(`Sitemap: missing ${url}`);
    for(const url of actual)if(!expected.has(url))errors.push(`Sitemap: unexpected ${url}`);
  }
}

// Runtime protection checks: draft content must be filtered before rendering.
const mainJs=fs.readFileSync(path.join(root,"js/main.js"),"utf8");
const articleJs=fs.readFileSync(path.join(root,"js/article.js"),"utf8");
const productJs=fs.readFileSync(path.join(root,"js/product.js"),"utf8");

if(!mainJs.includes("!product.draft&&!product.hidden")){
  errors.push("Runtime: public product lists do not visibly exclude draft and hidden products");
}
if(!mainJs.includes("!article.draft")){
  errors.push("Runtime: article cards do not visibly exclude draft articles");
}
if(!mainJs.includes("visibleEditorialSections")||!mainJs.includes("showWhenEmpty!==false")){
  errors.push("Runtime: editorial discovery does not visibly honor showWhenEmpty for home/navigation visibility");
}
if(!articleJs.includes("!item.draft")){
  errors.push("Runtime: article detail page does not visibly exclude draft articles");
}
if(!articleJs.includes('meta[property="og:url"]')||!articleJs.includes('https://closertokorea.com/article.html?slug=')){
  errors.push("Runtime: article detail page does not visibly publish a slug-specific canonical Open Graph URL");
}
if(!productJs.includes("!item.draft&&!item.hidden")){
  errors.push("Runtime: product detail page does not visibly exclude draft and hidden products");
}

if(warnings.length){
  console.warn(`\nWarnings (${warnings.length}):`);
  warnings.forEach(message=>console.warn(`- ${message}`));
}
// Global monetization safety checks. data/monetization.json is the single source of truth.
if(monetization.adsense?.connectionEnabled===true&&!String(monetization.adsense?.publisherId||"").trim()){
  errors.push('monetization: AdSense connection cannot be enabled without publisherId');
}
if(monetization.adsense?.manualAdsEnabled===true&&monetization.adsense?.connectionEnabled!==true){
  errors.push('monetization: manual ad units require AdSense connection enabled');
}
if(monetization.adsense?.manualAdsEnabled===true){
  const configuredEntries=Object.entries(monetization.adsense?.slots||{})
    .filter(([,value])=>String(value||'').trim());
  const configuredSlots=configuredEntries.map(([key])=>key);
  for(const [slotName,slotId] of configuredEntries){
    if(!/^\d+$/.test(String(slotId).trim())){
      errors.push(`monetization: AdSense ad unit ID for slot "${slotName}" must contain digits only`);
    }
  }
  if(!configuredSlots.length){
    errors.push('monetization: manual ad units are enabled but no AdSense ad unit ID is configured');
  }

  for(const article of articles.filter(item=>!item.draft)){
    const requiredSlots=requiredArticleManualSlots(article);
    for(const slotName of requiredSlots){
      if(!String(monetization.adsense?.slots?.[slotName]||'').trim()){
        errors.push(`monetization: public article "${article.slug}" requires configured ad unit ID for slot "${slotName}"`);
      }
    }
  }
}
if(monetization.amazonAssociates?.enabled===true&&!String(monetization.amazonAssociates?.associateTag||"").trim()){
  errors.push('monetization: Amazon Associates cannot be enabled without associateTag');
}
if(monetization.amazonAssociates?.enabled===true&&!String(monetization.amazonAssociates?.siteDisclosure||"").trim()){
  errors.push('monetization: Amazon Associates cannot be enabled without siteDisclosure');
}

if(errors.length){
  console.error(`\nErrors (${errors.length}):`);
  errors.forEach(message=>console.error(`- ${message}`));
  process.exit(1);
}
console.log(`\nContent validation passed with ${warnings.length} warning(s): ${products.length} products, ${articles.length} articles, ${categoryKeys.size} active categories.`);
