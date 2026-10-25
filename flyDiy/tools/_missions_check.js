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
//   node tools/_missions_check.js --selftest  -> the model doctored one rule at a time; each must turn a check red
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
        legs: [{ steps: [{ do: 'fly', from: 'HOME', place: { pt: [2000, -8000], r: 200 } }] }],
        route: { v: 1, id: 'rt1', name: 'Rally', end: 'home', margin: 60, pts: [{ x: 0, z: -2000, alt: 400, ref: 'msl', V: null },
          { x: 3000, z: -6000, alt: 500, ref: 'msl', V: null }, { x: 6000, z: -6000, alt: 300, ref: 'agl', V: null }] },
        rally: { refKmh: 180, r: 250 }, needs: { after: ['s.gate'] },
        pay: { base: 3000 }, rep: { provider: 'clients', gain: 0.5 } },
      { id: 's.bush', provider: 'clients', kind: 'contract', title: 'ms.s.bush.title', brief: 'ms.s.bush.brief', client: 'adam',
        legs: [{ steps: [{ id: 'b1', do: 'carry', from: 'HOME', place: 'w3', load: { kg: 20, pax: ['david', 'jody'] },
                           require: { when: { before: 'dusk' }, maxMin: 90, depart: { after: 8 } }, disembark: ['david'] },
                         { do: 'photo', place: { pt: [-1200, -2600], r: 200, alt: { min: 100, max: 400, ref: 'agl' } } }] },
               { steps: [{ do: 'carry', from: 'w3', place: { site: 'mast' }, load: { kg: 60, pax: 0 }, onDone: { site: { id: 'mast', state: 'building' } } },
                         { do: 'park', place: { spot: 'HOME:' + SPOTS.HOME[0][3] } },
                         { do: 'talk', say: { who: 'adam', text: 'ms.s.bush.say' } }] }],
        onDone: { say: { who: 'adam', text: 'ms.s.bush.done' } },
        pay: { base: 2500 }, rep: { provider: 'clients', gain: 0.5 } },
      { id: 's.order', provider: 'clients', kind: 'build', title: 'ms.s.order.title', brief: 'ms.s.order.brief', client: 'adam',
        legs: [{ steps: [{ do: 'deliver', place: 'HOME', require: { plane: [{ k: 'seats', op: '>=', v: 2 }, { k: 'climbMs', op: '>=', v: 3, at: { pax: 1 } },
          { k: 'toDistM', op: '<=', v: 250, at: { pax: 1, kg: 0 } }, { k: 'pax', op: '>=', v: 1 }] } }] }],
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
      ok(m && m.client === M.msClientOf(a.provider), id + ': its owner is the provider\'s client');
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
    ['a voice aboard', p => { p.missions[2].legs[0].steps[0].load.pax = ['tim']; }, M.GAME_PEOPLE ? /voice/ : /./, !M.GAME_PEOPLE],
    ['the pack is v2', p => { p.v = 2; }, /v must be 1/],
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
  // the install holds out what the runtime cannot run, with the reason
  const SI = M.missionPackInstall(S);
  ok(SI.held.length === 4 && SI.held.every(h => typeof h.why === 'string' && h.why), 'the install holds out every sample mission, each with its reason (' + J(SI.held).slice(0, 200) + ')');
  ok(Object.values(SI.providers).every(P => !P.arc.length && !P.builds.length && !P.night.length), 'nothing of the sample reaches the career');
  for (const m of S.missions) ok(M.contractRuntimeOk(M.missionToContract(m, { pack: S })) !== '', m.id + ': contractRuntimeOk says why it waits');
  // each pending thing ALONE keeps a record out: a new verb at a field, a place, a new criterion, a rule, a step order
  const one = (step, extra) => M.contractRuntimeOk(M.missionToContract(Object.assign({ id: 'x', provider: 'clients', kind: 'contract', title: 't', brief: 'b',
    legs: [{ steps: [step] }], pay: { base: 1 }, rep: { provider: 'clients', gain: 0 } }, extra || {}), {}));
  ok(one({ do: 'land', place: 'HOME' }) === '', 'runtime: a plain landing runs');
  ok(/do talk/.test(one({ do: 'talk', place: 'HOME', say: { who: 'adam', text: 'ct.field.01.done' } })), 'runtime: a new verb alone waits (' + one({ do: 'talk', place: 'HOME' }) + ')');
  ok(/place/.test(one({ do: 'fly', from: 'HOME', place: { pt: [0, -2000], r: 150 } })), 'runtime: a point alone waits');
  ok(/rules/.test(one({ do: 'land', place: 'HOME' }, { rules: { crash: 'fail' } })), 'runtime: a rule alone waits');
  ok(/maxMin|require/.test(one({ do: 'carry', from: 'HOME', place: 'w3', load: { kg: 5, pax: 0 }, require: { maxMin: 60 } })), 'runtime: a max duration alone waits');
  ok(/climbMs/.test(one({ do: 'deliver', place: 'HOME', require: { plane: [{ k: 'climbMs', op: '>=', v: 3 }] } }, { kind: 'build' })), 'runtime: a new criterion alone waits');
  ok(/order/.test(M.contractRuntimeOk(Object.assign(M.missionToContract({ id: 'x', provider: 'clients', kind: 'contract', title: 't', brief: 'b', legs: [{ order: 'seq', steps: [{ do: 'land', place: 'HOME' }] }],
    pay: { base: 1 }, rep: { provider: 'clients', gain: 0 } }, {})))), 'runtime: steps in order seq wait');
  // the pay reads places: a carry to a site is paid its km, never NaN
  for (const m of S.missions) { const P = M.contractPay(M.missionToContract(m, { pack: S })); ok(Number.isFinite(P.total) && Number.isFinite(P.km), m.id + ': contractPay finite (' + P.total + ', ' + P.km + ' km)'); }
  const bush = M.contractPay(M.missionToContract(S.missions[2], { pack: S }));
  const kmWant = (Math.hypot(-811 - -301, -2397 - 221) + Math.hypot(-900 - -811, -2500 - -2397)) / 1000;
  ok(Math.abs(bush.km - kmWant) < 0.02, 'a carry to a site is paid the field-to-site km (' + bush.km + ' vs ' + kmWant.toFixed(2) + ')');
  // the reward line
  const rw = M.missionReward(S.missions[0], { pack: S });
  ok(rw.paid === Math.round(2000 * M.CONTRACT_PAY.story / 10) * 10 && rw.best === rw.paid * 2 && rw.why !== '', 'missionReward: paid, best with gold, why it waits (' + J(rw) + ')');
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

  // ==== PURITY + THE EDITOR'S FILES =================================================
  const s = M.__src['73b_missions.js'].replace(/\/\/.*$/gm, '');
  for (const w of ['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'THREE', 'Math.random', 'Date.now', 'new Date', 'fetch('])
    ok(!new RegExp('\\b' + w.replace(/[.(]/g, m => '\\' + m)).test(s), '73b: pure (no ' + w + ')');
  const html = fs.readFileSync(path.join(__dirname, 'mission_editor.html'), 'utf8');
  const core = [...html.matchAll(/data-core="([^"]+)"/g)].map(m => m[1]);
  ok(J(core) === J(LEAN), 'the editor loads exactly the LEAN set, in order (' + core.join(' ') + ')');
  ok(!/<script[^>]+src="https?:/.test(html) && !/fetch\(\s*['"]https?:/.test(html), 'the editor fetches nothing off the repo');
  return { fails: fails.slice(), checks };
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
  ['the runtime runs the new verbs', { '73_contracts.js': sub("if (!CONTRACT_DO.includes(s.do)) return 'do ' + s.do + ' (no runtime yet)';", '') }],
  ['the new verbs pass without opts.mission', { '73_contracts.js': sub('!(opts.mission && CONTRACT_DO_NEXT.includes(s.do))', '!CONTRACT_DO_NEXT.includes(s.do)') }],
  ['the order with preferences is refused its words', { '73_contracts.js': sub('const prefs = opts.mission && Array.isArray(r.prefs) && r.prefs.length > 0;', 'const prefs = false;') }],
  ['the arc is not offered in order', { '72_contract_data.js': sub("arc: [\n      C_({ id: 'field.01'", "arc: [\n      C_({ id: 'field.01x'") }],
  ['73b reads the clock', { '73b_missions.js': sub('const msClone = o => JSON.parse(JSON.stringify(o));', 'const msClone = o => (Date.now(), JSON.parse(JSON.stringify(o)));') }],
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
