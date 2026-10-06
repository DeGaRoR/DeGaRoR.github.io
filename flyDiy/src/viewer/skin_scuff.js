// G2000-G2009 (DMG-SCUFF): THE DAMAGE DRAWN WHERE THE PHYSICS PUT IT - DEFORM-AND-BREAK §8 (the wreck drawn), §5.3 (the
// windscreen cracked). The user, 2026-10-06: "We should start looking at texturing damage too. We have already the
// weathering system that might help, not sure if it can apply per zone. A broken glass texture would be cool too."
//
// NOT A RECIPE: at each damage EVENT (the damage state's vB / vS - a break, a new set, a new slide; never per frame) each
// drawn vertex gets a small record read from the solver THROUGH ITS EXISTING BINDING (skin_break.js's records: each
// place's nodes `wi` and weights `w2` / `ww` - DMG-D4a's, DMG-WALL's inherited ones when it lands; none recomputed here):
//   CRUSH   the plastic work of the members round its nodes (DMG-D0's DMG.wB, J) over the member's size: wB / (sigY A L)
//           is the member's equivalent plastic strain (the work a member of yield stress sigY, section A and length L
//           spends to take a plastic strain e is sigY A L e). A node takes its worst member's; a vertex its nodes', by
//           its weights. Drawn: paint crazed and chipped to primer and bare alloy on metal, wrinkled slack fabric (dark
//           creases, the dope's sheen gone), splinters on wood - the substrate is the weathering's own (aeroWxSubOf);
//   SCRAPE  the friction work of its nodes sliding on the ground or rubbing a trunk (30_solver.js scuffAdd, G2001: per
//           node, with the slide's direction and the side it was pushed from), ON THE SIDE THAT SLID only - each node's
//           work counts on a vertex as far as the vertex's rest normal faces the way the node was pushed from (a belly
//           slide paints the belly, not the deck). Drawn: streaks ALONG the slide (its direction, per vertex, in the
//           drawing's own frame), the paint ground off to what is under it, a soil / grass stain where the ground was
//           soft;
//   TORN    the distance, over the skin, to the nearest torn or removed triangle (skin_break.js `dead`: the tear and the
//           break line): a frayed dark band on fabric, a ragged bright edge on metal;
//   GLASS   each pane (a glass group's connected piece) an impact point and a severity: its nodes' hit (the crush and the
//           slide of the nodes it rides) and its frame's distortion (the permanent set of the members at its nodes, in
//           metres: 6 cm is DMG-D4b's 'crushed' - the pane leaves as debris there, so 1 here). Drawn in the glass shader:
//           an ACRYLIC crack (light-aircraft glazing is acrylic): long cracks radiating from the impact point, forking,
//           with crazing round it - never tempered glass's cubes. A pane past breaking is D4b's; a cracked one stays.
// THE RECORD, one per vertex, two attributes (8 bytes; a place computed once, its copies take it - the snapshot is
// unwelded, skin_break.js rep): aDmg (Uint8 x4, normalised) = crush, scrape, torn band, soil share - or on glass the
// pane's severity in x; aDmgD (Int8 x4, normalised) = the slide's direction in the geometry's own frame (tangent to the
// skin), w = the class (0 metal, 1 fabric, 2 wood, 3 other, 4 glass) + 8 x the pane's slot.
//
// THE SHADER (AERO_DMG_*): ONE block, the same text in the three programs a flown exterior draws with (the live
// AEROSKIN, the flown bake's baked one, the glass), spliced by a hook WRAPPER (wrap) - so with damage OFF no material is
// wrapped and no program's source or key moves by one byte (the wrapper is never made). With damage ON the flown model's
// exterior materials are wrapped COPIES from the build (app.js) that SLEEP until the first damage (waker / wakeSet):
// asleep the wrapper adds nothing, so an intact aeroplane draws the plain programs (not even the branch - the bench
// measured the awake block's attributes and varyings at +6-13 % of a SwiftShader frame on an intact Cub / Cessna, so it
// never draws them intact). The roll-out links both programs of every wrapped material (app.js scuffPrelink); the first
// record written wakes them (a key flip three finds in each material's own programs: no link). Awake, the block sits
// behind ONE uniform branch (uDmgOn); inside, a fragment with no record pays one more compare; the derivatives the
// block needs are taken before that divergent test (textureGrad).
// The grammar is the weathering's: its palette (uWxC: dirt, mud, grime), its substrates, its grunge sheet (the scratch
// read stretched along the slide, as aeroweather's scratches are), its rule that dirt is never shiny.
//
// PURE: no THREE at load, no DOM; the records are node-tested by GATE DMGSCUFF (tools/_dmg_scuff_check.js).
// window.SKIN_SCUFF in the page; module.exports in node.
(function () {
  'use strict';
  // ---- THE TABLE (every number the drawing reads off the physics) ----
  const SC = {
    eps0: 0.008,      // crush: a member's equivalent plastic strain where the paint starts to craze (0.8 %: a SET member,
                      //   not one just past its yield - at 0.2 % a 3 m/s taxi crazed the whole cowl on the real page)
    eps1: 0.06,       // ...and where the crush is full (6 %: a buckled tube - TREE-CRASH's kinks run 3-10 %)
    scrapeW: 60,      // J: a node's slide work at 1 - 1/e of the full scrape (a node of ~300 N on the ground slid ~25 cm)
    face0: 0.05,      // the facing (rest normal . the side the node was pushed from) where a node's scrape starts...
    face1: 0.55,      // ...and is whole
    tornR: 0.07,      // m: the torn band's width over the skin (a hand's width of frayed fabric or ragged sheet)
    paneSet0: 0.004,  // m: a pane's frame distortion (a member's set at its nodes, times its length) where it cracks...
    paneSet1: 0.06,   // ...and is full: DMG-D4b's CRUSH (6 cm) - the pane leaves as debris there
    paneHit0: 0.12,   // the least severity drawn (its nodes' hit or its frame's set) - below it the pane is clean
    panes: 8,         // the pane slots (uDmgPane)
    budget: 8000,     // places a frame (a place is ~0.3 us in node - GATE DMGSCUFF times it: ~2.5 ms a frame; the torn band a tick of its own)
    bindBudget: 1500, // places a frame bound through skin_break's own binding when a no-break scuff needs them
    frameMs: 4,       // AND a frame's time: the place counts above are node's; the real page on SwiftShader ran a place
                      //   at ~1.4 us (an 8000-place tick 10.9 ms) - so the pass and the binding also stop at this many ms
  };
  // the finish -> the record's class (what the block draws: 0 metal, 1 fabric, 2 wood, 3 other, 4 glass)
  const CLS = { metal: 0, fabric: 1, wood: 2, other: 3, glass: 4 };
  const FIN_CLS = {
    alclad: 0, bareAlu: 0, trim: 0, fireFoil: 0, panelMetal: 0, sillAlu: 0, castAlu: 0, chrome: 0, bronze: 0, copper: 0,
    steelTube: 0, exhaust: 0,
    fabric: 1, liner: 1, webbing: 1,
    ply: 2, spruce: 2, maple: 2, walnut: 2, walnutFig: 2,
    glass: 4, glassTint: 4, acrylicEdge: 3,
  };
  const clsOf = fin => (fin in FIN_CLS ? FIN_CLS[fin] : 3);
  // the substrate each class shows where the paint goes (the weathering's table: aeroweather.js AERO_WX_SUB, through its
  // finish rows - painted alloy is bare alloy); `prim` the primer ring on metal (zinc chromate, linear)
  const SUB_FIN = ['alclad', 'fabric', 'ply', 'plastic', 'glass'];
  const PRIMER = [0.30, 0.33, 0.12];

  const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ---- THE FIELDS: per node and per member, from one damage state (the page's simViewDmgState, the gate's alike) ----
  // def: the def (beams' A, mat, L); D: { wB, set, sW, sD, sN, sG }; B: { X0, Y0 } the body's rest axes in the records'
  // DESIGN frame (aft, up: app.js brkCage's K.B0 columns) - the solver's body-frame vectors (aft, up, right) land there
  function fields(def, D, B) {
    const n = def.nodes.length, nb = def.beams.length, crash = (typeof GEN_CRASH !== 'undefined' && GEN_CRASH) || (typeof globalThis !== 'undefined' && globalThis.GEN_CRASH) || {};
    const cN = new Float32Array(n), eB = new Float32Array(nb), sI = new Float32Array(n), sDir = new Float32Array(n * 3),
          sInto = new Float32Array(n * 3), soil = new Float32Array(n);
    let any = 0;
    if (D.wB) for (let bi = 0; bi < nb; bi++) {
      const w = D.wB[bi]; if (!(w > 0)) continue;
      const b = def.beams[bi], R = crash[b.mat], sy = R && R.ty ? R.ty : 3e8, A = b.A > 0 ? b.A : 5e-5, L = b.L > 0 ? b.L : 0.5;
      const e = w / (sy * A * L), I = Math.pow(smooth(SC.eps0, SC.eps1, e), 0.8);
      eB[bi] = e;
      if (I > cN[b.a]) cN[b.a] = I;
      if (I > cN[b.b]) cN[b.b] = I;
      if (I > 0) any++;
    }
    const X = B.X0, Y = B.Y0, Z = [Y[1] * X[2] - Y[2] * X[1], Y[2] * X[0] - Y[0] * X[2], Y[0] * X[1] - Y[1] * X[0]];   // right = up x aft
    const toD = (a, u, r, out, o) => { out[o] = a * X[0] + u * Y[0] + r * Z[0]; out[o + 1] = a * X[1] + u * Y[1] + r * Z[1]; out[o + 2] = a * X[2] + u * Y[2] + r * Z[2]; };
    if (D.sW) for (let i = 0; i < n; i++) {
      const w = D.sW[i]; if (!(w > 0)) continue;
      sI[i] = 1 - Math.exp(-w / SC.scrapeW);
      toD(D.sD[i * 3], D.sD[i * 3 + 1], D.sD[i * 3 + 2], sDir, i * 3);
      toD(D.sN[i * 3], D.sN[i * 3 + 1], D.sN[i * 3 + 2], sInto, i * 3);
      soil[i] = D.sG ? clamp01(D.sG[i]) : 0;
      any++;
    }
    // the members' set in metres (a pane's frame distortion)
    const setM = new Float32Array(nb);
    if (D.set) for (let bi = 0; bi < nb; bi++) if (D.set[bi]) { setM[bi] = Math.abs(D.set[bi]) * (def.beams[bi].L || 0.5); any++; }
    return { n, nb, cN, eB, sI, sDir, sInto, soil, setM, zero: !any, def };
  }

  // ---- A RECORD'S PASS ----
  // the record's scuff state: places (each place's first vertex), the triangle incidence (for the torn band and the
  // panes), its class, and the output bytes in the record's own vertex order
  function prep(R, o) {
    if (R.sc) return R.sc;
    const nv = R.nv, rp = R.rep;
    const pl = []; const plOf = new Int32Array(nv);
    for (let v = 0; v < nv; v++) { if (!rp || rp[v] === v) { plOf[v] = pl.length; pl.push(v); } }
    if (rp) for (let v = 0; v < nv; v++) if (rp[v] !== v) plOf[v] = plOf[rp[v]];
    R.sc = { pl: Int32Array.from(pl), plOf, cls: o && o.cls != null ? o.cls : 3, nrm: (o && o.nrm) || null, base: (o && o.base) || null,
             Mi: (o && o.Mi) || null, nA: (o && o.nA) || null,
             rec: new Uint8Array(nv * 4), dir: new Int8Array(nv * 4), cur: -1, done: true, inc: null, torn: null, panes: null, ver: 0, any: false };
    return R.sc;
  }
  // the places' triangle incidence (CSR): place -> the triangles meeting there, over the record's ORIGINAL index
  function incidence(R) {
    const S = R.sc; if (S.inc) return S.inc;
    const i0 = R.idx0 || R.idx, nt = R.nt, np = S.pl.length, cnt = new Int32Array(np + 1);
    for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) cnt[S.plOf[i0[t * 3 + e]] + 1]++;
    for (let p = 0; p < np; p++) cnt[p + 1] += cnt[p];
    const at = cnt.slice(0, np), lst = new Int32Array(cnt[np]);
    for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) { const p = S.plOf[i0[t * 3 + e]]; lst[at[p]++] = t; }
    return (S.inc = { off: cnt, lst });
  }
  // a place's kept weights (the event's w2 once the record is active - its copies' are its first vertex's: read at the
  // place, never at a copy), clamped >= 0 and renormalised, into W / I; returns the count
  const _W = new Float64Array(16), _I = new Int32Array(16);
  function weightsOf(R, u) {
    const K = R.K, o = u * K, src = (R.active && R.w2) ? R.w2 : R.ww;
    let s = 0, m = 0;
    for (let k = 0; k < K; k++) { const w = src[o + k]; if (w > 0) { _W[m] = w; _I[m] = R.wi[o + k]; s += w; m++; } }
    if (!m) { _W[0] = 1; _I[0] = R.wi[o]; return 1; }
    for (let k = 0; k < m; k++) _W[k] /= s;
    return m;
  }
  // one place: crush, scrape (facing), soil, the slide's direction (the geometry's frame, tangent) -> its bytes
  const _d = new Float64Array(3);
  function place(R, F, u) {
    const S = R.sc, m = weightsOf(R, u), o4 = u * 4;
    let c = 0, s = 0, g = 0; _d[0] = _d[1] = _d[2] = 0;
    const N = S.nrm, nx = N ? N[u * 3] : 0, ny = N ? N[u * 3 + 1] : 0, nz = N ? N[u * 3 + 2] : 0;
    for (let k = 0; k < m; k++) {
      const i = _I[k], w = _W[k];
      c += w * F.cN[i];
      const si = F.sI[i];
      if (si > 0) {
        const ix = F.sInto[i * 3], iy = F.sInto[i * 3 + 1], iz = F.sInto[i * 3 + 2], il = Math.hypot(ix, iy, iz);
        const f = (N && il > 1e-6) ? smooth(SC.face0, SC.face1, (nx * ix + ny * iy + nz * iz) / il) : 0;
        const q = w * si * f;
        if (q > 0) { s += q; g += q * F.soil[i]; _d[0] += q * F.sDir[i * 3]; _d[1] += q * F.sDir[i * 3 + 1]; _d[2] += q * F.sDir[i * 3 + 2]; }
      }
    }
    const rec = S.rec, dir = S.dir;
    rec[o4] = Math.round(255 * clamp01(c));
    rec[o4 + 1] = Math.round(255 * clamp01(s));
    rec[o4 + 3] = s > 0 ? Math.round(255 * clamp01(g / s)) : 0;
    // the direction: design -> the geometry's frame (Mi), then tangent to the skin there (nA, the drawn normal at rest)
    let dx = _d[0], dy = _d[1], dz = _d[2];
    if (S.Mi) { const M = S.Mi; const a = M[0] * dx + M[1] * dy + M[2] * dz, b = M[3] * dx + M[4] * dy + M[5] * dz, cc = M[6] * dx + M[7] * dy + M[8] * dz; dx = a; dy = b; dz = cc; }
    if (S.nA) { const ax = S.nA[u * 3], ay = S.nA[u * 3 + 1], az = S.nA[u * 3 + 2], al = Math.hypot(ax, ay, az) || 1, dn = (dx * ax + dy * ay + dz * az) / (al * al); dx -= dn * ax; dy -= dn * ay; dz -= dn * az; }
    const L = Math.hypot(dx, dy, dz);
    if (L > 1e-9 && s > 0) { dir[o4] = Math.round(127 * dx / L); dir[o4 + 1] = Math.round(127 * dy / L); dir[o4 + 2] = Math.round(127 * dz / L); }
    else dir[o4] = dir[o4 + 1] = dir[o4 + 2] = 0;
    dir[o4 + 3] = S.cls;
    if (c > 0 || s > 0) S.any = true;
  }
  // THE TORN BAND: distances over the live skin (the triangles left) from the places on a removed or torn triangle's
  // edge - a multi-source Dijkstra on the rest positions, out to tornR; the band is 1 at the edge, 0 at tornR
  let _hk = new Float64Array(1024), _hv = new Int32Array(1024);
  function tornBand(R) {
    const S = R.sc, np = S.pl.length, out = S.torn || (S.torn = new Float32Array(np));
    out.fill(0);
    const dead = R.dead, base = S.base;
    if (!R.active || !dead || !base) return 0;
    const isGone = d => d === 1 || d === 2 || d === 5;   // removed, torn, carried off as debris (D4b); WALL's 3 / 4 are its own
    const I = incidence(R), i0 = R.idx0 || R.idx, nt = R.nt;
    // the places on a gone triangle (from the gone triangles: O(triangles), no per-place walk)
    const mark = S.mark || (S.mark = new Uint8Array(np)); mark.fill(0);
    let anyG = false;
    for (let t = 0; t < nt; t++) if (isGone(dead[t])) { anyG = true; for (let e = 0; e < 3; e++) mark[S.plOf[i0[t * 3 + e]]] = 1; }
    if (!anyG) return 0;
    const dist = S.dist || (S.dist = new Float64Array(np)); dist.fill(Infinity);
    let hn = 0;
    const push = (d, p) => {
      if (hn >= _hk.length) { const k2 = new Float64Array(_hk.length * 2), v2 = new Int32Array(_hv.length * 2); k2.set(_hk); v2.set(_hv); _hk = k2; _hv = v2; }
      let i = hn++; _hk[i] = d; _hv[i] = p;
      while (i > 0) { const j = (i - 1) >> 1; if (_hk[j] <= _hk[i]) break; const tk = _hk[i], tv = _hv[i]; _hk[i] = _hk[j]; _hv[i] = _hv[j]; _hk[j] = tk; _hv[j] = tv; i = j; }
    };
    let src = 0;
    for (let p = 0; p < np; p++) {
      if (!mark[p]) continue;
      let live = false;
      for (let q = I.off[p]; q < I.off[p + 1]; q++) if (!isGone(dead[I.lst[q]])) { live = true; break; }
      if (live) { dist[p] = 0; push(0, p); src++; }
    }
    const R2 = SC.tornR;
    while (hn) {
      const d = _hk[0], p = _hv[0];
      hn--; if (hn) { _hk[0] = _hk[hn]; _hv[0] = _hv[hn]; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < hn && _hk[l] < _hk[m]) m = l; if (r < hn && _hk[r] < _hk[m]) m = r; if (m === i) break;
        const tk = _hk[i], tv = _hv[i]; _hk[i] = _hk[m]; _hv[i] = _hv[m]; _hk[m] = tk; _hv[m] = tv; i = m; } }
      if (d > dist[p] || d > R2) continue;
      const u = S.pl[p], ux = base[u * 3], uy = base[u * 3 + 1], uz = base[u * 3 + 2];
      for (let q = I.off[p]; q < I.off[p + 1]; q++) {
        const t = I.lst[q]; if (isGone(dead[t])) continue;
        for (let e = 0; e < 3; e++) {
          const pv = S.plOf[i0[t * 3 + e]]; if (pv === p) continue;
          const w = S.pl[pv], nd = d + Math.hypot(ux - base[w * 3], uy - base[w * 3 + 1], uz - base[w * 3 + 2]);
          if (nd < dist[pv] && nd <= R2) { dist[pv] = nd; push(nd, pv); }
        }
      }
    }
    for (let p = 0; p < np; p++) if (dist[p] <= R2) out[p] = 1 - dist[p] / R2;
    return src;
  }
  // THE PANES of a glass record: its connected pieces, each a severity (its nodes' hit, its frame's set) and an impact
  // place (the most hit; with the set alone, the place nearest the worst-set member's middle)
  function panesOf(R, F) {
    const S = R.sc, np = S.pl.length, I = incidence(R), i0 = R.idx0 || R.idx, P = new Int32Array(np);
    for (let p = 0; p < np; p++) P[p] = p;
    const f = x => { while (P[x] !== x) { P[x] = P[P[x]]; x = P[x]; } return x; };
    for (let t = 0; t < R.nt; t++) { const a = f(S.plOf[i0[t * 3]]), b = f(S.plOf[i0[t * 3 + 1]]), c = f(S.plOf[i0[t * 3 + 2]]); if (a !== b) P[a] = b; const bb = f(b); if (f(c) !== bb) P[f(c)] = bb; }
    const comp = new Map();
    for (let p = 0; p < np; p++) { const r = f(p); let C = comp.get(r); if (!C) comp.set(r, C = { pl: [], hit: 0, at: -1, nodes: new Set() }); C.pl.push(p); }
    const out = [];
    const def = F.def, T = R.T || null;
    for (const C of comp.values()) {
      if (C.pl.length < 3) continue;
      for (const p of C.pl) {
        const u = S.pl[p], m = weightsOf(R, u); let h = 0;
        for (let k = 0; k < m; k++) { const i = _I[k]; h += _W[k] * Math.max(F.cN[i], F.sI[i]); if (_W[k] > 0.15) C.nodes.add(i); }
        if (h > C.hit) { C.hit = h; C.at = p; }
      }
      // the frame's distortion: the worst set (m) of a member with an end at one of its nodes
      let sm = 0, sb = -1;
      for (let bi = 0; bi < F.nb; bi++) { const x = F.setM[bi]; if (x > sm) { const b = def.beams[bi]; if (C.nodes.has(b.a) || C.nodes.has(b.b)) { sm = x; sb = bi; } } }
      const sSet = smooth(SC.paneSet0, SC.paneSet1, sm);
      const sev = Math.max(C.hit, sSet);
      if (sev < SC.paneHit0) continue;
      let at = C.at;
      if (!(C.hit >= sSet) && sb >= 0 && S.base && R.restN) {
        // nearest place to the member's middle (design frame)
        const b = def.beams[sb], rn = R.restN, mx = (rn[b.a * 3] + rn[b.b * 3]) / 2, my = (rn[b.a * 3 + 1] + rn[b.b * 3 + 1]) / 2, mz = (rn[b.a * 3 + 2] + rn[b.b * 3 + 2]) / 2;
        let bd = Infinity; for (const p of C.pl) { const u = S.pl[p], d = Math.hypot(S.base[u * 3] - mx, S.base[u * 3 + 1] - my, S.base[u * 3 + 2] - mz); if (d < bd) { bd = d; at = p; } }
      }
      if (at < 0) at = C.pl[0];
      out.push({ R, pl: C.pl, sev: Math.min(1, sev), at: S.pl[at], slot: -1 });
    }
    return out;
  }

  // ---- THE PASS OVER A MODEL'S RECORDS (budgeted, never restarted) ----
  // st: { recs, F, q (the records owed), panes (every pane, slotted), next (the newest event's, waiting for the pass to
  // end - a crash sends a payload every 0.1 s of sim time, and a pass restarted at each would never end) }.
  // request() on an event, tick() each frame; a pass begins when none is running
  function state() { return { recs: [], F: null, q: [], panes: [], next: null, ver: 0, passes: 0, ms: { pass: 0, frameMax: 0, torn: 0, n: 0 }, places: 0 }; }
  function request(st, F, recs) { st.next = { F, recs: recs.slice() }; }
  function begin(st, F, recs) {
    st.F = F; st.recs = recs.slice(); st.ver++; st.passes++; st.q = []; st.panes = [];
    for (const R of st.recs) { const S = R.sc; if (!S) continue; S.cur = 0; S.done = false; S.any = false; S.panes = null; S.phase = 0; st.q.push(R); }
    // the glass first, whole (a few thousand vertices): its panes are slotted across the model before any byte is written
    for (const R of st.q) if (R.sc.cls === CLS.glass) { R.sc.panes = F.zero ? [] : panesOf(R, F); for (const P of R.sc.panes) st.panes.push(P); }
    st.panes.sort((a, b) => b.sev - a.sev || a.at - b.at);
    st.panes.forEach((P, k) => { P.slot = k < SC.panes ? k : -1; });
  }
  // up to `budget` place-units this frame (a place is one; a record's torn band costs a quarter of its places and runs
  // in a tick of its own when the budget left cannot hold it); returns the records finished now (their bytes whole)
  // msCap: the frame's time left for it (a place count is node's; stops between chunks of 256 places past it)
  function tick(st, budget, msCap) {
    if (!st.q.length && st.next) { const N = st.next; st.next = null; begin(st, N.F, N.recs); }
    const t0 = now(), fin = [], B = budget == null ? SC.budget : budget, cap = msCap == null ? Infinity : msCap;
    let left = B;
    while (st.q.length && left > 0 && now() - t0 < cap) {
      const R = st.q[0], S = R.sc, F = st.F, np = S.pl.length;
      if (S.cls === CLS.glass) { glassBytes(R); finish(R); st.q.shift(); fin.push(R); left -= np >> 3; continue; }
      if (F.zero) { S.rec.fill(0); for (let v = 0; v < R.nv; v++) { S.dir[v * 4] = S.dir[v * 4 + 1] = S.dir[v * 4 + 2] = 0; S.dir[v * 4 + 3] = S.cls; } S.any = false; finish(R); st.q.shift(); fin.push(R); left -= np >> 4; continue; }
      if (S.phase === 0) {
        const e = Math.min(np, S.cur + left);
        let p = S.cur;
        while (p < e) { const c = Math.min(e, p + 256); for (; p < c; p++) place(R, F, S.pl[p]); if (p < e && now() - t0 >= cap) break; }
        left -= p - S.cur; st.places += p - S.cur; S.cur = p;
        if (S.cur < np) break;
        S.phase = 1;
      }
      const tc = R.active && R.dead ? np >> 2 : 0;
      if (tc > left && left < B) break;          // the torn band next frame, on its own
      if (tc) { const t1 = now(); tornBand(R); st.ms.torn = Math.max(st.ms.torn, now() - t1); left -= tc;
        const T = S.torn; for (let p = 0; p < np; p++) { if (T[p] > 0) S.any = true; S.rec[S.pl[p] * 4 + 2] = Math.round(255 * T[p]); } }
      else for (let p = 0; p < np; p++) S.rec[S.pl[p] * 4 + 2] = 0;
      finish(R); st.q.shift(); fin.push(R);
    }
    const dt = now() - t0; st.ms.frameMax = Math.max(st.ms.frameMax, dt); st.ms.pass += dt; st.ms.n++;
    return fin;
  }
  const busy = st => st.q.length > 0 || !!st.next;
  // a glass record's bytes: its panes' severity and slot on every vertex of the pane, the rest clean
  function glassBytes(R) {
    const S = R.sc; S.rec.fill(0);
    for (let v = 0; v < R.nv; v++) { S.dir[v * 4] = S.dir[v * 4 + 1] = S.dir[v * 4 + 2] = 0; S.dir[v * 4 + 3] = CLS.glass; }
    for (const P of S.panes || []) {
      if (P.slot < 0) continue;
      for (const p of P.pl) { const u = S.pl[p]; S.rec[u * 4] = Math.round(255 * P.sev); S.dir[u * 4 + 3] = CLS.glass + 8 * P.slot; }
      S.any = true;
    }
  }
  // the copies take their place's bytes; the record is whole
  function finish(R) {
    const S = R.sc, rp = R.rep;
    if (rp) for (let v = 0; v < R.nv; v++) { const u = rp[v]; if (u === v) continue; for (let k = 0; k < 4; k++) { S.rec[v * 4 + k] = S.rec[u * 4 + k]; S.dir[v * 4 + k] = S.dir[u * 4 + k]; } }
    S.done = true; S.ver++;
  }
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // the pane slots' uniform values: [x, y, z (the impact, the geometry's frame), severity] per slot - pos(R, u) gives a
  // vertex's place in the drawing's frame
  function paneVec(st, posOf) {
    const out = new Float32Array(SC.panes * 4);
    for (const P of st.panes) { if (P.slot < 0) continue; const q = posOf(P); out[P.slot * 4] = q[0]; out[P.slot * 4 + 1] = q[1]; out[P.slot * 4 + 2] = q[2]; out[P.slot * 4 + 3] = P.sev; }
    return out;
  }
  // NO-BREAK SCUFF (a scrape, a dent - nothing broken, so no event bound the record): the places whose nearest node is
  // damaged get skin_break's own binding (its bindNearest, into the record's own arrays, flagged bound - what its
  // bindSome does at a break), `budget` places a frame. Returns the places bound
  function bindWanted(R, F, SB, T, budget) {
    if (!R.g || !R.g.near || !R.g.bound || !(budget > 0)) return 0;
    const S = R.sc, nv = R.nv, near = R.g.near, bound = R.g.bound;
    const want = [];
    for (const u of S.pl) { if (bound[u]) continue; const i = near[u]; if (F.cN[i] > 0 || F.sI[i] > 0) { want.push(u); if (want.length >= budget) break; } }
    if (!want.length) return 0;
    const mask = new Uint8Array(nv); for (const u of want) mask[u] = 1;
    SB.bindNearest(R.g.pos, nv, R.g.rest, T.n, R.K, mask, R.g, null);
    for (const u of want) bound[u] = 1;
    if (R.rep) { const rp = R.rep, K = R.K; for (let v = 0; v < nv; v++) { const u = rp[v]; if (u !== v && mask[u]) { bound[v] = 1; for (let k = 0; k < K; k++) { R.wi[v * K + k] = R.wi[u * K + k]; R.ww[v * K + k] = R.ww[u * K + k]; } } } }
    return want.length;
  }
  // rest normals per vertex from a rest position array and an index (area-weighted, welded through rep) - the gate's
  // generated meshes and any record without its normals in the design frame
  function restNormals(base, idx, nv, rep) {
    const N = new Float32Array(nv * 3);
    for (let t = 0; t + 2 < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const ux = base[b * 3] - base[a * 3], uy = base[b * 3 + 1] - base[a * 3 + 1], uz = base[b * 3 + 2] - base[a * 3 + 2];
      const vx = base[c * 3] - base[a * 3], vy = base[c * 3 + 1] - base[a * 3 + 1], vz = base[c * 3 + 2] - base[a * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const v of [a, b, c]) { const w = rep ? rep[v] : v; N[w * 3] += nx; N[w * 3 + 1] += ny; N[w * 3 + 2] += nz; }
    }
    for (let v = 0; v < nv; v++) { const w = rep ? rep[v] : v; const x = N[w * 3], y = N[w * 3 + 1], z = N[w * 3 + 2], L = Math.hypot(x, y, z) || 1;
      if (w === v) { N[v * 3] = x / L; N[v * 3 + 1] = y / L; N[v * 3 + 2] = z / L; } }
    if (rep) for (let v = 0; v < nv; v++) { const w = rep[v]; if (w !== v) { N[v * 3] = N[w * 3]; N[v * 3 + 1] = N[w * 3 + 1]; N[v * 3 + 2] = N[w * 3 + 2]; } }
    return N;
  }

  // =====================================================================================================================
  // THE SHADER. NO BACKTICKS, NO ${ INSIDE THE GLSL. Every texture read is textureGrad on derivatives taken in uniform
  // control flow (before the per-fragment early-out); every loop bound a #define.
  // =====================================================================================================================
  const AERO_DMG_VS_PARS = `
attribute vec4 aDmg;    // DMG-SCUFF: crush, scrape, torn band, soil (glass: x the pane's severity)
attribute vec4 aDmgD;   // the slide's direction (the geometry's frame), w the class + 8 x the pane slot
varying vec4 vDmg;
varying vec4 vDmgD;
#ifndef DMG_OBJ
varying vec3 vDmgP;
varying vec3 vDmgN;
#endif
`;
  const AERO_DMG_VS_MAIN = `
  vDmg = aDmg;
  vDmgD = vec4(aDmgD.xyz, floor(aDmgD.w * 127.0 + 0.5));
#ifndef DMG_OBJ
  vDmgP = transformed;
  vDmgN = objectNormal;
#endif
`;
  const AERO_DMG_FS_PARS = `
#define DMG_PANES 8
uniform float uDmgOn;            // 0 until the first record is written: one compare for an intact aeroplane
uniform float uDmgM;             // metres a unit of the geometry's frame (1 in flight)
uniform vec4 uDmgPane[DMG_PANES];// the panes: xyz the impact (the geometry's frame), w the severity
uniform vec4 uDmgSub[4];         // the substrate a class shows (rgb, metal): metal, fabric, wood, other
uniform vec4 uDmgSub2[4];        // ...its roughness (x)
uniform vec4 uDmgCol[4];         // 0 primer, 1 soil, 2 grass stain, 3 the dark of a crease / a fray (rgb, roughness floor)
uniform vec4 uDmgK;              // x crush gain  y scrape gain  z torn gain  w relief gain
uniform float uDmgG;             // the panes' crack gain
uniform sampler2D tDmgG;         // the weathering's grunge sheet (aeroweather.js aeroWxGrungeTex)
varying vec4 vDmg;
varying vec4 vDmgD;
#ifdef DMG_OBJ
#define DMG_P vObjPos
#define DMG_N vObjNrm
#else
varying vec3 vDmgP;
varying vec3 vDmgN;
#define DMG_P vDmgP
#define DMG_N vDmgN
#endif
float dmgCov = 0.0;              // what the damage took off the clear coat
float dmgH3(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
// value noise in 3-D with its gradient (xyz) - a relief bends the normal by its own gradient, no derivative of a
// derivative needed inside the divergent branch
vec4 dmgVN(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  vec3 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = dmgH3(i), b = dmgH3(i + vec3(1.0, 0.0, 0.0)), c = dmgH3(i + vec3(0.0, 1.0, 0.0)), d = dmgH3(i + vec3(1.0, 1.0, 0.0));
  float e = dmgH3(i + vec3(0.0, 0.0, 1.0)), g = dmgH3(i + vec3(1.0, 0.0, 1.0)), h = dmgH3(i + vec3(0.0, 1.0, 1.0)), k = dmgH3(i + vec3(1.0, 1.0, 1.0));
  float k0 = a, k1 = b - a, k2 = c - a, k3 = e - a, k4 = a - b - c + d, k5 = a - c - e + h, k6 = a - b - e + g, k7 = -a + b + c - d + e - g - h + k;
  float v = k0 + k1 * u.x + k2 * u.y + k3 * u.z + k4 * u.x * u.y + k5 * u.y * u.z + k6 * u.z * u.x + k7 * u.x * u.y * u.z;
  vec3 gr = du * vec3(k1 + k4 * u.y + k6 * u.z + k7 * u.y * u.z, k2 + k5 * u.z + k4 * u.x + k7 * u.z * u.x, k3 + k6 * u.x + k5 * u.y + k7 * u.x * u.y);
  return vec4(v, gr);
}
// cells in 3-D: x the distance to the nearest centre, y to the second (F2 - F1 is a crack network), z the nearest's id
vec3 dmgCell(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int z = -1; z <= 1; ++z) for (int y = -1; y <= 1; ++y) for (int xx = -1; xx <= 1; ++xx) {
    vec3 o = vec3(float(xx), float(y), float(z));
    float h = dmgH3(i + o);
    vec3 r = o + vec3(h, dmgH3(i + o + 17.1), dmgH3(i + o + 41.3)) * 0.85 - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = h; } else if (d < d2) { d2 = d; }
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}
`;
  // THE SKIN'S BLOCK (the live AEROSKIN and the baked flown material), before lights_physical_fragment: the albedo, the
  // roughness, the metalness and the normal are all final here, and the clear coat is still to be made
  const AERO_DMG_SURF_FS = `
  if (uDmgOn > 0.0) {
    vec3 dP = DMG_P * uDmgM;
    vec3 dPx = dFdx(dP), dPy = dFdy(dP);                  // uniform control flow: the footprint for every read below
    float dFw = max(length(dPx) + length(dPy), 1e-5);     // metres a pixel here
    vec4 dR = vDmg;
    if (max(max(dR.x, dR.y), dR.z) > 0.004) {
      float dCls = mod(vDmgD.w, 8.0);
      float dMet = 1.0 - step(0.5, dCls), dFab = step(0.5, dCls) * (1.0 - step(1.5, dCls)), dWood = step(1.5, dCls) * (1.0 - step(2.5, dCls));
      int dCi = int(min(dCls, 3.0) + 0.5);
      vec3 dSub = uDmgSub[dCi].rgb; float dSubM = uDmgSub[dCi].a, dSubR = uDmgSub2[dCi].x;
      vec3 dN = normalize(DMG_N);
      vec3 col = diffuseColor.rgb; float rgh = roughnessFactor, met = metalnessFactor;
      vec3 dGrad = vec3(0.0);                             // the relief's gradient, the geometry's frame (m / m)
      float cr = clamp(dR.x * uDmgK.x, 0.0, 1.0);
      // ---- CRUSH ------------------------------------------------------------------------------------------------
      if (cr > 0.0) {
        vec4 nB = dmgVN(dP * 7.0);                         // the dents: a 14 cm buckle field
        vec4 nF = dmgVN(dP * 31.0 + 5.3);                  // finer creases
        // fabric: SLACK - wrinkles that run one way in a patch (a ridged field), dark in the valleys, the dope's sheen gone
        float wr = 1.0 - abs(2.0 * nB.x - 1.0);
        float wr2 = 1.0 - abs(2.0 * nF.x - 1.0);
        float crease = smoothstep(0.55, 0.95, max(wr, 0.8 * wr2)) * cr;
        col = mix(col, col * mix(vec3(1.0), uDmgCol[3].rgb * 3.0, 0.55), dFab * crease);
        rgh = mix(rgh, max(rgh, 0.92), dFab * cr);
        dGrad += dFab * cr * (nB.yzw * 7.0 * 0.006 + nF.yzw * 31.0 * 0.0015);
        // metal: the paint CRAZES - a crack network on cells of ~2.6 cm, broken by a noise so it is a network in places,
        // not a tiling - and where the crush is worst whole cells FLAKE off (polygons along the network, not discs),
        // clustered by the buckle field: zinc-chromate primer at a flake's edge, bare alloy in it; the sheet dents
        // (the cells read through a warp - the buckle and crease fields bend them - so the network is a craquelure, not
        // a honeycomb)
        // (the network fades where a cell would cover fewer than ~4 pixels: far off it is a moire, not a craquelure)
        // (the warp's own slope stays well under the cells' 38 a metre - 1.6 x the 31/m crease field FOLDED the domain
        // and the cells drew as contour stripes on the real page's cowl)
        vec3 cc = dmgCell(dP * 38.0 + vec3(0.5 * (nB.x - 0.5) + 0.2 * (nF.x - 0.5), 0.5 * (nB.x - 0.5) - 0.2 * (nF.x - 0.5), 0.3 * (nF.x - 0.5)));
        float edgeD = cc.y - cc.x;
        float crack = (1.0 - smoothstep(0.0, 0.03 + 38.0 * dFw, edgeD)) * (1.0 - smoothstep(0.003, 0.008, dFw));
        float crz = crack * smoothstep(0.40, 0.85, cr) * smoothstep(0.45, 0.70, nF.x + 0.2 * cr);
        float flake = step(cc.z, 0.12 * smoothstep(0.70, 1.0, cr)) * step(0.55 - 0.15 * cr, nB.x);
        float rim = flake * (1.0 - smoothstep(0.03, 0.10, edgeD));
        col = mix(col, col * 0.72, dMet * crz * (1.0 - flake));
        col = mix(col, dSub, dMet * flake);
        col = mix(col, uDmgCol[0].rgb, dMet * rim);
        met = mix(met, dSubM, dMet * flake * (1.0 - rim));
        rgh = mix(rgh, dSubR, dMet * flake * (1.0 - rim));
        rgh = mix(rgh, max(rgh, uDmgCol[0].w), dMet * rim);
        dGrad += dMet * cr * nB.yzw * 7.0 * 0.004;
        float chipOn = flake;
        // wood: SPLINTERS - thin pale raw grain torn along the part, dark splits between, sparse
        float sp = dmgVN(vec3(dP.x * 3.0, dP.y * 90.0, dP.z * 90.0)).x;
        float spl = smoothstep(0.78, 0.84, sp) * smoothstep(0.35, 0.8, cr);
        col = mix(col, dSub * 1.35, dWood * spl);
        col = mix(col, uDmgCol[3].rgb, dWood * (1.0 - smoothstep(0.0, 0.03, abs(sp - 0.5))) * cr * 0.6);
        rgh = mix(rgh, max(rgh, dSubR), dWood * cr);
        // everything crushed: a little grime in the folds, never shiny (the weathering's rule)
        col = mix(col, col * 0.8, cr * 0.3 * (1.0 - wr));
        dmgCov = max(dmgCov, max(cr * 0.6, max(dMet * chipOn, dWood * spl)));
      }
      // ---- SCRAPE -----------------------------------------------------------------------------------------------
      float sc = clamp(dR.y * uDmgK.y, 0.0, 1.0);
      vec3 dD = vDmgD.xyz;
      float dDl = length(dD);
      if (sc > 0.0 && dDl > 0.05) {
        dD /= dDl;
        vec3 dAc = normalize(cross(dN, dD) + vec3(1e-5));
        // the scratch read of the weathering, stretched ALONG the slide: across at 1 cm, along at 0.9 m
        vec2 sUV = vec2(dot(dP, dAc) / 0.010, dot(dP, dD) / 0.9);
        vec2 sGx = vec2(dot(dPx, dAc) / 0.010, dot(dPx, dD) / 0.9), sGy = vec2(dot(dPy, dAc) / 0.010, dot(dPy, dD) / 0.9);
        float g1 = textureGrad(tDmgG, sUV * 0.05 + vec2(0.13, 0.57), sGx * 0.05, sGy * 0.05).b;
        float g2 = textureGrad(tDmgG, sUV * vec2(0.013, 0.02) + vec2(0.71, 0.29), sGx * vec2(0.013, 0.02), sGy * vec2(0.013, 0.02)).r;
        // (at full scrape about a sixth of the surface is streaked through - the rest abraded, dull. A streak under a
        // few pixels across fades to the abrasion's tone: thin bright lines whose direction follows a curved skin read
        // as contour stripes on the real page's cowl - a trunk's rub over the whole nose)
        float sth = 0.78 - 0.12 * sc, sNear = 1.0 - smoothstep(0.004, 0.009, dFw);
        float st = smoothstep(sth, sth + 0.05, g1) * smoothstep(0.15, 0.55, sc + 0.4 * g2 - 0.2) * sNear;
        float stDeep = smoothstep(sth + 0.10, sth + 0.14, g1) * st;
        float soil = dR.w;
        // the broad abrasion first: dull, paler, the varnish gone
        float ab = smoothstep(0.1, 0.6, sc);
        col = mix(col, mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), 0.35) * 1.05, ab * 0.4);
        rgh = mix(rgh, max(rgh, 0.78), ab);
        // the streaks: ground through to what is under the paint - on metal the bare alloy (the primer at the streak's
        // edge); on doped fabric the SILVER coat first (the aluminium-pigmented dope under every colour coat), the raw
        // weave only in a streak's core; on wood the raw grain
        vec3 bare = mix(dSub, vec3(0.42, 0.43, 0.44), dFab);
        col = mix(col, bare, st + (1.0 - sNear) * 0.15 * ab);
        col = mix(col, vec3(0.50, 0.45, 0.34), dFab * stDeep);
        met = mix(met, mix(dSubM, 0.35, dFab) * (1.0 - soil), st);
        rgh = mix(rgh, mix(dSubR * 0.8, 0.5, dFab), st);
        rgh = mix(rgh, 0.95, max(dFab * stDeep, soil * st));
        // ...and the ground in them: soil on soft ground, a green-brown stain from grass, dust on hard ground
        float stain = soil * smoothstep(0.2, 0.7, sc) * (0.45 + 0.55 * g2);
        col = mix(col, mix(uDmgCol[1].rgb, uDmgCol[2].rgb, 0.45 + 0.4 * g2), stain * (0.15 + 0.45 * st));
        rgh = mix(rgh, max(rgh, uDmgCol[1].w), stain);
        met *= 1.0 - stain;
        dmgCov = max(dmgCov, max(ab, st));
      }
      // ---- TORN EDGE --------------------------------------------------------------------------------------------
      float tb = clamp(dR.z * uDmgK.z, 0.0, 1.0);
      if (tb > 0.0) {
        vec4 nT = dmgVN(dP * 90.0);
        float jag = tb + 0.25 * (nT.x - 0.5);
        // fabric: FRAYED - back from the edge the dope has cracked (its own network, dark lines on the colour, the sheen
        // gone); at the edge the raw weave shows, pale, torn into threads along the cell borders
        float fray = smoothstep(0.35, 0.85, jag);
        vec3 fc = dmgCell(dP * 70.0);
        float dope = (1.0 - smoothstep(0.0, 0.06 + 70.0 * dFw, fc.y - fc.x)) * fray;
        float edgeF = smoothstep(0.78, 0.92, jag);
        float thr = edgeF * (1.0 - smoothstep(0.0, 0.12 + 70.0 * dFw, fc.y - fc.x));
        col = mix(col, col * 0.4, dFab * dope * 0.8);
        col = mix(col, vec3(0.50, 0.45, 0.34), dFab * max(edgeF * 0.7, thr));
        col = mix(col, col * 0.75, dFab * fray * 0.3);
        rgh = mix(rgh, 1.0, dFab * fray);
        // metal: a ragged BRIGHT edge (the sheet's own alloy where it tore), the paint cracked behind it
        float edge = smoothstep(0.80, 0.92, jag);
        col = mix(col, dSub * 1.15, dMet * edge);
        met = mix(met, max(dSubM, 0.85), dMet * edge);
        rgh = mix(rgh, 0.35, dMet * edge);
        col = mix(col, col * 0.55, dMet * smoothstep(0.45, 0.8, jag) * (1.0 - edge) * 0.6);
        // wood: splinters at the edge
        col = mix(col, dSub * 1.3, dWood * edge);
        dGrad += (dFab + dWood) * tb * nT.yzw * 90.0 * 0.0008;
        dmgCov = max(dmgCov, max(fray * dFab, edge));   // (the varnish gone where the dope cracked)
      }
      diffuseColor.rgb = col;
      roughnessFactor = clamp(rgh, 0.02, 1.0);
      metalnessFactor = clamp(met, 0.0, 1.0);
      // THE RELIEF: the gradient (the geometry's frame) to the view frame and off the surface's own plane
      vec3 dGv = normalize(normalMatrix * (dGrad + dN * 1e-6)) * length(dGrad) * uDmgK.w;
      normal = normalize(normal - (dGv - normal * dot(dGv, normal)));
    }
  }
`;
  // THE GLASS'S BLOCK: an acrylic crack from the pane's impact point - radial cracks (one a sector, a jittered angle, a
  // wobble along it, a fork), arcs of crazing round the point, the crack's stress-whitening; the lines are a pale film
  // in the add pass (the multiply pass is left alone: a crack does not block the light, it scatters it)
  const AERO_DMG_GLASS_FS = `
  if (uDmgOn > 0.0) {
    vec3 dP = DMG_P * uDmgM;
    vec3 dPx = dFdx(dP), dPy = dFdy(dP);
    float dFw = max(length(dPx) + length(dPy), 1e-5);
    float sev = clamp(vDmg.x * uDmgG, 0.0, 1.0);
    if (sev > 0.004) {
      int slot = int(floor(vDmgD.w / 8.0 + 0.01));
      vec4 pn = uDmgPane[0];
      for (int k = 0; k < DMG_PANES; ++k) if (k == slot) pn = uDmgPane[k];
      vec3 dN = normalize(DMG_N);
      vec3 d = dP - pn.xyz * uDmgM;
      d -= dN * dot(d, dN);
      vec3 t1 = normalize(cross(dN, abs(dN.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
      vec3 t2 = cross(dN, t1);
      float r = length(d), ang = atan(dot(d, t2), dot(d, t1));
      float Rm = 0.10 + 0.55 * sev;                        // how far the longest crack runs (m)
      float nR = floor(6.0 + 8.0 * sev);                   // cracks round the point
      float sec = ang / 6.2831853 * nR;
      float m = 0.0;
      float aw = 0.0007 + 0.8 * dFw;                       // a crack's half-width (m), antialiased on the footprint
      for (int j = -1; j <= 1; ++j) {
        float s = floor(sec) + float(j);
        float h = dmgH3(vec3(s, float(slot) * 7.1, 3.7));
        float L = Rm * (0.35 + 0.65 * dmgH3(vec3(s, 11.3, float(slot))));
        float a0 = (s + 0.5 + 0.6 * (h - 0.5)) / nR * 6.2831853;
        float wob = 0.05 * sin(r * 37.0 + h * 6.28) + 0.03 * sin(r * 91.0 + h * 17.0);
        float da = ang - a0 - wob * smoothstep(0.0, 0.03, r);
        da = mod(da + 3.14159265, 6.2831853) - 3.14159265;
        float lin = abs(sin(da)) * r;
        float on = (1.0 - smoothstep(aw * 0.4, aw, lin)) * step(abs(da), 1.2) * (1.0 - smoothstep(L * 0.85, L, r));
        // a fork past mid-run, a third of them
        float fk = step(0.66, h) * step(L * 0.45, r);
        float da2 = da - (h - 0.8) * 1.6 * smoothstep(L * 0.45, L, r);
        float lin2 = abs(sin(da2)) * r;
        on = max(on, fk * (1.0 - smoothstep(aw * 0.4, aw, lin2)) * (1.0 - smoothstep(L * 0.75, L * 0.9, r)) * step(abs(da2), 1.2));
        m = max(m, on);
      }
      // the crazing round the point: broken arcs and a fine crack network within r0
      float r0 = 0.025 + 0.07 * sev;
      float arc = abs(fract(r / 0.011 + 0.4 * dmgH3(vec3(floor(sec * 3.0), 2.0, float(slot)))) - 0.5) * 0.011;
      float arcs = (1.0 - smoothstep(aw * 0.4, aw, arc)) * step(0.45, dmgH3(vec3(floor(ang * 9.0), floor(r / 0.011), 5.0))) * (1.0 - smoothstep(r0 * 0.7, r0, r));
      vec3 cl = dmgCell(dP * 160.0);
      float web = (1.0 - smoothstep(0.0, 0.05 + 160.0 * dFw, cl.y - cl.x)) * (1.0 - smoothstep(r0 * 0.3, r0 * 0.6, r));
      m = max(m, max(arcs, web));
      // the whitening: the lines themselves, and a faint haze round the impact
      float haze = (1.0 - smoothstep(0.0, r0 * 1.2, r)) * 0.35 * sev;
      float wh = clamp(m * (0.55 + 0.45 * sev) + haze, 0.0, 1.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.82, 0.83), wh);
      diffuseColor.a = max(diffuseColor.a, 0.85 * wh);
      roughnessFactor = max(roughnessFactor, mix(roughnessFactor, 0.55, wh));
      dmgCov = max(dmgCov, 0.5 * m);
    }
  }
`;
  // after lights_physical_fragment: the clear coat falls where the damage took the paint or the varnish
  const AERO_DMG_CC_FS = `
#ifdef USE_CLEARCOAT
  material.clearcoat *= 1.0 - dmgCov;
  material.clearcoatRoughness = min(1.0, max(material.clearcoatRoughness, dmgCov * 0.6));
#endif
`;

  // ---- THE WRAPPER: a hook that runs the material's own and splices the block (never made with damage OFF) ----
  // kind: 'live' (AEROSKIN: vObjPos / vObjNrm exist), 'glass' (AEROGLASS: likewise), 'baked' (the flown bake's: its own
  // varyings). U: the shared uniform block (uniforms()). The wrapper's text names the hook it wraps, so its program key
  // is its own (three keys a program on the hook's toString) - and every material wrapped round the same hook shares one
  // W (waker(): the flight's own, app.js scuffFor): THE BLOCK SLEEPS UNTIL THE FIRST DAMAGE. Asleep the wrapper is the
  // hook it wraps and nothing more - the plain program's source under its own key ('dmg.scuff|asleep|'): an intact
  // aeroplane draws exactly what it draws with damage off (no attribute read, no varying, no branch). Awake it splices
  // the block. three keeps EVERY program a material was compiled to, by key (its properties' programs map), so the
  // roll-out compiles each wrapped material both ways (app.js scuffPrelink) and waking (wakeSet: the key flips, each
  // material's version bumped) finds its program linked: no link at the crash. Without W (the bench's legacy, the
  // GLSL test) the wrapper is always awake
  const WRAPS = new Map();
  function waker() { return { on: false, awake: false, pre: 0, mats: new Set(), wraps: new Map(), flips: 0 }; }
  // asleep or awake: awake once the records hold damage (W.awake) or while the roll-out links the awake programs (W.pre)
  function wakeSet(W) {
    const v = W.awake || W.pre > 0;
    if (v === W.on) return false;
    W.on = v; W.flips++;
    for (const m of W.mats) m.needsUpdate = true;
    return true;
  }
  function wrap(h, kind, U, W) {
    const key = kind + '|' + (h ? h.toString() : '');
    const C = W ? W.wraps : WRAPS;
    let w = C.get(key);
    if (w) return w;
    w = function (sh, r) {
      if (h) h.call(this, sh, r);
      // (the uniforms asleep too: a program found in the material's map keeps the LAST compile's uniforms object)
      for (const k in U) sh.uniforms[k] = U[k];
      if (W) { W.mats.add(this); if (!W.on) return; }
      const obj = kind !== 'baked';
      const def = '#define DMG_SCUFF 1\n' + (obj ? '#define DMG_OBJ 1\n' : '');
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', def + AERO_DMG_VS_PARS + '#include <common>')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + AERO_DMG_VS_MAIN);
      const nm = /uniform\s+mat3\s+normalMatrix\s*;/.test(sh.fragmentShader) ? '' : 'uniform mat3 normalMatrix;\n';
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', def + nm + AERO_DMG_FS_PARS + '#include <common>')
        .replace('#include <lights_physical_fragment>', (kind === 'glass' ? AERO_DMG_GLASS_FS : AERO_DMG_SURF_FS)
                 + '#include <lights_physical_fragment>\n' + AERO_DMG_CC_FS);
    };
    w.toString = W ? () => 'dmg.scuff|' + (W.on ? '' : 'asleep|') + key : () => 'dmg.scuff|' + key;
    w.scuffKind = kind;
    C.set(key, w);
    return w;
  }
  // the shared uniforms (one object: one write reaches every wrapped program). THREE and the weathering's module (for
  // the palette, the substrates and the grunge sheet) - the weathering's own values, not copies of its numbers
  let UNI = null;
  function uniforms(THREE) {
    if (UNI) return UNI;
    const WX = (typeof AEROWX !== 'undefined' && AEROWX) || null;
    const subOf = f => (WX && WX.aeroWxSubOf ? WX.aeroWxSubOf(f) : (WX && WX.AERO_WX_SUB && WX.AERO_WX_SUB[f]) || { col: [0.5, 0.5, 0.5], metal: 0, rough: 0.8 });
    const subs = SUB_FIN.slice(0, 4).map(subOf);
    const colOf = k => { const C = WX && WX.AERO_WX_COL && WX.AERO_WX_COL.find(c => c.k === k); return C ? C.v : [0.085, 0.062, 0.040, 0.95]; };
    const soil = colOf('dirt'), grime = colOf('grime');
    UNI = {
      uDmgOn: { value: 0 }, uDmgM: { value: 1 },
      uDmgPane: { value: Array.from({ length: SC.panes }, () => new THREE.Vector4(0, 0, 0, 0)) },
      uDmgSub: { value: subs.map(s => new THREE.Vector4(s.col[0], s.col[1], s.col[2], s.metal)) },
      uDmgSub2: { value: subs.map(s => new THREE.Vector4(s.rough, 0, 0, 0)) },
      uDmgCol: { value: [new THREE.Vector4(PRIMER[0], PRIMER[1], PRIMER[2], 0.85),               // zinc chromate under the paint
                         new THREE.Vector4(soil[0], soil[1], soil[2], Math.max(0.9, soil[3])),  // the weathering's dirt
                         new THREE.Vector4(0.045, 0.060, 0.022, 0.92),                          // grass's green-brown juice (linear)
                         new THREE.Vector4(grime[0] * 0.6, grime[1] * 0.6, grime[2] * 0.6, grime[3])] },   // the weathering's grime, deeper
      uDmgK: { value: new THREE.Vector4(1, 1, 1, 1) }, uDmgG: { value: 1 },
      tDmgG: { value: WX && WX.aeroWxGrungeTex ? WX.aeroWxGrungeTex(THREE) : null },
    };
    return UNI;
  }
  const API = { SC, CLS, FIN_CLS, clsOf, fields, prep, incidence, weightsOf, place, tornBand, panesOf, state, request, begin, tick, busy, finish, glassBytes,
                paneVec, bindWanted, restNormals, wrap, waker, wakeSet, uniforms,
                AERO_DMG_VS_PARS, AERO_DMG_VS_MAIN, AERO_DMG_FS_PARS, AERO_DMG_SURF_FS, AERO_DMG_GLASS_FS, AERO_DMG_CC_FS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.SKIN_SCUFF = API;
})();
