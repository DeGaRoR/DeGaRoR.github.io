#!/usr/bin/env node
// train_gate.js - THE PER-TRAIN STRICT GATE (G1362-G1364, GATE-TOOLS; the user, 2026-10-03: "no regression accepted,
// ever"). One command per merge train, on the box, under ONE GPU lock, on the BUILT page. It runs three rigs one after
// the other, reads their reports into ONE JSON of rows, and compares every row with a stored baseline within its slack:
// a row past its slack is RED, named, and the train does not land (exit 1).
//
//   1. ROLLOUT  tools/rollout_perf.js at HOME (the route HOME / CIRCUIT), the CHASE view and the COCKPIT view, the Cub
//               (--build default) and the metal Cessna (bugReports/cessnaMetal (1).json); --reps runs per group, the
//               medians gated through rollout_ratchet.js's own metrics() and RULES (fps, p99 taxi / all, the share over
//               1.5x the cap, frames over 100 ms, tasks, loop / render / solver, the world's slice, the loads and the
//               compile); p99.9, over 3x, over 1 s and the uneven share are INFO rows (printed, never red).
//   2. GARAGE   tools/perf/garage_lag.js on this tree: the Cub and the metal Cessna, the ten-change script; per change
//               the handler's ms (sync) and the long tasks to quiet (busy), medians of --reps; per build their sums.
//   3. BENCH    a tools/master_bench.js subset: every load (full: the cold first load too; navigation -> garage, every
//               garage -> world and back, the second round trip), the garage scene, the taxi at HOME and at ONE remote
//               strip (--remote, default mn_strip: the farthest land stand, the heaviest new-stand load), and the water
//               taxi of bugReports/cessnaFloatsWOrks.json on the SEA lane - the Cub alone (the metal is the rollout's).
//               Per scene fps, p99, the share over 1.5x the cap, frames over 100 ms, the worst task; per load its seconds
//               and the worst task under it.
//
// MODES:  --light  one rollout run per group (20 s recorded), garage reps 2, the bench without the cold load (~15 min)
//         --full   two rollout runs per group (25 s recorded), garage reps 3, the bench with the cold load (~25 min,
//                  ~28 with the overheads; --secs / --reps trim it - a baseline is only compared with a run of its mode)
//         --plan   prints the steps, their command lines and the expected minutes - no browser (with --light / --full)
// Usage:  node tools/perf/train_gate.js --plan [--light]
//         node tools/perf/train_gate.js --full --port 8700 [--udd D:/tg] [--fallback D:/Dev/DeGaRoR.github.io] [--label t26]
//               [--only rollout,garage,bench] [--baseline <f.json>] [--out <f.json>] [--update] [--remote mn_strip]
//               [--reps n] [--secs s]
//         node tools/perf/train_gate.js --compare tools/perf/train_gate_<label>.json [--baseline <f.json>]   (no browser)
//         node tools/perf/train_gate.js --update tools/perf/train_gate_<label>.json                           (no browser)
// The baseline is per mode: tools/perf/train_gate_baseline_<light|full>.json. --update (with a run, or a saved gate JSON)
// writes it: A0 takes it on the box after a landing. A baseline from another GPU or viewport does not compare (exit 2).
// Ports: --port P serves the rollout runs, P+1 the garage rig, P+2 the bench (each rig starts and checks its own server).
// Profiles: one fresh profile per gate run under --udd (default <tmp>/tg<MMDDhhmm>; keep it SHORT - A5-LOAD's MAX_PATH),
// warmed by the bench's discarded load (the Cub) and one short metal run (discarded) before the rollout runs; each rig
// opens a fresh Chrome per load on it (CESSNA-LINKS). The reports land in tools/perf/tg_<label>/ (rp_*.json, garage_lag.json,
// master_bench.json + .txt, one log per step); the gate's JSON is tools/perf/train_gate_<label>.json.
// No --help: an unknown flag is ignored (and runs the gate).
'use strict';
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const RT = require('../rollout_ratchet.js');

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
const ROOT = path.join(__dirname, '..', '..'), REPO = path.resolve(ROOT, '..');
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');
const MODE = flag('light') ? 'light' : 'full';
const M = {
  light: { reps: 1, secs: 20, glReps: 2, cold: false, taxi: 10, water: 20, garage: 6 },
  full:  { reps: 2, secs: 25, glReps: 3, cold: true,  taxi: 15, water: 25, garage: 6 },
}[MODE];
if (opt('reps', null)) M.reps = +opt('reps');
if (opt('secs', null)) M.secs = +opt('secs');
const ONLY = new Set(opt('only', 'rollout,garage,bench').split(','));
const REMOTE = opt('remote', 'mn_strip');
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json' };
const VIEWS = ['chase', 'cockpit'];
const BASELINE = path.resolve(opt('baseline', path.join(__dirname, 'train_gate_baseline_' + MODE + '.json')));

