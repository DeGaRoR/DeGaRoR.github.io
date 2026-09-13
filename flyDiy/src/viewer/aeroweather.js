// aeroweather.js — THE WEATHERING (G345). What time, flying, grass strips and
// rain do to the aeroplane's surfaces, as ONE module that aeroskin.js splices
// into its hooks. It replaces G70's single condition dial (four masks on
// `uWear.x`, streaks in the surface field only, engine 0 and wheel 0 only,
// never set on the flown build, glass untouched) with layers placed from
// measured sources in CRAFT SPACE — so a plume reaches the cowl and the
// spats, a wheel throws mud on a strut, and the cabin ages inside.
//
// THE FOUR MACROS ride the shared `uWear` vector, one per component:
//   x AGE      what years do: chalking, fade, chips at every edge, rust on
//              steel, roughness up on everything, the cabin's edges worn bare
//   y FLIGHT   what flying does: exhaust soot, top dust, belly dirt, insects
//              on every forward face, aft-swept streaks, fingerprints
//   z BUSH     what grass and dirt strips do: mud thrown by every wheel,
//              thick dirt in the depressions and corners — absent otherwise
//   w RAIN     what parking outside does: drips down every flank, rust
//              bleed, dust WASHED off the tops (a negative coefficient)
// A fine LAYER strength is a clamped sum of macro x coefficient, resolved on
// the CPU (aeroWxResolve) and uploaded as uWxL — the shader never sees the
// coefficient table, and a bench "fine slider" is a PIN on one resolved
// value. Every number below is a TABLE ENTRY (RENDERER-DECISION §4b: the
// r128 -> current upgrade recalibrates by table edit, not by archaeology).
//
// NO SHINY DIRT OR MUD (the user's ruling), as one invariant block after
// every mask: roughness saturates UP to the layer's own floor (>= 0.85, the
// tar exempt), metalness falls with cover, the clear coat falls with cover,
// dust fills the microsurface toward the smooth normal. A CHIP is not dirt:
// it exposes the SUBSTRATE (bare alloy may be metallic) and is applied after
// the invariants.
//
// THE RULES THIS FILE IS BUILT ON (each one paid for elsewhere in the tree):
//   * it loads BEFORE aeroskin.js. r128 keys the program on the hook's own
//     source; aeroskin reads `AEROWX` at hook time, so a page that loaded
//     this late would compile the weather-less program under the same key.
//   * it stamps NOTHING on material.userData: the per-material uniforms are
//     pure functions of the finish, which already crosses the join.
//   * every number the shader reads is a UNIFORM; nothing per-material is
//     interpolated into the GLSL (the one program-cache rule).
//   * no backtick and no ${ inside the GLSL template literals; no `continue`
//     in a texture loop; every loop bound a #define and every break on a
//     uniform; every texture2D inside the `if (aeroWxOn > 0.0)` block.
//   * placement is CRAFT SPACE (vCraftPos / vCraftNrm: metres, x lateral,
//     y aft, z up, identical on every layer) — never vObjPos, never uFieldM.
//   * zero new varyings.
// GATE WEATHER (tools/_weather_check.js) holds each of these on the source.
'use strict';

// ---------------------------------------------------------------------------
// THE TABLES
// ---------------------------------------------------------------------------
const AERO_WX_MACRO = ['age', 'flight', 'bush', 'rain'];

// THE LAYERS, in uWxL slot order (the shader unpacks by this order — the
// unpack text is GENERATED from this table below, so the two cannot drift).
// c = [age, flight, bush, rain] coefficients; strength = clamp(sum, 0, 1).
// A negative coefficient is a wash: rain takes dust and insects off.
const AERO_WX_LAYERS = [
  { k: 'dust',    label: 'dust on the tops',            c: [0.15, 0.55, 0.30, -0.35] },
  { k: 'belly',   label: 'belly dirt',                  c: [0.10, 0.60, 0.50,  0.10] },
  { k: 'cav',     label: 'dirt in rivets, seams, sag',  c: [0.30, 0.50, 0.30,  0.20] },
  { k: 'dep',     label: 'dirt in depressions',         c: [0.30, 0.35, 0.40,  0.20] },
  { k: 'fade',    label: 'paint fade, patchy',          c: [0.90, 0.10, 0.00,  0.00] },
  { k: 'chalk',   label: 'chalking on the tops',        c: [0.70, 0.15, 0.00,  0.00] },
  { k: 'rough',   label: 'roughness floor',             c: [0.80, 0.20, 0.00,  0.10] },
  { k: 'panel',   label: 'panel-to-panel tone',         c: [0.60, 0.20, 0.00,  0.00] },
  { k: 'exhaust', label: 'exhaust soot',                c: [0.20, 0.85, 0.10, -0.10] },
  { k: 'mud',     label: 'wheel mud',                   c: [0.00, 0.00, 1.00,  0.15] },
  { k: 'bug',     label: 'insects, forward faces',      c: [0.05, 0.70, 0.20, -0.50] },
  { k: 'streakA', label: 'streaks swept aft',           c: [0.20, 0.60, 0.20,  0.30] },
  { k: 'streakD', label: 'drips down the flanks',       c: [0.10, 0.00, 0.10,  0.90] },
  { k: 'chip',    label: 'chips and peel at the edges', c: [0.85, 0.20, 0.10,  0.00] },
  { k: 'rust',    label: 'rust on steel',               c: [0.60, 0.00, 0.10,  0.50] },
  // G345.3: PARSIMONIOUS — hangar rash is rare, short and mostly age
  { k: 'scratch', label: 'scratches along the flanks',  c: [0.16, 0.04, 0.06,  0.00] },
  { k: 'impact',  label: 'stone chips, forward faces',  c: [0.20, 0.50, 0.60,  0.00] },
  { k: 'tar',     label: 'tar and oil spots',           c: [0.30, 0.50, 0.10,  0.00] },
  { k: 'corner',  label: 'cabin corners and floor',     c: [0.50, 0.30, 0.40,  0.10] },
  { k: 'hands',   label: 'fingerprints, interior',      c: [0.30, 0.60, 0.00,  0.00] },
  { k: 'gDust',   label: 'glass: dust film',            c: [0.20, 0.45, 0.35, -0.30] },
  { k: 'gEdge',   label: 'glass: grime at the frame',   c: [0.60, 0.30, 0.20,  0.20] },
  // THE GLASS RULINGS (the user: "stuff you put on the glass very easily
  // becomes unreadable and annoying speckles"): the two albedo-bearing glass
  // layers exist and ship OFF. A coefficient goes positive only after the
  // bench's legibility measurement admits it.
  { k: 'gRain',   label: 'glass: rain spots (off)',     c: [0.00, 0.00, 0.00,  0.00] },
  { k: 'gBug',    label: 'glass: insects (off)',        c: [0.00, 0.00, 0.00,  0.00] },
  // G345.2: the CLEAR COAT PEELS in patches (the user: "clearcoat peeling")
  // — no colour of its own, a roughness and the loss of the clear lobe
  { k: 'peel',    label: 'clear coat peeling',          c: [0.80, 0.15, 0.00,  0.15] },
];
const AERO_WX_NL = 7;                      // vec4 slots: 28 layers
if (AERO_WX_LAYERS.length > AERO_WX_NL * 4)
  throw new Error('aeroweather: more layers than uWxL slots');

// THE PALETTE, LINEAR, with each dirt's roughness FLOOR in w. Dust is a
// COLOUR, not a multiplier (G70, measured): it darkens a light surface and
// LIGHTENS a black tyre, which is the only way a tyre ever reads as dirty.
const AERO_WX_COL = [
  { k: 'dust',   v: [0.100, 0.088, 0.072, 0.88] },   // 0 pale dry dust
  { k: 'dirt',   v: [0.130, 0.104, 0.076, 0.90] },   // 1 pale brown dry dirt
  { k: 'mud',    v: [0.085, 0.062, 0.040, 0.95] },   // 2 thick darker mud
  { k: 'soot',   v: [0.045, 0.040, 0.036, 0.92] },   // 3 exhaust soot
  { k: 'bug',    v: [0.060, 0.045, 0.030, 0.85] },   // 4 an insect
  { k: 'tar',    v: [0.030, 0.028, 0.025, 0.60] },   // 5 tar / oil — the one glossy dirt
  { k: 'rust',   v: [0.200, 0.075, 0.030, 0.95] },   // 6 rust
  { k: 'grime',  v: [0.070, 0.060, 0.048, 0.92] },   // 7 the dark line in a seam
];
// which colours may sit under 0.85 — tar is oily, everything else is powder
const AERO_WX_GLOSS_OK = ['tar'];

// THE KNOBS the shader reads as two vec4s (all in the lab)
const AERO_WX_KNOB = {
  dustFlat:  0.60,   // uWxR.x  how far dust fills the microsurface (normal -> smooth)
  ccRough:   0.50,   // uWxR.y  clear-coat roughness a full cover adds
  kappaMax:  40.0,   // uWxR.z  1/m: curvature at which concave/convex saturate (40: a wing tip's gentle round is not an edge)
  bugTile:   0.30,   // uWxR.w  m, the insects' cell tile
  fineTile:  0.35,   // uWxG.x  m, the fine mottle / cells
  coarseTile: 2.40,  // uWxG.y  m, the large blotch
  streakAcross: 0.22,// uWxG.z  m, streak width period
  streakAlong: 2.60, // uWxG.w  m, streak length period
  // THE TURNING PARTS (G345.1): a blade's radius and a spinner's, in metres
  // (the dirt weights by them), the leading edge's erosion gain, the gain on
  // what the rotation flings outward
  propR:     0.95,   // uWxT.x  m, a blade's tip radius
  spinR:     0.15,   // uWxT.y  m, the spinner's base radius
  leGain:    1.00,   // uWxT.z  leading-edge insects and stone pits
  flingGain: 1.00,   // uWxT.w  centrifugal streaks
  // G345.3: the crevices and the scratches
  creviceGain: 1.6,  // uWxV.x  dirt in the rivet flanks, seams, grooves and the cowl's joints
  seamW:     0.035,  // uWxV.y  m, how far the cowl's joint dirt spreads
  scratchLen: 0.45,  // uWxV.z  m, a scratch's length period
  scratchAcross: 0.03, // uWxV.w m, a scratch's width period
};
// THE SPINNER'S SPIRAL (the user: "the little typical spiral and choose its
// colour"): a marking, so it lives in the decal block (AERO_DEC_DEF's
// spiral* keys, deviations in finish.decals) and is painted here in the
// spinner's own polar frame — one stroke, thin at the tip and widening to
// the base, turning with the cone. Null colour = white.
const AERO_WX_SPIRAL_DEF = { spiralOn: 0, spiralCol: null, spiralHand: 0, spiralPitch: 0.10, spiralW: 0.30 };

