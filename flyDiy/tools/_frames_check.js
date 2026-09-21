// GATE FRAMES — THE FUSELAGE FRAMES (T2.1, 2026-09-21)
//
//   node tools/_frames_check.js            -> "GATE FRAMES: PASS|FAIL"
//   node tools/_frames_check.js --record   -> rewrite tools/fixtures/frames_corpus.json
//   node tools/_frames_check.js --selftest -> prove every check can go red
//
// THE CORPUS (recorded at the pre-chantier HEAD 1f07bfcc, before a line of the
// generator moved): the resolved ring table AND the crease-level control mesh
// of the default aeroplane, the page's aeroplane, every archetype card
// (designBake), every saved build under builds/ and bugReports/, and every
// versioned save fixture. A frame row at its default ("follow") must leave all
// of them bit-identical — that is the one promise this chantier makes to every
// past build, and this file is where it is kept.
//
// The other sections (locality, follow round-trip, migration, the pax profile,
// the clamps) are added as the chantier lands them; each is negative-verified
// by --selftest.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const T = __dirname;
const FIX = path.join(T, 'fixtures', 'frames_corpus.json');
const args = process.argv.slice(2);
const RECORD = args.includes('--record');
const SELFTEST = args.includes('--selftest');
const VERBOSE = args.includes('--verbose');

// ---------------------------------------------------------------------------
// the panel, headless (the _parts_check idiom)
// ---------------------------------------------------------------------------
function loadPanel() {
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj {
    constructor() {
      this.children = []; this.position = { set: noop };
      this.rotation = {}; this.scale = { set: noop, setScalar: noop };
    }
    add() { return this; } remove() {} traverse() {}
  }
  global.THREE = new Proxy({}, { get: (t, k) => {
    if (k === 'Vector3')
      return function () { return { set: noop, x: 0, y: 0, z: 0 }; };
    return class extends Obj {};
  } });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js',
    '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    '_cage_gear.js', '_float_gen.js', '_cage_float.js', '_fit_site.js', '_fit_gen.js',
    '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js',
    '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js',
    '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  global.window.CAGE_JOIN_ENGINES =
    require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES;
  return global.window;
}
const W = loadPanel();
const G = require(path.join(T, '_cage_gen.js'));
const D = require(path.join(T, '_cage_design.js'));

const fails = [];
const check = (ok, label, extra) => {
  console.log((ok ? '  ok     ' : '  FAIL   ') + label +
              (ok || !extra ? '' : ' — ' + extra));
  if (!ok) fails.push(label);
  return ok;
};

// ---------------------------------------------------------------------------
// the instruments
// ---------------------------------------------------------------------------
const r9 = v => typeof v === 'number' ? +v.toFixed(9) + 0 : v;   // +0: -0 -> 0
const lvOf = r => {
  const o = {};
  for (const k of Object.keys(r.lv).sort()) {
    const l = r.lv[k]; o[k] = [r9(l.x), r9(l.y), r9(l.z), r9(l.yC), r9(l.zC)];
  }
  return o;
};
const tableOf = S => {
  const R = G.cageResolve(S);
  const out = { rings: R.rings.map(r => ({ n: r.name, lv: lvOf(r) })) };
  if (R.noseTwin) out.noseTwin = lvOf(R.noseTwin);
  if (R.noseRing) out.noseRing = lvOf(R.noseRing);
  if (R.chain) out.chain = JSON.parse(JSON.stringify(R.chain, (k, v) => r9(v)));
  return out;
};
function ringsOf(P) {
  const S = G.cageSpec(P);
  const out = tableOf(S);
  if (S.config && S.config.mirrorAftSpec) out.aft = tableOf(S.config.mirrorAftSpec).rings;
  return { S, out };
}
function meshOf(S) {
  const m = G.buildCage2(S, 'crease');
  const V = m.V || m.verts || m.v;
  const F = m.F || m.faces || m.f;
  const flat = [];
  for (const p of V) flat.push(r9(p[0] != null ? p[0] : p.x), r9(p[1] != null ? p[1] : p.y),
                               r9(p[2] != null ? p[2] : p.z));
  return { nV: V.length, nF: F ? F.length : -1,
           hash: crypto.createHash('sha1').update(JSON.stringify(flat)).digest('hex') };
}
const hashOf = o => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex');

