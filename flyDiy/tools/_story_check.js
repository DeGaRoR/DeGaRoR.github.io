// _story_check.js - GATE STORY (G2741 STORY-CORE): the tutorial's beats T0-T7 on the career document, pure.
//   node tools/_story_check.js [--selftest]      -> "GATE STORY: PASS|FAIL"
// Holds:
//   - the roles: a strip the user tags (role) or names "cabin" plays the cabin; the fallback ids; a role nothing plays
//     resolves to null, and the beat that needs it is refused with its reason;
//   - the whole run T0 -> open with the page's events, the effects each beat hands the page, the job list held until
//     the end (Q1), the mask per beat;
//   - the refusals: a wreck, the wrong field, the wrong plane, a checklist item missing, over budget, a jobDone before
//     the jobs beat;
//   - the save: storyNormalise(JSON round trip) is the same document; careerNormalise keeps the story; a career
//     without a story (and the sandbox) has no rails;
//   - the island today: which aerodrome plays each role (printed; the cabin may be null until the user names it).
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(__dirname, 'flight_core.js'));
const SELF = process.argv.includes('--selftest');

function run(M) {
  M = M || C;
  const fails = [];
  const ok = (c, what, x) => { if (!c) fails.push(what); if (!SELF) console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what + (x != null ? '  [' + x + ']' : '')); };
  const aeros = [{ id: 'HOME', name: 'Jolene AFB 13/31', kind: 'strip' }, { id: 'w6', name: 'strip 11', kind: 'strip' },
                 { id: 'SEA', name: 'Greywater Dock', kind: 'water' }, { id: 'w9', name: 'Cabin Strip', kind: 'strip' }];
  // ---- the roles
  ok(M.storySite('cabin', aeros) === 'w9', 'the cabin: the strip the user NAMED "Cabin Strip"');
  ok(M.storySite('cabin', aeros.concat([{ id: 'w8', name: 'strip 13', kind: 'strip', role: 'cabin' }])) === 'w8', 'a role tag wins over a name');
  ok(M.storySite('cabin', aeros.filter(a => a.id !== 'w9')) === null, 'no cabin and no remote fallback on the island: null (never HOME)');
  const remote = aeros.filter(a => a.id !== 'w9').concat([{ id: 'w3', name: 'Tamgas Hill Strip', kind: 'strip' }, { id: 'nv_strip', name: 'East Point Clearing', kind: 'strip' }]);
  ok(M.storySite('cabin', remote) === 'nv_strip' && M.storySite('cabin', remote.filter(a => a.id !== 'nv_strip')) === 'w3',
     'no strip named Cabin yet: the remote fallback, East Point Clearing then Tamgas Hill (the user: "the middle of nowhere")');
  ok(M.storySite('home', aeros) === 'HOME' && M.storySite('client', aeros) === 'w6' && M.storySite('water', aeros) === 'SEA', 'home, the owner\'s strip and the water by their fallbacks');
  ok(M.storySite('nope', aeros) === null, 'an unknown role: null');
  // ---- the documents
  const cubFile = fs.readdirSync(path.join(ROOT, 'builds')).find(f => /^cub_.*\.json$/.test(f) && !/edits|corrected/.test(f));
  const cub = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', cubFile), 'utf8')).spec;
  const base = JSON.parse(JSON.stringify(cub));                     // the client's Cub as it ARRIVES: unfinished
  base.controls.flap = { type: 'none', span: 0, chord: 0 }; base.systems = { fit: 'minimal' }; base.paint = Object.assign({}, base.paint, { job: 'bare' });
  const other = Object.keys(C.POWERPLANTS).find(k => k !== base.engines[0].type);
  const done = JSON.parse(JSON.stringify(base));                    // ... and as the player delivers it
  done.engines[0].type = other; done.controls.flap = { type: 'plain', span: 0.4, chord: 0.25 };
  done.gear.wheelR = +base.gear.wheelR * 1.3; done.systems = { fit: 'basic' }; done.paint = Object.assign({}, base.paint, { job: 'full', base: 0x2244aa });
  let d = M.careerNormalise(M.careerNew({ id: 't', seed: 'story', name: 'gate' }));
  ok(M.storyOf(d) === null && M.storyJobsOpen(d) && M.storyMask(d) === null, 'a career without a story: no rails, jobs open, no mask');
  ok(!M.storyStep(d, { k: 'ack' }, { aeros }).ok, 'storyStep refuses a career without a story');
  let r = M.storyStart(d, 'ul');
  ok(r.ok && M.storyOf(r.doc).beat === 'T0' && M.storyOf(r.doc).planes.starter === 'ul', 'storyStart: T0, the starter bound');
  ok(!M.storyStart(r.doc, 'ul').ok, 'storyStart twice: refused');
  d = r.doc;
  ok(!M.storyJobsOpen(d) && M.storyMask(d) === 'finish', 'T0: the job list held (Q1), the mask "finish"');
  const step = (ev, what, want) => { const x = M.storyStep(d, ev, { aeros }); ok(x.ok === want, what, x.why); if (x.ok) d = x.doc; return x; };
  const stop = (aero, extra) => M.careerStopRecord(Object.assign({ how: 'stopped', aero, row: { from: 'w9', to: aero, t: 600 } }, extra || {}));
  // T0
  step({ k: 'jobDone', id: 'x' }, 'T0: a delivered job does not move the cabin beat', false);
  r = step({ k: 'ack' }, 'T0 -> T1 on the read', true);
  ok(M.storyOf(d).beat === 'T1' && r.advanced.join() === 'T0', 'T1: the move');
  // T1
  step({ k: 'stop', stop: stop('w6'), slot: 'ul' }, 'T1: a landing elsewhere is refused', false);
  step({ k: 'stop', stop: stop('HOME', { wrecked: true, how: 'crashed' }), slot: 'ul' }, 'T1: a wreck at HOME is refused', false);
  step({ k: 'stop', stop: stop('HOME'), slot: 'other' }, 'T1: another plane is refused', false);
  r = step({ k: 'stop', stop: stop('HOME'), slot: 'ul' }, 'T1: the ultralight stopped at HOME moves the story', true);
  ok(r.effects.some(e => e.k === 'hangar' && e.at === 'home') && r.effects.some(e => e.k === 'clientPlane' && e.beat === 'T2'), 'T1 done: the hangar effect; T2 entered: the client plane effect', JSON.stringify(r.effects));
  ok(M.storyMask(d) === 'checklist', 'T2: the mask "checklist"');
  // T2
  step({ k: 'bind', role: 'client', slot: 'client-cub', spec: base }, 'T2: the page binds the client\'s plane (its spec as it arrived)', true);
  const half = JSON.parse(JSON.stringify(done)); half.controls.flap = { type: 'none' };
  r = step({ k: 'certified', slot: 'client-cub', spec: half, cost: 5000 }, 'T2: a build without flaps is refused', false);
  ok(/flaps/.test(r.why || ''), 'T2: the refusal names the missing item', r.why);
  step({ k: 'certified', slot: 'client-cub', spec: done, cost: 12000 }, 'T2: over budget is refused', false);
  step({ k: 'certified', slot: 'ul', spec: done, cost: 5000 }, 'T2: another plane is refused', false);
  const list = M.storyChecklist(done, base, ['engine', 'flaps', 'tyres', 'lights', 'panel', 'paint']);
  ok(list.every(x => x.ok), 'the checklist on the delivered Cub: every item met', list.filter(x => !x.ok).map(x => x.k).join());
  ok(M.storyChecklist(base, base, ['engine', 'flaps', 'tyres', 'lights', 'panel', 'paint']).every(x => !x.ok), 'the checklist on the Cub as it arrived: every item open');
  step({ k: 'certified', slot: 'client-cub', spec: done, cost: 8000 }, 'T2: the checklist met on budget', true);
  // T3
  step({ k: 'stop', stop: stop('HOME'), slot: 'client-cub' }, 'T3: HOME is not the owner\'s strip', false);
  r = step({ k: 'stop', stop: stop('w6'), slot: 'client-cub' }, 'T3: delivered at the owner\'s strip', true);
  ok(r.effects.some(e => e.k === 'giftPlane' && e.beat === 'T4'), 'T4 entered: the gift effect');
  // T4
  step({ k: 'ack' }, 'T4: read', true);
  ok(M.storyOf(d).planes.gift === 'client-cub', 'the gift: the client\'s Cub is the story\'s gift plane');
  // T5
  step({ k: 'jobDone', id: 'a' }, 'T5: job 1 counted (not met yet)', true);
  step({ k: 'jobDone', id: 'b' }, 'T5: job 2 counted', true);
  ok(M.storyOf(d).beat === 'T5' && M.storyOf(d).jobs === 2, 'T5: still on the beat at 2 of 3');
  step({ k: 'jobDone', id: 'c' }, 'T5: job 3 moves the story', true);
  // T6
  step({ k: 'stop', stop: stop('SEA'), slot: 'client-cub', gear: 'wheels' }, 'T6: on wheels at the seaplane base is refused', false);
  r = step({ k: 'stop', stop: stop('SEA'), slot: 'client-cub', gear: 'floats' }, 'T6: the Cub on floats at the seaplane base', true);
  ok(r.effects.some(e => e.k === 'routeOffer' && e.plane === 'gift') && r.effects.some(e => e.k === 'occasions' && e.n === 3), 'T6 done: the route offer; T7 entered: the three occasions', JSON.stringify(r.effects));
  ok(!M.storyJobsOpen(d), 'T7: the job list still held');
  // T7
  r = step({ k: 'ack' }, 'T7: read', true);
  const s = M.storyOf(d);
  ok(s.open && s.beat === 'open' && M.storyJobsOpen(d) && M.storyMask(d) === null && r.effects.some(e => e.k === 'open'), 'the rails end: open, the job list open, no mask');
  ok(s.done.join() === 'T0,T1,T2,T3,T4,T5,T6,T7', 'every beat done, in order', s.done.join());
  ok(!M.storyStep(d, { k: 'ack' }, { aeros }).ok, 'an open story refuses steps');
  // the save
  const back = M.careerNormalise(JSON.parse(JSON.stringify(d)));
  ok(JSON.stringify(M.storyOf(back)) === JSON.stringify(M.storyOf(d)) && JSON.stringify(M.storyNormalise(JSON.parse(JSON.stringify(back.career.story)))) === JSON.stringify(back.career.story), 'saved and reloaded: the story unchanged (careerNormalise keeps it)');
  ok(JSON.stringify(M.storyNormalise({ beat: 'T9', done: ['T1', 'zz', 'T0'], jobs: -2 })) === JSON.stringify(Object.assign(M.storyNew(), { done: ['T0', 'T1'] })), 'a damaged story normalises (unknown beat -> T0, unknown ids dropped, in order)');
  const sand = M.playerNormalise(M.playerMigrate(M.playerDefault()));
  ok(M.storyOf(sand) === null && M.storyJobsOpen(sand) && !M.storyStart(sand).ok, 'the sandbox: no story, no rails, cannot start one');
  // the island today: who plays which role (the cabin is the user's to name; printed, not held)
  try { const w = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'map_pack.js'), 'utf8'), { window: w });
    const L = (w.MAP_PACK && w.MAP_PACK.aerodromes) || [];
    if (!SELF) console.log('  the island today: ' + Object.keys(M.STORY_ROLES).map(k => k + ' = ' + (M.storySite(k, L) || 'none yet')).join(', '));
  } catch (e) { if (!SELF) console.log('  (the island\'s roles not read: ' + e.message + ')'); }
  return fails;
}

