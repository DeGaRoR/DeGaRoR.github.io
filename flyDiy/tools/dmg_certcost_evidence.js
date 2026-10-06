#!/usr/bin/env node
// dmg_certcost_evidence.js - DMG-CERTCOST (G1890-G1891): WHERE THE CERTIFICATE'S TIME GOES, AND WHAT A SHORTER WINDOW
// WOULD CHANGE. Per validated build, in a child process each (node only):
//   1. the certificate UNCUT (66_gen_cert genCertify, opt.share false and opt.full: every landing settles itself, every window its
//      full length) with the evidence's tap on (GEN_CERT_HOOK): every dynamic case's members' peaks at limit after
//      every frame of its window; its per-case time (C.ms.cases);
//   2. the certificate SHARED (the settle once, the controls' lead-in once - G1891; opt.full): its time, and its envelope against
//      the uncut one (to the bit, or the worst relative deviation);
//   3. per case, the window scan: the envelope (genCertCombine over all the cases, landK and the ring read as the
//      certificate reads them) with that one case's window cut at frame F, for every F: the last frame that moves the
//      envelope at all, and the first F from which the envelope is within 0.1 % / 1 % of the uncut one;
//   4. with --cut: the certificate as the code now cuts it (GEN_CERT.win) against the uncut one: the envelope and every
//      member's STAMPED limits (30_solver certStamp / gearStamp: fy0, fu, fc0 on a sim made with each certificate), the
//      worst relative deviation, which member, which case governs it.
//   node tools/build.js && node tools/dmg_certcost_evidence.js [--builds=cub,jodel] [--out=<dir>] [--cut]
//   node tools/dmg_certcost_evidence.js --child <key> <out.json> [--cut]
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const argv = process.argv.slice(2);
const L = require('./_treecrash_lib.js');

function stamped(C, def, cert) {
  const sim = C.makeSim(Object.assign({}, def, { cert, params: Object.assign({}, def.params, { damage: true }) }), null);
  return sim.beams.map(b => [b.fy0, b.fu, b.fc0]);
}
function relDev(a, b) {   // the worst |a - b| / b over the finite, nonzero entries; [dev, index, column]
  let w = 0, wi = -1, wk = -1;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (Array.isArray(x)) { for (let k = 0; k < x.length; k++) { if (!(Number.isFinite(y[k]) && y[k] > 0)) { if (x[k] !== y[k]) return [Infinity, i, k]; continue; }
        const d = Math.abs(x[k] - y[k]) / y[k]; if (d > w) { w = d; wi = i; wk = k; } } continue; }
    if (!(y > 0)) { if (x !== y && Math.abs(x - y) > 1e-9) { w = Math.max(w, Infinity); wi = i; } continue; }
    const d = Math.abs(x - y) / y; if (d > w) { w = d; wi = i; }
  }
  return [w, wi, wk];
}

if (argv[0] === '--child') {
  const key = argv[1], outF = argv[2], C = L.core();
  const def = L.defOf(key);
  const world = def.parts && def.parts.floats ? C.makeWorld() : null;
  const nb = def.beams.length;
  // 1. uncut, traced
  const tr = {};
  C.GEN_CERT_HOOK.frame = (nm, f, sim) => {
    const P = sim.damagePeak(), B = sim.beams, t = new Float64Array(nb), c = new Float64Array(nb);
    for (let bi = 0; bi < nb; bi++) { const b = B[bi]; t[bi] = Number.isFinite(b.fyP) ? P.t[bi] * b.fyP : 0; c[bi] = Number.isFinite(b.fcP) ? P.c[bi] * b.fcP : 0; }
    (tr[nm] = tr[nm] || [])[f] = { t, c };
  };
  const t0 = Date.now();
  const U = C.genCertify(def, { world, share: false, full: true });
  const tU = Date.now() - t0;
  C.GEN_CERT_HOOK.frame = null;
  // 2. shared
  const t1 = Date.now();
  const S = C.genCertify(def, { world, full: true });
  const tS = Date.now() - t1;
  const sameS = relDev(S.Ft, U.Ft)[0] === 0 && relDev(S.Fc, U.Fc)[0] === 0 && S.Ft.every((x, i) => x === U.Ft[i]) && S.Fc.every((x, i) => x === U.Fc[i]);
  // 3. the window scan, case by case
  const scan = {};
  for (const nm of Object.keys(tr)) {
    const fr = tr[nm], N = fr.length;
    const row = { frames: N, ms: U.ms.cases[nm] != null ? U.ms.cases[nm] : null, lastMove: -1, dev: [] };
    for (let F = 0; F < N; F++) {
      const cases = Object.assign({}, U.cases); cases[nm] = fr[F];
      const E = C.genCertCombine(def, cases);
      const d = Math.max(relDev(E.Ft, U.Ft)[0], relDev(E.Fc, U.Fc)[0]);
      row.dev.push(d);
      if (d > 0) row.lastMove = F + 1;   // cut at F + 1 frames still moves it: the window must keep frame F + 1
    }
    row.within1e3 = row.dev.findIndex((d, F) => row.dev.slice(F).every(x => x <= 1e-3)) + 1;
    row.within1e2 = row.dev.findIndex((d, F) => row.dev.slice(F).every(x => x <= 1e-2)) + 1;
    // the ADAPTIVE window: stop at the first frame F >= M at which no member's peak has risen (by more than 1e-4 of
    // itself) for Q frames - where it would stop, and the envelope's deviation there
    const rose = [false];
    for (let F = 1; F < N; F++) { const a = fr[F - 1], b = fr[F]; let r = false;
      for (let bi = 0; bi < nb && !r; bi++) r = b.t[bi] > a.t[bi] * (1 + 1e-4) + 1e-9 || b.c[bi] > a.c[bi] * (1 + 1e-4) + 1e-9;
      rose.push(r); }
    row.adapt = {};
    for (const M of [36, 48, 60, 72]) for (const Q of [15, 30, 45]) {
      let stop = N, quiet = 0;
      for (let F = 0; F < N; F++) { quiet = rose[F] ? 0 : quiet + 1; if (F + 1 >= M && quiet >= Q) { stop = F + 1; break; } }
      row.adapt[M + '/' + Q] = { stop, dev: stop >= N ? 0 : row.dev[stop - 1] };
    }
    row.lastRise = rose.lastIndexOf(true) + 1;
    // which members this case governs (tension / compression), as the uncut certificate reads them
    const ci = U.names.indexOf(nm);
    row.governsT = Array.from(U.byT).filter(x => x === ci).length; row.governsC = Array.from(U.byC).filter(x => x === ci).length;
    scan[nm] = row;
  }
  const out = { key, nb, ms: { uncut: tU, shared: tS, uncutCases: U.ms.cases, sharedCases: S.ms.cases, uncutStatic: U.ms.flight, sharedStatic: S.ms.flight },
                sharedBitEqual: sameS, scan, names: U.names, Ft: Array.from(U.Ft), Fc: Array.from(U.Fc) };
  // 4. the cut as the code cuts it, against the uncut
  if (argv.includes('--cut')) {
    const t2 = Date.now();
    const K = C.genCertify(def, { world });
    out.ms.cut = Date.now() - t2; out.ms.cutCases = K.ms.cases; out.ms.cutStatic = K.ms.flight;
    const eT = relDev(K.Ft, U.Ft), eC = relDev(K.Fc, U.Fc);
    const sU = stamped(C, def, { nb, Ft: U.Ft, Fc: U.Fc }), sK = stamped(C, def, { nb, Ft: K.Ft, Fc: K.Fc });
    const eS = relDev(sK, sU);
    const nmOf = (by, i) => i >= 0 && by[i] >= 0 ? U.names[by[i]] : null;
    const tag = i => i >= 0 ? def.nodes[def.beams[i].a].tag + '-' + def.nodes[def.beams[i].b].tag + ' (' + (def.beams[i].cls || '') + ')' : null;
    out.cut = { envT: eT[0], envTAt: tag(eT[1]), envTCase: nmOf(U.byT, eT[1]), envC: eC[0], envCAt: tag(eC[1]), envCCase: nmOf(U.byC, eC[1]),
                stamp: eS[0], stampAt: tag(eS[1]), stampCol: ['fy0', 'fu', 'fc0'][eS[2]] || null,
                stampCase: eS[2] === 2 ? nmOf(U.byC, eS[1]) : nmOf(U.byT, eS[1]),
                FtCut: Array.from(K.Ft), FcCut: Array.from(K.Fc) };
  }
  fs.writeFileSync(outF, JSON.stringify(out));
  process.exit(0);
}

