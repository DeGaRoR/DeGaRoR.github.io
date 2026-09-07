#!/usr/bin/env python3
"""char_prep.py — bake the declared RIGGED CHARACTERS (tools/chars_table.py).

GLB (from tools/fbx_to_glb.py) -> one .bin per character under
media/geo/chars/, the author's textures BYTE-EXACT under media/tex/chars/<key>/,
and one manifest src/chars/<key>_char.js that registerChar()s them; the bake
order goes to src/chars/chars_index.json for build.js.

AS-IS (import-models-as-is): every primitive, every vertex, float32 positions
and normals exactly as exported, the PNGs the FBX embedded re-written without
touching a byte. The only "processing" is unpacking glTF accessors into the
flat layout src/core/52_char_codec.js reads back.

Bin layout, little-endian, each section 4-byte aligned:
  ibm     f32[16 * nJoints]        inverse bind matrices, column-major (glTF)
  per mesh (manifest carries off/len and the counts):
    f32 pos[3n]  f32 nrm[3n]  f32 uv[2n]  u8 jt[4n]  f32 wt[4n]  u16 idx[3t]
  (nVerts asserted <= 65536; a character mesh over that would need u32)

Usage (from flyDiy/):  python tools/char_prep.py            # whole table
                       python tools/char_prep.py --report   # inventory only
"""
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from glb_inspect import load, accessor, view_bytes  # noqa: E402
from media_lib import write_media, prune_media, BASE_DECL  # noqa: E402
import chars_table as TABLE  # noqa: E402

OUT_DIR = os.path.join(ROOT, 'src', 'chars')


def pad4(buf):
    while len(buf) % 4:
        buf += b'\0'


def tex_of(j, tref):
    if not tref:
        return None
    return 't%d' % j['textures'][tref['index']]['source']


