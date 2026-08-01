import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root=process.cwd();
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),"utf8"));
const products=readJson("data/products.json");
const articles=readJson("data/articles.json");
const categoryData=readJson("data/categories.json");
readJson("data/site-copy.json");

const errors=[];
const warnings=[];
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const httpsPattern=/^https:\/\//i;
const sourceRequirements=new Set(["required","optional","not-applicable"]);
const allowedImageStatuses=new Set(["original-photo","licensed","amazon-compliant","original-illustration","placeholder"]);
const allowedAmazonAvailability=new Set(["under-review","available","sold-out","unavailable",""]);
const categoryKeys=new Set(categoryData.categories.filter(item=>item.active!==false).map(item=>item.key));
const matchMap=new Map(categoryData.matchTypes.map(item=>[item.key,item]));
const verificationMap=new Map(categoryData.verificationOptions.map(item=>[item.key,item]));
const trendKeys=new Set(categoryData.trendStatuses.map(item=>item.key));
const oldMatchKeys=new Set(["exact","alternative","trend"]);
const requiredProductFields=[
  "id","slug","name","summary","categoryKey","tags","image","imageAlt",
  "seenInKorea","usedBy","whyItMatters","productMatchType",
  "verificationStatus","amazonUrl","affiliateUrl","publishedAt",
  "lastCheckedAt","featured","soldOut","draft"
];
const requiredArticleFields=[
  "id","slug","title","excerpt","body","categoryKey","tags","heroImage",
  "heroImageAlt","relatedProductIds","sources","sourceRequirement",
  "publishedAt","updatedAt","featured","draft"
];

function missing(record,field){
  return record[field]===undefined||record[field]===null;
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
    if(!String(product.imageAlt||"").trim())errors.push(`${label}: public product requires imageAlt`);
    if(!String(product.summary||"").trim()||!String(product.seenInKorea||"").trim()||!String(product.usedBy||"").trim()||!String(product.whyItMatters||"").trim()){
      warnings.push(`${label}: public product has incomplete product/context copy`);
    }
    if(!matchMap.has(product.productMatchType))warnings.push(`${label}: public product is missing a valid Product Match`);
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
  if(!Array.isArray(article.body))errors.push(`${label}: body must be an array`);
  if(!Array.isArray(article.relatedProductIds))errors.push(`${label}: relatedProductIds must be an array`);
  if(!Array.isArray(article.sources))errors.push(`${label}: sources must be an array`);

  if(!sourceRequirements.has(article.sourceRequirement)){
    errors.push(`${label}: sourceRequirement must be required, optional, or not-applicable`);
  }
  if(article.sourceRequirement==="required"&&(!Array.isArray(article.sources)||article.sources.length===0)){
    errors.push(`${label}: sources are required but empty`);
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
  for(const [blockIndex,block] of (article.body||[]).entries()){
    if(block.type==="image"){
      if(!block.src)errors.push(`${label}: body image block ${blockIndex} requires src`);
      if(!String(block.alt||"").trim())errors.push(`${label}: body image block ${blockIndex} requires alt`);
      if(!Number(block.width)||!Number(block.height))warnings.push(`${label}: body image block ${blockIndex} should include width and height`);
      checkImage(block.src,`${label} body image ${blockIndex}`);
    }
  }

  if(article.draft===false){
    if(!String(article.title||"").trim())errors.push(`${label}: public article requires title`);
    if(!String(article.excerpt||"").trim())errors.push(`${label}: public article requires excerpt`);
    if(!Array.isArray(article.body)||article.body.length===0)errors.push(`${label}: public article requires body content`);
    if(!String(article.heroImageAlt||"").trim())errors.push(`${label}: public article requires heroImageAlt`);
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
if(!articleJs.includes("!item.draft")){
  errors.push("Runtime: article detail page does not visibly exclude draft articles");
}
if(!productJs.includes("!item.draft&&!item.hidden")){
  errors.push("Runtime: product detail page does not visibly exclude draft and hidden products");
}

if(warnings.length){
  console.warn(`\nWarnings (${warnings.length}):`);
  warnings.forEach(message=>console.warn(`- ${message}`));
}
if(errors.length){
  console.error(`\nErrors (${errors.length}):`);
  errors.forEach(message=>console.error(`- ${message}`));
  process.exit(1);
}
console.log(`\nContent validation passed with ${warnings.length} warning(s): ${products.length} products, ${articles.length} articles, ${categoryKeys.size} active categories.`);
