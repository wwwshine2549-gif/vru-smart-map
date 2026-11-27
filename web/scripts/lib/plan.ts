/** อ่าน data_pdf.js ของ v0.5 (const B=[...]; const MAP={...}) ที่ root ของ repo */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { renumber } from './renumber.ts';

export const DATA_PDF = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'data_pdf.js');

export type PdfRect = [number, number, number, number, (number | null)?, number?];
export type PdfBuilding = [number, string, string, number, PdfRect[], string?];

/** แผนผัง 2559 จาก data_pdf.js แล้วเปลี่ยนเป็นเลขตามแผนผังใหม่ (renumber.ts) */
export function loadPlan(): { B: PdfBuilding[]; MAP: Record<string, unknown>; NOTE: Record<number, string> } {
  const ctx: { B?: PdfBuilding[]; MAP?: Record<string, unknown> } = {};
  vm.runInNewContext(readFileSync(DATA_PDF, 'utf8') + '\n;this.B = B; this.MAP = MAP;', ctx);
  if (!ctx.B || !ctx.MAP) throw new Error(`อ่าน B / MAP จาก ${DATA_PDF} ไม่ได้`);
  return renumber(ctx.B, ctx.MAP);
}
