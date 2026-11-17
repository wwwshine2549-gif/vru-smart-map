#!/usr/bin/env python3
"""Build the VRU Smart Map field-data workbook (.xlsx) for upload/convert to Google Sheets.
Inputs: data_pdf.js (buildings), /tmp/svc.json (SRC + SERVICES from tools/services_v05.js).
Outputs: sheet/vru_field_data.xlsx and sheet/post.json (checkbox + protected ranges for the API step)."""
import json, re, subprocess
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.utils import get_column_letter as CL

ROOT = '/home/claude/vrumap'
OUT = f'{ROOT}/sheet/vru_field_data.xlsx'
B = json.loads(subprocess.check_output(['node', '-e',
    'const s=require("fs").readFileSync(process.argv[1],"utf8");'
    'process.stdout.write(JSON.stringify(new Function(s+";return B;")()))', f'{ROOT}/data_pdf.js']))
SV = json.load(open('/tmp/svc.json'))
SRC, SERVICES = SV['SRC'], SV['SERVICES']

TODAY = '16/11/2569'
HDR, GREY, YEL, BLUE = '1F2937', 'F1F1EF', 'FFF7D6', 'E8F0FE'
STATUS = ['ยังไม่เก็บ', 'เก็บแล้ว รอตรวจ', 'ตรวจแล้ว']
VERIFY = ['ตรงตามข้อมูลเดิม', 'แก้ไขแล้ว', 'ไม่พบที่หน้างาน', 'เพิ่มใหม่จากหน้างาน']
STL = {'web': 'เว็บไซต์มหาวิทยาลัย', 'old': 'แหล่งข้อมูลเก่า', 'conflict': 'แหล่งข้อมูลขัดกัน',
       'infer': 'อนุมานจากเบอร์โทรภายใน'}
SIDE = Side(style='thin', color='D5D8DD')
BOX = Border(left=SIDE, right=SIDE, top=SIDE, bottom=SIDE)
F_BODY = Font(name='Arial', size=10)
F_HDR = Font(name='Arial', size=10, bold=True, color='FFFFFF')
F_EX = Font(name='Arial', size=10, italic=True, color='8A8F98')
F_SEC = Font(name='Arial', size=11, bold=True)
AUTHOR = 'VRU Smart Map'
GPS_NOTE = 'วางพิกัดที่คัดลอกจาก Google Maps เช่น 14.123456, 100.123456 ช่อง lat และ lng จะแยกให้เอง'
LAT = '=IF(${gps}{r}="","",IFERROR(VALUE(TRIM(LEFT(${gps}{r},FIND(",",${gps}{r})-1))),"รูปแบบพิกัดผิด"))'
LNG = '=IF(${gps}{r}="","",IFERROR(VALUE(TRIM(MID(${gps}{r},FIND(",",${gps}{r})+1,40))),"รูปแบบพิกัดผิด"))'


def FILL(c): return PatternFill('solid', start_color=c, end_color=c)


def clean(v):
    if isinstance(v, str):
        v = v.replace(' · ', '; ').replace('·', ';')
        assert '—' not in v, v
    return v


def sub(tpl, r, letters):
    return re.sub(r'\{(\w+)\}', lambda m: str(r) if m.group(1) == 'r' else letters[m.group(1)], tpl)


def col(id, h, k, w, **kw):
    d = dict(id=id, h=h, k=k, w=w); d.update(kw); return d


def gps_cols():
    return [col('gps', 'พิกัด (วางจาก Google Maps)', 'F', 190, fmt='@', note=GPS_NOTE),
            col('lat', 'lat', 'A', 95, fmt='0.000000', f=LAT),
            col('lng', 'lng', 'A', 95, fmt='0.000000', f=LNG)]


def tail(by='ผู้เก็บ', date='วันที่', cb=None):
    out = []
    if cb: out.append(col('cb', cb, 'F', 85, cb=True))
    out += [col('by', by, 'F', 100), col('date', date, 'F', 90, fmt='@'),
            col('st', 'สถานะการตรวจ', 'F', 125, lst=STATUS, strict=True)]
    return out


wb = Workbook()
TABS, CB, PROT = {}, [], []


def style_header(cell):
    cell.font, cell.fill, cell.border = F_HDR, FILL(HDR), BOX
    cell.alignment = Alignment(wrap_text=True, vertical='center')


def build(title, cols, rows, nmax, color, extra_prot=()):
    ws = wb.create_sheet(title)
    ws.sheet_properties.tabColor = color
    letters = {c['id']: CL(i) for i, c in enumerate(cols, 1)}
    assert len(letters) == len(cols), title
    end = nmax + 1
    for i, c in enumerate(cols, 1):
        cell = ws.cell(1, i, c['h']); style_header(cell)
        if c.get('note'): cell.comment = Comment(c['note'], AUTHOR, width=280, height=120)
        ws.column_dimensions[CL(i)].width = round(c['w'] / 7, 1)
    ws.row_dimensions[1].height = 34
    for r in range(2, end + 1):
        row = rows[r - 2] if r - 2 < len(rows) else None
        kind = row.get('_k', 'pre') if row else 'new'
        grey = set(row.get('_g', ())) if row else set()
        for i, c in enumerate(cols, 1):
            cell = ws.cell(r, i)
            v = row.get(c['id']) if row else None
            if v is None and c.get('f'): v = sub(c['f'], r, letters)
            if v is not None: cell.value = clean(v)
            cell.font = F_EX if kind == 'ex' else F_BODY
            if kind == 'ex': fc = None
            elif c['k'] == 'A': fc = BLUE
            elif c['k'] == 'P': fc = GREY if kind == 'pre' else YEL
            else: fc = GREY if c['id'] in grey else YEL
            if fc: cell.fill = FILL(fc)
            cell.border = BOX
            cell.alignment = Alignment(wrap_text=bool(c.get('wrap')), vertical='top')
            if c.get('fmt'): cell.number_format = c['fmt']
    for c in cols:
        L = letters[c['id']]; rng = f'{L}2:{L}{end}'
        if c.get('lst'):
            f1 = '"' + ','.join(c['lst']) + '"'
            assert len(f1) <= 255 and not any(',' in x for x in c['lst']), c['h']
            dv = DataValidation(type='list', formula1=f1, allow_blank=True)
            dv.showErrorMessage = True
            dv.errorStyle = 'stop' if c.get('strict') else 'warning'
            dv.errorTitle, dv.error = 'ค่าไม่อยู่ในรายการ', 'เลือกจากรายการในช่องนี้'
            ws.add_data_validation(dv); dv.add(rng)
        if c.get('cb'): CB.append([title, rng])
        if c['k'] == 'A': PROT.append([title, rng, 'สูตรอัตโนมัติ ห้ามพิมพ์ทับ'])
    PROT.append([title, f'A1:{CL(len(cols))}1', 'หัวตาราง ห้ามแก้ (เว็บดึงข้อมูลตามชื่อนี้)'])
    for rng, d in extra_prot: PROT.append([title, rng, d])
    ws.freeze_panes = 'B2'
    TABS[title] = dict(letters=letters, end=end)
    return ws


