#!/usr/bin/env node
// _tutorlock_check.js - GATE TUTORLOCK (TUTORIAL-LOCK, the user 13 Nov ~12:40: "now that we want a fixed state, we have to
// lock all of this; that's the very first task"). 79_story.js:
//   1 storyCheckpoint: the career after the tutorial is ONE state - the story open (every beat done), the one teaching job
//     done (STORY_JOB) with its provider's reputation and arc, the fixed wallet, the fixed day (day 3, 08:00 AKDT), the
//     world's seed, the starter alone in the fleet, no pilots / routes, the first tech segment; the player's own (the
//     starter's name, the sheds) kept
//   2 deterministic: two careers played differently (another wallet, clock, day, seed, extra planes, other jobs, a hired
//     pilot) give the SAME checkpoint but for what is the player's own; a checkpoint of a checkpoint is itself
//   3 storySkip: a new career straight to the checkpoint - the same state as a tutorial flown to its end
//   4 storyEditDiff / storyEditDone: a build's start -> target differences, one step per changed setting (arrays whole,
//     the cosmetic keys skipped), each checked on the live spec by its value
//   node tools/_tutorlock_check.js [--selftest]   -> "GATE TUTORLOCK: PASS|FAIL"
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
const aeros = [{ id: 'HOME', name: 'Jolene AFB 13/31', kind: 'strip' }, { id: 'w6', name: 'strip 11', kind: 'strip' },
               { id: 'SEA', name: 'Greywater Dock', kind: 'water' }, { id: 'w9', name: 'Cabin Strip', kind: 'strip' }];
const born = (id, seed) => C.storyNewCareer(C.careerNormalise(C.careerNew({ id: 'main', seed: seed || id, name: id })), { aeros }).doc;
const K = C.STORY_CHECKPOINT;
ok(K && K.job === 'field.02' && K.wallet > 0 && K.day && K.day.date === '2026-07-17' && K.seed === 'jolene', '0 the checkpoint\'s fixed values: the one job, the wallet, day 3 08:00 AKDT, the world seed');
// 1 a tutorial played to its end (one way)
const a0 = born('a', 'c-a-123');
a0.wallet = 7350; a0.clock = 19000; a0.career.day = { date: '2026-07-16', utc: 3600 * 5 };
a0.fleet = Object.assign({}, a0.fleet, { 'Client Cub': { hangar: 'HOME', aero: 'HOME' } });
a0.career.airframes['Client Cub'] = { gift: true };
a0.career.contracts.done = [{ id: 'clients.01', at: 100, pay: 1500 }, { id: 'survey.01', at: 200, pay: 2000 }];
a0.career.providers.clients.rep = 0.5;
a0.career.roster = ['pilot:x']; a0.career.pilots = { 'pilot:x': { hired: true } };
const A = C.storyCheckpoint(a0);
ok(A.ok, '1 the checkpoint applies to a story career');
const d = A.doc, s = d.career.story;
ok(s.beat === 'open' && s.open === true && s.done.length === C.STORY_BEATS.length, '1 the story is open, every beat done');
ok(d.career.contracts.done.length === 1 && d.career.contracts.done[0].id === 'field.02', '1 the one job done (Tools from the hill)', JSON.stringify(d.career.contracts.done));
ok(d.career.providers.field.rep > 0 && d.career.providers.field.arc === 1 && d.career.providers.clients.rep === 0, '1 its provider\'s reputation and arc, no other');
ok(d.wallet === K.wallet && JSON.stringify(d.career.day) === JSON.stringify(C.careerDayNorm(K.day)) && d.career.seed === 'jolene', '1 the wallet, the day and the seed fixed', d.wallet + ' ' + JSON.stringify(d.career.day));
ok(Object.keys(d.fleet || {}).every(k => k === s.planes.starter) && !d.career.airframes['Client Cub'] && !!d.career.airframes[s.planes.starter], '1 the starter alone in the fleet (the client\'s Cub went back)');
ok(!d.career.roster.length && !Object.keys(d.career.pilots).length && Array.isArray(d.career.routes) && !d.career.routes.length, '1 no pilots, no routes');
ok(d.ledger.filter(e => e.k === 'story' && e.ref === 'checkpoint').length === 1, '1 the wallet\'s difference is one ledger line');
// 2 deterministic: another way through
const b0 = born('b', 'c-b-999');
b0.wallet = 31000; b0.clock = 4000; b0.career.contracts.done = [{ id: 'resort.01', at: 50, pay: 1800 }];
const B = C.storyCheckpoint(b0).doc;
const strip = x => { const o = JSON.parse(JSON.stringify(x)); delete o.ledger; delete o.clock; o.career.name = ''; o.career.started = null; o.career.id = 'main';
  for (const k of Object.keys(o.sheds || {})) delete o.sheds[k].since; return o; };
