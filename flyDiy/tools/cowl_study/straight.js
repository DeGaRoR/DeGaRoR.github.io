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
  // (h the front's smaller half-size, a its half-width, v its half-height: the pair sits over the banks, in the width)
  flat:     (h, a, v) => ({ cw_apMode: 2, cw_pairX: 0.58 * a, cw_pairW: 0.20 * a, cw_pairH: 0.22 * v, cw_pairY: 0.10 * v,
                    cw_pairSq: 0.7, cw_lipMode: 0,
                    // the carburettor's intake under the nose (the user's Cub and C172 carry one)
                    cw_scoopOn: 1, cw_scoopZ: 0.05, cw_scoopSq: 0.55, cw_scoopRake: 0.1, cw_scoopAp: 0.7,
                    cw_scoopW: 0.16 * a, cw_scoopH: 0.12 * v }),
  // a Rotax 9xx: the boxer's pair for the heads' air, and the radiator / oil cooler's mouth under the spinner
  // (Ikarus C42, Zenith 750, Tecnam P92, Bristell) - the mouth is the chin scoop at the face
  rotax:    (h, a, v) => ({ cw_apMode: 2, cw_pairX: 0.58 * a, cw_pairW: 0.17 * a, cw_pairH: 0.18 * v, cw_pairY: 0.08 * v,
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
  const m = { S, P, W, ax, env, name: E && E.name, arch: R && R.arch, zFw: E && E.zFw, unit: u0, face,
              mount: Math.round(+P.engMount || 0), errors: S.errors, cyl: R && R.cyl };
  // the drawn exhaust's way out, in the face's frame (x, y about its centre, z forward of it)
  const ex = E && E.exhaustAt;
  if (ex && face) m.exhaust = { x: ex[0], y: ex[1] - face.yc, z: (+P.engMount === 1 ? -1 : 1) * (ex[2] - face.z) };
  m.verts = drawnEngine(m);
  m.drawn = drawnReach(m);
  m.bumps = (aW, zE) => radialBumps(m, aW, zE);
  return m;
}

// THE DRAWN ENGINE, in its unit's own frame (x a side, y up from the propeller's line, z forward from the flange):
// every vertex of the first unit's engine (the spinner, the shaft and the blades aside)
function drawnEngine(m) {
  const THREE = SH.context().THREE;
  let eng = null;
  m.S.scene.traverse(o => { if (o.name === 'cageLayer:eng') eng = o; });
  if (!eng || !eng.children.length) return [];
  eng.updateMatrixWorld(true);
  const ug = eng.children[0], inv = new THREE.Matrix4().copy(ug.matrixWorld).invert(), v = new THREE.Vector3(), out = [];
  // the engine's own mesh only (its group is named edEng); the spinner, the shaft and the blades (which on a set-back
  // spinner sit behind the flange) are not the engine
  const walk = (o, f) => { if (/^ed(Spinner|Prop)/.test(o.name || '')) return; f(o); for (const c of o.children) walk(c, f); };
  walk(ug, o => {
    if (!o.isMesh) return;
    const pa = o.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i); o.localToWorld(v); v.applyMatrix4(inv); out.push([v.x, v.y, v.z]); }
  });
  return out;
}
// how far the drawn engine reaches up and to the side between the plate and the flange (the envelope misses the top
// hardware - 6 cm on an O-320, 13 cm on a Rotax 915); what hangs below (the exhaust stubs) is left to leave the pod
function drawnReach(m) {
  const z0 = m.env ? m.env.z0 - 0.01 : -1;               // the engine's own body: its back to the flange
  let up = 0, w = 0, upFront = 0, wFront = 0;
  const zMid = m.env ? 0.5 * m.env.z0 : -0.3;
  for (const [x, y, z] of m.verts) {
    if (z < z0 || z > -0.005) continue;                  // the mount (the plate takes the pod's size) and the flange aside
    if (y > up) up = y;
    if (z > zMid && y > upFront) upFront = y;            // the front half: what the cowl's front must clear
    if (y > -0.05 && Math.abs(x) > w) w = Math.abs(x);
    if (z > zMid && y > -0.05 && Math.abs(x) > wFront) wFront = Math.abs(x);
  }
  return { up, w, upFront, wFront };
}
// ONE HELMET OVER EACH CYLINDER (the user: "check with the engine where the pistons would be placed, generate the
// little bumps there and reduce the overall diameter"): the drawn heads are the vertices far out from the crank; their
// count is the engine's, their phase the drawn one's (the circular mean of n x their azimuth), their station along the
// cowl theirs; the barrel is cut to 0.84 of the heads' radius and each helmet stands 12 mm over its head
function radialBumps(m, aW, zE) {
  const V = m.verts;
  if (!V.length || !(m.cyl >= 3)) return {};
  // the heads: the engine's own enclosing radius (the drawn collector ring and the pipes reach past it)
  const rMax = m.env.radius;
  const heads = V.filter(([x, y, z]) => { const r = Math.hypot(x, y); return r > 0.82 * rMax && r < 1.03 * rMax && z > m.env.z0 - 0.01; });
  if (heads.length < 8) return {};
  const n = Math.min(14, Math.round(m.cyl));
  let sc = 0, cc = 0, zs = 0;
  for (const [x, y, z] of heads) { const a = Math.atan2(y, x); sc += Math.sin(n * a); cc += Math.cos(n * a); zs += z; }
  const phase = Math.atan2(sc, cc) / n * 180 / Math.PI;
  const zH = zs / heads.length - (m.zFw || 0);               // the heads' station, forward of the plate
  const zSd = Math.sqrt(heads.reduce((a, h) => a + Math.pow(h[2] - zs / heads.length, 2), 0) / heads.length);
  return { cw_lobeN: n, cw_lobeAz: +(((phase % 360) + 360) % (360 / n)).toFixed(1),
           cw_lobeAmp: +Math.min(0.16, Math.max(0, rMax + 0.012 - aW)).toFixed(3),
           cw_lobeSig: +Math.max(6, Math.min(40, 0.32 * 360 / n)).toFixed(1),
           cw_lobeT: +Math.max(0.05, Math.min(0.95, zH / zE)).toFixed(3),
           cw_lobeTSig: +Math.max(0.08, Math.min(0.6, 2.2 * zSd / zE)).toFixed(3) };
}

