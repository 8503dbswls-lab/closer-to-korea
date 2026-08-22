const qs=(selector,root=document)=>root.querySelector(selector);
const qsa=(selector,root=document)=>[...root.querySelectorAll(selector)];

const state={
  products:[],
  articles:[],
  categories:{categories:[],curationFilters:[],matchTypes:[],verificationOptions:[],trendStatuses:[]},
  copy:{},
  monetization:window.__CTK_DATA__?.monetization||{adsense:{connectionEnabled:false,manualAdsEnabled:false},amazonAssociates:{enabled:false}},
  query:'',
  category:'all',
  match:'all',
  verification:'all',
  status:'all',
  sort:'featured'
};

const menuButton=qs('[data-menu-toggle],[data-menu]');
const mobileMenu=qs('[data-mobile-menu],[data-mobile]');
const searchButton=qs('[data-search-toggle],[data-search-btn]');
const searchPanel=qs('[data-site-search],[data-search]');
let previousFocus=null;

function safe(value=''){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}
function getPath(object,path){
  return path.split('.').reduce((value,key)=>value&&Object.prototype.hasOwnProperty.call(value,key)?value[key]:undefined,object);
}
function formatDate(value){
  if(!value)return'Not yet checked';
  const parsed=new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())?value:parsed.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
}
function focusable(root){
  return root?qsa('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),details summary,[tabindex]:not([tabindex="-1"])',root):[];
}
function setButtonLabel(button,open){
  if(!button)return;
  const isMenu=button===menuButton;
  button.textContent=open?(isMenu?'Close':'Close search'):(isMenu?'Menu':'Search');
  button.setAttribute('aria-label',open?(isMenu?'Close menu':'Close search'):(isMenu?'Open menu':'Open search'));
}
function closePanel(button,panel){
  if(!button||!panel)return;
  button.setAttribute('aria-expanded','false');
  panel.classList.remove('open');
  setButtonLabel(button,false);
  if(button===menuButton)document.body.classList.remove('menu-open');
}
function openPanel(button,panel){
  if(!button||!panel)return;
  previousFocus=document.activeElement;
  button.setAttribute('aria-expanded','true');
  panel.classList.add('open');
  setButtonLabel(button,true);
  if(button===menuButton)document.body.classList.add('menu-open');
  focusable(panel)[0]?.focus();
}
function togglePanel(button,panel,otherButton,otherPanel){
  closePanel(otherButton,otherPanel);
  panel?.classList.contains('open')?closePanel(button,panel):openPanel(button,panel);
}
menuButton?.addEventListener('click',()=>togglePanel(menuButton,mobileMenu,searchButton,searchPanel));
searchButton?.addEventListener('click',()=>togglePanel(searchButton,searchPanel,menuButton,mobileMenu));
document.addEventListener('keydown',event=>{
  if(event.key==='Escape'){
    const open=mobileMenu?.classList.contains('open')||searchPanel?.classList.contains('open');
    closePanel(menuButton,mobileMenu);
    closePanel(searchButton,searchPanel);
    if(open&&previousFocus instanceof HTMLElement)previousFocus.focus();
  }
  if(event.key==='Tab'&&mobileMenu?.classList.contains('open')){
    const items=focusable(mobileMenu);
    if(!items.length)return;
    const first=items[0],last=items[items.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
});

function applySiteCopy(){
  if(!state.copy||!Object.keys(state.copy).length)return;
  qsa('[data-copy]').forEach(element=>{
    const value=getPath(state.copy,element.dataset.copy);
    if(typeof value==='string')element.textContent=value;
  });
  qsa('[data-copy-target]').forEach(element=>{
    const value=getPath(state.copy,element.dataset.copyTarget);
    if(typeof value==='string')element.setAttribute('href',value);
  });

  const heroImage=qs('[data-hero-image]');
  if(heroImage){
    const source=getPath(state.copy,'hero.image');
    const alt=getPath(state.copy,'hero.imageAlt');
    if(source)heroImage.src=source;
    if(alt)heroImage.alt=alt;
  }
  qsa('[data-hero-note]').forEach(note=>{
    const value=getPath(state.copy,`hero.notes.${note.dataset.heroNote}`);
    if(value)note.textContent=value;
  });

  const trust=qs('[data-trust-items]');
  if(trust){
    const items=getPath(state.copy,'hero.trustItems')||[];
    trust.innerHTML=items.map(item=>`<span>${safe(item)}</span>`).join('');
  }

  const ticker=qs('[data-ticker]');
  if(ticker){
    const items=getPath(state.copy,'ticker')||[];
    ticker.innerHTML=[...items,...items].map(item=>`<span>${safe(item)}</span>`).join('');
  }

  const curator=qs('[data-curator-paragraphs]');
  if(curator){
    const paragraphs=getPath(state.copy,'sections.curator.paragraphs')||[];
    curator.innerHTML=paragraphs.map(text=>`<p>${safe(text)}</p>`).join('');
  }

  const title=getPath(state.copy,'site.defaultTitle');

  const description=getPath(state.copy,'site.defaultDescription');
  if(title)document.title=title;
  const metaDescription=qs('meta[name="description"]');
  if(description&&metaDescription)metaDescription.content=description;
}

function applyMonetizationState(){
  const helper=window.CTKMonetization;
  const adsenseConnected=Boolean(helper?.adsenseConnected(state.monetization));
  const manualAdsActive=Boolean(helper?.manualAdsEnabled(state.monetization));
  const amazonActive=Boolean(helper?.amazonEnabled(state.monetization));
  document.body.classList.toggle('adsense-connected',adsenseConnected);
  document.body.classList.toggle('manual-ads-enabled',manualAdsActive);
  document.body.classList.toggle('amazon-associates-enabled',amazonActive);

  qsa('[data-ad-mount]').forEach(mount=>{
    const slotName=mount.dataset.adMount||'';
    const wrapper=mount.closest('[data-ad-slot],.ad-slot');
    const rendered=Boolean(helper?.renderManualAdMount(mount,slotName,state.monetization));
    if(wrapper){
      wrapper.classList.toggle('is-active',rendered);
      wrapper.dataset.adConfigured=rendered?'true':'false';
    }
  });
}

function currentPageName(){
  const name=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  return name||'index.html';
}
function visibleEditorialSections(){
  const publishedKeys=new Set(publishedArticles().map(article=>article.sectionKey).filter(Boolean));
  return (state.categories.editorialSections||[])
    .filter(item=>item.active!==false&&(item.showWhenEmpty!==false||publishedKeys.has(item.key)))
    .sort((a,b)=>(a.order||0)-(b.order||0));
}
function navLink(item){
  const current=currentPageName();
  const active=(item.href||'').split('?')[0].toLowerCase()===current;
  return `<a href="${safe(item.href)}"${active?' aria-current="page"':''}>${safe(item.label)}</a>`;
}
function navigationMarkup(items=[],mobile=false){
  return items.map(item=>{
    const children=Array.isArray(item.children)?item.children:[];
    if(!children.length)return navLink(item);
    const current=currentPageName();
    const childActive=children.some(child=>(child.href||'').split('?')[0].toLowerCase()===current);
    return `<details class="nav-dropdown${childActive?' is-current':''}"${mobile&&childActive?' open':''}>
      <summary>${safe(item.label)}</summary>
      <div class="nav-dropdown__menu">${children.map(navLink).join('')}</div>
    </details>`;
  }).join('');
}
function renderNavigation(){
  const allSections=state.categories.editorialSections||[];
  const sectionHrefs=new Set(allSections.map(item=>item.href).filter(Boolean));
  const visibleHrefs=new Set(visibleEditorialSections().map(item=>item.href));
  const items=(state.copy.navigation||[]).map(item=>({
    ...item,
    children:Array.isArray(item.children)
      ?item.children.filter(child=>!sectionHrefs.has(child.href)||visibleHrefs.has(child.href))
      :item.children
  }));
  const desktop=qs('[data-navigation]');
  const mobile=qs('[data-mobile-navigation]');
  if(desktop)desktop.innerHTML=navigationMarkup(items,false);
  if(mobile){
    mobile.innerHTML=navigationMarkup(items,true);
    qsa('a',mobile).forEach(link=>link.addEventListener('click',()=>closePanel(menuButton,mobileMenu)));
  }
}

function renderExploreSections(){
  const grid=qs('[data-explore-sections]');
  if(!grid)return;
  const sections=visibleEditorialSections();
  if(!sections.length)return;
  grid.innerHTML=sections.map(item=>`<a href="${safe(item.href)}">
    <span aria-hidden="true">${safe(item.icon||'✦')}</span>
    <strong>${safe(item.label)}</strong>
    <small>${safe(item.homeBlurb||item.description||'Explore this side of everyday Korea.')}</small>
  </a>`).join('');
}

function scrollToProductGuide(){
  const target=qs('#products-with-context');
  if(!target)return;
  const behavior=window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
  requestAnimationFrame(()=>target.scrollIntoView({behavior,block:'start'}));
}

function syncCategoryBeadState(){
  qsa('[data-curation-filter]').forEach(button=>{
    const active=state.category==='all'&&state.status===button.dataset.curationFilter;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  qsa('[data-category-link]').forEach(button=>{
    const active=state.category===button.dataset.categoryLink&&state.status==='all';
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
}

function renderCategoryControls(){
  const publishedCategoryKeys=new Set(publicProducts().map(item=>item.categoryKey));
  const visibleCategories=(state.categories.categories||[])
    .filter(item=>item.active!==false&&publishedCategoryKeys.has(item.key))
    .sort((a,b)=>a.order-b.order);

  const menu=qs('[data-category-menu]');
  if(menu){
    const curation=(state.categories.curationFilters||[]).filter(item=>item.active!==false).sort((a,b)=>a.order-b.order)
      .map(item=>`<button type="button" data-curation-filter="${safe(item.key)}" aria-pressed="false">${safe(item.label)}</button>`);
    const categories=visibleCategories
      .map(item=>`<button type="button" data-category-link="${safe(item.key)}" aria-pressed="false">${safe(item.label)}</button>`);
    menu.innerHTML=[...curation,...categories].join('');
  }

  const categorySelect=qs('[data-category-filter]');
  if(categorySelect){
    categorySelect.innerHTML='<option value="all">All categories</option>'+
      visibleCategories.map(item=>`<option value="${safe(item.key)}">${safe(item.label)}</option>`).join('');
  }
  const matchSelect=qs('[data-match-filter]');
  if(matchSelect){
    matchSelect.innerHTML='<option value="all">All match types</option>'+
      (state.categories.matchTypes||[]).map(item=>`<option value="${safe(item.key)}">${safe(item.label)}</option>`).join('');
  }
  const verificationSelect=qs('[data-verification-filter]');
  if(verificationSelect){
    verificationSelect.innerHTML='<option value="all">All verification</option>'+
      (state.categories.verificationOptions||[]).map(item=>`<option value="${safe(item.key)}">${safe(item.label)}</option>`).join('');
  }
  bindDynamicFilters();
}

function bindDynamicFilters(){
  qsa('[data-category-link]').forEach(button=>{
    button.onclick=()=>setCategory(button.dataset.categoryLink);
  });
  qsa('[data-curation-filter]').forEach(button=>{
    button.onclick=()=>{
      state.category='all';
      state.status=button.dataset.curationFilter;
      const categorySelect=qs('[data-category-filter]');if(categorySelect)categorySelect.value='all';
      const statusSelect=qs('[data-status-filter]');if(statusSelect)statusSelect.value=state.status;
      renderProducts();
      scrollToProductGuide();
    };
  });
  syncCategoryBeadState();
}

function publicProducts(){
  return state.products.filter(product=>!product.draft&&!product.hidden);
}
function affiliateHref(product){
  return window.CTKMonetization?.affiliateHref(product,state.monetization)||'';
}
function productMatchUiClass(key){
  return ({confirmed:'exact',likely:'similar',similar:'alternative','culture-inspired':'trend'})[key]||'alternative';
}
function verificationChips(product){
  const labels=[...(product.verificationLabels||[])];
  if(product.personallyUsed&&!labels.includes('Personally Used'))labels.unshift('Personally Used');
  if(affiliateHref(product))labels.push('Available on Amazon US');
  return labels.map(label=>`<span>${safe(label)}</span>`).join('');
}
function productCta(product){
  if(!window.CTKMonetization?.amazonEnabled(state.monetization))return '';
  const href=affiliateHref(product);
  if(product.soldOut&&product.activePurchaseCta===true)return `<button class="jelly-button secondary" type="button" disabled aria-label="${safe(product.name)} is currently sold out">Sold out</button>`;
  if(href)return `<a class="jelly-button primary" href="${safe(href)}" target="_blank" rel="sponsored nofollow noopener" data-affiliate-click="${safe(product.id)}" aria-label="${safe(product.cta||'View product')}: ${safe(product.name)}">${safe(product.cta||'View product')}</a>`;
  return '';
}
function productCard(product,{compact=false}={}){
  const cardCopy=state.copy.productCard||{};
  const showDifference=product.productMatchType!=='confirmed'&&product.usDifference;
  const newBadge=product.newlyAdded?'<span class="new-badge">New</span>':'';
  const reviewBadge=product.reviewNeeded?'<span class="review-badge">Review Needed</span>':'';
  const details=compact?'':`<details class="product-details">
    <summary>${safe(cardCopy.detailsLabel||'More Korean context')}</summary>
    <dl class="product-context">
      <div><dt>${safe(cardCopy.seenLabel||'Where you see it in Korea')}</dt><dd>${safe(product.seenInKorea)}</dd></div>
      <div><dt>${safe(cardCopy.usedByLabel||'Who commonly uses it')}</dt><dd>${safe(product.usedBy)}</dd></div>
      <div><dt>${safe(cardCopy.whyLabel||'Why it is used or trending')}</dt><dd>${safe(product.whyItMatters)}</dd></div>
      <div><dt>${safe(cardCopy.statusLabel||'Korean product status')}</dt><dd>${safe(product.koreanProductStatus||'Verification pending')}</dd></div>
    </dl>
    ${showDifference?`<p class="match-note">${safe(product.usDifference)}</p>`:''}
  </details>`;
  return `<article class="product-card${compact?' compact-card':''}">
    <figure>
      <img src="${safe(product.image)}" width="800" height="800" loading="lazy" decoding="async" alt="${safe(product.imageAlt||product.name)}">
      <span class="match-badge ${safe(productMatchUiClass(product.productMatchType))}">${safe(product.productMatchLabel||product.productMatchType)}</span>
      ${newBadge}${reviewBadge}
    </figure>
    <div class="product-card-body">
      <div class="product-meta"><span>${safe(product.category||product.categoryKey)}</span><span>${safe(product.trendLabel||product.trendStatus)}</span></div>
      <h3>${safe(product.name)}</h3>
      <p class="product-tagline">${safe(product.summary)}</p>
      <p class="context-line"><strong>In Korea:</strong> ${safe(product.seenInKorea)}</p>
      ${details}
      <div class="verification-row">${verificationChips(product)}<span>Last checked ${formatDate(product.lastCheckedAt)}</span></div>
      <a class="product-detail-link" href="product.html?slug=${encodeURIComponent(product.slug||product.id)}">View full product details</a>
      ${(()=>{const cta=productCta(product);const note=(window.CTKMonetization?.amazonEnabled(state.monetization)&&affiliateHref(product))?safe(cardCopy.activeAffiliateText||'Paid link: we may earn a commission.'):'';return (cta||note)?`<div class="card-footer">${cta}${note?`<small class="affiliate-note">${note}</small>`:''}</div>`:'';})()}
    </div>
  </article>`;
}

function matchesVerification(product,value){
  if(value==='all')return true;
  if(value==='personally-used')return Boolean(product.personallyUsed);
  return (product.verificationStatus||[]).includes(value);
}
function matchesStatus(product,value){
  if(value==='all')return true;
  if(value==='new')return Boolean(product.newlyAdded);
  if(value==='trending')return ['rising','trending'].includes(product.trendStatus);
  if(value==='featured')return Boolean(product.featured);
  if(value==='available')return Boolean(affiliateHref(product))&&!product.soldOut;
  if(value==='actually-used')return product.personallyUsed||(product.verificationStatus||[]).includes('seen-in-daily-life');
  if(value==='seen-everywhere')return (product.verificationLabels||[]).includes('Seen Everywhere in Korea');
  return true;
}
function filteredProducts(){
  const words=state.query.toLowerCase().split(/\s+/).filter(Boolean);
  let list=publicProducts().filter(product=>{
    const haystack=[
      product.name,product.summary,product.category,product.categoryKey,
      product.seenInKorea,product.usedBy,product.whyItMatters,
      product.koreanProductStatus,product.productMatchLabel,
      ...(product.tags||[]),...(product.verificationLabels||[])
    ].join(' ').toLowerCase();
    return words.every(word=>haystack.includes(word))
      &&(state.category==='all'||product.categoryKey===state.category)
      &&(state.match==='all'||product.productMatchType===state.match)
      &&matchesVerification(product,state.verification)
      &&matchesStatus(product,state.status);
  });
  if(state.sort==='newest')list.sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
  if(state.sort==='checked')list.sort((a,b)=>b.lastCheckedAt.localeCompare(a.lastCheckedAt));
  if(state.sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name));
  if(state.sort==='featured')list.sort((a,b)=>Number(b.featured)-Number(a.featured)||b.publishedAt.localeCompare(a.publishedAt));
  return list;
}
function renderPreviews(){
  const newGrid=qs('[data-new-products]');
  const trendGrid=qs('[data-trending-products]');
  const newEmpty=qs('[data-new-empty]');
  const all=publicProducts();
  const newItems=all.filter(item=>item.newlyAdded).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,4);
  const trending=all.filter(item=>['rising','trending'].includes(item.trendStatus)).sort((a,b)=>b.lastCheckedAt.localeCompare(a.lastCheckedAt)).slice(0,4);
  if(newGrid)newGrid.innerHTML=newItems.map(item=>productCard(item,{compact:true})).join('');
  if(newEmpty)newEmpty.hidden=newItems.length!==0;
  if(trendGrid){
    const emptyTitle=getPath(state.copy,'sections.trending.emptyTitle')||'No trend has been confirmed this week.';
    const emptyText=getPath(state.copy,'sections.trending.emptyText')||'New Korean finds are added weekly.';
    trendGrid.innerHTML=trending.length?trending.map(item=>productCard(item,{compact:true})).join(''):`<div class="empty-state compact"><h3>${safe(emptyTitle)}</h3><p>${safe(emptyText)}</p></div>`;
  }
}
function renderProducts(){
  const grid=qs('[data-product-grid]');
  if(!grid)return;
  const list=filteredProducts();
  grid.innerHTML=list.map(item=>productCard(item)).join('');
  const count=qs('[data-results-count]');
  if(count)count.textContent=`${list.length} curated ${list.length===1?'product':'products'}`;
  const empty=qs('[data-empty-state]');
  if(empty)empty.hidden=list.length!==0;
  renderActiveFilters();
  syncCategoryBeadState();
  updateUrl();
}
function renderActiveFilters(){
  const container=qs('[data-active-filters]');
  if(!container)return;
  const labels=[];
  if(state.query)labels.push(`Search: “${state.query}”`);
  if(state.category!=='all')labels.push(`Category: ${state.category}`);
  if(state.match!=='all')labels.push(`Match: ${state.match}`);
  if(state.verification!=='all')labels.push(`Verification: ${state.verification}`);
  if(state.status!=='all')labels.push(`Status: ${state.status}`);
  container.textContent=labels.length?labels.join(' · '):'Showing the complete product guide.';
}
function updateUrl(){
  const params=new URLSearchParams();
  if(state.query)params.set('q',state.query);
  if(state.category!=='all')params.set('category',state.category);
  if(state.match!=='all')params.set('match',state.match);
  if(state.verification!=='all')params.set('verification',state.verification);
  if(state.status!=='all')params.set('status',state.status);
  if(state.sort!=='featured')params.set('sort',state.sort);
  history.replaceState(null,'',`${location.pathname}${params.toString()?`?${params}`:''}${location.hash||''}`);
}
function loadStateFromUrl(){
  const params=new URLSearchParams(location.search);
  state.query=params.get('q')||'';
  state.category=params.get('category')||'all';
  state.match=params.get('match')||'all';
  state.verification=params.get('verification')||'all';
  state.status=params.get('status')||'all';
  state.sort=params.get('sort')||'featured';
}
function syncControls(){
  const values=[
    ['[data-global-search]',state.query],
    ['[data-category-filter]',state.category],
    ['[data-match-filter]',state.match],
    ['[data-verification-filter]',state.verification],
    ['[data-status-filter]',state.status],
    ['[data-sort]',state.sort]
  ];
  values.forEach(([selector,value])=>{const element=qs(selector);if(element)element.value=value});
}
function setCategory(value){
  state.category=value;
  state.status='all';
  syncControls();
  renderProducts();
  scrollToProductGuide();
}

function publishedArticles(){
  return state.articles
    .filter(article=>!article.draft)
    .sort((a,b)=>Number(b.featured)-Number(a.featured)||b.publishedAt.localeCompare(a.publishedAt));
}
function articleCard(article,{layout='guide'}={}){
  if(layout==='story'){
    return `<article class="card">
      <img src="${safe(article.heroImage)}" width="1200" height="760" loading="lazy" decoding="async" alt="${safe(article.heroImageAlt)}">
      <div class="card-body">
        <span class="label lavender">${safe(article.sectionKey||article.categoryKey||'Closer to Korea')}</span>
        <h3>${safe(article.title)}</h3>
        <p>${safe(article.excerpt)}</p>
        <a href="${encodeURIComponent(article.slug)}.html">Read story →</a>
      </div>
    </article>`;
  }
  return `<a href="${encodeURIComponent(article.slug)}.html">
    <img src="${safe(article.heroImage)}" width="1200" height="760" loading="lazy" decoding="async" alt="${safe(article.heroImageAlt)}">
    <strong>${safe(article.title)}</strong>
    <span>${safe(article.excerpt)}</span>
    <small>Published ${formatDate(article.publishedAt)}</small>
  </a>`;
}
function editorialSectionConfig(sectionKey){
  return (state.categories.editorialSections||[]).find(item=>item.key===sectionKey)||null;
}
function sectionArticles(sectionKey){
  return publishedArticles()
    .filter(article=>article.sectionKey===sectionKey)
    .sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||'')||(a.title||'').localeCompare(b.title||''));
}
function sectionFeaturedArticle(sectionKey){
  const list=sectionArticles(sectionKey);
  const config=editorialSectionConfig(sectionKey);
  const min=Math.max(1,Number(config?.featuredMinArticles||4));

  if(list.length<min)return null;

  return list.find(article=>article.featured===true)||list[0]||null;
}
function renderSectionFeatured(){
  qsa('[data-section-featured]').forEach(container=>{
    const sectionKey=container.dataset.sectionKey||'';
    const article=sectionFeaturedArticle(sectionKey);
    const wrapper=container.closest('section');
    if(!article){
      container.replaceChildren();
      if(wrapper)wrapper.hidden=true;
      return;
    }
    container.innerHTML=`
      <img class="media" src="${safe(article.heroImage)}" loading="lazy" decoding="async" alt="${safe(article.heroImageAlt)}">
      <div class="panel">
        <span class="label cherry label-featured">Featured guide</span>
        <h2 class="section-title">${safe(article.title)}</h2>
        <p>${safe(article.excerpt)}</p>
        <a class="button" href="${encodeURIComponent(article.slug)}.html">Read the guide</a>
      </div>`;
    if(wrapper)wrapper.hidden=false;
  });
}
function renderArticles(){
  const grids=qsa('[data-article-grid]');
  const published=publishedArticles();
  renderSectionFeatured();
  if(!grids.length)return;
  grids.forEach(grid=>{
    const contentType=grid.dataset.contentType||'';
    const sectionKey=grid.dataset.sectionKey||'';
    const layout=grid.dataset.articleLayout||'guide';
    const excludeFeatured=grid.dataset.excludeFeatured==='true';
    const featured=sectionKey?sectionFeaturedArticle(sectionKey):null;
    const list=published
      .filter(article=>(!contentType||article.contentType===contentType)&&(!sectionKey||article.sectionKey===sectionKey))
      .filter(article=>!excludeFeatured||!featured||article.slug!==featured.slug);

    if(sectionKey){
      list.sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||'')||(a.title||'').localeCompare(b.title||''));
    }

    grid.innerHTML=list.map(article=>articleCard(article,{layout})).join('');
    const scope=grid.closest('section')||grid.parentElement||document;
    const empty=qs('[data-article-empty]',scope);
    if(empty)empty.hidden=list.length!==0;
  });
}

