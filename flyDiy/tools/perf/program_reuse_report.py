"""Compare successive captured program sets across the real design-iteration loop."""
import collections,gzip,hashlib,json,pathlib,re,sys

folder=pathlib.Path(sys.argv[1]);stages=[]
for name in ['garage','world','edited-world','unchanged-world','failure']:
    p=folder/(name+'.json.gz')
    if not p.exists():continue
    d=json.loads(gzip.decompress(p.read_bytes()));meta=json.loads((folder/(name+'.meta.json')).read_text())
    initial=next((x for x in stages if x['snapshot']=='garage'),None)
    rows=[]
    for p in d['programs']:
        texts=[d['sources'][k] for k in p['shaders']]
        key=hashlib.sha256('\n'.join(re.sub(r'^#define SHADER_NAME .*$', '',s,flags=re.M) for s in texts).encode()).hexdigest()
        m=re.search(r'#define SHADER_NAME ([^\r\n]+)','\n'.join(texts))
        rows.append(dict(id=p['id'],stage=p['stage'],phase=p.get('phase'),name=m[1] if m else '(unnamed)',sourcePair=key,
                         submitted_s=p['t']/1000,deleted=p.get('deleted')))
    ids=set(initial['programIds']) if initial else set()
    pairs=set(initial['sourcePairs']) if initial else set()
    new=[p for p in rows if p['id'] not in ids] if initial else []
    row=dict(snapshot=name,t_s=meta['t']/1000,programIds=[p['id'] for p in rows],sourcePairs=sorted(set(p['sourcePair'] for p in rows)),
             totalLinks=len(rows),deleted=sum(bool(p['deleted']) for p in rows),newSinceGarage=len(new),
             newSourcePairsSinceGarage=len(set(p['sourcePair'] for p in new)-pairs),
             newPrograms=new,simT=meta.get('simT'),worker=meta.get('worker'),trips=meta.get('trips'))
    stages.append(row)
    print(name, 'links',len(rows),'new',len(new),'new source pairs',row['newSourcePairsSinceGarage'],'deleted',row['deleted'],'simT',row['simT'])
(folder/'program-reuse.json').write_text(json.dumps(stages,indent=2))
