// ===========================================================================
// THE ECONOMY (G2260 ECONOMY, P5a) — ONE PRICE BOOK, THE CAREER WALLET'S
// RULES, THE CALIBRATION AS DATA, AND THE REFERENCE CAREER THAT HOLDS IT.
// futureDesigns/GAME-2026-10-06.md §R (binding: G-COST no running costs,
// contracts pay net, hangars bought never rented, a pilot's one-time sign-on
// fee, GQ5 bring-it-home free, GQ6 no bankruptcy + the Trust's loan job below
// -20 000, GQ23 the 60 000 grant + a Cub voucher), §12, §15 row 8;
// DEFORM-AND-BREAK §10 + dm9-dm12 (the repair bill, charged on Repair).
// ===========================================================================
// CREDITS ARE NOT DOLLARS. Every price here is a RATIO to the one number the
// game already prices honestly: the ledger's airframe (genFrame's bill of
// materials, genShakedown `cost`). The reference is the stock Cub's ledger
// (CONTRACT_DESIGNS.cub.cost, re-derived from its build file by GATE
// CONTRACTS each run): a field shed, a kit, a sign-on fee, a maker's margin
// are so many Cubs, and move with it.
//
// WHAT COSTS MONEY (G-COST): airframes (materialised from the drawing board,
// or a maker's catalogue), hangars (bought), kits and upgrades, a pilot's
// sign-on fee, repairs. NOTHING ELSE: no fuel, no maintenance reserve, no
// wage, no rent, no landing fee, no recovery (GQ5). A career's ledger holds
// grant / contract / loan lines (income) and purchase / repair lines
// (spending); `econLedgerClass` names each line's class, and a line of any
// other class is a running cost (GATE ECON refuses one).
//
// THE WALLET'S RULE (GQ6): a PURCHASE needs the cash (refused, the same
// document handed back, with why). Only a NON-CHOICE may take the wallet
// below 0: the repair of the career's LAST flyable airframe (without it the
// career cannot work - the crash was not a choice). Below ECON_BOOK.loanBelow
// (-20 000) the Field Trust offers its LOAN JOB: a CONTRACT-MODEL record,
// kind 'job', provider 'field', that any airframe can fly, paying the wallet
// back to ECON_BOOK.loanTo.
//
// THE SANDBOX RECORDS, NEVER CHARGES (71_ playerCharge): every rule below in
// a sandbox document writes its "would cost" line `free: true` and leaves the
// wallet alone; the page's sandbox calls none of them (byte for byte today's).
//
// Pure: no DOM, storage, THREE, clock or random (GATE ECON scans for each).
// ===========================================================================
const ECON_V = 1;

// ---- THE PRICE BOOK ---------------------------------------------------------------------------------------------
//   ref          the reference airframe: CONTRACT_DESIGNS[ref].cost (the ledger's stock Cub, ~31 200)
//   shells       a hangar shell bought on a plot: x the reference, x the plot's price factor (BASE_OFFERS pf).
//                A field shed (one aeroplane, honestly) is ~1.5 Cubs, a club ~3, the works ~5 - property costs
//                more than the aeroplane it shelters, and is never rented (G-COST)
//   kits         a kit fitted (nothing refunds a kit): x the reference. The workshop kits are what buys the
//                labour factor (PREM_RATES.labourFit 0.8 against 1.0) - the metal shop pays for itself within
//                its first C172-class airframe, the woodshop within its first few wooden ones
//   makerMargin  a maker's catalogue price = the scratch price (the ledger in a fully fitted works: x labourFit)
//                x this margin - PROCURE's catalogue; what you pay a maker for not building it yourself
//   signOn       a pilot's ONE-TIME sign-on fee by tier (G-COST: no wage), x the reference - PILOTS' roster
//   repairLabour the repair bill's labour factor: DMG-D5's bill (per section + the event lines, §10) x this
//                x the hangar's labour factor (playerLabourFactor: where the aeroplane is repaired)
//   round        every price rounds to this
//   loanBelow    GQ6: the Trust's loan job is offered while the wallet is BELOW this
//   loanTo       ...and pays the wallet back up to this (rounded up to `loanRound`)
const ECON_BOOK = {
  ref: 'cub',
  shells: { field: 1.8, club: 3.2, works: 5.4 },
  kits: { park: 0, bench: 0.05, wood: 0.16, metal: 0.24, store: 0.02, handling: 0.05,
          office: 0.1, comfort: 0.06, curio: 0, wip: 0 },
  makerMargin: 1.35,
  signOn: { rookie: 0.08, pilot: 0.16, ace: 0.32 },
  repairLabour: 1.0,
  round: 100,
  loanBelow: -20000,
  loanTo: 0,
  loanRound: 1000,
};
const econRound = v => Math.round((+v || 0) / ECON_BOOK.round) * ECON_BOOK.round;
// the reference airframe's ledger price (the unit every ratio is in)
function econRefPrice() {
  const D = (typeof CONTRACT_DESIGNS !== 'undefined') && CONTRACT_DESIGNS[ECON_BOOK.ref];
  return D ? D.cost : 31203;
}
// a hangar shell's price before the plot's factor (71_ shellPrice reads this: the club is the starter at HOME,
// and a club bought elsewhere is priced like any other shell)
function econShellPrice(shell) {
  const r = ECON_BOOK.shells[shell];
  return typeof r === 'number' ? econRound(r * econRefPrice()) : NaN;
}
// what a kit costs to fit (71_ playerUpgradeCost reads KIT_PRICES): the book's ratios, as credits
const KIT_PRICES = (() => {
  const o = {};
  for (const k of Object.keys(ECON_BOOK.kits)) o[k] = econRound(ECON_BOOK.kits[k] * econRefPrice());
  return o;
})();

