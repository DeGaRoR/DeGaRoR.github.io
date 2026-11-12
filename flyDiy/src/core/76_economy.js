// ===========================================================================
// THE ECONOMY (G2260 ECONOMY, P5a) — ONE PRICE BOOK, THE CAREER WALLET'S
// RULES, THE CALIBRATION AS DATA, AND THE REFERENCE CAREER THAT HOLDS IT.
// futureDesigns/GAME-2026-10-06.md §R (binding: G-COST no running costs,
// contracts pay net, hangars bought never rented, a pilot's one-time sign-on
// fee, GQ5 bring-it-home free, GQ6 no bankruptcy + the Trust's loan job below
// -20 000, GQ23 the 60 000 grant + a Cub voucher), §12, §15 row 8;
// DEFORM-AND-BREAK §10 + dm9-dm12 (the repair bill); §R.4 of 10 Oct (G2705
// CAREER-DAMAGE: REPAIR IS FREE everywhere - the bill is read, never charged).
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
// sign-on fee. NOTHING ELSE: no repair (§R.4, G2705: free), no fuel, no
// maintenance reserve, no wage, no rent, no landing fee, no recovery (GQ5).
// A career's ledger holds grant / contract / loan lines (income) and purchase
// lines (spending; the book keeps its `repair` kind, which nothing writes
// since G2705); `econLedgerClass` names each line's class, and a line of any
// other class is a running cost (GATE ECON refuses one).
//
// THE WALLET'S RULE (GQ6): a PURCHASE needs the cash (refused, the same
// document handed back, with why). A repair is free (G2705), so nothing takes
// the wallet below 0 by itself any more. Below ECON_BOOK.loanBelow
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
//   round        every price rounds to this
//   loanBelow    GQ6: the Trust's loan job is offered while the wallet is BELOW this
//   loanTo       ...and pays the wallet back up to this (rounded up to `loanRound`)
const ECON_BOOK = {
  ref: 'cub',
  // (G3359 ECON-APPLY, the user 23 Oct: "apply the economics table, keep demo time as it is for now"; ECON-SIM G3250 HANDOVER): the shells re-priced
  // (field 1.8 -> 3.6, club 3.2 -> 5.6, works 5.4 -> 8.6 Cubs) - a side field shed at Tamgas Hill 44 960 -> 89 840
  shells: { field: 3.6, club: 5.6, works: 8.6 },
  // THE TABLE'S SINKS NOT YET BUILT INTO THE GAME (G3359: data only, read by nothing in play; tools/econ_sim.js plays them):
  //   landmarks  the co-funding in Cubs; a keystone opens the next segment, the others are optional
  //   rungs      the machine shop's rung of a segment, bought once it opens (its designs cannot be built before)
  //   comps      competitions: entry in Cubs by segment, prizes x the entry for gold / silver / bronze
  landmarks: [
    { id: 'observatory', seg: 1, keystone: true,  cubs: 2.5 }, { id: 'mine-village', seg: 1, keystone: false, cubs: 1.5 },
    { id: 'hydro',       seg: 2, keystone: true,  cubs: 6 },   { id: 'sky-tram',     seg: 2, keystone: false, cubs: 3 },
    { id: 'long-runway', seg: 3, keystone: true,  cubs: 12 },  { id: 'community',    seg: 3, keystone: false, cubs: 5 } ],
  rungs: { 2: { cubs: 0.25, words: 'Sheets and bolts' }, 3: { cubs: 2.5, words: 'Composite and electronics' } },
  comps: { entry: { 1: 0.08, 2: 0.15, 3: 0.25 }, prizes: [3, 1.6, 0.8] },
  kits: { park: 0, bench: 0.05, wood: 0.16, metal: 0.24, store: 0.02, handling: 0.05,
          office: 0.1, comfort: 0.06, curio: 0, wip: 0 },
  // PRICE-CAL 2026-11: ONE maker's margin, over the LEDGER (the core had two: PROCURE's 1.15 over the ledger and this
  // row's 1.35 over a fitted build, 1.08 - a Cub read 35 900 or 33 700 depending on who asked). PROCURE_MARGIN reads it.
  makerMargin: 1.15,
  // PRICE-CAL: THE PAY RIDES THE PRICES. Every absolute money number - CONTRACT_PAY, ROUTES_PAY.perKm, T6's fee,
  // careerNew's grant, the Trust's loan threshold, a maker's delivery - was tuned (G2261, G3359) when the reference
  // Cub's ledger was `payRef`. econPayScale() = econRefPrice() / payRef multiplies each of them, so a re-priced ledger
  // moves the pay with it and the career's paces, which ECON-SIM measured in CONTRACTS, hold by construction.
  payRef: 31203,
  // PRICE-CAL: THE MARKET TIERS, ONE BASE (the user 4 Nov: "the new ones, at the zero damage, plus a new bonus ... that
  // is also the price we'd sell our planes, except if a build contract is fixed price ... even the fixed price may be
  // evaluated using the same method"):
  //   zero     the ZERO-DAYS value: an airframe the day it left the shop, no damage = the ledger x `zeroK`
  //   used     zero x econAgeFactor(age) x (1 - its deductions): the curve 1 at zero days, falling toward `floor` with
  //            `tau` years (fitted on same-type new/used pairs, futureDesigns/price-study/age_curve.js, rms x1.12)
  //   new      zero x (1 + `newBonus`): the first owner's premium, 25 % - the real market's nearly-new plane sells at
  //            ~0.8 of new (the fit's step). zero x 1.25 = the ledger x makerMargin: the makers' catalogue is NEW
  //   sale     the fleet card's Sell: the USED price at its age (`sellK` 1), never more than the player paid - a build in
  //            a fitted hangar (0.8) is worth 0.92 at zero days, and without the cap building to sell would print money
  //   build    a build contract's fixed price is evaluated the same way: the NEW price of the cheapest validated design
  //            that meets it (tools/_price_check.js holds the authored bases to it)
  // The used market draws its listings' ages inside `listAges` (step 2: age now costs performance, 60_ GEN_AGING, so
  // the old planes are back: 1-40 years, their condition held to PROCURE_COND).
  zeroK: 0.92, newBonus: 0.25,
  age: { floor: 0.14, tau: 27.5, listAges: [1, 40], kgPerYear: 0.4, kgMax: 15, olderPerYear: 1 / 30,
         hoursPerYear: [50, 120], weatherAt: 40 },
  sellK: 1,
  signOn: { rookie: 0.08, pilot: 0.16, ace: 0.32 },
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
// THE MAKERS' CATALOGUE PRICE (PROCURE): V0, the new value = the ledger x the one maker's margin
function econCatalogPrice(cost, margin) {
  const m = typeof margin === 'number' && margin > 0 ? margin : ECON_BOOK.makerMargin;
  return econRound((+cost || 0) * m);
}
// THE PAY'S SCALE (PRICE-CAL): the reference Cub's ledger over the one the pay was tuned at
function econPayScale() {
  const r = econRefPrice() / ECON_BOOK.payRef;
  return isFinite(r) && r > 0 ? r : 1;
}
// an absolute money number of the tables (pay, a fee, a grant) at today's prices, rounded as the book rounds
const econPay = v => econRound((+v || 0) * econPayScale());
// THE AGE CURVE (PRICE-CAL): the used value over the zero-days value - 1 at zero days, floor + (1 - floor) e^(-age/tau)
function econAgeFactor(age) {
  const A = ECON_BOOK.age, a = Math.max(0, +age || 0);
  return A.floor + (1 - A.floor) * Math.exp(-a / A.tau);
}
// the zero-days value of a ledger, and the NEW price (zero x (1 + newBonus) = the makers' catalogue)
const econZeroValue = cost => (+cost || 0) * ECON_BOOK.zeroK;
const econNewPrice = cost => econRound(econZeroValue(cost) * (1 + ECON_BOOK.newBonus));
// A USED PLANE'S VALUE: the zero-days value (or { v0 }: a NEW price, its listing's catalogue, taken back to zero days)
// x the age curve x (1 - the deductions: a repair, an older panel, the extra kilos) - { cost } | { v0 }, age, ded
function econUsedValue(o) {
  o = o || {};
  const z = o.v0 != null ? +o.v0 / (1 + ECON_BOOK.newBonus) : econZeroValue(o.cost);
  return econRound(z * econAgeFactor(o.age) * (1 - Math.max(0, Math.min(1, +o.ded || 0))));
}
// WHAT A FLEET AIRFRAME SELLS FOR (the fleet card's Sell): min(sellK x its used value at its age, what the player paid)
// - a story airframe (paid 0) sells for nothing. (doc, slot, cost: its ledger) -> { value, paid, cap, age, why }
// `why` is the refusal when it cannot be sold now: the tutorial (until T6's route is signed - the user 4 Nov: "no sales
// during the tuto, ends when we commit to the cub floats route"), a route flown on it, a story airframe, not ours
function econSaleWhy(doc, slot) {
  const A = doc && doc.career && doc.career.airframes && doc.career.airframes[slot];
  if (!doc || doc.mode !== 'career' || !A) return 'not an airframe of the career';
  if (typeof storyOf === 'function') {
    const st = storyOf(doc);
    if (st && !st.open && ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'].includes(st.beat)) return 'no sales during the tutorial';
  }
  if (typeof routeOfPlane === 'function' && routeOfPlane(doc, slot)) return 'it flies a route: end the route first';
  if (A.from === 'story' || A.client) return 'a story aeroplane is not for sale';
  if (!(+A.paid > 0)) return 'it cost you nothing: not for sale';
  return '';
}
function econSaleValue(doc, slot, cost) {
  const A = doc && doc.career && doc.career.airframes && doc.career.airframes[slot];
  if (!A) return { value: 0, paid: 0, cap: 'not an airframe of the career', age: 0, why: 'not an airframe of the career' };
  const now = typeof econAgingNow === 'function' ? econAgingNow(doc, slot) : null;   // WEAR-PRICE: its age on the clock
  const age = now ? now.years : Math.max(0, +A.age || 0);
  const ded = Math.min(0.5, 0.08 * (+A.repairs || 0) + (A.damage ? 0.1 : 0));
  const v = econRound(ECON_BOOK.sellK * econUsedValue({ v0: A.v0 != null ? A.v0 : null, cost, age, ded }));
  const paid = Math.max(0, Math.round(+A.paid || 0));
  return { value: Math.min(v, paid), paid, cap: v > paid ? 'what it cost you' : '', age: +age.toFixed(2), why: econSaleWhy(doc, slot) };
}
// WHAT A CLIENT PAYS FOR A DELIVERED AIRFRAME (PRICE-CAL; the user 4 Nov: "the new ones, at the zero damage, plus a new
// bonus ... that is also the price we'd sell our planes, except if a build contract is fixed price"): its NEW price
// (the zero-days value + the new bonus) when it is the player's own making (no age), else its USED value at its age (a
// used plane bought cheap and handed over is not a new one). null when its ledger is not on record: the contract's
// authored base stands (the offer's estimate). (A: a career.airframes row)
function econDeliveredValue(A) {
  if (!A) return null;
  const cost = +A.cost > 0 ? +A.cost : (A.v0 != null ? +A.v0 / ECON_BOOK.makerMargin : 0);
  if (!(cost > 0)) return null;
  if (+A.age > 0) return econUsedValue({ cost, age: +A.age, ded: Math.min(0.5, 0.08 * (+A.repairs || 0)) });
  return econNewPrice(cost);
}
// THE SALE (the fleet card's Sell): the airframe out of the fleet and out of career.airframes (74_ careerHandover's
// canonical drop: playerFleetReconcile, its pilot freed), on record (career.sold, `how: 'market'`), the wallet credited
// with its sale value, a `sale` ledger line (income). Refused (the same document) with econSaleWhy's reason.
// (doc, slot, cost: its ledger) -> { ok, doc, why, value }
function econSell(doc, slot, cost) {
  const why = econSaleWhy(doc, slot);
  if (why) return ecNo(doc, why);
  const sv = econSaleValue(doc, slot, cost);
  if (!(sv.value > 0)) return ecNo(doc, 'it is worth nothing on the market');
  const d = ecClone(doc), c = d.career;
  if (d.fleet && d.fleet[slot] && typeof playerFleetReconcile === 'function') {
    const r = playerFleetReconcile(d, Object.keys(d.fleet).filter(n => n !== slot));
    for (const k of Object.keys(r.doc)) if (k !== 'career') d[k] = r.doc[k];
  }
  delete c.airframes[slot];
  for (const p of Object.keys(c.pilots || {})) if (c.pilots[p] && c.pilots[p].plane === slot) c.pilots[p].plane = null;
  c.sold = (Array.isArray(c.sold) ? c.sold : []).concat([{ slot, how: 'market', at: Math.round(d.clock || 0), pay: sv.value, cost: sv.paid }]);
  playerCharge(d, -sv.value, 'sale', slot);
  return { ok: true, doc: d, why: '', value: sv.value };
}
// A PILOT'S SIGN-ON FEE (PILOTS): one time, by tier ('rookie' | 'pilot' | 'ace'); unknown tiers cost a pilot's
function econSignOn(tier) {
  const r = ECON_BOOK.signOn[tier];
  return econRound((typeof r === 'number' ? r : ECON_BOOK.signOn.pilot) * econRefPrice());
}
// THE REPAIR (dm9; G2705 CAREER-DAMAGE). It WAS free (the user's ruling of 10 Oct, §R.4); WEAR-PRICE (the user, 5 Nov:
// "start putting money on the repair and refresh tasks. The repair on breakage should also be there") prices it at the
// parts bill: the bill's lines summed (econRepairBill below writes them; DMG-D5's [{ section | event, line, cost }] has
// the same shape). A crash still resets the aeroplane to where the flight departed from (75_ careerCrashReset); the
// stop now also pays what broke (app.js playerFlightEnd -> econRepairCharge). (bill, labour) -> the sum.
function econRepairCost(bill, labour) {
  return Math.round((Array.isArray(bill) ? bill : (bill && bill.lines) || []).reduce((a, l) => a + Math.max(0, +(l && l.cost) || 0), 0));
}

// ---- THE LEDGER'S CLASSES (G-COST: no running cost anywhere) ---------------------------------------------------
// Every ledger kind the game writes, by class. income: grant, contract, loan. purchase: an airframe, a hangar
// (acquire), its upgrades / kits (upgrade), a sign-on fee. repair: a bill paid. free: a "bring it home" (GQ5:
// always 0) and a hangar released (a refund). Anything else is a running cost.
const ECON_LEDGER = {
  grant: 'grant', contract: 'contract', loan: 'loan',
  airframe: 'purchase', acquire: 'purchase', upgrade: 'purchase', signon: 'purchase', catalogue: 'purchase',
  repair: 'repair',
  restore: 'repair',                                // WEAR-PRICE: a refresh task bought (a repaint, an overhaul)
  sale: 'sale',                                     // PRICE-CAL: an airframe sold on the market (econSell): income
  story: 'grant',                                   // the story's sign-on top-up (T6): money given, like a grant
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
    // (PRICE-CAL: `cost` its LEDGER - what a client pays for it delivered, and the market for it sold, read it)
    C.airframes[slot] = Object.assign({}, C.airframes[slot] || {}, { paid: price, cost: Math.round(+cost || 0), how: opts.how || 'scratch', at: Math.round(r.doc.clock || 0) },
      opts.podPaid > 0 ? { podPaid: Math.round(opts.podPaid) } : {});   // G3465: its belly pod is in that price (76_procure: not billed twice)
  return { ok: true, doc: r.doc, cost: price, why: '' };
}
// a hangar bought (71_ playerAcquire: needs the cash) / changed (playerUpgrade: shell, size, kits)
const econAcquire = (doc, aero, plot, shell) => playerAcquire(doc, aero, plot, shell, 'own');
const econUpgrade = (doc, hangarId, change, opts) => playerUpgrade(doc, hangarId, change, opts);
// the airframes in the fleet that could fly now (a damaged one is grounded until repaired: dm10)
const econFlyable = doc => Object.keys((doc && doc.fleet) || {}).filter(n => !(doc.fleet[n] && doc.fleet[n].damage && doc.fleet[n].damage.damaged));
// THE REPAIR (dm9, dm10; G2705: FREE): an explicit Repair, in both modes, wherever it stands - nothing in the
// wallet, no ledger line (the sandbox records no "would cost" either: there is no cost). A write-off has no
// Repair (dm10). The fleet row's `damage` (D5's record) is cleared; the wear resets (G2230). (opts: unused, kept)
function econRepair(doc, slot, opts) {
  const e = doc && doc.fleet && doc.fleet[slot];
  if (!e) return ecNo(doc, slot + ' is not in the fleet');
  const D = e.damage;
  if (!D || !D.damaged) return ecNo(doc, slot + ' is not damaged');
  if (D.writeOff) return ecNo(doc, slot + ' is a write-off: scrap it or sell it as salvage');
  let d = ecClone(doc);
  delete d.fleet[slot].damage;
  if (typeof playerWearReset === 'function') d = playerWearReset(d, slot).doc;
  // WEAR-PRICE: the bill paid (the sandbox records it free; the tutorial bills nothing - econWorkFreeWhy)
  const cost = econWorkFreeWhy(d) && d.mode === 'career' ? 0 : econRepairCost(D.bill);
  if (cost > 0) playerCharge(d, cost, 'repair', slot);
  return { ok: true, doc: d, cost, why: '' };
}

// ---- WEAR-PRICE (2026-11-05; futureDesigns/WEAR-SYSTEM-2026-11.md §8, the user's answers: "1. Yes [your own planes age
// on the career's clock], and when building, you can set the age of the plane. 2. No [age withdraws no certificate].
// 3. No running costs for now. 4. Parts price. 5. Yes [rough use acts through the damage model] - and you can start
// putting money on the repair and refresh tasks. The repair on breakage should also be there.") ----------------------
// THE AIRFRAME'S AGE, ON THE CAREER'S CLOCK. The career's airframe row carries `aging` (econAgingNow below): its age
// and its engine's hours since overhaul when it joined the fleet (a build: what the builder set on the WEAR tab; a used
// listing: its age and hours), growing with the clock and the hours flown at its upkeep's rate.
// No running cost: nothing is billed for time passing (the user's ruling 3); the age costs power and drag (60_
// GEN_AGING) and value (econAgeFactor), and a restore buys them back.
// THE PRICES ARE THE PARTS BILL (ruling 4; PRICE-STUDY's convention: the labour free). Every number is the ledger's
// own row or a row of POWERPLANTS / the prop's; the factors below are JUDGEMENT where marked.
const ECON_WEAR = {
  year: 365.25 * 86400, flownPerYear: 100,
  // an overhaul: the engine row (an overhauled / exchange price) x ovhK - anchored on the A-65: a shop overhaul ~9.5k
  // against its 11k row (Aviation Consumer, PRICE-STUDY §B); JUDGEMENT beyond that anchor
  ovhK: 0.85,
  // a teardown inspection after a strike or an overspeed's 'inspect' band (Lycoming SB 533 / SB 369: the engine
  // opened, no internal damage found): JUDGEMENT, the parts of a teardown (gaskets, bolts, the crank flange's check)
  teardownK: 0.1,
  // an engine mount group broken: a welded mount ~ a tenth of the engine row (a J-3 mount new ~1-3k): JUDGEMENT
  mountK: 0.1,
  // a crash's fuselage share when no group parted but the airframe came to rest wrecked (skin, longerons dented):
  // JUDGEMENT; a break-up (the fuselage parted) bills the whole fuselage section
  crashK: 0.25,
  // the upkeep's rate on the age and the engine's wear (econCareK): JUDGEMENT
  care: { perfect: 0.5, normal: 1, poor: 2 },
  // a rebuild's frame work: this share of the structure's ledger (fuselage, wings, bracing, tail, gear): JUDGEMENT
  rebuildK: 0.3,
};
// the resolved spec's engine and prop prices: each engine's row and each prop's (60_ resolveSpec writes prop.price)
function econPowerPrices(R) {
  const engs = (R && Array.isArray(R.engines) && R.engines.length) ? R.engines : (R && R.engine ? [R.engine] : []);
  // (ENGINE-DIALS: a custom engine is priced as its own row - resolveSpec's market curve - never the registry row of its
  // fallback key, the A-65's 11 000 for every custom engine)
  const one = e => { if (e && typeof e === 'object' && e.custom && isFinite(+e.custom.price)) return +e.custom.price;
                     const k = typeof e === 'string' ? e : e && (e.type || e.engine); const P = k && POWERPLANTS[k]; return P ? +P.price || 0 : 0; };
  const n = Math.max(1, engs.length);
  const eng = engs.map(one);
  return { n, engine: eng.length ? eng : [0], prop: Math.round(+(R && R.prop && R.prop.price) || 0) };
}
// which ledger section a damage group bills (61_ parts.dmg.groups keys: 'wing0R:root', 'wing0L:strut', 'gearL:gear',
// 'tw:gear', 'stab:attach', 'fin:attach', 'eng:mount' ...)
function econGroupSection(key) {
  const k = String(key || '');
  if (/^wing\d*[LR]?:strut/.test(k)) return 'bracing';
  if (/^wing/.test(k)) return 'wings';
  if (/^(gear|tw|nose|float)/.test(k)) return 'gear';
  if (/^(stab|fin|tail|elev|rud)/.test(k)) return 'tail';
  if (/^eng/.test(k)) return 'engines';
  return 'fuselage';
}
// THE BREAKAGE'S BILL (ruling 5: "the repair on breakage should also be there"): what the flight broke, at the parts
// price. R the resolved spec, ledger def.parts.ledger, groups the def's damage groups (def.parts.dmg.groups), dmg =
// { groups: [key] the groups broken (sim.damage().groups), drive: [state] (sim.damage().drive), crashed, brokeUp }.
// A broken group bills its section's ledger shared by the groups that section holds (a Cub's wing root: half the
// wings); the engine mount, the strike's teardown or overhaul and a new prop are the powerplant's rows. Nothing broken:
// nothing billed. -> { cost, lines: [{ what, cost }] }
function econRepairBill(R, ledger, groups, dmg) {
  const L = ledger || {}, D = dmg || {}, lines = [];
  const per = {};
  for (const g of (groups || [])) { const s = econGroupSection(g && g.key != null ? g.key : g); per[s] = (per[s] || 0) + 1; }
  const PP = econPowerPrices(R);
  const engAvg = PP.engine.reduce((a, b) => a + b, 0) / PP.engine.length;
  const seen = new Set();
  for (const g of (D.groups || [])) {
    const key = g && g.key != null ? g.key : g;
    if (seen.has(key)) continue; seen.add(key);
    const s = econGroupSection(key);
    const c = s === 'engines' ? engAvg * ECON_WEAR.mountK : ((L[s] && +L[s].cost) || 0) / Math.max(1, per[s] || 1);
    if (c > 0) lines.push({ what: String(key), cost: Math.round(c) });
  }
  if (D.brokeUp) lines.push({ what: 'fuselage', cost: Math.round((L.fuselage && +L.fuselage.cost) || 0) });
  else if (D.crashed) lines.push({ what: 'fuselage (dents)', cost: Math.round(((L.fuselage && +L.fuselage.cost) || 0) * ECON_WEAR.crashK) });
  (D.drive || []).forEach((st, i) => {
    if (!st) return;
    const e = PP.engine[Math.min(i, PP.engine.length - 1)] || engAvg;
    const over = st.os === 'overhaul' || st.os === 'failed' || st.failed || st.internal;
    if (over) lines.push({ what: 'engine ' + (i + 1) + ' overhaul', cost: Math.round(e * ECON_WEAR.ovhK) });
    else if (st.teardown || st.os === 'inspect' || (st.strike && st.strike !== 'brush'))
      lines.push({ what: 'engine ' + (i + 1) + ' teardown', cost: Math.round(e * ECON_WEAR.teardownK) });
    if (st.strike && st.strike !== 'brush') lines.push({ what: 'propeller ' + (i + 1), cost: Math.round(PP.prop / PP.n) });
  });
  const kept = lines.filter(l => l.cost > 0);
  return { cost: kept.reduce((a, l) => a + l.cost, 0), lines: kept };
}
// is this airframe's work free now? the sandbox records it free (playerCharge); the TUTORIAL (until T6's route is
// signed, as the sale's rule) bills nothing, so a crash cannot sink the story's budget. '' = billed
function econWorkFreeWhy(doc) {
  if (!doc || doc.mode !== 'career') return 'the sandbox';
  if (typeof storyOf === 'function') { const st = storyOf(doc); if (st && !st.open && ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6'].includes(st.beat)) return 'free during the tutorial'; }
  return '';
}
// THE MAINTENANCE (the user, 5 Nov: "rate of decay should offer 3 options; perfect maintenance, normal maintenance,
// poor maintenance, and that's about it"): how fast the clock and the hours wear the airframe - the years' drag and the
// engine's hours both accrue x `care[k]` (JUDGEMENT: half as fast kept to the book and hangared, twice as fast skipped;
// the physics itself, 60_ GEN_AGING, reads only years and hours). AUTHORED (the user: "the idea with the rate selector
// is rather to author second hand planes and set this myself, then publish and locked in career"): set on the WEAR tab
// while building, carried in spec.aging.care, started with the row and LOCKED in a career. Rough use is not a rate: it
// acts through the damage model (the repair). Absent = normal. No running cost (ruling 3).
const ECON_CARE = ['perfect', 'normal', 'poor'];
const econCareK = c => ECON_WEAR.care[c] != null ? ECON_WEAR.care[c] : 1;
// THE ROW'S RECORD: aging = { years, engineHours, care, at, fl } - the age and the engine's (as-worn) hours SETTLED at
// clock `at`, with `fl` the seconds flown since that settle. Now: years + k x max(calendar years since `at`, hours
// flown since / flownPerYear) (whichever runs first: a career's clock runs days, the hours lead); hours + k x flown.
function econAgingNow(doc, slot) {
  const A = doc && doc.career && doc.career.airframes && doc.career.airframes[slot];
  const g = A && A.aging;
  if (!g || typeof g !== 'object') return null;
  const W = ECON_WEAR, k = econCareK(g.care), flH = Math.max(0, +g.fl || 0) / 3600;
  const dt = Math.max(0, (+(doc.clock) || 0) - (+g.at || 0)) / W.year;
  const years = Math.max(0, +g.years || 0) + k * Math.max(dt, flH / W.flownPerYear);
  const engineHours = Math.max(0, +g.engineHours || 0) + k * flH;
  return { years: Math.round(years * 10) / 10, engineHours: Math.round(engineHours), care: ECON_CARE.includes(g.care) ? g.care : 'normal' };
}
// the record settled to now (the accrued folded in at its rate; `at` the clock, nothing flown since)
function econAgingSettle(doc, slot) {
  const n = econAgingNow(doc, slot);
  if (!n) return doc;
  const d = ecClone(doc), g = d.career.airframes[slot].aging;
  g.years = n.years; g.engineHours = n.engineHours; g.at = Math.round(d.clock || 0); g.fl = 0;
  return d;
}
// the age a spec carries now: its own `aging` replaced by the row's (absent when the row's age is 0 at normal upkeep)
function econAgingSpec(spec, now) {
  if (!spec || typeof spec !== 'object' || !now) return spec;
  const s = Object.assign({}, spec);
  const care = ECON_CARE.includes(now.care) && now.care !== 'normal' ? now.care : null;
  if (!(now.years > 0) && !(now.engineHours > 0) && !care) delete s.aging;
  else s.aging = Object.assign({ years: now.years || 0, engineHours: now.engineHours || 0 }, care ? { care } : {});
  return s;
}
// the row starts its age: a build at what the builder set (spec.aging, its upkeep too), a used airframe at its listing's
function econAgingStart(doc, slot, aging) {
  const A = doc && doc.career && doc.career.airframes && doc.career.airframes[slot];
  if (!A) return doc;
  const d = ecClone(doc);
  // (no age given: the row's own - a used airframe bought before WEAR-PRICE carries `age` and `hours`; else new)
  const a = aging || { years: A.age || 0, engineHours: A.hours || 0 };
  d.career.airframes[slot].aging = { years: Math.max(0, +a.years || 0), engineHours: Math.max(0, +a.engineHours || 0),
    care: ECON_CARE.includes(a.care) ? a.care : 'normal', at: Math.round(d.clock || 0), fl: 0 };
  return d;
}
// a flight's seconds on the row (a row with no age record starts one at its own age)
function econAgingFlown(doc, slot, seconds) {
  const A = doc && doc.career && doc.career.airframes && doc.career.airframes[slot];
  const s = Math.max(0, +seconds || 0);
  if (!A || !(s > 0)) return doc;
  const d = A.aging ? ecClone(doc) : econAgingStart(doc, slot, null);
  d.career.airframes[slot].aging.fl = Math.round((+d.career.airframes[slot].aging.fl || 0) + s);
  return d;
}
// THE REFRESH TASKS (ruling 5's "refresh"; the study §4): their price at the parts bill, off the areas the frame built
// (61_ parts.cover: painted m2, cloth m2) and the powerplant rows. On a CAREER airframe only (the sandbox sets the age
// and the look itself, free); refused while it is broken (the repair first).
//   repaint   the paint (GEN_PRICES.paintM2 x the painted area): the LOOK new - a repaint is not a restoration: the
//             age, the engine and the value do not move
//   recover   (a fabric aeroplane) the cloth's materials (coverM2 x its area) and its paint: the airframe's condition
//             years to 0 (old fabric, dope and rigging are the years' drag) and the look new; the engine untouched
//   overhaul  each engine row x ovhK: the engine's hours to 0 (its power back to rated)
//   rebuild   recover (or repaint, on metal) + overhaul + `rebuildK` of the structure's ledger (the frame inspected, its
//             corrosion and old repairs made good: JUDGEMENT): the years and the hours to 0, the look new
// The value reads the condition years (econSaleValue), and the sale stays capped at what was paid: no loop prints money.
// -> { cost, what } (cost 0: nothing to buy - a recover on a metal aeroplane)
const ECON_RESTORES = ['repaint', 'recover', 'overhaul', 'rebuild'];
const ECON_STRUCT_SECS = ['fuselage', 'wings', 'bracing', 'tail', 'gear'];
function econRestoreCost(kind, R, ledger, cover) {
  const L = ledger || {}, C = cover || null;
  const paint = C ? GEN_PRICES.paintM2 * (+C.paintA || 0) : ((L.paint && +L.paint.cost) || 0);
  const cloth = C ? GEN_PRICES.coverM2 * (+C.clothA || 0) : 0;
  const ovh = econPowerPrices(R).engine.reduce((a, b) => a + b, 0) * ECON_WEAR.ovhK;
  const struct = ECON_STRUCT_SECS.reduce((a, k) => a + ((L[k] && +L[k].cost) || 0), 0) * ECON_WEAR.rebuildK;
  if (kind === 'repaint') return { cost: Math.round(paint), what: 'a fresh paint job (the paint, at the parts price)' };
  if (kind === 'recover') return cloth > 0 ? { cost: Math.round(cloth + paint), what: 'new fabric and its paint (the airframe\'s years back to 0)' }
                                           : { cost: 0, what: 'no fabric to recover' };
  if (kind === 'overhaul') return { cost: Math.round(ovh), what: 'the engine overhauled (zero hours)' };
  if (kind === 'rebuild') return { cost: Math.round(cloth + paint + ovh + struct), what: 'a rebuild: the frame, the covering, the engine (the airframe as new)' };
  return { cost: 0, what: kind + ' is not a refresh task' };
}
// a refresh task done: needs the cash in a career (a refusal hands the document back); the row records it. The PAGE
// applies its look / spec. -> { ok, doc, cost, why }
function econRestore(doc, slot, kind, cost) {
  if (!ECON_RESTORES.includes(kind)) return ecNo(doc, kind + ' is not a refresh task');
  const A = doc && doc.career && doc.career.airframes && doc.career.airframes[slot];
  if (doc && doc.mode === 'career' && !A) return ecNo(doc, slot + ' is not an airframe of the career');
  if (typeof playerBroken === 'function' && playerBroken(doc, slot)) return ecNo(doc, slot + ' is broken: repair it first');
  cost = Math.max(0, Math.round(+cost || 0));
  if (!(cost > 0)) return ecNo(doc, 'nothing to buy');
  if (!econAfford(doc, cost)) return ecNo(doc, 'the wallet holds ' + Math.round(doc.wallet) + ', this costs ' + cost);
  const d = ecClone(doc);
  playerCharge(d, cost, 'restore', slot);
  let out = d;
  if (A) {
    if (kind !== 'repaint') {
      out = A.aging ? econAgingSettle(d, slot) : econAgingStart(d, slot, null);
      const g = out.career.airframes[slot].aging;
      if (kind === 'overhaul' || kind === 'rebuild') g.engineHours = 0;
      if (kind === 'recover' || kind === 'rebuild') g.years = 0;
    }
    const R2 = out.career.airframes[slot];
    R2.restored = Object.assign({}, R2.restored || {}, { [kind]: Math.round(out.clock || 0) });
  }
  if (typeof playerWearReset === 'function' && out.fleet && out.fleet[slot] && kind !== 'overhaul') out = playerWearReset(out, slot).doc;
  return { ok: true, doc: out, cost, why: '' };
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
  if (!doc || doc.mode !== 'career' || !(doc.wallet < ECON_BOOK.loanBelow * econPayScale())) return null;
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

// ---- CERT-GATES: THE SHADY CONTRACTS ("no questions asked") ---------------------------------------------------------
// (the user 3 Nov: "a few contracts which are a little more shady where the certification is not required"; C: they
// pay MORE than normal work - risk money - give NO reputation, and cost reputation on a crash.) At most one per offer
// refresh, from the second on (epoch >= 1), on the existing board under an unnamed contact (the Field Trust's tab holds
// the card: no new world content). Never passengers: a parcel with no paperwork (5-20 kg), a survey "for a private
// client", or a part-built aeroplane ferried (flown, nothing aboard). It leans to the far and the short (a strip of 400 m
// or less, the longer routes) and to the dark (a night or dawn arrival at 70 %, the board's own night windows).
// WHY THE CERTIFICATE STAYS WORTH HAVING: one such job per refresh against the board's fifteen; no reputation from it;
// a crash with one accepted costs EVERY provider 0.5 (rep runs 0-5, a board job gains 0.1: five jobs each); and the
// stories, the orders and the passengers stay closed to an uncertified plane.
const ECON_SHADY = { payX: 1.5, crashRep: 0.5, kg: [5, 20], nightP: 0.7, fromEpoch: 1, shortM: 400, tries: 12,
                     kinds: { parcel: 0.5, survey: 0.3, ferry: 0.2 } };
const ECON_SHADY_TEXT = {
  'job.shady.parcel.title': { t: 'No questions asked: a parcel', draft: true },
  'job.shady.parcel.brief': { t: 'A parcel for {to}, no paperwork, no names. Land, leave it by the hangar, leave.', draft: true },
  'job.shady.survey.title': { t: 'No questions asked: a look', draft: true },
  'job.shady.survey.brief': { t: 'A private client wants pictures of {at}. Fly over it, come back, forget the place.', draft: true },
  'job.shady.ferry.title': { t: 'No questions asked: a ferry', draft: true },
  'job.shady.ferry.brief': { t: 'Someone\'s half-finished aeroplane has to be at {to}. Fly it there; nobody asks what it is.', draft: true },
};
if (typeof CONTRACT_TEXT !== 'undefined') for (const k of Object.keys(ECON_SHADY_TEXT)) if (!CONTRACT_TEXT[k]) CONTRACT_TEXT[k] = ECON_SHADY_TEXT[k];
function econShadyOffer(doc) {
  const c = doc && doc.career;
  if (!c || doc.mode !== 'career' || typeof contractEpoch !== 'function') return null;
  const e = contractEpoch(c.contracts.done.length);
  if (e < ECON_SHADY.fromEpoch) return null;
  const id = 'shady:' + e;
  if ((c.contracts.failed || []).some(f => f.id === id)) return null;   // crashed once: not offered again
  return id;
}
function econShadyJob(doc, id) {
  const m = /^shady:(\d+)$/.exec(id || '');
  if (!m || typeof contractRng !== 'function') return null;
  const c = doc && doc.career, seed = c ? c.seed : '';
  const sky = c && typeof careerOfferSky === 'function' ? careerOfferSky(doc) : undefined;
  const F = CONTRACT_FIELDS, land = Object.keys(F).filter(k => F[k].surf !== 'water');
  for (let t = 0; t < ECON_SHADY.tries; t++) {
    const rng = contractRng(seed + '|' + id + '|' + t);
    const kind = ctPick(rng, Object.keys(ECON_SHADY.kinds), k => ECON_SHADY.kinds[k]);
    const from = ctPick(rng, land, k => (F[k].len > ECON_SHADY.shortM ? 1 : 0));
    // the far and the short: a short strip weighs three times, and every strip by its distance
    const to = ctPick(rng, land.filter(k => k !== from), k => (F[k].len <= ECON_SHADY.shortM ? 3 : 1) * (contractKm(from, k, F) || 0));
    if (!from || !to) continue;
    let stages;
    if (kind === 'survey') stages = [{ subs: [{ do: 'survey', from, at: to }] }, { subs: [{ do: 'land', to: from }] }];
    else if (kind === 'ferry') stages = [{ subs: [{ do: 'fly', from, to }] }];
    else stages = [{ subs: [{ do: 'carry', from, to, load: { kg: ctDraw(rng, ECON_SHADY.kg[0], ECON_SHADY.kg[1], 1, 1), pax: 0 } }] }];
    if (!contractDoers([].concat(...stages.map(s => s.subs)), F).length) continue;
    // the dark: a night or dawn arrival at 70 % (the board's own windows, 73_ ctNightOf, drawn until one opens)
    let nt = null;
    if (sky !== null && kind !== 'survey' && rng() < ECON_SHADY.nightP)
      for (let k = 0; k < 16 && !nt; k++) nt = ctNightOf(seed + '|' + id + '|' + t + '|' + k, sky !== undefined ? sky : contractSky(CONTRACT_NIGHT.sky0, 0));
    if (nt) stages[stages.length - 1].subs[0].when = nt.when;
    const rec = contractNormalise(Object.assign({
      id, provider: 'field', kind: 'job', title: 'job.shady.' + kind + '.title', brief: 'job.shady.' + kind + '.brief', shady: kind,
      stages, pay: { base: 0 }, rep: { provider: 'field', gain: 0 }, repeat: false, seed: String(seed), epoch: +m[1],
    }, nt ? { night: nt.night } : {}));
    const P = contractPay(rec, F);
    rec.pay = Object.assign(P, { total: Math.round(P.total * ECON_SHADY.payX / CONTRACT_PAY.round) * CONTRACT_PAY.round, shadyX: ECON_SHADY.payX });
    return rec;
  }
  return null;
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
// (G3359 ECON-APPLY: the user's table re-priced the shells x2 - the reference career, measured on the applied tree on 24
// Oct over the 8 seeds: hangar1 13-14, airframe 20-21, arc 21-22, hangar2 27-30; the bands re-derived around them, the
// table speaking, not a regression. Before: hangar1 6-10, airframe 12-20, hangar2 20-27)
const ECON_BANDS = {
  hangar1:  [11, 16],    // the first side hangar
  airframe: [16, 24],    // a C172-class airframe (CONTRACT_DESIGNS.c172, materialised in the main hangar)   (G2260: 15-25)
  hangar2:  [24, 33],    // the second side hangar                                                         (G2260: 25-35)
  arc:      [16, 31],    // a full arc: the first provider whose whole arc is complete (its track at its last stage) (G2260: 20-40)
};
// THE REFERENCE CAREER the bands are measured on (econReference). Stated, so the numbers mean something:
//   start   careerNew (GQ23: the 60 000 grant, the voucher Cub - the fleet's first airframe, free)
//   float   the grant is the career's FLOAT - its first airframe of its own, a build contract's airframe (a
//           repair was one; free since G2705) - and the milestones are bought from what contracts pay: a purchase is made the moment the
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
  const float = careerGrant(), at = {}, pays = [];
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