// ---- the steps: [id, part, what, args, expected seconds] -----------------------------------------------------------------
// expected seconds (the box, RTX 3080, warm): a Chrome start + warm load to the garage ~50 s, the roll-out ~5 s, the close
// ~8 s; garage_lag ~1.6 s an evaluation (the change + 700 ms of quiet) and ~60 s a load; master_bench from its own --plan
const EST = { chrome: 8, warmLoad: 50, rollout: 5, glEval: 1.6, coldLoad: 150, bench: { light: 300, full: 330 } };
function steps(dir, port, udd) {
  const S = [];
  const P = (n) => String(port + n);
  if (ONLY.has('rollout')) {
    // the metal's own programs warmed once (the bench's discarded load warms the Cub's; without the bench, the Cub too):
    // a short cockpit run each, discarded
    for (const b of ONLY.has('bench') ? ['metal'] : ['cub', 'metal'])
      S.push({ id: 'warm_' + b, part: 'warmup', what: (b === 'cub' ? 'the Cub' : 'the metal Cessna') + ', a short cockpit run on the fresh profile (discarded)',
        args: ['tools/rollout_perf.js', '--build', BUILDS[b], '--cam', 'cockpit', '--secs', '3', '--port', P(0), '--udd', path.join(udd, 'p'), '--label', 'tg_warm_' + b, '--out', path.join(dir, 'warm_' + b + '.json')],
        sec: EST.chrome + EST.warmLoad + EST.rollout + 3 });
    for (let r = 1; r <= M.reps; r++) for (const b of Object.keys(BUILDS)) for (const v of VIEWS) {
      S.push({ id: 'rp_' + b + '_' + v + '_' + r, part: 'rollout', group: b + ' ' + v, what: (b === 'cub' ? 'the Cub' : 'the metal Cessna') + ', HOME, ' + v + ', run ' + r,
        args: ['tools/rollout_perf.js', '--build', BUILDS[b], '--cam', v, '--secs', String(M.secs), '--port', P(0), '--udd', path.join(udd, 'p'), '--label', 'tg_' + b + '_' + v + '_' + r, '--out', path.join(dir, 'rp_' + b + '_' + v + '_' + r + '.json')],
        sec: EST.chrome + EST.warmLoad + EST.rollout + M.secs });
    }
  }
  if (ONLY.has('garage')) S.push({ id: 'garage_lag', part: 'garage', what: 'the garage, the Cub and the metal Cessna, ten changes x ' + M.glReps + ' reps',
    args: ['tools/perf/garage_lag.js', '--port', P(1), '--udd', path.join(udd, 'p'), '--builds', 'cub,metal', '--reps', String(M.glReps), '--out', path.join(dir, 'garage_lag.json')],
    sec: 2 * (EST.chrome + EST.warmLoad + 6 + 10 * (M.glReps + 1) * EST.glEval) });
  if (ONLY.has('bench')) S.push({ id: 'master_bench', part: 'bench', what: 'every load' + (M.cold ? ' (the cold one too)' : ' (no cold load)') + ', the garage, the taxi at HOME and @' + REMOTE + ', the floats\' water taxi',
    args: ['tools/master_bench.js', '--port', P(2), '--udd', path.join(udd, 'p'), '--builds', 'cub', '--only', 'loads,garage,taxi,water', '--places', 'HOME,' + REMOTE,
      '--water-builds', 'floats', '--no-water-pass', '--cockpit', '0', '--taxi', String(M.taxi), '--water', String(M.water), '--garage', String(M.garage),
      '--out', path.join(dir, 'master_bench.json')].concat(M.cold ? [] : ['--no-cold']).concat(opt('fallback', null) ? ['--fallback', opt('fallback')] : []),
    sec: EST.bench[MODE] + (M.cold ? EST.coldLoad : 0) });
  if (opt('fallback', null)) for (const s of S) if (s.id !== 'master_bench') s.args.push('--fallback', opt('fallback'));
  // the bench first: its discarded warm-up load warms the fresh profile for the Cub (the rollout's metal warm-up follows)
  return S.filter(s => s.part === 'bench').concat(S.filter(s => s.part !== 'bench'));
}

