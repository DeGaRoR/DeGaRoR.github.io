// COWL FIT (G2860, COWL-FIT) — the user's cowl fitting procedure, as one
// deterministic step the constructor runs on every new design and the editor
// can run on a button.
//
// THE PROCEDURE, the user's words (10 Oct 2026), and the function that does
// each step. The order is theirs and so is the menu order it walks (type ->
// size -> section at the firewall -> nose bowl -> cheeks and cut-out ->
// inlets):
//
//   "disable the auto fit to nose"                      fitNose = 0 (free)
//   "match the waistline with widest line height in
//    'section at the firewall'"                         fireSection: waist
//   "match top line and bottom line"                    fireSection: deckH, keelH
//   "adjust the diamond setting top and bottom to
//    match the curvature"                               fireSection: sqAftTop/Bot
//   "possibly extend the cowl towards the down
//    direction to let exhaust go through"               exhaustDrop: keelH
//   "match the length to get to the nose cone and
//    engulf the engine"                                 lengthToSpinner
//   "move the bowl up and down to keep in-line with
//    the nose section"                                  bowlInLine
//   "match the width and height to cover most of the
//    engine"                                            coverEngine: taperW/H
//   "add a couple of cheeks to cover cylinders heads
//    if required"                                       cheeksOverHeads
//   "Then work on the distinctive fascia features,
//    especially the inlets and the curvature"           NOT HERE — the builder's
//
// The fascia (inlets, scoop, sweeps, the nose ring's squareness, the panel
// joint) is the builder's and the card's: the fit never writes those rows,
// except the two a radial's or a turbine's STYLE has always set (the
// existing COWL_BY_ARCH table in _cage_cowl.js, applied first, untouched).
//
// WHAT IT READS — the same things the page draws from, never a second guess:
//   the FIREWALL FRAME   the cage sheet's marked nose cap (CAGE_NOSE.noseFace,
//                        the cowl layer's own reader) for the size and seat,
//                        and the fuselage SLICE a hand's breadth aft of it
//                        (GEAR_GEN.cageAirframe, the gear's reader) for the
//                        lines — the cap is the flat bulkhead, the lines the
//                        builder matches by eye are the skin's
//   the ENGINE           ENG_MESH.engMeshBuild on the page's own engine dict
//                        (CAGE_ENG_SPEC), placed in the cowl's frame by the
//                        engine layer's own rule (_cage_eng.js: flange at the
//                        face minus zFw, on the nose ring's axis plus engY,
//                        tilted by engTilt) — so the cylinder heads, the
//                        sump, the carburettor and the exhaust pipes are the
//                        drawn ones, tagged by material
//   the SPINNER          the cone's base is the flange plus cw_noseOff
//
// CALIBRATED on the user's own fits (builds/*_corrected.json — the Cub, the
// Jodel and the 172, all fitted by hand in `free`): their top and bottom
// lines sit on the fuselage 0.10 m aft of the cap (within 1-2 cm), the nose
// ring stands 4.3-4.5 cm ahead of the spinner's base, the ring is matched to
// the spinner with a 9-14 mm gap, and the cheeks sit on the flanks.
//
//   cowlFit(P, opts)        -> { vals, physics, report }   the procedure
//   cowlFitMeasure(P, opts) -> the inputs (firewall, body lines, engine)
//   cowlFitCheck(P, opts)   -> { outside, worst, fireMean, fireMax, ... }
//                              the verdict on P's CURRENT rows (GATE COWLFIT)
//
// `P` is the page's full parameter set (cageDefaults + page defaults + the
// build — designFull's `full`, or the editor's live P). `opts.mesh` reuses a
// cage sheet already built at the page's level; otherwise one is built.
// Nothing here writes P: the caller assigns `vals` (the birth bakes them,
// the editor's "fit cowl" button would Object.assign them and rebuild).
//
// Loads in node (require) and in the browser (window.COWL_FIT). It reaches
// COWL_GEN, CAGE2, GEAR_GEN, ENG_MESH, CAGE_NOSE and CAGE_ENG_SPEC at CALL
// time, so it sits after _cage_eng.js in the editor manifest.
'use strict';
(() => {
const NODE = typeof module !== 'undefined' && module.exports;
const W = typeof window !== 'undefined' ? window : globalThis;
const req = f => { try { return NODE ? require(f) : null; } catch (e) { return null; } };
const lib = () => ({
  CW: W.COWL_GEN || req('./_cowl_gen.js'),
  CG2: W.CAGE2 || req('./_cage_gen.js'),
  GG: W.GEAR_GEN || req('./_gear_gen.js'),
  EM: W.ENG_MESH || req('./_eng_mesh.js'),
  NOSE: W.CAGE_NOSE,
  SPEC: W.CAGE_ENG_SPEC,
  STYLE: W.CAGE_COWL_BY_ARCH || null,
});

// ---- the constants, each with its reason ----------------------------------
// where the body's lines are read: the user's three fits match the skin
// 0.10 m aft of the cap (the cap is the flat bulkhead; a hand's breadth aft is
// where the fuselage has its full section). Denser fallbacks if that slice is
// still a sliver (the noseSampleZ trap in _cage_cowl.js).
const SLICE_D = [0.10, 0.15, 0.20, 0.06];
const NSLICE = 180;              // outline samples round the slice
const RING_LEAD = 0.04;          // m, nose ring ahead of the spinner's base (user: 0.043-0.045)
const RING_GAP = 0.012;          // m, ring round the spinner (user: 0.009-0.014)
const SPIN_CLEAR = 0.02;         // m, the spinner's base ahead of the engine's front
const CLR = 0.012;               // m, engine metal to cowl skin
const FW_SKIP = 0.03;            // m, engine points this close to the firewall are mount hardware
const EXH_THROUGH = 0.02;        // m, the pipe passes through the bottom this far above its lowest point
const TAPER_LO = 0.6, TAPER_HI = 1.15;   // the barrel end (× firewall); the row's own hi
const GROW_HI = 1.25;            // the firewall section may grow this much for an engine wider than the body
const CHEEK_MAX = 0.16;          // m, the cheek row's own hi
const CHEEK_FLANK = 60;          // deg: heads within this of the flanks take cheeks; above/below is the barrel's job
const PASSES = 40;
const VOX = 0.012, VOXZ = 0.02;   // m, the engine's point cells (across, along)
const GROW_RADIAL = 1.6;         // a round engine bigger than its fuselage: the NACA ring stands proud (the Stearman)               // fixed iteration counts: generation stays deterministic (GATE GEN's rule)

// the engine's parts by role, from the mesh's material tags (_eng_mesh.js ENGM_MAT)
const HEADS = new Set(['emHead', 'emRocker', 'emPlug', 'emCeramic', 'emLead', 'emFin', 'emBarrel']);
const PIPES = new Set(['emExhaust']);
// the firewall plate, the mount and its pucks: hardware ON the firewall,
// inside the fuselage's own skin, never the cowl's to cover
const MOUNT = new Set(['emMount', 'emPuck', 'emFuel', 'emThrottle', 'emFirewall', 'emSpider']);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const r3 = v => Math.round(v * 1000) / 1000;
const ceilTo = (v, s) => Math.ceil(v / s - 1e-9) * s;
const scaleOf = P => ((W.CAGE2 && W.CAGE2.CAGE_UNIT) || 1) * (P.planeScale || 1);

// the panel's 0..1 squareness <-> the superellipse exponent (_cowl_gen sqExp)
const nOf = (u, v) => {
  let lo = 0.6, hi = 12;
  for (let k = 0; k < 40; k++) {
    const m = (lo + hi) / 2;
    if (Math.pow(u, m) + Math.pow(v, m) > 1) lo = m; else hi = m;
  }
  return (lo + hi) / 2;
};
const sqOf = n => n <= 2 ? Math.max(0, (n - 1) / 2)
                         : Math.min(1, 0.5 + Math.log(n / 2) / (2 * Math.log(5)));
const median = a => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };

// ---- 0. the inputs ----------------------------------------------------------
// The engine unit the cowl wraps: the cowl layer's own face list. A body face
// (nose, or the aft bulkhead of a pusher) comes off the sheet; a SYNTHETIC
// face (a pylon, a nacelle) is the wing's, which the headless constructor
// does not draw — its SIZE is then free (no body to meet; a nacelle's cowl is
// closed by its own tail cone), and the fit sizes it to the engine.
function unitOf(P, mesh, FS, L) {
  const mount = Math.round(P.engMount || 0);
  if (mount === 2) return { face: { z: 0, yc: 0, x: 0, halfW: 0.16, halfH: 0.14, seat: 0, synthetic: 1 }, aft: false, kind: 'wingTop' };
  if (mount === 3) return { face: { z: 0, yc: 0, x: 0, halfW: 0.20, halfH: 0.20, seat: 0, synthetic: 1 }, aft: Math.round(P.engAim || 0) === 2, kind: 'nacelle' };
  if (!L.NOSE || !L.NOSE.noseFace) return null;
  const f = L.NOSE.noseFace(mesh, FS, mount === 1 ? 'tail' : undefined);
  return f ? { face: f, aft: mount === 1, kind: mount === 1 ? 'pusher' : 'nose' } : null;
}

// THE BODY'S LINES at the firewall, in the cowl's frame (y about the face's
// mid-height): its half-width, top line, bottom line, WIDEST LINE (the mean
// height of the outline where it is within 1.5 % of its full width — a boxy
// side is a vertical run, and its middle is where the eye puts the line), and
// the outline itself for the squareness fit.
function bodyLines(AF, face, aft) {
  const sg = aft ? -1 : 1;
  for (const d of SLICE_D) {
    const z = clamp(face.z - sg * d, AF.z0 + 1e-3, AF.z1 - 1e-3);
    const pts = [];
    let hw = 0, top = -Infinity, bot = Infinity;
    for (let k = 0; k < NSLICE; k++) {
      const p = AF.surf(z, -Math.PI + k / NSLICE * Math.PI * 2);
      const x = Math.abs(p[0]), y = p[1] - face.yc;
      pts.push([x, y]);
      hw = Math.max(hw, x); top = Math.max(top, y); bot = Math.min(bot, y);
    }
    if (hw < 0.85 * face.halfW) continue;          // a sliver: the next station
    let ws = 0, wn = 0;
    for (const [x, y] of pts) if (x >= 0.985 * hw) { ws += y; wn++; }
    return { d, halfW: hw, top, bot, waist: wn ? ws / wn : 0.5 * (top + bot), pts };
  }
  return null;
}

// THE ENGINE IN THE COWL'S FRAME — _cage_eng.js's placement, line for line:
// the unit sits at (f.x + apOffX, f.yc + spineY(zEnd) + apOffY + engY,
// f.z - zFw), tilted engTilt about x; the cowl's group at (f.x, f.yc,
// f.z + cowlGap + seat). An aft unit turns both round, so in the cowl's own
// frame a pusher reads exactly as a puller. `T` is the thrustline's height
// in that frame; the points are returned about it (add T to place them).
function engineIn(P, unit, L) {
  if (!+P.engOn || !L.SPEC || !L.EM) return null;
  const spec = L.SPEC(P);
  spec.quality = Math.max(0.3, P.engDetail || 0.8);
  spec.screws = P.eng_screws ? 1 : 0;
  spec.fwOn = unit.face.synthetic ? 1 : 0;
  spec.fwW = clamp(2 * unit.face.halfW, 0.2, 2.2);
  spec.fwH = clamp(2 * unit.face.halfH, 0.2, 2.2);
  let M;
  try { M = L.EM.engMeshBuild(spec); } catch (e) { return null; }
  const R = M.resolved;
  const Pm = Object.assign({}, L.EM.ENGM_DEFAULT, R.P);
  const cR = R.place.caseR != null ? R.place.caseR : R.place.canR;
  const zFw = R.place.zAft - Pm.mountGap * cR;
  const flange = -zFw - (unit.face.seat || 0) - (P.cowlGap || 0);   // the crank nose, cowl frame
  const tl = (+P.engTilt || 0) * Math.PI / 180, ct = Math.cos(tl), st = Math.sin(tl);
  const dx = +P.cw_apOffX || 0;
  const role = new Uint8Array(M.V.length);         // 0 unused, 1 core, 2 head, 3 pipe
  for (const f of M.F) {
    const r = MOUNT.has(f.m) ? 0 : PIPES.has(f.m) ? 3 : HEADS.has(f.m) ? 2 : 1;
    for (const i of f.v) if (r && (!role[i] || r === 3)) role[i] = r;
  }
  // ONE POINT PER CELL, the outermost: a dressed engine is 20-40k vertices
  // (the fins alone are 7k), and the cowl only ever meets its outside. A cell
  // of VOX across the section and VOXZ along it, per role, keeping the point
  // furthest from the thrustline — conservative, and the fit's cost no longer
  // scales with the dress dials
  const cells = new Map();
  let front = -Infinity;
  for (let i = 0; i < M.V.length; i++) {
    if (!role[i]) continue;
    const p = M.V[i];
    const y = p[1] * ct - p[2] * st, z = p[1] * st + p[2] * ct + flange;
    if (z < FW_SKIP) continue;
    const x = p[0] + dx;
    if (role[i] !== 3) front = Math.max(front, z);
    const key = role[i] + ':' + Math.round(x / VOX) + ':' + Math.round(y / VOX) + ':' + Math.round(z / VOXZ);
    const q = cells.get(key);
    if (!q || x * x + y * y > q[0] * q[0] + q[1] * q[1]) cells.set(key, [x, y, z, role[i]]);
  }
  // a fixed order (the cells' insertion order is the mesh's own, which is
  // deterministic): generation byte-compares
  const pts = Array.from(cells.values());
  return { pts, flange, front, arch: R.arch || spec.arch, R, nV: M.V.length };
}

function cowlFitMeasure(P, opts) {
  const L = lib();
  if (!L.CW || !L.CG2) throw new Error('cowl fit: _cowl_gen.js / _cage_gen.js not loaded');
  const FS = scaleOf(P);
  const level = opts && opts.level != null ? +opts.level : 2;
  const mesh = (opts && opts.mesh) || L.CG2.cageSheet(P, { level, step: (opts && opts.step) || 'crease' }).sheet;
  const unit = unitOf(P, mesh, FS, L);
  if (!unit) return null;
  const AF = !unit.face.synthetic && L.GG ? L.GG.cageAirframe(mesh, FS) : null;
  const body = AF ? bodyLines(AF, unit.face, unit.aft) : null;
  const eng = engineIn(P, unit, L);
  // the thrustline the card already has (the bowl's axis + the inlet's and
  // the mount's offsets) — the fit keeps it: the engine does not move
  const T = (+P.cw_lidRise || 0) + (+P.cw_faceRise || 0) + (+P.cw_apOffY || 0) + (+P.engY || 0);
  return { unit, face: unit.face, body, eng, T, FS };
}

// ---- the geometry tests, on COWL_GEN's own section --------------------------
// with P's rows pushed into the generator's singleton for the duration
// (restored after: the page's post writes its own before it draws)
const COWL_KEYS = ['aftW', 'aftH', 'deckH', 'keelH', 'waist', 'sqAftTop', 'sqAftBot',
  'sqFrontTop', 'sqFrontBot', 'lidSqTop', 'lidSqBot', 'cowlLen', 'taperW', 'taperH',
  'lidRise', 'faceRise', 'lidLen', 'lidShoulder', 'lidRound', 'deckSweep', 'keelSweep',
  'waistSweep', 'lidMode', 'lidR', 'lidGap', 'spinR', 'noseOff', 'lobeN', 'lobeAmp',
  'lobeT', 'lobeAz', 'lobeSig', 'lobeTSig', 'seamOn', 'seamType', 'seamPos', 'seamWidth',
  'seamDepth', 'fwLipOn', 'fwLipR', 'fwLipRise', 'fwLipIn', 'apOffY'];
function withCowl(CW, rows, fn) {
  const save = {};
  for (const k of COWL_KEYS) save[k] = CW.P[k];
  const inh = CW.P.inheritStub;
  try {
    for (const k of COWL_KEYS) if (rows[k] !== undefined) CW.P[k] = rows[k];
    CW.P.inheritStub = 0;
    CW.prepareLid();
    return fn();
  } finally {
    for (const k of COWL_KEYS) CW.P[k] = save[k];
    CW.P.inheritStub = inh;
    CW.prepareLid();
  }
}
// how far OUTSIDE the skin a point stands (m, > 0 outside), lobes included:
// the point is pulled back toward the section centre by the cheek's own
// push at its bearing (surfPoint's rule run backwards), then measured by the
// half's superellipse — homogeneous about the waist centre, so the overshoot
// is the distance to the boundary along that ray.
function outsideBy(CW, x, y, z) {
  const s = CW.sectionAtZ(z);
  let px = x, py = y - s.cy;
  const Lr = Math.hypot(px, py);
  if (Lr > 1e-9 && CW.P.lobeN >= 1 && CW.P.lobeAmp > 0) {
    const d = CW.lobeAt(Math.atan2(py, px), z);
    if (d > 0) { const k = Math.max(0, 1 - d / Lr); px *= k; py *= k; }
  }
  const dy = py - s.yw, up = dy >= 0;
  const h = Math.max(up ? s.bT - s.yw : s.bB + s.yw, 0.002), n = up ? s.nT : s.nB;
  const F = Math.pow(Math.abs(px / s.a), n) + Math.pow(Math.abs(dy / h), n);
  const k = Math.max(1e-9, Math.pow(F, 1 / n));     // the boundary is the point / k
  const dist = Math.hypot(px, dy), rb = dist / k;
  return { out: dist - rb, dist, rb, k, n, up, wide: Math.abs(px / s.a) >= Math.abs(dy / h), s };
}

// ---- 1. the section at the firewall ----------------------------------------
function fireSection(m, P) {
  const f = m.face, b = m.body;
  if (!b) {
    // no body behind it (a synthetic face: a pylon, a nacelle): the engine's
    // own size, round — the nacelle's tail cone closes it, nothing to meet
    let hx = 0.05, top = 0.05, bot = -0.05;
    for (const [x, y, , r] of (m.eng ? m.eng.pts : [])) {
      if (r === 3) continue;                       // the pipes go through it
      hx = Math.max(hx, Math.abs(x)); top = Math.max(top, y + m.T); bot = Math.min(bot, y + m.T);
    }
    // symmetric about the thrustline's own height band: a nacelle is a body
    // of revolution more than it is a fuselage nose
    const aftH = Math.max(top, -bot) + CLR;
    return { aftW: hx + CLR, aftH, deckH: 1, keelH: 1, waist: 0, sqAftTop: 0.5, sqAftBot: 0.5,
             note: 'synthetic face: sized from the engine, round' };
  }
  const aftH = f.halfH;
  const top = Math.max(b.top, 0.2 * aftH), bot = Math.min(b.bot, -0.2 * aftH);
  // THE WIDEST LINE AND THE DIAMOND, TOGETHER. A boxy side is a vertical run,
  // and where along it the eye puts "the widest line" decides how the two
  // halves' curvatures read; so the waist is the height whose fitted halves
  // lie closest to the body's outline (summed radial distance), searched in
  // 5 mm steps over the middle 70 % of the section; ties go to the measured
  // line.
  const H = top - bot;
  const fitAt = yw => {
    const T = [], B = [];
    for (const [x, y] of b.pts) {
      const u = x / b.halfW;
      const v = y >= yw ? (y - yw) / (top - yw) : (yw - y) / (yw - bot);
      if (u < 0.2 || v < 0.2 || u > 0.999 || v > 0.999) continue;   // on an axis n is undetermined
      (y >= yw ? T : B).push(nOf(u, v));
    }
    const nT = median(T) || 2, nB = median(B) || 2;
    let err = 0;
    for (const [x, y] of b.pts) {
      const up = y >= yw, n = up ? nT : nB, h = up ? top - yw : yw - bot;
      const F = Math.pow(x / b.halfW, n) + Math.pow(Math.abs(y - yw) / h, n);
      err += Math.hypot(x, y - yw) * Math.abs(1 - 1 / Math.pow(Math.max(F, 1e-9), 1 / n));
    }
    return { nT, nB, err };
  };
  const y0 = clamp(b.waist, bot + 0.15 * H, top - 0.15 * H);
  let best = Object.assign(fitAt(y0), { yw: y0 });
  for (let i = 0; ; i++) {
    const yw = bot + 0.15 * H + i * 0.005;
    if (yw > top - 0.15 * H) break;
    const r = fitAt(yw);
    if (r.err < best.err - 1e-9) best = Object.assign(r, { yw });
  }
  return { aftW: b.halfW, aftH,
           deckH: clamp(top / aftH, 0.2, 1.9), keelH: clamp(-bot / aftH, 0.2, 1.9),
           waist: clamp(best.yw / aftH, -0.85, 0.85),
           sqAftTop: r3(sqOf(best.nT)), sqAftBot: r3(sqOf(best.nB)) };
}

// ---- 2. the exhaust through the bottom --------------------------------------
// a down-pointing pipe below the bottom line takes the line down with it, to
// a couple of centimetres above the pipe's lowest point — the pipe pierces
// the bottom panel, as it does on every Cub. Sideways stacks (a turbine's)
// pierce where they stand and move nothing.
function exhaustDrop(m, sec, T, zEnd) {
  if (!m.eng) return null;
  let low = Infinity, lowX = 0;
  for (const [x, y, z, r] of m.eng.pts)
    if (r === 3 && z <= zEnd && y + T < low) { low = y + T; lowX = x; }
  if (!isFinite(low)) return null;
  const bot = -sec.keelH * sec.aftH;
  if (low >= bot - 0.005) return null;
  // a stack sticking out sideways is not a pipe going down
  if (Math.abs(lowX) > 0.85 * sec.aftW) return null;
  return clamp(-(low + EXH_THROUGH) / sec.aftH, sec.keelH, 1.9);
}

// ---- 3. the length: to the nose cone, engulfing the engine -------------------
function lengthToSpinner(m, P) {
  const e = m.eng;
  const noseOff0 = +P.cw_noseOff || 0;
  // the spinner's base sits on the flange plus noseOff — and never inside the
  // engine: ahead of its forward-most metal by SPIN_CLEAR
  const noseOff = e ? Math.max(noseOff0, e.front + SPIN_CLEAR - e.flange) : noseOff0;
  const spinBase = e ? e.flange + noseOff : (+P.cw_cowlLen || 0.4) + (+P.cw_lidLen || 0.12) - RING_LEAD;
  const zEnd = Math.max(0.12, spinBase + RING_LEAD);
  const lidLen = clamp(+P.cw_lidLen || 0.125, 0.06, 0.35 * zEnd);
  return { noseOff, spinBase, zEnd, lidLen, cowlLen: Math.max(0.05, zEnd - lidLen) };
}

// ---- 4. the bowl in line ------------------------------------------------------
// the nose ring centred on the spinner (the thrustline the card already has:
// the engine does not move), and the axis straight from the firewall's
// centre to it — the barrel takes its share of the rise, the bowl the rest
function bowlInLine(T, len) {
  const lidRise = clamp(T * len.cowlLen / len.zEnd, -0.22, 0.22);
  const faceRise = clamp(T - lidRise, -0.12, 0.12);
  return { lidRise: r3(lidRise), faceRise: r3(faceRise), T: r3(lidRise) + r3(faceRise) };
}

// ---- 5 + 6. cover the engine, then cheeks over the heads ----------------------
function solveCover(CW, rows, pts, T, opts) {
  // grow the barrel end (taperW / taperH) until every point is CLR inside.
  // With opts.grow, what the taper cannot reach — a point within 15 % of the
  // firewall, or any barrel point once the taper is at its limit — grows the
  // firewall section itself, PER SIDE: the half-width, the top line, the
  // bottom line, each within opts.cap of where the body put it
  const r = rows;
  let best = Infinity, stale = 0;
  for (let pass = 0; pass < PASSES; pass++) {
    let needW = r.taperW, needH = r.taperH, gW = 1, gT = 1, gB = 1, nOut = 0;
    const lim = { w: 0, t: 0, b: 0 };
    withCowl(CW, r, () => {
      for (const [x, y0, z] of pts) {
        const o = outsideBy(CW, x, y0 + T, z);
        if (!(o.out > -CLR + 1e-4)) continue;
        nOut++;
        const kk = (o.dist + CLR) / Math.max(1e-6, o.rb);    // the growth that puts it CLR inside
        const u = clamp(z / r.cowlLen, 0, 1);
        if (z <= r.cowlLen) { if (o.wide) lim.w++; else if (o.up) lim.t++; else lim.b++; }
        if (u < 0.15) { if (o.wide) gW = Math.max(gW, kk); else if (o.up) gT = Math.max(gT, kk); else gB = Math.max(gB, kk); continue; }
        if (o.wide) needW = Math.max(needW, ((o.s.a * kk / r.aftW) - (1 - u)) / u);
        else {
          const hLin = r.aftH * (1 - u + u * r.taperH);
          needH = Math.max(needH, ((hLin * kk / r.aftH) - (1 - u)) / u);
        }
      }
    });
    if (!nOut) return { ok: true, passes: pass };
    // growth that stops paying (six passes with no fewer points out) stops:
    // what is left is not the section's to fix (a ring too small, a part
    // standing off the engine) and is reported, not chased
    if (nOut < best) { best = nOut; stale = 0; } else if (++stale > 6) return { ok: false, passes: pass, out: nOut };
    const tW = clamp(ceilTo(needW, 0.01), TAPER_LO, TAPER_HI), tH = clamp(ceilTo(needH, 0.01), TAPER_LO, TAPER_HI);
    let moved = tW !== r.taperW || tH !== r.taperH;
    r.taperW = r3(tW); r.taperH = r3(tH);
    if (opts.grow && !moved) {
      // the taper is at its limit for what is left: 3 % per pass on the sides
      // still out (fixed steps — deterministic, and rounding cannot stall it)
      if (lim.w) gW = Math.max(gW, 1.03);
      if (lim.t) gT = Math.max(gT, 1.03);
      if (lim.b) gB = Math.max(gB, 1.03);
    }
    if (opts.grow && (gW > 1 || gT > 1 || gB > 1)) {
      const w = r3(ceilTo(Math.min(r.aftW * gW, opts.aftW0 * opts.cap), 0.001));
      const dk = r3(ceilTo(Math.min(r.deckH * gT, opts.deckH0 * opts.cap, 1.9), 0.001));
      // the bottom line may go all the way down the row ("extend the cowl
      // towards the down direction" is the user's own step)
      const kl = r3(ceilTo(Math.min(r.keelH * gB, 1.9), 0.001));
      if (w !== r.aftW || dk !== r.deckH || kl !== r.keelH) { r.aftW = w; r.deckH = dk; r.keelH = kl; moved = true; }
    }
    if (!moved) return { ok: false, passes: pass, out: nOut };
  }
  return { ok: false, passes: PASSES };
}
function cheeksOverHeads(CW, rows, heads, T) {
  // the heads still outside after the barrel covered the rest of the engine
  const out = [];
  withCowl(CW, rows, () => {
    for (const [x, y0, z] of heads) {
      const o = outsideBy(CW, x, y0 + T, z);
      if (o.out > -CLR) out.push({ x, y: y0 + T - o.s.cy, z, e: o.out + CLR });
    }
  });
  if (!out.length) return { lobeN: 0, why: 'no head outside the barrel' };
  // where they are: bearing from the flank (degrees, + up), and station
  const az = out.map(p => Math.atan2(p.y, Math.abs(p.x)) * 180 / Math.PI);
  const flank = az.filter(a => Math.abs(a) <= CHEEK_FLANK).length;
  const below = az.filter(a => a < -CHEEK_FLANK).length, above = az.filter(a => a > CHEEK_FLANK).length;
  // ONE cheek under the keel (an inverted in-line's heads) or over the deck
  // (an upright one's): the row's own lobeN 1, at -90 / +90
  const single = flank < 0.8 * out.length;
  if (single && below < 0.8 * out.length && above < 0.8 * out.length)
    return { lobeN: 0, why: 'heads all round, not on the flanks', out: out.length };
  const zEnd = rows.cowlLen + rows.lidLen;
  const ts = out.map(p => p.z / zEnd);
  const t0 = Math.min(...ts), t1 = Math.max(...ts);
  const a0 = Math.min(...az), a1 = Math.max(...az);
  const c = { lobeN: single ? 1 : 2,
    lobeAz: single ? (below > above ? -90 : 90) : Math.round(clamp(0.5 * (a0 + a1), -90, 90)),
    lobeT: r3(clamp(0.5 * (t0 + t1), 0, 1)),
    // spreads wide enough that the ends of the head row still get ~60 % of
    // the bump (exp(-0.51) at 1.4 half-ranges)
    lobeTSig: r3(clamp(1.4 * 0.5 * (t1 - t0) + 0.05, 0.08, 0.6)),
    lobeSig: single ? 30 : Math.round(clamp(1.4 * 0.5 * (a1 - a0) + 12, 15, 70)),
    lobeAmp: 0 };
  // the amplitude: each head point's remaining overshoot over the bump's own
  // weight at that point, a few fixed passes (the bump pushes from the
  // section centre, the section is measured from the waist)
  c.lobeAmp = 0.01;
  for (let pass = 0; pass < 8; pass++) {
    let need = 0;
    withCowl(CW, Object.assign({}, rows, c), () => {
      for (const p of out) {
        const cy = CW.sectionAtZ(p.z).cy;
        const o = outsideBy(CW, p.x, p.y + cy, p.z);
        const rem = o.out + CLR;
        if (rem <= 1e-4) continue;
        const w = Math.max(0.05, CW.lobeAt(Math.atan2(p.y, p.x), p.z) / c.lobeAmp);
        need = Math.max(need, rem / w);
      }
    });
    if (need <= 1e-4) break;
    c.lobeAmp = r3(ceilTo(Math.min(CHEEK_MAX, c.lobeAmp + need), 0.002));
    if (c.lobeAmp >= CHEEK_MAX) break;
  }
  return c;
}

// ---- THE FIT ------------------------------------------------------------------
function cowlFit(P, opts) {
  const L = lib();
  const m = (opts && opts.measured) || cowlFitMeasure(P, opts);
  if (!m) return null;
  const CW = L.CW;
  const notes = [];
  const arch = m.eng ? m.eng.arch : null;
  // the STYLE an architecture has always had (radial, turbine): shape rows
  // only — the fit owns the size, the section at the firewall and the length
  const style = arch && L.STYLE && L.STYLE[arch] ? Object.assign({}, L.STYLE[arch]) : null;
  const round = !!style;                       // a round engine: no cheeks, the barrel encloses
  // 1. the section at the firewall (and "disable the auto fit to nose")
  const sec = fireSection(m, Object.assign({}, P, style || {}));
  if (sec.note) notes.push(sec.note);
  // 3. length (before the exhaust: the pipes count only inside the cowl)
  const len = lengthToSpinner(m, P);
  // 4. the bowl
  const bowl = bowlInLine(m.T, len);
  if (Math.abs(bowl.T - m.T) > 0.002) notes.push('thrustline clamped by the axis rows: ' + r3(m.T) + ' -> ' + bowl.T);
  // 2. the exhaust
  const drop = exhaustDrop(m, sec, bowl.T, len.zEnd);
  if (drop != null) { notes.push('bottom line taken down for the exhaust: keelH ' + r3(sec.keelH) + ' -> ' + r3(drop)); sec.keelH = drop; }
  const rows = {
    aftW: r3(sec.aftW), aftH: r3(sec.aftH), deckH: r3(sec.deckH), keelH: r3(sec.keelH),
    waist: r3(sec.waist), sqAftTop: sec.sqAftTop, sqAftBot: sec.sqAftBot,
    cowlLen: r3(len.cowlLen), lidLen: r3(len.lidLen), lidRise: bowl.lidRise, faceRise: bowl.faceRise,
    lidMode: 1, lidGap: RING_GAP, noseOff: r3(len.noseOff), apOffY: r3(-(+P.engY || 0)),
    taperW: TAPER_LO, taperH: TAPER_LO, lobeN: 0, lobeAmp: 0,
  };
  // the card's (or the style's) shape rows ride along for the geometry tests
  for (const k of ['sqFrontTop', 'sqFrontBot', 'lidSqTop', 'lidSqBot', 'lidShoulder', 'lidRound',
                   'deckSweep', 'keelSweep', 'waistSweep', 'spinR', 'seamOn', 'seamType', 'seamPos',
                   'seamWidth', 'seamDepth', 'fwLipOn', 'fwLipR', 'fwLipRise', 'fwLipIn',
                   'lobeT', 'lobeAz', 'lobeSig', 'lobeTSig']) {
    const v = style && style['cw_' + k] !== undefined ? style['cw_' + k] : P['cw_' + k];
    if (v !== undefined) rows[k] = +v;
  }
  const pts = m.eng ? m.eng.pts : [];
  const core = pts.filter(p => p[3] === 1 && p[2] <= len.zEnd + 0.05);
  const heads = pts.filter(p => p[3] === 2 && p[2] <= len.zEnd + 0.05);
  // 5. width and height over MOST of the engine — the core (case, sump,
  // carburettor, accessories) by the barrel's taper alone; a round engine's
  // heads ARE its outline, so they go in with it
  const cap = m.face.synthetic ? 4 : round ? GROW_RADIAL : GROW_HI;
  const grow = { grow: true, cap, aftW0: rows.aftW, deckH0: rows.deckH, keelH0: rows.keelH };
  solveCover(CW, rows, round ? core.concat(heads) : core, bowl.T, { grow: false });
  // 6. cheeks over the heads that still stand out
  let ch = { lobeN: 0 };
  if (!round && heads.length) {
    ch = cheeksOverHeads(CW, rows, heads, bowl.T);
    if (ch.lobeN) Object.assign(rows, ch);
    if (ch.why) notes.push('cheeks: ' + ch.why);
  }
  // what neither reached, the firewall section takes (per side, capped)
  solveCover(CW, rows, core.concat(heads), bowl.T, grow);
  if (!m.face.synthetic && (rows.aftW > r3(sec.aftW) + 0.002 || rows.deckH > r3(sec.deckH) + 0.002 || rows.keelH > r3(sec.keelH) + 0.002))
    notes.push('firewall section grown for the engine: half-width ' + r3(sec.aftW) + ' -> ' + rows.aftW +
               ', top ' + r3(sec.deckH * sec.aftH) + ' -> ' + r3(rows.deckH * rows.aftH) +
               ', bottom ' + r3(-sec.keelH * sec.aftH) + ' -> ' + r3(-rows.keelH * rows.aftH));
  // the rows, as the panel keeps them
  const vals = { fitNose: 0 };
  if (style) for (const k in style) if (k !== 'fitNose') vals[k] = style[k];
  for (const k of ['aftW', 'aftH', 'deckH', 'keelH', 'waist', 'sqAftTop', 'sqAftBot', 'cowlLen', 'lidLen',
                   'taperW', 'taperH', 'lidRise', 'faceRise', 'lidMode', 'lidGap', 'noseOff', 'apOffY', 'lobeN'])
    vals['cw_' + k] = rows[k];
  if (rows.lobeN) for (const k of ['lobeAmp', 'lobeT', 'lobeAz', 'lobeSig', 'lobeTSig']) vals['cw_' + k] = rows[k];
  // THE PHYSICS' COWL (60_gen_spec 4c): the nose section of the flown loft,
  // about the THRUSTLINE — the barrel end the fit drew; cheeks count on the
  // flanks (they are what covers the heads, which is what the drag build-up
  // asks of `halfW`). The fields' own clamps.
  const hEnd = rows.aftH * rows.taperH;
  const physics = {
    halfW: r3(clamp(rows.aftW * rows.taperW + (rows.lobeN && Math.abs(rows.lobeAz) <= 30 ? rows.lobeAmp : 0), 0.05, 1.10)),
    top: r3(clamp(rows.lidRise + rows.deckH * hEnd - bowl.T, 0.03, 1.10)),
    bot: r3(clamp(bowl.T - (rows.lidRise - rows.keelH * hEnd), 0.03, 1.10)),
  };
  const check = cowlFitCheck(Object.assign({}, P, vals), { measured: m });
  if (check && check.outside)
    notes.push('engine not fully enclosed at the rows\' limits: ' + check.outside + ' points, worst ' +
               check.worst + ' m at ' + JSON.stringify(check.worstAt));
  return { vals, physics, rows,
           report: { arch, kind: m.unit.kind, face: { halfW: r3(m.face.halfW), halfH: r3(m.face.halfH) },
                     body: m.body ? { d: m.body.d, halfW: r3(m.body.halfW), top: r3(m.body.top), bot: r3(m.body.bot), waist: r3(m.body.waist) } : null,
                     spinBase: r3(len.spinBase), zEnd: r3(len.zEnd), T: bowl.T,
                     cheeks: ch.lobeN ? { amp: ch.lobeAmp, t: ch.lobeT, az: ch.lobeAz } : null,
                     notes, check } };
}

// ---- THE VERDICT on P's current rows -------------------------------------------
// outside: engine points (core + heads; pipes and mount hardware excluded —
// a pipe goes through the cowl on purpose) standing outside the skin by more
// than `tol`; fire*: the cowl's aft section against the body's slice, radial
// distance by bearing about the section centre (a step at the joint).
function cowlFitCheck(P, opts) {
  const L = lib();
  const m = (opts && opts.measured) || cowlFitMeasure(P, opts);
  if (!m) return null;
  const CW = L.CW, tol = opts && opts.tol != null ? opts.tol : 0.005;
  const rows = {};
  for (const k of COWL_KEYS) if (P['cw_' + k] !== undefined) rows[k] = +P['cw_' + k];
  const T = (+P.cw_lidRise || 0) + (+P.cw_faceRise || 0) + (+P.cw_apOffY || 0) + (+P.engY || 0);
  if (Math.round(P.fitNose) === 1 || Math.round(P.fitNose) === 2) { rows.aftW = m.face.halfW; rows.aftH = m.face.halfH; }
  let outside = 0, n = 0, worst = 0, worstAt = null, fireMean = null, fireMax = null, zEnd = 0;
  withCowl(CW, rows, () => {
    zEnd = CW.zEnd();
    // the engine's metal only up to the spinner: what is ahead of the ring
    // is the spinner's and the crank flange's
    for (const p of m.eng ? m.eng.pts : []) {
      if (p[3] === 3 || p[2] > zEnd - 0.005) continue;
      n++;
      const o = outsideBy(CW, p[0], p[1] + T, p[2]);
      if (o.out > tol) { outside++; if (o.out > worst) { worst = o.out; worstAt = [r3(p[0]), r3(p[1] + T), r3(p[2])]; } }
    }
    if (m.body && Math.round(P.fitNose) !== 1) {
      // the cowl's aft ring vs the body slice, by bearing about (0, 0)
      const z = CW.aftStart ? CW.aftStart() + 1e-4 : 1e-4;
      const ring = [];
      for (let k = 0; k < 144; k++) { const p = CW.surfPoint(k / 144 * Math.PI * 2, z); ring.push([Math.atan2(p[1], p[0]), Math.hypot(p[0], p[1])]); }
      const rAt = (arr, a) => {   // polar radius at bearing a, nearest two samples
        let best = null, bd = 9;
        for (const [b, r] of arr) { const d = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))); if (d < bd) { bd = d; best = r; } }
        return best;
      };
      const body = m.body.pts.map(([x, y]) => [Math.atan2(y, x), Math.hypot(x, y)])
        .concat(m.body.pts.map(([x, y]) => [Math.atan2(y, -x), Math.hypot(x, y)]));
      let s = 0, c = 0, mx = 0;
      for (let k = 0; k < 72; k++) {
        const a = -Math.PI + k / 72 * Math.PI * 2;
        const d = Math.abs(rAt(ring, a) - rAt(body, a));
        s += d; c++; mx = Math.max(mx, d);
      }
      fireMean = s / c; fireMax = mx;
    }
  });
  return { n, outside, worst: r3(worst), worstAt, zEnd: r3(zEnd),
           fireMean: fireMean == null ? null : r3(fireMean), fireMax: fireMax == null ? null : r3(fireMax),
           kind: m.unit.kind, synthetic: !!m.face.synthetic, arch: m.eng ? m.eng.arch : null };
}

const API = { cowlFit, cowlFitMeasure, cowlFitCheck,
              CONST: { SLICE_D, RING_LEAD, RING_GAP, SPIN_CLEAR, CLR, FW_SKIP, EXH_THROUGH,
                       TAPER_LO, TAPER_HI, GROW_HI, CHEEK_MAX, CHEEK_FLANK } };
if (NODE) module.exports = API;
W.COWL_FIT = API;
})();
