#!/usr/bin/env node
// _storypack_check.js - GATE STORYPACK (STORY-REVAMP, 22 Nov 2026; the user 13 Nov: "NO GENERATED JOBS at all: everything
// deterministic"; "contracts in any order; projects as ordered steps tied to a site and its meshes"; "a contract/project
// GIVES the machinery"). The career's rules as the pack states them (73b_missions.js, 74_career.js):
//   1 pack.rules: { jobs: 'generated' | 'none', shady } validates; an unknown rule or value is refused
//   2 a pack that states NO rules keeps today's board, to the id (the built-in pack in use = the tables untouched)
//   3 rules.jobs 'none': no drawn job, no drawn shady job, at any point of a career walked to its end; three careers with
//     three different seeds see the same board at every step (the walk is one string); the Trust's loan job still stands
//   4 a mission that repeats (repeat: { every: n }) comes back after n other contracts, one that does not never does
//   5 a project step's track moves the career's world stage when the step is done (never before, never down), is listed
//     as a reveal; a track that does not exist, passes its max or goes down along the steps is refused
//   6 what a step, a project or a mission gives: an ability kept once; 'tech:<n>' opens the machine shop's segment
//   7 the source: the board's draws sit behind the rule
//   9-13 THE STORY PACK (src/missions/story.json): a fresh write of its tool; valid; every mission a contract in an
//     any-order chapter or a step of one project; a whole career WALKED to its end - every mission done, every project
//     done, no drawn job, one career for three seeds; every project step reached in its order; the story's end = the
//     sandbox's final state on every track a project builds; every aerodrome used
//   15 the start and the machinery: a career adopts the pack once (its hangars lose the kits the start names), the
//     projects give them back, nothing is bought; a career begun on another pack keeps what the pack still holds
//   16 the projects board's record; 17 THE SWITCH-OVER: the built page's career loader run as written - a player's career
//     names and fetches the story pack, the dev career / the map page / the sandbox do not; app.js adopts and ticks
//   8 pack.clients: a client the pack brings stands in the providers table while the pack is in use, and leaves with it
//   node tools/_storypack_check.js   -> "GATE STORYPACK: PASS|FAIL"
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
let fails = 0, n = 0;
const ok = (c, msg, extra) => { n++; console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
const J = o => JSON.stringify(o), clone = o => JSON.parse(J(o));
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'missions', 'builtin.json'), 'utf8'));
const pick = (id, as, more) => { const m = clone(B.missions.find(x => x.id === id)); m.id = as; delete m.needs; return Object.assign(m, more || {}); };
const career = seed => { const d = C.careerNormalise(C.careerNew({ id: 's', seed, name: 'gate' })); d.wallet = 50000; return d; };
const finish = (d, id) => { d.career.contracts.done.push({ id, at: 0, pay: 0 }); return d; };
const drawn = ids => ids.filter(id => /^(job|shady):/.test(id));

// the gate's pack: six contracts in ANY order (one of them repeating), a project of three steps
const mk = rules => ({ what: B.what, v: B.v, id: 'storypack-gate', title: 'gate', text: B.text, sites: [], rules,
  campaigns: [{ id: 'c.field', provider: 'field', order: 'any', chapters: [{ id: 'c.field.any', order: 'any', missions: ['g.a', 'g.b', 'g.rep'] }] },
              { id: 'c.resort', provider: 'resort', order: 'any', chapters: [{ id: 'c.resort.any', order: 'any', missions: ['g.c'] }] }],
  missions: [pick('field.02', 'g.a'), pick('field.04', 'g.b'), pick('field.05', 'g.rep', { repeat: { every: 2 } }), pick('resort.02', 'g.c'),
             pick('field.03', 'g.p1'), pick('field.04', 'g.p2'), pick('field.02', 'g.p3', { onDone: { gives: ['kit:metal'] } })],
  projects: [{ id: 'P', name: 'gate project', client: 'field',
    steps: [{ id: 's1', missions: ['g.p1'], site: { id: 'gate.site', state: 1 }, track: 'observatory:1' },
            { id: 's2', missions: ['g.p2'], works: { cost: 500, days: 1 }, track: 'observatory:2', gives: ['tech:2'] },
            { id: 's3', missions: ['g.p3'], track: 'observatory:3' }],
    onDone: { abilities: ['heavy'] } }] });

// ---- 1 the rules validate ----------------------------------------------------------------------------------------------
ok(!C.missionPackValidate(mk({ jobs: 'none' })).length, '1 a pack with rules { jobs: none } validates', C.missionPackValidate(mk({ jobs: 'none' })).slice(0, 3).join('; '));
ok(!C.missionPackValidate(mk(undefined)).length, '1 a pack with no rules validates');
const w1 = C.missionPackValidate(mk({ jobs: 'some' })), w2 = C.missionPackValidate(mk({ lottery: true })), w3 = C.missionPackValidate(mk('none'));
ok(w1.some(w => /rules\.jobs is generated \| none/.test(w)), '1 an unknown value is refused', w1.join('; '));
ok(w2.some(w => /rules\.lottery is not a rule/.test(w)), '1 an unknown rule is refused', w2.join('; '));
ok(w3.some(w => /rules is not an object/.test(w)), '1 rules that are not an object are refused', w3.join('; '));
ok(J(Object.keys(C.MISSION_PACK_RULES)) === J(['jobs', 'shady', 'unflyable']), '1 the rules are three: jobs, shady, unflyable');

