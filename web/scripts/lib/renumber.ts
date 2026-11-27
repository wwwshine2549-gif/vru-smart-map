/**
 * เลขอาคารตาม "แผนผังมหาวิทยาลัยราชภัฏวไลยอลงกรณ์ ในพระบรมราชูปถัมภ์" ฉบับใหม่ (57 จุด) แทนเลขแผนผัง 2559
 * รูปทรง/ตำแหน่งยังมาจาก data_pdf.js (แผนผัง 2559) — ตารางนี้บอกว่าเลขใหม่แต่ละเลขใช้อาคารเดิมหลังไหน
 *
 * จับคู่ 27 พ.ย. 2569: ชื่อตรงกัน + fit affine จากตำแหน่งหมุดในภาพแผนผังใหม่ → พิกัดแผนผัง 2559 (คลาดส่วนใหญ่ < 35 pt)
 * - from: เลขอาคารในแผนผัง 2559 (101–105 = U1–U5 เดิม) · pick: ใช้เฉพาะกรอบลำดับที่ระบุ · rects: กรอบใหม่ (pt)
 * - อาคารเดิมที่ไม่มีเลขในแผนผังใหม่ → U1–U11 (เลข 101–111)
 * ตารางตรวจด้วยตา: แผนผังใหม่/จับคู่แผนผังใหม่.csv (โฟลเดอร์งานของเจ้าของโค้ด)
 */
import type { PdfBuilding, PdfRect } from './plan.ts';

interface Row { n: number; from?: number | number[]; pick?: number[]; rects?: PdfRect[]; name: string; cat?: string; floors?: number; kind?: string | null; note?: string }

const APPROX = 'ตำแหน่งและรูปทรงโดยประมาณจากแผนผังใหม่ — ต้องตรวจหน้างาน';
const SPLIT = 'แบ่งอาคารตามหมุดในแผนผังใหม่ (โดยประมาณ) — ต้องตรวจหน้างาน';
const NOT_ON_NEW = 'ไม่มีเลขในแผนผังใหม่ — ต้องตรวจว่ายังมีอยู่หรือเปลี่ยนชื่อ';
const box = (x: number, y: number): PdfRect[] => [[x, y, 18, 18]];
const dorm = (x: number): PdfRect[] => [[x, 1648, 29, 50]]; // แบ่งกรอบหอพักนานาชาติ (กว้าง 116) เป็น 4 ส่วน

