// @ts-nocheck — พอร์ตจาก v05_template.html (v0.5) จะเพิ่ม type ภายหลัง
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import plan from '../data/plan.json';
import { CATS, ZONE_Y, ZONES, ALIAS, SRC, STLABEL, SERVICES, TASKS, BCODE } from '../data/services.ts';

const { B, MAP } = plan;

const STYLE={modern:[3,6,7,8,9,10,16,26,28,31,32,37,38,44,45,102,103],arch:[4,15,35,36],shop:[21,22]};
const styleOf=id=>STYLE.modern.includes(id)?'modern':STYLE.arch.includes(id)?'arch':STYLE.shop.includes(id)?'shop':'pitched';
const NOTE={5:'รูปทรงอ้างอิงภาพออกแบบอาคาร',45:'แผนผังปี 2559 ระบุว่า "กำลังก่อสร้าง" — ต้องตรวจสถานะและรูปทรงจริง'};
const DATA = B.map(([id,name,cat,floors,rects,kind])=>{
  const b={id,name,cat,floors,rects,kind,style:styleOf(id),lat:null,lng:null};
  b.code=id>100?'U'+(id-100):'B'+String(id).padStart(2,'0');
  b.note=NOTE[id]||(cat==='unknown'?'ไม่มีหมายเลข/ชื่อในแผนผังปี 2559 — ต้องระบุหน้างาน':'');
  const ys=rects.map(r=>r[1]+r[3]/2); b.py=ys.length?ys.reduce((a,c)=>a+c,0)/ys.length:2000;
  b.zone=b.py<ZONE_Y[0]?1:b.py<ZONE_Y[1]?2:3; return b;});
for(const z of [1,2,3]) ZONES[z].count=DATA.filter(b=>b.zone===z).length;

/* ============ rooms ============
   Real data comes from the Sheet: building_id | floor | room_from | room_to | room_name
   SAMPLE below assumes code = [อาคารเรียน N][floor][2-digit room] — must be verified on site. */
const CLASS_BLDG={31:2,19:5,20:6,17:7,27:8,43:9};
const ROOMS={};
for(const [id,n] of Object.entries(CLASS_BLDG)){ const b=DATA.find(d=>d.id==id); ROOMS[id]=[];
  for(let f=1;f<=b.floors;f++) ROOMS[id].push({floor:f,from:`${n}${f}01`,to:`${n}${f}10`,name:'',sample:true}); }
for(const [id,n] of Object.entries(CLASS_BLDG)) (ALIAS[id]=ALIAS[id]||[]).push('ตึก'+n,'อาคาร'+n,'ตึกเรียน'+n,'อาคารเรียน'+n);
DATA.forEach(b=>{ b.alias=(ALIAS[b.id]||[]); b.rooms=ROOMS[b.id]||[]; });
function findRooms(v){ // v normalized
  const raw=v.replace(/^(ห้อง|room|rm)/,'');
  const m=raw.match(/^(\d{1,2})-(\d)([0-9a-z]{1,3})$/)||raw.match(/^(15)(\d)([0-9a-z]{2,3})$/);
  if(m&&BCODE[m[1]]){ const b=DATA.find(d=>d.id===BCODE[m[1]]); return [{type:'room',b,floor:+m[2],room:m[1]+'-'+m[2]+m[3].toUpperCase(),r:{sample:false,official:true}}]; }
  const code=raw.replace(/[-_.]/g,''); if(!/^[a-z]*\d{2,5}$/.test(code)) return [];
  const out=[];
  for(const b of DATA) for(const r of b.rooms){
    const lo=parseInt(r.from,10), hi=parseInt(r.to,10), c=parseInt(code,10);
    if(code.length===r.from.length&&c>=lo&&c<=hi) out.unshift({type:'room',b,floor:r.floor,room:code,r});
    else if(code.length<r.from.length&&(r.from.startsWith(code)||r.to.startsWith(code)||(String(lo).slice(0,code.length)<=code&&String(hi).slice(0,code.length)>=code)))
      out.push({type:'range',b,floor:r.floor,r});
  }
  return out.slice(0,8);
}

/* ============ service directory: ย้ายไป src/data/services.ts ============ */
function findTasks(v){
  if(!v) return [];
  const out=[];
  for(const t of TASKS){ if(t.q.some(q=>{ const n=norm(q); return n.includes(v)||(v.length>=3&&v.includes(n)); })||norm(t.l).includes(v)) out.push({type:'task',b:byId.get(t.b)||DATA.find(d=>d.id===t.b),t}); }
  return out.slice(0,6);
}

/* ============ renderer / scene ============ */
/* All plan coordinates are PDF points from แผนผังอาคาร (MapVRU-2016.pdf): x → east, y → south */
const S=0.115, CX=337.5, CY=1110, FH=0.46;
const X=px=>(px-CX)*S, Z=py=>(py-CY)*S;
const canvas=document.getElementById('scene');
const isMobile=matchMedia('(max-width:760px)').matches;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?1.75:2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
const FOG=0xdfe6e5; scene.fog=new THREE.Fog(FOG,70,290);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.5,900);
const controls=new OrbitControls(camera,canvas);
controls.enabled=false; controls.enableDamping=true; controls.dampingFactor=.08; controls.maxPolarAngle=1.38; controls.minDistance=8; controls.maxDistance=90;

scene.add(new THREE.HemisphereLight(0xeaf3ff,0x9a9a80,1.05));
const sun=new THREE.DirectionalLight(0xfff1dc,2.5); sun.castShadow=true;
sun.shadow.mapSize.set(isMobile?1536:2048,isMobile?1536:2048);
Object.assign(sun.shadow.camera,{left:-62,right:62,top:62,bottom:-62,near:1,far:300});
sun.shadow.bias=-0.0005; sun.shadow.normalBias=.03; sun.shadow.radius=2.5;
scene.add(sun,sun.target);
const SUN_OFF=new THREE.Vector3(-55,95,-30);

const M=(c,o={})=>new THREE.MeshStandardMaterial({color:c,roughness:.9,metalness:0,...o});
const mat={grass:M(0x8bab63),grass2:M(0x6f9a50),lawn:M(0x9fb771),field:M(0x9db36f),forest:M(0x5f8f5e),road:M(0x7d8084,{roughness:.95}),asph:M(0x4a4e53,{roughness:.85}),
  line:M(0xf2f2ee),curb:M(0xd2cec4),water:M(0x5f93ae,{roughness:.18,metalness:.15}),park:M(0x9a9d9f),
  court:M(0xa8573f),courtIn:M(0x3f8a62),track:M(0xb5583a),fieldG:M(0x56913f),
  white:M(0xf5f3ee),roofDark:M(0x50575f,{roughness:.75,flatShading:true}),teal:M(0x6fb0a3,{roughness:.6,flatShading:true}),
  wood:M(0x7b4a2b),woodDark:M(0x5a321c,{flatShading:true}),terracotta:M(0xb2603d,{flatShading:true}),gold:M(0xd8b257,{roughness:.35,metalness:.4}),
  trunk:M(0x6b5340),hedge:M(0x4f8a3c,{flatShading:true})};

/* ---- ground ---- */
{ const g=new THREE.Mesh(new THREE.PlaneGeometry(1600,1600),mat.field); g.rotation.x=-Math.PI/2; g.position.y=-0.02; g.receiveShadow=true; scene.add(g);
  const c=new THREE.Mesh(new THREE.PlaneGeometry((620-55)*S,(2105-215)*S),mat.grass); c.rotation.x=-Math.PI/2; c.position.set(X(337.5),0,Z(1160)); c.receiveShadow=true; scene.add(c); }
function slab(x,y,w,h,m,top=0.02,th=0.04,rot=0){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w*S,th,h*S),m); mesh.position.set(X(x+w/2),top-th/2,Z(y+h/2)); mesh.rotation.y=rot; mesh.receiveShadow=true; scene.add(mesh); return mesh; }
function poly(pts,width,m,top=0.03,th=0.05){
  for(let i=0;i<pts.length-1;i++){ const [x1,y1]=pts[i],[x2,y2]=pts[i+1]; const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy); if(len<.3) continue;
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(len*S,th,width*S),m); mesh.position.set(X((x1+x2)/2),top-th/2,Z((y1+y2)/2)); mesh.rotation.y=-Math.atan2(dy,dx); mesh.receiveShadow=true; scene.add(mesh);
    const j=new THREE.Mesh(new THREE.CylinderGeometry(width*S/2,width*S/2,th,14),m); j.position.set(X(x2),top-th/2,Z(y2)); j.receiveShadow=true; scene.add(j); } }