// ---- 2 no rules = today's board ----------------------------------------------------------------------------------------
// the walk of a board: at each step every offer listed, then the first authored offer done (the drawn ones never taken)
const walk = (seed, steps, low) => {
  let d = career(seed); const out = [];
  if (low) d.wallet = -1e6;
  for (let i = 0; i < steps; i++) {
    const ids = C.careerOfferIds(d);
    out.push(ids.slice());
    const next = ids.find(id => !/^(job|shady|loan):/.test(id));
    if (!next) break;
    finish(d, next);
  }
  return out;
};
const before = walk('jolene', 8);
ok(C.missionPackRules() === null, '2 before any pack is in use: no rules');
const useB = C.missionPackUse(B);
ok(useB.ok && C.missionPackRules() === null && useB.rules === null, '2 the built-in pack in use states no rules', useB.why);
const after = walk('jolene', 8);
ok(J(before) === J(after), '2 the built-in pack in use: the board of 8 steps is the tables\', to the id');
ok(before.every(L => drawn(L).some(id => /^job:/.test(id))), '2 ...and every step of it holds drawn jobs (today\'s board)', before[0].length + ' offers at the start');
ok(before.some(L => L.some(id => /^shady:/.test(id))), '2 ...and a drawn shady job from its second refresh on (the positive control of 3)');
const boardOf = seed => J(C.careerOffers(career(seed)).offers.map(r => [r.id, r.stages]));
ok(boardOf('jolene') !== boardOf('another'), '2 two seeds give two boards: the drawn jobs differ (the control of 3)');

// ---- 3 rules.jobs none ---------------------------------------------------------------------------------------------------
const useN = C.missionPackUse(mk({ jobs: 'none' }));
ok(useN.ok && useN.n === 7 && !useN.held.length && J(C.missionPackRules()) === J({ jobs: 'none' }), '3 the gate\'s pack in use: 7 missions, none held, its rules live', useN.why + ' ' + J(useN.held));
const PJ = useN.projects;
// the full walk: every offer done in turn, the projects ticked a day apart
const full = seed => {
  let d = career(seed), day = 0; const log = [];
  for (let i = 0; i < 40; i++) {
    const ids = C.careerOfferIds(d);
    log.push(ids.join(','));
    const next = ids.find(id => !/^loan:/.test(id) && !(d.career.contracts.done.filter(x => x.id === id).length >= 2));
    if (next) finish(d, next);
    day += C.MISSION_DAY_S;
    const r = C.careerProjectsTick(d, PJ, day); d = r.doc;
    if (!next && !r.events.length) break;
  }
  return { d, log };
};
const A1 = full('a'), A2 = full('b'), A3 = full('jolene');
ok(A1.log.every(L => !drawn(L.split(',')).length), '3 no drawn job and no drawn shady job at any step of the walk', A1.log.length + ' steps');
ok(A1.d.career.contracts.done.length >= 8, '3 ...a walk long enough to pass the shady job\'s second refresh', A1.d.career.contracts.done.length + ' done');
ok(J(A1.log) === J(A2.log) && J(A1.log) === J(A3.log), '3 three seeds, one board: the walk is the same at every step');
ok(J(A1.d.career.contracts.done) === J(A2.d.career.contracts.done) && J(A1.d.career.projects) === J(A3.d.career.projects), '3 ...and the same career at the end');
ok(A1.log[0].split(',').sort().join() === 'g.a,g.b,g.c,g.p1,g.rep', '3 at the start: every contract at once (any order) and the project\'s first step', A1.log[0]);
{ const d = career('a'); d.wallet = -1e6; const ids = C.careerOfferIds(d);
  ok(ids.some(id => /^loan:/.test(id)), '3 below the floor the Trust\'s loan job still stands (a fixed errand, not a draw)', ids[0]); }
{ const u = C.missionPackUse(mk({ jobs: 'none', shady: true })); let d = career('a'); for (const id of ['g.a', 'g.b', 'g.c']) finish(d, id);
  const ids = C.careerOfferIds(d);
  ok(u.ok && ids.some(id => /^shady:/.test(id)) && !ids.some(id => /^job:/.test(id)), '3 shady: true keeps the drawn shady job without the drawn jobs (the rule is its own)', ids.join(','));
  const v = C.missionPackUse(mk({ shady: false })); const ids2 = C.careerOfferIds(d);
  ok(v.ok && !ids2.some(id => /^shady:/.test(id)) && ids2.some(id => /^job:/.test(id)), '3 shady: false alone drops only the shady job', ids2.filter(id => /^(job|shady)/.test(id)).length + ' drawn'); }

// ...a mission no validated design can fly (900 kg in one piece): held off the board, unless the pack says to offer it
{ const heavy = () => { const p = mk({ jobs: 'none' }); const m = p.missions.find(x => x.id === 'g.b'); m.legs = [{ steps: [{ do: 'carry', from: 'HOME', place: 'w3', load: { kg: 900, pax: 0 } }] }]; return p; };
  const h1 = heavy(), h2 = heavy(); h2.rules.unflyable = 'offer';
  const u1 = C.missionPackUse(h1), o1 = C.careerOfferIds(career('a')), u2 = C.missionPackUse(h2), o2 = C.careerOfferIds(career('a'));
  ok(u1.ok && !o1.includes('g.b') && o1.includes('g.a'), '3 a 900 kg carry no validated design can fly is held off the board (today\'s rule)', u1.why || o1.join(','));
  ok(u2.ok && o2.includes('g.b'), '3 unflyable: offer puts it on the board (the player builds the plane)', u2.why || o2.join(',')); }

// ---- 4 a mission that repeats ----------------------------------------------------------------------------------------------
C.missionPackUse(mk({ jobs: 'none' }));
{ let d = career('a'); const has = id => C.careerOfferIds(d).includes(id);
  ok(has('g.rep') && has('g.a'), '4 at the start both are offered');
  finish(d, 'g.rep'); finish(d, 'g.a');
  ok(!has('g.rep') && !has('g.a'), '4 done: neither is offered (one other contract since)');
  finish(d, 'g.b');
  ok(has('g.rep') && !has('g.a'), '4 two other contracts later the repeating one is back, the other never');
  d.career.contracts.accepted.push('g.rep');
  ok(!has('g.rep'), '4 ...and not while it is accepted');
  d.career.contracts.accepted = []; finish(d, 'g.rep');
  ok(!has('g.rep') && d.career.contracts.done.filter(x => x.id === 'g.rep').length === 2, '4 done a second time: away again'); }