# ---------- อาคาร ----------
def code(i): return f'B{i:02d}' if i < 100 else f'U{i - 100}'


ROLE = {}
for i in list(range(1, 8)) + list(range(9, 13)) + [30, 31, 32]: ROLE[i] = 3
ROLE[8] = 2
for i in list(range(13, 25)) + [101, 102]: ROLE[i] = 4
for i in list(range(25, 30)) + list(range(33, 44)) + [103]: ROLE[i] = 5
for i in list(range(44, 49)) + [104, 105]: ROLE[i] = 6
BNOTE = {
    8: 'รหัสในเลขห้องน่าจะเป็น 15 (จากห้อง 15-409) ต้องยืนยัน; ชั้น 1–5 มีข้อมูลบริการจากเว็บแล้ว ดูแท็บบริการรายชั้น',
    14: 'ยืนยันว่าเป็นศูนย์อาหารเดียวกับประกาศปี 2565 (11 ร้าน 2 ซุ้ม)',
    16: 'เป็นกลุ่มอาคารหลายหลัง ระบุว่าหลังไหนคือสำนักงานคณะ',
    18: 'เว็บไซต์มหาวิทยาลัยเรียกอาคารนี้ว่า "ตึกสีม่วง"',
    26: 'แผนผังเรียกอาคารสำนักวิทยบริการฯ เว็บไซต์เรียกอาคารหอสมุดกลาง ยืนยันว่าเป็นหลังเดียวกัน',
    32: 'ประกาศปี 2569 ระบุว่ามี VRU CO-LEARNING SPACE ในอาคารนี้',
    45: 'แผนผังปี 2559 ระบุว่ากำลังก่อสร้าง ยืนยันชื่อและการใช้งานปัจจุบัน',
    48: 'บ้านพักหลายหลังทั่วพื้นที่ด้านหลัง เก็บเฉพาะทางเข้าหลักและจำนวนหลังโดยประมาณ',
}
for i in range(101, 106): BNOTE[i] = 'แผนผังวาดอาคารไว้แต่ไม่มีหมายเลข หาชื่อจริงและการใช้งาน'
B_COLS = [
    col('id', 'รหัส', 'P', 60, note='ที่มา: แผนผังอาคาร มหาวิทยาลัยราชภัฏวไลยอลงกรณ์ ปี 2559 (MapVRU-2016.pdf) รหัส U1–U5 คืออาคารที่แผนผังไม่มีหมายเลข'),
    col('name', 'ชื่อตามแผนผัง 2559', 'P', 250, wrap=True),
    col('zone', 'โซน', 'P', 70),
    col('who', 'ผู้รับผิดชอบ (คนที่)', 'P', 90),
    col('whoname', 'ชื่อผู้รับผิดชอบ', 'A', 120,
        f="=IF(${who}{r}=\"\",\"\",IFERROR(VLOOKUP(${who}{r},'แบ่งงาน'!$A$2:$C$9,3,FALSE)&\"\",\"\"))"),
    col('real', 'ชื่อบนป้ายจริง / ชื่อที่คนเรียก', 'F', 200, wrap=True),
    col('rcode', 'รหัสอาคารในเลขห้อง', 'F', 95, fmt='@', note='ตัวเลขหน้าขีดในเลขห้อง เช่น ห้อง 15-409 คืออาคารรหัส 15'),
    col('fl_web', 'จำนวนชั้นในเว็บ (ประมาณ)', 'P', 95,
        note='จำนวนชั้นที่เว็บใช้วาดโมเดล 3D ประมาณจากหุ่นจำลองมหาวิทยาลัย ให้กรอกจำนวนชั้นจริงในคอลัมน์ถัดไป'),
    col('fl', 'จำนวนชั้นจริง', 'F', 80),
    col('lift', 'ลิฟต์', 'F', 70, lst=['มี', 'ไม่มี']),
    col('ramp', 'ทางลาด', 'F', 70, lst=['มี', 'ไม่มี']),
    col('wc', 'ห้องน้ำผู้พิการ (ชั้น)', 'F', 100),
    col('hours', 'เวลาเปิด–ปิด', 'F', 110),
    col('gps', 'พิกัดทางเข้าหลัก (วางจาก Google Maps)', 'F', 190, fmt='@', note=GPS_NOTE),
    col('lat', 'lat', 'A', 95, fmt='0.000000', f=LAT),
    col('lng', 'lng', 'A', 95, fmt='0.000000', f=LNG),
    col('wall', 'สีผนังหลัก', 'F', 90),
    col('roof', 'สีหลังคา', 'F', 90),
    col('cmp', 'เทียบกับแผนผัง 2559', 'F', 140, lst=['ตรงกับแผนผัง', 'เปลี่ยนชื่อ', 'รื้อแล้ว', 'สร้างใหม่หรือต่อเติม', 'ไม่พบ']),
    col('cb_fp', 'ถ่ายป้ายผังชั้นแล้ว', 'F', 85, cb=True),
    col('cb_ph', 'ถ่ายรูปครบตามมาตรฐาน', 'F', 95, cb=True),
    col('note', 'ปัญหาที่พบ / หมายเหตุ', 'F', 260, wrap=True),
] + tail(date='วันที่เก็บ')
b_rows = []
for b in sorted(B, key=lambda x: x[0]):
    i = b[0]; ys = [r[1] + r[3] / 2 for r in b[4]]; py = sum(ys) / len(ys)
    row = dict(id=code(i), name=b[1], zone='หน้ามอ' if py < 640 else 'กลางมอ' if py < 1400 else 'หลังมอ',
               who=ROLE[i], fl_web=b[3], st='ยังไม่เก็บ', _g=[])
    if i in BNOTE: row['note'] = BNOTE[i]; row['_g'].append('note')
    if i == 8: row['rcode'] = '15'; row['_g'].append('rcode')
    b_rows.append(row)
assert len(b_rows) == 53 and all(i in ROLE for i in [b[0] for b in B])
build('อาคาร', B_COLS, b_rows, 60, 'F2C94C', extra_prot=[('A2:D61', 'รหัสและชื่ออาคารใช้จับคู่กับเว็บ')])

