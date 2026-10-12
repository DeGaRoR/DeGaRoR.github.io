#!/usr/bin/env node
// G2480 HAND-CONTROLS: THE EVIDENCE - the controls a hand now reaches, flown BY HAND in node through the input model
// (src/viewer/input.js: the same press() the page's keydown listener calls, the same mapping a gamepad's axes go
// through, the same write() into sim.ctl), on the user's validated builds.
//
//   PIVOT    stopped on the flat strip, the stick centred, full pedal, 0.7 throttle walked up on PageUp (1.4 s):
//            the tailwheel's / nosewheel's steering alone vs the same with the INSIDE TOE BRAKE held ([ or ]) vs the
//            brake-steer option (B with the pedal held); each way round. 180 deg: the time, the chord of the turn / 2
//            (the radius of a half circle), the CG's farthest excursion from where it stood
//   TAKEOFF  the Cub from rest, full throttle (Home), a hand on a STICK (a gamepad fixture through mapBinding: the
//            pitch held on attitude, the wings level) and the FEET on the pedals for the roll; at 60 m the feet come
//            OFF: the climb is flown on the rudder TRIM alone (NumpadEnter presses before the roll), 0 vs 0.14
//   WORKER   the host (sim_host.js makeSimHost, the default worker mode's sim) handed the page's hand packet exactly as
//            sim_link.js builds it (its template read from the source): brakeD and the water rudders' wr reach the
//            worker's sim.ctl; the hand -> pilot switch takes both off; the Cessna floats' handle UP at taxi speed
//
//   node tools/hand_controls_probe.js [--only=pivot,takeoff,worker] -> the table + reports/evidence/hand_controls_g2480.json
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname, ROOT = path.join(T, '..');
const L = require(path.join(T, '_treecrash_lib.js'));
const C = L.core();
const API = require(path.join(ROOT, 'src', 'viewer', 'input.js'));
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const ONLY = arg('only', 'pivot,takeoff,worker').split(',');
const r2 = (x, n = 2) => (typeof x === 'number' && Number.isFinite(x)) ? +x.toFixed(n) : x;
const DT = 1 / 60;
const hdgOf = sim => { const [xA] = sim.axes(); return Math.atan2(-xA[2], -xA[0]); };
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const tree = (() => { try { return require('child_process').execSync('git rev-parse --short=10 HEAD', { cwd: ROOT }).toString().trim(); } catch (e) { return '?'; } })();
const dirty = (() => { try { return require('child_process').execSync('git status --porcelain -- src tools', { cwd: ROOT }).toString().trim().length > 0; } catch (e) { return null; } })();

function onStrip(key) {
  const def = L.defOf(key, { elastic: true });
  const F = L.flatWorld(300);
  const sim = C.makeSim(def, F.W); sim.reset(0);
  C.placeAtAerodrome(sim, Object.assign({}, F.strip, { elev: 300, spawnElev: 300 }));
  for (let f = 0; f < 180; f++) sim.step(DT);
  const I = API.make({}); I.aircraft({ flaps: def.params.flaps, nEngines: def.params.nEngines || 1 }); I.seed(sim.ctl);
  return { def, sim, I };
}
const tick = (I, sim, snap) => { I.update(DT, snap); I.write(sim.ctl); sim.step(DT); };

