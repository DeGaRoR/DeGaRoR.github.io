// FIT SITE (G81) — WHERE A FITTING GOES.
//
// GEN_ACCESS's design (HANDOVER, G68's gap list) is "a declared table of
// REQUIREMENTS, each naming what it serves and a placement rule, resolved
// against built geometry and SNAPPED to structure". This file is the
// resolution half: it turns a placement rule into a point on the skin with an
// outward normal, or into NOTHING when the aeroplane has no such place.
//
// ---------------------------------------------------------------------------
// THE SPLIT, and it is the whole reason this file is small.
//
//   THE SURFACE FIELD CHOOSES THE STATION.  aStruct = [sL, sC, st, lv]
//   (_cage_gen.js:165) is metres along the body, metres around the section,
//   and — the part that matters here — an INTEGER st at every structural ring
//   and an INTEGER lv at every structural rail. "Snapped to structure" is
//   already spelled in the data: it is a rounding, not a search. Guards take
//   FRACTIONAL coordinates and nothing is ever drawn on them, so landing on
//   an integer is landing on a real former.
//
//   THE AIRFRAME CONTRACT MOUNTS THE PART.  fitFrame/fitPad
//   (_gear_gen.js:606) already answer "give me a point, an outward normal and
//   a bolted doubler plate on the skin at this station", and they are proven
//   on the entire undercarriage under a header that states the rule: "the
//   pitot rule from G5, applied to every bolt".
//
// So this file writes neither. It reads the field, rounds, and hands over.
//
// ---------------------------------------------------------------------------
// THE LOOKUP IS A BARYCENTRIC INVERSE, NOT A SEARCH.
//
// The field is per-vertex on quads, so a target (sL, sC) is found by splitting
// each quad into two triangles, testing containment in FIELD space, and
// carrying the barycentric weights over to the POSITIONS. It is exact, it
// needs no iteration, and it costs one pass over the faces.
//
// It also works on (st, lv) with no second implementation, because those are
// two more components of the same vector — which is what makes the snap one
// more call rather than a solver. `ax` selects the pair.
//
// ---------------------------------------------------------------------------
// TWO HITS ARE THE NORMAL CASE, NOT A FAULT. sC and lv are per-LEVEL, so the
// +x and -x halves carry IDENTICAL values (_cage_gen.js:180: "ANY FUTURE
// NON-MIRROR-SYMMETRIC SURFACE COORDINATE BREAKS THIS SILENTLY, as a smear
// rather than an error"). A metric site therefore names a point on EACH flank,
// which is what a static port on both sides actually wants. A one-sided
// fitting picks its flank by the sign of x, and must then be drawn into its
// own group or GATE GEN's mirror check fails it — the rule `pitot` already
// follows (63_gen_skin.js:436).
//
// ON A RAIL the target lies on a quad EDGE, so four triangles claim it instead
// of two. They are the same two points. The dedup is by position and it is not
// optional: a doubled site draws a fitting twice into the same millimetre,
// which reads as z-fighting rather than as a bug.
'use strict';
(function () {

// The field's own component order, and the two pairs a rule may speak.
const AX_METRIC = [0, 1];      // sL, sC   — metres, what a decal uses
const AX_STRUCT = [2, 3];      // st, lv   — station, rail: the structure
// sL, lv — METRES ALONG, RAIL AROUND, and it is the pair a fitting wants.
// A fitting's station is a real distance ("300 mm behind the cabin") but its
// position round the section is a PLACE ("on the keel", "at the waist", "on
// the crown"), and lv already names those exactly: 0 keel, 1 floor, 2 waist,
// 3 band, 4 ceiling, 5 roof, fractions in between. It is defined at every
// station and needs no measuring, which the two attempts before it did.
const AX_RAIL = [0, 3];

// NOT A PLACE TO PUT A FITTING. Glass is the editor's own set
// (_cage_ui.js:246 GLASSM, and aeroskin.js's AERO_GLASS agrees); the rim beads
// carry no field at all so they can never be hit anyway; the interior liners
// and frames are inside the body and a fitting bolted to one would be
// invisible. Named rather than derived because "which surfaces are outside" is
// a fact about the aeroplane, not about the mesh.
const NOT_SKIN = new Set([
  'windshield', 'pilotWindow', 'pasengerWindow', 'skyWindows',   // glazing
  'joint',                                                       // rim beads
  'bulkhead', 'firewall', 'dash', 'dashFace', 'tube', 'woodFrame',
  'aluminium',
  'plywood', 'cloth', 'composite', 'toele',                      // interior
  // the firewall's engine face and the seal round it: inside the cowl, not
  // on the outside of the aeroplane, and a fitting bolted there would be
  // invisible under the cowling
  'fireProof', 'fireSeal',
]);

const TRI3 = [[0, 1, 2]];
const TRI4 = [[0, 1, 2], [0, 2, 3]];

function triNormal(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}

// ---------------------------------------------------------------------------
// the inverse: (field x, field y) -> every point on the skin that carries it
// ---------------------------------------------------------------------------
// `ax` is the component pair; `tx`/`ty` the target. Returns one entry per
// triangle that contains the target, BEFORE dedup and BEFORE any filtering,
// because the callers want to say different things about a rejected hit.
function fieldHits(mesh, ax, tx, ty) {
  const A = mesh && mesh.A, V = mesh && mesh.V;
  if (!A || !V || !mesh.F) return [];
  const out = [];
  const ix = ax[0], iy = ax[1];
  for (const f of mesh.F) {
    const ids = f && f.v;
    if (!ids || ids.length < 3) continue;
    // THE FIELD IS SHORTER THAN THE MESH. cageRims appends its bead vertices
    // after the field array, so A[i] is undefined up there — measured on the
    // stock build: 5794 vertices, 2594 of them fielded. Every bare face is
    // skipped rather than defaulted, which is also what keeps the
    // per-material purity _surf_check asserts from being violated by accident.
    let bare = false;
    for (const i of ids) if (!A[i]) { bare = true; break; }
    if (bare) continue;
    // THE REVEAL IS A SURFACE OF LAST RESORT (2026-08-31). The window frame
    // pass insets along the outward NORMAL, so its two bands carry the SAME
    // (sL, lv) as the skin loop they came from: three faces at one point on
    // the aeroplane, and a site that should resolve once resolved three
    // times. GATE FIT read that as "the table wants 1 but the skin offers 3"
    // — 176 checks with `winFrameW` non-zero, which is what kept the real
    // window recess from being a default.
    //
    // BUT SKIPPING THEM OUTRIGHT IS ALSO WRONG, and the gate said so: inside
    // a glazed zone the bands are ALL the body-material surface there is, so
    // four probe stations went from three sites to none. So the reveal is
    // TAGGED here and weighed at the end: where real skin covers the point
    // the bands are dropped, and where it does not they are what there is.
    const isRev = !!f.reveal;
    const tris = ids.length >= 4 ? TRI4 : TRI3;
    for (const t of tris) {
      const ia = ids[t[0]], ib = ids[t[1]], ic = ids[t[2]];
      const a = A[ia], b = A[ib], c = A[ic];
      const axx = a[ix], ayy = a[iy], bx = b[ix], by = b[iy],
            cx = c[ix], cy = c[iy];
      const den = (by - cy) * (axx - cx) + (cx - bx) * (ayy - cy);
      // a degenerate triangle in field space is a real thing, not a fault:
      // the nose cap collapses a whole ring onto one station
      if (den > -1e-12 && den < 1e-12) continue;
      const w0 = ((by - cy) * (tx - cx) + (cx - bx) * (ty - cy)) / den;
      const w1 = ((cy - ayy) * (tx - cx) + (axx - cx) * (ty - cy)) / den;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
      const pa = V[ia], pb = V[ib], pc = V[ic];
      out.push({
        p: [pa[0] * w0 + pb[0] * w1 + pc[0] * w2,
            pa[1] * w0 + pb[1] * w1 + pc[1] * w2,
            pa[2] * w0 + pb[2] * w1 + pc[2] * w2],
        // every component, whichever pair was searched on — a rule that
        // snapped in structural space still wants to report its metres
        sL: a[0] * w0 + b[0] * w1 + c[0] * w2,
        sC: a[1] * w0 + b[1] * w1 + c[1] * w2,
        st: a[2] * w0 + b[2] * w1 + c[2] * w2,
        lv: a[3] * w0 + b[3] * w1 + c[3] * w2,
        n: triNormal(pa, pb, pc),
        mat: f.m,
        reveal: isRev,
      });
    }
  }
  // THE SKIN WINS WHERE THERE IS SKIN. See the note on `isRev` above: the
  // reveal's bands share their field coordinate with the loop they were inset
  // from, so keeping both would multiply every site inside a glazed zone.
  // Where a real face covers the point the bands are dropped; where the bands
  // are the only body-material surface there is — which is the whole inside of
  // a window frame — they stand, because no site at all is the worse answer.
  const solid = out.filter(h => !h.reveal);
  return solid.length ? solid : out;
}

// ---------------------------------------------------------------------------
// THE OUTWARD NORMAL, and it has to be decided rather than trusted.
// ---------------------------------------------------------------------------
// The quads' winding is consistent within a section, but this file is handed
// meshes that have been through the cut, canopy, rim and interior passes, and
// an inward normal puts a filler cap inside the fuel tank. So the sign is
// taken from the geometry: the body is a closed tube about its own centreline,
// so "outward" is "away from the section centre" — the same test meshAirframe
// casts its rays under. `cy` is the section's own mid-height at this station
// rather than a global axis: a deep nose and a shallow tail do not share a
// centre.
function faceOut(n, p, cy) {
  const rx = p[0], ry = p[1] - cy;
  return (n[0] * rx + n[1] * ry) >= 0 ? n : [-n[0], -n[1], -n[2]];
}

// the mid-height of the body at this station, from the mesh's own fielded
// vertices in a slice around it. Cheap, and it does not need the airframe
// contract to have been built — which matters, because the gear layer only
// publishes AF when the aeroplane HAS gear.
function sectionCY(mesh, z, halfBand) {
  const V = mesh.V, A = mesh.A;
  const band = halfBand || 0.12;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < V.length; i++) {
    if (!A[i]) continue;
    const p = V[i];
    if (p[2] < z - band || p[2] > z + band) continue;
    if (p[1] < lo) lo = p[1];
    if (p[1] > hi) hi = p[1];
  }
  if (!isFinite(lo)) return 0;
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// THE SECTION'S OWN ARC AT A STATION — and why sC is asked for as a FRACTION
// ---------------------------------------------------------------------------
// sL in metres is right: a station is a real distance aft of the firewall, and
// a fitting 300 mm behind the cabin is 300 mm behind the cabin on any
// aeroplane. sC in metres is NOT, and the first cut of GEN_ACCESS got this
// wrong in a way that only showed up as silence.
//
// A fuselage SHRINKS. The cabin's section is a metre and a half around; the
// tailpost's is a few hundred millimetres. So a rule that says "0.67 m below
// the waist" is on the belly at the cabin and 300 mm off the aeroplane
// entirely at the tail — and `accessSites` correctly refuses, so the tail
// tie-down simply never appeared and nothing said why. The same error put the
// beacon 310 mm off the spine while asking for the centreline, because the
// cabin's own half-height is nowhere near the crown once you are aft of it.
//
// What a fitting's position round a section actually means is ON THE CROWN, AT
// THE WAIST, ON THE KEEL — and those are fractions. So the table gives `sCf`
// in [-1, +1] and this converts, at the station, against the section's real
// arc. Where a rule genuinely means a distance (a static port 60 mm below the
// waist rail, because that is where the flat is) it may still say `sC`.
// ---------------------------------------------------------------------------
// THE CROWN AND THE KEEL — a GEOMETRIC query, because the field cannot do it
// ---------------------------------------------------------------------------
// lv 5 is the ROOF LONGERON and lv 0 is the KEEL longeron, and a longeron is
// not the centreline: it runs at the roof's own half-width, so an aerial
// placed on lv 5 sits 90 mm off the spine at mid-body. Small enough to read as
// sloppiness rather than as a bug, which is exactly why it needs naming.
//
// AND THE FIELD CANNOT FIND THE SPINE. sC is mirrored across it by
// construction, so (sL, sC) names a point on EACH flank and never one on the
// centreline; at the crown sC is at a maximum, where interpolating is
// unstable and the lookup mostly returns nothing at all. Two attempts went
// this way before the reason was clear: metres round the section, then a
// fraction of the measured arc. Both were the field being asked a question it
// is structurally unable to answer.
//
// So this is geometry. The spine is where |x| is least; the crown and the keel
// are the extremes of y there. It returns a REAL MESH VERTEX, so the site is
// exactly on the skin by construction rather than to a tolerance, and the
// normal comes from a face that actually contains it.
// THE SPINE IS BUILT ONCE PER MESH, not searched per fitting. It is the
// vertices with |x| under a tenth of the local half-width, sorted by station —
// the welded crown and keel chains — and every centreline query is a lookup in
// it. Built lazily and cached against the mesh object, because a rebuild hands
// over a new one and every slider drag is a rebuild.
//
// This replaced a per-fitting search that widened its window until it found
// something, and what it found was the cabin wherever you asked: the fuel cap,
// the comm aerial and the beacon all landed on the same square centimetre of
// cabin roof while each had asked for a different station. A profile cannot do
// that, because the station is an INDEX into it rather than the outcome of a
// search.
const SPINE_CACHE = new WeakMap();

function spineOf(mesh, sign) {
  let rec = SPINE_CACHE.get(mesh);
  if (!rec) SPINE_CACHE.set(mesh, rec = {});
  const key = sign > 0 ? 'up' : 'dn';
  if (rec[key]) return rec[key];
  const A = mesh.A, V = mesh.V;
  // the local half-width, binned along the body, so "near the centreline" is a
  // fraction of the aeroplane THERE rather than an absolute
  const BIN = 0.25, half = new Map();
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (!a) continue;
    const b = Math.round(a[0] / BIN);
    const ax = Math.abs(V[i][0]);
    if (!(half.get(b) >= ax)) half.set(b, ax);
  }
  const best = new Map();
  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    if (!a) continue;
    const hw = half.get(Math.round(a[0] / BIN)) || 0;
    if (hw <= 1e-6 || Math.abs(V[i][0]) > hw * 0.10) continue;
    // AND IT MUST BE ON THE RIGHT SIDE OF THE WAIST. sC is signed — zero on
    // the waist rail, positive upward — so the crown chain is sC > 0 and the
    // keel chain sC < 0, which separates them with no geometry at all. Without
    // this the two lists mix wherever the spine is sparse: over the nose the
    // only centreline vertex in a bin is sometimes the KEEL one, and it went
    // into the crown list and put the fuel cap under the aeroplane.
    if (sign * a[1] <= 0) continue;
    const b = Math.round(a[0] / 0.02);
    const cur = best.get(b);
    if (cur === undefined || sign * V[i][1] > sign * V[cur][1]) best.set(b, i);
  }
  return (rec[key] = Array.from(best.values())
    .sort((x, y) => A[x][0] - A[y][0]));
}

