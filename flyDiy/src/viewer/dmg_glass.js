// G3623 (DMG-GLASS): THE IMPACT MARK ON THE GLAZING - the user, 27 Oct: "never seen an impact mark on glass".
// Until now a pane either stood whole or left the wreck whole (wreck_debris.js: a crushed carrying set throws it off as
// a body); nothing in between, never a crack. This is the in-between: a STAR of cracks at the point of the pane where
// the airframe hit it, drawn by the glass's own shader (aeroskin.js AEROGLASS_HOOK, the crack block) - so it shades as
// the glass does: under the same light, on the same pane, with the same reflection taken off where it is crazed.
//
// THE MATERIAL (CANOPY-CRACKS, 12 Nov, replacing the DMG-LOOKS §2.5 star): light aircraft glazing is cast or stretched
// ACRYLIC - brittle: a small crushed, whitened spot, a fringe of short cracks and a few long straight runners that fork
// and run on to the frame; a LAMINATED glass screen cracks in a spider web that holds. Both are baked sheets now (the
// crack sheet below). Cracks SCATTER light: on the real thing they read silver-white against the sky, never dark. The
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

  // ---- THE CRACK SHEET (CANOPY-CRACKS, 12 Nov: the user's option B, two looks): the crack is no longer drawn here - it is
  // READ from a sheet baked once (tools/crack_sheet_bake.js -> media/tex/crack/, the table src/viewer/crack_sheet.js):
  // R the distance to the nearest crack, G when it arrived as the crack grew, B its facet's phase, A the whitened core.
  // One sheet a look: 'acrylic' (glazeMat acrylic, and polycarbonate until it has a look of its own) and 'laminated'
  // (glazeMat glass, every pane); the flown aeroplane's one is bound to tCrack, uCrackMat says which (0 / 1). The G3623
  // procedural star (fbm-wobbled rays with a 6x haze, rings, a Voronoi honeycomb) is gone: it read "like children drawings"
  // (the user, 12 Nov) - the study is futureDesigns/CANOPY-CRACKS-2026-11.md.
  const SHEET_MATS = ['acrylic', 'laminated'];
  const SHEET_N = 1024;                 // texels a side (one pattern, rotated and mirrored by the mark's seed)
  const SHEET_SPAN = 0.9;               // m the sheet spans round the hit (0.88 mm a texel)
  const SHEET_R = 0.44;                 // m: nothing past this from the hit (the sheet's edge)
  const SHEET_DMAX = 0.008;             // m: R's full scale
  const SHEET_TEXEL = SHEET_SPAN / SHEET_N;
  const SHEET_BIAS = 0.3 * SHEET_TEXEL; // m off the read distance: a line between two texels reads near 0, not half a texel
  const SHARE_M = 0.0012;               // m: a crack's apparent width (its facet seen through 3 mm of sheet): a pixel wider
                                        // than this holds only its share - far off, a crack fades as a real one does
  const sheetOf = glazingMat => glazingMat === 'glass' ? 'laminated' : 'acrylic';
  const matIndex = sheet => sheet === 'laminated' ? 1 : 0;
  // ---- the hash the shader keeps (the seed's rotation and mirror), and the line's coverage ----
  function u32(x) { return x >>> 0; }
  function h1(i, seed) { let x = u32(Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(seed | 0, 0x165667b1)); x ^= x >>> 15; x = u32(Math.imul(x, 0x85ebca6b)); x ^= x >>> 13; x = u32(Math.imul(x, 0xc2b2ae35)); x ^= x >>> 16; return u32(x) / 4294967296; }
  function sm(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
  // a thin line's coverage: its own half-width w, drawn at least a pixel wide (pw) and dimmed to its share
  function lineCov(dist, w, pw) { const we = Math.max(w, pw); return (1 - sm(we * 0.5, we, dist)) * (w / we); }
  // ---- the sheet read, as the GPU does it (GATE DMGGLASS G holds the two equal): S = { N, data: RGBA8 rows, v = 0 first },
  // its mips box-averaged on first use (the page's generateMipmaps); clamp to edge; bilinear, linear between levels ----
  function mipsOf(S) {
    if (S.mips) return S.mips;
    const L = [{ n: S.N, d: Float32Array.from(S.data, x => x / 255) }];
    while (L[L.length - 1].n > 1) { const a = L[L.length - 1], n = a.n >> 1, d = new Float32Array(n * n * 4);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) for (let c = 0; c < 4; c++) { const at = (x, y) => a.d[((y) * a.n + x) * 4 + c];
        d[(j * n + i) * 4 + c] = (at(2 * i, 2 * j) + at(2 * i + 1, 2 * j) + at(2 * i, 2 * j + 1) + at(2 * i + 1, 2 * j + 1)) / 4; }
      L.push({ n, d }); }
    return (S.mips = L);
  }
  function bilin(M, u, v) {
    const n = M.n, x = u * n - 0.5, y = v * n - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, o = [0, 0, 0, 0];
    const cl = k => Math.min(n - 1, Math.max(0, k));
    for (let c = 0; c < 4; c++) { const at = (i, j) => M.d[(cl(j) * n + cl(i)) * 4 + c];
      o[c] = (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy; }
    return o;
  }
  function sampleLod(S, u, v, lod) {
    const L = mipsOf(S), l = Math.min(L.length - 1, Math.max(0, lod)), l0 = Math.floor(l), f = l - l0;
    const a = bilin(L[l0], u, v); if (f <= 0 || l0 + 1 >= L.length) return a;
    const b = bilin(L[l0 + 1], u, v); return a.map((x, c) => x + (b[c] - x) * f);
  }
  // ---- THE CRACK MASK, the shader's mirror (GLSL_CRACK) line for line: q the fragment's place on the pane round the mark
  // (m, in the mark's tangent plane), sev 0..1, seed, px the metres a pixel spans there (the shader's fwidth), vt the eye's
  // direction in the mark's tangent frame (the glint), S the sheet, mat 0 acrylic / 1 laminated -> [line, haze], each 0..1
  // (haze: the whitened core). The line is a hairline of ~2 px at its root, ~1 px at its tips, wherever the eye is ----
  function crackJS(qx, qy, sev, seed, px, vt, S, mat) {
    const r = Math.hypot(qx, qy);
    if (r > SHEET_R || !S) return [0, 0];
    const a = TAU * h1(1, seed), ca = Math.cos(a), sa = Math.sin(a);
    let p0 = ca * qx - sa * qy; const p1 = sa * qx + ca * qy;
    if (h1(2, seed) < 0.5) p0 = -p0;
    const t = sampleLod(S, p0 / SHEET_SPAN + 0.5, p1 / SHEET_SPAN + 0.5, Math.max(0, Math.log2(px / SHEET_TEXEL)));
    const d = Math.max(0, t[0] * SHEET_DMAX - SHEET_BIAS);
    const vis = Math.min(1, Math.max(0, (sev - t[1]) * 40 + 1));
    const tap = Math.min(1, Math.max(0, t[1] / Math.max(sev, 0.05)));
    const gl = 0.12 + 0.88 * Math.pow(Math.abs(Math.sin(TAU * t[2] + 5 * vt[0] + 3 * vt[1])), 10);
    const line = lineCov(d, px * (1.3 + (0.55 - 1.3) * tap), px) * vis * gl * Math.min(1, SHARE_M / px);
    const rc = mat > 0.5 ? 0.010 + 0.016 * sev : 0.006 + 0.020 * sev;
    const wh = t[3] * (1 - sm(0.7 * rc, 1.6 * rc, r));
    return [line, wh];
  }
  // the same in GLSL - aeroskin.js splices AERO_GLASS_CRACK_FS (its copy of this text: GATE DMGGLASS holds them equal). It
  // reads tCrack and uCrackMat (aeroskin.js AERO_GLASS_CRACK_PARS declares them); textureLod with the pixel's own level, so
  // the read is the same inside the marks' loop as outside it (no implicit derivatives in non-uniform flow)
  const gf = x => { const t = String(x); return /[.e]/.test(t) ? t : t + '.0'; };
  const GLSL_CRACK = [
    'float dgU1(int i, int seed) { uint x = (uint(i) * 0x27d4eb2du) ^ (uint(seed) * 0x165667b1u); x ^= x >> 15u; x *= 0x85ebca6bu; x ^= x >> 13u; x *= 0xc2b2ae35u; x ^= x >> 16u; return float(x) / 4294967296.0; }',
    'float dgSm(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }',
    'float dgLine(float dist, float w, float pw) { float we = max(w, pw); return (1.0 - dgSm(we * 0.5, we, dist)) * (w / we); }',
    'vec2 dgCrack(vec2 q, float sev, int seed, float px, vec2 vt) {',
    '  float r = length(q);',
    '  if (r > ' + gf(SHEET_R) + ') return vec2(0.0);',
    '  float a = 6.2831853 * dgU1(1, seed), ca = cos(a), sa = sin(a);',
    '  vec2 p = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);',
    '  if (dgU1(2, seed) < 0.5) p.x = -p.x;',
    '  vec4 t = textureLod(tCrack, p / ' + gf(SHEET_SPAN) + ' + 0.5, max(0.0, log2(px / ' + gf(SHEET_TEXEL) + ')));',
    '  float d = max(0.0, t.r * ' + gf(SHEET_DMAX) + ' - ' + gf(SHEET_BIAS) + ');',
    '  float vis = clamp((sev - t.g) * 40.0 + 1.0, 0.0, 1.0);',
    '  float tap = clamp(t.g / max(sev, 0.05), 0.0, 1.0);',
    '  float gl = 0.12 + 0.88 * pow(abs(sin(6.2831853 * t.b + 5.0 * vt.x + 3.0 * vt.y)), 10.0);',
    '  float line = dgLine(d, px * mix(1.3, 0.55, tap), px) * vis * gl * min(1.0, ' + gf(SHARE_M) + ' / px);',
    '  float rc = uCrackMat > 0.5 ? 0.010 + 0.016 * sev : 0.006 + 0.020 * sev;',
    '  float wh = t.a * (1.0 - dgSm(0.7 * rc, 1.6 * rc, r));',
    '  return vec2(line, wh);',
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
  // eye: the eye's place in the same frame (the glint; default: 1 m out along the mark's normal), S the sheet, mat 0 / 1
  function shadeJS(marks, x, nf, px, eye, S, mat) {
    let line = 0, haze = 0;
    for (const m of (marks || []).slice(0, MAX)) {
      const d = [x[0] - m.p[0], x[1] - m.p[1], x[2] - m.p[2]], dn = d[0] * m.n[0] + d[1] * m.n[1] + d[2] * m.n[2];
      const fl = Math.hypot(...nf) || 1, face = (nf[0] * m.n[0] + nf[1] * m.n[1] + nf[2] * m.n[2]) / fl;
      if (Math.abs(dn) > GATE_DN || face < GATE_FACE) continue;
      const [t1, t2] = frame(m.n), q = [d[0] * t1[0] + d[1] * t1[1] + d[2] * t1[2], d[0] * t2[0] + d[1] * t2[1] + d[2] * t2[2]];
      const e = eye || [m.p[0] + m.n[0], m.p[1] + m.n[1], m.p[2] + m.n[2]], v = [e[0] - x[0], e[1] - x[1], e[2] - x[2]], vl = Math.hypot(...v) || 1;
      const vt = [(v[0] * t1[0] + v[1] * t1[1] + v[2] * t1[2]) / vl, (v[0] * t2[0] + v[1] * t2[1] + v[2] * t2[2]) / vl];
      const c = crackJS(q[0], q[1], m.sev, m.seed, px, vt, S, mat || 0); line = Math.max(line, c[0]); haze = Math.max(haze, c[1]);
    }
    return [line, haze];
  }
  const API = { R_NEAR, SET_LIGHT, SET_HARD, MERGE, MAX, GATE_DN, GATE_FACE, SHEET_MATS, SHEET_N, SHEET_SPAN, SHEET_R, SHEET_DMAX, SHEET_TEXEL, SHEET_BIAS, SHARE_M,
    sheetOf, matIndex, severity, members, nearest, impacts, pack, crackJS, shadeJS, frame, sampleLod, GLSL_CRACK };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.DMG_GLASS = API;
})();
