// ============================================================
// THE WING, AND THE MESH TOOLS THE GENERATOR IS BUILT FROM.
//
// This file was GARAGE 4/5's SKIN until G67.1 — genSkin, which built the
// whole aeroplane from the truss. The cage replaced every part of that
// except the WING, which `_cage_wing.js` builds out of here on every cage
// build, so the wing was lifted out into genWingInto/genWing and the rest
// was deleted. See the note where genSkin stood.
//
// THE FRAME IS THE SURFACE, and that is still the point of it. Every wing
// vertex is an affine blend of the truss nodes it sits on (weights summing
// to 1), so the covering follows the structure exactly and there is nothing
// to calibrate: the mount offset every imported model needs is [0,0,0] here
// BY CONSTRUCTION. It gets wing flex for free for the same reason —
// SKIN-PROC.md §6 lists that as deferred for imported skins, because binding
// a foreign mesh to a truss is the hard part, and generating the mesh from
// the truss makes it trivial.
//
// What is left here, in order: the mesh accumulator and the small solid
// builders, the rest frame, the aerofoil evaluators, the loft pair, one
// beam, the paint row, THE WING, and the pose/rest helpers the viewer uses
// to fly whatever it was handed.
// ============================================================
// ============================================================

// how far inside the covering the liner sits. Big enough that no pair of faces
// z-fights at any camera distance, small enough that the wall never reads as a
// thickness: 18 mm on an aeroplane whose fuselage is a metre across.
const INTR_T = 0.018;
const GEN_TUBE_R = { fus: 0.016, wing: 0.020, gear: 0.024,
                     // G185: the truss classes — struts as the lift strut's
                     // streamline section, a wire as a 5 mm cable
                     cabane: 0.020, interplane: 0.020, wire: 0.0025 };
// FUSELAGE SECTION RESOLUTION. 40, not 20, because the cabin opening's sill is
// a RING INDEX — `round(sill * GEN_RADIAL / 2)` — so this constant is also the
// number of sill positions the slider can reach and how finely the cut can
// follow the deck. At 20 the canopy's lower edge steps visibly. It is the main
// driver of the triangle count; see the perf note in HANDOVER.
const GEN_RADIAL = 40;
// Wheel resolution, around. 18 read as a dodecagon from a metre away — a wheel
// is the one part of this aeroplane whose silhouette is a circle and the eye
// knows it. 24 costs 684 more triangles across three wheels.
const GEN_WHEEL_SEG = 24;
// Where the cowl's lofted cover stops in its own sheet. Above it is the flat
// nose face, mapped as a rim strip (see the cowl block).
const GEN_COWL_V = 0.88;

// STREAMLINE SECTION for the external lift struts. A real lift strut is a
// streamline tube — ~3.5:1 fineness, chord fore-and-aft — and a round bar in
// its place is the most model-kit thing on a strut-braced aeroplane: it has no
// direction, so it reads as scaffolding rather than as structure.
// Closed loop, TE -> upper -> LE -> lower; chord fraction and half-thickness.
const GEN_STRUT_SECT = [
  [1.00,  0.000], [0.86,  0.036], [0.72,  0.068], [0.57,  0.094],
  [0.42,  0.111], [0.29,  0.118], [0.18,  0.111], [0.10,  0.092],
  [0.04,  0.059], [0.00,  0.000],
  [0.04, -0.059], [0.10, -0.092], [0.18, -0.111], [0.29, -0.118],
  [0.42, -0.111], [0.57, -0.094], [0.72, -0.068], [0.86, -0.036],
];
// NOTE: the design session also carried a GEN_SPIN_SECT and a rebuilt propeller.
// That work was dismissed, and the propeller here is the trunk's — which is not
// decoration: `prop` is a top-level spec group whose disc area drives static
// thrust and propwash and whose blades weigh something at the very front. Do NOT
// restore the propeller from the session bundle's `gen/orig/`; orig predates the
// trunk's rebuild, and taking it would silently delete it.

// A WHEEL IS A REVOLVED PROFILE, not a cylinder with two flat lids. Fractions
// of the wheel radius and of the half-width, walked from one bead round to the
// other. The widest point is at 84% of the radius because an aviation tyre is
// fat and round-shouldered; the flat-sided cylinder these replace was most of
// the "wheel meshes are ugly" report.
// The bead sits at 42% of the radius because that is where an aviation tyre's
// rim is: an 8.00-6 is a 6 inch rim inside a 16 inch tyre. Drawn first at 55%
// and the wheel came out as a pale disc with a band of rubber round it.
const GEN_TYRE_SECT = [
  [0.42, -0.44], [0.62, -0.86], [0.80, -1.00], [0.92, -0.90],
  [0.99, -0.58], [1.00, -0.20], [1.00,  0.20], [0.99,  0.58],
  [0.92,  0.90], [0.80,  1.00], [0.62,  0.86], [0.42,  0.44],
];
// The wheel under it: hub cap, dished disc, and the rim barrel the beads sit
// on. Its flange point IS the tyre's bead point, so the two meet exactly and
// there is no gap to close. Deliberately axisymmetric — no bolt heads, no
// spokes — because nothing spins the wheel and a bolt circle that never moves
// is worse than none.
const GEN_HUB_SECT = [
  [0.00, -0.26], [0.10, -0.26], [0.17, -0.23], [0.30, -0.26], [0.42, -0.44],
  [0.42,  0.44], [0.30,  0.26], [0.17,  0.23], [0.10,  0.26], [0.00,  0.26],
];
const GEN_LSEG = 4;             // lengthwise slices per fuselage bay
const GEN_WSEG = 2;             // spanwise slices per wing bay
const GEN_AF = 22;              // airfoil points per surface

// ---- mesh accumulator ------------------------------------------------------
// infl: [[nodeIndex, weight], ...], at most GEN_INFL entries, weights sum to 1.
// 8, because a section between two frames blends both frames' four corners.
const GEN_INFL = 8;
function genMesh() {
  return {
    pos: [], uv: [], sid: [], idx: [], wi: [], ww: [],
    v(p, u, vv, infl, sidv) {
      this.pos.push(p[0], p[1], p[2]);
      this.uv.push(u, vv);
      this.sid.push(sidv || 0);
      for (let k = 0; k < GEN_INFL; k++) {
        const e = infl[k];
        this.wi.push(e ? e[0] : (infl[0] ? infl[0][0] : 0));
        this.ww.push(e ? e[1] : 0);
      }
      return this.pos.length / 3 - 1;
    },
    tri(a, b, c) { this.idx.push(a, b, c); },
    quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); },
    done() {
      const nv = this.pos.length / 3;
      return {
        nv, nt: this.idx.length / 3,
        pos: Float32Array.from(this.pos), uv: Float32Array.from(this.uv),
        idx: nv > 65535 ? Uint32Array.from(this.idx) : Uint16Array.from(this.idx),
        sid: Uint8Array.from(this.sid),
        wi: Int32Array.from(this.wi), ww: Float32Array.from(this.ww),
      };
    },
  };
}

// One paint texture serves the whole aeroplane, so the UV space is split into
// two zones: BODY takes v 0.03..0.47 (u = angle around the section, v = station
// along the body) and PANEL takes v 0.53..0.97 (u = chord fraction, v = span).
// A stripe drawn across u therefore runs fore-and-aft on the fuselage and
// spanwise on the wing, which is what both want.
const genUVBody = t => 0.03 + 0.44 * Math.max(0, Math.min(1, t));
const genUVPanel = t => 0.53 + 0.44 * Math.max(0, Math.min(1, t));

