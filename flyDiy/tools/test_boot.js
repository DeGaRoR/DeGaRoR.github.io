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
//   G640 (the measured bar and the carousel, with the real boot_cards.js):
//   9  the deck opens on the set's NOW card, next / prev by hand wrap, a
//      picture item crossfades its figure, fetches the NEXT picture's data-src
//      and the place is kept in localStorage; the cards are well-formed
//  10  the bar never goes back - over a run whose step reports a falling
//      count, a sub() count, the landing and the lift (full at the end)
//  11  the weights are MEASURED: a run's step ms are kept, a second run of
//      the same list weighs its steps by them; the words say what the step is,
//      the compile's cold / warm by the shaders' own key
//  12  a settings screen takes the pictures of the scene it covers and opens
//      on its own NOW card
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
    get firstElementChild() { return this.children[0] || null; },
    get lastElementChild() { return this.children[this.children.length - 1] || null; } };
}
const KNOWN = ['boot', 'bootShots', 'bootVeil', 'bootPanel', 'bootBrand', 'bootPhase', 'bootBar', 'bootTick', 'bootNote', 'bootSkip',
  'bootShader', 'bootShaderHead', 'bootShaderText', 'bootShaderBar', 'bootShaderN',   // G567: the cold compile's block
  'bootWhy', 'bootMeter', 'bootPct', 'bootCard', 'bootCardKind', 'bootCardTitle', 'bootCardText', 'bootCardFoot',
  'bootCardPrev', 'bootCardNext', 'bootCardN', 'bootCardTime'];   // G640: the words, the per cent, the carousel
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
  // G640: the measured weights and the deck's place live here
  localStorage: (() => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), _m: m }; })(),
  FLYDIY_BUILD: 'testbuild',
};
sandbox.window = sandbox;
// the bar's fill and two figures of each set, as build.js writes them
els.bootBar = el('bootBar'); els.bootBar.children = [el('fill')];
els.bootShaderBar = el('bootShaderBar'); els.bootShaderBar.children = [el('fill')];
els.bootShots = el('bootShots');
// (G640: each with its image - the first eager, the rest data-src as build.js writes them - and its caption)
['garage', 'garage', 'rollout', 'rollout'].forEach((set, i) => {
  const f = el('fig' + i); f.setAttribute('data-set', set); f.setAttribute('data-txt', 'txt ' + i);
  const im = el('img' + i); im.complete = true; im.setAttribute(i === 0 ? 'src' : 'data-src', 'shot' + i + '.jpg');
  const cap = el('cap' + i); cap.textContent = 'caption ' + i;
  f.children = [im, cap]; els.bootShots.children.push(f);
});
vm.createContext(sandbox);
const cardsSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'boot_cards.js'), 'utf8');
vm.runInContext(cardsSrc, sandbox, { filename: 'boot_cards.js' });   // the same block as the page: the cards ahead of boot.js
vm.runInContext(src, sandbox, { filename: 'boot.js' });
const B = sandbox.BOOT;
const fail = m => { console.log('  FAIL: ' + m); console.log('GATE BOOT: FAIL'); process.exit(1); };
const ok = m => console.log('  ok: ' + m);
if (!B || typeof B.run !== 'function') fail('window.BOOT not defined');
if (!B.hasUI) fail('the stub DOM was not recognised as the overlay');
if (!els.bootShots.children[0].classList.contains('on')) fail('the first picture is not on at eval');
// G640: at eval only the page's one eager picture is fetched - the garage deck fetches one garage picture ahead, never the roll-out's
if (els.bootShots.children.slice(2).some(f => f.children[0].getAttribute('src'))) fail('a roll-out picture was fetched by the garage boot');
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
if (els.bootShots.children[2].children[0].getAttribute('src') !== 'shot2.jpg') fail('the garage lift did not fetch the roll-out\'s first picture ahead');
ok('required keys gate the lift, optional (trees) and never-expected (skin) do not; a failed landing balances; three quiet frames; the roll-out\'s first picture fetched at the lift');

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

