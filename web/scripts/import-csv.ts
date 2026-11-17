/**
 * แปลง CSV ที่ export จากแท็บ "อาคาร" และ "ห้อง" ของ Google Sheet → src/data/buildings.json, rooms.json
 *
 * ใช้:  npm run import -- [--src data/sheet] [--buildings อาคาร.csv] [--rooms ห้อง.csv] [--all] [--out src/data]
 *   --all  รวมแถวที่ยังไม่ "ตรวจแล้ว" (ไว้ดูตัวอย่างเท่านั้น ห้ามใช้ตอน deploy)
 *
 * หัวคอลัมน์อ่านตามชื่อภาษาไทยใน Sheet (นิยามใน tools/build_sheet.py) ห้ามเปลี่ยนชื่อใน Sheet
 * ถ้ามี error จะไม่เขียนไฟล์และ exit 1
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRecords, type CsvRecord } from './lib/csv.ts';
import { loadPlan } from './lib/plan.ts';
import type { Building, Room, RoomType, Zone } from '../src/types.ts';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERIFIED = 'ตรวจแล้ว';
const MAX_RANGE = 50;

// ---------- หัวคอลัมน์ใน Sheet ----------
const BH = {
  id: 'รหัส',
  planName: 'ชื่อตามแผนผัง 2559',
  zone: 'โซน',
  realName: 'ชื่อบนป้ายจริง / ชื่อที่คนเรียก',
  roomCode: 'รหัสอาคารในเลขห้อง',
  floorsWeb: 'จำนวนชั้นในเว็บ (ประมาณ)',
  floors: 'จำนวนชั้นจริง',
  status: 'สถานะการตรวจ',
} as const;
const RH = {
  bid: 'รหัสอาคาร',
  floor: 'ชั้น',
  from: 'เลขห้องเริ่ม',
  to: 'เลขห้องสุดท้าย',
  name: 'ชื่อห้อง / ใช้ทำอะไร',
  type: 'ประเภท',
  status: 'สถานะการตรวจ',
} as const;

const ZONES: Record<string, Zone> = { 'หน้ามอ': 'front', 'กลางมอ': 'middle', 'หลังมอ': 'back' };
const ROOM_TYPES: Record<string, RoomType> = {
  'ห้องเรียน': 'ห้องเรียน',
  'ห้องปฏิบัติการ': 'แล็บ',
  'สำนักงาน': 'สำนักงาน',
  'ห้องพักอาจารย์': 'สำนักงาน',
  'ห้องประชุม': 'อื่น ๆ',
  'ห้องน้ำ': 'อื่น ๆ',
  'อื่น ๆ': 'อื่น ๆ',
};

// ---------- args ----------
function arg(name: string, def: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const includeAll = process.argv.includes('--all');
const srcDir = resolve(WEB, arg('src', 'data/sheet'));
const bFile = join(srcDir, arg('buildings', 'อาคาร.csv'));
const rFile = join(srcDir, arg('rooms', 'ห้อง.csv'));
const outDir = resolve(WEB, arg('out', 'src/data'));

// ---------- รายงาน ----------
const errors: string[] = [];
const warnings: string[] = [];
const at = (file: string, row: number) => `${basename(file)} แถว ${row}`;

// ---------- ตำแหน่งจากแผนผัง (data_pdf.js ของ v0.5) ----------
function loadPlanCentroids(): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  for (const [num, , , , rects] of loadPlan().B) {
    let sx = 0, sy = 0, sa = 0;
    for (const [x, y, w, h] of rects) {
      const a = w * h;
      sx += (x + w / 2) * a; sy += (y + h / 2) * a; sa += a;
    }
    const id = num >= 100 ? `U${num - 100}` : `B${String(num).padStart(2, '0')}`;
    out.set(id, { x: Math.round((sx / sa) * 10) / 10, y: Math.round((sy / sa) * 10) / 10 });
  }
  return out;
}

// ---------- helpers ----------
function load(file: string, required: string[]): CsvRecord[] {
  if (!existsSync(file)) {
    errors.push(`ไม่พบไฟล์ ${file}`);
    return [];
  }
  const { headers, records } = readRecords(readFileSync(file, 'utf8'));
  const missing = required.filter((h) => !headers.includes(h));
  if (missing.length) {
    errors.push(`${basename(file)}: ไม่พบหัวคอลัมน์ ${missing.map((m) => `"${m}"`).join(', ')} (อย่าเปลี่ยนชื่อหัวตารางใน Sheet)`);
    return [];
  }
  return records;
}

/** แถวที่ใช้ได้: ไม่ว่าง ไม่ใช่แถวตัวอย่าง และตรวจแล้ว (ยกเว้น --all) */
function usable(r: CsvRecord, idHeader: string, statusHeader: string): boolean {
  const id = r.get(idHeader);
  if (!id || id.startsWith('ตัวอย่าง') || r.first.startsWith('ตัวอย่าง')) return false;
  return includeAll || r.get(statusHeader) === VERIFIED;
}

