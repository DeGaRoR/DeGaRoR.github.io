"""machine_prep.py - ASSET-PREP G1240: the woodworking machines' scans cut to a
game budget, in Blender (3.6), headless:

  blender -b --factory-startup -P tools/machine_prep.py -- <key> <tris> [size]

Reads  assets/props/<key>/<key>.glb          (the delivered scan, never edited)
Writes assets/props/<key>_prep/<key>.glb     (the prepped source; the table row
                                              points its `dir` here and
                                              tools/prop_prep.py bakes it as
                                              it bakes every other prop)
       bench/machines/<key>.json             (counts + the UV report)

WHY REPROJECT, NOT DECIMATE-IN-PLACE. The scans' uvs are photogrammetry
atlases tiled over 4-8 UDIM-style materials (u1_v1 .. u3_v2): thousands of
small charts whose borders are open mesh boundaries. A collapse that must keep
every chart border cannot reach -90 %, and one that may move them tears the
texture. So the high scan is welded, collapsed (quadric error: it spends its
triangles on silhouettes, creases and the table edges, not on flat paint),
unwrapped clean (seams on the sharp edges, Smart UV islands, one atlas), and
the scan's albedo + a tangent-space normal for the lost relief are BAKED onto
it (Cycles, CPU, selected-to-active). One material per machine instead of 4-8.
"""
import bpy, bmesh, sys, os, json, math, time
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
KEY = argv[0]
TARGET = int(argv[1])
SIZE = int(argv[2]) if len(argv) > 2 else 2048
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAIN_ASSETS = 'D:/Dev/DeGaRoR.github.io/flyDiy/assets'
own = os.path.join(ROOT, 'assets', 'props')
ASSETS = own if os.path.isdir(os.path.join(own, KEY)) else os.path.join(MAIN_ASSETS, 'props')
SRC = os.path.join(ASSETS, KEY, KEY + '.glb')
OUT_DIR = os.path.join(ASSETS, KEY + '_prep')
OUT = os.path.join(OUT_DIR, KEY + '.glb')
REP = os.path.join(ROOT, 'bench', 'machines', KEY + '.json')
UV_ANGLE = float(argv[3]) if len(argv) > 3 else 75
SHARP = math.radians(40)        # crease angle: auto-smooth split + UV seam
t0 = time.time()


def log(*a):
    print('[machine_prep %s %5.1fs]' % (KEY, time.time() - t0), *a, flush=True)


