"""Attribute captured shader activity. Intervals are observations, never costs."""
import collections, gzip, json, pathlib, sys

folder = pathlib.Path(sys.argv[1])
d = json.loads(gzip.decompress((folder/'garage.json.gz').read_bytes()))
meta = json.loads((folder/'garage.meta.json').read_text())
t0 = meta['bootT0']
live = {r['id']:r for r in d['attribution']['live']}
owners = collections.defaultdict(list)
for r in d['owners']:
    owners[r['program']].append(r)

def classify(p):
    oo = owners[p['id']]
    mm = live.get(p['id'], {}).get('materials', [])
    keys = ' '.join(str(o.get('key','')) for o in oo+mm)
    names = ' '.join(o.get('name','') for o in oo+mm)
    paths = ' '.join(e['path'] for m in mm for e in m.get('examples', []))
    if 'island-fine' in keys: return 'Fine ground'
    if 'island-ring' in keys: return 'Coarse ground'
    if 'island-outer' in keys or 'premises-patch' in keys: return 'Outer ground / premises ground patches'
    if 'pavement:' in keys or 'pavement' in names: return 'Road / runway pavement'
    if 'water' in names.split(): return 'Water'
    if 'cloudComposite' in paths: return 'Cloud composite (not all cloud passes)'
    if 'parked.bake' in keys: return 'Parked aircraft bake materials'
    if 'aeroskin' in names or 'flown.' in keys or 'cageLayer:' in paths: return 'Player aircraft / editor'
    if any(s in keys for s in ['imp:', 'impDepth:']): return 'Vegetation impostors / their shadows'
    if any(s in paths for s in ['premises:trees','trees:cell','room:trees','ground:cover','ground:grass']): return 'Vegetation / ground cover'
    if any(s in paths for s in ['premises:houses','shed:HOME','shed:','houses:town']): return 'Buildings / hangar (may share materials)'
    if any(o.get('type') in ['MeshDepthMaterial','MeshDistanceMaterial'] for o in oo): return 'Other shadow variants'
    return 'Other / shared / not yet identified'

rows=[]
for p in d['programs']:
    rows.append(dict(id=p['id'],family=classify(p),phase=p.get('phase'),
        submitted=(p['t']-t0)/1000,
        ready=(p['ready']-t0)/1000 if 'ready' in p else None,
        lastPending=(p['lastPending']-t0)/1000 if 'lastPending' in p else None,
        pendingPhase=p.get('pendingPhase'),
        blockingMs=sum(w['ms'] for w in p.get('waits',[])),
        sourceIds=p['shaders']))
groups=[]
for family in dict.fromkeys(r['family'] for r in rows):
    rr=[r for r in rows if r['family']==family]
    representative=max(rr,key=lambda r:(r['ready'] or r['submitted'])-r['submitted'])
    groups.append(dict(family=family,programs=len(rr),worldGateSubmissions=sum(r['phase']=='worldCompile' for r in rr),
        representative=representative,lastObservedReady=max((r['ready'] for r in rr if r['ready'] is not None),default=None)))
gate=next(r for r in meta['boot'] if r['k']=='step' and r['id']=='worldCompile')
out=dict(bootT0=t0,gate=gate,settle=meta['settle'],groups=groups,programs=rows,
    totalPrograms=len(rows),creationAttributedPrograms=len(set(owners)),
    synchronousCompileCallMs=sum(c['ms'] for c in d['compileCalls'] if c.get('phase')=='worldCompile'),
    method='Creation-time material ownership plus post-ready scene paths. Shared generic materials can cross subsystem boundaries. Counts are program instances, not effects. Representative intervals run from link submission to first observed completion and include parallel work, scheduling and polling; not exclusive compiler costs. Shadow ownership and non-scene cloud passes remain partly unidentified. This is a diagnostic run, not an optimization comparison.')
(folder/'analysis.json').write_text(json.dumps(out,indent=2)+'\n')
for g in groups:
    r=g['representative']
    print(g['family'],g['programs'],'gate links',g['worldGateSubmissions'],'representative',r['id'],round(r['submitted'],3),round(r['ready'] or 0,3))
print('GATE',gate,'compile calls ms',out['synchronousCompileCallMs'])