const genV3 = {
  sub: (a, b) => [a[0]-b[0], a[1]-b[1], a[2]-b[2]],
  add: (a, b) => [a[0]+b[0], a[1]+b[1], a[2]+b[2]],
  mul: (a, s) => [a[0]*s, a[1]*s, a[2]*s],
  cross: (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]],
  norm: a => { const L = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/L, a[1]/L, a[2]/L]; },
};

// Rest body frame, computed with the same formula the solver's bodyAxes() uses
// so the generated skin lands in exactly the frame poseModel() will pose it in.
function genRestFrame(def) {
  const N = def.nodes, R = def.refs;
  const avg = ids => {
    const o = [0, 0, 0];
    for (const i of ids) { o[0] += N[i].p[0]; o[1] += N[i].p[1]; o[2] += N[i].p[2]; }
    return genV3.mul(o, 1 / ids.length);
  };
  const xA = genV3.norm(genV3.sub(avg(R.tailMid), avg(R.noseFrame)));
  let yU = genV3.norm(genV3.sub(avg(R.upHi), avg(R.upLo)));
  const zL = genV3.norm(genV3.cross(xA, yU));
  yU = genV3.norm(genV3.cross(zL, xA));
  let x = 0, y = 0, z = 0, m = 0;
  for (const n of N) { x += n.p[0]*n.m; y += n.p[1]*n.m; z += n.p[2]*n.m; m += n.m; }
  const cg = [x/m, y/m, z/m];
  return { cg, xA, yU, zL,
    // world point -> body coordinates
    to(p) {
      const d = genV3.sub(p, cg);
      return [d[0]*xA[0]+d[1]*xA[1]+d[2]*xA[2],
              d[0]*yU[0]+d[1]*yU[1]+d[2]*yU[2],
              d[0]*zL[0]+d[1]*zL[1]+d[2]*zL[2]];
    } };
}

// NACA 4-digit section. Returns closed contour, TE -> upper -> LE -> lower -> TE,
// in (chordFrac, thicknessFrac) with cosine spacing so the nose is resolved.
function genAirfoil(naca) {
  const { m, p, t } = nacaParts(naca);
  const yc = x => x <= p ? (m/(p*p))*(2*p*x - x*x) : (m/((1-p)*(1-p)))*((1-2*p) + 2*p*x - x*x);
  const dyc = x => x <= p ? (2*m/(p*p))*(p - x) : (2*m/((1-p)*(1-p)))*(p - x);
  const yt = x => 5*t*(0.2969*Math.sqrt(x) - 0.1260*x - 0.3516*x*x + 0.2843*x*x*x - 0.1015*x*x*x*x);
  const up = [], lo = [];
  for (let i = 0; i <= GEN_AF; i++) {
    const x = 0.5 * (1 - Math.cos(Math.PI * i / GEN_AF));
    const th = Math.atan(dyc(x)), s = Math.sin(th), c = Math.cos(th), T = yt(x);
    up.push([x - T*s, yc(x) + T*c]);
    lo.push([x + T*s, yc(x) - T*c]);
  }
  // TE closes on the mean line; walk upper aft->fwd then lower fwd->aft
  const pts = [];
  for (let i = up.length - 1; i >= 1; i--) pts.push(up[i]);
  pts.push([0, yc(0)]);
  for (let i = 1; i < lo.length; i++) pts.push(lo[i]);
  return pts;                                   // open contour, TE..LE..TE
}

// Aerofoil as EVALUATORS rather than a fixed point list, so a section can be
// resampled between any two chord fractions with a chosen point count. That is
// the whole trick behind separated control surfaces: the fixed wing is lofted
// over [0..hinge] and the surface over [hinge..1], both with constant row
// lengths, so each is its own closed mesh and neither has to know about the
// other. Sampling BOTH at the same parameter `hinge` makes the cove and the
// surface's leading edge the same points by construction — no gap to close.
function genAfEval(naca) {
  const { m, p, t } = nacaParts(naca);
  const yc = x => x <= p ? (m/(p*p))*(2*p*x - x*x) : (m/((1-p)*(1-p)))*((1-2*p) + 2*p*x - x*x);
  const dyc = x => x <= p ? (2*m/(p*p))*(p - x) : (2*m/((1-p)*(1-p)))*(p - x);
  const yt = x => 5*t*(0.2969*Math.sqrt(Math.max(0,x)) - 0.1260*x - 0.3516*x*x
                       + 0.2843*x*x*x - 0.1015*x*x*x*x);
  const at = (x, sgn) => {
    const th = Math.atan(dyc(x)), T = yt(x);
    return [x - sgn * T * Math.sin(th), yc(x) + sgn * T * Math.cos(th)];
  };
  return { up: x => at(x, 1), lo: x => at(x, -1) };
}

// Closed section between chord fractions a..b: upper walked b->a, then lower
// a->b. Treated as a LOOP, so the cove (upper-a to lower-a) and the trailing
// edge (lower-b back to upper-b) both close for free.
function genAfSeg(naca, a, b, n) {
  const E = genAfEval(naca);
  const xs = i => a + (b - a) * 0.5 * (1 - Math.cos(Math.PI * i / n));
  const pts = [];
  for (let i = n; i >= 0; i--) pts.push(E.up(xs(i)));
  for (let i = 0; i <= n; i++) pts.push(E.lo(xs(i)));
  return pts;
}

// Station cross-section: an asymmetric SUPERELLIPSE, thin wrapper over
// genSuper (60b_gen_loft.js). theta 0 = top, +pi/2 = +z side, pi = bottom.
// crownT applies at the top and fades to crownS by the sides.
//
// This used to be a per-angle LINEAR BLEND between an axis-aligned rectangle and
// an ellipse, and it carried a defect nobody had named. The rectangle's radius
// min(halfD/|cy|, halfW/|cz|) has a derivative discontinuity at each of its four
// corners, so for ANY crown < 1 the blend inherited four C1 breaks around EVERY
// ring — at the stock crownSide 0.07 the belly and sides were a creased
// rectangle running the whole length of the aeroplane. Measured at the real
// GEN_RADIAL = 40 tessellation, where a uniform ring turns 9.00 deg per vertex:
//
//   crownT/crownS   old       new
//   0.72 / 0.07     63.92 ->  37.12 deg     (the stock aeroplane)
//   0.50 / 0.50     43.28 ->  18.36
//   0.00 / 0.00     66.46 ->  42.15
//   1.00 / 1.00     11.11 ->  11.11         (already an ellipse: unchanged)
//
// crownTop and crownSide keep their spec paths and their meaning; they are
// reinterpreted as exponents by genCrownToN, which is a least-squares fit of
// genSuper against the genRing this replaces. See 60b_gen_loft.js for the fit
// table and for why the residual at crown = 0 is large on purpose.
function genRing(theta, halfW, halfD, crownT, crownS) {
  // the proud-former scale is blended by the SAME smoothstep genSuper uses on
  // the exponent — with max(0, cy) the two disagreed at the waterline, which is
  // precisely where a step in the section reads worst
  const s = Math.max(0, Math.cos(theta));
  const k = genCrownScale(crownS + (crownT - crownS) * s * s * (3 - 2 * s));
  return genSuper(theta, halfW * k, halfD * k,
                  genCrownToN(crownT), genCrownToN(crownS));
}

