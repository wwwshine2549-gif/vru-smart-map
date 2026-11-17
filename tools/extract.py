import pdfplumber, json, sys
pdf=pdfplumber.open(sys.argv[1]); p=pdf.pages[0]
def col(c):
    if isinstance(c,(list,tuple)): return tuple(round(x,2) for x in c)
    return c
def inmap(o): return o['x0']>=50 and o['x1']<=630 and o['top']>=110 and o['bottom']<=2112
out={'roads':[],'water':[],'forest':[],'patterns':[],'fills':[],'brown_lines':[],'walk':[]}
for kind,L in [('R',p.rects),('C',p.curves),('L',p.lines)]:
    for o in L:
        if not inmap(o): continue
        pts=[(round(x,2),round(y,2)) for x,y in (o.get('pts') or [])]
        if kind=='R' and not pts:
            pts=[(o['x0'],o['top']),(o['x1'],o['top']),(o['x1'],o['bottom']),(o['x0'],o['bottom'])]
        bb=[round(o['x0'],2),round(o['top'],2),round(o['x1']-o['x0'],2),round(o['bottom']-o['top'],2)]
        fc=col(o.get('non_stroking_color')); sc=col(o.get('stroking_color')); lw=round(o.get('linewidth',0),2)
        if o.get('stroke') and sc==0.647 and lw>=6: out['roads'].append({'pts':pts,'w':lw,'k':kind}); continue
        if o.get('stroke') and sc==0.749 and lw>=4: out['walk'].append({'pts':pts,'w':lw}); continue
        if o.get('stroke') and sc==(0.53,0.26,0.04) and lw>=6: out['brown_lines'].append({'pts':pts,'w':lw}); continue
        if not o.get('fill'): continue
        if fc in [(0.38,0.83,1.0),(0.0,0.69,0.94)]: out['water'].append({'pts':pts,'bb':bb,'c':fc}); continue
        if fc==(0.53,0.78,0.68): out['forest'].append({'pts':pts,'bb':bb}); continue
        if isinstance(fc,str) and fc.startswith('P'): out['patterns'].append({'id':fc,'pts':pts,'bb':bb,'k':kind}); continue
        out['fills'].append({'k':kind,'c':fc,'bb':bb,'pts':pts})
out['images']=[[round(i['x0'],1),round(i['top'],1),round(i['x1']-i['x0'],1),round(i['bottom']-i['top'],1)] for i in p.images]
ws=p.extract_words()
out['labels']=[{'t':w['text'],'x':round((w['x0']+w['x1'])/2,1),'y':round((w['top']+w['bottom'])/2,1)} for w in ws if w['x0']<630]
json.dump(out,open(sys.argv[2],'w'))
for k,v in out.items(): print(k,len(v))