function area(pts,m,y){ // flat polygon from plan points
  const sh=new THREE.Shape(pts.map(([x,yy])=>new THREE.Vector2(X(x),-Z(yy))));
  const g=new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI/2); const mesh=new THREE.Mesh(g,m); mesh.position.y=y; mesh.receiveShadow=true; scene.add(mesh); return mesh; }

/* ---- Phahonyothin road (two carriageways, extends to the horizon) ---- */
slab(-5000,137,10655,35,mat.asph,0.03,0.06); slab(-5000,180,10655,35,mat.asph,0.03,0.06); slab(-5000,172,10655,8,mat.curb,0.05,0.1);
for(let x=-3000;x<3600;x+=40){ slab(x,154,22,1.5,mat.line,0.036,0.06); slab(x,197,22,1.5,mat.line,0.036,0.06); }
/* ---- surfaces from the plan ---- */
MAP.field.forEach(p=>area(p,mat.lawn,0.006));
MAP.forest.forEach(p=>area(p,mat.forest,0.008));
MAP.garden.forEach(p=>area(p,mat.grass2,0.01));
MAP.water.forEach(p=>area(p,mat.water,0.03));
MAP.parking.forEach(p=>{ area(p,mat.park,0.022); const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]); const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const along=(x1-x0)>(y1-y0); if(along) for(let x=x0+5;x<x1-3;x+=8) slab(x,y0+3,0.8,y1-y0-6,mat.line,0.028,0.04); else for(let y=y0+5;y<y1-3;y+=8) slab(x0+3,y,x1-x0-6,0.8,mat.line,0.028,0.04); });
MAP.roads.forEach(([w,pts])=>poly(pts,w,mat.road,0.035,0.05));
MAP.courts.forEach(r=>{ slab(...r,mat.court,0.045,0.06); slab(r[0]+2,r[1]+2,r[2]-4,r[3]-4,mat.courtIn,0.05,0.06); });
{ // plaza in front of อาคาร 100 ปี: path + oval roundabout
  const [px,py,pw,ph]=MAP.plaza.path; slab(px,py,pw,ph,mat.curb,0.04,0.06);
  const [rx,ry,rw,rh]=MAP.plaza.ring; const cx=X(rx+rw/2), cz=Z(ry+rh/2);
  const ring=new THREE.Shape(); ring.absellipse(0,0,rw*S/2,rh*S/2,0,Math.PI*2); const hole=new THREE.Path(); hole.absellipse(0,0,rw*S/2-0.6,rh*S/2-0.6,0,Math.PI*2,true); ring.holes.push(hole);
  const rg=new THREE.ShapeGeometry(ring,40); rg.rotateX(-Math.PI/2); const rm=new THREE.Mesh(rg,mat.road); rm.position.set(cx,0.04,cz); rm.receiveShadow=true; scene.add(rm);
  const isl=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.12,40),mat.grass2); isl.scale.set(rw*S/2-0.6,1,rh*S/2-0.6); isl.position.set(cx,.06,cz); isl.receiveShadow=true; scene.add(isl); }
{ // stadium (track ring + field) and the grandstand drawn south of it
  const st=MAP.stadium; const sh=(L,W)=>{const s=new THREE.Shape(),r=W/2,h=L/2-r; s.absarc(h,0,r,-Math.PI/2,Math.PI/2,false); s.absarc(-h,0,r,Math.PI/2,Math.PI*1.5,false); return s;};
  const mk=(L,W,m,y)=>{const g=new THREE.ExtrudeGeometry(sh(L,W),{depth:.06,bevelEnabled:false,curveSegments:28}); g.rotateX(-Math.PI/2); const o=new THREE.Mesh(g,m); o.position.set(X(st.cx),y,Z(st.cy)); o.receiveShadow=true; scene.add(o);};
  mk(st.L*S,st.W*S,mat.track,0.0); mk((st.L-44)*S,(st.W-44)*S,mat.fieldG,0.012);
  for(let i=1;i<6;i++){ const g=new THREE.EdgesGeometry(new THREE.ShapeGeometry(sh((st.L-i*7.5)*S,(st.W-i*7.5)*S),24)); g.rotateX(-Math.PI/2); const l=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xf3e6dc,transparent:true,opacity:.5})); l.position.set(X(st.cx),.075,Z(st.cy)); scene.add(l); }
  const [gx,gy,gw,gh]=st.stand; const H=1.4;
  const s1=new THREE.Mesh(new THREE.BoxGeometry(gw*S,H,gh*S),mat.white); s1.position.set(X(gx+gw/2),H/2,Z(gy+gh/2)); s1.castShadow=s1.receiveShadow=true; scene.add(s1);
  const s2=new THREE.Mesh(new THREE.BoxGeometry(gw*S+.4,.16,gh*S+1),M(0x2f6b3a)); s2.position.set(X(gx+gw/2),H+.6,Z(gy+gh/2)-.4); s2.castShadow=true; scene.add(s2); }

/* ============ facade textures ============ */
function facade(kind){
  const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
  if(kind==='cream'){
    g.fillStyle='#ece5d5'; g.fillRect(0,0,128,128);
    g.fillStyle='#f7f3ea'; g.fillRect(18,30,92,66);
    const gr=g.createLinearGradient(0,34,0,92); gr.addColorStop(0,'#55697a'); gr.addColorStop(1,'#2c3843'); g.fillStyle=gr; g.fillRect(22,34,84,58);
    g.fillStyle='#d8d0bf'; g.fillRect(62,34,4,58); g.fillRect(22,60,84,3);
    g.fillStyle='rgba(255,255,255,.18)'; g.fillRect(24,36,36,10);
    g.fillStyle='#d5ccb9'; g.fillRect(0,112,128,16); g.fillStyle='rgba(0,0,0,.08)'; g.fillRect(0,96,128,4);
  } else if(kind==='white'){
    g.fillStyle='#f3f3f0'; g.fillRect(0,0,128,128);
    const gr=g.createLinearGradient(0,20,0,100); gr.addColorStop(0,'#6b8295'); gr.addColorStop(1,'#33424f'); g.fillStyle=gr; g.fillRect(8,22,112,76);
    g.fillStyle='#e4e4e0'; g.fillRect(62,22,4,76); g.fillStyle='rgba(255,255,255,.2)'; g.fillRect(10,24,50,12);
    g.fillStyle='#fafaf8'; g.fillRect(0,82,128,5); g.fillRect(0,104,128,24); g.fillStyle='rgba(0,0,0,.1)'; g.fillRect(0,98,128,6);
  } else if(kind==='amber'){ // gold-tinted curtain wall (อาคาร 80 ปี)
    const gr=g.createLinearGradient(0,0,0,128); gr.addColorStop(0,'#f0cf7a'); gr.addColorStop(1,'#b8862e'); g.fillStyle=gr; g.fillRect(0,0,128,128);
    g.fillStyle='rgba(255,255,255,.55)'; for(let x=0;x<128;x+=32) g.fillRect(x,0,3,128); g.fillRect(0,62,128,3);
    g.fillStyle='rgba(255,255,255,.18)'; g.fillRect(6,6,40,30);
  } else { // house
    g.fillStyle='#efe9df'; g.fillRect(0,0,128,128); g.fillStyle='#3d4b56'; g.fillRect(34,38,60,48); g.fillStyle='#efe9df'; g.fillRect(62,38,4,48);
  }
  const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=renderer.capabilities.getMaxAnisotropy(); return t;
}
const TEX={cream:facade('cream'),white:facade('white'),house:facade('house'),amber:facade('amber')};
function boxUV(g,w,d,fl,bay=1.6){ const uv=g.attributes.uv; const faces=[d,d,0,0,w,w];
  for(let f=0;f<6;f++){ if(!faces[f]) continue; const ru=Math.max(1,Math.round(faces[f]/bay));
    for(let v=0;v<4;v++){const i=f*4+v; uv.setXY(i,uv.getX(i)*ru,uv.getY(i)*fl);} } uv.needsUpdate=true; }
function hipRoof(w,d,h){
  const swap=d>w; if(swap)[w,d]=[d,w]; const a=w/2,b=d/2,r=Math.max(a-b,0);
  const P=(x,y,z)=>swap?[z,y,x]:[x,y,z];
  const c0=P(-a,0,-b),c1=P(a,0,-b),c2=P(a,0,b),c3=P(-a,0,b),t1=P(-r,h,0),t2=P(r,h,0);
  let tris=[[c0,t2,c1],[c0,t1,t2],[c3,c2,t2],[c3,t2,t1],[c1,t2,c2],[c3,t1,c0]];
  if(swap) tris=tris.map(t=>[t[0],t[2],t[1]]);
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(tris.flat(2),3)); g.computeVertexNormals(); return g;
}
function barrel(w,d,h){ const along=w>=d, len=along?w:d, r=(along?d:w)/2;
  const g=new THREE.CylinderGeometry(r,r,len,22,1,false,0,Math.PI); g.rotateZ(Math.PI/2); g.scale(1,h/r,1); if(!along) g.rotateY(Math.PI/2); return g; }