// How far past the ends of the spine a station may ask before it is refused.
// A fitting beyond that has nothing to bolt to, and inventing a station for it
// is how a fitting ends up floating behind the aeroplane.
const CROWN_MAX_OFF = 0.6;

// A CENTRELINE SITE, INTERPOLATED ALONG THE SPINE. `key` selects what `want`
// is measured in: 0 for metres along the body, 2 for the structural station,
// which is how the snap asks.
//
// IT INTERPOLATES RATHER THAN SNAPPING TO THE NEAREST VERTEX, and that is not
// a refinement — it is what makes the aft half of the aeroplane usable at all.
// The crown chain is dense over the cabin and then nearly empty along the boom
// (one bay, no rings), so "the nearest spine vertex" is sometimes a metre and
// a half away. Snapping to it put the beacon on top of the comm aerial; then,
// once that was refused, it put the beacon nowhere. Between two entries the
// spine is a straight run of skin and a point on it is perfectly well defined.
function crownSite(mesh, sL, sign, key, want) {
  const A = mesh.A, V = mesh.V;
  const k = key == null ? 0 : key;
  const target = want == null ? sL : want;
  const list = spineOf(mesh, sign);
  if (!list.length) return null;

  // BRACKET IT, IN WHICHEVER DIRECTION THE KEY RUNS. The list is sorted by sL
  // ascending, and st is monotone along it — but DESCENDING: the stations are
  // numbered from the nose, so st falls from 11 at the firewall to 0 at the
  // tailpost while sL rises. A walk that assumed ascending fell straight
  // through to list[0] and put every centreline fitting on the nose cap.
  const end = list.length - 1;
  const up = A[list[end]][k] >= A[list[0]][k];
  const cmp = (i, t) => up ? A[list[i]][k] <= t : A[list[i]][k] >= t;
  let lo = 0, hi = end;
  if (!cmp(0, target)) { lo = hi = 0; }
  else if (cmp(end, target)) { lo = hi = end; }
  else {
    for (let i = 0; i < end; i++)
      if (cmp(i, target) && !cmp(i + 1, target)) { lo = i; hi = i + 1; break; }
  }
  const ia = list[lo], ib = list[hi];
  const da = A[ia][k], db = A[ib][k];
  const t = (hi === lo || Math.abs(db - da) < 1e-9) ? 0
          : Math.max(0, Math.min(1, (target - da) / (db - da)));
  // OFF THE END IS A REFUSAL, not an extrapolation: a fitting past the tailpost
  // has nothing to bolt to, and inventing a station for it is how a fitting
  // ends up floating behind the aeroplane.
  if (k === 0) {
    const first = A[list[0]][0], last = A[list[end]][0];
    if (target < first - CROWN_MAX_OFF || target > last + CROWN_MAX_OFF)
      return null;
  }
  const lerp = (u, v2) => u + (v2 - u) * t;
  const near = t < 0.5 ? ia : ib;
  const a = A[ia], b = A[ib];
  const hit = {
    p: [lerp(V[ia][0], V[ib][0]), lerp(V[ia][1], V[ib][1]),
        lerp(V[ia][2], V[ib][2])],
    sL: lerp(a[0], b[0]), sC: lerp(a[1], b[1]),
    st: lerp(a[2], b[2]), lv: lerp(a[3], b[3]),
    n: [0, sign, 0], mat: 'body',
  };
  // the normal and the material from a face the nearer vertex is a corner of.
  // THE CROWN VERTEX IS OFTEN A SEAM — the cabin's centre column is shared
  // between the skylight and the pillar either side of it — so the faces round
  // it do not agree about what this place is made of. Prefer one that is real
  // skin: an aerial on the pillar beside the glazing is right, and an aerial
  // refused because the first face happened to be the window is not.
  let fallback = null;
  for (const f of mesh.F) {
    const ids = f && f.v;
    if (!ids || ids.length < 3 || ids.indexOf(near) < 0) continue;
    let bare = false;
    for (const j of ids) if (!A[j]) { bare = true; break; }
    if (bare) continue;
    const nn = triNormal(V[ids[0]], V[ids[1]], V[ids[2]]);
    const rec = { n: nn[1] * sign >= 0 ? nn : [-nn[0], -nn[1], -nn[2]], m: f.m };
    if (!NOT_SKIN.has(f.m)) { hit.n = rec.n; hit.mat = rec.m; return hit; }
    if (!fallback) fallback = rec;
  }
  if (fallback) { hit.n = fallback.n; hit.mat = fallback.m; }
  return hit;
}

