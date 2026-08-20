function normalize(value=''){
  // NFKC preserves complete Hangul syllables such as 계란찜기.
  // NFKD would decompose Hangul into Jamo and the following filter
  // would accidentally remove the Korean search term.
  return String(value)
    .normalize('NFKC')
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

function aliasText(kind,item,searchAliases={}){
  const bucket=kind==='article'?searchAliases.articles:searchAliases.products;
  const key=item.slug||item.id||'';
  const external=Array.isArray(bucket?.[key])?bucket[key]:[];
  const inline=[
    ...(Array.isArray(item.searchAliases)?item.searchAliases:[]),
    ...(Array.isArray(item.aliases)?item.aliases:[]),
    item.koreanName,
    item.romanization,
    item.languageGuide?.koreanName,
    item.languageGuide?.pronunciation,
    ...(Array.isArray(item.languageGuide?.parts)
      ? item.languageGuide.parts.flatMap(part=>[part.korean,part.romanization])
      : [])
  ].filter(Boolean);
  return [...external,...inline].join(' ');
}

export function buildSearchDocuments({articles=[],products=[],categories={},searchAliases={}}={}){
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
    const aliases=aliasText('article',article,searchAliases);
    docs.push({
      kind:'article',
      id:article.id||article.slug,
      title,
      excerpt,
      label:sectionLabel||categoryLabel||'Article',
      href:`${encodeURIComponent(article.slug||'')}.html`,
      image:article.heroImage||'',
      imageAlt:article.heroImageAlt||'',
      publishedAt:article.publishedAt||'',
      fields:{
        title:normalize(title),
        aliases:normalize(aliases),
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
    const aliases=aliasText('product',product,searchAliases);
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
        aliases:normalize(aliases),
        tags:normalize(`${tags} ${categoryLabel} ${product.productMatchLabel||''}`),
        summary:normalize(excerpt),
        detail:normalize(detail)
      }
    });
  });

  return docs;
}

function editDistance(a,b){
  if(a===b)return 0;
  if(!a.length)return b.length;
  if(!b.length)return a.length;
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    let left=i;
    let diagonal=i-1;
    for(let j=1;j<=b.length;j++){
      const above=prev[j];
      const cost=a[i-1]===b[j-1]?0:1;
      const value=Math.min(
        above+1,
        left+1,
        diagonal+cost
      );
      prev[j-1]=left;
      diagonal=above;
      left=value;
      if(j===b.length)prev[j]=value;
    }
  }
  return prev[b.length];
}

function fuzzyTokenMatch(term,aliasField){
  if(!term||term.length<4||!aliasField)return false;
  const threshold=term.length>=6?2:1;
  return aliasField.split(/\s+/).some(token=>{
    if(token.length<4)return false;
    if(Math.abs(token.length-term.length)>threshold)return false;
    return editDistance(term,token)<=threshold;
  });
}

function scoreDocument(doc,phrase,terms){
  if(!phrase)return 0;
  let score=0;
  const {title='',aliases='',tags='',summary='',detail=''}=doc.fields||{};

  if(title===phrase)score+=80;
  else if(title.startsWith(phrase))score+=45;
  else if(title.includes(phrase))score+=35;

  if(aliases===phrase)score+=70;
  else if(aliases.includes(phrase))score+=32;

  if(tags.includes(phrase))score+=20;
  if(summary.includes(phrase))score+=14;
  if(detail.includes(phrase))score+=7;

  let matchedTerms=0;
  terms.forEach(term=>{
    let matched=false;
    if(title.includes(term)){score+=12;matched=true}
    if(aliases.includes(term)){score+=12;matched=true}
    if(tags.includes(term)){score+=7;matched=true}
    if(summary.includes(term)){score+=5;matched=true}
    if(detail.includes(term)){score+=2;matched=true}

    // Sound-alike / typo tolerance is deliberately limited to alias metadata.
    if(!matched&&fuzzyTokenMatch(term,aliases)){
      score+=6;
      matched=true;
    }
    if(matched)matchedTerms++;
  });

  if(terms.length>1&&matchedTerms===terms.length)score+=15;
  else if(terms.length>1&&matchedTerms>=Math.ceil(terms.length*.6))score+=5;

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
