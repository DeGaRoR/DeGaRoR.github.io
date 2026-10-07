// G2040-G2043 (DMG-FABRIC): the standard crashes (DMG-TUNE's, tools/_dmg_tune_lib.js CRASHES) flown with a per-frame
// reader that says how the wreck holds together: the PIECES (the live members and the shape-matched clusters still on:
// the solver's own rule, pieces()) and the HELD pieces (the same, joined by the live cover ties too - what the covering
// still holds), each piece's mass, the largest piece's share of the aeroplane's mass, the ties made / torn and when,
// and at the end how far the furthest piece lies from the largest. Read-only: the reader never writes the sim.
//
//   runFabric(k, id, o)   one crash: { t0 (first contact), at: { 0.5, 1, 2, 4 s after it: pieces, held, share, shareH },
//                         series (every 3rd frame), ties { made, torn, born, first, tears: [t...] }, far, farH, ... }
'use strict';
const T = require('./_dmg_tune_lib.js');
const L = T.L;

const PIECE_KG = 1;                                 // a piece is a piece from 1 kg (a lone node's few grams are not)
const MARKS = [0.5, 1, 2, 4];

// the pieces now: the live members and the clusters still on (+ the live cover ties when `held`)
function piecesOf(sim, held) {
  const n = sim.n, P = new Int32Array(n);
  for (let i = 0; i < n; i++) P[i] = i;
  const f = i => { while (P[i] !== i) { P[i] = P[P[i]]; i = P[i]; } return i; };
  const join = (a, b) => { const x = f(a), y = f(b); if (x !== y) P[x] = y; };
  for (const b of sim.beams) if (!b.broken) join(b.a, b.b);
  const CL = sim.clusterCuts ? sim.clusterCuts().clusters : [];
  for (const C of CL) if (!C.off && C.nodes.length) for (const i of C.nodes) join(C.nodes[0], i);
  const TY = held && sim.coverTies ? sim.coverTies() : null;
  if (TY) for (let s = 0; s < TY.nLive; s++) { const q = TY.live[s]; join(TY.a[q], TY.b[q]); }
  const M = new Map();
  for (let i = 0; i < n; i++) { const r = f(i); let e = M.get(r); if (!e) M.set(r, e = { m: 0, x: 0, y: 0, z: 0, nodes: 0 }); const m = sim.m[i];
    e.m += m; e.x += m * sim.p[i*3]; e.y += m * sim.p[i*3+1]; e.z += m * sim.p[i*3+2]; e.nodes++; }
  const list = [...M.values()].filter(e => e.m >= PIECE_KG).map(e => ({ m: e.m, c: [e.x / e.m, e.y / e.m, e.z / e.m], nodes: e.nodes })).sort((a, b) => b.m - a.m);
  return list;
}
const shareOf = (list, M) => list.length ? list[0].m / M : 1;
const farOf = list => { if (list.length < 2) return 0; const c = list[0].c; let d = 0; for (let j = 1; j < list.length; j++) d = Math.max(d, Math.hypot(list[j].c[0] - c[0], list[j].c[1] - c[1], list[j].c[2] - c[2])); return d; };

