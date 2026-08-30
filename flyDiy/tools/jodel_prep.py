#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""jodel_prep.py — bake the hand-modelled Jodel DR1050 structures into a prop
pack (src/props/props_airframe.js).

WHY A SECOND BAKER RATHER THAN A ROW IN props_table.py. `prop_prep.py` reads
glTF: it wants an atlas, a uv layout and a PBR material chain, and it is
budgeted for 0.2-4 m furniture at 512 px. These are OBJ, they carry no
textures at all — four flat colours out of a Blender MTL — and they are 5 m and
9 m airframe assemblies. Forcing them through that tool would mean teaching it
a second file format to deliver less. So this writes the SAME pack format
(51_prop_codec.js decodes both, props.js builds both) from OBJ + MTL, and the
hangar places them with the same `prop()` call as everything else.

SOURCE: assets/jodel_structure/, modelled by the user in Blender. Both are
already in metres, Y-up, and correctly scaled against the real aeroplane
(8.87 m span, 5.25 m fuselage). Nothing here rescales or reshapes them; the
only transform is the one that puts each origin where the piece meets the
world, exactly as props_table.py's `place` does.

THE MATERIALS ARE ASSIGNED HERE, NOT READ. The MTL's `jojo_wood` carries
Kd 0 0 0 — pure black — which is what Blender writes when a material's colour
lives in a node graph rather than the base colour. Taking it at face value
would paint the whole airframe black, so the four names are mapped to the
finishes they describe (user: "Everything spruce, but for the tube cockpit, in
metal material").

    python tools/jodel_prep.py
"""
import base64
import collections
import io
import json
import math
import os
import struct
import sys

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'jodel_structure')
OUT = os.path.join(ROOT, 'src', 'props', 'props_airframe.js')

# ---------------------------------------------------------------- the finishes
# name in the MTL -> what it actually is. `dbl` because these are single-sided
# sheets of plywood and tube walls seen from both sides at two metres.
# FLAT SHADED, all of them (user: "Just go for flat shading for the new
# parts"). A wing rib and a steel tube are flat plate and straight cylinder;
# smoothing their normals rounds off exactly the edges that say so. props.js
# turns this into MeshStandardMaterial.flatShading, which reads the fragment
# derivatives and ignores the baked normals entirely.
#
# NORMALS WERE CHECKED BEFORE TRUSTING THE WINDING, because flat shading is
# derived FROM the winding: for each face, the geometric normal from the vertex
# order against the authored vertex normal. Body 99.97% agree (5 faces of
# 17 707 disagree), wing 99.92% (15 of 17 670). They point outwards. The
# stragglers are covered by `dbl` anyway, which flips the normal on a back
# face.
FINISH = {
    # spruce: the whole airframe unless it says otherwise
    # THESE ARE LINEAR. props.js does new THREE.Color(r, g, b) and r128 has no
    # colour management, so what is written here IS the working-space value —
    # a number that looks like the sRGB swatch you picked comes out a stop
    # light and washed out, which is how the first bake produced cream instead
    # of spruce. sRGB (0.62, 0.47, 0.30) is this.
    'jojo_wood': dict(col=(0.340, 0.190, 0.073), rough=0.78, metal=0.03, dbl=1, flat=1),
    # THE COCKPIT TUBE FRAME. Asked for repeatedly and worth being explicit
    # about: welded steel tube, and it has to READ as metal next to spruce, so
    # it is a real metalness with a low roughness rather than a grey paint.
    'metalTubes': dict(col=(0.400, 0.427, 0.451), rough=0.34, metal=0.90, dbl=1, flat=1),
    'metal_base_corrugated': dict(col=(0.451, 0.471, 0.490), rough=0.46, metal=0.80, dbl=1, flat=1),
    # the O-200's mount: stainless, brighter and smoother than the tube
    'o200_inox': dict(col=(0.706, 0.725, 0.745), rough=0.22, metal=0.95, dbl=1, flat=1),
}
DEFAULT_FINISH = 'jojo_wood'

# --------------------------------------------------------------------- the table
# key, label, file, and where the origin goes. `place` matches props_table.py:
#   'floor'   centre x/z, drop min-y to 0
#   'ceiling' centre x/z, raise max-y to 0 — it hangs BELOW its origin
PIECES = [
    dict(key='airframe_jodel_body', label='Jodel DR1050 fuselage structure',
         file='speedJojo_structurefuselageFull_optimized4.obj', place='floor',
         note='the users own DR1050 body: 158 objects, spruce formers and '
              'longerons with a welded steel tube cockpit frame'),
    dict(key='airframe_jodel_wing', label='Jodel DR1050 wing structure',
         file='speedJojo_structureAileFull_optimized.obj', place='ceiling',
         note='the cranked DR1050 wing: 32 rib stations on two spars. Hung '
              'chord-up from the roof, which is how a wing waits for its '
              'covering when the floor is wanted for something else'),
]

GROUP = ('airframe', 'airframes in build')
IDX_CAP = 65536


def read_obj(path):
    """-> V, VN, and faces grouped by (object, material). Vertices are shared
    across the file, which is how OBJ works and what the quantiser wants."""
    V, VN, groups = [], [], collections.OrderedDict()
    obj, mtl = '(none)', DEFAULT_FINISH
    for line in io.open(path, encoding='utf-8', errors='replace'):
        if line.startswith('v '):
            p = line.split(); V.append((float(p[1]), float(p[2]), float(p[3])))
        elif line.startswith('vn '):
            p = line.split(); VN.append((float(p[1]), float(p[2]), float(p[3])))
        elif line.startswith('o '):
            obj = line[2:].strip()
        elif line.startswith('usemtl'):
            mtl = line.split()[1]
        elif line.startswith('f '):
            toks = line.split()[1:]
            f = []
            for t in toks:
                b = (t.split('/') + ['', ''])[:3]
                vi = int(b[0]); vi = vi - 1 if vi > 0 else len(V) + vi
                ni = None
                if b[2]:
                    n = int(b[2]); ni = n - 1 if n > 0 else len(VN) + n
                f.append((vi, ni))
            groups.setdefault((obj, mtl), []).append(f)
    return np.asarray(V, np.float64), np.asarray(VN, np.float64) if VN else None, groups


def pack_part(V, VN, faces, bb):
    """One material's triangles -> the codec's binary part. Vertices are
    de-duplicated on (position index, normal index): that is the OBJ's own
    split, so a hard edge stays hard and a smooth one stays smooth."""
    remap, verts = {}, []
    tris, dropped = [], 0
    for f in faces:
        idx = []
        for key in f:
            j = remap.get(key)
            if j is None:
                j = len(verts); remap[key] = j; verts.append(key)
            idx.append(j)
        for k in range(1, len(idx) - 1):          # fan-triangulate quads/ngons
            t = (idx[0], idx[k], idx[k + 1])
            # DEGENERATE TRIANGLES GO. The body carries 240 zero-area faces,
            # and under FLAT shading they are not merely wasted: the normal is
            # a cross product of two parallel edges, which is a zero vector
            # that normalises to NaN and can take a whole draw call with it.
            p0, p1, p2 = V[verts[t[0]][0]], V[verts[t[1]][0]], V[verts[t[2]][0]]
            n = np.cross(p1 - p0, p2 - p0)
            if float(n.dot(n)) < 1e-20:
                dropped += 1
                continue
            tris.append(t)
    pack_part.dropped = getattr(pack_part, 'dropped', 0) + dropped
    nv, nt = len(verts), len(tris)
    if nv > IDX_CAP:
        return None, nv, nt                        # caller splits

    x0, y0, z0, x1, y1, z1 = bb
    sx = 65535.0 / max(x1 - x0, 1e-9)
    sy = 65535.0 / max(y1 - y0, 1e-9)
    sz = 65535.0 / max(z1 - z0, 1e-9)
    out = bytearray()
    out += struct.pack('<II', nv, nt)
    # CLAMPED, and it has to be: the bb written into the payload is rounded to
    # four decimals so the JSON stays readable, which can leave a vertex a
    # micron outside the range it is quantised against. Unclamped that is a
    # struct.error at bake time, and it would have been a wrapped vertex at
    # the far corner of the model if the format had been unsigned.
    def q(v, lo, sc):
        return max(-32768, min(32767, int(round((v - lo) * sc)) - 32768))
    for vi, _ in verts:
        p = V[vi]
        out += struct.pack('<hhh', q(p[0], x0, sx), q(p[1], y0, sy), q(p[2], z0, sz))
    for vi, ni in verts:
        n = VN[ni] if (VN is not None and ni is not None and ni < len(VN)) else (0.0, 1.0, 0.0)
        L = math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]) or 1.0
        out += struct.pack('<bbb', *(max(-127, min(127, int(round(c / L * 127)))) for c in n))
    # no uvs on these: flat colour, nothing samples them. The codec still wants
    # the field, so it gets a degenerate range and zeros — 4 bytes a vertex that
    # compress to nothing and keep ONE decoder for every prop in the game.
    out += b'\x00\x00\x00\x00' * nv
    for t in tris:
        out += struct.pack('<HHH', *t)
    return bytes(out), nv, nt


def bake(piece):
    path = os.path.join(SRC, piece['file'])
    V, VN, groups = read_obj(path)

    mn, mx = V.min(axis=0), V.max(axis=0)
    # the origin goes where the piece meets the world
    off = np.array([(mn[0] + mx[0]) / 2, 0.0, (mn[2] + mx[2]) / 2])
    off[1] = mn[1] if piece['place'] == 'floor' else mx[1]
    V = V - off
    mn, mx = V.min(axis=0), V.max(axis=0)
    bb = [round(float(v), 4) for v in (mn[0], mn[1], mn[2], mx[0], mx[1], mx[2])]

    # one part per MATERIAL — 158 objects would be 158 draw calls for one
    # airframe, and they all wear four finishes between them
    bymat = collections.OrderedDict()
    for (obj, mtl), faces in groups.items():
        bymat.setdefault(mtl if mtl in FINISH else DEFAULT_FINISH, []).extend(faces)

    parts, nvT, ntT = [], 0, 0
    for mtl, faces in bymat.items():
        chunk, todo = [], list(faces)
        while todo:
            blob, nv, nt = pack_part(V, VN, todo, bb)
            if blob is None:
                # over the uint16 cap: halve and try again. Splitting is not
                # decimating — every triangle survives, in two parts.
                half = len(todo) // 2
                chunk.append(todo[half:]); todo = todo[:half]
                continue
            parts.append(dict(mat=mtl, nv=nv, nt=nt, uvMin=[0.0, 0.0],
                              uvScl=[1.0, 1.0],
                              b64=base64.b64encode(blob).decode('ascii')))
            nvT += nv; ntT += nt
            todo = chunk.pop() if chunk else []
    mats = {m: dict(FINISH[m]) for m in bymat}
    for m in mats:
        mats[m]['col'] = list(mats[m]['col'])
        mats[m]['opacity'] = 1

    return dict(key=piece['key'], group=GROUP[0], label=piece['label'],
                place=piece['place'], note=piece['note'], bb=bb,
                dim=[round(float(mx[i] - mn[i]), 3) for i in range(3)],
                nv=nvT, nt=ntT,
                src=dict(dir='jodel_structure', title='Jodel DR1050 structure',
                         author='the author of this repository', lic='own work',
                         url=''),
                mats=mats, parts=parts)


def main():
    props, order = {}, []
    for p in PIECES:
        rec = bake(p)
        props[rec['key']] = rec
        order.append(rec['key'])
        print('%-22s %6d verts %6d tris  %d parts  %s  bb %s'
              % (rec['key'], rec['nv'], rec['nt'], len(rec['parts']),
                 ' + '.join(sorted(rec['mats'])), rec['dim']))

    pack = dict(v=1, groups=[list(GROUP)], order=order, texs={}, props=props)
    body = ('// GENERATED FILE - DO NOT EDIT. Built by tools/jodel_prep.py from\n'
            '// assets/jodel_structure/ (modelled by the author of this repo).\n'
            '// Group: airframes in build. Decoded by src/core/51_prop_codec.js,\n'
            '// built into three.js by src/viewer/props.js — the same path every\n'
            '// other prop takes. Flat colours, no textures: the finishes are\n'
            '// assigned in the baker because the MTL ships Kd 0 0 0.\n'
            'registerPropPack(' + json.dumps(pack, separators=(',', ':')) + ');\n')
    io.open(OUT, 'w', encoding='utf-8', newline='\n').write(body)

    # REGISTER IN THE SHARED MANIFEST. build.js reads props_packs.json, and a
    # pack that is not listed there is simply not in the game — which is how
    # this one silently fell out of the build the first time prop_prep.py ran
    # after it. That baker keeps foreign entries now; this one puts its own in.
    mf = os.path.join(ROOT, 'src', 'props', 'props_packs.json')
    try:
        packs = json.loads(io.open(mf, encoding='utf-8').read())
    except Exception:
        packs = []
    name = os.path.basename(OUT)
    if name not in packs:
        packs.append(name)
        io.open(mf, 'w', encoding='utf-8', newline='\n').write(
            json.dumps(packs, indent=1))
        print('registered %s in props_packs.json' % name)

    print('\n%s (%.2f MB)' % (os.path.relpath(OUT, ROOT).replace(os.sep, '/'),
                              len(body) / 1048576))


if __name__ == '__main__':
    main()