// ---- the rows: one per measured number, each with its rule ---------------------------------------------------------------
// rule: up (higher is better), rel / abs (the slack is the larger of |baseline| * rel and abs), info (printed, never red)
const R_LOAD = { warm: { rel: 0.10, abs: 4, unit: 's' }, cold: { rel: 0.12, abs: 8, unit: 's' }, trip: { rel: 0.15, abs: 1.5, unit: 's' } };
const R_SCENE = {
  // p99 / over15 widened by A0's noise check (2026-10-03, the same tree run twice: metal chase p99 33.5 -> 50 ms - at a 30 cap a
  // frame is 33 or 50 ms, so p99 moves a whole frame; Cub taxi over15 4.5 -> 5.9 %): p99 one frame (17 ms), over15 2 points
  fps: { up: true, rel: 0.05, abs: 1, unit: 'fps' }, p99: { rel: 0.10, abs: 17, unit: 'ms' }, over15: { rel: 0.20, abs: 0.02, unit: '' },
  over100: { rel: 0, abs: 1, unit: '' }, taskWorst: { rel: 0.15, abs: 150, unit: 'ms' }, tasks1s: { rel: 0, abs: 0, unit: '' },
  p999: { rel: 0.25, abs: 10, unit: 'ms', info: true }, over3x: { rel: 0.25, abs: 0.002, unit: '', info: true }, uneven: { rel: 0, abs: 0.05, unit: '', info: true },
};
// change widened by the noise check (the same tree twice: Cub livery busy 319 -> 378, metal engine busy 425 -> 477 ms)
const R_GARAGE = { change: { rel: 0.25, abs: 60, unit: 'ms' }, total: { rel: 0.06, abs: 60, unit: 'ms' } };
function ruleNow(b) {
  const f = String(b.id).split('|'), name = f[f.length - 1];
  if (b.part === 'rollout' && RT.RULES[name]) return Object.assign({ info: false }, RT.RULES[name]);
  if (b.part === 'garage') return / ALL$/.test(f[1] || '') ? R_GARAGE.total : (name === 'sync' || name === 'busy') ? R_GARAGE.change : null;
  if (b.part === 'bench' && name !== 'sec' && R_SCENE[name]) return R_SCENE[name];
  return null;
}
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 10000) / 10000;
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };

