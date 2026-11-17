/** โซนของวิทยาเขต: หน้ามอ / กลางมอ / หลังมอ */
export type Zone = 'front' | 'middle' | 'back';

export const ZONE_LABEL: Record<Zone, string> = {
  front: 'หน้ามอ',
  middle: 'กลางมอ',
  back: 'หลังมอ',
};

export type RoomType = 'ห้องเรียน' | 'แล็บ' | 'สำนักงาน' | 'อื่น ๆ';

export interface Building {
  /** รหัสใน Sheet: B01–B48 ตามเลขแผนผัง, U1–U5 อาคารที่แผนผังไม่มีเลข */
  id: string;
  name: string;
  shortName: string;
  zone: Zone;
  floors: number;
  /** จุดศูนย์กลางบนแผนผัง PDF (หน่วย pt) — null ถ้าอาคารไม่อยู่ในแผนผังปี 2559 */
  x: number | null;
  y: number | null;
  /** รหัสอาคารที่ใช้นำหน้าเลขห้อง เช่น "15" ในห้อง 15-409 */
  roomCode: string | null;
  /** path ภายใต้ public/ เช่น photos/B08_ภายนอก_1.webp */
  photo: string | null;
  description: string | null;
}

export interface Room {
  /** `${buildingId}:${roomNumber}` */
  id: string;
  roomNumber: string;
  buildingId: string;
  floor: number;
  type: RoomType;
  note: string | null;
}