// THE SUBSTRATE under the paint, per finish: what a chip exposes.
// col linear, metal, rough, rust (1 = it rusts), chip (0 = this finish does
// not chip), hands (1 = a handled surface that takes fingerprints).
const AERO_WX_SUB = {
  fabric:      { col: [0.30, 0.28, 0.22], metal: 0.0,  rough: 0.90, rust: 0, chip: 0.0, hands: 0 },
  ply:         { col: [0.35, 0.22, 0.12], metal: 0.0,  rough: 0.70, rust: 0, chip: 0.6, hands: 0 },
  alclad:      { col: [0.70, 0.71, 0.72], metal: 0.90, rough: 0.40, rust: 0, chip: 1.0, hands: 0 },
  composite:   { col: [0.60, 0.60, 0.58], metal: 0.0,  rough: 0.60, rust: 0, chip: 0.5, hands: 0 },
  bareAlu:     { col: [0.70, 0.71, 0.72], metal: 0.90, rough: 0.45, rust: 0, chip: 0.0, hands: 0 },
  steelTube:   { col: [0.30, 0.12, 0.09], metal: 0.0,  rough: 0.80, rust: 1, chip: 1.0, hands: 0 },
  spruce:      { col: [0.40, 0.27, 0.14], metal: 0.0,  rough: 0.75, rust: 0, chip: 0.5, hands: 0 },
  maple:       { col: [0.45, 0.32, 0.18], metal: 0.0,  rough: 0.75, rust: 0, chip: 0.5, hands: 0 },
  walnut:      { col: [0.22, 0.13, 0.07], metal: 0.0,  rough: 0.75, rust: 0, chip: 0.5, hands: 0 },
  walnutFig:   { col: [0.22, 0.13, 0.07], metal: 0.0,  rough: 0.75, rust: 0, chip: 0.5, hands: 0 },
  rubber:      { col: [0.05, 0.05, 0.05], metal: 0.0,  rough: 0.95, rust: 0, chip: 0.0, hands: 0 },
  liner:       { col: [0.30, 0.28, 0.24], metal: 0.0,  rough: 0.90, rust: 0, chip: 0.0, hands: 0 },
  trim:        { col: [0.70, 0.71, 0.72], metal: 0.90, rough: 0.45, rust: 0, chip: 1.0, hands: 1 },
  fireFoil:    { col: [0.60, 0.60, 0.60], metal: 0.90, rough: 0.50, rust: 0, chip: 0.0, hands: 0 },
  panelMetal:  { col: [0.60, 0.61, 0.62], metal: 0.90, rough: 0.50, rust: 0, chip: 0.0, hands: 1 },
  sillAlu:     { col: [0.60, 0.61, 0.62], metal: 0.90, rough: 0.50, rust: 0, chip: 0.0, hands: 1 },
  leatherDark: { col: [0.06, 0.05, 0.04], metal: 0.0,  rough: 0.70, rust: 0, chip: 0.0, hands: 1 },
  pleatLeather:{ col: [0.10, 0.07, 0.05], metal: 0.0,  rough: 0.72, rust: 0, chip: 0.0, hands: 1 },
  castAlu:     { col: [0.50, 0.51, 0.52], metal: 0.75, rough: 0.70, rust: 0, chip: 0.0, hands: 0 },
  chrome:      { col: [0.80, 0.81, 0.82], metal: 0.95, rough: 0.20, rust: 0, chip: 0.0, hands: 1 },
  bronze:      { col: [0.45, 0.32, 0.18], metal: 0.85, rough: 0.50, rust: 0, chip: 0.0, hands: 0 },
  exhaust:     { col: [0.25, 0.20, 0.16], metal: 0.30, rough: 0.85, rust: 1, chip: 0.0, hands: 0 },
  leather:     { col: [0.25, 0.16, 0.10], metal: 0.0,  rough: 0.75, rust: 0, chip: 0.0, hands: 1 },
  webbing:     { col: [0.30, 0.28, 0.24], metal: 0.0,  rough: 0.90, rust: 0, chip: 0.0, hands: 0 },
  plastic:     { col: [0.45, 0.45, 0.45], metal: 0.0,  rough: 0.55, rust: 0, chip: 0.4, hands: 1 },
  plasticScr:  { col: [0.45, 0.45, 0.45], metal: 0.0,  rough: 0.45, rust: 0, chip: 0.3, hands: 1 },
  plasticGrn:  { col: [0.35, 0.38, 0.30], metal: 0.0,  rough: 0.60, rust: 0, chip: 0.3, hands: 1 },
  plasticWorn: { col: [0.45, 0.45, 0.45], metal: 0.0,  rough: 0.50, rust: 0, chip: 0.4, hands: 1 },
  rubberGrip:  { col: [0.05, 0.05, 0.05], metal: 0.0,  rough: 0.95, rust: 0, chip: 0.0, hands: 1 },
  hide:        { col: [0.20, 0.13, 0.08], metal: 0.0,  rough: 0.75, rust: 0, chip: 0.0, hands: 1 },
  copper:      { col: [0.25, 0.14, 0.09], metal: 0.60, rough: 0.60, rust: 0, chip: 0.0, hands: 0 },
  acrylicEdge: { col: [0.60, 0.62, 0.64], metal: 0.0,  rough: 0.40, rust: 0, chip: 0.0, hands: 0 },
  glass:       { col: [0.00, 0.00, 0.00], metal: 0.0,  rough: 0.00, rust: 0, chip: 0.0, hands: 1 },
};
const AERO_WX_SUB_NONE = { col: [0.3, 0.3, 0.3], metal: 0, rough: 0.8, rust: 0, chip: 0, hands: 0 };
// THE SUBSTRATE IS A FINISH ROW WHERE ONE EXISTS (G345.2, the user: "you
// know the original material, and the paint layer, so scratching the paint
// should really reveal the original material with its roughness"). A chip
// in painted alloy shows BARE ALLOY — the finish table's own bareAlu row,
// its base colour, its metalness and its roughness — not a hand-typed grey.
// Resolved at material time, when AEROSKIN exists (this file loads first).
const AERO_WX_SUB_FROM = {
  alclad: 'bareAlu', trim: 'bareAlu', fireFoil: 'bareAlu', panelMetal: 'bareAlu', sillAlu: 'bareAlu',
  castAlu: 'castAlu', chrome: 'chrome', bronze: 'bronze', copper: 'copper',
  composite: 'composite', spruce: 'spruce', maple: 'maple', walnut: 'walnut', walnutFig: 'walnutFig',
};
function aeroWxSubOf(finish) {
  const s = Object.assign({}, AERO_WX_SUB[finish] || AERO_WX_SUB_NONE);
  const from = AERO_WX_SUB_FROM[finish];
  const A = (typeof AEROSKIN !== 'undefined') ? AEROSKIN : null;
  const row = from && A && A.AERO_FINISH && A.AERO_FINISH[from];
  if (row) {
    const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const b = row.base >>> 0;
    s.col = [lin((b >> 16) & 255), lin((b >> 8) & 255), lin(b & 255)];
    s.metal = row.metal != null ? row.metal : s.metal;
    // a bare surface under paint has never been polished: a shade rougher
    // than the row as dressed, and the row's own clear coat is not there
    s.rough = Math.min(1, (row.rough != null ? row.rough : s.rough) + 0.08);
  }
  return s;
}

// frozen copies, the lab's datum
const AERO_WX_DEF = {
  layers: AERO_WX_LAYERS.map(L => L.c.slice()),
  cols:   AERO_WX_COL.map(C => C.v.slice()),
  knobs:  Object.assign({}, AERO_WX_KNOB),
};

// ---------------------------------------------------------------------------
// THE STATE (browser): the macros, the pins, the sources, the uniforms
// ---------------------------------------------------------------------------
const AERO_WX = {
  macro: { age: 0, flight: 0, bush: 0, rain: 0 },
  pin: {},                    // layer key -> pinned strength (the bench)
  U: null,                    // the shared uniform block, once
  lab: { layers: {}, cols: {}, knobs: {} },   // deviations only
};
const AERO_WX_NE = 4, AERO_WX_NW = 6;
const AERO_WX_LAB_KEY = 'flydiy.aeroWx';

function aeroWxClamp01(v) { return Math.max(0, Math.min(1, +v || 0)); }

// THE MACROS -> THE LAYERS. Pure: a spec's weather in, 24 strengths out.
function aeroWxResolve(macro, pin) {
  const m = macro || AERO_WX.macro, p = pin || {};
  const out = new Float32Array(AERO_WX_NL * 4);
  AERO_WX_LAYERS.forEach((L, i) => {
    let v = 0;
    for (let g = 0; g < 4; g++) v += aeroWxClamp01(m[AERO_WX_MACRO[g]]) * L.c[g];
    v = Math.max(0, Math.min(1, v));
    if (p[L.k] != null) v = aeroWxClamp01(p[L.k]);
    out[i] = v;
  });
  return out;
}

// WHAT A SPEC MEANS (pure, node-safe, the one keeper): `finish.weather` holds
// the four macros as deviations; a pre-G345 build carries `finish.wear`, one
// number, which meant "flown and aged together" — so it is age AND flight.
function aeroWxMacroFromSpec(spec) {
  const f = (spec && spec.finish) || {};
  const out = { age: 0, flight: 0, bush: 0, rain: 0 };
  if (f.weather && typeof f.weather === 'object') {
    for (const k of AERO_WX_MACRO) if (f.weather[k] != null) out[k] = aeroWxClamp01(f.weather[k]);
  } else if (f.wear != null) {
    out.age = out.flight = aeroWxClamp01(f.wear);
  }
  return out;
}
// ...and back: deviations only, nothing at zero
function aeroWxMacroToSpec(macro) {
  const out = {};
  for (const k of AERO_WX_MACRO) if (macro && macro[k]) out[k] = aeroWxClamp01(macro[k]);
  return Object.keys(out).length ? out : null;
}

