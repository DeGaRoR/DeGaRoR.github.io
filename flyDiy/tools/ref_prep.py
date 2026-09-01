#!/usr/bin/env python3
"""ref_prep.py — bake a delivered GLB into a REFERENCE-ONLY model payload.

Usage:
  python tools/ref_prep.py <key> [<key> ...]     rows from tools/ref_table.py
  python tools/ref_prep.py --all
  python tools/ref_prep.py --all --dry           measure, write nothing

Writes src/models/<key>_model.js, in the same container decodeModel() already
reads (src/core/50_model_codec.js). Requires Pillow only for the PBR fold.

WHAT THIS IS NOT.
It is not a second model_prep.py. model_prep bakes an aeroplane you can FLY:
named control surfaces, fitted hinge lines, a per-vertex sid tag, a propeller
hub, a wing band bound to the spar — all of it identified by hand, node by
node, off a contact sheet. A reference aeroplane has none of that. refplane.js
builds it rigid, never writes a vertex, and GATE REF asserts it can never
reach the spec. So the payload it needs carries geometry, materials and
textures and nothing else, and the bake needs no per-node table at all:

  GROUPS ARE THE SOURCE'S OWN MATERIALS. A reference is drawn, not driven, so
  the only division that has to survive is the one that decides what colour a
  triangle is. That is exactly what a glTF material is, and it means a new
  aeroplane is a five-line row rather than an afternoon with a contact sheet.

GEOMETRY IS CARRIED THROUGH UNTOUCHED — no decimation, no welding, no
dropping of parts you cannot see from outside ([[import-models-as-is]]). The
one transformation is the axis change, and it is declared per row.

THE ONE THING THAT IS CUT, and it is a container limit rather than a choice:
the payload indexes with uint16, so a material with more than 65535 vertices
is split across several groups (`skin`, `skin__2`, ...). Every chunk names the
same `mat`, so the viewer still builds ONE material for them and the split is
invisible. No triangle is lost and no vertex is merged; the chunker walks
triangles in source order and starts a new group when the next one would not
fit.
"""
import base64, io, importlib, json, os, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from glb_inspect import load, accessor, walk, xform, view_bytes  # noqa: E402

MAXV = 65535                     # uint16 indices: the container's own ceiling


# ---------------------------------------------------------------- the axes --
# Declared per row rather than assumed, because getting it wrong is invisible
# in the two views where you would look for it. Every entry must have
# determinant +1: a basis that flips handedness mirrors the aeroplane, and the
# tell-tale — a backwards registration on the fuselage — is the sort of thing
# that survives a whole session.
#
#   'xaft'  the FlightGear frame, which IS flyDiy's model frame: x aft, y up,
#           z left. helijah's exports arrive in it, so the map is the identity.
#           (Verified per model, not assumed: the propeller sits at x minimum
#           on all seven, and the taildraggers' tailwheels at x maximum.)
#   'znose' the Sketchfab/Blender default the C172 arrived in: x left, y up,
#           z nose. Kept here because tools/glb_extract.py uses it and the two
#           tools must not disagree about what a frame is called.
AXES = {
    'xaft':  lambda p, s: (p[0] * s, p[1] * s, p[2] * s),
    'znose': lambda p, s: (-p[2] * s, p[1] * s, p[0] * s),
}

# ---------------------------------------------------------------- the origin --
# `off` is a translation in MODEL-FRAME METRES, applied after the axis map.
# Almost every row needs (0,0,0), and that is not luck — it is a property of
# the frame these models are drawn in.
#
# THE ONE THING THAT IS NOT NEGOTIABLE IS z. The aeroplane's plane of symmetry
# must be z = 0, because the half-and-half comparison cuts there, the panel's
# lateral slider measures from there, and "span" is |z| doubled. Every payload
# in the set is symmetric about z to the last decimal place (0.0000 asym on all
# nine of the first batch) — so an aeroplane that is NOT is a translated frame,
# not a strange aeroplane, and GATE REF says so rather than letting it stand
# half a wingspan to one side.
#
# x is centred for a milder reason: the reference appears at the room origin
# with `fore` at 0, and a frame whose origin is at the spinner puts the whole
# aeroplane three metres behind the build until you drag it back.
#
# y IS LEFT AS DELIVERED, deliberately. Nothing reads it: the sit is computed
# from the lower hull at the declared pitch, so wherever the origin sits
# vertically the aeroplane still lands on the floor. It only moves the pitch
# PIVOT, which at a taildragger's ten degrees is a couple of hundred mm of
# fore/aft that the `fore` slider covers. Inventing a y datum these models do
# not agree on would be a number that means nothing.
def offset_of(row):
    o = row.get('off') or (0.0, 0.0, 0.0)
    return (float(o[0]), float(o[1]), float(o[2]))


