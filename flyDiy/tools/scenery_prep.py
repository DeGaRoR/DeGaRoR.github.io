"""scenery_prep.py - ASSETS-OCT G2901: the October scenery models cut to the game
budgets of tools/scenery_table.py and reprojected onto one clean atlas each, in
Blender (3.6), headless, on the CPU:

  blender -b --factory-startup -P tools/scenery_prep.py -- <key> [--quick] [--target N] [--size N]

Reads  assets/sceneryOctober/<file>                    (delivered, never edited)
Writes assets/sceneryOctober_prep/<key>/<key>.glb      (the prepped SOURCE, gitignored;
                                                        tools/scenery_kit.py bakes it)
       bench/scenery/<key>.json                        (counts, deviation, the UV report)

It is tools/machine_prep.py's route (G1240: weld, two-pass quadric collapse with the
far-moved vertices protected, crease-aware planar charts, one atlas, Cycles CPU
selected-to-active bake), generalised past the four woodworking scans:

- THE TOLERANCE IS THE ROW'S. 1 cm was right for a bandsaw; a 74 m boiler house cut to
  60 k cannot hold it, and protecting every vertex past 1 cm would starve the budget.
  `prep.tol` (props 1 cm, buildings 3-5 cm) is the deviation that counts as a lost
  feature; the bake's extrusion is 0.8 x tol and its ray 4 x tol (the machines' ratios).
- THE ALBEDO SOURCE IS FOUND PER MATERIAL. The scans are KHR_materials_unlit (no BSDF:
  the photo is the first sRGB image), the F-104 has a normal map beside its colour (the
  FIRST image node is not the colour), the modelled ferry has 22 flat colours with no map
  at all. Each source material gets an Emission fed from what its Base Color is fed from
  (the link, else the constant) and the albedo is baked as EMIT (machine_prep's plain read).
- GLASS AND LAMPS STAY THEIR OWN MATERIALS (alpha blend / a name that says light, lamp,
  screen): they are not baked into the atlas; a plain transparent, a plain emissive.
- THE SCANS' TERRAIN IS TRIMMED (`prep.crop`): a face is TERRAIN when it faces up and all
  of it lies within 0.25 m of the lowest surface in its 2 m cell. `keep` boxes (Blender's
  import frame, metres) hold the structures; terrain survives only inside an `apron` box
  (or within `pad` metres of the structure's footprint); every other face outside the
  boxes goes. The cut edge is then SKIRTED: its boundary extruded 0.6 m straight down,
  so the placed model sinks into our ground instead of floating a lip over it.
- MODELS (route 'model') are clean meshes: one collapse pass, Smart UV (55 deg) and a
  repack, roughness / metalness / AO baked into an ARM map beside the albedo.

The placement: x/y centred on the footprint; z 0 = the scan's own ground (the median of
its kept terrain), else the lowest point; a vessel keeps its delivered waterline. The
kit bakes the rows with place 'level' (centred in plan, z kept).
"""
import bpy, bmesh, sys, os, json, math, time, importlib.util, re
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
KEY = argv[0]
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
_spec = importlib.util.spec_from_file_location('scenery_table', os.path.join(HERE, 'scenery_table.py'))
TABLE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(TABLE)
# a key is a row, or a JOB (one prep making several rows: the ALMA antenna's three parts)
ROW = TABLE.JOBS[KEY] if KEY in getattr(TABLE, 'JOBS', {}) else next(r for r in TABLE.PROPS if r['key'] == KEY)
PREP = ROW['prep']


def arg(name, dflt):
    return type(dflt)(argv[argv.index(name) + 1]) if name in argv else dflt


QUICK = '--quick' in argv
TARGET = arg('--target', PREP.get('target', 10000))
SIZE = arg('--size', 256 if QUICK else PREP.get('size', 2048))
TOL = PREP.get('tol', 0.01)
SCALE = PREP.get('scale', 1.0)
ROUTE = PREP['route']
MAIN = 'D:/Dev/DeGaRoR.github.io/flyDiy'
SRC = os.path.join(MAIN, 'assets', TABLE.SRC, ROW['delivered'])
OUT_DIR = os.path.join(MAIN, 'assets', TABLE.PREP, KEY)
OUT = os.path.join(OUT_DIR, KEY + '.glb')
REP = os.path.join(ROOT, 'bench', 'scenery', KEY + '.json')
SHARP = math.radians(40)
MARGIN = arg('--margin', PREP.get('margin', 3.0))   # px between islands, at SIZE
t0 = time.time()


def log(*a):
    print('[scenery_prep %s %6.1fs]' % (KEY, time.time() - t0), *a, flush=True)


def tris_of(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)


