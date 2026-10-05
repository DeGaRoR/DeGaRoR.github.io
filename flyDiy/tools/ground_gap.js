#!/usr/bin/env node
// GROUND GAP (A6-GROUND, G1000) — the DRAWN tyre against the ground it stands on, per wheel, in node.
//
// The playtest (2026-09-27): "the planes feel floaty when taxiing ... the tailwheel seems to hover a few
// centimetres over the ground". What the eye reads is the drawn tyre's lowest point against the drawn
// ground. This rig builds that picture without a page:
//   1. the editor's drawing layers headless (tools/_scene_headless.js via _bake_joined.js), the join's
//      measure() merged the garage's way, and the join's own SNAPSHOT (CAGE_JOIN.snapshot on the flown
//      spec, exactly what app.js syncBuildSteps freezes into CAGE_VISUAL);
//   2. the flown def (buildGen) on a flat world (y = 0), reset + the game's stance(), settled;
//   3. every wheel part posed by app.js poseModel's arithmetic, verbatim (the basis from sim.axes(), the
//      origin sim.bodyOrigin(), off + oRest, DRAWN PLACE + PHYSICS DELTA: pivot + nodeLocal - nodeRest; the
//      tailwheel inside its castor at axle - pivot) and its lowest vertex read in world y.
// Printed per wheel: the drawn tyre's bottom over the ground (mm, + = floating, - = sunk), the physics
// contact (node y - rC) over the ground, and the drawn axle against its physics node (mm).
//
//   node tools/ground_gap.js [--build <json>|cub|stock|<archetype key>]... [--settle s] [--json]
//     default: cub, stock (GEN_DEFAULT on the page's default cage), "bugReports/cessnaMetal (1).json",
//     "bugReports/cessnaFloats.json"
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const builds = [];
for (let i = 0; i < argv.length; i++) if (argv[i] === '--build') builds.push(argv[i + 1]);
if (!builds.length) builds.push('cub', 'stock', path.join(T, '..', 'bugReports', 'cessnaMetal (1).json'),
  path.join(T, '..', 'bugReports', 'cessnaFloats.json'));
const SETTLE = +arg('--settle', 6);
const TW_DRAW_DROP = 0.02;     // app.js's G1383 dial, the same number
const JSON_OUT = argv.includes('--json');

const BJ = require('./_bake_joined.js');
const { D, C } = BJ.loadPanel();

function specOf(b) {
  if (b === 'stock') return { name: 'stock (GEN_DEFAULT)', spec: JSON.parse(JSON.stringify(C.GEN_DEFAULT)) };
  const a = D.ARCHETYPES.find(x => x.key === b);
  if (a) {
    let s = D.designBake(a.sel, a.over);
    if (typeof C.genNormaliseSpec === 'function') s = C.genNormaliseSpec(s);
    return { name: b + ' (archetype)', spec: s };
  }
  const j = JSON.parse(fs.readFileSync(b, 'utf8'));
  return { name: path.basename(b), spec: j.spec || j };
}

// app.js poseModel + the wheel/castor rigs, for one frame: every drawn wheel vertex in world
function poseWheels(def, sim, vis) {
  const [xA, yU] = sim.axes(), cg = sim.bodyOrigin();
  const vZ = [xA[1] * yU[2] - xA[2] * yU[1], xA[2] * yU[0] - xA[0] * yU[2], xA[0] * yU[1] - xA[1] * yU[0]];
  const O = [(vis.off && vis.off[0]) || 0, (vis.off && vis.off[1]) || 0, 0];
  const oR = C.defBodyProject(def)(C.defCG(def));
  const toB = C.defBodyProject(def);
  const world = v => {           // model-local point -> world, poseModel's matrix
    const x = v[0] + O[0] + oR[0], y = v[1] + O[1] + oR[1], z = v[2] + oR[2];
    return [cg[0] + x * xA[0] + y * yU[0] + z * vZ[0],
            cg[1] + x * xA[1] + y * yU[1] + z * vZ[1],
            cg[2] + x * xA[2] + y * yU[2] + z * vZ[2]];
  };
  // G1383: app.js poseModel draws a taildragger's tail gear TW_DRAW_DROP under its node (world-down)
  const twDrop = (def.refs && def.refs.tw != null && def.refs.tw >= 0 && def.spec && def.spec.gear && def.spec.gear.type === 'taildragger') ? def.refs.tw : -1;
  const nodeLocal = idx => {
    const i3 = idx * 3, dx = sim.p[i3] - cg[0], dy = sim.p[i3 + 1] - (idx === twDrop ? TW_DRAW_DROP : 0) - cg[1], dz = sim.p[i3 + 2] - cg[2];
    return [dx * xA[0] + dy * xA[1] + dz * xA[2] - O[0], dx * yU[0] + dy * yU[1] + dz * yU[2] - O[1],
            dx * vZ[0] + dy * vZ[1] + dz * vZ[2]];
  };
  const nodeRest = idx => { const q = toB(def.nodes[idx].p); return [q[0] - O[0], q[1] - O[1], q[2]]; };
  const m0 = def.refs.mains && def.refs.mains[0], m1 = def.refs.mains && def.refs.mains[1];
  const onFloats = !!(def.parts && def.parts.floats && def.parts.floats.length);
  const twi = Array.isArray(def.refs.tw) ? def.refs.tw[0] : def.refs.tw;
  const zPos = m0 != null && def.nodes[m0].p[2] > 0;
  const nodeOf = onFloats ? {} : { mainsL: zPos ? m0 : m1, mainsR: zPos ? m1 : m0, tw: (twi != null && twi >= 0) ? twi : null };
  const parts = vis.parts || [];
  const castor = parts.find(p => p.kind === 'castorT');
  const out = [];
  for (const pt of parts) {
    if (!(pt.kind in nodeOf) || nodeOf[pt.kind] == null) continue;
    const idx = nodeOf[pt.kind];
    const L = nodeLocal(idx), r0 = nodeRest(idx);
    let base;                     // the part's origin, model-local
    if (pt.kind === 'tw' && castor && castor.axle) {
      const cr0 = nodeRest(idx);
      base = [castor.pivot[0] + L[0] - cr0[0] + (castor.axle[0] - castor.pivot[0]),
              castor.pivot[1] + L[1] - cr0[1] + (castor.axle[1] - castor.pivot[1]),
              castor.pivot[2] + L[2] - cr0[2] + (castor.axle[2] - castor.pivot[2])];
    } else base = [pt.pivot[0] + L[0] - r0[0], pt.pivot[1] + L[1] - r0[1], pt.pivot[2] + L[2] - r0[2]];
    let yMin = Infinity, at = null;
    for (const k in pt.groups) {
      const q = pt.groups[k].pos;
      for (let i = 0; i < q.length; i += 3) {
        const w = world([base[0] + q[i], base[1] + q[i + 1], base[2] + q[i + 2]]);
        if (w[1] < yMin) { yMin = w[1]; at = w; }
      }
    }
    const axW = world(base);
    const i3 = idx * 3;
    out.push({ kind: pt.kind, idx, R: pt.R, yMin, at, axle: axW,
               node: [sim.p[i3], sim.p[i3 + 1], sim.p[i3 + 2]], rNode: def.nodes[idx].r });
  }
  return out;
}