def ident(name):
    """A glTF material name as a JS object key: 'DefaultWhite_a65.png' ->
    'DefaultWhite_a65_png'. Collisions are an error, not a silent merge."""
    out = ''.join(c if (c.isalnum() or c == '_') else '_' for c in name)
    return ('m_' + out) if (not out or out[0].isdigit()) else out


# --------------------------------------------------------------- materials --
def srgb(u):
    """glTF baseColorFactor is LINEAR; THREE r128's Color.setHex() is read as
    sRGB under the renderer's sRGB output encoding. Converting here is what
    keeps a declared grey the grey the modeller chose."""
    u = max(0.0, min(1.0, float(u)))
    v = 12.92 * u if u <= 0.0031308 else 1.055 * (u ** (1 / 2.4)) - 0.055
    return int(round(v * 255))


FLAT_MR = 1.5      # per-channel stdev (0..255) below which a metalRough is constant


def image_bytes(j, bin_, ti):
    src = j['textures'][ti].get('source')
    img = j['images'][src]
    if 'bufferView' not in img:
        return None, None
    raw, _ = view_bytes(j, bin_, img['bufferView'])
    ext = 'png' if img.get('mimeType', '').endswith('png') else 'jpg'
    return bytes(raw), ext


def read_material(j, bin_, m, key, texs, want_tex, cost):
    """One payload `mats` record, plus any texture it brings with it.

    THE LIVERY IS OPTIONAL, AND BY DEFAULT IT IS DECLINED (`tex='none'`).
    This is the one place a reference payload is deliberately less than what
    was delivered, so here is the whole reasoning:

      * refplane.js opens in WHITE CLAY, and says why in its own comment —
        "the point of a reference is its SHAPE, and a livery is the thing most
        likely to stop you seeing it". The maps are only ever sampled in the
        `as authored` mode, and an untextured payload still has that mode: the
        materials keep their authored flat colour, roughness, metalness and
        opacity, so the glazing is still glazing and the tyres are still black.
      * they are expensive out of all proportion. helijah's models are PNG,
        and the base-colour maps are three quarters of the payload — 5.5 MB of
        the three published aeroplanes' 8 MB of source. Most of that is a
        cockpit no one can see from beside the aeroplane.
      * and the artifact is a SINGLE FILE with a hard ceiling on it. The
        reference is the feature that found the ceiling; it should not also be
        the feature that spends the last of it on instrument dials.

    This is NOT the same thing as re-encoding someone's atlas
    ([[import-models-as-is]]): nothing is resampled, recompressed or degraded.
    A map is either carried byte-for-byte (`tex='copy'`) or not carried. The
    cost of carrying it is printed either way, so turning one back on is an
    informed decision rather than a hopeful one.

    A metalRough map whose channels are constant says exactly what its two
    scalars already say, and a flat normal map says nothing at all; both are
    FOLDED rather than embedded, which is glb_extract.py's rule and the same
    thresholds.
    """
    from PIL import Image, ImageStat
    p = m.get('pbrMetallicRoughness', {})
    c = p.get('baseColorFactor', [1, 1, 1, 1])
    rec = {'rough': round(float(p.get('roughnessFactor', 1.0)), 4),
           'metal': round(float(p.get('metallicFactor', 1.0)), 4)}
    bt = p.get('baseColorTexture')
    if bt:
        raw, ext = image_bytes(j, bin_, bt['index'])
        if raw:
            cost[0] += len(raw)
            if want_tex:
                mime = 'image/png' if ext == 'png' else 'image/jpeg'
                texs[key] = ('data:%s;base64,%s' % (mime, base64.b64encode(raw).decode()),
                             len(raw))
                rec['tex'] = key
    if 'tex' not in rec:
        rec['color'] = (srgb(c[0]) << 16) | (srgb(c[1]) << 8) | srgb(c[2])
    if m.get('alphaMode', 'OPAQUE') != 'OPAQUE' or c[3] < 1:
        rec['opacity'] = round(float(c[3]), 4)
    # fold the constant data maps into the scalars they already are
    mrt = p.get('metallicRoughnessTexture')
    if mrt:
        raw, _ = image_bytes(j, bin_, mrt['index'])
        if raw:
            st = ImageStat.Stat(Image.open(io.BytesIO(raw)).convert('RGB'))
            if max(st.stddev[1], st.stddev[2]) < FLAT_MR:
                rec['rough'] = round(rec['rough'] * st.mean[1] / 255.0, 4)
                rec['metal'] = round(rec['metal'] * st.mean[2] / 255.0, 4)
            # a metalRough with real structure is simply NOT carried: a
            # reference is looked at in clay, and a roughness map is the last
            # thing that would change what you see. The scalars stand.
    return rec


