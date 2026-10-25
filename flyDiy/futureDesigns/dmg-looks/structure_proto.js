// DMG-LOOKS brief 2 prototype (node only, nothing in src/ touched): STRUCTURE BY MATERIAL.
//
// THE MEMBER POOL. A drawn frame member in the flown snapshot has rings only every ~14 cm (median 7 rings a metre,
// measured: structure_cost.txt) - no vertex where a hinge, a crimp or a splinter would go. So a bent or broken member is
// drawn from a SLOT of a pool: one parked mesh of canonical members, made and linked at roll-out (ground_scar.js's rule:
// no program link in a crash), each slot a member's worth of vertices whose rings CLUSTER round the slot's event station.
// At a break event a slot is given its member (its two nodes, rest length, section, material, state) and the snapshot's
// own triangles of that member are collapsed (skin_break's index collapse, as today). Each frame the pool's vertex shader
// places every vertex from (its canonical coordinates, the slot's state, the two nodes' live positions - the node texture
// DMG-SKINGPU already uploads): no CPU a frame. The functions below ARE that vertex shader, in JS (the mirror rule of
// skin_break.rideMirror / skin_gpu RIDE_VS): every vertex depends only on (s, around / strip index, slot state, A, B).
//
//   steel tube  (4130, tubeFabric)  bends at a PLASTIC HINGE and keeps its length: two legs, a short rounded crease, the
//               tube ovalised there (flattened in the bend plane); broken after a large bend: each stub keeps its bend,
//               its end NECKED and TORN (a jagged end ring), never a flat cut
//   alloy frame (2024 / 6061 sections, alloy)  buckles LOCALLY: a short wave of 2-3 crimps in the flanges that absorbs the
//               chord it lost; broken: a JAGGED tear zig-zagging between the rivet holes of its rivet line, lips curled,
//               a bare-alloy rim and the grey primer band (the user's ruling, 25 Oct)
//   wood        (spruce, ply webs)  stays STRAIGHT (elastic) until it breaks: a full break is a comb of SLIVERS along the
//               grain, 3-6 x the section depth, uneven, a lengthwise SPLIT running back, raw wood at the fracture; a
//               GREENSTICK hangs bent at the crack with the tension side split; a CRUSH (compression) is a kink band
//
//   node structure_proto.js   -> steel_cage.png, alloy_frames.png, wood_members.png (labelled; Chromium for the labels),
//                                the cost per slot and the event's CPU (printed, and in structure_cost.txt)
'use strict';
const fs = require('fs'), path = require('path'), R3 = require('./raster3d.js'), N = require('./noise.js');
const OUT = __dirname;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]), nrm = a => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---- THE SLOT BUDGET (vertices a slot; the pictures are drawn at exactly this resolution) ----
const BUDGET = { tube: { rings: 18, around: 8 }, alloy: { rings: 24, across: 10 }, wood: { rings: 22, strips: 8 } };
// rings clustered round the event station z (0..1): half of them inside +-zone (fraction of the member), the rest spread
function ringStations(n, z, zone) {
  const s = [];
  for (let i = 0; i < n; i++) { const u = i / (n - 1);
    const k = 2 * u - 1, w = Math.sign(k) * Math.pow(Math.abs(k), 2.2);          // dense at k = 0
    let v = z + w * (w < 0 ? z : 1 - z); v = (1 - 0.35) * v + 0.35 * u;           // keep some even spread
    s.push(Math.max(0, Math.min(1, v))); }
  s.sort((a, b) => a - b); s[0] = 0; s[n - 1] = 1;
  void zone; return s;
}

