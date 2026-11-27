/** Panel อาคาร (ใช้ร่วมกันทั้งหน้า 2D และฉาก 3D) — หน้าตาเดิมจาก v0.5 */
import { BLDGS, type Bld, type RoomHit } from './catalog.ts';
import { CATS, SRC, STLABEL, ZONES, type ServiceUnit, type Task } from './data/services.ts';
import type { FloorService, Room } from './types.ts';

export interface PanelOpt {
  room?: RoomHit;
  task?: Task;
  floor?: number | null;
}
interface Handlers {
  onClose(): void;
  onFloor(b: Bld, floor: number | null): void;
  onSelect(b: Bld): void;
}

const $ = (id: string) => document.getElementById(id)!;
export const esc = (t: unknown) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const PENDING = '<span class="pend">รอตรวจสอบ</span>';
const ORDER = BLDGS.map((b) => b.num);

let current: Bld | null = null;
let h: Handlers = { onClose() {}, onFloor() {}, onSelect() {} };

export const panelBuilding = () => current;
export const panelEl = () => $('panel');

export function initPanel(handlers: Handlers) {
  h = handlers;
  $('pClose').onclick = () => h.onClose();
  $('pPrev').onclick = () => { if (current) h.onSelect(step(-1)); };
  $('pNext').onclick = () => { if (current) h.onSelect(step(1)); };
  $('pCopy').onclick = async () => {
    if (!current) return;
    const url = linkFor(current);
    try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์ตรงแล้ว'); } catch { toast(url); }
  };
}
const step = (d: number) => {
  const i = ORDER.indexOf(current!.num);
  return BLDGS[(i + d + ORDER.length) % ORDER.length];
};

/** ลิงก์ตรงของอาคาร (ใช้ทำ QR) */
export const linkFor = (b: Bld, room?: string) =>
  location.origin + location.pathname + (room ? `?r=${encodeURIComponent(room)}` : `?b=${b.code}`);

export function toast(t: string) {
  const el = $('toast');
  el.textContent = t;
  el.classList.add('on');
  clearTimeout((toast as unknown as { _t?: number })._t);
  (toast as unknown as { _t?: number })._t = window.setTimeout(() => el.classList.remove('on'), 1800);
}

export function closePanel() {
  current = null;
  $('panel').classList.remove('open');
  document.body.classList.remove('focus');
}

const floorLabel = (f: number | null | undefined) => (f ? 'ชั้น ' + f : 'ไม่ระบุชั้น');

export function openPanel(b: Bld, opt: PanelOpt = {}) {
  current = b;
  const z = ZONES[b.zone];
  $('pCode').textContent = b.code;
  $('pZone').textContent = `ZONE 0${b.zone} · ${z.short}`;
  $('pName').textContent = b.name;
  const verified = !!b.sheet?.verified;
  $('pChips').innerHTML =
    `<span class="pc" style="--c:${CATS[b.cat].c}"><i></i>${esc(CATS[b.cat].name)}</span>` +
    (verified ? '<span class="pc ok">ตรวจหน้างานแล้ว</span>' : '<span class="pc warn">รอตรวจสอบ</span>') +
    (b.note ? `<span class="pc warn">${esc(b.note)}</span>` : '');

  // การ์ดผลค้นหา
  const r = opt.room, t = opt.task;
  $('pRoom').innerHTML = r
    ? `<div class="roomcard"><small>ห้องที่ค้นหา</small><b>${esc(r.roomNumber)}</b><span class="fl">ชั้น ${r.floor}</span>` +
      `<p>อยู่ที่ ${esc(b.name)} · ${z.short}<br>เข้าทางหลักของอาคาร แล้วขึ้นบันได${b.sheet?.lift ? '/ลิฟต์' : ''}ไปชั้น ${r.floor}</p>` +
      (r.inferred ? '<span class="sample">อนุมานจากรูปแบบเลขห้อง · รอตรวจสอบ</span>'
        : r.room && !r.room.verified ? '<span class="sample">ข้อมูลห้องยังไม่ตรวจ · รอตรวจสอบ</span>' : '') + '</div>'
    : t
      ? `<div class="taskcard"><small>งานที่ค้นหา</small><b>${esc(t.l)}</b><span class="fl">${floorLabel(t.f)}</span>` +
        `<p>ไปที่ <strong>${esc(t.u?.n ?? '')}</strong><br>${esc(b.name)} · ${z.short}</p><span class="sample">จากเว็บไซต์มหาวิทยาลัย · รอตรวจสอบ</span></div>`
      : '';

  const photo = b.sheet?.photo;
  $('pPhoto').classList.toggle('gallery', b.photos.length > 0);
  $('pPhoto').innerHTML = b.photos.length
    ? b.photos.map((p) => {
      const u = esc(encodeURI(import.meta.env.BASE_URL + p.src));
      return `<figure><a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="${esc(p.caption)}" loading="lazy" decoding="async"></a><figcaption>${esc(p.caption)}</figcaption></figure>`;
    }).join('')
    : photo
    ? `<img src="${esc(import.meta.env.BASE_URL + photo)}" alt="${esc(b.name)}" loading="lazy" decoding="async">`
    : `<div>ยังไม่มีรูป — ทีมสำรวจ${z.short}<br><code>${b.code}_ภายนอก_1.jpg</code></div>`;

  renderGrid(b);
  const hl = opt.floor ?? r?.floor ?? t?.f ?? null;
  renderRooms(b, hl);
  renderSvc(b, t ? t.f : hl, t?.k);
  $('pLink').innerHTML = `ลิงก์ตรงสำหรับ QR หน้าอาคาร: <b class="mono">?b=${b.code}</b>` +
    (r ? ` · ห้องนี้: <b class="mono">?r=${esc(r.roomNumber)}</b>` : '') + `<br><span class="mono small">${esc(linkFor(b))}</span>`;

  const pb = $('panel').querySelector('.p-body') as HTMLElement;
  pb.scrollTop = 0;
  if (t) setTimeout(() => {
    const c = $('pSvc').querySelector('.sc.hl') as HTMLElement | null;
    if (c) pb.scrollTo({ top: c.offsetTop - pb.offsetTop - 90, behavior: 'smooth' });
  }, 450);
  $('panel').classList.add('open');
  document.body.classList.add('focus');
}

