// THE ROD IN TWIST: the cabin held, +-F at the stab tips (G199.5's couple), settled; the tail's roll against the mains, the
// aft members' peak strain and force, the step the lattice needs - the lattice as built (the cone), the lattice on the
// drawn tube, and that one with the tube element off. node twist.js <k> [F]
const fs = require('fs'); const { C, recOf } = require('./core_ab.js'); globalThis.__AB = null;
const k = process.argv[2], F = +(process.argv[3] || 150);
const sp = JSON.parse(fs.readFileSync(__dirname + '/spec_' + k + '.json')).spec, rec = recOf(k, __dirname);
function rodSpec(s0) {
  const s = JSON.parse(JSON.stringify(s0)); const d0 = C.buildGen(JSON.parse(JSON.stringify(s0))); const x0 = d0.spec.fuse.boxRear, x1 = d0.spec.fuse.tailArm;
  const at = x => { if (x >= rec.closeX) { const r = rec.rows[rec.rows.length - 1], yc = 0.5 * (r.yb + r.yt); return { w: 0.5 * rec.rod.d, yb: yc - 0.5 * rec.rod.d, yt: yc + 0.5 * rec.rod.d }; }
    let i = 1; while (i < rec.rows.length - 1 && rec.rows[i].x < x) i++; const p = rec.rows[i - 1], q = rec.rows[i], u = Math.max(0, Math.min(1, (x - p.x) / Math.max(1e-6, q.x - p.x)));
    return { w: p.w + (q.w - p.w) * u, yb: p.yb + (q.yb - p.yb) * u, yt: p.yt + (q.yt - p.yt) * u }; };
  const prof = []; for (let i = 0; i <= 16; i++) { const t = i / 16; prof.push(Object.assign({ t }, at(x0 + (x1 - x0) * t))); }
  s.fuselage.profile = prof; return s;
}
function run(spec, tubeOff, Fz) {
  // GATE FLEX's tail-arm rig (test_flex.js statTail): pinned on every substep, impulses per substep, 0.9 per frame
  const R = C.GEN_RULES, keep = R.rodBoomTube; if (tubeOff) R.rodBoomTube = 0;
  let def; try { def = C.buildGen(JSON.parse(JSON.stringify(spec))); } finally { R.rodBoomTube = keep; }
  const sim = C.makeSim(def, null); sim.reset(0);
  const SUB = sim.trueBox() || def.params.substeps || 24;
  const iL = def.nodes.findIndex(n => n.tag === 'HTL'), iR = def.nodes.findIndex(n => n.tag === 'HTR');
  const free = def.nodes.map(n => n.p[0] > rec.closeX + 0.05);      // the rod and the tail, behind the drawn pod
  const pin = [];
  for (let i = 0; i < sim.n; i++) { sim.p[i*3] = def.nodes[i].p[0]; sim.p[i*3+1] = def.nodes[i].p[1] + 200; sim.p[i*3+2] = def.nodes[i].p[2];
    sim.v[i*3] = sim.v[i*3+1] = sim.v[i*3+2] = 0; if (!free[i]) pin.push([i, sim.p[i*3], sim.p[i*3+1], sim.p[i*3+2]]); }
  const clamp = () => { for (const q of pin) { const o = q[0]*3; sim.p[o] = q[1]; sim.p[o+1] = q[2]; sim.p[o+2] = q[3]; sim.v[o] = sim.v[o+1] = sim.v[o+2] = 0; } };
  const go = (fL, fR, secs) => { for (let t = 0; t < secs; t += 1 / 60) { const dt = 1 / 60;
    for (let k = 0; k < SUB; k++) { sim.impulse(iL, 0, fL * dt / SUB, 0); sim.impulse(iR, 0, fR * dt / SUB, 0); sim.step(dt / SUB, 1); clamp(); }
    for (let i = 0; i < sim.n; i++) { sim.v[i*3] *= 0.9; sim.v[i*3+1] *= 0.9; sim.v[i*3+2] *= 0.9; } } };
  go(0, 0, 3);
  const y = i => sim.p[i*3+1], a0 = y(iL), b0 = y(iR);
  // the rod's own twist: the last lattice ring's BL->BR line and the post TPB->TPT, about x, against their settled angle
  const tagI = t => def.nodes.findIndex(n => n.tag === t);
  const nR = def.parts.ST.length - 1, rBL = tagI('S' + nR + 'BL'), rBR = tagI('S' + nR + 'BR'), pB = tagI('TPB'), pT = tagI('TPT');
  const angX = (i, j) => Math.atan2(sim.p[j*3+1] - sim.p[i*3+1], sim.p[j*3+2] - sim.p[i*3+2]) * 180 / Math.PI;
  const angP = (i, j) => Math.atan2(sim.p[j*3+2] - sim.p[i*3+2], sim.p[j*3+1] - sim.p[i*3+1]) * 180 / Math.PI;
  const ring0 = rBL >= 0 ? angX(rBL, rBR) : 0, post0 = pB >= 0 ? angP(pB, pT) : 0;
  const Lr = def.beams.map(b => Math.hypot(sim.p[b.b*3]-sim.p[b.a*3], sim.p[b.b*3+1]-sim.p[b.a*3+1], sim.p[b.b*3+2]-sim.p[b.a*3+2]));
  go(Fz, -Fz, 4);
  const span = Math.abs(def.nodes[iL].p[2] - def.nodes[iR].p[2]);
  const roll = Math.atan(((y(iL) - a0) - (y(iR) - b0)) / span) * 180 / Math.PI;
  const ringTw = rBL >= 0 ? angX(rBL, rBR) - ring0 : null, postTw = pB >= 0 ? -(angP(pB, pT) - post0) : null;
  let eMax = 0, fMax = 0, nAft = 0, worst = '';
  def.beams.forEach((b, j) => { const pa = def.nodes[b.a].p, pb = def.nodes[b.b].p; if (Math.min(pa[0], pb[0]) < rec.closeX + 0.05 || b.cls !== 'fus') return;
    const q = sim.p, dl = Math.hypot(q[b.b*3]-q[b.a*3], q[b.b*3+1]-q[b.a*3+1], q[b.b*3+2]-q[b.a*3+2]) - Lr[j];
    if (Math.abs(dl / b.L) > eMax) { eMax = Math.abs(dl / b.L); worst = def.nodes[b.a].tag + '-' + def.nodes[b.b].tag; } fMax = Math.max(fMax, Math.abs(b.k * dl)); nAft++; });
  const st = sim.stats ? sim.stats() : {};
  return { roll, ringTw, postTw, worst, eMax, fMax, nAft, substeps: SUB, bad: st.bad, span, mat: def.spec.material,
           gj: (def.clusters.find(c => c.cls === 'rod') || {}).gj || 0, W: sim.totalM * 9.81, Sh: def.spec.tail.Sh, Sw: def.spec.geom.Sw };
}
const out = {};
for (const [lab, spec, off] of [['cone (today)', sp, 0], ['nodes on the drawn tube', rodSpec(sp), 0], ['on the tube, tube element off', rodSpec(sp), 1]]) {
  const a = run(spec, off, F), z = { roll: 0 };
  out[lab] = { ringTw: a.ringTw, postTw: a.postTw, worst: a.worst, roll: a.roll - z.roll, eMax: a.eMax, fMax: a.fMax, nAft: a.nAft, substeps: a.substeps, bad: a.bad, span: a.span, mat: a.mat, gj: a.gj };
  console.log(k.padEnd(8), lab.padEnd(30), 'roll', (a.roll - z.roll).toFixed(2), 'deg (ring', a.ringTw && a.ringTw.toFixed(2), 'post', a.postTw && a.postTw.toFixed(2), ') | worst', a.worst, '| aft members', a.nAft, 'peak strain', a.eMax.toExponential(2), 'peak force', a.fMax.toFixed(0), 'N | substeps', a.substeps, a.bad ? 'BAD' : '', '| GJ', a.gj.toFixed(0));
}
fs.writeFileSync(__dirname + '/twist_' + k + '.json', JSON.stringify({ F, out, d: rec.rod.d, closeX: rec.closeX, rodL: rec.rod.x1 - rec.rod.x0 }));
