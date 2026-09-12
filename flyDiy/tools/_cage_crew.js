// CAGE CREW — the cockpit occupancy layer (G17; born on the _cage5 bench,
// now one layer of _cage8.html and the game's editor).
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

// ---- materials ------------------------------------------------------------
// Lambert is the fallback and was the whole story until G70. AEROSKIN now
// dresses the cabin from `AERO_HARD.crew`: the seat pans and their piping are
// leather, the lap belts are nylon webbing, the seat frames are 4130 tube and
// the knobs and joints are moulded plastic. It is the interior half of G70,
// and it matters more than its area suggests — the cabin is the ONE part of
// this aeroplane the camera goes inside.
//
// M IS A LIVE LOOKUP, not a table of objects, because the material view is a
// switch: `M.cushion` has to answer differently after it is thrown, and there
// are 45 call sites that must not each learn about it. The Lambert set stays
// underneath as MFALL and is what a bench with no AEROSKIN loaded still gets.
const lam = c => new THREE.MeshLambertMaterial({ color: c });
const MFALL = {
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
  // THE PANEL (G94). An instrument is three things you can name from two
  // metres: the bezel it is clamped in, the dark face, and the needle.
  bezel:   lam(0x2a2d33),
  dial:    lam(0x0e1013),
  needle:  lam(0xe8e4d8),
  board:   lam(0x9a7b4e),      // floorboards
  // THE CONTROLS' OWN FINISHES (the panel arc, session 4e, the user: "proper
  // material, proper fitments and functions, proper mechanical detail"): a
  // moulded rubber grip and a bellows boot, plated fittings, cast-alloy
  // brackets, leather round a yoke's horns, a red push-to-talk
  grip:    lam(0x1c1e21),
  boot:    lam(0x202225),
  plated:  lam(0xdfe5ec),
  cast:    lam(0x8e949a),
  hide:    lam(0x3a2a1f),
  ptt:     lam(0xc0302a),
  ball:    lam(0x1c1e22),      // a throttle's ball
  tread:   lam(0x202227),      // a pedal's rubber
  plateAl: lam(0xd0d4d8),      // a pedal's plate: the dash's own metal
  marker:  new THREE.MeshBasicMaterial({ color: 0xff4d3d }),
};
// FrontSide, matching the Lambert it replaces. A getter per name, so every
// `M.cushion` in the file below is now a question rather than a constant and
// not one of them had to change.
const M = {};
for (const nm of Object.keys(MFALL)) {
  Object.defineProperty(M, nm, { enumerable: true, get() {
    const A = (typeof window !== 'undefined' && window.AEROSKIN) || null;
    // THE SEATS ARE THE BUILDER'S (phase D): cushion and piping are one
    // livery section — leather by default, each keeping its own legacy
    // shade until a pick unifies them — asked here in the getter so not
    // one of the 45 call sites has to know.
    if ((nm === 'cushion' || nm === 'pipe') &&
        typeof window !== 'undefined' && window.CAGE_SECMAT) {
      const ms = window.CAGE_SECMAT('seatTrim',
        { surf: 0, fieldM: 1, side: THREE.FrontSide,
          tint0: MFALL[nm].color.getHex() });
      if (ms) return ms;
    }
    if (!A || !A.aeroHardMat) return MFALL[nm];
    return A.aeroHardMat(THREE, 'crew', nm, MFALL[nm].color.getHex(),
                         { side: THREE.FrontSide }) || MFALL[nm];
  } });
}

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
// G240: A CONTROL THAT ANSWERS. The stick, the yoke and the pedals were
// drawn and dead — the one part of the control run at the pilot's end, and
// the only one a player looks straight at. Each moving piece goes into its
// own named sub-group with its PIVOT as the group's origin, so the join can
// publish it as a rigid part and the game can turn it by the same linkage
// that turns the surfaces at the other end of the cable.
//
// THE HAND FOLLOWS THE STICK (live crew, 2026-09-11): a seated dummy's hand
// is posed by IK at BUILD time against the grip where it then is — and the
// grip is a CHILD of the moving group, so in flight the pilot crosses the
// join as a SKELETON (markLive / CAGE_CREW.live), app.js turns the same
// group and re-runs solveGripJob against the grip where it now is. What
// stays baked (passengers, an ATD) keeps G210.2's frozen pose.
let CTL_MOVING = [], LIVE_CREW = [];
// a throttle lever's full travel (rad, forward from the drawn idle) and a
// push-pull rod's, as a fraction of its length
// (the wall and quadrant levers are DRAWN leaning ~45 deg forward already,
// so 25 deg more is a lever near flat at full — 35 was past it, measured)
const THR_ARC = 25 * D2R, THR_PUSH = 0.45;
// a ball's revolve profile: a sphere of radius R on a stem, sampled fine
// (session 4f, the user: "it should really look like a ball")
const ballProf = (R, neck) => {
  const o = [[neck, -0.004], [neck, R * 0.15]];
  for (let i = 1; i <= 18; i++) { const a = -Math.PI / 2 + Math.PI * (0.15 + 0.85 * i / 18); o.push([R * Math.cos(a) * (i === 18 ? 0 : 1), R + R * Math.sin(a)]); }
  return o;
};
function movingAt(parent, name, pivot, axis, drive, sgn, k, x2) {
  // TWO SEATS MEAN TWO STICKS, so the name carries an index when it has to.
  // The join matches parts BY NAME, and a duplicate would put both sticks on
  // one part record and leave the second unable to move.
  let nm = name, i = 1;
  while (CTL_MOVING.some(m => m.name === nm)) nm = name + '#' + (++i);
  const g = new THREE.Group();
  g.position.set(pivot[0], pivot[1], pivot[2]);
  g.name = nm;
  parent.add(g);
  CTL_MOVING.push(Object.assign({ name: nm, pivot, axis, drive, sgn, k }, x2 || {}));
  return g;
}
// ...and a point in the parent's frame, seen from inside a moving group
const inG = (g, p) => [p[0] - g.position.x, p[1] - g.position.y,
                       p[2] - g.position.z];

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
  // THE CRANK (session 4f, the user: "a double bend, so the handle can sit
  // closer to the pilot, while the base can sit farther"): the shaft rises
  // from the base, bends AFT by `stickCrank` between a third and a half of
  // its height, and rises again to the grip — the grip lands `stickCrank`
  // nearer the seat than the base's line
  const crank = P.stickCrank != null ? +P.stickCrank : 0;
  const top = [sx, y0 + L * Math.cos(rk), zPiv - L * Math.sin(rk) - crank];
  // THE FLOOR FITTING (session 4e): a cast bracket bolted to the floor — a
  // base plate and two lugs standing either side of the stick — and the
  // lateral pivot pin through them with its head and nut showing. It stays;
  // what moves is the fork on the pin and everything above it.
  {
    const K = window.GEAR_KIT;
    if (K) {
      const base = K.Bag(), pin = K.Bag();
      K.sweep(base, [[sx, y0 - 0.032, zPiv], [sx, y0 - 0.024, zPiv]],
        () => [[-0.062, -0.052], [0.062, -0.052], [0.068, -0.046], [0.068, 0.046], [0.062, 0.052], [-0.062, 0.052], [-0.068, 0.046], [-0.068, -0.046]], true, [0, 0, 1]);
      for (const sd of [-1, 1])
        K.lug(base, [sx + sd * 0.030, y0, zPiv], [1, 0, 0], [0, 1, 0], 0.016, 0.008, 0.032);
      for (const [dx, dz] of [[-0.05, -0.036], [0.05, -0.036], [-0.05, 0.036], [0.05, 0.036]])
        K.bolt(pin, [sx + dx, y0 - 0.024, zPiv + dz], [0, 1, 0], 0.0036, 0.004);
      K.bolt(pin, [sx + 0.036, y0, zPiv], [1, 0, 0], 0.005, 0.006);          // the pin's head
      K.revolve(pin, [sx - 0.036, y0, zPiv], [-1, 0, 0], [[0.0055, 0], [0.0055, 0.005], [0, 0.005]], 6, false);   // its nut
      base.mesh(g, M.cast); pin.mesh(g, M.plated);
    } else ballAt(g, M.dark, [sx, y0, zPiv], 0.030);
  }
  // G240: EVERYTHING ABOVE THE BALL MOVES, and it moves in TWO AXES at once:
  // pitch about the lateral one (stick aft = nose up) and roll about the
  // fore-aft one. ONE part, two drives — not two nested groups, because the
  // join bakes each part into its own flat rebased mesh and a nested pair
  // would leave the outer one with no geometry and no motion. The
  // ruddervator's `drive2` is the same idea, one file over.
  const gP = movingAt(g, 'edCtl_stick', [sx, y0, zPiv],
                      [1, 0, 0], 'de', -0.34, 1,
                      { axis2: [0, 0, 1], drive2: 'da', sgn2: -0.32, k2: 1 });
  const T = inG(gP, top);
  const up = [0, Math.cos(rk), -Math.sin(rk)];          // along the shaft, up
  const K2 = window.GEAR_KIT;
  if (K2) {
    // the fork on the pin (cast), the shaft (steel tube, 22 mm), the rubber
    // bellows over the root, and a moulded grip: finger grooves, a domed
    // head, a red push-to-talk under the thumb
    const fork = K2.Bag(), shaft = K2.Bag(), boot = K2.Bag(), gripB = K2.Bag(), ptt = K2.Bag();
    K2.revolve(fork, [0, 0, 0], [1, 0, 0], [[0.012, -0.024], [0.016, -0.020], [0.016, 0.020], [0.012, 0.024], [0, 0.024]], 14, true);
    K2.revolve(fork, [0, 0.008, 0], up, [[0.020, 0], [0.020, 0.030], [0.014, 0.036], [0, 0.036]], 16, false);
    if (crank > 0.001) {
      // the cranked shaft: a swept tube through two rounded bends
      const pth = [], hA = L * 0.34, hB = L * 0.50;
      const at = (h, z) => [up[0] * h, up[1] * h, up[2] * h + z];
      const pts = [at(0.030, 0), at(hA, 0), at(hB, -crank), at(L - 0.08, -crank)];
      for (const q of K2.bez(pts[0], pts[1], [(pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2, (pts[1][2] + pts[2][2]) / 2], 8)) pth.push(q);
      for (const q of K2.bez([(pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2, (pts[1][2] + pts[2][2]) / 2], pts[2], pts[3], 8).slice(1)) pth.push(q);
      K2.sweep(shaft, pth, () => K2.secRound(0.011, 20), false);
    } else
      K2.revolve(shaft, [0, 0.030, 0], up, [[0.011, 0], [0.011, L - 0.030 - 0.08]], 20, false);
    {
      const prof = [[0.026, 0.036]];
      for (let i = 0; i < 7; i++) { prof.push([0.019, 0.042 + i * 0.010]); prof.push([0.025, 0.047 + i * 0.010]); }
      prof.push([0.017, 0.112], [0.012, 0.114]);
      K2.revolve(boot, [0, 0, 0], up, prof, 24, false);
    }
    const g0 = L - 0.10;                                  // the grip's foot along the shaft
    K2.revolve(gripB, [0, 0, -crank], up,
      [[0.011, g0], [0.016, g0 + 0.004], [0.020, g0 + 0.010], [0.019, g0 + 0.020], [0.0215, g0 + 0.028], [0.019, g0 + 0.036], [0.0215, g0 + 0.044],
       [0.019, g0 + 0.052], [0.0215, g0 + 0.060], [0.019, g0 + 0.068], [0.021, g0 + 0.080], [0.023, g0 + 0.092], [0.020, g0 + 0.104], [0.012, g0 + 0.110], [0, g0 + 0.112]], 28, false);
    // the button: a small red dome on the grip's head, forward
    const bp = [0, 0, -crank]; const hp = _off3(bp, up, g0 + 0.100);
    K2.revolve(ptt, [hp[0], hp[1], hp[2] - 0.020], [0, 0, -1], [[0.0045, 0], [0.0045, 0.003], [0.0030, 0.0045], [0, 0.005]], 14, false);
    fork.mesh(gP, M.cast); shaft.mesh(gP, M.frame); boot.mesh(gP, M.boot); gripB.mesh(gP, M.grip); ptt.mesh(gP, M.ptt);
  } else {
    tube(gP, M.metal, [T[0], T[1] - L * Math.cos(rk), T[2] + L * Math.sin(rk)], T, 0.014);
    tube(gP, M.knob, [T[0], T[1] - 0.005, T[2]], [T[0], T[1] + 0.075, T[2] + 0.012], 0.020);
    ballAt(gP, M.knob, [T[0], T[1] + 0.085, T[2] + 0.014], 0.023);
  }
  // THE HAND IS ON THE GRIP (G279, the user: "it does not hold the stick
  // right anymore"): session 4e's moulded grip runs from L - 0.10 to
  // L + 0.012 along the shaft, and the anchor had stayed where the old
  // knob was — 35 mm ABOVE the shaft's top, so the palm closed on air over
  // the head. The fist closes round the grip's MIDDLE (fitFists puts the
  // hollow of the fingers on this point), the head and its button above
  // it under the thumb; the axis IS the shaft.
  const gc = K2 ? [T[0] - up[0] * 0.046, T[1] - up[1] * 0.046, T[2] - up[2] * 0.046]
                : [T[0], T[1] + 0.035, T[2] + 0.006];
  return { obj: gripAt(gP, gc, up), label: 'stick' };
}
function buildYoke(g0, A, P, sx) {
  const g = ctlShift(g0, P, 'stickX', 'stickY', 'stickZ');
  const yY = A.waistY - 0.04;
  const zHub = A.zBack + 0.54;
  // the column: a steel tube through a plated collar on the panel's face,
  // three screws round the collar (session 4e)
  {
    const K = window.GEAR_KIT;
    tube(g, K ? M.frame : M.ctrl, [sx, yY, A.zDash + 0.05], [sx, yY, zHub], 0.0125);
    if (K) {
      const col = K.Bag();
      K.revolve(col, [sx, yY, A.zDash], [0, 0, -1], [[0.034, 0], [0.034, 0.004], [0.022, 0.006], [0.022, 0.026], [0.018, 0.028], [0.0135, 0.028]], 32, false);
      for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3 + 0.5; K.bolt(col, [sx + Math.cos(a) * 0.028, yY + Math.sin(a) * 0.028, A.zDash - 0.004], [0, 0, -1], 0.0025, 0.002); }
      col.mesh(g, M.plated);
    }
  }
  // G240: A YOKE DOES NOT SWING, IT SLIDES AND SPINS. Pitch is the column
  // running in and out of the panel — a translation, which a rigid part can
  // carry as easily as a rotation once the contract allows one — and roll is
  // the wheel turning about that same column. One part, one axis, one slide.
  const gY = movingAt(g, 'edCtl_yoke', [sx, yY, zHub],
                      [0, 0, 1], 'da', -0.85, 1,
                      { slide: [0, 0, 0.055], slideDrive: 'de', slideSgn: -1 });
  const H = [0, 0, 0];
  const K = window.GEAR_KIT;
  if (K) {
    // the hub: a cast disc with chamfered rims and a plated cap; the horns:
    // one swept tube a side, out of the hub then curving up, painted to the
    // bend and leather-wrapped from there to the rounded end; a push-to-talk
    // on the left horn's thumb side
    const hub = K.Bag(), cap = K.Bag();
    K.revolve(hub, [0, 0, -0.005], [0, 0, 1], [[0, 0], [0.036, 0], [0.044, 0.008], [0.044, 0.044], [0.036, 0.052], [0, 0.052]], 36, false);
    K.revolve(cap, [0, 0, -0.008], [0, 0, 1], [[0, 0], [0.016, 0], [0.018, 0.002], [0.018, 0.004], [0, 0.004]], 24, false);
    hub.mesh(gY, M.cast); cap.mesh(gY, M.plated);
    for (const sd of [-1, 1]) {
      const path = [];
      for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        path.push([sd * (0.030 + 0.125 * Math.sin(t * Math.PI / 2)), 0.004 + 0.100 * t * t, 0.022 + 0.014 * t]);
      }
      const horn = K.Bag(), wrap = K.Bag();
      K.sweep(horn, path.slice(0, 11), () => K.secRound(0.0125, 14), true);
      K.sweep(wrap, path.slice(9), t => K.secRound(t > 0.94 ? 0.0165 * (1 - (t - 0.94) / 0.06) + 0.002 : 0.0165, 14), true);
      horn.mesh(gY, M.trim); wrap.mesh(gY, M.hide);
    }
    const ptt = K.Bag();
    K.revolve(ptt, [0.118, 0.052, 0.022], [0, 0, -1], [[0.0045, 0.008], [0.0045, 0.011], [0.003, 0.0125], [0, 0.013]], 14, false);
    ptt.mesh(gY, M.ptt);
  } else boxAt(gY, M.ctrl, [H[0], H[1], H[2] + 0.02], [0.075, 0.05, 0.05]);
  const grips = {};
  for (const sd of [-1, 1]) {
    if (!K) {
      tube(gY, M.ctrl, [0, 0, 0.02], [sd * 0.105, 0.015, 0.025], 0.013);
      tube(gY, M.knob, [sd * 0.105, 0.015, 0.025], [sd * 0.150, 0.095, 0.035], 0.016);
    }
    // the horn IS the grip axis (out and up from the hub)
    grips[sd] = gripAt(gY, [sd * 0.132, 0.062, 0.030],
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
  // G240: a side stick moves the same two ways a centre stick does, over a
  // third of the travel — it is a short lever and the wrist does the work
  const gS = movingAt(g, 'edCtl_sideStick', [xs, y0, z0],
                      [1, 0, 0], 'de', -0.26, 1,
                      { axis2: [0, 0, 1], drive2: 'da', sgn2: -0.24, k2: 1 });
  tube(gS, M.metal, [0, 0, 0], [0, sl, -sl * 0.15], 0.012);
  tube(gS, M.knob, [0, sl - 0.005, -sl * 0.15],
       [0, sl + 0.055, -sl * 0.15 - 0.010], 0.018);
  return { obj: gripAt(gS, [0, sl + 0.025, -sl * 0.15 - 0.004],
                       [0, 0.99, -0.15]),
           label: 'side stick' };
}
function buildPedals(g, A, P, sx) {
  const zP = A.zBack + P.pedalZ;
  const yF = A.floorAt(zP), yP = yF + P.pedalH;
  // SPREAD (user): how far apart the two pedals stand — a narrow
  // footwell wants them close together
  const sp = P.pedalSpread != null ? P.pedalSpread : 0.10;
  const out = {};
  // THE PLATES FLOAT (user 2026-08-19): no linkage, no floor posts.
  // Each is a footplate RAMP tilted toes-up by PED_RAMP — a foot with
  // the leg extended forward rests at about this angle, and the poser's
  // own ankle limit is 30 degrees of dorsiflexion, so a steeper plate
  // could not be stood on.
  const PED_RAMP = (P.pedalAngle != null ? P.pedalAngle : 25) * D2R;
  const c = Math.cos(PED_RAMP), s = Math.sin(PED_RAMP);
  // (session 4f, the user: "don't do the little support structure, it
  // sticks out. Just have them like now, definitely closer to each other")
  // — the plates float, 0.10 apart by default, in the dash's own metal with
  // a ribbed rubber tread
  const KP = window.GEAR_KIT;
  for (const sd of [-1, 1]) {
    const xp = sx + sd * sp;
    // G240: A PEDAL SWINGS ON THE FLOOR. Both plates hang off one bar, so
    // pushing one sends the other back — which is why the two take the same
    // drive with opposite signs. `dr > 0` is nose LEFT (30_solver's own
    // convention), and the pilot's left foot is at +x (the cage's +x is the
    // pilot's left, _cage_crew: "pilot's right = -x").
    const pv = [xp, yP - 0.085, zP];
    const gp = movingAt(g, 'edCtl_pedal' + (sd > 0 ? 'L' : 'R'), pv,
                        [1, 0, 0], 'dr', sd > 0 ? -0.30 : 0.30, 1);
    // the arm from the tube up to the plate, the plate (alloy) with a rubber
    // tread on it, ribbed
    if (KP) {
      boxAt(gp, M.plateAl, [0, yP - pv[1], 0], [0.095, 0.010, 0.19], -PED_RAMP);
      boxAt(gp, M.tread, [0, yP - pv[1] + 0.006 * c, -0.006 * s], [0.085, 0.004, 0.17], -PED_RAMP);
      for (let i = -3; i <= 3; i++) {
        const dz = i * 0.024;
        boxAt(gp, M.tread, [0, yP - pv[1] + 0.009 * c + dz * s, -0.009 * s + dz * c], [0.080, 0.003, 0.006], -PED_RAMP);
      }
    } else boxAt(gp, M.metal, [0, yP - pv[1], 0], [0.095, 0.014, 0.19], -PED_RAMP);
    // THE SOLE SITS ON THE PLATE: the ankle is placed so that the
    // mid-sole (0.06 forward of the ankle, 0.0725 below it in bone
    // space) lands on the plate's centre once the foot is ramped.
    // (+ half the plate and a hair of clearance along its normal, or the
    // shoe sinks into the plate)
    const sy = -0.0725, sz = 0.06, cl = 0.010;
    out[sd] = anchorAt(gp, [0,
      yP - pv[1] - (sy * c - sz * (-s)) + cl * c,
      -(sy * (-s) + sz * c) - cl * s], -PED_RAMP);
  }
  return { objL: out[1], objR: out[-1], label: 'pedals' };
}
function buildThrottleWall(g0, A, P, sx) {
  const g = ctlShift(g0, P, 'thrX', 'thrY', 'thrZ');
  const zT = A.zBack + 0.40;
  const yT = A.floorAt(zT) + 0.42;
  // on the wall itself (G318: 0.9 x halfW was 4 cm inboard of the door's skin)
  const wx = A.wallAt ? A.wallAt(sx >= 0 ? 1 : -1, yT, zT) : (sx >= 0 ? 1 : -1) * Math.max(0.2, A.halfW * 0.90);
  const inb = wx > 0 ? -1 : 1;               // inboard direction
  const piv = [wx + inb * 0.03, yT - 0.01, zT - 0.04];
  // THE QUADRANT (session 4e): a cast plate on the wall with the lever's
  // arc cut through it, a friction knob on the pivot's outer side
  const KW = window.GEAR_KIT;
  if (KW) {
    const q = KW.Bag(), slot = KW.Bag(), fr = KW.Bag();
    KW.sweep(q, [[wx, yT, zT], [wx + inb * 0.008, yT, zT]], () => [[-0.10, -0.065], [0.10, -0.065], [0.10, 0.045], [0.06, 0.065], [-0.06, 0.065], [-0.10, 0.045]], true, [0, 1, 0]);
    for (let i = 0; i < 9; i++) {
      const a = (i / 8) * THR_ARC * 1.15 - 0.05;
      const d = [0, Math.cos(a) * 0.11 - Math.sin(a) * 0.105, Math.sin(a) * 0.11 + Math.cos(a) * 0.105];
      const pp = _off3([wx + inb * 0.004, piv[1], piv[2]], _nrm3(d), 0.13);
      boxAt(g, M.dark, pp, [0.010, 0.012, 0.012]);
    }
    // THE FITTING (4f, the user: "the fitting between the main body and the
    // round part next to the wall is poor"): a plated stub axle stands off
    // the quadrant plate to the lever's boss, with a knurled friction wheel
    // and a washer on it — nothing floats
    const ax = KW.Bag();
    KW.revolve(ax, [wx + inb * 0.006, piv[1], piv[2]], [inb, 0, 0], [[0.0065, 0], [0.0065, 0.032]], 20, true);
    KW.revolve(ax, [wx + inb * 0.008, piv[1], piv[2]], [inb, 0, 0], [[0.011, 0], [0.011, 0.003], [0, 0.003]], 20, false);   // the washer
    KW.revolve(fr, [wx + inb * 0.011, piv[1], piv[2]], [inb, 0, 0], [[0.006, 0], [0.013, 0.001], [0.0135, 0.004], [0.013, 0.007], [0.006, 0.008]], 32, true);
    q.mesh(g, M.cast); fr.mesh(g, M.ball); ax.mesh(g, M.plated);
  } else boxAt(g, M.ctrl, [wx, yT, zT], [0.028, 0.13, 0.20]);
  // the lever runs up and forward from its pivot, at the length the
  // slider asks for (user 2026-08-19)
  const LT = P.thrLen != null ? P.thrLen : 0.16;
  const ld = _nrm3([inb * 0.025, 0.11, 0.105]);
  const kn = _off3(piv, ld, LT);
  // THE THROTTLE ANSWERS TOO (live crew): the lever swings forward about
  // its lateral pivot, drawn at idle, THR_ARC at full — and the grip rides
  // inside the moving group, so the live pilot's hand goes with it
  const gT = movingAt(g, 'edCtl_throttle', piv, [1, 0, 0], 'thr', 1, THR_ARC);
  const K = inG(gT, kn);
  if (KW) {
    // a flat steel lever from a plated pivot boss, a moulded knob on its end
    const lev = KW.Bag(), boss = KW.Bag(), kb = KW.Bag();
    KW.sweep(lev, [[0, 0, 0], K], () => [[-0.010, -0.004], [0.010, -0.004], [0.010, 0.004], [-0.010, 0.004]], true, [inb, 0, 0]);
    KW.revolve(boss, [0, 0, 0], [inb, 0, 0], [[0.012, -0.006], [0.012, 0.007], [0, 0.007]], 16, true);
    KW.revolve(kb, K, _nrm3([kn[0] - piv[0], kn[1] - piv[1], kn[2] - piv[2]]), ballProf(0.026, 0.012), 36, true);
    lev.mesh(gT, M.frame); boss.mesh(gT, M.plated); kb.mesh(gT, M.ball);
  } else { tube(gT, M.metal, [0, 0, 0], K, 0.009); ballAt(gT, M.knob, K, 0.026); }
  // THE HAND RESTS ON THE BALL (G279, the user: "the crooked position of
  // its wrist on the throttle"): the grip axis was the LEVER's, which laid
  // the hand's width along the lever and left its length to point down
  // the lever's far side — a chop from above, the palm facing the wall. A
  // ball knob on a quadrant lever is held from above and behind: the
  // fingers curl over it fore-and-aft, the thumb inboard, so the axis the
  // hand wraps is the PIVOT's (lateral), and the wrist then continues the
  // forearm with no twist. The anchor rides a little above the ball's
  // centre, where the palm actually lands.
  return { obj: gripAt(gT, [K[0], K[1] + 0.012, K[2] - 0.006], [inb, 0, 0]),
           label: 'throttle (wall)' };
}
function buildThrottleDash(g0, A, P, sx) {
  const g = ctlShift(g0, P, 'thrX', 'thrY', 'thrZ');
  // ON THE PLATE (4f, the user: "not well localized, it falls into the lip
  // of the dashboard"): when the dash's face plate was measured (A.face),
  // the throttle stands on it, low in the panel where a push-pull lives,
  // at the plate's own depth there; else the old station
  const F = A.face || null;
  const xT = sx + 0.16;
  const yT = F ? F.yBot + 0.060 : A.floorAt(A.zDash) + 0.42;
  const z0 = F && F.depthAt ? F.depthAt(xT, yT) - 0.001 : A.zDash + 0.005;
  const KD = window.GEAR_KIT;
  if (KD) {
    // a plated collar with a hex lock nut on the panel's face (session 4e)
    const col = KD.Bag();
    KD.revolve(col, [xT, yT, z0], [0, 0, -1], [[0.020, 0], [0.020, 0.003], [0.011, 0.005], [0.011, 0.016], [0.0085, 0.017], [0, 0.017]], 24, false);
    KD.sweep(col, [[xT, yT, z0 - 0.005], [xT, yT, z0 - 0.011]], () => { const o = []; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; o.push([0.0135 * Math.cos(a), 0.0135 * Math.sin(a)]); } return o; }, true, [0, 1, 0]);
    col.mesh(g, M.plated);
    // its shadow on the plate (session 4h): the panel layer's soft disc
    if (window.CAGE_PANEL && window.CAGE_PANEL.material) {
      const ao = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.058), window.CAGE_PANEL.material('ao'));
      ao.position.set(xT, yT, z0 - 0.0003); ao.rotation.y = Math.PI; ao.renderOrder = 2;
      g.add(ao);
    }
  } else {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.020, 0.020, 0.012, 12), M.metal);
    m.position.set(xT, yT, z0 - 0.006); m.rotation.x = Math.PI / 2;
    g.add(m);
  }
  const LT = P.thrLen != null ? P.thrLen : 0.16;
  // a push-pull rod SLIDES (live crew): drawn pulled out at idle, it runs
  // into the panel by THR_PUSH x its length at full — a slide-only part,
  // the yoke's contract with a zero swing
  const kp = [xT, yT, z0 - LT * 0.72];
  const gT = movingAt(g, 'edCtl_throttle', kp, [0, 0, 1], 'thr', 0, 0,
                      { slide: [0, 0, LT * THR_PUSH], slideDrive: 'thr',
                        slideSgn: 1 });
  tube(gT, KD ? M.plated : M.metal, inG(gT, [xT, yT, z0]), inG(gT, [xT, yT, z0 - LT * 0.60]),
       0.006);
  if (KD) {
    // the vernier's knob: a plated ring behind a moulded head, the head
    // domed toward the hand
    const kb = KD.Bag(), ring = KD.Bag();
    KD.revolve(ring, [0, 0, 0.016], [0, 0, -1], [[0.008, 0], [0.014, 0.001], [0.014, 0.007], [0.010, 0.008]], 20, false);
    KD.revolve(kb, [0, 0, 0.008], [0, 0, -1], [[0.010, 0], [0.024, 0.004], [0.026, 0.014], [0.024, 0.026], [0.016, 0.032], [0, 0.034]], 24, false);
    kb.mesh(gT, M.knob); ring.mesh(gT, M.plated);
  } else {
    const k = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.030, 14), M.knob);
    k.rotation.x = Math.PI / 2;
    gT.add(k);
  }
  // THE KNOB IS IN THE FIST (G279): the axis was the ROD's, which put the
  // hand's width along it and the fingers hanging down beside the knob,
  // palm to the side. A push-pull knob is taken from behind with the
  // fingers curled over its top and the thumb round its side — the axis
  // the hand wraps is lateral, the wrist continues the forearm, and the
  // knob's own centre (the head runs z +0.008 .. -0.026) sits in the palm.
  return { obj: gripAt(gT, [0, 0.004, -0.008], [1, 0, 0]),
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
    const KC = window.GEAR_KIT;
    if (KC) {
      // THE PEDESTAL (4f, the user: "the central console remains very, very
      // basic"): a moulded shell swept along the tunnel with chamfered
      // shoulders, a brushed top plate in the dash's own metal let into it,
      // a leather-topped armrest pad at the aft end, a plated trim strip
      // along each shoulder
      const shell = KC.Bag(), top = KC.Bag(), pad = KC.Bag(), trim = KC.Bag();
      KC.sweep(shell, [[cx, yF, z0], [cx, yF, z1]],
        () => [[-0.105, 0], [0.105, 0], [0.105, h - 0.030], [0.085, h], [-0.085, h], [-0.105, h - 0.030]], true, [0, 1, 0]);
      KC.sweep(top, [[cx, yF + h + 0.002, z0 + 0.20], [cx, yF + h + 0.002, z1 - 0.03]],
        () => [[-0.078, -0.002], [0.078, -0.002], [0.078, 0.002], [-0.078, 0.002]], true, [0, 1, 0]);
      KC.sweep(pad, [[cx, yF + h + 0.002, z0 + 0.02], [cx, yF + h + 0.002, z0 + 0.19]],
        () => [[-0.075, 0], [0.075, 0], [0.075, 0.030], [0.060, 0.038], [-0.060, 0.038], [-0.075, 0.030]], true, [0, 1, 0]);
      for (const sd of [-1, 1])
        KC.sweep(trim, [[cx + sd * 0.095, yF + h - 0.015, z0], [cx + sd * 0.095, yF + h - 0.015, z1]], () => KC.secRound(0.004, 8), true);
      shell.mesh(g0, M.console); top.mesh(g0, M.plateAl); pad.mesh(g0, M.hide); trim.mesh(g0, M.plated);
    } else {
      boxAt(g0, M.console, [cx, yF + h / 2, (z0 + z1) / 2], [0.19, h, z1 - z0]);
      boxAt(g0, M.dark, [cx, yF + h + 0.012, (z0 + z1) / 2], [0.16, 0.024, (z1 - z0) * 0.9]);
    }
  }
  if (!withQuadrant) return null;
  const g = ctlShift(g0, P, 'thrX', 'thrY', 'thrZ');
  const zQ = z0 + 0.30;
  // NO PEDESTAL (user 2026-08-19): without the console the quadrant and
  // its small box simply float — the mounting is not the point here
  const yQ = box ? yF + h + 0.02 : A.floorAt(zQ) + 0.30;
  const LT = P.thrLen != null ? P.thrLen : 0.16;
  const piv = [cx, yQ + 0.02, zQ - 0.02];
  const kn = _off3(piv, _nrm3([0, 0.17, 0.07]), LT);
  const KQ = window.GEAR_KIT;
  if (KQ) {
    // the quadrant box: two cast cheeks with the lever's arc between them
    const q = KQ.Bag();
    for (const sd of [-1, 1])
      KQ.sweep(q, [[cx + sd * 0.030, yQ, zQ], [cx + sd * 0.036, yQ, zQ]],
        () => [[-0.075, -0.010], [0.075, -0.010], [0.075, 0.050], [0.045, 0.068], [-0.045, 0.068], [-0.075, 0.050]], true, [0, 1, 0]);
    KQ.sweep(q, [[cx - 0.030, yQ, zQ], [cx + 0.030, yQ, zQ]], () => [[-0.075, -0.010], [0.075, -0.010], [0.075, 0.010], [-0.075, 0.010]], true, [0, 1, 0]);
    q.mesh(g, M.cast);
  } else boxAt(g, M.ctrl, [cx, yQ + 0.03, zQ], [0.075, 0.06, 0.15]);
  // the quadrant lever swings like the wall one (live crew)
  const gT = movingAt(g, 'edCtl_throttle', piv, [1, 0, 0], 'thr', 1, THR_ARC);
  const K = inG(gT, kn);
  if (KQ) {
    const lev = KQ.Bag(), boss = KQ.Bag(), kb = KQ.Bag();
    KQ.sweep(lev, [[0, 0, 0], K], () => [[-0.012, -0.004], [0.012, -0.004], [0.012, 0.004], [-0.012, 0.004]], true, [1, 0, 0]);
    KQ.revolve(boss, [0, 0, 0], [1, 0, 0], [[0.011, -0.038], [0.011, 0.038], [0, 0.038]], 16, true);
    KQ.revolve(kb, K, _nrm3([kn[0] - piv[0], kn[1] - piv[1], kn[2] - piv[2]]), ballProf(0.024, 0.011), 36, true);
    lev.mesh(gT, M.frame); boss.mesh(gT, M.plated); kb.mesh(gT, M.ball);
  } else { tube(gT, M.metal, [0, 0, 0], K, 0.008); ballAt(gT, M.knob, K, 0.024); }
  // held from above like the wall lever's ball (G279): the pivot's axis
  return { obj: gripAt(gT, [K[0], K[1] + 0.012, K[2] - 0.006], [1, 0, 0]),
           label: 'throttle (quadrant)' };
}