// ---- A CENTRELINE: straight, or two legs with a rounded crease at kt1 (the plastic hinge), arc length kept ----
function centreline(A, B, L0, st) {
  const c = len(sub(B, A)), u = nrm(sub(B, A));
  if (!st.bend || c >= L0 * 0.9995) return { at: s => add(A, mul(u, s * c)), tan: () => u, H: null, u };
  const kt1 = st.kt1, a = kt1 * L0, b = (1 - kt1) * L0, x = (a * a - b * b + c * c) / (2 * c), h = Math.sqrt(Math.max(a * a - x * x, 0));
  const dir = nrm(sub(st.dir, mul(u, dot(st.dir, u)))), H = add(add(A, mul(u, x)), mul(dir, h));
  const d1 = nrm(sub(H, A)), d2 = nrm(sub(B, H)), rc = Math.min(st.rc, 0.45 * Math.min(a, b));
  const P1 = sub(H, mul(d1, rc)), P2 = add(H, mul(d2, rc));
  const pts = []; const M = 240;
  for (let i = 0; i <= M; i++) { const t = i / M;          // A -> P1, the crease (a quadratic through H), P2 -> B
    let p; const l1 = a - rc, l2 = b - rc, lc = 2 * rc, T = l1 + lc + l2, q = t * T;
    if (q <= l1) p = add(A, mul(d1, q)); else if (q <= l1 + lc) { const w = (q - l1) / lc; p = add(add(mul(P1, (1 - w) * (1 - w)), mul(H, 2 * w * (1 - w))), mul(P2, w * w)); }
    else p = add(P2, mul(d2, q - l1 - lc)); pts.push(p); }
  const cum = [0]; for (let i = 1; i <= M; i++) cum.push(cum[i - 1] + len(sub(pts[i], pts[i - 1])));
  const at = s => { const q = s * cum[M]; let i = 1; while (i < M && cum[i] < q) i++; const w = (q - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return add(mul(pts[i - 1], 1 - w), mul(pts[i], w)); };
  const tan = s => nrm(sub(at(Math.min(1, s + 0.002)), at(Math.max(0, s - 0.002))));
  return { at, tan, H, u, dir, d1, d2 };
}
function frameAt(CL, s, ref) { const T = CL.tan(s); let Nn = sub(ref, mul(T, dot(ref, T))); if (len(Nn) < 1e-6) Nn = Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; Nn = nrm(sub(Nn, mul(T, dot(Nn, T)))); return { T, N: Nn, B: cross(T, Nn) }; }
const quad = (out, a, b, c, d, col, back, spec) => { out.push({ p: [a, b, c], col, back, spec }, { p: [a, c, d], col, back, spec }); };

// ================= STEEL TUBE =================
// st: { r, L0, A, B, bend, kt1, dir, rc, broken: { tb, side: 'A'|'B'|'both', seed }, today }
const STEEL = { paint: [0.47, 0.52, 0.47], inside: [0.16, 0.16, 0.16], bare: [0.78, 0.79, 0.80] };
function steelTube(st, out) {
  const { rings, around } = BUDGET.tube, r = st.r;
  if (st.today) {        // TODAY: straight between the live nodes (telescoped); broken: split at mid-span, flat open ends
    const parts = st.broken ? [[0, 0.5], [0.5, 1]] : [[0, 1]];
    for (const [s0, s1] of parts) { const off = st.broken && s0 > 0 ? st.part : [0, 0, 0];
      const CL = centreline(add(st.A, off), add(st.B, off), st.L0, { bend: false }); tubeRings(CL, [s0, s1], r, around, 4, null, out, null, null); }
    return;
  }
  const CL = centreline(st.A, st.B, st.L0, st);
  const ang = CL.H ? Math.acos(Math.max(-1, Math.min(1, dot(CL.d1, CL.d2)))) : 0, sev = Math.min(1, ang / 1.2);
  const ov = s => !CL.H ? 0 : sev * Math.exp(-((((s - st.kt1) * st.L0) / (1.8 * r)) ** 2));           // ovalisation at the crease
  if (!st.broken) { tubeRings(CL, [0, 1], r, around, rings, st, out, s => ov(s)); return; }
  // BROKEN after a large bend: the crack opened at the crease. Each stub keeps its own leg and a lip of the crease,
  // necked (the radius down 40 % over the last 1.5 r) and torn (the end station jagged round the tube, seeded)
  const tb = st.kt1, lip = 0.9 * r / st.L0;
  for (const side of ['A', 'B']) {
    const s0 = side === 'A' ? 0 : tb - lip, s1 = side === 'A' ? tb + lip : 1, off = side === 'B' ? st.part : [0, 0, 0];
    const CL2 = { at: s => add(CL.at(s), off), tan: CL.tan, H: CL.H, d1: CL.d1, d2: CL.d2 };
    const endS = side === 'A' ? s1 : s0;
    const jag = k => (N.h1(k, st.seed + (side === 'A' ? 0 : 77)) * 2 - 1) * 0.9 * r / st.L0;
    tubeRings(CL2, [s0, s1], r, around, Math.round(rings * 0.6), st, out, s => ov(s), (s, k) => {
      const e = Math.abs(s - endS) * st.L0;                                             // distance to the torn end (m)
      return 1 - 0.4 * (1 - smooth(0, 1.5 * r, e));                                     // the neck
    }, { endS, jag, side });
  }
}
// rings along [s0, s1]: radius r, ovalised by ov(s) in the bend plane; neck(s) scales the radius; tear: jagged end
function tubeRings(CL, [s0, s1], r, around, nR, st, out, ov, neck, tear) {
  const z = st && st.kt1 != null ? (st.kt1 - s0) / (s1 - s0) : 0.5, S = ringStations(nR, Math.max(0.02, Math.min(0.98, z)), 0.2).map(v => s0 + v * (s1 - s0));
  const ref = CL.H ? sub(CL.H, CL.at(0.5 * (s0 + s1))) : [0, 1, 0], refN = len(ref) > 1e-6 ? ref : [0, 1, 0];
  const ring = (s, k) => {
    let ss = s;
    if (tear) { const j = tear.jag(k); ss = tear.side === 'A' ? Math.min(s, tear.endS + j) : Math.max(s, tear.endS + j); }   // past the jagged end: collapsed
    const F = frameAt(CL, ss, refN), th = k / around * Math.PI * 2, o = ov ? ov(ss) : 0, nk = neck ? neck(ss, k) : 1;
    const cn = Math.cos(th), sn = Math.sin(th);
    const crease = o > 0 && cn > 0.6 ? -0.25 * o * (cn - 0.6) / 0.4 : 0;                // the inside of the crease pushed in
    return add(CL.at(ss), add(mul(F.N, r * nk * ((1 - 0.38 * o) * cn + crease)), mul(F.B, r * nk * (1 + 0.2 * o) * sn)));
  };
  for (let i = 0; i + 1 < S.length; i++) for (let k = 0; k < around; k++) {
    const k2 = (k + 1) % around, a = ring(S[i], k), b = ring(S[i], k2), c = ring(S[i + 1], k2), d = ring(S[i + 1], k);
    const e = tear ? Math.min(Math.abs(S[i] - tear.endS), Math.abs(S[i + 1] - tear.endS)) * (st ? st.L0 : 1) : 1;
    const col = tear && e < 0.6 * r ? STEEL.bare : STEEL.paint;
    quad(out, a, b, c, d, col, STEEL.inside, col === STEEL.bare ? 0.35 : 0.12);
  }
}

// ================= ALLOY ANGLE SECTION (a stringer / a former's flange) =================
const ALU = { primer: [0.62, 0.63, 0.64], bare: [0.84, 0.86, 0.88], inside: [0.55, 0.56, 0.57], hole: [0.12, 0.12, 0.13] };
function alloyAngle(st, out, dots) {
  const { rings, across } = BUDGET.alloy, w = st.w, half = across / 2, L0 = st.L0;
  const c = len(sub(st.B, st.A)), u = nrm(sub(st.B, st.A));
  const F = (() => { let n = sub(st.up, mul(u, dot(st.up, u))); n = nrm(n); return { N: n, B: cross(u, n) }; })();
  // the cross-section: leg 1 along N (d 0..w), leg 2 along B; each point's out-of-plane normal (the other axis)
  const sec = j => j < half ? { d: (half - 1 - j) / (half - 1) * w, along: F.N, out: F.B, leg: 0 } : { d: (j - half) / (half - 1) * w, along: F.B, out: F.N, leg: 1 };
  const delta = st.today ? 0 : Math.max(0, L0 - c), lam = 2.2 * w, nW = 2.5, Lz = nW * lam;
  const A = delta > 0 ? Math.min(0.6 * w, (lam / Math.PI) * Math.sqrt(delta / Lz)) : 0;
  const z0 = st.kt1 * L0 - Lz / 2;
  const P = (s, j, part) => {
    const q = sec(j); let x = s * L0;
    if (st.today) x = s * c;                                                            // today: telescoped
    else if (delta > 0) x = s * L0 - delta * smooth(z0, z0 + Lz, s * L0);              // the zone takes the shortening
    let p = add(add(st.A, mul(u, x)), mul(q.along, q.d));
    if (!st.today && A > 0) { const zz = s * L0 - z0, win = Math.sin(Math.PI * Math.max(0, Math.min(1, zz / Lz))) ** 2;
      const wave = Math.sin(2 * Math.PI * zz / lam + (q.leg ? Math.PI / 2 : 0)) * win;
      p = add(p, mul(q.out, A * wave * (0.2 + 0.8 * q.d / w))); }
    if (part === 'B' && st.part) p = add(p, st.part);
    return p;
  };
  if (!st.broken) { const S = ringStations(rings, st.kt1 || 0.5, 0.3); strips(S, P, null, out, across, half, st); return; }
  // BROKEN: today split at mid-span, flat; proposed: the tear runs along the rivet line's holes, zig-zag between them
  const tb = st.tb, pitch = st.pitch;
  const cutAt = (j) => { if (st.today) return 0.5; const q = sec(j); const zig = ((Math.floor(q.d / 0.007) + q.leg) % 2 ? 1 : -1) * 0.45 * pitch;
    return tb + (zig + 0.25 * pitch * (N.h1(j, st.seed) * 2 - 1)) / L0; };
  for (const part of ['A', 'B']) {
    const S = ringStations(rings, part === 'A' ? 0.92 : 0.08, 0.2).map(v => part === 'A' ? v * (tb + 0.04) : (tb - 0.04) + v * (1 - tb + 0.04));
    strips(S, (s, j) => P(part === 'A' ? Math.min(s, cutAt(j)) : Math.max(s, cutAt(j)), j, part), (s, j) => Math.abs(s - cutAt(j)) * L0, out, across, half, st, part);
  }
  // rivet heads along leg 1's middle (pitch); at the tear the holes are torn open
  for (let x = pitch / 2; x < L0; x += pitch) { const s = x / L0, torn = st.broken && !st.today && Math.abs(s - tb) * L0 < 0.6 * pitch;
    const part = s < (st.broken ? (st.today ? 0.5 : tb) : 2) ? 'A' : 'B';
    dots.push({ p: P(s, Math.round(half / 2), part), col: torn ? ALU.hole : [0.45, 0.46, 0.47], r: torn ? 3 : 2.2 }); }
}
function strips(S, P, edgeD, out, across, half, st, part) {
  for (let i = 0; i + 1 < S.length; i++) for (let j = 0; j + 1 < across; j++) {
    if (j === half - 1) continue;                                                       // the heel: legs 0..half-1 and half..
    const a = P(S[i], j, part), b = P(S[i], j + 1, part), c = P(S[i + 1], j + 1, part), d = P(S[i + 1], j, part);
    let col = ALU.primer; if (edgeD && !st.today) { const e = Math.min(edgeD(S[i], j), edgeD(S[i + 1], j)); if (e < 0.004) col = ALU.bare; }
    quad(out, a, b, c, d, col, ALU.inside, col === ALU.bare ? 0.4 : 0.1);
  }
  // the heel corner joins leg 1's first point and leg 2's first point
  for (let i = 0; i + 1 < S.length; i++) { const a = P(S[i], half - 1, part), b = P(S[i], half, part), c = P(S[i + 1], half, part), d = P(S[i + 1], half - 1, part); quad(out, a, b, c, d, ALU.primer, ALU.inside, 0.1); }
}

// ================= WOOD (a spruce longeron / spar cap, rectangular) =================
const WOOD = { face: [0.80, 0.62, 0.38], grain: [0.66, 0.47, 0.27], raw: [0.93, 0.80, 0.58], end: [0.85, 0.68, 0.45], dark: [0.25, 0.18, 0.10] };
// st: { A, B, L0, b, h, mode: 'rest'|'today'|'break'|'greenstick'|'crush', tb, ang, seed, part }
function woodBeam(st, out) {
  const { rings, strips: NS } = BUDGET.wood, L0 = st.L0, u = nrm(sub(st.B, st.A)), up = nrm(sub(st.up, mul(u, dot(st.up, u)))), sd = cross(u, up);
  const per = NS / 4;                                                                   // strips a face
  // strip k: face f = floor(k / per), across a0..a1 on that face; corner points in the (sd, up) section plane
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => [x * st.b / 2, y * st.h / 2]);
  const secPt = (f, t) => { const a = corners[f], b = corners[(f + 1) % 4]; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
  const place = (s, x, y, part) => { let p = add(add(add(st.A, mul(u, s * (st.today ? len(sub(st.B, st.A)) / L0 : 1) * L0)), mul(sd, x)), mul(up, y));
    if (part === 'B') { if (st.mode === 'greenstick' && !st.today) p = rotAbout(p, add(add(st.A, mul(u, st.tb * L0)), mul(up, -st.h / 2)), sd, st.ang); else if (st.part) p = add(p, st.part); }
    if (st.mode === 'crush' && !st.today) { const z = s * L0 - st.tb * L0, band = 1.4 * st.h, k = smooth(-band / 2 + y * 0.8, band / 2 + y * 0.8, z);   // a kink band inclined across the depth
      p = add(p, add(mul(up, 0.35 * st.h * Math.sin(Math.PI * k)), mul(u, -st.crush * k))); }
    return p; };
  const faceCol = (s, f, t) => (Math.floor((t * 7 + f * 3 + N.v1(s * L0 * 40, f) * 1.5)) % 3 === 0 ? WOOD.grain : WOOD.face);
  if (st.mode === 'rest' || st.mode === 'crush' || st.today && !st.broken) {
    const S = ringStations(rings, st.tb || 0.5, 0.2);
    for (let k = 0; k < NS; k++) { const f = Math.floor(k / per), t0 = (k % per) / per, t1 = (k % per + 1) / per;
      for (let i = 0; i + 1 < S.length; i++) { const p0 = secPt(f, t0), p1 = secPt(f, t1);
        quad(out, place(S[i], p0[0], p0[1]), place(S[i + 1], p0[0], p0[1]), place(S[i + 1], p1[0], p1[1]), place(S[i], p1[0], p1[1]), faceCol(S[i], f, t0), WOOD.raw, 0.05); } }
    return;
  }
  // BROKEN (today: a flat cut at mid-span) / BREAK (slivers + a split) / GREENSTICK (the tension face split, hanging bent)
  const tb = st.today ? 0.5 : st.tb, depth = Math.max(st.b, st.h);
  for (const part of ['A', 'B']) for (let k = 0; k < NS; k++) {
    const f = Math.floor(k / per), t0 = (k % per) / per, t1 = (k % per + 1) / per, tens = f === 2;          // face 2: the top, the tension side
    let ext = 0;                                                                         // the strip's reach past the break (m)
    if (!st.today) {
      if (st.mode === 'break') ext = depth * (3 + 3 * N.h1(k + (part === 'B' ? 31 : 0), st.seed)) * (N.h1(k * 7 + (part === 'B' ? 5 : 0), st.seed + 1) < 0.35 ? 0.25 : 1);
      else ext = tens ? depth * 1.5 * N.h1(k + (part === 'B' ? 31 : 0), st.seed) : 0.0;  // greenstick: short pull-outs on the tension face
    }
    const sgn = part === 'A' ? 1 : -1, sEnd = tb + sgn * ext / L0 - (st.mode === 'greenstick' && !tens && !st.today ? 0 : 0);
    const S = ringStations(Math.round(rings * 0.7), part === 'A' ? 0.85 : 0.15, 0.2).map(v => part === 'A' ? v * sEnd : sEnd + v * (1 - sEnd));
    const taper = s => { const e = Math.abs(s - sEnd) * L0; return st.today || ext < 1e-4 ? 1 : 0.3 + 0.7 * smooth(0, 0.45 * ext, e); };
    // greenstick: the compression side is not broken - its strips run on through the hinge (drawn on A, folded on B)
    for (let i = 0; i + 1 < S.length; i++) {
      const p0 = secPt(f, t0), p1 = secPt(f, t1), mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
      const tp = (s, p) => { const tt = taper(s); return [mid[0] + (p[0] - mid[0]) * tt, mid[1] + (p[1] - mid[1]) * tt]; };
      const lift = s => (!st.today && st.mode === 'break' ? 0.004 * smooth(0, 1, 1 - Math.abs(s - sEnd) * L0 / Math.max(ext, 1e-3)) : 0);
      const q0a = tp(S[i], p0), q1a = tp(S[i], p1), q0b = tp(S[i + 1], p0), q1b = tp(S[i + 1], p1);
      const off = (s, q) => { const n = [q[0] - 0, q[1] - 0], nl = Math.hypot(n[0], n[1]) || 1; return [q[0] + n[0] / nl * lift(s), q[1] + n[1] / nl * lift(s)]; };
      const A0 = off(S[i], q0a), A1 = off(S[i], q1a), B0 = off(S[i + 1], q0b), B1 = off(S[i + 1], q1b);
      // the lengthwise split: on face 1 (the side), between its strips, running back 5 x depth from the break, opened 2 mm
      const nearB = Math.abs(S[i] - tb) * L0, split = !st.today && st.mode === 'break' && f === 1 && nearB < 5 * depth;
      const gap = split ? 0.0012 * (k % per === 0 ? -1 : 1) * (1 - nearB / (5 * depth)) : 0;
      const g = (q) => [q[0] + (f === 1 ? 0 : 0), q[1] + gap];
      const exposed = !st.today && Math.abs(S[i] - sEnd) * L0 < Math.max(ext, 0.005) + 0.004;
      const col = exposed && st.mode === 'break' ? (N.h1(i + k * 13, st.seed) > 0.5 ? WOOD.raw : WOOD.face) : faceCol(S[i], f, t0);
      quad(out, place(S[i], ...g(A0), part), place(S[i + 1], ...g(B0), part), place(S[i + 1], ...g(B1), part), place(S[i], ...g(A1), part), split && nearB < 0.004 ? WOOD.dark : col, WOOD.raw, 0.05);
    }
    // the strip's end grain (raw), drawn as a small cap at its tip
    const pe0 = secPt(f, t0), pe1 = secPt(f, t1), m = [(pe0[0] + pe1[0]) / 2 * 0.6, (pe0[1] + pe1[1]) / 2 * 0.6];
    if (!st.today || true) quad(out, place(sEnd, pe0[0] * (ext > 1e-4 && !st.today ? 0.3 : 1), pe0[1] * (ext > 1e-4 && !st.today ? 0.3 : 1), part), place(sEnd, pe1[0] * (ext > 1e-4 && !st.today ? 0.3 : 1), pe1[1] * (ext > 1e-4 && !st.today ? 0.3 : 1), part), place(sEnd, m[0], m[1], part), place(sEnd, m[0], m[1], part), st.today ? WOOD.end : WOOD.raw, WOOD.raw, 0.02);
  }
}
function rotAbout(p, o, ax, a) { const v = sub(p, o), c = Math.cos(a), s = Math.sin(a), k = nrm(ax);
  return add(o, add(add(mul(v, c), mul(cross(k, v), s)), mul(k, dot(k, v) * (1 - c)))); }

// ================= THE SHEETS =================
const BG = [0.12, 0.13, 0.15];
function panel(W, H, V, build) { const C = R3.Canvas(W, H, BG), tris = [], dots = []; build(tris, dots); R3.draw(C, V, tris); for (const d of dots) R3.dot(C, V, d.p, d.r, d.col); return { C, ntris: tris.length }; }
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function sheet(name, title, cols, rows, W, H, cells, notes) {
  title = esc(title); cols = cols.map(esc); rows = rows.map(r => r.map(x => x && esc(x))); notes = notes && esc(notes);
  // cells[row][col] -> PNG path; labels + layout in an SVG, then a Chromium screenshot to PNG (labels need a font)
  const pad = 26, head = 44;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols.length * (W + 10) + 170}" height="${head + rows.length * (H + pad) + 30}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#1b1d21"/>`;
  svg += `<text x="12" y="26" fill="#eee" font-size="18" font-weight="bold">${title}</text>`;
  cols.forEach((c, i) => { svg += `<text x="${170 + i * (W + 10) + 6}" y="${head + 4}" fill="#bbb" font-size="14">${c}</text>`; });
  rows.forEach((r, j) => { const y = head + 12 + j * (H + pad);
    svg += `<text x="12" y="${y + 20}" fill="#ddd" font-size="14">${r[0]}</text>`; if (r[1]) svg += `<text x="12" y="${y + 40}" fill="#999" font-size="11">${r[1]}</text>`;
    if (r[2]) svg += `<text x="12" y="${y + 56}" fill="#999" font-size="11">${r[2]}</text>`;
    cells[j].forEach((png, i) => { const b64 = fs.readFileSync(png).toString('base64'); svg += `<image x="${170 + i * (W + 10)}" y="${y}" width="${W}" height="${H}" href="data:image/png;base64,${b64}"/>`; }); });
  if (notes) svg += `<text x="12" y="${head + rows.length * (H + pad) + 18}" fill="#888" font-size="11">${notes}</text>`;
  svg += '</svg>';
  const sp = path.join(OUT, '_' + name + '.svg'); fs.writeFileSync(sp, svg); return sp;
}
async function shoot(svgs) {
  let pw; try { pw = require('playwright'); } catch (e) { console.log('(no playwright: the labelled sheets are left as SVG)'); return; }
  const b = await pw.chromium.launch(); const p = await b.newPage();
  for (const [svgPath, png] of svgs) { const s = fs.readFileSync(svgPath, 'utf8'), w = +s.match(/width="(\d+)"/)[1], h = +s.match(/height="(\d+)"/)[1];
    await p.setViewportSize({ width: w, height: h }); await p.goto('file://' + svgPath); await p.screenshot({ path: png }); fs.unlinkSync(svgPath); }
  await b.close();
}
const tmp = n => path.join(OUT, '_p_' + n + '.png');
function save(C, n) { const f = tmp(n); R3.save(C, f); return f; }

