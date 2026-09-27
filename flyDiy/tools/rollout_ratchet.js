// rollout_ratchet.js - THE MERGE TRAIN'S PERF RATCHET (G1015, 2026-09-27)
//
// Why: the gate battery is node-only; nothing in it measures a real frame. On 2026-09-27 the taxi's render CPU grew
// 11.0 -> 14.7 ms across eight landings, every one of them green. From train 11 on, every merge train ends with a fixed
// rollout_perf scenario on the BUILT page, and this tool compares it with the stored baseline: a regression past the
// tolerance is RED, the train does not land (the same rule as a red gate). GATE FRAMECOST (G1010) counts the per-frame
// work in node; this is the other half - real time, the GPU, the evenness of the frames.
//
// The scenario (the coordinator's, one GPU_BENCH.lock hold, no CPU_BATTERY lock):
//   for b in default "bugReports/cessnaMetal (1).json"; do for r in 1 2; do
//     node tools/rollout_perf.js --build "$b" --label ratchet_<cub|metal>_$r [--settings on the Cub runs]; done; done
// then:  node tools/rollout_ratchet.js tools/perf/rollout_ratchet_*.json            (compare, exit 1 on red)
//        node tools/rollout_ratchet.js --update tools/perf/rollout_ratchet_*.json   (take the baseline, after a landing)
// Runs are grouped by build + cold + world + size + GPU; each metric is the MEDIAN over a group's runs (two runs each:
// one run's noise is the ~10 % A0 measured). A baseline taken on another GPU or size does not compare: it says so.
//
// Metrics (the taxi phase unless named): delivered fps, the UNEVEN share (consecutive intervals that change their
// refresh count - the judder a 60 Hz screen shows), dt p99, loop JS, render CPU, solver, frames over 100 ms after the
// reveal, main-thread tasks over 1 s and over 200 ms (boot included), the longest world slice, the roll-out screen
// (garage ready -> reveal), the roll-out's compile step, the settings probe's worst task.
// Absolute targets (PLAYTEST-2026-09-26 §4, printed, not the ratchet's verdict): R1 no frame over 100 ms after the
// reveal, R2 never 3 s below 30, R3 >= 50 fps delivered, R4 no task over 1 s, R5 uneven <= 15 % and p99 <= 2 x the
// cap's interval.
'use strict';
const fs = require('fs'), path = require('path');
const args = process.argv.slice(2);
const UPDATE = args.includes('--update');
const bi = args.indexOf('--baseline');
const BASE = bi >= 0 ? args[bi + 1] : path.join(__dirname, 'perf', 'ratchet_baseline.json');
const files = args.filter((a, i) => !a.startsWith('--') && !(bi >= 0 && i === bi + 1));
if (!files.length) { console.error('usage: node tools/rollout_ratchet.js [--update] [--baseline f.json] run1.json [run2.json ...]'); process.exit(2); }

const REFRESH = 1000 / 60;
const med = a => { const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length & 1 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r2 = x => x == null ? null : Math.round(x * 100) / 100;

// one run -> its metrics
function metrics(j) {
  const taxi = (j.phases && j.phases.taxi) || {};
  const fr = (j.frames || []).filter(r => r[16] === 'taxi');
  let uneven = null;
  if (fr.length > 10) {   // the refresh count of each interval; uneven = it changed from the previous one
    let n = 0, ch = 0, prev = null;
    for (const r of fr) { const k = Math.max(1, Math.round(r[1] / REFRESH)); if (prev !== null) { n++; if (k !== prev) ch++; } prev = k; }
    uneven = n ? ch / n : null;
  }
  const lt = (j.longTasks || []).map(t => t[1]);
  const steps = (j.bootLog || []).filter(b => b.k === 'step' || b.k === 'run');
  let compile = null, inRoll = false;   // the roll-out run's compile step (not the garage's, not a settings screen's)
  for (const b of steps) { if (b.k === 'run') { inRoll = b.set === 'rollout'; continue; } if (inRoll && b.id === 'compile') { compile = b.ms; break; } }
  const settingsWorst = (j.settings || []).length ? Math.max(...j.settings.map(s => s.worst || 0)) : null;
  const g = j.gates || {};
  return {
    fps: taxi.fpsDelivered != null ? taxi.fpsDelivered : null,
    uneven, p99: taxi.dtP99 != null ? taxi.dtP99 : null,
    loop: taxi.workMed != null ? taxi.workMed : null, render: taxi.renderMed != null ? taxi.renderMed : null, solver: taxi.physMed != null ? taxi.physMed : null,
    over100: g.over100ms ? g.over100ms.n : null, below30s: g.below30run ? g.below30run.sec : null,
    tasks1s: lt.filter(x => x > 1000).length, tasks200: lt.filter(x => x > 200).length, taskWorst: lt.length ? Math.max(...lt) : 0,
    slice: j.worldSlices ? j.worldSlices.worst : null,
    screen: j.tReveal != null && j.tGarage != null ? j.tReveal - j.tGarage : null,
    compile, settings: settingsWorst,
    cap: taxi.cap30 != null && taxi.cap30 > 0.5 ? 30 : 60,
  };
}

// the ratchet: direction, relative tolerance, absolute slack (a small number's noise is absolute, not relative)
const RULES = {
  fps:      { up: true,  rel: 0.05, abs: 1.0,  unit: 'fps' },
  uneven:   { up: false, rel: 0,    abs: 0.05, unit: '' },
  p99:      { up: false, rel: 0.10, abs: 2,    unit: 'ms' },
  loop:     { up: false, rel: 0.10, abs: 0.8,  unit: 'ms' },
  render:   { up: false, rel: 0.10, abs: 0.6,  unit: 'ms' },
  solver:   { up: false, rel: 0.15, abs: 0.6,  unit: 'ms' },
  over100:  { up: false, rel: 0,    abs: 1,    unit: '' },
  tasks1s:  { up: false, rel: 0,    abs: 1,    unit: '' },   // a task at ~1 s flips across the line run to run; R4 still wants 0
  tasks200: { up: false, rel: 0.25, abs: 3,    unit: '' },
  taskWorst:{ up: false, rel: 0.15, abs: 150,  unit: 'ms' },
  slice:    { up: false, rel: 0.15, abs: 150,  unit: 'ms' },
  screen:   { up: false, rel: 0.10, abs: 3,    unit: 's' },
  compile:  { up: false, rel: 0.15, abs: 2000, unit: 'ms' },
  settings: { up: false, rel: 0.20, abs: 150,  unit: 'ms' },
};

const groups = {};
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const key = [path.basename(String(j.build || 'OLD-STOCK')), j.cold ? 'cold' : 'warm', j.world || 'jolene', (j.size || []).join('x'), j.gpu || '?'].join(' | ');
  (groups[key] = groups[key] || []).push({ f, m: metrics(j), fx: { cold: !!j.cold } });
}
const agg = {};
for (const [k, runs] of Object.entries(groups)) {
  const o = {}; for (const name of Object.keys(RULES).concat(['below30s', 'cap'])) o[name] = r2(med(runs.map(r => r.m[name])));
  o.runs = runs.length; o.files = runs.map(r => path.basename(r.f)); agg[k] = o;
}

