#!/usr/bin/env node
// GATE DMGDRIVE (G1827, DMG-DRIVE) - THE DRIVETRAIN AGAINST THE REAL NUMBERS. Every row names its reference (the real-numbers
// table: reports/evidence/DMG-DRIVE/real_numbers.json) and prints its flag: AS RECALLED - A0 TO OPEN (no number here came
// from a search summary; where no document gives one the row says GAME). The model: 33_drive.js, 30_solver.js (driveFrame,
// driveStrike, driveRpm, driveImb), 66_gen_cert.js (genCertDrive). Damage on, the certificate stamped, the user's
// validated builds (tools/_treecrash_lib.js BUILDS).
//   1. THE BANDS AND THE TIERS (the pure laws): Lycoming SB 369's overspeed bands, the failure dose, 23.361(c)'s factor by
//      cylinders, the strike's tier by bite and tip speed
//   2. THE DIVES (the sim): at V_NE and at 1.1 V_D at full throttle the engine over-revs into the band the bulletin names
//      for its peak, and runs rough past 20 %; at V_NE at the cruise throttle, at idle and windmilling: no exceedance
//   3. THE STRIKES (the sim): a nose-over at 2 / 4 / 8 m/s (the land builds) - the disc meets the ground before the
//      nose, graded on its bite (SB 533's sudden stoppage stops the engine; a teardown owed either way); a brush (2 cm of
//      soil past the turf) leaves it running; a trunk in the disc at 3 m/s stops it; a floatplane's bow digging in at
//      90 km/h strikes the water; a brittle tip lost at full power (a trunk grazing it) turns on with a blade short and
//      its imbalance tears the mount; at idle the same graze is a brush
//   4. THE GEARBOX (the twin's 582): a stoppage at full power shears the drive - the engine runs away unloaded and fails
//      on its overspeed; at idle it stops and the gearbox is marked for inspection
//   5. THE MOUNT ON THE CERTIFICATE: 23.361's limit torque, 23.363's side load and 23.371's gyroscopic couple are
//      certificate cases; with the build's stamped members the mount holds each with no set and lets go past its
//      ultimate (the multiple printed); the snap-roll entry's measured rates' gyroscopic couple is held
//   6. NORMAL OPERATIONS NEVER TOUCH IT (the negatives): the circuit (take-off at full power, the pattern, the landing,
//      the roll-out) on every build, a 3.8 g pull at full power, a hard stop on the brakes: no strike, no exceedance,
//      no failure; the disc's least clearance printed
// Run: node tools/_dmg_drive_check.js   (one final `GATE DMGDRIVE: PASS|FAIL`; each build's parts in parallel children,
// DMGDRIVE_JOBS at once, default 3; FLYDIY_CERT_DIR honoured as the other DMG gates do)
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
process.env.FLYDIY_CERT = '1';
const L = require('./_treecrash_lib.js');
const D = require('./_dmg_drive_lib.js');
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'reports', 'evidence', 'DMG-DRIVE', 'real_numbers.json'), 'utf8'));
const FLAG = '[as recalled - A0 to open]', GAME = '[GAME - no source]';
const f2 = x => (x == null || !isFinite(x) ? '-' : (+x).toFixed(2)), pc = r => ((r - 1) * 100).toFixed(1) + ' %';
const band = r => (!(r > 1) ? null : r <= 1.10 ? 'logged' : r <= 1.20 ? 'inspect' : 'overhaul');
// a taildragger: the tailwheel aft of the mains
const dcTw = def => { const R = def.refs || {}, tw = R.tw != null && R.tw >= 0 ? R.tw : -1, M = R.mains || []; if (tw < 0 || !M.length) return false;
  return def.nodes[tw].p[0] > M.reduce((a, i) => a + def.nodes[i].p[0], 0) / M.length; };
