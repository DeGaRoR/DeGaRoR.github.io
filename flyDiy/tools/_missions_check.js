#!/usr/bin/env node
// ============================================================================
// GATE MISSIONS — the mission packs (MISSIONS-P0, futureDesigns/MISSIONS-2026-10-25.md):
// src/missions/*.json read into today's contract record (73b_missions.js).
// ============================================================================
// What is held, in blocks:
//   THE PACKS      every src/missions/*.json parses, is a flydiy-missions v1 pack and
//                  validates (the tree, the orders, the places, the people, the steps,
//                  every record through contractValidate with opts.mission); its
//                  normalisation is a fixpoint and survives JSON.
//   LEAN = CORE    the editor's file set (tools/_missions_lib.js LEAN, the very
//                  <script> list of tools/mission_editor.html) evaluates alone and
//                  judges every pack exactly as the full core does.
//   BUILT-IN       (no change to a running career) every authored contract of
//                  72_contract_data.js is retrofitted or dropped, once; each
//                  retrofitted mission's record, its ride-along fields taken off,
//                  IS 72_'s record (key order aside); the same pay (contractPay, and
//                  contractPayTotal bare, with each medal, with each criterion bonus);
//                  runnable today (contractRuntimeOk); the install holds nothing out
//                  and gives back every provider's arc / builds / night lists.
//   THE OFFERS     careers walked contract by contract (two seeds, every arc) under 72_'s
//                  tables and under the pack installed: the same offers at every
//                  state, the same document after every completion.
//   THE TUTORIAL   listed read-only, phase 0, every beat of 79_story.js once and in
//                  order, nothing else on a listing; the T5 jobs (STORY_JOBS) are
//                  retrofitted missions the runtime runs.
//   THE MODEL      a sample pack using every new field validates; each of its rules
//                  broken alone is refused with its reason (a free name, a place of
//                  the wrong kind, a gate too narrow, a timer on no step, a preference
//                  not marked bonus | mandatory, choose:N past its count, an edited
//                  tutorial listing, ...); today's validator still refuses the new
//                  verbs without opts.mission; the install holds a mission the runtime
//                  cannot run, with its reason; the rally's checkpoints and splits
//                  derive from the embedded route (an authored one kept, re-derived
//                  idempotent); the live reward.
//   PURITY         73b_missions.js touches no DOM, storage, THREE, clock or random.
//   node tools/_missions_check.js             -> "GATE MISSIONS: PASS|FAIL"
//   node tools/_missions_check.js --selftest  -> the model doctored one rule at a time (46: the pack, the runtime); each must
//                                               turn a check red
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { loadMissions, LEAN } = require('./_missions_lib.js');
const SELF = process.argv.includes('--selftest');
const PACK_DIR = path.join(ROOT, 'src', 'missions');
const PACKS = fs.existsSync(PACK_DIR) ? fs.readdirSync(PACK_DIR).filter(f => /\.json$/.test(f)).sort() : [];
// the fleet's tie-down spots (a spot place is checked against them)
const SPOTS = (() => { const w = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'fleet_spots_pack.js'), 'utf8'), { window: w }); return w.FLEET_SPOTS_PACK.aero; })();

let fails = [], checks = 0;
const ok = (c, msg) => { checks++; if (!c) fails.push(msg); return !!c; };
const J = o => JSON.stringify(o);
const clone = o => JSON.parse(J(o));

// THE SAMPLE: one pack using every new field (a rally on a drawn route, a speed gate, a ring, a photo over a point, a
// bush mission with named passengers, a site, an aircraft order with preferences) - the model's rows break it one rule
// at a time. The words are the pack's own keys.
function samplePack() {
  const t = s => ({ t: s, draft: true });
  return {
    what: 'flydiy-missions', v: 1, id: 'sample', title: 'ms.sample.title',
    campaigns: [{ id: 'cmp.club', title: 'ms.sample.club', provider: 'clients', order: 'any', chapters: [
      { id: 'ch.speed', title: 'ms.sample.speed', order: 'seq', missions: ['s.gate', 's.rally'] },
      { id: 'ch.bush', title: 'ms.sample.bush', order: 'choose:1', missions: ['s.bush', 's.order'] }] }],
    missions: [
      { id: 's.gate', provider: 'clients', kind: 'challenge', title: 'ms.s.gate.title', brief: 'ms.s.gate.brief', client: 'adam',
        legs: [{ order: 'seq', steps: [
          { id: 'g1', do: 'pass', place: { gate: [[-500, -3000], [-400, -3000]], alt: { max: 150, ref: 'agl' }, prop: 'balloons' } },
          { id: 'g2', do: 'pass', place: { gate: [[-500, -6000], [-400, -6000]], alt: { max: 150, ref: 'agl' }, prop: 'pylons', dir: 0 } },
          { id: 'r1', do: 'pass', place: { ring: [-450, 120, -7000], r: 10, dir: 0 } },
          { do: 'land', place: 'HOME', say: { who: 'adam', text: 'ms.s.gate.say' } }] }],
        timers: [{ id: 'speed', start: 'g1', stop: 'g2', target: 90, medals: [{ medal: 'gold', le: 80 }, { medal: 'silver', le: 95 }] }],
        rules: { crash: 'fail', injury: { fail: 'Light injuries' }, freight: 'fail', damage: 'assess' },
        pay: { base: 2000, bonus: [{ crit: 'medal', by: 'gold', pct: 100 }] }, rep: { provider: 'clients', gain: 0.5 } },
      { id: 's.rally', provider: 'clients', kind: 'challenge', title: 'ms.s.rally.title', brief: 'ms.s.rally.brief',
        legs: [{ steps: [{ id: 'f1', do: 'fly', from: 'HOME', place: { pt: [2000, -8000], r: 200 } }] }],
        route: { v: 1, id: 'rt1', name: 'Rally', end: 'home', margin: 60, pts: [{ x: 0, z: -2000, alt: 400, ref: 'msl', V: null },
          { x: 3000, z: -6000, alt: 500, ref: 'msl', V: null }, { x: 6000, z: -6000, alt: 300, ref: 'agl', V: null }] },
        rally: { refKmh: 180, r: 250 }, needs: { after: ['s.gate'] },
        pay: { base: 3000 }, rep: { provider: 'clients', gain: 0.5 } },
      { id: 's.bush', provider: 'clients', kind: 'contract', title: 'ms.s.bush.title', brief: 'ms.s.bush.brief', client: 'adam',
        legs: [{ steps: [{ id: 'b1', do: 'carry', from: 'HOME', place: 'w3', load: { kg: 20, pax: ['david', 'jody'] },
                           require: { when: { before: 'dusk' }, maxMin: 90, depart: { after: 8 } }, disembark: ['david'] },
                         { id: 'ph1', do: 'photo', place: { pt: [-1200, -2600], r: 200, alt: { min: 100, max: 400, ref: 'agl' } } }] },
               { steps: [{ do: 'carry', from: 'w3', place: { site: 'mast' }, load: { kg: 60, pax: 0 }, onDone: { site: { id: 'mast', state: 'building' } } },
                         { do: 'park', place: { spot: 'HOME:' + SPOTS.HOME[0][3] } },
                         { do: 'talk', say: { who: 'adam', text: 'ms.s.bush.say' } }] }],
        onDone: { say: { who: 'adam', text: 'ms.s.bush.done' } },
        pay: { base: 2500 }, rep: { provider: 'clients', gain: 0.5 } },
      { id: 's.order', provider: 'clients', kind: 'build', title: 'ms.s.order.title', brief: 'ms.s.order.brief', client: 'adam',
        legs: [{ steps: [{ do: 'deliver', place: 'HOME', require: { plane: [{ k: 'seats', op: '>=', v: 2 }, { k: 'climbMs', op: '>=', v: 3, at: { pax: 1 } },
          { k: 'toDistM', op: '<=', v: 250, at: { pax: 1, kg: 0 } }, { k: 'pax', op: '>=', v: 1 },
          { k: 'spanM', op: '<=', v: 10 }, { k: 'heightM', op: '<=', v: 2.6 }, { k: 'lengthM', op: '<=', v: 7.5 },
          { k: 'fitsShed', op: '==', v: 'field', at: { dims: { HW: 6, HD: 8, EAVE: 3.2 } } }] } }] }],
        prefs: [{ k: 'engines', v: 2, need: 'mandatory' }, { k: 'gear', v: 'tricycle', need: 'bonus', pct: 10 }],
        startFrom: 'cub', delivery: { sold: true, blueprint: true },
        pay: { base: 40000 }, rep: { provider: 'clients', gain: 1 }, followUp: { prefer: ['seats'] } },
    ],
    sites: [{ id: 'mast', asset: 'weather mast', at: { x: -900, z: -2500, hdg: 0 }, state: 'planned', track: 'survey:3' }],
    text: { 'ms.sample.title': t('A sample'), 'ms.sample.club': t('The club'), 'ms.sample.speed': t('Speed'), 'ms.sample.bush': t('The bush'),
            'ms.s.gate.title': t('Two gates'), 'ms.s.gate.brief': t('Between the balloons, low.'), 'ms.s.gate.say': t('Not bad.'),
            'ms.s.rally.title': t('The rally'), 'ms.s.rally.brief': t('Coordinates and times only.'),
            'ms.s.bush.title': t('Up the lake'), 'ms.s.bush.brief': t('Two up, one off at the strip.'), 'ms.s.bush.say': t('Thanks.'), 'ms.s.bush.done': t('Done.'),
            'ms.s.order.title': t('Two engines'), 'ms.s.order.brief': t('I want a twin engine pusher.'), 'ct.s.order.follow': t('Again.') },
  };
}