// ---- G567: the shaders' block - shown with a count, its words by warm/cold, pending keeps the step alive, hidden on hide
['bootShader', 'bootShaderText', 'bootShaderN'].forEach(k => sandbox.document.getElementById(k));
els.bootShader.hidden = true; els.bootShaderText.textContent = 'cold words';
B.show('rollout', {});
B.shaders(3, 10, false);
if (els.bootShader.hidden) fail('the shaders block did not show');
if (!/3 \/ 10/.test(els.bootShaderN.textContent)) fail('the count reads ' + els.bootShaderN.textContent);
if (!/30\.0%/.test(els.bootShaderBar.children[0].style.width)) fail('the bar is ' + els.bootShaderBar.children[0].style.width);
{ const t0 = B.lastEvent; sandbox.__t += 5000; B.shaders(3, 10, false); if (!(B.lastEvent > t0)) fail('a pending compile did not re-arm the watchdog'); }
B.shaders(4, 10, true);
if (els.bootShaderText.textContent === 'cold words') fail('the warm words were not used');
B.shaders(5, 10, false);
if (els.bootShaderText.textContent !== 'cold words') fail('the cold words did not come back');
B.shaders(null);
if (!els.bootShader.hidden) fail('shaders(null) did not hide the block');
B.shaders(1, 2, false); B.hide();
if (!els.bootShader.hidden) fail('hide() left the shaders block up');
ok('the shaders block: count and bar, warm/cold words, pending re-arms the watchdog, hidden on null and on hide');

