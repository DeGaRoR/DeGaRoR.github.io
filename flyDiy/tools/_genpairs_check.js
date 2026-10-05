#!/usr/bin/env node
// _genpairs_check.js — GATE GENPAIRS (REVIEW 2026-10-04, findings B10/B11): the lattice over PAIRED configurations.
// GATE GEN builds sixteen single-change configurations; the defects found by the review live in combinations the
// gate never builds (a pusher on a tricycle: the nosewheel braced to the engine; a twin boom: two zero-length beams
// where HTL/HTR coincide with the boom chain). For every configuration here: every node finite, every beam between
// two distinct nodes with a length over 1 mm, every mass finite and positive, and the lattice mirror-symmetric in
// positions and masses about z = 0. Verdict contract: one final `GATE GENPAIRS: PASS|FAIL`, exit code to match.
// REGISTERED as core by GEN-PAIRS G1580 (B10 fixed: the stab's tagged boom node IS the boom's tail-triangle top when
// the stab sits on the crown). B() refuses a zero-length member and counts it on parts.degenerate: held at 0 here.
const C = require('./flight_core.js');
const base = () => JSON.parse(JSON.stringify(C.GEN_DEFAULT));
const mut = {
  tricycle: s => { s.gear.type = 'tricycle'; },
  pusher: s => { s.engines[0].mount = 'pusher'; },
  wingTop: s => { s.engines[0].mount = 'wingTop'; },
  twinBoom: s => { s.tail.type = 'twinBoom'; s.tail.boomX = 1.2; s.tail.boomLen = 3.5; },
  vtail: s => { s.tail.type = 'v'; s.tail.vAngle = 35; },
  biplane: s => { const w = JSON.parse(JSON.stringify(s.wings[0])); s.wings[0].position = 'low'; w.position = 'parasol'; s.wings.push(w); },
  floats: s => { s.gear.type = 'floats'; },
};
const CONFIGS = [[], ['tricycle'], ['pusher'], ['wingTop'], ['twinBoom'], ['vtail'], ['biplane'], ['floats'],
  ['pusher', 'tricycle'], ['wingTop', 'tricycle'], ['twinBoom', 'tricycle'], ['vtail', 'tricycle'], ['twinBoom', 'floats'],
  ['biplane', 'tricycle'], ['pusher', 'twinBoom'], ['vtail', 'floats'], ['biplane', 'pusher']];
const fails = [];
for (const cfg of CONFIGS) {
  const label = cfg.length ? cfg.join('+') : 'stock';
  let def;
  try { const s = base(); for (const k of cfg) mut[k](s); def = C.buildGen(s); }
  catch (e) { fails.push(`${label}: build threw ${String(e.message || e).slice(0, 80)}`); console.log(`BAD ${label}: ${e.message}`); continue; }
  const N = def.nodes, B = def.beams, bad = [];
  let nanN = 0, badM = 0, zero = 0, badRef = 0, asym = 0;
  for (const nd of N) { if (!nd.p.every(Number.isFinite)) nanN++; if (!(nd.m > 0 && Number.isFinite(nd.m))) badM++; }
  for (const b of B) {
    if (!(b.a >= 0 && b.a < N.length && b.b >= 0 && b.b < N.length) || b.a === b.b) { badRef++; continue; }
    const p = N[b.a].p, q = N[b.b].p;
    if (Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]) < 1e-3) zero++;
  }
  // mirror: every node with |z| > 1 mm has a twin at (x, y, -z) with the same mass
  const key = (x, y, z) => `${x.toFixed(3)}|${y.toFixed(3)}|${z.toFixed(3)}`;
  const map = new Map(); for (const nd of N) map.set(key(nd.p[0], nd.p[1], nd.p[2]), nd);
  for (const nd of N) { if (Math.abs(nd.p[2]) < 1e-3) continue; const t = map.get(key(nd.p[0], nd.p[1], -nd.p[2])); if (!t || Math.abs(t.m - nd.m) > 1e-6) asym++; }
  const deg = (def.parts && def.parts.degenerate) || [];
  if (deg.length) bad.push(`${deg.length} members refused at zero length (${deg.slice(0, 3).map(r => N[r[0]].tag + '-' + N[r[1]].tag).join(' ')})`);
  if (nanN) bad.push(`${nanN} non-finite nodes`); if (badM) bad.push(`${badM} bad masses`); if (zero) bad.push(`${zero} zero-length beams`);
  if (badRef) bad.push(`${badRef} bad beam refs`); if (asym) bad.push(`${asym} unmirrored nodes`);
  console.log(`${bad.length ? 'BAD' : 'ok '} ${label.padEnd(18)} nodes ${String(N.length).padStart(4)} beams ${String(B.length).padStart(4)}${bad.length ? '  ' + bad.join(', ') : ''}`);
  if (bad.length) fails.push(`${label}: ${bad.join(', ')}`);
}
if (fails.length) console.log('FAILED CHECKS: ' + fails.join('; '));
console.log(fails.length ? 'GATE GENPAIRS: FAIL' : 'GATE GENPAIRS: PASS');
process.exitCode = fails.length ? 1 : 0;
