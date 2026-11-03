// _newplane_lib.js — ONE GENERATED AEROPLANE, JUDGED (NEW-PLANE, 3 Nov 2026). Shared by GATE NEWPLANE (the small
// recurring gate, tools/_newplane_check.js) and the one-time validation (tools/newplane_validate.js, NOT in the
// battery: the user, "I will accept a test once, then small recurring tests. Our battery is already much too heavy").
//
//   const NL = require('./_newplane_lib.js');
//   const r = NL.judge(choices, { hop: true });   // { ok, fails: [..], m: { metrics }, choices, ms }
//
// Each judged build is the chooser's own path: NEW_PLANE_GEN.bake (designBake, the archetypes' recipe) -> the cowl
// preset handed to the cowl layer's birth door -> the page's drawing layers headless + the join (_bake_joined.js, as
// the editor's first build does) -> the joined spec built and shaken down (genShakedown with the loading corners) ->
// the design check's rows -> the stance -> optionally a short hop (the pilot takes off and climbs 60 m).
//
// THE CHECKS (each a named failure):
//   build       designBake and buildGen do not throw; no NaN in the shakedown
//   join        the join measured everything (no error row) and every engine the mount lists was drawn
//   design      the design check has no FAIL row (a WARN is printed, not failed)
//   margin      the static margin is in the green band (5-40 % of MAC, genMarginBand) at the as-drawn loading
//   stance      a tricycle sits level to nose-up (deck -0.5..+3 deg), its nose wheel carries 5-40 % of the weight
//               (GEN_RULES.noseLoad is 0.25: the soft airframe needs it - the textbook 8-15 % is printed beside),
//               its tip-back angle >= 12 deg (the fit aims at 15, which wins over the 0.25 share when they disagree: 5-40 %); a taildragger's three-point deck is 7-17 deg (GEN_RULES.deckMin/Max
//               8-15, a degree of slack each side); prop clearance >= 0.18 m (FAR 23.925: 0.229 on a tailwheel,
//               0.178 on a nose wheel) - floats are judged on the water's own terms and skip it
//   circuit     the shakedown clears it for a circuit (flyableCircuit)
//   hop         (opts.hop) the test pilot lifts off and climbs 60 m above the strip inside 120 s, no NaN
'use strict';
const path = require('path');
const T = __dirname;
let BJ = null, NP = null, C = null, SH = null;
function init() {
  if (BJ) return;
  BJ = require(path.join(T, '_bake_joined.js'));
  BJ.loadPanel();
  NP = require(path.join(T, '_new_plane.js'));
  C = require(path.join(T, 'flight_core.js'));
  SH = require(path.join(T, '_scene_headless.js'));
}
const r2 = v => (v == null || !isFinite(v)) ? null : Math.round(v * 100) / 100;

// the joined spec of one choice set (the editor's first build after Generate)
function joinedOf(choices, opts) {
  init();
  const b = NP.bake(choices);
  const X = SH.context();
  const W = X.ctx;
  // a fresh page load for this build (the layers' starters record, not fire), then the birth's cowl preset
  if (W.CAGE_PAGE && W.CAGE_PAGE.load) { try { W.CAGE_PAGE.load(b.spec); } catch (e) {} }
  if (W.CAGE_COWL_BIRTH_PRESET) W.CAGE_COWL_BIRTH_PRESET(b.cowlPreset);
  let j = BJ.bakeJoined(b.spec);
  // THE STANCE FIT (NEW_PLANE_GEN.stanceFit): the drawn aeroplane read once, the legs moved by the core's rules, and
  // rebuilt only when anything moved - the chooser's own second load (src/viewer/new_plane.js generate)
  let fit = null;
  if (!(opts && opts.fit === false)) {
    for (let pass = 0; pass < NP.FIT_PASSES; pass++) {
      const f = NP.stanceFit(j.spec, null);
      if (!f) break;
      fit = Object.assign(fit || {}, f, { passes: pass + 1 });
      const s2 = JSON.parse(JSON.stringify(j.spec));
      s2.cage = Object.assign({}, s2.cage, f);
      if (W.CAGE_PAGE && W.CAGE_PAGE.load) { try { W.CAGE_PAGE.load(s2); } catch (e) {} }
      j = BJ.bakeJoined(s2);
    }
  }
  return { b, j, fit };
}

