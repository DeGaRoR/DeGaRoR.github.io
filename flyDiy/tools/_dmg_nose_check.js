#!/usr/bin/env node
// GATE DMGNOSE (G2013-G2015, DMG-NOSE) - the crushable nose and the nose's corner cases on the certificate, node only,
// on the user's validated builds (DEFORM-AND-BREAK §11.3; DMG-WINDBREAK's open 1 and 2).
// DMG-WINDBREAK measured it: at the page's impact speed (a 3 m/s taxi into a trunk) the user's Cub still lost its engine
// mount in 17 of 49 winds - mostly after the crankcase stand-in (CGE-ENGL / R, a thin 4130 tube's M_p) folded round the
// trunk and tore - and at 7.5 m/s from 210 deg the trunk met the engine's corner, where CGE-S0TR (certified 2.03 kN in
// compression: no case had loaded it) gave way and its mirror held. G2013 puts the spinner, the propeller's hub and the
// cowl's nose bowl ahead of the engine's nodes as one crush element (33_drive.js genNoseSpec, 30_solver.js nosePass);
// G2014 certifies the mount for the nose's 9 g reacted at either corner, and its mirror pairs alike (66_gen_cert.js).
// The checks:
//   1. THE STACK (per build, its numbers printed with their sources): every layer's plateau under the certificate's
//      nose reaction at limit (the whole aeroplane at 9 g / 1.5 on the centreline: what the mount is certified for),
//      the stack's work at least the 3 m/s taxi's energy; a separation leaves less (the prop layer)
//   2. THE CERTIFICATE: the nose's corner cases on every nose engine; every mirror pair of the mount alike; no member's
//      envelope under the rules before G2014 (the same cases less the corners, no mirror)
//   3. THE ACCEPTANCE - the 3 m/s taxi into a trunk at the page's IMPACT speed (DMG-WINDBREAK's staging, started at 3.6 m/s:
//      met at ~3 m/s as on the page): steady winds 0 / 2.5 / 5 / 7.5 / 10 m/s from 12 directions, and the trunk across
//      the nose (19 offsets, no wind), on the Cub, the Jodel and the metal Cessna: no member that breaks an engine's
//      mount group breaks; every run's mount, its worst member over its limit and the nose's crush printed
//   4. ONE PHYSICS WITH DMG-DRIVE: wherever the crush passed the spinner the prop has stopped (a stoppage or a separation)
//   5. NORMAL OPERATIONS: the circuit on all five builds - nothing in the nose's reach (it never armed: no cost, no force)
//   6. THE CRASHES STILL CRASH: TREECRASH's 30 m/s flight into a trunk on the centreline, the three land builds
//   REPORT: the nose-over (DMG-DRIVE's, 4 m/s): the nose on the ground; the twin's nacelles' stacks
// Run: node tools/_dmg_nose_check.js [--json <file>] [--only=stack,cert,sweep,offset,ops,crash]   (one final
// `GATE DMGNOSE: PASS|FAIL`; children 3 at once, DMGNOSE_JOBS)
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const argv = process.argv.slice(2);
const TH = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330], US = [0, 2.5, 5, 7.5, 10];
const V_IMPACT = 3.6;
const OFFS = [-0.45, -0.4, -0.35, -0.3, -0.25, -0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45];
const LAND = ['cub', 'jodel', 'metal'], ALL = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];
const LAB = { cub: 'the user\'s Cub', jodel: 'Jodel', metal: 'metal Cessna', floats: 'Cessna floats', twinFloats: 'twin floatplane' };

const noseRow = a => (a.nose && a.nose[0]) ? { crush: +a.nose[0].crush.toFixed(3), layer: a.nose[0].layer, J: Math.round(a.nose[0].J), F: Math.round(a.nose[0].F), strike: a.nose[0].strike } : null;
const row = a => ({ U: a.U, th: a.th, off: a.off, mount: a.mountBroken, mountOff: a.mountOff, broken: a.broken, work: Math.round(a.work), vImp: a.vImp, hit: a.hit,
  peak: +a.peak.toFixed(3), peakWho: a.peakWho, first: a.first ? a.first.who + ' ' + a.first.how : null, crashed: a.crashed, reason: a.reason, finite: a.finite, nose: noseRow(a) });