// THE BAND HAS TO WIDEN, and the reason is the boom. Subdivision follows the
// RINGS, and GEN_BUILD_GRAMMAR's own note says the aft body is "a single ~4 m
// bay with no ring in it at all" — so between the cabin and the tailpost the
// vertices are hundreds of millimetres apart in sL. A fixed 180 mm window
// finds nothing out there and every aft fitting silently vanishes, which is
// how the tail tie-down went missing on the first run.
//
// So it widens until it has enough of a section to measure, and gives up
// rather than reporting an arc it inferred from three vertices.
function sectionArc(mesh, sL, band) {
  const A = mesh.A;
  let b = band || 0.18;
  for (let pass = 0; pass < 6; pass++, b *= 2) {
    let lo = 0, hi = 0, seen = 0;
    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      if (!a) continue;
      if (a[0] < sL - b || a[0] > sL + b) continue;
      if (a[1] < lo) lo = a[1];
      if (a[1] > hi) hi = a[1];
      seen++;
    }
    // eight vertices is two levels either side of the waist on both flanks —
    // the least that can describe a section rather than a corner of one
    if (seen >= 8 && hi > 1e-4 && lo < -1e-4) return { lo, hi, band: b };
  }
  return null;
}

// ---------------------------------------------------------------------------
// THE SNAP — a rounding, because the field already did the work
// ---------------------------------------------------------------------------
//   'free'     where the rule asked
//   'ring'     the nearest structural ring       st -> round(st)
//   'bay'      the middle of the bay it fell in  st -> floor(st) + 0.5
//   'rail'     the nearest structural rail       lv -> round(lv)
//   'bayrail'  both
//
// 'bay' is the one the design names and the one most fittings want: an access
// panel goes BETWEEN frames, not on one, because a frame is exactly what it is
// there to reach past. A panel centred on a former is the tell that a hatch
// was placed by eye.
function snapTo(mode, st, lv) {
  switch (mode) {
    case 'ring':    return [Math.round(st), lv];
    case 'bay':     return [Math.floor(st) + 0.5, lv];
    case 'rail':    return [st, Math.round(lv)];
    case 'bayrail': return [Math.floor(st) + 0.5, Math.round(lv)];
    default:        return [st, lv];
  }
}

