#!/usr/bin/env python3
"""panel_prep.py — bake the declared PANEL HARDWARE KIT (tools/panel_table.py):
the switches, knobs, buttons and the key the cockpit's panel is fitted with
(the panel arc, session 4c).

Usage:  python tools/panel_prep.py            (the whole table)
        python tools/panel_prep.py --report   (inventory only, writes nothing)

tools/prop_prep.py's runner pointed at a third table (after the pier kit,
tools/pier_prep.py): the same as-is geometry, the same codec, with its own
packs (src/panelhw/panelhw_*.js + panelhw_packs.json) and media
(media/geo/panelhw/, media/tex/panelhw/). The hangar's registry, packs and
media are not touched.
"""
import importlib.util, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import prop_prep                                     # noqa: E402

_spec = importlib.util.spec_from_file_location('panel_table',
                                               os.path.join(HERE, 'panel_table.py'))
TABLE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(TABLE)

CFG = dict(
    table=TABLE,
    src_dir=os.path.join(ROOT, 'assets', 'interior'),
    out_dir=os.path.join(ROOT, 'src', 'panelhw'),
    geo='geo/panelhw', tex='tex/panelhw', prefix='panelhw_', packs='panelhw_packs.json',
    origin='assets/interior/, per the declared table in tools/panel_table.py',
)

if __name__ == '__main__':
    prop_prep.main(sys.argv[1:], CFG)
