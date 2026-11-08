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
const CLEAR = 1.06;
// THE BODY COWL'S FRONT, as fractions of the firewall (the user's fitted cowls: the front's half-height 0.64-0.77 of
// the firewall's on the Cub, Jodel and ugly bi; its half-width 0.79-0.99): never under the engine's own size
const FRONT_H = 0.70, FRONT_W = 0.85;
// THE PLANE'S WAISTLINE AT THE FIREWALL, x the face's half-height. On the nose: the cage's own waist line (waistY, "the
// widest line, y const" - the fuselage's sides end there and the deck begins; the user's fitted C172 sits on it to
// 3 mm). On a pod's aft bulkhead the body has narrowed and its waist is not the cabin's: the middle of the band where
// the section is widest, measured just ahead of the face.
function fuselageWaist(m) {
  const f = m.face, P = m.P;
  if (m.mount !== 1 && P.waistY != null)
    return Math.max(-0.85, Math.min(0.85, (+P.waistY * m.S.FS - f.yc) / f.halfH));
  const GG = m.W.GEAR_GEN, AF = GG && GG.cageAirframe ? GG.cageAirframe(m.S.built.sheet, m.S.FS) : null;
  if (!AF) return 0;
  const zs = f.z + (m.mount === 1 ? 0.06 : -0.06), pts = [];
  for (let k = 0; k < 360; k++) pts.push(AF.surf(zs, -Math.PI + k / 360 * 2 * Math.PI));
  const rows = [];
  for (let t = -0.95; t <= 0.951; t += 0.05) {
    const y = f.yc + t * f.halfH; let w = 0;
    for (const p of pts) if (Math.abs(p[1] - y) < 0.015) w = Math.max(w, Math.abs(p[0]));
    rows.push([t, w]);
  }
  const wMax = Math.max(...rows.map(r => r[1])), band = rows.filter(r => r[1] >= wMax - 0.008).map(r => r[0]);
  return band.length ? Math.max(-0.85, Math.min(0.85, 0.5 * (band[0] + band[band.length - 1]))) : 0;
}                       // the cowl over the engine's own envelope (COWL_CLEAR's 6 %)

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
  const mode = offBody ? 'pod' : opt;
  const T = +m.ax.y || 0;                            // the thrust line about the face's centre (it stays where it is)
  const out = Object.assign({}, SHAPE);
  let aW, aH, front;
  // the thrust line sits at the face's centre plus the engine's own offset (engY); the face's centre is yc
  if (mode === 'waist' && m.face) {
    // THE BODY COWL (the user, 8 Nov): the aft section is the fuselage's at the firewall, its widest line ON THE PLANE'S
    // WAISTLINE; the front is centred on the thrust line, SHRUNK VERTICALLY (the engine is far less tall than the
    // nose) and lifted so its widest line carries the waistline on, level; then narrowed a little; cheeks only after.
    out.fitNose = 1;                                   // the firewall's size and squareness (sealed by finish)
    aW = m.face.halfW; aH = m.face.halfH;
    const wA = fuselageWaist(m);                       // the waist at the firewall, x the face's half-height
    const W = wA * aH;                                 // ... in metres about the face's centre
    const hNeed = Math.max(eUp, eDn) + 0.03;           // the engine about the thrust line, with room
    const hMax = Math.max(hNeed, Math.min(aH - T, aH + T) - 0.01);   // the front inside the firewall's top and bottom
    const h1 = Math.min(hMax, Math.max(hNeed, FRONT_H * aH));
    const a1 = Math.min(aW, Math.max(FRONT_W * aW, eW));
    out.cw_taperW = +(a1 / aW).toFixed(3); out.cw_taperH = +(h1 / aH).toFixed(3);
    out.cw_deckH = 1; out.cw_keelH = 1;
    out._waist = +wA.toFixed(3);
    out.cw_waistF = +Math.max(-0.85, Math.min(0.85, (W - T) / h1)).toFixed(3);
    out.cw_lidRise = +T.toFixed(4);                    // the barrel's axis runs to the thrust line: the front centred on it
    front = Math.min(a1, h1);
  } else if (mode === 'pod') {
    // OFF THE BODY (the user, 8 Nov): straight, sized to the engine, the section the engine's own - a boxer wider than
    // high, an in-line higher than wide and boxy, a V a rounded oval, a radial / motor round, a turboprop round with
    // its chin intake grown into the barrel (a deeper, squarer bottom) rather than bolted on
    out.fitNose = 0;
    const POD = { flat: [0.60, 0.60], rotax: [0.60, 0.60], twostroke: [0.72, 0.72], inline: [0.74, 0.74],
                  vee: [0.58, 0.58], radial: [0.5, 0.5], electric: [0.5, 0.5], turbine: [0.5, 0.66] }[type] || [0.55, 0.55];
    const round = type === 'radial' || type === 'electric' || type === 'turbine';
    const hT = Math.max(0.08, eUp + 0.02), hB = Math.max(0.08, eDn + 0.02), wP = Math.max(0.10, eW + 0.02);
    let h = Math.max(hT, hB);
    aW = round ? Math.max(wP, h) : wP; aH = round ? Math.max(wP, h) : h;
    out.cw_aftW = +aW.toFixed(4); out.cw_aftH = +aH.toFixed(4);
    out.cw_deckH = round ? 1 : +Math.max(0.55, hT / aH).toFixed(3);
    out.cw_keelH = round ? 1 : +Math.max(0.55, hB / aH).toFixed(3);
    if (type === 'turbine') out.cw_keelH = 1.45;      // the chin: the intake's plenum under the gearbox, in the skin
    out.cw_waist = 0;
    out.cw_taperW = 1; out.cw_taperH = 1;
    out.cw_sqAftTop = POD[0]; out.cw_sqFrontTop = POD[0]; out.cw_sqAftBot = POD[1]; out.cw_sqFrontBot = POD[1];
    front = Math.min(aW, aH);
    out.cw_aftMode = 1; out.cw_tailLen = +Math.max(0.5, 2.2 * aH).toFixed(3); out.cw_tailDrop = 0;
  } else if (mode === 'match' && m.face) {
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
  // THE THRUST LINE STAYS WHERE IT IS (the engine, its spinner and the flown thrust line follow the cowl's axis:
  // _cowl_gen axisXY = the axis rise + the face rise + the inlet's offset). The barrel is straight on the face's
  // centre; today's offset of the axis goes into the FACE (the spinner sits off-centre in the flat face, as on a
  // Cessna or a Rotax nose). No flown number moves.
  out.cw_apOffX = +(+m.ax.x || 0).toFixed(4); out.cw_apOffY = 0;
  out.cw_faceRise = mode === 'waist' ? 0 : +(+m.ax.y || 0).toFixed(4);
  // OFF THE BODY the plate is the engine's own (no fuselage to centre on): the pod is centred on the engine instead -
  // the plate moves by the axis offset (engBlockY, the block's own row) and the face does not rise; the engine stays put
  if (offBody) { out.engBlockY = +((+P.engBlockY || 0) + (+m.ax.y || 0)).toFixed(4); out.cw_faceRise = 0; }
  for (const k of Object.keys(out)) if (typeof out[k] === 'number') out[k] = +out[k].toFixed(4);
  // the match keeps the section the fuselage's: the front's squareness follows the aft's (written after a fitted build)
  return { over: out, why: { type, mode, mount: m.mount, engine: m.name, face: m.face, env: { eW, eUp, eDn, eR }, reach, lip } };
}

