// CAGE CREW — the cockpit occupancy layer for _cage5.html (G17).
//
// Seats (ported from the game's 63_gen_skin.js "2h. SEATS" — frame, pan,
// cushion, piping, lap belts: leaving any out is what makes a seat read
// as a box), procedural CONTROLS (pedals, stick/yoke/side-stick, throttle
// as wall lever / dash push-pull / console quadrant, optional centre
// console) and the ATD-01 DUMMY (ported from Downloads/mannequin_poser
// .html: same skeleton, same analytic two-bone IK), auto-laced to the
// controls: hands and feet find the grips from the CONTROL POSITIONS, so
// moving a slider re-poses the dummy. Percentile stature per the poser.
//
// UNITS: the cage template is treated as METRES (cabin halfW 0.554 →
// 1.11 m side-by-side cabin; keel→roof ≈ 1.9 m — both plausible). The
// dummy is the calibration instrument: if it doesn't fit, the AEROPLANE
// is the thing to resize.
//
// Wiring: this file loads AFTER _cage_gen.js and BEFORE _cage_ui.js.
// It attaches window.CAGE_PAGE.post, which _cage_ui.js calls at the end
// of every build() with { scene, spec, P, stat }. Everything here is a
// disjoint THREE layer — the cage mesh, gates and OBJ export never see
// it. Crew params live in P like any cage param (sliders, presets, save
// and JSON export all work unchanged).
'use strict';
(() => {
const PAGE = window.CAGE_PAGE || (window.CAGE_PAGE = {});
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

// ---- materials (Lambert, to match the page's shading) ---------------------
const lam = c => new THREE.MeshLambertMaterial({ color: c });
const M = {
  shell:   lam(0xd6a11c),      // ATD amber
  joint:   lam(0x24282e),
  dark:    lam(0x363b42),
  cushion: lam(0x7a4f33),
  pipe:    lam(0xd8cdb6),
  frame:   lam(0x6f7a86),
  belt:    lam(0x5a5d4c),
  metal:   lam(0x9aa4af),
  ctrl:    lam(0x262b33),
  knob:    lam(0x14171b),
  console: lam(0x2b3038),
  shellC:  lam(0x2f333a),      // moulded composite
  trim:    lam(0x8d949c),
  marker:  new THREE.MeshBasicMaterial({ color: 0xff4d3d }),
};

// ---- small builders -------------------------------------------------------
function tube(parent, mat, a, b, r, open) {
  const d = V3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = d.length();
  if (len < 1e-6) return null;
  const g = new THREE.CylinderGeometry(r, r, len, 8, 1, !!open);
  const m = new THREE.Mesh(g, mat);
  m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
  parent.add(m);
  return m;
}
function boxAt(parent, mat, c, s, rx) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), mat);
  m.position.set(c[0], c[1], c[2]);
  if (rx) m.rotation.x = rx;
  parent.add(m);
  return m;
}
function ballAt(parent, mat, c, r) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
  m.position.set(c[0], c[1], c[2]);
  parent.add(m);
  return m;
}
// indexed quad bag for the sheet geometry (cushions, belts)
function Bag(mat) {
  const pos = [], idx = [];
  return {
    v: (x, y, z) => { pos.push(x, y, z); return pos.length / 3 - 1; },
    quad: (a, b, c, d) => { idx.push(a, b, c, a, c, d); },
    tri: (a, b, c) => { idx.push(a, b, c); },
    mesh: parent => {
      if (!idx.length) return null;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position',
        new THREE.BufferAttribute(new Float32Array(pos), 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.material.side = THREE.DoubleSide;
      parent.add(m);
      return m;
    },
  };
}

// ---- TUBING: ONE WELDED RUN WITH ROUNDED CORNERS --------------------------
// The frames were separate capped cylinders butted at each bend — they
// never joined, and both end discs showed (user 2026-08-19). A run is
// now ONE swept tube: corners are FILLETED (quadratic bezier through the
// corner, arms inset by min(2.2r, 0.4 arm) — the cageRims seal idiom),
// the section is PARALLEL-TRANSPORTED so it never flips along the run,
// consecutive rings SHARE vertices so the surface is continuous, and the
// ends are DOMED. Every tube in this file goes through it.
const _sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const _len3 = a => Math.hypot(a[0], a[1], a[2]);
const _nrm3 = a => { const l = _len3(a) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
const _crs3 = (a, b) => [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2],
                         a[0]*b[1] - a[1]*b[0]];
const _dot3 = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const _off3 = (p, d, k) => [p[0] + d[0]*k, p[1] + d[1]*k, p[2] + d[2]*k];

function filletPath(pts, r, seg) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const d1 = _sub3(b, a), d2 = _sub3(c, b);
    const l1 = _len3(d1), l2 = _len3(d2);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const u1 = _nrm3(d1), u2 = _nrm3(d2);
    if (Math.acos(clamp(_dot3(u1, u2), -1, 1)) < 0.10) { out.push(b); continue; }
    const d = Math.min(2.2 * r, 0.40 * Math.min(l1, l2));
    const p0 = _off3(b, u1, -d), p2 = _off3(b, u2, d);
    const N = seg || 4;
    for (let k = 0; k <= N; k++) {
      const t = k / N, m = 1 - t;
      out.push([m*m*p0[0] + 2*m*t*b[0] + t*t*p2[0],
                m*m*p0[1] + 2*m*t*b[1] + t*t*p2[1],
                m*m*p0[2] + 2*m*t*b[2] + t*t*p2[2]]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
// samples = [{p, rs}] — rs scales the radius, which is how the domed
// ends are built (a ring at angle th sits r*cos(th) beyond the end with
// radius r*sin(th))
function sweepSamples(bag, samples, r, sides) {
  sides = sides || 10;
  const P = samples.map(s => s.p);
  const T = P.map((p, i) =>
    _nrm3(_sub3(P[Math.min(P.length - 1, i + 1)], P[Math.max(0, i - 1)])));
  let nrm = Math.abs(T[0][1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const proj = (n, t) => _nrm3(_sub3(n, [t[0]*_dot3(n,t), t[1]*_dot3(n,t),
                                         t[2]*_dot3(n,t)]));
  nrm = proj(nrm, T[0]);
  const rings = [], poles = [];
  for (let i = 0; i < P.length; i++) {
    nrm = proj(nrm, T[i]);
    const bi = _crs3(T[i], nrm);
    const rr = r * samples[i].rs;
    if (rr < 1e-5) { rings.push(null); poles.push(bag.v(P[i][0], P[i][1], P[i][2])); continue; }
    poles.push(-1);
    const ring = [];
    for (let k = 0; k < sides; k++) {
      const a = 2 * Math.PI * k / sides, ca = Math.cos(a), sa = Math.sin(a);
      ring.push(bag.v(P[i][0] + (nrm[0]*ca + bi[0]*sa) * rr,
                      P[i][1] + (nrm[1]*ca + bi[1]*sa) * rr,
                      P[i][2] + (nrm[2]*ca + bi[2]*sa) * rr));
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i], b = rings[i + 1];
    if (a && b) {
      for (let k = 0; k < sides; k++) {
        const k2 = (k + 1) % sides;
        bag.quad(a[k], a[k2], b[k2], b[k]);
      }
    } else if (a && !b) {                     // fan to the closing pole
      for (let k = 0; k < sides; k++) bag.tri(a[k], a[(k+1)%sides], poles[i+1]);
    } else if (!a && b) {
      for (let k = 0; k < sides; k++) bag.tri(poles[i], b[(k+1)%sides], b[k]);
    }
  }
}
// pts = polyline; ends: 'dome' (default) | 'flat' | 'open'
function tubeRun(bag, pts, r, sides, ends) {
  const path = filletPath(pts, r);
  if (path.length < 2) return;
  const samples = path.map(p => ({ p, rs: 1 }));
  if (ends !== 'open') {
    const t0 = _nrm3(_sub3(path[1], path[0]));
    const t1 = _nrm3(_sub3(path[path.length-1], path[path.length-2]));
    const head = [], tail = [];
    if (ends === 'flat') {
      head.push({ p: path[0], rs: 0 });
      tail.push({ p: path[path.length-1], rs: 0 });
    } else {
      for (const th of [0, 30, 60]) {         // pole first
        const a = th * Math.PI / 180;
        head.push({ p: _off3(path[0], t0, -r * Math.cos(a)), rs: Math.sin(a) });
      }
      for (const th of [60, 30, 0])
        tail.push({ p: _off3(path[path.length-1], t1, r * Math.cos(th*Math.PI/180)),
                    rs: Math.sin(th * Math.PI / 180) });
    }
    samples.unshift(...head); samples.push(...tail);
  }
  sweepSamples(bag, samples, r, sides);
}

// ---- the cushion: a PUFFED SLAB (port of 63_gen_skin's builder) -----------
// grid whose thickness falls to zero at the rim on a soft power curve,
// grooved along the seam lines; piping (the welt) swept round the rim.
const smoothS = t => t * t * (3 - 2 * t);
function cushion(parent, ctr, ax, al, up, hw, hd, th, flutes, tuck) {
  const NU = 10, NV = 12;
  const P3 = (a, b, u) => [
    ctr[0] + ax[0] * a * hw + al[0] * b * hd + up[0] * u,
    ctr[1] + ax[1] * a * hw + al[1] * b * hd + up[1] * u,
    ctr[2] + ax[2] * a * hw + al[2] * b * hd + up[2] * u,
  ];
  // 3 / 0.45 is a filled squab; 5 / 0.30 was a board (63_gen_skin)
  const puff = (a, b) =>
    Math.pow(Math.max(0, 1 - Math.pow(Math.abs(a), 3)), 0.45) *
    Math.pow(Math.max(0, 1 - Math.pow(Math.abs(b), 3)), 0.45);
  const groove = b => {
    let g = 1;
    for (let f = 1; f <= flutes; f++) {
      const bf = -1 + 2 * f / (flutes + 1);
      const d = (b - bf) / 0.085;
      g -= 0.30 * Math.exp(-d * d);
    }
    return Math.max(0.45, g);
  };
  const bag = Bag(M.cushion);
  const grid = sgn => {
    const rows = [];
    for (let i = 0; i <= NU; i++) {
      const a = -1 + 2 * i / NU, row = [];
      for (let j = 0; j <= NV; j++) {
        const b = -1 + 2 * j / NV;
        const pf = puff(a, b);
        const u = sgn > 0 ? th * pf * groove(b)
                          : -th * pf * (tuck ? 0.20 : 0.45);
        const p = P3(a, b, u);
        row.push(bag.v(p[0], p[1], p[2]));
      }
      rows.push(row);
    }
    return rows;
  };
  const top = grid(1), bot = grid(-1);
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
    bag.quad(top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j]);
    bag.quad(bot[i][j], bot[i + 1][j], bot[i + 1][j + 1], bot[i][j + 1]);
  }
  bag.mesh(parent);
  // piping round the rim, in the trim colour
  const rim = [];
  const NP = 7;
  for (let j = 0; j <= NP; j++) rim.push([-1, -1 + 2 * j / NP]);
  for (let i = 1; i <= NP; i++) rim.push([-1 + 2 * i / NP, 1]);
  for (let j = NP - 1; j >= 0; j--) rim.push([1, -1 + 2 * j / NP]);
  for (let i = NP - 1; i >= 0; i--) rim.push([-1 + 2 * i / NP, -1]);
  for (let k = 0; k < rim.length - 1; k++)
    tube(parent, M.pipe, P3(rim[k][0], rim[k][1], 0),
         P3(rim[k + 1][0], rim[k + 1][1], 0), 0.009, true);
}

// ---- lap belt: a flat RIBBON with a roll-over twist (63 port) -------------
function ribbon(bag, pts, wid, tw) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const nrm = v => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  let prev = null;
  for (let k = 0; k < pts.length - 1; k++) {
    const A = pts[k], C = pts[k + 1];
    const ax = nrm(sub(C, A));
    let across = nrm(cross(ax, [0, 1, 0]));
    if (!isFinite(across[0])) across = [0, 0, 1];
    const th = (tw || 0) * (k / Math.max(1, pts.length - 2));
    const upv = nrm(cross(across, ax));
    const e1 = [0, 1, 2].map(c =>
      across[c] * Math.cos(th) + upv[c] * Math.sin(th));
    const e2n = nrm(cross(ax, e1));
    const e2 = [e2n[0] * 0.0035, e2n[1] * 0.0035, e2n[2] * 0.0035];
    const quadAt = Pt => [0, 1, 2, 3].map(q => {
      const sW = (q === 0 || q === 3) ? -1 : 1, sT = q < 2 ? 1 : -1;
      return bag.v(Pt[0] + e1[0] * sW * 0.5 * wid + e2[0] * sT,
                   Pt[1] + e1[1] * sW * 0.5 * wid + e2[1] * sT,
                   Pt[2] + e1[2] * sW * 0.5 * wid + e2[2] * sT);
    });
    const a4 = prev || quadAt(A), c4 = quadAt(C);
    bag.quad(a4[0], a4[1], c4[1], c4[0]);
    bag.quad(a4[3], c4[3], c4[2], a4[2]);
    bag.quad(a4[0], c4[0], c4[3], a4[3]);
    bag.quad(a4[1], a4[2], c4[2], c4[1]);
    prev = c4;
  }
}

// ---- THE SEATS ------------------------------------------------------------
// Three types, ONE interface: every builder returns the numbers the
// controls and the dummy lace to (panY, floor, szc, hw, backH, rake), so
// the cockpit works identically whichever is fitted (user 2026-08-19).
//   0 tube     the light-aircraft welded frame + laced cushions
//   1 shell    a moulded composite bucket, for the almost-lying position
//   2 airliner a padded seat with headrest and armrests
// SP = this seat's own {h, rake, tilt}: the second seat carries its own
// set, so a tandem back seat can sit lower or more upright than the front.
function seatGeom(A, P, sx, zBack, sbs, SP) {
  const szc = zBack + 0.20;                    // squab centre
  const floor = A.floorAt(szc);                // the DETECTED floor
  const panY = floor + SP.h;
  const rake = SP.rake * D2R;
  const tilt = (SP.tilt || 0) * D2R;           // squab recline, front up
  const hw = Math.min(0.24, sbs ? A.halfW * 0.42 : A.halfW * 0.60);
  const backH = Math.min(0.56, Math.max(0.34, (A.roofY - panY) * 0.5));
  return { szc, floor, panY, rake, tilt, hw, backH, sx };
}

// ---- 0. THE TUBE SEAT -----------------------------------------------------
function seatTube(parent, A, P, g) {
  const sx = g.sx, szc = g.szc, floor = g.floor, panY = g.panY;
  const rake = g.rake, tilt = g.tilt, hw = g.hw, backH = g.backH;
  const bc = Math.cos(rake), bs = Math.sin(rake);
  cushion(parent, [sx, panY + 0.5 * 0.22 * Math.sin(tilt), szc],
          [1, 0, 0], [0, -0.06 - Math.sin(tilt), -Math.cos(tilt)],
          [0, 1, 0], hw, 0.22, 0.075, 2, true);
  cushion(parent,
          [sx, panY + 0.02 + 0.5 * backH * bc, szc - 0.20 - 0.5 * backH * bs],
          [1, 0, 0], [0, bc, -bs], [0, bs, bc],
          hw * 0.96, 0.5 * backH, 0.062, 3, false);
  // THE SUPPORTING STRUCTURE IS TWO NARROW RAILS (user): at most 2/3 of
  // the seat width, so it lands on the floor of a fuselage that has
  // narrowed by the belly. Each side is ONE welded run — leg, rail and
  // back upright in a single filleted sweep.
  const railHalf = hw * (2 / 3);
  const bag = Bag(M.frame);
  for (const s2 of [-1, 1]) {
    const xx = sx + s2 * railHalf;
    tubeRun(bag, [[xx, floor, szc + 0.21],
                  [xx, panY - 0.03, szc + 0.19],
                  [xx, panY - 0.03, szc - 0.19],
                  [xx, panY - 0.02 + backH * bc, szc - 0.20 - backH * bs]],
            0.014, 10);
    tubeRun(bag, [[xx, floor, szc + 0.21], [xx, panY - 0.03, szc - 0.19]],
            0.010, 8);
  }
  // cross members: run a hair PAST the side rails so the weld closes
  const xl = sx - railHalf, xr = sx + railHalf, e = 0.010;
  const X = (y, z, r) => tubeRun(bag, [[xl - e, y, z], [xr + e, y, z]], r, 8);
  X(panY - 0.03, szc + 0.19, 0.012);
  X(panY - 0.03, szc - 0.19, 0.012);
  X(floor, szc + 0.21, 0.011);
  X(floor, szc - 0.20, 0.011);
  X(panY - 0.02 + backH * bc, szc - 0.20 - backH * bs, 0.013);
  bag.mesh(parent);
}

// ---- 1. THE COMPOSITE SHELL ----------------------------------------------
// One moulded bucket: a centre-plane profile (front lip, pan, filleted
// hinge, back, integrated headrest) swept across x with a parabolic
// bolster, then offset to a real thickness and rimmed. This is the
// almost-lying seat — set the back recline high and the pilot lies in it.
function seatShell(parent, A, P, g) {
  const sx = g.sx, szc = g.szc, panY = g.panY;
  const rake = g.rake, tilt = g.tilt, hw = g.hw, backH = g.backH;
  const H = [panY, szc - 0.18];                       // hinge (y, z)
  const panL = 0.42, bc = Math.cos(rake), bs = Math.sin(rake);
  const F = [H[0] + panL * Math.sin(tilt), H[1] + panL * Math.cos(tilt)];
  const hH = backH + 0.16;                            // head above the hinge
  const B = [H[0] + hH * bc, H[1] - hH * bs];
  const prof = [
    [sx, F[0] + 0.055, F[1] + 0.030],                 // front lip, curled up
    [sx, F[0], F[1]],
    [sx, H[0], H[1]],
    [sx, B[0], B[1]],
    [sx, B[0] + 0.035, B[1] + 0.055],                 // headrest curl forward
  ];
  const C = filletPath(prof, 0.085, 5);
  const NU = C.length, NV = 12, TH = 0.011;
  const uu = [0];
  for (let i = 1; i < NU; i++)
    uu.push(uu[i - 1] + _len3(_sub3(C[i], C[i - 1])));
  const total = uu[NU - 1] || 1;
  const bag = Bag(M.shellC);
  const N = [], W = [], BO = [];
  for (let i = 0; i < NU; i++) {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(NU - 1, i + 1)];
    const t = _nrm3(_sub3(b, a));
    N.push([0, -t[2], t[1]]);                         // toward the occupant
    const u = uu[i] / total;
    W.push(hw * (u < 0.45 ? 1.0 : 1.0 - 0.42 * (u - 0.45) / 0.55));
    BO.push(0.052 * (1 - 0.55 * Math.max(0, (u - 0.5) / 0.5)));
  }
  const pt = (i, v, off) => {
    const w = W[i] * v, r = BO[i] * v * v + (off || 0);
    return [C[i][0] + w, C[i][1] + N[i][1] * r, C[i][2] + N[i][2] * r];
  };
  const IN = [], OUT = [];
  for (let i = 0; i < NU; i++) {
    const ri = [], ro = [];
    for (let j = 0; j <= NV; j++) {
      const v = -1 + 2 * j / NV;
      const a = pt(i, v, 0), b = pt(i, v, -TH);
      ri.push(bag.v(a[0], a[1], a[2]));
      ro.push(bag.v(b[0], b[1], b[2]));
    }
    IN.push(ri); OUT.push(ro);
  }
  for (let i = 0; i < NU - 1; i++) for (let j = 0; j < NV; j++) {
    bag.quad(IN[i][j], IN[i][j + 1], IN[i + 1][j + 1], IN[i + 1][j]);
    bag.quad(OUT[i][j], OUT[i + 1][j], OUT[i + 1][j + 1], OUT[i][j + 1]);
  }
  for (let i = 0; i < NU - 1; i++) {                  // side rims
    bag.quad(IN[i][0], IN[i + 1][0], OUT[i + 1][0], OUT[i][0]);
    bag.quad(IN[i][NV], OUT[i][NV], OUT[i + 1][NV], IN[i + 1][NV]);
  }
  for (let j = 0; j < NV; j++) {                      // end rims
    bag.quad(IN[0][j], OUT[0][j], OUT[0][j + 1], IN[0][j + 1]);
    bag.quad(IN[NU - 1][j], IN[NU - 1][j + 1],
             OUT[NU - 1][j + 1], OUT[NU - 1][j]);
  }
  bag.mesh(parent);
  // a thin cushion pad laid in the bucket, so it is not bare carbon
  const pad = Bag(M.cushion);
  const PI = [], PO = [];
  const i0 = Math.round(NU * 0.10), i1 = Math.round(NU * 0.93);
  for (let i = i0; i <= i1; i++) {
    const ri = [], ro = [];
    for (let j = 1; j < NV; j++) {
      const v = (-1 + 2 * j / NV) * 0.88;
      const a = pt(i, v, 0.028 * (1 - Math.abs(v)) + 0.004);
      const b = pt(i, v, 0.004);
      ri.push(pad.v(a[0], a[1], a[2]));
      ro.push(pad.v(b[0], b[1], b[2]));
    }
    PI.push(ri); PO.push(ro);
  }
  for (let i = 0; i < PI.length - 1; i++)
    for (let j = 0; j < PI[0].length - 1; j++) {
      pad.quad(PI[i][j], PI[i][j + 1], PI[i + 1][j + 1], PI[i + 1][j]);
      pad.quad(PO[i][j], PO[i + 1][j], PO[i + 1][j + 1], PO[i][j + 1]);
    }
  pad.mesh(parent);
}

// ---- 2. THE AIRLINER SEAT -------------------------------------------------
// Deep squab, thick raked back, a separate headrest on posts, armrests
// with a rounded rail, on a slim pedestal. Same puffed-slab cushions as
// the light seat, so the quality reads the same.
function seatAirline(parent, A, P, g) {
  const sx = g.sx, szc = g.szc, floor = g.floor, panY = g.panY;
  const rake = g.rake, tilt = g.tilt, hw = g.hw, backH = g.backH;
  const bc = Math.cos(rake), bs = Math.sin(rake);
  const w = hw * 1.02;
  cushion(parent, [sx, panY + 0.5 * 0.24 * Math.sin(tilt), szc],
          [1, 0, 0], [0, -0.05 - Math.sin(tilt), -Math.cos(tilt)],
          [0, 1, 0], w, 0.24, 0.095, 2, true);
  const bH = backH * 0.86;
  cushion(parent,
          [sx, panY + 0.03 + 0.5 * bH * bc, szc - 0.21 - 0.5 * bH * bs],
          [1, 0, 0], [0, bc, -bs], [0, bs, bc],
          w * 0.98, 0.5 * bH, 0.085, 3, false);
  // headrest: its own slab, a gap above the back, curled a touch forward
  const hy = panY + 0.05 + (bH + 0.10) * bc;
  const hz = szc - 0.21 - (bH + 0.10) * bs;
  const hr = rake - 0.14, hc = Math.cos(hr), hs2 = Math.sin(hr);
  cushion(parent, [sx, hy, hz], [1, 0, 0], [0, hc, -hs2], [0, hs2, hc],
          w * 0.62, 0.085, 0.070, 1, false);
  const bag = Bag(M.trim);
  for (const s2 of [-1, 1]) tubeRun(bag, [
    [sx + s2 * w * 0.34, hy - 0.10 * hc, hz + 0.10 * hs2],
    [sx + s2 * w * 0.34, hy - 0.02 * hc, hz + 0.02 * hs2]], 0.011, 8);
  // armrests: a rounded rail on each side, padded on top
  const ay = panY + 0.20, az0 = szc + 0.16, az1 = szc - 0.20;
  for (const s2 of [-1, 1]) {
    const ax = sx + s2 * (w + 0.055);
    tubeRun(bag, [[ax, ay - 0.12, az1 - 0.02], [ax, ay, az1 + 0.03],
                  [ax, ay, az0]], 0.016, 10);
    cushion(parent, [ax, ay + 0.022, (az0 + az1) / 2 + 0.02],
            [1, 0, 0], [0, 0, -1], [0, 1, 0],
            0.042, (az0 - az1) * 0.42, 0.020, 0, true);
  }
  // pedestal: two transverse legs onto a floor track
  const rh = hw * (2 / 3);
  for (const z of [szc + 0.16, szc - 0.16])
    tubeRun(bag, [[sx - rh, floor + 0.015, z],
                  [sx - rh * 0.86, panY - 0.05, z],
                  [sx + rh * 0.86, panY - 0.05, z],
                  [sx + rh, floor + 0.015, z]], 0.018, 10);
  for (const s2 of [-1, 1])
    tubeRun(bag, [[sx + s2 * rh, floor + 0.015, szc + 0.22],
                  [sx + s2 * rh, floor + 0.015, szc - 0.22]], 0.014, 8);
  bag.mesh(parent);
}

function buildSeat(parent, A, P, sx, zBack, sbs, SP) {
  const g = seatGeom(A, P, sx, zBack, sbs, SP);
  const type = Math.round(P.seatType || 0);
  if (type === 1) seatShell(parent, A, P, g);
  else if (type === 2) seatAirline(parent, A, P, g);
  else seatTube(parent, A, P, g);
  // lap belts, hanging over the squab rim (webbing is flat — a ribbon).
  // Off by default (user 2026-08-19: removed for now).
  if (P.seatBelt) {
    const szc = g.szc, panY = g.panY, hw = g.hw;
    const bag = Bag(M.belt);
    for (const s3 of [-1, 1]) {
      ribbon(bag, [
        [sx + s3 * (hw + 0.010), panY - 0.045, szc - 0.19],
        [sx + s3 * hw * 0.96, panY + 0.015, szc - 0.10],
        [sx + s3 * hw * 0.88, panY + 0.020, szc + 0.06],
        [sx + s3 * hw * 0.80, panY - 0.055, szc + 0.17],
        [sx + s3 * hw * 0.74, panY - 0.155, szc + 0.19],
        [sx + s3 * hw * 0.72, panY - 0.235, szc + 0.17],
      ], 0.048, 0.5);
      const bx = sx + s3 * hw * 0.72, by = panY - 0.255, bz = szc + 0.17;
      boxAt(parent, s3 > 0 ? M.metal : M.dark,
            [bx, by - 0.012, bz + 0.004],
            s3 > 0 ? [0.055, 0.045, 0.010] : [0.045, 0.060, 0.006]);
    }
    bag.mesh(parent);
  }
  return { panY: g.panY, floor: g.floor, szc: g.szc, hw: g.hw,
           backH: g.backH, rake: g.rake };
}

// ---- CONTROLS -------------------------------------------------------------
// each builder returns { obj (an anchor Object3D placed AT the grip,
// oriented as the hand/foot should sit), label }
//
// PLACEMENT (user 2026-08-19, "full 3d adjustment for these pieces"):
// every control is auto-laced to the seat and the cabin, then SHIFTED by
// its own 3-axis offset triple — `stickX/Y/Z`, `thrX/Y/Z`, all metres,
// all defaulting to 0, +x to the pilot's LEFT, +y up, +z toward the
// nose. Offsets rather than absolute stations because each style has a
// different natural home (a wall lever, a dash rod and a console
// quadrant do not share a datum), and this way the default lacing stays
// correct for every style while one slider set adjusts them all. The
// whole assembly rides a Group, so the grip anchor — and therefore the
// dummy's IK — follows automatically.
function ctlShift(g, P, kx, ky, kz) {
  const s = new THREE.Group();
  s.position.set(P[kx] || 0, P[ky] || 0, P[kz] || 0);
  g.add(s);
  return s;
}
function anchorAt(parent, p, rx, ry) {
  const o = new THREE.Object3D();
  o.position.set(p[0], p[1], p[2]);
  if (rx) o.rotation.x = rx;
  if (ry) o.rotation.y = ry;
  parent.add(o);
  return o;
}
// A GRIP, not a pose (user 2026-08-19: "the orientation of the hands is
// quite wrong"). A hand closed round a grip does not point ALONG it —
// the palm width lies along the grip and the fingers curl AROUND it,
// away from the arm. So a grip anchor records only the grip's own AXIS,
// and the hand's basis is solved at IK time from that axis and the
// direction the arm arrives from: hand +x (its width) along the grip,
// hand -y (its length, wrist->fingertips) wrapping away from the
// shoulder. `fixed` anchors (the feet) keep the orientation as authored.
function gripAt(parent, p, axis) {
  const o = anchorAt(parent, p);
  o.userData.grip = new THREE.Vector3(axis[0], axis[1], axis[2]).normalize();
  return o;
}
const _gx = new THREE.Vector3(), _gy = new THREE.Vector3(),
      _gz = new THREE.Vector3(), _gm = new THREE.Matrix4(),
      _gv = new THREE.Vector3(), _gq = new THREE.Quaternion();
function gripQuat(anchor, from, out) {
  // axis in world (the control groups only translate, but be exact)
  _gx.copy(anchor.userData.grip)
     .applyQuaternion(anchor.getWorldQuaternion(_qw)).normalize();
  anchor.getWorldPosition(_v3);
  _gy.copy(_v3).sub(from);                       // arm -> grip
  _gy.addScaledVector(_gx, -_gy.dot(_gx));       // across the grip only
  if (_gy.lengthSq() < 1e-8) _gy.set(0, 0, 1).addScaledVector(_gx, -_gx.z);
  _gy.normalize().negate();                      // hand runs along -y
  _gz.crossVectors(_gx, _gy).normalize();
  _gm.makeBasis(_gx, _gy, _gz);
  return out.setFromRotationMatrix(_gm);
}
function buildStickCenter(g0, A, P, sx, seat) {
  const g = ctlShift(g0, P, 'stickX', 'stickY', 'stickZ');
  const zPiv = (seat ? seat.szc + 0.26 : A.zBack + 0.46);
  const y0 = A.floorAt(zPiv) + 0.03;
  const rk = 8 * D2R, L = P.stickLen != null ? P.stickLen : 0.44;
  const top = [sx, y0 + L * Math.cos(rk), zPiv - L * Math.sin(rk)];
  ballAt(g, M.dark, [sx, y0, zPiv], 0.030);
  tube(g, M.metal, [sx, y0, zPiv], top, 0.014);
  tube(g, M.knob, [sx, top[1] - 0.005, top[2]],
       [sx, top[1] + 0.075, top[2] + 0.012], 0.020);
  ballAt(g, M.knob, [sx, top[1] + 0.085, top[2] + 0.014], 0.023);
  // the grip is the vertical-ish shaft top: axis along the stick
  return { obj: gripAt(g, [sx, top[1] + 0.035, top[2] + 0.006],
                       [0, Math.cos(rk), Math.sin(rk)]),
           label: 'stick' };
}
function buildYoke(g0, A, P, sx) {
  const g = ctlShift(g0, P, 'stickX', 'stickY', 'stickZ');
  const yY = A.waistY - 0.04;
  const zHub = A.zBack + 0.54;
  tube(g, M.ctrl, [sx, yY, A.zDash + 0.05], [sx, yY, zHub], 0.018);
  boxAt(g, M.ctrl, [sx, yY, zHub + 0.02], [0.075, 0.05, 0.05]);
  const grips = {};
  for (const sd of [-1, 1]) {
    tube(g, M.ctrl, [sx, yY, zHub + 0.02],
         [sx + sd * 0.105, yY + 0.015, zHub + 0.025], 0.013);
    tube(g, M.knob, [sx + sd * 0.105, yY + 0.015, zHub + 0.025],
         [sx + sd * 0.150, yY + 0.095, zHub + 0.035], 0.016);
    // the horn IS the grip axis (out and up from the hub)
    grips[sd] = gripAt(g, [sx + sd * 0.132, yY + 0.062, zHub + 0.030],
                       [sd * 0.045, 0.080, 0.010]);
  }
  return { objL: grips[1], objR: grips[-1], label: 'yoke' };
}
function buildStickSide(g0, A, P, sx, seat) {
  const g = ctlShift(g0, P, 'stickX', 'stickY', 'stickZ');
  // right-hand side stick on an armrest ledge (pilot's right = -x)
  const xs = sx - Math.min(0.30, A.halfW - 0.08);
  const z0 = A.zBack + 0.42;
  const y0 = (seat ? seat.panY : A.floorAt(z0) + P.seatH) + 0.13;
  // a side stick is a SHORT lever: it takes its length from the same
  // slider, at the third a forearm-rest stick actually stands
  const sl = (P.stickLen != null ? P.stickLen : 0.44) * 0.33;
  boxAt(g, M.console, [xs, y0 - 0.05, z0], [0.11, 0.10, 0.24]);
  tube(g, M.metal, [xs, y0, z0], [xs, y0 + sl, z0 - sl * 0.15], 0.012);
  tube(g, M.knob, [xs, y0 + sl - 0.005, z0 - sl * 0.15],
       [xs, y0 + sl + 0.055, z0 - sl * 0.15 - 0.010], 0.018);
  return { obj: gripAt(g, [xs, y0 + sl + 0.025, z0 - sl * 0.15 - 0.004],
                       [0, 0.99, -0.15]),
           label: 'side stick' };
}
function buildPedals(g, A, P, sx) {
  const zP = A.zBack + P.pedalZ;
  const yF = A.floorAt(zP), yP = yF + P.pedalH;
  // SPREAD (user): how far apart the two pedals stand — a narrow
  // footwell wants them close together
  const sp = P.pedalSpread != null ? P.pedalSpread : 0.15;
  const out = {};
  // THE PLATES FLOAT (user 2026-08-19): no linkage, no floor posts.
  // Each is a footplate RAMP tilted toes-up by PED_RAMP — a foot with
  // the leg extended forward rests at about this angle, and the poser's
  // own ankle limit is 30 degrees of dorsiflexion, so a steeper plate
  // could not be stood on.
  const PED_RAMP = (P.pedalAngle != null ? P.pedalAngle : 25) * D2R;
  const c = Math.cos(PED_RAMP), s = Math.sin(PED_RAMP);
  for (const sd of [-1, 1]) {
    const xp = sx + sd * sp;
    boxAt(g, M.metal, [xp, yP, zP], [0.095, 0.014, 0.19], -PED_RAMP);
    // THE SOLE SITS ON THE PLATE: the ankle is placed so that the
    // mid-sole (0.06 forward of the ankle, 0.0725 below it in bone
    // space) lands on the plate's centre once the foot is ramped.
    // (+ half the plate and a hair of clearance along its normal, or the
    // shoe sinks into the plate)
    const sy = -0.0725, sz = 0.06, cl = 0.010;
    out[sd] = anchorAt(g, [xp,
      yP - (sy * c - sz * (-s)) + cl * c,
      zP - (sy * (-s) + sz * c) - cl * s], -PED_RAMP);
  }
  return { objL: out[1], objR: out[-1], label: 'pedals' };
}
function buildThrottleWall(g0, A, P, sx) {
  const g = ctlShift(g0, P, 'thrX', 'thrY', 'thrZ');
  const wx = (sx >= 0 ? 1 : -1) * Math.max(0.2, A.halfW * 0.90);
  const zT = A.zBack + 0.40;
  const yT = A.floorAt(zT) + 0.42;
  const inb = wx > 0 ? -1 : 1;               // inboard direction
  boxAt(g, M.ctrl, [wx, yT, zT], [0.028, 0.13, 0.20]);
  const piv = [wx + inb * 0.03, yT - 0.01, zT - 0.04];
  // the lever runs up and forward from its pivot, at the length the
  // slider asks for (user 2026-08-19)
  const LT = P.thrLen != null ? P.thrLen : 0.16;
  const ld = _nrm3([inb * 0.025, 0.11, 0.105]);
  const kn = _off3(piv, ld, LT);
  tube(g, M.metal, piv, kn, 0.009);
  ballAt(g, M.knob, kn, 0.026);
  // the lever is the grip axis
  return { obj: gripAt(g, kn, [kn[0] - piv[0], kn[1] - piv[1], kn[2] - piv[2]]),
           label: 'throttle (wall)' };
}
function buildThrottleDash(g0, A, P, sx) {
  const g = ctlShift(g0, P, 'thrX', 'thrY', 'thrZ');
  const xT = sx + 0.16, yT = A.floorAt(A.zDash) + 0.42;
  const z0 = A.zDash + 0.005;
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.020, 0.020, 0.012, 12), M.metal);
  m.position.set(xT, yT, z0 - 0.006); m.rotation.x = Math.PI / 2;
  g.add(m);
  const LT = P.thrLen != null ? P.thrLen : 0.16;
  tube(g, M.metal, [xT, yT, z0], [xT, yT, z0 - LT * 0.60], 0.007);
  const k = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.030, 14), M.knob);
  k.position.set(xT, yT, z0 - LT * 0.72); k.rotation.x = Math.PI / 2;
  g.add(k);
  // a push-pull rod: the hand closes round the knob, axis along the rod
  return { obj: gripAt(g, [xT, yT, z0 - LT * 0.72], [0, 0, 1]),
           label: 'throttle (push-pull)' };
}
// THE CONSOLE BOX IS A SIDE-BY-SIDE FITTING (user 2026-08-19): with one
// seat across the cabin there is nowhere for it to stand — a single or
// tandem cockpit gets the THROTTLE QUADRANT ALONE, on its own pedestal
// off the floor. `box` says which case this is.
function buildConsole(g0, A, P, cx, withQuadrant, box) {
  const z0 = A.zBack + 0.04, z1 = Math.min(A.zDash - 0.02, z0 + 0.85);
  const h = 0.26;
  const yF = A.floorAt((z0 + z1) / 2);
  if (box) {
    boxAt(g0, M.console, [cx, yF + h / 2, (z0 + z1) / 2],
          [0.19, h, z1 - z0]);
    boxAt(g0, M.dark, [cx, yF + h + 0.012, (z0 + z1) / 2],
          [0.16, 0.024, (z1 - z0) * 0.9]);
  }
  if (!withQuadrant) return null;
  const g = ctlShift(g0, P, 'thrX', 'thrY', 'thrZ');
  const zQ = z0 + 0.30;
  // NO PEDESTAL (user 2026-08-19): without the console the quadrant and
  // its small box simply float — the mounting is not the point here
  const yQ = box ? yF + h + 0.02 : A.floorAt(zQ) + 0.30;
  boxAt(g, M.ctrl, [cx, yQ + 0.03, zQ], [0.075, 0.06, 0.15]);
  const LT = P.thrLen != null ? P.thrLen : 0.16;
  const piv = [cx, yQ + 0.02, zQ - 0.02];
  const kn = _off3(piv, _nrm3([0, 0.17, 0.07]), LT);
  tube(g, M.metal, piv, kn, 0.008);
  ballAt(g, M.knob, kn, 0.024);
  return { obj: gripAt(g, kn, [kn[0]-piv[0], kn[1]-piv[1], kn[2]-piv[2]]),
           label: 'throttle (quadrant)' };
}

