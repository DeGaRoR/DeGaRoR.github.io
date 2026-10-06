#!/usr/bin/env node
// GATE DMGFABRIC (G2040-G2043, DMG-FABRIC) - THE COVERING HOLDS THE WRECK UNTIL IT TEARS, node only. On the user's
// validated builds, damage ON (params.damage true) unless said:
//   1. THE PANELS: every build carries its covered panels (61_gen_frame parts.dmg.cover) and each is covered as built -
//      fabric on the Cub, the Jodel (over its ply) and the twin; sheet on the metal Cessna and the Cessna on floats.
//   2. NONE WHEN INTACT: parked 5 s, a FAR 23.473 drop at its limit sink, a flown 3.8 g pull - not one tie made (and in
//      every crash below, none before the first break): the per-substep pass never runs on an intact aeroplane.
//   3. THE TIES IN A CRASH (the certificate stamped, as the game flies): the Cub's wing 2.5 m out and centreline trunks,
//      the Jodel's wing 2.5 m out, the metal Cessna's centreline (sheet). Per substep, every live tie: TENSION ONLY (its
//      force never negative, nothing while slack - shorter than its slack length); a live tie never past its strain at
//      break; a torn tie tore BY STRAIN (its peak stretch past eu over its slack length); a tie made is never made
//      again (torn or live). The wing strike: the covering HOLDS (fewer held pieces than
//      pieces from the moment a tie exists, to the run's end).
//   4. FRAME-RATE INDEPENDENT: the Cub's wing strike read as the page batches its fixed 1/60 s steps (the page's reads -
//      damage(), the cover ties, the CG, the axes, the damage hop - every 1, 2, 6, 30 steps: 60 / 30 / 10 / 2 fps; GATE
//      DMGFPS's method) - the same ties, torn at the same instants, the same bits (p, v). The tear reads only the
//      substep's own positions (a strain), never the frame.
//   5. DAMAGE OFF = THE BASE'S BYTES, AND THE TIES OFF = THE BASE'S PHYSICS: the 30 m/s trunks (the Cub, the metal
//      Cessna; centreline and 2.5 m out; D1a's physics) fly to the base's own bits (claude/dmg-tune 849058d8's run hashes,
//      frozen below) with damage OFF; with damage ON and GEN_COVER.on = false likewise; with the ties on, damage OFF still.
//   6. THE DRAWING AGREES (the hop, sim_host / sim_view): no tie key in any payload before a tie is made; once made, the
//      live ties (ty) and the torn (tt) reach the page's state, and a tear is a payload of its own (the signature moves).
// --selftest: the same gate with the ties disabled (GEN_COVER.on = false) must go RED (exit 0 when it does).
// Run: node tools/_dmg_fabric_check.js [--selftest] [--out <file.json>]   (one final `GATE DMGFABRIC: PASS|FAIL`)
'use strict';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const argv = process.argv.slice(2);
const ROOT = path.join(__dirname, '..');
const BUILDS = ['cub', 'jodel', 'metal', 'floats', 'twinFloats'];
// claude/dmg-tune 849058d8 (the base), node tools/_treecrash_lib.js atTrunk, secs 4, D1a's physics (no certificate)
const BASE = { 'cub-t25-on': 'ae222ba0cb38', 'cub-t25-off': '6acfbf6ae0ed', 'cub-t0-on': 'fb541e6b5e3b', 'cub-t0-off': 'f97faec72e38',
               'metal-t25-on': '7f63a2d9daf1', 'metal-t25-off': 'a0cfaca6dcd8', 'metal-t0-on': 'a6e31576d4d3', 'metal-t0-off': 'b5cc29e840c8' };
const CRASH = [['cub', 'trunk25'], ['cub', 'trunk0'], ['jodel', 'trunk25'], ['metal', 'trunk0']];
const KIND = { cub: 'fabric', jodel: 'fabric', metal: 'sheet', floats: 'sheet', twinFloats: 'fabric' };

const off = () => process.env.DMGFABRIC_OFF === '1';
function core() { const L = require('./_treecrash_lib.js'), C = L.core(); if (off()) C.GEN_COVER.on = false; return { L, C }; }
const hashOf = sim => crypto.createHash('md5').update(Buffer.from(sim.p.buffer)).update(Buffer.from(sim.v.buffer)).digest('hex').slice(0, 12);