// THE FIREWALL'S SECTION, FITTED (the user, 8 Nov: "take the roundness top, the roundness bottom, and then also the
// creasing of the nose into account"): the fuselage's measured width by height just behind the face, against the cowl
// section's own law (|x/a|^n + |(y - waist)/h|^n = 1, a half each side of the widest line); the waist and the two
// roundnesses that fit it best. A flat-sided box fits many waists equally: the tie goes to the plane's waistline (the
// cage's waistY on a nose) - a round-topped cabin (topRound) is fitted where it really is widest.
function aftSection(m, opt) {
  const f = m.face, P = m.P, CW = m.W.COWL_GEN;
  const GG = m.W.GEAR_GEN, AF = GG && GG.cageAirframe ? GG.cageAirframe(m.S.built.sheet, m.S.FS) : null;
  const wCage = (m.mount !== 1 && P.waistY != null) ? Math.max(-0.85, Math.min(0.85, (+P.waistY * m.S.FS - f.yc) / f.halfH)) : null;
  if (!AF) return { waist: wCage || 0, sqTop: 0.55, sqBot: 0.55 };
  const zs = f.z + (m.mount === 1 ? 0.05 : -0.05), pts = [];
  for (let k = 0; k < 720; k++) pts.push(AF.surf(zs, -Math.PI + k / 720 * 2 * Math.PI));
  const prof = [];
  for (let t = -0.9; t <= 0.901; t += 0.05) {
    const y = f.yc + t * f.halfH; let w = 0;
    for (const p of pts) if (Math.abs(p[1] - y) < 0.012) w = Math.max(w, Math.abs(p[0]));
    if (w > 0) prof.push([t, w / f.halfW]);
  }
  // (wT / wB: the width at the top / bottom line, x the widest - CABIN-CRAFT's rows, the sides a trapezoid)
  const model = (t, wv, nT, nB, wT, wB) => {
    const up = t >= wv, h = up ? 1 - wv : 1 + wv, r = Math.min(1, Math.abs(t - wv) / Math.max(h, 1e-3)), n = up ? nT : nB;
    const k = 1 + ((up ? wT : wB) - 1) * r;
    return k * Math.pow(Math.max(0, 1 - Math.pow(r, n)), 1 / n);
  };
  // THE WAISTLINE RULE FIRST: a flat-sided nose keeps the plane's waistline (the user: "matching the height of the
  // waistline ... allows the cowl to enlarge where it should"); a round-topped cabin (topRound >= 0.5) is widest lower
  // than its waistY says, and is fitted - as is a pusher's aft face. The roundness above and below is always fitted.
  const fixW = !(opt && opt.free) && wCage != null && (+P.topRound || 0) < 0.5 ? wCage : null;
  let best = null;
  const W0 = fixW != null ? [fixW] : []; if (fixW == null) for (let wv = -0.8; wv <= 0.801; wv += 0.05) W0.push(wv);
  const WS = opt && opt.width ? [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1] : [1];
  // each half fits on its own side of the waist: top (sq, w) and bottom (sq, w) separably, for each waist
  const half = (wv, up) => {
    let b = null;
    for (let sq = 0.35; sq <= 0.951; sq += 0.05) for (const wk of WS) {
      const n = CW.sqExp(sq); let e = 0;
      for (const [t, w] of prof) if ((t >= wv) === up) e += Math.pow(model(t, wv, n, n, wk, wk) - w, 2);
      if (!b || e < b.e) b = { e, sq, w: wk };
    }
    return b;
  };
  for (const wv of W0) {                             // the user's own fits: roundness 0.35-0.6
    const T = half(wv, true), B = half(wv, false), e = (T.e + B.e) / Math.max(1, prof.length);
    if (!best || e < best.e) best = { e, waist: wv, sqTop: T.sq, sqBot: B.sq, wTop: T.w, wBot: B.w };
  }
  // the error as an RMS of the half-width, in millimetres
  return { waist: +best.waist.toFixed(3), sqTop: +best.sqTop.toFixed(2), sqBot: +best.sqBot.toFixed(2), wTop: best.wTop, wBot: best.wBot,
           err: best.e, rmsMM: +(Math.sqrt(best.e) * f.halfW * 1000).toFixed(1), cage: wCage };
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
  // THE PROPELLER'S LINE about the face's centre: the cowl's axis AND the engine's own offset (engY - the Tiger Moth
  // carries 0.21 m of it, so its spinner stood over the cowl's ring). The straight cowl folds engY into its axis
  // (engY 0, the axis the propeller's): the engine and the flown thrust line stay exactly where they were.
  // o.lower (m, a study option): the engine LOWERED by that much - that one moves the flown thrust line.
  const engY0 = +P.engY || 0, lower = +o.lower || 0;
  const T = (+m.ax.y || 0) + engY0 - lower;
  // the drawn engine about the propeller's line (its envelope, raw: up above the shaft, dn below, w a side)
  const up = Math.max(0, env.y1), dn = Math.max(0, -env.y0), wE = Math.max(Math.abs(env.x0), Math.abs(env.x1));
  const D = m.drawn || {};                           // the drawn mesh's own reach where it exceeds the envelope (pods)
  const out = Object.assign({}, SHAPE);
  let aW, aH, front, frontW = null, frontH = null, cE = T;
  const narrow = type === 'inline' || type === 'twostroke' || m.mount === 1;
  if (mode === 'waist' && m.face) {
    // THE BODY COWL (the user, 8 Nov): the firewall's section, its widest line ON THE PLANE'S WAISTLINE; the front
    // centred on the ENGINE (its own box, so an inverted in-line keeps its spinner high in the face), shrunk
    // vertically and lifted so the widest line carries on level; narrowed a little (an in-line or a pusher: toward the
    // engine - the user's busher 0.62); cheeks only after.
    out.fitNose = 2;                                   // sealed: the firewall's size, the section these rows
    aW = m.face.halfW; aH = m.face.halfH;
    const sec = aftSection(m);                         // the waist and the roundness the fuselage has at the firewall
    const W = sec.waist * aH;
    // the engine's own box: its envelope, and above the shaft whatever the drawing carries over its front half (an
    // inverted in-line's induction rides on top - G164); a hump further aft is the blister's (fitCheeks)
    const upB = Math.max(up, D.upFront || 0);
    cE = T + 0.5 * (upB - dn);                         // the engine's own box centre
    const hE = 0.5 * CLEAR * (upB + dn) + 0.03;
    const hMax = Math.max(hE, Math.min(aH - cE, aH + cE) - 0.01);
    const h1 = Math.min(hMax, Math.max(hE, (type === 'inline' ? 0.6 : FRONT_H) * aH));
    let a1 = narrow ? Math.min(aW, Math.max(CLEAR * Math.max(wE, D.wFront || 0) + 0.02, 0.45 * aW))
                    : Math.min(aW, Math.max(FRONT_W * aW, CLEAR * wE));
    let hF = h1;
    if (type === 'radial') {
      // A RADIAL ON THE BODY: the front is round, the engine's (0.84 of its heads' radius - the helmets carry the
      // heads), centred on the propeller; a nose smaller than that bulges to it, to the row's own 1.15 and no further
      const rF = 0.84 * CLEAR * env.radius;
      a1 = Math.min(1.15 * aW, rF); hF = Math.min(1.15 * aH, rF); cE = T;
      out._radialFront = rF;
      if (rF > 1.15 * Math.min(aW, aH)) out._note = 'the nose is smaller than this radial: the front stops at 1.15 x the firewall';
    }
    out.cw_taperW = +(a1 / aW).toFixed(3); out.cw_taperH = +(hF / aH).toFixed(3);
    out.cw_deckH = 1; out.cw_keelH = 1;
    out.cw_waist = +sec.waist.toFixed(3);
    out.cw_sqAftTop = sec.sqTop; out.cw_sqAftBot = sec.sqBot;
    // the front keeps the fuselage's roundness; an in-line's is the boxy pod's (the user: "start from" it)
    const fSq = type === 'inline' ? 0.74 : type === 'radial' ? 0.5 : null;
    out.cw_sqFrontTop = fSq != null ? fSq : sec.sqTop; out.cw_sqFrontBot = fSq != null ? fSq : sec.sqBot;
    out.cw_waistF = type === 'radial' ? 0 : +Math.max(-0.85, Math.min(0.85, (W - cE) / hF)).toFixed(3);
    front = Math.min(a1, hF); frontW = a1; frontH = hF;
    out._sec = sec;
    // V5 (the user, 8 Nov): THE BOTTOM ROUNDS - it leaves the firewall level (the fuselage's bottom carried on) and
    // rounds up into the face, a quarter-ellipse (round B: the bend from 95 % of the barrel, level for 45 % of it,
    // arriving 0.9 full - "much better for the Cessna, almost the best shape we ever got")
    // (a radial's cowl is the round NACA barrel, the approved shape: none of the nose's bends, drop or ramp)
    if (type !== 'radial') { out.cw_keelSweep = 0.95; out.cw_keelShoulder = 0.45; out.cw_keelRound = 0.9; }
    // THE TOP DESCENDS A LITTLE - "a little taper ... so that you come and kiss better the top of the prop": the deck
    // bends from the firewall, gently (carries the barrel for 60 %, arrives 0.7 full)
    if (type !== 'radial') { out.cw_deckSweep = 0.95; out.cw_deckShoulder = 0.6; out.cw_deckRound = 0.7; }
    else { out.cw_keelSweep = 0; out.cw_deckSweep = 0; }
    // THE BOTTOM SITS LOWER THAN THE FIREWALL'S (vertical only: the cooling air's way out), HELD to the bottom's bend
    // ("hold is better than fade"); sized to the engine - the user's Cub sits 7.9 cm under its firewall (0.24 of the
    // half-height, an A-65 at 70 hp), the Jodel 8.7, the C172 1.9 (0.04 at 159 hp): 0.24 at 70 hp to 0.04 at 160 and up
    if (m.mount === 0 && type !== 'electric' && type !== 'turbine' && type !== 'radial') {
      const hp = +(m.W.CAGE_ENG && m.W.CAGE_ENG.resolved && m.W.CAGE_ENG.resolved.powerHP) || 100;
      const k = 0.24 + (0.04 - 0.24) * Math.max(0, Math.min(1, (hp - 70) / 90));   // the user's A-65s (70 hp) 0.24, their 159 hp C172 0.04
      out.cw_exitGap = +Math.max(0.015, Math.min(0.08, k * aH)).toFixed(3);
      out.cw_exitHold = 1; out.cw_exitSpan = 150; out.cw_exitLen = 0.4;
      // THE EXHAUST'S FAIRED RAMP where the drawn exhaust leaves (its azimuth, to 10 cm past the exit)
      const ex = m.exhaust;
      if (ex && ex.y < 0) {
        const az = ((Math.atan2(ex.y - 0.5 * T, ex.x) * 180 / Math.PI) + 360) % 360;
        out.cw_exCut = 2; out.cw_exCutAz = +Math.max(200, Math.min(340, az)).toFixed(0);
        out.cw_exCutSpan = 46; out.cw_exRampH = +Math.max(0.025, Math.min(0.06, 0.1 * aH)).toFixed(3);
        out.cw_exCutLen = +Math.max(0.1, Math.min(0.35, ex.z + 0.1)).toFixed(3);
      }
    }
    // THE CHIN SCOOP rides the bottom line (scoopFollow): its top a third of its height inside the skin all along
    if (out.cw_scoopOn) out.cw_scoopFollow = 1;
  } else if (mode === 'pod') {
    // OFF THE BODY (the user, 8 Nov): straight, sized to the DRAWN engine (its top hardware, its sides; exhaust stubs
    // may leave underneath), the section the engine's own - a boxer wider than high, an in-line higher than wide and
    // boxy, a V a rounded oval, a radial round with a helmet over each cylinder, a motor round, a turboprop round with
    // its chin grown into the barrel
    out.fitNose = 0;
    const POD = { flat: [0.60, 0.60], rotax: [0.60, 0.60], twostroke: [0.72, 0.72], inline: [0.74, 0.74],
                  vee: [0.58, 0.58], radial: [0.5, 0.5], electric: [0.5, 0.5], turbine: [0.5, 0.66] }[type] || [0.55, 0.55];
    const round = type === 'radial' || type === 'electric' || type === 'turbine';
    const upD = Math.max(up, D.up || 0), wD = type === 'turbine' ? wE : Math.max(wE, D.w || 0);   // a PT6's stacks pierce the skin
    let hT = Math.max(0.08, upD + 0.025), hB = Math.max(0.08, dn + 0.02), wP = Math.max(0.10, wD + 0.025);
    if (type === 'radial') { const r = 0.84 * CLEAR * env.radius; hT = hB = wP = Math.max(r, 0.12); }   // the helmets carry the heads
    const h = Math.max(hT, hB);
    aW = round ? Math.max(wP, h) : wP; aH = round ? Math.max(wP, h) : h;
    out.cw_aftW = +aW.toFixed(4); out.cw_aftH = +aH.toFixed(4);
    out.cw_deckH = round ? 1 : +Math.max(0.55, hT / aH).toFixed(3);
    out.cw_keelH = round ? 1 : +Math.max(0.55, hB / aH).toFixed(3);
    if (type === 'turbine') out.cw_keelH = 1.45;      // the chin: the intake's plenum under the gearbox, in the skin
    out.cw_waist = 0;
    out.cw_taperW = 1; out.cw_taperH = 1;
    out.cw_sqAftTop = POD[0]; out.cw_sqFrontTop = POD[0]; out.cw_sqAftBot = POD[1]; out.cw_sqFrontBot = POD[1];
    front = Math.min(aW, aH); frontW = aW; frontH = aH;
    out.cw_aftMode = 1; out.cw_tailLen = +Math.max(0.5, 2.2 * aH).toFixed(3); out.cw_tailDrop = 0;
  } else if (mode === 'match' && m.face) {
    out.fitNose = 1;                                   // the section the fuselage's, every build
    aW = m.face.halfW; aH = m.face.halfH;
    out.cw_taperW = 1; out.cw_taperH = 1;
    front = Math.min(aW, aH);
  } else if (mode === 'blend' && m.face) {
    out.fitNose = 1;
    aW = m.face.halfW; aH = m.face.halfH;
    const r = Math.max(Math.max(up, dn) * CLEAR * 1.1, 0.82 * Math.min(aW, aH));
    out.cw_taperW = +Math.min(1, Math.max(0.3, r / aW)).toFixed(3);
    out.cw_taperH = +Math.min(1, Math.max(0.3, r / aH)).toFixed(3);
    out.cw_sqFrontTop = 0.5; out.cw_sqFrontBot = 0.5;
    front = r;
  } else {
    out.fitNose = 0;
    const r = Math.max(0.12, CLEAR * wE, CLEAR * up, CLEAR * dn);
    aW = r; aH = r;
    out.cw_aftW = +aW.toFixed(4); out.cw_aftH = +aH.toFixed(4);
    out.cw_taperW = 1; out.cw_taperH = 1;
    out.cw_deckH = 1; out.cw_keelH = 1; out.cw_waist = 0;
    out.cw_sqAftTop = 0.5; out.cw_sqAftBot = 0.5; out.cw_sqFrontTop = 0.5; out.cw_sqFrontBot = 0.5;
    front = Math.min(aW, aH);
  }
  // THE LENGTH. A body cowl's face ends at the spinner's base (the flange + noseOff), the lip inside that. A POD runs
  // its full section to the spinner's base and closes in front of it (the user: "make the cowl a little longer, put
  // it further forward so that nothing pokes through, and you may move the prop a little bit"): the propeller moves
  // forward by the lip, the engine layer's shaft bridges the flange to the spinner.
  const lip = Math.max(LIP_LO, Math.min(LIP_HI, LIP_K * front));
  const noseOff0 = +P.cw_noseOff || 0;
  const reach = (m.zFw != null ? -m.zFw : env.length * 1.1) + noseOff0;
  out.cw_lidLen = +lip.toFixed(3);
  if (mode === 'pod') { out.cw_cowlLen = +Math.max(0.1, Math.min(2, reach)).toFixed(3); out.cw_noseOff = +(noseOff0 + lip).toFixed(3); }
  else out.cw_cowlLen = +Math.max(0.1, Math.min(2, reach - lip)).toFixed(3);
  Object.assign(out, FACE[type](front, frontW || front, frontH || front));
  if (mode === 'waist' && out.cw_scoopOn) out.cw_scoopFollow = 1;
  // THE AXIS: body cowls - the barrel runs to the engine's box centre (lidRise), the ring sits on the propeller
  // (faceRise, the ring only); off the body the plate moves by the propeller's offset (engBlockY) and the pod is
  // centred on it. engY is folded in: 0.
  out.cw_apOffX = +(+m.ax.x || 0).toFixed(4); out.cw_apOffY = 0;
  if (offBody) { out.engBlockY = +((+P.engBlockY || 0) + T).toFixed(4); out.cw_lidRise = 0; out.cw_faceRise = 0; }
  else if (mode === 'waist') { out.cw_lidRise = +cE.toFixed(4); out.cw_faceRise = +(T - cE).toFixed(4); }
  else { out.cw_lidRise = 0; out.cw_faceRise = +T.toFixed(4); }
  if (engY0 || lower) out.engY = 0;
  // A RADIAL'S HELMETS: one over each cylinder, where the drawn engine puts them (radialBumps)
  if (type === 'radial' && m.bumps) Object.assign(out, m.bumps(out._radialFront || aW, out.cw_cowlLen + lip));
  const note = out._note; delete out._radialFront; delete out._note;
  for (const k of Object.keys(out)) if (typeof out[k] === 'number') out[k] = +out[k].toFixed(4);
  return { over: out, why: { type, mode, mount: m.mount, engine: m.name, face: m.face, prop: T, engineCentre: cE, lower,
           env: { up, dn, wE }, drawn: D, reach, lip, note } };
}