// ---------------------------------------------------------------------------
// THE GRUNGE SHEET — baked once, tileable, four channels, node-safe
// ---------------------------------------------------------------------------
//   R fine mottle (fbm)      G cells, 1 at a cell's centre (spots, chips)
//   B a second fbm, finer    A the large blotch (low octaves)
// Value noise on an integer lattice taken MODULO the frequency, so every
// octave tiles and the sheet repeats without a seam. Frequencies are
// integers for the same reason.
function aeroWxHash(x, y, s) {
  let h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function aeroWxVNoise(u, v, f, s) {
  const x = u * f, y = v * f;
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const w = (a, b) => aeroWxHash(((a % f) + f) % f, ((b % f) + f) % f, s);
  const a = w(xi, yi), b = w(xi + 1, yi), c = w(xi, yi + 1), d = w(xi + 1, yi + 1);
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
}
function aeroWxFbm(u, v, f0, oct, s) {
  let sum = 0, amp = 0.5, f = f0, tot = 0;
  for (let i = 0; i < oct; i++) { sum += amp * aeroWxVNoise(u, v, f, s + i); tot += amp; amp *= 0.5; f *= 2; }
  return sum / tot;
}
// Worley F1 on a jittered lattice of N cells, tileable; returns 1 at the
// feature point falling to 0 at ~0.6 cell — a threshold on it is a disc
function aeroWxCells(u, v, N, s) {
  const x = u * N, y = v * N;
  const xi = Math.floor(x), yi = Math.floor(y);
  let best = 9;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = xi + dx, cy = yi + dy;
    const mx = ((cx % N) + N) % N, my = ((cy % N) + N) % N;
    const px = cx + aeroWxHash(mx, my, s), py = cy + aeroWxHash(mx, my, s + 9);
    const rs = 0.55 + 0.45 * aeroWxHash(mx, my, s + 17);   // each cell its own size
    const d = Math.hypot(x - px, y - py) / rs;
    if (d < best) best = d;
  }
  return Math.max(0, 1 - best / 0.6);
}
function aeroWxGrunge(S) {
  const out = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const u = x / S, v = y / S, i = (y * S + x) * 4;
    const r = aeroWxFbm(u, v, 6, 5, 1);
    const g = aeroWxCells(u, v, 14, 2);
    const b = aeroWxFbm(u, v, 12, 5, 3);
    const a = aeroWxFbm(u, v, 2, 3, 4);
    out[i]     = Math.round(255 * Math.max(0, Math.min(1, (r - 0.5) * 2.2 + 0.5)));
    out[i + 1] = Math.round(255 * Math.max(0, Math.min(1, g)));
    out[i + 2] = Math.round(255 * Math.max(0, Math.min(1, (b - 0.5) * 2.2 + 0.5)));
    out[i + 3] = Math.round(255 * Math.max(0, Math.min(1, (a - 0.5) * 2.4 + 0.5)));
  }
  return out;
}
const AERO_WX_GRUNGE_PX = 256;
let AERO_WX_GTEX = null;
function aeroWxGrungeTex(THREE) {
  if (AERO_WX_GTEX) return AERO_WX_GTEX;
  const S = AERO_WX_GRUNGE_PX;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  img.data.set(aeroWxGrunge(S));
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.LinearSRGBColorSpace;       // DATA, NOT A PICTURE
  t.anisotropy = (typeof window !== 'undefined' && window.FLYDIY_ANISO) || 8;
  t.needsUpdate = true;
  return (AERO_WX_GTEX = t);
}

// ---------------------------------------------------------------------------
// THE UNIFORMS
// ---------------------------------------------------------------------------
// The SHARED block: spread into aeroskin's aeroSharedU0, so one write reaches
// every material, editor and flown build alike. uWear is OWNED here now.
function aeroWxSharedU(THREE) {
  if (AERO_WX.U) return AERO_WX.U;
  const v4s = n => Array.from({ length: n }, () => new THREE.Vector4(0, 0, 0, 0));
  const K = AERO_WX_KNOB;
  const U = {
    uWear:  { value: new THREE.Vector4(0, 0, 0, 0) },   // x age y flight z bush w rain
    tGrunge: { value: aeroWxGrungeTex(THREE) },
    uWxL:   { value: v4s(AERO_WX_NL) },
    uWxC:   { value: AERO_WX_COL.map(C => new THREE.Vector4(...C.v)) },
    uWxE:   { value: v4s(AERO_WX_NE) },   // exhaust: xyz craft m, w run m
    uWxEd:  { value: v4s(AERO_WX_NE) },   // exhaust: xyz blown direction, w half-width m
    uWxA:   { value: v4s(AERO_WX_NE) },   // thrust line: xyz craft m, w cowl radius
    uWxAd:  { value: v4s(AERO_WX_NE) },   // x cowl length aft  y panel joint (craft y)  z split-line azimuth  w joint on
    uWxW:   { value: v4s(AERO_WX_NW) },   // wheel: xyz contact craft m, w R
    uWxWd:  { value: v4s(AERO_WX_NW) },   // wheel: x tyre half-width, y weight, z run m, w 0
    uWxN:   { value: new THREE.Vector4(0, 0, 0, -9) },  // x nE y nW z 0 w cabin floor z
    uWxR:   { value: new THREE.Vector4(K.dustFlat, K.ccRough, K.kappaMax, K.bugTile) },
    uWxG:   { value: new THREE.Vector4(K.fineTile, K.coarseTile, K.streakAcross, K.streakAlong) },
    uWxDbg: { value: 0 },
    uWxT:   { value: new THREE.Vector4(K.propR, K.spinR, K.leGain, K.flingGain) },
    uWxV:   { value: new THREE.Vector4(K.creviceGain, K.seamW, K.scratchLen, K.scratchAcross) },
    uSpiral: { value: new THREE.Vector4(0, 1, 0.10, 0.30) },   // on, hand, pitch m, width at the base
    uSpiralC: { value: new THREE.Vector4(1, 1, 1, 1) },       // linear rgb, strength
  };
  AERO_WX.U = U;
  aeroWxLabLoad();
  aeroWxRefresh();
  return U;
}
// the PER-MATERIAL pair, a pure function of the finish (nothing on userData)
// `o.spin` (G345.1): 0 a fixed part, 1 a propeller blade, 2 the spinner —
// named by the section in the editor and by the join's part walk in flight
function aeroWxFinishU(THREE, U, finish, o) {
  const s = aeroWxSubOf(finish);
  if (!U.uWxTurn) U.uWxTurn = { value: 0 };
  U.uWxTurn.value = (o && o.spin) ? +o.spin : 0;
  if (!U.uWxSub) U.uWxSub = { value: new THREE.Vector4() };
  if (!U.uWxSub2) U.uWxSub2 = { value: new THREE.Vector4() };
  U.uWxSub.value.set(s.col[0], s.col[1], s.col[2], s.metal);
  U.uWxSub2.value.set(s.rough, s.rust, s.chip, s.hands);
  return U;
}

// the resolved layers and the knobs onto the live block (no recompile)
function aeroWxRefresh() {
  const U = AERO_WX.U;
  if (!U) return;
  const L = aeroWxResolve(AERO_WX.macro, AERO_WX.pin);
  for (let i = 0; i < AERO_WX_NL; i++)
    U.uWxL.value[i].set(L[i * 4], L[i * 4 + 1], L[i * 4 + 2], L[i * 4 + 3]);
  AERO_WX_COL.forEach((C, i) => U.uWxC.value[i].set(C.v[0], C.v[1], C.v[2], C.v[3]));
  const K = AERO_WX_KNOB;
  U.uWxR.value.set(K.dustFlat, K.ccRough, K.kappaMax, K.bugTile);
  U.uWxG.value.set(K.fineTile, K.coarseTile, K.streakAcross, K.streakAlong);
  U.uWxT.value.set(K.propR, K.spinR, K.leGain, K.flingGain);
  U.uWxV.value.set(K.creviceGain, K.seamW, K.scratchLen, K.scratchAcross);
  const m = AERO_WX.macro;
  U.uWear.value.set(aeroWxClamp01(m.age), aeroWxClamp01(m.flight),
                    aeroWxClamp01(m.bush), aeroWxClamp01(m.rain));
  // A PIN MUST OPEN THE BRANCH: the shader's whole block sits behind
  // `if (aeroWxOn > 0.0)` on the macros, so a pinned layer over four zero
  // macros would draw nothing and measure as nothing (the first measureAll
  // came back 24 x 0 %). A thousandth of age is invisible everywhere else.
  if (Object.keys(AERO_WX.pin).length)
    U.uWear.value.x = Math.max(U.uWear.value.x, 1e-3);
}
// the spiral off a decal block (the editor's live DEC, or the flown build's
// merged finish.decals); sRGB hex -> linear here, as the factory does
function aeroWxSetSpiral(THREE, D) {
  const U = aeroWxSharedU(THREE);
  const d = Object.assign({}, AERO_WX_SPIRAL_DEF, D || {});
  const hex = d.spiralCol == null ? 0xffffff : (d.spiralCol >>> 0);
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  U.uSpiral.value.set(d.spiralOn ? 1 : 0, (+d.spiralHand === 1) ? -1 : 1,
                      Math.max(0.02, +d.spiralPitch || 0.10), Math.max(0.02, Math.min(0.6, +d.spiralW || 0.30)));
  U.uSpiralC.value.set(lin((hex >> 16) & 255), lin((hex >> 8) & 255), lin(hex & 255), 1);
}
function aeroWxSetMacro(THREE, m) {
  if (THREE) aeroWxSharedU(THREE);
  for (const k of AERO_WX_MACRO) if (m && m[k] != null) AERO_WX.macro[k] = aeroWxClamp01(m[k]);
  aeroWxRefresh();
  return AERO_WX.macro;
}
function aeroWxPin(THREE, key, v) {
  if (THREE) aeroWxSharedU(THREE);
  if (v == null) delete AERO_WX.pin[key]; else AERO_WX.pin[key] = aeroWxClamp01(v);
  aeroWxRefresh();
}
function aeroWxSetDebug(THREE, v) {
  aeroWxSharedU(THREE).uWxDbg.value = +v || 0;
}