// ---------------------------------------------------------------------------
// accessSites(mesh, rule) -> [site, ...]
// ---------------------------------------------------------------------------
//   rule = { sL, sC,                          the target, in metres
//            snap: 'free'|'ring'|'bay'|'rail'|'bayrail',
//            side: 'both'|'port'|'star',
//            allow: [material names] }        optional widening of NOT_SKIN
//
// RETURNS AN EMPTY LIST RATHER THAN A GUESS. G65.1's ruling, in its own words:
// "an instrument in the wrong place is worse than no instrument". A rule whose
// station is off the end of a short fuselage, or which lands on the
// windscreen, yields nothing and the fitting is simply not fitted — which is
// also how a failing `need()` reads downstream, so the two are one behaviour.
function accessSites(mesh, rule) {
  if (!mesh || !mesh.A || !mesh.V || !mesh.F) return [];
  const r = rule || {};
  const sL = r.sL || 0;
  // A RULE GIVES `lv` OR `sC`, and `lv` is what almost all of them want.
  //
  // TWO EARLIER FORMULATIONS FAILED HERE, both silently, and the failure is
  // worth keeping because it is the same shape twice. First `sC` in METRES: a
  // fuselage shrinks, so "0.67 m below the waist" is on the belly at the cabin
  // and off the aeroplane entirely at the tailpost — the tail tie-down simply
  // never appeared. Then `sCf` as a FRACTION of the measured section arc:
  // better, but the arc has to be sampled over a fore-aft window (the boom is
  // one 4 m bay with no ring in it), and the window's MAXIMUM overshoots the
  // section at its aft end, so the crown fittings fell off too.
  //
  // `lv` needs no measurement at all. It IS the around-the-section structural
  // coordinate, exact at every station: 0 keel, 2 waist, 5 roof. "On the
  // crown" is lv 5 and nothing else, wherever you ask.
  //   lv: 'crown' | 'keel'  the centreline, top or bottom (see above)
  //   lv: <number>          a structural rail, 0 keel .. 5 roof
  //   sC: <metres>          up from the waist, for a rule that means a
  //                         distance (a static port 60 mm below the rail,
  //                         because that is where the flat is)
  let hits;
  if (r.lv === 'crown' || r.lv === 'keel') {
    const h = crownSite(mesh, sL, r.lv === 'crown' ? 1 : -1);
    if (!h) return [];
    hits = [h];
  } else if (r.lv != null) {
    hits = fieldHits(mesh, AX_RAIL, sL, r.lv);
  } else {
    hits = fieldHits(mesh, AX_METRIC, sL, r.sC || 0);
  }
  if (!hits.length) return [];

  // Snap in structural space, then look the snapped station back up. The
  // second lookup is on (st, lv) — the same function, a different pair — so
  // the snapped point is a REAL point on the skin rather than the first one
  // nudged, which would drift off a curved section.
  const mode = r.snap || 'free';
  const onSpine = (r.lv === 'crown' || r.lv === 'keel');
  const onWing = (r.side === 'upper' || r.side === 'lower');
  if (mode !== 'free') {
    const [ts, tl] = snapTo(mode, hits[0].st, hits[0].lv);
    if (onSpine) {
      // A CENTRELINE FITTING SNAPS ALONG THE BODY ONLY. Re-looking-up in
      // (st, lv) space would find the ROOF LONGERON at that station and throw
      // the spine away — which is what put the fuel cap, the comm aerial and
      // the beacon 110 mm off the centreline while each had asked to be on it.
      // The profile is indexed by station, so this is a LOOKUP and not a
      // solve; the secant solve it replaced diverged on the boom, where the
      // stations are metres apart and its gradient meant nothing.
      const snapped = crownSite(mesh, sL, r.lv === 'crown' ? 1 : -1, 2, ts);
      if (!snapped) return [];
      hits = [snapped];
    } else {
      const snapped = fieldHits(mesh, AX_STRUCT, ts, tl);
      // a snap that leaves the body is not a fitting slightly out of place, it
      // is a fitting with nothing to bolt to
      if (!snapped.length) return [];
      hits = snapped;
    }
  }

  const blocked = new Set(NOT_SKIN);
  for (const m of (r.allow || [])) blocked.delete(m);

  const seen = [], out = [];
  for (const h of hits) {
    if (blocked.has(h.mat)) continue;
    // dedup by position: a target on a rail is claimed by the quads on both
    // sides of it, so the same point arrives twice (four times at sC = 0)
    let dup = false;
    for (const q of seen)
      if (Math.abs(q[0] - h.p[0]) < 1e-4 && Math.abs(q[1] - h.p[1]) < 1e-4 &&
          Math.abs(q[2] - h.p[2]) < 1e-4) { dup = true; break; }
    if (dup) continue;
    seen.push(h.p);
    // A WING IS NOT A TUBE. `faceOut` orients away from the SECTION CENTRE,
    // which is exactly right for a closed fuselage and meaningless out on a
    // wing panel — there the test is dominated by the spanwise coordinate and
    // returns whatever it likes. Measured: it handed back a site on the wing's
    // UPPER surface carrying a DOWNWARD normal, and the aileron cover was
    // drawn into the skin, invisible from every angle. Wings orient by their
    // own geometry, below.
    if (!onWing) h.n = faceOut(h.n, h.p, sectionCY(mesh, h.p[2]));
    h.side = h.p[0] > 1e-4 ? 'star' : (h.p[0] < -1e-4 ? 'port' : 'centre');
    out.push(h);
  }

  const want = r.side || 'both';
  if (want === 'port' || want === 'star')
    return out.filter(h => h.side === want || h.side === 'centre');
  // 'centre' — a fitting ON the spine or the keel: the filler cap on the cowl
  // deck, the aerial on the turtledeck, the sump drain under the belly. The
  // crown and keel chains are SHARED between the two halves (P() welds with x
  // snapped to 0), so the site is genuinely single there — but a rule that
  // asks for the centreline and lands slightly off it must not silently
  // become two fittings 40 cm apart. Take the one nearest the spine, and only
  // that one.
  // 'upper' / 'lower' — A WING SURFACE, not a flank. See THE WING IS THE SAME
  // FOUR NUMBERS above: chordwise distance from the LE is identical on both
  // skins, so a target names FOUR points on a pair of wings — upper and lower,
  // port and starboard.
  //
  // CHOOSE BY HEIGHT, NOT BY THE NORMAL. The winding of an imported loft is
  // not something to trust, and the first cut trusted it: it filtered on the
  // sign of n.y and picked a point on the UPPER surface for a 'lower' rule,
  // because `faceOut` had already turned that normal the wrong way round. The
  // two skins at one station differ by the aerofoil's thickness — 94 mm on the
  // stock wing — so which is which is not in question. Then the normal is SET
  // from the answer rather than consulted for it.
  if (want === 'upper' || want === 'lower') {
    const s2 = want === 'upper' ? 1 : -1;
    const keep = [];
    for (const sgn of [1, -1]) {
      let best = null;
      for (const h of out) {
        if (h.p[0] * sgn <= 0) continue;
        if (!best || s2 * h.p[1] > s2 * best.p[1]) best = h;
      }
      if (!best) continue;
      if (best.n[1] * s2 < 0) best.n = [-best.n[0], -best.n[1], -best.n[2]];
      keep.push(best);
    }
    return keep;
  }
  if (want === 'centre') {
    let best = null;
    for (const h of out)
      if (!best || Math.abs(h.p[0]) < Math.abs(best.p[0])) best = h;
    return best ? [best] : [];
  }
  return out;
}

