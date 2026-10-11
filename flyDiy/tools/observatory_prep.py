"""observatory_prep.py - ASSETS-OCT G2903: the untextured observatory, textured
from OUR material library and baked to one game material, in Blender (3.6),
headless:

  blender -b --factory-startup -P tools/observatory_prep.py -- [--size 2048]
          [--target 20000] [--stills] [--quick]

Reads  assets/sceneryOctober/tutor_tv_observatory.glb   (delivered, never edited:
       Tommen's Maya model, CC BY 4.0, ONE material and no maps at all)
       media/tex/house/*                                   (the house library: the
       painted render, the two concretes, the weathered painted steel, the galv)
Writes assets/sceneryOctober_prep/observatory/observatory.glb  (the prepped source,
       gitignored like every bake source; tools/scenery_prep.py bakes it)
       bench/scenery/observatory.json                      (counts + the material census)
       screenshots/asset-prep/observatory_<view>.jpg       (--stills, for the user's review)

THE SCALE. Delivered 57 x 38 x 41 m with its origin 246 m off. The model is a
stylised one; the only true yardsticks in it are the stairs: two curved flights
whose up-facing treads stand 1.0 m and 0.77 m apart. At 0.25 they are 0.25 /
0.19 m risers, the door panels ~2.5 m, the vents 0.7 m, the dome 7.6 m across:
a small mountain observatory 14 x 9.4 x 10.4 m. That is the size shipped.

THE MATERIALS (my choice, for the user's review), a 1930s-50s mountain
observatory, painted and weathered:
  wall    the drum and annex walls      painted render (the neutral `paint` map) x warm lime-wash cream
  roof    flat tops above the plinth    coarse dark concrete
  ground  plinth, treads, stair flights  damaged concrete
  stone   the block band under the dome coarse dark concrete, a shade warmer
  dome    dome, shutter, cap, dish      weathered painted steel (white, rust weeping)
  scope   the telescope inside          painted steel x slate grey-green
  trim    knobs, vents' frames, rails   painted steel x bottle green
  vent    the louvred vents             galvanised sheet
Each source map is box-projected in METRES at the library's own tile size (the
house kit's contract: render 2 m, concrete 2.8 m, steel 2 m, galv 1 m), so the
texel density matches the houses' before the bake. A bump from each map's
luminance stands in for its normal map (a tangent normal needs uvs the box
projection does not have).

THE BAKE (one material, the prop recipe): the copy is collapsed to --target,
smart-unwrapped onto one atlas, and Cycles (CPU) bakes selected-to-active:
  diff  the base colour (DIFFUSE, colour pass only)              --size
  nor   tangent normal: the cut's lost curvature + the bumps      --size / 2
  arm   R ambient occlusion (the cut alone, 1.5 m), G roughness,  --size / 2
        B metalness (galv 0.85, paint 0)
"""
import bpy, bmesh, sys, os, json, math, time, glob
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def arg(name, dflt):
    return type(dflt)(argv[argv.index(name) + 1]) if name in argv else dflt


QUICK = '--quick' in argv            # a dry run: tiny maps, 1 sample, no stills
SIZE = arg('--size', 256 if QUICK else 2048)
TARGET = arg('--target', 20000)
STILLS = '--stills' in argv and not QUICK
SCALE = 0.25
ANG = arg('--angle', 55.0)
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAIN = 'D:/Dev/DeGaRoR.github.io/flyDiy'
SRC = os.path.join(MAIN, 'assets', 'sceneryOctober', 'tutor_tv_observatory.glb')
OUT_DIR = os.path.join(MAIN, 'assets', 'sceneryOctober_prep', 'observatory')
OUT = os.path.join(OUT_DIR, 'observatory.glb')
REP = os.path.join(ROOT, 'bench', 'scenery', 'observatory.json')
SHOTS = os.path.join(ROOT, 'screenshots', 'asset-prep')
LIB = os.path.join(ROOT, 'media', 'tex', 'house')
t0 = time.time()


