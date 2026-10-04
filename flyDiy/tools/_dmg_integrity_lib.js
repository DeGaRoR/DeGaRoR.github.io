// G1823 (DMG-D1b WRECK INTEGRITY): what GATE DMGINTEGRITY (_dmg_integrity_check.js) and its evidence
// (dmg_integrity_evidence.js) share, node only, on _treecrash_lib's validated builds and scenarios:
//   pieces(sim)       the airframe's pieces now (a union-find over the live members; a SUPPORT limiter holds nothing),
//                     independent of the solver's own (30_solver.js compEvent) - the gate checks one against the other
//   spanning(sim)     the live strips whose weights (as the aero pass flies them) sit on two pieces: must be none
//   oldRule(sim, def) the strips TREE-CRASH's any-break kill would have silenced for the same broken members
//   makeProbe(sim, def)  THE PASS-THROUGH PROBE: a node of another part inside a fuselage bay's hull (rings i, i+1),
//                     deeper than it was built by more than 5 cm, while the bay is still a bay (one piece, every edge
//                     within 0.6..1.4 of its length as built); attached (the same piece as the bay) or off
//   groundCase(key, o)   a nose-in / pancake on flat ground (GATE TREECRASH's waterCase placement, on land)
//   draw(sim, def, o) the wreck as SVG: side / top / front in the cabin's own frame (rings 1 and 3), members by part,
//                     broken dashed pink, the SUPPORT limiters green (solid while closed), marked nodes ringed
'use strict';
const L = require('./_treecrash_lib.js');

function pieces(sim) {
  const n = sim.n, P = new Int32Array(n);
  for (let i = 0; i < n; i++) P[i] = i;
  const f = i => { while (P[i] !== i) { P[i] = P[P[i]]; i = P[i]; } return i; };
  for (const b of sim.beams) { if (b.broken || b.supp) continue; const x = f(b.a), y = f(b.b); if (x !== y) P[x] = y; }
  return f;
}
function spanning(sim) {
  const S = sim.damageStrips(), f = pieces(sim), out = [];
  S.w.forEach((w, si) => { if (S.dead[si]) return; const r = f(w[0][0]); if (w.some(([i]) => f(i) !== r)) out.push(si); });
  return out;
}
function oldRule(sim, def) {
  const sets = def.strips.map(st => { const N = new Set(st.w.map(w => w[0])); for (const k of ['fIn', 'fOut', 'rIn', 'rOut']) if (st[k] != null) N.add(st[k]); return N; });
  const dead = new Set();
  for (const bi of sim.damage().broken) { const b = sim.beams[bi]; sets.forEach((N, si) => { if (N.has(b.a) && N.has(b.b)) dead.add(si); }); }
  return dead;
}

