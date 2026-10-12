// ---------------------------------------------------------------------------
// MANUAL CONTROLS (G200) — the device-agnostic input model
// ---------------------------------------------------------------------------
// The user: "at some point, I'll want to fly them myself" — and then "it will
// be time soon", with one ruling on the shape of it: ONE mapping interface,
// from the keyboard step onward, that maps ACTIONS against N devices — the
// keyboard, a stick, a throttle, later a head tracker — and opens from both
// screens. This file is the model under that interface; input_panel.js is
// the interface; app.js is the one caller that writes the result into
// sim.ctl.
//
// THE SHAPE IS THE RESOLVE PASS'S (aa_resolve.js, G144): the module owns its
// state and its own pref, publishes an API at eval, and the screens are thin
// readers that press it. Nothing here touches the DOM at eval, so GATE INPUT
// loads it with `window` undefined and drives it by hand.
//
// WHAT IS AN ACTION. Something the aeroplane can be asked for: an AXIS
// (pitch, roll, yaw, throttle, a lever) with a range; a BUTTON (the brakes)
// that is held; a STEP (flaps, trim, the AP toggle, the view) that fires.
// The table is the contract — the panel draws one row per entry and GATE
// INPUT holds it.
//
// WHAT IS A BINDING. One device's way of asking for one action:
//   { dev:'keyboard', type:'keys', pos, neg[, max, min] }   an axis, by code
//   { dev:'keyboard', type:'key',  code }                   a button or step
//   { dev, type:'axis', index, invert, dead, expo, gain, lo, hi } a gamepad axis
//     (gain is the SENSITIVITY, G209: full stick = gain of full travel, after
//     the expo; 1 is the whole travel, 0.5 half of it — a centred axis only)
//   { dev, type:'button', index }                           a gamepad button
//   { dev, type:'hat', index, at }                          a hat position
// `dev` for a gamepad is its id string plus an ordinal ('#0'), so two
// identical sticks stay distinct. Keys are KeyboardEvent.code, never .key —
// the user is plausibly on AZERTY, and a physical key is the same key under
// every layout.
//
// SIGN CONVENTIONS ARE THE SOLVER'S (30_solver.js): de>0 nose-up, da>0 roll
// right, dr>0 nose LEFT — so the yaw action carries scale -1, and "right
// pedal" reads as +1 everywhere a human sees it. The solver clamps nothing;
// write() does.
//
// KEYBOARD AXES ARE RATE-SHAPED: a held key ramps toward full travel and a
// released one centres, because a key is a switch and a stick is not.
// Throttle LATCHES (it is a lever, and a lever stays where you left it).
// Trim is an input-side bias on the elevator applied AFTER the merge, so it
// biases a stick exactly as it biases the arrow keys; the model has no trim
// tab, and this is honest about that — it is a hand held on the stick.
//
// G2480 (HAND-CONTROLS, the user: "as many controls as possible should be
// exposed to hand flying"): the TOE BRAKES (one main each, keys or a pedal's
// toe axes, onto the solver's brake + brakeD), the brake-steer option, the
// RUDDER and AILERON trims beside the elevator's (the same input-side bias),
// trim wheels and a flap lever as axes, the floats' water-rudder handle, the
// alternator / avionics / pedal light, and the parking brake as a floor under
// the hand's own brakes. HANDOVER G2480 has the audit of what is still not
// modelled.
(() => {
  const VERSION = 1;
  const PREF = 'flydiy.input';
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const fin = (x, d) => (typeof x === 'number' && isFinite(x)) ? x : d;

  // ---- THE ACTION TABLE -----------------------------------------------------
  // `shape`: centre (ramps toward ±1, returns to 0), latch (a lever), pass
  // (an absolute reading, head tracking). `ctl` names the sim.ctl field, or
  // null for an event app.js consumes. Default keys never use Space, Enter
  // or Escape: those belong to the buttons and the flyouts.
  const ACTIONS = [
    { id: 'pitch', kind: 'axis', ctl: 'de', lo: -1, hi: 1, scale: 1, shape: 'centre',
      label: 'pitch', hint: 'stick back is nose up (+)', group: 'flying',
      keys: { pos: 'ArrowDown', neg: 'ArrowUp' } },
    { id: 'roll', kind: 'axis', ctl: 'da', lo: -1, hi: 1, scale: 1, shape: 'centre',
      label: 'roll', hint: 'stick right rolls right (+)', group: 'flying',
      keys: { pos: 'ArrowRight', neg: 'ArrowLeft' } },
    { id: 'yaw', kind: 'axis', ctl: 'dr', lo: -1, hi: 1, scale: -1, shape: 'centre',
      label: 'yaw', hint: 'right pedal is nose right (+)', group: 'flying',
      keys: { pos: 'Period', neg: 'Comma' } },
    { id: 'throttle', kind: 'axis', ctl: 'thr', lo: 0, hi: 1, scale: 1, shape: 'latch',
      label: 'throttle', hint: 'the pilot’s one lever', group: 'flying',
      keys: { pos: 'PageUp', neg: 'PageDown', max: 'Home', min: 'End' } },
    { id: 'flapDown', kind: 'step', ctl: null, label: 'flaps down', group: 'flying',
      hint: 'one notch', keys: { key: 'KeyF' } },
    { id: 'flapUp', kind: 'step', ctl: null, label: 'flaps up', group: 'flying',
      hint: 'one notch', keys: { key: 'KeyG' } },
    // G2480 (HAND-CONTROLS): a flap LEVER on a controller - the notch nearest the lever, travelling at the
    // aeroplane's own rate as a step's notch does (the detents the pilot's own notches are)
    { id: 'flapLever', kind: 'axis', ctl: 'flap', lo: 0, hi: 1, scale: 1, shape: 'latch',
      label: 'flap lever', hint: 'an axis: the nearest notch', group: 'flying', keys: null },
    // THE BRAKES (G2480). `brake` is both mains alike; the TOE BRAKES are one main each, buttons or axes (the toe
    // axes of a pair of rudder pedals: a Thrustmaster TFRP / T-Rudder). write() puts every source on its own main and
    // hands the solver the pair as it defines it (30_solver, G1938): a main's brake is clamp(brake + side x brakeD,
    // 0, 1), side +1 for the main at +z of the built pose - MEASURED the LEFT main on the Cub, the Jodel and the metal
    // Cessna - so brake = (L + R) / 2, brakeD = (L - R) / 2, exact on both mains, and brakeD 0 when they agree
    { id: 'brake', kind: 'button', ctl: 'brake', label: 'brakes', group: 'ground',
      hint: 'both mains, held; with the brake-steer option the rudder takes the outside one off', ramp: { on: 4, off: 6 },
      keys: { key: 'KeyB' } },
    { id: 'brakeL', kind: 'button', ctl: 'brakeD', side: 1, analog: true, label: 'left toe brake', group: 'ground',
      hint: 'the left main; a pedal\u2019s toe axis binds here', ramp: { on: 4, off: 6 },
      keys: { key: 'BracketLeft' } },
    { id: 'brakeR', kind: 'button', ctl: 'brakeD', side: -1, analog: true, label: 'right toe brake', group: 'ground',
      hint: 'the right main', ramp: { on: 4, off: 6 },
      keys: { key: 'BracketRight' } },
    // the floats' water rudders (32_hydro waterRudder): steered by the pedals, raised and lowered by THE RULE (down
    // below 12 m/s, up at take-off power) unless the hand says - the handle's three places
    { id: 'waterRudder', kind: 'step', ctl: 'wr', label: 'water rudders', group: 'ground',
      hint: 'AUTO · UP · DOWN round (floats only)', keys: { key: 'KeyV' } },
    { id: 'trimUp', kind: 'step', ctl: null, label: 'trim nose up', group: 'trim',
      hint: 'a hand held on the stick; repeats while held', repeat: 0.15,
      keys: { key: 'Numpad1' } },
    { id: 'trimDown', kind: 'step', ctl: null, label: 'trim nose down', group: 'trim',
      hint: 'repeats while held', repeat: 0.15, keys: { key: 'Numpad7' } },
    // G2480: RUDDER AND AILERON TRIM - biases on the pedals and the stick after the merge, exactly as the
    // elevator's (the model has no trim tab on any surface, and says so). The propeller swings the aeroplane since
    // G2080: the Cub's climb wants ~0.14 of right rudder held, and the autopilot holds it as its own trim
    { id: 'trimRudL', kind: 'step', ctl: null, label: 'rudder trim left', group: 'trim',
      hint: 'repeats while held', repeat: 0.15, keys: { key: 'Numpad0' } },
    { id: 'trimRudR', kind: 'step', ctl: null, label: 'rudder trim right', group: 'trim',
      hint: 'against the propeller\u2019s swing on the climb', repeat: 0.15, keys: { key: 'NumpadEnter' } },
    { id: 'trimRollL', kind: 'step', ctl: null, label: 'aileron trim left', group: 'trim',
      hint: 'repeats while held', repeat: 0.15, keys: { key: 'Numpad4' } },
    { id: 'trimRollR', kind: 'step', ctl: null, label: 'aileron trim right', group: 'trim',
      hint: 'repeats while held', repeat: 0.15, keys: { key: 'Numpad6' } },
    { id: 'trimCentre', kind: 'step', ctl: null, label: 'rudder + aileron trim centred', group: 'trim',
      hint: 'the elevator\u2019s stays', keys: { key: 'Numpad5' } },
    // trim WHEELS on a controller: absolute, the last to speak owns the trim (a wheel that moves takes it from the
    // keys, a key steps from where the wheel left it)
    { id: 'trimPitch', kind: 'axis', ctl: null, trim: 'e', lo: -1, hi: 1, scale: 1, shape: 'pass',
      label: 'elevator trim wheel', hint: 'an axis: + nose up, the whole travel is \u00b10.5', group: 'trim', keys: null },
    { id: 'trimYaw', kind: 'axis', ctl: null, trim: 'r', lo: -1, hi: 1, scale: 1, shape: 'pass',
      label: 'rudder trim knob', hint: 'an axis: + right, \u00b10.3', group: 'trim', keys: null },
    { id: 'trimRoll', kind: 'axis', ctl: null, trim: 'a', lo: -1, hi: 1, scale: 1, shape: 'pass',
      label: 'aileron trim knob', hint: 'an axis: + right, \u00b10.2', group: 'trim', keys: null },
    { id: 'apToggle', kind: 'step', ctl: null, label: 'autopilot / by hand', group: 'flight',
      hint: 'hands the aeroplane over, either way', keys: { key: 'KeyA' } },
    { id: 'viewNext', kind: 'step', ctl: null, label: 'next view', group: 'flight',
      hint: 'chase · orbit · cockpit · wing · tower', keys: { key: 'KeyC' } },
    // G442.3 (the user: "all possible dashboard controls should be able to be
    // mapped to joysticks, and they should have default keyboard mappings"):
    // THE DASH. Steps app.js hands to the cockpit (cockpit.js dashAction) -
    // the same writes a click on the panel makes, so the hand on the key and
    // the hand on the dash are one hand. Keys off the head's (Z W S Q D R F)
    // and the flying set's.
    { id: 'lightTaxi', kind: 'step', ctl: null, label: 'taxi light', group: 'dash', hint: 'toggle', keys: { key: 'KeyT' } },
    { id: 'lightLand', kind: 'step', ctl: null, label: 'landing light', group: 'dash', hint: 'toggle', keys: { key: 'KeyL' } },
    { id: 'lightNav', kind: 'step', ctl: null, label: 'nav lights', group: 'dash', hint: 'toggle', keys: { key: 'KeyN' } },
    { id: 'lightBeacon', kind: 'step', ctl: null, label: 'beacon', group: 'dash', hint: 'toggle', keys: { key: 'KeyK' } },
    { id: 'dimInstr', kind: 'step', ctl: null, label: 'instrument lights', group: 'dash', hint: 'a quarter up, round to off', keys: { key: 'KeyI' } },
    { id: 'dimFlood', kind: 'step', ctl: null, label: 'cabin flood', group: 'dash', hint: 'a quarter up, round to off', keys: { key: 'KeyO' } },
    { id: 'master', kind: 'step', ctl: null, label: 'master switch', group: 'dash', hint: 'toggle', keys: { key: 'KeyM' } },
    { id: 'keyNext', kind: 'step', ctl: null, label: 'ignition key · turn', group: 'dash', hint: 'OFF · L · R · BOTH · START', keys: { key: 'KeyJ' } },
    { id: 'keyPrev', kind: 'step', ctl: null, label: 'ignition key · back', group: 'dash', hint: '', keys: { key: 'KeyH' } },
    { id: 'park', kind: 'step', ctl: null, label: 'parking brake', group: 'dash', hint: 'toggle', keys: { key: 'KeyP' } },
    { id: 'fuelSel', kind: 'step', ctl: null, label: 'fuel selector', group: 'dash', hint: 'OFF · R · L · BOTH round', keys: { key: 'KeyU' } },
    // G2480: the rest of the panel the cockpit already models (31_elec's bus, cockpit.js's switches)
    { id: 'alt', kind: 'step', ctl: null, label: 'alternator', group: 'dash', hint: 'toggle (the bus charges with it)', keys: { key: 'KeyE' } },
    { id: 'avionics', kind: 'step', ctl: null, label: 'avionics master', group: 'dash', hint: 'toggle (the radios\u2019 loads)', keys: { key: 'KeyX' } },
    { id: 'dimPedal', kind: 'step', ctl: null, label: 'pedal light', group: 'dash', hint: 'a quarter up, round to off', keys: { key: 'KeyY' } },
    { id: 'eng1', kind: 'axis', ctl: 'eng', idx: 0, lo: 0, hi: 1, scale: 1, shape: 'latch',
      label: 'lever · engine 1', hint: 'inert unless bound', group: 'engines', keys: null },
    { id: 'eng2', kind: 'axis', ctl: 'eng', idx: 1, lo: 0, hi: 1, scale: 1, shape: 'latch',
      label: 'lever · engine 2', hint: 'inert unless bound', group: 'engines', keys: null },
    { id: 'eng3', kind: 'axis', ctl: 'eng', idx: 2, lo: 0, hi: 1, scale: 1, shape: 'latch',
      label: 'lever · engine 3', hint: 'inert unless bound', group: 'engines', keys: null },
    { id: 'eng4', kind: 'axis', ctl: 'eng', idx: 3, lo: 0, hi: 1, scale: 1, shape: 'latch',
      label: 'lever · engine 4', hint: 'inert unless bound', group: 'engines', keys: null },
    // the head, for the tracker that is not wired yet (item 3): six absolute
    // axes app.js will read for the cockpit camera. Bind them and they show
    // on the live bars today; nothing consumes them until the camera does.
    { id: 'headYaw', kind: 'axis', ctl: null, lo: -1, hi: 1, scale: 1, shape: 'pass',
      label: 'head · yaw', hint: 'a tracker as a gamepad', group: 'head', keys: null },
    { id: 'headPitch', kind: 'axis', ctl: null, lo: -1, hi: 1, scale: 1, shape: 'pass',
      label: 'head · pitch', hint: '', group: 'head', keys: null },
    { id: 'headRoll', kind: 'axis', ctl: null, lo: -1, hi: 1, scale: 1, shape: 'pass',
      label: 'head · roll', hint: '', group: 'head', keys: null },
    { id: 'headX', kind: 'axis', ctl: null, lo: -1, hi: 1, scale: 1, shape: 'pass',
      label: 'head · x', hint: '', group: 'head', keys: null },
    { id: 'headY', kind: 'axis', ctl: null, lo: -1, hi: 1, scale: 1, shape: 'pass',
      label: 'head · y', hint: '', group: 'head', keys: null },
    { id: 'headZ', kind: 'axis', ctl: null, lo: -1, hi: 1, scale: 1, shape: 'pass',
      label: 'head · z', hint: '', group: 'head', keys: null },
  ];
  const BY_ID = {};
  for (const a of ACTIONS) BY_ID[a.id] = a;

  // rates, per second of real input time: a centring axis reaches full in
  // 0.4 s and recentres in under 0.2; a lever walks its range in 2 s
  const RATES = { centre: 2.5, release: 6, latch: 0.5 };
  const TRIM_STEP = 0.02, TRIM_MAX = 0.5;
  // G2480: the rudder's and the aileron's, in the PILOT's sense (+ = right pedal / right stick): the Cub's climb
  // holds 0.14 of right rudder against the swirl (G2080), the Cessna floats' roll 0.18 mean
  const TRIM_R_STEP = 0.01, TRIM_R_MAX = 0.30, TRIM_A_STEP = 0.01, TRIM_A_MAX = 0.20;
  // the options a profile carries besides its bindings. brakeSteer: THE BRAKE KEY WITH THE RUDDER HELD brakes the
  // inside main and lets the outside one off in proportion to the pedal (full right pedal + brake = the right main
  // alone) - the keyboard's differential brake most sims offer; off by default, the symmetric brake as before
  const OPTS = { brakeSteer: false };
  const REPEAT_DELAY = 0.4;
  const ACTIVE_FOR = 5;             // seconds an input keeps the stand's sweep off

  const defaults = () => {
    const b = {};
    for (const a of ACTIONS) {
      if (!a.keys) continue;
      b[a.id] = [a.kind === 'axis'
        ? Object.assign({ dev: 'keyboard', type: 'keys' }, a.keys)
        : { dev: 'keyboard', type: 'key', code: a.keys.key }];
    }
    return { v: VERSION, bindings: b, rates: Object.assign({}, RATES), opts: Object.assign({}, OPTS) };
  };
  const DEFAULTS = defaults();

  // ---- pure pieces ----------------------------------------------------------
  // a gamepad axis reading → an action value: deadzone about the rest, the
  // expo curve (monotonic, endpoints kept), then the raw lo..hi span onto the
  // action's lo..hi — which is how a throttle that idles at +1 lands on 0
  function mapBinding(b, raw, act) {
    const lo = fin(b.lo, -1), hi = fin(b.hi, 1);
    if (hi === lo) return act.lo;
    let u = (fin(raw, lo) - lo) / (hi - lo);        // 0..1 across the declared span
    u = clamp(u, 0, 1);
    // centred axes dead-zone about the middle, levers about their idle end
    const dead = clamp(fin(b.dead, 0), 0, 0.5);
    if (act.shape === 'centre' || act.shape === 'pass') {
      let s = u * 2 - 1;
      if (Math.abs(s) < dead) s = 0;
      else s = Math.sign(s) * (Math.abs(s) - dead) / (1 - dead);
      const ex = clamp(fin(b.expo, 0), 0, 1);
      s = (1 - ex) * s + ex * s * s * s;
      s = clamp(s * clamp(fin(b.gain, 1), 0.05, 2), -1, 1);   // G209: sensitivity
      if (b.invert) s = -s;
      u = (s + 1) / 2;
    } else {
      if (u < dead) u = 0; else u = (u - dead) / (1 - dead);
      if (b.invert) u = 1 - u;
    }
    return act.lo + u * (act.hi - act.lo);
  }

  // the listen flow's inference: what did the player just do, against the
  // snapshot taken when they were asked
  const HAT = [-1, -5 / 7, -3 / 7, -1 / 7, 1 / 7, 3 / 7, 5 / 7, 1];
  function inferBinding(base, now, act) {
    // a button, on any device
    for (const dev in now) {
      const b0 = (base[dev] && base[dev].buttons) || [];
      const b1 = now[dev].buttons || [];
      for (let i = 0; i < b1.length; i++)
        if (b1[i] && !b0[i]) return { dev, type: 'button', index: i };
    }
    // an axis that moved more than half its travel
    for (const dev in now) {
      const a0 = (base[dev] && base[dev].axes) || [];
      const a1 = now[dev].axes || [];
      for (let i = 0; i < a1.length; i++) {
        const r0 = fin(a0[i], 0), r1 = fin(a1[i], 0), d = r1 - r0;
        if (Math.abs(d) < 0.5) continue;
        // G2480: an ANALOG button (a toe brake) asked for: the pedal's toe axis is a lever from its rest to the
        // far end, whichever way it runs - bound as an axis, not as a hat position
        if (act.kind !== 'axis' && act.analog) {
          const lo = Math.abs(r0) > 0.5 ? Math.sign(r0) : 0;
          return { dev, type: 'axis', index: i, invert: false, dead: 0.03, expo: 0, gain: 1, lo, hi: Math.sign(d) };
        }
        if (act.kind !== 'axis') {
          // a hat parks at one of eight values; snap to the nearest
          let at = HAT[0];
          for (const h of HAT) if (Math.abs(h - r1) < Math.abs(at - r1)) at = h;
          return { dev, type: 'hat', index: i, at };
        }
        if (act.shape === 'latch') {
          // a lever: rest was `lo`, the far end is `hi`, whichever way it runs
          const lo = Math.abs(r0) > 0.5 ? Math.sign(r0) : 0;
          return { dev, type: 'axis', index: i, invert: false, dead: 0.03,
                   expo: 0, gain: 1, lo, hi: Math.sign(d) };
        }
        // a centred axis asked to move the POSITIVE way: a negative excursion
        // means the device runs the other way round
        return { dev, type: 'axis', index: i, invert: d < 0, dead: 0.04,
                 expo: 0, gain: 1, lo: -1, hi: 1 };
      }
    }
    return null;
  }

  // the profile as stored; garbage becomes the defaults, unknown actions and
  // malformed bindings are dropped, missing fields are filled
  const TYPES = { keys: 1, key: 1, axis: 1, button: 1, hat: 1 };
  function normalise(raw) {
    const out = defaults();
    if (!raw || typeof raw !== 'object' || !raw.bindings || typeof raw.bindings !== 'object')
      return out;
    out.bindings = {};
    for (const id in raw.bindings) {
      const act = BY_ID[id];
      if (!act) continue;
      const list = Array.isArray(raw.bindings[id]) ? raw.bindings[id] : [];
      const ok = [];
      for (const b of list) {
        if (!b || typeof b !== 'object' || !TYPES[b.type] || typeof b.dev !== 'string') continue;
        if (b.type === 'keys') {
          if (act.kind !== 'axis' || typeof b.pos !== 'string' && typeof b.neg !== 'string') continue;
          const n = { dev: 'keyboard', type: 'keys' };
          for (const k of ['pos', 'neg', 'max', 'min']) if (typeof b[k] === 'string') n[k] = b[k];
          ok.push(n);
        } else if (b.type === 'key') {
          if (act.kind === 'axis' || typeof b.code !== 'string') continue;
          ok.push({ dev: 'keyboard', type: 'key', code: b.code });
        } else if (b.type === 'axis') {
          if (!Number.isInteger(b.index) || b.index < 0) continue;
          ok.push({ dev: b.dev, type: 'axis', index: b.index, invert: !!b.invert,
                    dead: clamp(fin(b.dead, 0.04), 0, 0.5), expo: clamp(fin(b.expo, 0), 0, 1),
                    gain: clamp(fin(b.gain, 1), 0.05, 2),
                    lo: clamp(fin(b.lo, -1), -1, 1), hi: clamp(fin(b.hi, 1), -1, 1) });
        } else if (b.type === 'button') {
          if (act.kind === 'axis' || !Number.isInteger(b.index) || b.index < 0) continue;
          ok.push({ dev: b.dev, type: 'button', index: b.index });
        } else if (b.type === 'hat') {
          if (act.kind === 'axis' || !Number.isInteger(b.index) || b.index < 0) continue;
          ok.push({ dev: b.dev, type: 'hat', index: b.index, at: clamp(fin(b.at, 1), -1, 1) });
        }
      }
      // one binding per device per action: the last one written wins
      const seen = {};
      for (let i = ok.length - 1; i >= 0; i--) {
        if (seen[ok[i].dev]) ok.splice(i, 1); else seen[ok[i].dev] = 1;
      }
      out.bindings[id] = ok;
    }
    // G2480: AN ACTION THE STORED PROFILE NEVER HEARD OF (a profile saved before the action existed) takes its
    // default - an action the player unbound is stored as [] and stays unbound. A default key the stored profile
    // already gives to another action is left off: the player's binding wins, nothing fires twice
    const used = {};
    for (const id in out.bindings) for (const b of out.bindings[id]) {
      if (b.type === 'key') used[b.code] = 1;
      if (b.type === 'keys') for (const k of ['pos', 'neg', 'max', 'min']) if (b[k]) used[b[k]] = 1;
    }
    for (const a of ACTIONS) {
      if (out.bindings[a.id] || !a.keys) continue;
      const codes = Object.keys(a.keys).map(k => a.keys[k]);
      if (codes.some(c => used[c])) { out.bindings[a.id] = []; continue; }
      out.bindings[a.id] = [a.kind === 'axis' ? Object.assign({ dev: 'keyboard', type: 'keys' }, a.keys)
                                              : { dev: 'keyboard', type: 'key', code: a.keys.key }];
      for (const c of codes) used[c] = 1;
    }
    if (raw.rates && typeof raw.rates === 'object')
      for (const k in RATES) out.rates[k] = clamp(fin(raw.rates[k], RATES[k]), 0.05, 50);
    if (raw.opts && typeof raw.opts === 'object')
      for (const k in OPTS) if (typeof raw.opts[k] === typeof OPTS[k]) out.opts[k] = raw.opts[k];
    return out;
  }

  // two identical sticks are '#0' and '#1', in the order the browser lists them
  function deviceKeys(pads) {
    const count = {}, keys = [];
    for (const p of pads || []) {
      if (!p || typeof p.id !== 'string') { keys.push(null); continue; }
      const n = count[p.id] = (count[p.id] || 0);
      count[p.id]++;
      keys.push(p.id + '#' + n);
    }
    return keys;
  }

  // a key code as a human reads it, for the chips
  function keyLabel(code) {
    if (!code) return '—';
    const M = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
                Period: '.', Comma: ',', Slash: '/', Semicolon: ';', Quote: "'",
                BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '-',
                Equal: '=', Backquote: '`', Space: 'space', Enter: 'enter',
                Escape: 'esc', Tab: 'tab', Backspace: 'bksp', Delete: 'del',
                Insert: 'ins', Home: 'home', End: 'end', PageUp: 'pg up',
                PageDown: 'pg dn', ShiftLeft: 'l shift', ShiftRight: 'r shift',
                ControlLeft: 'l ctrl', ControlRight: 'r ctrl', AltLeft: 'l alt',
                AltRight: 'r alt', CapsLock: 'caps', NumpadAdd: 'num +',
                NumpadSubtract: 'num -', NumpadMultiply: 'num *',
                NumpadDivide: 'num /', NumpadEnter: 'num enter',
                NumpadDecimal: 'num .' };
    if (M[code]) return M[code];
    let m;
    if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
    if ((m = /^Digit(\d)$/.exec(code))) return m[1];
    if ((m = /^Numpad(\d)$/.exec(code))) return 'num ' + m[1];
    if ((m = /^F(\d+)$/.exec(code))) return 'F' + m[1];
    return code;
  }

  // ---- the live instance ----------------------------------------------------
  function make(opts) {
    const O = opts || {};
    const win = O.win || null, nav = O.nav || null;
    const store = O.store || (win && (() => { try { return win.localStorage; } catch (e) { return null; } })());
    let profile = null;
    let boundCodes = {};           // code → true, for preventDefault
    const held = {};               // code → true while down
    const heldSince = {};          // code → t of the press
    const repeatAt = {};           // action id → next repeat time
    let t = 0;                     // input time, advanced by update(dt)
    let touchedAt = -1e9;
    let listening = null;
    let onChange = null;

    // per-action shaping state
    const S = {};
    for (const a of ACTIONS) S[a.id] = { kb: 0, out: a.kind === 'axis' ? (a.shape === 'latch' ? a.lo : 0) : 0,
                                          owner: null, last: {}, fired: false, edge: {}, ramp: 0, moved: false };
    let trim = 0, trimR = 0, trimA = 0;     // G2480: the rudder's and the aileron's (+ = right)
    let notches = [0], flapI = 0, flapOut = 0, flapRate = 0.15;
    let nEng = 1;
    let wr = null;                          // G2480: the water rudders - null THE RULE (32_hydro), 0 up, 1 down
    let parkFn = null;                      // G2480: the parking brake's owner (cockpit.js CK.park), read in write()
    let padsNow = [], keysNow = [], rawNow = {};
    let firedNow = [];
    // G318: a step fired by the cockpit's own click (the flap lever), consumed
    // by the next update exactly as a bound key's edge is
    const fireQ = [];

    const rebind = () => {
      boundCodes = {};
      for (const id in profile.bindings)
        for (const b of profile.bindings[id]) {
          if (b.type === 'keys') for (const k of ['pos', 'neg', 'max', 'min']) if (b[k]) boundCodes[b[k]] = true;
          if (b.type === 'key') boundCodes[b.code] = true;
        }
    };
    const save = () => {
      try { if (store) store.setItem(PREF, JSON.stringify(profile)); } catch (e) {}
      rebind();
      if (onChange) { try { onChange(); } catch (e) {} }
    };
    const load = () => {
      let raw = null;
      try { raw = store ? JSON.parse(store.getItem(PREF) || 'null') : null; } catch (e) { raw = null; }
      profile = normalise(raw);
      rebind();
    };
    load();

    // ---- the keyboard ---------------------------------------------------
    // returns whether the code is bound, so the listener can preventDefault
    // exactly the keys it owns (arrows scroll a page; PageUp pages one)
    function press(code, down) {
      if (typeof code !== 'string') return false;
      if (down) {
        if (listening && listening.want !== 'gamepad') {
          bindKey(listening, code);
          return true;
        }
        if (!held[code]) { held[code] = true; heldSince[code] = t; touchedAt = t; }
      } else {
        delete held[code]; delete heldSince[code];
      }
      return !!boundCodes[code];
    }
    function releaseAll() { for (const k in held) delete held[k]; }
    if (win && typeof win.addEventListener === 'function') {
      const guard = e => {
        if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return true;
        const tg = e.target;
        if (tg && typeof tg.closest === 'function' &&
            tg.closest('input, select, textarea, [contenteditable]')) return true;
        return false;
      };
      win.addEventListener('keydown', e => {
        if (guard(e)) return;
        if (e.repeat) { if (boundCodes[e.code]) e.preventDefault(); return; }
        if (press(e.code, true)) e.preventDefault();
      });
      win.addEventListener('keyup', e => {
        if (e.isComposing) return;
        if (press(e.code, false)) e.preventDefault();
      });
      win.addEventListener('blur', releaseAll);
    }

    // ---- gamepads -------------------------------------------------------
    function poll(snap) {
      let pads = snap;
      if (!pads) {
        pads = [];
        try {
          if (nav && typeof nav.getGamepads === 'function') {
            const g = nav.getGamepads();
            if (g) for (let i = 0; i < g.length; i++) pads.push(g[i] || null);
          }
        } catch (e) { pads = []; }
      }
      padsNow = pads;
      keysNow = deviceKeys(pads);
      const raw = {};
      for (let i = 0; i < pads.length; i++) {
        const p = pads[i], k = keysNow[i];
        if (!p || !k) continue;
        const axes = [], buttons = [];
        const A = p.axes || [], B = p.buttons || [];
        for (let j = 0; j < A.length; j++) axes.push(fin(+A[j], 0));
        for (let j = 0; j < B.length; j++) {
          const b = B[j];
          buttons.push(typeof b === 'object' && b ? (b.pressed || fin(b.value, 0) > 0.5) : !!b);
        }
        raw[k] = { axes, buttons };
      }
      rawNow = raw;
    }
    const rawAxis = (dev, i) => { const r = rawNow[dev]; return r && r.axes ? fin(r.axes[i], 0) : null; };
    const rawBtn = (dev, i) => { const r = rawNow[dev]; return r && r.buttons ? !!r.buttons[i] : null; };

    // ---- listen ---------------------------------------------------------
    // listen(actionId, { want:'key'|'gamepad'|'any', slot }) — slot names the
    // keyboard key an axis is asking for (pos/neg/max/min); a gamepad axis or
    // button needs no slot. Escape (the panel) cancels.
    function listen(id, o, cb) {
      const act = BY_ID[id];
      if (!act) return false;
      // the baseline is the FIRST poll after the ask, not a poll taken now:
      // a lever that rests at +1 must read as at rest, not as an excursion
      listening = { id, act, want: (o && o.want) || 'any', slot: (o && o.slot) || null,
                    base: null, cb: cb || null, t0: t };
      return true;
    }
    function cancelListen() { listening = null; }
    function bindKey(L, code) {
      const act = L.act;
      const list = profile.bindings[act.id] || (profile.bindings[act.id] = []);
      let b = list.find(x => x.dev === 'keyboard');
      if (act.kind === 'axis') {
        if (!b) { b = { dev: 'keyboard', type: 'keys' }; list.push(b); }
        b[L.slot || 'pos'] = code;
      } else {
        if (!b) { b = { dev: 'keyboard', type: 'key', code }; list.push(b); }
        else b.code = code;
      }
      finishListen(b);
    }
    function finishListen(b) {
      const L = listening; listening = null;
      save();
      if (L && L.cb) { try { L.cb(b); } catch (e) {} }
    }
    function listenTick() {
      const L = listening;
      if (!L || L.want === 'key') return;
      if (L.base === null) { L.base = JSON.parse(JSON.stringify(rawNow)); return; }
      const b = inferBinding(L.base, rawNow, L.act);
      if (!b) return;
      const list = profile.bindings[L.act.id] || (profile.bindings[L.act.id] = []);
      const i = list.findIndex(x => x.dev === b.dev);
      if (i >= 0) list[i] = b; else list.push(b);
      claim(L.act.id, b);
      finishListen(b);
    }

    // a binding just made or just tuned is READ AT ONCE — the device it
    // names owns the action from this frame, or a lever bound at full would
    // sit at idle until it moved again
    function claim(id, b) {
      const s = S[id];
      if (!s || !b || b.type !== 'axis') return;
      s.owner = b.dev; s.last = {};
    }

    // ---- profile doors --------------------------------------------------
    function unbind(id, dev) {
      const list = profile.bindings[id];
      if (!list) return;
      const i = list.findIndex(x => x.dev === dev);
      if (i >= 0) list.splice(i, 1);
      save();
    }
    function setBinding(id, b) {
      const n = normalise({ bindings: { [id]: [b] } }).bindings[id];
      if (!n || !n.length) return false;
      const list = profile.bindings[id] || (profile.bindings[id] = []);
      const i = list.findIndex(x => x.dev === n[0].dev);
      if (i >= 0) list[i] = n[0]; else list.push(n[0]);
      claim(id, n[0]);
      save();
      return true;
    }
    function setProfile(p) { profile = normalise(p); save(); }
    function resetDefaults() { profile = defaults(); save(); }
    const exportJSON = () => JSON.stringify(profile, null, 1);
    function importJSON(s) {
      let raw = null;
      try { raw = JSON.parse(s); } catch (e) { return false; }
      if (!raw || typeof raw !== 'object') return false;
      setProfile(raw);
      return true;
    }

    // ---- the aeroplane's own facts ---------------------------------------
    // flaps notch from def.params.flaps (to/ldg/rate); engines count
    function aircraft(a) {
      const FS = a && a.flaps;
      if (FS) {
        const set = [0, clamp(fin(FS.to, 0), 0, 1), clamp(fin(FS.ldg, 1), 0, 1), 1];
        notches = Array.from(new Set(set.map(x => +x.toFixed(3)))).sort((p, q) => p - q);
        flapRate = fin(FS.rate, 0.15) || 0.15;
      } else notches = [0];
      flapI = 0; flapOut = 0;
      nEng = Math.max(1, fin(a && a.nEngines, 1) | 0);
    }

    // ---- seed: take the aeroplane as it is (the AP→manual handoff) --------
    // G2480: o.air - the aeroplane is flying: the pilot's rudder and aileron are carried as THEIR trims too
    // (bumpless, as the elevator always was: the Cub's climb holds 0.14 of right rudder against the swirl, and a
    // keyboard's pedals centre). On the ground they start centred - a taxi's steering is not a trim - so nothing
    // the autopilot held on the ground stays on the player's pedals; the parking of the toe brakes and the water
    // rudders' handle start where the hand has nothing on them (no brake, THE RULE)
    function seed(ctl, o) {
      const c = ctl || {};
      trim = clamp(fin(c.de, 0), -TRIM_MAX, TRIM_MAX);
      const air = !!(o && o.air);
      trimR = air ? clamp(-fin(c.dr, 0), -TRIM_R_MAX, TRIM_R_MAX) : 0;   // (dr > 0 is nose LEFT: the pilot's right is -dr)
      trimA = air ? clamp(fin(c.da, 0), -TRIM_A_MAX, TRIM_A_MAX) : 0;
      wr = null;
      for (const a of ACTIONS) {
        const s = S[a.id];
        s.owner = null; s.last = {};
        if (a.kind !== 'axis') { s.kb = 0; s.out = 0; continue; }
        if (a.shape === 'latch') {
          const v = a.ctl === 'thr' ? clamp(fin(c.thr, 0), 0, 1)
                  : a.ctl === 'eng' ? clamp(fin(c.eng && c.eng[a.idx] && c.eng[a.idx].thr, 1), 0, 1) : a.lo;
          s.kb = v; s.out = v;
        } else { s.kb = 0; s.out = 0; }
      }
      const f = clamp(fin(c.flap, 0), 0, 1);
      let best = 0;
      for (let i = 0; i < notches.length; i++)
        if (Math.abs(notches[i] - f) < Math.abs(notches[best] - f)) best = i;
      flapI = best; flapOut = f;
      for (const a of ACTIONS) S[a.id].ramp = 0;
    }

    // ---- update: one frame of input time -----------------------------------
    function update(dt, snap) {
      dt = clamp(fin(dt, 1 / 60), 0, 0.25);
      t += dt;
      firedNow = [];
      poll(snap);
      listenTick();
      const R = profile.rates;
      let anyPad = false;
      for (const a of ACTIONS) {
        const s = S[a.id];
        const list = profile.bindings[a.id] || [];
        if (a.kind === 'axis') {
          // keyboard: shaped; gamepad: absolute; THE LAST TO SPEAK OWNS IT —
          // a stick that moved this frame, else a key that is held, else
          // whoever owned it (a still stick holds its reading; a released
          // key centres or latches). A device seen for the first time only
          // records itself: a throttle that idles at +1 must not pull the
          // lever to idle the moment it is plugged in.
          let kbBind = null, padMoved = false, padVal = null, padDev = null, padOwn = null, kbTouch = false;
          for (const b of list) {
            if (b.type === 'keys') { kbBind = b; continue; }
            if (b.type !== 'axis') continue;
            const r = rawAxis(b.dev, b.index);
            if (r === null) continue;
            const v = mapBinding(b, r, a);
            const prev = s.last[b.dev];
            s.last[b.dev] = v;
            if (prev !== undefined && Math.abs(v - prev) > 0.02) { padMoved = true; padVal = v; padDev = b.dev; }
            if (s.owner === b.dev) padOwn = v;
          }
          if (kbBind) {
            const pos = !!(kbBind.pos && held[kbBind.pos]), neg = !!(kbBind.neg && held[kbBind.neg]);
            const mx = !!(kbBind.max && held[kbBind.max]), mn = !!(kbBind.min && held[kbBind.min]);
            kbTouch = pos || neg || mx || mn;
            if (a.shape === 'centre') {
              const want = pos === neg ? 0 : (pos ? 1 : -1);
              const rate = want === 0 ? R.release : R.centre;
              s.kb += clamp(want - s.kb, -rate * dt, rate * dt);
            } else if (a.shape === 'latch') {
              if (kbTouch && s.owner !== 'keyboard') s.kb = s.out;   // step from where it is
              if (mx) s.kb = a.hi; else if (mn) s.kb = a.lo;
              else if (pos !== neg) s.kb = clamp(s.kb + (pos ? 1 : -1) * R.latch * (a.hi - a.lo) * dt, a.lo, a.hi);
            }
          }
          s.moved = padMoved;
          if (padMoved) { s.owner = padDev; s.out = padVal; touchedAt = t; anyPad = true; }
          else if (kbTouch) { s.owner = 'keyboard'; s.out = s.kb; touchedAt = t; }
          else if (padOwn !== null) s.out = padOwn;
          else if (kbBind) s.out = s.kb;      // a released key centres; a lever holds
          s.out = clamp(fin(s.out, a.lo), a.lo, a.hi);
        } else {
          // button / step: any digital source pressed; an axis on a button
          // reads as analog (toe brakes); a step fires on the edge
          let digital = false, analog = 0;
          for (const b of list) {
            let on = false;
            if (b.type === 'key') on = !!held[b.code];
            else if (b.type === 'button') on = !!rawBtn(b.dev, b.index);
            else if (b.type === 'hat') { const r = rawAxis(b.dev, b.index); on = r !== null && Math.abs(r - b.at) < 0.1; }
            else if (b.type === 'axis') {
              const r = rawAxis(b.dev, b.index);
              if (r !== null) { const v = mapBinding(b, r, { lo: 0, hi: 1, shape: 'latch' }); analog = Math.max(analog, v); }
            }
            if (on) digital = true;
          }
          if (a.kind === 'button') {
            // (G2480: the ramp is each button's own - the toe brakes ramp apart from the pair)
            const ramp = a.ramp || { on: 4, off: 6 };
            s.ramp = digital ? Math.min(1, s.ramp + ramp.on * dt) : Math.max(0, s.ramp - ramp.off * dt);
            const out = Math.max(s.ramp, analog);
            if (digital || analog > 0.05) touchedAt = t;
            s.out = out;
          } else {
            const was = s.fired;
            s.fired = digital;
            if (digital && !was) { firedNow.push(a.id); repeatAt[a.id] = t + REPEAT_DELAY; touchedAt = t; }
            else if (digital && a.repeat && t >= repeatAt[a.id]) { firedNow.push(a.id); repeatAt[a.id] = t + a.repeat; }
          }
        }
      }
      while (fireQ.length) { const id = fireQ.shift(); if (ACTIONS.some(a => a.id === id)) { firedNow.push(id); touchedAt = t; } }
      // the steps this module consumes itself
      for (const id of firedNow) {
        if (id === 'trimUp') trim = clamp(trim + TRIM_STEP, -TRIM_MAX, TRIM_MAX);
        else if (id === 'trimDown') trim = clamp(trim - TRIM_STEP, -TRIM_MAX, TRIM_MAX);
        else if (id === 'trimRudR') trimR = clamp(trimR + TRIM_R_STEP, -TRIM_R_MAX, TRIM_R_MAX);
        else if (id === 'trimRudL') trimR = clamp(trimR - TRIM_R_STEP, -TRIM_R_MAX, TRIM_R_MAX);
        else if (id === 'trimRollR') trimA = clamp(trimA + TRIM_A_STEP, -TRIM_A_MAX, TRIM_A_MAX);
        else if (id === 'trimRollL') trimA = clamp(trimA - TRIM_A_STEP, -TRIM_A_MAX, TRIM_A_MAX);
        else if (id === 'trimCentre') { trimR = 0; trimA = 0; }
        else if (id === 'waterRudder') wr = wr === null ? 0 : wr === 0 ? 1 : null;   // AUTO -> UP -> DOWN -> AUTO
        else if (id === 'flapDown') flapI = Math.min(notches.length - 1, flapI + 1);
        else if (id === 'flapUp') flapI = Math.max(0, flapI - 1);
      }
      // G2480: a trim wheel or knob that MOVED this frame sets its trim (the steps step from there); a flap lever
      // that moved picks the nearest notch (the steps walk on from it)
      if (S.trimPitch.moved) trim = clamp(S.trimPitch.out * TRIM_MAX, -TRIM_MAX, TRIM_MAX);
      if (S.trimYaw.moved) trimR = clamp(S.trimYaw.out * TRIM_R_MAX, -TRIM_R_MAX, TRIM_R_MAX);
      if (S.trimRoll.moved) trimA = clamp(S.trimRoll.out * TRIM_A_MAX, -TRIM_A_MAX, TRIM_A_MAX);
      if (S.flapLever.moved) {
        const v = S.flapLever.out; let best = 0;
        for (let i = 0; i < notches.length; i++) if (Math.abs(notches[i] - v) < Math.abs(notches[best] - v)) best = i;
        flapI = best;
      }
      // flaps travel over seconds (the AP's own rate), never jump
      const ft = notches[flapI] || 0;
      flapOut += clamp(ft - flapOut, -flapRate * dt, flapRate * dt);
      const axes = {};
      for (const a of ACTIONS) if (a.kind === 'axis') axes[a.id] = S[a.id].out;
      return { axes, fired: firedNow.slice(), active: t - touchedAt < ACTIVE_FOR, pads: anyPad };
    }

    // ---- write: the one door into the aeroplane -----------------------------
    function write(ctl) {
      if (!ctl) return;
      ctl.de = clamp(fin(S.pitch.out, 0) + trim, -1, 1);
      ctl.da = clamp(fin(S.roll.out, 0) + trimA, -1, 1);
      ctl.dr = clamp((fin(S.yaw.out, 0) + trimR) * BY_ID.yaw.scale, -1, 1);
      ctl.thr = clamp(fin(S.throttle.out, 0), 0, 1);
      // G2480: THE BRAKES, PER MAIN. The pair's brake on both (with the brake-steer option the pedal takes the
      // outside main off: full right pedal leaves the right main alone), each toe brake on its own main, the parking
      // brake under all of them; then the solver's pair: brake = (L + R) / 2, brakeD = (L - R) / 2 (30_solver: a
      // main's brake is clamp(brake + side x brakeD, 0, 1), side +1 the LEFT main) - exact on each main, and brakeD
      // 0 whenever the mains agree, which is the symmetric brake to the bit
      const sym = clamp(fin(S.brake.out, 0), 0, 1), y = clamp(fin(S.yaw.out, 0), -1, 1);
      let bL = sym, bR = sym;
      if (profile.opts && profile.opts.brakeSteer) { bL = sym * (1 - Math.max(0, y)); bR = sym * (1 - Math.max(0, -y)); }
      bL = Math.max(bL, clamp(fin(S.brakeL.out, 0), 0, 1));
      bR = Math.max(bR, clamp(fin(S.brakeR.out, 0), 0, 1));
      if (parkFn) { let pk = false; try { pk = !!parkFn(); } catch (e) {} if (pk) { bL = 1; bR = 1; } }
      ctl.brake = bL === bR ? bL : (bL + bR) / 2;
      ctl.brakeD = bL === bR ? 0 : (bL - bR) / 2;
      ctl.wr = wr;
      ctl.flap = clamp(fin(flapOut, 0), 0, 1);
      if (Array.isArray(ctl.eng))
        for (let i = 0; i < ctl.eng.length && i < 4; i++) {
          const id = 'eng' + (i + 1);
          const list = profile.bindings[id] || [];
          if (!list.length || !ctl.eng[i]) continue;      // inert unless bound
          ctl.eng[i].thr = clamp(fin(S[id].out, 1), 0, 1);
        }
    }

    // ---- readers ------------------------------------------------------------
    const devices = () => {
      const out = [{ key: 'keyboard', label: 'keyboard', kind: 'keyboard' }];
      for (let i = 0; i < padsNow.length; i++) {
        const p = padsNow[i], k = keysNow[i];
        if (!p || !k) continue;
        out.push({ key: k, label: String(p.id).replace(/\s*\(.*$/, '') + (k.endsWith('#0') ? '' : ' ' + k.slice(k.lastIndexOf('#'))),
                   id: p.id, kind: 'gamepad', axes: (p.axes || []).length, buttons: (p.buttons || []).length });
      }
      return out;
    };
    const state = () => {
      const act = {};
      for (const a of ACTIONS) act[a.id] = { value: S[a.id].out, owner: S[a.id].owner, fired: S[a.id].fired };
      return { actions: act, raw: rawNow, trim, trimR, trimA, wr, opts: Object.assign({}, profile.opts), flapI, flapOut, notches, held: Object.keys(held),
               listening: listening ? { id: listening.id, want: listening.want, slot: listening.slot } : null,
               t };
    };
    const bound = id => (profile.bindings[id] || []).slice();
    const isBound = id => !!(profile.bindings[id] && profile.bindings[id].length);

    return {
      ACTIONS, PREF, VERSION,
      press, releaseAll, update, write, seed, aircraft,
      listen, cancelListen, listening: () => listening ? listening.id : null,
      unbind, setBinding, bound, isBound, profile: () => JSON.parse(JSON.stringify(profile)),
      setProfile, resetDefaults, exportJSON, importJSON,
      devices, state, active: () => t - touchedAt < ACTIVE_FOR,
      trim: () => trim, setTrim: v => { trim = clamp(fin(v, 0), -TRIM_MAX, TRIM_MAX); },
      // G2480: the rudder's and the aileron's trims (+ = right), the water rudders' handle, the options, the park
      trims: () => ({ e: trim, r: trimR, a: trimA }),
      setTrims: o => { if (!o) return; if (o.e != null) trim = clamp(fin(o.e, 0), -TRIM_MAX, TRIM_MAX);
                       if (o.r != null) trimR = clamp(fin(o.r, 0), -TRIM_R_MAX, TRIM_R_MAX);
                       if (o.a != null) trimA = clamp(fin(o.a, 0), -TRIM_A_MAX, TRIM_A_MAX); },
      waterRudder: () => wr,
      opt: k => profile.opts ? profile.opts[k] : undefined,
      setOpt: (k, v) => { if (!(k in OPTS) || typeof v !== typeof OPTS[k]) return false; profile.opts[k] = v; save(); return true; },
      parkFrom: f => { parkFn = typeof f === 'function' ? f : null; },
      // G364: the cockpit's own hand on a lever (the throttle dragged in the
      // 3D cockpit): the axis takes the value and the mouse owns it until a
      // device or a key speaks — a latch, like a key's own step
      axis: id => S[id] ? S[id].out : 0,
      setAxis: (id, v) => { const a = BY_ID[id], s = S[id]; if (!a || !s || a.kind !== 'axis') return;
                            s.kb = s.out = clamp(fin(v, a.lo), a.lo, a.hi); s.owner = 'mouse'; touchedAt = t; },
      fire: id => { fireQ.push(String(id)); },       // G318
      onChange: f => { onChange = typeof f === 'function' ? f : null; },
      keyLabel,
    };
  }

  const API = { ACTIONS, DEFAULTS, PREF, VERSION, RATES, OPTS,
                TRIM: { e: TRIM_MAX, r: TRIM_R_MAX, a: TRIM_A_MAX },
                mapBinding, inferBinding, normalise, deviceKeys, keyLabel, make };
  if (typeof window !== 'undefined') window.FLYDIY_INPUT_API = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