// ---- THE DUMMY (mannequin_poser.html port) --------------------------------
const BONES = [
  ['root',      null,       [0, 0, 0]],
  ['lumbar',    'root',     [0, 0.09, 0]],
  ['thorax',    'lumbar',   [0, 0.16, 0]],
  ['neck',      'thorax',   [0, 0.24, 0]],
  ['head',      'neck',     [0, 0.08, 0]],
  ['clavicleL', 'thorax',   [ 0.045, 0.195, 0]],
  ['shoulderL', 'clavicleL',[ 0.145, 0.020, 0]],
  ['elbowL',    'shoulderL',[0, -0.29, 0]],
  ['wristL',    'elbowL',   [0, -0.26, 0]],
  ['clavicleR', 'thorax',   [-0.045, 0.195, 0]],
  ['shoulderR', 'clavicleR',[-0.145, 0.020, 0]],
  ['elbowR',    'shoulderR',[0, -0.29, 0]],
  ['wristR',    'elbowR',   [0, -0.26, 0]],
  ['hipL',      'root',     [ 0.095, -0.02, 0]],
  ['kneeL',     'hipL',     [0, -0.44, 0]],
  ['ankleL',    'kneeL',    [0, -0.42, 0]],
  ['hipR',      'root',     [-0.095, -0.02, 0]],
  ['kneeR',     'hipR',     [0, -0.44, 0]],
  ['ankleR',    'kneeR',    [0, -0.42, 0]],
];
const BASE_STATURE = 1.75;
const STATURES = [1.52, 1.75, 1.88];         // 5th F / 50th / 95th M

