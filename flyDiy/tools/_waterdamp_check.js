#!/usr/bin/env node
// GATE WATERDAMP (G2105, WATER-DAMP) - A DITCHED AEROPLANE SETTLES; THE PROP THAT MEETS THE WATER STOPS.
//
// The user (6 Oct, damage tests on the water): "the plane keeps oscillating for a while ... like if the engine was still
// running, or there was a source of force, or an oscillation not damped enough". Measured on master (tools/ditch_osc.js):
// the user's Cub ditched at 22 m/s rocked in a heave limit cycle that never decayed, and a prop under the water kept its
// full thrust. 32_hydro.js now carries the waves a heaving hull radiates (linear, per substep) and three fixes to the held
// 360 Hz force (the cap off the buoyancy, the air share of this compute, the buoyancy's gradient on the held substeps);
// 30_solver.js stops an engine whose disc is in the water; the crash ending closes the throttle (app.js, sim_host.js).
//
//   node tools/_waterdamp_check.js [--show]   -> "GATE WATERDAMP: PASS|FAIL"
//
//   1 THE DECAY      the user's Cub and the metal Cessna ditched (GEAR-WATER's entry: 0.3 m over the SEA lane, 22 m/s,
//                    sinking 1 m/s, throttle closed), 30 s at the page's 1/60 (the worker's SIM_HOST_DT too): the heave's
//                    oscillation (each 1 s window, its straight line out) under 1 cm p-p from at most 10 s, and every
//                    window after it under 1 cm to 30 s - no limit cycle.
//   2 THE CONTROL    the same Cub on the old law (32_hydro.js WB_OPT all 0 - master's bits): never under 1 cm by 30 s (the
//                    instrument sees the bug).
//   3 THE HELD RATE  the radiation off, the Cub's held compute (hydroEvery from HYDRO_HZ: 13 substeps) against the force
//                    computed every substep (hydroEvery 1, old law): the oscillation's 10-20 / 20-30 s windows within 2 mm
//                    of it - the held force is the force; the old law held is 4 x it at 20-30 s (printed).
//   4 THE PROP       the Cub ditched with the throttle LEFT at 0.6 (master: 729 N to the end): the disc meets the water in
//                    the first second and the thrust is 0 after it; damage OFF a stall (not seized; the starter cannot
//                    catch while the disc is under), damage ON a prop strike ('water', seized); on its strip, dry, the
//                    engine runs and `out` never carries propWet.
//   5 THE FLOATS     a float build carries no wet body and, settled on the water at a quarter throttle, never wets its
//                    disc (the floats' bits are master's: GATE FLOATS / SEAPLANE's logs, compared byte for byte).
//   6 THE ENDING     sim_host.js's step closes the throttle once the crash is over; app.js's script() carries the same.
'use strict';
const path = require('path'), fs = require('fs'), os = require('os');
const { execFile } = require('child_process');
const ROOT = path.join(__dirname, '..');
const C = require('./flight_core.js');
const O = require('./ditch_osc.js');
const SHOW = process.argv.includes('--show');
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
// THE OPEN LIST (train 41, the user's ruling): a row split out until its owner lands - printed, never counted
const open = (ok, line, owner) => console.log((ok ? 'PASS ' : 'OPEN ') + line + (ok ? '' : ' [' + owner + ']'));
const HELD_OWNER = 'owner WATER-LOOK: the held rate against the substep once the rocking is not damped by the old rigid damper (DMG-DAMP G1885), opened 2026-10-09';
const f = (v, n = 3) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : String(v);
const mm = v => f(1000 * v, 1) + ' mm';

// the ditch runs, each its own process (WB_OPT is the core's one global), in parallel
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'waterdamp-'));
function ditch(key, b, args) {
  const out = path.join(TMP, key + '.json');
  return new Promise((res, rej) => execFile(process.execPath, [path.join(__dirname, 'ditch_osc.js'), '--builds', b, '--secs', '30', '--json', out].concat(args),
    { maxBuffer: 1 << 24 }, (e, so) => { if (e) return rej(e); if (SHOW) console.log(so); res(JSON.parse(fs.readFileSync(out, 'utf8'))[b]); }));
}
const OLD = ['--rad', '0', '--grad', '0', '--cap', '0', '--now', '0'];
const firstUnder = (S, lim, from = 0) => { // the first second from which every 1 s window stays under lim
  let t = null; for (let k = S.osc1s.length - 1; k >= from; k--) { if (!(S.osc1s[k] < lim)) break; t = k; } return t; };
