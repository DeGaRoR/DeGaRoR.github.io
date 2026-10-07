import json,sys,math
N=json.load(open(sys.argv[1]))['rows']; leg=int(sys.argv[2]) if len(sys.argv)>2 else 1
run=sys.argv[3] if len(sys.argv)>3 else 'run2_rest'
P=[r for r in json.load(open('real/%s/samples.json'%run))['rows'] if r[9]==leg]
t0=P[0][0]
def near(x,z):
  b=(1e9,0)
  for i in range(len(N)-1):
    ax,az=N[i]['x'],N[i]['z'];dx=N[i+1]['x']-ax;dz=N[i+1]['z']-az;L2=dx*dx+dz*dz
    u=max(0,min(1,((x-ax)*dx+(z-az)*dz)/L2)) if L2>1e-9 else 0
    d=math.hypot(x-ax-u*dx,z-az-u*dz)
    if d<b[0]: b=(d,i)
  return b
step=int(sys.argv[4]) if len(sys.argv)>4 else 40
for r in P[::step]:
  d,i=near(r[1],r[3]); q=N[i]
  print('%6.1f %-9s d %5.1f  agl p %5.0f n %5.0f  Vg p %4.1f n %4.1f  node t %6.1f (dt %+.1f)'%(r[0]-t0,r[5],d,r[4],q['agl'],r[6],q['Vg'],q['t'],q['t']-(r[0]-t0)))
