"""tree_pack_js.py - re-write src/viewer/trees_pack.js (what the PAGE reads: TREE_PACK) from src/core/trees_pack.json (what node,
the gates and the benches read), with tree_prep.py's own writer - no bake, no GLB needed.

WHY (MOUNTAIN-VEG, 17 Nov 2026): the pack's mixes and species rows were edited in trees_pack.json from 15 Nov on (the subalpine's
conifers and density, the shrub cards and their colours, the muskeg's clumps, the cards per biome, the lake shore, the alpine
zones, the ferns, the water lily, the pines' tints) - the gates and the bench saw them, the GAME did not: the page reads the baked
trees_pack.js, which only tree_prep writes (a full bake, or --biomes from the tuning). Run this after any edit to trees_pack.json
(GATE TREEPACKJS holds the two in step).

    python tools/tree_pack_js.py            write trees_pack.js from trees_pack.json
    python tools/tree_pack_js.py --check    exit 1 if trees_pack.js is not what the json writes (the gate)
"""
import json, os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from media_lib import BASE_DECL
OUT = os.path.join(ROOT, 'src', 'core', 'trees_pack.json')
OUTJS = os.path.join(ROOT, 'src', 'viewer', 'trees_pack.js')


def render(pack):
    """tree_prep.py main()'s writer, verbatim."""
    NL = chr(10)
    body = ('{"note": ' + json.dumps(pack['note']) + ',' + NL + ' "collections": [' + NL + '  ' +
            (',' + NL + '  ').join(json.dumps(c, separators=(',', ':')) for c in pack['collections']) +
            NL + ' ],' + NL + ' "materials": ' + json.dumps(pack.get('materials', {}), separators=(',', ':')) +
            ',' + NL + ' "biomes": ' + json.dumps(pack['biomes'], separators=(',', ':')) + '}')
    body = body.replace('"media/', '"" + B + "media/')
    return ('// trees_pack.js - BAKED by tools/tree_prep.py, do not edit.\n'
            '// The vegetation payload manifest: one entry per SPECIES (trees, shrubs,\n'
            '// covers, dead, rocks, flowers), its subjects, their rungs, the maps their\n'
            '// materials wear, and the biomes (the mixes + the terrain-type map).\n'
            + BASE_DECL + '\n' + 'const TREE_PACK = ' + body + ';\n'
            + "if (typeof module !== 'undefined' && module.exports) module.exports = TREE_PACK;\n")


def main():
    pack = json.load(open(OUT, encoding='utf-8'))
    js = render(pack)
    if '--check' in sys.argv:
        now = open(OUTJS, encoding='utf-8').read()
        ok = now == js
        print('trees_pack.js %s trees_pack.json' % ('matches' if ok else 'DIFFERS from'))
        return 0 if ok else 1
    with open(OUTJS, 'w', encoding='utf-8', newline='\n') as f:
        f.write(js)
    print('wrote %s (%d species, %d mixes)' % (os.path.relpath(OUTJS, ROOT), len(pack['collections']), len(pack['biomes']['mixes'])))
    return 0


if __name__ == '__main__':
    sys.exit(main())