// ---------------------------------------------------------------------------
// FOUR MORE CONTROLS (G318, the user: "go ahead with the flap lever, brake
// and fuel selector and trim wheel. The trim wheel can be placed on the left
// side. Take references of a simple one, like on the piper cub"). Each is a
// moving part on the crew's `movingAt` contract, so the join carries it and
// the flight poses it off the linkage: the flap lever on `flap` (the input's
// notches), the brake on `brake` (a pull, so a slide), the fuel selector on
// `fuel` (the cockpit's own state, 0 OFF / 1 R / 2 L / 3 BOTH, the tape's
// order), the trim wheel on `trim` (the input's bias, -0.5 .. 0.5). The
// tapes the user drew for the flaps and the selector are stuck beside them
// through the panel layer's `tape` (CAGE_PANEL.tape), on the surface each
// stands on.
// ---------------------------------------------------------------------------
const tapeOn = (parent, name, w, p, ry) => {
  const PN = window.CAGE_PANEL;
  if (!PN || !PN.tape) return null;
  const m = PN.tape(name, w);
  if (!m) return null;
  m.position.set(p[0], p[1], p[2]);
  m.rotation.y = ry || 0;
  parent.add(m);
  return m;
};
// THE FLAP LEVER: a cast quadrant on the floor with a toothed arc, and a
// tube lever with a moulded grip and a release button on its head. Between
// the seats side by side, on the pilot's right otherwise; forward-and-up
// at flaps up, pulled aft as they come down.
function buildFlapLever(g0, A, P, sx, seat, sbs) {
  const K = window.GEAR_KIT;
  if (!K) return null;
  const x = sbs ? 0 : sx - Math.sign(sx || 1) * 0.30;
  const z = (seat ? seat.szc : A.zBack + 0.20) + 0.30;
  const y0 = A.floorAt(z) + 0.004;
  const piv = [x, y0 + 0.040, z];
  const cheek = K.Bag(), teeth = K.Bag();
  // the base plate and two cheeks, the arc cut as a row of teeth on the
  // pilot's side
  K.sweep(cheek, [[x, y0, z], [x, y0 + 0.006, z]],
    () => [[-0.045, -0.055], [0.045, -0.055], [0.045, 0.045], [-0.045, 0.045]], true, [0, 0, 1]);
  for (const sd of [-1, 1])
    K.sweep(cheek, [[x + sd * 0.014, y0, z], [x + sd * 0.019, y0, z]],
      () => [[0, -0.045], [0.062, -0.045], [0.078, 0.010], [0.062, 0.045], [0, 0.045]], true, [0, 1, 0]);   // (u up, v fore-aft)
  for (let i = 0; i < 4; i++) {
    const a = (-38 + i * 25) * D2R;
    const p = [x + Math.sign(sx || 1) * 0.021, piv[1] + 0.062 * Math.cos(a), piv[2] + 0.062 * Math.sin(a)];
    K.boxIn(teeth, p, [0.003, 0.004, 0.004], [1, 0, 0], [0, Math.cos(a), Math.sin(a)], [0, -Math.sin(a), Math.cos(a)]);
  }
  cheek.mesh(g0, M.cast); teeth.mesh(g0, M.plated);
  // the lever swings about the lateral pin: flaps up = up-and-forward
  const gL = movingAt(g0, 'edCtl_flap', piv, [1, 0, 0], 'flap', -1, 1.05);
  const lev = K.Bag(), grip = K.Bag(), btn = K.Bag(), pin = K.Bag();
  const up = _nrm3([0, Math.cos(38 * D2R), Math.sin(38 * D2R)]);
  K.revolve(pin, [-0.020, 0, 0], [1, 0, 0], [[0.006, 0], [0.006, 0.040], [0, 0.040]], 12, true);
  K.revolve(lev, [0, 0, 0], up, [[0.0055, 0], [0.0055, 0.26]], 14, true);
  K.revolve(grip, _off3([0, 0, 0], up, 0.25), up,
    [[0.0055, 0], [0.012, 0.006], [0.013, 0.030], [0.012, 0.060], [0.009, 0.072], [0, 0.076]], 20, false);
  K.revolve(btn, _off3([0, 0, 0], up, 0.322), up, [[0.005, 0], [0.005, 0.005], [0, 0.007]], 12, false);
  pin.mesh(gL, M.plated); lev.mesh(gL, M.frame); grip.mesh(gL, M.grip); btn.mesh(gL, M.ptt);
  // the tape on the cheek that faces the pilot
  const sd = Math.sign(sx || 1);
  tapeOn(g0, 'Flaps', 0.040, [x + sd * 0.0205, y0 + 0.030, z - 0.010], sd > 0 ? -Math.PI / 2 : Math.PI / 2);
  return { obj: gL, label: 'flap lever' };
}
// THE BRAKE: a pull knob under the dash on the pilot's left — a bracket
// hanging off the box, a bushing, the rod and a T handle; it slides aft.
function buildBrakeKnob(g0, A, P, sx) {
  const K = window.GEAR_KIT;
  if (!K || A.dashLip == null || A.dashAftZ == null) return null;
  const sd = Math.sign(sx || 1);
  const x = sx + sd * 0.19, zB = A.dashAftZ + 0.030;
  // the dash's bottom, over a wider net than the lamps' (its vertices are
  // sparse across x: a 4 cm net at the pilot's x found only the roll's
  // underside, and hung the knob at the ASI's height)
  const yU = A.dashBotAt ? A.dashBotAt(x, 0.06, zB - 0.03, zB + 0.03) : A.dashLip;
  const y = yU - 0.030;
  const brk = K.Bag();
  K.sweep(brk, [[x, yU + 0.001, zB], [x, yU - 0.004, zB]],
    () => [[-0.024, -0.020], [0.024, -0.020], [0.024, 0.020], [-0.024, 0.020]], true, [0, 0, 1]);   // the foot, into the box
  K.sweep(brk, [[x, yU, zB - 0.017], [x, yU, zB - 0.023]],
    () => [[0, -0.024], [0, 0.024], [-0.052, 0.024], [-0.052, -0.024]], true, [0, 1, 0]);          // the hanging plate (u up, v lateral)
  K.revolve(brk, [x, y, zB - 0.023], [0, 0, -1], [[0.009, 0], [0.009, 0.006], [0.006, 0.008], [0, 0.008]], 16, false);   // the bushing
  brk.mesh(g0, M.cast);
  const gB = movingAt(g0, 'edCtl_brake', [x, y, zB - 0.023], [0, 0, 1], 'brake', 0, 0,
                      { slide: [0, 0, -0.035], slideDrive: 'brake', slideSgn: 1 });
  const rod = K.Bag(), tee = K.Bag();
  K.revolve(rod, [0, 0, 0.010], [0, 0, -1], [[0.004, 0], [0.004, 0.050]], 12, true);
  K.revolve(tee, [-0.020, 0, -0.040], [1, 0, 0], [[0.006, 0], [0.007, 0.003], [0.007, 0.037], [0.006, 0.040], [0, 0.040]], 14, true);
  rod.mesh(gB, M.plated); tee.mesh(gB, M.knob);
  return { obj: gB, label: 'brake' };
}
// THE FUEL SELECTOR: a round plate on the left wall ahead of the seat, four
// positions round it, a flat pointer handle on a hub — OFF aft, then R, L,
// BOTH forward, the order the user's tape reads.
function buildFuelSelector(g0, A, P, sx, seat) {
  const K = window.GEAR_KIT;
  if (!K) return null;
  const sd = Math.sign(sx || 1), inb = -sd;
  let z = (seat ? seat.zBack : A.zBack) + 0.62, y = A.floorAt(z) + 0.26;
  // ...aft of the door's jamb (the plate and its tape want 8 cm), and
  // clear of the frame's tubes: step aft until both hold
  const jamb = A.doorFwdAt ? A.doorFwdAt(sd, y) : Infinity;
  if (isFinite(jamb) && z > jamb - 0.09) { z = jamb - 0.09; y = A.floorAt(z) + 0.26; }
  const wxAt = () => (A.wallAt ? A.wallAt(sd, y, z) : sd * Math.max(0.2, A.halfW * 0.90));
  let wx = wxAt();
  if (A.tubeDist) for (let i = 0; i < 6; i++) {
    if (Math.min(A.tubeDist([wx, y, z]), A.tubeDist([wx, y + 0.06, z])) > 0.05) break;
    z -= 0.06; y = A.floorAt(z) + 0.26; wx = wxAt();
  }
  const c = [wx + inb * 0.010, y, z];
  const pl = K.Bag(), dots = K.Bag();
  K.revolve(pl, [wx + inb * 0.002, y, z], [inb, 0, 0], [[0.036, 0], [0.036, 0.006], [0.030, 0.008], [0, 0.008]], 32, false);
  for (let i = 0; i < 4; i++) {
    const a = (i / 3) * Math.PI;                              // OFF aft → BOTH forward
    K.bolt(dots, [wx + inb * 0.009, y + 0.028 * Math.sin(a), z - 0.028 * Math.cos(a)], [inb, 0, 0], 0.002, 0.002);
  }
  pl.mesh(g0, M.plateAl); dots.mesh(g0, M.knob);
  const gF = movingAt(g0, 'edCtl_fuel', c, [1, 0, 0], 'fuel', 1, Math.PI / 3);   // aft → up → forward, either wall
  const hub = K.Bag(), hand = K.Bag();
  K.revolve(hub, [0, 0, 0], [inb, 0, 0], [[0.009, 0], [0.009, 0.009], [0.006, 0.011], [0, 0.011]], 16, false);
  // the handle points AFT at rest (OFF), a flat bar with a rounded end
  K.sweep(hand, [[inb * 0.006, 0, 0], [inb * 0.006, 0, -0.046]],
    () => [[-0.006, -0.0025], [0.006, -0.0025], [0.006, 0.0025], [-0.006, 0.0025]], true, [0, 1, 0]);
  K.revolve(hand, [inb * 0.006, 0, -0.046], [inb, 0, 0], [[0.006, -0.0025], [0.006, 0.0025], [0, 0.0025]], 12, true);
  hub.mesh(gF, M.plated); hand.mesh(gF, M.knob);
  tapeOn(g0, 'OFF/R/L/BOTH', 0.060, [wx + inb * 0.004, y + 0.052, z], sd > 0 ? Math.PI / 2 : -Math.PI / 2);
  return { obj: gF, label: 'fuel selector' };
}
// THE TRIM WHEEL, a Cub's: a wheel on a stub axle off a bracket on the
// left wall by the pilot's hip, its rim knurled, a white mark on the rim
// and a fixed pointer over it; forward for nose down.
function buildTrimWheel(g0, A, P, sx, seat) {
  const K = window.GEAR_KIT;
  if (!K) return null;
  const sd = Math.sign(sx || 1), inb = -sd;
  let z = (seat ? seat.zBack : A.zBack) + 0.34;
  const y = (seat ? seat.panY : A.floorAt(z) + 0.08) + 0.13;
  const R = 0.046;
  const wxAt = () => (A.wallAt ? A.wallAt(sd, y, z) : sd * Math.max(0.2, A.halfW * 0.90));
  let wx = wxAt();
  if (A.tubeDist) for (let i = 0; i < 4 && A.tubeDist([wx, y, z]) < R + 0.02; i++) { z -= 0.06; wx = wxAt(); }   // off the frame
  const br = K.Bag();
  K.sweep(br, [[wx, y, z], [wx + inb * 0.006, y, z]],
    () => [[-0.040, -0.030], [0.040, -0.030], [0.040, 0.060], [-0.040, 0.060]], true, [0, 1, 0]);          // the wall plate
  K.revolve(br, [wx + inb * 0.006, y, z], [inb, 0, 0], [[0.006, 0], [0.006, 0.026]], 12, true);        // the stub axle
  K.boxIn(br, [wx + inb * 0.024, y + R + 0.006, z], [0.0015, 0.010, 0.0012], [1, 0, 0], [0, 1, 0], [0, 0, 1]);   // the pointer
  br.mesh(g0, M.cast);
  const gT = movingAt(g0, 'edCtl_trim', [wx + inb * 0.024, y, z], [1, 0, 0], 'trim', -1, 2.2);   // nose up = the top rolls aft
  const wh = K.Bag(), mark = K.Bag(), kn = K.Bag();
  K.revolve(wh, [-inb * 0.007, 0, 0], [inb, 0, 0],
    [[0.008, 0], [0.020, 0.001], [0.020, 0.003], [R - 0.010, 0.003], [R, 0.005], [R, 0.009], [R - 0.010, 0.011], [0.020, 0.011], [0.020, 0.013], [0.008, 0.014], [0, 0.014]], 40, false);
  for (let i = 0; i < 28; i++) {
    const a = 2 * Math.PI * i / 28;
    K.bolt(kn, [0, R * Math.cos(a), R * Math.sin(a)], [0, Math.cos(a), Math.sin(a)], 0.0015, 0.0012);
  }
  K.boxIn(mark, [0, R - 0.004, 0], [0.0075, 0.004, 0.0012], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  wh.mesh(gT, M.knob); kn.mesh(gT, M.grip); mark.mesh(gT, M.needle);
  return { obj: gT, label: 'trim wheel' };
}

// ---------------------------------------------------------------------------
// THE INSTRUMENT PANEL (G94)
// ---------------------------------------------------------------------------
// THE PANEL SHOWS WHAT THE BUILD BOUGHT, and that is the whole design. The
// spec already carries `systems.fit` — minimal / basic / IFR — and GEN_SYSTEMS
// already bills it 6 / 12 / 26 kg and 700 / 2400 / 9500 credits. Until now
// nothing drew the instruments that mass and that money paid for: the cage
// built a `dash` shell and left it a blank sheet of metal, which is the one
// thing a cockpit cannot be.
//
// It is the rule GEN_ACCESS states for the fittings — "no tank means no fuel
// cap" — pointed at the panel: no gyros bought, no gyros on the panel.
//
// THE SIZES ARE THE REAL ONES. 3 1/8 in = 79.4 mm and 2 1/4 in = 57.2 mm are
// the two standard instrument cut-outs, and every panel ever drilled is a
// packing problem in those two numbers. So the layout is not authored: the
// instruments pack into rows across the panel's OWN usable width, biggest
// first, and a narrower cabin gets fewer per row.
const INSTR = {
  // the six primary flight instruments, all 80 mm
  ai:    { name: 'attitude',        d: 0.0794 },
  asi:   { name: 'airspeed',        d: 0.0794 },
  alt:   { name: 'altimeter',       d: 0.0794 },
  turn:  { name: 'turn & slip',     d: 0.0794 },
  dg:    { name: 'heading',         d: 0.0794 },
  vsi:   { name: 'vertical speed',  d: 0.0794 },
  // the tachometer is 80 mm on anything with a real engine, and it is the
  // instrument you actually look at; the rest of the engine group is 57
  tacho: { name: 'tachometer',      d: 0.0794 },
  oilP:  { name: 'oil pressure',    d: 0.0572 },
  oilT:  { name: 'oil temperature', d: 0.0572 },
  fuel:  { name: 'fuel',            d: 0.0572 },
  volts: { name: 'volts',           d: 0.0572 },
  // the panel arc, session 2: the catalogue's other dials (GEN_INSTR keys;
  // items with no dial — the sight gauge, the hour meter — are not drawn here)
  aiE:    { name: 'attitude (electric)', d: 0.0794 },
  gmeter: { name: 'accelerometer',  d: 0.0794 },
  clock:  { name: 'clock',          d: 0.0572 },
  // THE COMPASS IS NOT ON THE PANEL. It sits on the coaming, away from the
  // iron in everything else — which is also why it is the one instrument a
  // minimal panel cannot leave out.
  compass: { name: 'compass',       d: 0.0700, coaming: true },
};
// WHAT EACH FIT BUYS. Day VFR is what an engine and an airframe need to be
// flown; basic adds the two gyros and a fuel gauge; IFR is the full six-pack
// with an electrical system behind it.
const PANEL_FIT = {
  minimal: ['asi', 'alt', 'tacho', 'oilP', 'oilT', 'compass'],
  basic:   ['asi', 'alt', 'vsi', 'dg', 'tacho', 'oilP', 'oilT', 'fuel',
            'compass'],
  ifr:     ['ai', 'asi', 'alt', 'turn', 'dg', 'vsi', 'tacho', 'oilP', 'oilT',
            'fuel', 'volts', 'compass'],
};
// THE FIT IS A PURCHASE, NOT A VIEW SETTING, so it is read from the spec and
// never from a control on this panel. The bench has no game spec behind it and
// falls back to `basic`, which is what GEN_DEFAULT buys.
function panelFit() {
  try {
    const S = window.GARAGE_SPEC && window.GARAGE_SPEC.get();
    const f = S && S.systems && S.systems.fit;
    if (f && PANEL_FIT[f]) return f;
  } catch (e) {}
  return 'basic';
}
// THE FIT IS A LIST NOW (the panel arc, session 2): the core's one reader
// resolves the tier, the player's edits and what the electrics can feed
// (genSystemsResolve, 60_gen_spec.js). The bench with no game spec — or a
// headless load with no core — keeps PANEL_FIT's tier lists.
function panelItems() {
  try {
    if (typeof genSystemsResolve === 'function') {
      // the game's spec, else the bench panel's own answer (_cage_panel.js)
      const S = (window.GARAGE_SPEC && window.GARAGE_SPEC.get) ? window.GARAGE_SPEC.get()
              : (window.CAGE_PANEL && window.CAGE_PANEL.toSpec) ? { systems: window.CAGE_PANEL.toSpec() } : {};
      const r = genSystemsResolve(S || {});
      return { fit: r.tier, want: r.items.slice() };
    }
  } catch (e) {}
  const fit = panelFit();
  return { fit, want: (PANEL_FIT[fit] || PANEL_FIT.basic).slice() };
}

// a flat disc and an annular rim, into a bag. The panel faces AFT (-z), which
// is the direction the seats are.
function discInto(bag, cx, cy, cz, r, seg) {
  const c = bag.v(cx, cy, cz);
  const ring = [];
  for (let i = 0; i < seg; i++) {
    const a = 2 * Math.PI * i / seg;
    ring.push(bag.v(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz));
  }
  for (let i = 0; i < seg; i++) bag.tri(c, ring[(i + 1) % seg], ring[i]);
}
function rimInto(bag, cx, cy, cz, rIn, rOut, depth, seg) {
  const a0 = [], a1 = [], b0 = [], b1 = [];
  for (let i = 0; i < seg; i++) {
    const a = 2 * Math.PI * i / seg, c = Math.cos(a), s = Math.sin(a);
    a0.push(bag.v(cx + c * rIn, cy + s * rIn, cz));
    a1.push(bag.v(cx + c * rOut, cy + s * rOut, cz));
    b0.push(bag.v(cx + c * rIn, cy + s * rIn, cz + depth));
    b1.push(bag.v(cx + c * rOut, cy + s * rOut, cz + depth));
  }
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    bag.quad(a0[i], a1[i], a1[j], a0[j]);     // the rim face, at the pilot
    bag.quad(b1[i], b1[j], a1[j], a1[i]);     // the outer wall
    bag.quad(b0[j], b0[i], a0[i], a0[j]);     // the cut-out wall
  }
}

