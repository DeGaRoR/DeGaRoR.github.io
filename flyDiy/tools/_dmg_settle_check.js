#!/usr/bin/env node
// GATE DMGSETTLE (G2044-G2046, DMG-SETTLE) - A WRECK'S PIECES LIE ON THE GROUND, node only. The user (2026-10-06): "breaking
// in pieces looks good, but the individual pieces tend to hover over the ground rather than falling and lying on the ground".
// On the user's Cub (builds/cub_2026-09-20_corrected.json), the Jodel and the metal Cessna (bugReports/cessnaMetal (1).json),
// damage ON, the 30 m/s trunk break-up (tools/_treecrash_lib.js atTrunk: the centreline and 2.5 m out) flown 15 s - every
// piece still by then - with the flown cage snapshot built headless (tools/_dmg_wall_lib.js) and ridden as app.js brkCage
// rides it (the inherited binding, the nodes' frames in the world: tools/_dmg_wall_study.js's 'inh'), at rest:
//   1. THE PHYSICS: every detached piece (a set of nodes no live member or cluster joins to the core - the solver's own
//      rule) has its lowest node ON the ground: its contact sphere's bottom (y - (r - so), 30_solver's rC; G2044's `so`
//      the node's standoff outside its drawn surface; a wheel's less its tyre's static deflection, at most 5 cm - G661) at
//      most X_UP over the ground (1 cm: a node in its ground spring sits AT or under it - r = 0 on every node but a
//      wheel's), at most X_DN under it (6 cm: the ground spring's static sag
//      with a whole 800 kg wreck on one 10 kg node, 1.5e4 x 10 N/m: 5.2 cm);
//   2. THE DRAWN SKIN: every detached piece's COVERING (the snapshot's cover class; its fittings, beads and masts
//      reported apart) has its lowest live vertex at most Y_UP over the ground (2 cm: the tail plate's 1.5 mm off its
//      plane, the section sampled, the spring's sag) - it lies on the ground when its nodes do (the bug as found: the
//      Jodel's wing 12 cm up on its box's lower caps). Under the ground it may go Y_DN (25 cm: a piece rests on its NODES,
//      and a covering wraps them up to a section's half depth - the Cub's wing 2 x 12 % of 1.6 m - plus the crumple);
//   3. THE SCRAPS (G2046): the islands a record keeps on a LOOSE piece (fewer than 3 nodes: skin_break.js looseIslands) are
//      released as bodies at each event as app.js wreckScraps releases them (their drawing, its support points,
//      WRECK_DEBRIS's law) and at rest each lies on the ground: its lowest drawn point within DEB (2 cm) of it and HELD (its
//      centre over the hull of its drawn points on the ground); the bug as found: a scrap riding its node at its rest lever
//      (the metal Cessna's dash face 45 cm up);
//   4. THE DEBRIS (G2045): WRECK_DEBRIS's bodies rest on their DRAWN shape - stand-ins of the drawn parts from each build's
//      own sizes (a main wheel and its leg to the frame's gear nodes, the engine with its prop at a seeded blade angle, a
//      cowl half-shell, the spinner, a pane), 20 seeded drops each through release / step with the support points app.js
//      wreckRelease passes: every one asleep, HELD, its lowest drawn point within DEB of the ground (the bug as found: on its
//      box's eight corners a wheel and its leg stood on an empty corner of its box, 6 of 20 drops, the wheel 30 cm up);
//   5. THE TERRAIN on these cases is the solver's own (a flat 300 m world, drawn at its height): the drawn ground's
//      disagreement elsewhere is G1540's (tools/ground_drawn.js), reported in HANDOVER, not gated here.
//   node tools/_dmg_settle_check.js [--out file.json] [--selftest]
// --selftest: the same run with the bug as found (no standoff, the scraps riding their node, the bodies on their box's
// corners) must go red on rows 1-4's drawn checks - it prints which, and passes only if it does.
// The runner's contract: exactly one `GATE DMGSETTLE: PASS|FAIL`, exit code to match.
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const ROOT = path.join(__dirname, '..');
const L = require('./_treecrash_lib.js');
const SB = require(path.join(ROOT, 'src', 'viewer', 'skin_break.js'));
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
const SV = require(path.join(ROOT, 'src', 'viewer', 'sim_view.js'));
const WD = require(path.join(ROOT, 'src', 'viewer', 'wreck_debris.js'));