// A member drawn between two nodes has to STRETCH with them. Otherwise the
// suspension travel it exists to show slides the whole leg down instead of
// compressing it, and the leg parts company with both the axle and the
// airframe. So the sweep helpers take their influence as a FUNCTION of position
// along the sweep as well as a fixed array.
const genInfl = infl => (typeof infl === 'function' ? infl : () => infl);
const genSpanInfl = (a, b) => t => [[a, 1 - t], [b, t]];

// generic swept tube, used for the engine block's cylinders and shaft
function genTubeInto(M, A, C, r, seg, infl, B) {
  const ax = genV3.norm(genV3.sub(C, A));
  const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
  const IN = genInfl(infl);
  const rings = [A, C].map((base, s) => {
    const row = [];
    for (let h = 0; h <= seg; h++) {
      const a = 2 * Math.PI * (h % seg) / seg;
      const off = genV3.add(genV3.mul(e1, r * Math.cos(a)), genV3.mul(e2, r * Math.sin(a)));
      row.push(M.v(B(genV3.add(base, off)), h / seg, s, IN(s)));
    }
    return row;
  });
  for (let h = 0; h < seg; h++)
    M.quad(rings[0][h], rings[0][h+1], rings[1][h+1], rings[1][h]);
  // The two caps face OPPOSITE ways, so they cannot share a winding. Both used
  // to be wound the C end's way, which left every A-end cap in the aeroplane
  // lit from inside — invisible on the engine cylinders it was written for
  // (they are buried in the block) and not invisible at all on a gear leg.
  for (const [row, base, s] of [[rings[0], A, 0], [rings[1], C, 1]]) {
    const c = M.v(B(base), 0.5, 0.5, IN(s));
    for (let h = 0; h < seg; h++)
      if (s) M.tri(c, row[h], row[h+1]); else M.tri(c, row[h+1], row[h]);
  }
}

// Revolved solid about an axle. `sect` is [[r/R, w/halfW], ...] walked from one
// side to the other; a row at r = 0 collapses to a single apex vertex, which is
// how the hub caps itself.
//
// UV is the point of this helper. u = angle around the wheel, v = ARC LENGTH
// along the section, normalised — so a texture drawn for it appears exactly as
// drawn: a band at v = 0.5 is the crown, a band near v = 0 or 1 is a sidewall,
// and neither stretches. The wheel this replaced put v = 0 on one flat face and
// v = 1 on the other, so both sidewalls were a single texel row smeared over a
// triangle fan and nothing could be painted on them at all.
//
// Winding: (b-a) runs +angle and (c-a) runs +section, which puts the computed
// normal outward. Getting it backwards leaves the wheel lit from inside.
function genRevolveInto(M, c, axis, R, halfW, sect, seg, infl, B) {
  const ax = genV3.norm(axis);
  const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
  const L = [0];
  for (let i = 1; i < sect.length; i++)
    L.push(L[i-1] + Math.hypot((sect[i][0] - sect[i-1][0]) * R,
                               (sect[i][1] - sect[i-1][1]) * halfW));
  const tot = L[L.length - 1] || 1;
  const rows = sect.map((s, i) => {
    const rr = s[0] * R, base = genV3.add(c, genV3.mul(ax, s[1] * halfW)), v = L[i] / tot;
    if (rr < 1e-6) return { apex: M.v(B(base), 0.5, v, infl) };
    const row = [];
    for (let h = 0; h <= seg; h++) {
      const a = 2 * Math.PI * (h % seg) / seg;
      row.push(M.v(B(genV3.add(base,
        genV3.add(genV3.mul(e1, rr * Math.cos(a)), genV3.mul(e2, rr * Math.sin(a))))),
        h / seg, v, infl));
    }
    return { row };
  });
  for (let i = 0; i < rows.length - 1; i++) {
    const A = rows[i], C = rows[i+1];
    for (let h = 0; h < seg; h++) {
      // `!= null`, not truthiness: an apex is a vertex INDEX and the hub's first
      // one is index 0
      if (A.apex != null) M.tri(A.apex, C.row[h+1], C.row[h]);
      else if (C.apex != null) M.tri(C.apex, A.row[h], A.row[h+1]);
      else M.quad(A.row[h], A.row[h+1], C.row[h+1], C.row[h]);
    }
  }
}

// Swept RECTANGULAR section, for the spring-steel gear leg. A leaf spring is a
// flat tapered bar and nothing else reads as one: half-dimensions are given at
// both ends so it tapers. The broad face comes out perpendicular to the leg and
// horizontal, which puts it fore-and-aft on a main leg (a Cessna leg, bending
// vertically) and across the aeroplane on a tailwheel leg (which is also right
// — one rule, both correct).
function genBladeInto(M, A, C, w0, t0, w1, t1, infl, B) {
  const ax = genV3.norm(genV3.sub(C, A));
  const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = genV3.norm(genV3.cross(ax, up));           // broad
  const e2 = genV3.cross(ax, e1);                       // thin
  const CN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];      // +angle order, as the revolve
  const IN = genInfl(infl);
  const rows = [[A, w0, t0], [C, w1, t1]].map(([base, w, t], s) =>
    CN.map(([su, sv], i) => M.v(B(genV3.add(base,
      genV3.add(genV3.mul(e1, su * w), genV3.mul(e2, sv * t)))), i / 4, s, IN(s))));
  for (let i = 0; i < 4; i++)
    M.quad(rows[0][i], rows[0][(i+1)%4], rows[1][(i+1)%4], rows[1][i]);
  M.quad(rows[0][3], rows[0][2], rows[0][1], rows[0][0]);
  M.quad(rows[1][0], rows[1][1], rows[1][2], rows[1][3]);
}

// The bungee wrap: a revolve about the LEG axis whose radius ripples, so one
// ripple is one turn of cord. Built rather than tabled because the turn count
// is the only thing that makes it read as cord.
// The valleys must stay OUTSIDE the leg they wrap — measured on screen, at
// 0.72 +- 0.28 of a 1.15 r0 wrap they dipped just inside the 0.55 r0 tube, so
// the steel showed through between the turns and the whole wrap read as a chain
// of pale beads instead of dark cord. 0.80 +- 0.20 of 1.30 r0 keeps the tightest
// turn at 0.78 r0, comfortably clear.
function genBungeeSect(turns) {
  const pts = [], n = turns * 4;
  for (let i = 0; i <= n; i++)
    pts.push([0.80 + 0.20 * Math.cos(2 * Math.PI * turns * (i / n) - Math.PI),
              -1 + 2 * (i / n)]);
  return pts;
}

