#!/usr/bin/env python3
"""tree_prep.py — bake the curated tree collections into a game payload.

Usage:  python tools/tree_prep.py            (the collections _trees_tuning.json includes)
        python tools/tree_prep.py --report   (inventory only, writes nothing)
        python tools/tree_prep.py --all      (every renderable collection)

Reads  tools/_trees_index.json    the inspector's grouping: which nodes are which
                                  SUBJECT, and what kind each subject is
       tools/_trees_tuning.json   the bench's curation: what is in the mix, and
                                  the per-collection corrections
       assets/treesRaw/*.glb      the DELIVERED asset, never edited
Writes media/geo/trees/<collection>.<h8>.bin    one binary per collection
       src/core/trees_pack.json                 the manifest the codec reads
Verify node tools/_tree_check.js   (round-trip; GATE TREES when it lands)

WHY THIS EXISTS. `render_world.js` draws a 14-triangle cone. The bench proved
what a real tree costs and what its ladder looks like, but a bench cannot hand
the game geometry — nothing in tools/ is loadable at runtime. This is the step
that makes the curated set an asset.

WHAT IS AND IS NOT DONE TO THE ASSET
  Geometry is imported AS-IS ([[import-models-as-is]]): every triangle the
  author shipped is in the payload, with the author's own normals and uvs. The
  only transforms are the RIGID ones needed to put a tree where the game
  expects it — the glTF node's own world matrix (Sketchfab wrappers carry the
  Z-up -> Y-up conversion, and that is the whole reason the bench's early culls
  chopped trees sideways), then a translation that stands the tree on y = 0
  with its trunk on the origin.

  ONE THING IS ADDED: a per-vertex AO channel. It is not decoration — the
  screen-space pass it replaces was reading depth and guessing, returned a
  field of black specks at the horizon, and could not reach the impostor bake
  at all. Occlusion is a property of the tree, so it travels with it. Bark
  additionally carries a foot-to-crown gradient: a trunk stands at the bottom
  of its own canopy's shadow, and nothing else in the shading knows that.

  The per-collection DIALS are NOT baked in. `sink`, `size`, `proportion` and
  `dead` are placement decisions and ride in the manifest as data, so the world
  (or a world editor) can move them without a re-bake. The colour corrections
  are not baked either, for the same reason: they are one uniform each.

THE LADDER is not here yet. This bakes rung 0 — the tree as shipped — because
that is what unblocks `render_world.js`, whose impostor tier already bakes
itself from whatever near geometry it is handed. The record carries a `rungs`
array so L1/L2 drop in beside it without a format change.
"""
import hashlib, json, math, os, struct, sys

from media_lib import write_media, prune_media_stems

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'treesRaw')
IDX = os.path.join(ROOT, 'tools', '_trees_index.json')
TUNE = os.path.join(ROOT, 'tools', '_trees_tuning.json')
OUT = os.path.join(ROOT, 'src', 'core', 'trees_pack.json')

CT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2),
      5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


# ---- glTF binary, the parts a tree needs --------------------------------
def read_glb(path):
    with open(path, 'rb') as f:
        raw = f.read()
    assert raw[:4] == b'glTF', path + ': not a GLB'
    n = struct.unpack_from('<I', raw, 8)[0]
    o, js, bin_ = 12, None, b''
    while o < n:
        ln, kind = struct.unpack_from('<II', raw, o)
        body = raw[o + 8:o + 8 + ln]
        if kind == 0x4E4F534A:
            js = json.loads(body.decode('utf-8'))
        elif kind == 0x004E4942:
            bin_ = body
        o += 8 + ln + ((4 - ln % 4) % 4 if ln % 4 else 0)
    return js, bin_


def accessor(g, bin_, i):
    """Returns a flat list of floats/ints. Sparse accessors are not used by any
    collection in the set; assert rather than silently drop them."""
    a = g['accessors'][i]
    assert 'sparse' not in a, 'sparse accessor'
    n, comps = a['count'], NC[a['type']]
    fmt, sz = CT[a['componentType']]
    bv = g['bufferViews'][a['bufferView']]
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride') or comps * sz
    out = []
    for k in range(n):
        o = base + k * stride
        out.extend(struct.unpack_from('<' + fmt * comps, bin_, o))
    return out


