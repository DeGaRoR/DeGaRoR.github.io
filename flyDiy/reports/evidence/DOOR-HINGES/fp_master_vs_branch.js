// DOOR-HINGES: every build file's certificate fingerprints under origin/master's bench.js / 76_procure.js vs this
// branch's. node fp_master_vs_branch.js <master flyDiy dir> <branch flyDiy dir>
const fs = require('fs'), path = require('path'), vm = require('vm');
const [MA, BR] = process.argv.slice(2);
const load = f => { const m = { exports: {} };
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), { module: m, exports: m.exports, console, Math, JSON, parseFloat, isFinite, Number,
    String, Array, Object, Uint8ClampedArray, Infinity, setTimeout, clearTimeout, setInterval, clearInterval,
    performance: { now: () => 0 }, Date, Symbol }); return m.exports; };
const bm = load(path.join(MA, 'src/viewer/bench.js')), bb = load(path.join(BR, 'src/viewer/bench.js'));
process.env.FLYDIY_STALE_OK = '1';
const cm = require(path.join(MA, 'tools/flight_core.js')), cb = require(path.join(BR, 'tools/flight_core.js'));
let n = 0, same = 0;
for (const dir of ['builds', 'tools/fixtures']) for (const f of fs.readdirSync(path.join(BR, dir)).sort()) {
  if (!/\.json$/.test(f)) continue;
  let j; try { j = JSON.parse(fs.readFileSync(path.join(BR, dir, f), 'utf8')); } catch (e) { continue; }
  const s = j && (j.spec || j); if (!s || !s.cage || typeof s.cage !== 'object') continue;
  const a = [bm.benchFingerprint(s), cm.procureFp(s)], b = [bb.benchFingerprint(s), cb.procureFp(s)];
  const ok = a.join() === b.join(); n++; if (ok) same++;
  console.log((ok ? 'same ' : 'DIFF ') + dir + '/' + f + '  bench ' + a[0] + ' / ' + b[0] + '  procure ' + a[1] + ' / ' + b[1]);
}
console.log(same + ' of ' + n + ' build files hash the same under master and this branch');
