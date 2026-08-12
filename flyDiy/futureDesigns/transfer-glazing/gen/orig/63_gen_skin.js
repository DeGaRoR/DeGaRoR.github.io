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

const GEN_TUBE_R = { fus: 0.016, wing: 0.020, gear: 0.024 };
const GEN_RADIAL = 20;          // fuselage section resolution
const GEN_WHEEL_SEG = 18;       // wheel resolution, around

// A WHEEL IS A REVOLVED PROFILE, not a cylinder with two flat lids. Fractions
// of the wheel radius and of the half-width, walked from one bead round to the
// other. The widest point is at 84% of the radius because an aviation tyre is
// fat and round-shouldered; the flat-sided cylinder these replace was most of
// the "wheel meshes are ugly" report.
const GEN_TYRE_SECT = [
  [0.55, -0.46], [0.70, -0.90], [0.84, -1.00], [0.94, -0.88],
  [0.99, -0.55], [1.00, -0.19], [1.00,  0.19], [0.99,  0.55],
  [0.94,  0.88], [0.84,  1.00], [0.70,  0.90], [0.55,  0.46],
];
// The wheel under it: hub cap, dished disc, and the rim barrel the beads sit
// on. Its flange point IS the tyre's bead point, so the two meet exactly and
// there is no gap to close. Deliberately axisymmetric — no bolt heads, no
// spokes — because nothing spins the wheel and a bolt circle that never moves
// is worse than none.
const GEN_HUB_SECT = [
  [0.00, -0.36], [0.13, -0.34], [0.21, -0.27], [0.38, -0.31], [0.55, -0.46],
  [0.55,  0.46], [0.38,  0.31], [0.21,  0.27], [0.13,  0.34], [0.00,  0.36],
];
const GEN_LSEG = 3;             // lengthwise slices per fuselage bay
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

