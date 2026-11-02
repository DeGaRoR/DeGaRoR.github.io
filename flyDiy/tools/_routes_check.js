// _routes_check.js - GATE ROUTES (G3260-G3269 ROUTES): a plane + a hired pilot + an A <-> B schedule, paid on the sim clock.
//   node tools/_routes_check.js [--selftest]      -> "GATE ROUTES: PASS|FAIL"
// Holds (78b_routes.js, pure; futureDesigns/game/GAME-PLAN-2026-10-15.md §R, §3 T6, §5.3):
//   - sign / settle / end each work on a clone (the document handed in is never changed) and refuse with a reason;
//   - the terms against a hand-computed case: the down payment, the pay per round trip, the round trip's time;
//   - no pay without sim time (a settle at the signing's instant, at an earlier one, twice at the same one);
//   - the lock: playerMove / playerSendTo / bring-home / an arrival / a flight / a store refuse a plane on a route; its
//     pilot is not picked, fired, boated home, flown, or unbound by a flight's end; the end frees both, the plane back at
//     the route's home field;
//   - the save: careerNormalise(JSON round trip) is the same document; a career that never signed one gains nothing;
//     the normaliser ends a route whose plane left and unlocks a stray row;
//   - the sandbox untouched: routes refuse it, its document normalises byte for byte, every page call into the routes
//     behind CAREER_DEV, the storage / map screens draw routes only from the career's doors;
//   - STORY's T6 signs a real route (the gift Cub, the seaplane base <-> HOME, the companion): the down payment in the
//     wallet, on the arrival card (app.js's own story half, run headless) and in Tim's band;
//   - --selftest: four breaks, each caught.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(__dirname, 'flight_core.js'));
const SELF = process.argv.includes('--selftest');
const J = o => JSON.stringify(o);
const money = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function run(M) {
  M = M || C;
  const fails = [];
  const ok = (c, what, x) => { if (!c) fails.push(what); if (!SELF) console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what + (x != null ? '  [' + x + ']' : '')); };
  // ---- a career with a plane at field A, the companion on the roster
  const fields = { A: { id: 'A', name: 'Field A', x: 0, z: 0, len: 600, surf: 'grass' }, B: { id: 'B', name: 'Field B', x: 3000, z: 4000, len: 600, surf: 'grass' },
                   Wt: { id: 'Wt', name: 'Wet', x: 0, z: 1000, len: 900, surf: 'water' } };
  const design = { id: 'gate', label: 'gate plane', cruiseKmh: 100, seats: 2, bagKg: 10 };
  let d = M.careerNormalise(M.careerNew({ id: 'r', seed: 'routes', name: 'gate' }));
  d.fleet.Cub = { hangar: null, aero: 'A' }; d.fleet.Ul = { hangar: null, aero: 'HOME' };
  d = M.careerNormalise(d);
  const d0 = J(d), w0 = d.wallet;
  ok(!('routes' in d.career) && M.routesActive(d).length === 0, 'a career that never signed a route has no `routes` (nothing added)');
  // ---- THE HAND-COMPUTED CASE: A -> B is 5 km (3-4-5); the plane: 100 km/h, 2 seats, 10 kg of baggage
  //   payload 1 x 80 kg + 10 = 90 kg; pay = 2 x 5 km x 30 x (1 + 90 / 150) = 480 a round trip; down = 6 x 480 = 2 880;
  //   flown: 2 x 5 / 100 h = 360 s + the 1800 s turnaround = 2160 s; TIMETABLED (G3359, 6 a day): max(2160, 86400 / 6) = 14 400 s
  const O = M.routeOffer(d, 'A', 'B', 'Cub', { fields, design });
  ok(O.ok && O.doc === d && J(d) === d0, 'routeOffer: the terms, the document untouched', O.why);
  const T = O.offer || {};
  ok(T.km === 5 && T.payloadKg === 90 && T.pay === 480 && T.down === 2880 && T.flyS === 2160 && T.tripS === 14400,
     'the hand-computed case (G3359 table): 5 km, 90 kg payload -> 480 a round trip, a down payment of 2 880, 2 160 s flown, 14 400 s timetabled', J({ km: T.km, kg: T.payloadKg, pay: T.pay, down: T.down, fly: T.flyS, s: T.tripS }));
  const big = M.routeOffer(d, 'A', 'B', 'Cub', { fields, design: Object.assign({}, design, { seats: 4, bagKg: 40 }) });
  const fast = M.routeOffer(d, 'A', 'B', 'Cub', { fields, design: Object.assign({}, design, { cruiseKmh: 200 }) });
  ok(big.ok && big.offer.pay > T.pay && fast.ok && fast.offer.flyS < T.flyS && fast.offer.pay === T.pay, 'a bigger plane earns more a trip, a faster one flies its trip quicker: the route rewards the design',
     big.offer && big.offer.pay + ' / ' + (fast.offer && fast.offer.tripS) + ' s');
  ok(!M.routeOffer(d, 'A', 'A', 'Cub', { fields, design }).ok && !M.routeOffer(d, 'A', 'ZZ', 'Cub', { fields, design }).ok && !M.routeOffer(d, 'A', 'B', 'nope', { fields, design }).ok,
     'refused: the same field twice, an unknown field, a plane not in the fleet');
  ok(!M.routeOffer(d, 'A', 'Wt', 'Cub', { fields, design, gear: 'wheels' }).ok && !M.routeOffer(d, 'A', 'B', 'Cub', { fields, design, gear: 'floats' }).ok &&
     M.routeOffer(d, 'A', 'Wt', 'Cub', { fields, design, gear: 'amphibian' }).ok, 'the gear: wheels refused a water end, floats a land end, an amphibian both');
  ok(!M.routeOffer(d, 'A', 'B', 'Ul', { fields }).ok && /not read yet/.test(M.routeOffer(d, 'A', 'B', 'Ul', { fields }).why), 'a plane whose numbers are not known: refused, never guessed');
  // ---- SIGN on a clone
  const t0 = M.dayAbs(M.careerDay(d));
  ok(!M.routeSign(d, T, 'Cub', 'rafe').ok && !M.routeSign(d, T, 'Ul', 'brian').ok && !M.routeSign(d, null, 'Cub', 'brian').ok,
     'routeSign refuses a pilot not hired, another plane than the offer\'s, no offer');
  const away = JSON.parse(d0); away.fleet.Cub.aero = 'HOME';
  ok(!M.routeSign(M.careerNormalise(away), T, 'Cub', 'brian').ok, 'routeSign refuses a plane that stands at neither end');
  const S = M.routeSign(d, T, 'Cub', 'brian');
  ok(S.ok && J(d) === d0, 'routeSign: on a clone (the document handed in unchanged)', S.why);
  let e = S.doc;
  const R = S.route || {};
  ok(e.wallet === w0 + 2880 && e.ledger.some(l => l.k === 'route' && l.amt === -2880 && l.ref === R.id), 'the down payment: +2 880 in the wallet, its ledger line (income)', e.wallet - w0);
  ok(R.plane === 'Cub' && R.pilot === 'brian' && R.a === 'A' && R.b === 'B' && R.signedAt === Math.round(t0) && R.trips === 0, 'the route: the plane, the pilot, A <-> B, signed at the career\'s instant', J(R));
  const W = M.playerStoreWhere(e, 'Cub');
  ok(W.kind === 'route' && W.a === 'A' && W.b === 'B' && M.playerWhere(e, 'Cub').kind === 'route' && e.career.pilots.brian.route === R.id && e.career.pilots.brian.plane === 'Cub',
     'locked: the plane\'s place is "route" (A, B), the pilot marked with it', J(W));
  ok(!M.routeSign(e, T, 'Cub', 'brian').ok && !M.routeOffer(e, 'A', 'B', 'Cub', { fields, design }).ok, 'a plane on a route: no second route');
  // ---- THE LOCK
  const refused = (r, what) => ok(r && !r.ok && /route/.test(r.why || ''), what + ' refused', r && r.why);
  refused(M.playerMove(e, 'Cub', { kind: 'outside' }), 'playerMove');
  refused(M.playerMove(e, 'Cub', { kind: 'long', hangar: 'HOME' }), 'playerMove long-term');
  refused(M.playerSendTo(e, 'Cub', 'HOME'), 'playerSendTo');
  refused(M.playerBringHome(e, 'Cub'), 'bring it home');
  refused(M.playerArrive(e, 'Cub', 'HOME', {}), 'an arrival (it cannot have flown)');
  refused(M.playerStore(e, 'Cub', 'HOME'), 'a store');
  refused(M.playerFlyStart(e, 'Cub'), 'a flight from where it stands');
  ok(M.playerFloorSync(e, 'Cub').doc === e, 'the stand does not take it (playerFloorSync leaves it on its route)');
  ok(J(M.playerStoreSettle(JSON.parse(J(e)))) === J(e) && J(M.careerNormalise(JSON.parse(J(e))).fleet.Cub) === J(e.fleet.Cub), 'the storage settle keeps a plane on its route (a fixpoint)');
  ok(!M.pilotsFire(e, 'brian').ok && !M.pilotsPick(e, 'brian').ok && !M.pilotsCanFly(e, 'brian', 'A').ok && M.pilotsPicked(e) === 'me', 'its pilot: not fired, not picked, not flying the player\'s flights');
  const fe = M.pilotsOnFlightEnd(e, { pilot: 'me', slot: 'Cub', from: 'A', to: 'B', landed: true, t: 60 });
  ok(fe.ok && fe.doc.career.pilots.brian.plane === 'Cub' && fe.doc.career.pilots.brian.route === R.id, 'a flight\'s end never unbinds the route\'s pilot');
  const V = M.playerStoreView(e, 'HOME');
  ok(V && Array.isArray(V.routes) && !V.routes.includes('Cub') && ![].concat(V.long, V.others, V.outside.slots, V.inside.slots).includes('Cub'), 'the storage view at HOME: the Cub is in no column (its ends are A and B)');
  // ---- SETTLE: no pay without sim time
  let r = M.routeSettle(e);
  ok(r.ok && r.paid === 0 && r.trips === 0, 'no sim time since the signing: nothing paid', r.paid);
  r = M.routeSettle(e, t0 + 14399);
  ok(r.paid === 0, 'a round trip not yet complete (2 159 s): nothing paid', r.paid);
  r = M.routeSettle(e, t0 + 3 * 14400 + 10);
  ok(r.ok && r.paid === 1440 && r.trips === 3 && r.doc.wallet === e.wallet + 1440 && J(e) === J(S.doc), 'three round trips: 3 x 480 = 1 440, on a clone', r.paid);
  ok(r.doc.ledger.filter(l => l.k === 'routePay').length === 1 && r.doc.ledger.slice(-1)[0].amt === -1440, 'one ledger line for the settle');
  const lines = M.routeSettleLines(r, [{ id: 'A', name: 'Field A' }, { id: 'B', name: 'Field B' }]);
  ok(lines.length === 1 && /Field A – Field B/.test(lines[0].text) && /3 round trips/.test(lines[0].text) && /\+1 440/.test(lines[0].text), "the arrival card's line", lines[0] && lines[0].text);
  e = r.doc;
  ok(M.routeSettle(e, t0 + 3 * 14400 + 10).paid === 0 && M.routeSettle(e, t0 + 100).paid === 0, 'settled twice at that instant, or at an earlier one: nothing more');
  ok(M.routeSettle(e, t0 + 3.5 * 14400).paid === 0 && M.routeSettle(e, t0 + 4 * 14400).paid === 480, 'half a trip later nothing; the fourth trip complete: 480');
  ok(M.routeSettle(e, { date: M.careerDay(e).date, utc: M.careerDay(e).utc + 5 * 14400 }).trips === 2, 'the instant as a day ({ date, utc }): the same count');
  const P0 = M.routePos(R, t0), P1 = M.routePos(R, t0 + 90), P2 = M.routePos(R, t0 + 180 + 900 + 90), P3 = M.routePos(R, t0 + 14400 - 1);
  ok(P0.leg === 'out' && P0.f === 0 && P1.leg === 'out' && Math.abs(P1.f - 0.5) < 1e-9 && P2.leg === 'back' && Math.abs(P2.f - 0.5) < 1e-9 && M.routePos(R, t0 + 500).leg === 'atB' && P3.leg === 'atA', 'the plane along its route: out, the turn at B, back, the turn at A', [P0, P1, P2, P3].map(p => p.leg + ' ' + p.f.toFixed(2)).join(', '));
  // ---- THE SAVE
  const back = M.careerNormalise(JSON.parse(J(e)));
  ok(J(back) === J(e), 'saved and reloaded: the document unchanged (the route, the lock, the pilot)');
  const lost = JSON.parse(J(e)); delete lost.fleet.Cub;
  const L2 = M.careerNormalise(lost);
  ok(L2.career.routes[0].ended && !M.routesActive(L2).length && !L2.career.pilots.brian.route, 'a route whose plane left the fleet: ended, its pilot freed');
  const stray = JSON.parse(J(e)); stray.career.routes = [];
  const L3 = M.careerNormalise(stray);
  ok(L3.fleet.Cub.kind !== 'route' && M.playerStoreWhere(L3, 'Cub').kind !== 'route' && !L3.career.pilots.brian.route, 'a fleet row on a route nobody runs: unlocked, placed again', M.playerStoreWhere(L3, 'Cub').kind);
  // ---- END
  const E = M.routeEnd(e, R.id, { now: t0 + 4 * 14400 + 1 });
  ok(E.ok && J(e) === J(r.doc) && E.paid === 480, 'routeEnd on a clone: the trip flown since the last settle paid first', E.why || E.paid);
  const We = M.playerStoreWhere(E.doc, 'Cub');
  ok(E.route.ended && We.kind !== 'route' && We.aero === 'B' && !M.routeOfPlane(E.doc, 'Cub'), 'the plane back at the route\'s home field (B: the end it was not signed at, with no hangar of yours at either)', J(We));
  ok(!E.doc.career.pilots.brian.route && E.doc.career.pilots.brian.plane === null && M.pilotsPick(E.doc, 'brian').ok, 'the pilot freed');
  ok(E.doc.wallet === e.wallet + 480 && E.doc.ledger.slice(-1)[0].k === 'routeEnd' && E.doc.ledger.slice(-1)[0].amt === 0, 'no penalty: the ledger line at 0, the wallet only gains the trip flown');
  ok(M.routeSettle(E.doc, t0 + 50 * 14400).paid === 0, 'an ended route pays nothing more');
  ok(M.playerMove(E.doc, 'Cub', { kind: 'outside' }).why !== undefined && !/flies the route/.test(M.playerMove(E.doc, 'Cub', { kind: 'outside' }).why || ''), 'after the end: the storage moves it again (no route refusal)');
  ok(!M.routeEnd(E.doc, R.id).ok, 'ending an ended route: refused');
  // HOME's end: a hangar of yours there takes it inside
  const H = M.routeOffer(d, 'A', 'HOME', 'Cub', { design, fields: Object.assign({}, M.CONTRACT_FIELDS, fields) });
  const HS = H.ok ? M.routeSign(d, H.offer, 'Cub', 'brian') : H;
  const HE = HS.ok ? M.routeEnd(HS.doc, HS.route.id) : HS;
  ok(H.ok && H.offer.home === 'HOME' && HE.ok && HE.where.hangar === 'HOME', 'a route to HOME ends inside the HOME hangar (as any arrival)', HE.where && J(HE.where));
  // ---- THE SANDBOX
  const sand = M.playerNormalise(M.playerMigrate(M.playerDefault()));
  const s0 = J(sand);
  ok(!M.routeOffer(sand, 'HOME', 'w2', 'x').ok && !M.routeSign(sand, T, 'x', 'brian').ok && M.routeSettle(sand).paid === 0 && J(sand) === s0, 'the sandbox: no route offered, signed or paid; its document untouched');
  ok(J(M.playerNormalise(JSON.parse(s0))) === s0 && J(M.playerStoreView(sand, 'HOME').routes) === '[]', 'the sandbox\'s document normalises byte for byte; its storage view lists no route');
  return { fails, d, M };
}

