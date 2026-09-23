#!/usr/bin/env python3
"""jolene_part_extract.py - THE WORLD EDITOR'S RECORD BACK INTO A PART (GTRAM, 2026-09-23)

Jolene's record is GENERATED (tools/jolene_author.py merges tools/jolene_parts/*); the world editor
edits the WHOLE record and exports it whole (FILE > export json, or the autosaved WIP). This takes
such an export and writes back the entries that belong to ONE part, so a scene authored or touched
up in the editor lands in its own file and nobody else's:

    py -3.11 tools/jolene_part_extract.py <export.json> --prefix tw_ --out tools/jolene_parts/tramway.json
        [--rename w1=tw_ski,s1=tw_s_summit ...] [--dry]

WHICH ENTRIES ARE THE PART'S: every entry whose id carries the prefix, and every entry whose id is
NOT in the current fixture (a feature the editor created - its id is the editor's own `w1`, `s2`,
`o14`: it gets the prefix, or the name --rename gives it). An entry of ANOTHER part that the export
changed is reported and left alone: it belongs to that part's file. An entry of this part that the
export no longer has is dropped from the part, and said so.

REFERENCES follow a rename: a link's `from.site` / `to.site`, a surface's `yard`, any `site`,
`runway` or `road` field naming a renamed id.

The part keeps the editor's order inside each layer (zones are sown in array order). Run
tools/jolene_author.py afterwards: the fixture is output, never source.
"""
import json, os, sys, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURE = os.path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json')
REF_KEYS = ('site', 'yard', 'runway', 'road')


def unwrap(o):
    """an envelope ({ what, name, rec } / { v: <json text> } from a scripted read) or a bare record"""
    if isinstance(o, dict) and isinstance(o.get('v'), str): o = json.loads(o['v'])
    for k in ('rec', 'record', 'premises'):
        if isinstance(o, dict) and isinstance(o.get(k), dict) and 'layers' in o[k]: return o[k]
    if isinstance(o, dict) and 'layers' in o: return o
    raise SystemExit('not a premises record (no layers)')


def rename_refs(v, ren):
    if isinstance(v, dict):
        return {k: (ren.get(x, x) if k in REF_KEYS and isinstance(x, str) else rename_refs(x, ren)) for k, x in v.items()}
    if isinstance(v, list): return [rename_refs(x, ren) for x in v]
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('export'); ap.add_argument('--prefix', required=True); ap.add_argument('--out', required=True)
    ap.add_argument('--rename', default=''); ap.add_argument('--dry', action='store_true')
    ap.add_argument('--fixture', default=FIXTURE)
    a = ap.parse_args()
    P = a.prefix
    rec = unwrap(json.load(open(a.export, encoding='utf8')))
    fix = json.load(open(a.fixture, encoding='utf8'))
    fixed = {}
    for k, rows in fix['layers'].items():
        for e in rows: fixed[e.get('id')] = (k, e)
    ren = dict(kv.split('=', 1) for kv in a.rename.split(',') if '=' in kv)
    old = {}
    if os.path.exists(a.out):
        o = json.load(open(a.out, encoding='utf8'))
        for k, rows in o.get('layers', {}).items():
            for e in rows: old[e['id']] = k
    layers, seen, foreign = {}, set(), []
    for k, rows in rec['layers'].items():
        for e in rows:
            i = e.get('id')
            if i is None: continue
            if str(i).startswith(P) or i not in fixed:
                if not str(i).startswith(P): ren.setdefault(i, P + str(i))
                layers.setdefault(k, []).append(e)
            elif json.dumps(fixed[i][1], sort_keys=True) != json.dumps(e, sort_keys=True):
                foreign.append(i)
    out = {}
    for k, rows in layers.items():
        out[k] = []
        for e in rows:
            e = rename_refs(e, ren)
            e['id'] = ren.get(e['id'], e['id'])
            if not e['id'].startswith(P): raise SystemExit('id %r does not carry %r - rename it' % (e['id'], P))
            if e['id'] in seen: raise SystemExit('id %r twice' % e['id'])
            seen.add(e['id']); out[k].append(e)
    part = {'prefix': P, 'layers': out}
    dropped = sorted(set(old) - seen)
    for k in sorted(out): print('  %-9s %3d  %s' % (k, len(out[k]), ' '.join(e['id'] for e in out[k])))
    for i, j in sorted(ren.items()): print('  renamed %s -> %s' % (i, j))
    if dropped: print('  DROPPED from the part (not in the export): ' + ' '.join(dropped))
    # (the editor normalises every entry it holds - defaults filled in - so most of these differ only by that)
    if foreign: print('  %d entries of other parts differ in the export (left to their own part): %s%s' % (len(foreign), ' '.join(foreign[:10]), ' ...' if len(foreign) > 10 else ''))
    if a.dry: return
    with open(a.out, 'w', encoding='utf8', newline='\n') as f: f.write(json.dumps(part, indent=1, ensure_ascii=False) + '\n')
    print('wrote', a.out)


if __name__ == '__main__':
    main()