const BUILDS = ['cub', 'jodel', 'metal'];
const CASES = [{ id: 'trunk-0', label: 'a trunk at 30 m/s, the centreline', o: { D: 40, agl: 4, V: 30, thr: 0, off: 0 } },
               { id: 'trunk-2.5', label: 'a trunk at 30 m/s, the wing 2.5 m out', o: { D: 40, agl: 4, V: 30, thr: 0, off: 2.5 } }];
const SECS = 15, EVERY = 15, ELEV = 300;
const X_UP = 0.01, X_DN = 0.06, Y_UP = 0.02, Y_DN = 0.25, DEB = 0.02, DROPS = 20;

// ---- the child: one build, both cases (and the stand-ins) ----
if (argv[0] === '--build') {
  const k = argv[1], bug = argv.includes('--bug');
  const ST = require('./_dmg_wall_study.js');
  const P = ST.prepare(k), def = L.defOf(k), n = def.nodes.length, core = def.refs.noseFrame[0];
  // (the bug as found: no node stands outside its surface - 30_solver's rC = r, as before G2044)
  if (bug) for (const nd of def.nodes) delete nd.so;
  const so = i => def.nodes[i].so || 0;
  const wheel = new Set([].concat(def.refs.mains || [], def.refs.tw != null && def.refs.tw >= 0 ? [def.refs.tw] : []));
  const out = { key: k, label: L.BUILDS[k].label, bug, cases: [] };
  const X = R => ({ Mi: [1, 0, 0, 0, 1, 0, 0, 0, 1], B: [1, 0, 0, 0, 1, 0, 0, 0, 1], cg: [0, 0, 0], o: [0, 0, 0], w: R.w, n: null, nB: null });
  for (const c of CASES) {
    const hop = SH.simDmgHop0(), D = SV.simViewDmgState(n, def.beams.length), NF = {}, scratch = new Map();
    const W = WD.watcher(), env = { ground: () => ELEV, water: null };
    let recs = null, E = null, rel = 0;
    const series = [], scraps = [];
    const label = (ids) => { let lo = Infinity; for (const i of ids) lo = Math.min(lo, i); return lo; };
    const onFrame = (sim, f) => {
      const PI = SH.simDmgHop(sim, hop, core, 0); if (PI) SV.simViewDmgApply(D, PI);
      if (!D.br.length) return;
      if (!recs) {
        recs = P.groups.map(g => { const R = SB.make({ nv: g.nv, idx: g.idx.slice() }, SB.INH_K, { fabric: P.fabric && g.cv.indexOf(SB.INH.cover) >= 0, cage: true, pos: g.bD, rest: P.rest, weld: true, rideAll: true });
          R.w = new Float64Array(g.nv * 3); return R; });
        E = recs.map((R, i) => ({ R, cv: P.groups[i].cv, obj: P.groups[i].obj })); SB.bindInherit(E, P.T, P.rest);
        recs.forEach((R, i) => { const cv = P.groups[i].cv, has = q => cv.indexOf(q) >= 0;
          R.noTear = has(SB.INH.tube) || (has(SB.INH.rigid) && !has(SB.INH.cover)) || (has(SB.INH.cover) && !P.fabric);
          R.tubeTear = has(SB.INH.tube) && !has(SB.INH.cover); R.sheetTear = has(SB.INH.cover) && !P.fabric; });
      }
      let evd = false; for (const R of recs) evd = SB.event(R, P.T, D, P.rest, R.g.pos) || evd;
      if (evd) for (const e of E) if (e.on) SB.wallSync(e, E);
      SB.nodeFrames(NF, P.T, D, P.rest, sim.p, true);
      for (const R of recs) { let pos = scratch.get(R.nv); if (!pos) scratch.set(R.nv, pos = new Float32Array(R.nv * 3));
        SB.poseCage(R, P.rest, sim.p, R.g.pos, pos, NF, [0, -1, 0], null, X(R)); SB.tear(R, R.g.pos, R.w); }
      for (const e of E) if (e.on) SB.wallFollow(e, E);
      // G2046: the islands on a loose piece, released as app.js wreckScraps releases them (one body a piece, at the event)
      if (!bug && evd) {
        const per = new Map();
        recs.forEach((R, gi) => { for (const [q, T] of SB.looseIslands(R, D.pc, D.nPc)) { let S = per.get(q); if (!S) per.set(q, S = []); S.push([gi, T]); } });
        for (const [q, S] of per) {
          const loc = [], ids = []; let cx = 0, cy = 0, cz = 0, cn = 0;
          for (const [gi, T] of S) { const R = recs[gi], i0 = R.idx0; for (const t of T) for (let e = 0; e < 3; e++) { const v = i0[t * 3 + e]; cx += R.w[v * 3]; cy += R.w[v * 3 + 1]; cz += R.w[v * 3 + 2]; cn++; } }
          if (!cn) continue;
          const x = [cx / cn, cy / cn, cz / cn];
          for (const [gi, T] of S) { const R = recs[gi], i0 = R.idx0;
            for (const t of T) { for (let e = 0; e < 3; e++) { const v = i0[t * 3 + e]; loc.push(R.w[v * 3] - x[0], R.w[v * 3 + 1] - x[1], R.w[v * 3 + 2] - x[2]); }
              R.dead[t] = 5; R.idx[t * 3] = R.idx[t * 3 + 1] = R.idx[t * 3 + 2] = i0[t * 3]; } }   // (wreckCollapse's mark: gone from the skin)
          const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
          for (let v = 0; v < loc.length; v += 3) for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], loc[v + j]); hi[j] = Math.max(hi[j], loc[v + j]); }
          let area = 0; for (let v = 0; v < loc.length; v += 9) { const ux = loc[v + 3] - loc[v], uy = loc[v + 4] - loc[v + 1], uz = loc[v + 5] - loc[v + 2], wx = loc[v + 6] - loc[v], wy = loc[v + 7] - loc[v + 1], wz = loc[v + 8] - loc[v + 2];
            area += Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2; }
          const nodes = []; for (let i = 0; i < n; i++) if (D.pc[i] === q) nodes.push(i);
          const cnd = { id: rel++, kind: 'scrap', nodes, why: 'loose' };
          const B = WD.release(W, cnd, { x, q: [0, 0, 0, 1] }, { lo, hi, pts: WD.support(loc, loc.length / 3) }, Math.max(0.2, 2 * area), sim.p, sim.v, false);
          B.loc = loc; B.label = nodes.map(i => def.nodes[i].tag || i).join('+'); B.t0 = sim.t;
        }
      }
      if (W.bodies.length) WD.step(W, 1 / 60, env);
      // the measure, every EVERY frames and the last
      if (f % EVERY === 0 || f === SECS * 60 - 1) {
        const pc = D.pc || new Int32Array(n), pcs = new Map();
        for (let i = 0; i < n; i++) { let o = pcs.get(pc[i]); if (!o) pcs.set(pc[i], o = { ids: [], node: Infinity, nodeAt: -1, cover: Infinity, coverSec: null, any: Infinity, anySec: null, v: 0, M: 0 });
          // (a wheel stands on its LOADED tyre: 30_solver's rC carries its static deflection, at most 5 cm - G661)
          o.ids.push(i); const y = sim.p[i * 3 + 1] - (sim.r[i] - so(i)) - ELEV - (wheel.has(i) ? Math.min(0.05, Math.max(0, sim.p[i * 3 + 1] - sim.r[i] - ELEV)) : 0);
          if (y < o.node) { o.node = y; o.nodeAt = i; }
          o.v = Math.max(o.v, Math.hypot(sim.v[i * 3], sim.v[i * 3 + 1], sim.v[i * 3 + 2])); o.M += sim.m[i]; }
        recs.forEach((R, gi) => { const g = P.groups[gi], ix = R.idx0 || R.idx;
          for (let t = 0; t < R.nt; t++) { if (R.dead && R.dead[t]) continue;
            for (let e = 0; e < 3; e++) { const v = ix[t * 3 + e], o = pcs.get(R.vp ? R.vp[v] : 0); if (!o) continue; const y = R.w[v * 3 + 1] - ELEV;
              if (y < o.any) { o.any = y; o.anySec = (g.sec || g.key) + (g.layer[v] ? ':' + g.layer[v] : ''); }
              if (g.cv[v] === SB.INH.cover && y < o.cover) { o.cover = y; o.coverSec = g.sec || g.key; } } } });
        const row = { t: +sim.t.toFixed(2), pieces: [] };
        for (const [q, o] of pcs) row.pieces.push({ q, label: label(o.ids), n: o.ids.length, M: +o.M.toFixed(1), tags: [...new Set(o.ids.map(i => def.nodes[i].tag || '-'))].slice(0, 6).join(','),
          node: +o.node.toFixed(4), nodeTag: def.nodes[o.nodeAt].tag || '', cover: Number.isFinite(o.cover) ? +o.cover.toFixed(4) : null, coverSec: o.coverSec,
          any: Number.isFinite(o.any) ? +o.any.toFixed(4) : null, anySec: o.anySec, v: +o.v.toFixed(3), core: o.ids.includes(core) });
        row.bodies = W.bodies.map(B => bodyAt(B, env));
        series.push(row);
      }
    };
    const r = L.atTrunk(k, Object.assign({}, c.o, { secs: SECS, onFrame }));
    // the scraps carried on to their rest (the wreck still)
    let t = 0; while (W.bodies.some(B => !B.asleep) && t < WD.LIFE + 1) { WD.step(W, 1 / 60, env); t += 1 / 60; }
    const last = series[series.length - 1];
    out.cases.push({ id: c.id, label: c.label, broken: r.dmg.broken.length, crashed: r.dmg.crashed, finite: r.finite, series, end: last, scraps: W.bodies.map(B => Object.assign(bodyAt(B, env), { label: B.label, t0: +B.t0.toFixed(2) })) });
  }
  out.standins = standins(k, def, bug);
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// a body now: asleep, held (its centre over its drawn points on the ground), its drawn points' lowest over the ground
function bodyAt(B, env) {
  const R = WD.rotOf(B.q, new Float64Array(9)), loc = B.loc;
  let lo = Infinity; const on = [];
  for (let v = 0; v < loc.length; v += 3) {
    const x = B.x[0] + R[0] * loc[v] + R[1] * loc[v + 1] + R[2] * loc[v + 2], y = B.x[1] + R[3] * loc[v] + R[4] * loc[v + 1] + R[5] * loc[v + 2], z = B.x[2] + R[6] * loc[v] + R[7] * loc[v + 1] + R[8] * loc[v + 2];
    const h = y - env.ground(x, z); if (h < lo) lo = h; if (h < WD.SUP_TOL) on.push([x, z]);
  }
  return { kind: B.kind, label: B.label || null, asleep: B.asleep, age: +B.age.toFixed(2), lo: +lo.toFixed(4), held: WD.inHull2(on, B.x[0], B.x[2], WD.SUP_IN), pts: B.pts.length, x: B.x.map(q => +q.toFixed(3)) };
}

