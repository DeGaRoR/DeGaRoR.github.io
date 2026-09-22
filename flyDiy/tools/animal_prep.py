#!/usr/bin/env python3
"""animal_prep.py — bake the declared ANIMALS (tools/animals_table.py).

GLB -> one geometry .bin per animal under media/geo/animals/, one CLIPS .bin
beside it, the author's maps re-encoded under media/tex/animals/<key>/, and one
manifest src/animals/<key>_animal.js that registerAnimal()s the lot; the bake
order goes to src/animals/animals_index.json for build.js. The static LEVELS
are NOT made here — tools/animal_lod.js reads these manifests and cuts them
(the runner below calls it, as totem_prep.py calls totem_lod.js).

AS-IS (import-models-as-is): every primitive, every vertex, the author's own
normals and uvs, float32 exactly as exported. The only processing is unpacking
glTF accessors into the flat layout src/core/55_animal_codec.js reads back, and
re-encoding the maps to the row's `tex` budget (the prop pipeline's one
exception, for the same reason: the delivered PNGs are 1-1.6 MB apiece and an
elk is seen from a wing).

NOTHING IS SCALED IN THE PAYLOAD. The row declares a real `length` in metres
and the baker measures the rest mesh to find the factor, but the factor rides
in the manifest and the SCENE applies it — one Object3D scale at the root
instead of a scaled rig, scaled inverse bind matrices, scaled clip
translations and four chances to get one of them wrong.

Bin layout (little-endian, sections 4-byte aligned; the manifest carries every
offset and count, nothing is discovered by reading ahead):
  ibm      f32[16 * nJoints]   inverse bind matrices, column-major (glTF order)
  per mesh at manifest.meshes[i].off:
      f32 pos[3n] f32 nrm[3n] f32 uv[2n] [u8 jt[4n] f32 wt[4n]] u16 idx[3t]
  (the bracketed pair only when the mesh is skinned — the elk's antlers are a
   rigid mesh parented to a bone, and carry neither)

Clips bin, per clip at manifest.clips[i].off, `frames` frames on a uniform
grid at `fps`:
      f32 travel[3 * frames]           the root joint's displacement, in METRES,
                                       zeroed out of the frames below
      per frame:  f32 t[3] per node of `nt`
                  f32 r[4] per node of `nr`
                  f32 s[3] per node of `ns`

Usage (from flyDiy/):  python tools/animal_prep.py           # bake + cut
                       python tools/animal_prep.py --report  # inventory only
                       python tools/animal_prep.py --bake    # bake, no cut
"""
import json
import math
import os
import struct
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from glb_inspect import load, accessor, view_bytes          # noqa: E402
from media_lib import write_media, prune_media, encode_tex, BASE_DECL   # noqa: E402
import animals_table as TABLE                               # noqa: E402

OUT_DIR = os.path.join(ROOT, 'src', 'animals')
GEO = 'geo/animals'


def pad4(buf):
    while len(buf) % 4:
        buf += b'\0'


def tex_of(j, tref, texs):
    """a texture reference -> the id the manifest uses, or None"""
    if not tref:
        return None
    return texs.get(j['textures'][tref['index']]['source'])


# ---------------------------------------------------------------------------
# the node tree and the rest pose (the same arithmetic tools/animal_lod.js runs
# in node; here it only measures, so the row's `length` can be checked)
# ---------------------------------------------------------------------------
def mat_of(n):
    # ALWAYS through decompose(), so the matrix this measures with is the one
    # the manifest's TRS rebuilds — a node carrying a `matrix` measured one way
    # and shipped another is a rest pose that drifts between baker and page
    t, (x, y, z, w), s = decompose(n)
    R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[R[i][0] * s[0], R[i][1] * s[1], R[i][2] * s[2], t[i]] for i in range(3)] + [[0, 0, 0, 1]]


def mul(a, b):
    return [[sum(a[i][k] * b[k][jj] for k in range(4)) for jj in range(4)] for i in range(4)]


def xform(m, p):
    return [m[i][0] * p[0] + m[i][1] * p[1] + m[i][2] * p[2] + m[i][3] for i in range(3)]


