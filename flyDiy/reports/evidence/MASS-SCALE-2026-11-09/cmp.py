import json,sys
o=json.load(open('sc_old.json')); n=json.load(open('sc_new.json'))
f=lambda x: '  -  ' if x is None else '%5.1f'%x
pairs=[p.split(':') for p in sys.argv[1:]]
for a,b in pairs:
  A=o.get(a,{}); B=n.get(b,{})
  if 'O' not in B: print(a,b,'missing'); continue
  print('%-10s -> %-11s overall %s -> %s | perf %s -> %s | geo %s -> %s | specs %s -> %s | conf %s -> %s'%(a,b,f(A.get('O')),f(B['O']),f(A.get('P')),f(B['P']),f(A.get('G')),f(B['G']),f(A.get('S')),f(B['S']),f(A.get('conf')),f(B['conf'])))
  av={(v[0],v[1]):v for v in A.get('v',[])}
  for v in B['v']:
    w=av.get((v[0],v[1]))
    if not w or w[2]!=v[2] or w[3]!=v[3]: print('     ',v[0].ljust(6),(v[1] or '')[:18].ljust(18), (w[2] if w else '-'), (w[3] if w else '-'),'->',v[2],v[3])