# ---------------------------------------------------------------- geometry --
def gather(j, bin_, axes, scale, off=(0.0, 0.0, 0.0)):
    """{material name: [(pos, uv, tris), ...]} in the model frame, world-space
    node transforms already composed down the scene graph."""
    conv = AXES[axes]
    ox, oy, oz = off
    out = {}
    for idx, n, w, path in walk(j):
        if 'mesh' not in n:
            continue
        for prim in j['meshes'][n['mesh']]['primitives']:
            a = prim['attributes']
            pos = [conv(xform(w, q), scale) for q in accessor(j, bin_, a['POSITION'])]
            if ox or oy or oz:
                pos = [(p[0] + ox, p[1] + oy, p[2] + oz) for p in pos]
            if 'TEXCOORD_0' in a:
                uv = [(u, 1.0 - v) for u, v in accessor(j, bin_, a['TEXCOORD_0'])]
            else:
                uv = [(0.0, 0.0)] * len(pos)     # untextured: the map is never read
            ids = (accessor(j, bin_, prim['indices']) if 'indices' in prim
                   else list(range(len(pos))))
            tris = [(ids[i], ids[i + 1], ids[i + 2])
                    for i in range(0, len(ids) - 2, 3)]
            mat = (j['materials'][prim['material']]['name']
                   if 'material' in prim else 'default')
            out.setdefault(mat, []).append((pos, uv, tris))
    return out


def chunk(prims):
    """Split one material's primitives into groups of at most MAXV vertices.

    Walks triangles in source order with a local vertex map and opens a new
    chunk when the next triangle would not fit. Nothing is dropped and nothing
    is welded — a vertex used by triangles either side of a boundary is simply
    written into both chunks, which is what the uint16 index demands.
    """
    chunks, cv, cu, ct, vmap = [], [], [], [], {}

    def flush():
        if ct:
            chunks.append((cv[:], cu[:], ct[:]))

    for pi, (pos, uv, tris) in enumerate(prims):
        for t in tris:
            if any(i >= len(pos) for i in t):
                continue                       # malformed index: not ours to fix
            need = sum(1 for i in t if (pi, i) not in vmap)
            if len(cv) + need > MAXV:
                flush()
                cv, cu, ct, vmap = [], [], [], {}
            loc = []
            for i in t:
                k = (pi, i)
                if k not in vmap:
                    vmap[k] = len(cv)
                    cv.append(pos[i]); cu.append(uv[i])
                loc.append(vmap[k])
            ct.append(tuple(loc))
    flush()
    return chunks


def encode(cv, cu, ct, bb):
    (x0, y0, z0), (x1, y1, z1) = bb
    sx = 65535 / (x1 - x0); sy = 65535 / (y1 - y0); sz = 65535 / (z1 - z0)
    buf = io.BytesIO()
    buf.write(struct.pack('<II', len(cv), len(ct)))
    for x, y, z in cv:
        buf.write(struct.pack('<3h', int((x - x0) * sx) - 32768,
                                     int((y - y0) * sy) - 32768,
                                     int((z - z0) * sz) - 32768))
    for u, v in cu:
        buf.write(struct.pack('<2H', round(min(max(u, 0.0), 1.0) * 65535),
                                     round(min(max(v, 0.0), 1.0) * 65535)))
    for t in ct:
        buf.write(struct.pack('<3H', *t))
    return base64.b64encode(buf.getvalue()).decode()