def node_world(g, idx):
    """The node's world matrix, column-major as glTF stores it. A Sketchfab
    export wraps its scene in a matrix that carries the Z-up -> Y-up turn, so
    skipping this is how a tree ends up lying on its side."""
    parent = {}
    for i, nd in enumerate(g.get('nodes', [])):
        for c in nd.get('children', []):
            parent[c] = i
    chain = []
    j = idx
    while j is not None:
        chain.append(j)
        j = parent.get(j)
    m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    for j in reversed(chain):
        m = mat_mul(m, node_local(g['nodes'][j]))
    return m


def node_local(nd):
    if 'matrix' in nd:
        return list(nd['matrix'])
    t = nd.get('translation', [0, 0, 0])
    r = nd.get('rotation', [0, 0, 0, 1])
    s = nd.get('scale', [1, 1, 1])
    x, y, z, w = r
    xx, yy, zz = x * x, y * y, z * z
    xy, xz, yz, wx, wy, wz = x * y, x * z, y * z, w * x, w * y, w * z
    m = [(1 - 2 * (yy + zz)) * s[0], (2 * (xy + wz)) * s[0], (2 * (xz - wy)) * s[0], 0,
         (2 * (xy - wz)) * s[1], (1 - 2 * (xx + zz)) * s[1], (2 * (yz + wx)) * s[1], 0,
         (2 * (xz + wy)) * s[2], (2 * (yz - wx)) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
         t[0], t[1], t[2], 1]
    return m


def mat_mul(a, b):
    o = [0.0] * 16
    for c in range(4):
        for r in range(4):
            o[c * 4 + r] = sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4))
    return o


def xf_point(m, p):
    x, y, z = p
    return (m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14])


def xf_dir(m, p):
    x, y, z = p
    return (m[0] * x + m[4] * y + m[8] * z,
            m[1] * x + m[5] * y + m[9] * z,
            m[2] * x + m[6] * y + m[10] * z)


# ---- the AO channel ------------------------------------------------------
def bake_ao(parts, bb, trunk_dark=0.55):
    """Occupancy-grid ambient occlusion, the same method the bench uses.

    Every triangle centroid is dropped into a coarse voxel field; each vertex
    then marches a few directions through that field and accumulates what it
    runs into, nearer counting for more. It is not a ray trace and does not
    pretend to be. What it captures is the thing that reads: the inside of a
    canopy is dark and the outside of it is not.
    """
    N = 26
    x0, y0, z0, x1, y1, z1 = bb
    sx, sy, sz = x1 - x0, y1 - y0, z1 - z0
    diag = max(0.5, math.sqrt(sx * sx + sy * sy + sz * sz))
    pad = diag * 0.02
    gx0, gy0, gz0 = x0 - pad, y0 - pad, z0 - pad
    cw = max(1e-4, (sx + 2 * pad) / N)
    ch = max(1e-4, (sy + 2 * pad) / N)
    cd = max(1e-4, (sz + 2 * pad) / N)
    occ = [0.0] * (N * N * N)

    def cell(px, py, pz):
        i = int((px - gx0) / cw); j = int((py - gy0) / ch); k = int((pz - gz0) / cd)
        if i < 0 or j < 0 or k < 0 or i >= N or j >= N or k >= N:
            return None
        return (k * N + j) * N + i

    for P in parts:
        pos, idx = P['pos'], P['idx']
        for t in range(0, len(idx), 3):
            cx = cy = cz = 0.0
            for e in range(3):
                v = idx[t + e] * 3
                cx += pos[v]; cy += pos[v + 1]; cz += pos[v + 2]
            c = cell(cx / 3, cy / 3, cz / 3)
            if c is not None:
                occ[c] += 1
    peak = max(occ) if occ else 0
    nrm = 1.0 / max(1.0, peak * 0.25)
    occ = [min(1.0, v * nrm) for v in occ]

    DIRS = [(0, 1, 0), (0.7, 0.7, 0), (-0.7, 0.7, 0),
            (0, 0.7, 0.7), (0, 0.7, -0.7), (0, -1, 0)]
    W = [1.6, 1, 1, 1, 1, 0.5]
    wtot = sum(W)
    STEPS, reach = 8, diag * 0.33
    for P in parts:
        pos = P['pos']
        nv = len(pos) // 3
        ao = bytearray(nv)
        bark = P['opaque']
        for i in range(nv):
            px, py, pz = pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]
            s = 0.0
            for d in range(len(DIRS)):
                dx, dy, dz = DIRS[d]
                hit = 0.0
                for st in range(1, STEPS + 1):
                    f = st / STEPS
                    r = f * reach
                    c = cell(px + dx * r, py + dy * r, pz + dz * r)
                    if c is None:
                        break
                    hit += occ[c] * (1 - f)
                s += W[d] * min(1.0, hit / (STEPS * 0.35))
            v = max(0.18, 1 - 0.95 * (s / wtot))
            if bark:
                f = (py - y0) / max(1e-3, sy)
                v *= 1 - trunk_dark * pow(max(0.0, 1 - f), 1.6)
            ao[i] = int(round(max(0.0, min(1.0, v)) * 255))
        P['ao'] = ao