// ---- a child: one part, JSON on its last line ----
if (argv[0] === '--part') {
  const W = require('./_dmg_wind_lib.js'), L = W.L, C = L.core();
  const [kind, key, a1, a2] = argv.slice(1), out = { kind, key };
  if (kind === 'cert') {
    // the certificate, computed here once and written for the other children (FLYDIY_CERT_DIR: the game's way - the
    // bench's thread hands the flight its envelope)
    const d = L.defOf(key), cert = L.certOf(key), dir = a1;
    fs.writeFileSync(path.join(dir, key + '.json'), JSON.stringify({ nb: cert.nb, Ft: Array.from(cert.Ft), Fc: Array.from(cert.Fc) }));
    const names = cert.names, eng = (d.refs.engine || []).filter(i => Math.abs(d.nodes[i].p[2]) < 0.6);
    out.corner = ['impactNoseL', 'impactNoseR'].filter(nm => names.includes(nm));
    out.noseEng = eng.length;
    // the rules before G2014: the same cases less the corners, no mirror
    const cs = Object.assign({}, cert.cases); delete cs.impactNoseL; delete cs.impactNoseR;
    const old = C.genCertCombine(d, cs, { mirror: false });
    let lower = 0, raised = 0; const low = [];
    for (let bi = 0; bi < cert.nb; bi++) {
      if (cert.Ft[bi] < old.Ft[bi] - 1e-9 || cert.Fc[bi] < old.Fc[bi] - 1e-9) { lower++; if (low.length < 5) low.push(bi); }
      if (cert.Ft[bi] > old.Ft[bi] + 1e-9 || cert.Fc[bi] > old.Fc[bi] + 1e-9) raised++;
    }
    const pairs = C.genCertMirror(d), tg = i => d.nodes[i].tag || String(i), nm = bi => tg(d.beams[bi].a) + '-' + tg(d.beams[bi].b);
    const unequal = pairs.filter(([i, j]) => cert.Ft[i] !== cert.Ft[j] || cert.Fc[i] !== cert.Fc[j]).map(([i, j]) => nm(i) + '/' + nm(j));
    const mount = new Set(W.mountOf(d));
    // the mount's members, stamped: the limits a flight meets (FY tension, FC compression), before (the old envelope) and after
    const stamp = env => { const dd = Object.assign({}, d, { cert: env }); const s = C.makeSim(dd, null); s.reset(0); const K = s.damageCaps(); return { FY: Array.from(K.FY), FC: Array.from(K.FC) }; };
    const A = stamp({ nb: cert.nb, Ft: old.Ft, Fc: old.Fc }), B = stamp(cert);
    out.mount = [...mount].map(bi => ({ who: nm(bi), FY0: A.FY[bi], FC0: A.FC[bi], FY: B.FY[bi], FC: B.FC[bi], byT: names[cert.byT[bi]] || null, byC: names[cert.byC[bi]] || null }));
    Object.assign(out, { lower, raised, low: low.map(nm), pairs: pairs.length, unequal, nb: cert.nb, cases: names.length });
  } else if (kind === 'stack') {
    const d = L.defOf(key), N = C.genNoseSpec(d), m = d.nodes.reduce((a, x) => a + x.m, 0);
    out.m = m; out.Flim = m * 9.81 * 9 / C.GEN_CERT.ult * C.GEN_CERT.limit; out.E3 = 0.5 * m * 9;
    out.stack = N ? N.map(x => x && ({ k: x.k, Rn: x.Rn, Ls: x.Ls, Dc: x.Dc, mat: x.mat, blades: x.blades, Fblade: x.Fblade, body: x.body.map(i => d.nodes[i].tag), m: x.m,
      layers: x.layers.map(L_ => ({ name: L_.name, d0: L_.d0, d1: L_.d1, Fmax: C.genNoseF(x, L_.d1, 1), Fsep: L_.name === 'prop' ? C.genNoseF(x, L_.d1, (x.blades - C.GEN_DRIVE.imb.frac) / x.blades) : null })),
      W: C.genNoseWork(x, x.Dc, 1), Wsep: C.genNoseWork(x, x.Dc, (x.blades - C.GEN_DRIVE.imb.frac) / x.blades),
      curve: Array.from({ length: 81 }, (_, i) => { const c = x.Dc * i / 80; return [c, C.genNoseF(x, c, 1)]; }) })) : null;
  } else if (kind === 'sweep') {
    const V = +a1, U = +a2;
    out.V = V; out.U = U;
    out.rows = (U === 0 ? [0] : TH).map(th => Object.assign(row(W.taxi(key, { D: 6, V, wind: W.windVec(U, th) })), { U, th }));
  } else if (kind === 'offset') {
    const V = +a1; out.V = V;
    out.rows = OFFS.map(off => Object.assign(row(W.taxi(key, { D: 6, V, off })), { off }));
  } else if (kind === 'ops') {
    const r = L.circuit(key, { cert: true }), sim = L.lastRun.sim, Dm = sim.damage();
    out.outcome = r.outcome; out.t = r.t; out.finite = r.finite; out.yields = Dm.yields; out.broken = Dm.broken.length;
    out.nose = (Dm.drive || []).map(x => ({ arm: x.crushArm, crush: x.crush, J: x.crushJ }));
  } else if (kind === 'crash') {
    const r = L.atTrunk(key, { D: 40, agl: 4, V: 30, thr: 0, secs: 5, cert: true }), Dm = r.sim.damage();
    out.crashed = r.dmg.crashed; out.reason = r.dmg.reason; out.broken = r.dmg.broken.length; out.work = r.dmg.work; out.finite = r.finite;
    out.nose = (Dm.drive || []).map(x => ({ crush: x.crush, of: x.crushOf, layer: x.crushLayer, J: x.crushJ, F: x.crushF }));
  } else if (kind === 'noseover') {
    const DL = require('./_dmg_drive_lib.js'), r = DL.noseOver(key, { V: 4, cert: true, secs: 3 }), Dm = L.lastRun.sim.damage();
    out.strike = Dm.drive && Dm.drive[0].strike; out.broken = Dm.broken.length; out.crashed = Dm.crashed;
    out.nose = (Dm.drive || []).map(x => ({ crush: x.crush, layer: x.crushLayer, J: x.crushJ, F: x.crushF, on: x.crushOn }));
  }
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const rep = msg => console.log('  --    REPORT ' + msg);
const f2 = x => (x == null ? '-' : (+x).toFixed(2)), kN = x => (x / 1000).toFixed(1);
(async () => {
  const { spawn } = require('child_process'), t0 = Date.now();
  const only = (argv.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean), on = k => !only.length || only.includes(k);
  const dir = process.env.FLYDIY_CERT_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'dmgnose-'));
  const nJ = Math.max(1, +(process.env.DMGNOSE_JOBS || 3));
  const run = (j, env) => new Promise(res => {
    const c = spawn(process.execPath, [__filename, '--part'].concat(j.map(String)), { stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, env || {}) });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { kind: j[0], key: j[1], err: se.slice(-800) }); });
  });
  const pool = async (jobs, env) => { const R = [], q = jobs.slice();
    await Promise.all(Array.from({ length: nJ }, async () => { while (q.length) { const j = q.shift(); R.push(Object.assign(await run(j, env), { job: j })); } })); return R; };
  // the certificates first (once a build, written to `dir`), then everything on them
  const R = [];
  const needCert = on('cert') || on('sweep') || on('offset') || on('ops') || on('crash');
  if (needCert && !process.env.FLYDIY_CERT_DIR) R.push(...await pool(ALL.map(k => ['cert', k, dir])));
  const jobs = [];
  if (on('stack')) for (const k of ALL) jobs.push(['stack', k]);
  if (on('sweep')) for (const k of LAND) for (const U of US) jobs.push(['sweep', k, V_IMPACT, U]);
  if (on('offset')) for (const k of LAND) jobs.push(['offset', k, V_IMPACT]);
  if (on('ops')) for (const k of ALL) jobs.push(['ops', k]);
  if (on('crash')) for (const k of LAND) jobs.push(['crash', k]);
  if (on('crash')) jobs.push(['noseover', 'cub'], ['noseover', 'metal']);
  R.push(...await pool(jobs, { FLYDIY_CERT_DIR: dir }));
  if (argv.includes('--json')) fs.writeFileSync(argv[argv.indexOf('--json') + 1], JSON.stringify(R));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s; on the certificate, damage on)');
  for (const r of R) if (r.err) yes(false, 'the child ' + r.job.join(' ') + ' ran: ' + r.err);
  // 1. the stack
  if (on('stack')) {
    console.log('1. THE STACK - the spinner, the propeller at its hub, the nose bowl (33_drive.js GEN_NOSE: Alexander 1960, MIL-HDBK-5J, the');
    console.log('   Wood Handbook, as recalled - A0 to open; the hub\'s protrusion, the blade root\'s thickness and arm, the bowl\'s depth GAME)');
    for (const k of ALL) {
      const r = R.find(x => x.kind === 'stack' && x.key === k); if (!r || !r.stack) { yes(false, LAB[k] + ': a nose'); continue; }
      r.stack.forEach((N, e) => {
        if (!N) { rep(LAB[k] + ' engine ' + e + ': no nose (a pusher)'); return; }
        const top = Math.max(...N.layers.map(x => x.Fmax));
        console.log('  ' + LAB[k] + (r.stack.length > 1 ? ' engine ' + e : '') + ' (' + Math.round(r.m) + ' kg; ' + N.mat + ' prop, ' + N.blades + ' blades; Rn ' + f2(N.Rn) + ' m, spinner tip ' + f2(N.Ls) + ' m ahead of the hub; body ' + N.body.join('/') + ' ' + Math.round(N.m) + ' kg): ' +
          N.layers.map(x => x.name + ' ' + (100 * (x.d1 - x.d0)).toFixed(0) + ' cm to ' + kN(x.Fmax) + ' kN').join(', ') + '; ' + (N.W / 1000).toFixed(2) + ' kJ in ' + (100 * N.Dc).toFixed(0) + ' cm');
        if (k === 'twinFloats') { rep(LAB[k] + ' engine ' + e + ': the nacelle\'s stack (no trunk case on the water): its top ' + kN(top) + ' kN'); return; }
        yes(top < r.Flim, LAB[k] + ': every plateau under the certificate\'s nose reaction at limit (' + kN(top) + ' < ' + kN(r.Flim) + ' kN: the whole aeroplane at 9 g / 1.5)');
        yes(N.W > r.E3, LAB[k] + ': the stack takes a 3 m/s taxi\'s energy (' + (N.W / 1000).toFixed(2) + ' > ' + (r.E3 / 1000).toFixed(2) + ' kJ)');
        const P = N.layers.find(x => x.name === 'prop');
        yes(P && P.Fsep < P.Fmax && N.Wsep < N.W, LAB[k] + ': a separation leaves less (the prop layer ' + kN(P.Fmax) + ' -> ' + kN(P.Fsep) + ' kN, the stack ' + (N.W / 1000).toFixed(2) + ' -> ' + (N.Wsep / 1000).toFixed(2) + ' kJ)');
      });
    }
  }
  // 2. the certificate
  if (on('cert')) {
    console.log('2. THE CERTIFICATE - the nose\'s 9 g reacted at either corner (impactNoseL / R), the mount\'s mirror pairs alike, no limit lowered');
    for (const k of ALL) {
      const r = R.find(x => x.kind === 'cert' && x.key === k); if (!r) { if (!process.env.FLYDIY_CERT_DIR) yes(false, LAB[k] + ': its certificate'); continue; }
      if (r.noseEng >= 2) yes(r.corner.length === 2, LAB[k] + ': the corner cases (' + r.corner.join(', ') + '; ' + r.cases + ' cases)');
      else rep(LAB[k] + ': no nose engine (its engines on the wing): no corner case, the nose reacts on the nose frame as before');
      yes(r.unequal.length === 0, LAB[k] + ': every mirror pair of the mount alike (' + r.pairs + ' pairs)' + (r.unequal.length ? ' - UNEQUAL: ' + r.unequal.join(' ') : ''));
      yes(r.lower === 0, LAB[k] + ': no member\'s envelope under the rules before (' + r.raised + ' of ' + r.nb + ' raised)' + (r.lower ? ' - LOWER: ' + r.low.join(' ') : ''));
      const ch = r.mount.filter(x => x.FY !== x.FY0 || x.FC !== x.FC0);
      rep(LAB[k] + ': the mount\'s stamped limits (FY / FC kN, before -> after): ' + (ch.length ? ch.map(x => x.who + ' ' + kN(x.FY0) + '/' + kN(x.FC0) + ' -> ' + kN(x.FY) + '/' + kN(x.FC) + ' (' + x.byT + ' / ' + x.byC + ')').join('; ') : 'unchanged'));
    }
  }
  // 3. the acceptance
  const sweep = k => R.filter(r => r.kind === 'sweep' && r.key === k).sort((a, b) => a.U - b.U).flatMap(r => r.rows);
  const table = rows => {
    console.log('        U \\ from ' + TH.map(t => String(t).padStart(9)).join('') + '   (deg off the nose; cell: mount members broken / the nose\'s crush, cm)');
    for (const U of US) {
      const cells = TH.map(th => { const x = rows.find(y => y.U === U && (U === 0 || y.th === th)); return x ? (x.mount + '/' + (x.nose ? (100 * x.nose.crush).toFixed(0) : '-')).padStart(9) : '        -'; });
      console.log('        ' + String(U).padStart(4) + ' m/s ' + (U === 0 ? cells[0] + '   (calm: one run)' : cells.join('')));
    }
  };
  const runMsg = x => (x.U != null ? x.U + ' m/s from ' + x.th : 'offset ' + x.off + ' m') + ': ' + (x.first || '-') + ' (' + x.work + ' J, met at ' + f2(x.vImp) + ' m/s, the mount\'s worst ' + f2(x.peak) + ' ' + x.peakWho + ')';
  if (on('sweep')) {
    console.log('3a. THE ACCEPTANCE: 3 m/s into a trunk at the page\'s impact speed (started at ' + V_IMPACT + ' m/s), steady winds 0-10 m/s from 12 directions');
    for (const k of LAND) {
      const rows = sweep(k); console.log('  ' + LAB[k] + ':'); table(rows);
      const bad = rows.filter(x => x.mount > 0 || !x.finite), hit = rows.filter(x => x.hit), vi = hit.map(x => x.vImp);
      const cr = rows.filter(x => x.nose).map(x => x.nose.crush), pk = rows.map(x => x.peak);
      yes(rows.length === 49 && bad.length === 0, LAB[k] + ': no mount member breaks in any of ' + rows.length + ' winds (' + hit.length + ' met the trunk at ' + f2(Math.min(...vi)) + '-' + f2(Math.max(...vi)) + ' m/s; the nose crushed ' +
        (100 * Math.min(...cr)).toFixed(0) + '-' + (100 * Math.max(...cr)).toFixed(0) + ' cm; the mount\'s worst ' + f2(Math.max(...pk)) + ' of its limit)' + (bad.length ? ' - BROKE: ' + bad.map(runMsg).join('; ') : ''));
      const other = rows.filter(x => x.broken > x.mount);
      if (other.length) rep(LAB[k] + ': other members broken (not the mount): ' + other.map(x => x.U + '/' + x.th + ' ' + x.first).join('; '));
      const miss = rows.filter(x => !x.hit);
      if (miss.length) rep(LAB[k] + ': ' + miss.length + ' winds turned it off the trunk (no contact): ' + miss.map(x => x.U + '/' + x.th).join(' '));
      const over = rows.filter(x => x.peak > 1);
      rep(LAB[k] + ': runs where a mount member passed its limit (a set, nothing broken): ' + (over.length ? over.length + ' - ' + over.map(x => x.U + '/' + x.th + ' ' + f2(x.peak) + ' ' + x.peakWho).join('; ') : 'none'));
    }
  }
  if (on('offset')) {
    console.log('3b. THE ACCEPTANCE: the trunk across the nose (' + OFFS[0] + '..' + OFFS[OFFS.length - 1] + ' m, no wind), started at ' + V_IMPACT + ' m/s');
    for (const k of LAND) {
      const r = R.find(x => x.kind === 'offset' && x.key === k); if (!r || !r.rows) continue;
      console.log('        offset m ' + r.rows.map(x => String(x.off).padStart(6)).join(''));
      console.log('        mount    ' + r.rows.map(x => String(x.mount).padStart(6)).join(''));
      console.log('        crush cm ' + r.rows.map(x => (x.nose ? (100 * x.nose.crush).toFixed(0) : '-').padStart(6)).join(''));
      const bad = r.rows.filter(x => x.mount > 0 || !x.finite);
      yes(bad.length === 0, LAB[k] + ': no mount member breaks at any of ' + r.rows.length + ' offsets (the mount\'s worst ' + f2(Math.max(...r.rows.map(x => x.peak))) + ' of its limit)' + (bad.length ? ' - BROKE: ' + bad.map(runMsg).join('; ') : ''));
    }
  }
  // 4. one physics with DMG-DRIVE
  if (on('sweep') || on('offset')) {
    const all = R.filter(r => (r.kind === 'sweep' || r.kind === 'offset') && r.rows).flatMap(r => r.rows.map(x => Object.assign({ key: r.key }, x)));
    const past = all.filter(x => x.nose && x.nose.layer && x.nose.layer !== 'spinner'), stopped = past.filter(x => x.nose.strike === 'stoppage' || x.nose.strike === 'separation');
    yes(past.length === stopped.length, '4. one physics with DMG-DRIVE: every run whose crush passed the spinner (' + past.length + ' of ' + all.length + ') has a stopped prop (a stoppage or a separation): ' + stopped.length);
    const tiers = {}; for (const x of all) if (x.nose) tiers[x.key + ' ' + x.nose.strike] = (tiers[x.key + ' ' + x.nose.strike] || 0) + 1;
    rep('the strikes: ' + Object.keys(tiers).map(t => t + ' ' + tiers[t]).join(', '));
  }
  // 5. normal operations
  if (on('ops')) {
    console.log('5. NORMAL OPERATIONS: the circuit - nothing in the nose\'s reach (the crush layer costs nothing and pushes nothing)');
    for (const k of ALL) {
      const r = R.find(x => x.kind === 'ops' && x.key === k); if (!r) continue;
      const arm = r.nose.reduce((a, x) => a + x.arm, 0), J = r.nose.reduce((a, x) => a + x.J, 0);
      yes(r.finite && arm === 0 && J === 0 && r.broken === 0, LAB[k] + ': the circuit (' + r.outcome + ', ' + r.t.toFixed(0) + ' s): the nose armed ' + arm + ' frames, ' + J.toFixed(0) + ' J; ' + r.yields + ' yields, ' + r.broken + ' broken');
    }
  }
  // 6. the crashes
  if (on('crash')) {
    console.log('6. THE CRASHES STILL CRASH: 30 m/s into a trunk on the centreline');
    for (const k of LAND) {
      const r = R.find(x => x.kind === 'crash' && x.key === k); if (!r) continue;
      const N = r.nose[0] || {};
      yes(r.finite && r.crashed, LAB[k] + ': crashed (' + r.reason + '; ' + r.broken + ' broken, ' + (r.work / 1000).toFixed(1) + ' kJ; the nose ' + (100 * (N.crush || 0)).toFixed(0) + ' of ' + (100 * (N.of || 0)).toFixed(0) + ' cm, to its ' + N.layer + ', ' + ((N.J || 0) / 1000).toFixed(2) + ' kJ)');
    }
    for (const r of R.filter(x => x.kind === 'noseover')) {
      const N = r.nose[0] || {};
      rep(LAB[r.key] + ': a nose-over at 4 m/s (DMG-DRIVE\'s): strike ' + r.strike + ', the nose on the ' + (N.on || '-') + ' ' + (100 * (N.crush || 0)).toFixed(0) + ' cm (' + (N.layer || '-') + ', ' + Math.round(N.J || 0) + ' J, ' + kN(N.F || 0) + ' kN), ' + r.broken + ' broken' + (r.crashed ? ', crashed' : ''));
    }
  }
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE DMGNOSE: ' + (fails ? 'FAIL' : 'PASS'));
  if (!process.env.FLYDIY_CERT_DIR) try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* the temp dir stays */ }
  process.exit(fails ? 1 : 0);
})();
