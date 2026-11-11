import json, numpy as np
from PIL import Image
FI='/workspace/DeGaRoR.github.io/flyDiy/media/fiches/'
IX=json.load(open(FI+'index.json'))['fiches']
P={'cub':('design:cub','design_cub'),'c172':('list:5','list_5'),'twin':('cand:Twin_busher_floats_4b.json','cand_Twin_busher_floats_4b.json')}
out={}
for k,(key,dirn) in P.items():
  s=IX[key]['data']['pxPerM']
  d=json.load(open(f'load_{k}.json'))[k]; n=np.array([q['p'] for q in d['nodes']])
  for view in ['side','plan','front']:
    im=np.array(Image.open(FI+dirn+f'/{view}.webp'))[:,:,3]>128
    H,W=im.shape
    if view=='side': a,b,sb = n[:,0], -n[:,1], 1   # u from x (nose left), v from -y
    elif view=='plan': a,b,sb = n[:,2], n[:,0], 1  # guess: u from z, v from x
    else: a,b,sb = n[:,2], -n[:,1], 1
    best=None
    for rot in np.radians(np.arange(-6,6.01,0.5)) if view=='side' else [0.0]:
      for fa in ([1,-1] if view!='side' else [1]):
        ca,sa=np.cos(rot),np.sin(rot)
        A=(a*fa*ca - b*sa)*s; B=(a*fa*sa + b*ca)*s
        for ox in range(int(-A.min())-40, int(W-A.max())+40, 2):
          u=(A+ox).astype(int); ok_u=(u>=0)&(u<W)
          for oy in range(int(-B.min())-40, int(H-B.max())+40, 2):
            v=(B+oy).astype(int); ok=ok_u&(v>=0)&(v<H)
            sc=im[v[ok],u[ok]].sum()
            if best is None or sc>best[0]: best=(sc,ox,oy,float(np.degrees(rot)),fa)
    out.setdefault(k,{})[view]=dict(s=s,score=int(best[0]),n=len(n),ox=best[1],oy=best[2],rot=best[3],flip=best[4],W=W,H=H)
    print(k,view,out[k][view])
json.dump(out,open('calib.json','w'),indent=1)