# ---- one subject ---------------------------------------------------------
def mesh_nodes(g, root):
    """A LOD entry is often a GROUP, not a mesh: LOLIPOP's `Christmas tree_LOD0`
    has no mesh of its own and two children that do. Walk down."""
    out, stack = [], [root]
    while stack:
        i = stack.pop()
        nd = g['nodes'][i]
        if 'mesh' in nd:
            out.append(i)
        stack.extend(nd.get('children', []))
    return out


def build_subject(g, bin_, els):
    """Every primitive of every node the inspector assigned to this subject,
    transformed into the subject's own frame: trunk on the origin, base at
    y = 0. Positions stay in metres; the quantiser takes the range later."""
    parts = []
    for el in els:
      for ni in mesh_nodes(g, el['node']):
        nd = g['nodes'][ni]
        m = node_world(g, ni)
        for prim in g['meshes'][nd['mesh']].get('primitives', []):
            at = prim.get('attributes', {})
            if 'POSITION' not in at or 'indices' not in prim:
                continue
            p = accessor(g, bin_, at['POSITION'])
            nrm = accessor(g, bin_, at['NORMAL']) if 'NORMAL' in at else None
            uv = accessor(g, bin_, at['TEXCOORD_0']) if 'TEXCOORD_0' in at else None
            idx = [int(v) for v in accessor(g, bin_, prim['indices'])]
            nv = len(p) // 3
            wp = [0.0] * (nv * 3)
            for i in range(nv):
                x, y, z = xf_point(m, (p[i * 3], p[i * 3 + 1], p[i * 3 + 2]))
                wp[i * 3], wp[i * 3 + 1], wp[i * 3 + 2] = x, y, z
            wn = [0.0] * (nv * 3)
            if nrm:
                for i in range(nv):
                    x, y, z = xf_dir(m, (nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]))
                    L = math.sqrt(x * x + y * y + z * z) or 1.0
                    wn[i * 3], wn[i * 3 + 1], wn[i * 3 + 2] = x / L, y / L, z / L
            mi = prim.get('material')
            mat = g.get('materials', [])[mi] if mi is not None else {}
            mode = mat.get('alphaMode', 'OPAQUE')
            parts.append({
                'pos': wp, 'nrm': wn,
                'uv': uv if uv else [0.0] * (nv * 2),
                'idx': idx, 'nv': nv,
                'mat': mat.get('name', 'mat%s' % mi),
                'mode': mode,
                'cutoff': mat.get('alphaCutoff', 0.5) if mode == 'MASK' else 0.0,
                'opaque': mode == 'OPAQUE',
            })
    if not parts:
        return None
    xs = [p['pos'][i] for p in parts for i in range(0, len(p['pos']), 3)]
    ys = [p['pos'][i] for p in parts for i in range(1, len(p['pos']), 3)]
    zs = [p['pos'][i] for p in parts for i in range(2, len(p['pos']), 3)]
    cx, cz, y0 = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2, min(ys)
    for p in parts:
        q = p['pos']
        for i in range(0, len(q), 3):
            q[i] -= cx; q[i + 1] -= y0; q[i + 2] -= cz
    bb = [min(xs) - cx, 0.0, min(zs) - cz,
          max(xs) - cx, max(ys) - y0, max(zs) - cz]
    return parts, bb


