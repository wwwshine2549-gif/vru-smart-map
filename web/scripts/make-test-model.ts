/**
 * สร้างโมเดลทดสอบ loader: กล่องหลายชั้นที่ทำตามข้อตกลงโมเดล (docs/model-contract.md)
 * → public/models/_test/B32.glb + public/models/_test/index.json
 * เปิดดูในเว็บด้วย ?models=_test แล้วกด "3D" (โมเดลจริงอยู่ที่ public/models/ ไม่ปนกัน)
 *
 * ใช้:  npm run models:test
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(WEB, 'public', 'models', '_test');
const CODE = 'B32'; // อาคารเรียนรวมวิทยาศาสตร์: footprint ในแผนผัง 38.7 × 104.1 pt (สัดส่วน ≈ 1 : 2.7)

// หน่วยเมตร, +Y ขึ้น, origin กลาง footprint ที่ระดับพื้น, +X = x ของแผนผัง, +Z = y ของแผนผัง (ลงของหน้ากระดาษ)
const W = 15, D = 40, FLOORS = 5, FH = 3.6;

type Mat = 'wall' | 'roof' | 'glass' | 'trim' | 'accent';
const COLORS: Record<Mat, [number, number, number, number]> = {
  wall: [0.93, 0.9, 0.84, 1],
  roof: [0.31, 0.34, 0.37, 1],
  glass: [0.43, 0.56, 0.64, 1],
  trim: [0.96, 0.95, 0.93, 1],
  accent: [0.44, 0.69, 0.64, 1],
};
const geo: Record<Mat, { p: number[]; n: number[]; i: number[] }> = {
  wall: { p: [], n: [], i: [] }, roof: { p: [], n: [], i: [] }, glass: { p: [], n: [], i: [] },
  trim: { p: [], n: [], i: [] }, accent: { p: [], n: [], i: [] },
};

/** กล่องแกนตรง (ศูนย์กลาง cx,cy,cz ขนาด sx,sy,sz) — 24 จุด 12 สามเหลี่ยม */
function box(m: Mat, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) {
  const g = geo[m];
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  const faces: [number[], number[][]][] = [
    [[1, 0, 0], [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]]],
    [[-1, 0, 0], [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]]],
    [[0, 1, 0], [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]]],
    [[0, -1, 0], [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]]],
    [[0, 0, 1], [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]]],
    [[0, 0, -1], [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]]],
  ];
  for (const [n, vs] of faces) {
    const base = g.p.length / 3;
    for (const v of vs) { g.p.push(cx + v[0], cy + v[1], cz + v[2]); g.n.push(...n); }
    g.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
}

// ตัวอาคาร: ทุกชั้นมีพื้น (trim), ผนัง (wall), แถบกระจกด้านยาวทั้งสองด้าน (glass)
for (let f = 0; f < FLOORS; f++) {
  const y0 = f * FH;
  box('trim', 0, y0 + 0.15, 0, W + 0.4, 0.3, D + 0.4);
  box('wall', 0, y0 + 0.3 + (FH - 0.3) / 2, 0, W, FH - 0.3, D);
  for (const sx of [-1, 1]) box('glass', sx * (W / 2 + 0.03), y0 + 0.3 + (FH - 0.3) * 0.55, 0, 0.06, (FH - 0.3) * 0.5, D - 2);
}
box('roof', 0, FLOORS * FH + 0.25, 0, W + 0.6, 0.5, D + 0.6);
// ทางเข้า (accent) ด้าน -Z = ทิศขึ้นของแผนผัง
box('accent', 0, 1.6, -D / 2 - 1.2, 5, 0.25, 2.4);
box('accent', -2.2, 0.8, -D / 2 - 2.2, 0.25, 1.6, 0.25);
box('accent', 2.2, 0.8, -D / 2 - 2.2, 0.25, 1.6, 0.25);

const doc = new Document();
const buffer = doc.createBuffer();
const scene = doc.createScene('scene').setExtras({ floors: FLOORS, floorHeight: FH });
const root = doc.createNode(CODE);
scene.addChild(root);
for (const m of Object.keys(geo) as Mat[]) {
  const g = geo[m];
  const mat = doc.createMaterial(m).setBaseColorFactor(COLORS[m]).setRoughnessFactor(m === 'glass' ? 0.25 : 0.85).setMetallicFactor(m === 'glass' ? 0.3 : 0);
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.p)).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(g.n)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint16Array(g.i)).setBuffer(buffer))
    .setMaterial(mat);
  root.addChild(doc.createNode(m).setMesh(doc.createMesh(m).addPrimitive(prim)));
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
await doc.transform(draco({ method: 'edgebreaker' }));
mkdirSync(OUT, { recursive: true });
const bytes = await io.writeBinary(doc);
writeFileSync(join(OUT, `${CODE}.glb`), bytes);
writeFileSync(join(OUT, 'index.json'), JSON.stringify([CODE]) + '\n');
console.log(`เขียน ${CODE}.glb (${(bytes.byteLength / 1024).toFixed(1)} KB, ${FLOORS} ชั้น × ${FH} ม., ${W}×${D} ม.) → ${OUT}`);