# ---------- บริการรายชั้น ----------
S_COLS = [
    col('bid', 'รหัสอาคาร', 'P', 75, note='ข้อมูลตั้งต้นรวบรวมจากเว็บไซต์มหาวิทยาลัยเมื่อ 16/11/2569 ดูรหัสในคอลัมน์แหล่งข้อมูลเดิมเทียบกับแท็บแหล่งข้อมูล'),
    col('fl', 'ชั้น', 'P', 55),
    col('unit', 'หน่วยงาน / ห้อง', 'P', 230, wrap=True),
    col('room', 'เลขห้อง', 'P', 120, fmt='@', wrap=True),
    col('tasks', 'ทำอะไรได้บ้าง (คั่นด้วย ;)', 'P', 290, wrap=True),
    col('docs', 'เอกสารที่ต้องเตรียม (คั่นด้วย ;)', 'P', 250, wrap=True),
    col('hours', 'เวลาทำการ', 'F', 110),
    col('queue', 'ช่วงที่คิวยาว', 'F', 110),
    col('online', 'ทำออนไลน์ได้ไหม / ช่องทาง', 'F', 170, wrap=True),
    col('ph', 'เบอร์โทร / LINE / เพจของหน่วยงาน', 'P', 190, wrap=True),
    col('tip', 'ข้อควรรู้', 'P', 290, wrap=True),
    col('src', 'แหล่งข้อมูลเดิม', 'P', 110, wrap=True),
    col('srcst', 'ที่มาของข้อมูลเดิม', 'P', 130, wrap=True),
    col('ver', 'ผลเทียบของจริง', 'F', 150, lst=VERIFY),
] + tail(date='วันที่ตรวจ', cb='ถ่ายรูปป้ายแล้ว')
s_rows = []
for bid in sorted(SERVICES, key=int):
    for f in sorted(SERVICES[bid]['floors'], key=lambda x: 99 if x == '0' else int(x)):
        for u in SERVICES[bid]['floors'][f]:
            tips = ([f"ช่วงนี้: {u['hot']}"] if u.get('hot') else []) + [u[k] for k in ('tip', 'note') if u.get(k)]
            s_rows.append(dict(bid=code(int(bid)), fl='ไม่ระบุ' if f == '0' else int(f), unit=u['n'],
                               room=u.get('room'), tasks='; '.join(u.get('t', [])) or None,
                               docs='; '.join(d.replace(' · ', ', ') for d in u.get('d', [])) or None,
                               ph=u.get('ph'), tip='\n'.join(tips) or None, src='; '.join(u['s']),
                               srcst=STL[u['st']], st='ยังไม่เก็บ'))
build('บริการรายชั้น', S_COLS, s_rows, 200, 'F2C94C')

# ---------- ห้อง ----------
R_COLS = [
    col('bid', 'รหัสอาคาร', 'P', 75),
    col('fl', 'ชั้น', 'P', 55),
    col('r0', 'เลขห้องเริ่ม', 'P', 100, fmt='@'),
    col('r1', 'เลขห้องสุดท้าย', 'P', 100, fmt='@', note='ห้องเดี่ยวให้ใส่เลขเดียวกับเลขห้องเริ่ม'),
    col('name', 'ชื่อห้อง / ใช้ทำอะไร', 'P', 250, wrap=True),
    col('type', 'ประเภท', 'P', 120, lst=['ห้องเรียน', 'ห้องปฏิบัติการ', 'ห้องประชุม', 'สำนักงาน', 'ห้องพักอาจารย์', 'ห้องน้ำ', 'อื่น ๆ']),
    col('cap', 'ความจุ (คน)', 'F', 80),
    col('src', 'แหล่งข้อมูล', 'P', 140, wrap=True),
] + tail(cb='ถ่ายรูปป้ายห้องแล้ว')
r_rows = [dict(_k='ex', bid='ตัวอย่าง (ลบแถวนี้)', fl=3, r0='XX-301', r1='XX-312', name='ห้องเรียนทั้งชั้น กรอกเป็นช่วงเลขห้องได้',
               type='ห้องเรียน', cap=45, src='ป้ายผังชั้น', cb=True, by='ชื่อผู้เก็บ', date='20/11/2569', st='เก็บแล้ว รอตรวจ')]
for fl, r0, name, src in [(4, '15-409', 'ห้องประชุมบัณฑิตวิทยาลัย (เว็บเขียนว่า 15-4GS9)', 'grad; old'),
                          (3, None, 'ห้องประชุมสภามหาวิทยาลัย', 'meet; grad'),
                          (3, None, 'ห้องประชุมเจ้าฟ้าวไลยอลงกรณ์', 'meet; grad'),
                          (3, None, 'ห้องประชุมเพชรบริหาร', 'meet; grad'),
                          (5, None, 'ห้องประชุมราชนครินทร์', 'meet')]:
    r_rows.append(dict(bid='B08', fl=fl, r0=r0, r1=r0, name=name, type='ห้องประชุม', src=src, st='ยังไม่เก็บ'))
r_rows.append(dict(bid='B26', fl=2, name='ห้อง Inspiration Lab (ห้องอบรม)', type='อื่น ๆ', src='lib3', st='ยังไม่เก็บ'))
build('ห้อง', R_COLS, r_rows, 300, 'F2C94C')

# ---------- ร้านค้าในแผนผัง ----------
SH_COLS = [
    col('id', 'รหัส', 'P', 60),
    col('name', 'ร้าน / จุดบริการ', 'P', 170, wrap=True),
    col('who', 'ผู้รับผิดชอบ (คนที่)', 'P', 90),
    col('loc', 'ตำแหน่งตามข้อมูลเดิม', 'P', 190, wrap=True),
    col('old', 'ข้อมูลเดิม', 'P', 240, wrap=True),
    col('src', 'แหล่งข้อมูลเดิม', 'P', 100),
    col('todo', 'สิ่งที่ต้องเช็ก', 'P', 230, wrap=True),
    col('now', 'สถานะจริง', 'F', 150, lst=['ยังอยู่ที่เดิม', 'ย้ายที่', 'เปลี่ยนเป็นร้านอื่น', 'ปิดแล้ว', 'ไม่อยู่ในแผนผัง']),
    col('cur', 'ชื่อร้าน / รายละเอียดปัจจุบัน', 'F', 220, wrap=True),
    col('hours', 'เวลาเปิด–ปิด', 'F', 110),
] + gps_cols() + [col('cb', 'ถ่ายรูปแล้ว', 'F', 80, cb=True), col('by', 'ผู้เก็บ', 'F', 100),
                  col('date', 'วันที่', 'F', 90, fmt='@'), col('rem', 'หมายเหตุ', 'F', 200, wrap=True),
                  col('st', 'สถานะการตรวจ', 'F', 125, lst=STATUS, strict=True)]