// the solver's contact radius (30_solver.js reset, G661), recomputed from the def
function contactR(def) {
  const n = def.nodes.length, rC = def.nodes.map(nd => nd.r);
  const M = (def.refs && def.refs.mains) || [], tw = def.refs ? def.refs.tw : null;
  let totalM = 0; for (const nd of def.nodes) totalM += nd.m;
  const W = totalM * 9.81;
  const KG = mi => mi <= 6 ? Math.min(9e4, 2.5e5 * mi) : 1.5e4 * mi;
  if (M.length) {
    let cx = 0; for (let i = 0; i < n; i++) cx += def.nodes[i].p[0] * def.nodes[i].m; cx /= totalM;
    let xm = 0; for (const i of M) xm += def.nodes[i].p[0]; xm /= M.length;
    const hasTw = tw != null && tw >= 0, xt = hasTw ? def.nodes[tw].p[0] : xm;
    const sT = hasTw && Math.abs(xt - xm) > 1e-3 ? Math.max(0, Math.min(1, (cx - xm) / (xt - xm))) : 0;
    const def0 = (i, share) => Math.max(0, Math.min(0.05, share * W / KG(def.nodes[i].m)));
    for (const i of M) rC[i] = def.nodes[i].r + def0(i, (1 - sT) / M.length);
    if (hasTw) rC[tw] = def.nodes[tw].r + def0(tw, sT);
  }
  return rC;
}

const rows = [];
for (const b of builds) {
  const { name, spec } = specOf(b);
  const r = BJ.bakeJoined(spec);
  const W = r.W;
  let vis = null;
  try { vis = W.CAGE_JOIN.snapshot(r.spec); } catch (e) { console.log(name + ': snapshot threw ' + e.message); }
  const def = C.buildGen(JSON.parse(JSON.stringify(r.spec)));
  const sim = C.makeSim(def, null);
  sim.reset(0);
  if (sim.stance) sim.stance();
  for (let i = 0, N = Math.round(SETTLE * 60); i < N; i++) sim.step(1 / 60);
  const rC = sim.rC || contactR(def);
  const W2 = vis ? poseWheels(def, sim, vis) : [];
  const line = { build: name, wheels: W2.map(w => ({
    kind: w.kind, R: +(w.R || 0).toFixed(3), rNode: +w.rNode.toFixed(3), rC: +rC[w.idx].toFixed(4),
    drawnMm: +(1000 * w.yMin).toFixed(1),                       // drawn tyre bottom over the ground
    contactMm: +(1000 * (w.node[1] - rC[w.idx])).toFixed(1),     // physics contact over the ground
    penMm: +(1000 * (rC[w.idx] - w.node[1])).toFixed(1),
    axleDy: +(1000 * (w.axle[1] - w.node[1])).toFixed(1),        // drawn axle - node, world
    axleDx: +(1000 * (w.axle[0] - w.node[0])).toFixed(1),
    axleDz: +(1000 * (w.axle[2] - w.node[2])).toFixed(1) })), errors: r.errors };
  rows.push(line);
  if (!JSON_OUT) {
    console.log('\n' + name + (r.errors && r.errors.length ? '   (join: ' + r.errors.join('; ') + ')' : ''));
    console.log('  wheel    R drawn  r node  rC      drawn bottom  contact   axle drawn-node (x/y/z mm)');
    for (const w of line.wheels)
      console.log('  ' + w.kind.padEnd(7) + String(w.R).padStart(7) + String(w.rNode).padStart(8) + String(w.rC).padStart(8)
        + (w.drawnMm.toFixed(1) + ' mm').padStart(14) + (w.contactMm.toFixed(1) + ' mm').padStart(10)
        + ('  ' + w.axleDx + ' / ' + w.axleDy + ' / ' + w.axleDz));
  }
}
if (JSON_OUT) console.log(JSON.stringify(rows, null, 1));
