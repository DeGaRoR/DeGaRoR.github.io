'use strict';
// POD_GEN - THE DRAWN BELLY POD (BELLY-POD-2, G3468, 2026-10-27).
//
// The user (27 Oct): "it's functional, but it's terribly ugly. Do a focused effort on proper, professional and detailed
// modeling. Take example on the floats modeling, which was very clean, and do a beautiful pod, that remains possible to
// procedurally fit. I suggest taking inspiration from Airglas Inc and AFC (for Cessna)." The moulded glassfibre cargo
// pods of the back country - the Airglas Super Cub pod, the Cessna 172 / 180-185 / 206 pods - share one anatomy, and
// that is what is drawn here (_float_gen.js's way: pure geometry, no THREE, { pos, idx } in the pod's own frame, the
// layer turns it into a mesh; runs under node):
//
//   THE SHELL is ONE welded loft, ~90 stations of 38 points, open at the top (the top edge runs up inside the drawn
//   belly). Its SECTION is a moulded rounded rectangle - a flat floor, a generous filleted CHINE (rChine, a quarter
//   circle of 8 segments with a SUPPORT LOOP on the floor and on the wall beside it, so the area-weighted normals of
//   the flats do not smear into the radius: the highlight stays in the fillet, the float's rule), walls that FLARE out
//   a little as they rise into the fuselage (the pods are wider at the belly than at the floor). Its PROFILE is the
//   core's own (src/core/60d_gen_pod.js genPodResolve: the floor, the half-width, the fairing stations the clearance
//   and the hold are measured on) drawn round: the NOSE a superellipse (a full, blunt moulded nose, not a wedge), its
//   plan rounded the same way; the BOAT-TAIL a half cosine, so the floor leaves the flat run tangentially and meets the
//   belly tangentially - the fairing a real pod has, where the line of the 'straight-cut' tail was.
//   THE FLOOR IS THE PHYSICS' FLOOR: the shell's floor sits one skid height above it and the two wear skids' soles ON
//   it - the lowest drawn point is the floor the clearance is measured on (GATE POD).
//   THE DETAILS, from the pods' own build (a moulded pod is screwed to the belly through a flange; it carries a hinged
//   side door and two flush latches; stainless wear strips run under it):
//     the ATTACH FLANGE - a 22 mm band lying on the belly skin along both walls, 2.5 mm proud, its outer edge rounded,
//       screwed every 9 cm (a domed head per screw);
//     the DOOR - the hatch the freight packer passes items through (R.door: its station run and its height), a panel
//       1.6 mm proud of the wall with 30 mm corner radii and a bevelled edge, a PIANO HINGE along its top (a 4.5 mm
//       knuckle with its leaf), two FLUSH LATCHES (rounded plates with a recessed paddle) near its sill;
//     the WEAR SKIDS - two half-round strips under the floor at 55 % of the flat, ramped in at both ends.
//   Group 0 is the shell, the flange and the door panel (the livery's `pod` section: moulded trim in the body's colour);
//   group 1 the hardware (`ctlHinge`: the hinges & horns' steel) - one mesh, two material slots.
//
// FRAME: metres, the pod's own GEN frame - x aft of the firewall, y up (the core's y), z to PORT (the left). The
// layer (tools/_cage_pod.js) maps it to the cage: (z, y + yD, zFw - x) - a rotation, so the winding below (outward)
// stays outward.
//
//   POD_GEN.build(R, topAt, opts) -> { pos, idx, groups: [{ start, count, mat }], shellNv, top: [indices], nv, nt,
//                                      stations, around }
//   R      the resolved pod (genPodResolve: x0 x1 xa xb yBot hw sta[{x, top}] depth door)
//   topAt  (x, half) -> the drawn belly's y at that station and lateral half-width (gen y), or null (the keel line)
//   opts.halfAt  x -> the drawn body's half-width at that station (the walls are held inside it), or null
(function () {

const PI = Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

const POD_GEN = {
  // the moulding
  rChineK: 0.30,        // the chine radius as a share of the smaller of the depth and the half-width
  rChineMax: 0.10,      // m
  flareK: 0.10,         // the wall's outward lean, as a share of the depth (the top edge wider than the floor)
  nosePlan: 0.40,       // the nose's half-width at the very front, as a share of hw
  tailPlan: 0.25,       // the boat-tail's half-width at its end, as a share of hw
  fairK: 0.62,          // the fairings' half-width at most this share of the drawn body's
  flatK: 0.85,          // the walls' top (with the flare) at most this share of it along the run: the flat of the belly
  overlap: 0.02,        // m: the wall's top edge, inside the drawn belly
  // the details (G3470: the user's references - an Airglas Super Cub pod, a black bolted pod, a strapped Airglas pod)
  skidH: 0.006, skidW: 0.028, skidAt: 0.55,                    // m, m, share of the flat floor's half-width
  sealR: 0.0055,                                               // the rubber joint's bead, round the whole junction
  rivetPitch: 0.05, rivetR: 0.0030, rivetH: 0.0017, rivetDown: 0.02,   // the main line: a rivet row under the joint
  doorT: 0.0016, doorR: 0.03, doorTop: 0.045,                  // the door: up to this far under the joint
  hingeR: 0.0042, knuckle: 0.026,                              // the piano hinge along the sill (the door drops down)
  pinR: 0.0022, barrelR: 0.0045,                               // the pin latches ("clippers") at the door's top corners
  screwR: 0.0038,                                              // the traps' screws
  ventR: 0.034,                                                // the aft trap's louvred vent
  strapW: 0.032, strapT: 0.0012,                               // the straps (the strapped mounting)
  // the resolution
  nNose: 30, nTail: 30, dxFlat: 0.035,
};

// ---- the bag: an indexed triangle soup (the float's) ------------------------------------------------------------
// (G3470: three material groups - B.g picks the one the next triangles go to: 0 the moulding, 1 the stainless, 2 the
// black rubber; the triangles are kept per group and laid out group by group at the end)
function Bag() {
  const pos = [], idx = [[], [], []];
  return {
    pos, idx, g: 0,
    v(p) { pos.push(p[0], p[1], p[2]); return pos.length / 3 - 1; },
    t(a, b, c) { if (a !== b && b !== c && a !== c) idx[this.g].push(a, b, c); },
    q(a, b, c, d) { this.t(a, b, c); this.t(a, c, d); },
    get nv() { return pos.length / 3; },
  };
}
// ---- small vectors (the float's) ----
const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vmul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcrs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vnrm = a => { const L = Math.hypot(a[0], a[1], a[2]) || 1e-12; return [a[0] / L, a[1] / L, a[2] / L]; };
// a basis square to `a` (u x v = a)
const basis = a => { const t = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const u = vnrm(vcrs(t, a)); return [u, vcrs(a, u)]; };
// a strip of rings (each an array of indices, same length): the quads between consecutive rings, wound so the face
// normal is (ring direction) x (along-ring direction) - the caller orders the rings so that is outward
function loft(B, rings, closed) {
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i], b = rings[i + 1], n = a.length;
    for (let j = 0; j + 1 < n + (closed ? 1 : 0); j++) {
      const j1 = (j + 1) % n;
      B.q(a[j], b[j], b[j1], a[j1]);
    }
  }
}

