/**
 * แปลงโมเดลอาคาร 100 ปี (B02), 80 ปี (B01) และ 50 ปี (B58) ให้ตรง docs/model-contract.md → public/models/
 *   npx tsx scripts/convert-landmarks.ts <B02|B01|B58> "<ต้นฉบับ .glb>" "<ป้ายที่แก้แล้ว .png>"
 * ป้ายที่แก้: เติมตัวเลขที่เป็นกล่อง · เอาตรา/สัญลักษณ์/ภาพบุคคลที่เป็นภาพวาดแทนออก
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { NodeIO, type Accessor } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

interface Cfg { drop: string[]; names: Record<string, string>; turn180: boolean; floors: number; floorHeight: number }
const CFG: Record<string, Cfg> = {
  // อาคาร 50 ปี: ชั้นล่างโล่ง + ห้องจัดกิจกรรมชั้น 2 (เจ้าของโค้ดยืนยัน 2 ชั้น) · ทิศด้านหน้ายังไม่ยืนยัน
  B58: {
    drop: ['ConcreteParkingPlaza', 'ParkingLineWhite', 'SideLawnGrass'], turn180: false, floors: 2, floorHeight: 5.3,
    names: { WarmSandConcrete: 'wall', SandSlabTrim: 'trim', InteriorCreamWall: 'wall', TimberToneLouver: 'accent', DarkBronzeSubframe: 'trim',
      BronzeMetalRailing: 'trim', TintedHallWindow: 'glass', Sign_50th_Anniversary: 'accent' },
  },
  // อาคารเตี้ยของโมเดลอยู่ฝั่ง +Z (ใต้) ตรงกับฐานในแผนผัง จึงไม่หมุน · ตัดตะแกรงพัดลมแอร์ให้ไม่เกินงบสามเหลี่ยม
  B02: {
    drop: ['CampusPlazaGround', 'ACFanGrille'], turn180: false, floors: 15, floorHeight: 3.8,
    names: { OffWhiteConcrete: 'wall', LightGreySlabTrim: 'trim', RecessedBalconyShadow: 'accent', TintedWindowGlass: 'glass',
      AluminumWindowFrame: 'trim', ACCondenserBox: 'trim', PenthouseSlopedRoof: 'roof', RoofTelecomAntenna: 'trim', Sign_100th_Srinagarindra: 'accent' },
  },
  // ด้านหน้าหันทิศเหนือ (ถนนพหลโยธิน) — ยังเป็นสมมติฐาน · จำนวนชั้นยังไม่ยืนยัน ใช้ค่าเดิมในแผนผัง
  B01: {
    drop: ['ReflectingPoolWater', 'FrontGreenLawn', 'WalkwayPavement', 'BrickCurbBorder'], turn180: true, floors: 3, floorHeight: 6,
    names: { PureWhiteConcrete: 'wall', CorniceWhiteTrim: 'trim', CharcoalCoreWall: 'wall', GoldTintedCurtainWall: 'glass', DarkTintedGlass: 'glass',
      BronzeGoldMullion: 'trim', TerracePlanterShrubs: 'accent', SilverFlagPole: 'trim', FlagRedBlueWhite: 'accent', FlagVRUGreen: 'accent', CenterBay_80th_Crest: 'accent' },
  },
};

const [code, src, sign] = process.argv.slice(2);
const cfg = CFG[code];
if (!cfg || !existsSync(src) || !existsSync(sign)) throw new Error('ใช้: <B02|B01|B58> <ต้นฉบับ .glb> <ป้าย .png>');

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(src);
const root = doc.getRoot();
for (const mesh of root.listMeshes()) for (const p of mesh.listPrimitives()) {
  if (cfg.drop.includes(p.getMaterial()!.getName())) { mesh.removePrimitive(p); p.dispose(); }
}
for (const mat of root.listMaterials()) {
  const tex = mat.getBaseColorTexture();
  if (tex) tex.setImage(new Uint8Array(readFileSync(sign))).setMimeType('image/png');
  mat.setName(cfg.names[mat.getName()] ?? 'wall');
}

const prims = () => root.listMeshes().flatMap((m) => m.listPrimitives());
const each = (semantic: string, fn: (v: number[]) => number[]) => {
  const seen = new Set<Accessor>();
  for (const p of prims()) {
    const a = p.getAttribute(semantic);
    if (!a || seen.has(a)) continue;
    seen.add(a);
    for (let i = 0; i < a.getCount(); i++) a.setElement(i, fn(a.getElement(i, [] as number[])));
  }
};
if (cfg.turn180) for (const s of ['POSITION', 'NORMAL']) each(s, ([x, y, z]) => [-x, y, -z]);

let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
each('POSITION', (v) => {
  minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]); minZ = Math.min(minZ, v[2]); maxZ = Math.max(maxZ, v[2]);
  return v;
});
each('POSITION', ([x, y, z]) => [x - (minX + maxX) / 2, y, z - (minZ + maxZ) / 2]);

(root.getDefaultScene() ?? root.listScenes()[0]).setExtras({ floors: cfg.floors, floorHeight: cfg.floorHeight });
await doc.transform(prune(), dedup(), weld(), draco({ method: 'edgebreaker' }));

const out = new URL('../public/models/', import.meta.url);
mkdirSync(out, { recursive: true });
const bytes = await io.writeBinary(doc);
writeFileSync(new URL(`${code}.glb`, out), bytes);
const idx = new URL('index.json', out);
const list: string[] = existsSync(idx) ? JSON.parse(readFileSync(idx, 'utf8')) : [];
writeFileSync(idx, JSON.stringify([...new Set([...list, code])].sort()) + '\n');
console.log(`เขียน models/${code}.glb ${(bytes.byteLength / 1024).toFixed(1)} KB`);