// ---- the children ----
if (argv[0] === '--child') {
  const what = argv[1], k = argv[2], id = argv[3];
  let out = { what, k, id };
  if (what === 'panels') {
    const { L } = core(), d = L.defOf(k), P = d.parts.dmg.cover || [];
    const kinds = {}; for (const p of P) { const kd = p.mat === 'carbon' ? 'none' : (p.mat === 'alloy' && !p.cloth ? 'sheet' : 'fabric'); kinds[kd] = (kinds[kd] || 0) + 1; }
    out.n = P.length; out.kinds = kinds; out.area = +P.reduce((a, p) => a + p.A, 0).toFixed(2);
  } else if (what === 'intact') {
    const { L } = core(); const r = {};
    // parked 5 s on its wheels (the floats on the water), then the drop, then a pull: each a sim of its own
    { const W = L.flatWorld(0), C = L.core(), def = L.defOf(k), probe = C.makeSim(def, null); let sim;
      if (probe.hydro) { const w = C.makeWorld(); sim = C.makeSim(def, w); sim.reset(0); C.placeAtAerodrome(sim, w.aerodromes.find(a => a.id === 'SEA')); }
      else { sim = C.makeSim(def, W.W); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, W.strip, { elev: 0, spawnElev: 0 })); }
      for (let f = 0; f < 300; f++) sim.step(1 / 60);
      const T = sim.coverTies(); r.parked = { ties: T ? T.n : 0, breaks: sim.damage().breaks }; }
    { L.hardLanding(k, { sink: L.far473(k) }); const sim = L.lastRun.sim, T = sim.coverTies(); r.drop = { ties: T ? T.n : 0, breaks: sim.damage().breaks }; }
    { L.pull(k, { nz: 3.8 }); const sim = L.lastRun.sim, T = sim.coverTies(); r.pull = { ties: T ? T.n : 0, breaks: sim.damage().breaks }; }
    out.r = r;
  } else if (what === 'crash') {
    process.env.FLYDIY_CERT = '1';
    const { L } = core(), F = require('./_dmg_fabric_lib.js'), C = L.core(), eu = C.GEN_COVER.fabric.eu;
    const S = { subs: 0, neg: 0, slackF: 0, liveOver: 0, tornUnder: 0, tornLate: 0, tiesBeforeBreak: 0, remade: 0, tieSubs: 0, maxLiveStrain: 0, minTornStrain: Infinity, heldFrames: 0, splitFrames: 0, firstTie: null };
    let sim = null; const seen = new Map(), prevLp = new Float64Array(4096);
    const reads = id === 'trunk25' && k === 'cub' ? [1, 2, 6, 30] : [1];
    const runs = {}, SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
    for (const every of reads) {
      const hop = SH.simDmgHop0();
      let nRead = 0; const tears = [];
      const r = F.runFabric(k, id, { secs: 6, onStart: s => {
        sim = s;
        if (every !== 1) return;
        s.onSubstep = () => {
          const T = s.coverTies(), D = s.damage(); S.subs++;
          if (!T) return;
          if (T.n && !D.breaks) S.tiesBeforeBreak++;
          if (T.n) S.tieSubs++;
          for (let q = 0; q < T.n; q++) {
            const a3 = T.a[q] * 3, b3 = T.b[q] * 3, L_ = Math.hypot(s.p[b3] - s.p[a3], s.p[b3+1] - s.p[a3+1], s.p[b3+2] - s.p[a3+2]);
            const key = Math.min(T.a[q], T.b[q]) * s.n + Math.max(T.a[q], T.b[q]);
            if (!seen.has(key)) seen.set(key, q); else if (seen.get(key) !== q) S.remade++;
            if (T.torn[q] < 0) {
              if (T.F[q] < 0) S.neg++;
              // (the force is the pass's, on the positions the substep started from; L_ is after the integration - so the
              // slack test reads the peak length the pass kept: a tie never stretched past its slack length pulls nothing)
              if (T.Lp[q] <= T.Ls[q] && T.F[q] > 0) S.slackF++;
              const st = T.Lp[q] / T.Ls[q] - 1; if (st > T.eu[q] * (1 + 1e-12)) S.liveOver++; if (st > S.maxLiveStrain) S.maxLiveStrain = st;
            } else {
              const st = T.Lp[q] / T.Ls[q] - 1; if (!(st > T.eu[q])) S.tornUnder++; if (st < S.minTornStrain) S.minTornStrain = st;
            }
            prevLp[q] = T.Lp[q];
          }
        };
      }, onFrame: (s, f) => {
        nRead++;
        if (f % every === 0) { s.damage(); s.coverTies(); s.cgPos(); s.axes(); SH.simDmgHop(s, hop, 0, 0); }   // the page's reads
        const T = s.coverTies();
        if (T && T.nLive && every === 1) { const Ps = F.piecesOf(s, false).length, Ph = F.piecesOf(s, true).length; if (Ph < Ps) S.heldFrames++; if (Ps > 1) S.splitFrames++; if (S.firstTie === null) S.firstTie = s.t; }
      } });
      const T = r.sim.coverTies() || { n: 0 };
      for (let q = 0; q < T.n; q++) tears.push([T.a[q], T.b[q], T.torn[q]]);
      const z = { made: 0, torn: 0, born: 0, first: null, tears: [], sheet: 0, work: 0 };
      runs[every] = { hash: hashOf(r.sim), tears, made: (r.ties || z).made, torn: (r.ties || z).torn, at: r.at, end: r.end, ties: r.ties || z };
      r.sim.onSubstep = null;
    }
    // (the page's batching: a read every N fixed steps. The lib steps one frame a call; the reads are the onFrame hook's -
    // a batched read reads the same sim every N-th step, which is what the page does between its frames)
    out.S = S; out.runs = runs;
  } else if (what === 'base') {
    const { L } = core(); const o = {};
    for (const [nm, oo] of [['t25', { D: 40, agl: 4, V: 30, thr: 0, secs: 4, off: 2.5 }], ['t0', { D: 40, agl: 4, V: 30, thr: 0, secs: 4, off: 0 }]]) {
      o[k + '-' + nm + '-on'] = L.atTrunk(k, Object.assign({}, oo)).hash;
      o[k + '-' + nm + '-onTies'] = L.lastRun.sim.coverTies() ? L.lastRun.sim.coverTies().n : 0;
      o[k + '-' + nm + '-off'] = L.atTrunk(k, Object.assign({ elastic: true }, oo)).hash;
      o[k + '-' + nm + '-offTies'] = L.lastRun.sim.coverTies() ? -1 : 0;   // (damage off: no tie store at all)
      { const C = L.core(), was = C.GEN_COVER.on; C.GEN_COVER.on = false; o[k + '-' + nm + '-noTies'] = L.atTrunk(k, Object.assign({}, oo)).hash; C.GEN_COVER.on = was; }
    }
    out.h = o;
  } else if (what === 'hop') {
    process.env.FLYDIY_CERT = '1';
    const { L, C } = core(), F = require('./_dmg_fabric_lib.js');
    const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js')), SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));
    let hop = null, st = null, core0 = 0; const H = { keysBefore: 0, payloads: 0, tyPayloads: 0, tearPayloads: 0, liveEq: 0, liveMis: 0, tornEq: 0, lastTorn: 0 };
    F.runFabric(k, id, { secs: 6, onStart: s => { hop = SH.simDmgHop0(); st = SV.simViewDmgState(s.n, s.beams.length); core0 = L.defOf(k).refs.noseFrame[0]; },
      onFrame: s => {
        const P = SH.simDmgHop(s, hop, core0, 0); const T = s.coverTies();
        if (!P) return;
        H.payloads++; SV.simViewDmgApply(st, P);
        if (!T || !T.n) { if ('ty' in P || 'tt' in P) H.keysBefore++; return; }
        if (P.ty) H.tyPayloads++;
        const nT = T.n - T.nLive; if (nT > H.lastTorn) { H.tearPayloads++; H.lastTorn = nT; }
        let live = 0, torn = 0; for (let q = 0; q < T.n; q++) { const key = Math.min(T.a[q], T.b[q]) * s.n + Math.max(T.a[q], T.b[q]); if (T.torn[q] < 0) live += st.tied && st.tied.has(key) ? 1 : 0; else torn += st.torn && st.torn.has(key) ? 1 : 0; }
        if (live === T.nLive && torn === nT) H.liveEq++; else H.liveMis++;
      } });
    out.H = H;
  }
  process.stdout.write('RESULT ' + JSON.stringify(out) + '\n', () => process.exit(0));
  return;
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
(async () => {
  const { spawn } = require('child_process'), t0 = Date.now();
  const selftest = argv.includes('--selftest');
  const env = Object.assign({}, process.env, selftest ? { DMGFABRIC_OFF: '1' } : {});
  const child = args => new Promise(res => {
    const c = spawn(process.execPath, [__filename, '--child'].concat(args), { stdio: ['ignore', 'pipe', 'pipe'], env });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { args, err: se.slice(-1500) }); });
  });
  const jobs = [];
  for (const k of BUILDS) jobs.push(['panels', k], ['intact', k]);
  for (const [k, id] of CRASH) jobs.push(['crash', k, id]);
  for (const k of ['cub', 'metal']) jobs.push(['base', k]);
  jobs.push(['hop', 'cub', 'trunk0']);
  const out = new Array(jobs.length); let i = 0;
  await Promise.all([0, 1, 2].map(async () => { while (i < jobs.length) { const j = i++; out[j] = await child(jobs[j]); } }));
  const R = (w, k, id) => out.find((o, j) => jobs[j][0] === w && jobs[j][1] === k && (id == null || jobs[j][2] === id));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s' + (selftest ? ', SELFTEST: the ties disabled (GEN_COVER.on = false)' : '') + ')');
  for (const o of out) if (o.err) yes(false, 'a child ran: ' + JSON.stringify(o.args) + ' ' + o.err.slice(-400));
  console.log('1. the panels');
  for (const k of BUILDS) { const r = R('panels', k); if (!r || r.err) continue;
    yes(r.n > 0 && Object.keys(r.kinds).length === 1 && r.kinds[KIND[k]] === r.n, k + ': ' + r.n + ' covered panels, ' + r.area + ' m2, all ' + KIND[k] + ' (' + JSON.stringify(r.kinds) + ')'); }
  console.log('2. none when intact');
  for (const k of BUILDS) { const r = R('intact', k); if (!r || r.err) continue; const x = r.r;
    yes(x.parked.ties === 0 && x.drop.ties === 0 && x.pull.ties === 0 && !x.parked.breaks && !x.drop.breaks && !x.pull.breaks,
      k + ': parked 5 s, the FAR 23.473 drop, a flown 3.8 g pull - ' + [x.parked, x.drop, x.pull].map(z => z.ties + ' ties / ' + z.breaks + ' broken').join(', ')); }
  console.log('3. the ties in a crash (the certificate stamped)');
  for (const [k, id] of CRASH) {
    const r = R('crash', k, id); if (!r || r.err) continue;
    const S = r.S, a = r.runs[1];
    console.log('  ' + k + ' ' + id + ': ' + a.made + ' ties made (' + (a.ties.sheet ? 'sheet ' + a.ties.sheet : 'fabric') + '), ' + a.torn + ' torn (' + a.ties.born + ' at birth), first ' + a.ties.first + ' s after contact, the tears at ' + JSON.stringify(a.ties.tears.slice(0, 12))
      + '; held / pieces at 0.5 / 1 / 2 / 4 s: ' + ['0.5', '1', '2', '4'].map(x => a.at[x] ? a.at[x].held + '/' + a.at[x].pieces : '-').join(' ') + '; the covering took ' + (a.ties.work / 1000).toFixed(2) + ' kJ');
    yes(a.made > 0, k + ' ' + id + ': the covering is tied across the parting (' + a.made + ' ties)');
    yes(S.tiesBeforeBreak === 0, k + ' ' + id + ': no tie before the first break');
    yes(S.neg === 0 && S.slackF === 0, k + ' ' + id + ': tension only - never a push, nothing while slack (' + S.tieSubs + ' substeps with ties)');
    yes(S.liveOver === 0, k + ' ' + id + ': a live tie never past its strain at break (the worst live ' + (S.maxLiveStrain * 100).toFixed(2) + ' %)');
    yes(S.tornUnder === 0, k + ' ' + id + ': every torn tie tore by strain, past eu over its slack length (the least ' + (S.minTornStrain == null || !(S.minTornStrain < Infinity) ? '- (none torn)' : (S.minTornStrain * 100).toFixed(2) + ' %') + ')');
    yes(S.remade === 0, k + ' ' + id + ': a pair is tied once, ever');
    if (id === 'trunk25' && k === 'cub') {
      yes(S.heldFrames > 0 && S.heldFrames === S.splitFrames, k + ' ' + id + ': the covering HOLDS the struck wing - fewer held pieces than pieces on every frame a tie is live (' + S.heldFrames + ' / ' + S.splitFrames + ' frames)');
      const b = r.runs;
      const same = [2, 6, 30].every(e => b[e] && b[e].hash === b[1].hash && JSON.stringify(b[e].tears) === JSON.stringify(b[1].tears));
      yes(same, k + ' ' + id + ': read every 1 / 2 / 6 / 30 fixed steps (60 / 30 / 10 / 2 fps) - the same ties, torn at the same instants, the same bits (' + [1, 2, 6, 30].map(e => b[e] && b[e].hash).join(' ') + ')');
    }
  }
  console.log('4-5. the base\'s bytes');
  for (const k of ['cub', 'metal']) { const r = R('base', k); if (!r || r.err) continue; const h = r.h;
    for (const nm of ['t25', 't0']) {
      yes(h[k + '-' + nm + '-off'] === BASE[k + '-' + nm + '-off'] && h[k + '-' + nm + '-offTies'] === 0, k + ' ' + nm + ': damage OFF - the base\'s bits (' + h[k + '-' + nm + '-off'] + '), no tie store');
      // with damage ON: the base's bits where no covered panel parts (no tie made); else the ties changed the run - say so
      const on = h[k + '-' + nm + '-on'], tied = h[k + '-' + nm + '-onTies'];
      yes(h[k + '-' + nm + '-noTies'] === BASE[k + '-' + nm + '-on'], k + ' ' + nm + ': damage ON with the ties disabled (GEN_COVER.on = false) - the base\'s physics, its bits (' + h[k + '-' + nm + '-noTies'] + ')');
      if (tied) console.log('    ' + k + ' ' + nm + ', damage ON: ' + tied + ' ties made - the run is its own (' + on + ', the base ' + BASE[k + '-' + nm + '-on'] + ')');
      else yes(on === BASE[k + '-' + nm + '-on'], k + ' ' + nm + ': damage ON, no covered panel parted - the base\'s bits (' + on + ')');
    } }
  console.log('6. the drawing agrees (the hop)');
  { const r = R('hop', 'cub', 'trunk0'); if (r && !r.err) { const H = r.H;
    yes(H.keysBefore === 0, 'no tie key in a payload before a tie is made (' + H.payloads + ' payloads)');
    yes(H.tyPayloads > 0 && H.liveMis === 0 && H.liveEq > 0, 'the live and the torn ties reach the page\'s state on every payload once made (' + H.liveEq + ' payloads, ' + H.liveMis + ' off)');
    yes(H.tearPayloads > 0, 'a tear is a payload of its own (' + H.tearPayloads + ')'); } }
  const outI = argv.indexOf('--out');
  if (outI >= 0) { fs.mkdirSync(path.dirname(argv[outI + 1]), { recursive: true }); fs.writeFileSync(argv[outI + 1], JSON.stringify(out, null, 1)); }
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  if (selftest) { console.log('GATE DMGFABRIC --selftest: ' + (fails ? 'RED with the ties disabled, as it must be (' + fails + ' checks failed)' : 'GREEN WITH THE TIES DISABLED - THE GATE CANNOT SEE THEM')); process.exit(fails ? 0 : 1); }
  console.log('GATE DMGFABRIC: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
