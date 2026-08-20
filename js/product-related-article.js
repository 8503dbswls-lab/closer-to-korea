(() => {
  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');

  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  // Explicit known links are used first.
  // Future products can move this relationship into products.json via relatedArticleSlugs.
  const knownLinks = {
    'egg-steamer': ['korean-microwave-steamed-egg-cooker']
  };

  async function getJson(path, fallbackKey){
    try{
      const response = await fetch(path,{cache:'no-store'});
      if(!response.ok) throw new Error(`${path}: ${response.status}`);
      return await response.json();
    }catch(error){
      const fallback = window.__CTK_DATA__;
      if(!fallback || !fallback[fallbackKey]) throw error;
      return fallback[fallbackKey];
    }
  }

  async function load(){
    const panel = document.querySelector('[data-product-related-article]');
    const content = document.querySelector('[data-product-related-article-content]');
    if(!panel || !content || !slug) return;

    try{
      const [products, articles] = await Promise.all([
        getJson('data/products.json','products'),
        getJson('data/articles.json','articles')
      ]);

      const product = products.find(item => item.slug === slug && !item.draft && !item.hidden);
      if(!product) return;

      const explicitSlugs = Array.isArray(product.relatedArticleSlugs) && product.relatedArticleSlugs.length
        ? product.relatedArticleSlugs
        : (knownLinks[product.slug] || []);

      let related = null;

      if(explicitSlugs.length){
        related = articles
          .filter(article => !article.draft && explicitSlugs.includes(article.slug))
          .sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''))[0] || null;
      }

      // Backward-compatible fallback:
      // if no explicit link exists, find an article that names this product ID.
      if(!related){
        related = articles
          .filter(article => !article.draft && (article.relatedProductIds||[]).includes(product.id))
          .sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''))[0] || null;
      }

      if(!related) return;

      content.innerHTML = `
        <a class="related-article-card" href="${encodeURIComponent(related.slug)}.html">
          <img src="${safe(related.heroImage)}"
               alt="${safe(related.heroImageAlt || related.title)}"
               loading="lazy"
               decoding="async">
          <span>
            <strong>${safe(related.title)}</strong>
            <small>${safe(related.excerpt || 'Learn how this product fits into Korean life.')}</small>
            <b>Read the full article →</b>
          </span>
        </a>
      `;

      panel.hidden = false;
    }catch(error){
      console.error('Related article could not load', error);
    }
  }

  load();
})();