def select_only(*obs):
    for o in bpy.context.scene.objects:
        o.select_set(o in obs)
    bpy.context.view_layer.objects.active = obs[0]


# ---- import, join -----------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# PARTS (a job's `parts`: [(name, node), ...]): rigid pieces that move apart in the game (the ALMA
# antenna's fork turns in azimuth, its dish in elevation). Each mesh belongs to the DEEPEST listed
# node above it; each moving part's PIVOT is its node's origin, its AXIS what the delivered rig turns
# it about (two frames of its own animation compared). The pose baked is the rig's frame 1.
PARTS = PREP.get('parts') or []
PART_OF, PIVOTS = {}, {}
if PARTS:
    sc_ = bpy.context.scene
    names = [nm for _, nm in PARTS]

    def part_of(o):
        q = o
        while q is not None:
            for i, nm in enumerate(names):
                if q.name == nm or q.name.split('.')[0] == nm:
                    return i
            q = q.parent
        return 0
    for o in bpy.context.scene.objects:
        for i, nm in enumerate(names):
            if o.name == nm and i:
                # the clip may sit in an NLA track (the azimuth's does): make it the active action
                ad = o.animation_data
                if ad and not ad.action and ad.nla_tracks and ad.nla_tracks[0].strips:
                    ad.action = ad.nla_tracks[0].strips[0].action
                    ad.nla_tracks[0].mute = True
                # the turn RELATIVE TO THE PARENT (the dish's world turn carries the fork's azimuth too),
                # its axis then taken to the world by the parent's frame-1 rotation
                rel = lambda: (o.parent.matrix_world.inverted() @ o.matrix_world).to_quaternion() if o.parent                     else o.matrix_world.to_quaternion()
                sc_.frame_set(1); q1 = rel()
                pr1 = o.parent.matrix_world.to_quaternion() if o.parent else None
                best = (0.0, Vector((0, 0, 1)))
                for f_ in range(1, 241, 3):        # the widest swing over the clip names the axis
                    sc_.frame_set(f_)
                    d = rel() @ q1.inverted()
                    if d.angle > best[0] and d.angle < math.pi * 0.99:
                        best = (d.angle, Vector(d.axis))
                if pr1 is not None:
                    best = (best[0], (pr1 @ best[1]).normalized())
                PIVOTS[PARTS[i][0]] = dict(at=Vector(o.matrix_world.translation), axis=best[1],
                                           swept_deg=round(math.degrees(best[0]), 2))
    sc_.frame_set(1)
    for i, nm in enumerate(names):          # the pose at frame 1, the pivots there
        o = bpy.context.scene.objects.get(nm)
        if o is not None and PARTS[i][0] in PIVOTS:
            PIVOTS[PARTS[i][0]]['at'] = Vector(o.matrix_world.translation)
    for o in meshes:
        PART_OF[o.name] = part_of(o)
    for o in bpy.context.scene.objects:
        o.animation_data_clear()
    log('parts', {PARTS[i][0]: sum(1 for v in PART_OF.values() if v == i) for i in range(len(PARTS))},
        'pivots', {k: dict(at=[round(c, 3) for c in v['at']], axis=[round(c, 3) for c in v['axis']],
                           swept=v['swept_deg']) for k, v in PIVOTS.items()})
    # each part's faces, for the nearest-part test of the cut's faces after the bake
    from mathutils.bvhtree import BVHTree as _BVH
    _pv = {i: ([], []) for i in range(len(PARTS))}
    for o in meshes:
        vs, fs = _pv[PART_OF[o.name]]
        base = len(vs)
        vs.extend(o.matrix_world @ v.co for v in o.data.vertices)
        fs.extend([base + j for j in p_.vertices] for p_ in o.data.polygons)
    PART_SRC = _pv
select_only(*meshes)
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
src_tris = tris_of(hi)
log('source', src_tris, 'tris,', len(hi.data.materials), 'materials')


# ---- the materials: albedo source, kind -------------------------------------
def colour_source(m):
    """(socket or None, rgba constant): what the material's base colour is fed from"""
    if not m.use_nodes:
        return None, tuple(m.diffuse_color)
    nt = m.node_tree
    b = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b is not None:
        inp = b.inputs['Base Color']
        if inp.links:
            return inp.links[0].from_socket, tuple(inp.default_value)
        return None, tuple(inp.default_value)
    # unlit (KHR_materials_unlit): the first colour image, else the material's colour
    for n in nt.nodes:
        if n.type == 'TEX_IMAGE' and n.image and n.image.colorspace_settings.name != 'Non-Color':
            return n.outputs['Color'], (1, 1, 1, 1)
    for n in nt.nodes:
        if n.type == 'RGB':
            return n.outputs['Color'], (1, 1, 1, 1)
    return None, tuple(m.diffuse_color)


