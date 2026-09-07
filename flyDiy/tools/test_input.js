#!/usr/bin/env node
// GATE INPUT (G200) — manual controls: the model, and the handoff.
//
// WHAT A NODE GATE CAN SAY ABOUT A STICK. Not whether it feels right — that
// is the user's hand on the real thing. What it CAN hold is everything that
// is a pure function of key state and gamepad readings, which is the whole
// of src/viewer/input.js: the action table's shape, the keyboard's rate
// shaping and centring, the lever that latches, trim as a bias, the flap
// notches, the gamepad mapping (deadzone, expo, the throttle that idles at
// +1), the listen inference, the profile round trip, and the seed that
// keeps the surfaces from jumping at the handoff.
//
// AND THE ONE THING THAT ACTUALLY FLEW WRONG. HANDOVER's W14 note: the first
// AP re-engage after manual flight nosed over, because the integrators held
// pre-handoff state. reEngage() re-latches them now; this gate FLIES it — a
// held bank under hand control, then the AP takes it back, on both pilots,
// and through the keyboard path so the sign convention (ArrowRight rolls
// RIGHT, ArrowDown is nose UP) is proven end to end rather than read.
const fs = require('fs');
const path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');

const src = R('src/viewer/input.js');
const build = R('tools/build.js');
const app = R('src/viewer/app.js');
const join = R('tools/_cage_join.js');
const editor = R('src/viewer/editor.js');

// ---- load with NO window, NO navigator, NO storage -------------------------
const mod = { exports: {} };
new Function('module', 'window', src)(mod, undefined);
const API = mod.exports;
const A = API.ACTIONS || [];
const byId = {};
for (const a of A) byId[a.id] = a;

const checks = {};
const ck = (label, cond) => { checks[label] = !!cond; };
const near = (a, b, e) => Math.abs(a - b) <= (e == null ? 1e-6 : e);

// ---- the table --------------------------------------------------------------
ck('module loads with no window', !!API && typeof API.make === 'function');
ck('action ids are unique', new Set(A.map(a => a.id)).size === A.length && A.length > 10);
ck('every action is axis, button or step',
   A.every(a => a.kind === 'axis' || a.kind === 'button' || a.kind === 'step'));
ck('every axis declares its range and shape',
   A.filter(a => a.kind === 'axis').every(a => isFinite(a.lo) && isFinite(a.hi) && a.hi > a.lo &&
     ['centre', 'latch', 'pass'].indexOf(a.shape) >= 0));
ck('every action names the sim.ctl field it drives, or null (an event)',
   A.every(a => a.ctl === null || typeof a.ctl === 'string'));
ck('the solver\'s sign convention is carried by the yaw scale (dr>0 is nose LEFT)',
   byId.yaw && byId.yaw.scale === -1 && byId.pitch.scale === 1 && byId.roll.scale === 1);
{
  const codes = [];
  for (const a of A) if (a.keys) for (const k in a.keys) codes.push(a.keys[k]);
  ck('default key codes are unique', new Set(codes).size === codes.length);
  ck('no default key is Space, Enter or Escape (they belong to the buttons and flyouts)',
     !codes.some(c => c === 'Space' || c === 'Enter' || c === 'Escape'));
  ck('defaults bind by KeyboardEvent.code (layout-independent), not by .key',
     codes.every(c => /^(Key[A-Z]|Digit\d|Numpad\w+|Arrow\w+|Page\w+|Home|End|Period|Comma|F\d+)$/.test(c)));
}
ck('the pref key', API.PREF === 'flydiy.input');
ck('head axes exist for the tracker that is not wired yet (six, pass-through)',
   ['headYaw', 'headPitch', 'headRoll', 'headX', 'headY', 'headZ'].every(k => byId[k] && byId[k].shape === 'pass'));

// ---- a hostile instance ----------------------------------------------------
let made = null, threw = null;
try { made = API.make({ win: { addEventListener() {} }, nav: {} }); made.update(1 / 60); } catch (e) { threw = e.message; }
ck('make() survives a navigator with no getGamepads and a window with nothing else', threw === null && !!made);