// a straight 'match' needs the front section = the fitted aft section: one fitted build, then copy
function finish(spec, over, type) {
  if (!over) return over;
  if (over.fitNose !== 1) return fitCheeks(spec, placeScoop(spec, fitBends(spec, over)), type);
  const m = measure(spec, over);
  const P = m.P, o = Object.assign({}, over);
  if (o.cw_sqFrontTop == null) { o.cw_sqFrontTop = +(+P.cw_sqAftTop).toFixed(3); o.cw_sqFrontBot = +(+P.cw_sqAftBot).toFixed(3); }
  // seal what the body gave: the rows stand as the builder's from here (sealed = the size follows, the section is kept)
  for (const k of ['cw_sqAftTop', 'cw_sqAftBot', 'cw_deckH', 'cw_keelH', 'cw_waist']) o[k] = +(+P[k]).toFixed(4);
  if (o._waist != null) { o.cw_waist = o._waist; o.cw_deckH = 1; o.cw_keelH = 1; }
  delete o._waist;
  o.fitNose = 2;
  return fitCheeks(spec, placeScoop(spec, fitBends(spec, o)), type);
}

// THE BENDS GIVE WAY TO THE ENGINE: a bottom that rounds up early and a top that descends must not run into the drawn
// engine (an inverted in-line hangs its cylinders low; a Gipsy carries its induction high). Along the cowl, the keel
// must stay 1.5 cm under the engine's lowest metal inside its own envelope (the exhaust pipes below it may leave) and
// the deck 1.5 cm over its highest; where they would not, the line is held level longer (its shoulder), then bent
// from further forward (its sweep).
function fitBends(spec, o) {
  if (o.cw_keelShoulder == null && o.cw_deckShoulder == null) return o;
  o = Object.assign({}, o);
  for (let pass = 0; pass < 6; pass++) {
    const m = measure(spec, o), CW = m.W.COWL_GEN, zFw = m.zFw || 0, env = m.env;
    if (!env) return o;
    // the engine's own body by station (cowl z = engine z - zFw), inside its envelope
    const lo = {}, hi = {};
    for (const [x, y, z] of m.verts) {
      if (z < env.z0 - 0.01 || z > 0 || y < env.y0 - 0.01 || y > Math.max(env.y1, (m.drawn && m.drawn.upFront) || 0) + 0.01) continue;
      const k = Math.round((z - zFw) / 0.04);
      lo[k] = Math.min(lo[k] == null ? 9 : lo[k], y); hi[k] = Math.max(hi[k] == null ? -9 : hi[k], y);
    }
    // the engine's frame: y about the propeller's line = the cowl's axis at the face end
    const yAx = CW.axisXY().y;
    let keelBad = false, deckBad = false;
    for (const k in lo) {
      const z = k * 0.04; if (z < 0.02 || z > CW.zEnd() - 0.02) continue;
      const sc = CW.sectionAtZ(z);
      if (sc.cy - sc.bB > yAx + lo[k] - 0.015) keelBad = true;
      if (sc.cy + sc.bT < yAx + hi[k] + 0.015) deckBad = true;
    }
    if (!keelBad && !deckBad) return o;
    if (keelBad) {
      if (+o.cw_keelShoulder < 0.85) o.cw_keelShoulder = +Math.min(0.85, +o.cw_keelShoulder + 0.15).toFixed(2);
      else o.cw_keelSweep = +Math.max(0.3, +o.cw_keelSweep - 0.15).toFixed(2);
    }
    if (deckBad) {
      if (+o.cw_deckShoulder < 0.88) o.cw_deckShoulder = +Math.min(0.88, +o.cw_deckShoulder + 0.14).toFixed(2);
      else o.cw_deckSweep = +Math.max(0.2, +o.cw_deckSweep - 0.2).toFixed(2);
    }
  }
  return o;
}

