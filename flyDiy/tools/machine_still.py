"""machine_still.py - ASSET-PREP G1240: the side-by-side still, original scan
(left) vs the prepped machine (right), Cycles on the CPU (no GPU lock):

  blender -b --factory-startup -P tools/machine_still.py -- <key> <az_deg> <dist_m> <out.png>

Same light, same camera for both: a garage-distance three-quarter view.
"""
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
KEY, AZ, DIST, OUT = argv[0], float(argv[1]), float(argv[2]), argv[3]
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAIN_ASSETS = 'D:/Dev/DeGaRoR.github.io/flyDiy/assets'
own = os.path.join(ROOT, 'assets', 'props')
A = own if os.path.isdir(os.path.join(own, KEY)) else os.path.join(MAIN_ASSETS, 'props')

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def load(path):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.context.scene.objects if o not in before]
    ms = [o for o in new if o.type == 'MESH']
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for o in ms:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    roots = [o for o in new if o.parent is None]
    return roots, lo, hi


r0, lo0, hi0 = load(os.path.join(A, KEY, KEY + '.glb'))
r1, lo1, hi1 = load(os.path.join(A, KEY + '_prep', KEY + '.glb'))
span = max(hi0.x - lo0.x, hi0.y - lo0.y) * 1.15
c0 = (lo0 + hi0) / 2
c1 = (lo1 + hi1) / 2
# each centred on the same spot, rendered alone under the same camera, and
# the two frames joined: a side-by-side layout gives each its own perspective
az = math.radians(AZ)
for roots, c in ((r0, c0), (r1, c1)):
    for o in roots:
        o.location += Vector((-c.x, -c.y, -min(lo0.z, lo1.z)))
h = hi0.z - lo0.z
cam_d = bpy.data.cameras.new('cam'); cam_d.lens = 35
cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam)
fwd = Vector((math.cos(az), math.sin(az), 0))
cam.location = fwd * DIST + Vector((0, 0, 1.6))
tgt = Vector((0, 0, h * 0.45))
cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam
sun_d = bpy.data.lights.new('sun', 'SUN'); sun_d.energy = 3.0; sun_d.angle = 0.2
sun = bpy.data.objects.new('sun', sun_d); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), 0, az + math.radians(40))
w = bpy.data.worlds.new('w'); w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.57, 0.6, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
sc.world = w
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = 24
sc.cycles.use_denoising = True
sc.render.resolution_x = 900
sc.render.resolution_y = 900
sc.view_settings.view_transform = 'Standard'
import numpy as np


def kids(roots):
    out = []
    for r in roots:
        out.append(r); out.extend(r.children_recursive)
    return out


frames = []
for show, hide in ((r0, r1), (r1, r0)):
    for o in kids(show):
        o.hide_render = False
    for o in kids(hide):
        o.hide_render = True
    tmp = OUT + '.tmp.png'
    sc.render.filepath = tmp
    bpy.ops.render.render(write_still=True)
    im = bpy.data.images.load(tmp)
    frames.append(np.array(im.pixels[:]).reshape(900, 900, 4))
    bpy.data.images.remove(im)
    os.remove(tmp)
both = np.concatenate(frames, axis=1)
out = bpy.data.images.new('still', 1800, 900, alpha=False)
out.pixels[:] = both.ravel()
out.filepath_raw = OUT
out.file_format = 'PNG'
out.save()
print('[machine_still] wrote', OUT)
