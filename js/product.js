const productParams=new URLSearchParams(location.search);
const requestedSlug=productParams.get('slug');

function productSafe(value=''){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}
function productDate(value){
  if(!value)return'Not yet checked';
  const parsed=new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())?value:parsed.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
}
function productAffiliateHref(product){
  return product.affiliateUrl||'';
}
function productMatchUiClass(key){
  return ({confirmed:'exact',likely:'similar',similar:'alternative','culture-inspired':'trend'})[key]||'alternative';
}
function productDetailCta(product){
  const href=productAffiliateHref(product);
  if(product.soldOut)return'<button class="jelly-button secondary" type="button" disabled>Sold out</button>';
  if(href)return `<a class="jelly-button primary" href="${productSafe(href)}" target="_blank" rel="sponsored nofollow noopener" data-affiliate-click="${productSafe(product.id)}" aria-label="${productSafe(product.cta||'View on Amazon')}: ${productSafe(product.name)}">${productSafe(product.cta||'View on Amazon')}</a>`;
  return `<button class="jelly-button secondary" type="button" disabled>${productSafe(product.amazonLabel||'Amazon match under review')}</button>`;
}
async function loadProductDetail(){
  const loading=document.querySelector('[data-product-loading]');
  const detail=document.querySelector('[data-product-detail]');
  const error=document.querySelector('[data-product-error]');
  try{
    let products;
    try{
      const response=await fetch('data/products.json',{cache:'no-store'});
      if(!response.ok)throw new Error('Product data request failed');
      products=await response.json();
    }catch(fetchError){
      if(!window.__CTK_DATA__)throw fetchError;
      products=window.__CTK_DATA__.products;
    }
    const product=products.find(item=>item.slug===requestedSlug&&!item.draft&&!item.hidden);
    if(!product)throw new Error('Product not found');

    document.title=`${product.name} | Closer to Korea`;
    const meta=document.querySelector('meta[name="description"]');
    if(meta)meta.content=product.summary;

    document.querySelector('[data-product-breadcrumb]').textContent=product.name;
    document.querySelector('[data-product-category]').textContent=product.category||product.categoryKey;
    document.querySelector('[data-product-name]').textContent=product.name;
    document.querySelector('[data-product-summary]').textContent=product.summary;

    const image=document.querySelector('[data-product-image]');
    image.src=product.image;
    image.alt=product.imageAlt||product.name;

    const match=document.querySelector('[data-product-match]');
    match.textContent=product.productMatchLabel||product.productMatchType;
    match.classList.add(productMatchUiClass(product.productMatchType));

    document.querySelector('[data-product-verification]').innerHTML=(product.verificationLabels||[]).map(label=>`<span>${productSafe(label)}</span>`).join('');
    document.querySelector('[data-product-checked]').textContent=`Last checked ${productDate(product.lastCheckedAt)}`;
    document.querySelector('[data-product-cta]').innerHTML=productDetailCta(product);
    document.querySelector('[data-product-affiliate-note]').textContent=productAffiliateHref(product)
      ?'Paid link: Closer to Korea may earn a commission. Price and availability can change.'
      :'No active Amazon link is attached while availability is being checked.';

    document.querySelector('[data-product-seen]').textContent=product.seenInKorea;
    document.querySelector('[data-product-used-by]').textContent=product.usedBy;
    document.querySelector('[data-product-why]').textContent=product.whyItMatters;
    document.querySelector('[data-product-status]').textContent=product.koreanProductStatus||'Verification pending';

    const difference=document.querySelector('[data-product-difference]');
    if(product.productMatchType!=='confirmed'&&product.usDifference){
      difference.textContent=product.usDifference;
      difference.hidden=false;
    }

    document.querySelector('[data-product-published]').textContent=productDate(product.publishedAt);
    document.querySelector('[data-product-last-checked]').textContent=productDate(product.lastCheckedAt);
    document.querySelector('[data-product-trend]').textContent=product.trendLabel||product.trendStatus;
    document.querySelector('[data-product-amazon-status]').textContent=product.amazonLabel||product.amazonAvailability||'Under review';

    const schema={
      "@context":"https://schema.org",
      "@type":"Product",
      "name":product.name,
      "description":product.summary,
      "image":product.image,
      "category":product.category||product.categoryKey
    };
    const script=document.createElement('script');
    script.type='application/ld+json';
    script.textContent=JSON.stringify(schema);
    document.head.appendChild(script);

    loading.hidden=true;
    error.hidden=true;
    detail.hidden=false;
  }catch(loadError){
    loading.hidden=true;
    detail.hidden=true;
    error.hidden=false;
  }
}
loadProductDetail();