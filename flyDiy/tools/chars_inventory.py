#!/usr/bin/env python3
"""chars_inventory.py - the CROWD's shopping list (CHARACTERS G2970): every
converted character and clip GLB under assets/chars/glb/, one line each.

  character  tris, verts, meshes, materials, joints, the embedded maps (count,
             largest side, bytes) and the height of the bind pose's bbox (m)
  clip       duration, frames at the source rate, rotation channels, and the
             Hips' travel: forward speed (m/s) - a walk 'in place' reads 0

Reads only (no media written). The GLBs come from tools/fbx_to_glb.py:
  blender -b --python tools/fbx_to_glb.py -- assets/chars/people/<f>.fbx assets/chars/glb/<key>.glb
  blender -b --python tools/fbx_to_glb.py -- "assets/chars/anims/<f>.fbx" assets/chars/glb/anim_<key>.glb --anim

Usage (from flyDiy/):  python tools/chars_inventory.py [--json out.json]
"""
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from glb_inspect import load, accessor, view_bytes, walk, xform  # noqa: E402
from media_lib import asset_src  # noqa: E402


def img_dims(raw):
    if raw[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', raw[16:24])
    if raw[:2] == b'\xff\xd8':
        o = 2
        while o < len(raw) - 9:
            if raw[o] != 0xFF:
                o += 1
                continue
            mk = raw[o + 1]
            if mk in (0xC0, 0xC1, 0xC2):
                h, w = struct.unpack('>HH', raw[o + 5:o + 9])
                return w, h
            o += 2 + struct.unpack('>H', raw[o + 2:o + 4])[0]
    return 0, 0


def character(path):
    j, bin_ = load(path)
    tris = verts = meshes = 0
    lo, hi = [1e9] * 3, [-1e9] * 3
    allp = []
    for _, n, w, _ in walk(j):
        if 'mesh' not in n:
            continue
        for prim in j['meshes'][n['mesh']]['primitives']:
            meshes += 1
            pos = accessor(j, bin_, prim['attributes']['POSITION'])
            idx = accessor(j, bin_, prim['indices']) if 'indices' in prim else range(len(pos))
            verts += len(pos)
            tris += len(idx) // 3
            # skinned: the vertices are in scene space (glTF), the node's matrix is ignored
            allp += pos[::7]
            for p in pos[::7]:
                for k in range(3):
                    lo[k] = min(lo[k], p[k])
                    hi[k] = max(hi[k], p[k])
    maps, side, nbytes = 0, 0, 0
    for im in j.get('images', []):
        if 'bufferView' not in im:
            continue
        raw, _ = view_bytes(j, bin_, im['bufferView'])
        w, h = img_dims(raw)
        maps += 1
        side = max(side, w, h)
        nbytes += len(raw)
    joints = len(j['skins'][0]['joints']) if j.get('skins') else 0
    # BODY BREADTH (G2970, the cast's body types): the depth (z, front to back) of
    # the bind pose's torso at the chest (68-74 % of the height) and at the waist
    # (55-60 %), over the height - the T-pose's arms are out along x, so x is no
    # measure; z is the body's own front-to-back thickness
    H = hi[1] - lo[1] or 1.0
    def depth(a, b):
        zs = [p[2] for p in allp if lo[1] + a * H <= p[1] <= lo[1] + b * H and abs(p[0]) < 0.25 * H]
        return (max(zs) - min(zs)) if zs else 0.0
    chest, waist = depth(0.68, 0.74), depth(0.55, 0.60)
    return dict(tris=tris, verts=verts, meshes=meshes, mats=len(j.get('materials', [])),
                joints=joints, maps=maps, side=side, mapMB=round(nbytes / 1e6, 1),
                height=round(hi[1] - lo[1], 3), chest=round(chest / H, 3), waist=round(waist / H, 3))


def clip(path):
    j, bin_ = load(path)
    anims = j.get('animations', [])
    if not anims:
        return None
    a = anims[0]
    nodes = j['nodes']
    t_end, n_rot, keys, hips = 0.0, 0, 0, None
    W = {ni: w for ni, _, w, _ in walk(j)}
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i
    for ch in a['channels']:
        smp = a['samplers'][ch['sampler']]
        ts = accessor(j, bin_, smp['input'])
        t_end = max(t_end, ts[-1])
        keys = max(keys, len(ts))
        tg = ch['target']
        if tg.get('path') == 'rotation':
            n_rot += 1
        elif tg.get('path') == 'translation' and nodes[tg['node']].get('name', '').split(':')[-1] == 'Hips':
            ps = accessor(j, bin_, smp['output'])
            pw = W.get(parent.get(tg['node'], -1), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
            a0, a1 = xform(pw, ps[0]), xform(pw, ps[-1])
            d = ((a1[0] - a0[0]) ** 2 + (a1[2] - a0[2]) ** 2) ** 0.5
            hips = d / max(1e-6, ts[-1] - ts[0])
    return dict(dur=round(t_end, 2), keys=keys, rot=n_rot, rootV=None if hips is None else round(hips, 3))


def main(argv):
    d = asset_src('assets/chars/glb')
    rows = {'chars': {}, 'clips': {}}
    for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        if not f.endswith('.glb'):
            continue
        p = os.path.join(d, f)
        try:
            if f.startswith('anim_'):
                r = clip(p)
                if r:
                    rows['clips'][f[5:-4]] = r
                    print('clip %-28s %5.2f s  %4d keys  %2d rot  root %s m/s'
                          % (f[5:-4], r['dur'], r['keys'], r['rot'],
                             '-' if r['rootV'] is None else '%.2f' % r['rootV']))
            else:
                r = character(p)
                rows['chars'][f[:-4]] = r
                print('char %-12s %6d tris %6d verts %2d meshes %2d mats %2d joints  %2d maps max %4d px %5.1f MB  h %.2f m  chest/h %.3f  waist/h %.3f'
                      % (f[:-4], r['tris'], r['verts'], r['meshes'], r['mats'], r['joints'],
                         r['maps'], r['side'], r['mapMB'], r['height'], r['chest'], r['waist']))
        except Exception as e:  # noqa
            print('FAIL %s: %s' % (f, e))
    if '--json' in argv:
        with open(argv[argv.index('--json') + 1], 'w', encoding='utf8', newline='\n') as fh:
            json.dump(rows, fh, indent=1)


if __name__ == '__main__':
    main(sys.argv[1:])
