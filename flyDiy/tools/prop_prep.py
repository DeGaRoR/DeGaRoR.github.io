#!/usr/bin/env python3
"""prop_prep.py — bake the declared hangar props into JS payloads.

Usage:  python tools/prop_prep.py [key ...]        (no args = the whole table)
        python tools/prop_prep.py --report         (inventory only, writes nothing)

Reads  tools/props_table.py  (the authority: rows, groups, provenance)
       assets/props/<src>/   (the DELIVERED asset, never edited)
Writes src/props/props_<group>.js   one pack per editor section
       src/props/props_packs.json   the ordered file list, for tools/build.js
Verify node tools/_prop_check.js    (GATE PROPS)

WHAT IS AND IS NOT DONE TO THE ASSET
  Geometry is imported AS-IS: every triangle the author shipped is in the
  payload, with the author's own normals and uvs. No decimation, no welding,
  no "unseen" clipping ([[import-models-as-is]]). The only transforms are
  RIGID ones the table declares — a uniform scale for an export delivered in
  millimetres, a quarter turn to stand a wheel on the axis the game uses, and
  a translation that puts the origin where the prop meets the world.
  Textures ARE re-encoded, because the user asked for it in this batch: 1k
  source maps become 512 (or 256 for props under half a metre), and a map whose
  channels turn out to be constant folds to a scalar and is dropped entirely.
  The delivered maps stay in assets/props/ at full resolution — re-run this
  script with a bigger budget and the quality comes straight back.

THE ONE MATERIAL. Every prop lands on the same three-map recipe, so the viewer
has ONE material factory and no per-asset branches:
    diff  sRGB  base colour (+ alpha where the author used it)
    arm   linear  R = ambient occlusion, G = roughness, B = metalness
    nor   linear  tangent-space normal, OpenGL convention
Poly Haven ships exactly that packing and calls it "arm". Sketchfab ships
glTF's metallicRoughness, which is the same image with nothing meaningful in
R — so AO is taken from R only when the author's own filename says `arm`, and
is otherwise switched off rather than guessed at.
"""
import base64, hashlib, importlib.util, io, json, math, os, struct, sys
from media_lib import write_media, write_media_named, prune_media, BASE_DECL

from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, 'assets', 'props')
OUT_DIR = os.path.join(ROOT, 'src', 'props')

_spec = importlib.util.spec_from_file_location(
    'props_table', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'props_table.py'))
TABLE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(TABLE)

COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2),
        5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


# ---------------------------------------------------------------------------
# glTF / GLB reading. One loader for both containers: the table names a file,
# not a format, so a source can be re-delivered in the other one without the
# row changing.
# ---------------------------------------------------------------------------
def load_gltf(path):
    if path.lower().endswith('.glb'):
        d = open(path, 'rb').read()
        magic, _, _ = struct.unpack('<III', d[:12])
        assert magic == 0x46546C67, f'not a GLB: {path}'
        off, js, bin_ = 12, None, b''
        while off < len(d):
            clen, ctype = struct.unpack('<II', d[off:off + 8])
            blob = d[off + 8:off + 8 + clen]
            if ctype == 0x4E4F534A:
                js = json.loads(blob.decode('utf8'))
            elif ctype == 0x004E4942:
                bin_ = blob
            off += 8 + clen
        return js, [bin_], os.path.dirname(path)
    j = json.load(open(path, encoding='utf8'))
    base = os.path.dirname(path)
    bufs = []
    for b in j.get('buffers', []):
        u = b.get('uri', '')
        bufs.append(base64.b64decode(u.split(',', 1)[1]) if u.startswith('data:')
                    else open(os.path.join(base, u), 'rb').read())
    return j, bufs, base


def accessor(j, bufs, ai):
    a = j['accessors'][ai]
    n, nc = a['count'], NCOMP[a['type']]
    fmt, sz = COMP[a['componentType']]
    if 'bufferView' not in a:
        return [(0.0,) * nc] * n
    bv = j['bufferViews'][a['bufferView']]
    o = bv.get('byteOffset', 0)
    raw = bufs[bv.get('buffer', 0)][o:o + bv['byteLength']]
    stride = bv.get('byteStride') or nc * sz
    base = a.get('byteOffset', 0)
    norm = a.get('normalized', False)
    out = []
    for i in range(n):
        v = struct.unpack_from('<' + str(nc) + fmt, raw, base + i * stride)
        if norm and fmt in ('B', 'H'):
            v = tuple(x / (255.0 if fmt == 'B' else 65535.0) for x in v)
        out.append(v)
    return out


def mat_mul(a, b):
    return [sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4))
            for c in range(4) for r in range(4)]


def trs_matrix(n):
    if 'matrix' in n:
        return list(n['matrix'])
    t = n.get('translation', [0, 0, 0])
    x, y, z, w = n.get('rotation', [0, 0, 0, 1])
    s = n.get('scale', [1, 1, 1])
    R = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
         2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
         2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
         0, 0, 0, 1]
    for c in range(3):
        for r in range(3):
            R[c * 4 + r] *= s[c]
    R[12], R[13], R[14] = t
    return R


