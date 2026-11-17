import json, math, random, sys
d=json.load(open(sys.argv[1]))
random.seed(42)
R1=lambda v: round(v,1)
def obb(pts):
    p=pts[:-1] if pts[0]==pts[-1] else pts
    cx=sum(x for x,_ in p)/len(p); cy=sum(y for _,y in p)/len(p)
    (x0,y0),(x1,y1),(x2,y2)=p[0],p[1],p[2]
    w=math.hypot(x1-x0,y1-y0); h=math.hypot(x2-x1,y2-y1); rot=math.degrees(math.atan2(y1-y0,x1-x0))
    return [R1(cx-w/2),R1(cy-h/2),R1(w),R1(h),None,R1(rot)]
def fillpoly(color,bbx,bby):
    for f in d['fills']:
        c=tuple(f['c']) if isinstance(f['c'],list) else f['c']
        if c==color and abs(f['bb'][0]-bbx)<1.5 and abs(f['bb'][1]-bby)<1.5: return f['pts']
    raise Exception('nf %s %s %s'%(color,bbx,bby))
G=(0.57,0.82,0.31)
# ---------- buildings (PDF coordinates: x, top, w, h [, floors, rotDeg]) ----------
B=[
 [1,'อนุสาวรีย์ เจ้าฟ้าวไลยอลงกรณ์','landmark',1,[[386.8,335.7,11.7,11.4]],'monument'],
 [2,'หอพระ','landmark',1,[obb(fillpoly((1.0,0.75,0.0),271.21,277.97))],'shrine'],
 [3,'อาคารสมเด็จเจ้าฟ้าวไลยอลงกรณ์','service',4,[[211.6,252.7,16.3,95.1],[226.6,291.1,18.0,12.4,2]]],
 [4,'อาคารสระว่ายน้ำอวยพร เปล่งวานิช','sport',1,[[207.0,400.7,30.3,40.2]]],
 [5,'อาคาร 80 ปี วไลยอลงกรณ์','landmark',3,[[329.1,365.0,125.1,66.7]],'hall80'],
 [6,'อาคารปฏิบัติการด้านธุรกิจบริการ','edu',3,[[207.0,487.4,27.7,31.1]]],
 [7,'อาคารส่งเสริมการเรียนรู้','service',4,[[216.1,521.1,16.3,95.1]]],
 [8,'อาคาร 100 ปี สมเด็จพระศรีนครินทร์','service',16,[[375.0,528.2,37.9,73.4,4],[378.5,532.0,30.9,42.0,16]]],
 [9,'อาคาร 75 ปี วไลยอลงกรณ์','service',6,[[556.3,375.3,16.3,95.1]]],
 [10,'อาคารศูนย์วิทยาศาสตร์','service',5,[[551.6,516.3,16.3,95.1]]],
 [11,'อาคารแสดงผลงานนักศึกษา','service',2,[[212.7,639.9,33.0,16.2]]],
 [12,'อาคาร 60 ปี วไลยอลงกรณ์','service',3,[[215.1,673.9,19.3,26.0]]],
 [13,'อาคารหอประชุมวไลยอลงกรณ์','landmark',4,[[340.8,654.1,41.8,57.6],[332.3,676.6,20.4,14.7,2]]],
 [14,'อาคารโรงอาหาร','shop',2,[[388.4,653.8,54.5,57.6]]],
 [15,'อาคารกีฬาในร่ม 1','sport',3,[[452.9,659.0,55.1,41.0]]],
 [16,'คณะเทคโนโลยีการเกษตร','edu',3,[[577.3,627.3,16.3,83.2],[551.6,665.8,16.3,76.9],[551.6,745.5,16.3,29.9],[575.6,740.9,14.7,30.0,2]]],
 [17,'อาคารคณะครุศาสตร์ (อาคารเรียน 7)','edu',5,[[478.0,703.1,16.3,76.9]]],
 [18,'อาคารกองพัฒนานักศึกษา','service',3,[[437.3,743.2,23.3,33.1]]],
 [19,'อาคารคณะวิทยาศาสตร์และเทคโนโลยี (อาคารเรียน 5)','edu',5,[[351.6,733.4,44.2,19.1],[400.3,722.4,16.7,19.1],[401.8,748.1,16.3,83.2]]],
 [20,'อาคารคณะครุศาสตร์ (อาคารเรียน 6)','edu',5,[[456.3,805.5,16.3,76.9],[432.2,849.3,36.9,34.8]]],
 [21,'ธนาคารกรุงไทย','shop',1,[[272.6,755.3,29.8,14.7]]],
 [22,'ร้าน Family Mart','shop',1,[[306.0,755.3,20.4,14.7]]],
 [23,'อาคารพยาบาล','service',3,[[316.8,781.6,15.8,31.8]]],
 [24,'อาคารโรงเรียนสาธิต (มัธยม)','school',3,[[315.6,820.2,15.1,78.1],[305.9,823.9,13.7,7.9]]],
 [25,'อาคารโรงเรียนสาธิต (มัธยม)','school',3,[[337.2,908.3,13.7,107.7],[315.6,911.5,14.9,84.2],[274.4,971.6,41.3,24.1],[272.3,1002.2,71.3,13.7]]],
 [26,'อาคารสำนักวิทยบริการและเทคโนโลยีสารสนเทศ','service',5,[[379.3,873.3,22.0,26.2],[403.5,883.0,22.0,57.7],[425.6,916.2,59.9,24.1]]],
 [27,'อาคารคณะมนุษยศาสตร์และสังคมศาสตร์ (อาคารเรียน 8)','edu',5,[[400.5,949.5,83.4,21.3],[449.0,969.3,34.8,24.1],[397.7,972.9,20.4,34.0]]],
 [28,'อาคารเรียนรวม 6 ชั้น','edu',6,[[541.7,871.4,31.8,116.6],[568.2,871.8,19.8,29.8,3]]],
 [29,'ศูนย์เรียนรู้เศรษฐกิจพอเพียง','service',2,[[576.1,1001.9,16.5,32.5]]],
 [30,'อาคารปฏิบัติการคหกรรมศาสตร์','edu',2,[[217.6,723.7,16.3,20.0]]],
 [31,'อาคารคณะวิทยาการจัดการ (อาคารเรียน 2)','edu',4,[[217.6,746.8,16.3,236.9],[230.0,880.8,16.3,29.9],[217.6,985.2,16.3,29.9]]],
 [32,'อาคารเรียนรวมวิทยาศาสตร์','edu',5,[[141.3,916.9,38.7,104.1]]],
 [33,'เรือนเจ้าฟ้า (เรือนไทยภาคกลาง)','landmark',1,[[303.9,1104.2,44.1,38.5]],'thai'],
 [34,'อาคารโรงเรียนสาธิต (ประถม)','school',4,[[481.5,1086.3,54.7,41.9],[495.9,1134.3,31.8,44.1]]],
 [35,'อาคารกีฬาในร่ม 2','sport',3,[[455.1,1170.2,35.0,39.2]]],
 [36,'อาคารกีฬาในร่ม 3','sport',3,[[505.7,1272.2,35.0,63.1]]],
 [37,'หอพักเพทาย','dorm',6,[[405.1,1201.4,15.9,48.5]]],
 [38,'หอพักโกเมน','dorm',6,[[372.4,1250.6,15.9,48.5]]],
 [39,'อาคารปฏิบัติการเทคโนโลยีอุตสาหกรรม 3','edu',2,[[336.8,1202.3,15.9,43.1]]],
 [40,'อาคารปฏิบัติการเทคโนโลยีอุตสาหกรรม 2','edu',2,[[310.8,1201.8,15.9,43.1]]],
 [41,'อาคารปฏิบัติการเทคโนโลยีอุตสาหกรรม 1','edu',2,[[286.0,1200.9,15.9,43.1]]],
 [42,'อาคารกิจกรรมนักศึกษาคณะเทคโนโลยีอุตสาหกรรม','edu',2,[[249.7,1249.0,27.0,17.9]]],
 [43,'อาคารคณะเทคโนโลยีอุตสาหกรรม (อาคารเรียน 9)','edu',5,[[305.9,1266.6,16.4,85.5],[293.9,1268.3,15.9,14.5],[293.7,1299.5,15.9,14.5],[293.9,1335.9,15.9,14.5]]],
 [44,'หอพักนักศึกษา','dorm',8,[[431.8,1446.1,15.9,48.5],[378.8,1483.8,15.9,48.5],[351.4,1498.0,15.9,109.4],[432.8,1498.0,18.1,23.6],[323.9,1517.2,15.9,48.5],[431.1,1521.6,15.9,48.5],[378.8,1535.5,15.9,71.9]]],
 [45,'อาคารหอพักนักศึกษานานาชาติ','dorm',8,[[334.0,1648.0,116.0,50.0]],'site'],
 [46,'อาคารศูนย์อนุรักษ์พันธุกรรมพืช','service',2,[obb(fillpoly(G,248.08,1503.5)),obb(fillpoly(G,261.93,1504.75)),obb(fillpoly(G,266.85,1488.32))]],
 [47,'อาคารศูนย์การศึกษาพัฒนาความหลากหลายฯ','service',1,[],'greenhouse'],
 [48,'บ้านพักอาจารย์และบุคลากร','dorm',1,[],'houses'],
 # buildings drawn on the 2016 map without a number
 [101,'อาคารไม่มีหมายเลขในแผนผัง (ข้างอาคาร 23)','unknown',2,[[289.3,797.7,15.2,39.7]]],
 [102,'อาคารไม่มีหมายเลขในแผนผัง (เหนืออาคาร 28)','unknown',2,[[560.8,838.0,18.0,13.7],[560.8,853.4,34.8,14.7]]],
 [103,'อาคารไม่มีหมายเลขในแผนผัง (ข้างอาคาร 41–42)','unknown',2,[[241.2,1212.0,37.9,39.1]]],
 [104,'อาคารไม่มีหมายเลขในแผนผัง (ริมคลอง ใกล้อาคาร 46)','unknown',2,[[166.6,1469.6,18.2,27.9]]],
 [105,'อาคารไม่มีหมายเลขในแผนผัง (ข้างสระน้ำใต้สนามกีฬา)','unknown',2,[[258.2,1892.9,29.3,58.6]]],
]
# 47: greenhouse rows (brown dashed lines) + hexagonal pavilion
gh=[]
for b in d['brown_lines']:
    (x0,y0),(x1,y1)=b['pts'][0],b['pts'][-1]; L=math.hypot(x1-x0,y1-y0); cx,cy=(x0+x1)/2,(y0+y1)/2
    gh.append([R1(cx-L/2),R1(cy-3),R1(L),6.0,1,R1(math.degrees(math.atan2(y1-y0,x1-x0)))])