function segmentGeom(len, rTop, rMid, rBot, seg) {
  seg = seg || 12;
  const pts = [new THREE.Vector2(0.0001, -len)];
  for (let i = seg; i >= 0; i--) {
    const t = i / seg;
    const r = t < 0.5
      ? THREE.MathUtils.lerp(rTop, rMid, smoothS(t * 2))
      : THREE.MathUtils.lerp(rMid, rBot, smoothS((t - 0.5) * 2));
    pts.push(new THREE.Vector2(Math.max(r, 0.001), -len * t));
  }
  pts.push(new THREE.Vector2(0.0001, 0));
  return new THREE.LatheGeometry(pts, 18);
}
function shellGeom(y0, y1, rfn, seg) {
  seg = seg || 14;
  const pts = [new THREE.Vector2(0.0001, y0)];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    pts.push(new THREE.Vector2(Math.max(rfn(t), 0.001),
      THREE.MathUtils.lerp(y0, y1, t)));
  }
  pts.push(new THREE.Vector2(0.0001, y1));
  return new THREE.LatheGeometry(pts, 20);
}

const CHAINS = {
  armL: { root: 'shoulderL', mid: 'elbowL', end: 'wristL', arm: true,
          label: 'L hand' },
  armR: { root: 'shoulderR', mid: 'elbowR', end: 'wristR', arm: true,
          label: 'R hand' },
  legL: { root: 'hipL', mid: 'kneeL', end: 'ankleL', arm: false,
          label: 'L foot' },
  legR: { root: 'hipR', mid: 'kneeR', end: 'ankleR', arm: false,
          label: 'R foot' },
};

