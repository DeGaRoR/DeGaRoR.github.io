#!/usr/bin/env node
// GATE MOUNT — the engine stays on its bearer (G179, 2026-09-04).
//
// The user's wing-mounted twin: "the engines will move A LOT on their mounts
// during flight, the whole plane shakes ... there is still something deforming
// the wing when not moving." Measured parked: each engine hung 300 mm below
// its mount and rang at 2.5 Hz, because a wing nacelle was ONE node braced to
// the four spar nodes of its bay — all in one plane, a mechanism (rule 1) —
// and the 59 mm that sag moved the MASS CENTRE showed up as a hump at the
// wing root, because the skin's rest-vs-live origin was the CG. No flight
// gate could see either: they all settle first and subtract the baseline, and
// GATE LOAD pinned the engine to a trestle.
//
//   node tools/_mount_check.js            -> "GATE MOUNT: PASS|FAIL"
//   node tools/_mount_check.js --selftest -> negative verification
//
// For every mount kind on the stock build, and for the twin as the user saved
// it (tools/fixtures/build_v7_twin_2026-09-04.json — the join's MEASURED
// stations, which is the case the derived default did not show):
//   1 SAG      parked and settled 10 s, each engine node's body-frame offset
//              from the centroid of its own anchor nodes, live minus rest,
//              is under MOUNT_SAG on every axis.
//   2 RING     the vertical trace is inside 2 mm of its final value from
//              MOUNT_SETTLE on — a bearer that bounces at 2.5 Hz for three
//              seconds fails here even if it ends up in the right place.
//   3 ROOT     the wing root station, measured from the FIREWALL (the G179
//              origin), moves less than ROOT_MM parked in every axis: the
//              hump net. GATE SKIN holds the in-plane bound on the stock
//              build; this holds it, and the vertical, on the twin.
//   4 COST     substeps stay under SUBSTEP_MAX — the bearer is stiff at the
//              wing's own price, not the integrator's.
// Selftest: GEN_RULES.mountK = 1 and mountFoot = false rebuild the mechanism;
// the twin must then read > 100 mm of sag, or the instrument is blind.
'use strict';
const fs = require('fs'), path = require('path');
const { buildGen, makeSim, makeWorld, defBodyProject, makeSkinBinding,
        sparDeltas, makeTestPilot, genGroundPowerCap,
        GEN_DEFAULT, GEN_RULES } = require('./flight_core.js');

// 15 mm is under a rib tape's width — invisible on the stand — where the
// mechanism read 300. Measured: stock pair 3-4 mm, the twin (engines 0.65 m
// ahead of the front spar) 3-5 mm, nose/pusher/pylon under 5.
const MOUNT_SAG = 0.015, MOUNT_SETTLE = 3.0, ROOT_MM = 15, SUBSTEP_MAX = 80;
const SELF = process.argv.includes('--selftest');
let ok = true; const why = [];
const say = s => console.log(s);
const chk = (c, m) => { if (!c) { ok = false; why.push(m); } return c; };

const twin = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'fixtures', 'build_v7_twin_2026-09-04.json'), 'utf8')).spec;
const stock = (mount, extra) => {
  const sp = JSON.parse(JSON.stringify(GEN_DEFAULT));
  sp.engines = [{ type: sp.engines && sp.engines[0].type, mount }];
  if (extra) Object.assign(sp, extra);
  return sp;
};
const CASES = [
  ['stock nose',          () => stock('nose')],
  ['stock pusher',        () => stock('pusher', { fuselage: Object.assign({}, GEN_DEFAULT.fuselage, { shape: 'rod' }) })],
  ['stock over the wing', () => stock('wingTop')],
  ['stock wing pair',     () => stock('wing')],
  ['twin fixture (join)', () => JSON.parse(JSON.stringify(twin))],
];

// live body-frame projection with the same origin and axes sparDeltas uses
function liveTo(sim) {
  const o = sim.bodyOrigin(), [xA, yU] = sim.axes();
  const zL = [xA[1]*yU[2]-xA[2]*yU[1], xA[2]*yU[0]-xA[0]*yU[2], xA[0]*yU[1]-xA[1]*yU[0]];
  return i => {
    const dx = sim.p[i*3]-o[0], dy = sim.p[i*3+1]-o[1], dz = sim.p[i*3+2]-o[2];
    return [dx*xA[0]+dy*xA[1]+dz*xA[2], dx*yU[0]+dy*yU[1]+dz*yU[2],
            dx*zL[0]+dy*zL[1]+dz*zL[2]];
  };
}