gh.append([205.4,1565.2,20.0,20.0,1,15.0])
[b for b in B if b[0]==47][0][4]=gh
# 48: staff houses = every small white outlined block in the south / east strips
houses=[]
skip=[(272.6,670.2),(272.6,698.6),(486.6,1360.8),(486.4,1388.9),(560.8,838.0),(560.8,853.4),(241.2,1212.0),(207.0,487.4),(575.6,740.9)]
for f in d['fills']:
    c=tuple(f['c']) if isinstance(f['c'],list) else f['c']
    if c!=1.0: continue
    x,y,w,h=f['bb']
    if min(w,h)<6 or w*h<120 or w>60: continue
    if any(abs(x-a)<1.5 and abs(y-b)<1.5 for a,b in skip): continue
    if y<1265: continue
    if 480<x<535 and 1420<y<1480: continue  # courts
    houses.append([R1(x),R1(y),R1(w),R1(h),1])
[b for b in B if b[0]==48][0][4]=houses
# ---------- scenery ----------
def P(pts): return [[R1(x),R1(y)] for x,y in pts]
roads=[[r['w'],P(r['pts'])] for r in d['roads']]
water=[P(w['pts']) for w in d['water']]
forest=[P(f['pts']) for f in d['forest']]
PARK={'P0','P1','P5','P11','P14','P15','P18','P19'}; FIELD={'P13','P7','P8','P9','P10','P16','P17','P6','P12'}
parking=[P(p['pts']) for p in d['patterns'] if p['id'] in PARK]
field=[P(p['pts']) for p in d['patterns'] if p['id'] in FIELD]
garden=[P(p['pts']) for p in d['patterns'] if p['id'] in {'P2','P4'}]
courts=[[272.6,670.2,45.5,24.1],[272.6,698.6,45.5,24.1],[486.6,1360.8,42.6,22.7],[486.4,1388.9,42.6,22.7],[485.0,1426.0,44.0,21.0],[485.0,1450.0,44.0,21.0]]
plaza={'path':[386.0,453.0,18.0,46.0],'ring':[373.0,494.0,46.0,31.0]}
stadium={'cx':406.0,'cy':1787.0,'L':282.0,'W':142.0,'stand':[372.4,1852.1,72.7,14.4]}
pier=[392.6,277.5,392.6,338.6]
# ---------- trees ----------
def pip(x,y,poly):
    ins=False; n=len(poly)
    for i in range(n):
        x1,y1=poly[i]; x2,y2=poly[(i+1)%n]
        if (y1>y)!=(y2>y) and x<(x2-x1)*(y-y1)/(y2-y1+1e-9)+x1: ins=not ins
    return ins