function renderGrid(b: Bld) {
  const s = b.sheet;
  const yn = (v: boolean | null | undefined) => (v === true ? 'มี' : v === false ? 'ไม่มี' : null);
  const cell = (label: string, val: string | null, sub = '') =>
    `<div class="cell"><small>${label}</small><b>${val ? esc(val) + sub : PENDING}</b></div>`;
  const fl = b.kind === 'monument' ? '—' : b.kind === 'houses' ? '1–2' : String(b.floors);
  $('pGrid').innerHTML =
    cell('จำนวนชั้น', fl, s?.verified ? '' : ' <em>(ประมาณ)</em>') +
    cell('เวลาเปิด–ปิด', s?.hours ?? null) +
    cell('ลิฟต์', yn(s?.lift)) +
    cell('ทางลาด', yn(s?.ramp)) +
    cell('ห้องน้ำผู้พิการ', s?.accessibleWc ? 'ชั้น ' + s.accessibleWc : null) +
    cell('พิกัดทางเข้า', null);
}

/** ย่อเลขห้องที่ต่อกันเป็นช่วง เช่น 15-401, 15-402, 15-403 → 15-401–15-403 */
function ranges(rs: Room[]): string {
  const out: string[] = [];
  let a: Room | null = null, prev: Room | null = null;
  const num = (r: Room) => r.roomNumber.match(/^(.*?)(\d+)$/);
  const flush = () => { if (a) out.push(a === prev ? a.roomNumber : `${a.roomNumber}–${prev!.roomNumber}`); };
  for (const r of [...rs].sort((x, y) => x.roomNumber.localeCompare(y.roomNumber, 'th', { numeric: true }))) {
    const m = num(r), pm = prev && num(prev);
    if (a && m && pm && m[1] === pm[1] && Number(m[2]) === Number(pm[2]) + 1) { prev = r; continue; }
    flush(); a = prev = r;
  }
  flush();
  return out.join(', ');
}

function renderRooms(b: Bld, floor: number | null) {
  const el = $('pRooms');
  if (!b.rooms.length) {
    el.innerHTML = '<div class="todo">ยังไม่มีข้อมูลห้องที่ตรวจแล้ว — ทีมสำรวจกรอกในแท็บ <b>ห้อง</b> ของ Sheet</div>';
    return;
  }
  const byF = new Map<number, Room[]>();
  for (const r of b.rooms) byF.set(r.floor, [...(byF.get(r.floor) ?? []), r]);
  el.innerHTML = '<div class="floors">' + [...byF.keys()].sort((x, y) => y - x).map((f) => {
    const rs = byF.get(f)!;
    const names = [...new Set(rs.map((r) => r.note).filter(Boolean))].join(', ');
    return `<div class="frow${f === floor ? ' on' : ''}" data-f="${f}"><span class="f">ชั้น ${f}</span><span class="r">${esc(ranges(rs))}</span>` +
      `<span class="nm">${esc(names)}${rs.some((r) => !r.verified) ? ' ' + PENDING : ''}</span></div>`;
  }).join('') + '</div>';
  el.querySelectorAll<HTMLElement>('.frow').forEach((row) => (row.onclick = () => {
    const f = Number(row.dataset.f);
    const on = !row.classList.contains('on');
    el.querySelectorAll('.frow').forEach((x) => x.classList.remove('on'));
    if (on) row.classList.add('on');
    h.onFloor(b, on ? f : null);
  }));
}

