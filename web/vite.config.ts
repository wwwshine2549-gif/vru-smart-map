import { defineConfig } from 'vite';

// base './' ให้ใช้ได้ทั้ง GitHub Pages (โฟลเดอร์ย่อย) และเปิดในเครื่อง
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
});