def tris_of(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects:
    o.select_set(False)
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.join()
hi = bpy.context.view_layer.objects.active
hi.name = 'HI'
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH':
        bpy.data.objects.remove(o)
src_tris = tris_of(hi)
dims = list(hi.dimensions)
log('source', src_tris, 'tris, dims', ['%.2f' % d for d in dims])
# the scan's albedo is the only map. For the bake each scan material is
# rewired base-colour image -> Emission -> output and baked as EMIT: the
# plainest read of the paint, no lighting, no BSDF in between
for m in hi.data.materials:
    nt_ = m.node_tree
    out_ = next(n for n in nt_.nodes if n.type == 'OUTPUT_MATERIAL')
    img_ = next(n for n in nt_.nodes if n.type == 'TEX_IMAGE')
    em_ = nt_.nodes.new('ShaderNodeEmission')
    nt_.links.new(img_.outputs['Color'], em_.inputs['Color'])
    m['_emit'] = em_.name

# ---- LO: weld, collapse --------------------------------------------------
lo = hi.copy()
lo.data = hi.data.copy()
lo.name = 'LO'
bpy.context.scene.collection.objects.link(lo)
lo.data.materials.clear()
# the scan's CUSTOM split normals came with the copy (the glTF importer sets
# them); a collapse scrambles them and the bake casts its rays along them -
# the panel saw came out chrome-streaked. The cut gets its own normals.
bpy.context.view_layer.objects.active = lo
for o in bpy.context.scene.objects:
    o.select_set(o == lo)
if lo.data.has_custom_normals:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
bm = bmesh.new()
bm.from_mesh(lo.data)
nv0 = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
log('welded', nv0, '->', len(bm.verts), 'verts')
bm.to_mesh(lo.data)
bm.free()
for uv in list(lo.data.uv_layers):
    lo.data.uv_layers.remove(uv)
hi.hide_render = False
from mathutils.bvhtree import BVHTree
TOL = 0.01          # 1 cm: past this a welded vertex is a feature the cut lost
welded = lo.data.copy()


def collapse(group=None):
    """quadric collapse of the welded mesh to TARGET, optionally weighting a
    vertex group (protected vertices collapse last); returns its deviation:
    every welded vertex's distance to the cut surface"""
    lo.data = welded.copy()
    dec = lo.modifiers.new('dec', 'DECIMATE')
    dec.decimate_type = 'COLLAPSE'
    dec.use_collapse_triangulate = True
    dec.ratio = TARGET / max(1, tris_of(lo))
    if group:
        dec.vertex_group = group
        # the modifier's weight means MAY decimate: the protected vertices
        # are the group, inverted (weight 0 = left where the scan put them)
        dec.vertex_group_factor = 10.0
        dec.invert_vertex_group = True
    bpy.context.view_layer.objects.active = lo
    for o in bpy.context.scene.objects:
        o.select_set(o == lo)
    bpy.ops.object.modifier_apply(modifier='dec')
    bm_ = bmesh.new(); bm_.from_mesh(lo.data)
    tree = BVHTree.FromBMesh(bm_)
    bm_.free()
    out = []
    for v in welded.vertices:
        loc, nrm, _, d = tree.find_nearest(v.co)
        # a FOLD: the cut surface nearest the scan vertex faces the other
        # way. A thin plate (the panel saw's tables, 2-3 cm) collapses its
        # two faces into each other within a centimetre - invisible to the
        # distance, black and streaked in the bake
        out.append((d, nrm.dot(v.normal) < 0.0))
    return out


def bad_of(r):
    # distance only: protecting the folds too (tried) starves the rest of
    # the budget and the next pass folds MORE - they stay a reported number
    return set(i for i, (d, flip) in enumerate(r) if d > TOL)


def dev_rep(r):
    s_ = sorted(d for d, _ in r)
    return dict(p99=round(s_[int(.99 * len(s_))], 4), max=round(s_[-1], 4),
                over_tol=sum(1 for d, _ in r if d > TOL), folded=sum(1 for _, f in r if f))


# PASS 1 plain; PASS 2 with every vertex pass 1 moved past TOL (and its
# ring) protected: a thin rod's tip, a lever, a fence end - the silhouette -
# survives, and the budget comes out of the flat panels instead. The pass
# with the lower worst case at the budget is kept.
passes = []
hit = set()
for k in range(2):
    if k:
        lo.data = welded       # (3.x keeps the group NAMES on the mesh: swap first)
        for g in list(lo.vertex_groups):
            lo.vertex_groups.remove(g)
        vg = lo.vertex_groups.new(name='keep')
        vg.add(sorted(hit), 1.0, 'REPLACE')
    r = collapse('keep' if k else None)
    nt_ = tris_of(lo)
    bad = bad_of(r)
    passes.append(dict(dev_rep(r), tris=nt_, protected=len(hit), bad=len(bad)))
    log('pass', k + 1, passes[-1])
    core = bad
    for e in welded.edges:     # ONE ring around the new core, not a flood
        a_, b_ = e.vertices
        if a_ in core or b_ in core:
            hit.add(a_); hit.add(b_)
    hit |= core
ok = [i for i, p_ in enumerate(passes) if p_['tris'] <= TARGET * 1.03]
best = min(ok, key=lambda i: passes[i]['max'])
devrep = dict(passes=passes, kept=best + 1)
if best != len(passes) - 1:    # re-cut the kept pass (the mesh holds the last)
    hit = set()
    for k in range(best + 1):
        lo.data = welded
        for g in list(lo.vertex_groups):
            lo.vertex_groups.remove(g)
        if k:
            vg = lo.vertex_groups.new(name='keep'); vg.add(sorted(hit), 1.0, 'REPLACE')
        r = collapse('keep' if k else None)
        core = bad_of(r)
        for e in welded.edges:
            a_, b_ = e.vertices
            if a_ in core or b_ in core:
                hit.add(a_); hit.add(b_)
        hit |= core
lo.vertex_groups.clear()
log('kept', devrep['kept'])
# collapse leaves slivers on the scan noise; a pass of degenerate-dissolve
bm = bmesh.new()
bm.from_mesh(lo.data)
bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
bm.to_mesh(lo.data)
bm.free()
lo_tris = tris_of(lo)
log('decimated ->', lo_tris, 'tris')

# ---- shading + seams on the creases, one clean atlas ----------------------
me = lo.data
for p in me.polygons:
    p.use_smooth = True
if hasattr(me, 'use_auto_smooth'):
    me.use_auto_smooth = True
    me.auto_smooth_angle = SHARP
me.uv_layers.new(name='UVMap')

# CHARTS. Smart UV on a scan scatters into thousands of islands (the surface
# noise flips each face's best axis), so the charts are segmented here: face
# normals smoothed over a few rings WITHOUT crossing a crease, each face given
# the nearest of the six axes, same-axis neighbours grown into charts, charts
# under MIN_CHART faces folded into the neighbour they share most edge with.
# Seams go on the chart borders; an angle-based unwrap then flattens each
# chart (they are near height-fields along their axis, so stretch stays low).
MIN_CHART = 40
bm = bmesh.new()
bm.from_mesh(me)
bm.faces.ensure_lookup_table()
crease = set(e.index for e in bm.edges
             if len(e.link_faces) == 2 and e.calc_face_angle(0) > SHARP)
nrm = [f.normal.copy() * f.calc_area() for f in bm.faces]
for _ in range(4):
    nxt = []
    for f in bm.faces:
        acc = nrm[f.index].copy()
        for e in f.edges:
            if e.index in crease:
                continue
            for g in e.link_faces:
                if g is not f:
                    acc += nrm[g.index]
        nxt.append(acc)
    nrm = nxt
AX = [Vector(v) for v in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))]
lab = [max(range(6), key=lambda k: n.normalized().dot(AX[k])) for n in nrm]
chart = [-1] * len(bm.faces)
members = []
for f in bm.faces:
    if chart[f.index] >= 0:
        continue
    cid = len(members); chart[f.index] = cid; st = [f]; mem = []
    while st:
        g = st.pop(); mem.append(g.index)
        for e in g.edges:
            if e.index in crease:
                continue
            for h in e.link_faces:
                if chart[h.index] < 0 and lab[h.index] == lab[f.index]:
                    chart[h.index] = cid; st.append(h)
    members.append(mem)
