// boot.js - THE LOADING SCREEN'S BRAIN (LOADING chantier S1, 2026-09-14)
//
// Evaluated ~100 ms into the page, right after the #boot markup and BEFORE
// the vendor / core / editor / viewer blocks (build.js puts it in the BOOT
// slot of body.html). No THREE, no DOM beyond the #boot* ids. window.BOOT is:
//
//   phase(id, label, frac)   the line under the brand + the bar; frac optional
//   run(steps, opt)          steps [{id, label, w, fn}] run ONE PER TASK: fn()
//                            in try/catch (a throw is logged into the note and
//                            the chain goes on - a boot must never be fatal),
//                            then setTimeout(next, 0). opt {set, require, done,
//                            idle, hard}. When the last step ran, state is
//                            'landing' and ready() decides.
//   expect(key, n)           the aggregator: key expects n more landings
//   landed(key, ok, what)    one landing (ok=false: listed as failed - a
//                            failed fetch counts as landed, it will never
//                            arrive); re-arms the idle watchdog
//   img(img, key)            expect + landed on the image's load/error, or
//                            now if it is already complete
//   frame()                  the loop reports a rendered frame - frames under
//                            the overlay are where the shaders compile
//   ready()                  steps done && every REQUIRED key balanced &&
//                            three quiet frames -> hide()
//   fail(reason)             the watchdog's path: the note says what never
//                            landed, then hide()
//   show(set, opt) / hide()  the overlay for a second use (the roll-out)
//   shaders(done, total, warm)  the shaders' block (G567): a cold compile explained,
//                            its bar done/total; shaders(null) hides it. Pending
//                            programs re-arm the watchdogs: a compile is alive
//   whenReady()              a Promise resolved on hide; window.FLYDIY_READY
//                            is the current set's - the rigs wait on it
//   log[]                    every event with its ms - tools/boot_perf.js
//   sub(frac)                G640: the current step's own progress (0..1, only ever
//                            raises it) - the shader compile's linked/seen count
//   card(dir)                G640: the carousel one card on (+1) or back (-1)
//   hold() / go(lift)        B8 (G1025): THE SETUP SCREEN'S HOLD. hold() - the player
//                            touched an option on the loading screen: the load
//                            finishes and the overlay WAITS (state 'waiting', the
//                            bar full, onWait() called) instead of lifting;
//                            go() lifts it (go(false): released, the caller runs
//                            another chain first). show() and hide() clear it.
//
// G640 - THE BAR IS THE CLOCK'S, AND THE WAIT HAS SOMETHING TO READ (the 2026-09-26
// playtest: "progress bars for every loading screen ... tell them what happens,
// but also cool things about the game, or more advanced techniques ... make
// loading time relatively fun"):
// - THE WEIGHTS ARE MEASURED. Every set's steps are timed and kept in
//   localStorage (flydiy.boot.ms, per set + step list, halved toward the last
//   run); a step's share of the bar is its expected ms (the app's `w` x 150 ms
//   before this browser has timed it). The garage boot's bar starts with the
//   scripts' own share (T0 to run()), and every set ends with a LANDING share
//   (the last assets, the quiet frames) so the bar is never full while it waits.
// - INSIDE A STEP the bar creeps on the expected time (0.92 of the step at most,
//   never stuck, never past it) or on the step's own count (phase(id, label,
//   frac), sub(frac)) when that is ahead. MONOTONIC by construction: the drawn
//   position is computed from the running transition and the next target is
//   never below it.
// - THE COMPOSITOR MOVES IT. The fill is a scaleX transform with a transition
//   aimed where the estimate will be a few seconds on: a step that blocks the
//   main thread (the workshop's boot, a world build) still sees the bar move.
// - #bootWhy says what the step is in plain words (WHY below), the cold / warm
//   compile told apart by the shaders' own warm key.
// - THE CAROUSEL (#bootCard): window.BOOT_CARDS (boot_cards.js, data only)
//   interleaved with the set's pictures (a picture item crossfades the
//   background and its card is the caption); a timer on the card's length,
//   prev / next by hand (a hand's card stays twice as long), the pointer over
//   the card holds it. Only the first picture is fetched with the page; the
//   next one is fetched one turn ahead. The deck's place is kept across loads
//   (flydiy.boot.deck), so a player reads new cards each time. All of it is a
//   few textContent writes every ~10 s while the overlay is up, and nothing
//   once it is gone.
//
// WHY SETTIMEOUT AND NEVER AWAIT / rAF. GATE UISMOKE runs app.js in a vm with
// a setTimeout that fires IMMEDIATELY and a requestAnimationFrame that only
// stores its callback: a chain of setTimeout(next, 0) runs to completion
// synchronously there (the whole boot inside app.js's eval, as before), and
// one step per task in the browser, where fetch promises resolve between
// the steps and the overlay repaints. Every timer here (the watchdogs, the
// picture rotation) checks the elapsed time and does nothing when it fires
// early, and never re-arms itself - events re-arm - so the immediate stub
// cannot recurse.
(function () {
  'use strict';
  const T0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  const now = () => ((typeof performance !== 'undefined' && performance.now) ? performance.now() : T0);
  const doc = typeof document !== 'undefined' ? document : null;
  const $ = id => (doc && doc.getElementById) ? doc.getElementById(id) : null;
  const HAS_UI = !!($('boot') && $('bootPhase'));
  const hasTimer = typeof setTimeout === 'function';

  const B = {
    t0: T0, state: 'loading', set: 'garage', log: [], current: null,
    steps: [], stepI: 0, weights: 0, doneW: 0, frac: 0,
    keys: {}, required: [], quiet: 0, lastEvent: T0, opt: {}, failed: [],
    _readyRes: null, _readyP: null, _shots: null, _shotWant: null,
    // G640: the measured bar and the carousel
    _hist: null, _key: '', _runT: 0, _stepT: 0, _landT: 0, _preW: 0, _landW: 0, _runMs: {},
    _anim: { from: 0, to: 0, t0: 0, dur: 0 }, _tickT: -1e9, _ticking: false,
    _deck: [], _deckI: -1, _cardNext: 0, _cardHold: false, _shotSet: 'garage', _gen: 0,
  };
  const rec = (k, extra) => { const e = Object.assign({ k, t: Math.round(now() - T0) }, extra || {}); B.log.push(e); return e; };

  // ---- the words --------------------------------------------------------
  function paint() {
    if (!HAS_UI) return;
    drive();
    const tick = $('bootTick');
    if (tick) {
      const parts = [];
      for (const k in B.keys) { const e = B.keys[k]; if (!e.expected) continue;
        const s = e.label + ' ' + Math.min(e.landed, e.expected) + '/' + e.expected + (e.bytes ? ' · ' + fmtMB(e.bytes) : '');
        parts.push(e.landed >= e.expected ? s : s + '…'); }
      tick.textContent = parts.join('   ');
    }
  }
  const fmtMB = b => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
  function setPhase(label) { const el = $('bootPhase'); if (el) el.textContent = label; }
  // THE SHADERS' BLOCK (G567): a cold compile - the first launch, the first after an update, a cleared
  // cache - is the graphics driver's work and can take far longer than any step; the block says why, and
  // its bar counts the programs the driver has linked. While programs are pending the step is live: it re-arms
  // the idle watchdog and the hard one waits (a slow machine compiling is not a stuck boot; app.js's stall cap ends a hang).
  function shaders(done, total, warm) {
    const box = $('bootShader');
    if (done === null || done === undefined) { B._shaderT = 0; B._shaderN = -1; if (box) box.hidden = true; return; }
    if (done !== B._shaderN) { if (B._shaderN === undefined || B._shaderN < 0) rec('shaders', { total }); B._shaderN = done; }
    if (done < total) { B._shaderT = now(); armWatch(); }   // the driver is still at it: alive (the caller's stall cap ends a hang)
    if (total) sub(done / total);                           // G640: the compile step's own count moves the main bar too
    if (!box) return;
    box.hidden = false;
    const bar = $('bootShaderBar'), fill = bar && bar.firstElementChild;
    if (fill) fill.style.width = (total ? Math.min(100, done / total * 100) : 0).toFixed(1) + '%';
    const n = $('bootShaderN'); if (n) n.textContent = done + ' / ' + total + ' shaders ready';
    // the words: the markup's (a first launch, an update), or - when this browser had compiled this very
    // build before - the cache it has lost
    const tx = $('bootShaderText');
    if (tx) { if (B._shaderCold === undefined) B._shaderCold = tx.textContent;
      const w = warm ? "Your graphics driver is compiling the game's shaders again (the browser's shader cache was cleared). It is done once: the next launches reuse them." : B._shaderCold;
      if (tx.textContent !== w) tx.textContent = w; }
  }
  function note(text) { const el = $('bootNote'); if (!el) return; if (text) { el.textContent = text; el.hidden = false; } else el.hidden = true; rec('note', { text }); }

  // ---- G640: the measured bar -------------------------------------------
  // The weights are the ms this browser measured last time (flydiy.boot.ms, a
  // row per set + step list); a step it never timed weighs its `w` x MS_PER_W.
  const MS_PER_W = 150, LAND_MS = 3000, SCRIPTS_MS = 5000, BOOT_MS = 15000, HKEY = 'flydiy.boot.ms';
  let store = null; try { store = typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) {}
  const sget = k => { try { return store ? store.getItem(k) : null; } catch (e) { return null; } };
  const sset = (k, v) => { try { if (store) store.setItem(k, v); } catch (e) {} };
  function hist() {
    if (B._hist) return B._hist;
    let h = null; try { h = JSON.parse(sget(HKEY) || 'null'); } catch (e) {}
    return (B._hist = (h && typeof h === 'object') ? h : {});
  }
  const row = () => hist()[B._key] || null;
  // a COLD compile is its own row (35 s where a warm one is 2): the first visit's prior is 20 s, not the `w`
  const COLD_MS = 20000;
  const hid = s => (s.id === 'compile' && B._coldRun ? 'compile:cold' : s.id);
  // a step this browser never timed weighs its `w` x 150 ms x THE PACE: how much slower (or faster) than the
  // `w` says this machine ran the untimed steps before (hist._pace, 0.3-10) - a first roll-out on a slow box
  const pace = () => { const p = hist()._pace; return p > 0 ? p : 1; };
  const timed = s => { const r = row(), m = r && r[hid(s)]; return m > 0 ? m : 0; };
  const expMs = s => timed(s) || (hid(s) === 'compile:cold' ? COLD_MS : (s.w || 1) * MS_PER_W * pace());
  // inside a step: 73 % of it at the expected time, 88 % at twice it, 0.92 at most
  const creep = (t, E) => 0.92 * (1 - Math.exp(-1.6 * Math.max(0, t) / Math.max(E, 50)));
  function assetFrac() {
    let req = 0, got = 0;
    for (const k of B.required) { const e = B.keys[k]; if (!e) continue; req += e.expected; got += Math.min(e.landed, e.expected); }
    return req ? got / req : 0;
  }
  // the whole bar at time t, if nothing reports before then
  function estimate(t) {
    if (B.state === 'ready' || B.state === 'gone' || B.state === 'waiting') return 1;
    if (!B._runT) {   // before run(): the scripts' share of the garage boot
      const h = hist(), S = h._scripts > 0 ? h._scripts : SCRIPTS_MS, R = h._boot > 0 ? h._boot : BOOT_MS;
      // the island's own read (the page's loader: phase('world', 'reading the island', done / fetched)) is most of it
      const own = B.current && B.current.id === 'world' ? 0.9 * (B.frac || 0) : 0;
      return Math.max(creep(t - T0, S), own) * S / (S + R);
    }
    const total = B._preW + B.weights + B._landW;
    let done = B._preW + B.doneW;
    if (B.state === 'landing') done = B._preW + B.weights + B._landW * Math.max(0.92 * assetFrac(), creep(t - B._landT, B._landW));
    else if (B._stepE) done += B._stepE * Math.min(1, Math.max(B.frac || 0, creep(t - B._stepT, B._stepE)));
    return total > 0 ? Math.min(0.995, done / total) : 0;
  }
  // how far ahead the compositor is sent: the rest of what is expected, so a
  // step that blocks the main thread still sees the bar move (20 s at most)
  function horizon(t) {
    let left = 0;
    if (!B._runT) { const h = hist(); left = (h._scripts > 0 ? h._scripts : SCRIPTS_MS) - (t - T0); }
    else if (B.state === 'landing') left = 2 * B._landW - (t - B._landT);
    else if (B._stepE) left = 2 * B._stepE - (t - B._stepT);
    return Math.max(2500, Math.min(20000, left));
  }
  // the drawn position is the running transition's, computed (the bar is a
  // LINEAR transition, so this is exact); a new target is never below it
  function shown(t) { const a = B._anim; const k = a.dur > 0 ? Math.min(1, Math.max(0, (t - a.t0) / a.dur)) : 1; return a.from + (a.to - a.from) * k; }
  function setBar(from, to, dur, t) {
    const bar = $('bootBar'), fill = bar && bar.firstElementChild;
    B._anim = { from, to, t0: t, dur };
    if (!fill || !fill.style) return;
    fill.style.transition = dur > 0 ? 'transform ' + Math.round(dur) + 'ms linear' : 'none';
    fill.style.transform = 'scaleX(' + to.toFixed(4) + ')';
  }
  function drive() {
    if (!HAS_UI) return;
    const bar = $('bootBar'); if (bar && bar.classList) bar.classList.remove('idle');
    const t = now(), cur = shown(t);
    const want = estimate(t);
    if (want > cur + 0.004) setBar(cur, want, 350, t);
    else { const H = horizon(t), ahead = Math.max(cur, estimate(t + H)); if (ahead > B._anim.to + 0.0005 || B._anim.t0 + B._anim.dur <= t) setBar(cur, ahead, H, t); }
    const p = $('bootPct'), n = Math.floor(Math.max(cur, Math.min(want, 1)) * 100) + ' %';
    if (p && p.textContent !== n) p.textContent = n;
  }
  function histRecord() {
    if (!B._key) return;
    const h = hist(), r = h[B._key] || (h[B._key] = {});
    const mix = (o, n) => (o > 0 ? Math.round(0.5 * o + 0.5 * n) : Math.round(n));
    let sum = 0;
    for (const id in B._runMs) { const ms = Math.min(B._runMs[id], 90000); r[id] = mix(r[id], ms); sum += ms; }
    if (B._landT) { const ms = Math.min(now() - B._landT, 60000); r._landing = mix(r._landing, ms); sum += ms; }
    if (B._preW) { h._scripts = mix(h._scripts, Math.min(B._preW, 90000)); h._boot = mix(h._boot, sum); }
    if (B._paceD > 0) { const p = Math.max(0.3, Math.min(10, B._paceN / B._paceD)); h._pace = +(h._pace > 0 ? 0.5 * h._pace + 0.5 * p : p).toFixed(3); }
    sset(HKEY, JSON.stringify(h));
  }
  // the one timer while the overlay is up: the bar's horizon and the cards'
  // clock. Fired early (the harness's immediate stub) it does nothing and does
  // not re-arm; gone, it stops.
  function tick() {
    if (B.state === 'gone') { B._ticking = false; return; }
    const t = now(); if (t - B._tickT < 200) return;
    B._tickT = t; drive(); cardClock(t);
    if (hasTimer) setTimeout(tick, 250);
  }
  function startTick() { if (B._ticking) return; B._ticking = true; tick(); }

  // ---- G640: the step in plain words ------------------------------------
  // set -> step id -> words; the compile's by cold / warm (the shaders' own key:
  // app.js shaderProgress writes flydiy.shaders.warm:<site> = the build once a
  // compile of this build finished here)
  const WHY = {
    pre: {
      scripts: "Your browser is reading the game: the flight physics, the aeroplane generator, the shed and the island's code.",
      world: "Composing the world's map: the fields, the roads and the places you can land.",
      renderer: 'Starting the renderer on your graphics card.',
      aeroplane: 'Building your aeroplane from its spec.' },
    garage: {
      treeBins: 'Asking for the tree models now, so the forest is ready when you roll out.',
      aircraft: 'Building your aeroplane from its spec: the frame, the skin, the engine, weighed and balanced.',
      garage: 'Raising the shed around it: the room, its light, the props and the crew.',
      editor: 'Opening the workshop: the drawing board and every part you can change.',
      sync: 'Committing the build: the shape you drew becomes the aeroplane the physics fly.',
      snapshot: 'Committing the build: the shape you drew becomes the aeroplane the physics fly.',
      bake: 'Baking the flown aeroplane: its skin, as the camera will see it outside.',
      spec: 'Your aeroplane, built from the committed design.',
      parked: "Parking the other aeroplanes you will meet on the island's fields.",
      // B9 (G1020): the world, in the one loading - every round trip after it costs only the aeroplane
      world: 'Laying out the island now, once: the ground, the water, the fields, the roads and the villages. Every roll-out after this one is instant.',
      town: 'Building the field around the stand: the hangars, the houses and the aeroplanes parked on it.',
      parking: "Parking the other aeroplanes on the field - each one is built by the same workshop as yours.",
      trees: 'Waiting for the tree models.',
      ring: 'Planting the forest around the stand, nearest first. Farther out it keeps growing while you fly.',
      settle: 'Letting the world finish around the stand - the village out to 6 km, the rest of the forest, the rocks and the grass - so nothing is still arriving once you fly.',
      images: "Fetching the pictures the world's buildings and signs wear.",
      upload: 'Sending the textures to the graphics card in small slices, so the first frame does not stall.',
      worldCompile: ["Compiling the island's shaders - first visit only, cached next time.",
                     "Linking the island's shaders from your browser's cache."],
      craft: "Your aeroplane's shaders in the island's light, so the first frame outside compiles nothing.",
      recheck: 'Your aeroplane once more, as the workshop settled it - so the first roll-out has nothing left to do.',
      shedCompile: 'Compiling what your new settings change in the shed.',
      _waiting: 'Everything is loaded. Your options are on the left: press Fly when you are ready.',
      restore: "Reading back your aeroplane's plaque from the last session.",
      compile: ["Compiling the shed's shaders for your graphics card - first visit only, cached next time.",
                "Handing the shed's shaders to your graphics card - they were compiled on an earlier visit."],
      firstFrame: 'The first frames, drawn behind this screen: the shed only shows when it is finished.',
      shed: 'Back into the shed: the room rebuilt around your aeroplane, the plaque settled.',
      board: 'Reopening the workshop where you left it.',
      frames: 'First light: the shed, and the island drawn once from the stand behind this screen.',
      _landing: 'The last textures landing: the shed opens when everything is in place, never half-dressed.' },
    rollout: {
      sync: 'Committing your build: the shape you drew becomes the aeroplane the physics fly.',
      snapshot: 'Committing your build: the shape you drew becomes the aeroplane the physics fly.',
      bake: 'Baking the flown aeroplane: its skin, as the camera will see it outside.',
      spec: 'Your aeroplane, built from the committed design.',
      craft: "Your aeroplane's shaders in the island's light - only what the new build changed.",
      parking: "Parking the other aeroplanes on the field - each one is built by the same workshop as yours.",
      worldCompile: ["Compiling what the new settings or the new stand changed - cached next time.",
                     "Linking the island's shaders from your browser's cache."],
      stand: 'Wheeling the aeroplane out of the shed onto its stand.',
      world: 'Laying out the island: the ground, the water, the fields, the roads and the villages. Only the first roll-out of a visit.',
      town: 'Building the field around the stand: the hangars, the houses and the aeroplanes parked on it.',
      parked: "Parking the other aeroplanes on the field - each one is built by the same workshop as yours.",
      trees: 'Waiting for the tree models.',
      ring: 'Planting the forest around the stand, nearest first. Farther out it keeps growing while you fly.',
      images: "Fetching the pictures the world's buildings and signs wear.",
      upload: 'Sending the textures to the graphics card in small slices, so the first frame does not stall.',
      compile: ["Compiling the island's shaders - first visit only, cached next time.",
                "Linking the island's shaders from your browser's cache."],
      frames: "The world's first frames, drawn under this screen: the last shadow variants compile here.",
      _landing: 'The last pieces: the screen lifts on a finished picture.' },
    settings: {
      compile: 'Compiling what the new settings change - shadows, water, clouds, the tone curve. Your browser keeps them for next time.',
      frames: 'Drawing the first frames with the new settings.',
      _landing: 'The new settings, in place.' },
  };
  const site = () => (B.set === 'rollout' || (B.set === 'settings' && B._shotSet === 'rollout')) ? 'world' : 'garage';
  // cold: this site never finished a compile here, or finished another build's. The page's build id is
  // written after this script (index.html's core block): until it is, only "never" counts as cold
  function cold() {
    const v = sget('flydiy.shaders.warm:' + site());
    if (!v) return true;
    const b = typeof window !== 'undefined' ? window.FLYDIY_BUILD : null;
    return b ? v !== b : false;
  }
  function why(id) {
    const el = $('bootWhy'); if (!el) return;
    const tab = !B._runT ? WHY.pre : (WHY[B.set] || {});
    let w = tab[id] || '';
    if (Array.isArray(w)) w = cold() ? w[0] : w[1];
    if (analytic()) w = w.replace(/the island/g, 'the world');   // the procedural world is no island
    if (el.textContent !== w) el.textContent = w;
  }

  // ---- the pictures: CSS crossfade + Ken Burns; this only flips `on` -----
  // G640: a figure's image is fetched when its turn comes (data-src -> src),
  // and it crossfades in once it has landed, never as an empty frame
  function shots() {
    if (B._shots === null) { const host = $('bootShots'); B._shots = host && host.children ? Array.prototype.slice.call(host.children) : []; }
    return B._shots.filter(f => f.getAttribute && f.getAttribute('data-set') === B._shotSet);
  }
  function fetchShot(f) {
    const im = f && f.firstElementChild;
    if (!im || !im.getAttribute) return im;
    const ds = im.getAttribute('data-src');
    if (ds && !im.getAttribute('src') && im.setAttribute) im.setAttribute('src', ds);
    return im;
  }
  function activate(f) {
    if (!f || !f.classList) return;
    B._shotWant = f;
    const swap = () => {
      if (B._shotWant !== f) return;               // another picture was asked for since
      for (const g of (B._shots || [])) if (g !== f && g.classList) g.classList.remove('on');
      f.classList.add('on');
    };
    const im = fetchShot(f);
    if (im && im.complete === false && im.addEventListener) { im.addEventListener('load', swap); im.addEventListener('error', swap); }
    else swap();
  }

  // ---- G640: the carousel -----------------------------------------------
  // window.BOOT_CARDS (boot_cards.js): { k, t, x, set?, when? } - k the kind
  // (KIND below), t the title, x the text; set 'garage' | 'rollout' | 'any' (the
  // default) for the pool, the NOW cards (k 'now') open a deck of their own set
  // ('garage' the boot, 'rollin' the way back, 'rollout', 'settings'), `when:
  // 'cold'` only while this site's shaders are cold. A deck is the now cards,
  // then the pool two cards to a picture, from where the last load left off.
  const KIND = { now: 'right now', island: 'the island', game: 'the game', fly: 'flying', garage: 'in the shed', pic: 'from the game' };
  const DKEY = 'flydiy.boot.deck';
  function deckState() { let d = null; try { d = JSON.parse(sget(DKEY) || 'null'); } catch (e) {} return (d && typeof d === 'object') ? d : {}; }
  // the procedural 24 km world (?world=none, the graphics menu's world row): the island's cards stay out
  function analytic() { return typeof window !== 'undefined' && window.FLYDIY_WORLD === 'none'; }
  function deckFor(dset) {
    const all = (typeof window !== 'undefined' && Array.isArray(window.BOOT_CARDS)) ? window.BOOT_CARDS : [];
    const poolSet = dset === 'rollin' ? 'garage' : dset === 'settings' ? B._shotSet : dset;
    const first = all.filter(c => c && c.k === 'now' && c.set === dset && (c.when !== 'cold' || cold()));
    const pool = all.filter(c => c && c.k !== 'now' && (!c.set || c.set === 'any' || c.set === poolSet) && !(c.k === 'island' && analytic()));
    const pics = shots(), st = deckState()[poolSet] || {};
    const c0 = (st.c | 0) % Math.max(pool.length, 1), p0 = (st.p | 0) % Math.max(pics.length, 1);
    const items = first.map(c => ({ card: c }));
    for (let i = 0, ci = 0, pi = 0; ci < pool.length || pi < pics.length; i++) {
      if (pi < pics.length && (i % 3 === 2 || ci >= pool.length)) { const k = (p0 + pi++) % pics.length; items.push({ pic: pics[k], pi: k, ps: poolSet }); }
      else { const k = (c0 + ci++) % pool.length; items.push({ card: pool[k], ci: k, ps: poolSet }); }
    }
    return items;
  }
  function text(id, v) { const el = $(id); if (el && el.textContent !== v) el.textContent = v; }
  function showItem(it, manual) {
    if (!it) return;
    let kind, title, body;
    if (it.pic) {
      activate(it.pic);
      const cap = it.pic.lastElementChild || null;
      kind = KIND.pic; title = (cap && cap.textContent) || ''; body = (it.pic.getAttribute && it.pic.getAttribute('data-txt')) || '';
    } else { kind = KIND[it.card.k] || ''; title = it.card.t || ''; body = it.card.x || ''; }
    text('bootCardKind', kind); text('bootCardTitle', title); text('bootCardText', body);
    text('bootCardN', (B._deckI + 1) + ' / ' + B._deck.length);
    const card = $('bootCard'); if (card) card.hidden = false;
    // the reading time: ~50 ms a character, 7-15 s; a card picked by hand stays longer
    const dwell = Math.max(7000, Math.min(15000, 4500 + 50 * (title.length + body.length))) * (manual ? 1.8 : 1);
    B._cardNext = now() + dwell;
    const tm = $('bootCardTime');
    if (tm && tm.style) { B._dwellFlip = !B._dwellFlip; tm.style.animation = (B._dwellFlip ? 'bootDwellA ' : 'bootDwellB ') + Math.round(dwell) + 'ms linear forwards'; }
    // the next picture, fetched one turn ahead
    for (let j = 1; j < B._deck.length; j++) { const nx = B._deck[(B._deckI + j) % B._deck.length]; if (nx && nx.pic) { fetchShot(nx.pic); break; } }
    // the place is kept: the next load starts past what was read
    if (it.ps && (it.ci !== undefined || it.pi !== undefined)) {
      const d = deckState(), s = d[it.ps] || (d[it.ps] = {});
      if (it.ci !== undefined) s.c = it.ci + 1; else s.p = it.pi + 1;
      sset(DKEY, JSON.stringify(d));
    }
  }
  function card(dir, auto) {
    const n = B._deck.length; if (!n) return;
    B._deckI = ((B._deckI + (dir || 1)) % n + n) % n;
    showItem(B._deck[B._deckI], !auto);
  }
  function cardClock(t) {
    if (!B._deck.length) return;
    if (B._cardHold) { B._cardNext = Math.max(B._cardNext, t + 3000); return; }
    if (t >= B._cardNext) card(1, true);
  }
  // the build id arrives after the first deal: a cold card the deck could not know about goes in next
  function recheckCold() {
    const all = (typeof window !== 'undefined' && Array.isArray(window.BOOT_CARDS)) ? window.BOOT_CARDS : [];
    if (!B._deck.length || !cold()) return;
    const add = all.filter(c => c && c.k === 'now' && c.when === 'cold' && c.set === B._deckSet && !B._deck.some(it => it.card === c));
    if (add.length) B._deck.splice(B._deckI + 1, 0, ...add.map(c => ({ card: c })));
  }
  function deal(dset) {
    B._deckSet = dset;
    B._deck = deckFor(dset); B._deckI = -1;
    const pics = shots();
    // the background from the first moment: the set's first picture (the page's
    // one eager image for the garage), unless the deck opens on a picture
    if (pics.length && !(B._deck[0] && B._deck[0].pic)) activate(pics[0]);
    if (B._deck.length) card(1, true);
    else { const c = $('bootCard'); if (c) c.hidden = true; }
  }

  // ---- the watchdogs: check elapsed, never re-arm themselves ------------
  function watch() {
    if (B.state === 'gone' || B.state === 'ready' || B.state === 'waiting') return;   // (B8: waiting on the player is not a stuck boot)
    const t = now();
    // fired early (the harness's immediate stub): no verdict and NO re-arm -
    // an immediate timer that re-armed itself would recurse without end
    if (t - B._watchArmed < 1900) return;
    // a 9 s block is a normal step on a slow machine: the button is a safety
    // valve, not a verdict - it shows at 14 s of silence, the overlay gives up
    // at 30 s of silence or 2 min in all
    const idle = B.opt.idle || 30000, hard = B.opt.hard || 120000, skipAt = B.opt.skipAt || 14000;
    if (t - B.lastEvent >= skipAt || t - B.opt.t0 >= 45000) { const b = $('bootSkip'); if (b) b.hidden = false; }
    const compiling = B._shaderT && t - B._shaderT < idle;   // G567: a moving shader count is not a stuck boot
    if (t - B.lastEvent >= idle || (t - B.opt.t0 >= hard && !compiling)) { fail(t - B.opt.t0 >= hard ? 'hard timeout' : 'nothing landed for ' + Math.round(idle / 1000) + ' s'); return; }
    B._watchArmed = t; if (hasTimer) setTimeout(watch, 2000);
  }
  function armWatch() { B.lastEvent = now(); }

  // ---- the aggregator ---------------------------------------------------
  const LABELS = { sky: 'sky', env: 'lighting', room: 'the room', props: 'props', propTex: 'prop textures', skin: 'the skin',
    crew: 'the crew', crewTex: 'crew textures', crewBuild: 'crew fit', treeBin: 'tree models', trees: 'tree textures',
    atlas: 'tree atlases', fill: 'the forest', worldFrame: 'the world' };
  function key(k) { return B.keys[k] || (B.keys[k] = { expected: 0, landed: 0, failed: 0, bytes: 0, label: LABELS[k] || k }); }
  function expect(k, n) { const e = key(k); e.expected += (n === undefined ? 1 : n); B.quiet = 0; armWatch(); paint(); return e; }
  function landed(k, ok, what, bytes) {
    const e = key(k); e.landed += 1; if (bytes) e.bytes += bytes;
    if (ok === false) { e.failed += 1; B.failed.push(k + (what ? ' ' + what : '')); }
    B.quiet = 0;   // three quiet frames AFTER the last landing
    armWatch(); rec('landed', { key: k, ok: ok !== false, what: what ? String(what).slice(-48) : undefined });
    paint();
  }
  function img(im, k) {
    // one Image, one landing: the room and the world's shed share their
    // textures' Images, and two expects on one load would never balance
    if (!im || im.__bootSeen !== undefined) return;
    im.__bootSeen = false;
    expect(k);
    const done = ok => { if (im.__bootSeen) return; im.__bootSeen = true; landed(k, ok, im.src); };
    if (im.complete && im.naturalWidth) done(true);
    else if (im.complete && im.src) done(false);        // complete but broken: it failed already
    else if (im.addEventListener) { im.addEventListener('load', () => done(true)); im.addEventListener('error', () => done(false)); }
    else done(true);
  }
  function balanced() {
    // a required key nobody expected is nothing to wait for (no crew seated,
    // no props in this room): producers EXPECT before they land the thing
    // that triggers the next fetch, so the chain never has a gap
    for (const k of B.required) { const e = B.keys[k]; if (e && e.landed < e.expected) return false; }
    for (const p of (B.opt.pending || [])) { try { if (p()) return false; } catch (e) {} }
    return true;
  }
  function pending() {
    const out = [];
    for (const k of B.required) { const e = B.keys[k]; if (e && e.landed < e.expected) out.push(e.label + ' ' + e.landed + '/' + e.expected); }
    return out;
  }

  // ---- the chain --------------------------------------------------------
  function phase(id, label, frac) {
    // G640: during a run, only the CURRENT step speaks (an older run's step still ticking under a newer
    // screen - the roll-out's upload under a settings screen - is logged, not shown)
    if (B._runT && B.state === 'loading' && B.stepI > 0 && !(B.current && B.current.id === id)) { rec('phase', { id, stale: true }); return; }
    // the same step reporting its count again: the fraction only ever rises (G640)
    const same = B.current && B.current.id === id;
    B.current = { id, label, w: same ? B.current.w : 1 };
    B.frac = same ? Math.max(B.frac || 0, frac || 0) : (frac || 0);
    rec('phase', { id }); if (!same) why(id);
    setPhase(label || id); paint();
  }
  // G640: the current step's own count (the shader compile's linked / seen)
  function sub(frac) { if (B.state !== 'loading' || !(frac >= 0)) return; if (frac > (B.frac || 0)) { B.frac = Math.min(1, frac); paint(); } }
  function run(steps, opt) {
    opt = opt || {};
    B.opt = Object.assign({ t0: now() }, opt);
    B.set = opt.set || B.set; B.required = opt.require || [];
    B.steps = steps || []; B.stepI = 0; B.doneW = 0; B.weights = 0; B.quiet = 0; B.state = 'loading';
    // G640: the measured weights - this set's row, keyed by its step list (the
    // boot, the way back and a second roll-out are different lists)
    const t = now();
    B._preW = B._runT ? 0 : Math.max(0, t - T0);   // the garage boot: the scripts took this long
    B._runT = t; B._runMs = {}; B._landT = 0; B._stepE = 0;
    B._key = B.set + ':' + (B.steps[0] ? B.steps[0].id : '') + ':' + B.steps.length;
    B._coldRun = cold();
    B._E = B.steps.map(expMs);
    B._Edef = B.steps.map(s => !timed(s) && hid(s) !== 'compile:cold'); B._paceN = 0; B._paceD = 0;
    for (const e of B._E) B.weights += e;
    { const r = row(); B._landW = r && r._landing > 0 ? r._landing : LAND_MS; }
    rec('run', { set: B.set, steps: B.steps.length });
    if (!B._readyP) B._readyP = new Promise(r => { B._readyRes = r; });
    if (typeof window !== 'undefined') window.FLYDIY_READY = B._readyP;
    armWatch(); B._watchArmed = now(); if (hasTimer) setTimeout(watch, 2000);
    recheckCold(); startTick();
    // the first step is its own task too (LOADING S2): run() is called at the
    // end of app.js's eval, and a step run inside that task would keep the
    // overlay from painting the step's own label first
    const gen = ++B._gen;
    if (hasTimer) setTimeout(() => next(gen), 0); else next(gen);
  }
  // are these keys all in (or never asked for)? - a step that wants the
  // scene complete before it works on it (the shader compile) asks this
  function settled(keys) {
    for (const k of keys) { const e = B.keys[k]; if (e && e.landed < e.expected) return false; }
    return true;
  }
  // G640: A RUN OWNS ITS CHAIN. A screen the watchdog lifted (a hard timeout on a slow machine) leaves its
  // chain running; a screen shown meanwhile (a settings change) must not have its step pointer, its bar or
  // its words advanced by the old chain - each run() starts a generation, and a step of an older one only logs
  function next(g) {
    if (g !== undefined && g !== B._gen) return;
    if (B.stepI >= B.steps.length) {
      // a run the watchdog already lifted finishes quietly: back to 'landing' it lifted a second time (its
      // done() ran twice) and a settings change in between found a screen 'up' that nobody could see
      if (B.state === 'gone') { B.current = null; rec('landing', { lifted: true }); return; }
      B.state = 'landing'; rec('landing'); B.current = null; B.frac = 0; B._landT = now(); B._stepE = 0;
      setPhase(B.opt.landingLabel || 'the last pieces'); why('_landing');
      paint(); ready();
      return;
    }
    const s = B.steps[B.stepI++];
    B.current = { id: s.id, label: s.label, w: s.w || 1 }; B.frac = 0;
    const E = B._E[B.stepI - 1]; B._stepE = E; B._stepT = now();
    setPhase(s.label || s.id); why(s.id); paint(); armWatch();
    const t = now(); const e = rec('step', { id: s.id });
    const failed = err => { rec('error', { id: s.id, msg: String(err && err.message || err) }); note('a step failed (' + s.id + '): ' + String(err && err.message || err)); if (typeof console !== 'undefined') console.error('boot step ' + s.id + ':', err); };
    const gen = B._gen, i = B.stepI - 1;
    const finish = () => {
      e.ms = Math.round(now() - t);
      if (gen !== B._gen) return;              // an older run's step, finishing under a newer screen
      B._runMs[hid(s)] = e.ms;
      if (B._Edef[i]) { B._paceN += e.ms; B._paceD += E / pace(); }
      if (B.opt.probe) { try { Object.assign(e, B.opt.probe()); } catch (err) {} }   // e.g. the renderer's program count
      B.doneW += E; B._stepE = 0; armWatch(); paint();
      if (hasTimer) setTimeout(() => next(gen), 0); else next(gen);
    };
    let r;
    try { if (typeof s.fn === 'function') r = s.fn(); }
    catch (err) { failed(err); }
    // a step may hand back a promise (LOADING S2: the parallel shader compile
    // polls the driver); the chain waits for it. GATE UISMOKE's harness has
    // no such renderer, so there every step stays synchronous.
    if (r && typeof r.then === 'function') r.then(finish, err => { failed(err); finish(); });
    else finish();
  }
  function frame() {
    if (B.state === 'gone') return;
    if (!B._frame1) { B._frame1 = true; rec('frame1'); }
    if (B.state === 'landing' && balanced()) { B.quiet += 1; ready(); } else B.quiet = 0;
  }
  function ready() {
    if (B.state !== 'landing') return false;
    if (!balanced()) return false;
    if (B.quiet < (B.opt.quietFrames === undefined ? 3 : B.opt.quietFrames)) return false;
    // B8: the player touched the setup: the load is done, the screen waits for Fly (the bar's history is this load's)
    if (B._hold) { B.state = 'waiting'; rec('waiting'); histRecord(); B._key = ''; setPhase('ready'); why('_waiting'); paint();
      if (typeof B.onWait === 'function') { try { B.onWait(); } catch (e) {} } return false; }
    B.state = 'ready'; rec('ready'); histRecord(); hide(); return true;
  }
  function hold() { if (B.state === 'gone' || B.state === 'ready') return false; B._hold = true; rec('hold'); return true; }
  function go(lift) {
    B._hold = false; rec('go');
    if (lift === false || B.state !== 'waiting') return;
    B.state = 'landing'; B.quiet = 1e9; ready();
  }
  function fail(reason) {
    if (B.state === 'gone' || B.state === 'ready') return;
    const miss = pending();
    rec('fail', { reason, missing: miss, failed: B.failed.slice() });
    if (typeof console !== 'undefined') console.warn('boot: ' + reason + (miss.length ? ' - never landed: ' + miss.join(', ') : '') + (B.failed.length ? ' - failed: ' + B.failed.join(', ') : ''));
    B.state = 'ready'; hide();
  }
  function hide() {
    rec('gone'); const b = $('boot'); B.state = 'gone'; B._hold = false; shaders(null);
    if (HAS_UI) { const t = now(); setBar(shown(t), 1, 250, t); text('bootPct', '100 %'); }
    // the roll-out's first picture, fetched now that the page is idle: its world step holds the main thread
    // for seconds, and a picture asked for under it would land after it - an empty background meanwhile
    if (B._shotSet === 'garage') { shots(); const f = (B._shots || []).find(g => g.getAttribute && g.getAttribute('data-set') === 'rollout'); if (f) fetchShot(f); }
    if (b && b.classList) { b.classList.add('gone'); if (hasTimer) setTimeout(() => { if (B.state === 'gone' && b.classList.contains('gone')) b.hidden = true; }, 700); }
    if (B.opt.done) { try { B.opt.done(); } catch (e) { if (typeof console !== 'undefined') console.error('boot done:', e); } }
    const r = B._readyRes; B._readyRes = null; B._readyP = null; if (r) r(B.log);
  }
  function show(set, opt) {
    const b = $('boot'); if (b) { b.hidden = false; b.classList.remove('gone'); if (b.setAttribute) b.setAttribute('data-set', set || 'garage'); }
    B.set = set || 'garage'; B.keys = {}; B.failed = []; B.state = 'loading'; B._frame1 = false; B._hold = false;
    // G640: the pictures of the scene being left for a settings change ('settings' has none of its own)
    B._shotSet = B.set === 'settings' ? ((opt && opt.shots) || 'garage') : B.set;
    B._key = ''; B._stepE = 0; B._landT = 0; B.doneW = 0; B.weights = 0; B._preW = 0; B.current = null; B.frac = 0;
    { const t = now(); setBar(0, 0, 0, t); text('bootPct', '0 %'); }
    // G437 (A2): the words are the SET's from the first frame. The roll-out
    // screen opened over the garage's last line ("the last pieces landing")
    // and the shed's ticker until its first step painted, several seconds
    // into building the world - "the loading screens are confusing,
    // mentioning the garage after roll out untested".
    setPhase(B.set === 'rollout' ? 'rolling out to the strip' : 'opening the shed');
    { const tk = $('bootTick'); if (tk) tk.textContent = ''; }
    note(''); shaders(null); const sk = $('bootSkip'); if (sk) sk.hidden = true;
    text('bootWhy', '');
    rec('show', { set: B.set });
    deal((opt && opt.deck) || B.set);
    startTick();
    if (opt && opt.steps) run(opt.steps, opt);
  }
  function whenReady() { if (B.state === 'gone') return Promise.resolve(B.log); if (!B._readyP) B._readyP = new Promise(r => { B._readyRes = r; }); return B._readyP; }

  const sk = $('bootSkip'); if (sk && sk.addEventListener) sk.addEventListener('click', () => fail('skipped by the user'));
  // bytes per landed URL, zero-touch: the ticker's MB come from here
  try { new PerformanceObserver(l => { for (const en of l.getEntries()) { const u = en.name; const k = /media\/tex\/chars\//.test(u) ? 'crewTex' : /media\/tex\/sky\//.test(u) ? 'sky' : /media\/tex\/trees\//.test(u) ? 'trees' : /media\/geo\/trees\//.test(u) ? 'treeBin' : /media\/geo\/props\//.test(u) ? 'props' : /media\/tex\/props\//.test(u) ? 'propTex' : /media\/geo\/chars\//.test(u) ? 'crew' : null;
    if (k) key(k).bytes += en.transferSize || en.encodedBodySize || 0; } paint(); }).observe({ type: 'resource', buffered: true }); } catch (e) {}

  // G640: the carousel's hand controls; the pointer over the card holds it
  { const pv = $('bootCardPrev'), nx = $('bootCardNext'), cd = $('bootCard');
    if (pv && pv.addEventListener) pv.addEventListener('click', () => card(-1));
    if (nx && nx.addEventListener) nx.addEventListener('click', () => card(1));
    if (cd && cd.addEventListener) { cd.addEventListener('mouseenter', () => { B._cardHold = true; }); cd.addEventListener('mouseleave', () => { B._cardHold = false; B._cardNext = Math.max(B._cardNext, now() + 4000); }); } }
  B.sub = sub; B.card = card;
  B.busy = () => B.stepI < B.steps.length;   // a chain still has steps to run (a lifted screen's, too)
  B.shaders = shaders; B.phase = phase; B.run = run; B.expect = expect; B.landed = landed; B.img = img; B.note = note; B.frame = frame;
  B.hold = hold; B.go = go;
  B.ready = ready; B.fail = fail; B.hide = hide; B.show = show; B.whenReady = whenReady; B.pending = pending; B.settled = settled; B.hasUI = HAS_UI;
  if (typeof window !== 'undefined') window.BOOT = B;
  if (typeof module !== 'undefined') module.exports = B;
  rec('boot.js');
  phase('scripts', 'reading the scripts');
  deal('garage');
  startTick();
})();
