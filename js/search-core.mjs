function normalize(value=''){
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g,' ')
    .trim();
}

function bodyText(body=[]){
  return body.map(block=>{
    if(!block||typeof block!=='object')return '';
    if(typeof block.text==='string')return block.text;
    if(Array.isArray(block.items))return block.items.join(' ');
    if(Array.isArray(block.entries))return block.entries.map(entry=>`${entry.term||''} ${entry.definition||''}`).join(' ');
    return '';
  }).join(' ');
}

function labelMap(items=[]){
  return new Map(items.map(item=>[item.key,item.label||item.key]));
}

export function buildSearchDocuments({articles=[],products=[],categories={}}={}){
  const categoryLabels=labelMap(categories.categories||[]);
  const sectionLabels=labelMap(categories.editorialSections||[]);
  const docs=[];

  articles.filter(article=>article&&!article.draft).forEach(article=>{
    const sectionLabel=sectionLabels.get(article.sectionKey)||'';
    const categoryLabel=categoryLabels.get(article.categoryKey)||'';
    const title=article.title||'';
    const excerpt=article.excerpt||'';
    const tags=(article.tags||[]).join(' ');
    const body=bodyText(article.body||[]);
    docs.push({
      kind:'article',
      id:article.id||article.slug,
      title,
      excerpt,
      label:sectionLabel||categoryLabel||'Article',
      href:`article.html?slug=${encodeURIComponent(article.slug||'')}`,
      image:article.heroImage||'',
      imageAlt:article.heroImageAlt||'',
      publishedAt:article.publishedAt||'',
      fields:{
        title:normalize(title),
        tags:normalize(`${tags} ${sectionLabel} ${categoryLabel}`),
        summary:normalize(excerpt),
        detail:normalize(body)
      }
    });
  });

  products.filter(product=>product&&!product.draft&&!product.hidden).forEach(product=>{
    const categoryLabel=categoryLabels.get(product.categoryKey)||product.category||'';
    const title=product.name||'';
    const excerpt=product.summary||'';
    const tags=(product.tags||[]).join(' ');
    const detail=[product.seenInKorea,product.usedBy,product.whyItMatters,product.koreanProductStatus,product.usDifference,product.brand,product.modelNumber].filter(Boolean).join(' ');
    docs.push({
      kind:'product',
      id:product.id||product.slug,
      title,
      excerpt,
      label:categoryLabel||'Product',
      href:`product.html?slug=${encodeURIComponent(product.slug||'')}`,
      image:product.image||'',
      imageAlt:product.imageAlt||'',
      publishedAt:product.publishedAt||'',
      fields:{
        title:normalize(title),
        tags:normalize(`${tags} ${categoryLabel} ${product.productMatchLabel||''}`),
        summary:normalize(excerpt),
        detail:normalize(detail)
      }
    });
  });

  return docs;
}

function scoreDocument(doc,phrase,terms){
  if(!phrase)return 0;
  let score=0;
  const {title='',tags='',summary='',detail=''}=doc.fields||{};
  if(title===phrase)score+=80;
  else if(title.startsWith(phrase))score+=45;
  else if(title.includes(phrase))score+=35;
  if(tags.includes(phrase))score+=20;
  if(summary.includes(phrase))score+=14;
  if(detail.includes(phrase))score+=7;

  let matchedTerms=0;
  terms.forEach(term=>{
    let matched=false;
    if(title.includes(term)){score+=12;matched=true}
    if(tags.includes(term)){score+=7;matched=true}
    if(summary.includes(term)){score+=5;matched=true}
    if(detail.includes(term)){score+=2;matched=true}
    if(matched)matchedTerms++;
  });
  if(terms.length>1&&matchedTerms===terms.length)score+=12;
  return score;
}

export function searchDocuments(documents=[],query=''){
  const phrase=normalize(query);
  const terms=[...new Set(phrase.split(/\s+/).filter(Boolean))];
  if(!terms.length)return [];
  return documents
    .map(doc=>({...doc,score:scoreDocument(doc,phrase,terms)}))
    .filter(doc=>doc.score>0)
    .sort((a,b)=>b.score-a.score||String(b.publishedAt).localeCompare(String(a.publishedAt))||a.title.localeCompare(b.title));
}

export {normalize};