def log(*a):
    print('[observatory_prep %5.1fs]' % (time.time() - t0), *a, flush=True)


def lib(stem):
    f = sorted(glob.glob(os.path.join(LIB, stem + '_*.*')))
    assert f, 'library map missing: ' + stem
    return f[0]


# role: (diffuse stem, tint, tile m, roughness stem or value, metal, bump strength[, clean])
# clean: the share of the map pulled toward plain paint before the tint - the library's
# weathered steel is a rust-blotched sheet; a kept dome is repainted now and then
ROLES = {
    'wall':   ('render_paint', (0.86, 0.81, 0.69), 2.0, 0.88, 0.0, 0.25),
    'roof':   ('concretec_diff', (1.0, 1.0, 1.0), 2.8, 'concretec_rough', 0.0, 0.35),
    'ground': ('concrete_diff', (1.08, 1.05, 1.0), 2.8, 'concrete_rough', 0.0, 0.35),
    'stone':  ('concretec_diff', (1.12, 1.02, 0.9), 1.4, 'concretec_rough', 0.0, 0.5),
    'dome':   ('steelgrey_diff', (0.97, 0.96, 0.93), 3.0, 'steelgrey_rough', 0.0, 0.15, 0.6),
    'scope':  ('steelgrey_diff', (0.42, 0.47, 0.46), 1.0, 'steelgrey_rough', 0.0, 0.1, 0.4),
    'trim':   ('steelgrey_diff', (0.24, 0.36, 0.27), 1.0, 'steelgrey_rough', 0.0, 0.1, 0.3),
    'vent':   ('galv_diff', (0.9, 0.9, 0.9), 1.0, 'galv_rough', 0.85, 0.1),
}
ORDER = list(ROLES)

# ---- import, join, weld, place --------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
for o in bpy.context.scene.objects:
    o.select_set(o in ms)
bpy.context.view_layer.objects.active = ms[0]
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.join()
hi = bpy.context.view_layer.objects.active
hi.name = 'HI'
for o in list(bpy.context.scene.objects):
    if o.type != 'MESH':
        bpy.data.objects.remove(o)
if hi.data.has_custom_normals:
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
bm = bmesh.new()
bm.from_mesh(hi.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
# centre x/y on the footprint, the lowest point to z 0, then the scale
xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
off = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))
for v in bm.verts:
    v.co = (v.co - off) * SCALE
dims = [(max(xs) - min(xs)) * SCALE, (max(ys) - min(ys)) * SCALE, (max(zs) - min(zs)) * SCALE]
bm.to_mesh(hi.data)
bm.free()
hi.data.update()
src_tris = sum(len(p.vertices) - 2 for p in hi.data.polygons)
log('source', src_tris, 'tris, placed at', ['%.2f' % d for d in dims], 'm')

# ---- classify: one role per face, by loose part ---------------------------
bm = bmesh.new()
bm.from_mesh(hi.data)
bm.faces.ensure_lookup_table()
parts, seen = [], set()
for f in bm.faces:
    if f.index in seen:
        continue
    st, mem = [f], []
    seen.add(f.index)
    while st:
        g = st.pop(); mem.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen:
                    seen.add(h.index); st.append(h)
    vs = {v for g in mem for v in g.verts}
    lo = Vector((min(v.co.x for v in vs), min(v.co.y for v in vs), min(v.co.z for v in vs)))
    hi_ = Vector((max(v.co.x for v in vs), max(v.co.y for v in vs), max(v.co.z for v in vs)))
    parts.append(dict(faces=mem, verts=vs, lo=lo, hi=hi_, area=sum(g.calc_area() for g in mem)))
