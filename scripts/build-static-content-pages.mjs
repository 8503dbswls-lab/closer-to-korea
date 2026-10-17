// Run after the public export: node scripts/build-static-content-pages.mjs
// --check fails if generated content is stale, without writing any files.
// Deliberately scoped: homepage featured/article lists and the coin-tissue route.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {escapeHtml,renderHome,renderArticle} from './prerender-runtime.mjs';

function elementBounds(html,attribute) {
  const opening = new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\b${attribute}(?=[\\s=>])[^>]*>`,'i').exec(html);
  if (!opening) throw new Error(`Missing managed element: ${attribute}`);
  const start = opening.index;
  const innerStart = start + opening[0].length;
  if (opening[1].toLowerCase() === 'img') return {start,innerStart,end:innerStart,tag:opening[0]};
  const tags = new RegExp(`<\\/?${opening[1]}\\b[^>]*>`,'gi');
  tags.lastIndex = innerStart;
  let depth = 1;
  let match;
  while ((match = tags.exec(html))) {
    depth += match[0].startsWith('</') ? -1 : 1;
    if (!depth) return {start,innerStart,innerEnd:match.index,end:tags.lastIndex,tag:opening[0]};
  }
  throw new Error(`Unclosed managed element: ${attribute}`);
}
export function innerContent(html,attribute) {
  const bounds = elementBounds(html,attribute);
  return html.slice(bounds.innerStart,bounds.innerEnd);
}
function replaceInner(html,attribute,content) {
  const bounds = elementBounds(html,attribute);
  return html.slice(0,bounds.innerStart) + content + html.slice(bounds.innerEnd);
}
function updateOpening(html,attribute,update) {
  const bounds = elementBounds(html,attribute);
  return html.slice(0,bounds.start) + update(bounds.tag) + html.slice(bounds.innerStart);
}
function setAttribute(tag,name,value) {
  const pattern = new RegExp(`\\s${name}(?:=(?:"[^"]*"|'[^']*'|[^\\s>]+))?(?=[\\s/>])`,'g');
  return tag.replace(pattern,'').replace(/>$/,value === null ? '>' : ` ${name}="${escapeHtml(value)}">`);
}
function toggleSection(html,className,hidden) {
  const pattern = new RegExp(`<section\\b[^>]*class="[^"]*\\b${className}\\b[^\"]*"[^>]*>`);
  if (!pattern.test(html)) throw new Error(`Missing section: ${className}`);
  return html.replace(pattern,tag=>setAttribute(tag,'hidden',hidden ? '' : null));
}

export async function buildStaticContentPages(root,{check=false}={}) {
  const read = file=>fs.readFileSync(path.join(root,file),'utf8');
  const articles = JSON.parse(read('data/articles.json'));
  const products = JSON.parse(read('data/products.json'));
  const article = articles.find(item=>item.slug==='korean-coin-tissue' && item.draft===false && item.hidden!==true);
  if (!article) throw new Error('Coin-tissue article is not published; review removal of its existing static route before building.');
  const home = await renderHome(root,articles,products);
  const detail = renderArticle(root,article,products);
  const originals = new Map(['index.html','korean-coin-tissue.html'].map(file=>[file,read(file)]));

  let index = originals.get('index.html');
  for (const [attribute,content] of [['data-home-latest',home.latest],['data-home-article-grid',home.articles]]) {
    index = replaceInner(index,attribute,`<!-- STATIC-LIST START -->${content}<!-- STATIC-LIST END -->`);
  }
  index = toggleSection(index,'home-articles',home.articlesHidden);

  let page = originals.get('korean-coin-tissue.html');
  for (const [attribute,content] of Object.entries({
    'data-article-breadcrumb':detail.title,'data-article-title':detail.title,
    'data-article-category':detail.category,'data-article-excerpt':detail.excerpt,
    'data-article-published':escapeHtml(detail.published),'data-article-updated':escapeHtml(detail.updated),
    'data-article-body':detail.body,'data-article-sources':detail.sources,'data-related-products':detail.related
  })) page = replaceInner(page,attribute,content);
  page = updateOpening(page,'data-article',tag=>setAttribute(setAttribute(tag,'hidden',null),'data-prerendered','true'));
  page = updateOpening(page,'data-article-loading',tag=>setAttribute(tag,'hidden',''));
  page = updateOpening(page,'data-article-image',tag=>{
    for (const [key,value] of Object.entries({src:detail.hero.src,alt:detail.hero.alt,width:detail.hero.width,height:detail.hero.height})) tag = setAttribute(tag,key,value);
    return tag;
  });
  // Remove our prior caption before replacing it, so repeated builds stay stable.
  page = page.replace(/\n?\s*<p class="data-article-hero-caption"[^>]*>[\s\S]*?<\/p>/g,'');
  if (article.heroImageCaption) {
    const image = elementBounds(page,'data-article-image');
    page = page.slice(0,image.end) + `\n    <p class="data-article-hero-caption">${escapeHtml(article.heroImageCaption)}</p>` + page.slice(image.end);
  }
  page = page.replace(/(<section\b[^>]*>)(\s*<h2>Related product<\/h2>)/,(_match,tag,heading)=>setAttribute(tag,'hidden',detail.related ? null : '') + heading);

  const outputs = new Map([['index.html',index],['korean-coin-tissue.html',page]]);
  const changed = [...outputs].filter(([file,html])=>html!==originals.get(file));
  if (check && changed.length) throw new Error(`Static content is stale: ${changed.map(([file])=>file).join(', ')}. Run node scripts/build-static-content-pages.mjs.`);
  if (!check) for (const [file,html] of changed) fs.writeFileSync(path.join(root,file),html);
  return changed.map(([file])=>file);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const changed = await buildStaticContentPages(process.cwd(),{check:process.argv.includes('--check')});
    console.log(`Static homepage/article content is current${changed.length ? `: updated ${changed.join(', ')}` : ' (no changes)'}.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
