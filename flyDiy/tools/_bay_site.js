#!/usr/bin/env node
// BAY SITE (G97) — THE INSIDE OF THE AEROPLANE, WHICH HAS NEVER EXISTED.
//
// GEN_ACCESS put things ON the skin, and `_fit_site.js` answers "where is that
// point on the surface". A tank goes IN, and nothing in this project can say
// what "in" means: `cageInterior` builds linings and members — surfaces, not a
// solid — and the only existing measurement of a section is `sectionArc`,
// which returns the sC extent and is one-dimensional. So this file is the
// mechanism the energy module needs, and the reason G97 comes first.
//
// ---------------------------------------------------------------------------
// THE SECTION IS SWEPT WITH THE FIELD, NOT SLICED WITH A PLANE, and getting
// that wrong cost the first version of this file.
//
// The obvious way to cut a section is to take every vertex within a band of
// z and sort it by angle. It does not work, and it fails QUIETLY: the body is
// a station x level lattice, so a plane between two rings catches almost
// nothing, and the section comes back with two thirds of its bins empty. Ten
// stations across the stock build produced FOUR sections and six refusals.
// Widening the band until it finds something is the trap GEN_ACCESS already
// documented ("a search that widens until it finds something finds the
// cabin"), and here it would also smear a taper — over-reading the radius,
// which for a fuel tank is the one direction the error must never go.
//
// The field already solves this exactly. `aStruct = [sL, sC, st, lv]` carries
// `sL` (metres along the body, 0 at the firewall) and `lv` (the RAIL index: 0
// keel, 1 floor, 2 waist, 3 band, 4 ceiling, 5 roof, fractions between), and
// `fieldHits` inverts any pair of them by barycentric containment on the real
// triangles. So a section at station sL is a SWEEP of lv from keel to roof —
// exact at every station, no binning, no clustering, no gaps, and defined
// between rings as naturally as on them. It also follows a SLOPING ring (the
// windscreen rings slope, per G49) because sL is along the body, not along z.
//
// ---------------------------------------------------------------------------
// TWO HITS PER QUERY IS THE POINT, NOT A FAULT. sC and lv are per-LEVEL, so
// the +x and -x halves carry identical values and one (sL, lv) query names a
// point on EACH flank. That is precisely what a section wants: the sweep
// returns both chains at once, and the polygon is starboard keel->roof, then
// port roof->keel.
//
// THE CROWN AND THE KEEL ARE CLIPPED, DELIBERATELY. The field is mirrored, so
// it cannot name the centreline at all — `_fit_site` needs a separate spine
// query for exactly this reason. Rather than import that machinery, the
// polygon closes across the two lv=0 points and the two lv=5 points, which
// cuts a shallow cap off the top and the bottom. That UNDERSTATES the volume
// by about a per cent, and understating is the safe direction for a tank.
//
// ---------------------------------------------------------------------------
// THE WALL COMES OFF ALONG THE EDGE NORMAL, NOT ALONG THE RADIUS. A radial
// inset moves each point toward the centre by t, which is only right where the
// wall faces the centre. On a flat flank — most of a fabric-and-tube fuselage
// — it leaves a wedge of structure inside the usable volume and OVERSTATES
// what fits. Every error here is taken in the safe direction, so the offset is
// along each edge's own 2-D normal, neighbours intersected.
//
// ---------------------------------------------------------------------------
// UNITS. Everything is in the mesh's own units — cage units for a body mesh,
// metres for the wing. Callers convert (the K2 = FS trap in _cage_access.js).
// `bayVolume` returns the cube of that unit and needs FS^3 to reach m^3.
'use strict';
(function () {

const FS_ = (typeof window !== 'undefined' && window.FIT_SITE) ||
            (typeof require !== 'undefined' ? require('./_fit_site.js') : null);

const NLV = 34;           // lv samples keel->roof. 34 is ~6 per structural bay.
const LV_LO = 0, LV_HI = 5;
const MIN_CHAIN = 6;      // fewer than this on a side is not a section

// ---------------------------------------------------------------------------
// one station -> the closed section polygon, swept in lv
// ---------------------------------------------------------------------------
// Returns { poly: [[x,y]...] ordered, z, sL, sides } or null.
// `poly` is the SKIN line; `bayInset` takes the wall off it.
function baySection(mesh, sL, opt) {
  if (!FS_ || !mesh || !mesh.A) return null;
  const o = opt || {};
  const nlv = o.nlv || NLV;
  const star = [], port = [];
  let zsum = 0, zn = 0;

  for (let i = 0; i < nlv; i++) {
    const lv = LV_LO + (LV_HI - LV_LO) * (i / (nlv - 1));
    const hits = FS_.fieldHits(mesh, FS_.AX_RAIL, sL, lv);
    if (!hits.length) continue;
    // the outermost hit on each flank. A liner and its skin both carry the
    // field at the same (sL, lv), and the skin is the one further out — the
    // same "away from the section centre" rule faceOut uses for its sign.
    let bs = null, bp = null;
    for (const h of hits) {
      if (FS_.NOT_SKIN.has(h.mat)) continue;
      const x = h.p[0];
      if (x >= 0) { if (!bs || x > bs.p[0]) bs = h; }
      else        { if (!bp || x < bp.p[0]) bp = h; }
    }
    if (bs) { star.push([bs.p[0], bs.p[1]]); zsum += bs.p[2]; zn++; }
    if (bp) { port.push([bp.p[0], bp.p[1]]); zsum += bp.p[2]; zn++; }
  }
  if (star.length < MIN_CHAIN || port.length < MIN_CHAIN) return null;

  // starboard keel->roof, then port roof->keel: one closed loop, and it comes
  // out counter-clockwise in (x, y) with y up.
  const poly = star.concat(port.slice().reverse());
  return { poly, sL, z: zn ? zsum / zn : 0, sides: [star.length, port.length] };
}

// ---------------------------------------------------------------------------
// take the wall off, along the edge normals
// ---------------------------------------------------------------------------
function bayInset(poly, t) {
  const n = poly.length;
  if (!n || !(t > 0)) return poly.slice();
  // Inward normal of edge i -> i+1. The polygon is COUNTER-CLOCKWISE (y up),
  // so the interior lies to the LEFT of travel and the inward normal of
  // (dx, dy) is (-dy, dx). The other sign GROWS the section, which reads as a
  // slightly roomier aeroplane and nothing else — so the gate asserts inset
  // area < skin area rather than trusting this comment.
  const off = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    off.push([a[0] + nx * t, a[1] + ny * t, b[0] + nx * t, b[1] + ny * t]);
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = off[(i - 1 + n) % n], q = off[i];
    const r1x = p[2] - p[0], r1y = p[3] - p[1];
    const r2x = q[2] - q[0], r2y = q[3] - q[1];
    const den = r1x * r2y - r1y * r2x;
    // near-parallel neighbours are the common case on a smooth arc; the shared
    // offset corner is the right answer there and the intersection is unstable
    if (Math.abs(den) < 1e-12) { out.push([q[0], q[1]]); continue; }
    const s = ((q[0] - p[0]) * r2y - (q[1] - p[1]) * r2x) / den;
    out.push([p[0] + r1x * s, p[1] + r1y * s]);
  }
  return out;
}

function polySignedArea(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}
function polyArea(poly) { return Math.abs(polySignedArea(poly)); }

// A SECTION THINNER THAN TWICE THE WALL HAS NO INTERIOR, and the offset does
// not say so — it INVERTS. Measured on the stock build's tail cap: a section of
// 0.0000 m2 inset by 35 mm came back as 0.0378 m2 with its winding flipped, and
// bayVolume happily integrated it. Every closing cone (nose cap, tail cap, a
// boom's last bay) hits this, so it would have added phantom litres to the
// slenderest part of every aeroplane while looking like a rounding error.
//
// The test is the WINDING, not the size: an offset that has turned itself
// inside out is the definition of "the walls met". Returns true when the
// section has closed.
function insetCollapsed(skin, inner) {
  if (!inner || inner.length < 3) return true;
  const a0 = polySignedArea(skin), a1 = polySignedArea(inner);
  return (a0 > 0) !== (a1 > 0) || Math.abs(a1) >= Math.abs(a0);
}

// standard crossing test. A fuselage section is star-shaped about its centre
// but NOT convex (_strut_gen says so of the same sections), so a radial test
// would be wrong at a sill or a wheel arch.
function pointIn(poly, x, y) {
  if (!poly || poly.length < 3) return false;   // a closed section holds nothing
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) &&
        x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

// signed clearance to the wall: positive inside. "It fits" and "it fits with
// 4 mm to spare" are different answers and a fit report wants the second.
function clearance(poly, x, y) {
  if (!poly || poly.length < 3) return -Infinity;
  let best = Infinity;
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L2 = dx * dx + dy * dy || 1e-12;
    let u = ((x - a[0]) * dx + (y - a[1]) * dy) / L2;
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    const d = Math.hypot(x - (a[0] + dx * u), y - (a[1] + dy * u));
    if (d < best) best = d;
  }
  return pointIn(poly, x, y) ? best : -best;
}

