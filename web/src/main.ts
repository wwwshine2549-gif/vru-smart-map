import './scene3d/style.css';
import './app.css';
import { BLDGS, byCode, byNum, findBuilding, findRoomExact, findRooms, type Bld } from './catalog.ts';
import { CATS, ZONES, type ZoneNum } from './data/services.ts';
import { closePanel, esc, initPanel, openPanel, panelBuilding, toast, type PanelOpt } from './panel.ts';
import { flyTo, goZone, initMap, onViewChange, setSelected, zoneAtView } from './map2d.ts';
import { popularTasks, search, type Hit } from './search.ts';

const $ = (id: string) => document.getElementById(id)!;
const isMobile = () => matchMedia('(max-width:760px)').matches;

// ---------- มุมมอง 3D (lazy-load: three.js โหลดเมื่อกดครั้งแรกเท่านั้น) ----------
/** API ของ scene3d/app.ts (ไฟล์นั้นยังเป็น @ts-nocheck จึงประกาศ type ไว้ที่นี่) */
interface Scene3D {
  setHooks(h: { pick(code: string): void; closed(): void; insets(): { top: number; right: number; bottom: number } }): void;
  focus(code: string, floor?: number | null): void;
  setFloorOf(code: string, floor: number | null): void;
  clear(): void;
  goZone(z: ZoneNum): void;
  setActive(on: boolean): void;
}
let scene3d: Scene3D | null = null, loading3d: Promise<Scene3D | null> | null = null, is3d = false;
let curFloor: number | null = null;

function load3d() {
  loading3d ??= import('./scene3d/app.ts').then((mod) => {
    const m = mod as unknown as Scene3D;
    m.setHooks({ pick: (code: string) => { const b = byCode.get(code); if (b) select(b); }, closed: () => deselect(true), insets: panelInsets });
    return (scene3d = m);
  }).catch((err) => {
    console.error(err);
    loading3d = null;
    toast('โหลดหุ่นจำลอง 3D ไม่สำเร็จ ลองใหม่อีกครั้ง');
    setView(false);
    return null;
  });
  return loading3d;
}
async function setView(three: boolean) {
  is3d = three;
  document.body.classList.toggle('mode3d', three);
  document.body.classList.toggle('mode2d', !three);
  $('tViewT').textContent = three ? '2D' : '3D';
  $('tView').title = $('pView').title = three ? 'แผนผัง 2D' : 'มุมมอง 3D';
  if (!three) {
    scene3d?.setActive(false);
    const b = panelBuilding();
    if (b) requestAnimationFrame(() => flyTo(b));
    return;
  }
  const m = await load3d();
  if (!m || !is3d) return;
  m.setActive(true);
  const b = panelBuilding();
  if (b) m.focus(b.code, curFloor);
}
$('tView').onclick = () => setView(!is3d);
$('pView').onclick = () => setView(!is3d);

// ---------- เลือกอาคาร ----------
function select(b: Bld, opt: PanelOpt = {}) {
  closeResults();
  $('list').classList.remove('on');
  setSelected(b);
  openPanel(b, opt);
  curFloor = opt.room?.floor ?? opt.task?.f ?? opt.floor ?? null;
  setUrl(opt.room ? { r: opt.room.roomNumber } : { b: b.code });
  if (is3d && scene3d) scene3d.focus(b.code, curFloor || null);
  // รอให้ panel วางตัวก่อน แล้วค่อยคำนวณพื้นที่ที่ไม่ถูกบัง
  else requestAnimationFrame(() => flyTo(b));
}
/** from3d = ฉาก 3D กลับสู่เส้นทางบินเอง (ไม่ต้องสั่งกลับ) */
function deselect(from3d = false) {
  if (!panelBuilding()) return;
  setSelected(null);
  closePanel();
  setUrl({});
  curFloor = null;
  if (!from3d) scene3d?.clear();
}

// ---------- ลิงก์ตรง: ?b=B08, ?r=15-409 และ #b8 แบบเดิมของ v0.5 ----------
function setUrl(p: { b?: string; r?: string }) {
  const u = new URL(location.href);
  u.searchParams.delete('b'); u.searchParams.delete('r'); u.hash = '';
  if (p.b) u.searchParams.set('b', p.b);
  if (p.r) u.searchParams.set('r', p.r);
  try { history.replaceState(null, '', u); } catch { /* file:// */ }
}
function openFromUrl(): boolean {
  const sp = new URLSearchParams(location.search);
  const r = sp.get('r'), bq = sp.get('b');
  const hm = location.hash.match(/^#b(\d+)$/i);
  if (r) {
    const hit = findRoomExact(r) ?? findRooms(r, 1)[0];
    if (hit) { select(hit.b, { room: hit }); return true; }
    toast(`ไม่พบห้อง ${r} ในข้อมูล`);
  }
  const b = bq ? findBuilding(bq) : hm ? byNum.get(Number(hm[1])) : undefined;
  if (b) { select(b); return true; }
  if (bq || hm) toast(`ไม่พบอาคาร ${bq ?? location.hash}`);
  return false;
}
addEventListener('hashchange', () => {
  const m = location.hash.match(/^#b(\d+)$/i);
  if (m && panelBuilding()?.num !== Number(m[1])) openFromUrl();
});

initPanel({
  onClose: () => deselect(),
  onFloor: (b, f) => { curFloor = f; scene3d?.setFloorOf(b.code, f); },
  onSelect: (b) => select(b),
});

/** พื้นที่ที่แถบค้นหาและ panel บังอยู่ (px) — ใช้วางอาคารที่เลือกให้อยู่ในช่องที่มองเห็น ทั้ง 2D และ 3D */
function panelInsets() {
  const top = $('top').getBoundingClientRect().bottom + 8;
  const open = !!panelBuilding();
  const p = $('panel');
  return {
    top,
    left: 0,
    right: open && !isMobile() ? p.offsetWidth + 24 : 0,
    bottom: open && isMobile() ? p.offsetHeight : 0,
  };
}
initMap($('map2d'), $('tags2d'), { onPick: (b) => select(b), onEmpty: () => { closeResults(); } }, panelInsets);

// ---------- โซน ----------
let curZone = 0;
onViewChange(() => {
  if (is3d) return;
  const z = zoneAtView();
  if (z === curZone) return;
  curZone = z;
  document.querySelectorAll<HTMLElement>('.zbtn').forEach((b) => b.classList.toggle('on', Number(b.dataset.z) === z));
});
document.querySelectorAll<HTMLElement>('.zbtn').forEach((btn) => (btn.onclick = () => {
  const z = Number(btn.dataset.z) as ZoneNum;
  if (is3d && scene3d) scene3d.goZone(z); else goZone(z);
}));

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
$('listBody').querySelectorAll<HTMLElement>('.li').forEach((el) => (el.onclick = () => select(byNum.get(Number(el.dataset.n))!)));

openFromUrl();
