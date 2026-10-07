#!/usr/bin/env node
// GATE TREECRASH (G1470-G1479, TREE-CRASH) - the airframe yields, breaks and crashes against a trunk, and never in
// what it was built to carry.
//
// The user (2026-10-04): "The crash should be as realistic as possible. No soft body for trunks now, but I hope the nodes
// and beam mesh from the plane can deform." Every beam was elastic: a trunk stopped the aeroplane and the airframe
// sprang it back 5-10 m. Now (30_solver.js, G1470) a member yields at its material's sigY x A (GEN_CRASH, 60_gen_spec)
// and takes a set, breaks past its ultimate, a trunk bends it sideways past its collapse load; a break of anything but
// the nose, 9 g at the contacts or 1.5 kJ of plastic work is a crash (sim.damage()), and the game ends the flight there.
//
// On the user's validated aeroplanes (the Cub, the Jodel, the metal Cessna, the Cessna on floats, the twin on floats):
//   1. THE TABLE: every member of every build has a section and a material GEN_CRASH carries
//   2. NOTHING YIELDS IN WHAT IT WAS BUILT FOR (under the probe: every member's peak force over its yield, per
//      substep - a peak under 1 is a run in which nothing would have yielded):
//        the load test to its ultimate 5.7 g (the garage's own rig), a flown 3.8 g pull, a drop onto the wheels (the
//        floats onto the water) at FAR 23.473's limit sink and at its 10 ft/s cap, a whole circuit with the pilot
//      G1833 (DMG-D2a): on THE CERTIFICATE's limits (66_gen_cert.js; `--physics` for D1a's): the load test clean to its
//      3.8 g limit and HELD at 5.7 g with nothing broken (its first set is just past the limit, by design); the pull read
//      up to the step its applied load factor (the aero force over the weight) first reaches the limit
//   3. A TAXI INTO A TRUNK (3 m/s, the throttle shut, on the centreline): the nose dents round it, the prop strikes and
//      the engine stops - NOT a crash; the aeroplane stays within 2 m of where it stopped (it sprang back 5-10 m)
//      A WINGTIP BRUSH at walking pace: no crash
//   4. A FLIGHT INTO A TRUNK at 30 m/s, 4 m AGL (the centreline, and the wing 2.5 m out): a crash, a wing member broken,
//      every number finite, no energy from nowhere (the kinetic energy never above the impact's)
//   5. reset() makes the aeroplane whole: the same taxi after a crash flies the fresh sim's bits
//   6. THE WATER (A0, with GEAR-WATER 2's wet body - the wheeled cases skip without 32_hydro's wetBuild): a 5 m/s level
//      pancake and a 100 km/h nose-in ditch (4 m/s, 10 deg) on the Cub, a float nose-in (90 km/h, 5 m/s, 20 deg) on the
//      twin; and a severe nose-in on each (the Cub 180 km/h / 10 m/s / 60 deg, the twin 150 / 10 / 60) that must yield and
//      break. The water reaches the beams through the nodes as the ground does: in every case the damage model yields
//      exactly when the probe's peak passes 1 (the same beam-load path), finite; a holed hull slice is skin damage
//
// Run: node tools/_treecrash_check.js   (one final `GATE TREECRASH: PASS|FAIL`; the builds in parallel child processes)
'use strict';
const path = require('path');
const argv = process.argv.slice(2);
// G1833 (DMG-D2a): the damage layer is flown with THE CERTIFICATE (66_gen_cert.js: what the game stamps when the layer
// is on); `--physics` flies D1a's physics limits as before (the base's gate)
const PHYS = argv.includes('--physics');
if (!PHYS) process.env.FLYDIY_CERT = '1';
const L = require('./_treecrash_lib.js');