const slim = d => d && { os: d.os, osPeak: d.osPeak, osSec: d.osSec, osExc: d.osExc, osDose: d.osDose, strike: d.strike, strikeAt: d.strikeAt, bladeLost: d.bladeLost,
  gearbox: d.gearbox, failed: d.failed, why: d.why, teardown: d.teardown, internal: d.internal, thrustK: d.thrustK, vib: d.vib, tipMach: d.tipMach, imbN: d.imbN, gapMin: d.gapMin };

// ---- a child: one build's part, JSON on its last line ----
if (argv[0] === '--part') {
  const k = argv[1], part = argv[2], C = L.core(), def = L.defOf(k), out = { key: k, part }, hydro = !!(def.parts && def.parts.floats);
  const VS = C.genCertSpeeds(def), o = { cert: true };
  if (part === 'dive') {
    const VNE = 0.9 * VS.VD;
    out.dive = [['VNE full', VNE, 1, false], ['1.1 VD full', 1.1 * VS.VD, 1, false], ['VNE cruise', VNE, def.params.ap.thrCruise, false], ['VNE idle', VNE, 0, false], ['VNE off', VNE, 0, true]]
      .map(([nm, V, thr, off]) => { const r = D.dive(k, Object.assign({ V, thr, off, hold: 8, secs: 90 }, o));
        return { nm, V, thr, reached: r.reached != null, rpmEng: r.rpmEngMax, rated: def.params.engine.rpm, rpmMax: C.genDriveSpec(def).rpmMax, tipMach: r.tipMach,
          running: r.running, d: (r.drive || []).map(slim), finite: r.finite,
          // G2015 (DMG-NOSE): did the airframe break up on the way (the time, the members broken)? A wreck's windmill is no engine's band
          wreck: r.crashed ? { at: (r.sim.damage().at || 0), breaks: r.breaks, why: r.sim.damage().reason, reached: r.reached } : null }; });
  } else if (part === 'strike') {
    if (!hydro) {
      out.nose = [2, 4, 8].map(V => { const r = D.noseOver(k, Object.assign({ V, thr: 0.2, secs: 2 }, o));
        return { V, discT: r.discT, strikeT: r.strikeT, at: r.at, running: r.running, d: (r.drive || []).map(slim), finite: r.finite }; });
      const T = C.GEN_DRIVE.strike.turf;
      // (the disc set 2 cm past the turf with the nose RISING at 0.3 m/s: one touch, then the tail settles - at rest the Jodel's would tip on over)
      { const r = D.noseOver(k, Object.assign({ V: -0.3, gap: -(T + 0.02), thr: 0.2, secs: 2 }, o)); out.brush = { running: r.running, d: (r.drive || []).map(slim), finite: r.finite }; }
      // (G2035: the trunk in the disc, 0.75 m across - clear of the spinner, which takes a centred 3 m/s taxi before the blades reach it)
      { const r = D.trunkStrike(k, Object.assign({ V: 3, thr: 0.3, across: 0.75 }, o)); out.trunk3 = { running: r.running, d: (r.drive || []).map(slim), groups: r.groups, finite: r.finite }; }
    } else {
      out.noseIn = [{ V: 25, sink: 5, pitch: 20 }, { V: 41.7, sink: 10, pitch: 60 }].map(c => { const r = D.noseIn(k, Object.assign({ thr: 0.2 }, c, o));
        return Object.assign({}, c, { running: r.running, d: (r.drive || []).map(slim), groups: r.groups, finite: r.finite }); });
    }
    for (const thr of [1, 0]) { const r = D.tipStrike(k, Object.assign({ thr, bite: 0.03, secs: 3 }, o));
      (out.graze = out.graze || []).push({ thr, rpm0: r.rpm0, d: (r.drive || []).map(slim), mountAt: r.mountAt, imbMax: r.imbMax, running: r.running, groups: r.groups, finite: r.finite }); }
    if (C.genDriveSpec(def).gear > 1) for (const thr of [1, 0.1]) { const r = D.tipStrike(k, Object.assign({ thr, bite: 0.6, secs: 4 }, o));
      (out.gear = out.gear || []).push({ thr, rpm0: r.rpm0, d: (r.drive || []).map(slim), failAt: r.failAt, peakEng: r.peakEng, running: r.running, finite: r.finite }); }
  } else if (part === 'mount') {
    // the stamped members (a sim on the certificate) against the certificate's own drive cases, scaled
    const dc = L.defOf(k, o), sim = C.makeSim(dc, null); sim.reset(0);
    const cert = dc.cert, MB = D.mountBeams(def), B = sim.beams;
    out.cases = {};
    for (const nm of cert.names.filter(n => /^(torque361|side363|gyro371)/.test(n))) {
      const cs = cert.cases[nm]; let y = 0, at = null, kb = Infinity, atb = null;
      for (const m of MB) { const t = cs.t[m.bi], c = cs.c[m.bi], b = B[m.bi];
        const ry = Math.max(t / b.fy0, c / b.fc0); if (ry > y) { y = ry; at = D.tagOf(def, m.bi); }
        // the multiple of the case at which this member breaks (tension at its fu; compression at its crush, the kink after)
        const kk = Math.min(t > 0 ? b.fu / t : Infinity, c > 0 ? b.fc0 / c : Infinity); if (kk < kb) { kb = kk; atb = D.tagOf(def, m.bi); } }
      out.cases[nm] = { y, at, kb, atb };
    }
    out.govern = {}; for (const m of MB) for (const ix of [cert.byT[m.bi], cert.byC[m.bi]]) { const n = cert.names[ix]; if (n) out.govern[n] = (out.govern[n] || 0) + 1; }
    const DS = C.genDriveSpec(def); out.DS = { Q: DS.Q, Qprop: DS.Qprop, tqK: DS.tqK, cyl: DS.cyl, I: DS.I, omegaR: DS.omegaR, gear: DS.gear };
    // the snap-roll entry (the controls full at V_A: the rates it reaches) under the probe - its gyroscopic couple,
    // I w x the measured yaw and pitch rates, against the 23.371 case's (the mount carries it: the case scaled)
    const sr = D.snapRoll(k, o);
    out.snap = { w: sr.wMax, mount: sr.mount, ratio: Math.max(sr.wMax[1] / C.GEN_DRIVE.far.yaw, sr.wMax[2] / C.GEN_DRIVE.far.pitch) };
  } else if (part === 'neg') {
    // the circuit with the pilot, the layer on (the take-off at full power, the pattern, the landing, the roll-out)
    { const world = C.makeWorld(), dc = L.defOf(k, o), sim = C.makeSim(dc, world); sim.reset(0);
      const a = world.aerodromes.find(x => x.id === (sim.hydro ? 'SEA' : 'HOME')) || world.aerodromes[0];
      if (sim.hydro) C.placeAtAerodrome(sim, a);
      for (let i = 0; i < 600; i++) sim.step(1 / 60);
      const ap = C.makePilot(sim, dc, world); if (sim.hydro) ap.setRoute(a, a);
      let s = 0, rpmMax = 0; for (; s < 340 * 60; s++) { ap.update(1 / 60); sim.step(1 / 60); rpmMax = Math.max(rpmMax, sim.out.rpmEng[0] || 0); if (ap.phase === 'STOPPED' && ap.t > 3) break; }
      out.circ = { outcome: ap.report && ap.report.outcome, t: s / 60, rpmMax, d: sim.damage().drive.map(slim), finite: L.finite(sim) }; }
    // a 3.8 g pull at full power (1.3 V_A)
    { const r = L.pull(k, Object.assign({ nz: 3.8, V: 1.3 * VS.VA, sgn: 1 }, o)); const sim = L.lastRun.sim; out.pull = { nz: r.nzMax, d: sim.damage().drive.map(slim), finite: r.finite }; }
    // the brakes from 12 m/s (the land builds: the nose dips)
    if (!hydro) { const { W, strip } = L.flatWorld(0), dc = L.defOf(k, o), sim = C.makeSim(dc, W); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 }));
      for (let f = 0; f < 240; f++) sim.step(1 / 60);
      const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg); for (let i = 0; i < sim.n; i++) { sim.v[i*3] += 12 * fx; sim.v[i*3+2] += 12 * fz; }
      sim.ctl.thr = 0; sim.ctl.brake = 0.5; for (let f = 0; f < 360; f++) sim.step(1 / 60);
      out.brake = { d: sim.damage().drive.map(slim), finite: L.finite(sim) }; }
    // ...and on full brakes from 12 m/s a taildragger stands on its nose (the classic nose-over): a strike
    if (!hydro && dcTw(def)) { const { W, strip } = L.flatWorld(0), dc = L.defOf(k, o), sim = C.makeSim(dc, W); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 }));
      for (let f = 0; f < 240; f++) sim.step(1 / 60);
      const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg); for (let i = 0; i < sim.n; i++) { sim.v[i*3] += 12 * fx; sim.v[i*3+2] += 12 * fz; }
      sim.ctl.thr = 0; sim.ctl.brake = 1; for (let f = 0; f < 360; f++) sim.step(1 / 60);
      out.brakeFull = { d: sim.damage().drive.map(slim), running: sim.eng.map(e => e.running), finite: L.finite(sim) }; }
  }
  console.log('RESULT ' + JSON.stringify(out));
  process.exit(0);
}