// ---- THE STORY'S T6: a real route signed ---------------------------------------------------------------------------
function story(M) {
  M = M || C;
  const fails = [];
  const ok = (c, what, x) => { if (!c) fails.push(what); if (!SELF) console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what + (x != null ? '  [' + x + ']' : '')); };
  const aeros = [{ id: 'HOME', name: 'Jolene AFB 13/31', kind: 'strip' }, { id: 'w6', name: 'strip 11', kind: 'strip' },
                 { id: 'SEA', name: 'Annette Dock', kind: 'water' }, { id: 'w9', name: 'Cabin Strip', kind: 'strip' },
                 { id: 'mk_sea', name: 'Cedar Harbour Seaplane Base', kind: 'water' }];
  // a story at T6, the gift Cub landed at the seaplane base (playerFlightEnd's order: the arrival first)
  let d = M.careerNormalise(M.careerNew({ id: 'main', seed: 'routes-story' }));
  d = M.storyStart(d, 'Rufus').doc;
  d.fleet.Rufus = { hangar: 'HOME', aero: 'HOME' }; d.fleet['Client Cub'] = { hangar: null, aero: 'SEA' };
  d.career.airframes['Client Cub'] = { from: 'story', story: 'client', factory: false, modified: false, paid: 0, at: 0, gift: true };
  const s = d.career.story; s.beat = 'T6'; s.done = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5']; s.planes.client = s.planes.gift = 'Client Cub';
  d = M.careerNormalise(d);
  const w0 = d.wallet;
  const stop = M.careerStopRecord({ how: 'stopped', aero: 'SEA', slot: 'Client Cub', gear: 'floats', row: { from: 'HOME', to: 'SEA', t: 600 } });
  const st = M.storyStep(d, { k: 'stop', stop, slot: 'Client Cub', gear: 'floats' }, { aeros });
  const eff = (st.effects || []).find(x => x.k === 'routeOffer');
  ok(st.ok && eff, 'T6 met on floats at the seaplane base: the route effect handed over', st.why);
  const a = M.storyApply(st.doc, eff, { aeros });
  const D = a.doc, R = M.routesActive(D)[0] || {}, O = (M.storyOf(D).offers || []).find(x => x.k === 'route') || {};
  ok(a.ok && R.plane === 'Client Cub' && R.pilot === M.PILOTS_COMPANION && R.a === 'mk_sea' && R.b === 'SEA' && R.home === 'SEA',
     "storyApply's routeOffer signs a REAL route: the gift Cub, the companion, water to water - Cedar Harbour <-> the seaplane base, the Cub's home where it landed (no stub)", J({ plane: R.plane, pilot: R.pilot, a: R.a, b: R.b }));
  ok(O.signed === true && !('stub' in O) && O.route === R.id && O.down === R.down && R.down > 0 && D.wallet === w0 + R.down + M.STORY_T6_FEE && O.fee === M.STORY_T6_FEE, 'the story records the route and its down payment; the wallet holds it and T6\'s commitment fee (G3359)', R.down);
  ok(M.playerStoreWhere(D, 'Client Cub').kind === 'route' && !M.playerFlyStart(D, 'Client Cub').ok, '"the Cub disappears": locked on its route, never flown by the player');
  ok(/Route signed/.test(a.line) && a.line.includes(money(R.down)), 'the line (arrival card, beat card) names the down payment', a.line);
  const tim = M.storyTimLines('T7', D);
  ok(tim.length === M.storyTimLines('T7').length + 1 && /paid/.test(tim[0]) && tim[0].includes(money(R.down)), "Tim's band at T7 names the route and the down payment first", tim[0]);
  const nopilot = JSON.parse(J(st.doc)); nopilot.career.roster = [];
  const np = M.storyApply(M.careerNormalise(nopilot), eff, { aeros });
  ok(np.ok && !M.routesActive(np.doc).length && (M.storyOf(np.doc).offers || []).some(x => x.k === 'route' && x.signed === false && x.why), 'no free pilot: nothing signed, the offer kept with its reason (never a guess)', np.why);
  // G3585 T6b ("the tutorial must hire"): a pilot hired at T6 flies the route, not the companion
  const hd = JSON.parse(J(st.doc)); hd.wallet = 1e6;
  const pick = M.pilotsOffers(M.careerNormalise(hd))[0], hr = pick ? M.pilotsHire(M.careerNormalise(hd), pick) : { ok: false, why: 'nobody on offer' };
  const ha = hr.ok ? M.storyApply(hr.doc, eff, { aeros }) : { ok: false };
  const HR = ha.ok ? M.routesActive(ha.doc)[0] || {} : {};
  ok(hr.ok && pick !== M.PILOTS_COMPANION && HR.pilot === pick, 'T6b: the pilot you hired flies the route (storyRoutePilot: the latest own hire before the companion)', J({ pick, why: hr.why, pilot: HR.pilot }));
  return fails;
}