// ---- AIRFRAMES -------------------------------------------------------------------------------------------------
// the ledger's total: genFrame's bill per section (def.parts.ledger: { <section>: { mass, cost } }) - what
// genShakedown reports as `cost`
function econLedgerCost(ledger) {
  let c = 0;
  for (const k of Object.keys(ledger || {})) { const e = ledger[k]; if (e && isFinite(+e.cost)) c += +e.cost; }
  return Math.round(c);
}
// THE AIRFRAME PRICE: a design materialised from the drawing board in the main hangar = the ledger x the main
// hangar's labour factor for what the design wants (hangarWants: wood, tube, metal, composite) - a fully fitted
// works builds at 0.8, a shed short of the verb at 1.0
function econAirframePrice(cost, shed, wants) {
  const L = typeof playerLabourFactor === 'function' ? playerLabourFactor(shed || null, wants || []) : 1;
  return econRound((+cost || 0) * L);
}
// THE MAKERS' CATALOGUE PRICE (PROCURE): the scratch price (the ledger in a fully fitted works) x the margin
function econCatalogPrice(cost, margin) {
  const m = typeof margin === 'number' && margin > 0 ? margin : ECON_BOOK.makerMargin;
  return econRound((+cost || 0) * PREM_RATES.labourFit * m);
}
// A PILOT'S SIGN-ON FEE (PILOTS): one time, by tier ('rookie' | 'pilot' | 'ace'); unknown tiers cost a pilot's
function econSignOn(tier) {
  const r = ECON_BOOK.signOn[tier];
  return econRound((typeof r === 'number' ? r : ECON_BOOK.signOn.pilot) * econRefPrice());
}
// THE REPAIR (dm9): DMG-D5's bill [{ section | event, line, cost }] x the repair labour x the hangar's labour
// factor (the hangar the aeroplane stands in; away from yours: labourAway)
function econRepairCost(bill, labour) {
  const sum = (Array.isArray(bill) ? bill : []).reduce((a, l) => a + (l && isFinite(+l.cost) ? +l.cost : 0), 0);
  const L = typeof labour === 'number' && labour > 0 ? labour : 1;
  return econRound(sum * ECON_BOOK.repairLabour * L);
}

// ---- THE LEDGER'S CLASSES (G-COST: no running cost anywhere) ---------------------------------------------------
// Every ledger kind the game writes, by class. income: grant, contract, loan. purchase: an airframe, a hangar
// (acquire), its upgrades / kits (upgrade), a sign-on fee. repair: a bill paid. free: a "bring it home" (GQ5:
// always 0) and a hangar released (a refund). Anything else is a running cost.
const ECON_LEDGER = {
  grant: 'grant', contract: 'contract', loan: 'loan',
  airframe: 'purchase', acquire: 'purchase', upgrade: 'purchase', signon: 'purchase', catalogue: 'purchase',
  repair: 'repair',
  recover: 'free', release: 'free',
};
const econLedgerClass = k => ECON_LEDGER[k] || null;