// ---- the stand-ins: the drawn parts' shapes from the build's own sizes, dropped from seeded poses ----
function standins(k, def, bug) {
  const N = def.nodes, R0 = def.refs, rows = [];
  const shapes = [];
  // a main wheel and its leg: the tyre (the axle node's radius, 0.4 r wide, 24 around) and the leg's members to the frame
  const ax = (R0.mains || [])[0];
  if (ax != null && ax >= 0) {
    const r = Math.max(0.12, N[ax].r || 0.2), w = 0.4 * r, P = [];
    for (let a = 0; a < 24; a++) { const t = a / 24 * 2 * Math.PI; for (const z of [-w / 2, w / 2]) P.push([r * Math.cos(t), r * Math.sin(t), z]); }
    for (const b of def.beams) { if (b.a !== ax && b.b !== ax) continue; const o = N[b.a === ax ? b.b : b.a].p, a0 = N[ax].p;
      for (let s = 1; s <= 10; s++) P.push([(o[0] - a0[0]) * s / 10, (o[1] - a0[1]) * s / 10, (o[2] - a0[2]) * s / 10]); }
    shapes.push({ kind: 'wheel+leg', P, mass: 8 });
  }
  // the engine and its prop (a two-blade disc of the build's D, at a seeded angle; the block as GATE DMGWRECK's)
  const D = (def.params.prop && def.params.prop.D) || 1.9;
  shapes.push({ kind: 'eng+prop', mass: 90, seeded: s => { const P = []; for (const x of [-0.4, 0.4]) for (const y of [-0.3, 0.3]) for (const z of [-0.3, 0.3]) P.push([x, y, z]);
    const th = s * 0.7; for (let q = -10; q <= 10; q++) for (const c of [-0.06, 0.06]) P.push([-0.45, Math.cos(th) * D / 2 * q / 10 - Math.sin(th) * c, Math.sin(th) * D / 2 * q / 10 + Math.cos(th) * c]); return P; } });
  // a cowl half-shell (r 0.32, 0.9 long, its 180 degrees), the spinner (a cone), a pane (a curved sheet)
  { const P = []; for (let i = 0; i <= 8; i++) for (let a = 0; a <= 12; a++) { const t = Math.PI * a / 12; P.push([-0.45 + 0.9 * i / 8, 0.32 * Math.sin(t), 0.32 * Math.cos(t)]); } shapes.push({ kind: 'cowl', P, mass: 4 }); }
  { const P = []; for (let i = 0; i <= 10; i++) for (let a = 0; a < 24; a++) { const t = i / 10, r = 0.12 * (1 - t), az = a / 24 * 2 * Math.PI; P.push([0.25 * t, r * Math.cos(az), r * Math.sin(az)]); } shapes.push({ kind: 'spinner', P, mass: 1 }); }
  { const P = []; for (let i = 0; i <= 6; i++) for (let j = 0; j <= 8; j++) { const u = -0.25 + 0.5 * i / 6, a = -0.6 + 1.2 * j / 8; P.push([u, 0.6 * Math.cos(a) - 0.6, 0.6 * Math.sin(a)]); } shapes.push({ kind: 'pane', P, mass: 3 }); }
  const env = { ground: () => 0, water: null };
  for (const S of shapes) {
    const res = [];
    for (let s = 1; s <= DROPS; s++) {
      const P = S.seeded ? S.seeded(s) : S.P, loc = []; for (const p of P) loc.push(p[0], p[1], p[2]);
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const p of P) for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], p[j]); hi[j] = Math.max(hi[j], p[j]); }
      const W = WD.watcher(); W.t = s * 0.37;
      const live = new Float64Array([0, 1.5, 0, 0.3, 1.5, 0, 0, 1.8, 0.2]), vel = new Float64Array(9);
      for (let i = 0; i < 3; i++) { vel[i * 3] = 3 + s % 3; vel[i * 3 + 1] = -1; vel[i * 3 + 2] = (s % 5) - 2; }
      const q = [Math.sin(s), Math.cos(s * 1.7), Math.sin(s * 2.3), 1], ql = Math.hypot(...q);
      const box = { lo, hi }; if (!bug) box.pts = WD.support(loc, P.length);
      const B = WD.release(W, { id: s, kind: S.kind, nodes: [0, 1, 2], why: 'standin' }, { x: [0, 1.5, 0], q: q.map(x => x / ql) }, box, S.mass, live, vel, false);
      B.loc = loc;
      let t = 0; while (!B.asleep && t < WD.LIFE + 1) { WD.step(W, 1 / 60, env); t += 1 / 60; }
      res.push(bodyAt(B, env));
    }
    rows.push({ kind: S.kind, drops: res.length, asleep: res.filter(x => x.asleep).length, held: res.filter(x => x.held).length,
      loMin: Math.min(...res.map(x => x.lo)), loMax: Math.max(...res.map(x => x.lo)), pts: Math.max(...res.map(x => x.pts)), ageMax: Math.max(...res.map(x => x.age)) });
  }
  return rows;
}