// THE SOURCES, in craft metres:
//   exhaust: [{ x, y, z, dx, dy, dz, run, hw }]   the outlet, the pipe's own
//            direction (unit), the plume's run and half-width
//   wheels:  [{ x, y, z, R, hw, kind }]           the AXLE, radius, tyre
//            half-width, 'T' for the third wheel (a lighter thrower)
//   floor:   craft z of the cabin floor (the corner trough), or null
// A pipe's direction is BLOWN AFT here: soot goes where the slipstream takes
// it, which is mostly aft whatever the pipe points at. A direction that
// points forward is treated as unmeasured (the ENG_AIM handedness is
// suspect — HANDOVER G345) and falls back to pure aft.
function aeroWxSetSources(THREE, src) {
  const U = aeroWxSharedU(THREE);
  const ex = (src && src.exhaust) || [], wh = (src && src.wheels) || [];
  let nE = 0, nW = 0;
  for (let i = 0; i < AERO_WX_NE; i++) {
    const e = ex[i];
    if (!e) { U.uWxE.value[i].set(0, 0, 0, 0); U.uWxEd.value[i].set(0, 1, 0, 0); continue; }
    let d = [+e.dx || 0, +e.dy || 0, +e.dz || 0];
    const l = Math.hypot(d[0], d[1], d[2]);
    if (!(l > 1e-6) || d[1] / l < -0.3) d = [0, 1, 0]; else d = d.map(v => v / l);
    // blown aft: half the pipe's own aim, all of the slipstream
    const b = [d[0] * 0.5, d[1] * 0.5 + 1.0, d[2] * 0.5];
    const lb = Math.hypot(b[0], b[1], b[2]);
    U.uWxE.value[i].set(+e.x || 0, +e.y || 0, +e.z || 0, e.run != null ? +e.run : 1.8);
    U.uWxEd.value[i].set(b[0] / lb, b[1] / lb, b[2] / lb, e.hw != null ? +e.hw : 0.10);
    nE = i + 1;
  }
  // THE THRUST LINES (the cowl is a body of revolution about its engine's):
  // one per engine, with the cowl's radius and its length aft, so the cowl,
  // the spinner and the engine read their grunge cylindrically — arc length
  // round the line and metres along it — instead of through planes that
  // shear on every cheek. Absent engines take the exhaust's own point.
  const en = (src && src.engines) || [];
  for (let i = 0; i < AERO_WX_NE; i++) {
    const g = en[i] || (ex[i] ? { x: ex[i].x, y: ex[i].y, z: ex[i].z } : null);
    if (!g) { U.uWxA.value[i].set(0, 0, 0, 0); U.uWxAd.value[i].set(0, 0, 0, 0); continue; }
    U.uWxA.value[i].set(+g.x || 0, +g.y || 0, +g.z || 0, g.r != null ? +g.r : 0.8);
    // the cowl's own crevices (G345.3): the panel joint's station in craft
    // metres and the split line's azimuth, off the cowl tool's numbers
    U.uWxAd.value[i].set(g.len != null ? +g.len : 1.2, g.seam != null ? +g.seam : 0,
                         g.split != null ? +g.split : 0, g.seamOn ? 1 : 0);
  }
  for (let j = 0; j < AERO_WX_NW; j++) {
    const w = wh[j];
    if (!w) { U.uWxW.value[j].set(0, 0, 0, 0); U.uWxWd.value[j].set(0, 0, 0, 0); continue; }
    const R = +w.R || 0.2;
    U.uWxW.value[j].set(+w.x || 0, +w.y || 0, (+w.z || 0) - R, R);   // the CONTACT
    U.uWxWd.value[j].set(w.hw != null ? +w.hw : R * 0.4, w.kind === 'T' ? 0.35 : 1.0,
                         w.run != null ? +w.run : 2.2, 0);
    nW = j + 1;
  }
  // z: 1 when a turning part's object space is its own axle-centred frame
  // (the flown build's pivot groups); 0 in the editor, where meshes sit in
  // scene space and never spin
  U.uWxN.value.set(nE, nW, (src && src.pivot) ? 1 : 0, (src && src.floor != null) ? +src.floor : -9);
  return { nE, nW };
}
// a world point / direction into craft space through the shared uCraftInv
function aeroWxCraftOf(THREE, craftInv, p, isDir) {
  const v = new THREE.Vector3(p[0] != null ? p[0] : p.x, p[1] != null ? p[1] : p.y,
                              p[2] != null ? p[2] : p.z);
  if (isDir) v.transformDirection(craftInv); else v.applyMatrix4(craftInv);
  return [v.x, v.y, v.z];
}

// ---------------------------------------------------------------------------
// THE LAB — deviations from the tables, the person's own, never the spec
// ---------------------------------------------------------------------------
function aeroWxLabLoad() {
  let j = null;
  try { j = JSON.parse(localStorage.getItem(AERO_WX_LAB_KEY) || 'null'); } catch (e) { j = null; }
  if (!j || typeof j !== 'object') return;
  AERO_WX.lab = { layers: j.layers || {}, cols: j.cols || {}, knobs: j.knobs || {} };
  AERO_WX_LAYERS.forEach(L => { const d = AERO_WX.lab.layers[L.k]; if (d) d.forEach((v, g) => { if (v != null) L.c[g] = +v; }); });
  AERO_WX_COL.forEach(C => { const d = AERO_WX.lab.cols[C.k]; if (d) d.forEach((v, g) => { if (v != null) C.v[g] = +v; }); });
  for (const k in AERO_WX.lab.knobs) if (AERO_WX_KNOB[k] != null) AERO_WX_KNOB[k] = +AERO_WX.lab.knobs[k];
}
function aeroWxLabSave() {
  try { localStorage.setItem(AERO_WX_LAB_KEY, JSON.stringify(AERO_WX.lab)); } catch (e) {}
}
// kind 'layer' (key = layer k, field 0..3), 'col' (key = colour k, field 0..3),
// 'knob' (key = knob name)
function aeroWxLabSet(THREE, kind, key, field, value) {
  const v = +value;
  if (kind === 'layer') {
    const i = AERO_WX_LAYERS.findIndex(L => L.k === key);
    if (i < 0) return;
    AERO_WX_LAYERS[i].c[field] = v;
    const def = AERO_WX_DEF.layers[i];
    const dev = AERO_WX_LAYERS[i].c.map((x, g) => (Math.abs(x - def[g]) > 1e-9 ? x : null));
    if (dev.some(x => x != null)) AERO_WX.lab.layers[key] = dev; else delete AERO_WX.lab.layers[key];
  } else if (kind === 'col') {
    const i = AERO_WX_COL.findIndex(C => C.k === key);
    if (i < 0) return;
    AERO_WX_COL[i].v[field] = v;
    const def = AERO_WX_DEF.cols[i];
    const dev = AERO_WX_COL[i].v.map((x, g) => (Math.abs(x - def[g]) > 1e-9 ? x : null));
    if (dev.some(x => x != null)) AERO_WX.lab.cols[key] = dev; else delete AERO_WX.lab.cols[key];
  } else if (kind === 'knob') {
    if (AERO_WX_KNOB[key] == null) return;
    AERO_WX_KNOB[key] = v;
    if (Math.abs(v - AERO_WX_DEF.knobs[key]) > 1e-9) AERO_WX.lab.knobs[key] = v;
    else delete AERO_WX.lab.knobs[key];
  }
  aeroWxLabSave();
  if (THREE) aeroWxSharedU(THREE);
  aeroWxRefresh();
}
function aeroWxLabGet(kind, key, field) {
  if (kind === 'layer') { const L = AERO_WX_LAYERS.find(x => x.k === key); return L ? L.c[field] : null; }
  if (kind === 'col')   { const C = AERO_WX_COL.find(x => x.k === key); return C ? C.v[field] : null; }
  if (kind === 'knob')  return AERO_WX_KNOB[key];
  return null;
}
function aeroWxLabReset(THREE) {
  AERO_WX_LAYERS.forEach((L, i) => { L.c = AERO_WX_DEF.layers[i].slice(); });
  AERO_WX_COL.forEach((C, i) => { C.v = AERO_WX_DEF.cols[i].slice(); });
  Object.assign(AERO_WX_KNOB, AERO_WX_DEF.knobs);
  AERO_WX.lab = { layers: {}, cols: {}, knobs: {} };
  aeroWxLabSave();
  if (THREE) aeroWxSharedU(THREE);
  aeroWxRefresh();
}
// the whole recipe as it stands — paste into the tables above
function aeroWxLabExport() {
  return JSON.stringify({
    layers: Object.fromEntries(AERO_WX_LAYERS.map(L => [L.k, L.c.map(x => +x.toFixed(3))])),
    cols:   Object.fromEntries(AERO_WX_COL.map(C => [C.k, C.v.map(x => +x.toFixed(3))])),
    knobs:  Object.assign({}, AERO_WX_KNOB),
    deviations: AERO_WX.lab,
  }, null, 2);
}

// ---------------------------------------------------------------------------
// THE SHADER
// ---------------------------------------------------------------------------
// NO BACKTICKS, NO ${} IN THESE BLOCKS.
// The unpack of uWxL is GENERATED from the layer table, once, at load: the
// same text for every material (nothing per-material is interpolated).
const AERO_WX_UNPACK = AERO_WX_LAYERS.map((L, i) =>
  '  float wx_' + L.k + ' = uWxL[' + (i >> 2) + '].' + 'xyzw'[i & 3] + ' * wxK;').join('\n');