// ---- THE WALLET'S DOORS (pure; { ok, doc, why, cost }; a refusal hands back the very document) -----------------
const ecClone = o => JSON.parse(JSON.stringify(o));
const ecNo = (doc, why) => ({ ok: false, doc, why });
// can the wallet take this purchase? (the sandbox always can: it records)
const econAfford = (doc, cost) => !doc || doc.mode !== 'career' || doc.wallet >= cost;
// A PURCHASE: needs the cash in a career (GQ6); the sandbox records it free. k: a purchase kind of ECON_LEDGER.
function econBuy(doc, cost, k, ref) {
  cost = Math.max(0, Math.round(+cost || 0));
  if (econLedgerClass(k) !== 'purchase') return ecNo(doc, k + ' is not a purchase');
  if (!econAfford(doc, cost)) return ecNo(doc, 'the wallet holds ' + Math.round(doc.wallet) + ', this costs ' + cost);
  const d = ecClone(doc);
  playerLedger(d, k, cost, ref);
  return { ok: true, doc: d, cost, why: '' };
}
// MATERIALISING A DESIGN (the first Save of a new airframe): the airframe price, from the ledger and the main
// hangar; the career's airframe row remembers what it cost (`paid`) and how it was made (PROCURE: 'catalogue')
function econMaterialise(doc, slot, cost, wants, opts) {
  opts = opts || {};
  const main = doc && doc.sheds && doc.sheds[PREM_MAIN];
  const price = opts.price != null ? Math.round(opts.price) : econAirframePrice(cost, main, wants);
  const r = econBuy(doc, price, opts.k || 'airframe', slot);
  if (!r.ok) return r;
  const C = r.doc.career;
  if (C && C.airframes && typeof C.airframes === 'object')
    C.airframes[slot] = Object.assign({}, C.airframes[slot] || {}, { paid: price, how: opts.how || 'scratch', at: Math.round(r.doc.clock || 0) });
  return { ok: true, doc: r.doc, cost: price, why: '' };
}
// a hangar bought (71_ playerAcquire: needs the cash) / changed (playerUpgrade: shell, size, kits)
const econAcquire = (doc, aero, plot, shell) => playerAcquire(doc, aero, plot, shell, 'own');
const econUpgrade = (doc, hangarId, change, opts) => playerUpgrade(doc, hangarId, change, opts);
// the airframes in the fleet that could fly now (a damaged one is grounded until repaired: dm10)
const econFlyable = doc => Object.keys((doc && doc.fleet) || {}).filter(n => !(doc.fleet[n] && doc.fleet[n].damage && doc.fleet[n].damage.damaged));
// THE REPAIR (dm9, dm10): charged only on an explicit Repair, the bill x the labour where it stands. A purchase-
// like choice (needs the cash) EXCEPT for the career's last flyable airframe (no other aeroplane could earn the
// money: GQ6's non-choice) - that one may take the wallet below 0, and the Trust's loan job follows. A write-off
// has no Repair (dm10). The fleet row's `damage` (D5's record) is cleared; the wear resets (G2230).
function econRepair(doc, slot, opts) {
  opts = opts || {};
  const e = doc && doc.fleet && doc.fleet[slot];
  if (!e) return ecNo(doc, slot + ' is not in the fleet');
  const D = e.damage;
  if (!D || !D.damaged) return ecNo(doc, slot + ' is not damaged');
  if (D.writeOff) return ecNo(doc, slot + ' is a write-off: scrap it or sell it as salvage');
  const W = playerWhere(doc, slot);
  const shed = W.kind === 'in' ? doc.sheds[W.hangar] : null;
  const labour = typeof playerLabourFactor === 'function' ? playerLabourFactor(shed, opts.wants || []) : 1;
  const cost = econRepairCost(D.bill, labour);
  const last = econFlyable(doc).length === 0;
  if (!last && !econAfford(doc, cost)) return ecNo(doc, 'the wallet holds ' + Math.round(doc.wallet) + ', the repair costs ' + cost);
  let d = ecClone(doc);
  playerLedger(d, 'repair', cost, slot);
  delete d.fleet[slot].damage;
  if (typeof playerWearReset === 'function') d = playerWearReset(d, slot).doc;
  return { ok: true, doc: d, cost, labour, last, why: '' };
}