def kind_of(m):
    nm = m.name.lower()
    if re.search(r'light|lamp|screen', nm) and not re.search(r'grey_light|brown_light|light_grey', nm):
        return 'lamp'
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None) if m.use_nodes else None
    alpha = b.inputs['Alpha'].default_value if b is not None and not b.inputs['Alpha'].links else 1.0
    if m.blend_method == 'BLEND' and (alpha < 0.95 or 'glass' in nm):
        return 'glass'
    if 'glass' in nm and alpha < 0.95:
        return 'glass'
    return 'opaque'


KIND, BASECOL = {}, {}
for i, m in enumerate(hi.data.materials):
    KIND[i] = kind_of(m)
    sock, const = colour_source(m)
    BASECOL[i] = const
    nt = m.node_tree
    out_ = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL' and n.is_active_output) \
        if any(n.type == 'OUTPUT_MATERIAL' for n in nt.nodes) else nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    if sock is not None:
        nt.links.new(sock, em.inputs['Color'])
    else:
        em.inputs['Color'].default_value = const
    m['_emit'] = em.name
    m['_out'] = out_.name
    m['_surf'] = out_.inputs['Surface'].links[0].from_node.name if out_.inputs['Surface'].links else ''
log('materials', {k: sum(1 for v in KIND.values() if v == k) for k in ('opaque', 'glass', 'lamp')},
    [(m.name, KIND[i]) for i, m in enumerate(hi.data.materials) if KIND[i] != 'opaque'])

# ---- weld, crop, place --------------------------------------------------------
bm = bmesh.new()
bm.from_mesh(hi.data)
nv0 = len(bm.verts)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5 if ROUTE == 'scan' else 1e-4)
log('welded', nv0, '->', len(bm.verts))
crop = PREP.get('crop') or {}
cropped = 0
ground_z = None
if crop.get('keep') or crop.get('pad') is not None:
    CELL = 2.0
    # the ground: the lowest UP-facing surface per cell (a scan's base is often a slab with
    # a bottom face - its lowest point is under the ground the machine stands on)
    low = {}
    for f in bm.faces:
        if f.normal.z <= 0.5:
            continue
        for v in f.verts:
            c = (math.floor(v.co.x / CELL), math.floor(v.co.y / CELL))
            if v.co.z < low.get(c, 1e9):
                low[c] = v.co.z

    def ground_of(co):
        c = (math.floor(co.x / CELL), math.floor(co.y / CELL))
        g = min(low.get((c[0] + dx, c[1] + dy), 1e9) for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        return g if g < 1e8 else -1e9

    terrain = set()
    for f in bm.faces:
        if f.normal.z > 0.5 and all(v.co.z - ground_of(v.co) < 0.25 for v in f.verts):
            terrain.add(f.index)

    def inside(co, boxes, grow=0.0):
        return any(x0 - grow <= co.x <= x1 + grow and y0 - grow <= co.y <= y1 + grow for x0, x1, y0, y1 in boxes)

    keep_boxes = crop.get('keep')
    if keep_boxes is None:      # the structure: what stands 0.3 m clear of the ground
        st = [f for f in bm.faces if f.index not in terrain
              and max(v.co.z - ground_of(v.co) for v in f.verts) > 0.3]
        xs = [v.co.x for f in st for v in f.verts]; ys = [v.co.y for f in st for v in f.verts]
        keep_boxes = [(min(xs), max(xs), min(ys), max(ys))]
    aprons = crop.get('apron') or [(x0 - crop.get('pad', 0), x1 + crop.get('pad', 0),
                                    y0 - crop.get('pad', 0), y1 + crop.get('pad', 0)) for x0, x1, y0, y1 in keep_boxes]
    gone = []
    for f in bm.faces:
        c = f.calc_center_median()
        if all(v.co.z < ground_of(v.co) + 0.02 for v in f.verts) and f.normal.z < 0.5:
            gone.append(f)          # the slab's underside and its sides: under our ground
        elif f.index in terrain:
            if not inside(c, aprons):
                gone.append(f)
        elif not inside(c, keep_boxes):
            gone.append(f)
    cropped = len(gone)
    gset = set(gone)
    gz = sorted(v.co.z for f in bm.faces if f.index in terrain and f not in gset for v in f.verts)
    ground_z = gz[len(gz) // 2] if gz else None
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    # loose bits the cut left (a shrub's top, a stray chip under 0.5 m2) go too
    bm.faces.ensure_lookup_table()
    seen, small = set(), []
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
        if sum(g.calc_area() for g in mem) < 0.5 and ROUTE == 'scan' and SCALE * max(
                (max(v.co[k] for g in mem for v in g.verts) - min(v.co[k] for g in mem for v in g.verts)) for k in range(3)) < 1.0:
            small += mem
    bmesh.ops.delete(bm, geom=list(set(small)), context='FACES')
    log('crop: %d faces dropped (%d terrain faces found), %d in loose chips' % (cropped, len(terrain), len(set(small))))
xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
# z 0: a scan's own ground (the median of its kept terrain) when it has one - the model
# then stands on our ground the way it stood on its own; else the lowest point
z0 = 0 if ROW['group'] == 'vessel' else (ground_z if ground_z is not None else min(zs))
off = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, z0))
for v in bm.verts:
    v.co = (v.co - off) * SCALE