// THE SUSPENSION IS VISIBLE. Bungee, spring steel and oleo were three numbers
// with identical geometry — "springing has no visual feedback" — and they are
// three completely different pieces of hardware. A = the axle end, C = the
// airframe end; `rb` is the gear tube radius everything is sized against.
// Returns the mesh the cord (if any) went into, so the caller can group it.
function genGearLegInto(steel, rubber, A, C, kind, rb, nA, nC, B) {
  const d = genV3.sub(C, A), L = Math.hypot(d[0], d[1], d[2]);
  const at = t => genV3.add(A, genV3.mul(d, t));
  // the sweep helpers take t along their own span, which has to be remapped
  // onto the leg's when a piece covers only part of it
  const span = genSpanInfl(nA, nC);
  const part = (t0, t1) => t => span(t0 + (t1 - t0) * t);
  if (kind === 'spring') {
    // 76 mm x 20 mm at the top, tapering to 58 x 13 at the axle — a Cessna leg
    genBladeInto(steel, A, C, 1.15*rb, 0.28*rb, 1.60*rb, 0.42*rb, span, B);
  } else if (kind === 'oleo') {
    // two stages with a visible step: the piston below, the cylinder above it
    genTubeInto(steel, A, at(0.52), 0.62*rb, 8, part(0, 0.52), B);
    genTubeInto(steel, at(0.45), C, 1.05*rb, 8, part(0.45, 1), B);
  } else {
    // a thin steel leg with the cord wrapped round it, low down where it shows
    genTubeInto(steel, A, C, 0.55*rb, 8, span, B);
    // the wrap rides at one point on the leg rather than stretching along it:
    // it spans a third of the leg and its own stretch is under a millimetre
    const c0 = 0.10, c1 = 0.46;
    genRevolveInto(rubber, at(0.5*(c0+c1)), d, 1.30*rb, 0.5*(c1-c0)*L,
                   genBungeeSect(4), 10, span(0.5*(c0+c1)), B);
  }
}

// axis-aligned box, for the crankcase
function genBoxInto(M, lo, hi, infl, B) {
  const V = [];
  for (const x of [lo[0], hi[0]]) for (const y of [lo[1], hi[1]]) for (const z of [lo[2], hi[2]])
    V.push(M.v(B([x, y, z]), (x === lo[0] ? 0 : 1), (y === lo[1] ? 0 : 1), infl));
  // index bits: x*4 + y*2 + z
  const q = (a, b, c, d) => M.quad(V[a], V[b], V[c], V[d]);
  q(0,1,3,2); q(4,6,7,5); q(0,4,5,1); q(2,3,7,6); q(0,2,6,4); q(1,5,7,3);
}

// ONE BEAM, DRAWN (G67.1). Lifted out of genSkin's beam loop unchanged, so
// the WING'S LIFT STRUTS can be drawn by genWing without a second copy of the
// streamline section living anywhere. The loop above it still decides WHICH
// mesh a beam belongs in — that decision is about the aeroplane, not about
// the tube — and hands it in.
function genBeamInto(M, b, N, B) {
  const w1 = i => [[i, 1]];
    const A = N[b.a].p, C = N[b.b].p;
    const ax = genV3.norm(genV3.sub(C, A));
    const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
    // 9 mm across for a wire: still about twice a real tie rod, so it reads at
    // distance, but 12 mm left the tailwheel looking braced by scaffolding poles
    const r = b.vis === 'wire' ? 0.0045 : GEN_TUBE_R[b.cls] * (b.ext ? 1.15 : 1);
    // Only a wing's external member is a lift strut. Every `vis === 'wire'` beam
    // 61_gen_frame.js emits is `cls: 'gear'`, so no wire reaches this branch.
    const lift = b.ext && (b.cls === 'wing' || b.cls === 'cabane' || b.cls === 'interplane');
    if (lift) {
      // chord fore-and-aft: body x, projected perpendicular to the strut axis
      const d = ax[0];
      e1 = genV3.norm([1 - ax[0] * d, -ax[1] * d, -ax[2] * d]);
      e2 = genV3.norm(genV3.cross(ax, e1));
    }
    const SEG = lift ? GEN_STRUT_SECT.length : 8;
    const cw = 3.6 * r;
    const off = h => lift
      ? genV3.add(genV3.mul(e1, (GEN_STRUT_SECT[h][0] - 0.40) * cw),
                  genV3.mul(e2, GEN_STRUT_SECT[h][1] * cw))
      : genV3.add(genV3.mul(e1, r * Math.cos(2 * Math.PI * h / SEG)),
                  genV3.mul(e2, r * Math.sin(2 * Math.PI * h / SEG)));
    const ring = [];
    for (let s = 0; s < 2; s++) {
      const nd = s ? b.b : b.a, base = s ? C : A, row = [];
      for (let h = 0; h < SEG; h++)
        row.push(M.v(B(genV3.add(base, off(h))), h / SEG, s, w1(nd)));
      ring.push(row);
    }
    for (let h = 0; h < SEG; h++)
      M.quad(ring[0][h], ring[0][(h+1)%SEG], ring[1][(h+1)%SEG], ring[1][h]);
    for (const s of [0, 1]) {
      const row = ring[s], nd = s ? b.b : b.a;
      const c0 = M.v(B(s ? C : A), 0.5, 0.5, w1(nd));
      for (let h = 0; h < SEG; h++)
        if (s) M.tri(c0, row[h], row[(h+1)%SEG]);
        else   M.tri(c0, row[(h+1)%SEG], row[h]);
    }
}

// THE PAINTED ROW, once. Nine groups wear the aeroplane's livery — the
// covering, four wing surfaces and four tail surfaces — and until G67.1 came
// to split this file they were nine identical object literals, which is nine
// places to change the day the paint gains a coat. It is a function of the
// spec because that is all it ever was.
const genPaintRow = S => ({ tex: 'paint', color: S.paint.base, nrm: 'bump',
                            nrmScale: 0.9, mr: 'mr',
                            rough: 1 - S.paint.gloss });

