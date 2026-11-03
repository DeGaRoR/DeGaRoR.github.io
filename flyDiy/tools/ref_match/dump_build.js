// dump_build.js <build.json | --key <archetype>> <out-prefix> [--over JSON] [--save <born.json>]
// The built aeroplane's visible triangles in world metres for refmatch.py / fit_tail.js: <out>.bin (float32, nine a
// triangle - the cage sheet first, then every layer) and <out>.json (the layer of each run of triangles). --key births
// an archetype card the way the shed does (designBake + the load door, the cowl fitted once); --save keeps that born
// build as a file the other tools (and the bench) can load. Method: tools/REF_MATCH.md.
'use strict';
const fs = require('fs'), path = require('path');
const T = path.resolve(__dirname, '..') + '/';
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const KEY = opt('key', null), OUT = KEY ? pos[0] : pos[1];
const SH = require(T + '_scene_headless.js');
function born(key) {
  const BJ = require(T + '_bake_joined.js'), LB = require(T + '_load_build.js');
  const { D } = BJ.loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === key);
  if (!a) throw new Error('no archetype ' + key);
  const s0 = D.designBake(a.sel, a.over);
  const r = LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 });
  if (r.errors.length) console.log('join errors: ' + r.errors.length + ' - ' + r.errors.slice(0, 3).join(' | '));
  return { name: a.name, spec: r.spec };
}
const doc = KEY ? born(KEY) : JSON.parse(fs.readFileSync(pos[0], 'utf8'));
const spec = doc.spec || doc;
if (opt('save', null)) fs.writeFileSync(opt('save'), JSON.stringify({ name: doc.name, spec }));
const S = SH.sceneBuild(spec, { garage: spec, over: JSON.parse(opt('over', '{}')) });
const THREE = SH.context().THREE; S.scene.updateMatrixWorld(true);
const v = new THREE.Vector3(), out = [], runs = [], FS = S.FS, sh = S.built.sheet;
const SKIP = /tube|cloth|dash|bulkhead|fire|shoulder|toele|plywood|floorBoard|seat/;
for (const f of sh.F) {
  if (SKIP.test(f.m) || f.v.length < 3) continue;
  for (let t = 1; t + 1 < f.v.length; t++) for (const i of [f.v[0], f.v[t], f.v[t + 1]]) out.push(...sh.V[i].map(x => x * FS));
}
runs.push(['sheet', out.length / 9]);
const vis = o => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
S.scene.traverse(o => {
  if (!o.isMesh || !o.geometry.attributes.position || !vis(o)) return;
  let lay = ''; for (let q = o; q; q = q.parent) if (/^cageLayer:/.test(q.name || '')) { lay = q.name.slice(10); break; }
  if (!lay) return;
  const p = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : p.count, a = out.length;
  for (let i = 0; i + 2 < n; i += 3) for (let e = 0; e < 3; e++) {
    v.fromBufferAttribute(p, idx ? idx.getX(i + e) : i + e).applyMatrix4(o.matrixWorld); out.push(v.x, v.y, v.z);
  }
  if (out.length > a) runs.push([lay, out.length / 9]);
});
fs.writeFileSync(OUT + '.bin', Buffer.from(new Float32Array(out).buffer));
fs.writeFileSync(OUT + '.json', JSON.stringify(runs));
console.log('dumped ' + out.length / 9 + ' triangles, ' + runs.length + ' runs -> ' + OUT + '.bin');
