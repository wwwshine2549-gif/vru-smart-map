/* ============ renderer / scene ============ */
/* All plan coordinates are PDF points from แผนผังอาคาร (MapVRU-2016.pdf): x → east, y → south */
const S=0.115, CX=337.5, CY=1110, FH=0.46;
const X=px=>(px-CX)*S, Z=py=>(py-CY)*S;
const canvas=document.getElementById('scene');
const isMobile=matchMedia('(max-width:760px)').matches;
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?1.75:2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
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
    hp.moveTo(cx-r,0); hp.lineTo(cx+r,0); hp.lineTo(cx+r,top-r); hp.absarc(cx,top-r,r,0,Math.PI,false); hp.lineTo(cx-r,0); s.holes.push(hp); }
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

