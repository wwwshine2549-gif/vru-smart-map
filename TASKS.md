# กระดานงาน
สถานะ: รอทำ / กำลังทำ / รอตรวจ / เสร็จ — อัปเดตทุกครั้งก่อนและหลังทำงาน

> 20 พ.ย. 2569: เจ้าของโค้ดสั่งให้ Claude ทำงานเว็บข้อ 1–6 ทั้งหมดบน master (เปลี่ยนจากที่แบ่งให้ Gemini เดิม)
> Gemini: อย่าแก้ `web/src/`, `web/index.html`, `.github/` จนกว่าเจ้าของโค้ดจะแบ่งงานใหม่

| # | งาน | ใคร | สถานะ | ไฟล์ที่แตะ |
|---|---|---|---|---|
| 0 | แยก SERVICES ออกจาก app.ts ไป `src/data/services.ts`, เพิ่มแท็บบริการรายชั้นใน importer, เพิ่มฟิลด์ใน types.ts | Claude | เสร็จ (commit 1092be4) | web/src/scene3d/app.ts, web/src/data/services.ts, web/src/types.ts, web/scripts/import-csv.ts |
| 1 | หน้าค้นหา + แผนผัง 2D (หน้าแรก) + ปุ่ม "มุมมอง 3D" lazy-load | Claude | เสร็จ (ea17810, 09287a2) | web/src/, web/index.html |
| 2 | ลิงก์ตรง `?b=` `?r=` (คง `#b<เลข>` เดิม) | Claude | เสร็จ (01e4968) | web/src/ |
| 3 | Panel อาคารใช้ buildings/rooms/services จาก JSON + ป้าย "รอตรวจสอบ" | Claude | เสร็จ (ea17810) | web/src/ |
| 4 | แผงชั้นข้อมูล เปิด/ปิด | Claude | เสร็จ (1fcbf4a) | web/src/ |
| 5 | Model loader ตาม docs/model-contract.md + โมเดลทดสอบ | Claude | เสร็จ (a07b534) | web/src/scene3d/, web/public/draco/, web/scripts/ |
| 6 | Deploy GitHub Pages ด้วย Actions | Claude | เสร็จ 27 พ.ย. 2569 (db630c6) https://wwwshine2549-gif.github.io/vru-smart-map/ | .github/, web/vite.config.ts |
| 9 | บั๊ก: `15-1203` ได้ชั้น 1 (ต้องเป็นชั้น 12) — regex ใน `findRooms` ให้เลขชั้นหลักเดียว | Claude | เสร็จ 27 พ.ย. — เลขล้วน 4 หลักหลังขีด = ชั้นสองหลัก (กฎอนุมาน ยังต้องยืนยันกับเลขห้องจริงของอาคารอื่น) | web/src/catalog.ts |
| 10 | B32 ขึ้นเว็บแบบรอตรวจ: 36 ห้อง (SCC2) + ห้องประชุมชั้น 5 + โมเดล 6 ชั้น · ข้อมูลอยู่ `web/src/data/pending.json` (Sheet ที่ตรวจแล้วใช้แทนอัตโนมัติ แล้วค่อยลบ) · เจ้าของโค้ดอนุมัติ 27 พ.ย. | Claude | เสร็จ (รอตรวจในชีต, ทิศด้านหน้า, ป้ายชื่อบนโมเดล) | web/ |
| 11 | บั๊กมือถือ: มุมมอง 3D แผงล่างบังอาคารที่เลือก (สาเหตุ: canvas ไม่ได้ตั้งขนาดแสดงผล จอ DPR>1 ภาพใหญ่เกินจอ) | Claude | เสร็จ 27 พ.ย. | web/src/scene3d/app.ts |
| 12 | รูปอ้างอิง B32 (Uni Learning Center, ห้องประชุมชั้น 5) เบลอคน+จอฉาย ลบ EXIF webp — รูปใหม่ต้องคัดคนและเบลอก่อนขึ้นเว็บเสมอ | Claude | เสร็จ 27 พ.ย. | web/public/photos/ |
| 8 | (ถ้ามีเวลา) วัดระยะทางเดิน / มุมมองจากรูปถ่าย / ตัดภาพแยกชั้น | — | รอทำ | web/src/ |
| 7 | ปั้นโมเดล B05 อาคาร 80 ปี → B08 อาคาร 100 ปี → B01 อนุสาวรีย์ | Claude | รอทำ (รอรูปถ่ายหลายมุม) | web/public/models/ |

## ขอแก้ไฟล์ของอีกฝ่าย
(ยังไม่มี)
