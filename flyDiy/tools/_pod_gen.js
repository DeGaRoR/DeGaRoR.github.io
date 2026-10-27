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
  // the details
  skidH: 0.006, skidW: 0.028, skidAt: 0.55,                    // m, m, share of the flat floor's half-width
  flangeW: 0.022, flangeT: 0.0025, screwPitch: 0.09, screwR: 0.0042,
  doorT: 0.0016, doorR: 0.03, hingeR: 0.0045,
  latchW: 0.075, latchH: 0.030, latchT: 0.0022,
  // the resolution
  nNose: 30, nTail: 30, dxFlat: 0.035,
};

// ---- the bag: an indexed triangle soup (the float's) ------------------------------------------------------------
function Bag() {
  const pos = [], idx = [];
  return {
    pos, idx,
    v(p) { pos.push(p[0], p[1], p[2]); return pos.length / 3 - 1; },
    t(a, b, c) { if (a !== b && b !== c && a !== c) idx.push(a, b, c); },
    q(a, b, c, d) { this.t(a, b, c); this.t(a, c, d); },
    get nv() { return pos.length / 3; },
  };
}
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
  // ---- THE FLANGE (group 0): a band on the skin along each wall's top, its outer edge rounded ----
  const flange = side => {
    const out = [];
    for (const s of secs) {
      const zt = s.hs.zTop, k = s.P.k;
      // the skin at the wall's top and a flange width out
      const prof = [[0, 0], [0.35, 1], [0.75, 1], [1, 0.25], [1.02, 0]];
      const row = [];
      for (const [f, t] of prof) {
        const z = zt + f * G.flangeW, y = skinTop(s.x, z, k) - G.overlap + t * G.flangeT;
        row.push(B.v([s.x, y, side * z]));
      }
      out.push(row);
    }
    // wind outward-up: along the row the flange runs out (+|z|), rings run aft
    for (let i = 0; i + 1 < out.length; i++) {
      const a = out[i], b = out[i + 1];
      for (let j = 0; j + 1 < a.length; j++) side > 0 ? B.q(a[j], a[j + 1], b[j + 1], b[j]) : B.q(a[j], b[j], b[j + 1], a[j + 1]);
    }
  };
  flange(1); flange(-1);
  // ---- THE DOOR PANEL (group 0) ----
  const D = R.door, ds = D && D.side != null ? (D.sideName === 'right' ? -1 : 1) : 1;   // left = port (+z)
  const wallAt = (x, y) => {                       // the wall's lateral position at (x, y), from the nearest stations
    let i = 0; while (i + 1 < secs.length && secs[i + 1].x < x) i++;
    const s0 = secs[i], s1 = secs[Math.min(secs.length - 1, i + 1)];
    const f = s1.x > s0.x ? clamp((x - s0.x) / (s1.x - s0.x), 0, 1) : 0;
    const wz = s => { const yW0 = s.floorY + s.hs.r; return s.P.h + G.flareK * (s.P.k - s.floorY) * clamp((y - yW0) / Math.max(1e-6, s.hs.yTop - yW0), 0, 1); };
    return lerp(wz(s0), wz(s1), f);
  };
  const hw0 = [];      // hardware triangles go in a second bag, appended after the shell's group
  if (D && D.w > 0.12 && D.h > 0.08) {
    // (the door follows the floor: its outline is laid out level about its middle and sheared by the floor's slope)
    const sl = D.slope || 0, xm0 = 0.5 * (D.x0 + D.x1);
    const sMid = secs.reduce((a, s) => Math.abs(s.x - xm0) < Math.abs(a.x - xm0) ? s : a, secs[0]);
    const y0 = Math.max(D.y0 + G.skidH, sMid.floorY + sMid.hs.r + 0.012), y1 = Math.min(D.y1, sMid.hs.yTop - G.overlap - 0.03);
    if (y1 - y0 > 0.06) {
      const x0 = D.x0, x1 = D.x1, rc = Math.min(G.doorR, 0.3 * (y1 - y0), 0.3 * (x1 - x0));
      // the outline: a rounded rectangle, 8 segments a corner, counter-clockwise seen from outside (port: x aft is to
      // the viewer's right when looking at the port side from outside ... the winding is set below by the side)
      const ol = [];
      const C = [[x1 - rc, y1 - rc, 0], [x0 + rc, y1 - rc, 0.5 * PI], [x0 + rc, y0 + rc, PI], [x1 - rc, y0 + rc, 1.5 * PI]];
      for (const [cx, cy, a0] of C) for (let k = 0; k <= 8; k++) { const a = a0 + 0.5 * PI * k / 8; ol.push([cx + rc * Math.cos(a), cy + rc * Math.sin(a)]); }
      const xc = 0.5 * (x0 + x1), yc = 0.5 * (y0 + y1);
      const at = (x, y, t) => { const yy = y + sl * (x - xm0); return [x, yy, ds * (wallAt(x, yy) + t)]; };
      const inner = 0.006;             // the bevel: the panel's face is inset this far from its edge
      const cI = B.v(at(xc, yc, G.doorT));
      // THE SHUT LINE: a V-groove round the panel - the wall's edge, the groove's root 3 mm in and 3 mm down, the
      // panel's face rim beyond it - so the door reads by the shadow in its gap, as a moulded door does
      const inset = (x, y, d) => { const ex = x - xc, ey = y - yc, L = Math.hypot(ex, ey) || 1; return [x - d * ex / L, y - d * ey / L]; };
      // (each face of the V its own vertices: hard edges, so the vertex normals do not average the groove away)
      const pE = ol.map(([x, y]) => at(x, y, -0.0005));                                  // the edge, at the wall
      const pG = ol.map(([x, y]) => { const [u, v] = inset(x, y, 0.003); return at(u, v, -0.003); });   // the root
      const pF = ol.map(([x, y]) => { const [u, v] = inset(x, y, inner); return at(u, v, G.doorT); });  // the face's rim
      const ring = P => P.map(p => B.v(p));
      const e1 = ring(pE), g1 = ring(pG), g2 = ring(pG), f2 = ring(pF), ringF = ring(pF);
      const n = ol.length;
      const band = (A, C, k, k1) => ds > 0 ? B.q(A[k], A[k1], C[k1], C[k]) : B.q(A[k], C[k], C[k1], A[k1]);
      for (let k = 0; k < n; k++) {
        const k1 = (k + 1) % n;
        // outward (+ds z): the outline runs counter-clockwise in (x, y); seen from starboard it is clockwise, so the
        // order flips with the side
        if (ds > 0) B.t(cI, ringF[k], ringF[k1]); else B.t(cI, ringF[k1], ringF[k]);
        band(e1, g1, k, k1); band(g2, f2, k, k1);
      }
      // the hinge (hardware): a knuckle along the top edge, its leaf on the panel
      // (the hardware lies along the door's own sheared axes: ex along the sill, ey square to it in the wall)
      const L = Math.hypot(1, sl), ex = [1 / L, sl / L, 0], ey = [-sl / L, 1 / L, 0];
      hw0.push({ kind: 'hinge', x0: x0 + 0.02, x1: x1 - 0.02, y: y1 - 0.004, at, ds, ex, ey, sl });
      for (const f of [0.27, 0.73]) hw0.push({ kind: 'latch', x: lerp(x0, x1, f), y: y0 + 0.032, at, ds, ex, ey });
    }
  }
  const nShell = B.idx.length;
  // ---- THE HARDWARE (group 1) ----
  const tube = (p0, p1, r, nA, side) => {             // a capped cylinder along x at a wall point (the hinge knuckle)
    const n = nA || 10, rA = [], rB = [];
    for (let k = 0; k < n; k++) { const a = 2 * PI * k / n;
      rA.push(B.v([p0[0], p0[1] + r * Math.sin(a), p0[2] + side * r * Math.cos(a)]));
      rB.push(B.v([p1[0], p1[1] + r * Math.sin(a), p1[2] + side * r * Math.cos(a)])); }
    for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; side > 0 ? B.q(rA[k], rB[k], rB[k1], rA[k1]) : B.q(rA[k], rA[k1], rB[k1], rB[k]); }
    const cA = B.v(p0), cB = B.v(p1);
    for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; side > 0 ? (B.t(cA, rA[k], rA[k1]), B.t(cB, rB[k1], rB[k])) : (B.t(cA, rA[k1], rA[k]), B.t(cB, rB[k], rB[k1])); }
  };
  // a rounded plate on a surface: centre c, local axes ex (along), ey (up), n (out); w x h, proud t, corner rc
  const plate = (c, ex, ey, n, w, h, t, rc) => {
    const ol = [];
    const C = [[0.5 * w - rc, 0.5 * h - rc, 0], [-0.5 * w + rc, 0.5 * h - rc, 0.5 * PI], [-0.5 * w + rc, -0.5 * h + rc, PI], [0.5 * w - rc, -0.5 * h + rc, 1.5 * PI]];
    for (const [cx, cy, a0] of C) for (let k = 0; k <= 4; k++) { const a = a0 + 0.5 * PI * k / 4; ol.push([cx + rc * Math.cos(a), cy + rc * Math.sin(a)]); }
    const P = (u, v, s) => [c[0] + ex[0] * u + ey[0] * v + n[0] * s, c[1] + ex[1] * u + ey[1] * v + n[1] * s, c[2] + ex[2] * u + ey[2] * v + n[2] * s];
    const lo = ol.map(([u, v]) => B.v(P(u, v, -0.0005))), hi = ol.map(([u, v]) => B.v(P(u * 0.94, v * 0.9, t)));
    const cc = B.v(P(0, 0, t)), m = ol.length;
    for (let k = 0; k < m; k++) { const k1 = (k + 1) % m; B.t(cc, hi[k], hi[k1]); B.q(lo[k], lo[k1], hi[k1], hi[k]); }
    return P;
  };
  for (const h of hw0) {
    if (h.kind === 'hinge') {
      const p0 = h.at(h.x0, h.y, G.doorT + G.hingeR * 0.85), p1 = h.at(h.x1, h.y, G.doorT + G.hingeR * 0.85);
      tube(p0, p1, G.hingeR, 12, h.ds);
      // the leaf, a thin strap under the knuckle on the panel
      const xm = 0.5 * (h.x0 + h.x1), c = h.at(xm, h.y - 0.011, G.doorT);
      plate(c, h.ds > 0 ? h.ex : [-h.ex[0], -h.ex[1], 0], h.ey, [0, 0, h.ds], Math.hypot(h.x1 - h.x0, h.sl * (h.x1 - h.x0)), 0.016, 0.0008, 0.002);
    } else {
      const c = h.at(h.x, h.y, G.doorT);
      // ex along +x, ey up, n out: on port (+z) (ex x ey) = +z = out - the right-handed plate; on starboard mirror ex
      const ex = h.ds > 0 ? h.ex : [-h.ex[0], -h.ex[1], 0];
      plate(c, ex, h.ey, [0, 0, h.ds], G.latchW, G.latchH, G.latchT, 0.008);
      // the paddle: a narrower proud bar inside the plate
      plate([c[0], c[1], c[2] + h.ds * G.latchT], ex, h.ey, [0, 0, h.ds], 0.62 * G.latchW, 0.38 * G.latchH, 0.0018, 0.004);
    }
  }
  // the screws along the flange: a low dome every screwPitch, on both sides
  for (const side of [1, -1]) {
    let next = R.x0 + 0.06;
    for (const s of secs) {
      if (s.x < next || s.x > R.x1 - 0.06) continue;
      next = s.x + G.screwPitch;
      const z = s.hs.zTop + 0.55 * G.flangeW, y = skinTop(s.x, z, s.P.k) - G.overlap + G.flangeT;
      const n = 8, rim = [], cap = B.v([s.x, y + 0.6 * G.screwR, side * z]);
      for (let k = 0; k < n; k++) { const a = 2 * PI * k / n; rim.push(B.v([s.x + G.screwR * Math.cos(a), y - 0.0003, side * (z + G.screwR * Math.sin(a))])); }
      for (let k = 0; k < n; k++) { const k1 = (k + 1) % n; side > 0 ? B.t(cap, rim[k1], rim[k]) : B.t(cap, rim[k], rim[k1]); }
    }
  }
  // the wear skids: half-round strips under the floor, ramped at both ends
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
  const pos = new Float32Array(B.pos), idx = new Uint32Array(B.idx);
  return { pos, idx, nv: pos.length / 3, nt: idx.length / 3, shellNv, top, around, stations: xs.length,
           groups: [{ start: 0, count: nShell, mat: 0 }, { start: nShell, count: idx.length - nShell, mat: 1 }] };
}

POD_GEN.build = build;
POD_GEN.profile = profile;
if (typeof window !== 'undefined') window.POD_GEN = POD_GEN;
if (typeof module !== 'undefined' && module.exports) module.exports = POD_GEN;
})();
