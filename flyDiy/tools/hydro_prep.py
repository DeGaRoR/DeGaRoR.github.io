"""hydro_prep.py - ASSETS-OCT G2909: the small hydro plants' switchyard, cut out of the user's substation pack
("Substation" by One80 Solar, CC BY 4.0, assets/sceneryOctober/hydro/substation.glb) and tuned WAY down - the
user: "IRL the substation is tiny". Blender (3.6), headless, CPU:

  blender -b --factory-startup -P tools/hydro_prep.py -- [--report]

The pack is a 31 x 121 m transmission substation in centimetres, ONE material over 24 merged chunks: nothing is
named, so the two parts kept are taken by REGION (the pack's own frame, cm), every loose part whose centre lies
in the box:
  mast         one small lattice takeoff mast with its arms and insulators (the photo's "small lattice
               structure"), the feeder row's first
  transformer  the small transformer by the bus (a ~2.3 m tank with its radiators and bushings)
Each is joined, scaled to metres, stood on its base (centre of its footprint at the origin, its foot at y 0),
collapsed to its budget (~500-800 tris for the two: A0, 12 Oct), and given a ROLE per face from the pack's
texture under it: a bright face (porcelain, white paint) is `trim`, the rest `steel` - the generator dresses
them in our library's materials, no texture ships.

Writes the GENERATED block of tools/_navaid_gen.js (between its BEGIN / END markers): per part, positions as
int16 over its box, the index list and the role of each triangle - NAVAID_GEN's `utility/` entries build them
into their bags. Report: bench/scenery/hydro_switchyard.json.
"""
import bpy, bmesh, sys, os, json, math, base64, struct, re

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
REPORT = '--report' in argv
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = 'D:/Dev/DeGaRoR.github.io/flyDiy/assets/sceneryOctober/hydro/substation.glb'
GEN = os.path.join(HERE, '_navaid_gen.js')
REP = os.path.join(ROOT, 'bench', 'scenery', 'hydro_switchyard.json')
# the regions, in the pack's frame AFTER the import (Blender: x, y, z up; centimetres), and each part's budget
PARTS = {
    'mast':        dict(box=((120, 360, -5), (230, 470, 560)), tris=300),
    'transformer': dict(box=((-280, 250, -5), (10, 450, 330)), tris=450),
}
CM = 0.01


def log(*a):
    print('[hydro_prep]', *a, flush=True)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects:
    o.select_set(o in ms)
