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

THE TEXTURE BUDGET (AS6, G935): the 2048 maps written here are the author's
maps, prepped (LOADING S4) - and the page's FALLBACK since AS6. What the game
draws is the budget set chars_table.TEX_BUDGET declares (1024 diffuse + normal,
the gloss in the normal's alpha, the flat specular a constant, KTX2), cut FROM
these maps by tools/char_tex_budget.js, which a full bake runs last (it needs
node, python + Pillow and basisu v1.16.4: `npm install` in flyDiy/). It reads
only the manifests and the maps, so `--budget` re-cuts the set on a box without
the GLBs (assets/chars/ is gitignored).

Usage (from flyDiy/):  python tools/char_prep.py            # whole table + the budget
                       python tools/char_prep.py --report   # inventory only
                       python tools/char_prep.py --budget   # the budget set only
                       python tools/char_prep.py --no-budget
                       python tools/char_prep.py --cast     # the crowd only (G2970): the cast + its clips,
                                                            # the crew's manifests and media left alone
"""
import json
import os
import struct
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from glb_inspect import load, accessor, view_bytes  # noqa: E402
from media_lib import write_media, prune_media, prune_media_stems, encode_tex, asset_src, BASE_DECL  # noqa: E402
CHAR_TEX_MAX = 2048   # the delivered size of a character's maps (LOADING S4)
import chars_table as TABLE  # noqa: E402

OUT_DIR = os.path.join(ROOT, 'src', 'chars')


def pad4(buf):
    while len(buf) % 4:
        buf += b'\0'


def tex_of(j, tref):
    if not tref:
        return None
    return 't%d' % j['textures'][tref['index']]['source']


def bake(row, report, lazy=False):
    j, bin_ = load(asset_src(row['glb']))
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
    # ---- textures, PREPPED (LOADING S4, the user's ruling: sizes and formats
    # are the baker's; the GLB under assets/ stays as-is). Mixamo ships 4096
    # PNGs - 53 MB for one pilot, fetched every boot; the seat is two metres
    # from the eye. 2048, and the format by the map's role (media_lib.encode_tex).
    texs, tex_bytes = {}, 0
    for ti, im in enumerate(j.get('images', [])):
        raw, _ = view_bytes(j, bin_, im['bufferView'])
        name = im.get('name', 'tex%d' % ti)
        low = name.lower()
        role = 'normal' if 'normal' in low else ('data' if any(k in low for k in ('gloss', 'spec', 'rough', 'metal', 'occl', 'ao')) else 'color')
        data, ext = encode_tex(raw, role, CHAR_TEX_MAX)
        if ext == 'flat':
            # G903: a FLAT map is its constant [r, g, b] - no file (the seven
            # white 2048^2 Specular maps, Ch02's flat hair normal); the codec
            # binds TEX_FLAT for it (tools/_cage_char.js texture)
            texs['t%d' % ti] = data
            continue
        if not report:
            texs['t%d' % ti] = write_media('tex/chars/' + row['key'], name, ext, data)
        tex_bytes += len(data)
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
        return (None, None, []) if lazy else (None, [])
    rel = write_media('geo/chars', row['key'], 'bin', bytes(buf))
    man = {'v': 1, 'key': row['key'], 'label': row['label'],
           'credit': row['credit'], 'src': row['src'],
           'nodes': ntab, 'joints': joints, 'scene': j['scenes'][0]['nodes'],
           'bin': rel, 'texs': texs, 'mats': mats, 'meshes': meshes}
    if lazy:
        # THE CAST (G2970): the same manifest, as a content-hashed media file the
        # crowd fetches (src/viewer/crowd.js castLoad roots bin/texs with the base)
        man['cast'] = 1
        man['tris'] = ntri
        mrel = write_media('chars', row['key'], 'json',
                           json.dumps(man, separators=(',', ':')).encode('utf8'))
        return man, mrel, [rel, mrel] + [v for v in texs.values() if isinstance(v, str)]
    body = ('// GENERATED FILE - DO NOT EDIT. Built by tools/char_prep.py from\n'
            '// %s (via tools/fbx_to_glb.py), per the declared table in\n'
            '// tools/chars_table.py. Source: %s.\n'
            '// Decoded by src/core/52_char_codec.js; geometry in media/geo/chars/,\n'
            '// textures in media/tex/chars/. B re-roots the media paths for pages\n'
            '// that do not live at flyDiy/ (see tools/_media_lib.js).\n'
            'registerChar((c => {\n'
            '  %s\n'
            '  c.bin = B + c.bin;\n'
            "  for (const k in c.texs) if (typeof c.texs[k] === 'string') c.texs[k] = B + c.texs[k];\n"
            '  return c;\n'
            '})(%s));\n'
            % (row['glb'], row['credit'], BASE_DECL,
               json.dumps(man, separators=(',', ':'))))
    name = '%s_char.js' % row['key']
    with open(os.path.join(OUT_DIR, name), 'w', encoding='utf8', newline='\n') as f:
        f.write(body)
    return name, [rel] + [v for v in texs.values() if isinstance(v, str)]


def slerp(a, b, t):
    d = sum(x * y for x, y in zip(a, b))
    if d < 0:
        b = [-x for x in b]
    # nlerp: frames are 1/30 s apart, the arc is tiny
    q = [x + (y - x) * t for x, y in zip(a, b)]
    n = sum(x * x for x in q) ** 0.5 or 1.0
    return [x / n for x in q]


def hips_track(j, bin_, a):
    """The Hips' TRANSLATION in metres, world axes (y up) - the crowd's root
    motion (G2970). The channel is in the Hips' parent frame (Mixamo: the
    armature, scale 0.01 and turned y-up), so each sample goes through that
    parent's world matrix; returns (times, [(x, y, z)]) or None."""
    from glb_inspect import walk, xform
    nodes = j['nodes']
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i
    W = {ni: w for ni, _, w, _ in walk(j)}
    for ch in a['channels']:
        tgt = ch['target']
        if tgt.get('path') != 'translation':
            continue
        if nodes[tgt['node']].get('name', '').split(':')[-1] != 'Hips':
            continue
        smp = a['samplers'][ch['sampler']]
        ts = accessor(j, bin_, smp['input'])
        ps = accessor(j, bin_, smp['output'])
        pw = W.get(parent.get(tgt['node'], -1), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
        return ts, [xform(pw, p) for p in ps]
    return None


def bake_anim(row, report, root=False):
    """One clip -> f32 quats [frames][joints][4] on a uniform grid at row.fps.
    Rotation channels only: the ATD owns the root and the legs, the clip
    lends its upper body — translations would fight the seat."""
    j, bin_ = load(asset_src(row['glb']))
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
    extra = {}
    if root:
        # THE ROOT'S TRAVEL (G2970): forward speed over the clip (first to last
        # sample, on the ground plane) and the Hips' height per frame about its
        # mean - the frames themselves stay rotations only (the crowd moves the
        # person; a walk baked with its travel would carry them off the path)
        hk = hips_track(j, bin_, a)
        rootV, bob = 0.0, [0.0] * nf
        if hk:
            ts, ps = hk
            dx, dz = ps[-1][0] - ps[0][0], ps[-1][2] - ps[0][2]
            rootV = (dx * dx + dz * dz) ** 0.5 / max(1e-6, ts[-1] - ts[0])
            ys = []
            for f in range(nf):
                t = f / fps
                k = 0
                while k + 1 < len(ts) and ts[k + 1] <= t:
                    k += 1
                if k + 1 >= len(ts) or t <= ts[k]:
                    ys.append(ps[k][1])
                else:
                    u = (t - ts[k]) / (ts[k + 1] - ts[k])
                    ys.append(ps[k][1] + (ps[k + 1][1] - ps[k][1]) * u)
            m = sum(ys) / len(ys)
            bob = [round(y - m, 4) for y in ys]
        extra = {'role': row.get('role'), 'rootV': round(rootV, 4), 'bob': bob}
        print('          root %.3f m/s  bob +-%.3f m' % (rootV, max(abs(b) for b in bob)))
    if report:
        return None, []
    rel = write_media('geo/chars', 'anim_' + row['key'], 'bin', bytes(buf))
    man = {'v': 1, 'key': row['key'], 'label': row.get('label', row['key']), 'credit': row['credit'],
           'src': row['src'], 'fps': fps, 'frames': nf, 'dur': (nf - 1) / fps,
           'joints': joints, 'bin': rel, 'len': len(buf)}
    if root:
        man.update(extra)
        return man, [rel]
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


def budget():
    """THE TEXTURE BUDGET (AS6, G935): tools/char_tex_budget.js over the manifests
    and maps on disk -> media/tex/ktx2/chars/ + src/chars/chars_ktx2.js (and its
    line in chars_index.json)."""
    r = subprocess.run(['node', os.path.join(HERE, 'char_tex_budget.js')], cwd=ROOT)
    if r.returncode:
        sys.exit(r.returncode)


def main(argv):
    report = '--report' in argv
    if '--budget' in argv:
        return budget()
    os.makedirs(OUT_DIR, exist_ok=True)
    files, keep = [], []
    # --cast (G2970): the crew's rows are not re-baked (their media and boot
    # manifests stay byte for byte what is committed); the prune below then
    # owns only the cast's and the crowd clips' own stems
    only_cast = '--cast' in argv
    for row in ([] if only_cast else TABLE.CHARS):
        name, rels = bake(row, report)
        if name:
            files.append(name)
            keep += rels
    for row in ([] if only_cast else getattr(TABLE, 'ANIMS', [])):
        name, rels = bake_anim(row, report)
        if name:
            files.append(name)
            keep += rels
    # THE CAST + THE CROWD'S CLIPS (G2970): lazy - media files named by
    # src/chars/crowd_pack.json, never a boot manifest
    cast, clips, cast_keep = [], {}, []
    for row in getattr(TABLE, 'CAST', []):
        if row.get('reuse'):
            assert row['key'] in [r['key'] for r in TABLE.CHARS], row['key'] + ': reuse names no CHARS row'
            cast.append({'key': row['key'], 'reuse': 1})
            continue
        man, mrel, rels = bake(row, report, lazy=True)
        if man:
            cast.append({'key': row['key'], 'label': row['label'], 'man': mrel, 'tris': man['tris']})
            keep += rels
            cast_keep.append(mrel)
    for row in getattr(TABLE, 'CROWD_CLIPS', []):
        man, rels = bake_anim(row, report, root=True)
        if man:
            clips[row['key']] = man
            keep += rels
    if report:
        return
    roles = {}
    for row in getattr(TABLE, 'CROWD_CLIPS', []):
        roles.setdefault(row['role'], []).append(row['key'])
    roles['sit'] = [getattr(TABLE, 'CROWD_SIT', 'sitidle')]
    pack = {'note': 'GENERATED by tools/char_prep.py from tools/chars_table.py CAST / CROWD_CLIPS - do not edit. '
                    'The crowd (src/viewer/crowd.js) fetches this file the first time passengers appear; a cast '
                    'member is its own media/chars manifest (reuse: a crew manifest already on the page), a clip '
                    'rides here whole. ktx2: the budget rows of the cast (tools/char_tex_budget.js).',
            'v': 1, 'cast': cast, 'roles': roles, 'clips': clips,
            'budget': getattr(TABLE, 'CROWD_BUDGET', {}), 'ktx2': {}}
    PACK = os.path.join(OUT_DIR, 'crowd_pack.json')
    try:
        with open(PACK, encoding='utf8') as f:
            pack['ktx2'] = {k: v for k, v in json.load(f).get('ktx2', {}).items()
                            if any(c['key'] == k and not c.get('reuse') for c in cast)}
    except (OSError, ValueError):
        pass
    with open(PACK, 'w', encoding='utf8', newline='\n') as f:
        f.write(json.dumps(pack, indent=1) + '\n')
    own_cast = [r for r in getattr(TABLE, 'CAST', []) if not r.get('reuse')]
    if only_cast:
        stems = [r['key'] for r in own_cast] + ['anim_' + r['key'] for r in getattr(TABLE, 'CROWD_CLIPS', [])]
        gone = prune_media_stems('geo/chars', stems, keep) if stems else []
        gone += prune_media('chars', cast_keep)
        for row in own_cast:
            gone += prune_media('tex/chars/' + row['key'], keep)
        print('--cast: %d member(s), %d clip(s); pruned %d stale file(s)' % (len(own_cast), len(clips), len(gone)))
        if '--no-budget' not in argv:
            budget()
        return
    gone = prune_media('geo/chars', keep)
    gone += prune_media('chars', cast_keep)
    for row in TABLE.CHARS + own_cast:
        gone += prune_media('tex/chars/' + row['key'], keep)
    with open(os.path.join(OUT_DIR, 'chars_index.json'), 'w', encoding='utf8',
              newline='\n') as f:
        f.write(json.dumps(files) + '\n')
    for name in sorted(os.listdir(OUT_DIR)):
        if (name.endswith('_char.js') or name.endswith('_anim.js')) and name not in files:
            os.remove(os.path.join(OUT_DIR, name))
            gone.append(name)
    print('wrote %d manifest(s); pruned %d stale file(s)' % (len(files), len(gone)))
    if '--no-budget' not in argv:
        budget()


if __name__ == '__main__':
    main(sys.argv[1:])
