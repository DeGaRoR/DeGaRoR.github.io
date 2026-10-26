// DMG-LOOKS PORT KIT: THE P2 RIM OVERLAY, B3, OUTER SKIN ONLY (the user's rulings, 25-26 Oct).
// What the overlay needs on the CPU, at an event, per skin_break record - and its fragment bands, JS and GLSL:
//   isOuter(sec, role, layer, cls)  the outer skin: a section whose role is 'skin' (body, taper...), or a sectionless
//                                   covering place (the wing, the fin, the stab, the colour groups); never a frame
//                                   (struct / rail / pillar: the member pool colours its own ends), a liner, a pad, a bead
//   new RimState(R, outerOf, o)     incremental per record: update() after each skin_break.event(R) reads R.dead, finds
//                                   the newly dead triangles, sets their outer places' edge distance e to 0 and relaxes it
//                                   over the live outer mesh (Dijkstra on the welded places, cut at BAND), and returns
//                                   what the overlay's parked buffers need written:
//                                     verts  [{ v, e }]  new overlay vertices: v the record's vertex (the drawer maps it to
//                                                        its aPl / aN0 for the overlay's own transform-feedback ride)
//                                     rims   [[o, e]]    overlay vertices whose e fell (aRim rewritten)
//                                     tris   [[o0, o1, o2]] new overlay triangles;  gone [t] overlay triangles now dead
//                                   capped (maxVerts / maxTris: past the cap nothing is added - counted in .dropped)
//   rimBandsJS(e, px, py, finish, seed) -> [r, g, b, a]   the bands (a 0 = write nothing); GLSL_BANDS the same
// B3's GPU side (Deform's, skin_gpu.js): the overlay's vertex list rides through the SAME RIDE_VS, one transform-feedback
// draw per drawer that has rim places (that drawer's place textures bound) into the overlay's parked buffers at its
// range; then ONE overlay draw. PURE: no THREE, no DOM. window.DMG_LOOKS_RIM in the page, module.exports in node.
(function () {
  'use strict';
  const NZ = typeof DMG_LOOKS_NOISE !== 'undefined' ? DMG_LOOKS_NOISE : require('./dmg_looks_noise.js');
  const BAND = 0.03;                                    // m: a triangle with a place this near the torn edge is drawn
  const FINISH = { alclad: 0, fabric: 1, composite: 2, ply: 3 };
  function isOuter(sec, role, layer, cls) {
    if (sec) return role === 'skin';
    return cls === 'cover' && layer !== 'crew';
  }
  // ---- the incremental rim ----
  // R: a skin_break record (idx0, nt, nv, rep, dead, g.pos); outerOf(v) -> bool (per vertex)
  function RimState(R, outerOf, o) {
    o = o || {};
    this.R = R; this.outerOf = outerOf; this.band = o.band || BAND; this.maxVerts = o.maxVerts || 16384; this.maxTris = o.maxTris || 16384;
    this.seen = new Uint8Array(R.nt); this.e = null; this.adj = null; this.ov = new Map(); this.ovTri = new Map(); this.nVerts = 0; this.nTris = 0; this.dropped = 0;
  }
  RimState.prototype._build = function () {
    // welded places, their adjacency over OUTER triangles, and the vertices of each place (made once, at the first update)
    const R = this.R, i0 = R.idx0 || R.idx, rep = R.rep, pl = v => rep ? rep[v] : v, nt = R.nt, P = R.g.pos;
    this.pl = pl; this.out = new Uint8Array(nt);
    for (let t = 0; t < nt; t++) { const a = i0[t * 3], b = i0[t * 3 + 1], c = i0[t * 3 + 2]; if (this.outerOf(a) && this.outerOf(b) && this.outerOf(c)) this.out[t] = 1; }
    const adj = new Map(), link = (a, b) => { let L = adj.get(a); if (!L) adj.set(a, L = []); if (L.indexOf(b) < 0) L.push(b); };
    const tris = new Map(); const tOf = (p, t) => { let L = tris.get(p); if (!L) tris.set(p, L = []); L.push(t); };
    for (let t = 0; t < nt; t++) { if (!this.out[t]) continue; const q = [pl(i0[t * 3]), pl(i0[t * 3 + 1]), pl(i0[t * 3 + 2])];
      for (let k = 0; k < 3; k++) { link(q[k], q[(k + 1) % 3]); link(q[(k + 1) % 3], q[k]); tOf(q[k], t); } }
    this.adj = adj; this.trisOf = tris; this.e = new Map(); this.i0 = i0; this.P = P;
  };
  RimState.prototype.update = function () {
    const R = this.R; if (!R.dead) return null; if (!this.adj) this._build();
    const i0 = this.i0, pl = this.pl, P = this.P, dead = R.dead, E = this.e, band = this.band;
    const res = { verts: [], rims: [], tris: [], gone: [] }, heap = [];
    const push = (d, p) => { heap.push([d, p]); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const touched = new Set();
    for (let t = 0; t < R.nt; t++) { if (!dead[t] || this.seen[t]) continue; this.seen[t] = 1;
      const ot = this.ovTri.get(t); if (ot != null) { res.gone.push(ot); this.ovTri.delete(t); }
      if (!this.out[t]) continue;
      for (let k = 0; k < 3; k++) { const p = pl(i0[t * 3 + k]); if (!(E.get(p) <= 0)) { E.set(p, 0); push(0, p); touched.add(p); } } }
    // relax (Dijkstra over the live outer places; an edge's length at rest)
    const pos = p => [P[p * 3], P[p * 3 + 1], P[p * 3 + 2]];
    while (heap.length) { const [d, p] = pop(); if (d > (E.get(p) ?? Infinity) || d > band) continue;
      const pp = pos(p); for (const q of this.adj.get(p) || []) { const qq = pos(q), nd = d + Math.hypot(qq[0] - pp[0], qq[1] - pp[1], qq[2] - pp[2]);
        if (nd < (E.get(q) ?? Infinity) && nd <= band) { E.set(q, nd); push(nd, q); touched.add(q); } } }
    // the rim: live outer triangles with a place within the band, round the places touched now
    const cand = new Set(); for (const p of touched) for (const t of this.trisOf.get(p) || []) cand.add(t);
    for (const t of cand) {
      if (dead[t] || this.ovTri.has(t)) continue;
      const vs = [i0[t * 3], i0[t * 3 + 1], i0[t * 3 + 2]];
      if (Math.min(...vs.map(v => E.get(pl(v)) ?? Infinity)) >= band) continue;
      if (this.nTris >= this.maxTris || this.nVerts + 3 > this.maxVerts) { this.dropped++; continue; }
      const o = vs.map(v => { let x = this.ov.get(v); if (x == null) { x = this.nVerts++; this.ov.set(v, x); res.verts.push({ v, e: Math.min(E.get(pl(v)) ?? band, band) }); } return x; });
      this.ovTri.set(t, this.nTris++); res.tris.push(o);
    }
    // e fell on overlay vertices made at an earlier event
    for (const p of touched) for (const t of this.trisOf.get(p) || []) for (let k = 0; k < 3; k++) { const v = i0[t * 3 + k]; if (pl(v) !== p) continue; const x = this.ov.get(v); if (x != null && x < this.nVerts - res.verts.length) res.rims.push([x, Math.min(E.get(p), band)]); }
    return res;
  };
  // ---- the bands (study §4 P2, the user's grey primer): e (m) + noise -> colour, a 0 = write nothing ----
  function rimBandsJS(e, px, py, finish, seed) {
    e = Math.max(0, e + 0.004 * NZ.fbm2(px * 90, py * 90, seed + 21, 3));
    if (finish === 0) { if (e < 0.003) return [0.84, 0.86, 0.88, 1]; if (e < 0.012) return [0.62, 0.63, 0.64, 1];
      if (e < 0.03 && NZ.v2(px * 160, py * 160, seed + 5) > 0.42 + 14 * (e - 0.012)) return [0.84, 0.86, 0.88, 1]; return [0, 0, 0, 0]; }
    if (finish === 1) { if (e < 0.004) return NZ.v2(px * 420, py * 50, seed + 5) > 0.45 ? [0.86, 0.83, 0.73, 1] : [0.74, 0.71, 0.62, 1];
      if (e < 0.010 && NZ.v2(px * 90, py * 90, seed + 6) > 0.35 + 50 * (e - 0.004)) return [0.80, 0.77, 0.68, 1]; return [0, 0, 0, 0]; }
    if (finish === 2) { if (e < 0.005) return [0.78, 0.80, 0.72, 1]; if (e < 0.0075) return [0.40, 0.41, 0.38, 1]; return [0, 0, 0, 0]; }
    if (e < 0.012) return NZ.v2(px * 30, py * 300, seed + 5) > 0.5 ? [0.86, 0.70, 0.46, 1] : [0.78, 0.60, 0.38, 1];
    if (e < 0.02 && NZ.v2(px * 120, py * 120, seed + 5) > 0.5) return [0.66, 0.50, 0.30, 1]; return [0, 0, 0, 0];
  }
  const GLSL_BANDS = [
    '// e: the edge distance (m, interpolated aRim); p: a surface coordinate (m: the rest place, two components); finish 0 alclad, 1 fabric, 2 composite, 3 ply',
    'vec4 dlRimBands(float e, vec2 p, int finish, int seed) {',
    '  e = max(0.0, e + 0.004 * dlFbm2(p * 90.0, seed + 21));',
    '  if (finish == 0) { if (e < 0.003) return vec4(0.84, 0.86, 0.88, 1.0); if (e < 0.012) return vec4(0.62, 0.63, 0.64, 1.0);',
    '    if (e < 0.03 && dlV2(p * 160.0, seed + 5) > 0.42 + 14.0 * (e - 0.012)) return vec4(0.84, 0.86, 0.88, 1.0); return vec4(0.0); }',
    '  if (finish == 1) { if (e < 0.004) return dlV2(vec2(p.x * 420.0, p.y * 50.0), seed + 5) > 0.45 ? vec4(0.86, 0.83, 0.73, 1.0) : vec4(0.74, 0.71, 0.62, 1.0);',
    '    if (e < 0.010 && dlV2(p * 90.0, seed + 6) > 0.35 + 50.0 * (e - 0.004)) return vec4(0.80, 0.77, 0.68, 1.0); return vec4(0.0); }',
    '  if (finish == 2) { if (e < 0.005) return vec4(0.78, 0.80, 0.72, 1.0); if (e < 0.0075) return vec4(0.40, 0.41, 0.38, 1.0); return vec4(0.0); }',
    '  if (e < 0.012) return dlV2(vec2(p.x * 30.0, p.y * 300.0), seed + 5) > 0.5 ? vec4(0.86, 0.70, 0.46, 1.0) : vec4(0.78, 0.60, 0.38, 1.0);',
    '  if (e < 0.02 && dlV2(p * 120.0, seed + 5) > 0.5) return vec4(0.66, 0.50, 0.30, 1.0); return vec4(0.0);',
    '}',
  ].join('\n');

  // ---- the self-check (port/check_port.js calls it) ----
  async function selfCheck(ok, gpuRun) {
    // 1. the bands: GLSL = JS
    const inputs = []; let a = 7; const r = () => { a = (Math.imul(a, 1103515245) + 12345) >>> 0; return a / 4294967296; };
    for (let i = 0; i < 4000; i++) inputs.push([r() * 0.035, r() * 4 - 2, r() * 4 - 2, (i % 4) + 0.1]);
    const G = await gpuRun(NZ.GLSL + '\n' + GLSL_BANDS, 'void main() { vOut = dlRimBands(aIn.x, aIn.yz, int(aIn.w), 9); gl_Position = vec4(0.0); }', inputs);
    if (G.skip) console.log('  SKIP the bands parity: ' + G.skip);
    else if (G.err) ok(false, 'the bands GLSL: ' + G.err);
    else { let bad = 0; inputs.forEach((x, i) => { const e = rimBandsJS(x[0], x[1], x[2], Math.floor(x[3]), 9), g = G.res.slice(i * 4, i * 4 + 4);
        if (Math.abs(e[3] - g[3]) > 0.5 || Math.hypot(e[0] - g[0], e[1] - g[1], e[2] - g[2]) > 1e-3) bad++; });
      ok(bad / inputs.length <= 0.005, `GLSL bands = rimBandsJS: ${inputs.length - bad} / ${inputs.length} the same`); }
    // 2. incremental = from scratch, on the prototype's torn sheet fed as successive events
    const TP = require('../tear_proto.js'), M = TP.grid(TP.W, TP.H, TP.HS), ev = TP.event(M, TP.PROFILES.alu, 1936);
    const R = { idx0: M.T, nt: M.nt, nv: M.nv, rep: null, dead: new Uint8Array(M.nt), g: { pos: Float32Array.from(M.P) } };
    const S = new RimState(R, () => true); const deadList = []; for (let t = 0; t < M.nt; t++) if (ev.dead[t]) deadList.push(t);
    const order = deadList.slice().sort((x, y) => M.P[M.T[x * 3] * 3 + 1] - M.P[M.T[y * 3] * 3 + 1]);   // the tear grows along y
    let nT = 0; for (let k = 0; k < 6; k++) { for (const t of order.slice(Math.floor(k * order.length / 6), Math.floor((k + 1) * order.length / 6))) R.dead[t] = 1; const u = S.update(); nT += u.tris.length - u.gone.length; }
    const S2 = new RimState(R, () => true); const u2 = S2.update();
    let de = 0; for (const [p, e] of S2.e) de = Math.max(de, Math.abs((S.e.get(p) ?? Infinity) - e));
    ok(de < 1e-9 && S.ovTri.size === S2.ovTri.size, `incremental rim = from scratch after 6 events: ${S.ovTri.size} / ${S2.ovTri.size} triangles, worst |de| ${de.toExponential(1)}`);
  }
  const API = { BAND, FINISH, isOuter, RimState, rimBandsJS, GLSL: NZ.GLSL + '\n' + GLSL_BANDS, selfCheck };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.DMG_LOOKS_RIM = API;
})();