function steelSheet() {
  const W = 420, H = 250, cells = [];
  // ROW 1: a Cub cage bay side (Warren): longerons, uprights, diagonals - the crash state from the census's ranges
  const bayNodes = [[0, 0, 0], [0.55, 0, 0], [1.1, 0, 0], [0, 0.62, 0], [0.55, 0.62, 0], [1.1, 0.62, 0]];
  const bayBeams = [[0, 1], [1, 2], [3, 4], [4, 5], [0, 3], [1, 4], [2, 5], [0, 4], [4, 2]];
  const live = bayNodes.map(p => p.slice());
  live[0] = [0.07, 0.02, 0.0]; live[3] = [0.035, 0.6, 0]; live[1] = [0.57, 0.05, 0.03];      // the nose end pushed aft, the lower bay crushed
  // states per member: lower front longeron folded by a trunk (bend), the front upright kinked (3 %), the front diagonal broken after a fold
  const state = { '0,1': { bend: true, kt1: 0.55, dir: [0, 1, 0.25] }, '0,3': { bend: true, kt1: 0.45, dir: [-1, 0, 0.3] }, '0,4': { bend: true, kt1: 0.5, dir: [0.3, -1, 0.2], broken: true } };
  const V = { yaw: -0.38, pitch: 0.22, scale: 330, ox: 40, oy: 222, cx: 0, cy: 0, cz: 0 };
  const bay = (mode) => panel(W, H, V, (tris, dots) => {
    const P = mode === 'rest' ? bayNodes : live;
    bayBeams.forEach(([a, b]) => { const key = a + ',' + b, s = state[key] || {}, L0 = len(sub(bayNodes[b], bayNodes[a]));
      const st = Object.assign({ r: 0.0095, L0, A: P[a], B: P[b], rc: 0.03, seed: a * 7 + b, part: [0.03, -0.035, 0.02] }, mode === 'rest' ? {} : s, { today: mode === 'today' });
      if (mode !== 'rest' && st.broken && mode !== 'today') st.broken = { tb: st.kt1 };
      if (mode === 'today' && s.broken) st.broken = true;
      if (mode === 'rest') { st.bend = false; st.broken = false; }
      steelTube(st, tris); });
    P.forEach(p => dots.push({ p, col: [0.85, 0.85, 0.85], r: 3 })); });
  const r1 = ['rest', 'today', 'proposed'].map(m => save(bay(m).C, 'steel_bay_' + m));
  cells.push(r1);
  // ROW 2: close-up - one 0.55 m tube folded 70 deg at a trunk (the census's median fold at a break: 73 deg), not broken
  const V2 = { yaw: -0.45, pitch: 0.3, scale: 780, ox: 205, oy: 150, cx: 0.27, cy: 0.07, cz: 0 };
  const L0 = 0.55, A = [0, 0, 0];
  const fold = (ang) => { const c = L0 * Math.cos(ang / 2) * 0.98; return [c, 0, 0]; };
  const closeA = mode => panel(W, H, V2, tris => { const B = mode === 'rest' ? [L0, 0, 0] : fold(1.2);
    steelTube({ r: 0.0095, L0, A, B, rc: 0.025, kt1: 0.5, dir: [0, 1, 0.15], bend: mode === 'proposed', today: mode === 'today', seed: 3 }, tris); });
  cells.push(['rest', 'today', 'proposed'].map(m => save(closeA(m).C, 'steel_fold_' + m)));
  // ROW 3: close-up - the same tube TORN after the fold (the solver's 'fold' break past thf)
  const V3 = { yaw: -0.45, pitch: 0.3, scale: 1500, ox: 210, oy: 125, cx: 0.22, cy: 0.15, cz: 0.02 };
  const closeB = mode => panel(W, H, mode === 'proposed' ? V3 : V2, tris => { const B = mode === 'rest' ? [L0, 0, 0] : fold(1.25);
    steelTube({ r: 0.0095, L0, A, B, rc: 0.025, kt1: 0.5, dir: [0, 1, 0.15], bend: mode === 'proposed', today: mode === 'today', seed: 5,
      broken: mode === 'rest' ? false : (mode === 'today' ? true : { tb: 0.5 }), part: [0.04, -0.03, 0.03] }, tris); });
  cells.push(['rest', 'today', 'proposed'].map(m => save(closeB(m).C, 'steel_torn_' + m)));
  return sheet('steel', 'STEEL TUBE CAGE (the Cub, 4130): bends at a plastic hinge, length kept; torn only after a large bend',
    ['rest', 'today (as drawn now)', 'proposed (the pool slot)'],
    [['cage bay, crashed', 'longeron folded, upright', 'kinked 3 %, diagonal torn'], ['one tube folded 70 deg', 'not broken (dk, kt1, dN)', 'crease + ovalised'], ['torn after the fold', "the solver's 'fold' break", 'necked, jagged, bent stubs (zoom)']],
    W, H, cells, 'Drawn at the slot budget: 18 rings x 8 around a member (288 triangles), rings clustered at the hinge. Today: the chord telescopes; a break splits at mid-span with flat open ends.');
}