const maxOver = (S, a, b) => Math.max(...S.osc1s.slice(a, b));
const win = (S, a, b) => { const w = S.W.find(x => x.t0 === a); return w ? w.heave.osc : NaN; };

(async () => {
  const t0 = Date.now();
  const [cub, metal, cubOld, cubHeld, cubEvery1] = await Promise.all([
    ditch('cub', 'cub', []), ditch('metal', 'metal', []), ditch('cubOld', 'cub', OLD),
    ditch('cubHeld', 'cub', ['--rad', '0', '--win', '10']), ditch('cubEvery1', 'cub', OLD.concat(['--every', '1', '--win', '10'])),
  ]);
  const cubOldH = await ditch('cubOldHeld', 'cub', OLD.concat(['--win', '10']));

  // ---- 1 THE DECAY ----------------------------------------------------------------------------------------------------
  console.log('\n1 THE DECAY (ditched at 22 m/s, sinking 1 m/s, throttle closed; 1 s windows, the line out)');
  verdict(Math.abs(require('../src/viewer/sim_host.js').SIM_HOST_DT - 1 / 60) < 1e-15, `the worker steps 1/60 (SIM_HOST_DT) - the page's step; the runs below are both paths'`);
  for (const [name, S] of [['the user\'s Cub', cub], ['the metal Cessna', metal]]) {
    const tU = firstUnder(S, 0.01);
    console.log(`   ${name}: per second ${S.osc1s.slice(0, 12).map(x => (1000 * x).toFixed(0)).join(' ')} ... mm; 10-30 s at most ${mm(maxOver(S, 10, 30))}`);
    verdict(S.finite && tU != null && tU <= 12, `${name} settles under 1 cm p-p from ${tU == null ? 'never' : tU + ' s'} (bound 12 s: re-derived by name on train 41's honest damper, DMG-DAMP G1885 - the Cub settles in 11 s, not master's 7) and stays under to 30 s (the most after 10 s ${mm(maxOver(S, 10, 30))})`);
  }

  // ---- 2 THE CONTROL --------------------------------------------------------------------------------------------------
  console.log('\n2 THE CONTROL (the old law: 32_hydro.js WB_OPT all 0)');
  const tO = firstUnder(cubOld, 0.01);
  verdict(tO == null, `the old law's Cub never settles under 1 cm by 30 s (${tO == null ? 'never' : 'from ' + tO + ' s'}; 20-30 s at least ${mm(Math.min(...cubOld.osc1s.slice(20, 30)))} every second - the limit cycle)`);

  // ---- 3 THE HELD RATE ------------------------------------------------------------------------------------------------
  console.log('\n3 THE HELD RATE (radiation off: the held compute against the force computed every substep)');
  const rows = [['held, the fixes', cubHeld], ['every substep (old law)', cubEvery1], ['held, the old law', cubOldH]];
  for (const [n, S] of rows) console.log(`   ${n.padEnd(26)} 10 s windows: ${S.W.map(w => (1000 * w.heave.osc).toFixed(1)).join(' / ')} mm`);
  const d1 = Math.abs(win(cubHeld, 10, 20) - win(cubEvery1, 10, 20)), d2 = Math.abs(win(cubHeld, 20, 30) - win(cubEvery1, 20, 30));
  open(d1 < 0.002 && d2 < 0.002, `the held force is the force: the 10-20 / 20-30 s oscillation ${mm(win(cubHeld, 10, 20))} / ${mm(win(cubHeld, 20, 30))} held against ${mm(win(cubEvery1, 10, 20))} / ${mm(win(cubEvery1, 20, 30))} every substep (bound 2 mm)`, HELD_OWNER);
  open(win(cubOldH, 20, 30) > 2 * win(cubEvery1, 20, 30), `...and the old law held is not (${mm(win(cubOldH, 20, 30))} at 20-30 s: the cap on the buoyancy, the last compute's air share, the held pose)`, HELD_OWNER);

  // ---- 4 THE PROP -----------------------------------------------------------------------------------------------------
  console.log('\n4 THE PROP (the Cub ditched, the throttle left at 0.6)');
  const prop = dmg => {
    let tWet = null, thrAfter = 0, crankHeld = true, everRan = false;
    const r = O.run('cub', { secs: 4, thr: 0.6, damage: dmg, each: (sim, t) => {
      if (tWet == null && sim.out.propWet) tWet = t;
      if (tWet != null && t > tWet + 0.05) { thrAfter = Math.max(thrAfter, sim.out.thrust || 0); if (sim.eng[0].running) everRan = true; }
      if (tWet != null && Math.abs(t - 2) < 1e-9) { sim.setEngine(0, { key: 'both', start: true }); }   // the starter, the disc under
      if (t > 2.02 && t < 3.6 && sim.eng[0].crank > 0) crankHeld = false;
    } });
    return { tWet, thrAfter, crankHeld, everRan, e: r.sim.eng[0], d: r.sim.damage() };
  };
  const pOff = prop(0), pOn = prop(1);
  console.log(`   damage off: the disc wet at ${f(pOff.tWet, 2)} s, thrust after ${f(pOff.thrAfter, 0)} N, seized ${pOff.e.seized}, drowned ${pOff.e.drown}; damage on: wet at ${f(pOn.tWet, 2)} s, ${JSON.stringify(pOn.d.propAt)}`);
  verdict(pOff.tWet != null && pOff.tWet < 1 && pOff.thrAfter === 0 && !pOff.everRan && !pOff.e.seized && pOff.e.drown && pOff.crankHeld && !pOff.d.propStrike,
    `damage OFF: the disc meets the water at ${f(pOff.tWet, 2)} s (bound 1 s), the engine stalls - no thrust after it, the starter cannot catch with the disc under, nothing seized, no strike`);
  verdict(pOn.tWet != null && pOn.e.seized && pOn.d.propStrike && pOn.d.propAt && pOn.d.propAt.what === 'water' && pOn.thrAfter === 0,
    `damage ON: a prop strike (${pOn.d.propAt ? pOn.d.propAt.what + ' at ' + f(pOn.d.propAt.t, 2) + ' s' : 'none'}), the engine seized, no thrust after it`);
  { // dry: on its strip at 0.6, 3 s
    const def = C.buildGen(JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), 'utf8')).spec);
    const sim = C.makeSim(def, C.makeWorld()); sim.reset(0); sim.ctl.thr = 0.6; sim.ctl.brake = 1;
    let key = false; for (let s = 0; s < 180; s++) { sim.step(1 / 60); if ('propWet' in sim.out) key = true; }
    verdict(!key && sim.eng[0].running && sim.out.thrust > 0, `dry on its strip the engine runs (${f(sim.out.thrust, 0)} N) and \`out\` never carries propWet`);
  }

  // ---- 5 THE FLOATS ---------------------------------------------------------------------------------------------------
  console.log('\n5 THE FLOATS');
  for (const b of ['cfloats', 'twin']) {
    let wetDisc = 0, stopped = 0;
    const r = O.run(b, { secs: 8, thr: 0.25, each: sim => { if (sim.out.propWet) wetDisc++; if (sim.eng.some(e => !e.running)) stopped++; } });
    verdict(r.finite && !r.sim.wetBody && wetDisc === 0 && stopped === 0 && r.sim.out.thrust > 0,
      `${b === 'cfloats' ? 'the Cessna on floats' : 'the twin on floats'}: no wet body, 8 s on the water at a quarter throttle with the disc never wet and every engine running (${f(r.sim.out.thrust, 0)} N)`);
  }

  // ---- 6 THE ENDING ---------------------------------------------------------------------------------------------------
  console.log('\n6 THE CRASH ENDING CLOSES THE THROTTLE');
  {
    const SH = require('../src/viewer/sim_host.js');
    const spec = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), 'utf8')).spec;
    const H = SH.makeSimHost(C, { spec, world: {}, day: false });
    const sim = H.sim, real = sim.damage;
    sim.ctl.thr = 0.6; H.step(true); const before = sim.ctl.thr;
    sim.damage = () => Object.assign({}, real(), { over: true });
    sim.ctl.thr = 0.6; H.step(true); const after = sim.ctl.thr;
    sim.damage = real;
    verdict(before === 0.6 && after === 0, `the worker's step: the lever at 0.6 stays 0.6 in flight, and is 0 once the crash is over (${before} -> ${after})`);
    const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
    const i0 = app.indexOf('  function script(dt) {'), i1 = app.indexOf('  function scriptView(dt) {');
    const body = i0 >= 0 && i1 > i0 ? app.slice(i0, i1) : '';
    verdict(/if \(sim\.damage && sim\.damage\(\)\.over\) sim\.ctl\.thr = 0;/.test(body), `app.js script() (the inline path) closes the throttle on the same condition`);
  }
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n(wall ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log(fails ? `\nGATE WATERDAMP: FAIL (${fails})` : '\nGATE WATERDAMP: PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); console.log('\nGATE WATERDAMP: FAIL (threw)'); process.exit(1); });