// ---- the profile (the core's, drawn round) ----------------------------------------------------------------------
// keelD: x -> the DRAWN belly's centre line (gen y) or null. The fairings hang from it - by the firewall and toward
// the tail the drawn belly and the frame's keel line part by centimetres, and a nose hung from the keel showed that
// gap as a face - while the flat run keeps the physics' floor.
function profile(R, keelD) {
  const G = POD_GEN, S = R.sta, N = S.length - 1;
  const keelF = x => {                                  // the frame's keel line under the pod (the core's stations)
    const f = clamp((x - S[0].x) / (S[N].x - S[0].x) * N, 0, N), i = Math.min(N - 1, Math.floor(f));
    return lerp(S[i].top, S[i + 1].top, f - i);
  };
  const keel = x => { const y = keelD ? keelD(x) : null; return y != null && isFinite(y) ? y : keelF(x); };
  const botAt = x => {                                  // the core's floor (its stations' bottoms) at x
    const f = clamp((x - S[0].x) / (S[N].x - S[0].x) * N, 0, N), i = Math.min(N - 1, Math.floor(f));
    return lerp(S[i].bot, S[i + 1].bot, f - i);
  };
  const fa = R.floorA != null ? R.floorA : botAt(R.xa), fb = R.floorB != null ? R.floorB : botAt(R.xb);
  const floorLine = x => x <= R.xa ? fa : x >= R.xb ? fb : lerp(fa, fb, (x - R.xa) / Math.max(1e-9, R.xb - R.xa));
  // depth below the keel and the half-width at station x
  return {
    keel,
    at(x) {
      // the physics' floor line (the core's: a straight floor over the run - its chord - held level beyond it, which
      // neither fairing goes under); the fairings scale the depth down to the DRAWN belly
      const k = keel(x), D = Math.max(0, k - floorLine(x));
      let d, h;
      if (x < R.xa) {
        const u = clamp((R.xa - x) / Math.max(1e-9, R.xa - R.x0), 0, 1);
        // the RAMP: a quarter cosine - level where it leaves the floor, meeting the belly at a rake (~40 deg on these
        // pods) through a rounded heel; never under the core's ellipse (the clearance is the core's)
        d = D * Math.cos(0.5 * PI * u); h = R.hw * (G.nosePlan + (1 - G.nosePlan) * Math.pow(Math.max(0, 1 - Math.pow(u, 2.2)), 1 / 2.2));
      } else if (x > R.xb) {
        const v = clamp((x - R.xb) / Math.max(1e-9, R.x1 - R.xb), 0, 1);
        // the BOAT-TAIL: a half cosine (tangent off the floor, tangent into the belly), closing in plan with its depth
        // (a teardrop: the half-width as the root of the depth's share) - the walls never climb the body's curve
        const c = 0.5 * (1 + Math.cos(PI * v));
        d = D * c; h = R.hw * Math.max(G.tailPlan, Math.sqrt(c));
      } else { d = D; h = R.hw; }
      return { k, d, h, b: k - d };
    },
  };
}
// the stations: dense in the fairings (cosine spacing, finest at the ends), even along the flat run
function stations(R) {
  const G = POD_GEN, xs = [];
  for (let i = 0; i < G.nNose; i++) xs.push(R.x0 + (R.xa - R.x0) * (1 - Math.cos(0.5 * PI * i / G.nNose)));
  const nf = Math.max(2, Math.ceil((R.xb - R.xa) / G.dxFlat));
  for (let i = 0; i < nf; i++) xs.push(R.xa + (R.xb - R.xa) * i / nf);
  for (let i = 0; i <= G.nTail; i++) xs.push(R.xb + (R.x1 - R.xb) * Math.sin(0.5 * PI * i / G.nTail));
  return xs;
}

