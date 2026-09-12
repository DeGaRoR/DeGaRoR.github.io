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

THE LADDER, in three series, GENERATED here for every pack by the same rules
the bench uses and for the same reason it uses them — the woody decomposition
measured that
branch structure is more than half of a tree and reads as almost nothing past
the first rung, so every rung below L0 stands its canopy on one tapered stick.

  rungs   the SPECIMEN ladder: the tree at a clearing's edge, furnished to the
          ground.  L0 as shipped · L1 stick + foliage · L2 stick + half foliage
  stand   the tree INSIDE a wood: only the top third is furnished, and that
          crown is stretched and widened, which is the shape a conifer takes in
          a closed stand.  L0 · L1 stick + crown · L2 stick + half crown
  snag    the standing dead tree: bark only, no ladder. Thinning branches off a
          bare trunk gives a worse bare trunk, not a cheaper one.

WHY IT MATTERS MORE THAN IT LOOKS. The world's dense fill plants a tree every
9 m; at LOD0 that is millions of triangles inside the near band and the layer
simply cannot use a real tree. `stand` L2 measures ~350 triangles against the
same subject's 7 784, which is the difference between a payload the fill can
draw and one it cannot.
"""
import hashlib, io as _io, json, math, os, struct, sys

from media_lib import write_media, prune_media_stems, BASE_DECL

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'assets', 'treesRaw')
IDX = os.path.join(ROOT, 'tools', '_trees_index.json')
TUNE = os.path.join(ROOT, 'tools', '_trees_tuning.json')
OUT = os.path.join(ROOT, 'src', 'core', 'trees_pack.json')
# TWO ARTIFACTS, ONE BAKE. The gates read the JSON with fs; the page cannot -
# index.html is built as one file and has no src/ to fetch from - so the same
# dict is also emitted as a script that publishes TREE_PACK, with the media
# paths prefixed by FLYDIY_ASSET_BASE at its own eval like every other payload
# here. Written in the same call from the same object, so they cannot drift.
OUTJS = os.path.join(ROOT, 'src', 'viewer', 'trees_pack.js')

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


# ---- the generated rungs -------------------------------------------------
# Ported from the bench (tools/_trees.html), which is where every one of these
# rules was argued and looked at. The one thing that does NOT have to be ported
# is the bench's hard-won world-space centroid: build_subject has already put
# every vertex in the subject's own frame, base on y = 0, so a raw y IS a
# height above the ground here.

def part_clone(P):
    return {'mi': P['mi'], 'pos': list(P['pos']), 'nrm': list(P['nrm']),
            'uv': list(P['uv']), 'idx': list(P['idx']), 'nv': P['nv'],
            'mat': P['mat'], 'mode': P['mode'], 'cutoff': P['cutoff'],
            'opaque': P['opaque']}


def parts_clone(parts):
    return [part_clone(P) for P in parts]


def components(P):
    """Connected components of a part, as triangle lists with their centroid.

    THE CUT IS MADE ON ISLANDS, NOT ON TRIANGLES. An island of a leaf mesh is a
    branch cluster, so dropping islands drops whole branches and leaves the
    survivors at full resolution. Decimating triangles instead melts every leaf
    card into mush, which is the wrong trade for alpha-tested foliage.
    """
    idx, pos = P['idx'], P['pos']
    parent = list(range(P['nv']))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for t in range(0, len(idx), 3):
        a, b, c = idx[t], idx[t + 1], idx[t + 2]
        ra, rb, rc = find(a), find(b), find(c)
        if ra != rb:
            parent[rb] = ra
        rc = find(c)
        ra = find(a)
        if ra != rc:
            parent[rc] = ra
    out = {}
    for t in range(0, len(idx), 3):
        r = find(idx[t])
        G = out.get(r)
        if G is None:
            G = out[r] = {'tris': [], 'y': 0.0, 'n': 0}
        G['tris'].append(t)
        for e in range(3):
            G['y'] += pos[idx[t + e] * 3 + 1]
            G['n'] += 1
    for G in out.values():
        G['y'] /= G['n']
    return list(out.values())


def compact(P, keep_tris):
    """Rebuild a part from a triangle subset, dropping the vertices nobody uses.

    The bench leaves them - it is throwing the geometry away every frame anyway.
    A payload cannot: pack_part writes every vertex it is given, so an uncompacted
    L2 would carry the whole tree's vertex table behind a hundred triangles.
    """
    remap = {}
    pos, nrm, uv = [], [], []
    idx = []
    for t in keep_tris:
        for e in range(3):
            v = P['idx'][t + e]
            j = remap.get(v)
            if j is None:
                j = remap[v] = len(pos) // 3
                pos.extend(P['pos'][v * 3:v * 3 + 3])
                nrm.extend(P['nrm'][v * 3:v * 3 + 3] if P['nrm'] else (0.0, 1.0, 0.0))
                uv.extend(P['uv'][v * 2:v * 2 + 2] if P['uv'] else (0.0, 0.0))
            idx.append(j)
    P['pos'], P['nrm'], P['uv'], P['idx'] = pos, nrm, uv, idx
    P['nv'] = len(pos) // 3
    return P


def cull_foliage(parts, keep):
    """keep(componentCentroidY) -> bool, on the CUTOUT parts only."""
    out = []
    for P in parts:
        if P['opaque']:
            out.append(P)
            continue
        tris = []
        for i, G in enumerate(components(P)):
            if keep(G['y'], i):
                tris.extend(G['tris'])
        if not tris:
            continue
        out.append(compact(P, tris))
    return out


def strip_bark(parts):
    """Remove the woody mesh entirely - what a stick stands in for."""
    return [P for P in parts if not P['opaque']]


def strip_foliage(parts):
    """The snag: the bark, and nothing else."""
    return [P for P in parts if P['opaque']]


def bbox_of(parts, opaque_only=False):
    lo = [1e30, 1e30, 1e30]
    hi = [-1e30, -1e30, -1e30]
    for P in parts:
        if opaque_only and not P['opaque']:
            continue
        q = P['pos']
        for i in range(0, len(q), 3):
            for k in range(3):
                v = q[i + k]
                if v < lo[k]:
                    lo[k] = v
                if v > hi[k]:
                    hi[k] = v
    return (lo, hi) if lo[0] < 1e29 else (None, None)


def grow_crown(parts, k):
    """The stand tree's crown is WIDER as well as taller: a conifer in a closed
    wood loses its lower branches and spreads what is left."""
    if abs(k - 1.0) < 1e-3:
        return parts
    lo, hi = bbox_of(parts)
    if lo is None:
        return parts
    ax, az = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2
    for P in parts:
        if P['opaque']:
            continue
        q = P['pos']
        for i in range(0, len(q), 3):
            q[i] = ax + (q[i] - ax) * k
            q[i + 2] = az + (q[i + 2] - az) * k
    return parts


def stick_for(parts, frac, src_parts):
    """The stand-in stem: a tapered cylinder wearing the pack's own bark
    material, sized from the WOOD IT REPLACES - so it is measured on the source
    parts, before strip_bark has taken them away."""
    lo, hi = bbox_of(src_parts, opaque_only=True)
    if lo is None:
        return None
    bark = next((P for P in src_parts if P['opaque']), None)
    if bark is None:
        return None
    hh = max(0.5, hi[1] - lo[1])
    rr = max(0.02, min(hi[0] - lo[0], hi[2] - lo[2]) * (frac or 0.045))
    cx, cz = (lo[0] + hi[0]) / 2, (lo[2] + hi[2]) / 2
    y0, r0, r1 = lo[1], rr, rr * 0.35        # fat at the foot, thin at the top
    SEG = 7
    pos, nrm, uv, idx = [], [], [], []
    for row in (0, 1):
        yy = y0 + hh * row
        rad = r0 if row == 0 else r1
        for i in range(SEG + 1):             # the seam column is duplicated,
            a = 2 * math.pi * i / SEG        # because its uv is not
            sx, sz = math.sin(a), math.cos(a)
            pos.extend((cx + sx * rad, yy, cz + sz * rad))
            nrm.extend((sx, 0.0, sz))
            uv.extend((i / SEG, row))
    for i in range(SEG):
        a, b = i, i + 1
        c, d = i + SEG + 1, i + SEG + 2
        idx.extend((a, c, d, a, d, b))
    return {'mi': bark['mi'], 'pos': pos, 'nrm': nrm, 'uv': uv, 'idx': idx,
            'nv': len(pos) // 3, 'mat': bark['mat'], 'mode': bark['mode'],
            'cutoff': bark['cutoff'], 'opaque': True}


def hash01(i, salt):
    """A deterministic 0..1 - the thinning must be the same on every machine and
    in every re-bake, or two builds of the same asset differ."""
    h = (i * 374761393 + salt * 668265263 + 1013904223) & 0xffffffff
    h = (h ^ (h >> 13)) * 1274126177 & 0xffffffff
    return ((h ^ (h >> 16)) & 0xffffffff) / 4294967296.0


def gen_rung(src, kind, stick, crown_w, crown_stretch):
    """One generated rung, by the bench's own rules.

    `crownOnly` furnishes the top third and nothing below it; `half` thins what
    is left. THE TOP OF THE CROWN IS NEVER THINNED - it is the silhouette, and
    the silhouette is what a distant viewer actually reads.
    """
    lo, hi = bbox_of(src)
    if lo is None:
        return None
    y0, h = lo[1], max(0.01, hi[1] - lo[1])
    crown_only = kind in ('crownStick', 'crownHalf')
    half = kind in ('halfFoliage', 'crownHalf')
    salt = 0x9e37 + len(kind) * 131

    def keep(y, i):
        f = (y - y0) / h
        if crown_only and f <= 0.62:
            return False
        if half and f < 0.78 and hash01(i, salt) > 0.5:
            return False
        return True

    # THE VERTICAL STRETCH IS NOT BAKED. The bench applies it as a scale on the
    # holder, and that is what it should stay: a placement dial the world can
    # move without a re-bake, like `size` and `sink`. Baking it would also make
    # the stand series 1.3x TALLER than the tree it came from, and every series
    # of a subject quantises over ONE box - so the specimen L0 would fill 77% of
    # a box stretched to fit a rung it has nothing to do with, which is exactly
    # what GATE TREES' fill check exists to catch. It rides in `place.crownH`.
    if kind == 'fFull':
        parts = cull_foliage(parts_clone(src), lambda y, i: (y - y0) / h > 0.62)
        return grow_crown(parts, crown_w)

    st = stick_for(None, stick, src)          # measured BEFORE the wood goes
    parts = cull_foliage(parts_clone(src), keep)
    parts = strip_bark(parts)
    if crown_only:
        parts = grow_crown(parts, crown_w)
    if st:
        parts.append(st)
    return parts if parts else None


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
                'mi': mi,
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


# ---- the maps ------------------------------------------------------------
# WHAT IS SHIPPED, AND WHAT IS NOT
#   base colour  ALWAYS, at the resolution the author shipped. A leaf map's
#                ALPHA IS THE TREE: it is the cutout, and every collection sits
#                on its own alpha scale (cedar's leaves at 0.63, larch's at
#                0.08). It is never resized, because resizing a cutout thins
#                its coverage - the same failure that made the bench's canopy
#                dissolve - and the rescale that corrects for it needs the
#                cutoff, which belongs to the material and not to the image.
#   normal       at half resolution. Foliage barely reads it at any distance a
#                tree is drawn from; bark does, up close, and half is enough.
#   metal/rough  DROPPED. Two of the four collections ship none, and the two
#                that do ship a palette or a bilevel image - there is no
#                per-texel metalness on a conifer to lose.
#
# Alpha maps are PNG because JPEG cannot carry alpha at all. Everything else is
# JPEG: bark at q90 is a fraction of the PNG and nothing reads the difference.
def safe(n):
    return ''.join(c if (c.isalnum() or c == '_') else '_' for c in n).strip('_').lower()


def load_image(g, bin_, src):
    im = g['images'][src]
    bv = g['bufferViews'][im['bufferView']]
    off = bv.get('byteOffset', 0)
    return Image.open(_io.BytesIO(bin_[off:off + bv['byteLength']]))


def bake_textures(g, bin_, used, stem):
    """One record per material the baked geometry actually uses."""
    out, wrote = {}, []
    for mi in sorted(used):
        m = g['materials'][mi]
        pbr = m.get('pbrMetallicRoughness', {})
        name = m.get('name', 'mat%d' % mi)
        mode = m.get('alphaMode', 'OPAQUE')
        rec = {'mode': mode}
        if mode != 'OPAQUE':
            rec['cutoff'] = round(m.get('alphaCutoff', 0.5), 4)
            # the renderer must build COVERAGE-PRESERVING mips for this map, or
            # the canopy thins with every level and the stand dissolves at
            # distance. Flagged here because only the material knows the cutoff
            # the coverage has to be preserved AGAINST.
            rec['coverageMips'] = True
        bc = pbr.get('baseColorTexture', {}).get('index')
        if bc is not None:
            img = load_image(g, bin_, g['textures'][bc]['source'])
            if img.mode in ('P', '1', 'L', 'LA'):
                img = img.convert('RGBA' if mode != 'OPAQUE' else 'RGB')
            if mode != 'OPAQUE' and img.mode == 'RGBA':
                buf = _io.BytesIO()
                img.save(buf, 'PNG', optimize=True)
                rec['base'] = write_media('tex/trees', stem + '_' + safe(name) + '_base',
                                          'png', buf.getvalue())
            else:
                buf = _io.BytesIO()
                img.convert('RGB').save(buf, 'JPEG', quality=90)
                rec['base'] = write_media('tex/trees', stem + '_' + safe(name) + '_base',
                                          'jpg', buf.getvalue())
            rec['baseSize'] = list(img.size)
            wrote.append(rec['base'])
        nr = m.get('normalTexture', {}).get('index')
        if nr is not None:
            img = load_image(g, bin_, g['textures'][nr]['source']).convert('RGB')
            img = img.resize((max(1, img.width // 2), max(1, img.height // 2)),
                             Image.LANCZOS)
            buf = _io.BytesIO()
            img.save(buf, 'JPEG', quality=90)
            rec['nor'] = write_media('tex/trees', stem + '_' + safe(name) + '_nor',
                                     'jpg', buf.getvalue())
            wrote.append(rec['nor'])
        out[name] = rec
    return out, wrote


def main():
    report = '--report' in sys.argv
    every = '--all' in sys.argv
    index = json.load(open(IDX, encoding='utf-8'))
    tune = json.load(open(TUNE, encoding='utf-8'))
    inc = set(tune.get('included', []))
    tuning = tune.get('tuning', {})
    # the crown dials are the BENCH's, committed in its view block - the stand
    # series has to be generated at the numbers the mix was judged at
    view = tune.get('view', {}) or {}
    view_crown_w = view.get('crownW', 1.0)
    view_crown_h = view.get('crownH', 1.3)

    picked = [a for a in index['assets']
              if a.get('renderable') and a.get('trees')
              and (every or a['name'] in inc)]
    if not picked:
        print('nothing to bake — _trees_tuning.json includes nothing renderable')
        return 1

    pack = {'note': 'baked by tools/tree_prep.py — see docs/TREE-IMPORT.md',
            'collections': []}
    stems, total, texAll = [], 0, []
    for a in picked:
        path = os.path.join(RAW, a['name'])
        if not os.path.exists(path):
            print('  MISSING %s' % a['name']); continue
        g, bin_ = read_glb(path)
        t = tuning.get(a['name'], {})
        stem = a['name'].replace('.glb', '').replace('.', '_')
        blob, subjects, used = bytearray(), [], set()
        for S in a['trees']:
            if S.get('merged'):
                continue
            # THE FINEST SHIPPED RUNG IS L0, AND ONLY THAT. A pack's own chain
            # is not used: the bench's forest (the thing that was judged)
            # builds its own ladder for every pack, and LOLIPOP's shipped
            # chain ends in a 20-triangle crossed billboard that the game
            # then drew by the ten thousand as its fill. The import rule -
            # never decimate, never re-encode - still holds for L0.
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
            made = [(lods[0], finest[0], finest[1])]
            # ---- the generated rungs, and the two other series -----------
            # The specimen ladder, the STAND and the SNAG are all generated
            # from L0: no pack ships the tree-inside-a-wood or the standing
            # dead one, and both are shapes the world plants by the thousand.
            stick = t.get('stick', 0.045)
            cw, cs = view_crown_w, view_crown_h
            gen = []
            for lodN, kind in ((1, 'foliage'), (2, 'halfFoliage')):
                q = gen_rung(finest[0], kind, stick, cw, cs)
                if q:
                    gen.append((lodN, q, None))
            made_all = made + gen
            stand, snag = [], []
            fstand = gen_rung(finest[0], 'fFull', stick, cw, cs)
            if fstand:
                stand.append((0, fstand, None))
                for lodN, kind in ((1, 'crownStick'), (2, 'crownHalf')):
                    q = gen_rung(finest[0], kind, stick, cw, cs)
                    if q:
                        stand.append((lodN, q, None))
            sn = strip_foliage(parts_clone(finest[0]))
            if sn:
                snag.append((0, sn, None))

            # ONE BOX FOR EVERY SERIES OF A SUBJECT. The codec carries a single
            # bb per subject and the quantiser has to fit inside it, so the
            # union has to include the stand series - whose crown is stretched
            # 1.3x and widened, and which therefore stands TALLER than the tree
            # it came from. Fitting the box to L0 alone is how LOD1 overflowed
            # the int16 the first time.
            bb = list(finest[1])
            for _, parts, b in made:
                if not b:
                    continue
                for k in range(3):
                    bb[k] = min(bb[k], b[k])
                    bb[k + 3] = max(bb[k + 3], b[k + 3])
            for _, parts, _b in gen + stand + snag:
                lo, hi = bbox_of(parts)
                if lo is None:
                    continue
                for k in range(3):
                    bb[k] = min(bb[k], lo[k])
                    bb[k + 3] = max(bb[k + 3], hi[k])

            def bake_series(series):
                out, tags = [], []
                for L, parts, _b in series:
                    bake_ao(parts, bb)
                    recs = []
                    for P in parts:
                        used.add(P['mi'])
                        raw, meta = pack_part(P, bb)
                        meta['off'] = len(blob); meta['len'] = len(raw)
                        blob.extend(raw)
                        recs.append(meta)
                    out.append({'lod': L,
                                'tris': sum(len(P['idx']) // 3 for P in parts),
                                'parts': recs})
                    tags.append('%d:%d' % (L, out[-1]['tris']))
                return out, tags

            rungs, shown = bake_series(made_all)
            standR, shownS = bake_series(stand)
            snagR, shownD = bake_series(snag)
            subjects.append({'name': S['name'], 'h': S.get('h'),
                             'tris': S.get('tris'), 'bb': [round(v, 4) for v in bb],
                             'shipped': len(lods) > 1, 'rungs': rungs,
                             'stand': standR, 'snag': snagR})
            print('    %-22s %6d tris  rungs %s | stand %s | snag %s'
                  % (S['name'], S.get('tris', 0), ' '.join(shown),
                     ' '.join(shownS) or '-', ' '.join(shownD) or '-'))
        if not subjects:
            continue
        rel = 'media/geo/trees/%s.bin' % stem if report else \
            write_media('geo/trees', stem, 'bin', bytes(blob))
        mats, texRel = ({}, []) if report else bake_textures(g, bin_, used, stem)
        texAll.extend(texRel)
        stems.append(stem); total += len(blob)
        pack['collections'].append({
            'name': a['name'], 'bin': rel, 'bytes': len(blob),
            'credit': a.get('credit'),
            # the licence travels with the payload: a baked asset whose
            # provenance was lost is one nobody can ship
            'licence': (a.get('licence') or {}).get('text'),
            'licenceOk': (a.get('licence') or {}).get('ok'),
            # placement dials stay DATA: the world moves them without a re-bake
            'place': dict({k: t.get(k) for k in ('size', 'proportion', 'sink', 'dead', 'impa', 'implight')
                           if k in t},
                          # the stand series is drawn with its crown stretched;
                          # see gen_rung on why that is a dial and not geometry
                          crownH=view_crown_h),
            'tint': {k: t.get(k) for k in ('hue', 'sat', 'light', 'bark', 'alpha')
                     if k in t},
            'materials': mats,
            'subjects': subjects,
        })
        print('  %-46s %8.2f MB  %d subjects' % (a['name'], len(blob) / 1e6, len(subjects)))

    if report:
        print('\n--report: %d collections, %.2f MB of geometry, nothing written'
              % (len(pack['collections']), total / 1e6))
        return 0
    prune_media_stems('geo/trees', stems, [c['bin'] for c in pack['collections']])
    prune_media_stems('tex/trees', stems, texAll)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(pack, f, indent=1)
        f.write('\n')
    body = json.dumps(pack, indent=1)
    # every 'media/...' literal becomes B + 'media/...' so the built page
    # resolves it against FLYDIY_ASSET_BASE
    body = body.replace('"media/', '"" + B + "media/')
    with open(OUTJS, 'w', encoding='utf-8', newline='\n') as f:
        f.write('// trees_pack.js - BAKED by tools/tree_prep.py, do not edit.\n')
        f.write('// The tree payload manifest: one collection per curated pack,\n')
        f.write('// its subjects, their rungs, and the maps their materials wear.\n')
        f.write(BASE_DECL + '\n')
        f.write('const TREE_PACK = ' + body + ';\n')
        f.write("if (typeof module !== 'undefined' && module.exports) "
                'module.exports = TREE_PACK;\n')
    print('\nwrote %s + %s  (%d collections, %.2f MB)' % (
        os.path.relpath(OUT, ROOT), os.path.relpath(OUTJS, ROOT),
        len(pack['collections']), total / 1e6))
    return 0


if __name__ == '__main__':
    sys.exit(main())