function makeDummy(parent) {
  const fig = new THREE.Group();
  parent.add(fig);
  const bones = {};
  BONES.forEach(([name, par, pos]) => {
    const b = new THREE.Object3D();
    b.name = name;
    b.position.set(pos[0], pos[1], pos[2]);
    (par ? bones[par] : fig).add(b);
    bones[name] = b;
  });
  const att = (bn, mesh) => { bones[bn].add(mesh); return mesh; };
  const jball = (bn, r) =>
    att(bn, new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), M.joint));
  // pelvis
  {
    const g = shellGeom(-0.10, 0.07,
      t => 0.088 + 0.055 * smoothS(t) - 0.012 * t * t);
    const m = new THREE.Mesh(g, M.shell); m.scale.z = 0.74;
    att('root', m);
  }
  jball('lumbar', 0.082);
  {
    const g = shellGeom(0.0, 0.16, t => 0.098 + 0.030 * t);
    const m = new THREE.Mesh(g, M.shell); m.scale.z = 0.74;
    att('lumbar', m);
  }
  {
    const g = shellGeom(-0.02, 0.245, t => {
      const u = smoothS(clamp(t * 1.25, 0, 1));
      return 0.118 + 0.048 * u - 0.030 * Math.max(0, (t - 0.82) / 0.18);
    });
    const m = new THREE.Mesh(g, M.shell); m.scale.set(1.06, 1, 0.70);
    att('thorax', m);
  }
  {
    const n = new THREE.Mesh(
      new THREE.CylinderGeometry(0.043, 0.050, 0.09, 14), M.joint);
    n.position.y = 0.035; att('neck', n);
    const g = shellGeom(-0.075, 0.145, t => {
      const y = t * 2 - 1;
      return 0.098 * Math.sqrt(Math.max(0, 1 - y * y * 0.97));
    }, 16);
    const h = new THREE.Mesh(g, M.shell);
    h.position.y = 0.10; h.scale.set(0.94, 1, 0.90);
    att('head', h);
  }
  for (const s of ['L', 'R']) {
    jball('shoulder' + s, 0.062);
    att('shoulder' + s,
        new THREE.Mesh(segmentGeom(0.29, 0.050, 0.055, 0.040), M.shell));
    jball('elbow' + s, 0.049);
    att('elbow' + s,
        new THREE.Mesh(segmentGeom(0.26, 0.043, 0.046, 0.032), M.shell));
    jball('wrist' + s, 0.036);
    const hand = new THREE.Mesh(segmentGeom(0.165, 0.034, 0.046, 0.020),
                                M.dark);
    hand.scale.set(1.0, 1, 0.52);
    att('wrist' + s, hand);
  }
  for (const s of ['L', 'R']) {
    jball('hip' + s, 0.072);
    att('hip' + s,
        new THREE.Mesh(segmentGeom(0.44, 0.068, 0.072, 0.052), M.shell));
    jball('knee' + s, 0.060);
    att('knee' + s,
        new THREE.Mesh(segmentGeom(0.42, 0.058, 0.062, 0.040), M.shell));
    jball('ankle' + s, 0.043);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.090, 0.055, 0.225),
                                M.dark);
    foot.position.set(0, -0.045, 0.058); att('ankle' + s, foot);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.038, 0.05),
                               M.dark);
    toe.position.set(0, -0.052, 0.185); att('ankle' + s, toe);
  }
  return { fig, bones };
}

