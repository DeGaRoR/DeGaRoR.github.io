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
// G3380-G3389 (STORY-INTRO) THE OPENING, headless: the story half's opening doors run over story_intro.js (the lazy module,
// loaded into the same context) -
//   - armed by a New career alone (playerLoad's stIntroArm, set once), ONCE; never by a Continue, the phone, ?intro=0;
//   - the black curtain under the loading screen and the module asked for; the world's exposure, the room's air off and
//     the radio held while it plays; all of it put back at the swap;
//   - the plan on the Cabin Strip's own record (the island fixture): three shots, 25-40 s, the eye over the ground on a
//     rough terrain, ending on the shed at eye height with the lens closed (the zoom), black at the end;
//   - played to its end -> the garage, the story at T0; Skip -> the garage within the skip's fade, the story at T0;
//   - lazy (no static tag; FLYDIY_LAZY's map names it), the Skip at the bottom edge in the garage's look, the track on disk.
// G3370-G3379 (TUTO-FLIGHT) T1'S LADDER AND ITS SKIP, headless over the same half -
//   - the cards (79_story.js STORY_LADDER): 5-6, keyed for the narrative pack, on the pilot's own phases; a flight from the
//     cabin to HOME steps them in order, one at a time; the player's hand on the controls ends them for the flight;
//   - on the page: Tim's band shows them on T1's flight only (transparent ground), stops on 'flydiy:manual', a roll-out
//     is a new flight; nothing off T1 (T0 in flight, T2 in flight);
//   - "Skip the flight" at the bottom edge on T1 (the shed and in flight): T1 completed as a stop at HOME would (the stop
//     record into the story), the starter in the HOME hangar, the garage there, T2's client Cub fired and standing in it,
//     no money and no logbook row; in flight, the shed door and the flight's end not recorded; refused off T1.
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
  const twoWater = aeros.concat([{ id: 'mk_sea', name: 'Cedar Harbour Seaplane Base', kind: 'water' }]);
  ok(M.storySite('harbour', twoWater) === 'mk_sea' && M.storySite('water', twoWater) === 'SEA' && M.storySite('harbour', aeros) === null &&
     M.storySite('harbour', twoWater.map(a => a.id === 'mk_sea' ? Object.assign({}, a, { role: 'water' }) : a)) === 'SEA',
     "T6's route ends on the OTHER water field (never the one 'water' picked; one water field only: null - never HOME's tarmac)");
  ok(M.STORY_BEATS.find(b => b.id === 'T6').done.some(e => e.k === 'routeOffer' && e.a === 'harbour' && e.b === 'water'), "T6's route: water to water (the floats Cub, G3760's gear law)");
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
  const UL = { ul: { half: 4.7, fwd: 0.9, aft: 5.4 } };   // (G3352) the story's ultralight's footprint (GP_PARKED_FOOT.ul1), as the page hands it
  const bh = M.playerBringHome(h, 'ul', { foots: UL });
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
  const back2 = M.playerSendTo(st.doc, 'ul', 'w1', { foots: UL });
  ok(back2.ok && M.playerWhere(back2.doc, 'ul').hangar === 'w1', 'send-to from INSIDE HOME back to the cabin: moved (not "already inside")', JSON.stringify(M.playerWhere(back2.doc, 'ul')));
  // ---- G3350 STORY-TIM: Tim's lines for every beat; the editor's story lock; the bench never in the small shed
  ok(M.STORY_TIM && M.STORY_TIM.name === 'Tim' && M.STORY_BEATS.every(B => M.storyTimLines(B.id).length >= 1 && M.storyTimLines(B.id).every(l => typeof l === 'string' && l.length > 8)),
     'Tim has a line for every beat (T0-T7)');
  ok(/structure stays as it is/.test(M.storyTimLines('T0').join(' ')) && /once, twice or three times/.test(M.storyTimLines('T0').join(' ')) && /no bench/.test(M.storyTimLines('T0').join(' ')),
     'T0: Tim says the structure waits, the click-depth to the top of the tree, and no bench in the shed');
  ok(/WWII airport/.test(M.storyTimLines('T1').join(' ')) && /never have to/.test(M.storyTimLines('T1').join(' ')), 'T1: Tim calls you to the WWII airport, and the autopilot line');
  { const ED = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'editor.js'), 'utf8'), APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
    ok(/window\.EDITOR_LOCK = \{/.test(ED) && /if \(lockWhy && v !== 'finish'\) \{ lockSync\(\); return; \}/.test(ED), 'the editor holds the finish view while the story locks it (Shape / Design refused)');
    ok(/EDITOR_LOCK\.finishOnly\(m === 'finish' \?/.test(APP), 'the story hands its mask to the editor lock (a story stage: lifted with the mask)');
    ok(/function storyBenchRule\(\)/.test(APP) && /small = !!\(sh && sh\.story\)/.test(APP), 'the bench is hidden in the small story shed, at every beat (a property of the shed)');
    // G3351 (the smoke run of 22 Oct): the TOOL hidden by a body class (the left panel's #edBench), the lock held every tick
    const CSS = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'editor.css'), 'utf8');
    ok(/document\.body\.classList\.toggle\('stNoBench', small\)/.test(APP) && /body\.stNoBench #edBench \{ display: none !important; \}/.test(CSS),
       'the bench TOOL (#edBench, the left panel) is hidden in the small shed by a body class editor.css reads');
    ok(/function storyLockSync\(\)/.test(APP) && /setInterval\(\(\) => \{ try \{[^}]*storyLockSync\(\)/.test(APP) && /storyLockSync\(\); storySkipSync\(\);( storyFloodOn\(\);)? \} catch/.test(APP),
       'the paint-only lock is held to the story mask at boot AND on every tick (a late editor.js still gets it)');
    { const K = M.BASE_OFFERS.w1.plots.w1.kits;
      ok(['wood', 'metal', 'wip', 'store', 'handling', 'comfort', 'curio', 'bench'].every(k => K.includes(k)) && !K.includes('office'),
         'the cabin is the cozy messy workshop: wood + metal machines, the plane and wing in build, store, handling, comfort, curio (G3352)'); }
    // G3353 (the user 22 Oct: "get rid of the large router ... Keep only the 2 smaller ones"): the cabin keeps the pillar
    // drill and the thicknesser; the panel saw, the band saw and the surface planer are left out - and reported so
    { const P = M.BASE_OFFERS.w1.plots.w1, C = M.storyCabinShed('w1', 0).shed, MACH = ['panelsaw', 'bandsaw', 'jointer', 'thicknesser', 'drillpress'];
      ok(JSON.stringify(P.omit) === '["panelsaw","bandsaw","jointer"]' && JSON.stringify(C.omit) === JSON.stringify(P.omit), 'the cabin plot leaves out the big machines, and the story cabin shed carries that list (G3353)');
      const F = M.hangarFit(C.dims, C.kits, { shell: 'field', reg: M.PROP_REG, omit: C.omit }), got = F.placed.map(p => p.prop).filter(k => MACH.includes(k));
      ok(JSON.stringify(got.slice().sort()) === '["drillpress","thicknesser"]' && F.unplaced.filter(u => u.reason === 'left out of this shed').length === 3,
         'the cabin stands two machines, the drill and the thicknesser; the three left out are reported, not silent (' + got.join(', ') + ')');
      ok(/layout: shed\.layout, omit: shed\.omit[,}]/.test(APP) && /omit: opts && opts\.omit \}\);/.test(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'hangar.js'), 'utf8')),
         'the page builds the room with the shed\'s omit list (app.js -> hangar.js -> hangarFit)'); }
    // G3354 (the user 22 Oct: "We need light in the cabin, right now it's a dark hole"): the cabin's work lamp
    { const P = M.BASE_OFFERS.w1.plots.w1, C = M.storyCabinShed('w1', 0).shed, HJ = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'hangar.js'), 'utf8');
      ok(P.workLamp && P.workLamp.cd > 0 && JSON.stringify(C.workLamp) === JSON.stringify(P.workLamp), 'the cabin plot hangs a work lamp, and the story cabin shed carries it (G3354)');
      ok(Array.isArray(P.lampXZ) && P.lampXZ.length === 5 && P.lampXZ.filter(p => Math.abs(p[1]) > 0.1 || Math.abs(p[0]) < 1).every(p => p[0] <= -2.5) && JSON.stringify(C.lampXZ) === JSON.stringify(P.lampXZ),
         'the cabin\'s five fittings: none over the ultralight\'s wing - the wing-line three hang ahead of the leading edge, and the story cabin shed carries the cross (G3354)');
      ok(/omit: shed\.omit, workLamp: shed\.workLamp, lampXZ: shed\.lampXZ \}\)/.test(APP) && /if \(opts && opts\.workLamp && typeof opts\.workLamp === 'object'\)/.test(HJ) && /L\.castShadow = false;\s+L\.position\.y = 0\.12;/.test(HJ),
         'the page hands the work lamp to the room, and the room hangs it with no shadow map (the five fittings\' budget)'); }
    // G3355 (the user 22 Oct: "the cabin flood switched on at the story start; no change to Rufus's file")
    { const BJ = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'bench.js'), 'utf8');
      ok(/function storyFloodOn\(\)/.test(APP) && /s\.beat !== 'T0' \|\| !sh \|\| sh\.story !== 'cabin'/.test(APP) && /U\.P\.lightOn = 1; U\.P\.li_flood = 1; U\.build\(\);/.test(APP)
         && /storySkipSync\(\); storyFloodOn\(\); \} catch \(e\) \{ console\.warn/.test(APP) && /storySkipSync\(\); storyFloodOn\(\); \} catch \(e\) \{\} \}, 1500\)/.test(APP),
         'at T0 in the cabin the cage\'s flood goes on once (the switch, not the build file), at boot or when the garage arrives');
      ok(/li_\(\?:nav\|beacon\|taxi\|land\|flood\|instr\|pedal\|pax\)/.test(BJ), 'the flood switch is bench STATE (G3449), so the T0 flip leaves the certificates standing'); }
    // G3357 (the user 23 Oct: "I see no point in the lines on the top left. Tim feels like he's enough"; "Interior flood
    // light should be ON by default in the garage")
    { const CSS2 = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'editor.css'), 'utf8');
      ok(/classList\.toggle\('stNoCard', !STORY_CARD\)/.test(APP) && /body\.stNoCard #stCard \{ display: none !important; \}/.test(CSS2) && /\[\?&\]storycard=1/.test(APP),
         'the beat card is off the player page (a body class editor.css reads); ?storycard=1 shows it (a dev view)');
      ok(/data-tim="' \+ \(last \? \(ack \? 'ack' : 'ok'\) : 'next'\)/.test(APP) && /b\.dataset\.tim === 'ack'\) \{ stTimShut = true; stLine = ''; storyEvent\(\{ k: 'ack' \}\); \}/.test(APP)
         && /class="stTimRows"/.test(APP) && /data-tim="line"/.test(APP) && /data-tim="open"/.test(APP),
         "Tim's band carries the beat: his last line's OK moves an ack beat, the checklist rides under it, the story's messages are his, a closed band leaves a chip");
      ok(/stMarksOff = want;/.test(APP) && /&& !stMarksOff;/.test(APP) && /var stMarksOff = false;/.test(APP),
         'the CG / neutral-point marks are off while the story holds the paint-only stage (T0)');
      ok(!/n\.id = 'stNoBenchNote'/.test(APP) && /var STORY_BENCH_LINE = 'No test bench in here/.test(APP) && /small && L0\.length \? L0\.concat\(\[STORY_BENCH_LINE\]\) : L0/.test(APP),
         'no bench note in the panel: in the small shed Tim says it, his last line (G3361)'); }
    ok(/id = 'stTim'/.test(APP) && /FLYDIY_AP\.manual\(\) && !inGarage/.test(APP), 'Tim band at the bottom; it steps aside in flight when the player takes manual control');
  }
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
  ok(/const STORY_PAGE = CAREER_DEV && CAREER_ID !== 'dev' && typeof storyNewCareer === 'function';/.test(app), "the story rides the player's careers, every one (G3360), and the dev career ?career=1 keeps none");
  const outside = (app.slice(0, i0) + app.slice(i1)).split('\n').filter(l => /\bstory[A-Z]\w*\(/.test(l.replace(/\/\/.*$/, '')));
  const loose = outside.filter(l => !/CAREER_DEV/.test(l));
  ok(outside.length >= 4 && !loose.length, 'every call into the story outside its half is behind CAREER_DEV', outside.length + ' calls' + (loose.length ? '; loose: ' + loose.map(l => l.trim().slice(0, 60)).join(' | ') : ''));
  ok(/if \(CAREER_DEV && born && STORY_PAGE\)[\s\S]{0,400}storyNewCareer\(player/.test(app), 'a New career (careerNew in playerLoad) calls storyNewCareer, before the lift');
  ok(/careerStopApply\(d, how, W, wrecked\); d = c\.doc; out\.career = c; \}\n[^\n]*\n\s*if \(CAREER_DEV && STORY_PAGE && d\.career && out\.career\) d = storyOnFlightEnd\(d, out\);/.test(app), 'the stop meets the story where careerOnStop runs (right after careerStopApply)');
  ok(/if \(STORY_PAGE\) window\.BENCH_CERTIFIED = storyCertified;/.test(half) && /typeof window\.BENCH_CERTIFIED === 'function'\) \{ try \{ window\.BENCH_CERTIFIED\(\); \}/.test(bench), "the bench's airworthiness certificate reaches the story (its hook set only under STORY_PAGE)");
  const card = (css.match(/#stCard \{[^}]*\}/) || [''])[0], all = (css.match(/#stCard[^{]*\{[^}]*\}/g) || []).join('\n');
  ok(/position:fixed/.test(card) && /left:12px/.test(card) && /top:72px/.test(card) && !/translate|left:50%|top:50%|inset:0/.test(all), 'the beat card stands in the top-left corner (never centred)');
  ok(!/italic|serif['";,\s]*[;}]|Georgia|Times/.test(all.replace(/sans-serif/g, '')) && /font-style:normal/.test(card) && /IBM Plex Sans/.test(card) && /var\(--ed-plate\)/.test(card) && /:is\([^)]*#stCard[^)]*\) \{/.test(css), "the garage's look: --ed-* tokens, IBM Plex Sans upright, no serif, no italics");
  // ---- the half, run: the core's globals, a minimal DOM, the files off the disk
  const prefs = new Map();
  const els = [];
  const mkEl = tag => { const e = { tag, id: '', hidden: false, dataset: {}, innerHTML: '', style: {}, _cls: new Set(), attrs: {}, listeners: {},
    classList: { toggle(c) { if (e._cls.has(c)) e._cls.delete(c); else e._cls.add(c); }, contains: c => e._cls.has(c) },
    setAttribute(k, v) { e.attrs[k] = v; }, addEventListener(t, f) { e.listeners[t] = f; } }; els.push(e); return e; };
  const bodyCls = new Set();
  const document = { body: { appendChild: e => e, classList: { toggle: (c, on) => { if (on === undefined ? !bodyCls.has(c) : on) bodyCls.add(c); else bodyCls.delete(c); }, contains: c => bodyCls.has(c), add: c => bodyCls.add(c), remove: c => bodyCls.delete(c) } },
                     createElement: mkEl, getElementById: id => els.find(e => e.id === id) || null };
  const aerosCabin = [{ id: 'HOME', name: 'Jolene AFB 13/31', kind: 'strip' }, { id: 'w6', name: 'strip 11', kind: 'strip' },
                      { id: 'SEA', name: 'Greywater Dock', kind: 'water' }, { id: 'w9', name: 'Cabin Strip', kind: 'strip' }];
  const world = { aerodromes: aerosCabin };
  let player = null, stand = null, liveSpec = null, fetched = [];
  const H = Object.assign(Object.create(null), M, {
    STORY_PAGE: true, CAREER_DEV: true, world, document, console: { log() {}, info() {}, warn() {}, error: console.error }, stIntroArm: false, location: { search: '' },
    inGarage: true, ap: null, sim: null, flEnded: false, baseId: 'HOME',                  // (G3370: the flight as the ladder and the skip read it)
    _ls: {}, addEventListener(t, f) { (this._ls[t] = this._ls[t] || []).push(f); }, dispatchEvent(ev) { for (const f of this._ls[ev.type] || []) f(ev); },
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
  // G3612: the page's own fleetSlotNames (the lift's slots: a career's own), which the story half's reconciles read
  { const f0 = app.indexOf('  function fleetSlotNames('), f1 = app.indexOf('\n  }\n', f0) + 4;
    if (f0 > 0) vm.runInContext(app.slice(f0, f1), H, { filename: 'app.js (fleetSlotNames)' }); }
  // `player` is the page's own let: the half assigns it - the shim reads it back through a setter pair
  Object.defineProperty(H, 'player', { get: () => player, set: v => { player = v; }, configurable: true });
  const run = vm.runInContext('(function () {\n' + half + '\n' +
    'return { storyOnFlightEnd, storyCardSync, storyCardNow, storyEvent, storyRecord, storyCertified, stQueue: () => stQueue, line: () => stLine, el: () => stCardEl }; })', H, { filename: 'app.js (the story half)' });
  void run;
  return { fails, ok, H, prefs, els, bodyCls, mkEl, set: d => { player = d; }, get: () => player, standSet: n => { stand = n; }, specSet: s => { liveSpec = s; }, fetched, half, M, aerosCabin };
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
  // ---- G3360 (CAREERS): A SECOND CAREER GETS ITS OWN STORY. The page's own reading (app.js, CAREER_DEVFLAG .. STORY_PAGE,
  // run in a vm): the welcome's chosen id is the document's key and carries the story; ?career=1 none; no id = 'main'
  {
    const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
    const j0 = app.indexOf('  const CAREER_DEVFLAG = '), j1 = app.indexOf('\n', app.indexOf('  const STORY_PAGE = ', j0));
    const pageKeys = (search, id) => { const w = { location: { search }, FLYDIY_MODE: search ? null : 'career', FLYDIY_CAREER_ID: id, FLYDIY_CAREER_NAME: id ? 'your career 2' : undefined };
      return vm.runInNewContext('(function () {\n' + app.slice(j0, j1) + '\nreturn { CAREER_ID, PLAYER_KEY, STORY_PAGE, CAREER_BIRTH_NAME }; })()',
        { window: w, careerNew: M.careerNew, careerKey: M.careerKey, storyNewCareer: M.storyNewCareer }); };
    const k2 = pageKeys('', 'cmgz0a1'), kd = pageKeys('?career=1', 'cmgz0a1'), km = pageKeys('', undefined), kx = pageKeys('', 'dev');
    ok(j0 > 0 && k2.CAREER_ID === 'cmgz0a1' && k2.PLAYER_KEY === 'flydiy.career.cmgz0a1' && k2.STORY_PAGE === true && k2.CAREER_BIRTH_NAME === 'your career 2' &&
       kd.CAREER_ID === 'dev' && kd.STORY_PAGE === false && km.CAREER_ID === 'main' && km.STORY_PAGE === true && kx.CAREER_ID === 'main',
       "the page: the welcome's career id is its key (flydiy.career.<id>) and carries the story; ?career=1 the dev career, none; no id (or 'dev') = 'main'",
       [k2.PLAYER_KEY, kd.PLAYER_KEY, km.PLAYER_KEY, kx.PLAYER_KEY].join(', '));
    // two New careers, as playerLoad makes them (careerNew under their ids, then storyNewCareer): each its own story at the
    // cabin; the first's beat moved on leaves the second at T0, and each document round-trips alone
    const born = (id, starter) => M.storyNewCareer(M.careerNormalise(M.careerNew({ id, seed: id, name: id })), { aeros: aerosCabin, starter });
    const A = born('cmgz0a1', 'Rufus'), B = born('cmgz0b2', 'Rufus 2');
    const A1 = M.storyStep(A.doc, { k: 'ack' }, { aeros: aerosCabin });
    const a = A1 && A1.doc ? M.careerNormalise(JSON.parse(JSON.stringify(A1.doc))) : null, b = M.careerNormalise(JSON.parse(JSON.stringify(B.doc)));
    ok(A.ok && B.ok && a && M.storyOf(a).beat === 'T1' && M.storyOf(b).beat === 'T0' && a.career.id === 'cmgz0a1' && b.career.id === 'cmgz0b2' &&
       M.storyOf(b).planes.starter === 'Rufus 2' && b.here === 'w9' && b.sheds.HOME.locked === 'story' && M.careerKey(b.career.id) === 'flydiy.career.cmgz0b2',
       'a second career gets its own story: its own start at the cabin, its own starter slot, at T0 while the first is at T1', M.storyOf(a).beat + ' / ' + M.storyOf(b).beat);
    // the welcome's Continue line ("the story · n of 8") counts the beats the core has
    const ww = { navigator: {} }; ww.window = ww;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'welcome.js'), 'utf8'), Object.assign({ window: ww }, ww));
    ok(ww.WELCOME.careers.STORY_OF === M.STORY_BEATS.length, "the welcome's Continue line counts the story's beats (" + ww.WELCOME.careers.STORY_OF + ' of ' + M.STORY_BEATS.length + ')');
  }
  // ---- a New career at the cabin: playerLoad's own step (careerNew -> storyNewCareer), then the page half boots
  let d = M.careerNormalise(M.careerNew({ id: 'main', seed: 'gate' }));
  let r = M.storyNewCareer(d, { aeros: aerosCabin });
  { const g = (d.ledger || []).some(e => e.k === 'grant');
    ok(r.ok && g && !(r.doc.ledger || []).some(e => e.k === 'grant') && r.doc.wallet === d.wallet - M.CAREER_GRANT + M.STORY_GRANT && M.STORY_GRANT === 0,
       'the story career starts without careerNew\'s grant (G3359: STORY_GRANT 0, its ledger line gone)', r.doc.wallet); }
  d = r.doc;
  ok(r.ok && M.storyOf(d).beat === 'T0' && d.here === 'w9' && d.sheds.w9 && d.sheds.w9.shell === 'field' && d.sheds.w9.base === 'w9' && d.sheds.HOME.locked === 'story',
     'New career -> storyStart at the cabin: the smallest shed (a field shell) at "Cabin Strip", the garage there, the WWII hangar held', JSON.stringify(d.sheds.w9 && d.sheds.w9.dims));
  // G3612 (the user 25 Oct, item 39): a sandbox build already on the shelf when the career is born is NOT the career's
  prefs.set('flydiy.build.Sandbox Jodel', JSON.stringify({ v: 1, spec: {} }));
  P.set(d);
  const half = vm.runInContext('(function () {\n' + P.half + '\nreturn { storyOnFlightEnd, storyCardSync, storyRecord, careerAct: null, el: () => stCardEl, line: () => stLine }; })', H)();
  await settle();
  d = P.get();
  const starterFile = M.STORY_FILES.starter.find(f => fs.existsSync(path.join(ROOT, f)));
  ok(prefs.has('flydiy.build.Rufus') && d.fleet.Rufus && d.fleet.Rufus.aero === 'w9' && d.fleet.Rufus.hangar === 'w9' && M.storyOf(d).planes.starter === 'Rufus',
     'the starter: the first file found (builds/ first) written as the slot "Rufus", standing in the cabin\'s shed', starterFile + ' -> ' + JSON.stringify(d.fleet.Rufus));
  const fetchedS = P.fetched.filter(u => !M.STORY_FILES.client.includes(u));
  ok(fetchedS[0] && fetchedS[0].startsWith('builds/') && fetchedS.slice(-1)[0] === starterFile, 'builds/ is asked before the archived candidate', P.fetched.join(' > '));
  // G3585 (the user 25 Oct: "the client's Cub is already waiting outside"): put on HOME's apron as soon as the starter
  // stands, bound as the client's, quietly (no line for Tim at T0)
  { const cl = M.storyOf(d).planes.client;
    ok(cl && prefs.has('flydiy.build.' + cl) && M.playerStoreWhere(d, cl).kind === 'outside' && M.playerStoreWhere(d, cl).aero === 'HOME' && d.career.airframes[cl] && d.career.airframes[cl].owner === 'client' &&
       M.storyOf(d).beat === 'T0' && !half.line() && M.storyOf(d).base.client && M.storyOf(d).base.client.paint.job === 'bare',
       "T0: the client's Cub already waits outside at HOME (bound, its arrival spec kept, the client's row written before the lift), and nothing is said of it yet", cl + ' ' + JSON.stringify(cl ? M.playerStoreWhere(d, cl) : null)); }
  ok(/from: \(CAREER_DEV && STORY_PAGE && storyFleetFrom\(\)\) \|\| \(inGarage \? rollFromId\(\) : fromId\)/.test(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8')),
     "while it waits (T0 / T1) the fleet's drawn set is HOME's apron: the Cub's prop baked in the cabin's garage, stood at HOME by the roll-out");
  { // G3612 (the user 25 Oct): "a career starts only with its own plane. Any imported plane in the career costs money" /
    // "old careers are reset to only their own planes ... What you import is a design ... it is its own copy"
    const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');   // (pageRun's own app is a block below's)
    const own = M.careerOwnSlots(d, ['Rufus', 'Sandbox Jodel']);
    const copy = M.careerCopyName(d, 'Sandbox Jodel', ['Sandbox Jodel']);
    const r0 = M.careerImport(d, 'Sandbox Jodel', copy, 10000, []);
    const rich = JSON.parse(JSON.stringify(d)); rich.wallet = 1e6;
    const r1 = M.careerImport(rich, 'Sandbox Jodel', copy, 10000, []), r2 = r1.ok ? M.careerImport(r1.doc, 'Sandbox Jodel', copy, 10000, []) : null;
    const sb = M.careerOwnSlots({ mode: 'sandbox' }, ['Rufus', copy, 'Sandbox Jodel']);
    ok(!d.fleet['Sandbox Jodel'] && own.join() === 'Rufus' && copy === 'Sandbox Jodel @' + d.career.id && M.careerSlotTag(copy) && !r0.ok &&
       r1.ok && r1.cost > 0 && r1.doc.wallet === 1e6 - r1.cost && r1.doc.career.airframes[copy].how === 'import' && r1.doc.career.airframes[copy].of === 'Sandbox Jodel' &&
       M.careerOwnSlots(r1.doc, [copy, 'Sandbox Jodel']).join() === copy && M.careerImportable(r1.doc, ['Rufus', copy, 'Sandbox Jodel']).join() === 'Sandbox Jodel' &&
       r2 && !r2.ok && sb.join() === 'Rufus,Sandbox Jodel' && M.careerCopyName(r1.doc, 'Sandbox Jodel', [copy]) === 'Sandbox Jodel 2 @' + d.career.id,
       'a career\'s fleet is its own planes: a sandbox design on the shelf is not lifted in; buying it in is a purchase (refused short of the cash) that makes the career\'s OWN copy (its tagged slot, the design it came from) - the sandbox never lists the copy, a second copy is numbered (G3612)',
       own.join() + ' | ' + copy + ' | ' + (r0.why || '-') + ' | ' + (r1.cost || r1.why));
    ok(M.careerSaveKey(d, 'My Racer', []) === 'My Racer @' + d.career.id && M.careerSaveKey(d, 'Rufus', []) === 'Rufus' && M.careerSaveKey(d, copy, []) === copy &&
       M.careerSaveKey({ mode: 'sandbox' }, 'My Racer', []) === 'My Racer' &&
       /if \(api\.slotKey\) name = api\.slotKey\(name\);/.test(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'garage.js'), 'utf8')),
       'a build saved under a new name in a career garage is the career\'s own slot (tagged); its own names and the sandbox\'s saves stay (G3612)');
    // the reset, once: an older career's row for a slot it never owned leaves at its next lift
    const old = JSON.parse(JSON.stringify(d)); old.fleet['Old Shelf Build'] = { hangar: null, aero: 'HOME' };
    const R = M.playerFleetReconcile(old, M.careerOwnSlots(old, ['Rufus', 'Old Shelf Build']));
    ok(!R.doc.fleet['Old Shelf Build'] && R.doc.fleet.Rufus && R.dropped.indexOf('Old Shelf Build') >= 0,
       'an older career is reset to its own planes: a row for a slot it does not own leaves at the lift (G3612)', JSON.stringify(R.dropped));
    const G = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'garage.js'), 'utf8');
    ok(/player = playerFleetReconcile\(player, fleetSlotNames\(player\)\)\.doc;/.test(APP) && !/playerFleetReconcile\([^)]*playerSlotNames\(\)/.test(APP) &&
       /fleetSlotNames\(playerLoad\(\), names, info\.saved\)/.test(APP) && /ownSlots: names => fleetSlotNames\(playerLoad\(\), names\),/.test(APP) &&
       /const copy = careerCopyName\(playerLoad\(\), name, playerSlotNames\(\)\);/.test(APP) && /prefSet\('flydiy\.build\.' \+ copy, JSON\.stringify\(env\)\);/.test(APP) &&
       /const shelf = slotNames\(\), names = api\.ownSlots \? api\.ownSlots\(shelf\) : shelf;/.test(G) && /const bring = api\.importable \? api\.importable\(shelf\) : \[\];/.test(G),
       'every lift is handed the career\'s own slots (the save just made with them); the purchase writes the copy\'s own envelope; the rack lists its own, the designs bought in (G3612)');
  }
  ok(H.window.FLYDIY_STORY.mask() === 'finish' && H.window.FLYDIY_STORY.jobsOpen() === false, "window.FLYDIY_STORY: the tech mask's tutorial mode ('finish' at T0), the job list held");
  // ---- the beat card
  let el = half.el();
  ok(el && el.id === 'stCard' && !el.hidden && /The cabin/.test(el.innerHTML) && /The story</.test(el.innerHTML) && !/ of \d/.test(el.innerHTML) && /data-st="ok"/.test(el.innerHTML) && /not yours yet/.test(el.innerHTML),
     "the beat card: T0's title and brief, no step counter (G3356: dev-facing), the OK (an ack beat), the hangar not ours yet");
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
  // (G3585, the user 24 Oct: "the Cub is parked outside" - Tim's storage steps swap it onto the stand)
  ok(cub && cub.aero === 'HOME' && M.playerStoreWhere(d, S.planes.client).kind === 'outside', "T2: the client's Cub is parked outside the WWII hangar (HOME's apron)", S.planes.client + ' ' + JSON.stringify(cub));
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

// ---- THE OPENING (G3380-G3389 STORY-INTRO) ---------------------------------------------------------------------------
async function introRun() {
  const P = await page();
  const { fails, ok, H, M, els } = P;
  if (fails.length) return fails;
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const build = fs.readFileSync(path.join(ROOT, 'tools', 'build.js'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'editor.css'), 'utf8');
  const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'story_intro.js'), 'utf8');
  // ---- the source
  ok((app.match(/stIntroArm = true/g) || []).length === 1 && /if \(CAREER_DEV && born && STORY_PAGE\)[\s\S]{0,600}if \(r\.ok\) \{ player = r\.doc; stIntroArm = true; \}/.test(app),
     'the opening is armed by a New career alone (careerNew -> storyNewCareer in playerLoad); a Continue loads its saved document and never arms it');
  ok(/if \(CAREER_DEV && STORY_PAGE\) storyIntroBoot\(\);/.test(app) && /const introAt = CAREER_DEV && STORY_PAGE && inGarage \? storyIntroFrame\(fdt\) : null;/.test(app) && /if \(introAt && WF\) WF\.worldUpdate\(introAt\);/.test(app),
     "it plays as the boot's screen lifts; the loop draws the world from the shed on the cabin's point (no second world)");
  ok(/if \(!GARAGE_ONLY && CAREER_DEV && STORY_PAGE && stIntroEl\) bootStep\('intro', 'the opening', \d+, \(\) => \(CAREER_DEV \? storyIntroPrepare\(\) : null\)\);/.test(app) &&
     /return compileSliced\(scene, aa && aa\.target \? aa\.target\(\) : null, null, false, storyIntroDress\); \}\)\.then\(lap\('compile'\)\)\s*\.then\(\(\) => compileDepthVariants\(scene, true, storyIntroDress\)\)\.then\(lap\('depth'\)\)[\s\S]{0,500}return programsReady\(30000\); \}\)\.then\(lap\('links'\)\)/.test(app),
     "its views linked UNDER THE LOADING SCREEN (a boot step a New career's curtain alone registers: compiled async, every link waited for, then drawn)");
  ok(/try \{ storyIntroLamps\(true\); \}/.test(app) && /try \{ storyIntroLamps\(false\); \} catch \(e\) \{\}/.test(app) && /function storyIntroLamps\(on\) \{[\s\S]{0,900}new THREE\.PointLight\(0xffffff, 0, 2, 1\.6\)/.test(app),
     "G3388: the world wears the aeroplane's light signature (zero-intensity stand-ins) while the opening draws it and while its step compiles - the boot's own programs; off at the swap");
  ok(/\['src\/viewer', 'story_intro\.js'\]/.test(build), "lazy: in build.js's MANIFEST.lazy (FLYDIY_LAZY('story_intro'))");
  const pages = ['index.html', 'dev.html'].map(f => path.join(ROOT, f)).filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8'));
  ok(pages.length && pages.every(h => !/<script[^>]*story_intro/.test(h) && !/var STORY_INTRO = /.test(h) && /"story_intro":"src\/viewer\/story_intro\.js/.test(h)),
     'the pages carry no byte of it but its name in the lazy map (the sandbox never loads it)');
  // ---- the look: the Skip at the bottom edge, the garage's tokens and type, nothing centred
  const I = vm.runInNewContext(src + '\n;STORY_INTRO', { console, Math, Float64Array, isFinite, String, Object, Array, Promise });
  ok(/#stIntro \.siSkip \{[^}]*right:16px; bottom:16px;/.test(I.CSS) && !/translate|left:50%|top:50%|margin:auto/.test(I.CSS) && /IBM Plex Sans/.test(I.CSS) && /font-style:normal/.test(I.CSS) &&
     !/italic|Georgia|Times/.test(I.CSS) && /var\(--ed-plate\)/.test(I.CSS) && /body\.stIntro #c \{ margin-left:0 !important; width:100% !important;/.test(I.CSS) && /:is\([^)]*#stIntro[^)]*\) \{/.test(css),
     "the Skip: the bottom edge (never centred), the garage's look (--ed-* tokens, IBM Plex Sans upright)");
  const ogg = path.join(ROOT, I.MUSIC), ob = fs.existsSync(ogg) ? fs.readFileSync(ogg) : null;
  ok(ob && ob.slice(0, 4).toString() === 'OggS' && ob.indexOf('vorbis') > 0 && ob.length < 600 * 1024 && /^media\/audio\/music\/yoiyami_sunset_plains_intro\.[0-9a-f]{8}\.ogg$/.test(I.MUSIC) && I.CREDIT.licence === 'CC0' &&
     fs.readFileSync(path.join(ROOT, 'CREDITS.md'), 'utf8').includes(I.MUSIC),
     "the music: 'Sunset Plains' by Yoiyami (CC0), Ogg Vorbis under 600 KB, in CREDITS.md", ob && (ob.length / 1024).toFixed(0) + ' KB');
  // ---- the plan on the Cabin Strip's own record (the island fixture's runway w1), over a rough terrain
  const isl = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'fixtures', 'island_jolene.json'), 'utf8'));
  const rwys = []; (function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.id === 'w1' && o.name === 'Cabin Strip' && o.c) rwys.push(o); else Object.values(o).forEach(walk); } })(isl);
  const R = rwys[0];
  ok(!!R, 'the Cabin Strip in the island fixture (runway w1)');
  if (!R) return fails;
  const plot = (R.plots || [])[0] || null;
  const terr = (x, z) => 100 + 30 * Math.sin(x / 140) * Math.cos(z / 170) + 0.04 * Math.hypot(x - R.c[0], z - R.c[1]);
  const aero = { id: 'w9', x: R.c[0], z: R.c[1], hdg: R.hdg, len: R.len, elev: terr(R.c[0], R.c[1]), kind: 'strip', fly: R.fly || null };
  const PL = I.plan({ aero, plot, terrainH: terr });
  let low = Infinity, at = null;
  for (let t = 0; t <= PL.T; t += 0.05) { const o = I.pose(PL, t), g = o.p[1] - terr(o.p[0], o.p[2]); if (g < low) { low = g; at = t; } }
  const end = I.pose(PL, PL.T), shedG = terr(plot.x, plot.z), dEnd = Math.hypot(end.p[0] - plot.x, end.p[2] - plot.z);
  ok(PL.shots.length === 3 && PL.T >= 25 && PL.T <= 40, 'three shots (the valley, the strip, the cabin), 25-40 s', PL.shots.map(s => s.id + ' ' + (s.t1 - s.t0) + ' s').join(', ') + ' = ' + PL.T + ' s');
  ok(low >= 1.0, 'the eye stays over the ground the whole way (a rough terrain)', 'lowest ' + low.toFixed(1) + ' m at ' + at.toFixed(1) + ' s');
  ok(PL.end === 'eye' && dEnd > 30 && dEnd < 40 && end.p[1] - terr(end.p[0], end.p[2]) >= 2 && end.p[1] - terr(end.p[0], end.p[2]) < 6 && end.fov <= 40 && Math.hypot(end.l[0] - plot.x, end.l[2] - plot.z) < 1 && end.black > 0.99,
     'it ends zoomed on the shed at EYE LEVEL (35 m off its door, 3 m over the ground, the horizon in; G3387) at black', dEnd.toFixed(1) + ' m, ' + (end.p[1] - terr(end.p[0], end.p[2])).toFixed(1) + ' m up, fov ' + end.fov.toFixed(0));
  { const PH = I.plan({ aero, plot, terrainH: terr, end: 'high' }), eh = I.pose(PH, PH.T), dh = Math.hypot(eh.p[0] - plot.x, eh.p[2] - plot.z);
    ok(PH.end === 'high' && dh > 38 && dh < 52 && eh.p[1] - shedG >= 15 && eh.p[1] - shedG <= 22 && eh.fov <= 36 && /\[\?&\]introend=\(eye\|high\)/.test(app),
       "G3386's high ending kept as the fallback (ctx.end 'high', ?introend=high)", dh.toFixed(1) + ' m, ' + (eh.p[1] - shedG).toFixed(1) + ' m over the shed'); }
  // THE SIGHTLINE (the third look, 21 Oct: a rise between the eye and the shed hid it): the near shots see their target -
  // on the rough terrain, and with a 6 m rise put between the last eye and the shed
  const seen = (Pl, T) => { let worst = Infinity, at = null;
    for (let t = Pl.shots[1].t0 + 0.6; t < Pl.T - 0.2; t += 0.1) { const o = I.pose(Pl, t);
      for (let f = 0.1; f <= 0.85; f += 0.05) { const x = o.p[0] + (o.l[0] - o.p[0]) * f, z = o.p[2] + (o.l[2] - o.p[2]) * f, y = o.p[1] + (o.l[1] - o.p[1]) * f, g = y - T(x, z); if (g < worst) { worst = g; at = t; } } }
    return { worst, at }; };
  const mid = [(end.p[0] + plot.x) / 2, (end.p[2] + plot.z) / 2];
  const terr2 = (x, z) => terr(x, z) + 6 * Math.max(0, 1 - Math.hypot(x - mid[0], z - mid[1]) / 9);
  const PL2 = I.plan({ aero, plot, terrainH: terr2 }), s1 = seen(PL, terr), s2 = seen(PL2, terr2);
  ok(s1.worst > 0.2 && s2.worst > 0.2, 'the near shots see the shed: the sightline clears the ground (a 6 m rise between the last eye and the shed too)',
     s1.worst.toFixed(1) + ' m at ' + s1.at.toFixed(1) + ' s; with the rise ' + s2.worst.toFixed(1) + ' m at ' + s2.at.toFixed(1) + ' s');
  ok(I.pose(PL, 0).black === 1 && I.pose(PL, 6).black === 0 && I.pose(PL, PL.shots[1].t0).black > 0.99, 'out of black, a dip at each cut', '');
  ok(PL.anchor && Math.hypot(PL.anchor[0] - plot.x, PL.anchor[2] - plot.z) < 1, "the world's streams keyed on the cabin, never on the eye");
  // ---- the page half: a New career, its opening played; another, skipped; a Continue; the phone
  Object.assign(P.aerosCabin.find(a => a.id === 'w9'), aero);
  H.world.terrainH = terr;
  vm.runInContext(src, H);
  const lazy = [];
  let exp = 1.1;
  Object.assign(H, { WF: {}, inGarage: true, roomBase: () => 'w9', roomId: () => 'w9', siteOf: () => ({ plots: [plot] }), WORLD_EXPOSURE: 0.9,
    renderer: { get toneMappingExposure() { return exp; } }, setExp: v => { exp = v; }, ATMO: { MIST: { room: 'the room' } },
    FLYDIY_LAZY: n => { lazy.push(n); return Promise.resolve([true]); },
    camera: { fov: 46, position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, lookAt() {}, updateProjectionMatrix() {}, updateMatrixWorld() {} } });
  const settle = async () => { for (let i = 0; i < 400; i++) { await new Promise(r => setTimeout(r, 5)); if (!H.window.FLYDIY_STORY || !H.window.FLYDIY_STORY.pending()) return; } };
  const career = () => { const r = M.storyNewCareer(M.careerNormalise(M.careerNew({ id: 'main', seed: 'gate' })), { aeros: P.aerosCabin }); P.set(r.doc); return r.doc; };
  const half = () => vm.runInContext('(function () {\n' + P.half + '\nreturn { storyIntroWanted, storyIntroCurtain, storyIntroBoot, storyIntroFrame, el: () => stCardEl }; })', H)();
  const curtains = () => els.filter(e => e.id === 'stIntro').length;
  const play = async (skipAt) => {
    career(); H.stIntroArm = true; H.FLYDIY_INTRO_LAST = null; lazy.length = 0;
    const c0 = curtains(), X = half();
    await settle();
    const cur = els.filter(e => e.id === 'stIntro').slice(-1)[0];
    const up = curtains() === c0 + 1 && /z-index:60/.test(cur.style.cssText) && /background:#000/.test(cur.style.cssText) && lazy.includes('story_intro');
    await X.storyIntroBoot();
    const during = H.FLYDIY_MUSIC_HOLD === true && exp === 0.9 && H.ATMO.MIST.room === null && (!X.el() || X.el().hidden) && X.storyIntroWanted() === false;
    let n = 0, worldF = 0, skipF = -1, near = null;
    while (n < 3000 && !H.FLYDIY_INTRO_LAST) {
      if (skipAt != null && n === Math.round(skipAt * 30)) { H.FLYDIY_INTRO.skip(); skipF = n; }
      const a = X.storyIntroFrame(1 / 30);
      if (a) { worldF++; near = Math.hypot(H.camera.position.x - plot.x, H.camera.position.z - plot.z); }
      n++;
    }
    return { up, during, worldF, n, skipF, near, X, last: H.FLYDIY_INTRO_LAST };
  };
  const after = X => exp === 1.1 && H.ATMO.MIST.room === 'the room' && H.camera.fov === 46 && H.FLYDIY_MUSIC_HOLD === false &&
    M.storyOf(P.get()).beat === 'T0' && X.el() && !X.el().hidden && /The cabin/.test(X.el().innerHTML);
  let r = await play(null);
  ok(r.up, 'a New career: the black curtain up under the loading screen (z 60 < the boot\'s 70), story_intro.js asked for');
  ok(r.during, "while it plays: the world's exposure, the room's air off, the radio held, the beat card hidden; the arm spent (once)");
  ok(r.last && r.last.how === 'played' && r.worldF / 30 >= PL.T && r.worldF / 30 <= PL.T + 1.5 && r.near < 40,
     'played to its end: the world drawn from the shed for the whole cinematic, the last frame at the shed', (r.worldF / 30).toFixed(1) + ' s of world, ' + (r.near || 0).toFixed(1) + ' m from the shed');
  const df = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'design_flow.js'), 'utf8');
  ok(H.FLYDIY_STORY_STARTER === 'Rufus' && df.includes('setTimeout(() => { if (!window.FLYDIY_STORY_STARTER) openBirth(); }, 400)'),
     'the design flow\'s "New aeroplane" door stays shut on a New career with the story (its starter on the stand; the Game coordinator, 20 Oct)', H.FLYDIY_STORY_STARTER);
  ok(after(r.X), 'then the garage: its exposure, its air and its lens back, the radio free, the story at T0 on its card');
  r = await play(3);
  const outF = r.worldF - r.skipF;
  ok(r.last && r.last.how === 'skipped' && outF >= 1 && outF / 30 <= I.SKIP_OUT_S + 0.1 && after(r.X),
     'Skip (the button, Esc, a click): straight to the garage (a ' + I.SKIP_OUT_S + ' s fade), the story at T0', outF + ' frames after the press');
  // a Continue: the saved document - nothing arms it
  H.stIntroArm = false;
  let c0 = curtains(), X = half(); await settle();
  ok(!X.storyIntroWanted() && curtains() === c0, 'a Continue: no curtain, no opening');
  H.stIntroArm = true; H.PROFILE = { name: 'phone', is: () => false };
  ok(!X.storyIntroWanted(), 'on the phone: no opening (no world; no music)');
  H.PROFILE = { name: 'desktop', is: (a, b) => a === 'boot' && b === 'garage' };
  ok(!X.storyIntroWanted(), 'the garage-only boot: no opening');
  delete H.PROFILE; H.location.search = '?intro=0';
  ok(!X.storyIntroWanted(), '?intro=0: no opening');
  H.location.search = ''; H.stIntroArm = false;
  return fails;
}

