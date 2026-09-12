// ROD FIT — the bolted SADDLE that carries a tail on a bare tube boom
// (G307, the fitment study P3; the user's ruling: "fin/stab/tailwheel on a
// rod meet bolted saddle clamps, not the tube"; the G26 follow-up "tail
// clamp fittings on the tube" that never landed).
//
// The rod boom is a bare tube and the fin, the stab and the tailwheel each
// met it by INTERSECTION: the fin's rounded root rim bulged 30 mm into the
// tube, the stab's halves floated where their slider put them, the
// tailwheel's doubler wrapped 80-95 degrees round a 120 mm tube. A real
// tube-boom aeroplane bolts its tail on with SADDLES — a split collar
// clamped round the tube with a flat plate on it, and the part bolted to
// the plate — and that is what this draws, over GEAR_KIT's own primitives
// (revolve, boxIn, lug, bolt), in scene metres.
//
//   saddle(bag, { ctr, axis, r, w, plate: { top, bot, W, L, t }, collar })
//     ctr    a point on the tube's axis, at the saddle's station
//     axis   the tube's axis direction (unit, toward the tail)
//     r      the tube's radius
//     w      the collar's width along the axis (default SADDLE.w)
//     plate  { top: 1 } a plate tangent to the crown, { bot: 1 } to the
//            belly, or both; W across (lateral), L along, t thick
//     collar false = the plate and its bolts only (a second saddle's plate
//            bolted onto a collar another part already drew)
//   -> { top: y of the top plate's upper face, bot: y of the bottom
//        plate's lower face, hS: the saddle's height over the crown }
//
//   SADDLE.hS is what a part seated on the plate is raised by over the
//   tube's crown: collar + plate + a hair — the number the fin and the
//   stab layers lift their decks by, so the root lands ON the plate.
//
// Loads in node (require) and the browser (window.ROD_FIT); needs GEAR_KIT.
'use strict';
(() => {
const NODE = typeof module !== 'undefined' && module.exports;
const W = typeof window !== 'undefined' ? window : null;
const K = W && W.GEAR_KIT;

const SADDLE = { w: 0.040, t: 0.0035, plateT: 0.006, hS: 0.0105, lugR: 0.006, boltR: 0.005 };

const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const off = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];

function saddle(bag, o) {
  if (!K) return null;
  const S = SADDLE;
  const ax = nrm(o.axis || [0, 0, -1]);
  const up0 = [0, 1, 0];
  const side = nrm(crs(ax, up0));                 // lateral
  const up = nrm(crs(side, ax));                  // true up, square to the axis
  const r = o.r, w = o.w || S.w, t = S.t;
  const ctr = o.ctr;
  const out = { hS: S.hS };
  if (o.collar !== false) {
    // THE SPLIT COLLAR: a ring of the tube's radius plus a hair, `t` thick,
    // `w` wide — revolved about the tube's own axis — and a lug pair on each
    // flank at the split, with the clamp bolt through them
    // (no cap: revolve's cap is a disc to the AXIS, inside the tube; the
    // profile closes on itself instead)
    K.revolve(bag, off(ctr, ax, -w * 0.5), ax,
              [[r + 0.0008, 0], [r + t, 0], [r + t, w], [r + 0.0008, w], [r + 0.0008, 0]], 24, false);
    // the split is the horizontal plane through the axis: each flank gets
    // an ear pair — the top half's ear over the bottom half's, a gap between
    // — and a bolt up through both
    const earL = S.lugR * 2.4, earT = t * 1.3, gap = 0.0015;
    for (const s of [1, -1]) {
      const cx = off(ctr, side, s * (r + t + earL * 0.5 - 0.001));
      for (const e of [1, -1])
        K.boxIn(bag, off(cx, up, e * (gap * 0.5 + earT * 0.5)), [earL * 0.5, earT * 0.5, w * 0.5], side, up, ax);
      K.bolt(bag, off(off(cx, up, -(gap * 0.5 + earT)), up, -0.002), [-up[0], -up[1], -up[2]], S.boltR, earT * 2 + gap + 0.006);
    }
  }
  const pl = o.plate || { top: 1 };
  const Wp = pl.W || (r * 2 + 0.02), Lp = pl.L || (w + 0.03), tp = pl.t || S.plateT;
  const plateAt = sgn => {
    // tangent to the crown (sgn +1) or the belly (-1): the plate's inner
    // face sits on the collar's outer radius, its bolts at the corners
    const base = off(ctr, up, sgn * (r + t + 0.0004));
    const c = off(base, up, sgn * tp * 0.5);
    K.boxIn(bag, c, [Wp * 0.5, tp * 0.5, Lp * 0.5], side, up, ax);
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      K.bolt(bag, off(off(off(base, up, sgn * tp), side, sx * Wp * 0.38), ax, sz * Lp * 0.36),
             [up[0] * sgn, up[1] * sgn, up[2] * sgn], S.boltR, 0.008);
    return off(base, up, sgn * tp);
  };
  if (pl.top) out.top = plateAt(1);
  if (pl.bot) out.bot = plateAt(-1);
  return out;
}

// A PEDESTAL: the block that carries a part standing off its plate (a stab
// whose root line the builder set above the tube). A box from the plate's
// face to the part's underside, the plate's own footprint.
function pedestal(bag, o) {
  if (!K) return null;
  const ax = nrm(o.axis || [0, 0, -1]);
  const side = nrm(crs(ax, [0, 1, 0])), up = nrm(crs(side, ax));
  const h = o.h;
  if (!(h > 0.002)) return null;
  const c = off(o.base, up, h * 0.5);
  K.boxIn(bag, c, [o.W * 0.5, h * 0.5, o.L * 0.5], side, up, ax);
  return off(o.base, up, h);
}

const API = { SADDLE, saddle, pedestal };
if (NODE) module.exports = API;
if (W) W.ROD_FIT = API;
})();