// pose = { joint: [x,y,z] degrees }; mirrored L→R with y/z negated
function seatedPose(reclineDeg, resting, tiltDeg) {
  const hip = -88 - (tiltDeg || 0);   // squab tilt raises the thighs
  const lumbar = 2, thorax = 0;
  // THE HEAD KEEPS LOOKING STRAIGHT (user 2026-08-19): a reclined pilot
  // does not stare at the roof — the neck and head take up the recline
  // so the eyes stay on the horizon. Counter-rotate everything upstream,
  // neck first (it has the range), head for the remainder, both clamped
  // to the poser's own joint limits.
  const need = -(-reclineDeg + lumbar + thorax);
  const neck = clamp(need * 0.75, -40, 50);
  const head = clamp(need - neck, -25, 25);
  // resting = no controls to hold: arms drop, hands settle on the thighs
  const sym = resting ? {
    hipL: [hip, 0, 6], kneeL: [88, 0, 0], ankleL: [-4, 0, 0],
    shoulderL: [-22, 0, 6], elbowL: [-48, 14, 0], wristL: [-14, 0, 0],
  } : {
    hipL: [hip, 0, 6], kneeL: [88, 0, 0], ankleL: [-4, 0, 0],
    shoulderL: [-14, 0, 7], elbowL: [-72, 20, 0], wristL: [-6, 0, 0],
  };
  const pose = {};
  for (const n in sym) {
    pose[n] = sym[n].slice();
    pose[n.slice(0, -1) + 'R'] =
      [sym[n][0], -sym[n][1], -sym[n][2]];
  }
  pose.root = [-reclineDeg, 0, 0];
  pose.lumbar = [lumbar, 0, 0];
  pose.thorax = [thorax, 0, 0];
  pose.neck = [neck, 0, 0];
  pose.head = [head, 0, 0];
  return pose;
}
function applyPose(bones, pose) {
  for (const n in pose)
    bones[n].rotation.set(pose[n][0] * D2R, pose[n][1] * D2R,
                          pose[n][2] * D2R);
}