def xf_point(m, p):
    return tuple(m[i] * p[0] + m[4 + i] * p[1] + m[8 + i] * p[2] + m[12 + i]
                 for i in range(3))


def normal_matrix(m):
    """Inverse transpose of the upper 3x3 — the frame a normal transforms in.
    Node scales in these exports are not always uniform, and using the point
    matrix on a normal is the classic way to get a lit surface that is subtly,
    unfixably wrong."""
    a = [m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]
    det = (a[0] * (a[4] * a[8] - a[5] * a[7])
           - a[3] * (a[1] * a[8] - a[2] * a[7])
           + a[6] * (a[1] * a[5] - a[2] * a[4]))
    if abs(det) < 1e-20:
        return [1, 0, 0, 0, 1, 0, 0, 0, 1]
    inv = [(a[4] * a[8] - a[5] * a[7]), -(a[3] * a[8] - a[5] * a[6]), (a[3] * a[7] - a[4] * a[6]),
           -(a[1] * a[8] - a[2] * a[7]), (a[0] * a[8] - a[2] * a[6]), -(a[0] * a[7] - a[1] * a[6]),
           (a[1] * a[5] - a[2] * a[4]), -(a[0] * a[5] - a[2] * a[3]), (a[0] * a[4] - a[1] * a[3])]
    return [v / det for v in inv]          # cofactor/det == inverse-transpose


def xf_normal(nm, n):
    x = nm[0] * n[0] + nm[1] * n[1] + nm[2] * n[2]
    y = nm[3] * n[0] + nm[4] * n[1] + nm[5] * n[2]
    z = nm[6] * n[0] + nm[7] * n[1] + nm[8] * n[2]
    L = math.sqrt(x * x + y * y + z * z) or 1.0
    return (x / L, y / L, z / L)


def rot_matrix(deg):
    """Table rotation, x then y then z, in degrees. Rigid: no scale, no shear."""
    m = [1, 0, 0, 0, 1, 0, 0, 0, 1]
    for axis, d in enumerate(deg):
        if not d:
            continue
        a = math.radians(d)
        c, s = math.cos(a), math.sin(a)
        r = ([1, 0, 0, 0, c, -s, 0, s, c] if axis == 0 else
             [c, 0, s, 0, 1, 0, -s, 0, c] if axis == 1 else
             [c, -s, 0, s, c, 0, 0, 0, 1])
        m = [sum(r[i * 3 + k] * m[k * 3 + jj] for k in range(3))
             for i in range(3) for jj in range(3)]
    return m


def apply3(m, v):
    return (m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
            m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
            m[6] * v[0] + m[7] * v[1] + m[8] * v[2])


# ---------------------------------------------------------------------------
# Texture handling
# ---------------------------------------------------------------------------
def image_bytes(j, bufs, base, i):
    """(bytes, name) for images[i]. name is the author's filename where there
    is one — the AO rule reads it."""
    im = j['images'][i]
    if 'uri' in im:
        u = im['uri']
        if u.startswith('data:'):
            return base64.b64decode(u.split(',', 1)[1]), im.get('name', '')
        return open(os.path.join(base, u), 'rb').read(), os.path.basename(u)
    bv = j['bufferViews'][im['bufferView']]
    o = bv.get('byteOffset', 0)
    return bufs[bv.get('buffer', 0)][o:o + bv['byteLength']], im.get('name', '')


def tex_source(j, ti):
    t = j['textures'][ti]
    if 'source' in t:
        return t['source']
    for e in (t.get('extensions') or {}).values():           # basisu etc.
        if 'source' in e:
            return e['source']
    raise KeyError('texture with no source')


def channel_stats(img):
    """(min, max, mean) per channel, 0..1."""
    im = img.convert('RGB')
    out = []
    for ch in im.split():
        lo, hi = ch.getextrema()
        h = ch.histogram()
        n = sum(h) or 1
        mean = sum(i * c for i, c in enumerate(h)) / n
        out.append((lo / 255.0, hi / 255.0, mean / 255.0))
    return out


FLAT = 0.035          # a channel this tight is a constant wearing a texture's hat
# AN AO CHANNEL THAT IS BLACK IS NOT OCCLUSION, IT IS AN EMPTY CHANNEL (G62.11,
# user: "The garbage bin objects seem to have a material issue, they render
# black"). glTF says R of a metallicRoughness map is unused, and three of the
# delivered "arm" files have nothing in it — measured across the whole library:
#
#     every healthy map          R mean 0.44 .. 0.995
#     metal_trash_can_arm        R mean 0.005  (max 0.18)
#     metal_trash_can_rust_arm   R mean 0.004  (max 0.15)
#     barrel_stove_arm           R mean 0.006  (max 0.15)
#
# The flatness test does not catch them - 0.00 to 0.18 is not flat - so the
# baker believed the channel and wrote an aoMap that multiplies ALL indirect
# light by zero. On a metal, which has no diffuse to fall back on, that is a
# black object. Real occlusion is mostly UNoccluded; nothing legitimate sits
# down here, and the gap to the next map up is a factor of eighty.
AO_MIN_MEAN = 0.25


