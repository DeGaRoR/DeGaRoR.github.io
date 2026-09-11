// ============================================================
// THE CERTIFICATION STICKERS (G208) — what an approved aeroplane wears.
//
// The user, 2026-09-07: "We'll put a small circular sticker on approved
// plane's fuselage, I let you design it ... possibly 1 small sticker per
// passed test."
//
// ONE ROUNDEL PER CERTIFICATE, 120 mm, in a row under the cockpit's side
// window on both flanks — where a real aeroplane wears its fuel grade, its
// "experimental" placard and its inspection seals. Cream vinyl, a dark
// navy rim carrying the test's name round the top and the certifying
// bench round the bottom, an emblem for the test in the middle and the
// date it was awarded under it. Four tests, four cells, in the bench's own
// order; a cell whose certificate was never awarded, or was withdrawn, is
// blank vinyl-less skin — so the strip reads left to right as the record.
//
// DRAWN, NOT STORED. The stickers are a picture of the certificate the
// bench holds (BENCH_STATE().certs), never a field in the spec and never a
// pixel in the save: a withdrawn certificate peels its sticker off by
// itself, and a loaded build wears exactly what its envelope's certificate
// says. They reach the skin through aeroskin's AERO_EXTRA_DECALS hook as
// ONE decal — atlas page 6, a strip 0.57 m by 0.12 m in the field frame —
// so the flown aeroplane and the one on the stand read the same list.
//
// THE PAGE IS DRAWN IN METRES. A page maps its full width to the decal's
// width and its full height to the decal's height, independently, so a
// circle in metres is an ellipse in page pixels; the canvas transform does
// that arithmetic (setTransform P/w, P/h) and the roundel is written once,
// in metres, for the atlas and for the panel's thumbnails alike.
// ============================================================

const STICKER_ORDER = ['shake', 'load', 'dalt', 'flight'];
const STICKER_META = {
  shake:  { title: 'BENCH CHECK',      emblem: 'balance' },
  load:   { title: 'WING LOADING',     emblem: 'sandbags' },
  dalt:   { title: 'DENSITY ALTITUDE', emblem: 'mountain' },
  flight: { title: 'TEST FLIGHT',      emblem: 'circuit' },
};
const STICKER_INK = '#1f3552', STICKER_GROUND = '#f1e7d0', STICKER_RIM = '#d9c9a5';
// the strip on the fuselage: field frame, metres aft of the firewall and
// above the waist; `d` the roundel's diameter, `gap` between two.
// AFT OF THE DOOR, UNDER THE REGISTRATION (measured 2026-09-07): the first
// placement, under the cockpit's side window at 0.95 m, drew nothing — the
// cut door is its own section and refuses the box projection (G207,
// markings on paintwork only), and the flank forward of ~1.6 m on the
// stock build is door. The rear fuselage under the registration's letters
// takes it, which is also where a real aeroplane wears its placard line.
const STICKER_PLACE = { sL: 1.70, sC: -0.16, d: 0.12, gap: 0.03 };
const STICKER_PAGE = 6;          // 0 reg, 1-2 images, 3-5 the marking kit
// THE PLACES (G208.2, the user: "we should be able to choose where
// certification stickers are applied, and maybe move them manually a little
// (like the fuel tanks, default section + manual fine tuning)"). A place is
// a named default — station, height, which surfaces, which projection — and
// the decal block's `stkL`/`stkC` fine-tune off it in metres, the way a tank
// takes a bay and then an offset. The defaults are the stock build's; a
// long fuselage or a tall fin is what the fine tuning is for. `sL` is the
// strip's LEADING edge in the field frame (metres aft of the firewall; on
// the wing, metres from the centreline in plan) and `sC` its centre height
// (metres from the waist; on the wing, metres fore and aft in plan).
//
// THE FUSELAGE PLACES ARE IN THE FIELD FRAME (metres aft of the firewall,
// above the waist — the frame a fuselage marking wraps in). THE FIN AND THE
// WING ARE NOT: the field on a flying surface is that surface's own rib and
// spar metres, so those two places use the BOX projections (`side`: along
// and up in the craft frame; `plan`: lateral and along) and take their
// station from LANDMARKS measured off the aeroplane on the stand — the fin's
// top, the wing's upper surface near the root — so the default lands on the
// surface for a long fuselage as much as for the stock one (measured
// 2026-09-07: fixed stations put the fin's strip in the air). Without a
// scene to measure (a core-only build) the stock build's numbers stand in.
const STICKER_PLACES = [
  { id: 'aft',  name: 'rear fuselage, under the registration',
    sL: 1.70, sC: -0.16, on: { body: 1 }, mode: 'field' },
  { id: 'cab',  name: 'cabin side, under the window',
    sL: 0.95, sC: -0.13, on: { body: 1 }, mode: 'field' },
  { id: 'nose', name: 'the nose, behind the cowl',
    sL: 0.15, sC: 0.10, on: { body: 1 }, mode: 'field' },
  { id: 'fin',  name: 'the fin',
    land: 'fin', sL: 5.20, sC: 1.20, on: { tail: 1 }, mode: 'side' },
  { id: 'wing', name: 'the wing, near the root',
    land: 'wing', sL: 0.90, sC: 0.30, on: { wing: 1 }, mode: 'plan' },
];
const stickerStripW = d => { d = d || STICKER_PLACE.d;
  return STICKER_ORDER.length * d + (STICKER_ORDER.length - 1) * d / 4; };

