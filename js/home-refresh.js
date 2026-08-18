(() => {
  const q = selector => document.querySelector(selector);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));

  async function getJson(path, fallbackKey){
    try{
      const response = await fetch(path,{cache:'no-store'});
      if(!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
      return await response.json();
    }catch(error){
      const fallback = window.__CTK_DATA__;
      if(!fallback || !fallback[fallbackKey]) throw error;
      return fallback[fallbackKey];
    }
  }

  function dateValue(item){
    return item.publishedAt || item.updatedAt || item.lastCheckedAt || '';
  }

  function formatDate(value){
    if(!value) return '';
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime())
      ? value
      : parsed.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  }

  function publicArticles(items){
    return items
      .filter(item => !item.draft)
      .sort((a,b) => dateValue(b).localeCompare(dateValue(a)));
  }

  function publicProducts(items){
    return items
      .filter(item => !item.draft && !item.hidden)
      .sort((a,b) => Number(b.featured)-Number(a.featured) || dateValue(b).localeCompare(dateValue(a)));
  }

  function articleCard(article, compact=false){
    return `<article class="home-content-card home-content-card--article${compact?' is-compact':''}">
      <a class="home-content-card__image" href="article.html?slug=${encodeURIComponent(article.slug)}">
        <img src="${safe(article.heroImage)}" alt="${safe(article.heroImageAlt || article.title)}" loading="lazy" decoding="async">
      </a>
      <div class="home-content-card__body">
        <div class="home-content-card__meta">
          <span class="home-kind-badge">ARTICLE</span>
          ${article.sectionKey ? `<span>${safe(article.sectionKey.replaceAll('-',' '))}</span>` : ''}
        </div>
        <h3><a href="article.html?slug=${encodeURIComponent(article.slug)}">${safe(article.title)}</a></h3>
        <p>${safe(article.excerpt || '')}</p>
        <small>${dateValue(article) ? `Published ${safe(formatDate(dateValue(article)))}` : ''}</small>
      </div>
    </article>`;
  }

  function productCard(product, compact=false){
    const labels = Array.isArray(product.verificationLabels) ? product.verificationLabels.slice(0,2) : [];
    return `<article class="home-content-card home-content-card--product${compact?' is-compact':''}">
      <a class="home-content-card__image" href="product.html?slug=${encodeURIComponent(product.slug)}">
        <img src="${safe(product.image)}" alt="${safe(product.imageAlt || product.name)}" loading="lazy" decoding="async">
      </a>
      <div class="home-content-card__body">
        <div class="home-content-card__meta">
          <span class="home-kind-badge product">PRODUCT GUIDE</span>
          ${product.productMatchLabel ? `<span>${safe(product.productMatchLabel)}</span>` : ''}
        </div>
        <h3><a href="product.html?slug=${encodeURIComponent(product.slug)}">${safe(product.name)}</a></h3>
        <p>${safe(product.summary || '')}</p>
        ${labels.length ? `<div class="home-verification">${labels.map(label=>`<span>${safe(label)}</span>`).join('')}</div>` : ''}
      </div>
    </article>`;
  }

  function interleave(articles, products){
    const result=[];
    const max=Math.max(articles.length,products.length);
    for(let i=0;i<max;i++){
      if(articles[i]) result.push({type:'article',item:articles[i]});
      if(products[i]) result.push({type:'product',item:products[i]});
    }
    return result;
  }

  async function render(){
    try{
      const [articleData, productData] = await Promise.all([
        getJson('data/articles.json','articles'),
        getJson('data/products.json','products')
      ]);

      const articles = publicArticles(articleData);
      const products = publicProducts(productData);

      const latestGrid=q('[data-home-latest]');
      if(latestGrid){
        const mixed=interleave(articles.slice(0,2),products.slice(0,2));
        latestGrid.innerHTML=mixed.map(entry =>
          entry.type==='article' ? articleCard(entry.item,true) : productCard(entry.item,true)
        ).join('');
      }

      const articleGrid=q('[data-home-article-grid]');
      if(articleGrid){
        articleGrid.innerHTML=articles.slice(0,4).map(article=>articleCard(article)).join('');
      }

      const productGrid=q('[data-home-product-grid]');
      if(productGrid){
        productGrid.innerHTML=products.slice(0,3).map(product=>productCard(product)).join('');
      }

      const trendingSection=q('[data-home-trending-section]');
      const trendingGrid=q('[data-home-trending-grid]');
      const trending=products
        .filter(product=>['rising','trending'].includes(product.trendStatus))
        .sort((a,b)=>(b.lastCheckedAt||'').localeCompare(a.lastCheckedAt||''))
        .slice(0,3);

      if(trendingSection && trendingGrid && trending.length){
        trendingGrid.innerHTML=trending.map(product=>productCard(product,true)).join('');
        trendingSection.hidden=false;
      }
    }catch(error){
      console.error('Home refresh content failed to load',error);
    }
  }

  render();
})();
