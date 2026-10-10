#!/usr/bin/env node
// ============================================================================
// GATE GAMEPREM — the game premises' first slice (G2095): the player's bases,
// hangars and fleet as data, the v1 -> v2 save walk, and the rules.
// ============================================================================
// futureDesigns/GAME-PREMISES-2026-10-06.md §6-§7. What is held, in blocks:
//   THE SAVE      every frozen player vintage walks to PLAYER_V; a v1 save's
//                 shed is byte-identical after the walk (shell, kits, dims,
//                 parts, name, and what they compose to: the world's shed
//                 and the verbs); a v2 save is a fixpoint; unknown sheds and
//                 fields ride along; junk does not crash; nothing downgrades.
//   THE ROOM      the door is hangar.js's own two lines (source-scanned); the
//                 packer's contract on a matrix of shells x fit-outs x dims x
//                 fleets: every aeroplane placed or reported with a reason,
//                 nothing overlapping, nothing through a wall or the fit-out,
//                 deterministic, independent of the order it was handed;
//                 the fit-out costs floor, a bigger shell holds more, today's
//                 room holds today's aeroplane, on the centre line.
//   THE LIFT      every saved build is lifted to a base — inside while it
//                 packs, outside after: forty builds keep forty aeroplanes;
//                 idempotent; a deleted slot leaves the ledger.
//   STORE / MOVE  wheel in only where it stands and where it fits; moving is
//                 flying: back home it is back in its own hangar, elsewhere
//                 in a hangar of yours with room, else tied down; recovery
//                 moves nothing and charges the road (career only).
//   HOLDING       acquire / release / upgrade / rent, every refusal leaving
//                 the document exactly as it came; sandbox records, career
//                 charges.
//   THE OFFERS    every offered aerodrome is a runway of Jolene's record, of
//                 the right kind (a slipway on water); every plot's shed takes
//                 an aeroplane that can use that field.
//   PURITY        the rules file touches no DOM, storage or THREE.
//   THE CALLS     (G2230 PREM-S2, the user's rulings of 6 Oct - GAME study
//                 §R): at most two side hangars (a third refused, an older
//                 document's extra ones kept `legacy`); "bring it home" free
//                 in both modes (the ledger line at 0) and back to the hangar
//                 it last left, else the main one, else outside at HOME; no
//                 running costs (no rent offered or taken, nothing per hour);
//                 the slots on top of the geometry (the main hangar the bay +
//                 2, a side hangar 1, a club 2); the outside wear (it runs
//                 outside, freezes inside, resets on Repair / Paint, reaches
//                 the G345 macros); the footprint measured off the nodes; the
//                 bases derived from the hangars held (gp1).
//   THE PAGE      (S2) the doors, source-scanned (GATE PLAYER's idiom): the
//                 lift at load and on save / delete / import, the footprint
//                 at save and roll-out, the roll-out from where the aeroplane
//                 stands, playerArrive on STOPPED after the logbook row, the
//                 clock at each flight's end, the derived bases on the base
//                 line, the fleet popup's place badge.
//
//   THE WORLD     (G2310 PREM-S3) the plots in the premises record (contract v1.34): every offered plot placed in
//                 Jolene's record but the one declared unplaced (tw_ski: no free flat ground), no plot the offers do not
//                 name, HOME's plot the club hangar verbatim; the world stands the held hangars only (GQ8), main + two
//                 at most (GQ4), each at its own shell / dims / dress; residents behind an open door within 60 m only;
//                 the roll-out leaves from the hangar the aeroplane is in (the plot's stand and way out; HOME's site
//                 untouched); and THE SANDBOX WORLD WITH ONLY HOME HELD IS TODAY'S: Jolene composed with the plots and
//                 without them gives the same aerodromes, the same ground and the same sites but for the `plots` key,
//                 and the page's side-shed list for the sandbox is empty (nothing built: setPlayerSheds lifted from
//                 render_world.js, HOME's shed still standShed's own undressed build). The page's doors, source-scanned.
//   node tools/_gameprem_check.js            -> "GATE GAMEPREM: PASS|FAIL"
//   node tools/_gameprem_check.js --show     also print the ROOM table
//   node tools/_gameprem_check.js --selftest -> negative verification: the
//                 rules' own sources doctored one rule at a time, each must
//                 turn a check red (a check that cannot fail is not a check)
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const CORE = require('./flight_core.js');
const SELF = process.argv.includes('--selftest');
const SHOW = process.argv.includes('--show');

// the props' real footprints (GATE HANGAR's way): the fit-out's floor is the
// placed props', so the gate packs against what the browser packs against
const packs = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'props', 'props_packs.json'), 'utf8'));
const pctx = vm.createContext({ registerPropPack: CORE.registerPropPack, console });
for (const f of packs)
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'props', f), 'utf8'), pctx, { filename: f });
const REG = CORE.PROP_REG;

const SRC70 = fs.readFileSync(path.join(ROOT, 'src', 'core', '70_player.js'), 'utf8');
const SRC71 = fs.readFileSync(path.join(ROOT, 'src', 'core', '71_player_bases.js'), 'utf8');
const SRC38B = fs.readFileSync(path.join(ROOT, 'src', 'core', '38b_dest.js'), 'utf8');
const APP_JS = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
const GARAGE_JS = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'garage.js'), 'utf8');
const HANGAR_JS = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'hangar.js'), 'utf8');
const JOLENE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8'));
const NAMES = ['PLAYER_V', 'PLAYER_MIGRATORS', 'playerMigrate', 'playerDefault', 'playerNormalise', 'playerLift',
  'playerShedDims', 'BASE_OFFERS', 'PREM_RATES', 'KIT_PRICES', 'PARK_CLR', 'hangarDims', 'hangarDoor', 'hangarDoorWhy',
  'hangarObstacles', 'parkFoot', 'hangarPark', 'hangarRoomFor', 'playerHangarsAt', 'playerBaseIds', 'playerResidents',
  'playerWhere', 'playerFleetReconcile', 'playerStore', 'playerWheelOut', 'playerArrive', 'playerRecover',
  'shellPrice', 'plotPrice', 'playerOffers', 'playerAcquire', 'playerRelease', 'playerUpgradeCost', 'playerUpgrade',
  'playerGoTo', 'playerClock', 'playerLabourFactor',
  'PREM_MAIN', 'PREM_SIDE_MAX', 'PREM_SLOTS', 'PREM_WEAR', 'playerLedger', 'playerIsMain', 'playerSideIds', 'playerSlots',
  'playerFits', 'playerWearNow', 'playerWearReset', 'playerWearMacro', 'playerWearSpec', 'playerFootOfDef', 'playerPlace',
  'playerBringHome', 'playerRollFrom', 'FLIGHT_BASES', 'flightBasesOf', 'flightBases', 'flightBase',
  'PREM_WORLD', 'playerWorldSheds', 'premResidentsDrawn', 'playerRollHangar', 'playerPlotSite',
  'PREM_STORE', 'playerStoreSlots', 'playerBaseOutside', 'playerStoreWhere', 'playerStoreSettle', 'playerMove', 'playerFloorSync',
  'playerFlyStart', 'playerStoreView'];
const RW_JS = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');
// G2310 (PREM-S3): Jolene composed TWICE, once (the record as shipped, its plots) and once with every `plots` stripped (the
// record as it was before the amendment) - outside run(), so the selftest's forty runs reuse them
const WORLD3 = (() => {
  const IN = require('./island_node.js');
  const snap = rec => {
    const W = IN.islandWorld('jolene', { premises: JSON.stringify(rec) });
    const sites = {}; for (const a of W.aerodromes) { const st = CORE.siteOf(a.id); sites[a.id] = st ? JSON.parse(JSON.stringify(st)) : null; }
    const aero = JSON.stringify(W.aerodromes.map(a => { const o = {}; for (const k in a) if (typeof a[k] !== 'function') o[k] = a[k]; return o; }));
    let gh = 0; for (let x = -5000; x <= 10000; x += 250) for (let z = -16000; z <= 1400; z += 250) { const h = W.terrainH(x, z); gh = (Math.imul(gh, 31) + Math.round(h * 1000)) | 0; }
    for (const a of W.aerodromes) for (let k = -60; k <= 60; k += 4) for (let j = -60; j <= 60; j += 4) { const h = W.terrainH(a.x + k, a.z + j); gh = (Math.imul(gh, 31) + Math.round(h * 1000)) | 0; }
    return { W, sites, aero, gh };
  };
  const rec0 = JSON.parse(JSON.stringify(JOLENE)); for (const r of rec0.layers.runways) delete r.plots;
  const before = snap(rec0), after = snap(JOLENE);   // `after` last: the registry (AIRFIELD_SITES) holds the shipped record's sites
  return { before, after };
})();
// the two files, evaluated FRESH over the core's globals, so the selftest can
// doctor exactly the rules under test and nothing else
function loadRules(mut) {
  let a = SRC70, b = SRC71, c = SRC38B;
  if (mut && mut.src70) a = mut.src70(a);
  if (mut && mut.src71) b = mut.src71(b);
  if (mut && mut.src38b) c = mut.src38b(c);
  const ctx = vm.createContext(Object.assign({ console }, CORE));
  vm.runInContext(c + '\n' + a + '\n' + b + '\n;this.__R = { ' + NAMES.join(', ') + ' };', ctx, { filename: 'rules' });
  return Object.assign(ctx.__R, { __src71: b, __rw: (mut && mut.rw) ? mut.rw(RW_JS) : RW_JS,
    __app: (mut && mut.app) ? mut.app(APP_JS) : APP_JS, __garage: (mut && mut.garage) ? mut.garage(GARAGE_JS) : GARAGE_JS });
}

let fails = [], checks = 0;
const ok = (c, msg) => { checks++; if (!c) fails.push(msg); return !!c; };
const J = o => JSON.stringify(o);
const eq = (a, b) => J(a) === J(b);
const clone = o => JSON.parse(J(o));
const FOOT = k => { const d = CORE.GP_PARKED_FOOT[k]; return { half: d[0], fwd: d[1], aft: d[2] }; };
const site = CORE.siteOf('HOME');
const fixtures = () => fs.readdirSync(path.join(__dirname, 'fixtures')).filter(f => /^player_.*\.json$/.test(f)).sort()
  .map(f => [f, JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f), 'utf8'))]);
let ROOM = [];

