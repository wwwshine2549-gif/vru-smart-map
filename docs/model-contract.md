# ข้อตกลงไฟล์โมเดล (.glb) ระหว่าง Claude (ปั้นโมเดล) กับ Gemini (loader)
เปลี่ยนข้อตกลงได้เมื่อทั้งสองฝ่ายตกลงกันใน TASKS.md เท่านั้น

- ที่อยู่: `web/public/models/<รหัสอาคาร>.glb` เช่น `B08.glb`, `U1.glb`
- รายการ: `web/public/models/index.json` เช่น `["B05","B08"]` — loader อ่านก่อน อาคารที่ไม่มีใช้อาคารที่โค้ดสร้างเอง (ของเดิม)
- glTF 2.0 (.glb), หน่วยเมตร, แกน +Y ขึ้น
- origin อยู่กลาง footprint ที่ระดับพื้น
- แกน +X ตามแกน x ของแผนผัง PDF (ขวา), แกน +Z ตามแกน y ของแผนผัง (ลงของหน้ากระดาษ)
- loader ย่อ/ขยายให้พอดีกรอบ footprint ของอาคารใน `src/data/plan.json` ด้วย scale เดียวทั้ง 3 แกน (ห้ามยืดสัดส่วน)
- `scene.extras`: `{ "floors": <จำนวนชั้น>, "floorHeight": <เมตรต่อชั้น> }` ใช้ไฮไลต์/ตัดแยกชั้น
- ชื่อวัสดุ: `wall`, `roof`, `glass`, `trim`, `accent` — ไฮไลต์ตอนเลือกด้วย emissive/outline ห้ามแทนที่สีวัสดุ
- งบขนาด: landmark ≤ 1.5 MB และ ≤ 30k สามเหลี่ยม, อาคารทั่วไป ≤ 300 KB, รวม ≤ 5 MB
- บีบอัด Draco; decoder อยู่ในโปรเจกต์ (`web/public/draco/`) ไม่ดึงจาก CDN
- โหลดตามระยะกล้อง (ไกลไม่โหลด) และ cache

## เครื่องมือ (ไม่ได้เปลี่ยนข้อตกลงด้านบน)
- ตรวจไฟล์ก่อน commit: `cd web && npm run models:check` — ตรวจขนาด, สามเหลี่ยม, Draco, extras, ชื่อวัสดุ, origin, สัดส่วนเทียบแผนผัง
- โมเดลทดสอบ loader: `npm run models:test` → `public/models/_test/B32.glb` (กล่อง 5 ชั้น) เปิดดูด้วย `?models=_test&b=B32` แล้วกด 3D
- Blender: ใส่ `floors`, `floorHeight` ใน Scene Properties > Custom Properties และติ๊ก Include > Custom Properties ตอน export
- ข้อสังเกต: ฉาก 3D เดิมกดความสูงชั้นไว้ 0.46 หน่วย/ชั้น โมเดลที่ย่อขยายเท่ากันทุกแกนจึงสูงกว่าอาคารที่โค้ดสร้างเองประมาณ 2 เท่า (รอตัดสินใจ)