// ---- analytic two-bone IK (poser port, solved ONCE per build) -------------
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(),
      _v3 = new THREE.Vector3(), _u = new THREE.Vector3(),
      _perp = new THREE.Vector3(), _n = new THREE.Vector3(),
      _X = new THREE.Vector3(), _Y = new THREE.Vector3(),
      _Z = new THREE.Vector3(), _mat = new THREE.Matrix4(),
      _qw = new THREE.Quaternion(), _qp = new THREE.Quaternion();
function boneWorldFromBasis(bone, dir, nrm) {
  _Y.copy(dir).negate();                    // bone local +Y opposes the segment
  _X.copy(nrm).addScaledVector(_Y, -nrm.dot(_Y));
  if (_X.lengthSq() < 1e-8) _X.set(1, 0, 0).addScaledVector(_Y, -_Y.x);
  _X.normalize();
  _Z.crossVectors(_X, _Y);
  _mat.makeBasis(_X, _Y, _Z);
  _qw.setFromRotationMatrix(_mat);
  bone.parent.getWorldQuaternion(_qp).invert();
  _qp.multiply(_qw);
  bone.quaternion.copy(_qp);
}
// target/pole are world-space Vector3s; returns the reach gap (m, >0 short)
function ikSolve(dum, chainKey, target, pole, alignQ) {
  const c = CHAINS[chainKey], bones = dum.bones;
  const sc = dum.fig.scale.x;
  const L1 = bones[c.mid].position.length() * sc;
  const L2 = bones[c.end].position.length() * sc;
  bones[c.root].getWorldPosition(_v1);
  _u.copy(target).sub(_v1);
  let d = _u.length();
  const gap = d - (L1 + L2);
  d = clamp(d, Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-4);
  if (_u.lengthSq() < 1e-8) _u.set(0, -1, 0); else _u.normalize();
  _perp.copy(pole).sub(_v1);
  _perp.addScaledVector(_u, -_perp.dot(_u));
  if (_perp.lengthSq() < 1e-6) _perp.set(0, 0, c.arm ? -1 : 1);
  _perp.normalize();
  _n.crossVectors(c.arm ? _u : _perp, c.arm ? _perp : _u).normalize();
  const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
  const Aang = Math.acos(cosA);
  _v2.copy(_u).multiplyScalar(Math.cos(Aang))
     .addScaledVector(_perp, Math.sin(Aang)).normalize();
  boneWorldFromBasis(bones[c.root], _v2, _n);
  bones[c.root].updateMatrixWorld(true);
  bones[c.mid].getWorldPosition(_v3);
  _v2.copy(target).sub(_v3);
  if (_v2.lengthSq() < 1e-8) _v2.set(0, -1, 0); else _v2.normalize();
  boneWorldFromBasis(bones[c.mid], _v2, _n);
  bones[c.mid].updateMatrixWorld(true);
  if (alignQ) {
    bones[c.end].parent.getWorldQuaternion(_qp).invert();
    _qp.multiply(alignQ);
    bones[c.end].quaternion.copy(_qp);
    bones[c.end].updateMatrixWorld(true);
  }
  return gap;
}
// default pole from the CURRENT (FK-seated) bend — the poser's ikInit
function ikDefaultPole(dum, chainKey, out) {
  const c = CHAINS[chainKey], bones = dum.bones;
  bones[c.root].getWorldPosition(_v1);
  bones[c.mid].getWorldPosition(_v2);
  bones[c.end].getWorldPosition(_v3);
  _u.copy(_v3).sub(_v1);
  const dl = _u.length() || 1e-4; _u.divideScalar(dl);
  _perp.copy(_v2).sub(_v1);
  _perp.addScaledVector(_u, -_perp.dot(_u));
  if (_perp.lengthSq() < 1e-6) _perp.set(0, 0, c.arm ? -1 : 1);
  _perp.normalize();
  out.copy(_v2).addScaledVector(_perp, 0.38 * dum.fig.scale.x);
  return out;
}