// ---------------------------------------------------------------------------
// a bay: the interior between two stations, in sL
// ---------------------------------------------------------------------------
// `wall` is the structural depth to remove (shellT, or shellT + skinT for a
// monocoque). Stations that return no section are kept as nulls rather than
// dropped, so a caller can see WHERE a bay ran off the end of the body.
function bayProfile(mesh, sLo, sHi, wall, n, opt) {
  const N = Math.max(2, n || 12);
  const out = [];
  for (let i = 0; i < N; i++) {
    const sL = sLo + (sHi - sLo) * (i / (N - 1));
    const cut = baySection(mesh, sL, opt);
    if (!cut) { out.push(null); continue; }
    const inner = bayInset(cut.poly, wall || 0);
    const closed = insetCollapsed(cut.poly, inner);
    out.push({ sL, z: cut.z, skin: cut.poly,
               poly: closed ? [] : inner,
               skinArea: polyArea(cut.poly),
               area: closed ? 0 : polyArea(inner), closed });
  }
  return out;
}

// THE CONICAL RULE, not the trapezoid. Consecutive sections are similar shapes
// at different scales far more often than they are parallel prisms — a boom
// tapers, a nose closes — and (A1 + A2 + sqrt(A1 A2))/3 is exact for that,
// where the trapezoid overstates a strong taper by up to 6%. Overstating a
// fuel tank is the error this module exists to prevent.
//
// RETURNS THE CUBE OF THE MESH'S OWN UNIT: x FS^3 for m^3, then x 1000 for
// litres.
function bayVolume(profile) {
  let v = 0;
  for (let i = 0; i + 1 < profile.length; i++) {
    const a = profile[i], b = profile[i + 1];
    if (!a || !b) continue;
    const d = Math.abs(b.sL - a.sL);
    v += d * (a.area + b.area + Math.sqrt(a.area * b.area)) / 3;
  }
  return v;
}

