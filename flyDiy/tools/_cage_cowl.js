// CAGE COWL LAYER — the cowl and the propeller, on the nose of the aeroplane.
//
// The cowl generator was developed standalone on the web and ported verbatim
// into _cowl_gen.js (checked bit-exact against the original by
// _cowl_check.js). This is the half that makes it part of the aeroplane rather
// than a bench exhibit: it bolts the cowl to the cage's own ENGINE FACE and
// hangs the propeller off the front of it.
//
// WHERE IT GOES, and why it is not a guess. The cage already emits the nose
// aperture — the flat face the engine bolts to — and MARKS those faces at
// emission with `capFace` so they survive subdivision (G13: "the engine nose
// grid has no distinctive material, so marks not materials"). This layer reads
// that mark. So the cowl sits on the firewall the fuselage actually has, and
// follows it when the nose is edited, instead of being placed at a station
// somebody typed in.
//
// AND ITS AFT SECTION IS THAT FACE. A cowl's back end is the firewall; those
// are not two numbers that ought to agree, they are one number. `fitNose`
// takes the aperture's own half-width and half-height, so a wider nose gives a
// wider cowl with nothing to keep in step by hand.
//
// FRAMES. The cowl generator works with the firewall at z = 0 and runs FORWARD
// in +z; the cage's nose is +z too, so the group only has to be translated to
// the aperture. Everything here is metric and unscaled — the cowl was authored
// in metres and the aeroplane is worn at planeScale, the crew layer's rule.
//
// Load after _cage_gen (needs the mesh) and before _cage_ui; chains PAGE.post.
'use strict';
(() => {

const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const CW = window.COWL_GEN, CG2 = window.CAGE2, EG = window.ENG_GEN,
      GG = window.GEAR_GEN;
if (!CW) { console.error('cage cowl layer: _cowl_gen.js not loaded'); return; }

// ---- parameters -----------------------------------------------------------
// THE TOOL'S OWN PANEL, from _cowl_rows.js — every control it declares, with
// its label, range and relevance condition, extracted rather than retyped.
//
// The first cut of this file hand-picked ~35 keys and three of them ('apY',
// 'apSpread', 'apN') are not parameters of the cowl at all. An unknown key
// makes no row and no noise, so the aperture OFFSETS and two thirds of the
// chin scoop were simply absent — and a scoop driven by three of its nine
// numbers renders badly, because the other six are whatever the preset left.
const ROWS = window.COWL_ROWS || [];
// The aft termination is the BENCH'S STUB FUSELAGE (its own group in the
// tool). This page has a real fuselage and does not draw it, so its controls
// would move nothing. g_mesh's one row (detail) moved to the page's
// polycount group (G28); the spinner and propeller groups moved to the
// ENGINE layer (G29 — they are the engine's children now), which re-homes
// their rows and builds their meshes. Their VALUES still ride through
// CW.P (SHOWN keeps them), so the tool stays one parameter set.
const SKIP_GROUPS = new Set(['g_aft', 'g_mesh', 'g_spin', 'g_prop']);

const SHOWN = [];
for (const g of ROWS) {
  if (g.id === 'g_aft') continue;
  for (const r of g.rows) if (CW.P[r.k] !== undefined) SHOWN.push(r.k);
}
const cowlDef = { cowlOn: 1, fitNose: 1, cowlGap: 0.0 };
for (const k of SHOWN) cowlDef['cw_' + k] = CW.P[k];
PAGE.defaults = Object.assign(cowlDef, PAGE.defaults || {});

// ---- panel ----------------------------------------------------------------
// the 'material' names entry is an extraction artifact (the tool built
// them at runtime) — the real list lives in CW.MATERIALS
const rowNames = r => r.k === 'material' && CW.MATERIALS
  ? CW.MATERIALS.map(mm => mm.name) : r.names;
const groupItems = g => g.rows
  .filter(r => CW.P[r.k] !== undefined)
  .map(r => ['cw_' + r.k, r.label, r.lo,
             r.k === 'material' && CW.MATERIALS ? CW.MATERIALS.length - 1
                                                : r.hi,
             r.step, rowNames(r)]);

const GROUP = ['2b · cowl', [
  ['cowlOn',  'cowl',            0, 1, 1],
  ['fitNose', 'fit to the nose', 0, 2, 1,
   ['free (tool only)', 'fitted (size + section)', 'sealed (size only)'],
   { when: P => +P.cowlOn }],
  ['cowlGap', 'stand-off from face', -0.05, 0.15, 0.002,
   { when: P => +P.cowlOn }],
].concat(ROWS.filter(g => !SKIP_GROUPS.has(g.id))
             .map(g => [g.name.toLowerCase(), groupItems(g),
                        g.id === 'g_body' || g.id === 'g_scoop' ? 'open' : undefined,
                        { when: P => +P.cowlOn }]))];
(PAGE.groupsOverride || (PAGE.groups = PAGE.groups || [])).push(GROUP);

// ---- WHAT IS LOCKED, AND WHAT DOES NOT APPLY ------------------------------
// Two different reasons a control should not be touched, and they read
// differently on purpose:
//   LOCKED    the fuselage is deciding this one — greyed, and its value still
//             shown, because the number is informative even when it is not
//             yours to set
//   HIDDEN    the tool's own `when`: the control does not apply at all in this
//             configuration (an end radius on a cone matched to the spinner)
const LOCK_SIZE = ['aftW', 'aftH'];
const LOCK_SECTION = ['sqAftTop', 'sqAftBot', 'deckH', 'keelH', 'waist'];
const lockedFor = mode =>
  mode === 1 ? LOCK_SIZE.concat(LOCK_SECTION, ['inheritStub'])
  : mode === 2 ? LOCK_SIZE.concat(['inheritStub'])
  : ['inheritStub'];

// the tool's conditions are source text over its own P; compile once
const WHENS = {};
for (const g of ROWS) for (const r of g.rows) {
  if (!r.when) continue;
  try { WHENS[r.k] = new Function('P', 'return (' + r.when + ');'); }
  catch (e) { /* a condition that will not compile simply never hides */ }
}
// G28 AUDIT: relevance the tool's own rows never declared. The seam and
// scoop sets follow their master toggles, the aperture dims follow the
// mode that draws them, and the STUB section rows are dead here by
// construction (inheritStub is forced 0 on this page) so they never
// show. Supplemental, never overriding a tool `when` that says hide.
const scoopW = Q => Q.scoopOn > 0;
const apOne = Q => { const m2 = Math.round(Q.apMode); return m2 === 1 || m2 === 3; };
const apPair = Q => Math.round(Q.apMode) >= 2;
const dead = () => false;
const WHEN_EXTRA = {
  seamType: Q => Q.seamOn > 0, seamPos: Q => Q.seamOn > 0,
  seamWidth: Q => Q.seamOn > 0, seamDepth: Q => Q.seamOn > 0,
  scoopLen: scoopW, scoopW: scoopW, scoopH: scoopW, scoopSq: scoopW,
  scoopLipH: scoopW, scoopDrop: scoopW, scoopRake: scoopW, scoopAp: scoopW,
  scoopLipDepth: scoopW, scoopDuct: scoopW,
  apW: apOne, apH: apOne, apSq: apOne, apOffX: apOne, apOffY: apOne,
  pairX: apPair, pairW: apPair, pairH: apPair, pairY: apPair, pairSq: apPair,
  stubDeckH: dead, stubWaist: dead, stubKeelH: dead,
  stubSqTop: dead, stubSqBot: dead,
};
function applyRowStates(mode) {
  const locked = new Set(lockedFor(mode));
  for (const k of SHOWN) {
    const el = document.getElementById('p_cw_' + k);
    if (!el) continue;
    const rowEl = el.parentElement;
    let show = true;
    if (WHENS[k]) { try { show = !!WHENS[k](CW.P); } catch (e) { show = true; } }
    if (show && WHEN_EXTRA[k]) {
      try { show = !!WHEN_EXTRA[k](CW.P); } catch (e) { show = true; }
    }
    rowEl.style.display = show ? '' : 'none';
    const lock = locked.has(k);
    el.disabled = lock;
    rowEl.style.opacity = lock ? 0.42 : '';
    rowEl.title = lock
      ? 'set by the fuselage — change "fit to the nose" to take it back'
      : '';
  }
}

// THE PANEL MUST READ WHAT THE COWL IS. In `fitted` the body decides the aft
// section, so the sliders that describe it have to follow — otherwise the panel
// shows the last value the builder set while the aeroplane shows another. It
// also means switching fitted -> sealed HANDS OVER the shape the body chose
// rather than snapping back to a stale one.
const FITTED_KEYS = ['aftW', 'aftH', 'sqAftTop', 'sqAftBot',
                     'deckH', 'keelH', 'waist'];
let LIVE_P = null;
function syncFitted() {
  if (!LIVE_P) return;
  for (const k of FITTED_KEYS)
    if (CW.P[k] !== undefined && LIVE_P['cw_' + k] !== undefined)
      LIVE_P['cw_' + k] = CW.P[k];
  const UI = window.CAGE_UI;
  if (UI && UI.syncSliders) UI.syncSliders();
}

// ---- materials ------------------------------------------------------------
// the powerplant bench's set, rebuilt here: makeMats() lives in that page, not
// in the module, so a second consumer needs its own
// AEROSKIN (G70): a cowl is SHEET METAL on every aeroplane, fabric ones
// included — it is the panel that takes the heat, the oil and a fastener
// every hundred millimetres, and nobody has ever covered one in cloth. So
// `AERO_HARD.cowl` sends the skin to alclad whatever the fuselage behind it
// is made of, which is a statement about aeroplanes rather than a default.
//
// NOT MEMOISED across the switch: `mats()` caches, so the AEROSKIN answer is
// asked for first and the cache below stays exactly the fallback it was.
// THE COWL ALPHA (G29) IS PART OF THE MATERIAL, not something done to it
// afterwards. AEROSKIN materials are POOLED on their look, so mutating one
// in place would reach through the pool into whoever else asked for the same
// finish; the opacity therefore goes into the key, exactly as the cage's own
// sections already pass theirs. The dial has 20 stops, so the pool is bounded
// and every material on it shares one program and one sheet.
const AKC = () => (typeof window !== 'undefined' && window.AEROSKIN) || null;
function cowlMats(cA) {
  const A = AKC(), base = mats(), out = {};
  for (const nm of Object.keys(base)) {
    const b = base[nm];
    // A COWL AGES FASTER THAN WHAT IT IS BOLTED TO. It is the panel that
    // catches the exhaust, the oil weep and every hand that has ever opened
    // it, and — since the streaks live in the surface field and the cowl has
    // none — a higher rate is also the honest way to say "the soot starts
    // here" on the one surface that cannot draw the trail.
    // the cowl SKIN is the builder's to paint (phase C): its own livery
    // section, alclad by default, borrowing the fuselage's colour; the
    // faster ageing rides along. host/dark/steel stay hardware.
    if (nm === 'skin' && typeof window !== 'undefined' && window.CAGE_SECMAT) {
      const ms = window.CAGE_SECMAT('cowlSkin',
        { surf: 0, fieldM: 1, side: THREE.DoubleSide, opacity: cA,
          wearK: 1.5, tint0: b.color.getHex() });
      if (ms) { out[nm] = ms; continue; }
    }
    const m = (A && A.aeroHardMat)
      ? A.aeroHardMat(THREE, 'cowl', nm, b.color.getHex(),
                      { side: THREE.DoubleSide, opacity: cA,
                        wearK: nm === 'skin' ? 1.5 : undefined })
      : null;
    if (m) { out[nm] = m; continue; }
    // the fallback set is mutated in place as it always was — but not the
    // propeller, which is never see-through
    if (nm !== 'prop') {
      b.transparent = cA < 1; b.opacity = cA; b.depthWrite = cA >= 1;
    }
    out[nm] = b;
  }
  return out;
}
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const D = THREE.DoubleSide;
  MATS = {
    skin:  new THREE.MeshStandardMaterial({ color: 0xdfe3e7, metalness: 0.55, roughness: 0.36, side: D }),
    host:  new THREE.MeshStandardMaterial({ color: 0x99a3ad, metalness: 0.40, roughness: 0.55, side: D }),
    dark:  new THREE.MeshStandardMaterial({ color: 0x15181b, metalness: 0.10, roughness: 0.92, side: D }),
    steel: new THREE.MeshStandardMaterial({ color: 0x6d737a, metalness: 0.90, roughness: 0.35, side: D }),
    prop:  new THREE.MeshStandardMaterial({ color: 0xc79a63, metalness: 0.0, roughness: 0.62, side: D }),
  };
  return MATS;
}
// (propMat moved to the engine layer with the blades — G29)

// ---- THE NOSE FACE --------------------------------------------------------
// The cage's engine aperture, read off the marks it carries. The FORWARD one:
// a mirrored pod (S2) has a second aperture at the back, and taking whichever
// came first in the face list would put the cowl on the tail.
// THE MARK DOES NOT ALWAYS SURVIVE, so there are three signals and they are
// tried in order of exactness. Measured on the jodel at L2, all three land on
// the same face (half-width 0.496 / 0.496 / 0.497 m):
//
//   capFace      the emission mark. Exact — but the INTERIOR pass consumes it
//                (11264 faces, 0 marks left) because it uses those faces to
//                build its own firewall, so it is absent whenever the interior
//                is switched on, which is the page default.
//   'firewall'   the inboard copy the interior pass makes from them. Present
//                exactly when capFace is not, which is what makes the pair
//                complete — but only if intFire is on.
//   'pillarFront' the aperture band's material. Always there, and 11 mm
//                further aft because the band has depth; the stand-off slider
//                covers that.
function noseFace(mesh, FS) {
  if (!mesh || !mesh.F) return null;
  let caps = mesh.F.filter(f => f.capFace);
  if (!caps.length) caps = mesh.F.filter(f => f.m === 'firewall');
  if (!caps.length) caps = mesh.F.filter(f => f.m === 'pillarFront');
  if (!caps.length) return null;
  let zBest = -Infinity;
  for (const f of caps) for (const i of f.v)
    if (mesh.V[i][2] > zBest) zBest = mesh.V[i][2];
  // keep only the faces belonging to that end
  let x1 = 0, y0 = Infinity, y1 = -Infinity, zs = 0, n = 0;
  for (const f of caps) {
    let fz = -Infinity;
    for (const i of f.v) fz = Math.max(fz, mesh.V[i][2]);
    if (fz < zBest - 0.25) continue;              // the other end's aperture
    for (const i of f.v) {
      const p = mesh.V[i];
      x1 = Math.max(x1, Math.abs(p[0]));
      y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
      zs += p[2]; n++;
    }
  }
  if (!n) return null;
  // The cap is FLAT, so its own vertices give the size exactly. The z window
  // has to be TIGHT: at 0.25 cage units it swept in 0.19 m of a tapering nose
  // and reported the body behind the face instead of the face.
  const z = zs / n * FS;
  let cx = 0, cy0 = Infinity, cy1 = -Infinity, cn = 0;
  for (const f of caps) {
    for (const i of f.v) {
      const p = mesh.V[i];
      if (Math.abs(p[2] * FS - z) > 0.012) continue;
      cx = Math.max(cx, Math.abs(p[0] * FS));
      cy0 = Math.min(cy0, p[1] * FS); cy1 = Math.max(cy1, p[1] * FS);
      cn++;
    }
  }
  if (!cn) return null;
  return { z, halfW: cx, halfH: (cy1 - cy0) / 2, yc: (cy0 + cy1) / 2 };
}

// THE OUTLINE COMES FROM THE CONTRACT, NOT FROM THE CAP'S VERTICES.
// The cap is a GRID (G12's 3-column cap), so most of its vertices are interior
// points, and taking the furthest one per bearing produces a ragged profile
// that is not the outline at all — measured on the jodel it read 0.483 at +30
// degrees and 0.262 at -30, which is not even symmetric on a mirrored body.
//
// `cageAirframe` already bakes the true skin profile: it slices the mesh at a
// station and ray-casts from the section centre, keeping the outermost hit. So
// the shape is read the same way the undercarriage reads it, through the same
// contract, and there is one description of this fuselage rather than two.
//
// AND IT MUST BE SAMPLED WHERE THE SLICE IS DENSE. Right at the nose the cut
// crosses almost no faces, so the bake returns a sliver and its section centre
// with it — measured on the jodel, 2 mm aft of the face it reported a half
// width of 0.043 m and a centre at +0.110 where the face is 0.497 m and
// centred at -0.229. Fitting to that shrank the whole cowl to nothing while
// every error metric said the fit was excellent, because the cowl really had
// matched the thing it was given. So the SIZE comes from the cap (flat, exact)
// and only the SHAPE comes from a slice, taken at the first station aft that
// has grown to most of the cap's width.
function noseSampleZ(AF, z, halfW) {
  for (const d of [0.04, 0.06, 0.08, 0.11, 0.15, 0.20, 0.28]) {
    const zs = z - d;
    if (zs < AF.z0 + 0.01) break;
    let x1 = 0;
    for (let k = 0; k < 48; k++)
      x1 = Math.max(x1, Math.abs(AF.surf(zs, -Math.PI + k / 48 * Math.PI * 2)[0]));
    if (x1 >= 0.9 * halfW) return zs;
  }
  return Math.max(AF.z0 + 0.01, z - 0.08);
}
function noseProfile(AF, z, N) {
  if (!AF) return null;
  const zs = Math.min(AF.z1 - 1e-3, Math.max(AF.z0 + 1e-3, z));
  const pts = [];
  for (let k = 0; k < N; k++) {
    const ang = -Math.PI + k / N * Math.PI * 2;   // 0 = straight down (keel)
    const p = AF.surf(zs, ang);
    pts.push([p[0], p[1]]);
  }
  let x1 = 0, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x1 = Math.max(x1, Math.abs(x));
    y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const yc = (y0 + y1) / 2, halfW = x1, halfH = (y1 - y0) / 2;
  const uv = pts.map(([x, y]) => [Math.abs(x) / (halfW || 1),
                                  (y - yc) / (halfH || 1)]);
  // WHERE THE SECTION IS WIDEST, as a fraction of the half-height. The cowl
  // calls this the waist, and on a drooping nose it is not the mid-height —
  // left at the stub's value it tilts the join.
  let wy = 0, wx = -1;
  for (const [u, v] of uv) if (u > wx) { wx = u; wy = v; }
  return { halfW, halfH, yc, uv,
           waist: Math.max(-0.85, Math.min(0.85, wy)) };
}

// ---- THE SECTION, NOT JUST THE BOX ---------------------------------------
// Matching half-width and half-height is NOT matching a shape. Measured on the
// jodel with both exact: the cowl's outline still ran 290 mm proud of the
// fuselage at 45 degrees, because a superellipse is far fuller at the corners
// than the cage's nose section — a visible step all the way round the joint,
// and exactly the sort of thing two agreeing numbers hide.
//
// So the SQUARENESS is fitted too. A cowl section is |u|^n + |v|^n = 1 in the
// face's own box, so every outline point implies an n; bisect for it, take the
// MEDIAN over the points that are actually informative (near an axis, u or v
// is ~1 and n is undetermined), and do the halves separately because a drooping
// nose is not the same shape above and below.
//
// `sqExp` maps the panel's 0..1 squareness onto n, so this inverts it:
//   s < 0.5 : n = 1 + 2s          ->  s = (n - 1) / 2
//   s >= 0.5: n = 2 * 5^(2s-1)    ->  s = 0.5 + ln(n/2) / (2 ln 5)
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
const median = a => {
  if (!a.length) return null;
  const b = a.slice().sort((x, y) => x - y);
  return b[b.length >> 1];
};
function fitSection(face) {
  if (!face || !face.uv || !face.uv.length) return null;
  const top = [], bot = [];
  for (const [u, v] of face.uv) {
    const au = Math.abs(u), av = Math.abs(v);
    // both coordinates have to carry information: on an axis the exponent is
    // unconstrained, and a point outside the box cannot be solved at all
    if (au < 0.20 || av < 0.20 || au > 0.999 || av > 0.999) continue;
    (v >= 0 ? top : bot).push(nOf(au, av));
  }
  return { top: median(top), bot: median(bot) };
}

// ---- build ----------------------------------------------------------------
let group = null;
const dispose = o => {
  if (!o) return;
  o.traverse(c => { if (c.geometry) c.geometry.dispose(); });
  if (o.parent) o.parent.remove(o);
};

const prevPost = PAGE.post;
PAGE.post = ctx => {
  if (prevPost) prevPost(ctx);
  const { scene, mesh, P, stat } = ctx;
  dispose(group); group = null;
  if (!P.cowlOn) return;

  LIVE_P = P;
  const FS = (CG2 && CG2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const station = noseFace(mesh, FS);
  if (!station) { if (stat) stat.textContent += '  ·  cowl: no engine face on this body'; return; }
  const AF = GG ? GG.cageAirframe(mesh, FS) : null;
  // SIZE from the cap, SHAPE from the first dense slice behind it
  const prof = AF ? noseProfile(AF, noseSampleZ(AF, station.z, station.halfW), 180)
                  : null;
  const face = Object.assign({}, station,
    prof ? { uv: prof.uv, waist: prof.waist } : { uv: null, waist: 0 });

  // push the panel's values into the cowl's own parameter set
  for (const k of SHOWN) {
    const v = P['cw_' + k];
    if (v !== undefined && CW.P[k] !== undefined) CW.P[k] = v;
  }
  // THE AFT SECTION IS THE FIREWALL — its size AND its shape. One section, not
  // two that are asked to agree.
  // THE STUB NEVER SHAPES THE COWL HERE, whatever the fit mode. `inheritStub`
  // makes eSqAftTop / eSqAftBot / eDeckH / eKeelH / eWaist read `stubSqTop` and
  // friends, and those are not on this panel — so leaving it set would make the
  // aft-section sliders below dead controls, which is the same trap in a
  // different direction. Off always; the fuselage or the builder decides.
  CW.P.inheritStub = 0;

  // FIT MODES. The cowl's back end IS the firewall, but "fits the firewall" and
  // "is shaped like the firewall" are two claims, and a builder may want only
  // the first — a cowl that seals to the nose and is then drawn by eye is a
  // real thing to want, and it is how most of the tool's presets were made.
  //   0 free       nothing inherited; the tool's own controls, entirely
  //   1 fitted     size AND section from the body (the default)
  //   2 sealed     size from the body, SECTION from the tool's controls
  const mode = Math.round(P.fitNose);
  let fit = null;
  if (mode === 1 || mode === 2) {
    CW.P.aftW = face.halfW;
    CW.P.aftH = face.halfH;
  }
  if (mode === 1) {
    // SECTION FROM THE BODY. yc is the face's mid-height, so the two halves are
    // equal by construction and the deck/keel scalings must not then shorten
    // one of them.
    CW.P.deckH = 1; CW.P.keelH = 1;
    CW.P.waist = face.waist;
    fit = fitSection(face);
    if (fit && fit.top) CW.P.sqAftTop = sqOf(fit.top);
    if (fit && fit.bot) CW.P.sqAftBot = sqOf(fit.bot);
    // and put the fitted values back on the panel, so the sliders read what the
    // cowl is rather than what it was before the body decided
    syncFitted();
  }

  CW.prepareLid();
  CW.prepareMesh();
  // COWL ALPHA (G29, user): see the engine through the shell. The view panel
  // owns the dial (viewer state, never spec) and the materials are built to
  // it — read HERE, before the shell is built, because the alpha is now part
  // of which material this is rather than a property set on it afterwards.
  const cA = (window.CAGE_VIEW && window.CAGE_VIEW.cowlA != null)
    ? window.CAGE_VIEW.cowlA : 1;
  const M = cowlMats(cA), aps = CW.apertureList();

  group = new THREE.Group();
  // NAMED for the editor (G76/G77): the part table says which layer a
  // part lives in, and G79's raycast resolves a hit to a part through
  // that. One string, no behaviour.
  group.name = 'cageLayer:cowl';
  const cowl = new THREE.Group();
  CW.buildSurface(cowl, M, aps);
  CW.buildLips(cowl, M, aps);
  CW.buildScoop(cowl, M);
  // G94: the fasteners, the parting line and the oil door — the three things
  // that say this panel comes off. Guarded, because the cowl module is shared
  // with a bench that may predate them.
  if (CW.buildDetail) CW.buildDetail(cowl, M);
  // NO buildAft — THE STUB FUSELAGE IS NOT DRAWN HERE.
  // `buildAft` is the bench's stand-in for the aeroplane: at aftMode 0 it lofts
  // a constant section aft from the firewall in `mats.host`, and at aftMode 1 a
  // pod tail cone. On the bench that is what gives the cowl something to sit
  // against; here the real fuselage IS the thing it sits against, and drawing
  // both put a grey blob between the cage's nose and the cowl. Same move the
  // gear layer makes with `stubAirframe`: the stub exists so the module can be
  // developed alone, and integration is exactly the moment it goes away.
  group.add(cowl);
  // (the nose cone and the propeller are the ENGINE's children now — G29;
  // _cage_eng.js builds them on the crank)

  // ON THE FACE. The cowl's own origin is its firewall, so the group only has
  // to move to the aperture's centre — x on the centreline, y at the face's
  // middle (which is NOT y = 0: a drooping nose puts it well below), z at the
  // face itself plus whatever stand-off the builder asked for.
  group.position.set(0, face.yc, face.z + (P.cowlGap || 0));
  // THE COWL SHELL EXPLODES WITH THE AIRFRAME (G28, user), forward off
  // the face, scaled like the cage parts (explodeD is cage units, this
  // group is metres, so × FS); the engine layer stages the cone and the
  // blades beyond it
  const ex = Math.max(0, P.explodeD || 0) * FS;
  if (ex > 0) cowl.position.z += ex * 0.9;
  scene.add(group);

  applyRowStates(mode);
  window.CAGE_COWL = { face, len: CW.zEnd(), aps: aps.length, mode };
  if (stat) {
    stat.textContent += `  ·  cowl: face ${(face.halfW * 2).toFixed(2)}×` +
      `${(face.halfH * 2).toFixed(2)} at z ${face.z.toFixed(2)} · ` +
      `${(CW.zEnd() * 1000).toFixed(0)} mm long`;
  }
};
// the engine layer reads the same nose face (G29) — one description of
// where the firewall is, not two
window.CAGE_NOSE = { noseFace };
})();
