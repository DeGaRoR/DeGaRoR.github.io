#!/usr/bin/env node
// ============================================================================
// GATE ECON — the economy (G2260 ECONOMY, P5a): one price book, the career
// wallet's rules, the calibration, ruling az through physical gates.
// ============================================================================
// futureDesigns/GAME-2026-10-06.md §R (binding: G-COST, GQ5, GQ6, GQ23), §12,
// §15 row 8; DEFORM-AND-BREAK §10 + dm9-dm12. What is held, in blocks:
//   THE PRICE BOOK   every price is a ratio of the ledger's Cub (shells, kits,
//                    sign-on fees, the makers' margin); the hangar rules read
//                    it (shellPrice, plotPrice, KIT_PRICES); the airframe price
//                    is the ledger x the main hangar's labour factor (each
//                    validated design's wants re-derived from its build file;
//                    the ledger's total = genFrame's bill); the catalogue
//                    above scratch; the repair = the bill x labour x where.
//   AZ, PHYSICALLY   every job class (CONTRACT_JOB_CLASSES) has a validated
//                    design that can physically do it; no validated design can
//                    do every class (over the authored contracts and the
//                    generated jobs of many careers).
//   THE CALIBRATION  the bands (ECON_BANDS, data) on every reference career
//                    seed: the first side hangar, a C172-class airframe, the
//                    second side hangar, a full arc - in contracts completed.
//   NO RUNNING COST  a career's ledger holds only grant / contract / purchase /
//                    repair / loan lines (and GQ5's free recovery at 0); every
//                    ledger kind written anywhere in the core and the page is
//                    one of the book's; an hour flown costs nothing; the pay
//                    is the job's.
//   THE WALLET       a purchase needs the cash (refused: the same document);
//                    only the last flyable airframe's repair may go below 0;
//                    a write-off has no Repair; the loan job is offered
//                    EXACTLY below -20 000, pays the wallet back, writes a
//                    `loan` line, any wheeled design flies it.
//   THE SANDBOX      every door in a sandbox document records "would cost"
//                    (free: true) and leaves the wallet; the page's sandbox
//                    calls none of it (every economy call behind CAREER_DEV,
//                    the shed doors' sandbox path today's lines).
//   THE PAGE DOORS   the save asks first and the new airframe is paid; the
//                    shell / kit / size doors through playerUpgrade; Repair;
//                    the wallet line in the garage, the flight plate's.
//   PURITY           76_economy.js touches no DOM, storage, THREE, clock or
//                    random.
//
//   node tools/_econ_check.js             -> "GATE ECON: PASS|FAIL"
//   node tools/_econ_check.js --show      also the classes table and the reference careers
//   node tools/_econ_check.js --selftest  -> negative verification: the sources
//                  doctored one rule at a time; each must turn a check red
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const CORE = require('./flight_core.js');
const SELF = process.argv.includes('--selftest');
const SHOW = process.argv.includes('--show');

const FILES = { s70: '70_player.js', s71: '71_player_bases.js', s72: '72_contract_data.js', s73: '73_contracts.js',
                s74: '74_career.js', s75: '75_career_wire.js', s76: '76_economy.js' };
const SRC = {};
for (const k of Object.keys(FILES)) SRC[k] = fs.readFileSync(path.join(ROOT, 'src', 'core', FILES[k]), 'utf8');
SRC.app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
SRC.garage = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'garage.js'), 'utf8');
const namesOf = s => [...s.matchAll(/^(?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);

// the rules' files, evaluated FRESH over the core's globals (minus their own names): the selftest doctors exactly
// the rule under test
function loadModel(mut) {
  const src = {};
  for (const k of Object.keys(SRC)) src[k] = (mut && mut[k]) ? mut[k](SRC[k]) : SRC[k];
  const core = Object.keys(FILES);
  const names = [].concat(...core.map(k => namesOf(src[k]))).filter((n, i, a) => a.indexOf(n) === i);
  const base = Object.assign({ console }, CORE);
  for (const n of names) delete base[n];
  const ctx = vm.createContext(base);
  vm.runInContext(core.map(k => src[k]).join('\n') + '\n;this.__M = { ' + names.join(', ') + ' };', ctx, { filename: 'economy' });
  return Object.assign({}, CORE, ctx.__M, { __src: src });
}

// what each validated design wants of a hangar, off its build file (hangarWants on the migrated spec)
const WANTS = {};
for (const k of Object.keys(CORE.CONTRACT_DESIGNS)) {
  const D = CORE.CONTRACT_DESIGNS[k];
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, D.build), 'utf8'));
  WANTS[k] = CORE.hangarWants(CORE.genMigrateSpec(j.spec || j));
}
// the ledger's total of the reference airframe, off its build file (genFrame's bill per section)
const CUB_LEDGER = (() => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, CORE.CONTRACT_DESIGNS.cub.build), 'utf8'));
  const def = CORE.buildGen(CORE.genMigrateSpec(j.spec || j));
  return def.parts && def.parts.ledger;
})();