function targets(k, m) {
  const capIv = 1000 / (m.cap || 60);
  const t = [['R1 no frame > 100 ms', m.over100 === 0], ['R2 < 3 s below 30', m.below30s != null && m.below30s < 3], ['R3 >= 50 fps delivered', m.fps != null && m.fps >= 50],
    ['R4 no task > 1 s', m.tasks1s === 0], ['R5 uneven <= 15 %, p99 <= 2x cap', m.uneven != null && m.uneven <= 0.15 && m.p99 != null && m.p99 <= 2 * capIv + 0.5]];
  return t.map(([n, ok]) => (ok ? 'PASS ' : 'FAIL ') + n).join(' · ');
}

if (UPDATE) {
  const out = { date: new Date().toISOString(), note: 'rollout_ratchet baseline (G1015): medians per group; re-take after every landed train with --update', groups: agg };
  fs.mkdirSync(path.dirname(BASE), { recursive: true });
  fs.writeFileSync(BASE, JSON.stringify(out, null, 1) + '\n');
  for (const [k, m] of Object.entries(agg)) console.log(`BASELINE ${k} (${m.runs} runs)\n  ${Object.keys(RULES).map(n => `${n} ${m[n]}`).join(' · ')}\n  targets: ${targets(k, m)}`);
  console.log(`-> ${BASE}`);
  process.exit(0);
}

if (!fs.existsSync(BASE)) { console.error(`no baseline at ${BASE} - take one with --update`); process.exit(2); }
const base = JSON.parse(fs.readFileSync(BASE, 'utf8')).groups || {};
let red = 0, compared = 0;
for (const [k, m] of Object.entries(agg)) {
  const b = base[k];
  console.log(`\n== ${k}  (${m.runs} run${m.runs > 1 ? 's' : ''}${m.runs < 2 ? ' - ONE run: noise not averaged, re-run before trusting a red' : ''})`);
  if (!b) { console.log('  no baseline for this group (another build, GPU or size?) - not compared'); continue; }
  compared++;
  for (const [n, R] of Object.entries(RULES)) {
    const now = m[n], was = b[n];
    if (now == null || was == null) { console.log(`  ${n.padEnd(9)} ${String(was).padStart(8)} -> ${String(now).padStart(8)}  (not measured)`); continue; }
    const slack = Math.max(R.abs, Math.abs(was) * R.rel);
    const worse = R.up ? was - now : now - was;
    const verdict = worse > slack ? 'RED' : (worse < -slack ? 'better (ratchet down: --update after landing)' : 'ok');
    if (verdict === 'RED') red++;
    console.log(`  ${n.padEnd(9)} ${String(was).padStart(8)} -> ${String(now).padStart(8)} ${R.unit.padEnd(3)} (slack ${r2(slack)})  ${verdict}`);
  }
  console.log(`  targets: ${targets(k, m)}`);
}
if (!compared) { console.error('\nNOTHING COMPARED: no group matches the baseline'); process.exit(2); }
console.log(red ? `\nRATCHET: RED (${red}) - the train does not land; find the cost or ALLOW it with the user` : '\nRATCHET: PASS');
process.exit(red ? 1 : 0);
