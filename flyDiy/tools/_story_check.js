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
// G2742-G2749 (STORY-PAGE) THE PAGE HALF, headless: app.js's own story half (sliced off the source, run in node over the
// core with a minimal DOM and the build files read off the disk) -
//   - a New career -> storyStart at the cabin strip (the smallest shed, the garage there, HOME held), no cabin -> HOME with
//     the reason on the card; the starter's slot fetched (builds/ first, else the archived candidate) and stood at the cabin;
//   - the beat card (top-left, the garage's look, never centred; no italics, no serif), its OK -> { k: 'ack' };
//   - a stop at HOME with the starter -> T1's hangar ours, T2's client Cub (flaps off, minimal panel, bare, the same engine)
//     in the HOME hangar, bound with its arrival spec, the checklist on the card, the story's line on the arrival card;
//   - the garage's certificate -> T3; Q1 the map's rows held (greyed) and Track refused; the occasions authored, one-time;
//   - the source: every call into the story behind CAREER_DEV, the dev career keeps none, the bench's hook.
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
  step({ k: 'certified', slot: 'client-cub', spec: done, cost: 48745 }, 'T2: over budget is refused (the O-320 finish)', false);
  step({ k: 'certified', slot: 'ul', spec: done, cost: 5000 }, 'T2: another plane is refused', false);
  const list = M.storyChecklist(done, base, ['engine', 'flaps', 'tyres', 'lights', 'panel', 'paint']);
  ok(list.every(x => x.ok), 'the checklist on the delivered Cub: every item met', list.filter(x => !x.ok).map(x => x.k).join());
  ok(M.storyChecklist(base, base, ['engine', 'flaps', 'tyres', 'lights', 'panel', 'paint']).every(x => !x.ok), 'the checklist on the Cub as it arrived: every item open');
  step({ k: 'certified', slot: 'client-cub', spec: done, cost: 35114 }, 'T2: the checklist met on budget (the Jabiru finish)', true);
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
  // ---- G2743 TWO OWNED HANGARS: the cabin granted at the start, HOME locked until T1, send-to between them
  let h = M.careerNormalise(M.careerNew({ id: 'h', seed: 'story2', name: 'gate' }));
  const w0 = h.wallet;
  r = M.storyStart(h, 'ul', { cabin: { aero: 'w1', plot: 'w1' } });
  ok(r.ok && !r.why && r.doc.sheds.w1 && r.doc.sheds.w1.shell === 'field' && r.doc.sheds.w1.base === 'w1' && r.doc.here === 'w1' && r.doc.wallet === w0,
     'the start: the cabin\'s field shed is ours, free, and we are there', r.why);
  ok(M.playerShedLocked(r.doc, 'HOME') && !M.playerGoTo(r.doc, 'HOME').ok && M.playerShedsOpen(r.doc).join() === 'w1', 'HOME is locked until T1: not here, not open');
  h = r.doc;
  const back1 = M.careerNormalise(JSON.parse(JSON.stringify(h)));
  ok(back1.sheds.HOME.locked === 'story' && back1.sheds.w1 && back1.here === 'w1', 'saved and reloaded: the cabin and the lock kept');
  // a plane of ours away at HOME: bring it home / send it home before T1
  h = JSON.parse(JSON.stringify(h)); h.fleet.ul = { hangar: null, aero: 'HOME', kind: 'away' }; h = M.careerNormalise(h);
  const bh = M.playerBringHome(h, 'ul');
  ok(bh.ok && M.playerWhere(bh.doc, 'ul').hangar === 'w1', 'bring it home before T1: to the cabin, never the locked HOME', JSON.stringify(M.playerWhere(bh.doc, 'ul')));
  ok(!M.playerSendTo(h, 'ul', 'HOME').ok, 'send-to HOME before T1: refused (not yours yet)');
  ok(M.playerSendTo(h, 'ul', 'w1').ok, 'send-to the cabin: ok');
  const noPlot = M.storyStart(M.careerNormalise(M.careerNew({ id: 'n', seed: 'n' })), 'ul', { cabin: { aero: 'nv_strip' } });
  ok(noPlot.ok && /no shed/.test(noPlot.why || '') && !M.playerShedLocked(noPlot.doc, 'HOME'), 'a cabin with no plot on offer: the start keeps HOME open and says why', noPlot.why);
  // T0 -> T1 at HOME lifts the lock
  let x = M.storyStep(h, { k: 'ack' }, { aeros }); h = x.doc;
  x = M.storyStep(h, { k: 'stop', stop: stop('HOME'), slot: 'ul' }, { aeros });
  ok(x.ok && !M.playerShedLocked(x.doc, 'HOME') && M.playerShedsOpen(x.doc).join() === 'HOME,w1', 'T1 done: HOME is ours too; both hangars open (HOME first)');
  const st = M.playerSendTo(x.doc, 'ul', 'HOME');
  ok(st.ok && M.playerWhere(st.doc, 'ul').hangar === 'HOME', 'send-to HOME after T1: inside HOME', JSON.stringify(M.playerWhere(st.doc, 'ul')));
  ok(!M.playerSendTo(x.doc, 'ul', 'w5').ok, 'send-to a hangar we do not hold: refused');
  const back2 = M.playerSendTo(st.doc, 'ul', 'w1');
  ok(back2.ok && M.playerWhere(back2.doc, 'ul').hangar === 'w1', 'send-to from INSIDE HOME back to the cabin: moved (not "already inside")', JSON.stringify(M.playerWhere(back2.doc, 'ul')));
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

