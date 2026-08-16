(()=>{
  const hostname=window.location.hostname;
  if(hostname!=="127.0.0.1" && hostname!=="localhost")return;

  const panel=document.querySelector("[data-local-publish-panel]");
  const gitStatus=document.querySelector("[data-local-publish-git]");
  const button=document.querySelector("[data-local-publish-button]");
  const output=document.querySelector("[data-local-publish-output]");
  const imageInput=document.querySelector("[data-local-image-input]");
  const imageResults=document.querySelector("[data-local-image-results]");
  if(!panel||!gitStatus||!button||!output||!imageInput||!imageResults)return;

  let sessionToken="";

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
    imageInput.disabled=true;
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
      imageInput.disabled=button.disabled;
    }
  }

  async function loadSession(){
    try{
      const response=await fetch("/api/session",{cache:"no-store",headers:{"Accept":"application/json"}});
      if(!response.ok)return;
      const data=await response.json();
      if(!data?.ok||!data.localAdmin||!data.token)return;

      sessionToken=data.token;
      panel.hidden=false;

      const git=data.git||{};
      const branch=git.branch||"(no branch)";
      if(!git.available){
        gitStatus.textContent="Local Git repository was not detected. One-click publish is disabled.";
        button.disabled=true;
        imageInput.disabled=true;
        return;
      }
      if(!git.hasOrigin){
        gitStatus.textContent=`Git is ready on branch ${branch}, but no origin remote is configured. Manual export remains available below.`;
        button.disabled=true;
        imageInput.disabled=true;
        return;
      }

      gitStatus.textContent=`Local Git is ready on branch ${branch}. Publishing will validate, commit, and push only from this PC.`;
      button.disabled=false;
      imageInput.disabled=false;
    }catch{
      // Keep the panel hidden outside the local admin bridge or if the bridge is unavailable.
    }
  }

  async function publish(){
    if(!sessionToken||button.disabled)return;
    const bridge=window.__CTK_ADMIN_LOCAL__;
    if(!bridge?.preparePublishPayload){
      setOutput("The local content bridge is not available. Reload the local admin page.",true);
      return;
    }
    const prepared=bridge.preparePublishPayload();
    if(!prepared?.ok){
      setOutput(prepared?.error||"The working copy is not ready to publish.",true);
      return;
    }

    const confirmed=window.confirm("Publish the validated Closer to Korea working copy to the configured Git origin?");
    if(!confirmed)return;

    button.disabled=true;
    imageInput.disabled=true;
    setOutput("Starting local publish…");
    try{
      const response=await fetch("/api/publish",{
        method:"POST",
        headers:{
          "Accept":"application/json",
          "Content-Type":"application/json",
          "X-CTK-Publish-Token":sessionToken
        },
        body:JSON.stringify(prepared.payload)
      });
      const data=await response.json().catch(()=>({ok:false,error:`Unexpected response (${response.status}).`}));
      if(!response.ok||!data.ok){
        setOutput(data.error||`Publish failed (${response.status}).`,true);
        return;
      }
      const imageNote=(data.publishedImages||[]).length?` Published ${(data.publishedImages||[]).length} staged image(s).`:"";
      setOutput(`${data.message||"Publish completed successfully."}${imageNote}`);
    }catch(error){
      setOutput(`Publish request failed: ${error?.message||error}`,true);
    }finally{
      button.disabled=false;
      imageInput.disabled=false;
    }
  }

  imageInput.addEventListener("change",stageSelectedImages);
  button.addEventListener("click",publish);
  loadSession();
})();