def recentre(parts, bb_from, bb_to):
    """A coarser rung is authored about its own centre; the payload quantises
    every rung of a subject over the FINEST rung's box, so they load into one
    frame and the codec needs one bb per subject."""
    dx = (bb_to[0] + bb_to[3]) / 2 - (bb_from[0] + bb_from[3]) / 2
    dz = (bb_to[2] + bb_to[5]) / 2 - (bb_from[2] + bb_from[5]) / 2
    for P in parts:
        q = P['pos']
        for i in range(0, len(q), 3):
            q[i] += dx; q[i + 2] += dz


# ---- quantise ------------------------------------------------------------
def pack_part(P, bb):
    nv, idx = P['nv'], P['idx']
    nt = len(idx) // 3
    x0, y0, z0, x1, y1, z1 = bb
    sx = (x1 - x0) / 65535 or 1.0
    sy = (y1 - y0) / 65535 or 1.0
    sz = (z1 - z0) / 65535 or 1.0
    us = [P['uv'][i] for i in range(0, len(P['uv']), 2)]
    vs = [P['uv'][i] for i in range(1, len(P['uv']), 2)]
    u0, v0 = (min(us), min(vs)) if us else (0.0, 0.0)
    uS = (max(us) - u0) if us else 1.0
    vS = (max(vs) - v0) if vs else 1.0
    uS = uS or 1.0
    vS = vS or 1.0
    wide = nv > 65536
    b = bytearray()
    b += struct.pack('<III', nv, nt, 1 if wide else 0)
    q16 = lambda v: max(-32768, min(32767, int(round(v)) - 32768))
    for i in range(nv):
        b += struct.pack('<hhh',
                         q16((P['pos'][i * 3] - x0) / sx),
                         q16((P['pos'][i * 3 + 1] - y0) / sy),
                         q16((P['pos'][i * 3 + 2] - z0) / sz))
    for i in range(nv * 3):
        b += struct.pack('<b', max(-127, min(127, int(round(P['nrm'][i] * 127)))))
    for i in range(nv):
        b += struct.pack('<HH',
                         max(0, min(65535, int(round((P['uv'][i * 2] - u0) / uS * 65535)))),
                         max(0, min(65535, int(round((P['uv'][i * 2 + 1] - v0) / vS * 65535)))))
    b += bytes(P['ao'])
    if wide:
        for v in idx:
            b += struct.pack('<I', v)
    else:
        for v in idx:
            b += struct.pack('<H', v)
    return bytes(b), {'mat': P['mat'], 'mode': P['mode'], 'cutoff': round(P['cutoff'], 4),
                      'uvMin': [round(u0, 6), round(v0, 6)],
                      'uvScl': [round(uS, 6), round(vS, 6)]}


