// Manga MiniApp — manifest mode
document.addEventListener('DOMContentLoaded', () => {
  const tg = window.Telegram?.WebApp;
  if (tg) { try { tg.ready(); tg.expand(); } catch(e){} }

  // ====== helpers ======
  const qs = (s, r=document) => r.querySelector(s);
  const qsa= (s, r=document) => [...r.querySelectorAll(s)];
  const throttle = (fn, ms)=>{ let t=0; return (...a)=>{ const now=Date.now(); if(now-t>ms){ t=now; fn(...a); } } };
  const toast = (text)=>{ const el=document.createElement('div'); el.textContent=text;
    Object.assign(el.style,{position:'fixed',left:'50%',bottom:'calc(90px + var(--safe-bottom))',transform:'translateX(-50%)',background:'rgba(23,26,34,.95)',border:'1px solid var(--stroke)',color:'var(--text)',padding:'10px 14px',borderRadius:'12px',zIndex:40});
    document.body.appendChild(el); setTimeout(()=> el.remove(), 1500);
  };
  const setText = (sel, v)=>{ const el=qs(sel); if(el) el.textContent=v; };

  // ====== state ======
  const K = { fav:'manga:fav', read:'manga:read', time:'manga:time', progress:'manga:progress' };
  const state = {
    favorites: new Set(JSON.parse(localStorage.getItem(K.fav) || '[]')),
    read: JSON.parse(localStorage.getItem(K.read) || '{}'),
    time: Number(localStorage.getItem(K.time) || '0'),
    progress: JSON.parse(localStorage.getItem(K.progress) || '{}'), // {id:{chapterIndex:number,page:number}}
    currentId: null,
    data: { projects: [] }, // manifest data
  };
  const saveFav = () => localStorage.setItem(K.fav, JSON.stringify([...state.favorites]));
  const saveRead = () => localStorage.setItem(K.read, JSON.stringify(state.read));
  const saveProg = () => localStorage.setItem(K.progress, JSON.stringify(state.progress));

  // ====== loading manifest ======
  fetch('projects.json', {cache:'no-cache'})
    .then(r => r.ok ? r.json() : Promise.reject('no manifest'))
    .then(json => { state.data = json || {projects:[]}; init(); })
    .catch(_ => { state.data = {projects:[]}; init(); });

  function init(){
    renderCatalog();
    renderProfile();
    bindTabs();
  }

  // ====== catalog ======
  function renderCatalog(){
    const grid = qs('#catalogGrid'); grid.innerHTML = '';

    const projects = state.data.projects;
    if (projects.length === 0){
      const empty = document.createElement('div');
      empty.style.color = 'var(--muted)';
      empty.innerHTML = 'Пока нет проектов. <br/>Добавь папки в <code>/projects</code> и сгенерируй <code>projects.json</code>.';
      grid.appendChild(empty);
      return;
    }

    projects.forEach(p => {
      const card = document.createElement('div');
      card.className = 'card';
      const cover = p.cover || 'https://placehold.co/600x800/png?text=' + encodeURIComponent(p.title);
      card.innerHTML = `<img class="cover" loading="lazy" src="${cover}" alt="${p.title}"><div class="title">${p.title}</div>`;
      card.onclick = () => openDetail(p.id);
      grid.appendChild(card);
    });
  }

  // ====== profile ======
  function renderProfile(){
    const totalRead = Object.values(state.read).reduce((a,arr)=>a+arr.length,0);
    setText('#stChapters', totalRead);
    setText('#stFav', state.favorites.size);
    setText('#stTime', state.time + ' ч');
    const favRow = qs('#favRow'); favRow.innerHTML = '';
    [...state.favorites]
      .map(id => state.data.projects.find(p=>p.id===id)).filter(Boolean)
      .forEach(p => {
        const el = document.createElement('div');
        el.className = 'fav-card';
        const cover = p.cover || 'https://placehold.co/600x800/png?text=' + encodeURIComponent(p.title);
        el.innerHTML = `<img src="${cover}" alt="${p.title}"><div class="t">${p.title}</div>`;
        el.onclick = () => openDetail(p.id);
        favRow.appendChild(el);
      });
  }

  // ====== detail ======
  function setFavButton(btn, isFav){
    btn.textContent = isFav ? 'В избранном' : 'Избранное';
    btn.className = 'btn ghost';
  }
  function toggleFavorite(id){
    if(state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
    saveFav(); setFavButton(qs('#btnFav'), state.favorites.has(id)); renderProfile();
  }
  function openDetail(id){
    state.currentId = id;
    const p = state.data.projects.find(x=>x.id===id); if(!p) return;
    qs('#dCover').src = p.cover || ('https://placehold.co/600x800/png?text=' + encodeURIComponent(p.title));
    setText('#dTitle', p.title);
    setText('#dDesc', p.desc || '');
    const btnFav = qs('#btnFav'); setFavButton(btnFav, state.favorites.has(id)); btnFav.onclick = () => toggleFavorite(id);

    const btnRead = qs('#btnRead'); btnRead.onclick = () => {
      const prog = state.progress[id];
      const chList = p.chapters || [];
      if(!chList.length){ toast('Нет глав'); return; }
      if(prog) openReader(id, prog.chapterIndex);
      else {
        // найдём первую непрочитанную главу по индексу
        const readSet = new Set(state.read[id]||[]);
        let idx = 1; for(let i=1;i<=chList.length;i++){ if(!readSet.has(i)){ idx = i; break; } }
        openReader(id, idx);
      }
    };

    const chWrap = qs('#chapters'); chWrap.innerHTML = '';
    const readSet = new Set(state.read[id]||[]);
    (p.chapters || []).forEach((ch, i) => {
      const index = i+1;
      const isRead = readSet.has(index);
      const row = document.createElement('div'); row.className = 'ch-item';
      row.innerHTML = `<div>${isRead ? '✔️ ' : ''}${ch.title || ('Глава ' + index)}</div><div class="arrow">›</div>`;
      row.onclick = () => openReader(id, index);
      chWrap.appendChild(row);
    });

    goto('detail');
  }

  // ====== reader ======
  const READER = { id:null, chapterIndex:1, pages:[], pageIndex:1 };
  function openReader(id, chapterIndex){
    const p = state.data.projects.find(x=>x.id===id); if(!p) return;
    const ch = (p.chapters || [])[chapterIndex-1]; if(!ch){ toast('Глава не найдена'); return; }

    READER.id = id; READER.chapterIndex = chapterIndex; READER.pages = ch.pages;

    const vp = qs('#readerViewport'); vp.innerHTML = '';
    (READER.pages || []).forEach((src, i) => {
      const img = document.createElement('img');
      img.className = 'page-img'; img.loading = 'lazy'; img.src = src; img.dataset.index = String(i+1);
      vp.appendChild(img);
    });
    const prog = (state.progress[id] && state.progress[id].chapterIndex === chapterIndex) ? state.progress[id].page : 1;
    READER.pageIndex = Math.min(Math.max(1, prog), READER.pages.length);
    setText('#readerTitle', `${p.title} — ${ch.title || ('Глава ' + chapterIndex)}`);
    updateProgressLabel();
    qs('#btnBackDetail').onclick = () => { goto('detail'); openDetail(id); };
    qs('#btnPrev').onclick = () => jump(-1);
    qs('#btnNext').onclick = () => jump(1);
    qs('#btnMode').onclick = () => alert('Горизонтальный режим добавим позже.');
    qs('#btnMarkRead').onclick = () => { markChapterRead(id, chapterIndex, true); };
    vp.onscroll = throttle(updateCurrentPageFromScroll, 120);
    goto('reader');
    requestAnimationFrame(() => scrollToPage(READER.pageIndex, false));
  }
  function scrollToPage(index, smooth=true){
    const vp = qs('#readerViewport');
    const img = qs(`.page-img[data-index="${index}"]`, vp); if(!img) return;
    img.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  }
  function updateProgressLabel(){ setText('#readerProgress', `${READER.pageIndex} / ${READER.pages.length}`); }
  function jump(dir){
    const next = Math.max(1, Math.min(READER.pages.length, READER.pageIndex + dir));
    if (next === READER.pageIndex) return;
    READER.pageIndex = next; updateProgressLabel();
    scrollToPage(next);
    saveProgress();
    if(next===READER.pages.length && dir>0){ tryMarkEndAndSuggestNext(); }
  }
  function updateCurrentPageFromScroll(){
    const vp = qs('#readerViewport');
    const imgs = qsa('.page-img', vp);
    let bestIndex = 1; let bestDelta = Infinity;
    const top = vp.scrollTop; const vh = vp.clientHeight;
    imgs.forEach(img => {
      const y = img.offsetTop; const delta = Math.abs(y - (top + vh*0.2));
      if(delta < bestDelta){ bestDelta = delta; bestIndex = Number(img.dataset.index); }
    });
    if(bestIndex !== READER.pageIndex){ READER.pageIndex = bestIndex; updateProgressLabel(); saveProgress(); }
    const nearEnd = (vp.scrollTop + vh) > (vp.scrollHeight - 40);
    if(nearEnd) markChapterRead(READER.id, READER.chapterIndex, true, false);
  }
  function saveProgress(){
    state.progress[READER.id] = { chapterIndex: READER.chapterIndex, page: READER.pageIndex };
    saveProg();
  }
  function markChapterRead(id, chapterIndex, set=true, notify=true){
    const setCh = new Set(state.read[id]||[]);
    if(set) setCh.add(chapterIndex); else setCh.delete(chapterIndex);
    state.read[id] = [...setCh]; saveRead(); renderProfile();
    if(notify){ toast(set ? 'Глава отмечена как прочитанная' : 'Снята отметка прочтения'); }
    if(qs('#page-detail').classList.contains('active')) openDetail(id);
  }
  function tryMarkEndAndSuggestNext(){
    const p = state.data.projects.find(x=>x.id===READER.id);
    markChapterRead(READER.id, READER.chapterIndex, true, false);
    if(p && READER.chapterIndex < (p.chapters||[]).length){
      toast('Глава завершена. Открываем следующую…');
      setTimeout(()=> openReader(READER.id, READER.chapterIndex + 1), 600);
    }
  }

  // ====== nav ======
  function goto(name){
    qsa('.page').forEach(p=>p.classList.remove('active'));
    const page = qs(`#page-${name}`); if(page) page.classList.add('active');
    qsa('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===name || (name==='detail' && b.dataset.tab==='catalog')));
    const container = qs('.container'); if(container) container.scrollTo({top:0, behavior:'auto'});
  }
  function bindTabs(){
    qsa('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      if(t==='favorites'){ goto('profile'); qs('#favRow').scrollIntoView({behavior:'smooth',block:'start'}); }
      else { goto(t); }
    }));
  }
});
