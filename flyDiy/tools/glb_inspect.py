#!/usr/bin/env python3
"""glb_inspect.py — per-node inventory of a glTF-binary (.glb) model.

The GLB counterpart of model_inspect.py, for Sketchfab/Blender exports whose
object names are mangled ("Plane.002_1") and must be identified geometrically.
Positions are reported in WORLD space (node transforms composed down the scene
graph), which is the frame glb_extract.py bakes to OBJ.

Usage:
  python tools/glb_inspect.py <model.glb>              inventory + materials
  python tools/glb_inspect.py <model.glb> --anim       animation channel dump
  python tools/glb_inspect.py <model.glb> --tex        embedded image list
  python tools/glb_inspect.py <model.glb> --node <i>   one node, detailed
"""
import base64, json, math, struct, sys

COMP = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2),
        5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def load(path):
    d = open(path, 'rb').read()
    magic, ver, _ = struct.unpack('<III', d[:12])
    assert magic == 0x46546c67, 'not a GLB'
    off, js, bin_ = 12, None, b''
    while off < len(d):
        clen, ctype = struct.unpack('<II', d[off:off + 8])
        blob = d[off + 8:off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(blob.decode('utf8'))
        elif ctype == 0x004E4942:
            bin_ = blob
        off += 8 + clen
    return js, bin_


def view_bytes(j, bin_, vi):
    bv = j['bufferViews'][vi]
    o = bv.get('byteOffset', 0)
    return bin_[o:o + bv['byteLength']], bv.get('byteStride')


def accessor(j, bin_, ai):
    """Return a list of tuples (or scalars) for accessor ai."""
    a = j['accessors'][ai]
    n, nc = a['count'], NCOMP[a['type']]
    fmt, sz = COMP[a['componentType']]
    if 'bufferView' not in a:
        return [(0,) * nc if nc > 1 else 0] * n
    raw, stride = view_bytes(j, bin_, a['bufferView'])
    base = a.get('byteOffset', 0)
    stride = stride or nc * sz
    out = []
    for i in range(n):
        o = base + i * stride
        v = struct.unpack_from('<' + str(nc) + fmt, raw, o)
        out.append(v if nc > 1 else v[0])
    return out


def mat_mul(a, b):
    return [sum(a[k * 4 + r] * b[c * 4 + k] for k in range(4))
            for c in range(4) for r in range(4)]


def trs_matrix(n):
    if 'matrix' in n:
        return list(n['matrix'])
    t = n.get('translation', [0, 0, 0])
    q = n.get('rotation', [0, 0, 0, 1])
    s = n.get('scale', [1, 1, 1])
    x, y, z, w = q
    R = [1 - 2 * (y * y + z * z), 2 * (x * y + z * w), 2 * (x * z - y * w), 0,
         2 * (x * y - z * w), 1 - 2 * (x * x + z * z), 2 * (y * z + x * w), 0,
         2 * (x * z + y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y), 0,
         0, 0, 0, 1]
    for c in range(3):
        for r in range(3):
            R[c * 4 + r] *= s[c]
    R[12], R[13], R[14] = t
    return R


def xform(m, p):
    x, y, z = p
    return (m[0] * x + m[4] * y + m[8] * z + m[12],
            m[1] * x + m[5] * y + m[9] * z + m[13],
            m[2] * x + m[6] * y + m[10] * z + m[14])


def walk(j, root=None, m=None, out=None, path=''):
    """Yield (node_index, node, world_matrix, path) for every node."""
    out = [] if out is None else out
    if root is None:
        for r in j['scenes'][j.get('scene', 0)]['nodes']:
            walk(j, r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], out, '')
        return out
    n = j['nodes'][root]
    w = mat_mul(m, trs_matrix(n))
    p = path + '/' + n.get('name', str(root))
    out.append((root, n, w, p))
    for c in n.get('children', []):
        walk(j, c, w, out, p)
    return out