export const ROWS: Row[] = [
  { n: 1, from: 5, name: 'หอประชุม 80 ปี วไลยอลงกรณ์' },
  { n: 2, from: 8, name: 'อาคาร 100 ปี สมเด็จพระศรีนครินทร์' },
  { n: 3, from: 3, name: 'ศูนย์ฝึกประสบการณ์วิชาชีพ (โรงแรม)', note: 'จับคู่จากตำแหน่ง — แผนผัง 2559 เรียกว่าอาคารสมเด็จเจ้าฟ้าวไลยอลงกรณ์ ต้องตรวจหน้างาน' },
  { n: 4, rects: box(131.8, 286.7), name: 'VRU Green Community Mall', cat: 'shop', floors: 1, note: APPROX },
  { n: 5, from: 4, name: 'อาคารศูนย์ส่งเสริมสุขภาพ (สระว่ายน้ำอวยพร เปล่งวานิช)' },
  { n: 6, rects: box(215.2, 444.3), name: 'อาคารปฏิบัติการขยะ', cat: 'service', floors: 1, note: APPROX },
  { n: 7, from: 6, name: 'อาคารปฏิบัติการด้านธุรกิจบริการ' },
  { n: 8, from: 7, name: 'อาคารส่งเสริมการเรียนรู้' },
  { n: 9, from: 13, name: 'หอประชุมวไลยอลงกรณ์' },
  { n: 10, from: 14, name: 'ศูนย์อาหาร' },
  { n: 11, from: 15, name: 'ยิมเนเซียม 1' },
  { n: 12, from: 9, name: 'อาคาร 75 ปี วไลยอลงกรณ์ (ศูนย์ภาษา)' },
  { n: 13, from: 10, name: 'ศูนย์วิทยาศาสตร์' },
  { n: 14, from: 16, pick: [0], name: 'อาคารเรียนคณะเทคโนโลยีการเกษตร', note: SPLIT },
  { n: 15, from: 16, pick: [1, 2, 3], name: 'คณะเทคโนโลยีการเกษตร', note: SPLIT },
  { n: 16, from: 17, name: 'อาคารเรียนคณะครุศาสตร์' },
  { n: 17, from: 20, name: 'คณะครุศาสตร์' },
  { n: 18, from: 18, name: 'กองพัฒนานักศึกษา' },
  { n: 19, from: 19, name: 'คณะวิทยาศาสตร์และเทคโนโลยี' },
  { n: 20, from: 23, name: 'อาคารพยาบาล' },
  { n: 21, from: 22, name: 'ร้านสะดวกซื้อ' },
  { n: 22, from: 21, name: 'ธนาคาร' },
  { n: 23, from: 11, name: 'อาคารแสดงผลงานนักศึกษา' },
  { n: 24, from: 12, name: 'อาคาร 60 ปี วไลยอลงกรณ์' },
  { n: 25, from: 30, name: 'อาคารปฏิบัติการคหกรรมศาสตร์' },
  { n: 26, rects: box(195.9, 784.5), name: 'งานสื่อสารองค์กรและการตลาด', cat: 'service', floors: 2, note: APPROX },
  { n: 27, rects: box(196.2, 820.4), name: 'สำนักส่งเสริมการเรียนรู้และบริการวิชาการ', cat: 'service', floors: 2, note: APPROX },
  { n: 28, from: 31, name: 'คณะวิทยาการจัดการ' },
  { n: 29, from: 32, name: 'อาคารเรียนรวมวิทยาศาสตร์' },
  { n: 30, from: 25, name: 'โรงเรียนสาธิต (มัธยม)' },
  { n: 31, from: 26, name: 'สำนักวิทยบริการและเทคโนโลยีสารสนเทศ' },
  { n: 32, from: 27, name: 'คณะมนุษยศาสตร์และสังคมศาสตร์' },
  { n: 33, rects: [[541.7, 871.4, 31.8, 46], [568.2, 871.8, 19.8, 29.8, 3]], name: 'อาคารเรียนรวมสังคมศาสตร์', cat: 'edu', floors: 6, note: SPLIT },
  { n: 34, rects: [[541.7, 917.4, 31.8, 70.6]], name: 'สถาบันวิจัยและพัฒนา', cat: 'service', floors: 6, note: SPLIT },
  { n: 35, from: 34, name: 'โรงเรียนสาธิต (ประถม)' },
  { n: 36, from: 33, name: 'เรือนเจ้าฟ้า (เรือนไทยภาคกลาง)' },
  { n: 37, from: 103, name: 'ฝ่ายยานพาหนะ', cat: 'service' },
  { n: 38, from: [41, 40, 39], name: 'อาคารปฏิบัติการเทคโนโลยีอุตสาหกรรม' },
  { n: 39, from: 43, name: 'คณะเทคโนโลยีอุตสาหกรรม' },
  { n: 40, from: 38, name: 'หอพักโกเมน' },
  { n: 41, from: 37, name: 'หอพักเพทาย' },
  { n: 42, from: 36, name: 'ยิมเนเซียม 2' },
  { n: 43, rects: [[431.8, 1446.1, 15.9, 48.5], [432.8, 1498, 18.1, 23.6]], name: 'หอพักนักศึกษา 43', cat: 'dorm', floors: 8, note: SPLIT },
  { n: 44, rects: [[431.1, 1521.6, 15.9, 48.5]], name: 'หอพักนักศึกษา 44', cat: 'dorm', floors: 8, note: SPLIT },
  { n: 45, rects: [[378.8, 1483.8, 15.9, 48.5]], name: 'หอพักนักศึกษา 45', cat: 'dorm', floors: 8, note: SPLIT },
  { n: 46, rects: [[378.8, 1535.5, 15.9, 71.9]], name: 'หอพักนักศึกษา 46', cat: 'dorm', floors: 8, note: SPLIT },
  { n: 47, rects: [[351.4, 1498, 15.9, 109.4]], name: 'หอพักนักศึกษา 47', cat: 'dorm', floors: 8, note: SPLIT },
  { n: 48, rects: [[323.9, 1517.2, 15.9, 48.5]], name: 'หอพักนักศึกษา 48', cat: 'dorm', floors: 8, note: SPLIT },
  { n: 49, rects: dorm(421), name: 'หอพักนักศึกษานานาชาติ 49', cat: 'dorm', floors: 8, note: SPLIT },
  { n: 50, rects: dorm(392), name: 'หอพักนักศึกษานานาชาติ 50', cat: 'dorm', floors: 8, note: SPLIT },
  { n: 51, rects: dorm(363), name: 'หอพักนักศึกษานานาชาติ 51', cat: 'dorm', floors: 8, note: SPLIT },
  { n: 52, rects: dorm(334), name: 'หอพักนักศึกษานานาชาติ 52', cat: 'dorm', floors: 8, note: SPLIT },
  { n: 53, from: 46, name: 'ศูนย์ประสานงานโครงการอนุรักษ์พันธุกรรมพืช' },
  { n: 54, from: 104, name: 'อาคารปฏิบัติการโครงการอนุรักษ์พันธุกรรมพืช', cat: 'service' },
  { n: 55, rects: box(228.9, 1566.4), name: 'Valaya Hub', cat: 'service', floors: 2, note: APPROX },
  { n: 56, rects: box(138.2, 1595.1), name: 'รีสอร์ท', cat: 'service', floors: 2, note: APPROX },
  { n: 57, rects: [[372.4, 1852.1, 72.7, 14.4]], name: 'สนามกีฬากลาง', cat: 'sport', floors: 1, note: 'จุดบนอัฒจันทร์ของสนามกีฬากลาง' },
  // อาคารเดิมที่ไม่มีเลขในแผนผังใหม่
  { n: 101, from: 1, name: 'อนุสาวรีย์ เจ้าฟ้าวไลยอลงกรณ์' },
  { n: 102, from: 2, name: 'หอพระ' },
  { n: 103, from: 24, name: 'อาคารโรงเรียนสาธิต (มัธยม) อีกหลังหนึ่ง', note: NOT_ON_NEW },
  { n: 104, from: 29, name: 'ศูนย์เรียนรู้เศรษฐกิจพอเพียง', note: NOT_ON_NEW },
  { n: 105, from: 35, name: 'อาคารกีฬาในร่ม 2 (ชื่อตามแผนผัง 2559)', note: NOT_ON_NEW },
  { n: 106, from: 42, name: 'อาคารกิจกรรมนักศึกษาคณะเทคโนโลยีอุตสาหกรรม', note: NOT_ON_NEW },
  { n: 107, from: 47, name: 'อาคารศูนย์การศึกษาพัฒนาความหลากหลายฯ (โรงเรือน)', note: NOT_ON_NEW },
  { n: 108, from: 48, name: 'บ้านพักอาจารย์และบุคลากร' },
  { n: 109, from: 101, name: 'อาคารไม่มีหมายเลข (ข้างอาคารพยาบาล)' },
  { n: 110, from: 102, name: 'อาคารไม่มีหมายเลข (เหนืออาคารเรียนรวมสังคมศาสตร์)' },
  { n: 111, from: 105, name: 'อาคารไม่มีหมายเลข (ข้างสระน้ำใต้สนามกีฬา)' },
];

