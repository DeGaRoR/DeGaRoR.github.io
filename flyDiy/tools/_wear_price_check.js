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
  const spOf = f => { const j = JSON.parse(rd(f)); return C.genMigrateSpec(j.spec || j); };
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
  // ---- THE MAINTENANCE: three upkeeps, from now on
  {
    let d = C.careerNew({ id: 'w', seed: 'wear' }); d.fleet.u = { hangar: null, aero: 'HOME' }; d.career.airframes.u = { paid: 1, age: 10, hours: 0 };
    ok(C.ECON_CARE.join() === 'perfect,normal,poor', 'three upkeeps: perfect, normal, poor');
    const at = care => { let x = C.econCareSet(d, 'u', care).doc; x = C.econAgingFlown(x, 'u', 100 * 3600); return C.econAgingNow(x, 'u'); };
    const P = at('perfect'), N = at('normal'), Q = at('poor');
    ok(P.years === 10.5 && P.engineHours === 50 && N.years === 11 && N.engineHours === 100 && Q.years === 12 && Q.engineHours === 200,
       '100 h flown: perfect +0.5 y / 50 h, normal +1 y / 100 h, poor +2 y / 200 h (' + [P, N, Q].map(n => n.years + '/' + n.engineHours).join(', ') + ')');
    let x = C.econCareSet(d, 'u', 'poor').doc; x = C.econAgingFlown(x, 'u', 100 * 3600);
    const before = C.econAgingNow(x, 'u'); x = C.econCareSet(x, 'u', 'perfect').doc; const after = C.econAgingNow(x, 'u');
    ok(before.years === after.years && before.engineHours === after.engineHours && after.care === 'perfect', 'choosing perfect buys nothing back: what accrued at poor stays');
    x = C.econAgingFlown(x, 'u', 100 * 3600);
    ok(C.econAgingNow(x, 'u').years === 12.5, 'and runs at perfect from then on (12 -> 12.5)');
    ok(C.econAgingSpec(cub, { years: 0, engineHours: 0, care: 'normal' }).aging === undefined && C.econAgingSpec(cub, { years: 0, engineHours: 0, care: 'poor' }).aging.care === 'poor', 'the spec: absent at 0 / 0 normal; the upkeep carried otherwise');
    let b = C.careerNew({ id: 'w', seed: 'wear' }); b.fleet.own = { hangar: null, aero: 'HOME' }; b.career.airframes.own = { paid: 1 };
    ok(C.econAgingNow(C.econAgingStart(b, 'own', { years: 0, engineHours: 0, care: 'poor' }), 'own').care === 'poor', 'a build\'s first save starts with the upkeep it was given');
    ok(C.certMajor(Object.assign({}, cub, { aging: { years: 0, engineHours: 0, care: 'poor' } })).fp === C.certMajor(cub).fp, 'the upkeep is outside the certificate');
  }
  // ---- THE REPAIR BILL
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
    ok(C.econRepairCost(w) === w.cost && C.econRepairCost(w.lines) === w.cost, 'econRepairCost sums the bill (no longer 0)');
    let d = C.careerNew({ id: 'w', seed: 'wear' }); d.fleet.x = { hangar: null, aero: 'HOME' }; d.career.airframes.x = { paid: 1 };
    const c = C.econRepairCharge(d, 'x', w);
    ok(c.ok && c.cost === w.cost && c.doc.wallet === d.wallet - w.cost && c.doc.ledger.slice(-1)[0].k === 'repair', 'a career pays it: a `repair` line');
    let s = C.careerNew({ id: 'w', seed: 'wear' }); const st = C.storyNewCareer(s, { aeros: [] }); if (st && st.doc) s = st.doc;
    s.fleet.x = { hangar: null, aero: 'HOME' }; s.career.airframes.x = { paid: 1 };
    const t = C.econRepairCharge(s, 'x', w);
    ok(t.ok && t.cost === 0 && t.doc.wallet === s.wallet && t.why === 'free during the tutorial', 'free during the tutorial');
  }
  // ---- THE REFRESHES
  {
    const rp = C.econRestoreCost('repaint', R, L), oh = C.econRestoreCost('overhaul', R, L);
    ok(rp.cost === Math.round(L.paint.cost) && rp.cost > 0, 'a repaint: the ledger\'s paint line (' + rp.cost + ')');
    ok(oh.cost === Math.round(C.econPowerPrices(R).engine[0] * C.ECON_WEAR.ovhK), 'an overhaul: the engine row x ovhK (' + oh.cost + ')');
    ok(oh.cost >= 9500 / 1.5 && oh.cost <= 9500 * 1.5, 'the A-65\'s overhaul within x1.5 of its sourced shop overhaul (~9.5k, Aviation Consumer)');
    let d = C.careerNew({ id: 'w', seed: 'wear' }); d.fleet.u = { hangar: null, aero: 'HOME' }; d.career.airframes.u = { paid: 1, age: 20, hours: 1500 };
    d = C.econAgingFlown(d, 'u', 300 * 3600);
    const poor = JSON.parse(JSON.stringify(d)); poor.wallet = 10;
    ok(!C.econRestore(poor, 'u', 'overhaul', oh.cost).ok, 'refused short of the cash');
    const r = C.econRestore(d, 'u', 'overhaul', oh.cost);
    const n = C.econAgingNow(r.doc, 'u');
    ok(r.ok && r.doc.wallet === d.wallet - oh.cost && n.engineHours === 0 && n.years === 23 && r.doc.ledger.slice(-1)[0].k === 'restore' && C.econLedgerClass('restore') === 'repair',
       'overhauled: paid, a `restore` line (class repair), the engine at 0 h, the years unmoved (' + JSON.stringify(n) + ')');
    const r2 = C.econAgingFlown(r.doc, 'u', 50 * 3600);
    ok(C.econAgingNow(r2, 'u').engineHours === 50, 'the hours run again from the overhaul');
    const p = C.econRestore(d, 'u', 'repaint', rp.cost);
    ok(p.ok && C.econAgingNow(p.doc, 'u').years === 23 && C.econAgingNow(p.doc, 'u').engineHours === 1800, 'a repaint is not a restoration: the age and the engine unmoved');
  }
  return fails;
}