// ---- G640 --------------------------------------------------------------
const CARDS = sandbox.BOOT_CARDS;
const KINDS = ['now', 'island', 'game', 'fly', 'garage'];
{
  if (!Array.isArray(CARDS) || CARDS.length < 40) fail('BOOT_CARDS has ' + (CARDS && CARDS.length) + ' cards (40+ wanted)');
  const bad = CARDS.filter(c => !KINDS.includes(c.k) || !c.t || !c.x || (c.t + c.x).length > 260
    || (c.k === 'now' && !['garage', 'rollin', 'rollout', 'settings'].includes(c.set))
    || (c.k !== 'now' && c.set && !['garage', 'rollout', 'any'].includes(c.set)) || (c.when && c.when !== 'cold'));
  if (bad.length) fail('malformed cards: ' + bad.map(c => c.t).join(' | '));
  const kinds = KINDS.map(k => CARDS.filter(c => c.k === k).length);
  if (kinds.some(n => n < 4)) fail('each kind wants 4+ cards: ' + KINDS.map((k, i) => k + ' ' + kinds[i]).join(', '));
  ok(CARDS.length + ' cards well-formed (' + KINDS.map((k, i) => k + ' ' + kinds[i]).join(', ') + ')');
}
// ---- 9: the deck ----------------------------------------------------------
sandbox.localStorage._m.clear();
B.show('garage', { deck: 'garage' });
{
  const first = CARDS.find(c => c.k === 'now' && c.set === 'garage');
  if (els.bootCard.hidden) fail('the carousel is hidden');
  if (els.bootCardTitle.textContent !== first.t) fail('the garage deck opens on "' + els.bootCardTitle.textContent + '", not its NOW card');
  if (!els.bootShots.children[0].classList.contains('on')) fail('the garage deck has no picture behind its first card');
  const n = B._deck.length;
  if (!/^1 \/ \d+$/.test(els.bootCardN.textContent) || n < 20) fail('the deck reads ' + els.bootCardN.textContent);
  if (B._deck.some(it => it.card && it.card.set === 'rollout')) fail('a roll-out card in the garage deck');
  els.bootCardPrev.ev.click();
  if (B._deckI !== n - 1) fail('prev from the first card did not wrap to the last (' + B._deckI + ')');
  els.bootCardNext.ev.click();
  if (B._deckI !== 0) fail('next did not come back to the first');
  // the first picture item: its figure on, its caption the title; the NEXT picture's image fetched
  const pi = B._deck.findIndex(it => it.pic);
  while (B._deckI !== pi) B.card(1);
  const it = B._deck[pi], fi = els.bootShots.children.indexOf(it.pic);
  if (!it.pic.classList.contains('on')) fail('the picture item did not turn its figure on');
  if (els.bootCardTitle.textContent !== 'caption ' + fi || els.bootCardText.textContent !== 'txt ' + fi) fail('the picture card reads ' + els.bootCardTitle.textContent + ' / ' + els.bootCardText.textContent);
  const nx = B._deck.slice(pi + 1).concat(B._deck.slice(0, pi)).find(x => x.pic);
  if (nx && nx.pic.children[0].getAttribute('src') !== nx.pic.children[0].getAttribute('data-src')) fail('the next picture was not fetched one turn ahead');
  const st = JSON.parse(sandbox.localStorage.getItem('flydiy.boot.deck') || '{}');
  if (!st.garage || !(st.garage.c > 0) || !(st.garage.p > 0)) fail('the deck place was not kept: ' + JSON.stringify(st));
  // a second deal starts past what was read
  const firstPool = B._deck.find(x => x.card && x.card.k !== 'now');
  B.show('garage', { deck: 'garage' });
  const again = B._deck.find(x => x.card && x.card.k !== 'now');
  if (again.card === firstPool.card) fail('a second load dealt the same first card');
  ok('the deck: NOW card first, prev/next wrap, a picture item crossfades and fetches the next one, the place kept (' + n + ' items)');
}
// ---- 10 + 11: the bar and the weights ---------------------------------------
{
  const fill = els.bootBar.children[0];
  const shownAt = () => B._anim.from + (B._anim.to - B._anim.from) * (B._anim.dur > 0 ? Math.min(1, Math.max(0, (sandbox.__t - B._anim.t0) / B._anim.dur)) : 1);
  let last = -1, backs = 0, samples = 0;
  const probe = () => { const v = shownAt(); if (v < last - 1e-6) { backs++; if (process.env.DBG) console.log("back", sandbox.__t, v, last, JSON.stringify(B._anim)); } last = Math.max(last, v); samples++;
    const m = /scaleX\(([\d.]+)\)/.exec(fill.style.transform || ''); if (!m) fail('the fill has no scaleX: ' + fill.style.transform); if (+m[1] < v - 1e-4) backs++; };   // (the style carries 4 decimals)
  const adv = ms => { for (let i = 0; i < ms; i += 50) { sandbox.__t += 50; B.frame(); probe(); } };
  B.show('rollout', {});
  const list = [
    { id: 'world', label: 'world', w: 20, fn: () => { adv(3000); } },
    { id: 'ring', label: 'ring', w: 30, fn: () => { B.phase('ring', 'ring 5/10', 0.5); probe(); adv(400); B.phase('ring', 'ring 5/40', 0.125); probe(); adv(400); } },
    { id: 'compile', label: 'compile', w: 20, fn: () => { B.sub(0.3); probe(); adv(500); B.sub(0.9); probe(); adv(200); } },
  ];
  sandbox.localStorage.removeItem('flydiy.shaders.warm:world');
  B.run(list, { set: 'rollout', require: ['fill'], quietFrames: 1 });
  if (B.state !== 'landing') fail('the measured run did not reach landing');
  B.expect('fill', 2); adv(300); B.landed('fill'); adv(300); B.landed('fill');
  if (els.bootWhy.textContent === '') fail('no words for the landing');
  adv(100);
  if (B.state !== 'gone') fail('the measured run did not lift (' + B.state + ')');
  if (backs) fail('the bar went back ' + backs + ' times in ' + samples + ' samples');
  if (!/scaleX\(1\.0000\)/.test(fill.style.transform) || els.bootPct.textContent !== '100 %') fail('the bar is not full at the lift: ' + fill.style.transform + ' ' + els.bootPct.textContent);
  ok('the bar never went back over ' + samples + ' samples (a falling ring count, sub(), the landing), full at the lift');
  const h = JSON.parse(sandbox.localStorage.getItem('flydiy.boot.ms') || '{}'), rowK = 'rollout:world:3', r = h[rowK];
  if (!r || !(r.world >= 2900 && r.world <= 3100) || !(r.ring > 700) || !(r['compile:cold'] > 600) || r.compile || !(r._landing > 0)) fail('the step ms were not kept (a cold compile is its own row): ' + JSON.stringify(h));
  B.show('rollout', {});
  let whyCompile = '';
  const list2 = list.map(s => Object.assign({}, s, { fn: s.id === 'compile' ? () => { whyCompile = els.bootWhy.textContent; } : () => {} }));
  B.run(list2, { set: 'rollout', require: [] });
  const want = r.world + r.ring + r['compile:cold'];
  if (!(Math.abs(B.weights - want) <= 1)) fail('the second run weighs ' + B.weights + ', the kept ms sum to ' + want);
  if (!/first visit only/.test(whyCompile)) fail('the cold compile reads: ' + whyCompile);
  B.frame(); B.frame();
  sandbox.localStorage.setItem('flydiy.shaders.warm:world', 'testbuild');
  B.show('rollout', {});
  B.run(list2, { set: 'rollout', require: [] });
  if (/first visit only/.test(whyCompile) || !whyCompile) fail('the warm compile reads: ' + whyCompile);
  // warm, the compile has no row yet: its `w` x 150 ms x the machine's pace, not the cold one's row
  const pace = JSON.parse(sandbox.localStorage.getItem('flydiy.boot.ms'))._pace;
  if (!(pace >= 0.3 && pace <= 10)) fail('no pace was kept: ' + pace);
  if (!(Math.abs(B.weights - (r.world + r.ring + 20 * 150 * pace)) <= 1)) fail('the warm run weighs ' + B.weights + ' (the cold compile\'s row leaked into it?)');
  B.frame(); B.frame();
  if (maxDepth > 20) fail('timer recursion depth ' + maxDepth);
  ok('the weights are the kept ms (' + Math.round(want) + ' ms for the list), the words cold then warm');
}
// ---- 12: the settings screen ----------------------------------------------
{
  B.show('settings', { shots: 'rollout' });
  const now = CARDS.find(c => c.k === 'now' && c.set === 'settings');
  if (els.bootCardTitle.textContent !== now.t) fail('the settings deck opens on ' + els.bootCardTitle.textContent);
  const on = els.bootShots.children.filter(f => f.classList.contains('on'));
  if (on.length !== 1 || on[0].getAttribute('data-set') !== 'rollout') fail('the settings screen shows ' + on.map(f => f.getAttribute('data-set')).join(','));
  if (!on[0].children[0].getAttribute('src')) fail('the settings screen\'s picture was never fetched');
  B.hide();
  // the procedural world is no island: its roll-out deals no island card and its words say "the world"
  B.show('rollout', {});
  const isl = B._deck.filter(it => it.card && it.card.k === 'island').length;
  sandbox.FLYDIY_WORLD = 'none';
  B.show('rollout', {});
  if (!isl || B._deck.some(it => it.card && it.card.k === 'island')) fail('the island cards (' + isl + ') ride the procedural world\'s roll-out');
  let wordsW = '';
  B.run([{ id: 'world', label: 'world', w: 1, fn: () => { wordsW = els.bootWhy.textContent; } }], { set: 'rollout', require: [] });
  if (/island/.test(wordsW) || !/the world/.test(wordsW)) fail('the procedural world\'s words: ' + wordsW);
  delete sandbox.FLYDIY_WORLD; B.hide();
  ok('a settings screen over the world wears the world\'s pictures and its own NOW card; the procedural world deals no island card');
}

