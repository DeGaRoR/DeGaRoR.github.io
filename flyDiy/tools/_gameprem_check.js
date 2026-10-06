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
//
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
const HANGAR_JS = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'hangar.js'), 'utf8');
const JOLENE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8'));
const NAMES = ['PLAYER_V', 'PLAYER_MIGRATORS', 'playerMigrate', 'playerDefault', 'playerNormalise', 'playerLift',
  'playerShedDims', 'BASE_OFFERS', 'PREM_RATES', 'KIT_PRICES', 'PARK_CLR', 'hangarDims', 'hangarDoor', 'hangarDoorWhy',
  'hangarObstacles', 'parkFoot', 'hangarPark', 'hangarRoomFor', 'playerHangarsAt', 'playerBaseIds', 'playerResidents',
  'playerWhere', 'playerFleetReconcile', 'playerStore', 'playerWheelOut', 'playerArrive', 'playerRecover',
  'shellPrice', 'plotPrice', 'playerOffers', 'playerAcquire', 'playerRelease', 'playerUpgradeCost', 'playerUpgrade',
  'playerGoTo', 'playerClock', 'playerLabourFactor'];
// the two files, evaluated FRESH over the core's globals, so the selftest can
// doctor exactly the rules under test and nothing else
function loadRules(mut) {
  let a = SRC70, b = SRC71;
  if (mut && mut.src70) a = mut.src70(a);
  if (mut && mut.src71) b = mut.src71(b);
  const ctx = vm.createContext(Object.assign({ console }, CORE));
  vm.runInContext(a + '\n' + b + '\n;this.__R = { ' + NAMES.join(', ') + ' };', ctx, { filename: 'rules' });
  return Object.assign(ctx.__R, { __src71: b });
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
  ok(R.PLAYER_V === 2, 'PLAYER_V is 2');
  const D = R.playerDefault();
  ok(D.v === 2 && D.mode === 'sandbox' && D.here === 'HOME' && D.clock === 0 && eq(D.fleet, {}) && eq(D.ledger, []),
     'the default is a v2 sandbox at HOME with an empty fleet');
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
    } else ok(eq(doc, raw), f + ': a current save walks to itself, byte for byte');
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
  ok(L.v === 2 && L.sheds.HOME.base === 'HOME' && eq(L.sheds.HOME.dims, { HW: 18, HD: 14, EAVE: 8 }), 'the v0 pref lift lands on v2');
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
  ok(forty.filter(n => R.playerWhere(L40.doc, n).kind === 'out').length >= 30, 'the overflow is tied down outside at HOME');
  const again = R.playerFleetReconcile(Lr.doc, names3, opts);
  ok(eq(again.doc, Lr.doc) && !again.lifted.length && !again.dropped.length, 'the lift is idempotent');
  const del = R.playerFleetReconcile(Lr.doc, ['Alpha', 'Charlie'], opts);
  ok(eq(del.dropped, ['Bravo']) && !del.doc.fleet.Bravo && eq(del.doc.fleet.Alpha, Lr.doc.fleet.Alpha),
     'a deleted slot leaves the ledger, the others stay where they were');

  // ==== STORE / MOVE ===========================================================
  // a career game with a second base: Tamgas Hill's field shed (8.5 m: a 12 m door)
  let g = clone(Lr.doc);
  g.mode = 'career'; g.wallet = 100000;
  const acq = R.playerAcquire(g, 'w3', 'w3', 'field', 'own');
  ok(acq.ok && acq.doc.sheds.w3.base === 'w3' && eq(acq.doc.sheds.w3.dims, { HW: 8.5, HD: 9, EAVE: 3.6 }),
     'Tamgas Hill\'s shed is held at its offered size');
  ok(acq.ok && acq.doc.wallet === 100000 - R.plotPrice('w3', 'w3', 'field'), 'the career pays the plot\'s price (' + R.plotPrice('w3', 'w3', 'field') + ')');
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
  ok(w3room >= 1 && w3room < 6, 'Tamgas Hill\'s shed takes a few Cubs (' + w3room + ')');
  const cubs = Array.from({ length: w3room + 1 }, (_, i) => 'Cub ' + i);
  let fill = clone(g);
  for (const n of cubs) fill.fleet[n] = { hangar: null, aero: 'HOME', foot: FOOT('cub') };
  const kinds = [];
  for (const n of cubs) { const a2 = R.playerArrive(fill, n, 'w3', opts); kinds.push(a2.kind); fill = a2.doc; }
  const last = cubs[cubs.length - 1];
  ok(kinds.slice(0, -1).every(k => k === 'in') && kinds[kinds.length - 1] === 'out',
     'Cubs flown to Tamgas Hill go in while there is room, then tie down outside (' + kinds.join(' ') + ')');
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
  ok(rec.doc.wallet === g.wallet - (R.PREM_RATES.recoverBase + 12 * R.PREM_RATES.recoverKm), 'the career pays the road home');
  const sand = clone(g); sand.mode = 'sandbox';
  const recS = R.playerRecover(sand, cub, { km: 12 });
  ok(recS.doc.wallet === sand.wallet && recS.doc.ledger.slice(-1)[0].free === true, 'the sandbox records the fee, pays nothing');
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
  const rentR = R.playerAcquire(poor, 'tw_ski', 'tw_ski', 'club', 'rent');
  ok(rentR.ok && rentR.doc.wallet === 10 && rentR.doc.sheds.tw_ski.tenure === 'rent', 'renting needs no capital');
  const hr = R.playerClock(rentR.doc, 3600);
  const due = Math.round(rentR.doc.sheds.tw_ski.price * R.PREM_RATES.rentPerHour);
  ok(hr.dues === due && hr.doc.wallet === 10 - due && hr.doc.clock === rentR.doc.clock + 3600,
     'an hour flown costs a rented club its hour of rent (' + due + ')');
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
  ['the fit-out is ignored', { src71: sub('const obs = hangarObstacles(shed, opts && opts.reg);', 'const obs = [];') }],
  ['the door formula drifts from hangar.js', { src71: sub('w: Math.max(6, 2 * D.HW - 5)', 'w: Math.max(6, 2 * D.HW - 4)') }],
  ['the lift refuses the overflow', { src71: sub('    d.fleet[n].hangar = at;\n', '    if (!at) { delete d.fleet[n]; continue; }\n    d.fleet[n].hangar = at;\n') }],
  ['storing ignores the room', { src71: sub("  if (P.unplaced.length) return pbNo(doc, 'no room in '", "  if (false) return pbNo(doc, 'no room in '") }],
  ['arriving ignores the room', { src71: sub('if (!P.unplaced.length) { d.fleet[name].hangar = id;', 'if (true) { d.fleet[name].hangar = id;') }],
  ['coming home forgets its own hangar', { src71: sub("if (W.aero === aero && W.kind === 'in') return", "if (false) return") }],
  ['a full hangar can be released', { src71: sub("if (inside.length) return pbNo(doc, hangarId + ' is not empty: '", "if (false) return pbNo(doc, hangarId + ' is not empty: '") }],
  ['an upgrade evicts', { src71: sub('if (R.unplaced.length) return pbNo(', 'if (false) return pbNo(') }],
  ['the sandbox pays', { src71: sub('if (!free) doc.wallet -= amt;', 'doc.wallet -= amt;') }],
  ['a refusal leaves a mark', { src71: sub('const pbNo = (doc, why) => ({ ok: false, doc, why });',
                                         'const pbNo = (doc, why) => (doc.ledger && doc.ledger.push({ k: "refused" }), { ok: false, doc, why });') }],
  ['the rules reach for storage', { src71: s => s + '\nfunction pbLeak() { return localStorage; }\n' }],
];
let bad = 0;
for (const [name, mut] of BREAKS) {
  let r;
  try { r = run(mut); } catch (e) { r = { fails: [e.message], checks: 0 }; }
  const caught = r.fails.length > base.fails.length;
  console.log((caught ? '  caught  ' : '  MISSED  ') + name + (caught ? '  (' + (r.fails.length - base.fails.length) + ' new)' : ''));
  if (!caught) bad++;
}
console.log('GATE GAMEPREM selftest: ' + (bad ? 'FAIL (' + bad + ' not caught)' : 'PASS'));
process.exit(bad ? 1 : 0);