function run(mut) {
  fails = []; checks = 0;
  const M = loadMissions({ core: true, mut });
  const L = loadMissions({ mut });
  const opts = { spots: SPOTS };

  // ==== THE PACKS ===============================================================
  ok(PACKS.includes('builtin.json'), 'src/missions/builtin.json exists');
  const packs = {};
  for (const f of PACKS) {
    let p = null;
    try { p = JSON.parse(fs.readFileSync(path.join(PACK_DIR, f), 'utf8')); } catch (e) { ok(false, f + ': parses (' + e.message + ')'); continue; }
    packs[f] = p;
    ok(p.what === M.MISSION_PACK_WHAT && p.v === M.MISSION_PACK_V, f + ': a flydiy-missions v1 pack');
    const why = M.missionPackValidate(p, opts);
    ok(!why.length, f + ': validates' + (why.length ? ' - ' + why.slice(0, 6).join('; ') : ''));
    const n = M.missionPackNormalise(p);
    ok(M.missionCanon(M.missionPackNormalise(n)) === M.missionCanon(n), f + ': the normaliser is a fixpoint');
    ok(M.missionCanon(M.missionPackNormalise(JSON.parse(J(n)))) === M.missionCanon(n), f + ': the normalised pack survives JSON');
    // LEAN = CORE: the editor's files judge it the same
    ok(J(L.missionPackValidate(p, opts)) === J(why), f + ': the editor\'s core (LEAN) judges it as the full core');
    ok(M.missionCanon(L.missionPackContracts(p)) === M.missionCanon(M.missionPackContracts(p)) || hasItems(p), f + ': LEAN reads the same records');
  }
  function hasItems(p) { return p.missions.some(m => (m.legs || []).some(l => (l.steps || []).some(s => s.load && s.load.items))); }

  // the demo pack (tools/_missions_demo.js: one mission per runtime piece, for the local session): installs whole, runs
  const DP = packs['demo_p1.json'];
  if (ok(!!DP, 'src/missions/demo_p1.json exists')) {
    const DI = M.missionPackInstall(DP);
    ok(!DI.held.length && DP.missions.every(m => M.contractRuntimeOk(M.missionToContract(m, { pack: DP })) === ''), 'demo_p1.json: installs whole, every mission runs today (' + J(DI.held) + ')');
  }

  // ==== THE BUILT-IN PACK = TODAY'S CONTRACTS ======================================
  const B = packs['builtin.json'];
  if (B) {
    const A = M.contractAuthored(), ids = Object.keys(A), R = M.missionPackContracts(B);
    const retro = (B.legacy && B.legacy.retrofitted) || [], dropped = ((B.legacy && B.legacy.dropped) || []).map(d => d.id);
    for (const id of ids) ok(retro.includes(id) !== dropped.includes(id), id + ': retrofitted or dropped, exactly once');
    ok(retro.length + dropped.length === ids.length, 'the built-in pack accounts for all ' + ids.length + ' authored contracts');
    for (const id of retro) {
      const r = R[id], a = A[id];
      if (!ok(!!r && !!a, id + ': a mission and a contract')) continue;
      ok(M.missionCanon(M.missionStrip(r)) === M.missionCanon(a), id + ': its record is 72_\'s (ride-alongs off)');
      ok(J(M.contractPay(r)) === J(M.contractPay(a)), id + ': the same contractPay');
      const got = {};
      for (const c of M.contractCrit(a)) if (typeof c.v === 'number') got[c.k] = c.op === '>=' ? c.v * 2 : c.v / 2;
      for (const md of [null, 'gold', 'silver', 'bronze']) {
        ok(M.contractPayTotal(r, {}, md) === M.contractPayTotal(a, {}, md), id + ': the same paid total (medal ' + md + ')');
        ok(M.contractPayTotal(r, got, md) === M.contractPayTotal(a, got, md), id + ': the same paid total with every criterion beaten (medal ' + md + ')');
      }
      ok(M.contractRuntimeOk(r) === '', id + ': runnable today (' + M.contractRuntimeOk(r) + ')');
      ok(M.contractCertifiable(r) === M.contractCertifiable(a) && M.contractFlyable(r) === M.contractFlyable(a), id + ': held out as today (certificate, flyable)');
      const m = B.missions.find(x => x.id === id);
      ok(m && m.client === M.peopleClientOf(a.provider), id + ': its owner is the provider\'s client');
      ok(!m.onDone || (m.onDone.say.who === m.client && M.contractTextOk(m.onDone.say.text)), id + ': the done line is the client\'s, a key');
    }
    const I = M.missionPackInstall(B);
    ok(I.held.length === 0, 'the install holds nothing of the built-in pack out (' + J(I.held) + ')');
    for (const p of Object.keys(M.CONTRACT_PROVIDERS)) for (const k of ['arc', 'builds', 'night']) {
      const want = (M.CONTRACT_PROVIDERS[p][k] || []).filter(r => !dropped.includes(r.id)).map(r => M.missionCanon(M.contractNormalise(r)));
      ok(J(I.providers[p][k].map(r => M.missionCanon(M.missionStrip(r)))) === J(want), p + '.' + k + ': installed = 72_\'s list');
      ok(I.providers[p].jobs === M.CONTRACT_PROVIDERS[p].jobs && I.providers[p].goods === M.CONTRACT_PROVIDERS[p].goods, p + ': the install keeps the job table');
    }
    // ==== THE OFFERS: careers walked under both tables ===========================================
    const N = loadMissions({ core: true, mut });
    const NI = N.missionPackInstall(B);
    for (const p of Object.keys(N.CONTRACT_PROVIDERS)) for (const k of ['arc', 'builds', 'night']) N.CONTRACT_PROVIDERS[p][k] = NI.providers[p][k];
    ok(M.missionCanon(Object.values(N.contractAuthored()).map(N.missionStrip)) === M.missionCanon(Object.values(M.contractAuthored())), 'installed: contractAuthored is 72_\'s');
    let states = 0, same = 0, docsSame = 0, steps = 0;
    for (const seed of ['jolene', 'walk-2']) {
      let d = M.careerNew({ seed });
      for (let i = 0; i < 48; i++) {
        const o1 = M.careerOfferIds(d), o2 = N.careerOfferIds(JSON.parse(J(d)));
        states++; if (J(o1) === J(o2)) same++;
        else if (fails.length < 40) fails.push(seed + ' state ' + i + ': offers differ ' + J(o1).slice(0, 200) + ' vs ' + J(o2).slice(0, 200));
        // the next completion: authored first (the arcs move), a job now and then, deterministic
        const auth = o1.filter(id => !/^(job|loan):/.test(id)), jobs = o1.filter(id => /^job:/.test(id));
        const pick = (i % 4 === 3 && jobs.length) ? jobs[i % jobs.length] : (auth.length ? auth[i % auth.length] : jobs[0]);
        if (!pick) break;
        const run1 = M.careerAccept(d, pick), run2 = N.careerAccept(JSON.parse(J(d)), pick);
        if (!run1.ok) break;
        const fin = (X, doc) => { const c = clone(doc), rec = X.careerContract(c, pick), live = c.career.contracts.live[pick], ev = [];
          if (!rec || !live) return { broken: pick };
          X.careerComplete(c, rec, live, rec.stages.some(st => st.subs.some(s => s.medals)) ? 'silver' : null, ev); return c; };
        const d1 = fin(M, run1.doc), d2 = fin(N, run2.doc);
        steps++; if (M.missionCanon(d1) === M.missionCanon(d2)) docsSame++;
        if (d1.broken) break;
        d = d1;
      }
    }
    ok(states > 90 && same === states, 'the same offers at every walked state (' + same + ' / ' + states + ')');
    ok(steps > 90 && docsSame === steps, 'the same document after every completion (' + docsSame + ' / ' + steps + ')');

    // ==== THE TUTORIAL ============================================================================
    const T = B.campaigns.find(c => c.tutorial);
    ok(T && T.readonly === true && T.phase === 0, 'the tutorial campaign: read-only, phase 0');
    const listed = T ? [].concat(...T.chapters.map(h => h.missions)) : [];
    ok(J(listed) === J(M.STORY_BEATS.map(b => 'story.' + b.id)), 'the tutorial lists every beat once, in order');
    ok(J(M.missionTutorial().map(t => t.beat)) === J(M.STORY_BEATS.map(b => b.id)) && M.missionTutorial().every(t => t.readonly && t.phase === 0), 'missionTutorial: the beats as they are, read-only');
    for (const id of M.STORY_JOBS) ok(retro.includes(id) && R[id] && M.contractRuntimeOk(R[id]) === '', 'T5 job ' + id + ': a retrofitted mission the runtime runs');
  }

  // ==== THE MODEL ===================================================================
  const S = samplePack();
  const sw = M.missionPackValidate(S, opts);
  ok(!sw.length, 'the sample pack (every new field) validates' + (sw.length ? ' - ' + sw.slice(0, 8).join('; ') : ''));
  ok(J(L.missionPackValidate(S, opts)) === J(sw), 'LEAN judges the sample as the full core');
  const broken = [
    ['a free name speaks', p => { p.missions[0].legs[0].steps[3].say.who = 'Adam Smith'; }, /person id/],
    ['a free name is the client', p => { p.missions[2].client = 'Mrs Brown'; }, /person id/],
    ['a passenger is a free name', p => { p.missions[2].legs[0].steps[0].load.pax = ['david', 'Bob']; }, /person id/],
    ['a gate is one post', p => { p.missions[0].legs[0].steps[0].place.gate = [[-500, -3000]]; }, /two posts/],
    ['a gate is 1 m wide', p => { p.missions[0].legs[0].steps[0].place.gate = [[-500, -3000], [-499.5, -3000]]; }, /wide/],
    ['a land on a point', p => { p.missions[0].legs[0].steps[3].place = { pt: [0, 0] }; }, /land takes field/],
    ['a park on a field', p => { p.missions[2].legs[1].steps[1].place = 'HOME'; }, /park takes spot/],
    ['a spot that is not there', p => { p.missions[2].legs[1].steps[1].place = { spot: 'HOME:nowhere' }; }, /no spot/],
    ['a site the pack lacks', p => { p.missions[2].legs[1].steps[0].place = { site: 'nope' }; }, /no site/],
    ['an altitude band upside down', p => { p.missions[2].legs[0].steps[1].place.alt = { min: 400, max: 100 }; }, /below/],
    ['a timer on no step', p => { p.missions[0].timers[0].stop = 'zz'; }, /names no step/],
    ['a timer with no target', p => { delete p.missions[0].timers[0].target; }, /target/],
    ['a preference neither bonus nor mandatory', p => { delete p.missions[3].prefs[0].need; }, /bonus \| mandatory/],
    ['a bonus preference with no pct', p => { delete p.missions[3].prefs[1].pct; }, /pct/],
    ['a preference value the GEN does not know', p => { p.missions[3].prefs[1].v = 'quadricycle'; }, /not one of/],
    ['a new criterion out of its band', p => { p.missions[3].legs[0].steps[0].require.plane[1].v = 90; }, /outside/],
    ['a plane 30 m high', p => { p.missions[3].legs[0].steps[0].require.plane.find(c => c.k === 'heightM').v = 30; }, /heightM: 30 outside/],
    ['a length asked as more', p => { p.missions[3].legs[0].steps[0].require.plane.find(c => c.k === 'lengthM').op = '>='; }, /lengthM: operator/],
    ['a shed nobody builds', p => { p.missions[3].legs[0].steps[0].require.plane.find(c => c.k === 'fitsShed').v = 'barn'; }, /no shed shell barn/],
    ['a shed of negative width', p => { p.missions[3].legs[0].steps[0].require.plane.find(c => c.k === 'fitsShed').at.dims.HW = -2; }, /at\.dims/],
    ['a shed judged at a load', p => { p.missions[3].legs[0].steps[0].require.plane.find(c => c.k === 'fitsShed').at.pax = 1; }, /at\.pax. not a condition/],
    ['an unknown rule', p => { p.missions[0].rules.weather = 'fail'; }, /rules\.weather/],
    ['an injury band past fatal', p => { p.missions[0].rules.injury = { fail: 7 }; }, /band/],
    ['a departure window of one hour twice', p => { p.missions[2].legs[0].steps[0].require.depart = { at: [8, 8] }; }, /depart/],
    ['a max duration of a week', p => { p.missions[2].legs[0].steps[0].require.maxMin = 10080; }, /maxMin/],
    ['choose:3 of two', p => { p.campaigns[0].chapters[1].order = 'choose:3'; }, /choose:3 of 2/],
    ['an order word nobody knows', p => { p.campaigns[0].chapters[0].order = 'random'; }, /not seq \| any/],
    ['a mission in two chapters', p => { p.campaigns[0].chapters[1].missions.push('s.gate'); }, /already in chapter/],
    ['a chapter names a missing mission', p => { p.campaigns[0].chapters[0].missions.push('s.none'); }, /no mission s\.none/],
    ['needs name nobody', p => { p.missions[1].needs.after = ['s.none']; }, /does not exist/],
    ['a talk with nothing said', p => { delete p.missions[2].legs[1].steps[2].say; }, /talk needs a say/],
    ['a say whose words are not a key', p => { p.missions[2].onDone.say.text = 'Done!'; }, /does not resolve/],
    ['a rally with no route', p => { delete p.missions[1].route; }, /embedded route/],
    ['a startFrom nobody knows', p => { p.missions[3].startFrom = 'zeppelin'; }, /startFrom/],
    ['a delivery on a transport job', p => { p.missions[2].delivery = { sold: true }; }, /delivery on a contract/],
    ['a step id twice', p => { p.missions[0].legs[0].steps[1].id = 'g1'; }, /twice/],
    ['a photo over a field with no departure', p => { p.missions[2].legs[0].steps[1].place = 'w3'; }, /departs from a field/],
    ['an unknown verb', p => { p.missions[2].legs[0].steps[1].do = 'loop'; }, /not one of carry/],
    ['a voice aboard', p => { p.missions[2].legs[0].steps[0].load.pax = ['tim']; }, /voice/],
    ['a person the table does not hold', p => { p.missions[2].client = 'zorro'; }, /not in the people table/],
    ['the pack is v2', p => { p.v = 2; }, /v must be 1/],
    ['a timer from one leg to another', p => { p.missions[0].legs.push({ steps: [{ id: 'g9', do: 'pass', place: { gate: [[0, -9000], [100, -9000]] } }] }); p.missions[0].timers[0].stop = 'g9'; }, /in one leg, the start first/],
    ['a timer stopping before it starts', p => { p.missions[0].timers[0].start = 'g2'; p.missions[0].timers[0].stop = 'g1'; }, /the start first/],
  ];
  for (const [label, f, re, skip] of broken) {
    if (skip) continue;
    const p = clone(S); f(p);
    const w = M.missionPackValidate(p, opts);
    ok(w.some(x => re.test(x)), 'refused: ' + label + ' (' + (w.join('; ').slice(0, 160) || 'accepted') + ')');
  }
  // the tutorial is read-only, exactly as it is
  if (B) {
    const tb = clone(B), tm = tb.missions.find(m => m.tutorial);
    tm.title = 'ms.x'; ok(M.missionPackValidate(tb, opts).some(x => /read-only/.test(x)), 'refused: an edited tutorial listing');
    const tb2 = clone(B), T2 = tb2.campaigns.find(c => c.tutorial); T2.chapters[0].missions.reverse();
    ok(M.missionPackValidate(tb2, opts).some(x => /the story is/.test(x)), 'refused: the tutorial out of the story\'s order');
    const tb3 = clone(B); tb3.legacy.dropped.push({ id: 'field.01', why: 'x' });
    ok(M.missionPackValidate(tb3, opts).some(x => /dropped and still a mission/.test(x)), 'refused: a drop that is still a mission');
  }
  // today's validator, without opts.mission, still refuses the new verbs and criteria
  const rec = M.missionToContract(S.missions[2], { pack: S });
  ok(M.contractValidate(rec, { text: M.missionText(S) }).some(x => /do photo is not one of/.test(x)), 'contractValidate without opts.mission refuses a new verb');
  const ord = M.missionToContract(S.missions[3], { pack: S });
  ok(M.contractValidate(ord, { text: M.missionText(S) }).some(x => /unknown criterion kind climbMs/.test(x)), 'contractValidate without opts.mission refuses a new criterion');
  ok(M.contractValidate(ord, { text: M.missionText(S), mission: true }).length === 0, 'the order with preferences may say "two engines" (g1 -> prefs)');
  ok(M.contractValidate(M.contractNormalise(Object.assign(clone(ord), { prefs: undefined })), { text: M.missionText(S), mission: true }).some(x => /names a configuration/.test(x)), 'without preferences, g1 still refuses "two engines"');
  // the install: what the runtime runs reaches the career (P1/P2), what it cannot is held with the reason
  const SI = M.missionPackInstall(S);
  ok(J(SI.held.map(h => h.id)) === J(['s.bush']) && /site no strip serves/.test(SI.held[0].why), 'the install holds the bush mission out (its mast has no strip to serve it), with the reason (' + J(SI.held).slice(0, 200) + ')');
  const so = SI.providers.clients.builds.find(r => r.id === 's.order');
  ok(so && J(so.closed) === J({ ids: ['s.bush', 's.order'], n: 1 }), '(P3) the choose:1 chapter installs: the order closes once one of the two is done');
  ok(J(SI.providers.clients.arc.map(r => r.id)) === J(['s.gate', 's.rally']), 'the speed chapter (seq) is the clients\' arc: the gate run, then the rally');
  const RW = { 's.gate': '', 's.rally': '', 's.order': '' };   // s.bush waits: its site has no strip
  for (const m of S.missions) { const w = M.contractRuntimeOk(M.missionToContract(m, { pack: S })); ok(m.id in RW ? w === RW[m.id] : w !== '', m.id + ': contractRuntimeOk ' + (m.id in RW ? 'runs it' : 'says why it waits') + ' (' + w + ')'); }
  // what runs now, alone; what still waits, alone (each with its reason)
  const one = (step, extra) => M.contractRuntimeOk(M.missionToContract(Object.assign({ id: 'x', provider: 'clients', kind: 'contract', title: 't', brief: 'b',
    legs: [{ steps: [step] }], pay: { base: 1 }, rep: { provider: 'clients', gain: 0 } }, extra || {}), {}));
  const runs = [
    ['a plain landing', { do: 'land', place: 'HOME' }],
    ['a talk at a field', { do: 'talk', place: 'HOME', say: { who: 'adam', text: 'ct.field.01.done' } }],
    ['a fly to a point', { id: 'p', do: 'fly', from: 'HOME', place: { pt: [0, -2000], r: 150 } }],
    ['a pass through a gate', { id: 'g', do: 'pass', place: { gate: [[0, -2000], [100, -2000]] } }],
    ['a pass through a ring', { id: 'r', do: 'pass', place: { ring: [0, 200, -2000], r: 8, dir: 0 } }],
    ['a photo over a point', { id: 'ph', do: 'photo', place: { pt: [0, -2000], r: 150 } }],
    ['a park on a spot', { do: 'park', place: { spot: 'HOME:' + SPOTS.HOME[0][3] } }],
    ['a wait at a field', { do: 'wait', place: 'HOME', require: { waitMin: 30 } }],
    ['a rule', { do: 'land', place: 'HOME' }, { rules: { crash: 'fail' } }],
    ['(P3) a disembark', { do: 'land', place: 'HOME', disembark: ['david'] }],
    ['(P3) a max duration', { do: 'carry', from: 'HOME', place: 'w3', load: { kg: 5, pax: 0 }, require: { maxMin: 60 } }],
    ['(P3) a departure window', { do: 'carry', from: 'HOME', place: 'w3', load: { kg: 5, pax: 0 }, require: { depart: { after: 8 } } }],
    ['(P3) an onDone that pays', { do: 'land', place: 'HOME', onDone: { pay: 100 } }],
  ];
  for (const [label, st, ex] of runs) ok(one(st, ex) === '', 'runtime: ' + label + ' runs (' + one(st, ex) + ')');
  for (const k of ['climbMs', 'stallKmh', 'toDistM', 'fuelLph', 'pax', 'heightM', 'lengthM', 'fitsShed', 'spanM'])
    ok(one({ do: 'deliver', place: 'HOME', require: { plane: [{ k, op: M.CONTRACT_CRIT_NEXT[k] ? M.CONTRACT_CRIT_NEXT[k].op[0] : '<=', v: k === 'fitsShed' ? 'club' : 3 }] } }, { kind: 'build' }) === '', 'runtime: criterion ' + k + ' runs (ACCEPT answers it)');
  const waits = [
    ['ldgDistM (no landing distance measured)', { do: 'deliver', place: 'HOME', require: { plane: [{ k: 'ldgDistM', op: '<=', v: 300 }] } }, { kind: 'build' }, /ldgDistM/],
    ['cargoL (no hold volume measured)', { do: 'deliver', place: 'HOME', require: { plane: [{ k: 'cargoL', op: '>=', v: 100 }] } }, { kind: 'build' }, /cargoL/],
    ['a carry to a site', { do: 'carry', from: 'HOME', place: { site: 'x' }, load: { kg: 5, pax: 0 } }, null, /site/],
    ['legs in any order', { do: 'land', place: 'HOME' }, { order: 'any' }, /legs in order any/],
    ['an onDone that unlocks', { do: 'land', place: 'HOME', onDone: { unlock: 'x' } }, null, /onDone\.unlock/],
  ];
  for (const [label, st, ex, re] of waits) ok(re.test(one(st, ex)), 'runtime: ' + label + ' still waits (' + one(st, ex) + ')');
  ok(/do loop/.test(one({ do: 'loop', place: 'HOME' })), 'runtime: a verb nobody knows never runs (' + one({ do: 'loop', place: 'HOME' }) + ')');
  // the install holds a mission that waits even in a chapter it would run (an any chapter, a seq chapter)
  const HP = clone(S); HP.campaigns[0].chapters[1].order = 'any';
  HP.missions[3].legs[0].steps[0].require.plane.push({ k: 'ldgDistM', op: '<=', v: 300 });
  const HI = M.missionPackInstall(HP);
  ok(HI.held.some(h => h.id === 's.order' && /ldgDistM/.test(h.why)) && !HI.providers.clients.builds.some(r => r.id === 's.order') && !HI.held.some(h => h.id === 's.bush' && /choose/.test(h.why)),
     'the install holds an order naming ldgDistM out of an any chapter, with its reason (' + J(HI.held).slice(0, 160) + ')');
  ok(M.contractRuntimeOk(M.missionToContract({ id: 'x', provider: 'clients', kind: 'contract', title: 't', brief: 'b', legs: [{ order: 'choose:1', steps: [{ do: 'land', place: 'HOME' }] }],
    pay: { base: 1 }, rep: { provider: 'clients', gain: 0 } }, {})) === '', 'runtime: (P3) steps choose:N run');
  ok(M.contractRuntimeOk(M.missionToContract({ id: 'x', provider: 'clients', kind: 'contract', title: 't', brief: 'b', legs: [{ order: 'seq', steps: [{ do: 'land', place: 'HOME' }] }],
    pay: { base: 1 }, rep: { provider: 'clients', gain: 0 } }, {})) === '', 'runtime: steps in order seq run');
  // the size in words (the card): the shed by its name, the client's own dims
  const TX = M.missionText(S), shedC = S.missions[3].legs[0].steps[0].require.plane.find(c => c.k === 'fitsShed');
  const sw2 = M.contractCritWords(shedC, null, TX);
  ok(sw2.includes(M.SHELLS.field.name) && sw2.includes('12 x 16 m, eave 3.2 m'), 'the shed in words: ' + sw2);
  ok(M.contractCritWords({ k: 'heightM', op: '<=', v: 2.6 }, null, TX) === 'at most 2.6 m high' && M.contractCritWords({ k: 'lengthM', op: '<=', v: 7.5 }, null, TX) === 'at most 7.5 m long', 'the height and the length in words');
  // the pay reads places: a carry to a site is paid its km, never NaN
  for (const m of S.missions) { const P = M.contractPay(M.missionToContract(m, { pack: S })); ok(Number.isFinite(P.total) && Number.isFinite(P.km), m.id + ': contractPay finite (' + P.total + ', ' + P.km + ' km)'); }
  const bush = M.contractPay(M.missionToContract(S.missions[2], { pack: S }));
  const kmWant = (Math.hypot(-811 - -301, -2397 - 221) + Math.hypot(-900 - -811, -2500 - -2397)) / 1000;
  ok(Math.abs(bush.km - kmWant) < 0.02, 'a carry to a site is paid the field-to-site km (' + bush.km + ' vs ' + kmWant.toFixed(2) + ')');
  // the reward line
  const rw = M.missionReward(S.missions[0], { pack: S });
  // (PRICE-CAL: an authored base x the story factor x the pay scale, rounded to the pay's unit - 73_ contractPay)
  const B0 = X => Math.round(2000 * X.CONTRACT_PAY.story * X.econPayScale() / 10) * 10;
  ok(rw.paid === B0(M) && rw.best === rw.paid * 2 && rw.why === '', 'missionReward: paid, best with gold, runs today (' + J(rw) + ')');
  ok(M.missionReward(S.missions[3], { pack: S }).prefs === 10, 'missionReward: the bonus preferences\' pct');
  // THE RALLY: one checkpoint per route point, splits along the route at the reference speed, the timer
  const rally = M.missionRallyDerive(S.missions[1]);
  const leg = rally.legs.find(l => l.rally), pts = S.missions[1].route.pts, v = 180 / 3.6;
  ok(leg && leg.steps.length === pts.length && leg.order === 'seq' && leg.steps.every(s => s.do === 'pass' && s.auto === true && s.place.r === 250), 'rally: a pass per route point, seq, the radius');
  let d = 0, splitsOk = true;
  pts.forEach((p, i) => { if (i) d += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); if (leg.steps[i].split !== Math.round(d / v)) splitsOk = false; });
  ok(splitsOk, 'rally: the splits are the route\'s length at the reference speed');
  const tm = rally.timers.find(t => t.id === 'rally');
  ok(tm && tm.start === 'cp1' && tm.stop === 'cp3' && tm.target === leg.steps[2].split && tm.splits, 'rally: the timer runs cp1 -> cp3 to the last split');
  ok(M.missionCanon(M.missionRallyDerive(rally)) === M.missionCanon(rally), 'rally: re-derived, the same (idempotent)');
  const own = clone(rally); own.legs.find(l => l.rally).steps[1] = { id: 'cp2', do: 'pass', place: { pt: [3100, -6100], r: 100 }, split: 77 };
  const re = M.missionRallyDerive(own), cp2 = re.legs.find(l => l.rally).steps[1];
  ok(cp2.split === 77 && cp2.place.r === 100 && !cp2.auto, 'rally: an authored checkpoint is kept on re-derive');
  const keep = clone(rally); keep.legs.find(l => l.rally).steps[2].split = 500; keep.legs.find(l => l.rally).steps[2].auto = 'place';
  ok(M.missionRallyDerive(keep).legs.find(l => l.rally).steps[2].split === 500, 'rally: an authored split on a derived checkpoint is kept');
  const rp = clone(S); rp.missions[1] = rally;
  const rw2 = M.missionPackValidate(rp, opts);
  ok(!rw2.length, 'rally: the derived mission validates (' + rw2.join('; ').slice(0, 200) + ')');
  // the conversion both ways: every built-in mission back from its record, the same mission
  if (B) for (const m of B.missions.filter(x => !x.tutorial)) {
    const rec = M.missionToContract(m, { pack: B }), back = M.missionFromContract(rec);
    ok(M.missionCanon(M.missionToContract(back, { pack: B })) === M.missionCanon(rec), m.id + ': mission -> record -> mission -> record, the same');
  }

  // ==== THE RUNTIME (MISSIONS-P1/P2: 73c_mission_run.js and its seams in 72_accept / 73_ / 74_ / 75_) ====================
  // a block that throws is a failed row with its reason (a doctored model may leave a mission out: never a crash)
  for (const [name, f] of [['the runtime (P1/P2)', runtimeRows], ['the bush missions (P3)', p3Rows], ['the competition (COMPETE)', compRows]]) {
    try { f(M, mut); } catch (e) { ok(false, name + ': threw - ' + (e && e.message)); }
  }

  // ==== PURITY + THE EDITOR'S FILES =================================================
  const s = M.__src['73b_missions.js'].replace(/\/\/.*$/gm, '');
  for (const w of ['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'THREE', 'Math.random', 'Date.now', 'new Date', 'fetch('])
    ok(!new RegExp('\\b' + w.replace(/[.(]/g, m => '\\' + m)).test(s), '73b: pure (no ' + w + ')');
  const html = fs.readFileSync(path.join(__dirname, 'mission_editor.html'), 'utf8');
  const core = [...html.matchAll(/data-core="([^"]+)"/g)].map(m => m[1]);
  ok(J(core) === J(LEAN), 'the editor loads exactly the LEAN set, in order (' + core.join(' ') + ')');
  ok(!/<script[^>]+src="https?:/.test(html) && !/fetch\(\s*['"]https?:/.test(html), 'the editor fetches nothing off the repo');
  // ==== THE PACK IN USE (MISSIONS-LIVE switch, 13 Nov): missionPackUse over the live tables ===========================
  if (typeof M.missionPackUse === 'function') {
    const B = JSON.parse(fs.readFileSync(path.join(PACK_DIR, 'builtin.json'), 'utf8'));
    const prov = clone(M.CONTRACT_PROVIDERS), text = clone(M.CONTRACT_TEXT);
    const ids = P => Object.keys(P).sort().map(p => p + ':' + ['arc', 'builds', 'night'].map(k => (P[p][k] || []).map(r => r.id).join(',')).join('|')).join(' ');
    const u = M.missionPackUse(B, prov, text);
    ok(u.ok && u.n === 35 && !u.held.length && ids(prov) === ids(M.CONTRACT_PROVIDERS), 'the pack in use: builtin.json over the live tables gives the same 35 missions in the same places (' + u.n + ', held ' + u.held.length + ')');
    const prov2 = clone(M.CONTRACT_PROVIDERS), bad = M.missionPackUse({ what: 'nope' }, prov2, clone(M.CONTRACT_TEXT));
    ok(!bad.ok && J(prov2) === J(M.CONTRACT_PROVIDERS), 'a pack that does not validate changes nothing (' + (bad.why || '').slice(0, 60) + ')');
  } else ok(!!mut, 'missionPackUse is in 73b_missions.js');
  { const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), BLD = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
    ok(/const CAREER_PACK = \(\(\) => \{/.test(APP) && /missionPackUse\(JSON\.parse\(txt\)\)/.test(APP) && /'flydiy\.missionEditor\.draft'/.test(APP) && /fetch\('src\/missions\/' \+ pk \+ '\.json'\)/.test(BLD),
       'the switch: ?pack=<id> fetched by the career loader, ?pack=draft the editor draft, installed once before the first offers'); }
  return { fails: fails.slice(), checks };
}

// THE RUNTIME PACK: one campaign of the clients' - a speed run (seq: two gates timed, a landing), an order we build
// (sold, its profit, preferences), an order on the client's own airframe (startFrom), a job with failure rules
function runtimePack() {
  const t = x => ({ t: x, draft: true });
  return {
    what: 'flydiy-missions', v: 1, id: 'rt', title: 'ms.rt',
    campaigns: [{ id: 'rt.c', title: 'ms.rt', provider: 'clients', order: 'any', chapters: [
      { id: 'rt.run', title: 'ms.rt', order: 'seq', missions: ['r.speed'] },
      { id: 'rt.any', title: 'ms.rt', order: 'any', missions: ['o.sold', 'o.client', 'j.rules'] }] }],
    missions: [
      { id: 'r.speed', provider: 'clients', kind: 'challenge', title: 'ms.rt', brief: 'ms.rt', client: 'adam',
        legs: [{ order: 'seq', steps: [
          { id: 'g1', do: 'pass', place: { gate: [[-500, -3000], [-400, -3000]], alt: { max: 150, ref: 'agl' }, prop: 'balloons' } },
          { id: 'g2', do: 'pass', place: { gate: [[-500, -6000], [-400, -6000]], alt: { max: 150, ref: 'agl' }, prop: 'balloons', dir: 0 } },
          { do: 'land', place: 'HOME' }] }],
        timers: [{ id: 'speed', start: 'g1', stop: 'g2', target: 90, medals: [{ medal: 'gold', le: 80 }, { medal: 'silver', le: 95 }] }],
        pay: { base: 2000, bonus: [{ crit: 'medal', by: 'gold', pct: 100 }, { crit: 'medal', by: 'silver', pct: 50 }] }, rep: { provider: 'clients', gain: 0.5 } },
      { id: 'o.sold', provider: 'clients', kind: 'build', title: 'ms.rt', brief: 'ms.rt', client: 'adam',
        legs: [{ steps: [{ do: 'deliver', place: 'HOME', require: { plane: [{ k: 'seats', op: '>=', v: 2 }] } }] }],
        prefs: [{ k: 'engines', v: 1, need: 'mandatory' }, { k: 'gear', v: 'taildragger', need: 'bonus', pct: 10 }],
        pay: { base: 40000 }, rep: { provider: 'clients', gain: 1 } },
      { id: 'o.client', provider: 'clients', kind: 'build', title: 'ms.rt', brief: 'ms.rt', client: 'adam', startFrom: 'cub',
        legs: [{ steps: [{ do: 'deliver', place: 'HOME', require: { plane: [{ k: 'seats', op: '>=', v: 2 }] } }] }],
        pay: { base: 20000 }, rep: { provider: 'clients', gain: 1 } },
      { id: 'j.rules', provider: 'clients', kind: 'contract', title: 'ms.rt', brief: 'ms.rt', client: 'adam',
        legs: [{ steps: [{ do: 'carry', from: 'HOME', place: 'w3', load: { kg: 20, pax: 0 } }] }],
        rules: { crash: 'fail', injury: { fail: 2 }, freight: 'fail', damage: 'assess' },
        pay: { base: 1500 }, rep: { provider: 'clients', gain: 0.5 } },
    ],
    sites: [], text: { 'ms.rt': t('A runtime test'), 'ct.o.sold.follow': t('Again.'), 'ct.o.client.follow': t('Again.') },
  };
}
// a straight flight along x = -450 from z0 to z1 at v m/s, one sample a second, at `agl` (y = agl + 20)
function flightLine(z0, z1, v, agl, x) {
  const out = [], n = Math.ceil(Math.abs(z1 - z0) / v);
  for (let i = 0; i <= n; i++) { const z = z0 + Math.sign(z1 - z0) * Math.min(Math.abs(z1 - z0), i * v); out.push({ t: i, x: x != null ? x : -450, z, y: agl + 20, agl }); }
  return out;
}
function runtimeRows(M, mut) {
  const B = runtimePack();
  ok(!M.missionPackValidate(B, { spots: SPOTS }).length, 'the runtime pack validates (' + M.missionPackValidate(B, { spots: SPOTS }).slice(0, 4).join('; ') + ')');
  // a model with the runtime pack installed over the clients (the career reads CONTRACT_PROVIDERS)
  const N = loadMissions({ core: true, mut });
  const NI = N.missionPackInstall(B);
  ok(!NI.held.length, 'the runtime pack installs whole (' + J(NI.held) + ')');
  for (const k of ['arc', 'builds', 'night']) N.CONTRACT_PROVIDERS.clients[k] = NI.providers.clients[k];
  Object.assign(N.CONTRACT_TEXT, NI.text);                                      // the boot's merge (missionPackInstall's text)
  const hooks = { acceptVerdict: () => ({ ok: true, got: {} }) };
  const fresh = () => { let d = N.careerNew({ seed: 'rt' }); d.career.providers.clients.rep = 3; d = N.careerNormalise(d); N.careerRefresh(d); return d; };
  const stopAt = (aero, o) => N.careerStopRecord(Object.assign({ how: 'stopped', aero, occupants: 1, cargoKg: 0, row: { from: 'HOME', to: aero, t: 300 }, hour: 12 }, o || {}));
  const cubJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json'), 'utf8'));
  // G2818 (MASTER-GREEN, GATE JOINPARITY's census): acceptEvidence measures the Cub as the game flies it (tools/_load_build.js)
  const cubSpec = N.genMigrateSpec(process.env.FLYDIY_RAW_BUILDS === '1' ? (cubJ.spec || cubJ) : require('./_load_build.js').loadBuild('builds/cub_2026-09-20_corrected.json').spec);

  // ---- P2: THE PREFERENCES -----------------------------------------------------------------------------------------
  ok(N.missionPrefOf(cubSpec, 'engines') === 1 && N.missionPrefOf(cubSpec, 'thrust') === 'tractor' && N.missionPrefOf(cubSpec, 'gear') === 'taildragger'
     && N.missionPrefOf(cubSpec, 'tail') === 'conventional' && N.missionPrefOf(cubSpec, 'canopy') === 'screen' && N.missionPrefOf(cubSpec, 'suspension') === 'bungee',
     'missionPrefOf reads the Cub: 1 engine, tractor, taildragger, conventional tail, screen, bungee');
  const PJ = N.missionPrefsJudge([{ k: 'engines', v: 2, need: 'mandatory' }, { k: 'gear', v: 'taildragger', need: 'bonus', pct: 10 }], cubSpec);
  ok(!PJ.ok && /engines 2/.test(PJ.why) && PJ.pct === 10, 'a mandatory preference unmet refuses ("' + PJ.why + '"), a bonus one met still counts');
  const PJ2 = N.missionPrefsJudge([{ k: 'engines', v: 1, need: 'mandatory' }, { k: 'tail', v: 'v', need: 'bonus', pct: 10 }], cubSpec);
  ok(PJ2.ok && PJ2.pct === 0 && PJ2.got['pref.engines'] && !PJ2.got['pref.tail'], 'met mandatory, missed bonus: delivered, no bonus');

  // ---- P2: AN ORDER WE BUILD - DELIVERED, SOLD, THE PROFIT, THE BLUEPRINT --------------------------------------------
  let d = fresh();
  ok(d.career.contracts.offered.includes('o.sold') && d.career.contracts.offered.includes('j.rules') && d.career.contracts.offered.includes('r.speed'), 'the runtime pack is offered (an order, a job, the speed run)');
  let r = N.careerAccept(d, 'o.sold'); ok(r.ok && !r.effects.length, 'o.sold accepted, no client airframe to bring');
  d = r.doc;
  d.fleet['Mine @' + d.career.id] = { hangar: null, aero: 'HOME' }; d.career.airframes['Mine @' + d.career.id] = { paid: 30000, how: 'scratch', at: 0 };
  const mine = 'Mine @' + d.career.id;
  r = N.careerOnStop(d, stopAt('HOME', { slot: mine }), hooks);
  ok(!r.ok && /preferences/.test(J(r.events)), 'no spec on the stop: the order waits (pending: the preferences)');
  const two = JSON.parse(J(cubSpec)); two.engines = [two.engines[0], two.engines[0]];
  r = N.careerOnStop(d, stopAt('HOME', { slot: mine, spec: two }), hooks);
  ok(!r.ok && /a must: engines 1/.test(r.untouched['o.sold'] || ''), 'two engines where the client said one: refused (' + (r.untouched['o.sold'] || '') + ')');
  // (Game + A0, 27 Oct) THE HAND-OVER WAITS FOR THE PAGE: unwired (the default) an order is delivered, paid and done, and
  // the airframe stays ours - nothing leaves the save while it still stands in the world with no blueprint saved
  ok(N.missionHandoverWired() === false && N.contractDelivery(N.missionToContract(B.missions[1], { pack: B })).sold === false, 'the hand-over is off until the page says it is wired');
  const ru = N.careerOnStop(JSON.parse(J(d)), stopAt('HOME', { slot: mine, spec: cubSpec }), hooks), du = ru.ok && ru.events.find(e => e.k === 'done' && e.id === 'o.sold');
  ok(du && !du.handover && ru.doc.fleet[mine] && ru.doc.career.airframes[mine] && !(ru.doc.career.sold || []).length, 'unwired: delivered and paid, the airframe stays in the fleet and the airframes, no sale, no hand-over line');
  N.missionHandoverWired(true);
  const w0 = d.wallet;
  r = N.careerOnStop(d, stopAt('HOME', { slot: mine, spec: cubSpec }), hooks);
  const dn = r.ok && r.events.find(e => e.k === 'done' && e.id === 'o.sold');
  const pay = Math.round(Math.round(40000 * N.econPayScale() / 10) * 10 * 1.1 / 10) * 10;   // (PRICE-CAL: the base at today's prices)
  ok(dn && dn.pay === pay && r.doc.wallet - w0 === pay, 'delivered: paid the base + the bonus preference (' + (dn && dn.pay) + ' = 40 000 x the pay scale + 10 %)');
  ok(dn && dn.handover && dn.handover.slot === mine && dn.handover.blueprint === 'Mine' && dn.handover.cost === 30000 && dn.handover.profit === pay - 30000 && !dn.handover.client,
     'the handover: sold, the blueprint "Mine", cost 30 000, profit ' + (dn && dn.handover && dn.handover.profit));
  ok(r.ok && !r.doc.fleet[mine] && !r.doc.career.airframes[mine] && r.doc.career.sold.some(x => x.slot === mine && x.id === 'o.sold' && x.cost === 30000), 'the airframe left the fleet and the airframes; the sale on record');
  const lines = r.ok ? N.careerEventLines(r, d, r.doc).map(l => l.text).join(' | ') : '';
  ok(/blueprint is saved as Mine/.test(lines) && /profit/.test(lines), 'the arrival card says the handover and the profit (' + lines.slice(0, 220) + ')');
  // delivery kept (written): the airframe stays
  const keep = runtimePack(); keep.missions[1].delivery = { sold: false, blueprint: true };
  ok(N.contractDelivery(N.missionToContract(keep.missions[1], { pack: keep })).sold === false && N.contractDelivery(N.missionToContract(B.missions[1], { pack: B })).sold === true, 'contractDelivery: sold by default, kept when the order says so');
  ok(M.contractDelivery(M.contractAuthored()['clients.02'], { wired: true }).sold === true && M.contractDelivery(M.contractAuthored()['clients.02']).sold === false && M.contractDelivery(M.contractAuthored()['field.01']) === null,
     'the authored orders are sold too once wired (the user\'s rule for every order), kept until then; a transport job has no delivery');

  // ---- P2: THE CLIENT'S OWN AIRFRAME (startFrom) ------------------------------------------------------------------------
  d = fresh();
  r = N.careerAccept(d, 'o.client');
  ok(r.ok && r.effects.length === 1 && r.effects[0].k === 'clientPlane' && r.effects[0].from === 'cub', 'o.client accepted: the page brings the client\'s Cub (the effect)');
  d = r.doc;
  r = N.careerOnStop(d, stopAt('HOME', { slot: 'Other' }), hooks);
  ok(!r.ok && /has not arrived/.test(J(r.events)), 'before the client\'s airframe is bound: pending');
  const cslot = 'Client Cub @' + d.career.id;
  d.fleet[cslot] = { hangar: null, aero: 'HOME' };
  r = N.careerOrderBind(d, 'o.client', cslot); ok(r.ok && r.doc.career.airframes[cslot].client === 'o.client', 'careerOrderBind: the client\'s airframe stands as the client\'s');
  d = r.doc;
  r = N.careerOnStop(d, stopAt('HOME', { slot: 'Other' }), hooks);
  ok(!r.ok && /not the client's airframe/.test(r.untouched['o.client'] || ''), 'another airframe delivered: refused');
  r = N.careerOnStop(d, stopAt('HOME', { slot: cslot }), hooks);
  const dc = r.ok && r.events.find(e => e.k === 'done');
  ok(dc && dc.handover && dc.handover.client && dc.handover.blueprint === null && dc.handover.profit === dc.pay && !r.doc.fleet[cslot], 'the client\'s airframe goes home: no blueprint, the pay is the profit');
  ok(/back with its owner/.test(N.careerEventLines(r, d, r.doc).map(l => l.text).join(' ')), 'the card: the client\'s aeroplane is back with its owner');

  // ---- P2: THE FAILURE RULES AND THE RESTART ---------------------------------------------------------------------------
  d = N.careerAccept(fresh(), 'j.rules').doc;
  r = N.careerOnStop(d, stopAt('HOME', { cargoKg: 20 }), hooks);
  ok(r.ok && r.events.some(e => e.k === 'picked'), 'j.rules: the load taken on at HOME');
  d = r.doc;
  const crash = N.careerStopRecord({ how: 'crashed', wrecked: true, cargoKg: 20, occupants: 1, row: { from: 'HOME', t: 60 } });
  r = N.careerOnStop(d, crash, hooks);
  const fe = r.ok && r.events.find(e => e.k === 'failed');
  ok(fe && fe.id === 'j.rules' && /crashed/.test(fe.why) && fe.restart, 'a crash fails it (' + (fe && fe.why) + '), offered again');
  ok(r.ok && !r.doc.career.contracts.accepted.includes('j.rules') && r.doc.career.contracts.failed.some(f => f.id === 'j.rules') && r.doc.career.contracts.offered.includes('j.rules'), 'failed: out of the accepted, on record, on offer');
  ok(r.ok && /failed - the aeroplane crashed/.test(N.careerEventLines(r, d, r.doc).map(l => l.text).join(' ')), 'the card says it failed and that it can start again');
  const rs = r.ok ? N.careerRestart(r.doc, 'j.rules') : { ok: false };
  ok(rs.ok && rs.doc.career.contracts.accepted.includes('j.rules') && rs.doc.career.contracts.live['j.rules'].stage === 0 && !rs.doc.career.contracts.live['j.rules'].picked.some(Boolean), 'careerRestart: accepted again from its first step');
  ok(!N.careerRestart(d, 'r.speed').ok, 'careerRestart refuses a mission that has not failed');
  for (const [label, o, re] of [
    ['someone hurt past the band', { occ: [{ name: 'p', band: 0 }, { name: 'q', band: 2 }] }, /hurt \(heavy injuries\)/],
    ['the freight harmed', { freight: { harmed: true } }, /freight was damaged/]]) {
    const x = N.careerOnStop(d, stopAt('w3', Object.assign({ cargoKg: 20 }, o)), hooks);
    ok(x.ok && x.events.some(e => e.k === 'failed' && re.test(e.why)), 'rules: ' + label + ' fails it');
  }
  const light = N.careerOnStop(d, stopAt('w3', { cargoKg: 20, occ: [{ name: 'p', band: 1 }] }), hooks);
  ok(light.ok && !light.events.some(e => e.k === 'failed') && light.events.some(e => e.k === 'done'), 'light injuries under the mission\'s band: delivered');
  const bent = N.careerOnStop(d, stopAt('w3', { cargoKg: 20, structural: { damaged: true, why: 'a bent strut' } }), hooks);
  const bd = bent.ok && bent.events.find(e => e.k === 'done');
  ok(bd && bd.assess && bd.assess.damaged && /bent strut/.test(N.careerEventLines(bent, d, bent.doc).map(l => l.text).join(' ')), 'damage: assess - delivered, the client notes the damage');
  // not on this flight: an accepted mission with rules but no progress and not tracked is not failed by a crash
  let d2 = N.careerAccept(fresh(), 'r.speed').doc; d2 = N.careerAccept(d2, 'j.rules').doc;
  const x2 = N.careerOnStop(d2, crash, hooks);
  ok(!x2.ok && d2.career.contracts.tracked === 'r.speed', 'a crash fails only the missions on that flight (j.rules accepted, untouched, not tracked)');
  // today's contracts have no rules: a crash fails nothing (careerCrashReset's world, unchanged)
  const d3 = N.careerAccept(fresh(), d2.career.contracts.offered.find(id => /^job:/.test(id))).doc;
  ok(!N.careerOnStop(d3, crash, hooks).ok, 'a job with no rules: a crash fails nothing');

  // ---- P1: THE TRACKER - GATES, A RING, POINTS, ALTITUDE BANDS, ORDER -----------------------------------------------------
  const sp = N.contractAuthored()['r.speed'];
  const fly = (smps, live) => { const T = N.missionTrackNew(sp, live || { stage: 0, subs: [] }), ev = []; for (const q of smps) ev.push(...N.missionTrackStep(T, q)); return { T, ev }; };
  let F1 = fly(flightLine(-2500, -6500, 50, 100));
  ok(F1.T.hits.g1 && F1.T.hits.g2 && Math.abs(F1.T.hits.g1.t - 10) < 0.01 && Math.abs(F1.T.hits.g2.t - 70) < 0.01, 'two gates crossed at 50 m/s: hit at 10 s and 70 s (interpolated)');
  const E1 = N.missionTrackEvidence(F1.T);
  ok(E1.timers.speed && E1.timers.speed.s === 60 && F1.ev.some(e => e.k === 'timer' && e.state === 'stop' && e.s === 60), 'the timer: g1 -> g2 in 60 s');
  ok(!fly(flightLine(-2500, -6500, 50, 300)).T.hits.g1, 'too high (300 m AGL, the band 150): no gate');
  ok(!fly(flightLine(-6500, -2500, 50, 100)).T.hits.g2, 'g2 flown the wrong way (it faces north): no hit');
  const g2p = sp.stages[0].subs[1].place, segS = [{ t: 0, x: -450, z: -5900, agl: 100 }, { t: 1, x: -450, z: -6100, agl: 100 }];
  ok(!!N.missionHitTest(g2p, ...segS) && !N.missionHitTest(g2p, segS[1], segS[0]) && !!N.missionHitTest(Object.assign({}, g2p, { dir: undefined }), segS[1], segS[0]),
     'a gate that faces north: through it north-bound yes, south-bound no; with no facing, either way');
  ok(!fly(flightLine(-5500, -6500, 50, 100)).T.hits.g2, 'seq: g2 is not armed before g1');
  ok(!fly(flightLine(-2500, -6500, 50, 100, -300)).T.hits.g1, 'beside the posts: no gate');
  // a fast sample (one segment over both gates, 4 km in one second): both counted, in order, the lap interpolated
  const fast = fly([{ t: 0, x: -450, z: -2500, y: 120, agl: 100 }, { t: 1, x: -450, z: -6500, y: 120, agl: 100 }]);
  ok(fast.T.hits.g1 && fast.T.hits.g2 && fast.T.hits.g1.t < fast.T.hits.g2.t && N.missionTrackEvidence(fast.T).timers.speed.s === 0.8, 'one fast sample across both gates (seq): both hit in order, the lap 0.8 s');
  // a ring facing north, 8 m: through it north-bound at its height; south-bound, or 20 m high, no
  const ring = { ring: [-450, 120, -4000], r: 8, dir: 0 };
  const seg = (z0, z1, y) => [{ t: 0, x: -450, z: z0, y }, { t: 1, x: -450, z: z1, y }];
  ok(!!N.missionHitTest(ring, ...seg(-3990, -4010, 122)) && !N.missionHitTest(ring, ...seg(-4010, -3990, 122)) && !N.missionHitTest(ring, ...seg(-3990, -4010, 140)), 'a ring: through it the way it faces, at its height; not backwards, not 20 m over');
  // a point passed between two samples (closest approach inside the radius), its alt band
  const pt = { pt: [0, -2000], r: 150, alt: { min: 100, max: 400, ref: 'agl' } };
  ok(!!N.missionHitTest(pt, { t: 0, x: -400, z: -2050, agl: 200 }, { t: 1, x: 400, z: -2050, agl: 200 }), 'a point flown past fast (both samples outside, the line inside): hit');
  ok(!N.missionHitTest(pt, { t: 0, x: -400, z: -2050, agl: 50 }, { t: 1, x: 400, z: -2050, agl: 50 }), 'a point under its band (50 m AGL, 100 asked): no hit');
  // the photo: an event with its line
  const ph = { id: 'ph', stages: [{ subs: [{ id: 'shot', do: 'photo', place: pt, say: { who: 'kate', text: 'ms.rt' } }] }], timers: [] };
  const PT = N.missionTrackNew(ph, { stage: 0, subs: [] }); N.missionTrackStep(PT, { t: 0, x: -400, z: -2000, agl: 200 });
  const pe = N.missionTrackStep(PT, { t: 1, x: 400, z: -2000, agl: 200 });
  ok(pe.length === 1 && pe[0].k === 'photo' && pe[0].key === 'shot' && pe[0].say.who === 'kate', 'a photo over a point: the photo event (the shutter, the line: the page plays them)');

  // ---- MISSIONS-PROPS: THE STRIKE - A POST OR A RING TOUCHED (fabric: never harms the aeroplane; the rule decides) -------
  const pyl = { gate: [[0, 0], [100, 0]] }, crossAt = (x, agl) => [{ t: 0, x, z: 10, agl, y: agl + 20 }, { t: 1, x, z: -10, agl, y: agl + 20 }];
  const sk = (p, x, agl, reach) => N.missionStrikeTest(p, ...crossAt(x, agl), reach);
  ok(sk(pyl, 3, 10).length === 1 && sk(pyl, 3, 10)[0].post === 0 && sk(pyl, 97, 10)[0].post === 1, 'a pylon (the default prop) clipped 3 m off its axis at 10 m: a strike on that post');
  ok(!sk(pyl, 3, 30).length && !sk(pyl, 3, null).length, 'over the 25 m pylon, or no height known: no strike');
  ok(sk(pyl, 7, 0.5).length === 1 && !sk(pyl, 9, 0.5).length && !sk(pyl, 7, 20).length, 'the cone: 7 m off at its foot (2.5 + the 5 m half-span) a strike, 9 m none; 7 m off at 20 m (it is 0.8 m there) none');
  ok(sk(pyl, 1, 10, 0).length === 1 && !sk(pyl, 2, 10, 0).length, 'the reach is the page\'s half-span: with none, 1 m off at 10 m (the cone 1.65 m there) a strike, 2 m off none');
  const bal = { gate: [[0, 0], [100, 0]], prop: 'balloons', alt: { max: 150, ref: 'agl' } };
  ok(sk(bal, 4, 120).length === 1 && !sk(bal, 4, 160).length && !sk(bal, 7, 120).length, 'a balloon column up to the band\'s top (150): 4 m off at 120 m a strike; over its top, or 7 m off, none');
  const rg = { ring: [0, 120, 0], r: 8, dir: 0 }, rx = (x, y) => N.missionStrikeTest(rg, { t: 0, x, z: 10, y }, { t: 1, x, z: -10, y });
  ok(!rx(0, 120).length && rx(4, 120).length === 1 && rx(12, 120).length === 1 && !rx(20, 120).length && rx(0, 129).length === 1,
     'a ring (hole 8, tube 1.2): the centre clean, a wingtip into the tube at 4 m off a strike (a pass and a strike), 12 m off a strike, 20 m none; 9 m high a strike');
  ok(!!N.missionHitTest(rg, { t: 0, x: 4, z: 10, y: 120 }, { t: 1, x: 4, z: -10, y: 120 }) && rx(4, 120).length === 1, 'the clipped pass still counts as the pass (the air race: a pylon hit is a penalty, not a miss)');
  ok(!N.missionStrikeTest({ ring: [0, 120, 0], r: 8 }, { t: 0, x: 4, z: 10, y: 120 }, { t: 1, x: 4, z: -10, y: 120 }).length, 'a ring with no facing: no strike judged (it turns to the approach)');
  // the speed run clipping the left posts (x -497, 3 m off the balloon columns at -500): +3 s each, the lap 66 s, still gold
  const FK = fly(flightLine(-2500, -6500, 50, 100, -497)), EK = N.missionTrackEvidence(FK.T);
  ok(FK.T.hits.g1 && FK.T.hits.g2 && EK.strikes && EK.strikes.length === 2 && EK.timers.speed.raw === 60 && EK.timers.speed.pen === 6 && EK.timers.speed.s === 66,
     'the speed run clipping both left columns: both gates passed, 2 strikes, the lap 60 s + 6 s = 66 s (' + J(EK.timers.speed) + ')');
  ok(FK.ev.filter(e => e.k === 'strike').every(e => e.pen === 3 && e.prop === 'balloons' && e.until === e.t + 30), 'each strike event: +3 s, the prop torn for 30 s');
  const okK = N.missionTimerOnSub(sp, sp.stages[0].subs[1], { st: 'done' }, { tracks: { 'r.speed': EK } });
  ok(okK.st === 'done' && okK.medal === 'gold' && okK.timer.pen === 6 && okK.timer.strikes === 2, 'the medal off the penalised lap (66 s: gold), the timer carries the penalty');
  // a torn post cannot be hit again until it is re-erected
  const TT = N.missionTrackNew({ id: 'tt', stages: [{ order: 'any', subs: [{ id: 'gg', do: 'pass', place: pyl }] }] }, { stage: 0, subs: [] });
  const zz = [[0, 10], [1, -10], [2, 10], [3, -10], [40, 10], [41, -10]];
  const nS = zz.map(([t, z]) => N.missionTrackStep(TT, { t, x: 3, z, agl: 10, y: 30 }).filter(e => e.k === 'strike').length);
  ok(J(nS) === J([0, 1, 0, 0, 0, 1]), 'a torn pylon: no second strike while it is down (30 s), again once it stands (' + J(nS) + ')');
  // the rule: fail, ignore, a penalty of its own
  const evS = { tracks: { x: { strikes: [{ key: 'g1', post: 0, t: 1 }] } } };
  ok(/hit/.test(N.missionRulesJudge({ id: 'x', rules: { strike: 'fail' } }, evS).fail) && !N.missionRulesJudge({ id: 'x', rules: { strike: 'penalty' } }, evS).fail && !N.missionRulesJudge({ id: 'x', rules: { strike: 'fail' } }, { tracks: { x: {} } }).fail,
     'rules.strike fail: a strike fails the mission at the stop; penalty does not; no strike, no failure');
  const Tig = N.missionTrackNew({ id: 'tg', rules: { strike: 'ignore' }, stages: sp.stages, timers: sp.timers }, { stage: 0, subs: [] });
  for (const q of flightLine(-2500, -6500, 50, 100, -497)) N.missionTrackStep(Tig, q);
  const Tp = N.missionTrackNew({ id: 'tp', rules: { strike: { penalty: 10 } }, stages: sp.stages, timers: sp.timers }, { stage: 0, subs: [] });
  for (const q of flightLine(-2500, -6500, 50, 100, -497)) N.missionTrackStep(Tp, q);
  ok(N.missionTrackEvidence(Tig).timers.speed.s === 60 && N.missionTrackEvidence(Tig).strikes.length === 2 && N.missionTrackEvidence(Tp).timers.speed.s === 80,
     'ignore: the strikes recorded, no penalty (60 s); { penalty: 10 }: 80 s');
  // the format: rules.strike is checked; the new missions' rules carry the penalty
  const BV = JSON.parse(J(B)), jr = BV.missions.find(m => m.id === 'j.rules');
  jr.rules.strike = 'bogus'; const w1 = M.missionPackValidate(BV, { spots: SPOTS });
  jr.rules.strike = { penalty: 5 }; const w2 = M.missionPackValidate(BV, { spots: SPOTS });
  ok(w1.some(w => /rules\.strike/.test(w)) && !w2.length && N.MISSION_RULES_NEW.strike === 'penalty', 'rules.strike: penalty | fail | ignore | { penalty: s } - a bogus one refused; new missions default to the penalty');
  ok(N.missionMarkers(sp, { stage: 0, subs: [] }).filter(m => m.kind === 'gate').every(m => m.prop === 'balloons') && N.missionMarkers({ stages: [{ subs: [{ id: 'a', do: 'pass', place: pyl }] }] }, null)[0].prop === 'pylons',
     'the markers name the prop to draw: the gate\'s own, else the air-race pylon');

  // ---- P1: THE SPEED RUN THROUGH THE CAREER - THE MEDAL OFF THE LAP, A RETRY ----------------------------------------------
  const run = (v) => { const F = fly(flightLine(-2500, -6500, v, 100)); return stopAt('HOME', { tracks: { 'r.speed': N.missionTrackEvidence(F.T) } }); };
  d = N.careerAccept(fresh(), 'r.speed').doc;
  const wS = d.wallet;
  for (const [v, medal, mult] of [[50, 'gold', 2], [35, 'silver', 1.5]]) {
    const x = N.careerOnStop(d, run(v), hooks), e = x.ok && x.events.find(q => q.k === 'done');
    ok(e && e.medal === medal && e.pay === Math.round(Math.round(2000 * N.CONTRACT_PAY.story * N.econPayScale() / 10) * 10 * mult / 10) * 10 && x.doc.wallet - wS === e.pay, 'the speed run at ' + v + ' m/s: ' + (e && e.medal) + ', paid ' + (e && e.pay));
  }
  const slow = N.careerOnStop(d, run(25), hooks);
  ok(!slow.ok && /120 s, 95 s or less for a medal/.test(slow.untouched['r.speed'] || ''), 'at 25 m/s (120 s): no medal, not done - fly it again (' + (slow.untouched['r.speed'] || '') + ')');
  const none = N.careerOnStop(d, stopAt('HOME'), hooks);
  ok(!none.ok && /not flown yet/.test(none.untouched['r.speed'] || ''), 'landing with no flight evidence: the gates are not flown yet');
  const timerLine = N.careerOnStop(d, run(50), hooks);
  ok(/A runtime test: 60 s \/ 90 s · gold/.test(N.careerEventLines(timerLine, d, timerLine.doc).map(l => l.text).join(' | ')), 'the card says the lap and the medal');
  // a target with no medals: over it, not done
  const tgt = JSON.parse(J(sp)); delete tgt.timers[0].medals;
  const tres = [{ st: 'done' }, { st: 'done' }, { st: 'done' }];
  N.missionTimersOnStop(tgt, 0, tres, { tracks: { 'r.speed': { timers: { speed: { s: 100 } } } } });
  ok(tres[1].st === 'no' && /target is 90 s/.test(tres[1].why), 'a target with no medals: 100 s over 90 s, not done');
  ok(N.missionTimerTarget(Object.assign({}, sp, { timers: [] }), { start: 'g1', stop: 'g2', target: { refKmh: 180 } }) === 60, 'a target from a reference speed: 3 km at 180 km/h = 60 s');
  // the rally's splits: the derived checkpoints, a split each, through the tracker
  const rally = N.missionRallyDerive(samplePack().missions[1]);
  const rrec = N.missionToContract(rally, { pack: samplePack() });
  const RT = N.missionTrackNew(rrec, { stage: 1, subs: [] }), rp = rally.route.pts, rev = [];
  let tt = 0;
  for (let i = 0; i < rp.length; i++) { const a = rp[i - 1] || rp[0], b = rp[i]; const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 40));
    for (let k = i ? 1 : 0; k <= n; k++) { const u = k / n; rev.push(...N.missionTrackStep(RT, { t: tt++, x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, y: b.alt, agl: b.ref === 'agl' ? b.alt : b.alt - 20 })); } }
  ok(rev.filter(e => e.k === 'hit').length === 3 && rev.some(e => e.k === 'split' && e.key === 'cp2') && N.missionTrackEvidence(RT).timers.rally.s > 0, 'the rally flown: three checkpoints, the split at cp2, the lap');

  // ---- P1: PARK, WAIT, TALK AT A STOP -------------------------------------------------------------------------------------
  const sub = (o) => Object.assign({ id: 'x' }, o);
  const spot = 'HOME:' + SPOTS.HOME[0][3];
  ok(N.missionStepOnStop({ id: 'm' }, sub({ do: 'park', place: { spot } }), {}, { aero: 'HOME', spot }).st === 'done' && N.missionStepOnStop({ id: 'm' }, sub({ do: 'park', place: { spot } }), {}, { aero: 'HOME', spot: 'HOME:z' }).st === 'no', 'park: on its spot done, on another not');
  ok(N.missionStepOnStop({ id: 'm' }, sub({ do: 'wait', at: 'HOME', require: { waitMin: 30 } }), {}, { aero: 'HOME', waitedMin: 45 }).st === 'done' && N.missionStepOnStop({ id: 'm' }, sub({ do: 'wait', at: 'HOME', require: { waitMin: 30 } }), {}, { aero: 'HOME', waitedMin: 10 }).st === 'no', 'wait: 45 of 30 min done, 10 not');
  const tk = N.missionStepOnStop({ id: 'm' }, sub({ do: 'talk', at: 'w3', say: { who: 'adam', text: 'ms.rt' } }), {}, { aero: 'w3' });
  ok(tk.st === 'done' && tk.say.who === 'adam' && N.missionStepOnStop({ id: 'm' }, sub({ do: 'talk', at: 'w3' }), {}, { aero: 'HOME' }).st === 'no', 'talk: at its field, its line; elsewhere not');

  // ---- P1: THE MAP'S MARKERS + THE STOP RECORD --------------------------------------------------------------------------
  const MK = N.missionMarkers(sp, { stage: 0, subs: [false, false, false] });
  ok(J(MK.map(m => [m.key, m.kind, m.state])) === J([['g1', 'gate', 'next'], ['g2', 'gate', 'later'], ['s0.2', 'field', 'later']]) && MK[0].posts && MK[0].prop === 'balloons' && MK[1].dir === 0,
     'markers: g1 next, g2 and the landing later (seq), the posts, the prop, the facing');
  const MK2 = N.missionMarkers(sp, { stage: 0, subs: [true, false, false] });
  ok(MK2[0].state === 'done' && MK2[1].state === 'next', 'markers: g1 done, g2 next');
  const MS = N.missionMarkers(N.missionToContract(samplePack().missions[2], { pack: samplePack() }), null, { spots: SPOTS });
  ok(MS.some(m => m.kind === 'spot' && m.x === SPOTS.HOME[0][0]) && MS.some(m => m.kind === 'site' && m.x === -900) && MS.some(m => m.kind === 'pt' && m.alt), 'markers: a spot at its pack position, a site at its own, a point with its band');
  const dm = N.careerAccept(fresh(), 'r.speed').doc;
  ok(Array.isArray(N.careerMapContract(dm, 'r.speed', N.CONTRACT_FIELDS).markers) && !('markers' in N.careerMapContract(dm, 'field.01', N.CONTRACT_FIELDS)), 'the map record carries a mission\'s markers; today\'s contracts\' record is unchanged');
  const sr0 = N.careerStopRecord({ aero: 'HOME', occupants: 1 }), sr1 = N.careerStopRecord({ aero: 'HOME', occupants: 1, spot, waitedMin: 12.4, occ: [{ name: 'a', band: 7 }], freight: { harmed: 1 }, tracks: { x: { hits: {} } } });
  ok(['tracks', 'spot', 'waitedMin', 'spec', 'occ', 'freight'].every(k => !(k in sr0)) && sr1.spot === spot && sr1.waitedMin === 12 && sr1.occ[0].band === 4 && sr1.freight.harmed === true && sr1.tracks.x,
     'the stop record: without the new facts, today\'s keys only; with them, clamped');

  // ---- P2: ACCEPT ANSWERS THE NEW CRITERIA ------------------------------------------------------------------------------
  const def = N.buildGen(cubSpec), ev = N.acceptEvidence(def, { shake: { Vs: 15, TORun: 150, climbRate: 3, mass: 476 } });
  const V = c => N.acceptVerdict([c], ev).rows[0];
  ok(V({ k: 'lengthM', op: '<=', v: 25 }).value === Math.round((ev.foot.fwd + ev.foot.aft) * 10) / 10 && V({ k: 'heightM', op: '<=', v: 8 }).value === ev.foot.h && Math.abs(V({ k: 'lengthM', op: '<=', v: 25 }).value - 2 * ev.foot.half) > 0.5,
     'the measured plan read right: the length nose to tail (not the span), the height');
  ok(V({ k: 'heightM', op: '<=', v: 8 }).ok && !V({ k: 'heightM', op: '<=', v: 1 }).ok && V({ k: 'lengthM', op: '<=', v: 25 }).ok && !V({ k: 'lengthM', op: '<=', v: 3 }).ok,
     'heightM / lengthM off the measured plan (h ' + ev.foot.h + ' m, ' + (ev.foot.fwd + ev.foot.aft).toFixed(1) + ' m long)');
  ok(V({ k: 'pax', op: '>=', v: 1 }).ok && !V({ k: 'pax', op: '>=', v: 2 }).ok, 'pax: the Cub carries one beside the pilot');
  const fsOk = V({ k: 'fitsShed', op: '==', v: 'works' }), fsNo = V({ k: 'fitsShed', op: '==', v: 'field', at: { dims: { HW: 3, HD: 3, EAVE: 2 } } });
  ok(fsOk.ok && fsOk.status === 'ok' && !fsNo.ok && fsNo.status === 'fail' && /door/.test(fsNo.why || ''), 'fitsShed: the works takes it; a 6 m shed does not (' + (fsNo.why || '') + ')');
  ok(V({ k: 'stallKmh', op: '<=', v: 60 }).value === 54 && V({ k: 'toDistM', op: '<=', v: 300 }).value === 150 && V({ k: 'climbMs', op: '>=', v: 2 }).value === 3, 'the shakedown\'s numbers read: 54 km/h, 150 m, 3 m/s');
  const L1 = 476 + 80;
  ok(V({ k: 'toDistM', op: '<=', v: 300, at: { pax: 1 } }).value === Math.round(150 * Math.pow(L1 / 476, 2) * 10) / 10 && V({ k: 'stallKmh', op: '<=', v: 90, at: { pax: 1 } }).value === Math.round(54 * Math.sqrt(L1 / 476) * 10) / 10,
     'at a load: the take-off by (W/W0)^2, the stall by its square root');
  ok(N.acceptVerdict([{ k: 'stallKmh', op: '<=', v: 60 }], N.acceptEvidence(def, {})).rows[0].status === 'needs-test', 'no shakedown handed in: needs a test (the bench)');
  ok(N.acceptVerdict([{ k: 'fuelLph', op: '<=', v: 20 }], Object.assign({}, ev, { legs: [] })).rows[0].status === 'needs-flight', 'fuelLph with no leg: needs a flight');
}

// (MISSIONS-P3) THE BUSH PACK: a supply run with named passengers, a time limit and a departure window, a step that pays
// and starts the mast, a choose:1 leg, the mast built at the end (a construction stage); a carry to the mast by its strip;
// and THE CONTAINERS: a seq campaign (an any chapter, then a choose:1 chapter), a campaign behind it
function bushPack() {
  const t = x => ({ t: x, draft: true }), base = { provider: 'clients', kind: 'contract', title: 'ms.p3', brief: 'ms.p3', client: 'adam', pay: { base: 1000 }, rep: { provider: 'clients', gain: 0.5 } };
  const land = (id, f) => Object.assign({ id, legs: [{ steps: [{ do: 'land', place: f }] }] }, base);
  return {
    what: 'flydiy-missions', v: 1, id: 'p3', title: 'ms.p3',
    campaigns: [
      { id: 'b.c', title: 'ms.p3', provider: 'clients', order: 'any', chapters: [{ id: 'b.ch', title: 'ms.p3', order: 'any', missions: ['b.bush', 'b.site'] }] },
      { id: 'cn.c', title: 'ms.p3', provider: 'clients', order: 'seq', chapters: [
        { id: 'cn.a', title: 'ms.p3', order: 'any', missions: ['a1', 'a2'] }, { id: 'cn.b', title: 'ms.p3', order: 'choose:1', missions: ['b1', 'b2'] }] },
      { id: 'cn.d', title: 'ms.p3', provider: 'clients', order: 'any', needs: { after: ['cn.c'] }, chapters: [{ id: 'cn.dd', title: 'ms.p3', order: 'any', missions: ['d1'] }] }],
    missions: [
      Object.assign({ id: 'b.bush', legs: [
        { steps: [{ do: 'carry', from: 'HOME', place: 'w3', load: { kg: 20, pax: ['david', 'jody'] }, require: { maxMin: 30, depart: { after: 6 } }, disembark: ['david'],
                    say: { who: 'adam', text: 'ms.p3' }, onDone: { pay: 500, site: { id: 'mast', state: 'building' } } }] },
        { order: 'choose:1', steps: [{ do: 'land', place: 'w5' }, { do: 'land', place: 'w6' }] }],
        onDone: { site: { id: 'mast', state: 'built' }, say: { who: 'adam', text: 'ms.p3' } } }, base),
      Object.assign({ id: 'b.site', legs: [{ steps: [{ do: 'carry', from: 'HOME', place: { site: 'mast' }, load: { kg: 30, pax: 0 } }] }] }, base),
      land('a1', 'w3'), land('a2', 'w5'), land('b1', 'w6'), land('b2', 'w7'), land('d1', 'HOME'),
    ],
    sites: [{ id: 'mast', asset: 'weather mast', at: { x: -900, z: -2500, hdg: 0 }, state: 'planned', field: 'w3', track: 'survey:3' }],
    text: { 'ms.p3': t('A bush test') },
  };
}
function p3Rows(M, mut) {
  const B = bushPack();
  ok(!M.missionPackValidate(B, { spots: SPOTS }).length, '(P3) the bush pack validates (' + M.missionPackValidate(B, { spots: SPOTS }).slice(0, 4).join('; ') + ')');
  const N = loadMissions({ core: true, mut }), I = N.missionPackInstall(B);
  ok(!I.held.length, '(P3) the bush pack installs whole (' + J(I.held) + ')');
  const all = [].concat(I.providers.clients.arc, I.providers.clients.night), R = id => all.find(r => r.id === id);
  ok(R('b.site').stages[0].subs[0].to === 'w3' && R('b.site').stages[0].subs[0].place.site === 'mast', 'a carry to the mast is flown to its strip (w3), the site rides along');
  ok(J(R('b1').needs.of) === J([{ ids: ['a1', 'a2'], n: 2 }]) && J(R('b1').closed) === J({ ids: ['b1', 'b2'], n: 1 }) && !((R('a1').needs || {}).of || []).length,
     'containers: the choose:1 chapter waits for the any chapter before it (seq campaign), and closes after one');
  ok(J(R('d1').needs.of) === J([{ ids: ['a1', 'a2'], n: 2 }, { ids: ['b1', 'b2'], n: 1 }]), 'containers: a campaign behind another waits for every chapter of it (the choose chapter: one)');
  ok(R('b.bush').onDone.site.track === 'survey:3' && R('b.bush').stages[0].subs[0].onDone.site.track === 'survey:3', 'an onDone\'s site carries its construction stage');
  for (const k of ['arc', 'builds', 'night']) N.CONTRACT_PROVIDERS.clients[k] = I.providers.clients[k];
  Object.assign(N.CONTRACT_TEXT, I.text);
  const hooks = { acceptVerdict: () => ({ ok: true, got: {} }) };
  const fresh = () => { const d = N.careerNew({ seed: 'p3' }); N.careerRefresh(d); return d; };
  const stopAt = (aero, o) => N.careerStopRecord(Object.assign({ how: 'stopped', aero, occupants: 1, cargoKg: 0, row: { from: 'HOME', to: aero, t: 1200 }, hour: 9 }, o || {}));
  // the containers in a career
  let d = fresh(), O = () => d.career.contracts.offered;
  ok(O().includes('a1') && O().includes('a2') && !O().includes('b1') && !O().includes('d1'), 'career: a1, a2 offered; b1 (the next chapter) and d1 (the next campaign) not yet');
  const doneIds = ids => { const x = JSON.parse(J(d)); for (const id of ids) x.career.contracts.done.push({ id, at: 0, pay: 0 }); N.careerRefresh(x); return x; };
  d = doneIds(['a1', 'a2']);
  ok(O().includes('b1') && O().includes('b2') && !O().includes('d1'), 'career: a1 + a2 done -> b1 and b2 offered (choose one), d1 still waits');
  d = doneIds(['b1']);
  ok(!O().includes('b2') && O().includes('d1'), 'career: b1 done -> b2 closes, d1 opens');
  // the bush run
  d = N.careerAccept(fresh(), 'b.bush').doc;
  let r = N.careerOnStop(d, stopAt('HOME', { cargoKg: 20, occupants: 3 }), hooks);
  ok(r.ok && r.events.some(e => e.k === 'picked'), 'the bush run: loaded at HOME (20 kg, David and Jody)');
  d = r.doc;
  for (const [label, o, re] of [
    ['David still aboard', { people: { on: [], off: [] } }, /still aboard: David/],
    ['an hour\'s flight on a 30 min limit', { people: { off: ['david'] }, row: { from: 'HOME', to: 'w3', t: 3600 } }, /took 60 min, 30 allowed/],
    ['left before 06:00', { people: { off: ['david'] }, hour: 5 }, /outside its departure window/]]) {
    const x = N.careerOnStop(d, stopAt('w3', Object.assign({ cargoKg: 20, occupants: 3 }, o)), hooks);
    ok(!x.ok && re.test(x.untouched['b.bush'] || ''), 'the bush run refused: ' + label + ' (' + (x.untouched['b.bush'] || '') + ')');
  }
  const w0 = d.wallet;
  r = N.careerOnStop(d, stopAt('w3', { cargoKg: 20, occupants: 3, people: { on: [], off: ['david'] } }), hooks);
  ok(r.ok && r.events.some(e => e.k === 'say' && e.say.who === 'adam') && r.events.some(e => e.k === 'bonus' && e.pay === 500) && r.doc.wallet - w0 === 500
     && r.doc.career.sites.mast === 'building', 'at w3, David off: the leg done, Adam\'s line, +500, the mast building');
  const ln = N.careerEventLines(r, d, r.doc).map(l => l.text).join(' | ');
  ok(/Adam: A bush test/.test(ln) && /mast: building has started/.test(ln) && /\+500/.test(ln), 'the card says the line, the step\'s pay, the site (' + ln.slice(0, 200) + ')');
  d = r.doc;
  const MK = N.missionMarkers(N.careerContract(d, 'b.bush'), d.career.contracts.live['b.bush']);
  ok(MK.filter(m => m.state === 'next').map(m => m.field).join() === 'w5,w6', 'markers: the choose:1 leg - both strips next');
  const tr0 = d.career.tracks.survey;
  r = N.careerOnStop(d, stopAt('w6'), hooks);
  const dn = r.ok && r.events.find(e => e.k === 'done');
  ok(dn && r.doc.career.sites.mast === 'built' && r.doc.career.tracks.survey === Math.max(tr0, 3) && r.events.some(e => e.k === 'site' && e.unlock === 'survey:3'),
     'w6 (one of the two) completes the choose leg and the mission: the mast built, its construction stage revealed (survey:3)');
  // the site run, by its strip
  d = N.careerAccept(fresh(), 'b.site').doc;
  d = N.careerOnStop(d, stopAt('HOME', { cargoKg: 30 }), hooks).doc;
  ok(N.careerOnStop(d, stopAt('w3', { cargoKg: 30 }), hooks).events.some(e => e.k === 'done' && e.id === 'b.site'), 'the steel to the mast: delivered at its strip');
  // the stop record carries the people and the departure only when handed them
  const s0 = N.careerStopRecord({ aero: 'w3' }), s1 = N.careerStopRecord({ aero: 'w3', people: { on: ['jody', 3], off: ['david'] }, departHour: 25.5 });
  ok(!('people' in s0) && !('departHour' in s0) && J(s1.people) === J({ on: ['jody'], off: ['david'] }) && s1.departHour === 1.5, 'the stop record: people (ids only) and the departure hour (0-24), only when handed them');
}

// ==== THE COMPETITION (COMPETE, 13 Nov): STOL, 3-D gates, regularity, the multi-leg course, the fixed ghost =============
// THE COMPETE PACK (tiny, no story): a STOL take-off + landing over one line, a spot landing, an aerobatic run (a
// knife-edge gate, a loop's vertical ring, an inverted ring) raced against a fixed ghost, a regularity lap, a two-leg course
function competePack() {
  const t = x => ({ t: x, draft: true }), L = { line: [[0, -10], [0, 10]], dir: 90 };
  const gate = (z, extra) => ({ gate: [[-50, z], [50, z]], prop: 'pylons', dir: 0 }), cm = (id, legs, extra) => Object.assign({ id, provider: 'clients', kind: 'challenge', title: 'ms.cp', brief: 'ms.cp', client: 'adam', legs, pay: { base: 1000 }, rep: { provider: 'clients', gain: 0.1 } }, extra);
  return {
    what: 'flydiy-missions', v: 1, id: 'cp', title: 'ms.cp',
    campaigns: [{ id: 'cp.c', title: 'ms.cp', provider: 'clients', order: 'any', chapters: [{ id: 'cp.any', title: 'ms.cp', order: 'any', missions: ['c.stol', 'c.spot', 'c.aero', 'c.reg', 'c.course'] }] }],
    missions: [
      cm('c.stol', [{ steps: [{ id: 'l1', do: 'land', place: 'HOME' }] }],
        { stol: [Object.assign({ id: 'to', kind: 'takeoff', stop: 'l1', medals: [{ medal: 'gold', le: 50 }, { medal: 'silver', le: 80 }] }, L),
                 Object.assign({ id: 'ld', kind: 'landing', stop: 'l1', max: 150, ghost: { m: 100, who: 'adam' } }, L)] }),
      cm('c.spot', [{ steps: [{ id: 's1', do: 'land', place: 'HOME' }] }],
        { stol: [{ id: 'sp', kind: 'spot', line: [[1000, -10], [1000, 10]], dir: 90, stop: 's1', medals: [{ medal: 'gold', le: 2 }, { medal: 'silver', le: 5 }, { medal: 'bronze', le: 10 }] }] }),
      cm('c.aero', [{ order: 'seq', steps: [
          { id: 'k1', do: 'pass', place: Object.assign(gate(-1000), { att: { roll: 90 } }) },
          { id: 'lp', do: 'pass', place: { ring: [0, 300, -2000], r: 10, dir: 0, pitch: 90, att: { pitch: 90 } } },
          { id: 'inv', do: 'pass', place: { ring: [0, 300, -3000], r: 10, dir: 0, att: { roll: 180, pen: 4 } } },
          { do: 'land', place: 'HOME' }] }],
        { timers: [{ id: 'aero', start: 'k1', stop: 'inv', target: 90, ghost: { s: 50, who: 'adam', splits: { lp: 20 } } }] }),
      cm('c.reg', [{ order: 'seq', steps: [{ id: 'r1', do: 'pass', place: gate(-1000) }, { id: 'r2', do: 'pass', place: gate(-4000) }, { do: 'land', place: 'HOME' }] }],
        { timers: [{ id: 'reg', start: 'r1', stop: 'r2', target: 60, regularity: true, medals: [{ medal: 'gold', le: 1 }, { medal: 'silver', le: 3 }, { medal: 'bronze', le: 5 }], ghost: { s: 61 } }] }),
      cm('c.course', [
          { order: 'seq', steps: [{ id: 'a1', do: 'pass', place: gate(-1000) }, { id: 'a2', do: 'pass', place: gate(-4000) }, { id: 'aw', do: 'land', place: 'w3' }] },
          { order: 'seq', steps: [{ id: 'b1', do: 'pass', place: gate(-1000) }, { id: 'b2', do: 'pass', place: gate(-4000) }, { id: 'bh', do: 'land', place: 'HOME' }] }],
        { timers: [{ id: 'L1', start: 'a1', stop: 'a2' }, { id: 'L2', start: 'b1', stop: 'b2' }],
          course: { timers: ['L1', 'L2'], medals: [{ medal: 'gold', le: 100 }, { medal: 'silver', le: 130 }], ghost: { s: 110, who: 'adam', legs: [55, 55] } } }),
    ],
    sites: [], text: { 'ms.cp': t('A competition') },
  };
}
// samples every 0.5 s along x (z = zc, the line's middle): `pts` [[x, gnd, v?]]; agl 0 on the ground, 30 off it
const trackX = (pts, zc) => pts.map(([x, g, v], i) => Object.assign({ t: i * 0.5, x, z: zc || 0, gnd: g, agl: g ? 0 : 30, y: g ? 20 : 50 }, v != null ? { v } : {}));
const range = (a, b, d) => { const o = []; for (let x = a; d > 0 ? x <= b + 1e-9 : x >= b - 1e-9; x += d) o.push(x); return o; };
function compRows(M, mut) {
  const B = competePack(), V = p => M.missionPackValidate(p, { spots: SPOTS });
  const w0 = V(B);
  ok(!w0.length, 'COMPETE: the compete pack validates (' + w0.slice(0, 4).join('; ') + ')');
  // ---- the checker: each rule broken alone, refused with its reason
  const ms = (p, id) => p.missions.find(m => m.id === id);
  for (const [name, f, re] of [
    ['a STOL line of an unknown kind', p => { ms(p, 'c.stol').stol[0].kind = 'hover'; }, /kind is takeoff \| landing \| spot/],
    ['a STOL line 2 m long', p => { ms(p, 'c.stol').stol[0].line = [[0, -1], [0, 1]]; }, /5-200 m long/],
    ['a STOL run along its line', p => { ms(p, 'c.stol').stol[0].dir = 0; }, /off square/],
    ['a STOL line judged on no step', p => { ms(p, 'c.stol').stol[0].stop = 'zz'; }, /stop names no step/],
    ['a STOL line twice', p => { ms(p, 'c.stol').stol[1].id = 'to'; }, /an id of its own/],
    ['a STOL ghost that is a free name', p => { ms(p, 'c.stol').stol[1].ghost.who = 'Bob Jones'; }, /person id/],
    ['a STOL line with medals and a max', p => { ms(p, 'c.stol').stol[0].max = 100; }, /medals or max/],
    ['a ring tilted past the vertical', p => { ms(p, 'c.aero').legs[0].steps[1].place.pitch = 120; }, /ring\.pitch/],
    ['a tilted ring that faces nowhere', p => { delete ms(p, 'c.aero').legs[0].steps[1].place.dir; }, /ring\.pitch/],
    ['an attitude that asks nothing', p => { ms(p, 'c.aero').legs[0].steps[0].place.att = { tol: 10 }; }, /one angle/],
    ['an attitude rolled 270', p => { ms(p, 'c.aero').legs[0].steps[2].place.att.roll = 270; }, /att\.roll/],
    ['an attitude with a word nobody reads', p => { ms(p, 'c.aero').legs[0].steps[0].place.att.yaw = 0; }, /att\.yaw/],
    ['a regularity lap with no target', p => { delete ms(p, 'c.reg').timers[0].target; }, /needs its target|target is seconds/],
    ['a regularity lap with neither medals nor tol', p => { delete ms(p, 'c.reg').timers[0].medals; }, /needs medals or tol/],
    ['a tol on a lap that is not regularity', p => { ms(p, 'c.aero').timers[0].tol = 3; }, /tol is a regularity/],
    ['a ghost with no time', p => { delete ms(p, 'c.aero').timers[0].ghost.s; }, /ghost is/],
    ['a ghost split on a step outside the lap', p => { ms(p, 'c.aero').timers[0].ghost.splits = { k1: 5 }; }, /ghost\.splits\.k1 is no step/],
    ['a ghost split past its lap', p => { ms(p, 'c.aero').timers[0].ghost.splits.lp = 70; }, /ghost\.splits\.lp is no step/],
    ['a course of one leg', p => { ms(p, 'c.course').course.timers = ['L1']; }, /2\+ ids/],
    ['a course on a timer the mission lacks', p => { ms(p, 'c.course').course.timers = ['L1', 'L9']; }, /L9 is no timer/],
    ['a course with its legs backwards', p => { ms(p, 'c.course').course.timers = ['L2', 'L1']; }, /later leg/],
    ['a course ghost whose legs do not add up', p => { ms(p, 'c.course').course.ghost.legs = [55, 80]; }, /add up/],
    ['a lap outside a course with no target', p => { ms(p, 'c.course').course.timers = ['L1', 'L2']; delete ms(p, 'c.course').course; }, /target is seconds/],
  ]) {
    const p = clone(B); f(p); const w = V(p);
    ok(w.some(x => re.test(x)), 'COMPETE checker: ' + name + ' is refused (' + (w.join('; ').slice(0, 140) || 'valid') + ')');
  }
  // ---- the converter: mission -> record -> mission -> record the same; the legacy projection strips the new fields
  for (const m of B.missions) {
    const rec = M.missionToContract(m, { pack: B }), back = M.missionFromContract(rec);
    ok(M.missionCanon(M.missionToContract(back, { pack: B })) === M.missionCanon(rec) && M.missionCanon(back.stol || null) === M.missionCanon(m.stol || null) && M.missionCanon(back.course || null) === M.missionCanon(m.course || null),
       'COMPETE converter: ' + m.id + ' mission -> record -> mission -> record, the same (stol, course, att, pitch, ghost ride along)');
    const st = M.missionStrip(rec);
    ok(st.stol === undefined && st.course === undefined && st.timers === undefined, 'COMPETE converter: ' + m.id + ' - the legacy projection carries no stol, course or timers');
  }
  const RS = M.missionToContract(ms(B, 'c.stol'), { pack: B });
  ok(Array.isArray(RS.timers) && !RS.timers.length && !('timers' in M.missionFromContract(RS)) && M.missionScored(RS) && !M.missionScored(M.missionToContract(ms(B, 'c.reg'), { pack: B })),
     'COMPETE converter: a STOL-only record carries an empty timers list (the career\'s stop seam keys on it), and the mission gets none back');

  // ---- the runtime: a model with the compete pack installed over the clients
  const N = loadMissions({ core: true, mut }), NI = N.missionPackInstall(B);
  ok(!NI.held.length, 'COMPETE: the compete pack installs whole (' + J(NI.held) + ')');
  for (const k of ['arc', 'builds', 'night']) N.CONTRACT_PROVIDERS.clients[k] = NI.providers.clients[k];
  Object.assign(N.CONTRACT_TEXT, NI.text);
  const R = id => N.contractAuthored()[id];
  const track = (rec, smps, live) => { const T = N.missionTrackNew(rec, live || { stage: 0, subs: [] }), ev = []; for (const q of smps) ev.push(...N.missionTrackStep(T, q)); return { T, ev, E: N.missionTrackEvidence(T) }; };
  const judge = (rec, sub, E) => N.missionTimerOnSub(rec, rec.stages.flatMap(s => s.subs).find(s => s.id === sub), { st: 'done' }, { tracks: { [rec.id]: E } });

  // ---- 1. STOL: THE TAKE-OFF (stopped on the line, the roll, the lift-off held 1 s)
  const rs = R('c.stol');
  const toRun = (x0, liftX, hop) => trackX([[x0, true, 0], [x0, true, 0]].concat(range(x0 + 5, liftX, 5).map(x => [x, !(hop && Math.abs(x - hop) < 1e-9)])).concat(range(liftX + 5, liftX + 80, 5).map(x => [x, false])));
  let F = track(rs, toRun(-2, 58));
  ok(F.E.stol && F.E.stol.to && F.E.stol.to.m === 60.5 && F.ev.some(e => e.k === 'stol' && e.id === 'to' && e.m === 60.5), 'STOL take-off: stopped 2 m behind the line, lift-off between 58 and 63 m: 60.5 m (' + J(F.E.stol) + ')');
  let j = judge(rs, 'l1', Object.assign({}, F.E, { stol: Object.assign({ ld: { m: 90 } }, F.E.stol) }));
  ok(j.st === 'done' && j.medal === 'silver' && j.scores && j.scores[0].m === 60.5 && j.scores[0].kind === 'takeoff' && j.scores[1].m === 90, 'STOL take-off judged at its stop step: 60.5 m, silver (le 80), beside the landing\'s 90 m (' + J(j) + ')');
  ok(!track(rs, toRun(-10, 58)).E.stol, 'STOL take-off: stopped 10 m behind the line (3 m allowed): not measured');
  ok(!track(rs, toRun(2, 58)).E.stol, 'STOL take-off: stopped past the line: not measured');
  F = track(rs, toRun(-2, 58, 23));
  ok(F.E.stol && F.E.stol.to.m === 60.5, 'STOL take-off: a hop at 23 m (one sample off the ground) is not the lift-off: still 60.5 m (' + J(F.E.stol) + ')');
  ok(!track(rs, toRun(-2, 58).map(q => { const o = Object.assign({}, q); delete o.gnd; return o; })).E.stol, 'STOL: samples that do not say the wheels are on the ground measure nothing');
  ok(/the to takeoff was not measured/.test(judge(rs, 'l1', { timers: {}, hits: {} }).why || ''), 'STOL: not measured, the step is not done (fly it again)');
  // ---- STOL: THE LANDING (5 s in the air, the first touchdown past the line, to the stop)
  const ldRun = (td, stopX, goAround) => {
    const air = range(-400, td - 1, 20).map(x => [x, false]).concat([[td - 1, false]]), roll = range(td + 1, stopX, 10).map(x => [x, true]);
    const ga = goAround ? range(td + 11, td + 400, 20).map(x => [x, false]).concat(range(goAround - 1, goAround - 1, 1).map(x => [x, false])).concat(range(goAround + 1, stopX, 10).map(x => [x, true])) : roll;
    return trackX(air.concat(goAround ? [[td + 1, true]] : []).concat(ga).concat([[stopX, true, 0]]));
  };
  F = track(rs, ldRun(20, 120));
  ok(F.E.stol && F.E.stol.ld && F.E.stol.ld.m === 120 && F.E.stol.ld.td === 20, 'STOL landing: touched down at 20 m, stopped at 120 m: 120 m from the line (' + J(F.E.stol) + ')');
  j = judge(rs, 'l1', Object.assign({}, F.E, { stol: Object.assign({ to: { m: 40 } }, F.E.stol) }));
  ok(j.st === 'done' && j.medal === 'gold' && j.scores[1].id === 'ld' && j.scores[1].m === 120 && j.scores[1].ghost.m === 100 && j.scores[1].ghost.beat === false && j.scores[1].ghost.by === 20,
     'STOL landing judged: 120 m (150 allowed), the fixed ghost 100 m: 20 m behind it; the take-off\'s gold kept (' + J(j) + ')');
  F = track(rs, ldRun(-5, 120));
  ok(F.E.stol.ld.foul === 'short' && /touched down 5 m short/.test(judge(rs, 'l1', Object.assign({}, F.E, { stol: Object.assign({ to: { m: 40 } }, F.E.stol) })).why || ''), 'STOL landing: touched 5 m short of the line - a foul, not done');
  F = track(rs, ldRun(20, 220));
  ok(F.E.stol.ld.m === 220 && /220 m, 150 allowed/.test(judge(rs, 'l1', Object.assign({}, F.E, { stol: Object.assign({ to: { m: 40 } }, F.E.stol) })).why || ''), 'STOL landing: 220 m, over its max 150: not done');
  F = track(rs, ldRun(20, 180, 60));
  ok(F.E.stol.ld && F.E.stol.ld.td === 60 && F.E.stol.ld.m === 180, 'STOL landing: touched at 20 m, went round (5 s up): dropped; the next touchdown at 60 m counts (' + J(F.E.stol) + ')');
  ok(!track(rs, ldRun(20, 120).map(q => Object.assign({}, q, { z: 50 }))).E.stol, 'STOL landing: a touchdown beside the line (50 m off its middle, 10 m long): not this line');
  ok(!track(rs, trackX(range(-40, 20, 20).map(x => [x, false]).concat([[21, true], [60, true, 0]]))).E.stol, 'STOL landing: in the air under 5 s before the touchdown (a hop off the strip): no landing');
  // ---- STOL: THE SPOT
  const rp = R('c.spot'), spot = td => track(rp, ldRun(1000 + td, 1000 + td + 80));
  F = spot(3);
  ok(F.E.stol.sp.m === 3 && judge(rp, 's1', F.E).medal === 'silver', 'spot landing: touched 3 m past the line - 3 m, silver');
  F = spot(-1.5);
  ok(F.E.stol.sp.m === 1.5 && F.E.stol.sp.short === true && judge(rp, 's1', F.E).medal === 'gold' && judge(rp, 's1', F.E).scores[0].short === true, 'spot landing: 1.5 m short - 1.5 m, gold, said short');
  ok(/12 m, 10 or less for a medal/.test(judge(rp, 's1', spot(12).E).why || ''), 'spot landing: 12 m off: no medal, not done');
  ok(N.missionMarkers(rs, { stage: 0, subs: [] }).filter(m => m.kind === 'line').map(m => m.key + ':' + m.stol + ':' + m.state).join() === 'stol:to:takeoff:next,stol:ld:landing:next', 'the markers carry the STOL lines (their kind, their stop step\'s state)');

  // ---- 2. 3-D GATES: A KNIFE-EDGE GATE, A LOOP'S VERTICAL RING, AN INVERTED RING; THE ATTITUDE A SOFT PENALTY
  const ra = R('c.aero');
  const aeroRun = (roll1, roll3, noAtt) => {
    const o = [], push = (x, y, z, a) => o.push(Object.assign({ t: o.length, x, y, z, agl: y - 20 }, noAtt ? {} : a));
    push(0, 100, -900, { hdg: 0, pitch: 0, roll: roll1 }); push(0, 100, -1100, { hdg: 0, pitch: 0, roll: roll1 });   // k1 at t 0.5
    for (let i = 0; i < 18; i++) push(0, 100, -1100 - i * 50, { hdg: 0, pitch: 0, roll: 0 });                          // to the loop
    push(0, 280, -2000, { hdg: 0, pitch: 88, roll: 0 }); push(0, 320, -2000, { hdg: 200, pitch: 89, roll: 0 });          // up through lp
    for (let i = 0; i < 20; i++) push(0, 300, -2000 - i * 49, { hdg: 0, pitch: 0, roll: 0 });
    push(0, 300, -2990, { hdg: 0, pitch: 0, roll: roll3 }); push(0, 300, -3010, { hdg: 0, pitch: 0, roll: roll3 });     // inv
    return o;
  };
  F = track(ra, aeroRun(85, -175));
  const lap = F.E.timers.aero;
  ok(F.T.hits.k1 && F.T.hits.lp && F.T.hits.inv && !F.E.atts && lap && lap.s === 42 && !lap.pen, 'the aerobatic run: knife-edge (85 deg) through k1, straight up through the loop\'s ring, inverted (-175) through inv: all passed, no penalty, 42 s (' + J(lap) + ')');
  ok(F.T.hits.lp.att && !F.T.hits.lp.att.miss && F.T.hits.lp.att.err.hdg === undefined, 'the vertical ring: the heading of a vertical line is not judged (pitch 89, heading 200 against 0)');
  ok(F.ev.some(e => e.k === 'split' && e.key === 'lp' && e.ghost === 0) && F.ev.some(e => e.k === 'timer' && e.state === 'stop' && e.s === 42 && e.ghost === -8), 'the fixed ghost: level at the loop (+0 s), 8 s ahead at the stop (' + J(F.ev.filter(e => e.ghost != null)) + ')');
  j = judge(ra, 'inv', F.E);
  ok(j.st === 'done' && j.timer.ghost.beat === true && j.timer.ghost.by === -8 && j.timer.ghost.s === 50, 'the lap against the ghost: 42 s, the ghost 50 s - beaten by 8 s (' + J(j.timer) + ')');
  F = track(ra, aeroRun(0, 0));
  const lp2 = F.E.timers.aero;
  ok(F.T.hits.k1 && F.T.hits.inv && F.E.atts && F.E.atts.length === 2 && lp2.raw === 42 && lp2.pen === 6 && lp2.atts === 2 && lp2.s === 48,
     'wings level through the knife-edge gate (+2 s) and upright through the inverted ring (its own +4 s): both still passed, the lap 42 + 6 = 48 s (' + J(lp2) + ')');
  ok(F.ev.some(e => e.k === 'timer' && e.state === 'stop' && e.s === 48 && e.ghost === -2) && judge(ra, 'inv', F.E).timer.atts === 2, 'the stop event and the judge carry the penalised lap (48 s, 2 s ahead of the ghost), the attitude misses counted');
  F = track(ra, aeroRun(0, 0, true));
  ok(F.E.timers.aero.s === 42 && F.T.hits.k1.att.unknown && !F.E.atts, 'no attitude in the samples: not judged (said unknown), no penalty');
  const vr = ra.stages[0].subs[1].place;
  ok(!!N.missionHitTest(vr, { t: 0, x: 0, y: 290, z: -2000 }, { t: 1, x: 0, y: 310, z: -2000 }) && !N.missionHitTest(vr, { t: 0, x: 0, y: 310, z: -2000 }, { t: 1, x: 0, y: 290, z: -2000 })
     && !N.missionHitTest(vr, { t: 0, x: 0, y: 300, z: -1990 }, { t: 1, x: 0, y: 300, z: -2010 }) && !N.missionHitTest(vr, { t: 0, x: 0, y: 305, z: -1990 }, { t: 1, x: 0, y: 305, z: -2010 })
     && !N.missionHitTest(vr, { t: 0, x: 0, z: -2000 }, { t: 1, x: 0, z: -2000 }),
     'the vertical ring (pitch 90): through it climbing yes; diving, flown level across it (in its plane, or 5 m over its centre), or with no heights, no');
  const tilt = { ring: [0, 300, 0], r: 8, dir: 0, pitch: 45 };
  ok(!!N.missionHitTest(tilt, { t: 0, x: 0, y: 290, z: 10 }, { t: 1, x: 0, y: 310, z: -10 }) && !N.missionHitTest(tilt, { t: 0, x: 0, y: 290, z: 10 }, { t: 1, x: 0, y: 290, z: -10 }), 'a ring tilted 45: through it on the climb yes; level under its centre no');
  // the strikes rolled: a knife-edge wing reaches up, not out
  const pyl = { gate: [[0, 0], [100, 0]] }, kx = (x, agl, roll) => N.missionStrikeTest(pyl, { t: 0, x, z: 10, agl, roll }, { t: 1, x, z: -10, agl, roll });
  ok(kx(3, 10, 0).length === 1 && !kx(3, 10, 90).length, 'a pylon 3 m off at 10 m: a strike wings level, none in a knife-edge');
  const rg = { ring: [0, 120, 0], r: 8, dir: 0 }, rr = (x, roll) => N.missionStrikeTest(rg, { t: 0, x, z: 10, y: 120, roll }, { t: 1, x, z: -10, y: 120, roll });
  ok(rr(4, 0).length === 1 && !rr(4, 90).length && rr(0, 90).length === 0, 'a ring, 4 m off its centre: the level wing into the tube, the knife-edge wing clear');

  // ---- 3. REGULARITY: THE DEVIATION FROM THE TARGET, ITS MEDAL BANDS, THE GHOST'S DEVIATION
  const rr2 = R('c.reg'), regRun = v => track(rr2, flightLine(-500, -4500, v, 100, 0));
  const RG = v => judge(rr2, 'r2', regRun(v).E);
  let rj = RG(50);
  ok(rj.st === 'done' && rj.timer.s === 60 && rj.timer.dev === 0 && rj.medal === 'gold' && rj.timer.ghost.dev === 1 && rj.timer.ghost.beat, 'regularity: 60 s on a 60 s target - 0 s off, gold; the ghost was 1 s off, beaten (' + J(rj.timer) + ')');
  rj = judge(rr2, 'r2', { timers: { reg: { s: 62.5 } } });
  ok(rj.st === 'done' && rj.timer.dev === 2.5 && rj.medal === 'silver', 'regularity: 62.5 s - 2.5 s off, silver');
  rj = judge(rr2, 'r2', { timers: { reg: { s: 57.5 } } });
  ok(rj.st === 'done' && rj.timer.dev === 2.5 && rj.medal === 'silver', 'regularity: early counts as late - 57.5 s, 2.5 s off, silver');
  ok(/6 s off 60 s, 5 or less for a medal/.test(judge(rr2, 'r2', { timers: { reg: { s: 54 } } }).why || ''), 'regularity: 54 s, 6 s off - no medal, not done (the FASTER lap does not win)');
  const tolR = JSON.parse(J(rr2)); delete tolR.timers[0].medals; tolR.timers[0].tol = 2;
  ok(judge(tolR, 'r2', { timers: { reg: { s: 61.5 } } }).st === 'done' && /3 s off 60 s, 2 allowed/.test(judge(tolR, 'r2', { timers: { reg: { s: 63 } } }).why || ''), 'regularity with a tolerance: 1.5 s off done, 3 s off not');

  // ---- 4 + 5. THE MULTI-LEG COURSE: THE SUM OF THE LEGS, ITS SPLITS, ITS MEDAL, THE FIXED GHOST - THROUGH THE CAREER
  const rc = R('c.course'), hooks = { acceptVerdict: () => ({ ok: true, got: {} }) };
  let d = N.careerNew({ seed: 'cp' }); d.career.providers.clients.rep = 3; d = N.careerNormalise(d); N.careerRefresh(d);
  ok(d.career.contracts.offered.includes('c.course') && d.career.contracts.offered.includes('c.stol'), 'COMPETE: the course and the STOL event are offered');
  const stopAt = (aero, o) => N.careerStopRecord(Object.assign({ how: 'stopped', aero, occupants: 1, cargoKg: 0, row: { from: 'HOME', to: aero, t: 300 }, hour: 12 }, o || {}));
  const legRun = (cid, v, live) => track(rc, flightLine(-500, -4500, v, 100, 0), live).E;
  let r = N.careerAccept(d, 'c.course'); d = r.doc;
  const live0 = J(d.career.contracts.live['c.course'] || { stage: 0, subs: [] });
  r = N.careerOnStop(d, stopAt('w3', { tracks: { 'c.course': legRun('c.course', 60, JSON.parse(live0)) } }), hooks);   // the gates 3000 m apart at 60 m/s: 50 s
  ok(r.ok && r.doc.career.contracts.live['c.course'] && r.doc.career.contracts.live['c.course'].stage === 1 && r.doc.career.contracts.live['c.course'].timers.L1.s === 50, 'the course, leg 1: 50 s, kept on the career (live.timers) (' + J(r.doc.career.contracts.live['c.course']) + ')');
  d = r.doc;
  const E2 = legRun('c.course', 3000 / 55, d.career.contracts.live['c.course']);   // 55 s
  ok(E2.course && E2.course.L1 === 50 && E2.timers.L2.s === 55, 'the course, leg 2\'s flight carries leg 1\'s 50 s into its evidence (' + J(E2.course) + ')');
  const cj = N.missionTimerOnSub(rc, rc.stages[1].subs[1], { st: 'done' }, { tracks: { 'c.course': E2 } });
  ok(cj.st === 'done' && cj.course.s === 105 && J(cj.course.legs) === J([{ id: 'L1', s: 50, ghost: -5 }, { id: 'L2', s: 55, ghost: 0 }]) && cj.medal === 'silver' && cj.course.ghost.beat && cj.course.ghost.by === -5,
     'the course judged: 50 + 55 = 105 s, per-leg splits against the ghost (-5, 0), silver (gold le 100), the ghost\'s 110 s beaten by 5 s (' + J(cj.course) + ')');
  r = N.careerOnStop(d, stopAt('HOME', { tracks: { 'c.course': E2 } }), hooks);
  const done = r.ok && r.events.find(e => e.k === 'done' && e.id === 'c.course');
  ok(done && done.medal === 'silver', 'the course through the career: completed with the course\'s medal (silver), not the leg\'s (' + J(done) + ')');
  const noL1 = N.missionTimerOnSub(rc, rc.stages[1].subs[1], { st: 'done' }, { tracks: { 'c.course': legRun('c.course', 3000 / 55, { stage: 1, subs: [] }) } });
  ok(noL1.st === 'no' && /leg 1 \(L1\) has no time/.test(noL1.why), 'the course: leg 2 flown with no leg 1 on the career - not done (' + noL1.why + ')');
  ok(N.missionTimerOnSub(rc, rc.stages[1].subs[1], { st: 'done' }, { tracks: { 'c.course': { timers: { L2: { s: 90 } }, course: { L1: 50 } } } }).why === 'the course: 140 s, 130 or less for a medal', 'the course: 140 s, no medal - not done');
  // ---- STOL through the career: the converter's empty timers list opens the stop seam
  r = N.careerAccept(d, 'c.stol'); d = r.doc;
  const toE = track(rs, toRun(-2, 58)), ldE = track(rs, ldRun(20, 120));
  const both = Object.assign({}, toE.E, { stol: Object.assign({}, toE.E.stol, ldE.E.stol) });
  const ns = N.careerOnStop(d, stopAt('HOME', { tracks: { 'c.stol': toE.E } }), hooks);
  ok(!ns.ok && /the ld landing was not measured/.test(ns.untouched['c.stol'] || ''), 'STOL through the career: the take-off alone - the landing not measured, not done (' + (ns.untouched['c.stol'] || '') + ')');
  const ys = N.careerOnStop(d, stopAt('HOME', { tracks: { 'c.stol': both } }), hooks), ye = ys.ok && ys.events.find(e => e.k === 'done' && e.id === 'c.stol');
  ok(ye && ye.medal === 'silver', 'STOL through the career: both measured - done, the take-off\'s silver (' + J(ye) + ')');
  // ---- PURITY: 73c reads no clock and no random (the ghost is authored, the same for every player)
  const s3 = M.__src['73c_mission_run.js'].replace(/\/\/.*$/gm, '');
  ok(!/Math\.random|Date\.now|new Date|performance\.now/.test(s3), '73c: no clock, no random (the ghost is a fixed record)');
}

// THE SELFTEST: the model doctored one rule at a time; each must turn the gate red
const sub = (a, b) => s => { if (!s.includes(a)) throw new Error('selftest: anchor not found: ' + a.slice(0, 60)); return s.replace(a, b); };
const MUTS = [
  ['the conversion drops the departure of a survey', { '73b_missions.js': sub("sub.do = 'survey'; if (from) sub.from = from;", "sub.do = 'survey';") }],
  ['a when is lost on the way in', { '73b_missions.js': sub('if (R.when != null) sub.when = msClone(R.when);', '') }],
  ['the criteria are lost on the way in', { '73b_missions.js': sub('if (R.plane != null) sub.crit = msClone(R.plane);', '') }],
  ['the install puts the night work in the builds', { '73b_missions.js': sub("else (r.kind === 'build' ? T.builds : T.night).push(r);", 'else T.builds.push(r);') }],
  ['the install ignores the runtime', { '73b_missions.js': sub('if (rw) { held.push({ id, why: rw }); continue; }', '') }],
  ['a free name is a person', { '73b_missions.js': sub("if (typeof id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(id))", "if (typeof id !== 'string')") }],
  ['places are not checked by verb', { '73b_missions.js': sub('if (k === null || !allow.includes(k))', 'if (k === null)') }],
  ['the tutorial may be edited', { '73b_missions.js': sub("const extra = Object.keys(m).filter(k => !['id', 'tutorial'].includes(k));", 'const extra = [];') }],
  ['a timer may stop anywhere', { '73b_missions.js': sub("for (const e of ['start', 'stop']) if (!stepIds[t[e]])", "for (const e of []) if (!stepIds[t[e]])") }],
  ['the rally splits at the wrong speed', { '73b_missions.js': sub('const v = o.refKmh / 3.6;', 'const v = o.refKmh / 3;') }],
  ['an authored checkpoint is overwritten', { '73b_missions.js': sub('if (was && !was.auto) return was;', '') }],
  ['prefs need no marking', { '73b_missions.js': sub("if (!MISSION_NEED.includes(p.need))", 'if (false)') }],
  ['the pay forgets a place', { '73_contracts.js': sub('skm += s.to || !s.place ? contractKm(s.from, s.to, F) : contractPlaceKm(s.from, s.place, F);', 'skm += contractKm(s.from, s.to, F) || 0;') }],
  ['the runtime runs a verb nobody knows', { '73_contracts.js': sub("if (!CONTRACT_DO.includes(s.do) && !CONTRACT_DO_NEXT.includes(s.do)) return 'do ' + s.do + ' (no runtime yet)';", '') }],
  ['the new verbs pass without opts.mission', { '73_contracts.js': sub('!(opts.mission && CONTRACT_DO_NEXT.includes(s.do))', '!CONTRACT_DO_NEXT.includes(s.do)') }],
  ['the order with preferences is refused its words', { '73_contracts.js': sub('const prefs = opts.mission && Array.isArray(r.prefs) && r.prefs.length > 0;', 'const prefs = false;') }],
  ['the arc is not offered in order', { '72_contract_data.js': sub("arc: [\n      C_({ id: 'field.01'", "arc: [\n      C_({ id: 'field.01x'") }],
  ['73b reads the clock', { '73b_missions.js': sub('const msClone = o => JSON.parse(JSON.stringify(o));', 'const msClone = o => (Date.now(), JSON.parse(JSON.stringify(o)));') }],
  // (MISSIONS-P1/P2) the runtime
  ['a point ignores its altitude band', { '73c_mission_run.js': sub('return Math.hypot(q.x - cx, q.z - cz) <= p.r && !msrAltWhy(p.alt, q) ? q : null;', 'return Math.hypot(q.x - cx, q.z - cz) <= p.r ? q : null;') }],
  ['a gate flown backwards counts', { '73c_mission_run.js': sub('if (msrNum(p.dir) && msrDiff(msrDeg(dx, dz), p.dir) > 90) return null;', '') }],
  ['a ring is passed backwards', { '73c_mission_run.js': sub('if (!(sa < 0 && sb >= 0)) return null;', 'if (!(sa > 0 && sb <= 0)) return null;') }],
  ['a seq leg arms every objective', { '73c_mission_run.js': sub('if (!q) { if (T.seq) break; continue; }', 'if (!q) continue;') }],
  ['a fast pass counts the first gate only', { '73c_mission_run.js': sub('    if (T.seq) from = q;', '    if (T.seq) break;') }],
  ['a slow lap still wins a medal', { '73c_mission_run.js': sub('const m = t.medals.slice().sort((a, b) => a.le - b.le).find(x => E.s <= x.le);', 'const m = t.medals[0];') }],
  ['a timed group is spent by a slow lap', { '73c_mission_run.js': sub("for (let j = a; j < b; j++) if (res[j] && res[j].st === 'done')", 'for (let j = a; j < a; j++) if (res[j] && res[j].st === \'done\')') }],
  ['a mandatory preference is only a wish', { '73c_mission_run.js': sub("else if (p.need === 'mandatory') miss.push(", 'else if (false) miss.push(') }],
  ['a crash fails nothing', { '73c_mission_run.js': sub("if (R.crash === 'fail' && crashed) return", 'if (false) return') }],
  ['someone hurt is nothing', { '73c_mission_run.js': sub('if (thr >= 1 && worst >= thr) return', 'if (false) return') }],
  ['the bonus preference is not paid', { '73_contracts.js': sub("for (const p of rec.prefs || []) if (p && p.need === 'bonus' && got && got['pref.' + p.k]) pct += p.pct || 0;", '') }],
  ['any airframe delivers the client\'s order', { '73_contracts.js': sub("if (own && stop.slot !== own.slot) return", 'if (false) return') }],
  ['the hand-over runs before the page is wired', { '73c_mission_run.js': sub('let MISSION_HANDOVER_WIRED = false;', 'let MISSION_HANDOVER_WIRED = true;') }],
  ['the delivered airframe stays ours', { '74_career.js': sub('const handover = dl && dl.sold && live.slot', 'const handover = false && dl && dl.sold && live.slot') }],
  ['a failed mission stays accepted', { '74_career.js': sub("  D.accepted = D.accepted.filter(x => x !== id);\n  delete D.live[id];\n  if (D.tracked === id) D.tracked = D.accepted[0] || null;\n  D.failed", '  D.failed') }],
  ['a failure fails every accepted mission', { '74_career.js': sub('const v = busy ? missionRulesJudge(rec, stop) : null;', 'const v = missionRulesJudge(rec, stop);') }],
  ['the length is the span', { '72_accept.js': sub("case 'lengthM': return out(ev.foot ? Math.round((ev.foot.fwd + ev.foot.aft) * 10) / 10 : null,", "case 'lengthM': return out(ev.foot ? 2 * ev.foot.half : null,") }],
  ['the take-off ignores the load', { '72_accept.js': sub('const add = (acceptNum(a.pax) || 0) * L.occKg + (acceptNum(a.kg) || 0);', 'const add = 0;') }],
  ['the stop record grows keys', { '75_career_wire.js': sub("if (typeof o.spot === 'string' && o.spot) out.spot = o.spot;", 'out.spot = o.spot || null;') }],
  ['the markers lose the seq order', { '73c_mission_run.js': sub("if (state === 'next' && st.order === 'seq') { if (armed) state = 'later'; armed = true; }", '') }],
  // (MISSIONS-PROPS) the strike
  ['a pylon is hit over its top', { '73c_mission_run.js': sub('if (!msrNum(h) || h > D.h || d >', 'if (!msrNum(h) || d >') }],
  ['the wing reaches nothing', { '73c_mission_run.js': sub("const k = msrKind(p), R = msrNum(reach) ? reach : MISSION_PROP_DIMS.reach, out = [];", 'const k = msrKind(p), R = 0, out = [];') }],
  ['a strike costs no time', { '73c_mission_run.js': sub("if (T.strike.mode === 'penalty' && T.strike.pen > 0) {", 'if (false) {') }],
  ['a torn post is hit again', { '73c_mission_run.js': sub('if (T.torn[id] != null && T.torn[id] > t) continue;', '') }],
  ['a strike never fails', { '73c_mission_run.js': sub("if (n) return { fail: n === 1 ?", 'if (false) return { fail: n === 1 ?') }],
  // (MISSIONS-P3)
  ['a time limit is not checked', { '73c_mission_run.js': sub('if (msrNum(R.maxMin) && msrNum(row.t) && row.t > R.maxMin * 60) return', 'if (false) return') }],
  ['nobody needs to get off', { '73c_mission_run.js': sub("if (miss.length) return { st: 'no', why: (k === 'embark' ? 'waiting for ' : 'still aboard: ') + miss.map(name).join(', ') };", '') }],
  ['a departure window is not checked', { '73c_mission_run.js': sub("if (h != null && !msrHourIn(h, R.depart)) return", 'if (false) return') }],
  ['a choose:N leg needs every step', { '73c_mission_run.js': sub('return m ? n >= +m[1] :', 'return m ? n >= (st.subs || []).length :') }],
  ['a choose:N chapter never closes', { '74_career.js': sub('if (rec.closed && nOf(rec.closed) >= rec.closed.n) return false;', '') }],
  ['the containers are not waited for', { '74_career.js': sub('if ((N.of || []).some(c => nOf(c) < c.n)) return false;', '') }],
  ['a step\'s onDone pays nothing', { '74_career.js': sub("{ playerCharge(d, -od.pay, 'contract', rec.id); events.push", '{ events.push') }],
  ['a built site reveals nothing', { '74_career.js': sub("if (m && S.state === 'built') c.tracks[m[1]] = Math.max(c.tracks[m[1]] || 0, +m[2]);", '') }],
  // (COMPETE) the competition: STOL, 3-D gates, regularity, the course, the ghost
  ['STOL: a take-off from anywhere', { '73c_mission_run.js': sub("st.ph = s >= -K.gap && s <= 0 && Math.abs(F.c(b.x, b.z)) <= F.half ? 'armed' : 'wait';", "st.ph = 'armed';") }],
  ['STOL: a hop is the lift-off', { '73c_mission_run.js': sub("else if (st.ph === 'lift' && gb) st.ph = 'armed';", "else if (st.ph === 'lift' && gb) {}") }],
  ['STOL: a landing short of the line is no foul', { '73c_mission_run.js': sub("else if (s < 0) put(S, { foul: 'short', td: msrR1(s), t });", 'else if (false) {}') }],
  ['STOL: a go-around keeps the first touchdown', { '73c_mission_run.js': sub("if (!gb && T.airSince != null && b.t - T.airSince >= K.flown) st.ph = 'wait';", 'if (false) {}') }],
  ['STOL: a hop is a landing', { '73c_mission_run.js': sub('tdn && flown >= K.flown &&', 'tdn &&') }],
  ['STOL: a landing anywhere is on the line', { '73c_mission_run.js': sub('if (Math.abs(F.c(m.x, m.z)) > F.half || Math.abs(s) > K.zone) continue;', '') }],
  ['STOL: the flight began in the air, so it never flew', { '73c_mission_run.js': sub('if (ga === false && T.airSince == null) T.airSince = a.t;', '') }],
  ['the spot is measured signed', { '73c_mission_run.js': sub('put(S, Object.assign({ m: msrR1(Math.abs(s)), t }', 'put(S, Object.assign({ m: msrR1(s), t }') }],
  ['STOL: a foul is judged done', { '73c_mission_run.js': sub("if (E.foul) return { st: 'no'", "if (false) return { st: 'no'") }],
  ['STOL: an unmeasured line is judged done', { '73c_mission_run.js': sub("if (!E) return { st: 'no', why: 'the ' + S.id", "if (!E) continue; if (0) return { st: 'no', why: 'the ' + S.id") }],
  ['STOL: the max is not judged', { '73c_mission_run.js': sub('msrJudge(r, S.medals, E.m, S.max,', 'msrJudge(r, S.medals, E.m, null,') }],
  ['STOL: the ghost is beaten backwards', { '73c_mission_run.js': sub('sc.ghost = msrGhost(S.ghost.m, E.m,', 'sc.ghost = msrGhost(E.m, S.ghost.m,') }],
  ['the attitude costs nothing', { '73c_mission_run.js': sub('const pen = aj.miss ? (', 'const pen = false ? (') }],
  ['the attitude has no tolerance', { '73c_mission_run.js': sub('if (e > (msrNum(att.tol) ? att.tol : MISSION_ATT.tol)) miss = true;', 'if (e > 360) miss = true;') }],
  ['the roll does not wrap (inverted -175 is 355 off 180)', { '73c_mission_run.js': sub("msrR1(k === 'pitch' ? Math.abs(q.pitch - att.pitch) : msrDiff(q[k], att[k]))", 'msrR1(Math.abs(q[k] - att[k]))') }],
  ['a vertical line has a heading', { '73c_mission_run.js': sub("(k === 'hdg' && (V(att.pitch) || V(q.pitch)))", '(false)') }],
  ['an unknown attitude is a miss', { '73c_mission_run.js': sub('if (!msrNum(q[k])) { unknown.push(k); continue; }', 'if (!msrNum(q[k])) { miss = true; continue; }') }],
  ['the penalised lap is not the stop event\'s', { '73c_mission_run.js': sub("for (const e of out) if (e.state === 'stop' && laps.includes(e.id))", 'for (const e of []) if (e.k') }],
  ['a ring is never tilted', { '73c_mission_run.js': sub('e = (msrNum(p.pitch) ? p.pitch : 0) * Math.PI / 180', 'e = 0') }],
  ['a vertical ring is a hair off vertical', { '73c_mission_run.js': sub('const z = v => (Math.abs(v) < 1e-12 ? 0 : v);', 'const z = v => v;') }],
  ['a knife-edge wing reaches out', { '73c_mission_run.js': sub('Rh = msrNum(q.roll) ? R * Math.abs(CORE_MATH.cos(q.roll * Math.PI / 180)) : R;', 'Rh = R;') }],
  ['the ring\'s strike ignores the roll', { '73c_mission_run.js': sub('const ph = msrNum(q.roll) ? q.roll * Math.PI / 180 : 0,', 'const ph = 0,') }],
  ['regularity rewards the faster lap', { '73c_mission_run.js': sub('const dev = timer.dev = msrR1(Math.abs(E.s - target));', 'const dev = timer.dev = msrR1(E.s - target);') }],
  ['regularity ignores its tolerance', { '73c_mission_run.js': sub('msrJudge(r, t.medals, dev, t.tol,', 'msrJudge(r, t.medals, dev, null,') }],
  ['the ghost lap is beaten backwards', { '73c_mission_run.js': sub('timer.ghost = msrGhost(G, E.s, { s: G });', 'timer.ghost = msrGhost(E.s, G, { s: G });') }],
  ['the ghost\'s splits need a split target', { '73c_mission_run.js': sub('(o.split != null || (tm.ghost && tm.ghost.splits && msrNum(tm.ghost.splits[o.key])))', '(o.split != null)') }],
  ['the course is its last leg', { '73c_mission_run.js': sub('const course = { s: msrR1(legs.reduce((a, L) => a + L.s, 0)), legs };', 'const course = { s: legs[legs.length - 1].s, legs };') }],
  ['the course forgets the earlier legs', { '73c_mission_run.js': sub('if (LT[id] && msrNum(LT[id].s)) T.prior[id] = LT[id].s;', '') }],
  ['the course\'s medal is not the mission\'s', { '73c_mission_run.js': sub('r = msrJudge(r, C.medals, course.s,', 'r = msrJudge(r, null, course.s,') }],
  ['a STOL-only record never reaches the stop seam', { '73b_missions.js': sub('if (r.timers == null && Array.isArray(M.stol) && M.stol.length) r.timers = [];', '') }],
  ['the STOL lines do not ride along', { '73b_missions.js': sub("                             'stol', 'course'],", "                             'course'],") }],
  ['a STOL line of any kind', { '73b_missions.js': sub("if (!['takeoff', 'landing', 'spot'].includes(S.kind))", 'if (false)') }],
  ['a STOL run at any angle to its line', { '73b_missions.js': sub('|| off > 15)', '|| off > 90)') }],
  ['an attitude rolled anywhere', { '73b_missions.js': sub('roll: [-180, 180]', 'roll: [-999, 999]') }],
  ['a regularity lap judged on nothing', { '73b_missions.js': sub('if (t.regularity && t.medals == null && !msIn(t.tol, 0.1, 600))', 'if (false)') }],
  ['a course in any leg order', { '73b_missions.js': sub('else if (leg != null && !(leg > prev)) why.push', 'else if (false) why.push') }],
  ['a ghost whose legs add up to anything', { '73b_missions.js': sub(' || Math.abs(L.reduce((a, v) => a + v, 0) - G.s) > 0.5))', '))') }],
  ['a site is flown to nowhere', { '73b_missions.js': sub('if (s.do === \'carry\') { if (from) sub.from = from; if (f) sub.to = f; else if (P) { put(); if (served) sub.to = served; } }', 'if (s.do === \'carry\') { if (from) sub.from = from; if (f) sub.to = f; else if (P) put(); }') }],
];

if (!SELF) {
  const r = run(null);
  for (const f of r.fails.slice(0, 60)) console.log('  FAIL ' + f);
  console.log('MISSIONS: ' + r.checks + ' checks, ' + PACKS.length + ' pack(s)' + (r.fails.length ? ', ' + r.fails.length + ' failed' : ''));
  console.log('GATE MISSIONS: ' + (r.fails.length ? 'FAIL (' + r.fails.length + ')' : 'PASS'));
  process.exit(r.fails.length ? 1 : 0);
} else {
  const base = run(null);
  let bad = base.fails.length ? ['the unmutated model is red: ' + base.fails[0]] : [];
  for (const [label, mut] of MUTS) {
    let r;
    try { r = run(mut); } catch (e) { r = { fails: ['threw: ' + e.message] }; }
    console.log((r.fails.length ? '  red   ' : '  GREEN ') + label + (r.fails.length ? ' (' + r.fails[0].slice(0, 100) + ')' : ''));
    if (!r.fails.length) bad.push(label);
  }
  console.log('MISSIONS selftest: ' + MUTS.length + ' doctored rules, ' + (MUTS.length - bad.length) + ' red');
  console.log('GATE MISSIONS: ' + (bad.length ? 'FAIL (' + bad.join('; ') + ')' : 'PASS'));
  process.exit(bad.length ? 1 : 0);
}
