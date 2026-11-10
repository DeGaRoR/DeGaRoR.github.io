// tools/prop_study.js - the roster rescored with the land propeller classes x scale, in memory (no physics change); results in reports/evidence/PROP-STUDY-2026-11-09/
// propscore.js <key> <scale>: the plane's latest full result with its airframe readings re-measured with the land
// propeller classes' fm x scale (in memory), re-verdicted and re-scored. Prints one JSON line.
process.chdir('/workspace/DeGaRoR.github.io/flyDiy');
const key = process.argv[2], k = +process.argv[3] || 1;
process.argv.push('--quick');
const fs = require('fs');
const C = require('/workspace/DeGaRoR.github.io/flyDiy/tools/flight_core.js');
for (const p of ['climb', 'standard', 'cruise']) C.GEN_PROP_PITCH[p].fm *= k;
const RC = require('/workspace/DeGaRoR.github.io/flyDiy/tools/real_check.js'), R = require('/workspace/DeGaRoR.github.io/flyDiy/tools/real_refs.js');
const RR = require('/workspace/DeGaRoR.github.io/flyDiy/tools/real_report.js');
const dirs = fs.readdirSync('reports/evidence').filter(d => /^REAL-CHECK-/.test(d)).sort();
let old = null; for (const d of dirs) { const f = 'reports/evidence/' + d + '/' + key + '.json'; if (fs.existsSync(f)) old = JSON.parse(fs.readFileSync(f, 'utf8')); }
const log = console.log; console.log = () => {};
let q = null, err = null;
try { q = RC.runPlane(key, R.PLANES[key]); } catch (e) { err = e.message; }
console.log = log;
if (!old || !q) { console.log(JSON.stringify({ key, k, err: err || 'no result' })); process.exit(0); }
const o = Object.assign({}, old, { cases: q.cases });
const V = RC.verdicts(o); o.verdicts = V;
const s = RR.scorePlane(o);
const air = V.filter(v => /^airframe/.test(v.src || '')).map(v => ({ k: v.k, ours: v.ours, ref: v.ref, verdict: v.verdict }));
console.log(JSON.stringify({ key, k, G: s.geometry, S: s.specs, P: s.performance, O: s.overall, air }));
