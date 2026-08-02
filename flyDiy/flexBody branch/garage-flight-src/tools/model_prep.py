#!/usr/bin/env python3
"""model_prep.py — bake a FlightGear/Blender OBJ into a compact JS payload for the artifact.

Usage: python3 tools/model_prep.py <src_dir> <out.js>
  <src_dir> must contain pa18.obj + texture.png

Output: <out.js> defining  const MODEL_PA18 = { bb, tex, groups: {skin, glass, prop} }
  - exterior meshes only (cockpit/gauges dropped)
  - positions quantized int16 over the model bbox (~0.2 mm resolution)
  - uv quantized uint16, indices uint16, all little-endian, base64
  - texture recompressed to 1024 px JPEG data-URI
Decode counterpart: decodeModel() in the template (pure JS, testable in node).
"""
import base64, io, struct, sys
from PIL import Image

EXTERIOR = {
    'fuselage', 'ailes', 'ailes2', 'profondeur', 'direction',
    'aileronG', 'aileronD', 'voletG', 'voletD', 'capot', 'structure',
    'montants', 'bouchons', 'reservoirs', 'echappe', 'bol',
    'roueG', 'roueD', 'roueA', 'axes', 'axeA',
    'axesGB', 'axesDB', 'axesGH', 'axesDH',
    'cableGB', 'cableDB', 'cableGH', 'cableDH', 'trous',
}
GLASS = {'vitres'}      # transparentExt — exterior windows
PROP = {'helice'}       # spun about its hub by the renderer

# Control surfaces (model frame). Hinge lines measured from the mesh
# (forward-edge profiles); signs follow flight_core conventions:
#   +de = pitch up  -> elevator TE up
#   +da = right roll (more lift model +z side) -> aileronG TE down, aileronD TE up
#   +dr = nose left -> rudder TE toward +z
# 'direction' is fin+rudder fused: ramp smoothsteps the hinge weight over x
# so the fin (fwd of the hinge) stays put without tearing the shared fabric.
SURFACES = [
    ('aileronG',   dict(drive='da', sgn=-1, p=(-0.718, 0.620, 0), ax=(0, 0, 1))),
    ('aileronD',   dict(drive='da', sgn=+1, p=(-0.718, 0.620, 0), ax=(0, 0, 1))),
    ('profondeur', dict(drive='de', sgn=+1, p=(2.834, 0.292, 0),  ax=(0, 0, 1))),
    ('direction',  dict(drive='dr', sgn=-1, p=(2.905, 0.0, 0),    ax=(0, 1, 0),
                        ramp=(2.85, 2.95))),
    # tailwheel steering: linked to rudder at twSteer=0.5 (flight_core cub),
    # swivels about the fork post just ahead of the wheel; spring (axeA) static
    ('roueA',      dict(drive='dr', sgn=-1, k=0.5, p=(3.14, -0.10, 0), ax=(0, 1, 0))),
]
SID = {name: i + 1 for i, (name, _) in enumerate(SURFACES)}


def short(name):        # 'voletG_voletG.mesh' -> 'voletG'
    return name.split('_')[0].split('.')[0]


def parse(path):
    V, VT, faces, cur = [], [], [], None
    for line in open(path):
        t = line.split()
        if not t:
            continue
        if t[0] == 'o':
            cur = short(t[1])
        elif t[0] == 'v':
            V.append(tuple(float(x) for x in t[1:4]))
        elif t[0] == 'vt':
            VT.append((float(t[1]), float(t[2])))
        elif t[0] == 'f':
            idx = []
            for w in t[1:]:
                a = w.split('/')
                idx.append((int(a[0]) - 1, int(a[1]) - 1 if len(a) > 1 and a[1] else 0))
            faces.append((cur, idx))
    return V, VT, faces