function run(mut) {
  fails = []; checks = 0; ROOM = [];
  const R = loadRules(mut);
  const opts = { reg: REG };
  // every refusal must hand back the very document it was given, untouched
  const refused = (r, before, doc, label) => {
    ok(r && r.ok === false && typeof r.why === 'string' && r.why.length > 0, label + ': refused, with a reason');
    ok(r && r.doc === doc, label + ': the refusal hands back the same document');
    ok(eq(doc, before), label + ': the refusal changed nothing');
  };
  const v2 = d => R.playerNormalise(R.playerMigrate(clone(d)));

  // ==== THE SAVE ===========================================================
  ok(R.PLAYER_V === 3, 'PLAYER_V is 3 (G2690 HANGAR-STORAGE: every aeroplane in one place)');
  const D = R.playerDefault();
  ok(D.v === 3 && D.mode === 'sandbox' && D.here === 'HOME' && D.clock === 0 && eq(D.fleet, {}) && eq(D.ledger, []),
     'the default is a v3 sandbox at HOME with an empty fleet');
  ok(D.sheds.HOME.base === 'HOME' && D.sheds.HOME.tenure === 'own', 'the default HOME is held, owned, at HOME');
  ok(eq(D, R.playerNormalise(clone(D))), 'the default is a fixpoint of the normaliser');
  const shelf = fixtures();
  ok(shelf.some(([f, r]) => r.v === 1) && shelf.some(([f, r]) => r.v === 2), 'the shelf holds a v1 and a v2 save');
  for (const [f, raw] of shelf) {
    const doc = v2(raw);
    ok(doc.v === R.PLAYER_V, f + ': lands on v' + R.PLAYER_V);
    ok(eq(doc, R.playerNormalise(clone(doc))), f + ': the walk lands on a fixpoint');
    ok(eq(JSON.parse(J(doc)), doc), f + ': survives a JSON round trip');
    for (const id of Object.keys(raw.sheds)) {
      const a = raw.sheds[id], b = doc.sheds[id];
      for (const k of Object.keys(a))
        if (k !== 'base' && k !== 'tenure') ok(eq(a[k], b[k]), f + ': shed ' + id + '.' + k + ' unchanged by the walk');
      ok(b.base === (a.base || id), f + ': shed ' + id + ' stands at ' + (a.base || id));
    }
    ok(doc.wallet === raw.wallet, f + ': the wallet unchanged');
    // what the old shed COMPOSES to is unchanged: the world's shed and the verbs
    const rawShed = clone(raw.sheds.HOME);
    ok(eq(CORE.playerShedDims(raw, 'HOME', site), CORE.playerShedDims(doc, 'HOME', site)), f + ': the world\'s shed composes to the same dims');
    ok(eq(CORE.hangarCaps(rawShed), CORE.hangarCaps(doc.sheds.HOME)), f + ': the shed\'s verbs unchanged');
    if (raw.v === 1) {
      ok(doc.mode === 'sandbox', f + ': a v1 save is a sandbox — nothing it held starts costing');
      ok(eq(doc.fleet, {}) && doc.here === 'HOME', f + ': a v1 save opens at HOME, its fleet to be lifted');
    } else if (raw.v === R.PLAYER_V) ok(eq(doc, raw), f + ': a current save walks to itself, byte for byte');
    else {
      // G2690: a v2 save gains each aeroplane's place (kind / slot) - every row kept, its building and aerodrome unchanged
      const F0 = raw.fleet || {}, F1 = doc.fleet || {};
      ok(eq(Object.keys(F0).sort(), Object.keys(F1).sort()), f + ': the walk to v3 keeps every aeroplane');
      ok(Object.keys(F0).every(n => (F0[n].hangar ? F1[n].hangar === F0[n].hangar : (!F1[n].hangar || F1[n].kind === 'long')) && F1[n].aero === F0[n].aero
           && R.PREM_STORE.kinds.includes(F1[n].kind)),
         f + ': each row keeps its building and aerodrome and gets a place (' + Object.keys(F1).map(n => n + ' ' + F1[n].kind).join(', ') + ')');
      const r2 = clone(raw);
      ok(eq(Object.assign({}, doc, { fleet: null, v: null }), Object.assign({}, r2, { fleet: null, v: null })), f + ': nothing but the fleet rows\' places and the version changes');
    }
  }
  const odd = v2({ what: 'flydiy-player', v: 1, wallet: 5, sheds: { HOME: { shell: 'works', kits: ['park'] },
                   M1: { shell: 'field', kits: [], extra: 7 }, BAD: null }, odd: { keep: 1 } });
  ok(odd.sheds.M1.base === 'M1' && odd.sheds.M1.extra === 7, 'an unknown shed rides along and stands at its own key');
  ok(odd.sheds.BAD === null && eq(odd.odd, { keep: 1 }), 'junk sheds and unknown fields ride along untouched');
  const fut = R.playerMigrate({ v: 99, sheds: { HOME: { shell: 'club' } } });
  ok(fut.v === 99 && !('base' in fut.sheds.HOME), 'a document from the future passes the walk untouched');
  const noV = R.playerNormalise({ wallet: 1, sheds: { HOME: { shell: 'club', kits: ['park'] }, w3: { shell: 'field', kits: [] } } });
  ok(noV.sheds.w3.base === 'w3' && noV.here === 'HOME', 'a document that skipped the walk still lands right');
  const L = R.playerLift({ HW: 18, HD: 14, EAVE: 8 }, null);
  ok(L.v === 3 && L.sheds.HOME.base === 'HOME' && eq(L.sheds.HOME.dims, { HW: 18, HD: 14, EAVE: 8 }), 'the v0 pref lift lands on v3');
  ok(eq(R.playerNormalise({ v: 2, here: 'nowhere', mode: 'x', clock: -3, fleet: [], ledger: 7 }).here, 'HOME'),
     'a bad `here` falls back to HOME');

  // ==== THE ROOM ============================================================
  // the door: hangar.js's own lines, evaluated, against hangarDoor
  const mW = /const DOOR_W = ([^;\n]+);/.exec(HANGAR_JS), mH = /const DOOR_H = ([^;\n]+);/.exec(HANGAR_JS);
  ok(!!mW && !!mH, 'hangar.js still declares DOOR_W and DOOR_H');
  for (const sk of Object.keys(CORE.SHELLS)) {
    const lim = CORE.shellLims(sk);
    for (const pick of [0, 1]) for (const dims of [CORE.SHELLS[sk].dims, { HW: lim.HW[pick], HD: lim.HD[pick], EAVE: lim.EAVE[pick] }]) {
      const want = mW && mH ? new Function('HW', 'EAVE', 'FRAME', 'return [' + mW[1] + ', ' + mH[1] + '];')(dims.HW, dims.EAVE, CORE.SHELLS[sk].frame) : [NaN, NaN];
      const got = R.hangarDoor({ shell: sk, dims });
      ok(Math.abs(got.w - want[0]) < 1e-9 && Math.abs(got.h - want[1]) < 1e-9,
         'the ' + sk + ' door at ' + J(dims) + ' is hangar.js\'s (' + want.map(v => +v.toFixed(2)) + ' vs ' + [got.w, got.h].map(v => +v.toFixed(2)) + ')');
    }
  }
  const KITSETS = { bare: ['park'], bench: ['park', 'bench'], full: CORE.HANGAR_KITS_DEFAULT.slice() };
  const FLEETS = {
    cubs: k => Array.from({ length: k }, (_, i) => ({ name: 'cub' + i, foot: FOOT('cub') })),
    mixed: () => ['cub', 'jodel', 'c172', 'caravan', 'twinBush', 'pittsAlike', 'beaver', 'rv']
      .map((a, i) => ({ name: a + i, foot: FOOT(a) })),
  };
  const contract = (shed, planes, label) => {
    const P = R.hangarPark(shed, planes, opts);
    const Dm = R.hangarDims(shed), obs = R.hangarObstacles(shed, REG);
    ok(P.placed.length + P.unplaced.length === planes.length, label + ': every aeroplane placed or reported');
    ok(P.unplaced.every(u => typeof u.why === 'string' && u.why), label + ': every miss says why');
    const hit = (a, b) => a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.z0 < b.z1 - 1e-6 && a.z1 > b.z0 + 1e-6;
    let wall = 0, lap = 0, fit = 0;
    for (let i = 0; i < P.placed.length; i++) {
      const r = P.placed[i].rect;
      if (r.x0 < -Dm.HD - 1e-6 || r.x1 > Dm.HD + 1e-6 || r.z0 < -Dm.HW - 1e-6 || r.z1 > Dm.HW + 1e-6) wall++;
      for (let j = i + 1; j < P.placed.length; j++) if (hit(r, P.placed[j].rect)) lap++;
      for (const o of obs) if (hit(r, o)) fit++;
    }
    ok(!wall, label + ': nothing through a wall (' + wall + ')');
    ok(!lap, label + ': no two aeroplanes overlap (' + lap + ')');
    ok(!fit, label + ': nothing parked on the fit-out (' + fit + ')');
    const again = R.hangarPark(shed, planes.slice().reverse(), opts);
    ok(eq(again.placed.map(p => [p.name, p.x, p.z]).sort(), P.placed.map(p => [p.name, p.x, p.z]).sort()),
       label + ': the same answer whatever order it was handed');
    return P;
  };
  for (const sk of Object.keys(CORE.SHELLS)) {
    const lim = CORE.shellLims(sk);
    for (const [kn, kits] of Object.entries(KITSETS))
      for (const [dn, dims] of [['def', CORE.SHELLS[sk].dims], ['max', { HW: lim.HW[1], HD: lim.HD[1], EAVE: lim.EAVE[1] }]]) {
        const shed = { shell: sk, kits, dims };
        contract(shed, FLEETS.cubs(8), sk + '/' + kn + '/' + dn + ' cubs');
        contract(shed, FLEETS.mixed(), sk + '/' + kn + '/' + dn + ' mixed');
      }
  }
  const room = (sk, kits, a, dims) => R.hangarRoomFor({ shell: sk, kits, dims: dims || CORE.SHELLS[sk].dims }, FOOT(a), [], opts);
  for (const a of ['cub', 'jodel', 'c172', 'caravan', 'twinBush']) {
    const row = {};
    for (const sk of Object.keys(CORE.SHELLS)) for (const kn of ['bare', 'full']) row[sk + '/' + kn] = room(sk, KITSETS[kn], a);
    ROOM.push([a, row]);
    ok(row['club/bare'] >= row['club/full'] && row['works/bare'] >= row['works/full'] && row['field/bare'] >= row['field/full'],
       a + ': the fit-out costs floor, never adds it');
    ok(row['works/bare'] >= row['club/bare'] && row['club/bare'] >= row['field/bare'], a + ': the bigger shell holds at least as many');
  }
  const cubRow = ROOM[0][1];
  ok(cubRow['club/bare'] > cubRow['club/full'], 'the full fit-out takes real floor from the club (Cubs ' + cubRow['club/bare'] + ' -> ' + cubRow['club/full'] + ')');
  ok(cubRow['club/bare'] >= 4, 'a bare club parks Cubs two abreast (' + cubRow['club/bare'] + ')');
  ok(cubRow['field/bare'] === 0 && R.hangarDoorWhy({ shell: 'field' }, FOOT('cub')).indexOf('door') >= 0,
     'a field shed at its own dims does not take a Cub\'s 10.8 m through its 9 m door, and says so');
  const fc = R.hangarPark({ shell: 'field', kits: ['park'] }, [{ name: 'cub', foot: FOOT('cub') }], opts);
  ok(fc.unplaced.length === 1 && /door/.test(fc.unplaced[0].why), 'the packer itself turns the Cub away at the field shed\'s door');
  ok(room('field', KITSETS.bare, 'jodel') >= 1, 'a bare field shed takes a Jodel');
  ok(R.hangarDoorWhy({ shell: 'club' }, { half: 5, fwd: 1, aft: 5, h: 6 }).indexOf('height') >= 0, 'a measured height over the door is refused');
  // TODAY'S ROOM HOLDS TODAY'S AEROPLANE, where the garage stands it
  for (const a of Object.keys(CORE.GP_PARKED_FOOT))
    ok(R.hangarRoomFor(D.sheds.HOME, FOOT(a), [], opts) >= 1, 'the default HOME takes a ' + a);
  ok(R.hangarRoomFor(D.sheds.HOME, null, [], opts) >= 1, 'the default HOME takes an unmeasured build (the 12 m default)');
  const lone = R.hangarPark({ shell: 'club', kits: ['park'] }, [{ name: 'c', foot: FOOT('cub') }], opts);
  ok(lone.placed.length === 1 && lone.placed[0].z === 0, 'a lone aeroplane stands on the centre line');

  // ==== THE LIFT =============================================================
  const v1 = clone(shelf.find(([f, r]) => r.v === 1)[1]);
  const d1 = v2(v1), d1copy = clone(d1);
  const names3 = ['Alpha', 'Bravo', 'Charlie'];
  const Lr = R.playerFleetReconcile(d1, names3, opts);
  ok(eq(d1, d1copy), 'the lift does not touch the document it is handed');
  ok(Lr.ok && eq(Object.keys(Lr.doc.fleet).sort(), names3), 'the lift puts every saved build in the fleet');
  ok(names3.every(n => ['in', 'out'].includes(R.playerWhere(Lr.doc, n).kind) && R.playerWhere(Lr.doc, n).aero === 'HOME'),
     'every lifted build stands at HOME, inside or tied down outside');
  ok(R.playerResidents(Lr.doc, 'HOME').length >= 1, 'the lift fills the hangar first');
  const P0 = R.hangarPark(Lr.doc.sheds.HOME, R.playerResidents(Lr.doc, 'HOME').map(n => ({ name: n, foot: R.parkFoot(null) })), opts);
  ok(!P0.unplaced.length, 'what the lift put inside does fit inside');
  const forty = Array.from({ length: 40 }, (_, i) => 'build ' + String(i).padStart(2, '0'));
  const L40 = R.playerFleetReconcile(d1, forty, opts);
  ok(Object.keys(L40.doc.fleet).length === 40 && forty.every(n => R.playerWhere(L40.doc, n).kind !== 'none'),
     'forty saved builds keep forty aeroplanes — the lift refuses nothing');
  // G2690: the overflow takes the apron's slots (HOME's club: 6), the rest is kept long-term - nothing refused
  ok(forty.filter(n => R.playerStoreWhere(L40.doc, n).kind === 'outside').length === R.playerBaseOutside(L40.doc, 'HOME')
     && forty.filter(n => R.playerStoreWhere(L40.doc, n).kind === 'long').length >= 30, 'the overflow fills HOME\'s apron, then long-term');
  const again = R.playerFleetReconcile(Lr.doc, names3, opts);
  ok(eq(again.doc, Lr.doc) && !again.lifted.length && !again.dropped.length, 'the lift is idempotent');
  const del = R.playerFleetReconcile(Lr.doc, ['Alpha', 'Charlie'], opts);
  ok(eq(del.dropped, ['Bravo']) && !del.doc.fleet.Bravo && eq(del.doc.fleet.Alpha, Lr.doc.fleet.Alpha),
     'a deleted slot leaves the ledger, the others stay where they were');

  // ==== STORE / MOVE ===========================================================
  // a career game with a second base: Tamgas Hill's field shed (8.5 m: a 12 m door)
  let g = clone(Lr.doc);
  g.mode = 'career'; g.wallet = 1000000;   // G2260: the price book's hangars (a works ~170 000)
  const acq = R.playerAcquire(g, 'w3', 'w3', 'field', 'own');
  ok(acq.ok && acq.doc.sheds.w3.base === 'w3' && eq(acq.doc.sheds.w3.dims, { HW: 8.5, HD: 9, EAVE: 3.6 }),
     'Tamgas Hill\'s shed is held at its offered size');
  ok(acq.ok && acq.doc.wallet === 1000000 - R.plotPrice('w3', 'w3', 'field'), 'the career pays the plot\'s price (' + R.plotPrice('w3', 'w3', 'field') + ')');
  g = acq.doc;
  for (const n of names3) g.fleet[n].foot = FOOT('cub');
  const inHome = R.playerResidents(g, 'HOME');
  const cub = inHome[0];
  let before = clone(g);
  refused(R.playerStore(g, cub, 'w3', null, opts), before, g, 'storing at a base the aeroplane is not at');
  ok(/fly it/.test(R.playerStore(g, cub, 'w3', null, opts).why), 'the refusal says to fly it there');
  const back = R.playerArrive(g, cub, 'HOME', opts);
  ok(back.ok && back.doc === g && back.kind === 'in' && back.hangar === 'HOME', 'landing back home: back in its own hangar, nothing moves');
  const arr = R.playerArrive(g, cub, 'w3', opts);
  ok(arr.ok && arr.kind === 'in' && arr.hangar === 'w3', 'flown to Tamgas Hill: into the shed there (' + (arr.why || 'in') + ')');
  ok(!R.playerResidents(arr.doc, 'HOME').includes(cub), 'and its room at HOME is free again');
  // fill Tamgas Hill: as many Cubs as its room says go in, the next is tied down
  const w3room = R.hangarRoomFor(g.sheds.w3, FOOT('cub'), [], opts);
  ok(w3room >= 1 && w3room < 6, 'Tamgas Hill\'s shed takes a few Cubs on its floor (' + w3room + ')');
  // GQ7: a field shed is a one-aeroplane shed - its slot caps what the floor would take
  const w3cap = Math.min(R.playerSlots(g, 'w3').total, w3room);
  ok(R.playerSlots(g, 'w3').total === 1 && w3cap === 1, 'a side field shed has one slot (' + w3cap + ' of a floor for ' + w3room + ')');
  const cubs = Array.from({ length: w3cap + 1 }, (_, i) => 'Cub ' + i);
  let fill = clone(g);
  for (const n of cubs) fill.fleet[n] = { hangar: null, aero: 'HOME', foot: FOOT('cub') };
  const kinds = [];
  for (const n of cubs) { const a2 = R.playerArrive(fill, n, 'w3', opts); kinds.push(a2.kind); fill = a2.doc; }
  const last = cubs[cubs.length - 1];
  ok(kinds.slice(0, -1).every(k => k === 'in') && kinds[kinds.length - 1] === 'out',
     'Cubs flown to Tamgas Hill go in while a slot is free and the floor takes them, then tie down outside (' + kinds.join(' ') + ')');
  ok(R.playerWhere(fill, last).kind === 'out', 'playerWhere reads it as out, at a base of yours');
  before = clone(fill);
  refused(R.playerStore(fill, last, 'w3', null, opts), before, fill, 'wheeling into a full shed');
  const out1 = R.playerWheelOut(fill, cubs[0]);
  ok(out1.ok && R.playerWhere(out1.doc, cubs[0]).kind === 'out' && R.playerWhere(out1.doc, cubs[0]).aero === 'w3',
     'wheeled out: tied down at the same field');
  const in2 = R.playerStore(out1.doc, last, 'w3', null, opts);
  ok(in2.ok && R.playerWhere(in2.doc, last).hangar === 'w3', 'and the one outside wheels into the room it left');
  const away = R.playerArrive(g, cub, 'mn_strip', opts);
  ok(away.ok && away.kind === 'away' && R.playerWhere(away.doc, cub).kind === 'away', 'a field where you hold nothing: tied down, away');
  before = clone(g);
  refused(R.playerArrive(g, cub, null, opts), before, g, 'an arrival nowhere');
  const rec = R.playerRecover(g, cub, { km: 12 });
  ok(rec.ok && eq(rec.doc.fleet, g.fleet), 'a recovery moves nothing: it is where it departed from');
  // GQ5 (G2230): free in both modes, and the history still says it happened
  const rl = rec.doc.ledger.slice(-1)[0] || {};
  ok(rec.doc.wallet === g.wallet && rec.fee === 0 && rl.k === 'recover' && rl.amt === 0 && rl.ref === cub && rl.free === false,
     'GQ5: the career pays nothing for the road home, and the ledger line is written at 0');
  const sand = clone(g); sand.mode = 'sandbox';
  const recS = R.playerRecover(sand, cub, { km: 12 });
  ok(recS.doc.wallet === sand.wallet && recS.doc.ledger.slice(-1)[0].free === true && recS.doc.ledger.length === sand.ledger.length + 1,
     'GQ5: the sandbox the same - free, and recorded');
  // two hangars at HOME: a build parked in HOME.2 comes back to HOME.2
  const two = R.playerAcquire(g, 'HOME', 'HOME.2', 'works', 'own');
  ok(two.ok && R.playerBaseIds(two.doc).join() === 'HOME,w3', 'two bases, three hangars');
  const mv = R.playerStore(R.playerWheelOut(two.doc, cub).doc, cub, 'HOME.2', null, opts);
  ok(mv.ok && R.playerWhere(mv.doc, cub).hangar === 'HOME.2', 'wheeled across HOME into the works');
  const home2 = R.playerArrive(mv.doc, cub, 'HOME', opts);
  ok(home2.hangar === 'HOME.2', 'a circuit at HOME brings it back to the works, not the first hangar');
  const pref = R.playerArrive(R.playerArrive(mv.doc, cub, 'w3', opts).doc, cub, 'HOME', Object.assign({ prefer: 'HOME.2' }, opts));
  ok(pref.hangar === 'HOME.2', 'an arrival honours the hangar asked for');

  // ==== HOLDING ===================================================================
  before = clone(g);
  refused(R.playerAcquire(g, 'w3', 'w3', 'field', 'own'), before, g, 'a plot already held');
  refused(R.playerAcquire(g, 'tw_ski', 'tw_ski', 'works', 'own'), before, g, 'a shell the plot does not take');
  refused(R.playerAcquire(g, 'nv_strip', 'nv_strip', 'field', 'own'), before, g, 'a field with nothing to build on');
  const poor = clone(g); poor.wallet = 10; const poorB = clone(poor);
  refused(R.playerAcquire(poor, 'tw_ski', 'tw_ski', 'club', 'own'), poorB, poor, 'a career wallet short of the price');
  // G-COST (G2230): no running costs - a hangar is bought, never rented; nothing accrues per hour
  refused(R.playerAcquire(poor, 'tw_ski', 'tw_ski', 'club', 'rent'), poorB, poor, 'G-COST: renting a hangar');
  ok(/never rented/.test(R.playerAcquire(poor, 'tw_ski', 'tw_ski', 'club', 'rent').why), 'G-COST: the refusal says hangars are bought');
  ok(R.playerOffers(D, null).every(o => o.shells.every(x => !('rent' in x))), 'G-COST: no offer carries a rent');
  const vint = v2(shelf.find(([f, r]) => r.v === 2)[1]);
  const hr = R.playerClock(vint, 3600);
  ok(hr.dues === 0 && hr.doc.wallet === vint.wallet && hr.doc.ledger.length === vint.ledger.length && hr.doc.clock === vint.clock + 3600,
     'G-COST: an hour flown costs nothing, not even an old document\'s rented shed (the clock moves, the wallet and the ledger do not)');
  ok(vint.sheds.w3.tenure === 'rent', 'an old document\'s rented shed is kept as it was (the field stays in v2)');
  const sb = R.playerAcquire(D, 'tw_ski', 'tw_ski', 'club', 'own');
  ok(sb.ok && sb.doc.wallet === D.wallet && sb.doc.ledger.length === 1 && sb.doc.ledger[0].free && sb.doc.ledger[0].amt === R.plotPrice('tw_ski', 'tw_ski', 'club'),
     'the sandbox holds it for nothing and records what it would have cost');
  ok(eq(sb.doc.sheds.tw_ski.kits, ['park']) && sb.doc.sheds.tw_ski.shell === 'club', 'a newly held hangar is what its offer says (a bare club)');
  // release
  before = clone(arr.doc);
  refused(R.playerRelease(arr.doc, 'w3'), before, arr.doc, 'releasing a hangar with an aeroplane inside');
  refused(R.playerRelease(D, 'HOME'), clone(D), D, 'releasing the last hangar');
  const emptyW3 = R.playerAcquire(clone(D), 'w3', 'w3', 'field', 'own').doc;
  emptyW3.mode = 'career'; emptyW3.here = 'w3';
  const rel = R.playerRelease(emptyW3, 'w3');
  ok(rel.ok && !rel.doc.sheds.w3 && rel.doc.here === 'HOME', 'an empty hangar goes, and the garage door moves off it');
  ok(rel.doc.wallet === emptyW3.wallet + Math.round(emptyW3.sheds.w3.price * R.PREM_RATES.resale), 'an owned hangar sells back at half');
  // upgrade
  const up0 = arr.doc;              // a Cub inside Tamgas Hill's 8.5 m shed
  before = clone(up0);
  refused(R.playerUpgrade(up0, 'w3', { dims: { HW: 7 } }, opts), before, up0, 'shrinking the shed round the Cub inside');
  refused(R.playerUpgrade(up0, 'w3', { dims: { HW: 30 } }, opts), before, up0, 'dims outside the shell\'s envelope');
  refused(R.playerUpgrade(up0, 'w3', { shell: 'works' }, opts), before, up0, 'a shell the plot does not take');
  const grow = R.playerUpgrade(up0, 'w3', { dims: { HW: 10 } }, opts);
  ok(grow.ok && grow.cost > 0 && grow.doc.wallet === up0.wallet - grow.cost && R.hangarDims(grow.doc.sheds.w3).HW === 10,
     'extending the shed is paid by the square metre (' + (grow.cost || 0) + ')');
  const kit = R.playerUpgrade(up0, 'w3', { kits: ['park', 'bench', 'store'] }, opts);
  ok(kit.ok && kit.cost === R.KIT_PRICES.store && kit.doc.sheds.w3.kits.includes('store'), 'a kit is paid at its price');
  const crowd = R.playerUpgrade(up0, 'w3', { kits: CORE.HANGAR_KITS_DEFAULT.slice() }, opts);
  ok(!crowd.ok && /no longer hold/.test(crowd.why || ''), 'a fit-out that would push the Cub out is refused');
  const C1 = R.playerUpgradeCost({ shell: 'club', kits: ['park'] }, { shell: 'works' });
  ok(C1.cost === Math.round(R.shellPrice('works') - R.PREM_RATES.rebuildCredit * R.shellPrice('club')), 'a rebuild credits half the old shell');
  const mine = { shell: 'field', kits: ['park'], base: 'mn_strip', dims: { HW: 7, HD: 9, EAVE: 3.6 } };
  const cMine = R.playerUpgradeCost(mine, { dims: { HW: 9 } }, 'mn_strip').cost, cAny = R.playerUpgradeCost(mine, { dims: { HW: 9 } }).cost;
  ok(cMine > 0 && Math.abs(cMine - 0.5 * cAny) <= 1, 'building work at the mine costs the mine\'s price factor (' + cMine + ' of ' + cAny + ')');
  const tw = R.playerAcquire(clone(D), 'tw_ski', 'tw_ski', 'field', 'own').doc;
  const re = R.playerUpgrade(tw, 'tw_ski', { shell: 'club' }, opts);
  ok(re.ok && re.doc.sheds.tw_ski.price === R.plotPrice('tw_ski', 'tw_ski', 'club'), 'a rebuilt hangar is priced at its plot (what a release refunds half of)');
  // the garage's door, the labour
  ok(R.playerGoTo(arr.doc, 'w3').doc.here === 'w3' && !R.playerGoTo(arr.doc, 'nope').ok, 'the garage opens in any hangar held, and only those');
  ok(R.playerLabourFactor(D.sheds.HOME, ['wood']) === R.PREM_RATES.labourFit
     && R.playerLabourFactor({ shell: 'club', kits: ['park'] }, ['wood']) === R.PREM_RATES.labourShort
     && R.playerLabourFactor(null, ['wood']) === R.PREM_RATES.labourAway, 'the labour factor reads the fit-out');

  // ==== THE OFFERS ================================================================
  const rws = {};
  for (const r of (JOLENE.layers && JOLENE.layers.runways) || []) rws[r.id] = r;
  for (const aero of Object.keys(R.BASE_OFFERS)) {
    const rw = rws[aero];
    ok(!!rw, 'the offer ' + aero + ' is a runway of Jolene\'s record');
    for (const [pid, P] of Object.entries(R.BASE_OFFERS[aero].plots)) {
      ok(!!rw && (+rw.surface === 4) === !!P.water, pid + ': a slipway on water, a shed on land');
      for (const s of P.shells) {
        ok(CORE.SHELLS[s] && CORE.SHELLS[s].status === 'live', pid + ': ' + s + ' is a live shell');
        const dims = Object.assign({}, CORE.SHELLS[s].dims, (P.dims && P.dims[s]) || {}), lim = CORE.shellLims(s);
        ok(['HW', 'HD', 'EAVE'].every(k => dims[k] >= lim[k][0] && dims[k] <= lim[k][1]), pid + ': the ' + s + ' is offered inside its envelope');
        // as BOUGHT: the offer's kits, a bare shed for the starter's other shells (a rebuild keeps
        // the fit-out it has, and playerUpgrade refuses one that would push an aeroplane out)
        const who = P.water ? 'floatplane' : (P.derelict ? 'jodel' : 'cub');
        ok(R.hangarRoomFor({ shell: s, kits: P.kits || ['park'], dims }, FOOT(who), [], opts) >= 1,
           pid + ': the ' + s + ' as offered takes a ' + who);
      }
    }
  }
  ok(R.BASE_OFFERS.HOME.plots.HOME.starter === true && !R.BASE_OFFERS.w2, 'HOME is the starter plot; 02/20 is HOME\'s own field');
  const offA = R.playerOffers(D, { aerodromes: [{ id: 'HOME', kind: 'main' }, { id: 'M1', kind: 'meadow' }] });
  ok(offA.length === 2 && offA.every(o => o.aero === 'HOME') && offA.find(o => o.plot === 'HOME').held,
     'the analytic world offers HOME\'s plots only, the starter held');

  // ==== THE CALLS (G2230 PREM-S2: the user's rulings of 6 Oct, GAME study §R) ======
  {
    const cub = FOOT('cub');
    const career = d => { const x = clone(d); x.mode = 'career'; x.wallet = 1000000; return x; };   // G2260: the price book's hangars (a works ~170 000)
    // GQ4: at most two side hangars - a third refused, with a reason; the main one is not a side
    let c = career(D);
    c = R.playerAcquire(c, 'w3', 'w3', 'field', 'own').doc;
    c = R.playerAcquire(c, 'HOME', 'HOME.2', 'works', 'own').doc;
    ok(eq(R.playerSideIds(c), ['HOME.2', 'w3'].sort((a, b) => (c.sheds[a].since - c.sheds[b].since) || (a < b ? -1 : 1))) && R.playerSideIds(c).length === 2,
       'GQ4: two side hangars held (' + R.playerSideIds(c).join(', ') + '), the main one not among them');
    let before = clone(c);
    refused(R.playerAcquire(c, 'tw_ski', 'tw_ski', 'club', 'own'), before, c, 'GQ4: a third side hangar');
    ok(/two side hangars/.test(R.playerAcquire(c, 'tw_ski', 'tw_ski', 'club', 'own').why), 'GQ4: the refusal says why (two side hangars)');
    ok(R.playerOffers(c, null).filter(o => !o.held).every(o => o.capped) && !R.playerOffers(D, null).some(o => o.capped),
       'GQ4: every free plot reads capped once two are held, none before');
    refused(R.playerRelease(c, 'HOME'), clone(c), c, 'the main hangar released');
    const rel1 = R.playerRelease(c, 'w3');
    ok(rel1.ok && R.playerAcquire(rel1.doc, 'tw_ski', 'tw_ski', 'club', 'own').ok, 'GQ4: one released, another may be bought');
    // an older document holding more keeps every one: the extra marked legacy, nothing refused, nothing dropped
    const old3 = { what: 'flydiy-player', v: 2, wallet: 0, sheds: {
      HOME: { shell: 'club', kits: ['park'], base: 'HOME', tenure: 'own' },
      w3: { shell: 'field', kits: ['park'], base: 'w3', tenure: 'own', since: 10 },
      tw_ski: { shell: 'club', kits: ['park'], base: 'tw_ski', tenure: 'own', since: 20 },
      mn_strip: { shell: 'field', kits: ['park'], base: 'mn_strip', tenure: 'own', since: 30 } } };
    const n3 = v2(old3);
    ok(Object.keys(n3.sheds).length === 4 && n3.sheds.mn_strip.legacy === true && !n3.sheds.w3.legacy && !n3.sheds.tw_ski.legacy && !n3.sheds.HOME.legacy,
       'GQ4: an older document\'s third side hangar is kept, marked legacy (the newest), the two oldest and the main one not');
    ok(eq(n3, R.playerNormalise(clone(n3))), 'GQ4: the legacy mark is a fixpoint');
    const n3c = career(n3);
    ok(!R.playerAcquire(n3c, 'SEA', 'SEA', 'field', 'own').ok, 'GQ4: the cap counts the legacy hangar (a fourth refused)');
    ok(R.playerGoTo(n3, 'mn_strip').ok && R.playerArrive(R.playerFleetReconcile(n3, ['J'], opts).doc, 'J', 'mn_strip', opts).ok,
       'GQ4: a legacy hangar still works (the garage opens there, an aeroplane arrives)');
    ok(!v2(shelf.find(([f, r]) => r.v === 2)[1]).sheds.w3.legacy, 'GQ4: the v2 vintage (two side hangars) carries no legacy mark');

    // GQ7: the slots, on top of the geometry
    const big = clone(D); big.sheds.HOME = { shell: 'works', kits: ['park'], base: 'HOME', tenure: 'own' };
    ok(R.hangarRoomFor(big.sheds.HOME, cub, [], opts) > 3, 'GQ7: a bare works main hangar\'s floor takes more than three Cubs (' + R.hangarRoomFor(big.sheds.HOME, cub, [], opts) + ')');
    // G2690 (HANGAR-STORAGE): the slots are the SHELL's - a works holds its floor + 4 inside (the club: + 2)
    ok(eq(R.playerSlots(big, 'HOME'), { bay: 1, parked: 4, total: 5, inside: 4, outside: 6 }), 'GQ7 / G2690: a works main hangar has the build bay + 4 inside');
    ok(eq(R.playerSlots(D, 'HOME'), { bay: 1, parked: 2, total: 3, inside: 2, outside: 6 }), 'GQ7 / G2690: the club main hangar has the build bay + 2 parked');
    const six = Array.from({ length: 6 }, (_, i) => 'S' + i);
    const L6 = R.playerFleetReconcile(big, six, Object.assign({ foots: Object.fromEntries(six.map(n => [n, cub])) }, opts));
    ok(R.playerResidents(L6.doc, 'HOME').length === 5 && six.filter(n => R.playerWhere(L6.doc, n).kind === 'out').length === 1,
       'GQ7: the lift fills the main hangar\'s five slots and ties the rest down, however much floor is left');
    const side = R.playerAcquire(clone(D), 'tw_ski', 'tw_ski', 'club', 'own').doc;
    side.sheds.tw_ski.kits = ['park'];
    ok(R.playerSlots(side, 'tw_ski').total === 3 && R.hangarRoomFor(side.sheds.tw_ski, FOOT('jodel'), [], opts) >= 3, 'GQ7 / G2690: a side club has its floor + two inside');
    let sc = side;
    for (const n of ['J1', 'J2', 'J3', 'J4']) { sc.fleet[n] = { hangar: null, aero: 'HOME', foot: FOOT('jodel') }; }
    const k3 = [];
    for (const n of ['J1', 'J2', 'J3', 'J4']) { const a = R.playerArrive(sc, n, 'tw_ski', opts); k3.push(a.store); sc = a.doc; }
    // the altiport has no tie-down spot (its apron 0): the fourth is kept long-term in the shed
    ok(eq(k3, ['inside', 'inside', 'floor', 'long']), 'GQ7 / G2690: Jodels at a side club: two inside, the floor, then long-term (' + k3.join(' ') + ')');
    before = clone(sc);
    refused(R.playerStore(sc, 'J4', 'tw_ski', null, opts), before, sc, 'GQ7: wheeling into a side club with every slot taken');
    refused(R.playerUpgrade(sc, 'tw_ski', { shell: 'field', dims: { HW: 9, HD: 10, EAVE: 4 } }, opts), before, sc, 'GQ7: a side club with two inside rebuilt as a one-slot field shed');
    const fld = R.playerAcquire(clone(D), 'w3', 'w3', 'field', 'own').doc;
    ok(R.playerSlots(fld, 'w3').total === 1 && eq(R.playerSlots(fld, 'nope'), { bay: 0, parked: 0, total: 0, inside: 0, outside: 0 }), 'GQ7: a side field shed has one slot; nothing held has none');

    // GQ5: bring it home - free, the hangar it left, else the main one, else outside at HOME
    let b = career(R.playerAcquire(clone(D), 'w3', 'w3', 'field', 'own').doc);
    b.fleet = { Cub: { hangar: 'w3', aero: 'w3', foot: cub } };
    const out = R.playerArrive(b, 'Cub', 'mn_strip', opts);
    ok(out.kind === 'away' && out.doc.fleet.Cub.left === 'w3', 'an arrival remembers the hangar it left');
    const bh = R.playerBringHome(out.doc, 'Cub', opts);
    const bl = bh.doc.ledger.slice(-1)[0] || {};
    ok(bh.ok && bh.kind === 'in' && bh.hangar === 'w3' && bh.doc.wallet === out.doc.wallet && bl.k === 'recover' && bl.amt === 0,
       'GQ5: bring it home - back into the hangar it last left, free, the line written at 0');
    const full = clone(out.doc); full.fleet.Other = { hangar: 'w3', aero: 'w3', foot: cub };
    const bh2 = R.playerBringHome(full, 'Cub', opts);
    ok(bh2.ok && bh2.hangar === 'HOME', 'GQ5: the hangar it left is full - the main hangar (' + bh2.hangar + ')');
    const jam = clone(full); for (const n of ['H1', 'H2', 'H3']) jam.fleet[n] = { hangar: 'HOME', aero: 'HOME', foot: cub };
    const bh3 = R.playerBringHome(jam, 'Cub', opts);
    ok(bh3.ok && bh3.kind === 'out' && bh3.doc.fleet.Cub.aero === 'HOME' && !bh3.doc.fleet.Cub.hangar, 'GQ5: both full - stationed outside at HOME');
    const sb2 = clone(out.doc); sb2.mode = 'sandbox';
    const bhS = R.playerBringHome(sb2, 'Cub', opts);
    ok(bhS.doc.wallet === sb2.wallet && bhS.doc.ledger.slice(-1)[0].free === true, 'GQ5: the sandbox the same - free and recorded');
    const inside = R.playerBringHome(b, 'Cub', opts);
    ok(inside.ok && inside.doc === b, 'GQ5: an aeroplane inside a hangar is home already - nothing moves');
    before = clone(b);
    refused(R.playerBringHome(b, 'nobody', opts), before, b, 'bring home: not in the fleet');

    // GQ7: the outside wear - runs outside, freezes inside, resets on Repair / Paint, reaches the macros
    let w = R.playerAcquire(clone(D), 'w3', 'w3', 'field', 'own').doc;
    w = R.playerFleetReconcile(w, ['Cub'], Object.assign({ foots: { Cub: cub } }, opts)).doc;
    ok(R.playerWhere(w, 'Cub').kind === 'in' && R.playerWearNow(w, 'Cub') === 0, 'wear: a new aeroplane lifted inside wears nothing');
    w = R.playerArrive(w, 'Cub', 'mn_strip', opts).doc;             // away: outside from this clock
    ok(w.fleet.Cub.outSince === w.clock, 'wear: stationed outside, its clock starts (outSince)');
    w = R.playerClock(w, 5 * 3600).doc;
    ok(Math.abs(R.playerWearNow(w, 'Cub') - 0.5) < 1e-9, 'wear: five flown hours outside -> 0.5 (' + R.playerWearNow(w, 'Cub') + ')');
    w = R.playerArrive(w, 'Cub', 'w3', opts).doc;                   // back into Tamgas Hill's shed
    w = R.playerClock(w, 20 * 3600).doc;
    ok(R.playerWhere(w, 'Cub').kind === 'in' && Math.abs(R.playerWearNow(w, 'Cub') - 0.5) < 1e-9 && !('outSince' in w.fleet.Cub),
       'wear: a hangar stop freezes it (20 h inside, still ' + R.playerWearNow(w, 'Cub') + ')');
    w = R.playerWheelOut(w, 'Cub').doc;
    w = R.playerClock(w, 10 * 3600).doc;
    ok(R.playerWearNow(w, 'Cub') === 1, 'wear: outside again it runs on, to full at ~10 flown hours (capped at 1)');
    const rp = R.playerWearReset(w, 'Cub');
    ok(rp.ok && R.playerWearNow(rp.doc, 'Cub') === 0 && rp.doc.wallet === w.wallet && rp.doc.ledger.length === w.ledger.length,
       'wear: Repair / Paint resets it, at no cost');
    const m1 = R.playerWearMacro({ age: 0.1, flight: 0.3, bush: 0, rain: 0 }, 1);
    ok(m1.age > 0.1 + 0.5 && m1.rain >= 0.5 && m1.flight === 0.3 && 0.7 * m1.age >= 0.4,
       'wear: full wear reaches visible chalking in the G345 macros (age ' + m1.age.toFixed(2) + ' -> chalk ' + (0.7 * m1.age).toFixed(2) + ')');
    ok(eq(R.playerWearMacro({ age: 0.2, flight: 0.1, bush: 0.3, rain: 0.1 }, 0), { age: 0.2, flight: 0.1, bush: 0.3, rain: 0.1 }), 'wear: none adds nothing');
    const spec0 = { finish: { weather: { age: 0.1 } }, wings: { span: 9 } }, spec0c = clone(spec0);
    const ws = R.playerWearSpec(spec0, 0.52);
    ok(eq(spec0, spec0c) && ws !== spec0 && ws.finish.weather.age === +(0.1 + 0.6 * 0.5).toFixed(4) && eq(ws.wings, spec0.wings),
       'wear: the worn spec is a copy, quantised (0.52 -> 0.50), its shape untouched: visual only');
    ok(R.playerWearSpec(spec0, 0) === spec0 && R.playerWearSpec({ finish: { wear: 0.4 } }, 1).finish.weather.flight === 0.4,
       'wear: none hands the spec itself back; an old `finish.wear` is read as age + flight');

    // the footprint measured off the nodes (S2: at save and at roll-out)
    const fd = R.playerFootOfDef(CORE.buildGen(CORE.GEN_DEFAULT));
    ok(fd && fd.half > 3 && fd.half < 8 && fd.fwd > 0.3 && fd.aft > 3 && fd.h > 1 && fd.h < 4,
       'the footprint of the default build, off its nodes: ' + J(fd));
    ok(R.playerFootOfDef(null) === null && R.playerFootOfDef({ nodes: [] }) === null, 'no nodes, no footprint');
    // the place in words, and where the next roll-out starts
    const pl = clone(sc); pl.fleet.A = { hangar: null, aero: 'mn_strip' }; pl.fleet.H = { hangar: 'HOME', aero: 'HOME' };
    pl.fleet.J3 = { hangar: null, aero: 'HOME', kind: 'outside', slot: 0 };
    const Wd = { aerodromes: [{ id: 'mn_strip', name: 'Jumbo Mine' }] };
    ok(R.playerPlace(pl, 'J1', Wd).text === 'in tw_ski' && R.playerPlace(pl, 'J3', Wd).text === 'out at HOME'
       && R.playerPlace(pl, 'A', Wd).text === 'away at Jumbo Mine' && R.playerPlace(pl, 'H', Wd).here && !R.playerPlace(pl, 'J1', Wd).here,
       'the place badge: in / out at / away at, and whether it stands at the garage\'s base');
    ok(R.playerRollFrom(pl, 'A') === 'mn_strip' && R.playerRollFrom(pl, 'J1') === 'tw_ski' && R.playerRollFrom(pl, null) === 'HOME' && R.playerRollFrom(pl, 'ghost') === 'HOME',
       'the roll-out starts where the aeroplane stands (an unsaved build: the garage\'s base)');
    // gp1: the bases derived from the hangars held
    const B0 = R.flightBasesOf(D);
    ok(eq(Object.keys(B0), ['HOME']) && B0.HOME.name === R.FLIGHT_BASES.HOME.name && B0.HOME.hangar === R.FLIGHT_BASES.HOME.hangar && eq(B0.HOME.hangars, ['HOME']),
       'gp1: the sandbox\'s bases are HOME alone, in today\'s words');
    const B2 = R.flightBasesOf(c);
    ok(eq(Object.keys(B2), ['HOME', 'w3']) && eq(B2.HOME.hangars, ['HOME', 'HOME.2']) && /Tamgas/.test(B2.w3.name),
       'gp1: holding Tamgas Hill makes it a base; HOME\'s two hangars are one base (' + J(Object.keys(B2)) + ')');
    const JW = { aerodromes: (JOLENE.layers.runways || []).map(r => ({ id: r.id, kind: r.kind || 'strip' })) };
    ok(R.flightBases(JW, c).map(x => x.id).join() === 'HOME,w3' && R.flightBases(JW).length === 1 && R.flightBase(JW, 'w3', c).aero === 'w3',
       'gp1: the world\'s bases with the document, the registry without it');
  }

  // ==== THE PAGE (S2): the doors, source-scanned ======================================
  {
    const strip = t => t.replace(/\/\/[^\n]*/g, '');
    const A = strip(R.__app), G = strip(R.__garage);
    const fnBody = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; const j = src.indexOf('\n  }\n', i); return src.slice(i, j < 0 ? i + 4000 : j); };
    ok(/playerFleetReconcile\(/.test(fnBody(A, 'playerLoad')), 'page: the lift runs at load (playerLoad -> playerFleetReconcile)');
    ok(/playerFleetReconcile\(/.test(fnBody(A, 'playerSlotsChanged')), 'page: the lift runs when the slots change (playerSlotsChanged)');
    ok(/slotsChanged\s*:/.test(A), 'page: the garage is handed the slots door');
    const saveB = G.slice(G.indexOf('const saveAs = name =>'), G.indexOf('function exportFile'));
    ok(/slotsChanged\(/.test(saveB), 'page: save / save as tell the player document');
    const delB = G.slice(G.indexOf("del.addEventListener('click'"), G.indexOf("del.addEventListener('click'") + 600);
    ok(/slotsChanged\(/.test(delB), 'page: delete tells the player document');
    const impB = G.slice(G.indexOf('const readFile = f =>'), G.indexOf('const readFile = f =>') + 900);
    ok(/slotsChanged\(/.test(impB), 'page: import tells the player document');
    ok(/playerFootOfDef\(/.test(fnBody(A, 'playerSlotsChanged')) && /playerFootOfDef\(/.test(fnBody(A, 'playerFlightStart')),
       'page: the footprint is measured at save and at roll-out');
    ok(/playerRollFrom\(/.test(A) && /rollFromId\(\)/.test(fnBody(A, 'applyRoute')), 'page: the roll-out starts where the aeroplane stands');
    const stop = A.slice(A.indexOf("if (ap.phase === 'STOPPED' && (ap.tdInfo || ap.report)) logFlight();"), A.indexOf("if (ap.phase === 'STOPPED' && (ap.tdInfo || ap.report)) logFlight();") + 400);
    ok(/playerFlightEnd\(/.test(stop), 'page: a STOP hands the flight to the player document, after the logbook row');
    const fe = fnBody(A, 'playerFlightEnd');
    ok(/playerArrive\(/.test(fe) && /flightWhere\(/.test(fe) && /flightCanDepart\(/.test(fe), 'page: playerArrive on a stop on an aerodrome (flightWhere)');
    ok(/playerClock\(/.test(fe), 'page: playerClock at each flight\'s end');
    ok(/playerFlightEnd\(/.test(fnBody(A, 'endFlight')), 'page: a crash or a give-up ends the flight too (the clock; nothing moves)');
    ok(/playerBringHome\(/.test(A), 'page: "bring it home" is wired');
    ok(/flightBases\(world,\s*playerLoad\(\)\)/.test(A), 'page: the base line reads the bases derived from the hangars held');
    ok(/playerGoTo\(/.test(A), 'page: the base select moves the garage (playerGoTo)');
    const rf = fnBody(G, 'renderFleet');
    ok(/api\.place\(/.test(rf) && /gfAway/.test(rf) && /fly from there\?/.test(rf), 'page: the fleet popup carries the place badge and greys an aeroplane elsewhere ("fly from there?")');
  }

  // ==== THE WORLD (S3, G2310): the plots, the sheds the world stands, the roll-out at any base ==================
  {
    const UNPLACED = { tw_ski: 'the summit has no free flat ground for a field shed (PREM-S3 HANDOVER: measured, none within 260 m)' };
    const recPlots = {};
    for (const r of JOLENE.layers.runways) for (const p of CORE.PREMISES_GEN.runwayPlots(Object.assign({ hangar: null }, r))) recPlots[p.id] = Object.assign({ aero: r.id }, p);
    for (const aero of Object.keys(R.BASE_OFFERS)) for (const id of Object.keys(R.BASE_OFFERS[aero].plots)) {
      if (UNPLACED[id]) { ok(!recPlots[id], 'S3 ' + id + ' is declared unplaced and the record has no plot for it (' + UNPLACED[id] + ')'); continue; }
      ok(!!recPlots[id] && recPlots[id].aero === aero, 'S3 the offered plot ' + id + ' has its place in the record, on ' + aero, recPlots[id] ? recPlots[id].aero : 'none');
    }
    for (const id of Object.keys(recPlots)) ok(Object.keys(R.BASE_OFFERS).some(a => R.BASE_OFFERS[a].plots[id]), 'S3 the record\'s plot ' + id + ' is one the offers name');
    const hr = JOLENE.layers.runways.find(r => r.id === 'HOME');
    ok(recPlots.HOME && recPlots.HOME.main && recPlots.HOME.x === hr.hangar.x && recPlots.HOME.z === hr.hangar.z && recPlots.HOME.hdg === (hr.hangar.hdg || 0),
       'S3 plot HOME is the club hangar, verbatim (G434\'s record)');
    // the world's sheds: GQ8, GQ4
    const sb = R.playerNormalise(R.playerMigrate(R.playerDefault()));
    const ws0 = R.playerWorldSheds(sb);
    ok(ws0.length === 1 && ws0[0].id === 'HOME' && ws0[0].main, 'S3 GQ8: the sandbox stands HOME alone (no plot it does not hold)', J(ws0.map(x => x.id)));
    let h3 = R.playerAcquire(sb, 'w3', 'w3', 'field', 'own').doc;
    h3 = R.playerAcquire(h3, 'HOME', 'HOME.2', 'club', 'own').doc;
    h3.sheds.w3.parts = { doorMain: { set: 'rawplank', tile: 2 } };
    const ws3 = R.playerWorldSheds(h3);
    ok(eq(ws3.map(x => x.id), ['HOME', 'w3', 'HOME.2']) || eq(ws3.map(x => x.id), ['HOME', 'HOME.2', 'w3']), 'S3 the held hangars stand, main first', J(ws3.map(x => x.id)));
    const w3s = ws3.find(x => x.id === 'w3');
    ok(w3s && w3s.shell === 'field' && eq(w3s.dims, R.hangarDims(h3.sheds.w3)) && w3s.parts && w3s.parts.doorMain.set === 'rawplank' && w3s.base === 'w3',
       'S3 a side hangar stands at ITS shell, dims and dress', J(w3s));
    ok(!ws3.some(x => x.id === 'SEA' || x.id === 'mk_sea' || x.id === 'mn_strip'), 'S3 GQ8: the plots not held stand nothing');
    const leg = clone(h3); leg.sheds.SEA = { shell: 'field', kits: ['park'], base: 'SEA', tenure: 'own', since: 99, legacy: true };
    const wsL = R.playerWorldSheds(R.playerNormalise(leg));
    ok(wsL.length === 3 && !wsL.some(x => x.id === 'SEA'), 'S3 GQ4: at most three player hangars ever stand (an older document\'s extra one works, and is not drawn)', J(wsL.map(x => x.id)));
    ok(R.premResidentsDrawn(true, 59.9) && !R.premResidentsDrawn(false, 5) && !R.premResidentsDrawn(true, 60.1) && R.PREM_WORLD.residentsR === 60,
       'S3 residents are drawn only behind an open door with the camera within 60 m');
    // where the roll-out leaves from
    let f3 = R.playerFleetReconcile(h3, ['Cub', 'Jodel']).doc;
    f3.fleet.Cub = Object.assign(f3.fleet.Cub, { hangar: 'w3', aero: 'w3' });
    f3.fleet.Jodel = Object.assign(f3.fleet.Jodel, { hangar: null, aero: 'w3' });
    ok(R.playerRollHangar(f3, 'Cub') === 'w3' && R.playerRollHangar(f3, 'Jodel') === null && R.playerRollHangar(f3, null) === 'HOME'
       && R.playerRollHangar(R.playerGoTo(f3, 'w3').doc, null) === 'w3', 'S3 the roll-out leaves the hangar it is in (none when tied down; an unsaved build the garage\'s)');
    const S = WORLD3.after.sites;
    const pH = R.playerPlotSite(S.HOME, 'HOME', h3.sheds.HOME);
    ok(pH.site === S.HOME && !pH.own, 'S3 a roll-out from HOME plans on HOME\'s own site, the very object');
    const pW = R.playerPlotSite(S.w3, 'w3', h3.sheds.w3), P3 = S.w3.plots.find(q => q.id === 'w3');
    ok(pW.own && pW.site.stand.x === P3.stand.x && pW.site.stand.z === P3.stand.z && eq(pW.site.taxiOut, P3.taxiOut) && pW.site.hangar.x === P3.x && pW.site.hangar.HD === R.hangarDims(h3.sheds.w3).HD && !pW.site.pattern,
       'S3 a roll-out from w3\'s side hangar plans from its door: the plot\'s stand and way out, its own dims (no walk)', J(pW.site.stand));
    const pM = R.playerPlotSite(S.mn_strip, 'mn_strip', { shell: 'field' });
    ok(!pM.own && pM.site.stand === S.mn_strip.stand && !!pM.site.pattern && pM.site.hangar.x === 7273, 'S3 a plot with no way of its own (the mine\'s shed) rolls out on the field\'s stand and authored pattern');
    // THE SANDBOX WORLD WITH ONLY HOME HELD IS TODAY'S
    const B = WORLD3.before, A2 = WORLD3.after;
    ok(B.aero === A2.aero, 'S3 identity: the aerodromes the world composes are the same with the plots in the record');
    ok(B.gh === A2.gh, 'S3 identity: the ground is the same to the millimetre (a plot is a place, not a modifier)', B.gh + ' / ' + A2.gh);
    const strip = o => { if (!o) return o; const c = clone(o); delete c.plots; return Object.keys(c).length ? c : null; };   // (a lane's site is its plots alone: none before)
    for (const id of Object.keys(B.sites)) ok(eq(strip(A2.sites[id]), B.sites[id]), 'S3 identity: the site of ' + id + ' is the same but for its plots', J(B.sites[id]).slice(0, 80));
    ok(eq(A2.sites.HOME.hangar, B.sites.HOME.hangar), 'S3 identity: HOME\'s hangar byte for byte');
    ok(!eq(A2.sites.HOME, B.sites.HOME) && !!A2.sites.HOME.plots && !B.sites.HOME.plots, 'S3 identity, calibrated: the two composes DO differ - by the plots, and only by them (the rows above can see a difference)');
    // the page's side sheds for the sandbox: nothing (app.js worldSideSheds, render_world.js setPlayerSheds - lifted, run)
    const lift = (src, a, b) => { const i = src.indexOf(a), j = i < 0 ? -1 : src.indexOf(b, i); return i < 0 || j < 0 ? null : src.slice(i, j); };
    const wssSrc = lift(R.__app, '  const worldSideSheds = () => {', '  // the world follows the room');
    const spsSrc = lift(R.__rw, '    const sideSheds = new Map();', '    playerSheds = setPlayerSheds;');
    ok(!!wssSrc && !!spsSrc, 'S3 the page\'s side-shed doors are where they were (app.js worldSideSheds, render_world.js setPlayerSheds)');
    if (wssSrc && spsSrc) {
      const built = [];
      const ctx = vm.createContext({ playerWorldSheds: R.playerWorldSheds, siteOf: id => S[id] || null, THREE: {}, console, JSON, Map, Array, isFinite, Object,
        genHangarBuild: () => null, genHangarSupported: () => true, dropShed: () => {}, shedNodeAt: (H, d, dr) => { built.push([H, d, dr]); return { name: '', userData: {} }; } });
      const run3 = doc => { built.length = 0; ctx.__doc = doc; vm.runInContext('(function () { var playerLoad = () => __doc; var playerSheds, playerShedsNow;\n' + wssSrc + '\n' + spsSrc + '\nthis.__n = setPlayerSheds(worldSideSheds()); this.__list = worldSideSheds(); }).call(this);', ctx); return { n: ctx.__n, list: ctx.__list, built: built.slice() }; };
      const r0 = run3(sb);
      ok(r0.list.length === 0 && r0.n === 0 && r0.built.length === 0, 'S3 identity: the sandbox (HOME only) lists no side shed and the world builds none', J(r0.list));
      const r3 = run3(h3);
      ok(r3.built.length === 2 && r3.built.every(b => b[0] && isFinite(b[0].x)) && r3.list.find(q => q.id === 'w3').x === P3.x && r3.list.find(q => q.id === 'w3').dims.shell === 'field'
         && r3.list.find(q => q.id === 'w3').dress.parts.doorMain.set === 'rawplank', 'S3 two side hangars held: two sheds built, each at its plot, at its shell, dressed', J(r3.list.map(q => q.id)));
    }
    ok(/function standShed\(dims\) \{[\s\S]{0,400}shedNode = shedNodeAt\(SITE\.hangar, dims\);/.test(R.__rw), 'S3 identity: HOME\'s shed is standShed\'s own build, undressed (no third argument)');
    ok(/if \(dress\) dressExterior\(shed\.mats/.test(R.__rw), 'S3 a shed is dressed only when it is handed a dress');
    // the page's doors (S3)
    {
      const strip2 = t => t.replace(/\/\/[^\n]*/g, '');
      const A3 = strip2(R.__app);
      const fnB = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; const j = src.indexOf('\n  }\n', i); return src.slice(i, j < 0 ? i + 4000 : j); };
      ok(/const shedHome = \(\) => playerLoad\(\)\.sheds\[roomId\(\)\];/.test(A3), 'S3 page: the room is the hangar the garage is open in (`here`)');
      ok(/hangarRoom !== roomId\(\)/.test(fnB(A3, 'getHangar')) && /site: roomSite/.test(fnB(A3, 'getHangar')), 'S3 page: a new `here` builds the room again, at its plot');
      ok(/rollFromId\(\) !== roomBase\(\) \|\| \(rh && rh !== roomId\(\)\)/.test(fnB(A3, 'rollAnim')), 'S3 page: the roll-out shot plays from the room\'s door at any base');
      ok(/playerPlotSite\(st0, rh, playerLoad\(\)\.sheds\[rh\]\)\.site/.test(fnB(A3, 'applyRoute')) && /shedDimsAt\(from\.id, st, rh\)/.test(fnB(A3, 'applyRoute')), 'S3 page: the roll-out starts at its hangar\'s plot (stand, way out, dims)');
      ok(/r\.kind === 'in' && r\.hangar && r\.hangar !== d\.here[\s\S]{0,80}playerGoTo\(d, r\.hangar\)/.test(fnB(A3, 'playerFlightEnd')), 'S3 page: the roll-in returns into the hangar playerArrive chose (the garage opens there)');
      ok(/WF\.setPlayerSheds\(worldSideSheds\(\)\)/.test(fnB(A3, 'worldBuilt')), 'S3 page: the side hangars stand when the world is built');
    }
  }

  // ==== PURITY =====================================================================
  const code = R.__src71.replace(/\/\/[^\n]*/g, '');
  ok(!/\b(window|document|localStorage|THREE|prefSet|prefGet)\b/.test(code), 'the rules touch no DOM, storage or THREE');
  return { checks, fails };
}

// ---------------------------------------------------------------------------
const base = run(null);
if (!SELF) {
  if (SHOW || base.fails.length) {
    console.log('ROOM (how many of each fit, empty):');
    for (const [a, row] of ROOM) console.log('  ' + a.padEnd(9) + Object.entries(row).map(([k, v]) => k + ' ' + v).join(' · '));
  }
  for (const f of base.fails) console.log('  - ' + f);
  console.log(base.checks + ' checks');
  console.log('GATE GAMEPREM: ' + (base.fails.length ? 'FAIL (' + base.fails.length + ' of ' + base.checks + ')' : 'PASS'));
  process.exit(base.fails.length ? 1 : 0);
}

// ---- negative verification: each rule broken in its own source --------------
const sub = (a, b) => s => { if (s.indexOf(a) < 0) throw new Error('selftest anchor gone: ' + a); return s.split(a).join(b); };
const BREAKS = [
  ['the walk drops the shed\'s dress', { src70: sub('if (s && typeof s === \'object\' && typeof s.base !== \'string\') s.base = id;',
                                                    'if (s && typeof s === \'object\' && typeof s.base !== \'string\') { s.base = id; delete s.parts; }') }],
  ['the normaliser forgets the fleet', { src70: sub('r.fleet = {};', 'r.fleet = r.fleet;') }],
  ['the migrated save starts costing', { src70: sub("if (r.mode !== 'sandbox' && r.mode !== 'career') r.mode = 'sandbox';",
                                                    "if (r.mode !== 'sandbox' && r.mode !== 'career') r.mode = 'career';") }],
  ['the door is ignored', { src71: sub('const why = hangarDoorWhy(shed, p.f);', "const why = '';") }],
  ['parked aeroplanes overlap', { src71: sub('const near = obs.concat(rects);', 'const near = obs;') }],
  ['the fit-out is ignored', { src71: sub('const obs = hangarObstacles(shed, opts && opts.reg).concat(', 'const obs = [].concat(') }],
  ['the door formula drifts from hangar.js', { src71: sub('w: Math.max(6, 2 * D.HW - 5)', 'w: Math.max(6, 2 * D.HW - 4)') }],
  ['the lift refuses the overflow', { src71: sub('    const got = at ? pbIn(d, n, at) : pbOut(d, n, home);', '    if (!at) { delete d.fleet[n]; continue; }\n    const got = pbIn(d, n, at);') }],
  ['storing ignores the room', { src71: sub("  const F = playerFits(doc, hangarId, playerResidents(doc, hangarId).concat([name]), foots, opts);\n  if (!F.ok) return pbNo(doc, F.why);", "  const F = { ok: true };") }],
  ['arriving ignores the room', { src71: sub('if (playerFits(d, id, playerResidents(d, id).filter(n => n !== name).concat([name]), opts.foots, opts).ok) {', 'if (true) {') }],
  ['coming home forgets its own hangar', { src71: sub("if (W.aero === aero && W.kind === 'in') return", "if (false) return") }],
  ['a full hangar can be released', { src71: sub("if (inside.length) return pbNo(doc, hangarId + ' is not empty: '", "if (false) return pbNo(doc, hangarId + ' is not empty: '") }],
  ['an upgrade evicts', { src71: sub('if (R.unplaced.length) return pbNo(', 'if (false) return pbNo(') }],
  ['the sandbox pays', { src71: sub('if (!free) doc.wallet -= amt;', 'doc.wallet -= amt;') }],
  ['a refusal leaves a mark', { src71: sub('const pbNo = (doc, why) => ({ ok: false, doc, why });',
                                         'const pbNo = (doc, why) => (doc.ledger && doc.ledger.push({ k: "refused" }), { ok: false, doc, why });') }],
  ['the rules reach for storage', { src71: s => s + '\nfunction pbLeak() { return localStorage; }\n' }],
  // ---- G2230 PREM-S2: the user's calls, each broken in its own source ----
  ['GQ4: a third side hangar is bought', { src71: sub('if (plotId !== PREM_MAIN && sides.length >= PREM_SIDE_MAX)', 'if (false)') }],
  ['GQ4: an older document\'s extra hangar is dropped, not kept', { src70: sub('for (const id of sides.slice(max)) r.sheds[id].legacy = true;', 'for (const id of sides.slice(max)) delete r.sheds[id];') }],
  ['GQ4: the main hangar can be released', { src71: sub("if (hangarId === PREM_MAIN) return pbNo(", "if (false) return pbNo(") }],
  ['G-COST: a hangar is rented', { src71: sub("if (tenure === 'rent') return pbNo(", "if (false) return pbNo(") }],
  ['G-COST: rent accrues per flown hour', { src71: sub("  return { ok: true, doc: d, dues: 0, why: '' };",
      "  for (const id of Object.keys(d.sheds)) if (d.sheds[id] && d.sheds[id].tenure === 'rent') playerCharge(d, 50 * s / 3600, 'rent', null);\n  return { ok: true, doc: d, dues: 0, why: '' };") }],
  ['GQ5: recovery charges the road again', { src71: sub('recoverBase: 0,', 'recoverBase: 200,') }],
  ['GQ5: a free recovery leaves no ledger line', { src71: sub('if (amt) return playerCharge(doc, amt, k, ref);', 'if (true) return playerCharge(doc, amt, k, ref);') }],
  ['GQ5: bring it home forgets the hangar it left', { src71: sub('for (const id of [e.left, PREM_MAIN])', 'for (const id of [PREM_MAIN])') }],
  ['GQ5: bring it home ignores the room', { src71: sub("    if (playerFits(d, id, playerResidents(d, id).concat([name]), opts.foots, opts).ok) { at = id; break; }",
                                                       "    { at = id; break; }") }],
  ['GQ7: the slots are ignored (geometry only)', { src71: sub('if (names.length > sl.total)', 'if (false)') }],
  ['GQ7 / G2690: a club holds one inside', { src71: sub("club: { inside: 2, outside: 6 }", 'club: { inside: 1, outside: 6 }') }],
  ['GQ7: the wear never freezes inside', { src71: s => sub('  delete e.outSince;\n  if (!kind) {', '  if (!kind) {')(sub("if (!e.hangar && typeof e.outSince === 'number' && isFinite(e.outSince))", "if (typeof e.outSince === 'number' && isFinite(e.outSince))")(s)) }],
  ['GQ7: the wear never reaches the macros', { src71: sub('age: c(c(m.age) + PREM_WEAR.age * k)', 'age: c(m.age)') }],
  ['GQ7: Repair / Paint leaves the wear', { src71: sub('  delete r.wearOut;\n', '') }],
  ['gp1: the bases are not derived from the hangars held', { src38b: sub('const R = doc ? flightBasesOf(doc) : FLIGHT_BASES;', 'const R = FLIGHT_BASES;') }],
  ['the roll-out always from the base', { src71: sub("if (W.kind !== 'none' && W.aero) return W.aero;", '') }],
  // ---- the page's doors (source scans) ----
  ['the page forgets the lift at load', { app: sub("try { if (typeof playerFleetReconcile === 'function') player = playerFleetReconcile(player, playerSlotNames()).doc; }", 'try { }') }],
  ['a save does not tell the fleet ledger', { garage: sub('slotsChanged({ saved: name, repainted });', '') }],
  ['a delete does not tell the fleet ledger', { garage: sub('slotsChanged({ deleted: n });', '') }],
  ['a stop on an aerodrome moves nothing', { app: sub('const r = playerArrive(d, flSlot, W.aero.id, {});', 'const r = { ok: false };') }],
  ['the flight\'s end leaves the clock', { app: sub('let d = playerClock(playerLoad(), Math.max(0, ap.t || 0)).doc;', 'let d = playerLoad();') }],
  ['the page rolls out from the base, always', { app: sub('const [fid, did] = routeFitted(gearNow, rollFromId(), destId);', 'const [fid, did] = routeFitted(gearNow, spawnId || baseAeroId(), destId);') }],
  ['the fleet popup carries no place', { garage: sub('try { P = api.place ? api.place(n) : null; } catch (e) { P = null; }', 'P = null;') }],
  // G2310 (PREM-S3)
  ['S3 GQ8: a plot not held stands a shed', { src71: sub('  if (S[PREM_MAIN]) one(PREM_MAIN, true);', '  if (S[PREM_MAIN]) one(PREM_MAIN, true);\n  for (const a in BASE_OFFERS) for (const id in BASE_OFFERS[a].plots) if (!S[id]) out.push({ id, base: a, shell: \'field\', dims: {}, main: false });') }],
  ['S3 GQ4: an older document\'s fourth hangar stands', { src71: s => sub('return out.slice(0, PREM_WORLD.maxSheds);', 'return out;')(sub('playerSideIds(doc).slice(0, PREM_SIDE_MAX)', 'playerSideIds(doc)')(s)) }],
  ['S3 a side hangar stands undressed', { src71: sub('parts: s.parts ? pbClone(s.parts) : null,', 'parts: null,') }],
  ['S3 residents drawn behind a shut door', { src71: sub('return !!doorOpen && +camDist <= PREM_WORLD.residentsR;', 'return +camDist <= PREM_WORLD.residentsR;') }],
  ['S3 the roll-out from a side hangar leaves on the field\'s stand', { src71: sub('  out.stand = Object.assign({}, P.stand);\n', '') }],
  ['S3 a tied-down aeroplane rolls out of a door', { src71: sub("  if (W.kind !== 'none') return null;\n", '') }],
  ['S3 page: the room is always HOME\'s', { app: sub('const shedHome = () => playerLoad().sheds[roomId()];', 'const shedHome = () => playerLoad().sheds.HOME;') }],
  ['S3 page: the shot plays only from HOME\'s door', { app: sub('if (rollFromId() !== roomBase() || (rh && rh !== roomId()))', "if (rollFromId() !== 'HOME')") }],
  ['S3 page: the roll-out ignores its hangar\'s plot', { app: sub('playerPlotSite(st0, rh, playerLoad().sheds[rh]).site : st0;', 'st0 : st0;') }],
  ['S3 page: the roll-in leaves the garage where it was', { app: sub("if (r.ok && r.kind === 'in' && r.hangar && r.hangar !== d.here && typeof playerGoTo === 'function')", 'if (false)') }],
  ['S3 page: the sandbox world builds a side shed for HOME', { rw: sub("if (q && q.id && q.id !== 'HOME' && isFinite(+q.x)", 'if (q && q.id && isFinite(+q.x)'), app: sub('        if (h.main) continue;\n', '') }],
  ['S3 page: the side hangars never stand', { app: sub('    try { if (WF && WF.setPlayerSheds) WF.setPlayerSheds(worldSideSheds()); } catch (e) { console.warn', '    try { } catch (e) { console.warn') }],
];
let bad = 0;
for (const [name, mut] of BREAKS) {
  let r;
  try { r = run(mut); } catch (e) { r = { fails: [e.message], checks: 0 }; }
  // (G2690: a break whose anchor is gone from the source broke nothing - a miss, never a catch)
  const caught = r.fails.length > base.fails.length && !r.fails.some(f => /selftest anchor gone/.test(f));
  console.log((caught ? '  caught  ' : '  MISSED  ') + name + (caught ? '  (' + (r.fails.length - base.fails.length) + ' new)' : ''));
  if (!caught) bad++;
}
console.log('GATE GAMEPREM selftest: ' + (bad ? 'FAIL (' + bad + ' not caught)' : 'PASS'));
process.exit(bad ? 1 : 0);
