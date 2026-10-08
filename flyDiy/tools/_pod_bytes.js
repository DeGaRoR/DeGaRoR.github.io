#!/usr/bin/env node
// GATE POD's byte witness (G2679, BELLY-POD-2): ONE validated build WITHOUT a pod, its certificate and its flown sim,
// as digests - printed as one JSON line. GATE POD spawns one process a build (4 at a time) and holds every line to
// tools/_pod_base.json's, which `_pod_check.js --bless` writes from the BASE core (a worktree of the commit the pod
// work started from): the pod's code (60d_gen_pod.js, 61_gen_frame's pod block and its cMul door, the editor's
// section, the drawn layer) leaves an aeroplane without a pod the certificate and the flight it had, to the bit.
//
//   node tools/_pod_bytes.js <build file> [--floats]     --floats: the twin on floats (gear type and cage row patched)
//   -> {"file":..., "cert": "<fnv>:<len>", "sim": "<fnv>", "steps": 300, "nodes": n, "certS": s}
//
// The certificate: genCertify(def) whole (every case's member forces, the envelope, the speeds) but its `ms` (the
// wall-clock it took), as JSON. The sim:
// makeSim on the analytic world, reset at HOME, 300 steps of 1/60 s untouched (the aeroplane settling on its gear
// with the engine as the def starts it) - the FNV-1a of p and v's bytes.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
const argv = process.argv.slice(2);
const file = argv.find(a => !a.startsWith('--'));
let j = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
if (argv.includes('--floats')) { j.spec.gear.type = 'floats'; j.spec.cage = Object.assign({}, j.spec.cage, { gearFloats: 1 }); }
const spec = j.spec || j;
function digest(o) {
  const seen = new WeakSet();
  const s = JSON.stringify(o, (k, v) => {
    if (typeof v === 'function') return undefined;
    if (ArrayBuffer.isView(v)) return Array.from(v);
    if (v && typeof v === 'object') { if (seen.has(v)) return '[seen]'; seen.add(v); }
    return v;
  });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16) + ':' + s.length;
}
function fnvBytes(...arrs) {
  let h = 0x811c9dc5;
  for (const a of arrs) { const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b[i], 16777619) >>> 0; }
  return h.toString(16);
}
const def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
const t0 = Date.now();
const cert = C.genCertify(def);
delete cert.ms;                               // (the certificate's own wall-clock timings: not physics)
const certS = (Date.now() - t0) / 1000;
const W = C.makeWorld();
const sim = C.makeSim(def, W); sim.reset(0);
for (let i = 0; i < 300; i++) sim.step(1 / 60);
console.log(JSON.stringify({ file, cert: digest(cert), sim: fnvBytes(sim.p, sim.v), steps: 300, nodes: def.nodes.length, certS }));
