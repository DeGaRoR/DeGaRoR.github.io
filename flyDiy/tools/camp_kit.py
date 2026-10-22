#!/usr/bin/env python3
"""camp_kit.py - bake the declared CAMPING KIT (tools/camp_table.py): the user's tents, ASSETS-OCT G3145.

Usage:  python tools/camp_kit.py            (the whole table)
        python tools/camp_kit.py --report   (inventory only, writes nothing)
Then:   node tools/prop_lod.js --kit camp   (the far levels: lodOf / lodDist)
        node tools/ktx2_twins.js --family camp
        node tools/_asset_budget_check.js   (GATE ASSETBUDGET: the camp rows)

The scenery kit's runner (tools/scenery_kit.py), one stage: every row is as-is, so prop_prep.py reads the
delivered file under assets/camp/. Its own packs (src/camp/camp_camp.js + camp_packs.json, loaded on demand
like the scenery's) and media (media/geo/camp/, media/tex/camp/). The credit lines ride in
src/camp/camp_credits.json.
"""
import importlib.util, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import prop_prep                                     # noqa: E402
from media_lib import asset_src                      # noqa: E402

_spec = importlib.util.spec_from_file_location('camp_table', os.path.join(HERE, 'camp_table.py'))
TABLE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(TABLE)

OUT = os.path.join(ROOT, 'src', 'camp')
CFG = dict(
    table=TABLE,
    src_dir=os.path.dirname(asset_src('assets/camp')),
    out_dir=OUT,
    geo='geo/camp', tex='tex/camp', prefix='camp_', packs='camp_packs.json',
    origin='assets/camp/ (the user\'s tents, 13 Oct), per tools/camp_table.py',
)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    prop_prep.main(sys.argv[1:], CFG)
    if '--report' not in sys.argv:
        cr = {r['key']: dict(r['credit'], label=r['label'], group=r['group']) for r in TABLE.PROPS}
        json.dump(cr, open(os.path.join(OUT, 'camp_credits.json'), 'w', newline='\n'), indent=1)
        print('credits: %d rows -> src/camp/camp_credits.json' % len(cr))