// world position + orientation of a grip anchor Object3D
const _aq = new THREE.Quaternion(), _ap = new THREE.Vector3();
const _hv = new THREE.Vector3();
function anchorWorld(o) {
  o.updateWorldMatrix(true, false);
  return { p: o.getWorldPosition(new THREE.Vector3()),
           q: o.getWorldQuaternion(new THREE.Quaternion()) };
}

// ---- LAYOUT ---------------------------------------------------------------
// Everything the crew stands ON or reaches FOR comes from the resolved
// rings, times the unit and the design scale (the crew itself is metric
// and never scales). THE FLOOR IS DETECTED, not read off a level:
// the cage's `floorY` is the top of the floor LOOP — a wall rail, not a
// floor. THE REFERENCE IS THE DOOR SILL (user 2026-08-19): the bottom of
// the door cut is where you step in, so the floor = centreline keel +
// the measured sill height off the front-most door outline; fallback
// floorboard allowance when no door is cut.
const FLOOR_BOARDS = 0.035;              // fallback: boards over the belly, m
function anchors(spec, P, mesh) {
  // THE UNIT: metres = cage x CAGE_UNIT x planeScale (see _cage_gen.js).
  // The crew is built in metres and never scales — it is the ruler.
  const k = (window.CAGE2.CAGE_UNIT || 1) * (P.planeScale || 1);
  const R = window.CAGE2.cageResolve(spec);
  const rg = n => R.rings.find(r => r.name === n);
  const cabB = rg('pilCabB');
  const win = rg('ring');
  const wsF = rg('wsFront') || rg('aeroWsA') || win;
  // centreline keel polyline, scaled to world (metres)
  const pts = R.rings.map(r => ({
    z: (r.lv.keel.zC != null ? r.lv.keel.zC : r.lv.keel.z) * k,
    y: (r.lv.keel.yC != null ? r.lv.keel.yC : r.lv.keel.y) * k,
  })).sort((a, b) => a.z - b.z);
  const mirZ = R.mirrorZ != null ? R.mirrorZ * k : null;
  const keelAt = z => {
    // mirrored pod: the resolve table stops at the arceau — sample the
    // reflected station instead
    if (mirZ != null && spec.config && spec.config.mirror && z < mirZ)
      z = 2 * mirZ - z;
    if (z <= pts[0].z) return pts[0].y;
    for (let i = 0; i < pts.length - 1; i++)
      if (z <= pts[i + 1].z) {
        const t = (z - pts[i].z) / Math.max(1e-9, pts[i + 1].z - pts[i].z);
        return pts[i].y + (pts[i + 1].y - pts[i].y) * t;
      }
    return pts[pts.length - 1].y;
  };
  // sill height: lowest point of the front-most door outline vs the
  // keel line at that station (outline pts are raw cage units). An
  // EXPLODED door part is measured at its as-built place — the part's
  // faces record their translation as cutOff.
  let sillOff = FLOOR_BOARDS;
  const doors = ((mesh && mesh.outlines) || []).filter(o =>
    o.kind === 'door' && o.pts && o.pts.length);
  if (doors.length) {
    const meanZ = o => o.pts.reduce((s, p) => s + p[2], 0) / o.pts.length;
    const front = doors.reduce((a, b) => meanZ(a) > meanZ(b) ? a : b);
    let x0 = [0, 0, 0];
    if (mesh.F && front.ids) {
      const idset = new Set(front.ids);
      for (const f of mesh.F)
        if (f.cutOff && f.doorKey && f.v.some(vi => idset.has(vi))) {
          x0 = f.cutOff; break;
        }
    }
    let off = 1e9;
    for (const p of front.pts)
      off = Math.min(off, (p[1] - x0[1]) * k - keelAt((p[2] - x0[2]) * k));
    if (off > -0.05 && off < 0.5) sillOff = Math.max(0, off);
  }
  const floorAt = z => keelAt(z) + sillOff;
  const zBack = (cabB ? cabB.lv.waist.z : 0) * k + 0.05 + (P.seatZ || 0);
  const zDash = ((wsF ? wsF.lv.waist.z : (win ? win.lv.waist.z : 1) + 0.5)
              - (P.dashBack || 0.05)) * k - 0.02;
  // (overall plane dims now come from the displayed bounding box in the
  // viewer's dimensions pane — the honest measure, canopy included)
  return { k, floorAt, halfW: spec.cabin.halfW * k,
           roofY: spec.cabin.roofY * k, waistY: spec.waistY * k,
           zBack, zDash, zWin: win ? win.lv.waist.z * k : 0 };
}
function seatPlaces(A, P) {
  const lay = Math.round(P.seatLayout);
  if (lay === 0) return [{ x: 0, zBack: A.zBack, pilot: true }];
  if (lay === 1) {
    const gp = Math.min(P.seatGap, Math.max(0.18, A.halfW - 0.20));
    return [{ x: gp, zBack: A.zBack, pilot: true },
            { x: -gp, zBack: A.zBack, pilot: false }];
  }
  return [{ x: 0, zBack: A.zBack, pilot: true },
          { x: 0, zBack: A.zBack - P.seatPitch, pilot: false }];
}

