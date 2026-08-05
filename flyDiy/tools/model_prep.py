#!/usr/bin/env python3
"""model_prep.py — bake a FlightGear/Blender OBJ into a compact JS payload.

Usage: python tools/model_prep.py <key> [<out.js>]
  <key> selects the per-model config tools/models/<key>.py (e.g. pa18);
  <out.js> defaults to src/models/<key>_model.js. Requires Pillow.

Payload v3: const <ID> = { v:3, bb, hub, surfaces,
                           texs: {name: dataURI}, mats: {name: {tex|opacity,color}},
                           groups: {name: {nv, nt, sid, mat, b64}} }
  - group binary layout (little-endian, unchanged since v2): u32 nVerts,
    u32 nTris, int16 pos[3n] (quantized over bb), uint16 uv[2n],
    uint16 idx[3t], optional uint8 sid[n]
  - bb spans the union of ALL kept verts; positions ~0.2 mm resolution
  - textures per config: jpeg recompressed, or png passthrough (keeps alpha)
Decode counterpart: decodeModel() in src/core/50_model_codec.js (pure JS,
same code in the artifact and the node gates). v2 payloads still decode.
"""
import base64, importlib, io, json, os, struct, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def short(name):        # 'voletG_voletG.mesh' -> 'voletG'
    return name.split('_')[0].split('.')[0]


def parse(path):
    V, VT, faces, cur, mtl = [], [], [], None, None
    for line in open(path):
        t = line.split()
        if not t:
            continue
        if t[0] == 'o':
            cur = short(t[1])
        elif t[0] == 'usemtl':
            mtl = t[1]
        elif t[0] == 'v':
            V.append(tuple(float(x) for x in t[1:4]))
        elif t[0] == 'vt':
            VT.append((float(t[1]), float(t[2])))
        elif t[0] == 'f':
            idx = []
            for w in t[1:]:
                a = w.split('/')
                idx.append((int(a[0]) - 1, int(a[1]) - 1 if len(a) > 1 and a[1] else 0))
            faces.append((cur, mtl, idx))
    return V, VT, faces


def face_in(gdef, name, mtl):
    return name in gdef.get('objects', ()) or mtl in gdef.get('materials', ())


def build_group(V, VT, faces, gdef, SID, bb, with_sid=False):
    (x0, y0, z0), (x1, y1, z1) = bb
    sx, sy, sz = 65535 / (x1 - x0), 65535 / (y1 - y0), 65535 / (z1 - z0)
    vmap, pos, uv, tris, sids = {}, [], [], [], []
    for name, mtl, idx in faces:
        if not face_in(gdef, name, mtl):
            continue
        sid = SID.get(name, 0)
        vi = []
        for v, vt in idx:
            key = (v, vt)
            if key not in vmap:
                vmap[key] = len(pos)
                x, y, z = V[v]
                pos.append((int((x - x0) * sx) - 32768,
                            int((y - y0) * sy) - 32768,
                            int((z - z0) * sz) - 32768))
                u, w = VT[vt]
                # clamp + round: tiling UVs must not overflow uint16
                uv.append((round(min(max(u, 0.0), 1.0) * 65535),
                           round(min(max(w, 0.0), 1.0) * 65535)))
                sids.append(sid)
            vi.append(vmap[key])
        for k in range(1, len(vi) - 1):          # fan triangulation
            tris.append((vi[0], vi[k], vi[k + 1]))
    assert len(pos) < 65536, f'group too large for uint16 indices: {len(pos)}'
    buf = io.BytesIO()
    buf.write(struct.pack('<II', len(pos), len(tris)))
    for p in pos:
        buf.write(struct.pack('<3h', *p))
    for t in uv:
        buf.write(struct.pack('<2H', *t))
    for t in tris:
        buf.write(struct.pack('<3H', *t))
    if with_sid:
        buf.write(bytes(sids))
    return len(pos), len(tris), base64.b64encode(buf.getvalue()).decode()


MIME = {'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'}