// THE PANEL ITSELF. Built on the anchors the dash already has — the face
// station the push-pull throttle mounts through, and the dash shell's own
// vertical band — so the panel and the throttle cannot disagree about where
// the dash is, and the instruments are cut INTO the dash rather than hung
// under it.
function buildPanel(parent, A, P, pilotX) {
  const { fit, want } = panelItems();
  // ON THE DASH'S AFT FACE, a few millimetres proud of it toward the seats.
  // `A.zDash` is the station the THROTTLE mounts through — a datum inside the
  // shell — and it stays that, untouched, because the pedal lights and the
  // coaming lights read it. The dials need the face you can see.
  const zFace = (A.dashAftZ != null ? A.dashAftZ : A.zDash) - 0.004;
  // ON THE DASH FACE, not below it (user, 2026-08-31: "the instrument panel is
  // positionned incorrectly with regard to the dashboard... 30-40 cm too low").
  // G94 read the dash shell's LOWEST vertex and hung the panel 12 mm under it.
  // That vertex is the BOTTOM of the dash box — `min(base.y) - dashDepth` —
  // so the whole band was displaced by dashDepth, 0.35 m by default. The band
  // is the dash's OWN y-extent now, inset a bezel's edge distance at each end,
  // which is also what makes the panel FOLLOW the dash instead of being pushed
  // down by it: grow the dashboard and the instruments stay on its face.
  //
  // The fallback (no dash shell at all — a cabin with `intDash` off) keeps
  // G94's throttle-height guess and its 270 mm band, expressed the same way so
  // the two branches cannot disagree about what "the panel's top" means.
  const PAN_INSET = 0.012;              // bezel edge distance, top and bottom
  const hasDash = A.dashLip != null && A.dashTop != null;
  const yTop = hasDash ? A.dashTop - PAN_INSET
                       : A.floorAt(A.zDash) + 0.42 + 0.135;
  // a very shallow dash still has to carry SOMETHING: floor the band rather
  // than invert it, and let the overflow counter report what did not fit
  const yBot = hasDash ? Math.min(A.dashLip + PAN_INSET, yTop - 0.090)
                       : yTop - 0.270;
  const yMid = (yTop + yBot) / 2;
  // the usable band, stopping 50 mm short of the cabin wall on each side
  const H = (yTop - yBot) / 2, xLim = Math.max(0.16, A.halfW - 0.05);
  const bez = Bag(M.bezel), dial = Bag(M.dial), ned = Bag(M.needle);
  const placed = [];
  const onPanel = want.filter(k => INSTR[k] && !INSTR[k].coaming)
    .sort((a, b) => INSTR[b].d - INSTR[a].d);
  const GAP = 0.012;
  // ---- ROWS FIRST, THEN CENTRE EACH ROW ON THE PILOT ----------------------
  // The first cut packed left-to-right FROM the pilot's centreline and wrapped
  // to the far edge of the cabin, which scattered nine instruments across the
  // whole coaming — every one of them in a legal place and the panel looking
  // like nothing anybody would build. A panel is a BLOCK in front of the
  // person flying: fill rows to the usable width, then centre each row.
  const rows = [[]];
  let wide = 0;
  const room = Math.min(2 * xLim, 6 * 0.0794 + 5 * GAP);
  for (const k of onPanel) {
    const I = INSTR[k], row = rows[rows.length - 1];
    const w = row.reduce((t, q) => t + INSTR[q].d + GAP, 0);
    if (row.length && w + I.d > room) rows.push([k]); else row.push(k);
  }
  let rowY = yMid + H - 0.030, overflow = 0;
  for (const row of rows) {
    const wRow = row.reduce((t, q) => t + INSTR[q].d, 0) + (row.length - 1) * GAP;
    const hRow = Math.max(...row.map(q => INSTR[q].d));
    wide = Math.max(wide, wRow);
    let x = Math.max(-xLim, Math.min(xLim - wRow, pilotX - wRow / 2));
    const cy = rowY - hRow / 2;
    if (cy - hRow / 2 < yMid - H) { overflow += row.length; continue; }
    for (const k of row) {
      const r = INSTR[k].d / 2;
      placed.push({ k, cx: x + r, cy, r });
      x += INSTR[k].d + GAP;
    }
    rowY -= hRow + GAP;
  }
  // ---- NO PLATE. THE DASHBOARD IS THE PLATE. -------------------------------
  // G94 drew an M.console quad behind the dials, sized to the instrument bbox,
  // arguing that without it "the instruments read as dials stuck to the inside
  // of the fuselage". That was true only because the panel was hanging in the
  // open air below the dash. On the dash's own face there is already a sheet
  // behind every dial, and a second one is a black rectangle appearing from
  // nowhere — the user's ruling, 2026-08-31: "that should not add a black
  // panel out of nowhere, the dahsboard IS the supporting panel".
  // The dials sit 1 mm proud of A.zDash either way, so nothing else moves.
  for (const p of placed) {
    const seg = p.r > 0.035 ? 22 : 16;
    rimInto(bez, p.cx, p.cy, zFace, p.r * 0.86, p.r, 0.010, seg);
    discInto(dial, p.cx, p.cy, zFace - 0.004, p.r * 0.86, seg);
    // ONE NEEDLE, and a DIFFERENT angle on each: a panel of needles all at
    // twelve o'clock reads as a decal. The angle is a hash of the
    // instrument's own name, so it is stable across rebuilds — a random one
    // would twitch every time a slider moved.
    let h = 0;
    for (let i = 0; i < p.k.length; i++) h = (h * 31 + p.k.charCodeAt(i)) & 1023;
    const a = (h / 1024) * Math.PI * 2;
    const L = p.r * 0.78, w = p.r * 0.055;
    const ux = Math.cos(a), uy = Math.sin(a), z = zFace - 0.0055;
    ned.quad(
      ned.v(p.cx - uy * w, p.cy + ux * w, z),
      ned.v(p.cx + uy * w, p.cy - ux * w, z),
      ned.v(p.cx + ux * L + uy * w * 0.4, p.cy + uy * L - ux * w * 0.4, z),
      ned.v(p.cx + ux * L - uy * w * 0.4, p.cy + uy * L + ux * w * 0.4, z));
  }
  if (want.includes('compass')) {
    const r = INSTR.compass.d / 2;
    // ON THE PILOT'S OWN CENTRELINE, clamped inside the cabin — the same x the
    // rows are centred on. (It was reading a local the layout rewrite had
    // taken away, which is what a ReferenceError in a post hook looks like.)
    const x0 = Math.max(-xLim + r, Math.min(xLim - r, pilotX));
    const cy = yMid + H + r * 0.9;
    rimInto(bez, x0, cy, zFace - 0.02, r * 0.80, r, 0.030, 16);
    discInto(dial, x0, cy, zFace - 0.024, r * 0.80, 16);
    placed.push({ k: 'compass', cx: x0, cy, r });
  }
  bez.mesh(parent); dial.mesh(parent); ned.mesh(parent);
  // THE LAYER PUBLISHES ITS OWN MEASUREMENT, the way the gear and the engine
  // layers do: where the panel actually landed, so a station that is wrong can
  // be READ rather than hunted for in a screenshot.
  const ext = placed.length
    ? { x0: Math.min(...placed.map(q => q.cx - q.r)),
        x1: Math.max(...placed.map(q => q.cx + q.r)),
        y0: Math.min(...placed.map(q => q.cy - q.r)),
        y1: Math.max(...placed.map(q => q.cy + q.r)), z: zFace }
    : null;
  return { fit, n: placed.length, overflow, ext, yMid, zFace, xLim };
}

