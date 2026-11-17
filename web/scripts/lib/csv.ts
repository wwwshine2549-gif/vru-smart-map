/**
 * CSV parser แบบ RFC 4180 สำหรับไฟล์ที่ export จาก Google Sheet
 * รองรับ BOM, เซลล์ในเครื่องหมาย "..." ที่มี , หรือขึ้นบรรทัดใหม่, "" แทน "
 */
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell); cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

/** แถวข้อมูลพร้อมเลขแถวตามที่เห็นใน Google Sheet (หัวตาราง = แถว 1) */
export interface CsvRecord {
  sheetRow: number;
  get(header: string): string;
  first: string;
}

export function readRecords(text: string): { headers: string[]; records: CsvRecord[] } {
  const [head = [], ...body] = parseCsv(text);
  const headers = head.map((h) => h.trim());
  const index = new Map(headers.map((h, i) => [h, i]));
  const records = body.map((cells, i) => ({
    sheetRow: i + 2,
    first: (cells[0] ?? '').trim(),
    get: (h: string) => {
      const j = index.get(h);
      return j === undefined ? '' : (cells[j] ?? '').trim();
    },
  }));
  return { headers, records };
}