function measure(lbl, build) {
  let def;
  try { def = buildGen(build()); }
  catch (e) { say(`  ${lbl.padEnd(22)} BUILD FAILED: ${e.message}`); chk(false, `${lbl}: build failed`); return null; }
  const N = def.nodes, eng = def.refs.engine || [];
  if (!chk(eng.length >= 1, `${lbl}: no engine nodes`)) return null;
  const isMount = i => /^(ENG|MNT)/.test(N[i].tag);
  const anchors = i => {
    const s = new Set();
    for (const b of def.beams) {
      if (b.a === i && !isMount(b.b)) s.add(b.b);
      if (b.b === i && !isMount(b.a)) s.add(b.a);
    }
    return [...s];
  };
  const rest = defBodyProject(def);
  const restOff = i => {
    const A = anchors(i), r = rest(N[i].p), c = [0, 0, 0];
    for (const a of A) { const q = rest(N[a].p); c[0] += q[0]/A.length; c[1] += q[1]/A.length; c[2] += q[2]/A.length; }
    return [r[0]-c[0], r[1]-c[1], r[2]-c[2]];
  };
  const sim = makeSim(def, makeWorld()); sim.reset(0);
  const liveOff = i => {
    const to = liveTo(sim), A = anchors(i), r = to(i), c = [0, 0, 0];
    for (const a of A) { const q = to(a); c[0] += q[0]/A.length; c[1] += q[1]/A.length; c[2] += q[2]/A.length; }
    return [r[0]-c[0], r[1]-c[1], r[2]-c[2]];
  };
  const r0 = eng.map(restOff);
  const sag = i => { const l = liveOff(eng[i]); return [l[0]-r0[i][0], l[1]-r0[i][1], l[2]-r0[i][2]]; };
  // the root station's in-plane and vertical motion against the firewall
  const bind = makeSkinBinding(new Float32Array(0), 0, def, { tags: ['WF', 'WR'], zRoot: 0, xMax: 1e9 });
  const nz = bind.zs.length, d = { P: new Float32Array(nz*3), N: new Float32Array(nz*3) };
  const trace = [];
  for (let s = 0; s < 10 * 60; s++) {
    sim.step(1 / 60);
    trace.push(eng.map((_, i) => sag(i)[1]));
  }
  const fin = eng.map((_, i) => sag(i));
  const worst = Math.max(...fin.map(v => Math.max(Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2]))));
  // RING: the last time any engine's vertical trace sat more than 2 mm off its final value
  let tLast = 0;
  for (let s = 0; s < trace.length; s++)
    for (let i = 0; i < eng.length; i++)
      if (Math.abs(trace[s][i] - trace[trace.length-1][i]) > 0.002) tLast = (s + 1) / 60;
  const peak = Math.max(...trace.map(row => Math.max(...row.map((v, i) => Math.abs(v - fin[i][1])))));
  sparDeltas(bind, sim, d);
  let root = 0;
  for (const S of ['P', 'N']) for (let k = 0; k < 3; k++) root = Math.max(root, Math.abs(d[S][k]));
  const bad = sim.stats().bad;
  say(`  ${lbl.padEnd(22)} ${String(eng.length).padStart(1)} eng  sag ${(worst*1000).toFixed(1).padStart(6)} mm` +
      `  ring peak ${(peak*1000).toFixed(1).padStart(6)} mm, quiet after ${tLast.toFixed(2)} s` +
      `  root ${(root*1000).toFixed(1).padStart(5)} mm  substeps ${def.params.substeps}${bad ? '  *** DIVERGED' : ''}`);
  return { worst, tLast, root, peak, substeps: def.params.substeps, bad, eng: eng.length };
}

say('MOUNT — the engine stays on its bearer. Parked 10 s; sag = engine node vs');
say('the centroid of its anchors, live minus rest; root = the wing root station');
say('against the firewall ring (the G179 origin). Bounds: sag < ' + (MOUNT_SAG*1000) +
    ' mm, quiet by ' + MOUNT_SETTLE + ' s, root < ' + ROOT_MM + ' mm, substeps <= ' + SUBSTEP_MAX + '.');