parts.sort(key=lambda p: -p['area'])
body = parts[0]
# the dome: the biggest part whose top is the model's top half - its sphere
dome = max((p for p in parts if p['lo'].z > dims[2] * 0.4), key=lambda p: p['area'])
dc = (dome['lo'] + dome['hi']) / 2
dc.z = dome['lo'].z
dr = (dome['hi'].x - dome['lo'].x) / 2
band = (body['hi'].z - 0.9, dome['lo'].z + 0.25)    # the block band round the dome's foot
role = {}
census = {}
for p in parts:
    c = (p['lo'] + p['hi']) / 2
    size = p['hi'] - p['lo']
    rad = [(v.co - dc).length for v in p['verts']]
    if p is body:
        for g in p['faces']:
            n = g.normal
            if n.z > 0.6:
                role[g.index] = 'ground' if g.calc_center_median().z < 0.6 else 'roof'
            else:
                role[g.index] = 'wall'
        census['body'] = census.get('body', 0) + 1
        continue
    if p is dome or (c.z > dc.z and max(rad) > dr * 0.97 and min(rad) > dr * 0.75):
        r = 'dome'            # the shell, its shutter, its cap and its runners
    elif max(rad) < dr * 0.97 and c.z > dc.z - 0.5:
        r = 'scope'           # inside the sphere: the telescope and its mount
    elif p['lo'].z < 0.15 and p['area'] > 10:
        r = 'ground'          # the stair flights and the plinth pieces
    elif band[0] < c.z < band[1] and max(size) < 1.1:
        r = 'stone'
    elif p['area'] > 8:
        r = 'dome'            # the dish and the annex's big pieces: white paint
    elif 40 < len(p['faces']) and size.z > 0.5 and size.z < 0.9:
        r = 'vent'
    else:
        r = 'trim'
    census[r] = census.get(r, 0) + 1
    for g in p['faces']:
        role[g.index] = r
log('parts', len(parts), 'roles by part', census)
bm.free()

# ---- the source materials: library maps, box-projected in metres ----------
def lib_material(name, spec):
    stem, tint, tile, rough, metal, bump = spec[:6]
    clean = spec[6] if len(spec) > 6 else 0.0
    m = bpy.data.materials.new('lib_' + name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1 / tile,) * 3
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])

    def img(path, data):
        t = nt.nodes.new('ShaderNodeTexImage')
        t.image = bpy.data.images.load(path, check_existing=True)
        if data:
            t.image.colorspace_settings.name = 'Non-Color'
        t.projection = 'BOX'
        t.projection_blend = 0.25
        nt.links.new(mp.outputs['Vector'], t.inputs['Vector'])
        return t
    d = img(lib(stem), False)
    mix = nt.nodes.new('ShaderNodeMixRGB')
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Fac'].default_value = 1.0
    mix.inputs['Color2'].default_value = tuple(tint) + (1,)
    if clean:
        cl = nt.nodes.new('ShaderNodeMixRGB')
        cl.inputs['Fac'].default_value = clean
        cl.inputs['Color2'].default_value = (0.86, 0.86, 0.85, 1)
        nt.links.new(d.outputs['Color'], cl.inputs['Color1'])
        nt.links.new(cl.outputs['Color'], mix.inputs['Color1'])
    else:
        nt.links.new(d.outputs['Color'], mix.inputs['Color1'])
    nt.links.new(mix.outputs['Color'], b.inputs['Base Color'])
    if isinstance(rough, str):
        r = img(lib(rough), True)
        nt.links.new(r.outputs['Color'], b.inputs['Roughness'])
    else:                     # the set ships no roughness map: its scalar
        b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    bp = nt.nodes.new('ShaderNodeBump')
    bp.inputs['Strength'].default_value = bump
    bp.inputs['Distance'].default_value = 0.02
    nt.links.new(d.outputs['Color'], bp.inputs['Height'])
    nt.links.new(bp.outputs['Normal'], b.inputs['Normal'])
    m['metal'] = metal
    return m


hi.data.materials.clear()
for r in ORDER:
    hi.data.materials.append(lib_material(r, ROLES[r]))
