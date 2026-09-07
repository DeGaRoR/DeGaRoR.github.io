"""fbx_to_glb.py — Blender headless: a Mixamo FBX -> GLB, AS-IS.

The FBX branch of the CHARACTER import (see tools/char_prep.py, which bakes
the GLB into the media store). Blender is the FBX reader because nothing in
the repo's Python parses FBX 7.7 binary with skinning, and Blender does it
correctly: the skin clusters become vertex groups, the embedded textures
come out as the author's own PNG bytes.

Two modes:
  character (default)  mesh + skin + textures, animation DROPPED (the crew
                       layer poses the rig itself)
  --anim               the CLIP: the rig's animation sampled at every frame
                       (export_force_sampling), the mesh along for the ride
                       and ignored by the baker. A Mixamo download "with
                       skin" carries the preview character too, so the same
                       FBX can be converted BOTH ways (Ch20 came out of
                       Sitting Idle.fbx).

Nothing is decimated, welded or re-textured (import-models-as-is).

Usage (from flyDiy/):
  blender -b --python tools/fbx_to_glb.py -- assets/chars/Ch42_nonPBR.fbx assets/chars/ch42.glb
  blender -b --python tools/fbx_to_glb.py -- "assets/chars/Sitting Idle.fbx" assets/chars/anim_sitidle.glb --anim
"""
import sys
import bpy

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
src, dst = argv[0], argv[1]
anim = '--anim' in argv

bpy.ops.wm.read_factory_settings(use_empty=True)
# Mixamo FBX is in centimetres with its own unit scale; let the importer apply
# the file's scale so the result is Blender metres (a 1.8 m character is 1.8).
bpy.ops.import_scene.fbx(filepath=src, use_anim=anim, ignore_leaf_bones=False,
                         automatic_bone_orientation=False,
                         use_image_search=False)
# embedded textures land as packed images; keep them packed so the GLB
# exporter writes the very bytes the FBX carried
for img in bpy.data.images:
    if img.packed_file is None and img.filepath:
        try:
            img.pack()
        except Exception as e:  # noqa
            print('pack failed', img.name, e)
kw = dict(filepath=dst, export_format='GLB',
          export_image_format='AUTO',     # PNG stays PNG
          export_texcoords=True, export_normals=True,
          export_materials='EXPORT',
          export_skins=True, export_apply=False, export_yup=True,
          export_def_bones=False)
if anim:
    # every frame, every joint: the baker resamples to its own grid, and a
    # sampled clip needs no interpolation guesswork about the FBX curves
    kw.update(export_animations=True, export_force_sampling=True,
              export_frame_step=1, export_nla_strips=False,
              export_rest_position_armature=True)
else:
    kw.update(export_animations=False, export_rest_position_armature=True)
bpy.ops.export_scene.gltf(**kw)
print('WROTE', dst, 'anim' if anim else 'character')