function runFabric(k, id, o) {
  o = o || {};
  const c = T.CRASHES[id], opts = Object.assign({}, c.o, o.opts || {});
  if (c.kind === 'trunk' && o.secs) opts.secs = o.secs;
  let sim = null, M = 0, t0 = null, tStart = null;
  const series = [], at = {}, tieT = [];
  let seenT = 0;
  const onStart = s => { sim = s; M = s.totalM; tStart = s.t; if (o.onStart) o.onStart(s); };
  const onFrame = (s, f) => {
    if (t0 === null) {
      if (c.kind === 'trunk' ? s.trunkHits() > 0 : true) t0 = s.t - 1 / 60;
    }
    const TY = s.coverTies ? s.coverTies() : null;
    if (TY) { for (let q = 0; q < TY.n; q++) if (TY.torn[q] >= 0 && !(tieT[q] >= 0)) tieT[q] = TY.torn[q]; }
    if (t0 === null) return;
    const dt = s.t - t0;
    const need = MARKS.find(x => !(x in at) && dt >= x - 1e-9);
    if (f % 3 === 0 || need !== undefined) {
      const Ps = piecesOf(s, false), Ph = piecesOf(s, true);
      const row = { t: +dt.toFixed(4), pieces: Ps.length, held: Ph.length, share: +shareOf(Ps, M).toFixed(4), shareH: +shareOf(Ph, M).toFixed(4),
        ties: TY ? TY.n : 0, live: TY ? TY.nLive : 0, broken: s.damage().breaks };
      if (f % 3 === 0) series.push(row);
      for (const x of MARKS) if (!(x in at) && dt >= x - 1e-9) at[x] = row;
    }
    if (o.onFrame) o.onFrame(s, f, dt);
  };
  let res;
  const run = Object.assign({}, opts, { onStart, onFrame, cert: o.cert !== false });
  if (c.kind === 'trunk') res = L.atTrunk(k, run);
  else if (c.kind === 'drop') { const s473 = L.far473(k), dd = L.defOf(k), fwd = dd.params.gen.VsFlap || dd.params.gen.Vs; res = L.hardLanding(k, Object.assign(run, { sink: opts.k473 * s473, fwd })); }
  else res = L.waterCase(k, run);
  sim = L.lastRun.sim;
  const D = sim.damage(), TY = sim.coverTies ? sim.coverTies() : null;
  const Ps = piecesOf(sim, false), Ph = piecesOf(sim, true);
  const tears = []; if (TY) for (let q = 0; q < TY.n; q++) if (TY.torn[q] >= 0) tears.push(+(TY.torn[q] - (t0 || 0)).toFixed(4));
  tears.sort((a, b) => a - b);
  const ties = TY ? { made: TY.n, torn: tears.length, born: D.tieBorn || 0, live: TY.nLive, first: D.tieFirstT == null ? null : +(D.tieFirstT - (t0 || 0)).toFixed(4), tears,
    sheet: Array.from(TY.sheet.subarray(0, TY.n)).filter(x => x).length,
    maxStrain: (() => { let m = 0; for (let q = 0; q < TY.n; q++) m = Math.max(m, TY.Lp[q] / TY.Ls[q] - 1); return +m.toFixed(4); })(),
    peakF: (() => { let m = 0; for (let q = 0; q < TY.n; q++) m = Math.max(m, TY.Fp[q]); return +m.toFixed(0); })(),
    // the energy the covering took: each tie's envelope to its peak stretch (a torn tie's all of it; a live one less what it
    // still holds elastically, Fe^2 / 2 ku)
    // (a tie torn at its birth carried nothing; a torn one's envelope ends at its strain at break)
    work: (() => { let W = 0; for (let q = 0; q < TY.n; q++) { if (TY.torn[q] >= 0 && TY.torn[q] === TY.t0[q]) continue;
      const ep = Math.min(Math.max(0, TY.Lp[q] - TY.Ls[q]), TY.eu[q] * TY.Ls[q]), ey = TY.Fy[q] / TY.k[q];
      const Fe = ep <= ey ? TY.k[q] * ep : TY.Fy[q], E = ep <= ey ? 0.5 * TY.k[q] * ep * ep : 0.5 * TY.Fy[q] * ey + TY.Fy[q] * (ep - ey);
      W += TY.torn[q] >= 0 ? E : Math.max(0, E - Fe * Fe / (2 * TY.ku[q])); } return +W.toFixed(1); })() } : null;
  return { k, id, t0: t0 == null ? null : +(t0 - (tStart || 0)).toFixed(4), at, series, ties, broken: D.breaks, crashed: D.crashed, reason: D.reason, work: +D.work.toFixed(1),
    end: { pieces: Ps.length, held: Ph.length, share: +shareOf(Ps, M).toFixed(4), shareH: +shareOf(Ph, M).toFixed(4), far: +farOf(Ps).toFixed(2), farH: +farOf(Ph).toFixed(2),
      masses: Ps.slice(0, 8).map(e => +e.m.toFixed(1)), massesH: Ph.slice(0, 8).map(e => +e.m.toFixed(1)) },
    finite: res.finite !== false, hash: res.hash || null, sim };
}

module.exports = { runFabric, piecesOf, MARKS, T, L };