// ---- keyboard shaping ------------------------------------------------------
const fresh = () => { const I = API.make({}); I.aircraft({ flaps: { to: 0.5, ldg: 1, rate: 0.5 }, nEngines: 1 }); return I; };
const run = (I, n, snap) => { for (let i = 0; i < n; i++) I.update(1 / 60, snap); };
const out = I => { const c = { eng: null }; I.write(c); return c; };
{
  const I = fresh();
  I.press('ArrowDown', true); run(I, 60);
  const c1 = out(I);
  ck('ArrowDown held 1 s → full nose-up elevator (de ≥ 0.95)', c1.de >= 0.95);
  I.press('ArrowDown', false); run(I, 30);
  ck('released 0.5 s → centred (|de| < 0.02)', Math.abs(out(I).de) < 0.02);
  I.press('ArrowDown', true); I.press('ArrowUp', true); run(I, 60);
  ck('both pitch keys → 0', Math.abs(out(I).de) < 0.02);
  I.press('ArrowDown', false); I.press('ArrowUp', false);
  I.press('ArrowRight', true); run(I, 12);
  const mid = out(I).da;
  ck('a centring axis RAMPS (0.2 s in ≈ 0.5, not a step)', mid > 0.3 && mid < 0.7);
  I.press('ArrowRight', false); run(I, 60);
  ck('ArrowRight is roll RIGHT (da>0)', mid > 0);
}
{
  const I = fresh();
  I.press('PageUp', true); run(I, 60); I.press('PageUp', false); run(I, 60);
  const c = out(I);
  ck('PageUp held 1 s → throttle 0.5, and it LATCHES on release', near(c.thr, 0.5, 0.03));
  I.press('Home', true); run(I, 2); I.press('Home', false); run(I, 2);
  ck('Home → full throttle', near(out(I).thr, 1, 1e-9));
  I.press('End', true); run(I, 2); I.press('End', false);
  ck('End → idle', near(out(I).thr, 0, 1e-9));
}
{
  const I = fresh();
  for (let i = 0; i < 5; i++) { I.press('Numpad1', true); run(I, 1); I.press('Numpad1', false); run(I, 1); }
  ck('five trim-up presses → resting de = 0.10', near(out(I).de, 0.10, 1e-9));
  I.press('ArrowDown', true); run(I, 60);
  ck('full pitch plus trim clamps at 1', near(out(I).de, 1, 1e-9));
  I.press('ArrowDown', false); run(I, 60);
  I.press('Numpad7', true); run(I, 120); I.press('Numpad7', false);
  ck('a held trim key REPEATS (2 s held walks past a single step)', out(I).de < 0.10 - 0.05);
  const I2 = fresh();
  for (let i = 0; i < 100; i++) { I2.press('Numpad1', true); run(I2, 1); I2.press('Numpad1', false); run(I2, 1); }
  ck('trim is bounded (±0.5)', near(out(I2).de, 0.5, 1e-9));
}
{
  const I = fresh();
  I.press('KeyB', true); run(I, 30);
  ck('brake ramps to 1 while held (0.5 s at 4/s)', near(out(I).brake, 1, 1e-9));
  I.press('KeyB', false); run(I, 30);
  ck('brake releases to 0', near(out(I).brake, 0, 1e-9));
}
{
  const I = fresh();
  I.press('KeyF', true); run(I, 1);
  ck('flapDown: a held step fires ONCE', I.state().flapI === 1);
  ck('flap SLEWS at the aeroplane\'s own rate, never jumps', out(I).flap < 0.05);
  run(I, 120);
  ck('...and holding it 2 s does not fire again (no repeat on flaps)', I.state().flapI === 1);
  ck('...while the flap travelled to its notch', near(out(I).flap, 0.5, 1e-6));
  I.press('KeyF', false); run(I, 1); I.press('KeyF', true); run(I, 1); I.press('KeyF', false);
  ck('flapDown twice → the second notch (to → ldg)', I.state().flapI === 2 && near(I.state().notches[2], 1, 1e-9));
  run(I, 240);
  ck('...and gets there', near(out(I).flap, 1, 1e-6));
  I.press('KeyG', true); run(I, 1); I.press('KeyG', false);
  ck('flapUp → back one notch', I.state().flapI === 1);
  const I3 = API.make({}); I3.aircraft({ flaps: null, nEngines: 1 });
  I3.press('KeyF', true); run(I3, 60);
  ck('no flaps on the aeroplane → the action is inert', near(out(I3).flap, 0, 1e-9));
}
{
  const I = fresh();
  I.press('KeyA', true); const e1 = I.update(1 / 60); const e2 = I.update(1 / 60);
  ck('apToggle fires on the edge, once', e1.fired.indexOf('apToggle') >= 0 && e2.fired.indexOf('apToggle') < 0);
  I.press('KeyA', false); I.update(1 / 60);
  I.press('KeyC', true); const e3 = I.update(1 / 60);
  ck('viewNext fires', e3.fired.indexOf('viewNext') >= 0);
}
{
  // the listener's guard is the listener's; press() itself is the door the
  // gate uses, and a code that is not bound reports so (no preventDefault)
  const I = fresh();
  ck('press() reports bound vs unbound codes', I.press('ArrowDown', true) === true && I.press('KeyZ', true) === false);
}