// THE CHIN SCOOP, SEATED (the user, 8 Nov: "better rules for the chin scoop ... something robust that doesn't throw a
// little shit somewhere"): its length held to the part of the cowl where the keel is still the barrel's (not the bowl
// rounding up into the face), and its height set from the keel ITSELF along that span - the scoop's top a third of
// its height inside the skin at the keel's highest point under it, so no end of it floats or digs in. The generator
// places it by `scoopDrop` x the half-height at mid-barrel: that is solved for here, from the built cowl.
function placeScoop(spec, o) {
  if (!+o.cw_scoopOn) return o;
  const m = measure(spec, o), CW = m.W.COWL_GEN, Pc = CW.P;
  const ze = CW.zEnd(), cl = Pc.cowlLen, L = Pc.lidLen;
  const len = Math.min(+o.cw_scoopLen || 0.25, 0.5 * cl);
  const zMouth0 = cl + L * 0.35;
  const z1 = zMouth0 - (+o.cw_scoopZ || 0) * (zMouth0 - len), z0 = z1 - len;
  let keelHi = -Infinity;
  for (let k = 0; k <= 12; k++) { const z = z0 + (z1 - z0) * k / 12, sc = CW.sectionAtZ(z); keelHi = Math.max(keelHi, sc.cy - sc.bB); }
  const h = +o.cw_scoopH || Pc.scoopH, target = keelHi + h * (1 / 3) - h;   // the scoop's centre: its top 1/3 h inside
  const bB = CW.sectionAtZ(cl * 0.5).bB, sY = CW.spineY(ze * 0.6);
  const out = Object.assign({}, o, { cw_scoopLen: +len.toFixed(3) });
  out.cw_scoopDrop = +Math.max(0.2, Math.min(1.2, (sY - target) / Math.max(bB, 1e-3))).toFixed(3);
  return out;
}

