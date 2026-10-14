"""scenery_still.py - ASSETS-OCT: review stills of a prepped scenery model, as the game wears it
(the baked atlas, lit), Cycles on the CPU:

  blender -b --factory-startup -P tools/scenery_still.py -- <model.glb> <out prefix> [--views front,aerial,dome]
          [--size 1280x800] [--samples 48]

THE LIGHT IS FIXED, not a physical sky: a flat pale-blue sky dome at a modest strength and one sun at 32 deg,
under Filmic / Medium Contrast at exposure 0. The first observatory stills (12:15, a Nishita sky at 0.25 PLUS a
sun lamp - two suns) came out washed: the dark green ground plate read cream. Here the ground plate (albedo 0.16)
reads a mid grey-green and a 0.8 albedo wall a bright off-white, not clipped - the materials can be judged.
"""
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, PREFIX = argv[0], os.path.abspath(argv[1])   # (a relative render path does not land where the shell is)


def arg(name, dflt):
    return argv[argv.index(name) + 1] if name in argv else dflt


VIEWS_ALL = {'front': (30, 1.75, 0.10, 35), 'aerial': (150, 3.2, 0.62, 40), 'dome': (250, 1.25, 0.30, 50),
             'back': (210, 1.75, 0.10, 35)}
VIEWS = arg('--views', 'front,aerial,dome').split(',')
W_, H_ = (int(x) for x in arg('--size', '1280x800').split('x'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
ms = [o for o in bpy.context.scene.objects if o.type == 'MESH']
lo_ = Vector((1e9,) * 3); hi_ = Vector((-1e9,) * 3)
for o in ms:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo_ = Vector(map(min, lo_, w)); hi_ = Vector(map(max, hi_, w))
dims = hi_ - lo_
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = int(arg('--samples', '48'))
sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = W_, H_
sc.view_settings.view_transform = 'Filmic'
sc.view_settings.look = 'Medium Contrast'
sc.view_settings.exposure = float(arg('--exposure', '0'))
if sc.world is None:
    sc.world = bpy.data.worlds.new('W')
sc.world.use_nodes = True
bg = sc.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.42, 0.55, 0.78, 1)
bg.inputs['Strength'].default_value = 0.55
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN'))
sun.data.energy = 3.0
sun.data.angle = math.radians(1.5)
sun.data.color = (1.0, 0.96, 0.9)
sun.rotation_euler = (math.radians(58), 0, math.radians(305))
sc.collection.objects.link(sun)
bpy.ops.mesh.primitive_plane_add(size=600, location=((lo_.x + hi_.x) / 2, (lo_.y + hi_.y) / 2, lo_.z + 0.005))
gp = bpy.context.active_object
gm = bpy.data.materials.new('ground'); gm.use_nodes = True
gb = gm.node_tree.nodes['Principled BSDF']
gb.inputs['Base Color'].default_value = (0.16, 0.17, 0.11, 1)
gb.inputs['Roughness'].default_value = 0.95
gp.data.materials.append(gm)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
sc.camera = cam
cen = (lo_ + hi_) / 2
cen.z = lo_.z + dims.z * 0.42
R = max(dims)
os.makedirs(os.path.dirname(PREFIX), exist_ok=True)
for name in VIEWS:
    az, dist, el, lens = VIEWS_ALL[name]
    cam.data.lens = lens
    cam.data.clip_end = R * 50
    d = Vector((math.cos(math.radians(az)), math.sin(math.radians(az)), el)).normalized()
    cam.location = cen + d * R * dist
    cam.location.z = max(cam.location.z, lo_.z + 1.6)
    tgt = cen + Vector((0, 0, dims.z * 0.12)) if name == 'dome' else cen
    cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = 88
    sc.render.filepath = '%s_%s.jpg' % (PREFIX, name)
    bpy.ops.render.render(write_still=True)
    print('[scenery_still] wrote', sc.render.filepath, flush=True)