# -------------------------------------------------------------------- bake --
def bake(row, dry=False):
    key = row['key']
    glb = os.path.join(ROOT, row['glb'])
    j, bin_ = load(glb)
    off = offset_of(row)
    bym = gather(j, bin_, row['axes'], row.get('scale', 1.0), off)

    lo = [min(p[a] for prims in bym.values() for pos, _, _ in prims for p in pos)
          for a in range(3)]
    hi = [max(p[a] for prims in bym.values() for pos, _, _ in prims for p in pos)
          for a in range(3)]
    bb = (tuple(lo), tuple(hi))

    matdefs = {m.get('name', '?'): m for m in j.get('materials', [])}
    want_tex = row.get('tex', 'none') == 'copy'
    cost = [0]                       # what the liveries WOULD cost, reported either way
    texs, mats, groups = {}, {}, []
    nv_tot = nt_tot = nt_src = 0
    for name in sorted(bym, key=lambda n: -sum(len(t) for _, _, t in bym[n])):
        mk = ident(name)
        if mk in mats:
            sys.exit(f'{key}: material key collision on {mk} (from {name})')
        mats[mk] = read_material(j, bin_, matdefs.get(name, {}), mk, texs,
                                 want_tex, cost)
        nt_src += sum(len(t) for _, _, t in bym[name])
        for i, (cv, cu, ct) in enumerate(chunk(bym[name])):
            gname = mk if i == 0 else f'{mk}__{i + 1}'
            groups.append((gname, mk, len(cv), len(ct), encode(cv, cu, ct, bb)))
            nv_tot += len(cv); nt_tot += len(ct)
    if nt_tot != nt_src:
        sys.exit(f'{key}: chunker lost triangles ({nt_src} in, {nt_tot} out)')

    gjs = ','.join('%s:{nv:%d,nt:%d,sid:0,mat:"%s",b64:"%s"}' % (g, nv, nt, mk, b)
                   for g, mk, nv, nt, b in groups)
    mjs = ','.join('%s:{%s}' % (mk, ','.join(
        (f'tex:"{r["tex"]}"' if k == 'tex' else
         f'color:0x{r["color"]:06x}' if k == 'color' else f'{k}:{r[k]}')
        for k in ('tex', 'color', 'opacity', 'rough', 'metal') if k in r))
        for mk, r in mats.items())
    tjs = ',\n  '.join(f'{m}:"{uri}"' for m, (uri, _) in texs.items())
    bbjs = '[' + ','.join(f'{v:.4f}' for v in lo + hi) + ']'
    credit = (f'"{row["title"]}" by {row["author"]}, {row["lic"]}; {row["url"]} '
              f'— baked by tools/ref_prep.py, geometry as delivered'
              + ('' if want_tex else ', base-colour maps declined (see the tool)'))

    body = (
        '// generated by tools/ref_prep.py — do not edit\n'
        f'// source: {credit}\n'
        '// REFERENCE ONLY: no control surfaces, no propeller hub, no skin\n'
        '//   binding. This payload is never flown — it stands beside the\n'
        '//   build in the garage (src/viewer/refplane.js).\n'
        # json.dumps, not an f-string quote: a title with an apostrophe (the
        # RV-8's) or the quotes the credit line puts round it would otherwise
        # close the JS string and the payload would not parse.
        f'const MODEL_{key.upper()} = {{ v:4, ref:1, lic:{json.dumps(row["lic"])},\n'
        f'  credit:{json.dumps(credit)},\n'
        f'  bb:{bbjs},\n'
        f'  mats:{{{mjs}}},\n'
        f'  texs:{{{tjs}}},\n'
        f'  groups:{{{gjs}}} }};\n'
        f"if (typeof module !== 'undefined') module.exports = {{ MODEL_{key.upper()} }};\n")

    out = os.path.join(ROOT, 'src', 'models', f'{key}_model.js')
    if not dry:
        with open(out, 'w', newline='\n') as f:
            f.write(body)
    texb = sum(n for _, n in texs.values())
    print(f'{key:8} {len(groups):3} groups ({len(mats)} materials) '
          f'{nv_tot:>7} verts {nt_tot:>7} tris · '
          + (f'{len(texs)} textures {texb // 1024} KB · ' if want_tex else
             f'no maps (the liveries would add {cost[0] // 1024} KB, '
             f'{int(cost[0] * 4 / 3) // 1024} KB base64) · ') +
          f'span {hi[2]-lo[2]:.3f} length {hi[0]-lo[0]:.3f} '
          f'height {hi[1]-lo[1]:.3f} m · minY {lo[1]:.4f} · '
          f'{len(body) // 1024} KB {"(dry)" if dry else "-> " + os.path.relpath(out, ROOT)}')
    return len(body)


def main(argv):
    T = importlib.import_module('ref_table')
    dry = '--dry' in argv
    keys = ([k for k in argv if not k.startswith('--')] if '--all' not in argv
            else list(T.REF_MODELS))
    if not keys:
        sys.exit(__doc__)
    total = 0
    for k in keys:
        if k not in T.REF_MODELS:
            sys.exit(f'no row `{k}` in tools/ref_table.py')
        total += bake(T.REF_MODELS[k], dry)
    print(f'{len(keys)} payload(s), {total // 1024} KB of source in total')
    licences = sorted({T.REF_MODELS[k]['lic'] for k in keys})
    print('licences: ' + ', '.join(licences))


if __name__ == '__main__':
    main(sys.argv[1:])
