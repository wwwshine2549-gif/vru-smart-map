/**
 * รวมข้อมูลอาคารทุกหลังให้หน้า 2D / panel / ค้นหาใช้ร่วมกัน (ไม่พึ่ง three.js)
 * - รูปทรงและตำแหน่ง: plan.json (แผนผัง 2559) ครบ 53 หลัง
 * - ข้อมูลที่ตรวจแล้วจาก Sheet: buildings.json, rooms.json, services.json (npm run import)
 * - ข้อมูลบริการจากเว็บไซต์มหาวิทยาลัย (ยังไม่ตรวจ): services.ts
 */
import plan from './data/plan.json';
import sheetBuildings from './data/buildings.json';
import sheetRooms from './data/rooms.json';
import sheetServices from './data/services.json';
import pendingData from './data/pending.json';
import { ALIAS, BCODE, SERVICES, ZONE_Y, type BuildingServices, type CatKey, type ZoneNum } from './data/services.ts';
import type { Building, FloorService, Room, Zone } from './types.ts';

export type Rect = [number, number, number, number, (number | null)?, number?];
type PlanRow = [number, string, string, number, Rect[], string?];
export type Pt = [number, number];
export interface PlanMap {
  roads: [number, Pt[]][]; water: Pt[][]; forest: Pt[][]; parking: Pt[][]; field: Pt[][]; garden: Pt[][];
  courts: [number, number, number, number][]; trees: [number, number, number][];
  stadium: { cx: number; cy: number; L: number; W: number; stand: [number, number, number, number] };
}

export interface Bld {
  /** เลขในแผนผัง: 1–48, 101–105 */
  num: number;
  /** รหัสใน Sheet: B08, U1 */
  code: string;
  name: string;
  planName: string;
  cat: CatKey;
  floors: number;
  rects: Rect[];
  kind?: string;
  /** จุดกลางกรอบอาคารบนแผนผัง (pt) */
  cx: number;
  cy: number;
  /** ขนาดกรอบอาคาร (pt) */
  w: number;
  h: number;
  zone: ZoneNum;
  alias: string[];
  note: string;
  /** แถวในแท็บอาคารที่ import แล้ว (null = ยังไม่ตรวจ) */
  sheet: Building | null;
  rooms: Room[];
  services: FloorService[];
  /** บริการจากเว็บไซต์มหาวิทยาลัย (รอตรวจสอบ) */
  web: BuildingServices | null;
}

const ZONE_NUM: Record<Zone, ZoneNum> = { front: 1, middle: 2, back: 3 };
const NOTE: Record<number, string> = {
  5: 'รูปทรงอ้างอิงภาพออกแบบอาคาร',
  45: 'แผนผังปี 2559 ระบุว่า "กำลังก่อสร้าง" — ต้องตรวจสถานะและรูปทรงจริง',
};

export const MAP = (plan as unknown as { MAP: PlanMap }).MAP;
export const codeOf = (num: number) => (num > 100 ? 'U' + (num - 100) : 'B' + String(num).padStart(2, '0'));
export const zoneOfY = (y: number): ZoneNum => (y < ZONE_Y[0] ? 1 : y < ZONE_Y[1] ? 2 : 3);

const sheetById = new Map((sheetBuildings as Building[]).map((b) => [b.id, b]));

/** ข้อมูลจากทีมที่ยังไม่ "ตรวจแล้ว" ใน Sheet (verified:false = ติดป้ายรอตรวจสอบ)
 *  แยกไฟล์ไว้ไม่ให้ npm run import เขียนทับ · เมื่อ Sheet มีข้อมูลที่ตรวจแล้ว ใช้ของ Sheet แทนอัตโนมัติ */
const PENDING_DATA = pendingData as unknown as Record<string, { floors?: number; note?: string; rooms?: Room[]; services?: FloorService[] }>;

export const BLDGS: Bld[] = (plan as unknown as { B: PlanRow[] }).B.map(([num, planName, cat, floors, rects, kind]) => {
  const code = codeOf(num);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y, w, h, , rot] of rects) {
    // กรอบที่หมุนใช้ด้านยาวสุดเป็นกรอบ (ประมาณ ให้เหมือนฉาก 3D)
    const r = rot ? Math.max(w, h) / 2 : 0;
    const cx = x + w / 2, cy = y + h / 2;
    x0 = Math.min(x0, r ? cx - r : x); x1 = Math.max(x1, r ? cx + r : x + w);
    y0 = Math.min(y0, r ? cy - r : y); y1 = Math.max(y1, r ? cy + r : y + h);
  }
  // โซนใช้ค่าเฉลี่ยจุดกลางของแต่ละกรอบ เหมือน v0.5
  const ys = rects.map((r) => r[1] + r[3] / 2);
  const py = ys.reduce((a, c) => a + c, 0) / ys.length;
  const sheet = sheetById.get(code) ?? null;
  const pend = PENDING_DATA[code];
  const sRooms = (sheetRooms as Room[]).filter((r) => r.buildingId === code);
  const sServices = (sheetServices as FloorService[]).filter((s) => s.buildingId === code);
  return {
    num, code, planName, cat: cat as CatKey, rects, kind,
    name: sheet?.name || planName,
    floors: sheet?.floors ?? pend?.floors ?? floors,
    cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0,
    zone: sheet ? ZONE_NUM[sheet.zone] : zoneOfY(py),
    alias: ALIAS[num] ?? [],
    note: NOTE[num] ?? ((!sheet && pend?.note) || (cat === 'unknown' ? 'ไม่มีหมายเลข/ชื่อในแผนผังปี 2559 — ต้องระบุหน้างาน' : '')),
    sheet,
    rooms: sRooms.length ? sRooms : pend?.rooms ?? [],
    services: sServices.length ? sServices : pend?.services ?? [],
    web: SERVICES[num] ?? null,
  };
});

