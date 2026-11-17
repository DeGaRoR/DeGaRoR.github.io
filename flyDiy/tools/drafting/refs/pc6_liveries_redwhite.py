# PC-6 red & white liveries (the livery kit only): python3 rw.py <src build> <outdir>
# A 'alpen'  - the Swiss alpine sweep: white over a red belly that sweeps up into an all-red fin
# B 'nordwind' - the German jump ship: white, a red belly, twin red cheat lines, red rudder, anti-glare
import json, sys, copy
src, outd = sys.argv[1], sys.argv[2]
base = json.load(open(src))

R = 0xda291c      # the Swiss flag's own red (the flag layer draws #da291c - the tints match it)
Rd = 0x8f1610     # a deep red keyline
W = 0xf7f7f4      # warm white
G = 0xd9a33a      # gold keyline
K = 0x16181c      # near black
S = 0xc9cdd2      # polished spinner

BODY = ['body','taper','taperPanel','waistband','ceilingLoop','floorLoop','pillarWindow','pillarCabin','pillarPassenger','pillarTail','pillarFront','pillarTaper']

def build(name, reg, sec, dec, paint):
    d = copy.deepcopy(base); s = d['spec']
    s['finish'] = {'sections': sec, 'decals': dec}
    s['paint'] = paint
    s.setdefault('meta', {}); s['meta']['reg'] = reg; s['meta']['name'] = name
    d['name'] = name
    return d

def off_layers(dec):
    for i in range(1, 6): dec.setdefault('m%dOn' % i, 0)
    for i in range(1, 7): dec.setdefault('t%dOn' % i, 0)
    return dec

# ---------------- A: Alpenglühn ----------------
secA = {k: {'tint': W} for k in BODY}
secA.update({'cowlSkin': {'tint': W}, 'spinner': {'tint': R}, 'wingSkin': {'tint': W}, 'wingTip': {'tint': R},
             'wingAil': {'tint': W}, 'finSkin': {'tint': R}, 'finRud': {'tint': R}, 'stabSkin': {'tint': W},
             'stabElev': {'tint': R}, 'strut': {'tint': R}})
decA = {
 # m1 the red belly sweeping up aft into the red fin, a deep-red line along its edge
 'm1On':1,'m1Pat':2,'m1A':R,'m1B':Rd,'m1Mode':1,'m1Tgt':0,'m1L':0.0,'m1C':-0.25,'m1W':10.6,'m1H':1.9,'m1P':0.36,'m1Q':0.50,
 # m2 the white flash with a gold keyline, kinked up over the cabin, inside the red
 'm2On':1,'m2Pat':3,'m2A':W,'m2B':G,'m2Mode':1,'m2Tgt':0,'m2L':0.4,'m2C':-0.45,'m2W':9.4,'m2H':1.0,'m2P':0.09,'m2Q':0.34,
 # m3 a trail of small white crosses on the red tail cone, the ground clear
 'm3On':1,'m3Pat':10,'m3A':W,'m3B':W,'m3D':W,'m3Clr':2,'m3Mode':1,'m3Tgt':0,'m3L':3.35,'m3C':0.05,'m3W':1.5,'m3H':0.42,'m3P':5,'m3Q':2,'m3R':0.28,'m3S':2.2,
 # m4 the Swiss flag high on the red fin
 'm4On':1,'m4Pat':12,'m4P':13,'m4Q':1,'m4Mode':1,'m4Tgt':6,'m4L':3.95,'m4C':1.85,'m4W':0.46,'m4H':0.46,
 # m5 a white-to-clear fade on the red wing tips' inboard edge (plan): the tips melt into the white wing
 'm5On':1,'m5Pat':9,'m5A':R,'m5B':W,'m5D':R,'m5Clr':2,'m5Mode':2,'m5Tgt':4,'m5L':0.0,'m5C':-1.15,'m5W':16.4,'m5H':2.6,'m5P':3,'m5Q':3,'m5R':0,
 # texts
 't1On':1,'t1Txt':'Alpenglühn','t1Face':'lobster2','t1B':1,'t1I':1,'t1Col':R,'t1H':0.16,'t1Mode':1,'t1L':-3.55,'t1C':-0.08,'t1Tgt':0,
 't2On':1,'t2Txt':'TURBO PORTER','t2Face':'barlow','t2B':1,'t2I':1,'t2Col':W,'t2H':0.11,'t2Mode':1,'t2L':-0.6,'t2C':-0.66,'t2Tgt':0,
 't3On':1,'t3Txt':'Alpine Air Service','t3Face':'jost','t3B':1,'t3Col':R,'t3H':0.085,'t3Mode':1,'t3L':-1.35,'t3C':0.02,'t3Tgt':0,
 't4On':1,'t4Txt':'4000 m · 200 m','t4Face':'barlow','t4B':1,'t4Col':W,'t4H':0.075,'t4Mode':1,'t4L':3.85,'t4C':1.25,'t4Tgt':6,
 't5On':1,'t5Txt':'NO STEP','t5Face':'stardos','t5B':1,'t5Col':K,'t5H':0.07,'t5Mode':2,'t5L':-1.6,'t5C':0.0,'t5Tgt':4,
 'regH':0.36,'regCol':W,'regMode':1,'regL':2.35,'regC':-0.30,'regTarget':0,'regFace':'barlow','regB':1,'regI':1,
 'wregOn':0,
 'spiralOn':1,'spiralCol':W,
}
A = build('PC-6 Turbo Porter · Alpenglühn', 'HB-FAG', secA, off_layers(decA), {'job':'full','sweep':0.65,'base':W,'trim':R})