// a straight 'match' needs the front section = the fitted aft section: one fitted build, then copy
function finish(spec, over, type) {
  if (!over) return over;
  if (over.fitNose !== 1) return fitCheeks(spec, over, type);
  const m = measure(spec, over);
  const P = m.P, o = Object.assign({}, over);
  if (o.cw_sqFrontTop == null) { o.cw_sqFrontTop = +(+P.cw_sqAftTop).toFixed(3); o.cw_sqFrontBot = +(+P.cw_sqAftBot).toFixed(3); }
  // seal what the body gave: the rows stand as the builder's from here (sealed = the size follows, the section is kept)
  for (const k of ['cw_sqAftTop', 'cw_sqAftBot', 'cw_deckH', 'cw_keelH', 'cw_waist']) o[k] = +(+P[k]).toFixed(4);
  if (o._waist != null) { o.cw_waist = o._waist; o.cw_deckH = 1; o.cw_keelH = 1; }
  delete o._waist;
  o.fitNose = 2;
  return fitCheeks(spec, o, type);
}

// CHEEKS WHERE THE HEADS STAND PROUD (the user's own method, G180: "add a couple of lobes for a boxer and tune them
// until the engine fits"; the PA-18's answer): the drawn engine's vertices outside the drawn barrel (clear.js) give
// the cheeks' station, spread, height and size; rebuilt until the engine clears (3 passes at most)
function fitCheeks(spec, o, type) {
  if (type !== 'flat' && type !== 'rotax') return o;
  if (+o.cw_aftMode === 1) return o;                 // a pod is the engine's own size: no cheeks
  const C = require('./clear.js'), THREE = SH.context().THREE;
  o = Object.assign({}, o, { cw_lobeN: 0 });
  for (let pass = 0; pass < 4; pass++) {
    const m = measure(spec, o), c = C.clearance(m.S, THREE);
    if (!c || !c.n || c.worst < 0.002) { o._cheeks = c ? c.worst : null; return o; }
    const CW = m.W.COWL_GEN, zE = CW.zEnd(), P = CW.P;
    const zs = c.pts.map(p => p[2]).sort((a, b) => a - b), ys = c.pts.map(p => p[1]).sort((a, b) => a - b);
    const q = (a, t) => a[Math.floor(t * (a.length - 1))];
    const zMid = 0.5 * (q(zs, 0.05) + q(zs, 0.95)), zSpan = q(zs, 0.95) - q(zs, 0.05), yMid = q(ys, 0.5);
    // the section's parameter whose point sits at the heads' height on the flank
    let az = 0, best = Infinity;
    for (let d = -80; d <= 80; d++) { const p = CW.surfPoint(d * Math.PI / 180, zMid); if (Math.abs(p[1] - yMid) < best) { best = Math.abs(p[1] - yMid); az = d; } }
    if (!+o.cw_lobeN) Object.assign(o, { cw_lobeN: 2, cw_lobeAz: az, cw_lobeSig: 24, cw_lobeAmp: 0,
      cw_lobeT: +(zMid / zE).toFixed(3), cw_lobeTSig: +Math.max(0.08, Math.min(0.6, 0.75 * zSpan / zE)).toFixed(3) });
    o.cw_lobeAmp = +Math.min(0.16, (+o.cw_lobeAmp || 0) + c.worst + 0.012).toFixed(3);
  }
  const c = C.clearance(measure(spec, o).S, THREE); o._cheeks = c ? c.worst : null;
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
  const r = rowsFor(spec, { opt: arg('opt', 'waist'), type: arg('type', 'auto') });
  if (!r.over) { console.error('straight: ' + r.why); process.exit(1); }
  const over = finish(spec, r.over, r.why.type);
  const cheeks = over._cheeks; delete over._cheeks;
  const s2 = JSON.parse(JSON.stringify(spec));
  s2.cage = Object.assign({}, s2.cage, over);
  fs.writeFileSync(OUT, JSON.stringify(j.spec ? Object.assign({}, j, { spec: s2, name: (j.name || '') + ' straight ' + arg('opt', 'match') }) : s2));
  console.log(JSON.stringify(Object.assign({ out: OUT }, r.why, { face: undefined }, { cheeksWorst: cheeks, over })));
}