// ---- 13: a lifted screen's chain does not run a newer screen's -------------
let release = null, newRan = 0;
{
  // (first: a lifted run's chain finishes QUIETLY - no second 'landing', no second done(); a thenable
  // resolved by hand keeps the harness synchronous)
  let done0 = 0; const th = { then(res) { this.res = res; } };
  B.show('rollout', {});
  B.run([{ id: 'upload', label: 'upload', w: 1, fn: () => th }], { set: 'rollout', require: [], done: () => done0++ });
  B.fail('hard timeout');
  th.res();
  if (B.state !== 'gone' || done0 !== 1 || B.busy()) fail('a lifted run\'s chain came back: state ' + B.state + ', done() ran ' + done0 + ' times, busy ' + B.busy());
  ok('a run the watchdog lifted finishes its chain quietly (one done(), still gone, not busy)');
}
{
  B.show('rollout', {});
  B.run([{ id: 'upload', label: 'upload', w: 1, fn: () => new Promise(r => { release = r; }) }, { id: 'frames', label: 'frames', w: 1, fn: () => {} }], { set: 'rollout', require: [] });
  B.fail('hard timeout');                                    // the watchdog lifts it; its chain is still in 'upload'
  if (!B.busy()) fail('busy() does not see the lifted chain');
  B.show('settings', { shots: 'rollout', steps: [{ id: 'compile', label: 'the new settings', w: 1, fn: () => { newRan++; return new Promise(() => {}); } }] });
  B.phase('upload', 'uploading the textures 85 / 145', 0.6);   // the old step still ticking
  if (/uploading/.test(els.bootPhase.textContent)) fail('the old step\'s count shows on the new screen: ' + els.bootPhase.textContent);
  release(); }
setTimeout(() => {}, 0);
Promise.resolve().then(() => Promise.resolve()).then(() => {
  if (B.stepI !== 1 || B.doneW !== 0 || !B.current || B.current.id !== 'compile' || newRan !== 1) fail('the old chain advanced the new one (step ' + B.stepI + ', done ' + B.doneW + ', at ' + (B.current && B.current.id) + ', ran ' + newRan + ')');
  B.hide();
  ok('a lifted screen\'s chain finishing under a newer one neither advances it nor speaks on it');
  if (!resolved) fail('whenReady() did not resolve');
  console.log('GATE BOOT: PASS');
});