// ---- THE TRUST'S LOAN JOB (GQ6) ----------------------------------------------------------------------------------
// Offered while the wallet is below ECON_BOOK.loanBelow (74_ careerOfferIds asks econLoanOffer). A job record
// (CONTRACT-MODEL's shape, kind 'job', provider 'field'): a short errand from HOME to Tamgas Hill that every
// validated design on wheels can fly, paying the wallet back up to loanTo. Its id carries the loans taken
// (`loan:field:<n>`), so a second loan is a new job; its pay is fixed when it is offered (careerAccept snapshots a
// job as offered), and completed it writes a `loan` ledger line (74_ careerComplete reads rec.loan).
const ECON_TEXT = {
  'job.field.loan.title': { t: 'The Trust stands by you', draft: true },
  'job.field.loan.brief': { t: 'The Field Trust has an errand to {to}, and an advance against it. Fly it and start again.', draft: true },
};
if (typeof CONTRACT_TEXT !== 'undefined') for (const k of Object.keys(ECON_TEXT)) if (!CONTRACT_TEXT[k]) CONTRACT_TEXT[k] = ECON_TEXT[k];
const econLoans = doc => ((doc && doc.ledger) || []).filter(l => l && l.k === 'loan').length;
function econLoanOffer(doc) {
  if (!doc || doc.mode !== 'career' || !(doc.wallet < ECON_BOOK.loanBelow)) return null;
  return 'loan:field:' + (econLoans(doc) + 1);
}
function econLoanPay(wallet) {
  const R = ECON_BOOK.loanRound;
  return Math.max(R, Math.ceil((ECON_BOOK.loanTo - (+wallet || 0)) / R) * R);
}
function econLoanJob(doc, id) {
  if (!/^loan:field:\d+$/.test(id || '')) return null;
  const rec = contractNormalise({
    id, provider: 'field', kind: 'job', title: 'job.field.loan.title', brief: 'job.field.loan.brief', loan: true,
    stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'w3', load: { kg: 10, pax: 0 } }] }],
    pay: { base: 0 }, rep: { provider: 'field', gain: 0 }, repeat: false,
  });
  rec.pay = Object.assign(contractPay(rec), { total: econLoanPay(doc ? doc.wallet : 0) });
  return rec;
}

