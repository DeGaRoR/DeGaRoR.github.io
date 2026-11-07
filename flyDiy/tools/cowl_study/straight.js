#!/usr/bin/env node
// cowl_study/straight.js - PROPER-COWLS (7 Nov 2026): THE STRAIGHT COWL, as cowl rows, for any build.
//
// The user, 7 Nov: "Every time a session tries to manipulate cowls, it really fails originally. But if we start from much
// simpler geometry, it does a much better job ... the seaplane session, where we worked all the time from the straight
// cowl ... So these are straight cowls that we should design, and see whether we should match them even to the nose of
// planes or not."
//
// THE STRAIGHT COWL is G3915's pod (claude/hull-types _cage_design.js NACELLE_POD) made the rule for every mount: a
// barrel that holds ONE section from the firewall to the propeller (no top-line sweep, no axis rise, no cheeks, no
// cut-out), a short rounded lip onto a flat face round the spinner, and the engine type's openings in that face. Its
// length is the ENGINE's: the face ends where the spinner's base is. Every value is an existing cw_ row.
//
// THREE WAYS TO MEET THE FUSELAGE (the user's question, option pictures):
//   match   the barrel IS the fuselage's nose section, held straight to the face (taper 1, the section the firewall's)
//   blend   the barrel starts as the fuselage's section and runs straight to a ROUND front sized to the engine
//   own     a round barrel sized to the engine, centred on the thrust line, whatever the fuselage is (a part of its own)
// Off the body (a pylon, a wing nacelle) there is no fuselage: every option is `own` there, with the tail cone.
//
//   node tools/cowl_study/straight.js <in.json> <out.json> [--opt=match|blend|own] [--type=auto|flat|rotax|...]
//   const ST = require('./straight.js'); ST.rowsFor(spec, { opt }) -> { over, why }
'use strict';
const fs = require('fs'), path = require('path');
const SH = require('../_scene_headless.js');

// ---- THE SHAPE: the same for every engine and every mount ----------------------------------------------------------
const SHAPE = {
  cw_deckSweep: 0, cw_keelSweep: 0, cw_waistSweep: 0,          // the lines do not bend toward the nose
  cw_lidRise: 0, cw_faceRise: 0,                               // the axis does not rise: the thrust line is the face's
  cw_lobeN: 0, cw_cutSpan: 0,                                  // no cheeks, no horseshoe
  cw_lidMode: 1, cw_lidShoulder: 0.88, cw_lidRound: 0.94,      // a rounded lip onto a flat face, matched to the spinner
  cw_lidGap: 0.008,
  cw_scoopOn: 0,                                               // no chin scoop unless the engine type asks
  cw_oilOn: 0,                                                 // simple: the door is a detail the builder adds
  cw_faceRing: 1,                                              // the face's lift moves the ring only (the lip stays straight)
};
// the lip's radius: a fraction of the front's half-size, within a sensible band (m)
const LIP_K = 0.25, LIP_LO = 0.04, LIP_HI = 0.12;
const CLEAR = 1.06;                       // the cowl over the engine's own envelope (COWL_CLEAR's 6 %)

