(() => {
  const safe = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[char]));

  const words = values => new Set((values || []).flatMap(value =>
    String(value).toLowerCase().split(/[^a-z0-9\u3131-\uD79D]+/).filter(word => word.length > 2)
  ));

  const overlap = (left, right) => {
    const a = words(left);
    const b = words(right);
    let count = 0;
    a.forEach(word => { if (b.has(word)) count += 1; });
    return count;
  };

  const getJson = async (path, fallbackKey) => {
    try {
      const response = await fetch(path, { cache:'no-store' });
      if (!response.ok) throw new Error(`${path}: ${response.status}`);
      return await response.json();
    } catch (error) {
      const fallback = window.__CTK_DATA__?.[fallbackKey];
      if (!fallback) throw error;
      return fallback;
    }
  };

  const currentPage = (articles, products) => {
    const file = location.pathname.split('/').pop() || 'index.html';
    const params = new URLSearchParams(location.search);
    const articleSlug = file === 'article.html' ? params.get('slug') : file.replace(/\.html$/,'');
    const productSlug = file === 'product.html'
      ? params.get('slug')
      : (file.startsWith('product-') ? file.replace(/^product-|\.html$/g,'') : '');

    const product = products.find(item => item.slug === productSlug && !item.draft && !item.hidden);
    if (product) return { type:'product', item:product };
    const article = articles.find(item => item.slug === articleSlug && !item.draft && !item.hidden);
    return article ? { type:'article', item:article } : null;
  };

  const articleUrl = article => `${encodeURIComponent(article.slug)}.html`;
  const productUrl = product => `product-${encodeURIComponent(product.slug || product.id)}.html`;

  function candidatesFor(current, articles, products) {
    const source = current.item;
    const pool = [
      ...articles.filter(item => !item.draft && !item.hidden).map(item => ({ type:'article', item })),
      ...products.filter(item => !item.draft && !item.hidden).map(item => ({ type:'product', item }))
    ].filter(candidate => !(candidate.type === current.type && candidate.item.id === source.id));

    return pool.map(candidate => {
      const item = candidate.item;
      let score = 0;
      let relation = 'More to Explore';

      const exactProduct = current.type === 'article' && candidate.type === 'product' &&
        (source.relatedProductIds || []).includes(item.id);
      const explicitArticle = current.type === 'product' && candidate.type === 'article' &&
        ((source.relatedArticleSlugs || []).includes(item.slug) || (item.relatedProductIds || []).includes(source.id));

      if (exactProduct || explicitArticle) {
        score += 1000;
        relation = candidate.type === 'product' ? 'Related Product Guide' : 'Korean Context';
      }
      if (source.sectionKey && source.sectionKey === item.sectionKey) score += 120;
      if (source.categoryKey && source.categoryKey === item.categoryKey) score += 80;
      const tagScore = overlap(source.tags, item.tags);
      score += tagScore * 25;
      if (score < 1000 && (score >= 120 || tagScore > 0)) relation = 'Same Context';
      if (candidate.type !== current.type) score += 8;
      score += Math.max(0, Date.parse(item.publishedAt || 0) / 1e12);

      return { ...candidate, score, relation };
    }).sort((a,b) => b.score - a.score).slice(0,3);
  }

  function hideLegacyRelated() {
    document.querySelectorAll('[data-product-related-article], [data-related-products]').forEach(node => {
      const section = node.matches('[data-product-related-article]') ? node : node.closest('section');
      if (section) section.hidden = true;
    });
  }

  function render(items) {
    if (!items.length || document.querySelector('[data-related-content]')) return;
    const section = document.createElement('section');
    section.className = 'related-content';
    section.dataset.relatedContent = '';
    section.setAttribute('aria-labelledby','related-content-title');
    section.innerHTML = `
      <div class="related-content__inner">
        <p class="eyebrow">Keep exploring Korea</p>
        <div class="related-content__heading">
          <h2 id="related-content-title">Continue Your Discovery</h2>
          <p>Three useful next stops, selected by product connection and Korean-life context.</p>
        </div>
        <div class="related-content__grid">
          ${items.map(({type,item,relation}) => `
            <a class="related-content-card" href="${safe(type === 'article' ? articleUrl(item) : productUrl(item))}">
              <div class="related-content-card__image">
                <img src="${safe(type === 'article' ? item.heroImage : item.image)}"
                     alt="${safe(type === 'article' ? item.heroImageAlt || item.title : item.imageAlt || item.name)}"
                     loading="lazy" decoding="async">
              </div>
              <div class="related-content-card__body">
                <span>${safe(relation)}</span>
                <strong>${safe(type === 'article' ? item.title : item.name)}</strong>
                <small>${safe(type === 'article' ? item.excerpt : item.summary)}</small>
                <b>${type === 'article' ? 'Read the Story' : 'See the Product Guide'} →</b>
              </div>
            </a>
          `).join('')}
        </div>
      </div>`;

    const footer = document.querySelector('.site-footer');
    if (footer) footer.before(section);
  }

  async function init() {
    try {
      const [articles, products] = await Promise.all([
        getJson('data/articles.json','articles'),
        getJson('data/products.json','products')
      ]);
      const current = currentPage(articles, products);
      if (!current) return;
      hideLegacyRelated();
      render(candidatesFor(current, articles, products));
    } catch (error) {
      console.error('Related content could not load', error);
    }
  }

  init();
})();