// ---- gamepad mapping -----------------------------------------------------------
{
  const act = byId.pitch, lever = byId.throttle;
  const b0 = { lo: -1, hi: 1, dead: 0, expo: 0, invert: false };
  ck('mapBinding: identity on a centred axis', near(API.mapBinding(b0, 0.5, act), 0.5) && near(API.mapBinding(b0, -1, act), -1));
  ck('mapBinding: invert', near(API.mapBinding(Object.assign({}, b0, { invert: true }), 0.5, act), -0.5));
  const bd = Object.assign({}, b0, { dead: 0.1 });
  ck('mapBinding: deadzone is 0 inside and rescaled outside (endpoints kept)',
     API.mapBinding(bd, 0.05, act) === 0 && near(API.mapBinding(bd, 1, act), 1) && near(API.mapBinding(bd, -1, act), -1));
  const be = Object.assign({}, b0, { expo: 0.5 });
  let mono = true, prev = -2;
  for (let x = -1; x <= 1.0001; x += 0.05) { const y = API.mapBinding(be, x, act); if (y < prev - 1e-9) mono = false; prev = y; }
  ck('mapBinding: expo is monotonic and keeps the endpoints',
     mono && near(API.mapBinding(be, 1, act), 1) && near(API.mapBinding(be, -1, act), -1) && Math.abs(API.mapBinding(be, 0.5, act)) < 0.5);
  // G209: SENSITIVITY — full stick = gain of the travel, after the expo,
  // clamped at the travel; a lever ignores it; the profile keeps it
  const bg = Object.assign({}, b0, { gain: 0.5 });
  ck('mapBinding: gain 0.5 halves a centred axis (full stick -> half travel) and keeps the centre',
     near(API.mapBinding(bg, 1, act), 0.5) && near(API.mapBinding(bg, -1, act), -0.5) && near(API.mapBinding(bg, 0, act), 0));
  ck('mapBinding: gain above 1 saturates at full travel, and applies after the expo',
     near(API.mapBinding(Object.assign({}, b0, { gain: 2 }), 1, act), 1) &&
     near(API.mapBinding(Object.assign({}, b0, { gain: 2, expo: 1 }), 0.5, act), 0.25));
  ck('mapBinding: a lever ignores gain',
     near(API.mapBinding({ lo: 1, hi: -1, dead: 0, expo: 0, gain: 0.5 }, -1, lever), 1));
  {
    const n = API.normalise({ bindings: { roll: [{ dev: 'stick#0', type: 'axis', index: 0, gain: 0.4 }],
                                          pitch: [{ dev: 'stick#0', type: 'axis', index: 1 }] } });
    ck('normalise: keeps a gain, fills 1 when absent, clamps garbage',
       n.bindings.roll[0].gain === 0.4 && n.bindings.pitch[0].gain === 1 &&
       API.normalise({ bindings: { roll: [{ dev: 'stick#0', type: 'axis', index: 0, gain: 99 }] } }).bindings.roll[0].gain === 2);
  }
  ck('mapBinding: a throttle that idles at +1 (lo:1, hi:-1) maps +1→0 and -1→1',
     near(API.mapBinding({ lo: 1, hi: -1, dead: 0, expo: 0 }, 1, lever), 0) &&
     near(API.mapBinding({ lo: 1, hi: -1, dead: 0, expo: 0 }, -1, lever), 1) &&
     near(API.mapBinding({ lo: 1, hi: -1, dead: 0, expo: 0 }, 0, lever), 0.5));
  ck('mapBinding: garbage raw is the rest value, never NaN',
     isFinite(API.mapBinding(b0, NaN, act)) && isFinite(API.mapBinding({}, undefined, lever)));
}
{
  // a HOTAS fixture: stick #0 (x,y, twist, throttle slider), throttle #1
  // with a lever that idles at +1 and a hat on axis 9
  const stick = { id: 'T.16000M (Vendor: 044f Product: b10a)', axes: [0, 0, 0, 0], buttons: [{ pressed: false }, { pressed: false }] };
  const thr = { id: 'TWCS Throttle (Vendor: 044f Product: b687)', axes: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0], buttons: [{ pressed: false }] };
  const snap = () => [stick, null, thr];
  const I = API.make({});
  I.aircraft({ flaps: { to: 0.4, ldg: 1, rate: 0.5 }, nEngines: 2 });
  const keys = API.deviceKeys(snap());
  ck('deviceKeys: id + ordinal, nulls kept in place', keys[0].endsWith('#0') && keys[1] === null && keys[2].endsWith('#0'));
  ck('deviceKeys: two identical devices are #0 and #1', (() => { const k = API.deviceKeys([stick, stick]); return k[0].endsWith('#0') && k[1].endsWith('#1'); })());
  // listen for roll on the stick, moved the POSITIVE way
  let got = null;
  I.listen('roll', { want: 'gamepad' }, b => { got = b; });
  run(I, 2, snap()); stick.axes[0] = 0.8; run(I, 1, snap());
  ck('listen: an axis excursion binds it', !!got && got.type === 'axis' && got.index === 0 && got.dev === keys[0] && !got.invert);
  stick.axes[0] = 0;
  // pitch: the user pushes the stick FORWARD (raw -y) when asked for +
  got = null; I.listen('pitch', { want: 'gamepad' }, b => { got = b; });
  run(I, 2, snap()); stick.axes[1] = -0.9; run(I, 1, snap());
  ck('listen: a negative excursion → invert:true', !!got && got.invert === true && got.index === 1);
  stick.axes[1] = 0;
  // the throttle lever idles at +1 and runs to -1
  got = null; I.listen('throttle', { want: 'gamepad' }, b => { got = b; });
  run(I, 2, snap()); thr.axes[2] = -1; run(I, 1, snap());
  ck('listen: a lever at rest +1 pushed to -1 binds lo:1, hi:-1', !!got && got.lo === 1 && got.hi === -1 && got.dev === keys[2]);
  run(I, 5, snap());
  ck('...and reads FULL there', near(out(I).thr, 1, 1e-6));
  thr.axes[2] = 1; run(I, 5, snap());
  ck('...and IDLE at rest', near(out(I).thr, 0, 1e-6));
  // a button for the brakes, a hat for the flaps
  got = null; I.listen('brake', { want: 'gamepad' }, b => { got = b; });
  run(I, 2, snap()); stick.buttons[0].pressed = true; run(I, 1, snap());
  ck('listen: a button press binds a button', !!got && got.type === 'button' && got.index === 0);
  run(I, 30, snap());
  ck('...and the brake ramps while it is held', near(out(I).brake, 1, 1e-9));
  stick.buttons[0].pressed = false; run(I, 40, snap());
  got = null; I.listen('flapDown', { want: 'gamepad' }, b => { got = b; });
  run(I, 2, snap()); thr.axes[9] = 1; run(I, 1, snap());
  ck('listen: a hat parking at +1 on axis 9 binds a hat position', !!got && got.type === 'hat' && got.index === 9 && got.at === 1);
  run(I, 1, snap());
  ck('...and it fired once', I.state().flapI === 1);
  thr.axes[9] = -1 / 7 * 0; thr.axes[9] = 0; run(I, 2, snap());
  // ownership: the stick owns roll; the keyboard takes it while a key is held
  // (the roll binding's deadzone is zeroed first, so the numbers read straight)
  I.setBinding('roll', Object.assign({}, I.bound('roll').find(b => b.dev === keys[0]), { dead: 0 }));
  stick.axes[0] = 0.6; run(I, 3, snap());
  ck('a stick axis is read absolutely', near(out(I).da, 0.6, 1e-6));
  I.press('ArrowLeft', true); run(I, 60, snap());
  ck('a held key takes the axis from a still stick', out(I).da < -0.9);
  I.press('ArrowLeft', false); run(I, 60, snap());
  stick.axes[0] = 0.3; run(I, 2, snap());
  ck('...and a stick that moves takes it back', near(out(I).da, 0.3, 1e-6));
  // levers: eng2 bound to a stick slider → writes ctl.eng[1] only
  I.setBinding('eng2', { dev: keys[0], type: 'axis', index: 3, lo: 1, hi: -1 });
  stick.axes[3] = -1; run(I, 3, snap());
  const c = { eng: [{ on: 1, thr: 1 }, { on: 1, thr: 1 }] };
  I.write(c);
  ck('a bound lever writes its own engine only; an unbound one is inert', near(c.eng[1].thr, 1) && c.eng[0].thr === 1);
  stick.axes[3] = 1; run(I, 3, snap()); I.write(c);
  ck('...and reads the lever', near(c.eng[1].thr, 0, 1e-6));
  // devices()
  const dv = I.devices();
  ck('devices() lists the keyboard and every connected pad', dv.length === 3 && dv[0].key === 'keyboard' && dv.some(d => d.key === keys[2]));
  // the profile round-trips
  const p = I.profile();
  const J = I.exportJSON();
  const I2 = API.make({});
  ck('export → import round-trips', I2.importJSON(J) && JSON.stringify(I2.profile()) === JSON.stringify(p));
  ck('export is a document a human can read (one binding per line)', /"dev"/.test(J) && J.split('\n').length > 10);
}
{
  const n = API.normalise({ v: 99, bindings: { pitch: [{ dev: 'keyboard', type: 'keys', pos: 'KeyW', neg: 'KeyS' }],
                                                 bogus: [{ dev: 'x', type: 'axis', index: 0 }],
                                                 roll: [{ dev: 'x', type: 'axis', index: 'no' }, 42, null],
                                                 throttle: [{ dev: 'p#0', type: 'axis', index: 2, dead: 9, expo: -1, lo: 3 }] } });
  ck('normalise: keeps a valid keyboard binding', n.bindings.pitch[0].pos === 'KeyW');
  ck('normalise: drops unknown actions', !n.bindings.bogus);
  ck('normalise: drops malformed bindings', n.bindings.roll.length === 0);
  ck('normalise: clamps fields', n.bindings.throttle[0].dead === 0.5 && n.bindings.throttle[0].expo === 0 && n.bindings.throttle[0].lo === 1);
  ck('normalise(garbage) → defaults', JSON.stringify(API.normalise('nope')) === JSON.stringify(API.DEFAULTS) &&
     JSON.stringify(API.normalise(null)) === JSON.stringify(API.DEFAULTS));
  ck('the defaults carry a keyboard binding for every flying action',
     ['pitch', 'roll', 'yaw', 'throttle', 'brake', 'flapDown', 'flapUp', 'trimUp', 'trimDown', 'apToggle', 'viewNext']
       .every(k => API.DEFAULTS.bindings[k] && API.DEFAULTS.bindings[k][0].dev === 'keyboard'));
  // an unusable stored profile does not take the instance down
  const bad = API.make({ store: { getItem: () => '{not json', setItem() {} } });
  ck('a corrupt stored profile falls back to the defaults', bad.isBound('pitch'));
  const thrower = API.make({ store: { getItem() { throw new Error('quota'); }, setItem() { throw new Error('quota'); } } });
  thrower.resetDefaults();
  ck('a storage that throws is survived', thrower.isBound('roll'));
}
{
  // THE SEED: taking the aeroplane as the AP left it
  const I = fresh();
  I.seed({ de: 0.3, da: 0, dr: 0, thr: 0.6, flap: 1, brake: 0.6 });
  run(I, 5);
  const c = out(I);
  ck('seed: nothing held → the AP\'s elevator is carried as trim (no jump)', near(c.de, 0.3, 1e-6));
  ck('seed: the throttle latches where the lever was', near(c.thr, 0.6, 1e-6));
  ck('seed: the flaps stay where they are, at the nearest notch', near(c.flap, 1, 1e-6) && I.state().flapI === 2);
  ck('seed: the brakes are off (the parking brake was the AP\'s)', c.brake === 0);
  ck('active() says whether a hand is on it', I.active() === false && (I.press('ArrowUp', true), I.update(1 / 60), I.active()) === true);
}

