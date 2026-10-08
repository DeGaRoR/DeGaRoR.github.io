#!/usr/bin/env node
// GATE POD (G2416, BELLY-POD for the GAME COORDINATOR; FREIGHT-2026-10-07.md §4) — THE BELLY POD: A BENCH, TRIALS ON
// THE VALIDATED PLANES, A GROUND-CLEARANCE CHECK, A PLACE IN THE CERTIFICATION, AND A REAL AERODYNAMIC COST.
//
//   node tools/_pod_check.js               -> "GATE POD: PASS|FAIL" (the legs read from reports/evidence/POD/flights.json
//                                             when present; else flown: 9 legs, ~6 min wall on 4 cores)
//   node tools/_pod_check.js --fly         -> fly the legs again (tools/_pod_fly.js) and store them
//   node tools/_pod_check.js --show        -> every check's line
//   node tools/_pod_check.js --selftest    -> negative verification: the pod's rules broken in their own sources, each
//                                             must go red (on the Cub, the C172 and the Cessna on floats)
//   node tools/_pod_check.js --bless       -> write tools/_pod_base.json from the core in hand (ONLY from the base the
//                                             pod was built on: it is the "pod off = today's bytes" reference)
//
// A. OFF = TODAY'S BYTES. Every validated build (the user's Cub, the Jodel, the C172, the C172 on floats, the twin on
//    floats, the metal Cessna) builds to the def and the shakedown it built before the pod existed: a digest of the
//    whole def and of genShakedown's sheet against tools/_pod_base.json (taken from origin/claude/game-integration
//    fe45b9a's core). `pod: { on: 0 }` builds the same lattice, aero and ledger as no pod. An old spec normalises with
//    no `pod` key (SAVE: an old spec unchanged).
// B. THE PART on each build (the default pod): its resolved shape inside the body's run, its cargo space (kind 'pod',
//    box, floor limit, rated load = the limit x the floor, its station, a door that opens onto the box), its ledger
//    rows (the shell empty weight at its centroid, the price, the load as payload at the hold's centroid), the shell
//    mesh (finite, its lowest vertex the floor, inside the box).
// C. GROUND CLEARANCE, per build and attitude: the attitudes each gear takes (level + three-point; level + rotation to
//    the tail strike; the water at rest), re-derived independently off the shell mesh's own vertices (rotated about the
//    contact), deterministic; a deep pod strikes the Cub three-point and is refused WITH its number (the bench row).
// D. AERODYNAMICS: the def's axial drag area grows by exactly the pod's CdA (Raymer's build-up, its terms checked);
//    the shakedown's cruise / climb / range effect negative and deterministic (twice the same numbers).
// E. THE BENCH AND THE CERTIFICATE: the bench's pod row (bench.js BENCH_TESTS) on each build's sheet; the mount rows'
//    arithmetic; a REAL certificate of the Cub with the pod full against the Cub without: the four fittings carry the
//    pod and their members' envelope rises; the CG full against the corners' range and the margin (re-built full).
// F. THE FLOWN LEG (72_accept's own leg, tools/_pod_fly.js): the Cub, the Jodel and the C172 off / on / full, every
//    leg valid, the pod slower than without, the full pod no faster than the empty one.
// G. THE PAGE (source): the manifest, the bridge (hasPod, podToggle), the plaque's rows explained, the bench's row.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const SHOW = argv.includes('--show'), SELF = argv.includes('--selftest'), FLY = argv.includes('--fly'), BLESS = argv.includes('--bless'), BLESS_BYTES = argv.includes('--bless-bytes');
const EV_DIR = path.join(ROOT, 'reports', 'evidence', 'POD');
const FLIGHTS_FILE = path.join(EV_DIR, 'flights.json');
const BASE_FILE = path.join(T, '_pod_base.json');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const L = require(path.join(T, '_treecrash_lib.js'));
const C0 = L.core();
const B = require(path.join(ROOT, 'src', 'viewer', 'bench.js'));

