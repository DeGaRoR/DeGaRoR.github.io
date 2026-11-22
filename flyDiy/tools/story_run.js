#!/usr/bin/env node
// story_run.js - THE TUTORIAL, PLAYED START TO END ON NODE (STORY-REVAMP, 22 Nov 2026; the user 13 Nov: "reasonably tested so
// that when I start playing I have fun and I'm not just fixing bugs"; the brief: "the tutorial playable start to end on
// node"). A new story career walked T0 -> T7 -> the end checkpoint with the events the page sends (79_story.js storyStep,
// its effects applied by storyApply), and EVERY FLIGHT OF IT FLOWN - never a fabricated stop:
//   T1  the starter (Rufus) from the cabin strip to the WWII field      tools/flight_script.js runNode (the game's host:
//   T4  the client's Cub, upgraded, to its owner's strip                 the stand, the taxi, the pilot, the career's day)
//   T7  the Cub on floats, off the seaplane base and back onto it
//   T6  the one job (79_ STORY_JOB) with its load aboard                 tools/mission_feas_lib.js flyMission (the loading
//                                                                        view's proposal, the career's stops)
// The two builds (T3, T7) are the tutor's exact rows: the row list is read on the start file (all open) and on the target
// file (all met) - the files tools/tutorial_cubs.js wrote - and the target's design check is read through the two
// certificates' tiers (64b genCertTiers). The bench's structural tests are the page's (bench.js): not run here, said.
// After the checkpoint the career is OPEN: with the story pack in use its board is the pack's (no drawn job).
//
//   node tools/story_run.js                 the whole tutorial, flown (~40 sim-minutes; about as long on one core)
//   node tools/story_run.js --dry           the walk only: every flight replaced by the stop it must end in (seconds)
//   options: --out=<dir> (default reports/STORY-REVAMP)  --quiet
// AS A MODULE: require('./story_run.js').run({ dry, out, quiet }) -> { ok, beats: [...], flights: [...], end: {...}, why }
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');

