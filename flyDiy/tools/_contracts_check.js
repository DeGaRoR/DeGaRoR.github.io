#!/usr/bin/env node
// ============================================================================
// GATE CONTRACTS — the contract model (G2240 CONTRACT-MODEL): the record, the
// providers' data, the job generator, a stage's acceptance from a flight's end,
// the follow-up build contract and the career document.
// ============================================================================
// futureDesigns/GAME-2026-10-06.md §R (binding), §6, §7, §11, §12.3, §13.2.
// What is held, in blocks:
//   THE RECORD     every authored contract validates, round-trips through JSON
//                  and the normaliser (a fixpoint; unknown fields ride along);
//                  the kinds and the criterion kinds are the ruled lists, the
//                  crit kinds carry k / unit / static|flown / how; five
//                  providers, each with 4-6 arc contracts ending in a stage
//                  unlock of its own track; every text key resolves (authored,
//                  generated, labels, goods, tracks), every slot is filled.
//   THE WORLD      CONTRACT_FIELDS is Jolene's record (8 runways, byte-equal
//                  through contractFieldsOf); the gear rule is stripAllows on
//                  every field x gear; the five validated designs' numbers are
//                  re-derived from their build files (genShakedown, within 3 %).
//   PHYSICAL ROWS  every arc stage and every generated job is flyable by at
//                  least one validated design; every job class has a doer; NO
//                  validated design does every class (ruling az, through
//                  physical gates: G-COST); a build contract's delivery field
//                  takes some gear.
//   THE PAY        the job's, never the aeroplane's (G-COST): invariant to any
//                  airframe / gear / slot on the record or the stop; no running
//                  costs in a career's ledger (grant and contracts only).
//   THE GENERATOR  deterministic, order-independent (providers in any order,
//                  any interleaving, any key order of the career), seed-
//                  sensitive, refreshed after N completed contracts, a job
//                  regenerated from its id.
//   ACCEPTANCE     right field + load = advance (and pay, rep, unlock, done);
//                  wrong field / short load / wrecked / off-field / not
//                  accepted / after dusk = the SAME document, untouched, with a
//                  reason; a load picked up then delivered; stages in order,
//                  subs in any order; surveys by overflight; a build contract
//                  is never judged here (the hook; missing = pending); medals.
//   FOLLOW-UPS     every build contract offers one; each changes EXACTLY one
//                  criterion, never repeats a change, pays +15 % (GQ26/GQ31).
//   (g1)           no build criterion or build text names a configuration.
//   THE CAREER     created from the grant (60 000 + a Cub voucher, GQ23), a v2
//                  player document in mode 'career'; normaliser fixpoint; the
//                  player normaliser keeps the block; refusals change nothing.
//   THE IMPORT     a Block-5 pack imports over the keys; bad ids / config
//                  words / unknown slots refused; the table handed in kept.
//   HELD OUT       (G2320) a contract asking an ultimate past the normal category's 5.7 g (the aerobatic box) is
//                  never offered, never accepted; the clients' journey ends before it.
//   THE WIRE       (G2320) 75_career_wire.js: the map's record off a career (providers, offers, resolved text,
//                  contractPay, progress, the fleet's certificates), the stop record, ACCEPT as the hook, the
//                  arrival card's lines, the overflight radius.
//   PURITY         72_/73_/74_/75_ touch no DOM, storage, THREE, clock or random.
//
//   node tools/_contracts_check.js             -> "GATE CONTRACTS: PASS|FAIL"
//   node tools/_contracts_check.js --show      also print the designs x classes table
//   node tools/_contracts_check.js --selftest  -> negative verification: the
//                  model's own sources doctored one rule at a time; each must
//                  turn a check red (a check that cannot fail is not a check)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const CORE = require('./flight_core.js');
const SELF = process.argv.includes('--selftest');
const SHOW = process.argv.includes('--show');

const SRC = {};
for (const f of ['72_contract_data.js', '73_contracts.js', '74_career.js', '75_career_wire.js'])
  SRC[f.slice(0, 2)] = fs.readFileSync(path.join(ROOT, 'src', 'core', f), 'utf8');
const JOLENE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8'));
const RUNWAYS = JOLENE.layers.runways;
// every top-level name the three files declare (const / let / function), read off their own sources
const namesOf = s => [...s.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);

// the three files, evaluated FRESH over the core's globals (minus their own names), so the selftest doctors
// exactly the rules under test and nothing else
function loadModel(mut) {
  const src = {};
  for (const k of Object.keys(SRC)) src[k] = (mut && mut['s' + k]) ? mut['s' + k](SRC[k]) : SRC[k];
  const names = [].concat(...Object.values(src).map(namesOf)).filter((n, i, a) => a.indexOf(n) === i);
  const base = Object.assign({ console }, CORE);
  for (const n of names) delete base[n];
  const ctx = vm.createContext(base);
  vm.runInContext(src['72'] + '\n' + src['73'] + '\n' + src['74'] + '\n' + src['75'] + '\n;this.__M = { ' + names.join(', ') + ' };', ctx, { filename: 'contracts' });
  return Object.assign(ctx.__M, { __src: src });
}

// ---- the validated designs' numbers, measured once off their build files (genShakedown) ---------------------------
function measureDesigns(DS) {
  const out = {};
  for (const k of Object.keys(DS)) {
    const D = DS[k];
    let j = JSON.parse(fs.readFileSync(path.join(ROOT, D.build), 'utf8'));
    if (D.patch === 'floats') { j.spec.gear.type = 'floats'; j.spec.cage = Object.assign({}, j.spec.cage, { gearFloats: 1 }); }
    const def = CORE.buildGen(CORE.genMigrateSpec(j.spec || j));
    const s = CORE.genShakedown(def);
    out[k] = { gear: CORE.stripGear(def.spec) === 'floats' || s.gearType === 'floats' ? 'floats' : 'wheels',
               seats: s.envelope.seats, bagKg: (def.spec.cabin && def.spec.cabin.baggage) || 0,
               massKg: s.mass, emptyKg: s.empty, toM: s.TORun, cruiseKmh: s.VCruise * 3.6, rangeKm: s.rangeKm,
               spanM: s.span, cost: s.cost, tankL: s.energyL, power: s.energyKind };
  }
  return out;
}
// genShakedown on five builds is ~20 s, so the measurement is cached by content: the core's body hash (the code
// that measures) + every build file + the table's build / patch columns. A hit is what the measurement would give
// now. In the OS temp dir (nothing in the repo); FLYDIY_CONTRACTS_NOCACHE=1 measures afresh.
function measuredDesigns() {
  const DS = loadModel(null).CONTRACT_DESIGNS;
  const crypto = require('crypto'), os = require('os');
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(path.join(__dirname, 'flight_core.js'), 'utf8').split('\n')[1] || '');
  for (const k of Object.keys(DS).sort()) { h.update(k + '|' + DS[k].build + '|' + (DS[k].patch || '')); h.update(fs.readFileSync(path.join(ROOT, DS[k].build))); }
  const f = path.join(os.tmpdir(), 'flydiy-contracts-designs-' + h.digest('hex').slice(0, 16) + '.json');
  if (process.env.FLYDIY_CONTRACTS_NOCACHE !== '1') { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { /* measure */ } }
  const M = measureDesigns(DS);
  try { fs.writeFileSync(f, JSON.stringify(M)); } catch (e) { /* a read-only temp: measure every run */ }
  return M;
}
const MEASURED = measuredDesigns();

let fails = [], checks = 0;
const ok = (c, msg) => { checks++; if (!c) fails.push(msg); return !!c; };
const J = o => JSON.stringify(o);
const eq = (a, b) => J(a) === J(b);
const clone = o => JSON.parse(J(o));
let TABLE = [];

