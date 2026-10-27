// DMG-LOOKS PORT KIT: THE ALLOY FRAME SLOT FOR THE MEMBER POOL - crimps, then a kink; the tear through the rivet line.
// The prototype is futureDesigns/dmg-looks/alloy_proto.js (pictures: alloy_slot.png); this is it as the pool will run it:
//   - a CANONICAL slot mesh (made once, at roll-out): every vertex carries (k, sx, sy, leg, d, u, nx, ny) - k in [-1, 1]
//     the ring's place in the clustered layout (the VS maps it to a station round the slot's event), sx / sy the section
//     point (the cage's metalAngle: two prisms, w x T), leg 0 riveted / 1 outstanding, d its distance from the heel,
//     u the developed coordinate (-d on the riveted leg, +d on the outstanding one), nx / ny its face's normal in the
//     section (each plate's four corners are real edges - a sheet's cut edge, its faces: a corner is carried TWICE, once
//     a face, so the edge is hard; nothing else is);
//   - SMOOTH NORMALS (the user, 27 Oct: "no flat shading on any deformed or damaged part - it looks bad and looks like a
//     bench"): the pose returns each vertex's normal ON THE DEFORMED SHAPE - its section normal with the component along
//     the shape's local length tangent taken out, the tangent over its NEIGHBOURING RINGS (the same vertex posed at the
//     rings either side: what the drawn mesh itself can show - a tangent over a millimetre found the lobes' true slope,
//     which 6 mm rings cannot draw, and lit them against their silhouette), so the crimps' lobes, the kink and the curled
//     lips shade as they bend; rings share their vertices along the slot, so the only hard edges are the plates' real
//     corners and the tear;
//   - a SLOT STATE (made at the event, a few floats): slotState(o) -> Float32Array(STATE_N);
//   - the VERTEX POSE and the FRAGMENT colour, as JS (the mirror: poseJS / fragJS) and as GLSL (GLSL_POSE / GLSL_FRAG,
//     functions only - the pool's own shader calls them), the same recipe line for line. GATE: port/check_port.js runs the
//     GLSL in a real WebGL2 (headless Chromium) and holds it to the mirror.
// Physics (alloy_proto.js's header): folds of half-length H = H_K (w^2 t)^(1/3), a fold eats EFF x 2H, 1-3 folds then a
// kink; the crack through the net section into hole k, linked up along the rivet row to hole k+1, the outstanding leg
// sheared on a slant; holes on the crack elongated (bearing), rivets kept on the piece still riveted to the skin.
// PURE: no THREE, no DOM. window.DMG_LOOKS_ALLOY in the page, module.exports in node.
(function () {
  'use strict';
  const NZ = typeof DMG_LOOKS_NOISE !== 'undefined' ? DMG_LOOKS_NOISE : require('./dmg_looks_noise.js');
  const DEF = { w: 0.030, T: 0.005, t: 0.0012, rivetD: 0.0032, pitch: 0.022, rivetAt: 0.55, H_K: 1.0, EFF: 0.73 };
  const RINGS = [4, 12, 4];                  // rings: before the zone, in it, after it (k -1..-0.5, -0.5..0.5, 0.5..1)
  // ---- the canonical mesh: 2 prisms x 10-point loops (each face's own points: a corner twice), RINGS rings; Float32
  // attributes (stride 8) + a Uint16 index over the faces only (no quad across a corner: 6 a loop, as before) ----
  // the canonical k step between a ring and the next round k (the layout's: 4 rings over k -1..-0.5, 12 over -0.5..0.5, 4 over 0.5..1)
  const ringDk = k => (k < -0.5 || k > 0.5 ? 0.5 / RINGS[0] : 1 / RINGS[1]);
  function canon(o) {
    o = Object.assign({}, DEF, o);
    const { w, T } = o;
    // a face: its points and its normal; a loop: its faces in turn (counter-clockwise in (X, Y))
    const face = (pts, n, leg) => pts.map(([x, y]) => [x, y, leg, leg ? y : x, leg ? y : -x, n[0], n[1]]);
    const loops = [
      [face([[0, 0], [w / 2, 0], [w, 0]], [0, -1], 0), face([[w, 0], [w, T]], [1, 0], 0), face([[w, T], [w / 2, T], [0, T]], [0, 1], 0), face([[0, T], [0, 0]], [-1, 0], 0)],
      [face([[0, 0], [T, 0]], [0, -1], 1), face([[T, 0], [T, w / 2], [T, w]], [1, 0], 1), face([[T, w], [0, w]], [0, 1], 1), face([[0, w], [0, w / 2], [0, 0]], [-1, 0], 1)]];
    const ks = []; const [n0, n1, n2] = RINGS;
    for (let i = 0; i < n0; i++) ks.push(-1 + 0.5 * i / n0);
    for (let i = 0; i < n1; i++) ks.push(-0.5 + i / n1);
    for (let i = 0; i <= n2; i++) ks.push(0.5 + 0.5 * i / n2);
    const per = loops.reduce((a, L) => a + L.reduce((b2, F) => b2 + F.length, 0), 0);   // (20 a ring)
    const nv = ks.length * per, A = new Float32Array(nv * 8), idx = [];
    let v = 0;
    for (const k of ks) for (const L of loops) for (const F of L) for (const p of F) { A.set([k, p[0], p[1], p[2], p[3], p[4], p[5], p[6]], v * 8); v++; }
    for (let r = 0; r + 1 < ks.length; r++) { let o2 = 0;
      for (const L of loops) for (const F of L) { for (let j = 0; j + 1 < F.length; j++) {
        const a = r * per + o2 + j, b = a + 1, c = a + per, d = b + per; idx.push(a, d, b, a, c, d); } o2 += F.length; } }   // (OUTWARD: the face's normal; the 26 Oct index wound inward)
    return { attr: A, stride: 8, nv, index: Uint16Array.from(idx), ntri: idx.length / 3, rings: ks.length, perRing: per };
  }
  // ---- the slot state: mode 0 crushed, 1 torn piece A, 2 torn piece B ----
  // o: { mode, L0, kt1 (crush) | tb (tear, 0..1), seed, w, t }
  const STATE_N = 16;
  function slotState(o) {
    o = Object.assign({}, DEF, o);
    const H = o.H_K * Math.cbrt(o.w * o.w * o.t), df = o.EFF * 2 * H, S = new Float32Array(STATE_N);
    S[0] = o.mode; S[1] = o.L0; S[2] = H; S[3] = df; S[4] = o.w; S[5] = o.seed | 0;
    if (o.mode === 0) { S[6] = o.kt1; S[7] = 0; }
    else {
      // the tear's parameters (alloy_proto.js tearOf): hole k, the link-up, the slant; its coarse bounds
      const r = mulberry(o.seed | 0), k = Math.max(1, Math.round(o.tb * o.L0 / o.pitch - 0.5)), xk = (k + 0.5) * o.pitch, link = r() < 0.7, xk1 = link ? xk + o.pitch : xk;
      const slant = (r() < 0.5 ? -1 : 1) * Math.tan(0.6);
      S[6] = o.tb; S[7] = k; S[8] = link ? 1 : 0; S[9] = slant; S[10] = o.pitch; S[11] = o.rivetAt;
      let lo = Infinity, hi = -Infinity; for (let i = 0; i <= 40; i++) { const u = -o.w + 2 * o.w * i / 40, c = cutJS(S, u); lo = Math.min(lo, c); hi = Math.max(hi, c); }
      S[12] = lo - 0.002; S[13] = hi + 0.002; S[14] = xk; S[15] = xk1;
    }
    return S;
  }
  function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // the crack's station at u (m)
  function cutJS(S, u) {
    const w = S[4], seed = S[5] | 0, ur = -S[11] * w, xk = (S[7] + 0.5) * S[10], xk1 = S[8] > 0.5 ? xk + S[10] : xk;
    if (u < ur) return xk + 0.0012 * NZ.fbm1(u * 300, seed, 3);
    if (u <= 0) return xk1 + 0.0012 * NZ.fbm1(u * 300, seed + 1, 3);
    return xk1 + u * S[9] + 0.0015 * NZ.fbm1(u * 250, seed + 2, 3);
  }
  // the station of a ring (the clustered layout round the event; zone half zh)
  function stationJS(S, k) {
    const L0 = S[1], H = S[2];
    let z, zh;
    if (S[0] < 0.5) { const nF = 3; z = S[6] * L0; zh = 3.5 * H; void nF; } else { z = 0.5 * (S[12] + S[13]); zh = 0.5 * (S[13] - S[12]) + 0.01; }
    z = Math.min(Math.max(z, zh), L0 - zh);
    if (k < -0.5) return (k + 1) * 2 * (z - zh);
    if (k <= 0.5) return z - zh + (k + 0.5) * 2 * zh;
    return z + zh + (k - 0.5) * 2 * (L0 - z - zh);
  }
  // ---- THE POSE (the VS): the vertex a at station xs - [x, y, z] world, the station used, the frame's U / X / Y ----
  // a: [k, sx, sy, leg, d, u, nx, ny]; A, B: the live nodes; up: the section's up (unit); S: the slot state
  function atJS(a, S, A, B, up, xs) {
    const [, sx, sy, leg, d, u] = a, L0 = S[1], H = S[2], df = S[3], w = S[4], mode = S[0];
    const BA = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], c = Math.hypot(...BA), U = BA.map(q => q / c);
    let Y = [up[0] - U[0] * (up[0] * U[0] + up[1] * U[1] + up[2] * U[2]), up[1] - U[1] * (up[0] * U[0] + up[1] * U[1] + up[2] * U[2]), up[2] - U[2] * (up[0] * U[0] + up[1] * U[1] + up[2] * U[2])];
    const yl = Math.hypot(...Y); Y = Y.map(q => q / yl);
    const X = [U[1] * Y[2] - U[2] * Y[1], U[2] * Y[0] - U[0] * Y[2], U[0] * Y[1] - U[1] * Y[0]];
    let x = xs, lx = 0, ly = 0, along, P;
    if (mode < 0.5) {
      const delta = Math.max(0, L0 - c), nF = Math.min(3, Math.ceil(delta / df - 1e-6)), dg = Math.max(0, delta - 3 * df);
      along = x;
      for (let i = 0; i < 3; i++) { if (i >= nF) break;
        const ci = S[6] * L0 + (i === 1 ? 2 * H : i === 2 ? -2 * H : 0), phi = Math.max(0, Math.min(1, (delta - i * df) / df)), z = x - ci;
        along -= phi * df * smooth(-H, H, z);
        if (Math.abs(z) < H) { const amp = H * Math.sin(phi * Math.PI / 2) * Math.sin(Math.PI * (z + H) / (2 * H)) * (i === 1 ? -1 : 1), kk = 0.15 + 0.85 * d / w;
          if (leg < 0.5) ly += amp * kk; else lx += amp * kk; } }
      if (dg > 0) { const Le = c + dg, a1 = S[6] * Le, b1 = Le - a1, xx = (a1 * a1 - b1 * b1 + c * c) / (2 * c), hh = Math.sqrt(Math.max(a1 * a1 - xx * xx, 0)), t = along / Le;
        const Hn = [A[0] + U[0] * xx - Y[0] * hh, A[1] + U[1] * xx - Y[1] * hh, A[2] + U[2] * xx - Y[2] * hh];
        P = t <= S[6] ? [0, 1, 2].map(j => A[j] + (Hn[j] - A[j]) * t / S[6]) : [0, 1, 2].map(j => Hn[j] + (B[j] - Hn[j]) * (t - S[6]) / (1 - S[6])); }
      else P = [0, 1, 2].map(j => A[j] + U[j] * along);
    } else {
      // torn: piece A keeps x <= its bound, piece B x >= (past the bound: collapsed onto it); the lips curl within 5 mm
      x = mode < 1.5 ? Math.min(x, S[13]) : Math.max(x, S[12]);
      const dc = Math.abs(x - cutJS(S, u)), lip = dc < 0.005 ? 0.5 * 0.005 * (1 - dc / 0.005) * (mode < 1.5 ? 1 : -1) : 0;
      if (leg < 0.5) ly += lip; else lx += lip;
      P = [0, 1, 2].map(j => A[j] + U[j] * x * c / L0);
    }
    return { pos: [0, 1, 2].map(j => P[j] + X[j] * (sx + lx) + Y[j] * (sy + ly)), x, U, X, Y };
  }
  // the vertex posed (its station from its ring) and its SMOOTH normal on the deformed shape: n0 = X nx + Y ny less its
  // component along the length tangent t = at(the next ring's station) - at(the last one's) (k clamped to [-1, 1]; a slot
  // collapsed there: n0 as is)
  function poseJS(a, S, A, B, up) {
    const x0 = stationJS(S, a[0]), r = atJS(a, S, A, B, up, x0), dk = ringDk(a[0]);
    const p1 = atJS(a, S, A, B, up, stationJS(S, Math.min(1, a[0] + dk))).pos, p0 = atJS(a, S, A, B, up, stationJS(S, Math.max(-1, a[0] - dk))).pos, t = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const n0 = [0, 1, 2].map(j => r.X[j] * (a[6] || 0) + r.Y[j] * (a[7] || 0)), tl2 = t[0] * t[0] + t[1] * t[1] + t[2] * t[2];
    let n = n0; if (tl2 > 1e-14) { const dt = (n0[0] * t[0] + n0[1] * t[1] + n0[2] * t[2]) / tl2; n = [n0[0] - t[0] * dt, n0[1] - t[1] * dt, n0[2] - t[2] * dt]; }
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    // (fold: the shape runs BACK along the slot there - a crimp's fold closed over itself; crease: the shape turns over 30 deg
    // between the ring before and the ring after (the kink's apex). Both real creases: the mesh's own normals break there)
    const tb = [r.pos[0] - p0[0], r.pos[1] - p0[1], r.pos[2] - p0[2]], tf = [p1[0] - r.pos[0], p1[1] - r.pos[1], p1[2] - r.pos[2]], lb = Math.hypot(...tb), lf = Math.hypot(...tf);
    const crease = lb > 1e-9 && lf > 1e-9 && (tb[0] * tf[0] + tb[1] * tf[1] + tb[2] * tf[2]) / (lb * lf) < Math.cos(30 * Math.PI / 180);
    return { pos: r.pos, x: r.x, nrm: [n[0] / nl, n[1] / nl, n[2] / nl], fold: t[0] * r.U[0] + t[1] * r.U[1] + t[2] * r.U[2] <= 0, crease };
  }
  // ---- THE FRAGMENT: [r, g, b, keep] (keep 0 = discard). x the station attribute, u, flatR (1 on a wide face of the
  // riveted leg), front (the face's side). Grey primer (the user, 25 Oct), bare alloy at the crack / round torn holes ----
  const COL = { primer: [0.62, 0.63, 0.64], bare: [0.86, 0.88, 0.90], fracture: [0.55, 0.56, 0.58], rivet: [0.70, 0.71, 0.72] };
  function fragJS(x, u, flatR, front, S) {
    const mode = S[0]; if (mode < 0.5) return [...(front ? COL.primer : COL.fracture), 1];
    const c = cutJS(S, u); if (mode < 1.5 ? x > c : x < c) return [0, 0, 0, 0];
    if (flatR > 0.5) { const R = DEF.rivetD / 2 * 1.1, ur = -S[11] * S[4], k = S[7] | 0, link = S[8] > 0.5, xk = S[14], xk1 = S[15];
      for (let j = k - 3; j <= k + 4; j++) { if (j < 0) continue; const hx = (j + 0.5) * S[10], on = j === k || (link && j === k + 1), near = Math.abs(hx - 0.5 * (xk + xk1)) < 2.2 * S[10];
        const el = on ? 1.9 : near ? 1.25 : 1, dx = (x - hx) / (R * el), du = (u - ur) / R, rr = dx * dx + du * du;
        const kept = !(on && mode > 1.5) && !(on && mode < 1.5 && hx > c);
        if (rr < 1) return kept ? [...COL.rivet, 1] : [0, 0, 0, 0];
        if (rr < 1.6 && el > 1) return [...COL.bare, 1]; } }
    if (!front) return [...COL.fracture, 1];
    return Math.abs(x - c) < 0.0025 ? [...COL.bare, 1] : [...COL.primer, 1];
  }
  // ---- GLSL: the same, for the pool's shader. State as two arrays: uniform float dlS[16] (or texels) ----
  const GLSL_COMMON = [
    'float dlSmooth(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }',
    'float dlCut(float S[16], float u) {',
    '  float w = S[4]; int seed = int(S[5]); float ur = -S[11] * w; float xk = (S[7] + 0.5) * S[10]; float xk1 = S[8] > 0.5 ? xk + S[10] : xk;',
    '  if (u < ur) return xk + 0.0012 * dlFbm1(u * 300.0, seed);',
    '  if (u <= 0.0) return xk1 + 0.0012 * dlFbm1(u * 300.0, seed + 1);',
    '  return xk1 + u * S[9] + 0.0015 * dlFbm1(u * 250.0, seed + 2);',
    '}',
    'float dlStation(float S[16], float k) {',
    '  float L0 = S[1]; float H = S[2]; float z; float zh;',
    '  if (S[0] < 0.5) { z = S[6] * L0; zh = 3.5 * H; } else { z = 0.5 * (S[12] + S[13]); zh = 0.5 * (S[13] - S[12]) + 0.01; }',
    '  z = min(max(z, zh), L0 - zh);',
    '  if (k < -0.5) return (k + 1.0) * 2.0 * (z - zh);',
    '  if (k <= 0.5) return z - zh + (k + 0.5) * 2.0 * zh;',
    '  return z + zh + (k - 0.5) * 2.0 * (L0 - z - zh);',
    '}',
  ].join('\n');
  const GLSL_POSE = [
    '// a = (k, sx, sy, leg, d, u); the vertex at station x0: returns the world position; xOut the station (the fragment attribute)',
    'vec3 dlAlloyAt(float a[6], float S[16], vec3 A, vec3 B, vec3 up, float x0, out float xOut) {',
    '  float sx = a[1], sy = a[2], leg = a[3], d = a[4], u = a[5];',
    '  float L0 = S[1], H = S[2], df = S[3], w = S[4], mode = S[0];',
    '  vec3 BA = B - A; float c = length(BA); vec3 U = BA / c;',
    '  vec3 Y = normalize(up - U * dot(up, U)); vec3 X = cross(U, Y);',
    '  float x = x0, lx = 0.0, ly = 0.0; vec3 P;',
    '  if (mode < 0.5) {',
    '    float delta = max(0.0, L0 - c); int nF = int(min(3.0, ceil(delta / df - 1e-6))); float dg = max(0.0, delta - 3.0 * df);',
    '    float along = x;',
    '    for (int i = 0; i < 3; i++) { if (i >= nF) break;',
    '      float ci = S[6] * L0 + (i == 1 ? 2.0 * H : (i == 2 ? -2.0 * H : 0.0));',
    '      float phi = clamp((delta - float(i) * df) / df, 0.0, 1.0), z = x - ci;',
    '      along -= phi * df * dlSmooth(-H, H, z);',
    '      if (abs(z) < H) { float amp = H * sin(phi * 1.5707963) * sin(3.1415927 * (z + H) / (2.0 * H)) * (i == 1 ? -1.0 : 1.0); float kk = 0.15 + 0.85 * d / w;',
    '        if (leg < 0.5) ly += amp * kk; else lx += amp * kk; } }',
    '    if (dg > 0.0) { float Le = c + dg, a1 = S[6] * Le, b1 = Le - a1, xx = (a1 * a1 - b1 * b1 + c * c) / (2.0 * c), hh = sqrt(max(a1 * a1 - xx * xx, 0.0)), t = along / Le;',
    '      vec3 Hn = A + U * xx - Y * hh;',
    '      P = t <= S[6] ? A + (Hn - A) * (t / S[6]) : Hn + (B - Hn) * ((t - S[6]) / (1.0 - S[6])); }',
    '    else P = A + U * along;',
    '  } else {',
    '    x = mode < 1.5 ? min(x, S[13]) : max(x, S[12]);',
    '    float dc = abs(x - dlCut(S, u)); float lip = dc < 0.005 ? 0.5 * 0.005 * (1.0 - dc / 0.005) * (mode < 1.5 ? 1.0 : -1.0) : 0.0;',
    '    if (leg < 0.5) ly += lip; else lx += lip;',
    '    P = A + U * (x * c / L0);',
    '  }',
    '  xOut = x;',
    '  return P + X * (sx + lx) + Y * (sy + ly);',
    '}',
    'vec3 dlAlloyPose(float a[6], float S[16], vec3 A, vec3 B, vec3 up, out float xOut) { return dlAlloyAt(a, S, A, B, up, dlStation(S, a[0]), xOut); }',
    '// the SMOOTH normal on the deformed shape (poseJS\'s): n2 the face normal in the section (nx, ny)',
    'vec3 dlAlloyNormal(float a[6], vec2 n2, float S[16], vec3 A, vec3 B, vec3 up) {',
    '  float x0 = dlStation(S, a[0]), xq; vec3 U = normalize(B - A); vec3 Y = normalize(up - U * dot(up, U)); vec3 X = cross(U, Y);',
    '  float dk = (a[0] < -0.5 || a[0] > 0.5) ? ' + (0.5 / RINGS[0]).toFixed(6) + ' : ' + (1 / RINGS[1]).toFixed(6) + ';',
    '  vec3 t = dlAlloyAt(a, S, A, B, up, dlStation(S, min(1.0, a[0] + dk)), xq) - dlAlloyAt(a, S, A, B, up, dlStation(S, max(-1.0, a[0] - dk)), xq);',
    '  vec3 n = X * n2.x + Y * n2.y; float tl2 = dot(t, t); if (tl2 > 1e-14) n -= t * (dot(n, t) / tl2);',
    '  return normalize(n);',
    '}',
  ].join('\n');
  const GLSL_FRAG = [
    '// returns (rgb, keep): keep 0.0 = discard',
    'vec4 dlAlloyFrag(float x, float u, float flatR, bool front, float S[16]) {',
    '  vec3 primer = vec3(0.62, 0.63, 0.64), bare = vec3(0.86, 0.88, 0.90), fracture = vec3(0.55, 0.56, 0.58), rivet = vec3(0.70, 0.71, 0.72);',
    '  float mode = S[0]; if (mode < 0.5) return vec4(front ? primer : fracture, 1.0);',
    '  float c = dlCut(S, u); if (mode < 1.5 ? x > c : x < c) return vec4(0.0);',
    '  if (flatR > 0.5) { float R = ' + (DEF.rivetD / 2 * 1.1).toFixed(6) + ', ur = -S[11] * S[4]; int k = int(S[7]); bool link = S[8] > 0.5; float xk = S[14], xk1 = S[15];',
    '    for (int jj = 0; jj < 8; jj++) { int j = k - 3 + jj; if (j < 0) continue; float hx = (float(j) + 0.5) * S[10];',
    '      bool on = j == k || (link && j == k + 1); bool near = abs(hx - 0.5 * (xk + xk1)) < 2.2 * S[10];',
    '      float el = on ? 1.9 : (near ? 1.25 : 1.0), dx = (x - hx) / (R * el), du = (u - ur) / R, rr = dx * dx + du * du;',
    '      bool kept = !(on && mode > 1.5) && !(on && mode < 1.5 && hx > c);',
    '      if (rr < 1.0) return kept ? vec4(rivet, 1.0) : vec4(0.0);',
    '      if (rr < 1.6 && el > 1.0) return vec4(bare, 1.0); } }',
    '  if (!front) return vec4(fracture, 1.0);',
    '  return abs(x - c) < 0.0025 ? vec4(bare, 1.0) : vec4(primer, 1.0);',
    '}',
  ].join('\n');
  const API = { DEF, RINGS, STATE_N, ringDk, canon, slotState, cutJS, stationJS, atJS, poseJS, fragJS, GLSL: NZ.GLSL + '\n' + GLSL_COMMON + '\n' + GLSL_POSE + '\n' + GLSL_FRAG };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.DMG_LOOKS_ALLOY = API;
})();