if (!SELF) {
  const f = run();
  console.log(f.length ? f.length + ' failing' : 'all story rows hold');
  console.log('GATE STORY: ' + (f.length ? 'FAIL' : 'PASS'));
  process.exit(f.length ? 1 : 0);
} else {
  const brk = (name, fn) => Object.assign({}, C, { [name]: fn });
  const breaks = [
    ['a stop anywhere counts', brk('storyStep', (doc, ev, ctx) => (ev && ev.k === 'stop' && ev.stop) ? C.storyStep(doc, Object.assign({}, ev, { stop: Object.assign({}, ev.stop, { aero: C.storySite(C.STORY_BEATS.find(b => b.id === C.storyOf(doc).beat).goal.at || 'home', ctx.aeros) }) }), ctx) : C.storyStep(doc, ev, ctx))],
    ['the cabin falls back to HOME', brk('storySite', (role, L) => C.storySite(role, L) || (role === 'cabin' ? 'HOME' : null))],
    ['the job list is never held', brk('storyJobsOpen', () => true)],
    ['the checklist always passes', brk('storyChecklist', (S, B, items) => (items || []).map(k => ({ k, words: k, ok: true })))],
  ];
  let bad = 0;
  for (const [what, M] of breaks) { const f = run(M); console.log('  ' + (f.length ? 'caught ' : 'MISSED ') + what + (f.length ? ' (' + f[0] + ')' : '')); if (!f.length) bad++; }
  console.log('GATE STORY --selftest: ' + (bad ? 'FAIL' : 'PASS') + ' (' + breaks.length + ' breaks)');
  process.exit(bad ? 1 : 0);
}
