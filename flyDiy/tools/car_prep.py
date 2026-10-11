#!/usr/bin/env python3
"""car_prep.py - bake the declared DRIVEABLE CARS (tools/car_table.py) and measure each one's
DATA SHEET. ASSETS-OCT G2908.

Usage:  python tools/car_prep.py            (the whole table + the data sheets)
        python tools/car_prep.py --report   (inventory + the sheets printed, nothing written)
Then:   node tools/prop_lod.js --kit cars   (the far levels: the 'car' ladder)

THE BAKE is tools/prop_prep.py's runner pointed at this table (the pier kit's pattern): src/cars/cars_car.js
+ cars_packs.json, media/geo/cars/, media/tex/cars/. Geometry AS-IS, selected by node.

THE DATA SHEET (src/cars/car_<car>.json), everything in the BODY's frame (the delivered frame, levelled;
+x forward, y up, +z right), metres. MEASURED off the delivered geometry:
  wheels      per wheel: its centre, radius (half the tyre's height), width, side, steered (the fronts)
  wheelbase   front axle x - rear axle x;  track: the front pair's z apart (and the rear's)
  ground      the y the tyres stand on (the lowest tyre point)
  steer       the steering wheel's centre and its AXIS (the normal of the rim's plane: its vertices'
              least-variance direction, pointing at the driver); its radius
  box         the body's bounding box; COLLISION: two boxes - the lower body (bumpers to the hood line)
              and the cab (the glasshouse) - plus the four wheels as cylinders
  lamps       per lamp group: the left and right lamp centres (a light's anchor)
ESTIMATED (named so in the file's `estimates`, the feasibility study's numbers to be tuned in play):
  mass, cg, inertia, the driver's eye, the chase and hood cameras.
"""
import importlib.util, json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import prop_prep                                     # noqa: E402
from media_lib import asset_src                      # noqa: E402

_spec = importlib.util.spec_from_file_location('car_table', os.path.join(HERE, 'car_table.py'))
TABLE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(TABLE)
OUT = os.path.join(ROOT, 'src', 'cars')
SRC_ROOT = os.path.dirname(os.path.dirname(asset_src('assets/vehicles/driveable')))
CFG = dict(table=TABLE, src_dir=SRC_ROOT, out_dir=OUT, geo='geo/cars', tex='tex/cars', prefix='cars_',
           packs='cars_packs.json', origin='assets/vehicles/driveable/, per the declared table in tools/car_table.py')

# THE ESTIMATES (the Conquer '89: a 1989 full-size, regular-cab pickup - curb ~1 800-1 950 kg, ~56 % on
# the front axle, the CG ~0.7 m over the ground for an unladen pickup on 0.70 m tyres)
EST = {'conquer': dict(mass=1850, front_share=0.56, cg_height=0.72)}


def pts_of(j, bufs, nodes):
    R = prop_prep.rot_matrix(TABLE.LEVEL)
    out = []
    for name, pos, nrm, uv, idx in prop_prep.gather(j, bufs, None, set(nodes)):
        out += [prop_prep.apply3(R, p) for p in pos]
    return out


def box(P):
    lo = [min(p[k] for p in P) for k in range(3)]
    hi = [max(p[k] for p in P) for k in range(3)]
    return lo, hi


r4 = lambda v: [round(x, 4) for x in v]