// ---------------------------------------------------------------------------
// THE WING (G67.1) — the one half of this file the cage never replaced
// ---------------------------------------------------------------------------
// `_cage_wing.js` builds the wing of every cage build — the aeroplane that
// FLIES — out of this code: the covering, the tips, the ailerons, the flaps,
// the carry-through and the pitot mast. So when G67.1 came to retire the old
// generated skin it found the wing living inside it, and the answer is this:
// the wing becomes a thing of its own that both callers use, rather than a
// stretch of a 2600-line function that only one of them can reach.
//
// IT IS A MOVE, NOT A REWRITE, and that distinction is the whole risk of the
// chantier: a wing that came out three millimetres thinner, or with its rib
// stations off by one, or with its UV zone shifted (which is where G68.1's
// surface field comes from) would look completely normal and be wrong. Every
// line below is the line that was in genSkin. `tools/_wing_split.js` froze
// thirteen wings as digests over every position, every uv and every binding
// weight BEFORE the move and compares after — and it is negative-verified: a
// one-millimetre nudge on a single vertex fails it on every case.
//
// The caller hands over the meshes to write into, because the wing shares two
// of them with the fuselage — its covering goes in `skin` beside the body's,
// and a GLASS carry-through goes in `canopy` beside the windscreen's — and
// that sharing is the reason the split is a seam rather than a cut. What
// comes back is the handful of numbers the rest of genSkin still needs: the
// hinge fractions and band ends, which the control-surface hinge table reads.
function genWingInto(def, out) {
  const S = def.spec, P = def.parts, N = def.nodes;
  const B = out.B, skin = out.skin, pitot = out.pitot, canopy = out.canopy;
  const CTRL_MESH = out.ctrl;
  // G185: WHICH PLANE. The loft reads its plane's own spec (W), its own spar
  // record (PP: stations, roots, ribs, chord law) and its own controls; a
  // monoplane's plane 0 reads exactly what it always read, so its emission
  // is byte-identical (GATE WINGSPLIT). `out.plane` picks the plane; the
  // second plane's control-surface groups carry a '2'.
  const kPl = out.plane | 0;
  const W = S.wings[kPl] || S.wings[0];
  const PP = (P.planes && P.planes[kPl]) || P;
  const semiK = kPl === 0 ? S.geom.semi : (PP.semi != null ? PP.semi : 0.5 * W.span);
  const CTL = kPl === 0 ? S.controls
            : (W.controls || { aileron: { span: 0, chord: 0.22 }, flap: { type: 'none', span: 0.5, chord: 0.2 } });
  const GSFX = kPl ? String(kPl + 1) : '';
  // ---- 3. wing --------------------------------------------------------
  // A section at every spar station, lofted along the span. Chordwise position
  // is affine on the two spar nodes (the spars ARE the chord frame, so the
  // weights are exact and extrapolate past LE and TE); the thickness offset is
  // a rest-frame constant, which is what `base` carries.
  const af = genAirfoil(W.naca);
  const sparF = PP.sparFront, sparR = PP.sparRear;
  const kOf = xc => (xc - sparF) / (sparR - sparF);
  // Hinge lines follow the chords the player actually set, so a 30% aileron
  // LOOKS like a 30% aileron. The flap band is inboard, the aileron outboard,
  // and clampSpec has already guaranteed the gap between them.
  const aStart = (1 - CTL.aileron.span) * semiK;
  const AIL_HINGE = 1 - CTL.aileron.chord;
  const FLAP_ON = GEN_FLAPS[CTL.flap.type].dCl > 0;
  const fEnd = FLAP_ON ? CTL.flap.span * semiK : -1;
  const FLAP_HINGE = 1 - CTL.flap.chord;
  // sidAt: which control surface this station belongs to, or 0. Outboard of
  // aStart is aileron, inboard of fEnd is flap; the hinge fraction differs
  // between them, so the caller passes both and the section picks per vertex.
  // A section from arbitrary spar POINTS with arbitrary influence lists, so a
  // row can sit between spar stations. The node weights are the chordwise blend
  // times the spanwise one, which is exactly what the loft was already doing at
  // the stations themselves — subdividing adds resolution on the same ruled
  // surface and moves no geometry.
  // `pts` is the chord-fraction contour to map — genAfSeg over whatever range
  // this piece needs. It USED to ignore its last argument and always map the
  // full aerofoil `af`, which is how the cut silently did nothing: the fixed
  // skin and the control surface were both built full-chord, so the aeroplane
  // grew a second wing that rotated. Measured: both spanned x -0.492..1.108.
  const wingSectionAt = (pF, pR, wF, wR, chord, pts) => {
    const ch = genV3.norm(genV3.sub(pR, pF));                 // LE -> TE
    // The section's thickness axis must point UP on BOTH wings. Deriving it
    // from the wing's own z sign flipped it on the left, so the aerofoil was
    // built upside down on one side — visible as a mirrored camber, and the
    // centre section came out twisted between the two.
    let nrm = genV3.norm(genV3.cross(ch, [0, 0, 1]));
    if (nrm[1] < 0) nrm = genV3.mul(nrm, -1);
    return (pts || af).map(([xc, yc]) => {
      const base = genV3.add(pF, genV3.mul(ch, (xc - sparF) * chord));
      const p = genV3.add(base, genV3.mul(nrm, yc * chord));
      const k = kOf(xc);
      const infl = [];
      for (const [i2, w2] of wF) if (w2 > 1e-6) infl.push([i2, (1 - k) * w2]);
      for (const [i2, w2] of wR) if (w2 > 1e-6) infl.push([i2, k * w2]);
      return { p, infl, u: xc };
    });
  };
  // `flip` reverses the winding. The left wing is the mirror of the right, so
  // the same index pattern traverses it the other way round and every triangle
  // ends up facing inward — the surface renders (materials are DoubleSide) but
  // computeVertexNormals then lights that whole wing from the wrong side.
  const wingSection = (nF, nR, chord) =>
    wingSectionAt(N[nF].p, N[nR].p, [[nF, 1]], [[nR, 1]], chord, af);

  // (plane 0's only — a biplane carries one pitot)
  if (kPl === 0) {
  // ---- 3a. PITOT MAST, on the wing's lower skin ------------------------
  // It hangs UNDER the wing, so its root has to be a point on the lower
  // SURFACE. It used to be a hardcoded 0.10 m below a front-spar NODE, and a
  // spar node is inside the wing: how far inside depends on the aerofoil's
  // thickness at that chord station, which moves with `naca`, `chord` and
  // taper. So the constant was right for exactly one aeroplane — thin the
  // section or lengthen the chord and the mast floated clear of the skin or
  // disappeared up into it.
  //
  // The fix is the same rule the glazing follows: put the part ON the emitted
  // surface rather than near it. `wingSectionAt` with a single lower-surface
  // point from the very evaluator the loft uses returns both the position and
  // the node weights, so the mast is attached by construction and flexes with
  // the wing instead of being fitted to it.
  {
    const i = Math.min(1, PP.wf.L.F.length - 1);
    const nF = PP.wf.L.F[i], nR = PP.wf.L.R[i];
    // chordwise station of the mast: well aft of the leading edge, so it is
    // clear of the LE radius and sits on a part of the section that is
    // genuinely flat-ish whatever the aerofoil
    const XC = 0.35;
    const chord = PP.chordAt(Math.abs(N[nF].p[2]));
    const root = wingSectionAt(N[nF].p, N[nR].p, [[nF, 1]], [[nR, 1]], chord,
                               [genAfEval(W.naca).lo(XC)])[0];
    // the mast drops a fixed distance below the skin, and the probe runs
    // forward from its foot into clean air ahead of the leading edge
    const DROP = 0.22, REACH = 0.24;
    const foot = [root.p[0], root.p[1] - DROP, root.p[2]];
    genTubeInto(pitot, root.p, foot, 0.010, 8, root.infl, B);
    genTubeInto(pitot, foot, [foot[0] - REACH, foot[1], foot[2]], 0.011, 8,
                root.infl, B);
  }
  }
  // the loft pair is module-level now (G67.1) so the wing can take them with
  // it and the empennage can go on using them; `B` is the only thing they
  // closed over, so it becomes the last argument and nothing else changes.
  const emitLoft = (rows, mesh, vOf, flip, close) =>
    genEmitLoft(rows, mesh, vOf, flip, close, B);
  const capLoft = genCapLoft;
  const TIP = GEN_TIPS[W.tip] || GEN_TIPS.rounded;
  // ---- 3b. the wing, and its control surfaces as SEPARATE MESHES ----------
  // The fixed skin is lofted over [0..hinge] and each surface over [hinge..1].
  // They are different groups, so a surface is a rigid body with a pivot and an
  // axis — the viewer turns the MESH. Nothing is deformed, so nothing outside
  // the surface can be dragged along by it (the rounded tip used to swing with
  // the aileron because it happened to carry the aileron's vertex tag).
  // chordwise points: fixed part / control surface. The fixed panels used
  // to loft at 9 while the centre carry-through lofts the full genAirfoil
  // contour at GEN_AF = 22 — a visible resolution cliff at the root rib
  // (user, G43: "make the wing as detailed as the center"). The panels
  // now match the centre's own sampling; the surfaces take the same
  // density over their ~0.3 chord. Display resolution only: the loft is
  // ruled on the same spar frames and the node weights are built the
  // same way, so nothing physical moves.
  const NAF = GEN_AF, NSURF = 7;
  for (const [side, fw] of [[1, PP.wf.R], [-1, PP.wf.L]]) {
    const sd = side > 0 ? 'R' : 'L';
    const zAll = [PP.zRoot, ...PP.zs];
    const zAilEnd = W.tipR > 1e-6 ? W.tipZ : zAll[zAll.length - 1];
    // which surface owns a station, and where its hinge is
    const bandAt = z => {
      if (z > aStart - 1e-6 && z < zAilEnd + 1e-6) return { n: 'ail', h: AIL_HINGE };
      if (FLAP_ON && z < fEnd + 1e-6 && z > PP.zRoot - 1e-6) return { n: 'flap', h: FLAP_HINGE };
      return null;
    };
    // spar frame at an arbitrary z, and a section over any chord range
    const frameAt = z => {
      let b2 = 0;
      while (b2 < zAll.length - 2 && z > zAll[b2 + 1]) b2++;
      const z0 = zAll[b2], z1 = zAll[b2 + 1];
      const t = Math.max(0, Math.min(1, (z - z0) / Math.max(1e-9, z1 - z0)));
      const F0 = fw.F[b2], F1 = fw.F[b2 + 1], R0 = fw.R[b2], R1 = fw.R[b2 + 1];
      const lerp = (a3, b3) => [a3[0] + (b3[0]-a3[0])*t, a3[1] + (b3[1]-a3[1])*t,
                                a3[2] + (b3[2]-a3[2])*t];
      return { pF: lerp(N[F0].p, N[F1].p), pR: lerp(N[R0].p, N[R1].p),
               wF: [[F0, 1-t], [F1, t]], wR: [[R0, 1-t], [R1, t]],
               chord: PP.chordAt(z) };
    };
    const secAt = (z, a, b, n) => {
      const f = frameAt(z);
      const row = wingSectionAt(f.pF, f.pR, f.wF, f.wR, f.chord, genAfSeg(W.naca, a, b, n));
      row.z0 = z;          // rows get duplicated at band ends, so carry the station
      return row;
    };
    // ---- station list: spar stations + surface edges, then subdivided ----
    const brk = zAll.slice();
    for (const zb of [fEnd, aStart, zAilEnd])
      if (zb > zAll[0] + 1e-3 && zb < zAll[zAll.length-1] - 1e-3) brk.push(zb);
    // EXTRA LOOP CUTS (G189, the user: "the lights within the wings are now
    // constrained to 1 spar length, it's too much, we should be able to set
    // it up much narrower, even if that means adding loop cuts to the
    // wing"). `W.cuts` is a list of spanwise stations (metres from the
    // centreline) the loft must put a row at — the lamp bay's two edges —
    // so a cut between two spar stations lands on real geometry instead of
    // snapping to the nearest existing row. A cut within 30 mm of a row the
    // loft already has snaps to that row rather than making a sliver strip.
    // Display topology only: the spars, ribs and node weights are the same.
    for (const zc of (Array.isArray(W.cuts) ? W.cuts : []))
      if (isFinite(zc) && zc > zAll[0] + 0.03 && zc < zAll[zAll.length-1] - 0.03
          && !brk.some(zb => Math.abs(zb - zc) < 0.03)) brk.push(zc);
    brk.sort((a2, b2) => a2 - b2);
    const zBrk = brk.filter((v, i) => i === 0 || v - brk[i-1] > 1e-3);
    const zStraight = W.tipR > 1e-6 ? W.tipZ : zAll[zAll.length - 1];
    const zEnd = zBrk.filter(v => v < zStraight - 1e-3).concat([zStraight]);
    const zs2 = [];
    for (let i = 0; i < zEnd.length - 1; i++)
      for (let sg = (i === 0 ? 0 : 1); sg <= GEN_WSEG; sg++)
        zs2.push(zEnd[i] + (zEnd[i+1] - zEnd[i]) * sg / GEN_WSEG);
    // THE BOW, stepped in angle (see G4.3): all curvature, no control surface
    if (W.tipR > 1e-6) {
      const nA = Math.max(2, TIP.arc | 0), thMax = (Math.PI/2) * 0.965;
      for (let i = 1; i <= nA; i++) zs2.push(W.tipZ + W.tipR * Math.sin(thMax * i / nA));
    }
    // ---- fixed skin: cut at the hinge wherever a surface lives ----
    const flip = side < 0;
    // EDGE LOOPS AT THE BAND ENDS. A cut row next to a full-chord row lofts as
    // a RAMP from the hinge line out to the trailing edge, so every band end
    // came out as a triangular wedge instead of a straight cut. (The root end
    // looked right only because the flap band starts at the first station and
    // has no neighbour to ramp from.) Emitting the boundary station TWICE —
    // once with each neighbour's chord range — turns that ramp into a
    // zero-width step, which is the vertical end wall of the cutout: the rib
    // face at the end of a real aileron.
    // The wall belongs to the station INSIDE the band (h !== 1), or the cutout
    // runs a subdivision past the surface that fills it — measured, a flap
    // ending at 2.50 left the wing open to 2.80.
    const hOf = z => { const b = bandAt(z); return b ? b.h : 1; };
    const fixRows = [];
    for (let i = 0; i < zs2.length; i++) {
      const z = zs2[i], h = hOf(z), inBand = Math.abs(h - 1) > 1e-9;
      const starts = inBand && i > 0 && Math.abs(hOf(zs2[i-1]) - h) > 1e-9;
      const ends = inBand && i < zs2.length - 1 && Math.abs(hOf(zs2[i+1]) - h) > 1e-9;
      // Each wall row is emitted TWICE. Rows do not share vertices, but a
      // single boundary row would be shared between the wall strip and the
      // skin strip beside it, and computeVertexNormals then averages a
      // near-vertical face into a near-horizontal one — the dark smear that
      // showed up on every cutout corner. Doubling the row gives the wall its
      // own vertices; the strip between the pair has zero area and so
      // contributes no normal at all.
      if (starts) {
        fixRows.push(secAt(z, 0, hOf(zs2[i-1]), NAF));
        fixRows.push(secAt(z, 0, hOf(zs2[i-1]), NAF));
      }
      fixRows.push(secAt(z, 0, h, NAF));
      if (starts || ends) fixRows.push(secAt(z, 0, h, NAF));
      if (ends) {
        fixRows.push(secAt(z, 0, hOf(zs2[i+1]), NAF));
        fixRows.push(secAt(z, 0, hOf(zs2[i+1]), NAF));
      }
    }
    if (TIP.fin > 0) {
      const h = TIP.fin * W.chord, last = fixRows[fixRows.length-1];
      fixRows.push(last.map(pt => ({ p: [pt.p[0], pt.p[1]+h, pt.p[2] - 0.22*h*side],
        infl: pt.infl, u: pt.u })));
    }
    // UV v is the TRUE span fraction, not the row index. Row-index v put the
    // paint's tip stripe wherever a loft happened to start, and once the
    // control surfaces became their own lofts each of them grew a stripe of its
    // own at its inboard end. Span fraction makes the paint continuous across
    // the cut, which is the point of cutting it there.
    const spanV = z => (z - PP.zRoot) / Math.max(1e-6, semiK - PP.zRoot);
    const ids = emitLoft(fixRows, skin, r => spanV(fixRows[r].z0), flip, true);
    capLoft([ids[0], ids[ids.length-1]], skin, flip);
    // ---- each surface: its own group, its own loft ----
    for (const [nm, gname, drive, sgnA, kA, drive2, sgn2] of [
      // da > 0 rolls right, which is right aileron DOWN (the solver raises that
      // wing's alpha). Signs re-measured after the cut became real: while the
      // "surface" was still a full-chord copy its centroid sat FORWARD of the
      // hinge, so every sign came out inverted and calibrated to the wrong body.
      ['ail',  'ail' + sd + GSFX,  'da', -1, 1.0, null, 0],
      ['flap', 'flap' + sd + GSFX, 'flap', -side, 0.70, null, 0],
    ]) {
      const zz = zs2.filter(z => { const b = bandAt(z); return b && b.n === nm; });
      if (zz.length < 2) continue;
      const hf = nm === 'ail' ? AIL_HINGE : FLAP_HINGE;
      const M = genMesh();
      const rows = zz.map(z => secAt(z, hf, 1, NSURF));
      const sIds = emitLoft(rows, M, r => spanV(zz[r]), flip, true);
      capLoft([sIds[0], sIds[sIds.length-1]], M, flip);
      // pivot on the hinge line at mid band, axis along it
      const zm = 0.5 * (zz[0] + zz[zz.length-1]);
      const hp = z => {
        const f = frameAt(z), E = genAfEval(W.naca);
        const u = E.up(hf), l = E.lo(hf), xc = 0.5*(u[0]+l[0]), yq = 0.5*(u[1]+l[1]);
        const ch = genV3.norm(genV3.sub(f.pR, f.pF));
        let nr = genV3.norm(genV3.cross(ch, [0,0,1])); if (nr[1] < 0) nr = genV3.mul(nr, -1);
        return genV3.add(genV3.add(f.pF, genV3.mul(ch, (xc - sparF) * f.chord)),
                         genV3.mul(nr, yq * f.chord));
      };
      const pA = hp(zz[0]), pB = hp(zz[zz.length-1]);
      CTRL_MESH.push({ group: gname, mesh: M, pivot: B(hp(zm)),
        axis: genV3.norm(genV3.sub(B(pB), B(pA))),
        drive, sgn: sgnA, k: kA, drive2, sgn2,
        infl: frameAt(zm).wF });
    }
  }
  // ---- centre section: the wing carries through above the cabin ----------
  // Three ways to build it, because on a high wing it IS the cabin roof.
  //   solid  the covering, as before
  //   glass  the same loft in the canopy's material - a skylight over the seats
  //   open   only the UPPER surface, so the wing's own top skin is the roof and
  //          you look up into it, which is what a Cub's centre section does
  {
    const CTR = (W.centre === 'glass' || W.centre === 'open'
                 || W.centre === 'cutout') ? W.centre : 'solid';
    // G185: 'cutout' — the centre section's trailing edge cut back to 62 %
    // chord over the cockpit, as a CLOSED section so the aft wall is the
    // flat rib face the hinge walls already use (emitLoft's `close`)
    const cutPts = CTR === 'cutout' ? genAfSeg(W.naca, 0, 0.62, GEN_AF) : null;
    let rows = cutPts
      ? [ wingSectionAt(N[PP.wf.L.F[0]].p, N[PP.wf.L.R[0]].p, [[PP.wf.L.F[0], 1]], [[PP.wf.L.R[0], 1]], W.chord, cutPts),
          wingSectionAt(N[PP.wf.R.F[0]].p, N[PP.wf.R.R[0]].p, [[PP.wf.R.F[0], 1]], [[PP.wf.R.R[0], 1]], W.chord, cutPts) ]
      : [
      wingSection(PP.wf.L.F[0], PP.wf.L.R[0], W.chord, 0),
      wingSection(PP.wf.R.F[0], PP.wf.R.R[0], W.chord, 0),
    ];
    // the carry-through IS the root: both rows sit at span fraction 0. Row
    // index put the tip band on one side of it and the wing walk on the other.
    // the aerofoil contour runs TE -> upper -> LE -> lower -> TE, so its first
    // half IS the upper surface and the cut needs no new sampling
    if (CTR === 'open') rows = rows.map(r => r.slice(0, Math.ceil(r.length / 2)));
    emitLoft(rows, CTR === 'glass' ? canopy : skin, () => 0.02, false, !!cutPts);
  }

  return { aStart, fEnd, FLAP_ON, FLAP_HINGE, AIL_HINGE, sparF };
}


