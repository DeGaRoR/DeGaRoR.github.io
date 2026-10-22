#!/usr/bin/env node
// G2042 (DMG-FABRIC): what the cover ties cost.
//   node tools/dmg_fabric_perf.js --ties [--cases cub:trunk25,..]   the cost a tie a substep: a crash flown to rest (the
//        certificate stamped), the solver's own tiePass (lifted from its source) timed over copies of its live ties and
//        the wreck's nodes; the median of 7 blocks of 200k passes, over the live ties
//   node tools/dmg_fabric_perf.js --pairs <base tools/flight_core.js> [--n 12]   an INTACT aeroplane, nothing touching
//        (treecrash_evidence.js --perf-child: a far 4000-trunk set, damage ON): the base's core and this one in
//        alternating child processes - the step's code differs only in the one counter postLive reads (nPost for nFlr)
'use strict';
const path = require('path');
const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

if (argv[0] === '--ties') {
  // THE PASS ITSELF, timed on a real wreck's ties: the solver's own tiePass (its source, lifted from 30_solver.js as written)
  // run over copies of the live ties' arrays and the wreck's own nodes. In situ the pass is a few microseconds of a 3-6 ms
  // step - under the box's step-to-step noise - so it is timed alone: the same code on the same data
  process.env.FLYDIY_CERT = '1';
  const fs = require('fs'), F = require('./_dmg_fabric_lib.js');
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', '30_solver.js'), 'utf8');
  const a0 = src.indexOf('  function tiePass() {'), a1 = src.indexOf('\n  }\n', a0);
  const body = src.slice(src.indexOf('{', a0) + 1, a1);
  const names = ['p', 'v', 'f', 'TA', 'TB', 'TLs', 'TLp', 'TEu', 'TT', 'TF', 'TLIVE', 'TFy', 'TK', 'TKu', 'TC', 'TFp', 'TSh', 'nTieL', 'nFlr', 'nPost', 'hyp3', 'DMG', 'simT'];
  const pass = new Function(...names, body + '\n  return nTieL;');
  const out = [];
  for (const kc of opt('cases', 'cub:trunk25,jodel:trunk25,cub:trunk0,metal:trunk0').split(',')) {
    const [k, id] = kc.split(':');
    const r = F.runFabric(k, id, { secs: 7 }), sim = r.sim, T = sim.coverTies();
    if (!T || !T.nLive) { out.push({ k, id, live: 0 }); console.log(k, id, 'no live tie at rest'); continue; }
    let subs = 0; sim.onSubstep = () => { subs++; }; sim.step(1 / 60); sim.onSubstep = null;
    const c = x => x.slice(), D = { tieT: 0 }, hyp3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);
    const args = () => [sim.p.slice(), sim.v.slice(), new Float64Array(sim.f.length), T.a, T.b, T.Ls, c(T.Lp), T.eu, c(T.torn), c(T.F), c(T.live), T.Fy, T.k, T.ku, T.c, c(T.Fp), T.sheet, T.nLive, 0, 0, hyp3, D, sim.t];
    const A = args(); let taut = 0; for (let s = 0; s < T.nLive; s++) { const q = T.live[s]; if (T.F[q] > 0) taut++; }
    const N = 200000; let left = 0;
    for (let i = 0; i < 20000; i++) left = pass(...A);                      // warm
    const ns = [];
    for (let b = 0; b < 7; b++) { const t0 = process.hrtime.bigint(); for (let i = 0; i < N; i++) left = pass(...A); ns.push(Number(process.hrtime.bigint() - t0) / N); }
    ns.sort((x, y) => x - y);
    const per = ns[3] / T.nLive;
    out.push({ k, id, made: T.n, live: T.nLive, taut, left, subs, nsPass: +ns[3].toFixed(1), nsPerTieSub: +per.toFixed(2), nsPerFrame: +(ns[3] * subs).toFixed(0) });
    console.log(k.padEnd(6), id.padEnd(8), 'ties made', T.n, 'live at rest', T.nLive, '(taut ' + taut + ')', '| the pass', ns[3].toFixed(1), 'ns ->', per.toFixed(1), 'ns a tie a substep;', subs, 'substeps a frame ->', (ns[3] * subs / 1000).toFixed(2), 'us a frame');
  }
  console.log('RESULT ' + JSON.stringify(out));
} else if (argv[0] === '--pairs') {
  const { spawnSync } = require('child_process');
  const base = argv[1], mine = path.join(__dirname, 'flight_core.js'), N = +opt('n', 12), TE = path.join(__dirname, 'treecrash_evidence.js');
  const one = core => { const r = spawnSync(process.execPath, [TE, '--perf-child', core, k, mode], { encoding: 'utf8', env: process.env });
    const l = (r.stdout || '').split('\n').find(x => x.startsWith('PERF ')); return l ? JSON.parse(l.slice(5)) : null; };
  let k = 'cub', mode = 'ground';
  for (const km of (opt('cases', 'cub:ground,metal:ground,metal:air')).split(',')) {
    [k, mode] = km.split(':');
    const b = [], m = [];
    for (let i = 0; i < N; i++) { if (i % 2) { m.push(one(mine)); b.push(one(base)); } else { b.push(one(base)); m.push(one(mine)); } }
    const med = a => { const v = a.filter(Boolean).map(x => x.med).sort((x, y) => x - y); return v[v.length >> 1]; };
    const pr = b.map((x, i) => x && m[i] ? m[i].med / x.med - 1 : null).filter(x => x !== null).sort((x, y) => x - y);
    console.log(km.padEnd(13), 'base', med(b).toFixed(3), 'ms, now', med(m).toFixed(3), 'ms:', ((med(m) / med(b) - 1) * 100).toFixed(1) + ' %', '(pair median', (pr[pr.length >> 1] * 100).toFixed(1) + ' %, armed', m.map(x => x && x.armed).join('/') + ')');
  }
}
