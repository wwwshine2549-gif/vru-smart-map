/**
 * แผนผัง 2D (SVG) วาดจาก plan.json — หน้าแรกที่โหลดเร็ว ไม่พึ่ง three.js
 * พิกัดทั้งหมดเป็น pt ของ PDF แผนผัง: x → ตะวันออก, y → ใต้ (ห่างจากถนนพหลโยธิน)
 * ป้ายชื่อและจุดบริการเป็น HTML ทับบน SVG (คลาส .tag / .svcpin เดียวกับฉาก 3D)
 */
import { BLDGS, MAP, byNum, type Bld, type Pt } from './catalog.ts';
import { CATS, ZONE_Y, type ZoneNum } from './data/services.ts';

export type LayerName = 'buildings' | 'labels' | 'zones' | 'services' | 'trees';

const NS = 'http://www.w3.org/2000/svg';
/** ขอบเขตแผนผัง (pt) เดียวกับมินิแมปของ v0.5 */
const BOUNDS = { x0: 54, y0: 117, x1: 621, y1: 2106 };
const ZONE_CENTER: Record<ZoneNum, number> = { 1: 420, 2: 1010, 3: 1760 };
const ZONE_SPAN: Record<ZoneNum, [number, number]> = { 1: [117, ZONE_Y[0]], 2: [ZONE_Y[0], ZONE_Y[1]], 3: [ZONE_Y[1], BOUNDS.y1] };
const NAME_SCALE = 1.35; // px ต่อ pt ที่เริ่มแสดงชื่ออาคารเต็ม

interface Handlers { onPick(b: Bld): void; onEmpty(): void }
interface Insets { top: number; right: number; bottom: number; left: number }

let svg: SVGSVGElement, host: HTMLElement, tagsEl: HTMLElement;
let W = 0, H = 0;
const view = { x: 337, y: 400, s: 1 };
let anim: { from: typeof view; to: typeof view; t0: number; d: number } | null = null;
let selected: Bld | null = null;
let h: Handlers;
let insets: () => Insets = () => ({ top: 0, right: 0, bottom: 0, left: 0 });
const layers: Record<LayerName, boolean> = { buildings: true, labels: true, zones: true, services: true, trees: true };
const tags = new Map<number, HTMLElement>();
const pins: { b: Bld; el: HTMLElement }[] = [];
const bldEls = new Map<number, SVGGElement>();
let dirty = true;

const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
};
const pts = (p: Pt[]) => p.map(([x, y]) => `${x},${y}`).join(' ');
const short = (n: string) => n.replace(/^อาคาร/, '').replace(/\s*\(.*?\)/, (m) => (m.length > 14 ? '' : m)).trim();

export function initMap(container: HTMLElement, tagLayer: HTMLElement, handlers: Handlers, getInsets: () => Insets) {
  host = container; tagsEl = tagLayer; h = handlers; insets = getInsets;
  svg = el('svg', { id: 'svg2d', 'aria-label': 'แผนผังมหาวิทยาลัย' }) as SVGSVGElement;
  host.appendChild(svg);
  draw();
  resize();
  Object.assign(view, zoneView(1));
  clampView(view);
  bindInput();
  addEventListener('resize', () => { resize(); dirty = true; });
  requestAnimationFrame(loop);
}

