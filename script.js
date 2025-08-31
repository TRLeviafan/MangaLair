// ===== THEME via Telegram WebApp =====
const tg = window.Telegram?.WebApp;
if (tg) {
tg.ready(); tg.expand();
try {
const tp = tg.themeParams || {};
if(tp.bg_color) document.documentElement.style.setProperty('--bg', tp.bg_color);
if(tp.text_color) document.documentElement.style.setProperty('--text', tp.text_color);
if(tp.button_color) document.documentElement.style.setProperty('--accent', tp.button_color);
} catch(_){}
}


// ===== DATA (demo) =====
const MANGA = [
{ id:'luna', title:'Лунный город', desc:'Таинственный город, где луна освещает путь.', chapters: 12 },
{ id:'dawn', title:'Сады рассвета', desc:'История о поиске света.', chapters: 9 },
{ id:'desert', title:'Песочный мир', desc:'Приключения в багровых дюнах.', chapters: 14 },
{ id:'troll', title:'Березовая тропа', desc:'Дорога через северные леса.', chapters: 8 },
{ id:'sky', title:'Опаловая сказка', desc:'Небеса в оттенках опала.', chapters: 6 },
{ id:'star', title:'Звезда за холмом', desc:'Одна звезда — тысяча дорог.', chapters: 10 },
];


const qs = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];


// simple helpers for placeholder covers
const coverUrl = (title) => `https://placehold.co/600x800/png?text=${encodeURIComponent(title)}`;


// ===== STATE & STORAGE =====
const STORAGE_KEYS = { fav:'manga:fav', read:'manga:read', time:'manga:time' };
const state = {
favorites: new Set(JSON.parse(localStorage.getItem(STORAGE_KEYS.fav) || '[]')),
read: JSON.parse(localStorage.getItem(STORAGE_KEYS.read) || '{}'), // {id:[1,2]}
time: Number(localStorage.getItem(STORAGE_KEYS.time) || '0'), // hours
currentId: null,
};
const saveFav = () => localStorage.setItem(STORAGE_KEYS.fav, JSON.stringify([...state.favorites]));
const saveRead = () => localStorage.setItem(STORAGE_KEYS.read, JSON.stringify(state.read));
const saveTime = () => localStorage.setItem(STORAGE_KEYS.time, String(state.time));


// ===== RENDER CATALOG =====
function renderCatalog(){
const grid = qs('#catalogGrid');
grid.innerHTML = '';
MANGA.forEach(m => {
const card = document.createElement('div');
card.className = 'card';
card.innerHTML = `<img class="cover" loading="lazy" src="${coverUrl(m.title)}" alt="${m.title}"><div class="title">${m.title}</div>`;
card.onclick = () => openDetail(m.id);
grid.appendChild(card);
});
}


// ===== RENDER PROFILE =====
function renderProfile(){
const totalRead = Object.values(state.read).reduce((a,arr)=>a+arr.length,0);
qs('#stChapters').textContent = totalRead;
qs('#stFav').textContent = state.favorites.size;
qs('#stTime').textContent = state.time + ' ч';
const favRow = qs('#favRow');
favRow.innerHTML = '';
[...state.favorites].map(id => MANGA.find(m=>m.id===id)).filter(Boolean).forEach(m => {
const el = document.createElement('div');
el.className = 'fav-card';
el.innerHTML = `<img src="${coverUrl(m.title)}" alt="${m.title}"><div class="t">${m.title}</div>`;
el.onclick = () => openDetail(m.id);
favRow.appendChild(el);
});
}


// ===== RENDER DETAIL =====
function openDetail(id){
state.currentId = id;
const m = MANGA.find(x=>x.id===id); if(!m) return;
qs('#dCover').src = coverUrl(m.title);
qs('#dTitle').textContent = m.title;
qs('#dDesc').textContent = m.desc;
const btnFav = qs('#btnFav');
setFavButton(btnFav, state.favorites.has(id));
btnFav.onclick = () => toggleFavorite(id);


const ch = qs('#chapters'); ch.innerHTML = '';
for(let i=1;i<=m.chapters;i++){
const it = document.createElement('div');
it.className = 'ch-item';
const read = (state.read[id]||[]).includes(i);
it.innerHTML = `<div>${read ? '✔️ ' : ''}Глава ${i}</div><div class="arrow">›</div>`;
it.onclick = () => toggleRead(id, i, it);
ch.appendChild(it);
}
goto('detail');
}


function setFavButton(btn, isFav){
btn.textContent = isFav ? 'В избранном' : 'Избранное';
btn.className = 'btn ' + (isFav ? 'ghost' : 'ghost');
}


function toggleFavorite(id){
if(state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
saveFav();
setFavButton(qs('#btnFav'), state.favorites.has(id));
renderProfile();
}


function toggleRead(id, chapter, el){
const set = new Set(state.read[id]||[]);
if(set.has(chapter)) set.delete(chapter); else set.add(chapter);
state.read[id] = [...set];
saveRead();
// update UI & stats
if(el) el.querySelector('div').innerHTML = `${set.has(chapter)?'✔️ ':''}Глава ${chapter}`;
renderProfile();
}


// ===== TABS / NAV =====
function goto(name){
qsa('.page').forEach(p=>p.classList.remove('active'));
qs(`#page-${name}`).classList.add('active');
renderProfile();