function bindControls(){
  qs('[data-search-submit]')?.addEventListener('click',()=>{
    state.query=qs('[data-global-search]')?.value.trim()||'';
    renderProducts();
    const status=qs('[data-search-status]');
    if(status)status.textContent=state.query?`Showing products matching “${state.query}”.`:'Showing all products.';
    closePanel(searchButton,searchPanel);
    location.hash='products-with-context';
  });
  qs('[data-global-search]')?.addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();qs('[data-search-submit]')?.click()}
  });
  qs('[data-category-filter]')?.addEventListener('change',event=>{state.category=event.target.value;renderProducts()});
  qs('[data-match-filter]')?.addEventListener('change',event=>{state.match=event.target.value;renderProducts()});
  qs('[data-verification-filter]')?.addEventListener('change',event=>{state.verification=event.target.value;renderProducts()});
  qs('[data-status-filter]')?.addEventListener('change',event=>{state.status=event.target.value;renderProducts()});
  qs('[data-sort]')?.addEventListener('change',event=>{state.sort=event.target.value;renderProducts()});
  qs('[data-actually-used-filter]')?.addEventListener('click',()=>{
    state.category='all';state.status='actually-used';syncControls();renderProducts();location.hash='products-with-context';
  });
  qs('[data-clear-filters]')?.addEventListener('click',()=>{
    Object.assign(state,{query:'',category:'all',match:'all',verification:'all',status:'all',sort:'featured'});
    syncControls();renderProducts();
  });
  qs('[data-retry-products]')?.addEventListener('click',loadData);
  qs('[data-newsletter]')?.addEventListener('submit',event=>{
    event.preventDefault();
    const message=getPath(state.copy,'sections.newsletter.demoMessage')||'Demo only — your email was not sent or stored.';
    const status=qs('[data-newsletter-status]',event.currentTarget);
    if(status)status.textContent=message;
    event.currentTarget.reset();
  });
}