// ---- THE CALIBRATION (stated as data, held by GATE ECON) ---------------------------------------------------------
// With CONTRACT-MODEL's pay (CONTRACT_PAY: ECONOMY's since G2260), a career that flies the matched validated
// design reaches, in CONTRACTS COMPLETED (not hours: there are no running costs):
// (G2430 CONTRACT-ROUTES, RE-DERIVED) most jobs are now chains of two legs (73_ contractJob's shapes), so a contract
// is ~1.7 legs where it was ~1.35, and pays per leg (+ a 10 % chain bonus). Measured on the reference careers below,
// THE PACE IN LEGS FLOWN DID NOT MOVE (the first hangar at 12 legs, the C172 at 27-31 before / 30-31 after, the
// arc at 28-32 / 31-32, the second hangar at 35-38 / 36-38); only the unit did. The brief's bands (G2260: 6-10,
// 15-25, 25-35, 20-40) are scaled by the measured contracts-per-leg ratio, 0.78 (the reference's 21-22 / 26-28 / 22-23
// contracts at the airframe / hangar2 / arc before, 17-18 / 21-22 / 18-19 after); the first hangar is unchanged (it
// is bought inside the arc-only opening, 8 contracts both ways).
const ECON_BANDS = {
  hangar1:  [6, 10],     // the first side hangar
  airframe: [12, 20],    // a C172-class airframe (CONTRACT_DESIGNS.c172, materialised in the main hangar)   (G2260: 15-25)
  hangar2:  [20, 27],    // the second side hangar                                                         (G2260: 25-35)
  arc:      [16, 31],    // a full arc: the first provider whose whole arc is complete (its track at its last stage) (G2260: 20-40)
};
// THE REFERENCE CAREER the bands are measured on (econReference). Stated, so the numbers mean something:
//   start   careerNew (GQ23: the 60 000 grant, the voucher Cub - the fleet's first airframe, free)
//   float   the grant is the career's FLOAT - its first airframe of its own, a build contract's airframe, a
//           repair - and the milestones are bought from what contracts pay: a purchase is made the moment the
//           wallet would keep the float after it. (A player may spend the grant on a hangar on day one - the
//           wallet allows it; the bands measure the pace of the work, not the grant.)
//   fly     each completed contract is ONE contract: the next arc contract the fleet can physically fly (the
//           providers in order: the story is what a player follows), else the best-paying job the fleet can fly
//           (ties by id); flown by the design that can do it (contractDoers within the fleet). Build contracts
//           are left out (their airframe is the player's own design: their pay is held against it separately)
//   buy     in order: a field shed at Tamgas Hill (w3), the C172-class airframe (scratch in the main hangar),
//           a field shed at Skyline (tw_ski)
//   seeds   the bands hold on every one of these career seeds
const ECON_REF = {
  seeds: ['jolene', 'dev', 'econ-a', 'econ-b', 'econ-c', 'econ-d', 'econ-e', 'econ-f'],
  max: 60,
  wish: [
    { m: 'hangar1', k: 'acquire', aero: 'w3', plot: 'w3', shell: 'field' },
    { m: 'airframe', k: 'airframe', design: 'c172' },
    { m: 'hangar2', k: 'acquire', aero: 'tw_ski', plot: 'tw_ski', shell: 'field' },
  ],
  // what each validated design wants of a hangar (hangarWants on its build file; GATE ECON re-derives it)
  wants: { cub: ['tube'], jodel: ['wood'], c172: ['metal'], c172f: ['metal'], twinf: ['tube'] },
  hour: 12,
};