const normRoom = (s: string) => s.replace(/[‐-―−]/g, '-').replace(/\s+/g, '');

/** ขยายช่วงเลขห้อง เช่น 15-401 ถึง 15-405 → 5 ห้อง */
function expandRange(from: string, to: string): string[] | string {
  if (!to || to === from) return [from];
  const a = from.match(/^(.*?)(\d+)$/);
  const b = to.match(/^(.*?)(\d+)$/);
  if (!a || !b || a[1] !== b[1]) return `ช่วงเลขห้อง ${from} ถึง ${to} ไม่ได้ขึ้นต้นเหมือนกัน`;
  const start = Number(a[2]);
  const end = Number(b[2]);
  if (end < start) return `ช่วงเลขห้องกลับด้าน (${from} ถึง ${to})`;
  if (end - start + 1 > MAX_RANGE) return `ช่วงเลขห้องยาวเกิน ${MAX_RANGE} ห้อง (${from} ถึง ${to}) ตรวจว่าพิมพ์ผิดไหม`;
  const width = a[2].length;
  const out: string[] = [];
  for (let n = start; n <= end; n++) out.push(a[1] + String(n).padStart(width, '0'));
  return out;
}

function shortNameOf(realName: string, planName: string): string {
  if (realName) return realName.split(/\s*\/\s*/)[0];
  const s = planName.replace(/\(.*?\)/g, '').replace(/^อาคาร\s*/, '').trim();
  return s || planName;
}

function toInt(s: string): number | null {
  return /^\d+$/.test(s) ? Number(s) : null;
}

// ---------- อาคาร ----------
const plan = loadPlanCentroids();
const buildings: Building[] = [];
const buildingRow = new Map<string, number>();

for (const r of load(bFile, Object.values(BH))) {
  if (!usable(r, BH.id, BH.status)) continue;
  const where = at(bFile, r.sheetRow);
  const id = r.get(BH.id);
  if (!/^(B\d{2}|U\d)$/.test(id)) {
    errors.push(`${where}: รหัสอาคาร "${id}" ผิดรูปแบบ (ต้องเป็น B01–B48 หรือ U1–U5)`);
    continue;
  }
  if (buildingRow.has(id)) {
    errors.push(`${where}: รหัสอาคาร ${id} ซ้ำกับแถว ${buildingRow.get(id)}`);
    continue;
  }
  buildingRow.set(id, r.sheetRow);

  const zoneText = r.get(BH.zone);
  const zone = ZONES[zoneText];
  if (!zone) errors.push(`${where}: โซน "${zoneText}" ไม่ถูกต้อง (ต้องเป็น หน้ามอ / กลางมอ / หลังมอ)`);

  const floorsText = r.get(BH.floors) || r.get(BH.floorsWeb);
  const floors = toInt(floorsText);
  if (floors === null || floors < 1) errors.push(`${where}: จำนวนชั้น "${floorsText}" ไม่ใช่ตัวเลข`);

  const pos = plan.get(id);
  if (!pos) warnings.push(`${where}: ${id} ไม่มีตำแหน่งในแผนผัง จะไม่แสดงบนแผนที่`);

  const realName = r.get(BH.realName);
  const planName = r.get(BH.planName);
  const photoRel = `photos/${id}_ภายนอก_1.webp`;

  if (zone && floors) {
    buildings.push({
      id,
      name: realName.split(/\s*\/\s*/)[0] || planName,
      shortName: shortNameOf(realName, planName),
      zone,
      floors,
      x: pos?.x ?? null,
      y: pos?.y ?? null,
      roomCode: r.get(BH.roomCode) || null,
      photo: existsSync(join(WEB, 'public', photoRel)) ? photoRel : null,
      description: null,
    });
  }
}