sh_rows = [
    dict(id='R001', name='โรงอาหาร (ศูนย์อาหาร)', who=4, loc='อาคาร 14 อาคารโรงอาหาร', old='ประกาศปี 2565 ระบุร้านอาหาร 11 ร้าน และ 2 ซุ้ม',
         src='map2559; food', todo='นับจำนวนร้านจริง จดชื่อร้านและเวลาเปิด–ปิด'),
    dict(id='R002', name='ธนาคารกรุงไทย', who=4, loc='อาคาร 21', old='แผนผังปี 2559 ระบุอาคาร 21 เป็นธนาคารกรุงไทย',
         src='map2559', todo='ยังเปิดอยู่ไหม เวลาทำการ และจำนวนตู้ ATM'),
    dict(id='R003', name='ร้าน Family Mart', who=4, loc='อาคาร 22', old='แผนผังปี 2559 ระบุอาคาร 22 เป็นร้าน Family Mart',
         src='map2559', todo='ยังเป็น Family Mart หรือเปลี่ยนเป็นร้านอื่นแล้ว และเวลาเปิด–ปิด'),
    dict(id='R004', name='ร้านค้าต้นคูณ', who=5, loc='หน้าโรงเรียนสาธิต (ยังไม่ทราบจุดแน่ชัด)',
         old='ไม่อยู่ในแผนผัง เว็บไซต์ SDG ของมหาวิทยาลัยปี 2569 ระบุว่าร้านนี้มีถังขยะแยกประเภท', src='sdg',
         todo='ตำแหน่งจริง ขายอะไร และเวลาเปิด–ปิด', now='ไม่อยู่ในแผนผัง', _g=['now']),
    dict(id='R005', name='VRU Mall', who=1, loc='ยังไม่ทราบ',
         old='ไม่อยู่ในแผนผัง ประกาศมหาวิทยาลัยปี 2569 เปิดรับผู้ประกอบการเช่าพื้นที่ VRU Mall', src='mall',
         todo='ตำแหน่งจริง มีร้านอะไรบ้าง และเปิดให้บริการแล้วหรือยัง', now='ไม่อยู่ในแผนผัง', _g=['now']),
]
for r in sh_rows: r['st'] = 'ยังไม่เก็บ'
build('ร้านค้าในแผนผัง', SH_COLS, sh_rows, 60, 'F2C94C')

# ---------- ชุมชนรอบมอ ----------
C_COLS = [
    col('id', 'รหัส', 'F', 60),
    col('name', 'ชื่อสถานที่', 'F', 180, wrap=True),
    col('type', 'ประเภท', 'F', 140, lst=['ร้านอาหาร', 'ร้านกาแฟ / เครื่องดื่ม', 'ร้านสะดวกซื้อ', 'ร้านถ่ายเอกสาร / ปริ้น', 'หอพัก',
                                      'ร้านซ่อม', 'คลินิก / ร้านยา', 'ตลาด', 'ATM / ธนาคาร', 'อื่น ๆ']),
    col('loc', 'ถนน / ฝั่ง / จุดสังเกต', 'F', 190, wrap=True),
] + gps_cols() + [
    col('walk', 'เดินจากประตูมหาวิทยาลัย (นาที)', 'F', 100),
    col('hours', 'เวลาเปิด–ปิด', 'F', 110),
    col('price', 'ช่วงราคา', 'F', 100),
    col('contact', 'ช่องทางติดต่อของร้าน (เบอร์ร้าน / เพจ)', 'F', 170, wrap=True),
    col('ok_photo', 'ร้านยินยอมให้ถ่ายรูป', 'F', 90, cb=True),
    col('ok_pub', 'ร้านยินยอมให้เผยแพร่', 'F', 90, cb=True),
    col('cb', 'ถ่ายรูปแล้ว', 'F', 80, cb=True),
    col('by', 'ผู้เก็บ', 'F', 100), col('date', 'วันที่', 'F', 90, fmt='@'),
    col('rem', 'หมายเหตุ', 'F', 200, wrap=True),
    col('st', 'สถานะการตรวจ', 'F', 125, lst=STATUS, strict=True)]
c_rows = [dict(_k='ex', id='ตัวอย่าง (ลบแถวนี้)', name='ร้านข้าวมันไก่ (ตัวอย่าง)', type='ร้านอาหาร', loc='ฝั่งตรงข้ามประตูทางเข้า',
               gps='14.123456, 100.123456', walk=5, hours='07.00–14.00', price='40–60 บาท', contact='เพจ Facebook ของร้าน',
               ok_photo=True, ok_pub=True, cb=True, by='ชื่อผู้เก็บ', date='20/11/2569', st='เก็บแล้ว รอตรวจ')]
build('ชุมชนรอบมอ', C_COLS, c_rows, 150, 'F2C94C')

# ---------- สิ่งแวดล้อม-จิตอาสา ----------
E_COLS = [
    col('id', 'รหัส', 'P', 60),
    col('name', 'จุด / ตำแหน่ง', 'P', 220, wrap=True),
    col('bid', 'รหัสอาคาร', 'P', 80),
    col('type', 'ประเภท', 'P', 160, lst=['ถังขยะแยกประเภท', 'จุดเติมน้ำดื่ม', 'จุดรับขยะรีไซเคิล', 'พื้นที่สีเขียว / จุดปลูกต้นไม้',
                                      'จุดทำกิจกรรมจิตอาสา', 'อื่น ๆ']),
    col('desc', 'รายละเอียด', 'P', 260, wrap=True),
    col('src', 'แหล่งข้อมูลเดิม', 'P', 100),
] + gps_cols() + [col('ver', 'ผลเทียบของจริง', 'F', 150, lst=VERIFY)] + tail(cb='ถ่ายรูปแล้ว')
e_rows = [
    dict(id='E001', name='อาคาร 100 ปี ชั้น 1–5 (โซนนักศึกษา)', bid='B08', type='ถังขยะแยกประเภท',
         desc='เว็บไซต์ SDG ระบุว่ามีโซนนักศึกษาพร้อมถังขยะแยกประเภทตั้งแต่ชั้น 1 ถึงชั้น 5', src='sdg'),
    dict(id='E002', name='ร้านค้าต้นคูณ (หน้าโรงเรียนสาธิต)', type='ถังขยะแยกประเภท',
         desc='เว็บไซต์ SDG ระบุว่ามีถังขยะแยกประเภทที่ร้านนี้', src='sdg'),
    dict(id='E003', name='อาคารศูนย์วิทยาศาสตร์', bid='B10', type='ถังขยะแยกประเภท',
         desc='เว็บไซต์ SDG ระบุว่ามีถังขยะแยกประเภทที่อาคารนี้', src='sdg'),
]
for r in e_rows: r['st'] = 'ยังไม่เก็บ'
build('สิ่งแวดล้อม-จิตอาสา', E_COLS, e_rows, 100, 'F2C94C')

