import json, numpy as np
from PIL import Image, ImageDraw
FI='/workspace/DeGaRoR.github.io/flyDiy/media/fiches/'
D={'cub':'design_cub','c172':'list_5','twin':'cand_Twin_busher_floats_4b.json'}
cal=json.load(open('calib.json'))
ims=[]
for k,dirn in D.items():
  for view in ['side','plan']:
    c=cal[k][view]; d=json.load(open(f'load_{k}.json'))[k]
    im=Image.open(FI+dirn+f'/{view}.webp').convert('RGBA'); bg=Image.new('RGBA',im.size,(255,255,255,255)); bg.alpha_composite(im); dr=ImageDraw.Draw(bg)
    s=c['s']; r=np.radians(c['rot'])
    def P(p):
      if view=='side': a,b=p[0],-p[1]
      else: a,b=p[2],p[0]
      return ((a*np.cos(r)-b*np.sin(r))*s+c['ox'], (a*np.sin(r)+b*np.cos(r))*s+c['oy'])
    for bm in d['beams']:
      A=P(d['nodes'][bm['a']]['p']); B=P(d['nodes'][bm['b']]['p']); dr.line([A,B],fill=(0,80,255,255),width=1)
    ims.append(bg)
W=max(i.width for i in ims); H=sum(i.height for i in ims)
sheet=Image.new('RGB',(W,H),'white'); y=0
for i in ims: sheet.paste(i,(0,y)); y+=i.height
sheet.save('overlay.png')