ok(JSON.stringify(strip(d)) === JSON.stringify(strip(B)), '2 two tutorials played differently give the same checkpoint (but what is the player\'s own)');
const AA = C.storyCheckpoint(d).doc;
ok(JSON.stringify(AA) === JSON.stringify(d), '2 a checkpoint of a checkpoint is itself');
// 3 skip
const S = C.storySkip(C.careerNormalise(C.careerNew({ id: 'main', seed: 'c-s-1', name: 's' })), { aeros });
ok(S.ok && JSON.stringify(strip(S.doc)) === JSON.stringify(strip(d)), '3 Skip at New career = the checkpoint a flown tutorial reaches');
// 4 the exact build
const cub = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), 'utf8')).spec;
const tgt = JSON.parse(JSON.stringify(cub));
tgt.gear.suspension = 'oleo'; tgt.wings[0].span = 11.2; tgt.meta = Object.assign({}, tgt.meta, { name: 'renamed' }); tgt.paint = { body: 'red' };
const D = C.storyEditDiff(cub, tgt);
ok(D.length === 2 && D.some(q => q.path === 'gear.suspension' && q.to === 'oleo') && D.some(q => q.path === 'wings.0.span' && q.to === 11.2), '4 the differences: one step per changed setting, the name skipped', JSON.stringify(D));
const flags0 = C.storyEditDone(cub, D), flags1 = C.storyEditDone(tgt, D);
ok(flags0.every(f => !f) && flags1.every(Boolean), '4 each step checked on the live spec: none done on the start, all on the target');
ok(C.storyEditDiff(cub, JSON.parse(JSON.stringify(cub))).length === 0, '4 a file against itself: no step');
// the source rows
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'core', '79_story.js'), 'utf8');
ok(/const STORY_JOB = 'field\.02';/.test(SRC) && /function storyCheckpoint\(doc, o\)/.test(SRC) && /function storySkip\(doc, o\)/.test(SRC), '5 the lock\'s pieces in 79_story.js');
// 6 the page: the welcome's "New career, no tutorial" row sets the skip; the career's birth takes storySkip then (no opening)
const WEL = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'welcome.js'), 'utf8'), APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
ok(/row\('careerSkip', '⏭', 'New career, no tutorial'/.test(WEL) && /W\.FLYDIY_CAREER_SKIP = true; done\('career'\);/.test(WEL), '6 the welcome offers "New career, no tutorial" (the skip flag set)');
ok(/const skip = !!window\.FLYDIY_CAREER_SKIP/.test(APP) && /\(skip \? storySkip\(player, args\) : storyNewCareer\(player, args\)\)/.test(APP) && /stIntroArm = !skip;/.test(APP), '6 a skipped career is born on the checkpoint (storySkip), without the opening');
ok(/window\.FLYDIY_MENU\.add\(\{ k: 'skipTut', sec: 'Story'/.test(APP) && /return !!\(s && !s\.open && inGarage\);/.test(APP) && /if \(!gmSkipAsk\) \{ gmSkipAsk = true; return; \}/.test(APP) && /const r = CAREER_DEV \? storyCheckpoint\(playerLoad\(\)\)/.test(APP),
   '6 the menu offers "Skip the tutorial" in the garage while on the rails: two presses, then the checkpoint');
if (process.argv.includes('--selftest')) {
  const bad = JSON.parse(JSON.stringify(d)); bad.wallet += 1;
  console.log('  selftest a wallet off by one: ' + (JSON.stringify(strip(bad)) !== JSON.stringify(strip(B)) ? 'red (ok)' : 'GREEN'));
}
console.log('GATE TUTORLOCK: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