// declared in the fragment prelude of every aeroskin AND glass program
const AERO_WX_PARS_FS = `
#define AEROWX_NL 7
#define AEROWX_NE 4
#define AEROWX_NW 6
#define AEROWX_LE_SIGN 1.0
uniform sampler2D tGrunge;
uniform vec4 uWxL[AEROWX_NL];
uniform vec4 uWxC[8];
uniform vec4 uWxE[AEROWX_NE];
uniform vec4 uWxEd[AEROWX_NE];
uniform vec4 uWxW[AEROWX_NW];
uniform vec4 uWxWd[AEROWX_NW];
uniform vec4 uWxA[AEROWX_NE];   // an engine's thrust line: xyz craft m, w the cowl's radius
uniform vec4 uWxAd[AEROWX_NE];  // x the cowl's length aft of that point  y panel joint craft y  z split azimuth  w joint on
uniform vec4 uWxN;      // x nE  y nW  z object space is the turning part's own frame  w cabin floor z (craft m)
uniform vec4 uWxR;      // x dust flatten  y cc rough add  z kappa max (1/m)  w bug tile m
uniform vec4 uWxG;      // x fine tile m  y coarse tile m  z streak across m  w streak along m
uniform float uWxDbg;
uniform vec4 uWxT;      // x blade tip radius m  y spinner base radius m  z LE gain  w fling gain
uniform vec4 uWxV;      // x crevice gain  y cowl joint width m  z scratch length m  w scratch width m
uniform vec4 uSpiral;   // x on  y hand  z pitch m/turn  w width at the base
uniform vec4 uSpiralC;  // linear rgb, strength
uniform float uWxTurn;  // per material: 0 fixed, 1 a blade, 2 the spinner
float aeroWxPeel = 0.0; // G345.2: how much of the clear coat has peeled here
uniform vec4 uWxSub;    // substrate rgb, metal   (per material)
uniform vec4 uWxSub2;   // substrate rough, rust, chip, hands

// CURVATURE FROM THE SCREEN DERIVATIVES, in 1/m, footprint-independent to
// first order (r128 computes geometryRoughness off the same derivative).
// Positive is CONVEX (a rivet dome, a tube, an edge), negative CONCAVE (a
// groove, a dome's root, a corner). Zero on hard edges with split normals
// and at mesh intersections — those take the grammar's own cavity and the
// declared cabin trough instead. Faded at the limb, where it is noise.
float aeroWxKappa(vec3 gN, vec3 P) {
  vec3 dNx = dFdx(gN), dNy = dFdy(gN);
  vec3 dPx = dFdx(P), dPy = dFdy(P);
  float den = max(dot(dPx, dPx) + dot(dPy, dPy), 1e-8);
  return (dot(dNx, dPx) + dot(dNy, dPy)) / den;
}
// one dirt layer onto the running colour: cover unions (screen), the floor
// rides up to the layer's own
// SPOTS BY COUNT (G345.4, the user: "it's their density which is too high
// ... the slider should increase the density, not the intensity"). A cell
// lattice of pitch cell in the part's own frame; every cell rolls one
// hash against dens, a winning cell draws ONE disc of radius rad
// (x0.7..1.3 by a second hash) at a jittered centre, antialiased on the
// footprint. So the slider changes HOW MANY cells win and nothing else —
// a threshold on a noise, which is what these were, grows the blobs and
// their count together and covers a third of a cowl at full. The jitter
// stays inside the cell (0.3) and the radius under 0.2 cell, so a disc
// is never clipped by its neighbour and one cell per fragment suffices.
float aeroWxSpots(vec2 uv, float cell, float dens, float rad, float seed) {
  vec2 c = floor(uv / cell);
  float r0 = aeroHash(c + seed);
  float r1 = aeroHash(c + seed + 17.3);
  float r2 = aeroHash(c + seed + 41.7);
  vec2 ctr = (c + 0.5 + 0.6 * (vec2(r1, r2) - 0.5)) * cell;
  float rr = rad * (0.7 + 0.6 * aeroHash(c + seed + 5.9));
  float d = length(uv - ctr);
  float aa = max(length(fwidth(uv)), 1e-4) * 0.8;
  return step(r0, dens) * (1.0 - smoothstep(rr - aa, rr + aa, d));
}
void aeroWxLay(inout vec3 col, inout float cov, inout float flo, float c, vec4 C) {
  float cc = clamp(c, 0.0, 1.0);
  col = mix(col, C.rgb, cc);
  cov = 1.0 - (1.0 - cov) * (1.0 - cc);
  flo = mix(flo, max(flo, C.w), cc);
}
`;