def sheet(car):
    path = os.path.join(SRC_ROOT, TABLE.SRC, TABLE.FILE[car])
    j, bufs, _ = prop_prep.load_gltf(path)
    S = {'car': car, 'credit': TABLE.CREDIT[car], 'frame': '+x forward, y up, +z right (left-hand drive); metres; '
         'the body prop\'s own frame (place mount), levelled %s deg' % (TABLE.LEVEL,)}
    W = {}
    for k, n in TABLE.WHEELS.items():
        lo, hi = box(pts_of(j, bufs, [n]))
        c = [(lo[i] + hi[i]) / 2 for i in range(3)]
        W[k] = dict(centre=r4(c), radius=round((hi[1] - lo[1]) / 2, 4), width=round(hi[2] - lo[2], 4),
                    side='left' if c[2] < 0 else 'right', steered=k[0] == 'F',
                    prop='car_%s_wheel_%s' % (car, 'l' if c[2] < 0 else 'r'))
    S['wheels'] = W
    fx = (W['FL']['centre'][0] + W['FR']['centre'][0]) / 2
    rx = (W['RL']['centre'][0] + W['RR']['centre'][0]) / 2
    S['wheelbase'] = round(fx - rx, 4)
    S['track'] = dict(front=round(W['FR']['centre'][2] - W['FL']['centre'][2], 4),
                      rear=round(W['RR']['centre'][2] - W['RL']['centre'][2], 4))
    S['ground'] = round(min(w['centre'][1] - w['radius'] for w in W.values()), 4)
    bottoms = {k: round(w['centre'][1] - w['radius'], 4) for k, w in W.items()}
    S['level_check'] = dict(tyre_bottoms=bottoms, spread=round(max(bottoms.values()) - min(bottoms.values()), 4))
    # the steering wheel: centre, radius, the rim plane's normal (least variance), toward the driver (-x)
    P = pts_of(j, bufs, [TABLE.STEER])
    n_ = len(P)
    c = [sum(p[k] for p in P) / n_ for k in range(3)]
    C = [[sum((p[a] - c[a]) * (p[b] - c[b]) for p in P) / n_ for b in range(3)] for a in range(3)]
    try:
        import numpy as np
        w_, v_ = np.linalg.eigh(np.array(C))
        ax = list(v_[:, 0])
    except ImportError:              # no numpy: the box's thinnest axis
        lo, hi = box(P)
        k = min(range(3), key=lambda k: hi[k] - lo[k])
        ax = [1.0 if i == k else 0.0 for i in range(3)]
    if ax[0] > 0:
        ax = [-a for a in ax]
    lo, hi = box(P)
    S['steer'] = dict(centre=r4([(lo[i] + hi[i]) / 2 for i in range(3)]), axis=r4(ax),
                      radius=round(max(math.dist(p, c) for p in P), 4), prop='car_%s_steer' % car,
                      lock_deg=540, note='a turn of the wheel each side of centre is typical; tune in play')
    # the body's box and the collision proxy
    B = pts_of(j, bufs, TABLE.BODY)
    blo, bhi = box(B)
    S['box'] = dict(lo=r4(blo), hi=r4(bhi))
    hood = box(pts_of(j, bufs, [TABLE.N('hood_CnqerP89_Bodymat_0')]))
    wind = box(pts_of(j, bufs, [TABLE.N('Windshield_UCB_Lights_and_Glass_Transperent_0')]))
    rear = box(pts_of(j, bufs, [TABLE.N('Rear_glass_UCB_Lights_and_Glass_Transperent_0')]))
    hood_top = hood[1][1]
    S['collision'] = dict(
        boxes=[dict(name='lower', lo=r4([blo[0], S['ground'] + 0.28, -0.88]), hi=r4([bhi[0], hood_top, 0.88])),
               dict(name='cab', lo=r4([rear[0][0] - 0.05, hood_top, -0.80]), hi=r4([wind[1][0], bhi[1], 0.80]))],
        wheels='the four wheels as cylinders: centre, radius, width from `wheels`',
        note='box half-width 0.88 = the body sides (mirrors ride outside it)')
    lamps = {}
    for k, n in TABLE.LAMPS.items():
        L = pts_of(j, bufs, [n])
        sides = {}
        for s_, sel in (('left', [p for p in L if p[2] < 0]), ('right', [p for p in L if p[2] >= 0])):
            if sel:
                sides[s_] = r4([sum(p[i] for p in sel) / len(sel) for i in range(3)])
        lamps[k] = dict(prop='car_%s_%s' % (car, k), **sides)
    S['lamps'] = lamps
    # ESTIMATES
    e = EST[car]
    cgx = rx + e['front_share'] * S['wheelbase']
    L_, H_, Wd = bhi[0] - blo[0], bhi[1] - S['ground'], 2 * 0.88
    m = e['mass']
    eye = [S['steer']['centre'][0] - 0.50, S['steer']['centre'][1] + 0.33, S['steer']['centre'][2]]
    S['estimates'] = dict(
        mass_kg=m, note='ESTIMATES, not measured: a 1989 full-size regular-cab pickup (curb ~1 800-1 950 kg, '
        '~56 % front); the CG height and the inertia of a uniform box of the body\'s size; the driver\'s eye '
        '0.50 m behind and 0.33 m above the steering wheel\'s centre. Tune in play.',
        cg=r4([cgx, S['ground'] + e['cg_height'], 0.0]),
        inertia_kgm2=r4([m * (H_ ** 2 + Wd ** 2) / 12, m * (L_ ** 2 + Wd ** 2) / 12, m * (L_ ** 2 + H_ ** 2) / 12]),
        cameras=dict(driver_eye=r4(eye), hood=r4([hood[1][0] - 0.3, hood_top + 0.35, 0.0]),
                     chase=r4([blo[0] - 6.0, bhi[1] + 1.2, 0.0])))
    return S


def main(argv):
    report = '--report' in argv
    prop_prep.main(argv, CFG)
    for car in TABLE.FILE:
        S = sheet(car)
        if report:
            print(json.dumps(S, indent=1))
            continue
        f = os.path.join(OUT, 'car_%s.json' % car)
        json.dump(S, open(f, 'w', newline='\n'), indent=1)
        print('data sheet ->', os.path.relpath(f, ROOT), ' wheelbase %.3f m, track %.3f m, wheel r %.3f m, level spread %.1f mm'
              % (S['wheelbase'], S['track']['front'], S['wheels']['FL']['radius'], 1000 * S['level_check']['spread']))


if __name__ == '__main__':
    main(sys.argv[1:])