def main():
    report = '--report' in sys.argv
    every = '--all' in sys.argv
    index = json.load(open(IDX, encoding='utf-8'))
    tune = json.load(open(TUNE, encoding='utf-8'))
    inc = set(tune.get('included', []))
    tuning = tune.get('tuning', {})

    picked = [a for a in index['assets']
              if a.get('renderable') and a.get('trees')
              and (every or a['name'] in inc)]
    if not picked:
        print('nothing to bake — _trees_tuning.json includes nothing renderable')
        return 1

    pack = {'note': 'baked by tools/tree_prep.py — see docs/TREE-IMPORT.md',
            'collections': []}
    stems, total = [], 0
    for a in picked:
        path = os.path.join(RAW, a['name'])
        if not os.path.exists(path):
            print('  MISSING %s' % a['name']); continue
        g, bin_ = read_glb(path)
        t = tuning.get(a['name'], {})
        stem = a['name'].replace('.glb', '').replace('.', '_')
        blob, subjects = bytearray(), []
        for S in a['trees']:
            if S.get('merged'):
                continue
            # A PACK THAT SHIPS ITS OWN LOD CHAIN KEEPS IT. The import rule is
            # to use the author's rungs, not to build a second ladder beside
            # them — LOLIPOP ships 12969 / 6633 / 3268 / 20 and every one of
            # those is better than anything generated from the first.
            by_lod = {}
            for el in S.get('els', []):
                by_lod.setdefault(el.get('lod') if el.get('lod') is not None else 0,
                                  []).append(el)
            lods = sorted(by_lod)
            finest = build_subject(g, bin_, by_lod[lods[0]])
            if not finest:
                continue
            # Every rung of a subject quantises over ONE box, so they load into
            # one frame and the codec needs a single bb — and that box is the
            # UNION, because a coarser rung is not a subset: LOLIPOP's LOD1
            # stands a few centimetres wider than its LOD0 and overflowed the
            # int16 when the finest rung's box was used alone.
            made = []
            for L in lods:
                built = finest if L == lods[0] else build_subject(g, bin_, by_lod[L])
                if not built:
                    continue
                if L != lods[0]:
                    recentre(built[0], built[1], finest[1])
                made.append((L, built[0], built[1]))
            bb = list(finest[1])
            for _, parts, b in made:
                for k in range(3):
                    bb[k] = min(bb[k], b[k])
                    bb[k + 3] = max(bb[k + 3], b[k + 3])
            rungs, shown = [], []
            for L, parts, _b in made:
                bake_ao(parts, bb)
                recs = []
                for P in parts:
                    raw, meta = pack_part(P, bb)
                    meta['off'] = len(blob); meta['len'] = len(raw)
                    blob += raw
                    recs.append(meta)
                rungs.append({'lod': L, 'tris': sum(len(P['idx']) // 3 for P in parts),
                              'parts': recs})
                shown.append('%d:%d' % (L, rungs[-1]['tris']))
            subjects.append({'name': S['name'], 'h': S.get('h'),
                             'tris': S.get('tris'), 'bb': [round(v, 4) for v in bb],
                             'shipped': len(rungs) > 1, 'rungs': rungs})
            print('    %-22s %6d tris  rungs %s' % (S['name'], S.get('tris', 0),
                                                    ' '.join(shown)))
        if not subjects:
            continue
        rel = 'media/geo/trees/%s.bin' % stem if report else \
            write_media('geo/trees', stem, 'bin', bytes(blob))
        stems.append(stem); total += len(blob)
        pack['collections'].append({
            'name': a['name'], 'bin': rel, 'bytes': len(blob),
            'credit': a.get('credit'),
            # the licence travels with the payload: a baked asset whose
            # provenance was lost is one nobody can ship
            'licence': (a.get('licence') or {}).get('text'),
            'licenceOk': (a.get('licence') or {}).get('ok'),
            # placement dials stay DATA: the world moves them without a re-bake
            'place': {k: t.get(k) for k in ('size', 'proportion', 'sink', 'dead')
                      if k in t},
            'tint': {k: t.get(k) for k in ('hue', 'sat', 'light', 'bark', 'alpha')
                     if k in t},
            'subjects': subjects,
        })
        print('  %-46s %8.2f MB  %d subjects' % (a['name'], len(blob) / 1e6, len(subjects)))

    if report:
        print('\n--report: %d collections, %.2f MB of geometry, nothing written'
              % (len(pack['collections']), total / 1e6))
        return 0
    prune_media_stems('geo/trees', stems, [c['bin'] for c in pack['collections']])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(pack, f, indent=1)
        f.write('\n')
    print('\nwrote %s  (%d collections, %.2f MB)' % (
        os.path.relpath(OUT, ROOT), len(pack['collections']), total / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