function alloySheet() {
  const W = 420, H = 230, cells = [], L0 = 0.5, w = 0.022;
  const V = { yaw: -0.55, pitch: 0.42, scale: 1300, ox: 200, oy: 115, cx: 0.25, cy: 0, cz: 0 };
  const mk = (mode, st0) => panel(W, H, V, (tris, dots) => alloyAngle(Object.assign({ L0, w, A: [0, 0, 0], up: [0, 1, 0], kt1: 0.48, seed: 9, pitch: 0.022 }, st0, { today: mode === 'today' }), tris, dots));
  // ROW 1: a stringer crushed 4 % (the census: alloy set to -10 % on the metal Cessna's 30 m/s trunk; the kink at 3 %)
  cells.push(['rest', 'today', 'proposed'].map(m => save(mk(m, { B: m === 'rest' ? [L0, 0, 0] : [L0 * 0.96, 0, 0] }).C, 'alu_buckle_' + m)));
  // ROW 2: torn at its rivet line
  cells.push(['rest', 'today', 'proposed'].map(m => save(mk(m, { B: [L0, 0, 0], broken: m !== 'rest', tb: 0.52, part: m === 'rest' ? null : [0.035, -0.02, 0.012] }).C, 'alu_tear_' + m)));
  return sheet('alloy', 'ALLOY FRAMES (the metal Cessna, 2024 sections): local buckling in crimps; torn jagged along the rivet line',
    ['rest', 'today (as drawn now)', 'proposed (the pool slot)'],
    [['stringer / flange crushed 4 %', 'set < 0 (L0 vs Lr), kt1', '2.5 crimps take the chord'], ['broken', "'tension' / 'kink' / a fitting", 'zig-zag through the holes, bare rim']],
    W, H, cells, 'Grey primer (the user, 25 Oct). Slot budget: 24 rings x 10 across (an angle section, 432 triangles), rings clustered at the event. Rivet pitch 22 mm.');
}

