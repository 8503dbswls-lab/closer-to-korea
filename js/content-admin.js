(() => {
  "use strict";

  // Public data is reference material, never a complete editorial source.
  const publicReference = window.__CTK_DATA__ || {};
  const storageKey = "ctk-content-manager-private-v2";
  let source = null;
  let sourceDigest = null;
  let sourceLabel = "No private master loaded. Import a complete private master, or open the local admin server.";
  const state = {
    products: [], articles: [],
    categories: structuredClone(publicReference.categories || {}),
    siteCopy: structuredClone(publicReference.siteCopy || {}),
    monetization: structuredClone(publicReference.monetization || {}),
    selectedProductId: null, selectedArticleId: null, articleBlocks: []
  };

  let productDirty=false;
  let articleDirty=false;

  const $ = (selector, root=document) => root.querySelector(selector);
  const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
  const today = () => new Date().toISOString().slice(0,10);
  const clone = value => structuredClone(value);

  function slugify(value=""){
    return value.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g,"")
      .replace(/\s+/g,"-")
      .replace(/-+/g,"-");
  }

  function splitComma(value=""){
    return value.split(",").map(item=>item.trim()).filter(Boolean);
  }

  function splitLines(value=""){
    return value.split(/\r?\n/).map(item=>item.trim()).filter(Boolean);
  }

  function parseSources(value=""){
    return splitLines(value).map(line=>{
      const [label,url] = line.split("|").map(part=>part.trim());
      return url ? {label:label || url,url} : {label};
    });
  }

  function serializeSources(sources=[]){
    return sources.map(source=>{
      if(typeof source === "string") return source;
      return source.url ? `${source.label || source.url} | ${source.url}` : (source.label || "");
    }).filter(Boolean).join("\n");
  }

  function setStatus(selector,message,error=false){
    const el=$(selector);
    if(!el)return;
    el.textContent=message;
    el.classList.toggle("error",error);
    window.setTimeout(()=>{
      if(el.textContent===message)el.textContent="";
    },3500);
  }

  function showTab(name){
    $$("[data-tab-button]").forEach(button=>{
      const active=button.dataset.tabButton===name;
      button.classList.toggle("active",active);
      button.setAttribute("aria-selected",String(active));
    });
    $$("[data-tab-panel]").forEach(panel=>{
      panel.classList.toggle("active",panel.dataset.tabPanel===name);
    });
  }

  $$("[data-tab-button]").forEach(button=>button.addEventListener("click",()=>showTab(button.dataset.tabButton)));

  function populateSelect(select, items, includeBlank=false){
    if(!select)return;
    const current=select.value;
    select.replaceChildren();
    if(includeBlank){
      const blank=document.createElement("option");
      blank.value="";
      blank.textContent="Unclassified";
      select.appendChild(blank);
    }
    items.forEach(item=>{
      const option=document.createElement("option");
      option.value=item.key;
      option.textContent=item.label;
      select.appendChild(option);
    });
    if([...select.options].some(option=>option.value===current))select.value=current;
  }

  function populateReferenceOptions(){
    const categoryItems=(state.categories.categories||[]).filter(item=>item.active!==false).sort((a,b)=>(a.order||0)-(b.order||0));
    $$('select[name="categoryKey"]').forEach(select=>populateSelect(select,categoryItems));
    populateSelect($('[name="productMatchType"]'),state.categories.matchTypes||[]);
    populateSelect($('[name="trendStatus"]'),(state.categories.trendStatuses||[]).filter(item=>item.key!==""),true);
    populateSelect($('[name="sectionKey"]'),(state.categories.editorialSections||[]).filter(item=>item.active!==false).sort((a,b)=>(a.order||0)-(b.order||0)));
    populateSelect($('[name="contentType"]'),state.categories.contentTypes||[]);
    populateSelect($('[name="koreaContextConfidence"]'),state.categories.contextConfidence||[]);
    populateSelect($('[name="monetizationProfile"]'),state.categories.monetizationProfiles||[]);

    const verificationContainer=$("[data-verification-options]");
    verificationContainer.replaceChildren();
    (state.categories.verificationOptions||[]).forEach(item=>{
      const label=document.createElement("label");
      label.className="check";
      label.innerHTML=`<input type="checkbox" name="verificationStatus" value="${item.key}"><span>${item.label}</span>`;
      verificationContainer.appendChild(label);
    });
  }

  function productById(id){
    return state.products.find(product=>product.id===id);
  }

  function articleById(id){
    return state.articles.find(article=>article.id===id);
  }

  function productListMarkup(product){
    const button=document.createElement("button");
    button.type="button";
    button.className="item-button";
    button.dataset.productId=product.id;
    button.innerHTML=`<strong>${escapeHtml(product.name || product.id)}</strong>
      <small>${escapeHtml(product.id)}</small>
      <span class="item-state ${product.draft ? "" : "public"}">${product.draft ? "Draft" : "Public"}</span>`;
    if(product.id===state.selectedProductId)button.classList.add("active");
    button.addEventListener("click",()=>selectProduct(product.id));
    return button;
  }

  function articleListMarkup(article){
    const button=document.createElement("button");
    button.type="button";
    button.className="item-button";
    button.dataset.articleId=article.id;
    button.innerHTML=`<strong>${escapeHtml(article.title || article.id)}</strong>
      <small>${escapeHtml(article.slug || article.id)}</small>
      <span class="item-state ${article.draft ? "" : "public"}">${article.draft ? "Draft" : "Public"}</span>`;
    if(article.id===state.selectedArticleId)button.classList.add("active");
    button.addEventListener("click",()=>selectArticle(article.id));
    return button;
  }

  function escapeHtml(value=""){
    return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
  }

  function renderProductList(){
    const query=($("[data-product-search]")?.value || "").trim().toLowerCase();
    const container=$("[data-product-list]");
    container.replaceChildren();
    state.products
      .filter(product=>!query || `${product.name} ${product.id}`.toLowerCase().includes(query))
      .sort((a,b)=>Number(a.draft)-Number(b.draft) || (a.name||"").localeCompare(b.name||""))
      .forEach(product=>container.appendChild(productListMarkup(product)));
  }

  function renderArticleList(){
    const query=($("[data-article-search]")?.value || "").trim().toLowerCase();
    const container=$("[data-article-list]");
    container.replaceChildren();
    state.articles
      .filter(article=>!query || `${article.title} ${article.slug}`.toLowerCase().includes(query))
      .sort((a,b)=>Number(a.draft)-Number(b.draft) || (a.title||"").localeCompare(b.title||""))
      .forEach(article=>container.appendChild(articleListMarkup(article)));
  }

  function productDefaults(){
    return {
      id:"",
      slug:"",
      name:"",
      summary:"",
      categoryKey:(state.categories.categories||[])[0]?.key || "",
      category:"",
      tags:[],
      image:"",
      imageAlt:"",
      publicImageStatus:"placeholder",
      seenInKorea:"",
      usedBy:"",
      whyItMatters:"",
      koreanProductStatus:"",
      personalUseNotes:"",
      safetyNotes:"",
      productMatchType:(state.categories.matchTypes||[])[0]?.key || "likely",
      productMatchLabel:"",
      trendStatus:"",
      trendLabel:"Unclassified",
      brand:"",
      modelNumber:"",
      modelEvidence:"",
      sourceUrls:[],
      usDifference:"",
      verificationStatus:[],
      verificationLabels:[],
      personallyUsed:false,
      amazonUrl:"",
      affiliateUrl:"",
      amazonAvailability:"under-review",
      amazonLabel:"Amazon match under review",
      linkLastCheckedAt:"",
      activePurchaseCta:false,
      cta:"View Product Details",
      publishedAt:today(),
      lastCheckedAt:today(),
      featured:false,
      newlyAdded:false,
      soldOut:false,
      draft:true,
      hidden:false
    };
  }

  function articleDefaults(){
    return {
      id:"",
      slug:"",
      title:"",
      seoTitle:"",
      excerpt:"",
      metaDescription:"",
      primaryKeyword:"",
      body:[],
      categoryKey:(state.categories.categories||[])[0]?.key || "",
      categoryLabel:"",
      sectionKey:(state.categories.editorialSections||[]).find(item=>item.active!==false)?.key || "korean-kitchen",
      contentType:"korea-discovery",
      koreaContextConfidence:"context-dependent",
      monetizationProfile:"default",
      tags:[],
      heroImage:"",
      heroImageAlt:"",
      heroImageCaption:"",
      heroImageWidth:1200,
      heroImageHeight:760,
      relatedProductIds:[],
      sources:[],
      sourceRequirement:"optional",
      publishedAt:today(),
      updatedAt:today(),
      featured:false,
      draft:true
    };
  }

  function fillProductForm(product){
    const form=$("[data-product-form]");
    form.elements.id.readOnly=Boolean(state.selectedProductId);
    form.elements.id.dataset.edited="true";
    form.elements.slug.dataset.edited="true";
    const simpleFields=[
      "id","slug","name","summary","categoryKey","image","imageAlt","publicImageStatus",
      "seenInKorea","usedBy","whyItMatters","koreanProductStatus","personalUseNotes",
      "safetyNotes","productMatchType","trendStatus","brand","modelNumber","modelEvidence",
      "usDifference","amazonUrl","affiliateUrl","amazonAvailability","amazonLabel",
      "linkLastCheckedAt","cta","publishedAt","lastCheckedAt","trendLabel"
    ];
    simpleFields.forEach(name=>{
      const field=form.elements[name];
      if(field)field.value=product[name] ?? "";
    });
    form.elements.tags.value=(product.tags||[]).join(", ");
    form.elements.sourceUrls.value=(product.sourceUrls||[]).join("\n");
    ["personallyUsed","activePurchaseCta","featured","newlyAdded","soldOut","draft","hidden"].forEach(name=>{
      form.elements[name].checked=Boolean(product[name]);
    });
    $$('input[name="verificationStatus"]',form).forEach(input=>{
      input.checked=(product.verificationStatus||[]).includes(input.value);
    });
    $("[data-product-editor-title]").textContent=product.name || "New product";
  }

  function collectProductForm(){
    const form=$("[data-product-form]");
    const data={...productDefaults(),...clone(productById(state.selectedProductId)||{})};
    const textFields=[
      "id","slug","name","summary","categoryKey","image","imageAlt","publicImageStatus",
      "seenInKorea","usedBy","whyItMatters","koreanProductStatus","personalUseNotes",
      "safetyNotes","productMatchType","trendStatus","brand","modelNumber","modelEvidence",
      "usDifference","amazonUrl","affiliateUrl","amazonAvailability","amazonLabel",
      "linkLastCheckedAt","cta","publishedAt","lastCheckedAt","trendLabel"
    ];
    textFields.forEach(name=>data[name]=form.elements[name]?.value.trim() || "");
    data.tags=splitComma(form.elements.tags.value);
    data.sourceUrls=splitLines(form.elements.sourceUrls.value);
    data.verificationStatus=$$('input[name="verificationStatus"]:checked',form).map(input=>input.value);
    data.verificationLabels=data.verificationStatus.map(key=>(state.categories.verificationOptions||[]).find(item=>item.key===key)?.label).filter(Boolean);
    data.personallyUsed=form.elements.personallyUsed.checked;
    data.activePurchaseCta=form.elements.activePurchaseCta.checked;
    data.featured=form.elements.featured.checked;
    data.newlyAdded=form.elements.newlyAdded.checked;
    data.soldOut=form.elements.soldOut.checked;
    data.draft=form.elements.draft.checked;
    data.hidden=form.elements.hidden.checked;

    const category=(state.categories.categories||[]).find(item=>item.key===data.categoryKey);
    data.category=category?.label || data.categoryKey;
    const match=(state.categories.matchTypes||[]).find(item=>item.key===data.productMatchType);
    data.productMatchLabel=match?.label || data.productMatchType;
    const trend=(state.categories.trendStatuses||[]).find(item=>item.key===data.trendStatus);
    data.trendLabel=trend?.label || data.trendLabel || "Unclassified";

    return data;
  }

  function selectProduct(id){
    state.selectedProductId=id;
    if(!productById(id))return newProduct();
    fillProductForm(productById(id));
    productDirty=false;
    renderProductList();
  }

  function newProduct(){
    state.selectedProductId=null;
    fillProductForm(productDefaults());
    delete $("[data-product-form]").elements.id.dataset.edited;
    delete $("[data-product-form]").elements.slug.dataset.edited;
    productDirty=false;
    renderProductList();
  }

  function saveProduct(event){
    event.preventDefault();
    if(!source)return;
    const data=collectProductForm();
    if(!data.id || !data.slug || !data.name){
      setStatus("[data-product-status]","ID, slug, and product name are required.",true);
      return;
    }
    const duplicateId=state.products.find(product=>product.id===data.id && product.id!==state.selectedProductId);
    if(duplicateId){
      setStatus("[data-product-status]",`A product with ID “${data.id}” already exists.`,true);
      return;
    }
    const duplicateSlug=state.products.find(product=>product.slug===data.slug && product.id!==state.selectedProductId);
    if(duplicateSlug){
      setStatus("[data-product-status]",`A product with slug “${data.slug}” already exists.`,true);
      return;
    }
    const index=state.products.findIndex(product=>product.id===state.selectedProductId);
    if(index>=0)state.products[index]=data;
    else state.products.push(data);
    state.selectedProductId=data.id;
    renderProductList();
    fillProductForm(data);
    productDirty=false;
    saveBrowser(false);
    setStatus("[data-product-status]","Product saved to the working copy.");
  }

  function duplicateProduct(){
    const original=productById(state.selectedProductId);
    if(!original)return;
    const duplicate=clone(original);
    duplicate.id=`${original.id}-copy`;
    duplicate.slug=`${original.slug || original.id}-copy`;
    duplicate.name=`${original.name} Copy`;
    duplicate.draft=true;
    duplicate.featured=false;
    duplicate.newlyAdded=false;
    duplicate.activePurchaseCta=false;
    state.products.push(duplicate);
    selectProduct(duplicate.id);
    saveBrowser(false);
  }

  function deleteProduct(){
    const product=productById(state.selectedProductId);
    if(!product)return;
    if(!window.confirm(`Archive “${product.name}”? It will stay in the private master and be excluded from public exports.`))return;
    Object.assign(product,{draft:true,hidden:true,featured:false});
    newProduct();
    renderProductList();
    saveBrowser(false);
  }

  function fillArticleForm(article){
    const form=$("[data-article-form]");
    form.elements.id.readOnly=Boolean(state.selectedArticleId);
    form.elements.id.dataset.edited="true";
    form.elements.slug.dataset.edited="true";
    [
      "id","slug","title","seoTitle","excerpt","metaDescription","primaryKeyword",
      "categoryKey","sectionKey","contentType","koreaContextConfidence","monetizationProfile",
      "heroImage","heroImageAlt","heroImageCaption","heroImageWidth",
      "heroImageHeight","sourceRequirement","publishedAt","updatedAt"
    ].forEach(name=>{
      const field=form.elements[name];
      if(field)field.value=article[name] ?? "";
    });
    form.elements.tags.value=(article.tags||[]).join(", ");
    form.elements.relatedProductIds.value=(article.relatedProductIds||[]).join(", ");
    form.elements.sources.value=serializeSources(article.sources||[]);
    form.elements.featured.checked=Boolean(article.featured);
    form.elements.draft.checked=Boolean(article.draft);
    form.elements.hidden.checked=Boolean(article.hidden);
    state.articleBlocks=clone(article.body||[]);
    renderBodyBlocks();
    $("[data-article-editor-title]").textContent=article.title || "New article";
  }

  function collectArticleForm(){
    const form=$("[data-article-form]");
    const data={...articleDefaults(),...clone(articleById(state.selectedArticleId)||{})};
    [
      "id","slug","title","seoTitle","excerpt","metaDescription","primaryKeyword",
      "categoryKey","sectionKey","contentType","koreaContextConfidence","monetizationProfile",
      "heroImage","heroImageAlt","heroImageCaption","sourceRequirement",
      "publishedAt","updatedAt"
    ].forEach(name=>data[name]=form.elements[name]?.value.trim() || "");
    data.heroImageWidth=Number(form.elements.heroImageWidth.value)||1200;
    data.heroImageHeight=Number(form.elements.heroImageHeight.value)||760;
    data.tags=splitComma(form.elements.tags.value);
    data.relatedProductIds=splitComma(form.elements.relatedProductIds.value);
    data.sources=parseSources(form.elements.sources.value).map(item=>{
      const prior=(articleById(state.selectedArticleId)?.sources||[]).find(old=>
        old && typeof old==="object" && (item.url ? old.url===item.url : old.label===item.label));
      return {...clone(prior||{}),...item};
    });
    data.featured=form.elements.featured.checked;
    data.draft=form.elements.draft.checked;
    data.hidden=form.elements.hidden.checked;
    data.body=clone(state.articleBlocks);
    const category=(state.categories.categories||[]).find(item=>item.key===data.categoryKey);
    data.categoryLabel=category?.label || data.categoryKey;
    return data;
  }

  function selectArticle(id){
    state.selectedArticleId=id;
    if(!articleById(id))return newArticle();
    fillArticleForm(articleById(id));
    articleDirty=false;
    renderArticleList();
  }

  function newArticle(){
    state.selectedArticleId=null;
    fillArticleForm(articleDefaults());
    delete $("[data-article-form]").elements.id.dataset.edited;
    delete $("[data-article-form]").elements.slug.dataset.edited;
    articleDirty=false;
    renderArticleList();
  }

  function saveArticle(event){
    event.preventDefault();
    if(!source)return;
    syncBlocksFromDom();
    const data=collectArticleForm();
    if(!data.id || !data.slug || !data.title){
      setStatus("[data-article-status]","ID, slug, and title are required.",true);
      return;
    }
    const duplicateId=state.articles.find(article=>article.id===data.id && article.id!==state.selectedArticleId);
    if(duplicateId){
      setStatus("[data-article-status]",`An article with ID “${data.id}” already exists.`,true);
      return;
    }
    const duplicateSlug=state.articles.find(article=>article.slug===data.slug && article.id!==state.selectedArticleId);
    if(duplicateSlug){
      setStatus("[data-article-status]",`An article with slug “${data.slug}” already exists.`,true);
      return;
    }
    const index=state.articles.findIndex(article=>article.id===state.selectedArticleId);
    if(index>=0)state.articles[index]=data;
    else state.articles.push(data);
    state.selectedArticleId=data.id;
    renderArticleList();
    fillArticleForm(data);
    articleDirty=false;
    saveBrowser(false);
    setStatus("[data-article-status]","Article saved to the working copy.");
  }

  function duplicateArticle(){
    const original=articleById(state.selectedArticleId);
    if(!original)return;
    const duplicate=clone(original);
    duplicate.id=`${original.id}-copy`;
    duplicate.slug=`${original.slug}-copy`;
    duplicate.title=`${original.title} Copy`;
    duplicate.draft=true;
    duplicate.featured=false;
    state.articles.push(duplicate);
    selectArticle(duplicate.id);
    saveBrowser(false);
  }

  function deleteArticle(){
    const article=articleById(state.selectedArticleId);
    if(!article)return;
    if(!window.confirm(`Archive “${article.title}”? It will stay in the private master and be excluded from public exports.`))return;
    Object.assign(article,{draft:true,hidden:true,featured:false});
    newArticle();
    renderArticleList();
    saveBrowser(false);
  }

  function blockFields(block,index){
    const wrapper=document.createElement("div");
    wrapper.dataset.blockIndex=String(index);

    if(block.type==="image"){
      wrapper.innerHTML=`
        <label><span>Image path</span><input data-block-key="src" value="${escapeAttr(block.src||"")}"></label>
        <label><span>Alt text</span><textarea data-block-key="alt">${escapeHtml(block.alt||"")}</textarea></label>
        <label><span>Caption</span><input data-block-key="caption" value="${escapeAttr(block.caption||"")}"></label>
        <div class="grid two">
          <label><span>Width</span><input data-block-key="width" type="number" value="${Number(block.width)||1200}"></label>
          <label><span>Height</span><input data-block-key="height" type="number" value="${Number(block.height)||800}"></label>
        </div>`;
    }else if(block.type==="list"){
      wrapper.innerHTML=`<label><span>One item per line</span><textarea data-block-key="items" rows="5">${escapeHtml((block.items||[]).join("\n"))}</textarea></label>`;
    }else if(block.type==="definition-list"){
      wrapper.innerHTML=`<label><span>One row per line: Term | Description</span><textarea data-block-key="items" rows="6">${escapeHtml((block.items||[]).map(item=>`${item.term} | ${item.description}`).join("\n"))}</textarea></label>`;
    }else if(block.type==="ad-break"){
      const articleSlots=Object.keys(state.monetization?.adsense?.slots||{}).filter(key=>key.startsWith("article-"));
      const options=articleSlots.map(slot=>`<option value="${escapeAttr(slot)}"${slot===block.slot?" selected":""}>${escapeHtml(slot)}</option>`).join("");
      wrapper.innerHTML=`<label><span>Manual ad slot</span><select data-block-key="slot">${options}</select></label>
        <p class="help">Only renders when this article uses the Custom monetization profile and AdSense manual slots are enabled.</p>`;
    }else if(["paragraph","heading","quote"].includes(block.type)){
      wrapper.innerHTML=`<label><span>${block.type==="heading"?"Heading":block.type==="quote"?"Quote":"Paragraph"}</span><textarea data-block-key="text" rows="${block.type==="paragraph"?5:3}">${escapeHtml(block.text||"")}</textarea></label>`;
    }
    if(!wrapper.childElementCount){
      const note=document.createElement("p");
      note.textContent=`${block.type} block is preserved unchanged. Edit this block in the private master.`;
      wrapper.appendChild(note);
    }
    return wrapper;
  }

  function escapeAttr(value=""){
    return String(value).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  function renderBodyBlocks(){
    const container=$("[data-body-blocks]");
    const template=$("#body-block-template");
    container.replaceChildren();
    state.articleBlocks.forEach((block,index)=>{
      const node=template.content.firstElementChild.cloneNode(true);
      node.dataset.blockIndex=String(index);
      $("[data-block-title]",node).textContent=`${index+1}. ${block.type}`;
      $("[data-block-fields]",node).appendChild(blockFields(block,index));
      $("[data-block-up]",node).addEventListener("click",()=>{
        syncBlocksFromDom();
        if(index>0){
          [state.articleBlocks[index-1],state.articleBlocks[index]]=[state.articleBlocks[index],state.articleBlocks[index-1]];
          articleDirty=true;
          renderBodyBlocks();
        }
      });
      $("[data-block-down]",node).addEventListener("click",()=>{
        syncBlocksFromDom();
        if(index<state.articleBlocks.length-1){
          [state.articleBlocks[index+1],state.articleBlocks[index]]=[state.articleBlocks[index],state.articleBlocks[index+1]];
          articleDirty=true;
          renderBodyBlocks();
        }
      });
      $("[data-block-delete]",node).addEventListener("click",()=>{
        syncBlocksFromDom();
        state.articleBlocks.splice(index,1);
        articleDirty=true;
        renderBodyBlocks();
      });
      container.appendChild(node);
    });
  }

  function syncBlocksFromDom(){
    $$("[data-body-blocks] .body-block").forEach((node,index)=>{
      const block=state.articleBlocks[index];
      if(!block)return;
      const fieldRoot=$("[data-block-fields]",node);
      if(block.type==="image"){
        block.src=$('[data-block-key="src"]',fieldRoot)?.value.trim()||"";
        block.alt=$('[data-block-key="alt"]',fieldRoot)?.value.trim()||"";
        block.caption=$('[data-block-key="caption"]',fieldRoot)?.value.trim()||"";
        block.width=Number($('[data-block-key="width"]',fieldRoot)?.value)||1200;
        block.height=Number($('[data-block-key="height"]',fieldRoot)?.value)||800;
      }else if(block.type==="list"){
        block.items=splitLines($('[data-block-key="items"]',fieldRoot)?.value||"");
      }else if(block.type==="definition-list"){
        block.items=splitLines($('[data-block-key="items"]',fieldRoot)?.value||"").map(line=>{
          const [term,...rest]=line.split("|");
          const previous=(block.items||[]).find(item=>item.term===(term||"").trim());
          return {...clone(previous||{}),term:(term||"").trim(),description:rest.join("|").trim()};
        }).filter(item=>item.term||item.description);
      }else if(block.type==="ad-break"){
        block.slot=$('[data-block-key="slot"]',fieldRoot)?.value||"article-mid";
      }else if(["paragraph","heading","quote"].includes(block.type)){
        block.text=$('[data-block-key="text"]',fieldRoot)?.value.trim()||"";
      }
    });
  }

  function addBlock(type){
    syncBlocksFromDom();
    const defaults={
      paragraph:{type:"paragraph",text:""},
      heading:{type:"heading",text:""},
      list:{type:"list",items:[]},
      quote:{type:"quote",text:""},
      image:{type:"image",src:"",alt:"",caption:"",width:1200,height:800},
      "definition-list":{type:"definition-list",items:[]},
      "ad-break":{type:"ad-break",slot:"article-mid"}
    };
    state.articleBlocks.push(defaults[type]);
    articleDirty=true;
    renderBodyBlocks();
    const blocks=$$("[data-body-blocks] .body-block");
    blocks.at(-1)?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function assertMaster(data){
    if(!data || data.schemaVersion!=="ctk-editorial-master-v1" ||
      !Array.isArray(data.products) || !Array.isArray(data.articles) ||
      !data.categories || !data.siteCopy || !data.monetization){
      throw new Error("Use a complete ctk-editorial-master-v1 private master, not public JSON, a public bundle, or an old browser cache.");
    }
    for(const name of ["products","articles"]){
      const ids=new Set();
      for(const item of data[name]){
        if(!item || typeof item.id!=="string" || !item.id || ids.has(item.id))throw new Error(`Invalid or duplicate ${name} ID in master.`);
        ids.add(item.id);
      }
      if(source && source[name].some(item=>!ids.has(item.id)))throw new Error(`Import would lose existing ${name}. Restore or merge the missing records first.`);
    }
  }

  function renderSourceStatus(){
    const status=$("[data-editorial-source-status]");
    if(status)status.textContent=sourceLabel;
    $$("[data-product-form] input, [data-product-form] select, [data-product-form] textarea, [data-product-form] button, [data-article-form] input, [data-article-form] select, [data-article-form] textarea, [data-article-form] button, [data-new-product], [data-new-article], [data-save-browser], [data-download-products], [data-download-articles], [data-download-bundle], [data-download-aliases], [data-download-backup]")
      .forEach(control=>{control.disabled=!source;});
  }

  function applyMaster(data,{digest=null,label="Imported private master. Save it outside the public project."}={}){
    assertMaster(data);
    source=clone(data);
    sourceDigest=digest;
    for(const key of ["products","articles","categories","siteCopy","monetization"])state[key]=clone(data[key]);
    sourceLabel=label;
    populateReferenceOptions();
    renderMonetizationStatus();
    renderProductList(); renderArticleList();
    selectProduct(state.products[0]?.id); selectArticle(state.articles[0]?.id);
    renderSourceStatus();
  }

  function saveBrowser(showMessage=true){
    if(!source)return;
    try{
      if(showMessage)flushEditors();
      localStorage.setItem(storageKey,JSON.stringify({schemaVersion:"ctk-browser-working-copy-v2",baseDigest:sourceDigest,data:currentBundle()}));
      if(showMessage)window.alert("Private working copy saved in this browser only. This is not a durable backup. Save the private master outside the website project.");
    }catch(error){
      if(showMessage)window.alert(`Browser save failed: ${error.message}. Export the private master now.`);
    }
  }

  function restoreBrowser(){
    try{
      const parsed=JSON.parse(localStorage.getItem(storageKey)||"null");
      if(parsed?.schemaVersion!=="ctk-browser-working-copy-v2")throw new Error("No current private working copy was found. Legacy caches are not complete masters.");
      if(!source)throw new Error("Load or import the complete private master before restoring browser edits.");
      if(sourceDigest!==parsed.baseDigest)throw new Error("The private master has changed since this cache was saved. Export the cached copy and merge it into the latest master instead.");
      if(!window.confirm("Restore this browser's private working copy? Unsaved form edits will be replaced."))return;
      applyMaster(parsed.data,{digest:sourceDigest,label:"Browser edits restored against the loaded private master. Save the private master to make them durable."});
    }catch(error){window.alert(`Restore failed: ${error.message}`);}
  }

  function exportBrowserRecovery(){
    const raw=localStorage.getItem(storageKey)||localStorage.getItem("ctk-content-manager-v1");
    if(!raw)return window.alert("No browser recovery data was found.");
    downloadText(`PRIVATE-browser-recovery-INCOMPLETE-${today()}.json`,raw);
  }

  function resetBrowser(){
    if(!source)return;
    if(!window.confirm("Discard browser edits and restore the last loaded private master? Export a private backup first if needed."))return;
    localStorage.removeItem(storageKey);
    applyMaster(source,{digest:sourceDigest,label:sourceLabel});
  }

  function flushEditors(){
    if(!source)throw new Error("Load a complete private editorial master first.");
    if(productDirty){
      $("[data-product-form]")?.requestSubmit();
      if(productDirty)throw new Error("The current product has unsaved or invalid changes. Fix the product form first.");
    }
    if(articleDirty){
      $("[data-article-form]")?.requestSubmit();
      if(articleDirty)throw new Error("The current article has unsaved or invalid changes. Fix the article form first.");
    }
  }

  function publicProjection(){
    if(!source)throw new Error("Load a complete private editorial master first.");
    if(!window.CTKPublicContent)throw new Error("Public projection is unavailable. No public export can be made.");
    const data=window.CTKPublicContent.projectContent(currentBundle());
    window.CTKPublicContent.assertPublicContent(data);
    return data;
  }

  function validateWorkingCopy(){
    syncBlocksFromDom();
    const errors=[];
    const warnings=[];
    let projected;
    try{flushEditors();projected=publicProjection();}catch(error){
      $("[data-validation-output]").textContent=error.message;
      return false;
    }
    const ids=new Set();
    const slugs=new Set();
    const matchKeys=new Set((state.categories.matchTypes||[]).map(item=>item.key));
    const categoryKeys=new Set((state.categories.categories||[]).map(item=>item.key));
    const verificationKeys=new Set((state.categories.verificationOptions||[]).map(item=>item.key));
    const sectionKeys=new Set((state.categories.editorialSections||[]).filter(item=>item.active!==false).map(item=>item.key));
    const contentTypeKeys=new Set((state.categories.contentTypes||[]).map(item=>item.key));
    const contextConfidenceKeys=new Set((state.categories.contextConfidence||[]).map(item=>item.key));
    const monetizationProfileKeys=new Set((state.categories.monetizationProfiles||[]).map(item=>item.key));
    const articleAdEligibleTypes=new Set(["paragraph","list","quote","definition-list"]);
    const requiredArticleManualSlots=article=>{
      if(!article||article.draft)return[];
      const profileName=article.monetizationProfile||"default";
      if(profileName==="none")return[];
      const allowedSlots=new Set(Object.keys(state.monetization?.adsense?.slots||{}).filter(key=>key.startsWith("article-")));
      if(profileName==="custom"){
        return [...new Set((article.body||[])
          .filter(block=>block?.type==="ad-break"&&allowedSlots.has(block.slot))
          .map(block=>block.slot))];
      }
      const eligibleCount=(article.body||[]).filter(block=>articleAdEligibleTypes.has(block?.type)).length;
      if(eligibleCount<5)return[];
      const profileSlots=Array.isArray(state.monetization?.articleProfiles?.[profileName]?.manualSlots)
        ?state.monetization.articleProfiles[profileName].manualSlots
        :[];
      if(profileName==="light")return profileSlots.slice(0,1);
      if(profileName==="default"&&eligibleCount<10)return profileSlots.slice(0,1);
      return profileSlots;
    };

    projected.products.forEach((product,index)=>{
      const label=`Product ${index+1} (${product.id||"missing ID"})`;
      if(!product.id)errors.push(`${label}: ID is required.`);
      if(ids.has(product.id))errors.push(`${label}: Duplicate product ID.`);
      ids.add(product.id);
      if(!product.slug)errors.push(`${label}: Slug is required.`);
      if(!product.name)errors.push(`${label}: Name is required.`);
      if(!product.summary)errors.push(`${label}: Summary is required.`);
      if(!categoryKeys.has(product.categoryKey))errors.push(`${label}: Unknown category.`);
      if(!matchKeys.has(product.productMatchType))errors.push(`${label}: Unknown Product Match type.`);
      (product.verificationStatus||[]).forEach(key=>{
        if(!verificationKeys.has(key))errors.push(`${label}: Unknown verification key “${key}”.`);
      });
      if(product.personallyUsed && !(product.verificationStatus||[]).includes("personally-used")){
        warnings.push(`${label}: Personally used is checked but Personally Used verification is missing.`);
      }
      if(product.affiliateUrl && !product.linkLastCheckedAt)errors.push(`${label}: Affiliate URL requires link last checked date.`);
      if(product.activePurchaseCta && !product.affiliateUrl)errors.push(`${label}: Active purchase CTA requires affiliate URL.`);
      if(product.activePurchaseCta && product.amazonAvailability!=="available")errors.push(`${label}: Active purchase CTA requires Amazon status Available.`);
      if(!product.draft){
        const requiredTextFields=["id","slug","name","summary","categoryKey","image","imageAlt","seenInKorea","usedBy","whyItMatters","productMatchType","publishedAt","lastCheckedAt","publicImageStatus"];
        requiredTextFields.forEach(field=>{if(!String(product[field]||"").trim())errors.push(`${label}: ${field} must not be blank for a public product.`);});
        if(!(product.verificationStatus||[]).length)errors.push(`${label}: Public product needs at least one verification status.`);
      }
      if(product.draft && product.featured)warnings.push(`${label}: Draft product is featured.`);
    });

    projected.articles.forEach((article,index)=>{
      const label=`Article ${index+1} (${article.slug||"missing slug"})`;
      if(!article.id)errors.push(`${label}: ID is required.`);
      if(!article.slug)errors.push(`${label}: Slug is required.`);
      if(slugs.has(article.slug))errors.push(`${label}: Duplicate article slug.`);
      slugs.add(article.slug);
      if(!article.title)errors.push(`${label}: Title is required.`);
      if(!article.excerpt)errors.push(`${label}: Excerpt is required.`);
      if(!categoryKeys.has(article.categoryKey))errors.push(`${label}: Unknown category.`);
      if(!sectionKeys.has(article.sectionKey))errors.push(`${label}: Unknown or inactive editorial section.`);
      if(!contentTypeKeys.has(article.contentType))errors.push(`${label}: Unknown content type.`);
      if(!contextConfidenceKeys.has(article.koreaContextConfidence))errors.push(`${label}: Unknown Korea context confidence.`);
      if(!monetizationProfileKeys.has(article.monetizationProfile))errors.push(`${label}: Unknown monetization profile.`);
      if(article.sourceRequirement==="required" && !(article.sources||[]).length)errors.push(`${label}: Sources are required.`);
      if(article.koreaContextConfidence==="broadly-verified" && !(article.sources||[]).length){
        warnings.push(`${label}: Broadly Verified is selected without a listed source. Confirm that broad support is documented before publication.`);
      }
      if(article.contentType==="product-guide" && !(article.relatedProductIds||[]).length){
        warnings.push(`${label}: Product Guide has no related product IDs.`);
      }
      if(!article.draft){
        const requiredTextFields=["id","slug","title","seoTitle","excerpt","metaDescription","categoryKey","sectionKey","contentType","koreaContextConfidence","monetizationProfile","heroImage","heroImageAlt","publishedAt","updatedAt"];
        requiredTextFields.forEach(field=>{if(!String(article[field]||"").trim())errors.push(`${label}: ${field} must not be blank for a public article.`);});
        if(!String(article.primaryKeyword||"").trim())warnings.push(`${label}: Public article has no primary keyword.`);
        if(!(article.body||[]).length)errors.push(`${label}: Public article needs body content.`);
        if(!Number(article.heroImageWidth)||!Number(article.heroImageHeight))errors.push(`${label}: Public article needs hero image width and height.`);
      }
      const allowedBlockTypes=new Set(["paragraph","heading","list","quote","image","definition-list","ad-break","gallery"]);
      const allowedArticleAdSlots=new Set(Object.keys(state.monetization?.adsense?.slots||{}).filter(key=>key.startsWith("article-")));
      const adBreakSlots=new Set();
      let adBreakCount=0;
      (article.body||[]).forEach((block,blockIndex)=>{
        if(!allowedBlockTypes.has(block.type))errors.push(`${label}: Unknown body block type “${block.type}” at block ${blockIndex+1}.`);
        if(["paragraph","heading","quote"].includes(block.type) && !String(block.text||"").trim())errors.push(`${label}: ${block.type} block ${blockIndex+1} must not be blank.`);
        if(block.type==="list" && (!(block.items||[]).length || (block.items||[]).some(item=>!String(item||"").trim())))errors.push(`${label}: List block ${blockIndex+1} needs non-blank items.`);
        if(block.type==="definition-list" && (!(block.items||[]).length || (block.items||[]).some(item=>!String(item?.term||"").trim()||!String(item?.description||"").trim())))errors.push(`${label}: Definition list block ${blockIndex+1} needs a term and description for every item.`);
        if(block.type==="image" && !block.alt)errors.push(`${label}: Image block ${blockIndex+1} needs alt text.`);
        if(block.type==="ad-break"){
          adBreakCount+=1;
          if(article.monetizationProfile!=="custom")errors.push(`${label}: Ad Break block ${blockIndex+1} requires Monetization Profile = Custom.`);
          if(!allowedArticleAdSlots.has(block.slot))errors.push(`${label}: Ad Break block ${blockIndex+1} uses an unknown article ad slot.`);
          if(adBreakSlots.has(block.slot))errors.push(`${label}: Ad Break slot “${block.slot}” is used more than once.`);
          adBreakSlots.add(block.slot);
          if(blockIndex<2 || blockIndex>(article.body||[]).length-3)errors.push(`${label}: Ad Break block ${blockIndex+1} must have at least two content blocks before and after it.`);
          if((article.body||[])[blockIndex-1]?.type==="ad-break" || (article.body||[])[blockIndex+1]?.type==="ad-break")errors.push(`${label}: Adjacent Ad Break blocks are not allowed.`);
        }
      });
      if(article.monetizationProfile==="custom" && adBreakCount===0)warnings.push(`${label}: Custom monetization profile has no Ad Break block.`);
      if(article.draft && article.featured)warnings.push(`${label}: Draft article is featured.`);

      // Article and Product Guide cards must remain visually distinct, even when
      // they explain the same physical product.
      (article.relatedProductIds||[]).forEach(productId=>{
        const relatedProduct=state.products.find(product=>product.id===productId);
        if(relatedProduct && String(article.heroImage||"").trim()===String(relatedProduct.image||"").trim()){
          warnings.push(`${label}: Article and related Product Guide use the same representative image. Use a context/use image for the Article and a product-identification image for the Product Guide.`);
        }
      });
    });

    if(state.monetization?.adsense?.connectionEnabled===true){
      const publisherId=String(state.monetization?.adsense?.publisherId||"").trim();
      if(!/^ca-pub-\d{16}$/.test(publisherId))errors.push("Monetization: AdSense publisher ID must use ca-pub- followed by 16 digits.");
    }
    if(state.monetization?.adsense?.manualAdsEnabled===true && state.monetization?.adsense?.connectionEnabled!==true)errors.push("Monetization: Manual ad units require the AdSense connection to be enabled.");
    if(state.monetization?.adsense?.manualAdsEnabled===true){
      const configuredSlots=Object.entries(state.monetization?.adsense?.slots||{}).filter(([,value])=>String(value||"").trim());
      if(!configuredSlots.length)errors.push("Monetization: Manual ad units are enabled but no AdSense ad unit ID is configured.");
      configuredSlots.forEach(([slotName,slotId])=>{
        if(!/^\d+$/.test(String(slotId).trim()))errors.push(`Monetization: AdSense ad unit ID for ${slotName} must contain digits only.`);
      });
      projected.articles.filter(article=>!article.draft).forEach(article=>{
        requiredArticleManualSlots(article).forEach(slotName=>{
          if(!String(state.monetization?.adsense?.slots?.[slotName]||"").trim()){
            errors.push(`Monetization: Public article ${article.slug} requires an ad unit ID for slot ${slotName}.`);
          }
        });
      });
    }
    if(state.monetization?.amazonAssociates?.enabled===true && !String(state.monetization?.amazonAssociates?.associateTag||"").trim())errors.push("Monetization: Amazon Associates cannot be active without an associate tag.");
    if(state.monetization?.amazonAssociates?.enabled===true && !String(state.monetization?.amazonAssociates?.siteDisclosure||"").trim())errors.push("Monetization: Amazon Associates cannot be active without the required site disclosure.");

    const output=$("[data-validation-output]");
    const lines=[];
    if(!errors.length)lines.push("✓ No blocking errors found.");
    else{
      lines.push(`ERRORS (${errors.length})`);
      errors.forEach(item=>lines.push(`- ${item}`));
    }
    if(warnings.length){
      lines.push("",`WARNINGS (${warnings.length})`);
      warnings.forEach(item=>lines.push(`- ${item}`));
    }
    lines.push("",`Products: ${state.products.length}`,`Articles: ${state.articles.length}`);
    output.textContent=lines.join("\n");
    return errors.length===0;
  }

  function downloadText(filename,text,type="application/json"){
    const blob=new Blob([text],{type});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a");
    anchor.href=url;
    anchor.download=filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function currentBundle(){
    if(!source)throw new Error("No complete private editorial master is loaded.");
    return {...clone(source),schemaVersion:"ctk-editorial-master-v1",
      products:clone(state.products),articles:clone(state.articles),categories:clone(state.categories),
      siteCopy:clone(state.siteCopy),monetization:clone(state.monetization)};
  }

  function downloadPublic(filename){
    try{
      flushEditors();
      if(!validateWorkingCopy())throw new Error("Resolve the public-content validation errors before downloading.");
      const projected=publicProjection();
      if(filename==="content-data.js"){
        const bundle=window.CTKPublicContent.createPublicBundle(currentBundle());
        window.CTKPublicContent.assertPublicContent(bundle);
        downloadText(filename,`window.__CTK_DATA__ = ${JSON.stringify(bundle)};\n`,"text/javascript");
      }else{
        const key={"products.json":"products","articles.json":"articles","search-aliases.json":"searchAliases"}[filename];
        downloadText(filename,JSON.stringify(projected[key],null,2));
      }
    }catch(error){window.alert(`Public export stopped: ${error.message}`);}
  }

  function downloadBackup(){
    try{
      flushEditors();
      downloadText(`PRIVATE-ctk-editorial-master-${today()}.json`,JSON.stringify(currentBundle(),null,2));
    }catch(error){window.alert(`Private export stopped: ${error.message}`);}
  }

  async function importMaster(file){
    if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());
      assertMaster(parsed);
      if(source && ["products","articles"].some(name=>state[name].some(item=>!parsed[name].some(incoming=>incoming.id===item.id))))throw new Error("Import would remove records from your working copy. Export and merge them first.");
      if(source && !window.confirm("Replace the working copy with this complete private master? Export your current private master first if needed."))return;
      // Preserve a digest only when this session already loaded the real local source.
      applyMaster(parsed,{digest:sourceDigest,label:"Complete private master imported. Drafts stay private; save this master outside the website project."});
      saveBrowser(false);
    }catch(error){window.alert(`Import failed: ${error.message}`);}
  }

  function renderMonetizationStatus(){
    const adsense=$('[data-adsense-status]');
    const amazon=$('[data-amazon-status]');
    const set=(element,label,enabled)=>{
      if(!element)return;
      element.textContent=`${label}: ${enabled ? "Active" : "Not active"}`;
      element.classList.toggle("is-active",Boolean(enabled));
      element.classList.toggle("is-inactive",!enabled);
    };
    if(adsense){
      const connected=state.monetization?.adsense?.connectionEnabled===true;
      const manual=state.monetization?.adsense?.manualAdsEnabled===true;
      adsense.textContent=!connected
        ?"AdSense: Not connected"
        :(manual?"AdSense: Connected · Manual ads ON":"AdSense: Connected · Manual ads OFF / review stage");
      adsense.classList.toggle("is-active",connected);
    }
    set(amazon,"Amazon Associates",state.monetization?.amazonAssociates?.enabled);
  }

  function autoSlug(form,titleName,slugName,idName){
    const title=form.elements[titleName];
    const slug=form.elements[slugName];
    const id=form.elements[idName];
    title?.addEventListener("input",()=>{
      if(!slug.dataset.edited)slug.value=slugify(title.value);
      if(id && !id.dataset.edited)id.value=slugify(title.value);
    });
    slug?.addEventListener("input",()=>slug.dataset.edited="true");
    id?.addEventListener("input",()=>id.dataset.edited="true");
  }

  populateReferenceOptions();
  renderMonetizationStatus();
  // Never automatically promote public data or a browser cache to master.
  renderSourceStatus();
  renderProductList();
  renderArticleList();

  const initialProduct=state.products.find(item=>!item.draft) || state.products[0];
  const initialArticle=state.articles.find(item=>!item.draft) || state.articles[0];
  if(initialProduct)selectProduct(initialProduct.id); else newProduct();
  if(initialArticle)selectArticle(initialArticle.id); else newArticle();

  $("[data-product-search]")?.addEventListener("input",renderProductList);
  $("[data-article-search]")?.addEventListener("input",renderArticleList);
  $("[data-product-form]")?.addEventListener("submit",saveProduct);
  $("[data-article-form]")?.addEventListener("submit",saveArticle);
  $("[data-new-product]")?.addEventListener("click",newProduct);
  $("[data-new-article]")?.addEventListener("click",newArticle);
  $("[data-duplicate-product]")?.addEventListener("click",duplicateProduct);
  $("[data-duplicate-article]")?.addEventListener("click",duplicateArticle);
  $("[data-delete-product]")?.addEventListener("click",deleteProduct);
  $("[data-delete-article]")?.addEventListener("click",deleteArticle);
  $$("[data-add-block]").forEach(button=>button.addEventListener("click",()=>addBlock(button.dataset.addBlock)));
  $("[data-save-browser]")?.addEventListener("click",()=>saveBrowser(true));
  $("[data-reset-browser]")?.addEventListener("click",resetBrowser);
  $("[data-run-validation]")?.addEventListener("click",validateWorkingCopy);
  $("[data-download-products]")?.addEventListener("click",()=>downloadPublic("products.json"));
  $("[data-download-articles]")?.addEventListener("click",()=>downloadPublic("articles.json"));
  $("[data-download-bundle]")?.addEventListener("click",()=>downloadPublic("content-data.js"));
  $("[data-download-aliases]")?.addEventListener("click",()=>downloadPublic("search-aliases.json"));
  $("[data-download-backup]")?.addEventListener("click",downloadBackup);
  $("[data-import-master]")?.addEventListener("change",event=>{
    importMaster(event.target.files?.[0]); event.target.value="";
  });
  $("[data-restore-browser]")?.addEventListener("click",restoreBrowser);
  $("[data-export-browser-recovery]")?.addEventListener("click",exportBrowserRecovery);

  const productForm=$("[data-product-form]");
  const articleForm=$("[data-article-form]");
  productForm?.addEventListener("input",()=>{productDirty=true;});
  productForm?.addEventListener("change",()=>{productDirty=true;});
  articleForm?.addEventListener("input",()=>{articleDirty=true;});
  articleForm?.addEventListener("change",()=>{articleDirty=true;});

  if(window.location.hostname==="127.0.0.1" || window.location.hostname==="localhost"){
    window.__CTK_ADMIN_LOCAL__={
      loadPrivateMaster(data,digest){
        if(typeof digest!=="string" || !/^[a-f0-9]{64}$/.test(digest))throw new Error("Missing private-master revision.");
        applyMaster(data,{digest,label:"Private master loaded from outside the public project. Browser edits are not durable until saved."});
      },
      markPrivateMasterSaved(digest,savedMaster){
        source=clone(savedMaster||currentBundle()); sourceDigest=digest;
        sourceLabel="Private master saved outside the public project. Public exports contain published records only.";
        renderSourceStatus(); saveBrowser(false);
      },
      preparePublishPayload({validatePublic=true}={}){
        try{
          flushEditors();
          if(!sourceDigest)throw new Error("Load the private master through the local server before saving or publishing. An imported file alone is not a verified server source.");
          if(validatePublic && !validateWorkingCopy())throw new Error("Browser validation found blocking errors. Review Step 1 before publishing.");
          return {ok:true,payload:{master:currentBundle(),expectedDigest:sourceDigest}};
        }catch(error){return {ok:false,error:error.message};}
      }
    };
  }

  autoSlug($("[data-product-form]"),"name","slug","id");
  autoSlug($("[data-article-form]"),"title","slug","id");
})();