def bake(row, report):
    j, bin_ = load(os.path.join(ROOT, row['glb']))
    nodes = j['nodes']
    # ---- the node tree: parent index per node (the whole scene, joints and
    # mesh nodes alike — the codec rebuilds it verbatim so bind poses match)
    parent = [-1] * len(nodes)
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i
    ntab = []
    for i, n in enumerate(nodes):
        ntab.append({'n': n.get('name', 'node%d' % i), 'p': parent[i],
                     't': [round(v, 6) for v in n.get('translation', [0, 0, 0])],
                     'r': [round(v, 7) for v in n.get('rotation', [0, 0, 0, 1])],
                     's': [round(v, 7) for v in n.get('scale', [1, 1, 1])]})
    skins = j.get('skins', [])
    assert len(skins) == 1, 'one skin per character (%d found)' % len(skins)
    skin = skins[0]
    joints = skin['joints']
    ibm = accessor(j, bin_, skin['inverseBindMatrices'])
    # ---- textures, byte-exact
    texs, tex_bytes = {}, 0
    for ti, im in enumerate(j.get('images', [])):
        raw, _ = view_bytes(j, bin_, im['bufferView'])
        ext = {'image/png': 'png', 'image/jpeg': 'jpg'}[im['mimeType']]
        name = im.get('name', 'tex%d' % ti)
        if not report:
            texs['t%d' % ti] = write_media('tex/chars/' + row['key'], name, ext, raw)
        tex_bytes += len(raw)
    mats = []
    for m in j.get('materials', []):
        pbr = m.get('pbrMetallicRoughness', {})
        spec = m.get('extensions', {}).get('KHR_materials_specular', {})
        mats.append({'name': m.get('name', ''),
                     'map': tex_of(j, pbr.get('baseColorTexture')),
                     'nrm': tex_of(j, m.get('normalTexture')),
                     # Blender routes a spec/gloss FBX's glossiness into the
                     # metallicRoughness slot; recorded, NOT used as roughness
                     # (glossiness is its inverse) — see the codec's material
                     'mr': tex_of(j, pbr.get('metallicRoughnessTexture')),
                     'spec': tex_of(j, spec.get('specularTexture')),
                     'blend': m.get('alphaMode', 'OPAQUE'),
                     'ds': bool(m.get('doubleSided', False)),
                     'col': pbr.get('baseColorFactor', [1, 1, 1, 1])})
    # ---- geometry
    buf = bytearray()
    buf += struct.pack('<%df' % (16 * len(ibm)), *[v for m in ibm for v in m])
    pad4(buf)
    meshes, ntri, nvert = [], 0, 0
    for ni, n in enumerate(nodes):
        if 'mesh' not in n:
            continue
        mesh = j['meshes'][n['mesh']]
        for prim in mesh['primitives']:
            A = prim['attributes']
            pos = accessor(j, bin_, A['POSITION'])
            nrm = accessor(j, bin_, A['NORMAL'])
            uv = accessor(j, bin_, A['TEXCOORD_0'])
            jt = accessor(j, bin_, A['JOINTS_0'])
            wt = accessor(j, bin_, A['WEIGHTS_0'])
            idx = accessor(j, bin_, prim['indices'])
            nv, nt = len(pos), len(idx) // 3
            assert nv <= 65536, '%s: %d verts > u16' % (mesh['name'], nv)
            off = len(buf)
            buf += struct.pack('<%df' % (3 * nv), *[v for p in pos for v in p])
            buf += struct.pack('<%df' % (3 * nv), *[v for p in nrm for v in p])
            buf += struct.pack('<%df' % (2 * nv), *[v for p in uv for v in p])
            buf += struct.pack('<%dB' % (4 * nv), *[v for p in jt for v in p])
            buf += struct.pack('<%df' % (4 * nv), *[v for p in wt for v in p])
            buf += struct.pack('<%dH' % len(idx), *idx)
            pad4(buf)
            meshes.append({'name': n.get('name', mesh['name']), 'node': ni,
                           'mat': prim.get('material', 0), 'nv': nv, 'nt': nt,
                           'off': off, 'len': len(buf) - off})
            ntri += nt
            nvert += nv
    print('%-6s %2d joints  %d meshes  %6d verts  %6d tris  geo %.2f MB  tex %.2f MB'
          % (row['key'], len(joints), len(meshes), nvert, ntri,
             len(buf) / 1048576, tex_bytes / 1048576))
    if report:
        return None, []
    rel = write_media('geo/chars', row['key'], 'bin', bytes(buf))
    man = {'v': 1, 'key': row['key'], 'label': row['label'],
           'credit': row['credit'], 'src': row['src'],
           'nodes': ntab, 'joints': joints, 'scene': j['scenes'][0]['nodes'],
           'bin': rel, 'texs': texs, 'mats': mats, 'meshes': meshes}
    body = ('// GENERATED FILE - DO NOT EDIT. Built by tools/char_prep.py from\n'
            '// %s (via tools/fbx_to_glb.py), per the declared table in\n'
            '// tools/chars_table.py. Source: %s.\n'
            '// Decoded by src/core/52_char_codec.js; geometry in media/geo/chars/,\n'
            '// textures in media/tex/chars/. B re-roots the media paths for pages\n'
            '// that do not live at flyDiy/ (see tools/_media_lib.js).\n'
            'registerChar((c => {\n'
            '  %s\n'
            '  c.bin = B + c.bin;\n'
            '  for (const k in c.texs) c.texs[k] = B + c.texs[k];\n'
            '  return c;\n'
            '})(%s));\n'
            % (row['glb'], row['credit'], BASE_DECL,
               json.dumps(man, separators=(',', ':'))))
    name = '%s_char.js' % row['key']
    with open(os.path.join(OUT_DIR, name), 'w', encoding='utf8', newline='\n') as f:
        f.write(body)
    return name, [rel] + list(texs.values())


def slerp(a, b, t):
    d = sum(x * y for x, y in zip(a, b))
    if d < 0:
        b = [-x for x in b]
    # nlerp: frames are 1/30 s apart, the arc is tiny
    q = [x + (y - x) * t for x, y in zip(a, b)]
    n = sum(x * x for x in q) ** 0.5 or 1.0
    return [x / n for x in q]


