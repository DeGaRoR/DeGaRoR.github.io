// ============================================================
// GARAGE 4/5 — the SKIN. The same lattice, covered.
//
// The frame IS the surface. Every skin vertex is an affine blend of the truss
// nodes it sits on (weights summing to 1), so the covering follows the
// structure exactly and there is nothing to calibrate: SKIN_CFG's measured
// mount offset, which every imported model needs, is [0,0,0] here by
// construction. It also gets fuselage flex for free — SKIN-PROC.md §6 lists
// that as deferred for imported skins, because binding a foreign mesh to a
// truss is the hard part. Generating the mesh from the truss makes it trivial.
//
// The one thing a bare truss cannot do is a round cowl or a turtledeck: its
// faces are flat. The fix is the real construction technique — light
// non-structural FORMERS over the load-carrying frame. `crown` blends each
// station's section from the bare truss rectangle (0) to a rounded former
// outline (1). Formers carry no load and no mass in the solver; their vertices
// are still affine on the same four corner nodes, so they flex with the frame.
//
// Output is the shape decodeModel() returns, so src/viewer/app.js builds it
// with the code path it already has.
// ============================================================

// how far inside the covering the liner sits. Big enough that no pair of faces
// z-fights at any camera distance, small enough that the wall never reads as a
// thickness: 18 mm on an aeroplane whose fuselage is a metre across.
const INTR_T = 0.018;
const GEN_TUBE_R = { fus: 0.016, wing: 0.020, gear: 0.024 };
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