// THE WEATHERING, at the tail of the surface pass: `normal`, `nonPerturbedNormal`,
// `roughnessFactor`, `metalnessFactor`, `diffuseColor`, `faceDirection` and
// the craft varyings are all in hand, the decals have already composited
// (dirt goes over markings — G70's ruling), and aeroStructure has written
// aeroCav / aeroDep. ONE uniform branch: a factory-fresh aeroplane pays one
// compare, and every fetch inside has defined derivatives.
const AERO_WX_SURF_FS = `
{
  float wxK = uWearK;
  // THE TURNING PARTS' OWN FRAME (G345.1, the user: "weathering on blades
  // and nose cone should be dominated by the rotation movement"). Polar
  // about the shaft in OBJECT space — the engine group's z in the editor,
  // the flown prop group's x (uWxN.z) — so everything read here turns with
  // the part; the tangential direction is what a blade meets the air with,
  // and its leading edge is the face whose normal has that component.
  float wxTurn = uWxTurn;
  float wxPr = 0.0, wxPth = 0.0, wxTanN = 0.0; vec2 wxPd = vec2(0.0);
  if (wxTurn > 0.5) {
    wxPd = ((uWxN.z > 0.5) ? vObjPos.yz : vObjPos.xy) * uFieldM;
    vec2 nd = (uWxN.z > 0.5) ? vObjNrm.yz : vObjNrm.xy;
    wxPr = length(wxPd);
    wxPth = atan(wxPd.y, wxPd.x);
    // the same hand in both frames: cage (x,y,z) -> model (-z, y, x)
    vec2 t = (uWxN.z > 0.5) ? vec2(wxPd.y, -wxPd.x) : vec2(-wxPd.y, wxPd.x);
    wxTanN = dot(nd, t) / max(length(t) * max(length(nd), 1e-4), 1e-4);
  }
  // THE SPINNER'S SPIRAL: one stroke in the cone's polar frame, phase =
  // angle x hand + radius / pitch, a width that grows from nothing at the
  // tip to uSpiral.w of a turn at the base. Painted under the weathering.
  // Antialiased on the radius and the arc separately: the phase itself
  // jumps by exactly one turn at the seam, so fract is continuous there
  // while fwidth(phase) is not.
  if (wxTurn > 1.5 && uSpiral.x > 0.5) {
    float ph = wxPth / 6.2831853 * uSpiral.y + wxPr / uSpiral.z;
    float w = uSpiral.w * clamp(wxPr / max(uWxT.y, 0.02), 0.0, 1.0);
    float aa = 1.5 * (fwidth(wxPr) / uSpiral.z + length(fwidth(wxPd)) / max(wxPr, 0.01) / 6.2831853);
    float sm = smoothstep(w + aa, max(w - aa, 0.0), fract(ph)) * step(0.004, wxPr);
    diffuseColor.rgb = mix(diffuseColor.rgb, uSpiralC.rgb, sm * uSpiralC.a);
  }
  float aeroWxOn = max(max(uWear.x, uWear.y), max(uWear.z, uWear.w)) * wxK;
  if (aeroWxOn > 0.0) {
` + AERO_WX_UNPACK + `
    vec3 cP = vCraftPos;
    vec3 cN = normalize(vCraftNrm) * faceDirection;
    float wxUp = clamp(cN.z, 0.0, 1.0), wxDown = clamp(-cN.z, 0.0, 1.0);
    float wxFwd = clamp(-cN.y, 0.0, 1.0), wxAft = clamp(cN.y, 0.0, 1.0);
    // A WHEEL TURNS (the user: "they turn, even in flight, so no directional
    // wear and tear there"). Nothing on a tyre or a hub is directional, and
    // its grunge must ride the WHEEL's own frame, not the craft's, or the
    // dirt stands still while the wheel rolls under it. A fragment inside a
    // wheel's own cylinder — its axle, its radius, its tyre width, all in
    // the sources — has its gates made isotropic and its read taken in
    // object space, which is the wheel group's frame (G55: pivoted at the
    // axle) and turns with it.
    float wxSpin = 0.0; vec3 wxQ = vec3(0.0, 1.0, 0.0); float wxR = 0.2, wxHW = 0.08;
    for (int j = 0; j < AEROWX_NW; ++j) {
      if (float(j) >= uWxN.y) break;
      vec3 qa = cP - uWxW[j].xyz - vec3(0.0, 0.0, uWxW[j].w);
      float R = max(uWxW[j].w, 0.05), hw = max(uWxWd[j].x, 0.02);
      float s = (1.0 - smoothstep(R * 1.05, R * 1.3, length(qa.yz)))
              * (1.0 - smoothstep(hw * 1.2, hw * 1.7, abs(qa.x)));
      if (s > wxSpin) { wxSpin = s; wxQ = qa; wxR = R; wxHW = hw; }
    }
    // THE WHEEL, UNWRAPPED (the user: "the wheel needs to be separated into
    // flanks and band, the band being unwrapped after a seam is declared").
    // Radius, angle and lateral offset about the AXLE: in flight the wheel is
    // a group re-centred on its axle and spun (uWxN.z = 1, so object space
    // IS the wheel's own frame and turns with it); in the editor the mesh
    // sits in scene space and never spins, so the same three come off the
    // craft-space axle the sources carry. The band's u is the arc length
    // (the seam at the far side of the axle, a declared cut), its v the
    // lateral offset; a flank continues v over the shoulder by (R - r), so
    // the two meet at the shoulder without a step.
    float wxRr, wxTh, wxLat;
    if (uWxN.z > 0.5) { wxRr = length(vObjPos.xy); wxTh = atan(vObjPos.y, vObjPos.x); wxLat = vObjPos.z; }
    else { wxRr = length(wxQ.yz); wxTh = atan(wxQ.z, wxQ.y); wxLat = wxQ.x; }
    float wxFlankW = smoothstep(0.45, 0.8, abs(cN.x));
    float wxRad = clamp(wxRr / wxR, 0.0, 1.2);
    vec2 wxWheelUV = vec2(wxTh * wxR, mix(wxLat, sign(wxLat) * (wxHW + max(wxR - wxRr, 0.0)), wxFlankW));
    vec4 gWh = texture2D(tGrunge, wxWheelUV / 0.12);
    // ...and the PROPELLER (G345.1): named by the part (uWxTurn, from the
    // section in the editor and the join's part walk in flight — the spinner
    // used to be named by a wooden row's transposed sheet and an alloy cone
    // read its dirt in craft space, standing still while it turned). The
    // read is the part's own unwrap: along = the radius, across = the arc.
    float wxProp = step(0.5, wxTurn);
    float wxSp = step(1.5, wxTurn);            // the spinner
    float wxBl = wxProp * (1.0 - wxSp);        // a blade
    vec2 wxPropUV = vec2(wxPr, wxPth * wxPr);
    vec4 gPr = texture2D(tGrunge, wxPropUV / 0.15);
    // THE ROTATION IS THE AIRFLOW: a blade meets the air with its LEADING
    // EDGE, at a speed that grows with the radius — so the insects and the
    // stone pits go there, thickest toward the tip; a spinner meets it with
    // its tip. Nothing on a turning part has a top, a flank or an aft face.
    float wxLE = wxBl * clamp(wxTanN * AEROWX_LE_SIGN, 0.0, 1.0)
               * smoothstep(0.15, uWxT.x, wxPr) * uWxT.z;
    float wxRot = max(wxSpin, wxProp);
    wxUp *= 1.0 - wxRot; wxAft *= 1.0 - wxRot;
    wxFwd = mix(wxFwd, max(wxFwd * mix(1.0, 0.35, wxBl), wxLE), wxRot);
    wxDown = mix(wxDown, mix(0.25, 0.5, wxSpin), wxRot);
    // dirt stays at a blade's ROOT and a spinner's BASE (the tip and the
    // cone's point are scoured); what the rotation FLINGS runs outward
    float wxRadW = mix(1.0, mix(1.0 - smoothstep(0.25, uWxT.x, wxPr),
                                smoothstep(0.0, uWxT.y, wxPr), wxSp), wxRot);
    float wxFA = (wxFwd * wxFwd + wxAft * wxAft) * (1.0 - wxRot);
    // a FLANK is what faces sideways — not a nose or a tail face, which the
    // first cut counted as flanks and swept "aft" streaks across (the user's
    // hangar shot: the whole cowl front thrashed with smears)
    float wxSide = clamp(1.0 - wxUp - wxDown - wxFwd - wxAft, 0.0, 1.0) * (1.0 - wxRot);
    float wxIn = max(uInside.x, uInside.y * step(faceDirection, 0.0));
    float wxOut = 1.0 - wxIn;
    // THE GRUNGE READS, in THREE craft planes weighted by the normal (the
    // triplanar rule, on coordinates): the flank's (along, up), the deck's
    // (along, lateral) and the NOSE's (lateral, up). Two planes were not
    // enough — a forward face has no variation along the body, so every
    // feature on the cowl's front stretched into a line. MIXED, never branched.
    // sharp weights: where two planes share a fragment the blended coordinate
    // is a SHEAR and every feature stretches — a round cowl's cheeks showed
    // it as fine radial lines — so the transition is kept narrow, and the
    // line-like layers (scratches) are gated to faces one plane clearly owns
    vec3 wxW = pow(abs(cN), vec3(8.0));
    wxW /= max(wxW.x + wxW.y + wxW.z, 1e-6);
    float wxPure = smoothstep(0.55, 0.85, max(wxW.x, max(wxW.y, wxW.z)));
    vec2 wxUV = vec2(cP.y, cP.z) * wxW.x + vec2(cP.y, cP.x) * wxW.z + vec2(cP.x, cP.z) * wxW.y;
    // THE SKIN HAS A FIELD (G66): metres along the body and around the
    // section, exact on any shape — the one coordinate that cannot shear.
    // sC is shared by the two flanks, so the far flank reads an offset
    // region, blended over the spine and the keel where the sides meet.
    #if AEROSKIN_SURF == 1
    {
      vec2 wxL = aeroM, wxRt = vec2(aeroM.x + 3.7, -aeroM.y + 5.1);
      wxUV = mix(wxL, wxRt, smoothstep(-0.15, 0.15, cP.x));
      wxPure = 1.0;
    }
    #endif
    // A COWL IS A BODY OF REVOLUTION (the user, on the nose: "you need
    // another projection method"): near an engine's thrust line the read is
    // CYLINDRICAL — arc length round the line, metres along it, the seam
    // declared at the bottom — on the triplanar parts, which have no field.
    // The nose face itself (the spinner's plane) keeps the nose plane.
    float wxCyl = 0.0; vec2 wxCylUV = vec2(0.0); float wxCrev = 0.0;
    for (int i = 0; i < AEROWX_NE; ++i) {
      if (float(i) >= uWxN.x) break;
      vec3 qa = cP - uWxA[i].xyz;
      float rr = length(qa.xz);
      float s = (1.0 - smoothstep(uWxA[i].w, uWxA[i].w * 1.25, rr))
              * smoothstep(-0.7, -0.35, qa.y) * (1.0 - smoothstep(uWxAd[i].x, uWxAd[i].x + 0.3, qa.y));
      // ALONG is the MERIDIAN, y + r: a cowl narrows FORWARD, so y and r fall
      // together toward the spinner and their SUM runs the taper at near
      // unit speed (the difference stalled there and stretched every insect
      // along the cheek); it runs the barrel by its length and a blunt face
      // by its radius, meets at the shoulder without a step, and needs no
      // blend toward a nose plane (a blend by facing was a shear band).
      // ACROSS is the arc, the seam declared at the bottom.
      if (s > wxCyl) {
        wxCyl = s; wxCylUV = vec2(qa.y + rr, atan(qa.x, qa.z) * max(rr, 0.05));
        // THE COWL'S CREVICES (G345.3, the user: "dirt in all appropriate
        // places, in particular in the crevices"): the panel joint is a
        // station along the axis, the split line an azimuth on both flanks —
        // the cowl tool's own numbers, not a curvature the derivatives
        // cannot see on a millimetre groove
        float wxJ = exp(-pow((qa.y - uWxAd[i].y) / uWxV.y, 2.0));
        float wxSpl = exp(-pow((abs(atan(qa.x, qa.z)) - uWxAd[i].z) * rr / uWxV.y, 2.0));
        wxCrev = s * uWxAd[i].w * max(wxJ, wxSpl);
      }
    }
    #if AEROSKIN_SURF == 0
    wxUV = mix(wxUV, wxCylUV, wxCyl);
    wxPure = max(wxPure, wxCyl);
    #endif
    // ...and on a wheel or a blade, the part's own unwrap in its own frame
    wxUV = mix(mix(wxUV, wxWheelUV, wxSpin), wxPropUV, wxProp);
    float wxAlong = wxUV.x, wxAcross = wxUV.y;
    vec4 gF = texture2D(tGrunge, vec2(wxAlong, wxAcross) / uWxG.x);
    vec4 gC = texture2D(tGrunge, vec2(wxAlong, wxAcross) / uWxG.y + vec2(0.37, 0.61));
    // stretched ALONG the slipstream: a streak is a bundle of fine trails.
    // On a nose or tail face there is no "along" to stretch by, so the read
    // is the plain plane there (the streak layers themselves are gated off
    // those faces by wxSide)
    float gSa = texture2D(tGrunge, mix(vec2(wxAcross / uWxG.z, wxAlong / uWxG.w),
                                       vec2(wxAlong, wxAcross) / uWxG.x, wxFA)).b;
    // ...and DOWN the flank for what rain does when the aeroplane is parked
    float wxAcrossH = mix(cP.y, cP.x, wxFA);
    float gSd = texture2D(tGrunge, vec2(wxAcrossH / uWxG.z + 0.5, cP.z / uWxG.w)).b;
    // the curvature, faded at the limb and broken by the blotch so a
    // per-triangle constant never reads as a facet
    float wxKap = aeroWxKappa(nonPerturbedNormal, -vViewPosition);
    float wxNV = abs(dot(nonPerturbedNormal, normalize(vViewPosition)));
    float wxKF = smoothstep(0.12, 0.35, wxNV) * (0.55 + 0.45 * gC.a);
    float wxConcave = clamp(-wxKap / uWxR.z, 0.0, 1.0) * wxKF;
    float wxConvex  = clamp( wxKap / uWxR.z, 0.0, 1.0) * wxKF;
    float wxCav = clamp(aeroCav, 0.0, 1.0);
    float wxDep = clamp(aeroDep, 0.0, 1.0);

    vec3 col = diffuseColor.rgb;
    float cov = 0.0, flo = 0.0, dustCov = 0.0;

    // ---- THE SOURCES ---------------------------------------------------
    // exhaust plumes: a point, a blown direction, a run; distance from the
    // axis line in 3-D with the width growing and the plume sagging as it
    // goes — reaches the cowl, the belly, a strut, whatever is near the line
    float wxSoot = 0.0;
    for (int i = 0; i < AEROWX_NE; ++i) {
      if (float(i) >= uWxN.x) break;
      vec3 q = cP - uWxE[i].xyz;
      float run = max(uWxE[i].w, 0.05);
      float t0 = clamp(dot(q, uWxEd[i].xyz) / run, 0.0, 1.0);
      vec3 D = normalize(uWxEd[i].xyz + vec3(0.0, 0.0, -0.30 * t0));
      float t = clamp(dot(q, D) / run, 0.0, 1.0);
      vec3 r = q - t * run * D;
      // WIDE FROM THE START: the exit the engine layer measures is the pipe's
      // own tip, which on a stub stack sits INSIDE the cowl's volume, a
      // quarter-metre from the skin it stains (measured: x -0.18 on a 0.9 m
      // cowl). A plume as narrow as the pipe never reached any surface.
      float w = uWxEd[i].w + 0.18 + 0.9 * t;
      // A BIAS, NOT A GATE. The first cut zeroed a fragment facing away
      // from the axis, to spare a wing's top when the plume ran under it —
      // and with the axis INSIDE the cowl every skin fragment faces away, so
      // the plume painted nothing at all (measured: cover identical with the
      // layer at 0 and at 1). Facing toward the axis reads full; facing away
      // reads half, which the distance falloff already thins.
      float fac = 0.55 + 0.45 * clamp(dot(cN, -r) / (length(r) + 0.03) + 0.5, 0.0, 1.0);
      wxSoot += exp(-dot(r, r) / (w * w)) * (1.0 - t) * smoothstep(0.0, 0.06, t) * fac;
    }
    wxSoot = clamp(wxSoot, 0.0, 1.0) * (0.45 + 0.9 * gSa) * wx_exhaust * wxOut;
    // wheel mud: a cone aft and up from the tyre's contact, as wide as the
    // tyre and spreading, thrown onto what faces down or forward
    float wxMud = 0.0;
    for (int j = 0; j < AEROWX_NW; ++j) {
      if (float(j) >= uWxN.y) break;
      vec3 q = cP - uWxW[j].xyz;
      float R = max(uWxW[j].w, 0.05), hw = max(uWxWd[j].x, 0.02), len = max(uWxWd[j].z, 0.1);
      float t = clamp(q.y / len, 0.0, 1.0);
      float lat = exp(-pow(q.x / (hw * (1.0 + 2.5 * t)), 2.0));
      // the envelope climbs to the BELLY: a metre or more above the contact
      // by two metres aft, which is where a grass strip's mud actually lands
      // (three radii reached the tyre and the leg's foot and nothing else)
      float zTop = 0.25 + R * (1.5 + 6.0 * t);
      float hz = smoothstep(zTop + 0.20, zTop - 0.05, q.z) * smoothstep(-0.35, -0.05, q.z);
      wxMud += lat * hz * (1.0 - 0.7 * t) * smoothstep(0.0, 0.05, q.y / len) * uWxWd[j].y;
    }
    // onto what FACES the wheel: the belly, a leg's front, a flank — never a
    // wing's top (a 0.35 floor on every face put mud on the cub's upper wing)
    wxMud = clamp(wxMud, 0.0, 1.0) * max(wxDown, max(0.7 * wxFwd, 0.35 * wxSide)) * wx_mud * wxOut * (1.0 - wxSpin);
    // THE WHEEL'S OWN DIRT (the user): a flank is dirtiest toward its
    // shoulder and clean at the very edge, where the tyre meets the ground
    // and wipes itself; the tread is only slightly muddy but the grooves,
    // which the geometry's own concavity finds, load up; the hub takes
    // dust. Mud rides the bush macro, dust the flight and belly layers;
    // rain and insects never reach a wheel.
    float wxWFl = smoothstep(0.30, 0.85, wxRad) * (1.0 - smoothstep(0.90, 1.0, wxRad));
    float wxWBand = 0.22 + 0.78 * wxConcave;
    float wxWD = mix(wxWBand, wxWFl, wxFlankW) * (0.6 + 0.4 * gWh.r);
    float wxWheelMud = wxSpin * wxWD * wx_mud;
    float wxWheelDust = wxSpin * (0.25 + 0.6 * wxWFl) * (0.5 * wx_belly + 0.3 * wx_dust) * (0.6 + 0.4 * gWh.a);

    // ---- THE FILMS -----------------------------------------------------
    // the large blotch — on a turning part its OWN fine read stands in, or
    // a 2.4 m blotch lands as one pale patch across a 1.8 m blade
    float wxBlot = mix(gC.a, mix(gWh.a, gPr.a, wxProp), wxRot);
    // dust on the tops (rain takes it off: the coefficient is negative)
    float wxDust = wxRadW * wx_dust * (0.35 + 0.65 * wxBlot) * (0.7 + 0.3 * gF.r)
                 * (wxUp * wxOut + 0.5 * wxUp * wxIn);
    aeroWxLay(col, cov, flo, 0.55 * wxDust, uWxC[0]);
    dustCov = clamp(wxDust, 0.0, 1.0);
    // belly dirt on everything that faces down
    float wxBelly = wxRadW * wx_belly * pow(wxDown, 1.5) * (0.5 + 0.5 * wxBlot) * (0.6 + 0.4 * gF.r) * wxOut;
    aeroWxLay(col, cov, flo, 0.65 * wxBelly, uWxC[1]);
    // the grammar's own cavities: rivet flanks, tape edges, seams, the sag
    aeroWxLay(col, cov, flo, wx_cav * min(1.0, wxCav * uWxV.x) * (0.6 + 0.4 * gF.r), uWxC[7]);
    aeroWxLay(col, cov, flo, 0.5 * wx_cav * wxDep * (0.5 + 0.5 * gC.a), uWxC[1]);
    // depressions the geometry has: grooves, dome roots, corners
    aeroWxLay(col, cov, flo, wx_dep * min(1.0, (wxConcave + wxCrev) * uWxV.x) * (0.5 + 0.5 * gC.a), uWxC[7]);
    // the cabin's corners and floor
    float wxTrough = 1.0 - smoothstep(0.0, 0.14, abs(cP.z - uWxN.w));
    aeroWxLay(col, cov, flo, wx_corner * wxIn * (1.4 * wxConcave + 0.6 * wxTrough * (0.4 + 0.6 * gF.r)), uWxC[2]);
    // streaks: swept aft in flight, down the flanks when parked
    aeroWxLay(col, cov, flo, wx_streakA * wxSide * wxPure * pow(gSa, 2.0) * (0.3 + 0.7 * gC.a) * wxOut, uWxC[1]);
    aeroWxLay(col, cov, flo, wx_streakD * (1.0 - wxUp) * (1.0 - wxRot) * pow(gSd, 2.0) * (0.4 + 0.6 * gC.a) * (0.5 + 0.8 * wxCav) * wxOut, uWxC[7]);
    // the sources, over the films
    aeroWxLay(col, cov, flo, 0.85 * wxSoot, uWxC[3]);
    float wxSpat = smoothstep(1.0 - 0.75 * wxMud, 1.0 - 0.75 * wxMud + 0.06, gF.g) * step(0.02, wxMud);
    aeroWxLay(col, cov, flo, 0.75 * wxMud * (0.55 + 0.45 * gC.a) + 0.6 * wxSpat, uWxC[2]);
    aeroWxLay(col, cov, flo, wxWheelDust, uWxC[0]);
    // what the rotation flings: oil and dirt in radial streaks from the hub
    // outward, on the blades and the cone alike (gSa runs along the radius
    // on a turning part)
    aeroWxLay(col, cov, flo, wxProp * uWxT.w * (0.5 * wx_streakA + 0.5 * wx_belly)
              * pow(gSa, 2.0) * (0.3 + 0.7 * wxBlot) * (0.5 + 0.5 * wxRadW) * wxOut, uWxC[7]);
    aeroWxLay(col, cov, flo, 0.85 * wxWheelMud, uWxC[2]);
    // tar and oil: a few large drops on the belly and low flanks
    aeroWxLay(col, cov, flo, wx_tar * (wxDown + 0.4 * wxSide) * smoothstep(0.84, 0.90, gC.g) * wxOut * (1.0 - wxRot), uWxC[5]);
    // insects on every forward face, denser low; a dark body and a pale halo
    {
      // the whole front hemisphere, not only what faces dead ahead: a cowl's
      // cheeks, a strut, a leg and the lower screen all collect them
      // a DEAD ZONE on the facing: a wing's top tilts forward by its own
      // incidence and collected a spot at every cell centre (measured on
      // the cub: the whole upper surface speckled); and the halo fades in
      // with the density rather than ringing sub-pixel bodies
      float wxFwdB = clamp((wxFwd - 0.10) / 0.90, 0.0, 1.0);
      float wxDens = wx_bug * pow(wxFwdB, 0.7) * wxOut;
      // by COUNT: at full, one 5 cm cell in twelve carries one 3-8 mm splat
      // (a third of them put seventy on the cowl front; the ask is VERY sparse)
      vec2 wxBuv = vec2(wxAlong, wxAcross);
      float body = aeroWxSpots(wxBuv, 0.05, 0.08 * wxDens, 0.0035, 3.0) * step(0.02, wxDens);
      float halo = aeroWxSpots(wxBuv, 0.05, 0.08 * wxDens, 0.0065, 3.0) * step(0.02, wxDens) - body;
      col = mix(col, vec3(0.55, 0.50, 0.34), 0.35 * clamp(halo, 0.0, 1.0));
      aeroWxLay(col, cov, flo, body, uWxC[4]);
    }

    // ---- WHAT AGE DOES TO PAINT (not dirt: no cover) ---------------------
    float wxLum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    // chalking is sun damage: milky, LIGHTER, on the tops
    float wxChalk = wx_chalk * wxUp * wxUp * (0.5 + 0.5 * gC.a) * wxOut;
    col = mix(col, mix(col, vec3(wxLum), 0.55) * 1.18, 0.50 * wxChalk);
    // fade is patchy, everywhere the sun reaches
    float wxFade = wx_fade * (0.35 + 0.65 * gC.a) * wxOut;
    col = mix(col, mix(col, vec3(wxLum), 0.35) * 1.10, 0.45 * wxFade);
    roughnessFactor += 0.15 * (wxChalk + wxFade);
    // and everything goes rougher with the years
    roughnessFactor = mix(roughnessFactor, max(roughnessFactor, 0.72), 0.8 * wx_rough);
    // panel-to-panel tone: one sheet is never quite its neighbour's colour
    #if AEROSKIN_SURF == 1
    if (uG0.z > 0.0 && uG0.w > 0.0) {
      vec2 wxCell = floor(vec2(aeroM.x / uG0.z, aeroM.y / uG0.w));
      float wxH = fract(sin(dot(wxCell, vec2(12.9898, 78.233))) * 43758.5453);
      col *= 1.0 + (wxH - 0.5) * 0.14 * wx_panel;
    }
    #endif
    // fingerprints on what hands touch: a roughness and nothing else
    float wxHands = wx_hands * uWxSub2.w * wxIn * smoothstep(0.55, 0.75, gF.r) * (0.4 + 0.6 * gC.a);
    roughnessFactor += 0.25 * wxHands;

    // ---- NO SHINY DIRT: the invariants, once ----------------------------
    diffuseColor.rgb = col;
    // THE DIRT'S ROUGHNESS VARIES (G345.2, the user: "apply perlin/musgrave
    // noises on the roughness maps to generate dirt variation"): the floor
    // rides a musgrave field at half a metre, so a dusty panel is matte in
    // patches and merely dull between them — no fetch, the grammar's own
    // noise, evaluated in the part's frame
    float wxRV = 0.80 + 0.36 * clamp(aeroMusgrave(wxUV / 0.55) * 0.5 + 0.5, 0.0, 1.0);
    roughnessFactor = mix(roughnessFactor, max(roughnessFactor, flo * wxRV), cov);
    metalnessFactor *= 1.0 - cov;
    normal = normalize(mix(normal, nonPerturbedNormal, uWxR.x * dustCov));
    aeroWxCov = max(cov, 0.6 * wxHands);
    // ---- THE CLEAR COAT PEELS (G345.2) ----------------------------------
    // patches of the large blotch and a musgrave at a metre, hard-edged:
    // where it has gone the surface is the paint's own, dull and a shade
    // chalky, and the clear lobe is gone with it (spent in AERO_WX_CC_FS)
    {
      float wxPm = 0.55 * gC.a + 0.45 * clamp(aeroMusgrave(wxUV / 0.9 + vec2(0.31, 0.77)) * 0.5 + 0.5, 0.0, 1.0);
      // PATCHES, not a blanket: at full strength a third of the field peels
      float thrP = 1.0 - 0.36 * wx_peel * wxOut;
      aeroWxPeel = smoothstep(thrP - 0.03, thrP + 0.02, wxPm) * step(0.02, wx_peel);
      float wxPR = 0.62 + 0.25 * gF.b;
      roughnessFactor = mix(roughnessFactor, max(roughnessFactor, wxPR), aeroWxPeel);
      float wxPL = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, vec3(wxPL), 0.3) * 1.08, 0.5 * aeroWxPeel);
    }

    // ---- CHIPS: the substrate shows, AFTER the dirt ----------------------
    // peel lives at the edges (convex) and along the grammar's lines; a hard
    // threshold on the mottle so a chip has an edge, not a haze
    {
      float wxEdge = smoothstep(0.30, 0.80, 1.3 * wxConvex + 0.45 * wxCav);
      float wxChipP = wx_chip * uWxSub2.z * (0.04 + 0.96 * wxEdge);
      // FLAKES, not patches: the FINE noise channel, and a turning part's own
      // read — the coarse mottle's high ground is hand-sized, and on a thin
      // blade whose whole convex back counts as an edge it showed as one tan
      // patch of maple (measured: gone at zero macros, so it was this)
      // by COUNT (G345.4): at full, one 6 cm cell in sixteen carries one
      // 4-10 mm chip, shaped a little by the fine noise so it is not a disc
      float wxMot = mix(gF.b, mix(gWh.b, gPr.b, wxProp), wxRot);
      float ch = aeroWxSpots(wxUV, 0.06, 0.06 * wxChipP, 0.006 + 0.004 * wxMot, 11.0) * step(0.01, wxChipP);
      // stone chips on the forward faces: small round pits, sparser still
      float wxImpP = wx_impact * uWxSub2.z * pow(wxFwd, 2.0) * wxOut;
      ch = max(ch, aeroWxSpots(wxUV, 0.04, 0.05 * wxImpP, 0.0025, 23.0) * step(0.01, wxImpP));
      // scratches along the flanks: the stretched read, thresholded high
      // A SCRATCH IS SHORT AND RARE (G345.3, the user: "scratches should be
      // a lot more parsimonious"): its own read at a 0.45 m period, not the
      // aft streaks' 2.6 m one that ran every scratch the length of the
      // part, and a threshold that admits a few per square metre at most
      float wxScP = wx_scratch * uWxSub2.z * wxSide * wxOut * wxPure;
      float gSc = texture2D(tGrunge, vec2(wxAcross / uWxV.w, wxAlong / uWxV.z) + vec2(0.23, 0.59)).b;
      ch = max(ch, smoothstep(0.968 - 0.03 * wxScP, 0.978 - 0.03 * wxScP, gSc) * step(0.01, wxScP));
      // steel goes to primer then rust; rust also BLEEDS down from the chips
      // THE SUBSTRATE WITH ITS OWN ROUGHNESS (G345.2): bare alloy under a
      // chip is a metal at the finish row's roughness — it OUTSHINES the
      // paint round it, which is why a chipped cowl sparkles; the roughness
      // varies chip to chip on the fine noise, and rust is matte and dark
      // whatever it grew on. The clear coat is gone over both (aeroWxCov).
      vec3 sub = mix(uWxSub.rgb, uWxC[6].rgb, wx_rust * uWxSub2.y);
      float subMet = mix(uWxSub.a, 0.0, wx_rust * uWxSub2.y);
      float subRgh = mix(uWxSub2.x * (0.75 + 0.5 * gF.b), uWxC[6].w - 0.10 * gF.r, wx_rust * uWxSub2.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, sub, ch);
      metalnessFactor = mix(metalnessFactor, subMet, ch);
      roughnessFactor = mix(roughnessFactor, subRgh, ch);
      // the bleed is a STREAK, not a tint: the stretched read squared so it
      // runs in rivulets, and strong enough to matte the tube where it runs
      float wxBleed = wx_rust * uWxSub2.y * (1.0 - wxUp) * (1.0 - wxRot) * pow(gSd, 1.2) * (0.3 + 0.7 * wxConvex + 0.5 * wxCav) * 1.3;
      diffuseColor.rgb = mix(diffuseColor.rgb, uWxC[6].rgb, clamp(wxBleed, 0.0, 1.0));
      roughnessFactor = mix(roughnessFactor, max(roughnessFactor, uWxC[6].w), clamp(wxBleed, 0.0, 1.0));
      metalnessFactor *= 1.0 - clamp(wxBleed, 0.0, 1.0);
      // the bleed strips the varnish too — it had kept it, and rust under
      // intact clear coat read as a glossy brown stain
      aeroWxCov = max(aeroWxCov, max(ch, clamp(wxBleed, 0.0, 1.0)));
    }
    roughnessFactor = clamp(roughnessFactor, 0.02, 1.0);
    metalnessFactor = clamp(metalnessFactor, 0.0, 1.0);

    // ---- THE DEBUG VIEWS (the bench) ----------------------------------
    // UNLIT: the mask goes out as emissive over a black, flat, matte surface,
    // so what you see is the mask and not the lamps on the weave
    if (uWxDbg > 0.5) {
      vec3 dbg = vec3(cov);
      if (uWxDbg > 1.5) dbg = vec3(wxCav, wxCrev, wxConcave);
      if (uWxDbg > 2.5) dbg = vec3(wxConvex, 0.0, wxConcave);
      if (uWxDbg > 3.5) dbg = vec3(wxSoot, wxMud, 0.0);
      if (uWxDbg > 4.5) dbg = vec3(gF.r, gF.g, gC.a);
      if (uWxDbg > 5.5) dbg = vec3(wxUp, wxFwd, wxDown);
      diffuseColor.rgb = vec3(0.0);
      totalEmissiveRadiance = dbg;
      normal = nonPerturbedNormal;
      roughnessFactor = 1.0;
      metalnessFactor = 0.0;
    }
  }
}
`;