def bake_anim(row, report):
    """One clip -> f32 quats [frames][joints][4] on a uniform grid at row.fps.
    Rotation channels only: the ATD owns the root and the legs, the clip
    lends its upper body — translations would fight the seat."""
    j, bin_ = load(os.path.join(ROOT, row['glb']))
    anims = j.get('animations', [])
    assert anims, row['key'] + ': the GLB carries no animation'
    a = anims[0]
    nodes = j['nodes']
    chans = {}
    t_end = 0.0
    for ch in a['channels']:
        if ch['target'].get('path') != 'rotation':
            continue
        name = nodes[ch['target']['node']].get('name', '').split(':')[-1]
        smp = a['samplers'][ch['sampler']]
        ts = accessor(j, bin_, smp['input'])
        qs = accessor(j, bin_, smp['output'])
        acc = j['accessors'][smp['output']]
        if acc['componentType'] != 5126:          # normalized ints -> floats
            div = {5120: 127.0, 5121: 255.0, 5122: 32767.0, 5123: 65535.0}[acc['componentType']]
            qs = [tuple(v / div for v in q) for q in qs]
        chans[name] = (ts, qs)
        t_end = max(t_end, ts[-1])
    fps = row.get('fps', 15)
    nf = max(2, int(round(t_end * fps)) + 1)
    joints = sorted(chans)
    buf = bytearray()
    for f in range(nf):
        t = f / fps
        for name in joints:
            ts, qs = chans[name]
            k = 0
            while k + 1 < len(ts) and ts[k + 1] <= t:
                k += 1
            if k + 1 >= len(ts) or t <= ts[k]:
                q = list(qs[k])
            else:
                q = slerp(qs[k], qs[k + 1], (t - ts[k]) / (ts[k + 1] - ts[k]))
            buf += struct.pack('<4f', *q)
    print('%-9s clip %5.2f s  %3d frames @ %d fps  %2d joints  %.2f MB'
          % (row['key'], t_end, nf, fps, len(joints), len(buf) / 1048576))
    if report:
        return None, []
    rel = write_media('geo/chars', 'anim_' + row['key'], 'bin', bytes(buf))
    man = {'v': 1, 'key': row['key'], 'label': row['label'], 'credit': row['credit'],
           'src': row['src'], 'fps': fps, 'frames': nf, 'dur': (nf - 1) / fps,
           'joints': joints, 'bin': rel, 'len': len(buf)}
    body = ('// GENERATED FILE - DO NOT EDIT. Built by tools/char_prep.py from\n'
            '// %s (via tools/fbx_to_glb.py --anim), per tools/chars_table.py ANIMS.\n'
            '// Source: %s. Decoded by src/core/52_char_codec.js (decodeCharAnim);\n'
            '// f32 quaternions [frames][joints][4] in media/geo/chars/.\n'
            'registerCharAnim((c => {\n'
            '  %s\n'
            '  c.bin = B + c.bin;\n'
            '  return c;\n'
            '})(%s));\n'
            % (row['glb'], row['credit'], BASE_DECL,
               json.dumps(man, separators=(',', ':'))))
    name = '%s_anim.js' % row['key']
    with open(os.path.join(OUT_DIR, name), 'w', encoding='utf8', newline='\n') as f:
        f.write(body)
    return name, [rel]


def main(argv):
    report = '--report' in argv
    os.makedirs(OUT_DIR, exist_ok=True)
    files, keep = [], []
    for row in TABLE.CHARS:
        name, rels = bake(row, report)
        if name:
            files.append(name)
            keep += rels
    for row in getattr(TABLE, 'ANIMS', []):
        name, rels = bake_anim(row, report)
        if name:
            files.append(name)
            keep += rels
    if report:
        return
    gone = prune_media('geo/chars', keep)
    for row in TABLE.CHARS:
        gone += prune_media('tex/chars/' + row['key'], keep)
    with open(os.path.join(OUT_DIR, 'chars_index.json'), 'w', encoding='utf8',
              newline='\n') as f:
        f.write(json.dumps(files) + '\n')
    for name in sorted(os.listdir(OUT_DIR)):
        if (name.endswith('_char.js') or name.endswith('_anim.js')) and name not in files:
            os.remove(os.path.join(OUT_DIR, name))
            gone.append(name)
    print('wrote %d manifest(s); pruned %d stale file(s)' % (len(files), len(gone)))


if __name__ == '__main__':
    main(sys.argv[1:])