// does a solid fit? `pts` are sample points of the solid as [x, y, sL] — its
// corners and silhouette, not its centre. Returns the worst clearance and the
// point that produced it, so a caller can report WHY rather than just refuse.
// A point outside the profile's station range is a MISS, not a pass: a tank
// that runs out past the tailpost has not fitted.
function baySolidFits(profile, pts) {
  const zs = profile.filter(Boolean);
  if (!zs.length || !pts.length)
    return { fits: false, worst: -Infinity, at: null, outside: pts.length };
  let sMin = Infinity, sMax = -Infinity;
  for (const s of zs) { if (s.sL < sMin) sMin = s.sL; if (s.sL > sMax) sMax = s.sL; }
  let worst = Infinity, at = null, out = 0;
  for (const p of pts) {
    const sL = p[2];
    if (sL < sMin || sL > sMax) { out++; continue; }
    // the bracketing stations, and the point must clear BOTH. The section
    // between them is not measured, and interpolating a clearance would invent
    // a number where the honest answer is the tighter of the two.
    let lo = null, hi = null;
    for (const s of zs) {
      if (s.sL <= sL && (!lo || s.sL > lo.sL)) lo = s;
      if (s.sL >= sL && (!hi || s.sL < hi.sL)) hi = s;
    }
    let c = Infinity;
    if (lo) c = Math.min(c, clearance(lo.poly, p[0], p[1]));
    if (hi) c = Math.min(c, clearance(hi.poly, p[0], p[1]));
    if (!isFinite(c)) continue;
    if (c < worst) { worst = c; at = p; }
  }
  return { fits: out === 0 && worst > 0, worst, at, outside: out };
}

const API = { baySection, bayInset, bayProfile, bayVolume, baySolidFits,
              polyArea, polySignedArea, insetCollapsed, pointIn, clearance,
              NLV, LV_LO, LV_HI };
if (typeof window !== 'undefined') window.BAY_SITE = API;
if (typeof module !== 'undefined') module.exports = API;

})();