# fold the small charts into their best neighbour, smallest first, until none
changed = True
while changed:
    changed = False
    size = {}
    for c in chart:
        size[c] = size.get(c, 0) + 1
    for c in sorted(size, key=lambda c: size[c]):
        if size[c] >= MIN_CHART or size[c] == 0:
            continue
        share = {}
        for fi in [i for i in members[c]] if False else [i for i, x in enumerate(chart) if x == c]:
            for e in bm.faces[fi].edges:
                for h in e.link_faces:
                    d = chart[h.index]
                    if d != c:
                        share[d] = share.get(d, 0) + e.calc_length()
        if not share:
            continue
        tgt = max(share, key=share.get)
        for i, x in enumerate(chart):
            if x == c:
                chart[i] = tgt
        size[tgt] += size[c]; size[c] = 0
        changed = True
for e in bm.edges:
    lf = e.link_faces
    e.seam = len(lf) == 2 and chart[lf[0].index] != chart[lf[1].index]
    e.smooth = e.index not in crease
# PROJECTION. Each chart is first projected flat along its own mean normal:
# no solver, so no swirl (the angle-based unwrap of a big scanned table came
# out swirled and smeared the paint), and the stretch is bounded by how far
# a face leans from the chart's axis. A chart that FOLDS under its projection
# (faces facing away from the axis) or leans too far falls back to the
# angle-based unwrap, alone.
uvl = bm.loops.layers.uv.verify()
byc = {}
for f in bm.faces:
    byc.setdefault(chart[f.index], []).append(f)
abf = 0
for c, fs in byc.items():
    n = Vector((0, 0, 0))
    for f in fs:
        n += f.normal * f.calc_area()
    A = sum(f.calc_area() for f in fs) or 1
    if n.length < 1e-9:
        bad = True
    else:
        n.normalize()
        t = n.orthogonal().normalized()
        b = n.cross(t)
        fold = sum(f.calc_area() for f in fs if f.normal.dot(n) <= 0.05) / A
        steep = sum(f.calc_area() for f in fs if f.normal.dot(n) < 0.35) / A
        bad = fold > 0.01 or steep > 0.06
        for f in fs:
            for l in f.loops:
                l[uvl].uv = (l.vert.co.dot(t), l.vert.co.dot(b))
    for f in fs:
        f.select_set(bad)
    abf += bad