// ---- THE OPENINGS: the engine type's own, stated at the front's half-size h (min of half-width, half-height) --------
// apMode 0 none, 1 one opening (offsets move it), 2 a pair, 3 both. lipMode 0 a plain cut, 1 a rolled lip.
const FACE = {
  // a boxer: two inlets over the cylinder banks, either side of the spinner (Cessna 172, Jodel, Cherokee)
  flat:     h => ({ cw_apMode: 2, cw_pairX: 0.56 * h, cw_pairW: 0.22 * h, cw_pairH: 0.15 * h, cw_pairY: 0.12 * h,
                    cw_pairSq: 0.7, cw_lipMode: 0 }),
  // a Rotax 9xx: the boxer's pair for the heads' air, and the radiator / oil cooler's mouth under the spinner
  // (Ikarus C42, Zenith 750, Tecnam P92, Bristell) - the mouth is the chin scoop at the face
  rotax:    h => ({ cw_apMode: 2, cw_pairX: 0.56 * h, cw_pairW: 0.18 * h, cw_pairH: 0.13 * h, cw_pairY: 0.10 * h,
                    cw_pairSq: 0.7, cw_lipMode: 0, cw_scoopOn: 1, cw_scoopZ: 0.02, cw_scoopDrop: 0.75, cw_scoopSq: 0.7,
                    cw_scoopRake: 0.1, cw_scoopAp: 0.85, cw_scoopW: 0.30 * h, cw_scoopH: 0.12 * h }),
  // a two-stroke (Rotax 503 / 582): the radiator's mouth under the spinner, nothing else
  twostroke: h => ({ cw_apMode: 0, cw_lipMode: 0, cw_scoopOn: 1, cw_scoopZ: 0.02, cw_scoopDrop: 0.75, cw_scoopSq: 0.7,
                     cw_scoopRake: 0.1, cw_scoopAp: 0.85, cw_scoopW: 0.34 * h, cw_scoopH: 0.14 * h }),
  // an inverted in-line (Gipsy Major, Mikron, Ranger): the cylinders hang under the crank - the air comes in low
  // (Tiger Moth, PT-19, Zlin Trener): a pair, low and close
  inline:   h => ({ cw_apMode: 2, cw_pairX: 0.30 * h, cw_pairW: 0.16 * h, cw_pairH: 0.12 * h, cw_pairY: -0.45 * h,
                    cw_pairSq: 0.7, cw_lipMode: 0 }),
  // a V: a closed face and a chin scoop (Merlin's radiators are elsewhere; Argus / Hirth breathe low)
  vee:      h => ({ cw_apMode: 0, cw_lipMode: 0, cw_scoopOn: 1, cw_scoopZ: 0.3, cw_scoopDrop: 0.8, cw_scoopSq: 0.7,
                    cw_scoopRake: 0.2, cw_scoopAp: 0.85, cw_scoopW: 0.30 * h, cw_scoopH: 0.16 * h }),
  // a radial: the whole face is the inlet - a ring round the spinner, the lip rolled (NACA cowl: Beaver, DC-3)
  radial:   h => ({ cw_apMode: 1, cw_apW: 0.74 * h, cw_apH: 0.74 * h, cw_apSq: 0.5,
                    cw_lipMode: 1, cw_lipThick: 0.05 * h, cw_lipDepth: 0.25 * h, cw_lipRound: 0.75, cw_lipProtrude: 0.6,
                    cw_lipInset: 0.08 * h, cw_ductLen: 0.4 * h }),
  // an electric motor: a closed face, two small slots (Pipistrel Velis)
  electric: h => ({ cw_apMode: 2, cw_pairX: 0.45 * h, cw_pairW: 0.08 * h, cw_pairH: 0.05 * h, cw_pairY: 0,
                    cw_pairSq: 0.9, cw_lipMode: 0 }),
  // a PT6: a closed nose and the intake's lip right behind the propeller, under the spinner (Caravan, Kodiak, PC-12)
  turbine:  h => ({ cw_apMode: 0, cw_lipMode: 0, cw_scoopOn: 1, cw_scoopZ: 0.02, cw_scoopDrop: 0.85,
                    cw_scoopSq: 0.6, cw_scoopRake: 0.2, cw_scoopAp: 0.8, cw_scoopW: 0.42 * h, cw_scoopH: 0.22 * h }),
};

// the engine TYPE the straight cowl dresses: the registry's arch, with the Rotax 9xx and the two-strokes told apart
function typeOf(name, arch) {
  const n = String(name || '').toLowerCase();
  if (/rotax 9/.test(n)) return 'rotax';
  if (arch === 'inline' && /rotax/.test(n)) return 'twostroke';
  return FACE[arch] ? arch : 'flat';
}