# ---------- ความปลอดภัย-การเดินทาง ----------
SF_COLS = [
    col('id', 'รหัส', 'F', 60),
    col('type', 'ประเภท', 'F', 150, lst=['จุดมืด', 'ไฟส่องสว่างเสีย', 'กล้องวงจรปิด', 'จุด รปภ.', 'จุดจอดรถ', 'ป้ายรถสาธารณะ',
                                      'วินมอเตอร์ไซค์', 'ทางม้าลาย', 'ทางเท้าชำรุด', 'น้ำท่วมขัง', 'อื่น ๆ']),
    col('loc', 'ตำแหน่ง / ใกล้อาคาร', 'F', 220, wrap=True),
] + gps_cols() + [
    col('time', 'ช่วงเวลา', 'F', 90, lst=['กลางวัน', 'กลางคืน', 'ทั้งวัน']),
    col('risk', 'ระดับความเสี่ยง', 'F', 90, lst=['ต่ำ', 'กลาง', 'สูง']),
    col('desc', 'รายละเอียด', 'F', 260, wrap=True),
] + tail(cb='ถ่ายรูปแล้ว')
sf_rows = [dict(_k='ex', id='ตัวอย่าง (ลบแถวนี้)', type='จุดมืด', loc='ทางเดินระหว่างลานจอดรถกับหอพัก (ตัวอย่าง)',
                gps='14.123456, 100.123456', time='กลางคืน', risk='สูง', desc='ไฟเสาเสีย 2 ต้น ทางเดินยาวประมาณ 50 เมตร',
                cb=True, by='ชื่อผู้เก็บ', date='20/11/2569', st='เก็บแล้ว รอตรวจ')]
build('ความปลอดภัย-การเดินทาง', SF_COLS, sf_rows, 100, 'F2C94C')

# ---------- พิกัดอ้างอิง ----------
G_COLS = [
    col('id', 'รหัส', 'P', 55),
    col('name', 'จุดอ้างอิง', 'P', 220, wrap=True),
    col('stand', 'ตำแหน่งที่ต้องยืน', 'P', 290, wrap=True),
    col('x', 'x บนแผนผัง (pt)', 'P', 85, fmt='0.0',
        note='หน่วย pt ของไฟล์ MapVRU-2016.pdf เว็บใช้จับคู่กับ lat/lng เพื่อแปลงพิกัดแผนผังเป็นพิกัดจริง ห้ามแก้'),
    col('y', 'y บนแผนผัง (pt)', 'P', 85, fmt='0.0'),
] + gps_cols() + tail()
NEAR, FAR = 'มุมอาคารที่ใกล้ถนนพหลโยธินที่สุด ด้านที่ไกลจากอนุสาวรีย์', 'มุมอาคารที่ไกลถนนพหลโยธินที่สุด ด้านที่ไกลจากถนนสายกลางของมหาวิทยาลัย'
g_rows = [dict(id='G1', name='อนุสาวรีย์เจ้าฟ้าวไลยอลงกรณ์', stand='กึ่งกลางฐานอนุสาวรีย์ (ยืนชิดฐาน)', x=392.7, y=341.4),
          dict(id='G2', name='อาคาร 3 อาคารสมเด็จเจ้าฟ้าวไลยอลงกรณ์', stand=NEAR, x=211.6, y=252.7),
          dict(id='G3', name='อาคาร 9 อาคาร 75 ปี วไลยอลงกรณ์', stand=NEAR, x=572.6, y=375.3),
          dict(id='G4', name='อาคาร 32 อาคารเรียนรวมวิทยาศาสตร์', stand=FAR, x=141.3, y=1021.0),
          dict(id='G5', name='สนามกีฬากลาง', stand='จุดกึ่งกลางสนามฟุตบอล', x=406.0, y=1787.0)]
for r in g_rows: r['st'] = 'ยังไม่เก็บ'
build('พิกัดอ้างอิง', G_COLS, g_rows, 10, 'F2C94C', extra_prot=[('A2:E6', 'จุดอ้างอิงและพิกัดบนแผนผัง ห้ามแก้')])