// (G94's floorboards were drawn here until G267 — see the call site.)

// ---- THE DUMMY (mannequin_poser.html port) --------------------------------
const PICK_MAT = new THREE.MeshBasicMaterial({ visible: false });
// guarded: the node gates load this file under a THREE stub whose materials
// carry no userData
if (PICK_MAT.userData) PICK_MAT.userData.cageUni = 1;   // the editor's passes leave it be
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

// `suitM` is THIS dummy's own suit material (phase D) — the per-dummy
// livery section resolved by the caller, null on the standalone bench.
// Joints and hands/feet stay the shared hardware; only the SHELL dresses.
// `rig` (G204) swaps the bone table for a CHARACTER's own proportions
// (_cage_char.js rig(): the same 19 joints, offsets read off the Mixamo
// reference pose) so the IK lands the character's hands, not the ATD's, on
// the grips; with a rig and `shells` false the amber shells are not built —
// the skinned mesh dresses the skeleton instead (shells stay while the mesh
// is still on the wire, so the seat is never empty).
// THE BARE SKELETON (LIVE CREW): the fig and its bone tree, nothing drawn.
// makeDummy hangs the shells on it; the flown pilot (app.js) re-solves its
// arms on one of these every frame, from the same rig offsets — the ONE pose
// engine of G204, on both sides of the join.
function bareDummy(parent, rig) {
  const fig = new THREE.Group();
  parent.add(fig);
  const bones = {};
  (rig ? rig.bones : BONES).forEach(([name, par, pos]) => {
    const b = new THREE.Object3D();
    b.name = name;
    b.position.set(pos[0], pos[1], pos[2]);
    (par ? bones[par] : fig).add(b);
    bones[name] = b;
  });
  return { fig, bones };
}
function makeDummy(parent, suitM, rig, shells) {
  const suit = suitM || M.shell;
  const { fig, bones } = bareDummy(parent, rig);
  const att = (bn, mesh) => { bones[bn].add(mesh); return mesh; };
  const jball = (bn, r) =>
    att(bn, new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), M.joint));
  // pelvis
  {
    const g = shellGeom(-0.10, 0.07,
      t => 0.088 + 0.055 * smoothS(t) - 0.012 * t * t);
    const m = new THREE.Mesh(g, suit); m.scale.z = 0.74;
    att('root', m);
  }
  jball('lumbar', 0.082);
  {
    const g = shellGeom(0.0, 0.16, t => 0.098 + 0.030 * t);
    const m = new THREE.Mesh(g, suit); m.scale.z = 0.74;
    att('lumbar', m);
  }
  {
    const g = shellGeom(-0.02, 0.245, t => {
      const u = smoothS(clamp(t * 1.25, 0, 1));
      return 0.118 + 0.048 * u - 0.030 * Math.max(0, (t - 0.82) / 0.18);
    });
    const m = new THREE.Mesh(g, suit); m.scale.set(1.06, 1, 0.70);
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
    const h = new THREE.Mesh(g, suit);
    h.position.y = 0.10; h.scale.set(0.94, 1, 0.90);
    att('head', h);
  }
  for (const s of ['L', 'R']) {
    jball('shoulder' + s, 0.062);
    att('shoulder' + s,
        new THREE.Mesh(segmentGeom(0.29, 0.050, 0.055, 0.040), suit));
    jball('elbow' + s, 0.049);
    att('elbow' + s,
        new THREE.Mesh(segmentGeom(0.26, 0.043, 0.046, 0.032), suit));
    jball('wrist' + s, 0.036);
    const hand = new THREE.Mesh(segmentGeom(0.165, 0.034, 0.046, 0.020),
                                M.dark);
    hand.scale.set(1.0, 1, 0.52);
    att('wrist' + s, hand);
  }
  for (const s of ['L', 'R']) {
    jball('hip' + s, 0.072);
    att('hip' + s,
        new THREE.Mesh(segmentGeom(0.44, 0.068, 0.072, 0.052), suit));
    jball('knee' + s, 0.060);
    att('knee' + s,
        new THREE.Mesh(segmentGeom(0.42, 0.058, 0.062, 0.040), suit));
    jball('ankle' + s, 0.043);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.090, 0.055, 0.225),
                                M.dark);
    foot.position.set(0, -0.045, 0.058); att('ankle' + s, foot);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.038, 0.05),
                               M.dark);
    toe.position.set(0, -0.052, 0.185); att('ankle' + s, toe);
  }
  // A DRESSED DUMMY KEEPS ITS SHELLS AS THE PICK PROXY (G204.2): drawn by an
  // invisible material, so nothing shows and nothing shadows, but the
  // raycast and the highlight (which re-draws a mesh's geometry as its own
  // child) still find a body that FOLLOWS THE POSE. The skinned mesh itself
  // is unpickable — r128 would test it at its bind pose under the floor.
  if (rig && !shells)
    fig.traverse(o => { if (o.isMesh) { o.material = PICK_MAT; o.userData.pick = 1; } });
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
// ONE GRIP JOB, SOLVED (module scope since the live crew: seatDummy solves
// it once at build, the flown pilot solves it again every frame against the
// grip where the stick now IS). `j` = { chain, a (the anchor), label };
// `ctx` = { s (stature scale), palm (m, already x s), elbows, knees (the
// pole sliders), base (the FK fallback pose, or null), notes (or null),
// poleFig (a frozen pole in the fig's frame, or null: derive it from the
// current bend as the editor does) }. Returns the reach gap.
const _pole = new THREE.Vector3();
function solveGripJob(dum, j, ctx) {
  const c = CHAINS[j.chain], s = ctx.s;
  const pole = _pole;
  if (ctx.poleFig) {
    // the fig's world matrix is REFRESHED first: on a flying aeroplane it is
    // a frame stale here (the renderer updates the tree after the pose), and
    // a pole 33 cm behind the elbow bent the knee a centimetre off (measured)
    dum.fig.updateWorldMatrix(true, false);
    dum.fig.localToWorld(pole.copy(ctx.poleFig));
  } else {
    ikDefaultPole(dum, j.chain, pole);
    const side = /L$/.test(c.end) ? 1 : -1;
    if (c.arm) {                    // elbows: down + in/out slider
      pole.y -= 0.22 * s;
      pole.x += side * (0.03 + (ctx.elbows || 0)) * s;
    } else {                        // knees: up-forward + in/out slider
      pole.y += 0.10 * s; pole.z += 0.10 * s;
      pole.x += side * (ctx.knees || 0) * s;
    }
    // the pole the editor chose, in the fig's frame: what the join carries
    // so the flown solve bends the same elbow the same way
    j.poleFig = dum.fig.worldToLocal(pole.clone());
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
    aw.p.addScaledVector(_hv, -ctx.palm);
    // THE FIST CLOSES ON THE GRIP (G279): `fixH` is where the dressed rig's
    // fist actually closed relative to the grip, in the hand's own frame,
    // measured by fitFists() below and carried into flight by the join —
    // the target moves by its negative, so the hollow of the fingers lands
    // on the grip whatever the rig's own hand and arm proportions are
    if (j.fixH) aw.p.add(_hv.copy(j.fixH).applyQuaternion(alignQ));
  }
  const gap = ikSolve(dum, j.chain, aw.p, pole, alignQ);
  // A NATURAL WRIST (G205, the user: 'natural wrist orientation'): the
  // grip basis above was solved from the SHOULDER's approach, which
  // twists the hand against the forearm the IK then placed. Solve it
  // again from the ELBOW, so the hand continues the forearm and wraps
  // the grip from where the arm really arrives.
  if (j.a.userData.grip && gap <= 0.12) {
    dum.bones[c.mid].getWorldPosition(_gv);
    const q2 = gripQuat(j.a, _gv, _gq);
    const wb = dum.bones[c.end];
    wb.parent.getWorldQuaternion(_qp).invert();
    wb.quaternion.copy(_qp.multiply(q2));
    wb.updateMatrixWorld(true);
  }
  if (!ctx.notes) return gap;
  // where the WRIST ended up against the grip it holds: the gap
  // between them IS the palm offset, i.e. the proof the HAND and
  // not the joint is on the control
  { const w = new THREE.Vector3();
    dum.bones[c.end].getWorldPosition(w);
    j.wrist = [+w.x.toFixed(3), +w.y.toFixed(3), +w.z.toFixed(3)]; }
  if (gap > 0.12) {
    // hopeless stretch reads as a defect — fall back to the rest
    // pose and let the readout carry the finding instead
    if (ctx.base) for (const bn of [c.root, c.mid, c.end]) if (ctx.base[bn])
      dum.bones[bn].rotation.set(ctx.base[bn][0] * D2R,
        ctx.base[bn][1] * D2R, ctx.base[bn][2] * D2R);
    dum.fig.updateMatrixWorld(true);
    ctx.notes.push(c.label + ' OUT OF REACH ' + (gap * 100).toFixed(0)
                   + 'cm (' + j.label + ')');
  } else if (gap > 0.005)
    ctx.notes.push(c.label + ' SHORT ' + (gap * 100).toFixed(1) + 'cm');
  return gap;
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
  // THE DASH SHELL'S OWN BAND, MEASURED (G94, corrected here). The first cut
  // put the panel at floor + 0.42, which is where the push-pull throttle
  // mounts and is most of a coaming's height too high: nine instruments were
  // built correctly and hidden behind the cowl deck. G94 moved it "to the
  // lip" and took the LOWEST `dash` vertex — which is not the lip, it is the
  // BOTTOM of the dash box (`yB = min(base.y) - dashDepth`, _cage_gen.js's
  // own construction). Hanging the panel below that displaced it by exactly
  // `dashDepth`, 0.35 m by default, and that was the user's "30-40 cm too
  // low": move the dashDepth slider and the error tracked it 1:1.
  //
  // So BOTH edges are measured and named for what they are. `dashLip` keeps
  // its name and its value because _cage_light.js reads it for the coaming
  // panel lights and that station is genuinely the bottom lip; `dashTop` is
  // the traced windscreen base line, and the two together are the face the
  // instruments are cut into. The dash IS the panel (user, 2026-08-31), so
  // nothing is drawn behind them.
  //
  // AND ITS AFT FACE, for the same reason. The dash is a BOX, not a plate —
  // `dashDepth` runs it 0.35 m FORWARD from the windscreen base — and the
  // panel's own station was `zDash + 0.005`, which lands 38 mm INSIDE it.
  // That never showed while the instruments hung below the box in open air;
  // the moment they moved onto its face it buried them. +z is forward here,
  // so the aft face is the MINIMUM z the `dash` material reaches.
  let dashLip = null, dashTop = null, dashAftZ = null;
  if (mesh && mesh.F && mesh.V) {
    let lo = 1e9, hi = -1e9, za = 1e9;
    for (const f of mesh.F) {
      // BOTH OF THE DASHBOARD'S MATERIALS (2026-09-04): the facia was split
      // off as `dashFace`, and this band is the dash's OWN extent — measuring
      // it off one of the two halves would make where the instruments sit
      // depend on which half a builder happens to be looking at.
      if (f.m !== 'dash' && f.m !== 'dashFace') continue;
      for (const vi of f.v) {
        const y = mesh.V[vi][1] * k, z = mesh.V[vi][2] * k;
        if (y < lo) lo = y;
        if (y > hi) hi = y;
        if (z < za) za = z;
      }
    }
    if (lo < 1e8) { dashLip = lo; dashTop = hi; dashAftZ = za; }
  }
  // THE FACE PLATE ITSELF (the panel arc, session 4b, the user: "get really
  // clear on the flat area available to you. It's the one with the metal
  // material"). The band above is the whole dash — glareshield, roll, lip and
  // plate together — and the panel laid out on it hung its dials 2 cm in
  // front of the recessed plate (zFace was the LIP's plane, the aft-most
  // point of either material) with their tops under the glareshield's roll.
  // This is the `dashFace` polygon on its own: its outline as columns 1 cm
  // apart across x (the lowest and highest y of the plate at that x), its
  // extreme x, and the PLANE it lies in — the plate is not vertical, the
  // cage draws it leaning (the top nearer the pilot than the bottom), so the
  // plane is the top-centre and bottom-centre z with the tilt between them.
  let face = null;
  if (mesh && mesh.F && mesh.V) {
    const BIN = 0.01, cols = new Map();
    let xMax = 0, yLo = 1e9, yHi = -1e9, n = 0;
    let zTopS = 0, nTop = 0, zBotS = 0, nBot = 0;
    const pts = [];
    // the outline is read off the plate's FACES, not its vertices: the
    // ladder that fills the plate has vertices only along its rim, so a
    // column between two rungs would see nothing. Every edge of every plate
    // face is cut by each column line it spans, and the column's range is
    // the lowest and highest cut (the faces are convex quads).
    const cut = (x, y0, y1, samples) => {
      const b = Math.round(x / BIN);
      const c = cols.get(b) || { x: b * BIN, y0: 1e9, y1: -1e9, yz: [] };
      if (y0 < c.y0) c.y0 = y0;
      if (y1 > c.y1) c.y1 = y1;
      for (const s of samples) c.yz.push(s);
      cols.set(b, c);
    };
    for (const f of mesh.F) {
      if (f.m !== 'dashFace') continue;
      const P = f.v.map(vi => [mesh.V[vi][0] * k, mesh.V[vi][1] * k, mesh.V[vi][2] * k]);
      for (const q of P) {
        pts.push(q); n++;
        if (Math.abs(q[0]) > xMax) xMax = Math.abs(q[0]);
        if (q[1] < yLo) yLo = q[1];
        if (q[1] > yHi) yHi = q[1];
      }
      let fx0 = 1e9, fx1 = -1e9;
      for (const q of P) { if (q[0] < fx0) fx0 = q[0]; if (q[0] > fx1) fx1 = q[0]; }
      for (let b = Math.ceil(fx0 / BIN); b * BIN <= fx1 + 1e-9; b++) {
        const x = b * BIN;
        let lo = 1e9, hi = -1e9;
        const samples = [];                                        // (y, z) where the plate crosses this column
        for (let i = 0; i < P.length; i++) {
          const a = P[i], c = P[(i + 1) % P.length];
          if ((a[0] - x) * (c[0] - x) > 0) continue;              // the edge does not span x
          const t = Math.abs(c[0] - a[0]) < 1e-9 ? 0 : (x - a[0]) / (c[0] - a[0]);
          const y = a[1] + (c[1] - a[1]) * t, z = a[2] + (c[2] - a[2]) * t;
          samples.push([y, z]);
          if (y < lo) lo = y;
          if (y > hi) hi = y;
        }
        if (lo <= hi) cut(x, lo, hi, samples);
      }
    }
    if (n) {
      // the plane: the aft-most z near the crown and near the bottom, on the
      // centreline's own column (the plate's curvature across x is the lip
      // path's, not a lean)
      for (const [x, y, z] of pts) {
        if (Math.abs(x) > 0.06) continue;
        if (y > yHi - 0.02) { zTopS += z; nTop++; }
        if (y < yLo + 0.02) { zBotS += z; nBot++; }
      }
      const zTop = nTop ? zTopS / nTop : dashAftZ, zBot = nBot ? zBotS / nBot : zTop;
      const tilt = Math.atan2(zBot - zTop, Math.max(0.05, yHi - yLo));
      const list = [...cols.values()].sort((a, b) => a.x - b.x);
      for (const c of list) c.yz.sort((p, q) => p[0] - q[0]);
      face = { yBot: yLo, yTop: yHi, zTop, zBot, tilt, xMax, cols: list,
               // the outline at x: the nearest column's floor and crown
               at(x) {
                 let best = null;
                 for (const c of list) if (!best || Math.abs(c.x - x) < Math.abs(best.x - x)) best = c;
                 return best;
               },
               // THE PLATE IS NOT A PLANE (session 4c): the ladder follows the
               // lip path's curve, so its depth varies across and up the plate
               // by millimetres — enough to swallow a face standing 4 mm proud
               // of the fitted plane. This is the plate's own z at (x, y): the
               // nearest column's crossings, interpolated in y.
               depthAt(x, y) {
                 const c = this.at(x);
                 if (!c || !c.yz.length) return this.zTop;
                 const S = c.yz;
                 if (y <= S[0][0]) return S[0][1];
                 for (let i = 1; i < S.length; i++)
                   if (y <= S[i][0]) {
                     const t = (y - S[i - 1][0]) / Math.max(1e-9, S[i][0] - S[i - 1][0]);
                     return S[i - 1][1] + (S[i][1] - S[i - 1][1]) * t;
                   }
                 return S[S.length - 1][1];
               } };
    }
  }
  // the glareshield's height at a place (the compass stands on it): the
  // highest dash vertex within dx of x and between z0 and z1, or dashTop
  const dashPts = [];
  if (mesh && mesh.F && mesh.V)
    for (const f of mesh.F) {
      if (f.m !== 'dash') continue;
      for (const vi of f.v) dashPts.push([mesh.V[vi][0] * k, mesh.V[vi][1] * k, mesh.V[vi][2] * k]);
    }
  const dashTopAt = (x, dx, z0, z1) => {
    let y = -1e9;
    for (const q of dashPts) if (Math.abs(q[0] - x) <= dx && q[2] >= z0 && q[2] <= z1 && q[1] > y) y = q[1];
    return y > -1e8 ? y : dashTop;
  };
  // ...and the box's UNDERSIDE at a place (G296: the pedalier lamp hangs
  // from it): the lowest dash vertex in the same window, or dashLip
  // ...and the dash's AFT face in a height band (G318: the registration
  // tape sits on the roll above the plate): the aft-most dash vertex there
  const dashAftAt = (x, dx, y0, y1) => {
    let z = 1e9;
    for (const q of dashPts) if (Math.abs(q[0] - x) <= dx && q[1] >= y0 && q[1] <= y1 && q[2] < z) z = q[2];
    return z < 1e8 ? z : dashAftZ;
  };
  const dashBotAt = (x, dx, z0, z1) => {
    let y = 1e9;
    for (const q of dashPts) if (Math.abs(q[0] - x) <= dx && q[2] >= z0 && q[2] <= z1 && q[1] < y) y = q[1];
    return y < 1e8 ? y : dashLip;
  };
  // THE FRAME'S TUBES (G318): the interior pass publishes every member it
  // draws (mesh.members, cage units); a control on the wall asks how far
  // the nearest tube's surface is from a point, and steps off it
  const MB = ((mesh && mesh.members) || []).map(m => ({ a: m.a.map(v => v * k), b: m.b.map(v => v * k), r: (m.r || 0) * k }));
  const tubeDist = p => {
    let best = Infinity;
    for (const m of MB) {
      const dx = m.b[0] - m.a[0], dy = m.b[1] - m.a[1], dz = m.b[2] - m.a[2];
      const L2 = dx * dx + dy * dy + dz * dz; if (L2 < 1e-9) continue;
      const t = Math.max(0, Math.min(1, ((p[0] - m.a[0]) * dx + (p[1] - m.a[1]) * dy + (p[2] - m.a[2]) * dz) / L2));
      const d = Math.hypot(p[0] - m.a[0] - dx * t, p[1] - m.a[1] - dy * t, p[2] - m.a[2] - dz * t) - m.r;
      if (d < best) best = d;
    }
    return best;
  };
  // THE WALL ITSELF (G318): a wall-mounted control sat at 0.9 x halfW,
  // which on this cabin is 4 cm inboard of the door's skin — a plate in
  // the air. The cage's own vertices say where the side is at a height
  // and a station: the outermost skin there, and the innermost surface
  // within 5 cm of it (a lined pillar's liner, else the skin itself).
  // Signed by side. And the door's forward edge at a height (the jamb),
  // so nothing is hung across it.
  const sidePts = [];
  if (mesh && mesh.F && mesh.V)
    for (const f of mesh.F) for (const vi of f.v) {
      const v = mesh.V[vi];
      if (Math.abs(v[0]) * k > 0.15) sidePts.push([v[0] * k, v[1] * k, v[2] * k, f.door ? 1 : 0]);
    }
  const wallAt = (sd, y, z) => {
    let xMax = 0;
    for (const q of sidePts) if (q[0] * sd > xMax && Math.abs(q[1] - y) < 0.08 && Math.abs(q[2] - z) < 0.10) xMax = q[0] * sd;
    if (!(xMax > 0)) return sd * spec.cabin.halfW * k * 0.90;
    let xIn = xMax;
    for (const q of sidePts) { const x = q[0] * sd; if (x > xMax - 0.05 && x < xIn && Math.abs(q[1] - y) < 0.08 && Math.abs(q[2] - z) < 0.10) xIn = x; }
    return sd * xIn;
  };
  const doorFwdAt = (sd, y) => {
    let zM = -Infinity;
    for (const q of sidePts) if (q[3] && q[0] * sd > 0 && Math.abs(q[1] - y) < 0.06 && q[2] > zM) zM = q[2];
    return zM;
  };
  return { k, dashLip, dashTop, dashAftZ, face, dashTopAt, dashBotAt, dashAftAt, floorAt, tubeDist, wallAt, doorFwdAt, halfW: spec.cabin.halfW * k,
           roofY: spec.cabin.roofY * k, waistY: spec.waistY * k,
           zBack, zDash, zWin: win ? win.lv.waist.z * k : 0,
           // G180: the resolved rings, so a passenger bay's seat row can be
           // placed off the bay's own aft ring the way the pilot's is off
           // the cockpit's
           rings: R.rings };
}
// A ROW PER SECTION (G180, 2026-09-04, the user: "every passenger bay should
// be able to hold as many seats as the cabin ... for each section, we can
// decide whether passengers are seated or not"). The cockpit seats one
// abreast or two (`seatLayout` 0 / 1) and EVERY passenger bay seats the same
// row, placed off the bay's own aft ring exactly as the pilot's seat is placed
// off the cockpit's — so the bays are the pitch, and the seats stay where the
// structure is whoever sits in them. The tandem layout is gone as a choice
// because it is this rule with one bay: `seatLayout 2` from an older build
// reads as one abreast (cageFromSpec migrates it to 0).
//
// WHO IS ABOARD is per section, never per seat count: `cabOcc` fills the
// cockpit's second seat, `paxOcc<n>` says how many sit in bay n, bays counted
// FRONT TO BACK from the cockpit (bay 1 is the one behind the pilot; the cage
// numbers its rings from the aft bulkhead, which is why the ring index is
// inverted below). A filled seat gets a dummy AND a mass; an empty one keeps
// its chair. Seat order out of here is the order the join and the frame bill
// in: pilot, the cockpit's other seat, then bay 1's row, bay 2's...
function seatPlaces(A, P) {
  const lay = Math.round(P.seatLayout);
  const abreast = lay === 1 ? 2 : 1;
  const bays = Math.max(0, Math.round(P.paxCount || 0));
  // the outer shoulder sits ~0.21 m outboard of the seat centre (the
  // dummy's clavicle + joint), so the seat centre stays 0.25 m inside the
  // waist half-width (2026-09-04: the pilots stuck out of the sides)
  const gapIn = halfW => Math.min(P.seatGap, Math.max(0.18, halfW - 0.25));
  const row = (zBack, halfW, section, filled) => {
    const out = [];
    const gp = abreast === 2 ? gapIn(halfW) : 0;
    for (let j = 0; j < abreast; j++)
      out.push({ x: abreast === 2 ? (j ? -gp : gp) : 0, zBack, section,
                 pilot: section === 0 && j === 0,
                 filled: section === 0 && j === 0 ? true : j < filled });
    return out;
  };
  const seats = row(A.zBack, A.halfW, 0, 1 + (+P.cabOcc ? 1 : 0));
  const rings = A.rings || [];
  const rg = n => rings.find(r => r.name === n);
  for (let n = 1; n <= bays; n++) {
    // bay n front-to-back is cage bay (bays - n); its aft ring is
    // `pilPaxB<i>` (`pilPaxB` for i 0, the aft bulkhead's own ring)
    const i = bays - n;
    const r = rg('pilPaxB' + (i || ''));
    if (!r) continue;                          // a mirrored pod has no bays
    const zBack = r.lv.waist.z * A.k + 0.05 + (P.paxSeatZ || 0);
    const halfW = (r.lv.waist.x != null ? r.lv.waist.x * A.k : A.halfW);
    const want = Math.max(0, Math.round(+P['paxOcc' + n] || 0));
    seats.push(...row(zBack, halfW, n, Math.min(abreast, want)));
  }
  return seats;
}