function draw() {
  const g = (id: string) => el('g', { id }, svg);
  const ground = g('m-ground');
  el('rect', { x: -900, y: -700, width: 2500, height: 3500, class: 'm-out' }, ground);
  el('rect', { x: 55, y: 215, width: 565, height: 1890, class: 'm-campus' }, ground);
  el('rect', { x: -900, y: 137, width: 2500, height: 78, class: 'm-hwy' }, ground);
  for (const p of MAP.field) el('polygon', { points: pts(p), class: 'm-field' }, ground);
  for (const p of MAP.garden) el('polygon', { points: pts(p), class: 'm-garden' }, ground);
  for (const p of MAP.forest) el('polygon', { points: pts(p), class: 'm-forest' }, ground);
  for (const p of MAP.parking) el('polygon', { points: pts(p), class: 'm-park' }, ground);
  for (const p of MAP.water) el('polygon', { points: pts(p), class: 'm-water' }, ground);
  for (const [x, y, w, hh] of MAP.courts) el('rect', { x, y, width: w, height: hh, class: 'm-court' }, ground);
  const st = MAP.stadium;
  el('ellipse', { cx: st.cx, cy: st.cy, rx: st.L / 2, ry: st.W / 2, class: 'm-track' }, ground);
  el('ellipse', { cx: st.cx, cy: st.cy, rx: st.L / 2 - 14, ry: st.W / 2 - 14, class: 'm-pitch' }, ground);
  const roads = el('g', { class: 'm-roads' }, ground);
  for (const [w, p] of MAP.roads) el('polyline', { points: pts(p), 'stroke-width': Math.max(w, 3) }, roads);

  const zones = g('m-zones');
  for (const z of [1, 2, 3] as ZoneNum[]) {
    const [a, b] = ZONE_SPAN[z];
    el('rect', { x: 55, y: Math.max(a, 215), width: 565, height: b - Math.max(a, 215), class: `m-zone z${z}` }, zones);
  }
  for (const y of ZONE_Y) el('line', { x1: 40, x2: 635, y1: y, y2: y, class: 'm-zline' }, zones);

  // ต้นไม้: path เดียว (เบากว่า circle 1,000 กว่าวง)
  const trees = g('m-trees');
  const d = MAP.trees.map(([x, y, s]) => { const r = 2.6 * s; return `M${x - r},${y}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`; }).join('');
  el('path', { d, class: 'm-tree' }, trees);

  const blds = g('m-blds');
  for (const b of BLDGS) {
    const gb = el('g', { class: 'm-b', 'data-n': b.num, style: `--c:${CATS[b.cat].c}` }, blds) as SVGGElement;
    el('title', {}, gb).textContent = `${b.code} ${b.name}`;
    for (const [x, y, w, hh, , rot] of b.rects) {
      el('rect', { x, y, width: w, height: hh, ...(rot ? { transform: `rotate(${rot} ${x + w / 2} ${y + hh / 2})` } : {}) }, gb);
    }
    bldEls.set(b.num, gb);
  }

  for (const b of BLDGS) {
    const t = document.createElement('div');
    t.className = 'tag';
    t.style.setProperty('--c', CATS[b.cat].c);
    t.innerHTML = `<i></i>${b.code[0]==='U'?b.code:b.code.slice(1)}<span>${short(b.name)}</span>`;
    t.addEventListener('click', (e) => { e.stopPropagation(); h.onPick(b); });
    tagsEl.appendChild(t);
    tags.set(b.num, t);
    if (b.web || b.services.length) {
      const p = document.createElement('div');
      p.className = 'svcpin';
      p.title = 'มีข้อมูลบริการ: ' + b.name;
      p.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 11v6"/><path d="M12 7h.01"/></svg>';
      p.addEventListener('click', (e) => { e.stopPropagation(); h.onPick(b); });
      tagsEl.appendChild(p);
      pins.push({ b, el: p });
    }
  }
}

function resize() {
  const r = host.getBoundingClientRect();
  W = r.width; H = r.height;
}