// ---- measure a build: the face, the engine's envelope about its thrust line, the flange's distance ----------------
function measure(spec, over) {
  const S = SH.sceneBuild(spec, { over: over || {} });
  const W = S.W, P = S.P;
  const E = W.CAGE_ENG;
  const R = E && E.resolved;
  const env = R && R.env;
  const u0 = E && E.units && E.units[0];
  const face = W.CAGE_COWL_NOSE_FACE ? W.CAGE_COWL_NOSE_FACE(S.built.sheet, S.FS, +P.engMount === 1 ? 'tail' : 'nose') : null;
  const CW = W.COWL_GEN, ax = CW && CW.axisXY ? CW.axisXY() : { x: 0, y: 0 };
  return { S, P, W, ax, env, name: E && E.name, arch: R && R.arch, zFw: E && E.zFw, unit: u0, face,
           mount: Math.round(+P.engMount || 0), errors: S.errors };
}

// ---- the rows ---------------------------------------------------------------------------------------------------
function rowsFor(spec, o) {
  o = o || {};
  const opt = o.opt || 'match';
  const m = measure(spec);
  const P = m.P;
  if (!m.env) return { over: null, why: 'no engine drawn' };
  const type = o.type && o.type !== 'auto' ? o.type : typeOf(m.name, m.arch);
  const env = m.env;
  // the envelope ABOUT THE THRUST LINE (the engine frame's x/y), with the cowl's clearance
  const eW = CLEAR * Math.max(Math.abs(env.x0), Math.abs(env.x1));
  const eUp = CLEAR * Math.max(0, env.y1), eDn = CLEAR * Math.max(0, -env.y0);
  const eR = CLEAR * env.radius;
  const offBody = [2, 3, 5, 6].includes(m.mount);
  const mode = offBody ? 'own' : opt;
  const out = Object.assign({}, SHAPE);
  let aW, aH, front;
  // the thrust line sits at the face's centre plus the engine's own offset (engY); the face's centre is yc
  if (mode === 'match' && m.face) {
    out.fitNose = 1;                                   // the section the fuselage's, every build
    aW = m.face.halfW; aH = m.face.halfH;
    out.cw_taperW = 1; out.cw_taperH = 1;
    front = Math.min(aW, aH);
  } else if (mode === 'blend' && m.face) {
    out.fitNose = 1;
    aW = m.face.halfW; aH = m.face.halfH;
    // the front: round, the engine's (never wider than the firewall, never narrower than the engine)
    const r = Math.max(Math.max(eUp, eDn) * 1.1, 0.82 * Math.min(aW, aH));
    out.cw_taperW = +Math.min(1, Math.max(0.3, r / aW)).toFixed(3);
    out.cw_taperH = +Math.min(1, Math.max(0.3, r / aH)).toFixed(3);
    out.cw_sqFrontTop = 0.5; out.cw_sqFrontBot = 0.5;
    front = r;
  } else {
    // own: round, about the thrust line, the engine's size
    out.fitNose = 0;
    const r = Math.max(0.12, eW, eUp, eDn);
    aW = r; aH = r;
    out.cw_aftW = +aW.toFixed(4); out.cw_aftH = +aH.toFixed(4);
    out.cw_taperW = 1; out.cw_taperH = 1;
    out.cw_deckH = 1; out.cw_keelH = 1; out.cw_waist = 0;
    const sq = 0.5;
    out.cw_sqAftTop = sq; out.cw_sqAftBot = sq; out.cw_sqFrontTop = sq; out.cw_sqFrontBot = sq;
    front = Math.min(aW, aH);
    if (offBody) { out.cw_aftMode = 1; out.cw_tailLen = +Math.max(0.5, 2.2 * aH).toFixed(3); out.cw_tailDrop = 0; }
  }
  // THE LENGTH: the face ends at the spinner's base (the flange + noseOff), the lip inside that
  const lip = Math.max(LIP_LO, Math.min(LIP_HI, LIP_K * front));
  const reach = (m.zFw != null ? -m.zFw : env.length * 1.1) + (+P.cw_noseOff || 0);
  out.cw_lidLen = +lip.toFixed(3);
  out.cw_cowlLen = +Math.max(0.1, Math.min(2, reach - lip)).toFixed(3);
  Object.assign(out, FACE[type](front));
  // CHEEKS WHERE THE HEADS STAND PROUD (the user's own method, G180: "add a couple of lobes for a boxer and tune them
  // until the engine fits"; the PA-18's answer): a boxer wider than a body-sized barrel gets two cheeks over its heads,
  // the overhang + 15 mm, at the heads' station - the barrel stays straight
  if ((type === 'flat' || type === 'rotax') && mode !== 'own') {
    const zE = out.cw_cowlLen + out.cw_lidLen;
    const halfAtHeads = mode === 'blend' ? aW * (1 + (out.cw_taperW - 1) * 0.5) : aW;
    const over = eW - halfAtHeads;
    if (over > 0.002) {
      const zHeads = Math.max(0.05, reach - 0.5 * env.length);
      Object.assign(out, { cw_lobeN: 2, cw_lobeAz: 0, cw_lobeAmp: +Math.min(0.16, over + 0.015).toFixed(3),
                           cw_lobeT: +Math.min(0.9, zHeads / zE).toFixed(3), cw_lobeSig: 28,
                           cw_lobeTSig: +Math.max(0.12, Math.min(0.45, 0.45 * env.length / zE)).toFixed(3) });
    }
  }
  // THE THRUST LINE STAYS WHERE IT IS (the engine, its spinner and the flown thrust line follow the cowl's axis:
  // _cowl_gen axisXY = the axis rise + the face rise + the inlet's offset). The barrel is straight on the face's
  // centre; today's offset of the axis goes into the FACE (the spinner sits off-centre in the flat face, as on a
  // Cessna or a Rotax nose). No flown number moves.
  out.cw_apOffX = +(+m.ax.x || 0).toFixed(4); out.cw_apOffY = 0;
  out.cw_faceRise = +(+m.ax.y || 0).toFixed(4);
  // OFF THE BODY the plate is the engine's own (no fuselage to centre on): the pod is centred on the engine instead -
  // the plate moves by the axis offset (engBlockY, the block's own row) and the face does not rise; the engine stays put
  if (offBody) { out.engBlockY = +((+P.engBlockY || 0) + (+m.ax.y || 0)).toFixed(4); out.cw_faceRise = 0; }
  for (const k of Object.keys(out)) if (typeof out[k] === 'number') out[k] = +out[k].toFixed(4);
  // the match keeps the section the fuselage's: the front's squareness follows the aft's (written after a fitted build)
  return { over: out, why: { type, mode, mount: m.mount, engine: m.name, face: m.face, env: { eW, eUp, eDn, eR }, reach, lip } };
}