// ---- the parent ----
let checks = 0, fails = 0;
const failed = [];
const yes = (ok, msg) => { checks++; if (!ok) { fails++; failed.push(msg); } console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const cm = x => x == null ? '-' : (x * 100).toFixed(1);
(async () => {
  const { spawn } = require('child_process'), t0 = Date.now(), self = argv.includes('--selftest');
  const run = (k, bug) => new Promise(res => {
    const ch = spawn(process.execPath, ['--max-old-space-size=6144', __filename, '--build', k].concat(bug ? ['--bug'] : []), { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; ch.stdout.on('data', d => { so += d; }); ch.stderr.on('data', d => { se += d; });
    ch.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-1500) }); });
  });
  const jobs = BUILDS.map(k => [k, self]);
  const R = {}, q = jobs.slice();
  await Promise.all([0, 1, 2].map(async () => { while (q.length) { const [k, bug] = q.shift(); R[k] = await run(k, bug); } }));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s' + (self ? ', SELFTEST: the bug as found - no standoff, the scraps riding their node, the bodies on their box\'s corners' : '') +
    '; X ' + X_UP * 100 + ' cm over / ' + X_DN * 100 + ' under, Y ' + Y_UP * 100 + ' cm over / ' + Y_DN * 100 + ' under, debris ' + DEB * 100 + ' cm)');
  for (const k of BUILDS) {
    const r = R[k];
    console.log((r.label || k) + ':');
    if (r.err) { yes(false, k + ': the child ran: ' + r.err); continue; }
    for (const c of r.cases) {
      const e = c.end, det = e.pieces.filter(p => !p.core && p.n >= SB.LOOSE_N);
      console.log('  ' + c.label + ': ' + c.broken + ' broken, ' + e.pieces.length + ' pieces at ' + e.t + ' s');
      for (const p of e.pieces) console.log('    piece ' + (p.core ? 'CORE' : '#' + p.label) + ' (' + p.n + ' nodes, ' + p.M + ' kg; ' + p.tags + '): lowest node ' + cm(p.node) + ' cm (' + p.nodeTag + ') - covering ' + cm(p.cover) + ' cm (' + p.coverSec + '), anything drawn ' + cm(p.any) + ' cm (' + p.anySec + '), fastest node ' + p.v + ' m/s');
      yes(c.finite, k + ' ' + c.id + ': the crash flown finite');
      yes(det.every(p => p.v < 0.05), k + ' ' + c.id + ': every detached piece still at ' + e.t + ' s (fastest ' + Math.max(0, ...det.map(p => p.v)).toFixed(3) + ' m/s)');
      yes(det.every(p => p.node <= X_UP && p.node >= -X_DN), k + ' ' + c.id + ': every detached piece\'s lowest node on the ground (' + det.map(p => cm(p.node)).join(', ') + ' cm; within +' + X_UP * 100 + ' / -' + X_DN * 100 + ')');
      yes(det.every(p => p.cover == null || (p.cover <= Y_UP && p.cover >= -Y_DN)), k + ' ' + c.id + ': every detached piece\'s covering ON the ground, not over it (' + det.map(p => cm(p.cover)).join(', ') + ' cm; within +' + Y_UP * 100 + ' / -' + Y_DN * 100 + ')');
      const loose = e.pieces.filter(p => !p.core && p.n < SB.LOOSE_N && p.any != null);
      if (r.bug) yes(loose.every(p => p.any <= DEB), k + ' ' + c.id + ': the islands left riding a loose node lie on the ground (their lowest drawn ' + loose.map(p => cm(p.any)).join(', ') + ' cm)');
      else {
        yes(loose.length === 0, k + ' ' + c.id + ': no island rides a loose piece (' + loose.length + '): each went as a body');
        for (const b of c.scraps) console.log('    scrap on ' + b.label + ' (released at ' + b.t0 + ' s, ' + b.pts + ' support points): ' + (b.asleep ? 'at rest' : 'MOVING') + ', ' + (b.held ? 'held' : 'NOT HELD') + ', its lowest drawn point ' + cm(b.lo) + ' cm');
        yes(c.scraps.every(b => b.asleep && b.held && Math.abs(b.lo) <= DEB), k + ' ' + c.id + ': every scrap at rest, held, its drawing on the ground (' + c.scraps.map(b => cm(b.lo)).join(', ') + ' cm)');
      }
    }
    for (const s of r.standins) {
      console.log('  stand-in ' + s.kind + ' (' + s.pts + ' points): ' + s.asleep + '/' + s.drops + ' at rest, ' + s.held + ' held, its lowest drawn point ' + cm(s.loMin) + '..' + cm(s.loMax) + ' cm, the last asleep at ' + s.ageMax + ' s');
      yes(s.asleep === s.drops && s.held === s.drops && s.loMin >= -DEB && s.loMax <= DEB, k + ' ' + s.kind + ': every drop at rest, held, on the ground');
    }
  }
  if (argv.includes('--out')) fs.writeFileSync(argv[argv.indexOf('--out') + 1], JSON.stringify(R));
  if (self) {
    // the bug must go red: the Jodel's covering over the ground, a stand-in not held, an island riding its loose node over it
    const red = failed.filter(m => /covering ON the ground|not held|NOT HELD|held, on the ground|lie on the ground/.test(m));
    console.log('selftest: ' + red.length + ' drawn rows red with the bug as found');
    const ok = red.some(m => /jodel .*covering/.test(m)) && red.some(m => /held, on the ground/.test(m));
    console.log('GATE DMGSETTLE: ' + (ok ? 'PASS' : 'FAIL') + ' (selftest: the bug goes red ' + (ok ? 'as it should' : 'NOT AS IT SHOULD') + ')');
    process.exit(ok ? 0 : 1);
  }
  console.log(checks + ' checks, ' + fails + ' failed');
  console.log('GATE DMGSETTLE: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
