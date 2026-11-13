# the PC-6 on Wiplines, the yellow livery (the user's photos, 13 Nov): python3 yl.py <src build> <out build>
import json, sys
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src)); s = d['spec']
Y = 0xf4c20d      # the yellow
Gn = 0x169a43     # the green
Bl = 0x1c3c8f     # the blue
K = 0x141414      # the script's black
S = 0xc9cdd2      # polished spinner
BODY = ['body','taper','taperPanel','waistband','ceilingLoop','floorLoop','pillarWindow','pillarCabin','pillarPassenger','pillarTail','pillarFront','pillarTaper']
sec = {k: {'tint': Y} for k in BODY}
sec.update({'cowlSkin': {'tint': Y}, 'spinner': {'tint': S}, 'wingSkin': {'tint': Y}, 'wingTip': {'tint': Y}, 'wingAil': {'tint': Y},
            'finSkin': {'tint': Y}, 'finRud': {'tint': Y}, 'finVentral': {'tint': Y}, 'stabSkin': {'tint': Gn}, 'stabElev': {'tint': Gn},
            'strut': {'tint': Y}, 'float': {'tint': Y}})
dec = {
 # m1: the green-over-blue cheat lines, rising aft along the body into the green tailplane
 'm1On':1,'m1Pat':1,'m1A':Gn,'m1B':Bl,'m1D':Y,'m1Mode':1,'m1Tgt':0,'m1L':0.3,'m1C':-0.30,'m1W':10.6,'m1H':0.8,'m1P':0.15,'m1Q':0.0,'m1Rot':0.035,
 # the name on the cowl, black script
 't1On':1,'t1Txt':'Pilatus Porter','t1Face':'lobster2','t1B':1,'t1I':1,'t1Col':K,'t1H':0.14,'t1Mode':1,'t1L':-3.5,'t1C':-0.04,'t1Tgt':0,
 'regH':0.30,'regCol':Bl,'regMode':1,'regL':2.55,'regC':0.18,'regTarget':0,'regFace':'barlow','regB':1,'regI':0,
 'wregOn':0, 'spiralOn':0,
}
for i in range(2, 6): dec['m%dOn' % i] = 0
for i in range(2, 7): dec['t%dOn' % i] = 0
s['finish'] = {'sections': sec, 'decals': dec}
s['paint'] = {'job': 'full', 'sweep': 0.65, 'base': Y, 'trim': Bl}
s.setdefault('meta', {}); s['meta']['reg'] = 'PT-ZPO'; s['meta']['name'] = 'PC-6 Turbo Porter on Wiplines'
json.dump(d, open(out, 'w'))
print('wrote', out)