// a straight 'match' needs the front section = the fitted aft section: one fitted build, then copy
function finish(spec, over) {
  if (!over || over.fitNose !== 1) return over;
  const m = measure(spec, over);
  const P = m.P, o = Object.assign({}, over);
  if (o.cw_sqFrontTop == null) { o.cw_sqFrontTop = +(+P.cw_sqAftTop).toFixed(3); o.cw_sqFrontBot = +(+P.cw_sqAftBot).toFixed(3); }
  // seal what the body gave: the rows stand as the builder's from here (sealed = the size follows, the section is kept)
  for (const k of ['cw_sqAftTop', 'cw_sqAftBot', 'cw_deckH', 'cw_keelH', 'cw_waist']) o[k] = +(+P[k]).toFixed(4);
  o.fitNose = 2;
  return o;
}

module.exports = { SHAPE, FACE, typeOf, measure, rowsFor, finish };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const pos = argv.filter(a => !a.startsWith('--'));
  const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
  const [IN, OUT] = pos;
  const j = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const spec = j.spec || j;
  const r = rowsFor(spec, { opt: arg('opt', 'match'), type: arg('type', 'auto') });
  if (!r.over) { console.error('straight: ' + r.why); process.exit(1); }
  const over = finish(spec, r.over);
  const s2 = JSON.parse(JSON.stringify(spec));
  s2.cage = Object.assign({}, s2.cage, over);
  fs.writeFileSync(OUT, JSON.stringify(j.spec ? Object.assign({}, j, { spec: s2, name: (j.name || '') + ' straight ' + arg('opt', 'match') }) : s2));
  console.log(JSON.stringify(Object.assign({ out: OUT }, r.why, { face: undefined }, { over })));
}
