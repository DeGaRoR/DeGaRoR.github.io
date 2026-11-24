# PERF-LEAD 24 Nov: every shader program the game linked in a cold boot + garage + an 8-minute flight + a crash, from the flight
# recorder's 'prog' / 'progready' / 'linkwait' events, merged by program key. Out: programs.csv (one row a program), materials.csv
# (one row a material name x owner, with how many programs it costs), owners.csv (one row an owner family).
import io, json, csv, sys, glob, collections
logs = sys.argv[2:]; out = sys.argv[1]
P = {}   # key -> row
for L in logs:
    fl = json.load(io.open(L, encoding='utf-8')); ev = fl['events']; tag = L.split('/')[-2]
    byN = {}
    for e in ev:
        if e[1] != 'prog': continue
        d = e[3] if len(e) > 3 and isinstance(e[3], dict) else (e[2] if isinstance(e[2], dict) else None)
        if not d: continue
        byN[d.get('n')] = d
        k = d.get('key') or ('n%s' % d.get('n'))
        r = P.get(k)
        if not r:
            r = P[k] = dict(key=k, owner=d.get('own') or '', material=d.get('name') or '', type=d.get('type') or '', source_fp=d.get('fp') or '',
                            vs_bytes=d.get('vs') or 0, fs_bytes=d.get('fs') or 0, first_step=d.get('step') or '', first_ctx=d.get('ctx') or '',
                            target=d.get('rt') or '', link_ms=0.0, wait_ms=0.0, seen_in=set())
        r['seen_in'].add(tag)
    for e in ev:
        if e[1] == 'progready' and isinstance(e[3], list):
            d = byN.get(e[3][0]); 
            if d: r = P.get(d.get('key') or ''); 
            if d and r: r['link_ms'] = max(r['link_ms'], float(e[2] or 0))
        if e[1] == 'linkwait':
            d = byN.get(e[3]); r = P.get(d.get('key')) if d else None
            if r: r['wait_ms'] = max(r['wait_ms'], float(e[2] or 0))
rows = sorted(P.values(), key=lambda r: (r['owner'], r['material'], r['type']))
fam = lambda o: ' / '.join(o.split(' / ')[:2]) if o else '(no owner)'
with io.open(out + '/programs.csv', 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f); w.writerow(['family', 'owner', 'material', 'material_type', 'program_key', 'shader_source_fp', 'same_source_programs', 'vs_bytes', 'fs_bytes', 'link_ms', 'first_use_wait_ms', 'first_linked_in_step', 'first_ctx', 'target', 'seen_in'])
    fpc = collections.Counter(r['source_fp'] for r in rows)
    for r in rows: w.writerow([fam(r['owner']), r['owner'], r['material'], r['type'], r['key'], r['source_fp'], fpc[r['source_fp']], r['vs_bytes'], r['fs_bytes'], round(r['link_ms'], 1), round(r['wait_ms'], 1), r['first_step'], r['first_ctx'], r['target'], '+'.join(sorted(r['seen_in']))])
M = collections.OrderedDict()
for r in rows:
    k = (fam(r['owner']), r['owner'], r['material'], r['type']); m = M.setdefault(k, dict(n=0, fps=set(), link=0.0, wait=0.0))
    m['n'] += 1; m['fps'].add(r['source_fp']); m['link'] += r['link_ms']; m['wait'] += r['wait_ms']
with io.open(out + '/materials.csv', 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f); w.writerow(['family', 'owner', 'material', 'material_type', 'programs', 'distinct_shader_sources', 'link_ms_total', 'first_use_wait_ms_total'])
    for k, m in sorted(M.items(), key=lambda kv: -kv[1]['n']): w.writerow(list(k) + [m['n'], len(m['fps']), round(m['link']), round(m['wait'])])
F = collections.OrderedDict()
for r in rows:
    m = F.setdefault(fam(r['owner']), dict(n=0, mats=set(), fps=set(), link=0.0, wait=0.0))
    m['n'] += 1; m['mats'].add((r['owner'], r['material'], r['type'])); m['fps'].add(r['source_fp']); m['link'] += r['link_ms']; m['wait'] += r['wait_ms']
with io.open(out + '/owners.csv', 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f); w.writerow(['family', 'programs', 'materials', 'distinct_shader_sources', 'link_ms_total', 'first_use_wait_ms_total'])
    for k, m in sorted(F.items(), key=lambda kv: -kv[1]['n']): w.writerow([k, m['n'], len(m['mats']), len(m['fps']), round(m['link']), round(m['wait'])])
print('programs', len(rows), '| materials', len(M), '| families', len(F), '| distinct sources', len(set(r['source_fp'] for r in rows)))
