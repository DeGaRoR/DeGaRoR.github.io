// G1804 (DMG-D0): THE DAMAGE VIEW'S COLOURS - DEFORM-AND-BREAK §5.2, BeamNG's Stress / Deformation / Broken debug modes,
// on the viewer's own line frame (app.js sync(): the Frame mode's lines, and the Overlay's x-rayed through the skin).
// A DEBUG view: off unless asked (?dmgview=1, or the `overlays` flyout's pill); when off, app.js colours the lines by
// strain exactly as before and nothing here runs.
// One colour a member, by precedence:
//   BROKEN      red                                       (k and c gone: TREE-CRASH's beamBreak)
//   SET         orange stretched / cyan crushed, the strain's own pair on its own scale: |set| over SET_FULL (3 %, the
//               kink's ecu) from a floor of SET_T0 so the smallest set reads; a trunk's bend (ks, the chord it lost)
//               counts as crushed
//   STRESS      neutral up to R0 of the member's limit, ramping to amber at the limit (|F| / limit: live, or the probe's
//               peak - sim.damagePeak() - when the sim carries one)
//   CALM        the frame's neutral blue-grey (app.js cN)
// PURE: numbers in, numbers out (node-tested by GATE DMGINST, tools/_dmg_instruments_check.js). No THREE, no DOM.
// Loaded in the page before app.js (window.DMG_TINT) and by node (module.exports).
(function () {
  'use strict';
  const N = [0.34, 0.49, 0.69];      // calm: app.js sCol's neutral
  const A = [1.0, 0.78, 0.12];       // at the limit: amber
  const T = [1, 0.6, 0.24];          // set, stretched: the strain's tension orange
  const C = [0.31, 0.85, 0.91];      // set, crushed: the strain's compression cyan
  const R = [0.89, 0.18, 0.17];      // broken
  const R0 = 0.25;                   // |F| / limit under this draws calm
  const SET_MIN = 1e-4;              // a set under 0.01 % is no set (the return mapping's last bits)
  const SET_FULL = 0.03;             // the full colour at 3 % (TREE-CRASH's ecu: the kink)
  const SET_T0 = 0.6;                // ...from 60 % of the way, so the first set is seen (35 % read as the calm blue)
  const mix = (a, b, t, out, o) => { out[o] = a[0] + (b[0] - a[0]) * t; out[o+1] = a[1] + (b[1] - a[1]) * t; out[o+2] = a[2] + (b[2] - a[2]) * t; };
  // which of the four a member is
  function kind(ratio, set, broken) {
    if (broken) return 'broken';
    if (Math.abs(set) >= SET_MIN) return 'set';
    if (ratio > R0) return 'stress';
    return 'calm';
  }
  // the member's colour into out[o..o+2]; returns its kind
  function tint(out, o, ratio, set, broken) {
    const k = kind(ratio, set, broken);
    if (k === 'broken') mix(R, R, 0, out, o);
    else if (k === 'set') mix(N, set > 0 ? T : C, SET_T0 + (1 - SET_T0) * Math.min(1, Math.abs(set) / SET_FULL), out, o);
    else if (k === 'stress') mix(N, A, Math.min(1, (ratio - R0) / (1 - R0)), out, o);
    else mix(N, N, 0, out, o);
    return k;
  }
  // A SOLVER BEAM's numbers (30_solver.js, the inline sim's own beams): its force over the limit it is judged against now
  // (tension: the hardened yield, a bend's cap when lower; compression: the crush, a bend's cap; a slack wire 0), L the
  // member's length now. A beam with no limits (damage off, a hand fiche) reads 0
  function ratioOf(b, L) {
    if (b.broken) return 0;
    const F = b.k * (L - b.L0), fk = b.dk > 1e-6 && b.mp > 0 ? b.mp / b.dk : Infinity;
    if (F >= 0) { const lim = Math.min(b.fyM > 0 ? b.fyM : Infinity, fk); return lim < Infinity ? F / lim : 0; }
    if (b.tens) return 0;
    const lim = Math.min(b.fc0 > 0 ? b.fc0 : Infinity, fk);
    return lim < Infinity ? -F / lim : 0;
  }
  // ...the probe's (params.damageProbe: nothing yields, every member's peak over its yield, per substep)
  const ratioPeak = (P, bi) => Math.max(P.t[bi], P.c[bi]);
  // its permanent set: the rest length's move off the as-built one, less the chord a bend took (ks), over the as-built
  function setOf(b) {
    if (!(b.Lr > 0)) return 0;
    return (b.L0 - (b.ks || 0) - b.Lr) / b.Lr;
  }
  // the legend (the HANDOVER's colour table and the gate's): one row a kind, at its ends
  const LEGEND = [
    { kind: 'calm', at: '|F| / limit <= ' + R0, rgb: N.slice() },
    { kind: 'stress', at: '|F| / limit = 0.625', rgb: (() => { const o = []; tint(o, 0, 0.625, 0, false); return o; })() },
    { kind: 'stress', at: '|F| / limit >= 1', rgb: A.slice() },
    { kind: 'set', at: 'stretched 0.01 %', rgb: (() => { const o = []; tint(o, 0, 0, SET_MIN, false); return o; })() },
    { kind: 'set', at: 'stretched >= 3 %', rgb: T.slice() },
    { kind: 'set', at: 'crushed 0.01 %', rgb: (() => { const o = []; tint(o, 0, 0, -SET_MIN, false); return o; })() },
    { kind: 'set', at: 'crushed >= 3 %', rgb: C.slice() },
    { kind: 'broken', at: 'k = 0', rgb: R.slice() },
  ];
  const API = { kind, tint, ratioOf, ratioPeak, setOf, LEGEND, R0, SET_MIN, SET_FULL, SET_T0, COL: { N, A, T, C, R } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.DMG_TINT = API;
})();