class TexBank:
    """Pack-level texture store, deduplicated by encoded bytes: two props cut
    from one delivered file share their maps instead of shipping them twice.
    Since 2026-09-01 a map is a real file under media/tex/props/, named by its
    own sha12 (content-addressed = self-busting; a re-encode is a new name),
    and by_hash holds the page-relative path instead of a data URI. Report
    runs write nothing (write=False computes the same names)."""

    def __init__(self, write=True, sub='tex/props'):
        self.by_hash, self.order, self.bytes = {}, [], 0
        self.write = write
        self.sub = sub                  # a second table prunes its own dir

    def add(self, raw, mime):
        h = hashlib.sha256(raw).hexdigest()[:12]
        if h not in self.by_hash:
            name = '%s.%s' % (h, 'png' if mime == 'image/png' else 'jpg')
            self.by_hash[h] = (write_media_named(self.sub, name, raw)
                               if self.write else 'media/' + self.sub + '/' + name)
            self.order.append(h)
            self.bytes += len(raw)
        return h

    def encode(self, img, budget, kind):
        """Resize (never up) and encode. Returns (id, w, h, bytes)."""
        w, h = img.size
        if max(w, h) > budget:
            s = budget / max(w, h)
            img = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
        buf = io.BytesIO()
        if kind == 'diff_a':                       # alpha the author actually used
            img.convert('RGBA').save(buf, 'PNG', optimize=True)
            mime = 'image/png'
        else:
            q = 90 if kind == 'nor' else 84        # normals bruise first under jpeg
            img.convert('RGB').save(buf, 'JPEG', quality=q, subsampling=0, optimize=True)
            mime = 'image/jpeg'
        raw = buf.getvalue()
        return self.add(raw, mime), img.size[0], img.size[1], len(raw)


def has_real_alpha(img):
    if img.mode not in ('RGBA', 'LA', 'PA'):
        return False
    a = img.convert('RGBA').split()[3]
    lo, hi = a.getextrema()
    return lo < 250


def is_identity_normal(img):
    """A normal map that is flat everywhere carries no information and costs a
    sampler; the C172 import dropped these too."""
    st = channel_stats(img)
    return (abs(st[0][2] - 0.5) < 0.02 and st[0][1] - st[0][0] < 0.06 and
            abs(st[1][2] - 0.5) < 0.02 and st[1][1] - st[1][0] < 0.06 and
            st[2][2] > 0.94)


# ---------------------------------------------------------------------------
# The bake
# ---------------------------------------------------------------------------
def node_worlds(j):
    """world matrix of every node in the default scene, by index"""
    W = {}
    scene = j.get('scenes', [{}])[j.get('scene', 0)]
    I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    stack = [(i, I) for i in scene.get('nodes', [])]
    while stack:
        ni, par = stack.pop()
        m = mat_mul(par, trs_matrix(j['nodes'][ni]))
        W[ni] = m
        for c in j['nodes'][ni].get('children', []):
            stack.append((c, m))
    return W