rects=[r for b in B for r in b[4]]
def segd(px,py,a,b):
    (x1,y1),(x2,y2)=a,b; dx,dy=x2-x1,y2-y1; L=dx*dx+dy*dy
    t=0 if L==0 else max(0,min(1,((px-x1)*dx+(py-y1)*dy)/L)); return math.hypot(px-x1-t*dx,py-y1-t*dy)
def ok(x,y):
    if not(58<x<618 and 222<y<2102): return False
    for r in rects:
        if r[0]-5<x<r[0]+r[2]+5 and r[1]-5<y<r[1]+r[3]+5: return False
    for c in courts+[plaza['path'],plaza['ring'],stadium['stand']]:
        if c[0]-4<x<c[0]+c[2]+4 and c[1]-4<y<c[1]+c[3]+4: return False
    if (x-stadium['cx'])**2/(stadium['L']/2+6)**2+(y-stadium['cy'])**2/(stadium['W']/2+6)**2<1: return False
    for poly in water+parking:
        if pip(x,y,poly): return False
    for w,pts in roads:
        for i in range(len(pts)-1):
            if segd(x,y,pts[i],pts[i+1])<w/2+3: return False
    return True
trees=[]
def add(x,y,s):
    if ok(x,y) and all((x-a)**2+(y-b)**2>64 for a,b,_ in trees[-60:]): trees.append([R1(x),R1(y),round(s,2)])
