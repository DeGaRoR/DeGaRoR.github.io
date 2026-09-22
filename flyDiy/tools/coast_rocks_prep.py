"""coast_rocks_prep.py - THE COAST ROCK SCANS AS ROCK SPECIES (THE ROCKY SHORE chantier, 2026-09-22,
the user: "Polyhaven has great cliff photoscans ... coastal rock scan which would probably look awesome
here, spread a few centimeters below terrain").

Poly Haven's smugglers_cove scans (assets/coastRocks/<name>/<name>_1k.gltf + .bin + textures/, fetched
from api.polyhaven.com/files/<name> - the site's zips are built on the fly) are 300-700 k triangles
each: a photoscan, not a game mesh. This runs Blender headless over each one, DECIMATES it (collapse,
UVs kept - the 1k diffuse and normal stay as the author baked them) to TRIS triangles, stands it on the
floor (min y = 0, centred in xz - the cover ring buries a rock by a fraction of its own height from its
origin) and exports one GLB per scan into assets/vegetation/rocks/, the folder tree_inspect.js files as
the ROCK kind. From there the ordinary chain: node tools/tree_inspect.js, a `tuning` row per file in
tools/_trees_tuning.json (kind rock), python tools/tree_prep.py, and a mix names the species.

    "C:/Program Files/Blender Foundation/Blender 4.0/blender.exe" -b -P tools/coast_rocks_prep.py -- [--tris 1500] [--only name]

Why one level: the cover ring ships a rock at L0 alone and instances it per 32 m cell within 220 m;
1 500 triangles for a 5-10 m slab reads whole from 20 m and costs 5 x 1 500 per cell at the shore's
density. A ladder is owed if the count bites (HANDOVER G477.2).
"""
import bpy, os, sys, math

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def opt(k, d):
    return argv[argv.index(k) + 1] if k in argv else d
TRIS = int(opt('--tris', '1500'))
ONLY = opt('--only', None)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAIN = 'D:/Dev/DeGaRoR.github.io/flyDiy/assets'
SRC = os.path.join(ROOT, 'assets', 'coastRocks')
if not os.path.isdir(SRC): SRC = os.path.join(MAIN, 'coastRocks')          # a worktree carries no link to the main checkout's assets
OUT = os.path.join(ROOT, 'assets', 'vegetation', 'rocks')
if not os.path.isdir(OUT): OUT = os.path.join(MAIN, 'vegetation', 'rocks')

SCANS = ['coast_land_rocks_02', 'coast_land_rocks_03', 'coast_land_rocks_04', 'coast_rocks_05', 'sand_rocks_small_01', 'coast_rocks_03']

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def stamp(glb, name):
    """The licence into asset.extras the way Sketchfab writes it (tree_inspect.js licenceOf reads
    `license`; GATE TREES refuses a species without one): Poly Haven is CC0. The GLB's JSON chunk is
    rewritten in place (12-byte header, chunk lengths, 4-byte padding)."""
    import json, struct
    raw = open(glb, 'rb').read()
    magic, ver, total = struct.unpack_from('<III', raw, 0)
    jlen, jtype = struct.unpack_from('<II', raw, 12)
    js = json.loads(raw[20:20 + jlen].decode('utf-8'))
    rest = raw[20 + jlen:]
    js.setdefault('asset', {})['extras'] = {'title': name.replace('_', ' '), 'author': 'Poly Haven (https://polyhaven.com)',
                                            'license': 'CC0 (https://creativecommons.org/publicdomain/zero/1.0/)',
                                            'source': 'https://polyhaven.com/a/' + name}
    jb = json.dumps(js, separators=(',', ':')).encode('utf-8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    out = struct.pack('<III', magic, ver, 12 + 8 + len(jb) + len(rest)) + struct.pack('<II', len(jb), jtype) + jb + rest
    open(glb, 'wb').write(out)

def main():
    ground = {}   # name -> {below, above}: how far the scan's own ground sits above its lowest point (tree_prep
                  # floors every subject on its lowest point, so the cover ring's `bury` fraction must carry this)
    for name in SCANS:
        if ONLY and name != ONLY: continue
        src = os.path.join(SRC, name, name + '_1k.gltf')
        if not os.path.exists(src): print('MISSING', src); continue
        clear()
        bpy.ops.import_scene.gltf(filepath=src)
        meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
        if not meshes: print('no mesh in', name); continue
        # one object: join the parts (a scan is one shell; a pack of several rocks stays one subject too -
        # the cover ring scatters subjects, and a group of three rocks IS the subject)
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes: o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        if len(meshes) > 1: bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        tris0 = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        # DECIMATE: collapse to the ratio that lands on TRIS; UVs ride the collapse (Blender keeps them)
        ratio = min(1.0, TRIS / max(1, tris0))
        if ratio < 1.0:
            mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = ratio; mod.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier='dec')
        tris1 = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        # THE WINDING: the first export drew nothing from above and everything double-sided - the scan's
        # node carried a mirror that transform_apply baked into the faces. The faces are made consistent
        # and, if the sheet's mean normal points down, flipped (a foreshore scan is an open sheet seen
        # from the sky: its normals must point up)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
        up = sum(p.normal.z * p.area for p in ob.data.polygons)
        if up < 0:
            bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.flip_normals(); bpy.ops.object.mode_set(mode='OBJECT')
            print('  %s: normals flipped up' % name)
        # THE GROUND LEVEL, CENTRED: the scan's own ground (the 15th percentile of its heights - a strip
        # carries sand and pebbles round its rocks, and its underside is not flat) goes to y = 0, so a
        # `bury` of a few centimetres puts that ground just under the terrain and the rocks above it;
        # the xz centre at the origin (glTF's up is Blender's z after import)
        xs = [v.co.x for v in ob.data.vertices]; ys = [v.co.y for v in ob.data.vertices]; zs = sorted(v.co.z for v in ob.data.vertices)
        cx, cy, z0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, zs[int(len(zs) * 0.15)]
        for v in ob.data.vertices: v.co.x -= cx; v.co.y -= cy; v.co.z -= z0
        zs = [v.co.z for v in ob.data.vertices]
        ob.name = name; ob.data.name = name
        out = os.path.join(OUT, name + '.glb')
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
        bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True,
                                  export_image_format='JPEG', export_jpeg_quality=85, export_yup=True,
                                  export_normals=True, export_texcoords=True, export_materials='EXPORT')
        stamp(out, name)
        ground[name] = {'below': round(-min(zs), 3), 'above': round(max(zs), 3), 'h': round(max(zs) - min(zs), 3)}
        print('%-22s %7d -> %5d tris  %.1f x %.1f m, %.2f m above its ground (%.2f below)  -> %s (%.1f MB)' % (name, tris0, tris1, max(xs) - min(xs), max(ys) - min(ys), max(zs), -min(zs), out, os.path.getsize(out) / 1048576))
    import json
    gp = os.path.join(OUT, 'coast_rocks_ground.json')
    old = json.load(open(gp)) if os.path.exists(gp) else {}
    old.update(ground)
    json.dump(old, open(gp, 'w'), indent=1)
    print('wrote', gp, '- the tuning rows take bury = (below + 0.05) / h from it (tools/coast_rocks_tune.py)')

main()