// ---- a child: one build's numbers, JSON on its last line ----
if (argv[0] === '--build') {
  const k = argv[1], C = L.core(), out = { key: k };
  const def = L.defOf(k), g = def.params.gen, Vs = g.Vs;
  out.table = { n: def.beams.length, noA: def.beams.filter(b => !(b.A > 0)).length, noMat: def.beams.filter(b => !b.mat || !C.GEN_CRASH[b.mat]).length,
    mats: [...new Set(def.beams.map(b => b.mat))] };
  // (each under the PROBE: nothing yields and every member's peak force over its yield is read per substep - the very
  // comparison the damage model makes, so a peak under 1 is a run in which nothing would have yielded or broken)
  const yld = p => (p && p.max >= 1 ? 1 : 0);
  const ltP = L.loadTest(k, { probe: true });
  out.load = { yields: yld(ltP.ult.peak), verdict: ltP.ult.verdict, limit: ltP.limit && ltP.limit.peak, ult: ltP.ult.peak, finite: ltP.finite };
  // under the certificate the airframe takes its first set just past its limit (by design): the load test's limit is
  // where nothing may yield, and at its ultimate (the bench, damage on, no probe) it holds - set, nothing broken
  if (!PHYS) { const lt = L.loadTest(k, {}); out.load.cert = true; out.load.yieldsLim = yld(ltP.limit && ltP.limit.peak); out.load.ultBreaks = lt.ult.dmg.breaks; out.load.ultSet = lt.ult.dmg.members; out.load.verdict = lt.ult.verdict; }
  const V0 = 2.6 * Vs;   // 1.33 x the speed 3.8 g stalls at (Vs root 3.8)
  // (under the certificate the pull is read up to the step it first reaches the limit: its PI overshoots to 4-5.3 g,
  // an over-g, where the certificate's set is the point)
  const pu = L.pull(k, PHYS ? { V: V0, sgn: 1, probe: true } : { V: V0, sgn: 1, probe: true, toLimit: 3.8 });
  out.pull = { V0, nzMax: pu.nzMax, naMax: PHYS ? null : pu.naMax, held: pu.held, yields: yld(pu.peak), peak: pu.peak, finite: pu.finite };
  const s473 = L.far473(k);
  out.drop = [s473, 0.3048 * 10].map(sink => { const rp = L.hardLanding(k, { sink, probe: true });
    return { sink, yields: yld(rp.peak), crashed: rp.dmg.crashed, nz: rp.gMax, peak: rp.peak, finite: rp.finite }; });
  const ciP = L.circuit(k, { probe: true });
  out.circuit = { outcome: ciP.outcome, t: ciP.t, yields: yld(ciP.peak), crashed: ciP.dmg.crashed, nzMax: ciP.nzMax, peak: ciP.peak, finite: ciP.finite };
  if (!/floats/i.test(k)) {
    const KE = r => r.trace.reduce((m, x) => Math.max(m, x.ke || 0), 0);
    const tx = L.atTrunk(k, { D: 4, V: 3, thr: 0, secs: 8 });
    out.taxi = { dmg: tx.dmg, reach: tx.reach, end: tx.end, finite: tx.finite, eng: tx.eng,
      crush: ((tx.sim.damage().drive || [])[0] || {}).crush || 0,   // G2015 (DMG-NOSE): the nose's crush (m) - the dent's home now
      crushLayer: ((tx.sim.damage().drive || [])[0] || {}).crushLayer || null };   // G2035 (DMG-DRIVE2): how far it went
    const br = L.atTrunk(k, { D: 6, V: 1.4, walk: 1.4, secs: 12, off: 0.85 * g.span / 2 });
    out.brush = { dmg: br.dmg, hits: br.hits, finite: br.finite };
    out.fly = [0, 2.5].map(off => { const r = L.atTrunk(k, { D: 40, agl: 4, V: 30, thr: 0, secs: 5, off });
      return { off, dmg: r.dmg, reach: r.reach, finite: r.finite, ke0: r.ke0, keMax: r.keMax, spread: r.spread }; });
    // reset heals: after the centreline flight's crash, reset and taxi; the fresh sim the same taxi - the same bits
    const a = L.atTrunk(k, { D: 4, V: 3, thr: 0, secs: 3 }), b = L.atTrunk(k, { D: 40, agl: 4, V: 30, thr: 0, secs: 3, then: { D: 4, V: 3, thr: 0, secs: 3 } });
    out.reset = { same: a.hash === b.hash, a: a.hash, b: b.hash, crashedBefore: b.crashedBefore };
  }
  // 6. the water
  const WATER = { cub: [['a 5 m/s level pancake', { V: 0.3, sink: 5, pitch: 0 }, 'wet'], ['a 100 km/h nose-in ditch (4 m/s, 10 deg)', { V: 100 / 3.6, sink: 4, pitch: 10 }, 'wet'],
                        ['SEVERE: 180 km/h, 10 m/s, 60 deg nose-in', { V: 180 / 3.6, sink: 10, pitch: 60, severe: true }, 'wet']],
                  twinFloats: [['a float nose-in (90 km/h, 5 m/s, 20 deg)', { V: 90 / 3.6, sink: 5, pitch: 20 }, 'floats'],
                               ['SEVERE: 150 km/h, 10 m/s, 60 deg nose-in', { V: 150 / 3.6, sink: 10, pitch: 60, severe: true }, 'floats']] };
  if (WATER[k]) out.water = WATER[k].map(([lab, o, kind]) => {
    if (kind === 'wet' && !(C.HYDRO && typeof C.HYDRO.wetBuild === 'function')) return { lab, skip: true };
    const r = L.waterCase(k, Object.assign({ secs: 4 }, o)), p = L.waterCase(k, Object.assign({ secs: 4, probe: true }, o)).peak;
    return { lab, severe: !!o.severe, peak: p, dmg: r.dmg, holed: r.holed, slam: r.slamKPa, finite: r.finite, yieldedCls: r.yieldedCls };
  });
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const f2 = x => (x == null ? '-' : x.toFixed(2));
const pk = p => (p ? f2(p.max) + ' (' + (p.t >= p.c ? p.clsT + ', tension' : p.clsC + ', compression') + ')' : '-');
(async () => {
  const { spawn } = require('child_process');
  const keys = Object.keys(L.BUILDS), t0 = Date.now();
  const run = k => new Promise(res => {
    const c = spawn(process.execPath, [__filename, '--build', k].concat(PHYS ? ['--physics'] : []), { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, err: se.slice(-800) }); });
  });
  // at most 3 at once (each is one core)
  const R = {}; const q = keys.slice();
  await Promise.all([0, 1, 2].map(async () => { while (q.length) { const k = q.shift(); R[k] = await run(k); } }));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + keys.length + ' builds; ' + (PHYS ? 'the members\' physics limits (--physics)' : 'the certificate\'s limits (DMG-D2a, 66_gen_cert.js)') + ')');
  for (const k of keys) {
    const r = R[k], lab = L.BUILDS[k].label;
    console.log(lab + ':');
    if (r.err) { yes(false, 'the child ran: ' + r.err); continue; }
    console.log('1. the table');
    yes(r.table.noA === 0 && r.table.noMat === 0, r.table.n + ' members, every one with a section and a GEN_CRASH material (' + r.table.mats.join(', ') + ')');
    console.log('2. nothing yields in what it was built for (the margin: the worst member\'s peak force over its yield)');
    if (r.load.cert) yes(r.load.yieldsLim === 0 && r.load.ultBreaks === 0 && r.load.finite && /HELD/.test(r.load.verdict), 'the load test (the certificate): nothing yields to its 3.8 g limit (the worst member ' + pk(r.load.limit) + '); at 5.7 g ' + r.load.verdict + ', ' + r.load.ultSet + ' members set (its first set is past the limit, by design), nothing broken; the worst member at 5.7 g ' + pk(r.load.ult));
    else yes(r.load.yields === 0 && r.load.finite && /HELD/.test(r.load.verdict), 'the load test to 5.7 g: ' + r.load.verdict + ', nothing yields; the worst member at 3.8 g ' + pk(r.load.limit) + ', at 5.7 g ' + pk(r.load.ult));
    if (r.pull.naMax != null) yes(r.pull.naMax >= 3.8 && r.pull.yields === 0 && r.pull.finite, 'a flown pull from ' + r.pull.V0.toFixed(0) + ' m/s to the limit (the wing\'s load ' + f2(r.pull.naMax) + ' W; the CG then reading ' + f2(r.pull.nzMax) + ' g): nothing yields; the worst member ' + pk(r.pull.peak));
    else yes(r.pull.nzMax >= 3.8 && r.pull.yields === 0 && r.pull.finite, 'a flown pull from ' + r.pull.V0.toFixed(0) + ' m/s to ' + f2(r.pull.nzMax) + ' g (held ' + f2(r.pull.held) + ' s over 3.7): nothing yields; the worst member ' + pk(r.pull.peak));
    for (const d of r.drop) yes(d.yields === 0 && !d.crashed && d.finite, 'a drop at ' + f2(d.sink) + ' m/s (' + f2(d.sink / 0.3048) + ' ft/s' + (d === r.drop[0] ? ', FAR 23.473' : ', its cap') + '): ' + f2(d.nz) + ' g, nothing yields; the worst member ' + pk(d.peak));
    yes(r.circuit.yields === 0 && !r.circuit.crashed && r.circuit.finite, 'a circuit with the pilot (' + r.circuit.outcome + ', ' + r.circuit.t.toFixed(0) + ' s, ' + f2(r.circuit.nzMax) + ' g at the most): nothing yields; the worst member ' + pk(r.circuit.peak));
    if (!r.taxi) { console.log('   (a floatplane: the trunk runs are the land builds\')'); continue; }
    console.log('3. a taxi into a trunk, a wingtip brush');
    const tx = r.taxi;
    // (G2015, DMG-NOSE: the dent is the crushable nose's - the spinner crushed - or a member's set; with the nose the 3 m/s
    // taxi sets no member at all: the crush takes it before the engine's lattice is reached)
    // (G2035, DMG-DRIVE2: the prop strikes where its blades are - the base graded it with the trunk 0.9 m out. One physics with
    // DMG-NOSE: the prop struck, and the engine stopped, exactly when the crush passed the spinner; a taxi the spinner takes whole
    // leaves the blades clear of the trunk and the engine idling)
    const struck = !!tx.dmg.propStrike, pastSpinner = !!tx.crushLayer && tx.crushLayer !== 'spinner';
    yes(tx.finite && (tx.dmg.members > 0 || tx.crush > 0) && !tx.dmg.crashed && struck === pastSpinner && (!struck || tx.eng.every(e => !e.running)) && tx.reach - tx.end < 2,
      'taxied at 3 m/s into a trunk: a dent (the nose crushed ' + (100 * (tx.crush || 0)).toFixed(0) + ' cm, its ' + tx.crushLayer + '; ' + tx.dmg.members + ' members set, ' + tx.dmg.breaks + ' of the nose broken, ' + tx.dmg.work.toFixed(0) + ' J), no crash; ' +
      (struck ? 'the prop struck, the engine stopped' : 'the spinner took it - the blades never met the trunk, the engine ' + (tx.eng.every(e => e.running) ? 'idling' : 'stopped')) + '; back ' + (tx.reach - tx.end).toFixed(2) + ' m from where it stopped');
    yes(r.brush.finite && r.brush.hits > 0 && !r.brush.dmg.crashed, 'a wingtip into a trunk at walking pace (1.4 m/s): touched (' + r.brush.hits + ' contacts), ' + r.brush.dmg.members + ' members set, no crash');
    console.log('4. a flight into a trunk at 30 m/s');
    for (const fl of r.fly) {
      const wing = fl.dmg.brokenCls.filter(c => c === 'wing').length;
      yes(fl.finite && fl.dmg.crashed && wing > 0 && fl.keMax <= fl.ke0 * 1.001,
        (fl.off ? 'the wing ' + fl.off + ' m out' : 'the centreline') + ': CRASHED (' + fl.dmg.reason + ' at ' + f2(fl.dmg.at) + ' s), ' + fl.dmg.breaks + ' members broken (' + wing + ' of the wing), ' + (fl.dmg.work / 1000).toFixed(1) + ' kJ of plastic work, ' + f2(fl.dmg.gPeak) + ' g; finite; the kinetic energy at most ' + (100 * fl.keMax / fl.ke0).toFixed(1) + ' % of the impact\'s');
    }
    console.log('5. reset heals');
    yes(r.reset.same && r.reset.crashedBefore, 'after a crash, reset() and the same taxi: the fresh sim\'s bits (' + r.reset.a + ' / ' + r.reset.b + ')');
  }
  for (const k of keys) {
    const r = R[k]; if (!r || !r.water) continue;
    console.log('6. the water - ' + L.BUILDS[k].label);
    for (const w of r.water) {
      if (w.skip) { console.log('  --    ' + w.lab + ': needs GEAR-WATER 2\'s wet body (32_hydro.js wetBuild), not in this core - skipped'); continue; }
      // G2369 (DMG-BUNDLE-GREEN): a member past its limit SETS where it is ductile and BREAKS where it is brittle (a lug, a
      // fitting: no set) - the twin's float nose-in on the certificate breaks its float struts' lugs (1.12) and its boom's
      // root bay (a cluster cut) and sets nothing. Under 1, nothing sets (a cluster's cut may still part: D3's own limit)
      const d = w.dmg, same = w.peak.max >= 1 ? (d.members > 0 || d.breaks > 0) : d.members === 0;
      const what = w.lab + ': the worst member ' + pk(w.peak) + '; ' + d.members + ' set' + (d.members ? ' ' + JSON.stringify(w.yieldedCls) : '') + ', ' + d.breaks + ' broken'
        + (w.slam != null ? ', the slam ' + w.slam.toFixed(0) + ' kPa, ' + w.holed + ' hull slice(s) holed' : '') + ', ' + f2(d.gPeak) + ' g, '
        + (d.crashed ? 'CRASHED (' + d.reason + ')' : d.dented ? 'dented, no crash' : 'no damage');
      yes(w.finite && same && (!w.severe || (d.members > 0 && d.breaks > 0 && d.crashed)), what + (w.severe ? ' - must yield, break and crash' : '') + '; the damage follows the beams\' own loads');
    }
  }
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE TREECRASH: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
