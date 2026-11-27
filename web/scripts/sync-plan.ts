/** data_pdf.js (v0.5) + เลขแผนผังใหม่ (lib/renumber.ts) → src/data/plan.json — รันใหม่ทุกครั้งที่แก้ data_pdf.js หรือ renumber.ts */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlan } from './lib/plan.ts';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'plan.json');
const plan = loadPlan();
writeFileSync(out, JSON.stringify(plan) + '\n');
console.log(`เขียน ${plan.B.length} อาคาร + MAP (${Object.keys(plan.MAP).join(', ')}) → ${out}`);