// ---- THE BUILD HOOK -------------------------------------------------------
let group = null;
// characters on the wire (G204): one fetch per key, the build re-runs on
// landing; a texture landing only needs a redraw (the bench draws on demand)
const CHAR_WAIT = {};
// several characters landing in one breath rebuild ONCE
let charRebuildT = 0;
const charRebuild = () => {
  clearTimeout(charRebuildT);
  charRebuildT = setTimeout(() => {
    if (window.CAGE_UI && window.CAGE_UI.build) window.CAGE_UI.build();
  }, 60);
};
if (typeof window !== 'undefined')
  window.CHAR_TEX_LANDED = () => {
    if (window.CAGE_UI && window.CAGE_UI.draw) window.CAGE_UI.draw();
  };
// THE FOOTWELL (G272, the user: "fake ambient occlusion for the section
// below the dashboard ... everything would normally be very dark ... and
// maybe on the legs of the pilots too"). Live AO is out of reach in this
// renderer; what stands in for it is ONE box in the shader (aeroskin.js's
// AERO_CABIN_FS), measured here off the same anchors everything else in the
// cabin stands on: under the dash's BOTTOM lip (`dashLip`, the plate's
// lower edge — the plate and its dials face the pilot and stay lit),
// forward of the dash's AFT face (`dashAftZ`, the plate's station), between
// the cabin walls, down to the floor at that station. Published in CRAFT
// space — x lateral, y aft, z up, metres — which is this layer's own frame
// with z negated: the layer is built in metres on the mount, the mount is
// the craft root (G216), and cage +z is forward.
let FOOTWELL = null;
function footwellOf(A) {
  if (!A || A.dashLip == null || A.dashAftZ == null) return null;
  const zFloor = A.floorAt(A.dashAftZ);
  if (!(A.dashLip > zFloor + 0.10)) return null;
  return { xHalf: +(A.halfW + 0.05).toFixed(3), yLip: +(-A.dashAftZ).toFixed(3),
           zTop: +A.dashLip.toFixed(3), zFloor: +zFloor.toFixed(3) };
}
function footwellSet(fw) {
  if (typeof window !== 'undefined' && window.AEROSKIN && window.AEROSKIN.aeroSetFootwell)
    window.AEROSKIN.aeroSetFootwell(THREE, fw);
}
// THE HOLES IN THE PLATE (G279): the panel layer's cut-outs behind the
// attitude indicators, in this layer's frame, re-expressed in craft space
// like the footwell and handed to the facia's shader
let HOLES = [];
function holesOf(group) {
  const PN = typeof window !== 'undefined' && window.CAGE_PANEL;
  if (!group || !PN || !PN.holes) return [];
  try {
    return PN.holes(group).map(h => ({ x: h.x, y: +(-h.z).toFixed(4), z: h.y, r: h.r }));
  } catch (e) { return []; }
}
function holesSet(list) {
  if (typeof window !== 'undefined' && window.AEROSKIN && window.AEROSKIN.aeroSetHoles)
    window.AEROSKIN.aeroSetHoles(THREE, list);
}

