#!/usr/bin/env node
// Gate: MASS CAN CHANGE NOW (G121) — the quality review's P-4, landed BEFORE
// the energy arc's burn/discharge so it cannot be built on the old traps:
//   B1/B3  the sanctioned door: setNodeMass keeps totalM (a live getter now)
//          and the ground rig honest; cgPos stays exact through a drain.
//   B2     the integrator is sized at DRY mass — a beam is stiffest when its
//          tank is empty, and the old full-tanks sizing was stable on
//          departure and divergent at reserves.
//   fuel   the frame RECORDS which kilos are fuel (node.mFuel), which is the
//          record burn will drain through the door.
//   B4     the taxi feedforward follows the live mass.
//   B5     the sheet at reserves exists, and the static margin MOVES.
//   B8     a second engine is clamped out until mounts are real — thrust
//          would multiply with no asymmetry and no Vmc.
// node tools/test_massproof.js            -> the battery
// node tools/test_massproof.js --selftest -> negative verification
'use strict';
const { makeSim, makeTestPilot, buildGen, genShakedown } =
  require('./flight_core.js');

const fails = [];
const check = (ok, label, extra) => {
  console.log((ok ? '  ok     ' : '  FAIL   ') + label +
    (ok || !extra ? '' : ' — ' + extra));
  if (!ok) fails.push(label);
  return ok;
};

// ---------------------------------------------------------------------------
function checkDoor(o) {
  check(Math.abs(o.dTotal + o.drained) < 1e-9,
    'door: totalM follows the drain, live (' + o.dTotal.toFixed(1) + ' kg for -' +
    o.drained + ')');
  check(Math.abs(o.cgErr) < 1e-9,
    'door: cgPos stays exact through a drain (err ' + o.cgErr.toExponential(1) + ')');
  check(Math.abs(o.resetErr) < 1e-9,
    'door: reset() restores the design mass (err ' + o.resetErr.toExponential(1) + ')');
}
function checkFuel(o) {
  check(Math.abs(o.recorded - o.billed) < 1e-6,
    'fuel: the recorded kilos ARE the billed kilos (' + o.recorded.toFixed(1) +
    ' of ' + o.billed.toFixed(1) + ')');
  check(o.nodes === 2, 'fuel: on exactly the two tank nodes (' + o.nodes + ')');
}
function checkSubsteps(o) {
  check(o.omegaDryDt <= 0.451,
    'substeps: sized so the DRY airframe stays under the stability bound (' +
    o.omegaDryDt.toFixed(3) + ')');
  // MEASURED before this check was written: on every stock tank placement the
  // global max-omega beam is a LIGHT STRUCTURAL node's (wing root to frame,
  // 1258 rad/s) and never a fuel beam's — so the review's "divergent at
  // reserves" is a forecast for the energy arc's vessels-on-light-nodes, not
  // a current fact. What must hold NOW: the mechanism (a fuel beam genuinely
  // stiffens per unit mass as it drains — measured x1.28 here) and the
  // guarantee (dry sizing can never ask for less than full).
  check(o.fuelDry > o.fuelFull * 1.15,
    'substeps: a fuel beam stiffens as it drains (x' +
    (o.fuelDry / Math.max(1e-9, o.fuelFull)).toFixed(2) + ') — the mechanism is real');
  check(o.needDry >= o.needFull - 1e-9,
    'substeps: dry sizing never asks for less than full (' +
    o.needDry.toFixed(1) + ' vs ' + o.needFull.toFixed(1) + ')');
}
function checkTaxi(o) {
  check(o.after < o.before - 1e-4,
    'taxi: the feedforward follows the live mass (' + o.before.toFixed(3) +
    ' -> ' + o.after.toFixed(3) + ')');
}
function checkReserve(o) {
  check(!!o.reserve, 'reserve: the sheet at reserves exists when there is fuel');
  check(o.reserve && o.reserve.mass < o.mass - 15,
    'reserve: it is lighter (' + (o.reserve ? o.reserve.mass.toFixed(0) : '—') +
    ' vs ' + o.mass.toFixed(0) + ' kg)');
  check(o.reserve && Math.abs(o.reserve.staticMargin - o.staticMargin) > 0.002,
    'reserve: the static margin MOVES with the fuel (' +
    (o.reserve ? o.reserve.staticMargin.toFixed(3) : '—') + ' vs ' +
    o.staticMargin.toFixed(3) + ') — the single-number plaque was the lie');
  check(o.dryReserve === undefined,
    'reserve: no sheet when there is no fuel to burn');
}
function checkTwin(o) {
  check(o.nEngines === 1,
    'twin: a second engine is clamped out until the mounts are real (' +
    o.nEngines + ')');
}

// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  const probes = [
    ['totalM lags the drain', checkDoor,
     { dTotal: -19.4, drained: 20, cgErr: 0, resetErr: 0 }],
    ['cgPos drifts through a drain', checkDoor,
     { dTotal: -20, drained: 20, cgErr: 0.02, resetErr: 0 }],
    ['fuel kilos unrecorded', checkFuel, { recorded: 0, billed: 43.2, nodes: 0 }],
    ['substeps sized at full tanks', checkSubsteps,
     { omegaDryDt: 0.54, needDry: 80, needFull: 66, fuelDry: 900, fuelFull: 700 }],
    ['a fuel beam that does not stiffen', checkSubsteps,
     { omegaDryDt: 0.40, needDry: 66, needFull: 66, fuelDry: 700, fuelFull: 700 }],
    ['taxi feedforward frozen', checkTaxi, { before: 0.21, after: 0.21 }],
    ['reserve margin does not move', checkReserve,
     { reserve: { mass: 500, staticMargin: 0.2 }, mass: 540, staticMargin: 0.2,
       dryReserve: undefined }],
    ['the twin slipped through', checkTwin, { nEngines: 2 }],
  ];
  let caught = 0;
  for (const [nm, fn, o] of probes) {
    const before = fails.length;
    fn(o);
    const ok = fails.length > before;
    fails.length = before;
    console.log(`  selftest ${nm.padEnd(36)} ${ok ? 'CAUGHT' : 'MISSED'}`);
    if (ok) caught++;
  }
  const pass = caught === probes.length;
  console.log('GATE MASS: ' + (pass ? 'PASS' : 'FAIL (selftest: ' +
    (probes.length - caught) + ' missed)'));
  process.exit(pass ? 0 : 1);
}

// ---------------------------------------------------------------------------
// measure — on a PANEL-tank long-range build: outboard fuel on light panel
// nodes is where every trap is at its worst (the wing-ROOT tank was tried
// first and the stiffest beam was not a fuel beam there — dry sizing equalled
// full sizing and proved nothing; the panel is where the fix must bite).
// ---------------------------------------------------------------------------
const FUEL = 120;
const def = buildGen({ fuel: { litres: FUEL, tank: 'panel' } });

console.log('-- the door (B1/B3) --');
{
  const sim = makeSim(def, null); sim.reset(0);
  const i = def.nodes.findIndex(nd => (nd.mFuel || 0) > 0);
  const t0 = sim.totalM, cg0 = sim.cgPos(), m0 = sim.m[i];
  const drained = 20;
  sim.setNodeMass(i, m0 - drained);
  const cgExp = (t0 * cg0[0] - drained * sim.p[i * 3]) / (t0 - drained);
  const dTotal = sim.totalM - t0;
  const cgErr = sim.cgPos()[0] - cgExp;
  sim.reset(0);
  checkDoor({ dTotal, drained, cgErr, resetErr: sim.totalM - t0 });
}

console.log('-- the fuel record --');
{
  let recorded = 0, nodes = 0;
  for (const nd of def.nodes) if (nd.mFuel > 0) { recorded += nd.mFuel; nodes++; }
  checkFuel({ recorded, billed: FUEL * 0.72, nodes });
}

console.log('-- the integrator at dry mass (B2) --');
{
  // the sizing rule, replicated from 62_gen_aero genSubsteps (G121 form):
  // omega over 1/reduced-mass, bounded by GEN_WDT_MAX = 0.45 at 60*sub Hz
  const need = dry => {
    let wMax = 0;
    for (const b of def.beams) {
      const mm = i => Math.max(0.5, def.nodes[i].m -
        (dry ? (def.nodes[i].mFuel || 0) : 0));
      wMax = Math.max(wMax, Math.sqrt(b.k * (1 / mm(b.a) + 1 / mm(b.b))));
    }
    return wMax / (60 * 0.45);
  };
  const needDry = need(true), needFull = need(false);
  const dt = 1 / (60 * def.params.substeps);
  let omegaDryDt = 0, fuelDry = 0, fuelFull = 0;
  for (const b of def.beams) {
    const mm = i => Math.max(0.5, def.nodes[i].m - (def.nodes[i].mFuel || 0));
    const wD = Math.sqrt(b.k * (1 / mm(b.a) + 1 / mm(b.b)));
    omegaDryDt = Math.max(omegaDryDt, wD * dt);
    if ((def.nodes[b.a].mFuel || 0) > 0 || (def.nodes[b.b].mFuel || 0) > 0) {
      const mF = i => def.nodes[i].m;
      fuelDry = Math.max(fuelDry, wD);
      fuelFull = Math.max(fuelFull,
        Math.sqrt(b.k * (1 / mF(b.a) + 1 / mF(b.b))));
    }
  }
  checkSubsteps({ omegaDryDt, needDry, needFull, fuelDry, fuelFull });
}

console.log('-- the taxi feedforward (B4) --');
{
  const sim = makeSim(def, null); sim.reset(0);
  const ap = makeTestPilot(sim, def, null);
  const before = ap.taxiFF();
  for (let i = 0; i < def.nodes.length; i++)
    if (def.nodes[i].mFuel > 0)
      sim.setNodeMass(i, sim.m[i] - def.nodes[i].mFuel);
  checkTaxi({ before, after: ap.taxiFF() });
}

console.log('-- the sheet at reserves (B5) --');
{
  const sh = genShakedown(def);
  const dry = genShakedown(buildGen({ fuel: { litres: 0 } }));
  checkReserve({ reserve: sh.reserve, mass: sh.mass,
                 staticMargin: sh.staticMargin, dryReserve: dry.reserve });
}

console.log('-- the twin guard (B8) --');
checkTwin({ nEngines: buildGen({ engines: [{ type: 'a65_sensenich74' },
  { type: 'a65_sensenich74' }] }).params.nEngines });

if (fails.length) console.log('FAILED CHECKS: ' + fails.join(', '));
console.log('GATE MASS: ' + (fails.length ? 'FAIL' : 'PASS'));
process.exit(fails.length ? 1 : 0);
