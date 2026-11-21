"""Compile-only specialization of the saved far-one setting; near detail is retained."""
import gzip, json, pathlib

root = pathlib.Path(__file__).resolve().parents[2]
out = root / 'reports/evidence/PERFORMANCE-2026-11-19/ground-far-one-specialization'
out.mkdir(parents=True, exist_ok=True)
fixture = pathlib.Path('C:/Users/denis/.codex/visualizations/2026/11/18/01a1f08e-d1fd-7e70-bb78-e44a9ddb8a5b/wingsmith-chrome-profile-private.json')
storage = json.loads(fixture.read_text(encoding='utf-8-sig'))['storage']
assert json.loads(storage['flydiy.gfx'])['ground'] == 'far1'
d = json.loads(gzip.decompress((root / 'reports/evidence/PERFORMANCE-2026-11-19/audit-full-hangar-timing/garage.json.gz').read_bytes()))
p = next(p for p in d['programs'] if p['id'] == 19)
vs, fs = [d['sources'][k] for k in p['shaders']]
old = 'if (run) { Smp r = sTriplet(pass == 0 ? A : F, pass == 0 ? S : FS, P, tw, ang, m1, m2); if (pass == 0) gSNear = r; else gSFar = r; }'
new = 'if (run) { Smp r; if (pass == 0) r = sTriplet(A, S, P, tw, ang, m1, m2); else r = sSet(F.x, FS.x, P, tw, ang); if (pass == 0) gSNear = r; else gSFar = r; }'
assert fs.count(old) == 1
assert fs.count('if (uSFarN < 1.5) { F.y = -1.0; F.z = -1.0; }') == 1
candidate = fs.replace(old, new).replace('if (uSFarN < 1.5) { F.y = -1.0; F.z = -1.0; }', 'F.y = -1.0; F.z = -1.0;')
original = dict(name='ground-original', vs=vs, fs=fs)
specialized = dict(name='ground-far-one-specialized', vs=vs, fs=candidate)
(out / 'forward.json').write_text(json.dumps([original, specialized]), encoding='utf-8')
(out / 'reverse.json').write_text(json.dumps([specialized, original]), encoding='utf-8')
(out / 'scope.json').write_text(json.dumps(dict(
    vertexUnchanged=True, nearDetailAndRecolourUnchanged=True,
    condition='Existing far1 setting: F.y and F.z are -1, so the far sTriplet returns its first sSet unchanged.',
    limitation='Captured-source compile experiment only; requires far-one graphics setting. No production/default change.'), indent=2), encoding='utf-8')
print('Prepared original/candidate and reversed pair. Exact far-one fast path; near detail retained.')
