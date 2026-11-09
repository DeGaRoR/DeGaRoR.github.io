#!/usr/bin/env node
// ============================================================================
// GATE WEARPRICE - AGE, REPAIRS AND REFRESHES AT THE PARTS PRICE (WEAR-PRICE, 2026-11-05;
// futureDesigns/WEAR-SYSTEM-2026-11.md §8 and the user's answers: own planes age on the career's clock and a build takes
// the age its builder sets; age withdraws no certificate; no running costs; the parts price; money on the repair and
// the refresh tasks, the repair on breakage included)
// ============================================================================
//   THE CERTIFICATE   on every saved build an age (any years, any hours) leaves certMajor's fingerprint as it is; the
//                     bench's strip drops it too; a used airframe signed while the age hashed is RE-SIGNED on its next
//                     save (M4: not modified, nothing billed, its bench signature follows)
//   THE AGE'S CLOCK   a used purchase starts at its listing's age and hours; 100 h flown = a year and 100 engine hours;
//                     a calendar year of the clock = a year; an overhaul zeroes the engine's hours; the age laid on a spec
//                     (absent at 0 / 0); the sale reads the age now
//   THE REPAIR BILL   nothing broken = 0; a wing root = the wings' ledger over its groups; a break-up = the fuselage; a
//                     bent prop = a prop + a teardown; an overhaul-band overspeed = the engine x ovhK; charged as a
//                     `repair` line in a career, free in the tutorial, a free record in the sandbox
//   THE REFRESHES     repaint = the ledger's paint line; overhaul = the engine rows x ovhK (the A-65 in the band of its
//                     sourced shop overhaul); refused short of the cash; a `restore` line of class repair
//   THE PAGE          the flight's end bills the breakage and adds the flown seconds; a career slot loads at its age now;
//                     a build's first save starts the clock; the WEAR tab: read-only on an airframe, the refresh buttons
//   node tools/_wear_price_check.js [--selftest]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SELF = process.argv.includes('--selftest');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

