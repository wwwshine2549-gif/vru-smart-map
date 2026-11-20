/** ค้นหา: เลขห้อง / ชื่ออาคาร / เรื่องที่จะไปทำ — Fuse.js ช่วยเรื่องพิมพ์ผิด */
import Fuse from 'fuse.js';
import { BLDGS, byNum, findBuilding, findRooms, type Bld, type RoomHit } from './catalog.ts';
import { CATS, TASKS, type Task } from './data/services.ts';

export type Hit =
  | { type: 'task'; b: Bld; t: Task }
  | { type: 'room'; b: Bld; r: RoomHit }
  | { type: 'bld'; b: Bld };

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');

interface Doc { kind: 'bld' | 'task'; b: Bld; t?: Task; name: string; extra: string[] }
const docs: Doc[] = [
  ...TASKS.map((t): Doc => ({ kind: 'task', b: byNum.get(t.b)!, t, name: t.l, extra: t.q })),
  ...BLDGS.map((b): Doc => ({
    kind: 'bld', b, name: b.name,
    extra: [b.planName, b.sheet?.shortName ?? '', b.code, ...b.alias, CATS[b.cat].name].filter(Boolean),
  })),
];
const fuse = new Fuse(docs, {
  keys: [{ name: 'name', weight: 2 }, { name: 'extra', weight: 1.5 }],
  threshold: 0.34,
  ignoreLocation: true,
  minMatchCharLength: 2,
});

export function search(q: string): Hit[] {
  const v = norm(q);
  if (!v) return [];
  const out: Hit[] = [];
  const seen = new Set<string>();
  const add = (h: Hit) => {
    const id = h.type + ':' + (h.type === 'task' ? h.t.l : h.type === 'room' ? h.r.b.code + h.r.roomNumber : h.b.code);
    if (!seen.has(id)) { seen.add(id); out.push(h); }
  };

  for (const r of findRooms(q)) add({ type: 'room', b: r.b, r });

  const exactB = /^(b|u)?\d{1,3}$/.test(v) ? findBuilding(v) : undefined;
  if (exactB) add({ type: 'bld', b: exactB });

  // ตรงตัวก่อน (คำพ้องของงานและอาคาร) แล้วตามด้วย fuzzy
  for (const d of docs) {
    const words = [d.name, ...d.extra].map(norm);
    if (words.some((w) => w.includes(v) || (v.length >= 3 && w.length > 2 && v.includes(w)))) {
      add(d.kind === 'task' ? { type: 'task', b: d.b, t: d.t! } : { type: 'bld', b: d.b });
    }
  }
  // fuzzy เฉพาะเมื่อหาแบบตรงตัวไม่เจอ (กันผลเกินจากคำสั้น ๆ เช่น "กยศ", "b26")
  const exact = out.filter((x) => x.type !== 'room').length;
  if (v.length >= 3 && exact === 0) for (const { item: d } of fuse.search(q.trim(), { limit: 8 })) {
    add(d.kind === 'task' ? { type: 'task', b: d.b, t: d.t! } : { type: 'bld', b: d.b });
  }

  const tasks = out.filter((h) => h.type === 'task').slice(0, 5);
  const rooms = out.filter((h) => h.type === 'room').slice(0, 6);
  const blds = out.filter((h) => h.type === 'bld').slice(0, 6);
  return [...rooms, ...tasks, ...blds];
}

export const popularTasks = () => TASKS.filter((t) => t.pop).map((t): Hit => ({ type: 'task', b: byNum.get(t.b)!, t }));