// ---------------------------------------------------------------------------
// THE MOUNTING FRAME AT A SITE
// ---------------------------------------------------------------------------
// +z is the nose, so AFT is -z. `fore` is that direction laid flat on the
// surface; `side` completes a right-handed set with the outward normal. A
// form is authored once in (side, fore, normal) and lands correctly on a flat
// flank, a curved turtledeck or a tapering boom without knowing which it is.
//
// IT LIVES HERE AND NOT IN THE LAYER because the gate has to build the same
// frame the aeroplane does. A second copy in the verdict would drift from the
// first inside a week, and the drift would be invisible — both would look
// like fittings.
function frameAt(p, n) {
  const aft = [0, 0, -1];
  const d = n[0] * aft[0] + n[1] * aft[1] + n[2] * aft[2];
  let fore = [aft[0] - n[0] * d, aft[1] - n[1] * d, aft[2] - n[2] * d];
  // ON THE NOSE CAP the outward normal IS the fore-aft axis, so that
  // projection collapses. Fall back to "up, flattened onto the surface",
  // which is well defined everywhere the first one is not.
  if (Math.hypot(fore[0], fore[1], fore[2]) < 1e-6) {
    const up = [0, 1, 0];
    const d2 = n[0] * up[0] + n[1] * up[1] + n[2] * up[2];
    fore = [up[0] - n[0] * d2, up[1] - n[1] * d2, up[2] - n[2] * d2];
  }
  const fl = Math.hypot(fore[0], fore[1], fore[2]) || 1;
  fore = [fore[0] / fl, fore[1] / fl, fore[2] / fl];
  const side = [n[1] * fore[2] - n[2] * fore[1],
                n[2] * fore[0] - n[0] * fore[2],
                n[0] * fore[1] - n[1] * fore[0]];
  const sl = Math.hypot(side[0], side[1], side[2]) || 1;
  return { p, n, fore, side: [side[0] / sl, side[1] / sl, side[2] / sl] };
}