# ---------------- B: Nordwind ----------------
secB = {k: {'tint': W} for k in BODY}
secB.update({'cowlSkin': {'tint': W}, 'spinner': {'tint': S}, 'wingSkin': {'tint': W}, 'wingTip': {'tint': R},
             'wingAil': {'tint': W}, 'finSkin': {'tint': W}, 'finRud': {'tint': R}, 'stabSkin': {'tint': W},
             'stabElev': {'tint': R}})
decB = {
 # m1 the red belly, almost flat, a white line along its top
 'm1On':1,'m1Pat':2,'m1A':R,'m1B':W,'m1Mode':1,'m1Tgt':0,'m1L':0.0,'m1C':-0.62,'m1W':10.6,'m1H':0.9,'m1P':0.42,'m1Q':0.10,
 # m2 twin red cheat lines over a thin red keyline, the gap white, rising aft
 'm2On':1,'m2Pat':1,'m2A':R,'m2B':R,'m2D':Rd,'m2Mode':1,'m2Tgt':0,'m2L':0.2,'m2C':-0.18,'m2W':10.2,'m2H':0.6,'m2P':0.10,'m2Q':0.10,'m2Rot':0.025,
 # m3 the black anti-glare panel on the cowl top (plan)
 'm3On':0,'m3Pat':0,'m3A':K,'m3B':K,'m3Mode':2,'m3Tgt':0,'m3L':0.0,'m3C':-5.85,'m3W':0.62,'m3H':1.45,'m3P':0.9,'m3Q':0.0,
 # m4 the German flag on the white fin
 'm4On':1,'m4Pat':12,'m4P':1,'m4Q':1,'m4Mode':1,'m4Tgt':6,'m4L':3.92,'m4C':1.80,'m4W':0.50,'m4H':0.30,
 # m5 red speed chevrons on the tail cone
 'm5On':1,'m5Pat':9,'m5A':R,'m5B':W,'m5D':R,'m5Clr':2,'m5Mode':2,'m5Tgt':4,'m5L':0.0,'m5C':-1.15,'m5W':39.0,'m5H':2.6,'m5P':3,'m5Q':3,'m5R':0,
 # texts
 't1On':1,'t1Txt':'Turbo Porter','t1Face':'greatvibes','t1Col':K,'t1H':0.22,'t1Mode':1,'t1L':-3.45,'t1C':-0.06,'t1Tgt':0,
 't2On':1,'t2Txt':'Fallschirmsport Nordwind','t2Face':'jost','t2B':1,'t2I':1,'t2Col':R,'t2H':0.115,'t2Mode':1,'t2L':0.6,'t2C':0.18,'t2Tgt':0,
 't3On':1,'t3Txt':'JUMP DOOR · KEEP CLEAR','t3Face':'stardos','t3B':1,'t3Col':R,'t3H':0.055,'t3Mode':1,'t3L':-0.75,'t3C':-0.47,'t3Tgt':0,'t3Side':2,
 't4On':1,'t4Txt':'blue skies','t4Face':'lobster2','t4I':1,'t4Col':W,'t4H':0.12,'t4Mode':1,'t4L':1.4,'t4C':-0.72,'t4Tgt':0,
 't5On':1,'t5Txt':'NO STEP','t5Face':'stardos','t5B':1,'t5Col':K,'t5H':0.07,'t5Mode':2,'t5L':-1.6,'t5C':0.0,'t5Tgt':4,
 'regH':0.36,'regCol':K,'regMode':1,'regL':2.45,'regC':0.12,'regTarget':0,'regFace':'barlow','regB':1,'regI':0,
 'wregOn':1,'wregH':0.85,'wregL':-2.9,'wregC':-1.15,'wregRot':0,
 'spiralOn':0,
}
B = build('PC-6 Turbo Porter · Nordwind', 'D-FNWD', secB, off_layers(decB), {'job':'full','sweep':0.65,'base':W,'trim':R})

for k, d in (('alpen', A), ('nordwind', B)):
    json.dump(d, open('%s/pc6_%s.json' % (outd, k), 'w'))
    print('wrote', k)
