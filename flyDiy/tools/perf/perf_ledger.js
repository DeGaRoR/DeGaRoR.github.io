#!/usr/bin/env node
// perf_ledger.js - PERF-LEDGER (G3200-G3209, A0 13 Oct; the user: "how much performance have we given away since the
// optimisation trains?"). Every train's BUILT master measured with ONE rig (this tree's tools/rollout_perf.js - the light
// strict gate's rollout step: HOME, the Cub and the metal Cessna, chase and cockpit, 20 s recorded, the box's default preset,
// GFX.get() kept per run), each master served from its own detached worktree (tools/_serve.js <port> <tree> --fallback the
// main checkout - no junction), in a MIRRORED chain: the trains latest -> earliest, then earliest -> latest (an ABBA over the
// chain: the box's drift cancels to first order; with a hard stop the latest keep their two visits first).
// Per run: stand and taxi - loop (workMed), render (renderMed), world (worldMed), draws and triangles (G3200: drawsMed /
// trisMed, every renderer.render() a frame), fps delivered, p99; the load - navigation -> garage (tGarage) and the roll-out
// (tReveal). The table: each train x build x view, the mean of its visits, and the delta to the previous train shown.
//
//   node tools/perf/perf_ledger.js --plan [--trains a,b|--all] [--add t53=<commit>]          the visits + minutes, no browser
//   node tools/perf/perf_ledger.js --prepare [--trains ...] [--add ...]   the sparse detached worktrees D:/pl/<label> (flyDiy
//        without screenshots / reports / futureDesigns / bugReports, core.autocrlf=false) and each one's BUILT state: its
//        version.json build against its parked cook (tools/parked_cook.js --check); a source commit is built in place
//   node tools/perf/perf_ledger.js --run --until HH:MM [--port 8710] [--trains ...] [--add ...]   the GPU run (take the lock)
//   node tools/perf/perf_ledger.js --report                               the table from reports/evidence/PERF-LEDGER/raw
// No --help: an unknown flag stops it (exit 2).
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const { spawn, execSync, spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const flag = k => argv.includes('--' + k);
{ const known = new Set(['plan', 'prepare', 'run', 'report', 'trains', 'all', 'add', 'until', 'port', 'secs', 'runs', 'reps', 'raw']);
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (!a.startsWith('--')) continue; if (!known.has(a.slice(2))) { console.error('perf_ledger: unknown flag ' + a + ' - nothing run (known: ' + [...known].join(', ') + ')'); process.exit(2); } } }

const ROOT = path.join(__dirname, '..', '..');                 // this tree's flyDiy
const REPO = path.resolve(ROOT, '..');
const MAIN = 'D:/Dev/DeGaRoR.github.io';                       // the fallback for gitignored data (bench/, assets/*, node_modules)
const WT = 'D:/pl';                                            // the trees: D:/pl/<label>
const UDD = 'D:/plu';                                          // the profiles: D:/plu/<label> (SHORT: MAX_PATH)
const RAW = opt('raw', null) ? path.resolve(opt('raw')) : path.join(ROOT, 'reports', 'evidence', 'PERF-LEDGER', 'raw'), OUT = path.dirname(RAW);
// the chain, oldest first: each train's BUILT master (git log origin/master: '(built)'; 44.1 alone = train t441's cook commit on
// 44.4, before 44.3 merged; 44.1 + 44.3 landed as ONE built commit)
const TRAINS = [
  ['3oct', '5a2c2e7ec', 'the 3 Oct strict-gate baseline'],
  ['t38', 'd05252a9e'], ['t40', '7937e8ed2'], ['t42', '26e04598b'], ['t42.1', '6c1fa3c8'], ['t43', '37bf53368'], ['t43.2', '0402e132b'],
  ['t44.4', 'c12f0490c'], ['t44.1', '6c9dad5ec', '44.1 alone (t441 on 44.4)'], ['t44.3', 'f353a0f89', '44.1 + 44.3'],
  ['t47', '31803829d'], ['t48', '5df684f01'], ['t44', 'f09cf417f'], ['t50', '0b42f6826'], ['ship', '09683cb08', 'SCENERY-SHIP'],
  ['t41b', '9450f0e5a'], ['t52ab', '750d85b86'], ['t54b', 'b0cbaf781'],
];
for (const a of (opt('add', '') || '').split(',').filter(Boolean)) { const [l, c] = a.split('='); TRAINS.push([l, c, 'added']); }
const PRIORITY = ['3oct', 't43', 't44.1', 't44.3', 't44', 't50', 'ship', 't41b'];   // A0: if 2 h cannot cover every train
const pick = flag('all') ? TRAINS.map(t => t[0]) : (opt('trains', null) ? opt('trains').split(',') : PRIORITY.concat(TRAINS.filter(t => t[2] === 'added').map(t => t[0])));
const SEL = TRAINS.filter(t => pick.includes(t[0]));
for (const l of pick) if (!TRAINS.some(t => t[0] === l)) { console.error('perf_ledger: unknown train ' + l); process.exit(2); }
// --runs cub:chase,metal:cockpit - a subset (PERF-PRESTUDY's +22 s question: the Cub chase alone); --reps n measured runs a visit
const RUNS = [['cub', 'builds/cub_2026-09-20_corrected.json'], ['metal', 'bugReports/cessnaMetal (1).json']]
  .flatMap(([b, f]) => ['chase', 'cockpit'].map(c => ({ b, f, c })))
  .filter(R => !opt('runs', null) || opt('runs').split(',').includes(R.b + ':' + R.c));
