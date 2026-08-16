(function(){
  const fallback={
    adsense:{connectionEnabled:false,publisherId:'',manualAdsEnabled:false,slots:{}},
    amazonAssociates:{enabled:false,associateTag:'',siteDisclosure:'',inlineDisclosure:''},
    articleProfiles:{}
  };

  function config(candidate){
    return candidate&&typeof candidate==='object'
      ?candidate
      :(window.__CTK_DATA__?.monetization||fallback);
  }

  function adsenseConnected(candidate){
    const cfg=config(candidate).adsense||{};
    return cfg.connectionEnabled===true&&Boolean(String(cfg.publisherId||'').trim());
  }

  function manualAdsEnabled(candidate){
    const cfg=config(candidate).adsense||{};
    return adsenseConnected(candidate)&&cfg.manualAdsEnabled===true;
  }

  function amazonEnabled(candidate){
    const cfg=config(candidate).amazonAssociates||{};
    return cfg.enabled===true
      &&Boolean(String(cfg.associateTag||'').trim())
      &&Boolean(String(cfg.siteDisclosure||'').trim());
  }

  function canShowAmazonCta(product,candidate){
    if(!product||!amazonEnabled(candidate))return false;
    return product.activePurchaseCta===true
      &&Boolean(String(product.affiliateUrl||'').trim())
      &&product.soldOut!==true
      &&product.amazonAvailability==='available';
  }

  function affiliateHref(product,candidate){
    return canShowAmazonCta(product,candidate)?String(product.affiliateUrl||'').trim():'';
  }

  function manualAdSlotConfigured(slotName,candidate){
    const cfg=config(candidate);
    if(!manualAdsEnabled(cfg))return false;
    return Boolean(String(cfg.adsense?.slots?.[slotName]||'').trim());
  }

  function manualAdUnitConfig(slotName,candidate){
    const cfg=config(candidate);
    if(!manualAdSlotConfigured(slotName,cfg))return null;
    const publisherId=String(cfg.adsense?.publisherId||'').trim();
    const slotId=String(cfg.adsense?.slots?.[slotName]||'').trim();
    if(!publisherId||!slotId)return null;
    return {publisherId,slotId};
  }

  function renderManualAdMount(mount,slotName,candidate){
    if(!mount)return false;
    const unit=manualAdUnitConfig(slotName,candidate);
    if(!unit)return false;
    if(mount.dataset.adRendered==='true')return true;

    const ad=document.createElement('ins');
    ad.className='adsbygoogle';
    ad.style.display='block';
    ad.setAttribute('data-ad-client',unit.publisherId);
    ad.setAttribute('data-ad-slot',unit.slotId);
    ad.setAttribute('data-ad-format','auto');
    ad.setAttribute('data-full-width-responsive','true');
    mount.replaceChildren(ad);
    mount.dataset.adRendered='true';

    window.adsbygoogle=window.adsbygoogle||[];
    window.adsbygoogle.push({});
    return true;
  }

  function articleProfile(profileName,candidate){
    const cfg=config(candidate);
    return cfg.articleProfiles?.[profileName]||{manualSlots:[]};
  }

  function eligibleArticleIndexes(blocks=[]){
    const eligibleTypes=new Set(['paragraph','list','quote','definition-list']);
    return blocks.reduce((indexes,block,index)=>{
      if(eligibleTypes.has(block?.type))indexes.push(index);
      return indexes;
    },[]);
  }

  function nearestEligibleIndex(indexes,target,used=new Set()){
    const candidates=indexes.filter(index=>!used.has(index));
    if(!candidates.length)return null;
    return candidates.reduce((best,index)=>{
      if(best===null)return index;
      return Math.abs(index-target)<Math.abs(best-target)?index:best;
    },null);
  }

  function automaticArticlePlacements(article,blocks=[],candidate){
    const profileName=article?.monetizationProfile||'default';
    if(profileName==='none'||profileName==='custom')return[];

    const profile=articleProfile(profileName,candidate);
    const configuredSlots=(profile.manualSlots||[]).filter(slot=>manualAdSlotConfigured(slot,candidate));
    if(!configuredSlots.length)return[];

    const indexes=eligibleArticleIndexes(blocks);
    if(indexes.length<5)return[];

    let slots=configuredSlots;
    if(profileName==='default'&&indexes.length<10)slots=configuredSlots.slice(0,1);
    if(profileName==='light')slots=configuredSlots.slice(0,1);
    if(!slots.length)return[];

    const fractions=slots.length===1?[0.48]:[0.34,0.68];
    const used=new Set();
    return slots.map((slotName,position)=>{
      const target=(blocks.length-1)*fractions[position];
      const afterIndex=nearestEligibleIndex(indexes,target,used);
      if(afterIndex===null)return null;
      used.add(afterIndex);
      return {slotName,afterIndex};
    }).filter(Boolean).sort((a,b)=>a.afterIndex-b.afterIndex);
  }

  function customArticleBreakAllowed(article,block,candidate){
    return article?.monetizationProfile==='custom'
      &&block?.type==='ad-break'
      &&manualAdSlotConfigured(block.slot,candidate);
  }

  window.CTKMonetization={
    config,
    adsenseConnected,
    manualAdsEnabled,
    amazonEnabled,
    canShowAmazonCta,
    affiliateHref,
    manualAdSlotConfigured,
    manualAdUnitConfig,
    renderManualAdMount,
    articleProfile,
    eligibleArticleIndexes,
    automaticArticlePlacements,
    customArticleBreakAllowed
  };
})();