for p in hi.data.polygons:
    p.material_index = ORDER.index(role[p.index])
    p.use_smooth = True
area_by = {}
for p in hi.data.polygons:
    area_by[role[p.index]] = area_by.get(role[p.index], 0) + p.area
log('area by role (m2)', {k: round(v, 1) for k, v in sorted(area_by.items())})

# ---- LO: collapse, unwrap ---------------------------------------------------
lo = hi.copy()
lo.data = hi.data.copy()
lo.name = 'LO'
bpy.context.scene.collection.objects.link(lo)
for o in bpy.context.scene.objects:
    o.select_set(o == lo)
bpy.context.view_layer.objects.active = lo
dec = lo.modifiers.new('dec', 'DECIMATE')
dec.decimate_type = 'COLLAPSE'
dec.use_collapse_triangulate = True
dec.ratio = TARGET / src_tris
bpy.ops.object.modifier_apply(modifier='dec')
lo_tris = sum(len(p.vertices) - 2 for p in lo.data.polygons)
log('collapsed ->', lo_tris, 'tris')
# deviation of the cut, measured as in machine_prep: every source vertex to the cut
from mathutils.bvhtree import BVHTree
bm_ = bmesh.new(); bm_.from_mesh(lo.data)
tree = BVHTree.FromBMesh(bm_); bm_.free()
dev = sorted(tree.find_nearest(v.co)[3] for v in hi.data.vertices)
devrep = dict(p99=round(dev[int(.99 * len(dev))], 4), max=round(dev[-1], 4))
log('deviation', devrep)
lo.data.materials.clear()
for uv in list(lo.data.uv_layers):
    lo.data.uv_layers.remove(uv)
lo.data.uv_layers.new(name='UVMap')
if hasattr(lo.data, 'use_auto_smooth'):
    lo.data.use_auto_smooth = True
    lo.data.auto_smooth_angle = math.radians(40)
bpy.ops.object.mode_set(mode='EDIT')
bpy.context.scene.tool_settings.use_uv_select_sync = True     # mesh selection = uv selection
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(ANG), island_margin=4.0 / SIZE if not QUICK else 0.004, area_weight=0.0,
                         correct_aspect=True, scale_to_bounds=False)
# smart_project packs into 0..1 but loosely (17 % coverage here); a repack.
# (margin_method='FRACTION' collapsed every island to a point headless - 19 890
# of 20 000 faces; the default margin method does not)
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.pack_islands(rotate=True, margin=3.0 / SIZE, shape_method='CONCAVE')
bpy.ops.object.mode_set(mode='OBJECT')
# explicit normals (machine_prep trap 2): split the sharp edges, auto-smooth off
es = lo.modifiers.new('es', 'EDGE_SPLIT')
es.split_angle = math.radians(40)
bpy.ops.object.modifier_apply(modifier='es')
if hasattr(lo.data, 'use_auto_smooth'):
    lo.data.use_auto_smooth = False
for p in lo.data.polygons:
    p.use_smooth = True
cover = 0.0
if os.environ.get('UVDUMP'):
    json.dump([[list(lo.data.uv_layers.active.data[i].uv) for i in p.loop_indices] for p in lo.data.polygons], open(os.environ['UVDUMP'], 'w'))
for p in lo.data.polygons:
    uv = [lo.data.uv_layers.active.data[i].uv for i in p.loop_indices]
    for i in range(1, len(uv) - 1):
        cover += abs((uv[i] - uv[0]).cross(uv[i + 1] - uv[0])) / 2
log('atlas coverage %.3f, %.1f px/m' % (cover, SIZE * math.sqrt(cover / max(1e-9, sum(area_by.values())))))

# ---- bake ---------------------------------------------------------------------
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 1 if QUICK else 16
bk = sc.render.bake
bk.margin = 8 if QUICK else 16
bk.margin_type = 'EXTEND'
mat = bpy.data.materials.new('scenery_observatory')
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']
lo.data.materials.append(mat)


