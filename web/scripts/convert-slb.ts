/**
 * แปลงโมเดลอาคารจากไฟล์ HTML (Three.js) → public/models/B32.glb
 *   npx tsx scripts/convert-slb.ts "<ไฟล์ .html>"
 * เอาเฉพาะโค้ดสร้างอาคาร (ไม่เอาฉาก แสง UI) · ป้ายชื่อที่เป็น canvas texture ยังไม่แปลง
 * คำเตือน: สคริปต์รันโค้ดส่วนนั้นจากไฟล์ ใช้กับไฟล์ที่อ่านตรวจแล้วเท่านั้น
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import * as THREE from 'three';

const html = readFileSync(process.argv[2], 'utf8');
const cut = (from: string, to: string) => {
  const a = html.indexOf(from), b = html.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`ไม่พบช่วงโค้ด: ${from}`);
  return html.slice(a, b);
};
const code = cut('// Architectural Dimensions', '// ====') + cut('function buildScienceBuilding', '// 6. CAMPUS ENVIRONMENT').replace(/\/\/ =+\s*$/, '');
const scene = new THREE.Group();
new Function('THREE', 'scene', `let buildingGroup; const floorGroups = []; const createSignTexture = () => null;
${code}
buildScienceBuilding();`)(THREE, scene);

// ---------- หมุนด้านหน้า (+Z) ไปทาง +X (ทิศตะวันออกบนแผนผัง — ยังเป็นสมมติฐาน) ----------
const FRONT_LIMIT = 9.6, SQUASH = 0.25; // ส่วนที่ยื่นหน้าอาคาร (กันสาด บันได ที่จอด) ย่อความลึกเหลือ 25%
const SAGE = [0x84afa8, 0xb56e4a], TRIM = [0x5b827c, 0x1e2226, 0x9aa3ab, 0x22252a], GLASS = [0x1d6fa5, 0x263c4d];
const category = (hex: number) => (GLASS.includes(hex) ? 'glass' : SAGE.includes(hex) ? 'accent' : TRIM.includes(hex) ? 'trim' : 'wall');

type Bucket = { color: THREE.Color; name: string; rough: number; metal: number; p: number[]; n: number[] };
const buckets = new Map<string, Bucket>();
scene.updateMatrixWorld(true);
let skipped = 0;
scene.traverse((o) => {
  const m = o as THREE.Mesh;
  if (!m.isMesh) return;
  const mat = m.material as THREE.MeshStandardMaterial;
  if ((mat.type === 'MeshBasicMaterial' && mat.transparent)) { skipped++; return; } // ป้ายชื่อ
  const g = m.geometry.clone().applyMatrix4(m.matrixWorld).toNonIndexed();
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
  const hex = mat.color.getHex();
  const key = String(hex);
  let b = buckets.get(key);
  if (!b) buckets.set(key, (b = { color: mat.color, name: category(hex), rough: mat.roughness ?? 0.8, metal: Math.min(mat.metalness ?? 0, 0.3), p: [], n: [] }));
  for (let i = 0; i < pos.count; i++) {
    let z = pos.getZ(i);
    if (z > FRONT_LIMIT) z = FRONT_LIMIT + (z - FRONT_LIMIT) * SQUASH;
    b.p.push(z, pos.getY(i), -pos.getX(i));
    b.n.push(nor.getZ(i), nor.getY(i), -nor.getX(i));
  }
});

// origin = กลางกรอบที่ระดับพื้น
let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const b of buckets.values()) for (let i = 0; i < b.p.length; i += 3) {
  minX = Math.min(minX, b.p[i]); maxX = Math.max(maxX, b.p[i]);
  minZ = Math.min(minZ, b.p[i + 2]); maxZ = Math.max(maxZ, b.p[i + 2]);
}
const dx = (minX + maxX) / 2, dz = (minZ + maxZ) / 2;

const doc = new Document();
const buffer = doc.createBuffer();
const sc = doc.createScene('scene').setExtras({ floors: 6, floorHeight: 4 });
const root = doc.createNode('B32');
sc.addChild(root);
const mesh = doc.createMesh('building');
for (const b of buckets.values()) {
  for (let i = 0; i < b.p.length; i += 3) { b.p[i] -= dx; b.p[i + 2] -= dz; }
  const mat = doc.createMaterial(b.name).setBaseColorFactor([b.color.r, b.color.g, b.color.b, 1]).setRoughnessFactor(b.rough).setMetallicFactor(b.metal);
  const acc = (a: number[]) => doc.createAccessor().setType('VEC3').setArray(new Float32Array(a)).setBuffer(buffer);
  mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION', acc(b.p)).setAttribute('NORMAL', acc(b.n)).setMaterial(mat));
}
root.setMesh(mesh);

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const { weld } = await import('@gltf-transform/functions');
await doc.transform(weld(), draco({ method: 'edgebreaker' }));
const out = new URL('../public/models/', import.meta.url);
mkdirSync(out, { recursive: true });
const bytes = await io.writeBinary(doc);
writeFileSync(new URL('B32.glb', out), bytes);
const idx = new URL('index.json', out);
const list: string[] = JSON.parse(readFileSync(idx, 'utf8'));
writeFileSync(idx, JSON.stringify([...new Set([...list, 'B32'])].sort()) + '\n');
console.log(`เขียน models/B32.glb ${(bytes.byteLength / 1024).toFixed(1)} KB · วัสดุ ${buckets.size} สี · ข้ามป้ายชื่อ ${skipped} ชิ้น`);