// ---- the section: one side's points, from the top edge DOWN to the keel's centre line ------------------------
// (z >= 0: the port half; the starboard half is its mirror). Returns [[z, y], ...] and the index of the wall's lower
// support point (the door is drawn on the wall above it).
function halfSection(P, wallTop, floorY) {
  const G = POD_GEN, d = P.k - floorY, h = P.h;
  const r = Math.max(1e-4, Math.min(G.rChineMax, G.rChineK * Math.min(d, h), 0.45 * d, 0.45 * h));
  const flare = G.flareK * d;
  const zTop = h + flare, yTop = wallTop(zTop);
  const pts = [];
  // the wall: the top edge, a support 12 mm under it, three between, a support 4 mm over the fillet
  const yW0 = floorY + r;
  const wz = y => h + flare * clamp((y - yW0) / Math.max(1e-6, yTop - yW0), 0, 1);
  const ys = [yTop, yTop - Math.min(0.012, 0.2 * (yTop - yW0))];
  for (let k = 1; k <= 3; k++) ys.push(lerp(ys[1], yW0 + Math.min(0.004, 0.2 * (yTop - yW0)), k / 4));
  ys.push(yW0 + Math.min(0.004, 0.2 * (yTop - yW0)));
  for (const y of ys) pts.push([wz(y), y]);
  // the chine: a quarter circle about (h - r, floor + r), 8 segments
  for (let k = 0; k <= 8; k++) { const a = -0.5 * PI * k / 8; pts.push([h - r + r * Math.cos(a), floorY + r + r * Math.sin(a)]); }
  // the floor: a support 4 mm in from the fillet, then out to the centre line
  const zF = h - r;
  pts.push([Math.max(0, zF - Math.min(0.004, 0.25 * zF)), floorY]);
  for (let k = 1; k <= 4; k++) pts.push([zF * (1 - k / 4) * (1 - Math.min(0.004, 0.25 * zF) / Math.max(1e-6, zF)), floorY]);
  return { pts, r, zTop, yTop };
}