log('charts', len(byc), 'creases', len(crease), 'planar', len(byc) - abf, 'angle-based', abf)
bm.select_flush_mode()
bm.to_mesh(me)
bm.free()
bpy.ops.object.mode_set(mode='EDIT')
if abf:
    bpy.ops.uv.unwrap(method='ANGLE_BASED', fill_holes=True, correct_aspect=True, margin=0.0)
# every island at the same texel density: an unwrap sizes islands by their
# own angles, and a decimation sliver flattened by angle comes out a fat
# triangle that eats the atlas (the panel saw: a third of it)
bpy.ops.object.mode_set(mode='OBJECT')
from bpy_extras import mesh_utils
bm = bmesh.new()
bm.from_mesh(me)
bm.faces.ensure_lookup_table()
uvl = bm.loops.layers.uv.active
for isl in mesh_utils.mesh_linked_uv_islands(me):
    fs = [bm.faces[i] for i in isl]
    a3 = sum(f.calc_area() for f in fs)
    auv, cen, n = 0.0, Vector((0, 0)), 0
    for f in fs:
        uv = [l[uvl].uv for l in f.loops]
        for i in range(1, len(uv) - 1):
            auv += abs((uv[i] - uv[0]).cross(uv[i + 1] - uv[0])) / 2
        for u in uv:
            cen += u; n += 1
    if auv <= 0 or a3 <= 0:
        continue
    cen /= n
    k = math.sqrt(a3 / auv)
    for f in fs:
        for l in f.loops:
            l[uvl].uv = cen + (l[uvl].uv - cen) * k
bm.to_mesh(me)
bm.free()
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.context.scene.tool_settings.use_uv_select_sync = True     # mesh selection = uv selection
bpy.ops.uv.pack_islands(rotate=True, margin_method='FRACTION', margin=1.5 / SIZE * 2)
bpy.ops.object.mode_set(mode='OBJECT')

# EXPLICIT NORMALS. The creases become real vertex splits (edge split on the
# sharp edges, applied) and auto-smooth goes off: the exporter then writes
# plain per-vertex normals. Left to auto-smooth, the 3.6 exporter wrote the
# panel saw's NORMAL out of step with its positions (half the area facing
# against its own winding: random), while Blender's own split normals agreed.
es = lo.modifiers.new('es', 'EDGE_SPLIT')
es.use_edge_angle = False
es.use_edge_sharp = True
bpy.context.view_layer.objects.active = lo
bpy.ops.object.modifier_apply(modifier='es')
if hasattr(lo.data, 'use_auto_smooth'):
    lo.data.use_auto_smooth = False
me = lo.data

# UV report: per-face area distortion (uv area share / 3d area share), and
# overlap as total uv area vs packed coverage (smart project never overlaps)
bm = bmesh.new()
bm.from_mesh(me)
uvl = bm.loops.layers.uv.active
A3 = sum(f.calc_area() for f in bm.faces) or 1
rat, auv = [], 0.0
for f in bm.faces:
    uv = [l[uvl].uv for l in f.loops]
    a = 0.0
    for i in range(1, len(uv) - 1):
        a += abs((uv[i] - uv[0]).cross(uv[i + 1] - uv[0])) / 2
    auv += a
    if f.calc_area() > 0:
        rat.append((a, f.calc_area()))
bm.free()
# area-weighted: the share of the SURFACE whose texel density is off by 2x
st = sorted(((a / auv) / (s / A3), s / A3) for a, s in rat if auv > 0)
def pct(p):
    acc = 0.0
    for d, w in st:
        acc += w
        if acc >= p:
            return d
    return st[-1][0]
from bpy_extras import mesh_utils
uvrep = dict(islands=len(mesh_utils.mesh_linked_uv_islands(me)), coverage=round(auv, 3),
             dist_p05=round(pct(.05), 3), dist_p50=round(pct(.5), 3), dist_p95=round(pct(.95), 3),
             off2x=round(sum(w for d, w in st if d < .5 or d > 2), 4))
log('uv', uvrep)