/** เลขเดิม (2559) → เลขใหม่ (อาคารที่ย้ายทั้งหลัง) ใช้แปลงลิงก์เก่าและข้อมูลที่อ้างเลขเดิม */
export const OLD_TO_NEW: Record<number, number> = Object.fromEntries(
  ROWS.filter((r) => typeof r.from === 'number' && !r.pick).map((r) => [r.from as number, r.n]),
);

export function renumber(old: PdfBuilding[], map: Record<string, unknown>) {
  const byOld = new Map(old.map((b) => [b[0], b]));
  const used = new Set<number>();
  const notes: Record<number, string> = {};
  const B: PdfBuilding[] = ROWS.map((r) => {
    const srcs = (r.from === undefined ? [] : Array.isArray(r.from) ? r.from : [r.from]).map((n) => {
      const b = byOld.get(n);
      if (!b) throw new Error(`ไม่พบอาคารเดิม ${n}`);
      used.add(n);
      return b;
    });
    const first = srcs[0];
    let rects = r.rects ?? srcs.flatMap((b) => b[4]);
    if (r.pick) rects = r.pick.map((i) => rects[i]);
    if (!rects.length) throw new Error(`เลข ${r.n} ไม่มีกรอบอาคาร`);
    if (r.note) notes[r.n] = r.note;
    const kind = r.kind === null ? undefined : r.kind ?? first?.[5];
    const row: PdfBuilding = [r.n, r.name, r.cat ?? first?.[2] ?? 'unknown', r.floors ?? Math.max(...srcs.map((b) => b[3]), 1), rects];
    if (kind && kind !== 'site') row.push(kind);
    return row;
  });
  for (const r of ROWS) if (typeof r.from === 'number' && r.pick) used.add(r.from);
  used.add(28).add(44).add(45); // แบ่งกรอบใหม่ใน rects แล้ว
  const missing = old.filter((b) => !used.has(b[0])).map((b) => b[0]);
  if (missing.length) throw new Error(`อาคารเดิมยังไม่ได้จัดเลขใหม่: ${missing.join(', ')}`);
  // อัฒจันทร์กลายเป็นอาคารเลข 57 (เลือก/ค้นหาได้) จึงไม่วาดซ้ำจาก MAP
  const stadium = { ...(map.stadium as Record<string, unknown>), stand: null };
  return { B, MAP: { ...map, stadium }, NOTE: notes };
}