// the stops that fly one sub (the journey's synthesis: GATE CONTRACTS' own)
function ecStopsFor(sub, hour) {
  const stop = (aero, o) => Object.assign({ how: 'stopped', aero, load: { kg: 0, pax: 0 }, row: { from: null, to: aero, t: 600 }, hour }, o || {});
  const ld = () => ecClone(sub.load || { kg: 0, pax: 0 });
  if (sub.do === 'carry') return [stop(sub.from, { load: ld(), row: { from: 'HOME', to: sub.from, t: 600 } }), stop(sub.to, { load: ld(), row: { from: sub.from, to: sub.to, t: 600 } })];
  if (sub.do === 'land') return [stop(sub.to, { row: { from: 'HOME', to: sub.to, t: 600 } })];
  if (sub.do === 'fly') return [stop(sub.to, { row: { from: sub.from, to: sub.to, t: sub.medals ? Math.min(...sub.medals.map(m => m.le)) - 1 : 600 } })];
  if (sub.do === 'survey') return [stop(sub.from, { row: { from: sub.from, to: sub.from, t: 600 }, overflew: [sub.at] })];
  return [stop(sub.to, { row: { from: 'HOME', to: sub.to, t: 600 } })];
}
const ecFlying = rec => contractSubsOf(rec).filter(s => s.do !== 'deliver' && s.do !== 'accept');
function ecCanFly(rec, fleet) {
  if (!rec || rec.kind === 'build') return null;
  const DS = {};
  for (const k of fleet) if (CONTRACT_DESIGNS[k]) DS[k] = CONTRACT_DESIGNS[k];
  for (const st of rec.stages) { if (!contractDoers(st.subs.filter(s => s.do !== 'deliver' && s.do !== 'accept'), null, DS).length) return null; }
  return contractDoers(ecFlying(rec), null, DS)[0] || Object.keys(DS)[0];
}
// THE POLICY: the next arc contract the fleet can fly (providers in order), else the best-paying job
function econRefPick(doc, fleet) {
  const ids = careerOfferIds(doc), A = contractAuthored();
  for (const p of Object.keys(CONTRACT_PROVIDERS)) {
    const id = ids.find(x => A[x] && CONTRACT_PROVIDERS[p].arc.some(r => r.id === x));
    if (id && ecCanFly(A[id], fleet)) return id;
  }
  let best = null, bp = -1;
  for (const id of ids.slice().sort()) {
    const r = careerContract(doc, id);
    if (!r || r.kind !== 'job' || !ecCanFly(r, fleet)) continue;
    const p = contractPay(r).total;
    if (p > bp) { best = id; bp = p; }
  }
  return best;
}
// fly one contract to its completion (synthesised stops; ACCEPT's hook approving) -> the document. (G2665 NIGHT-OPS) A
// leg with a time-of-day window is flown at its window's middle - the reference WAITS IT OUT, as a player does - on the
// night the job was drawn for (its stamped dusk / dawn) or the constants
function econRefFly(doc, id, hour) {
  let d = careerAccept(doc, id).doc;
  const rec = careerContract(d, id), hooks = { acceptVerdict: () => ({ ok: true, got: {} }) };
  const NT = rec.night || null, alm = NT ? { duskH: NT.duskH, dawnH: NT.dawnH } : {};
  const at = sub => (sub.when && typeof contractWhenMid === 'function' ? contractWhenMid(sub.when, alm.duskH, alm.dawnH) : hour);
  for (const st of rec.stages) for (const sub of st.subs) for (const s of ecStopsFor(sub, at(sub)).map(x => Object.assign(x, sub.when ? alm : {}))) {
    const q = contractOnStop(d, id, s, hooks);
    if (q.ok) d = q.doc;
  }
  return d;
}
// THE REFERENCE CAREER -> { at: { hangar1, airframe, hangar2, arc } (the completed count at each), arcBy, pays,
// spent, doc }. Deterministic: f(seed) and the tables.
function econReference(seed, opts) {
  opts = opts || {};
  const R = Object.assign({}, ECON_REF, opts.ref || {});
  let d = careerNew({ id: 'ref', seed });
  const fleet = ['cub'];
  const float = CAREER_GRANT, at = {}, pays = [];
  let wi = 0, spent = 0, arcBy = null;
  const priceOf = w => w.k === 'acquire' ? plotPrice(w.aero, w.plot, w.shell)
    : econAirframePrice(CONTRACT_DESIGNS[w.design].cost, d.sheds[PREM_MAIN], R.wants[w.design]);
  for (let n = 0; n < R.max; n++) {
    const id = econRefPick(d, fleet);
    if (!id) break;
    const before = d.career.contracts.done.length;
    d = econRefFly(d, id, R.hour);
    const done = d.career.contracts.done;
    if (done.length !== before + 1) break;                      // a contract the synthesis could not complete
    pays.push(done[done.length - 1].pay);
    if (at.arc == null) {
      for (const p of Object.keys(CONTRACT_PROVIDERS)) {
        const arc = CONTRACT_PROVIDERS[p].arc.filter(r => contractCertifiable(contractAuthored()[r.id]));
        if (arc.length && arc.every(r => done.some(x => x.id === r.id))) { at.arc = done.length; arcBy = p; break; }
      }
    }
    while (wi < R.wish.length) {
      const w = R.wish[wi], price = priceOf(w);
      if (d.wallet - price < float) break;
      const r = w.k === 'acquire' ? econAcquire(d, w.aero, w.plot, w.shell)
        : econBuy(d, price, 'airframe', w.design);
      if (!r.ok) break;
      d = r.doc; spent += price; at[w.m] = done.length;
      if (w.k === 'airframe') fleet.push(w.design);
      wi++;
    }
  }
  return { at, arcBy, pays, spent, fleet, doc: d };
}
// every band, on every reference seed -> [{ seed, at, arcBy, ok, why }]
function econCalibration(opts) {
  return ((opts && opts.seeds) || ECON_REF.seeds).map(seed => {
    const r = econReference(seed, opts);
    const why = Object.keys(ECON_BANDS).filter(k => !(r.at[k] >= ECON_BANDS[k][0] && r.at[k] <= ECON_BANDS[k][1]))
      .map(k => k + ' at ' + (r.at[k] == null ? 'never' : r.at[k]) + ', the band ' + ECON_BANDS[k].join('-'));
    return { seed, at: r.at, arcBy: r.arcBy, ok: !why.length, why, wallet: r.doc.wallet, pays: r.pays };
  });
}