// ---- 5 a step's track moves the world stage --------------------------------------------------------------------------------
{ let d = career('a'); const tr = () => d.career.tracks.observatory;
  const k0 = C.stageKey(C.stageTracksOf(d));
  ok(tr() === 0, '5 a new career: the track at 0');
  let r = C.careerProjectsTick(d, PJ, 0); d = r.doc;
  ok(tr() === 0 && !r.events.length, '5 a tick before the step\'s mission is done moves nothing');
  finish(d, 'g.p1'); r = C.careerProjectsTick(d, PJ, 10); d = r.doc;
  const u = r.events.find(e => e.k === 'unlock');
  ok(tr() === 1 && u && u.unlock === 'observatory:1' && u.project === 'P' && u.step === 's1', '5 step 1 done: the track at 1, an unlock event names it', J(r.events));
  ok(d.career.sites['gate.site'] === 1, '5 ...and its site at its state');
  const k1 = C.stageKey(C.stageTracksOf(d)), rv = C.stageRevealsBetween(C.stageTracksOf(career('a')), C.stageTracksOf(d));
  ok(k0 !== k1 && rv.length === 1 && rv[0].unlock === 'observatory:1' && rv[0].at === 'mt_strip', '5 the composition\'s key changed; the reveal between the two is this unlock, at its strip', k1);
  finish(d, 'g.p2'); r = C.careerProjectsTick(d, PJ, 20); d = r.doc;
  ok(tr() === 1 && r.events.some(e => e.k === 'works'), '5 step 2\'s mission done: its works start, the track still at 1');
  r = C.careerProjectsTick(d, PJ, 20 + C.MISSION_DAY_S); d = r.doc;
  ok(tr() === 2, '5 the works ready: the track at 2');
  d.career.tracks.observatory = 3; finish(d, 'g.p3'); r = C.careerProjectsTick(d, PJ, 30 + 2 * C.MISSION_DAY_S); d = r.doc;
  ok(tr() === 3 && !r.events.some(e => e.k === 'unlock') && d.career.projects.P.done, '5 a track already there is not moved again (no second reveal); the project done');
  ok(C.stageTracksOf({}) === null && C.stageKey(null) === 'sandbox', '5 no career = the sandbox: every track at its max (the final stage)');
  const bad = (steps, re, what) => { const p = mk({ jobs: 'none' }); p.projects[0].steps.forEach((s, i) => { s.track = steps[i]; }); const w = C.missionPackValidate(p); ok(w.some(x => re.test(x)), '5 ' + what + ': refused', w.slice(0, 2).join('; ')); };
  bad(['nowhere:1', 'observatory:2', 'observatory:3'], /track is <track>:<1\.\.max>/, 'a track that does not exist');
  bad(['observatory:1', 'observatory:2', 'observatory:9'], /track is <track>:<1\.\.max>/, 'a track past its max');
  bad(['observatory:2', 'observatory:1', 'observatory:3'], /does not go up/, 'a track going down along the steps'); }

// ---- 6 what is given ----------------------------------------------------------------------------------------------------------
{ let d = career('a'); d.career.tech = C.techNew();
  ok(C.careerTechSeg(d) === 1, '6 a career with a machine shop starts at segment 1');
  finish(d, 'g.p1'); let r = C.careerProjectsTick(d, PJ, 0); d = r.doc;
  ok(C.careerTechSeg(d) === 1 && !(d.career.abilities || []).length, '6 step 1 gives nothing');
  finish(d, 'g.p2'); r = C.careerProjectsTick(d, PJ, 1); d = r.doc; r = C.careerProjectsTick(d, PJ, 1 + C.MISSION_DAY_S); d = r.doc;
  const g = r.events.find(e => e.k === 'gives');
  ok(C.careerTechSeg(d) === 2 && d.career.abilities.includes('tech:2') && g && g.what === 'tech:2' && g.from === 'P:s2', '6 step 2 done: it gives tech:2 - the segment open, an event names it', J(r.events.filter(e => e.k === 'gives')));
  // step 3's mission, flown to its end through the career's stop: its onDone gives a kit
  const acc = C.careerAccept(d, 'g.p3');
  ok(acc.ok, '6 step 3\'s mission is on offer and accepted', acc.why);
  d = acc.doc;
  const rec = C.careerContract(d, 'g.p3'), sub = rec.stages[0].subs[0];
  const stopAt = (aero, o) => C.careerStopRecord(Object.assign({ how: 'stopped', aero, occupants: 1, cargoKg: 0, row: { from: 'HOME', to: aero, t: 300 }, hour: 12 }, o || {}));
  const hooks = {};
  let s = C.careerOnStop(d, stopAt(sub.from, { cargoKg: 0 }), hooks); if (s.ok) d = s.doc;
  s = C.careerOnStop(d, stopAt(sub.to, { cargoKg: (sub.load && sub.load.kg) || 0, occupants: 1 + ((sub.load && sub.load.pax) || 0), row: { from: sub.from, to: sub.to, t: 300 } }), hooks);
  const gv = s.ok && s.events.find(e => e.k === 'gives');
  ok(s.ok && s.events.some(e => e.k === 'done' && e.id === 'g.p3') && gv && gv.what === 'kit:metal' && s.doc.career.abilities.includes('kit:metal'),
     '6 the mission flown to its end: its done gives kit:metal', s.ok ? J(s.events.map(e => e.k)) : s.why + ' ' + J(s.untouched || {}));
  if (s.ok) d = s.doc;
  r = C.careerProjectsTick(d, PJ, 5 * C.MISSION_DAY_S); d = r.doc;
  ok(d.career.projects.P.done && d.career.abilities.join() === 'tech:2,kit:metal,heavy', '6 the project done: its own ability last; each kept once, in the order given', d.career.abilities.join());
  r = C.careerProjectsTick(d, PJ, 6 * C.MISSION_DAY_S);
  ok(!r.events.length && J(r.doc.career.abilities) === J(d.career.abilities), '6 a later tick gives nothing twice');
  const p = mk({ jobs: 'none' }); p.projects[0].steps[1].gives = ['tech:7', 'kit:nope', 'Not A Word'];
  const w = C.missionPackValidate(p);
  ok(w.some(x => /no machine shop segment 7/.test(x)) && w.some(x => /no hangar kit nope/.test(x)) && w.some(x => /an ability is a word/.test(x)), '6 a segment, a kit or a word that does not exist: refused', w.slice(0, 3).join('; ')); }