// ---- THE BUILD HOOK -------------------------------------------------------
let group = null;
PAGE.post = ({ scene, spec, mesh, P, stat }) => {
  if (group) {
    group.traverse(c => { if (c.geometry) c.geometry.dispose(); });
    scene.remove(group);
    group = null;
  }
  if (!P.crewOn) return;
  group = new THREE.Group();
  scene.add(group);

  const A = anchors(spec, P, mesh);
  const places = seatPlaces(A, P);
  const sbs = Math.round(P.seatLayout) === 1;
  // per-seat settings: the second seat falls back to the first's when
  // its own control is at the sentinel (-1 = "same as the front seat")
  const sp1 = { h: P.seatH, rake: P.seatRake, tilt: P.seatTilt || 0 };
  const fb = (v, d) => (v == null || v < 0) ? d : v;
  const sp2 = { h: fb(P.seat2H, sp1.h), rake: fb(P.seat2Rake, sp1.rake),
                tilt: fb(P.seat2Tilt, sp1.tilt) };
  const seats = places.map((pl, i) => Object.assign({}, pl,
    { SP: i && !pl.pilot ? sp2 : sp1 },
    buildSeat(group, A, P, pl.x, pl.zBack, sbs, i && !pl.pilot ? sp2 : sp1)));
  const pilot = seats.find(s => s.pilot);

  // ---- controls ----
  // A STATION PER SEAT. Side-by-side carries DUAL CONTROLS (user
  // 2026-08-19): a stick and a set of pedals in front of each seat.
  // The throttle stays single — one engine, one lever — and belongs to
  // the pilot's station.
  const stickMode = Math.round(P.ctlStick), thrMode = Math.round(P.ctlThr);
  const mkStation = seat => {
    const o = { stick: null, pedals: null };
    if (stickMode === 0) o.stick = buildStickCenter(group, A, P, seat.x, seat);
    if (stickMode === 1) o.stick = buildYoke(group, A, P, seat.x);
    if (stickMode === 2) o.stick = buildStickSide(group, A, P, seat.x, seat);
    if (P.ctlPed) o.pedals = buildPedals(group, A, P, seat.x);
    return o;
  };
  const stn = seats.map(s2 => (s2.pilot || sbs) ? mkStation(s2) : null);
  const st1 = stn[seats.indexOf(pilot)];
  let stick = st1.stick, thr = null;
  // the console BOX only exists side-by-side (user): with one seat
  // across the cabin there is nowhere for it to stand, so single and
  // tandem get the throttle quadrant alone
  const boxWanted = sbs && (P.consoleOn || thrMode === 2);
  let consoleThr = null;
  if (boxWanted || thrMode === 2) {
    // sbs: between the seats. Otherwise on the throttle-hand side —
    // yoke flies left-handed (throttle right), sticks right-handed
    // (throttle left, +x)
    const cx = sbs ? 0 : pilot.x + (stickMode === 1 ? -0.28 : 0.28);
    consoleThr = buildConsole(group, A, P, cx, thrMode === 2, boxWanted);
  }
  if (thrMode === 0) thr = buildThrottleWall(group, A, P, pilot.x);
  if (thrMode === 1) thr = buildThrottleDash(group, A, P, pilot.x);
  if (thrMode === 2) thr = consoleThr;
  st1.thr = thr;
  let pedals = st1.pedals;

  // ---- dummies ----
  const st = STATURES[clamp(Math.round(P.dumSize), 0, 2)];
  const s = st / BASE_STATURE;
  const notes = [];
  // EVERY OCCUPANT IS POSED THE SAME WAY (user 2026-08-19): the second
  // dummy is not a passenger ornament — give it a station and it flies
  // from it, by the identical rules. Without one it rests its hands.
  const seatDummy = (seat, ST) => {
    const stick = ST && ST.stick, thr = ST && ST.thr, pedals = ST && ST.pedals;
    const dum = makeDummy(group);
    dum.fig.scale.setScalar(s);
    const SP = seat.SP || sp1;
    const recline = clamp((SP.rake - 7) + (P.dumRecline || 0), -10, 55);
    applyPose(dum.bones,
              seatedPose(recline, !(stick || thr || pedals), SP.tilt));
    dum.fig.position.set(seat.x, seat.panY + 0.03 + 0.105 * s,
                         seat.zBack + 0.095 * s + 0.02);
    dum.fig.updateMatrixWorld(true);
    if (!stick && !thr && !pedals) return dum;
    // HANDS FOLLOW THE GEOMETRY (user 2026-08-19: the dummy crossed its
    // arms when the console moved from beside the seat to between the
    // seats). Each control is asked WHICH SIDE OF THIS SEAT it actually
    // sits on (+x is the occupant's left) and the near hand takes it; a
    // control on the centreline — a centre stick, a yoke — takes
    // whichever hand is left over. Nothing is hard-coded to a style.
    const sideOf = o => {
      if (!o) return null;
      const dx = anchorWorld(o).p.x - seat.x;
      return dx > 0.06 ? 'L' : dx < -0.06 ? 'R' : null;
    };
    const other = h => h === 'L' ? 'R' : 'L';
    let hStick = stick && stickMode !== 1 ? sideOf(stick.obj) : null;
    let hThr = thr ? sideOf(thr.obj) : null;
    if (hStick && hThr && hStick === hThr) hThr = other(hStick);
    else if (hStick && !hThr) hThr = other(hStick);
    else if (hThr && !hStick) hStick = other(hThr);
    else if (!hStick && !hThr) { hStick = 'R'; hThr = 'L'; }
    const jobs = [];
    if (stick) {
      const a = stickMode === 1
        ? (hStick === 'L' ? stick.objL : stick.objR) : stick.obj;
      jobs.push({ chain: hStick === 'L' ? 'armL' : 'armR', a,
                  label: hStick + '→' + stick.label });
    }
    if (thr) jobs.push({ chain: hThr === 'L' ? 'armL' : 'armR', a: thr.obj,
                         label: hThr + '→throttle' });
    if (pedals) {
      jobs.push({ chain: 'legL', a: pedals.objL, label: 'L→pedal' });
      jobs.push({ chain: 'legR', a: pedals.objR, label: 'R→pedal' });
    }
    // debug record (the CAGE_DBG idiom): what went to which hand, and
    // where each grip actually sits relative to its own seat
    const rec = { seatX: +seat.x.toFixed(3), jobs: jobs.map(j => {
      const w = anchorWorld(j.a).p;
      return { chain: j.chain, label: j.label,
               get wrist() { return j.wrist; },
               dx: +(w.x - seat.x).toFixed(3),
               grip: [+w.x.toFixed(3), +w.y.toFixed(3), +w.z.toFixed(3)] };
    }) };
    DBG.stations.push(rec);
    const pole = new THREE.Vector3();
    const base = seatedPose(recline, false, SP.tilt);
    for (const j of jobs) {
      const c = CHAINS[j.chain];
      ikDefaultPole(dum, j.chain, pole);
      const side = /L$/.test(c.end) ? 1 : -1;
      if (c.arm) {                    // elbows: down + in/out slider
        pole.y -= 0.22 * s;
        pole.x += side * (0.03 + P.dumElbows) * s;
      } else {                        // knees: up-forward + in/out slider
        pole.y += 0.10 * s; pole.z += 0.10 * s;
        pole.x += side * P.dumKnees * s;
      }
      const aw = anchorWorld(j.a);
      // a GRIP solves its own hand orientation from the arm's approach;
      // a fixed anchor (the feet) uses the orientation as authored
      let alignQ = aw.q;
      if (j.a.userData.grip) {
        dum.bones[c.root].getWorldPosition(_gv);
        alignQ = gripQuat(j.a, _gv, _gq);
        // THE HAND HOLDS IT, NOT THE WRIST (user 2026-08-19): the IK end
        // effector is the wrist JOINT, so a grip placed there put the
        // control halfway up the forearm. Back the wrist off along the
        // hand's own axis (its -y) by the palm offset, scaled with
        // stature so a small dummy does not over-reach.
        _hv.set(0, -1, 0).applyQuaternion(alignQ);
        aw.p.addScaledVector(_hv,
          -(P.dumHandGrip != null ? P.dumHandGrip : 0.075) * s);
      }
      const gap = ikSolve(dum, j.chain, aw.p, pole, alignQ);
      // where the WRIST ended up against the grip it holds: the gap
      // between them IS the palm offset, i.e. the proof the HAND and
      // not the joint is on the control
      { const w = new THREE.Vector3();
        dum.bones[CHAINS[j.chain].end].getWorldPosition(w);
        j.wrist = [+w.x.toFixed(3), +w.y.toFixed(3), +w.z.toFixed(3)]; }
      if (gap > 0.12) {
        // hopeless stretch reads as a defect — fall back to the rest
        // pose and let the readout carry the finding instead
        for (const bn of [c.root, c.mid, c.end]) if (base[bn])
          dum.bones[bn].rotation.set(base[bn][0] * D2R,
            base[bn][1] * D2R, base[bn][2] * D2R);
        dum.fig.updateMatrixWorld(true);
        notes.push(c.label + ' OUT OF REACH ' + (gap * 100).toFixed(0)
                   + 'cm (' + j.label + ')');
      } else if (gap > 0.005)
        notes.push(c.label + ' SHORT ' + (gap * 100).toFixed(1) + 'cm');
    }
    return dum;
  };
  const DBG = window.CAGE_CREW = { stations: [],
    seats: seats.map(s2 => ({ x: +s2.x.toFixed(3),
      panY: +s2.panY.toFixed(3), h: s2.SP.h, rake: s2.SP.rake,
      tilt: s2.SP.tilt })) };
  const dums = [];
  if (P.dumOn) dums.push(seatDummy(pilot, st1));
  if (P.dum2On && seats.length > 1) {
    const i2 = seats.indexOf(pilot) === 0 ? 1 : 0;
    dums.push(seatDummy(seats[i2], stn[i2]));
  }

  // ---- eye point + head clearance (the sizing instruments) ----
  if (dums.length && P.dumMarkers) {
    const head = dums[0].bones.head;
    head.updateWorldMatrix(true, false);
    const eye = new THREE.Vector3(0, 0.125, 0.082)
      .applyMatrix4(head.matrixWorld);
    ballAt(group, M.marker, [eye.x, eye.y, eye.z], 0.015);
    const fwd = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
    const lg = new THREE.BufferGeometry().setFromPoints(
      [eye, eye.clone().addScaledVector(fwd, 0.6)]);
    group.add(new THREE.Line(lg, new THREE.LineBasicMaterial(
      { color: 0xff4d3d, transparent: true, opacity: 0.55 })));
    const crown = new THREE.Vector3(0, 0.245, 0)
      .applyMatrix4(head.matrixWorld);
    const seatFloor = A.floorAt(pilot.zBack + 0.20);
    notes.unshift('eye +' + (eye.y - seatFloor).toFixed(2) + ' fl',
                  'head clr ' + (A.roofY - crown.y).toFixed(2));
  }
  // cabin height at the pilot station — the number the dummy judges
  {
    const fl = A.floorAt(pilot.zBack + 0.20);
    notes.unshift('cabin h ' + (A.roofY - fl).toFixed(2));
  }
  if (stat && notes.length)
    stat.textContent += '  ·  crew: ' + notes.join(' · ');
};
})();