def resolve_pbr(src, CFG, faces):
    """Match each payload material to the glTF material its faces came from.

    glb_extract writes pbr.json keyed by glTF material name, and the OBJ it
    writes carries those same names as `usemtl` — so the join needs no config
    at all: walk the faces a group claims, count the usemtl names, take the
    dominant one. A payload material spanning several source materials (the
    exterior spans one, but a hand-written group need not) reports the split
    rather than silently picking.
    """
    path = os.path.join(src, 'pbr.json')
    if not os.path.exists(path):
        return {}, ['pbr.json absent — scalar PBR comes from the viewer defaults']
    table = json.load(open(path))
    tally, notes = {}, []
    for gdef in CFG['groups'].values():
        for name, mtl, idx in faces:
            if face_in(gdef, name, mtl):
                tally.setdefault(gdef['mat'], {})
                tally[gdef['mat']][mtl] = tally[gdef['mat']].get(mtl, 0) + len(idx)
    out = {}
    for mat, counts in tally.items():
        best = max(counts, key=counts.get)
        if best in table:
            out[mat] = table[best]
        if len(counts) > 1:
            notes.append(f'{mat}: spans {len(counts)} source materials, took {best} '
                         f'({", ".join(f"{k}:{v}" for k, v in sorted(counts.items(), key=lambda kv: -kv[1]))})')
    return out, notes


def bake_texture(src, spec):
    path = os.path.join(src, spec['tex'])
    if spec.get('fmt') == 'copy':
        # verbatim: the source file's own bytes, at its own resolution and
        # quality. No re-encode, so nothing is lost and nothing is guessed.
        data = open(path, 'rb').read()
        mime = MIME[os.path.splitext(path)[1].lower()]
        return f'data:{mime};base64,' + base64.b64encode(data).decode(), len(data)
    if spec.get('fmt', 'jpeg') == 'png':
        img = Image.open(path)
        if max(img.size) > spec.get('max', 4096):
            img.thumbnail((spec['max'], spec['max']))
            tb = io.BytesIO()
            img.save(tb, 'PNG', optimize=True)
            data = tb.getvalue()
        else:
            data = open(path, 'rb').read()       # passthrough keeps alpha bit-exact
        return 'data:image/png;base64,' + base64.b64encode(data).decode(), len(data)
    img = Image.open(path).convert('RGB')
    img.thumbnail((spec.get('max', 1024), spec.get('max', 1024)))
    tb = io.BytesIO()
    # subsampling 0 (4:4:4) matters for data maps: a normal map's signal lives in
    # R and G, and chroma subsampling is exactly what throws those away
    img.save(tb, 'JPEG', quality=spec.get('q', 80), subsampling=spec.get('sub', 2))
    return 'data:image/jpeg;base64,' + base64.b64encode(tb.getvalue()).decode(), len(tb.getvalue())


# Defaults for the imported data maps. metalRough is low-frequency by nature and
# survives hard compression; normal maps are 4:4:4 because their signal is in
# R and G. Both default to 512: these are surface DETAIL, sampled a metre from
# the camera at worst, not the livery. Per-material overrides go in the config's
# mats entry (`mr=dict(...)`, `nrm=dict(...)`, or False to decline the map).
PBRTEX = {'mr': dict(max=512, fmt='jpeg', q=88, sub=2),
          'nrm': dict(max=512, fmt='jpeg', q=92, sub=0)}