// THE LANDMARKS, off the fielded skin mesh the editor's scene holds (the
// same mesh decReframe reads), in the craft frame: along runs aft (-z), up
// is y, lateral is x. Cached per mesh; a rebuild makes a new mesh.
let stickerLandCache = null;
function stickerLandmarks() {
  try {
    const S = (typeof window !== 'undefined') && window.CAGE_UI_SCENE;
    const T3 = (typeof THREE !== 'undefined') ? THREE : (typeof window !== 'undefined' && window.THREE);
    if (!S || !T3 || !T3.Matrix4) return null;
    // EVERY fielded mesh — the skin is several (the fuselage, each wing, the
    // tail), and the first one alone told the fin it stood 0.32 m tall
    const meshes = [];
    S.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes
                          && o.geometry.attributes.aStruct) meshes.push(o); });
    if (!meshes.length) return null;
    const key = meshes.map(m => m.uuid + ':' + m.geometry.attributes.position.count).join('|');
    if (stickerLandCache && stickerLandCache.key === key) return stickerLandCache;
    S.updateWorldMatrix(true, false);
    const inv = new T3.Matrix4().copy(S.matrixWorld).invert();
    const v = new T3.Vector3();
    let n = 0;
    for (const m of meshes) n += m.geometry.attributes.position.count;
    const X = new Float32Array(n), Y = new Float32Array(n), A = new Float32Array(n);
    let alongMax = -Infinity, k = 0;
    for (const m of meshes) {
      m.updateWorldMatrix(true, false);
      const toCraft = new T3.Matrix4().copy(inv).multiply(m.matrixWorld);
      const P = m.geometry.attributes.position;
      for (let i = 0; i < P.count; i++, k++) {
        v.fromBufferAttribute(P, i).applyMatrix4(toCraft);
        X[k] = v.x; Y[k] = v.y; A[k] = -v.z;
        if (A[k] > alongMax) alongMax = A[k];
      }
    }
    // the fin: the highest point in the last 1.2 m of the aeroplane, and the
    // fin's CHORD at the strip's own height (0.35 m under the top, ±0.08):
    // the leading edge sweeps, so the top's station is the tip's leading
    // corner and a strip hung off it sat in the air ahead of the fin
    // (measured: strip 1.10-1.67 along, fin 1.81-2.53 at that height)
    let finTop = -Infinity, finAlong = alongMax;
    for (let i = 0; i < n; i++) if (A[i] > alongMax - 1.2 && Y[i] > finTop) { finTop = Y[i]; finAlong = A[i]; }
    const yStrip = finTop - 0.35;
    let fa = Infinity, fb = -Infinity;
    for (let i = 0; i < n; i++)
      if (A[i] > alongMax - 1.6 && Y[i] > finTop - 0.6 && Math.abs(Y[i] - yStrip) < 0.08) {
        if (A[i] < fa) fa = A[i]; if (A[i] > fb) fb = A[i]; }
    const finBand = (fb > fa) ? [fa, fb] : null;
    // the wing: the upper surface where |lateral| is about 0.9 m — its
    // height, and the mean station of that surface
    let wingTop = -Infinity;
    for (let i = 0; i < n; i++) if (Math.abs(Math.abs(X[i]) - 0.9) < 0.1 && Y[i] > wingTop) wingTop = Y[i];
    let wa = 0, m = 0;
    for (let i = 0; i < n; i++)
      if (Math.abs(Math.abs(X[i]) - 0.9) < 0.1 && Y[i] > wingTop - 0.06) { wa += A[i]; m++; }
    stickerLandCache = { key, alongMax, finTop, finAlong, finBand,
                         wingTop, wingAlong: m ? wa / m : null };
    return stickerLandCache;
  } catch (e) { return null; }
}