function run(opt) {
  const o = opt || {};
  const say = o.quiet ? () => {} : (s => console.log(s));
  const C = require(path.join(T, 'flight_core.js'));
  const FS = require(path.join(T, 'flight_script.js'));
  const OUT = path.resolve(ROOT, o.out || 'reports/STORY-REVAMP');
  fs.mkdirSync(OUT, { recursive: true });
  const R = { what: 'flydiy-story-run', v: 1, dry: !!o.dry, ok: false, why: '', beats: [], flights: [], builds: [], end: null };
  const J = s => JSON.parse(JSON.stringify(s));
  const fail = why => { R.ok = false; R.why = why; say('FAIL ' + why); try { C.missionPackUse(JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'missions', 'builtin.json'), 'utf8'))); } catch (e) {} return R; };
  const rf = f => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); return j.spec || j; };

  // THE ISLAND'S AERODROMES (the flight runner's own world: Jolene as the tour builds it)
  const IN = require(path.join(T, 'island_node.js')), TR = require(path.join(T, '_tour_lib.js'));
  const W = TR.tourWorld(C, IN, fs).W;
  const aeros = W.aerodromes.map(a => ({ id: a.id, name: a.name, kind: a.kind || (a.surface === 'water' || a.water ? 'water' : 'strip'), role: a.role, roles: a.roles }));
  const site = role => C.storySite(role, aeros);
  const places = { cabin: site('cabin'), home: site('home'), client: site('client'), water: site('water') };
  R.places = places;
  for (const k of Object.keys(places)) if (!places[k]) return fail('no aerodrome plays the ' + k + ' on this island');

  // THE STORY'S FILES
  const starter = C.STORY_FILES.starter.find(f => fs.existsSync(path.join(ROOT, f)));
  if (!starter) return fail('no starter file of ' + C.STORY_FILES.starter.join(', '));
  const B3 = C.STORY_BUILDS.T3, B7 = C.STORY_BUILDS.T7;
  R.files = { starter, client: B3.start, upgraded: B3.target, floats: B7.target };

  // THE PACK IN USE, AS ON THE PAGE SINCE THE SWITCH-OVER (app.js CAREER_PACK: a player's career reads the story pack from
  // its first boot - the tutorial is played with it in use, the career adopts it at its birth)
  const SP = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'missions', 'story.json'), 'utf8')), BI = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'missions', 'builtin.json'), 'utf8'));
  const USE = C.missionPackUse(SP);
  if (!USE.ok) return fail('the story pack is refused: ' + USE.why);
  R.pack = { id: USE.id, n: USE.n, held: USE.held.length };
  // THE CAREER, BORN THE PAGE'S WAY
  let d = C.careerNormalise(C.careerNew({ id: 'storyrun', seed: 'storyrun', name: 'story run' }));
  const born = C.storyNewCareer(d, { aeros });
  if (!born.ok) return fail('storyNewCareer: ' + born.why);
  d = born.doc;
  // the page's lift at load (app.js playerLoad -> 71_ playerFleetReconcile): the starter's saved build is an airframe of the fleet
  const lift = x => C.playerFleetReconcile(x, [C.STORY_SLOTS.starter]).doc;
  d = lift(d);
  { const a = C.careerPackAdopt(d, USE); d = a.doc; R.adopted = a.notes; }
  const beat = () => { const s = C.storyOf(d); return s.open ? 'open' : s.beat; };
  R.start = { beat: beat(), day: J(C.careerDay(d)), wallet: d.wallet, here: d.here, cabin: born.cabin };
  say('story run' + (o.dry ? ' (dry)' : '') + ': a new career at ' + places.cabin + ', day ' + R.start.day.date + ', beat ' + R.start.beat);

  // one event into the story, its effects applied in order (the page's storyOnFlightEnd / the card's OK)
  const lines = [];
  const step = (ev, what) => {
    const b0 = beat(), x = C.storyStep(d, ev, { aeros });
    if (!x.ok) return 'beat ' + b0 + ' refused ' + what + ': ' + x.why;
    d = x.doc;
    const fx = [];
    for (const e of x.effects) {
      const opts = { aeros };
      const a = C.storyApply(d, e, opts);
      if (!a.ok) return 'beat ' + b0 + ': effect ' + e.k + ' refused: ' + a.why;
      d = a.doc; fx.push(e.k); if (a.line) lines.push(a.line);
      // the client's Cub as it arrived: bound with its spec (the page's bind)
      if (e.k === 'clientPlane') { const bd = C.storyStep(d, { k: 'bind', role: 'client', slot: C.STORY_SLOTS.client, spec: C.storyClientSpec(rf(B3.start)) }, { aeros }); if (!bd.ok) return 'bind refused: ' + bd.why; d = bd.doc; }
    }
    if (x.advanced.length) { R.beats.push({ beat: b0, by: what, effects: fx, next: beat() }); say('  ' + b0 + ' done by ' + what + (fx.length ? ' -> ' + fx.join(', ') : '') + ' | now ' + beat()); }
    return '';
  };
  // ONE FLIGHT, FLOWN (or, dry, the stop it must end in)
  const flight = (name, file, from, to, slot, gear) => {
    const F = { beat: beat(), name, plane: file, from, to, ok: false, t: 0, steps: [] };
    if (!o.dry) {
      const water = gear === 'floats';
      const S = { name: 'story_' + name, what: 'the tutorial\'s ' + name, plane: file, from, to, day: 'game', persona: 'expert', file: '',
        steps: [{ name: 'board', do: 'board' }, { name: 'start-up', do: 'start', until: { engine: true }, capS: 10 },
                { name: 'taxi to the hold', until: { phase: ['HOLD', 'LINEUP', 'ROLL'] }, capS: water ? 900 : 600 },
                { name: 'take-off', until: { agl: 30 }, capS: 240 },
                { name: 'on the way to the final', until: { phase: 'FINAL' }, capS: 1800 },
                { name: 'land and stop on ' + to, until: { stoppedAt: to }, capS: 1200 }] };
      // the career's own day (74_ careerDay through day_clock.js, as the feasibility rig reads it)
      try { const MF = require(path.join(T, 'mission_feas_lib.js')); S.day = MF.careerDaySpec(d); } catch (e) { S.day = 'game'; }
      const log = path.join(OUT, 'tutorial_' + name + '.jsonl');
      let res;
      try { res = FS.runNode(S, { log, quiet: true }); } catch (e) { F.why = 'the runner: ' + (e && e.message || e); R.flights.push(F); return F; }
      F.t = Math.round(res.t || 0); F.wallS = Math.round((res.wall || 0) / 1000);
      F.steps = (res.steps || []).map(s => ({ name: s.name, ok: !!s.ok, t0: s.t0, t1: s.t1 }));
      if (!res.ok) { const w = res.failed && res.failed.why; F.why = 'step "' + (res.failed && res.failed.name) + '": ' + (w && (w.what || JSON.stringify(w)).toString().slice(0, 300)); R.flights.push(F); return F; }
    }
    F.ok = true;
    F.stop = C.careerStopRecord({ how: 'stopped', aero: to, occupants: 1, cargoKg: 0, gear: gear || 'wheels', row: { from, to, t: F.t || 600 }, hour: 12 });
    R.flights.push(F);
    say('  flight ' + name + ': ' + from + ' > ' + to + (o.dry ? ' (dry)' : ', ' + F.t + ' s flown'));
    return F;
  };
  const need = e => { if (e) { fail(e); return true; } return false; };

  // ---- T0 the cabin ----
  if (need(step({ k: 'ack' }, 'the letter read'))) return R;
  // ---- T1 the move: the starter from the cabin to the field ----
  let f = flight('T1_move', starter, places.cabin, places.home, C.STORY_SLOTS.starter);
  if (!f.ok) return fail('T1\'s flight: ' + f.why);
  if (need(step({ k: 'stop', stop: f.stop, slot: C.STORY_SLOTS.starter }, 'the starter stopped at ' + places.home))) return R;
  // ---- T2 the swap ----
  if (need(step({ k: 'ack' }, 'the swap done'))) return R;
  // ---- T3 the build: the tutor's exact rows, then the certificate ----
  const build = (id, B) => {
    const s0 = C.storyBuildDone(rf(B.start), B.rows), s1 = C.storyBuildDone(rf(B.target), B.rows);
    const def = TR.defOf(C, require(path.join(T, 'pilot_trace.js')), path.join(ROOT, B.target));
    const sh = C.genShakedown(C.buildGen(def.spec), { corners: false });
    const tiers = sh.design && sh.design.rows ? C.genCertTiers(sh.design.rows) : null;
    const row = { beat: id, rows: B.rows.length, openOnStart: s0.filter(x => !x).length, metOnTarget: s1.filter(Boolean).length,
                  design: tiers ? { safe: tiers.safe, comm: tiers.comm, commFail: tiers.commFail.map(r => r.id) } : null, mass: Math.round(sh.mass) };
    R.builds.push(row);
    say('  build ' + id + ': ' + row.rows + ' rows, ' + row.openOnStart + ' open on the start file, ' + row.metOnTarget + ' met on the target; design check ' + JSON.stringify(row.design));
    if (row.openOnStart !== row.rows || row.metOnTarget !== row.rows) return 'build ' + id + ': the rows do not go from all open to all met between its two files';
    if (!row.design || row.design.safe === 'fail') return 'build ' + id + ': the target\'s design check fails the airworthiness tier';
    // THE BENCH'S SIGNATURE on the career's airframe (app.js careerSignNow -> 74_ careerSign): the design check's two
    // verdicts stand in for the bench's state here - its structural tests are the page's (bench.js), not run on node
    const slot = C.storyOf(d).planes.gift || C.storyOf(d).planes.client;
    const sg = C.careerSign(d, slot, { fp: 'story-run:' + id, safe: row.design.safe === 'fail' ? 'fail' : 'pass', comm: row.design.comm, when: 0, why: row.design.commFail.join(', ') });
    if (!sg.ok) return 'build ' + id + ': the signature refused: ' + sg.why;
    d = sg.doc; row.signed = slot; row.cert = C.careerCertOf(d.career.airframes[slot]);
    return '';
  };
  if (need(build('T3', B3))) return R;
  if (need(step({ k: 'certified', slot: C.STORY_SLOTS.client, spec: rf(B3.target), cost: 0 }, 'the upgraded Cub certified'))) return R;
  // ---- T4 the delivery ----
  f = flight('T4_delivery', B3.target, places.home, places.client, C.STORY_SLOTS.client);
  if (!f.ok) return fail('T4\'s flight: ' + f.why);
  if (need(step({ k: 'stop', stop: f.stop, slot: C.STORY_SLOTS.client }, 'the Cub stopped at ' + places.client))) return R;
  // ---- T5 the gift ----
  if (need(step({ k: 'ack' }, 'the gift read'))) return R;
  // ---- T6 the one job, flown with its load ----
  {
    const ids = C.storyJobIds(d), id = ids[0];
    if (ids.length !== 1 || id !== C.STORY_JOB) return fail('T6 offers ' + ids.join(',') + ', not the one job ' + C.STORY_JOB);
    if (C.careerOfferIds(d)[0] !== id) return fail('T6: the one job is not first on the board');
    const rec = C.careerContract(d, id);
    const F6 = { beat: 'T6', name: 'T6_job', plane: B3.target, mission: id, ok: false, t: 0, legs: [] };
    if (!o.dry) {
      const MF = require(path.join(T, 'mission_feas_lib.js'));
      const env = Object.assign(MF.makeEnv(), { spots: MF.spotsPack() });
      const plane = { design: 'cub', file: B3.target, name: 'Client Cub (upgraded)', card: (C.FREIGHT_CARDS.cub && C.FREIGHT_CARDS.cub.hold) ? C.FREIGHT_CARDS.cub : null };
      let A;
      try { A = MF.flyMission(env, rec, plane, {}); MF.finalize({ attempts: [A] }); } catch (e) { return fail('T6\'s flights: ' + (e && e.message || e)); }
      F6.t = Math.round(A.timeS || 0); F6.legs = (A.legs || []).map(L => MF.legLine(L)); F6.verdict = A.verdict;
      if (A.verdict !== 'feasible') { F6.why = A.why; R.flights.push(F6); return fail('T6\'s job, flown: ' + A.verdict + ' - ' + A.why); }
    }
    F6.ok = true; R.flights.push(F6);
    say('  job ' + id + (o.dry ? ' (dry)' : ': flown, ' + F6.t + ' s, ' + F6.legs.length + ' flights'));
    // ...and on this career: accepted, its stops, done (the page's careerStopApply -> the story's jobDone)
    const acc = C.careerAccept(d, id);
    if (!acc.ok) return fail('T6: accept refused: ' + acc.why);
    d = acc.doc;
    const subs = C.contractSubsOf(rec);
    let done = false;
    for (const u of subs) {
      const st = (aero, cargoKg, from) => C.careerStopRecord({ how: 'stopped', aero, occupants: 1, cargoKg, row: { from, to: aero, t: 500 }, hour: 12, slot: C.storyOf(d).planes.gift, cert: { safe: true, comm: true } });
      let s = C.careerOnStop(d, st(u.from, 0, places.home), {}); if (s.ok) d = s.doc;
      s = C.careerOnStop(d, st(u.to, (u.load && u.load.kg) || 0, u.from), {});
      if (!s.ok) return fail('T6: the delivery stop moved nothing: ' + s.why + ' ' + JSON.stringify(s.untouched || {}));
      d = s.doc; done = done || s.events.some(e => e.k === 'done' && e.id === id);
    }
    if (!done) return fail('T6: the job did not complete on its stops');
    if (need(step({ k: 'jobDone', id }, 'the one job delivered'))) return R;
  }
  // ---- T7 the floats: the build, then the water ----
  if (need(build('T7', B7))) return R;
  f = flight('T7_floats', B7.target, places.water, places.water, C.storyOf(d).planes.gift, 'floats');
  if (!f.ok) return fail('T7\'s flight: ' + f.why);
  if (need(step({ k: 'stop', stop: f.stop, slot: C.storyOf(d).planes.gift, gear: 'floats' }, 'the Cub on floats stopped at ' + places.water))) return R;

  // ---- THE END: the checkpoint, the open career ----
  const s = C.storyOf(d), K = C.STORY_CHECKPOINT;
  const end = { open: !!s.open, done: s.done.join(','), day: J(C.careerDay(d)), wallet: d.wallet, seed: d.career.seed,
                fleet: Object.keys(d.fleet || {}), jobDone: d.career.contracts.done.map(x => x.id), tech: d.career.tech ? d.career.tech.seg : null };
  R.end = end;
  if (!end.open || end.done !== C.STORY_BEATS.map(b => b.id).join(',')) return fail('the story did not end open with every beat done: ' + end.done);
  if (end.day.date !== K.day.date || end.day.utc !== K.day.utc || end.wallet !== K.wallet || end.seed !== K.seed) return fail('the end is not the checkpoint: ' + JSON.stringify(end) + ' vs ' + JSON.stringify(K));
  // the same state as "New career, no tutorial" (storySkip): the one state every career starts from
  { const sk = C.storySkip(C.careerNormalise(C.careerNew({ id: 'storyrun', seed: 'storyrun', name: 'story run' })), { aeros });
    if (sk && sk.ok) sk.doc = C.careerPackAdopt(lift(sk.doc), USE).doc;
    const strip = x => { const y = J(x); delete y.clock; delete y.log; return JSON.stringify([y.wallet, y.career.day, y.career.seed, y.career.contracts.done.map(q => q.id), y.career.providers, y.career.tracks, Object.keys(y.fleet || {})]); };
    end.sameAsSkip = !!(sk && sk.ok) && strip(sk.doc) === strip(d);
    if (!end.sameAsSkip) return fail('the played end and the skipped start differ (the wallet, the day, the seed, the done list, the providers, the tracks or the fleet)'); }
  // THE HAND-OVER TO THE MISSION SYSTEM: the story pack in use, the open career's board
  { const board = C.careerOfferIds(d);
    end.board = { n: board.length, drawn: board.filter(id => /^(job|shady):/.test(id)).length, projectsOpen: (USE.projects || []).filter(q => !q.requires.projects.length).length };
    end.kits = d.sheds && d.sheds.HOME ? d.sheds.HOME.kits.slice() : null; end.pack = d.career.pack ? d.career.pack.id : null;
    end.without = ((USE.start && USE.start.sheds && USE.start.sheds.HOME) || {}).without || [];
    C.missionPackUse(BI);
    if (!board.length || end.board.drawn || end.pack !== USE.id) return fail('after the tutorial, the story pack\'s board: ' + JSON.stringify(end.board) + ' pack ' + end.pack); }
  R.ok = true;
  R.totalFlownS = R.flights.reduce((a, x) => a + (x.t || 0), 0);
  say((R.ok ? 'PASS' : 'FAIL') + ' the tutorial ' + (o.dry ? 'walked (dry)' : 'played') + ': ' + R.beats.length + ' beats, ' + R.flights.length + ' flights' + (o.dry ? '' : ', ' + R.totalFlownS + ' s flown') +
      ' | the end: day ' + end.day.date + ', wallet ' + end.wallet + ', board ' + end.board.n + ' missions, ' + end.board.drawn + ' drawn');
  return R;
}

if (require.main === module) {
  const argv = process.argv.slice(2), opt = k => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : undefined; };
  const R = run({ dry: argv.includes('--dry'), out: opt('out'), quiet: argv.includes('--quiet') });
  const out = path.resolve(ROOT, opt('out') || 'reports/STORY-REVAMP');
  if (!R.dry) fs.writeFileSync(path.join(out, 'tutorial_run.json'), JSON.stringify(R, null, 1) + '\n');
  process.exit(R.ok ? 0 : 1);
}
module.exports = { run };
