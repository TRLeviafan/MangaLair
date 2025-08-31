// Manga MiniApp — v1 (перепроверено, разделено на файлы)
// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  // Поддержка Telegram WebApp (безопасно, если открыто в браузере)
  const tg = window.Telegram?.WebApp;
  if (tg) { try { tg.ready(); tg.expand(); } catch(e){} }

  // ====== ДАННЫЕ (демо) ======
  const MANGA = [
    { id:'luna',   title:'Лунный город',    desc:'Таинственный город, где луна освещает путь.', chapters: 12 },
    { id:'dawn',   title:'Сады рассвета',   desc:'История о поиске света.',                     chapters: 9  },
    { id:'desert', title:'Песочный мир',    desc:'Приключения в багровых дюнах.',               chapters: 14 },
    { id:'troll',  title:'Березовая тропа', desc:'Дорога через северные леса.',                 chapters: 8  },
    { id:'sky',    title:'Опаловая сказка', desc:'Небеса в оттенках опала.',                    chapters: 6  },
    { id:'star',   title:'Звезда за холмом',desc:'Одна звезда — тысяча дорог.',                 chapters: 10 },
  ];
  const coverUrl = (title) => `https://placehold.co/600x800/png?text=${encodeURIComponent(title)}`;
  const pageUrl  = (id, chapter, i) => `https://placehold.co/900x1300/png?text=${encodeURIComponent(id)}+Ch${chapter}+P${i}`;

  // ====== СОСТОЯНИЕ ======
  const K = { fav:'manga:fav', read:'manga:read', time:'manga:time', progress:'manga:progress' };
  const state = {
    favorites: new Set(JSON.parse(localStorage.getItem(K.fav) || '[]')),
    read: JSON.parse(localStorage.getItem(K.read) || '{}'),            // {id:[1,2]}
    time: Number(localStorage.getItem(K.time) || '0'),
    progress: JSON.parse(localStorage.getItem(K.progress) || '{}'),    // {id:{chapter:number,page:number}}
    currentId: null,
  };
  const saveFav = () => localStorage.setItem(K.fav, JSON.stringify([...state.favorites]));
  const saveRead = () => localStorage.setItem(K.read, JSON.stringify(state.read));
  const saveProg = () => localStorage.setItem(K.progress, JSON.stringify(state.progress));

  // ====== УТИЛИТЫ ======
  const qs  = (s, r=document) => r.querySelector(s);
  const qsa = (s, r=document) => [...r.querySelectorAll(s)];
  const throttle = (fn, ms)=>{ let t=0; return (...a)=>{ const now=Date.now(); if(now-t>ms){ t=now; fn(...a); } } };
  const toast = (text)=>{
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style,{position:'fixed',left:'50%',bottom:'calc(90px + var(--safe-bottom))',transform:'translateX(-50%)',background:'rgba(23,26,34,.95)',border:'1px solid var(--stroke)',color:'var(--text)',padding:'10px 14px',borderRadius:'12px',zIndex:40});
    document.body.appendChild(el); setTimeout(()=> el.remove(), 1500);
  };

  // ====== КАТАЛОГ ======
  function renderCatalog(){
    const grid = qs('#catalogGrid'); grid.innerHTML = '';
    MANGA.forEach(m => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<img class="cover" loading="lazy" src="${coverUrl(m.title)}" alt="${m.title}"><div class="title">${m.title}</div>`;
      card.onclick = () => openDetail(m.id);
      grid.appendChild(card);
    });
  }

  // ====== ПРОФИЛЬ ======
  function renderProfile(){
    const totalRead = Object.values(state.read).reduce((a,arr)=>a+arr.length,0);
    qs('#stChapters').textContent = totalRead;
    qs('#stFav').textContent      = state.favorites.size;
    qs('#stTime').textContent     = state.time + ' ч';
    const favRow = qs('#favRow'); favRow.innerHTML = '';
    [...state.favorites]
      .map(id => MANGA.find(m=>m.id===id)).filter(Boolean)
      .forEach(m => {
        const el = document.createElement('div');
        el.className = 'fav-card';
        el.innerHTML = `<img src="${coverUrl(m.title)}" alt="${m.title}"><div class="t">${m.title}</div>`;
        el.onclick = () => openDetail(m.id);
        favRow.appendChild(el);
      });
  }

  // ====== ДЕТАЛКА ======
  function setFavButton(btn, isFav){
    btn.textContent = isFav ? 'В избранном' : 'Избранное';
    btn.className = 'btn ghost';
  }
  function toggleFavorite(id){
    if(state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
    saveFav(); setFavButton(qs('#btnFav'), state.favorites.has(id)); renderProfile();
  }
  function openDetail(id){
    state.currentId = id; const m = MANGA.find(x=>x.id===id); if(!m) return;
    qs('#dCover').src = coverUrl(m.title);
    qs('#dTitle').textContent = m.title;
    qs('#dDesc').textContent  = m.desc;
    const btnFav = qs('#btnFav'); setFavButton(btnFav, state.favorites.has(id)); btnFav.onclick = () => toggleFavorite(id);
    const btnRead = qs('#btnRead'); btnRead.onclick = () => {
      const prog = state.progress[id];
      if(prog) openReader(id, prog.chapter);
      else {
        const setCh = new Set(state.read[id]||[]);
        let chapter = 1; for(let i=1;i<=m.chapters;i++){ if(!setCh.has(i)){ chapter = i; break; } }
        openReader(id, chapter);
      }
    };
    const ch = qs('#chapters'); ch.innerHTML = '';
    for(let i=1;i<=m.chapters;i++){
      const isRead = (state.read[id]||[]).includes(i);
      const it = document.createElement('div'); it.className = 'ch-item';
      it.innerHTML = `<div>${isRead ? '✔️ ' : ''}Глава ${i}</div><div class="arrow">›</div>`;
      it.onclick = () => openReader(id, i);
      ch.appendChild(it);
    }
    goto('detail');
  }

  // ====== РИДЕР ======
  const READER = { id:null, chapter:1, pages:[], pageIndex:1 };
  function openReader(id, chapter){
    const m = MANGA.find(x=>x.id===id); if(!m) return;
    READER.id = id; READER.chapter = chapter;
    const vp = qs('#readerViewport'); vp.innerHTML = '';
    const pageCount = Math.max(8, Math.min(18, 10 + (chapter%5)));
    READER.pages = Array.from({length:pageCount}, (_,i)=> pageUrl(id, chapter, i+1));
    READER.pages.forEach((src, i) => {
      const img = document.createElement('img');
      img.className = 'page-img'; img.loading = 'lazy'; img.src = src; img.dataset.index = String(i+1);
      vp.appendChild(img);
    });
    const prog = (state.progress[id] && state.progress[id].chapter === chapter) ? state.progress[id].page : 1;
    READER.pageIndex = Math.min(Math.max(1, prog), READER.pages.length);
    qs('#readerTitle').textContent = `${m.title} — Глава ${chapter}`;
    updateProgressLabel();
    // handlers
    qs('#btnBackDetail').onclick = () => { goto('detail'); openDetail(id); };
    qs('#btnPrev').onclick = () => jump(-1);
    qs('#btnNext').onclick = () => jump(1);
    qs('#btnMode').onclick = () => alert('Горизонтальный режим добавим позже.');
    qs('#btnMarkRead').onclick = () => { markChapterRead(id, chapter, true); };
    vp.onscroll = throttle(updateCurrentPageFromScroll, 120);
    goto('reader');
    // скроллим к сохранённой
    requestAnimationFrame(() => scrollToPage(READER.pageIndex, false));
  }
  function scrollToPage(index, smooth=true){
    const vp = qs('#readerViewport');
    const img = qs(`.page-img[data-index="${index}"]`, vp); if(!img) return;
    img.scrollIntoView({behavior: smooth ? 'smooth' : 'auto', block:'start'});
  }
  function updateProgressLabel(){
    qs('#readerProgress').textContent = `${READER.pageIndex} / ${READER.pages.length}`;
  }
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
    if(bestIndex !== READER.pageIndex){
      READER.pageIndex = bestIndex; updateProgressLabel(); saveProgress();
    }
    const nearEnd = (vp.scrollTop + vh) > (vp.scrollHeight - 40);
    if(nearEnd) markChapterRead(READER.id, READER.chapter, true, false);
  }
  function saveProgress(){
    state.progress[READER.id] = { chapter: READER.chapter, page: READER.pageIndex };
    saveProg();
  }
  function markChapterRead(id, chapter, set=true, notify=true){
    const setCh = new Set(state.read[id]||[]);
    if(set) setCh.add(chapter); else setCh.delete(chapter);
    state.read[id] = [...setCh]; saveRead(); renderProfile();
    if(notify){ toast(set ? 'Глава отмечена как прочитанная' : 'Снята отметка прочтения'); }
    if(qs('#page-detail').classList.contains('active')) openDetail(id);
  }
  function tryMarkEndAndSuggestNext(){
    const m = MANGA.find(x=>x.id===READER.id);
    markChapterRead(READER.id, READER.chapter, true, false);
    if(m && READER.chapter < m.chapters){
      toast('Глава завершена. Открываем следующую…');
      setTimeout(()=> openReader(READER.id, READER.chapter + 1), 600);
    }
  }

  // ====== НАВИГАЦИЯ ======
  function goto(name){
    qsa('.page').forEach(p=>p.classList.remove('active'));
    const page = qs(`#page-${name}`); if(page) page.classList.add('active');
    qsa('.tab-btn').forEach(b=>b.classList.toggle('active', b.dataset.tab===name || (name==='detail' && b.dataset.tab==='catalog')));
    const container = qs('.container'); if(container) container.scrollTo({top:0, behavior:'auto'});
  }
  qsa('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
    const t = btn.dataset.tab;
    if(t==='favorites'){ goto('profile'); qs('#favRow').scrollIntoView({behavior:'smooth',block:'start'}); }
    else { goto(t); }
  }));

  // ====== СТАРТ ======
  renderCatalog();
  renderProfile();
});
