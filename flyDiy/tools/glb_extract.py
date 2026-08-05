#!/usr/bin/env python3
"""glb_extract.py — GLB → OBJ + MTL + textures, in flyDiy model-frame axes.

The GLB branch of docs/MODEL-IMPORT-PROC.md Step 0/1. Sketchfab exports carry
mangled object names, glTF axes and (often) staging props, so this tool does
the four things the OBJ path gets for free:

  * axis + scale convert to the target model frame  (x aft, y up, z left,
    true metres) — glTF is y up / +z nose / +x left;
  * name the parts from a hand-built table keyed on node index, identified
    with tools/glb_render.py contact sheets;
  * drop staging geometry (parking ribbons, tie-down anchors, chocks);
  * split meshes that fuse a left/right pair, and mirror a side the source
    left out, so each control surface is its own object as Step 1 requires.

Geometry is otherwise carried through UNTOUCHED — no decimation, no welding,
no clipping. A detailed model is meant to arrive detailed; payload size is
handled at load time, not by throwing triangles away. (This tool did decimate
briefly; it was wrong and the capability was removed rather than left lying
around to be switched back on.)

Output feeds the unchanged OBJ pipeline: model_inspect.py measures it,
model_prep.py bakes it.

Usage:
  python tools/glb_extract.py <key>            # config: tools/models/<key>_src.py
"""
import importlib, io, json, os, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from glb_inspect import load, accessor, walk, xform  # noqa: E402


# ---------------------------------------------------------------- geometry --
def to_model_frame(p, s):
    """glTF (x left, y up, z nose) -> model frame (x aft, y up, z left) * scale.

    det = +1, so the basis stays proper — a mirrored livery would be the
    tell-tale of getting this wrong.
    """
    return (-p[2] * s, p[1] * s, p[0] * s)


def mirror_x(verts, tris):
    """Mirror about the model-frame x axis plane (z -> -z, i.e. left <-> right)
    and flip winding so normals stay outward."""
    return ([(p[0], p[1], -p[2]) for p in verts],
            [(t[2], t[1], t[0]) for t in tris])


# ------------------------------------------------------------------- parts --
def read_prim(j, bin_, prim, w, s):
    pos = [to_model_frame(xform(w, p), s)
           for p in accessor(j, bin_, prim['attributes']['POSITION'])]
    uv = accessor(j, bin_, prim['attributes']['TEXCOORD_0'])
    uv = [(u, 1.0 - v) for u, v in uv]          # glTF uv origin is top-left
    ids = (accessor(j, bin_, prim['indices']) if 'indices' in prim
           else list(range(len(pos))))
    tris = [(ids[i], ids[i + 1], ids[i + 2]) for i in range(0, len(ids) - 2, 3)]
    return pos, uv, tris


def split_lr(verts, tris):
    """Split a fused left/right object by the sign of the triangle centroid z
    (model frame: +z is LEFT). Returns (left_tris, right_tris)."""
    L, R = [], []
    for t in tris:
        zc = sum(verts[i][2] for i in t) / 3
        (L if zc > 0 else R).append(t)
    return L, R


def compact(verts, uvs, tris):
    """Drop unreferenced vertices and reindex (pos and uv stay parallel)."""
    m = {}
    for t in tris:
        for i in t:
            m.setdefault(i, len(m))
    V = [None] * len(m); U = [None] * len(m)
    for old, new in m.items():
        V[new] = verts[old]; U[new] = uvs[old]
    return V, U, [tuple(m[i] for i in t) for t in tris]


# ----------------------------------------------------------------- writing --
def dump_textures(j, bin_, outdir, mats_used):
    """Write every base-colour image referenced by a used material. Returns
    {gltf material name: filename}."""
    from glb_inspect import view_bytes
    files = {}
    for m in j.get('materials', []):
        name = m.get('name', '?')
        if name not in mats_used:
            continue
        pbr = m.get('pbrMetallicRoughness', {})
        if 'baseColorTexture' not in pbr:
            continue
        src = j['textures'][pbr['baseColorTexture']['index']].get('source')
        img = j['images'][src]
        raw, _ = view_bytes(j, bin_, img['bufferView'])
        ext = 'png' if img.get('mimeType', '').endswith('png') else 'jpg'
        fn = f'{name.replace(".", "_")}.{ext}'
        with open(os.path.join(outdir, fn), 'wb') as f:
            f.write(raw)
        files[name] = fn
    return files


