#!/usr/bin/env python3
"""totem_prep.py — bake the declared TOTEM POLES (tools/totem_table.py).

Usage:  python tools/totem_prep.py            (stage the as-is bake, then cut)
        python tools/totem_prep.py --report   (inventory only, writes nothing)
        python tools/totem_prep.py --stage    (stage only; no node step)

tools/prop_prep.py's own runner pointed at a third table, with ONE difference
from the pier's: the as-is bake does not ship. A photoscan is 300-440k
triangles a pole, so the baker's output - every triangle the author shipped,
the author's normals and uvs, the maps re-encoded to the table's budget - is
written to bench/totems/ (gitignored, the bench's "original"), and
tools/totem_lod.js cuts the game-ready pack out of it: a base at the sheet's
budget and three levels a pole into src/totems/ + media/geo/totems/. The
maps are the one thing the stage writes into media/ (media/tex/totems/),
because the cuts wear them unchanged.
"""
import hashlib, importlib.util, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import prop_prep                                     # noqa: E402

_spec = importlib.util.spec_from_file_location('totem_table',
                                               os.path.join(HERE, 'totem_table.py'))
TABLE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(TABLE)

STAGE = os.path.join(ROOT, 'bench', 'totems')

CFG = dict(
    table=TABLE,
    src_dir=os.path.join(ROOT, 'assets', 'totems'),
    out_dir=STAGE,
    geo='geo', tex='tex/totems', prefix='totems_full_', packs='totems_full_packs.json',
    origin='assets/totems/, per the declared table in tools/totem_table.py (STAGED '
           'as-is bake: tools/totem_lod.js cuts the shipped pack from it)',
)


# THE STAGE. The baker writes geometry through media_lib.write_media, rooted
# at media/ - a directory GATE MEDIA holds to "every file is named by a
# shipped manifest". The as-is bins are not shipped, so for this run the
# geometry writer is re-rooted at bench/totems/ and the pruner does nothing
# (totem_lod.js owns media/geo/totems and media/tex/totems and prunes both).
def _stage_write_media(subdir, stem, ext, raw):
    h8 = hashlib.sha256(raw).hexdigest()[:8]
    rel = 'bench/totems/%s/%s.%s.%s' % (subdir, stem, h8, ext)
    ap = os.path.join(ROOT, *rel.split('/'))
    os.makedirs(os.path.dirname(ap), exist_ok=True)
    with open(ap, 'wb') as f:
        f.write(raw)
    return rel


def _stage_prune(subdir, keep):
    return []


if __name__ == '__main__':
    argv = sys.argv[1:]
    prop_prep.write_media = _stage_write_media
    prop_prep.prune_media = _stage_prune
    prop_prep.main([a for a in argv if a != '--stage'], CFG)
    if '--report' in argv or '--stage' in argv:
        sys.exit(0)
    # clear stale staged bins (the stage writer never prunes)
    gd = os.path.join(STAGE, 'geo')
    packs = json.load(open(os.path.join(STAGE, CFG['packs'])))
    keep = set()
    for f in packs:
        body = open(os.path.join(STAGE, f), encoding='utf8').read()
        for part in body.split('"bin":"')[1:]:
            keep.add(part.split('"')[0].split('/')[-1])
    for f in os.listdir(gd):
        if f not in keep:
            os.remove(os.path.join(gd, f))
    print('--- staged; cutting the shipped pack')
    sys.exit(subprocess.call(['node', os.path.join(HERE, 'totem_lod.js')]))