// ---------- ห้อง ----------
const byId = new Map(buildings.map((b) => [b.id, b]));
const rooms: Room[] = [];
const roomRow = new Map<string, number>(); // buildingId:roomNumber → แถว
const numberOwner = new Map<string, string>(); // roomNumber → buildingId

for (const r of load(rFile, Object.values(RH))) {
  if (!usable(r, RH.bid, RH.status)) continue;
  const where = at(rFile, r.sheetRow);
  const bid = r.get(RH.bid);
  const b = byId.get(bid);
  if (!b) {
    const why = buildingRow.has(bid) ? 'แถวอาคารมี error' : 'ไม่มีในแท็บอาคาร (หรือยังไม่ได้ตรวจ)';
    errors.push(`${where}: รหัสอาคาร "${bid}" ${why}`);
    continue;
  }

  const floor = toInt(r.get(RH.floor));
  if (floor === null) {
    errors.push(`${where}: ชั้น "${r.get(RH.floor)}" ไม่ใช่ตัวเลข`);
    continue;
  }
  if (floor > b.floors) warnings.push(`${where}: ชั้น ${floor} เกินจำนวนชั้นของ ${bid} (${b.floors} ชั้น)`);

  const typeText = r.get(RH.type);
  const type = ROOM_TYPES[typeText];
  if (!type) {
    errors.push(`${where}: ประเภท "${typeText}" ไม่อยู่ในรายการ`);
    continue;
  }

  const from = normRoom(r.get(RH.from));
  if (!from) {
    warnings.push(`${where}: ไม่มีเลขห้อง (${r.get(RH.name) || 'ไม่มีชื่อ'}) ข้ามแถวนี้`);
    continue;
  }
  const list = expandRange(from, normRoom(r.get(RH.to)));
  if (typeof list === 'string') {
    errors.push(`${where}: ${list}`);
    continue;
  }

  const prefix = from.match(/^(\d+)-/)?.[1];
  if (prefix && b.roomCode && prefix !== b.roomCode) {
    warnings.push(`${where}: เลขห้อง ${from} ขึ้นต้นด้วย ${prefix} แต่ ${bid} ใช้รหัส ${b.roomCode}`);
  }

  for (const roomNumber of list) {
    const key = `${bid}:${roomNumber}`;
    if (roomRow.has(key)) {
      errors.push(`${where}: เลขห้อง ${roomNumber} ซ้ำกับแถว ${roomRow.get(key)}`);
      continue;
    }
    const other = numberOwner.get(roomNumber);
    if (other && other !== bid) {
      warnings.push(`${where}: เลขห้อง ${roomNumber} มีใน ${other} ด้วย ค้นหาแล้วจะเจอ 2 อาคาร`);
    }
    roomRow.set(key, r.sheetRow);
    numberOwner.set(roomNumber, bid);
    rooms.push({ id: key, roomNumber, buildingId: bid, floor, type, note: r.get(RH.name) || null });
  }
}

// ---------- สรุป ----------
for (const w of warnings) console.warn(`คำเตือน  ${w}`);
for (const e of errors) console.error(`ผิดพลาด  ${e}`);

if (errors.length) {
  console.error(`\nพบ ${errors.length} ข้อผิดพลาด, ${warnings.length} คำเตือน — ไม่ได้เขียนไฟล์ JSON`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'buildings.json'), JSON.stringify(buildings, null, 2) + '\n');
writeFileSync(join(outDir, 'rooms.json'), JSON.stringify(rooms, null, 2) + '\n');
console.log(
  `เขียน ${buildings.length} อาคาร, ${rooms.length} ห้อง → ${outDir}` +
    (warnings.length ? ` (${warnings.length} คำเตือน)` : '') +
    (includeAll ? '\n⚠ ใช้ --all: รวมแถวที่ยังไม่ตรวจ ห้ามใช้ข้อมูลชุดนี้ deploy' : ''),
);
