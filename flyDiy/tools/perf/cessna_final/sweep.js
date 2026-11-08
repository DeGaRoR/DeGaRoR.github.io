// node tools/perf/cessna_final/sweep.js <core.js> <out.json> [files...]  - CESSNA-FINAL: every build through the load door, built by <core.js>:
// empty, all-up, CG x, node / member count and a hash of what the solver flies (node p and m, member ends, k, A)
// The specs are cached per file in <out.json>.specs.json (the join runs once, with the tree's own built core)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const [coreF, outF] = process.argv.slice(2, 4);
let files = process.argv.slice(4);
if (!files.length) {
  const dirs = ['builds', 'builds/candidates', 'builds/candidates/review', 'bugReports', 'tools/fixtures'];
  for (const d of dirs) for (const f of fs.readdirSync(path.join(ROOT, d))) if (/\.json$/.test(f) && !/index\.json$|\.edits\.json$/.test(f)) files.push(d + '/' + f);
}
const specF = outF + '.specs.json';
let SP = {}; try { SP = JSON.parse(fs.readFileSync(specF, 'utf8')); } catch (e) {}
process.env.FLYDIY_CORE = path.resolve(coreF);
const L = require(path.join(ROOT, 'tools', '_treecrash_lib.js')), C = L.core();
const LB = require(path.join(ROOT, 'tools', '_load_build.js'));
const out = {};
for (const f of files) {
  try {
    if (!SP[f]) {
      const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      if (!(j && (j.what === 'flydiy-build' || j.spec))) { out[f] = { skip: 'not a build' }; continue; }
      SP[f] = LB.loadBuild(f).spec;
    }
    const def = C.buildGen(JSON.parse(JSON.stringify(SP[f])));
    const led = def.parts && def.parts.ledger || {};
    let E = 0; for (const k in led) if (!led[k].payload) E += led[k].mass;
    let M = 0, cx = 0; for (const n of def.nodes) { M += n.m; cx += n.m * n.p[0]; }
    const h = crypto.createHash('sha1');
    for (const n of def.nodes) h.update(n.p.map(v => v.toFixed(6)).join(',') + ':' + n.m.toFixed(6) + ';');
    for (const b of def.beams) h.update(b.a + '-' + b.b + ':' + (+b.k).toPrecision(9) + ':' + (+(b.A || 0)).toPrecision(9) + ';');
    out[f] = { empty: +E.toFixed(3), mass: +M.toFixed(3), cgX: +(cx / M).toFixed(4), n: def.nodes.length, nb: def.beams.length,
               hash: h.digest('hex').slice(0, 16), mat: SP[f].fuselage && SP[f].fuselage.material, susp: SP[f].gear && SP[f].gear.suspension,
               seats: SP[f].cabin && SP[f].cabin.seats, seatsX: SP[f].cabin && SP[f].cabin.seatsX ? SP[f].cabin.seatsX.length : null };
  } catch (e) { out[f] = { err: String(e.message || e).slice(0, 200) }; }
}
fs.writeFileSync(specF, JSON.stringify(SP));
fs.writeFileSync(outF, JSON.stringify(out, null, 1));
console.log(Object.keys(out).length + ' files -> ' + outF + ' (' + Object.values(out).filter(o => o.err).length + ' errors)');