// ---- G3370-G3379 (TUTO-FLIGHT): T1'S LADDER AND "SKIP THE FLIGHT" ----------------------------------------------------
async function ladderRun() {
  const P = await page();
  const { fails, ok, H, M, els, prefs } = P;
  if (fails.length) return fails;
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), css = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'editor.css'), 'utf8');
  // ---- the cards, pure
  const LAD = M.STORY_LADDER, ids = LAD.map(c => c.id);
  ok(Array.isArray(LAD) && LAD.length >= 5 && LAD.length <= 6 && LAD.every(c => /^story\.ladder\.\w+$/.test(c.key) && c.title && typeof c.text === 'string' && c.text.length > 40 && c.text.length < 280 && 'img' in c),
     "the ladder: 5-6 cards, each a text key for the narrative pack (title, text, an image slot)", ids.join(', '));
  ok(ids.join() === 'roll,climb,cruise,build,approach,landing', 'in the flight\'s order: take-off, climb (the map), cruise (the game\'s loop), building, the approach, the landing at HOME');
  const words = LAD.map(c => c.text).join(' ');
  ok(/map/.test(words) && /jobs/.test(words) && /money/.test(words) && /hangar/.test(words) && /wing/.test(words) && /power/.test(words) && /bench/.test(words),
     'the basics of the game (the map, the jobs, the money, the hangar) and of building a plane (wing, power, the bench)');
  const named = [].concat(...LAD.map(c => c.at)), bad = named.filter(ph => !(ph in M.PILOT_PHASES));
  ok(!bad.length && ['DEPART', 'ROLL', 'CLIMB', 'ENROUTE', 'FINAL', 'FLARE', 'STOPPED'].every(ph => named.includes(ph)), "keyed to the pilot's own phases (43_pilot PILOT_PHASES)", bad.join() || named.length + ' phases');
  // a flight from the cabin to HOME, a tick a second: the cards in order, one at a time
  const flight = [['DEPART', 20], ['ROLL', 12], ['CLIMB', 40], ['ENROUTE', 90], ['INBOUND', 30], ['FINAL', 40], ['FLARE', 6], ['ROLLOUT', 15], ['STOPPED', 10]];
  const run = (manualAt) => { let L = M.storyLadderNew(), t = 0; const seen = [], D0 = 6000;
    for (const [ph, n] of flight) for (let k = 0; k < n; k++, t++) {
      const r = M.storyLadderStep(L, { phase: ph, t, dHome: D0 * (1 - t / 263), manual: manualAt != null && t >= manualAt && t < manualAt + 5 });
      L = r.L; const c = r.card ? r.card.id : null; if (seen[seen.length - 1] !== c) seen.push(c); }
    return { seen, L }; };
  const A = run(null);
  ok(A.seen.join() === ids.join(), 'a flight to HOME: every card in turn, none skipped', A.seen.join(' > '));
  const B = run(70);
  ok(B.L.off && B.seen[B.seen.length - 1] === null && !B.seen.slice(B.seen.indexOf(null)).some(Boolean),
     'the player takes the controls: the ladder stops and stays off for the rest of the flight (the hand-back does not bring it back)', B.seen.join(' > '));
  // ---- the page: T1 at the cabin, Tim's band
  const settle = async () => { for (let i = 0; i < 400; i++) { await new Promise(r => setTimeout(r, 5)); if (!H.window.FLYDIY_STORY || !H.window.FLYDIY_STORY.pending()) { await new Promise(r => setTimeout(r, 5)); if (!H.window.FLYDIY_STORY.pending()) return; } } };
  let man = false;
  const D0 = 5200, home = { id: 'HOME', name: 'Jolene AFB 13/31', kind: 'strip', x: 0, z: 0 };
  H.world.aerodromes = P.aerosCabin.map(a => (a.id === 'HOME' ? Object.assign({}, a, home) : a));
  let cg = [D0, 300, 0];
  H.sim = { cgPos: () => cg };
  H.window.FLYDIY_AP = { manual: () => man };
  const atT1 = () => { let d = M.storyNewCareer(M.careerNormalise(M.careerNew({ id: 'main', seed: 'ladder' })), { aeros: H.world.aerodromes }).doc;
    d = M.storyStep(d, { k: 'ack' }, { aeros: H.world.aerodromes }).doc;
    d = M.playerFleetReconcile(d, H.playerSlotNames()).doc;          // (playerLoad's own lift: the slots already written stand in the fleet)
    P.set(d); return d; };
  atT1();
  H.inGarage = true; H.ap = null;
  const X = vm.runInContext('(function () {\n' + P.half + '\nreturn { storyTimSync, storyLadderReset, storySkipSync, tim: () => stTimEl, skip: () => stSkipEl }; })', H)();
  await settle();
  let d = P.get();
  ok(M.storyOf(d).beat === 'T1' && d.fleet.Rufus && M.playerWhere(d, 'Rufus').hangar === 'w9', 'the fixture: T1, Rufus in the cabin\'s shed');
  X.storyTimSync();
  ok(X.tim() && !X.tim().hidden && X.tim().className === '' && /WWII airport/.test(X.tim().innerHTML), "in the shed at T1: Tim's own T1 lines (no ladder on the ground)");
  // the flight: a roll-out (playerFlightStart -> storyLadderReset), the pilot's phase and clock
  const fly = (phase, t, x) => { H.ap.phase = phase; H.ap.t = t; if (x != null) cg = [x, 300, 0]; X.storyTimSync(); const e = X.tim(); return e && !e.hidden ? e : null; };
  H.inGarage = false; H.ap = { phase: 'DEPART', t: 0 }; X.storyLadderReset();
  let e = fly('DEPART', 0, D0);
  ok(e && e.className === 'lad' && /Take-off/.test(e.innerHTML) && /the flight</.test(e.innerHTML) && !/ of \d/.test(e.innerHTML) && /data-tim="lad"/.test(e.innerHTML),
     "in flight on T1: the band shows the ladder's first card (Tim, 'the flight', no counter - G3356, OK), on the transparent ground (.lad)", e && e.className);
  ok(/#stTim \{[^}]*z-index: 2147482500;/.test(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'editor.css'), 'utf8')) && /\(last \? 'OK' : 'Next'\)/.test(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8')),
     "Tim's band draws over every game layer (the HUD bar, the rails, the corner cards) and its button says Next, no line counter (G3356)");
  const order = [];
  const push = el => { const m = el && /<b class="stLadT">([^<]+)<\/b>/.exec(el.innerHTML); const k = m ? m[1] : null; if (order[order.length - 1] !== k) order.push(k); };
  let t = 0; push(e);
  for (const [ph, n] of flight) for (let k = 0; k < n; k++, t++) push(fly(ph, t, D0 * (1 - t / 263)));
  ok(order.filter(Boolean).join(' > ') === LAD.map(c => c.title).join(' > '), 'the band follows the flight: the six cards, in order', order.join(' > '));
  // OK on a card: read, the band waits for the next
  H.inGarage = false; H.ap = { phase: 'DEPART', t: 0 }; X.storyLadderReset(); e = fly('DEPART', 0, D0);
  e.listeners.click({ target: { closest: () => ({ dataset: { tim: 'lad' } }) } });
  ok(X.tim().hidden && !!fly('CLIMB', 30), "a card's OK hides it; the next card shows again");
  // the hand on the controls: 'flydiy:manual' stops the ladder at once, for the rest of the flight
  man = true; H.dispatchEvent({ type: 'flydiy:manual', detail: { manual: true, by: 'takeover' } });
  ok(X.tim().hidden && H.window.FLYDIY_STORY.ladder().off === true, "'flydiy:manual' (the player takes control): the ladder stops and the band hides");
  man = false; H.dispatchEvent({ type: 'flydiy:manual', detail: { manual: false, by: 'button' } });
  ok(!fly('ENROUTE', 80) && !fly('FINAL', 200) && H.window.FLYDIY_STORY.ladder().off === true, 'the autopilot given back: still off for the rest of this flight');
  H.ap = { phase: 'DEPART', t: 0 }; X.storyLadderReset();
  ok(!!fly('DEPART', 0, D0) && H.window.FLYDIY_STORY.ladder().off === false, 'the next roll-out is a new flight: the ladder from its first card');
  ok(/flSlot = slotOnStand\(\); flEnded = false; flLastEnd = null;\n\s*if \(CAREER_DEV\) careerFlightStart\(\);\n\s*if \(CAREER_DEV && STORY_PAGE\) storyLadderReset\(\);/.test(app) &&
     /window\.addEventListener\('flydiy:manual', ev => \{ try \{ if \(ev && ev\.detail && ev\.detail\.manual && !inGarage\) stLad\.off = true;/.test(app),
     "the source: a roll-out (playerFlightStart) resets it behind the story's guard; the 'flydiy:manual' event ends it");
  // ---- nothing off T1: T0 and T2 in flight show no ladder
  { const keep = P.get(); let d0 = M.storyNewCareer(M.careerNormalise(M.careerNew({ id: 'main', seed: 'ladder0' })), { aeros: H.world.aerodromes }).doc; P.set(d0);
    H.ap = { phase: 'ENROUTE', t: 90 }; X.storyTimSync();
    const t0 = X.tim().hidden || X.tim().className !== 'lad';
    const d2 = JSON.parse(JSON.stringify(keep)); d2.career.story.beat = 'T2'; d2.career.story.done = ['T0', 'T1']; P.set(d2); X.storyTimSync();
    const t2 = X.tim().hidden || X.tim().className !== 'lad';
    ok(t0 && t2, 'no ladder off T1: a T0 or a T2 flight shows none');
    X.storySkipSync();
    ok(X.skip() && X.skip().hidden && !P.bodyCls.has('stSkipOn') && !H.window.FLYDIY_STORY.skip().ok, 'no Skip off T1 (the pill hidden, the skip refused)');
    P.set(keep); }
  // ---- SKIP THE FLIGHT, from the shed
  H.inGarage = true; H.ap = null; X.storySkipSync();
  const sk = X.skip();
  ok(sk && sk.id === 'stSkip' && !sk.hidden && /Skip the flight/.test(sk.textContent) && P.bodyCls.has('stSkipOn'), 'T1 in the shed: "Skip the flight" shows at the bottom edge (Tim\'s band above it)');
  d = P.get();
  const w0 = d.wallet, log0 = JSON.stringify(d.career.pilots || null), led0 = d.ledger.length, con0 = JSON.stringify(d.career.contracts);
  sk.listeners.click({});
  await settle();
  d = P.get();
  const S = M.storyOf(d), cub = S.planes.client, RW = M.playerWhere(d, 'Rufus');
  ok(S.beat === 'T2' && S.done.join() === 'T0,T1' && !d.sheds.HOME.locked && d.ledger.some(l => l.k === 'story' && l.ref === 'HOME'), 'Skip: T1 complete as a stop at HOME (the hangar ours, its ledger line)', S.beat);
  ok(RW.kind === 'in' && RW.hangar === 'HOME' && d.here === 'HOME', 'Rufus straight into the HOME hangar, the garage there', JSON.stringify(RW) + ' here ' + d.here);
  ok(cub && prefs.has('flydiy.build.' + cub) && M.playerWhere(d, cub).aero === 'HOME' && M.playerStoreWhere(d, cub).kind === 'outside' && d.career.airframes[cub].owner === 'client' && S.base.client && S.base.client.paint.job === 'bare',
     "T2's client Cub effect fired: the Cub parked outside at HOME as it arrives, bound", cub + ' ' + JSON.stringify(M.playerWhere(d, cub || '')));
  ok(d.wallet === w0 && JSON.stringify(d.career.pilots || null) === log0 && JSON.stringify(d.career.contracts) === con0 && d.ledger.filter(l => l.amount).length === 0 && d.ledger.length - led0 <= 2,
     'no money, no logbook row, no contract moved: only what the stop records', 'wallet ' + d.wallet + ', ledger +' + (d.ledger.length - led0));
  X.storySkipSync();
  ok(X.skip().hidden && !P.bodyCls.has('stSkipOn') && /client/.test(H.window.FLYDIY_STORY.card().title.toLowerCase()), 'after the skip: the pill gone, the T2 card up');
  // ---- SKIP THE FLIGHT, in the air: the shed door, the flight's end not recorded
  atT1(); await settle();
  let doors = 0; const door = P.mkEl('button'); door.id = 'bHangar2'; door.onclick = () => { doors++; };
  H.inGarage = false; H.ap = { phase: 'ENROUTE', t: 120 }; H.flEnded = false; X.storyLadderReset(); fly('ENROUTE', 120, 2600);
  const r = H.window.FLYDIY_STORY.skip();
  await settle();
  d = P.get();
  ok(r.ok && M.storyOf(d).beat === 'T2' && M.playerWhere(d, 'Rufus').hangar === 'HOME' && d.here === 'HOME' && doors === 1 && H.flEnded === true && H.baseId === 'HOME',
     'in flight: the same, then the shed door (the roll-in at HOME); the flight walked away from without an end recorded', JSON.stringify({ ok: r.ok, why: r.why, beat: M.storyOf(d).beat, w: M.playerWhere(d, 'Rufus'), here: d.here, doors, flEnded: H.flEnded, base: H.baseId }));
  // ---- the look
  const lad = (css.match(/#stTim\.lad \{[^}]*\}/) || [''])[0], sp = (css.match(/#stSkip \{[^}]*\}/) || [''])[0];
  ok(/background: transparent/.test(lad) && /position: fixed/.test(sp) && /left: 12px/.test(sp) && /bottom: calc\(14px/.test(sp) && !/translate|left: ?50%|top: ?50%/.test(sp) &&
     /IBM Plex Sans/.test(sp) && /font-style: normal/.test(sp) && /var\(--ed-plate\)/.test(sp) && /:is\([^)]*#stSkip[^)]*\) \{/.test(css) && /:root\.phone #stSkip \{ min-height: 48px; \}/.test(css),
     "the look: the ladder on a transparent ground; the Skip at the bottom edge (never centred), the garage's look, 48 px on the phone");
  H.inGarage = true; H.ap = null;
  return fails;
}

// ---- G3580-G3589 (STORY-TUTOR): TIM IS THE TUTORIAL - each step checked, only its control works -----------------------
async function tutorRun() {
  const P = await page();
  const { fails, ok, H, M, els, prefs } = P;
  if (fails.length) return fails;
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), css = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'editor.css'), 'utf8');
  const fcss = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'flight.css'), 'utf8');
  // ---- the steps, pure
  const TU = M.STORY_TUTOR, all = [].concat(TU.T0 || [], TU.T1 || [], TU.T2 || []);
  const facts = new Set((app.match(/const STORY_TUTOR_FACTS = \{([\s\S]*?)\n  \};/) || ['', ''])[1].match(/^\s{4}(\w+):/gm).map(x => x.trim().slice(0, -1)));
  const allows = new Set((app.match(/const STORY_TUTOR_ALLOW = \{([\s\S]*?)\n  \};/) || ['', ''])[1].match(/^\s{4}(\w+):/gm).map(x => x.trim().slice(0, -1)));
  ok(['T0', 'T1', 'T2'].every(k => Array.isArray(TU[k]) && TU[k].length >= 3) && all.every(s => s.id && typeof s.say === 'string' && s.say.length > 20 && s.say.length < 280),
     "the tutor: T0, T1 and T2 as steps, each Tim's words (draft English, a line or two)", all.length + ' steps');
  const badW = all.filter(s => s.wait && !facts.has(s.wait)).map(s => s.id), badA = all.filter(s => s.allow && !allows.has(s.allow)).map(s => s.id);
  ok(!badW.length && !badA.length && all.filter(s => s.wait).every(s => s.allow), "every waiting step names a predicate the page defines and the one control it allows", (badW.concat(badA).join() || [...facts].join(', ')));
  const ids = k => TU[k].map(s => s.id + (s.wait ? ':' + s.wait : '')).join(' > ');
  const t0 = TU.T0, t0p = t0.find(s => s.wait === 'painted'), t0r = t0.find(s => s.wait === 'registered');
  ok(t0p && t0p.allow === 'finish' && t0r && t0r.allow === 'reg' && t0r.pass && t0.indexOf(t0p) < t0.indexOf(t0r) && t0[t0.length - 1].ack && !t0[t0.length - 1].wait,
     'T0: paint Rufus (checked), then its registration (checked, or kept), then the OK that reads the beat', ids('T0'));
  const t1 = TU.T1, roll = t1[t1.length - 1];
  ok(roll.wait === 'flying' && roll.allow === 'rollout', 'T1 in the shed: the news, then Roll out (the step waits for the flight; in flight the ladder, G3370)', ids('T1'));
  const t2 = TU.T2, w2 = t2.map(s => s.wait).filter(Boolean).join();
  ok(w2 === 'inHangar,storeOpen,clientOnStand,starterInside' && t2[0].free && t2[0].allow === 'shed' && /parked outside/.test(t2.map(s => s.say).join(' ')) && /INSIDE/.test(t2.map(s => s.say).join(' ')) && !t2[t2.length - 1].wait,
     'T2, the WWII arrival: the taxi or The shed (free), the hangar, the contract (the Cub parked outside), Storage, the swap, the ultralight into a visible slot, the list', ids('T2'));
  // the tick and the Next
  let f = {};
  const fact = k => !!f[k];
  let r = M.storyTutorTick(null, 'T0', fact);
  ok(r.T.i === 0 && r.step.id === 'hello' && M.storyTutorTick(r.T, 'T0', fact).T.i === 0, 'words wait for Next (a tick moves nothing)');
  let T = M.storyTutorNext(r.T, 'next'); r = M.storyTutorTick(T, 'T0', fact);
  ok(r.step.id === 'paint' && M.storyTutorNext(r.T, 'next') === r.T && M.storyTutorNext(r.T, 'pass') === r.T, 'a waiting step: Next moves nothing, nor a pass it does not offer');
  f.painted = true; r = M.storyTutorTick(r.T, 'T0', fact);
  ok(r.step.id === 'reg', 'the action done: the next step');
  T = M.storyTutorNext(r.T, 'pass'); r = M.storyTutorTick(T, 'T0', fact);
  ok(r.step.id === 'cert' && r.step.ack, "the registration's pass ('" + t0r.pass + "'): on to the OK");
  f = { flying: true }; r = M.storyTutorTick({ beat: 'T0', i: 3 }, 'T1', fact);
  ok(r.T.beat === 'T1' && r.T.i === 0 && r.step.id === 'news', 'a new beat: its first step');
  r = M.storyTutorTick({ beat: 'T1', i: 2 }, 'T1', fact);
  ok(r.step === null, 'an action already done (a reload in flight): the step passes at once; the beat\'s steps done');
  // the final's pose
  const H0 = { id: 'HOME', x: 0, z: 0, hdg: Math.PI, spawn: [0, 0], elev: 4, len: 900 };
  const FP = M.storyFinalPose(H0, { V: 20 }), along = (FP.x - (-60)) * Math.cos(H0.hdg) + FP.z * Math.sin(H0.hdg);
  ok(Math.abs(Math.abs(FP.x - (-60)) - 3000) < 1 && Math.abs(FP.z) < 1e-6 && Math.abs(along + 3000) < 1 && Math.abs(FP.y - (4 + 180)) < 1e-6 &&
     Math.abs(Math.hypot(FP.vx, FP.vy, FP.vz) - 20) < 1e-6 && FP.vy < 0 && (FP.vx * Math.cos(H0.hdg) + FP.vz * Math.sin(H0.hdg)) > 0 && FP.hdg === H0.hdg,
     "Skip on the final: 3 km out (before the pilot's IAF: straight in) on the runway's extended centreline, on a 6 % slope over the field, flying the landing heading at the approach speed, sinking", JSON.stringify({ x: Math.round(FP.x), y: FP.y, z: FP.z }));
  const FG = M.storyFinalPose(H0, { V: 20, groundH: () => 150 });
  ok(FG.y === 210, 'the final never under 60 m over the ground beneath it (a hill before the field)', FG.y);
  const H1 = Object.assign({}, H0, { x: -450 }), FR = M.storyFinalPose(H1, { V: 20, way: -1 });
  ok(Math.abs(FR.x - (-900 + 60 - 3000)) < 1e-6 && Math.abs(FR.hdg - 2 * Math.PI) < 1e-9 && FR.vx > 0 && Math.abs(FR.vz) < 1e-6,
     "the other end's final (way -1): 3 km out past the take-off end's mirror, flying against a.hdg", JSON.stringify({ x: FR.x, hdg: FR.hdg }));
  { const Wd = M.makeWorld(0, {}), HW = Wd.aerodromes.find(a => a.id === 'HOME'), wd = v => Object.create(Wd, { wind: { value: () => v } });
    const hx = Math.cos(HW.hdg), hz = Math.sin(HW.hdg);
    ok(M.storyFinalWay(HW, wd([0, 0, 0]), 0) === 1 && M.storyFinalWay(HW, wd([-6 * hx, 0, -6 * hz]), 0) === 1 && M.storyFinalWay(HW, wd([6 * hx, 0, 6 * hz]), 0) === -1 &&
       M.storyFinalWay(null, Wd, 0) === 1,
       "the skip's way is the pilot's scored way: calm and a headwind along the take-off heading +1, 12 kt down it -1 (the other end); nothing to score: +1"); }
  ok(/function storyFinalNow\(o\)[\s\S]{0,1600}storyFinalWay\(H, world, 0\)[\s\S]{0,200}storyFinalPose\(H, \{ V, way,/.test(app), "the skip poses the final on the way the pilot will land it (storyFinalWay -> storyFinalPose's way)");
  // ---- the page: T0 at the cabin, the lock
  const settle = async () => { for (let i = 0; i < 400; i++) { await new Promise(r => setTimeout(r, 5)); if (!H.window.FLYDIY_STORY || !H.window.FLYDIY_STORY.pending()) { await new Promise(r => setTimeout(r, 5)); if (!H.window.FLYDIY_STORY.pending()) return; } } };
  let d = M.storyNewCareer(M.careerNormalise(M.careerNew({ id: 'main', seed: 'tutor' })), { aeros: P.aerosCabin }).doc;
  P.set(d); prefs.delete('flydiy.story.tut.main');
  H.inGarage = true; H.ap = null;
  const X = vm.runInContext('(function () {\n' + P.half + '\nreturn { storyTimSync, storyTutorGuard, storySkipSync, tim: () => stTimEl, lock: () => stTutLockV, css: () => stTutCssEl }; })', H)();
  await settle();
  d = P.get();
  const rufusEnv = JSON.parse(prefs.get('flydiy.build.Rufus') || 'null');
  ok(rufusEnv && rufusEnv.spec.meta.reg === M.STORY_REG && /^N\d{1,5}[A-Z]{0,2}$/.test(M.STORY_REG) && M.STORY_REG !== 'F-PGAR',
     "Rufus's own registration: " + M.STORY_REG + ' (a fictional US mark, not the generator\'s F-PGAR) - meta, cosmetic to the bench', rufusEnv && rufusEnv.spec.meta.reg);
  ok(/const BENCH_COSMETIC = \['paint', 'finish', 'meta'\];/.test(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'bench.js'), 'utf8')), "meta is one of the bench's cosmetic blocks: the certificate's fingerprint does not move");
  let spec = JSON.parse(JSON.stringify(rufusEnv.spec));
  P.standSet('Rufus'); P.specSet(spec);
  const tim = () => { X.storyTimSync(); return X.tim(); };
  const press = k => X.tim().listeners.click({ target: { closest: () => ({ dataset: { tim: k } }) } });
  // a fake target: inside the selectors it is listed under
  const tgt = (...under) => ({ closest: sel => (String(sel).split(',').map(x => x.trim()).some(q => under.includes(q)) ? {} : null) });
  const held = (t, type) => { let stopped = false; X.storyTutorGuard({ type: type || 'click', target: t, cancelable: true, stopImmediatePropagation() { stopped = true; }, stopPropagation() {}, preventDefault() {} }); return stopped; };
  let e = tim();
  ok(e && !e.hidden && /dust it off/.test(e.innerHTML) && /data-tim="tnext"/.test(e.innerHTML) && P.bodyCls.has('stTut'), "T0's first step: Tim's words with Next; the page locked (body.stTut)");
  ok(held(tgt('#bGo')) && held(tgt('#edWrap')) && !held(tgt('#stTim')) && !held(tgt('[id^="boot"]')) && held(tgt('#gStore'), 'keydown'),
     'while a step stands, a press anywhere else is held at the window (the roll-out, the panel, a key); Tim\'s band and the loading screens are not');
  // the shared card drag (FLYDIY_DRAG): a press on a card's handle moves the card, its clicks and buttons stay held
  ok(!held(tgt('.cdHandle'), 'pointerdown') && !held(tgt('.cdHandle'), 'dblclick') && held(tgt('.cdHandle'), 'click') && held(tgt('.cdHandle', 'button'), 'pointerdown') && held(tgt('.cdHandle', '[data-nodrag]'), 'pointerdown'),
     "a card's drag handle takes its press (the card moves) while a step stands; a click on it, or a control inside it, is still held");
  press('tnext'); e = tim();
  ok(/fresh coat/.test(e.innerHTML) && e.className === 'tut' && !/data-tim="tnext"/.test(e.innerHTML) && X.lock() && X.lock().allow === '#edWrap',
     'the paint step: no Next, the band on its accent edge, the finish panel the one control allowed', X.lock() && X.lock().allow);
  ok(!held(tgt('#edWrap')) && held(tgt('#edWrap', '#edTabShape')) && held(tgt('#bGo')) && /outline/.test(X.css().textContent) && /#edWrap/.test(X.css().textContent),
     'the finish panel works (not its locked tabs), the roll-out does not; the panel is lit');
  tim(); tim();
  ok(/fresh coat/.test(X.tim().innerHTML), 'unpainted: the step stands');
  spec = JSON.parse(JSON.stringify(spec)); spec.paint = Object.assign({}, spec.paint, { base: 0x3366aa }); P.specSet(spec);
  e = tim();
  ok(/registration/.test(e.innerHTML) && /data-tim="tpass"/.test(e.innerHTML) && new RegExp('Keep ' + M.STORY_REG).test(e.innerHTML) && X.lock().allow === '[data-dec="reg"]',
     'painted: on to the registration (only its box allowed; "Keep ' + M.STORY_REG + '" passes it)');
  spec = JSON.parse(JSON.stringify(spec)); spec.meta = Object.assign({}, spec.meta, { reg: 'N512TB' }); P.specSet(spec);
  e = tim();
  ok(/pre-certified/.test(e.innerHTML) && /data-tim="tnext"/.test(e.innerHTML) && />OK</.test(e.innerHTML), 'a registration typed: the last words, with OK');
  ok(M.storyOf(P.get()).beat === 'T0', 'the story waits at T0 until that OK');
  press('tnext'); e = tim();
  ok(M.storyOf(P.get()).beat === 'T1' && /WWII airport/.test(e.innerHTML), "the OK reads the beat: T1, Tim's news");
  ok(JSON.parse(prefs.get('flydiy.story.tut.main')).beat === 'T1', "the tutor's place is kept for this career (a reload resumes it)");
  press('tnext'); press('tnext'); e = tim();
  ok(/Roll it out/.test(e.innerHTML) && !/data-tim="tnext"/.test(e.innerHTML) && !held(tgt('#bGo')) && !held(tgt('#stSkip')) && held(tgt('#gStore')),
     'T1: Roll out (or the Skip) the only way on');
  H.inGarage = false; H.ap = { phase: 'DEPART', t: 0 }; H.sim = { cgPos: () => [5000, 300, 0] }; H.window.FLYDIY_AP = { manual: () => false };
  e = tim();
  ok(e && e.className === 'lad' && !P.bodyCls.has('stTut') && !X.lock(), 'rolled out: the steps done, the flight is the ladder\'s (no lock in the air)');
  // ---- T2: the WWII arrival
  d = M.playerArrive(P.get(), 'Rufus', 'HOME', {}).doc;
  const stop = M.careerStopRecord({ how: 'stopped', aero: 'HOME', slot: 'Rufus', gear: 'wheels', row: { from: 'w9', to: 'HOME', t: 900 } });
  const sr = M.storyStep(d, { k: 'stop', stop, slot: 'Rufus' }, { aeros: P.aerosCabin });
  d = sr.doc; for (const ef of sr.effects) { if (ef.k === 'hangar') d = M.storyApply(d, ef, {}).doc; }
  d = M.storyApply(d, { k: 'clientPlane', at: 'home' }, { slot: 'Client Cub' }).doc;
  prefs.set('flydiy.build.Client Cub', JSON.stringify({ spec: M.storyClientSpec(JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'cub_2026-09-20.json'), 'utf8')).spec) }));
  d = M.storyStep(d, { k: 'bind', role: 'client', slot: 'Client Cub' }, {}).doc;
  P.set(d); H.ap = { phase: 'STOPPED', t: 600 };
  ok(M.playerStoreWhere(d, 'Client Cub').kind === 'outside', 'the fixture: T2, Rufus landed at HOME, the client\'s Cub parked outside');
  e = tim();
  ok(/welcome to the WWII field/.test(e.innerHTML) && !P.bodyCls.has('stTut') && P.bodyCls.has('stTutFree') && /#bHangar2/.test(X.css().textContent),
     'landed: Tim says taxi or The shed - nothing locked (the taxi is the player\'s), The shed lit');
  H.window.FLYDIY_AP = { manual: () => true };
  ok(!tim().hidden, '...and he stays on screen with the hand on the controls');
  H.window.FLYDIY_AP = { manual: () => false };
  d = JSON.parse(JSON.stringify(P.get())); d.here = 'HOME'; P.set(d); H.inGarage = true; H.ap = null;
  e = tim();
  ok(/in our own hangar/.test(e.innerHTML) && /data-tim="tnext"/.test(e.innerHTML), 'in the WWII hangar: "there it is" (Rufus on its stand)');
  press('tnext'); e = tim();
  ok(/parked outside/.test(e.innerHTML), 'the new contract: the Cub parked outside');
  press('tnext'); e = tim();
  ok(/Open Storage/.test(e.innerHTML) && X.lock().allow === '#gStore' && !held(tgt('#gStore')) && held(tgt('#bGo')), 'Storage: its button the only control');
  const store = P.mkEl('div'); store.id = 'hsStore'; store.hidden = false;
  e = tim();
  ok(/Drag the Cub onto the floor/.test(e.innerHTML) && /hsCard\[data-name="Client Cub"\]/.test(X.lock().allow) && /\.hsFly/.test(X.lock().deny),
     "Storage open: the swap - the Cub's card and the floor allowed (not its fly / route / send)");
  const card = '#hsStore .hsCard[data-name="Client Cub"]';
  ok(!held(tgt(card)) && !held(tgt('#hsStore .hsFloor')) && held(tgt(card, '#hsStore .hsFly')) && held(tgt('#hsStore .hsClose')) && !held(tgt('#hsStore .hsFloor', '#hsStore .hsFly'), 'drop'),
     'the Cub\'s card and the floor work (a drop onto the floor too), its Fly and the close do not');
  // (the storage view first puts the stand's Rufus on the floor - G3587 storeFloorStand - then the swap: the Cub onto the
  // floor, Rufus to the Cub's place outside)
  d = M.playerMove(P.get(), 'Rufus', { kind: 'floor', hangar: 'HOME' }).doc;
  P.standSet('Client Cub');
  const sw = M.playerMove(d, 'Client Cub', { kind: 'floor', hangar: 'HOME' }); d = sw.doc; P.set(d);
  ok(sw.ok && M.playerStoreWhere(d, 'Rufus').kind === 'outside', 'the swap: the Cub on the floor, Rufus where the Cub stood (the apron)', JSON.stringify(M.playerStoreWhere(d, 'Rufus')));
  e = tim();
  ok(/INSIDE slot/.test(e.innerHTML) && /hsCard\[data-name="Rufus"\]/.test(X.lock().allow) && /\.hsWork/.test(X.lock().deny), 'the Cub on the stand: now the ultralight into an inside slot (its card and the INSIDE column)');
  const W1 = M.playerStoreWhere(P.get(), 'Rufus');
  const mv = M.playerMove(P.get(), 'Rufus', { kind: 'inside' });
  ok(mv.ok, 'the HOME hangar has an inside slot for it', mv.why || JSON.stringify(W1));
  P.set(mv.doc);
  e = tim();
  ok(/what the client wants/.test(e.innerHTML) && /stTimRows/.test(e.innerHTML) && />OK</.test(e.innerHTML), "Rufus inside: Tim's last T2 words carry the client's checklist");
  press('tnext'); e = tim();
  ok(!P.bodyCls.has('stTut') && e.className === 'min' && /data-tim="open"/.test(e.innerHTML), "OK: the steps done, Tim's chip in the corner (his last words behind it), nothing locked");
  // ---- the source
  ok(/for \(const k of \['pointerdown', 'mousedown', 'click', 'dblclick', 'touchstart', 'contextmenu', 'dragstart', 'dragover', 'drop', 'keydown'\]\) window\.addEventListener\(k, storyTutorGuard, \{ capture: true, passive: false \}\)/.test(app) &&
     /if \(stIntro \|\| stIntroWas \|\| \(window\.PROFILE && window\.PROFILE\.name === 'phone'\)\) on = false;/.test(app),
     'the guard: on the window, in the capture phase, every press, drag and key; never under the opening, nor on the phone');
  ok(/#stTim\.tut \{[^}]*var\(--ed-acc/.test(css) && /if \(CAREER_DEV && STORY_PAGE && storyRollPlain\(\)\) \{ b\.textContent = 'Roll out'; untested = false; \}/.test(app),
     "the waiting band's accent edge; the story's starter rolls out under a plain 'Roll out' (G3583)");
  ok(/const line = !!CAREER_DEV;\n\s*el\.classList\.toggle\('line', line\);/.test(app) && /#arrCard\.line \{[^}]*background:transparent;[^}]*border:0;/.test(fcss) && /#arrCard\.line #arrNotes, #arrCard\.line #bLog, #arrCard\.line #bWhy \{ display:none; \}/.test(fcss),
     "no card in a career: the flight's ending is a line of text at the bottom left (no plate, no Log / What went wrong; the story's line is Tim's)");
  ok(/view: \(\) => \{ storeFloorStand\(\); return/.test(app), "Storage shows the stand's aeroplane on the floor (G3587: the Cub was shown on the stand while Rufus stood there)");
  ok(/stIntroWas\.veil = CLOUDS\.S\.veil; CLOUDS\.S\.veil = 0; const q = CLOUDS\.compositeMesh && CLOUDS\.compositeMesh\(\); if \(q\) q\.visible = false;/.test(app) && /CLOUDS\.S\.veil = W\.veil;/.test(app),
     'no clouds in the opening (G3588): the veil off and the stale composite hidden while it plays, the veil back at the swap');
  ok(/stSkipEl\.textContent = 'Skip the flight: start on the final';/.test(app) && /rollOut\(\(\) => \{ const r = storyFinalNow\(\);/.test(app) && /ap\.reEngage\(\{ phase: 'INBOUND' \}\);/.test(app),
     'Skip the flight: rolled out, then on the final at the WWII field, a fresh pilot planning its arrival from there (G3584); the garage alone keeps the hangar skip');
  ok(/ap\.afcs\.sel\.de = 0; \} catch \(e\) \{\}\n\s*ap\.reEngage\(\{ phase: 'INBOUND' \}\);/.test(app),
     "the skip's fresh pilot starts with the stick neutral before its first update (its default 'DE' mode has no setting: the sim diverged at 0 s, the 25 Oct page run)");
  ok(/function storyFinalNow\(o\)[\s\S]{0,2400}ap\.setRoute\(H, H\);/.test(app),
     "the skip's pilot flies a circuit at the WWII field (a cabin -> HOME route flew to the pattern entry first: 5 min round the circuit, the 25 Oct 20:15 page run)");
  ok(/if \(ap\.phase !== 'INBOUND' && ap\.phase !== 'FINAL'\) \{ const ph = ap\.phase, r2 = storyFinalNow\(\{ way: -way, flipped: true \}\);/.test(app) && /if \(!\(o && o\.flipped\)\) setTimeout\(/.test(app),
     "the skip's pilot planned a circuit from the pose (the 27 Oct 04:35 page run: DOWNWIND, no landing in 5 min): the pose flips to the other end's final, once");
  ok(/const stUsed = !armed && \(\(\) => \{ try \{ const s = stLive\(\); return !!\(s && !s\.open && s\.planes && s\.planes\.starter && flSlot === s\.planes\.starter\); \}/.test(app) &&
     /if \(typeof window\.BENCH_FLIGHT_LOGGED === 'function' && curKey === 'gen' && !stUsed\) \{/.test(app),
     "Rufus is a used machine: while the story runs, its landings award no flight certificate (the user 27 Oct), a bench-armed test flight still does");
  ok(/d = storyOnFlightEnd\(d, out\);\s*\n(?:\s*\/\/.*\n)*\s*if \(out\.moved && out\.moved\.kind === 'in' && out\.moved\.hangar && out\.moved\.hangar !== d\.here && !out\.room\) \{ const g = playerGoTo\(d, out\.moved\.hangar\);/.test(app),
     "a landing whose story effects lift the hangar's lock (T1 done) opens the roll-in there: the go-to again after storyOnFlightEnd (B'1, the 26 Oct page run: The shed opened the cabin's garage)");
  H.inGarage = true; H.ap = null;
  return fails;
}

if (!SELF) {
  (async () => {
    const f = run();
    console.log('  -- the page half (G2742-G2749 STORY-PAGE)');
    let g = [];
    try { g = await pageRun(); } catch (e) { g = ['the page half threw: ' + (e && e.stack || e)]; console.log('  FAIL ' + g[0]); }
    console.log('  -- the opening (G3380-G3389 STORY-INTRO)');
    try { g = g.concat(await introRun()); } catch (e) { g.push('the opening threw: ' + (e && e.stack || e)); console.log('  FAIL ' + g[g.length - 1]); }
    console.log('  -- the tutorial flight (G3370-G3379 TUTO-FLIGHT)');
    try { g = g.concat(await ladderRun()); } catch (e) { g.push('the tutorial flight threw: ' + (e && e.stack || e)); console.log('  FAIL ' + g[g.length - 1]); }
    console.log('  -- Tim, the tutorial (G3580-G3589 STORY-TUTOR)');
    try { g = g.concat(await tutorRun()); } catch (e) { g.push('the tutor threw: ' + (e && e.stack || e)); console.log('  FAIL ' + g[g.length - 1]); }
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