def new_img(name, sz, data):
    im = bpy.data.images.new(name, sz, sz, alpha=False)
    if data:
        im.colorspace_settings.name = 'Non-Color'
    return im


def bake_into(im, kind, s2a=True, **kw):
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = im
    nt.nodes.active = t
    for o in sc.objects:
        o.select_set(o is lo or (s2a and o is hi))
    bpy.context.view_layer.objects.active = lo
    bk.use_selected_to_active = s2a
    bk.cage_extrusion = 0.02
    bk.max_ray_distance = 0.1
    bpy.ops.object.bake(type=kind, **kw)
    return t


H = SIZE // 2
img_c = new_img('observatory_diff', SIZE, False)
bk.use_pass_direct = False; bk.use_pass_indirect = False; bk.use_pass_color = True
t_c = bake_into(img_c, 'DIFFUSE', pass_filter={'COLOR'})
log('albedo baked')
img_n = new_img('observatory_nor', H, True)
bk.normal_space = 'TANGENT'
t_n = bake_into(img_n, 'NORMAL')
log('normal baked')
img_r = new_img('observatory_rough', H, True)
bake_into(img_r, 'ROUGHNESS')
log('roughness baked')
# metal: each source material's metalness through its emission, baked as EMIT
for m in hi.data.materials:
    b_ = m.node_tree.nodes['Principled BSDF']
    b_.inputs['Emission'].default_value = (m['metal'],) * 3 + (1,)
    b_.inputs['Emission Strength'].default_value = 1.0
img_m = new_img('observatory_metal', H, True)
bake_into(img_m, 'EMIT')
for m in hi.data.materials:
    m.node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.0
log('metal baked')
# AO: the cut alone (the source hidden), rays to 1.5 m
hi.hide_render = True
if sc.world is None:
    sc.world = bpy.data.worlds.new('W')
sc.world.light_settings.distance = 1.5
sc.cycles.samples = 1 if QUICK else 64
img_a = new_img('observatory_ao', H, True)
bake_into(img_a, 'AO', s2a=False)
hi.hide_render = False
log('ao baked')
# pack ARM = (AO, rough, metal) into one image named *_arm (prop_prep reads R as AO by the name)
import numpy as np
n_ = H * H * 4
px = lambda im: np.array(im.pixels[:], dtype=np.float32).reshape(-1, 4)
a_, r_, m_ = px(img_a), px(img_r), px(img_m)
arm = np.ones((H * H, 4), dtype=np.float32)
arm[:, 0] = a_[:, 0]; arm[:, 1] = r_[:, 0]; arm[:, 2] = m_[:, 0]
img_arm = new_img('observatory_arm', H, True)
img_arm.pixels[:] = arm.ravel()
log('arm: ao mean %.3f, rough mean %.3f, metal mean %.3f' % (arm[:, 0].mean(), arm[:, 1].mean(), arm[:, 2].mean()))

# ---- wire the result, export --------------------------------------------------
for n in list(nt.nodes):
    if n.type == 'TEX_IMAGE':
        nt.nodes.remove(n)
tc_ = nt.nodes.new('ShaderNodeTexImage'); tc_.image = img_c
tn_ = nt.nodes.new('ShaderNodeTexImage'); tn_.image = img_n
ta_ = nt.nodes.new('ShaderNodeTexImage'); ta_.image = img_arm
nm = nt.nodes.new('ShaderNodeNormalMap')
sp = nt.nodes.new('ShaderNodeSeparateRGB')
nt.links.new(tc_.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(tn_.outputs['Color'], nm.inputs['Color'])
nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
nt.links.new(ta_.outputs['Color'], sp.inputs['Image'])
nt.links.new(sp.outputs['G'], bsdf.inputs['Roughness'])
nt.links.new(sp.outputs['B'], bsdf.inputs['Metallic'])
# glTF occlusion: the exporter's settings group, R of the same image
gs = bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
if 'Occlusion' not in gs.inputs:
    gs.inputs.new('NodeSocketFloat', 'Occlusion')
gn = nt.nodes.new('ShaderNodeGroup'); gn.node_tree = gs
nt.links.new(sp.outputs['R'], gn.inputs['Occlusion'])
os.makedirs(OUT_DIR, exist_ok=True)
for im in (img_c, img_n, img_arm):
    im.filepath_raw = os.path.join(OUT_DIR, im.name + '.png')
    im.file_format = 'PNG'
    im.save()
for o in sc.objects:
    o.select_set(o == lo)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_apply=True,
                          export_normals=True, export_tangents=False, export_materials='EXPORT',
                          export_image_format='AUTO', export_yup=True, export_texcoords=True)
