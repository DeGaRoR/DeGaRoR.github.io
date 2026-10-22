#!/usr/bin/env node
// GATE STOREDRAW (G2703, HANGAR-STORAGE-2) - THE BAKE BOUND ADMITS THE GARAGE'S DRAWN RESIDENTS.
//
// parked.js bakes a fleet prop only when FLEET_STAND.wants(key) (FLEET-PROPS B's bound: the drawn set). It read the
// apron alone, so an airframe saved on the floor and moved INSIDE (it never stood outside) was refused its bake and its
// garage resident never filled. app.js now hands the context `inside` (the career's residents: the building's inside
// slots in order, then the floor's aeroplane - 71_player_bases.js playerResidentsShown, the stand not left out); this
// gate runs fleet_stand.js (the page's file) in a window shim on a career document and holds:
//   - an inside aeroplane and the floor's are wanted; an apron one as before; a LONG-TERM one never (nor away);
//   - without `inside` (the old context) the inside one is refused - the defect this closes;
//   - app.js hands `inside` in fleetCtx (fleetInside: playerResidentsShown, N + 1).
//   node tools/_store_draw_check.js [--selftest]      -> "GATE STOREDRAW: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(__dirname, 'flight_core.js'));
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const SELF = process.argv.includes('--selftest');

function run(mut) {
  const fails = [];
  const ok = (c, what, x) => { if (!c) fails.push(what); if (!SELF) console.log('  ' + (c ? 'ok  ' : 'FAIL') + ' ' + what + (x != null ? '  [' + x + ']' : '')); };
  const w = {};
  vm.runInNewContext(rd('src/viewer/fleet_spots_pack.js'), { window: w });
  let src = rd('src/viewer/fleet_stand.js');
  if (mut && mut.stand) src = mut.stand(src);
  vm.runInNewContext(src, { window: w, performance: { now: () => 0 }, setTimeout, Promise });
  const FS = w.FLEET_STAND;
  w.FLYDIY_FLEET = true;
  const d = C.careerNew({ id: 'dev', seed: 'dev', name: 'gate', started: '2026-10-11' });
  const rows = { 'a-floor': { hangar: 'HOME', aero: 'HOME', kind: 'floor' }, 'b-in0': { hangar: 'HOME', aero: 'HOME', kind: 'inside', slot: 0 },
    'c-in1': { hangar: 'HOME', aero: 'HOME', kind: 'inside', slot: 1 }, 'd-long': { hangar: 'HOME', aero: 'HOME', kind: 'long' },
    'e-out0': { hangar: null, aero: 'HOME', kind: 'outside', slot: 0, outSince: 0, wearOut: 0 }, 'f-away': { hangar: null, aero: 'w3', kind: 'away' } };
  for (const n of Object.keys(rows)) d.fleet[n] = rows[n];
  const doc = C.careerNormalise(d);
  const N = C.playerSlots(doc, 'HOME').parked;
  const inside = mut && mut.inside ? mut.inside(doc, N) : C.playerResidentsShown(doc, 'HOME', null, N + 1);
  const world = { island: { id: 'jolene' } };
  FS.setCtx(() => ({ world, doc, flown: 'a-floor', from: 'HOME', cap: 6, inside }));
  const want = n => FS.wants('mine:' + n);
  // G2319.1 (WORKS-COZY, train 52): a CAREER's club main hangar holds PREM_SLOTS.mainClub (1) inside, the sandbox's 2 -
  // the residents shown follow the building's count: slot 0 wanted, slot 1 only where the building has it
  const insideN = C.playerStoreSlots(doc, 'HOME').inside;
  ok(insideN >= 1 && want('b-in0') && (insideN >= 2 ? want('c-in1') : !want('c-in1')),
     'an inside aeroplane is wanted (its resident is baked), as many as the building holds (' + insideN + ')', JSON.stringify(inside));
  ok(want('a-floor'), 'the floor\'s aeroplane is wanted (a prop once another is loaded)');
  ok(want('e-out0'), 'an apron aeroplane is wanted, as before');
  ok(!want('d-long') && !want('f-away'), 'a long-term aeroplane is never wanted (nor one away at another field)');
  FS.setCtx(() => ({ world, doc, flown: 'a-floor', from: 'HOME', cap: 6 }));
  ok(!want('b-in0'), 'without the residents in the context, the inside one is refused (the defect: its resident never filled)');
  const app = mut && mut.app ? mut.app(rd('src/viewer/app.js')) : rd('src/viewer/app.js');
  ok(/inside: fleetInside\(d\)/.test(app) && /playerResidentsShown\(d, id, null,/.test(app), 'app.js hands the residents to FLEET_STAND (fleetCtx inside: fleetInside)');
  return fails;
}

if (!SELF) {
  const f = run(null);
  console.log('GATE STOREDRAW: ' + (f.length ? 'FAIL (' + f.length + ')' : 'PASS'));
  process.exit(f.length ? 1 : 0);
} else {
  const sub = (a, b) => s => { if (!s.includes(a)) throw new Error('selftest: no ' + a); return s.split(a).join(b); };
  const breaks = [
    ['fleet_stand ignores the residents', { stand: sub('c.inside.includes(k.slice(5))) return true;', 'false) return true;') }],
    ['the residents carry a long-term one', { inside: (doc, N) => ['b-in0', 'c-in1', 'a-floor', 'd-long'] }],
    ['app.js does not hand them', { app: sub('inside: fleetInside(d)', 'inside: []') }],
  ];
  let bad = 0;
  for (const [what, m] of breaks) { const f = run(m); console.log('  ' + (f.length ? 'caught ' : 'MISSED ') + what + (f.length ? ' (' + f[0] + ')' : '')); if (!f.length) bad++; }
  console.log('GATE STOREDRAW --selftest: ' + (bad ? 'FAIL' : 'PASS') + ' (' + breaks.length + ' breaks)');
  process.exit(bad ? 1 : 0);
}
