# กติกาสำหรับ Gemini
อ่านไฟล์เหล่านี้ก่อนเริ่มงานทุกครั้ง ตามลำดับ:
1. `CLAUDE.md` — กติกาโปรเจกต์ทั้งหมด (ชื่อไฟล์เป็นของ Claude แต่ใช้กับทุก AI)
2. `TASKS.md` — กระดานงาน: ใครทำอะไร สถานะอะไร
3. `docs/model-contract.md` — ข้อตกลงไฟล์โมเดล .glb (ห้ามเปลี่ยนเองฝ่ายเดียว)

กติกาทำงานร่วมกับ Claude:
- แก้ได้: `web/src/`, `web/index.html`, `web/vite.config.ts`, `.github/`
- ห้ามแก้ (เป็นของ Claude): `web/public/models/`, `web/scripts/`, ไฟล์ v0.5 ที่ root (`v0*_template.html`, `build.py`, `data_pdf.js`, `tools/`)
  ถ้าจำเป็นต้องแก้ ให้เขียนเหตุผลไว้ใน TASKS.md หัวข้อ "ขอแก้ไฟล์ของอีกฝ่าย" แทน
- ทำงานใน branch ของตัวเอง (`gemini/<ชื่องาน>`) commit แยกตามฟีเจอร์ ห้าม push ทับ main
- อัปเดต TASKS.md ก่อนเริ่มและหลังจบแต่ละงาน