def decompose(n):
    """a node's TRS. A glTF node may carry a `matrix` instead (Sketchfab's
    exporter writes one on its root: the FBX y-up/z-up turn and a 0.01 scale),
    and the codec rebuilds the tree from TRS alone — so it is decomposed here,
    once, rather than a second path being carried through five files."""
    if 'matrix' not in n:
        return (list(n.get('translation', [0, 0, 0])), list(n.get('rotation', [0, 0, 0, 1])),
                list(n.get('scale', [1, 1, 1])))
    m = n['matrix']                                     # column-major
    C = [[m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]]   # the three basis columns
    t = [m[12], m[13], m[14]]
    s = [math.sqrt(sum(v * v for v in c)) or 1.0 for c in C]
    det = (C[0][0] * (C[1][1] * C[2][2] - C[2][1] * C[1][2])
           - C[1][0] * (C[0][1] * C[2][2] - C[2][1] * C[0][2])
           + C[2][0] * (C[0][1] * C[1][2] - C[1][1] * C[0][2]))
    if det < 0:
        s[0] = -s[0]
    R = [[C[i][k] / s[i] for k in range(3)] for i in range(3)]          # R[col][row]
    # rows of the rotation matrix, the usual quaternion extraction
    r00, r10, r20 = R[0][0], R[1][0], R[2][0]
    r01, r11, r21 = R[0][1], R[1][1], R[2][1]
    r02, r12, r22 = R[0][2], R[1][2], R[2][2]
    tr = r00 + r11 + r22
    if tr > 0:
        f = math.sqrt(tr + 1.0) * 2
        q = [(r21 - r12) / f, (r02 - r20) / f, (r10 - r01) / f, 0.25 * f]
    elif r00 > r11 and r00 > r22:
        f = math.sqrt(1.0 + r00 - r11 - r22) * 2
        q = [0.25 * f, (r01 + r10) / f, (r02 + r20) / f, (r21 - r12) / f]
    elif r11 > r22:
        f = math.sqrt(1.0 + r11 - r00 - r22) * 2
        q = [(r01 + r10) / f, 0.25 * f, (r12 + r21) / f, (r02 - r20) / f]
    else:
        f = math.sqrt(1.0 + r22 - r00 - r11) * 2
        q = [(r02 + r20) / f, (r12 + r21) / f, 0.25 * f, (r10 - r01) / f]
    n2 = math.sqrt(sum(v * v for v in q)) or 1.0
    return t, [v / n2 for v in q], s


def world_matrices(j):
    nodes = j['nodes']
    parent = [-1] * len(nodes)
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i
    W = [None] * len(nodes)

    def wm(i):
        if W[i] is None:
            W[i] = mat_of(nodes[i]) if parent[i] < 0 else mul(wm(parent[i]), mat_of(nodes[i]))
        return W[i]
    for i in range(len(nodes)):
        wm(i)
    return W, parent


def rest_points(j, bin_, picked, W):
    """the bind-pose mesh in scene space — skinned meshes through their joint
    matrices, rigid ones through their node's. Only used to MEASURE."""
    out = []
    for ni, prim in picked:
        n = j['nodes'][ni]
        A = prim['attributes']
        pos = accessor(j, bin_, A['POSITION'])
        if 'skin' in n:
            sk = j['skins'][n['skin']]
            ibm = accessor(j, bin_, sk['inverseBindMatrices'])
            JM = []
            for k, jn in enumerate(sk['joints']):
                m = ibm[k]                         # column-major 16
                M = [[m[0], m[4], m[8], m[12]], [m[1], m[5], m[9], m[13]],
                     [m[2], m[6], m[10], m[14]], [m[3], m[7], m[11], m[15]]]
                JM.append(mul(W[jn], M))
            jt = accessor(j, bin_, A['JOINTS_0'])
            wt = accessor(j, bin_, A['WEIGHTS_0'])
            for i, p in enumerate(pos):
                x = y = z = 0.0
                for k in range(4):
                    w = wt[i][k]
                    if w == 0:
                        continue
                    q = xform(JM[jt[i][k]], p)
                    x += w * q[0]; y += w * q[1]; z += w * q[2]
                out.append((x, y, z))
        else:
            for p in pos:
                out.append(tuple(xform(W[ni], p)))
    return out