// Station cross-section: blend from the bare truss rectangle to a rounded
// former. theta 0 = top, +pi/2 = +z side, pi = bottom.
// crownT applies at the top and fades to crownS by the sides — a step between
// upper and lower halves leaves a visible kink right along the waterline, which
// is exactly where the eye reads a fuselage's shape.
function genRing(theta, halfW, halfD, crownT, crownS) {
  const cy = Math.cos(theta), cz = Math.sin(theta);
  const s = Math.min(halfD / Math.max(1e-6, Math.abs(cy)), halfW / Math.max(1e-6, Math.abs(cz)));
  const ry = cy * s, rz = cz * s;                       // truss rectangle
  const crown = crownS + (crownT - crownS) * Math.max(0, cy);
  const k = 1 + 0.15 * crown;                           // formers stand a little proud
  const ey = halfD * cy * k, ez = halfW * cz * k;       // rounded former
  return [ry + (ey - ry) * crown, rz + (ez - rz) * crown];
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

// ---------------------------------------------------------------------------
// genSkin(def) -> payload in the decodeModel shape, plus per-vertex bindings.
// ---------------------------------------------------------------------------
function genSkin(def) {
  const S = def.spec, P = def.parts, N = def.nodes;
  const FR = genRestFrame(def);
  const B = FR.to;
  // every control surface mesh, wing and tail alike: {group, pivot, axis, drive}
  const CTRL_MESH = [];
  const skin = genMesh(), frame = genMesh(), strut = genMesh(), decal = genMesh(),
        tyre = genMesh(), prop = genMesh(), hubM = genMesh(),
        // the suspension leg's rubber, which is not painted with the leg
        rubber = genMesh(),
        cowl = genMesh(), engine = genMesh(),
        // glazing: pane, cabin interior behind it, and the frame bars
        glass = genMesh(), gcabin = genMesh(), gframe = genMesh(),
        exhaust = genMesh(),
        // the coaming and the instrument panel, off the windscreen fit line
        dash = genMesh(),
        // the INSIDE of the covering — the same rows, stepped inward
        intr = genMesh(),
        liftstrut = genMesh(),
        // the pitot mast is its OWN group because it is the one part of the
        // aeroplane that is deliberately ONE-SIDED. Left in with the struts it
        // made the whole strut group fail GATE GEN's mirror check, and the
        // honest fix is to keep the symmetric hardware checkable rather than to
        // exempt it along with the mast.
        pitot = genMesh(),
        // the canopy shell: glazed panes, the shell itself, its frame, and the
        // opaque sunscreen roof over the top of it
        glazed = genMesh(), canopy = genMesh(), cframe = genMesh(), ctop = genMesh(),
        // seats — cushion, piping, tube frame
        seat = genMesh(), spipe = genMesh(), sframe = genMesh(),
        // the occupant: limbs, joints, extremities, and the harness
        dumm = genMesh(), dumj = genMesh(), dumk = genMesh(),
        belt = genMesh(), buckle = genMesh();
  const w1 = i => [[i, 1]];

  // ---- 1. tubes: one prism per beam -----------------------------------
  // A beam is not one kind of thing, and it is `vis` and `cls` (61_gen_frame.js)
  // that say which — what a member IS, which the solver has no opinion about.
  // Four treatments, in this order:
  //   leg    the suspension, drawn as the hardware the spec bought, with its
  //          own rubber. It is not a prism at all, so it is handled first and
  //          leaves the loop.
  //   wire   a wire is drawn as a wire: 9 mm across, still about twice a real
  //          tie rod so it reads at distance, but 12 mm left the tailwheel
  //          looking braced by scaffolding poles.
  //   strut  an EXTERNAL LIFT STRUT gets GEN_STRUT_SECT with its chord
  //          fore-and-aft — that is what a lift strut is, and the round bar it
  //          replaces is what made the bracing read as scaffolding.
  //   tube   everything else, round, at 8 sides rather than 6: a hex bar shows
  //          its flats wherever a highlight crosses it.
  // Both ends are CAPPED — computeVertexNormals has no face to average at an
  // open rim, so every tube end used to go dark.
  const rGear = GEN_TUBE_R.gear * 1.15;    // what an external gear tube measures
  for (const b of def.beams) {
    if (b.vis === 'leg') {
      genGearLegInto(strut, rubber, N[b.a].p, N[b.b].p,
                     S.gear.suspension, rGear, b.a, b.b, B);
      continue;
    }
    const M = !b.ext ? frame : (b.cls === 'wing' ? liftstrut : strut);
    const A = N[b.a].p, C = N[b.b].p;
    const ax = genV3.norm(genV3.sub(C, A));
    const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
    // 9 mm across for a wire: still about twice a real tie rod, so it reads at
    // distance, but 12 mm left the tailwheel looking braced by scaffolding poles
    const r = b.vis === 'wire' ? 0.0045 : GEN_TUBE_R[b.cls] * (b.ext ? 1.15 : 1);
    // Only a wing's external member is a lift strut. Every `vis === 'wire'` beam
    // 61_gen_frame.js emits is `cls: 'gear'`, so no wire reaches this branch.
    const lift = b.ext && b.cls === 'wing';
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

  // ---- 2. fuselage covering -------------------------------------------
  // Every section vertex is BILINEAR on that ring's four truss corners, in the
  // ring's own normalised (uz, uy). A former that stands proud of the truss has
  // |u| > 1 and simply extrapolates — same weights, no special case.
  const ST = P.ST, F = P.F, fu = S.fuse;
  // WINDOW CUTOUTS ARE OUT for now (user, G1.7). The glazing that was here cut
  // real holes in the covering, and at this vertex budget a hole reads as a
  // missing panel rather than a window. When it comes back it should be a
  // painted pane on a solid surface, or a separate inset frame — not a hole.
  //
  // One section per lengthwise slice; a slice between two frames blends both.
  // The TOP line of bay 0 is special: it holds the cowl deck level and then
  // steps up to the cabin roof over `windRun`, which is the windscreen.
  const WSC = genClamp(S.cab.canopy && S.cab.canopy.wsCurve != null ? S.cab.canopy.wsCurve : 0, -1, 1);
  const bay0 = Math.max(1e-6, ST[1].x - ST[0].x);
  // THE WINDSCREEN ANGLE (user: "we have the angle of the windshield as a param in
  // the sim, I need it here too"). The fuselage's step and the canopy's front rake
  // have to be the SAME line, or a small canopy shows the body's abrupt step
  // running out of a gentle shell — which is the discontinuity at height 0. So the
  // run is derived from an ANGLE: run = step / tan(angle), and the body's own
  // windscreen is stretched to match whatever the canopy asks for. `windRun` stays
  // the fallback, and its own angle is what the default reproduces.
  const wsStep = Math.max(0.02, S.cab.h * (1 - fu.cowlDeck));
  const wsAng = (S.cabin.canopy && S.cabin.canopy.wsAngle) ||
                (Math.atan2(wsStep, Math.max(0.02, fu.windRun)) * 180 / Math.PI);
  const wsRun = Math.max(0.08, wsStep / Math.tan(genClamp(wsAng, 22, 80) * Math.PI / 180));
  const windFrac = Math.min(0.95, wsRun / bay0);
  const smooth = (e0, e1, x) => {
    const t = Math.max(0, Math.min(1, (x - e0) / Math.max(1e-6, e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  // A body interpolated LINEARLY between stations has a crease at every frame:
  // a chain of facets down the turtledeck and a visible kink where the taper
  // starts, which is most of what made the generated fuselage read as low-poly.
  // Catmull-Rom through the station values smooths it, and every sample is
  // CLAMPED to its own bay's two stations so the curve cannot overshoot into a
  // bulge behind the cabin — the pinned stations still land exactly on the
  // truss, so the covering is as affine on the frame nodes as it ever was.
  const crAt = (key, i, s) => {
    const g = j => ST[Math.max(0, Math.min(ST.length - 1, j))][key];
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2), t = s;
    const v = p1 + 0.5 * t * (p2 - p0) + 0.5 * t * t * (2*p0 - 5*p1 + 4*p2 - p3)
                 + 0.5 * t * t * t * (-p0 + 3*p1 - 3*p2 + p3);
    return Math.max(Math.min(p1, p2), Math.min(Math.max(p1, p2), v));
  };
  const section = (i, s) => {
    const A = ST[i], C = ST[Math.min(i + 1, ST.length - 1)];
    const L = (a, b) => a + (b - a) * s;
    // ahead of the cabin the deck is FLAT, then the windscreen rises — bay 0
    // stays linear on purpose: its top line is a designed step, not a curve.
    // WINDSCREEN CURVATURE. The step's profile was a fixed smoothstep, which
    // puts its middle vertices exactly on the S-curve and reads as a bulge. The
    // knob moves that middle line: >0 pulls it up (the screen bellies FORWARD,
    // convex), <0 holds it down and turns up late (concave, the hollow-raked
    // screen of a Cub). 0 is the old smoothstep, so a spec that does not set it
    // is unchanged.
    const st = i === 0 ? (() => {
      const t = Math.max(0, Math.min(1, (s - (1 - windFrac)) / Math.max(1e-6, windFrac)));
      const e = smooth(0, 1, t);
      const p = Math.pow(t, Math.pow(2, -2 * WSC));
      return WSC >= 0 ? e + (p - e) * WSC : e + (p - e) * -WSC;
    })() : s;
    return { x: L(A.x, C.x),
             w:  i === 0 ? L(A.w, C.w)  : crAt('w', i, s),
             yb: i === 0 ? L(A.yb, C.yb) : crAt('yb', i, s),
             yt: i === 0 ? A.yt + (C.yt - A.yt) * st : crAt('yt', i, s) };
  };
  const sectionRow = (i, s) => {
    const g = section(i, s), fA = F[i], fB = F[Math.min(i + 1, F.length - 1)];
    const yc = 0.5 * (g.yb + g.yt), hD = 0.5 * (g.yt - g.yb);
    const row = [];
    for (let h = 0; h <= GEN_RADIAL; h++) {
      const th = 2 * Math.PI * (h % GEN_RADIAL) / GEN_RADIAL;
      const [dy, dz] = genRing(th, g.w, hD, fu.crownTop, fu.crownSide);
      const uz = dz / Math.max(1e-6, g.w), uy = dy / Math.max(1e-6, hD);
      const wL = 0.5*(1-uz), wR = 0.5*(1+uz), wT = 0.5*(1+uy), wBo = 0.5*(1-uy);
      const kA = 1 - s, kB = s;
      row.push({ p: [g.x, yc + dy, dz], u: h / GEN_RADIAL, vv: genUVBody(g.x / Math.max(1e-6, fu.postX)),
        infl: [[fA.TL, kA*wT*wL], [fA.TR, kA*wT*wR], [fA.BL, kA*wBo*wL], [fA.BR, kA*wBo*wR],
               [fB.TL, kB*wT*wL], [fB.TR, kB*wT*wR], [fB.BL, kB*wBo*wL], [fB.BR, kB*wBo*wR]] });
    }
    return row;
  };
  const emitRow = (row, M) => row.map(pt => M.v(B(pt.p), pt.u, pt.vv, pt.infl));
  // ---- THE COCKPIT CUT -------------------------------------------------
  // A canopy is not a lid laid on a closed fuselage: the covering STOPS at a
  // sill line over the cabin, and the canopy closes the body from there up. So
  // the cut is made HERE, in the covering loop, and the shell below is lofted
  // off the very ring points the cut leaves behind — same x, same y, same z,
  // same node weights — which is why there is no gap and nothing to z-fight.
  // The opening is cut ALONG THE EXISTING TOPOLOGY: whole quads, on ring
  // vertices, between two whole section rows. So its boundary is a known
  // polyline — two sill lines of ring vertices and two end arcs — and the
  // canopy is lofted onto THAT polyline rather than fitted near it. Nothing is
  // evaluated twice: the shell reads the fuselage's own emitted vertices.
  const CN = S.cabin.canopy;
  const CANOPY = ['windshield', 'bubble', 'greenhouse'].includes(S.cabin.glazing)
                 && S.seating !== 'drone' && F.length > 2;
  // THE SILL IS A RING INDEX, and it is one on purpose (user: the plane-based
  // cut "makes it look ugly"). A constant index is a constant angle round the
  // section, which on a straight-sided body IS a straight line, and it always
  // lands exactly on ring vertices — that snap is what makes the seam exact
  // rather than nearly exact, and exact seams are what keep GATE GEN's
  // skin/structure coherence green by construction.
  //
  // It was a height plane for a while, and the transfer spec still documents it
  // as one. Do not "fix" it back: that version was rejected after being looked
  // at. Being an index is also why GEN_RADIAL sets how finely the sill can be
  // placed — at 20 the slider reaches half as many positions.
  //
  // One value for the whole opening, so the coaming below cannot describe a
  // different line from the cut above: two functions describing one line drift.
  const hSill = Math.max(1, Math.min(GEN_RADIAL / 2 - 2,
                Math.round(CN.sill * GEN_RADIAL / 2)));
  // every slice's station, in the same enumeration the covering loop uses:
  // slice k = frame (k / GEN_LSEG), so k indexes bodyRows directly
  const NSLICE = (F.length - 1) * GEN_LSEG;
  const sliceX = [];
  for (let k = 0; k <= NSLICE; k++) {
    const i = Math.min(F.length - 2, Math.floor(k / GEN_LSEG));
    sliceX.push(section(i, (k - i * GEN_LSEG) / GEN_LSEG).x);
  }
  const wsX = ST[1].x - wsRun;
  // WHERE THE CANOPY STARTS. Not at the windscreen — the fuselage already OWNS
  // its windscreen (the step in the deck line over `windRun`), and cutting the
  // opening forward of the cabin-front frame put the shell's leading rows on the
  // low, narrow cowl-deck section: they then had to climb the whole step, and a
  // dome climbing a step balloons. That is the cartoon nose. So the canopy sits
  // over the CABIN and the fuselage's own windscreen runs up to meet it.
  // A windshield-only build is the opposite case by definition: it covers
  // exactly that step and nothing else.
  const cx0 = CN.x0 == null ? wsX : CN.x0;
  // WHERE THE WINDOW ENDS. `x1` is resolved in 60_gen_spec.js's resolveSpec,
  // from `cabin.canopy.reach` as a FRACTION of the cabin — so it is never null
  // here, and it tracks a cabin-length change instead of being left behind by
  // one. What stays here is the only part that belongs here: the tailpost is a
  // property of the FRAME, not of the spec, so the safety clamp against running
  // the window off the back of the body is applied where postX is known.
  const cx1 = S.cabin.glazing === 'windshield' ? ST[1].x
                                              : Math.min(fu.postX * 0.92, CN.x1);
  // snap the window to slice boundaries: a partial slice would be a staircase
  const nearestSlice = x => {
    let b = 0, bd = 1e9;
    sliceX.forEach((v, k) => { const d = Math.abs(v - x); if (d < bd) { bd = d; b = k; } });
    return b;
  };
  let kCut0 = nearestSlice(cx0), kCut1 = nearestSlice(cx1);
  if (kCut1 <= kCut0) kCut1 = Math.min(NSLICE, kCut0 + 1);
  // THE JOINT, as a STEPPED CUT (user: "an option for a joint like the one I drew
  // in green ... to avoid the little dent downward"; "it's ok if it's stepped to
  // match the topology"). Without it the opening runs at full sill depth from its
  // very first station, so the front bow has to dive the whole depth in one slice
  // and the corner where it lands on the sill rail comes to a downward point.
  // With it the cut starts shallower and deepens one ring index per slice, which
  // is a chamfer built out of the topology the mesh already has. The shell reads
  // the same per-strip depth, so the seam stays exact by the same argument as
  // before: every boundary vertex is still a ring vertex or a point between two.
  const JSTEP = 0;
  // per-STRIP cut depth: the shallower of the two rows it spans, so the covering
  // is never removed where one end of the strip is still below the sill plane.
  // ---- THE CORNER JOINT ------------------------------------------------
  // Where the opening ENDS, its edge turns a right angle: the end bow drops the
  // full sill depth at one station while the sill line runs away aft. That corner
  // is a downward spike, and no amount of rail smoothing hides it — it is the
  // shape of the hole, not the shape of the frame.
  //
  //   'square'  the corner as it is: a vertical end, a horizontal sill.
  //   'chamfer' the corner cut off on a straight diagonal.
  //
  // The chamfer is exact, and this is the whole trick: the depth is ramped by
  // EXACTLY ONE ring index per slice over the last `jointRun` indices, so in every
  // transition cell the opening's edge runs corner-to-corner. A quad whose edge
  // runs corner to corner is two triangles, one of which is covering and one of
  // which is hole — so the diagonal is drawn by SPLITTING the cell, not by adding
  // a vertex to it. Every vertex on the joint is still one of the body's own ring
  // vertices, which is what keeps the seam exact and the node weights valid.
  // (A ramp of more than one index per slice cannot be done this way: the covered
  // part of the cell becomes a trapezoid, and cutting one needs a vertex that is
  // not on the ring. That is why the run is in INDICES and the ramp is unit.)
  const CHAM = CN.joint === 'chamfer';
  const JRUN = Math.max(1, Math.min(8, Math.round(CN.jointRun == null ? 3 : CN.jointRun)));
  const dRowAt = (row, k) => {
    const d = hSill;
    if (!CHAM) return d;
    const e = Math.min(k - kCut0, kCut1 - k);        // slices from the nearer end
    return Math.max(1, Math.min(d, d - JRUN + e));
  };
  const bodyRows = [];          // kept for the registration decal, below
  const sideQuads = [];
  // ---- SIDE LIGHTS, as a band of the SAME cut ---------------------------
  // A side window is not a patch and not a route: it is the canopy's own cut kept
  // at the waistline. The band runs between two height planes (so its edges are
  // straight lines, like the sill), from the windscreen station to the cabin rear
  // — in line with the windscreen, which is the only thing it is meant to be
  // combined with. The quads are RECORDED here and rebuilt as glass off the very
  // same ring vertices, so there is no second surface to fit.
  const SIDEW = !!CN.sides && S.seating !== 'drone' && F.length > 2;
  // A GAP between the windscreen and the side lights: on a real aeroplane there is
  // a door post there, and butting the two together read as one long slot.
  const sideGap = genClamp(CN.sideGap == null ? 0.10 : CN.sideGap, 0, 0.6);
  const kSide0 = SIDEW ? nearestSlice(ST[1].x + sideGap) : -1;
  const kSide1 = SIDEW ? nearestSlice(ST[1].x + sideGap + (fu.postX - ST[1].x) * 0.62
                   * genClamp(CN.sideReach == null ? 1 : CN.sideReach, 0.1, 1)) : -1;
  // the band, in RING INDICES like the sill: top edge and depth both snap, so
  // both edges are ring lines and the sliders move them a whole segment at a time
  const hSideT = Math.max(1, Math.round(genClamp(CN.sideTop == null ? 0.34 : CN.sideTop,
                          0.05, 0.75) * GEN_RADIAL / 2));
  const hSideB = Math.min(GEN_RADIAL / 2 - 1, hSideT + Math.max(1,
                   Math.round((0.06 + 0.30 * genClamp(CN.sideDepth == null ? 0.5
                     : CN.sideDepth, 0, 1)) * GEN_RADIAL / 2)));
  let lastFusRow = null;
  for (let i = 0; i < F.length - 1; i++) {
    for (let sg = 0; sg < GEN_LSEG; sg++) {
      // reuse the previous slice's row rather than emitting a coincident one:
      // duplicate vertices split the normal average and crease the fuselage
      const rowA = lastFusRow || sectionRow(i, sg / GEN_LSEG);
      const rowB = sectionRow(i, (sg + 1) / GEN_LSEG);
      const aS = rowA.ids || emitRow(rowA, skin), bS = emitRow(rowB, skin);
      rowA.ids = aS; rowB.ids = bS;
      // ---- THE INSIDE, as the same rows stepped inward ----------------
      // A covering has two faces and only one is modelled; a single-sided shell
      // seen from within is a lit exterior with its normals pointing away, which
      // is what makes an open cockpit read as a hole rather than a cabin. So the
      // same ring vertices are emitted a second time, walked in along their own
      // radial by INTR_T and wound the other way round. Same eight node weights,
      // so the liner flexes with the covering exactly and can never part from it;
      // the step is a rendering separation, not a structure.
      //
      // TWO MAPPING AREAS, because the two halves of an aeroplane's inside are
      // trimmed by different trades: stations inside the cabin take the cabin
      // zone of the sheet, everything else the fuselage zone. One material.
      const inRow = row => {
        if (row.iids) return row.iids;
        let yLo = 1e9, yHi = -1e9;
        for (let h = 0; h < GEN_RADIAL; h++) {
          yLo = Math.min(yLo, row[h].p[1]); yHi = Math.max(yHi, row[h].p[1]);
        }
        const yc = 0.5 * (yLo + yHi), xr = row[0].p[0];
        const cabZone = xr > S.cab.noseGap - 0.02 && xr < fu.boxRear + 0.02;
        const t = cabZone
          ? (xr - S.cab.noseGap) / Math.max(1e-6, fu.boxRear - S.cab.noseGap)
          : xr / Math.max(1e-6, fu.postX);
        const vv = cabZone ? genUVPanel(t) : genUVBody(t);
        return row.iids = row.map(pt => {
          const n = genV3.norm([0, pt.p[1] - yc, pt.p[2]]);
          return intr.v(B([pt.p[0] - n[0] * INTR_T, pt.p[1] - n[1] * INTR_T,
                           pt.p[2] - n[2] * INTR_T]), pt.u, vv, pt.infl);
        });
      };
      const aI = inRow(rowA), bI = inRow(rowB);
      const kSlice = i * GEN_LSEG + sg;         // this strip runs k -> k+1
      const cut = CANOPY && kSlice >= kCut0 && kSlice < kCut1;
      const dA = cut ? dRowAt(rowA, kSlice) : 0, dB = cut ? dRowAt(rowB, kSlice + 1) : 0;
      const step1 = Math.abs(dA - dB) === 1;         // the only case a cell splits
      const dsL = cut ? Math.min(dA, dB) : 0;      const sideOn = SIDEW && kSlice >= kSide0 && kSlice < kSide1 && !cut;      const bT = hSideT;      const bB = hSideB;
      for (let h = 0; h < GEN_RADIAL; h++) {
        // the opening: everything within thSill of the top is simply not
        // covered over the cockpit stations
        if (cut) {
          // j is the cell's depth from the crown on ITS OWN side, so one test
          // serves both sides of the opening
          const j = h < GEN_RADIAL / 2 ? h : GEN_RADIAL - 1 - h;
          const cA = j >= dA, cB = j >= dB;
          if (!cA && !cB) continue;                  // hole
          if (cA !== cB) {
            if (!step1) { if (j < dsL) continue; }   // fall back: leave it covered
            else {
              // the split. Which triangle is covering depends on which row is
              // deeper AND which side of the aeroplane this is — the far side's
              // ring indices run the other way, so its diagonal is the other one.
              const near = h < GEN_RADIAL / 2;
              const A0 = aS[h], A1 = aS[h+1], B1 = bS[h+1], B0 = bS[h];
              const I0 = aI[h], I1 = aI[h+1], J1 = bI[h+1], J0 = bI[h];
              if (cA) {
                if (near) { skin.tri(A0, A1, B1); intr.tri(J1, I1, I0); }
                else      { skin.tri(A0, A1, B0); intr.tri(J0, I1, I0); }
              } else {
                if (near) { skin.tri(A1, B1, B0); intr.tri(J0, J1, I1); }
                else      { skin.tri(A0, B1, B0); intr.tri(J0, J1, I0); }
              }
              continue;
            }
          }
        }
        if (sideOn && bB > bT) {
          const hm = GEN_RADIAL - h - 1;
          const inBand = (h >= bT && h < bB) || (hm >= bT && hm < bB);
          if (inBand) {
            const hi = (h >= bT && h < bB) ? h : hm;
            sideQuads.push({
              a0: rowA[h], a1: rowA[h+1], b0: rowB[h], b1: rowB[h+1],
              ka0: kSlice + '_' + h, ka1: kSlice + '_' + (h+1),
              kb0: (kSlice+1) + '_' + h, kb1: (kSlice+1) + '_' + (h+1),
              // which of the four edges is on the window's boundary, so the rail
              // frames the light instead of drawing a grid over it
              edgeLo: hi === bB - 1, edgeHi: hi === bT,
              edgeF: kSlice === kSide0, edgeA: kSlice === kSide1 - 1,
              mirror: hi === hm,
            });
            continue;
          }
        }
        skin.quad(aS[h], aS[h+1], bS[h+1], bS[h]);
        // reversed, so the liner faces into the cabin
        intr.quad(aI[h], bI[h], bI[h+1], aI[h+1]);
      }
      if (!bodyRows.length) bodyRows.push(rowA);
      bodyRows.push(rowB);
      lastFusRow = rowB;
    }
  }

  // ---- 2d. GLAZING ----------------------------------------------------
  // Windows are back, and not as holes (see the note above). Each pane is a
  // CONFORMING PATCH of the body's own surface — same section machinery, so it
  // follows whatever shape the sliders make — in three layers a few millimetres
  // apart along the local normal: a near-black interior, the glass over it, and
  // a frame border proud of both. A hole would need the covering
  // re-topologised and reads as a missing panel at this vertex budget; three
  // sheets read as a window from every angle and cost nothing structurally,
  // because every vertex is still an affine blend of the same four frame nodes.
  //
  // This is the biggest single item in the look pass: an aeroplane with no
  // glazing is a shape, and an aeroplane with glazing is a machine somebody
  // sits in.
  const bodySurf = (gi, th) => {
    const i = Math.max(0, Math.min(F.length - 2, Math.floor(gi)));
    const s = Math.max(0, Math.min(1, gi - i));
    const gm = section(i, s), fA = F[i], fB = F[i + 1];
    const yc = 0.5 * (gm.yb + gm.yt), hD = 0.5 * (gm.yt - gm.yb);
    const [dy, dz] = genRing(th, gm.w, hD, fu.crownTop, fu.crownSide);
    const uz = dz / Math.max(1e-6, gm.w), uy = dy / Math.max(1e-6, hD);
    const wL = 0.5*(1-uz), wR = 0.5*(1+uz), wT = 0.5*(1+uy), wBo = 0.5*(1-uy);
    const kA = 1 - s, kB = s;
    return { p: [gm.x, yc + dy, dz], rad: genV3.norm([0, dy, dz]),
      infl: [[fA.TL, kA*wT*wL], [fA.TR, kA*wT*wR], [fA.BL, kA*wBo*wL], [fA.BR, kA*wBo*wR],
             [fB.TL, kB*wT*wL], [fB.TR, kB*wT*wR], [fB.BL, kB*wBo*wL], [fB.BR, kB*wBo*wR]] };
  };
  // A patch lifted along its OWN geometric normal, not along the ring radius:
  // the windscreen is a near-vertical step, so a radial lift would slide the
  // pane up the glass instead of off the skin and the layers would z-fight.
  // The winding is measured against that normal too — a mirrored pane walks its
  // parameters the other way round and would otherwise be lit from inside.
  const bodyPatch = (M, g0, g1, t0, t1, ng, nt, lift) => {
    const eg = (g1 - g0) / Math.max(1, ng) * 0.25;
    const et = (t1 - t0) / Math.max(1, nt) * 0.25;
    const gs = [];
    for (let a = 0; a <= ng; a++) {
      const row = [];
      for (let k = 0; k <= nt; k++) {
        const gg = g0 + (g1 - g0) * a / ng, th = t0 + (t1 - t0) * k / nt;
        const P0 = bodySurf(gg, th), Pa = bodySurf(gg + eg, th), Pb = bodySurf(gg, th + et);
        let n = genV3.norm(genV3.cross(genV3.sub(Pa.p, P0.p), genV3.sub(Pb.p, P0.p)));
        if (n[0]*P0.rad[0] + n[1]*P0.rad[1] + n[2]*P0.rad[2] < 0) n = genV3.mul(n, -1);
        row.push({ p: genV3.add(P0.p, genV3.mul(n, lift || 0)), n,
                   infl: P0.infl, u: a / ng, v: k / nt });
      }
      gs.push(row);
    }
    const A0 = gs[0][0], A1 = gs[Math.min(1, gs.length - 1)][0];
    const A2 = gs[0][Math.min(1, gs[0].length - 1)];
    const nn = genV3.cross(genV3.sub(A1.p, A0.p), genV3.sub(A2.p, A0.p));
    const flip = (nn[0]*A0.n[0] + nn[1]*A0.n[1] + nn[2]*A0.n[2]) < 0;
    const ids = gs.map(row => row.map(pt => M.v(B(pt.p), pt.u, pt.v, pt.infl)));
    for (let a = 0; a < ids.length - 1; a++)
      for (let k = 0; k < ids[a].length - 1; k++)
        if (flip) M.quad(ids[a][k], ids[a+1][k], ids[a+1][k+1], ids[a][k+1]);
        else      M.quad(ids[a][k], ids[a][k+1], ids[a+1][k+1], ids[a+1][k]);
  };
  // ---- THE OPTION SWITCH -----------------------------------------------
  // `cabin.glazing` picks the ROUTE, not the shape:
  //   none       an airframe with no cabin glazing at all (drones, testing)
  //   projected  TEXTURE ONLY. One sheet drawn in SIDE ELEVATION and projected
  //              onto the body: geometry unchanged, so nothing depends on the
  //              truss topology and the artwork cannot distort. Window shape is
  //              a drawing, so any style is a canvas call.
  //   panels     FLAT INSET PANELS. Own geometry, but planar — a flat-sided
  //              tube-and-fabric aeroplane really does have flat glass, and a
  //              flat quad has no topology to fight.
  //   bubble     A CANOPY SHELL over the deck: its own lofted surface, sitting
  //              on the fuselage rather than cut into it. P-47 / homebuilt.
  //   greenhouse The same shell, faceted, with frame bars on every facet edge.
  const GLZ = ['none', 'windshield', 'bubble', 'greenhouse']
    .includes(S.cabin.glazing) ? S.cabin.glazing : 'bubble';
  const hasCab = S.seating !== 'drone' && F.length > 2;
  // the cabin's station window, in the same continuous station coordinate
  // bodySurf takes, and its physical extent, which the shells work in
  const gA = 1 - windFrac * 0.95, gB = Math.min(F.length - 1.02, 2.02);
  const xW = ST[1].x - fu.windRun, xR = Math.min(fu.postX * 0.99, S.cab.noseGap + S.cab.len);
  const deckY = S.cab.h * fu.cowlDeck, roofY = S.cab.h;

  if (CANOPY) {
    // THE SEAM IS A FIXED EDGE LOOP. The boundary of the hole is exactly:
    // rows kCut0 and kCut1 walked over the top, plus the two sill lines of ring
    // vertices between them. Every canopy boundary vertex is a POINT ON THAT
    // POLYLINE — either a ring vertex or a linear point between two adjacent
    // ones — so the seam is watertight for any sill depth, any window, any
    // fuselage shape. The sliders move the middle of the shell; they cannot
    // move its edge.
    const facet = !!CN.facet;
    const rowsK = [], hsK = [];
    for (let k = kCut0; k <= kCut1; k++) {
      // one entry per (station, depth): a station where the depth changes appears
      // TWICE, and the strip between the pair is the step's riser — the little
      // wall that fills the staircase notch. Both of its edges are on the hole's
      // own boundary, so it closes the step exactly rather than nearly.
      if (CHAM) {
        // one entry per station, at that station's own depth. The shell's own
        // quads then run diagonally across the transition cells, meeting the
        // covering triangles edge to edge — which is the joint.
        rowsK.push(bodyRows[k]); hsK.push(dRowAt(bodyRows[k], k));
        continue;
      }
      // One row per station. The sill is a constant ring index, so the RISER
      // PAIR a varying sill needed — two rows at one station, at different
      // depths, with a wall between them — can only arise on the chamfer path
      // above, which carries its own per-station dRowAt. Here dPrev and dNext
      // are the same value whenever both exist, and the guards say only where
      // the opening begins and ends.
      const dPrev = k > kCut0 ? hSill : null;
      const dNext = k < kCut1 ? hSill : null;
      if (dPrev != null) { rowsK.push(bodyRows[k]); hsK.push(dPrev); }
      if (dNext != null && dNext !== dPrev) { rowsK.push(bodyRows[k]); hsK.push(dNext); }
    }
    const mixRow = (A, C, t) => A.map((pt, i) => ({ p: [pt.p[0] + (C[i].p[0] - pt.p[0]) * t, pt.p[1] + (C[i].p[1] - pt.p[1]) * t, pt.p[2] + (C[i].p[2] - pt.p[2]) * t], u: pt.u, vv: pt.vv + (C[i].vv - pt.vv) * t, infl: pt.infl.map((e, k2) => [e[0], e[1] + (C[i].infl[k2][1] - e[1]) * t]) }));
    // FURTHER SUBDIVISION (user): one row per body slice is 3 per bay, too coarse
    // for a dome. Extra rows are SYNTHESISED by averaging the two body rows they
    // sit between — positions AND node weights, elementwise — then run through the
    // same profile, so they are real geometry on the same ruled surface and every
    // weight still sums to 1. A riser pair (same station, different depth) is
    // skipped: there is no station between them.
    const SUBR = CN.facet ? 1 : 7;
    for (let a = rowsK.length - 1; a > 0 && SUBR > 1; a--) {
      if (hsK[a] !== hsK[a - 1]) continue;
      for (let s = SUBR - 1; s >= 1; s--) {
        rowsK.splice(a, 0, mixRow(rowsK[a - 1], rowsK[a], s / SUBR));
        hsK.splice(a, 0, hsK[a]);
      }
    }
    const nR = rowsK.length;
    // NS is a multiple of the ring spacing, so on the end rows the samples land
    // on ring vertices and on the chords between them — both ON the edge.
    const NS = Math.max(10, 2 * Math.max.apply(null, hsK) * (facet ? 1 : 7));
    // a point on a row's top arc, by fractional ring index. u = 0 is the port
    // sill, u = 1 the starboard one, walking over the top.
    // `sm` blends the sample from the body's own CHORD (exact, so a seam row
    // lands on the covering's polyline to the millimetre) toward a Catmull-Rom
    // through the four surrounding ring points (smooth, so the canopy's arc does
    // not inherit the body's facets). It is 0 on the two seam rows and 1 inside,
    // which is the whole trick: the joint stays exact and the dome reads round at
    // a resolution the fuselage does not have to pay for.
    const basePt = (row, u, hsIn, sm) => {
      const hs = hsIn == null ? hSill : hsIn;
      const fi = (GEN_RADIAL - hs) + u * (2 * hs);
      const i0 = Math.floor(fi + 1e-9), t = Math.min(1, fi - i0);
      const A = row[i0 % GEN_RADIAL], C = row[(i0 + 1) % GEN_RADIAL];
      const p = [A.p[0] + (C.p[0] - A.p[0]) * t, A.p[1] + (C.p[1] - A.p[1]) * t,
                 A.p[2] + (C.p[2] - A.p[2]) * t];
      if (sm > 0) {
        const Pm = row[(i0 - 1 + GEN_RADIAL) % GEN_RADIAL].p,
              Pn = row[(i0 + 2) % GEN_RADIAL].p, t2 = t * t, t3 = t2 * t;
        for (let c2 = 0; c2 < 3; c2++) {
          const cr = 0.5 * ((2 * A.p[c2]) + (-Pm[c2] + C.p[c2]) * t
            + (2*Pm[c2] - 5*A.p[c2] + 4*C.p[c2] - Pn[c2]) * t2
            + (-Pm[c2] + 3*A.p[c2] - 3*C.p[c2] + Pn[c2]) * t3);
          p[c2] += (cr - p[c2]) * sm;
        }
      }

      // both rings carry the SAME eight nodes in the same order (the two
      // straddling frames' corners), so the weights interpolate elementwise and
      // still sum to 1 — which is what GATE GEN's coherence check asserts
      const infl = A.infl.map((e, i) => [e[0], e[1] + (C.infl[i][1] - e[1]) * t]);
      return { p, infl };
    };
    // how high the shell stands off the fuselage's own line, per row. Zero at
    // both ends BY CONSTRUCTION, which is what closes it into the cowl deck at
    // the front and the turtledeck at the back.
    // Height is a fraction of cabin height, but CAPPED AGAINST THE WIDTH OF THE
    // OPENING. A canopy is a dome: rise much greater than the half-width it
    // spans is not a canopy, it is a fin — which is exactly what a low wing was
    // showing, because nothing else clamped it there. 0.95 of the half-width is
    // about a half-round, which is the tallest a bubble ever really is.
    // ---- THE CROWN LINE. This is the root cause of every shape defect so far.
    // The shell used to be built as DECK PLUS A BUMP: a lift added on top of the
    // fuselage's own top line. But that line is not fair — it steps up over the
    // windscreen and tapers away aft — so deck + bump inherited the step and
    // came out as a blister with a hump in it, and every attempt to reshape the
    // bump was reshaping the wrong term.
    //
    // A canopy's crown is an ABSOLUTE line: it leaves the covering at the front
    // seam, rises to a peak, runs flat, and comes back down to the covering at
    // the aft seam. So compute that line in world y, and let each row's lift be
    // whatever gets it there. The seam rows land exactly on the fuselage's own
    // crown height, which is why the seam stays exact and why the windscreen
    // step is swallowed instead of climbed.
    const crownY = row => basePt(row, 0.5).p[1];
    const yF0 = crownY(rowsK[0]), yA0 = crownY(rowsK[nR - 1]);
    const zMid = Math.abs(basePt(rowsK[Math.floor(nR / 2)], 1).p[2]);
    // the peak: a fraction of cabin height above the HIGHER of the two seams,
    // capped against the half-width it spans (a rise taller than that is a fin,
    // not a canopy) and, on a high wing, under the carry-through
    // ---- WHAT SETS THE HEIGHT: THE SLOPES, NOT A HEIGHT KNOB.
    // `height` was an additive rise and the seam then dragged it back down —
    // exactly the diagnosis. On a high wing the carry-through happened to clamp
    // it and the shape looked right; on a low wing nothing did, so the same
    // number ballooned. The height was never the constraint that matters.
    //
    // What constrains a real canopy is the ANGLE of its glass: a windscreen
    // rakes at 40-50 deg, an aft fairing runs out at 10-18, and both angles are
    // rise over the LENGTH available for them. So the rise is capped by the
    // window's own length through those two slopes, and `height` becomes a
    // preference inside that envelope rather than a driver of it. A short window
    // is then automatically a low canopy in every configuration, and there is
    // nothing left for a clamp to have to catch.
    const rakeF = 0.20 + 0.45 * (CN.skew - 0.20) / 1.40;
    const fadeF = Math.min(0.55, Math.max(0.22, 1.05 - rakeF));
    const Lw = Math.abs(basePt(rowsK[nR - 1], 0.5).p[0] - basePt(rowsK[0], 0.5).p[0]);
    const ySeam = Math.max(yF0, yA0);
    const rise = Math.min(S.cab.h * CN.height,
                          // WIDTH IS ITS OWN KNOB NOW. This used to cap the rise at
                          // 0.95 of the half-width, which tied the two together: asking
                          // for a taller canopy on a narrow cabin did nothing, and that
                          // is why `bubble` appeared inert. Height is bounded by the
                          // glass slopes only; how far it bulges sideways is `width`.
                          // ...and the slope limits are SOFT: asking for a tall canopy
                          // is asking for steeper glass, so the two angles open with the
                          // height knob (rake 40->64 deg, fairing 12->32). Fixed angles
                          // made the knob inert on a short window, which is what it was
                          // doing at 0.42 and 0.86 alike.
                          Math.tan((40 + 24 * CN.height) * Math.PI / 180) * rakeF * Lw,
                          Math.tan((12 + 22 * CN.height) * Math.PI / 180) * fadeF * Lw);
    let yPk = ySeam + Math.max(0.02, rise);
    // ---- THE LID. One virtual clipping plane, always — the high wing's clamp
    // generalised. `lid` is where it sits as a fraction of the natural rise: 1
    // leaves the dome alone, 0.4 slices the top off flat, which is what a
    // low-decked cockpit actually looks like. And whenever the WING sits inside
    // that envelope the plane drops to just under it, so the same mechanism
    // covers high, mid and low without a special case: it is only the wing that
    // changes where the plane lands.
    const lidF = CN.lid == null ? 1 : Math.max(0.25, Math.min(1, CN.lid));
    let yLid = ySeam + Math.max(0.02, rise) * lidF;
    const yWing = P.yF(P.zRoot);
    if (yWing > ySeam + 0.04) yLid = Math.min(yLid, yWing - 0.05);
    if (S.wing.position === 'high')
      yPk = Math.min(yPk, Math.max(ySeam + 0.02, P.yF(P.zRoot) - 0.05));
    void 0;
    let yCap = Infinity;
    if (S.wing.position === 'high') yCap = P.yF(P.zRoot) - 0.05;
    const grid = rowsK.map((row, a) => {
      const hsA = hsK[a];
      // seam rows sample the body's chord EXACTLY (sm = 0); everything inside
      // rides the smooth ring curve, ramped over one row so there is no crease
      const smA = (a === 0 || a === nR - 1) ? 0 : (a === 1 || a === nR - 2) ? 0.55 : 1;
      const xFr = basePt(rowsK[0], 0.5, hsK[0]).p[0];
      const xAf = basePt(rowsK[nR - 1], 0.5, hsK[nR - 1]).p[0];
      // t comes from the STATION, not the row index: a stepped joint duplicates a
      // station, and index-based t would stretch the crown line over rows that
      // share an x, so the riser would lean instead of standing up.
      const t = Math.abs(xAf - xFr) > 1e-6
        ? Math.max(0, Math.min(1, (basePt(row, 0.5, hsA).p[0] - xFr) / (xAf - xFr)))
        : (nR > 1 ? a / (nR - 1) : 0);
      // the line: raked windscreen, flat top, long aft fairing. `skew` is how
      // much of the window the rake takes.
      const rake = 0.20 + 0.45 * (CN.skew - 0.20) / 1.40;   // 0.20 .. 0.65
      const fade = Math.min(0.55, Math.max(0.22, 1.05 - rake));
      const ss = x => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };
      const yDeck = crownY(row);
      // absolute crown height for this row: up from the front seam, flat, then
      // down to the aft seam. Exactly the seam heights at t = 0 and t = 1.
      // THE CROWN LINE IS RELATIVE TO THE BODY, not absolute (user: a windshield
      // reduced to almost nothing still protruded, and every bubble came out an odd
      // shape). It used to ramp from the front seam's height to an absolute peak over
      // `rake` of the WINDOW, while the fuselage's own deck rises over the WINDSCREEN
      // RUN — two different lengths. Wherever the ramp got there first the shell stood
      // off the body as a slab, which is the wedge over the cowl.
      //
      // So the line is the body's own deck plus a bump that is zero at both seams:
      // at rise 0 the shell IS the fuselage, i.e. the face simply turns to glass, and
      // the windscreen angle is the fuselage's angle by construction rather than by
      // agreement. Every larger height swells from that same line.
      const bump = ss(t / rake) * ss((1 - t) / fade);
      const yCr = yDeck + Math.max(0, yPk - ySeam) * bump;

      // never BELOW the covering it replaces — the aft rows of a long window sit
      // over a tapering deck and would otherwise sink into it
      const rise = Math.max(0, yCr - yDeck);
      return Array.from({ length: NS + 1 }, (_, j) => {
        const u = j / NS;
        const bp = basePt(row, u, hsA, smA);
        // cross-section: a full, slightly flattened dome rather than a peak —
        // sin^0.85 came to a point at the crown, which is what made it read as a
        // blade once it was tall
        // cross-section fullness. `bubble` 1 is a half-round blown canopy; 0 is
        // a flat-sided turtledeck with a crown on it. It shapes the SECTION
        // only — how high the thing stands is the slope envelope's business, and
        // where it stops is the lid's.
        const bub = CN.bubble == null ? 0.7 : Math.max(0, Math.min(1, CN.bubble));
        // BALLOON. `width` scales the section outward from the fuselage's own
        // line, and sin(pi u) is exactly zero at both sills — so the fixed edge
        // loop is untouched and only the middle swells. That is the knob that
        // makes a blown canopy stand proud of the body instead of merely tall.
        // BALLOON, GATED BY THE RISE. sin(pi u) already pins the two SIDE sills,
        // but the fore and aft end rows are seams too — they sit on the body,
        // where rise is 0 — and pushing their middles outward opened exactly the
        // gaps this whole approach exists to avoid. Scaling the bulge by the
        // normalised rise makes it vanish wherever the shell touches the
        // fuselage, on every edge of the opening, by construction.
        const wK = CN.width == null ? 1 : CN.width;
        const riseF = Math.max(0, Math.min(1, rise / Math.max(1e-6, yPk - ySeam)));
        const zBulge = bp.p[2] * (1 + (wK - 1) * riseF * Math.sin(Math.PI * u));
        const lift = rise * Math.pow(Math.sin(Math.PI * u), facet ? 0.45 : 1.0 - 0.5 * bub);
        // a canopy cannot grow through the wing: on a high wing the shell is
        // capped under the carry-through, and the cap is the parametric way of
        // saying a bubble belongs on a low or mid wing
        // clipped by the lid plane, never below the covering it replaces
        const y = Math.min(bp.p[1] + lift, Math.max(bp.p[1], Math.min(yLid, yCap)));
        return { p: [bp.p[0], y, zBulge], infl: bp.infl, u, v: t };
      });
    });
    const sun = Math.max(0, Math.min(0.92, CN.sun == null ? 0 : CN.sun));
    const sunStart = Math.max(0, Math.min(0.85, CN.sunStart == null ? 0.38 : CN.sunStart));
    const tvc = {};
    // UV: the roof is PAINTED, so it has to live in the fuselage's own UV zone or
    // the livery does not line up across the seam (user: "the UV mapping is also
    // wrong"). u is the ring's normalised ANGLE, exactly as the covering computes
    // it, and v is the body's station — recovered from the same fractional ring
    // index basePt sampled, so a roof texel and the texel of the covering beside it
    // are the same texel.
    const roofUV = (a, j) => {
      const hs = hsK[a], fi = (GEN_RADIAL - hs) + (j / NS) * (2 * hs);
      return [(fi % GEN_RADIAL) / GEN_RADIAL,
              genUVBody(grid[a][j].p[0] / Math.max(1e-6, fu.postX))];
    };
    const tv = (a, j) => { const kk = a + '_' + j; if (tvc[kk] != null) return tvc[kk]; const pt = grid[a][j], uv = roofUV(a, j); return tvc[kk] = ctop.v(B(pt.p), uv[0], uv[1], pt.infl); };
    const ids = grid.map(r => r.map(pt => canopy.v(B(pt.p), pt.u, pt.v, pt.infl)));
    // ---- SUNSCREEN. The crown goes OPAQUE, painted like the rest of the aeroplane
    // -- a tinted roof, or a fabric-over-the-top cabin. `sun` is the fraction of the
    // arc it takes, centred on the crown. A MESH split, not a texture: the roof
    // quads are the shell's own, so glass and roof share an edge by construction,
    // and the boundary lands on a section line where it takes a rail like any other
    // frame member.
    for (let a = 0; a < ids.length - 1; a++)
      for (let j = 0; j < ids[a].length - 1; j++) {
        const um = (j + 0.5) / NS;
        // NOT OVER THE WINDSCREEN. A sunscreen that reaches the front of the canopy
        // is a blindfold: it starts partway along and runs aft. `sunStart` is that
        // station as a fraction of the window's length, and the rows already carry
        // that fraction as their v.
        const tm = 0.5 * (grid[a][j].v + grid[a+1][j].v);
        if (sun > 0 && tm >= sunStart && Math.abs(um - 0.5) < sun / 2)
          ctop.quad(tv(a, j), tv(a, j+1), tv(a+1, j+1), tv(a+1, j));
        else canopy.quad(ids[a][j], ids[a][j+1], ids[a+1][j+1], ids[a+1][j]);
      }
    if (sun > 0) {
      const jb = Math.max(1, Math.round((0.5 - sun / 2) * NS));
      let aFirst = -1;
      for (let a = 0; a < nR - 1; a++) {
        if (0.5 * (grid[a][jb].v + grid[a+1][jb].v) < sunStart) continue;
        if (aFirst < 0) aFirst = a;
        for (const j of [jb, NS - jb])
          genTubeInto(cframe, grid[a][j].p, grid[a+1][j].p, 0.011, 10, grid[a][j].infl, B);
      }
      // the front edge of the roof is a bow, like the ends of the canopy
      if (aFirst >= 0)
        for (let j = jb; j < NS - jb; j++)
          genTubeInto(cframe, grid[aFirst][j].p, grid[aFirst][j+1].p, 0.011, 10, grid[aFirst][j].infl, B);
    }
    // FRAME, on the same vertices: sill rails, the two end bows, and on the
    // faceted version a bar down every facet edge.
    const rail = (A, C, r) => genTubeInto(cframe, A.p, C.p, r, 10, A.infl, B);    const jn = 0;    const jr = 0;
    for (const j of [0, NS])
      for (let a = jr; a < nR - 1; a++) rail(grid[a][j], grid[a+1][j], 0.015);
    // NO JOIN WHERE THE SUNSCREEN MEETS THE BODY. The end bows are the canopy's
    // joint with the covering, and a rail across one is right for glass — but the
    // sunscreen is painted like the fuselage, so a bar there reads as a seam in
    // the body itself. Under the roof the bow is simply not drawn, and the two
    // surfaces run into each other.
    const roofAt = (a, j) => sun > 0 && grid[a][j].v >= sunStart
      && Math.abs((j + 0.5) / NS - 0.5) < sun / 2;
    for (const a of [0, nR - 1])
      for (let j = (a === 0 ? jn : 0); j < (a === 0 ? NS - jn : NS); j++)
        if (!roofAt(a, j)) rail(grid[a][j], grid[a][j+1], 0.014);
    if (facet)
      for (let j = 1; j < NS; j++)
        for (let a = 0; a < nR - 1; a++) rail(grid[a][j], grid[a+1][j], 0.011);
    // INTERIOR. Only when there is a real opening: a windshield-only cut is
    // covered by glass that reproduces the fuselage exactly, and floors nothing.
    if (yPk - Math.max(yF0, yA0) > 0.05) {
      const drop = 0.30 * S.cab.h;
      const fl = rowsK.map((row, a) => {
        const L = basePt(row, 0, hsK[a]), Rr = basePt(row, 1, hsK[a]);
        return [0, 0.5, 1].map(u => {
          const p = [L.p[0], 0.5 * (L.p[1] + Rr.p[1]) - drop,
                     L.p[2] + (Rr.p[2] - L.p[2]) * u];
          const infl = L.infl.map((e, i) => [e[0], e[1] + (Rr.infl[i][1] - e[1]) * u]);
          return gcabin.v(B(p), u, 0, infl);
        });
      });
      for (let a = 0; a < fl.length - 1; a++)
        for (let j = 0; j < 2; j++)
          gcabin.quad(fl[a][j], fl[a][j+1], fl[a+1][j+1], fl[a+1][j]);
    }
  }
  // ---- 2e. SIDE WINDOWS ------------------------------------------------
  // The other half of the combination the user asked for: a windscreen (or a
  // short canopy) plus real side lights along the cabin. These are CONFORMING
  // PATCHES, not cuts — the route that already works — so they follow whatever
  // shape the sliders give the body and need no seam management at all: three
  // sheets a few millimetres apart along the surface's own normal, plus a rail
  // round the edge. `depth` is how far down the side the light reaches, `reach`
  // how far aft it runs; both are fractions, so they survive any cabin.
  if (false && hasCab) {
    const rch = CN.sideReach == null ? 1 : CN.sideReach;
    const dep = CN.sideDepth == null ? 0.5 : CN.sideDepth;
    const g0 = 1.04, g1 = Math.min(F.length - 1.06, g0 + 0.94 * rch);
    if (g1 > g0 + 0.06) {
      const thC = Math.PI / 2, hh = 0.26 + 0.40 * dep;
      for (const sgn of [1, -1]) {
        const t0 = sgn * (thC - 0.62 * hh), t1 = sgn * (thC + 0.38 * hh);
        bodyPatch(gcabin, g0, g1, t0, t1, 5, 3, -0.005);
        bodyPatch(canopy, g0, g1, t0, t1, 5, 3, 0.005);
        // the rail walks each edge in segments, so a curved edge stays curved
        const edge = (a0, b0, a1, b1) => {
          const NSg = 4;
          let prev = null;
          for (let i = 0; i <= NSg; i++) {
            const q = bodySurf(a0 + (a1 - a0) * i / NSg, b0 + (b1 - b0) * i / NSg);
            const pt = genV3.add(q.p, genV3.mul(q.rad, 0.009));
            if (prev) genTubeInto(cframe, prev.p, pt, 0.011, 10, prev.infl, B);
            prev = { p: pt, infl: q.infl };
          }
        };
        edge(g0, t0, g1, t0); edge(g1, t0, g1, t1);
        edge(g1, t1, g0, t1); edge(g0, t1, g0, t0);
      }
    }
  }

  // ---- 2e. SIDE WINDOWS ------------------------------------------------
  // Not patches any more, and not a separate route: a side light is the SAME cut
  // as the canopy's, kept at the waistline instead of taken over the top. The
  // covering loop removes a band of ring quads between two height planes over the
  // cabin stations, and the glass fills exactly those quads off the very same ring
  // vertices — flush with the body, in line with the windscreen, no seam to
  // manage because there is no second surface. Meant to be combined with the
  // WINDSCREEN, not with a canopy: with a canopy the two openings would meet.
  if (sideQuads.length) {
    const LIFT = 0.004, INSET = 0.055;
    const yMid = 0.5 * (S.cab.h * 0.72);
    const lift = (pt, d) => {
      const n = genV3.norm([0, (pt.p[1] - yMid) * 0.30, pt.p[2]]);
      return [pt.p[0] + n[0] * d, pt.p[1] + n[1] * d, pt.p[2] + n[2] * d];
    };
    const emit = (M, d, uv) => {
      const seen = new Map();
      const vid = (pt, key) => {
        const kk = key + '|' + d;
        if (seen.has(kk)) return seen.get(kk);
        const id = M.v(B(lift(pt, d)), uv(pt)[0], uv(pt)[1], pt.infl);
        seen.set(kk, id); return id;
      };
      for (const q of sideQuads) {
        const a = vid(q.a0, q.ka0), b = vid(q.a1, q.ka1),
              c = vid(q.b1, q.kb1), e = vid(q.b0, q.kb0);
        if ((d >= 0) !== !!q.mirror) M.quad(a, b, c, e); else M.quad(e, c, b, a);
      }
    };
    emit(canopy, LIFT, pt => [pt.u, pt.vv]);
    void INSET;   // no interior sheet behind a side light (user): the glass reads dark
    // ---- THE FRAME, as a true PERIMETER. Railing each quad's flagged edges drew
    // bars across the middle of the light as well (the faceted look, which the canopy
    // no longer has either). The boundary of a set of quads is exactly the edges used
    // ONCE, so count them and rail the singletons: one black joint round the window,
    // whatever shape the band is and however it is subdivided.
    const ec = new Map();
    const eKey = (x, y) => (x < y ? x + '>' + y : y + '>' + x);
    for (const q of sideQuads) {
      const P4 = [[q.ka0, q.a0], [q.ka1, q.a1], [q.kb1, q.b1], [q.kb0, q.b0]];
      for (let n = 0; n < 4; n++) {
        const A = P4[n], C = P4[(n + 1) % 4], k2 = eKey(A[0], C[0]);
        const e = ec.get(k2);
        if (e) e.n++; else ec.set(k2, { n: 1, a: A[1], b: C[1] });
      }
    }
    for (const e of ec.values())
      if (e.n === 1) genTubeInto(cframe, lift(e.a, LIFT), lift(e.b, LIFT), 0.012, 10, e.a.infl, B);
  }

  // ---- 2g. COAMING + INSTRUMENT PANEL ----------------------------------
  // THE FIT LINE NEVER MOVES. It is the joint between the fuselage and the
  // windscreen — the body's own ring at the cabin-front station, taken between
  // the two sill points, i.e. the very arc the glazing cut is bounded by. A row
  // is one station, so those vertices already lie in a plane perpendicular to the
  // length axis and the line reads straight from above by construction rather
  // than by projection. They are the covering's own vertices, so the coaming
  // meets the body exactly and flexes with it.
  //
  // From that arc the shell is extruded: aft by `depth` (default the windscreen
  // run, i.e. the break line seen from the side), then a step inward, then a few
  // millimetres forward toward the prop, then closed with the flat panel the
  // instruments will go on.
  const PN = S.cab.panel || {};
  if (PN.on !== false && S.seating !== 'drone' && F.length > 2 && bodyRows.length) {
    const kW = Math.max(0, Math.min(bodyRows.length - 1, nearestSlice(ST[1].x - fu.windRun)));
    const rowW = bodyRows[kW];
    // THE ARC IS THE SILL'S. It used to be bounded by where the section falls
    // away from the cowl deck, which is a different line from the one the glazing
    // cut makes — so lowering the sill opened a gap between the coaming's ends and
    // the opening's edge. It reads hSill, the very value the cut uses, so the
    // two cannot disagree whatever the sill does. `wrap` modulates about it:
    // 0.5 is exactly the sill, less is a shallower coaming, more reaches past it.










    const hsW = Math.max(1, Math.min(GEN_RADIAL / 2 - 1,
      Math.round(hSill * 2 * genClamp(PN.wrap == null ? 0.5 : PN.wrap, 0.15, 0.95))));
    const arc = [];
    for (let j = -hsW; j <= hsW; j++) arc.push(rowW[(j + GEN_RADIAL) % GEN_RADIAL]);
    const dep = Math.max(0.02, PN.depth == null ? fu.windRun : PN.depth);
    const ins = 1 - Math.max(0, Math.min(0.25, PN.inset == null ? 0.06 : PN.inset));
    let cy = 0, cz = 0;
    for (const p of arc) { cy += p.p[1]; cz += p.p[2]; }
    cy /= arc.length; cz /= arc.length;
    const mv = (pt, dx, k) => ({ p: [pt.p[0] + dx, cy + (pt.p[1] - cy) * k,
                                     cz + (pt.p[2] - cz) * k], infl: pt.infl, u: pt.u });
    const R = [arc.map(p => mv(p, 0, 1)), arc.map(p => mv(p, dep, 1)),
               arc.map(p => mv(p, dep, ins)), arc.map(p => mv(p, dep - 0.006, ins))];
    const vs = R.map((row, r) => row.map(pt =>
      dash.v(B(pt.p), pt.u, genUVBody(pt.p[0] / Math.max(1e-6, fu.postX)), pt.infl)));
    for (let r = 0; r < vs.length - 1; r++)
      for (let j = 0; j < arc.length - 1; j++)
        dash.quad(vs[r][j], vs[r][j+1], vs[r+1][j+1], vs[r+1][j]);
    // the flat panel: the last ring capped in its own plane, fanned from the
    // centroid of the arc's chord. This is the face the instruments go on.
    const lastR = R[3];
    const cx = lastR[0].p[0];
    const cInfl = arc[Math.floor(arc.length / 2)].infl;
    const cId = dash.v(B([cx, cy, cz]), 0.5, genUVBody(cx / Math.max(1e-6, fu.postX)), cInfl);
    const cap = lastR.map(pt => dash.v(B([cx, pt.p[1], pt.p[2]]), pt.u,
      genUVBody(cx / Math.max(1e-6, fu.postX)), pt.infl));
    for (let j = 0; j < cap.length - 1; j++) dash.tri(cId, cap[j+1], cap[j]);
    // and close the panel's straight lower edge, sill to sill
    dash.tri(cId, cap[0], cap[cap.length - 1]);
  }

  // ---- 2f. SMALL PARTS -------------------------------------------------
  // A boarding step and a pitot mast: two tubes, and two of the things whose
  // absence makes an aeroplane read as a toy. Both hang off real nodes, so they
  // flex with whatever they are bolted to.
  {
    const s2 = ST[Math.min(2, ST.length - 1)], f2 = F[Math.min(2, F.length - 1)];
    const y0 = s2.yb + 0.04;
    for (const [sgn, nd] of [[1, f2.BR], [-1, f2.BL]]) {
      const foot = [s2.x - 0.02, y0 - 0.23, sgn * (s2.w + 0.15)];
      genTubeInto(strut, [s2.x - 0.05, y0, sgn * s2.w * 0.92], foot, 0.015, 8, [[nd, 1]], B);
      genTubeInto(strut, [foot[0] - 0.10, foot[1], foot[2]],
                        [foot[0] + 0.07, foot[1], foot[2]], 0.015, 8, [[nd, 1]], B);
    }
  }

  // ---- 2c. REGISTRATION, as a conforming DECAL ------------------------------
  // It used to be painted into the body texture, and the body's u is normalised
  // ANGLE while its circumference shrinks aft — so a glyph of fixed u-width got
  // narrower and narrower toward the tail. User: "the writing is all squeezed at
  // the back. It either needs to be a decal, or we need to live UV map better."
  //
  // This is the decal. It is built from the body's OWN rows, so it follows the
  // real surface however the fuselage is shaped, lifted a few millimetres along
  // the local outward normal, and given a plain 0..1 grid of its own — the text
  // cannot distort because nothing about the body's parameterisation reaches it.
  if (S.reg) {
    const DEC_LIFT = 0.006;
    // Between 30% and 60% of the run to the tailpost. It used to sit at
    // 45-78%, which on a tapered body is the wedge where the section halves in
    // width — so the glyphs shrank toward the tail even as a decal, which is the
    // squeeze the decal existed to cure. Forward of that the section is full.
    // ---- POSITION AND ASPECT (user: it must never stretch, "that's the point").
    // `paint.regX` places the patch: 0 just aft of the cabin, 1 at the fin. The
    // LENGTH is not a free choice — the sheet is 4:1, so the patch has to be four
    // times as long as it is tall or the glyphs distort however undistorted their
    // own grid is. So: measure the arc height in metres at the anchor row, ask for
    // 4x that in x, and take however many rows that comes to. A short body gets a
    // small registration, not a squeezed one.
    const REG_ASPECT = 4.0;
    const hA0 = Math.round(0.15 * GEN_RADIAL), hB0 = Math.round(0.35 * GEN_RADIAL);
    const anchor = Math.max(1, Math.min(bodyRows.length - 2,
      Math.round(bodyRows.length * (0.24 + 0.52 * genClamp(
        S.paint.regX == null ? 0.30 : S.paint.regX, 0, 1)))));
    const arcH = (() => {
      const r = bodyRows[anchor];
      let L = 0;
      for (let h = hA0; h < hB0; h++)
        L += Math.hypot(r[h+1].p[1] - r[h].p[1], r[h+1].p[2] - r[h].p[2]);
      return Math.max(0.05, L);
    })();
    const wantX = REG_ASPECT * arcH;
    let lo = anchor, hi = anchor;
    while (hi < bodyRows.length - 1 &&
           Math.abs(bodyRows[hi][0].p[0] - bodyRows[lo][0].p[0]) < wantX) hi++;
    // ran out of body: back the patch up rather than shrink it
    while (lo > 0 && Math.abs(bodyRows[hi][0].p[0] - bodyRows[lo][0].p[0]) < wantX) lo--;
    const rows = bodyRows.slice(lo, Math.max(lo + 2, hi + 1));
    // the two side arcs: u 0.15..0.35 (+z) and its mirror
    // The far side walks its arc BACKWARDS rather than flipping u. Traversing
    // both side arcs in the same index direction gives them opposite handedness
    // seen from outside, so flipping u on top of that was a SECOND flip: the
    // registration came out mirrored AND upside down. Reversing the traversal
    // restores the handedness, and then both sides share one (u, v) frame
    // relative to their own outward normal.
    // The arcs are FRACTIONS of GEN_RADIAL, not fixed indices: hard-coded 3..7
    // and 13..17 were the +z and -z sides at 20 segments and became the upper
    // side and the BELLY the moment the section resolution changed.
    const hA = hA0, hB = hB0;
    const hC = GEN_RADIAL - hB, hD = GEN_RADIAL - hA;
    // TWO SEPARATE FLIPS, and conflating them is what left the registration
    // mirrored. `back` walks the arc the other way and only fixes HANDEDNESS
    // (traversing both side arcs in the same index direction gives them opposite
    // orientation seen from outside). Reading direction is the OTHER one, and it
    // is a flip of u: on the +z side the nose is to the observer's RIGHT, so
    // increasing station runs to their left and the glyphs come out reversed
    // unless u is reversed with it. On the -z side it already reads forward.
    // (A real registration reads left-to-right from BOTH beams, which means it
    // runs nose-to-tail on one side and tail-to-nose on the other.)
    for (const [h0, h1, back, flipU] of [[hA, hB, false, false], [hC, hD, true, true]]) {
      const grid = rows.map(row => {
        const out = [];
        for (let j = h0; j <= h1; j++) {
          const h = back ? (h1 - (j - h0)) : j;
          const pt = row[h];
          // outward normal of a section point is its radial offset from the
          // section centre, which for these near-elliptical rings is exact
          // enough at 6 mm of lift
          const c = row[0].p, o = pt.p;
          const ry = o[1] - 0.5 * (row[0].p[1] + row[GEN_RADIAL / 2].p[1]);
          const n = genV3.norm([0, ry, o[2]]);
          out.push({ p: [o[0], o[1] + n[1] * DEC_LIFT, o[2] + n[2] * DEC_LIFT],
                     infl: pt.infl });
        }
        return out;
      });
      // u runs ALONG the body and v around it, so the sheet's long axis is the
      // aeroplane's long axis and the text reads nose-to-tail. The far side is
      // flipped so the registration reads the same way round from either beam,
      // which is what it does on a real aeroplane.
      // v runs the other way round the body than the sheet is drawn: measured
      // on both beams, u forward / v inverted is the one combination of the four
      // that reads F-PGAR the right way round on BOTH sides. It is a UV flip and
      // not a traversal flip on purpose — reversing the traversal instead would
      // invert this sheet's normals and light the registration from inside.
      // MEASURED, one arc at a time, from both beams (there are four
      // combinations and three of them are wrong): v runs the other way round
      // the body than the sheet is drawn, and the -z side additionally needs u
      // reversed, because a registration reads left-to-right from BOTH beams —
      // which means it runs nose-to-tail on one side and tail-to-nose on the
      // other. Doing it in UV and not in the traversal keeps the sheet's normals
      // pointing out; reversing the traversal would light the decal from inside.
      const ids = grid.map((g, r) => {
        const t = r / Math.max(1, grid.length - 1);
        return g.map((pt, k) =>
          decal.v(B(pt.p), flipU ? 1 - t : t, 1 - k / (h1 - h0), pt.infl));
      });
      for (let r = 0; r < ids.length - 1; r++)
        for (let k = 0; k < ids[r].length - 1; k++)
          decal.quad(ids[r][k], ids[r][k+1], ids[r+1][k+1], ids[r+1][k]);
    }
  }
  const secRows = [{ s: lastFusRow.ids }];   // last fuselage row, for the tail cone
  // tail cone closing onto the post: the section collapses to the TPB..TPT line
  {
    const lastRow = secRows[0].s, s = ST[ST.length - 1];
    const yc = 0.5 * (s.yb + s.yt), hD = 0.5 * (s.yt - s.yb);
    const tip = [];
    for (let h = 0; h <= GEN_RADIAL; h++) {
      const th = 2 * Math.PI * (h % GEN_RADIAL) / GEN_RADIAL;
      const [dy] = genRing(th, s.w, hD, fu.crownTop, fu.crownSide);
      const t = 0.5 * (1 + dy / Math.max(1e-6, hD));          // 0 = TPB, 1 = TPT
      const p = [fu.postX, N[P.TPB].p[1] + t * (N[P.TPT].p[1] - N[P.TPB].p[1]), 0];
      tip.push(skin.v(B(p), h / GEN_RADIAL, genUVBody(1), [[P.TPB, 1 - t], [P.TPT, t]]));
    }
    for (let h = 0; h < GEN_RADIAL; h++)
      skin.quad(lastRow[h], lastRow[h+1], tip[h+1], tip[h]);
  }
  // ---- 2b. the ENGINE BAY: its own component, its own cover ------------
  // Deliberately NOT the front of the fuselage. Blending a firewall section
  // smoothly into a spinner gives a carrot; a real light aeroplane is a
  // straight-sided box with an engine in it and a cowl over the engine. So the
  // cowl holds full section for `cowl.straight` of its length and only then
  // necks to the spinner, and the block inside it is drawn separately —
  // uncovered in Frame mode, hidden under the cowl in Covered mode.
  const hub = [S.engX - 0.10, S.engY, 0];
  const eng2 = [[P.EL, 0.5], [P.ER, 0.5]];
  {
    const s0 = ST[0], f0 = F[0], CW = S.cowl;
    const yc0 = 0.5 * (s0.yb + s0.yt), hD0 = 0.5 * (s0.yt - s0.yb);
    const xNose = hub[0];                       // flat front face (x is AFT)
    const len = Math.max(0.12, s0.x - xNose);
    // TWO SECTIONS, and the loft runs between them. Aft is the firewall's own
    // ring (same crown, so the joint cannot ridge); forward is the COWL'S OWN
    // nose section, which is centred on the THRUSTLINE and sized by halfW / top
    // / bot. `taper` is already inside the derived nose numbers (60_gen_spec);
    // setting any of the three by hand replaces it there, so it is not applied
    // twice here.
    const nHW = CW.halfW, nT = CW.top, nB = CW.bot;
    const yN = S.engY + 0.5 * (nT - nB), hDN = 0.5 * (nT + nB);   // nose centre/depth
    const fil = Math.min(CW.fillet, 0.40 * Math.min(nHW, hDN), 0.45 * len);
    // A profile step is a fraction along the cowl plus an absolute inset for the
    // fillet. `shrink` is absolute — that is what makes it a true fillet rather
    // than a scale, so the corners round without the face going oval.
    const NF = 4;
    const steps = [{ t: 0, shrink: 0 },
                   { t: (len - fil) / len, shrink: 0 }];
    for (let i = 1; i <= NF; i++) {
      const a = (i / NF) * Math.PI / 2;
      steps.push({ t: (len - fil + fil * Math.sin(a)) / len,
                   shrink: fil * (1 - Math.cos(a)) });
    }
    const rows = steps.map(st => {
      const t2 = st.t;                                  // 0 at the firewall
      const x = s0.x - t2 * len;
      const hw = Math.max(0.02, s0.w + (nHW - s0.w) * t2 - st.shrink);
      const hd = Math.max(0.02, hD0 + (hDN - hD0) * t2 - st.shrink);
      const yc = yc0 + (yN - yc0) * t2;
      const row = [];
      for (let h = 0; h <= GEN_RADIAL; h++) {
        const th = 2 * Math.PI * (h % GEN_RADIAL) / GEN_RADIAL;
        const [dy, dz] = genRing(th, hw, hd, fu.crownTop, fu.crownSide);
        // weights follow the section's own normalised coordinates, so the
        // covering still flexes with the firewall frame and the engine mounts
        const uz = dz / Math.max(1e-6, hw), uy = dy / Math.max(1e-6, hd);
        const wL = 0.5*(1-uz), wR = 0.5*(1+uz), wT = 0.5*(1+uy), wBo = 0.5*(1-uy);
        const k = 1 - t2;
        const infl = [[f0.TL, k*wT*wL], [f0.TR, k*wT*wR], [f0.BL, k*wBo*wL],
                      [f0.BR, k*wBo*wR], [P.EL, 0.5*t2], [P.ER, 0.5*t2]];
        // THE COWL HAS ITS OWN SHEET since G4.7: u is the angle around, v runs
        // from the firewall to the nose. It used to sample the body's paint at
        // v = 0.02*(1-t2), i.e. the whole cover squeezed into a 2%-tall sliver of
        // the shared sheet — measured 0.009 of it, which is one texel row at
        // 512 and nothing an intake could be drawn on.
        // The loft stops at GEN_COWL_V and the band above it is the NOSE FACE,
        // mapped as a rim strip: a fan whose whole ring sits at one v has no
        // texture area at all, and the front face is exactly where a spinner
        // ring or a radial's front intake wants to be drawn.
        row.push(cowl.v(B([x, yc + dy, dz]), h / GEN_RADIAL, GEN_COWL_V * t2, infl));
      }
      return row;
    });
    for (let r = 0; r < rows.length - 1; r++)
      for (let h = 0; h < GEN_RADIAL; h++)
        cowl.quad(rows[r+1][h], rows[r+1][h+1], rows[r][h+1], rows[r][h]);
    // flat nose, capped IN the plane of the last ring. (It was inset 12 mm
    // once, which left a lip you could see into — the "big opening".)
    const last = rows[rows.length - 1];
    const capC = cowl.v(B([xNose, yN, 0]), 0.5, 1, eng2);
    for (let h = 0; h < GEN_RADIAL; h++) cowl.tri(capC, last[h+1], last[h]);
    // COOLING INTAKES, one either side of the spinner: recessed dark cylinders
    // rather than painted circles, so they hold a shadow from every angle. The
    // nose was a blank plate with a spike in the middle of it, and the nose is
    // the view a taxiing aeroplane shows most.
    {
      // clear of the spinner, and low on the face: the first attempt put them
      // exactly where the spinner is and they could not be seen at all.
      const rSp0 = Math.max(0.085, 0.17 * S.propR);
      const rI = Math.min(0.070, 0.22 * Math.min(s0.w, hD0));
      for (const sgn of [1, -1]) {
        const cz = sgn * Math.min(0.80 * s0.w * S.cowl.taper - rI,
                                  Math.max(rSp0 + rI + 0.02, 0.52 * s0.w));
        const cy = yc0 - 0.34 * hD0;
        genTubeInto(gcabin, [xNose + 0.004, cy, cz], [xNose + 0.11, cy, cz],
                    rI, 12, eng2, B);
      }
    }
  }
  // the block: crankcase, four cylinders, prop shaft. Its size lives on the spec
  // (S.engBox, 60_gen_spec.js) rather than here, because the COWL has to be able
  // to ask whether it covers the thing — one number, agreed by the cover, the
  // block and the shakedown.
  {
    const E = S.engBox, k = E.k;
    genBoxInto(engine, [E.xF, S.engY - E.halfH, -E.halfW],
                       [E.xA, S.engY + E.halfH, E.halfW], eng2, B);
    for (const sgn of [1, -1]) {
      for (const xc of [S.engX + 0.01 * k, S.engX + 0.14 * k]) {
        genTubeInto(engine, [xc, S.engY - 0.02 * k, sgn * E.halfW],
                    [xc, S.engY + 0.02 * k, sgn * E.cylZ], 0.072 * k, 8, eng2, B);
      }
    }
    genTubeInto(engine, [E.xF, S.engY, 0], [hub[0] + 0.02, S.engY, 0],
                0.035 * k, 8, eng2, B);
  }

  // ---- 3. wing --------------------------------------------------------
  // A section at every spar station, lofted along the span. Chordwise position
  // is affine on the two spar nodes (the spars ARE the chord frame, so the
  // weights are exact and extrapolate past LE and TE); the thickness offset is
  // a rest-frame constant, which is what `base` carries.
  const af = genAirfoil(S.wing.naca);
  const sparF = P.sparFront, sparR = P.sparRear;
  const kOf = xc => (xc - sparF) / (sparR - sparF);
  // Hinge lines follow the chords the player actually set, so a 30% aileron
  // LOOKS like a 30% aileron. The flap band is inboard, the aileron outboard,
  // and clampSpec has already guaranteed the gap between them.
  const CTL = S.controls;
  const aStart = (1 - CTL.aileron.span) * S.geom.semi;
  const AIL_HINGE = 1 - CTL.aileron.chord;
  const FLAP_ON = GEN_FLAPS[CTL.flap.type].dCl > 0;
  const fEnd = FLAP_ON ? CTL.flap.span * S.geom.semi : -1;
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
    const i = Math.min(1, P.wf.L.F.length - 1);
    const nF = P.wf.L.F[i], nR = P.wf.L.R[i];
    // chordwise station of the mast: well aft of the leading edge, so it is
    // clear of the LE radius and sits on a part of the section that is
    // genuinely flat-ish whatever the aerofoil
    const XC = 0.35;
    const chord = P.chordAt(Math.abs(N[nF].p[2]));
    const root = wingSectionAt(N[nF].p, N[nR].p, [[nF, 1]], [[nR, 1]], chord,
                               [genAfEval(S.wing.naca).lo(XC)])[0];
    // the mast drops a fixed distance below the skin, and the probe runs
    // forward from its foot into clean air ahead of the leading edge
    const DROP = 0.22, REACH = 0.24;
    const foot = [root.p[0], root.p[1] - DROP, root.p[2]];
    genTubeInto(pitot, root.p, foot, 0.010, 8, root.infl, B);
    genTubeInto(pitot, foot, [foot[0] - REACH, foot[1], foot[2]], 0.011, 8,
                root.infl, B);
  }
  // `close` wraps the last column back onto the first, which is what turns an
  // open aerofoil contour into a closed tube — needed once a section is cut at
  // a hinge, because then its ends no longer meet at a sharp trailing edge.
  const emitLoft = (rows, mesh, vOf, flip, close) => {
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
  };
  const capLoft = (ids, mesh, flip) => {
    // close a section with a fan to its mid-chord point
    for (const row of ids) {
      const n = row.length;
      for (let h = 1; h < n - 1; h++)
        if (flip) mesh.tri(row[0], row[h+1], row[h]);
        else      mesh.tri(row[0], row[h], row[h+1]);
    }
  };
  const W = S.wing, TIP = GEN_TIPS[W.tip] || GEN_TIPS.rounded;
  // ---- 3b. the wing, and its control surfaces as SEPARATE MESHES ----------
  // The fixed skin is lofted over [0..hinge] and each surface over [hinge..1].
  // They are different groups, so a surface is a rigid body with a pivot and an
  // axis — the viewer turns the MESH. Nothing is deformed, so nothing outside
  // the surface can be dragged along by it (the rounded tip used to swing with
  // the aileron because it happened to carry the aileron's vertex tag).
  const NAF = 9, NSURF = 4;          // chordwise points: fixed part / surface
  for (const [side, fw] of [[1, P.wf.R], [-1, P.wf.L]]) {
    const sd = side > 0 ? 'R' : 'L';
    const zAll = [P.zRoot, ...P.zs];
    const zAilEnd = W.tipR > 1e-6 ? W.tipZ : zAll[zAll.length - 1];
    // which surface owns a station, and where its hinge is
    const bandAt = z => {
      if (z > aStart - 1e-6 && z < zAilEnd + 1e-6) return { n: 'ail', h: AIL_HINGE };
      if (FLAP_ON && z < fEnd + 1e-6 && z > P.zRoot - 1e-6) return { n: 'flap', h: FLAP_HINGE };
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
               chord: P.chordAt(z) };
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
    const spanV = z => (z - P.zRoot) / Math.max(1e-6, S.geom.semi - P.zRoot);
    const ids = emitLoft(fixRows, skin, r => spanV(fixRows[r].z0), flip, true);
    capLoft([ids[0], ids[ids.length-1]], skin, flip);
    // ---- each surface: its own group, its own loft ----
    for (const [nm, gname, drive, sgnA, kA, drive2, sgn2] of [
      // da > 0 rolls right, which is right aileron DOWN (the solver raises that
      // wing's alpha). Signs re-measured after the cut became real: while the
      // "surface" was still a full-chord copy its centroid sat FORWARD of the
      // hinge, so every sign came out inverted and calibrated to the wrong body.
      ['ail',  'ail' + sd,  'da', -1, 1.0, null, 0],
      ['flap', 'flap' + sd, 'flap', -side, 0.70, null, 0],
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
    const CTR = (S.wing.centre === 'glass' || S.wing.centre === 'open')
      ? S.wing.centre : 'solid';
    let rows = [
      wingSection(P.wf.L.F[0], P.wf.L.R[0], S.wing.chord, 0),
      wingSection(P.wf.R.F[0], P.wf.R.R[0], S.wing.chord, 0),
    ];
    // the carry-through IS the root: both rows sit at span fraction 0. Row
    // index put the tip band on one side of it and the wing walk on the other.
    // the aerofoil contour runs TE -> upper -> LE -> lower -> TE, so its first
    // half IS the upper surface and the cut needs no new sampling
    if (CTR === 'open') rows = rows.map(r => r.slice(0, Math.ceil(r.length / 2)));
    emitLoft(rows, CTR === 'glass' ? canopy : skin, () => 0.02);
  }

  // ---- 4. empennage ---------------------------------------------------
  // Mini-wings on a symmetric section, blending their weights from the tail
  // post inboard to the tip node outboard.
  const sym = genAirfoil(9);                               // NACA 0009
  // A tail panel, cut at its hinge exactly like the wing: the fixed part goes
  // into `skin`, the moving part into its OWN group with a pivot and an axis.
  // `mv` names the surface and what drives it; omit it for a panel with no
  // control surface on it.
  const NTAIL = 7, NTSURF = 3;
  const panel = (rowsSpec, hingeFrac, mv) => {
    const spanDir = genV3.norm(genV3.sub(rowsSpec[1].le, rowsSpec[0].le));
    const seg = (a2, b2, n) => genAfSeg(9, a2, b2, n);
    const build = (a2, b2, n) => rowsSpec.map(({ le, te, infl }) => {
      const ch = genV3.norm(genV3.sub(te, le));
      const len = Math.hypot(te[0]-le[0], te[1]-le[1], te[2]-le[2]);
      const nrm = genV3.norm(genV3.cross(ch, spanDir));
      return seg(a2, b2, n).map(([xc, yc]) => ({
        p: genV3.add(genV3.add(le, genV3.mul(ch, xc * len)), genV3.mul(nrm, yc * len)),
        infl, u: xc }));
    });
    const h = mv ? hingeFrac : 1;
    const fixed = build(0, h, NTAIL);
    // v 0.10..1: the root end clears the wing walk (which lives in the first
    // 8% of the panel zone) while the tip still picks up the tip band.
    const tv = r => 0.10 + 0.90 * r / Math.max(1, rowsSpec.length - 1);
    const ids = emitLoft(fixed, skin, tv, false, !!mv);
    capLoft([ids[0], ids[ids.length - 1]], skin);
    if (!mv) return;
    const M = genMesh();
    const rows = build(h, 1, NTSURF);
    const sIds = emitLoft(rows, M, tv, false, true);
    capLoft([sIds[0], sIds[sIds.length - 1]], M);
    // pivot on the hinge line at mid panel; axis along the hinge
    const onHinge = k => {
      const R = rowsSpec[k], ch = genV3.norm(genV3.sub(R.te, R.le));
      const len = Math.hypot(R.te[0]-R.le[0], R.te[1]-R.le[1], R.te[2]-R.le[2]);
      return genV3.add(R.le, genV3.mul(ch, h * len));
    };
    const a0 = onHinge(0), a1 = onHinge(rowsSpec.length - 1);
    const mid = genV3.mul(genV3.add(a0, a1), 0.5);
    CTRL_MESH.push({ group: mv.g, mesh: M, pivot: B(mid),
      axis: genV3.norm(genV3.sub(B(a1), B(a0))),
      drive: mv.drive, sgn: mv.sgn, k: mv.k || 1,
      drive2: mv.drive2 || null, sgn2: mv.sgn2 || 0, k2: mv.k2 || 1,
      infl: rowsSpec[Math.floor(rowsSpec.length / 2)].infl });
  };
  {
    const t = S.tail, hx = t.hX;
    const hy = N[P.HTL].p[1], hz = 0.5 * t.hSpan;
    if (t.type === 'v') {
      // Two canted panels from the tail post out to the tips, and NO fin. The
      // tip nodes already carry the cant (they sit up as well as out), so each
      // panel is just a loft from the post to its own tip.
      const VT = GEN_TIPS[t.tip] || GEN_TIPS.rounded;
      const vpost = [[P.TPB, 0.5], [P.TPT, 0.5]];
      const py = N[P.TPT].p[1] * 0.55 + N[P.TPB].p[1] * 0.45;
      const vRow = (fz, fy, infl, shrink) => {
        const c = t.hChord * (shrink == null ? 1 : shrink);
        const xm = hx + 0.15 * t.hChord;
        return { le: [xm - 0.50*c, fy, fz], te: [xm + 0.50*c, fy, fz], infl };
      };
      for (const [tipN, sgn, vsid] of [[P.HTL, -1, 8], [P.HTR, 1, 7]]) {
        const tz = N[tipN].p[2], ty = N[tipN].p[1];
        const rows = [
          vRow(sgn * 0.10 * Math.abs(tz), py + 0.10 * (ty - py), vpost),
          vRow(tz * 0.55, py + 0.55 * (ty - py), [[tipN, 0.55],
               ...vpost.map(([i, w]) => [i, w * 0.45])]),
          vRow(tz, ty, [[tipN, 1]]),
        ];
        if (VT.round > 0)
          rows.push(vRow(tz + sgn * 0.055 * t.hChord, ty + 0.055 * t.hChord,
                         [[tipN, 1]], VT.round));
        // a V panel is BOTH surfaces: symmetric on the elevator, antisymmetric
        // on the rudder. Two drives, one mesh.
        panel(rows, 0.66, { g: sgn > 0 ? 'vtR' : 'vtL', drive: 'de', sgn: sgn,
                            drive2: 'dr', sgn2: 1 });
      }
      // THE CENTRE SECTION, which is what "the V-tail just intersects" was.
      // Each panel started 10% of the semispan out from the centreline and 10%
      // of the way up, so its root hung in mid air: measured 46 mm clear of the
      // fuselage envelope, and from above you could see the ground between the
      // panel and the body. There was nothing joining the two halves.
      //
      // A fixed loft from the centreline out to each panel's root, so the tail is
      // one continuous surface passing through the fuselage, which is what it is
      // on the aeroplane. Flared 28% in chord at the middle: that flare IS the
      // fillet, and it is where a real V-tail carries its root fairing. FIXED,
      // not part of either ruddervator — which is the whole reason to build it
      // separately, because the two panels deflect differentially on rudder and
      // would saw through each other if they met at the centreline.
      //
      // TWO lofts, one per side, NOT one loft through the middle. `panel` takes
      // its span direction from the first two rows and uses that one normal for
      // every section, so a single V-shaped loft gets the far half's thickness
      // axis wrong — measured, 42 skin vertices with no mirror twin.
      for (const [tipN, sgn] of [[P.HTL, -1], [P.HTR, 1]]) {
        const tz = N[tipN].p[2], ty = N[tipN].p[1];
        panel([vRow(0, py, vpost, 1.28),
               vRow(sgn * 0.10 * Math.abs(tz), py + 0.10 * (ty - py), vpost)],
              1, null);
      }
    } else {
    const post = [[P.TPB, 0.5], [P.TPT, 0.5]];
    const TTIP = GEN_TIPS[t.tip] || GEN_TIPS.rounded;
    // hChord is the MEAN chord (Sh = hSpan * hChord, and the strips' area comes
    // from Sh), so tapering must hold that mean: root = 2 c / (1 + lambda).
    // Planform only — area and aspect ratio are unchanged, so this shapes the
    // stabiliser without quietly re-tuning the pitch authority under it.
    const hRoot = 2 * t.hChord / (1 + t.hTaper);
    const chAt = z => hRoot * (1 - (1 - t.hTaper) * Math.abs(z) / Math.max(1e-6, hz));
    const stabRow = (z, infl, shrink) => {
      const c = chAt(z) * (shrink == null ? 1 : shrink);
      // taper eats forward and aft of the mid-chord so the panel keeps its
      // spanwise axis where the strips put it
      const xm = hx + 0.15 * t.hChord;
      return { le: [xm - 0.50*c, hy, z], te: [xm + 0.50*c, hy, z], infl };
    };
    const stabRows = [
      stabRow(-hz, [[P.HTL, 1]]),
      stabRow(-0.18*hz, [[P.HTL, 0.30], ...post.map(([i,w]) => [i, w*0.70])]),
      stabRow(0.18*hz, [[P.HTR, 0.30], ...post.map(([i,w]) => [i, w*0.70])]),
      stabRow(hz, [[P.HTR, 1]]),
    ];
    // rounded tips on the stabiliser: an extra shrunk row just outboard, the
    // same treatment the wing gets
    if (TTIP.round > 0) {
      const d = 0.055 * t.hChord;
      stabRows.unshift(stabRow(-hz - d, [[P.HTL, 1]], TTIP.round));
      stabRows.push(stabRow(hz + d, [[P.HTR, 1]], TTIP.round));
    }
    panel(stabRows, 0.66, { g: 'elev', drive: 'de', sgn: 1 });
    const vc = t.vChord, vx = t.vX, vy0 = N[P.TPT].p[1], vy1 = N[P.FIN].p[1];
    const finRow = (y, k, sw, shrink) => {
      const c = vc * (shrink == null ? 1 : shrink);
      return { le: [vx - 0.40*vc + sw, y, 0], te: [vx - 0.40*vc + sw + c, y, 0],
        infl: [[P.FIN, k], [P.TPT, (1-k)*0.6], [P.TPB, (1-k)*0.4]] };
    };
    const finRows = [finRow(vy0, 0, 0), finRow(vy0 + 0.5*(vy1-vy0), 0.5, 0.14*vc),
                     finRow(vy1, 1, 0.30*vc)];
    if (TTIP.round > 0)
      finRows.push(finRow(vy1 + 0.055 * vc, 1, 0.30*vc + 0.5*vc*(1-TTIP.round), TTIP.round));
    panel(finRows, 0.60, { g: 'rud', drive: 'dr', sgn: 1 });
    // THE DORSAL FILLET. The fin's root is already buried 22 mm in the tail cone,
    // so there was no gap here — but the joint was a hard corner where a real
    // aeroplane has a fairing running aft along the turtledeck. One extra fixed
    // row below the root with 30% more chord: `finRow` holds the LE and grows the
    // chord AFT, which is the direction a dorsal fillet actually goes.
    panel([finRow(vy0 - 0.07, 0, 0, 1.30), finRows[0]], 1, null);
    }
  }

  // ---- 5. wheels and propeller ----------------------------------------
  // Tyre and wheel are two materials, so they are two meshes, both revolved
  // about the axle from the profiles at the top of this file. The half-width is
  // tied to the radius: an 8.00-6 bush tyre is 0.20 m across a 0.44 m diameter,
  // which is where 0.40 comes from — the old wheels were 0.055 m half-width on
  // a 0.20 m radius and read as hockey pucks.
  const TYRE_W = 0.40;
  // CAMBER leans the mains: positive tips their tops OUTBOARD, so the axle
  // tilts to (0, -sin g, +-cos g) with the sign following which side the wheel
  // is on. The contact height that falls out of it (R cos g) is already on the
  // spec as contactR and is what the solver stands on — the mesh and the
  // physics read the same number. The third wheel never cambers; a nosewheel or
  // tailwheel castors, and a cambered castor is a shimmy.
  const wheel = (nd, r, camber) => {
    const c = N[nd].p, hw = TYRE_W * r, infl = w1(nd);
    const sgn = c[2] < 0 ? -1 : 1;
    const axis = [0, -Math.sin(camber), sgn * Math.cos(camber)];
    genRevolveInto(tyre, c, axis, r, hw, GEN_TYRE_SECT, GEN_WHEEL_SEG, infl, B);
    genRevolveInto(hubM, c, axis, r, hw, GEN_HUB_SECT, GEN_WHEEL_SEG, infl, B);
  };
  wheel(P.GAL, S.gear.wheelR, S.gear.camberRad);
  wheel(P.GAR, S.gear.wheelR, S.gear.camberRad);
  wheel(P.TW, S.gear.twR, 0);
  {
    const eng = [[P.EL, 0.5], [P.ER, 0.5]];
    // the prop mounts DIRECTLY on the cowl's flat nose; the backplate sits a
    // few mm proud of it so the two faces do not z-fight
    const rSp = Math.max(0.075, 0.16 * S.propR), SEG = 12;
    const xBack = hub[0] - 0.006;
    const back = [], tip = prop.v(B([xBack - 1.5*rSp, S.engY, 0]), 0.5, 1, eng);
    for (let h = 0; h <= SEG; h++) {
      const a = 2*Math.PI*(h % SEG)/SEG;
      back.push(prop.v(B([xBack, S.engY + rSp*Math.cos(a), rSp*Math.sin(a)]), h/SEG, 0, eng));
    }
    for (let h = 0; h < SEG; h++) prop.tri(back[h], back[h+1], tip);
    // AS MANY BLADES AS THE SPEC BOUGHT, tapered and twisted, on the disc plane.
    // They used to be two, hardcoded, while the number was a spec field nobody
    // could see. Evenly spaced about the shaft — which is also what keeps the
    // group out of the mirror-symmetry check: a propeller must NOT mirror (both
    // blades twist the same way or it makes no thrust), and the gate exempts it.
    const NB = Math.max(2, Math.round(S.prop.blades));
    for (let b2 = 0; b2 < NB; b2++) {
      const ph = 2 * Math.PI * b2 / NB, cph = Math.cos(ph), sph = Math.sin(ph);
      const r0 = 0.9*rSp, r1 = S.propR;
      const row = [];
      for (let i = 0; i <= 5; i++) {
        const t2 = i/5, r = r0 + (r1-r0)*t2;
        // narrow, tapered, and rounded off at the tip — a blade, not a paddle
        const cw = 0.055*S.propR*(1 - 0.30*t2) * (t2 > 0.88 ? (1 - t2) / 0.12 : 1);
        const tw = (0.34 - 0.27*t2);
        // radial out along the blade, tangential across its chord, both in the
        // disc plane. At phase 0 and pi this is exactly the old two-blade
        // geometry, y-radial with the chord laid across z.
        const cy = S.engY + r*cph, cz = r*sph;
        const ky = -cw*Math.cos(tw)*sph, kz = cw*Math.cos(tw)*cph;
        row.push([
          prop.v(B([hub[0] - cw*Math.sin(tw) - 0.02, cy - ky, cz - kz]), 0, t2, eng),
          prop.v(B([hub[0] + cw*Math.sin(tw) - 0.02, cy + ky, cz + kz]), 1, t2, eng),
        ]);
      }
      for (let i = 0; i < row.length - 1; i++)
        prop.quad(row[i][0], row[i][1], row[i+1][1], row[i+1][0]);
    }
  }

  // ---- 6. control surface hinges --------------------------------------
  // Analytic, because the geometry is known. (An imported model has to have
  // these least-squares fitted off the mesh — see MODEL-IMPORT-PROC.md.)
  const bp = p => B(p);
  const hingeAxis = (a, b) => {
    const d = genV3.norm(genV3.sub(bp(b), bp(a)));
    return d;
  };
  const t = S.tail;
  const stabY = N[P.HTL].p[1];
  const semi = S.geom.semi, zA = 0.5 * (aStart + semi);
  // THE SURFACE TABLE. Its length and ORDER are a contract: a skin vertex
  // carries `sid` and the hinge pass resolves surfaces[sid-1], so an entry can
  // never be dropped for a configuration that lacks it — that renumbers
  // everything after it. Every entry is always present; the ones this aeroplane
  // does not have are made inert with k:0. (Learned the hard way on the V-tail:
  // removing the rudder sent the ailerons reading past the end of the array.)
  //
  //   1 elevator   2 rudder   3 ailR   4 ailL
  //   5 flapR      6 flapL    7 vtailR 8 vtailL
  const isV = t.type === 'v';
  const FLAP_K = 0.70;             // ~40 deg at ctl.flap = 1, which is full flap
  const zF = 0.5 * (P.zRoot + Math.max(P.zRoot + 0.1, fEnd));
  // SIGNS. The left and right hinge AXES are mirrored (they run out along their
  // own semispan), so an equal `sgn` on the two sides produces OPPOSITE motion
  // in the world and a mirrored `sgn` produces the SAME motion. That inversion
  // is why the ailerons had been deflecting together — measured, both wings
  // +0.020 m on da — and why every pair below looks back-to-front at a glance.
  //   ailerons  antisymmetric -> equal sgn
  //   flaps     symmetric     -> mirrored sgn
  const flapSurf = (sgn2side) => ({
    name: sgn2side > 0 ? 'flapR' : 'flapL', drive: 'flap', sgn: -sgn2side,
    k: FLAP_ON ? FLAP_K : 0,
    p: bp([P.xFat(zF) + (FLAP_HINGE - sparF) * P.chordAt(zF),
           P.yF(zF), sgn2side * zF]),
    ax: hingeAxis([0, P.yF(P.zRoot), sgn2side * P.zRoot],
                  [0, P.yF(Math.max(P.zRoot + 0.1, fEnd)),
                   sgn2side * Math.max(P.zRoot + 0.1, fEnd)]),
  });
  // A V-tail panel is BOTH surfaces at once: symmetric on the elevator,
  // antisymmetric on the rudder. Hence drive2.
  const vSurf = (tipN, sd) => {
    const tip = N[tipN].p, post = [t.hX, N[P.TPT].p[1] * 0.55 + N[P.TPB].p[1] * 0.45, 0];
    const mid = [0.5*(tip[0]+post[0]), 0.5*(tip[1]+post[1]), 0.5*(tip[2]+post[2])];
    return { name: sd > 0 ? 'vtailR' : 'vtailL',
      // elevator half: SYMMETRIC, so mirrored sgn. rudder half: ANTIsymmetric,
      // so equal sgn. The two halves of a ruddervator want opposite conventions.
      drive: 'de', sgn: sd, k: isV ? 1.0 : 0,
      drive2: 'dr', sgn2: 1, k2: isV ? 1.0 : 0,
      p: bp([t.hX + 0.15 * t.hChord, mid[1], mid[2]]),
      ax: hingeAxis([0, post[1], post[2]], [0, tip[1], tip[2]]) };
  };
  const surfaces = [
    { name: 'elevator', drive: 'de', sgn: 1, k: isV ? 0 : 1.0,
      p: bp([t.hX + 0.31 * t.hChord, stabY, 0]),
      ax: hingeAxis([t.hX + 0.31*t.hChord, stabY, -1], [t.hX + 0.31*t.hChord, stabY, 1]) },
    { name: 'rudder', drive: 'dr', sgn: 1, k: (isV || P.FIN == null) ? 0 : 1.0,
      p: bp([t.vX + 0.20 * t.vChord, N[P.TPT].p[1], 0]),
      ax: hingeAxis([t.vX + 0.20*t.vChord, N[P.TPT].p[1], 0],
                    [t.vX + 0.20*t.vChord + 0.30*t.vChord,
                     P.FIN == null ? N[P.TPT].p[1] + 1 : N[P.FIN].p[1], 0]) },
    { name: 'ailR', drive: 'da', sgn: 1, k: 1.0,
      p: bp([P.xFat(zA) + (AIL_HINGE - sparF) * P.chordAt(zA), P.yF(zA), zA]),
      ax: hingeAxis([0, P.yF(aStart), aStart], [0, P.yF(semi), semi]) },
    { name: 'ailL', drive: 'da', sgn: 1, k: 1.0,   // equal, not mirrored: see above
      p: bp([P.xFat(zA) + (AIL_HINGE - sparF) * P.chordAt(zA), P.yF(zA), -zA]),
      ax: hingeAxis([0, P.yF(aStart), -aStart], [0, P.yF(semi), -semi]) },
    flapSurf(1), flapSurf(-1),
    vSurf(P.HTR, 1), vSurf(P.HTL, -1),
  ];


  // ---- 2h. SEATS -------------------------------------------------------
  // A light aeroplane's seat is a welded tube frame with two cushions laced or
  // dropped into it: a squab on a shallow pan and a back that rakes about 12
  // degrees, both piped round the edge, both fluted into panels by the seams the
  // upholsterer runs to stop the filling migrating. That is four things — frame,
  // pan, cushion, piping — and leaving any of them out is what makes a seat read
  // as a box. Nothing here is a primitive: the cushions are PUFFED SLABS, i.e. a
  // grid whose thickness falls to zero at the rim on a soft power curve and is
  // grooved along the seam lines, which is how a filled cushion actually sits.
  //
  // Everything binds to the cabin frames it stands between, with the same
  // bilinear weights the covering uses, so the seats flex with the fuselage.
  {
    const cb = S.cab;
    const seatsN = S.seating === 'drone' ? 0 : (S.seating === 'single' ? 1 : 2);
    // where the frames put them: tandem down the centreline, side-by-side across
    // SEAT STATION. An OFFSET from where the layout puts them, so it rides along
    // when the cabin moves instead of pinning the seats to an absolute x — and
    // so zero means "right" in every layout rather than in one of them.
    //
    // RE-ZEROED (user, 2026-08-11). The base used to be the cabin front for all
    // layouts, and the two layouts do not want the same station: a tandem's
    // front seat sits well aft of the firewall (the panel, the tank and the
    // rudder pedals are in front of it), while a side-by-side is one row on the
    // cabin's own centre. Measured on the two builds the user calibrated, the
    // good stations were +0.41 tandem and -0.03 side by side against the old
    // common base — 0.44 m apart, which is that difference. Both are folded into
    // the base here, so the slider is now a nudge about a correct default in
    // either layout and neither carries a constant the other has to undo.
    const SEAT_BASE = { side2: -0.03, tandem2: 0.41, single: 0.41, drone: 0 };
    const sdx = (SEAT_BASE[S.seating] ?? 0.41)
              + genClamp(cb.seatX == null ? 0 : cb.seatX, -0.45, 0.45);
    const x0 = cb.noseGap + sdx, xL = Math.max(0.35, cb.len);
    const places = [];
    if (seatsN === 1) places.push([x0 + 0.50 * xL, 0]);
    else if (S.seating === 'side2') {
      const dz = Math.min(0.30, cb.halfW * 0.50);
      places.push([x0 + 0.52 * xL, -dz], [x0 + 0.52 * xL, dz]);
    } else if (seatsN === 2) {
      // TANDEM PITCH IS A REAL DISTANCE, not a fraction of the cabin. It was
      // 0.46 of the cabin length, and `tandem2` sizes its box at 0.78 m — so the
      // two seats came out 0.36 m apart and the back-seater had nowhere to put
      // his knees. A tandem aeroplane's seat pitch is 0.80-0.95 m whatever the
      // fuselage does, so that is what this is: a metre value, defaulting to the
      // cabin's own length where the cabin is long enough to beat it.
      const pitch = genClamp(cb.seatPitch == null ? 0.86 : cb.seatPitch, 0.55, 1.35);
      const mid = x0 + 0.53 * xL;
      places.push([mid - 0.5 * pitch, 0], [mid + 0.5 * pitch, 0]);
    }
    // bilinear cabin weights at a point, exactly the covering's formula
    const cabInfl = (x, y, z) => {
      let i0 = 0;
      for (let i = 0; i < ST.length - 1; i++) if (ST[i].x <= x) i0 = i;
      const i1 = Math.min(ST.length - 1, i0 + 1);
      const t = Math.max(0, Math.min(1, (x - ST[i0].x) / Math.max(1e-6, ST[i1].x - ST[i0].x)));
      const w = ST[i0].w + (ST[i1].w - ST[i0].w) * t;
      const yb = ST[i0].yb + (ST[i1].yb - ST[i0].yb) * t;
      const yt = ST[i0].yt + (ST[i1].yt - ST[i0].yt) * t;
      const uz = Math.max(-1, Math.min(1, z / Math.max(1e-6, w)));
      const uy = Math.max(-1, Math.min(1, (y - 0.5 * (yb + yt)) / Math.max(1e-6, 0.5 * (yt - yb))));
      const wL = 0.5*(1-uz), wR = 0.5*(1+uz), wT = 0.5*(1+uy), wB = 0.5*(1-uy);
      const A = F[i0], C = F[i1], kA = 1 - t, kB = t;
      return [[A.TL, kA*wT*wL], [A.TR, kA*wT*wR], [A.BL, kA*wB*wL], [A.BR, kA*wB*wR],
              [C.TL, kB*wT*wL], [C.TR, kB*wT*wR], [C.BL, kB*wB*wL], [C.BR, kB*wB*wR]];
    };
    // A PUFFED SLAB. `ori` maps (across, along, up) into body axes, so the same
    // builder makes the squab lying down and the back standing up. `flutes` is
    // how many seams run ACROSS it; the grooves are gaussian, not steps, because
    // a seam pulls the filling down over a finite width.
    const cushion = (ctr, hw, hd, th, ori, flutes, tuck) => {
      const NU = 14, NV = 16;
      const P3 = (a, b, up) => {
        const p = [0, 0, 0];
        for (let k = 0; k < 3; k++)
          p[k] = ctr[k] + ori[0][k] * a * hw + ori[1][k] * b * hd + ori[2][k] * up;
        return p;
      };
      // ROUNDER than a slab with soft corners: the exponent pair sets how far in
      // from the rim the filling starts to rise, and a cushion rises fast and
      // then sits nearly flat. 3 / 0.45 is a filled squab; 5 / 0.30 was a board.
      const puff = (a, b) => Math.pow(Math.max(0, 1 - Math.pow(Math.abs(a), 3)), 0.45)
                           * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(b), 3)), 0.45);
      const groove = b => {
        let g = 1;
        for (let f = 1; f <= flutes; f++) {
          const bf = -1 + 2 * f / (flutes + 1);
          const d = (b - bf) / 0.085;
          g -= 0.30 * Math.exp(-d * d);
        }
        return Math.max(0.45, g);
      };
      const grid = (sgn) => {
        const rows = [];
        for (let i = 0; i <= NU; i++) {
          const a = -1 + 2 * i / NU, row = [];
          for (let j = 0; j <= NV; j++) {
            const b = -1 + 2 * j / NV;
            const pf = puff(a, b);
            // the top face is the filled one; the underside is shallow and, on a
            // squab, tucked where it meets the pan
            const up = sgn > 0 ? th * pf * groove(b)
                               : -th * pf * (tuck ? 0.20 : 0.45);
            const p = P3(a, b, up);
            row.push(seat.v(B(p), 0.5 + 0.5 * a, 0.5 + 0.5 * b, cabInfl(p[0], p[1], p[2])));
          }
          rows.push(row);
        }
        return rows;
      };
      const top = grid(1), bot = grid(-1);
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
        seat.quad(top[i][j], top[i][j+1], top[i+1][j+1], top[i+1][j]);
        seat.quad(bot[i][j], bot[i+1][j], bot[i+1][j+1], bot[i][j+1]);
      }
      // PIPING round the rim: the welt an upholsterer sews into the seam. It is
      // the line that gives a cushion its shape at a distance, so it is its own
      // material in the trim colour.
      const rim = [];
      for (let j = 0; j <= NV; j++) rim.push([-1, -1 + 2*j/NV]);
      for (let i = 1; i <= NU; i++) rim.push([-1 + 2*i/NU, 1]);
      for (let j = NV - 1; j >= 0; j--) rim.push([1, -1 + 2*j/NV]);
      for (let i = NU - 1; i >= 0; i--) rim.push([-1 + 2*i/NU, -1]);
      for (let k = 0; k < rim.length - 1; k++) {
        const A = P3(rim[k][0], rim[k][1], 0), C = P3(rim[k+1][0], rim[k+1][1], 0);
        genTubeInto(spipe, A, C, 0.009, 6, cabInfl(A[0], A[1], A[2]), B);
      }
    };
    const tube = (a, c, r) => genTubeInto(sframe, a, c, r || 0.014, 8,
                                          cabInfl(a[0], a[1], a[2]), B);
    const PIL = S.cabin.pilot || {};
    let seatIdx = 0;
    for (const [sx, sz] of places) {
      const floor = -0.01;                       // cabin floor, above the keel
      const hw = Math.min(0.24, (S.seating === 'side2' ? cb.halfW * 0.42 : cb.halfW * 0.80));
      // SQUAB HEIGHT above the cabin floor. The seat is what sets the pilot's
      // eye line and whether his knees clear the panel, so it is a control and
      // not the 0.20 m it was pinned at.
      const panY = floor + genClamp(cb.seatY == null ? 0.20 : cb.seatY, 0.06, 0.50);
      const rake = 13 * Math.PI / 180;           // back angle
      const backH = Math.min(0.56, cb.h * 0.60);
      // the squab: lying flat, a touch nose-down so you do not slide out
      cushion([sx, panY, sz], hw, 0.22, 0.075,
              [[0, 0, 1], [1, -0.06, 0], [0, 1, 0]], 2, true);
      // the back: standing up, raked aft about its foot
      const bc = Math.cos(rake), bs = Math.sin(rake);
      cushion([sx + 0.20 + 0.5 * backH * bs, panY + 0.02 + 0.5 * backH * bc, sz],
              hw * 0.96, 0.5 * backH, 0.062,
              [[0, 0, 1], [bs, bc, 0], [-bc, bs, 0]], 3, false);
      // ---- the frame: two side loops and the cross tubes between them ----
      for (const s2 of [-1, 1]) {
        const zz = sz + s2 * (hw + 0.012);
        const front = [sx - 0.21, floor, zz], frontT = [sx - 0.19, panY - 0.03, zz];
        const rear = [sx + 0.20, floor, zz], rearT = [sx + 0.19, panY - 0.03, zz];
        const backT = [sx + 0.20 + backH * bs, panY - 0.02 + backH * bc, zz];
        tube(front, frontT);                     // front leg
        tube(rear, rearT);                       // rear leg
        tube(frontT, rearT);                     // seat rail
        tube(rearT, backT, 0.013);               // back upright
        tube(front, rearT, 0.010);               // the diagonal every seat has
      }
      const zl = sz - (hw + 0.012), zr = sz + (hw + 0.012);
      tube([sx - 0.19, panY - 0.03, zl], [sx - 0.19, panY - 0.03, zr], 0.012);
      tube([sx + 0.19, panY - 0.03, zl], [sx + 0.19, panY - 0.03, zr], 0.012);
      tube([sx - 0.21, floor, zl], [sx - 0.21, floor, zr], 0.011);
      tube([sx + 0.20, floor, zl], [sx + 0.20, floor, zr], 0.011);
      // the top rail, which is what you grab climbing in
      tube([sx + 0.20 + backH * bs, panY - 0.02 + backH * bc, zl],
           [sx + 0.20 + backH * bs, panY - 0.02 + backH * bc, zr], 0.013);
      // ---- LAP BELTS, hanging ------------------------------------------
      // Anchored at the rear corners of the frame, laid over the squab's rim and
      // left hanging down the front, which is how a lap belt sits in an unoccupied
      // aeroplane and what stops the seat reading as furniture. A RIBBON, not a
      // tube: webbing is flat, and its flatness is most of what identifies it.
      const ribbon = (pts, wid, tw) => {
        let prev = null;
        for (let k = 0; k < pts.length - 1; k++) {
          const A = pts[k], C = pts[k+1];
          const ax = genV3.norm(genV3.sub(C, A));
          // the strap's width lies across the path and level; the twist rolls it
          // over as it goes over the rim, which is what webbing does
          let across = genV3.norm(genV3.cross(ax, [0, 1, 0]));
          if (!isFinite(across[0])) across = [0, 0, 1];
          const th = (tw || 0) * (k / Math.max(1, pts.length - 2));
          const up = genV3.norm(genV3.cross(across, ax));
          const e1 = [across[0]*Math.cos(th) + up[0]*Math.sin(th),
                      across[1]*Math.cos(th) + up[1]*Math.sin(th),
                      across[2]*Math.cos(th) + up[2]*Math.sin(th)];
          const e2 = genV3.mul(genV3.norm(genV3.cross(ax, e1)), 0.0035);
          const quadAt = (Pt) => [0, 1, 2, 3].map(q => {
            const sgnW = (q === 0 || q === 3) ? -1 : 1, sgnT = q < 2 ? 1 : -1;
            const p = [0, 0, 0];
            for (let c2 = 0; c2 < 3; c2++)
              p[c2] = Pt[c2] + e1[c2] * sgnW * 0.5 * wid + e2[c2] * sgnT;
            return belt.v(B(p), q < 2 ? 0 : 1, k / (pts.length - 1),
                          cabInfl(p[0], p[1], p[2]));
          });
          const a4 = prev || quadAt(A), c4 = quadAt(C);
          belt.quad(a4[0], a4[1], c4[1], c4[0]);
          belt.quad(a4[3], c4[3], c4[2], a4[2]);
          belt.quad(a4[0], c4[0], c4[3], a4[3]);
          belt.quad(a4[1], a4[2], c4[2], c4[1]);
          prev = c4;
        }
      };
      for (const s3 of [-1, 1]) {
        const zz = sz + s3 * (hw + 0.010);
        ribbon([
          [sx + 0.19, panY - 0.045, zz],
          [sx + 0.10, panY + 0.015, sz + s3 * hw * 0.96],
          [sx - 0.06, panY + 0.020, sz + s3 * hw * 0.88],
          [sx - 0.17, panY - 0.055, sz + s3 * hw * 0.80],
          [sx - 0.19, panY - 0.155, sz + s3 * hw * 0.74],
          [sx - 0.17, panY - 0.235, sz + s3 * hw * 0.72],
        ], 0.048, 0.5);
        // the hardware at the loose end: a buckle on one side, the tongue on the
        // other, both hanging where the webbing left off
        const bx = sx - 0.17, by = panY - 0.255, bz = sz + s3 * hw * 0.72;
        const inf = cabInfl(bx, by, bz);
        if (s3 > 0) genBoxInto(buckle, [bx - 0.030, by - 0.036, bz - 0.026],
                                       [bx + 0.030, by + 0.010, bz - 0.018], inf, B);
        else genBoxInto(buckle, [bx - 0.016, by - 0.050, bz + 0.018],
                                [bx + 0.016, by + 0.010, bz + 0.024], inf, B);
      }
      // ---- 2i. THE DUMMY ------------------------------------------------
      // A crash-test dummy, because an empty cockpit has no scale and a figure
      // with a face has an expression to get wrong. It is a small FORWARD-
      // KINEMATIC RIG: joint centres are anthropometric fractions of the stature,
      // the pose is seven angles, and every segment is a tapered capsule between
      // two of those centres — so the limbs cannot come apart, whatever the pose
      // or the cabin does. The rig is anchored at the HIP on the squab, because
      // sitting height is what has to fit, and every chain hangs off the one
      // before it: move the hip and the whole figure goes with it.
      if (PIL.show !== false && seatIdx < S.crew) {
        const H = genClamp(PIL.stature == null ? 1.75 : PIL.stature, 1.45, 2.05);
        const D2 = Math.PI / 180;
        const ang = (v, d) => (v == null ? d : v) * D2;
        const lean = ang(PIL.lean, 13), thighA = ang(PIL.thigh, 6);
        const shankA = ang(PIL.shank, 56), armA = ang(PIL.armDown, 40);
        const foreA = ang(PIL.fore, 6), headA = ang(PIL.head, 0);
        // ARMS IN. A canopy can be narrower than a pair of elbows, so the upper
        // arm's outboard splay is a control and not a constant: `armIn` subtracts
        // from it, and the forearm follows by a third of the same, which is how a
        // real elbow tucks (the shoulder adducts, the forearm mostly doesn't).
        const armIn = ang(PIL.armIn, 0);
        // FEET. `ankle` is the foot's pitch about the ankle joint, positive toes
        // UP — a pilot on the rudder pedals has them up, a pilot with feet on the
        // floor has them level. `toeOut` splays them.
        const ankA = ang(PIL.ankle, 10), toeOut = ang(PIL.toeOut, 7);
        // THE HIP AND THE KNEE, outboard. `thigh` and `shank` are the FLEXION
        // angles — how far below horizontal each segment runs — and they were the
        // only leg controls there were. These are the other axis: how far the
        // knees splay from the centreline, which is what a narrow cockpit or a
        // tank between the legs actually constrains. Same convention as the arm:
        // the hip carries it and the knee adds its own.
        const hipOut = ang(PIL.hipOut, 9), kneeOut = ang(PIL.kneeOut, 3);
        // segment lengths as fractions of stature (Drillis & Contini)
        const Lthigh = 0.245*H, Lshank = 0.246*H, Lfoot = 0.152*H;
        const Ltorso = 0.288*H, Lneck = 0.052*H, Lhead = 0.130*H;
        const Lupper = 0.186*H, Lfore = 0.146*H, Lhand = 0.108*H;
        const wHip = 0.070*H, wSho = 0.105*H;
        const add = genV3.add, mul = genV3.mul;
        // ---- a tapered CAPSULE between two joint centres --------------------
        // Round ends by construction: the profile runs from -rA to L + rB and
        // closes on a sphere at each cap, so two segments sharing a joint centre
        // always overlap and a limb cannot show a gap however it is posed.
        const capsule = (M, A, C, rA, rB, kz) => {
          const d = genV3.sub(C, A), L = Math.hypot(d[0], d[1], d[2]) || 1e-6;
          const ax = mul(d, 1 / L);
          const upv = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
          const e1 = genV3.norm(genV3.cross(ax, upv)), e2 = genV3.cross(ax, e1);
          const NL = 9, NC = 9, rows = [];
          for (let i = 0; i <= NL; i++) {
            const x = -rA + (L + rA + rB) * i / NL;
            const u = Math.max(0, Math.min(1, x / L));
            let r = rA + (rB - rA) * u;
            if (x < 0) r *= Math.sqrt(Math.max(0, 1 - (x / rA) * (x / rA)));
            else if (x > L) r *= Math.sqrt(Math.max(0, 1 - ((x - L) / rB) * ((x - L) / rB)));
            const base = add(A, mul(ax, x)), row = [];
            for (let h = 0; h <= NC; h++) {
              const a2 = 2 * Math.PI * (h % NC) / NC;
              const p = [0, 0, 0];
              for (let k = 0; k < 3; k++)
                p[k] = base[k] + e1[k] * r * Math.cos(a2)
                               + e2[k] * r * (kz || 1) * Math.sin(a2);
              row.push(M.v(B(p), h / NC, i / NL, cabInfl(p[0], p[1], p[2])));
            }
            rows.push(row);
          }
          for (let i = 0; i < NL; i++) for (let h = 0; h < NC; h++)
            M.quad(rows[i][h], rows[i][h+1], rows[i+1][h+1], rows[i+1][h]);
        };
        const ball = (M, c, r) => capsule(M, [c[0] - 1e-4, c[1], c[2]],
                                             [c[0] + 1e-4, c[1], c[2]], r, r, 1);
        const hip = [sx + 0.055, panY + 0.085, sz];
        // a limb direction: `a` below the forward horizontal, `out` outboard
        const dir = (a, out) => [-Math.cos(a) * Math.cos(out), -Math.sin(a),
                                 Math.cos(a) * Math.sin(out)];
        const sho0 = add(hip, [Math.sin(lean) * Ltorso, Math.cos(lean) * Ltorso, 0]);
        const neck = add(sho0, [Math.sin(lean) * Lneck * 1.25, Math.cos(lean) * Lneck * 1.25, 0]);
        const headC = add(neck, [Math.sin(lean + headA) * 0.62 * Lhead,
                                 Math.cos(lean + headA) * 0.62 * Lhead, 0]);
        // TORSO, to real proportions. `kz` scales the fore-and-aft axis against
        // the lateral radius, and it was ABOVE 1 — a body deeper than it is wide,
        // which is a barrel, not a person. Anthropometry at H = 1.75: shoulder
        // breadth 0.45 m against a chest depth of 0.24, hip breadth 0.36 against
        // 0.23. So the radius is the HALF-BREADTH and kz is depth/breadth, both
        // under 0.7. Pelvis and chest also taper through a waist rather than
        // running one width from seat to shoulder.
        const wPelv = 0.103 * H, wWaist = 0.088 * H, wChest = 0.126 * H;
        const midT = add(hip, mul(genV3.sub(sho0, hip), 0.42));
        capsule(dumm, hip, midT, wPelv, wWaist, 0.64);
        capsule(dumm, add(hip, mul(genV3.sub(sho0, hip), 0.36)), sho0,
                wWaist, wChest, 0.55);
        capsule(dumj, sho0, neck, 0.034 * H, 0.031 * H, 0.95);
        // ---- THE HEAD, as a real ovoid --------------------------------------
        // It was a capsule, i.e. a cylinder with two hemispheres — which is a
        // pill, and reads as one. This is a triaxial ellipsoid on the head's own
        // axis (length 0.23 m, breadth 0.15, depth 0.19 at H = 1.75, which are the
        // measured ones), with a slight egg: the section shrinks toward the chin
        // and swells toward the crown, on a smooth curve rather than a taper, so
        // there is no seam anywhere on it.
        const ovoid = (M, c, ax0, rAx, rLat, rDep, egg) => {
          const ax = genV3.norm(ax0);
          const e1 = genV3.norm(genV3.cross(ax, Math.abs(ax[1]) > 0.9 ? [1,0,0] : [0,1,0]));
          const e2 = genV3.cross(ax, e1);
          const NV = 14, NU = 16, rows = [];
          for (let i = 0; i <= NV; i++) {
            const t = i / NV, ph = Math.PI * t;              // 0 = chin, pi = crown
            const y = -Math.cos(ph), rr = Math.sin(ph);
            // the egg: a smooth fore-aft-symmetric bias, fattest above the middle
            const k = 1 + (egg || 0) * (0.5 - Math.abs(0.5 - t)) * (t - 0.5) * 2.2;
            const base = add(c, mul(ax, y * rAx)), row = [];
            for (let h = 0; h <= NU; h++) {
              const a2 = 2 * Math.PI * (h % NU) / NU;
              const p = [0, 0, 0];
              for (let q = 0; q < 3; q++)
                p[q] = base[q] + e1[q] * rLat * k * rr * Math.cos(a2)
                               + e2[q] * rDep * k * rr * Math.sin(a2);
              row.push(M.v(B(p), h / NU, t, cabInfl(p[0], p[1], p[2])));
            }
            rows.push(row);
          }
          for (let i = 0; i < NV; i++) for (let h = 0; h < NU; h++)
            M.quad(rows[i][h], rows[i][h+1], rows[i+1][h+1], rows[i+1][h]);
        };
        {
          const hax = genV3.norm(genV3.sub(headC, neck));
          // the centre sits a head-radius up the axis from the neck joint, so the
          // jaw closes on the neck however the head is tilted
          // clear of the shoulders by a neck's worth: with the centre exactly one
          // head-radius up, the jaw sat ON the chest and the neck never showed
          const hc = add(neck, mul(hax, 0.090 * H));
          ovoid(dumm, hc, hax, 0.068 * H, 0.044 * H, 0.056 * H, 0.34);
        }
        const disc = (c, r, nrm) => {
          const e1 = genV3.norm(genV3.cross(nrm, [0, 1, 0]));
          const e2 = genV3.norm(genV3.cross(nrm, e1));
          const ring = [], ctr = dumk.v(B(c), 0.5, 0.5, cabInfl(c[0], c[1], c[2]));
          for (let h = 0; h <= 14; h++) {
            const a2 = 2 * Math.PI * (h % 14) / 14;
            const p = [0, 0, 0];
            for (let k = 0; k < 3; k++)
              p[k] = c[k] + e1[k] * r * Math.cos(a2) + e2[k] * r * Math.sin(a2);
            ring.push(dumk.v(B(p), 0.5 + 0.5 * Math.cos(a2), 0.5 + 0.5 * Math.sin(a2),
                             cabInfl(p[0], p[1], p[2])));
          }
          for (let h = 0; h < 14; h++) dumk.tri(ctr, ring[h], ring[h+1]);
        };
        for (const sd of [-1, 1]) {
          // ---- leg: hip -> knee -> ankle -> toe ----
          const hipJ = add(hip, [0, 0, sd * wHip]);
          const knee = add(hipJ, mul(dir(thighA, sd * hipOut), Lthigh));
          const ankle = add(knee, mul(dir(shankA, sd * (hipOut + kneeOut) * 0.35), Lshank));
          // ---- THE FOOT ----
          // Heel behind and below the ankle, toe ahead of it, and the shoe
          // between them: a flat wedge, wider and blunter at the toe. The whole
          // thing pivots about the ankle by `ankle` degrees (toes up positive) and
          // splays by `toeOut`, so it can sit on a pedal or flat on the floor.
          const fc = Math.cos(toeOut), fs = Math.sin(toeOut);
          const fwd = [-Math.cos(ankA) * fc, Math.sin(ankA), sd * fc * fs +
                       sd * 0.02];
          const heel = add(ankle, [Lfoot * 0.26 * Math.cos(ankA) * fc,
                                   -0.052 * H - Lfoot * 0.26 * Math.sin(ankA),
                                   -sd * 0.01]);
          const toe = add(heel, mul(genV3.norm(fwd), Lfoot));
          ball(dumj, hipJ, 0.050 * H);
          capsule(dumm, hipJ, knee, 0.058 * H, 0.044 * H, 1);
          ball(dumj, knee, 0.044 * H);
          capsule(dumm, knee, ankle, 0.042 * H, 0.030 * H, 1);
          ball(dumj, ankle, 0.029 * H);
          // ankle to heel, then the shoe: kz < 1 flattens it, because for a
          // near-horizontal segment the capsule's kz axis IS the vertical one
          capsule(dumm, ankle, heel, 0.028 * H, 0.030 * H, 0.85);
          capsule(dumm, heel, add(heel, mul(genV3.sub(toe, heel), 0.94)),
                  0.032 * H, 0.036 * H, 0.52);
          // ---- arm: shoulder -> elbow -> wrist -> hand ----
          const shoJ = add(sho0, [0, 0, sd * wSho]);
          const elb = add(shoJ, mul(dir(armA, sd * Math.max(-0.10, 0.34 - armIn)), Lupper));
          const wri = add(elb, mul(dir(foreA, sd * Math.max(-0.12, 0.10 - armIn / 3)), Lfore));
          const hnd = add(wri, mul(dir(foreA, sd * Math.max(-0.14, 0.06 - armIn / 3)),
                                   0.55 * Lhand));
          ball(dumj, shoJ, 0.046 * H);
          capsule(dumm, shoJ, elb, 0.042 * H, 0.032 * H, 1);
          ball(dumj, elb, 0.032 * H);
          capsule(dumm, elb, wri, 0.030 * H, 0.024 * H, 1);
          ball(dumj, wri, 0.023 * H);
          capsule(dumm, wri, hnd, 0.026 * H, 0.022 * H, 0.62);
          // CALIBRATION ROUNDELS: the yellow discs a dummy carries on the head
          // and the chest for the high-speed cameras. Flat, a few mm proud.
          disc(add(add(neck, mul(genV3.norm(genV3.sub(headC, neck)), 0.070 * H)),
                       [0, 0, sd * 0.046 * H]), 0.019 * H, [0, 0, sd]);
        }
        disc(add(sho0, [-0.072 * H, -0.055 * H, 0]), 0.024 * H, [-1, 0, 0]);
      }
      seatIdx++;
    }
  }

  const groups = {};
  const put = (nm, M) => { const g = M.done(); if (g.nv) groups[nm] = g; };
  put('skin', skin); put('cowl', cowl); put('frame', frame);
  put('engine', engine); put('gearmetal', strut); put('tyre', tyre); put('prop', prop);
  put('wheelhub', hubM); put('rubber', rubber);
  put('decal', decal);
  // glazing in three layers, and the exhaust stacks
  put('glass', glass); put('gcabin', gcabin); put('gframe', gframe);
  put('exhaust', exhaust);
  put('liftstrut', liftstrut); put('pitot', pitot);
  put('dash', dash); put('intr', intr);
  put('seat', seat); put('spipe', spipe); put('sframe', sframe);
  put('belt', belt); put('buckle', buckle);
  put('dumm', dumm); put('dumj', dumj); put('dumk', dumk);
  put('glazed', glazed); put('canopy', canopy); put('ctop', ctop); put('cframe', cframe);
  // Control surfaces are their OWN groups. `moving` is the contract with the
  // viewer: a group name, the point it turns about, the axis it turns on, and
  // what drives it. The viewer rotates the mesh — there is no per-vertex hinge
  // pass for a generated aeroplane any more.
  const moving = [];
  for (const c of CTRL_MESH) {
    put(c.group, c.mesh);
    if (!groups[c.group]) continue;
    moving.push({ group: c.group, p: c.pivot, ax: c.axis, infl: c.infl,
                  drive: c.drive, sgn: c.sgn, k: c.k,
                  drive2: c.drive2 || null, sgn2: c.sgn2 || 0 });
  }
  return {
    v: 5, generated: true,
    // DATA maps, not colour: the viewer must decode these LINEAR.
    linTex: ['bump', 'mr'],
    // WHAT COUNTS AS COVERING, declared here rather than transcribed in the
    // viewer. Frame mode hides all of it; covered mode hides the truss and the
    // engine instead. This list has to be exactly right or the glazing floats in
    // mid-air over a bare truss — and it drifted twice while it lived in
    // app.js, once per handoff, because a group added here is invisible to a
    // list maintained over there. The generator knows what it built; the viewer
    // does not need to guess.
    //
    // Everything NOT named here shows in both modes, which is correct for the
    // things that hang outside any covering: liftstrut, gearmetal, rubber,
    // exhaust, prop, tyre, wheelhub.
    // The control surfaces are in it too, and they are appended rather than
    // listed because they are named by 3b — a hard-coded copy would go stale the
    // first time a surface is added. They were NOT hidden before this list
    // existed (app.js hid only `skin` and `cowl`), so Frame mode showed painted
    // fabric ailerons, elevator and rudder floating at the trailing edges of a
    // bare truss. The wing carries 68 real beams, so there is structure to see
    // underneath them.
    cover: ['skin', 'cowl', 'decal', 'intr',
            'glass', 'glazed', 'gcabin', 'gframe',
            'canopy', 'cframe', 'ctop',
            'dash', 'seat', 'spipe', 'sframe', 'belt', 'buckle',
            'dumm', 'dumj', 'dumk'].concat(moving.map(m => m.group)),
    hub: B(hub),
    groups, surfaces, moving,
    mats: {
      // the viewer bakes `paint` procedurally (src/viewer/garage.js) and drops
      // it in before the material is built; without it this falls back to flat
      skin:      { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      // the registration, on its own transparent sheet just off the skin
      decal:     { tex: 'reg', rough: 1 - S.paint.gloss, alphaTest: 0.45 },
      // control surfaces are painted with the aeroplane, not against it
      ailR:      { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      ailL:      { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      flapR:     { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      flapL:     { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      elev:      { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      rud:       { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      vtR:       { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      vtL:       { tex: 'paint', color: S.paint.base, nrm: 'bump', nrmScale: 0.9, mr: 'mr',
                   rough: 1 - S.paint.gloss },
      // The cowl is a separate panel and reads as one: its OWN sheet, painted
      // from the same livery, carrying the intake and the nose face. It takes
      // the shared bump and metal/rough sheets like everything else painted, but
      // at a lower normal scale — a metal cowl is not doped fabric over ribs.
      cowl:      { tex: 'cowl', color: S.paint.base, nrm: 'bump', nrmScale: 0.55, mr: 'mr',
                   rough: Math.max(0.10, 0.85 - S.paint.gloss) },
      engine:    { color: 0x3c3f45 },
      frame:     { color: 0x5a6470 },
      // bare gear legs: painted steel, not chrome — at 0.80 metalness they took
      // their colour off the sky and read as black bars against grass.
      gearmetal: { color: 0x7d8792, rough: 0.42, metal: 0.45 },
      // the pitot mast: bare steel, like the gear legs it is made of
      pitot:     { color: 0x7d8792, rough: 0.42, metal: 0.45 },
      // lift struts are painted with the aeroplane, and semi-gloss
      liftstrut: { color: 0xe6e2d8, rough: 0.30, metal: 0.10 },
      // the tyre carries a baked sheet too (genTyreDataURI): circumferential
      // ribs and sidewall bands, which is what an aviation tyre actually has.
      // Ribs run AROUND the wheel, so they are u-invariant and a wheel that
      // does not spin still reads correctly.
      tyre:      { tex: 'tyre', color: 0x24262b, rough: 0.95, metal: 0.0 },
      // THESE TWO HEXES LOOK ABSURDLY DARK AND ARE NOT. r128 does NOT convert a
      // material's flat `color` from sRGB — it feeds it to the shader as LINEAR
      // — while a texture declared sRGBEncoding IS converted. So a hex picked as
      // if it were a paint chip renders far lighter than it looks here — and the
      // sun in this scene is a 2.75-intensity directional, which multiplies the
      // error. MEASURED on the cord in shade (green channel):
      //   0x2d2f34 -> 143    0x141519 -> 92    0x0b0c0e -> 65    0x060607 -> 43
      // and on the hub cap dead-on in full sun (rgb):
      //   0x000000  r.55/m.25 -> 107 83 53   <- the SPECULAR FLOOR on its own
      //   0x000000  r.90/m.00 ->  48 36 21
      //   0x1a1c20  r.90/m.00 -> 181 164 139
      //   0x33373d  r.90/m.00 -> 214 202 181
      // The first cut had the cord at a "charcoal" 0x2d2f34 and the hub at
      // 0x99a0a8 metal 0.85: a pale grey sausage and a chrome dome. Note that
      // floor — at metal 0.85 NO base colour could have saved the hub, which is
      // why metalness is low here. A wheel is a painted steel disc anyway.
      // Every other flat colour in this file carries the same bias and is left
      // alone: they were all chosen by eye against it.
      wheelhub:  { color: 0x101216, rough: 0.85, metal: 0.12 },
      // the bungee cord, and only present when that is what was bought
      rubber:    { color: 0x08090b, rough: 0.88, metal: 0.0 },
      prop:      { color: 0x2a2620 },
      // The design session also carried a `spinner` and a `proptip` here. That
      // propeller work was dismissed and its geometry is the trunk's again, so
      // both entries are gone with it — nothing else referenced them.
      exhaust:   { color: 0x483f37, rough: 0.55, metal: 0.55 },
      // GLAZING, in three layers: what you see through the glass is the dark
      // interior sheet, which is why the pane can be this clear.
      glass:     { color: 0xaec9d8, opacity: 0.30, rough: 0.04, metal: 0 },
      // the projected sheet: a CUT-OUT, so it belongs in the opaque pass
      glazed:     { tex: 'glaze', color: 0xa9c6d6, alphaTest: 0.45, rough: 0.07, metal: 0.0 },
      canopy:     { color: 0xa9c6d6, opacity: 0.32, rough: 0.04, metal: 0.0 },
      // the sunscreen roof: the aeroplane's own paint, on the canopy's own quads
      ctop:      { tex: 'paint', color: S.paint.base, nrm: 'bump', mr: 'mr', nrmScale: 0.7,
                   rough: 1 - S.paint.gloss },
      cframe:     { color: S.paint.trim, rough: 0.30, metal: 0.20 },
      gcabin:    { color: 0x14161a, rough: 0.90, metal: 0 },
      gframe:    { color: S.paint.trim, rough: 0.28, metal: 0.20 },
      // THE COAMING + INSTRUMENT PANEL. One shell, off the windscreen fit line.
      dash:      { color: 0x22242a, rough: 0.58, metal: 0.08 },
      // THE INSIDE. Its own sheet with two zones (fuselage / cabin), so the
      // interior is trimmed independently of the livery — the one thing a paint
      // change must not touch.
      intr:      { tex: 'cabin', color: 0x1b1d21, rough: 0.86, metal: 0 },
      // SEATS. Leather-or-vinyl on the cushions (satin, never glossy — a shiny
      // cushion reads as plastic), the welt in the aeroplane's trim colour, and
      // the frame in the same tube the fuselage is welded from.
      seat:      { color: 0xa32c22, rough: 0.72, metal: 0.02 },
      spipe:     { color: S.paint.trim, rough: 0.55, metal: 0.02 },
      sframe:    { color: 0x54595f, rough: 0.42, metal: 0.75 },
      belt:      { color: 0x7b7466, rough: 0.92, metal: 0 },
      buckle:    { color: 0xb9bec4, rough: 0.30, metal: 0.90 },
      // THE DUMMY: pale moulded skin, bare metal joints, and the yellow
      // calibration roundels the high-speed cameras track.
      dumm:      { color: 0xcac3ae, rough: 0.62, metal: 0.03 },
      dumj:      { color: 0x30343a, rough: 0.42, metal: 0.55 },
      dumk:      { color: 0xe3b41f, rough: 0.45, metal: 0.05 },
    },
    // rest node positions in the body frame — poseSkinGen adds (live - rest)
    rest: (() => {
      const a = new Float32Array(N.length * 3);
      N.forEach((n, i) => { const b = B(n.p); a[i*3] = b[0]; a[i*3+1] = b[1]; a[i*3+2] = b[2]; });
      return a;
    })(),
  };
}

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
// sparDeltas: same axes, same CG reference.
function genNodeBody(sim, out) {
  const cg = sim.cgPos(), [xA, yU] = sim.axes();
  const zL = [xA[1]*yU[2]-xA[2]*yU[1], xA[2]*yU[0]-xA[0]*yU[2], xA[0]*yU[1]-xA[1]*yU[0]];
  for (let i = 0; i < sim.n; i++) {
    const dx = sim.p[i*3]-cg[0], dy = sim.p[i*3+1]-cg[1], dz = sim.p[i*3+2]-cg[2];
    out[i*3]   = dx*xA[0]+dy*xA[1]+dz*xA[2];
    out[i*3+1] = dx*yU[0]+dy*yU[1]+dz*yU[2];
    out[i*3+2] = dx*zL[0]+dy*zL[1]+dz*zL[2];
  }
  return out;
}
