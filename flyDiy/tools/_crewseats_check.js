#!/usr/bin/env node
// _crewseats_check.js - GATE CREWSEATS (CREW-SEATS G2715-G2719, 2026-11-10, for the GAME COORDINATOR).
//
// FREIGHT-STRAP's open gap (G2400): a job's passenger in a seat the build leaves empty was weighed but drawn only in
// flight, as the build's pilot's posed record moved to that seat, and on the stand not at all; a seat the player took
// out for cargo (FREIGHT-LOAD seatsOut, G2404) still drew its chair in flight. Now the CREW LAYER seats the job
// (_cage_crew.js CAGE_CREW_JOB): the job's passengers in its own passenger pose, LIVE (the join's `people`, never
// baked), the build's occupant the job does not carry and the chairs it took out built OFF the layer (the ghost: the
// tank fit's alone) - so the stand shows them, the snapshot carries them, and the spec stays the build's.
//
// Each case runs the page's own load chain (tools/_load_build.js: the editor's layers, the characters, the tanks, the
// join, the merge) on the user's metal Cessna with the career's door set before the first build (FLYDIY_CREW_JOB_SET),
// and tools/_crewseats_probe.js reads the crew layer and the join's snapshot after it:
//   N  no job (the sandbox, nothing accepted): the door never set
//   P  the A/B's load: two job passengers (seats 1 and 2: the build's co-pilot replaced, the empty seat filled) and the
//      back seat taken out (seat 3)
//   Q  the two passengers alone (no seat out)
//   E  a load seating nobody beside the pilot (crates): the build's co-pilot left ashore (seat 1 empty)
// Asserted:
//   1  THE SANDBOX: no door, no ghost, no job's occupant, no crewJob row in the payload
//   2  THE SPEC IS THE BUILD'S: P, Q and E join to the very bytes N does (the cert key, the masses, the tanks' fit - the
//      energy layer clears the build's crew whatever the job) and the seats' list the join bills is N's
//   3  THE PASSENGERS: P's live occupants at seats 1 and 2 are the job's (the passenger role, dressed, in the scene), the
//      build's co-pilot stands in the ghost; E's seat 1 holds nobody live and its occupant stands in the ghost
//   4  THE CHAIR OUT: P's seat 3 is not on the layer and stands whole in the ghost; N's is on the layer
//   5  THE FLOWN MESH: the snapshot's people carry the job's passengers (job: true) and its crewJob row is the door's;
//      Q's vertex count is N's exactly (passengers are never baked), P's is lower (the chair is out of the flown mesh)
//   6  THE STOP'S DOOR: CAGE_JOIN.livePeople hands the job's passengers alone (app.js fsPeople after a stop)
//   7  THE PAGE (source): the roll-out sets the door NOW before its trip, the snapshot's key and syncApply's carry the
//      job, fsPeople copies no pilot record, the shed's tick sets the door, parked.js stands the crew doors down while
//      a parked aeroplane is held, the tank fit walks the build's crew (crewWalk)
//   --selftest  doctored probe readings (a chair left on the layer, a passenger baked, a spec moved, a job record
//               missing) must each turn the matching row red
//   node tools/_crewseats_check.js [--selftest]
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');

const BUILD = 'bugReports/cessnaMetal (1).json';     // CONTRACT_DESIGNS.c172 / _load_build VALIDATED.metal
const CASES = {
  N: null,
  P: { pax: [{ i: 1, key: null }, { i: 2, key: null }], empty: [], out: [3] },
  Q: { pax: [{ i: 1, key: null }, { i: 2, key: null }], empty: [], out: [] },
  E: { pax: [], empty: [1], out: [] },
};

function runCase(job) {
  process.env.FLYDIY_JOIN_PROBE = path.join(T, '_crewseats_probe.js');
  process.env.FLYDIY_JOIN_NOCACHE = '1';
  if (job) process.env.FLYDIY_CREW_JOB_SET = JSON.stringify(job); else delete process.env.FLYDIY_CREW_JOB_SET;
  const LB = require('./_load_build.js');
  const r = LB.loadBuild(BUILD);
  return { spec: r.spec, probe: r.probe, errors: r.errors };
}

