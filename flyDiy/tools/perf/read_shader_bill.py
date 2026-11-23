import collections, gzip, hashlib, json, pathlib, re, sys

p = pathlib.Path(sys.argv[1])
d = json.loads(gzip.decompress(p.read_bytes()))
sources = d['sources']
groups = collections.defaultdict(list)
families = collections.defaultdict(lambda: dict(links=0, waitMs=0, chars=0))
lights = collections.Counter()
for r in d['programs']:
    texts = [sources[k] for k in r['shaders'] if k in sources]
    text = '\n'.join(texts)
    m = re.search(r'#define SHADER_NAME ([^\r\n]+)', text)
    r['name'] = m[1] if m else '(unnamed)'
    r['chars'] = len(text)
    r['waitMs'] = round(sum(w['ms'] for w in r['waits']), 2)
    r['lightSignature'] = {k: (re.search(r'\b'+k+r'\[\s*(\d+)\s*\]', text) or [None, None])[1]
                           for k in ['directionalLights', 'pointLights', 'spotLights', 'hemisphereLights']}
    normalized = '\n'.join(re.sub(r'^#define SHADER_NAME .*$', '', t, flags=re.M) for t in texts)
    groups[hashlib.sha256(normalized.encode()).hexdigest()].append(r)
    family = r['name'].split(':')[0]
    f = families[family]; f['links'] += 1; f['waitMs'] += r['waitMs']; f['chars'] += r['chars']
    lights[str(r['lightSignature'])] += 1
dupes = []
for key, rows in groups.items():
    if len(rows) < 2: continue
    dupes.append(dict(hash=key, count=len(rows), waitMs=round(sum(r['waitMs'] for r in rows), 1),
                      programs=[{k:r.get(k) for k in ['id','name','t','stage','phase','chars','waitMs','deleted']} for r in rows]))
summary = dict(programs=len(d['programs']), sources=len(sources), semanticSourcePairs=len(groups),
               duplicateLinks=sum(len(g)-1 for g in groups.values()),
               families=dict(sorted(families.items(), key=lambda kv:kv[1]['waitMs'], reverse=True)),
               worstPrograms=sorted(d['programs'], key=lambda r:r['waitMs'], reverse=True)[:35],
               duplicates=sorted(dupes, key=lambda r:r['waitMs'], reverse=True), lightSignatures=dict(lights))
dest=p.with_suffix('').with_suffix('.summary.json'); dest.write_text(json.dumps(summary,indent=2),encoding='utf-8')
print('links',summary['programs'],'distinct pairs',len(groups),'duplicate links',summary['duplicateLinks'])
print('families',json.dumps(summary['families'])[:3000])
for r in summary['worstPrograms'][:12]: print('WAIT',r['id'],r['name'],r['waitMs'],r['chars'],r['phase'],r['lightSignature'])
for r in summary['duplicates'][:10]: print('DUP',r['count'],r['waitMs'],[(p['id'],p['name'],p['phase']) for p in r['programs']])