// ---- PIVOT -------------------------------------------------------------------------------------------------------
function pivot(key, mode, side, thrFrames) {
  thrFrames = thrFrames || 84;
  const { sim, I } = onStrip(key);
  const pedal = side > 0 ? 'Period' : 'Comma';                 // + = right
  if (mode === 'brakeSteer') I.setOpt('brakeSteer', true);
  const cg0 = sim.cgPos().slice(), h0 = hdgOf(sim);
  let hPrev = h0, turned = 0, t = 0, maxEx = 0, path = 0, last = cg0.slice(), done = null, brakeDmax = 0;
  I.press(pedal, true);
  if (mode === 'toe') I.press(side > 0 ? 'BracketRight' : 'BracketLeft', true);
  // 'toe50': the inside toe brake HALF down on a pedal's toe AXIS (a fixture through mapBinding: rest -1, half 0)
  const ped = { id: 'T-Rudder (Vendor: 044f Product: b679)', axes: [-1], buttons: [] };
  const snap = mode === 'toe50' ? [ped] : undefined;
  if (mode === 'toe50') { I.setBinding(side > 0 ? 'brakeR' : 'brakeL', { dev: API.deviceKeys(snap)[0], type: 'axis', index: 0, lo: -1, hi: 1, dead: 0 });
                          I.update(DT, snap); ped.axes[0] = 0; }
  if (mode === 'brakeSteer') I.press('KeyB', true);
  I.press('PageUp', true);
  for (let f = 0; f < 60 * 40; f++) {
    if (f === thrFrames) I.press('PageUp', false);             // 84 frames: 0.7 of the lever (0.5 of the travel a second)
    tick(I, sim, snap); t += DT;
    brakeDmax = Math.max(brakeDmax, Math.abs(sim.ctl.brakeD));
    const h = hdgOf(sim); turned += wrap(h - hPrev); hPrev = h;
    const cg = sim.cgPos();
    maxEx = Math.max(maxEx, Math.hypot(cg[0] - cg0[0], cg[2] - cg0[2]));
    path += Math.hypot(cg[0] - last[0], cg[2] - last[2]); last = cg.slice();
    if (!done && Math.abs(turned) >= Math.PI) { done = { t, chord: Math.hypot(cg[0] - cg0[0], cg[2] - cg0[2]), path, sense: Math.sign(turned) }; break; }
  }
  // the heading here is atan2(-x_aft.z, -x_aft.x): a turn to the RIGHT (seen from above, y up) is a positive change
  return { key, mode, side: side > 0 ? 'right' : 'left', t180: done ? r2(done.t, 1) : null, radius: done ? r2(done.chord / 2, 1) : null,
           maxEx: r2(maxEx, 1), path: done ? r2(done.path, 1) : r2(path, 1), sense: done ? (done.sense > 0 ? 'right' : 'left') : null,
           turnedDeg: r2(turned * 180 / Math.PI, 0), thr: r2(sim.ctl.thr), brakeDmax: r2(brakeDmax) };
}

// ---- TAKEOFF -----------------------------------------------------------------------------------------------------
function takeoff(key, trimSteps) {
  const { def, sim, I } = onStrip(key);
  const A = def.params.ap;
  // THE HAND ON A STICK: a gamepad fixture (pitch axis 1, roll 0, pedals 2), identity span, no deadzone
  const pad = { id: 'hand fixture (Vendor: 0000 Product: 0000)', axes: [0, 0, 0], buttons: [] };
  const snap = () => [pad]; const dev = API.deviceKeys(snap())[0];
  I.setBinding('roll', { dev, type: 'axis', index: 0, dead: 0 });
  I.setBinding('pitch', { dev, type: 'axis', index: 1, dead: 0 });
  I.setBinding('yaw', { dev, type: 'axis', index: 2, dead: 0 });
  const set = (i, v) => { pad.axes[i] = Math.max(-1, Math.min(1, v)); };
  for (let k = 0; k < trimSteps; k++) { I.press('NumpadEnter', true); I.update(DT, snap()); I.press('NumpadEnter', false); I.update(DT, snap()); }
  I.press('Home', true); I.update(DT, snap()); I.press('Home', false);
  const h0 = hdgOf(sim), y0 = sim.cgPos()[1];
  const att = () => { const [xA, yU, zR] = sim.axes(); return { th: Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 57.3, ph: Math.atan2(-zR[1], yU[1]) * 57.3 }; };
  let t = 0, liftT = null, feetOffT = null, thP = att().th, hP = h0, maxRollOff = 0, ground = [], climb = [];
  const cg0 = sim.cgPos().slice();
  const ax = [Math.cos(h0), Math.sin(h0)];
  for (let f = 0; f < 60 * 70; f++) {
    const a = att(), V = sim.out.V || 0, h = hdgOf(sim), agl = sim.cgPos()[1] - y0, onG = sim.wheelsOnGround();
    const q = (a.th - thP) / DT; thP = a.th;
    const r = wrap(h - hP) / DT; hP = h;
    const eh = wrap(h - h0) * 57.3;                            // + = right of the runway heading
    // the stick: neutral to the tail-up speed, forward a little to lift the tail, then the climb attitude
    let de;
    if (liftT == null && V < A.VTailUp) de = 0;
    else if (liftT == null && V < A.VRot) de = 0.08 * (1 - a.th) - 0.02 * q;                       // tail up: ~1 deg
    else de = 0.06 * (9 - a.th) - 0.02 * q;                                                         // the climb: 9 deg
    set(1, de);
    set(0, 0.03 * (0 - a.ph) - 0.004 * ((a.ph - (thP - thP)) * 0));                                  // the wings level
    // the feet: the heading on the roll and to 60 m, then OFF - the trim alone
    if (feetOffT == null && agl > 60) feetOffT = t;
    set(2, feetOffT == null ? -(0.08 * eh + 0.3 * r * 57.3 / 57.3) : 0);
    I.update(DT, snap()); I.write(sim.ctl); sim.step(DT); t += DT;
    if (liftT == null && onG === 0 && agl > 1) liftT = t;
    if (liftT == null) {
      const cg = sim.cgPos(); maxRollOff = Math.max(maxRollOff, Math.abs(-(cg[0] - cg0[0]) * ax[1] + (cg[2] - cg0[2]) * ax[0]));
      ground.push(sim.ctl.dr);
    }
    if (feetOffT != null && t > feetOffT + 2) climb.push({ t, eh, beta: (sim.out.beta || 0) * 57.3, ph: a.ph, dr: sim.ctl.dr, vs: sim.out.vs, V });
    if (feetOffT != null && t > feetOffT + 32) break;
  }
  const mean = (arr, k) => arr.length ? arr.reduce((s, x) => s + x[k], 0) / arr.length : null;
  const c0 = climb[0], c1 = climb[climb.length - 1];
  return { key, trimSteps, trimR: r2(I.trims().r, 3), liftT: liftT != null ? r2(liftT, 1) : null, rollOff: r2(maxRollOff, 2),
           rollDrMean: r2(mean(ground.map(d => ({ d })), 'd'), 3),
           climb: c0 ? { secs: r2(c1.t - c0.t, 0), dr: r2(c1.dr, 3), betaMean: r2(mean(climb, 'beta'), 2), bankMean: r2(mean(climb, 'ph'), 1),
                         hdgDrift: r2(c1.eh - c0.eh, 1), hdgRate: r2((c1.eh - c0.eh) / (c1.t - c0.t), 2), vs: r2(mean(climb, 'vs'), 2), V: r2(mean(climb, 'V'), 1) } : null };
}

