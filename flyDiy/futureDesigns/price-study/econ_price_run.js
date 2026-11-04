#!/usr/bin/env node
// PRICE-STUDY x ECON-SIM (2026-11-04): the agreed economy (tools/econ_sim.js's PROPOSED table, applied to the game by
// G3359 ECON-APPLY) re-played with the price study's corrections. A STUDY TOOL: nothing in the game or in
// tools/econ_sim.js is changed; every patch is on this process's copy of the core and is never written anywhere.
//
//   node futureDesigns/price-study/econ_price_run.js [--seeds=8] [--policies=frugal,collector,router,competitor]
//     reads  futureDesigns/price-study/price_study_data.json (run price_study.js first: the per-design factors)
//     writes futureDesigns/price-study/econ_price_results.json
//
// THE SHIM (why econ_sim fails on master today): L30d's certification gate (74_career contractCertNeed /
// careerFleetHolds) refuses a paying job unless an airframe of the fleet holds a commercial certificate, which the page
// writes from the bench (careerSign). econ_sim never runs the bench, so every career stops at T5 ("clients.01 not
// flown": "This job needs a commercial certificate"). Every design econ_sim flies is a validated build, so the shim
// signs each airframe of the career (safe + comm pass) before an accept - what the bench would write for it. The
// lasting fix belongs in tools/econ_sim.js (one call to careerSign where it materialises an airframe).
//
// THE THREE RUNS (each: econ_sim's playCareer, its four policies, the same seeds):
//   agreed     the PROPOSED config as econ_sim defines it (the economy the user approved on 23 Oct)
//   prices     + the price study's proposal: each design's ledger x its measured factor (price_study_data.json
//                proposal.planes), CONTRACT_DESIGNS[*].cost x the same (the Cub: econRefPrice, so the shells,
//                landmarks, rungs and sign-ons follow), KIT_PRICES x the Cub's factor; the pay HELD
//   prices+pay + every absolute money number x the Cub's factor: CONTRACT_PAY (perKm, the surface bonuses, baseF,
//                story), the build contracts' authored bases, ROUTES_PAY.perKm, T6's fee
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const C = require(path.join(ROOT, 'tools', 'flight_core.js'));
const E = require(path.join(ROOT, 'tools', 'econ_sim.js'));
const ARG = k => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : null; };
const SEEDS = +(ARG('seeds') || 8);
const POLS = (ARG('policies') || 'frugal,collector,router,competitor').split(',');

// ---- the shim: the bench's signature on every airframe of the career -----------------------------------------------
const SIGN = { fp: 'econ-sim', safe: 'pass', comm: 'pass', when: null, why: '' };
const accept0 = C.careerAccept;
C.careerAccept = function (doc, id) {
  const af = doc && doc.career && doc.career.airframes;
  if (af) for (const n of Object.keys(af)) if (af[n] && !af[n].sign && !af[n].factory) af[n].sign = Object.assign({}, SIGN);
  return accept0.apply(this, arguments);
};

// ---- the factors ---------------------------------------------------------------------------------------------------
const PS = JSON.parse(fs.readFileSync(path.join(__dirname, 'price_study_data.json'), 'utf8'));
const fac = id => { const r = PS.proposal.planes.find(p => p.id === id); return r ? r.factor : null; };
// econ_sim design id -> the price study's plane id (twinf has no build file: the CONTRACT_DESIGNS row; the Chinook's
// factor stands in, both single-582-class ultralights, and is said so in the report)
const MAP = { rufus: 'rufus', cub: 'cub', jodel: 'jodel', chinook: 'chinook', twinf: 'chinook', c172: 'c172m', c172f: 'c172f', cjodel: 'cjodel' };
const cubF = fac('cub');

function snapshot() {
  return {
    CD: Object.fromEntries(Object.entries(C.CONTRACT_DESIGNS).map(([k, v]) => [k, v.cost])),
    KIT: Object.assign({}, C.KIT_PRICES),
    PAY: JSON.parse(JSON.stringify(C.CONTRACT_PAY)),
    RP: Object.assign({}, C.ROUTES_PAY),
    BUILDS: Object.values(C.CONTRACT_PROVIDERS).flatMap(P => [].concat(P.arc || [], P.builds || [], P.night || []))
      .filter(r => r.kind === 'build' && r.pay).map(r => [r, r.pay.base]),
  };
}
function restore(S0) {
  for (const k of Object.keys(S0.CD)) C.CONTRACT_DESIGNS[k].cost = S0.CD[k];
  Object.assign(C.KIT_PRICES, S0.KIT);
  for (const k of Object.keys(S0.PAY)) C.CONTRACT_PAY[k] = JSON.parse(JSON.stringify(S0.PAY[k]));
  Object.assign(C.ROUTES_PAY, S0.RP);
  for (const [r, b] of S0.BUILDS) r.pay.base = b;
}
function applyPrices(DES) {
  const D2 = JSON.parse(JSON.stringify(DES));
  for (const id of Object.keys(D2)) { const f = fac(MAP[id]) || cubF; D2[id].cost = D2[id].cost * f; D2[id].priceF = f; }
  for (const k of Object.keys(C.CONTRACT_DESIGNS)) { const f = fac(MAP[k] || k) || cubF; C.CONTRACT_DESIGNS[k].cost *= f; }
  for (const k of Object.keys(C.KIT_PRICES)) C.KIT_PRICES[k] = Math.round(C.KIT_PRICES[k] * cubF / 100) * 100;
  return D2;
}
function applyPay(cfg, f) {
  const P = C.CONTRACT_PAY;
  P.perKm *= f; for (const k of Object.keys(P.surf)) P.surf[k] *= f; P.baseF *= f; P.story *= f;
  for (const P2 of Object.values(C.CONTRACT_PROVIDERS)) for (const r of [].concat(P2.arc || [], P2.builds || [], P2.night || []))
    if (r.kind === 'build' && r.pay && r.pay.base) r.pay.base = Math.round(r.pay.base * f / 100) * 100;
  return Object.assign({}, cfg, { routes: Object.assign({}, cfg.routes, { perKm: cfg.routes.perKm * f }), storyFee: Math.round(cfg.storyFee * f / 100) * 100 });
}