// ---- the pass-through probe ----
function bays(def) {
  const T = {}; def.nodes.forEach((nd, i) => { const m = /^S(\d+)([BT])([LR])$/.exec(nd.tag || ''); if (m) T[m[1] + m[2] + m[3]] = i; });
  const out = []; for (let i = 0; T[(i + 1) + 'BL'] != null; i++) out.push({ i, n: [T[i + 'BL'], T[i + 'BR'], T[i + 'TR'], T[i + 'TL'], T[(i + 1) + 'BL'], T[(i + 1) + 'BR'], T[(i + 1) + 'TR'], T[(i + 1) + 'TL']] });
  return out;
}
const FACES = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
const EDG = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
// how deep (x, y, z) sits inside the bay's hexahedron: the least, over its six faces (each the plane through its four
// corners' centroid, the normal from its diagonals, turned to the bay's centre), of the distance inside; < 0 outside
function depth(p, B, x, y, z) {
  let cx = 0, cy = 0, cz = 0; for (const i of B) { cx += p[i*3]; cy += p[i*3+1]; cz += p[i*3+2]; } cx /= 8; cy /= 8; cz /= 8;
  let d = Infinity;
  for (const F of FACES) {
    const a = B[F[0]], b = B[F[1]], c = B[F[2]], e = B[F[3]];
    const fx = (p[a*3] + p[b*3] + p[c*3] + p[e*3]) / 4, fy = (p[a*3+1] + p[b*3+1] + p[c*3+1] + p[e*3+1]) / 4, fz = (p[a*3+2] + p[b*3+2] + p[c*3+2] + p[e*3+2]) / 4;
    const d1x = p[c*3] - p[a*3], d1y = p[c*3+1] - p[a*3+1], d1z = p[c*3+2] - p[a*3+2], d2x = p[e*3] - p[b*3], d2y = p[e*3+1] - p[b*3+1], d2z = p[e*3+2] - p[b*3+2];
    let nx = d1y*d2z - d1z*d2y, ny = d1z*d2x - d1x*d2z, nz = d1x*d2y - d1y*d2x; const ln = Math.hypot(nx, ny, nz) || 1e-9; nx /= ln; ny /= ln; nz /= ln;
    if ((cx - fx) * nx + (cy - fy) * ny + (cz - fz) * nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    d = Math.min(d, (x - fx) * nx + (y - fy) * ny + (z - fz) * nz);
  }
  return d;
}
const MARGIN = 0.05;
function makeProbe(sim, def) {
  const P = def.parts.dmg.part, BY = bays(def), p = sim.p;
  const elen = (B, e) => Math.hypot(p[B[e[0]]*3] - p[B[e[1]]*3], p[B[e[0]]*3+1] - p[B[e[1]]*3+1], p[B[e[0]]*3+2] - p[B[e[1]]*3+2]);
  const e0 = BY.map(b => EDG.map(e => elen(b.n, e)));
  const intr = []; for (let i = 0; i < sim.n; i++) if (P[i] !== 'body') intr.push(i);
  // as built: a node on a bay's skin (a wing root, the tail's roots) counts from there
  const base = new Map(); for (const i of intr) { let d = -Infinity; for (const b of BY) d = Math.max(d, depth(p, b.n, p[i*3], p[i*3+1], p[i*3+2])); base.set(i, Math.max(0, d)); }
  const worst = {};
  function frame(t) {
    const fd = pieces(sim);
    const ok = BY.map((b, j) => b.n.every(i => fd(i) === fd(b.n[0])) && EDG.every((e, q) => { const r = elen(b.n, e) / e0[j][q]; return r > 0.6 && r < 1.4; }));
    for (const i of intr) BY.forEach((b, j) => {
      if (!ok[j]) return;
      const d = depth(p, b.n, p[i*3], p[i*3+1], p[i*3+2]) - base.get(i);
      if (d <= MARGIN) return;
      const att = fd(i) === fd(b.n[0]), k = P[i] + ':' + (def.nodes[i].tag || i) + '#' + i + '>bay' + b.i + (att ? '' : '(off)');
      if (!worst[k] || d > worst[k].d) worst[k] = { d, t, node: i, part: P[i], tag: def.nodes[i].tag, bay: b.i, att };
    });
  }
  return { frame, res: () => Object.values(worst).sort((a, b) => b.d - a.d) };
}

// ---- a nose-in / pancake on flat ground: `V` m/s along the heading, sinking `sink`, pitched `pitch` deg nose-down ----
function groundCase(key, o) {
  const C = L.core(), def = o.def || L.defOf(key, o), { W } = L.flatWorld(0);
  const sim = C.makeSim(def, W); sim.reset(0); L.lastRun.sim = sim;
  const n = sim.n, p = sim.p, v = sim.v, [xA, , zR] = sim.axes(), c0 = sim.cgPos();
  const th = -(o.pitch || 0) * Math.PI / 180, k = zR, cs = Math.cos(th), sn = Math.sin(th);
  for (let i = 0; i < n; i++) {
    const d = [p[i*3] - c0[0], p[i*3+1] - c0[1], p[i*3+2] - c0[2]], kd = k[0]*d[0] + k[1]*d[1] + k[2]*d[2];
    const cr = [k[1]*d[2] - k[2]*d[1], k[2]*d[0] - k[0]*d[2], k[0]*d[1] - k[1]*d[0]];
    for (let j = 0; j < 3; j++) p[i*3+j] = c0[j] + d[j] * cs + cr[j] * sn + k[j] * kd * (1 - cs);
  }
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - def.nodes[i].r);
  const hl = Math.hypot(xA[0], xA[2]);
  for (let i = 0; i < n; i++) { p[i*3+1] += 0.3 - yMin; v[i*3] = -o.V * xA[0] / hl; v[i*3+1] = -o.sink; v[i*3+2] = -o.V * xA[2] / hl; }
  sim.ctl.thr = 0;
  if (o.onStart) o.onStart(sim, def);
  let finite = true;
  for (let s = 0; s < (o.secs || 4) * 60; s++) { sim.step(1 / 60); if (o.onFrame) o.onFrame(sim, s); if (!L.finite(sim)) { finite = false; break; } }
  return { sim, def, dmg: L.dmgOf(sim), finite };
}
// a def without its SUPPORT limiters (the 'before' of G1822's pass-through)
function noSupp(def) { return Object.assign({}, def, { parts: Object.assign({}, def.parts, { dmg: Object.assign({}, def.parts.dmg, { supp: [] }) }) }); }