// the placement the decal block asks for: the place's own station and
// height (measured when a landmark is available), the fine tuning, the size,
// the turn — resolved in one place so the editor's live DEC and the flown
// spec's merged decals read the same
function stickerResolve(D, L) {
  D = D || {};
  if (D.stkOn != null && !D.stkOn) return null;
  const pi = Math.max(0, Math.min(STICKER_PLACES.length - 1, Math.round(+D.stkPlace || 0)));
  const p = STICKER_PLACES[pi];
  const d = Math.max(0.03, Math.min(0.5, +D.stkSize || STICKER_PLACE.d));
  const w = stickerStripW(d);
  let sL = p.sL, sC = p.sC;
  if (p.land === 'fin' && L && isFinite(L.finTop)) {
    // centred on the fin's chord at the strip's height, 0.35 m under the
    // top; without a measured chord, hung 0.45 m short of the top's station
    sC = L.finTop - 0.35;
    sL = (L.finBand && L.finBand[1] > L.finBand[0])
       ? (L.finBand[0] + L.finBand[1]) / 2 - w / 2
       : L.finAlong - 0.45 - w;
  } else if (p.land === 'wing' && L && L.wingAlong != null) {
    // across the span from 0.9 m out, on the wing's chord station
    sL = 0.90; sC = L.wingAlong;
  }
  return { d, w, h: d,
           sL: sL + (+D.stkL || 0) + w / 2, sC: sC + (+D.stkC || 0),
           rot: +D.stkRot || 0, on: p.on, mode: p.mode, place: p.id };
}

// ---- ONE ROUNDEL ------------------------------------------------------
// g: a 2d context already transformed so that (cx, cy, r) are in the units
// the caller wants (metres on the atlas, pixels on a thumbnail). `o.small`
// drops the lettering, for a thumbnail too small to carry it. Everything
// here is guarded for the smoke test's stub context (no measureText).
function stickerRoundel(g, cx, cy, r, o) {
  o = o || {};
  const ink = o.ink || STICKER_INK, ground = o.ground || STICKER_GROUND;
  g.save();
  g.translate(cx, cy);
  // the vinyl: cream disc with a soft rim shadow, a dark ring, a hairline
  g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2);
  g.fillStyle = ground; g.fill();
  g.lineWidth = r * 0.035; g.strokeStyle = STICKER_RIM; g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.90, 0, Math.PI * 2);
  g.lineWidth = r * 0.09; g.strokeStyle = ink; g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.64, 0, Math.PI * 2);
  g.lineWidth = r * 0.02; g.strokeStyle = ink; g.stroke();
  if (o.dim) { g.globalAlpha = 0.35; }
  // the emblem, in a unit box of r * 0.48
  g.save();
  g.scale(r * 0.48, r * 0.48);
  g.lineWidth = 0.09; g.strokeStyle = ink; g.fillStyle = ink;
  g.lineCap = 'round'; g.lineJoin = 'round';
  stickerEmblem(g, o.emblem || 'balance');
  g.restore();
  if (!o.small) {
    // lettering round the rim: the test round the top, the bench round the
    // bottom, the date under the emblem
    const fs = r * 0.155;
    g.fillStyle = ink;
    g.font = '700 ' + fs + 'px "IBM Plex Sans", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    stickerArcText(g, String(o.title || ''), r * 0.77, -Math.PI / 2, fs, true);
    g.font = '500 ' + (fs * 0.82) + 'px "IBM Plex Sans", sans-serif';
    stickerArcText(g, 'FLYDIY · ENGINEERING BENCH', r * 0.77, Math.PI / 2, fs * 0.82, false);
    if (o.date) {
      g.font = '600 ' + (r * 0.13) + 'px "IBM Plex Mono", monospace';
      g.fillText(String(o.date), 0, r * 0.50);
    }
  }
  g.restore();
}