say('');
for (const [lbl, build] of CASES) {
  const r = measure(lbl, build);
  if (!r) continue;
  chk(!r.bad, `${lbl}: diverged`);
  chk(r.worst < MOUNT_SAG, `${lbl}: engine sags ${(r.worst*1000).toFixed(1)} mm on its bearer`);
  chk(r.tLast < MOUNT_SETTLE, `${lbl}: bearer still ringing at ${r.tLast.toFixed(2)} s`);
  chk(r.root * 1000 < ROOT_MM, `${lbl}: wing root moved ${(r.root*1000).toFixed(1)} mm against the firewall`);
  chk(r.substeps <= SUBSTEP_MAX, `${lbl}: ${r.substeps} substeps`);
}
chk(measure.length === 2, 'instrument shape');

// 5 THE ROLL — with the mount honest, the thrust acts where the engines are,
// and the twin (engines 1.94 m up, CG 1.14 m up, mains 0.51 m ahead) goes
// over on its nose at 0.78 of full throttle, tail down: measured, tail 5 m
// up at 8 s, "rejected-takeoff". genGroundPowerCap is the criterion and the
// pilots' ground cap; this holds that the test pilot's own roll keeps the
// tail down and gets airborne. The stock build reads ratio 0 (nose engine
// below the CG) and cap 1 — nothing in the fleet moves.
{
  const roll = (lbl, build, secs) => {
    const def = buildGen(build()), world = makeWorld();
    const sim = makeSim(def, world); sim.reset(0);
    for (let s = 0; s < 600; s++) sim.step(1 / 60);
    const GP = genGroundPowerCap(def, sim.thrustAt(0), sim.totalM * 9.81);
    const ap = makeTestPilot(sim, def, world);
    const tw = def.refs.tw;
    const gy = i => sim.p[i*3+1] - world.terrainH(sim.p[i*3], sim.p[i*3+2]);
    let twMax = 0, lifted = false, thrMax = 0;
    for (let s = 0; s < secs * 60; s++) {
      ap.update(1 / 60); sim.step(1 / 60);
      if (sim.out.Vg < 15) { twMax = Math.max(twMax, tw >= 0 ? gy(tw) : 0); thrMax = Math.max(thrMax, sim.ctl.thr); }
      if (ap.phase === 'LIFTOFF' || ap.phase === 'CLIMB') lifted = true;
      if (sim.stats().bad || ap.phase === 'STOPPED') break;
    }
    say(`  ${lbl.padEnd(22)} power nose-over ${GP.ratio.toFixed(2)} x, cap ${GP.cap.toFixed(2)}  roll: tail agl max ${twMax.toFixed(2)} m, throttle max ${thrMax.toFixed(2)}, ${lifted ? 'airborne' : 'NOT airborne'} (${ap.phase} at ${ap.t.toFixed(0)} s)`);
    return { GP, twMax, lifted };
  };
  const t = roll('twin fixture (join)', () => JSON.parse(JSON.stringify(twin)), 90);
  chk(t.GP.ratio > 0.9, 'twin: the criterion no longer sees the high thrust line');
  chk(t.twMax < 1.5, `twin: tail rose ${t.twMax.toFixed(2)} m on the roll (power nose-over)`);
  chk(t.lifted, 'twin: the test pilot did not get it airborne');
  const c = roll('stock nose', () => stock('nose'), 60);
  chk(c.GP.cap === 1 && c.lifted, 'stock: the cap moved a nose-engined aeroplane');
}

if (SELF) {
  say('');
  say('selftest: the flat single-node mount (mountK 1, no foot) on the twin');
  const k0 = GEN_RULES.mountK, f0 = GEN_RULES.mountFoot;
  GEN_RULES.mountK = 1; GEN_RULES.mountFoot = false;
  const r = measure('twin, mechanism', () => JSON.parse(JSON.stringify(twin)));
  GEN_RULES.mountK = k0; GEN_RULES.mountFoot = f0;
  const caught = !!r && (r.worst > 0.100 || r.tLast >= MOUNT_SETTLE);
  say(`  selftest ${'a mount that is a mechanism'.padEnd(36)} ${caught ? 'CAUGHT' : 'MISSED'}`);
  chk(caught, 'selftest: the instrument did not see the flat mount');
}

say('');
for (const w of why) say('  FAIL: ' + w);
say(`GATE MOUNT: ${ok ? 'PASS' : 'FAIL'}`);
process.exit(ok ? 0 : 1);