// ---- WORKER ------------------------------------------------------------------------------------------------------
function worker() {
  const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));
  const linkSrc = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'sim_link.js'), 'utf8');
  // sim_link.js frame(): the hand's packet template, read from the source (every key it carries)
  const m = /const h = \{([^}]*)eng:/.exec(linkSrc);
  const tmplKeys = m ? m[1].split(',').map(s => s.split(':')[0].trim()).filter(Boolean) : [];
  const packet = I => { const h = {}; for (const k of tmplKeys) h[k] = null; h.eng = null; I.write(h); const p = Object.assign({}, h, { eng: null }); return p; };
  const R = { tmplKeys, hostKeys: null, cases: [] };
  const specOf = f => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); return C.genMigrateSpec(j.spec || j); };
  const run = (label, spec, place, script, nSteps) => {
    const H = SH.makeSimHost(C, { world: {}, spec, place, pilot: { kind: 'auto' }, day: false });
    R.hostKeys = H.HAND_KEYS || null;
    const I = API.make({}); I.aircraft({ flaps: H.def.params.flaps, nEngines: H.def.params.nEngines || 1 }); I.seed(H.sim.ctl);
    const log = [];
    for (let k = 0; k < nSteps; k++) {
      const acts = script(k, I, H) || {};
      if (acts.start) H.queueCmd({ cmd: 'start' });
      if (acts.manual != null) H.queueCmd({ cmd: 'manual', on: acts.manual });
      I.update(DT);
      if (acts.hand !== false && H.manual !== false) H.queueCmd({ cmd: 'hand', ctl: packet(I) });
      H.step();
      if (acts.read) log.push(Object.assign({ k }, acts.read(H, I)));
    }
    R.cases.push({ label, log });
    return log;
  };
  // 1 THE CUB ON HOME'S STAND: the hand's left toe brake, then the right, then the pilot takes it back
  run('cub: toe brakes through the worker', specOf('builds/cub_2026-09-20_corrected.json'), { from: 'HOME', to: 'CIRCUIT', stand: true }, (k, I, H) => {
    if (k === 5) return { start: true, hand: false };
    if (k === 10) return { manual: true };
    if (k === 20) I.press('BracketLeft', true);
    if (k === 80) { I.press('BracketLeft', false); I.press('BracketRight', true); }
    if (k === 140) I.press('BracketRight', false);
    if (k === 150) { I.press('KeyV', true); }
    if (k === 152) { I.press('KeyV', false); }
    if (k === 170) return { manual: false, hand: false };
    if ([79, 139, 160, 175].includes(k)) return { read: (H2, I2) => ({ phase: H2.ap.phase, manual: H2.manual, hostBrake: H2.sim.ctl.brake, hostBrakeD: H2.sim.ctl.brakeD, hostWr: H2.sim.ctl.wr,
                                                                    handBrakeD: (() => { const c = {}; I2.write(c); return c.brakeD; })() }) };
    return null;
  }, 180);
  // 2 THE CESSNA FLOATS ON THE SEA LANE: the handle UP at taxi speed (THE RULE has it DOWN under 12 m/s)
  run('floats: the water rudders\' handle through the worker', specOf('bugReports/cessnaFloatsWOrks.json'), { from: 'SEA', to: 'CIRCUIT' }, (k, I, H) => {
    if (k === 5) return { start: true, hand: false };
    if (k === 10) return { manual: true };
    if (k === 12) I.press('PageUp', true);
    if (k === 40) I.press('PageUp', false);
    if (k === 200) I.press('KeyV', true);
    if (k === 202) I.press('KeyV', false);
    if (k === 400) I.press('KeyV', true);
    if (k === 402) I.press('KeyV', false);
    if (k === 600) { I.press('KeyV', true); }
    if (k === 602) { I.press('KeyV', false); }
    if ([199, 399, 599, 799].includes(k)) return { read: H2 => { const HY = H2.sim.hydro; return { hostWr: H2.sim.ctl.wr, wrDown: HY ? HY.floats.map(f => f.wrDown) : null, V: r2(H2.sim.out.V || 0) }; } };
    return null;
  }, 800);
  return R;
}