// text along an arc of radius R centred on angle `at` (radians, -PI/2 is
// the top). `up` = the glyphs stand on the arc (read clockwise round the
// top); false = they hang under it (read round the bottom, still upright).
function stickerArcText(g, text, R, at, fs, up) {
  let widths = [];
  let total = 0;
  for (const ch of text) {
    let w = fs * 0.6;
    try { const m = g.measureText(ch); if (m && isFinite(m.width)) w = m.width; } catch (e) {}
    widths.push(w); total += w;
  }
  const gap = fs * 0.12;
  total += gap * Math.max(0, text.length - 1);
  // angle per unit length on the arc
  const k = 1 / Math.max(1e-6, R);
  let a = at - (up ? 1 : -1) * total * k / 2;
  let i = 0;
  for (const ch of text) {
    const w = widths[i++];
    const mid = a + (up ? 1 : -1) * w * k / 2;
    // rotate to the glyph's bearing, step out to the arc, then turn the
    // glyph upright: +90° when it stands on the arc (the top), -90° when it
    // hangs under it (the bottom) — both read left to right on screen
    g.save();
    g.rotate(mid);
    g.translate(R, 0);
    g.rotate(up ? Math.PI / 2 : -Math.PI / 2);
    g.fillText(ch, 0, 0);
    g.restore();
    a += (up ? 1 : -1) * (w + gap) * k;
  }
}

