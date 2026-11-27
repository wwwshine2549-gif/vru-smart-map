# กระดานงาน
สถานะ: รอทำ / กำลังทำ / รอตรวจ / เสร็จ — อัปเดตทุกครั้งก่อนและหลังทำงาน

> 20 พ.ย. 2569: เจ้าของโค้ดสั่งให้ Claude ทำงานเว็บข้อ 1–6 ทั้งหมดบน master (เปลี่ยนจากที่แบ่งให้ Gemini เดิม)
> Gemini: อย่าแก้ `web/src/`, `web/index.html`, `.github/` จนกว่าเจ้าของโค้ดจะแบ่งงานใหม่

| # | งาน | ใคร | สถานะ | ไฟล์ที่แตะ |
|---|---|---|---|---|
| 0 | แยก SERVICES ออกจาก app.ts ไป `src/data/services.ts`, เพิ่มแท็บบริการรายชั้นใน importer, เพิ่มฟิลด์ใน types.ts | Claude | เสร็จ (commit 5ee49f8) | web/src/scene3d/app.ts, web/src/data/services.ts, web/src/types.ts, web/scripts/import-csv.ts |
| 1 | หน้าค้นหา + แผนผัง 2D (หน้าแรก) + ปุ่ม "มุมมอง 3D" lazy-load | Claude | เสร็จ (5431742, b9130e6) | web/src/, web/index.html |
| 2 | ลิงก์ตรง `?b=` `?r=` (คง `#b<เลข>` เดิม) | Claude | เสร็จ (0f9c1e8) | web/src/ |
| 3 | Panel อาคารใช้ buildings/rooms/services จาก JSON + ป้าย "รอตรวจสอบ" | Claude | เสร็จ (5431742) | web/src/ |
| 4 | แผงชั้นข้อมูล เปิด/ปิด | Claude | เสร็จ (d3c94d7) | web/src/ |
| 5 | Model loader ตาม docs/model-contract.md + โมเดลทดสอบ | Claude | เสร็จ (5cdc987) | web/src/scene3d/, web/public/draco/, web/scripts/ |
| 6 | Deploy GitHub Pages ด้วย Actions | Claude | รอ repo บน GitHub (workflow พร้อมแล้ว) | .github/, web/vite.config.ts |
| 8 | (ถ้ามีเวลา) วัดระยะทางเดิน / มุมมองจากรูปถ่าย / ตัดภาพแยกชั้น | — | รอทำ | web/src/ |
| 7 | ปั้นโมเดล B05 อาคาร 80 ปี → B08 อาคาร 100 ปี → B01 อนุสาวรีย์ | Claude | รอทำ (รอรูปถ่ายหลายมุม) | web/public/models/ |

## ขอแก้ไฟล์ของอีกฝ่าย
(ยังไม่มี)