// ---- THE PAGE: the source guards, and app.js's story half run headless at T6 -------------------------------------------
async function page() {
  const fails = [];
  const ok = (c, what, x) => { if (!c) fails.push(what); console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what + (x != null ? '  [' + x + ']' : '')); };
  const M = C;
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const sto = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'storage_ui.js'), 'utf8');
  const mm = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'map_menu.js'), 'utf8');
  const build = require('./build.js');
  ok(build.MANIFEST.core.includes('78b_routes.js') && build.MANIFEST.career.includes('78b_routes.js') &&
     build.MANIFEST.core.indexOf('78b_routes.js') < build.MANIFEST.core.indexOf('79_story.js'), 'the module is career-lazy (MANIFEST.core and MANIFEST.career, before the story)');
  // every call into the routes outside the career's page half is behind CAREER_DEV (the sandbox runs none of it)
  const i0 = app.indexOf("G2320 (CAREER-WIRE): THE DEV CAREER'S PAGE HALF"), i1 = app.indexOf('window.FLYDIY_PLAYER = {', i0);
  const r0 = app.indexOf("G3260-G3269 (ROUTES): THE ROUTES' PAGE HALF"), r1 = app.indexOf("G2742-G2749 (STORY-PAGE): THE STORY'S PAGE HALF");
  ok(i0 > 0 && i1 > i0 && r0 > i0 && r1 > r0 && r1 < i1, "app.js: the routes' half sits in the career's, before the story's");
  const names = ['routeOffer', 'routeSign', 'routeSettle', 'routeEnd', 'routesActive', 'routesList', 'routeOfPlane', 'routeOfPilot', 'routeWords', 'routeAeroName',
    'routeSettleLines', 'routesMapOf', 'routeOfferWords', 'routePos', 'routesBlock', 'routesSettleNow', 'routesOnWait', 'routesRollRefused', 'routesDesignNow', 'routesStandRule'];
  const re = new RegExp('\\b(' + names.join('|') + ')\\(');
  const outside = (app.slice(0, i0) + app.slice(i1)).split('\n').filter(l => re.test(l.replace(/\/\/.*$/, '')));
  const loose = outside.filter(l => !/CAREER_DEV/.test(l));
  ok(outside.length >= 2 && !loose.length, 'every call into the routes outside the career\'s half is behind CAREER_DEV', outside.length + ' calls' + (loose.length ? '; loose: ' + loose.map(l => l.trim().slice(0, 70)).join(' | ') : ''));
  const half = app.slice(r0, r1);
  ok(/  if \(CAREER_DEV\) \{\n[\s\S]*Object\.assign\(window\.FLYDIY_STORE, \{\n\s*routeTargets/.test(half), "the storage's route doors are published under CAREER_DEV only");
  ok(/routesSettleNow\(d\) : null; if \(CAREER_DEV && rtSettled\) d = rtSettled\.doc;\n(?:\s*\/\/ G3618 \(HIRE\)[^\n]*\n\s*const pyPaid = [^\n]*\n)?\s*\/\/ G2320 \(CAREER-WIRE\): \.\.\.and the career meets the stop/.test(app) &&
     /if \(CAREER_DEV && out\.career && rtSettled && rtSettled\.lines\.length\) out\.career\.lines\.unshift/.test(app), 'the landing settles the routes (before the stop\'s wallet line), its line on the arrival card');
  ok(/'flydiy:dayjump'[\s\S]{0,80}routesOnWait/.test(half) && /\/\^\(wait\|fullmoon\)\/\.test/.test(half), 'a wait settles them (the clock\'s jump of a wait only: never the 30 s save)');
  ok(/if \(CAREER_DEV && routesRollRefused\(\)\) return;/.test(app), 'a plane on a route never rolls out');
  ok(/if \(A\.routeTargets\)/.test(sto) && /if \(V\.routes && V\.routes\.length\)/.test(sto) && /'on route ' \+/.test(sto) && /'end route'/.test(sto),
     'the storage card: "route…" only with the career\'s doors, the planes "on route A – B" with End route');
  ok(/const routes = \(raw\.routes \|\| \[\]\)/.test(mm) && /class="mmRtLine"/.test(mm) && /class="mmRtPlane"/.test(mm) && !/title=|\.title\s*=|mouseenter|mouseover|:hover/.test(mm),
     'the map: the route\'s line and its plane from the record\'s routes (nothing hover-only)');
  ok(/#hsStore \.hsAskBox select \{ font:400 12px\/1\.3 'IBM Plex Sans'; color:var\(--ed-ink\)/.test(sto) && !/italic/.test(sto) && !/Georgia|Times|serif['";]/.test(sto.replace(/sans-serif/g, '')),
     "the garage's look: --ed-* tokens, IBM Plex Sans upright, no italics");
  // ---- the map draws them (map_menu.js, pure)
  try {
    const MM = require(path.join(ROOT, 'src', 'viewer', 'map_menu.js'));
    const w = {}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'map_pack.js'), 'utf8'), { window: w });
    let d = M.careerNormalise(M.careerNew({ id: 'm', seed: 'map' }));
    d.fleet.Cub = { hangar: null, aero: 'SEA' }; d = M.careerNormalise(d); d.career.airframes.Cub = { from: 'story', story: 'client', gift: true };
    const O = M.routeOffer(d, 'SEA', 'HOME', 'Cub'); d = M.routeSign(d, O.offer, 'Cub', 'brian').doc;
    const R = M.careerMapRecord(d, null, {}); R.routes = M.routesMapOf(d, M.dayAbs(M.careerDay(d)) + 60, w.MAP_PACK.aerodromes);
    const A = MM.mapAdapt(R, w.MAP_PACK, d);
    const pk = w.MAP_PACK, view = { s: 0.3, fit: 0.3, tx: 0, ty: 0 };
    const ov = MM.overlayOf(A, { list: 'contracts' }, pk, view);
    const f = A.fleet.find(x => x.slot === 'Cub');
    ok(A.routes.length === 1 && ov.n.rlines === 1 && ov.n.rplanes === 1 && /class="mmRtPlane"/.test(ov.html) && /Cub on its route/.test(ov.html) && f && f.where.kind === 'route' &&
       /flying the route/.test(MM.whereWord(A, f.where)), 'the map: one route line, the Cub on it, the fleet row "flying the route"', MM.whereWord(A, f.where));
  } catch (e) { ok(false, 'the map draws the route', e.message); }
  // ---- app.js's own story half at T6, headless (GATE STORY's harness, cut down): the arrival card's line
  const s0 = app.indexOf("G2742-G2749 (STORY-PAGE): THE STORY'S PAGE HALF"), s1 = app.indexOf('  window.FLYDIY_PLAYER = {', s0);
  const shalf = app.slice(app.lastIndexOf('\n', s0) + 1, s1);
  const prefs = new Map();
  const mkEl = () => { const e = { hidden: false, dataset: {}, innerHTML: '', _cls: new Set(), attrs: {}, listeners: {},
    classList: { toggle(c) { if (e._cls.has(c)) e._cls.delete(c); else e._cls.add(c); }, contains: c => e._cls.has(c) },
    setAttribute(k, v) { e.attrs[k] = v; }, addEventListener(t, f) { e.listeners[t] = f; } }; return e; };
  const document = { body: { appendChild: e => e }, createElement: mkEl, getElementById: () => null };
  const aeros = [{ id: 'HOME', name: 'Jolene AFB 13/31', kind: 'strip' }, { id: 'SEA', name: 'Annette Dock', kind: 'water' }, { id: 'w9', name: 'Cabin Strip', kind: 'strip' },
                 { id: 'mk_sea', name: 'Cedar Harbour Seaplane Base', kind: 'water' }];
  let player = null;
  const H = Object.assign(Object.create(null), M, {
    STORY_PAGE: true, CAREER_DEV: true, world: { aerodromes: aeros }, document, console: { log() {}, info() {}, warn() {}, error: console.error },
    CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; }, JSON, Math, Date, Object, Array, String, Number, Set, Map, Promise, Error, isFinite, encodeURI,
    setTimeout: () => 0, setInterval: () => 0, fetch: () => Promise.resolve({ ok: false, status: 404 }), inGarage: true,
    prefGet: (k, dv) => (prefs.has(k) ? prefs.get(k) : dv), prefSet: (k, v) => { prefs.set(k, v); },
    playerSlotNames: () => [], playerLoad: () => player, playerSave: () => {}, slotOnStand: () => null, procureLedger: () => null,
  });
  H.window = H;
  vm.createContext(H);
  Object.defineProperty(H, 'player', { get: () => player, set: v => { player = v; }, configurable: true });
  let d = M.careerNormalise(M.careerNew({ id: 'main', seed: 'routes-page' }));
  d = M.storyStart(d, 'Rufus').doc;
  d.fleet.Rufus = { hangar: 'HOME', aero: 'HOME' }; d.fleet['Client Cub'] = { hangar: null, aero: 'SEA' };
  d.career.airframes['Client Cub'] = { from: 'story', story: 'client', factory: false, modified: false, paid: 0, at: 0, gift: true };
  Object.assign(d.career.story, { beat: 'T6', done: ['T0', 'T1', 'T2', 'T3', 'T4', 'T5'] }); d.career.story.planes.client = d.career.story.planes.gift = 'Client Cub';
  d = M.careerNormalise(d); player = d;
  prefs.set('flydiy.build.Rufus', '{}'); prefs.set('flydiy.build.Client Cub', '{}');
  let fn = null;
  try { fn = vm.runInContext('(function () {\n' + shalf + '\nreturn { storyOnFlightEnd }; })', H, { filename: 'app.js (the story half)' })(); }
  catch (e) { ok(false, "app.js's story half runs headless", e.message); return fails; }
  const w0 = d.wallet;
  const stop = M.careerStopRecord({ how: 'stopped', aero: 'SEA', slot: 'Client Cub', gear: 'floats', row: { from: 'HOME', to: 'SEA', t: 600 } });
  const out = { slot: 'Client Cub', career: { stop, events: [], lines: [] } };
  d = fn.storyOnFlightEnd(d, out);
  const R = M.routesActive(d)[0] || {};
  const L = out.career.lines.find(l => l.k === 'story') || {};
  ok(R.plane === 'Client Cub' && d.wallet === w0 + R.down + M.STORY_T6_FEE && M.storyOf(d).beat === 'T7', "the page's T6 (storyOnFlightEnd): the route signed, the down payment + the commitment fee in the wallet, T7", R.down);
  ok(/Route signed/.test(L.text || '') && /Three aeroplanes/.test(L.text || ''), "the arrival card carries the route's line (with T7's occasions after it)", L.text);
  return fails;
}

