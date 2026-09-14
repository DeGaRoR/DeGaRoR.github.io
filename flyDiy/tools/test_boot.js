#!/usr/bin/env node
// GATE BOOT - the loading screen's brain, alone (LOADING chantier S1, 2026-09-14)
//
// src/viewer/boot.js in a vm with a DOM stub that knows ONLY the #boot* ids
// (any other id throws: a boot step must not touch the page) and the
// harness's own event loop: setTimeout fires at once, so the step chain,
// the watchdogs and the picture rotation all run their synchronous shape.
// Asserts, in order:
//   1  the chain runs every step in order; a throwing step is logged into the
//      note and the chain goes on (a boot is never fatal)
//   2  ready() waits for the REQUIRED keys only; a required key nobody
//      expected is nothing to wait for; an optional key never blocks
//   3  landed(k, false) is a landing (it balances) and is listed as failed
//   4  three quiet frames after the last landing tear the overlay down - not
//      before; a landing in between resets the count
//   5  whenReady() resolves, FLYDIY_READY is that promise, done() ran
//   6  the watchdogs are armed and INERT at zero elapsed (no recursion under
//      an immediate setTimeout); fail() lists what never landed and lifts
//   7  show('rollout') re-arms everything for a second set
//   8  img() dedupes a shared Image and answers a broken one as failed
// Prints GATE BOOT: PASS|FAIL, exits non-zero on FAIL.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'boot.js'), 'utf8');

function el(id) {
  const set = new Set();
  return { id, hidden: false, textContent: '', style: {}, children: [], src: '',
    classList: { add: (...c) => c.forEach(x => set.add(x)), remove: (...c) => c.forEach(x => set.delete(x)),
                 contains: x => set.has(x), toString: () => [...set].join(' ') },
    setAttribute(k, v) { this['@' + k] = v; }, getAttribute(k) { return this['@' + k]; },
    addEventListener(k, f) { (this.ev = this.ev || {})[k] = f; },
    get firstElementChild() { return this.children[0] || null; } };
}
const KNOWN = ['boot', 'bootShots', 'bootVeil', 'bootPanel', 'bootBrand', 'bootPhase', 'bootBar', 'bootTick', 'bootNote', 'bootSkip'];
const els = {};
let timers = 0, maxDepth = 0, depth = 0;
const errs = [];
const sandbox = {
  // the throwing step's console.error is expected, and counted rather than printed
  console: { log: console.log, warn: console.warn, error: (...a) => errs.push(a[0]) },
  document: { getElementById: id => { if (!KNOWN.includes(id)) throw new Error('boot.js touched #' + id + ' - only the #boot* ids are its own'); return els[id] || (els[id] = el(id)); } },
  setTimeout: cb => { timers++; depth++; maxDepth = Math.max(maxDepth, depth); if (depth > 200) throw new Error('setTimeout recursion'); try { cb(); } finally { depth--; } return 0; },
  clearTimeout() {},
  performance: { now: () => sandbox.__t },
  __t: 0,
};
sandbox.window = sandbox;
// the bar's fill and two figures of each set, as build.js writes them
els.bootBar = el('bootBar'); els.bootBar.children = [el('fill')];
els.bootShots = el('bootShots');
for (const set of ['garage', 'garage', 'rollout', 'rollout']) { const f = el('fig'); f.setAttribute('data-set', set); els.bootShots.children.push(f); }
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'boot.js' });
const B = sandbox.BOOT;
const fail = m => { console.log('  FAIL: ' + m); console.log('GATE BOOT: FAIL'); process.exit(1); };
const ok = m => console.log('  ok: ' + m);
if (!B || typeof B.run !== 'function') fail('window.BOOT not defined');
if (!B.hasUI) fail('the stub DOM was not recognised as the overlay');
if (!els.bootShots.children[0].classList.contains('on')) fail('the first picture is not on at eval');
ok('BOOT defined, first picture on, a phase set: ' + els.bootPhase.textContent);