/* arcade screen: a wall plate with tall round-headed openings → reads as "tree" columns branching into arches */
function arcade(len,h,n,thick=.22,col=.2,band=.1){
  const s=new THREE.Shape(); s.moveTo(-len/2,0); s.lineTo(len/2,0); s.lineTo(len/2,h); s.lineTo(-len/2,h); s.lineTo(-len/2,0);
  const pitch=len/n, ow=pitch-col, r=ow/2, top=h-band;
  for(let i=0;i<n;i++){ const cx=-len/2+pitch*(i+.5); const hp=new THREE.Path();
    hp.moveTo(cx-r,.03); hp.lineTo(cx+r,.03); hp.lineTo(cx+r,top-r); hp.absarc(cx,top-r,r,0,Math.PI,false); hp.lineTo(cx-r,.03); s.holes.push(hp); }
  const g=new THREE.ExtrudeGeometry(s,{depth:thick,bevelEnabled:false,curveSegments:10}); g.translate(0,0,-thick/2); return g;
}

/* ============ buildings ============ */
const pickables=[]; const byId=new Map();
function makeBuilding(b){
  const grp=new THREE.Group(); const mats=[];
  const own=m=>{const c=m.clone(); mats.push(c); return c;};
  const add=(mesh,cast=true)=>{mesh.castShadow=cast;mesh.receiveShadow=true;mesh.userData.b=b;grp.add(mesh);pickables.push(mesh);return mesh;};
  const wallTex = b.style==='modern'?TEX.white : b.kind==='houses'?TEX.house : TEX.cream;
  const wall=own(new THREE.MeshStandardMaterial({map:wallTex,roughness:.82}));
  const flat=own(M(0xd6d6d2)); const white=own(mat.white);
  let roofM = b.kind==='thai'?own(mat.woodDark) : (b.kind==='houses'||b.kind==='greenhouse')?own(mat.terracotta) : b.style==='arch'?own(M(b.id===4?0x8fc3cf:0x7f878f,{roughness:.6,metalness:.2})) : b.cat==='unknown'?own(M(0x9aa0a6)) : own(mat.roofDark);
  let maxH=0,minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9;
  const ext=(cx,cz,hw,hd)=>{minx=Math.min(minx,cx-hw);maxx=Math.max(maxx,cx+hw);minz=Math.min(minz,cz-hd);maxz=Math.max(maxz,cz+hd);};

  if(b.kind==='monument'){
    const [x,y,w,h]=b.rects[0]; const cx=X(x+w/2),cz=Z(y+h/2);
    add(new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.45,.5,32),white)).position.set(cx,.25,cz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(.9,1,.35,32),white)).position.set(cx,.68,cz);
    add(new THREE.Mesh(new THREE.BoxGeometry(.6,1.0,.6),white)).position.set(cx,1.35,cz);
    const st=add(new THREE.Mesh(new THREE.CapsuleGeometry(.24,.55,6,12),own(mat.gold))); st.position.set(cx,2.25,cz);
    // pier from the north bank of the pond
    const [ax,ay,bx,by]=MAP.pier; const pier=new THREE.Mesh(new THREE.BoxGeometry(.75,.12,(by-ay)*S),white); pier.position.set(X(ax),.28,Z((ay+by)/2)); pier.receiveShadow=true; pier.castShadow=true; grp.add(pier);
    maxH=2.7; ext(cx,cz,1.5,1.5);
  } else if(b.kind==='hall80'){ /* อาคาร 80 ปี: white tree-column arcade, gold glass, floating over the pond (per the architectural render) */
    const [x,y,w,h]=b.rects[0]; const cx=X(x+w/2), cz=Z(y+h/2), W=w*S, D=h*S;
    const g=new THREE.Group(); g.position.set(cx,0,cz); grp.add(g);
    const put=(mesh,px,py,pz,cast=true)=>{mesh.position.set(px,py,pz);mesh.castShadow=cast;mesh.receiveShadow=true;mesh.userData.b=b;g.add(mesh);pickables.push(mesh);return mesh;};
    const dark=own(M(0x262b31,{roughness:.6})), amber=own(new THREE.MeshStandardMaterial({map:TEX.amber,roughness:.28,metalness:.35,emissive:0x5a3c08,emissiveIntensity:.35}));
    const glassD=own(M(0x34414c,{roughness:.2,metalness:.4})), hedge=own(mat.hedge), gold=own(mat.gold);
    const L0=1.25, FL=1.55, TOP=3.75;           // under-croft height, main floor level, underside of roof
    // under-croft over the water + pilotis
    put(new THREE.Mesh(new THREE.BoxGeometry(W-2.2,L0,D-2.2),dark),0,L0/2,0);
    for(let i=0;i<=10;i++) for(const sz of [-1,1]) put(new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,L0,10),white),-W/2+.8+i*(W-1.6)/10,L0/2,sz*(D/2-.8));
    // main floor slab + planters along the edge (the green line on the render)
    put(new THREE.Mesh(new THREE.BoxGeometry(W,.3,D),white),0,L0+.15,0);
    for(const sz of [-1,1]) put(new THREE.Mesh(new THREE.BoxGeometry(W-.4,.22,.28),hedge),0,FL+.11,sz*(D/2-.2));
    // glass hall: gold centre, darker wings
    const Wc=W*.56; const gx=new THREE.BoxGeometry(Wc,TOP-FL,D-2.4); boxUV(gx,Wc,D-2.4,1,2.2);
    put(new THREE.Mesh(gx,[amber,amber,flat,flat,amber,amber]),0,FL+(TOP-FL)/2,0);
    const Ww=(W-Wc)/2-.9; for(const sx of [-1,1]) put(new THREE.Mesh(new THREE.BoxGeometry(Ww,TOP-FL-.35,D-3),glassD),sx*(Wc/2+Ww/2),FL+(TOP-FL-.35)/2,0);
    // arcades on all four sides
    const nLong=11, nShort=5;
    for(const sz of [-1,1]) put(new THREE.Mesh(arcade(W-.2,TOP-FL,nLong),white),0,FL,sz*(D/2-.32));
    for(const sx of [-1,1]){ const a=new THREE.Mesh(arcade(D-.8,TOP-FL,nShort),white); a.rotation.y=Math.PI/2; put(a,sx*(W/2-.12),FL,0); }
    // roof: thin wide slab with cantilevered wings + raised central slab
    put(new THREE.Mesh(new THREE.BoxGeometry(W+3.4,.22,D+1.3),white),0,TOP+.11,0);
    put(new THREE.Mesh(new THREE.BoxGeometry(Wc+.9,.3,D+1.6),white),0,TOP+.42,0);
    // raking struts holding the wing cantilevers
    for(const sx of [-1,1]) for(const sz of [-1,1]){ const len=Math.hypot(1.7,TOP-FL), s=new THREE.Mesh(new THREE.BoxGeometry(.16,len,.16),white);
      s.rotation.z=sx*Math.atan2(1.7,TOP-FL)*-1; put(s,sx*(W/2+.85),FL+(TOP-FL)/2,sz*(D/2-.32)); }
    // emblem + entrance panel on the north (front) face
    const em=put(new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.08,28),gold),0,TOP-.62,-(D/2-.1)); em.rotation.x=Math.PI/2;
    put(new THREE.Mesh(new THREE.BoxGeometry(.7,1.3,.08),white),0,FL+.65,-(D/2-.2));
    // walkway across the pond in front, with flags (as on the render)
    const wy=Z(356), wx0=X(290), wx1=X(515);
    const deck=new THREE.Mesh(new THREE.BoxGeometry(wx1-wx0,.16,1.0),white); deck.position.set((wx0+wx1)/2,.95,wy); deck.castShadow=deck.receiveShadow=true; grp.add(deck);
    const rail=new THREE.Mesh(new THREE.BoxGeometry(wx1-wx0,.2,.22),hedge); rail.position.set((wx0+wx1)/2,1.13,wy-.42); grp.add(rail);
    for(let x=wx0+.6;x<wx1;x+=2.4){ const p=new THREE.Mesh(new THREE.CylinderGeometry(.08,.08,.95,6),white); p.position.set(x,.48,wy); grp.add(p); }
    const FLAGC=[0xc8102e,0x1d4fa3,0xf2f2f2,0xf3c316,0x1f8a4c,0xc8102e,0x1d4fa3];
    let k=0; for(let x=wx0+.8;x<wx1-.4;x+=1.7){ if(Math.abs(x-cx)<W*.3) continue;
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,2.2,6),white); pole.position.set(x,2.05,wy-.45); pole.castShadow=true; grp.add(pole);
      const fl=new THREE.Mesh(new THREE.PlaneGeometry(.55,.36),M(FLAGC[k++%FLAGC.length],{side:THREE.DoubleSide})); fl.position.set(x+.29,2.95,wy-.45); fl.castShadow=true; grp.add(fl); }
    maxH=TOP+.57; ext(cx,cz,W/2+1.7,D/2+.8);
  } else if(b.kind==='thai'){
    const [x,y,w,h]=b.rects[0]; const cx=X(x+w/2),cz=Z(y+h/2),W=w*S,D=h*S;
    for(const sx of [-1,1]) for(const sz of [-1,1]) add(new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,1,6),own(mat.wood))).position.set(cx+sx*(W/2-.3),.5,cz+sz*(D/2-.3));
    add(new THREE.Mesh(new THREE.BoxGeometry(W,.15,D),own(mat.wood))).position.set(cx,1.05,cz);
    add(new THREE.Mesh(new THREE.BoxGeometry(W*.8,1.1,D*.7),own(mat.wood))).position.set(cx,1.65,cz);
    const r=add(new THREE.Mesh(hipRoof(W*.95,D*.85,2.3),roofM)); r.position.set(cx,2.15,cz);
    maxH=4.5; ext(cx,cz,W/2,D/2);
  } else {
    for(const rc of b.rects){
      const [x,y,w,h,fo,rot]=rc; const fl=fo||b.floors; const W=w*S,D=h*S; const H=Math.max(fl*FH,.5);
      const cx=X(x+w/2),cz=Z(y+h/2); const ry=rot?-rot*Math.PI/180:0;
      const sub=new THREE.Group(); sub.position.set(cx,0,cz); sub.rotation.y=ry; grp.add(sub);
      const put=(mesh,px,py,pz)=>{mesh.position.set(px,py,pz);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.b=b;sub.add(mesh);pickables.push(mesh);return mesh;};
      if(b.kind==='greenhouse'){ // long low glasshouse rows
        put(new THREE.Mesh(new THREE.BoxGeometry(W,.55,D),own(M(0xe9eef0,{roughness:.3,transparent:true,opacity:.85}))),0,.28,0);
        put(new THREE.Mesh(barrel(W,D,.35),own(M(0xdfe9ec,{roughness:.2,transparent:true,opacity:.8}))),0,.55,0);
        maxH=Math.max(maxH,.9); ext(cx,cz,Math.max(W,D)/2,Math.max(W,D)/2); continue; }
      const g=new THREE.BoxGeometry(W,H,D); boxUV(g,W,D,fl, b.kind==='houses'?1.2:1.6);
      put(new THREE.Mesh(g,[wall,wall,flat,flat,wall,wall]),0,H/2,0);
      let top=H;
      if(b.style==='pitched'||b.kind==='houses'||b.kind==='shrine'){
        const rh=THREE.MathUtils.clamp(Math.min(W,D)*.42,.5,2.0);
        put(new THREE.Mesh(hipRoof(W+.5,D+.5,b.kind==='shrine'?1.6:rh),b.kind==='shrine'?own(mat.gold):roofM),0,H,0); top=H+rh;
        if(b.kind!=='houses'&&b.kind!=='shrine'&&Math.max(W,D)>4.2&&fl>=3){
          const cw=Math.min(W,D)*.42, along=W>=D, off=(Math.max(W,D)/2)-cw*.6;
          put(new THREE.Mesh(new THREE.BoxGeometry(along?cw:Math.min(W,D)*.55,H+FH*1.3,along?Math.min(W,D)*.55:cw),white), along?off:0,(H+FH*1.3)/2, along?0:off);
        }
        if(b.style==='pitched'&&b.kind!=='houses'&&b.kind!=='shrine'&&fl>=2&&b.cat!=='unknown'){
          put(new THREE.Mesh(new THREE.BoxGeometry(Math.min(2.2,W*.5),.12,1.1),white),0,FH*1.05,D/2+.55);
          put(new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,FH,6),white),-Math.min(1,W*.22),FH/2,D/2+1);
          put(new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,FH,6),white), Math.min(1,W*.22),FH/2,D/2+1);
        }
      } else if(b.style==='arch'){
        const rh=Math.min(W,D)*.32; put(new THREE.Mesh(barrel(W+.3,D+.3,rh),roofM),0,H,0); top=H+rh;
      } else {
        put(new THREE.Mesh(new THREE.BoxGeometry(W+.12,.2,D+.12),white),0,H+.1,0);
        if(W*D>8) put(new THREE.Mesh(new THREE.BoxGeometry(Math.min(W,D)*.35,.6,Math.min(W,D)*.45),flat),W*.15,H+.4,-D*.15);
        if(b.style==='shop'){ put(new THREE.Mesh(new THREE.BoxGeometry(W+.08,.28,D+.08),own(M(b.id===21?0x19a3df:0x2b9a52))),0,H-.25,0); }
        top=H+.2;
      }
      maxH=Math.max(maxH,top);
      const hw=(rot?Math.max(W,D):W)/2, hd=(rot?Math.max(W,D):D)/2; ext(cx,cz,hw,hd);
    }
  }
  b.center=new THREE.Vector3((minx+maxx)/2,maxH/2,(minz+maxz)/2);
  b.size=Math.max(maxx-minx,maxz-minz,maxH*1.3);
  b.top=new THREE.Vector3(b.center.x,maxH+.5,b.center.z);
  if(b.kind==='houses'){ b.center.set(X(420),.6,Z(2035)); b.size=34; b.top.set(X(420),2.2,Z(1990)); }
  if(b.kind==='greenhouse'){ b.size=Math.max(b.size,14); }
  b.mats=mats; b.grp=grp; scene.add(grp); byId.set(b.id,b);
}
DATA.forEach(makeBuilding);