function rowsRollout(files) {
  const rows = [], groups = {};
  let gpu = null, size = null;
  for (const f of files) { const j = readJSON(f.path); if (!j) continue; gpu = gpu || j.gpu; size = size || (j.size || []).join('x'); (groups[f.group] = groups[f.group] || []).push(RT.metrics(j)); }
  for (const g of Object.keys(groups).sort()) {
    const ms = groups[g];
    for (const [n, R] of Object.entries(RT.RULES)) {
      if (n === 'settings') continue;   // (the settings probe is not run here)
      rows.push({ id: 'rollout|' + g + '|' + n, part: 'rollout', what: g + ' ' + n, value: r4(RT.med(ms.map(m => m[n]))), runs: ms.length, rule: { up: !!R.up, rel: R.rel, abs: R.abs, unit: R.unit, info: !!R.info } });
    }
  }
  return { rows, gpu, size };
}
function rowsGarage(j) {
  const rows = [];
  if (!j) return rows;
  const tot = {};
  for (const r of j.rows || []) {
    const key = 'garage|' + r.build + ' ' + r.change;
    if (r.missing) { rows.push({ id: key + '|sync', part: 'garage', what: r.build + ' ' + r.change + ' sync (NO WIDGET)', value: null, rule: R_GARAGE.change }); continue; }
    rows.push({ id: key + '|sync', part: 'garage', what: r.build + ' ' + r.change + ' sync', value: r.sync.med, rule: R_GARAGE.change });
    rows.push({ id: key + '|busy', part: 'garage', what: r.build + ' ' + r.change + ' busy', value: r.busy.med, rule: R_GARAGE.change });
    const t = tot[r.build] = tot[r.build] || { sync: 0, busy: 0 }; t.sync += r.sync.med || 0; t.busy += r.busy.med || 0;
  }
  for (const b of Object.keys(tot)) {
    rows.push({ id: 'garage|' + b + ' ALL|sync', part: 'garage', what: b + ' every change, sync summed', value: +tot[b].sync.toFixed(1), rule: R_GARAGE.total });
    rows.push({ id: 'garage|' + b + ' ALL|busy', part: 'garage', what: b + ' every change, busy summed', value: +tot[b].busy.toFixed(1), rule: R_GARAGE.total });
  }
  return rows;
}
function rowsBench(j) {
  const rows = [];
  if (!j) return rows;
  const seen = {};
  const uid = k => { seen[k] = (seen[k] || 0) + 1; return seen[k] > 1 ? k + ' #' + seen[k] : k; };
  for (const l of j.loads || []) {
    const sec = l.sec != null ? l.sec : l.tripMs != null ? +(l.tripMs / 1000).toFixed(2) : null;
    const kind = /cold/.test(l.load) ? 'cold' : l.kind ? 'trip' : 'warm';
    const id = uid('bench|' + l.build + ' ' + l.load);
    rows.push({ id: id + '|sec', part: 'bench', what: l.build + ' ' + l.load, value: sec, rule: R_LOAD[kind] });
    if (l.frames && l.frames.taskWorst != null) rows.push({ id: id + '|taskWorst', part: 'bench', what: l.build + ' ' + l.load + ' worst task', value: l.frames.taskWorst, rule: R_SCENE.taskWorst });
    if (l.links && l.links.over5s != null && kind === 'warm') rows.push({ id: id + '|links5s', part: 'bench', what: l.build + ' ' + l.load + ' links over 5 s (a cache miss)', value: l.links.over5s, rule: { rel: 0, abs: 0, unit: '', info: true } });
  }
  for (const s of j.scenes || []) {
    const id = uid('bench|' + s.build + ' ' + s.scene);
    for (const [n, R] of Object.entries(R_SCENE)) rows.push({ id: id + '|' + n, part: 'bench', what: s.build + ' ' + s.scene + ' ' + n, value: s.frames ? (s[n] == null ? null : s[n]) : null, rule: R });
  }
  return rows;
}

