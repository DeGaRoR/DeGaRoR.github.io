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
//   { dev, type:'axis', index, invert, dead, expo, lo, hi } a gamepad axis
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
    { id: 'brake', kind: 'button', ctl: 'brake', label: 'brakes', group: 'flying',
      hint: 'held; an axis works as toe brakes', ramp: { on: 4, off: 6 },
      keys: { key: 'KeyB' } },
    { id: 'flapDown', kind: 'step', ctl: null, label: 'flaps down', group: 'flying',
      hint: 'one notch', keys: { key: 'KeyF' } },
    { id: 'flapUp', kind: 'step', ctl: null, label: 'flaps up', group: 'flying',
      hint: 'one notch', keys: { key: 'KeyG' } },
    { id: 'trimUp', kind: 'step', ctl: null, label: 'trim nose up', group: 'flying',
      hint: 'a hand held on the stick; repeats while held', repeat: 0.15,
      keys: { key: 'Numpad1' } },
    { id: 'trimDown', kind: 'step', ctl: null, label: 'trim nose down', group: 'flying',
      hint: 'repeats while held', repeat: 0.15, keys: { key: 'Numpad7' } },
    { id: 'apToggle', kind: 'step', ctl: null, label: 'autopilot / by hand', group: 'flight',
      hint: 'hands the aeroplane over, either way', keys: { key: 'KeyA' } },
    { id: 'viewNext', kind: 'step', ctl: null, label: 'next view', group: 'flight',
      hint: 'chase · orbit · cockpit · wing · tower', keys: { key: 'KeyC' } },
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
    return { v: VERSION, bindings: b, rates: Object.assign({}, RATES) };
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
                   expo: 0, lo, hi: Math.sign(d) };
        }
        // a centred axis asked to move the POSITIVE way: a negative excursion
        // means the device runs the other way round
        return { dev, type: 'axis', index: i, invert: d < 0, dead: 0.04,
                 expo: 0, lo: -1, hi: 1 };
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
    if (raw.rates && typeof raw.rates === 'object')
      for (const k in RATES) out.rates[k] = clamp(fin(raw.rates[k], RATES[k]), 0.05, 50);
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
                                          owner: null, last: {}, fired: false, edge: {} };
    let trim = 0;
    let notches = [0], flapI = 0, flapOut = 0, flapRate = 0.15;
    let nEng = 1;
    let brakeRamp = 0;
    let padsNow = [], keysNow = [], rawNow = {};
    let firedNow = [];

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
    function seed(ctl) {
      const c = ctl || {};
      trim = clamp(fin(c.de, 0), -TRIM_MAX, TRIM_MAX);
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
      brakeRamp = 0;
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
            const ramp = a.ramp || { on: 4, off: 6 };
            brakeRamp = digital ? Math.min(1, brakeRamp + ramp.on * dt) : Math.max(0, brakeRamp - ramp.off * dt);
            const out = Math.max(brakeRamp, analog);
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
      // the steps this module consumes itself
      for (const id of firedNow) {
        if (id === 'trimUp') trim = clamp(trim + TRIM_STEP, -TRIM_MAX, TRIM_MAX);
        else if (id === 'trimDown') trim = clamp(trim - TRIM_STEP, -TRIM_MAX, TRIM_MAX);
        else if (id === 'flapDown') flapI = Math.min(notches.length - 1, flapI + 1);
        else if (id === 'flapUp') flapI = Math.max(0, flapI - 1);
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
      ctl.da = clamp(fin(S.roll.out, 0), -1, 1);
      ctl.dr = clamp(fin(S.yaw.out, 0) * BY_ID.yaw.scale, -1, 1);
      ctl.thr = clamp(fin(S.throttle.out, 0), 0, 1);
      ctl.brake = clamp(fin(S.brake.out, 0), 0, 1);
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
      return { actions: act, raw: rawNow, trim, flapI, flapOut, notches, held: Object.keys(held),
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
      onChange: f => { onChange = typeof f === 'function' ? f : null; },
      keyLabel,
    };
  }

  const API = { ACTIONS, DEFAULTS, PREF, VERSION, RATES,
                mapBinding, inferBinding, normalise, deviceKeys, keyLabel, make };
  if (typeof window !== 'undefined') window.FLYDIY_INPUT_API = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