/* ============ trees (instanced, trunk + crown) ============ */
{
  let seed=7; const rnd=(a,b)=>{seed=(seed*16807)%2147483647; return a+(seed/2147483647)*(b-a);};
  const pts=MAP.trees.map(t=>t.slice());
  for(let i=0;i<420;i++){ const side=rnd(0,1)<.5; pts.push([side?rnd(-900,40):rnd(640,1600),rnd(230,2700),rnd(.9,1.8)]); }
  for(let i=0;i<140;i++) pts.push([rnd(-900,1600),rnd(2120,2800),rnd(.9,1.8)]);
  for(let i=0;i<160;i++) pts.push([rnd(-900,1600),rnd(-700,125),rnd(.9,1.8)]);
  const crownG=new THREE.IcosahedronGeometry(.75,0), trunkG=new THREE.CylinderGeometry(.08,.11,.7,5);
  const crown=new THREE.InstancedMesh(crownG,M(0xffffff,{flatShading:true,roughness:.95}),pts.length), trunk=new THREE.InstancedMesh(trunkG,mat.trunk,pts.length);
  const d=new THREE.Object3D(), col=new THREE.Color(), pal=[0x3f6b45,0x4f7d48,0x5c8a4c,0x36603f,0x6a9150];
  pts.forEach(([x,y,s],i)=>{
    d.position.set(X(x),.35*s,Z(y)); d.scale.setScalar(s); d.rotation.set(0,rnd(0,6),0); d.updateMatrix(); trunk.setMatrixAt(i,d.matrix);
    d.position.y=.95*s; d.scale.set(s,s*rnd(.95,1.3),s); d.rotation.set(rnd(0,3),rnd(0,3),0); d.updateMatrix(); crown.setMatrixAt(i,d.matrix);
    crown.setColorAt(i,col.setHex(pal[i%pal.length]));
  });
  crown.castShadow=trunk.castShadow=true; scene.add(crown,trunk);
}

/* ============ tags ============ */
const tagsEl=document.getElementById('tags'); const tagEls=new Map();
const short=n=>n.replace(/^อาคาร/,'').replace(/\s*\(.*?\)/,m=>m.length>14?'':m).trim();
DATA.forEach(b=>{const t=document.createElement('div');t.className='tag';t.style.setProperty('--c',CATS[b.cat].c);
  t.innerHTML=`<i></i>${b.code.slice(1)}<span>${short(b.name)}</span>`;
  t.addEventListener('click',e=>{e.stopPropagation();select(b.id);});
  t.addEventListener('pointerenter',()=>hover(b)); t.addEventListener('pointerleave',()=>hover(null));
  tagsEl.appendChild(t); tagEls.set(b.id,t);});
