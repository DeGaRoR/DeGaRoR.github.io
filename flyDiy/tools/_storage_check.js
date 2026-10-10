#!/usr/bin/env node
// ============================================================================
// GATE STORAGE - G2690 HANGAR-STORAGE-1: where the aeroplanes are kept, and flying any of them from where it stands.
// ============================================================================
// futureDesigns/game/HANGAR-STORAGE-2026-10-10.md (the user's OK of 10 Oct; the one correction: NO in-world click).
// What is held, in blocks (each negative-verified by --selftest):
//   THE SLOTS      every held building's { inside, outside } from its SHELL (club 2 / 6, works 4 / 6, field 0 / 2), a
//                  shed's own `slots` overriding (the derelict hook); the apron per aerodrome = its buildings' summed,
//                  capped by the COOKED fleet spots (PREM_STORE.spots IS fleet_spots_pack.js's count, per aerodrome) and
//                  by the drawn cap (6).
//   THE MOVES      the ONE move (playerMove): floor / inside / outside / long within a base, free (no wallet, no ledger
//                  line, sandbox and career alike); a full target refused WITH its reason and the document untouched; a
//                  field shed has no inside slot; long -> shown needs a free slot; an away aeroplane cannot move; another
//                  base's building refused; the floor is a SWAP (the aeroplane there takes the mover's place); the slots
//                  on top of the geometry (a C172 into a full club refused by the floor); the wear runs outside only.
//   THE MIGRATION  BOTH WAYS: a v2 document -> v3 (in -> inside while slots remain, then the floor, the rest long; out
//                  at a held base -> the apron, the rest long; away kept; NOTHING lost; a fixpoint; the JSON round trip);
//                  and a v3 document read by an older game (the S2 words `hangar` / `aero` still say where every
//                  aeroplane is) and EDITED by it (a stale `kind`) settles back, nothing lost.
//   NEVER DRAWN    a long-term aeroplane is never stood: FLEET_STAND (fleet_stand.js, run) stands an apron slot k on
//                  spot k, a move changes only the mover's spot, long-term none; the garage's residents
//                  (playerResidentsShown) are the inside slots in order, never long-term, never the stand's.
//   FLY            playerFlyStart: floor -> today's door, inside -> lined up, outside -> the stand, long -> refused (load
//                  it first); each resolved to a start on the analytic HOME (the pilot's own line-up pose on the
//                  runway's centreline / the stand) - and the page goes through the EXISTING roll-out (rollOut,
//                  applyRoute's placeLinedUp, rollAnim's cut), never a launcher of its own (source-scanned).
//   THE PAGE       app.js's doors (the floor follows a load and a save, FLYDIY_STORE), storage_ui.js in the garage's
//                  look (the --ed-* tokens on #hsStore, IBM Plex Sans upright, no serif / italic), drag and drop AND the
//                  tap-then-column, a confirmation before Fly; no world input added (no pointer handler in the world's
//                  fleet / parked props).
//   node tools/_storage_check.js [--selftest]  -> "GATE STORAGE: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const C = require('./flight_core.js');
const SELF = process.argv.includes('--selftest');
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const clone = o => JSON.parse(JSON.stringify(o));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// the pack and fleet_stand.js, run in a window shim (the page's own files)
function loadPack() { const w = {}; vm.runInNewContext(rd('src/viewer/fleet_spots_pack.js'), { window: w }); return w.FLEET_SPOTS_PACK; }
function loadStand(src) {
  const w = { location: { search: '' } };
  vm.runInNewContext(src, { window: w, performance: { now: () => 0 }, setTimeout, Promise });
  return w.FLEET_STAND;
}
const FOOT = { cub: { half: 5.4, fwd: 1.3, aft: 5.5, h: 2.0 }, c172: { half: 5.5, fwd: 1.5, aft: 6.1, h: 2.7 } };