def build_group(V, VT, faces, names, bb, with_sid=False):
    (x0, y0, z0), (x1, y1, z1) = bb
    sx, sy, sz = 65535 / (x1 - x0), 65535 / (y1 - y0), 65535 / (z1 - z0)
    vmap, pos, uv, tris, sids = {}, [], [], [], []
    for name, idx in faces:
        if name not in names:
            continue
        sid = SID.get(name, 0)
        vi = []
        for v, vt in idx:
            key = (v, vt)
            if key not in vmap:
                vmap[key] = len(pos)
                x, y, z = V[v]
                pos.append((int((x - x0) * sx) - 32768,
                            int((y - y0) * sy) - 32768,
                            int((z - z0) * sz) - 32768))
                u, w = VT[vt]
                uv.append((int(u * 65535), int(w * 65535)))
                sids.append(sid)
            vi.append(vmap[key])
        for k in range(1, len(vi) - 1):          # fan triangulation
            tris.append((vi[0], vi[k], vi[k + 1]))
    assert len(pos) < 65536, f'group too large for uint16 indices: {len(pos)}'
    buf = io.BytesIO()
    buf.write(struct.pack('<II', len(pos), len(tris)))
    for p in pos:
        buf.write(struct.pack('<3h', *p))
    for t in uv:
        buf.write(struct.pack('<2H', *t))
    for t in tris:
        buf.write(struct.pack('<3H', *t))
    if with_sid:
        buf.write(bytes(sids))
    return len(pos), len(tris), base64.b64encode(buf.getvalue()).decode()


def main(src, out):
    V, VT, faces = parse(f'{src}/pa18.obj')
    used = [V[v] for name, idx in faces for v, _ in idx
            if name in EXTERIOR | GLASS | PROP]
    lo = tuple(min(p[i] for p in used) for i in range(3))
    hi = tuple(max(p[i] for p in used) for i in range(3))
    bb = (lo, hi)

    img = Image.open(f'{src}/texture.png').convert('RGB')
    img.thumbnail((1024, 1024))
    tb = io.BytesIO()
    img.save(tb, 'JPEG', quality=80)
    tex = 'data:image/jpeg;base64,' + base64.b64encode(tb.getvalue()).decode()

    parts, report = [], []
    for gname, names in [('skin', EXTERIOR), ('glass', GLASS), ('prop', PROP)]:
        ws = gname == 'skin'
        nv, nt, b64 = build_group(V, VT, faces, names, bb, with_sid=ws)
        parts.append(f'{gname}:{{nv:{nv},nt:{nt},sid:{1 if ws else 0},b64:"{b64}"}}')
        report.append(f'{gname}: {nv} verts {nt} tris')
    surf_js = ','.join(
        '{name:"%s",drive:"%s",sgn:%d,k:%g,p:[%g,%g,%g],ax:[%g,%g,%g],ramp:%s}' % (
            n, s['drive'], s['sgn'], s.get('k', 1), *s['p'], *s['ax'],
            '[%g,%g]' % s['ramp'] if 'ramp' in s else 'null')
        for n, s in SURFACES)
    bbjs = '[' + ','.join(f'{v:.4f}' for v in lo + hi) + ']'
    with open(out, 'w') as f:
        f.write('// generated by tools/model_prep.py — do not edit\n')
        f.write('// source: pa18 by BARANGER Emmanuel (helijah), GPL, for FlightGear\n')
        f.write(f'const MODEL_PA18 = {{ v:2, bb:{bbjs}, hub:[-3.371,-0.0705,0],\n')
        f.write(f'  surfaces:[{surf_js}],\n')
        f.write(f'  tex:"{tex}",\n  groups:{{{",".join(parts)}}} }};\n')
        f.write("if (typeof module !== 'undefined') module.exports = { MODEL_PA18 };\n")
    print(' | '.join(report), f'| texture {len(tb.getvalue())//1024} KB jpeg')
    import os
    print(f'{out}: {os.path.getsize(out)//1024} KB')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
