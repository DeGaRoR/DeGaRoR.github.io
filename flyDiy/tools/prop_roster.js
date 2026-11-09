// roster.js <key> [file]: the plane's latest full result with its airframe readings re-measured by THIS tree (the prop
// classes), optionally on another build file; re-verdicted and re-scored. One JSON line.
const W = '/tmp/claude-0/-workspace-DeGaRoR-github-io/4f908d22-ff33-5ae9-a5b8-4742f699e31b/scratchpad/pilot/flyDiy';
process.chdir(W);
const key = process.argv[2], file = process.argv[3];
process.argv.push('--quick');
const fs = require('fs');
const RC = require(W + '/tools/real_check.js'), R = require(W + '/tools/real_refs.js'), RR = require(W + '/tools/real_report.js');
const EV = '/workspace/DeGaRoR.github.io/flyDiy/reports/evidence';
const base = key === 'pa18fp' ? 'pa18f' : key === 'dc3cs' ? 'dc3' : key;
let old = null; for (const d of fs.readdirSync(EV).filter(d => /^REAL-CHECK-/.test(d)).sort()) { const f = EV + '/' + d + '/' + base + '.json'; if (fs.existsSync(f)) old = JSON.parse(fs.readFileSync(f, 'utf8')); }
const PL = R.PLANES[base] || require('/workspace/DeGaRoR.github.io/flyDiy/tools/real_refs.js').PLANES[base];
const P = Object.assign({}, PL, file ? { file } : {});
const log = console.log; console.log = () => {};
let q = null, err = null; try { q = RC.runPlane(base, P); } catch (e) { err = e.message; }
console.log = log;
if (!old || !q) { console.log(JSON.stringify({ key, err: err || 'no result' })); process.exit(0); }
const o = Object.assign({}, old, file ? { cases: q.cases, shape: q.shape || old.shape, facts: q.facts || old.facts } : { cases: q.cases });
const V = RC.verdicts(o); o.verdicts = V; const s = RR.scorePlane(o);
console.log(JSON.stringify({ key, O: s.overall, P: s.performance, G: s.geometry, S: s.specs, air: V.filter(v => /^airframe/.test(v.src || '')).map(v => ({ k: v.k, ours: v.ours, verdict: v.verdict })) }));
