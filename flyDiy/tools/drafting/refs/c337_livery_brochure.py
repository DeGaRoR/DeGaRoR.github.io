# The Cessna 337 default livery: the "Skymaster '72" brochure cover (the user's reference, 13 Nov; the dossier):
# lime green over white, a dark green cheat line along the pod at the colour break with a thin line above it,
# green booms, fins and wings, the registration N1799M.   python3 c337_livery_brochure.py <in plane> <out plane>
import json, sys
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src)); s = d['spec']
G = 0xa4c43a      # the lime green
W = 0xf3f3ee      # the white
D = 0x1e3a1a      # the dark green cheat line
K = 0x2b2b2b      # the registration
BODY = ['body','taper','taperPanel','waistband','ceilingLoop','floorLoop','pillarWindow','pillarCabin','pillarPassenger',
        'pillarTail','pillarFront','pillarTaper']
sec = {k: {'tint': G} for k in BODY}
sec.update({'cowlSkin': {'tint': G}, 'spinner': {'tint': G}, 'wingSkin': {'tint': G}, 'wingTip': {'tint': G},
            'wingAil': {'tint': G}, 'finSkin': {'tint': G}, 'finRud': {'tint': G}, 'stabSkin': {'tint': G},
            'stabElev': {'tint': G}, 'boomSkin': {'tint': G}, 'strut': {'tint': W}, 'pod': {'tint': W}})
dec = {
 # m1: the white below the line (the 'sweep' two-tone, nearly level: the brochure's break runs straight along the pod)
 'm1On':1,'m1Pat':2,'m1A':W,'m1B':W,'m1D':G,'m1Mode':1,'m1Tgt':0,'m1L':-0.2,'m1C':-0.45,'m1W':7.2,'m1H':0.9,'m1P':0.62,'m1Q':0.04,'m1Rot':0,
 # m2: the dark cheat line on the break, a thin line above it
 'm2On':1,'m2Pat':1,'m2A':D,'m2B':D,'m2D':G,'m2Mode':1,'m2Tgt':0,'m2L':0.4,'m2C':-0.05,'m2W':6.4,'m2H':0.16,'m2P':0.45,'m2Q':0.0,'m2Rot':0,
 'regH':0.28,'regCol':K,'regMode':1,'regL':4.2,'regC':0.30,'regTarget':0,'regFace':'barlow','regB':1,'regI':1,
 'wregOn':0,'spiralOn':0,
}
for i in range(3, 6): dec['m%dOn' % i] = 0
for i in range(1, 7): dec['t%dOn' % i] = 0
s['finish'] = {'sections': sec, 'decals': dec}
s['paint'] = {'job': 'full', 'sweep': 0.0, 'base': G, 'trim': W}
s.setdefault('meta', {}); s['meta']['reg'] = 'N1799M'; s['meta']['name'] = 'Cessna 337D Super Skymaster'
json.dump(d, open(out, 'w'))
print('wrote', out)