# ---------- ปัญหาที่พบ ----------
P_COLS = [
    col('id', 'รหัส', 'P', 60),
    col('type', 'ประเภท', 'P', 160, lst=['แผนผังไม่ตรงของจริง', 'ข้อมูลออนไลน์ขัดกัน', 'ข้อมูลยังไม่ยืนยัน', 'ป้ายบอกทางขาดหรือผิด',
                                      'การเข้าถึงสำหรับผู้พิการ', 'อื่น ๆ']),
    col('title', 'เรื่อง', 'P', 220, wrap=True),
    col('where', 'ตำแหน่ง / รหัสอาคาร', 'P', 110, wrap=True),
    col('desc', 'รายละเอียด', 'P', 300, wrap=True),
    col('by', 'ผู้พบ', 'P', 100),
    col('date', 'วันที่', 'P', 90, fmt='@'),
    col('fix', 'วิธีจัดการในเว็บ', 'P', 240, wrap=True),
    col('st', 'สถานะ', 'F', 100, lst=['เปิดอยู่', 'แก้แล้ว', 'ไม่แก้'], strict=True),
]
PR = [
    ('แผนผังไม่ตรงของจริง', 'แผนผังทางการเป็นฉบับปี 2559', 'ทั้งมหาวิทยาลัย',
     'แผนผังอายุ 10 ปี ชื่ออาคาร หน่วยงาน และร้านค้าอาจเปลี่ยนแล้ว', 'ใช้ข้อมูลภาคสนามที่ตรวจแล้วแทนข้อมูลแผนผัง'),
    ('แผนผังไม่ตรงของจริง', 'ร้านค้าในแผนผังอาจไม่อัปเดต', 'B14, B21, B22',
     'แผนผังระบุโรงอาหาร ธนาคารกรุงไทย และร้าน Family Mart ยังไม่รู้ว่ายังเปิดอยู่หรือไม่', 'เช็กในแท็บร้านค้าในแผนผัง'),
    ('แผนผังไม่ตรงของจริง', 'อาคาร 45 ระบุว่า "กำลังก่อสร้าง"', 'B45',
     'แผนผังปี 2559 ระบุว่าอาคารหอพักนักศึกษานานาชาติกำลังก่อสร้าง', 'เว็บแสดงเป็นไซต์ก่อสร้างจนกว่าจะยืนยัน'),
    ('แผนผังไม่ตรงของจริง', 'อาคารไม่มีหมายเลข 5 หลัง', 'U1–U5',
     'แผนผังวาดอาคารไว้ 5 หลังแต่ไม่ระบุชื่อ', 'เว็บแสดงเป็น "อาคารไม่มีหมายเลขในแผนผัง"'),
    ('แผนผังไม่ตรงของจริง', 'VRU Mall ไม่อยู่ในแผนผัง', 'ยังไม่ทราบ',
     'ประกาศมหาวิทยาลัยปี 2569 กล่าวถึง VRU Mall แต่แผนผังไม่มี', 'เพิ่มเป็นจุดใหม่เมื่อได้พิกัด'),
    ('ข้อมูลออนไลน์ขัดกัน', 'ชั้นของเคาน์เตอร์ยืม–คืนหนังสือ', 'B26',
     'ระบบ OPAC ระบุชั้น 3 แต่ประกาศห้องสมุดปี 2569 ระบุชั้น 1', 'เว็บติดป้าย "แหล่งข้อมูลขัดกัน" จนกว่าจะยืนยัน'),
    ('ข้อมูลออนไลน์ขัดกัน', 'ชื่ออาคาร 26', 'B26',
     'แผนผังเรียกอาคารสำนักวิทยบริการและเทคโนโลยีสารสนเทศ เว็บไซต์เรียกอาคารหอสมุดกลาง', 'ค้นหาได้ทั้งสองชื่อ'),
    ('ข้อมูลยังไม่ยืนยัน', 'ชั้นของงานการเงินและบางหน่วยงานในอาคาร 100 ปี', 'B08',
     'ชั้นของงานการเงิน งานอาคารสถานที่ และห้องเลขานุการผู้บริหาร อนุมานจากเบอร์โทรภายใน ยังไม่มีแหล่งยืนยัน',
     'เว็บติดป้าย "อนุมาน" จนกว่าจะยืนยัน'),
    ('ข้อมูลยังไม่ยืนยัน', 'ศูนย์อาหารกับอาคารโรงอาหาร', 'B14',
     'ประกาศปี 2565 พูดถึงศูนย์อาหาร ยังไม่ยืนยันว่าเป็นอาคาร 14', 'แสดงที่อาคาร 14 พร้อมป้ายแหล่งข้อมูลเก่า'),
    ('ข้อมูลยังไม่ยืนยัน', 'สำนักงานคณะเทคโนโลยีการเกษตร', 'B16',
     'กลุ่มอาคาร 16 มีหลายหลัง ยังไม่รู้ว่าสำนักงานคณะอยู่หลังไหน', 'แสดงที่กลุ่มอาคาร 16 จนกว่าจะยืนยัน'),
]
p_rows = [dict(id=f'P{i:03d}', type=t, title=ti, where=w, desc=d, by='ทีมเว็บ', date=TODAY, fix=fx, st='เปิดอยู่')
          for i, (t, ti, w, d, fx) in enumerate(PR, 1)]
build('ปัญหาที่พบ', P_COLS, p_rows, 100, '9CA3AF')

# ---------- แหล่งข้อมูล ----------
USED = {}
for tab, rows, key in [('บริการรายชั้น', s_rows, 'src'), ('ห้อง', r_rows[1:], 'src'),
                       ('ร้านค้าในแผนผัง', sh_rows, 'src'), ('สิ่งแวดล้อม-จิตอาสา', e_rows, 'src')]:
    for r in rows:
        for k in (r.get(key) or '').split('; '):
            if k: USED.setdefault(k, []).append(tab) if tab not in USED.get(k, []) else None
USED['map2559'] = ['อาคาร'] + USED.get('map2559', []) + ['พิกัดอ้างอิง', 'ปัญหาที่พบ']
SR_COLS = [col('id', 'รหัส', 'P', 75), col('t', 'แหล่งข้อมูล', 'P', 300, wrap=True), col('u', 'URL', 'P', 330, wrap=True),
           col('y', 'ปีของข้อมูล', 'P', 100, fmt='@'), col('tabs', 'ใช้ในแท็บ', 'P', 220, wrap=True),
           col('at', 'ดึงข้อมูลเมื่อ', 'P', 100, fmt='@')]
sr_rows = [dict(id='map2559', t='แผนผังอาคาร มหาวิทยาลัยราชภัฏวไลยอลงกรณ์ ในพระบรมราชูปถัมภ์ (ไฟล์ MapVRU-2016.pdf)',
                u='ไฟล์ PDF ที่กลุ่มได้รับ (ไม่มีลิงก์ออนไลน์)', y='2559', tabs='; '.join(USED['map2559']), at=TODAY)]
for k, v in SRC.items():
    assert k in USED, k
    sr_rows.append(dict(id=k, t=v['t'], u=v['u'], y=v['y'], tabs='; '.join(USED[k]), at=TODAY))
ws = build('แหล่งข้อมูล', SR_COLS, sr_rows, 40, '9CA3AF')
for r in range(3, len(sr_rows) + 2): ws.cell(r, 3).hyperlink = ws.cell(r, 3).value

# ---------- แบ่งงาน (index 1) ----------
bl, ST = TABS['อาคาร']['letters'], lambda t: TABS[t]['letters']['st']
ws1 = wb.create_sheet('แบ่งงาน', 0)
ws1.sheet_properties.tabColor = HDR
H1 = [('คนที่', 55, 'P'), ('บทบาท', 200, 'P'), ('ชื่อสมาชิก', 150, 'F'), ('อาคาร / พื้นที่ที่รับผิดชอบ', 230, 'P'),
      ('งานหลัก', 390, 'P'), ('อาคารที่ได้รับมอบหมาย', 100, 'A'), ('ตรวจแล้ว', 80, 'A'), ('ความคืบหน้า', 95, 'A')]
