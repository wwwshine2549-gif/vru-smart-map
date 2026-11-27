/**
 * สร้างหน้า QR ขนาด A5 หน้าละหนึ่งอาคาร → ../qr/vru-qr-a5.html แล้วพิมพ์เป็น PDF ด้วย Edge/Chrome
 *   npm run qr
 * ข้ามอาคารหมวด unknown (ยังไม่มีชื่อ) · ชื่ออาคารใช้จาก Sheet ที่ตรวจแล้ว ถ้ายังไม่มีใช้ชื่อตามแผนผัง 2559
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import QRCode from 'qrcode';

const SITE = process.env.SITE_URL ?? 'https://wwwshine2549-gif.github.io/vru-smart-map/';
const read = <T>(p: string): T => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const { B } = read<{ B: [number, string, string][] }>('../src/data/plan.json');
const sheet = new Map(read<{ id: string; name?: string }[]>('../src/data/buildings.json').map((b) => [b.id, b]));
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const pages: string[] = [];
const list: string[] = [];
for (const [num, planName, cat] of B) {
  if (cat === 'unknown') continue;
  const code = num > 100 ? 'U' + (num - 100) : 'B' + String(num).padStart(2, '0');
  const row = sheet.get(code);
  const name = row?.name || planName;
  const url = `${SITE}?b=${code}`;
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'Q', margin: 4 });
  pages.push(`<section>
  <header>VRU SMART MAP</header>
  <div class="code">${code}</div>
  <h1>${esc(name)}</h1>
  <div class="qr">${svg}</div>
  <p class="cta">สแกนเพื่อดูอาคารนี้บนแผนที่</p>
  <p class="url">${esc(url)}</p>
  <footer>${row ? '' : 'ชื่ออาคารตามแผนผังปี 2559 · รอตรวจสอบหน้างาน<br>'}โครงงานนักศึกษา รายวิชา VGE117</footer>
</section>`);
  list.push(`${code}\t${name}\t${url}`);
}

const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>VRU Smart Map QR A5</title>
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@500;700&family=Sarabun:wght@400;600&display=swap" rel="stylesheet">
<style>
@page{size:A5;margin:0}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Sarabun,sans-serif;color:#17191d}
section{width:148mm;height:209.5mm;padding:11mm 12mm 9mm;display:flex;flex-direction:column;align-items:center;text-align:center;break-after:page;overflow:hidden}
section:last-child{break-after:auto}
header{font:700 13pt Prompt,sans-serif;letter-spacing:.18em}
.code{margin-top:6mm;font:700 30pt Prompt,sans-serif;background:#17191d;color:#fff;border-radius:3mm;padding:0 6mm}
h1{font:500 17pt/1.35 Prompt,sans-serif;margin-top:4mm;min-height:17mm;display:flex;align-items:center;justify-content:center}
.qr{width:96mm;height:96mm;margin-top:3mm}
.qr svg{width:100%;height:100%;display:block}
.cta{font:700 15pt Prompt,sans-serif;margin-top:3mm}
.url{font-size:8.5pt;margin-top:1.5mm;word-break:break-all}
footer{margin-top:auto;font-size:8.5pt;color:#555;line-height:1.5}
</style></head><body>
${pages.join('\n')}
</body></html>`;

const out = new URL('../../qr/', import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL('vru-qr-a5.html', out), html, 'utf8');
writeFileSync(new URL('links.tsv', out), list.join('\n') + '\n', 'utf8');
console.log(`เขียน qr/vru-qr-a5.html (${pages.length} หน้า) และ qr/links.tsv`);
