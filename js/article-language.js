(() => {
  const params=new URLSearchParams(location.search);
  const slug=params.get('slug');

  const fallbackNotes={
    'korean-microwave-steamed-egg-cooker':{
      koreanName:'계란찜기',
      pronunciation:'gyeran-jjim-gi',
      parts:[
        {korean:'계란',romanization:'gyeran',meaning:'egg'},
        {korean:'찜',romanization:'jjim',meaning:'a steamed dish or steaming'},
        {korean:'기',romanization:'gi',meaning:'a device, cooker, or tool in this context'}
      ],
      literalMeaning:'A tool or cooker for making steamed eggs',
      naturalEnglish:'Microwave steamed egg cooker'
    }
  };

  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[c]));

  async function load(){
    const section=document.querySelector('[data-article-language]');
    const content=document.querySelector('[data-language-note-content]');
    if(!section||!content||!slug)return;

    let note=null;
    try{
      const response=await fetch('data/articles.json',{cache:'no-store'});
      if(response.ok){
        const articles=await response.json();
        const article=articles.find(item=>item.slug===slug&&!item.draft);
        note=article?.languageGuide||null;
      }
    }catch{}

    note=note||fallbackNotes[slug];
    if(!note)return;

    content.innerHTML=`
      <dl class="language-note__summary">
        <div><dt>Korean name</dt><dd lang="ko">${safe(note.koreanName)}</dd></div>
        <div><dt>Pronunciation</dt><dd><i>${safe(note.pronunciation)}</i></dd></div>
      </dl>
      <div class="language-note__parts">
        ${(note.parts||[]).map(part=>`
          <div>
            <strong lang="ko">${safe(part.korean)}</strong>
            <span><i>${safe(part.romanization)}</i></span>
            <span>${safe(part.meaning)}</span>
          </div>
        `).join('')}
      </div>
      <p><strong>Literal idea:</strong> ${safe(note.literalMeaning||'')}</p>
      <p><strong>Natural English:</strong> ${safe(note.naturalEnglish||'')}</p>
    `;
    section.hidden=false;
  }

  load();
})();