// ---- the comparison --------------------------------------------------------------------------------------------------------
function compare(G, B) {
  const out = { red: [], better: [], ok: 0, info: [], fresh: [], skipped: 0 };
  if (B.meta.gpu && G.meta.gpu && B.meta.gpu !== G.meta.gpu) return { refuse: 'the baseline was taken on ' + B.meta.gpu + ', this run on ' + G.meta.gpu };
  if (B.meta.size && G.meta.size && B.meta.size !== G.meta.size) return { refuse: 'the baseline viewport is ' + B.meta.size + ', this run ' + G.meta.size };
  if (B.meta.mode !== G.meta.mode) return { refuse: 'the baseline is a ' + B.meta.mode + ' gate, this run ' + G.meta.mode + ' - compare with the ' + G.meta.mode + ' baseline' };
  const now = new Map(G.rows.map(r => [r.id, r])), ran = new Set(G.meta.parts || []);
  for (const b of B.rows) {
    if (!ran.has(b.part)) { out.skipped++; continue; }
    // the rule from TODAY's tables where the row's kind is known (a widened slack applies to an older baseline too -
    // A0, 2026-10-03: --update copied the old slacks with the values); the stored rule otherwise
    const n = now.get(b.id), R = ruleNow(b) || b.rule || {};
    // a worst-task row is absent when the step had no long task at all (the noise check: two trips' rows came and went) - that is 0
    const was = b.value, v = n ? n.value : (/\|taskWorst$/.test(b.id) ? 0 : null);
    if (was == null) continue;
    if (v == null) { if (!R.info) out.red.push({ id: b.id, what: b.what, was, now: null, why: n ? 'not measured' : 'MISSING (the row is gone)' }); continue; }
    const slack = Math.max(R.abs || 0, Math.abs(was) * (R.rel || 0));
    const worse = R.up ? was - v : v - was;
    const row = { id: b.id, what: b.what, was, now: v, unit: R.unit || '', slack: r4(slack) };
    if (R.info) { if (worse > slack) out.info.push(row); continue; }
    if (worse > slack) out.red.push(row); else if (worse < -slack) out.better.push(row); else out.ok++;
  }
  for (const r of G.rows) if (!B.rows.some(b => b.id === r.id) && r.value != null) out.fresh.push(r.id);
  return out;
}
function printCompare(C, G, B) {
  if (C.refuse) { console.log('\nTRAIN GATE: NOT COMPARED - ' + C.refuse); return 2; }
  const f = x => x == null ? '-' : String(x);
  console.log('\nTRAIN GATE (' + G.meta.mode + ') ' + G.meta.commit + ' vs the baseline ' + B.meta.commit + ' (' + B.meta.date + ')');
  if (JSON.stringify(B.meta.m || {}) !== JSON.stringify(G.meta.m || {})) console.log('  NOTE: the baseline ran ' + JSON.stringify(B.meta.m) + ', this run ' + JSON.stringify(G.meta.m) + ' - --secs / --reps differ: rows are compared anyway');
  console.log('  ' + C.ok + ' rows within their slack · ' + C.better.length + ' better · ' + C.info.length + ' info rows worse · ' + C.red.length + ' RED' + (C.skipped ? ' · ' + C.skipped + ' rows of parts not run' : '') + (C.fresh.length ? ' · ' + C.fresh.length + ' rows new (no baseline)' : ''));
  if (C.better.length) { console.log('\n  BETTER (ratchet down: --update after the landing)'); for (const r of C.better) console.log('    ' + r.what.padEnd(58) + f(r.was).padStart(10) + ' -> ' + f(r.now).padEnd(10) + ' ' + r.unit + '  (slack ' + r.slack + ')'); }
  if (C.info.length) { console.log('\n  INFO rows past their slack (not gated)'); for (const r of C.info) console.log('    ' + r.what.padEnd(58) + f(r.was).padStart(10) + ' -> ' + f(r.now).padEnd(10) + ' ' + r.unit + '  (slack ' + r.slack + ')'); }
  if (C.red.length) { console.log('\n  RED'); for (const r of C.red) console.log('    RED ' + r.what.padEnd(54) + f(r.was).padStart(10) + ' -> ' + f(r.now).padEnd(10) + ' ' + (r.unit || '') + (r.why ? '  ' + r.why : '  (slack ' + r.slack + ')')); }
  console.log(C.red.length ? '\nTRAIN GATE: RED (' + C.red.length + ') - the train does not land; find the cost, or the user allows it by name' : '\nTRAIN GATE: PASS');
  return C.red.length ? 1 : 0;
}
function writeBaseline(G) {
  fs.writeFileSync(BASELINE, JSON.stringify(Object.assign({}, G, { note: 'train_gate baseline (G1362): re-take with --update on the box after every landed train' }), null, 1) + '\n');
  console.log('BASELINE (' + G.meta.mode + ', ' + G.rows.length + ' rows) -> ' + rel(BASELINE));
}

