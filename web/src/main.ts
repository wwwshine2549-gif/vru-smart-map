import './scene3d/style.css';
import './app.css';
import { BLDGS, type Bld } from './catalog.ts';
import { CATS, ZONES, type ZoneNum } from './data/services.ts';
import { closePanel, esc, initPanel, openPanel, panelBuilding, type PanelOpt } from './panel.ts';
import { flyTo, goZone, initMap, onViewChange, setSelected, zoneAtView } from './map2d.ts';
import { popularTasks, search, type Hit } from './search.ts';

const $ = (id: string) => document.getElementById(id)!;
const isMobile = () => matchMedia('(max-width:760px)').matches;

// ---------- เลือกอาคาร ----------
function select(b: Bld, opt: PanelOpt = {}) {
  closeResults();
  $('list').classList.remove('on');
  setSelected(b);
  openPanel(b, opt);
  // รอให้ panel วางตัวก่อน แล้วค่อยคำนวณพื้นที่ที่ไม่ถูกบัง
  requestAnimationFrame(() => flyTo(b));
}
function deselect() {
  setSelected(null);
  closePanel();
}

initPanel({
  onClose: deselect,
  onFloor: () => {},
  onSelect: (b) => select(b),
});

initMap($('map2d'), $('tags2d'), { onPick: (b) => select(b), onEmpty: () => { closeResults(); } }, () => {
  const top = $('top').getBoundingClientRect().bottom + 8;
  const open = !!panelBuilding();
  const p = $('panel');
  return {
    top,
    left: 0,
    right: open && !isMobile() ? p.offsetWidth + 24 : 0,
    bottom: open && isMobile() ? p.offsetHeight : 0,
  };
});

// ---------- โซน ----------
let curZone = 0;
onViewChange(() => {
  const z = zoneAtView();
  if (z === curZone) return;
  curZone = z;
  document.querySelectorAll<HTMLElement>('.zbtn').forEach((b) => b.classList.toggle('on', Number(b.dataset.z) === z));
});
document.querySelectorAll<HTMLElement>('.zbtn').forEach((btn) => (btn.onclick = () => goZone(Number(btn.dataset.z) as ZoneNum)));

// ---------- ค้นหา ----------
const q = $('q') as HTMLInputElement, res = $('results');
let hits: Hit[] = [], act = 0;
const IC = {
  room: '<svg viewBox="0 0 24 24"><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17"/><path d="M3 21h18"/><circle cx="15" cy="12" r="1"/></svg>',
  bld: '<svg viewBox="0 0 24 24"><path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/></svg>',
  task: '<svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg>',
};
const closeResults = () => res.classList.remove('on');

function quickTasks() {
  hits = popularTasks();
  res.innerHTML = `<div class="rh">ทำเรื่องอะไร? · งานยอดฮิต</div><div class="qt">${hits.map((h, i) => `<button data-i="${i}">${esc(h.type === 'task' ? h.t.l : '')}</button>`).join('')}</div>`;
  res.classList.add('on');
  res.querySelectorAll<HTMLElement>('.qt button').forEach((btn) => (btn.onclick = () => { q.blur(); pick(hits[Number(btn.dataset.i)]); }));
}
function doSearch() {
  if (!q.value.trim()) { if (document.activeElement === q) quickTasks(); else closeResults(); return; }
  hits = search(q.value);
  act = 0;
  renderRes();
}
function renderRes() {
  let html = '', last = '';
  hits.forEach((h, i) => {
    const T = h.type;
    if (T !== last) { html += `<div class="rh">${T === 'room' ? 'ห้อง · ROOM' : T === 'task' ? 'บริการ · ทำเรื่องอะไร' : 'อาคาร · BUILDING'}</div>`; last = T; }
    const bn = `${h.b.code} ${esc(h.b.name)}`, a = i === act ? ' act' : '';
    if (h.type === 'task') html += `<div class="res task${a}" data-i="${i}"><span class="ico">${IC.task}</span><span>${esc(h.t.l)}<span class="sub">${esc(h.t.u?.n ?? '')} · ${h.t.f ? 'ชั้น ' + h.t.f : 'ไม่ระบุชั้น'} · ${bn}</span></span></div>`;
    else if (h.type === 'room') html += `<div class="res room${a}" data-i="${i}"><span class="ico">${IC.room}</span><span>ห้อง <b class="mono">${esc(h.r.roomNumber)}</b> · ชั้น ${h.r.floor}${h.r.inferred || !h.r.room?.verified ? ' <span class="pend">รอตรวจสอบ</span>' : ''}<span class="sub">${bn} · ${ZONES[h.b.zone].short}</span></span></div>`;
    else html += `<div class="res${a}" data-i="${i}"><span class="ico">${IC.bld}</span><span class="n">${h.b.code}</span>${esc(h.b.name)}<span class="z">${ZONES[h.b.zone].short}</span></div>`;
  });
  res.innerHTML = html || '<div class="res empty">ไม่พบ — ลองพิมพ์สิ่งที่จะไปทำ เช่น จ่ายค่าเทอม, กยศ, ปริ้นงาน หรือเลขห้อง เช่น 15-409</div>';
  res.classList.add('on');
  res.querySelectorAll<HTMLElement>('.res[data-i]').forEach((el) => (el.onclick = () => { pick(hits[Number(el.dataset.i)]); q.blur(); }));
}
function pick(h?: Hit) {
  if (!h) return;
  if (h.type === 'task') select(h.b, { task: h.t });
  else if (h.type === 'room') select(h.b, { room: h.r });
  else select(h.b);
}
q.addEventListener('input', doSearch);
q.addEventListener('focus', doSearch);
q.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { act = Math.min(act + 1, hits.length - 1); renderRes(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { act = Math.max(act - 1, 0); renderRes(); e.preventDefault(); }
  else if (e.key === 'Enter' && hits[act]) { pick(hits[act]); q.blur(); }
  else if (e.key === 'Escape') { closeResults(); q.blur(); }
});
document.addEventListener('pointerdown', (e) => { if (!(e.target as Element).closest('.search')) closeResults(); });
addEventListener('keydown', (e) => {
  if (e.target === q) return;
  if (e.key === '/') { e.preventDefault(); q.focus(); }
  else if (e.key === 'Escape') { $('list').classList.remove('on'); deselect(); }
});

// ---------- รายการอาคาร ----------
$('tList').onclick = () => $('list').classList.add('on');
$('lClose').onclick = () => $('list').classList.remove('on');
$('list').addEventListener('click', (e) => { if ((e.target as Element).id === 'list') $('list').classList.remove('on'); });
$('listBody').innerHTML = ([1, 2, 3] as ZoneNum[]).map((z) =>
  `<div class="zone-h">ZONE 0${z} · ${ZONES[z].name}</div>` +
  BLDGS.filter((b) => b.zone === z).map((b) => `<div class="li" data-n="${b.num}"><span class="n">${b.code}</span><span class="d" style="background:${CATS[b.cat].c}"></span>${esc(b.name)}</div>`).join('')).join('');
$('listBody').querySelectorAll<HTMLElement>('.li').forEach((el) => (el.onclick = () => select(BLDGS.find((b) => b.num === Number(el.dataset.n))!)));