bpy.context.view_layer.objects.active = ms[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.join()
src = bpy.context.view_layer.objects.active
img = next((n.image for m in src.data.materials for n in m.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
px = list(img.pixels[:]) if img is not None else None
W_, H_ = (img.size[0], img.size[1]) if img is not None else (1, 1)


def texel(u, v):
    if px is None:
        return (0.6, 0.6, 0.6)
    x = int((u % 1.0) * W_) % W_; y = int((v % 1.0) * H_) % H_
    i = 4 * (y * W_ + x)
    return px[i], px[i + 1], px[i + 2]


bm = bmesh.new()
bm.from_mesh(src.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.01)
bm.faces.ensure_lookup_table()
uvl = bm.loops.layers.uv.active
# loose parts by face flood
seen, groups = set(), []
for f in bm.faces:
    if f.index in seen:
        continue
    st, mem = [f], []
    seen.add(f.index)
    while st:
        g = st.pop(); mem.append(g.index)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen:
                    seen.add(h.index); st.append(h)
    groups.append(mem)
log('loose parts', len(groups))
out, rep = {}, {}
for name, spec in PARTS.items():
    (x0, y0, z0), (x1, y1, z1) = spec['box']
    keep = []
    for mem in groups:
        vs = {v for fi in mem for v in bm.faces[fi].verts}
        c = [sum(v.co[k] for v in vs) / len(vs) for k in range(3)]
        if x0 <= c[0] <= x1 and y0 <= c[1] <= y1 and z0 <= c[2] <= z1:
            keep += mem
    # a new mesh of the kept faces, with each face's role from its texel (bright = porcelain / white paint)
    nb = bmesh.new()
    vmap = {}
    role_layer = nb.faces.layers.int.new('role')
    for fi in keep:
        f = bm.faces[fi]
        vv = []
        for v in f.verts:
            if v.index not in vmap:
                vmap[v.index] = nb.verts.new(v.co * CM)
            vv.append(vmap[v.index])
        try:
            nf = nb.faces.new(vv)
        except ValueError:
            continue
        if uvl is not None:
            u = sum(l[uvl].uv.x for l in f.loops) / len(f.loops); w = sum(l[uvl].uv.y for l in f.loops) / len(f.loops)
            r, g, b = texel(u, w)
        else:
            r = g = b = 0.6
        nf[role_layer] = 1 if (0.299 * r + 0.587 * g + 0.114 * b) > 0.62 else 0
    me = bpy.data.meshes.new(name)
    nb.to_mesh(me); nb.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    n0 = sum(len(p.vertices) - 2 for p in me.polygons)
    for o in bpy.context.scene.objects:
        o.select_set(o is ob)
    bpy.context.view_layer.objects.active = ob
    if n0 > spec['tris']:
        d = ob.modifiers.new('d', 'DECIMATE'); d.decimate_type = 'COLLAPSE'; d.use_collapse_triangulate = True
        d.ratio = spec['tris'] / n0
        bpy.ops.object.modifier_apply(modifier='d')
    bmt = bmesh.new(); bmt.from_mesh(ob.data)
    bmesh.ops.triangulate(bmt, faces=bmt.faces[:])
    rl = bmt.faces.layers.int.get('role')
    xs = [v.co.x for v in bmt.verts]; ys = [v.co.y for v in bmt.verts]; zs = [v.co.z for v in bmt.verts]
    # stand it: footprint centre to the origin, foot to 0; the game frame (x, y up, z = -y_blender)
    cx, cy, zmin = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)
    P = [(v.co.x - cx, v.co.z - zmin, -(v.co.y - cy)) for v in bmt.verts]
    bmt.verts.index_update()
    T = [[v.index for v in f.verts] for f in bmt.faces]
    roles = [f[rl] if rl is not None else 0 for f in bmt.faces]
    lo = [min(p[k] for p in P) for k in range(3)]; hi = [max(p[k] for p in P) for k in range(3)]
    q = lambda p: [int(round((p[k] - lo[k]) / max(1e-6, hi[k] - lo[k]) * 65535)) - 32768 for k in range(3)]
    pos = b''.join(struct.pack('<3h', *q(p)) for p in P)
    idx = b''.join(struct.pack('<3H', *t) for t in T)
    rol = bytes(roles)
    bmt.free()
    out[name] = dict(lo=[round(x, 4) for x in lo], hi=[round(x, 4) for x in hi], nv=len(P), nt=len(T),
                     pos=base64.b64encode(pos).decode(), idx=base64.b64encode(idx).decode(), role=base64.b64encode(rol).decode())
    rep[name] = dict(src_tris=n0, tris=len(T), verts=len(P), size=[round(hi[k] - lo[k], 2) for k in range(3)],
                     porcelain_share=round(sum(roles) / max(1, len(roles)), 3), bytes=len(pos) + len(idx) + len(rol))
    log(name, rep[name])
os.makedirs(os.path.dirname(REP), exist_ok=True)
json.dump(rep, open(REP, 'w'), indent=1)
if not REPORT:
    s = open(GEN, encoding='utf8').read()
    block = ('// BEGIN GENERATED (tools/hydro_prep.py - the switchyard parts cut from "Substation" by One80 Solar, CC BY 4.0)\n'
             'const UTIL_MESH = ' + json.dumps(out, separators=(',', ':')) + ';\n'
             '// END GENERATED')
    s2 = re.sub(r'// BEGIN GENERATED.*?// END GENERATED', lambda m: block, s, flags=re.S)
    assert s2 != s or block in s, 'the generated block markers are missing in _navaid_gen.js'
    open(GEN, 'w', encoding='utf8', newline='\n').write(s2)
    log('wrote the generated block into', GEN, len(block), 'bytes')