const PIN_IC='<svg viewBox="0 0 24 24"><path d="M12 11v6"/><path d="M12 7h.01"/></svg>';
const svcPins=DATA.filter(b=>SERVICES[b.id]).map(b=>{ const el=document.createElement('div'); el.className='svcpin'; el.innerHTML=PIN_IC; el.title='มีข้อมูลบริการ: '+b.name;
  el.addEventListener('click',e=>{e.stopPropagation();select(b.id);}); el.addEventListener('pointerenter',()=>hover(b)); el.addEventListener('pointerleave',()=>hover(null));
  tagsEl.appendChild(el); return {b,el,p:new THREE.Vector3()}; });
const staticLabels=[['ถนนพหลโยธิน',560,176,.4],['คลอง',318,1452,.3],['สนามกีฬากลาง',406,1787,2.2],['ทางเข้า',409,232,.3],['ทางออก',374,232,.3]].map(([txt,x,y,h])=>{
  const el=document.createElement('div');el.className='slabel';el.textContent=txt;tagsEl.appendChild(el);return {el,p:new THREE.Vector3(X(x),h,Z(y))};});

/* ============ camera: drone path ============ */
const S_MIN=100, S_MAX=1760, LOOK=245, HGT=12.5;
const PATH=[[0,393],[700,393],[1100,396],[1400,402],[1700,406],[2300,406]];
const pathX=py=>{for(let i=0;i<PATH.length-1;i++){const[a,x1]=PATH[i],[b,x2]=PATH[i+1]; if(py<=b) return x1+(x2-x1)*Math.max(0,(py-a)/(b-a));} return PATH[PATH.length-1][1];};
let sCur=S_MIN, sTarget=S_MIN, yaw=0, pitch=0, yawT=0, pitchT=0, lift=1;
const _p=new THREE.Vector3(), _t=new THREE.Vector3();
function tourPose(s,yw=yaw,pt=pitch,lf=lift,outP=_p,outT=_t){
  outP.set(X(pathX(s)),HGT+lf*38,Z(s-lf*40));
  const lx=X(pathX(s+LOOK)), lz=Z(s+LOOK); let vx=lx-outP.x, vz=lz-outP.z; const vy=1.5-outP.y;
  const c=Math.cos(yw), sn=Math.sin(yw); const rx=vx*c+vz*sn, rz=-vx*sn+vz*c;
  const len=Math.hypot(rx,vy,rz); outT.set(outP.x+rx,outP.y+vy+pt*len,outP.z+rz); return [outP,outT];
}
const lookPy=()=>sCur+LOOK;
const zoneAt=py=>py<ZONE_Y[0]?1:py<ZONE_Y[1]?2:3;

let mode='tour', tween=null;
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function tweenTo(p1,t1,dur,done){ tween={p0:camera.position.clone(),t0:camera.userData.look?camera.userData.look.clone():controls.target.clone(),p1:p1.clone(),t1:t1.clone(),s:performance.now(),d:dur,done}; mode='tween'; }

/* ============ interaction ============ */
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
let hovered=null, selected=null, outline=null, floorBand=null;
const ACC=new THREE.Color(0xff5a1f), BLACK=new THREE.Color(0);
function pick(cx,cy){ const r=canvas.getBoundingClientRect(); ndc.set((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1);
  ray.setFromCamera(ndc,camera); const hit=ray.intersectObjects(pickables,false)[0]; return hit?hit.object.userData.b:null; }
function paint(){
  for(const b of DATA){ const isSel=selected&&selected.id===b.id, isHov=hovered&&hovered.id===b.id;
    b.mats.forEach(m=>{ if(!m.emissive) return; if(!m.userData.e0){ m.userData.e0=m.emissive.clone(); m.userData.i0=m.emissiveIntensity; }
      if(isSel||isHov){ m.emissive.copy(ACC); m.emissiveIntensity=isSel?(floorBand?.02:.09):.12; } else { m.emissive.copy(m.userData.e0); m.emissiveIntensity=m.userData.i0; } });
    const t=tagEls.get(b.id); t.classList.toggle('sel',!!isSel); t.classList.toggle('hot',!!isHov&&!isSel); }
}
function setOutline(b){
  if(outline){ scene.remove(outline); outline.traverse(o=>{o.geometry&&o.geometry.dispose();}); outline=null; }
  if(!b) return; outline=new THREE.Group(); const lm=new THREE.LineBasicMaterial({color:0xff5a1f});
  b.grp.updateMatrixWorld(true);
  b.grp.traverse(o=>{ if(o.isMesh&&o.geometry.type==='BoxGeometry'&&o.geometry.parameters.height>.4){ const e=new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry),lm); o.matrixWorld.decompose(e.position,e.quaternion,e.scale); outline.add(e);} });
  scene.add(outline);
}
const tip=document.getElementById('tip');
function hover(b){ if(hovered===b) return; hovered=b; paint();
  canvas.style.cursor=b?'pointer':''; }

let drag=null;
canvas.addEventListener('pointerdown',e=>{ drag={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,axis:null,type:e.pointerType,moved:0}; closeResults(); });
addEventListener('pointermove',e=>{
  if(!drag){ if(e.pointerType==='mouse'&&e.target===canvas){ hover(pick(e.clientX,e.clientY)); tip.style.left=e.clientX+14+'px'; tip.style.top=e.clientY+14+'px'; } return; }
  const dx=e.clientX-drag.lx, dy=e.clientY-drag.ly; drag.lx=e.clientX; drag.ly=e.clientY; drag.moved=Math.hypot(e.clientX-drag.x,e.clientY-drag.y);
  if(mode!=='tour') return;
  if(drag.type==='mouse'){ yawT-=dx*.0035; pitchT=THREE.MathUtils.clamp(pitchT-dy*.0022,-.35,.3); }
  else { if(!drag.axis&&drag.moved>8) drag.axis=Math.abs(e.clientX-drag.x)>Math.abs(e.clientY-drag.y)?'x':'y';
    if(drag.axis==='x') yawT-=dx*.005; else if(drag.axis==='y') { sTarget-=dy*2.4; hideHint(); } }
  yawT=THREE.MathUtils.clamp(yawT,-1.3,1.3);
});
addEventListener('pointerup',e=>{ if(!drag) return; const d=drag; drag=null;
  if(d.moved<6&&e.target===canvas){ const b=pick(e.clientX,e.clientY); if(b) select(b.id); else if(mode==='focus') backToTour(); } });
canvas.addEventListener('wheel',e=>{ if(mode!=='tour') return; e.preventDefault(); sTarget+=e.deltaY*.55; hideHint(); },{passive:false});
const hint=document.getElementById('hint'); let hinted=false; function hideHint(){ if(!hinted){hinted=true;hint.classList.add('off');} }