async function sharePage(){
  const status=qs('[data-share-status]');
  try{
    if(navigator.share){
      await navigator.share({title:document.title,text:'Things Koreans actually use, explained with Korean context.',url:location.href});
      if(status)status.textContent='Share sheet opened.';
    }else{
      await navigator.clipboard.writeText(location.href);
      if(status)status.textContent='Link copied.';
    }
  }catch(error){
    if(error.name!=='AbortError'&&status)status.textContent='Sharing was not completed.';
  }
}
qsa('[data-share-page]').forEach(button=>button.addEventListener('click',sharePage));
qsa('[data-copy-link]').forEach(button=>button.addEventListener('click',async()=>{
  const status=qs('[data-share-status]');
  try{await navigator.clipboard.writeText(location.href);button.textContent='Link copied';if(status)status.textContent='Link copied to clipboard.'}
  catch{if(status)status.textContent='Copy the page URL from your browser.'}
}));

async function fetchJson(path){
  try{
    const response=await fetch(path,{cache:'no-store'});
    if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }catch(error){
    const fallback=window.__CTK_DATA__;
    if(!fallback)throw error;
    if(path.endsWith('products.json'))return fallback.products;
    if(path.endsWith('articles.json'))return fallback.articles;
    if(path.endsWith('categories.json'))return fallback.categories;
    if(path.endsWith('site-copy.json'))return fallback.siteCopy;
    if(path.endsWith('monetization.json'))return fallback.monetization;
    throw error;
  }
}
async function loadData(){
  const error=qs('[data-error-state]');
  if(error)error.hidden=true;
  const results=await Promise.allSettled([
    fetchJson('data/products.json'),
    fetchJson('data/articles.json'),
    fetchJson('data/categories.json'),
    fetchJson('data/site-copy.json'),
    fetchJson('data/monetization.json')
  ]);
  if(results[0].status==='fulfilled'){
    const now=Date.now();
    const threshold=1000*60*60*24*60;
    state.products=results[0].value.map(product=>({
      ...product,
      reviewNeeded:Boolean(product.lastCheckedAt)&&now-new Date(`${product.lastCheckedAt}T00:00:00`).getTime()>threshold
    }));
  }else{
    state.products=[];
    if(error)error.hidden=false;
  }
  state.articles=results[1].status==='fulfilled'?results[1].value:[];
  state.categories=results[2].status==='fulfilled'?results[2].value:state.categories;
  state.copy=results[3].status==='fulfilled'?results[3].value:state.copy;
  state.monetization=results[4].status==='fulfilled'?results[4].value:state.monetization;

  applySiteCopy();
  applyMonetizationState();
  renderNavigation();
  renderExploreSections();
  renderCategoryControls();
  syncControls();
  renderPreviews();
  renderProducts();
  renderArticles();
}
loadStateFromUrl();
bindControls();
loadData();