def pick_meshes(j, row):
    """the (node, primitive) pairs this row bakes — the whole file, or the
    `meshes` the row names (the bird file holds five birds)"""
    want = row.get('meshes')
    out = []
    for ni, n in enumerate(j['nodes']):
        if 'mesh' not in n:
            continue
        if want is not None and ni not in want:
            continue
        for prim in j['meshes'][n['mesh']]['primitives']:
            out.append((ni, prim))
    return out


AXIS = {'x': 0, 'y': 1, 'z': 2}


# ---------------------------------------------------------------------------
# THE CLIPS
# ---------------------------------------------------------------------------
def nlerp(a, b, t):
    d = sum(x * y for x, y in zip(a, b))
    if d < 0:
        b = [-x for x in b]
    q = [x + (y - x) * t for x, y in zip(a, b)]
    n = math.sqrt(sum(x * x for x in q)) or 1.0
    return [x / n for x in q]


def lerp3(a, b, t):
    return [x + (y - x) * t for x, y in zip(a, b)]


def sample(ts, vs, t, quat):
    k = 0
    while k + 1 < len(ts) and ts[k + 1] <= t:
        k += 1
    if k + 1 >= len(ts) or t <= ts[k]:
        return list(vs[k])
    u = (t - ts[k]) / (ts[k + 1] - ts[k])
    return nlerp(vs[k], vs[k + 1], u) if quat else lerp3(vs[k], vs[k + 1], u)


def bake_clip(j, bin_, anim, fps, root_node, scale, PW3):
    """one glTF animation -> (manifest fields, bytes). Channels are grouped by
    path; a node animated on a path appears in that path's node list and gets
    one value per frame.

    THE ROOT MOTION IS EXTRACTED. The locomotion clips walk the rig forward on
    the root joint's own translation channel; left in, the animal would walk
    away from the transform that places it (and the LOD, the pick and the
    shadow would stay behind). So the root's translation is held at its frame-0
    value and the displacement rides in `travel`, in the MODEL FRAME (the
    manifest's scene frame, y up) and in METRES — PW3 is the model-frame
    rotation+scale of the root joint's PARENT, which is what turns a local
    channel into a model-frame displacement, and `scale` the row's own."""
    nodes = j['nodes']
    chans = {'translation': {}, 'rotation': {}, 'scale': {}}
    t_end = 0.0
    for ch in anim['channels']:
        path = ch['target'].get('path')
        nd = ch['target'].get('node')
        if path not in chans or nd is None:
            continue
        smp = anim['samplers'][ch['sampler']]
        ts = accessor(j, bin_, smp['input'])
        vs = accessor(j, bin_, smp['output'])
        acc = j['accessors'][smp['output']]
        if acc['componentType'] != 5126:                 # normalized ints -> floats
            div = {5120: 127.0, 5121: 255.0, 5122: 32767.0, 5123: 65535.0}[acc['componentType']]
            vs = [tuple(v / div for v in q) for q in vs]
        if smp.get('interpolation') == 'CUBICSPLINE':    # value is the middle of each triple
            vs = [vs[i * 3 + 1] for i in range(len(ts))]
        chans[path][nd] = (list(ts), [list(v) for v in vs])
        t_end = max(t_end, ts[-1])
    nt = sorted(chans['translation'])
    nr = sorted(chans['rotation'])
    ns = sorted(chans['scale'])
    frames = max(2, int(round(t_end * fps)) + 1)
    buf = bytearray()
    travel = []
    # the root's own translation track, sampled first: it is both the travel
    # and what is subtracted from the frames
    rt = chans['translation'].get(root_node) if root_node is not None else None
    r0 = sample(rt[0], rt[1], 0.0, False) if rt else None
    for f in range(frames):
        t = f / fps
        if rt:
            p = sample(rt[0], rt[1], t, False)
            d = [p[k] - r0[k] for k in range(3)]
            travel += [scale * sum(PW3[i][k] * d[k] for k in range(3)) for i in range(3)]
        else:
            travel += [0.0, 0.0, 0.0]
    buf += struct.pack('<%df' % len(travel), *travel)
    for f in range(frames):
        t = f / fps
        for nd in nt:
            ts, vs = chans['translation'][nd]
            v = sample(ts, vs, t, False)
            if nd == root_node:
                v = list(r0)                             # held: the travel is out in `travel`
            buf += struct.pack('<3f', *v[:3])
        for nd in nr:
            ts, vs = chans['rotation'][nd]
            buf += struct.pack('<4f', *sample(ts, vs, t, True)[:4])
        for nd in ns:
            ts, vs = chans['scale'][nd]
            buf += struct.pack('<3f', *sample(ts, vs, t, False)[:3])
    e = travel[3 * (frames - 1):3 * frames]
    dist = math.hypot(e[0], e[2])
    dur = (frames - 1) / fps
    man = {'name': anim.get('name', ''), 'fps': fps, 'frames': frames, 'dur': round(dur, 4),
           'nt': nt, 'nr': nr, 'ns': ns,
           'travel': round(dist, 4), 'speed': round(dist / dur, 4) if dur else 0.0,
           # the direction of travel in the model frame (y dropped): for the
           # gaits this IS which way the animal faces, measured, never declared
           'dir': [round(e[0] / dist, 4), round(e[2] / dist, 4)] if dist > 1e-4 else None,
           'len': len(buf)}
    return man, bytes(buf)