# glTF materials ARE PBR: metallic/roughness factors, a packed metalRough map
# (G = roughness, B = metalness), a normal map and an emissive map. The OBJ/MTL
# intermediate cannot express any of that, so it travels beside the OBJ in a
# sidecar keyed by glTF material name — which is also the OBJ's usemtl name, so
# the bake can resolve it without a line of per-material config.
#
# Maps that carry no signal are FOLDED, not written. A metalRough map whose
# channels are constant says exactly what its two scalars already say, and a
# normal map at a flat (128,128,255) says nothing at all; this model ships four
# of the former and one of the latter. Folding costs nothing and keeps ~1.5 MB
# of solid colour out of the artifact. The thresholds are deliberately tight —
# anything with visible structure survives.
FLAT_MR = 1.5      # per-channel stdev (0..255) below which a metalRough is constant
FLAT_NRM = 2.0     # ... and below which a normal map is the identity normal


def _image(j, bin_, ti):
    """(PIL image, raw bytes, extension) for texture index ti."""
    from glb_inspect import view_bytes
    from PIL import Image
    src = j['textures'][ti].get('source')
    img = j['images'][src]
    raw, _ = view_bytes(j, bin_, img['bufferView'])
    ext = 'png' if img.get('mimeType', '').endswith('png') else 'jpg'
    return Image.open(io.BytesIO(bytes(raw))), bytes(raw), ext


def dump_pbr(j, bin_, outdir, mats_used, texfiles):
    """Write pbr.json (+ any metalRough/normal images worth keeping)."""
    from PIL import ImageStat
    out, notes = {}, []
    for m in j.get('materials', []):
        name = m.get('name', '?')
        if name not in mats_used:
            continue
        p = m.get('pbrMetallicRoughness', {})
        rec = {'metal': round(float(p.get('metallicFactor', 1.0)), 4),
               'rough': round(float(p.get('roughnessFactor', 1.0)), 4)}
        def grab(tex, kind, flat_eps, chans):
            if not tex:
                return None
            img, raw, ext = _image(j, bin_, tex['index'])
            st = ImageStat.Stat(img.convert('RGB'))
            if max(st.stddev[c] for c in chans) < flat_eps:
                return ('flat', [st.mean[c] / 255.0 for c in range(3)])
            fn = f'{name.replace(".", "_")}_{kind}.{ext}'
            with open(os.path.join(outdir, fn), 'wb') as f:
                f.write(raw)
            return ('file', fn, round(max(st.stddev), 1))
        mr = grab(p.get('metallicRoughnessTexture'), 'mr', FLAT_MR, (1, 2))
        if mr and mr[0] == 'flat':
            # constant map: multiply it into the factors and drop the file
            rec['rough'] = round(rec['rough'] * mr[1][1], 4)
            rec['metal'] = round(rec['metal'] * mr[1][2], 4)
            notes.append(f'{name}: mr folded -> r{rec["rough"]:.3f} m{rec["metal"]:.3f}')
        elif mr:
            rec['mr'] = mr[1]
            notes.append(f'{name}: mr {mr[1]} (sd {mr[2]})')
        nrm = grab(m.get('normalTexture'), 'nrm', FLAT_NRM, (0, 1))
        if nrm and nrm[0] == 'flat':
            notes.append(f'{name}: normal is identity, dropped')
        elif nrm:
            rec['nrm'] = nrm[1]
            sc = (m.get('normalTexture') or {}).get('scale')
            if sc is not None:
                rec['nrmScale'] = round(float(sc), 4)
            notes.append(f'{name}: nrm {nrm[1]} (sd {nrm[2]})')
        # Emissive: on this model every emissive map IS the base-colour map, so
        # it costs nothing to carry — record the fact and let the bake reuse the
        # texture it already has rather than embedding the same bytes twice.
        et = m.get('emissiveTexture')
        if et:
            same = (et['index'] == p.get('baseColorTexture', {}).get('index'))
            rec['emis'] = m.get('emissiveFactor', [1, 1, 1])
            if same:
                rec['emisIsBase'] = True
            else:
                _, raw, ext = _image(j, bin_, et['index'])
                fn = f'{name.replace(".", "_")}_em.{ext}'
                with open(os.path.join(outdir, fn), 'wb') as f:
                    f.write(raw)
                rec['emisTex'] = fn
            notes.append(f'{name}: emissive{" (= base map)" if same else ""}')
        out[name] = rec
    with open(os.path.join(outdir, 'pbr.json'), 'w', newline='\n') as f:
        json.dump(out, f, indent=1, sort_keys=True)
    return out, notes


def write_mtl(path, j, mats_used, texfiles):
    with open(path, 'w', newline='\n') as f:
        f.write('# generated by tools/glb_extract.py\n')
        for m in j.get('materials', []):
            name = m.get('name', '?')
            if name not in mats_used:
                continue
            pbr = m.get('pbrMetallicRoughness', {})
            c = pbr.get('baseColorFactor', [0.8, 0.8, 0.8, 1])
            f.write(f'newmtl {name}\n')
            f.write(f'Kd {c[0]:.4f} {c[1]:.4f} {c[2]:.4f}\n')
            if c[3] < 1:
                f.write(f'd {c[3]:.4f}\n')
            if name in texfiles:
                f.write(f'map_Kd {texfiles[name]}\n')
            f.write('\n')