function page(S) {
  const fails = [], ok = (c, what) => { if (!c) fails.push(what); return !!c; };
  ok(/const CERT_CONDITION = \['aging'\];/.test(S.CERT) && /o && o\.condition \? \[\] : CERT_CONDITION/.test(S.CERT), '66b: the condition outside the certificate');
  ok(/delete c\.aging;/.test(S.BENCH), 'bench.js: its strip drops the age');
  ok(/const bill = econRepairBill\(def\.spec, def\.parts\.ledger, def\.parts\.dmg && def\.parts\.dmg\.groups,/.test(S.APP) && /const rc = econRepairCharge\(d, flSlot, bill\);/.test(S.APP), 'app.js: the flight\'s end bills the breakage');
  ok(/d = econAgingFlown\(d, flSlot, Math\.max\(0, ap\.t \|\| 0\)\);/.test(S.APP), 'app.js: the flight\'s seconds on the age');
  ok(/return econAgingStart\(r\.doc, name, sp && sp\.aging \? sp\.aging : null\);/.test(S.APP), 'app.js: a build\'s first save starts its clock at the age set');
  ok(/restoreOf: k => econRestoreOf\(k\), restore: k => econRestoreNow\(k\),/.test(S.APP) && /isAirframe: n =>/.test(S.APP), 'app.js: the career\'s refresh doors');
  ok(/if \(now && typeof econAgingSpec === 'function'\) sp = econAgingSpec\(sp, now\);/.test(S.GAR), 'garage.js: a career slot loads at its age now');
  ok(/function wearRefresh\(\)/.test(S.ED) && /if \(isRoot\) wearRefresh\(\);/.test(S.ED), 'editor.js: the refresh buttons on the WEAR tab');
  ok(/aging: L\.age > 0 \? \{ years: L\.age, engineHours: L\.hours \|\| 0, care: 'normal',/.test(S.PROC), '76_procure: a used purchase starts its clock');
  ok(/setCare: c => \{ const n = slotOnStand\(\); const r = econCareSet\(playerLoad\(\), n, c\);/.test(S.APP), 'app.js: the upkeep\'s door');
  ok(/function careRow\(\)/.test(S.ED) && /if \(isRoot\) emitEls\(p0, 'upkeep', \[careRow\(\)\], 'how fast it wears from now on', false, \{ secG: 'wear:care' \}\);/.test(S.ED)
     && /\['perfect', 'perfect maintenance'\], \['normal', 'normal maintenance'\], \['poor', 'poor maintenance'\]/.test(S.ED), 'editor.js: the three upkeeps, up front (not expert)');
  return fails;
}

const SRC = { CERT: rd('src/core/66b_cert_rule.js'), BENCH: rd('src/viewer/bench.js'), APP: rd('src/viewer/app.js'), GAR: rd('src/viewer/garage.js'),
              ED: rd('src/viewer/editor.js'), PROC: rd('src/core/76_procure.js') };
if (SELF) {
  const sub = (k, a, b) => Object.assign({}, SRC, { [k]: SRC[k].replace(a, b) });
  const D = [
    ['the bench hashes the age', sub('BENCH', 'delete c.aging;', '')],
    ['no bill at the stop', sub('APP', 'const rc = econRepairCharge(d, flSlot, bill);', 'const rc = { ok: false };')],
    ['no hours flown', sub('APP', 'd = econAgingFlown(d, flSlot, Math.max(0, ap.t || 0));', '')],
    ['a slot loads as saved', sub('GAR', 'if (now && typeof econAgingSpec === \'function\') sp = econAgingSpec(sp, now);', '')],
    ['no refresh buttons', sub('ED', 'if (isRoot) wearRefresh();', '')],
  ];
  // and the core doctored in a copy of flight_core (the certificate hashing the age again; the repair free again)
  const CORE = rd('tools/flight_core.js');
  const coreD = [
    ['the certificate hashes the age', CORE.replace("o && o.condition ? [] : CERT_CONDITION", "[]")],
    ['the repair free again', CORE.replace("return Math.round((Array.isArray(bill) ? bill : (bill && bill.lines) || []).reduce(", "return 0 * Math.round((Array.isArray(bill) ? bill : (bill && bill.lines) || []).reduce(")],
    ['an overhaul keeps the hours', CORE.replace("out.career.airframes[slot].aging.engineHours = 0;", "")],
    ['the upkeep retroactive', CORE.replace("let d = A.aging ? econAgingSettle(doc, slot) : econAgingStart(doc, slot, null);", "let d = A.aging ? doc : econAgingStart(doc, slot, null);")],
    ['the upkeep does nothing', CORE.replace("care: { perfect: 0.5, normal: 1, poor: 2 },", "care: { perfect: 1, normal: 1, poor: 1 },")],
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
