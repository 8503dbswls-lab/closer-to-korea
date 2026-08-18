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
function productMonetizationConfig(){
  return window.__CTK_DATA__?.monetization||{adsense:{connectionEnabled:false,manualAdsEnabled:false},amazonAssociates:{enabled:false}};
}
function productAffiliateHref(product){
  return window.CTKMonetization?.affiliateHref(product,productMonetizationConfig())||'';
}
function productMatchUiClass(key){
  return ({confirmed:'exact',likely:'similar',similar:'alternative','culture-inspired':'trend'})[key]||'alternative';
}
function productDetailCta(product){
  const config=productMonetizationConfig();
  if(!window.CTKMonetization?.amazonEnabled(config))return '';
  const href=productAffiliateHref(product);
  if(product.soldOut&&product.activePurchaseCta===true)return'<button class="jelly-button secondary" type="button" disabled>Sold out</button>';
  if(href)return `<a class="jelly-button primary" href="${productSafe(href)}" target="_blank" rel="sponsored nofollow noopener" data-affiliate-click="${productSafe(product.id)}" aria-label="${productSafe(product.cta||'View on Amazon')}: ${productSafe(product.name)}">${productSafe(product.cta||'View on Amazon')}</a>`;
  return '';
}

function ensureProductGalleryStyles(){
  if(document.getElementById('ctk-product-gallery-styles'))return;
  const style=document.createElement('style');
  style.id='ctk-product-gallery-styles';
  style.textContent=`
    .product-gallery{margin-top:.8rem}
    .product-gallery__caption{margin:.55rem .1rem 0;color:var(--muted);font-size:.88rem}
    .product-gallery__thumbs{display:flex;gap:.6rem;overflow-x:auto;padding:.65rem .1rem .2rem;scroll-snap-type:x proximity}
    .product-gallery__thumb{flex:0 0 84px;width:84px;height:84px;padding:3px;border:2px solid transparent;border-radius:16px;background:#fff;cursor:pointer;scroll-snap-align:start;box-shadow:0 8px 20px rgba(93,72,120,.08)}
    .product-gallery__thumb[aria-current="true"]{border-color:#ff5b9c}
    .product-gallery__thumb:focus-visible{outline:3px solid var(--cherry);outline-offset:2px}
    .product-gallery__thumb img{width:100%;height:100%;object-fit:cover;border-radius:11px}
    .data-product-hero>figure>[data-product-image]{transition:opacity .15s ease}
    @media(min-width:700px){
      .product-gallery__thumb{flex-basis:92px;width:92px;height:92px}
    }
  `;
  document.head.appendChild(style);
}

function renderProductGallery(product,image){
  const items=Array.isArray(product.images)&&product.images.length
    ?product.images
    :[{src:product.image,alt:product.imageAlt||product.name,caption:''}];

  const figure=image.closest('figure');
  if(!figure||items.length<2)return items;

  ensureProductGalleryStyles();

  const gallery=document.createElement('div');
  gallery.className='product-gallery';
  gallery.setAttribute('aria-label',`${product.name} photo gallery`);

  const caption=document.createElement('p');
  caption.className='product-gallery__caption';
  caption.setAttribute('aria-live','polite');

  const thumbs=document.createElement('div');
  thumbs.className='product-gallery__thumbs';

  function selectItem(item,button){
    image.style.opacity='.45';
    image.src=item.src;
    image.alt=item.alt||product.name;
    if(item.width)image.width=item.width;
    if(item.height)image.height=item.height;
    caption.textContent=item.caption||'';
    thumbs.querySelectorAll('.product-gallery__thumb').forEach(node=>node.setAttribute('aria-current','false'));
    button?.setAttribute('aria-current','true');
    requestAnimationFrame(()=>{image.style.opacity='1';});
  }

  items.forEach((item,index)=>{
    const button=document.createElement('button');
    button.type='button';
    button.className='product-gallery__thumb';
    button.setAttribute('aria-label',`View product photo ${index+1} of ${items.length}`);
    button.setAttribute('aria-current',index===0?'true':'false');
    button.innerHTML=`<img src="${productSafe(item.src)}" alt="" loading="lazy" decoding="async">`;
    button.addEventListener('click',()=>selectItem(item,button));
    thumbs.appendChild(button);
  });

  caption.textContent=items[0].caption||'';
  gallery.append(caption,thumbs);
  figure.insertAdjacentElement('afterend',gallery);

  image.src=items[0].src;
  image.alt=items[0].alt||product.name;
  if(items[0].width)image.width=items[0].width;
  if(items[0].height)image.height=items[0].height;

  return items;
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
    const canonicalUrl=`https://closertokorea.com/product.html?slug=${encodeURIComponent(product.slug)}`;
    let canonical=document.querySelector('link[rel="canonical"]');
    if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical);}
    canonical.href=canonicalUrl;
    let ogUrl=document.querySelector('meta[property="og:url"]');
    if(!ogUrl){ogUrl=document.createElement('meta');ogUrl.setAttribute('property','og:url');document.head.appendChild(ogUrl);}
    ogUrl.content=canonicalUrl;
    let ogTitle=document.querySelector('meta[property="og:title"]');
    if(!ogTitle){ogTitle=document.createElement('meta');ogTitle.setAttribute('property','og:title');document.head.appendChild(ogTitle);}
    ogTitle.content=`${product.name} | Closer to Korea`;
    let ogDescription=document.querySelector('meta[property="og:description"]');
    if(!ogDescription){ogDescription=document.createElement('meta');ogDescription.setAttribute('property','og:description');document.head.appendChild(ogDescription);}
    ogDescription.content=product.summary;

    document.querySelector('[data-product-breadcrumb]').textContent=product.name;
    document.querySelector('[data-product-category]').textContent=product.category||product.categoryKey;
    document.querySelector('[data-product-name]').textContent=product.name;
    document.querySelector('[data-product-summary]').textContent=product.summary;

    const image=document.querySelector('[data-product-image]');
    image.src=product.image;
    image.alt=product.imageAlt||product.name;
    const galleryItems=renderProductGallery(product,image);

    const match=document.querySelector('[data-product-match]');
    match.textContent=product.productMatchLabel||product.productMatchType;
    match.classList.add(productMatchUiClass(product.productMatchType));

    document.querySelector('[data-product-verification]').innerHTML=(product.verificationLabels||[]).map(label=>`<span>${productSafe(label)}</span>`).join('');
    document.querySelector('[data-product-checked]').textContent=`Last checked ${productDate(product.lastCheckedAt)}`;
    const amazonOn=window.CTKMonetization?.amazonEnabled(productMonetizationConfig())===true;
    const affiliateHref=productAffiliateHref(product);
    document.querySelector('[data-product-cta]').innerHTML=productDetailCta(product);
    const affiliateNote=document.querySelector('[data-product-affiliate-note]');
    affiliateNote.textContent=amazonOn&&affiliateHref
      ?'Paid link: Closer to Korea may earn a commission. Price and availability can change.'
      :'';
    affiliateNote.hidden=!(amazonOn&&affiliateHref);
    const amazonRow=document.querySelector('[data-product-amazon-row]');
    amazonRow.hidden=!amazonOn;

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
      "image":galleryItems.map(item=>new URL(item.src,location.href).href),
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