for w,pts in roads:
    if w<9: continue
    for i in range(len(pts)-1):
        (x1,y1),(x2,y2)=pts[i],pts[i+1]; L=math.hypot(x2-x1,y2-y1)
        if L<1: continue
        nx,ny=-(y2-y1)/L,(x2-x1)/L; t=8
        while t<L:
            x,y=x1+(x2-x1)*t/L,y1+(y2-y1)*t/L
            for o in (w/2+7,-(w/2+7)): add(x+nx*o+random.uniform(-1.5,1.5),y+ny*o+random.uniform(-1.5,1.5),random.uniform(.8,1.15))
            t+=19
for poly in water:
    n=len(poly)
    for i in range(n-1):
        (x1,y1),(x2,y2)=poly[i],poly[i+1]; L=math.hypot(x2-x1,y2-y1)
        if L<5: continue
        nx,ny=-(y2-y1)/L,(x2-x1)/L; t=6
        while t<L:
            x,y=x1+(x2-x1)*t/L,y1+(y2-y1)*t/L
            for o in (9,-9):
                if not any(pip(x+nx*o,y+ny*o,pw) for pw in water): add(x+nx*o,y+ny*o,random.uniform(.85,1.25))
            t+=17
for poly in forest:
    xs=[p[0] for p in poly]; ys=[p[1] for p in poly]
    for _ in range(int((max(xs)-min(xs))*(max(ys)-min(ys))/90)):
        x,y=random.uniform(min(xs),max(xs)),random.uniform(min(ys),max(ys))
        if pip(x,y,poly): add(x,y,random.uniform(1.0,1.7))
for x,y,w,h in d['images'][1:]: add(x+w/2,y+h/2,1.4 if w>25 else 1.15)
for y in (918,952,986,1018): trees.append([94.0,float(y),1.2])
for x in range(334,450,19): add(x,1630,1.0)
for x,y in [(232,1430),(246,1428),(238,1446),(252,1444),(231,1462),(246,1466),(258,1458)]: add(x,y,1.05)
for poly in field:
    xs=[p[0] for p in poly]; ys=[p[1] for p in poly]
    for _ in range(int((max(xs)-min(xs))*(max(ys)-min(ys))/900)):
        x,y=random.uniform(min(xs),max(xs)),random.uniform(min(ys),max(ys))
        if pip(x,y,poly): add(x,y,random.uniform(.9,1.4))
MAP={'roads':roads,'water':water,'forest':forest,'parking':parking,'field':field,'garden':garden,'courts':courts,'plaza':plaza,'stadium':stadium,'pier':pier,'trees':trees}
out='const B = '+json.dumps(B,ensure_ascii=False,separators=(',',':')).replace('],[','],\n [')+';\nconst MAP = '+json.dumps(MAP,separators=(',',':'))+';\n'
open(sys.argv[2],'w').write(out)
print('buildings',len(B),'houses',len(houses),'trees',len(trees),'bytes',len(out))
