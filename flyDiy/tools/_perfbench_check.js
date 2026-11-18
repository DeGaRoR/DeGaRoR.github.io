#!/usr/bin/env node
// _perfbench_check.js - GATE PERFBENCH (Game, 17 Nov 2026): THE IN-GAME BENCHMARK (src/viewer/perf_bench.js).
//   1 WIRED: in the page's script list after app.js (build.js), in index.html and dev.html; the game menu's row
//     ('perfbench', "Benchmark"); the run seeds the working build (flydiy.wip) and arms itself in sessionStorage, the
//     resume disarms first (never two runs from one arming); the trace is saved by a download
//   2 THE STEP RULES are runPage's (tools/flight_script.js): until (phase list, AGL, engine, stoppedAt, declined), the
//     faults (a crash, ABORT, a decline unless allowed), on synthetic states
//   3 THE FRAMES: n, p50, p99, max, over 50 / 100, the share of even frames (within 1.5x the median: the user's target 4)
//   4 THE LIBRARY: every scenario the card offers by default stands in tools/flight_scripts/ with steps and a plane whose
//     card file resolves (a list row's file, or a build path)
//   5 THE TRACE carries what the perf round reads: run, device, boot, garage (sliders, menu), steps, crash, end
// Usage: node tools/_perfbench_check.js [--selftest]  (exit 1 on a FAIL; the selftest breaks each rule and wants red)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SELF = process.argv.includes('--selftest');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
function run(B) {
  let fails = 0, checks = 0;
  const ok = (c, m, d) => { checks++; if (!c) fails++; if (!c || !SELF) console.log((c ? '  PASS ' : '  FAIL ') + m + (d ? '  [' + d + ']' : '')); };
  let src = rd('src/viewer/perf_bench.js');
  if (B === 'wire') src = src.replace("k: 'perfbench'", "k: 'perfbenchX'");
  if (B === 'disarm') src = src.replace('ss.del(KEY);   // (never two runs', '/* */;   // (never two runs');
  const PB = new Function('window', 'module', src + '\nreturn FLYDIY_PERFBENCH;')({}, undefined);
  if (B === 'even') { const s0 = PB._stats; PB._stats = d => { const r = s0(d); if (r) r.even = 100; return r; }; }
  if (B === 'cold') src = src.replace('if (A.pass === 1) { A.pass = 2;', 'if (false) { A.pass = 2;');
  if (B === 'seg') src = src.replace("seg(st.name);", '/* */');
  if (B === 'stopped') { const m0 = PB._miss; PB._miss = (U, x) => m0(Object.assign({}, U, { stoppedAt: undefined }), x); }
  // 1
  const build = rd('tools/build.js'), idx = rd('index.html'), dev = rd('dev.html');
  ok(/'world_boot\.js', 'app\.js',[\s\S]{0,400}'perf_bench\.js',/.test(build), '1 perf_bench.js in the page\'s scripts, after app.js (build.js)');
  ok(/FLYDIY_PERFBENCH/.test(idx) && /perf_bench/.test(dev), '1 built into index.html, listed in dev.html');
  ok(/FLYDIY_MENU\.add\(\{ k: 'perfbench', label: 'Benchmark'/.test(src), '1 the game menu\'s row "Benchmark"');
  ok(/localStorage\.setItem\('flydiy\.wip', card\)/.test(src) && /ss\.set\(KEY, A\);\s+location\.reload\(\);/.test(src), '1 the run seeds the working build and arms itself, then reloads');
  ok(/async function resume\(A\) \{\s+ss\.del\(KEY\);/.test(src), '1 the resume disarms first (a reload in the run starts nothing)');
  ok(/const seg = n => \{ try \{ if \(recOn\(\)\) FLIGHT_REC\.mark\('seg:' \+ n\);/.test(src) && /seg\(st\.name\);/.test(src) && /seg\('end'\);/.test(src),
     '1 THE ONE LOG (PERF-TRACE-FORMAT.md): every step a segment mark seg:<name> in the flight recorder, seg:end at the end');
  ok(/FLIGHT_REC\.event\('bench', null, \{ scenario: A\.name, file: A\.file, runner: 'ingame'/.test(src) && /await FLIGHT_REC\.save\(\);/.test(src),
     '1 the run said once (event bench, runner ingame) and the recorder\'s log saved (FLIGHT_REC.save: a download)');
  ok(/a\.download = 'flydiy_bench_'/.test(src) && /\} else \{ say\('the flight recorder is off: the summary is saved instead'\); download\(tr\); \}/.test(src), '1 the recorder off (?rec=0): the summary is saved instead');
  ok(['skip', 'weather', 'dest', 'time', 'shed', 'rollout', 'camera', 'minimap', 'load', 'wait'].every(k => src.includes("case '" + k + "':")), '1 Pilot\'s step kinds (PERF-TRACE-FORMAT.md section 1), each by its name');
  ok(/W\.PROFILE\.is\('boot', 'garage'\)/.test(src) && /if \(A\.scenario && !garageOnly\(\)\) await flight/.test(src), '1 the phone profile (the garage alone) runs the garage steps, no flight');
  // 2 (runPage's rules)
  const st = (o) => Object.assign({ t: 10, ph: 'TAXI', agl: 0, engine: true, where: null, crashed: false, declined: null }, o);
  ok(PB._miss({ phase: ['HOLD', 'LINEUP'] }, st({ ph: 'TAXI' })).length === 1 && PB._miss({ phase: ['HOLD', 'LINEUP'] }, st({ ph: 'LINEUP' })).length === 0, '2 until.phase: one of the list');
  ok(PB._miss({ agl: 30 }, st({ agl: 12 })).length === 1 && PB._miss({ agl: 30 }, st({ agl: 31 })).length === 0, '2 until.agl: at least');
  ok(PB._miss({ stoppedAt: 'HOME' }, st({ ph: 'STOPPED', where: 'w3' })).length === 1 && PB._miss({ stoppedAt: 'HOME' }, st({ ph: 'ROLLOUT', where: 'HOME' })).length === 1 &&
     PB._miss({ stoppedAt: 'HOME' }, st({ ph: 'STOPPED', where: 'HOME' })).length === 0, '2 until.stoppedAt: STOPPED on that strip');
  ok(PB._miss({ declined: true }, st({})).length === 1 && PB._miss({ declined: true }, st({ declined: 'too short' })).length === 0, '2 until.declined');
  ok(PB._miss({ s: 20 }, null, 12).length === 1 && PB._miss({ s: 20 }, null, 21).length === 0 && PB._miss({ s: 20, agl: 5 }, st({ agl: 2 }), 30).length === 1,
     '2 until.s: the step\'s own seconds (a wait needs no sim)');
  ok(PB._miss({ agl: 1 }, null).length === 1 && PB._miss(null, st({})).length === 0, '2 no sim is a miss; no until passes at once');
  ok(/the damage ended the flight/.test(PB._fault(st({ crashed: true }), {}) || '') && /ABORT/.test(PB._fault(st({ ph: 'ABORT' }), {}) || '') &&
     /declined/.test(PB._fault(st({ declined: 'x' }), {}) || '') && PB._fault(st({ declined: 'x' }), { allow: ['declined'] }) === null &&
     PB._fault(st({ declined: 'x' }), { until: { declined: true } }) === null && PB._fault(st({}), {}) === null, '2 the faults: a crash, ABORT, a decline unless allowed or wanted');
  // 3
  const d = [16, 17, 16, 17, 16, 120, 16, 17, 60, 16];
  const S = PB._stats(d);
  ok(S && S.n === 10 && S.p50 === 17 && S.max === 120 && S.over50 === 2 && S.over100 === 1 && S.orange35 === 2 && S.freeze250 === 0 && S.over1s === 0 && S.even === 80 && PB._stats([]) === null, '3 the frames: n, p50 (the runner rule, element n/2), max, over 50 / 100, 80 % even', JSON.stringify(S));
  // 4
  const LIBm = /const LIB = \[([^\]]+)\]/.exec(src), LIB = LIBm ? LIBm[1].split(',').map(x => x.trim().replace(/'/g, '')) : [];
  const lists = JSON.parse(rd('builds/lists/plane_lists.json'));
  const bad = [];
  for (const n of LIB) {
    const f = path.join(ROOT, 'tools', 'flight_scripts', n + '.json');
    if (!fs.existsSync(f)) { bad.push(n + ': no file'); continue; }
    const s = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!Array.isArray(s.steps) || !s.steps.length) bad.push(n + ': no steps');
    const m = /^list:(\d+)$/.exec(String(s.plane || '')), file = m ? ((lists.planes || []).find(r => r.n === +m[1]) || {}).file : s.plane;
    if (!file || !fs.existsSync(path.join(ROOT, file))) bad.push(n + ': the plane ' + s.plane + ' has no card file');
  }
  ok(LIB.length >= 5 && !bad.length, '4 the default library: ' + LIB.length + ' scenarios, each with steps and a card file', bad.join('; '));
  // 6 THE LOADS (the user via A0): three numbers, cold and warm, each split into phases; the targets
  ok(/L\.toGarage = Object\.assign\(verdict\(tg - from\)/.test(src) && /L\.toWorld = Object\.assign\(verdict\(t1 - m\.t\)/.test(src) && /L\.worldToGarage = Object\.assign\(verdict\(t1 - m\.t\)/.test(src),
     '6 the three loads: TIME-TO-GARAGE, TIME-TO-WORLD, WORLD-TO-GARAGE');
  ok(/if \(A\.pass === 1\) \{ A\.pass = 2; ss\.set\(KEY, A\);[^\n]*location\.reload\(\); return null; \}/.test(src) && /tr\.loads = \{ cold: A\.loads\[0\] \|\| null, warm: A\.loads\[1\] \|\| null/.test(src),
     '6 cold AND warm: a second launch with the cache kept');
  ok(/const LOAD_TARGET_MS = 30000, GARAGE_AIM_MS = 20000;/.test(src) && /W\.__pbClick = nowMs\(\); b\.click\(\);/.test(src), '6 the targets (garage ~20 s, nothing over 30 s); the time from the welcome menu\'s click');
  { const m = /const PHASE_OF = (id => [^;]+);/.exec(src); const PO = m ? eval(m[1]) : null;
    ok(!!PO && PO('compile:cold') === 'shaders' && PO('frames') === 'shaders' && PO('images') === 'assets' && PO('upload') === 'assets' && PO('world') === 'world' && PO('trees') === 'world' &&
       PO('settle') === 'settle' && PO('bake') === 'impostors' && PO('board') === 'other' && (B !== 'phase' || false),
       '6 the phases off the loading screen\'s steps: shaders, assets, world, settle, impostors, other');
    ok(/P\.shaders\.compiled = /.test(src) && /P\.assets\.KB = /.test(src) && /P\.assets\.spanMs = /.test(src), '6 the shaders compiled (programs) and the assets fetched (KB, ms) of each load'); }
  { const m = /const SAFE = new Set\((\[[^\]]+\])\);/.exec(src); const SA = m ? JSON.parse(m[1].replace(/'/g, '"')) : null;
    ok(!!SA && SA.includes('graphics') && !['updcheck', 'updclean', 'log', 'fullscreen', 'main', 'resume', 'perfbench', 'testflight', 'skipTut'].some(k => SA.includes(k)) && src.includes('.filter(k => SAFE.has(k))'),
       '6 the menu step opens an ALLOWLIST of the game own pages (never an update, a clean, the log, the full screen or an exit: 18 Nov 03:45)'); }
  // 5
  ok(['what:', 'run:', 'device:', 'loads:', 'boot:', 'garage:', 'steps:', 'crash:', 'end:'].every(k => src.includes(k)) && /garage = \{ sliders: await sliders\(say\), menu: await menuRows\(say\) \}/.test(src),
     '5 the trace: run, device, boot, garage (sliders, menu), steps, crash, end');
  return { fails, checks };
}
if (SELF) {
  let red = 0; const breaks = ['wire', 'disarm', 'even', 'stopped', 'seg', 'cold'];
  for (const b of breaks) { const r = run(b); console.log('  selftest ' + b + ': ' + (r.fails ? 'red (ok)' : 'GREEN')); if (r.fails) red++; }
  const r0 = run(null);
  console.log('GATE PERFBENCH: ' + (red === breaks.length && !r0.fails ? 'PASS' : 'FAIL'));
  process.exit(red === breaks.length && !r0.fails ? 0 : 1);
} else {
  const r = run(null);
  console.log(r.checks + ' checks');
  console.log('GATE PERFBENCH: ' + (r.fails ? 'FAIL (' + r.fails + ')' : 'PASS'));
  process.exit(r.fails ? 1 : 0);
}