// ---------------------------------------------------------------------------
// genWing(def) -> the WING ALONE, in the payload shape
// ---------------------------------------------------------------------------
// The standalone entry point G67.1 exists to create. `_cage_wing.js` used to
// call genSkin and throw away the whole aeroplane to keep the wing; the
// workshop's wing-on-trestles did the same. Both now ask for the wing.
//
// IT IS THE SAME CODE, so it is the same wing: this builds the meshes, hands
// them to genWingInto, and adds the LIFT STRUTS — which are not part of the
// wing block at all, because a strut is a beam and beams are drawn from the
// beam list. That is the one thing a caller would otherwise have had to know,
// and it is here so that nobody has to.
//
// The payload has genSkin's shape (v/generated/groups/moving/mats/rest), so
// anything that could read a wing out of a skin payload can read this one.
function genWing(def) {
  const S = def.spec, N = def.nodes;
  const FR = genRestFrame(def);
  const B = FR.to;
  const skin = genMesh(), canopy = genMesh(), pitot = genMesh(),
        liftstrut = genMesh(), cabane = genMesh(), interplane = genMesh(),
        wire = genMesh();
  const CTRL_MESH = [];
  genWingInto(def, { B, skin, pitot, canopy, ctrl: CTRL_MESH, plane: 0 });
  // G185: THE SECOND PLANE, into its own meshes — plane 0's groups are the
  // groups they always were, so a monoplane's payload is byte-identical
  const skin2 = genMesh(), canopy2 = genMesh();
  if (S.wings.length > 1 && def.parts.planes && def.parts.planes[1])
    genWingInto(def, { B, skin: skin2, pitot: genMesh(), canopy: canopy2, ctrl: CTRL_MESH, plane: 1 });
  // AN EXTERNAL WING BEAM IS A LIFT STRUT, and that is genSkin's own test
  // (`b.cls === 'wing' ? liftstrut : strut`, and only when `b.ext`). A leg is
  // never a wing beam and every wire 61_gen_frame emits is gear-class, so the
  // two branches this skips cannot reach here.
  for (const b of def.beams) {
    if (b.ext && b.cls === 'wing') genBeamInto(liftstrut, b, N, B);
    // G185: the truss, by class — each its own group so the editor and the
    // join can dress, paint and follow them separately
    else if (b.ext && b.cls === 'cabane') genBeamInto(cabane, b, N, B);
    else if (b.ext && b.cls === 'interplane') genBeamInto(interplane, b, N, B);
    else if (b.ext && b.cls === 'wire') genBeamInto(wire, b, N, B);
  }

  const groups = {};
  const put = (nm, M) => { const g = M.done(); if (g.nv) groups[nm] = g; };
  put('skin', skin); put('canopy', canopy);
  put('pitot', pitot); put('liftstrut', liftstrut);
  put('cabane', cabane); put('interplane', interplane); put('wire', wire);
  put('skin2', skin2); put('canopy2', canopy2);
  const moving = [];
  for (const c of CTRL_MESH) {
    put(c.group, c.mesh);
    if (!groups[c.group]) continue;
    moving.push({ group: c.group, p: c.pivot, ax: c.axis, infl: c.infl,
                  drive: c.drive, sgn: c.sgn, k: c.k,
                  drive2: c.drive2 || null, sgn2: c.sgn2 || 0 });
  }
  return {
    v: 5, generated: true, wingOnly: true,
    linTex: ['bump', 'mr'],
    cover: ['skin', 'canopy'].concat(groups.skin2 ? ['skin2', 'canopy2'] : [], moving.map(m => m.group)),
    groups, moving,
    mats: {
      skin: genPaintRow(S),
      ailR: genPaintRow(S), ailL: genPaintRow(S),
      flapR: genPaintRow(S), flapL: genPaintRow(S),
      canopy:    { color: 0xa9c6d6, opacity: 0.32, rough: 0.04, metal: 0.0 },
      // G185: the second plane's rows (same paint; the editor's livery
      // sections override per part)
      skin2: genPaintRow(S),
      ailR2: genPaintRow(S), ailL2: genPaintRow(S),
      flapR2: genPaintRow(S), flapL2: genPaintRow(S),
      canopy2:   { color: 0xa9c6d6, opacity: 0.32, rough: 0.04, metal: 0.0 },
      liftstrut: { color: 0xe6e2d8, rough: 0.30, metal: 0.10 },
      cabane:    { color: 0xe6e2d8, rough: 0.30, metal: 0.10 },
      interplane:{ color: 0xe6e2d8, rough: 0.30, metal: 0.10 },
      wire:      { color: 0x9aa0a6, rough: 0.35, metal: 0.80 },
      pitot:     { color: 0x7d8792, rough: 0.42, metal: 0.45 },
    },
    rest: (() => {
      const a = new Float32Array(N.length * 3);
      N.forEach((n, i) => { const b = B(n.p); a[i*3] = b[0]; a[i*3+1] = b[1]; a[i*3+2] = b[2]; });
      return a;
    })(),
  };
}