/* ============ panel / select ============ */
const panel=document.getElementById('panel'); const $=id=>document.getElementById(id);
const ORDER=DATA.map(b=>b.id); let viewOffset=0, viewOffsetTarget=0;
function setFloor(b,floor){
  if(floorBand){ scene.remove(floorBand); floorBand=null; }
  document.querySelectorAll('.frow').forEach(r=>r.classList.toggle('on',+r.dataset.f===floor));
  if(!b||!floor) return; floorBand=new THREE.Group();
  const m=new THREE.MeshBasicMaterial({color:0xff5a1f,transparent:true,opacity:.55,depthWrite:false}), lm=new THREE.LineBasicMaterial({color:0xff5a1f});
  for(const [x,y,w,h,fo,rot] of b.rects){ const fl=fo||b.floors; if(floor>fl) continue;
    const g=new THREE.BoxGeometry(w*S+.18,FH*.86,h*S+.18); const mesh=new THREE.Mesh(g,m); mesh.position.set(X(x+w/2),(floor-.5)*FH,Z(y+h/2)); if(rot) mesh.rotation.y=-rot*Math.PI/180;
    const e=new THREE.LineSegments(new THREE.EdgesGeometry(g),lm); e.position.copy(mesh.position); e.rotation.copy(mesh.rotation); floorBand.add(mesh,e); }
  scene.add(floorBand);
}
function renderRooms(b,floor){
  const el=$('pRooms');
  if(!b.rooms.length){ el.innerHTML='<div class="todo">ยังไม่มีข้อมูลห้อง — ทีมสำรวจกรอกในชีต <b>rooms</b> (building_id · floor · room_from · room_to · room_name)</div>'; return; }
  const byF={}; b.rooms.forEach(r=>(byF[r.floor]=byF[r.floor]||[]).push(r));
  el.innerHTML='<div class="floors">'+Object.keys(byF).sort((a,c)=>c-a).map(f=>`<div class="frow${+f===floor?' on':''}" data-f="${f}"><span class="f">ชั้น ${f}</span><span class="r">${byF[f].map(r=>r.from===r.to?r.from:r.from+'–'+r.to).join(', ')}</span><span class="nm">${byF[f].map(r=>r.name).filter(Boolean).join(', ')}</span></div>`).join('')+'</div>'
    +(b.rooms.some(r=>r.sample)?'<div class="todo" style="margin-top:8px">⚠ ข้อมูลตัวอย่าง: สมมติว่าเลขห้อง = เลขอาคารเรียน + ชั้น + ลำดับห้อง ต้องยืนยันหน้างาน</div>':'');
  el.querySelectorAll('.frow').forEach(r=>r.onclick=()=>{ const f=+r.dataset.f; setFloor(b,f); });
}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function svcCard(u,hl){
  return `<div class="sc${hl?' hl':''}" data-k="${u.k}"><b>${esc(u.n)}</b>`
   +(u.hot?`<div class="hot">⏰ ${esc(u.hot)}</div>`:'')
   +(u.t?`<div class="lbl">ทำอะไรได้</div><div class="chips">${u.t.map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:'')
   +(u.d?`<div class="lbl">เอกสาร / สิ่งที่ต้องเตรียม</div><ul class="docs">${u.d.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'')
   +(u.tip?`<div class="tip">💡 ${esc(u.tip)}</div>`:'')
   +(u.room?`<div class="room">ห้อง: ${esc(u.room)}</div>`:'')
   +(u.ph?`<div class="ph">☎ ${esc(u.ph)}</div>`:'')
   +(u.note?`<div class="note">⚠ ${esc(u.note)}</div>`:'')
   +`<div class="src">${u.s.map(id=>`<a href="${SRC[id].u}" target="_blank" rel="noopener">${esc(SRC[id].t)} · ${esc(SRC[id].y)} ↗</a>`).join('')}<span class="st ${u.st}">${STLABEL[u.st]}</span></div></div>`;
}
function renderSvc(b,openF,hlKey){
  const S=SERVICES[b.id];
  if(!S){ $('pAbout').innerHTML=''; $('pSvc').innerHTML=''; $('pRoomsSec').style.display=''; return; }
  $('pRoomsSec').style.display=b.rooms.length?'':'none';
  $('pAbout').innerHTML=`<div class="about">${esc(S.about)}${S.extra?`<span class="ex">${esc(S.extra.t)} · <a href="${SRC[S.extra.s[0]].u}" target="_blank" rel="noopener">แหล่งข้อมูล ↗</a></span>`:''}</div>`;
  const fs=Object.keys(S.floors).map(Number).sort((a,c)=>(c||-1)-(a||-1));
  $('pSvc').innerHTML=`<div class="sec" style="margin-top:0"><h4><span>บริการในอาคาร · แยกตามชั้น</span><span>DIRECTORY</span></h4><div class="svc">`+fs.map(f=>{
      const us=S.floors[f]; const open=(openF!==undefined&&openF!==null)?f===openF:fs.length===1;
      return `<div class="sf${open?' open':''}" data-f="${f}"><button class="sfh"><span class="fl">${f?'ชั้น '+f:'ไม่ระบุชั้น'}</span><span class="nm">${us.map(u=>esc(u.n)).join(' · ')}</span><span class="ch">›</span></button><div class="sfb">${us.map(u=>svcCard(u,u.k===hlKey)).join('')}</div></div>`;}).join('')
    +`</div><div class="todo" style="margin-top:8px">ข้อมูลรวบรวมจากเว็บไซต์มหาวิทยาลัย · ทีมสำรวจต้องยืนยันหน้างานและเพิ่มเอกสารที่ต้องใช้ในชีต <b>services</b></div></div>`;
  $('pSvc').querySelectorAll('.sf').forEach(row=>row.querySelector('.sfh').onclick=()=>{
    const f=+row.dataset.f, was=row.classList.contains('open');
    $('pSvc').querySelectorAll('.sf').forEach(r=>r.classList.remove('open'));
    if(!was){ row.classList.add('open'); setFloor(b,f||null); } else setFloor(b,null);
    paint(); });
}
function select(id,fromHash,opt={}){
  const b=byId.get(id); if(!b) return; selected=b; hover(null); paint(); setOutline(b); closeResults(); $('list').classList.remove('on');
  $('pRoom').innerHTML = opt.room ? `<div class="roomcard"><small>ห้องที่ค้นหา</small><b>${opt.room}</b><span class="fl">ชั้น ${opt.floor}</span><p>อยู่ที่ ${b.name}<br>เข้าทางหลักของอาคาร แล้วขึ้นบันได/ลิฟต์ไปชั้น ${opt.floor}</p>${opt.sample?'<span class="sample">ข้อมูลตัวอย่าง · รอยืนยันหน้างาน</span>':''}${opt.official?'<span class="sample">รูปแบบเลขห้องจากเว็บไซต์มหาวิทยาลัย (15-xxx = อาคาร 100 ปี)</span>':''}</div>`
    : opt.task ? (()=>{ const t=opt.task, u=t.u||{}; return `<div class="taskcard"><small>งานที่ค้นหา</small><b>${esc(t.l)}</b><span class="fl">${t.f?'ชั้น '+t.f:'ไม่ระบุชั้น'}</span><p>ไปที่ <strong>${esc(u.n||'')}</strong><br>${esc(b.name)}</p></div>`; })()
    : opt.floor ? `<div class="roomcard"><small>ช่วงห้องที่ค้นหา</small><b>${opt.range}</b><span class="fl">ชั้น ${opt.floor}</span><p>${b.name}</p>${opt.sample?'<span class="sample">ข้อมูลตัวอย่าง · รอยืนยันหน้างาน</span>':''}</div>` : '';
  renderRooms(b,opt.floor); renderSvc(b,opt.task?opt.task.f:opt.floor,opt.task?opt.task.k:null); setFloor(b,opt.floor||(opt.task&&opt.task.f)||null); paint();
  const pb=$('panel').querySelector('.p-body'); pb.scrollTop=0;
  if(opt.task) setTimeout(()=>{ const c=$('pSvc').querySelector('.sc.hl'); if(c) pb.scrollTo({top:c.offsetTop-pb.offsetTop-90,behavior:'smooth'}); },650);
  const code=b.code;
  $('pCode').textContent=code; $('pZone').textContent='ZONE 0'+b.zone+' · '+ZONES[b.zone].short; $('pName').textContent=b.name;
  $('pChips').innerHTML=`<span class="pc" style="--c:${CATS[b.cat].c}"><i></i>${CATS[b.cat].name}</span><span class="pc warn">รอตรวจสอบหน้างาน</span>${b.note?`<span class="pc warn">${b.note}</span>`:''}`;
  $('pPhoto').innerHTML=`<div>ยังไม่มีรูป — ทีมสำรวจ${ZONES[b.zone].short}<br><code>${code}_hero_01.jpg</code></div>`;
  const fl=b.kind==='monument'?'—':b.kind==='houses'?'1–2':b.rects.reduce((m,r)=>Math.max(m,r[4]||b.floors),0);
  $('pGrid').innerHTML=`<div class="cell"><small>จำนวนชั้น</small><b>${fl} <em>(ประมาณ)</em></b></div><div class="cell"><small>เวลาเปิด</small><b>— <em>รอสำรวจ</em></b></div>
    <div class="cell"><small>ตรวจสอบล่าสุด</small><b>ยังไม่ตรวจ</b></div><div class="cell"><small>พิกัด</small><b>— <em>รอจุดอ้างอิง</em></b></div>`;
  $('pLink').innerHTML=`ลิงก์ที่ลงท้ายด้วย <b style="font-family:var(--mono)">#b${b.id}</b> จะพากล้องมาที่อาคารนี้ทันที — ใช้ทำ QR ติดหน้าอาคาร`;
  panel.classList.add('open'); document.body.classList.add('focus'); viewOffsetTarget=1;
  try{ history.replaceState(null,'','#b'+b.id); }catch(e){}
  // sync tour position so "back" returns near this building
  sCur=sTarget=THREE.MathUtils.clamp(b.py-LOOK+40,S_MIN,S_MAX);
  const from=camera.position.clone(); const dir=from.sub(b.center); dir.y=0; if(dir.lengthSq()<.01) dir.set(0,0,-1); dir.normalize();
  const dist=THREE.MathUtils.clamp(b.size*1.7+12,16,62)*(isMobile?1.25:1), el=.55;
  const pos=b.center.clone().add(new THREE.Vector3(dir.x*Math.cos(el),Math.sin(el),dir.z*Math.cos(el)).multiplyScalar(dist));
  controls.enabled=false;
  tweenTo(pos,b.center,1150,()=>{ mode='focus'; controls.target.copy(b.center); controls.enabled=true; });
}
function backToTour(){
  if(mode==='tween'&&!selected) return;
  selected=null; paint(); setOutline(null); setFloor(null); panel.classList.remove('open'); document.body.classList.remove('focus'); viewOffsetTarget=0; controls.enabled=false;
  try{history.replaceState(null,'',location.pathname+location.search);}catch(e){}
  yaw=yawT=0; pitch=pitchT=0; const [p,t]=tourPose(sCur,0,0,0,new THREE.Vector3(),new THREE.Vector3());
  tweenTo(p,t,1100,()=>{ mode='tour'; });
}
$('pClose').onclick=backToTour; $('pBack').onclick=backToTour;
$('pPrev').onclick=()=>{ if(!selected) return; const i=ORDER.indexOf(selected.id); select(ORDER[(i-1+ORDER.length)%ORDER.length]); };
$('pNext').onclick=()=>{ if(!selected) return; const i=ORDER.indexOf(selected.id); select(ORDER[(i+1)%ORDER.length]); };
$('pCopy').onclick=async()=>{ if(!selected) return; const url=location.href.split('#')[0]+'#b'+selected.id;
  try{await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์ตรงแล้ว');}catch(e){toast('ลิงก์ตรง: #b'+selected.id);} };
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('on'),1800);}
addEventListener('hashchange',()=>{const m=location.hash.match(/^#b(\d+)$/); if(m&&(!selected||selected.id!=+m[1])) select(+m[1],true);});

/* ============ zones ============ */
function goZone(z){ if(mode!=='tour') { backToTourThen(()=>{sTarget=ZONES[z].s;}); return; } sTarget=ZONES[z].s; yawT=0; pitchT=0; hideHint(); }
function backToTourThen(fn){ backToTour(); const chk=setInterval(()=>{ if(mode==='tour'){clearInterval(chk);fn();} },60); }
document.querySelectorAll('.zbtn').forEach(btn=>btn.onclick=()=>goZone(+btn.dataset.z));
let curZone=0;
function setZoneUI(z){ if(z===curZone) return; curZone=z;
  document.querySelectorAll('.zbtn').forEach(b=>b.classList.toggle('on',+b.dataset.z===z));
  const zt=$('zt'); zt.classList.remove('swap'); void zt.offsetWidth; zt.classList.add('swap');
  $('ztS').textContent=`ZONE 0${z} / 03 · ${ZONES[z].count} อาคาร`; $('ztH').textContent=ZONES[z].name; $('ztP').textContent=ZONES[z].desc; }

/* ============ search & list ============ */
const q=$('q'), res=$('results'); let act=0, hits=[];
const norm=s=>s.toLowerCase().replace(/\s+/g,'');
const IC={room:'<svg viewBox="0 0 24 24"><path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17"/><path d="M3 21h18"/><circle cx="15" cy="12" r="1"/></svg>',
  bld:'<svg viewBox="0 0 24 24"><path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/></svg>'};
IC.task='<svg viewBox="0 0 24 24"><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg>';
function quickTasks(){
  res.innerHTML=`<div class="rh">ทำเรื่องอะไร? · งานยอดฮิต</div><div class="qt">${TASKS.filter(t=>t.pop).map((t,i)=>`<button data-l="${esc(t.l)}">${esc(t.l)}</button>`).join('')}</div>`;
  res.classList.add('on'); hits=[];
  res.querySelectorAll('.qt button').forEach(btn=>btn.onclick=()=>{ const t=TASKS.find(x=>x.l===btn.dataset.l); q.blur(); pickHit({type:'task',b:byId.get(t.b),t}); });
}
function doSearch(){ const v=norm(q.value); if(!v){ if(document.activeElement===q) quickTasks(); else closeResults(); return; }
  const tasks=findTasks(v);
  const rooms=findRooms(v);
  const num=v.replace(/^b0*/,'');
  const blds=DATA.filter(b=>String(b.id)===num||b.code.toLowerCase()===v||norm(b.name).includes(v)||b.alias.some(a=>norm(a).includes(v)||v.includes(norm(a))&&norm(a).length>2)||norm(CATS[b.cat].name).includes(v))
    .sort((a,c)=>(String(c.id)===num)-(String(a.id)===num)).slice(0,6).map(b=>({type:'bld',b}));
  hits=[...tasks,...rooms,...blds]; act=0; renderRes(); }
function renderRes(){
  let html='', lastT='';
  hits.forEach((h,i)=>{ const T=h.type==='bld'?'อาคาร':h.type==='task'?'บริการ':'ห้อง'; if(T!==lastT){ html+=`<div class="rh">${T==='ห้อง'?'ห้อง · ROOM':T==='บริการ'?'บริการ · ทำเรื่องอะไร':'อาคาร · BUILDING'}</div>`; lastT=T; }
    const bn=`${h.b.code} ${h.b.name}`;
    if(h.type==='task') html+=`<div class="res task ${i===act?'act':''}" data-i="${i}"><span class="ico">${IC.task}</span><span>${esc(h.t.l)}<span class="sub">${esc(h.t.u?h.t.u.n:'')} · ${h.t.f?'ชั้น '+h.t.f:'ไม่ระบุชั้น'} · ${esc(bn)}</span></span></div>`;
    else if(h.type==='room') html+=`<div class="res room ${i===act?'act':''}" data-i="${i}"><span class="ico">${IC.room}</span><span>ห้อง <b style="font-family:var(--mono)">${h.room}</b> · ชั้น ${h.floor}<span class="sub">${bn}</span></span></div>`;
    else if(h.type==='range') html+=`<div class="res room ${i===act?'act':''}" data-i="${i}"><span class="ico">${IC.room}</span><span><b style="font-family:var(--mono)">${h.r.from}–${h.r.to}</b> · ชั้น ${h.floor}<span class="sub">${bn}</span></span></div>`;
    else html+=`<div class="res ${i===act?'act':''}" data-i="${i}"><span class="ico">${IC.bld}</span><span class="n">${h.b.code}</span>${h.b.name}<span class="z">${ZONES[h.b.zone].short}</span></div>`; });
  res.innerHTML=html||`<div class="res empty">ไม่พบ — ลองพิมพ์สิ่งที่จะไปทำ เช่น จ่ายค่าเทอม, กยศ, ปริ้นงาน หรือเลขห้อง เช่น 15-409</div>`;
  res.classList.add('on'); res.querySelectorAll('.res[data-i]').forEach(el=>el.onclick=()=>{pickHit(hits[+el.dataset.i]);q.blur();}); }
function pickHit(h){ if(!h) return;
  if(h.type==='task') select(h.b.id,false,{task:h.t});
  else if(h.type==='room') select(h.b.id,false,{room:h.room,floor:h.floor,sample:h.r.sample,official:h.r.official});
  else if(h.type==='range') select(h.b.id,false,{floor:h.floor,range:h.r.from+'–'+h.r.to,sample:h.r.sample});
  else select(h.b.id); }
function closeResults(){res.classList.remove('on');}
q.addEventListener('input',doSearch); q.addEventListener('focus',doSearch);
q.addEventListener('keydown',e=>{ if(e.key==='ArrowDown'){act=Math.min(act+1,hits.length-1);renderRes();e.preventDefault();}
  else if(e.key==='ArrowUp'){act=Math.max(act-1,0);renderRes();e.preventDefault();}
  else if(e.key==='Enter'&&hits[act]){pickHit(hits[act]);q.blur();} else if(e.key==='Escape'){closeResults();q.blur();} });
addEventListener('keydown',e=>{ if(e.target===q) return;
  if(e.key==='/'){e.preventDefault();q.focus();}
  else if(e.key==='Escape'){ $('list').classList.remove('on'); if(mode!=='tour') backToTour(); }
  else if(['1','2','3'].includes(e.key)) goZone(+e.key);
  else if(mode==='tour'&&(e.key==='ArrowDown'||e.key==='s'||e.key==='PageDown')){ sTarget+=140; hideHint(); }
  else if(mode==='tour'&&(e.key==='ArrowUp'||e.key==='w'||e.key==='PageUp')){ sTarget-=140; }
  else if(selected&&e.key==='ArrowRight') $('pNext').click(); else if(selected&&e.key==='ArrowLeft') $('pPrev').click(); });
$('tList').onclick=()=>$('list').classList.add('on'); $('lClose').onclick=()=>$('list').classList.remove('on');
$('list').addEventListener('click',e=>{if(e.target.id==='list')$('list').classList.remove('on');});
$('listBody').innerHTML=[1,2,3].map(z=>`<div class="zone-h">ZONE 0${z} · ${ZONES[z].name.toUpperCase()}</div>`+DATA.filter(b=>b.zone===z).map(b=>`<div class="li" data-id="${b.id}"><span class="n">${b.code}</span><span class="d" style="background:${CATS[b.cat].c}"></span>${b.name}</div>`).join('')).join('');
$('listBody').querySelectorAll('.li').forEach(el=>el.onclick=()=>select(+el.dataset.id));

/* ============ minimap (drawn from the same plan data) ============ */
const MX0=54, MY0=117, MW=567, MH=1989, MK=156/MW, MCH=Math.round(MH*MK);
const mcv=$('mcv'); mcv.height=MCH; mcv.style.height=(MCH/2)+'px'; const mctx=mcv.getContext('2d');
const mx=px=>(px-MX0)*MK, my=py=>(py-MY0)*MK;
const mBase=document.createElement('canvas'); mBase.width=156; mBase.height=MCH;
{ const g=mBase.getContext('2d'); g.fillStyle='#e9e5da'; g.fillRect(0,0,156,MCH);
  const fillP=(p,c)=>{ g.fillStyle=c; g.beginPath(); p.forEach(([x,y],i)=>i?g.lineTo(mx(x),my(y)):g.moveTo(mx(x),my(y))); g.closePath(); g.fill(); };
  MAP.field.forEach(p=>fillP(p,'#dfe3cf')); MAP.forest.forEach(p=>fillP(p,'#b9cfae')); MAP.water.forEach(p=>fillP(p,'#8fbad0'));
  g.fillStyle='#4a4e53'; g.fillRect(0,my(137),156,78*MK);
  g.strokeStyle='#b9b7b0'; g.lineCap='round'; MAP.roads.forEach(([w,p])=>{ g.lineWidth=Math.max(1,w*MK); g.beginPath(); p.forEach(([x,y],i)=>i?g.lineTo(mx(x),my(y)):g.moveTo(mx(x),my(y))); g.stroke(); });
  const st=MAP.stadium; g.fillStyle='#c46f50'; g.beginPath(); g.ellipse(mx(st.cx),my(st.cy),st.L/2*MK,st.W/2*MK,0,0,7); g.fill();
  g.fillStyle='#7d8186'; DATA.forEach(b=>b.rects.forEach(([x,y,w,h,f,rot])=>{ g.save(); g.translate(mx(x+w/2),my(y+h/2)); g.rotate((rot||0)*Math.PI/180); g.fillRect(-w*MK/2,-h*MK/2,Math.max(w*MK,1.2),Math.max(h*MK,1.2)); g.restore(); }));
  g.setLineDash([4,3]); g.strokeStyle='rgba(22,25,29,.5)'; g.lineWidth=1; ZONE_Y.forEach(y=>{g.beginPath();g.moveTo(0,my(y));g.lineTo(156,my(y));g.stroke();});
  g.setLineDash([]); g.font='600 13px IBM Plex Mono, monospace'; g.fillStyle='rgba(22,25,29,.6)'; [['01',420],['02',1010],['03',1760]].forEach(([t,y])=>g.fillText(t,4,my(y))); }
const _d=new THREE.Vector3();
function drawMini(){ mctx.drawImage(mBase,0,0); const px=camera.position.x/S+CX, py=camera.position.z/S+CY; camera.getWorldDirection(_d);
  const a=Math.atan2(_d.z,_d.x), cx=mx(px), cy=my(py);
  mctx.fillStyle='rgba(255,90,31,.28)'; mctx.beginPath(); mctx.moveTo(cx,cy); mctx.arc(cx,cy,60,a-.45,a+.45); mctx.closePath(); mctx.fill();
  mctx.fillStyle='#ff5a1f'; mctx.strokeStyle='#fff'; mctx.lineWidth=2; mctx.beginPath(); mctx.arc(cx,cy,6,0,7); mctx.fill(); mctx.stroke(); }
$('mini').addEventListener('click',e=>{ const r=mcv.getBoundingClientRect(); const py=(e.clientY-r.top)/r.height*MCH/MK+MY0;
  const go=()=>{ sTarget=THREE.MathUtils.clamp(py-LOOK,S_MIN,S_MAX); yawT=0; pitchT=0; hideHint(); };
  mode==='tour'?go():backToTourThen(go); });

/* ============ loop ============ */
function resize(){ renderer.setSize(innerWidth,innerHeight,false); camera.aspect=innerWidth/innerHeight; camera.fov=camera.aspect<1?62:48; camera.updateProjectionMatrix(); }
addEventListener('resize',resize); resize();
const v3=new THREE.Vector3(); let last=performance.now(); let T0=performance.now()+300;
function frame(now){
  requestAnimationFrame(frame); const dt=Math.min(.05,(now-last)/1000); last=now;
  sTarget=THREE.MathUtils.clamp(sTarget,S_MIN,S_MAX);
  if(mode==='tour'){
    const k=1-Math.pow(.0015,dt); sCur+=(sTarget-sCur)*k; const it=Math.min(1,(now-T0)/2400); lift=1-ease(it);
    if(!drag&&Math.abs(sTarget-sCur)>2){ yawT*=Math.pow(.25,dt); pitchT*=Math.pow(.25,dt); }
    yaw+=(yawT-yaw)*(1-Math.pow(.002,dt)); pitch+=(pitchT-pitch)*(1-Math.pow(.002,dt));
    tourPose(sCur); camera.position.copy(_p); camera.lookAt(_t); camera.userData.look=_t.clone();
  } else if(mode==='tween'){
    const k=Math.min(1,(now-tween.s)/tween.d), e=ease(k);
    camera.position.lerpVectors(tween.p0,tween.p1,e); const lk=new THREE.Vector3().lerpVectors(tween.t0,tween.t1,e); camera.lookAt(lk); camera.userData.look=lk;
    if(k>=1){ const d=tween.done; tween=null; d&&d(); }
  } else { controls.update(); camera.userData.look=controls.target.clone(); }
  // shadows follow the view
  const lk=camera.userData.look||_t; sun.target.position.set(lk.x,0,lk.z); sun.position.copy(sun.target.position).add(SUN_OFF); sun.target.updateMatrixWorld();
  // keep focused building clear of the panel
  viewOffset+=(viewOffsetTarget-viewOffset)*.1;
  if(Math.abs(viewOffset)>.002){ const w=innerWidth,h=innerHeight; camera.setViewOffset(w,h,isMobile?0:viewOffset*190,isMobile?viewOffset*(panel.offsetHeight||0)*.45:0,w,h);} else camera.clearViewOffset();
  renderer.render(scene,camera);
  // zone + progress UI
  const z=zoneAt(lookPy()); setZoneUI(z); $('zprog').style.width=((sCur-S_MIN)/(S_MAX-S_MIN)*100).toFixed(1)+'%';
  // tags
  const w=innerWidth,h=innerHeight;
  for(const b of DATA){ const t=tagEls.get(b.id); v3.copy(b.top).project(camera);
    const dist=camera.position.distanceTo(b.top); const isSel=selected&&selected.id===b.id;
    const isHov=hovered&&hovered.id===b.id;
    if(!(isSel||isHov)||v3.z>1){t.classList.add('hide');continue;}
    t.classList.remove('hide'); t.classList.add('near'); t.classList.remove('far');
    t.style.transform=`translate(${(v3.x*.5+.5)*w}px,${(-v3.y*.5+.5)*h}px) translate(-50%,calc(-100% - 6px))`; }
  for(const sp of svcPins){ const b=sp.b; sp.p.copy(b.top).y+=1.1; v3.copy(sp.p).project(camera); const d=camera.position.distanceTo(sp.p);
    const hide=v3.z>1||d>150||(selected&&selected.id===b.id)||(hovered&&hovered.id===b.id)||(mode!=='tour'&&selected&&d>80);
    sp.el.classList.toggle('hide',hide); if(!hide) sp.el.style.transform=`translate(${(v3.x*.5+.5)*w-13}px,${(-v3.y*.5+.5)*h-13}px)`; }
  for(const s of staticLabels){ v3.copy(s.p).project(camera); const d=camera.position.distanceTo(s.p); const vis=v3.z<1&&d<110;
    s.el.style.display=vis?'block':'none'; s.el.style.left=(v3.x*.5+.5)*w+'px'; s.el.style.top=(-v3.y*.5+.5)*h+'px'; }
  if(!isMobile) drawMini();
}
paint(); requestAnimationFrame(frame);
setTimeout(()=>{ $('loader').classList.add('done'); const m=location.hash.match(/^#b(\d+)$/); if(m) setTimeout(()=>select(+m[1],true),900); },300);
