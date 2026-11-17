import './scene3d/style.css';

// ฉาก 3D (three.js) แยกเป็น chunk ของตัวเอง — หน้า 2D (ขั้น 2) จะโหลด chunk นี้เมื่อกด "มุมมอง 3D"
import('./scene3d/app.ts').catch((err) => {
  console.error(err);
  const el = document.getElementById('loader');
  if (el) el.firstElementChild!.textContent = 'โหลดหุ่นจำลอง 3D ไม่สำเร็จ ลองรีเฟรชหน้า';
});