function run(mut) {
  fails = []; checks = 0; TABLE = [];
  const M = loadModel(mut);
  const PROV = M.CONTRACT_PROVIDERS, F = M.CONTRACT_FIELDS, DS = M.CONTRACT_DESIGNS, T = M.CONTRACT_TEXT;
  const A = M.contractAuthored(), ids = Object.keys(A);
  // every refusal must hand back the very document it was given, untouched
  const refused = (r, before, doc, label) => {
    ok(r && r.ok === false && typeof r.why === 'string' && r.why.length > 0, label + ': refused, with a reason');
    ok(r && r.doc === doc, label + ': the refusal hands back the same document');
    ok(eq(doc, before), label + ': the refusal changed nothing');
  };

  // ==== THE RECORD ===========================================================
  ok(eq(M.CONTRACT_KINDS, ['contract', 'job', 'challenge', 'build', 'survey']), 'the kinds are contract | job | challenge | build | survey');
  const KINDS = ['seats', 'emptyKg', 'powertrain', 'tankL', 'batteryKWh', 'spanM', 'costMax', 'ultimateG', 'xwindKt', 'hydro',
                 'tasKmh', 'enduranceMin', 'rangeKm', 'takeoffAt', 'landAt'];
  ok(eq(Object.keys(M.CONTRACT_CRIT_KINDS).sort(), KINDS.slice().sort()), 'CONTRACT_CRIT_KINDS is exactly the 15 ruled kinds');
  for (const k of Object.keys(M.CONTRACT_CRIT_KINDS)) {
    const K = M.CONTRACT_CRIT_KINDS[k];
    ok(K.k === k && typeof K.unit === 'string' && ['static', 'flown'].includes(K.when) && typeof K.how === 'string' && K.how
       && typeof K.src === 'string' && Array.isArray(K.op) && K.op.every(o => M.CONTRACT_OPS.includes(o)),
       'crit kind ' + k + ' carries k, unit, static|flown, how, src, op');
    ok(K.when !== 'static' || ['spec', 'ledger', 'cert'].includes(K.how), 'crit kind ' + k + ': a static kind is judged without flying');
    ok(K.unit === 'strip' || K.values || (Array.isArray(K.band) && K.band[0] < K.band[1]), 'crit kind ' + k + ' has a sane band or its words');
    ok(M.contractTextOk('crit.' + k), 'crit kind ' + k + ' has a label');
  }
  for (const k of ['tasKmh', 'enduranceMin', 'rangeKm', 'takeoffAt', 'landAt']) ok(M.CONTRACT_CRIT_KINDS[k] && M.CONTRACT_CRIT_KINDS[k].when === 'flown', k + ' must be flown');
  for (const k of ['seats', 'emptyKg', 'powertrain', 'tankL', 'spanM', 'costMax']) ok(M.CONTRACT_CRIT_KINDS[k] && M.CONTRACT_CRIT_KINDS[k].when === 'static', k + ' is static (GQ19: the phone may judge it)');
  ok(eq(Object.keys(PROV).sort(), ['clients', 'field', 'minedock', 'resort', 'survey']), 'five providers (G-PROV: the mine and the dock merged)');
  ok(eq(Object.keys(M.CONTRACT_TRACKS).sort(), ['clients', 'field', 'minedock', 'resort', 'survey']), 'five tracks, minedock one track');
  const HOMEF = { field: ['HOME'], minedock: ['mn_strip', 'SEA', 'mk_sea'], resort: ['tw_ski'], survey: ['HOME'] };
  for (const p of Object.keys(PROV)) {
    const P = PROV[p];
    ok(P.id === p && M.contractTextOk(P.name) && M.contractTextOk(P.desc), p + ': id and a working name');
    ok(Array.isArray(P.fields) && P.fields.length && P.fields.every(f => F[f]), p + ': home fields exist');
    for (const f of HOMEF[p] || []) ok(P.fields.includes(f), p + ': home field ' + f + ' (§7.2 / §R)');
    ok(P.track === p, p + ': its own track');
    ok(Array.isArray(P.goods) && P.goods.length && P.goods.every(g => g.id && ['kg', 'pax', 'bulk', 'none'].includes(g.kind) && M.contractTextOk(g.word)), p + ': a goods list with words');
    ok(Array.isArray(P.jobs) && P.jobs.length && P.jobs.every(t => P.goods.some(g => g.id === t.goods) && M.contractTextOk(t.title) && M.contractTextOk(t.brief)
       && (Array.isArray(t.routes) || Array.isArray(t.survey))), p + ': a job table (goods, routes, text)');
    for (const t of P.jobs) for (const r of (t.routes || []).concat(t.survey || [])) ok(r.length === 2 && F[r[0]] && F[r[1]] && r[0] !== r[1], p + '/' + t.id + ': route ' + r + ' between two fields');
    ok(P.arc.length >= 4 && P.arc.length <= 6, p + ': an arc of 4-6 contracts (' + P.arc.length + ')');
    const last = P.arc[P.arc.length - 1];
    ok(last && last.unlock && new RegExp('^' + p + ':' + M.CONTRACT_TRACKS[p].max + '$').test(last.unlock.stage), p + ': the arc ends in its track\'s last stage unlock');
    let prevN = 0;
    P.arc.forEach((r, i) => {
      ok(r.provider === p, r.id + ': its provider');
      if (i) ok(r.needs && (r.needs.after || []).includes(P.arc[i - 1].id), r.id + ': needs the arc\'s previous contract');
      if (r.unlock) { const n = +r.unlock.stage.split(':')[1]; ok(r.unlock.stage.split(':')[0] === p && n > prevN, r.id + ': unlocks its own track, in order'); prevN = n; }
    });
    for (const n of Object.keys(PROV).filter(x => x !== p)) ok(!P.arc.concat(P.builds || []).some(r => r.unlock && r.unlock.stage.split(':')[0] === n), p + ': unlocks no other track');
  }
  const allIds = [].concat(...Object.values(PROV).map(P => P.arc.concat(P.builds || []).map(r => r.id)));
  ok(allIds.length === new Set(allIds).size, 'every authored id is unique');
  for (const id of ids) {
    const r = A[id];
    const w = M.contractValidate(r, { ids });
    ok(!w.length, id + ' validates' + (w.length ? ': ' + w.join('; ') : ''));
    ok(eq(M.contractNormalise(r), r), id + ': the normaliser is a fixpoint');
    ok(eq(M.contractNormalise(JSON.parse(J(r))), r), id + ': round-trips through JSON');
    ok(M.contractNormalise(Object.assign(clone(r), { future: { x: 1 } })).future.x === 1, id + ': an unknown field rides along');
    for (const k of M.contractKeys(r)) ok(M.contractTextOk(k), id + ': text key ' + k + ' resolves');
  }
  // the validator catches what it claims to
  {
    const r = clone(A['minedock.02']);
    ok(M.contractValidate(Object.assign(clone(r), { kind: 'quest' })).length > 0, 'the validator refuses an unknown kind');
    const r2 = clone(r); r2.stages[0].subs[0].to = 'atlantis';
    ok(M.contractValidate(r2).length > 0, 'the validator refuses an unknown field');
    const r3 = clone(A['clients.02']); r3.stages[0].subs[0].crit.push({ k: 'wingPosition', op: '==', v: 'high' });
    ok(M.contractValidate(r3).length > 0, 'the validator refuses an unknown criterion kind');
    const r4 = clone(A['clients.02']); r4.stages[0].subs[0].crit[0].v = 5;
    ok(M.contractValidate(r4).length > 0, 'the validator refuses a criterion outside its band');
    ok(M.contractValidate(Object.assign(clone(r), { title: 'ct.nope' })).length > 0, 'the validator refuses a dangling text key');
    ok(M.contractValidate(Object.assign(clone(r), { unlock: { stage: 'moon:1' } })).length > 0, 'the validator refuses an unknown track');
    const r5 = clone(r); r5.stages[0].subs[0].when = { by: 'friday' };
    ok(M.contractValidate(r5).length > 0, 'the validator refuses a deadline (GQ17)');
    const r6 = clone(A['minedock.02']); r6.stages[0].subs[0].crit = [{ k: 'seats', op: '>=', v: 2 }];
    ok(M.contractValidate(r6).length > 0, 'the validator refuses criteria outside a build contract');
  }
  for (const k of Object.keys(T)) ok(typeof T[k].t === 'string' && T[k].t.length > 0 && T[k].draft === true, 'text ' + k + ' is draft English');
  for (const p of Object.keys(M.CONTRACT_TRACKS)) for (const k of M.CONTRACT_TRACKS[p].stages) ok(M.contractTextOk(k), 'track key ' + k + ' resolves');
  ok(M.CONTRACT_TRACKS.minedock.max === 4, 'minedock: two projects (the headframe, then the pier), two stages each');

  // ==== THE WORLD ============================================================
  const FW = M.contractFieldsOf(RUNWAYS);
  ok(eq(Object.keys(F).sort(), Object.keys(FW).sort()) && Object.keys(FW).every(k => eq(F[k], FW[k])), 'CONTRACT_FIELDS is Jolene\'s record (8 runways through contractFieldsOf)');
  ok(Object.keys(F).length === 8, 'the 8 runways');
  for (const rw of RUNWAYS) for (const g of ['wheels', 'floats', 'amphibian', 'skis'])
    ok(M.contractGearOk(g, F[rw.id]) === CORE.stripAllows(g, rw).ok, 'the gear rule is stripAllows: ' + g + ' at ' + rw.id);
  for (const k of Object.keys(DS)) {
    const D = DS[k], X = MEASURED[k];
    ok(X && D.gear === X.gear && D.seats === X.seats && D.bagKg === X.bagKg && D.power === X.power, k + ': gear, seats, baggage, power are the build\'s');
    for (const n of ['massKg', 'emptyKg', 'toM', 'cruiseKmh', 'rangeKm', 'spanM', 'cost', 'tankL'])
      ok(X && Math.abs(D[n] - X[n]) <= 0.03 * Math.abs(X[n]), k + '.' + n + ' ' + D[n] + ' is the certificate\'s ' + (X && X[n] && X[n].toFixed(1)));
  }
  ok(eq(Object.keys(DS).sort(), ['c172', 'c172f', 'cub', 'jodel', 'twinf']), 'the five validated designs (Cub, Jodel, C172, C172 floats, the twin on floats)');

  // ==== THE PHYSICAL ROWS ====================================================
  for (const id of ids) {
    const r = A[id];
    r.stages.forEach((st, i) => {
      const fly = st.subs.filter(s => s.do !== 'deliver' && s.do !== 'accept');
      if (fly.length) ok(M.contractDoers(fly).length > 0, id + ' stage ' + i + ' is flyable by a validated design');
      for (const s of st.subs.filter(s => s.do === 'deliver')) ok(['wheels', 'floats'].some(g => M.contractGearOk(g, F[s.to])), id + ': its delivery field takes some gear');
    });
  }
  // the physical verdicts, case by case (the certificate's numbers against the job's): each rule has a row
  {
    const carry = (from, to, kg, pax, bulk) => [{ do: 'carry', from, to, load: Object.assign({ kg, pax }, bulk ? { bulk } : {}) }];
    const CASES = [
      ['twinf', carry('SEA', 'mk_sea', 15, 0), false, 'the twin\'s cabin takes no cargo'],
      ['twinf', [{ do: 'survey', from: 'SEA', at: 'mk_sea' }], true, 'the twin flies a survey off the water'],
      ['cub', carry('HOME', 'w3', 120, 0), false, 'the Cub\'s cabin takes 90 kg, not 120'],
      ['cub', carry('HOME', 'w3', 0, 2), false, 'the Cub has one seat beside the pilot'],
      ['cub', carry('HOME', 'mn_strip', 0, 1), true, 'the Cub gets one passenger out of the mine street'],
      ['jodel', carry('HOME', 'mn_strip', 0, 1), false, 'the Jodel does not, with one aboard (the take-off run)'],
      ['c172', carry('HOME', 'mn_strip', 0, 2), true, 'the C172 takes two into the mine street'],
      ['c172', carry('HOME', 'mn_strip', 0, 3), false, 'not three (the take-off run)'],
      ['cub', carry('HOME', 'w3', 50, 0, 'canoe'), false, 'a bulk load needs a cleared four-seat cabin'],
      ['c172', carry('HOME', 'w3', 50, 0, 'canoe'), true, 'the C172 takes the canoe'],
      ['c172f', carry('HOME', 'w3', 10, 0), false, 'floats do not land on a runway'],
      ['cub', carry('SEA', 'mk_sea', 10, 0), false, 'wheels do not land on water'],
      ['c172f', carry('SEA', 'mk_sea', 0, 1), true, 'the C172 on floats carries one off the water'],
      ['c172f', carry('SEA', 'mk_sea', 0, 3), false, 'not three (the lane is 1500 m)'],
      ['cub', [{ do: 'land', to: 'nv_strip' }], false, 'no validated design uses East Point (150 m)'],
    ];
    for (const [k, subs, want, label] of CASES) ok(M.contractCanDo(DS[k], subs).ok === want, 'physical: ' + label);
    ok(!M.contractDoers([{ do: 'land', to: 'nv_strip' }]).length, 'physical: East Point is a build contract\'s, not a job\'s');
  }
  // a sample of the generator: seeds x providers x epochs x reputations
  const SEEDS = Array.from({ length: 24 }, (_, i) => 'seed' + i).concat([0, 1, 42, 'jolene']);
  const JOBS = [];
  let holes = 0;
  for (const s of SEEDS) for (const p of Object.keys(PROV)) for (const done of [0, 3, 6, 9]) for (const rep of [0, 2.5, 5]) {
    const L = M.contractJobs(s, p, done, { rep });
    if (L.length !== M.CONTRACT_GEN.perProvider) holes++;
    for (const j of L) JOBS.push(j);
  }
  ok(holes === 0, 'every provider offers its full job count in every sample (' + holes + ' short)');
  let undo = 0, invalid = 0, slots = 0, keys = 0;
  for (const j of JOBS) {
    if (!M.contractDoers(M.contractSubsOf(j)).length) undo++;
    if (M.contractValidate(j).length) invalid++;
    const V = M.contractVars(j);
    for (const k of [j.title, j.brief]) { if (!M.contractTextOk(k)) keys++; if (/\{\w+\}/.test(M.contractText(k, V))) slots++; }
    if (!M.contractTextOk(j.goods)) keys++;
  }
  ok(JOBS.length > 1000, 'the sample holds ' + JOBS.length + ' jobs');
  ok(undo === 0, 'every generated job is flyable by a validated design (' + undo + ' not)');
  ok(invalid === 0, 'every generated job validates (' + invalid + ' not)');
  ok(keys === 0, 'every generated job\'s text keys resolve (' + keys + ' not)');
  ok(slots === 0, 'every generated job\'s slots are filled (' + slots + ' left)');
  // az: every class has a doer; no design does every class (classes it can do NO job of)
  const CL = Object.keys(M.CONTRACT_JOB_CLASSES);
  const byClass = {};
  for (const c of CL) byClass[c] = [];
  for (const j of JOBS) for (const c of M.contractClasses(j)) byClass[c].push(j);
  for (const c of CL) {
    ok(byClass[c].length > 0, 'job class ' + c + ' is generated');
    ok(byClass[c].some(j => M.contractDoers(M.contractSubsOf(j)).length), 'job class ' + c + ' has a validated design that can physically do it');
  }
  for (const k of Object.keys(DS)) {
    const row = {};
    for (const c of CL) row[c] = byClass[c].filter(j => M.contractCanDo(DS[k], M.contractSubsOf(j)).ok).length;
    TABLE.push([k, row]);
    ok(CL.some(c => row[c] === 0), 'az: ' + k + ' cannot do every job class (it does ' + CL.filter(c => row[c] > 0).join(', ') + ')');
    ok(CL.some(c => row[c] > 0), k + ' can do some job class');
  }

  // ==== THE PAY ==============================================================
  for (const j of JOBS.slice(0, 400)) {
    const p0 = M.contractPay(j);
    const dressed = Object.assign(clone(j), { airframe: 'c172', design: 'twinf', gear: 'floats', slot: 'big', aero: DS.c172 });
    ok(eq(M.contractPay(dressed), p0), j.id + ': the pay is the job\'s, not the aeroplane\'s');
    ok(p0.total === j.pay.total && p0.total > 0, j.id + ': a positive pay, as offered');
  }
  {
    // a short / water / altiport job pays its surface; a longer leg pays more; a heavier load pays more
    const job = (from, to, load) => M.contractNormalise({ id: 'x', provider: 'field', kind: 'job', title: 'job.field.mail.title', brief: 'job.field.mail.brief',
                                                         stages: [{ subs: [{ do: 'carry', from, to, load }] }], rep: { provider: 'field', gain: 0 } });
    const pay = j => M.contractPay(j).total;
    ok(pay(job('HOME', 'mn_strip', { kg: 20, pax: 0 })) > pay(job('HOME', 'w3', { kg: 20, pax: 0 })), 'a longer leg pays more');
    ok(pay(job('HOME', 'w3', { kg: 80, pax: 0 })) > pay(job('HOME', 'w3', { kg: 20, pax: 0 })), 'a heavier load pays more');
    ok(M.contractPay(job('SEA', 'mk_sea', { kg: 20, pax: 0 })).surface > 0 && M.contractPay(job('HOME', 'tw_ski', { kg: 20, pax: 0 })).surface > 0
       && M.contractPay(job('HOME', 'w2', { kg: 20, pax: 0 })).surface === 0, 'the surface bonus: water and the altiport pay it, the paved field does not');
  }

  // ==== THE GENERATOR ========================================================
  for (const s of ['a', 'b', 7]) for (const p of Object.keys(PROV)) {
    ok(eq(M.contractJobs(s, p, 4, { rep: 1 }), M.contractJobs(s, p, 4, { rep: 1 })), 'deterministic: ' + s + '/' + p);
    for (const j of M.contractJobs(s, p, 4, { rep: 1 })) ok(eq(M.contractJobById(s, j.id, { rep: 1 }), j), j.id + ': regenerated from its id');
  }
  {
    const P = Object.keys(PROV), fwd = {}, rev = {}, mix = {};
    for (const p of P) fwd[p] = M.contractJobs('ord', p, 5, { rep: 2 });
    for (const p of P.slice().reverse()) rev[p] = M.contractJobs('ord', p, 5, { rep: 2 });
    for (const p of P) { M.contractJobs('noise', P[0], 1); mix[p] = M.contractJobs('ord', p, 5, { rep: 2 }); M.contractJobs('noise', p, 7); }
    ok(P.every(p => eq(fwd[p], rev[p]) && eq(fwd[p], mix[p])), 'order-independent: any provider order, any interleaving');
    let d1 = M.careerNew({ seed: 'perm' }), d2 = clone(d1);
    const pv = d2.career.providers; d2.career.providers = {};
    for (const k of Object.keys(pv).reverse()) d2.career.providers[k] = pv[k];
    ok(eq(M.careerOfferIds(d1), M.careerOfferIds(d2)), 'order-independent: the career\'s key order does not move the offers');
    ok(!eq(M.contractJobs('s-one', 'minedock', 0).map(j => j.stages), M.contractJobs('s-two', 'minedock', 0).map(j => j.stages))
       || !eq(M.contractJobs('s-one', 'clients', 0).map(j => j.stages), M.contractJobs('s-two', 'clients', 0).map(j => j.stages)), 'the seed moves the jobs');
    const N = M.CONTRACT_GEN.refreshEvery;
    ok(eq(M.contractJobs('r', 'field', 0), M.contractJobs('r', 'field', N - 1)), 'the offers hold until ' + N + ' contracts are done');
    ok(!eq(M.contractJobs('r', 'field', 0).map(j => j.id), M.contractJobs('r', 'field', N).map(j => j.id)), 'the offers refresh after ' + N + ' completed contracts');
  }

  // ==== THE CAREER DOCUMENT ==================================================
  const D0 = M.careerNew({ seed: 'g2240' });
  ok(D0.what === 'flydiy-player' && D0.v === CORE.PLAYER_V && D0.mode === 'career', 'a career is a player document in mode career');
  ok(D0.wallet === 60000 && M.CAREER_GRANT === 60000, 'GQ23: the grant is 60 000');
  ok(D0.ledger.length === 1 && D0.ledger[0].k === 'grant' && D0.ledger[0].amt === -60000, 'the grant is a ledger line (income)');
  ok(D0.career.voucher && D0.career.voucher.model === 'cub' && D0.career.voucher.kind === 'maker' && D0.career.voucher.used === false, 'GQ23: a Cub voucher, unspent');
  ok(eq(D0.career.tracks, { field: 0, minedock: 0, resort: 0, survey: 0, clients: 0 }), 'every track starts at 0');
  ok(Object.keys(D0.career.providers).length === 5 && Object.values(D0.career.providers).every(p => p.rep === 0 && p.arc === 0), 'five providers at 0 reputation');
  ok(eq(Object.keys(D0.career.contracts).sort(), ['accepted', 'done', 'live', 'offered', 'tracked']), 'contracts: offered / accepted / tracked / done (+ live progress)');
  ok(['pilots', 'roster', 'market', 'airframes', 'seed', 'started'].every(k => k in D0.career), 'the career block carries pilots, roster, market, airframes, seed, started');
  ok(M.careerKey('main') === 'flydiy.career.main', 'the key is flydiy.career.<id>');
  ok(eq(M.careerNormalise(clone(D0)), D0), 'careerNormalise is a fixpoint');
  ok(eq(M.careerNormalise(JSON.parse(J(D0))), D0), 'a career round-trips through JSON');
  ok(eq(CORE.playerNormalise(CORE.playerMigrate(clone(D0))), D0), 'the player normaliser keeps a career whole (PLAYER compat)');
  ok(M.careerNormalise(Object.assign(clone(D0), { career: Object.assign(clone(D0.career), { future: 7 }) })).career.future === 7, 'an unknown career field rides along');
  { const J0 = M.careerNormalise('junk'); ok(J0.mode === 'career' && J0.career && Array.isArray(J0.career.contracts.done), 'junk normalises to a career'); }
  ok(D0.career.contracts.offered.length >= 5 + 5 * M.CONTRACT_GEN.perProvider, 'every provider offers from day one (every tab open)');
  for (const p of Object.keys(PROV)) ok(D0.career.contracts.offered.includes(PROV[p].arc[0].id), p + ': its first arc contract is offered');
  ok(!D0.career.contracts.offered.includes('minedock.b1'), 'a build that needs reputation waits for it');

  // ==== ACCEPTANCE ===========================================================
  const accept = (d, id) => { const r = M.careerAccept(d, id); ok(r.ok, 'accept ' + id + (r.ok ? '' : ': ' + r.why)); return r.doc; };
  const stop = (aero, o) => Object.assign({ how: 'stopped', aero, load: { kg: 0, pax: 0 }, row: { from: null, to: aero, t: 600 } }, o || {});
  {
    // refusals change nothing
    let r = M.careerAccept(D0, 'nope'); refused(r, clone(D0), D0, 'accepting what does not exist');
    r = M.careerAccept(D0, 'field.02'); refused(r, clone(D0), D0, 'accepting an arc contract before its turn');
    r = M.careerAccept(D0, 'minedock.b1'); refused(r, clone(D0), D0, 'accepting a build before its reputation');
    r = M.careerTrack(D0, 'field.01'); refused(r, clone(D0), D0, 'tracking what is not accepted');
    r = M.contractOnStop(D0, 'field.01', stop('w3')); refused(r, clone(D0), D0, 'a stop for a contract not accepted');
  }
  {
    // a job: a carry, right field + load = advance; every wrong = untouched
    const job = D0.career.contracts.offered.map(id => M.careerContract(D0, id)).find(r => r.kind === 'job' && r.stages[0].subs[0].do === 'carry' && !r.stages[0].subs[0].when);
    ok(!!job, 'a carry job is on offer');
    const s = job.stages[0].subs[0];
    let d = accept(D0, job.id);
    ok(d.career.contracts.tracked === job.id, 'the first accepted contract is tracked');
    const before = clone(d);
    const other = Object.keys(F).find(k => k !== s.to && k !== s.from);
    refused(M.contractOnStop(d, job.id, stop(other, { load: clone(s.load), row: { from: s.from, to: other, t: 500 } })), before, d, 'the wrong field');
    refused(M.contractOnStop(d, job.id, stop(s.to, { load: { kg: 0, pax: 0 }, row: { from: s.from, to: s.to, t: 500 } })), before, d, 'the right field, no load');
    refused(M.contractOnStop(d, job.id, stop(s.to, { load: clone(s.load), row: { from: s.from, to: s.to }, wrecked: true })), before, d, 'a wreck');
    refused(M.contractOnStop(d, job.id, stop(null, { load: clone(s.load), row: { from: s.from } })), before, d, 'off an aerodrome');
    refused(M.contractOnStop(d, job.id, stop(s.to, { load: clone(s.load), row: { from: other, to: s.to } })), before, d, 'the load never taken on at the origin');
    const r = M.contractOnStop(d, job.id, stop(s.to, { load: clone(s.load), row: { from: s.from, to: s.to, t: 500 } }));
    ok(r.ok && r.doc !== d && eq(d, before), 'the right field and load advance a clone (the input kept)');
    const e = r.doc;
    ok(e.career.contracts.done.length === 1 && e.career.contracts.done[0].id === job.id && e.career.contracts.done[0].pay === job.pay.total, 'the job is done, at its pay');
    ok(e.wallet === d.wallet + job.pay.total, 'paid net into the wallet (G-COST)');
    ok(e.career.providers[job.provider].rep > d.career.providers[job.provider].rep, 'the provider\'s reputation grows (GQ28)');
    ok(Object.keys(PROV).filter(p => p !== job.provider).every(p => e.career.providers[p].rep === d.career.providers[p].rep), 'only that provider\'s (GQ28: per provider)');
    ok(!e.career.contracts.accepted.includes(job.id) && e.career.contracts.tracked === null && !e.career.contracts.offered.includes(job.id), 'out of the lists, untracked, not offered again');
    ok(r.events.some(x => x.k === 'done' && x.id === job.id), 'a done event');
    // a pick-up, then a delivery from elsewhere (a chained leg)
    let d2 = accept(D0, job.id);
    let r2 = M.contractOnStop(d2, job.id, stop(s.from, { load: clone(s.load), row: { from: other, to: s.from } }));
    ok(r2.ok && r2.events.some(x => x.k === 'picked') && r2.doc.career.contracts.live[job.id].picked[0] === true, 'loaded at the origin: picked up');
    r2 = M.contractOnStop(r2.doc, job.id, stop(s.to, { load: clone(s.load), row: { from: other, to: s.to } }));
    ok(r2.ok && r2.doc.career.contracts.done.some(x => x.id === job.id), 'picked up, then delivered after a chained leg');
    // a ledger with no running cost in it
    ok(r2.doc.ledger.every(l => ['grant', 'contract'].includes(l.k)), 'no running costs in the ledger (G-COST): ' + r2.doc.ledger.map(l => l.k).join(','));
    // the pay does not see the aeroplane that flew it
    const r3 = M.contractOnStop(d, job.id, stop(s.to, { load: clone(s.load), row: { from: s.from, to: s.to, t: 500 }, slot: 'a big twin', gear: 'floats' }));
    ok(r3.ok && r3.doc.wallet === e.wallet, 'the same job pays the same whatever flew it');
  }
  {
    // "before dusk"
    const rec = M.contractNormalise({ id: 'job:field:0:0', provider: 'field', kind: 'job', title: 'job.field.mail.title', brief: 'job.field.mail.brief',
      stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'w3', load: { kg: 10, pax: 0 }, when: { before: 'dusk' } }] }], pay: { base: 0, total: 400 }, rep: { provider: 'field', gain: 0.1 } });
    let d = clone(D0); d.career.contracts.accepted.push(rec.id); d.career.contracts.live[rec.id] = { stage: 0, subs: [false], picked: [false], got: {} };
    const before = clone(d);
    refused(M.contractOnStop(d, rec, stop('w3', { load: { kg: 10, pax: 0 }, row: { from: 'HOME' }, hour: 21 })), before, d, 'after dusk');
    ok(M.contractOnStop(d, rec, stop('w3', { load: { kg: 10, pax: 0 }, row: { from: 'HOME' }, hour: 14 })).ok, 'before dusk: done');
  }
  {
    // stages in order (field.01: w3, then HOME); the arc moves on
    let d = accept(D0, 'field.01');
    const b = clone(d);
    refused(M.contractOnStop(d, 'field.01', stop('HOME', { row: { from: 'w3' } })), b, d, 'stage 2 before stage 1');
    let r = M.contractOnStop(d, 'field.01', stop('w3', { row: { from: 'HOME' } }));
    ok(r.ok && r.doc.career.contracts.live['field.01'].stage === 1 && !r.doc.career.contracts.done.length, 'stage 1 done, the contract open');
    r = M.contractOnStop(r.doc, 'field.01', stop('HOME', { row: { from: 'w3' } }));
    ok(r.ok && r.doc.career.contracts.done.some(x => x.id === 'field.01') && r.doc.career.providers.field.arc === 1, 'stage 2: done, the arc advanced');
    ok(r.doc.career.contracts.offered.includes('field.02') && !D0.career.contracts.offered.includes('field.02'), 'the arc\'s next contract is offered');
    // subs in any order (field.03: tw_ski first, then w3) and the stage unlock
    let d3 = clone(r.doc);
    d3.career.contracts.done.push({ id: 'field.02', at: 0, pay: 0 });
    M.careerRefresh(d3);
    d3 = accept(d3, 'field.03');
    let q = M.contractOnStop(d3, 'field.03', stop('tw_ski', { load: { kg: 25, pax: 0 }, row: { from: 'HOME' } }));
    ok(q.ok && !q.doc.career.contracts.done.some(x => x.id === 'field.03'), 'the second sub first: done, the stage open');
    q = M.contractOnStop(q.doc, 'field.03', stop('w3', { load: { kg: 25, pax: 0 }, row: { from: 'HOME' } }));
    ok(q.ok && q.doc.career.contracts.done.some(x => x.id === 'field.03'), 'the first sub second: the contract done (any order)');
    ok(q.doc.career.tracks.field === 1 && q.events.some(x => x.k === 'done' && x.unlock === 'field:1'), 'the stage unlock: field:1 (§11)');
  }
  {
    // a survey by overflight
    let d = accept(D0, 'minedock.01');
    const b = clone(d);
    refused(M.contractOnStop(d, 'minedock.01', stop('HOME', { row: { from: 'HOME' }, overflew: ['w3'] })), b, d, 'the site not overflown');
    const r = M.contractOnStop(d, 'minedock.01', stop('HOME', { row: { from: 'HOME' }, overflew: ['w3', 'mn_strip'] }));
    ok(r.ok && r.doc.career.contracts.live['minedock.01'].stage === 1, 'overflown: the survey stage done');
    const r2 = M.contractOnStop(r.doc, 'minedock.01', stop('HOME', { row: { from: 'HOME' } }));
    ok(r2.ok && r2.doc.career.providers.minedock.rep === A['minedock.01'].rep.gain
       && Object.keys(PROV).filter(p => p !== 'minedock').every(p => r2.doc.career.providers[p].rep === 0), 'the mine & dock\'s reputation, and nobody else\'s (GQ28)');
  }
  {
    // a build contract: never judged here
    let d = clone(D0);
    d.career.providers.clients.rep = 2; d.career.contracts.done.push({ id: 'clients.01', at: 0, pay: 0 });
    M.careerRefresh(d);
    d = accept(d, 'clients.02');
    const b = clone(d);
    const st = stop('HOME', { row: { from: 'w3' }, slot: 'tiny' });
    const r0 = M.contractOnStop(d, 'clients.02', st);
    refused(r0, b, d, 'a delivery with no verdict hook');
    ok(r0.events && r0.events.some(x => x.k === 'pending'), 'no hook = pending');
    refused(M.contractOnStop(d, 'clients.02', st, { acceptVerdict: () => ({ ok: null, why: 'the leg is not flown' }) }), b, d, 'a pending verdict');
    refused(M.contractOnStop(d, 'clients.02', st, { acceptVerdict: () => ({ ok: false, why: 'empty mass 320 kg' }) }), b, d, 'a refused delivery');
    refused(M.contractOnStop(d, 'clients.02', stop('w3', { row: { from: 'HOME' } }), { acceptVerdict: () => ({ ok: true }) }), b, d, 'a delivery at the wrong field');
    let seen = null;
    const r = M.contractOnStop(d, 'clients.02', st, { acceptVerdict: (c, s, x) => { seen = [c.id, s.do, x.slot]; return { ok: true, got: { emptyKg: 260 } }; } });
    ok(eq(seen, ['clients.02', 'deliver', 'tiny']), 'the hook is handed the contract, the sub and the stop');
    ok(r.ok && r.doc.career.contracts.done.some(x => x.id === 'clients.02' && x.pay === Math.round(A['clients.02'].pay.base * 1.1 / 10) * 10), 'delivered, with the margin bonus (260 kg beats 300 kg by 10 %)');
    ok(r.doc.career.contracts.offered.includes('clients.02+1') && r.events.some(x => x.k === 'done' && x.followUp === 'clients.02+1'), 'GQ26: the happy client offers a follow-up');
    const r2 = M.contractOnStop(d, 'clients.02', st, { acceptVerdict: () => ({ ok: true, got: { emptyKg: 295 } }) });
    ok(r2.ok && r2.doc.career.contracts.done.find(x => x.id === 'clients.02').pay === A['clients.02'].pay.base, 'no margin, no bonus');
  }
  {
    // a challenge: medals by the logbook's time
    let d = clone(D0);
    d.career.contracts.done.push({ id: 'clients.01', at: 0, pay: 0 }, { id: 'clients.02', at: 0, pay: 0 });
    M.careerRefresh(d);
    d = accept(d, 'clients.03');
    const b = clone(d);
    refused(M.contractOnStop(d, 'clients.03', stop('HOME', { row: { from: 'tw_ski', t: 900 } })), b, d, 'too slow for a medal');
    refused(M.contractOnStop(d, 'clients.03', stop('HOME', { row: { from: 'w3', t: 200 } })), b, d, 'the challenge from the wrong field');
    const g = M.contractOnStop(d, 'clients.03', stop('HOME', { row: { from: 'tw_ski', t: 280 } }));
    ok(g.ok && g.doc.career.contracts.done.find(x => x.id === 'clients.03').medal === 'gold'
       && g.doc.career.contracts.done.find(x => x.id === 'clients.03').pay === Math.round(M.contractStoryBase(A['clients.03'])) * 2, 'gold, paid double');   // G2260: the story factor (ECONOMY's CONTRACT_PAY.story)
    const s = M.contractOnStop(d, 'clients.03', stop('HOME', { row: { from: 'tw_ski', t: 500 } }));
    ok(s.ok && s.doc.career.contracts.done.find(x => x.id === 'clients.03').medal === 'bronze' && s.doc.career.tracks.clients === 1, 'bronze, the club house unlocked');
  }
  {
    // one stop, many contracts: the tracked one first, every one that moves
    let d = accept(D0, 'field.01');
    d = accept(d, 'resort.01');
    const r = M.careerOnStop(d, stop('w3', { row: { from: 'HOME' } }));
    ok(r.ok && r.doc.career.contracts.live['field.01'].stage === 1 && r.untouched['resort.01'], 'careerOnStop: the one that moved moved, the other says why');
    const b = clone(d);
    refused(M.careerOnStop(d, stop('mk_sea', { row: { from: 'SEA' } })), b, d, 'a stop that moves nothing');
  }

  {
    // an accepted job is the job as offered, whatever the reputation does next
    let d = clone(D0);
    const jid = d.career.contracts.offered.find(id => /^job:minedock:/.test(id));
    d = accept(d, jid);
    const rec0 = clone(M.careerContract(d, jid));
    d.career.providers.minedock.rep = 5;
    ok(eq(M.careerContract(d, jid), rec0) && eq(M.careerContract(M.careerNormalise(JSON.parse(J(d))), jid), rec0), 'an accepted job keeps its load when the reputation moves (and through a save)');
  }
  {
    // THE JOURNEY: every provider's arc, in order, on its own reputation alone - each contract offered in its turn,
    // accepted, flown stage by stage (stops synthesised from its subs; ACCEPT's hook approving), and the track at
    // its last stage at the end
    const hooks = { acceptVerdict: () => ({ ok: true, got: {} }) };
    const stopsFor = sub => {
      if (sub.do === 'carry') return [stop(sub.from, { load: clone(sub.load), row: { from: 'HOME' } }), stop(sub.to, { load: clone(sub.load), row: { from: sub.from } })];
      if (sub.do === 'land') return [stop(sub.to, { row: { from: 'HOME' } })];
      if (sub.do === 'fly') return [stop(sub.to, { row: { from: sub.from, t: sub.medals ? Math.min(...sub.medals.map(m => m.le)) - 1 : 600 } })];
      if (sub.do === 'survey') return [stop(sub.from, { row: { from: sub.from }, overflew: [sub.at] })];
      return [stop(sub.to, { row: { from: 'HOME' } })];
    };
    for (const p of Object.keys(PROV)) {
      let d = M.careerNew({ seed: 'journey-' + p }), good = true;
      // (G2320) an arc contract the certificate cannot answer is HELD OUT: the journey ends before it, never offered
      const held = PROV[p].arc.findIndex(r => !M.contractCertifiable(A[r.id]));
      const flown = held < 0 ? PROV[p].arc : PROV[p].arc.slice(0, held);
      for (const r of flown) {
        if (!d.career.contracts.offered.includes(r.id)) { good = ok(false, p + ' journey: ' + r.id + ' offered in its turn'); break; }
        d = accept(d, r.id);
        const rec = A[r.id];
        rec.stages.forEach(st => st.subs.forEach(sub => { for (const x of stopsFor(sub)) { const q = M.contractOnStop(d, r.id, x, hooks); if (q.ok) d = q.doc; } }));
        if (!d.career.contracts.done.some(x => x.id === r.id)) { good = ok(false, p + ' journey: ' + r.id + ' completes'); break; }
      }
      if (good && held >= 0) {
        const H = PROV[p].arc[held].id, lastUnlock = Math.max(0, ...flown.filter(r => A[r.id].unlock).map(r => +A[r.id].unlock.stage.split(':')[1]));
        ok(!M.careerOfferIds(d).includes(H) && !M.careerAccept(d, H).ok, p + ' journey: ' + H + ' (beyond the normal-category certificate) is held out - never offered, never accepted');
        ok(d.career.tracks[p] === lastUnlock && d.career.providers[p].arc === flown.length, p + ' journey: the arc up to the held-out contract, the track at its last unlock (' + lastUnlock + ')');
      } else if (good) ok(d.career.tracks[p] === M.CONTRACT_TRACKS[p].max && d.career.providers[p].arc === PROV[p].arc.length, p + ' journey: the whole arc, the track built to its last stage');
      if (good) {
        ok(d.wallet === 60000 + d.career.contracts.done.reduce((a, x) => a + x.pay, 0) && d.ledger.every(l => ['grant', 'contract'].includes(l.k)), p + ' journey: the wallet is the grant + the pay, nothing else charged');
      }
    }
  }

  // ==== FOLLOW-UPS (GQ26 / GQ31) =============================================
  for (const id of ids.filter(i => A[i].kind === 'build')) {
    let r = A[id], n = 0;
    const seenK = new Set();
    for (;;) {
      const f = M.contractFollowUp(r);
      if (!f) break;
      n++;
      const diff = M.contractCritDiff(r, f);
      ok(diff.length === 1, f.id + ': exactly one criterion changed (' + diff.map(x => x.k).join(',') + ')');
      const k = diff[0] && diff[0].k;
      ok(k && !seenK.has(k), f.id + ': never repeats a change (' + k + ')');
      seenK.add(k);
      ok(f.pay.base === Math.round(r.pay.base * 1.15 / 10) * 10, f.id + ': pays +15 % (GQ31)');
      ok(!M.contractValidate(f, { ids: ids.concat([r.id]) }).length, f.id + ' validates: ' + M.contractValidate(f, { ids: ids.concat([r.id]) }).join('; '));
      ok(eq(M.contractFollowById(f.id), f), f.id + ': regenerated from its id');
      ok(!f.unlock && (f.needs.after || []).includes(r.id), f.id + ': no second unlock, needs its predecessor');
      if (n > 10) break;
      r = f;
    }
    ok(n >= 1, id + ': offers a follow-up');
    for (const c of M.contractCrit(A[id])) ok(!/\{\w+\}|\[/.test(M.contractCritWords(c)), id + ': ' + c.k + ' reads as words (' + M.contractCritWords(c) + ')');
    const f1 = M.contractFollowUp(A[id]);
    ok(f1 && M.contractFollowLine(f1) && !/\{\w+\}|\[/.test(M.contractFollowLine(f1)), id + ': its follow-up says what changed (' + (f1 && M.contractFollowLine(f1)) + ')');
    ok(n <= M.CONTRACT_FOLLOW_MAX, id + ': the chain stops at ' + M.CONTRACT_FOLLOW_MAX);
  }

  // ==== (g1) NO CONFIGURATION ================================================
  for (const w of ['high wing', 'low wing', 'tricycle', 'taildragger', 'rotax', 'lycoming', 'biplane', 'cessna', 'piper', 'cub', 'jodel'])
    ok(M.CONTRACT_CONFIG_WORDS.includes(w), 'the word list holds ' + w);
  for (const id of ids.filter(i => A[i].kind === 'build')) {
    const r = A[id];
    const words = [J(M.contractCrit(r)), M.contractText(r.title), M.contractText(r.brief), M.contractText(id + '.follow' ? 'ct.' + id + '.follow' : '')];
    for (const c of M.contractCrit(r)) words.push(M.contractText('crit.' + c.k, { v: c.v, at: '' }));
    for (const s of words) ok(!M.contractConfigWord(s), id + ': names no configuration (' + M.contractConfigWord(s) + ')');
  }
  ok(M.contractConfigWord('I want a High-Wing with a Rotax') !== '' && M.contractConfigWord('four of us, fast') === '', 'the word check reads whole words, any case');

  // ==== THE HELD-OUT CONTRACT (G2320, §R's follow-up to ACCEPT) ================
  {
    const ult = M.contractCertUlt();
    ok(ult === 5.7, 'the certificate\'s ultimate is the normal category\'s 5.7 g (65_ GEN_LOAD_ULT)', ult);
    const out = ids.filter(i => !M.contractCertifiable(A[i]));
    ok(out.length >= 1 && out.every(i => M.contractCrit(A[i]).some(c => c.k === 'ultimateG' && c.v > ult)), 'held out: exactly the contracts asking an ultimate past ' + ult + ' g (' + out.join(', ') + ')');
    const at = v => ({ id: 'x', stages: [{ subs: [{ do: 'deliver', to: 'HOME', crit: [{ k: 'ultimateG', op: '>=', v }] }] }] });
    ok(M.contractCertifiable(at(5.7)) && !M.contractCertifiable(at(5.8)) && M.contractCertifiable({ stages: [] }), 'certifiable: an ultimate of 5.7 g yes, 5.8 g no, no criterion yes');
    // every offer a career can reach is certifiable: the clients' arc driven to the aerobatic box's turn
    const d = M.careerNew({ seed: 'held' });
    for (const id of ['clients.01', 'clients.02', 'clients.03', 'clients.04']) d.career.contracts.done.push({ id, at: 0, pay: 0 });
    d.career.providers.clients.rep = 5;
    const offers = M.careerOfferIds(d);
    ok(offers.every(i => { const r = M.careerContract(d, i); return r && M.contractCertifiable(r); }) && !offers.includes('clients.05'), 'no offer asks past the certificate: clients.05 never offered (its needs met)');
    ok(!M.careerAccept(d, 'clients.05').ok && M.careerAccept(d, 'clients.05').doc === d, 'clients.05 cannot be accepted (the same document back)');
  }

  // ==== THE WIRE (G2320 CAREER-WIRE: 75_career_wire.js) ========================
  {
    const d = M.careerNew({ id: 'dev', seed: 'dev' });
    const R = M.careerMapRecord(d, null, {});
    ok(R.providers.map(p => p.id).join() === Object.keys(PROV).join() && R.providers.every(p => p.name && !/^\[/.test(p.name) && p.short && !/^\[/.test(p.short) && /^#/.test(p.colour)),
       'the map record: the five providers, named, short-named, coloured');
    ok(R.contracts.length === d.career.contracts.offered.length && R.contracts.map(c => c.id).join() === d.career.contracts.offered.join(), 'the map record: a new career\'s offers (' + R.contracts.length + ': every provider\'s first arc contract + 3 jobs)');
    ok(R.contracts.every(c => c.title && c.brief && !/\[|\{/.test(c.title + c.brief)), 'the map record: every title and brief resolved (contractText, slots filled)');
    ok(R.contracts.every(c => c.pay.total === M.contractPay(M.careerContract(d, c.id)).total), 'the map record: the pay is contractPay\'s');
    ok(R.career.wallet === 60000 && R.career.accepted.length === 0 && R.career.tracked === null && R.fleet.length === 0, 'the map record: the wallet, nothing accepted, no fleet yet');
    // accept, track, and a carry job's progress read back
    const job = d.career.contracts.offered.find(i => { const r = M.careerContract(d, i); return /^job:field:/.test(i) && r.stages[0].subs[0].do === 'carry'; });
    const e = accept(d, job);
    const R2 = M.careerMapRecord(e, null, {});
    ok(R2.career.accepted[0] === job && R2.career.tracked === job && R2.contracts[0].id === job && R2.career.live[job].stage === 0, 'the map record: an accepted (tracked) job first, its progress');
    ok(!R2.contracts.slice(1).some(c => c.id === job), 'the map record: an accepted contract is not also an offer');
    // the fleet: the career's airframe row names a validated design -> its certificate; a shakedown reading -> its own; else none
    const f = clone(e);
    f.fleet = { Cub: { aero: 'HOME' }, Mine: { aero: 'HOME' }, Odd: { aero: 'w3' } };
    f.career.airframes = { Cub: { design: 'cub' } };
    const R3 = M.careerMapRecord(f, null, { certs: { Mine: M.CONTRACT_DESIGNS.c172 } });
    const fc = n => R3.fleet.find(x => x.slot === n);
    ok(fc('Cub').cert && fc('Cub').cert.seats === 2 && fc('Cub').cert.payloadKg === 90 && fc('Cub').cert.toRunM === M.CONTRACT_DESIGNS.cub.toM && fc('Cub').cert.ult === 5.7
       && fc('Mine').cert && fc('Mine').cert.seats === 4 && fc('Odd').cert === null, 'the fleet\'s certificates: a design\'s, a shakedown\'s, none ("not read yet")');
    ok(fc('Odd').where.aero === 'w3', 'the fleet: where it stands (playerWhere)');
    // the stop record
    const S = M.careerStopRecord({ how: 'stopped', aero: 'w3', occupants: 2, cargoKg: 34.6, row: { from: 'HOME', to: 'w3', t: 412.4 }, overflew: ['HOME', 'w3'], hour: 11.257 });
    ok(S.aero === 'w3' && S.load.kg === 35 && S.load.pax === 1 && S.row.t === 412 && S.hour === 11.26 && S.overflew.join() === 'HOME,w3' && !S.wrecked, 'the stop record: the field, the load (occupants beyond the pilot + the cargo), the row, the hour');
    ok(M.careerStopRecord({ how: 'over', aero: 'w3' }).aero === null, 'the stop record: an ending that is not a stop delivers nowhere');
    // the stop advances the job; the event lines say so, with the wallet
    const L = M.careerTrackedLoad(e), sub = M.careerContract(e, job).stages[0].subs[0];
    ok(L && L.kg === sub.load.kg && L.pax === sub.load.pax, 'the tracked load: the plate\'s default cargo is the contract\'s');
    const st = M.careerStopRecord({ how: 'stopped', aero: sub.to, occupants: 1 + (sub.load.pax || 0), cargoKg: L.kg, row: { from: sub.from, to: sub.to, t: 600 }, hour: 12 });
    const res = M.careerOnStop(e, st, {});
    const lines = M.careerEventLines(res, e, res.doc);
    ok(res.ok && res.doc.career.contracts.done.some(x => x.id === job) && lines.some(l => l.k === 'done' && /paid/.test(l.text)) && lines.some(l => l.k === 'wallet' && /\+/.test(l.text)), 'a stop delivers the tracked job: done, paid, the card\'s lines (' + lines.map(l => l.text).join(' / ') + ')');
    const no = M.careerOnStop(e, Object.assign({}, st, { aero: 'mk_sea' }), {});
    ok(!no.ok && M.careerEventLines(no, e, no.doc).some(l => l.k === 'none'), 'a stop that moves nothing says why on the card');
    // ACCEPT as the hook
    const crit = [{ k: 'seats', op: '>=', v: 1 }, { k: 'tasKmh', op: '>=', v: 150 }];
    const H = M.careerAcceptHook(c => ({ ok: false, rows: c.map(x => ({ k: x.k, ok: x.k === 'seats', value: x.k === 'seats' ? 2 : null, status: x.k === 'seats' ? 'ok' : 'needs-flight', source: 'no leg' })) }));
    ok(H(null, { crit }, {}).ok === null, 'the hook: a criterion still to fly is pending');
    const H2 = M.careerAcceptHook(c => ({ ok: true, rows: c.map(x => ({ k: x.k, ok: true, value: 170, status: 'ok' })) }));
    ok(H2(null, { crit }, {}).ok === true && H2(null, { crit }, {}).got.tasKmh === 170, 'the hook: every criterion met -> approved, the measured values for the bonus');
    const H3 = M.careerAcceptHook(c => ({ ok: false, rows: c.map(x => ({ k: x.k, ok: false, value: 120, status: 'fail', need: '>= 150' })) }));
    ok(H3(null, { crit }, {}).ok === false && /tasKmh/.test(H3(null, { crit }, {}).why), 'the hook: a criterion failed -> refused, why');
    ok(M.careerAcceptHook(null)(null, { crit }, {}).ok === null, 'the hook: no evidence on the page -> pending');
    // the leg's criteria for the plate
    let b = M.careerNew({ seed: 'leg' });
    b.career.providers.clients.rep = 5;
    b = accept(b, 'clients.b1');
    ok(M.careerLegCrit(b).map(c => c.k).join() === 'enduranceMin', 'the plate: a tracked build contract\'s flown criteria (Fly the acceptance leg)');
    ok(M.careerLegCrit(e).length === 0, 'the plate: a job asks no leg');
    // the overflight: the field radius from the strip's rectangle
    const Wf = { aerodromes: [{ id: 'A', x: 0, z: 0, len: 600, wid: 30, hdg: 0 }, { id: 'B', x: 5000, z: 0, len: 600, wid: 30, hdg: 0 }] };
    const ov = M.careerOverflewAdd(Wf, 300 + 449, 0, []);
    ok(ov.join() === 'A' && M.careerOverflewAdd(Wf, 300 + 451, 0, []).length === 0 && M.careerOverflewAdd(Wf, 5000, 100, ov).join() === 'A,B', 'the overflight: within the field radius of the strip, each once, in order');
  }

  // ==== THE IMPORT (Block 5) =================================================
  {
    const T0 = clone(T);
    const pack = {
      providers: [{ id: 'minedock', name: 'Ridge & Harbour Mining', desc: 'A new name.' }],
      contracts: [{ id: 'minedock.02', title: 'Hard hats in', brief: 'Two engineers, please.', stages: [{ line: '', from: 'HOME', to: 'mn_strip' }], done: 'Done.' }],
      jobs: [{ provider: 'resort', title: '{load} up to {to}', brief: 'From {from}.', load: 'guests' }],
      builds: [{ id: 'clients.b1', brief: 'Twenty litres and an hour.', criteria: ['tank 20 L', 'an hour'], followUp: { brief: 'Again, smaller.', changed: 'a smaller tank' } }],
    };
    const r = M.contractImportPack(pack);
    ok(r.ok && r.text['prov.minedock.name'].t === 'Ridge & Harbour Mining' && r.text['prov.minedock.name'].draft === false, 'a pack imports over the keys');
    ok(r.text['job.resort.guests.title'].t === '{load} up to {to}' && r.text['ct.clients.b1.follow'].t === 'Again, smaller.', 'jobs and follow-ups import by their keys');
    ok(eq(T, T0), 'the table handed in is not changed');
    ok(Object.keys(r.text).length === Object.keys(T).length, 'the import keeps every key');
    ok(!M.contractImportPack({ contracts: [{ id: 'minedock.02', stages: [{ from: 'HOME', to: 'atlantis' }] }] }).ok, 'an unknown airfield is refused');
    ok(!M.contractImportPack({ builds: [{ id: 'clients.b1', brief: 'A high wing, please.' }] }).ok, 'a configuration in a build brief is refused');
    ok(!M.contractImportPack({ builds: [{ id: 'clients.b1', brief: 'ok', criteria: ['a tricycle'] }] }).ok, 'a configuration in a criterion is refused');
    ok(!M.contractImportPack({ jobs: [{ provider: 'resort', title: '{cargo} to {to}' }] }).ok, 'an unknown slot is refused');
    ok(!M.contractImportPack({ contracts: [{ id: 'ghost.01', title: 'x' }] }).ok, 'an unknown contract is refused');
  }

  // ==== PURITY ===============================================================
  for (const k of Object.keys(M.__src)) {
    const s = M.__src[k].replace(/\/\/.*$/gm, '');
    for (const w of ['window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'THREE', 'Math.random', 'Date.now', 'new Date', 'fetch('])
      ok(!new RegExp('\\b' + w.replace(/[.(]/g, m => '\\' + m)).test(s), k + '_: pure (no ' + w + ')');
  }
  return { fails: fails.slice(), checks };
}

const base = run(null);
if (!SELF) {
  if (SHOW || base.fails.length) {
    console.log('DESIGNS x JOB CLASSES (jobs of the class each can physically do, of the sample):');
    for (const [k, row] of TABLE) console.log('  ' + k.padEnd(6) + Object.entries(row).map(([c, v]) => c + ' ' + v).join(' · '));
  }
  for (const f of base.fails) console.log('  - ' + f);
  console.log(base.checks + ' checks');
  console.log('GATE CONTRACTS: ' + (base.fails.length ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
  process.exit(base.fails.length ? 1 : 0);
}

// ---- negative verification: each rule broken in its own source --------------
const sub = (a, b) => s => { if (s.indexOf(a) < 0) throw new Error('selftest anchor gone: ' + a); return s.split(a).join(b); };
const BREAKS = [
  // the record
  ['an arc names a field that does not exist', { s72: sub("{ do: 'carry', from: 'HOME', to: 'mn_strip', load: { kg: 0, pax: 2 } }", "{ do: 'carry', from: 'HOME', to: 'mn_strp', load: { kg: 0, pax: 2 } }") }],
  ['a text key does not resolve', { s72: sub("'ct.field.02.brief': CT_(", "'ct.field.02.brief_': CT_(") }],
  ['a crit kind is dropped from the list', { s73: sub("  rangeKm:      { k: 'rangeKm',", "  rangeKmX:     { k: 'rangeKm',") }],
  ['a crit kind loses static|flown', { s73: sub("tasKmh:       { k: 'tasKmh',       unit: 'km/h',  when: 'flown',", "tasKmh:       { k: 'tasKmh',       unit: 'km/h',  when: 'static',") }],
  ['an arc ends with no stage unlock', { s72: sub("unlock: { stage: 'resort:3' },", '') }],
  ['an arc unlocks another provider\'s track', { s72: sub("unlock: { stage: 'survey:1' },", "unlock: { stage: 'field:1' },") }],
  ['the normaliser drops unknown fields', { s73: sub('  const o = (r && typeof r === \'object\') ? ctClone(r) : {};', '  const o = (r && typeof r === \'object\') ? (({ future, ...x }) => ctClone(x))(r) : {};') }],
  ['the validator lets a deadline through', { s73: sub("if (s.when != null && !(s.when && s.when.before === 'dusk'))", 'if (false)') }],
  // the world
  ['CONTRACT_FIELDS drifts from the record', { s72: sub("len: 380,  surf: 'grass', alti: true", "len: 420,  surf: 'grass', alti: true") }],
  ['wheels may land on water', { s73: sub('  return !ctWet(f);\n}', '  return true;\n}') }],
  ['a validated design\'s numbers drift from its build', { s72: sub('massKg: 476, emptyKg: 354, toM: 156,', 'massKg: 476, emptyKg: 354, toM: 120,') }],
  // the physical rows
  ['an arc stage no validated design can fly', { s72: sub("{ do: 'carry', from: 'HOME', to: 'mn_strip', load: { kg: 120, pax: 0 } }", "{ do: 'carry', from: 'HOME', to: 'mn_strip', load: { kg: 400, pax: 0 } }") }],
  ['the generator skips the physical check', { s73: s => sub('    if (!contractDoers([].concat(...subs), F).length) continue;\n', '')(sub('for (let k = 0; k < 6 && !contractDoers(subs[0], F).length; k++)', 'for (let k = 0; k < 0; k++)')(s)) }],
  ['the physical gates are off (one design does everything)', { s73: s => sub('    if (run > f.len) return no(', '    if (false) return no(')(sub("  if (gear === 'floats') return ctWet(f);", "  if (gear === 'floats') return true;")(s)) }],
  ['the cabin is ignored', { s73: sub("    if (kg > ctCapKg(D)) return no(", '    if (false) return no(') }],
  // the pay
  ['the pay reads the aeroplane', { s73: sub('  const factor = kg / P.kgUnit', '  const factor = (rec.airframe ? 0.5 : 0) + kg / P.kgUnit') }],
  ['a running cost is charged', { s74: sub("  playerCharge(d, -pay, rec.loan ? 'loan' : 'contract', rec.id);", "  playerCharge(d, -pay, rec.loan ? 'loan' : 'contract', rec.id);\n  playerCharge(d, 40, 'fuel', rec.id);") }],
  // the generator
  ['the generator is random', { s73: sub('  let a = contractHash(key);', '  let a = contractHash(key) ^ Math.floor(Math.random() * 1e9);') }],
  ['the generator depends on call order', { s73: s => sub("  const id = 'job:' + providerId + ':' + epoch + ':' + i;\n", "  const id = 'job:' + providerId + ':' + epoch + ':' + i; ctCalls++;\n")(sub('function contractJob(seed, providerId, epoch, i, opts) {', 'let ctCalls = 0;\nfunction contractJob(seed, providerId, epoch, i, opts) {')(sub("const rng = contractRng(seed + '|' + id + '|' + t);", "const rng = contractRng(seed + '|' + id + '|' + t + '|' + (ctCalls % 3));")(s))) }],
  ['the offers never refresh', { s73: sub('return Math.floor(Math.max(0, done || 0) / CONTRACT_GEN.refreshEvery);', 'return 0;') }],
  // acceptance
  ['a stop at the wrong field advances', { s73: sub('    if (at === sub.to) {\n      if (!(prog.picked', '    if (true) {\n      if (!(prog.picked') }],
  ['the load is not checked', { s73: sub("const loadOk = L => (aboard.kg || 0) >= (L.kg || 0)", 'const loadOk = L => true || (aboard.kg || 0) >= (L.kg || 0)') }],
  ['a wreck delivers', { s74: sub("  if (stop.wrecked) return crNo(doc, 'the aeroplane is wrecked: nothing is delivered');", '') }],
  ['a refused stop leaves a mark', { s74: sub("    const out = crNo(doc, r.why);", "    doc.career.contracts.live[id] = Object.assign({}, doc.career.contracts.live[id], { tried: 1 });\n    const out = crNo(doc, r.why);") }],
  ['stages are not in order', { s74: sub('  const st = rec.stages[L.stage];', '  const st = { subs: [].concat(...rec.stages.map(x => x.subs)) };') }],
  ['dusk is ignored', { s73: sub("typeof stop.hour === 'number' && stop.hour >= CONTRACT_DUSK_H)", "typeof stop.hour === 'number' && stop.hour >= 99)") }],
  ['a missing hook passes the build', { s73: sub("if (!H) return { st: 'no', pending: true, why: 'acceptance pending: no verdict yet' };", "if (!H) return { st: 'done', why: '' };") }],
  ['an accepted job changes when the reputation moves', { s74: sub("  if (rec.kind === 'job') D.live[id].rec = rec;", '') }],
  ['an arc needs more reputation than it gives', { s72: sub("needs: { rep: 2, after: ['resort.04'] } }", "needs: { rep: 4, after: ['resort.04'] } }") }],
  ['the stage unlock is not applied', { s74: sub('if (m) { c.tracks[m[1]] = Math.max(c.tracks[m[1]] || 0, +m[2]); unlocked = rec.unlock.stage; }', 'if (m) { unlocked = rec.unlock.stage; }') }],
  ['reputation is not per provider', { s74: sub('const P = c.providers[rec.rep.provider] || (c.providers[rec.rep.provider] = { rep: 0, arc: 0 });', 'const P = c.providers.field;') }],
  ['a challenge ignores its time', { s73: sub('const m = sub.medals.slice().sort((a, b) => a.le - b.le).find(x => t <= x.le);', 'const m = sub.medals[0];') }],
  // follow-ups
  ['a follow-up changes two criteria', { s73: sub('    for (const st of n.stages) for (const s of st.subs) for (const c of s.crit || []) if (c.k === pick.k) c.v = pick.to;',
      "    for (const st of n.stages) for (const s of st.subs) for (const c of s.crit || []) if (c.k === pick.k) c.v = pick.to; else if (typeof c.v === 'number') c.v = c.v + 1;") }],
  ['a follow-up repeats a change', { s73: sub('if (!c || !K || !K.follow || done.has(k)) continue;', 'if (!c || !K || !K.follow) continue;') }],
  ['a follow-up pays the same', { s73: sub('  followPct: 15,', '  followPct: 0,') }],
  ['no follow-up is offered', { s74: sub('    if (f && !taken.has(f.id) && contractCertifiable(f)) out.push(f.id);', '') }],
  // (G2320) the held-out contract and the wire
  ['the aerobatic contract is offered', { s74: sub('careerNeedsOk(doc, A[next.id]) && contractCertifiable(A[next.id])', 'careerNeedsOk(doc, A[next.id])') }],
  ['the certificate reads a stronger ultimate', { s73: sub("const contractCertUlt = () => (typeof GEN_LOAD_ULT === 'number' ? GEN_LOAD_ULT : 5.7);", 'const contractCertUlt = () => 9;') }],
  ['the map record shows no accepted contract', { s75: sub('const contracts = C.accepted.concat(offered)', 'const contracts = offered') }],
  ["the map record's pay is not contractPay's", { s75: sub('const pay = Object.assign(contractPay(rec, F), ', 'const pay = Object.assign({ total: (rec.pay && rec.pay.base) || 0 }, ') }],
  ['the stop counts the pilot as a passenger', { s75: sub('pax: Math.max(0, occ - 1)', 'pax: occ') }],
  ['a stop that is not one delivers', { s75: sub("aero: (o.how === 'stopped' || o.how == null) && o.aero ? o.aero : null,", 'aero: o.aero || null,') }],
  ['the hook approves a pending verdict', { s75: sub('    return { ok: null, why: todo.map(', '    return { ok: true, got, why: todo.map(') }],
  ['the overflight ignores the field radius', { s75: sub('if (flightStripGeom(a, x, z).d <= FLIGHT_FIELD_R) out.push(a.id);', 'out.push(a.id);') }],
  // (g1)
  ['a build criterion names a configuration', { s72: sub("'ct.clients.04.brief': CT_('A trainer for the club, cheap and forgiving.')", "'ct.clients.04.brief': CT_('A tricycle trainer for the club, cheap and forgiving.')") }],
  ['the word check is off', { s73: s => sub("  for (const w of CONTRACT_CONFIG_WORDS) if (t.includes(' ' + w + ' ')) return w;", '')(sub("'ct.clients.04.brief': CT_('A trainer", "'ct.clients.04.brief': CT_('A Rotax trainer")(s)) }],
  // the career
  ['the grant is wrong', { s74: sub('const CAREER_GRANT = 60000;', 'const CAREER_GRANT = 50000;') }],
  ['no voucher', { s74: sub("const CAREER_VOUCHER = { kind: 'maker', model: 'cub' };", "const CAREER_VOUCHER = { kind: 'maker', model: '' };") }],
  ['the grant is not in the ledger', { s74: sub("  playerCharge(d, -CAREER_GRANT, 'grant', null);", '  d.wallet += CAREER_GRANT;') }],
  ['the career normaliser drops the done list', { s74: sub("for (const k of ['offered', 'accepted', 'done']) if (!Array.isArray(C[k])) C[k] = [];", "for (const k of ['offered', 'accepted', 'done']) C[k] = [];") }],
  ['accepting refuses nothing', { s74: sub("  if (!careerOfferIds(doc).includes(id)) return crNo(doc, id + ' is not on offer');\n", '') }],
  // the import
  ['the import lets a configuration in', { s73: sub("    if (check) { const w = contractConfigWord(s); if (w) { why.push(k + ' names a configuration (' + w + ')'); return; } }", '') }],
  ['the import writes the table handed in', { s73: sub('  const T = ctClone(text || CONTRACT_TEXT), why = [];', '  const T = text || CONTRACT_TEXT, why = [];') }],
  // purity
  ['the model reaches for storage', { s74: s => s + '\nfunction crLeak() { return localStorage; }\n' }],
];
let bad = 0;
for (const [name, mut] of BREAKS) {
  let r;
  try { r = run(mut); } catch (e) { r = { fails: [e.message], checks: 0 }; }
  const caught = r.fails.length > base.fails.length;
  console.log((caught ? '  caught  ' : '  MISSED  ') + name + (caught ? '  (' + (r.fails.length - base.fails.length) + ' new)' : ''));
  if (!caught) bad++;
}
console.log('GATE CONTRACTS selftest: ' + (bad ? 'FAIL (' + bad + ' not caught)' : 'PASS'));
process.exit(bad ? 1 : 0);
