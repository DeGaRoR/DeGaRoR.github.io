// G3623 (DMG-GLASS): THE IMPACT MARK ON THE GLAZING - the user, 27 Oct: "never seen an impact mark on glass".
// Until now a pane either stood whole or left the wreck whole (wreck_debris.js: a crushed carrying set throws it off as
// a body); nothing in between, never a crack. This is the in-between: a STAR of cracks at the point of the pane where
// the airframe hit it, drawn by the glass's own shader (aeroskin.js AEROGLASS_HOOK, the crack block) - so it shades as
// the glass does: under the same light, on the same pane, with the same reflection taken off where it is crazed.
//
// THE MATERIAL (study DMG-LOOKS §2.5, crack_proto.js): light aircraft glazing is cast or stretched ACRYLIC - brittle
// (notched Charpy ~2 kJ/m2), it cracks in a few long RADIAL lines with concentric ARCS and a CRAZED white core round
// the hit, and its cracks SCATTER light: on the real thing they read silver-white against the sky, never dark. The
// glass here is an ADD pass (blend ONE, ONE: it can only add light), which is exactly that: the crack's lines and its
// haze add the light the pane receives (its irradiance) as a near-white diffuse scatter, and roughen the clear coat
// there so the reflection breaks up along them. No hole is cut (the pane cannot remove what is behind it; a pane that
// fails leaves as a debris body, as before).
//
// THE HIT EVENTS (what the damage hop already carries: the page's damage state D - its broken members and each
// member's permanent set): the frame round and near the glazing is what hits it in a crash. When a member whose rest
// midpoint lies within R_NEAR of a pane yields (|set| >= SET_LIGHT) or breaks, the pane takes a crack at its point
// nearest that member, its severity from how far the member went (SET_LIGHT -> a short light star, SET_HARD (the 3 %
// kink) -> a full star with arcs; broken -> the full star with a crazed core). Marks never shrink or move until the
// aeroplane is healed (a reset, a new flight); nearby marks on one pane merge (MERGE); MAX the strongest are drawn.
// No crazing from a hard landing (the user's ruling, 25 Oct): a landing that bends no frame member marks no pane.
//
// THE FRAME: everything here is in ONE frame of the caller's choosing - the page passes CRAFT space (aeroskin.js's
// uCraftInv: the frame the glass shader's vCraftPos lives in, from each vertex's REST place - so a mark stays on its
// pane while the wreck rides); the node gate passes the design frame. impacts() never mixes frames.
//
// THE SHADER SIDE: aeroskin.js carries the GLSL (the glass hook compiles at roll-out, before any lazy chunk); its block
// is GLSL_CRACK below, textually (GATE DMGGLASS holds the two equal) - crackJS is its mirror, line for line, and the
// gate runs the GLSL in a real WebGL2 against it. The uniforms are the aeroplane-wide block's (aeroSharedU: uCrackN,
// uCrackP[4], uCrackQ[4]) - one set for the page: a mark is gated to fragments within its reach of its point in craft
// space and facing its normal, so no other aeroplane's glass (parked, in the shed: metres away in this frame) shows it.
// PURE: no THREE, no DOM. window.DMG_GLASS in the page, module.exports in node.
(function () {
  'use strict';
  const R_NEAR = 0.35;        // m: a member this near a pane (its rest midpoint to the pane's nearest point) can mark it
  const SET_LIGHT = 0.003;    // |set| from which a member marks its pane (0.3 %: well past any elastic flex - FAR 23.473
                              // reads 0.13-0.21 of yield on the validated builds - and never reached by a hard landing)
  const SET_HARD = 0.03;      // the full star (the solver's 3 % kink)
  const MERGE = 0.12;         // m: two marks on one pane nearer than this are one (the stronger, at its own point)
  const MAX = 4;              // marks drawn (the uniform arrays' length)
  const TAU = Math.PI * 2;

  // ---- severity of a member's state: 0 (none) .. 1 ----
  function severity(set, broken) {
    if (broken) return 1;
    const a = Math.abs(set || 0); if (a < SET_LIGHT) return 0;
    return 0.15 + 0.7 * Math.min(1, (a - SET_LIGHT) / (SET_HARD - SET_LIGHT));
  }
  // ---- the panes: points (xyz), their normals and pane ids, in the caller's frame ----
  // P: { pts: Float32Array 3n, nrm: Float32Array 3n, pane: Int32Array n }; M: [{ bi, mid: [x, y, z] }] the candidate
  // members' rest midpoints (members() below makes them: every member within R_NEAR of a pane, once)
  function members(P, mids, rNear) {
    const out = [], rr = rNear == null ? R_NEAR : rNear;   // (rNear: GATE DMGGLASS's selftest only)
    for (const m of mids) { const h = nearest(P, m.mid); if (h && h.d <= rr) out.push({ bi: m.bi, mid: m.mid, k: h.k }); }
    return out;
  }
  function nearest(P, x) {
    const n = P.pane.length; let best = -1, bd = Infinity;
    for (let k = 0; k < n; k++) { const dx = P.pts[k * 3] - x[0], dy = P.pts[k * 3 + 1] - x[1], dz = P.pts[k * 3 + 2] - x[2], d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = k; } }
    return best < 0 ? null : { k: best, d: Math.sqrt(bd) };
  }
  // ---- THE MARKS for a damage state: D { set: Float32Array, broken: Uint8Array } (the page's simViewDmgState);
  // prev: the marks so far (they never shrink or move). Returns the marks, the strongest first, at most MAX ----
  function impacts(P, M, D, prev) {
    const list = (prev || []).map(m => Object.assign({}, m));
    for (const m of M) {
      const s = severity(D.set ? D.set[m.bi] : 0, D.broken ? D.broken[m.bi] : 0); if (!s) continue;
      const k = m.k, p = [P.pts[k * 3], P.pts[k * 3 + 1], P.pts[k * 3 + 2]], pane = P.pane[k];
      let hit = null;
      for (const q of list) if (q.pane === pane && Math.hypot(q.p[0] - p[0], q.p[1] - p[1], q.p[2] - p[2]) < MERGE) { hit = q; break; }
      if (hit) { if (s > hit.sev) hit.sev = s; continue; }
      const nl = Math.hypot(P.nrm[k * 3], P.nrm[k * 3 + 1], P.nrm[k * 3 + 2]) || 1;
      list.push({ p, n: [P.nrm[k * 3] / nl, P.nrm[k * 3 + 1] / nl, P.nrm[k * 3 + 2] / nl], sev: s, seed: 7919 + m.bi * 131, pane, bi: m.bi });
    }
    list.sort((a, b) => b.sev - a.sev);   // (stable: of equal ones the earlier stay - a mark drawn is not displaced by a later equal one)
    return list.slice(0, MAX);
  }
  // ---- into the shader's uniforms (aeroSharedU: uCrackN { value }, uCrackP / uCrackQ { value: [Vector4 x MAX] }) ----
  function pack(U, marks) {
    if (!U || !U.uCrackP) return 0;
    const n = Math.min(MAX, marks ? marks.length : 0);
    for (let i = 0; i < MAX; i++) {
      const m = i < n ? marks[i] : null;
      if (m) { U.uCrackP.value[i].set(m.p[0], m.p[1], m.p[2], m.sev); U.uCrackQ.value[i].set(m.n[0], m.n[1], m.n[2], m.seed); }
      else { U.uCrackP.value[i].set(0, 0, 0, 0); U.uCrackQ.value[i].set(0, 0, 1, 0); }
    }
    U.uCrackN.value = n;
    return n;
  }

  // ---- THE CRACK MASK, the shader's mirror (GLSL_CRACK) line for line: p2 the fragment's place on the pane round the
  // mark (m, in the mark's tangent plane), sev 0..1, seed, px the metres a pixel spans there (the shader's fwidth: a
  // line narrower than a pixel is drawn a pixel wide at its own share of the pixel - it fades, never fattens) ->
  // [line, haze], each 0..1 ----
  function u32(x) { return x >>> 0; }
  function h1(i, seed) { let x = u32(Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(seed | 0, 0x165667b1)); x ^= x >>> 15; x = u32(Math.imul(x, 0x85ebca6b)); x ^= x >>> 13; x = u32(Math.imul(x, 0xc2b2ae35)); x ^= x >>> 16; return u32(x) / 4294967296; }
  function h2(i, j, seed) { return h1(Math.imul(i | 0, 73856093) ^ Math.imul(j | 0, 19349663), seed); }
  function v1(x, seed) { const fi = Math.floor(x), i = fi, f = x - fi, s = f * f * (3 - 2 * f), a = h1(i, seed); return a + (h1(i + 1, seed) - a) * s; }
  function fbm1(x, seed) { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < 3; o++) { s += a * (v1(x * f, seed + o * 31) * 2 - 1); n += a; a *= 0.5; f *= 2.03; } return s / n; }
  function sm(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  // a thin line's coverage: its own half-width w, drawn at least a pixel wide (pw) and dimmed to its share
  function lineCov(dist, w, pw) { const we = Math.max(w, pw); return (1 - sm(we * 0.5, we, dist)) * (w / we); }
  function vorEdge(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y); let md = 9, mx = 0, my = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const px = i + h2(ix + i, iy + j, seed), py = j + h2(ix + i, iy + j, seed + 1), dx = px - (x - ix), dy = py - (y - iy), d = dx * dx + dy * dy; if (d < md) { md = d; mx = dx; my = dy; } }
    let e = 9;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const px = i + h2(ix + i, iy + j, seed), py = j + h2(ix + i, iy + j, seed + 1), dx = px - (x - ix), dy = py - (y - iy), qx = dx - mx, qy = dy - my, ql = qx * qx + qy * qy;
      if (ql > 1e-5) e = Math.min(e, ((mx + dx) * 0.5 * qx + (my + dy) * 0.5 * qy) / Math.sqrt(ql)); }
    return e;
  }
  function crackJS(px2, py2, sev, seed, px) {
    const reach = 0.06 + 0.30 * sev, r = Math.hypot(px2, py2) + 1e-6;
    if (r > reach * 1.05) return [0, 0];
    let th = Math.atan2(py2, px2); if (th < 0) th += TAU;
    const NR = 5 + Math.floor(h1(1, seed) * 5), cell = th / TAU * NR, c0 = Math.floor(cell);
    let line = 0, haze = 0;
    for (let o = -1; o <= 1; o++) {
      let k = c0 + o; if (k < 0) k += NR; if (k >= NR) k -= NR;   // (no %: GLSL ES leaves it undefined below 0)
      const base = (k + 0.5 + 0.7 * (h1(k, seed + 3) - 0.5)) / NR * TAU;
      const ang = base + 0.10 * fbm1(r * 9 + k * 7.1, seed + 5) + 0.12 * fbm1(r * 2.3 + k, seed + 6) * Math.min(1, r / 0.1);
      let d = th - ang; d -= TAU * Math.round(d / TAU);
      const len = reach * (0.45 + 0.55 * h1(k, seed + 9)), dist = Math.abs(d) * r;
      const w = 0.0009 * (1 - Math.min(1, r / len)) + 0.00025;
      if (r < len) { line = Math.max(line, lineCov(dist, w, px)); haze = Math.max(haze, 0.55 * (1 - sm(w, Math.max(w * 6, px * 2), dist))); }
    }
    if (sev >= 0.5) {
      const NG = 1 + Math.floor(h1(2, seed) * 3);
      for (let j = 0; j < 3; j++) { if (j >= NG) break;
        const R = (0.03 + 0.02 * h1(j, seed + 13)) * Math.pow(2, j) * (0.6 + sev);
        if (h2(c0, j, seed + 17) > 0.55 || R > reach) continue;
        const Rw = R * (1 + 0.08 * fbm1(th * 5 + j, seed + 19)), dist = Math.abs(r - Rw);
        line = Math.max(line, lineCov(dist, 0.0004, px)); haze = Math.max(haze, 0.45 * (1 - sm(0.001, Math.max(0.004, px * 2), dist))); }
    }
    if (sev >= 0.85) {
      const cz = 0.9 * (1 - sm(0.02, 0.06 + 0.06 * sev, r));
      if (cz > 0) { const e = vorEdge(px2 * 60, py2 * 60, seed + 23); haze = Math.max(haze, cz * (1 - sm(0.02, 0.07, e)) * 0.8); }
    }
    return [line, haze];
  }
  // the same in GLSL - aeroskin.js splices AERO_GLASS_CRACK_FS (its copy of this text: GATE DMGGLASS holds them equal)
  const GLSL_CRACK = [
    'float dgU1(int i, int seed) { uint x = (uint(i) * 0x27d4eb2du) ^ (uint(seed) * 0x165667b1u); x ^= x >> 15u; x *= 0x85ebca6bu; x ^= x >> 13u; x *= 0xc2b2ae35u; x ^= x >> 16u; return float(x) / 4294967296.0; }',
    'float dgU2(int i, int j, int seed) { return dgU1(int(uint(i) * 73856093u ^ uint(j) * 19349663u), seed); }',
    'float dgV1(float x, int seed) { float fi = floor(x); int i = int(fi); float f = x - fi; float s = f * f * (3.0 - 2.0 * f); float a = dgU1(i, seed); return a + (dgU1(i + 1, seed) - a) * s; }',
    'float dgFbm(float x, int seed) { float s = 0.0, a = 0.5, f = 1.0, n = 0.0; for (int o = 0; o < 3; o++) { s += a * (dgV1(x * f, seed + o * 31) * 2.0 - 1.0); n += a; a *= 0.5; f *= 2.03; } return s / n; }',
    'float dgSm(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }',
    'float dgLine(float dist, float w, float pw) { float we = max(w, pw); return (1.0 - dgSm(we * 0.5, we, dist)) * (w / we); }',
    'float dgVor(vec2 p, int seed) { vec2 fl = floor(p); int ix = int(fl.x), iy = int(fl.y); float md = 9.0, mx = 0.0, my = 0.0;',
    '  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { float px = float(i) + dgU2(ix + i, iy + j, seed), py = float(j) + dgU2(ix + i, iy + j, seed + 1); float dx = px - (p.x - fl.x), dy = py - (p.y - fl.y), d = dx * dx + dy * dy; if (d < md) { md = d; mx = dx; my = dy; } }',
    '  float e = 9.0;',
    '  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) { float px = float(i) + dgU2(ix + i, iy + j, seed), py = float(j) + dgU2(ix + i, iy + j, seed + 1); float dx = px - (p.x - fl.x), dy = py - (p.y - fl.y), qx = dx - mx, qy = dy - my, ql = qx * qx + qy * qy;',
    '    if (ql > 1e-5) e = min(e, ((mx + dx) * 0.5 * qx + (my + dy) * 0.5 * qy) / sqrt(ql)); }',
    '  return e; }',
    'vec2 dgCrack(vec2 q, float sev, int seed, float px) {',
    '  float reach = 0.06 + 0.30 * sev, r = length(q) + 1e-6;',
    '  if (r > reach * 1.05) return vec2(0.0);',
    '  float th = atan(q.y, q.x); if (th < 0.0) th += 6.2831853;',
    '  int NR = 5 + int(floor(dgU1(1, seed) * 5.0)); float cell = th / 6.2831853 * float(NR); int c0 = int(floor(cell));',
    '  float line = 0.0, haze = 0.0;',
    '  for (int o = -1; o <= 1; o++) {',
    '    int k = c0 + o; if (k < 0) k += NR; if (k >= NR) k -= NR;',
    '    float base = (float(k) + 0.5 + 0.7 * (dgU1(k, seed + 3) - 0.5)) / float(NR) * 6.2831853;',
    '    float ang = base + 0.10 * dgFbm(r * 9.0 + float(k) * 7.1, seed + 5) + 0.12 * dgFbm(r * 2.3 + float(k), seed + 6) * min(1.0, r / 0.1);',
    '    float d = th - ang; d -= 6.2831853 * floor(d / 6.2831853 + 0.5);',
    '    float len = reach * (0.45 + 0.55 * dgU1(k, seed + 9)), dist = abs(d) * r;',
    '    float w = 0.0009 * (1.0 - min(1.0, r / len)) + 0.00025;',
    '    if (r < len) { line = max(line, dgLine(dist, w, px)); haze = max(haze, 0.55 * (1.0 - dgSm(w, max(w * 6.0, px * 2.0), dist))); }',
    '  }',
    '  if (sev >= 0.5) {',
    '    int NG = 1 + int(floor(dgU1(2, seed) * 3.0));',
    '    for (int j = 0; j < 3; j++) { if (j >= NG) break;',
    '      float R = (0.03 + 0.02 * dgU1(j, seed + 13)) * pow(2.0, float(j)) * (0.6 + sev);',
    '      if (dgU2(c0, j, seed + 17) > 0.55 || R > reach) continue;',
    '      float Rw = R * (1.0 + 0.08 * dgFbm(th * 5.0 + float(j), seed + 19)), dist = abs(r - Rw);',
    '      line = max(line, dgLine(dist, 0.0004, px)); haze = max(haze, 0.45 * (1.0 - dgSm(0.001, max(0.004, px * 2.0), dist))); }',
    '  }',
    '  if (sev >= 0.85) {',
    '    float cz = 0.9 * (1.0 - dgSm(0.02, 0.06 + 0.06 * sev, r));',
    '    if (cz > 0.0) { float e = dgVor(q * 60.0, seed + 23); haze = max(haze, cz * (1.0 - dgSm(0.02, 0.07, e)) * 0.8); }',
    '  }',
    '  return vec2(line, haze);',
    '}',
  ].join('\n');
  // the mark's tangent frame (JS = the shader's): t1 = normalize(cross(n, a)), a = z unless n is near z (then x); t2 = cross(n, t1)
  function frame(n) {
    const a = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let t1 = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]]; const l = Math.hypot(...t1); t1 = t1.map(v => v / l);
    const t2 = [n[1] * t1[2] - n[2] * t1[1], n[2] * t1[0] - n[0] * t1[2], n[0] * t1[1] - n[1] * t1[0]];
    return [t1, t2];
  }
  // a fragment's mark (the shader's loop over the marks, mirrored): x its craft place, nf its normal, px; -> [line, haze]
  const GATE_DN = 0.04, GATE_FACE = 0.5;
  function shadeJS(marks, x, nf, px) {
    let line = 0, haze = 0;
    for (const m of (marks || []).slice(0, MAX)) {
      const d = [x[0] - m.p[0], x[1] - m.p[1], x[2] - m.p[2]], dn = d[0] * m.n[0] + d[1] * m.n[1] + d[2] * m.n[2];
      const fl = Math.hypot(...nf) || 1, face = (nf[0] * m.n[0] + nf[1] * m.n[1] + nf[2] * m.n[2]) / fl;
      if (Math.abs(dn) > GATE_DN || face < GATE_FACE) continue;
      const [t1, t2] = frame(m.n), q = [d[0] * t1[0] + d[1] * t1[1] + d[2] * t1[2], d[0] * t2[0] + d[1] * t2[1] + d[2] * t2[2]];
      const c = crackJS(q[0], q[1], m.sev, m.seed, px); line = Math.max(line, c[0]); haze = Math.max(haze, c[1]);
    }
    return [line, haze];
  }
  const API = { R_NEAR, SET_LIGHT, SET_HARD, MERGE, MAX, GATE_DN, GATE_FACE, severity, members, nearest, impacts, pack, crackJS, shadeJS, frame, GLSL_CRACK };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.DMG_GLASS = API;
})();