PAGE.post = ({ scene, spec, mesh, P, stat }) => {
  CTL_MOVING = [];                     // G240: this build's moving controls
  LIVE_CREW = [];                      // live crew: this build's skeletons
  if (window.CAGE_CHAR && window.CAGE_CHAR.clearAnims) window.CAGE_CHAR.clearAnims();
  if (group) {
    // a character's skinned geometry is SHARED across builds (_cage_char.js
    // uploads it once per page) — the crew's own bags go, the character stays
    group.traverse(c => { if (c.geometry && !c.isSkinnedMesh) c.geometry.dispose(); });
    scene.remove(group);
    group = null;
  }
  if (!P.crewOn) {
    if (typeof window !== 'undefined') window.CAGE_CREW_EYE = null;
    footwellSet(null);
    HOLES = []; holesSet(null);
    return;
  }
  group = new THREE.Group();
  // NAMED for the editor (G76/G77): the part table says which layer a
  // part lives in, and G79's raycast resolves a hit to a part through
  // that. One string, no behaviour.
  group.name = 'cageLayer:crew';
  scene.add(group);

  const A = anchors(spec, P, mesh);
  FOOTWELL = footwellOf(A);
  footwellSet(FOOTWELL);
  const places = seatPlaces(A, P);
  const sbs = Math.round(P.seatLayout) === 1;
  // per-seat settings: the second seat falls back to the first's when
  // its own control is at the sentinel (-1 = "same as the front seat")
  const sp1 = { h: P.seatH, rake: P.seatRake, tilt: P.seatTilt || 0 };
  const fb = (v, d) => (v == null || v < 0) ? d : v;
  const sp2 = { h: fb(P.seat2H, sp1.h), rake: fb(P.seat2Rake, sp1.rake),
                tilt: fb(P.seat2Tilt, sp1.tilt) };
  // NAMED for the editor (G113, closing the HIT_NAME gap): each seat under
  // its own identity wrapper, so clicking a cushion selects Seats rather
  // than the crew layer's first part. An identity group is transparent to
  // anchorWorld (it updates ancestors itself) and to every bag.
  // G180: the COCKPIT's seats (pilot and co-pilot) are the pilot seat rows'
  // and every PASSENGER BAY's seat is the passenger rows' — the user: "the
  // passenger seats have controls separate from the pilot seats"
  const seats = places.map((pl, i) => {
    const sg = new THREE.Group();
    sg.name = 'edSeat' + (i + 1);
    group.add(sg);
    const SP = pl.section ? sp2 : sp1;
    return Object.assign({}, pl, { SP },
      buildSeat(sg, A, P, pl.x, pl.zBack, sbs, SP));
  });
  const pilot = seats.find(s => s.pilot);

  // ---- controls ----
  // A STATION PER SEAT. Side-by-side carries DUAL CONTROLS (user
  // 2026-08-19): a stick and a set of pedals in front of each seat.
  // The throttle stays single — one engine, one lever — and belongs to
  // the pilot's station.
  const stickMode = Math.round(P.ctlStick), thrMode = Math.round(P.ctlThr);
  const mkStation = seat => {
    // NAMED (G113): the station's stick and pedals under one wrapper, so a
    // control resolves to the Controls part when clicked
    const cg = new THREE.Group();
    cg.name = 'edCtl';
    group.add(cg);
    const o = { stick: null, pedals: null };
    if (stickMode === 0) o.stick = buildStickCenter(cg, A, P, seat.x, seat);
    if (stickMode === 1) o.stick = buildYoke(cg, A, P, seat.x);
    if (stickMode === 2) o.stick = buildStickSide(cg, A, P, seat.x, seat);
    if (P.ctlPed) o.pedals = buildPedals(cg, A, P, seat.x);
    return o;
  };
  // dual controls in the COCKPIT only — a passenger bay's row has none (G180)
  const stn = seats.map(s2 => (s2.pilot || (sbs && !s2.section)) ? mkStation(s2) : null);
  const st1 = stn[seats.indexOf(pilot)];
  let stick = st1.stick, thr = null;
  // the console BOX only exists side-by-side (user): with one seat
  // across the cabin there is nowhere for it to stand, so single and
  // tandem get the throttle quadrant alone
  // THE BOX IS THE SWITCH'S ALONE (G211, the user, having clicked the
  // horizontal bar across the cockpit: "the bar is the throttle console
  // box, remove it"). It was forced on whenever the throttle was the
  // console TYPE, so `centre console` off drew it anyway — a 0.26 m box
  // through the pilot's lap. A console throttle without the box floats on
  // its own small mount, which buildConsole has handled since 2026-08-19.
  const boxWanted = sbs && !!(+P.consoleOn);
  let consoleThr = null;
  if (boxWanted || thrMode === 2) {
    // sbs: between the seats. Otherwise on the throttle-hand side —
    // yoke flies left-handed (throttle right), sticks right-handed
    // (throttle left, +x)
    const cx = sbs ? 0 : pilot.x + (stickMode === 1 ? -0.28 : 0.28);
    const cog = new THREE.Group();
    cog.name = 'edConsole';                              // G113: named
    group.add(cog);
    consoleThr = buildConsole(cog, A, P, cx, thrMode === 2, boxWanted);
  }
  const tg = new THREE.Group();
  tg.name = 'edCtl';                                     // G113: named
  group.add(tg);
  if (thrMode === 0) thr = buildThrottleWall(tg, A, P, pilot.x);
  if (thrMode === 1) thr = buildThrottleDash(tg, A, P, pilot.x);
  if (thrMode === 2) thr = consoleThr;
  st1.thr = thr;
  let pedals = st1.pedals;
  // G318: the flap lever, the brake, the fuel selector and the trim wheel —
  // the pilot's, drawn with the controls so the join carries them
  try {
    buildFlapLever(tg, A, P, pilot.x, pilot, sbs);
    buildBrakeKnob(tg, A, P, pilot.x);
    buildFuelSelector(tg, A, P, pilot.x, pilot);
    buildTrimWheel(tg, A, P, pilot.x, pilot);
  } catch (e) { console.warn('controls (G318):', e); }

  // ---- THE PANEL AND THE FLOOR (G94) --------------------------------------
  // Both are DERIVED and neither is a choice: the floor is where `floorAt`
  // has always said it is, and the panel shows the instruments the build
  // bought. They are drawn after the controls so the throttle's own rod
  // reaches through the panel rather than being buried behind it.
  // THE FLOORBOARDS ARE GONE (G267, the user: "there is a floor drawn, and
  // it's just bad, I want it removed"). G94 drew a plank floor between the
  // dash and the seat backs; it was a flat quad strip that never met the
  // covering it was supposed to sit on. The floor stays a NUMBER —
  // `floorAt` is where every seat, pedal and console stands — and nothing
  // draws it. `floorN` stays on the debug record at 0 for the notes line.
  const floorN = 0;
  // THE PANEL LAYER DRAWS THE DIALS NOW (the panel arc, session 3): real
  // faces, hands on the moving contract, the switch row — into this group,
  // off these anchors, returning the record this layer always published.
  // buildPanel below stays as the fallback (a headless load, no layer).
  let panel = null;
  HOLES = [];
  if (window.CAGE_PANEL && window.CAGE_PANEL.build)
    try { panel = window.CAGE_PANEL.build(group, A, P, pilot.x); HOLES = holesOf(group); }
    catch (e) { console.error('panel:', e); panel = null; }
  if (!panel) panel = buildPanel(group, A, P, pilot.x);

  // ---- dummies ----
  // TWO POSES, NOT ONE PER BODY (G180, the user: "all the passenger and dummy
  // positions will be the same for all dummies"): the cockpit's occupants
  // take the pilot's stature and recline, every bay's the passenger set
  const sPilot = STATURES[clamp(Math.round(P.dumSize), 0, 2)] / BASE_STATURE;
  const sPax = STATURES[clamp(Math.round(P.paxSize == null ? 1 : P.paxSize), 0, 2)]
             / BASE_STATURE;
  const POSE_PILOT = { s: sPilot, recline: P.dumRecline || 0 };
  const POSE_PAX = { s: sPax, recline: P.paxRecline || 0 };
  const notes = [];
  // EVERY OCCUPANT IS POSED THE SAME WAY (user 2026-08-19): the second
  // dummy is not a passenger ornament — give it a station and it flies
  // from it, by the identical rules. Without one it rests its hands.
  // WHO SITS WHERE (G204/G204.1). `pilotWho` and `copWho` read the same list:
  // 0 = mixed crew, 1 = the ATD-01, 2.. = one declared character (tools/
  // chars_table.py order). MIXED CREW ROTATES: every seat that says 'mixed'
  // takes the next character off a cycle that starts at a hash of the
  // aeroplane's registration (the user: 'alternate between characters on
  // spawn, minimizing repetition') — so one aeroplane keeps its crew from
  // build to build, two aeroplanes get different faces, and nobody is seated
  // twice until the list runs out. Characters picked BY NAME for a seat are
  // left out of the cycle. The rig comes from the manifest alone, so the
  // proportions are right on the first build; each mesh is fetched once and
  // the build re-runs when it lands (a stature of 1.75 m means 1.75 m in
  // whichever body wears it).
  const CH_LIST = window.CAGE_CHAR ? window.CAGE_CHAR.list() : [];
  const whoOf = v => Math.round(+v || 0);
  const named = new Set([P.pilotWho, P.cabOcc ? P.copWho : 0].map(whoOf)
    .filter(v => v >= 2).map(v => v - 2));
  const cycle = CH_LIST.map((c, i) => i).filter(i => !named.has(i));
  const S0 = window.GARAGE_SPEC && window.GARAGE_SPEC.get && window.GARAGE_SPEC.get();
  const regStr = String((S0 && (S0.reg || (S0.meta && S0.meta.reg))) || '');
  let cyc = 0;
  for (let i = 0; i < regStr.length; i++) cyc = (cyc * 31 + regStr.charCodeAt(i)) >>> 0;
  const charAt = i => {
    const C = window.CAGE_CHAR, c = CH_LIST[i];
    if (!C || !c) return null;
    let rig = null;
    try { rig = C.rig(c.key); } catch (e) { console.warn(e.message); return null; }
    const ready = !!C.ready(c.key);
    if (!ready && !CHAR_WAIT[c.key]) {
      CHAR_WAIT[c.key] = 1;
      C.load(c.key).then(d => {
        CHAR_WAIT[c.key] = 0;
        if (d && window.CAGE_UI && window.CAGE_UI.build) charRebuild();
      });
    }
    return { key: c.key, label: c.label, rig, ready };
  };
  // role: 'pilot' | 'cop' | 'pax' — the seat's own select, or the cycle
  const charFor = role => {
    const v = role === 'pilot' ? whoOf(P.pilotWho)
            : role === 'cop' ? whoOf(P.copWho) : 0;
    if (v === 1) return null;                          // the ATD, by name
    if (v >= 2) return charAt(v - 2);                  // one person, by name
    if (!cycle.length) return null;                    // mixed, nobody left: ATD
    const i = cycle[cyc % cycle.length]; cyc++;
    return charAt(i);
  };
  const dressed = (dum, CH, role, idx) => {
    if (CH && CH.ready) {
      const inst = window.CAGE_CHAR.instance(CH.key);
      if (inst) {
        window.CAGE_CHAR.dress(inst, dum,
          { fist: P.dumFist == null ? 0.5 : +P.dumFist });
        dum.char = inst;
        // THE IDLE (G205): a passenger wears the sitting-idle clip on the
        // upper body (seat, recline and feet stay ours); a pilot only its
        // breathing and glances — the hands are the IK's. Phases differ per
        // seat so a cabin never moves in unison.
        const pax = role === 'pax';
        const amp = pax ? (P.paxIdle == null ? 1 : +P.paxIdle)
                        : (P.dumIdle == null ? 0.5 : +P.dumIdle);
        // the clip spec is kept on the dummy: a LIVE occupant wears the same
        // one in flight, stepped by the game loop instead of the ticker
        dum.animSpec = { key: 'sitidle', mode: pax ? 'body' : 'head', amp,
                         phase: (idx || 1) * 1.7 };
        if (window.CAGE_CHAR.animate && amp > 0)
          window.CAGE_CHAR.animate(inst, dum.animSpec);
      }
    }
    return dum;
  };
  // THE LIVE CREW: who crosses the join as a SKELETON instead of a bake.
  // Policy 'controls' (the default): whoever holds a moving control — the
  // pilot, a co-pilot with dual controls. 'all': everyone with a character.
  // 'none': the G210.2 bake for all. A dev flag, not a design row.
  const LIVE_POLICY = (typeof window !== 'undefined' && window.FLYDIY_CREW_LIVE)
    || 'controls';
  // THE FIST CLOSES ON THE GRIP (G279, the user: "it does not hold the
  // stick right anymore ... the crooked position of its wrist on the
  // throttle"). The grip solve aims the ATD's WRIST at a point `palm` short
  // of the grip along the hand — and the drawn hand is the character's,
  // whose fingers close where ITS arm and hand lengths put them: measured
  // on the stock pilot, 5 cm up the stick from the palm point on the right
  // hand and 4 cm past it on both. So after the rig is dressed, each grip
  // job reads where the fist actually closed (CAGE_CHAR.fistAt), takes the
  // error in the hand's frame, and solves again with the target moved by
  // it; twice, since the arm's new angles shift the rig's wrist a little.
  // The correction rides the job (`fixH`) through the join, so the flown
  // solve — the same function, every frame — lands the same fist on the
  // same grip as the stick moves.
  const fitFists = (dum, CH, jobs, solveJob) => {
    if (!dum.char || !window.CAGE_CHAR.fistAt) return;
    const grips = jobs.filter(j => j.a.userData.grip && CHAINS[j.chain].arm);
    if (!grips.length) return;
    const fp = new THREE.Vector3(), e = new THREE.Vector3(), q = new THREE.Quaternion();
    for (let it = 0; it < 2; it++) {
      let moved = false;
      for (const j of grips) {
        const side = /L$/.test(CHAINS[j.chain].end) ? 'L' : 'R';
        if (!window.CAGE_CHAR.fistAt(dum.char, side, fp)) continue;
        const aw = anchorWorld(j.a);
        dum.bones[CHAINS[j.chain].end].getWorldQuaternion(q).invert();
        e.copy(fp).sub(aw.p).applyQuaternion(q);       // fist - grip, hand frame
        // a hand that could not reach is the IK's finding, not the fit's
        if (e.lengthSq() < 1e-6 || e.length() > 0.15) continue;
        j.fixH = (j.fixH || new THREE.Vector3()).sub(e);
        solveJob(j);
        moved = true;
      }
      if (!moved) break;
      window.CAGE_CHAR.dress(dum.char, dum,
        { fist: P.dumFist == null ? 0.5 : +P.dumFist });
    }
  };
  const markLive = (dum, CH, role, idx, s, jobs, ctx) => {
    if (!dum.char || LIVE_POLICY === 'none') return dum;
    if (LIVE_POLICY !== 'all' && !jobs.some(j => j.ctl)) return dum;
    for (const m of dum.char.meshes) m.userData.live = true;
    dum.live = { key: CH.key, role, idx: idx || 1, s, palm: ctx.palm,
                 fist: P.dumFist == null ? 0.5 : +P.dumFist,
                 anim: dum.animSpec || null,
                 jobs: jobs.filter(j => j.ctl) };
    LIVE_CREW.push(dum);
    return dum;
  };
  const seatDummy = (seat, ST, idx, pose) => {
    const stick = ST && ST.stick, thr = ST && ST.thr, pedals = ST && ST.pedals;
    const role = idx === 1 ? 'pilot' : seat.section ? 'pax' : 'cop';
    const CH = charFor(role);
    // pose.s is stature / the ATD's 1.75; a character scales from ITS height
    const s = CH ? (pose || POSE_PILOT).s * BASE_STATURE / CH.rig.height
                 : (pose || POSE_PILOT).s;
    // the dummy's OWN suit (phase D): one colour of personality each, the
    // second following the first; ATD amber is the walk's last word. G180:
    // TWO suits, not one per body — the pilot's, and everyone else's (the
    // livery declares `dummy1` and `dummy2`; a third name would be nobody's).
    const suit = (typeof window !== 'undefined' && window.CAGE_SECMAT &&
      window.CAGE_SECMAT('dummy' + (idx === 1 ? 1 : 2),
        { surf: 0, fieldM: 1, side: THREE.FrontSide, tint0: 0xd6a11c }))
      || null;
    const dum = makeDummy(group, suit, CH && CH.rig, CH && !CH.ready);
    dum.fig.name = 'edDum' + (idx || 1);
    dum.fig.scale.setScalar(s);
    const SP = seat.SP || sp1;
    const recline = clamp((SP.rake - 7) + (pose || POSE_PILOT).recline, -10, 55);
    applyPose(dum.bones,
              seatedPose(recline, !(stick || thr || pedals), SP.tilt));
    dum.fig.position.set(seat.x,
                         seat.panY + 0.03 + (0.085 + (CH ? CH.rig.hipDrop : 0.02)) * s,
                         seat.zBack + 0.095 * s + 0.02);
    dum.fig.updateMatrixWorld(true);
    // FEET WITHOUT PEDALS (G205, the user: 'sliders for controlling the feet
    // position of the passengers. Something like the pedals for the pilots,
    // but without the actual pedals'): two fixed anchors on the floor of the
    // bay, fore-aft / height / spread from the sliders, the legs IK'd onto
    // them exactly as onto pedals — nothing is drawn.
    const feet = (!pedals && seat.section && +P.paxFeetOn) ? (() => {
      const g = new THREE.Group(); group.add(g);
      const z = seat.zBack + (P.paxFeetZ == null ? 0.55 : +P.paxFeetZ);
      const y = A.floorAt(z) + (+P.paxFeetY || 0) + 0.072 * s;   // ankle over sole
      const hx = P.paxFeetX == null ? 0.14 : +P.paxFeetX;
      return { objL: anchorAt(g, [seat.x + hx, y, z]),
               objR: anchorAt(g, [seat.x - hx, y, z]) };
    })() : null;
    // (no early return any more: hands with nothing to hold REST ON THE
    // KNEES by IK below, so every occupant goes through the solver)
    // HANDS FOLLOW THE GEOMETRY (user 2026-08-19: the dummy crossed its
    // arms when the console moved from beside the seat to between the
    // seats). Each control is asked WHICH SIDE OF THIS SEAT it actually
    // sits on (+x is the occupant's left) and the near hand takes it; a
    // control on the centreline — a centre stick, a yoke — takes
    // whichever hand is left over. Nothing is hard-coded to a style.
    const sideOf = o => {
      if (!o) return null;
      // IN THE LAYER'S FRAME (G279): this compared the anchor's WORLD x with
      // the seat's layer-local x — the same number on a bench with the
      // layer at the origin, and 2.5 m apart in the game's shed, where the
      // mount sits off to one side. Every control then read as "right of
      // the seat", and a centre console was handed to the LEFT hand across
      // the pilot's lap — out of reach, and the fist fit blew up on it.
      const dx = group.worldToLocal(anchorWorld(o).p).x - seat.x;
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
    } else if (feet) {
      jobs.push({ chain: 'legL', a: feet.objL, label: 'L→foot' });
      jobs.push({ chain: 'legR', a: feet.objR, label: 'R→foot' });
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
    const base = seatedPose(recline, false, SP.tilt);
    const ctx = { s, palm: (P.dumHandGrip != null ? P.dumHandGrip : 0.075) * s,
                  elbows: +P.dumElbows || 0, knees: +P.dumKnees || 0,
                  base, notes, poleFig: null };
    const solveJob = j => {
      // WHICH MOVING PART HOLDS THE ANCHOR (live crew): the grip is authored
      // inside the control's own moving group (G240), so the first ancestor
      // the join knows as a ctlMove is the frame the flown hand follows
      let o = j.a.parent;
      while (o && !CTL_MOVING.some(m => m.name === o.name)) o = o.parent;
      j.ctl = o ? o.name : null; j.ctlObj = o || null;
      return solveGripJob(dum, j, ctx);
    };
    for (const j of jobs) solveJob(j);
    // HANDS ON THE KNEES (G205.2, the user: 'their hands are meant at
    // resting on their knees [...] they go through as we have made the feet
    // higher'). A hand with nothing to hold used to rest by FK, on a thigh
    // that the feet sliders have since lifted. Now it is a GRIP JOB like
    // any other, aimed at the knee the leg IK just placed: palm on the top
    // of the thigh just behind the knee, thumb inward and a little forward,
    // the wrist continuing the forearm — so the hands move with the knees
    // whatever the feet do. Second pass because it reads the solved knees.
    if (!stick && !thr) {
      const g = new THREE.Group(); group.add(g);
      group.updateWorldMatrix(true, false);
      const kneeJobs = [];
      for (const sd of ['L', 'R']) {
        const kw = dum.bones['knee' + sd].getWorldPosition(new THREE.Vector3());
        const kl = group.worldToLocal(kw);
        kl.y += 0.05 * s; kl.z -= 0.03 * s;
        const a = gripAt(g, [kl.x, kl.y, kl.z], [sd === 'L' ? -1 : 1, 0, 0.35]);
        kneeJobs.push({ chain: 'arm' + sd, a, label: sd + '→knee' });
      }
      for (const j of kneeJobs) solveJob(j);
      rec.jobs.push(...kneeJobs.map(j => ({ chain: j.chain, label: j.label,
        get wrist() { return j.wrist; } })));
      jobs.push(...kneeJobs);
    }
    dressed(dum, CH, role, idx);
    fitFists(dum, CH, jobs, solveJob);
    return markLive(dum, CH, role, idx, s, jobs, ctx);
  };
  // THE ANCHORS GO OUT WITH IT (G96). The lighting layer needs exactly what
  // this layer spent its life working out — where the floor is, where the
  // coaming lip is, how wide the cabin is at a station — and re-deriving them
  // over there would be a second description of the cabin.
  const DBG = window.CAGE_CREW = { stations: [], panel, floorN, A,
    // G272: the dark under the dash, for the join (craft space, see footwellOf)
    footwell: FOOTWELL,
    // G279: the plate's cut-outs behind the attitude indicators (craft space)
    holes: HOLES,
    // G240: the controls that ANSWER — name, pivot, axis, drive and travel,
    // for the join. Filled as they are drawn, so a station without a stick
    // publishes nothing rather than a part with no geometry.
    moving: CTL_MOVING,
    // LIVE CREW: the dummies that fly as skeletons (see markLive), and the
    // solver the flown side runs on them — the editor's own, not a copy
    live: LIVE_CREW,
    ik: { bareDummy, solveGripJob, anchorWorld, CHAINS },
    // G180: `section` (0 the cockpit, n the n-th bay behind it) and `filled`
    // ride out with each seat — the join reads the capacity, the occupancy
    // and the loading numbers off this one list
    seatsAt: seats.map(s2 => ({ x: s2.x, zBack: s2.zBack, pilot: !!s2.pilot,
                                panY: s2.panY, section: s2.section | 0,
                                filled: !!s2.filled })),
    seats: seats.map(s2 => ({ x: +s2.x.toFixed(3),
      panY: +s2.panY.toFixed(3), h: s2.SP.h, rake: s2.SP.rake,
      tilt: s2.SP.tilt })) };
  const dums = [];
  if (P.dumOn) dums.push(seatDummy(pilot, st1, 1, POSE_PILOT));
  // A BODY IN EVERY FILLED SEAT (G180). `dum2On` used to put one in every seat
  // that was not the pilot's; the sections say who is aboard now, and the
  // join bills exactly the bodies drawn here — what you see is what weighs.
  // The cockpit's second occupant flies from its own station in the pilot's
  // pose; a bay's occupants rest their hands in the passenger pose.
  for (let si = 0; si < seats.length; si++) {
    if (seats[si] === pilot || !seats[si].filled) continue;
    dums.push(seatDummy(seats[si], stn[si], si + 1,
                        seats[si].section ? POSE_PAX : POSE_PILOT));
  }
  {
    const aboard = seats.filter(s2 => s2.filled).length;
    notes.push('aboard ' + aboard + '/' + seats.length);
  }

  // ---- eye point + head clearance (the sizing instruments) ----
  // WORLD -> THE GROUP'S OWN FRAME (G41.2, user: "the eyesight line of
  // the pilot has not been properly rotated like the rest of the
  // plane"). head.matrixWorld includes whatever transform the build is
  // mounted under — identity on the bench pages, the sit/yaw mount in
  // the game editor — so a world point added as a LOCAL child of
  // `group` was transformed twice (the floating line), and the world
  // heights fed cage-frame numbers (eye/head-clr read wrong under the
  // mount). Everything here now converts back through the group's own
  // world matrix: exact everywhere, a no-op standalone. The IK and
  // reach code above needs none of this — it is relative world math,
  // invariant under a rigid mount.
  // THE EYE POINT IS PUBLISHED, NOT JUST DRAWN (G107, the interior view).
  // It was computed only when `dumMarkers` was on and only in order to draw a
  // ball and a sight line — so the one object in the whole build that knows
  // where a pilot's eyes are could not be asked where they are. It is now
  // computed whenever there IS a pilot, in WORLD space because that is the
  // frame a camera lives in, and `dumMarkers` still gates exactly what it
  // always gated: the markers.
  //
  // THE HEADS RIDE ALONG. A camera at the eye point is inside the skull, and
  // the view has no business learning the skeleton to find it — so the layer
  // that built them hands them over.
  if (dums.length) {
    const head = dums[0].bones.head;
    head.updateWorldMatrix(true, false);
    const eyeW = new THREE.Vector3(0, 0.125, 0.082)
      .applyMatrix4(head.matrixWorld);
    const fwdW = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(head.getWorldQuaternion(new THREE.Quaternion()));
    if (typeof window !== 'undefined')
      window.CAGE_CREW_EYE = { p: eyeW.toArray(), fwd: fwdW.toArray(),
                               // a character's head is part of ONE skinned
                               // body (G204): while you look out of it the
                               // whole body is what there is to hide — the
                               // PILOT's only; the co-pilot stays in view
                               heads: dums.flatMap((d, i) => d.char
                                 ? (i === 0 ? d.char.meshes : [])
                                 : [d.bones.head]) };
    if (P.dumMarkers) {
      const eye = group.worldToLocal(eyeW.clone());
      // THE MARKERS ARE NOT CLICKABLE (G210.1, the user: 'the area which
      // triggers a crew selection seems wider than the visual silhouette').
      // A THREE.Line is picked with Raycaster.params.Line.threshold, ONE
      // METRE by default — so this 0.6 m sight line answered every click
      // within a metre of the pilot's head, for the crew. The eye ball too.
      // ...and A MARKER IS NOT THE AEROPLANE (the panel arc, session 4): the
      // join bakes every visible mesh, and this ball flew — a red sphere
      // at the pilot's eye, seen from inside in the cockpit view
      const eyeBall = ballAt(group, M.marker, [eye.x, eye.y, eye.z], 0.015);
      eyeBall.raycast = () => {};
      eyeBall.userData.edMarker = 1;
      const gq = group.getWorldQuaternion(new THREE.Quaternion()).invert();
      const fwd = fwdW.clone().applyQuaternion(gq);
      const lg = new THREE.BufferGeometry().setFromPoints(
        [eye, eye.clone().addScaledVector(fwd, 0.6)]);
      const sight = new THREE.Line(lg, new THREE.LineBasicMaterial(
        { color: 0xff4d3d, transparent: true, opacity: 0.55 }));
      sight.raycast = () => {};
      group.add(sight);
      const crown = group.worldToLocal(new THREE.Vector3(0, 0.245, 0)
        .applyMatrix4(head.matrixWorld));
      const seatFloor = A.floorAt(pilot.zBack + 0.20);
      notes.unshift('eye +' + (eye.y - seatFloor).toFixed(2) + ' fl',
                    'head clr ' + (A.roofY - crown.y).toFixed(2));
    }
  } else if (typeof window !== 'undefined') window.CAGE_CREW_EYE = null;
  // cabin height at the pilot station — the number the dummy judges
  {
    const fl = A.floorAt(pilot.zBack + 0.20);
    notes.unshift('cabin h ' + (A.roofY - fl).toFixed(2));
  }
  // THE PANEL REPORTS WHAT IT COULD NOT FIT, rather than quietly dropping it.
  // An aeroplane whose cabin is too narrow for the panel it bought is a design
  // problem, and the bench is where a design problem is supposed to show.
  if (panel) {
    notes.push('panel ' + panel.fit + ' ' + panel.n + ' instr' +
      (panel.overflow ? ' (' + panel.overflow + ' DID NOT FIT)' : ''));
    if (floorN) notes.push('floor ' + floorN + ' boards');
  }
  if (stat && notes.length)
    stat.textContent += '  ·  crew: ' + notes.join(' · ');
};
})();