// after lights_physical_fragment: the clear coat falls with the cover
const AERO_WX_CC_FS = `
#ifdef USE_CLEARCOAT
  // USE_CLEARCOAT since W0.5a (r186); under r128's CLEARCOAT this whole
  // block went silent after the upgrade and no dirt, chip or rust took the
  // varnish off — which is how rust came to read as a glossy stain
  material.clearcoat *= 1.0 - aeroWxCov;
  material.clearcoat *= 1.0 - aeroWxPeel;
  material.clearcoatRoughness = min(1.0, max(material.clearcoatRoughness, aeroWxCov * uWxR.y));
#endif
`;

// THE GLASS, under the rulings: roughness and the clear coat, nothing on the
// albedo by default. Spliced into the glass hook's roughness block, before
// its clamp, where `mm` (pane metres) and `uGlassE` are in hand. uWearK is
// the pane's own multiplier.
const AERO_WX_GLASS_FS = `
    {
      float wxK = uWearK;
      float aeroWxOn = max(max(uWear.x, uWear.y), max(uWear.z, uWear.w)) * wxK;
      if (aeroWxOn > 0.0) {
        float wx_gDust = uWxL[5].x * wxK;
        float wx_gEdge = uWxL[5].y * wxK;
        float wx_gRain = uWxL[5].z * wxK;
        // gl_FrontFacing, not faceDirection: this runs in the roughness chunk,
        // BEFORE normal_fragment_begin declares faceDirection
        vec3 cN = normalize(vCraftNrm) * (gl_FrontFacing ? 1.0 : -1.0);
        float wxUp = clamp(cN.z, 0.0, 1.0);
        vec4 gC = texture2D(tGrunge, mm / uWxG.y + vec2(0.37, 0.61));
        vec4 gF = texture2D(tGrunge, mm / uWxG.x);
        // a dust film: features no finer than the coarse blotch (>= 0.5 m),
        // never the fine sheet — a speckled windscreen is unreadable
        float wxFilm = wx_gDust * (0.35 + 0.65 * wxUp) * (0.4 + 0.6 * gC.a);
        roughnessFactor += 0.30 * wxFilm;
        aeroWxCov = max(aeroWxCov, 0.6 * wxFilm);
        // rain spots: large cells only, OFF by table until the bench admits it
        float wxSpot = smoothstep(0.78, 0.86, gC.g) * wx_gRain;
        roughnessFactor += 0.45 * wxSpot;
        aeroWxCov = max(aeroWxCov, 0.7 * wxSpot);
        // more grime at the frame with the years (the pane's own extent)
        if (uGlassE.z > uGlassE.x) {
          vec2 wxLo = mm - uGlassE.xy, wxHi = uGlassE.zw - mm;
          float wxE = max(min(min(wxLo.x, wxLo.y), min(wxHi.x, wxHi.y)), 0.0);
          float wxEg = (1.0 - smoothstep(0.0, 0.13, wxE)) * wx_gEdge * (0.6 + 0.4 * gF.r);
          aeroGDirt = min(1.0, aeroGDirt + 0.9 * wxEg);
          roughnessFactor += 0.35 * wxEg;
          aeroWxCov = max(aeroWxCov, 0.5 * wxEg);
        }
      }
    }
`;