function webCard(u: ServiceUnit, hl: boolean) {
  return `<div class="sc${hl ? ' hl' : ''}" data-k="${u.k}"><b>${esc(u.n)}</b>` +
    (u.hot ? `<div class="hot">⏰ ${esc(u.hot)}</div>` : '') +
    (u.t ? `<div class="lbl">ทำอะไรได้</div><div class="chips">${u.t.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : '') +
    (u.d ? `<div class="lbl">เอกสาร / สิ่งที่ต้องเตรียม</div><ul class="docs">${u.d.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '') +
    (u.tip ? `<div class="tip">💡 ${esc(u.tip)}</div>` : '') +
    (u.room ? `<div class="room">ห้อง: ${esc(u.room)}</div>` : '') +
    (u.ph ? `<div class="ph">☎ ${esc(u.ph)}</div>` : '') +
    (u.note ? `<div class="note">⚠ ${esc(u.note)}</div>` : '') +
    `<div class="src">${u.s.map((id) => `<a href="${SRC[id].u}" target="_blank" rel="noopener">${esc(SRC[id].t)} · ${esc(SRC[id].y)} ↗</a>`).join('')}` +
    `<span class="st ${u.st}">รอตรวจสอบ · ${STLABEL[u.st]}</span></div></div>`;
}

function sheetCard(s: FloorService) {
  return `<div class="sc"><b>${esc(s.unit)}</b>` +
    (s.tasks.length ? `<div class="lbl">ทำอะไรได้</div><div class="chips">${s.tasks.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : '') +
    (s.docs.length ? `<div class="lbl">เอกสาร / สิ่งที่ต้องเตรียม</div><ul class="docs">${s.docs.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '') +
    (s.hours ? `<div class="ph">🕘 ${esc(s.hours)}</div>` : '') +
    (s.queue ? `<div class="hot">คิวยาวช่วง: ${esc(s.queue)}</div>` : '') +
    (s.online ? `<div class="tip">💻 ${esc(s.online)}</div>` : '') +
    (s.tip ? `<div class="tip">💡 ${esc(s.tip)}</div>` : '') +
    (s.room ? `<div class="room">ห้อง: ${esc(s.room)}</div>` : '') +
    (s.phone ? `<div class="ph">☎ ${esc(s.phone)}</div>` : '') +
    `<div class="src"><span class="st ${s.verified ? 'ok' : 'web'}">${s.verified ? 'ตรวจหน้างานแล้ว' : 'รอตรวจสอบ'}</span></div></div>`;
}

function renderSvc(b: Bld, openF: number | null | undefined, hlKey?: string) {
  const W = b.web;
  $('pAbout').innerHTML = W
    ? `<div class="about">${esc(W.about)}${W.extra ? `<span class="ex">${esc(W.extra.t)} · <a href="${SRC[W.extra.s[0]].u}" target="_blank" rel="noopener">แหล่งข้อมูล ↗</a></span>` : ''}</div>`
    : '';
  // รวมชั้น: 0 = ไม่ระบุชั้น
  const floors = new Map<number, { sheet: FloorService[]; web: ServiceUnit[] }>();
  const slot = (f: number) => floors.get(f) ?? (floors.set(f, { sheet: [], web: [] }), floors.get(f)!);
  for (const s of b.services) slot(s.floor ?? 0).sheet.push(s);
  if (W) for (const [f, us] of Object.entries(W.floors)) slot(Number(f)).web.push(...us);
  if (!floors.size) { $('pSvc').innerHTML = ''; return; }
  const fs = [...floors.keys()].sort((x, y) => (y || -1) - (x || -1));
  $('pSvc').innerHTML = `<div class="sec" style="margin-top:0"><h4><span>บริการในอาคาร · แยกตามชั้น</span><span>DIRECTORY</span></h4><div class="svc">` +
    fs.map((f) => {
      const { sheet, web } = floors.get(f)!;
      const open = openF !== undefined && openF !== null ? f === openF : fs.length === 1;
      const names = [...sheet.map((s) => s.unit), ...web.map((u) => u.n)];
      return `<div class="sf${open ? ' open' : ''}" data-f="${f}"><button class="sfh"><span class="fl">${floorLabel(f)}</span>` +
        `<span class="nm">${names.map(esc).join(' · ')}</span><span class="ch">›</span></button>` +
        `<div class="sfb">${sheet.map(sheetCard).join('')}${web.map((u) => webCard(u, u.k === hlKey)).join('')}</div></div>`;
    }).join('') +
    `</div>${W ? '<div class="todo" style="margin-top:8px">ข้อมูลที่ติดป้าย "รอตรวจสอบ" มาจากเว็บไซต์มหาวิทยาลัยหรือทีมสำรวจ ยังต้องยืนยันในแท็บ <b>บริการรายชั้น</b></div>' : ''}</div>`;
  $('pSvc').querySelectorAll<HTMLElement>('.sf').forEach((row) => ((row.querySelector('.sfh') as HTMLElement).onclick = () => {
    const f = Number(row.dataset.f), was = row.classList.contains('open');
    $('pSvc').querySelectorAll('.sf').forEach((x) => x.classList.remove('open'));
    if (!was) row.classList.add('open');
    h.onFloor(b, !was && f ? f : null);
  }));
}
