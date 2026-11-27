/**
 * แปลงโมเดลอาคาร 75 ปี (B12, เดิม B09) ให้ตรงข้อตกลง docs/model-contract.md → public/models/B12.glb
 *   npx tsx scripts/convert-b09.ts "<ต้นฉบับ .glb>" model-src/b09_signs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO, type Accessor } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const [src, signDir] = process.argv.slice(2);
const DROP = ['ConcretePlaza', 'HedgePlanter']; // พื้นลาน/พุ่มไม้ ทำให้ตัวอาคารถูกย่อ
const NAME: Record<string, string> = {
  CreamConcreteWall: 'wall', CreamSlabTrim: 'trim', BlueGreyMetalFascia: 'accent', TintedBlueWindowGlass: 'glass',
  WindowAluminumFrame: 'trim', PolycarbonateCanopy: 'roof', TrussSteel: 'trim', GroundBlueBanner: 'accent',
};
const FRONT_LIMIT = 1.8, SQUASH = 0.25; // กันสาดที่ยื่นหน้าอาคาร ย่อความลึกเหลือ 25%

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(src);
const root = doc.getRoot();

const prims = root.listMeshes().flatMap((m) => m.listPrimitives().map((p) => ({ m, p })));
for (const { m, p } of prims) if (DROP.includes(p.getMaterial()!.getName())) { m.removePrimitive(p); p.dispose(); }

// ป้ายแนวนอนในต้นฉบับกลับหัว (UV แกน V กลับด้าน) — ป้าย 75 ปีถูกอยู่แล้ว
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  const n = p.getMaterial()!.getName(), uv = p.getAttribute('TEXCOORD_0');
  if (!n.startsWith('Sign_') || n === 'Sign_75th_Anniversary' || !uv) continue;
  for (let i = 0; i < uv.getCount(); i++) { const [u, v] = uv.getElement(i, [] as number[]); uv.setElement(i, [u, 1 - v]); }
}

for (const mat of root.listMaterials()) {
  const old = mat.getName();
  if (signDir && existsSync(join(signDir, old + '.png'))) mat.getBaseColorTexture()!.setImage(new Uint8Array(readFileSync(join(signDir, old + '.png')))).setMimeType('image/png');
  mat.setName(old.startsWith('Sign_') ? 'accent' : NAME[old] ?? 'wall');
}

// ป้ายแนวนอนวางระนาบเดียวกับแถบผนัง → ขยับออกมาเล็กน้อยกันภาพกะพริบ
for (const mesh of root.listMeshes()) for (const q of mesh.listPrimitives()) {
  if (!q.getMaterial()!.getName().startsWith('accent') || !q.getAttribute('TEXCOORD_0')) continue;
  const a = q.getAttribute('POSITION')!;
  let zMax = -Infinity;
  for (let i = 0; i < a.getCount(); i++) zMax = Math.max(zMax, a.getElement(i, [] as number[])[2]);
  if (zMax <= 0.35) for (let i = 0; i < a.getCount(); i++) { const [x, y, z] = a.getElement(i, [] as number[]); a.setElement(i, [x, y, z + 0.08]); }
}

// หมุนด้านหน้า (+Z) ไปทาง -X (ทิศตะวันตกบนแผนผัง — ยังเป็นสมมติฐาน) แล้ววาง origin กลางกรอบ
const seen = new Set<Accessor>();
const each = (semantic: string, fn: (v: number[]) => number[]) => {
  for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
    const a = p.getAttribute(semantic);
    if (!a || seen.has(a)) continue;
    seen.add(a);
    const v: number[] = [];
    for (let i = 0; i < a.getCount(); i++) a.setElement(i, fn(a.getElement(i, v)));
  }
};
each('POSITION', ([x, y, z]) => [-(z > FRONT_LIMIT ? FRONT_LIMIT + (z - FRONT_LIMIT) * SQUASH : z), y, x]);
each('NORMAL', ([x, y, z]) => [-z, y, x]);

let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
const positions = new Set(root.listMeshes().flatMap((m) => m.listPrimitives().map((p) => p.getAttribute('POSITION')!)));
for (const a of positions) for (let i = 0; i < a.getCount(); i++) {
  const [x, , z] = a.getElement(i, [] as number[]);
  minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
}
for (const a of positions) for (let i = 0; i < a.getCount(); i++) {
  const [x, y, z] = a.getElement(i, [] as number[]);
  a.setElement(i, [x - (minX + maxX) / 2, y, z - (minZ + maxZ) / 2]);
}

(root.getDefaultScene() ?? root.listScenes()[0]).setExtras({ floors: 9, floorHeight: 3.58 });
await doc.transform(prune(), dedup(), weld(), draco({ method: 'edgebreaker' }));

const out = new URL('../public/models/', import.meta.url);
mkdirSync(out, { recursive: true });
const bytes = await io.writeBinary(doc);
writeFileSync(new URL('B12.glb', out), bytes);
const idx = new URL('index.json', out);
const list: string[] = JSON.parse(readFileSync(idx, 'utf8'));
writeFileSync(idx, JSON.stringify([...new Set([...list, 'B12'])].sort()) + '\n');
console.log(`เขียน models/B12.glb ${(bytes.byteLength / 1024).toFixed(1)} KB`);