const minScale = () => Math.min(W / (BOUNDS.x1 - BOUNDS.x0 + 40), H / (BOUNDS.y1 - BOUNDS.y0 + 40));
function clampView(v: typeof view) {
  v.s = Math.min(8, Math.max(minScale(), v.s));
  // เผื่อขอบ (px บนจอ) ให้เลื่อนอาคารริมแผนผังออกมาพ้นแถบค้นหา / panel ได้
  const i = insets();
  const hw = W / 2 / v.s, hh = H / 2 / v.s;
  const sx0 = (40 + i.left) / v.s, sx1 = (40 + i.right) / v.s, sy0 = (40 + i.top) / v.s, sy1 = (40 + i.bottom) / v.s;
  v.x = Math.min(BOUNDS.x1 + sx1 - hw, Math.max(BOUNDS.x0 - sx0 + hw, v.x));
  v.y = Math.min(BOUNDS.y1 + sy1 - hh, Math.max(BOUNDS.y0 - sy0 + hh, v.y));
  if (BOUNDS.x1 - BOUNDS.x0 + sx0 + sx1 <= hw * 2) v.x = (BOUNDS.x0 - sx0 + BOUNDS.x1 + sx1) / 2;
  if (BOUNDS.y1 - BOUNDS.y0 + sy0 + sy1 <= hh * 2) v.y = (BOUNDS.y0 - sy0 + BOUNDS.y1 + sy1) / 2;
}

const toWorld = (sx: number, sy: number) => ({ x: view.x + (sx - W / 2) / view.s, y: view.y + (sy - H / 2) / view.s });
const toScreen = (x: number, y: number) => ({ x: (x - view.x) * view.s + W / 2, y: (y - view.y) * view.s + H / 2 });

function zoomAt(sx: number, sy: number, factor: number) {
  const w = toWorld(sx, sy);
  view.s *= factor;
  clampView(view);
  view.x = w.x - (sx - W / 2) / view.s;
  view.y = w.y - (sy - H / 2) / view.s;
  clampView(view);
  dirty = true;
}

function bindInput() {
  const ptrs = new Map<number, { x: number; y: number }>();
  let start: { x: number; y: number; t: number; target: EventTarget | null; moved: boolean } | null = null;
  let pinch: { d: number; mx: number; my: number } | null = null;
  const local = (e: PointerEvent | WheelEvent) => { const r = svg.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  svg.addEventListener('pointerdown', (e) => {
    svg.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, local(e));
    anim = null;
    if (ptrs.size === 1) start = { ...local(e), t: performance.now(), target: e.target, moved: false };
    else { start && (start.moved = true); pinch = null; }
  });
  svg.addEventListener('pointermove', (e) => {
    const prev = ptrs.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    ptrs.set(e.pointerId, p);
    if (ptrs.size === 1) {
      if (start && Math.hypot(p.x - start.x, p.y - start.y) > 6) start.moved = true;
      if (start?.moved) { view.x -= (p.x - prev.x) / view.s; view.y -= (p.y - prev.y) / view.s; clampView(view); dirty = true; }
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch) {
        view.x -= (mx - pinch.mx) / view.s; view.y -= (my - pinch.my) / view.s;
        zoomAt(mx, my, d / pinch.d);
      }
      pinch = { d, mx, my };
    }
  });
  const end = (e: PointerEvent) => {
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0 && start && !start.moved && performance.now() - start.t < 600) {
      const g = (start.target as Element | null)?.closest?.('.m-b') as SVGGElement | null;
      const b = g && byNum.get(Number(g.dataset.n));
      if (b) h.onPick(b); else h.onEmpty();
    }
    if (ptrs.size === 0) start = null;
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = local(e);
    anim = null;
    zoomAt(p.x, p.y, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
  }, { passive: false });
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function animateTo(to: typeof view, d = 650) {
  clampView(to);
  anim = { from: { ...view }, to, t0: performance.now(), d };
}

/** วางจุด (x,y) ไว้กลางพื้นที่ที่ไม่ถูก panel / แถบค้นหาบัง */
function viewFor(x: number, y: number, s: number) {
  const i = insets();
  const sx = i.left + (W - i.left - i.right) / 2, sy = i.top + (H - i.top - i.bottom) / 2;
  return { x: x - (sx - W / 2) / s, y: y - (sy - H / 2) / s, s };
}

export function flyTo(b: Bld) {
  const i = insets();
  const aw = W - i.left - i.right, ah = H - i.top - i.bottom;
  const s = Math.min(2.6, Math.max(1.4, Math.min(aw / (b.w + 160), ah / (b.h + 160))));
  animateTo(viewFor(b.cx, b.cy, s));
}