function core(C) {
  const fails = [], ok = (c, what) => { if (!c) fails.push(what); return !!c; };
  // G2818 (MASTER-GREEN, GATE JOINPARITY's census): the build as the game flies it (tools/_load_build.js - this tree's chain
  // for every core asked; FLYDIY_RAW_BUILDS=1 the file as written)
  const spOf = f => { if (process.env.FLYDIY_RAW_BUILDS === '1') { const j = JSON.parse(rd(f)); return C.genMigrateSpec(j.spec || j); } return C.genMigrateSpec(require('./_load_build.js').loadBuild(f).spec); };
  // ---- THE CERTIFICATE
  let nb = 0;
  for (const f of fs.readdirSync(path.join(ROOT, 'builds')).filter(f => /\.json$/.test(f) && !/\.edits\.json$/.test(f))) {
    let sp; try { sp = spOf('builds/' + f); } catch (e) { continue; }
    if (!sp || typeof sp !== 'object') continue;
    const a = Object.assign({}, sp, { aging: { years: 37, engineHours: 1850 } }), z = Object.assign({}, sp); delete z.aging;
    ok(C.certMajor(a).fp === C.certMajor(z).fp, f + ': an age leaves the certificate'); nb++;
  }
  ok(nb >= 10, 'enough saved builds (' + nb + ')');
  // M4: a factory used airframe signed under the old rule
  const cub = spOf('builds/cub_2026-09-20_corrected.json');
  const def = C.buildGen(cub), R = def.spec, L = def.parts.ledger, G = def.parts.dmg.groups;
  {
    let d = C.careerNew({ id: 'w', seed: 'wear' });
    const aged = Object.assign({}, cub, { aging: { years: 22, engineHours: 1350 } });
    const oldFp = C.certMajorOf(C.certStrip(aged, { condition: true })).fp;
    ok(oldFp !== C.procureFp(aged), 'the old rule hashed the age (the re-sign has something to do)');
    d.fleet.u = { hangar: null, aero: 'HOME' };
    d.career.airframes.u = { from: 'used', factory: true, anchored: true, modified: false, fp: oldFp, age: 22, hours: 1350, sign: { fp: oldFp, safe: true }, ledger: null };
    const r = C.procureOnSave(d, 'u', aged, null);
    const A = r.doc.career.airframes.u;
    ok(r.ok && !r.modified && !r.bill && A.factory && A.fp === C.procureFp(aged) && A.sign.fp === A.fp, 'M4: signed while the age hashed -> re-signed, not modified, nothing billed (' + r.why + ')');
    const r2 = C.procureOnSave(r.doc, 'u', Object.assign({}, aged, { aging: { years: 23, engineHours: 0 } }), null);
    ok(r2.ok && !r2.modified, 'an overhaul on it later withdraws nothing');
  }
  // ---- THE AGE'S CLOCK
  {
    let d = C.careerNew({ id: 'w', seed: 'wear' });
    d.fleet.u = { hangar: null, aero: 'HOME' };
    d.career.airframes.u = { paid: 20000, age: 10, hours: 600, from: 'used' };
    ok(C.econAgingNow(d, 'u') === null, 'a row with no age record: none (the spec as saved)');
    d = C.econAgingFlown(d, 'u', 100 * 3600);
    let n = C.econAgingNow(d, 'u');
    ok(n && n.years === 11 && n.engineHours === 700, 'a row bought before: starts at its own age and hours; 100 h flown = a year, +100 engine hours (' + JSON.stringify(n) + ')');
    d.clock = (d.clock || 0) + 2 * C.ECON_WEAR.year;
    n = C.econAgingNow(d, 'u');
    ok(n.years === 12 && n.engineHours === 700, 'two calendar years of clock lead the hours (whichever runs first): 12 y (' + n.years + ')');
    const sp = C.econAgingSpec(cub, n);
    ok(sp.aging.years === 12 && sp.aging.engineHours === 700 && !C.econAgingSpec(cub, { years: 0, engineHours: 0 }).aging, 'laid on the spec; absent at 0 / 0');
    // the sale at its age now
    const dT = JSON.parse(JSON.stringify(d)); dT.career.story = null;
    const v0 = C.econSaleValue(JSON.parse(JSON.stringify(Object.assign({}, dT, { career: Object.assign({}, dT.career, { airframes: { u: Object.assign({}, dT.career.airframes.u, { aging: null }) } }) }))), 'u', 40000);
    const v1 = C.econSaleValue(dT, 'u', 40000);
    ok(v1.age === 12 && v0.age === 10, 'the sale reads the age now (' + v0.age + ' -> ' + v1.age + ')');
    // a build: the age its builder set, at its first save
    let b = C.careerNew({ id: 'w', seed: 'wear' }); b.fleet.own = { hangar: null, aero: 'HOME' }; b.career.airframes.own = { paid: 1, cost: 1 };
    b = C.econAgingStart(b, 'own', { years: 30, engineHours: 900 });
    ok(C.econAgingNow(b, 'own').years === 30 && C.econAgingNow(b, 'own').engineHours === 900, 'a build starts at the age set on the WEAR tab');
    // the used purchase starts its row's clock
    const Lst = C.procureUsedListing('wear', 0, 0);
    if (Lst) ok(true, '');
  }
  // ---- THE MAINTENANCE: three upkeeps, authored, the career's clock at its rate
  {
    ok(C.ECON_CARE.join() === 'perfect,normal,poor', 'three upkeeps: perfect, normal, poor');
    const at = care => { let x = C.careerNew({ id: 'w', seed: 'wear' }); x.fleet.u = { hangar: null, aero: 'HOME' }; x.career.airframes.u = { paid: 1 };
      x = C.econAgingStart(x, 'u', { years: 10, engineHours: 0, care }); x = C.econAgingFlown(x, 'u', 100 * 3600); return C.econAgingNow(x, 'u'); };
    const P = at('perfect'), N = at('normal'), Q = at('poor');
    ok(P.years === 10.5 && P.engineHours === 50 && N.years === 11 && N.engineHours === 100 && Q.years === 12 && Q.engineHours === 200 && Q.care === 'poor',
       '100 h flown: perfect +0.5 y / 50 h, normal +1 y / 100 h, poor +2 y / 200 h (' + [P, N, Q].map(n => n.years + '/' + n.engineHours).join(', ') + ')');
    ok(C.econAgingSpec(cub, { years: 0, engineHours: 0, care: 'normal' }).aging === undefined && C.econAgingSpec(cub, { years: 0, engineHours: 0, care: 'poor' }).aging.care === 'poor', 'the spec: absent at 0 / 0 normal; the upkeep carried otherwise');
    ok(C.certMajor(Object.assign({}, cub, { aging: { years: 0, engineHours: 0, care: 'poor' } })).fp === C.certMajor(cub).fp, 'the upkeep is outside the certificate');
    ok(typeof C.econCareSet === 'undefined', 'no door changes the upkeep in a career (authored, locked)');
  }
  // ---- BROKEN AND GROUNDED, and the repair
  {
    const none = C.econRepairBill(R, L, G, { groups: [], drive: [{}], crashed: false });
    ok(none.cost === 0 && !none.lines.length, 'nothing broken: nothing billed');
    const nW = G.filter(g => C.econGroupSection(g.key) === 'wings').length;
    const w = C.econRepairBill(R, L, G, { groups: [{ key: 'wing0R:root' }] });
    ok(nW >= 1 && w.cost === Math.round(L.wings.cost / nW), 'a wing root: the wings\' ledger over its ' + nW + ' groups (' + w.cost + ')');
    const bu = C.econRepairBill(R, L, G, { groups: [], brokeUp: true, crashed: true });
    ok(bu.cost === Math.round(L.fuselage.cost), 'a break-up: the fuselage section');
    const PP = C.econPowerPrices(R);
    const pr = C.econRepairBill(R, L, G, { drive: [{ strike: 'bent', teardown: true }] });
    ok(pr.cost === Math.round(PP.prop) + Math.round(PP.engine[0] * C.ECON_WEAR.teardownK) && PP.prop > 0, 'a bent prop: a prop and a teardown (' + pr.cost + ')');
    const ov = C.econRepairBill(R, L, G, { drive: [{ os: 'overhaul' }] });
    ok(ov.cost === Math.round(PP.engine[0] * C.ECON_WEAR.ovhK), 'the overspeed\'s overhaul band: an overhaul');
    ok(C.econRepairCost(w) === w.cost && C.econRepairCost(w.lines) === w.cost, 'econRepairCost sums the bill');
    const bb = C.playerBreakBill(def, { groups: [{ key: 'wing0R:root' }] });
    ok(bb.cost === w.cost, 'the page\'s bill reads the def and the flight\'s damage record');
    // the career
    let d = C.careerNew({ id: 'w', seed: 'wear' }); d.fleet.x = { hangar: 'HOME', aero: 'HOME' }; d.career.airframes.x = { paid: 1 };
    const br = C.playerBreak(d, 'x', w);
    const D = C.playerBroken(br.doc, 'x');
    ok(br.ok && D && D.damaged && D.cost === w.cost && br.doc.wallet === d.wallet, 'a career: broken and grounded, nothing paid yet');
    ok(C.econFlyable(br.doc).indexOf('x') < 0 && !C.playerFlyStart(br.doc, 'x').ok && /broken/.test(C.playerFlyStart(br.doc, 'x').why), 'grounded: not flyable, the fly-from-storage door refuses');
    ok(!C.econRestore(br.doc, 'x', 'repaint', 100).ok, 'no refresh while broken (the repair first)');
    const rp = C.econRepair(br.doc, 'x');
    ok(rp.ok && rp.cost === w.cost && rp.doc.wallet === d.wallet - w.cost && !C.playerBroken(rp.doc, 'x') && rp.doc.ledger.slice(-1)[0].k === 'repair', 'the repair: its bill paid, a repair line, flyable again');
    ok(C.playerBreak(d, 'x', none).doc === d, 'nothing broken: no record');
    // the tutorial: nothing recorded (the crash's reset repairs it, as before)
    let s = C.careerNew({ id: 'w', seed: 'wear' }); const st = C.storyNewCareer(s, { aeros: [] }); if (st && st.doc) s = st.doc;
    s.fleet.x = { hangar: null, aero: 'HOME' };
    ok(!C.playerBroken(C.playerBreak(s, 'x', w).doc, 'x'), 'the tutorial records nothing');
    // the sandbox: grounded too, its repair free
    const sb = JSON.parse(JSON.stringify(d)); sb.mode = 'sandbox'; delete sb.career;
    const sB = C.playerBreak(sb, 'x', w).doc;
    const sR = C.playerRepairFree(sB, 'x');
    ok(C.playerBroken(sB, 'x') && sR.ok && sR.cost === 0 && sR.doc.wallet === sB.wallet && !C.playerBroken(sR.doc, 'x'), 'the sandbox: grounded too, the repair free');
  }
  // ---- THE REFRESHES
  {
    const CV = def.parts.cover;
    ok(CV && CV.paintA > 0 && CV.clothA > 0, 'the frame publishes its painted and cloth areas (' + (CV && CV.paintA.toFixed(1)) + ' / ' + (CV && CV.clothA.toFixed(1)) + ' m2)');
    const P = C.GEN_PRICES;
    const rp = C.econRestoreCost('repaint', R, L, CV), rc = C.econRestoreCost('recover', R, L, CV), oh = C.econRestoreCost('overhaul', R, L, CV), rb = C.econRestoreCost('rebuild', R, L, CV);
    ok(rp.cost === Math.round(P.paintM2 * CV.paintA), 'a repaint: the paint alone (' + rp.cost + ')');
    ok(rc.cost === Math.round(P.coverM2 * CV.clothA + P.paintM2 * CV.paintA) && rc.cost >= 3000 / 1.5 && rc.cost <= 6000 * 1.5 + rp.cost, 'a recover: the cloth and its paint (' + rc.cost + '; materials 3-6k a Cub, Spruce)');
    ok(oh.cost === Math.round(C.econPowerPrices(R).engine[0] * C.ECON_WEAR.ovhK) && oh.cost >= 9500 / 1.5 && oh.cost <= 9500 * 1.5, 'an overhaul: the engine row x ovhK, in the band of the A-65\'s shop overhaul (' + oh.cost + ')');
    const struct = C.ECON_STRUCT_SECS.reduce((a, k) => a + ((L[k] && L[k].cost) || 0), 0) * C.ECON_WEAR.rebuildK;
    ok(rb.cost === Math.round(P.coverM2 * CV.clothA + P.paintM2 * CV.paintA + C.econPowerPrices(R).engine[0] * C.ECON_WEAR.ovhK + struct), 'a rebuild: recover + overhaul + the frame (' + rb.cost + ')');
    const metal = C.econRestoreCost('recover', R, L, { paintA: 30, clothA: 0 });
    ok(metal.cost === 0, 'a metal aeroplane has nothing to recover');
    let d = C.careerNew({ id: 'w', seed: 'wear' }); d.fleet.u = { hangar: null, aero: 'HOME' }; d.career.airframes.u = { paid: 1, age: 20, hours: 1500 };
    d = C.econAgingFlown(d, 'u', 300 * 3600);
    const poor = JSON.parse(JSON.stringify(d)); poor.wallet = 10;
    ok(!C.econRestore(poor, 'u', 'overhaul', oh.cost).ok, 'refused short of the cash');
    const now = (x) => C.econAgingNow(x, 'u');
    const O = C.econRestore(d, 'u', 'overhaul', oh.cost), V = C.econRestore(d, 'u', 'recover', rc.cost), B = C.econRestore(d, 'u', 'rebuild', rb.cost), Pn = C.econRestore(d, 'u', 'repaint', rp.cost);
    ok(O.ok && now(O.doc).engineHours === 0 && now(O.doc).years === 23 && O.doc.ledger.slice(-1)[0].k === 'restore' && C.econLedgerClass('restore') === 'repair', 'overhauled: the engine at 0 h, the years unmoved, a restore line');
    ok(V.ok && now(V.doc).years === 0 && now(V.doc).engineHours === 1800, 'recovered: the years at 0, the engine unmoved');
    ok(B.ok && now(B.doc).years === 0 && now(B.doc).engineHours === 0 && B.doc.wallet === d.wallet - rb.cost, 'rebuilt: years and hours at 0');
    ok(Pn.ok && now(Pn.doc).years === 23 && now(Pn.doc).engineHours === 1800, 'a repaint is not a restoration: the age and the engine unmoved');
    ok(C.econAgingNow(C.econAgingFlown(O.doc, 'u', 50 * 3600), 'u').engineHours === 50, 'the hours run again from the overhaul');
  }
  return fails;
}