// ---------------------------------------------------------------------------
// THE LOFT PAIR. Lifted to module scope by G67.1 so the WING could leave this
// file with them: they were closures inside genSkin, and the only thing they
// closed over was the rest-frame transform, which is now the last argument.
// Not one line of the bodies changed — GATE WINGSPLIT is what says so.
//
// `close` wraps the last column back onto the first, which is what turns an
// open aerofoil contour into a closed tube — needed once a section is cut at
// a hinge, because then its ends no longer meet at a sharp trailing edge.
function genEmitLoft(rows, mesh, vOf, flip, close, B) {
  const ids = rows.map((row, r) => row.map(pt =>
    mesh.v(B(pt.p), pt.u, genUVPanel(vOf(r)), pt.infl, pt.sid)));
  for (let r = 0; r < ids.length - 1; r++) {
    const n = ids[r].length, last = close ? n : n - 1;
    for (let h = 0; h < last; h++) {
      const h2 = (h + 1) % n;
      if (flip) mesh.quad(ids[r][h], ids[r+1][h], ids[r+1][h2], ids[r][h2]);
      else      mesh.quad(ids[r][h], ids[r][h2], ids[r+1][h2], ids[r+1][h]);
    }
  }
  return ids;
}
function genCapLoft(ids, mesh, flip) {
  // close a section with a fan to its mid-chord point
  for (const row of ids) {
    const n = row.length;
    for (let h = 1; h < n - 1; h++)
      if (flip) mesh.tri(row[0], row[h+1], row[h]);
      else      mesh.tri(row[0], row[h], row[h+1]);
  }
}