const KEYS = ((argv.find(a => a.startsWith('--builds=')) || '').slice(9) || Object.keys(L.BUILDS).join(',')).split(',');
const OUT = (argv.find(a => a.startsWith('--out=')) || '').slice(6) || path.join(__dirname, '..', 'reports', 'evidence', 'DMG-CERTCOST');
const CUT = argv.includes('--cut');
fs.mkdirSync(OUT, { recursive: true });
const JOBS = +(process.env.CERTCOST_JOBS || 2);
const queue = KEYS.slice(), res = {};
let active = 0;
const run = () => new Promise(done => {
  const next = () => {
    const k = queue.shift(); if (!k) { if (active === 0) done(); return; }
    active++;
    const f = path.join(OUT, 'scan_' + k + (CUT ? '_cut' : '') + '.json');
    const ch = cp.spawn(process.execPath, [__filename, '--child', k, f].concat(CUT ? ['--cut'] : []), { stdio: 'inherit' });
    ch.on('exit', (code, sig) => { if (code !== 0) console.log(k + ': the child ended ' + code + ' ' + sig);
      res[k] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : { error: code }; active--; next(); });
  };
  for (let j = 0; j < JOBS; j++) next();
});
run().then(() => {
  for (const k of KEYS) {
    const r = res[k]; if (!r || r.error) { console.log(k + ': FAILED'); continue; }
    console.log(`${k}: uncut ${(r.ms.uncut / 1000).toFixed(1)} s, shared ${(r.ms.shared / 1000).toFixed(1)} s (envelope ${r.sharedBitEqual ? 'BIT-EQUAL' : 'DIFFERENT'})` +
      (r.ms.cut != null ? `, cut ${(r.ms.cut / 1000).toFixed(1)} s` : ''));
    for (const [nm, s] of Object.entries(r.scan))
      console.log(`  ${nm.padEnd(11)} ${String(s.frames).padStart(4)} frames, governs ${s.governsT}/${s.governsC}: last frame that moves the envelope ${s.lastMove}, within 0.1 % from ${s.within1e3}, 1 % from ${s.within1e2}; last rise ${s.lastRise}; adaptive ` +
        Object.entries(s.adapt).map(([k, a]) => k + ':' + a.stop + (a.dev ? '(' + (100 * a.dev).toFixed(2) + '%)' : '')).join(' '));
    if (r.cut) console.log(`  CUT vs UNCUT: envelope tension ${(100 * r.cut.envT).toFixed(3)} % (${r.cut.envTAt}, ${r.cut.envTCase}), compression ${(100 * r.cut.envC).toFixed(3)} % (${r.cut.envCAt}, ${r.cut.envCCase}); stamped limits ${(100 * r.cut.stamp).toFixed(3)} % (${r.cut.stampCol} ${r.cut.stampAt}, ${r.cut.stampCase})`);
  }
});
