#!/usr/bin/env python3
"""scenery_kit.py - bake the declared SCENERY KIT (tools/scenery_table.py): the
October scenery models, ASSETS-OCT G2904.

Usage:  python tools/scenery_kit.py            (the whole table)
        python tools/scenery_kit.py --report   (inventory only, writes nothing)
Then:   node tools/prop_lod.js --kit scenery   (the far levels: lodOf / lodDist)
        node tools/ktx2_twins.js --family scenery
        node tools/_scenery_check.js           (GATE SCENERY)

Stage 2 of the kit. tools/scenery_prep.py / tools/observatory_prep.py (Blender)
wrote each row's prepped source under assets/sceneryOctober_prep/<key>/ (the
cut, the atlas, the bake, the scale and the placement); an as-is row is read
from the delivered file. From here it is tools/prop_prep.py's own runner - the
pier kit's pattern (tools/pier_prep.py): the same one material, the same codec,
its own packs (src/scenery/scenery_*.js + scenery_packs.json) and media
(media/geo/scenery/, media/tex/scenery/). SCENERY-ED's model placer reads the
packs (A0, 11 Oct). The credit lines ride in src/scenery/scenery_credits.json.
"""
import importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import prop_prep                                     # noqa: E402
from media_lib import asset_src                      # noqa: E402

_spec = importlib.util.spec_from_file_location('scenery_table', os.path.join(HERE, 'scenery_table.py'))
TABLE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(TABLE)

OUT = os.path.join(ROOT, 'src', 'scenery')
CFG = dict(
    table=TABLE,
    src_dir=os.path.dirname(asset_src('assets/sceneryOctober')),
    out_dir=OUT,
    geo='geo/scenery', tex='tex/scenery', prefix='scenery_', packs='scenery_packs.json',
    origin='assets/sceneryOctober_prep/ (tools/scenery_prep.py) and assets/sceneryOctober/, per tools/scenery_table.py',
)

if __name__ == '__main__':
    prop_prep.main(sys.argv[1:], CFG)
    if '--report' not in sys.argv:
        cr = {r['key']: dict(r['credit'], label=r['label'], group=r['group']) for r in TABLE.PROPS}
        json.dump(cr, open(os.path.join(OUT, 'scenery_credits.json'), 'w', newline='\n'), indent=1)
        print('credits: %d rows -> src/scenery/scenery_credits.json' % len(cr))