// the emblems, each in a box from -1 to 1
function stickerEmblem(g, kind) {
  const P = () => g.beginPath();
  if (kind === 'balance') {
    // a beam on a fulcrum, two pans: the trim and the CG
    P(); g.moveTo(-0.95, -0.15); g.lineTo(0.95, -0.15); g.stroke();
    P(); g.moveTo(-0.22, 0.75); g.lineTo(0, -0.15); g.lineTo(0.22, 0.75); g.closePath(); g.fill();
    P(); g.moveTo(-0.75, -0.15); g.lineTo(-0.9, 0.25); g.lineTo(-0.6, 0.25); g.closePath(); g.stroke();
    P(); g.moveTo(0.75, -0.15); g.lineTo(0.6, 0.25); g.lineTo(0.9, 0.25); g.closePath(); g.stroke();
    P(); g.arc(0, -0.15, 0.09, 0, Math.PI * 2); g.fill();
  } else if (kind === 'sandbags') {
    // an aerofoil with three bags on it: the wing under load
    P(); g.moveTo(-0.95, 0.35); g.quadraticCurveTo(-0.3, -0.35, 0.95, 0.2);
    g.quadraticCurveTo(0.2, 0.45, -0.95, 0.35); g.closePath(); g.stroke();
    const bag = (x, y, w) => { P(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w, y - 0.32, x, y - 0.34);
      g.quadraticCurveTo(x + w, y - 0.32, x + w, y); g.closePath(); g.fill(); };
    bag(-0.42, -0.02, 0.2); bag(0.02, -0.16, 0.2); bag(0.46, -0.06, 0.2);
    // the arrow of the load
    P(); g.moveTo(0, -0.95); g.lineTo(0, -0.6); g.stroke();
    P(); g.moveTo(-0.14, -0.72); g.lineTo(0, -0.55); g.lineTo(0.14, -0.72); g.stroke();
  } else if (kind === 'mountain') {
    // two peaks and a sun: hot and high
    P(); g.moveTo(-1, 0.75); g.lineTo(-0.35, -0.35); g.lineTo(0.0, 0.2);
    g.lineTo(0.35, -0.6); g.lineTo(1, 0.75); g.closePath(); g.fill();
    P(); g.arc(-0.55, -0.55, 0.2, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      P(); g.moveTo(-0.55 + Math.cos(a) * 0.3, -0.55 + Math.sin(a) * 0.3);
      g.lineTo(-0.55 + Math.cos(a) * 0.42, -0.55 + Math.sin(a) * 0.42); g.stroke();
    }
  } else if (kind === 'circuit') {
    // the rectangular pattern, flown clockwise, with the aeroplane on the
    // downwind leg
    const r = 0.18;
    P(); g.moveTo(-0.85 + r, -0.55); g.lineTo(0.85 - r, -0.55); g.arcTo(0.85, -0.55, 0.85, -0.55 + r, r);
    g.lineTo(0.85, 0.55 - r); g.arcTo(0.85, 0.55, 0.85 - r, 0.55, r);
    g.lineTo(-0.85 + r, 0.55); g.arcTo(-0.85, 0.55, -0.85, 0.55 - r, r);
    g.lineTo(-0.85, -0.55 + r); g.arcTo(-0.85, -0.55, -0.85 + r, -0.55, r);
    g.closePath(); g.stroke();
    // the runway on the bottom leg
    g.lineWidth = 0.2; P(); g.moveTo(-0.45, 0.55); g.lineTo(0.45, 0.55); g.stroke();
    g.lineWidth = 0.09;
    // the arrow head on the top leg
    P(); g.moveTo(0.1, -0.72); g.lineTo(0.32, -0.55); g.lineTo(0.1, -0.38); g.closePath(); g.fill();
    // a small aeroplane in the middle: fuselage, wing, tail
    P(); g.moveTo(0, -0.2); g.lineTo(0, 0.28); g.stroke();
    P(); g.moveTo(-0.34, -0.02); g.lineTo(0.34, -0.02); g.stroke();
    P(); g.moveTo(-0.13, 0.24); g.lineTo(0.13, 0.24); g.stroke();
  }
}