// ---------------------------------------------------------------------------
// genSkin IS GONE (G67.1). It stood here for the whole garage arc and built
// the entire aeroplane: the fuselage covering, the glazing, the cowl, the
// engine, the wheels, the propeller, the seats, the dummies and the wing.
//
// The CAGE replaced every one of those except the wing, over G12-G61, and
// the wing is why this could not simply be deleted: `_cage_wing.js` built
// the wing of every cage build out of it. So the wing was lifted out first
// (genWingInto / genWing, above), measured against thirteen frozen wings by
// GATE WINGSPLIT, and only then was the rest removed.
//
// WHAT WENT WITH IT, so that nobody has to wonder later: the fuselage loft
// and its cockpit cut, the side lights and windows, the coaming and dash,
// the registration DECAL group (G69 made a marking a metric read in the
// shader instead), the engine bay and cowl, the empennage, the wheels,
// tyres, hubs and fairings, the propeller, spinner and painted tips, the
// interior liner, the seats and belts, and the occupant. Every one of those
// is now built by a cage layer with its own bench and, since G67.1, its own
// gate: CAGEFIT, FIN, COWL, ENGMESH, JOIN.
//
// The pre-split file is kept whole at earlierVersions/63_gen_skin-preG67.1.js
// and in git history. Nothing reads it.
// ---------------------------------------------------------------------------

// Pose a generated skin: rigid mount is the group matrix (as for any model);
// this adds the structural delta, exactly parallel to applySkinDeform.
//   pos = base + SUM w_i * (node_i_body - node_i_rest_body)
// `hinged` verts already have their hinge-rotated position in `pos`, so the
// delta is ADDED rather than written, same contract as the imported path.
function poseSkinGen(g, rest, live, base, pos, gain, hinged) {
  const { wi, ww, nv } = g;
  for (let v = 0; v < nv; v++) {
    let dx = 0, dy = 0, dz = 0;
    for (let k = 0; k < GEN_INFL; k++) {
      const o = v * GEN_INFL + k, w = ww[o];
      if (w === 0) continue;
      const i3 = wi[o] * 3;
      dx += w * (live[i3] - rest[i3]);
      dy += w * (live[i3+1] - rest[i3+1]);
      dz += w * (live[i3+2] - rest[i3+2]);
    }
    dx *= gain; dy *= gain; dz *= gain;
    const o3 = v * 3;
    if (hinged && hinged[v]) { pos[o3] += dx; pos[o3+1] += dy; pos[o3+2] += dz; }
    else { pos[o3] = base[o3] + dx; pos[o3+1] = base[o3+1] + dy; pos[o3+2] = base[o3+2] + dz; }
  }
}

// Live node positions in the body frame, for poseSkinGen. Mirrors the codec's
// sparDeltas: same axes, same STRUCTURAL origin (G179: sim.bodyOrigin, the
// firewall ring — not the mass centre, which a sagging engine or a draining
// tank moves against the structure and every bound vertex moved with).
// `o` is the constant that puts the origin back on the point the gen mesh is
// authored about (genRestFrame's design CG, see the viewer's oNode): the
// mesh and its `rest` stay where they were authored, and `live - rest` is a
// delta measured from the firewall.
function genNodeBody(sim, out, o) {
  const cg = sim.bodyOrigin(), [xA, yU] = sim.axes();
  const ox = o ? o[0] : 0, oy = o ? o[1] : 0, oz = o ? o[2] : 0;
  const zL = [xA[1]*yU[2]-xA[2]*yU[1], xA[2]*yU[0]-xA[0]*yU[2], xA[0]*yU[1]-xA[1]*yU[0]];
  for (let i = 0; i < sim.n; i++) {
    const dx = sim.p[i*3]-cg[0], dy = sim.p[i*3+1]-cg[1], dz = sim.p[i*3+2]-cg[2];
    out[i*3]   = dx*xA[0]+dy*xA[1]+dz*xA[2] + ox;
    out[i*3+1] = dx*yU[0]+dy*yU[1]+dz*yU[2] + oy;
    out[i*3+2] = dx*zL[0]+dy*zL[1]+dz*zL[2] + oz;
  }
  return out;
}
