const articleQuery=new URLSearchParams(location.search);
const articleSlug=articleQuery.get('slug');

function articleSafe(value=''){
  return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}
function articleDate(value){
  if(!value)return'';
  const parsed=new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime())?value:parsed.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
}
function createArticleAdSlot(slotName){
  const helper=window.CTKMonetization;
  if(!helper?.manualAdSlotConfigured(slotName))return null;
  const wrapper=document.createElement('aside');
  wrapper.className='ad-slot article-ad-slot is-active';
  wrapper.dataset.adSlot='';
  wrapper.dataset.adConfigured='true';
  wrapper.setAttribute('aria-label','Advertisement');

  const label=document.createElement('span');
  label.textContent='Advertisement';
  const mount=document.createElement('div');
  mount.className='ad-slot__mount';
  mount.dataset.adMount=slotName;
  wrapper.append(label,mount);
  return wrapper;
}

function renderArticleBody(container,blocks=[],article=null){
  container.replaceChildren();
  const helper=window.CTKMonetization;
  const placements=helper?.automaticArticlePlacements(article,blocks)||[];
  const autoByIndex=new Map(placements.map(item=>[item.afterIndex,item.slotName]));

  blocks.forEach((block,index)=>{
    if(block.type==='ad-break'){
      if(helper?.customArticleBreakAllowed(article,block)){
        const adNode=createArticleAdSlot(block.slot);
        if(adNode){
          container.appendChild(adNode);
          helper?.renderManualAdMount(adNode.querySelector('[data-ad-mount]'),block.slot);
        }
      }
      return;
    }

    let node;

    if(block.type==='heading'){
      node=document.createElement('h2');
      node.textContent=block.text||'';
    }else if(block.type==='list'&&Array.isArray(block.items)){
      node=document.createElement('ul');
      block.items.forEach(item=>{
        const li=document.createElement('li');
        li.textContent=item;
        node.appendChild(li);
      });
    }else if(block.type==='quote'){
      node=document.createElement('blockquote');
      node.textContent=block.text||'';
    }else if(block.type==='image'){
      node=document.createElement('figure');
      node.className='data-article-inline-image';

      const image=document.createElement('img');
      image.src=block.src;
      image.alt=block.alt||'';
      image.width=Number(block.width)||1200;
      image.height=Number(block.height)||800;
      image.loading='lazy';
      image.decoding='async';
      image.style.display='block';
      image.style.width='100%';
      image.style.height='auto';
      node.appendChild(image);

      if(block.caption){
        const caption=document.createElement('figcaption');
        caption.textContent=block.caption;
        node.appendChild(caption);
      }
    }else if(block.type==='definition-list'&&Array.isArray(block.items)){
      node=document.createElement('dl');
      node.className='article-definition-list';
      block.items.forEach(item=>{
        const row=document.createElement('div');
        const term=document.createElement('dt');
        const description=document.createElement('dd');
        term.textContent=item.term||'';
        description.textContent=item.description||'';
        row.append(term,description);
        node.appendChild(row);
      });
    }else{
      node=document.createElement('p');
      node.textContent=block.text||'';
    }

    container.appendChild(node);
    const autoSlot=autoByIndex.get(index);
    if(autoSlot){
      const adNode=createArticleAdSlot(autoSlot);
      if(adNode){
        container.appendChild(adNode);
        helper?.renderManualAdMount(adNode.querySelector('[data-ad-mount]'),autoSlot);
      }
    }
  });
}