const REPS = Math.max(1, +opt('reps', 1) || 1);
const WARMS = [...new Map(RUNS.map(R => [R.b, R.f])).entries()];   // a warm-up a build measured (discarded)
const SECS = +opt('secs', 20), RUN_S = 83, WARM_S = 66;       // the light gate's own estimates a run
const VISITS = [...SEL].reverse().map(t => ({ t, pass: 1 })).concat(SEL.map(t => ({ t, pass: 2 })));
const visitS = v => (v.pass === 1 ? WARMS.length * WARM_S : 0) + RUNS.length * REPS * RUN_S + 15;
const tree = l => path.join(WT, l.replace(/\./g, '_'));
const now = () => new Date().toTimeString().slice(0, 8);
const log = s => console.log(now() + ' ' + s);

if (flag('plan')) {
  let s = 0; console.log('PERF-LEDGER - the plan (nothing runs): ' + SEL.length + ' trains, ' + VISITS.length + ' visits');
  for (const v of VISITS) { s += visitS(v); console.log('  pass ' + v.pass + '  ' + v.t[0].padEnd(7) + ' ' + v.t[1] + '  ' + (visitS(v) / 60).toFixed(1) + ' min  (cum ' + (s / 60).toFixed(0) + ' min)' + (v.t[2] ? '  - ' + v.t[2] : '')); }
  console.log('  expected ' + (s / 60).toFixed(0) + ' min');
  process.exit(0);
}

if (flag('prepare')) {
  fs.mkdirSync(WT, { recursive: true });
  for (const [l, c] of SEL) {
    const d = tree(l);
    if (!fs.existsSync(d)) {
      log('worktree ' + l + ' at ' + c);
      execSync('git -c core.autocrlf=false worktree add --no-checkout --detach "' + d + '" ' + c, { cwd: REPO, stdio: 'ignore' });
      execSync('git -c core.autocrlf=false sparse-checkout set --no-cone "/flyDiy/" "!/flyDiy/screenshots/" "!/flyDiy/reports/" "!/flyDiy/futureDesigns/" "!/flyDiy/bugReports/"', { cwd: d, stdio: 'ignore' });
      execSync('git -c core.autocrlf=false checkout --detach ' + c, { cwd: d, stdio: 'ignore' });
    }
    const chk = () => spawnSync(process.execPath, ['tools/parked_cook.js', '--check'], { cwd: path.join(d, 'flyDiy'), encoding: 'utf8' });
    let r = chk(), line = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').pop();
    if (!/\(same\)/.test(line)) {
      log('  ' + l + ': ' + line + ' - building in place (its own tools/build.js)');
      const b = spawnSync(process.execPath, ['tools/build.js'], { cwd: path.join(d, 'flyDiy'), encoding: 'utf8' });
      if (b.status) log('  ' + l + ': BUILD FAILED ' + (b.stderr || '').slice(-200));
      r = chk(); line = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').pop();
    }
    log('  ' + l.padEnd(7) + c + '  ' + line);
  }
  process.exit(0);
}

