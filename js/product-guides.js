(() => {
  const list=document.querySelector('[data-product-guide-list]');
  const empty=document.querySelector('[data-product-guide-empty]');
  if(!list)return;

  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  async function load(){
    try{
      let products;
      try{
        const response=await fetch('data/products.json',{cache:'no-store'});
        if(!response.ok)throw new Error('Product data failed');
        products=await response.json();
      }catch(error){
        if(!window.__CTK_DATA__)throw error;
        products=window.__CTK_DATA__.products;
      }

      const published=products
        .filter(product=>!product.draft&&!product.hidden)
        .sort((a,b)=>Number(b.featured)-Number(a.featured)||(b.publishedAt||'').localeCompare(a.publishedAt||''));

      if(!published.length){
        empty.hidden=false;
        return;
      }

      list.innerHTML=published.map(product=>`
        <article class="product-guide-card">
          <a class="product-guide-card__image" href="product.html?slug=${encodeURIComponent(product.slug)}">
            <img src="${safe(product.image)}" alt="${safe(product.imageAlt||product.name)}" loading="lazy" decoding="async">
          </a>
          <div class="product-guide-card__body">
            <div class="product-guide-card__badges">
              <span>${safe(product.productMatchLabel||product.productMatchType||'Product guide')}</span>
              ${(product.verificationLabels||[]).slice(0,2).map(label=>`<span>${safe(label)}</span>`).join('')}
            </div>
            <h2><a href="product.html?slug=${encodeURIComponent(product.slug)}">${safe(product.name)}</a></h2>
            <p>${safe(product.summary||'')}</p>
            <a class="jelly-button secondary" href="product.html?slug=${encodeURIComponent(product.slug)}">View product details</a>
          </div>
        </article>
      `).join('');
    }catch{
      empty.hidden=false;
      empty.querySelector('h3').textContent='Product guides could not load.';
      empty.querySelector('p').textContent='Please refresh the page and try again.';
    }
  }

  load();
})();