// 27w_waterfront.js — THE WATERFRONT'S LAW (G3032, contract v1.42; futureDesigns/WATERFRONT-2026-10-12.md).
//
// `layers.waterfront` is a list of LINES the editor draws with the road's tools:
//   { id: 'f<n>', kind: 'breakwater' | 'revetment' | 'pier' | 'float' | 'boom', name?, pts: [[x, z], ...], P: {...} }
// This part is the PURE half every consumer agrees on - the solver's ground, the composer's footprint, the
// generator's mesh (tools/_waterfront_gen.js, lazy) all read the same law from here:
//
//   THE MOUND (breakwater, revetment): one height field along the line,
//     M(x, z) = top - max(0, d - hw(side)) / slope(side)        d = the distance to the line, side = left / right of travel
//     H(x, z) = max(bed(x, z), M(x, z))
//   The distance to a polyline makes a round head and the round outside of every bend. Every end is round (the
//   references' heads are; a square end is a shape the ground's grade lines cannot follow).
//
//   THE GROUND IT GIVES THE WORLD is a STACK OF ABS GRADE LINES (SCENERY-ED-2's ruling, 12 Oct): the GR raster
//   (27_premises.js, G614) bakes every modifier as A h + B, so a max(h, M) modifier would flatten everything to the
//   crest. The road grade's feather is a smoothstep - ONE grade line over a 1:1.5 flank bulges ~10 % of the mound's
//   height over the drawn slope (0.9 m on Metlakatla's, through the stones). So: one grade line per LEVEL, a level
//   every `dh` of height, each `falloff` = one level's horizontal step, applied outermost first. Between two levels
//   the ground is exactly the smoothstep from one level's height to the next: within 0.096 dh of the straight law
//   (10 cm at dh = 1 m). Every level sits `sink` under the law so no ground pokes through the gaps between stones;
//   the crest `crestSink` (3 cm) under, so the wheels meet the drawn track.
//
//   A PIER expands to MARINE_GEN 'trestle pier' items, one per segment (the head on the last), the way expandAreas
//   turns an area into its v1 entries: the trestle's mesh, finish, weathering, hit raster and cook are MARINE_GEN's.
//
// Pure: no THREE, node and browser.
const WATERFRONT_LAW = (() => {
  'use strict';
  const KINDS = ['breakwater', 'revetment', 'pier', 'float', 'boom'];
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // ---- the line ----------------------------------------------------------------
  function line(pts) {
    const segs = []; let s = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
      if (L < 1e-6) continue;
      segs.push({ a, b, tx: dx / L, tz: dz / L, L, s0: s }); s += L;
    }
    return { pts, segs, len: s };
  }
  // the closest point: distance, the side (+1 left of travel), arc s, cap (-1 past the root, +1 past the head, 0 inside)
  function closest(PL, x, z) {
    let best = null;
    for (const g of PL.segs) {
      const px = x - g.a[0], pz = z - g.a[1];
      const t = clamp(px * g.tx + pz * g.tz, 0, g.L);
      const cx = g.a[0] + g.tx * t, cz = g.a[1] + g.tz * t;
      const d = Math.hypot(x - cx, z - cz);
      if (!best || d < best.d - 1e-9) best = { d, g, t, side: (g.tx * (z - g.a[1]) - g.tz * (x - g.a[0])) >= 0 ? 1 : -1 };
    }
    const s = best.g.s0 + best.t;
    return { d: best.d, side: best.side, s, cap: s <= 1e-6 ? -1 : s >= PL.len - 1e-6 ? 1 : 0 };
  }
  function at(PL, s) {
    s = clamp(s, 0, PL.len);
    let g = PL.segs[PL.segs.length - 1];
    for (const q of PL.segs) if (s <= q.s0 + q.L) { g = q; break; }
    const t = s - g.s0;
    return { x: g.a[0] + g.tx * t, z: g.a[1] + g.tz * t, tx: g.tx, tz: g.tz, nx: -g.tz, nz: g.tx };
  }
  // the line offset `o` to the left (mitred at the corners, the mitre limited to 2)
  function offsetLine(pts, o) {
    if (!o) return pts.map(p => [p[0], p[1]]);
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const n0 = nrmOf(i > 0 ? pts[i - 1] : p, i > 0 ? p : pts[i + 1]), n1 = nrmOf(i + 1 < pts.length ? p : pts[i - 1], i + 1 < pts.length ? pts[i + 1] : p);
      let nx = n0[0] + n1[0], nz = n0[1] + n1[1]; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
      const c = Math.max(0.5, nx * n1[0] + nz * n1[1]);
      out.push([p[0] + nx * o / c, p[1] + nz * o / c]);
    }
    return out;
  }
  function nrmOf(a, b) { const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1; return [-dz / L, dx / L]; }

  // ---- the defaults ----------------------------------------------------------------
  const DEF = {
    breakwater: { crest: 8.0, crestH: 4.0, slopeL: 1.5, slopeR: 1.5, block: 1.6, blockVar: 0.35, band: 1.6, track: 0, trackLook: 'gravel', light: 1, seed: 1 },
    // a REVETMENT is half a mound: the line is its top edge, `water` the side the sea is on (+1 left, -1 right of
    // travel; 0 = the composer reads it off the water), a berm of `berm` on the land side at the crest
    revetment: { crestH: 3.0, slope: 1.5, block: 1.2, blockVar: 0.3, band: 1.4, berm: 2.0, water: 0, wall: 0, seed: 1 },
    pier: { w: 3.2, deck: 2.6, bay: 4.5, pileR: 0.17, pilesPerBent: 2, batter: 0.07, head: 1, headL: 12, headW: 6, rail: 1, railH: 1.05, lamps: 1, lampSpc: 18, ladder: 1, seed: 1 },
    float: { w: 2.6, freeboard: 0.5, module: 6.0, fingers: 'both', pitch: 9.0, fingerL: 10.0, fingerW: 1.0, fingerStart: 6.0, gangway: 1, gangW: 1.2, abut: 2.6, guideSpc: 18, boats: 0.75, seed: 2 },
    boom: { logD: 0.55, logL: 10, gap: 0.6, sag: 0.04, seed: 3 },
  };
  const Pof = e => Object.assign({}, DEF[e.kind] || {}, e.P || {});

  // ---- the mound ---------------------------------------------------------------------
  // the two sides' half-width at the crest and slope, in travel terms (left = +1)
  function sides(e, P, water) {
    if (e.kind === 'revetment') {
      const w = water || P.water || -1;           // the sea's side
      return w > 0 ? { hwL: 0, hwR: P.berm, sL: P.slope, sR: P.slope, top: P.crestH, open: { L: 1, R: 0 } }
        : { hwL: P.berm, hwR: 0, sL: P.slope, sR: P.slope, top: P.crestH, open: { L: 0, R: 1 } };
    }
    return { hwL: P.crest / 2, hwR: P.crest / 2, sL: P.slopeL, sR: P.slopeR, top: P.crestH, open: { L: 1, R: 1 } };
  }
  // mound(e, { waterY, bed, water }) -> { PL, P, top, hwL, hwR, M(x, z), H(x, z) }
  function mound(e, env) {
    const P = Pof(e), wy = env && isFinite(env.waterY) ? env.waterY : 0;
    const bed = env && env.bed ? env.bed : ((x, z) => wy - 6);
    const PL = line(e.pts), S = sides(e, P, env && env.water), top = wy + S.top;
    // every end is ROUND: the ground is a stack of capsules (grade lines), and a square end
    // they cannot follow left a ~7 m strip by each side of the head under the drawn mound
    const M = (x, z) => {
      const c = closest(PL, x, z);
      return top - Math.max(0, c.d - (c.side > 0 ? S.hwL : S.hwR)) / (c.side > 0 ? S.sL : S.sR);
    };
    const H = (x, z) => Math.max(bed(x, z), M(x, z));
    return { PL, P, S, wy, top, hwL: S.hwL, hwR: S.hwR, hw: Math.max(S.hwL, S.hwR), M, H, bed };
  }

  // ---- the ground: a stack of abs grade lines ---------------------------------------------
  // groundLines(e, T1r, { waterY, bed? , dh, sink, crestSink, water }) -> [modifier specs], OUTERMOST FIRST (the
  // composer applies them in order; each inner level overrides the outer within its own width)
  //   T1r(x, z): the ground under the line from every earlier modifier (the composer's) - a level never digs:
  //   its height at a sample is max(T1r there, the level's)
  function groundLines(e, T1r, env) {
    if (e.kind !== 'breakwater' && e.kind !== 'revetment') return [];
    const o = Object.assign({ dh: 1.0, sink: 0.15, crestSink: 0.03, step: 6, deepest: -16 }, env || {});
    const Md = mound(e, o), P = Md.P, S = Md.S, wy = Md.wy, PL = Md.PL;
    if (!PL.segs.length) return [];
    // the line, resampled every `step` (the corners kept)
    const ss = [];
    for (let s = 0; s < PL.len; s += o.step) ss.push(s);
    for (const g of PL.segs) ss.push(g.s0);
    ss.push(PL.len);
    const uniq = [...new Set(ss.map(s => Math.round(s * 1000) / 1000))].sort((a, b) => a - b);
    const base = uniq.map(s => { const f = at(PL, s); return [f.x, f.z]; });
    const out = [];
    // the levels: k = 0 the crest; level k stands dh * k under it, reaching e_k = k dh slope further out each open side
    const levels = [];
    for (let k = 0; ; k++) {
      const T = Md.top - k * o.dh;
      if (T < wy + o.deepest) break;
      const eL = S.open.L ? k * o.dh * S.sL : 0, eR = S.open.R ? k * o.dh * S.sR : 0;
      const aL = S.hwL + eL, aR = S.hwR + eR;
      // a level below the bed everywhere along it moves nothing: stop there (the shelf is at most ~14 m deep)
      let any = false;
      for (let j = 0; j < base.length && !any; j++) {
        const p = base[j], f = at(PL, uniq[j]);
        for (const [ox, oz] of [[0, 0], [f.nx * aL, f.nz * aL], [-f.nx * aR, -f.nz * aR]]) if (Md.bed(p[0] + ox, p[1] + oz) < T - 0.05) { any = true; break; }
      }
      if (!any && k > 0) break;
      levels.push({ k, T, aL, aR, eL, eR });
      if (k > 400) break;
    }
    for (let i = levels.length - 1; i >= 0; i--) {
      const L = levels[i];
      const fall = Math.max(0.5, o.dh * Math.max(S.open.L ? S.sL : 0, S.open.R ? S.sR : 0));
      const pts = offsetLine(base, (L.aL - L.aR) / 2);
      if (pts.length < 2) continue;
      const sink = L.k === 0 ? o.crestSink : o.sink;
      const y = pts.map(p => Math.max(T1r ? T1r(p[0], p[1]) : -Infinity, L.T - sink));
      out.push({ id: e.id + ':m' + L.k, kind: 'grade', pts: pts.map((p, j) => [p[0], p[1], y[j]]), width: L.aL + L.aR, falloff: fall, abs: true });
    }
    return out;
  }
  // shorten a polyline by `by` metres at its end (+1) or its start (-1); never below a 0.5 m stub
  function trimEnd(pts, by, end) {
    if (!(by > 0)) return pts;
    const P = end > 0 ? pts.slice() : pts.slice().reverse();
    let left = by;
    while (P.length >= 2 && left > 0) {
      const b = P[P.length - 1], a = P[P.length - 2], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L > left + 0.5) { const t = (L - left) / L; P[P.length - 1] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; left = 0; }
      else if (P.length > 2) { P.pop(); left -= L; }
      else { const t = Math.min(1, 0.5 / (L || 1)); P[1] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; left = 0; }
    }
    return end > 0 ? P : P.reverse();
  }

  // ---- the footprint: the toe on an assumed bed (plots, trees, the surface, the ttype keep out of it) ------------
  // a polygon about the line at each side's reach to `toeY` (the shelf's -6 m by default), round caps of n
  function footprint(e, env) {
    const o = Object.assign({ toeY: -6, n: 10 }, env || {});
    const PL = line(e.pts);
    if (!PL.segs.length) return [];
    if (e.kind === 'breakwater' || e.kind === 'revetment') {
      const P = Pof(e), S = sides(e, P, o.water), wy = isFinite(o.waterY) ? o.waterY : 0, hgt = wy + S.top - o.toeY;
      const aL = S.hwL + (S.open.L ? hgt * S.sL : 0), aR = S.hwR + (S.open.R ? hgt * S.sR : 0);
      return ribbon(PL, aL, aR, o.n);
    }
    if (e.kind === 'pier') { const P = Pof(e); const hw = Math.max(P.w, P.head ? P.headW : 0) / 2 + 0.5; return ribbon(PL, hw, hw, 2); }
    if (e.kind === 'float') { const P = Pof(e); const r = P.w / 2 + (P.fingers === 'none' ? 0.5 : P.fingerL + 3); return ribbon(PL, P.fingers === 'right' ? P.w / 2 + 0.5 : r, P.fingers === 'left' ? P.w / 2 + 0.5 : r, 2); }
    return ribbon(PL, 1.5, 1.5, 2);
  }
  // the line's outline at aL left, aR right, with half-disc caps of n steps (counter-clockwise in x/z)
  function ribbon(PL, aL, aR, n) {
    const L = offsetLine(PL.pts, aL), R = offsetLine(PL.pts, -aR);
    const cap = (p, t, fw) => {
      const out = [];
      for (let j = 1; j < n; j++) {
        const ph = Math.PI * j / n, c = Math.cos(ph), s = Math.sin(ph), r = lerpR(aL, aR, j / n);
        // from the left normal through the axis direction (fw) to the right normal
        const nx = -t[1], nz = t[0];
        out.push([p[0] + (nx * c + t[0] * fw * s) * r, p[1] + (nz * c + t[1] * fw * s) * r]);
      }
      return out;
    };
    const g0 = PL.segs[0], g1 = PL.segs[PL.segs.length - 1];
    const end = PL.pts[PL.pts.length - 1], start = PL.pts[0];
    const poly = [];
    poly.push(...R);                                                     // the right side, root -> head
    poly.push(...cap(end, [g1.tx, g1.tz], 1).reverse());                 // round the head, right -> left
    poly.push(...L.slice().reverse());                                   // the left side, head -> root
    poly.push(...cap(start, [g0.tx, g0.tz], -1));                        // round the root, left -> right
    return poly;
  }
  const lerpR = (a, b, t) => a + (b - a) * t;

  // ---- a pier, as MARINE_GEN sites ---------------------------------------------------
  // pierSites(e) -> site records, one per segment, in the premises frame the line is drawn in (the sites layer's own
  // form: { id, name, at: { x, z, yaw }, yard: null, fences: [], items: [one 'marine/trestle pier'] }).
  // THE FRAME (placeSite, 27_premises.js): an item's local +x goes to world (cos psi, -sin psi), +z to (sin psi,
  // cos psi), psi = at.yaw + PI + item.yaw. A segment travelling (tx, tz) wants psi = atan2(-tz, tx), so
  // at.yaw = psi - PI; its +z is then the line's LEFT normal (an L head turns left). MARINE_GEN's origin is the
  // footprint's centre: the segment's middle. Each segment runs w/2 past an inner corner so the decks overlap at a
  // bend; the T / L head and the ladder go on the last.
  function pierSites(e) {
    const P = Pof(e), PL = line(e.pts), out = [];
    PL.segs.forEach((g, i) => {
      const last = i === PL.segs.length - 1, ext0 = i > 0 ? P.w / 2 : 0, ext1 = last ? 0 : P.w / 2;
      const L = g.L + ext0 + ext1, mid = L / 2 - ext0;
      const psi = Math.atan2(-g.tz, g.tx);
      const ip = { L, w: P.w, deck: P.deck, bay: P.bay, pileR: P.pileR, pilesPerBent: P.pilesPerBent, batter: P.batter, rail: P.rail, railH: P.railH,
        lamps: P.lamps, lampSpc: P.lampSpc, ladder: last ? P.ladder : 0, head: last ? P.head : 0, headL: P.headL, headW: P.headW, seed: (P.seed | 0) * 31 + i };
      out.push({ id: e.id + '~p' + i, name: (e.name || 'pier') + (PL.segs.length > 1 ? ' ' + (i + 1) : ''), at: { x: g.a[0] + g.tx * mid, z: g.a[1] + g.tz * mid, yaw: psi - Math.PI },
        yard: null, fences: [], items: [{ id: e.id + '~p' + i + '_1', key: 'marine/trestle pier', x: 0, z: 0, yaw: 0, P: ip }], src: { waterfront: e.id } });
    });
    return out;
  }

  // ---- the record's own checks (issues()) ----------------------------------------------
  function issues(list) {
    const out = [], ids = new Set();
    for (const e of list || []) {
      const k = 'waterfront ' + (e && e.id);
      if (!e || typeof e.id !== 'string') { out.push('waterfront: an entry without an id'); continue; }
      if (ids.has(e.id)) out.push(k + ': the id is used twice'); ids.add(e.id);
      if (KINDS.indexOf(e.kind) < 0) out.push(k + ': unknown kind ' + e.kind);
      if (!Array.isArray(e.pts) || e.pts.length < 2) { out.push(k + ': a line needs two points'); continue; }
      if (e.pts.some(p => !Array.isArray(p) || !isFinite(p[0]) || !isFinite(p[1]))) out.push(k + ': a point is not a number');
      if (line(e.pts).len < 2) out.push(k + ': shorter than 2 m');
      const P = Pof(e);
      for (const f in P) if (typeof DEF[e.kind] === 'object' && typeof DEF[e.kind][f] === 'number' && !isFinite(P[f])) out.push(k + ': ' + f + ' is not a number');
      if (e.kind === 'breakwater' && (P.crest < 1 || P.crestH <= 0 || P.slopeL < 0.5 || P.slopeR < 0.5 || P.block < 0.3)) out.push(k + ': crest, crestH, slopes or block out of range');
      if (e.kind === 'float' && (P.pitch < P.fingerW + 1.4)) out.push(k + ': the slip pitch is narrower than a finger and a boat');
    }
    return out;
  }

  // a fresh record entry (the editor's default for a new line of a kind)
  function entry(id, kind, pts) { return { id, kind, pts: pts.map(p => [p[0], p[1]]), P: {} }; }

  return { KINDS, DEF, Pof, line, closest, at, offsetLine, mound, groundLines, footprint, ribbon, pierSites, issues, entry, trimEnd };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = WATERFRONT_LAW;