// ---- THE PAGE HALF (G2742-G2749 STORY-PAGE) -------------------------------------------------------------------------
async function page() {
  const fails = [];
  const ok = (c, what, x) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what + (x != null ? '  [' + x + ']' : '')); };
  const M = C;
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'editor.css'), 'utf8');
  const bench = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'bench.js'), 'utf8');
  const i0 = app.indexOf("G2742-G2749 (STORY-PAGE): THE STORY'S PAGE HALF"), i1 = app.indexOf('  window.FLYDIY_PLAYER = {', i0);
  ok(i0 > 0 && i1 > i0, "app.js: the story's page half is where this gate reads it");
  if (!(i0 > 0 && i1 > i0)) return fails;
  const half = app.slice(app.lastIndexOf('\n', i0) + 1, i1);
  // ---- the source
  ok(/const STORY_PAGE = CAREER_DEV && CAREER_ID === 'main' && typeof storyNewCareer === 'function';/.test(app), "the story rides the player's career alone (the dev career ?career=1 keeps none)");
  const outside = (app.slice(0, i0) + app.slice(i1)).split('\n').filter(l => /\bstory[A-Z]\w*\(/.test(l.replace(/\/\/.*$/, '')));
  const loose = outside.filter(l => !/CAREER_DEV/.test(l));
  ok(outside.length >= 4 && !loose.length, 'every call into the story outside its half is behind CAREER_DEV', outside.length + ' calls' + (loose.length ? '; loose: ' + loose.map(l => l.trim().slice(0, 60)).join(' | ') : ''));
  ok(/if \(CAREER_DEV && born && STORY_PAGE\)[\s\S]{0,400}storyNewCareer\(player/.test(app), 'a New career (careerNew in playerLoad) calls storyNewCareer, before the lift');
  ok(/careerStopApply\(d, how, W, wrecked\); d = c\.doc; out\.career = c; \}\n[^\n]*\n\s*if \(CAREER_DEV && STORY_PAGE && d\.career && out\.career\) d = storyOnFlightEnd\(d, out\);/.test(app), 'the stop meets the story where careerOnStop runs (right after careerStopApply)');
  ok(/if \(STORY_PAGE\) window\.BENCH_CERTIFIED = storyCertified;/.test(half) && /typeof window\.BENCH_CERTIFIED === 'function'\) \{ try \{ window\.BENCH_CERTIFIED\(\); \}/.test(bench), "the bench's airworthiness certificate reaches the story (its hook set only under STORY_PAGE)");
  const card = (css.match(/#stCard \{[^}]*\}/) || [''])[0], all = (css.match(/#stCard[^{]*\{[^}]*\}/g) || []).join('\n');
  ok(/position:fixed/.test(card) && /left:12px/.test(card) && /top:72px/.test(card) && !/translate|left:50%|top:50%|inset:0/.test(all), 'the beat card stands in the top-left corner (never centred)');
  ok(!/italic|serif['";,\s]*[;}]|Georgia|Times/.test(all.replace(/sans-serif/g, '')) && /font-style:normal/.test(card) && /IBM Plex Sans/.test(card) && /var\(--ed-plate\)/.test(card) && /#stCard\) \{/.test(css), "the garage's look: --ed-* tokens, IBM Plex Sans upright, no serif, no italics");
  // ---- the half, run: the core's globals, a minimal DOM, the files off the disk
  const prefs = new Map();
  const els = [];
  const mkEl = tag => { const e = { tag, id: '', hidden: false, dataset: {}, innerHTML: '', _cls: new Set(), attrs: {}, listeners: {},
    classList: { toggle(c) { if (e._cls.has(c)) e._cls.delete(c); else e._cls.add(c); }, contains: c => e._cls.has(c) },
    setAttribute(k, v) { e.attrs[k] = v; }, addEventListener(t, f) { e.listeners[t] = f; } }; els.push(e); return e; };
  const document = { body: { appendChild: e => e }, createElement: mkEl, getElementById: id => els.find(e => e.id === id) || null };
  const aerosCabin = [{ id: 'HOME', name: 'Jolene AFB 13/31', kind: 'strip' }, { id: 'w6', name: 'strip 11', kind: 'strip' },
                      { id: 'SEA', name: 'Greywater Dock', kind: 'water' }, { id: 'w9', name: 'Cabin Strip', kind: 'strip' }];
  const world = { aerodromes: aerosCabin };
  let player = null, stand = null, liveSpec = null, fetched = [];
  const H = Object.assign(Object.create(null), M, {
    STORY_PAGE: true, CAREER_DEV: true, world, document, console: { log() {}, info() {}, warn() {}, error: console.error },
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; }, JSON, Math, Date, Object, Array, String, Number, Set, Map, Promise, Error, isFinite, encodeURI,
    setTimeout, setInterval: () => 0,
    fetch: url => { fetched.push(url); const f = path.join(ROOT, decodeURI(url));
      return Promise.resolve(fs.existsSync(f) ? { ok: true, status: 200, json: () => Promise.resolve(JSON.parse(fs.readFileSync(f, 'utf8'))) } : { ok: false, status: 404 }); },
    prefGet: (k, d) => (prefs.has(k) ? prefs.get(k) : d), prefSet: (k, v) => { prefs.set(k, v); },
    playerSlotNames: () => [...prefs.keys()].filter(k => k.startsWith('flydiy.build.')).map(k => k.slice(13)).sort(),
    playerLoad: () => player, playerSave: () => {}, slotOnStand: () => stand,
    procureLedger: spec => { try { return M.buildGen(M.genMigrateSpec(JSON.parse(JSON.stringify(spec)))).parts.ledger; } catch (e) { return null; } },
  });
  H.window = H;
  H.window.GARAGE_SPEC = { get: () => liveSpec, preview: () => liveSpec, open: n => { stand = n; } };
  H.window.CAGE_JOIN = { export: () => liveSpec };
  vm.createContext(H);
  // `player` is the page's own let: the half assigns it - the shim reads it back through a setter pair
  Object.defineProperty(H, 'player', { get: () => player, set: v => { player = v; }, configurable: true });
  const run = vm.runInContext('(function () {\n' + half + '\n' +
    'return { storyOnFlightEnd, storyCardSync, storyCardNow, storyEvent, storyRecord, storyCertified, stQueue: () => stQueue, line: () => stLine, el: () => stCardEl }; })', H, { filename: 'app.js (the story half)' });
  void run;
  return { fails, ok, H, prefs, els, set: d => { player = d; }, get: () => player, standSet: n => { stand = n; }, specSet: s => { liveSpec = s; }, fetched, half, M, aerosCabin };
}

async function pageRun() {
  const P = await page();
  const { fails, ok, H, prefs, M, aerosCabin } = P;
  if (fails.length) return fails;
  const settle = async () => { for (let i = 0; i < 400; i++) { await new Promise(r => setTimeout(r, 5)); if (!H.window.FLYDIY_STORY || !H.window.FLYDIY_STORY.pending()) { await new Promise(r => setTimeout(r, 5)); if (!H.window.FLYDIY_STORY.pending()) return; } } };
  // ---- a New career with no cabin on the island: HOME, the reason on the card
  {
    const today = (() => { try { const w = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'map_pack.js'), 'utf8'), { window: w }); return (w.MAP_PACK && w.MAP_PACK.aerodromes) || []; } catch (e) { return []; } })();
    const noCab = today.filter(a => M.storySite('cabin', [a]) == null);
    const r = M.storyNewCareer(M.careerNormalise(M.careerNew({ id: 'main', seed: 'gate' })), { aeros: noCab.length ? noCab : [{ id: 'HOME', name: 'Jolene AFB 13/31' }] });
    const K = M.storyCard(r.doc, { aeros: noCab });
    ok(r.ok && r.doc.here === 'HOME' && M.storyOf(r.doc).cabin === null && !r.doc.sheds.HOME.locked && K && K.note === M.STORY_NO_CABIN, 'no cabin on the island: the story starts at HOME, the reason on the beat card (never a guessed strip)', K && K.note);
  }
  // ---- a New career at the cabin: playerLoad's own step (careerNew -> storyNewCareer), then the page half boots
  let d = M.careerNormalise(M.careerNew({ id: 'main', seed: 'gate' }));
  let r = M.storyNewCareer(d, { aeros: aerosCabin });
  d = r.doc;
  ok(r.ok && M.storyOf(d).beat === 'T0' && d.here === 'w9' && d.sheds.w9 && d.sheds.w9.shell === 'field' && d.sheds.w9.base === 'w9' && d.sheds.HOME.locked === 'story',
     'New career -> storyStart at the cabin: the smallest shed (a field shell) at "Cabin Strip", the garage there, the WWII hangar held', JSON.stringify(d.sheds.w9 && d.sheds.w9.dims));
  P.set(d);
  const half = vm.runInContext('(function () {\n' + P.half + '\nreturn { storyOnFlightEnd, storyCardSync, storyRecord, careerAct: null, el: () => stCardEl, line: () => stLine }; })', H)();
  await settle();
  d = P.get();
  const starterFile = M.STORY_FILES.starter.find(f => fs.existsSync(path.join(ROOT, f)));
  ok(prefs.has('flydiy.build.Rufus') && d.fleet.Rufus && d.fleet.Rufus.aero === 'w9' && d.fleet.Rufus.hangar === 'w9' && M.storyOf(d).planes.starter === 'Rufus',
     'the starter: the first file found (builds/ first) written as the slot "Rufus", standing in the cabin\'s shed', starterFile + ' -> ' + JSON.stringify(d.fleet.Rufus));
  ok(P.fetched[0] && P.fetched[0].startsWith('builds/') && P.fetched.slice(-1)[0] === starterFile, 'builds/ is asked before the archived candidate', P.fetched.join(' > '));
  ok(H.window.FLYDIY_STORY.mask() === 'finish' && H.window.FLYDIY_STORY.jobsOpen() === false, "window.FLYDIY_STORY: the tech mask's tutorial mode ('finish' at T0), the job list held");
  // ---- the beat card
  let el = half.el();
  ok(el && el.id === 'stCard' && !el.hidden && /The cabin/.test(el.innerHTML) && /The story · 1 of 8/.test(el.innerHTML) && /data-st="ok"/.test(el.innerHTML) && /not yours yet/.test(el.innerHTML),
     "the beat card: T0's title and brief, the step, the OK (an ack beat), the hangar not ours yet");
  ok(!/<i>|<em>|font-style:\s*italic/.test(el.innerHTML), 'the card writes no italics');
  el.listeners.click({ target: { closest: () => ({ dataset: { st: 'ok' } }) } });
  d = P.get();
  ok(M.storyOf(d).beat === 'T1' && /The move/.test(half.el().innerHTML) && /Land at Jolene AFB with Rufus/.test(half.el().innerHTML) && !/data-st="ok"/.test(half.el().innerHTML),
     "OK sends { k: 'ack' }: T1 on the card, its goal (the stop at HOME with Rufus), no OK", M.storyOf(d).beat);
  // ---- Q1 on the map's record
  const R0 = half.storyRecord(M.careerMapRecord(d, null, {}));
  ok(R0.contracts.length > 0 && R0.contracts.every(c => c.held === true) && R0.story && R0.story.title === 'The move' && R0.story.held === 'after the move-in',
     'Q1: every generated row held on the map ("after the move-in"), the story\'s own goal at the head', R0.contracts.length + ' held');
  const MM = require(path.join(ROOT, 'src', 'viewer', 'map_menu.js'));
  try {
    const w = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'map_pack.js'), 'utf8'), { window: w });
    const A = MM.mapAdapt(R0, w.MAP_PACK, null);
    const html = MM.contractsListHTML(A, {});
    ok(A.story && /class="mmStory"/.test(html) && /The move/.test(html) && /class="mmItem held"/.test(html) && /after the move-in<\/small>/.test(html), 'the map draws the held rows greyed with their tag, and the story\'s goal above them');
  } catch (e) { ok(false, 'the map draws the held rows', e.message); }
  // ---- a stop at HOME with the starter (playerFlightEnd's own order: the arrival, careerStopApply, then the story)
  d = M.playerArrive(d, 'Rufus', 'HOME', {}).doc;
  const stop = M.careerStopRecord({ how: 'stopped', aero: 'HOME', slot: 'Rufus', gear: 'wheels', row: { from: 'w9', to: 'HOME', t: 900 } });
  const out = { slot: 'Rufus', career: { stop, events: [], lines: [] } };
  d = half.storyOnFlightEnd(d, out);
  P.set(d);
  await settle();
  d = P.get();
  const S = M.storyOf(d), cub = d.fleet[S.planes.client || ''] || null;
  ok(S.beat === 'T2' && !d.sheds.HOME.locked && d.ledger.some(l => l.k === 'story' && l.ref === 'HOME'), 'T1 done: the WWII field\'s hangar is ours (the lock lifted, its ledger line)');
  ok(cub && cub.hangar === 'HOME' && M.playerWhere(d, S.planes.client).kind === 'in', "T2: the client's Cub stands in the HOME hangar", S.planes.client + ' ' + JSON.stringify(cub));
  const env = JSON.parse(prefs.get('flydiy.build.' + S.planes.client) || 'null'), base = S.base.client || {};
  const file = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'cub_2026-09-20.json'), 'utf8')).spec;
  ok(env && env.spec && base.controls.flap.type === 'none' && base.systems.fit === 'minimal' && base.paint.job === 'bare' && base.engines[0].type === file.engines[0].type &&
     JSON.stringify(env.spec) === JSON.stringify(base) && d.career.airframes[S.planes.client].owner === 'client',
     "the Cub as it arrives: flaps off, the minimal panel, bare, the same engine; bound with that spec, the client's", base.engines[0].type);
  ok(M.storyChecklist(base, base, M.STORY_BEATS.find(b => b.id === 'T2').goal.checklist).every(x => !x.ok), 'every item of the checklist is open on it (no battery: no lights)');
  ok(out.career.lines.some(l => l.k === 'story' && /hangar is yours/.test(l.text)), "the arrival card carries the story's line", (out.career.lines[0] || {}).text);
  half.storyCardSync(); half.storyCardSync();                       // (the budget is measured once the build held still a tick)
  el = half.el();
  const ticks = (el.innerHTML.match(/<li/g) || []).length;
  const open6 = M.STORY_BEATS.find(b => b.id === 'T2').goal.checklist.map(k => M.STORY_CHECKS[k].words).every(w => el.innerHTML.includes('<li class=""><span class="stTick" aria-hidden="true"></span>' + w.replace(/&/g, '&amp;')));
  ok(/The client's plane/.test(el.innerHTML) && ticks === 8 && open6 && /on budget: 0 of 40000/.test(el.innerHTML), "the card: T2's checklist (six items open, the budget at 0, the certificate)", ticks + ' rows');
  // ---- the garage's certificate on the finished Cub
  const done = JSON.parse(JSON.stringify(base));
  done.engines[0].type = 'jabiru2200_std';                         // a stronger engine, on budget (the 80 hp Jabiru: 35 114)
  done.controls.flap = { type: 'plain', span: 0.4, chord: 0.25 }; done.gear.wheelR = +base.gear.wheelR * 1.3; done.systems = { fit: 'basic' };
  done.paint = Object.assign({}, base.paint, { job: 'full', base: 0x2244aa });
  P.standSet(S.planes.client); P.specSet(done);
  half.storyCardSync();
  const lis = (half.el().innerHTML.match(/<li class="ok"/g) || []).length;
  ok(lis >= 6, 'the card ticks the checklist off the build on the stand', lis + ' ticked');
  H.window.BENCH_CERTIFIED();
  d = P.get();
  const cost = H.window.FLYDIY_STORY.card();
  ok(M.storyOf(d).beat === 'T3' && cost && cost.title === 'The delivery', "the bench's certificate moves T2 (the checklist met, the edit bill on budget): T3 on the card", M.storyOf(d).beat);
  // ---- the occasions: authored, one-time, in the used market
  let o = M.storyApply(d, { k: 'occasions', n: 3 }, {}).doc;
  const occ = M.procureMarketOf(o).filter(L => L.occasion);
  ok(occ.length === 3 && occ.every(L => M.STORY_OCCASIONS.some(A => A.id === L.id) && L.price < L.catalogue && M.procureFlyableAt(M.procureUsedCert(L), L.aero)),
     'T7: three occasions on the market, authored by hand, under the catalogue, flyable where they stand', occ.map(L => L.id + ' ' + L.price).join(', '));
  const file2 = JSON.parse(fs.readFileSync(path.join(ROOT, M.CONTRACT_DESIGNS[occ[1].design].build), 'utf8')).spec;
  o.wallet = 1e6;
  const b = M.procureBuyUsed(o, occ[1].id, { slot: 'Occasion', slotNames: [], fileSpec: file2 });
  ok(b.ok && !M.procureMarketOf(b.doc).some(L => L.id === occ[1].id) && M.procureMarketOf(b.doc).filter(L => L.occasion).length === 2, 'bought once, gone for good (one-time)', b.why || occ[1].id);
  const plain = M.careerNormalise(M.careerNew({ id: 'x', seed: 'gate' }));
  ok(JSON.stringify(M.procureMarketOf(plain)) === JSON.stringify(M.procureMarket('gate', 0, [])), 'a career without the story: the used market exactly as before');
  // ---- Q1 at T5 and after
  const t5 = JSON.parse(JSON.stringify(d)); t5.career.story.beat = 'T5';
  ok(M.STORY_JOBS.every(id => !M.storyJobHeld(t5, id)) && M.careerOfferIds(t5).filter(id => !M.STORY_JOBS.includes(id)).every(id => M.storyJobHeld(t5, id)), "T5: the story's three jobs offered, every other one held");
  const op = JSON.parse(JSON.stringify(d)); op.career.story.beat = 'open'; op.career.story.open = true;
  ok(M.careerOfferIds(op).every(id => !M.storyJobHeld(op, id)) && M.storyCard(op) === null, 'open: nothing held, no card');
  return fails;
}

if (!SELF) {
  (async () => {
    const f = run();
    console.log('  -- the page half (G2742-G2749 STORY-PAGE)');
    let g = [];
    try { g = await pageRun(); } catch (e) { g = ['the page half threw: ' + (e && e.stack || e)]; console.log('  FAIL ' + g[0]); }
    const all = f.concat(g);
    console.log(all.length ? all.length + ' failing' : 'all story rows hold');
    console.log('GATE STORY: ' + (all.length ? 'FAIL' : 'PASS'));
    process.exit(all.length ? 1 : 0);
  })();
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