// ---- the wreck drawn ----
function draw(sim, def, o) {
  const P = def.parts.dmg.part, p = sim.p, n = sim.n;
  // the cabin's own frame (rings 1 and 3 - the firewall ring is the first to crush), x from the firewall as built
  const T = {}; def.nodes.forEach((nd, i) => { if (nd.tag && T[nd.tag] == null) T[nd.tag] = i; });
  const cen = tags => { const c = [0, 0, 0]; for (const t of tags) for (let k = 0; k < 3; k++) c[k] += p[T[t]*3+k] / tags.length; return c; };
  const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return a.map(x => x / l); }, sub = (a, b) => a.map((x, k) => x - b[k]);
  const R1 = cen(['S1BL', 'S1BR', 'S1TL', 'S1TR']), R3 = cen(['S3BL', 'S3BR', 'S3TL', 'S3TR']);
  const xA = nrm(sub(R3, R1)), up = sub(cen(['S1TL', 'S1TR', 'S3TL', 'S3TR']), cen(['S1BL', 'S1BR', 'S3BL', 'S3BR']));
  const dd = up[0]*xA[0] + up[1]*xA[1] + up[2]*xA[2], yU = nrm(up.map((x, k) => x - dd * xA[k]));
  const zR = [yU[1]*xA[2] - yU[2]*xA[1], yU[2]*xA[0] - yU[0]*xA[2], yU[0]*xA[1] - yU[1]*xA[0]];
  const c = R1.map((x, k) => x - def.nodes[T.S1BL].p[0] * xA[k]);
  const loc = i => { const d = [p[i*3] - c[0], p[i*3+1] - c[1], p[i*3+2] - c[2]]; return [d[0]*xA[0] + d[1]*xA[1] + d[2]*xA[2], d[0]*yU[0] + d[1]*yU[1] + d[2]*yU[2], d[0]*zR[0] + d[1]*zR[1] + d[2]*zR[2]]; };
  const Lp = Array.from({ length: n }, (_, i) => loc(i));
  const col = q => q === 'body' ? '#555' : /^eng/.test(q) ? '#c0392b' : /^wing/.test(q) ? '#2e6db4' : /^(gear|tw|float)/.test(q) ? '#8e44ad' : '#16a085';
  const fitI = []; for (let i = 0; i < n; i++) if (P[i] === 'body') fitI.push(i);
  const lo = [0, 1, 2].map(k => Math.min(...fitI.map(i => Lp[i][k])) - (o.pad || 0.9)), hi = [0, 1, 2].map(k => Math.max(...fitI.map(i => Lp[i][k])) + (o.pad || 0.9));
  const views = [['side (x aft, y up)', 0, 1], ['top (x aft, z right)', 0, 2], ['front (z right, y up)', 2, 1]];
  const W = o.w || 960, H = o.h || 300, PAD = 10, panW = [hi[0] - lo[0], hi[0] - lo[0], hi[2] - lo[2]];
  const sc = Math.min((W - 4 * PAD) / (panW[0] + panW[1] + panW[2]), (H - 30) / Math.max(hi[1] - lo[1], hi[2] - lo[2]));
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 58}" font-family="sans-serif" font-size="11"><rect width="100%" height="100%" fill="#fff"/>`;
  s += `<text x="8" y="14" font-weight="bold">${o.title || ''}</text>`;
  let xOff = PAD;
  views.forEach(([nm, ia, ib], vi) => {
    const x0 = xOff, wv = panW[vi] * sc; xOff += wv + PAD;
    const yc = 30 + (H - 30) / 2, mb = (lo[ib] + hi[ib]) / 2, sg = vi === 1 ? -1 : 1;
    const X = q => x0 + (vi === 2 ? (q[ia] - lo[ia]) : (q[ia] - lo[ia])) * sc, Y = q => yc - sg * (q[ib] - mb) * sc;
    s += `<rect x="${x0.toFixed(1)}" y="22" width="${wv.toFixed(1)}" height="${H - 8}" fill="none" stroke="#ddd"/><text x="${(x0 + 4).toFixed(1)}" y="34" fill="#888">${nm}</text>`;
    s += `<clipPath id="c${vi}"><rect x="${x0.toFixed(1)}" y="22" width="${wv.toFixed(1)}" height="${H - 8}"/></clipPath><g clip-path="url(#c${vi})">`;
    sim.beams.forEach(b => {
      const A = Lp[b.a], B = Lp[b.b], ln = `x1="${X(A).toFixed(1)}" y1="${Y(A).toFixed(1)}" x2="${X(B).toFixed(1)}" y2="${Y(B).toFixed(1)}"`;
      if (b.supp) { if (o.supp === false) return; const Lc = Math.hypot(p[b.b*3]-p[b.a*3], p[b.b*3+1]-p[b.a*3+1], p[b.b*3+2]-p[b.a*3+2]), on = Lc < b.L0;
        s += `<line ${ln} stroke="${on ? '#1e8449' : '#a9dfbf'}" stroke-width="${on ? 2.2 : 0.8}"${on ? '' : ' stroke-dasharray="3,2"'}/>`; return; }
      const q = P[b.a] === P[b.b] ? P[b.a] : 'joint';
      s += b.broken ? `<line ${ln} stroke="#f5b7b1" stroke-width="0.6" stroke-dasharray="2,2"/>` : `<line ${ln} stroke="${q === 'joint' ? '#e67e22' : col(q)}" stroke-width="1"/>`;
    });
    for (const i of (o.mark || [])) s += `<circle cx="${X(Lp[i]).toFixed(1)}" cy="${Y(Lp[i]).toFixed(1)}" r="5" fill="none" stroke="#000" stroke-width="1.6"/>`;
    s += '</g>';
  });
  (o.foot || []).forEach((line, k) => { s += `<text x="8" y="${H + 30 + 13 * k}" fill="#555">${String(line).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`; });
  return s + '</svg>';
}
module.exports = { pieces, spanning, oldRule, bays, depth, makeProbe, groundCase, noSupp, draw, MARGIN };
