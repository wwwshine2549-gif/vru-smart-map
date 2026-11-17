import json, math, re, sys
from PIL import Image, ImageDraw
src=open(sys.argv[1]).read()
B=json.loads(re.search(r'const B = (.*?);\nconst MAP',src,re.S).group(1))
MAP=json.loads(re.search(r'const MAP = (.*);',src).group(1))
im=Image.open(sys.argv[2]).convert('RGB'); k=im.width/1188
dr=ImageDraw.Draw(im)
def rect(r,col,wid=2):
    x,y,w,h=r[:4]; rot=r[5] if len(r)>5 and r[5] else 0
    cx,cy=x+w/2,y+h/2; a=math.radians(rot); ca,sa=math.cos(a),math.sin(a)
    pts=[(cx+dx*ca-dy*sa,cy+dx*sa+dy*ca) for dx,dy in [(-w/2,-h/2),(w/2,-h/2),(w/2,h/2),(-w/2,h/2)]]
    dr.polygon([(px*k,py*k) for px,py in pts],outline=col,width=wid)
for w,pts in MAP['roads']: dr.line([(x*k,y*k) for x,y in pts],fill=(255,0,255),width=2)
for b in B:
    for r in b[4]: rect(r,(255,0,0) if b[0]<100 else (0,0,255))
    if b[4]:
        cx=sum(r[0]+r[2]/2 for r in b[4])/len(b[4]); cy=sum(r[1]+r[3]/2 for r in b[4])/len(b[4])
        dr.text((cx*k+3,cy*k+3),str(b[0]),fill=(200,0,0))
for x,y,s in MAP['trees']: dr.ellipse([x*k-2,y*k-2,x*k+2,y*k+2],fill=(0,140,0))
for p in MAP['water']: dr.polygon([(x*k,y*k) for x,y in p],outline=(0,0,200))
im.save(sys.argv[3])