function zoneView(z: ZoneNum) {
  const [a, b] = ZONE_SPAN[z];
  const i = insets();
  const s = Math.min((W - i.left - i.right) / 580, (H - i.top - i.bottom) / (b - a + 40));
  return viewFor(337, ZONE_CENTER[z], s);
}
export const goZone = (z: ZoneNum) => animateTo(zoneView(z));

export function setSelected(b: Bld | null) {
  if (selected) bldEls.get(selected.num)?.classList.remove('sel');
  selected = b;
  if (b) bldEls.get(b.num)?.classList.add('sel');
  dirty = true;
}

export function setLayer(name: LayerName, on: boolean) {
  layers[name] = on;
  const id = { buildings: 'm-blds', zones: 'm-zones', trees: 'm-trees' } as Record<string, string>;
  if (id[name]) svg.querySelector('#' + id[name])!.classList.toggle('off', !on);
  dirty = true;
}

export const zoneAtView = (): ZoneNum => {
  const i = insets();
  const y = toWorld(W / 2, i.top + (H - i.top - i.bottom) / 2).y;
  return y < ZONE_Y[0] ? 1 : y < ZONE_Y[1] ? 2 : 3;
};
let onView: (() => void) | null = null;
export const onViewChange = (fn: () => void) => { onView = fn; };

function loop(now: number) {
  requestAnimationFrame(loop);
  if (anim) {
    const k = Math.min(1, (now - anim.t0) / anim.d), e = ease(k);
    // ซูมแบบ log ให้ความเร็วดูสม่ำเสมอ
    view.s = Math.exp(Math.log(anim.from.s) + (Math.log(anim.to.s) - Math.log(anim.from.s)) * e);
    view.x = anim.from.x + (anim.to.x - anim.from.x) * e;
    view.y = anim.from.y + (anim.to.y - anim.from.y) * e;
    if (k >= 1) anim = null;
    dirty = true;
  }
  if (!dirty) return;
  dirty = false;
  svg.setAttribute('viewBox', `${view.x - W / 2 / view.s} ${view.y - H / 2 / view.s} ${W / view.s} ${H / view.s}`);
  placeTags();
  onView?.();
}

/** ป้ายชื่อ: เรียงความสำคัญ แล้วซ่อนป้ายที่ทับกัน */
function placeTags() {
  const near = view.s >= NAME_SCALE;
  const boxes: [number, number, number, number][] = [];
  const order = [...BLDGS].sort((a, b) => prio(b) - prio(a));
  for (const b of order) {
    const t = tags.get(b.num)!;
    const p = toScreen(b.cx, b.cy - b.h / 2);
    const isSel = selected === b;
    const show = (layers.labels && layers.buildings) || isSel;
    const wpx = near || isSel ? 30 + short(b.name).length * 6.2 : 34;
    const box: [number, number, number, number] = [p.x - wpx / 2, p.y - 30, p.x + wpx / 2, p.y - 6];
    const off = p.x < -60 || p.x > W + 60 || p.y < -20 || p.y > H + 40;
    const hit = !isSel && boxes.some((o) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1]);
    if (!show || off || hit) { t.classList.add('hide'); continue; }
    boxes.push(box);
    t.classList.remove('hide');
    t.classList.toggle('near', near || isSel);
    t.classList.toggle('sel', isSel);
    t.style.transform = `translate(${p.x}px,${p.y}px) translate(-50%,calc(-100% - 6px))`;
  }
  for (const { b, el: pe } of pins) {
    const p = toScreen(b.cx + b.w / 2, b.cy - b.h / 2);
    const hide = !layers.services || p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30;
    pe.classList.toggle('hide', hide);
    if (!hide) pe.style.transform = `translate(${p.x - 13}px,${p.y - 13}px)`;
  }
}
const prio = (b: Bld) => (selected === b ? 1e9 : 0) + (b.web ? 5e5 : 0) + (b.cat === 'landmark' ? 3e5 : 0) + b.w * b.h;