for k_ in PIVOTS:
    PIVOTS[k_]['at'] = (PIVOTS[k_]['at'] - off) * SCALE
if PARTS:
    PART_TREES = {i: BVHTree.FromPolygons([(v - off) * SCALE for v in vs], fs) for i, (vs, fs) in PART_SRC.items() if fs}
# the skirt: the cut edge's boundary straight down 0.6 m
if crop:
    bnd = [e for e in bm.edges if e.is_boundary and min(v.co.z for v in e.verts) < 1.0]
    if bnd:
        r = bmesh.ops.extrude_edge_only(bm, edges=bnd)
        nv = [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]
        for v in nv:
            v.co.z -= 0.6
        log('skirt:', len(bnd), 'boundary edges extruded 0.6 m down')
bm.to_mesh(hi.data)
bm.free()
hi.data.update()
dims = [max(v.co[k] for v in hi.data.vertices) - min(v.co[k] for v in hi.data.vertices) for k in range(3)]
hi_tris = tris_of(hi)
log('placed: %d tris, %.2f x %.2f x %.2f m (scale %.3f), ground z %s, top %.2f m above it'
    % (hi_tris, dims[0], dims[1], dims[2], SCALE, ground_z, max(v.co.z for v in hi.data.vertices)))

# ---- LO: collapse ---------------------------------------------------------------
lo = hi.copy()
lo.data = hi.data.copy()
lo.name = 'LO'
bpy.context.scene.collection.objects.link(lo)
select_only(lo)
welded = lo.data.copy()


def collapse(group=None):
    lo.data = welded.copy()
    dec = lo.modifiers.new('dec', 'DECIMATE')
    dec.decimate_type = 'COLLAPSE'
    dec.use_collapse_triangulate = True
    dec.ratio = min(1.0, TARGET / max(1, tris_of(lo)))
    if group:
        dec.vertex_group = group
        dec.vertex_group_factor = 10.0
        dec.invert_vertex_group = True
    select_only(lo)
    bpy.ops.object.modifier_apply(modifier='dec')
    bm_ = bmesh.new(); bm_.from_mesh(lo.data)
    tree = BVHTree.FromBMesh(bm_)
    bm_.free()
    return [tree.find_nearest(v.co)[3] for v in welded.vertices]


def dev_rep(r):
    s_ = sorted(r)
    return dict(p99=round(s_[int(.99 * len(s_))], 4), max=round(s_[-1], 4), over_tol=sum(1 for d in r if d > TOL))


def grow(core):
    hit = set(core)
    for e in welded.edges:
        a_, b_ = e.vertices
        if a_ in core or b_ in core:
            hit.add(a_); hit.add(b_)
    return hit


passes = []
r = collapse()
passes.append(dict(dev_rep(r), tris=tris_of(lo)))
log('pass 1', passes[-1])
if ROUTE == 'scan':
    # the protected core is capped at the worst 8 % of the vertices: past that the
    # budget cannot be met and pass 2 overshoots (the loader at 1 cm: 72 % protected,
    # 38 k tris for a 10 k target)
    far = sorted((d, i) for i, d in enumerate(r) if d > TOL)[::-1][:int(0.08 * len(r))]
    hit = grow({i for d, i in far})
    lo.data = welded
    for g in list(lo.vertex_groups):
        lo.vertex_groups.remove(g)
    vg = lo.vertex_groups.new(name='keep')
    vg.add(sorted(hit), 1.0, 'REPLACE')
    r2 = collapse('keep')
    passes.append(dict(dev_rep(r2), tris=tris_of(lo), protected=len(hit)))
    log('pass 2', passes[-1])
    # pass 2 is kept for a LOWER worst case, or the same worst case and a lower p99 (the heating plant's
    # dry run: both 25 cm worst, pass 2's p99 5.4 cm against 4.6 - pass 1 is the better cut)
    p1, p2 = passes
    if p2['tris'] > TARGET * 1.03 or (p2['max'], p2['p99']) >= (p1['max'], p1['p99']):
        lo.data = welded
        lo.vertex_groups.clear()
        collapse()
        kept = 1
    else:
        kept = 2
    lo.vertex_groups.clear()