// ---- wiring --------------------------------------------------------------------
ck('build.js lists input.js and input_panel.js before editor.js',
   build.indexOf("'input.js'") > 0 && build.indexOf("'input_panel.js'") > 0 &&
   build.indexOf("'input.js'") < build.indexOf("'editor.js', 'app.js'"));
ck('build.js lists controls.css', /'controls\.css'/.test(build));
ck('app.js writes the input into sim.ctl inside script()',
   (() => { const i = app.indexOf('function script('); return i > 0 && app.slice(i, i + 1600).indexOf('INP.write(sim.ctl)') > 0; })());
ck('app.js re-engages the AP (with a phase) from setManual',
   (() => { const i = app.indexOf('function setManual('); return i > 0 && /ap\.reEngage\(\{/.test(app.slice(i, i + 3000)); })());
ck('the HUD, the trace and the arrival card read flDbg(), not ap.dbg, when the pilot is you',
   (app.match(/flDbg\(\)/g) || []).length >= 3);
ck('the cage join names the flap drive as the linkage carries it (\'flap\', not \'fl\')',
   // G209: the drive comes out of cageSurfHinge now, so ask it rather than the source
   (() => { try { const h = require('./_cage_join.js').cageSurfHinge(
       [[0, 0, 1], [0.3, 0, 1], [0, 0, 1.5], [0.3, 0, 1.5]], 'flapL'); return !!h && h.drive === 'flap'; }
     catch (e) { return false; } })() && !/\? 'fl' : 'da'/.test(join));
ck('both rails carry a controls entry', /k: 'controls'/.test(app) && /k: 'controls'/.test(editor));
ck('the editor rail\'s controls entry is a literal (GATE VIEW reads it in an empty vm)',
   (() => { const i = editor.indexOf("k: 'controls'"); return i > 0 && !/rows:|\(\)\s*=>/.test(editor.slice(i, editor.indexOf('}', i))); })());

// ---- THE HANDOFF, FLOWN ------------------------------------------------------------
// a held bank under hand control, then the AP takes it back — both pilots,
// and once through the keyboard so the signs are proven, not read
let flown = [];
try {
  const C = require('./flight_core.js');
  const pilots = [['classic', (s, d, w) => C.makeAutopilot(s, d, w)], ['test', (s, d, w) => C.makeTestPilot(s, d, w)]];
  const world = C.makeWorld();
  const def = C.buildGen();
  const att = sim => { const [xA, yU, zR] = sim.axes();
    return { th: Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 57.3, ph: Math.atan2(-zR[1], yU[1]) * 57.3 }; };
  for (const [name, mk] of pilots) {
    for (const path2 of ['ctl', 'keys']) {
      const sim = C.makeSim(def, world); sim.reset(0);
      const ap = mk(sim, def, world);
      let t = 0;
      while (ap.phase !== 'CRUISE' && t < 150) { ap.update(1 / 60); sim.step(1 / 60); t += 1 / 60; }
      const r = { name: name + '/' + path2, cruise: ap.phase === 'CRUISE', ok: false };
      flown.push(r);
      if (!r.cruise) continue;
      const alt0 = sim.cgPos()[1], th0 = att(sim).th;
      const I = API.make({}); I.aircraft({ flaps: def.params.flaps, nEngines: def.params.nEngines || 1 });
      I.seed(sim.ctl);
      // a HELD 30° bank for six seconds (a bang-bang on the keys, a P-loop on
      // ctl) with half a second of nose-up first — a hand-flown turn, not a roll
      if (path2 === 'keys') { I.press('ArrowRight', true); I.press('ArrowDown', true); }
      let phMax = 0, thMax = -99;
      for (let s = 0; s < 6 * 60; s++) {
        const a0 = att(sim);
        if (path2 === 'ctl') {
          sim.ctl.da = Math.max(-0.3, Math.min(0.3, 0.02 * (30 - a0.ph)));
          if (s === 30) sim.ctl.de = Math.min(0.15, sim.ctl.de + 0.06);
        } else {
          if (s === 10) I.press('ArrowDown', false);   // a tap, not a zoom
          if (a0.ph > 35) { I.press('ArrowRight', false); I.press('ArrowLeft', true); }
          else if (a0.ph < 25) { I.press('ArrowLeft', false); I.press('ArrowRight', true); }
          else { I.press('ArrowLeft', false); I.press('ArrowRight', false); }
          I.update(1 / 60); I.write(sim.ctl);
        }
        sim.step(1 / 60); ap.t += 1 / 60;
        const a = att(sim); phMax = Math.max(phMax, a.ph); thMax = Math.max(thMax, a.th);
      }
      r.bankHeld = phMax; r.pitchHeld = thMax - th0;
      // hand it back
      ap.reEngage({ phase: 'CRUISE' });
      // the AP is off its course after the turn, so it is TURNING BACK for a
      // while — a bank after re-engage is the AP flying, not a failure. What
      // must hold: no divergence, no over-bank, the nose bounded, the height
      // kept, and the bank back under the AP's own limit by the end.
      let bad = false, thPeak = 0, phPeak = 0, phEnd = 99, altMin = alt0;
      for (let s = 0; s < 25 * 60; s++) {
        ap.update(1 / 60); sim.step(1 / 60);
        const a = att(sim);
        if (!isFinite(sim.p[1]) || sim.stats().bad) { bad = true; break; }
        thPeak = Math.max(thPeak, Math.abs(a.th));
        phPeak = Math.max(phPeak, Math.abs(a.ph));
        if (s >= 20 * 60) phEnd = Math.min(phEnd, Math.abs(a.ph));
        altMin = Math.min(altMin, sim.cgPos()[1]);
      }
      r.bad = bad; r.thPeak = thPeak; r.phPeak = phPeak; r.phEnd = phEnd; r.altLoss = alt0 - altMin; r.phase = ap.phase;
      r.ok = !bad && thPeak < 35 && phPeak < 45 && phEnd < 25 && r.altLoss < 150 && r.bankHeld > 20 && r.bankHeld < 60 &&
             (path2 !== 'keys' || r.pitchHeld > 1);
      console.log(`  ${r.name}: bank held ${phMax.toFixed(0)}°${path2 === 'keys' ? ' (ArrowRight → right)' : ''}, ` +
        `pitch +${r.pitchHeld.toFixed(1)}° → re-engaged: peak |pitch| ${thPeak.toFixed(0)}°, peak bank ${phPeak.toFixed(0)}°, bank at 20-25 s ${phEnd.toFixed(1)}°, ` +
        `alt loss ${r.altLoss.toFixed(0)} m, ${ap.phase}${bad ? ' DIVERGED' : ''} ${r.ok ? 'OK' : 'FAIL'}`);
    }
  }
} catch (e) { console.log('  handoff flight threw: ' + (e && e.stack || e)); flown = null; }
ck('the handoff flew on both pilots, by ctl and by keys', !!flown && flown.length === 4 && flown.every(r => r.cruise));
ck('ArrowRight rolled RIGHT and ArrowDown pitched UP, through the whole path',
   !!flown && flown.filter(r => /keys/.test(r.name)).every(r => r.bankHeld > 20 && r.pitchHeld > 1));
ck('re-engaging after a held bank does not nose over (the W14 note, flown)',
   !!flown && flown.every(r => r.ok));

// ---- verdict ------------------------------------------------------------------------
const failed = Object.keys(checks).filter(k => !checks[k]);
if (failed.length) console.log(`FAILED CHECKS:\n  ${failed.join('\n  ')}`);
console.log(`${Object.keys(checks).length - failed.length}/${Object.keys(checks).length} checks`);
const pass = failed.length === 0;
console.log(pass ? 'GATE INPUT: PASS' : 'GATE INPUT: FAIL');
process.exitCode = pass ? 0 : 1;