def prim_stats(j, bin_, prim, w):
    pos = accessor(j, bin_, prim['attributes']['POSITION'])
    wp = [xform(w, p) for p in pos]
    lo = [min(p[a] for p in wp) for a in range(3)]
    hi = [max(p[a] for p in wp) for a in range(3)]
    ntri = (len(accessor(j, bin_, prim['indices'])) // 3) if 'indices' in prim else len(pos) // 3
    return len(pos), ntri, lo, hi


def inventory(j, bin_):
    print(f'{"node":>4} {"name":22} {"material":22} {"verts":>7} {"tris":>7}  '
          f'bbox lo..hi (x y z) | center | size')
    mats = {}
    total_v = total_t = 0
    for idx, n, w, path in walk(j):
        if 'mesh' not in n:
            continue
        for pi, prim in enumerate(j['meshes'][n['mesh']]['primitives']):
            nv, nt, lo, hi = prim_stats(j, bin_, prim, w)
            mat = j['materials'][prim['material']]['name'] if 'material' in prim else '-'
            ctr = [(a + b) / 2 for a, b in zip(lo, hi)]
            siz = [b - a for a, b in zip(lo, hi)]
            print(f'{idx:>4} {n.get("name","?"):22} {mat:22} {nv:>7} {nt:>7}  '
                  f'[{lo[0]:7.3f} {lo[1]:7.3f} {lo[2]:7.3f}]..[{hi[0]:7.3f} {hi[1]:7.3f} {hi[2]:7.3f}] | '
                  f'[{ctr[0]:7.3f} {ctr[1]:7.3f} {ctr[2]:7.3f}] | [{siz[0]:.3f} {siz[1]:.3f} {siz[2]:.3f}]')
            m = mats.setdefault(mat, [0, 0, 0])
            m[0] += 1; m[1] += nv; m[2] += nt
            total_v += nv; total_t += nt
    print(f'\nTOTAL {total_v} verts {total_t} tris')
    print('per-material totals:')
    for mat, (c, nv, nt) in sorted(mats.items(), key=lambda kv: -kv[1][2]):
        print(f'  {mat:24} {c:3} prims {nv:>7} verts {nt:>7} tris')


def materials(j):
    print('materials:')
    for i, m in enumerate(j.get('materials', [])):
        pbr = m.get('pbrMetallicRoughness', {})
        bits = []
        if 'baseColorTexture' in pbr:
            ti = pbr['baseColorTexture']['index']
            src = j['textures'][ti].get('source')
            img = j['images'][src] if src is not None else {}
            bits.append(f'baseTex=img{src}({img.get("name","")}, {img.get("mimeType","")})')
        if 'baseColorFactor' in pbr:
            bits.append('rgba=' + ','.join(f'{v:.2f}' for v in pbr['baseColorFactor']))
        for k in ('metallicFactor', 'roughnessFactor'):
            if k in pbr:
                bits.append(f'{k[:5]}={pbr[k]:.2f}')
        if m.get('alphaMode'):
            bits.append('alpha=' + m['alphaMode'])
        if m.get('doubleSided'):
            bits.append('2sided')
        print(f'  {i:>3} {m.get("name","?"):24} ' + ' '.join(bits))


def textures(j, bin_):
    print('images:')
    for i, im in enumerate(j.get('images', [])):
        if 'bufferView' in im:
            raw, _ = view_bytes(j, bin_, im['bufferView'])
            n = len(raw)
            # PNG/JPEG dimension sniff
            dim = ''
            if raw[:8] == b'\x89PNG\r\n\x1a\n':
                wid, hei = struct.unpack('>II', raw[16:24]); dim = f'{wid}x{hei} png'
            elif raw[:2] == b'\xff\xd8':
                o = 2
                while o < len(raw) - 9:
                    if raw[o] != 0xFF:
                        o += 1; continue
                    mk = raw[o + 1]
                    if mk in (0xC0, 0xC1, 0xC2):
                        hei, wid = struct.unpack('>HH', raw[o + 5:o + 9]); dim = f'{wid}x{hei} jpeg'; break
                    o += 2 + struct.unpack('>H', raw[o + 2:o + 4])[0]
            print(f'  {i:>3} {im.get("name","?"):30} {n//1024:>6} KB  {dim}  {im.get("mimeType","")}')
        else:
            print(f'  {i:>3} {im.get("name","?"):30} uri={im.get("uri","")[:40]}')


def anims(j, bin_):
    for ai, a in enumerate(j.get('animations', [])):
        print(f'animation {ai} "{a.get("name","?")}" — {len(a["channels"])} channels')
        for ch in a['channels']:
            t = ch['target']
            nd = j['nodes'][t['node']] if 'node' in t else {}
            s = a['samplers'][ch['sampler']]
            times = accessor(j, bin_, s['input'])
            vals = accessor(j, bin_, s['output'])
            print(f'  node {t.get("node")} "{nd.get("name","?")}" path={t["path"]} '
                  f'interp={s.get("interpolation","LINEAR")} keys={len(times)} '
                  f't={min(times):.2f}..{max(times):.2f} first={vals[0]} last={vals[-1]}')


def node_detail(j, bin_, ni):
    for idx, n, w, path in walk(j):
        if idx != ni:
            continue
        print(f'node {idx} "{n.get("name","?")}" path={path}')
        print('world matrix (column-major):', [round(v, 5) for v in w])
        if 'mesh' in n:
            for pi, prim in enumerate(j['meshes'][n['mesh']]['primitives']):
                nv, nt, lo, hi = prim_stats(j, bin_, prim, w)
                print(f'  prim {pi}: attrs={list(prim["attributes"])} verts={nv} tris={nt}')
                print(f'    bbox [{lo[0]:.4f} {lo[1]:.4f} {lo[2]:.4f}]..[{hi[0]:.4f} {hi[1]:.4f} {hi[2]:.4f}]')


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    j, bin_ = load(args[0])
    if '--anim' in args:
        anims(j, bin_)
    elif '--tex' in args:
        textures(j, bin_); materials(j)
    elif '--node' in args:
        node_detail(j, bin_, int(args[args.index('--node') + 1]))
    else:
        inventory(j, bin_)


if __name__ == '__main__':
    main()