// ---- 8 the pack's own clients -----------------------------------------------------------------------------------------------
{ const withClient = () => { const p = mk({ jobs: 'none' });
    p.clients = [{ id: 'gateclub', fields: ['HOME', 'w3'], track: 'clients', person: 'stig', colour: '#336699' }];
    p.text = Object.assign({}, p.text, { 'prov.gateclub.name': { t: 'Gate club' }, 'prov.gateclub.desc': { t: 'A client the pack brings.' }, 'prov.gateclub.short': { t: 'Club' } });
    p.missions.push(pick('field.02', 'g.club', { provider: 'gateclub', rep: { provider: 'gateclub', gain: 0.5 } }));
    delete p.missions[p.missions.length - 1].client;
    p.campaigns.push({ id: 'c.club', provider: 'gateclub', order: 'any', chapters: [{ id: 'c.club.any', order: 'any', missions: ['g.club'] }] });
    return p; };
  const p = withClient(), w = C.missionPackValidate(p);
  ok(!w.length, '8 a pack with a client of its own validates', w.slice(0, 3).join('; '));
  ok(!C.CONTRACT_PROVIDERS.gateclub, '8 validating does not touch the live table');
  const u = C.missionPackUse(p);
  const row = C.CONTRACT_PROVIDERS.gateclub;
  ok(u.ok && !u.held.length && row && row.pack === true && row.night.length === 1 && row.jobs.length === 0, '8 in use: the client stands in the providers table with its mission, no job table', u.why + J(u.held));
  let d = career('a');
  ok(C.careerOfferIds(d).includes('g.club'), '8 its mission is on the board');
  ok(C.careerContract(d, 'g.club').client === 'stig', '8 a mission of the client with no client of its own is its person\'s');
  const map = C.careerMapRecord(d, null, {}), tab = map.providers.find(x => x.id === 'gateclub');
  ok(tab && tab.name === 'Gate club' && tab.short === 'Club' && tab.colour === '#336699' && tab.client && tab.client.id === 'stig', '8 the map\'s record lists it: its name, its colour, its person', J(tab).slice(0, 160));
  // flown to its end: the reputation is the client's own
  d = C.careerAccept(d, 'g.club').doc;
  const stopAt = (aero, o) => C.careerStopRecord(Object.assign({ how: 'stopped', aero, occupants: 1, cargoKg: 0, row: { from: 'HOME', to: aero, t: 300 }, hour: 12 }, o || {}));
  let s = C.careerOnStop(d, stopAt('w3'), {}); if (s.ok) d = s.doc;
  s = C.careerOnStop(d, stopAt('HOME', { cargoKg: 40, row: { from: 'w3', to: 'HOME', t: 300 } }), {});
  ok(s.ok && s.doc.career.providers.gateclub && s.doc.career.providers.gateclub.rep === 0.5, '8 flown to its end: the reputation earned is the client\'s', s.ok ? J(s.doc.career.providers.gateclub) : s.why);
  C.missionPackUse(mk({ jobs: 'none' }));
  ok(!C.CONTRACT_PROVIDERS.gateclub, '8 another pack in use: the client left with its pack');
  C.missionPackUse(p); C.missionPackUse(B);
  ok(!C.CONTRACT_PROVIDERS.gateclub && Object.keys(C.CONTRACT_PROVIDERS).join() === 'field,minedock,resort,survey,clients', '8 the built-in pack back: the game\'s five providers, nothing else');
  const bad = (f, re, what) => { const q = withClient(); f(q); const x = C.missionPackValidate(q); ok(x.some(y => re.test(y)), '8 ' + what + ': refused', x.slice(0, 2).join('; ')); };
  bad(q => { q.clients[0].id = 'field'; }, /a provider of the game already/, 'a client named like a provider of the game');
  bad(q => { q.clients[0].fields = ['w99']; }, /field w99 is not a field/, 'a client on a field that does not exist');
  bad(q => { q.clients[0].track = 'nowhere'; }, /no track nowhere/, 'a client on a track that does not exist');
  bad(q => { q.clients[0].person = 'nobody'; }, /nobody is not in the people table/, 'a client whose person is nobody');
  bad(q => { q.clients[0].id = 'gatetwo'; q.text['prov.gatetwo.name'] = { t: 'x' }; q.text['prov.gatetwo.desc'] = { t: 'x' }; }, /text key prov\.gatetwo\.short does not resolve/, 'a client with no short name');
  bad(q => { q.clients = []; }, /no provider gateclub/, 'a mission of a client the pack does not declare'); }