function woodSheet() {
  const W = 420, H = 210, cells = [], L0 = 0.6;
  const V = { yaw: -0.55, pitch: 0.35, scale: 1250, ox: 200, oy: 110, cx: 0.32, cy: 0, cz: 0 };
  const mk = (mode, st0) => panel(W, H, V, tris => woodBeam(Object.assign({ L0, b: 0.02, h: 0.025, A: [0, 0, 0], B: [L0, 0, 0], up: [0, 1, 0], tb: 0.5, seed: 4, mode: mode === 'rest' ? 'rest' : st0.mode }, st0, { mode: mode === 'rest' ? 'rest' : st0.mode, today: mode === 'today' }), tris));
  cells.push(['rest', 'today', 'proposed'].map(m => save(mk(m, { mode: 'break', broken: true, part: [0.16, -0.045, 0.03] }).C, 'wood_break_' + m)));
  cells.push(['rest', 'today', 'proposed'].map(m => save(mk(m, { mode: 'greenstick', broken: false, ang: -0.32, B: m === 'today' ? [L0 * Math.cos(0.16), 0, 0] : [L0, 0, 0] }).C, 'wood_green_' + m)));
  cells.push(['rest', 'today', 'proposed'].map(m => save(mk(m, { mode: 'crush', crush: 0.018, B: m === 'today' ? [L0 - 0.018, 0, 0] : [L0, 0, 0] }).C, 'wood_crush_' + m)));
  return sheet('wood', 'WOOD (the Jodel: spruce longerons, spar caps, pillars): straight until it breaks, then it breaks like wood',
    ['rest', 'today (as drawn now)', 'proposed (the pool slot)'],
    [['full break', "'ragged' / 'tension' / 'fold' past thf", 'slivers 3-6 x depth, a split'], ['greenstick', 'dk > 0 and not broken', 'tension face split, bent'], ['crush (compression)', "'kink' (ec at 3 %)", 'a kink band, still one piece']],
    W, H, cells, 'Slot budget: 22 rings x 8 strips (2 a face) plus the strips\' end grain (~370 triangles). Raw wood at the fracture (P2 substrate).');
}

