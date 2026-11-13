#!/usr/bin/env python3
"""afb0220_splice.py - JOLENE 02/20 THE DERELICT STRIP (AFB-0220) spliced into the shipped record, in place.

    python3 tools/afb0220_splice.py            # writes tools/fixtures/island_jolene.json + scenery_ship_afb19.json
    python3 tools/afb0220_splice.py --check    # exit 1 when the shipped files are not what the part says (GATE AFB0220)

The fixture is not regenerated (jolene_author.py needs a local Metlakatla source this cloud lacks; ED-2's rule since
G3663: splice in place, the file's own json.dumps form, every other byte kept). What it does, idempotently:
  * every entry of the PART'S OWN (xw_rough, xw_a_*, xw_o_*, xw_t_* - not the winch's xw_winch*) is taken out and the part's
    put back where the first one stood (tools/jolene_parts/afb0220.py): the rough
    lane right AFTER w2 in `runways` (two strips' grades compose in record order; 13/31 stays last of the three), the
    areas and objects at their layers' ends;
  * w2 - the user's own entry - takes the part's W2_PATCH (the band 15 m, falloff 8, the worn pavement's knobs), and
    the ship manifest scenery_ship_afb19.json carries the same patch in `fieldPatches.w2` with its why, so GATE
    SCENERYED 15 (shipped == the user's save + the named patches) holds and a re-ship applies it again.
The xw_ entries are ship-only: the save does not carry them (row 15 keeps them as 'not in the save', never a red).
"""
import json, os, re, runpy, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIX = os.path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json')
MAN = os.path.join(ROOT, 'tools', 'fixtures', 'scenery_ship_afb19.json')
PART = os.path.join(ROOT, 'tools', 'jolene_parts', 'afb0220.py')
WHY = ('AFB-0220 (the user 13 Nov via A0: 02/20 "an UNMAINTAINED, DEGRADED strip divided into several runways"): w2 is the '
       'NARROW CENTRAL BAND where the old concrete still shows - 45 -> 15 m wide, its band 40 -> 1.5 m (the grass to its edge), '
       'its grade\'s falloff 60 -> 8 m (the old corridor\'s rough ground and its ponds come back beside it), the pavement at its '
       'worst (crackK 1, mossK 1, patchK 0.3, paintAge 1.2, wet 0.6, laneW 5); the rough lane xw_rough, the crash playground and '
       'the forest are ship-only xw_ entries (tools/jolene_parts/afb0220.py, spliced by tools/afb0220_splice.py) - applied after '
       'the ship: a re-ship must apply it again')


def load():
    ns = runpy.run_path(PART, run_name='jolene_part')
    return ns['PREFIX'], ns['PART'], ns['W2_PATCH']


# THE PART'S OWN ENTRIES (not every xw_ id: the glider winch, claude/afb-0220-winch, carries xw_winch13 / xw_winch31 in the
# same prefix - a splice must never take another piece's entries out): the lane, the areas, the objects and trees
OWN = re.compile(r'^xw_(rough$|a_|o_|t_)')


def spliced(rec, prefix, part, patch):
    L = rec['layers']
    for k, rows in part.items():
        if k not in L: raise SystemExit('afb0220: no layer %r' % k)
        for e in rows:
            if not OWN.match(str(e.get('id', ''))): raise SystemExit('afb0220: %r is not one of the part\'s own ids (%s)' % (e.get('id'), OWN.pattern))
    for k in L:
        # the part's entries go back WHERE THEY STOOD (the first one's place), so a re-splice of a merged record - other
        # entries appended after them - moves nothing; a first splice: the lane right after w2 (two strips' grades compose
        # in record order; 13/31 stays last of the three), the rest at the layer's end
        at = next((n for n, e in enumerate(L[k]) if OWN.match(str((e or {}).get('id', '')))), None)
        L[k] = [e for e in L[k] if not OWN.match(str((e or {}).get('id', '')))]
        rows = json.loads(json.dumps(part.get(k, [])))
        if not rows: continue
        if at is None:
            if k == 'runways':
                i = next((n for n, e in enumerate(L[k]) if e.get('id') == 'w2'), None)
                if i is None: raise SystemExit('afb0220: no w2 in the record')
                at = i + 1
            else: at = len(L[k])
        L[k][at:at] = rows
    w2 = next(e for e in L['runways'] if e.get('id') == 'w2')
    for k, v in patch.items(): w2[k] = json.loads(json.dumps(v))      # in place: an existing key keeps its position
    ids = [e.get('id') for rows in L.values() for e in rows if isinstance(e, dict)]
    dup = sorted(set(i for i in ids if ids.count(i) > 1 and str(i).startswith(prefix)))
    if dup: raise SystemExit('afb0220: duplicate ids %s' % dup)
    return rec


def manifest(M, patch):
    M.setdefault('fieldPatches', {})['w2'] = json.loads(json.dumps(patch))
    M['fieldPatchesWhyAfb0220'] = WHY
    return M


def main():
    prefix, part, patch = load()
    ftxt = open(FIX, encoding='utf8').read()
    mtxt = open(MAN, encoding='utf8').read()
    rec = spliced(json.loads(ftxt), prefix, part, patch)
    M = manifest(json.loads(mtxt), patch)
    fout = json.dumps(rec, indent=1) + '\n'
    mout = json.dumps(M, indent=1, ensure_ascii=False) + '\n'
    if '--check' in sys.argv:
        bad = [p for p, a, b in ((FIX, ftxt, fout), (MAN, mtxt, mout)) if a != b]
        print('AFB0220 SPLICE: ' + ('the shipped files are the part, byte for byte' if not bad else 'STALE: ' + ', '.join(os.path.basename(p) for p in bad) + ' - run tools/afb0220_splice.py'))
        sys.exit(1 if bad else 0)
    with open(FIX, 'w', newline='\n', encoding='utf8') as f: f.write(fout)
    with open(MAN, 'w', newline='\n', encoding='utf8') as f: f.write(mout)
    n = {k: len(v) for k, v in part.items()}
    print('afb0220: spliced %s + w2 patched (%s); manifest fieldPatches.w2 written' % (n, ', '.join(sorted(patch))))


if __name__ == '__main__':
    main()
