/**
 * Model loader ตามข้อตกลงโมเดล (docs/model-contract.md)
 * - อ่าน models/index.json ก่อน อาคารที่ไม่อยู่ในรายการใช้อาคารที่โค้ดสร้างเอง
 * - GLTFLoader + DRACOLoader (decoder อยู่ใน public/draco/ ไม่ดึงจาก CDN)
 * - ย่อขยายด้วย scale เดียวทั้ง 3 แกนให้พอดี footprint ของอาคารใน plan.json (ไม่ยืดสัดส่วน)
 * - cache ตามรหัสอาคาร: โหลดครั้งเดียวต่อการเปิดหน้า
 * ?models=_test ในลิงก์ = ใช้โฟลเดอร์ public/models/_test/ (โมเดลทดสอบ)
 */
import * as THREE from 'three';
import type { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const MODEL_MATS = ['wall', 'roof', 'glass', 'trim', 'accent'];

/** footprint ในหน่วยฉาก 3D: จุดกลาง, กว้าง (แกน X), ลึก (แกน Z), มุมหมุนรอบแกน Y (เรเดียน) */
export interface Footprint { cx: number; cz: number; w: number; d: number; rotY: number }

export interface LoadedModel {
  root: THREE.Object3D;
  /** วัสดุตามชื่อในข้อตกลง ใช้ทำไฮไลต์ (แก้เฉพาะ emissive) */
  mats: THREE.MeshStandardMaterial[];
  floors: number;
  /** ความสูงต่อชั้นในหน่วยของโมเดล (เมตร) */
  floorHeight: number;
  /** กรอบในพิกัดของโมเดล (ก่อนย่อขยาย) */
  localBox: THREE.Box3;
  /** กรอบในฉาก (หลังย่อขยายและวางตำแหน่ง) */
  box: THREE.Box3;
  scale: number;
}

function modelsBase(): string {
  const sub = new URLSearchParams(location.search).get('models');
  return import.meta.env.BASE_URL + 'models/' + (sub && /^[\w-]+$/.test(sub) ? sub + '/' : '');
}

// GLTFLoader / DRACOLoader แยก chunk: โหลดเฉพาะเมื่อมีโมเดลให้โหลดจริง
let loader: Promise<GLTFLoader> | null = null;
function gltfLoader() {
  loader ??= Promise.all([import('three/addons/loaders/GLTFLoader.js'), import('three/addons/loaders/DRACOLoader.js')]).then(([g, d]) => {
    const draco = new d.DRACOLoader().setDecoderPath(import.meta.env.BASE_URL + 'draco/').setDecoderConfig({ type: 'wasm' });
    return new g.GLTFLoader().setDRACOLoader(draco);
  });
  return loader;
}

export async function listModels(): Promise<string[]> {
  try {
    const r = await fetch(modelsBase() + 'index.json', { cache: 'no-cache' });
    if (!r.ok) return [];
    const j: unknown = await r.json();
    return Array.isArray(j) ? j.filter((x): x is string => typeof x === 'string' && /^(B\d{2}|U\d)$/.test(x)) : [];
  } catch {
    return [];
  }
}

const cache = new Map<string, Promise<LoadedModel | null>>();

export function loadModel(code: string, fp: Footprint): Promise<LoadedModel | null> {
  let p = cache.get(code);
  if (!p) {
    p = gltfLoader().then((l) => l.loadAsync(modelsBase() + code + '.glb')).then((gltf) => fit(gltf.scene, fp), (e) => {
      console.warn(`โหลดโมเดล ${code} ไม่สำเร็จ ใช้อาคารแบบเดิมแทน`, e);
      return null;
    });
    cache.set(code, p);
  }
  return p;
}

function fit(scene: THREE.Group, fp: Footprint): LoadedModel {
  const ex = scene.userData as { floors?: number; floorHeight?: number };
  const localBox = new THREE.Box3().setFromObject(scene);
  const size = localBox.getSize(new THREE.Vector3());
  // scale เดียวทั้ง 3 แกน ให้กรอบโมเดลพอดี footprint (ด้านที่ชนก่อนเป็นตัวกำหนด)
  const k = Math.min(fp.w / Math.max(size.x, 1e-6), fp.d / Math.max(size.z, 1e-6));
  // origin ของโมเดล = กลาง footprint ที่ระดับพื้น (ตามข้อตกลง)
  const root = new THREE.Group();
  root.position.set(fp.cx, 0, fp.cz);
  root.rotation.y = fp.rotY;
  root.scale.setScalar(k);
  root.add(scene);
  const mats: THREE.MeshStandardMaterial[] = [];
  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = m.receiveShadow = true;
    for (const mat of (Array.isArray(m.material) ? m.material : [m.material]) as THREE.MeshStandardMaterial[]) {
      if (MODEL_MATS.includes(mat.name) && 'emissive' in mat && !mats.includes(mat)) mats.push(mat);
    }
  });
  root.updateMatrixWorld(true);
  const floors = Number.isInteger(ex.floors) && ex.floors! > 0 ? ex.floors! : 1;
  const floorHeight = typeof ex.floorHeight === 'number' && ex.floorHeight > 0 ? ex.floorHeight : size.y / floors;
  return { root, mats, floors, floorHeight, localBox, box: new THREE.Box3().setFromObject(root), scale: k };
}

/** กล่องในพิกัดโมเดล → mesh ในฉาก (ใช้ทำกรอบไฮไลต์และแถบชั้น) */
export function boxInModel(m: LoadedModel, min: THREE.Vector3, max: THREE.Vector3, material: THREE.Material, edges?: THREE.LineBasicMaterial) {
  const s = new THREE.Vector3().subVectors(max, min), c = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const g = new THREE.BoxGeometry(s.x, s.y, s.z);
  const out = new THREE.Group();
  const mesh = new THREE.Mesh(g, material);
  mesh.position.copy(c);
  out.add(mesh);
  if (edges) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), edges); e.position.copy(c); out.add(e); }
  out.applyMatrix4(m.root.matrixWorld);
  return out;
}