# ---------------------------------------------------------------------------
def bake(row, report):
    j, bin_ = load(os.path.join(ROOT, row['glb']))
    nodes = j['nodes']
    W, parent = world_matrices(j)
    ntab = []
    for i, n in enumerate(nodes):
        t, r, s = decompose(n)
        ntab.append({'n': n.get('name', 'node%d' % i), 'p': parent[i],
                     't': [round(v, 6) for v in t], 'r': [round(v, 7) for v in r],
                     's': [round(v, 7) for v in s]})
    picked = pick_meshes(j, row)
    if not picked:
        raise SystemExit('%s: no mesh selected' % row['key'])
    skins = set(j['nodes'][ni].get('skin') for ni, _ in picked if 'skin' in j['nodes'][ni])
    skins.discard(None)
    if len(skins) != 1:
        raise SystemExit('%s: one skin per animal (%d selected)' % (row['key'], len(skins)))
    skin = j['skins'][list(skins)[0]]
    joints = skin['joints']
    ibm = accessor(j, bin_, skin['inverseBindMatrices'])

    # ---- the measure: the rest mesh, and the factor that makes it `length`
    P = rest_points(j, bin_, picked, W)
    ax = AXIS[row.get('axis', 'z')]
    lo = [min(p[k] for p in P) for k in range(3)]
    hi = [max(p[k] for p in P) for k in range(3)]
    span = hi[ax] - lo[ax]
    scale = row['length'] / span if span > 1e-9 else 1.0
    dim = [round((hi[k] - lo[k]) * scale, 4) for k in range(3)]
    bb = [round(lo[k] * scale, 4) for k in range(3)] + [round(hi[k] * scale, 4) for k in range(3)]
    # THE PIVOT — the point of the animal the world places, in metres in the
    # model frame. A land animal stands on the ground, so it is its footprint's
    # centre at the feet; a swimmer and a flier are placed by their BODY, so it
    # is the box's centre. Both the skinned instance and every static level are
    # hung off this one offset, which is what makes the ladder swap without a
    # jump (src/viewer/animals.js).
    ctr = [round((lo[k] + hi[k]) / 2 * scale, 4) for k in range(3)]
    pivot = [ctr[0], round(lo[1] * scale, 4), ctr[2]] if row['kind'] == 'land' else ctr

    # ---- the maps, re-encoded to the row's budget
    texs, tex_ids, tex_bytes = {}, {}, 0
    used = set()
    for m in j.get('materials', []):
        pbr = m.get('pbrMetallicRoughness', {})
        sg = m.get('extensions', {}).get('KHR_materials_pbrSpecularGlossiness', {})
        for ref in (pbr.get('baseColorTexture'), pbr.get('metallicRoughnessTexture'),
                    m.get('normalTexture'), m.get('occlusionTexture'), m.get('emissiveTexture'),
                    sg.get('diffuseTexture'), sg.get('specularGlossinessTexture')):
            if ref:
                used.add(j['textures'][ref['index']]['source'])
    for ti, im in enumerate(j.get('images', [])):
        if ti not in used:
            continue
        raw, _ = view_bytes(j, bin_, im['bufferView'])
        name = im.get('name') or 'tex%d' % ti
        low = name.lower()
        role = ('normal' if 'normal' in low or 'nrm' in low else
                ('data' if any(k in low for k in ('gloss', 'spec', 'rough', 'metal', 'occl', 'ao')) else 'color'))
        # the name is the author's and often says nothing; the SLOT decides,
        # so roles are corrected below once the materials are read
        data, ext = encode_tex(raw, role, row.get('tex', 1024))
        tid = 'an_%s_%d' % (row['key'], ti)
        tex_ids[ti] = tid
        if not report:
            texs[tid] = write_media('tex/animals/' + row['key'], '%s_%d' % (row['key'], ti), ext, data)
        tex_bytes += len(data)

    # ---- the materials, in the PROP record's own shape (src/viewer/props.js's
    # one factory builds them, so a level and its animal wear the same recipe)
    mats = []
    for m in j.get('materials', []):
        pbr = m.get('pbrMetallicRoughness', {})
        sg = m.get('extensions', {}).get('KHR_materials_pbrSpecularGlossiness', {})
        rec = {'name': m.get('name', ''), 'dbl': bool(m.get('doubleSided', False)),
               'blend': m.get('alphaMode', 'OPAQUE') != 'OPAQUE',
               'opacity': 1.0, 'norScl': 1.0, 'ao': False, 'flat': False,
               'map': None, 'arm': None, 'nor': None, 'emis': None, 'emisMap': None}
        if sg:
            # SPEC-GLOSS IS CONVERTED, NOT SUPPORTED (the prop pipeline's rule):
            # diffuse -> base colour, 1 - glossiness -> roughness. The alpha
            # trap does not arise here: no animal in the batch ships a
            # specularGlossiness map, only the factor.
            d = sg.get('diffuseFactor', [1, 1, 1, 1])
            rec['col'] = [round(v, 5) for v in d[:3]]
            rec['opacity'] = round(d[3], 4)
            rec['rough'] = round(1.0 - float(sg.get('glossinessFactor', 0.5)), 4)
            rec['metal'] = 0.0
            rec['map'] = tex_of(j, sg.get('diffuseTexture'), tex_ids)
        else:
            c = pbr.get('baseColorFactor', [1, 1, 1, 1])
            rec['col'] = [round(v, 5) for v in c[:3]]
            rec['opacity'] = round(c[3], 4)
            rec['rough'] = round(float(pbr.get('roughnessFactor', 1.0)), 4)
            rec['metal'] = round(float(pbr.get('metallicFactor', 1.0)), 4)
            rec['map'] = tex_of(j, pbr.get('baseColorTexture'), tex_ids)
            rec['arm'] = tex_of(j, pbr.get('metallicRoughnessTexture'), tex_ids)
            # OCCLUSION IS ONLY READ WHERE THE AUTHOR DECLARES IT (the prop
            # rule): the same image in both slots is glTF's own way of saying
            # the R channel is AO. Anything else has nothing there.
            occ = tex_of(j, m.get('occlusionTexture'), tex_ids)
            rec['ao'] = bool(occ and occ == rec['arm'])
        rec['nor'] = tex_of(j, m.get('normalTexture'), tex_ids)
        if m.get('emissiveFactor') and any(m['emissiveFactor']):
            rec['emis'] = [round(v, 4) for v in m['emissiveFactor']]
            rec['emisMap'] = tex_of(j, m.get('emissiveTexture'), tex_ids)
        # the mirror backstop the props gate holds: a roughness under 0.04 with
        # no map is a chrome animal, and nothing here is a mirror
        if rec['rough'] < 0.04 and not rec['arm']:
            print('   %s: roughness %.3f with no map -> 0.4' % (rec['name'], rec['rough']))
            rec['rough'] = 0.4
        mats.append(rec)

    # ---- the geometry
    buf = bytearray()
    buf += struct.pack('<%df' % (16 * len(ibm)), *[v for m in ibm for v in m])
    pad4(buf)
    meshes, ntri, nvert = [], 0, 0
    for ni, prim in picked:
        n = nodes[ni]
        A = prim['attributes']
        pos = accessor(j, bin_, A['POSITION'])
        nrm = accessor(j, bin_, A['NORMAL']) if 'NORMAL' in A else [(0, 1, 0)] * len(pos)
        uv = accessor(j, bin_, A['TEXCOORD_0']) if 'TEXCOORD_0' in A else [(0, 0)] * len(pos)
        idx = accessor(j, bin_, prim['indices'])
        skinned = 'skin' in n
        nv, nt_ = len(pos), len(idx) // 3
        if nv > 65536:
            raise SystemExit('%s: %d verts > u16' % (row['key'], nv))
        off = len(buf)
        buf += struct.pack('<%df' % (3 * nv), *[v for p in pos for v in p])
        buf += struct.pack('<%df' % (3 * nv), *[v for p in nrm for v in p])
        buf += struct.pack('<%df' % (2 * nv), *[v for p in uv for v in p[:2]])
        if skinned:
            jt = accessor(j, bin_, A['JOINTS_0'])
            wt = accessor(j, bin_, A['WEIGHTS_0'])
            buf += struct.pack('<%dB' % (4 * nv), *[v for p in jt for v in p])
            buf += struct.pack('<%df' % (4 * nv), *[v for p in wt for v in p])
        buf += struct.pack('<%dH' % len(idx), *idx)
        pad4(buf)
        meshes.append({'name': n.get('name', 'mesh%d' % ni), 'node': ni, 'skin': 1 if skinned else 0,
                       'mat': prim.get('material', 0), 'nv': nv, 'nt': nt_,
                       'off': off, 'len': len(buf) - off})
        ntri += nt_
        nvert += nv

    # ---- the clips the row names, by role
    by_name = {}
    for a in j.get('animations', []):
        by_name.setdefault(a.get('name', ''), a)
    root_node = None
    if row.get('rootJoint'):
        for i, n in enumerate(nodes):
            if n.get('name') == row['rootJoint']:
                root_node = i
                break
        if root_node is None:
            raise SystemExit('%s: no node named %s' % (row['key'], row['rootJoint']))
    # the model-frame rotation+scale above the root joint (see bake_clip)
    PW = W[parent[root_node]] if (root_node is not None and parent[root_node] >= 0) else [[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]
    PW3 = [[PW[i][k] for k in range(3)] for i in range(3)]
    cbuf = bytearray()
    clips = []
    for role, names in row['clips'].items():
        for nm in ([names] if isinstance(names, str) else names):
            a = by_name.get(nm)
            if a is None:
                raise SystemExit('%s: clip "%s" (role %s) is not in the file' % (row['key'], nm, role))
            man, raw = bake_clip(j, bin_, a, TABLE.FPS.get(role, 15), root_node, scale, PW3)
            man['key'] = '%s:%s' % (role, nm)
            man['role'] = role
            man['off'] = len(cbuf)
            cbuf += raw
            pad4(cbuf)
            clips.append(man)
    clips.sort(key=lambda c: (c['role'], c['name']))
    # THE FACING IS CHECKED, NOT BELIEVED: a row with a gait must face the way
    # that gait travels, or every animal of the species walks sideways
    fwd = row.get('forward')
    gait = next((c for c in clips if c['role'] in ('walk', 'trot') and c['dir']), None)
    if fwd and gait:
        dot = fwd[0] * gait['dir'][0] + fwd[1] * gait['dir'][1]
        if dot < 0.96:
            raise SystemExit('%s: forward %s but %s travels along %s (dot %.3f)'
                             % (row['key'], fwd, gait['name'], gait['dir'], dot))

    print('%-6s %2d joints %2d meshes %5d verts %5d tris  %5.2f m (x%.4f)  %2d clips %6.2f s  geo %.2f MB  clips %.2f MB  tex %.2f MB'
          % (row['key'], len(joints), len(meshes), nvert, ntri, row['length'], scale,
             len(clips), sum(c['dur'] for c in clips), len(buf) / 1048576,
             len(cbuf) / 1048576, tex_bytes / 1048576))
    for c in clips:
        print('       %-28s %-9s %5.2f s %4d f @%2d  %s'
              % (c['name'], c['role'], c['dur'], c['frames'], c['fps'],
                 ('travels %.2f m = %.2f m/s along [%+.2f %+.2f]' % (c['travel'], c['speed'], c['dir'][0], c['dir'][1])) if c['travel'] > 0.01 else 'in place'))
    if report:
        return None, []

    rel = write_media(GEO, row['key'], 'bin', bytes(buf))
    crel = write_media(GEO, row['key'] + '_clips', 'bin', bytes(cbuf))
    man = {'v': 1, 'key': row['key'], 'label': row['label'], 'kind': row['kind'],
           'credit': row['credit'], 'src': row['src'],
           'length': row['length'], 'axis': row.get('axis', 'z'), 'scale': round(scale, 8),
           'forward': row.get('forward') or [0, 1], 'spread': round(float(row.get('spread') or 0), 4),
           'dim': dim, 'bb': bb, 'pivot': pivot, 'nt': ntri, 'nv': nvert,
           'rootNode': root_node,
           'nodes': ntab, 'joints': joints, 'scene': j['scenes'][0]['nodes'],
           'bin': rel, 'clipBin': crel, 'texs': texs, 'mats': mats, 'meshes': meshes,
           'clips': clips,
           'lodPose': list(row['lodPose']) if row.get('lodPose') else None,
           'mood': row.get('mood') or None, 'sea': row.get('sea') or None, 'air': row.get('air') or None}
    body = ('// GENERATED FILE - DO NOT EDIT. Built by tools/animal_prep.py from\n'
            '// %s, per the declared table in tools/animals_table.py.\n'
            '// Source: %s.\n'
            '// Decoded by src/core/55_animal_codec.js; geometry and clips in media/%s/,\n'
            '// maps in media/tex/animals/%s/. The STATIC LEVELS are a prop pack of their\n'
            '// own (src/animals/animals_lods.js, tools/animal_lod.js). B re-roots the media\n'
            '// paths for pages that do not live at flyDiy/ (see tools/_media_lib.js).\n'
            'registerAnimal((a => {\n'
            '  %s\n'
            '  a.bin = B + a.bin; a.clipBin = B + a.clipBin;\n'
            '  for (const k in a.texs) a.texs[k] = B + a.texs[k];\n'
            '  return a;\n'
            '})(%s));\n'
            % (row['glb'], row['credit'], GEO, row['key'], BASE_DECL,
               json.dumps(man, separators=(',', ':'))))
    name = '%s_animal.js' % row['key']
    with open(os.path.join(OUT_DIR, name), 'w', encoding='utf8', newline='\n') as f:
        f.write(body)
    return name, [rel, crel] + list(texs.values())


def main(argv):
    report = '--report' in argv
    only = [a for a in argv if not a.startswith('--')]
    os.makedirs(OUT_DIR, exist_ok=True)
    rows = [r for r in TABLE.ANIMALS if not only or r['key'] in only]
    if only and not report:
        raise SystemExit('a partial bake would rewrite the index with only part of it in '
                         '- bake the whole table, or pass --report')
    files, keep = [], []
    for row in rows:
        name, rels = bake(row, report)
        if name:
            files.append(name)
            keep += rels
    if report:
        return 0
    gone = prune_media(GEO, keep)
    for row in TABLE.ANIMALS:
        gone += prune_media('tex/animals/' + row['key'], keep)
    with open(os.path.join(OUT_DIR, 'animals_index.json'), 'w', encoding='utf8', newline='\n') as f:
        f.write(json.dumps(files) + '\n')
    for name in sorted(os.listdir(OUT_DIR)):
        if name.endswith('_animal.js') and name not in files:
            os.remove(os.path.join(OUT_DIR, name))
            gone.append(name)
    print('wrote %d manifest(s); pruned %d stale file(s)' % (len(files), len(gone)))
    if '--bake' in argv:
        return 0
    print('--- baked; cutting the levels')
    return subprocess.call(['node', os.path.join(HERE, 'animal_lod.js')])


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]) or 0)
