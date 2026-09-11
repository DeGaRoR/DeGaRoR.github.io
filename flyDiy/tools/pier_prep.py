#!/usr/bin/env python3
"""pier_prep.py — bake the declared PIER KIT (tools/pier_table.py): the modular
wooden pier and the boats that tie up to it. G252.

Usage:  python tools/pier_prep.py            (the whole table)
        python tools/pier_prep.py --report   (inventory only, writes nothing)

It is tools/prop_prep.py's own runner pointed at a second table — the same
as-is geometry, the same one material, the same codec — with its own packs
(src/pier/pier_*.js + pier_packs.json), its own media (media/geo/pier/,
media/tex/pier/) and its own gate (GATE HOUSE reads pier_table.py). The
hangar's registry, packs and media are not touched: a pier is not in the
hangar, and GATE HANGAR would refuse a prop no kit claims.
"""
import importlib.util, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import prop_prep                                     # noqa: E402

_spec = importlib.util.spec_from_file_location('pier_table',
                                               os.path.join(HERE, 'pier_table.py'))
TABLE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(TABLE)

CFG = dict(
    table=TABLE,
    src_dir=os.path.join(ROOT, 'assets', 'woodenPierBoats'),
    out_dir=os.path.join(ROOT, 'src', 'pier'),
    geo='geo/pier', tex='tex/pier', prefix='pier_', packs='pier_packs.json',
    origin='assets/woodenPierBoats/, per the declared table in tools/pier_table.py',
)

if __name__ == '__main__':
    prop_prep.main(sys.argv[1:], CFG)
