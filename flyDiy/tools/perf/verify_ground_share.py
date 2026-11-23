"""Check emitted GPU shader tokens against the captured legacy shaders.

Specialize only the new per-material selector; no visual model is approximated.
"""
import gzip, hashlib, json, pathlib, re, sys

def read(p): return json.loads(gzip.decompress(pathlib.Path(p).read_bytes()))
def tokens(s):
    s=re.sub(r'^#define SHADER_NAME .*$', '', s, flags=re.M)
    s=re.sub(r'/\*.*?\*/|//[^\n]*', '', s, flags=re.S)
    return re.findall(r'[A-Za-z_]\w*|\d+(?:\.\d*)?(?:[eE][-+]?\d+)?|[^\s]',s)
def key(texts): return hashlib.sha256(json.dumps([tokens(s) for s in texts]).encode()).hexdigest()
coarse='if (uFine.z > 0.0 && distance(vWPi.xz, uFine.xy) < uFine.z && vRM.w < 1.5) discard;'
fine='if (distance(vWPi.xz, uFine.xy) > uFine.z) discard;'
shared='if (uGroundDiscSide < 0.0) { '+coarse+' } else '+fine
normal='objectNormal = normalize(mix(aCoarseN, objectNormal, fineK()));'
morph='transformed.y = mix(aCoarse, transformed.y, fineK());'
def specialize(s,side):
    s=s.replace('uniform float uGroundDiscSide;','').replace(shared,coarse if side<0 else fine)
    for statement in [normal,morph]:
        s=s.replace('if (uGroundDiscSide > 0.0) '+statement,statement if side>0 else '')
    if side<0:
        s=s.replace('attribute float aCoarse; attribute vec3 aCoarseN;','')
        s=re.sub(r'float fineK\(\)\{[^}]*\}', '', s)
    return s
old,new=map(read,sys.argv[1:3]);refs={key([old['sources'][s] for s in p['shaders']]) for p in old['programs']}
results=[]
for p in new['programs']:
    texts=[new['sources'][s] for s in p['shaders']]
    if not any('uniform float uGroundDiscSide;' in s for s in texts):continue
    for side in [-1,1]:
        match=key([specialize(s,side) for s in texts]) in refs
        results.append(dict(program=p['id'],side=side,matchesLegacy=match))
assert results,'No shared terrain programs found'
assert all(r['matchesLegacy'] for r in results),json.dumps(results)
print('SHARED GROUND: PASS —',len(results),'specialized vertex/fragment pairs match captured legacy shader tokens exactly')
dest=pathlib.Path(sys.argv[2]).parent/'source-equivalence.json';dest.write_text(json.dumps(results,indent=2))
