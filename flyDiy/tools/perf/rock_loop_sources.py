"""Feed a visual-preserving loop experiment to the existing cold-links bench."""
import gzip,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[2]
d=json.loads(gzip.decompress((root/'reports/evidence/PERFORMANCE-2026-11-19/shader-bill/garage.json.gz').read_bytes()))
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
rows=[]
for ident in map(int,[a for a in sys.argv[2:] if not a.startswith('--')] or ['19']):
    p=next(p for p in d['programs'] if p['id']==ident)
    vs,fs=[d['sources'][k] for k in p['shaders']]
    rows.append(dict(name=f'{ident}:baseline',vs=vs,fs=fs))
    if ident==22:
        old='for (int ka = 0; ka < 4; ka++) for (int kb = 0; kb < 4; kb++) {\n          float fk = float(ka * 4 + kb);'
        assert fs.count(old)==1 and fs.count('void main() {')==1
        fs=fs.replace('void main() {','uniform int uPerfTrackSlots;\nvoid main() {').replace(old,'for (int track = 0; track < uPerfTrackSlots; track++) {\n          float fk = float(track);')
        mode='track-loop-uniform-16'
    else:
        old='for (int o = 0; o < 3; o++)'
        assert fs.count(old)==1 and fs.count('float sTrFbm(')==1
        fs=fs.replace('float sTrFbm(','uniform int uPerfRockOctaves;\nfloat sTrFbm(').replace(old,'for (int o = 0; o < uPerfRockOctaves; o++)')
        mode='rock-loop-uniform-3'
    rows.append(dict(name=f'{ident}:{mode}',vs=vs,fs=fs))
    # Alternate order on the repeat to expose order/cache bias.
    if ident==19 and '--reverse' in sys.argv: rows[-2:]=reversed(rows[-2:])
(out/'sources.json').write_text(json.dumps(rows),encoding='utf-8')
print('Prepared',len(rows),'source pairs. Candidates require their fixed loop uniforms (3 rock octaves / 16 track slots) when drawn; compile-only experiment.')