// ---------------------------------------------------------------------------
// THE WING IS THE SAME FOUR NUMBERS MEANING SOMETHING ELSE (G84)
// ---------------------------------------------------------------------------
// G68.1 gave the wing its own surface field, and deliberately kept the shape:
//
//   sL  spanwise metres from the ROOT      (the fuselage's: aft of the firewall)
//   sC  chordwise metres from the LE       (the fuselage's: up from the waist)
//   st  INTEGER AT EVERY RIB               (the fuselage's: at every ring)
//   lv  0 at the front spar, 1 at the rear (the fuselage's: keel 0 .. roof 5)
//
// So every function above works on a wing already and none of them had to
// learn what a wing is. What differs is only what a rule MEANS by them, and
// one real thing: **the wing's sC does not distinguish upper from lower.** It
// is chordwise distance from the leading edge, so a point 160 mm back is on
// BOTH skins — the same doubling the fuselage has across its flanks, in a
// different axis. The fuselage picks a flank by the sign of x; the wing picks
// a surface by which way the normal points, which is `side: 'upper' | 'lower'`
// below.
//
// A filler cap goes on TOP (you pour downward) and a bellcrank cover
// underneath (that is where the bellcrank is), so getting this wrong is not a
// detail — it is the cap on the underside of the wing.