// generic swept tube, used for the engine block's cylinders and shaft
function genTubeInto(M, A, C, r, seg, infl, B) {
  const ax = genV3.norm(genV3.sub(C, A));
  const up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
  const rings = [A, C].map((base, s) => {
    const row = [];
    for (let h = 0; h <= seg; h++) {
      const a = 2 * Math.PI * (h % seg) / seg;
      const off = genV3.add(genV3.mul(e1, r * Math.cos(a)), genV3.mul(e2, r * Math.sin(a)));
      row.push(M.v(B(genV3.add(base, off)), h / seg, s, infl));
    }
    return row;
  });
  for (let h = 0; h < seg; h++)
    M.quad(rings[0][h], rings[0][h+1], rings[1][h+1], rings[1][h]);
  for (const [row, base] of [[rings[0], A], [rings[1], C]]) {
    const c = M.v(B(base), 0.5, 0.5, infl);
    for (let h = 0; h < seg; h++) M.tri(c, row[h], row[h+1]);
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
        cowl = genMesh(), engine = genMesh();
  const w1 = i => [[i, 1]];

  // ---- 1. tubes: one hexagonal prism per beam -------------------------
  const HEX = 6;
  for (const b of def.beams) {
    const M = b.ext ? strut : frame;
    const A = N[b.a].p, C = N[b.b].p;
    const ax = genV3.norm(genV3.sub(C, A));
    let up = Math.abs(ax[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = genV3.norm(genV3.cross(ax, up)), e2 = genV3.cross(ax, e1);
    const r = GEN_TUBE_R[b.cls] * (b.ext ? 1.15 : 1);
    const ring = [];
    for (let s = 0; s < 2; s++) {
      const nd = s ? b.b : b.a, base = s ? C : A, row = [];
      for (let h = 0; h < HEX; h++) {
        const a2 = 2 * Math.PI * h / HEX;
        const off = genV3.add(genV3.mul(e1, r * Math.cos(a2)), genV3.mul(e2, r * Math.sin(a2)));
        row.push(M.v(B(genV3.add(base, off)), h / HEX, s, w1(nd)));
      }
      ring.push(row);
    }
    for (let h = 0; h < HEX; h++)
      M.quad(ring[0][h], ring[0][(h+1)%HEX], ring[1][(h+1)%HEX], ring[1][h]);
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
  const bay0 = Math.max(1e-6, ST[1].x - ST[0].x);
  const windFrac = Math.min(0.95, fu.windRun / bay0);
  const smooth = (e0, e1, x) => {
    const t = Math.max(0, Math.min(1, (x - e0) / Math.max(1e-6, e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  const section = (i, s) => {
    const A = ST[i], C = ST[Math.min(i + 1, ST.length - 1)];
    const L = (a, b) => a + (b - a) * s;
    // ahead of the cabin the deck is FLAT, then the windscreen rises
    const st = i === 0 ? smooth(1 - windFrac, 1, s) : s;
    return { x: L(A.x, C.x), w: L(A.w, C.w), yb: L(A.yb, C.yb),
             yt: A.yt + (C.yt - A.yt) * st };
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
  const bodyRows = [];          // kept for the registration decal, below
  let lastFusRow = null;
  for (let i = 0; i < F.length - 1; i++) {
    for (let sg = 0; sg < GEN_LSEG; sg++) {
      // reuse the previous slice's row rather than emitting a coincident one:
      // duplicate vertices split the normal average and crease the fuselage
      const rowA = lastFusRow || sectionRow(i, sg / GEN_LSEG);
      const rowB = sectionRow(i, (sg + 1) / GEN_LSEG);
      const aS = rowA.ids || emitRow(rowA, skin), bS = emitRow(rowB, skin);
      rowA.ids = aS; rowB.ids = bS;
      for (let h = 0; h < GEN_RADIAL; h++) skin.quad(aS[h], aS[h+1], bS[h+1], bS[h]);
      if (!bodyRows.length) bodyRows.push(rowA);
      bodyRows.push(rowB);
      lastFusRow = rowB;
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
    // aft body, between 45% and 78% of the run to the tailpost
    const lo = Math.floor(bodyRows.length * 0.45), hi = Math.ceil(bodyRows.length * 0.78);
    const rows = bodyRows.slice(lo, Math.max(lo + 2, hi));
    // the two side arcs: u 0.15..0.35 (+z) and its mirror
    // The far side walks its arc BACKWARDS rather than flipping u. Traversing
    // both side arcs in the same index direction gives them opposite handedness
    // seen from outside, so flipping u on top of that was a SECOND flip: the
    // registration came out mirrored AND upside down. Reversing the traversal
    // restores the handedness, and then both sides share one (u, v) frame
    // relative to their own outward normal.
    for (const [h0, h1, back] of [[3, 7, false], [13, 17, true]]) {
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
      const ids = grid.map((g, r) => g.map((pt, k) =>
        decal.v(B(pt.p), r / Math.max(1, grid.length - 1), k / (h1 - h0), pt.infl)));
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
    const s0 = ST[0], f0 = F[0];
    const yc0 = 0.5 * (s0.yb + s0.yt), hD0 = 0.5 * (s0.yt - s0.yb);
    const xNose = hub[0];                       // flat front face (x is AFT)
    const len = Math.max(0.12, s0.x - xNose);
    const fil = Math.min(S.cowl.fillet, 0.40 * Math.min(s0.w, hD0), 0.45 * len);
    // Sections along the cowl: a straight extrusion of the FIREWALL's own
    // section (same crown, so the joint cannot show a ridge), drawing in
    // slightly, then rolled over a quarter-round onto a flat nose. `shrink` is
    // an absolute inset — that is what makes it a true fillet rather than a
    // scale, so the corners round without the face going oval.
    const NF = 4;
    const steps = [{ x: s0.x, k: 1, shrink: 0 },
                   { x: xNose + fil, k: S.cowl.taper, shrink: 0 }];
    for (let i = 1; i <= NF; i++) {
      const a = (i / NF) * Math.PI / 2;
      steps.push({ x: xNose + fil - fil * Math.sin(a), k: S.cowl.taper,
                   shrink: fil * (1 - Math.cos(a)) });
    }
    const rows = steps.map(st => {
      const t2 = (s0.x - st.x) / len;
      const hw = Math.max(0.02, s0.w * st.k - st.shrink);
      const hd = Math.max(0.02, hD0 * st.k - st.shrink);
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
        row.push(cowl.v(B([st.x, yc0 + dy, dz]), h / GEN_RADIAL,
                        genUVBody(0.02 * (1 - t2)), infl));
      }
      return row;
    });
    for (let r = 0; r < rows.length - 1; r++)
      for (let h = 0; h < GEN_RADIAL; h++)
        cowl.quad(rows[r+1][h], rows[r+1][h+1], rows[r][h+1], rows[r][h]);
    // flat nose, capped IN the plane of the last ring. (It was inset 12 mm
    // once, which left a lip you could see into — the "big opening".)
    const last = rows[rows.length - 1];
    const capC = cowl.v(B([xNose, yc0, 0]), 0.5, genUVBody(0), eng2);
    for (let h = 0; h < GEN_RADIAL; h++) cowl.tri(capC, last[h+1], last[h]);
  }
  // the block: crankcase, four cylinders, prop shaft. Scaled off the registry
  // mass so a bigger engine looks like one.
  {
    const PP = POWERPLANTS[S.engine];
    const k = Math.cbrt(Math.max(8, PP.engine.mass) / 80);
    const xF = S.engX - 0.09 * k, xA = S.engX + 0.19 * k;      // case, fore/aft
    const hw = 0.105 * k, hh = 0.105 * k;
    genBoxInto(engine, [xF, S.engY - hh, -hw], [xA, S.engY + hh, hw], eng2, B);
    for (const sgn of [1, -1]) {
      for (const xc of [S.engX + 0.01 * k, S.engX + 0.14 * k]) {
        genTubeInto(engine, [xc, S.engY - 0.02 * k, sgn * hw],
                    [xc, S.engY + 0.02 * k, sgn * 0.30 * k], 0.072 * k, 8, eng2, B);
      }
    }
    genTubeInto(engine, [xF, S.engY, 0], [hub[0] + 0.02, S.engY, 0], 0.035 * k, 8, eng2, B);
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
  // centre section: the wing carries through above the cabin
  {
    const rows = [
      wingSection(P.wf.L.F[0], P.wf.L.R[0], S.wing.chord, 0),
      wingSection(P.wf.R.F[0], P.wf.R.R[0], S.wing.chord, 0),
    ];
    emitLoft(rows, skin, r => r);
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
    const ids = emitLoft(fixed, skin, r => r / Math.max(1, rowsSpec.length - 1), false, !!mv);
    capLoft([ids[0], ids[ids.length - 1]], skin);
    if (!mv) return;
    const M = genMesh();
    const rows = build(h, 1, NTSURF);
    const sIds = emitLoft(rows, M, r => r / Math.max(1, rowsSpec.length - 1), false, true);
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
    }
  }

  // ---- 5. wheels and propeller ----------------------------------------
  // Tyre and wheel are two materials, so they are two meshes, both revolved
  // about the axle from the profiles at the top of this file. The half-width is
  // tied to the radius: an 8.00-6 bush tyre is 0.20 m across a 0.44 m diameter,
  // which is where 0.40 comes from — the old wheels were 0.055 m half-width on
  // a 0.20 m radius and read as hockey pucks.
  const TYRE_W = 0.40;
  const wheel = (nd, r) => {
    const c = N[nd].p, axis = [0, 0, 1], hw = TYRE_W * r, infl = w1(nd);
    genRevolveInto(tyre, c, axis, r, hw, GEN_TYRE_SECT, GEN_WHEEL_SEG, infl, B);
    genRevolveInto(hubM, c, axis, r, hw, GEN_HUB_SECT, GEN_WHEEL_SEG, infl, B);
  };
  wheel(P.GAL, S.gear.wheelR);
  wheel(P.GAR, S.gear.wheelR);
  wheel(P.TW, S.gear.twR);
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
    // two blades, tapered and twisted, on the disc plane
    for (const bs of [1, -1]) {
      const r0 = 0.9*rSp, r1 = S.propR;
      const row = [];
      for (let i = 0; i <= 5; i++) {
        const t2 = i/5, r = r0 + (r1-r0)*t2;
        // narrow, tapered, and rounded off at the tip — a blade, not a paddle
        const cw = 0.055*S.propR*(1 - 0.30*t2) * (t2 > 0.88 ? (1 - t2) / 0.12 : 1);
        const tw = (0.34 - 0.27*t2);
        const cy = S.engY + bs*r*Math.cos(0), cz = bs*r*Math.sin(0);
        void cz;
        row.push([
          prop.v(B([hub[0] - cw*Math.sin(tw) - 0.02, cy, -cw*Math.cos(tw)]), 0, t2, eng),
          prop.v(B([hub[0] + cw*Math.sin(tw) - 0.02, cy, cw*Math.cos(tw)]), 1, t2, eng),
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

  const groups = {};
  const put = (nm, M) => { const g = M.done(); if (g.nv) groups[nm] = g; };
  put('skin', skin); put('cowl', cowl); put('frame', frame);
  put('engine', engine); put('gearmetal', strut); put('tyre', tyre); put('prop', prop);
  put('wheelhub', hubM);
  put('decal', decal);
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
    hub: B(hub),
    groups, surfaces, moving,
    mats: {
      // the viewer bakes `paint` procedurally (src/viewer/garage.js) and drops
      // it in before the material is built; without it this falls back to flat
      skin:      { tex: 'paint', rough: 1 - S.paint.gloss },
      // the registration, on its own transparent sheet just off the skin
      decal:     { tex: 'reg', rough: 1 - S.paint.gloss, alphaTest: 0.45 },
      // control surfaces are painted with the aeroplane, not against it
      ailR:      { tex: 'paint', rough: 1 - S.paint.gloss },
      ailL:      { tex: 'paint', rough: 1 - S.paint.gloss },
      flapR:     { tex: 'paint', rough: 1 - S.paint.gloss },
      flapL:     { tex: 'paint', rough: 1 - S.paint.gloss },
      elev:      { tex: 'paint', rough: 1 - S.paint.gloss },
      rud:       { tex: 'paint', rough: 1 - S.paint.gloss },
      vtR:       { tex: 'paint', rough: 1 - S.paint.gloss },
      vtL:       { tex: 'paint', rough: 1 - S.paint.gloss },
      // the cowl is a separate panel and reads as one: same paint, more gloss
      cowl:      { tex: 'paint', rough: Math.max(0.10, 0.85 - S.paint.gloss) },
      engine:    { color: 0x3c3f45 },
      frame:     { color: 0x5a6470 },
      gearmetal: { color: 0x6d7682 },
      // the tyre carries a baked sheet too (genTyreDataURI): circumferential
      // ribs and sidewall bands, which is what an aviation tyre actually has.
      // Ribs run AROUND the wheel, so they are u-invariant and a wheel that
      // does not spin still reads correctly.
      tyre:      { tex: 'tyre', rough: 0.95, metal: 0.0 },
      wheelhub:  { color: 0x99a0a8, rough: 0.34, metal: 0.85 },
      prop:      { color: 0x2a2620 },
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