if (!SELF) {
  (async () => {
    console.log('  -- the core (78b_routes.js)');
    const f = run().fails;
    console.log("  -- the story's T6");
    const g = story();
    console.log('  -- the page');
    let h = [];
    try { h = await page(); } catch (e) { h = ['the page half threw: ' + (e && e.stack || e)]; console.log('  FAIL ' + h[0]); }
    const all = f.concat(g, h);
    console.log(all.length ? all.length + ' failing' : 'all route rows hold');
    console.log('GATE ROUTES: ' + (all.length ? 'FAIL' : 'PASS'));
    process.exit(all.length ? 1 : 0);
  })();
} else {
  const brk = (name, fn) => Object.assign({}, C, { [name]: fn });
  const breaks = [
    ['a settle pays without sim time', brk('routeSettle', (doc, now) => { const r = C.routeSettle(doc, now); if (r.paid || !C.routesActive(doc).length) return r;
      const d = JSON.parse(J(doc)); d.wallet += 1600; return Object.assign({}, r, { doc: d, paid: 1600, trips: 1 }); })],
    ['the signature does not lock the plane', brk('routeSign', (doc, o, p, q, x) => { const r = C.routeSign(doc, o, p, q, x); if (r.ok) { const e = r.doc.fleet[r.route.plane]; delete e.kind; e.hangar = null; } return r; })],
    ['no down payment', brk('routeSign', (doc, o, p, q, x) => { const r = C.routeSign(doc, o, p, q, x); if (r.ok) r.doc.wallet -= r.route.down; return r; })],
    ['the pay ignores the payload', brk('routeOffer', (doc, a, b, p, o) => { const r = C.routeOffer(doc, a, b, p, Object.assign({}, o, o && o.design ? { design: Object.assign({}, o.design, { seats: 1, bagKg: 0 }) } : {})); return r; })],
  ];
  let bad = 0;
  for (const [what, M] of breaks) { const f = run(M).fails; console.log('  ' + (f.length ? 'caught ' : 'MISSED ') + what + (f.length ? ' (' + f[0] + ')' : '')); if (!f.length) bad++; }
  console.log('GATE ROUTES --selftest: ' + (bad ? 'FAIL' : 'PASS') + ' (' + breaks.length + ' breaks)');
  process.exit(bad ? 1 : 0);
}