const getOK = url => new Promise(res => { const q = http.get(url, r => { r.resume(); res(r.statusCode === 200); }); q.on('error', () => res(false)); q.setTimeout(3000, () => { q.destroy(); res(false); }); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const killTree = pid => { try { execSync('taskkill /T /F /PID ' + pid, { stdio: 'ignore' }); } catch (e) {} };
function runRig(args, maxS) {
  return new Promise(res => {
    const p = spawn(process.execPath, [path.join(ROOT, 'tools', 'rollout_perf.js')].concat(args), { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let o = ''; p.stdout.on('data', d => o += d); p.stderr.on('data', d => o += d);
    const to = setTimeout(() => { o += '\nperf_ledger: TIMEOUT ' + maxS + ' s - the tree killed'; killTree(p.pid); }, maxS * 1000);
    p.on('close', code => { clearTimeout(to); res({ code, out: o }); });
  });
}

if (flag('run')) (async () => {
  const until = opt('until', null); if (!until) { console.error('perf_ledger: --run needs --until HH:MM (the hard stop)'); process.exit(2); }
  const end = (() => { const d = new Date(), [h, m] = until.split(':').map(Number); d.setHours(h, m, 0, 0); if (d < new Date()) d.setDate(d.getDate() + 1); return d.getTime(); })();
  const PORT = +opt('port', 8710);
  fs.mkdirSync(RAW, { recursive: true }); fs.mkdirSync(UDD, { recursive: true });
  const EVAL = 'window.GFX && GFX.get ? GFX.get() : null';   // (rollout_perf stringifies the value itself)
  log('PERF-LEDGER run: ' + VISITS.length + ' visits, the hard stop ' + until + ', the rig ' + path.join(ROOT, 'tools', 'rollout_perf.js'));
  for (const v of VISITS) {
    const [l, c] = v.t, d = tree(l);
    if (Date.now() + (RUN_S + 20) * 1000 > end) { log('the hard stop: ' + l + ' pass ' + v.pass + ' and after skipped'); break; }
    if (!fs.existsSync(path.join(d, 'flyDiy', 'index.html'))) { log(l + ': no tree at ' + d + ' (run --prepare) - skipped'); continue; }
    const srv = spawn(process.execPath, [path.join(ROOT, 'tools', '_serve.js'), String(PORT), d, '--fallback', MAIN], { stdio: 'ignore' });
    const URL = 'http://localhost:' + PORT + '/flyDiy/index.html';
    let up = false; for (let i = 0; i < 40 && !up; i++) { await sleep(250); up = await getOK(URL); }
    if (!up) { log(l + ': the server never answered on ' + PORT + ' - skipped'); killTree(srv.pid); continue; }
    const udd = path.join(UDD, l.replace(/\./g, '_'));
    log('== ' + l + ' (' + c + ') pass ' + v.pass + (v.t[2] ? ' - ' + v.t[2] : ''));
    if (v.pass === 1 || !fs.existsSync(udd)) for (const [b, f] of WARMS) {
      if (Date.now() + WARM_S * 1000 > end) break;
      const r = await runRig(['--url', URL, '--build', f, '--cam', 'cockpit', '--secs', '3', '--udd', udd, '--label', 'pl_warm', '--out', path.join(UDD, 'warm.json')], 240);
      log('  warm ' + b + ' (discarded)' + (r.code ? ' exit ' + r.code : ''));
    }
    for (const R of RUNS) for (let k = 1; k <= REPS; k++) {
      if (Date.now() + RUN_S * 1000 > end) { log('  the hard stop: ' + R.b + ' ' + R.c + ' skipped'); continue; }
      const lab = ['pl', l, 'p' + v.pass, R.b, R.c].concat(REPS > 1 ? ['r' + k] : []).join('_'), out = path.join(RAW, lab + '.json');
      const r = await runRig(['--url', URL, '--build', R.f, '--cam', R.c, '--secs', String(SECS), '--udd', udd, '--label', lab, '--out', out, '--eval', EVAL], 300);
      const j = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
      const ph = j && j.phases || {}, s = ph.stand || {}, t = ph.taxi || {};
      log('  ' + (R.b + ' ' + R.c).padEnd(14) + (j ? 'garage ' + j.tGarage + ' s, roll-out ' + j.tReveal + ' s; stand loop ' + s.workMed + ' / render ' + s.renderMed + ' / draws ' + s.drawsMed + '; taxi loop ' + t.workMed + ' / render ' + t.renderMed + ' / world ' + t.worldMed + ' / draws ' + t.drawsMed : 'NO RESULT (exit ' + r.code + ') ' + r.out.trim().split('\n').slice(-2).join(' | ')));
      fs.writeFileSync(path.join(RAW, lab + '.log'), r.out);
    }
    killTree(srv.pid);
  }
  log('done - node tools/perf/perf_ledger.js --report');
  process.exit(0);
})();

if (flag('report')) {
  const files = fs.existsSync(RAW) ? fs.readdirSync(RAW).filter(f => /^pl_.*\.json$/.test(f)) : [];
  const rows = {};   // label -> build_cam -> [results]
  for (const f of files) {
    const m = /^pl_(.+)_p(\d)_(cub|metal)_(chase|cockpit)(?:_r\d+)?\.json$/.exec(f); if (!m) continue;
    const j = JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8')), ph = j.phases || {}, s = ph.stand || {}, t = ph.taxi || {};
    let gfx = j.eval; for (let i = 0; i < 2 && typeof gfx === 'string'; i++) { try { gfx = JSON.parse(gfx); } catch (e) { gfx = null; } }
    const steps = {}; { let set = null; for (const b of (j.bootLog || [])) { if (b.k === 'run') { set = b.set; continue; } if (b.k === 'step' && set === 'garage') steps[b.id] = (steps[b.id] || 0) + (b.ms || 0); } }
    const dts = (j.frames || []).map(r => r[1]).filter(x => x > 0), o34 = dts.length ? 100 * dts.filter(x => x > 34).length / dts.length : null;
    ((rows[m[1]] = rows[m[1]] || {})[m[3] + ' ' + m[4]] = rows[m[1]][m[3] + ' ' + m[4]] || []).push({ pass: +m[2], preset: gfx && gfx.preset,
      sLoop: s.workMed, sRender: s.renderMed, sWorld: s.worldMed, sDraws: s.drawsMed, sFps: s.fpsDelivered,
      tLoop: t.workMed, tRender: t.renderMed, tWorld: t.worldMed, tDraws: t.drawsMed, tFps: t.fpsDelivered, tP99: t.dtP99,
      garage: j.tGarage, rollout: j.tReveal, o34, steps });
  }
  const K = ['sLoop', 'sRender', 'sWorld', 'sDraws', 'tLoop', 'tRender', 'tWorld', 'tDraws', 'tFps', 'tP99', 'o34', 'garage', 'rollout'];
  const mean = (a, k) => { const v = a.map(r => r[k]).filter(x => typeof x === 'number'); return v.length ? v.reduce((p, q) => p + q, 0) / v.length : null; };
  const f1 = x => (x == null ? '-' : Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(1)), sg = x => (x == null ? '-' : (x > 0 ? '+' : '') + f1(x));
  const order = TRAINS.map(t => t[0]).filter(l => rows[l]);
  const L = ['# PERF-LEDGER - every train\'s built master, one rig (G3200)', '',
    'HOME, the box\'s default preset (GFX.get() per run below), 20 s recorded a run; each cell the mean of the train\'s visits (n). ' +
    'stand / taxi: loop = the frame\'s JS work, render = renderer.render() CPU, world = WORLD.worldUpdate, draws = draw calls a frame (shadows included); ' +
    'garage = navigation -> garage (s), roll-out = Roll out -> flight (s). The second line of a train: the delta to the train above.', ''];
  const cols = ['stand loop', 'stand render', 'stand world', 'stand draws', 'taxi loop', 'taxi render', 'taxi world', 'taxi draws', 'taxi fps', 'taxi p99', 'over 34 ms %', 'garage s', 'roll-out s'];
  const J = {};
  for (const bc of RUNS.map(R => R.b + ' ' + R.c)) {
    L.push('## ' + bc, '', '| train | n | preset | ' + cols.join(' | ') + ' |', '|' + ' --- |'.repeat(cols.length + 3));
    let prev = null;
    for (const l of order) {
      const a = (rows[l] || {})[bc]; if (!a || !a.length) continue;
      const m = Object.fromEntries(K.map(k => [k, mean(a, k)]));
      (J[l] = J[l] || {})[bc] = Object.assign({ n: a.length, preset: a[0].preset }, m);
      L.push('| ' + l + ' | ' + a.length + ' | ' + (a[0].preset || '?') + ' | ' + K.map(k => f1(m[k])).join(' | ') + ' |');
      if (prev) L.push('| &nbsp;&nbsp;Δ vs ' + prev.l + ' | | | ' + K.map(k => sg(m[k] != null && prev.m[k] != null ? m[k] - prev.m[k] : null)).join(' | ') + ' |');
      prev = { l, m };
    }
    L.push('');
    // THE LOAD BY STEP (PERF-PRESTUDY: "what added +22 s of warm load?"): the garage boot's steps (ms), each train's mean, the delta
    const ids = [...new Set(order.flatMap(l => ((rows[l] || {})[bc] || []).flatMap(r => Object.keys(r.steps || {}))))];
    if (ids.length) {
      const sm = (l, id) => mean(((rows[l] || {})[bc] || []).map(r => ({ v: r.steps ? r.steps[id] || 0 : null })), 'v');
      L.push('### ' + bc + ' - the garage boot by step (ms; the delta to the train above below each)', '', '| train | ' + ids.join(' | ') + ' | sum |', '|' + ' --- |'.repeat(ids.length + 2));
      let pv = null; const grew = [];
      for (const l of order) { if (!((rows[l] || {})[bc] || []).length) continue;
        const v = ids.map(id => sm(l, id)), sum = v.reduce((p, q) => p + (q || 0), 0);
        L.push('| ' + l + ' | ' + v.map(x => (x == null ? '-' : Math.round(x))).join(' | ') + ' | ' + Math.round(sum) + ' |');
        if (pv) { const d = v.map((x, i) => (x != null && pv.v[i] != null ? x - pv.v[i] : null));
          L.push('| &nbsp;&nbsp;Δ vs ' + pv.l + ' | ' + d.map(x => (x == null ? '-' : (x > 0 ? '+' : '') + Math.round(x))).join(' | ') + ' | ' + (sum - pv.sum > 0 ? '+' : '') + Math.round(sum - pv.sum) + ' |');
          d.forEach((x, i) => { if (x != null && Math.abs(x) >= 1000) grew.push(pv.l + ' -> ' + l + ': ' + ids[i] + ' ' + (x > 0 ? '+' : '') + (x / 1000).toFixed(1) + ' s'); }); }
        pv = { l, v, sum }; }
      L.push('', '**Steps that moved by 1 s or more:** ' + (grew.length ? grew.join('; ') : 'none'), '');
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'ledger.md'), L.join('\n'));
  fs.writeFileSync(path.join(OUT, 'ledger.json'), JSON.stringify({ trains: TRAINS, cells: J }, null, 1));
  console.log(L.join('\n'));
  console.log('\nwritten ' + path.relative(ROOT, path.join(OUT, 'ledger.md')) + ' and ledger.json');
  process.exit(0);
}
if (!['plan', 'prepare', 'run', 'report'].some(flag)) { console.error('perf_ledger: one of --plan / --prepare / --run / --report'); process.exit(2); }
