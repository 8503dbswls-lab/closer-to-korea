(() => {
  const root=document.querySelector('[data-home-jump-nav]');
  if(!root)return;

  const toggle=root.querySelector('[data-home-jump-toggle]');
  const panel=root.querySelector('[data-home-jump-panel]');
  const links=[...panel.querySelectorAll('a[href^="#"]')];
  const sections=links
    .map(link=>document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

  function setOpen(open){
    root.classList.toggle('is-open',open);
    toggle.setAttribute('aria-expanded',String(open));
    panel.hidden=!open;
  }

  function setVisible(){
    const visible=window.scrollY>Math.max(520,window.innerHeight*.62);
    root.classList.toggle('is-visible',visible);
    if(!visible)setOpen(false);
  }

  function setActive(){
    const marker=window.scrollY+Math.min(260,window.innerHeight*.34);
    const available=sections.filter(section=>!section.hidden);
    let active=available[0]||null;
    available.forEach(section=>{
      if(section.offsetTop<=marker)active=section;
    });
    links.forEach(link=>{
      const section=document.querySelector(link.getAttribute('href'));
      link.hidden=!section||section.hidden;
      const current=active&&link.getAttribute('href')===`#${active.id}`;
      if(current)link.setAttribute('aria-current','location');
      else link.removeAttribute('aria-current');
    });
  }

  let scheduled=false;
  function onScroll(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{
      setVisible();
      setActive();
      scheduled=false;
    });
  }

  toggle.addEventListener('click',()=>setOpen(!root.classList.contains('is-open')));

  links.forEach(link=>link.addEventListener('click',event=>{
    const target=document.querySelector(link.getAttribute('href'));
    if(!target)return;
    event.preventDefault();
    setOpen(false);
    target.scrollIntoView({behavior:reducedMotion.matches?'auto':'smooth',block:'start'});
    history.replaceState(null,'',link.getAttribute('href'));
  }));

  document.addEventListener('click',event=>{
    if(!root.contains(event.target))setOpen(false);
  });

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      setOpen(false);
      toggle.focus();
    }
  });

  window.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onScroll);
  const availabilityObserver=new MutationObserver(onScroll);
  sections.forEach(section=>availabilityObserver.observe(section,{attributes:true,attributeFilter:['hidden']}));
  setVisible();
  setActive();
})();