def skin_matrices(j, bufs, si, W):
    """per joint: jointWorld * inverseBind — the matrix a skinned vertex is
    actually drawn with when nothing is animating"""
    sk = j['skins'][si]
    ibm = accessor(j, bufs, sk['inverseBindMatrices']) if 'inverseBindMatrices' in sk else None
    out = []
    for k, jn in enumerate(sk['joints']):
        ib = list(ibm[k]) if ibm else [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        out.append(mat_mul(W[jn], ib))
    return out


def gather(j, bufs, want_mats, want_nodes=None):
    """[(material name, positions, normals, uvs, indices)] in world space.

    `want_nodes` selects WHOLE NODES by name — a modular kit ships every module
    in one file sharing two materials, so material is not the axis that
    separates them (G252, the pier). Still no mesh is ever cut: a node's
    primitives come whole or not at all.

    A SKINNED MESH IS BAKED AT REST. glTF says a skinned primitive's vertices
    are placed by its joints and NOT by its own node's transform, so the walk
    below would put every skinned part in the wrong place; instead each vertex
    is blended through jointWorld * inverseBind for its four joints with the
    bind pose as the pose. The Grady-White's propellers and wheel arrive on
    bones for an animation the game never plays; at rest they are simply where
    the author left them."""
    out = []
    W = node_worlds(j)
    scene = j.get('scenes', [{}])[j.get('scene', 0)]
    I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    stack = [(i, I) for i in reversed(scene.get('nodes', []))]
    while stack:
        ni, par = stack.pop()
        n = j['nodes'][ni]
        m = mat_mul(par, trs_matrix(n))
        if 'mesh' in n and (not want_nodes or n.get('name') in want_nodes):
            nm = normal_matrix(m)
            skin = skin_matrices(j, bufs, n['skin'], W) if 'skin' in n else None
            for p in j['meshes'][n['mesh']].get('primitives', []):
                if p.get('mode', 4) != 4:
                    continue
                mi = p.get('material')
                name = j['materials'][mi].get('name', 'mat%d' % mi) if mi is not None else '_none'
                if want_mats and name not in want_mats:
                    continue
                A = p['attributes']
                if skin and 'JOINTS_0' in A and 'WEIGHTS_0' in A:
                    P0 = accessor(j, bufs, A['POSITION'])
                    N0 = (accessor(j, bufs, A['NORMAL']) if 'NORMAL' in A
                          else [(0.0, 1.0, 0.0)] * len(P0))
                    JJ = accessor(j, bufs, A['JOINTS_0'])
                    WW = accessor(j, bufs, A['WEIGHTS_0'])
                    pos, nrm = [], []
                    for v, nv, jj, ww in zip(P0, N0, JJ, WW):
                        acc = [0.0] * 16
                        tw = 0.0
                        for k in range(4):
                            w = ww[k]
                            if w <= 0.0:
                                continue
                            mk = skin[int(jj[k])]
                            for q in range(16):
                                acc[q] += mk[q] * w
                            tw += w
                        if tw <= 0.0:
                            acc = list(I)
                        pos.append(xf_point(acc, v))
                        nrm.append(xf_normal(normal_matrix(acc), nv))
                else:
                    pos = [xf_point(m, v) for v in accessor(j, bufs, A['POSITION'])]
                    nrm = ([xf_normal(nm, v) for v in accessor(j, bufs, A['NORMAL'])]
                           if 'NORMAL' in A else [(0.0, 1.0, 0.0)] * len(pos))
                uv = ([(v[0], v[1]) for v in accessor(j, bufs, A['TEXCOORD_0'])]
                      if 'TEXCOORD_0' in A else [(0.0, 0.0)] * len(pos))
                idx = ([int(v[0]) for v in accessor(j, bufs, p['indices'])]
                       if 'indices' in p else list(range(len(pos))))
                out.append((name, pos, nrm, uv, idx))
        for c in reversed(n.get('children', [])):
            stack.append((c, m))
    return out


def bake_material(j, bufs, base, mdef, bank, budget, log):
    """glTF material -> the flat record the viewer's one factory reads."""
    pbr = mdef.get('pbrMetallicRoughness', {})
    ext = mdef.get('extensions', {}) or {}
    # SPEC-GLOSS. Older Sketchfab exports ship KHR_materials_pbrSpecularGlossiness
    # and no metallic-roughness block at all. Rather than teach the viewer a
    # second lighting model, it is converted here into the one recipe: diffuse
    # becomes base colour, and the glossiness channel becomes roughness.
    sg = ext.get('KHR_materials_pbrSpecularGlossiness')
    if sg and not pbr:
        pbr = {'baseColorFactor': sg.get('diffuseFactor', [1, 1, 1, 1]),
               'metallicFactor': 0.0,
               'roughnessFactor': round(1.0 - sg.get('glossinessFactor', 1.0), 4)}
        if 'diffuseTexture' in sg:
            pbr['baseColorTexture'] = sg['diffuseTexture']
    col = pbr.get('baseColorFactor', [1, 1, 1, 1])
    out = {'col': [round(c, 4) for c in col[:3]],
           'rough': round(pbr.get('roughnessFactor', 1.0), 4),
           'metal': round(pbr.get('metallicFactor', 1.0), 4),
           'ao': 0.0, 'opacity': round(col[3], 4)}
    if mdef.get('doubleSided'):
        out['dbl'] = 1
    if mdef.get('alphaMode') in ('BLEND', 'MASK'):
        out['blend'] = 1
    # GLASS. r128's MeshStandardMaterial has no transmission, and a gauge cover
    # is two hundred triangles: a plain transparent standard reads the same at
    # hangar distance and costs nothing.
    if 'KHR_materials_transmission' in ext:
        out['blend'] = 1
        out['opacity'] = round(min(out['opacity'],
                                   1.0 - ext['KHR_materials_transmission'].get('transmissionFactor', 1.0) * 0.78), 4)

    def img_of(ref):
        raw, name = image_bytes(j, bufs, base, tex_source(j, ref['index']))
        if (ref.get('extensions') or {}).get('KHR_texture_transform'):
            log.append('    ! KHR_texture_transform ignored on %s' % name)
        return Image.open(io.BytesIO(raw)), name

    if 'baseColorTexture' in pbr:
        img, name = img_of(pbr['baseColorTexture'])
        kind = 'diff_a' if (out.get('blend') and has_real_alpha(img)) else 'diff'
        tid, w, h, nb = bank.encode(img, budget, kind)
        out['map'] = tid
        log.append('    diff %-38s %4dpx %6.1f KB%s' % (name, w, nb / 1024, ' +alpha' if kind == 'diff_a' else ''))

    arm_img = arm_name = None
    if 'metallicRoughnessTexture' in pbr:
        arm_img, arm_name = img_of(pbr['metallicRoughnessTexture'])
        # AO lives in R only where the author says so. Two authors say it two
        # ways: Poly Haven names the file "arm", and the Sketchfab exports point
        # occlusionTexture at the SAME image as metallicRoughness, which is the
        # same declaration in glTF's own words. Reading R as occlusion on a map
        # that has nothing there is how a prop ends up mysteriously dirty.
        armed = ('arm' in arm_name.lower() or
                 ('occlusionTexture' in mdef and
                  tex_source(j, mdef['occlusionTexture']['index'])
                  == tex_source(j, pbr['metallicRoughnessTexture']['index'])))
        if 'occlusionTexture' in mdef and not armed:
            log.append('    ! occlusionTexture on a separate image, ignored')
    elif sg and 'specularGlossinessTexture' in sg:
        # SPEC-GLOSS -> ARM: R none, G = 1 - glossiness, B none. Glossiness is
        # the specularGlossinessTexture's ALPHA — and that is the trap, because
        # `convert('RGBA')` on a texture that HAS no alpha synthesises 255 for
        # it. Inverted, that is roughness 0 on every texel: a mirror. The
        # trestle arrived exactly so (an L-mode PNG), and came out chrome.
        #
        # So the alpha has to be real before it is believed. When it is not,
        # the material's own glossinessFactor is the honest answer and there is
        # no map at all — which is right for this class of asset anyway, since
        # an exporter that dropped the alpha was not storing glossiness there.
        si, arm_name = img_of(sg['specularGlossinessTexture'])
        has_alpha = si.mode in ('RGBA', 'LA', 'PA') and si.convert('RGBA').split()[3].getextrema()[0] < 255
        if has_alpha:
            gl = si.convert('RGBA').split()[3]
            arm_img = Image.merge('RGB', (Image.new('L', si.size, 255),
                                          ImageChops.invert(gl),
                                          Image.new('L', si.size, 0)))
            arm_name += ' (spec-gloss)'
        else:
            log.append('    ! spec-gloss map %s has no alpha channel: glossiness'
                       ' comes from the factor, not the texture' % arm_name)
        armed = False
    if arm_img is not None:
        img, name = arm_img, arm_name
        st = channel_stats(img)
        flat = [st[c][1] - st[c][0] < FLAT for c in range(3)]
        ao_dead = st[0][2] < AO_MIN_MEAN
        use_ao = armed and not flat[0] and not ao_dead
        if armed and ao_dead:
            log.append('    ! arm %s has no AO in R (mean %.3f) - ignored, or it'
                       ' would multiply every ambient term by zero' % (arm_name, st[0][2]))
        if flat[1]:
            out['rough'] = round(out['rough'] * st[1][2], 4)
        if flat[2]:
            out['metal'] = round(out['metal'] * st[2][2], 4)
        out['ao'] = 1.0 if use_ao else 0.0
        if use_ao or not flat[1] or not flat[2]:
            tid, w, h, nb = bank.encode(img, budget, 'arm')
            out['arm'] = tid
            log.append('    arm  %-38s %4dpx %6.1f KB  ao=%s rough=%s metal=%s' % (
                name, w, nb / 1024, 'R' if use_ao else 'off',
                'G' if not flat[1] else out['rough'], 'B' if not flat[2] else out['metal']))
        else:
            log.append('    arm  %-38s FOLDED to rough=%s metal=%s' % (name, out['rough'], out['metal']))

    # NOTHING IN THIS LIBRARY IS A PERFECT MIRROR. A material that comes out of
    # the conversion at roughness 0 with no roughness map to vary it has lost
    # its roughness somewhere, and under a reflection probe it renders as
    # chrome. Say so loudly and clamp it to something a real surface has.
    if out['rough'] < 0.04 and 'arm' not in out:
        log.append('    ! roughness came out %.3f with no map - clamped to 0.4'
                   ' (check the source material)' % out['rough'])
        out['rough'] = 0.4

    if 'normalTexture' in mdef:
        img, name = img_of(mdef['normalTexture'])
        if is_identity_normal(img):
            log.append('    nor  %-38s DROPPED (identity)' % name)
        else:
            tid, w, h, nb = bank.encode(img, budget, 'nor')
            out['nor'] = tid
            out['norScl'] = round(mdef['normalTexture'].get('scale', 1.0), 4)
            log.append('    nor  %-38s %4dpx %6.1f KB' % (name, w, nb / 1024))

    ef = mdef.get('emissiveFactor', [0, 0, 0])
    if 'emissiveTexture' in mdef or any(ef):
        s = (ext.get('KHR_materials_emissive_strength') or {}).get('emissiveStrength', 1.0)
        # The lamp's author asks for 25x, which is a bloom-pipeline number. This
        # renderer has no bloom, so it is clamped to "clearly a lit bulb".
        out['emis'] = [round(min(1.0, c * min(s, 3.0)), 4) for c in ef]
        if 'emissiveTexture' in mdef:
            img, name = img_of(mdef['emissiveTexture'])
            tid, w, h, nb = bank.encode(img, budget, 'diff')
            out['emisMap'] = tid
            log.append('    emis %-38s %4dpx %6.1f KB  x%.1f' % (name, w, nb / 1024, min(s, 3.0)))
    return out


def pack_part(name, verts, tris, bb):
    (x0, y0, z0), (x1, y1, z1) = bb
    sx = 65535 / (x1 - x0) if x1 > x0 else 0
    sy = 65535 / (y1 - y0) if y1 > y0 else 0
    sz = 65535 / (z1 - z0) if z1 > z0 else 0
    us = [v[6] for v in verts]
    vs = [v[7] for v in verts]
    u0, v0 = min(us), min(vs)
    ur = max(us) - u0 or 1.0
    vr = max(vs) - v0 or 1.0
    b = bytearray()
    b += struct.pack('<II', len(verts), len(tris))
    for v in verts:
        b += struct.pack('<hhh',
                         int(round((v[0] - x0) * sx)) - 32768,
                         int(round((v[1] - y0) * sy)) - 32768,
                         int(round((v[2] - z0) * sz)) - 32768)
    for v in verts:
        b += struct.pack('<bbb', *(max(-127, min(127, int(round(v[3 + k] * 127))))
                                   for k in range(3)))
    for v in verts:
        b += struct.pack('<HH',
                         int(round((v[6] - u0) / ur * 65535)),
                         int(round((v[7] - v0) / vr * 65535)))
    for t in tris:
        b += struct.pack('<HHH', *t)
    return {'mat': name, 'nv': len(verts), 'nt': len(tris),
            'uvMin': [round(u0, 6), round(v0, 6)],
            'uvScl': [round(ur, 6), round(vr, 6)],
            'bytes': bytes(b)}      # -> off/len into the prop's bin (main)


def bake(row, bank, log):
    # `dir` lets a table keep `src` as the PROVENANCE key while the files sit
    # somewhere else under SRC_DIR (the pier kit: six sources in one folder)
    path = os.path.join(SRC_DIR, row.get('dir', row['src']), row['file'])
    j, bufs, base = load_gltf(path)
    prims = gather(j, bufs, set(row['mats']) if row['mats'] else None,
                   set(row['nodes']) if row.get('nodes') else None)
    if not prims:
        raise SystemExit('%s: no primitive matched mats=%s' % (row['key'], row['mats']))

    R = rot_matrix(row['rot'])
    s = row['scale']
    lo = [1e30] * 3
    hi = [-1e30] * 3
    posed = []
    for name, pos, nrm, uv, idx in prims:
        P = [apply3(R, (p[0] * s, p[1] * s, p[2] * s)) for p in pos]
        N = [apply3(R, n) for n in nrm]
        for p in P:
            for k in range(3):
                lo[k] = min(lo[k], p[k])
                hi[k] = max(hi[k], p[k])
        posed.append((name, P, N, uv, idx))

    # ORIGIN. Where the prop meets the world, decided once here so no placement
    # site ever has to know that an author exported four metres off centre.
    if row['place'] in ('floor', 'surface'):
        off = (-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2)
    elif row['place'] == 'level':
        # THE AUTHOR'S OWN LEVEL IS KEPT (G254, the pier kit): the modules were
        # registered to one deck in the delivered file — a run's planks and a
        # stair's top tread at the same y, each on piles of its own length —
        # and dropping every module's pile bottoms to zero threw that away.
        # Centre in plan, leave y alone, and the kit still fits itself.
        off = (-(lo[0] + hi[0]) / 2, 0.0, -(lo[2] + hi[2]) / 2)
    else:
        off = (0.0, 0.0, 0.0)
    lo = [lo[k] + off[k] for k in range(3)]
    hi = [hi[k] + off[k] for k in range(3)]
    for k in range(3):                       # a zero-thickness axis breaks quantisation
        if hi[k] - lo[k] < 1e-6:
            lo[k] -= 5e-7
            hi[k] += 5e-7

    by_mat = {}
    for name, P, N, uv, idx in posed:
        vmap, verts, tris = {}, [], []
        cur = by_mat.setdefault(name, ([], [], {}))
        verts, tris, vmap = cur[0], cur[1], cur[2]
        for t in range(0, len(idx) - 2, 3):
            tri = []
            for k in range(3):
                i = idx[t + k]
                p = P[i]
                key = (round(p[0], 6), round(p[1], 6), round(p[2], 6),
                       round(N[i][0], 4), round(N[i][1], 4), round(N[i][2], 4),
                       round(uv[i][0], 6), round(uv[i][1], 6))
                vi = vmap.get(key)
                if vi is None:
                    vi = vmap[key] = len(verts)
                    verts.append((p[0] + off[0], p[1] + off[1], p[2] + off[2],
                                  N[i][0], N[i][1], N[i][2], uv[i][0], uv[i][1]))
                tri.append(vi)
            tris.append(tuple(tri))

    mats, parts, nv_tot, nt_tot = {}, [], 0, 0
    for name in sorted(by_mat):
        verts, tris, _ = by_mat[name]
        # Sketchfab exports carry decorative "edge_color…" materials that own no
        # triangles at all. They are not a part, they are a leftover.
        if not tris:
            log.append('  material %s - EMPTY, skipped' % name)
            continue
        if len(verts) > 65536:
            raise SystemExit('%s/%s: %d verts exceeds the uint16 index range'
                             % (row['key'], name, len(verts)))
        log.append('  material %s - %d verts, %d tris' % (name, len(verts), len(tris)))
        mi = next(i for i, m in enumerate(j['materials'])
                  if m.get('name', 'mat%d' % i) == name)
        mats[name] = bake_material(j, bufs, base, j['materials'][mi], bank, row['tex'], log)
        parts.append(pack_part(name, verts, tris, (lo, hi)))
        nv_tot += len(verts)
        nt_tot += len(tris)

    title, author, lic, url = TABLE.SOURCES[row['src']]
    rec = {
        'key': row['key'], 'group': row['group'], 'label': row['label'],
        'place': row['place'], 'note': row['note'],
        'bb': [round(v, 5) for v in lo + hi],
        'dim': [round(hi[k] - lo[k], 4) for k in range(3)],
        'nv': nv_tot, 'nt': nt_tot,
        'src': {'dir': row['src'], 'title': title, 'author': author,
                'lic': lic, 'url': url},
        'mats': mats, 'parts': parts,
    }
    # WHAT A PLACER NEEDS TO KNOW BEYOND THE BOX (G252). A pier module is
    # placed by its DECK, not by its bounding box: the piles under it go
    # wherever the seabed is and the deck has to land at the water. So a row
    # may name the material its walking surface is made of, and the baker
    # measures where the top of that material sits above the origin. A boat is
    # placed by its WATERLINE, which no exporter records; the row declares the
    # fraction of the hull's height that sits under water and the placer does
    # the subtraction.
    if row.get('deck'):
        pts = [v for name, P, N, uv, idx in posed if name == row['deck']
               for v in P]
        if not pts:
            raise SystemExit('%s: deck material %s owns no vertices'
                             % (row['key'], row['deck']))
        # THE WALKING LEVEL AT EACH END, not the highest plank: a module joins
        # the path at its ends, and a stair module's two ends are 1.4 m apart.
        # The level is the MODE of the top surface within 0.15 m of the end
        # (a rail cap or a kerb is a few vertices; the deck is thousands).
        zs = [v[2] for v in pts]
        z0, z1 = min(zs), max(zs)

        def level(sel):
            ys = sorted(round(v[1], 2) for v in sel)
            top = ys[int(len(ys) * 0.6):]
            best, n = None, 0
            for y in set(top):
                c = top.count(y)
                if c > n:
                    best, n = y, c
            return best
        rec['deck'] = [round(level([v for v in pts if v[2] < z0 + 0.15]) + off[1], 3),
                       round(level([v for v in pts if v[2] > z1 - 0.15]) + off[1], 3)]
        # AND HOW FAR THE DECK RUNS (G254.1, the user: "there seem to be a
        # little part reserved for overlapping each model cleanly"). The box
        # is not the module: a run's bearer and piles stand 0.46 m past its
        # last plank, to go UNDER the first bay of the next run. So the pitch
        # a path is laid at is the DECK's length, and the deck's extent in the
        # module's own frame is published beside its levels.
        rec['deckZ'] = [round(z0 + off[2], 3), round(z1 + off[2], 3)]
    if row.get('float') is not None:
        rec['float'] = row['float']
    return rec


# THE RUNNER TAKES ITS TABLE (G252). The hangar props and the pier kit are
# the same pipeline — declared table, as-is geometry, the one material — but
# they are not the same LIBRARY: the pier's packs must not be swept into the
# hangar's registry (GATE HANGAR requires every hangar prop claimed by a kit),
# and its media must prune its own directories and nobody else's. So the
# module-level names are the hangar's defaults and run() takes a config.
PROPS_CFG = dict(table=None, src_dir=None, out_dir=None, geo='geo/props',
                 tex='tex/props', prefix='props_', packs='props_packs.json',
                 origin='assets/props/, per the declared table in tools/props_table.py')


def main(argv, cfg=None):
    global TABLE, SRC_DIR, OUT_DIR
    cfg = dict(PROPS_CFG, **(cfg or {}))
    if cfg['table'] is not None:
        TABLE = cfg['table']
    if cfg['src_dir'] is not None:
        SRC_DIR = cfg['src_dir']
    if cfg['out_dir'] is not None:
        OUT_DIR = cfg['out_dir']
    only = [a for a in argv if not a.startswith('--')]
    report = '--report' in argv
    rows = [r for r in TABLE.PROPS if not only or r['key'] in only]
    if only and len(rows) != len(only):
        raise SystemExit('unknown key(s): %s' % (set(only) - {r['key'] for r in rows}))
    if not report and only and len(rows) != len(TABLE.PROPS):
        raise SystemExit('a partial bake would rewrite a whole group pack with '
                         'only part of it in — bake the whole table, or pass '
                         '--report to look at one row')

    os.makedirs(OUT_DIR, exist_ok=True)
    groups = {}
    total_geo = 0
    for row in rows:
        bank_key = row['group']
        bank = groups.setdefault(bank_key, {'bank': TexBank(write=not report,
                                                                 sub=cfg['tex']),
                                            'props': {}, 'order': []})['bank']
        log = []
        p = bake(row, bank, log)
        geo = sum(len(x['bytes']) for x in p['parts'])
        total_geo += geo
        print('%-18s %-9s %6d tris  %5.2f x %5.2f x %5.2f m  geo %6.1f KB'
              % (p['key'], p['group'], p['nt'], *p['dim'], geo / 1024))
        for l in log:
            print(l)
        groups[bank_key]['props'][p['key']] = p
        groups[bank_key]['order'].append(p['key'])
    if report:
        return

    # ONE bin per prop (media/geo/props/<key>.<h8>.bin): the parts' bytes back
    # to back, each named by off/len in the pack. The pack .js is a slim
    # manifest — no base64 anywhere in it. jodel_prep.py writes its airframe
    # bins to media/geo/airframe/, so this directory is wholly ours to prune.
    bin_rels = []
    for g in groups.values():
        for pkey, p in g['props'].items():
            buf = bytearray()
            for part in p['parts']:
                raw = part.pop('bytes')
                part['off'] = len(buf)
                part['len'] = len(raw)
                buf += raw
            p['bin'] = write_media(cfg['geo'], pkey, 'bin', bytes(buf))
            bin_rels.append(p['bin'])
    prune_media(cfg['geo'], bin_rels)

    files, tex_bytes = [], 0
    for gid, gname in TABLE.GROUPS:
        if gid not in groups:
            continue
        g = groups[gid]
        pack = {'v': 2, 'groups': [[gid, gname]], 'order': g['order'],
                'texs': {h: g['bank'].by_hash[h] for h in g['bank'].order},
                'props': g['props']}
        name = '%s%s.js' % (cfg['prefix'], gid)
        body = ('// GENERATED FILE - DO NOT EDIT. Built by tools/prop_prep.py from\n'
                '// %s.\n'
                '// Group: %s. Decoded by src/core/51_prop_codec.js; geometry in\n'
                '// media/%s/ (per-prop bin, parts carry off/len), textures\n'
                '// in media/%s/. B re-roots the media paths for pages that\n'
                '// do not live at flyDiy/ (see tools/_media_lib.js).\n'
                'registerPropPack((p => {\n'
                '  %s\n'
                '  for (const k in p.texs) p.texs[k] = B + p.texs[k];\n'
                '  for (const k in p.props) if (p.props[k].bin) '
                'p.props[k].bin = B + p.props[k].bin;\n'
                '  return p;\n'
                '})(%s));\n'
                % (cfg['origin'], gname, cfg['geo'], cfg['tex'], BASE_DECL,
                   json.dumps(pack, separators=(',', ':'))))
        open(os.path.join(OUT_DIR, name), 'w', encoding='utf8').write(body)
        files.append(name)
        tex_bytes += g['bank'].bytes
        print('%-22s %2d props  %7.2f MB' % (name, len(g['order']), len(body) / 1048576))
    # KEEP THE PACKS THIS BAKER DOES NOT OWN (G62.11). The manifest is shared:
    # tools/jodel_prep.py writes props_airframe.js into the same directory and
    # the same list. Rewriting it wholesale silently dropped that pack out of
    # the build — index.html shrank by 2 MB and GATE PROPS caught it, which is
    # the only reason it was noticed. Anything already listed that is still on
    # disk and is not ours stays, in its existing position.
    mf = os.path.join(OUT_DIR, cfg['packs'])
    try:
        prev = json.load(open(mf))
    except Exception:
        prev = []
    foreign = [f for f in prev if f not in files
               and os.path.exists(os.path.join(OUT_DIR, f))]
    json.dump(files + foreign, open(mf, 'w'), indent=1)
    if foreign:
        print('kept %d pack(s) from another baker: %s' % (len(foreign), ', '.join(foreign)))
    # a full bake is the whole texture story for media/tex/props/ — anything
    # this run did not emit is a stale map from a superseded encode
    gone = prune_media(cfg['tex'],
                       [g['bank'].by_hash[h] for g in groups.values()
                        for h in g['bank'].order])
    if gone:
        print('pruned %d stale map(s) from media/%s/' % (len(gone), cfg['tex']))
    print('---\n%d props, %d packs — geometry %.2f MB, textures %.2f MB'
          % (len(rows), len(files), total_geo / 1048576, tex_bytes / 1048576))


if __name__ == '__main__':
    main(sys.argv[1:])
