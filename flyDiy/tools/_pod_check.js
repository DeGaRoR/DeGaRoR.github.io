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
const SHOW = argv.includes('--show'), SELF = argv.includes('--selftest'), FLY = argv.includes('--fly'), BLESS = argv.includes('--bless');
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
    ok(CERT.def0.beams.length === CERT.def.beams.length && rise.some(v => v > 0), 'the pod full raises the certified envelope at its fittings: ' + rise.map(v => (v >= 0 ? '+' : '') + n(v / 1000, 3) + ' kN').join(', '));
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
  ['an empty section opened with no pod', 'core', '  const podR = genPodResolve(S, ST);\n  if (podR) {', '  const podR = genPodResolve(S, ST);\n  sec(\'pod\');\n  if (podR) {'],
  ['no interference (Q 1.0)', 'core', '  Q: 1.5,\n  crossK', '  Q: 1.0,\n  crossK'],
  ['the drag never reaches the aeroplane', 'core', '    cda.fusCdA[0] += pd.cda;\n', '\n'],
  ['the cross-flow forgotten', 'core', '    cda.fusCdA[1] += pd.crossY; cda.fusCdA[2] += pd.crossZ;', ''],
  ['the three-point attitude level', 'core', "      const b = lowest(deck, gx, ground);", "      const b = lowest(0, gx, ground);"],
  ['the ground at the wheel centre', 'core', '    const ground = S.gear.y - S.gear.contactR;\n    const gx = P.gx;', '    const ground = S.gear.y;\n    const gx = P.gx;'],
  ['the water at the keel', 'core', '    const yW = hw == null ? yK : yK + hw;', '    const yW = yK;'],
  ['the tail strike never reached', 'core', "      const b = lowest(th, gx, ground);\n      rows.push({ id: 'rotation'", "      const b = lowest(0, gx, ground);\n      rows.push({ id: 'rotation'"],
  ['the freight billed as empty weight', 'core', 'podLoad: 1 };', 'podLoadX: 1 };'],
  ['the freight on the shell\'s station', 'core', "sec('podLoad'); billAt(podR.xLoad, podR.loadKg);", "sec('podLoad'); billAt(podR.xShell, podR.loadKg);"],
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
];
function loadCore(txt) {
  const f = path.join(os.tmpdir(), 'pod_core_' + process.pid + '_' + Math.random().toString(36).slice(2) + '.js');
  fs.writeFileSync(f, txt);
  try { return require(f); } finally { try { fs.unlinkSync(f); } catch (e) {} }
}

async function main() {
  if (BLESS) {
    const D = fixtures(C0, Object.keys(BUILDS), false);
    fs.writeFileSync(BASE_FILE, JSON.stringify(baseOf(D), null, 1) + '\n');
    console.log('blessed ' + BASE_FILE);
    return;
  }
  const t0 = Date.now();
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
      if (applied && D2) { try { const q = runChecks(C, D2, s2, F, CERT2, true); red = q.fails > 0; nf = q.fails; } catch (e) { red = true; nf = -1; } }
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