// A THREE BufferGeometry, adapted into the { V, F, A } shape fieldHits reads.
// The wing layer emits indexed geometry per class with an `aStruct` attribute
// (_cage_wing.js:293); the cage emits plain arrays. One adapter rather than a
// second lookup, because a second lookup would drift from the first.
function geoMesh(list, matOf) {
  const V = [], A = [], F = [];
  for (const rec of (Array.isArray(list) ? list : [list])) {
    const geo = rec && (rec.geo || rec.geometry || rec);
    if (!geo || !geo.attributes || !geo.attributes.position) continue;
    const pos = geo.attributes.position, fld = geo.attributes.aStruct;
    if (!fld) continue;                       // no field, nothing to place on
    const idx = geo.index;
    const base = V.length;
    // `xf` bakes a mesh's own placement into the vertices as they are read, so
    // a caller that traverses a scene graph does not have to flatten it first.
    // Kept as a plain function rather than a Matrix4 because this file runs in
    // node, where there is no THREE.
    const xf = rec && rec.xf;
    for (let i = 0; i < pos.count; i++) {
      const q = [pos.getX(i), pos.getY(i), pos.getZ(i)];
      V.push(xf ? xf(q) : q);
      A.push([fld.getX(i), fld.getY(i), fld.getZ(i), fld.getW(i)]);
    }
    const m = (matOf && matOf(rec)) || (rec && rec.name) || 'wing';
    const n = idx ? idx.count : pos.count;
    for (let k = 0; k + 2 < n; k += 3)
      F.push({ v: idx ? [base + idx.getX(k), base + idx.getX(k + 1),
                         base + idx.getX(k + 2)]
                      : [base + k, base + k + 1, base + k + 2], m });
  }
  return V.length ? { V, A, F } : null;
}

// (z, ang) for the airframe contract — fitFrame/fitPad speak the gear bench's
// cylindrical coordinates, where ang is measured FROM THE KEEL (0 = straight
// down, +/- pi/2 = the flanks; _gear_gen.js:515 casts its ray along
// [sin(ang), -cos(ang)] from the section centre). The site is already a point
// in the same frame, so this is the conversion and nothing more.
//
// It is deliberately a SECOND derivation of the same place: the field found
// the point by interpolation, the contract finds it by ray cast, and GATE
// ACCESS asserts the two agree to a millimetre. Two independent routes to one
// answer is the only cheap way to catch a frame convention that has silently
// drifted.
function siteToAF(AF, site) {
  const z = site.p[2];
  const cy = AF && AF.cyAt ? AF.cyAt(z) : 0;
  return { z, ang: Math.atan2(site.p[0], -(site.p[1] - cy)) };
}

const API = { accessSites, fieldHits, siteToAF, snapTo, sectionCY, frameAt,
              sectionArc, AX_RAIL, crownSite, geoMesh,
              NOT_SKIN, AX_METRIC, AX_STRUCT };

if (typeof module !== 'undefined' && module.exports) module.exports = API;
if (typeof window !== 'undefined') window.FIT_SITE = API;

})();