const BUILDS = {
  cub: { file: 'builds/cub_2026-09-20_corrected.json', gear: 'taildragger' },
  jodel: { file: 'builds/jodel_2026-09-20_corrected.json', gear: 'taildragger' },
  c172: { file: 'builds/cessna172_2026-09-20_corrected.json', gear: 'tricycle' },
  floats: { file: 'bugReports/cessnaFloatsWOrks.json', gear: 'floats' },
  twinf: { file: 'tools/fixtures/build_v7_ultralight_2026-09-05.json', gear: 'floats',
           patch: j => { j.spec.gear.type = 'floats'; j.spec.cage = Object.assign({}, j.spec.cage, { gearFloats: 1 }); return j; } },
  metal: { file: 'bugReports/cessnaMetal (1).json', gear: 'tricycle' },
};
const SELF_KEYS = ['cub', 'c172', 'floats'];
const clone = o => JSON.parse(JSON.stringify(o));
function specOf(k) {
  let j = JSON.parse(rd(BUILDS[k].file));
  if (BUILDS[k].patch) j = BUILDS[k].patch(j);
  return j.spec || j;
}
// FNV-1a over the exact JSON: a byte moved anywhere moves it
function digest(o) {
  // (a shared object is written once, where it is first met - the floats' hull parameters close a circle through
  // `_keel` - which is as deterministic as the build order)
  const seen = new WeakSet();
  const s = JSON.stringify(o, (k, v) => {
    if (typeof v === 'function') return undefined;
    if (ArrayBuffer.isView(v)) return Array.from(v);
    if (v && typeof v === 'object') { if (seen.has(v)) return '[seen]'; seen.add(v); }
    return v;
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16) + ':' + s.length;
}
const defBody = d => ({ nodes: d.nodes, beams: d.beams, params: d.params, refs: d.refs, strips: d.strips,
                        ledger: d.parts && d.parts.ledger, ST: d.parts && d.parts.ST, gx: d.parts && d.parts.gx });

// ---- the fixtures, built by the core under test ----------------------------------------------------------------
function fixtures(C, keys, full) {
  const D = {};
  for (const k of keys) {
    const spec = specOf(k);
    const t0 = Date.now();
    const def0 = C.buildGen(C.genMigrateSpec(clone(spec)));
    const sh0 = C.genShakedown(def0, { corners: false });
    const s1 = clone(spec); s1.pod = { on: 1 };
    const def1 = C.buildGen(C.genMigrateSpec(s1));
    const sh1 = C.genShakedown(def1, { corners: !!full && k === 'cub' });
    const sh1b = C.genShakedown(C.buildGen(C.genMigrateSpec(clone(s1))), { corners: false, slim: true });   // determinism
    const s2 = clone(s1); s2.pod.loadKg = def1.parts.pod ? def1.parts.pod.maxKg : 0;
    const def2 = C.buildGen(C.genMigrateSpec(s2));
    const sh2 = C.genShakedown(def2, { corners: false, slim: true });
    const sOff = clone(spec); sOff.pod = { on: 0 };
    const defOff = C.buildGen(C.genMigrateSpec(sOff));
    const s3 = clone(spec); s3.pod = { on: 1, depth: 0.60 };                      // the deep pod
    const def3 = C.buildGen(C.genMigrateSpec(s3));
    const sh3 = C.genShakedown(def3, { corners: false, slim: true });
    D[k] = { spec, def0, sh0, def1, sh1, sh1b, def2, sh2, defOff, def3, sh3, s: (Date.now() - t0) / 1000 };
  }
  return D;
}
function baseOf(D) {
  const out = {};
  for (const k in D) out[k] = { def: digest(D[k].def0), sh: digest(D[k].sh0) };
  return out;
}

// ---- the checks ------------------------------------------------------------------------------------------------
function runChecks(C, D, src, F, CERT, quiet) {
  let checks = 0, fails = 0;
  const lines = [];
  const ok = (cond, msg) => { checks++; if (!cond) { fails++; lines.push('  FAIL ' + msg); } else if (SHOW && !quiet) lines.push('  ok   ' + msg); return !!cond; };
  const rep = s => { if (!quiet) lines.push('  ' + s); };
  const near = (a, b, t) => a != null && b != null && isFinite(a) && isFinite(b) && Math.abs(a - b) <= t;
  const n = (v, d) => (v == null || !isFinite(v)) ? '-' : (+v).toFixed(d);
  const keys = Object.keys(D);

  // ===== A. OFF = TODAY'S BYTES =====
  const BASE = fs.existsSync(BASE_FILE) ? JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')) : null;
  ok(!!BASE, 'the baseline tools/_pod_base.json exists (the base core\'s digests)');
  for (const k of keys) {
    const d = D[k];
    if (BASE && BASE[k]) {
      ok(digest(d.def0) === BASE[k].def, k + ': pod off, the whole def is the base\'s bytes (' + BASE[k].def + ')');
      ok(digest(d.sh0) === BASE[k].sh, k + ': pod off, the shakedown sheet is the base\'s bytes (' + BASE[k].sh + ')');
    }
    ok(!d.def0.parts.pod && !d.sh0.pod && !('pod' in d.def0.parts.ledger), k + ': no pod, no pod key anywhere (parts, sheet, ledger)');
    ok(digest(defBody(d.defOff)) === digest(defBody(d.def0)), k + ': pod { on: 0 } builds the same lattice, aero and ledger as no pod');
    ok(!('pod' in C.genNormaliseSpec(clone(d.spec))), k + ': an old spec normalises with no pod key (SAVE)');
  }

  // ===== B. THE PART =====
  const G = C.GEN_POD;
  for (const k of keys) {
    const d = D[k], R = d.def1.parts.pod, P = d.def1.parts, sh = d.sh1, p = sh.pod;
    if (!ok(!!R && !!p, k + ': the pod resolves and the sheet reports it')) continue;
    const ST = P.ST;
    ok(R.x0 >= ST[0].x && R.x1 <= ST[ST.length - 1].x && R.x0 < R.xa && R.xa < R.xb && R.xb < R.x1,
       k + ': under the body, nose fairing / floor / boat-tail in order (' + n(R.x0, 2) + ' ' + n(R.xa, 2) + ' ' + n(R.xb, 2) + ' ' + n(R.x1, 2) + ' m)');
    ok(R.hw <= 0.95 * C.genPodKeel(ST, 0.5 * (R.x0 + R.x1)).w + 1e-9, k + ': no wider than 0.95 of the belly');
    ok(R.sta.every(s => near(s.top, C.genPodKeel(ST, s.x).yb, 1e-9) && s.bot <= s.top + 1e-12), k + ': its top is the keel line at every station');
    const sp = p.space;
    ok(sp && sp.kind === 'pod' && sp.external === true && sp.floorKgM2 === G.floorLimit && near(sp.maxKg, Math.round(G.floorLimit * sp.floorM2), 0.5)
       && sp.litres > 50 && sp.box.x0 === R.xa && sp.box.x1 === R.xb && sp.box.y1 > sp.box.y0 && sp.box.halfW > 0,
       k + ': the cargo space (kind pod): ' + n(sp && sp.litres, 0) + ' L, ' + n(sp && sp.floorM2, 2) + ' m2 at ' + G.floorLimit + ' kg/m2 = ' + (sp && sp.maxKg) + ' kg');
    const dr = sp && sp.door;
    ok(dr && dr.x0 >= sp.box.x0 - 1e-9 && dr.x1 <= sp.box.x1 + 1e-9 && near(dr.y0, sp.box.y0, 1e-9) && dr.h > 0.05 && dr.y1 <= sp.box.y1 + 1e-9 && dr.side === -1,
       k + ': its door opens onto the box (' + n(dr && dr.w, 2) + ' x ' + n(dr && dr.h, 2) + ' m, the left side, the sill on the floor)');
    const Lg = P.ledger.pod;
    ok(Lg && !Lg.payload && near(Lg.mass, R.shellKg, 1e-6) && near(Lg.mx / Lg.mass, R.xShell, 1e-6) && Lg.cost === R.price,
       k + ': the ledger\'s pod row: ' + n(Lg && Lg.mass, 2) + ' kg empty weight at x ' + n(R.xShell, 3) + ', ' + R.price + ' cr');
    ok(sh.empty > d.sh0.empty + R.shellKg - 0.5 && sh.cost >= d.sh0.cost + R.price - 1, k + ': the plaque\'s empty and cost carry it (' + n(d.sh0.empty, 1) + ' -> ' + n(sh.empty, 1) + ' kg)');
    const L2 = d.def2.parts.ledger.podLoad, R2 = d.def2.parts.pod;
    ok(L2 && L2.payload && near(L2.mass, R2.maxKg, 1e-6) && near(L2.mx / L2.mass, R2.xLoad, 1e-6) && !d.def1.parts.ledger.podLoad,
       k + ': loaded full, the freight is payload (' + (L2 && n(L2.mass, 0)) + ' kg at the hold\'s centroid ' + n(R2 && R2.xLoad, 3) + ')');
    const M = C.genPodShell(R);
    let lo = 1e9, inBox = true, fin = true;
    for (let i = 0; i < M.nv; i++) { const x = M.pos[3 * i], y = M.pos[3 * i + 1], z = M.pos[3 * i + 2];
      if (!isFinite(x + y + z)) fin = false; lo = Math.min(lo, y);
      if (x < R.x0 - 1e-6 || x > R.x1 + 1e-6 || Math.abs(z) > R.hw + 1e-6) inBox = false; }
    ok(fin && inBox && near(lo, R.yBot, 1e-5) && M.nt > 100 && M.idx.every(i => i < M.nv), k + ': the shell mesh (' + M.nt + ' tris): finite, inside its box, its lowest vertex the floor');
  }

  // ===== C. GROUND CLEARANCE =====
  rep('-- the clearance, per build and attitude (the default pod: 2.0 x 0.56 x 0.28 m) --');
  for (const k of keys) {
    const d = D[k], CL = d.sh1.pod && d.sh1.pod.clearance, R = d.def1.parts.pod;
    if (!ok(!!CL, k + ': a clearance')) continue;
    const want = BUILDS[k].gear === 'floats' ? ['water'] : BUILDS[k].gear === 'tricycle' ? ['level', 'rotation'] : ['level', 'threePoint'];
    ok(CL.rows.map(r => r.id).join() === want.join(), k + ': the attitudes its gear takes: ' + CL.rows.map(r => r.name).join(', '));
    // independently, off the shell's own vertices rotated about the contact
    const M = C.genPodShell(R), S = d.def1.spec, P = d.def1.parts;
    for (const r of CL.rows) {
      let x0, y0;
      if (r.id === 'water') { x0 = 0; y0 = P.floats[0].pos[1] + r.draft; }
      else { x0 = P.gx; y0 = S.gear.y - S.gear.contactR; }
      const th = r.deg * Math.PI / 180, c = Math.cos(th), s = Math.sin(th);
      let lo = 1e9;
      for (let i = 0; i < M.nv; i++) lo = Math.min(lo, (M.pos[3 * i + 1] - y0) * c - (M.pos[3 * i] - x0) * s);
      ok(near(lo, r.clear, 0.002), k + ' ' + r.name + ': ' + n(r.clear, 3) + ' m (the shell\'s vertices: ' + n(lo, 3) + ')');
    }
    if (BUILDS[k].gear === 'taildragger')
      ok(near(CL.rows[1].deg, d.sh1.deckAngle, 1e-6), k + ': the three-point attitude is the plaque\'s deck angle (' + n(d.sh1.deckAngle, 2) + ' deg)');
    if (BUILDS[k].gear === 'tricycle') {
      let th = 1;
      for (const s of P.ST) if (s.x > P.gx + 0.3) th = Math.min(th, Math.atan2(s.yb - (S.gear.y - S.gear.contactR), s.x - P.gx));
      ok(near(CL.rows[1].deg, th * 180 / Math.PI, 1e-6) && CL.rows[1].deg > 5 && CL.rows[1].deg < 20, k + ': rotated to the tail strike at ' + n(CL.rows[1].deg, 1) + ' deg');
    }
    if (BUILDS[k].gear === 'floats') {
      const r = CL.rows[0], FP = P.floats[0].P, F = { P: FP, xBow: -FP.xs, xStern: FP.L - FP.xs };
      const disp = 2 * C.HYDRO.levelVolume(F, r.draft, 2000) * 1000;
      ok(near(disp, d.sh1.mass, 0.01 * d.sh1.mass) && r.draft > 0.05 && r.draft < FP.H, k + ': the waterline: draft ' + n(r.draft, 3) + ' m displaces ' + n(disp, 0) + ' kg (all-up ' + n(d.sh1.mass, 0) + ')');
    }
    ok(CL.ok === (CL.worst.clear > 0 && CL.legsOk), k + ': ok is the worst clearance over zero and the legs clear');
    ok(near(d.sh1b.pod.clearance.worst.clear, CL.worst.clear, 0) && d.sh1b.pod.clearance.worst.id === CL.worst.id, k + ': deterministic (built twice, the same number)');
    const legs = (CL.legs || []).map(l => l.id + ' ' + n(l.gap, 3)).join(', ');
    rep(k.padEnd(7) + CL.rows.map(r => r.name + ' ' + n(r.deg, 1) + ' deg: ' + n(r.clear, 3) + ' m').join(' | ') + (legs ? ' | ' + legs : '') + ' -> ' + (CL.ok ? (CL.warn ? 'fits (close)' : 'fits') : 'REFUSED'));
    // the deep pod (0.60 m): deeper, closer; on the Cub's tail-down stance it strikes and is refused with its number
    const C3 = d.sh3.pod.clearance;
    ok(C3.worst.clear < CL.worst.clear - 0.25, k + ': a 0.60 m pod comes 0.3 m closer (' + n(C3.worst.clear, 3) + ' m)');
  }
  {
    const C3 = D.cub && D.cub.sh3.pod.clearance;
    if (C3) {
      ok(C3.worst.id === 'threePoint' && C3.worst.clear < 0 && !C3.ok, 'the Cub with a 0.60 m pod STRIKES three-point: ' + n(C3.worst.clear, 3) + ' m');
      const row = src.bench.BENCH_TESTS.find(t => t.id === 'pod');
      const r3 = row && row.run({ shake: () => D.cub.sh3 });
      ok(r3 && !r3.ok && /REFUSED/.test(r3.verdict) && r3.verdict.indexOf(n(C3.worst.clear, 2)) >= 0 && r3.clear === C3.worst.clear,
         'the bench refuses it WITH the number: "' + (r3 && r3.verdict) + '"');
    }
  }

  // ===== D. AERODYNAMICS =====
  rep('-- the drag and its cost (measured on each aeroplane\'s own probe) --');
  for (const k of keys) {
    const d = D[k], p = d.sh1.pod, R = d.def1.parts.pod;
    if (!p) continue;
    const pd = C.genPodCdA(R);
    const dEq = Math.sqrt(4 * R.frontal / Math.PI), f = R.len / dEq;
    ok(near(pd.f, f, 1e-9) && near(pd.FF, 1 + 60 / (f * f * f) + f / 400, 1e-12) && pd.Q === 1.5 && near(pd.boxK, 1 + C.GEN_DRAG.boxK, 1e-12)
       && near(pd.cda, C.GEN_MATERIALS.carbon.cdWet * pd.FF * 1.5 * pd.boxK * R.swet, 1e-12) && /Raymer/.test(pd.src),
       k + ': CdA = Cf FF Q box Swet = ' + n(C.GEN_MATERIALS.carbon.cdWet, 4) + ' x ' + n(pd.FF, 3) + ' x 1.5 x ' + n(pd.boxK, 2) + ' x ' + n(R.swet, 2) + ' = ' + n(pd.cda, 4) + ' m2 (Cd ' + n(pd.cdFrontal, 3) + ' on its frontal)');
    const a0 = d.def0.params.gen.drag.axial, a1 = d.def1.params.gen.drag.axial;
    ok(near(a1 - a0, pd.cda, 2e-4) && near(d.def1.params.gen.drag.pod, pd.cda, 1e-12) && d.def0.params.gen.drag.pod === undefined,
       k + ': the axial drag area grows by the pod\'s (' + n(a0, 4) + ' -> ' + n(a1, 4) + ' m2)');
    ok(near(d.def1.params.fusCdA[2] - d.def0.params.fusCdA[2], pd.crossZ, 1e-9) && near(d.def1.params.fusCdA[1] - d.def0.params.fusCdA[1], pd.crossY, 1e-9),
       k + ': its side and plan areas on the forward blob\'s cross-flow');
    const c = p.cruise;
    ok(c && c.dV < 0 && c.dClimb < 0 && near(c.dRangePct, c.dPct, 1e-12), k + ': it costs cruise (' + n(c && c.dV * 3.6, 2) + ' km/h) and climb (' + n(c && c.dClimb, 3) + ' m/s)');
    ok(near(c.dClimb, -0.5 * C.RHO * Math.pow(d.def1.params.ap.VClimb, 3) * pd.cda / (d.sh1.mass * 9.81), 1e-9), k + ': the climb cost is its drag x VClimb over the weight');
    ok(digest(d.sh1b.pod.cruise) === digest(c), k + ': the cruise cost deterministic (built twice)');
    rep(k.padEnd(7) + 'CdA ' + n(pd.cda, 4) + ' m2 (' + n(p.dragShare * 100, 1) + ' % of the body) · cruise ' + n(c.vWithout * 3.6, 1) + ' -> ' + n(c.vWith * 3.6, 1) + ' km/h (' + n(c.dPct * 100, 2) + ' %) · climb ' + n(c.dClimb, 3) + ' m/s · VCruise (clamped) ' + n(d.sh0.VCruise * 3.6, 1) + ' -> ' + n(d.sh1.VCruise * 3.6, 1) + ' · range ' + n(d.sh0.rangeKm, 0) + ' -> ' + n(d.sh1.rangeKm, 0) + ' km');
  }

  // ===== E. THE BENCH, THE CG, THE CERTIFICATE =====
  const row = src.bench.BENCH_TESTS.find(t => t.id === 'pod');
  ok(row && row.advisory === true && row.kind === 'instant' && typeof row.when === 'function' && !row.when({}) && row.when({ hasPod: () => true }) && !row.when({ hasPod: () => false }),
     'the bench\'s pod row: instant, advisory, shown for a build with a pod only');
  for (const k of keys) {
    const d = D[k], p = d.sh1.pod, R = d.def1.parts.pod, b = p && p.balance;
    if (!b) continue;
    const r = row.run({ shake: () => d.sh1 });
    const expect = p.clearance.ok && !(b.staticMargin < 0.05);
    ok(r && r.ok === expect && r.fills === 'plaque' && /m² drag/.test(r.note), k + ': the bench row: ' + (r && r.verdict));
    // the CG full, analytic, against the aeroplane re-built full
    const sh2 = d.sh2;
    // (the re-built aeroplane is re-generated at its new loading: the mains placed against its CG and, on floats
    // sized by the rule, the floats sized for the gross - a kilo or two, a millimetre or two)
    ok(near(b.cgX, sh2.cgX, 0.01) && near(b.mass, sh2.mass, 0.02 * sh2.mass), k + ': the CG with the pod full ' + n(b.cgX, 3) + ' m = the re-built full aeroplane\'s ' + n(sh2.cgX, 3) + ' m (' + n(b.mass, 1) + ' / ' + n(sh2.mass, 1) + ' kg)');
    ok(Math.sign(b.shift) === Math.sign(R.xLoad - d.sh1.cgX) && near(b.staticMargin, (d.sh1.npX - b.cgX) / d.sh1.cBar, 1e-12), k + ': it walks the CG toward the hold, the margin off the neutral point');
    const MR = C.genCertPodMounts(d.def1, null);
    ok(MR && MR.rows.length === 4 && near(MR.kg, R.shellKg + R.maxKg, 1e-6) && MR.rows.every(x => near(x.up, x.kg * 9.81 * C.GEN_CERT.limit, 1e-9) && near(x.ult, x.kg * 9.81 * C.GEN_CERT.ult, 1e-9) && near(x.down, x.up * C.GEN_CERT.neg, 1e-9) && near(x.fwd9, x.kg * 9.81 * 9, 1e-9))
       && MR.rows.every(x => x.node === d.def1.parts.F[x.ring][x.side === 'left' ? 'BL' : 'BR']) && R.mounts.join() === MR.rows.map(x => x.ring).filter((v, i, a) => a.indexOf(v) === i).join(),
       k + ': the mount rows: four fittings on rings ' + R.mounts.join(' and ') + ', ' + n(MR && MR.kg, 1) + ' kg full, ' + n(MR && MR.worstUp / 1000, 2) + ' kN a fitting at +3.8 g');
    // the shell's moment on the fittings is its own (the lever)
    const fs0 = MR.rows.filter(x => x.ring === R.mounts[0]).reduce((t, x) => t + x.kg, 0), fs1 = MR.kg - fs0;
    const xm = R.mounts[0] === R.mounts[1] ? d.def1.parts.ST[R.mounts[0]].x : (fs0 * d.def1.parts.ST[R.mounts[0]].x + fs1 * d.def1.parts.ST[R.mounts[1]].x) / MR.kg;
    ok(near(xm, (R.shellKg * R.xShell + R.maxKg * R.xLoad) / MR.kg, 1e-6), k + ': the fittings carry the pod\'s own moment (x ' + n(xm, 3) + ')');
    const rg = b.range;
    rep(k.padEnd(7) + 'full ' + R.maxKg + ' kg: CG ' + n(b.cgAsIsPct * 100, 1) + ' -> ' + n(b.cgPct * 100, 1) + ' % MAC, margin ' + n(d.sh1.staticMargin, 3) + ' -> ' + n(b.staticMargin, 3) + (rg ? ', the corners\' range ' + n(rg.fwdPct * 100, 1) + '-' + n(rg.aftPct * 100, 1) + ' % (' + (b.inRange ? 'inside' : 'OUTSIDE') + ')' : '') + (b.overGross != null ? ', ' + n(b.overGross, 0) + ' kg against the design gross' : '') + ' · bench: ' + r.verdict);
  }
  if (D.cub && D.cub.sh1.pod.balance.range) ok(D.cub.sh1.pod.balance.inRange != null && D.cub.sh1.pod.balance.range.aft >= D.cub.sh1.pod.balance.range.fwd, 'the Cub: the full CG reported against the four corners\' range');
  if (CERT) {
    const R = CERT.def.parts.pod, MR = C.genCertPodMounts(CERT.def, CERT.cert);
    ok(MR && MR.rows.every(x => x.envelope > 0 && x.members >= 3 && x.share > 0), 'a REAL certificate of the Cub, pod full: every fitting\'s node carries certified members (' + MR.rows.map(x => x.members + ' members ' + n(x.envelope / 1000, 2) + ' kN').join(', ') + ')');
    const rise = MR.rows.map(x => { let e0 = 0; CERT.def0.beams.forEach((bm, bi) => { if (bm.a === x.node || bm.b === x.node) e0 = Math.max(e0, CERT.cert0.Ft[bi] || 0, CERT.cert0.Fc[bi] || 0); }); return x.envelope - e0; });
    ok(CERT.def0.beams.length + 22 === CERT.def.beams.length && CERT.def.beams.slice(0, CERT.def0.beams.length).every((b, i) => b.a === CERT.def0.beams[i].a && b.b === CERT.def0.beams[i].b) && rise.some(v => v > 0), 'the pod full raises the certified envelope at its fittings (its 22 members after the aeroplane\'s own): ' + rise.map(v => (v >= 0 ? '+' : '') + n(v / 1000, 3) + ' kN').join(', '));
    ok(CERT.cert.limit === C.GEN_CERT.limit && CERT.cert.ult === C.GEN_CERT.ult, 'the certificate is the normal category\'s (+' + CERT.cert.limit + ' / ' + CERT.cert.ult + ' g)');
    rep('the Cub, pod full (' + R.maxKg + ' kg), certified in ' + n(CERT.s, 1) + ' s: the fittings carry ' + MR.rows.map(x => n(x.kg, 1) + ' kg').join(' / ') + '; pod limit share of the node\'s certified envelope ' + MR.rows.map(x => n(x.share * 100, 0) + ' %').join(' / '));
  }

  // ===== F. THE FLOWN LEG =====
  if (F) {
    rep('-- the acceptance leg (5 min, 75 % throttle, HOME + 300 m, calm) --');
    for (const b of ['cub', 'jodel', 'c172']) {
      const off = F[b + '_off'], on = F[b + '_on'], full = F[b + '_full'];
      if (!ok(off && on && full && off.leg && on.leg && full.leg, b + ': three legs flown')) continue;
      ok(off.leg.valid && on.leg.valid && full.leg.valid && !off.bad && !on.bad && !full.bad, b + ': every leg valid (' + [off, on, full].map(x => x.leg.why.join(';') || 'ok').join(' | ') + ')');
      ok(on.leg.tasKmh < off.leg.tasKmh && full.leg.tasKmh <= on.leg.tasKmh + 0.3, b + ': the pod flies slower (' + off.leg.tasKmh + ' -> ' + on.leg.tasKmh + ' -> ' + full.leg.tasKmh + ' km/h full)');
      ok(on.podKg === 0 && full.podKg > 0 && full.massKg > on.massKg + full.podKg - 1.0, b + ': the full leg carries the load (' + full.podKg + ' kg)');
      rep(b.padEnd(7) + 'TAS ' + off.leg.tasKmh + ' / ' + on.leg.tasKmh + ' / ' + full.leg.tasKmh + ' km/h · flow ' + n(off.leg.flow, 2) + ' / ' + n(on.leg.flow, 2) + ' / ' + n(full.leg.flow, 2) + ' · range ' + n(off.leg.rangeKm, 0) + ' / ' + n(on.leg.rangeKm, 0) + ' / ' + n(full.leg.rangeKm, 0) + ' km (off / on / full)');
    }
  } else ok(false, 'the flown legs: none stored (run --fly)');

  // ===== G. THE PAGE =====
  ok(/'60c_gen_energy\.js',[\s\S]{0,400}'60d_gen_pod\.js',[\s\S]{0,40}'61_gen_frame\.js'/.test(src.build), 'build.js: 60d_gen_pod.js between the energy and the frame');
  ok(/hasPod: \(\) => !!\(def && def\.parts && def\.parts\.pod\)/.test(src.app) && /podToggle: on =>/.test(src.app), 'app.js: the bench\'s bridge (hasPod, podToggle)');
  const labels = ['pod', 'pod clearance', 'pod drag', 'pod full', 'pod mounts'];
  ok(labels.every(l => src.app.indexOf("R('" + l + "'") >= 0), 'app.js: the plaque prints the pod\'s rows');
  ok(labels.every(l => src.plaque.PLAQUE_EXPLAIN ? !!src.plaque.PLAQUE_EXPLAIN[l] : new RegExp("'" + l + "': \\{ what:").test(src.plaqueTxt)) && /'belly pod': '/.test(src.plaqueTxt),
     'plaque.js: every pod row explained, the section its line');
  ok(/'pod clearance':\s+\{ lo: 0\.08, badLo: 0\.001/.test(src.plaqueTxt), 'plaque.js: the clearance judged (amber under 0.08 m, red at a strike)');
  ok(/getElementById|\$\('bPodFit'\)/.test(src.benchTxt) && /api\.podToggle\(!api\.hasPod\(\)\)/.test(src.benchTxt), 'bench.js: the fit / remove door');
  return { checks, fails, lines };
}

// ===== H. BELLY-POD-2 (G2675-G2679): THE EDITOR'S MAPPING, ITS READOUTS, THE FLOWN POD, ITS SCRAPE, THE BYTES, THE
// PROCURE PATH, THE DRAWN POD =====
// X (main only): { bytes: { key: _pod_bytes.js's line }, scene: the headless drawing's measurements } - null in the
// selftest (the doctors break the core; the witness processes and the scene read the core on disk)
function runChecks2(C, D, X, quiet) {
  let checks = 0, fails = 0;
  const lines = [];
  const ok = (cond, msg) => { checks++; if (!cond) { fails++; lines.push('  FAIL ' + msg); } else if (SHOW && !quiet) lines.push('  ok   ' + msg); return !!cond; };
  const rep = s => { if (!quiet) lines.push('  ' + s); };
  const near = (a, b, t) => a != null && b != null && isFinite(a) && isFinite(b) && Math.abs(a - b) <= t;
  const n = (v, d) => (v == null || !isFinite(v)) ? '-' : (+v).toFixed(d);
  const keys = Object.keys(D), K = C.GEN_POD.clamp, U = C.GEN_POD_UI;
  // ---- H1 THE VOLUME (the editor leads with it; the core maps it onto len / width / depth through the clamp) ----
  rep('-- BELLY-POD-2: the volume the editor sets, mapped by the core (genPodFromVolume) --');
  ok(near(C.genPodShapeOf(C.genPodLD(0.37) * 0.3, 0.3), 0.37, 1e-12) && C.genPodLD(0) === U.ldAt0 && C.genPodLD(1) === U.ldAt1, 'the shape: length / depth ' + U.ldAt0 + ' (long, shallow) to ' + U.ldAt1 + ' (short, deep), and back');
  for (const k of keys) {
    const d = D[k], S = d.def1.spec, ST = d.def1.parts.ST, R = d.def1.parts.pod;
    const rt = C.genPodFromVolume(S, ST, R.litres, C.genPodShapeOf(R.len, R.depth));
    ok(rt.reached && rt.len === C.GEN_POD.def.len && rt.width === C.GEN_POD.def.width && rt.depth === C.GEN_POD.def.depth,
       k + ': the default pod\'s own volume and shape map back onto its dims (' + n(R.litres, 1) + ' L -> ' + rt.len + ' x ' + rt.width + ' x ' + rt.depth + ' m)');
    const row = [];
    for (const t of [0, 0.5, 1]) {
      let last = 0;
      for (const L of [60, 250]) {
        const o = C.genPodFromVolume(S, ST, L, t);
        const inK = ['len', 'width', 'depth'].every(q => o[q] >= K[q][0] - 1e-12 && o[q] <= K[q][1] + 1e-12);
        const got = C.genPodResolve(Object.assign({}, S, { pod: { on: 1, len: o.len, width: o.width, depth: o.depth } }), ST).litres;
        const bound = o.len === K.len[1] || o.len === K.len[0] || o.depth === K.depth[1] || o.width === K.width[1];
        ok(inK && o.depth > last && (o.reached ? near(got, L, 1.5) : bound) && (bound || near(o.len / o.depth, C.genPodLD(t), 0.05)) && near(o.width, Math.min(K.width[1], 2 * o.depth), 0.0011),
           k + ' ' + L + ' L, shape ' + t + ': ' + o.len + ' x ' + o.width + ' x ' + o.depth + ' m holds ' + n(got, 1) + ' L (inside the clamp, the depth growing with the volume)');
        last = o.depth; row.push(L + ' L @' + t + ' ' + o.len + 'x' + o.width + 'x' + o.depth);
      }
    }
    const long = C.genPodFromVolume(S, ST, U.litres[1], 0);
    ok(long.len === K.len[1] && ['len', 'width', 'depth'].every(q => long[q] <= K[q][1] + 1e-12), k + ': ' + U.litres[1] + ' L long and shallow: the length stops AT the clamp (' + long.len + ' m), the depth takes the rest (' + long.depth + ' m)');
    const big = C.genPodFromVolume(S, ST, U.litres[1], 1);
    ok(!big.reached && big.depth === K.depth[1], k + ': ' + U.litres[1] + ' L short and deep stops at the clamp (' + n(big.litres, 0) + ' L the most this shape holds here)');
    rep(k.padEnd(7) + row.join(' | '));
  }
  // ---- H2 THE READOUTS: the core's own numbers, and the red reasons ----
  for (const k of keys) {
    const d = D[k], R = d.def1.parts.pod, sh = d.sh1, p = sh.pod, RO = C.genPodReadout(d.def1, sh), R0 = C.genPodReadout(d.def1, null);
    const Lg = d.def1.parts.ledger.pod;
    ok(RO && !RO.pending && near(RO.litres, p.space.litres, 1e-12) && near(RO.floorM2, p.space.floorM2, 1e-12) && RO.maxKg === p.maxKg
       && near(RO.emptyKg, Lg.mass, 1e-12) && RO.price === Lg.cost && near(RO.cda, p.cda, 1e-15)
       && near(RO.cruise.dV, p.cruise.dV, 1e-15) && near(RO.dRangeKm, sh.rangeKm * (1 - 1 / (1 + p.cruise.dRangePct)), 1e-9)
       && near(RO.cgFull.staticMargin, p.balance.staticMargin, 1e-15) && near(RO.cgFull.shift, p.balance.shift, 1e-15)
       && RO.clearance.length === p.clearance.rows.length && RO.clearance.every((r, i) => r.clear === p.clearance.rows[i].clear && r.id === p.clearance.rows[i].id),
       k + ': the readout is the core\'s - ' + Math.round(RO.litres) + ' L, ' + n(RO.emptyKg, 1) + ' kg, ' + RO.price + ' cr, ' + n(RO.cda, 4) + ' m2, cruise ' + n(RO.cruise.dV * 3.6, 2) + ' km/h, range ' + n(RO.dRangeKm, 1) + ' km, CG full ' + n(RO.cgFull.shift * 1000, 0) + ' mm');
    // the CG empty: the shell's moment off the sheet's own mass, against the aeroplane built without it
    ok(near(RO.cgEmpty.shift, sh.cgX - d.sh0.cgX, 0.01), k + ': the CG shift empty ' + n(RO.cgEmpty.shift * 1000, 1) + ' mm (re-built without the pod: ' + n((sh.cgX - d.sh0.cgX) * 1000, 1) + ' mm - the gauge re-sized with it)');
    ok(R0 && R0.pending && R0.cruise === null && R0.cgFull === null && near(R0.litres, RO.litres, 0) && near(R0.cda, RO.cda, 0) && R0.clearance.length === RO.clearance.length,
       k + ': before the sheet lands the readout says so (pending), the sheet-free rows already exact');
    const wantRed = k === 'jodel';
    ok(wantRed ? RO.red.some(t => /full, its static margin is -0\.0\d \(unstable\)/.test(t)) : RO.red.length === 0,
       k + ': ' + (RO.red.length ? 'RED - ' + RO.red.join('; ') : 'no red') + (RO.amber.length ? ' (amber: ' + RO.amber.join('; ') + ')' : ''));
    const R3 = C.genPodReadout(d.def3, d.sh3);
    ok(R3.red.some(t => /strikes|under 0\.08/.test(t)) === (d.sh3.pod.clearance.worst.clear < 0.08), k + ' with a 0.60 m pod: ' + (R3.red.length ? 'RED - ' + R3.red[0] : 'no red'));
  }
  // THE RED RULES THEMSELVES, on a sheet whose numbers are set at each bound (the first build's own sheet, its rows moved)
  {
    const k0 = keys[0], d = D[k0], sh = JSON.parse(JSON.stringify(d.sh1)), rows = sh.pod.clearance.rows;
    const red = (clr, sm) => { rows.forEach(r => { r.clear = clr; }); sh.pod.balance.staticMargin = sm; return C.genPodReadout(d.def1, sh); };
    const a = red(0.05, 0.10), b = red(0.09, 0.10), c = red(0.09, -0.01), e = red(0.09, 0.03), f = red(-0.01, 0.10);
    ok(a.red.some(t => /0\.05 m clear, under 0\.08 m/.test(t)) && b.red.length === 0 && c.red.some(t => /static margin is -0\.01 \(unstable\)/.test(t))
       && e.red.length === 0 && e.amber.some(t => /only 0\.03/.test(t)) && f.red.some(t => /strikes .*\(-0\.01 m\)/.test(t)),
       'the red rules: 0.05 m clear -> red "under 0.08 m"; 0.09 m -> none; margin full -0.01 -> red "unstable"; 0.03 -> amber; -0.01 m -> red "strikes"');
  }
  // ---- H3 THE FLOWN POD: four scraping nodes at its lowest points, its mass on them, no substep paid ----
  rep('-- the flown pod (61_gen_frame G2678): its nodes, its mass, its members, the step --');
  for (const k of keys) {
    const d = D[k], P = d.def1.parts, R = P.pod, F = P.podFrame;
    if (!ok(F && F.nodes.length === 4, k + ': the pod is flown: four nodes')) continue;
    const nd = F.nodes.map(i => d.def1.nodes[i]), at = C.genPodNodesAt(R, P.ST);
    ok(nd.every((q, j) => q.tag === 'POD' && q.r === 0 && q.p.every((v, c) => v === at[j][c])) && F.nodes.every(i => !d.def1.refs.mains.includes(i) && i !== d.def1.refs.tw),
       k + ': tagged POD, r 0 (no wheel: the solver\'s scrape branch), at genPodNodesAt\'s points (the floor\'s fore and aft ends, half the half-width out)');
    const m = nd.reduce((s, q) => s + q.m, 0), mx = nd.reduce((s, q) => s + q.m * q.p[0], 0);
    ok(near(m, R.shellKg, 1e-9) && near(mx / m, R.xShell, 1e-9), k + ': the shell\'s ' + n(R.shellKg, 2) + ' kg on them, its moment the shell\'s centroid (x ' + n(R.xShell, 3) + ')');
    const F2 = d.def2.parts.podFrame, R2 = d.def2.parts.pod, n2 = F2.nodes.map(i => d.def2.nodes[i]);
    const m2 = n2.reduce((s, q) => s + q.m, 0), mx2 = n2.reduce((s, q) => s + q.m * q.p[0], 0);
    ok(near(m2, R2.shellKg + R2.loadKg, 1e-9) && near(mx2, R2.shellKg * R2.xShell + R2.loadKg * R2.xLoad, 1e-9), k + ': full, the freight on them too (' + n(m2, 1) + ' kg, at the hold\'s centroid)');
    const fit = F.fittings, bm = d.def1.beams;
    ok(F.hangers.length === 16 && F.braces.length === 6 && F.hangers.every(b => F.nodes.includes(bm[b].a) && fit.includes(bm[b].b)) && F.braces.every(b => F.nodes.includes(bm[b].a) && F.nodes.includes(bm[b].b))
       && fit.every(i => /^S\d+B[LR]$/.test(d.def1.nodes[i].tag)) && bm.length === d.def0.beams.length + 22 && d.def1.nodes.length === d.def0.nodes.length + 4,
       k + ': hung on the fittings (rings ' + F.rings.join(' / ') + ', lower longerons) by 16 hangers, braced by 6: 4 nodes and 22 members more, nothing else');
    // its lowest points ARE the clearance's: in every attitude the lowest node sits on the shell's lowest point
    const S = d.def1.spec, CL = d.sh1.pod.clearance;
    for (const r of CL.rows) {
      let x0, y0;
      if (r.id === 'water') { x0 = 0; y0 = P.floats[0].pos[1] + r.draft; } else { x0 = P.gx; y0 = S.gear.y - S.gear.contactR; }
      const th = r.deg * Math.PI / 180, c = Math.cos(th), s2 = Math.sin(th);
      const lo = Math.min(...nd.map(q => (q.p[1] - y0) * c - (q.p[0] - x0) * s2));
      // (the shell's sampled polyline steps past the floor's aft end, xb - the node IS the floor's end: a few mm lower)
      ok(Math.abs(lo - r.clear) < 0.006, k + ' ' + r.name + ': the lowest pod node ' + n(lo, 3) + ' m, the shell\'s lowest ' + n(r.clear, 3) + ' m (on the shell, within 6 mm)');
    }
    // NO SUBSTEP PAID: empty, the step is the aeroplane's own; full or deep, no pod member is the one that sets it (its
    // omega and its damper c / m under the airframe's own worst - a loaded aeroplane re-gauges, and that is its own)
    const binds = def => { const pf = def.parts.podFrame, set = new Set(pf.hangers.concat(pf.braces)); let wP = 0, cP = 0, wA = 0, cA = 0;
      def.beams.forEach((b, i) => { const inv = 1 / def.nodes[b.a].m + 1 / def.nodes[b.b].m, w = Math.sqrt(b.k * inv), c = b.c * inv;
        if (set.has(i)) { wP = Math.max(wP, w); cP = Math.max(cP, c); } else { wA = Math.max(wA, w); cA = Math.max(cA, c); } });
      return { wP, cP, wA, cA, ok: wP < wA && cP < cA }; };
    const b1 = binds(d.def1), b2 = binds(d.def2), b3 = binds(d.def3);
    ok(d.def1.params.substeps === d.def0.params.substeps && b1.ok && b2.ok && b3.ok,
       k + ': no substep paid - ' + d.def0.params.substeps + ' with or without; the pod\'s members never set the step (omega ' + n(b1.wP, 0) + ' / c/m ' + n(b1.cP, 0) + ' under the airframe\'s ' + n(b1.wA, 0) + ' / ' + n(b1.cA, 0) + ', full and deep too)');
  }
  // ---- H4 THE SCRAPE: a pod that reaches the ground rests and SLIDES on its own nodes (mu 0.8, not a wheel) ----
  {
    const slide = (def, label) => {
      const df = Object.assign({}, def, { params: Object.assign({}, def.params, { damage: false }), cert: null });
      const W = C.makeWorld(), sim = C.makeSim(df, W); sim.reset(0);
      for (let i = 0; i < 180; i++) sim.step(1 / 60);
      const p = sim.p, v = sim.v, N = df.nodes.length, mains = df.refs.mains;
      const gY = Math.min(...mains.map(i => p[3 * i + 1] - sim.r[i]));
      const pf = df.parts.podFrame, podLow = pf ? Math.min(...pf.nodes.map(i => p[3 * i + 1])) - gY : null;
      const a = df.refs.noseFrame[0], b = df.refs.tailMid[0];
      let fx = p[3 * a] - p[3 * b], fz = p[3 * a + 2] - p[3 * b + 2]; const L = Math.hypot(fx, fz); fx /= L; fz /= L;
      for (let i = 0; i < N; i++) { v[3 * i] += 10 * fx; v[3 * i + 2] += 10 * fz; }
      const spd = () => { let sx = 0, sz = 0, M = 0; for (let i = 0; i < N; i++) { sx += v[3 * i] * df.nodes[i].m; sz += v[3 * i + 2] * df.nodes[i].m; M += df.nodes[i].m; } return Math.hypot(sx, sz) / M; };
      const s0 = spd(); for (let i = 0; i < 60; i++) sim.step(1 / 60);
      return { podLow, lost: s0 - spd(), bad: !!sim.stats().bad, label };
    };
    for (const k of ['c172', 'cub']) {
      if (!D[k]) continue;
      const off = slide(D[k].def0, 'off'), deep = slide(D[k].def3, 'deep'), dflt = slide(D[k].def1, 'default');
      ok(!off.bad && !deep.bad && !dflt.bad && deep.podLow < 0.02 && dflt.podLow > 0.05 && deep.lost > 1.8 * off.lost && near(dflt.lost, off.lost, 0.3),
         k + ': a 0.60 m pod RESTS on its nodes (' + n(deep.podLow, 3) + ' m over the mains\' ground) and SLIDES: 10 m/s loses ' + n(deep.lost, 2) + ' m/s in 1 s (the wheels alone ' + n(off.lost, 2) + ', the default pod clear of the ground ' + n(dflt.lost, 2) + ' - its lowest node ' + n(dflt.podLow, 3) + ' m up, the gear settled)');
    }
  }
  // ---- H5 THE BYTES: an aeroplane without a pod - its certificate and its flight - as before the pod's code ----
  if (X && X.bytes) {
    const BASE = fs.existsSync(BASE_FILE) ? JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')) : {};
    for (const k of Object.keys(BUILDS)) {
      const b = X.bytes[k], base = BASE[k] && BASE[k].bytes;
      ok(b && base && b.cert === base.cert && b.sim === base.sim && b.nodes === base.nodes,
         k + ': no pod - the certificate (' + (b && b.cert) + ') and 300 flown steps (' + (b && b.sim) + ') are the base core\'s, to the bit' + (base ? '' : ' (NO BASE: run --bless-bytes in a base worktree)'));
    }
  }
  // ---- H6 THE PROCURE PATH: a pod on a BOUGHT aeroplane is a modification, the same door as any other ----
  {
    const fileSpec = JSON.parse(rd(BUILDS.cub.file));
    const L0 = C.buildGen(C.genMigrateSpec(clone(fileSpec.spec))).parts.ledger;
    const b = C.procureBuyModel(C.careerNew({ id: 'pod', seed: 'dev' }), 'scout', {}, { slot: 'Scout 1', slotNames: [], fileSpec, ledger: L0 });
    let doc = b.doc;
    doc = C.procureOnSave(doc, 'Scout 1', b.envelope.spec, null).doc;                 // the garage signs it (the open signature)
    const A0 = doc.career.airframes['Scout 1'];
    const withPod = Object.assign(clone(b.envelope.spec), { pod: { on: 1 } });
    const Lp = C.buildGen(C.genMigrateSpec(clone(withPod))).parts.ledger;
    const w0 = doc.wallet, r = C.procureOnSave(doc, 'Scout 1', withPod, Lp), A = r.doc.career.airframes['Scout 1'];
    ok(b.ok && A0.factory && A0.anchored && A0.cert, 'a bought Scout (the Cub): factory-certified, signed');
    ok(r.modified && !A.factory && A.modified && A.cert === null && A.withdrawn && A.withdrawn.cert && /certificate is withdrawn/.test(A.withdrawn.why),
       'a pod fitted and saved: MODIFIED - the factory certificate withdrawn (kept struck: "' + (A.withdrawn && A.withdrawn.why) + '")');
    const podLine = r.bill && r.bill.lines.find(l => l.k === 'pod');
    ok(podLine && podLine.cost === Lp.pod.cost && r.bill.cost === C.procureEditBill(A0.ledger, C.procureLedgerOf(Lp)).cost && Math.round(w0 - r.doc.wallet) === r.bill.cost && r.doc.ledger.slice(-1)[0].k === 'edit',
       'billed at build price (dm11), the same door as any edit: ' + r.bill.cost + ' cr (' + r.bill.lines.map(l => l.k + ' ' + l.cost).join(', ') + '), charged as an `edit`');
    const r2 = C.procureOnSave(r.doc, 'Scout 1', b.envelope.spec, L0);
    ok(r2.modified && r2.doc.career.airframes['Scout 1'].cert === null && !(r2.bill.lines.some(l => l.k === 'pod')), 'the pod removed and saved: a change again (the certificate stays withdrawn), the removed line bills nothing');
    const keep = C.procureOnSave(doc, 'Scout 1', clone(b.envelope.spec), null);
    ok(keep.doc === doc && !keep.modified, 'fitted and removed before a save: the spec WITHOUT the key is the signed aeroplane (not modified)');
    ok(C.procureFp(Object.assign(clone(b.envelope.spec), { pod: { on: 0 } })) !== A0.fp, '...which is why the editor REMOVES the key: `{ on: 0 }` is another fingerprint (GARAGE_SPEC.remove)');
    const sand = C.playerDefault ? C.playerDefault() : null;
    ok(sand && !sand.career && C.procureOnSave(sand, 'Scout 1', withPod, Lp).doc === sand && /CAREER_DEV && info\.saved && d\.career/.test(rd('src/viewer/app.js')),
       'the sandbox: no career, nothing withdrawn or billed (procureOnSave hands the document back; app.js asks only under CAREER_DEV)');
  }
  // ---- H7 THE DRAWN POD (the editor's scene headless, tools/_scene_headless.js; the join's own snapshot) ----
  if (X && X.scene) {
    const Sx = X.scene;
    for (const r of Sx.rows) {
      if (r.pod) {
        ok(r.groups === 1 && r.meshes === 1 && r.name === 'edPod' && r.matNames === 'pod' && r.tris > 300, r.k + ' with a pod: one group (cageLayer:pod), ONE mesh (edPod, section `pod`), ' + r.tris + ' triangles');
        ok(r.floorErr < 1e-5 && r.outward && r.topInside >= 0.0199, r.k + ': its floor the physics\' floor (' + n(r.floorErr * 1000, 3) + ' mm), its normals out, its walls ' + n(r.topInside * 100, 1) + ' cm inside the drawn belly');
        ok(r.datumJoin && near(r.datum.zFw, r.datumJoin.zFw, 1e-9) && near(r.datum.yD, r.datumJoin.yD, 1e-9), r.k + ': its datums are the join\'s (zFw ' + n(r.datum.zFw, 4) + ', yD ' + n(r.datum.yD, 4) + ')');
        ok(r.snapPod && r.snapSec === 'pod', r.k + ': the join\'s snapshot (CAGE_VISUAL) carries it as its own bucket, section `pod` (the flown model, the bake, the parked capture)');
        // (the census re-makes the scene on the fake GL's three with the layers' own material classes - the node rig has no
        // livery, so the pod wears its fallback MeshStandardMaterial: at most ONE program of its own, which a build whose
        // scene already carries that key shares. The page's pod wears AEROSKIN's `trim`, the spats' material: the box's
        // program census before / after is the GPU half's - HANDOVER G2675-G2679)
        ok(r.dCalls === r.expectCalls && r.dPrograms <= 1, r.k + ': the pod costs ' + r.dCalls + ' draws (its mesh + its shadow) and ' + r.dPrograms + ' program(s) of its own here (the fake-GL census; the node rig\'s fallback material)');
      } else {
        ok(r.groups === 0 && r.meshes === 0 && !r.podMesh && !r.snapPod && r.dCalls === 0 && r.dPrograms === 0 && r.sameKeys,
           r.k + ' without a pod: NOTHING - no group, no mesh, no material, no snapshot bucket, 0 draws, the same programs');
      }
    }
    rep('the drawn pod: ' + Sx.rows.map(r => r.k + (r.pod ? ' ' + r.dCalls + ' draws, ' + r.tris + ' tris' : ' 0 draws')).join(' · ') + ' (' + Sx.ms + ' ms headless)');
  }
  return { checks, fails, lines };
}

function sources() {
  const vm = require('vm');
  const txt = rd('src/viewer/bench.js');
  return { build: rd('tools/build.js'), app: rd('src/viewer/app.js'), plaqueTxt: rd('src/viewer/plaque.js'), plaque: {},
           benchTxt: txt, bench: B };
}
function benchFrom(txt) {
  const vm = require('vm'), m = { exports: {} };
  vm.runInNewContext(txt, { module: m, exports: m.exports, console, Math, JSON, parseFloat, isFinite, Number, String, Array, Object,
    Infinity, setTimeout, clearTimeout, setInterval, clearInterval, Date, Symbol });
  return m.exports;
}

// ---- the flights -----------------------------------------------------------------------------------------------
function flyAll() {
  if (!FLY && fs.existsSync(FLIGHTS_FILE)) return Promise.resolve(JSON.parse(fs.readFileSync(FLIGHTS_FILE, 'utf8')));
  const queue = [];
  for (const b of ['cub', 'jodel', 'c172']) for (const m of ['off', 'on', 'full']) queue.push([b, m]);
  const out = {}, t0 = Date.now();
  const run = ([b, m]) => new Promise(res => {
    const p = cp.spawn(process.execPath, [path.join(T, '_pod_fly.js'), b, m], { stdio: ['ignore', 'pipe', 'pipe'] });
    let o = '', e = '';
    p.stdout.on('data', x => { o += x; }); p.stderr.on('data', x => { e += x; });
    p.on('close', () => { try { out[b + '_' + m] = JSON.parse(o.trim().split('\n').pop()); } catch (x) { out[b + '_' + m] = { error: (e || o).slice(0, 400) }; } res(); });
  });
  const worker = async () => { while (queue.length) await run(queue.shift()); };
  return Promise.all([0, 1, 2, 3].map(worker)).then(() => {
    out._wallS = Math.round((Date.now() - t0) / 1000);
    fs.mkdirSync(EV_DIR, { recursive: true });
    fs.writeFileSync(FLIGHTS_FILE, JSON.stringify(out));
    return out;
  });
}

// ---- the selftest: the pod's rules broken in their own sources -----------------------------------------------
const DOCTORS = [
  ['the pod billed with it off', 'core', 'const genPodOn = S => !!(S && S.pod && typeof S.pod === \'object\' && +S.pod.on);', 'const genPodOn = S => !!(S && S.pod && typeof S.pod === \'object\');'],
  ['an empty section opened with no pod', 'core', '  let podN = null, podM = null;\n  if (podR) {', '  let podN = null, podM = null;\n  sec(\'pod\');\n  if (podR) {'],
  ['no interference (Q 1.0)', 'core', '  Q: 1.5,\n  crossK', '  Q: 1.0,\n  crossK'],
  ['the drag never reaches the aeroplane', 'core', '    cda.fusCdA[0] += pd.cda;\n', '\n'],
  ['the cross-flow forgotten', 'core', '    cda.fusCdA[1] += pd.crossY; cda.fusCdA[2] += pd.crossZ;', ''],
  ['the three-point attitude level', 'core', "      const b = lowest(deck, gx, ground);", "      const b = lowest(0, gx, ground);"],
  ['the ground at the wheel centre', 'core', '    const ground = S.gear.y - S.gear.contactR;\n    const gx = P.gx;', '    const ground = S.gear.y;\n    const gx = P.gx;'],
  ['the water at the keel', 'core', '    const yW = hw == null ? yK : yK + hw;', '    const yW = yK;'],
  ['the tail strike never reached', 'core', "      const b = lowest(th, gx, ground);\n      rows.push({ id: 'rotation'", "      const b = lowest(0, gx, ground);\n      rows.push({ id: 'rotation'"],
  ['the freight billed as empty weight', 'core', 'podLoad: 1 };', 'podLoadX: 1 };'],
  ['the freight on the shell\'s station', 'core', "sec('podLoad'); onPod(podR.xLoad, podR.loadKg);", "sec('podLoad'); onPod(podR.xShell, podR.loadKg);"],
  ['the rated load off the floor limit', 'core', '  const maxKg = Math.round(GEN_POD.floorLimit * floorM2);', '  const maxKg = Math.round(GEN_POD.floorLimit * floorM2 * 1.5);'],
  ['the mounts\' lever reversed', 'core', '    return [m * (1 - w), m * w];', '    return [m * w, m * (1 - w)];'],
  ['the mounts at the ultimate for the limit', 'core', 'up: kg * g * L, down:', 'up: kg * g * GEN_CERT.ult, down:'],
  ['the CG full walking the wrong way', 'core', 'const m = sh.mass + add, cg = (sh.mass * sh.cgX + add * R.xLoad) / Math.max(1e-6, m);', 'const m = sh.mass + add, cg = (sh.mass * sh.cgX - add * (R.xLoad - 2 * sh.cgX)) / Math.max(1e-6, m);'],
  ['the door off the floor', 'core', 'x0: dc - 0.5 * dl, x1: dc + 0.5 * dl, y0: yBot + wall,', 'x0: dc - 0.5 * dl, x1: dc + 0.5 * dl, y0: yBot + 0.1,'],
  ['the cruise cost off the clamped VCruise', 'core', '      const vWith = v65(0), vWithout = v65(1), Vc = ap0.VClimb || 0;', '      const vWith = def.params.ap.VCruise, vWithout = def.params.ap.VCruise, Vc = ap0.VClimb || 0;'],
  ['the bench passes a strike', 'bench', "if (!(w.clear > 0)) { why.push(", "if (w.clear < -1) { why.push("],
  ['the bench refuses without the number', 'bench', "why.push('it strikes ' + w.name + ' (' + benchNum(w.clear, 2) + ' m)');", "why.push('it strikes ' + w.name);"],
  ['a plaque row unexplained', 'plaque', "  'pod drag': { what:", "  'pod (drag)': { what:"],
  ['the bridge without its door', 'app', 'podToggle: on =>', 'podToggleX: on =>'],
  // BELLY-POD-2 (G2675-G2679)
  ['the volume mapping ignores the shape', 'core', 'const genPodLD = t => GEN_POD_UI.ldAt0 + (GEN_POD_UI.ldAt1 - GEN_POD_UI.ldAt0) * genClamp(+t || 0, 0, 1);', 'const genPodLD = t => 7;'],
  ['the volume mapping past the clamp', 'core', "  const dims = d => ({ len: q(genClamp(ld * d, K.len[0], K.len[1])),", "  const dims = d => ({ len: q(ld * d),"],
  ['the readout\'s red only at a strike', 'core', "    else if (r.clear < GEN_POD.clearWarn) out.red.push(", "    else if (r.clear < -1) out.red.push("],
  ['the readout\'s margin red never', 'core', "    if (out.cgFull.staticMargin < 0) out.red.push(", "    if (out.cgFull.staticMargin < -9) out.red.push("],
  ['the pod\'s nodes at the keel', 'core', '    const top = genPodKeel(ST, x).yb, d = Math.max(0, top - R.yBot), y = top - d * ey, z = GEN_POD_NODE_Z * R.hw;', '    const top = genPodKeel(ST, x).yb, d = Math.max(0, top - R.yBot), y = top, z = GEN_POD_NODE_Z * R.hw;'],
  ['the pod\'s mass left on the rings', 'core', '    onPod(podR.xShell, podR.shellKg);', '    billAt(podR.xShell, podR.shellKg);'],
  ['the hangers undamped to the step (a substep paid)', 'core', 'KM = { noMass: true, kMul: 8, cMul: 0.1 };', 'KM = { noMass: true, kMul: 8 };'],
  ['the pod a wheel', 'core', "    podN = ff.map(q => N(q[0], q[1], q[2], 'POD'));", "    podN = ff.map(q => N(q[0], q[1], q[2], 'POD', 0.05));"],
  ['procure blind to the pod', 'core', "const PROCURE_COSMETIC = ['paint', 'finish', 'meta'];", "const PROCURE_COSMETIC = ['paint', 'finish', 'meta', 'pod'];"],
];
function loadCore(txt) {
  const f = path.join(os.tmpdir(), 'pod_core_' + process.pid + '_' + Math.random().toString(36).slice(2) + '.js');
  fs.writeFileSync(f, txt);
  try { return require(f); } finally { try { fs.unlinkSync(f); } catch (e) {} }
}

// ---- H's witnesses: the no-pod bytes (a process a build) and the drawn pod (the editor's scene headless) ----------
function bytesAll() {
  const queue = Object.keys(BUILDS).map(k => k), out = {};
  const run = k => new Promise(res => {
    const a = [path.join(T, '_pod_bytes.js'), BUILDS[k].file].concat(BUILDS[k].patch ? ['--floats'] : []);
    const p = cp.spawn(process.execPath, a, { stdio: ['ignore', 'pipe', 'pipe'] });
    let o = '', e = '';
    p.stdout.on('data', x => { o += x; }); p.stderr.on('data', x => { e += x; });
    p.on('close', () => { try { out[k] = JSON.parse(o.trim().split('\n').pop()); } catch (x) { out[k] = { error: (e || o).slice(0, 400) }; } res(); });
  });
  const worker = async () => { while (queue.length) await run(queue.shift()); };
  return Promise.all([0, 1, 2, 3].map(worker)).then(() => out);
}
// the editor's scene for a build with and without its pod: the layer's group and mesh, its floor and normals, its walls
// against the drawn belly, the join's datums and snapshot, and a draw / program census of the WHOLE scene on the real
// three over a fake WebGL2 (tools/_fake_gl.js: the scene's meshes re-made on its three, the sun casting shadows)
function sceneAll() {
  const t0 = Date.now();
  const SH = require(path.join(T, '_scene_headless.js')), BJ = require(path.join(T, '_bake_joined.js')), FG = require(path.join(T, '_fake_gl.js'));
  const W = SH.context().ctx;
  const census = scene => {
    const Bt = FG.boot(), T3 = Bt.THREE, sc = new T3.Scene();
    // (the fake GL's three is another realm: its typed arrays are its own - three checks them by instanceof)
    const vmr = require('vm'), TA = n => vmr.runInContext(n, Bt.ctx);
    const own = a => new (TA(a.constructor.name))(a);
    const sun = new T3.DirectionalLight(0xffffff, 1); sun.castShadow = true; sc.add(sun); sc.add(new T3.HemisphereLight());
    scene.updateMatrixWorld(true);
    scene.traverseVisible(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const g = new T3.BufferGeometry();
      for (const a of ['position', 'normal']) if (o.geometry.attributes[a]) g.setAttribute(a, new T3.BufferAttribute(own(o.geometry.attributes[a].array), o.geometry.attributes[a].itemSize));
      if (o.geometry.index) g.setIndex(new T3.BufferAttribute(own(o.geometry.index.array), 1));
      for (const gr of o.geometry.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
      const mats = (Array.isArray(o.material) ? o.material : [o.material]).map(m => {
        const M = (m && T3[m.type] && /Material$/.test(m.type) && !/Shader/.test(m.type)) ? new T3[m.type]() : new T3.MeshStandardMaterial();
        M.side = m ? m.side : 0; M.transparent = !!(m && m.transparent); M.vertexColors = !!(m && m.vertexColors); return M; });
      const mm = new T3.Mesh(g, mats.length > 1 ? mats : mats[0]);
      mm.matrixAutoUpdate = false; mm.matrix.fromArray(o.matrixWorld.elements); mm.frustumCulled = false;
      mm.castShadow = !!o.castShadow; mm.receiveShadow = !!o.receiveShadow; sc.add(mm);
    });
    const cam = new T3.PerspectiveCamera(50, 1, 0.1, 200); cam.position.set(10, 3, 0); cam.lookAt(0, 0, 0);
    Bt.renderer.info.autoReset = false; Bt.renderer.info.reset(); Bt.renderer.render(sc, cam);
    return { calls: Bt.renderer.info.render.calls, keys: Bt.renderer.info.programs.map(q => q.cacheKey).sort() };
  };
  const one = (k, pod) => {
    const j = JSON.parse(rd(BUILDS[k].file)), spec = j.spec || j;
    if (pod) spec.pod = { on: 1 }; else delete spec.pod;
    W.CAGE_POD.fromSpec(spec);
    const b = BJ.bakeJoined(spec);
    const M = W.CAGE_POD_MESH, DJ = W.CAGE_DATUM;
    const snap = W.CAGE_JOIN.snapshot(b.spec);
    const r = { k, pod: !!pod, groups: 0, meshes: 0, podMesh: !!M, snapPod: !!snap.groups.spod, snapSec: snap.mats && snap.mats.spod ? snap.mats.spod.sec : null };
    return { r, M, DJ, b, snap };
  };
  const rows = [];
  // (the context's FIRST build is not its later ones - the layers' lazy first draws: measured 132 meshes, then 144 on
  // the same aeroplane - so one build is thrown away before anything is compared)
  one('cub', false);
  const keys = [['cub', false], ['cub', true], ['c172', true], ['floats', true]];
  for (const [k, pod] of keys) {
    const o = one(k, pod), r = o.r;
    // the scene the layers drew (bakeJoined hangs it under two identity groups; the pod's own root, or the gear's)
    const root = o.b.scene;
    if (root) root.traverse(q => { if (q.name === 'cageLayer:pod') { r.groups++; q.traverse(c => { if (c.isMesh) r.meshes++; }); } });
    if (o.M) {
      const g = o.M.mesh.geometry, pos = g.attributes.position, nrm = g.attributes.normal, R = o.M.R, Dt = o.M.datum;
      r.name = o.M.mesh.name; r.matNames = (o.M.mesh.userData.matNames || []).join(); r.tris = g.index.count / 3;
      let lo = 1e9; for (let i = 0; i < pos.count; i++) lo = Math.min(lo, pos.getY(i));
      r.floorErr = Math.abs(lo - (R.yBot + Dt.yD));
      // outward: every vertex's normal points away from the pod's own axis (the keel line over its middle)
      let outward = true; const yMid = R.yBot + Dt.yD + 0.5 * R.depth;
      for (let i = 0; i < pos.count; i++) { const dx = pos.getX(i), dy = pos.getY(i) - yMid; if (dx * nrm.getX(i) + Math.min(0, dy) * nrm.getY(i) < -1e-6 && Math.abs(dx) + Math.max(0, -dy) > 0.02) { outward = false; break; } }
      r.outward = outward;
      // the walls' top edge against the drawn belly (the gear's airframe probe at the pod's own half-width)
      const AF = W.CAGE_GEAR.AF, Wd = o.M.around; let inside = 1e9;
      for (let v = 0; v < pos.count; v++) { const jj = v % Wd; if (jj !== 0 && jj !== Wd - 1) continue;
        const zc = pos.getZ(v), x = Math.abs(pos.getX(v)); let a0 = 0, a1 = Math.PI / 2, ys;
        if (x >= AF.halfWAt(zc)) ys = AF.surf(zc, a1)[1]; else { for (let q = 0; q < 30; q++) { const m = (a0 + a1) / 2; if (Math.abs(AF.surf(zc, m)[0]) < x) a0 = m; else a1 = m; } ys = AF.surf(zc, (a0 + a1) / 2)[1]; }
        inside = Math.min(inside, pos.getY(v) - ys); }
      r.topInside = inside;
      r.datum = { zFw: Dt.zFw, yD: Dt.yD }; r.datumJoin = o.DJ ? { zFw: o.DJ.zFw, yD: o.DJ.yD } : null;
    }
    // the census NOW (the next build's layers take their groups back out of this scene): the whole scene, and with a
    // pod the same scene with the pod's group hidden - the difference is the pod's own draws and programs
    r.census = census(root);
    if (o.M) { const g = o.M.mesh.parent; g.visible = false; r.censusHidden = census(root); g.visible = true; }
    rows.push(r);
  }
  const cubP = rows.find(r => r.pod && r.k === 'cub');
  for (const r of rows) {
    r.expectCalls = 2;
    if (r.pod) { const ka = new Set(r.censusHidden.keys); r.dCalls = r.census.calls - r.censusHidden.calls; r.dPrograms = r.census.keys.filter(x => !ka.has(x)).length; }
    else {     // the Cub WITHOUT a pod against the Cub WITH one, hidden: the same draws, the same programs
      r.dCalls = r.census.calls - cubP.censusHidden.calls; r.dPrograms = 0;
      r.sameKeys = JSON.stringify(r.census.keys) === JSON.stringify(cubP.censusHidden.keys);
    }
  }
  return { rows, ms: Date.now() - t0 };
}

async function main() {
  if (BLESS_BYTES) {
    const B0 = fs.existsSync(BASE_FILE) ? JSON.parse(fs.readFileSync(BASE_FILE, 'utf8')) : {};
    const by = await bytesAll();
    for (const k in by) { if (by[k].error) throw new Error(k + ': ' + by[k].error); B0[k] = Object.assign({}, B0[k], { bytes: { cert: by[k].cert, sim: by[k].sim, nodes: by[k].nodes } }); }
    fs.writeFileSync(BASE_FILE, JSON.stringify(B0, null, 1) + '\n');
    console.log('blessed the bytes into ' + BASE_FILE + ': ' + Object.keys(by).map(k => k + ' ' + by[k].cert + ' / ' + by[k].sim).join(', '));
    return;
  }
  if (BLESS) {
    const D = fixtures(C0, Object.keys(BUILDS), false);
    fs.writeFileSync(BASE_FILE, JSON.stringify(baseOf(D), null, 1) + '\n');
    console.log('blessed ' + BASE_FILE);
    return;
  }
  const t0 = Date.now();
  const bytesP = bytesAll();                         // H5's witnesses run while the rest is measured
  const F = await flyAll();
  const D = fixtures(C0, Object.keys(BUILDS), true);
  // a REAL certificate of the Cub with the pod full, and without
  let CERT = null;
  if (!SELF || true) {
    const tc = Date.now();
    const def0 = D.cub.def0, def = D.cub.def2;
    CERT = { def0, def, cert0: C0.genCertify(def0), cert: C0.genCertify(def) };
    CERT.s = (Date.now() - tc) / 1000;
  }
  const src = sources();
  const r = runChecks(C0, D, src, F, CERT, false);
  console.log(r.lines.join('\n'));
  const X = { scene: sceneAll(), bytes: await bytesP };
  const r2 = runChecks2(C0, D, X, false);
  console.log(r2.lines.join('\n'));
  r.checks += r2.checks; r.fails += r2.fails;
  if (F && F._wallS) console.log('  (the flights: ' + F._wallS + ' s wall on 4 processes; reports/evidence/POD/flights.json)');
  let selfBad = 0;
  if (SELF) {
    const base = fs.readFileSync(path.join(T, 'flight_core.js'), 'utf8');
    const sub = {}; for (const k of SELF_KEYS) sub[k] = D[k];
    for (const [name, where, from, to] of DOCTORS) {
      let C = C0, s2 = Object.assign({}, src), applied = false, D2 = sub, CERT2 = null;
      try {
        if (where === 'core') {
          if (base.includes(from)) { C = loadCore(base.split(from).join(to)); applied = true; D2 = fixtures(C, SELF_KEYS, false); }
        } else {
          const key = where === 'bench' ? 'benchTxt' : where === 'plaque' ? 'plaqueTxt' : where;
          if (s2[key].includes(from)) { s2[key] = s2[key].split(from).join(to); applied = true; if (where === 'bench') s2.bench = benchFrom(s2.benchTxt); }
        }
      } catch (e) { applied = true; D2 = null; }
      let red = false, nf = 0;
      if (applied && D2) { try { const q = runChecks(C, D2, s2, F, CERT2, true), q2 = runChecks2(C, D2, null, true); red = q.fails + q2.fails > 0; nf = q.fails + q2.fails; } catch (e) { red = true; nf = -1; } }
      else if (applied) red = true;
      if (!red) selfBad++;
      console.log('  selftest ' + (red ? 'caught  ' : 'MISSED  ') + name + (applied ? '' : ' (the anchor is gone)') + (red ? ' (' + (nf < 0 ? 'threw' : nf + ' checks red') + ')' : ''));
    }
    console.log('  selftest: ' + (DOCTORS.length - selfBad) + ' of ' + DOCTORS.length + ' caught');
  }
  console.log('  ' + r.checks + ' checks, ' + r.fails + ' failed (' + Math.round((Date.now() - t0) / 1000) + ' s)');
  const pass = r.fails === 0 && selfBad === 0;
  console.log('GATE POD: ' + (pass ? 'PASS' : 'FAIL'));
  process.exitCode = pass ? 0 : 1;
}
main().catch(e => { console.log(String(e && e.stack || e)); console.log('GATE POD: FAIL'); process.exitCode = 1; });
