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

// ---- 7 the source ------------------------------------------------------------------------------------------------------------
const S74 = fs.readFileSync(path.join(ROOT, 'src', 'core', '74_career.js'), 'utf8');
ok(/if \(!R \|\| R\.jobs !== 'none'\) for \(const j of contractJobs\(/.test(S74) && (S74.match(/contractJobs\(c\.seed/g) || []).length === 1,
   '7 the board draws jobs in one place, behind the rule');
ok((S74.match(/econShadyOffer\(doc\)/g) || []).length === 1 && /R\.shady === false/.test(S74), '7 the shady job is offered in one place, behind the rule');
C.missionPackUse(B);
ok(C.missionPackRules() === null && J(walk('jolene', 8)) === J(before), '7 the built-in pack back in use: today\'s board again (the rules are the pack\'s, not a switch left on)');

console.log(n + ' checks, ' + fails + ' failed');
console.log('GATE STORYPACK: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
