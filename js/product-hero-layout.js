(() => {
  function moveGallery(){
    const hero=document.querySelector('.data-product-hero');
    const summary=document.querySelector('.data-product-summary');
    const gallery=hero?.querySelector('.product-gallery');
    if(!hero||!summary||!gallery)return false;

    if(gallery.parentElement!==summary){
      summary.appendChild(gallery);
    }
    return true;
  }

  if(moveGallery())return;

  const observer=new MutationObserver(() => {
    if(moveGallery())observer.disconnect();
  });

  const hero=document.querySelector('.data-product-hero');
  if(hero)observer.observe(hero,{childList:true,subtree:true});

  window.addEventListener('load',moveGallery,{once:true});
})();