// ---- run -----------------------------------------------------------------------------------------------------------
const out = { tree, dirty, mode: 'node (cloud), the flat world at 300 m (PIVOT, TAKEOFF); makeSimHost on the analytic world (WORKER)', pivot: [], takeoff: [], worker: null };
if (ONLY.includes('pivot')) {
  // (the metal Cessna also at 0.35 and 0.2: its O-540 at 0.7 drives it round its nosewheel's own 5 m arc before a brake
  // matters - the G1938 C172 pivot ran on less power)
  for (const [key, tf] of [['cub', 84], ['metal', 84], ['metal', 42], ['metal', 24], ['jodel', 84]])
    for (const side of [1, -1])
      for (const mode of key === 'metal' ? ['steer', 'toe', 'toe50', 'brakeSteer'] : ['steer', 'toe', 'brakeSteer']) {
        const r = pivot(key, mode, side, tf); out.pivot.push(r);
        console.log(`PIVOT ${L.BUILDS[key].label.padEnd(13)} thr ${r.thr} ${r.side.padEnd(5)} ${mode.padEnd(10)}: 180 deg in ${r.t180 != null ? r.t180 + ' s' : 'never (' + r.turnedDeg + ' deg in 40 s)'}, r ${r.radius} m, CG out ${r.maxEx} m, path ${r.path} m, |brakeD| ${r.brakeDmax}, turned ${r.sense}`);
      }
}
if (ONLY.includes('takeoff')) {
  for (const n of [0, 7, 14, 20]) {
    const r = takeoff('cub', n); out.takeoff.push(r);
    console.log(`TAKEOFF Cub, rudder trim ${r.trimR} (${n} presses): airborne ${r.liftT} s, ${r.rollOff} m off the line on the roll (feet on: dr mean ${r.rollDrMean}); ` +
                (r.climb ? `FEET OFF ${r.climb.secs} s of climb: dr ${r.climb.dr}, beta ${r.climb.betaMean} deg, bank ${r.climb.bankMean} deg, heading ${r.climb.hdgDrift} deg (${r.climb.hdgRate} deg/s), vs ${r.climb.vs} m/s at ${r.climb.V} m/s` : 'no climb'));
  }
}
if (ONLY.includes('worker')) {
  out.worker = worker();
  console.log('WORKER sim_link.js hand packet keys: ' + out.worker.tmplKeys.join(', ') + '; sim_host HAND_KEYS: ' + (out.worker.hostKeys || []).join(', '));
  for (const c of out.worker.cases) { console.log('WORKER ' + c.label); for (const e of c.log) console.log('   ' + JSON.stringify(e)); }
}
fs.mkdirSync(path.join(ROOT, 'reports', 'evidence'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports', 'evidence', 'hand_controls_g2480.json'), JSON.stringify(out, null, 1));
console.log('tree ' + tree + (dirty ? ' + working changes' : '') + ' -> reports/evidence/hand_controls_g2480.json');