// ---- the gate ----
let checks = 0, fails = 0;
const yes = (ok, msg) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + msg); };
const rep = msg => console.log('  --    ' + msg);
(async () => {
  const C = L.core(), t0 = Date.now(), G = C.GEN_DRIVE;
  // ---- 1. the pure laws ----
  console.log('1. THE BANDS AND THE TIERS (the laws, 33_drive.js)');
  const os = (ratio, secs) => { const st = C.genDriveState(); let failed = false; for (let t = 0; t < secs - 1e-9; t += 1 / 60) failed = C.genDriveOverspeed(st, ratio, 1 / 60) || failed; return st; };
  const R369 = REF.overspeed.find(x => x.id === 'lyc369');
  for (const [r, s, want, why] of [[1.08, 30, 'logged', 'SB 369: up to 10 % - no action, a logbook entry'], [1.15, 2, 'inspect', 'SB 369: 10-20 % - the prop off, the flange\'s run-out, the valve train'],
    [1.15, 0.5, null, 'the 1 s filter (a frame\'s tick is not an overspeed: nothing logged, the peak kept) ' + GAME], [1.25, 1.5, 'overhaul', 'SB 369: past 20 % - the engine overhauled'],
    [1.35, 2, 'overhaul', 'the failure dose 0.20 < 0.25 ' + GAME], [1.35, 3, 'failed', 'the failure dose 0.30 >= 0.25: a thrown rod / valve ' + GAME], [1.5, 1.05, 'failed', '50 % over for 1 s ' + GAME]]) {
    const st = os(r, s);
    yes(st.os === want && (want !== 'failed' || st.teardown) && st.osPeak === r, 'the engine ' + pc(r) + ' over its maximum for ' + s + ' s reaches \'' + (st.os || 'none') + '\' (want \'' + (want || 'none') + '\'; dose ' + f2(st.osDose) + ') - ' + why + (/GAME/.test(why) ? '' : ' ' + FLAG));
  }
  console.log('  (' + R369.source + ')');
  for (const [cyl, fam, want] of [[4, 'four', 2], [3, 'four', 3], [2, 'two', 4], [6, 'four', 1.33], [9, 'four', 1.33], [0, 'turbine', 1.25]])
    yes(C.genDriveTorqueFactor(cyl, fam) === want, '23.361(c): ' + (fam === 'turbine' ? 'a turboprop' : cyl + ' cylinders') + ' -> limit torque = mean x ' + want + ' ' + FLAG);
  for (const [bite, surf, tip, sep, want, why, eR] of [[0.02, 'soft', 200, 120, 1, 'tips dressed on the ground (no separation on a soft brush)'], [0.10, 'soft', 80, 120, 2, 'a bite of 10 % into the ground at idle: bent'],
    [0.30, 'soft', 80, 120, 3, '30 %: the prop stopped (SB 533\'s sudden stoppage)'], [0.10, 'rigid', 80, 120, 3, 'a trunk 10 % into the disc stops it'], [0.20, 'water', 80, 120, 2, 'the water gives: bent at 20 %'],
    [0.03, 'rigid', 211, 120, 4, 'a wood tip grazing a trunk at full power breaks off'], [0.03, 'rigid', 150, 200, 1, 'an alloy tip at 150 m/s only dents'], [0.10, 'soft', 211, 120, 4, 'wood into the ground at full power: a blade breaks'], [0.05, 'water', 150, 120, 2, 'carbon into the water at 150 m/s bends (the water gives: 1.6 x the tip speed)'],
    // G2036 (DMG-DRIVE2): a brittle blade on a rigid obstacle past the brush grades on its energy (eR = 0.5 I w^2 / its root's
    // rupture work), not the tip speed: the Cub's idle 650 rpm holds 25 x it, a prop turned by hand 0.5 x
    [1.0, 'rigid', 65, 120, 4, 'a wood prop at idle into a trunk: its blades break (the engine stops; the hub stays on its flange)', 24.7],
    [1.0, 'rigid', 13, 120, 3, 'a wood prop barely turning (eR 0.5) into a trunk stops whole', 0.5],
    [0.03, 'rigid', 65, 120, 1, 'a wood tip grazing a trunk at idle: a brush still (the energy grades past the brush only)', 24.7]])
    yes(C.genDriveStrikeTier(bite, 1, surf, tip, sep, eR) === want, 'a strike ' + (bite * 100).toFixed(0) + ' % into the disc (' + surf + ', tip ' + tip + ' m/s, the blade\'s ' + sep + (eR != null ? ', eR ' + eR : '') + '): ' + C.GEN_DRIVE_STRIKE[want] + ' - ' + why + ' ' + (eR != null ? FLAG : GAME));

  // ---- the children ----
  const { spawn } = require('child_process');
  const keys = Object.keys(L.BUILDS), jobs = [];
  const PARTS = (process.env.DMGDRIVE_PARTS || 'neg,dive,strike,mount').split(',');
  for (const p of PARTS) for (const k of keys) jobs.push([k, p]);
  const run = ([k, p]) => new Promise(res => {
    const c = spawn(process.execPath, [__filename, '--part', k, p], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = ''; c.stdout.on('data', d => { so += d; }); c.stderr.on('data', d => { se += d; });
    c.on('close', () => { const l = so.split('\n').reverse().find(x => x.indexOf('RESULT ') === 0); res(l ? JSON.parse(l.slice(7)) : { key: k, part: p, err: se.slice(-800) }); });
  });
  const R = {}, q = jobs.slice(), nJ = Math.max(1, +(process.env.DMGDRIVE_JOBS || 3));
  await Promise.all(Array.from({ length: nJ }, async () => { while (q.length) { const j = q.shift(); const r = await run(j); (R[j[0]] = R[j[0]] || {})[j[1]] = r; } }));
  if (argv.includes('--json')) fs.writeFileSync(argv[argv.indexOf('--json') + 1], JSON.stringify(R, null, 1));
  console.log('(' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + keys.length + ' builds; damage on, on the certificate)');
  const tierOf = d => d ? d.strike : null;
  for (const k of keys) {
    const lab = L.BUILDS[k].label, P = R[k];
    console.log(lab + ':');
    for (const p of Object.keys(P)) if (P[p].err) yes(false, 'the child ' + p + ' ran: ' + P[p].err);
    // 2. the dives
    if (P.dive && P.dive.dive) {
      console.log('2. THE DIVES (' + REF.overspeed[0].source.split(' (')[0] + ')');
      for (const v of P.dive.dive) {
        const d = v.d[0], r = v.rpmEng / v.rpmMax, b = band(r), b2 = band(d.osPeak);   // (the band of the held peak, or of the approach's overshoot)
        const what = v.nm + ' (' + f2(v.V) + ' m/s, throttle ' + f2(v.thr) + '): ' + Math.round(v.rpmEng) + ' rpm against ' + v.rpmMax + ' (' + pc(r) + '), tip Mach ' + f2(v.tipMach) + ' -> \'' + (d.os || 'none') + '\'';
        if (!v.reached) { yes(false, what + ' - the speed was not reached'); continue; }
        // G2015 (DMG-NOSE): a dive the airframe broke up in before it reached its speed (the Jodel at 1.1 V_D: its fin's attach
        // lets go at 10.8 s, on the base as on DMG-NOSE) reads a falling wreck's windmill, whose speed is the wreck's: REPORTED
        if (/full/.test(v.nm) && v.wreck && v.wreck.at < v.wreck.reached) rep('REPORT ' + what + ' - the airframe broke up first (' + v.wreck.why + ' at ' + f2(v.wreck.at) + ' s, ' + v.wreck.breaks + ' members; the speed reached at ' + f2(v.wreck.reached) + ' s): a wreck\'s windmill, not the drivetrain\'s band');
        else if (/full/.test(v.nm)) yes(v.finite && (d.os === b || d.os === b2) && !d.failed && (d.os !== 'overhaul' || d.thrustK < 1), what + (b === 'overhaul' ? ', rough (thrust x ' + f2(d.thrustK) + ', the teardown owed)' : b === 'inspect' ? ' (SB 369: an inspection)' : '') + ' ' + FLAG);
        else yes(v.finite && !(d.osExc > 0) && !d.failed && !d.strike && (d.os == null || d.os === 'logged'), what + (d.os === 'logged' ? ' (inside SB 369\'s no-action band: ' + f2(d.osSec) + ' s logged)' : '') + ' - no exceedance');
      }
    }
    // 3. the strikes
    const S = P.strike || {};
    if (S.nose || S.noseIn || S.graze) console.log('3. THE STRIKES (' + REF.prop_strike[0].source.split(' (')[0] + ': any strike -> a teardown) ' + FLAG);
    for (const n of (S.nose || [])) { const d = n.d[0], a = d.strikeAt || {};
      const stopped = !n.running[0];
      yes(n.finite && d.teardown && (d.strike === 'stoppage' || d.strike === 'separation' ? stopped : (d.strike === 'bent' || d.strike === 'brush')) && n.strikeT != null && n.strikeT <= (n.discT || 0) + 0.05,
        'a nose-over at ' + n.V + ' m/s: the disc meets the ground ' + f2(n.discT) + ' s in, the strike ' + f2(n.strikeT) + ' s (the base: only once the nose\'s nodes did) - \'' + d.strike + '\' (bite ' + f2(a.biteR) + ' R, tip ' + Math.round(a.tip || 0) + ' m/s), the engine ' + (stopped ? 'stopped' : 'running') + ', a teardown owed' + (d.internal ? ', the teardown finds internal damage' : '')); }
    if (S.brush) { const d = S.brush.d[0];
      yes(S.brush.finite && d.strike === 'brush' && S.brush.running[0] && d.teardown, 'a brush (2 cm of soil past the turf\'s ' + C.GEN_DRIVE.strike.turf * 100 + ' cm): \'' + d.strike + '\', the engine runs on, a teardown still owed (SB 533: any strike that needs the prop repaired)'); }
    if (S.trunk3) { const d = S.trunk3.d[0];
      yes(S.trunk3.finite && (d.strike === 'stoppage' || d.strike === 'separation') && !S.trunk3.running[0], 'a trunk in the disc at 3 m/s (0.75 m across the nose, clear of the spinner - G2035): \'' + d.strike + '\' (tip ' + Math.round((d.strikeAt || {}).tip || 0) + ' m/s' + (d.strike === 'separation' ? ': the blades broke off' : '') + '), the engine stopped (a sudden stoppage)'); }
    for (const n of (S.noseIn || [])) { const d = n.d[0], lab = 'the bow digging in at ' + Math.round(n.V * 3.6) + ' km/h, ' + n.sink + ' m/s, ' + n.pitch + ' deg';
      if (n.pitch < 40) yes(n.finite && (!!d.strike === d.gapMin < 0) && (!d.strike || (d.strikeAt || {}).surf === 'water'), lab + ' (the ordinary water case): ' + (d.strike ? 'the disc strikes the WATER (the base: no strike on water at all) - \'' + d.strike + '\'' : 'the disc clears the water by ' + f2(d.gapMin) + ' m - no strike') + ', the engine ' + (n.running[0] ? 'running' : 'stopped'));
      else yes(n.finite && !!d.strike && (d.strikeAt || {}).surf === 'water' && !n.running[0], lab + ' (TREECRASH\'s severe nose-in): the disc strikes the WATER - \'' + d.strike + '\', the engine stopped'); }
    for (const g of (S.graze || [])) { const d = g.d[0];
      // THE OPEN LIST (train 41, the user's ruling 8 Oct): the twin's full-power graze - with TUNE's member floors the wing
      // strut under the nacelle is the weakest link and gives first, the engine mount holds; the row asserts the mount -
      // printed, never counted until G2398 (the wing floor under a nacelle, owner Deform) lands; a pass counts as ever
      if (g.thr === 1 && k === 'twinFloats' && !(g.finite && d.strike === 'separation' && d.bladeLost > 0 && g.mountAt != null)) console.log('  OPEN  the twin on floats, a trunk grazing the tips at full power (' + Math.round(g.rpm0) + ' rpm): ' + (d.bladeLost > 0 ? 'a blade breaks off, ' : '') + f2(g.imbMax / 1000) + ' kN of imbalance, the mount holds; first to go: ' + ((g.groups || []).join(' > ') || 'nothing') + ' [owner Deform G2398, opened 2026-10-08]');
      else if (g.thr === 1) yes(g.finite && d.strike === 'separation' && d.bladeLost > 0 && g.mountAt != null,'a trunk grazing the tips (3 cm) at full power (' + Math.round(g.rpm0) + ' rpm, tip ' + Math.round((d.strikeAt || {}).tip || 0) + ' m/s): a blade breaks off and the prop turns on short of it - ' + f2(g.imbMax / 1000) + ' kN of imbalance (m e w^2) - the mount lets go ' + f2(g.mountAt) + ' s later (the engine leaves) ' + GAME);
      else yes(g.finite && d.strike === 'brush' && g.running[0] && g.mountAt == null, 'the same graze at idle (' + Math.round(g.rpm0) + ' rpm, tip ' + Math.round((d.strikeAt || {}).tip || 0) + ' m/s): \'' + d.strike + '\', the engine runs, the mount holds'); }
    // 4. the gearbox
    for (const g of (S.gear || [])) { const d = g.d[0];
      if (g.thr === 1) yes(g.finite && d.gearbox === 'failed' && d.failed && d.why === 'overspeed' && g.failAt != null && g.failAt < 4,
        '4. the gearbox (' + REF.gearbox[0].source.split(':')[0] + ' ' + FLAG + '): a stoppage at full power shears the drive - the engine runs away unloaded (' + Math.round(g.peakEng) + ' rpm, ' + pc(g.peakEng / (d.osPeak > 0 ? g.peakEng / d.osPeak : 1)) + ') and throws a rod ' + f2(g.failAt) + ' s later ' + GAME);
      else yes(g.finite && d.gearbox === 'damaged' && d.failed && d.why !== 'overspeed', '4. a stoppage at idle: the engine stops (\'' + d.why + '\'), the gearbox marked for its inspection (Rotax\'s manual after a strike) ' + FLAG); }
    // 5. the mount on the certificate
    const M = P.mount;
    if (M && M.cases) {
      console.log('5. THE MOUNT (23.361 / .363 / .371 as certificate cases; the stamped members) ' + FLAG);
      rep('the limit torque ' + f2(M.DS.tqK * M.DS.Qprop) + ' N m (mean ' + f2(M.DS.Q) + ' x ' + M.DS.gear + ' through the reduction x ' + M.DS.tqK + ', ' + M.DS.cyl + ' cylinders); the prop\'s I ' + f2(M.DS.I) + ' kg m2 at ' + f2(M.DS.omegaR) + ' rad/s; the drive cases govern ' +
        (Object.keys(M.govern).filter(n => /^(torque361|side363|gyro371)/.test(n)).map(n => n + ' ' + M.govern[n]).join(', ') || 'none') + ' of the mount members\' limits');
      for (const nm of Object.keys(M.cases)) { const c = M.cases[nm];
        yes(c.y <= 1 + 1e-9 && c.kb >= 1.5, nm + ': the mount holds it with no set (worst ' + f2(c.y) + ' of its yield, ' + c.at + ') and lets go at ' + f2(c.kb) + ' x it (' + c.atb + ': past the ultimate, 1.5)'); }
      const sn = M.snap;
      yes(sn.mount.max <= 1, 'the snap-roll entry (the controls full at V_A): yaw ' + f2(sn.w[1]) + ', pitch ' + f2(sn.w[2]) + ' rad/s (' + f2(sn.ratio) + ' x 23.371\'s) - the mount at ' + f2(sn.mount.max) + ' of its certified yield (' + (sn.mount.at ? sn.mount.at.tag : '-') + '; no gyroscopic couple in the flown sim: the certificate carries it)');
    }
    // 6. the negatives
    const N = P.neg;
    if (N) {
      console.log('6. NORMAL OPERATIONS NEVER TOUCH IT');
      const clean = d => d.every(x => !x.strike && !x.failed && !(x.osExc > 0) && (x.os == null || x.os === 'logged'));
      const gm = d => f2(Math.min(...d.map(x => x.gapMin)));
      if (N.circ) yes(N.circ.finite && clean(N.circ.d), 'the circuit (' + N.circ.outcome + ', ' + N.circ.t.toFixed(0) + ' s; the take-off at full power): no strike, no exceedance - the engine\'s peak ' + Math.round(N.circ.rpmMax) + ' rpm' + (N.circ.d[0].os ? ' (logged ' + f2(N.circ.d[0].osSec) + ' s)' : '') + ', the disc\'s least clearance ' + gm(N.circ.d) + ' m');
      if (N.pull) yes(N.pull.finite && clean(N.pull.d), 'a ' + f2(N.pull.nz) + ' g pull at full power: no strike, no exceedance');
      if (N.brake) yes(N.brake.finite && clean(N.brake.d), 'half brakes from 12 m/s (the nose dips): no strike - the disc\'s least clearance ' + gm(N.brake.d) + ' m');
      if (N.brakeFull) { const d = N.brakeFull.d[0]; yes(N.brakeFull.finite && !!d.strike && d.teardown, '(and the classic: FULL brakes from 12 m/s stand the taildragger on its nose - \'' + d.strike + '\' (bite ' + f2((d.strikeAt || {}).biteR) + ' R), the engine ' + (N.brakeFull.running[0] ? 'running' : 'stopped') + ', a teardown owed)'); }
    }
  }
  rep('the teardown\'s internal damage (seeded, ' + G.internalP * 100 + ' %): ' + REF.prop_strike.find(x => x.id === 'aopa_internal').source.split(' - ')[0] + ' 10-20 % - a ratio for the bill, never a gate');
  console.log('  ' + (checks - fails) + '/' + checks + ' checks');
  console.log('GATE DMGDRIVE: ' + (fails ? 'FAIL' : 'PASS'));
  process.exit(fails ? 1 : 0);
})();