// ---- one step: a child node process, its output to the console and to its log ------------------------------------------------
function runStep(s, dir) {
  return new Promise(res => {
    const log = fs.createWriteStream(path.join(dir, s.id + '.log'));
    const t0 = Date.now();
    console.log('\n==== ' + s.id + ': ' + s.what + '\n     node ' + s.args.map(a => /\s/.test(a) ? JSON.stringify(a) : a).join(' '));
    const ch = spawn(process.execPath, s.args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    const tee = d => { process.stdout.write(d); log.write(d); };
    ch.stdout.on('data', tee); ch.stderr.on('data', tee);
    const limit = setTimeout(() => { tee('\n[train_gate] ' + s.id + ' over its time limit - killed\n'); try { ch.kill(); } catch (e) {} }, Math.max(600, 3 * s.sec) * 1000);
    ch.on('exit', code => { clearTimeout(limit); log.end(); res({ id: s.id, code, sec: Math.round((Date.now() - t0) / 1000) }); });
  });
}

function plan(S) {
  console.log('TRAIN GATE - the plan (' + MODE + '; nothing runs)');
  console.log('  rollout: ' + M.reps + ' run(s) per group x ' + M.secs + ' s · garage reps ' + M.glReps + ' · bench ' + (M.cold ? 'with' : 'without') + ' the cold load, the remote strip ' + REMOTE + ' · baseline ' + rel(BASELINE) + (fs.existsSync(BASELINE) ? '' : ' (NONE YET: take it with --update)'));
  let t = 0;
  for (const s of S) { t += s.sec; console.log('\n  ' + s.id.padEnd(22) + String(Math.round(s.sec)).padStart(5) + ' s  ' + s.what + '\n      node ' + s.args.map(a => /\s/.test(a) ? JSON.stringify(a) : a).join(' ')); }
  console.log('\n  steps ' + S.length + ', expected ' + (t / 60).toFixed(0) + ' min (+~10 % overheads: ' + (t * 1.1 / 60).toFixed(0) + ' min)');
}

if (require.main === module) (async () => {
  // no browser: --compare <gate.json>, --update <gate.json>
  const cmpF = opt('compare', null), updF = opt('update', null);
  if (cmpF || updF) {
    const G = readJSON(path.resolve(cmpF || updF));
    if (!G || !G.rows) { console.error('train_gate: not a gate JSON: ' + (cmpF || updF)); process.exit(2); }
    if (updF) { writeBaseline(G); process.exit(0); }
    const B = readJSON(BASELINE); if (!B) { console.error('train_gate: no baseline at ' + rel(BASELINE) + ' - take one with --update'); process.exit(2); }
    process.exit(printCompare(compare(G, B), G, B));
  }
  const stamp = (d => [d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()].map(x => String(x).padStart(2, '0')).join(''))(new Date());
  const LABEL = opt('label', stamp);
  const DIR = path.join(__dirname, 'tg_' + LABEL);
  const UDD = path.resolve(opt('udd', path.join(os.tmpdir(), 'tg' + stamp)));
  const PORT = +opt('port', 0);
  const S = steps(DIR, PORT || 8700, path.join(UDD, stamp));
  if (flag('plan')) { plan(S); return; }
  if (!PORT) { console.error('train_gate: --port is required for a run (--plan for the steps)'); process.exit(2); }
  fs.mkdirSync(DIR, { recursive: true }); fs.mkdirSync(path.join(UDD, stamp), { recursive: true });
  const commit = (() => { try { return require('child_process').execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim(); } catch (e) { return '?'; } })();
  const build = (readJSON(path.join(ROOT, 'version.json')) || {}).build || '?';
  console.log('TRAIN GATE ' + MODE + ' · commit ' + commit + ' (build ' + build + ') · reports in ' + rel(DIR) + ' · profile ' + path.join(UDD, stamp));
  const T0 = Date.now(), ran = [];
  for (const s of S) ran.push(Object.assign(await runStep(s, DIR), { part: s.part }));
  // ---- the rows
  const parts = [...new Set(S.map(s => s.part).filter(p => p !== 'warmup'))];
  const ro = rowsRollout(S.filter(s => s.part === 'rollout').map(s => ({ path: s.args[s.args.indexOf('--out') + 1], group: s.group })));
  const rows = [].concat(ro.rows, rowsGarage(readJSON(path.join(DIR, 'garage_lag.json'))), rowsBench(readJSON(path.join(DIR, 'master_bench.json'))));
  const G = { meta: { date: new Date().toISOString(), commit, build, mode: MODE, parts, gpu: ro.gpu, size: ro.size, label: LABEL, remote: REMOTE, m: M, minutes: +((Date.now() - T0) / 60000).toFixed(1),
    steps: ran, reports: rel(DIR) }, rows };
  const OUT = path.resolve(opt('out', path.join(__dirname, 'train_gate_' + LABEL + '.json')));
  fs.writeFileSync(OUT, JSON.stringify(G, null, 1) + '\n');
  const failed = ran.filter(r => r.code !== 0 && r.part !== 'warmup');
  console.log('\n-> ' + rel(OUT) + ' (' + rows.length + ' rows, ' + G.meta.minutes + ' min)' + (failed.length ? ' · STEPS FAILED: ' + failed.map(r => r.id + ' (exit ' + r.code + ')').join(', ') : ''));
  if (flag('update')) { if (failed.length) { console.error('train_gate: a step failed - no baseline taken'); process.exit(1); } writeBaseline(G); process.exit(0); }
  const B = readJSON(BASELINE);
  if (!B) { console.error('train_gate: no baseline at ' + rel(BASELINE) + ' - take one with --update ' + rel(OUT)); process.exit(2); }
  const code = printCompare(compare(G, B), G, B);
  process.exit(failed.length && code === 0 ? 1 : code);
})().catch(e => { console.error('train_gate: ' + (e && e.stack || e)); process.exit(1); });

module.exports = { compare, rowsRollout, rowsGarage, rowsBench };