// CHEEKS WHERE THE HEADS STAND PROUD (the user's own method, G180: "add a couple of lobes for a boxer and tune them
// until the engine fits"; the PA-18's answer): the drawn engine's vertices outside the drawn barrel (clear.js) give
// the cheeks' station, spread, height and size; rebuilt until the engine clears (3 passes at most)
// ...AND A BLISTER WHERE ONE PART STANDS PROUD ON ONE SIDE (the Tiger Moth's bonnet has one - the reference model's
// 'blister'): any engine, the drawn parts outside the barrel on the flanks or the top (the exhaust below may leave);
// spread both sides -> two cheeks at their height, on one side or on top -> one blister at their azimuth
function fitCheeks(spec, o, type) {
  if (type === 'radial') return o;                   // the helmets are the radial's
  if (+o.cw_aftMode === 1) return o;                 // a pod is the engine's own size: no cheeks
  const C = require('./clear.js'), THREE = SH.context().THREE;
  o = Object.assign({}, o, { cw_lobeN: 0 });
  for (let pass = 0; pass < 4; pass++) {
    const m = measure(spec, o), c = C.clearance(m.S, THREE);
    if (!c || !c.n || c.worst < 0.002) { o._cheeks = c ? c.worst : null; return o; }
    const CW = m.W.COWL_GEN, zE = CW.zEnd(), P = CW.P;
    // the bump goes where the engine stands out most: the points over half the worst depth
    c.pts = c.pts.filter(p => p[3] >= 0.5 * c.worst);
    const zs = c.pts.map(p => p[2]).sort((a, b) => a - b), ys = c.pts.map(p => p[1]).sort((a, b) => a - b);
    const q = (a, t) => a[Math.floor(t * (a.length - 1))];
    const zMid = 0.5 * (q(zs, 0.05) + q(zs, 0.95)), zSpan = q(zs, 0.95) - q(zs, 0.05), yMid = q(ys, 0.5);
    // the section's parameter whose point sits at the heads' height on the flank
    // both sides (cheeks) or one (a blister): the share of the points left and right of the centreline
    const nL = c.pts.filter(p => p[0] < -0.05).length, nR = c.pts.filter(p => p[0] > 0.05).length;
    const both = Math.min(nL, nR) > 0.25 * Math.max(nL, nR);
    let az = 0, best = Infinity;
    if (both) { for (let d = -80; d <= 80; d++) { const p = CW.surfPoint(d * Math.PI / 180, zMid); if (Math.abs(p[1] - yMid) < best) { best = Math.abs(p[1] - yMid); az = d; } } }
    else {
      const xs = c.pts.map(p => p[0]).sort((a, b) => a - b), xMid = q(xs, 0.5);
      az = Math.round(Math.atan2(yMid - CW.spineY(zMid), xMid) * 180 / Math.PI);
    }
    // a blister as wide as the hump it covers: the points' angular spread round the axis
    let sig = 24;
    if (!both) {
      const angs = c.pts.map(p => Math.atan2(p[1] - CW.spineY(p[2]), p[0]) * 180 / Math.PI).sort((a, b) => a - b);
      sig = Math.max(24, Math.min(70, 0.6 * (q(angs, 0.95) - q(angs, 0.05))));
    }
    if (!+o.cw_lobeN) Object.assign(o, { cw_lobeN: both ? 2 : 1, cw_lobeAz: az, cw_lobeSig: +sig.toFixed(1), cw_lobeAmp: 0,
      cw_lobeT: +(zMid / zE).toFixed(3), cw_lobeTSig: +Math.max(0.08, Math.min(0.6, 0.75 * zSpan / zE)).toFixed(3) });
    o.cw_lobeAmp = +Math.min(0.16, (+o.cw_lobeAmp || 0) + c.worst + 0.012).toFixed(3);
  }
  const c = C.clearance(measure(spec, o).S, THREE); o._cheeks = c ? c.worst : null;
  return o;
}

module.exports = { SHAPE, FACE, typeOf, measure, rowsFor, finish, aftSection };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const pos = argv.filter(a => !a.startsWith('--'));
  const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
  const [IN, OUT] = pos;
  const j = JSON.parse(fs.readFileSync(IN, 'utf8'));
  const spec = j.spec || j;
  const r = rowsFor(spec, { opt: arg('opt', 'waist'), type: arg('type', 'auto'), lower: +arg('lower', 0) });
  if (!r.over) { console.error('straight: ' + r.why); process.exit(1); }
  const over = finish(spec, r.over, r.why.type);
  const cheeks = over._cheeks; delete over._cheeks; const sec = over._sec; delete over._sec;
  const s2 = JSON.parse(JSON.stringify(spec));
  s2.cage = Object.assign({}, s2.cage, over);
  fs.writeFileSync(OUT, JSON.stringify(j.spec ? Object.assign({}, j, { spec: s2, name: (j.name || '') + ' straight ' + arg('opt', 'match') }) : s2));
  console.log(JSON.stringify(Object.assign({ out: OUT }, r.why, { face: undefined }, { cheeksWorst: cheeks, section: sec, over })));
}