function judge(choicesIn, opts) {
  init();
  opts = opts || {};
  const t0 = Date.now();
  const fails = [], m = {};
  const fail = (k, why) => fails.push(k + (why ? ': ' + why : ''));
  let b, j, def, sh;
  let fit = null;
  try { ({ b, j, fit } = joinedOf(choicesIn, opts)); }
  catch (e) { fail('build', String(e && e.message || e).slice(0, 200)); return { ok: false, fails, m, ms: Date.now() - t0 }; }
  const ch = b.choices;
  m.model = b.model; m.cowl = b.cowlPreset; m.fit = fit;
  if (j.errors && j.errors.length) fail('join', j.errors.slice(0, 3).join(' | ').slice(0, 240));
  try { def = C.buildGen(JSON.parse(JSON.stringify(j.spec))); sh = C.genShakedown(def, { corners: true }); }
  catch (e) { fail('build', 'joined spec: ' + String(e && e.message || e).slice(0, 200)); return { ok: false, fails, m, ms: Date.now() - t0, choices: ch }; }
  // engines drawn = engines flown (CONFIG-MATRIX's rule 8): the join flies spec.engines; the layer's units
  try {
    const nFlown = (j.spec.engines || []).length;
    const want = { nose: 1, pusher: 1, wingTop: 1, twin: 2, pushPull: 2, three: 3, four: 4 }[ch.engArch] || 1;
    m.engines = nFlown;
    if (nFlown !== want) fail('join', 'engines flown ' + nFlown + ', the layout wants ' + want);
    if (j.notes && j.notes.some(n => /no engine face|needs a HIGH wing|could not bolt/i.test(n))) fail('join', 'engine not drawn: ' + j.notes.find(n => /engine/i.test(n)));
  } catch (e) {}
  m.empty = r2(sh.empty); m.gross = r2(sh.gross || sh.mass);
  m.Vs = r2(sh.Vs * 3.6); m.TORun = Math.round(sh.TORun || 0); m.climb = r2(sh.climbRate);
  m.sm = r2(sh.staticMargin); m.deck = r2(sh.deckAngle); m.propClear = r2(sh.propClear);
  m.noseOver = r2(sh.noseOver);
  if (![m.empty, m.Vs, m.sm].every(v => v != null)) fail('build', 'non-finite shakedown');
  // the design check
  const dc = sh.design;
  if (dc && dc.rows) {
    const bad = dc.rows.filter(r => r.level === 'fail');
    m.dcWarn = dc.rows.filter(r => r.level === 'warn').map(r => r.id);
    if (bad.length) fail('design', bad.map(r => r.id + '=' + r.value).join(' '));
  }
  // the margin band (as drawn)
  const band = C.genMarginBand ? C.genMarginBand(sh.staticMargin) : null;
  m.band = band && band.band;
  if (band && band.band !== 'green') fail('margin', (100 * sh.staticMargin).toFixed(1) + ' % (' + band.title + ')');
  // the stance
  const S = def.spec || {};
  const gear = j.spec.gear && j.spec.gear.type;
  m.gear = gear;
  if (gear === 'tricycle') {
    if (!(sh.deckAngle >= -0.5 && sh.deckAngle <= 3)) fail('stance', 'tricycle deck ' + m.deck + ' deg (level to nose-up: -0.5..+3)');
    // the nose wheel's share and the tip-back angle, off the built stations and the CG (the shakedown's own frame)
    try {
      const P = def.parts, cg = cgOf(def);
      const xn = P.twX, xm = P.gx;
      const share = (cg[0] - xm) / (xn - xm);
      m.noseShare = r2(share);
      if (!(share >= 0.05 && share <= 0.40)) fail('stance', 'nose wheel carries ' + Math.round(100 * share) + ' % (5-40)');
      const ground = S.gear ? S.gear.y - S.gear.contactR : null;
      if (ground != null) {
        const tb = Math.atan2(Math.abs(xm - cg[0]), cg[1] - ground) * 180 / Math.PI;
        m.tipBack = r2(tb);
        if (tb < 12) fail('stance', 'tip-back angle ' + tb.toFixed(1) + ' deg (>= 12)');
      }
    } catch (e) {}
  } else if (gear === 'taildragger') {
    if (!(sh.deckAngle >= 7 && sh.deckAngle <= 17)) fail('stance', 'three-point deck ' + m.deck + ' deg (7-17)');
  }
  if (gear !== 'floats' && sh.propClear != null && sh.propClear < 0.18) fail('stance', 'prop clearance ' + m.propClear + ' m (>= 0.18)');
  if (!sh.flyableCircuit) fail('circuit', 'climb ' + m.climb + ' m/s, TORun ' + m.TORun + ' m');
  if (opts.hop && !fails.some(f => /^build/.test(f))) {
    const h = hop(def);
    m.hop = h;
    if (!h.ok) fail('hop', h.why);
  }
  return { ok: fails.length === 0, fails, m, choices: ch, ms: Date.now() - t0, spec: opts.keepSpec ? j.spec : undefined };
}
function cgOf(def) {
  let cx = 0, cy = 0, mm = 0;
  for (const n of def.nodes) { cx += n.p[0] * n.m; cy += n.p[1] * n.m; mm += n.m; }
  return [cx / mm, cy / mm];
}
// THE SHORT HOP: settle 5 s, the pilot takes the circuit, judged on lifting off and climbing 60 m within 120 s
function hop(def) {
  const world = C.makeWorld();
  const sim = C.makeSim(def, world);
  sim.reset(0);
  for (let s = 0; s < 300; s++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, world);
  let alt0 = null, maxAlt = -1e9, tOff = null;
  for (let s = 0; s < 120 * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (sim.stats().bad) return { ok: false, why: 'NaN at ' + (s / 60).toFixed(1) + ' s (' + ap.phase + ')' };
    const alt = ap.dbg && ap.dbg.alt;
    if (alt0 == null && alt != null) alt0 = alt;
    if (alt != null) maxAlt = Math.max(maxAlt, alt - alt0);
    if (tOff == null && maxAlt > 3) tOff = s / 60;
    if (maxAlt >= 60) return { ok: true, tOff: r2(tOff), t60: r2(s / 60) };
  }
  return { ok: false, why: tOff == null ? 'no lift-off in 120 s (' + ap.phase + ')' : 'climbed ' + Math.round(maxAlt) + ' m in 120 s' };
}

module.exports = { judge, joinedOf, hop, init, NP: () => (init(), NP) };
