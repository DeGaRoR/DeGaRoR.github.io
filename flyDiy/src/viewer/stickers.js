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
const stickerStripW = () => STICKER_ORDER.length * STICKER_PLACE.d
                          + (STICKER_ORDER.length - 1) * STICKER_PLACE.gap;

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
function stickerPlacements(THREE) {
  const A = (typeof window !== 'undefined') ? window.AEROSKIN : null;
  const st = (typeof window !== 'undefined' && typeof window.BENCH_STATE === 'function')
           ? window.BENCH_STATE() : null;
  const certs = (st && st.certs) || [];
  const by = {};
  for (const c of certs) if (c && c.id) by[c.id] = c;
  const cells = STICKER_ORDER.map(id => by[id] ? (id + '@' + (by[id].when || '')) : '-');
  if (!cells.some(c => c !== '-')) { stickerSig = null; return []; }
  const sig = cells.join('|');
  const w = stickerStripW(), h = STICKER_PLACE.d;
  const place = { page: STICKER_PAGE, sL: STICKER_PLACE.sL + w / 2, sC: STICKER_PLACE.sC,
                  w, h, rot: 0, rough: -0.08, on: { body: 1 }, mode: 'field' };
  if (sig === stickerSig && stickerPlacement) return [stickerPlacement];
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
      const cx = STICKER_PLACE.d / 2 + i * (STICKER_PLACE.d + STICKER_PLACE.gap);
      stickerRoundel(g, cx, h / 2, STICKER_PLACE.d / 2 * 0.98,
        { title: M.title, emblem: M.emblem, date: c.when || '' });
    });
    g.restore();
    stickerDilate(g, px, py, P, P, 3);
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
                      PAGE: STICKER_PAGE, roundel: stickerRoundel,
                      placements: stickerPlacements, refresh: stickerRefresh,
                      stripW: stickerStripW };
  window.AERO_EXTRA_DECALS = THREE => stickerPlacements(THREE);
}
if (typeof module !== 'undefined' && module.exports)
  module.exports = { STICKER_ORDER, STICKER_META, STICKER_PLACE, STICKER_PAGE,
                     stickerRoundel, stickerArcText, stickerEmblem, stickerStripW,
                     stickerPlacements, stickerDilate };