// ---- 1: the chain -------------------------------------------------------
const ran = [];
let doneRan = 0;
B.run([
  { id: 'a', label: 'step a', w: 2, fn: () => ran.push('a') },
  { id: 'b', label: 'step b', w: 1, fn: () => { ran.push('b'); throw new Error('b broke'); } },
  { id: 'c', label: 'step c', w: 3, fn: () => { ran.push('c'); B.expect('props', 2); B.expect('crew'); B.expect('trees'); } },
], { set: 'garage', require: ['props', 'crew', 'skin'], done: () => doneRan++ });
if (ran.join('') !== 'abc') fail('steps ran as ' + ran.join(','));
if (B.state !== 'landing') fail('state after the chain is ' + B.state);
if (!B.log.some(e => e.k === 'error' && e.id === 'b')) fail('the throwing step was not logged');
if (!errs.some(m => /boot step b/.test(m))) fail('the throwing step was not reported on the console');
if (els.bootNote.hidden || !/b broke/.test(els.bootNote.textContent)) fail('the note does not carry the error');
ok('three steps in order, the throwing one logged and skipped, state landing');

// ---- 2, 3, 4: the aggregator and the quiet frames ----------------------
for (let i = 0; i < 5; i++) B.frame();
if (B.state !== 'landing') fail('lifted with props 0/2 and crew 0/1 pending');
B.landed('props'); B.landed('props', false, 'bandsaw');
for (let i = 0; i < 5; i++) B.frame();
if (B.state !== 'landing') fail('lifted with crew pending');
if (!B.pending().some(p => /crew/.test(p))) fail('pending() does not name the crew: ' + B.pending());
B.landed('crew');
B.frame(); B.frame();
if (B.state !== 'landing') fail('lifted after two quiet frames');
B.landed('props');                    // an extra landing resets the quiet count
B.frame(); B.frame();
if (B.state !== 'landing') fail('a landing did not reset the quiet frames');
B.frame();
if (B.state !== 'gone') fail('did not lift on the third quiet frame (state ' + B.state + ', pending ' + B.pending() + ')');
if (!els.boot.classList.contains('gone')) fail('#boot has no .gone');
if (!els.boot.hidden) fail('#boot not hidden after the fade timer');
if (doneRan !== 1) fail('done() ran ' + doneRan + ' times');
if (!B.log.some(e => e.k === 'landed' && e.ok === false)) fail('the failed landing is not in the log');
ok('required keys gate the lift, optional (trees) and never-expected (skin) do not; a failed landing balances; three quiet frames');

// ---- 5: the promise ------------------------------------------------------
let resolved = false;
B.whenReady().then(() => { resolved = true; });
if (!sandbox.FLYDIY_READY) fail('FLYDIY_READY not set');

// ---- 6: watchdogs inert at zero elapsed, fail() lifts with a note ------
const before = timers;
B.show('rollout');
if (els.boot.hidden || els.boot.classList.contains('gone')) fail('show() did not un-hide');
if (els.boot.getAttribute('data-set') !== 'rollout') fail('show() did not set the set');
B.run([{ id: 'w', label: 'world', w: 1, fn: () => { B.expect('fill', 3); } }], { set: 'rollout', require: ['fill'] });
if (B.state !== 'landing') fail('second run did not reach landing');
if (maxDepth > 20) fail('timer recursion depth ' + maxDepth);
B.landed('fill');
B.fail('test');
if (B.state !== 'gone') fail('fail() did not lift');
const f = B.log.filter(e => e.k === 'fail').pop();
if (!f || !f.missing.some(m => /forest 1\/3/.test(m))) fail('fail() did not list the pending key: ' + JSON.stringify(f));
ok('second set shown and run; watchdogs armed (' + (timers - before) + ' timers) without recursion (depth ' + maxDepth + '); fail() lists "the forest 1/3"');

// ---- 8: img() ------------------------------------------------------------
B.show('garage');
B.run([{ id: 'i', label: 'i', w: 1, fn: () => {} }], { set: 'garage', require: ['room'] });
const shared = { complete: false, naturalWidth: 0, src: 'x.jpg', addEventListener(k, fn) { (this.ev = this.ev || {})[k] = fn; } };
B.img(shared, 'room'); B.img(shared, 'room');       // the room and the world's shed share it
if (B.keys.room.expected !== 1) fail('a shared Image was expected twice');
const broken = { complete: true, naturalWidth: 0, src: 'broken.jpg' };
B.img(broken, 'room');
if (B.keys.room.landed !== 1 || B.keys.room.failed !== 1) fail('a broken image did not land as failed');
shared.ev.load();
if (B.keys.room.landed !== 2) fail('the shared image did not land once');
B.frame(); B.frame(); B.frame();
if (B.state !== 'gone') fail('did not lift after the images');
ok('img() dedupes a shared Image, a broken one lands as failed');

setTimeout(() => {}, 0);
Promise.resolve().then(() => {
  if (!resolved) fail('whenReady() did not resolve');
  console.log('GATE BOOT: PASS');
});