else:
    kept = 1
devrep = dict(passes=passes, kept=kept)
bm = bmesh.new()
bm.from_mesh(lo.data)
bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=1e-5)
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
bm.to_mesh(lo.data)
bm.free()
lo_tris = tris_of(lo)
log('cut ->', lo_tris, 'tris, kept pass', kept)

# ---- split off the glass and the lamps (not baked) --------------------------------
special = {}
# the glass is one material (one plain transparent); each lamp keeps its own colour
GROUPS_ = [('glass', [i for i, v in KIND.items() if v == 'glass'])] +     [('lamp%d' % i, [i]) for i, v in KIND.items() if v == 'lamp']
for k, idx in GROUPS_:
    if not idx or not any(p.material_index in idx for p in lo.data.polygons):
        continue
    select_only(lo)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bpy.ops.object.mode_set(mode='OBJECT')
    for p in lo.data.polygons:
        p.select = p.material_index in idx
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    sep = [o for o in bpy.context.selected_objects if o is not lo][0]
    sep.name = k.upper()
    # one plain material: the area-weighted mean of its source colours
    acc, aw = [0, 0, 0, 0], 0
    for p in sep.data.polygons:
        c = BASECOL[p.material_index]
        for j in range(4):
            acc[j] += c[j] * p.area
        aw += p.area
    col = [a / max(aw, 1e-9) for a in acc]
    mm = bpy.data.materials.new('scenery_%s_%s' % (KEY, k))
    mm.use_nodes = True
    b = mm.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (col[0], col[1], col[2], 1)
    if k == 'glass':
        b.inputs['Alpha'].default_value = min(0.45, max(0.2, col[3]))
        b.inputs['Roughness'].default_value = 0.08
        mm.blend_method = 'BLEND'
    else:
        m_ = hi.data.materials[idx[0]]
        b0 = next((n for n in m_.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if b0 is not None and max(b0.inputs['Emission'].default_value[:3]) > 0.05:
            col = list(b0.inputs['Emission'].default_value[:3]) + [1]    # glTF's emissiveFactor
        elif max(col[:3]) > 0.9 and min(col[:3]) > 0.9:      # a white factor over a map: read the map's mean
            img = next((n.image for n in m_.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image), None)
            if img is not None and len(img.pixels):
                pxs = img.pixels[:]
                col = [sum(pxs[j::4]) / (len(pxs) // 4) for j in range(3)] + [1]
            else:                   # a bare material (the boat's): its name is all it says
                nmn = m_.name.lower()
                col = ([0.1, 0.9, 0.25] if 'green' in nmn else [0.95, 0.12, 0.05] if 'red' in nmn
                       else [0.15, 0.3, 0.35] if 'screen' in nmn else [1.0, 0.9, 0.7]) + [1]
        b.inputs['Emission'].default_value = (col[0], col[1], col[2], 1)
        b.inputs['Emission Strength'].default_value = 1.0
    sep.data.materials.clear()
    sep.data.materials.append(mm)
    special[k] = sep
    log(k, 'split off:', tris_of(sep), 'tris, colour', ['%.2f' % c for c in col])

# ---- unwrap -----------------------------------------------------------------------
me = lo.data
me.materials.clear()
while me.uv_layers:            # (removing from a list() of them leaves stale names)
    me.uv_layers.remove(me.uv_layers[0])
me.uv_layers.new(name='UVMap')
for p in me.polygons:
    p.use_smooth = True
from bpy_extras import mesh_utils
if ROUTE == 'scan':
    # machine_prep's charts: normals smoothed over 4 rings without crossing a crease,
    # six-axis labels, grown, < MIN_CHART faces folded into the neighbour they share
    # most edge with; each chart planar along its mean normal, angle-based where it folds
    MIN_CHART = 40
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    crease = set(e.index for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0) > SHARP)
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
    # fold the small charts (member lists kept, not rescanned: 60 k faces x thousands of
    # charts was machine_prep's O(n^2) - fine at 13 k, not at a building)
    changed = True
    while changed:
        changed = False
        for c in sorted(range(len(members)), key=lambda c: len(members[c])):
            if not members[c] or len(members[c]) >= MIN_CHART:
                continue
            share = {}
            for fi in members[c]:
                for e in bm.faces[fi].edges:
                    for h in e.link_faces:
                        d = chart[h.index]
                        if d != c:
                            share[d] = share.get(d, 0) + e.calc_length()
            if not share:
                continue
            tgt = max(share, key=share.get)
            for fi in members[c]:
                chart[fi] = tgt
            members[tgt] += members[c]
            members[c] = []
            changed = True
    for e in bm.edges:
        lf = e.link_faces
        e.seam = len(lf) == 2 and chart[lf[0].index] != chart[lf[1].index]
        e.smooth = e.index not in crease
    uvl = bm.loops.layers.uv.verify()
    abf = 0
    nch = 0
    for c, fis in enumerate(members):
        if not fis:
            continue
        nch += 1
        fs = [bm.faces[i] for i in fis]
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
    log('charts', nch, 'creases', len(crease), 'planar', nch - abf, 'angle-based', abf)
    bm.select_flush_mode()
    bm.to_mesh(me)
    bm.free()
    select_only(lo)
    bpy.ops.object.mode_set(mode='EDIT')
    if abf:
        bpy.ops.uv.unwrap(method='ANGLE_BASED', fill_holes=True, correct_aspect=True, margin=0.0)
    bpy.ops.object.mode_set(mode='OBJECT')
    # every island at one texel density
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
    bpy.context.scene.tool_settings.use_uv_select_sync = True
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=MARGIN / SIZE, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
else:
    if hasattr(me, 'use_auto_smooth'):
        me.use_auto_smooth = True
        me.auto_smooth_angle = SHARP
    bm = bmesh.new()
    bm.from_mesh(me)
    for e in bm.edges:
        e.smooth = not (len(e.link_faces) == 2 and e.calc_face_angle(0) > SHARP)
    bm.to_mesh(me)
    bm.free()
    select_only(lo)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.context.scene.tool_settings.use_uv_select_sync = True
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=MARGIN / SIZE, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    # (margin_method='FRACTION' collapsed every island to a point headless; the default does not)
    bpy.ops.uv.pack_islands(rotate=True, margin=MARGIN / SIZE, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
# explicit normals (machine_prep trap 2)
select_only(lo)
es = lo.modifiers.new('es', 'EDGE_SPLIT')
es.use_edge_angle = ROUTE != 'scan'
es.split_angle = SHARP
es.use_edge_sharp = True
bpy.ops.object.modifier_apply(modifier='es')
if hasattr(lo.data, 'use_auto_smooth'):
    lo.data.use_auto_smooth = False
me = lo.data
# UV report
A3 = sum(p.area for p in me.polygons) or 1
uvd = me.uv_layers.active.data
rat, auv = [], 0.0
for p in me.polygons:
    uv = [uvd[i].uv for i in p.loop_indices]
    a = sum(abs((uv[i] - uv[0]).cross(uv[i + 1] - uv[0])) / 2 for i in range(1, len(uv) - 1))
    auv += a
    if p.area > 0:
        rat.append((a, p.area))
st = sorted(((a / max(auv, 1e-12)) / (s / A3), s / A3) for a, s in rat)
uvrep = dict(islands=len(mesh_utils.mesh_linked_uv_islands(me)), coverage=round(auv, 3),
             px_per_m=round(SIZE * math.sqrt(auv / A3), 1),
             off2x=round(sum(w for d, w in st if d < .5 or d > 2), 4))
log('uv', uvrep)

# ---- bake -----------------------------------------------------------------------
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 1 if QUICK else 4
bk = sc.render.bake
bk.use_selected_to_active = True
bk.use_cage = False
bk.cage_extrusion = 0.8 * TOL
bk.max_ray_distance = 4 * TOL
bk.margin = 16
bk.margin_type = 'EXTEND'
mat = bpy.data.materials.new('scenery_' + KEY)
mat.use_nodes = True
mat.use_backface_culling = False
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']
me.materials.append(mat)
for o in special.values():
    o.hide_render = True


def new_img(name, sz, data):
    im = bpy.data.images.new(name, sz, sz, alpha=False)
    if data:
        im.colorspace_settings.name = 'Non-Color'
    return im


def bake_into(im, kind, s2a=True):
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = im
    nt.nodes.active = t
    for o in sc.objects:
        o.select_set(o is lo or (s2a and o is hi))
    bpy.context.view_layer.objects.active = lo
    bk.use_selected_to_active = s2a
    bpy.ops.object.bake(type=kind)


def surface(which):
    for m in hi.data.materials:
        t_ = m.node_tree
        out_ = t_.nodes[m['_out']]
        src = m['_emit'] if which == 'emit' else m['_surf']
        if src:
            t_.links.new(t_.nodes[src].outputs[0], out_.inputs['Surface'])


H = max(64, SIZE // 2)
img_c = new_img(KEY + '_diff', SIZE, False)
surface('emit')
bake_into(img_c, 'EMIT')
surface('bsdf')
log('albedo baked')
img_n = new_img(KEY + '_nor', SIZE, True)
bk.normal_space = 'TANGENT'
bake_into(img_n, 'NORMAL')
img_n.scale(H, H)
log('normal baked')
img_arm = None
if ROUTE == 'model':
    import numpy as np
    img_r = new_img(KEY + '_rough', H, True)
    bake_into(img_r, 'ROUGHNESS')
    for m in hi.data.materials:
        b_ = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        mv = b_.inputs['Metallic'].default_value if b_ is not None else 0.0
        m.node_tree.nodes[m['_emit']].inputs['Color'].default_value = (mv, mv, mv, 1)
        for l in list(m.node_tree.nodes[m['_emit']].inputs['Color'].links):
            m.node_tree.links.remove(l)
    img_m = new_img(KEY + '_metal', H, True)
    surface('emit')
    bake_into(img_m, 'EMIT')
    surface('bsdf')
    hi.hide_render = True
    if sc.world is None:
        sc.world = bpy.data.worlds.new('W')
    sc.world.light_settings.distance = max(0.5, max(dims) * SCALE * 0.05)
    sc.cycles.samples = 1 if QUICK else 48
    img_a = new_img(KEY + '_ao', H, True)
    bake_into(img_a, 'AO', s2a=False)
    hi.hide_render = False
    px = lambda im: np.array(im.pixels[:], dtype=np.float32).reshape(-1, 4)
    a_, r_, m_ = px(img_a), px(img_r), px(img_m)
    arm = np.ones((H * H, 4), dtype=np.float32)
    arm[:, 0] = a_[:, 0]; arm[:, 1] = r_[:, 0]; arm[:, 2] = m_[:, 0]
    img_arm = new_img(KEY + '_arm', H, True)
    img_arm.pixels[:] = arm.ravel()
    log('arm baked: ao %.3f rough %.3f metal %.3f' % tuple(arm[:, k].mean() for k in range(3)))
else:
    bsdf.inputs['Roughness'].default_value = 1.0      # the scans' own: rough 1, metal 0
    bsdf.inputs['Metallic'].default_value = 0.0

# ---- wire, export -------------------------------------------------------------------
for n in list(nt.nodes):
    if n.type == 'TEX_IMAGE':
        nt.nodes.remove(n)
tc = nt.nodes.new('ShaderNodeTexImage'); tc.image = img_c
tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img_n
nm = nt.nodes.new('ShaderNodeNormalMap')
nt.links.new(tc.outputs['Color'], bsdf.inputs['Base Color'])
nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
if img_arm is not None:
    ta = nt.nodes.new('ShaderNodeTexImage'); ta.image = img_arm
    sp = nt.nodes.new('ShaderNodeSeparateRGB')
    nt.links.new(ta.outputs['Color'], sp.inputs['Image'])
    nt.links.new(sp.outputs['G'], bsdf.inputs['Roughness'])
    nt.links.new(sp.outputs['B'], bsdf.inputs['Metallic'])
    gs = bpy.data.node_groups.get('glTF Material Output') or bpy.data.node_groups.new('glTF Material Output', 'ShaderNodeTree')
    if 'Occlusion' not in gs.inputs:
        gs.inputs.new('NodeSocketFloat', 'Occlusion')
    gn = nt.nodes.new('ShaderNodeGroup'); gn.node_tree = gs
    nt.links.new(sp.outputs['R'], gn.inputs['Occlusion'])
os.makedirs(OUT_DIR, exist_ok=True)
for im in [img_c, img_n] + ([img_arm] if img_arm is not None else []):
    im.filepath_raw = os.path.join(OUT_DIR, im.name + '.png')
    im.file_format = 'PNG'
    im.save()
bpy.data.objects.remove(hi)
for o in special.values():
    o.hide_render = False
GLTF_KW = dict(export_format='GLB', use_selection=True, export_apply=True, export_normals=True,
               export_tangents=False, export_materials='EXPORT', export_image_format='AUTO',
               export_yup=True, export_texcoords=True)
ASSEMBLY = None
if PARTS:
    # each face of the cut (and of the glass / lamps) to the part whose source faces are nearest;
    # one GLB a part, all in the ONE frame of the assembly (the rows bake them with place 'mount')
    def split_by_part(ob):
        out = {}
        for i in range(len(PARTS)):
            bm_ = bmesh.new(); bm_.from_mesh(ob.data)
            def near(j, c):
                d = PART_TREES[j].find_nearest(c)[3]
                return 1e9 if d is None else d          # (a distance of 0.0 is the nearest, not "none")
            gone = [f for f in bm_.faces if min((near(j, f.calc_center_median()), j) for j in PART_TREES)[1] != i]
            bmesh.ops.delete(bm_, geom=gone, context='FACES')
            if not bm_.faces:
                bm_.free(); continue
            me_ = bpy.data.meshes.new('%s_%s' % (ob.name, PARTS[i][0]))
            bm_.to_mesh(me_); bm_.free()
            for m_ in ob.data.materials:
                me_.materials.append(m_)
            o_ = bpy.data.objects.new(me_.name, me_)
            bpy.context.scene.collection.objects.link(o_)
            out[i] = o_
        return out
    pieces = [split_by_part(o) for o in [lo] + list(special.values())]
    files, tris_by = {}, {}
    for i, (pn, _) in enumerate(PARTS):
        obs = [d[i] for d in pieces if i in d]
        tris_by[pn] = sum(tris_of(o) for o in obs)
        f_ = os.path.join(OUT_DIR, '%s_%s.glb' % (KEY, pn))
        select_only(*obs)
        bpy.ops.export_scene.gltf(filepath=f_, **GLTF_KW)
        files[pn] = os.path.basename(f_)
    # the assembly the placer reads: pivots and axes in the GAME's frame (glTF: x, z up -> y, -y -> z)
    g = lambda v: [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]
    tops = {}
    for i, o_ in pieces[0].items():
        zs_ = [v.co.z for v in o_.data.vertices]
        top = max(o_.data.vertices, key=lambda v: v.co.z).co
        cx = sum(v.co.x for v in o_.data.vertices) / len(o_.data.vertices)
        cy = sum(v.co.y for v in o_.data.vertices) / len(o_.data.vertices)
        tops[PARTS[i][0]] = dict(top=Vector((cx, cy, max(zs_))), lo=min(zs_),
                                 rimx=max(v.co.x for v in o_.data.vertices))
    LIGHTS = []
    for L in PREP.get('lights', []):
        if L['at'] == 'top':
            at = tops[L['part']]['top'] + Vector((0, 0, 0.25))
        elif L['at'] == 'rim':
            t_ = tops[L['part']]
            at = Vector((t_['rimx'], t_['top'].y, t_['top'].z))
        else:                                   # metres in the delivered frame, scaled with the model
            at = (Vector(L['at']) - off) * SCALE
        LIGHTS.append(dict(kind=L['kind'], part=L['part'], at=g(at), note=L.get('note', '')))
    ASSEMBLY = dict(of=KEY, parts=[dict(part=pn, row='%s_%s' % (KEY, pn), file=files[pn], tris=tris_by[pn],
                                        **({'pivot': g(PIVOTS[pn]['at']), 'axis': g(PIVOTS[pn]['axis']),
                                            'parent': PARTS[i - 1][0], 'rig_swept_deg': PIVOTS[pn]['swept_deg']}
                                           if pn in PIVOTS else {}))
                                   for i, (pn, _) in enumerate(PARTS)],
                    lights=LIGHTS, motion=PREP.get('motion'))
    OUT = os.path.join(OUT_DIR, files[PARTS[0][0]])
    log('assembly', json.dumps(ASSEMBLY))
else:
    select_only(lo, *special.values())
    bpy.ops.export_scene.gltf(filepath=OUT, **GLTF_KW)
os.makedirs(os.path.dirname(REP), exist_ok=True)
json.dump(dict(key=KEY, src=SRC, route=ROUTE, src_tris=src_tris, cropped_faces=cropped, hi_tris=hi_tris,
               lo_tris=lo_tris + sum(tris_of(o) for o in special.values()), target=TARGET, tol=TOL,
               scale=SCALE, deviation=devrep, size=SIZE, dims=[round(d, 3) for d in dims], uv=uvrep,
               special={k: tris_of(o) for k, o in special.items()}, assembly=ASSEMBLY,
               src_bytes=os.path.getsize(SRC), out_bytes=os.path.getsize(OUT),
               seconds=round(time.time() - t0, 1)), open(REP, 'w'), indent=1)
if ASSEMBLY:
    # committed beside the packs: the placer's assembly record (src/scenery/scenery_assembly.json)
    af = os.path.join(ROOT, 'src', 'scenery', 'scenery_assembly.json')
    os.makedirs(os.path.dirname(af), exist_ok=True)
    try:
        allA = json.load(open(af))
    except Exception:
        allA = {}
    allA[KEY] = ASSEMBLY
    json.dump(allA, open(af, 'w', newline='\n'), indent=1)
log('wrote', OUT, os.path.getsize(OUT), 'bytes')
