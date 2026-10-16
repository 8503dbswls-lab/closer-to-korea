(()=>{
  const hostname=window.location.hostname;
  if(hostname!=="127.0.0.1" && hostname!=="localhost")return;

  const panel=document.querySelector("[data-local-publish-panel]");
  const gitStatus=document.querySelector("[data-local-publish-git]");
  const button=document.querySelector("[data-local-publish-button]");
  const saveButton=document.querySelector("[data-local-save-master]");
  const output=document.querySelector("[data-local-publish-output]");
  const imageInput=document.querySelector("[data-local-image-input]");
  const imageResults=document.querySelector("[data-local-image-results]");
  if(!panel||!gitStatus||!button||!saveButton||!output||!imageInput||!imageResults)return;

  let sessionToken="";
  let sourceReady=false;
  let canPublish=false;
  let busy=false;

  function setBusy(value){
    busy=value;
    button.disabled=busy||!canPublish||!sourceReady;
    saveButton.disabled=busy||!sourceReady;
    imageInput.disabled=busy||!sourceReady;
  }

  function setOutput(message,isError=false){
    output.textContent=message||"";
    output.classList.toggle("is-error",Boolean(isError));
  }

  function bytesToBase64(buffer){
    const bytes=new Uint8Array(buffer);
    let binary="";
    const chunkSize=0x8000;
    for(let i=0;i<bytes.length;i+=chunkSize){
      binary+=String.fromCharCode(...bytes.subarray(i,i+chunkSize));
    }
    return btoa(binary);
  }

  async function copyText(text){
    try{
      await navigator.clipboard.writeText(text);
      return true;
    }catch{
      const area=document.createElement("textarea");
      area.value=text;
      area.setAttribute("readonly","");
      area.style.position="fixed";
      area.style.opacity="0";
      document.body.appendChild(area);
      area.select();
      const ok=document.execCommand("copy");
      area.remove();
      return ok;
    }
  }

  function setFormPath(selector,path){
    const field=document.querySelector(selector);
    if(!field)return false;
    field.value=path;
    field.dispatchEvent(new Event("input",{bubbles:true}));
    field.focus();
    return true;
  }

  function resultButton(label,onClick){
    const control=document.createElement("button");
    control.type="button";
    control.className="button ghost compact";
    control.textContent=label;
    control.addEventListener("click",onClick);
    return control;
  }

  function showStagedImage(file,result){
    const card=document.createElement("div");
    card.className="local-image-result";

    const text=document.createElement("div");
    const name=document.createElement("strong");
    name.textContent=file.name;
    const pathLine=document.createElement("code");
    pathLine.textContent=result.path;
    text.append(name,document.createElement("br"),pathLine);

    const actions=document.createElement("div");
    actions.className="local-image-actions";
    actions.append(
      resultButton("Use as product image",()=>{
        if(setFormPath('[data-product-form] [name="image"]',result.path))setOutput(`Product image path set to ${result.path}`);
      }),
      resultButton("Use as article hero",()=>{
        if(setFormPath('[data-article-form] [name="heroImage"]',result.path))setOutput(`Article hero path set to ${result.path}`);
      }),
      resultButton("Copy path",async()=>{
        const copied=await copyText(result.path);
        setOutput(copied?`Copied ${result.path}`:"Could not copy the image path automatically.",!copied);
      })
    );

    card.append(text,actions);
    imageResults.prepend(card);
  }

  async function stageImage(file){
    if(!sessionToken)throw new Error("Local publish session is not ready.");
    if(file.size>12*1024*1024)throw new Error(`${file.name} is larger than 12 MB.`);
    const allowed=new Set(["image/jpeg","image/png","image/webp"]);
    if(!allowed.has(file.type))throw new Error(`${file.name} is not JPG, PNG, or WebP.`);

    const dataBase64=bytesToBase64(await file.arrayBuffer());
    const response=await fetch("/api/stage-image",{
      method:"POST",
      headers:{
        "Accept":"application/json",
        "Content-Type":"application/json",
        "X-CTK-Publish-Token":sessionToken
      },
      body:JSON.stringify({filename:file.name,mimeType:file.type,dataBase64})
    });
    const data=await response.json().catch(()=>({ok:false,error:`Unexpected response (${response.status}).`}));
    if(!response.ok||!data.ok)throw new Error(data.error||`Image staging failed (${response.status}).`);
    showStagedImage(file,data);
    return data;
  }

  async function stageSelectedImages(){
    const files=[...(imageInput.files||[])];
    if(!files.length)return;
    setBusy(true);
    setOutput(`Staging ${files.length} image${files.length===1?"":"s"}…`);
    let success=0;
    try{
      for(const file of files){
        try{
          await stageImage(file);
          success+=1;
        }catch(error){
          setOutput(`Stopped while staging ${file.name}: ${error?.message||error}`,true);
          return;
        }
      }
      setOutput(`Staged ${success} image${success===1?"":"s"}. Use the returned path in the content before publishing.`);
    }finally{
      imageInput.value="";
      setBusy(false);
    }
  }

  async function loadSession(){
    panel.hidden=false;
    try{
      const response=await fetch("/api/session",{cache:"no-store",headers:{"Accept":"application/json"}});
      if(!response.ok)throw new Error("The local admin server is unavailable.");
      const data=await response.json();
      if(!data?.ok||!data.localAdmin||!data.token)throw new Error("The local admin session is unavailable.");
      sessionToken=data.token;
      const sourceResponse=await fetch("/api/editorial-source",{
        cache:"no-store",headers:{"Accept":"application/json","X-CTK-Publish-Token":sessionToken}
      });
      const loaded=await sourceResponse.json();
      if(!sourceResponse.ok||!loaded.ok)throw new Error(loaded.error||"The complete private master could not be loaded.");
      window.__CTK_ADMIN_LOCAL__.loadPrivateMaster(loaded.master,loaded.digest);
      sourceReady=true;
      const git=data.git||{};
      const branch=git.branch||"(no branch)";
      canPublish=Boolean(git.available&&git.hasOrigin&&git.branch);
      gitStatus.textContent=canPublish
        ?`Private master loaded. Git is ready on branch ${branch}. Publishing saves privately, then validates and pushes public-only files.`
        :"Private master loaded. Private saves and image staging are available; publishing needs a Git branch and origin.";
      setBusy(false);
    }catch(error){
      gitStatus.textContent="Private source is not ready. No public data or browser cache will be used as its replacement.";
      setOutput(error?.message||String(error),true);
      setBusy(false);
    }
  }

  async function saveOrPublish(publish){
    if(!sessionToken||busy||!sourceReady||(publish&&!canPublish))return;
    const bridge=window.__CTK_ADMIN_LOCAL__;
    if(!bridge?.preparePublishPayload){
      setOutput("The local content bridge is not available. Reload the local admin page.",true);
      return;
    }
    const prepared=bridge.preparePublishPayload({validatePublic:publish});
    if(!prepared?.ok){
      setOutput(prepared?.error||"The private working copy is not ready.",true);
      return;
    }
    if(publish && !window.confirm("Save the complete private master outside the public project, then publish only validated, allowlisted public content and its referenced images to the configured Git origin? Drafts and editorial metadata will not be published."))return;
    setBusy(true);
    setOutput(publish?"Saving privately and preparing public-only publication…":"Saving the complete private master without publishing…");
    try{
      const response=await fetch(publish?"/api/publish":"/api/editorial-source",{
        method:"POST",
        headers:{"Accept":"application/json","Content-Type":"application/json","X-CTK-Publish-Token":sessionToken},
        body:JSON.stringify(prepared.payload)
      });
      const data=await response.json().catch(()=>({ok:false,error:`Unexpected response (${response.status}).`}));
      // A failed public publish can still have successfully saved the private master.
      if(data.masterDigest)bridge.markPrivateMasterSaved(data.masterDigest,prepared.payload.master);
      if(!response.ok||!data.ok){setOutput(data.error||`Request failed (${response.status}).`,true);return;}
      const imageNote=(data.publishedImages||[]).length?` Published ${data.publishedImages.length} referenced photo(s).`:"";
      setOutput(`${data.message||"Private master saved."}${imageNote}`);
    }catch(error){
      // A dropped response cannot prove whether the save or push happened. Do not retry blindly.
      sourceReady=false;
      setOutput(`The result is uncertain: ${error?.message||error}. Export your private working copy, then reload the local source and check the Git remote before retrying.`,true);
    }finally{setBusy(false);}
  }

  imageInput.addEventListener("change",stageSelectedImages);
  button.addEventListener("click",()=>saveOrPublish(true));
  saveButton.addEventListener("click",()=>saveOrPublish(false));
  loadSession();
})();
