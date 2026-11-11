# the sim's tail (stab and fin strips/nodes) against the drawn tail on the fiche's plan and side pictures
import json, numpy as np
FI='/workspace/pp-wt/flyDiy/media/fiches/'
IX=json.load(open(FI+'index.json'))['fiches']
P={'cub':('design:cub','cub_2026_09_20_corrected_json'),'c172':('list:5','cessna172_2026_09_20_json'),'twin':('cand:Twin_busher_floats_4b.json','Twin_busher_floats_4b_json')}
SH={'cub':{'side':(228,583),'plan':(583,900)},'c172':{'side':(210,675),'plan':(675,900)},'twin':{'side':(289,628),'plan':(628,900)}}
cal=json.load(open('calib.json'))
for k,(key,f) in P.items():
  D=json.load(open('pages_'+f+'.json')); M=D['model']; s=IX[key]['data']['pxPerM']
  tags=M['tags']; nodes=M['nodes']
  def tagged(*ts): return np.array([n[:3] for n in nodes if tags[n[4]] in ts])
  # plan: rows (x) where the drawn width exceeds the fuselage near the tail -> the drawn stab's chordwise extent and span
  h,w=SH[k]['plan']; a=np.fromfile(f'alpha_{k}_plan.bin',dtype=np.uint8).reshape(h,w); c=cal[k]['plan']
  xs=[]; spans=[]
  for v in range(h):
    row=np.where(a[v])[0]
    if len(row): xs.append((v-c['oy'])/s); spans.append((row.max()-row.min())/s)
  xs=np.array(xs); spans=np.array(spans)
  aft=xs>xs.max()-2.2   # the last 2.2 m
  tailrows=aft & (spans>1.0)
  dx0,dx1=(xs[tailrows].min(), xs[tailrows].max()) if tailrows.any() else (None,None)
  dspan=spans[tailrows].max() if tailrows.any() else None
  H=tagged('HF','HR','HB','HT'); stab=[s_ for s_ in M['strips'] if M['KIND'][s_[5]]=='stab']
  # the sim stab's chord extent: front spar 15 % of chord ahead of HF, trailing edge chord behind
  hf=[nodes[s_[0]][0]-0.15*s_[4] for s_ in stab]; te=[nodes[s_[0]][0]+0.85*s_[4] for s_ in stab]
  zs=[abs(nodes[s_[1]][2]) for s_ in stab]
  print(f"{k:5} PLAN stab drawn x {dx0:.2f}..{dx1:.2f} span {dspan:.2f} | sim stab LE {min(hf):.2f}..TE {max(te):.2f} span {2*max(zs):.2f} | tail end drawn {xs.max():.2f}")
  # side: the fin's drawn top and the sim's fin top / x
  h,w=SH[k]['side']; a=np.fromfile(f'alpha_{k}_side.bin',dtype=np.uint8).reshape(h,w); c=cal[k]['side']
  r=np.radians(c['rot']); cols=np.where(a.any(axis=0))[0]; rows=np.where(a.any(axis=1))[0]
  # topmost opaque pixel -> metres (ignoring the small rotation)
  vtop=rows.min(); utop=np.where(a[vtop])[0].mean()
  ytop=-(vtop-c['oy'])/s; xtop=(utop-c['ox'])/s
  fin=[s_ for s_ in M['strips'] if M['KIND'][s_[5]]=='fin']
  fy=max(nodes[s_[1]][1] for s_ in fin); fx0=min(nodes[s_[0]][0]-0.15*s_[4] for s_ in fin); fx1=max(nodes[s_[0]][0]+0.85*s_[4] for s_ in fin)
  print(f"      SIDE fin top drawn y {ytop:.2f} at x {xtop:.2f} | sim fin top y {fy:.2f}, fin x {fx0:.2f}..{fx1:.2f}; drawn tail end x {(cols.max()-c['ox'])/s:.2f}")
