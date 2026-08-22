(() => {
  const list = document.querySelector('[data-product-guide-list]');
  const empty = document.querySelector('[data-product-guide-empty]');
  if (!list) return;

  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  const canonicalProductKey = product => String(
    product?.slug || product?.id || product?.name || ''
  ).trim().toLowerCase();

  const staticProductHref = product =>
    'product-' + encodeURIComponent(String(product.slug || product.id || '').trim()) + '.html';

  async function load() {
    try {
      let products = [];

      try {
        const response = await fetch('data/products.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Product data failed');
        products = await response.json();
      } catch (error) {
        if (!window.__CTK_DATA__) throw error;
        products = window.__CTK_DATA__.products || [];
      }

      const seen = new Set();

      const published = (products || [])
        .filter(product => !product.draft && !product.hidden)
        .sort((a,b) =>
          Number(b.featured) - Number(a.featured) ||
          String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')) ||
          String(a.name || '').localeCompare(String(b.name || ''))
        )
        .filter(product => {
          const key = canonicalProductKey(product);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });

      if (!published.length) {
        empty.hidden = false;
        return;
      }

      list.innerHTML = published.map(product => {
        const href = staticProductHref(product);

        return `
          <article class="product-guide-card">
            <a class="product-guide-card__image" href="${safe(href)}">
              <img src="${safe(product.image)}"
                   alt="${safe(product.imageAlt || product.name)}"
                   loading="lazy"
                   decoding="async">
            </a>
            <div class="product-guide-card__body">
              <div class="product-guide-card__badges">
                <span>${safe(product.productMatchLabel || product.productMatchType || 'Product guide')}</span>
                ${(product.verificationLabels || [])
                  .slice(0,2)
                  .map(label => `<span>${safe(label)}</span>`)
                  .join('')}
              </div>
              <h2><a href="${safe(href)}">${safe(product.name)}</a></h2>
              <p>${safe(product.summary || '')}</p>
              <a class="jelly-button secondary" href="${safe(href)}">View product details</a>
            </div>
          </article>
        `;
      }).join('');
    } catch {
      empty.hidden = false;
      empty.querySelector('h3').textContent = 'Product guides could not load.';
      empty.querySelector('p').textContent = 'Please refresh the page and try again.';
    }
  }

  load();
})();