ROLES = [
    ('หัวหน้าข้อมูล', 'ทั้งโครงการ',
     'ตรวจข้อมูลทุกแท็บแล้วเปลี่ยนสถานะเป็น "ตรวจแล้ว"; เก็บพิกัดอ้างอิง 5 จุด; ทำหนังสือขอผังอาคารล่าสุดจากมหาวิทยาลัย; ตามหาตำแหน่ง VRU Mall'),
    ('อาคาร 100 ปี', 'B08 อาคาร 100 ปี',
     'ถ่ายป้ายผังทุกชั้น; ยืนยันบริการชั้น 1–5 ในแท็บบริการรายชั้น โดยเฉพาะงานการเงินชั้น 2; เก็บข้อมูลห้องทุกชั้น'),
    ('โซนหน้า และอาคาร 11, 12, 30–32', 'B01–B07, B09–B12, B30–B32',
     'ข้อมูลอาคาร รูป ป้ายผังชั้น และห้อง; สำรวจร้านหรือตู้บริการที่แผนผังไม่มี'),
    ('กลางมอ ส่วนที่ 1', 'B13–B24, U1, U2',
     'ข้อมูลอาคาร รูป ป้ายผังชั้น และห้อง; เช็กร้านค้าในแผนผัง 3 จุด (โรงอาหาร ธนาคารกรุงไทย Family Mart)'),
    ('กลางมอ ส่วนที่ 2', 'B25–B29, B33–B43, U3',
     'ข้อมูลอาคาร รูป ป้ายผังชั้น และห้อง รวมห้องสมุด (B26); หาร้านค้าต้นคูณ'),
    ('หลังมอ และความปลอดภัย', 'B44–B48, U4, U5 และความปลอดภัยทั้งมหาวิทยาลัย',
     'ข้อมูลอาคาร รูป และป้ายผังชั้น; แท็บความปลอดภัย-การเดินทาง (จุดมืด ไฟเสีย ป้ายรถ วินมอเตอร์ไซค์) เดินสำรวจกลางคืน 1 รอบ ไปอย่างน้อย 2 คน'),
    ('ชุมชนรอบมหาวิทยาลัย', 'นอกรั้วมหาวิทยาลัย',
     'แท็บชุมชนรอบมอ: ร้านอาหาร หอพัก ร้านถ่ายเอกสาร และบริการรอบมหาวิทยาลัย; ขออนุญาตร้านก่อนถ่ายรูปทุกครั้ง'),
    ('สิ่งแวดล้อม จิตอาสา และแบบสอบถาม', 'ทั้งมหาวิทยาลัย',
     'แท็บสิ่งแวดล้อม-จิตอาสา; แจกแบบสอบถามก่อนใช้เว็บ (Before) ให้นักศึกษาปี 1 ก่อนเปิดตัวเว็บ'),
]
for i, (h, w, k) in enumerate(H1, 1):
    style_header(ws1.cell(1, i, h)); ws1.column_dimensions[CL(i)].width = round(w / 7, 1)
ws1.row_dimensions[1].height = 34
for r, (role, area, task) in enumerate(ROLES, 2):
    n = r - 1
    vals = [n, role, None, area, task,
            f"=COUNTIF('อาคาร'!${bl['who']}:${bl['who']},$A{r})",
            f"=COUNTIFS('อาคาร'!${bl['who']}:${bl['who']},$A{r},'อาคาร'!${bl['st']}:${bl['st']},\"ตรวจแล้ว\")",
            f'=IF($F{r}=0,"",$G{r}/$F{r})']
    for i, v in enumerate(vals, 1):
        c = ws1.cell(r, i, clean(v)); k = H1[i - 1][2]
        c.font, c.border = F_BODY, BOX
        c.fill = FILL({'P': GREY, 'F': YEL, 'A': BLUE}[k])
        c.alignment = Alignment(wrap_text=i in (2, 4, 5), vertical='top')
    ws1.cell(r, 8).number_format = '0%'
ws1.cell(11, 2, 'ความคืบหน้าแต่ละแท็บ').font = F_SEC
for i, h in enumerate(['แท็บ', 'แถวทั้งหมด', 'เก็บแล้ว รอตรวจ', 'ตรวจแล้ว'], 2): style_header(ws1.cell(12, i, h))
ws1.row_dimensions[12].height = 24
PROG = ['อาคาร', 'บริการรายชั้น', 'ห้อง', 'ร้านค้าในแผนผัง', 'ชุมชนรอบมอ', 'สิ่งแวดล้อม-จิตอาสา', 'ความปลอดภัย-การเดินทาง', 'พิกัดอ้างอิง']
for r, t in enumerate(PROG, 13):
    s = ST(t)
    vals = [t, f"=COUNTA('{t}'!$A:$A)-1", f"=COUNTIF('{t}'!${s}:${s},\"เก็บแล้ว รอตรวจ\")",
            f"=COUNTIF('{t}'!${s}:${s},\"ตรวจแล้ว\")"]
    for i, v in enumerate(vals, 2):
        c = ws1.cell(r, i, v); c.font, c.border = F_BODY, BOX
        c.fill = FILL(GREY if i == 2 else BLUE)
        c.alignment = Alignment(vertical='top', horizontal='left' if i == 2 else 'center')
ws1.freeze_panes = 'A2'
PROT += [['แบ่งงาน', 'A1:H1', 'หัวตาราง ห้ามแก้'], ['แบ่งงาน', 'F2:H9', 'สูตรอัตโนมัติ ห้ามพิมพ์ทับ'],
         ['แบ่งงาน', 'B12:E20', 'สรุปความคืบหน้า สูตรอัตโนมัติ']]

