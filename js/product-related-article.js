(() => {
  const params=new URLSearchParams(location.search);
  const slug=params.get('slug');
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  async function load(){
    const panel=document.querySelector('[data-product-related-article]');
    const content=document.querySelector('[data-product-related-article-content]');
    if(!panel||!content||!slug)return;

    try{
      const [productResponse,articleResponse]=await Promise.all([
        fetch('data/products.json',{cache:'no-store'}),
        fetch('data/articles.json',{cache:'no-store'})
      ]);
      if(!productResponse.ok||!articleResponse.ok)return;

      const [products,articles]=await Promise.all([
        productResponse.json(),
        articleResponse.json()
      ]);

      const product=products.find(item=>item.slug===slug&&!item.draft&&!item.hidden);
      if(!product)return;

      const related=articles
        .filter(article=>!article.draft&&(article.relatedProductIds||[]).includes(product.id))
        .sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''))[0];

      if(!related)return;

      content.innerHTML=`
        <a class="related-article-card" href="article.html?slug=${encodeURIComponent(related.slug)}">
          <img src="${safe(related.heroImage)}" alt="${safe(related.heroImageAlt||related.title)}" loading="lazy" decoding="async">
          <span>
            <strong>${safe(related.title)}</strong>
            <small>${safe(related.excerpt||'Learn how this product fits into Korean life.')}</small>
            <b>Read the full article →</b>
          </span>
        </a>
      `;
      panel.hidden=false;
    }catch{}
  }

  load();
})();