function verdicts(R) {
  const rows = [];
  const row = (id, ok, what, detail) => rows.push({ id, ok: !!ok, what, detail: detail || '' });
  const J = JSON.stringify;
  const N = R.N.probe, P = R.P.probe, Q = R.Q.probe, E = R.E.probe;
  const live = (p, i) => (p.live || []).filter(o => o.idx === i + 1);
  // 1
  row('1', N && !N.err && !N.job && !N.ghost.length && !(N.live || []).some(o => o.job) && N.snap && !N.snap.err && !N.snap.crewJob,
      'the sandbox: no door, no ghost, no job\'s occupant, no crewJob row in the payload', N && N.err ? N.err : (N && N.snap && N.snap.err) || '');
  // 2
  const sN = J(R.N.spec);
  row('2a', J(R.P.spec) === sN && J(R.Q.spec) === sN && J(R.E.spec) === sN,
      'the spec is the build\'s: every job joins to the very bytes of the sandbox (cert key, masses, the tanks\' fit)',
      ['P', 'Q', 'E'].filter(k => J(R[k].spec) !== sN).join(',') || 'P, Q, E = N');
  row('2b', J(P.seatsAt) === J(N.seatsAt) && J(Q.seatsAt) === J(N.seatsAt) && J(E.seatsAt) === J(N.seatsAt),
      'the seats\' list the join bills (seatsAt: filled, kg) is the build\'s under every job');
  // 3
  const p1 = live(P, 1), p2 = live(P, 2);
  row('3a', p1.length === 1 && p2.length === 1 && [p1[0], p2[0]].every(o => o.job && o.role === 'pax' && o.dressed && o.inScene),
      'P: seats 1 and 2 hold the job\'s passengers (live, the passenger role, dressed, on the stand)', J(P.live));
  row('3b', N.names.includes('edCrew2') && P.ghost.includes('edCrew2') && E.ghost.includes('edCrew2') && !E.names.includes('edCrew2') && !live(E, 1).length,
      'the build\'s co-pilot: on the layer in the sandbox; in the ghost (not drawn, not flown) when a job replaces or leaves it', 'ghost P ' + J(P.ghost) + ', E ' + J(E.ghost));
  row('3c', P.jobTagged === 2 && P.jobMeshes > 0 && N.jobTagged === 0,
      'the job\'s two figures are tagged for the tank fit (crewJob), the sandbox\'s none', P.jobTagged + ' / ' + N.jobTagged + ' (' + P.jobMeshes + ' meshes)');
  // 4
  const c3 = P.seatVerts[3] || {}, n3 = N.seatVerts[3] || {};
  row('4', !P.names.includes('edSeat4') && P.ghost.includes('edSeat4') && c3.onLayer === 0 && c3.inGhost > 0 && n3.onLayer === c3.inGhost && n3.inGhost === 0,
      'P: seat 3\'s chair is off the layer and whole in the ghost (the sandbox\'s on the layer, the same vertices)', J({ P: c3, N: n3 }));
  // 5
  const sj = s => (s && s.people ? s.people.filter(r => r.job).map(r => r.idx).sort() : []);
  row('5a', P.snap && !P.snap.err && J(sj(P.snap)) === '[2,3]' && J(sj(Q.snap)) === '[2,3]' && P.snap.crewJob === P.job && Q.snap.crewJob === Q.job,
      'the flown payload carries the job\'s passengers (people, job: true) and the door\'s job (crewJob)', J({ P: sj(P.snap), Q: sj(Q.snap) }));
  // (E: the build's co-pilot holds the dual yoke - live, never baked - so leaving it ashore moves no vertex; a baked one would)
  const cop = live(N, 1).length > 0;
  row('5b', Q.snap && N.snap && Q.snap.nv === N.snap.nv && E.snap && (cop ? E.snap.nv === N.snap.nv : E.snap.nv < N.snap.nv),
      'passengers are never baked: the flown mesh of Q has the sandbox\'s vertex count exactly (and E, its co-pilot live)', J({ N: N.snap && N.snap.nv, Q: Q.snap && Q.snap.nv, E: E.snap && E.snap.nv }));
  row('5c', P.snap && N.snap && P.snap.nv < N.snap.nv,
      'the chair taken out is out of the flown mesh (P\'s vertex count below the sandbox\'s)', J({ N: N.snap && N.snap.nv, P: P.snap && P.snap.nv }));
  // 6
  row('6', Array.isArray(P.lp) && J(P.lp.map(r => r.idx).sort()) === '[2,3]' && P.lp.every(r => r.job && r.figM === 16) && Array.isArray(N.lp) && !N.lp.length,
      'the stop\'s door (CAGE_JOIN.livePeople, the job\'s alone) hands P\'s two passengers and nothing in the sandbox', J({ P: P.lp, N: N.lp }));
  return rows;
}