// ---------------------------------------------------------------------------
// the corpus
// ---------------------------------------------------------------------------
const PAGE_BASE = Object.assign({}, G.CAGE_PARAMS,
                                (W.CAGE_PAGE && W.CAGE_PAGE.defaults) || {});
function listFiles(dir, re) {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => re.test(f)).sort().map(f => dir + '/' + f);
}
function corpus() {
  const items = [];
  items.push({ id: 'defaults', P: G.cageDefaults() });
  items.push({ id: 'page', P: Object.assign({}, PAGE_BASE) });
  for (const a of D.ARCHETYPES) {
    let spec;
    try { spec = D.designBake(a.sel, a.over); }
    catch (e) { items.push({ id: 'arch:' + a.name, err: e.message }); continue; }
    items.push({ id: 'arch:' + a.name, P: G.cageFromSpec(spec) });
  }
  const files = [].concat(listFiles('builds', /\.json$/i),
                          listFiles('bugReports', /\.json$/i),
                          listFiles('tools/fixtures', /^build_v.*\.json$/i));
  for (const f of files) {
    let raw;
    try { raw = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); }
    catch (e) { items.push({ id: 'file:' + f, err: 'unreadable: ' + e.message }); continue; }
    const c = raw && (raw.cage || (raw.spec && raw.spec.cage) || (raw.build && raw.build.cage));
    if (!c || typeof c !== 'object') { items.push({ id: 'file:' + f, err: 'no cage' }); continue; }
    items.push({ id: 'file:' + f, P: G.cageFromSpec({ cage: c }) });
  }
  return items;
}
function measure(items) {
  const out = {};
  for (const it of items) {
    if (!it.P) { out[it.id] = { err: it.err }; continue; }
    try {
      const { S, out: rings } = ringsOf(it.P);
      out[it.id] = { rings: hashOf(rings), mesh: meshOf(S), table: rings };
    } catch (e) { out[it.id] = { err: 'resolve threw: ' + e.message }; }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 1 IDENTITY — every corpus item resolves to the recorded rings and mesh
// ---------------------------------------------------------------------------
function firstDiff(a, b) {
  const ra = a.rings || [], rb = b.rings || [];
  if (ra.length !== rb.length) return 'ring count ' + ra.length + ' -> ' + rb.length;
  for (let i = 0; i < ra.length; i++) {
    if (ra[i].n !== rb[i].n) return 'ring ' + i + ' ' + ra[i].n + ' -> ' + rb[i].n;
    for (const k in ra[i].lv) {
      const x = ra[i].lv[k], y = (rb[i].lv || {})[k];
      if (JSON.stringify(x) !== JSON.stringify(y))
        return ra[i].n + '.' + k + ' ' + JSON.stringify(x) + ' -> ' + JSON.stringify(y);
    }
  }
  for (const k of ['noseTwin', 'noseRing', 'chain', 'aft'])
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return k + ' differs';
  return 'identical tables, mesh differs';
}
function checkIdentity(rec, now) {
  let n = 0;
  for (const id of Object.keys(rec)) {
    const a = rec[id], b = now[id];
    if (a.err) continue;                          // recorded as unreadable: not a promise
    if (!b) { check(false, 'IDENTITY ' + id, 'missing from the corpus now'); continue; }
    if (b.err) { check(false, 'IDENTITY ' + id, b.err); continue; }
    const ok = a.rings === b.rings && a.mesh.hash === b.mesh.hash;
    n++;
    if (!ok || VERBOSE)
      check(ok, 'IDENTITY ' + id, ok ? '' : firstDiff(a.table, b.table) +
            ' (mesh ' + a.mesh.nV + '/' + a.mesh.nF + ' -> ' + b.mesh.nV + '/' + b.mesh.nF + ')');
  }
  check(n > 0, 'IDENTITY ' + n + ' corpus items compared');
  return n;
}

// ---------------------------------------------------------------------------
// 2 LOCALITY — each frame row moves its own frame's rings (and the rings that
// interpolate to it) and nothing else; the control cage stays a closed
// 2-manifold, at the fore/aft clamp and at the waist fore/aft too
// ---------------------------------------------------------------------------
const FRAME_RINGS_REF = { fn: null };
const FRAME_RINGS = TAP => FRAME_RINGS_REF.fn ? FRAME_RINGS_REF.fn(TAP) : FRAME_RINGS0(TAP);
const FRAME_RINGS0 = TAP => TAP
  ? { nose: ['noseTwin', 'noseRing'], win: ['wsAft', 'wsFront'], post: ['ring'],
      cab: ['pilCabA', 'pilCabB'], pax: ['pilPaxA', 'pilPaxB'],
      boom: ['pilTaperA', 'pilTaperB'], tail: ['tailCap', 'tailMid', 'tailPost'] }
  : { nose: ['noseTwin', 'noseRing'], win: ['wsAft', 'wsFront'], post: ['ring'],
      cab: ['pilCabA', 'pilCabB'], pax: ['pilPaxB'],
      boom: ['pilPaxA'], tail: ['tailCap', 'tailMid', 'tailPost'] };
// rings that legitimately follow a frame by interpolation
const FOLLOWERS = { pax: /^(pilPaxB\d|pilPaxM\d|paxLoop|crest)/, cab: /^(pilPaxB\d|pilPaxM\d|paxLoop|crest)/,
                    boom: /^(boomMid|aeroAft)/, tail: /^boomMid/, post: /^crest/, win: /^crest/,
                    nose: /^$/ };
function closedManifold(S) {
  const m = G.buildCage2(S, 'crease');
  const eC = new Map();
  for (const fc of m.F) {
    const v = fc.v, n = v.length;
    for (let e = 0; e < n; e++) {
      const a = v[e], b = v[(e + 1) % n];
      if (a === b) continue;
      const k = a < b ? a + '|' + b : b + '|' + a;
      eC.set(k, (eC.get(k) || 0) + 1);
    }
  }
  let open = 0, over = 0;
  for (const c of eC.values()) { if (c === 1) open++; else if (c > 2) over++; }
  let nan = 0;
  for (const p of m.V) if (!isFinite(p[0]) || !isFinite(p[1]) || !isFinite(p[2])) nan++;
  return { open, over, nan, ok: !open && !over && !nan };
}
function ringMap(P) {
  const S = G.cageSpec(P);
  const R = G.cageResolve(S);
  const out = {};
  for (const r of R.rings) out[r.name] = JSON.stringify(lvOf(r));
  if (R.noseTwin) out.noseTwin = JSON.stringify(lvOf(R.noseTwin));
  if (R.noseRing) out.noseRing = JSON.stringify(lvOf(R.noseRing));
  return { S, out };
}
function checkLocality(label, base) {
  const { S: S0, out: R0 } = ringMap(base);
  const TAP = !!(S0.taper && S0.taper.len > 0);
  const FRR = FRAME_RINGS(TAP);
  const man0 = closedManifold(S0);
  check(man0.ok, 'LOCALITY ' + label + ': the base cage is a closed 2-manifold',
        'open ' + man0.open + ' over ' + man0.over + ' nan ' + man0.nan);
  let nRows = 0, bad = [];
  for (const fk of G.CAGE_FRAME_ORDER) {
    const keys = G.CAGE_FRAME_KEYS[fk];
    for (const q in keys) {
      const pk = keys[q];
      if (!/^fr/.test(pk)) continue;                 // a row the frame already had
      if ((fk === 'boom' || fk === 'tail') && S0.rod) continue;   // hidden on a rod
      // a FULL-ROUND top's crown is the arc off the waist: the top width
      // row is inert there by construction (as roofHalfW is), and hidden
      if (q === 'topW' && S0.top && S0.top.round >= 1) continue;
      const isZ = /Z$/.test(pk);
      const def = S0.frames[fk].def[q];
      for (const sgn of [1, -1]) {
        const P = Object.assign({}, base);
        P[pk] = isZ ? sgn * 0.04 : def + sgn * 0.06;
        const { S, out: R } = ringMap(P);
        nRows++;
        const own = FRR[fk], fol = FOLLOWERS[fk];
        const moved = [], stray = [];
        for (const n in R0) {
          if (R[n] === R0[n]) continue;
          if (own.includes(n) || fol.test(n)) moved.push(n); else stray.push(n);
        }
        const ownMoved = own.filter(n => R0[n] != null && R[n] !== R0[n]);
        if (!ownMoved.length) bad.push(pk + (sgn > 0 ? '+' : '-') + ': moved nothing of ' + own.join('/'));
        if (stray.length) bad.push(pk + (sgn > 0 ? '+' : '-') + ': moved ' + stray.join(','));
        const man = closedManifold(S);
        if (!man.ok) bad.push(pk + (sgn > 0 ? '+' : '-') + ': cage open ' + man.open + ' over ' + man.over + ' nan ' + man.nan);
      }
    }
  }
  check(bad.length === 0, 'LOCALITY ' + label + ': ' + nRows + ' row settings each move their own frame only, cage closed',
        bad.slice(0, 6).join('; ') + (bad.length > 6 ? ' (+' + (bad.length - 6) + ')' : ''));
  // the fore/aft CLAMP: a huge shift is held, the cage stays closed
  for (const fk of ['cab', 'pax', 'boom']) {
    const P = Object.assign({}, base);
    P[G.CAGE_FRAME_KEYS[fk].topZ] = 2.0;
    P[G.CAGE_FRAME_KEYS[fk].waistZ] = 1.0;
    const { S, out: R } = ringMap(P);
    const man = closedManifold(S);
    const ring = FRR[fk][0];
    const z0 = JSON.parse(R0[ring]).roof[2], z1 = JSON.parse(R[ring]).roof[2];
    check(man.ok && Math.abs(z1 - z0) < 1.0, 'LOCALITY ' + label + ': ' + fk + ' frame fore/aft clamped on displacement (' +
          (z1 - z0).toFixed(3) + ' m for a 2 m row), cage closed', 'open ' + man.open + ' over ' + man.over);
  }
}

// ---------------------------------------------------------------------------
// 3 FOLLOW — writing a row's resolved value explicitly changes nothing; null
// again changes nothing
// ---------------------------------------------------------------------------
function checkFollow(label, base0) {
  // on the LIFTED file (a base that still carries retired rows would be
  // re-lifted at every resolve and hide the round trip)
  const base = G.cageLiftLegacy(base0);
  const YW = [];
  for (const fk of G.CAGE_FRAME_ORDER)
    for (const q in G.CAGE_FRAME_KEYS[fk]) {
      const pk = G.CAGE_FRAME_KEYS[fk][q];
      if (/^fr/.test(pk) && !/Z$/.test(pk)) YW.push([fk, q, pk]);
    }
  // (a) every row written at its RESOLVED value: nothing moves
  const { S: S0, out: R0 } = ringMap(base);
  const P = Object.assign({}, base);
  for (const [fk, q, pk] of YW) P[pk] = S0.frames[fk].val[q];
  const { out: R1 } = ringMap(P);
  const diff1 = Object.keys(R0).filter(n => R0[n] !== R1[n]);
  check(diff1.length === 0, 'FOLLOW ' + label + ': every frame row written at its resolved value = identical rings', diff1.join(','));
  // (b) every row null, then written at the derived default: nothing moves
  const N = Object.assign({}, base);
  for (const [, , pk] of YW) N[pk] = null;
  const { S: Sn, out: Rn } = ringMap(N);
  const Q = Object.assign({}, N);
  for (const [fk, q, pk] of YW) Q[pk] = Sn.frames[fk].def[q];
  const { out: Rq } = ringMap(Q);
  const diff2 = Object.keys(Rn).filter(n => Rn[n] !== Rq[n]);
  check(diff2.length === 0, 'FOLLOW ' + label + ': every frame row null, then at its default = identical rings', diff2.join(','));
  check(YW.length === 35, 'FOLLOW ' + label + ': 35 height/width rows follow (' + YW.length + ')');
}

// ---------------------------------------------------------------------------
// 4 MIGRATION — the retired rows, lifted, give the rings the old resolver gave
// (the corpus above proves it on the saved files; this proves the lift on a
// synthetic old file per retired key, and that the lift drops the keys)
// ---------------------------------------------------------------------------
function checkMigration(label, base) {
  const old = { ringCabTop: 0.08, ringCabBot: -0.05, ringCabW: 0.04,
                ringWinTop: 0.03, ringWinBot: 0.04, ringWinW: 0.02,
                ringScrBot: -0.03, ringScrW: 0.03, ringNoseTop: 0.05, ringNoseBot: -0.04,
                leanPaxDeg: 12, leanCabDeg: -6, leanPivot: 'floor', taperW: 0.78 };
  const P = Object.assign({}, base, old);
  const lifted = G.cageLiftLegacy(P);
  const left = Object.keys(old).filter(k => lifted[k] != null);
  check(left.length === 0, 'MIGRATION ' + label + ': the lift drops every retired key', left.join(','));
  const set = Object.keys(lifted).filter(k => /^fr/.test(k) && lifted[k] != null && lifted[k] !== 0 && base[k] == null);
  const want = (base.taperOn ? 16 : 13);           // taperW lifts only with a taper
  check(set.length === want, 'MIGRATION ' + label + ': the lift wrote ' + set.length + ' frame rows for 14 retired values (' + want + ' expected)');
  // the lifted rows re-lifted are a fixed point (no second home, no drift)
  const twice = G.cageLiftLegacy(Object.assign({}, lifted, { ringCabTop: 0 }));
  const drift = Object.keys(lifted).filter(k => /^fr/.test(k) && JSON.stringify(lifted[k]) !== JSON.stringify(twice[k]));
  check(drift.length === 0, 'MIGRATION ' + label + ': a lifted file re-lifted is a fixed point', drift.join(','));
  // and the old resolver, when its source is beside us, agrees
  const oldSrc = path.join(T, 'fixtures', 'frames_legacy_rings.json');
  if (fs.existsSync(oldSrc)) {
    const want = JSON.parse(fs.readFileSync(oldSrc, 'utf8'))[label];
    if (want) {
      const { out: R } = ringMap(P);
      // the passenger RUN's intermediate rings are allowed to differ: the
      // run now lerps to the cabin FRAME (the old lerp went to the bare
      // cabin section and stepped at a moved pillar pair) — no saved
      // build has both a cabin offset and two bays
      const diff = Object.keys(want).filter(n => want[n] !== R[n] && !/^(pilPaxB\d|pilPaxM\d)/.test(n));
      check(diff.length === 0, 'MIGRATION ' + label + ': lifted rings = the pre-chantier resolver\'s (' + Object.keys(want).length + ' rings; the run may re-lerp)', diff.join(','));
    }
  }
}

// ---------------------------------------------------------------------------
// 5 THE PAX PROFILE — straight is the old lerp; the curve bends only the run
// ---------------------------------------------------------------------------
function checkProfile(label, base) {
  const P3 = Object.assign({}, base, { paxCount: 3, paxLen: 0.8 });
  const { out: R0 } = ringMap(P3);
  const { out: Rs } = ringMap(Object.assign({}, P3, { frPaxProfile: 0, frPaxEase: 1, frPaxBias: 1, frPaxBulgeH: 0.2 }));
  check(Object.keys(R0).every(n => R0[n] === Rs[n]), 'PROFILE ' + label + ': straight ignores the curve rows (identity)');
  for (const over of [{ frPaxEase: 1 }, { frPaxBias: 1 }, { frPaxBias: -1 }, { frPaxBulgeH: 0.2 }, { frPaxBulgeW: -0.2 }, { frPaxBulgeH: -0.2, frPaxLoops: 2 }]) {
    const { S, out: R } = ringMap(Object.assign({}, P3, { frPaxProfile: 1 }, over));
    const moved = Object.keys(R0).filter(n => R0[n] !== R[n]);
    const stray = moved.filter(n => !/^(pilPaxB\d|pilPaxM\d|paxLoop)/.test(n));
    const man = closedManifold(S);
    check(moved.length > 0 && stray.length === 0 && man.ok,
          'PROFILE ' + label + ' ' + JSON.stringify(over) + ': bends ' + moved.length + ' run rings only, cage closed',
          'stray ' + stray.join(',') + ' open ' + man.open + ' over ' + man.over);
  }
  // one bay: the curve is inert without loops, present with them
  const P1 = Object.assign({}, base, { paxCount: 1 });
  const { out: A } = ringMap(P1);
  const { out: B } = ringMap(Object.assign({}, P1, { frPaxProfile: 1, frPaxBulgeH: 0.2 }));
  const { out: C } = ringMap(Object.assign({}, P1, { frPaxProfile: 1, frPaxBulgeH: 0.2, frPaxLoops: 1 }));
  check(Object.keys(A).every(n => A[n] === B[n]) && Object.keys(C).some(n => /^paxLoop/.test(n)),
        'PROFILE ' + label + ': one bay — inert without loops, a former loop with them');
}

// ---------------------------------------------------------------------------
if (RECORD) {
  const items = corpus();
  const m = measure(items);
  let head = '?';
  try { head = require('child_process').execSync('git rev-parse --short HEAD',
    { cwd: ROOT }).toString().trim(); } catch (e) { /* not a repo */ }
  fs.writeFileSync(FIX, JSON.stringify({ recordedAt: new Date().toISOString(), head,
    items: m }, null, 1).replace(/\r\n/g, '\n') + '\n');
  const n = Object.values(m).filter(x => !x.err).length;
  console.log('recorded ' + n + ' items (' + Object.keys(m).length + ' listed) -> ' + path.relative(ROOT, FIX));
  for (const id in m) if (m[id].err) console.log('  skipped ' + id + ': ' + m[id].err);
  process.exit(0);
}

const REC = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const NOW = measure(corpus());
if (SELFTEST) {
  // a doctored recording must go red: bump one ring in the fixture
  const id = Object.keys(REC.items).find(k => !REC.items[k].err);
  const doctored = JSON.parse(JSON.stringify(REC.items));
  doctored[id].rings = 'x' + doctored[id].rings;
  const before = fails.length;
  checkIdentity(doctored, NOW);
  const red = fails.length > before;
  fails.length = before;
  check(red, 'SELFTEST identity goes red on a doctored fixture');
}
checkIdentity(REC.items, NOW);
const BASES = {
  page: Object.assign({}, PAGE_BASE),
  taper3: Object.assign({}, PAGE_BASE, { taperOn: 1, taperLen: 0.7, paxCount: 3, paxLen: 0.8 }),
  box: Object.assign({}, PAGE_BASE, { topRound: 0, botRound: 0, bubble: 0, paxCount: 2 }),
};
if (SELFTEST) {
  const before = fails.length;
  // a resolver that moved the wrong ring would fail LOCALITY: prove by
  // claiming the cabin frame owns the tail cap (it must then "move nothing")
  const savedFR = FRAME_RINGS0;
  const doctored = TAP => { const t = savedFR(TAP); t.cab = ['tailCap']; return t; };
  FRAME_RINGS_REF.fn = doctored;
  checkLocality('selftest', BASES.page);
  FRAME_RINGS_REF.fn = null;
  const red = fails.length > before;
  fails.length = before;
  check(red, 'SELFTEST locality goes red on a row the resolver does not read');
}
for (const id in BASES) {
  checkLocality(id, BASES[id]);
  checkFollow(id, BASES[id]);
  if (id !== 'box') checkMigration(id, BASES[id]);
}
checkProfile('page', BASES.page);

if (fails.length) {
  console.log('GATE FRAMES: FAIL (' + fails.length + ')');
  process.exit(1);
}
console.log('GATE FRAMES: PASS');