export const byNum = new Map(BLDGS.map((b) => [b.num, b]));
export const byCode = new Map(BLDGS.map((b) => [b.code, b]));

/** หาอาคารจาก "B08", "b8", "8", "U1", "101" */
export function findBuilding(s: string): Bld | undefined {
  const v = s.trim().toUpperCase();
  const m = v.match(/^B?0*(\d{1,3})$/);
  if (m) return byNum.get(Number(m[1]));
  const u = v.match(/^U(\d)$/);
  if (u) return byNum.get(100 + Number(u[1]));
  return byCode.get(v);
}

// ---------- ห้อง ----------
export const normRoom = (s: string) =>
  s.toLowerCase().replace(/^(ห้อง|room|rm\.?)/, '').replace(/[‐-―−_.\s]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
const roomKey = (s: string) => normRoom(s).replace(/-/g, '');

const roomIndex = new Map<string, { room: Room; b: Bld }[]>();
for (const b of BLDGS) for (const room of b.rooms) {
  const k = roomKey(room.roomNumber);
  roomIndex.set(k, [...(roomIndex.get(k) ?? []), { room, b }]);
}

/** รหัสอาคารในเลขห้อง → อาคาร: จาก Sheet ที่ตรวจแล้ว + รูปแบบจากเว็บไซต์มหาวิทยาลัย (15 = B08) */
const ROOM_CODE = new Map<string, { b: Bld; verified: boolean }>();
for (const [rc, num] of Object.entries(BCODE)) { const b = byNum.get(num); if (b) ROOM_CODE.set(rc, { b, verified: false }); }
for (const b of BLDGS) if (b.sheet?.roomCode) ROOM_CODE.set(b.sheet.roomCode, { b, verified: b.sheet.verified });

export interface RoomHit {
  b: Bld;
  roomNumber: string;
  floor: number;
  room: Room | null;
  /** true = อนุมานจากรูปแบบเลขห้อง ไม่มีในข้อมูลห้องที่ตรวจแล้ว */
  inferred: boolean;
}

/** ค้นเลขห้อง: ตรงตัวก่อน แล้วขึ้นต้นด้วย แล้วอนุมานจากรูปแบบ "รหัสอาคาร-ชั้นเลขห้อง" */
export function findRooms(q: string, limit = 6): RoomHit[] {
  const n = normRoom(q);
  const k = n.replace(/-/g, '');
  if (!/\d/.test(k) || k.length < 2) return [];
  const out: RoomHit[] = [];
  const seen = new Set<string>();
  const push = (h: RoomHit) => { const id = h.b.code + ':' + h.roomNumber; if (!seen.has(id)) { seen.add(id); out.push(h); } };
  for (const { room, b } of roomIndex.get(k) ?? []) push({ b, roomNumber: room.roomNumber, floor: room.floor, room, inferred: false });
  if (k.length >= 3) for (const [key, list] of roomIndex) {
    if (out.length >= limit) break;
    if (key.startsWith(k)) for (const { room, b } of list) push({ b, roomNumber: room.roomNumber, floor: room.floor, room, inferred: false });
  }
  if (!out.length) {
    // เลขล้วน 4 หลัก = ชั้นสองหลัก (15-1203 → ชั้น 12) · นอกนั้นชั้นหลักเดียว (15-409, 15-4GS9)
    const m = n.match(/^(\d{1,2})-(\d{2})(\d{2})$/) ?? n.match(/^(\d{1,2})-(\d)([0-9a-z]{1,3})$/);
    const hit = m && ROOM_CODE.get(m[1]);
    if (m && hit) push({ b: hit.b, roomNumber: `${m[1]}-${m[2]}${m[3].toUpperCase()}`, floor: Number(m[2]), room: null, inferred: true });
  }
  return out.slice(0, limit);
}

export function findRoomExact(q: string): RoomHit | undefined {
  const k = roomKey(q);
  return findRooms(q, 1).find((h) => roomKey(h.roomNumber) === k);
}