function run(mut) {
  mut = mut || {};
  const fails = []; let checks = 0;
  const ok = (c, m) => { checks++; if (!c) fails.push(m); return !!c; };
  const R = mut.core ? mut.core(Object.assign({}, C)) : C;
  const refused = (r, before, doc, label) => {
    ok(r && r.ok === false && typeof r.why === 'string' && r.why.length > 0, label + ': refused, with a reason (' + (r && r.why) + ')');
    ok(r && r.doc === doc && eq(doc, before), label + ': the refusal leaves the document untouched');
  };
  const D = R.playerDefault();

  // ==== THE SLOTS =========================================================================================================
  const shed = (shell, base, x) => Object.assign({ shell, kits: ['park'], base, tenure: 'own' }, x || {});
  const S = clone(D);
  S.sheds['HOME.2'] = shed('works', 'HOME', { since: 1 });
  S.sheds.w3 = shed('field', 'w3', { since: 2 });
  ok(eq(R.playerStoreSlots(S, 'HOME'), { inside: 2, outside: 6 }), 'the club: 2 inside, its apron up to 6');
  ok(eq(R.playerStoreSlots(S, 'HOME.2'), { inside: 4, outside: 6 }), 'the works (and the hearth, its layout): 4 inside');
  ok(eq(R.playerStoreSlots(S, 'w3'), { inside: 0, outside: 2 }), 'the field shed: 0 inside, 2 outside');
  const der = clone(S); der.sheds['HOME.2'].slots = { inside: 0 };
  ok(eq(R.playerStoreSlots(der, 'HOME.2'), { inside: 0, outside: 6 }), 'a building\'s own `slots` overrides its shell (the derelict hook: 0 inside)');
  ok(eq(R.playerSlots(S, 'HOME'), { bay: 1, parked: 2, total: 3, inside: 2, outside: 6 }), 'playerSlots: the floor (the bay) + the shell\'s inside');
  ok(R.playerBaseOutside(S, 'HOME') === 6 && R.playerBaseOutside(S, 'w3') === 2, 'the apron per aerodrome: HOME 6 (the cap), Tamgas Hill 2 (one field shed)');
  const mn = clone(D); mn.sheds.mn_strip = shed('field', 'mn_strip', { since: 1 });
  ok(R.playerBaseOutside(mn, 'mn_strip') === 0 && R.playerBaseOutside(D, 'w3') === 0, 'no apron where the cook found no spot (the mine\'s street), none where nothing is held');
  const pack = loadPack();
  const spots = mut.spots ? mut.spots(clone(R.PREM_STORE.spots)) : R.PREM_STORE.spots;
  ok(pack && Object.keys(pack.aero).every(a => spots[a] === pack.aero[a].length) && Object.keys(spots).every(a => pack.aero[a]),
     'PREM_STORE.spots is the cooked pack\'s count per aerodrome (' + (pack ? Object.keys(pack.aero).map(a => a + ' ' + pack.aero[a].length).join(', ') : 'no pack') + ')');
  ok(R.PREM_STORE.outsideMax === 6, 'the apron is capped at the drawn cap (6)');

  // ==== THE MOVES ==========================================================================================================
  let d = clone(D); d.wallet = 777; d.mode = 'career';
  const nm = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'];
  for (const n of nm) d.fleet[n] = { hangar: null, aero: 'HOME', foot: FOOT.cub };
  d = R.playerNormalise(d);
  const where = (doc, n) => R.playerStoreWhere(doc, n);
  ok(nm.filter(n => where(d, n).kind === 'outside').length === 6 && nm.filter(n => where(d, n).kind === 'long').length === 3,
     'nine tied down at HOME settle as six on the apron, three long-term');
  const L0 = d.ledger.length;
  // long -> inside, inside 1 -> outside (full), long -> floor
  let r = R.playerMove(d, 'G', { kind: 'inside' });
  ok(r.ok && where(r.doc, 'G').kind === 'inside' && where(r.doc, 'G').slot === 0, 'long-term -> inside: the first free inside slot (' + (r.why || 'ok') + ')');
  ok(r.ok && r.doc.wallet === 777 && r.doc.ledger.length === L0, 'a move is free: no wallet, no ledger line - the career as the sandbox');
  d = r.doc;
  r = R.playerMove(d, 'H', { kind: 'inside', slot: 0 });
  refused(r, clone(d), d, 'inside slot 1 taken');
  let before = clone(d);
  refused(R.playerMove(d, 'H', { kind: 'outside' }), before, d, 'the apron full (6/6)');
  ok(/full/.test(R.playerMove(d, 'H', { kind: 'outside' }).why), 'the reason says the apron is full');
  refused(R.playerMove(d, 'J', { kind: 'outside', slot: 9 }), before, d, 'an apron slot past the apron');
  r = R.playerMove(d, 'A', { kind: 'long' });
  ok(r.ok && where(r.doc, 'A').kind === 'long', 'outside -> long-term');
  const freed = where(d, 'A').slot;
  r = R.playerMove(r.doc, 'J', { kind: 'outside' });
  ok(r.ok && where(r.doc, 'J').kind === 'outside' && where(r.doc, 'J').slot === freed, 'long -> outside takes the slot just freed (' + freed + ')');
  d = r.doc;
  // the floor: a swap
  r = R.playerMove(d, 'B', { kind: 'floor' });
  ok(r.ok && where(r.doc, 'B').kind === 'floor' && !r.swapped, 'outside -> the floor (the stand standing empty)');
  d = r.doc;
  const gIn = where(d, 'G');
  r = R.playerMove(d, 'G', { kind: 'floor' });
  ok(r.ok && where(r.doc, 'G').kind === 'floor' && r.swapped && r.swapped.name === 'B' && where(r.doc, 'B').kind === 'inside' && where(r.doc, 'B').slot === gIn.slot,
     'inside -> the floor is a SWAP: the aeroplane on the floor takes its inside slot (' + JSON.stringify(r.swapped && r.swapped.where) + ')');
  ok(Object.keys(r.doc.fleet).filter(n => where(r.doc, n).kind === 'floor' && where(r.doc, n).hangar === 'HOME').length === 1, 'one floor, one aeroplane');
  d = r.doc;
  r = R.playerMove(d, 'H', { kind: 'floor' });
  ok(r.ok && where(r.doc, 'H').kind === 'floor' && where(r.doc, 'G').kind === 'long', 'long -> the floor: the one there goes long-term in its place');
  // the geometry on top of the slots: a full club takes the stand + 1 Cub (WORKS-COZY's measure); a C172 refused
  let g = clone(D); g.fleet = { Cub: { hangar: 'HOME', aero: 'HOME', kind: 'floor', foot: FOOT.cub }, Cessna: { hangar: 'HOME', aero: 'HOME', kind: 'inside', slot: 0, foot: FOOT.c172 },
                                Big: { hangar: 'HOME', aero: 'HOME', kind: 'long', foot: FOOT.c172 } };
  g = R.playerNormalise(g);
  before = clone(g);
  const rg = R.playerMove(g, 'Big', { kind: 'inside' });
  if (rg.ok) ok(R.hangarPark(g.sheds.HOME, ['Cub', 'Cessna', 'Big'].map(n => ({ name: n, foot: FOOT[n === 'Cub' ? 'cub' : 'c172'] })), {}).unplaced.length === 0,
                'the slots on top of the geometry: a move inside only when the floor packs it');
  else refused(rg, before, g, 'a second C172 into the fully kitted club (the floor does not pack it)');
  const big = clone(D); big.sheds.HOME = shed('club', 'HOME', { kits: ['park'] }); big.fleet = { X: { hangar: null, aero: 'HOME', foot: { half: 16, fwd: 1, aft: 7, h: 2 } } };
  const nb = R.playerNormalise(big); before = clone(nb);
  refused(R.playerMove(nb, 'X', { kind: 'inside' }), before, nb, 'a 32 m span through the club\'s door');
  // a field shed: no inside slot; an away aeroplane; another base
  let f = clone(D); f.sheds.w3 = shed('field', 'w3', { since: 1 });
  f.fleet = { Cub: { hangar: null, aero: 'w3', foot: FOOT.cub }, Far: { hangar: null, aero: 'mk_sea' }, Home: { hangar: 'HOME', aero: 'HOME' } };
  f = R.playerNormalise(f); before = clone(f);
  ok(where(f, 'Cub').kind === 'outside' && where(f, 'Far').kind === 'away', 'at Tamgas Hill on its apron; at Metlakatla (nothing held) away');
  refused(R.playerMove(f, 'Cub', { kind: 'inside' }), before, f, 'inside a field shed (it has no inside slot)');
  refused(R.playerMove(f, 'Far', { kind: 'outside' }), before, f, 'an away aeroplane moved (fly it, or bring it home)');
  refused(R.playerMove(f, 'Cub', { kind: 'long', hangar: 'HOME' }), before, f, 'a building at another base');
  refused(R.playerMove(f, 'Ghost', { kind: 'long' }), before, f, 'an aeroplane not in the fleet');
  r = R.playerMove(f, 'Cub', { kind: 'floor' });
  ok(r.ok && where(r.doc, 'Cub').kind === 'floor' && where(r.doc, 'Cub').hangar === 'w3', 'the field shed\'s one aeroplane is its floor');
  // the wear: runs on the apron, freezes inside / long-term
  let w = clone(D); w.fleet = { P: { hangar: null, aero: 'HOME' } }; w = R.playerNormalise(w); w.clock = 18000;
  const w0 = R.playerWearNow(w, 'P');
  const wl = R.playerMove(w, 'P', { kind: 'long' }).doc; wl.clock += 36000;
  ok(w0 > 0.4 && Math.abs(R.playerWearNow(wl, 'P') - w0) < 1e-3, 'the wear runs on the apron and freezes long-term (' + w0.toFixed(2) + ')');
  const wo = R.playerMove(wl, 'P', { kind: 'outside' }).doc; wo.clock += 18000;
  ok(R.playerWearNow(wo, 'P') > w0 + 0.4, 'back on the apron, it runs again');
  // the floor follows the stand (the page's slot load / save): at the garage's base only
  const fsd = R.playerFloorSync(R.playerMove(d, 'C', { kind: 'long' }).doc, 'C');
  ok(fsd.ok && where(fsd.doc, 'C').kind === 'floor', 'playerFloorSync: the loaded build onto `here`\'s floor');
  ok(R.playerFloorSync(f, 'Far').doc === f, 'playerFloorSync: an aeroplane at another base is left where it is');

  // ==== THE MIGRATION, BOTH WAYS ===========================================================================================
  const v2 = { what: 'flydiy-player', v: 2, wallet: 10, mode: 'sandbox', here: 'HOME', clock: 3600,
    sheds: { HOME: { shell: 'club', kits: ['park'], base: 'HOME', tenure: 'own' }, w3: { shell: 'field', kits: ['park'], base: 'w3', tenure: 'own', since: 5 } },
    fleet: {}, ledger: [] };
  for (const n of ['i1', 'i2', 'i3', 'i4', 'i5']) v2.fleet[n] = { hangar: 'HOME', aero: 'HOME' };
  for (let i = 1; i <= 9; i++) v2.fleet['o' + i] = { hangar: null, aero: 'HOME', outSince: 0 };
  v2.fleet.w = { hangar: 'w3', aero: 'w3' };
  v2.fleet.x = { hangar: null, aero: 'w3', outSince: 0 };
  v2.fleet.away = { hangar: null, aero: 'mk_sea', outSince: 0 };
  const m = R.playerNormalise(R.playerMigrate(clone(v2)));
  const K = n => where(m, n).kind;
  ok(m.v === R.PLAYER_V && R.PLAYER_V === 3, 'v2 -> v3');
  ok(eq(Object.keys(m.fleet).sort(), Object.keys(v2.fleet).sort()), 'the migration loses no aeroplane');
  ok(eq(['i1', 'i2', 'i3', 'i4', 'i5'].map(K), ['inside', 'inside', 'floor', 'long', 'long']), 'today\'s `in`: inside while slots remain, the floor, the rest long-term (' + ['i1', 'i2', 'i3', 'i4', 'i5'].map(K).join(' ') + ')');
  ok([1, 2, 3, 4, 5, 6, 7, 8, 9].filter(i => K('o' + i) === 'outside').length === 6 && [7, 8, 9].every(i => K('o' + i) === 'long'), 'today\'s `out` at a held base: the apron (6), the rest long-term');
  ok(K('w') === 'floor' && K('x') === 'outside' && K('away') === 'away', 'a field shed\'s resident on its floor, its tied-down on its apron, the away one away');
  ok(eq(R.playerNormalise(clone(m)), m) && eq(JSON.parse(JSON.stringify(m)), m), 'v3 is a fixpoint and survives the JSON round trip');
  // the old game's reading of a v3 document: the S2 words still say where each aeroplane is (in a building / its aerodrome)
  ok(Object.keys(m.fleet).every(n => { const W = R.playerWhere(m, n), E = v2.fleet[n]; return W.aero === E.aero && (E.hangar ? W.kind === 'in' && W.hangar === E.hangar : true); }),
     'read the old way (playerWhere), every aeroplane is at its aerodrome, every `in` still in its own building');
  ok(R.playerMigrate({ v: 99, fleet: { a: { hangar: 'HOME', kind: 'nonsense' } } }).fleet.a.kind === 'nonsense', 'a document from the future is not settled by the walk');
  // ...and EDITED by the old game: an arrival puts a long-term row on an apron with its stale kind, another into HOME
  const old = clone(m);
  old.fleet.i4 = { hangar: null, aero: 'w3', kind: 'long' };              // the old playerArrive at w3: tied down
  old.fleet.o7 = { hangar: 'HOME', aero: 'HOME', kind: 'long', slot: 3 };  // ...and an old wheel-in
  old.fleet.o1 = Object.assign({}, old.fleet.o1, { hangar: 'HOME' });     // an apron row wheeled in, its kind stale
  const back = R.playerNormalise(clone(old));
  ok(eq(Object.keys(back.fleet).sort(), Object.keys(v2.fleet).sort()), 'an older game\'s edits settle back: no aeroplane lost');
  ok(where(back, 'i4').kind === 'outside' && where(back, 'i4').aero === 'w3' && where(back, 'o1').hangar === 'HOME' && ['inside', 'floor', 'long'].includes(where(back, 'o1').kind),
     'each edited row placed again where the old game put it (i4 ' + where(back, 'i4').kind + ' at w3, o1 ' + where(back, 'o1').kind + ' in HOME)');
  const slotsOk = doc => {
    const seen = new Set();
    for (const n of Object.keys(doc.fleet)) { const W = where(doc, n); if (W.kind === 'inside' || W.kind === 'outside') { const k = W.kind + '|' + (W.kind === 'inside' ? W.hangar : W.aero) + '|' + W.slot; if (seen.has(k) || W.slot == null) return false; seen.add(k); } }
    return true;
  };
  ok(slotsOk(m) && slotsOk(back), 'every inside / apron slot holds one aeroplane at most');

  // ==== NEVER DRAWN ========================================================================================================
  const FS = loadStand(mut.stand ? mut.stand(rd('src/viewer/fleet_stand.js')) : rd('src/viewer/fleet_stand.js'));
  const P0 = FS.plan(m, null, pack, 'jolene', null, 'HOME', 6);
  const longs = Object.keys(m.fleet).filter(n => K(n) === 'long');
  const all = P0.stand.concat(P0.held, P0.miss).map(p => p.slot);
  ok(longs.length >= 4 && !longs.some(n => all.includes(n)), 'a long-term aeroplane is never stood, held or missed by FLEET_STAND (' + longs.join(', ') + ')');
  ok(P0.stand.length === 6 && P0.stand.every(p => p.spot === pack.aero.HOME[where(m, p.slot).slot][3]), 'an apron slot k stands on HOME\'s spot k');
  const mv = R.playerMove(m, 'o1', { kind: 'long' }).doc;
  const mv2 = R.playerMove(mv, 'o6', { kind: 'outside', slot: where(m, 'o1').slot }).doc;
  const P1 = FS.plan(mv2, null, pack, 'jolene', null, 'HOME', 6);
  const at = P => Object.fromEntries(P.stand.map(p => [p.slot, p.spot]));
  const a0 = at(P0), a1 = at(P1);
  ok(!a1.o1 && a1.o6 === a0.o1 && Object.keys(a0).filter(n => n !== 'o1' && n !== 'o6').every(n => a1[n] === a0[n]),
     'a move changes only the mover\'s spot: o1 put away, o6 onto its apron slot, the others where they stood');
  ok(FS.plan(m, 'o2', pack, 'jolene', null, 'HOME', 6).stand.every(p => p.slot !== 'o2'), 'the aeroplane flown leaves its spot empty');
  const RS = R.playerResidentsShown;
  const rs = RS(m, 'HOME', null, 2);
  ok(eq(rs, ['i1', 'i2']) && !RS(m, 'HOME', null, 9).some(n => K(n) === 'long'), 'the garage\'s residents: the inside slots in order, never long-term (' + rs.join(', ') + ')');
  ok(!RS(m, 'HOME', 'i1', 2).includes('i1'), 'never the build on the stand');

  // ==== FLY FROM WHERE IT STANDS ==========================================================================================
  const fs0 = n => R.playerFlyStart(m, n);
  ok(fs0('i3').start === 'door' && fs0('i1').start === 'lineup' && fs0('o1').start === 'stand' && fs0('away').start === 'stand', 'floor -> the door, inside -> lined up, outside -> the stand');
  ok(!fs0('i4').ok && /load it first/.test(fs0('i4').why), 'long-term: no Fly (load it first)');
  {
    const Wd = C.makeWorld(), a = Wd.aerodromes.find(x => x.id === 'HOME'), site = C.siteOf('HOME');
    const def = C.buildGen(C.GEN_DEFAULT);
    const start = kind => {
      const sim = C.makeSim(def, Wd); sim.reset(0); if (sim.stance) sim.stance();
      C.placeAtStand(sim, a, site.stand);
      if (kind !== 'lineup') return { sim, pose: null };
      const q = C.makePilot(sim, def, Wd, {}); q.setRoute(a, a); q.departFrom(a, a, site);
      const pose = q.lineupPose();
      sim.reset(0); if (sim.stance) sim.stance();
      C.placeAtLineup(sim, a, pose, Wd, def.refs);
      return { sim, pose };
    };
    const li = start(fs0('i1').start), st = start(fs0('o1').start);
    const cg = li.sim.cgPos(), ux = Math.cos(a.hdg), uz = Math.sin(a.hdg);
    const off = Math.abs(-(cg[0] - a.x) * uz + (cg[2] - a.z) * ux), along = Math.abs((cg[0] - a.x) * ux + (cg[2] - a.z) * uz);
    ok(li.pose && off < 3 && along < (a.len || 1000) / 2, 'inside: lined up on HOME\'s runway, on its centreline (' + off.toFixed(2) + ' m off, the pilot\'s pose ' + (li.pose && li.pose.how) + ')');
    const cs = st.sim.cgPos();
    ok(Math.hypot(cs[0] - site.stand.x, cs[2] - site.stand.z) < 6, 'outside: on the stand (' + Math.hypot(cs[0] - site.stand.x, cs[2] - site.stand.z).toFixed(2) + ' m)');
  }

  // ==== THE PAGE ============================================================================================================
  const app = mut.app ? mut.app(rd('src/viewer/app.js')) : rd('src/viewer/app.js');
  const ui = mut.ui ? mut.ui(rd('src/viewer/storage_ui.js')) : rd('src/viewer/storage_ui.js');
  const body = rd('src/viewer/body.html'), css = rd('src/viewer/editor.css'), build = rd('tools/build.js');
  const code = s => s.replace(/\/\/[^\n]*/g, '');
  ok(/storeFloorFollows\(name\)/.test(code(app)) && /loaded: \(name, spec\) => \{[^}]*storeFloorFollows\(name\)/.test(code(app)), 'a slot loaded onto the stand goes onto the floor (api.loaded)');
  ok(/playerFloorSync\(d, info\.saved\)/.test(code(app)), 'a save puts the saved build on the floor');
  ok(/function storeFly\(name\)[\s\S]{0,1600}rollOut\(\(\) => \{ started = true; \}, true\)/.test(code(app)), 'Fly goes through the garage\'s own roll-out (rollOut), no launcher of its own');
  ok(/ssNow && ssNow\.start === 'lineup'/.test(code(app)) && /placeLinedUp\(\)/.test(code(app)), 'applyRoute: an inside start is lined up (placeLinedUp: the pilot\'s pose, by the wind)');
  ok(/ss && ss\.start !== 'door'\) \{ trip\.anim = 'away'/.test(code(app)), 'rollAnim: no door shot from inside / the apron (cut)');
  ok(/storeStart = null;\s*\/\/ G2690/.test(app), 'the garage\'s own Fly is the floor\'s (the storage start cleared)');
  ok(/playerResidentsShown\(d, id, stand, max\)/.test(code(app)), 'the garage\'s residents follow the inside slots');
  ok(/window\.FLYDIY_STORE = \{/.test(app) && /<button id="gStore"/.test(body), 'FLYDIY_STORE and the garage\'s storage button');
  ok(/'storage_ui\.js'/.test(build), 'storage_ui.js is in the page');
  ok(/:is\([^)]*#hsStore[^)]*\) \{/.test(css), 'the storage panel reads the garage\'s --ed-* tokens (declared once, editor.css)');
  const uc = ui.replace(/\/\/[^\n]*/g, '');
  ok(!/(?<!sans-)serif|italic|oblique|Georgia|Times/i.test(uc) && /IBM Plex Sans/.test(uc), 'IBM Plex Sans upright: no serif, no italic');
  ok(!/--ed-[a-z-]+\s*:/.test(uc) && ['panel', 'board', 'ink', 'dim', 'acc', 'hair', 'btn-bg', 'btn-bd', 'warn'].every(t => uc.includes('var(--ed-' + t + ')')), 'the garage\'s tokens read, none restated');
  ok(/'dragstart'/.test(uc) && /'drop'/.test(uc) && /'dragover'/.test(uc), 'drag and drop between the columns');
  ok(/ST\.sel = ST\.sel === name \? null : name/.test(uc) && /if \(!ST\.sel\) return;/.test(uc), 'a phone: tap a card, then a column');
  ok(/function ask\(name\)/.test(uc) && /hsAsk/.test(uc) && /A\.fly\(c\.name\)/.test(uc) && /fl\.addEventListener\('click', ev => \{ ev\.stopPropagation\(\); ask\(name\); \}\)/.test(uc)
     && !/A\.fly\(name\)/.test(uc), 'Fly asks first (the garage\'s look), then flies');
  ok(/kind !== 'long'/.test(uc), 'no Fly on a long-term card');
  for (const f of ['fleet_stand.js', 'parked.js']) {
    const s = rd('src/viewer/' + f);
    // (parked.js's passive pointerdown / input watchers are the bake's idle window, FLEET-PROPS B - they pick nothing)
    ok(!/'click'|"click"|onclick|raycast|intersectObject/i.test(s.replace(/\/\/[^\n]*/g, '')), f + ': nothing added to the world\'s input path (no click on a plane in the world)');
  }
  return { checks, fails };
}

const base = run(null);
if (!SELF) {
  for (const f of base.fails) console.log('  - ' + f);
  console.log(base.checks + ' checks');
  console.log('GATE STORAGE: ' + (base.fails.length ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
  process.exit(base.fails.length ? 1 : 0);
}
// ---- negative verification ------------------------------------------------------------------------------------------
const sub = (re, to) => s => { const o = s.replace(re, to); if (o === s) throw new Error('selftest anchor not found: ' + re); return o; };
const BREAKS = [
  ['the club given 3 inside', { core: R => Object.assign(R, { playerStoreSlots: (d, id) => { const o = C.playerStoreSlots(d, id); return d.sheds[id] && d.sheds[id].shell === 'club' ? { inside: 3, outside: o.outside } : o; } }) }],
  ['the spots table drifts from the cook', { spots: s => Object.assign(s, { w3: 11 }) }],
  ['a move that ignores a full apron', { core: R => Object.assign(R, { playerMove: (doc, n, to, o) => (to && to.kind === 'outside' ? Object.assign(C.playerMove(doc, n, { kind: 'long' }, o), {}) : C.playerMove(doc, n, to, o)) }) }],
  ['the migration drops the overflow', { core: R => Object.assign(R, { playerNormalise: x => { const d = C.playerNormalise(x); for (const n of Object.keys(d.fleet)) if (d.fleet[n].kind === 'long') delete d.fleet[n]; return d; } }) }],
  ['FLEET_STAND draws a long-term aeroplane', { stand: sub("filter(n => F[n] && !F[n].hangar && F[n].aero && F[n].kind !== 'long')", 'filter(n => F[n] && F[n].aero)') }],
  ['FLEET_STAND ignores the apron slot', { stand: sub('r.at != null && r.at < L.length', 'false') }],
  ['an inside Fly from the door', { core: R => Object.assign(R, { playerFlyStart: (d, n) => { const s = C.playerFlyStart(d, n); return s.kind === 'inside' ? Object.assign(s, { start: 'door' }) : s; } }) }],
  ['Fly from long-term allowed', { core: R => Object.assign(R, { playerFlyStart: (d, n) => { const s = C.playerFlyStart(d, n); return s.kind === 'long' ? Object.assign(s, { ok: true, start: 'stand', why: '' }) : s; } }) }],
  ['the page flies through a launcher of its own', { app: sub(/rollOut\(\(\) => \{ started = true; \}, true\);\n    return S;/, 'launchStored(name);\n    return S;') }],
  ['the floor stops following the load', { app: sub(/storeFloorFollows\(name\); \},/, '},') }],
  ['the panel in italics', { ui: sub("font-style:normal; color:var(--ed-ink); }", "font-style:italic; color:var(--ed-ink); }") }],
  ['no tap-then-column', { ui: sub('ST.sel = ST.sel === name ? null : name', 'ST.sel = null') }],
  ['Fly without asking', { ui: sub("fl.addEventListener('click', ev => { ev.stopPropagation(); ask(name); });", "fl.addEventListener('click', ev => { ev.stopPropagation(); A.fly(name); });") }],
];
let bad = 0;
for (const [name, mut] of BREAKS) {
  let r;
  try { r = run(mut); } catch (e) { r = { fails: ['threw: ' + e.message] }; }
  const caught = r.fails.length > base.fails.length && !r.fails.some(f => /selftest anchor not found/.test(f));   // a lost anchor is a miss
  console.log('  ' + (caught ? 'caught ' : 'MISSED ') + ' ' + name + (caught ? '  (' + (r.fails.length - base.fails.length) + ' new)' : ''));
  if (!caught) bad++;
}
console.log('GATE STORAGE selftest: ' + (bad || base.fails.length ? 'FAIL' : 'PASS') + ' (' + (BREAKS.length - bad) + ' of ' + BREAKS.length + ' caught)');
process.exit(bad || base.fails.length ? 1 : 0);
