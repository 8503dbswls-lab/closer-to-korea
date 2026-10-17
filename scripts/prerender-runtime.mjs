// Small, strict DOM adapter for build-time reuse of the actual browser renderers.
// No duplicated selection, card, body-block, date, or source formatting rules.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));

export class RenderElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attributes = {};
    this.style = {};
    this.dataset = {};
    this._text = '';
  }
  set textContent(value) { this._text = String(value ?? ''); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  setAttribute(name,value) { this.attributes[name] = String(value); }
  querySelector(selector) {
    if (selector === '.data-article-inline-image') return this.children.find(child => child.className === 'data-article-inline-image') || null;
    throw new Error(`Unsupported prerender selector: ${selector}`);
  }
  get innerHTML() { return escapeHtml(this._text) + this.children.map(child => child.outerHTML).join(''); }
  get outerHTML() {
    const attributes = {...this.attributes};
    for (const [property,attribute] of Object.entries({className:'class',src:'src',alt:'alt',width:'width',height:'height',loading:'loading',decoding:'decoding'})) {
      if (this[property] !== undefined) attributes[attribute] = this[property];
    }
    if (Object.keys(this.style).length) attributes.style = Object.entries(this.style).map(([key,value]) => `${key.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`)}: ${value};`).join(' ');
    const opening = `<${this.tag}${Object.entries(attributes).map(([key,value]) => ` ${key}="${escapeHtml(value)}"`).join('')}>`;
    return this.tag === 'img' ? opening : `${opening}${this.innerHTML}</${this.tag}>`;
  }
}

export async function renderHome(root, articles, products) {
  const nodes = new Map(['data-home-latest','data-home-article-grid'].map(key => [key,{innerHTML:'',section:{hidden:false}}]));
  for (const node of nodes.values()) node.closest = () => ({toggleAttribute:(_name,value)=>{ node.section.hidden=value; }});
  const source = fs.readFileSync(path.join(root,'js/home-refresh.js'),'utf8');
  const bootstrap = /^  render\(\);$/m;
  if (!bootstrap.test(source)) throw new Error('Home renderer bootstrap changed; review the prerender adapter.');
  const context = vm.createContext({
    document:{querySelector:selector=>nodes.get(selector.slice(1,-1)) || null},
    window:{}, console:{error:(...args)=>{throw new Error(args.join(' '));}},
    fetch:async filename => {
      const data = {'data/articles.json':articles,'data/products.json':products}[filename];
      if (!data) throw new Error(`Unexpected prerender fetch: ${filename}`);
      return {ok:true,json:async()=>structuredClone(data)};
    }
  });
  vm.runInContext(source.replace(bootstrap,'  globalThis.ready=render();'),context,{filename:'js/home-refresh.js',timeout:1000});
  await context.ready;
  return {latest:nodes.get('data-home-latest').innerHTML,articles:nodes.get('data-home-article-grid').innerHTML,articlesHidden:nodes.get('data-home-article-grid').section.hidden};
}

export function articleRenderers(root) {
  const source = fs.readFileSync(path.join(root,'js/article.js'),'utf8');
  const bootstrap = /\nloadArticle\(\);\s*$/;
  if (!bootstrap.test(source)) throw new Error('Article renderer bootstrap changed; review the prerender adapter.');
  const context = vm.createContext({
    URLSearchParams,location:{search:''},window:{},
    document:{documentElement:{dataset:{}},createElement:tag=>new RenderElement(tag)}
  });
  vm.runInContext(source.replace(bootstrap,''),context,{filename:'js/article.js',timeout:1000});
  return context;
}

export function renderArticle(root, article, products) {
  const renderer = articleRenderers(root);
  const body = new RenderElement('div');
  renderer.renderArticleBody(body,article.body,article);
  return {
    title:renderer.articleSafe(article.title),
    category:renderer.articleSafe(article.categoryLabel || article.categoryKey.replace(/-/g,' ')),
    excerpt:renderer.articleSafe(article.excerpt),
    published:`Published ${renderer.articleDate(article.publishedAt)}`,
    updated:`Updated ${renderer.articleDate(article.updatedAt)}`,
    hero:renderer.articleHero(article),
    body:body.innerHTML,
    sources:renderer.sourceMarkup(article.sources),
    related:renderer.relatedMarkup(article.relatedProductIds || [],products)
  };
}
