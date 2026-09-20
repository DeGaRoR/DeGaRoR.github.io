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
//   whenReady()              a Promise resolved on hide; window.FLYDIY_READY
//                            is the current set's - the rigs wait on it
//   log[]                    every event with its ms - tools/boot_perf.js
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
    _readyRes: null, _readyP: null, _shots: null, _shotI: -1, _shotT: 0,
  };
  const rec = (k, extra) => { const e = Object.assign({ k, t: Math.round(now() - T0) }, extra || {}); B.log.push(e); return e; };

  // ---- the words --------------------------------------------------------
  function paint() {
    if (!HAS_UI) return;
    const bar = $('bootBar'), fill = bar && bar.firstElementChild;
    if (bar) bar.classList.remove('idle');
    let req = 0, got = 0;
    for (const k of B.required) { const e = B.keys[k]; if (!e) continue; req += e.expected; got += Math.min(e.landed, e.expected); }
    const stepF = B.weights ? (B.doneW + (B.current ? B.current.w * B.frac : 0)) / B.weights : (B.state === 'loading' ? 0 : 1);
    const assetF = req ? got / req : (B.state === 'landing' || B.state === 'gone' ? 1 : 0);
    const f = Math.max(0, Math.min(1, 0.7 * stepF + 0.3 * assetF));
    if (fill) fill.style.width = (f * 100).toFixed(1) + '%';
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
  function note(text) { const el = $('bootNote'); if (!el) return; if (text) { el.textContent = text; el.hidden = false; } else el.hidden = true; rec('note', { text }); }

  // ---- the pictures: CSS crossfade + Ken Burns; this only flips `on` -----
  function shots() {
    if (B._shots === null) { const host = $('bootShots'); B._shots = host && host.children ? Array.prototype.slice.call(host.children) : []; }
    return B._shots.filter(f => f.getAttribute && f.getAttribute('data-set') === B.set);
  }
  function rotate() {
    const fs = shots(); if (!fs.length) return;
    const t = now();
    if (B._shotI >= 0 && t - B._shotT < 5500) return;      // fired early (the immediate stub): nothing, no re-arm
    if (B._shotI >= 0 && fs[B._shotI % fs.length]) fs[B._shotI % fs.length].classList.remove('on');
    B._shotI = B._shotI < 0 ? 0 : B._shotI + 1;
    const f = fs[B._shotI % fs.length]; if (f && f.classList) f.classList.add('on');
    B._shotT = t;
    if (hasTimer && B.state !== 'gone' && fs.length > 1) setTimeout(rotate, 6000);
  }

  // ---- the watchdogs: check elapsed, never re-arm themselves ------------
  function watch() {
    if (B.state === 'gone' || B.state === 'ready') return;
    const t = now();
    // fired early (the harness's immediate stub): no verdict and NO re-arm -
    // an immediate timer that re-armed itself would recurse without end
    if (t - B._watchArmed < 1900) return;
    // a 9 s block is a normal step on a slow machine: the button is a safety
    // valve, not a verdict - it shows at 14 s of silence, the overlay gives up
    // at 30 s of silence or 2 min in all
    const idle = B.opt.idle || 30000, hard = B.opt.hard || 120000, skipAt = B.opt.skipAt || 14000;
    if (t - B.lastEvent >= skipAt || t - B.opt.t0 >= 45000) { const b = $('bootSkip'); if (b) b.hidden = false; }
    if (t - B.lastEvent >= idle || t - B.opt.t0 >= hard) { fail(t - B.opt.t0 >= hard ? 'hard timeout' : 'nothing landed for ' + Math.round(idle / 1000) + ' s'); return; }
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
    B.current = { id, label, w: B.current && B.current.id === id ? B.current.w : 1 };
    B.frac = frac || 0; rec('phase', { id }); setPhase(label || id); paint();
  }
  function run(steps, opt) {
    opt = opt || {};
    B.opt = Object.assign({ t0: now() }, opt);
    B.set = opt.set || B.set; B.required = opt.require || [];
    B.steps = steps || []; B.stepI = 0; B.doneW = 0; B.weights = 0; B.quiet = 0; B.state = 'loading';
    for (const s of B.steps) B.weights += (s.w || 1);
    rec('run', { set: B.set, steps: B.steps.length });
    if (!B._readyP) B._readyP = new Promise(r => { B._readyRes = r; });
    if (typeof window !== 'undefined') window.FLYDIY_READY = B._readyP;
    armWatch(); B._watchArmed = now(); if (hasTimer) setTimeout(watch, 2000);
    rotate();
    // the first step is its own task too (LOADING S2): run() is called at the
    // end of app.js's eval, and a step run inside that task would keep the
    // overlay from painting the step's own label first
    if (hasTimer) setTimeout(next, 0); else next();
  }
  // are these keys all in (or never asked for)? - a step that wants the
  // scene complete before it works on it (the shader compile) asks this
  function settled(keys) {
    for (const k of keys) { const e = B.keys[k]; if (e && e.landed < e.expected) return false; }
    return true;
  }
  function next() {
    if (B.stepI >= B.steps.length) {
      B.state = 'landing'; rec('landing'); B.current = null; B.frac = 0;
      setPhase(B.opt.landingLabel || 'the last pieces');
      paint(); ready();
      return;
    }
    const s = B.steps[B.stepI++];
    B.current = { id: s.id, label: s.label, w: s.w || 1 }; B.frac = 0;
    setPhase(s.label || s.id); paint(); armWatch();
    const t = now(); const e = rec('step', { id: s.id });
    const failed = err => { rec('error', { id: s.id, msg: String(err && err.message || err) }); note('a step failed (' + s.id + '): ' + String(err && err.message || err)); if (typeof console !== 'undefined') console.error('boot step ' + s.id + ':', err); };
    const finish = () => {
      e.ms = Math.round(now() - t);
      if (B.opt.probe) { try { Object.assign(e, B.opt.probe()); } catch (err) {} }   // e.g. the renderer's program count
      B.doneW += s.w || 1; armWatch(); paint();
      if (hasTimer) setTimeout(next, 0); else next();
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
    B.state = 'ready'; rec('ready'); hide(); return true;
  }
  function fail(reason) {
    if (B.state === 'gone' || B.state === 'ready') return;
    const miss = pending();
    rec('fail', { reason, missing: miss, failed: B.failed.slice() });
    if (typeof console !== 'undefined') console.warn('boot: ' + reason + (miss.length ? ' - never landed: ' + miss.join(', ') : '') + (B.failed.length ? ' - failed: ' + B.failed.join(', ') : ''));
    B.state = 'ready'; hide();
  }
  function hide() {
    rec('gone'); const b = $('boot'); B.state = 'gone';
    if (b && b.classList) { b.classList.add('gone'); if (hasTimer) setTimeout(() => { if (B.state === 'gone' && b.classList.contains('gone')) b.hidden = true; }, 700); }
    if (B.opt.done) { try { B.opt.done(); } catch (e) { if (typeof console !== 'undefined') console.error('boot done:', e); } }
    const r = B._readyRes; B._readyRes = null; B._readyP = null; if (r) r(B.log);
  }
  function show(set, opt) {
    const b = $('boot'); if (b) { b.hidden = false; b.classList.remove('gone'); if (b.setAttribute) b.setAttribute('data-set', set || 'garage'); }
    B.set = set || 'garage'; B.keys = {}; B.failed = []; B.state = 'loading'; B._frame1 = false;
    for (const f of (B._shots || [])) if (f.classList) f.classList.remove('on');
    B._shotI = -1; B._shotT = 0;
    // G437 (A2): the words are the SET's from the first frame. The roll-out
    // screen opened over the garage's last line ("the last pieces landing")
    // and the shed's ticker until its first step painted, several seconds
    // into building the world - "the loading screens are confusing,
    // mentioning the garage after roll out untested".
    setPhase(B.set === 'rollout' ? 'rolling out to the strip' : 'opening the shed');
    { const tk = $('bootTick'); if (tk) tk.textContent = ''; }
    note(''); const sk = $('bootSkip'); if (sk) sk.hidden = true;
    rec('show', { set: B.set });
    if (opt && opt.steps) run(opt.steps, opt);
  }
  function whenReady() { if (B.state === 'gone') return Promise.resolve(B.log); if (!B._readyP) B._readyP = new Promise(r => { B._readyRes = r; }); return B._readyP; }

  const sk = $('bootSkip'); if (sk && sk.addEventListener) sk.addEventListener('click', () => fail('skipped by the user'));
  // bytes per landed URL, zero-touch: the ticker's MB come from here
  try { new PerformanceObserver(l => { for (const en of l.getEntries()) { const u = en.name; const k = /media\/tex\/chars\//.test(u) ? 'crewTex' : /media\/tex\/sky\//.test(u) ? 'sky' : /media\/tex\/trees\//.test(u) ? 'trees' : /media\/geo\/trees\//.test(u) ? 'treeBin' : /media\/geo\/props\//.test(u) ? 'props' : /media\/tex\/props\//.test(u) ? 'propTex' : /media\/geo\/chars\//.test(u) ? 'crew' : null;
    if (k) key(k).bytes += en.transferSize || en.encodedBodySize || 0; } paint(); }).observe({ type: 'resource', buffered: true }); } catch (e) {}

  B.phase = phase; B.run = run; B.expect = expect; B.landed = landed; B.img = img; B.note = note; B.frame = frame;
  B.ready = ready; B.fail = fail; B.hide = hide; B.show = show; B.whenReady = whenReady; B.pending = pending; B.settled = settled; B.hasUI = HAS_UI;
  if (typeof window !== 'undefined') window.BOOT = B;
  if (typeof module !== 'undefined') module.exports = B;
  rec('boot.js');
  phase('scripts', 'reading the scripts');
  rotate();
})();