# ---- bake ---------------------------------------------------------------
mat = bpy.data.materials.new('workshop_' + KEY)
mat.use_nodes = True
mat.use_backface_culling = False
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 1.0     # the scans' own: rough 1, metal 0
bsdf.inputs['Metallic'].default_value = 0.0
img_c = bpy.data.images.new(KEY + '_diff', SIZE, SIZE, alpha=False)
img_n = bpy.data.images.new(KEY + '_nor', SIZE, SIZE, alpha=False, float_buffer=False)
img_n.colorspace_settings.name = 'Non-Color'
tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = img_c
tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img_n
nm = nt.nodes.new('ShaderNodeNormalMap')
lo.data.materials.append(mat)

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 4
bk = sc.render.bake
bk.use_selected_to_active = True
bk.use_cage = False
diag = math.sqrt(sum(d * d for d in dims))
# METRIC, not scaled by the machine: the tables and guards are 2-4 cm plates,
# and an extrusion past their thickness starts the ray beyond the far face
# (the panel saw baked its undersides onto its tops). The two-pass cut holds
# the surface within ~1 cm (p99), worst cases a few cm.
bk.cage_extrusion = 0.008
bk.max_ray_distance = 0.04
bk.margin = 16
bk.margin_type = 'EXTEND'
for o in sc.objects:
    o.select_set(o in (hi, lo))
bpy.context.view_layer.objects.active = lo

nt.nodes.active = tc
for m in hi.data.materials:                     # surface <- emission
    nt_ = m.node_tree
    out_ = next(n for n in nt_.nodes if n.type == 'OUTPUT_MATERIAL')
    m['_surf'] = out_.inputs['Surface'].links[0].from_node.name
    nt_.links.new(nt_.nodes[m['_emit']].outputs['Emission'], out_.inputs['Surface'])
bpy.ops.object.bake(type='EMIT', margin=16)
for m in hi.data.materials:                     # surface <- the BSDF again
    nt_ = m.node_tree
    out_ = next(n for n in nt_.nodes if n.type == 'OUTPUT_MATERIAL')
    nt_.links.new(nt_.nodes[m['_surf']].outputs[0], out_.inputs['Surface'])
log('albedo baked', 'mean', sum(img_c.pixels[0:4 * SIZE * 256][::4]) / (SIZE * 256))
nt.nodes.active = tn
bk.normal_space = 'TANGENT'
bpy.ops.object.bake(type='NORMAL', margin=16)
log('normal baked')

# ---- export -------------------------------------------------------------
# the maps are wired only now: wired during the bake they read themselves
nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
os.makedirs(OUT_DIR, exist_ok=True)
# THE TEXTURE BUDGET: the scans shipped 4-8 diffuse maps at 512 (1-2 M texels
# a machine). The atlas goes out at 1024 (tex=1024 on the row), the normal -
# relief, low frequency at a garage's distance - at a quarter of the bake:
# baked at SIZE, box-filtered down, so the four machines carry ~5.2 M texels
# where the scans carried 6.8 M
img_n.scale(SIZE // 4, SIZE // 4)
for img, nm_ in ((img_c, '_diff.png'), (img_n, '_nor.png')):
    img.filepath_raw = os.path.join(OUT_DIR, KEY + nm_)
    img.file_format = 'PNG'
    img.save()
bpy.data.objects.remove(hi)
me = lo.data
me.calc_normals_split()
opp = sum(p.area for p in me.polygons
          if sum(me.loops[i].normal.dot(p.normal) for i in p.loop_indices) < 0)
log('split normals opposing their face: %.3f of the area, custom=%s, auto=%s'
    % (opp / max(1e-9, sum(p.area for p in me.polygons)), me.has_custom_normals,
       getattr(me, 'use_auto_smooth', None)))
for o in sc.objects:
    o.select_set(o == lo)
kw = dict(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True,
          export_normals=True, export_tangents=False, export_materials='EXPORT',
          export_image_format='AUTO', export_yup=True, export_texcoords=True)
bpy.ops.export_scene.gltf(**kw)
os.makedirs(os.path.dirname(REP), exist_ok=True)
json.dump(dict(key=KEY, src=SRC, src_tris=src_tris, lo_tris=lo_tris, target=TARGET, deviation=devrep,
               size=SIZE, dims=[round(d, 3) for d in dims], uv=uvrep,
               src_bytes=os.path.getsize(SRC), out_bytes=os.path.getsize(OUT),
               seconds=round(time.time() - t0, 1)),
          open(REP, 'w'), indent=1)
log('wrote', OUT, os.path.getsize(OUT), 'bytes')