def main(key, out=None):
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models'))
    CFG = importlib.import_module(key).CFG
    out = out or os.path.join(ROOT, 'src', 'models', f'{key}_model.js')
    src = os.path.join(ROOT, CFG['src'])
    SURFACES = CFG['surfaces']
    SID = {name: i + 1 for i, (name, _) in enumerate(SURFACES)}

    V, VT, faces = parse(os.path.join(src, CFG['obj']))
    used = [V[v] for name, mtl, idx in faces for v, _ in idx
            if any(face_in(g, name, mtl) for g in CFG['groups'].values())]
    lo = tuple(min(p[i] for p in used) for i in range(3))
    hi = tuple(max(p[i] for p in used) for i in range(3))
    bb = (lo, hi)

    PBR, pbrnotes = resolve_pbr(src, CFG, faces)
    texs, report = {}, []
    for mname, spec in CFG['mats'].items():
        if 'tex' not in spec:
            continue
        texs[mname], nbytes = bake_texture(src, spec)
        report.append(f'tex {mname}: {nbytes // 1024} KB {spec.get("fmt", "jpeg")}')
    # imported data maps, keyed <material>_mr / <material>_nrm
    pbrbytes = 0
    for mname, spec in CFG['mats'].items():
        rec = PBR.get(mname)
        if not rec:
            continue
        for kind in ('mr', 'nrm'):
            if kind not in rec:
                continue
            over = spec.get(kind)
            if over is False:                    # config declines this map
                rec.pop(kind)
                pbrnotes.append(f'{mname}: {kind} declined by config')
                continue
            ts = dict(PBRTEX[kind], **(over if isinstance(over, dict) else {}))
            ts['tex'] = rec[kind]
            key = f'{mname}_{kind}'
            assert key not in CFG['mats'], f'material name collides with map key {key}'
            texs[key], nbytes = bake_texture(src, ts)
            pbrbytes += nbytes
            report.append(f'{kind} {mname}: {nbytes // 1024} KB')

    parts = []
    for gname, gdef in CFG['groups'].items():
        ws = bool(gdef.get('sid'))
        nv, nt, b64 = build_group(V, VT, faces, gdef, SID, bb, with_sid=ws)
        parts.append(f'{gname}:{{nv:{nv},nt:{nt},sid:{1 if ws else 0},mat:"{gdef["mat"]}",b64:"{b64}"}}')
        report.append(f'{gname}: {nv} verts {nt} tris')
    surf_js = ','.join(
        '{name:"%s",drive:"%s",sgn:%d,k:%g,p:[%g,%g,%g],ax:[%g,%g,%g],ramp:%s}' % (
            n, s['drive'], s['sgn'], s.get('k', 1), *s['p'], *s['ax'],
            '[%g,%g]' % s['ramp'] if 'ramp' in s else 'null')
        for n, s in SURFACES)
    # tex / opacity / color are independent: a textured material may also be
    # translucent (the c172 glazing is a tint map at opacity 0.37) and an
    # untextured one may be opaque (a flat interior panel).
    # PBR (v4) rides alongside: rough/metal are the glTF factors, already folded
    # with any constant metalRough map; mr/nrm name the data maps in texs; emis
    # is the emissive factor, with the base map reused as the emissive map when
    # the source says they are the same image (which costs zero extra bytes).
    def mat_fields(m, s):
        f = []
        if 'tex' in s:
            f.append(f'tex:"{m}"')
        if 'opacity' in s:
            f.append(f'opacity:{s["opacity"]}')
        if 'color' in s:
            f.append(f'color:0x{s["color"]:x}')
        p = PBR.get(m)
        if p:
            f.append(f'rough:{p["rough"]:g}')
            f.append(f'metal:{p["metal"]:g}')
            if 'mr' in p:
                f.append(f'mr:"{m}_mr"')
            if 'nrm' in p:
                f.append(f'nrm:"{m}_nrm"')
                if 'nrmScale' in p:
                    f.append(f'nrmScale:{p["nrmScale"]:g}')
            if 'emis' in p and ('emisIsBase' in p) and 'tex' in s:
                f.append('emis:[%g,%g,%g]' % tuple(p['emis']))
        return ','.join(f)
    mats_js = ','.join('%s:{%s}' % (m, mat_fields(m, s)) for m, s in CFG['mats'].items())
    texs_js = ',\n  '.join(f'{m}:"{uri}"' for m, uri in texs.items())
    bbjs = '[' + ','.join(f'{v:.4f}' for v in lo + hi) + ']'
    hub = CFG['hub']
    with open(out, 'w', newline='\n') as f:
        f.write('// generated by tools/model_prep.py — do not edit\n')
        f.write(f'// source: {CFG["credit"]}\n')
        f.write(f'const {CFG["id"]} = {{ v:{4 if PBR else 3}, bb:{bbjs}, hub:[{hub[0]:g},{hub[1]:g},{hub[2]:g}],\n')
        f.write(f'  surfaces:[{surf_js}],\n')
        f.write(f'  mats:{{{mats_js}}},\n')
        f.write(f'  texs:{{{texs_js}}},\n')
        f.write(f'  groups:{{{",".join(parts)}}} }};\n')
        f.write(f"if (typeof module !== 'undefined') module.exports = {{ {CFG['id']} }};\n")
    print(' | '.join(report))
    for n in pbrnotes:
        print('  pbr: ' + n)
    if PBR:
        print(f'  pbr: {len(PBR)} materials carry imported factors, '
              f'data maps {pbrbytes // 1024} KB')
    print(f'{out}: {os.path.getsize(out) // 1024} KB')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
