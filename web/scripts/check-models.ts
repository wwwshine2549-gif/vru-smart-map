/**
 * ตรวจไฟล์โมเดลตามข้อตกลง (docs/model-contract.md) ก่อน commit — ให้คนปั้นโมเดลใน Blender รันเอง
 *
 * ใช้:  npm run models:check              ตรวจ public/models/
 *       npm run models:check -- _test     ตรวจ public/models/_test/
 *
 * ตรวจ: index.json, รหัสอาคารมีในแผนผัง, ขนาดไฟล์, จำนวนสามเหลี่ยม, Draco, scene.extras (floors, floorHeight),
 *       ชื่อวัสดุ, origin กลาง footprint ที่ระดับพื้น, สัดส่วนกว้าง/ลึกเทียบกับแผนผัง
 * ผิดข้อตกลง = error (exit 1), ควรแก้ = คำเตือน
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sub = process.argv[2] ?? '';
const DIR = join(WEB, 'public', 'models', sub);
const KB = 1024, MB = 1024 * 1024;
const LIMIT = { landmark: { bytes: 1.5 * MB, tris: 30_000 }, normal: { bytes: 300 * KB, tris: 30_000 }, total: 5 * MB };
const MATS = ['wall', 'roof', 'glass', 'trim', 'accent'];

type Rect = [number, number, number, number, (number | null)?, number?];
const plan = JSON.parse(readFileSync(join(WEB, 'src', 'data', 'plan.json'), 'utf8')) as { B: [number, string, string, number, Rect[], string?][] };
const codeOf = (n: number) => (n > 100 ? 'U' + (n - 100) : 'B' + String(n).padStart(2, '0'));
const planBy = new Map(plan.B.map((b) => [codeOf(b[0]), b]));

const errors: string[] = [], warnings: string[] = [];
const err = (f: string, m: string) => errors.push(`${f}: ${m}`);
const warn = (f: string, m: string) => warnings.push(`${f}: ${m}`);

const indexFile = join(DIR, 'index.json');
if (!existsSync(indexFile)) {
  console.error(`ไม่พบ ${indexFile} (ต้องมีเสมอ ถ้ายังไม่มีโมเดลให้ใส่ [])`);
  process.exit(1);
}
let list: unknown;
try { list = JSON.parse(readFileSync(indexFile, 'utf8')); } catch (e) { console.error(`index.json อ่านไม่ได้: ${e}`); process.exit(1); }
if (!Array.isArray(list) || !list.every((x) => typeof x === 'string')) { console.error('index.json ต้องเป็น array ของรหัสอาคาร เช่น ["B05","B08"]'); process.exit(1); }

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
let total = 0;

for (const code of list as string[]) {
  const f = `${code}.glb`;
  const pb = planBy.get(code);
  if (!pb) { err(f, `รหัส ${code} ไม่มีในแผนผัง (plan.json)`); continue; }
  const file = join(DIR, f);
  if (!existsSync(file)) { err(f, 'อยู่ใน index.json แต่ไม่มีไฟล์'); continue; }
  const bytes = statSync(file).size;
  total += bytes;
  const landmark = pb[2] === 'landmark';
  const lim = landmark ? LIMIT.landmark : LIMIT.normal;
  if (bytes > lim.bytes) err(f, `ขนาด ${(bytes / KB).toFixed(0)} KB เกินงบ ${landmark ? 'landmark 1.5 MB' : 'อาคารทั่วไป 300 KB'}`);

  let doc;
  try { doc = await io.read(file); } catch (e) { err(f, `เปิดไฟล์ไม่ได้ (ต้องเป็น glTF 2.0 .glb): ${(e as Error).message}`); continue; }
  const root = doc.getRoot();
  const used = root.listExtensionsUsed().map((e) => e.extensionName);
  if (!used.includes('KHR_draco_mesh_compression')) warn(f, 'ยังไม่ได้บีบอัด Draco (ตอน export จาก Blender ให้ติ๊ก Compression)');

  let tris = 0;
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    const n = p.getIndices()?.getCount() ?? p.getAttribute('POSITION')?.getCount() ?? 0;
    if (p.getMode() === 4) tris += n / 3;
  }
  if (tris > lim.tris) err(f, `${tris.toLocaleString()} สามเหลี่ยม เกิน ${lim.tris.toLocaleString()}`);

  const names = root.listMaterials().map((m) => m.getName());
  const bad = names.filter((n) => !MATS.includes(n));
  if (bad.length) err(f, `ชื่อวัสดุ ${bad.map((n) => `"${n}"`).join(', ')} ไม่อยู่ในข้อตกลง (${MATS.join(', ')}) — แอปใช้ชื่อนี้ทำไฮไลต์`);
  if (!names.length) warn(f, 'ไม่มีวัสดุเลย');

  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  if (!scene) { err(f, 'ไม่มี scene'); continue; }
  const ex = scene.getExtras() as { floors?: unknown; floorHeight?: unknown };
  if (!Number.isInteger(ex.floors) || (ex.floors as number) < 1) err(f, 'scene.extras.floors ต้องเป็นจำนวนเต็ม ≥ 1 (Blender: Scene Properties > Custom Properties แล้วติ๊ก Include > Custom Properties ตอน export)');
  if (typeof ex.floorHeight !== 'number' || ex.floorHeight <= 0) err(f, 'scene.extras.floorHeight ต้องเป็นตัวเลขเมตร > 0');
  else if (ex.floorHeight < 2.4 || ex.floorHeight > 6) warn(f, `floorHeight ${ex.floorHeight} ม. ดูผิดปกติ (หน่วยต้องเป็นเมตร)`);

  const { min, max } = getBounds(scene);
  const sx = max[0] - min[0], sy = max[1] - min[1], sz = max[2] - min[2];
  if (sy <= 0) err(f, 'โมเดลไม่มีความสูง');
  if (Math.abs(min[1]) > 0.3) warn(f, `ฐานโมเดลอยู่ที่ y = ${min[1].toFixed(2)} ม. (origin ควรอยู่ที่ระดับพื้น)`);
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
  if (Math.abs(cx) > 0.1 * sx || Math.abs(cz) > 0.1 * sz) warn(f, `จุดกลางกรอบอยู่ที่ x=${cx.toFixed(1)}, z=${cz.toFixed(1)} ม. (origin ควรอยู่กลาง footprint)`);
  if (sx > 300 || sz > 300) warn(f, `กว้าง ${sx.toFixed(0)} × ลึก ${sz.toFixed(0)} ม. ใหญ่ผิดปกติ (หน่วยต้องเป็นเมตร)`);
  if (typeof ex.floors === 'number' && typeof ex.floorHeight === 'number' && sy < ex.floors * ex.floorHeight * 0.8)
    warn(f, `สูง ${sy.toFixed(1)} ม. น้อยกว่า floors × floorHeight (${(ex.floors * ex.floorHeight).toFixed(1)} ม.) — แกน Y ชี้ขึ้นหรือไม่`);

  // เทียบสัดส่วนกับ footprint ในแผนผัง (loader ย่อขยายด้วย scale เดียว ถ้าสัดส่วนต่างมาก โมเดลจะไม่เต็มกรอบ)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y, w, h] of pb[4]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x + w); y0 = Math.min(y0, y); y1 = Math.max(y1, y + h); }
  const pr = (x1 - x0) / (y1 - y0), mr = sx / sz;
  const diff = Math.abs(Math.log(mr / pr));
  if (diff > Math.log(1.25)) warn(f, `สัดส่วนกว้าง:ลึก ${mr.toFixed(2)} ต่างจากแผนผัง ${pr.toFixed(2)} — ตรวจว่าแกน X/Z ตรงกับแผนผังหรือหมุนผิด 90°`);

  console.log(`ตรวจ ${f}: ${(bytes / KB).toFixed(1)} KB, ${tris.toLocaleString()} สามเหลี่ยม, ${ex.floors} ชั้น × ${ex.floorHeight} ม., ${sx.toFixed(1)} × ${sz.toFixed(1)} × ${sy.toFixed(1)} ม., วัสดุ ${names.join(', ')}`);
}
if (total > LIMIT.total) errors.push(`รวมทุกไฟล์ ${(total / MB).toFixed(2)} MB เกินงบ 5 MB`);

for (const w of warnings) console.warn(`คำเตือน  ${w}`);
for (const e of errors) console.error(`ผิดพลาด  ${e}`);
console.log(`\n${(list as string[]).length} โมเดล รวม ${(total / KB).toFixed(1)} KB · ${errors.length} ข้อผิดพลาด, ${warnings.length} คำเตือน`);
process.exit(errors.length ? 1 : 0);