function build(R, topAt, opts) {
  const G = Object.assign({}, POD_GEN, opts || {}), halfAt = opts && typeof opts.halfAt === 'function' ? opts.halfAt : null;
  const PR = profile(R, topAt ? (x => topAt(x, 0)) : null), B = Bag();
  const xs = stations(R);
  const skinTop = (x, half, k) => { const y = topAt ? topAt(x, half) : null; return Math.max(k, y != null ? y : k) + G.overlap; };
  // ---- THE SHELL (group 0) ----
  const rings = [], secs = [];
  for (const x of xs) {
    const P = PR.at(x);
    // THE DRAWN BODY BOUNDS IT: where the drawn fuselage is narrower than the frame's keel (by the firewall, the cowl's
    // waist) the wall and its flare are held 12 mm inside the body's own half-width - never a lip outside the skin
    const hb = halfAt ? halfAt(x) : null;
    if (hb != null && isFinite(hb)) {
      // ...and the FAIRINGS keep to the flat of the belly (fairK of its half-width, eased in from the run's flatK so
      // the walls carry no crease where they start): where the body rounds up a pod as wide as its run would climb
      // the curve and flare out like a fishtail
      const f = x < R.xa ? sstep((R.xa - x) / Math.max(1e-9, R.xa - R.x0) * 2.5)
              : x > R.xb ? sstep((x - R.xb) / Math.max(1e-9, R.x1 - R.xb) * 2.5) : 0;
      P.h = Math.max(0.02, Math.min(P.h, lerp(G.flatK, G.fairK, f) * hb - (1 - f) * G.flareK * P.d));
    }
    const floorY = P.b + G.skidH;
    const dd = Math.max(1e-4, P.k - floorY);
    const Pq = { k: P.k, h: Math.max(P.h, 0.002) };
    const hs = halfSection(Object.assign({}, Pq, { k: floorY + dd }), z => skinTop(x, z, P.k), floorY);
    secs.push({ x, P, hs, floorY });
    // the full ring, port top -> keel -> starboard top (z: port +)
    const ring = [];
    for (const [z, y] of hs.pts) ring.push(B.v([x, y, z]));
    for (let k = hs.pts.length - 2; k >= 0; k--) { const [z, y] = hs.pts[k]; ring.push(B.v([x, y, -z])); }
    rings.push(ring);
  }
  // outward: along the ring the points run port-top -> down -> starboard-top; consecutive rings run aft (+x). For the
  // floor (along-ring direction -z, ring direction +x): (+x) x (-z) = +y ... inward; so the quads are wound the other way
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i], b = rings[i + 1];
    for (let j = 0; j + 1 < a.length; j++) B.q(a[j], a[j + 1], b[j + 1], b[j]);
  }
  const around = rings[0].length;
  const top = [];
  for (const r of rings) { top.push(r[0], r[r.length - 1]); }
  const shellNv = B.nv;
  // ---- THE SHELL CLOSED (the user, 27 Oct: "the opening at the front looks quite bad ... close it"): the loft is an
  // open U - its end sections reach up into the belly with no depth under them, its top edge is open the whole run -
  // so it is closed into a solid: a CAP on each end section (a fan over the U closed across its top) and a LID along the
  // top edges, 2 cm inside the drawn belly where nothing sees it, and where the belly does not cover (a gap at a curve)
  // a closed surface, never the hollow. Each its own vertices: hard edges, the walls' shading untouched.
  {
    const P = i => B.pos.slice(3 * i, 3 * i + 3);
    const cap = (ring, out) => {                       // out: -1 the nose (faces forward, -x), +1 the tail (aft, +x)
      const pts = ring.map(P), n = pts.length;
      const c = pts.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n], [0, 0, 0]);
      const ci = B.v(c), vi = pts.map(p => B.v(p));
      // the U runs port-top -> keel -> starboard-top, then the top closes it back (k = n - 1 -> 0)
      for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; out < 0 ? B.t(ci, vi[k], vi[k1]) : B.t(ci, vi[k1], vi[k]); }
    };
    cap(rings[0], -1); cap(rings[rings.length - 1], 1);
    // the lid: the top edges' strip, port top to starboard top, station to station (faces up, into the body)
    let pA = B.v(P(rings[0][0])), sA = B.v(P(rings[0][around - 1]));
    for (let i = 1; i < rings.length; i++) {
      const pB = B.v(P(rings[i][0])), sB = B.v(P(rings[i][around - 1]));
      B.q(pA, pB, sB, sA);
      pA = pB; sA = sB;
    }
  }
  // ======== THE DETAILS (G3470) - the user's references: the Airglas Super Cub pod (its rubber joint, its door hinged
  // at the sill, its pin latches, its aft panel with a louvred vent, its straps), a black bolted pod (its front trap) ====
  // ---- the surfaces' frames: a point on the wall (x, y) or on the bottom (x, z), its outward normal, its axes ----
  const wallAt = (x, y) => {                       // the wall's lateral position at (x, y), from the nearest stations
    let i = 0; while (i + 1 < secs.length && secs[i + 1].x < x) i++;
    const s0 = secs[i], s1 = secs[Math.min(secs.length - 1, i + 1)];
    const f = s1.x > s0.x ? clamp((x - s0.x) / (s1.x - s0.x), 0, 1) : 0;
    const wz = s => { const yW0 = s.floorY + s.hs.r; return s.P.h + G.flareK * (s.P.k - s.floorY) * clamp((y - yW0) / Math.max(1e-6, s.hs.yTop - yW0), 0, 1); };
    return lerp(wz(s0), wz(s1), f);
  };
  const secAt = x => { let i = 0; while (i + 1 < secs.length && secs[i + 1].x < x) i++;
    const s0 = secs[i], s1 = secs[Math.min(secs.length - 1, i + 1)], f = s1.x > s0.x ? clamp((x - s0.x) / (s1.x - s0.x), 0, 1) : 0;
    return { floorY: lerp(s0.floorY, s1.floorY, f), r: lerp(s0.hs.r, s1.hs.r, f), h: lerp(s0.P.h, s1.P.h, f),
             zTop: lerp(s0.hs.zTop, s1.hs.zTop, f), joint: lerp(s0.hs.yTop, s1.hs.yTop, f) - G.overlap }; };
  const E = 0.004;
  const wallP = (x, y, side, t) => [x, y, side * (wallAt(x, y) + (t || 0))];
  const wallF = (x, y, side) => {                  // p, n (out), ex (along +x, sheared to the wall), ey (up the wall)
    const p = wallP(x, y, side), tx = vnrm(vsub(wallP(x + E, y, side), wallP(x - E, y, side))), ty = vnrm(vsub(wallP(x, y + E, side), wallP(x, y - E, side)));
    return { p, n: vnrm(side > 0 ? vcrs(tx, ty) : vcrs(ty, tx)), ex: tx, ey: ty };
  };
  const botP = (x, z, t) => { const fy = secAt(x).floorY; return [x, fy - (t || 0), z]; };
  const botF = (x, z) => {                         // the bottom (the floor and the fairings' ramps): n out (down)
    const p = botP(x, z), tx = vnrm(vsub(botP(x + E, z), botP(x - E, z))), tz = [0, 0, 1];
    return { p, n: vnrm(vcrs(tx, tz)), ex: tx, ez: tz };
  };
  // ---- the primitives (outward by construction: each builds its own basis u x v = its axis) ----
  const dome = (c, n, r, h, seg) => {              // a rivet / screw head: a low dome on a surface
    const [u, v] = basis(n), S = seg || 8, rings = [];
    for (const [rk, hk] of [[1, -0.0003], [0.82, 0.55 * h], [0.45, 0.92 * h]]) {
      const ring = [];
      for (let k = 0; k < S; k++) { const a = 2 * PI * k / S; ring.push(B.v(vadd(c, vadd(vmul(n, hk), vadd(vmul(u, rk * r * Math.cos(a)), vmul(v, rk * r * Math.sin(a))))))); }
      rings.push(ring);
    }
    for (let i = 0; i + 1 < rings.length; i++) { const a = rings[i], b = rings[i + 1];
      for (let k = 0; k < S; k++) { const k1 = (k + 1) % S; B.q(a[k], a[k1], b[k1], b[k]); } }
    const top = B.v(vadd(c, vmul(n, h))), last = rings[rings.length - 1];
    for (let k = 0; k < S; k++) B.t(top, last[k], last[(k + 1) % S]);
  };
  const cyl = (p0, p1, r, seg, caps) => {          // a cylinder between two points (capped)
    const a = vnrm(vsub(p1, p0)), [u, v] = basis(a), S = seg || 10, A = [], Bq = [];
    for (let k = 0; k < S; k++) { const t = 2 * PI * k / S, o = vadd(vmul(u, r * Math.cos(t)), vmul(v, r * Math.sin(t))); A.push(B.v(vadd(p0, o))); Bq.push(B.v(vadd(p1, o))); }
    for (let k = 0; k < S; k++) { const k1 = (k + 1) % S; B.q(A[k], A[k1], Bq[k1], Bq[k]); }
    if (caps !== false) { const c0 = B.v(p0), c1 = B.v(p1);
      for (let k = 0; k < S; k++) { const k1 = (k + 1) % S; B.t(c0, A[k1], A[k]); B.t(c1, Bq[k], Bq[k1]); } }
  };
  const tubePath = (pts, r, seg) => {              // a wire swept along a polyline (parallel-transported frames)
    const S = seg || 6, rings = [];
    let t0 = vnrm(vsub(pts[1], pts[0])), [u] = basis(t0);
    for (let i = 0; i < pts.length; i++) {
      const t = vnrm(vsub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]));
      u = vnrm(vsub(u, vmul(t, vdot(u, t)))); const v = vcrs(t, u);
      const ring = [];
      for (let k = 0; k < S; k++) { const a = 2 * PI * k / S; ring.push(B.v(vadd(pts[i], vadd(vmul(u, r * Math.cos(a)), vmul(v, r * Math.sin(a)))))); }
      rings.push(ring);
    }
    for (let i = 0; i + 1 < rings.length; i++) { const a = rings[i], b = rings[i + 1];
      for (let k = 0; k < S; k++) { const k1 = (k + 1) % S; B.q(a[k], a[k1], b[k1], b[k]); } }
    return rings;
  };
  // a rounded plate on a surface: centre c, axes ex (along), ey (up), n (out) with ex x ey = n; w x h, proud t
  const plate = (c, ex, ey, n, w, h, t, rc) => {
    const ol = [];
    const C = [[0.5 * w - rc, 0.5 * h - rc, 0], [-0.5 * w + rc, 0.5 * h - rc, 0.5 * PI], [-0.5 * w + rc, -0.5 * h + rc, PI], [0.5 * w - rc, -0.5 * h + rc, 1.5 * PI]];
    for (const [cx, cy, a0] of C) for (let k = 0; k <= 4; k++) { const a = a0 + 0.5 * PI * k / 4; ol.push([cx + rc * Math.cos(a), cy + rc * Math.sin(a)]); }
    const P = (u, v, s) => vadd(c, vadd(vmul(ex, u), vadd(vmul(ey, v), vmul(n, s))));
    const lo = ol.map(([u, v]) => B.v(P(u, v, -0.0005))), hi = ol.map(([u, v]) => B.v(P(u * 0.96, v * 0.94, t)));
    const cc = B.v(P(0, 0, t)), m = ol.length;
    for (let k = 0; k < m; k++) { const k1 = (k + 1) % m; B.t(cc, hi[k], hi[k1]); B.q(lo[k], lo[k1], hi[k1], hi[k]); }
    return P;
  };
  // a panel let into a surface: a rounded outline in its own (a, b) coordinates, mapped onto the surface by at(a, b, t)
  // (t along the outward normal), its edge a V-groove shut line (each face its own vertices: hard edges); ccw: the
  // outline counter-clockwise in (a, b) faces out (the caller orders a, b so that a x b is the outward normal)
  const panel = (a0, a1, b0, b1, rc, at, proud) => {
    const ol = [], C = [[a1 - rc, b1 - rc, 0], [a0 + rc, b1 - rc, 0.5 * PI], [a0 + rc, b0 + rc, PI], [a1 - rc, b0 + rc, 1.5 * PI]];
    for (const [ca, cb, q0] of C) for (let k = 0; k <= 8; k++) { const q = q0 + 0.5 * PI * k / 8; ol.push([ca + rc * Math.cos(q), cb + rc * Math.sin(q)]); }
    const ac = 0.5 * (a0 + a1), bc = 0.5 * (b0 + b1);
    const inset = (a, b, d) => { const ea = a - ac, eb = b - bc, L = Math.hypot(ea, eb) || 1; return [a - d * ea / L, b - d * eb / L]; };
    const pE = ol.map(([a, b]) => at(a, b, -0.0005));
    const pG = ol.map(([a, b]) => { const [u, v] = inset(a, b, 0.003); return at(u, v, -0.003); });
    const pF = ol.map(([a, b]) => { const [u, v] = inset(a, b, 0.006); return at(u, v, proud); });
    const ring = P => P.map(p => B.v(p));
    const e1 = ring(pE), g1 = ring(pG), g2 = ring(pG), f2 = ring(pF), fF = ring(pF), cI = B.v(at(ac, bc, proud)), n = ol.length;
    for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; B.t(cI, fF[k], fF[k1]); B.q(e1[k], e1[k1], g1[k1], g1[k]); B.q(g2[k], g2[k1], f2[k1], f2[k]); }
  };
  const latchXs = [];
  // ---- THE DOOR (group 0 its panel; 1 its hinge, latches, lock) - nearly the wall's full height, hinged at the sill
  // (it drops down, the Airglas way), two pin latches at its top corners, a keyed lock between them ----
  const D = R.door, ds = D && D.side != null ? (D.sideName === 'right' ? -1 : 1) : 1;   // left = port (+z)
  if (D && D.w > 0.12 && D.h > 0.06) {
    // (the door follows the floor: laid out level about its middle and sheared by the floor's slope)
    const sl = D.slope || 0, xm0 = 0.5 * (D.x0 + D.x1), sM = secAt(xm0);
    const y0 = sM.floorY + sM.r + 0.012, y1 = sM.joint - G.doorTop;
    if (y1 - y0 > 0.06) {
      const x0 = D.x0, x1 = D.x1, rc = Math.min(G.doorR, 0.3 * (y1 - y0), 0.3 * (x1 - x0));
      const sh = (x, y) => y + sl * (x - xm0);
      // (a, b) = (x, y) on port, (-x, y) on starboard: a x b out on both
      const at = (a, b, t) => { const x = ds > 0 ? a : -a; return wallP(x, sh(x, b), ds, t); };
      B.g = 0;
      panel(ds > 0 ? x0 : -x1, ds > 0 ? x1 : -x0, y0, y1, rc, at, G.doorT);
      // the door's own frame: ex along its SHEARED sill (the floor's slope), ey up the wall, n out
      const fr = (x, y) => {
        const p = wallP(x, sh(x, y), ds), tx = vnrm(vsub(wallP(x + E, sh(x + E, y), ds), wallP(x - E, sh(x - E, y), ds)));
        const ty = vnrm(vsub(wallP(x, sh(x, y) + E, ds), wallP(x, sh(x, y) - E, ds)));
        return { p, n: vnrm(ds > 0 ? vcrs(tx, ty) : vcrs(ty, tx)), ex: tx, ey: ty };
      };
      // the HINGE along the sill: a row of knuckles straddling the shut line, its two leaves riveted either side
      B.g = 1;
      const nK = Math.max(4, Math.floor((x1 - x0 - 0.03) / (G.knuckle + 0.002)));
      const kx0 = x0 + 0.015, kL = (x1 - x0 - 0.03) / nK;
      for (let i = 0; i < nK; i++) {
        const xa_ = kx0 + i * kL + 0.001, xb_ = kx0 + (i + 1) * kL - 0.001, F = fr(0.5 * (xa_ + xb_), y0);
        const off = vmul(F.n, G.doorT + G.hingeR * 0.8);
        cyl(vadd(wallP(xa_, sh(xa_, y0), ds), off), vadd(wallP(xb_, sh(xb_, y0), ds), off), G.hingeR, 10);
      }
      for (const [dy, hgt] of [[0.009, 0.012], [-0.009, 0.012]]) {
        const xm = 0.5 * (x0 + x1), F = fr(xm, y0 + dy), exs = ds > 0 ? F.ex : vmul(F.ex, -1), eys = vcrs(F.n, exs);
        plate(vadd(F.p, vmul(F.n, dy > 0 ? G.doorT : 0)), exs, eys, F.n, x1 - x0 - 0.03, hgt, 0.0007, 0.002);
        for (let x = x0 + 0.04; x < x1 - 0.03; x += 0.07) { const Fr = fr(x, y0 + dy); dome(vadd(Fr.p, vmul(Fr.n, (dy > 0 ? G.doorT : 0) + 0.0007)), Fr.n, 0.0021, 0.0011, 6); }
      }
      // the PIN LATCHES ("clippers"): a barrel on the door and one on the pod over the shut line, a pin down through
      // both with its L-handle, a hairpin clip through the pin's foot; each barrel on a riveted plate
      for (const fx of [0.16, 0.84]) {
        const x = lerp(x0, x1, fx); latchXs.push(x);
        const Fd = fr(x, y1 - 0.018), Ff = fr(x, y1 + 0.020);
        const exs = ds > 0 ? Fd.ex : vmul(Fd.ex, -1);
        plate(vadd(Fd.p, vmul(Fd.n, G.doorT)), exs, vcrs(Fd.n, exs), Fd.n, 0.030, 0.026, 0.0012, 0.003);
        plate(Ff.p, exs, vcrs(Ff.n, exs), Ff.n, 0.030, 0.022, 0.0012, 0.003);
        for (const [F, base] of [[Fd, G.doorT], [Ff, 0]]) for (const sx of [-0.010, 0.010]) {
          const q = vadd(vadd(F.p, vmul(exs, sx)), vmul(F.n, base + 0.0012));
          dome(vadd(q, vmul(F.ey, 0.007 * (F === Fd ? -1 : 1))), F.n, 0.0019, 0.0010, 6);
        }
        const out = vmul(Fd.n, G.doorT + 0.0012 + G.barrelR);
        const bot = vadd(wallP(x, sh(x, y1 - 0.030), ds), out), top = vadd(wallP(x, sh(x, y1 + 0.028), ds), out);
        const up = vnrm(vsub(top, bot));
        cyl(bot, vadd(bot, vmul(up, 0.016)), G.barrelR, 10);                              // the door's barrel
        cyl(vsub(top, vmul(up, 0.014)), top, G.barrelR, 10);                              // the pod's barrel
        const pinTop = vadd(top, vmul(up, 0.006)), pinBot = vsub(bot, vmul(up, 0.008));
        cyl(pinBot, pinTop, G.pinR, 8);                                                    // the pin
        cyl(pinTop, vadd(pinTop, vmul(Fd.n, 0.016)), G.pinR, 8);                           // its L-handle
        // the hairpin (R-clip) through the pin's foot: one straight leg through it, the bent wavy leg back under it
        const P = (a, b, c) => vadd(pinBot, vadd(vmul(exs, a), vadd(vmul(up, b), vmul(Fd.n, c))));
        const clip = [P(-0.010, 0.002, 0), P(0.009, 0.002, 0)];
        for (let k = 1; k <= 6; k++) { const q = PI * k / 6; clip.push(P(0.009 + 0.004 * Math.sin(q), 0.002 - 0.004 * (1 - Math.cos(q)), 0.0015 * Math.sin(q))); }
        clip.push(P(0.004, -0.007, 0.002), P(0.0, -0.011, 0.003), P(-0.004, -0.007, 0.002), P(-0.008, -0.008, 0.0015));
        tubePath(clip, 0.0008, 5);
      }
      // the LOCK: a keyed cylinder lock between the latches - its bezel stainless, its keyway black
      {
        const F = fr(xm0, y1 - 0.030), c = vadd(F.p, vmul(F.n, G.doorT));
        cyl(c, vadd(c, vmul(F.n, 0.0035)), 0.010, 14);
        const exs = ds > 0 ? F.ex : vmul(F.ex, -1);
        B.g = 2; plate(vadd(c, vmul(F.n, 0.0035)), exs, vcrs(F.n, exs), F.n, 0.0024, 0.010, 0.0004, 0.0008);
      }
    }
  }
  // ---- THE RUBBER JOINT (group 2): a bead round the whole junction - both walls' top edges where they meet the
  // drawn belly, closed across the nose and the tail - so the pod reads as fitted against its seal ----
  B.g = 2;
  {
    const jy = (x, z) => Math.max(PR.at(x).k, topAt ? (topAt(x, Math.abs(z)) ?? PR.at(x).k) : PR.at(x).k);
    const loop = [];
    for (const s of secs) loop.push([s.x, jy(s.x, s.hs.zTop), s.hs.zTop + 0.0015]);
    const sL = secs[secs.length - 1], sF = secs[0];
    for (let k = 1; k < 8; k++) { const z = lerp(sL.hs.zTop, -sL.hs.zTop, k / 8); loop.push([sL.x + 0.0015, jy(sL.x, z), z]); }
    for (let i = secs.length - 1; i >= 0; i--) { const s = secs[i]; loop.push([s.x, jy(s.x, s.hs.zTop), -(s.hs.zTop + 0.0015)]); }
    for (let k = 1; k < 8; k++) { const z = lerp(-sF.hs.zTop, sF.hs.zTop, k / 8); loop.push([sF.x - 0.0015, jy(sF.x, z), z]); }
    loop.push(loop[0]);
    tubePath(loop, G.sealR, 8);
  }
  // ---- THE RIVETS (group 1) in the main line: a row under the joint on each wall, where the wall stands tall enough
  B.g = 1;
  for (const side of [1, -1]) {
    let next = R.x0 + 0.04;
    for (let x = R.x0 + 0.04; x < R.x1 - 0.04; x += 0.005) {
      if (x < next) continue;
      const S = secAt(x), y = S.joint - G.rivetDown;
      if (y - (S.floorY + S.r) < 0.03) continue;
      if (side === ds && latchXs.some(lx => Math.abs(lx - x) < 0.03)) continue;
      next = x + G.rivetPitch;
      const F = wallF(x, y, side);
      dome(F.p, F.n, G.rivetR, G.rivetH, 8);
    }
  }
  // ---- THE TRAPS: the front trap on the nose ramp (the bolted pods'), the aft trap on the boat-tail with its louvred
  // vent (the Airglas pod's), each a panel let into the bottom (group 0) screwed at its corners (group 2) ----
  const trap = (xA, xB, hz, screws) => {
    const at = (a, b, t) => { const F = botF(a, b); return vadd(F.p, vmul(F.n, t)); };    // (a, b) = (x, z): x x z = -y, out
    B.g = 0;
    panel(xA, xB, -hz, hz, Math.min(0.025, 0.3 * hz, 0.3 * (xB - xA)), at, 0.0012);
    B.g = 2;
    for (const [a, b] of screws) { const F = botF(a, b); dome(vadd(F.p, vmul(F.n, 0.0012)), F.n, G.screwR, 0.0016, 8); }
  };
  {
    const xA = R.x0 + 0.30 * (R.xa - R.x0), xB = R.xa - 0.04, S0 = secAt(xA), S1 = secAt(xB);
    const hz = 0.55 * Math.min(S0.h - S0.r, S1.h - S1.r);
    if (xB - xA > 0.08 && hz > 0.04)
      trap(xA, xB, hz, [[xA + 0.014, -hz + 0.014], [xA + 0.014, hz - 0.014], [xB - 0.014, -hz + 0.014], [xB - 0.014, hz - 0.014]]);
  }
  {
    const xA = R.xb + 0.10 * (R.x1 - R.xb), xB = R.xb + 0.62 * (R.x1 - R.xb), S0 = secAt(xA), S1 = secAt(xB);
    const hz = 0.62 * Math.min(S0.h - S0.r, S1.h - S1.r);
    if (xB - xA > 0.10 && hz > 0.05) {
      const xm = 0.5 * (xA + xB), sc = [];
      for (const a of [xA + 0.014, xm, xB - 0.014]) for (const b of [-hz + 0.013, hz - 0.013]) sc.push([a, b]);
      trap(xA, xB, hz, sc);
      // the vent: a stainless rim, its black throat, five louvres across it
      const rv = Math.min(G.ventR, 0.75 * hz, 0.3 * (xB - xA)), F = botF(xm, 0), c = vadd(F.p, vmul(F.n, 0.0012));
      B.g = 1;
      const rim = [];
      for (let k = 0; k <= 24; k++) { const q = 2 * PI * k / 24; rim.push(vadd(c, vadd(vmul(F.ex, rv * Math.cos(q)), vmul(F.ez, rv * Math.sin(q))))); }
      tubePath(rim, 0.0028, 6);
      B.g = 2;
      plate(vadd(c, vmul(F.n, -0.0002)), F.ex, F.ez, vcrs(F.ex, F.ez), 2 * rv * 0.95, 2 * rv * 0.95, 0.0004, rv * 0.9);
      B.g = 1;
      for (let i = -2; i <= 2; i++) {
        const zz = i * rv * 0.34, half = Math.sqrt(Math.max(0, rv * rv - zz * zz)) * 0.88;
        if (half < 0.006) continue;
        const p0 = vadd(c, vadd(vmul(F.ez, zz), vmul(F.ex, -half))), p1 = vadd(c, vadd(vmul(F.ez, zz), vmul(F.ex, half)));
        cyl(vadd(p0, vmul(F.n, 0.0016)), vadd(p1, vmul(F.n, 0.0016)), 0.0024, 6);
      }
    }
  }
  // ---- THE STRAPS (group 1, the strapped mounting - spec.pod.strap): two stainless bands round the pod near the ends
  // of its run, up the fuselage's sides to a tensioner each - the Airglas strapped pod ----
  if (R.strap) {
    B.g = 1;
    for (const xs_ of [R.xa + 0.10 * (R.xb - R.xa), R.xb - 0.10 * (R.xb - R.xa)]) {
      const s = secs.reduce((a, q) => Math.abs(q.x - xs_) < Math.abs(a.x - xs_) ? q : a, secs[0]), x = s.x;
      // (the band runs on up the belly a hand's breadth past the joint to its fitting - the Airglas strapped pod's - laid
      // 1.5 mm off the drawn skin and sampled fine, so its straight pieces never cut under the skin's curve)
      const hb = halfAt ? halfAt(x) : null, up = Math.min(s.hs.zTop + 0.07, hb != null ? 0.97 * hb : s.hs.zTop + 0.07);
      const half = [];                               // port: up the fuselage's side, down to the pod, round its section
      for (let k = 12; k >= 1; k--) { const z = lerp(s.hs.zTop + 0.004, up, k / 12); const y = topAt ? topAt(x, z) : null; if (y != null) half.push([z, y - 0.0015]); }
      for (const [z, y] of s.hs.pts) half.push([z, y]);
      const path = half.map(([z, y]) => [z, y]).concat(half.slice(0, -1).reverse().map(([z, y]) => [-z, y]));
      const cy = s.floorY + 0.5 * (s.P.k - s.floorY);
      const pts = path.map(([z, y], i) => {           // each point pushed out along the outline's own normal
        const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
        let nz = b[1] - a[1], ny = -(b[0] - a[0]); const L = Math.hypot(nz, ny) || 1; nz /= L; ny /= L;
        if (nz * z + ny * (y - cy) < 0) { nz = -nz; ny = -ny; }
        return { z, y, nz, ny };
      });
      const w2 = 0.5 * G.strapW, th = G.strapT + 0.0008;
      const P = (q, dx, t) => [x + dx, q.y + q.ny * t, q.z + q.nz * t];
      const outer = pts.map(q => [B.v(P(q, -w2, th)), B.v(P(q, w2, th))]), sideA = pts.map(q => [B.v(P(q, -w2, 0.0003)), B.v(P(q, -w2, th))]),
            sideB = pts.map(q => [B.v(P(q, w2, 0.0003)), B.v(P(q, w2, th))]);
      const qOut = (a, b, c, d, nrm) => {             // the quad wound so its face normal agrees with nrm
        const pa = B.pos.slice(3 * a, 3 * a + 3), pb = B.pos.slice(3 * b, 3 * b + 3), pc = B.pos.slice(3 * c, 3 * c + 3);
        if (vdot(vcrs(vsub(pb, pa), vsub(pc, pa)), nrm) >= 0) B.q(a, b, c, d); else B.q(a, d, c, b);
      };
      for (let i = 0; i + 1 < pts.length; i++) {
        const q = pts[i], nO = [0, q.ny, q.nz];
        qOut(outer[i][0], outer[i][1], outer[i + 1][1], outer[i + 1][0], nO);
        qOut(sideA[i][0], sideA[i][1], sideA[i + 1][1], sideA[i + 1][0], [-1, 0, 0]);
        qOut(sideB[i][0], sideB[i][1], sideB[i + 1][1], sideB[i + 1][0], [1, 0, 0]);
      }
      // the tensioners at the bands' ends, high on the fuselage's sides: a block and its bolt along the band
      for (const e of [pts[0], pts[pts.length - 1]]) {
        const n = vnrm([0, e.ny, e.nz]), along = vnrm(vcrs(n, [1, 0, 0])), c = [x, e.y + e.ny * th, e.z + e.nz * th];
        const ex = [1, 0, 0], ey = vcrs(n, ex);
        plate(c, ex, ey, n, 0.024, 0.036, 0.007, 0.003);
        cyl(vadd(c, vadd(vmul(n, 0.0035), vmul(along, -0.022))), vadd(c, vadd(vmul(n, 0.0035), vmul(along, 0.022))), 0.0022, 8);
      }
    }
  }
  // ---- THE WEAR SKIDS (group 1): half-round strips under the floor, ramped at both ends ----
  B.g = 1;
  {
    const xa = Math.max(R.x0, R.xa - 0.12), xb = Math.min(R.x1, R.xb + 0.18), zS = G.skidAt * (R.hw - Math.min(G.rChineMax, G.rChineK * Math.min(R.depth, R.hw)));
    const nS = Math.max(8, Math.ceil((xb - xa) / 0.05)), prof = [];
    for (let k = 0; k <= 6; k++) { const a = PI * k / 6; prof.push([0.5 * G.skidW * Math.cos(a), Math.sin(a)]); }
    for (const side of [1, -1]) {
      const rowsS = [];
      for (let i = 0; i <= nS; i++) {
        const x = lerp(xa, xb, i / nS), P = PR.at(x), ramp = sstep(Math.min((x - xa) / 0.08, (xb - x) / 0.08));
        const fl = P.b + G.skidH;                        // the shell's floor here
        rowsS.push(prof.map(([u, s]) => B.v([x, fl - ramp * G.skidH * s - 0.0004 * (1 - s), side * zS + u])));
      }
      for (let i = 0; i < nS; i++) { const a = rowsS[i], b = rowsS[i + 1];
        for (let j = 0; j + 1 < a.length; j++) B.q(a[j], a[j + 1], b[j + 1], b[j]); }
    }
  }
  // ---- the groups laid out one after the other ----
  const groups = [], all = [];
  for (let g = 0; g < 3; g++) { groups.push({ start: all.length, count: B.idx[g].length, mat: g }); for (const i of B.idx[g]) all.push(i); }
  const pos = new Float32Array(B.pos), idx = new Uint32Array(all);
  return { pos, idx, nv: pos.length / 3, nt: idx.length / 3, shellNv, top, around, stations: xs.length, groups };
}

POD_GEN.build = build;
POD_GEN.profile = profile;
if (typeof window !== 'undefined') window.POD_GEN = POD_GEN;
if (typeof module !== 'undefined' && module.exports) module.exports = POD_GEN;
})();
