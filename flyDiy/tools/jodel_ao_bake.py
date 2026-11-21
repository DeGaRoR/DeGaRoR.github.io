"""jodel_ao_bake.py - AMBIENT OCCLUSION BAKED ONTO THE AIRFRAMES IN BUILD, the Blender way (GARAGE-FIXES, the user 21 Nov:
"We'd need to bake AO on the wing and fuselage in construction in the garage, using the typical blender AO method and a proper
UV unwrap").

For each piece jodel_prep.py bakes (the DR1050 fuselage structure, the wing structure): the OBJ imported as modelled (metres,
Y-up), its objects joined into one mesh (its four materials kept), a SMART UV PROJECT over the whole piece (one atlas: a thin
longeron is a long thin island, a former a flat one - angle limit 66 deg, 0.4 % island margin, islands scaled by their area),
then Cycles' AMBIENT OCCLUSION bake into one image (CPU, 256 samples (no grain on the plates), the occlusion distance 0.35 m - a longeron darkens the
former it crosses, the far side of the fuselage does not darken the near), 8 px of margin round every island. Written beside
the source: <stem>_ao.obj (the same geometry with its uv) and <stem>_ao.png (the occlusion, grey). jodel_prep.py reads both
(the uv into the codec's field, the AO into the arm map's R).

  "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -t 4 -P tools/jodel_ao_bake.py -- [--size 2048] [--only body|wing]

Run from flyDiy/. Deterministic for a given Blender version (the unwrap and Cycles' seeded sampling); the outputs are committed.
"""
import math
import os
import sys

import bpy

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'jodel_structure')
PIECES = {
    'body': 'speedJojo_structurefuselageFull_optimized4.obj',
    'wing': 'speedJojo_structureAileFull_optimized.obj',
}
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opt = lambda k, d: argv[argv.index('--' + k) + 1] if ('--' + k) in argv else d
SIZE = int(opt('size', '2048'))
ONLY = opt('only', None)
AO_DIST = 0.35
SAMPLES = 256


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def bake_piece(key, fname):
    reset()
    src = os.path.join(SRC, fname)
    stem = os.path.splitext(fname)[0]
    bpy.ops.wm.obj_import(filepath=src, forward_axis='NEGATIVE_Z', up_axis='Y')
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    print('%s: %d objects from %s' % (key, len(meshes), fname))
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    # THE UNWRAP: one atlas for the whole piece
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66.0), island_margin=0.004, area_weight=1.0,
                             correct_aspect=True, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    # THE TARGET: one image, every material's active image node
    img = bpy.data.images.new(key + '_ao', SIZE, SIZE, alpha=False, float_buffer=False)
    img.generated_color = (1, 1, 1, 1)
    for slot in ob.material_slots:
        m = slot.material
        if m is None:
            continue
        m.use_nodes = True
        nt = m.node_tree
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = img
        n.select = True
        nt.nodes.active = n
    # THE BAKE: Cycles' ambient occlusion
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.light_settings.distance = AO_DIST
    sc.render.bake.margin = 8
    sc.render.bake.use_clear = True
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='AO', margin=8, use_clear=True)
    png = os.path.join(SRC, stem + '_ao.png')
    img.filepath_raw = png
    img.file_format = 'PNG'
    img.save()
    obj = os.path.join(SRC, stem + '_ao.obj')
    bpy.ops.wm.obj_export(filepath=obj, export_selected_objects=True, export_uv=True, export_normals=True,
                          export_materials=True, forward_axis='NEGATIVE_Z', up_axis='Y', apply_modifiers=True,
                          export_triangulated_mesh=False, path_mode='STRIP')
    print('%s: wrote %s and %s' % (key, os.path.basename(obj), os.path.basename(png)))


for k, f in PIECES.items():
    if ONLY and k != ONLY:
        continue
    bake_piece(k, f)
print('jodel_ao_bake: done')