// ---- THE STRIP ON THE ATLAS -------------------------------------------
// `certs`: [{id, when}] awarded, in any order. Draws page 6 when the recipe
// changed and returns the ONE placement, or [] when nothing is awarded.
let stickerSig = null, stickerPlacement = null;
// `D` is the decal block (the editor's live DEC, or the flown spec's merged
// decals) — the place, the fine tuning, the size and the turn come from it
function stickerPlacements(THREE, D) {
  const A = (typeof window !== 'undefined') ? window.AEROSKIN : null;
  const st = (typeof window !== 'undefined' && typeof window.BENCH_STATE === 'function')
           ? window.BENCH_STATE() : null;
  const certs = (st && st.certs) || [];
  const by = {};
  for (const c of certs) if (c && c.id) by[c.id] = c;
  const cells = STICKER_ORDER.map(id => by[id] ? (id + '@' + (by[id].when || '')) : '-');
  if (!cells.some(c => c !== '-')) { stickerSig = null; return []; }
  const R = stickerResolve(D, stickerLandmarks());
  if (!R) { stickerSig = null; return []; }
  // the page's drawing depends on the cells and the size (drawn in metres);
  // the placement is cheap and rebuilt every call
  const sig = cells.join('|') + '|' + R.d;
  const w = R.w, h = R.h;
  // ONE SIDE, AND ONE BOOM (2026-09-11): a certification strip is a vinyl
  // applied once, not a projection through the aeroplane. `one` is the
  // shader's own gate (position picks the boom, normal picks the face) and
  // costs nothing on a place that is already single-sided by geometry.
  const place = { page: STICKER_PAGE, sL: R.sL, sC: R.sC, w, h, rot: R.rot,
                  rough: -0.08, on: R.on, mode: R.mode, one: 1 };
  if (sig === stickerSig && stickerPlacement) { stickerPlacement = place; return [place]; }
  if (!A || !A.aeroAtlas) return [];
  try {
    const t = A.aeroAtlas(THREE), cv = t.image;
    const N = A.AERO_ATLAS_N || 4, PX = cv.width || 4096, P = PX / N;
    const px = (STICKER_PAGE % N) * P, py = Math.floor(STICKER_PAGE / N) * P;
    const g = cv.getContext('2d');
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(px, py, P, P);
    g.beginPath(); g.rect(px, py, P, P); g.clip();
    // metres on the page: x from 0 (left, forward) to w, y from 0 (top) to h
    g.setTransform(P / w, 0, 0, P / h, px, py);
    STICKER_ORDER.forEach((id, i) => {
      const c = by[id];
      if (!c) return;
      const M = STICKER_META[id];
      const cx = R.d / 2 + i * (R.d + R.d / 4);
      stickerRoundel(g, cx, h / 2, R.d / 2 * 0.98,
        { title: M.title, emblem: M.emblem, date: c.when || '' });
    });
    g.restore();
    // the bleed scales with the page like the kit's (3 px at the 256 px
    // reference page, 12 at today's 1024): a fixed 3 px on a 4096 atlas is a
    // hairline the mip chain averages against black
    stickerDilate(g, px, py, P, P, Math.max(3, Math.round(3 * P / 256)));
    t.needsUpdate = true;
  } catch (e) {
    console.error('stickers:', e);
    return [];
  }
  stickerSig = sig; stickerPlacement = place;
  return [place];
}

// bleed the opaque pixels' colour into their transparent neighbours, so the
// bilinear sample at a roundel's edge never mixes in the atlas's black
function stickerDilate(g, x, y, w, h, rounds) {
  let im;
  try { im = g.getImageData(x, y, w, h); } catch (e) { return; }
  const d = im.data, W = w;
  for (let r = 0; r < rounds; r++) {
    const src = new Uint8ClampedArray(d);
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < W - 1; i++) {
      const o = (j * W + i) * 4;
      if (src[o + 3] !== 0) continue;
      for (const q of [o - 4, o + 4, o - W * 4, o + W * 4]) {
        if (src[q + 3] !== 0) { d[o] = src[q]; d[o + 1] = src[q + 1]; d[o + 2] = src[q + 2]; break; }
      }
    }
  }
  g.putImageData(im, x, y);
}

// the bench calls this when a certificate is awarded or withdrawn: the strip
// is rebuilt on the next decal pass, which the editor is asked for now
function stickerRefresh() {
  stickerSig = null;
  try {
    if (typeof window !== 'undefined' && window.CAGE_UI && window.CAGE_UI.redecal)
      window.CAGE_UI.redecal();
  } catch (e) {}
}

if (typeof window !== 'undefined') {
  window.STICKERS = { ORDER: STICKER_ORDER, META: STICKER_META, PLACE: STICKER_PLACE,
                      PLACES: STICKER_PLACES, PAGE: STICKER_PAGE, roundel: stickerRoundel,
                      placements: stickerPlacements, resolve: stickerResolve,
                      landmarks: stickerLandmarks,
                      refresh: stickerRefresh, stripW: stickerStripW };
  window.AERO_EXTRA_DECALS = (THREE, D) => stickerPlacements(THREE, D);
}
if (typeof module !== 'undefined' && module.exports)
  module.exports = { STICKER_ORDER, STICKER_META, STICKER_PLACE, STICKER_PLACES,
                     STICKER_PAGE, stickerRoundel, stickerArcText, stickerEmblem,
                     stickerStripW, stickerResolve, stickerPlacements, stickerDilate };