# ---------- วิธีใช้ (index 0) ----------
ws0 = wb['Sheet']; ws0.title = 'วิธีใช้'; ws0.sheet_properties.tabColor = HDR
wb.move_sheet(ws0, offset=-wb.index(ws0))
GUIDE = [
    ('ชีตนี้ใช้ทำอะไร', 'รวมข้อมูลจากสถานที่จริงของกลุ่มไว้ที่เดียว เพื่อนำขึ้นเว็บ VRU Smart Map แถวที่จะขึ้นเว็บต้องมีสถานะการตรวจเป็น "ตรวจแล้ว" เท่านั้น', None),
    ('ช่องสีเหลือง', 'ช่องที่ต้องกรอก', YEL),
    ('ช่องสีเทา', 'ข้อมูลตั้งต้นจากแผนผังมหาวิทยาลัยปี 2559 หรือเว็บไซต์มหาวิทยาลัย ต้องเช็กกับของจริง ถ้าไม่ตรงให้แก้ทับได้เลย แล้วเลือก "แก้ไขแล้ว" ในคอลัมน์ผลเทียบของจริง\nยกเว้นคอลัมน์ A–D ของแท็บอาคาร ห้ามแก้ เพราะเว็บใช้จับคู่อาคาร', GREY),
    ('ช่องสีฟ้า', 'สูตรคำนวณอัตโนมัติ ห้ามพิมพ์ทับ', BLUE),
    ('แถวตัวเอียงสีจาง', 'แถวตัวอย่างรูปแบบการกรอก ลบทิ้งได้เมื่อมีแถวจริงแล้ว', 'ex'),
    ('ขั้นตอนเก็บข้อมูล', '1) ดูงานของตัวเองในแท็บแบ่งงาน\n2) ไปสถานที่จริง ถ่ายรูปตามมาตรฐาน\n3) กรอกให้เสร็จภายใน 24 ชั่วโมงหลังไปเก็บ\n4) ตั้งสถานะการตรวจเป็น "เก็บแล้ว รอตรวจ"\n5) หัวหน้าข้อมูลเช็กแล้วเปลี่ยนเป็น "ตรวจแล้ว"', None),
    ('ทุกแถวต้องมี', 'ชื่อผู้เก็บ วันที่ (พิมพ์แบบ 20/11/2569) และแหล่งที่มา เช่น ป้ายหน้าห้อง ป้ายผังชั้น หรือสอบถามเจ้าหน้าที่', None),
    ('รหัส', 'อาคาร B01–B48 และ U1–U5 (อาคารที่แผนผังไม่มีหมายเลข)\nร้านค้า R001, ชุมชน C001, สิ่งแวดล้อม E001, ความปลอดภัย S001, ปัญหา P001\nแถวใหม่ใช้เลขถัดจากแถวสุดท้าย', None),
    ('พิกัด', 'ยืนตรงจุด (ทางเข้าหลักของอาคาร หรือหน้าร้าน) รอ GPS นิ่งประมาณ 10 วินาที\nเปิด Google Maps กดค้างตรงตำแหน่งที่ยืนจนมีหมุดและตัวเลขพิกัดขึ้นมา แตะตัวเลขเพื่อคัดลอก แล้ววางในช่อง "พิกัด (วางจาก Google Maps)" ช่อง lat และ lng จะแยกให้เอง\nถ้าขึ้น "รูปแบบพิกัดผิด" ให้เช็กว่าตัวเลขสองชุดคั่นด้วยเครื่องหมายจุลภาค', None),
    ('รูปที่ต้องถ่ายต่ออาคาร', 'ด้านหน้าตรง, มุมเฉียงให้เห็น 2 ด้าน, ป้ายชื่ออาคาร, ป้ายผังชั้นหรือป้ายหน่วยงานทุกชั้น, ทางเข้า ลิฟต์ และทางลาด (ถ้ามี)\nถ่ายแนวนอน ช่วงกลางวัน ไม่ให้เห็นหน้าคนชัด', None),
    ('ตั้งชื่อไฟล์รูป', 'รหัส_สิ่งที่ถ่าย_ลำดับ เช่น B08_ผังชั้น2_01.jpg หรือ C003_หน้าร้าน_01.jpg แล้วอัปโหลดเข้าโฟลเดอร์รูปของกลุ่ม', None),
    ('คำถามสัมภาษณ์เจ้าหน้าที่', '1) ช่องนี้ให้บริการเรื่องอะไรบ้าง\n2) ต้องเตรียมเอกสารอะไรมา\n3) เปิดกี่โมงถึงกี่โมง ช่วงไหนคนเยอะ\n4) ทำออนไลน์ได้ไหม ผ่านช่องทางไหน\n5) นักศึกษามักมาผิดที่เรื่องอะไร ควรไปที่ไหนแทน', None),
    ('ความเป็นส่วนตัว', 'ไม่ถ่ายหน้าคนให้เห็นชัด ไม่จดชื่อหรือเบอร์มือถือส่วนตัวของเจ้าหน้าที่ ใช้เบอร์ของหน่วยงานเท่านั้น\nร้านค้าต้องขออนุญาตก่อนถ่ายรูปและก่อนเผยแพร่ แล้วติ๊กช่องยินยอมในแท็บชุมชนรอบมอ', None),
    ('ร้านค้าในแผนผัง', 'แผนผังปี 2559 ระบุร้านค้า 3 จุด คือโรงอาหาร ธนาคารกรุงไทย และร้าน Family Mart ให้เช็กว่ายังเปิดอยู่หรือเปลี่ยนแล้ว\nระหว่างเดินเก็บอาคาร ถ้าเจอร้านหรือตู้บริการที่แผนผังไม่มี (ร้านถ่ายเอกสาร ร้านกาแฟ ตู้ ATM ตู้น้ำ) ให้เพิ่มแถวในแท็บร้านค้าในแผนผัง แล้วเลือกสถานะจริงเป็น "ไม่อยู่ในแผนผัง"', None),
    ('สถานะการตรวจ', 'ยังไม่เก็บ → เก็บแล้ว รอตรวจ → ตรวจแล้ว (หัวหน้าข้อมูลเป็นคนเปลี่ยนเป็น "ตรวจแล้ว")', None),
    ('กฎของชีต', 'ห้ามเปลี่ยนชื่อแท็บและหัวตารางแถวแรก เพราะเว็บดึงข้อมูลตามชื่อเหล่านี้\nเพิ่มข้อมูลเป็นแถวใหม่ต่อท้าย ห้ามลบแถวของคนอื่น ช่องที่ไม่ควรแก้จะมีคำเตือนขึ้นก่อนแก้', None),
    ('ทางลัด', 'ถ่ายรูปป้ายผังชั้นให้ชัด แล้วส่งให้ Claude แปลงเป็นข้อมูลห้องและหน่วยงานได้ทันที\nขอตารางการใช้ห้องจากคณะหรือ สวท. แทนการเดินจดทีละห้อง\nหัวหน้าข้อมูลทำหนังสือขอผังอาคารล่าสุดจากงานอาคารสถานที่', None),
    ('กำหนดเวลา', 'รอบที่ 1: อาคารทุกหลัง และแบบสอบถามก่อนใช้เว็บ ให้เสร็จก่อนรายงานความก้าวหน้าครั้งที่ 1 (21 ธ.ค. 2569)\nรอบที่ 2: ชุมชน สิ่งแวดล้อม ความปลอดภัย และเก็บตกข้อมูลที่ขาด ให้เสร็จก่อนรายงานครั้งที่ 2 (18 ม.ค. 2570)', None),
]
for i, h in enumerate(['หัวข้อ', 'รายละเอียด'], 1): style_header(ws0.cell(1, i, h))
ws0.column_dimensions['A'].width, ws0.column_dimensions['B'].width = round(190 / 7, 1), round(780 / 7, 1)
ws0.row_dimensions[1].height = 26
for r, (t, d, mark) in enumerate(GUIDE, 2):
    a, b = ws0.cell(r, 1, t), ws0.cell(r, 2, clean(d))
    for c in (a, b):
        c.border = BOX; c.alignment = Alignment(wrap_text=True, vertical='top'); c.font = F_BODY
    a.font = Font(name='Arial', size=10, bold=True)
    if mark == 'ex': a.font = Font(name='Arial', size=10, bold=True, italic=True, color='8A8F98')
    elif mark: a.fill = FILL(mark)
ws0.freeze_panes = 'A2'
PROT.append(['วิธีใช้', f'A1:B{len(GUIDE) + 1}', 'คู่มือการใช้ชีต'])
wb.active = 0

wb.save(OUT)
json.dump(dict(checkbox=CB, protect=PROT, tabs=wb.sheetnames), open(f'{ROOT}/sheet/post.json', 'w'), ensure_ascii=False, indent=1)
print('saved', OUT, wb.sheetnames, 'checkbox', len(CB), 'protect', len(PROT))