// ================= THE COST =================
function cost() {
  const lines = [];
  const count = fn => { const t = []; fn(t, []); return t.length; };
  const tube = count(t => steelTube({ r: 0.01, L0: 0.55, A: [0, 0, 0], B: [0.5, 0, 0], rc: 0.025, kt1: 0.5, dir: [0, 1, 0], bend: true, seed: 1 }, t));
  const tubeB = count(t => steelTube({ r: 0.01, L0: 0.55, A: [0, 0, 0], B: [0.5, 0, 0], rc: 0.025, kt1: 0.5, dir: [0, 1, 0], bend: true, seed: 1, broken: { tb: 0.5 }, part: [0, 0, 0] }, t));
  const alu = count((t, d) => alloyAngle({ L0: 0.5, w: 0.022, A: [0, 0, 0], B: [0.48, 0, 0], up: [0, 1, 0], kt1: 0.5, seed: 1, pitch: 0.022 }, t, d));
  const aluB = count((t, d) => alloyAngle({ L0: 0.5, w: 0.022, A: [0, 0, 0], B: [0.5, 0, 0], up: [0, 1, 0], kt1: 0.5, seed: 1, pitch: 0.022, broken: true, tb: 0.5, part: [0, 0, 0] }, t, []));
  const wood = count(t => woodBeam({ L0: 0.6, b: 0.02, h: 0.025, A: [0, 0, 0], B: [0.6, 0, 0], up: [0, 1, 0], tb: 0.5, seed: 1, mode: 'break', broken: true, part: [0, 0, 0] }, t));
  lines.push('TRIANGLES A POOL SLOT (as drawn here; the GPU slot is the same mesh):');
  lines.push(`  steel tube bent ${tube}, torn (two stubs) ${tubeB}`);
  lines.push(`  alloy angle buckled ${alu}, torn ${aluB}`);
  lines.push(`  wood broken (slivers + end grain) ${wood}`);
  // THE EVENT: what the CPU does per member at a break event = the slot's state (a few dozen floats). Measured here as the
  // CPU MIRROR building every triangle (an upper bound: the GPU does the vertex work), 10 broken + 30 bent members
  const mk = i => ({ r: 0.0095, L0: 0.5 + 0.01 * (i % 7), A: [0, 0, 0], B: [0.47, 0.02, 0], rc: 0.025, kt1: 0.4 + 0.02 * (i % 10), dir: [0, 1, 0.2], bend: true, seed: i });
  const t0 = process.hrtime.bigint(); let n = 0;
  for (let rep = 0; rep < 5; rep++) { for (let i = 0; i < 30; i++) { const t = []; steelTube(mk(i), t); n += t.length; } for (let i = 0; i < 10; i++) { const t = []; steelTube(Object.assign(mk(i), { broken: { tb: 0.5 }, part: [0, 0, 0] }), t); n += t.length; } }
  const msMirror = Number(process.hrtime.bigint() - t0) / 1e6 / 5;
  const t1 = process.hrtime.bigint();
  for (let rep = 0; rep < 1000; rep++) for (let i = 0; i < 40; i++) { const s = mk(i); const c = len(sub(s.B, s.A)); const a = s.kt1 * s.L0, b = (1 - s.kt1) * s.L0; const x = (a * a - b * b + c * c) / (2 * c); void Math.sqrt(Math.max(a * a - x * x, 0)); }
  const msState = Number(process.hrtime.bigint() - t1) / 1e6 / 1000;
  lines.push('THE EVENT (10 broken + 30 bent steel members):');
  lines.push(`  the slots' state only (what the event really computes): ${(msState * 1000).toFixed(1)} us`);
  lines.push(`  the CPU mirror building every vertex (upper bound, not done in the game): ${msMirror.toFixed(1)} ms for ${(n / 5) | 0} triangles`);
  return lines.join('\n');
}

(async () => {
  const svgs = [[steelSheet(), path.join(OUT, 'steel_cage.png')], [alloySheet(), path.join(OUT, 'alloy_frames.png')], [woodSheet(), path.join(OUT, 'wood_members.png')]];
  await shoot(svgs);
  for (const f of fs.readdirSync(OUT)) if (f.startsWith('_p_')) fs.unlinkSync(path.join(OUT, f));
  const c = cost(); console.log(c); fs.writeFileSync(path.join(OUT, 'structure_cost_proto.txt'), c + '\n');
  console.log('wrote steel_cage.png, alloy_frames.png, wood_members.png');
})();