function run(mut, opts) {
  opts = opts || {};
  const M = loadModel(mut);
  const fails = [];
  let checks = 0;
  const ok = (c, msg) => { checks++; if (!c) fails.push(msg); return !!c; };
  const J = o => JSON.stringify(o), clone = o => JSON.parse(J(o)), eq = (a, b) => J(a) === J(b);
  const refused = (r, before, doc, what) => ok(r && !r.ok && r.doc === doc && eq(doc, before) && r.why, what + ': refused, the same document untouched (' + (r && r.why) + ')');
  const B = M.ECON_BOOK, ref = M.econRefPrice();
  const out = { table: null, cal: null };

  // ==== THE PRICE BOOK ===========================================================
  ok(ref === M.CONTRACT_DESIGNS[B.ref].cost && B.ref === 'cub', 'the reference is the ledger\'s Cub (' + ref + ')');
  ok(Math.abs(M.econLedgerCost(CUB_LEDGER) - ref) <= 0.03 * ref, 'the ledger\'s total (genFrame\'s bill, ' + M.econLedgerCost(CUB_LEDGER) + ') is the certificate\'s cost (' + ref + ')');
  for (const s of ['field', 'club', 'works']) {
    ok(M.econShellPrice(s) === Math.round(B.shells[s] * ref / B.round) * B.round, s + ': the shell is ' + B.shells[s] + ' Cubs (' + M.econShellPrice(s) + ')');
    ok(M.shellPrice(s) === M.econShellPrice(s), s + ': the hangar rules price it from the book (shellPrice ' + M.shellPrice(s) + ')');
  }
  ok(B.shells.field < B.shells.club && B.shells.club < B.shells.works, 'the shells in order of what they hold: field < club < works');
  ok(B.shells.field >= 1, 'a field shed costs at least the aeroplane it shelters (property is bought, never rented)');
  for (const aero of Object.keys(M.BASE_OFFERS)) for (const plot of Object.keys(M.BASE_OFFERS[aero].plots)) {
    const P = M.BASE_OFFERS[aero].plots[plot];
    for (const s of P.shells) ok(M.plotPrice(aero, plot, s) === Math.round(M.econShellPrice(s) * (P.pf || 1)), plot + ' ' + s + ': the book x the plot factor');
  }
  for (const k of Object.keys(B.kits)) ok(M.KIT_PRICES[k] === Math.round(B.kits[k] * ref / B.round) * B.round, 'kit ' + k + ': ' + B.kits[k] + ' Cubs (' + M.KIT_PRICES[k] + ')');
  ok(Object.keys(M.KIT_PRICES).sort().join() === M.HANGAR_KITS_DEFAULT.slice().sort().join(), 'every kit has a price');
  ok(Math.max(...Object.values(M.KIT_PRICES)) < M.econShellPrice('field'), 'a kit costs less than a shed');
  // the metal shop pays for itself within its first C172-class airframe (the labour 0.8 against 1.0), and is no gift
  const save = M.CONTRACT_DESIGNS.c172.cost * (M.PREM_RATES.labourShort - M.PREM_RATES.labourFit);
  ok(M.KIT_PRICES.metal < save && M.KIT_PRICES.metal > 0.25 * save,
     'the metal shop costs between a quarter and all of one C172\'s labour saving (' + M.KIT_PRICES.metal + ' of ' + Math.round(save) + ')');
  for (const t of Object.keys(B.signOn)) ok(M.econSignOn(t) === Math.round(B.signOn[t] * ref / B.round) * B.round, 'sign-on ' + t + ': ' + B.signOn[t] + ' Cubs (' + M.econSignOn(t) + ')');
  ok(B.signOn.rookie < B.signOn.pilot && B.signOn.pilot < B.signOn.ace && M.econSignOn('ace') < ref, 'sign-on fees in order of skill, an ace less than a Cub');
  ok(M.econSignOn('nobody') === M.econSignOn('pilot'), 'an unknown tier pays a pilot\'s fee');
  // the airframe price: the ledger x the main hangar's labour factor, each design's wants off its build file
  ok(eq(M.ECON_REF.wants, WANTS), 'the reference\'s design wants are their build files\' (' + J(WANTS) + ')');
  const home = M.playerDefault().sheds.HOME, bare = { shell: 'field', kits: ['park'], base: 'w3' };
  for (const k of Object.keys(M.CONTRACT_DESIGNS)) {
    const D = M.CONTRACT_DESIGNS[k];
    ok(M.econAirframePrice(D.cost, home, WANTS[k]) === Math.round(D.cost * M.PREM_RATES.labourFit / B.round) * B.round, k + ': built in the fitted main hangar at the ledger x ' + M.PREM_RATES.labourFit);
    ok(M.econAirframePrice(D.cost, bare, WANTS[k]) === Math.round(D.cost * M.PREM_RATES.labourShort / B.round) * B.round, k + ': in a shed short of its verb at x ' + M.PREM_RATES.labourShort);
    ok(M.econCatalogPrice(D.cost) === Math.round(D.cost * M.PREM_RATES.labourFit * B.makerMargin / B.round) * B.round && M.econCatalogPrice(D.cost) > M.econAirframePrice(D.cost, home, WANTS[k]),
       k + ': a maker\'s catalogue price = scratch x ' + B.makerMargin + ', above building it yourself');
  }
  ok(B.makerMargin > 1 && B.makerMargin < 2, 'the makers\' margin is a margin (' + B.makerMargin + ')');
  // the repair: the bill x the repair labour x where it stands
  const bill = [{ section: 'gear', line: 'main gear leg', cost: 1200 }, { event: 'prop', line: 'prop strike', cost: 3000 }];
  ok(M.econRepairCost(bill, 0.8) === Math.round(4200 * B.repairLabour * 0.8 / B.round) * B.round && M.econRepairCost(bill, 1.25) > M.econRepairCost(bill, 0.8),
     'the repair: the bill x the repair labour x the hangar\'s (fitted ' + M.econRepairCost(bill, 0.8) + ', away ' + M.econRepairCost(bill, 1.25) + ')');

  // ==== AZ, THROUGH PHYSICAL GATES (G-COST) ==========================================
  {
    const classes = Object.keys(M.CONTRACT_JOB_CLASSES), designs = Object.keys(M.CONTRACT_DESIGNS);
    const can = {};
    for (const d of designs) { can[d] = {}; for (const c of classes) can[d][c] = 0; }
    const seen = {};
    for (const c of classes) seen[c] = 0;
    const recs = [];
    const A = M.contractAuthored();
    for (const id of Object.keys(A)) if (A[id].kind !== 'build') recs.push(A[id]);
    for (const seed of (opts.quick ? ['az-0'] : ['az-0', 'az-1', 'az-2', 'az-3', 'az-4', 'az-5']))
      for (const p of Object.keys(M.CONTRACT_PROVIDERS)) for (let e = 0; e < (opts.quick ? 3 : 8); e++) for (const rep of [0, 2.5, 5])
        for (const j of M.contractJobs(seed, p, e * M.CONTRACT_GEN.refreshEvery, { rep })) recs.push(j);
    for (const r of recs) {
      const subs = M.contractSubsOf(r).filter(s => s.do !== 'deliver' && s.do !== 'accept');
      const cl = M.contractClasses(r);
      const doers = M.contractDoers(subs);
      for (const c of cl) { seen[c]++; for (const d of doers) can[d][c]++; }
    }
    for (const c of classes) {
      ok(seen[c] > 0, 'az: the class ' + c + ' is offered (' + seen[c] + ' contracts)');
      ok(designs.some(d => can[d][c] > 0), 'az: the class ' + c + ' has a validated design that can physically do it (' + designs.filter(d => can[d][c] > 0).join(', ') + ')');
    }
    for (const d of designs) ok(classes.some(c => !can[d][c]), 'az: ' + d + ' cannot do every class (never: ' + classes.filter(c => !can[d][c]).join(', ') + ')');
    out.table = designs.map(d => '  ' + d.padEnd(6) + classes.map(c => c + ' ' + can[d][c]).join(' · '));
  }

  // ==== THE CALIBRATION =============================================================
  ok(eq(Object.keys(M.ECON_BANDS).sort(), ['airframe', 'arc', 'hangar1', 'hangar2']) && eq(M.ECON_BANDS.hangar1, [6, 10]) && eq(M.ECON_BANDS.airframe, [15, 25])
     && eq(M.ECON_BANDS.hangar2, [25, 35]) && eq(M.ECON_BANDS.arc, [20, 40]), 'the bands are the brief\'s, as data');
  ok(M.ECON_REF.wish.map(w => w.m).join() === 'hangar1,airframe,hangar2' && M.ECON_REF.wish[1].design === 'c172', 'the reference buys a side hangar, the C172-class airframe, a side hangar, in order');
  const cal = M.econCalibration(opts.quick ? { seeds: M.ECON_REF.seeds.slice(0, 2) } : undefined);
  out.cal = cal;
  for (const r of cal) ok(r.ok, 'the calibration on seed ' + r.seed + ': ' + J(r.at) + (r.ok ? '' : ' - ' + r.why.join('; ')));
  // the reference career is a career: its ledger, its fleet
  const R0 = M.econReference(M.ECON_REF.seeds[0]);
  ok(R0.doc.mode === 'career' && R0.fleet.includes('c172') && R0.doc.sheds.w3 && R0.doc.sheds.tw_ski, 'the reference career holds what it bought (two side hangars, the C172)');
  ok(eq(M.econReference(M.ECON_REF.seeds[0]).at, R0.at), 'the reference career is deterministic');
  const allPay = R0.doc.career.contracts.done.reduce((a, x) => a + x.pay, 0);
  ok(R0.doc.wallet === M.CAREER_GRANT + allPay - R0.spent, 'the reference wallet = the grant + the pay - the purchases (' + R0.doc.wallet + ')');

  // ==== NO RUNNING COST ANYWHERE (G-COST) ===========================================
  const allowed = new Set(['grant', 'contract', 'purchase', 'repair', 'loan']);
  const ledgerOk = (doc, what) => {
    const badL = doc.ledger.filter(l => { const c = M.econLedgerClass(l.k); return !(allowed.has(c) || (l.k === 'recover' && l.amt === 0) || (l.k === 'release' && l.amt <= 0)); });
    return ok(!badL.length, what + ': the ledger holds only grant / contract / purchase / repair / loan lines' + (badL.length ? ' (not: ' + badL.map(l => l.k + ' ' + l.amt).join(', ') + ')' : ''));
  };
  for (const s of (opts.quick ? M.ECON_REF.seeds.slice(0, 1) : M.ECON_REF.seeds)) ledgerOk(M.econReference(s).doc, 'the reference career ' + s);
  {
    // every ledger kind the core and the page write is one of the book's
    const kinds = new Set();
    // every call of the three money doors: the KIND argument (playerCharge(doc, amt, k), playerLedger(doc, k, amt),
    // econBuy(doc, cost, k)) - its quoted words (a ternary names both); a bare identifier is a pass-through (a door's own k)
    const argsAt = (src, i) => { let d = 0, a = '', out = []; for (; i < src.length; i++) { const ch = src[i];
      if (ch === '(' || ch === '[' || ch === '{') d++; else if (ch === ')' || ch === ']' || ch === '}') { if (d === 0) break; d--; }
      if (ch === ',' && d === 0) { out.push(a); a = ''; } else a += ch; } out.push(a); return out.map(x => x.trim()); };
    const scan = (src, nm) => {
      for (const [fn, pos] of [['playerCharge', 2], ['playerLedger', 1], ['econBuy', 2]]) {
        const re = new RegExp('\\b' + fn + '\\(', 'g');
        for (const m of src.matchAll(re)) {
          if (/function\s+$/.test(src.slice(Math.max(0, m.index - 12), m.index))) continue;     // its definition
          const k = argsAt(src, m.index + m[0].length)[pos] || '';
          const q = [...k.matchAll(/'(\w+)'/g)].map(x => x[1]);
          if (q.length) q.forEach(x => kinds.add(x));
          else if (!/^[a-zA-Z_][\w.]*$/.test(k)) kinds.add('?' + nm + ':' + k);
        }
      }
    };
    for (const k of Object.keys(FILES)) scan(M.__src[k], k);
    scan(M.__src.app, 'app');
    const unknown = [...kinds].filter(k => !M.econLedgerClass(k));
    ok(!unknown.length && kinds.has('contract') && kinds.has('grant') && kinds.has('airframe') && kinds.has('repair') && kinds.has('loan'),
       'every ledger kind written in the core and the page is the book\'s (' + [...kinds].sort().join(', ') + (unknown.length ? '; unknown: ' + unknown.join(', ') : '') + ')');
    ok(!Object.keys(M.ECON_LEDGER).some(k => /rent|fuel|wage|maint|dues|fee|hour/i.test(k)), 'no running-cost kind in the book');
    const d0 = M.careerNew({ seed: 'clock' });
    const h = M.playerClock(d0, 36000);
    ok(h.doc.wallet === d0.wallet && h.doc.ledger.length === d0.ledger.length && h.dues === 0, 'ten hours flown cost nothing');
    const job = M.careerContract(d0, d0.career.contracts.offered.find(i => /^job:/.test(i)));
    const p0 = M.contractPay(job).total;
    ok([{ airframe: 'c172' }, { design: 'twinf' }, { gear: 'floats' }].every(x => M.contractPay(Object.assign(clone(job), x)).total === p0), 'the pay is the job\'s, never the aeroplane\'s');
  }

  // ==== THE WALLET'S RULES ===========================================================
  {
    let c = M.careerNew({ seed: 'wallet' });
    c.fleet = { Cub: { hangar: 'HOME', aero: 'HOME' }, Kit: { hangar: null, aero: 'HOME' } };
    // a purchase needs the cash
    const poor = clone(c); poor.wallet = 1000; const pb = clone(poor);
    refused(M.econBuy(poor, 5000, 'airframe', 'X'), pb, poor, 'a purchase short of the cash');
    refused(M.econMaterialise(poor, 'X', 30000, ['tube']), pb, poor, 'materialising short of the cash');
    refused(M.econAcquire(poor, 'w3', 'w3', 'field'), pb, poor, 'a hangar short of the cash');
    refused(M.econUpgrade(poor, 'HOME', { shell: 'works' }), pb, poor, 'a rebuild short of the cash');
    refused(M.econBuy(c, 100, 'fuel', 'X'), clone(c), c, 'a running cost through the purchase door');
    const m = M.econMaterialise(c, 'New', M.CONTRACT_DESIGNS.jodel.cost, WANTS.jodel);
    const mp = M.econAirframePrice(M.CONTRACT_DESIGNS.jodel.cost, c.sheds.HOME, WANTS.jodel);
    ok(m.ok && m.doc.wallet === c.wallet - mp && m.cost === mp && m.doc.ledger.slice(-1)[0].k === 'airframe' && m.doc.ledger.slice(-1)[0].amt === mp && !m.doc.ledger.slice(-1)[0].free
       && m.doc.career.airframes.New.paid === mp, 'materialising a design: the ledger x the main hangar\'s labour (' + mp + '), an airframe line, the price on its row');
    // repair: the bill on an explicit Repair; the last flyable airframe may go negative; a write-off has none
    const dmg = clone(c);
    dmg.fleet.Cub.damage = { damaged: true, writeOff: false, bill };
    const r1 = M.econRepair(dmg, 'Cub', { wants: ['tube'] });
    ok(r1.ok && r1.cost === M.econRepairCost(bill, M.PREM_RATES.labourFit) && r1.doc.wallet === dmg.wallet - r1.cost && !r1.doc.fleet.Cub.damage && r1.doc.ledger.slice(-1)[0].k === 'repair',
       'Repair: the bill x the labour where it stands (inside the fitted main hangar: ' + r1.cost + '), the damage cleared, a repair line');
    const dpoor = clone(dmg); dpoor.wallet = 100;
    const dpb = clone(dpoor);
    refused(M.econRepair(dpoor, 'Cub', { wants: ['tube'] }), dpb, dpoor, 'a repair short of the cash while another airframe can fly');
    const dlast = clone(dpoor); dlast.fleet.Kit.damage = { damaged: true, bill };
    const r2 = M.econRepair(dlast, 'Cub', { wants: ['tube'] });
    ok(r2.ok && r2.last && r2.doc.wallet < 0, 'the last flyable airframe\'s repair is a non-choice: it may take the wallet below 0 (' + r2.doc.wallet + ')');
    const wo = clone(dmg); wo.fleet.Cub.damage.writeOff = true;
    refused(M.econRepair(wo, 'Cub'), clone(wo), wo, 'a write-off has no Repair (dm10)');
    refused(M.econRepair(c, 'Cub'), clone(c), c, 'repairing what is not damaged');
    const away = clone(dmg); away.fleet.Cub = { hangar: null, aero: 'w3', damage: dmg.fleet.Cub.damage };
    ok(M.econRepair(away, 'Cub', { wants: ['tube'] }).cost === M.econRepairCost(bill, M.PREM_RATES.labourAway), 'a repair away from your hangars at the field mechanic\'s labour');
    ok(eq(M.econFlyable(dlast), []) && eq(M.econFlyable(dmg), ['Kit']), 'a damaged airframe is grounded until repaired (dm10)');
  }

  // ==== THE TRUST'S LOAN JOB (GQ6) ===================================================
  {
    const c = M.careerNew({ seed: 'loan' });
    const at = w => { const d = clone(c); d.wallet = w; return M.careerRefresh(d); };
    ok(!M.careerOfferIds(at(-20000)).some(i => /^loan:/.test(i)) && !M.careerOfferIds(at(-19999)).some(i => /^loan:/.test(i)) && !M.careerOfferIds(at(0)).some(i => /^loan:/.test(i)),
       'no loan at -20 000 or above');
    const lo = at(-20001), ids = M.careerOfferIds(lo);
    ok(ids[0] === 'loan:field:1', 'the loan job is offered exactly below -20 000, first (' + ids[0] + ')');
    const L = M.careerContract(lo, 'loan:field:1');
    ok(L && L.kind === 'job' && L.provider === 'field' && L.loan === true && !M.contractValidate(L).length, 'the loan is a CONTRACT-MODEL job record of the Field Trust (' + M.contractValidate(L).join('; ') + ')');
    ok(['cub', 'jodel', 'c172'].every(d => M.contractDoers(M.contractSubsOf(L)).includes(d)), 'every wheeled validated design can fly it');
    ok(M.contractPay(L).total === 21000 && M.careerMapRecord(lo, null, {}).contracts.find(x => x.id === 'loan:field:1').pay.total === 21000,
       'it pays the wallet back up to ' + M.ECON_BOOK.loanTo + ' (21 000 on -20 001), on the map too');
    const sb = clone(lo); sb.mode = 'sandbox';
    ok(!M.econLoanOffer(sb), 'the sandbox is never offered a loan');
    let d = M.careerAccept(lo, 'loan:field:1').doc;
    const hooks = { acceptVerdict: () => ({ ok: true, got: {} }) };
    const stop = (aero, o) => Object.assign({ how: 'stopped', aero, load: { kg: 10, pax: 0 }, row: { from: 'HOME', to: aero, t: 600 }, hour: 12 }, o || {});
    for (const s of [stop('HOME'), stop('w3')]) { const q = M.contractOnStop(d, 'loan:field:1', s, hooks); if (q.ok) d = q.doc; }
    const last = d.ledger[d.ledger.length - 1];
    ok(d.career.contracts.done.some(x => x.id === 'loan:field:1') && d.wallet === -20001 + 21000 && last.k === 'loan' && last.amt === -21000,
       'flown: the wallet back (' + d.wallet + '), a `loan` line');
    ledgerOk(d, 'a career with a loan');
    const again = clone(d); again.wallet = -30000; M.careerRefresh(again);
    ok(M.careerOfferIds(again)[0] === 'loan:field:2' && M.contractPay(M.careerContract(again, 'loan:field:2')).total === 30000, 'a second loan is a new job (loan:field:2, 30 000)');
  }

  // ==== THE SANDBOX RECORDS, NEVER CHARGES ==========================================
  {
    const s = M.playerDefault();
    s.wallet = 0; s.fleet = { Cub: { hangar: 'HOME', aero: 'HOME', damage: { damaged: true, bill } } };
    const before = clone(s);
    const doors = [
      ['an airframe', M.econMaterialise(s, 'New', 30000, ['tube'])],
      ['a purchase', M.econBuy(s, 5000, 'signon', 'pilot')],
      ['a hangar', M.econAcquire(s, 'w3', 'w3', 'field')],
      ['a rebuild', M.econUpgrade(s, 'HOME', { shell: 'works' })],
      ['a kit', M.econUpgrade(Object.assign(clone(s), { sheds: { HOME: Object.assign(clone(s.sheds.HOME), { kits: ['park'] }) } }), 'HOME', { kits: ['metal'] })],
      ['a repair', M.econRepair(s, 'Cub')],
    ];
    for (const [w, r] of doors) {
      const l = r.doc && r.doc.ledger[r.doc.ledger.length - 1];
      ok(r.ok && r.doc.wallet === 0 && l && l.free === true && l.amt > 0, 'the sandbox: ' + w + ' is recorded "would cost" ' + (l && l.amt) + ', the wallet untouched');
    }
    ok(eq(s, before), 'the sandbox document handed in is untouched');
    ok(!M.econLoanOffer(Object.assign(clone(s), { wallet: -1e6 })), 'the sandbox never borrows');
  }

  // ==== THE PAGE (source) =============================================================
  {
    const app = M.__src.app, gar = M.__src.garage;
    const i0 = app.indexOf("G2260 (ECONOMY): THE CAREER WALLET'S PAGE HALF"), i1 = app.indexOf('window.FLYDIY_PLAYER = {', i0);
    ok(i0 > 0 && i1 > i0, 'app.js: the economy\'s page half is where this gate reads it');
    const half = app.slice(i0, i1), outside = (app.slice(0, i0) + app.slice(i1)).split('\n');
    const calls = outside.filter(l => /\becon[A-Z]\w*\(/.test(l.replace(/\/\/.*$/, '')));
    const loose = calls.filter(l => !/CAREER_DEV/.test(l));
    ok(calls.length >= 6 && !loose.length, 'the sandbox: every call into the economy outside its half is behind CAREER_DEV (' + calls.length + (loose.length ? '; loose: ' + loose.map(l => l.trim().slice(0, 80)).join(' | ') : '') + ')');
    ok(/if \(CAREER_DEV\) window\.FLYDIY_ECON = /.test(half), 'the sandbox: no FLYDIY_ECON without the flag');
    ok(/canSave: \(name, isNew\) => \(CAREER_DEV \? econSaveWhy\(name, isNew\) : ''\)/.test(app), 'the sandbox: the save is never asked a price');
    // today's sandbox lines stand, each after its career door
    ok(/if \(CAREER_DEV && !econShedDoor\(\{ dims: next \}\)\) return[^\n]*\n\s*const shed = shedHome\(\);\n\s*shed\.dims = next;/.test(app), 'the size door: paid in a career, today\'s write in the sandbox');
    ok(/if \(CAREER_DEV && shedHome\(\)\.shell !== k && !econShedDoor\(\{ shell: k \}\)\) return shedHome\(\)\.shell;\n\s*const shed = shedHome\(\);\n\s*if \(shed\.shell === k\) return k;\n\s*shed\.shell = k;/.test(app), 'the shell door: a paid rebuild in a career, today\'s write in the sandbox');
    ok(/if \(CAREER_DEV && !econShedDoor\(\{ kits: \[\.\.\.want\] \}\)\) return shedHome\(\)\.kits\.slice\(\);\n\s*const shed = shedHome\(\);\n\s*const cur = new Set\(shed\.kits\);/.test(app), 'the kit door: paid in a career, today\'s write in the sandbox');
    ok(/if \(CAREER_DEV && isNew\) d = econMaterialiseNow\(d, info\.saved\);/.test(app) && /const isNew = !!\(info\.saved && !playerLoad\(\)\.fleet\[info\.saved\]\);/.test(app), 'the first save of a new airframe is paid (career)');
    ok(/econMaterialise\(d, name, B\.cost, B\.wants, \{ price: B\.price \}\)/.test(half) && /econAirframePrice\(cost, playerLoad\(\)\.sheds\[PREM_MAIN\], wants\)/.test(half) && /econLedgerCost\(led\)/.test(half),
       'the airframe\'s price: its ledger x the main hangar\'s labour factor for its wants');
    const si = gar.indexOf('if (api.canSave)'), wi = gar.indexOf('if (!lsSet(SLOT + name, envelope(name, spec, plaque, log)))');
    ok(si > 0 && wi > si && /api\.canSave\(name, !lsGet\(SLOT \+ name\)\); if \(why\) return void alert\(why\);/.test(gar), 'garage.js asks before it writes a new slot, and writes nothing when refused');
    ok(/econUpgrade\(playerLoad\(\), PREM_MAIN, change, \{\}\)/.test(half), 'the shed doors go through playerUpgrade on the main hangar');
    ok(/econRepair\(playerLoad\(\), n, \{ wants \}\)/.test(half) && /#ecRepair|id="ecRepair"/.test(half), 'Repair: an explicit press, through econRepair');
    ok(/ecWalletEl\.id = 'ecWallet'/.test(half) && /'Wallet ' \+ ecFmt\(d\.wallet\)/.test(half) && /if \(CAREER_DEV\) econWalletSync\(\);/.test(app), 'the wallet line in the garage (career only), redrawn on every save of the document');
    ok(/' · wallet ' \+ Math\.round\(d\.wallet\)/.test(app), 'the wallet line on the flight plate (CAREER-WIRE\'s #crPlate)');
  }

  // ==== PURITY ========================================================================
  {
    const s = M.__src.s76.replace(/\/\/.*$/gm, '');
    ok(!/\b(document|window|localStorage|sessionStorage|THREE|Date\.|new Date|Math\.random|performance\.now|setTimeout|fetch)\b/.test(s), '76_economy.js is pure (no DOM, storage, THREE, clock or random)');
  }
  return { fails, checks, out };
}

if (!SELF) {
  const r = run(null);
  if (SHOW) {
    console.log('DESIGNS x JOB CLASSES (contracts of the class each can physically do, of the gate\'s sample)');
    for (const l of r.out.table) console.log(l);
    console.log('THE REFERENCE CAREERS (contracts completed at each milestone; the bands ' + JSON.stringify(CORE.ECON_BANDS) + ')');
    for (const c of r.out.cal) console.log('  ' + c.seed.padEnd(8) + ' ' + JSON.stringify(c.at) + ' (the arc: ' + c.arcBy + ')  wallet ' + c.wallet + '  pays ' + c.pays.slice(0, 30).join(' '));
    const B = CORE.ECON_BOOK, ref = CORE.econRefPrice();
    console.log('THE PRICE BOOK (the ledger\'s Cub = ' + ref + ')');
    console.log('  shells  ' + ['field', 'club', 'works'].map(s => s + ' ' + CORE.econShellPrice(s)).join(' · '));
    console.log('  kits    ' + Object.keys(CORE.KIT_PRICES).map(k => k + ' ' + CORE.KIT_PRICES[k]).join(' · '));
    console.log('  sign-on ' + Object.keys(B.signOn).map(t => t + ' ' + CORE.econSignOn(t)).join(' · ') + '   makers x' + B.makerMargin + '   repair labour x' + B.repairLabour);
    console.log('  airframes (scratch in the main hangar / a maker\'s catalogue) ' + Object.keys(CORE.CONTRACT_DESIGNS).map(k => k + ' ' + CORE.econAirframePrice(CORE.CONTRACT_DESIGNS[k].cost, CORE.playerDefault().sheds.HOME, WANTS[k]) + ' / ' + CORE.econCatalogPrice(CORE.CONTRACT_DESIGNS[k].cost)).join(' · '));
  }
  for (const f of r.fails) console.log('  x ' + f);
  console.log(r.checks + ' checks');
  console.log('GATE ECON: ' + (r.fails.length ? 'FAIL (' + r.fails.length + ' of ' + r.checks + ')' : 'PASS'));
  process.exit(r.fails.length ? 1 : 0);
}

// ---- THE SELFTEST: each rule doctored in its own source must turn a check red -------------------------------------
const base = run(null, { quick: true });
if (base.fails.length) { console.log('the undoctored gate is red:'); for (const f of base.fails) console.log('  x ' + f); console.log('GATE ECON selftest: FAIL'); process.exit(1); }
const sub = (a, b) => s => { if (s.indexOf(a) < 0) throw new Error('selftest anchor gone: ' + a); return s.split(a).join(b); };
const BREAKS = [
  // the price book
  ['a shell priced off the book', { s71: sub('  return econShellPrice(shell);', "  return shell === 'field' ? 6000 : econShellPrice(shell);") }],
  ['the reference is not the ledger\'s Cub', { s76: sub("  ref: 'cub',", "  ref: 'jodel',") }],
  ['a kit priced in credits, not Cubs', { s76: sub('  for (const k of Object.keys(ECON_BOOK.kits)) o[k] = econRound(ECON_BOOK.kits[k] * econRefPrice());', '  for (const k of Object.keys(ECON_BOOK.kits)) o[k] = econRound(ECON_BOOK.kits[k] * 30000);') }],
  ['a kit costs nothing', { s76: sub('metal: 0.24,', 'metal: 0,') }],
  ['the airframe ignores the labour factor', { s76: sub('  return econRound((+cost || 0) * L);', '  return econRound(+cost || 0);') }],
  ['the catalogue is cheaper than scratch', { s76: sub('  makerMargin: 1.35,', '  makerMargin: 0.9,') }],
  ['an ace costs less than a rookie', { s76: sub('signOn: { rookie: 0.08, pilot: 0.16, ace: 0.32 }', 'signOn: { rookie: 0.08, pilot: 0.16, ace: 0.04 }') }],
  ['the repair ignores where it stands', { s76: sub('  return econRound(sum * ECON_BOOK.repairLabour * L);', '  return econRound(sum * ECON_BOOK.repairLabour);') }],
  ['a design\'s wants drift', { s76: sub("c172: ['metal'], c172f", "c172: ['tube'], c172f") }],
  // az
  ['wheels on water (az lost)', { s73: sub('function contractCanDo(D, subs, fields) {', 'function contractCanDo(D, subs, fields) {\n  if (D.id === \'c172\') return { ok: true, why: \'\' };') }],
  ['a class nobody can do', { s73: sub("  bulk:     { test: subs => subs.some(s => s.load && s.load.bulk) },", "  bulk:     { test: subs => subs.some(s => s.load && s.load.bulk) },\n  ferry:    { test: subs => subs.some(s => s.do === 'carry') && false },") }],
  // the calibration
  ['the pay halved', { s73: sub('  baseF: 2.7, story: 2.6,', '  baseF: 1.35, story: 1.3,') }],
  ['the hangars cheap', { s76: sub('  shells: { field: 1.8,', '  shells: { field: 0.4,') }],
  ['the bands widened', { s76: sub('  hangar1:  [6, 10],', '  hangar1:  [0, 60],') }],
  ['the reference spends the grant first', { s76: sub('  const float = CAREER_GRANT, at = {}', '  const float = 0, at = {}') }],
  // no running cost
  ['a running cost in the ledger', { s74: sub("  playerCharge(d, -pay, rec.loan ? 'loan' : 'contract', rec.id);", "  playerCharge(d, -pay, rec.loan ? 'loan' : 'contract', rec.id);\n  playerCharge(d, 25, 'fuel', rec.id);") }],
  ['an hour flown costs', { s71: sub('  d.clock = (d.clock || 0) + s;', "  d.clock = (d.clock || 0) + s;\n  playerCharge(d, s / 36, 'hangarRent', null);") }],
  ['a running-cost kind in the book', { s76: sub('  recover: \'free\', release: \'free\',', "  recover: 'free', release: 'free', wage: 'purchase',") }],
  // the wallet
  ['a purchase on credit', { s76: sub("const econAfford = (doc, cost) => !doc || doc.mode !== 'career' || doc.wallet >= cost;", 'const econAfford = (doc, cost) => true;') }],
  ['any repair may go negative', { s76: sub('  const last = econFlyable(doc).length === 0;', '  const last = true;') }],
  ['a write-off repaired', { s76: sub("  if (D.writeOff) return ecNo(doc, slot + ' is a write-off: scrap it or sell it as salvage');", '') }],
  ['the loan at -20 000', { s76: sub('!(doc.wallet < ECON_BOOK.loanBelow)', '!(doc.wallet <= ECON_BOOK.loanBelow)') }],
  ['the loan never offered', { s74: sub('  if (loan && !taken.has(loan)) out.unshift(loan);', '') }],
  ['the loan pays a job\'s rate', { s73: sub('  if (rec.loan && rec.pay && typeof rec.pay.total === \'number\' && isFinite(rec.pay.total)) total = rec.pay.total;', '') }],
  ['the loan writes a contract line', { s74: sub("rec.loan ? 'loan' : 'contract'", "'contract'") }],
  ['the sandbox borrows', { s76: sub("  if (!doc || doc.mode !== 'career' || !(doc.wallet < ECON_BOOK.loanBelow)) return null;", '  if (!doc || !(doc.wallet < ECON_BOOK.loanBelow)) return null;') }],
  // the sandbox
  ['the sandbox charges', { s71: sub("  const free = doc.mode !== 'career';\n  if (!free) doc.wallet -= amt;", "  const free = doc.mode !== 'career';\n  doc.wallet -= amt;") }],
  ['the page charges the sandbox\'s save', { app: sub("if (CAREER_DEV && isNew) d = econMaterialiseNow(d, info.saved);", 'if (isNew) d = econMaterialiseNow(d, info.saved);') }],
  ['the page prices the sandbox\'s shell', { app: sub('if (CAREER_DEV && shedHome().shell !== k && !econShedDoor({ shell: k }))', 'if (shedHome().shell !== k && !econShedDoor({ shell: k }))') }],
  // the page doors
  ['the save is never asked', { garage: sub('    if (api.canSave) { const why = api.canSave(name, !lsGet(SLOT + name)); if (why) return void alert(why); }\n', '') }],
  ['the kit door skips the wallet', { app: sub('      if (CAREER_DEV && !econShedDoor({ kits: [...want] })) return shedHome().kits.slice();\n', '') }],
  ['no wallet line in the garage', { app: sub("ecWalletEl.id = 'ecWallet';", "ecWalletEl.id = 'ecWalletX';") }],
  // purity
  ['the economy reaches for storage', { s76: s => s + '\nfunction ecLeak() { return localStorage; }\n' }],
];
let bad = 0;
for (const [name, mut] of BREAKS) {
  let r;
  try { r = run(mut, { quick: true }); } catch (e) { if (/selftest anchor gone/.test(e.message)) { console.log('  ANCHOR  ' + name + ': ' + e.message); bad++; continue; } r = { fails: [e.message], checks: 0 }; }
  const caught = r.fails.length > base.fails.length;
  console.log((caught ? '  caught  ' : '  MISSED  ') + name + (caught ? '  (' + (r.fails.length - base.fails.length) + ' new)' : ''));
  if (!caught) bad++;
}
console.log('GATE ECON selftest: ' + (bad ? 'FAIL (' + bad + ' not caught)' : 'PASS') + ' - ' + (BREAKS.length - bad) + ' of ' + BREAKS.length + ' caught');
process.exit(bad ? 1 : 0);