function run(name, cfg, DES) {
  const res = [];
  for (const policy of POLS) for (let i = 1; i <= SEEDS; i++) {
    try { res.push(E.playCareer(policy, 's' + i, cfg, DES)); }
    catch (e) { res.push({ policy, seed: 's' + i, config: 'proposed', error: String(e && e.message || e) }); }
  }
  const A = E.aggregate(res, DES);
  const errors = res.filter(r => r.error).map(r => r.policy + ' ' + r.seed + ': ' + r.error);
  const rows = {};
  for (const k of Object.keys(A)) {
    const a = A[k], st = s => a.stages[s] || {};
    rows[a.policy] = { done: a.done, wallet: Math.round(a.wallet), routeShare: +(a.routeShare || 0).toFixed(3),
      pace: { cubClass: a.pace.cubClass.med, seat4: a.pace.seat4.med, hangar: a.pace.hangar.med,
              prices: { cubClass: a.pace.cubClass.price, seat4: a.pace.seat4.price, hangar: a.pace.hangar.price } },
      rest: { seg1: st('seg1').restMed, seg2: st('seg2').restMed, seg3: st('seg3').restMed },
      keystone3: (a.keys.seg3 ? a.keys.seg3.reached : 0) + ' / ' + a.seeds, payMed: a.payMed, fleetEnd: a.fleetEnd,
      spend: a.spend, income: a.income };
  }
  const judged = E.judge(A, 'proposed').map(r => ({ what: r.what, target: r.target, got: r.got, ok: r.ok }));
  console.log('\n== ' + name + (errors.length ? '  (' + errors.length + ' errors: ' + errors.slice(0, 2).join(' / ') + ')' : ''));
  for (const p of Object.keys(rows)) { const r = rows[p];
    console.log('  ' + p.padEnd(11), 'pace cub', r.pace.cubClass, 'seat4', r.pace.seat4, 'hangar', r.pace.hangar,
      '| rest', [r.rest.seg1, r.rest.seg2, r.rest.seg3].map(v => v == null ? '-' : v.toFixed(2)).join(' / '),
      '| route', r.routeShare, '| k3', r.keystone3, '| pay/contract', JSON.stringify(r.payMed)); }
  console.log('  targets met: ' + judged.filter(j => j.ok).length + ' / ' + judged.length + '  misses: ' + judged.filter(j => !j.ok).map(j => j.what + ' (' + (typeof j.got === 'number' ? j.got.toFixed(2) : j.got) + ')').join('; '));
  return { name, rows, judged, errors };
}

(function main() {
  const t0 = Date.now();
  const DES = E.measureDesigns();
  const cfg = E.configOf('proposed');
  const S0 = snapshot();
  const out = { what: 'PRICE-STUDY x ECON-SIM: the agreed economy, then the corrected prices (pay held, pay scaled)', date: '2026-11-04',
                seeds: SEEDS, policies: POLS, cubFactor: cubF, factors: Object.fromEntries(Object.keys(MAP).map(k => [k, fac(MAP[k])])), runs: [] };
  try {
    out.runs.push(run('agreed (econ_sim PROPOSED, as applied)', cfg, DES));
    const D2 = applyPrices(DES);
    out.prices = { cubRef: Math.round(C.econRefPrice()), designs: Object.fromEntries(Object.keys(D2).map(k => [k, { ledger: Math.round(D2[k].cost), scratch: C.econAirframePrice(D2[k].cost, { kits: ['bench', 'wood', 'metal'] }, D2[k].wants) }])) };
    out.runs.push(run('prices corrected, pay held', cfg, D2));
    const cfg2 = applyPay(cfg, cubF);
    out.pay = { perKm: C.CONTRACT_PAY.perKm, surf: C.CONTRACT_PAY.surf, baseF: C.CONTRACT_PAY.baseF, story: C.CONTRACT_PAY.story, routesPerKm: cfg2.routes.perKm, storyFee: cfg2.storyFee };
    out.runs.push(run('prices corrected, pay x' + cubF, cfg2, D2));
  } finally { restore(S0); }
  fs.writeFileSync(path.join(__dirname, 'econ_price_results.json'), JSON.stringify(out, null, 1));
  console.log('\nwrote futureDesigns/price-study/econ_price_results.json in ' + Math.round((Date.now() - t0) / 1000) + ' s');
})();
