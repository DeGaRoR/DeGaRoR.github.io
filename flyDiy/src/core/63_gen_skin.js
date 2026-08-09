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
const GEN_LSEG = 3;             // lengthwise slices per fuselage bay
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

// Station cross-section: blend from the bare truss rectangle to a rounded
// former. theta 0 = top, +pi/2 = +z side, pi = bottom.
function genRing(theta, halfW, halfD, crownT, crownS) {
  const cy = Math.cos(theta), cz = Math.sin(theta);
  const s = Math.min(halfD / Math.max(1e-6, Math.abs(cy)), halfW / Math.max(1e-6, Math.abs(cz)));
  const ry = cy * s, rz = cz * s;                       // truss rectangle
  const crown = cy > 0 ? crownT : crownS;
  const k = 1 + 0.15 * crown;                           // formers stand a little proud
  const ey = halfD * cy * k, ez = halfW * cz * k;       // rounded former
  return [ry + (ey - ry) * crown, rz + (ez - rz) * crown];
}

// ---------------------------------------------------------------------------
// genSkin(def) -> payload in the decodeModel shape, plus per-vertex bindings.
// ---------------------------------------------------------------------------
function genSkin(def) {
  const S = def.spec, P = def.parts, N = def.nodes;
  const FR = genRestFrame(def);
  const B = FR.to;
  const skin = genMesh(), glass = genMesh(), frame = genMesh(),
        strut = genMesh(), tyre = genMesh(), prop = genMesh();
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
  // Glazing is INSET inside its bay, both along the body and around the
  // section — a window that runs frame to frame reads as a missing panel, not
  // as a window. Angles are measured from the top (0) toward either side.
  const nCabinBays = 2;
  const glazing = (bay, seg, th) => {
    const a = Math.abs(((th + Math.PI) % (2*Math.PI)) - Math.PI);
    if (bay === 0) return seg === GEN_LSEG - 1 && a < 1.02;     // windscreen
    if (bay <= nCabinBays) return seg < GEN_LSEG - 1 && a > 0.92 && a < 1.86;  // side glass
    return false;
  };
  // one section per lengthwise slice; a slice between two frames blends both
  const section = (i, s) => {
    const A = ST[i], C = ST[Math.min(i + 1, ST.length - 1)];
    const L = (a, b) => a + (b - a) * s;
    return { x: L(A.x, C.x), w: L(A.w, C.w), yb: L(A.yb, C.yb), yt: L(A.yt, C.yt) };
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
  let lastFusRow = null;
  for (let i = 0; i < F.length - 1; i++) {
    for (let sg = 0; sg < GEN_LSEG; sg++) {
      // reuse the previous slice's row rather than emitting a coincident one:
      // duplicate vertices split the normal average and crease the fuselage
      const rowA = lastFusRow || sectionRow(i, sg / GEN_LSEG);
      const rowB = sectionRow(i, (sg + 1) / GEN_LSEG);
      const aS = rowA.ids || emitRow(rowA, skin), bS = emitRow(rowB, skin);
      rowA.ids = aS; rowB.ids = bS;
      let aG = null, bG = null;
      for (let h = 0; h < GEN_RADIAL; h++) {
        const th = 2 * Math.PI * (h + 0.5) / GEN_RADIAL;
        if (glazing(i, sg, th)) {
          if (!aG) { aG = emitRow(rowA, glass); bG = emitRow(rowB, glass); }
          glass.quad(aG[h], aG[h+1], bG[h+1], bG[h]);
        } else {
          skin.quad(aS[h], aS[h+1], bS[h+1], bS[h]);
        }
      }
      lastFusRow = rowB;
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
  // cowl: ring 0 forward to the spinner backplate, blending to a circle and
  // handing its weights over from the firewall frame to the engine mounts
  const hub = [S.engX - 0.10, S.engY, 0];
  {
    const s0 = ST[0], f0 = F[0];
    const yc0 = 0.5 * (s0.yb + s0.yt), hD0 = 0.5 * (s0.yt - s0.yb);
    // the cowl must close ON the spinner backplate, or it ends as an open tube
    const rHub = Math.max(0.075, 0.16 * S.propR);
    const steps = [0, 0.35, 0.68, 0.90, 1];
    const rows = steps.map(t2 => {
      const x = s0.x + (hub[0] - s0.x) * t2;
      const row = [];
      for (let h = 0; h <= GEN_RADIAL; h++) {
        const th = 2 * Math.PI * (h % GEN_RADIAL) / GEN_RADIAL;
        const [dy, dz] = genRing(th, s0.w, hD0, fu.crownTop, fu.crownSide);
        // blend the firewall section into a circle at the spinner backplate
        const e = 1 - Math.pow(1 - t2, 2);
        const cy2 = yc0 + dy * (1 - e) + (S.engY - yc0 + rHub * Math.cos(th)) * e;
        const cz2 = dz * (1 - e) + rHub * Math.sin(th) * e;
        const uz = dz / Math.max(1e-6, s0.w), uy = dy / Math.max(1e-6, hD0);
        const wL = 0.5*(1-uz), wR = 0.5*(1+uz), wT = 0.5*(1+uy), wBo = 0.5*(1-uy);
        const k = 1 - t2;
        const infl = [[f0.TL, k*wT*wL], [f0.TR, k*wT*wR], [f0.BL, k*wBo*wL],
                      [f0.BR, k*wBo*wR], [P.EL, 0.5*t2], [P.ER, 0.5*t2]];
        row.push(skin.v(B([x, cy2, cz2]), h / GEN_RADIAL, genUVBody(0) * (1 - t2), infl));
      }
      return row;
    });
    for (let r = 0; r < rows.length - 1; r++)
      for (let h = 0; h < GEN_RADIAL; h++)
        skin.quad(rows[r+1][h], rows[r+1][h+1], rows[r][h+1], rows[r][h]);
  }

  // ---- 3. wing --------------------------------------------------------
  // A section at every spar station, lofted along the span. Chordwise position
  // is affine on the two spar nodes (the spars ARE the chord frame, so the
  // weights are exact and extrapolate past LE and TE); the thickness offset is
  // a rest-frame constant, which is what `base` carries.
  const af = genAirfoil(S.wing.naca);
  const sparF = P.sparFront, sparR = P.sparRear;
  const kOf = xc => (xc - sparF) / (sparR - sparF);
  const aStart = 0.62 * S.geom.semi;
  const AIL_HINGE = 0.72;                       // aileron hinge, fraction of chord
  const wingSection = (nF, nR, chord, sid) => {
    const pF = N[nF].p, pR = N[nR].p;
    const ch = genV3.norm(genV3.sub(pR, pF));                 // LE -> TE
    const span = genV3.norm(genV3.sub(pR, pF));
    void span;
    // section normal: chord x spanwise. Spanwise from the node's own z sign so
    // both wings get an outward-consistent normal.
    const sgn = pF[2] >= 0 ? 1 : -1;
    const nrm = genV3.norm(genV3.cross(ch, genV3.mul([0, 0, 1], sgn)));
    return af.map(([xc, yc]) => {
      const base = genV3.add(pF, genV3.mul(ch, (xc - sparF) * chord));
      const p = genV3.add(base, genV3.mul(nrm, yc * chord));
      const k = kOf(xc);
      return { p, infl: [[nF, 1 - k], [nR, k]],
               sid: sid && xc > AIL_HINGE ? sid : 0, u: xc };
    });
  };
  const emitLoft = (rows, mesh, vOf) => {
    const ids = rows.map((row, r) => row.map(pt =>
      mesh.v(B(pt.p), pt.u, genUVPanel(vOf(r)), pt.infl, pt.sid)));
    for (let r = 0; r < ids.length - 1; r++)
      for (let h = 0; h < ids[r].length - 1; h++)
        mesh.quad(ids[r][h], ids[r][h+1], ids[r+1][h+1], ids[r+1][h]);
    return ids;
  };
  const capLoft = (ids, mesh) => {
    // close a section with a fan to its mid-chord point
    for (const row of ids) {
      const n = row.length;
      for (let h = 1; h < n - 1; h++) mesh.tri(row[0], row[h], row[h+1]);
    }
  };
  for (const [side, fw, sid] of [[1, P.wf.R, 3], [-1, P.wf.L, 4]]) {
    const zAll = [P.zRoot, ...P.zs];
    const rows = [];
    for (let i = 0; i < fw.F.length; i++) {
      const z = zAll[i];
      rows.push(wingSection(fw.F[i], fw.R[i], P.chordAt(z), z > aStart ? sid : 0));
    }
    // rounded tip: one extra section, shrunk about the tip chord's mid point
    const tipF = fw.F[fw.F.length-1], tipR = fw.R[fw.R.length-1];
    const tipSec = wingSection(tipF, tipR, P.chordAt(S.geom.semi), sid);
    const mid = genV3.mul(genV3.add(N[tipF].p, N[tipR].p), 0.5);
    const dz = 0.055 * S.wing.chord * side;
    rows.push(tipSec.map(pt => ({
      p: [mid[0] + (pt.p[0]-mid[0])*0.42, mid[1] + (pt.p[1]-mid[1])*0.42, pt.p[2] + dz],
      infl: pt.infl, sid: pt.sid, u: pt.u })));
    const ids = emitLoft(rows, skin, r => r / rows.length);
    capLoft([ids[ids.length - 1]], skin);
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
  const panel = (rowsSpec, sid, hingeFrac) => {
    const rows = rowsSpec.map(({ le, te, infl }) => {
      const ch = genV3.norm(genV3.sub(te, le));
      const len = Math.hypot(te[0]-le[0], te[1]-le[1], te[2]-le[2]);
      const nrm = genV3.norm(genV3.cross(ch, genV3.norm(genV3.sub(rowsSpec[1].le, rowsSpec[0].le))));
      return sym.map(([xc, yc]) => ({
        p: genV3.add(genV3.add(le, genV3.mul(ch, xc * len)), genV3.mul(nrm, yc * len)),
        infl, sid: xc > hingeFrac ? sid : 0, u: xc }));
    });
    const ids = emitLoft(rows, skin, r => r / Math.max(1, rowsSpec.length - 1));
    capLoft([ids[0], ids[ids.length - 1]], skin);
  };
  {
    const t = S.tail, hc = t.hChord, hx = t.hX;
    const hy = N[P.HTL].p[1], hz = 0.5 * t.hSpan;
    const post = [[P.TPB, 0.5], [P.TPT, 0.5]];
    const stabRow = (z, infl) => ({ le: [hx - 0.35*hc, hy, z], te: [hx + 0.65*hc, hy, z], infl });
    panel([stabRow(-hz, [[P.HTL, 1]]), stabRow(-0.18*hz, [[P.HTL, 0.30], ...post.map(([i,w]) => [i, w*0.70])]),
           stabRow(0.18*hz, [[P.HTR, 0.30], ...post.map(([i,w]) => [i, w*0.70])]), stabRow(hz, [[P.HTR, 1]])],
          1, 0.66);
    const vc = t.vChord, vx = t.vX, vy0 = N[P.TPT].p[1], vy1 = N[P.FIN].p[1];
    const finRow = (y, k, sw) => ({ le: [vx - 0.40*vc + sw, y, 0], te: [vx + 0.60*vc, y, 0],
      infl: [[P.FIN, k], [P.TPT, (1-k)*0.6], [P.TPB, (1-k)*0.4]] });
    panel([finRow(vy0, 0, 0), finRow(vy0 + 0.5*(vy1-vy0), 0.5, 0.14*vc),
           finRow(vy1, 1, 0.30*vc)], 2, 0.60);
  }

  // ---- 5. wheels and propeller ----------------------------------------
  const wheel = (nd, r, halfWid) => {
    const SEG = 14, rows = [];
    for (const off of [-halfWid, halfWid]) {
      const row = [];
      for (let h = 0; h <= SEG; h++) {
        const a = 2 * Math.PI * (h % SEG) / SEG;
        row.push(tyre.v(B([N[nd].p[0] + r*Math.cos(a), N[nd].p[1] + r*Math.sin(a),
                           N[nd].p[2] + off]), h/SEG, off > 0 ? 1 : 0, w1(nd)));
      }
      rows.push(row);
    }
    for (let h = 0; h < SEG; h++) tyre.quad(rows[0][h], rows[0][h+1], rows[1][h+1], rows[1][h]);
    for (const row of rows) for (let h = 1; h < SEG - 1; h++) tyre.tri(row[0], row[h], row[h+1]);
  };
  wheel(P.GAL, S.gear.wheelR, 0.055);
  wheel(P.GAR, S.gear.wheelR, 0.055);
  wheel(P.TW, S.gear.twR, 0.035);
  {
    const eng = [[P.EL, 0.5], [P.ER, 0.5]];
    const rSp = Math.max(0.075, 0.16 * S.propR), SEG = 12;
    const back = [], tip = prop.v(B([hub[0] - 1.5*rSp, S.engY, 0]), 0.5, 1, eng);
    for (let h = 0; h <= SEG; h++) {
      const a = 2*Math.PI*(h % SEG)/SEG;
      back.push(prop.v(B([hub[0], S.engY + rSp*Math.cos(a), rSp*Math.sin(a)]), h/SEG, 0, eng));
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
  const surfaces = [
    { name: 'elevator', drive: 'de', sgn: -1, k: 1.0,
      p: bp([t.hX + 0.31 * t.hChord, stabY, 0]),
      ax: hingeAxis([t.hX + 0.31*t.hChord, stabY, -1], [t.hX + 0.31*t.hChord, stabY, 1]) },
    { name: 'rudder', drive: 'dr', sgn: 1, k: 1.0,
      p: bp([t.vX + 0.20 * t.vChord, N[P.TPT].p[1], 0]),
      ax: hingeAxis([t.vX + 0.20*t.vChord, N[P.TPT].p[1], 0],
                    [t.vX + 0.20*t.vChord + 0.30*t.vChord, N[P.FIN].p[1], 0]) },
    { name: 'ailR', drive: 'da', sgn: -1, k: 1.0,
      p: bp([P.xF + (AIL_HINGE - sparF) * P.chordAt(zA), P.yF(zA), zA]),
      ax: hingeAxis([0, P.yF(aStart), aStart], [0, P.yF(semi), semi]) },
    { name: 'ailL', drive: 'da', sgn: 1, k: 1.0,
      p: bp([P.xF + (AIL_HINGE - sparF) * P.chordAt(zA), P.yF(zA), -zA]),
      ax: hingeAxis([0, P.yF(aStart), -aStart], [0, P.yF(semi), -semi]) },
  ];

  const groups = {};
  const put = (nm, M) => { const g = M.done(); if (g.nv) groups[nm] = g; };
  put('skin', skin); put('glass', glass); put('frame', frame);
  put('gearmetal', strut); put('tyre', tyre); put('prop', prop);
  return {
    v: 5, generated: true,
    hub: B(hub),
    groups, surfaces,
    mats: {
      // the viewer bakes `paint` procedurally (src/viewer/garage.js) and drops
      // it in before the material is built; without it this falls back to flat
      skin:      { tex: 'paint', rough: 1 - S.paint.gloss },
      glass:     { opacity: 0.30, color: 0xaad4ea },
      frame:     { color: 0x5a6470 },
      gearmetal: { color: 0x6d7682 },
      tyre:      { color: 0x22242a },
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
