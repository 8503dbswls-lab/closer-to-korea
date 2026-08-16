import {buildSearchDocuments,searchDocuments} from './search-core.mjs';

const qs=(selector,root=document)=>root.querySelector(selector);
const safe=(value='')=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));

async function fetchJson(path,key){
  try{
    const response=await fetch(path,{cache:'no-store'});
    if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }catch(error){
    const fallback=window.__CTK_DATA__;
    if(fallback&&Object.prototype.hasOwnProperty.call(fallback,key))return fallback[key];
    throw error;
  }
}

function resultCard(item){
  const kindLabel=item.kind==='article'?'Article':'Product';
  const image=item.image?`<img src="${safe(item.image)}" alt="${safe(item.imageAlt)}" loading="lazy" decoding="async">`:'';
  return `<article class="search-result-card">
    <a class="search-result-card__media" href="${safe(item.href)}">${image}</a>
    <div class="search-result-card__body">
      <div class="search-result-card__meta"><span>${kindLabel}</span><span>${safe(item.label)}</span></div>
      <h2><a href="${safe(item.href)}">${safe(item.title)}</a></h2>
      <p>${safe(item.excerpt)}</p>
      <a class="text-link" href="${safe(item.href)}">Open ${kindLabel.toLowerCase()} →</a>
    </div>
  </article>`;
}

function render(results,query){
  const resultsRoot=qs('[data-unified-search-results]');
  const status=qs('[data-unified-search-status]');
  const empty=qs('[data-unified-search-empty]');
  if(!resultsRoot||!status||!empty)return;
  const articles=results.filter(item=>item.kind==='article');
  const products=results.filter(item=>item.kind==='product');
  status.textContent=query?`${results.length} ${results.length===1?'result':'results'} for “${query}”.`:'Search articles and products across Closer to Korea.';
  empty.hidden=Boolean(results.length)||!query;
  if(!query){resultsRoot.innerHTML='';return}
  const sections=[];
  if(articles.length)sections.push(`<section class="search-result-group"><div class="section-head"><div><p class="eyebrow">Stories & guides</p><h2>Articles</h2></div><span>${articles.length}</span></div><div class="search-result-list">${articles.map(resultCard).join('')}</div></section>`);
  if(products.length)sections.push(`<section class="search-result-group"><div class="section-head"><div><p class="eyebrow">Verified product records</p><h2>Products</h2></div><span>${products.length}</span></div><div class="search-result-list">${products.map(resultCard).join('')}</div></section>`);
  resultsRoot.innerHTML=sections.join('');
}

async function init(){
  const params=new URLSearchParams(location.search);
  const query=(params.get('q')||'').trim();
  const input=qs('[data-unified-search-input]');
  if(input)input.value=query;
  try{
    const [articles,products,categories]=await Promise.all([
      fetchJson('data/articles.json','articles'),
      fetchJson('data/products.json','products'),
      fetchJson('data/categories.json','categories')
    ]);
    const documents=buildSearchDocuments({articles,products,categories});
    render(searchDocuments(documents,query),query);
  }catch(error){
    const status=qs('[data-unified-search-status]');
    if(status)status.textContent='Search is temporarily unavailable. Please try again later.';
    console.error(error);
  }
}

qs('[data-unified-search-form]')?.addEventListener('submit',event=>{
  const input=qs('[data-unified-search-input]',event.currentTarget);
  if(!input?.value.trim())event.preventDefault();
});

init();
