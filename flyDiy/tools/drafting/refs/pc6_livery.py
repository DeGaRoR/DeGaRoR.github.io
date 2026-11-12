# livery author: python3 mk.py <src build> <out build> [variant json overrides for decals]
import json,sys
src,out=sys.argv[1],sys.argv[2]
ov=json.loads(sys.argv[3]) if len(sys.argv)>3 else {}
d=json.load(open(src)); s=d['spec']
T=0x1fb3c2; O=0xf5862a; C=0xf7f1e3; N=0x163047; Y=0xffc23d; Wh=0xf6f6f1; Om=0xf7a03e
body=['body','taper','taperPanel','waistband','ceilingLoop','floorLoop','pillarWindow','pillarCabin','pillarPassenger','pillarTail','pillarFront','pillarTaper']
sec={k:{'tint':T} for k in body}
sec.update({'cowlSkin':{'tint':T},'spinner':{'tint':O},'wingSkin':{'tint':T},'wingTip':{'tint':O},
 'finSkin':{'tint':T},'finRud':{'tint':Om},'stabSkin':{'tint':Om},'stabElev':{'tint':Om},'wingAil':{'tint':Om}})   # struts and gear legs: no override - the body's turquoise by the parent chain (r13)
dec={
 # m1/m2: the swoosh (craft frame; curve.py gives the line along the body) - a cream sweep and, 8 cm under it, the
 # orange one with its thin navy line = a fat cream keyline
 'm1On':1,'m1Pat':2,'m1A':C,'m1B':C,'m1Mode':1,'m1Tgt':0,'m1L':-0.3,'m1C':-0.2,'m1W':10.2,'m1H':1.6,'m1P':0.5375,'m1Q':0.39,
 'm2On':1,'m2Pat':2,'m2A':O,'m2B':N,'m2Mode':1,'m2Tgt':0,'m2L':-0.3,'m2C':-0.2,'m2W':10.2,'m2H':1.6,'m2P':0.4875,'m2Q':0.39,
 # m3: the low turquoise streak, parallel 28 cm under the swoosh: the same curve in metres (rise q*H 0.62) on a page
 # 4.4 m tall so the sweep's own line (1.6 % of the page) is 7 cm thick; its fill cleared (Clr 1) - only the line
 'm3On':1,'m3Pat':2,'m3A':O,'m3B':T,'m3Clr':1,'m3Mode':1,'m3Tgt':0,'m3L':-0.3,'m3C':-0.3,'m3W':10.2,'m3H':4.4,'m3P':0.4545,'m3Q':0.141,
 # m4: the Swiss flag high on the white fin
 'm4On':1,'m4Pat':12,'m4P':13,'m4Q':1,'m4Mode':1,'m4Tgt':6,'m4L':3.95,'m4C':1.85,'m4W':0.40,'m4H':0.40,
 # m5: a trail of stars, cream and navy rows, on the orange under the streak, between the round window and the registration
 'm5On':1,'m5Pat':10,'m5A':C,'m5B':O,'m5D':N,'m5Clr':2,'m5Mode':1,'m5Tgt':0,'m5L':1.3,'m5C':-0.36,'m5W':1.0,'m5H':0.40,'m5P':0,'m5Q':4,'m5R':0.17,'m5S':2.2,
 # the name, lower on the cowl's flat side between the swoosh and the streak, navy on orange
 't1On':1,'t1Txt':'Gipfelstürmer','t1Face':'lobster2','t1Col':N,'t1H':0.13,'t1Mode':1,'t1L':-3.62,'t1C':-0.33,'t1Tgt':0,
 # the slogan between the swoosh and the streak under the windows, in the fun face
 't2On':1,'t2Txt':'jump higher · land short','t2Face':'lobster2','t2Col':N,'t2H':0.10,'t2Mode':1,'t2L':-1.1,'t2C':-0.16,'t2Tgt':0,
 't3On':1,'t3Txt':'TURBO PORTER','t3Face':'barlow','t3B':1,'t3Col':C,'t3H':0.07,'t3Mode':1,'t3L':-3.7,'t3C':-0.05,'t3Tgt':0,
 'regH':0.30,'regCol':C,'regLine':N,'regMode':1,'regL':2.75,'regC':-0.21,'regTarget':0,'regFace':'barlow','regB':1,'regI':1,
 'wregOn':1,'wregH':0.85,'wregL':-2.9,'wregC':-1.15,'wregRot':0,
 'spiralOn':1,'spiralCol':C,
}
dec.update(ov)
s['finish']={'sections':sec,'decals':dec}
s['paint']={'job':'full','sweep':0.65,'base':T,'trim':N}
s.setdefault('meta',{}); s['meta']['reg']='HB-FDY'; s['meta'].setdefault('name','PC-6 Turbo Porter')
json.dump(d,open(out,'w'))