os.makedirs(os.path.dirname(REP), exist_ok=True)
json.dump(dict(key='observatory', src=SRC, scale=SCALE, src_tris=src_tris, lo_tris=lo_tris, target=TARGET,
               dims=[round(d, 3) for d in lo.dimensions], deviation=devrep, size=SIZE,
               roles={r: dict(src=ROLES[r][0], tint=ROLES[r][1], tile=ROLES[r][2], metal=ROLES[r][4],
                              clean=(ROLES[r][6] if len(ROLES[r]) > 6 else 0),
                              area_m2=round(area_by.get(r, 0), 1)) for r in ORDER},
               parts=len(parts), atlas_coverage=round(cover, 3), out_bytes=os.path.getsize(OUT),
               seconds=round(time.time() - t0, 1)), open(REP, 'w'), indent=1)
log('wrote', OUT, os.path.getsize(OUT), 'bytes')

# ---- stills: the baked cut as the game wears it, under a sky ----------------
if STILLS:
    bpy.data.objects.remove(hi)
    os.makedirs(SHOTS, exist_ok=True)
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.resolution_x, sc.render.resolution_y = 1280, 800
    sc.view_settings.view_transform = 'Filmic'
    sc.view_settings.look = 'Medium Contrast'
    w = sc.world; w.use_nodes = True
    sky = w.node_tree.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(32); sky.sun_rotation = math.radians(215)
    sky.altitude = 1500; sky.air_density = 1.0; sky.dust_density = 1.5
    w.node_tree.links.new(sky.outputs['Color'], w.node_tree.nodes['Background'].inputs['Color'])
    w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.25
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
    sun.data.energy = 3.2; sun.data.angle = math.radians(1.5)
    sun.rotation_euler = (math.radians(58), 0, math.radians(215 + 90))
    sc.collection.objects.link(sun)
    bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, 0.01))
    gp = bpy.context.active_object
    gm = bpy.data.materials.new('ground'); gm.use_nodes = True
    gb = gm.node_tree.nodes['Principled BSDF']
    gb.inputs['Base Color'].default_value = (0.16, 0.17, 0.11, 1); gb.inputs['Roughness'].default_value = 0.95
    gp.data.materials.append(gm)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cen = Vector((0, 0, lo.dimensions.z * 0.42))
    R = max(lo.dimensions)
    VIEWS = [('front', 30, 1.75, 0.10, 35), ('aerial', 150, 3.2, 0.62, 40), ('dome', 250, 1.25, 0.30, 50)]
    for name, az, dist, el, lens in VIEWS:
        cam.data.lens = lens
        d = Vector((math.cos(math.radians(az)), math.sin(math.radians(az)), el)).normalized()
        cam.location = cen + d * R * dist
        if cam.location.z < 1.6:
            cam.location.z = 1.6
        tgt = cen + Vector((0, 0, 1.2)) if name == 'dome' else cen
        cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.image_settings.file_format = 'JPEG'
        sc.render.image_settings.quality = 88
        sc.render.filepath = os.path.join(SHOTS, 'observatory_%s.jpg' % name)
        bpy.ops.render.render(write_still=True)
        log('still', sc.render.filepath)
log('done')