function relatedMarkup(ids,products){
  const related=products.filter(product=>ids.includes(product.id)&&!product.draft&&!product.hidden);
  if(!related.length)return'<p>No related products are published yet.</p>';
  return related.map(product=>`<a class="related-product" href="product.html?slug=${encodeURIComponent(product.slug||product.id)}">
    <img src="${articleSafe(product.image)}" width="160" height="160" loading="lazy" alt="${articleSafe(product.imageAlt||product.name)}">
    <span>${articleSafe(product.name)}</span>
  </a>`).join('');
}
function sourceMarkup(sources=[]){
  if(!sources.length)return'<p>No external sources are listed for this draft guide.</p>';
  return `<ul>${sources.map(source=>{
    if(typeof source==='string')return `<li>${articleSafe(source)}</li>`;
    const label=articleSafe(source.label||source.url||'Source');
    return source.url?`<li><a href="${articleSafe(source.url)}" target="_blank" rel="noopener">${label}</a></li>`:`<li>${label}</li>`;
  }).join('')}</ul>`;
}
async function loadArticle(){
  const loading=document.querySelector('[data-article-loading]');
  const container=document.querySelector('[data-article]');
  const error=document.querySelector('[data-article-error]');
  try{
    let articles;
    let products;
    try{
      const [articleResponse,productResponse]=await Promise.all([
        fetch('data/articles.json',{cache:'no-store'}),
        fetch('data/products.json',{cache:'no-store'})
      ]);
      if(!articleResponse.ok||!productResponse.ok)throw new Error('Data request failed');
      [articles,products]=await Promise.all([articleResponse.json(),productResponse.json()]);
    }catch(fetchError){
      if(!window.__CTK_DATA__)throw fetchError;
      articles=window.__CTK_DATA__.articles;
      products=window.__CTK_DATA__.products;
    }
    const article=articles.find(item=>item.slug===articleSlug&&!item.draft);
    if(!article)throw new Error('Article not found');

    document.title=article.seoTitle||`${article.title} | Closer to Korea`;
    const description=article.metaDescription||article.excerpt;
    const meta=document.querySelector('meta[name="description"]');
    if(meta)meta.content=description;
    const setMeta=(selector,attribute,value)=>{
      let element=document.querySelector(selector);
      if(!element){
        element=document.createElement('meta');
        const match=selector.match(/meta\[(property|name)="([^"]+)"\]/);
        if(match)element.setAttribute(match[1],match[2]);
        document.head.appendChild(element);
      }
      element.setAttribute(attribute,value);
    };
    const canonicalUrl=`https://closertokorea.com/article.html?slug=${encodeURIComponent(article.slug)}`;
    setMeta('meta[property="og:title"]','content',article.seoTitle||article.title);
    setMeta('meta[property="og:description"]','content',description);
    setMeta('meta[property="og:image"]','content',new URL(article.heroImage,location.href).href);
    setMeta('meta[property="og:url"]','content',canonicalUrl);
    setMeta('meta[name="twitter:title"]','content',article.seoTitle||article.title);
    setMeta('meta[name="twitter:description"]','content',description);
    setMeta('meta[name="twitter:image"]','content',new URL(article.heroImage,location.href).href);
    let canonical=document.querySelector('link[rel="canonical"]');
    if(!canonical){
      canonical=document.createElement('link');
      canonical.rel='canonical';
      document.head.appendChild(canonical);
    }
    canonical.href=canonicalUrl;

    document.querySelector('[data-article-breadcrumb]').textContent=article.title;
    document.querySelector('[data-article-category]').textContent=article.categoryLabel||article.categoryKey.replace(/-/g,' ');
    document.querySelector('[data-article-title]').textContent=article.title;
    document.querySelector('[data-article-excerpt]').textContent=article.excerpt;
    document.querySelector('[data-article-published]').textContent=`Published ${articleDate(article.publishedAt)}`;
    document.querySelector('[data-article-updated]').textContent=`Updated ${articleDate(article.updatedAt)}`;

    const image=document.querySelector('[data-article-image]');
    image.src=article.heroImage;
    image.alt=article.heroImageAlt;
    image.width=Number(article.heroImageWidth)||1200;
    image.height=Number(article.heroImageHeight)||760;
    if(article.heroImageCaption){
      const caption=document.createElement('p');
      caption.className='data-article-hero-caption';
      caption.textContent=article.heroImageCaption;
      image.insertAdjacentElement('afterend',caption);
    }

    renderArticleBody(document.querySelector('[data-article-body]'),article.body,article);
    const bodyContainer=document.querySelector('[data-article-body]');
    const expectedInlineImages=(article.body||[]).filter(block=>block.type==='image');
    if(expectedInlineImages.length&&!bodyContainer.querySelector('.data-article-inline-image')){
      expectedInlineImages.forEach(block=>{
        const figure=document.createElement('figure');
        figure.className='data-article-inline-image';
        const img=document.createElement('img');
        img.src=block.src;
        img.alt=block.alt||'';
        img.width=Number(block.width)||1200;
        img.height=Number(block.height)||800;
        img.loading='lazy';
        img.decoding='async';
        figure.appendChild(img);
        if(block.caption){
          const caption=document.createElement('figcaption');
          caption.textContent=block.caption;
          figure.appendChild(caption);
        }
        bodyContainer.appendChild(figure);
      });
    }

    document.querySelector('[data-related-products]').innerHTML=relatedMarkup(article.relatedProductIds||[],products);
    document.querySelector('[data-article-sources]').innerHTML=sourceMarkup(article.sources);

    const schema={
      "@context":"https://schema.org",
      "@type":"Article",
      "headline":article.title,
      "description":description,
      "image":new URL(article.heroImage,location.href).href,
      "datePublished":article.publishedAt,
      "dateModified":article.updatedAt,
      "author":{"@type":"Person","name":"Closer to Korea curator"},
      "mainEntityOfPage":location.href
    };
    const schemaScript=document.createElement('script');
    schemaScript.type='application/ld+json';
    schemaScript.textContent=JSON.stringify(schema);
    document.head.appendChild(schemaScript);

    loading.hidden=true;
    error.hidden=true;
    container.hidden=false;
  }catch(loadError){
    loading.hidden=true;
    container.hidden=true;
    error.hidden=false;
  }
}
loadArticle();