import { defineConfig, type Plugin } from 'vite';

/**
 * DRACOLoader ของ three.js อ้างไฟล์ decoder ใน node_modules ด้วย new URL(..., import.meta.url)
 * ทำให้ Vite คัดลอก decoder อีกชุด (~1.3 MB) ลง dist ทั้งที่แอปใช้ชุดใน public/draco/ (ตามข้อตกลงโมเดล)
 * plugin นี้ตัดค่าเริ่มต้นนั้นออก — scene3d/models.ts เรียก setDecoderPath('draco/') เสมอ
 */
const dracoFromPublic = (): Plugin => ({
  name: 'draco-from-public',
  enforce: 'pre',
  transform(code, id) {
    if (!id.replace(/\\/g, '/').endsWith('/examples/jsm/loaders/DRACOLoader.js')) return null;
    return code.replace(/new URL\(\s*'\.\.\/libs\/draco\/[^']+',\s*import\.meta\.url\s*\)\.toString\(\)/g, "''");
  },
});

// base './' ให้ใช้ได้ทั้ง GitHub Pages (โฟลเดอร์ย่อย) และเปิดในเครื่อง
export default defineConfig({
  base: './',
  plugins: [dracoFromPublic()],
  build: { target: 'es2020' },
});