// Legacy editorial pages remain functional.
const legacySearchForm=qs('[data-search-form]');
legacySearchForm?.addEventListener('submit',event=>{
  event.preventDefault();
  const input=qs('[data-search-input]',legacySearchForm);
  const term=(input?.value||'').trim().toLowerCase();
  let visible=0;
  qsa('[data-results] .card').forEach(card=>{
    const show=!term||card.textContent.toLowerCase().includes(term);
    card.hidden=!show;if(show)visible++;
  });
  let status=qs('[data-legacy-results-status]');
  if(!status){
    status=document.createElement('p');
    status.dataset.legacyResultsStatus='';
    status.setAttribute('aria-live','polite');
    legacySearchForm.insertAdjacentElement('afterend',status);
  }
  status.textContent=`${visible} ${visible===1?'result':'results'} shown.`;
  closePanel(searchButton,searchPanel);
});
const legacyFilters=qsa('[data-filter]');
legacyFilters.forEach(button=>button.addEventListener('click',()=>{
  legacyFilters.forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))});
  const selected=button.dataset.filter||'all';
  qsa('[data-category]').forEach(card=>{
    const categories=(card.dataset.category||'').split(/\s+/);
    card.hidden=selected!=='all'&&!categories.includes(selected);
  });
}));

const finePointer=window.matchMedia('(pointer:fine)').matches;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const cursor=qs('.cursor-sparkle');
if(cursor&&finePointer&&!reducedMotion){
  let last=0;
  const particles=[];
  const shapes=['✦','·','◇','*','✦','·','·','✦','♡'];
  const remove=node=>{const index=particles.indexOf(node);if(index>=0)particles.splice(index,1);node.remove()};
  window.addEventListener('pointermove',event=>{
    cursor.style.left=`${event.clientX}px`;
    cursor.style.top=`${event.clientY}px`;
    cursor.style.opacity='1';
    const now=performance.now();
    if(now-last<85)return;
    last=now;
    while(particles.length>=10)remove(particles[0]);
    const particle=document.createElement('span');
    particle.className='sparkle-particle';
    particle.textContent=shapes[Math.floor(Math.random()*shapes.length)];
    particle.style.left=`${event.clientX}px`;
    particle.style.top=`${event.clientY}px`;
    document.body.appendChild(particle);
    particles.push(particle);
    particle.addEventListener('animationend',()=>remove(particle),{once:true});
  },{passive:true});
  document.addEventListener('mouseleave',()=>{cursor.style.opacity='0'});
}else if(cursor){cursor.hidden=true}

document.addEventListener('click',event=>{
  const affiliate=event.target.closest('[data-affiliate-click]');
  if(affiliate)window.dispatchEvent(new CustomEvent('affiliate-click',{detail:{productId:affiliate.dataset.affiliateClick,href:affiliate.href}}));
});