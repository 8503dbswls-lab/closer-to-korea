(() => {
  const list=document.querySelector('[data-product-guide-list]');
  const empty=document.querySelector('[data-product-guide-empty]');
  if(!list)return;

  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  async function load(){
    try{
      let products=[];
      let articles=[];

      try{
        const [productResponse,articleResponse]=await Promise.all([
          fetch('data/products.json',{cache:'no-store'}),
          fetch('data/articles.json',{cache:'no-store'})
        ]);

        if(productResponse.ok) products=await productResponse.json();
        if(articleResponse.ok) articles=await articleResponse.json();

        if(!productResponse.ok && !articleResponse.ok){
          throw new Error('Product guide data failed');
        }
      }catch(error){
        if(!window.__CTK_DATA__)throw error;
        products=window.__CTK_DATA__.products||[];
        articles=window.__CTK_DATA__.articles||[];
      }

      const publishedProducts=(products||[])
        .filter(product=>!product.draft&&!product.hidden)
        .map(product=>({
          title:product.name,
          summary:product.summary||'',
          image:product.image,
          imageAlt:product.imageAlt||product.name,
          href:'product.html?slug='+encodeURIComponent(product.slug),
          badges:[
            product.productMatchLabel||product.productMatchType||'Product guide',
            ...(product.verificationLabels||[]).slice(0,2)
          ],
          publishedAt:product.publishedAt||'',
          featured:!!product.featured
        }));

      const publishedArticles=(articles||[])
        .filter(article=>!article.draft&&(article.isProductGuide===true||article.contentType==='product-guide'))
        .map(article=>({
          title:article.title,
          summary:article.excerpt||article.metaDescription||'',
          image:article.heroImage,
          imageAlt:article.heroImageAlt||article.title,
          href:article.slug+'.html',
          badges:['Product Guide',article.categoryLabel||'Korean Kitchen'],
          publishedAt:article.publishedAt||'',
          featured:!!article.featured
        }));

      const published=[...publishedProducts,...publishedArticles]
        .sort((a,b)=>Number(b.featured)-Number(a.featured)||(b.publishedAt||'').localeCompare(a.publishedAt||''));

      if(!published.length){
        empty.hidden=false;
        return;
      }

      list.innerHTML=published.map(item=>`
        <article class="product-guide-card">
          <a class="product-guide-card__image" href="${safe(item.href)}">
            <img src="${safe(item.image)}" alt="${safe(item.imageAlt||item.title)}" loading="lazy" decoding="async">
          </a>
          <div class="product-guide-card__body">
            <div class="product-guide-card__badges">
              ${(item.badges||[]).filter(Boolean).slice(0,3).map(label=>`<span>${safe(label)}</span>`).join('')}
            </div>
            <h2><a href="${safe(item.href)}">${safe(item.title)}</a></h2>
            <p>${safe(item.summary||'')}</p>
            <a class="jelly-button secondary" href="${safe(item.href)}">View guide</a>
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