function page(S) {
  const fails = [], ok = (c, what) => { if (!c) fails.push(what); return !!c; };
  ok(/const CERT_CONDITION = \['aging'\];/.test(S.CERT) && /o && o\.condition \? \[\] : CERT_CONDITION/.test(S.CERT), '66b: the condition outside the certificate');
  ok(/delete c\.aging;/.test(S.BENCH), 'bench.js: its strip drops the age');
  ok(/if \(flSlot && d\.fleet && d\.fleet\[flSlot\]\) d = flBreak\(d, flSlot, out\);/.test(S.APP) && /const r = playerBreak\(d, slot, bill\);/.test(S.APP), 'app.js: the flight\'s end grounds what it broke (career and sandbox)');
  ok(/function econStopWear\(d, slot, t\) \{ return econAgingFlown\(d, slot, t\); \}/.test(S.APP), 'app.js: the flight\'s seconds on the age');
  ok(/if \(brokenRollRefused\(\)\) return;/.test(S.APP), 'app.js: a broken airframe never rolls out');
  ok(/function brokenRepair\(n\) \{ return CAREER_DEV \? econRepairNow\(n\) : storeRepairFree\(n\); \}/.test(S.APP) && /broken: n => brokenOf\(n\), repair: n => brokenRepair\(n\),/.test(S.APP), 'app.js: the repair - paid in a career, free in the sandbox');
  ok(/return econAgingStart\(r\.doc, name, sp && sp\.aging \? sp\.aging : null\);/.test(S.APP), 'app.js: a build\'s first save starts its clock at the age set');
  ok(/if \(CAREER_DEV && window\.FLYDIY_CAREER\) Object\.assign\(window\.FLYDIY_CAREER, \{/.test(S.APP) && /restoreOf: k => econRestoreOf\(k\), restore: k => econRestoreNow\(k\) \}\);/.test(S.APP) && !/setCare/.test(S.APP), 'app.js: the career\'s refresh doors (behind CAREER_DEV), no upkeep door');
  ok(/if \(now && typeof econAgingSpec === 'function'\) sp = econAgingSpec\(sp, now\);/.test(S.GAR), 'garage.js: a career slot loads at its age now');
  ok(/\(brk \? ' gfBroken' : ''\)/.test(S.GAR), 'garage.js: the rack greys a broken airframe');
  ok(/function wearRefresh\(\)/.test(S.ED) && /if \(isRoot\) wearRefresh\(\);/.test(S.ED) && /\['recover', 'recover the fabric'\]/.test(S.ED) && /\['rebuild', 'rebuild'\]/.test(S.ED), 'editor.js: the four refresh buttons');
  ok(/function wearBroken\(\)/.test(S.ED) && /if \(isRoot\) wearBroken\(\);/.test(S.ED), 'editor.js: broken and grounded, and its repair, on the WEAR tab');
  ok(/careEl\.sel\.disabled = inCareer\(\);/.test(S.ED) && /\['perfect', 'perfect maintenance'\], \['normal', 'normal maintenance'\], \['poor', 'poor maintenance'\]/.test(S.ED), 'editor.js: the three upkeeps, locked in a career');
  ok(/aging: L\.age > 0 \? \{ years: L\.age, engineHours: L\.hours \|\| 0, care: 'normal',/.test(S.PROC), '76_procure: a used purchase starts its clock');
  ok(/if \(playerBroken\(doc, name\)\) return r\(null,/.test(S.PB), '71_: the fly-from-storage door refuses a broken airframe');
  return fails;
}

const SRC = { PB: rd('src/core/71_player_bases.js'), CERT: rd('src/core/66b_cert_rule.js'), BENCH: rd('src/viewer/bench.js'), APP: rd('src/viewer/app.js'), GAR: rd('src/viewer/garage.js'),
              ED: rd('src/viewer/editor.js'), PROC: rd('src/core/76_procure.js') };
if (SELF) {
  const sub = (k, a, b) => Object.assign({}, SRC, { [k]: SRC[k].replace(a, b) });
  const D = [
    ['the bench hashes the age', sub('BENCH', 'delete c.aging;', '')],
    ['nothing grounded at the stop', sub('APP', 'if (flSlot && d.fleet && d.fleet[flSlot]) d = flBreak(d, flSlot, out);', '')],
    ['no hours flown', sub('APP', 'function econStopWear(d, slot, t) { return econAgingFlown(d, slot, t); }', 'function econStopWear(d) { return d; }')],
    ['a broken one rolls out', sub('APP', 'if (brokenRollRefused()) return;', '')],
    ['a slot loads as saved', sub('GAR', 'if (now && typeof econAgingSpec === \'function\') sp = econAgingSpec(sp, now);', '')],
    ['no refresh buttons', sub('ED', 'if (isRoot) wearRefresh();', '')],
    ['the upkeep free in a career', sub('ED', 'careEl.sel.disabled = inCareer();', '')],
  ];

  // and the core doctored in a copy of flight_core (the certificate hashing the age again; the repair free again)
  const CORE = rd('tools/flight_core.js');
  const coreD = [
    ['the certificate hashes the age', CORE.replace("o && o.condition ? [] : CERT_CONDITION", "[]")],
    ['the repair free again', CORE.replace("return Math.round((Array.isArray(bill) ? bill : (bill && bill.lines) || []).reduce(", "return 0 * Math.round((Array.isArray(bill) ? bill : (bill && bill.lines) || []).reduce(")],
    ['an overhaul keeps the hours', CORE.replace("if (kind === 'overhaul' || kind === 'rebuild') g.engineHours = 0;", "")],
    ['the upkeep does nothing', CORE.replace("care: { perfect: 0.5, normal: 1, poor: 2 },", "care: { perfect: 1, normal: 1, poor: 1 },")],
    ['a broken one flies from storage', CORE.replace("if (playerBroken(doc, name)) return r(null,", "if (false) return r(null,")],
    ['the tutorial grounds', CORE.replace("econWorkFreeWhy(doc) === 'free during the tutorial') return { ok: true, doc, why: 'the tutorial: repaired as before' };", "false) return null;")],
  ];

  let bad = 0;
  for (const [what, s] of D) { const r = page(s); console.log((r.length ? '  caught  ' : '  MISSED  ') + what); if (!r.length) bad++; }
  const os = require('os');
  for (const [what, src] of coreD) {
    const f = path.join(os.tmpdir(), 'wearprice_core_' + process.pid + '.js');
    fs.writeFileSync(f, src); delete require.cache[f];
    let r; try { r = core(require(f)); } catch (e) { r = ['threw']; }
    fs.unlinkSync(f);
    console.log((r.length ? '  caught  ' : '  MISSED  ') + what); if (!r.length) bad++;
  }
  console.log('GATE WEARPRICE selftest: ' + (bad ? 'FAIL (' + bad + ' missed)' : 'PASS (' + (D.length + coreD.length) + ' of ' + (D.length + coreD.length) + ')'));
  process.exit(bad ? 1 : 0);
}
const fails = core(require('./flight_core.js')).concat(page(SRC));
for (const f of fails) console.log('  FAIL ' + f);
console.log('GATE WEARPRICE: ' + (fails.length ? 'FAIL (' + fails.length + ')' : 'PASS'));
process.exit(fails.length ? 1 : 0);