def write_obj(path, mtlname, parts):
    """parts = [(objname, matname, verts, uvs, tris)] — written with a shared
    v/vt pool, one `o` block per part (what model_inspect/model_prep parse)."""
    vbase = ubase = 1
    with open(path, 'w', newline='\n') as f:
        f.write('# generated by tools/glb_extract.py — do not edit\n')
        f.write(f'mtllib {mtlname}\n')
        for name, mat, V, U, T in parts:
            f.write(f'o {name}\n')
            for p in V:
                f.write(f'v {p[0]:.5f} {p[1]:.5f} {p[2]:.5f}\n')
            for u in U:
                f.write(f'vt {u[0]:.6f} {u[1]:.6f}\n')
            f.write(f'usemtl {mat}\n')
            for t in T:
                f.write('f ' + ' '.join(f'{i+vbase}/{i+ubase}' for i in t) + '\n')
            vbase += len(V); ubase += len(U)


# -------------------------------------------------------------------- main --
def main(key):
    sys.path.insert(0, os.path.join(HERE, 'models'))
    SRC = importlib.import_module(key + '_src').SRC
    glb = os.path.join(ROOT, SRC['glb'])
    outdir = os.path.join(ROOT, SRC['out'])
    os.makedirs(outdir, exist_ok=True)
    s = SRC['scale']

    j, bin_ = load(glb)
    bynode = {}
    for idx, n, w, path in walk(j):
        if 'mesh' in n:
            bynode[idx] = (n, w)

    parts, mats_used, skipped = [], set(), []
    tri_in = tri_out = 0
    for idx, spec in SRC['parts'].items():
        if idx not in bynode:
            sys.exit(f'node {idx} in the parts table has no mesh')
        n, w = bynode[idx]
        prim = j['meshes'][n['mesh']]['primitives'][0]
        mat = j['materials'][prim['material']]['name'] if 'material' in prim else 'default'
        if spec.get('skip'):
            skipped.append((idx, spec.get('name', mat)))
            continue
        V, U, T = read_prim(j, bin_, prim, w, s)
        tri_in += len(T)
        mats_used.add(mat)
        pieces = []
        if spec.get('split'):
            L, R = split_lr(V, T)
            pieces.append((spec['name'] + 'G', V, U, L))
            pieces.append((spec['name'] + 'D', V, U, R))
        else:
            pieces.append((spec['name'], V, U, T))
        if spec.get('mirror'):
            MV, MT = mirror_x(V, T)
            pieces.append((spec['mirror'], MV, U, MT))
        for pname, pv, pu, pt in pieces:
            cv, cu, ct = compact(pv, pu, pt)
            tri_out += len(ct)
            parts.append((pname, mat, cv, cu, ct))

    texfiles = dump_textures(j, bin_, outdir, mats_used)
    pbr, pbrnotes = dump_pbr(j, bin_, outdir, mats_used, texfiles)
    mtl = SRC['obj'].rsplit('.', 1)[0] + '.mtl'
    write_mtl(os.path.join(outdir, mtl), j, mats_used, texfiles)
    write_obj(os.path.join(outdir, SRC['obj']), mtl, parts)

    lo = [min(p[a] for _, _, V, _, _ in parts for p in V) for a in range(3)]
    hi = [max(p[a] for _, _, V, _, _ in parts for p in V) for a in range(3)]
    print(f'{len(parts)} objects, {sum(len(V) for _,_,V,_,_ in parts)} verts, '
          f'{tri_out} tris (source {tri_in}, carried through as-is)')
    print(f'skipped {len(skipped)}: ' + ', '.join(f'{i}:{n}' for i, n in skipped))
    print(f'bbox  x {lo[0]:7.3f}..{hi[0]:7.3f}  (length {hi[0]-lo[0]:.3f})')
    print(f'      y {lo[1]:7.3f}..{hi[1]:7.3f}  (height {hi[1]-lo[1]:.3f})')
    print(f'      z {lo[2]:7.3f}..{hi[2]:7.3f}  (span   {hi[2]-lo[2]:.3f})')
    print(f'textures: ' + ', '.join(f'{m}->{f}' for m, f in texfiles.items()))
    print(f'pbr: {len(pbr)} materials -> pbr.json')
    for n in pbrnotes:
        print('  ' + n)
    print(os.path.join(SRC['out'], SRC['obj']))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])
