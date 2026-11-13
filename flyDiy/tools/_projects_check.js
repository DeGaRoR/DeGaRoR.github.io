#!/usr/bin/env node
// _projects_check.js - GATE PROJECTS (PROJECTS, 13 Nov; the user: "projects = ordered steps tied to a site and its meshes ...
// projects should be CONFIGURATION, not coding; the mission editor handles all of it"). A pack's `projects` (73b_missions.js):
//   1 normalise + validate: steps, missions that exist, projects named that exist
//   2 install: a step's missions are offered only while their project stands at that step (needs.project), and only once
//     the projects it requires are done (needs.projects) - 74_career.js careerNeedsOk
//   3 careerProjectsTick: a step's missions done -> its works start (cost charged, ready `days` later); the works ready ->
//     the step done, the site's state set, the next step's missions offered; the last step -> the project done, its
//     abilities granted, the projects it opens open
//   node tools/_projects_check.js   -> "GATE PROJECTS: PASS|FAIL"
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
const B = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'missions', 'builtin.json'), 'utf8'));
const pick = (id, as) => { const m = JSON.parse(JSON.stringify(B.missions.find(x => x.id === id))); m.id = as; delete m.needs; return m; };
const pack = { what: B.what, v: B.v, id: 'projects-gate', title: 'gate', text: B.text, sites: [], campaigns: [],
  missions: [pick('field.01', 'pa.m1'), pick('field.02', 'pa.m2'), pick('minedock.01', 'pb.m1')],
  projects: [
    { id: 'A', name: 'Restore the old hangar', client: 'field',
      steps: [{ id: 'safe', missions: ['pa.m1'], works: { cost: 1000, days: 2 }, site: { id: 'HOME.2', state: 1 } },
              { id: 'roof', missions: ['pa.m2'], site: { id: 'HOME.2', state: 2 } }],
      onDone: { abilities: ['metal'], projects: ['B'] } },
    { id: 'B', name: 'Next', client: 'minedock', requires: { projects: ['A'] }, steps: [{ id: 's1', missions: ['pb.m1'] }] } ] };
// 1
const why = C.missionPackValidate(pack);
ok(!why.length, '1 a pack with two projects validates', why.slice(0, 3).join('; '));
const bad = JSON.parse(JSON.stringify(pack)); bad.projects[0].steps[0].missions = ['nope']; bad.projects[1].requires.projects = ['Z'];
const bw = C.missionPackValidate(bad);
ok(bw.some(w => /names no mission nope/.test(w)) && bw.some(w => /names no project Z/.test(w)), '1 a step naming no mission, a project naming no project: refused', bw.slice(0, 2).join('; '));
// 2-3: the pack in use over the live tables, a career walked through
const P = C.missionPackNormalise(pack), use = C.missionPackUse(pack);
ok(use.ok && use.n === 3, '2 the pack in use: its 3 missions installed', use.why || use.n);
let d = C.careerNormalise(C.careerNew({ id: 'p', seed: 'projects', name: 'gate' }));
d.wallet = 50000;
const offers = () => C.careerOfferIds(d).filter(id => /^p[ab]\./.test(id)).sort().join(',');
ok(offers() === 'pa.m1', '2 at the start: only project A\'s first step is offered', offers());
const finish = id => { d.career.contracts.done.push({ id, at: 0, pay: 0 }); };
finish('pa.m1');
let r = C.careerProjectsTick(d, P.projects, 100); d = r.doc;
ok(r.events.some(e => e.k === 'works' && e.project === 'A' && e.cost === 1000) && d.wallet === 49000 && d.career.projects.A.step === 0 && offers() === '',
   '3 step 1\'s missions done: its works start (1 000 charged), the step not done yet, nothing new offered', JSON.stringify(r.events) + ' wallet ' + d.wallet);
r = C.careerProjectsTick(d, P.projects, 100 + 1.5 * C.MISSION_DAY_S); d = r.doc;
ok(d.career.projects.A.step === 0 && !r.events.length, '3 a day and a half later: the works still running');
r = C.careerProjectsTick(d, P.projects, 100 + 2 * C.MISSION_DAY_S); d = r.doc;
ok(d.career.projects.A.step === 1 && d.career.sites['HOME.2'] === 1 && offers() === 'pa.m2', '3 the works done (2 days): the step done, the site at state 1, step 2\'s mission offered', offers());
finish('pa.m2');
r = C.careerProjectsTick(d, P.projects, 100 + 3 * C.MISSION_DAY_S); d = r.doc;
const pd = r.events.find(e => e.k === 'projectDone');
ok(d.career.projects.A.done && d.career.sites['HOME.2'] === 2 && d.career.abilities.includes('metal') && pd && pd.projects.join() === 'B',
   '3 the last step done: project A done, the site at state 2, the metal shop granted, B opened', JSON.stringify(r.events));
ok(offers() === 'pb.m1', '3 project B (requires A): its first step offered now', offers());
const again = C.careerProjectsTick(d, P.projects, 100 + 4 * C.MISSION_DAY_S);
ok(!again.events.length && JSON.stringify(again.doc.career.projects) === JSON.stringify(d.career.projects), '3 a tick with nothing new changes nothing');
// the source
const S73 = fs.readFileSync(path.join(ROOT, 'src', 'core', '73b_missions.js'), 'utf8'), S74 = fs.readFileSync(path.join(ROOT, 'src', 'core', '74_career.js'), 'utf8');
ok(/const PN = missionProjectNeeds\(P\);/.test(S73) && /if \(N\.project\) \{/.test(S74), '4 the install marks the steps\' missions; careerNeedsOk reads them');
const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
ok(/pj = careerProjectsTick\(d, CAREER_PACK\.projects, now\)/.test(APP) && /function projectLine\(e\)/.test(APP) && use.projects && use.projects.length === 2,
   '5 the page ticks the pack projects at a flight end (the career day), their lines on the arrival card');
console.log('GATE PROJECTS: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