function sourceRows() {
  const rows = [];
  const row = (id, ok, what) => rows.push({ id, ok: !!ok, what, detail: '' });
  const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const app = rd('src/viewer/app.js'), parked = rd('src/viewer/parked.js'), crew = rd('tools/_cage_crew.js'), energy = rd('tools/_cage_energy.js');
  const ro = app.indexOf('  function rollOut(after, sync) {'), roDoor = app.indexOf('fsCrewSync(true);', ro), roTrip = app.indexOf("tripOpen('rollout')", ro);
  row('7a', ro > 0 && roDoor > ro && roDoor < roTrip, 'the roll-out sets the door NOW, before its trip (the snapshot takes the job\'s crew)');
  row('7b', /id: 'snapshot', part: 'craft', label: 'committing your build', w: 8, key: \(\) => snapKey\(buildKey\(\)\)/.test(app) && /tripKeys\.snapshot = snapKey\(x\.key\)/.test(app),
      'the snapshot\'s key carries the job (and syncApply records it so: no snapshot every roll-out)');
  const fp = app.slice(app.indexOf('  function fsPeople() {'), app.indexOf('  // G3619 (PEOPLE, the user 25 Oct)'));
  row('7c', fp.length > 0 && !/figM/.test(fp) && /livePeople\(/.test(fp), 'fsPeople copies no pilot record (the crew layer\'s own, after a stop)');
  row('7d', /if \(inGarage\) fsCrewSync\(\);/.test(app) && !/fsChairs\(/.test(app), 'the shed\'s tick sets the door; the chairs are no longer hidden after the fact');
  row('7e', /W\.FLYDIY_CREW_PILOT = null; W\.FLYDIY_CREW_JOB = null;/.test(parked) && /unAs\(\); crewBack\(\);/.test(parked) && (parked.match(/crewBack\(\)/g) || []).length >= 2,
      'parked.js: a held parked aeroplane is built with the crew doors down (the build as saved), the player\'s back after');
  row('7f', /function crewWalk\(crew, fn\)/.test(energy) && (energy.match(/crewWalk\(crew, o =>/g) || []).length === 2 && /userData\.crewJob/.test(energy) && /CW\.ghost/.test(energy),
      'the tank fit walks the build\'s crew (the job\'s figures skipped, the ghost read) in its points and its key');
  row('7g', /window\.CAGE_CREW_JOB = \(job, now\) =>/.test(crew) && /\(out \? ghostOf\(\) : group\)\.add\(sg\)/.test(crew) && /markLive\(occ, CH, role, idx, s, jobs, ctx, job\)/.test(crew),
      'the crew layer: the door, the chair built off the layer, the job\'s passenger forced live');
  return rows;
}

function print(rows) {
  let fails = 0;
  for (const r of rows) { if (!r.ok) fails++; console.log('  ' + (r.ok ? 'ok  ' : 'FAIL') + ' ' + r.id + ' ' + r.what + (r.detail ? '  (' + r.detail + ')' : '')); }
  return fails;
}

console.log('GATE CREWSEATS - the job\'s passengers seated by the crew layer, the chairs out of the flown mesh, the spec the build\'s');
const t0 = Date.now();
const R = {};
for (const k of Object.keys(CASES)) {
  try { R[k] = runCase(CASES[k]); }
  catch (e) { R[k] = { spec: null, probe: { err: 'the load door failed: ' + String(e.message).slice(0, 200) } }; }
  const p = R[k].probe || {};
  if (p.err) console.log('  -- ' + k + ': ' + p.err);
  else console.log('  -- ' + k + ' (' + JSON.stringify(CASES[k]) + '): live ' + JSON.stringify((p.live || []).map(o => o.idx + (o.job ? 'j' : ''))) +
                   ', ghost ' + JSON.stringify(p.ghost) + ', flown ' + (p.snap && p.snap.err ? 'ERR ' + p.snap.err : (p.snap ? p.snap.nv + ' vertices' : '?')));
}
const bad = Object.keys(R).filter(k => !R[k].probe || R[k].probe.err);
let rows = bad.length ? [{ id: '0', ok: false, what: 'every case loaded and probed', detail: bad.join(',') }] : verdicts(R);
rows = rows.concat(sourceRows());
let fails = print(rows);
console.log('  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');

if (process.argv.includes('--selftest') && !bad.length) {
  console.log('SELF-TEST - doctored readings must turn their row red');
  const clone = o => JSON.parse(JSON.stringify(o));
  const doctor = (what, rowId, fn) => {
    const D = clone(R); fn(D);
    const r = verdicts(D).find(x => x.id === rowId);
    const caught = r && !r.ok;
    if (!caught) fails++;
    console.log('  ' + (caught ? 'ok  ' : 'FAIL') + ' ' + what + ' -> row ' + rowId + (caught ? ' red' : ' stayed green'));
  };
  doctor('the chair left on the layer', '4', D => { D.P.probe.names.push('edSeat4'); D.P.probe.seatVerts[3].onLayer = D.N.probe.seatVerts[3].onLayer; });
  doctor('a passenger baked into the flown mesh', '5b', D => { D.Q.probe.snap.nv += 1200; });
  doctor('the spec moved by the job (a tank refitted round a passenger)', '2a', D => { D.P.spec = Object.assign({}, D.P.spec, { energy: { doctored: 1 } }); });
  doctor('a job\'s passenger missing from the payload', '5a', D => { D.P.probe.snap.people = D.P.probe.snap.people.filter(r => r.idx !== 3); });
  doctor('the build\'s co-pilot still flown under a crates job', '3b', D => { D.E.probe.names.push('edCrew2'); D.E.probe.live.push({ idx: 2, role: 'cop', job: false, dressed: true, inScene: true }); });
}
console.log('GATE CREWSEATS: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