// ---- 9-13 THE STORY PACK (src/missions/story.json, written by tools/_story_pack.js) ------------------------------------------
{ const cp = require('child_process');
  const SP = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'missions', 'story.json'), 'utf8'));
  const fresh = cp.spawnSync(process.execPath, [path.join(T, '_story_pack.js'), '--check'], { encoding: 'utf8' });
  ok(fresh.status === 0, '9 story.json is a fresh write of tools/_story_pack.js', (fresh.stdout || fresh.stderr || '').trim().slice(0, 160));
  const w = C.missionPackValidate(SP);
  ok(!w.length, '9 the story pack validates', w.slice(0, 3).join('; '));
  ok(J(SP.rules) === J({ jobs: 'none', shady: false, unflyable: 'offer' }), '9 its rules: no drawn job, no drawn shady job, a mission no validated design flies is offered', J(SP.rules));
  const use = C.missionPackUse(SP), N = C.missionPackNormalise(SP);
  const real = N.missions.filter(m => m.tutorial == null), ids = real.map(m => m.id);
  ok(use.ok && !use.held.length && use.n === real.length, '9 in use: every mission installed, none held', use.why + ' ' + use.n + '/' + real.length + ' ' + J(use.held.slice(0, 3)));
  ok(N.campaigns.every(c => c.tutorial || (c.order === 'any' && c.chapters.every(h => h.order === 'any'))), '9 CONTRACTS IN ANY ORDER: every chapter of every campaign is any-order (no arc)');
  ok(Object.keys(C.CONTRACT_PROVIDERS).every(p => !C.CONTRACT_PROVIDERS[p].arc.length), '9 ...so no provider holds an arc');
  const inStep = {}; for (const q of N.projects) q.steps.forEach((st, k) => { for (const m of st.missions) inStep[m] = { q: q.id, k }; });
  const inChap = new Set([].concat(...N.campaigns.filter(c => !c.tutorial).map(c => [].concat(...c.chapters.map(h => h.missions)))));
  ok(ids.every(id => (inStep[id] ? 1 : 0) + (inChap.has(id) ? 1 : 0) === 1), '9 every mission is a contract of one chapter or a step of one project, never both, never neither',
     ids.filter(id => (inStep[id] ? 1 : 0) + (inChap.has(id) ? 1 : 0) !== 1).join(','));
  ok(N.projects.length === 10 && N.projects.every(q => q.steps.length >= 2 && q.steps.every(st => st.missions.length >= 1 && st.site && st.site.id && C.CONTRACT_FIELDS[st.site.id])),
     '9 ten projects; every step has a mission and a SITE that is an aerodrome of the island', N.projects.map(q => q.id + ':' + q.steps.length).join(' '));
  ok(typeof C.STORY_JOB === 'undefined' || ids.includes(C.STORY_JOB), '9 the tutorial\'s one job is a mission of the pack');
  ok(Object.keys(SP.text).every(k => SP.text[k].draft === true), '9 every word of the pack is marked a draft');

  // 10 THE WALK: a whole career, every offer done in turn (the first on the board; a repeating one twice at most), the
  // projects ticked a day apart - to the end
  const walkS = seed => {
    let d = career(seed), day = 0; d.wallet = 1e6;
    const log = [], firstOn = {}, lastOn = {}, events = [];
    for (let i = 0; i < 400; i++) {
      const offers = C.careerOfferIds(d);
      for (const id of offers) { if (firstOn[id] == null) firstOn[id] = i; lastOn[id] = i; }
      log.push(offers.join(','));
      const times = id => d.career.contracts.done.filter(x => x.id === id).length;
      const AU = C.contractAuthored();                           // (a delivered order's follow-up '<id>+n' is the client coming back: not a mission of the pack, left on the board)
      const next = offers.find(id => AU[id] && times(id) < (AU[id].repeat ? 2 : 1));
      // done the career's own way (74_ careerComplete: the pay, the client's reputation, the mission's own unlock, the done row)
      if (next) C.careerComplete(d, AU[next], { got: {} }, null, events);
      day += C.MISSION_DAY_S;
      const r = C.careerProjectsTick(d, use.projects, day); d = r.doc; events.push(...r.events.map(e => Object.assign({ i }, e)));
      if (!next && !r.events.length && !Object.values(d.career.projects).some(S => S.works)) break;
    }
    return { d, log, firstOn, lastOn, events, days: day / C.MISSION_DAY_S };
  };
  const W1 = walkS('a'), W2 = walkS('b'), W3 = walkS('jolene');
  const doneIds = new Set(W1.d.career.contracts.done.map(x => x.id));
  ok(ids.every(id => doneIds.has(id)), '10 the walk completes EVERY mission of the pack', ids.filter(id => !doneIds.has(id)).join(',') || W1.d.career.contracts.done.length + ' done in ' + W1.days + ' days');
  ok(N.projects.every(q => (W1.d.career.projects[q.id] || {}).done), '10 ...and every project', N.projects.filter(q => !(W1.d.career.projects[q.id] || {}).done).map(q => q.id).join(','));
  ok(W1.log.every(L => !drawn(L.split(',')).length), '10 no drawn job at any step of it', W1.log.length + ' steps');
  ok(J(W1.log) === J(W2.log) && J(W1.log) === J(W3.log) && J(W1.d.career) === J(Object.assign({}, W2.d.career, { seed: 'a' })), '10 three seeds, one career: the same board at every step, the same document at the end');
  const end = W1.log[W1.log.length - 1].split(',').filter(Boolean);
  const AU = C.contractAuthored(), follow = end.filter(id => /\+\d+$/.test(id)), reg = end.filter(id => !/\+\d+$/.test(id));
  ok(reg.length > 0 && reg.every(id => AU[id] && AU[id].repeat), '10 at the end the board holds the regular work (the missions that repeat)', reg.join(','));
  ok(follow.every(id => AU[id.replace(/\+\d+$/, '')] && AU[id.replace(/\+\d+$/, '')].kind === 'build'), '10 ...and the delivered orders\' follow-ups (the client coming back: one per order, GQ26)', follow.length + ' follow-ups');
  // 11 EVERY PROJECT STEP REACHABLE, IN ORDER: a step's missions come on the board only once the step before is done
  { let bad = [];
    for (const q of N.projects) q.steps.forEach((st, k) => {
      const stepDone = k2 => (W1.events.find(e => e.k === 'step' && e.project === q.id && e.step === q.steps[k2].id) || {}).i;
      for (const m of st.missions) {
        if (W1.firstOn[m] == null) bad.push(m + ' never offered');
        else if (k > 0 && !(W1.firstOn[m] > stepDone(k - 1))) bad.push(m + ' offered at ' + W1.firstOn[m] + ', before step ' + q.steps[k - 1].id + ' was done (' + stepDone(k - 1) + ')');
        else if (W1.lastOn[m] > stepDone(k)) bad.push(m + ' still offered after its step was done');
      }
      if (stepDone(k) == null) bad.push(q.id + ':' + st.id + ' never done');
    });
    ok(!bad.length, '11 every step of every project is reached, in its order: its missions on the board only while the project stands at it', bad.slice(0, 4).join('; ') || N.projects.reduce((a, q) => a + q.steps.length, 0) + ' steps');
    const req = N.projects.filter(q => q.requires.projects.length).every(q => { const first = W1.firstOn[q.steps[0].missions[0]];
      return q.requires.projects.every(r => first > Math.max(...W1.events.filter(e => e.k === 'projectDone' && e.project === r).map(e => e.i))); });
    ok(req, '11 a project that requires another opens only once that one is done'); }
  // 12 THE WORLD: the story's end is the sandbox's final state on every track a project builds
  { const MAX = C.stageMaxes(), tr = W1.d.career.tracks;
    const built = new Set([].concat(...N.projects.map(q => q.steps.filter(st => st.track).map(st => st.track.split(':')[0]))));
    ok([...built].every(t => tr[t] === MAX[t]), '12 every track a project builds ends at its max: the story\'s end = the sandbox\'s final state there', [...built].map(t => t + ' ' + tr[t] + '/' + MAX[t]).join(' '));
    const rest = Object.keys(MAX).filter(t => tr[t] !== MAX[t]);
    ok(!rest.length, '12 ...and every other track too: at the story\'s end EVERY track stands at its max - the sandbox\'s world', rest.map(t => t + ' ' + tr[t] + '/' + MAX[t]).join(' ') || Object.keys(MAX).length + ' tracks');
    const unl = W1.events.filter(e => e.k === 'unlock' && e.project).map(e => e.unlock);
    ok(new Set(unl).size === unl.length && unl.length === N.projects.reduce((a, q) => a + q.steps.filter(st => st.track).length, 0), '12 every step with a world stage unlocked it exactly once', unl.length + ' unlocks');
    ok(W1.d.career.abilities.slice().sort().join() === 'hangar:home,kit:metal,kit:wood,tech:2,tech:3',
       '12 what the story gives: the metal shop and segment 2 (the old hangar), the wood shop (the new cabin), segment 3 (the observatory), the home hangar', W1.d.career.abilities.join()); }
  // 13 THE ISLAND IS USED: every aerodrome is a place of some mission
  { const used = new Set();
    for (const id of ids) for (const u of C.contractSubsOf(C.contractAuthored()[id])) for (const k of ['from', 'to', 'at']) if (u[k]) used.add(u[k]);
    const not = Object.keys(C.CONTRACT_FIELDS).filter(f => !used.has(f));
    ok(!not.length, '13 EVERY aerodrome of the island is a place of some mission', not.join() || Object.keys(C.CONTRACT_FIELDS).length + ' aerodromes'); }
  // 14 THE AERO CLUB: its events are scored (a STOL line, a lap with medals, a regularity lap, a course) and REPEAT
  { const AU2 = (C.missionPackUse(SP), C.contractAuthored()), ev = ids.filter(id => AU2[id].provider === 'aeroclub');
    const kindOf = r => (r.stol ? 'stol:' + r.stol.map(x => x.kind).join('+') : r.course ? 'course' : (r.timers || []).some(t => t.regularity) ? 'regularity' : (r.timers || []).length ? 'lap' : 'flight');
    ok(ev.length === 6 && ev.map(id => kindOf(AU2[id])).sort().join() === 'course,flight,lap,regularity,stol:landing,stol:spot', '14 the Aero Club: six events - a STOL landing, a spot landing, a timed lap, a regularity lap, a three-leg course, a timed gathering', ev.map(id => id + '=' + kindOf(AU2[id])).join(' '));
    ok(ev.filter(id => AU2[id].repeat).length === 4 && ev.filter(id => AU2[id].repeat).every(id => AU2[id].repeat.every === 1), '14 four of them repeat (one other contract between two tries); the two of the club house project are flown once');
    ok(ev.every(id => !C.contractRuntimeOk(AU2[id])) && ev.filter(id => AU2[id].timers || AU2[id].stol).every(id => C.contractCertNeed(AU2[id]) === 'comm'), '14 the runtime runs every one; a scored event needs the commercial certificate');
    const gh = ev.filter(id => JSON.stringify(AU2[id]).includes('"ghost"'));
    ok(gh.length === 3, '14 three carry a fixed ghost (the rival\'s result, the same for every player)', gh.join()); }
  // 15 THE START AND THE MACHINERY: a career adopts the pack once - its hangars lose the kits the start names; the projects
  // give them back; nothing is bought
  { const use2 = C.missionPackUse(SP);
    const aeros = [{ id: 'HOME', name: 'Jolene AFB 13/31', kind: 'strip' }, { id: 'w1', name: 'Cabin Strip', kind: 'strip' }, { id: 'w6', name: 'Old Community Runway', kind: 'strip' }, { id: 'SEA', name: 'Greywater Dock', kind: 'water' }];
    let d = C.storySkip(C.careerNormalise(C.careerNew({ id: 'ad', seed: 'ad', name: 'ad' })), { aeros }).doc;
    const kits = h => d.sheds[h].kits.join(), caps = h => [...C.hangarCaps(d.sheds[h])];
    ok(/metal/.test(kits('HOME')) && /wood/.test(kits('w1')), '15 before the pack is adopted: the hangars as a career has them today (every kit)');
    const a1 = C.careerPackAdopt(d, use2); d = a1.doc;
    ok(a1.notes.length === 2 && !/metal|wood/.test(kits('HOME')) && !/metal|wood/.test(kits('w1')) && /bench/.test(kits('HOME')) && d.career.pack.id === 'story',
       '15 adopted: both hangars start without the metal shop and the wood shop (the bench stays)', a1.notes.join(' | '));
    ok(!caps('HOME').includes('metal') && !caps('HOME').includes('wood') && caps('HOME').includes('handwork'), '15 ...so the hangar earns neither verb yet', caps('HOME').join());
    const a2 = C.careerPackAdopt(d, use2);
    ok(a2.doc === d && !a2.notes.length, '15 adopting again changes nothing (the very same document)');
    // the old hangar's last step, then the new cabin: the kits arrive
    const stepDone = (q, k) => { d.career.projects = d.career.projects || {}; const Q = use2.projects.find(x => x.id === q); for (let i = 0; i <= k; i++) for (const m of Q.steps[i].missions) d.career.contracts.done.push({ id: m, at: 0, pay: 0 });
      let t = 0, ev = []; for (let i = 0; i < 40; i++) { t += C.MISSION_DAY_S; const r = C.careerProjectsTick(d, use2.projects, t); d = r.doc; ev.push(...r.events); } return ev; };
    let ev = stepDone('hangar', 2);
    ok(/metal/.test(kits('HOME')) && /metal/.test(kits('w1')) && !/wood/.test(kits('HOME')) && ev.some(e => e.k === 'gives' && e.what === 'kit:metal') && caps('HOME').includes('metal') && C.careerTechSeg(d) === 2,
       '15 the old hangar restored: the metal shop stands in both hangars, the verb earned, segment 2 open - given, not bought', kits('HOME'));
    ok(kits('HOME') === C.HANGAR_KITS_DEFAULT.filter(k => k !== 'wood').join(), '15 ...in the kits\' own order');
    const w0 = d.wallet; ev = stepDone('home', 1);
    ok(/wood/.test(kits('HOME')) && /wood/.test(kits('w1')) && caps('w1').includes('wood'), '15 the new cabin built: the wood shop stands in both', kits('w1'));
    ok(d.ledger.filter(l => l.k === 'works').length === 2 && !d.ledger.some(l => /kit/.test(l.k + ' ' + (l.ref || ''))), '15 the ledger: the home works paid, no kit bought');
    // a career begun on another pack: an accepted mission no table knows is dropped at the adoption, said
    C.missionPackUse(B);
    let e = C.careerNormalise(C.careerNew({ id: 'old', seed: 'old', name: 'old' })); e = C.careerAccept(e, 'field.01').doc;
    const j = C.careerOfferIds(e).find(id => /^job:/.test(id)); e = C.careerAccept(e, j).doc;
    e.career.contracts.accepted.push('field.03'); e.career.contracts.live['field.03'] = { stage: 0, subs: [], picked: [], got: {} };
    const use3 = C.missionPackUse(SP), a3 = C.careerPackAdopt(e, use3);
    ok(a3.doc.career.contracts.accepted.join() === 'field.01,' + j && a3.notes.some(n => /no longer on any board: field\.03/.test(n)),
       '15 a career begun on the built-in pack: the mission the story pack does not hold is dropped and said; the one it holds and an accepted drawn job (kept as offered) stay', a3.notes.join(' | '));
    // a career that adopted the story pack, on a page where another pack (or none of its own) is in use: its board is closed
    ok(C.missionPackId() === 'story' && C.careerOfferIds(d).length > 0, '15 the adopted career, its pack in use: a board');
    C.missionPackUse(B);
    ok(C.missionPackId() === 'builtin' && C.careerOfferIds(d).length === 0 && C.careerOfferIds(career('a')).some(id => /^job:/.test(id)),
       '15 ...another pack in use (its own could not load): NO board for it - never another pack\'s missions, never a drawn job; a career that adopted none is as before');
    C.missionPackUse(SP);
    const bad = C.missionPackValidate(Object.assign({}, SP, { start: { sheds: { HOME: { without: ['park', 'laser'] } }, money: 5 } }));
    ok(bad.some(w => /the bare shed stays/.test(w)) && bad.some(w => /no hangar kit laser/.test(w)) && bad.some(w => /start\.money is not known/.test(w)), '15 a start that takes the bare shed, names no kit or says something else: refused', bad.slice(0, 3).join('; '));
  }
  // 16 THE PROJECTS BOARD'S RECORD (the page draws it): locked / open / done, the current step, the works running
  { const use4 = C.missionPackUse(SP); let d = career('a'); d.wallet = 1e6;
    let Bd = C.careerProjectsBoard(d, use4.projects, 0);
    const row = id => Bd.find(x => x.id === id);
    ok(Bd.length === 10 && row('home').state === 'open' && row('home').step === 0 && row('home').steps[0].state === 'current' && row('home').steps[1].state === 'later'
       && row('observatory').state === 'locked' && row('observatory').needs.join() === 'hangar', '16 a new career: home open at its first step; the observatory locked behind the old hangar', Bd.map(x => x.id + ':' + x.state).join(' '));
    for (const m of row('home').steps[0].missions) finish(d, m.id);
    let r = C.careerProjectsTick(d, use4.projects, 100); d = r.doc; Bd = C.careerProjectsBoard(d, use4.projects, 100);
    ok(row('home').steps[0].state === 'works' && row('home').steps[0].ready === 100 + 2 * C.MISSION_DAY_S && row('home').steps[0].missions.every(m => m.done), '16 the first step\'s missions done: its works run, their end said', J(row('home').steps[0]).slice(0, 200));
    r = C.careerProjectsTick(d, use4.projects, 100 + 2 * C.MISSION_DAY_S); d = r.doc; Bd = C.careerProjectsBoard(d, use4.projects, 0);
    ok(row('home').step === 1 && row('home').steps[0].state === 'done' && row('home').steps[1].state === 'current' && row('home').steps[1].gives.join() === 'kit:wood' && row('home').steps[1].track === 'home:2' && row('home').steps[1].site === 'w1',
       '16 the works done: the next step current - its world stage, what it gives and its site on the record'); }
  // 17 THE SWITCH-OVER: a player's career reads the story pack with no flag; the dev career and the sandbox do not
  { const vm = require('vm');
    const BLD = fs.readFileSync(path.join(T, 'build.js'), 'utf8'), APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), IDX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const dflt = (/const CAREER_PACK_DEFAULT = '([\w.-]+)';/.exec(BLD) || [])[1];
    ok(dflt === 'story' && fs.existsSync(path.join(ROOT, 'src', 'missions', dflt + '.json')), '17 build.js names the pack a player\'s career reads, and the file is there', dflt);
    // the career loader of the BUILT page, run as written: which pack it names and fetches, per way in
    const a = IDX.indexOf('window.FLYDIY_CAREER_WANT = function'), s0 = IDX.lastIndexOf('(function () {', a), s1 = IDX.indexOf('})();', a) + 5;
    const loader = IDX.slice(s0, s1);
    const way = async (search, mode) => {
      const fetched = [], win = { FLYDIY_MODE: mode || undefined, FLYDIY_BOOT: Promise.resolve(true) };
      const ctx = vm.createContext({ window: win, location: { search }, navigator: {}, console: { warn() {}, info() {} }, Promise, JSON,
        fetch: u => { fetched.push(u); return Promise.resolve({ ok: true, text: () => Promise.resolve(/missions/.test(u) ? '{"pack":1}' : '/* core */') }); } });
      vm.runInContext(loader, ctx);
      await win.FLYDIY_CAREER_LOAD;
      return { id: win.FLYDIY_PACK_ID, text: win.FLYDIY_PACK_TEXT || null, fetched: fetched.filter(u => /missions/.test(u)).join(), core: fetched.some(u => /career_core/.test(u)) };
    };
    (async () => {
      const W = { player: await way('', 'career'), mode: await way('?mode=career', 'career'), dev: await way('?career=1', undefined), devMode: await way('?career=1', 'career'),
                  sandbox: await way('', undefined), flag: await way('?career=1&pack=demo_p1', undefined), draft: await way('?pack=draft', 'career'), map: await way('?map=1', undefined) };
      ok(W.player.id === 'story' && W.player.fetched === 'src/missions/story.json' && W.player.text && W.mode.id === 'story', '17 the welcome menu\'s career: the loader names the story pack and fetches it beside the core', J(W.player));
      ok(W.dev.id === null && !W.dev.fetched && W.dev.core && W.devMode.id === null && W.map.id === null && !W.map.fetched, '17 the dev career (?career=1) and the map page: no pack - the gates\' fixtures keep the built-in tables', J([W.dev, W.devMode, W.map]));
      ok(W.sandbox.id === undefined && !W.sandbox.core && !W.sandbox.fetched, '17 the sandbox: nothing asked for at all', J(W.sandbox));
      ok(W.flag.id === 'demo_p1' && W.flag.fetched === 'src/missions/demo_p1.json' && W.draft.id === 'draft' && !W.draft.fetched, '17 ?pack=<id> still wins (and ?pack=draft fetches nothing: the editor\'s draft)', J([W.flag, W.draft]));
      ok(/if \(!id && !CAREER_DEVFLAG\) try \{ id = window\.FLYDIY_PACK_ID \|\| null; \}/.test(APP), '17 app.js takes the loader\'s pack only outside the dev career');
      ok(/window\.localStorage\.setItem\('flydiy\.pack\.' \+ id, txt\); else txt = window\.localStorage\.getItem\('flydiy\.pack\.' \+ id\)/.test(APP), '17 ...keeps its text for a start with no network, and reads it back then');
      ok(/if \(CAREER_DEV && STORY_PAGE && CAREER_PACK && CAREER_PACK\.ok && typeof careerPackAdopt === 'function'\) try \{\s+const a = careerPackAdopt\(player, CAREER_PACK\);/.test(APP), '17 the career adopts its pack at the load (a player\'s career only)');
      ok(/\{ const pj = projectsNow\(d\); d = pj\.doc;/.test(APP) && /if \(pj\.events\.some\(e => e\.k === 'unlock'\)\) try \{ stageNote\(pj\.doc\); \}/.test(APP) && /player = projectsNow\(player\)\.doc;/.test(APP),
         '17 the projects meet the clock at a flight\'s end, at the load and on a wait; a step\'s world stage is noted for the next composition');
      finishGate();
    })().catch(e => { ok(false, '17 the loader ran', String(e && e.stack || e).slice(0, 300)); finishGate(); });
  }
}

// ---- 7 the source (run last: section 17 is asynchronous) -----------------------------------------------------------------------
function finishGate() {
const S74 = fs.readFileSync(path.join(ROOT, 'src', 'core', '74_career.js'), 'utf8');
ok(/if \(!R \|\| R\.jobs !== 'none'\) for \(const j of contractJobs\(/.test(S74) && (S74.match(/contractJobs\(c\.seed/g) || []).length === 1,
   '7 the board draws jobs in one place, behind the rule');
ok((S74.match(/econShadyOffer\(doc\)/g) || []).length === 1 && /R\.shady === false/.test(S74), '7 the shady job is offered in one place, behind the rule');
C.missionPackUse(B);
ok(C.missionPackRules() === null && J(walk('jolene', 8)) === J(before), '7 the built-in pack back in use: today\'s board again (the rules are the pack\'s, not a switch left on)');

console.log(n + ' checks, ' + fails + ' failed');
console.log('GATE STORYPACK: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
}
