"""Export captured programs without treating parallel completion delays as costs."""
import collections, csv, gzip, json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parents[2]
folder = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root / 'reports/evidence/PERFORMANCE-2026-11-19/shader-bill'
d = json.loads(gzip.decompress((folder / 'garage.json.gz').read_bytes()))
attribution = {p['id']:p for p in d.get('attribution',{}).get('live',[])}
rows = []
for p in d['programs']:
    texts = [d['sources'][k] for k in p['shaders']]
    s = '\n'.join(texts)
    m = re.search(r'#define SHADER_NAME ([^\r\n]+)', s)
    name = m[1] if m else 'unnamed'
    if 'aCoarseN' in s and 'fineK()' in s:
        name = 'Fine island ground (source identified)'
    elif 'distance(vWPi.xz, uFine.xy) < uFine.z' in s:
        name = 'Coarse island ground (source identified)'
    family = name.split(':')[0]
    ready = p.get('ready')
    owners = attribution.get(p['id'],{}).get('materials',[])
    if name=='unnamed' and owners:
        names=sorted(set(m['name'] or m['type'] for m in owners))
        name=' / '.join(names)
    rows.append(dict(program=p['id'], name=name, family=family, phase=p['phase'],
        submitted_s=round(p['t']/1000, 4),
        completion_observed_s=round(ready/1000, 4) if ready is not None else '',
        observed_delay_upper_bound_s=round((ready-p['t'])/1000, 4) if ready is not None else '',
        blocking_GL_calls_ms=round(sum(w['ms'] for w in p['waits']), 4),
        vertex_source_chars=len(texts[0]), fragment_source_chars=len(texts[1]),
        vertex_source_id=p['shaders'][0], fragment_source_id=p['shaders'][1],
        completion_polls=p.get('polls',''),
        last_pending_to_ready_ms=round(ready-p['lastPending'],4) if ready is not None and 'lastPending' in p else '',
        material_count=len(owners),object_references=sum(m['objects'] for m in owners),
        material_keys=' | '.join(sorted(set(str(m['key'])[:250] for m in owners))),
        example_objects=' | '.join(sorted(set(e['path'] for m in owners for e in m['examples']))[:8])))
with (folder/'individual-programs.csv').open('w', newline='', encoding='utf-8-sig') as f:
    w=csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
print('TOP OBSERVED DELAYS (not additive / not exclusive compiler cost)')
for r in sorted(rows,key=lambda r:r['observed_delay_upper_bound_s'] or -1,reverse=True)[:24]:
    print(r['program'],r['name'],r['phase'],r['observed_delay_upper_bound_s'],r['vertex_source_chars'],r['fragment_source_chars'])
print('NAMED FAMILIES')
counts=collections.Counter(r['family'] for r in rows)
print(counts.most_common())
assert len(rows)==len(d['programs'])
print('Exported all',len(rows),'programs with vertex/fragment identities and available material attribution.')
