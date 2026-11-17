import './style.css';
import buildings from './data/buildings.json';
import rooms from './data/rooms.json';
import type { Building, Room } from './types';

// หน้าชั่วคราวจนกว่าจะทำ MVP ค้นหา (ขั้น 2)
const b = buildings as Building[];
const r = rooms as Room[];
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <h1>VRU Smart Map</h1>
  <p>ค้นหาอาคารและห้องเรียน มรภ.วไลยอลงกรณ์ฯ</p>
  <p class="muted">ข้อมูลตอนนี้: ${b.length} อาคาร, ${r.length} ห้อง</p>
`;