// THE MULTIPLY PASS with craft space: insects darken what is seen through
// the pane. OFF by table; here so the bench can measure it.
const AERO_WX_GTINT_VS = `
uniform mat4 uCraftInv;
varying vec3 vN; varying vec3 vV; varying vec3 vCraftPos; varying vec3 vCraftNrm;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  vCraftPos = (uCraftInv * modelMatrix * vec4(position, 1.0)).xyz;
  vCraftNrm = mat3(uCraftInv) * (mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * mv;
}`;
const AERO_WX_GTINT_FS = `
uniform vec3 uTint; uniform float uA; uniform float uFres; uniform float uWearK;
uniform vec4 uWear; uniform vec4 uWxL[6]; uniform vec4 uWxR; uniform sampler2D tGrunge;
varying vec3 vN; varying vec3 vV; varying vec3 vCraftPos; varying vec3 vCraftNrm;
void main() {
  float nv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
  float fr = pow(1.0 - nv, 5.0) * uFres;
  vec3 pass = mix(vec3(1.0), uTint, clamp(uA * 2.0, 0.0, 1.0));
  float wxBug = uWxL[5].w * uWearK;
  vec3 cN = normalize(vCraftNrm) * (gl_FrontFacing ? 1.0 : -1.0);
  float wxFwd = clamp(-cN.y, 0.0, 1.0);
  float wxDens = wxBug * pow(wxFwd, 1.5);
  vec2 wxPl = vec2(vCraftPos.y, mix(vCraftPos.z, vCraftPos.x, cN.z * cN.z));
  vec4 gB = texture2D(tGrunge, wxPl / uWxR.w + vec2(0.13, 0.71));
  float thr = 1.0 - 0.50 * wxDens;
  float body = smoothstep(thr, thr + 0.06, gB.g) * step(0.01, wxDens);
  gl_FragColor = vec4(pass * (1.0 - uA) * (1.0 - fr) * (1.0 - 0.85 * body), 1.0);
}`;

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------
const AEROWX_API = {
  AERO_WX_MACRO, AERO_WX_LAYERS, AERO_WX_COL, AERO_WX_KNOB, AERO_WX_SUB,
  AERO_WX_DEF, AERO_WX_GLOSS_OK, AERO_WX_NL, AERO_WX_NE, AERO_WX_NW, AERO_WX,
  aeroWxResolve, aeroWxMacroFromSpec, aeroWxMacroToSpec,
  aeroWxGrunge, aeroWxGrungeTex, AERO_WX_GRUNGE_PX,
  aeroWxSharedU, aeroWxFinishU, aeroWxRefresh, aeroWxSetMacro, aeroWxPin,
  aeroWxSetDebug, aeroWxSetSources, aeroWxCraftOf, aeroWxSetSpiral, AERO_WX_SPIRAL_DEF,
  aeroWxLabGet, aeroWxLabSet, aeroWxLabReset, aeroWxLabExport, AERO_WX_LAB_KEY,
  AERO_WX_PARS_FS, AERO_WX_SURF_FS, AERO_WX_CC_FS, AERO_WX_GLASS_FS,
  AERO_WX_GTINT_VS, AERO_WX_GTINT_FS,
};
if (typeof window !== 'undefined') window.AEROWX = AEROWX_API;
if (typeof module !== 'undefined') module.exports = AEROWX_API;
