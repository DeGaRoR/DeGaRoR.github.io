#!/usr/bin/env node
// _cabinlamp_check.js — GATE CABINLAMP (CABIN-CRAFT, 2026-11-02).
//
// The user: "the placement of interior lights remains funny, it probably needs stronger rules; find flat faces, try
// and stick on the ceiling, but not where there are windows. Never stick on bubble canopies or any sort of glass.
// Stick to the aft bulkhead if no other option, or into the shoulder."
//
// Measured before the rule (the base tree, this set): 11 of 21 cabin lamps on glass or within reach of it - the
// Jodel's and Rufus's touching the pilot window, the float Cessna's and the skylight build's the sky windows, the
// bubble's arch lamp the windscreen, the user's twin's flood 7 cm from its pilot window.
//
// Each build of the set goes through the page's load door (tools/_load_build.js) with the sheet published to the
// layers as the page does (FLYDIY_HEADLESS_MS=1: the light layer hangs its lamps off CAGE_UI.MS), and
// tools/_cabinlamp_probe.js reports every flood and passenger lamp: its rung, the faces its flange touches, any glass
// up its axis within 0.35 m, any glass vertex within its radius + 4 cm. Asserted:
//   1. NO LAMP ON GLASS - none touches, none has glass over it, none has glass within reach of its rim;
//   2. EACH LAMP ON ITS EXPECTED SURFACE - the rung (roof / bulkhead / shoulder ...) recorded below per build, and
//      the face it sits on is that rung's (a roof lamp on a roof material, a bulkhead lamp on the bulkhead);
//   3. THE SET STILL LIGHTS - every build has its flood (a seat with no rung gets no lamp, which is allowed, but
//      this set's every pilot has one).
// The set: the six validated builds, a bubble canopy (the v8 twin-boom, canopy 3), a skylight (the v10 172), the
// user's flagship twin (Twin_busher_floats_2, 2 Nov).
//   node tools/_cabinlamp_check.js
'use strict';
const path = require('path');
process.env.FLYDIY_JOIN_PROBE = path.join(__dirname, '_cabinlamp_probe.js');
process.env.FLYDIY_HEADLESS_MS = '1';
const LB = require('./_load_build.js');

const SET = {
  cub: { v: 'cub' }, jodel: { v: 'jodel' }, metal: { v: 'metal' }, floats: { v: 'floats' },
  twinFloats: { v: 'twinFloats' }, rufus: { f: 'tools/fixtures/test_copies/rufus_2026-10-18.json' },
  bubble: { f: 'tools/fixtures/test_copies/build_v8_twin-boom_2026-09-11.json' },
  skylight: { f: 'tools/fixtures/test_copies/build_v10_c172_wipline2350_2026-09-20.json' },
  twin2: { f: 'tools/fixtures/test_copies/Twin_busher_floats_2.json' },
  // CABIN-INTERIOR G1: the user's twin with the overhead console (and the headliner it hangs from): the front row's
  // lamps in the console's bezels, the rear row's on the roof
  twin2con: { f: 'tools/fixtures/test_copies/Twin_busher_floats_2.json',
              patch: j => { Object.assign(j.spec.cage, { ohConsoleOn: 1, hdlOn: 1, wallTrimOn: 1 }); return j; } },
};
// the expected rung of each lamp, flood first then the passengers in seat order
const EXPECT = {
  cub: ['roof', 'roof'], jodel: ['roof', 'roof'], metal: ['roof', 'roof', 'roof', 'roof'],
  floats: ['bulkhead', 'bulkhead', 'roof', 'roof'], twinFloats: ['roof'], rufus: ['roof'],
  bubble: ['bulkhead'], skylight: ['bulkhead', 'bulkhead', 'roof', 'roof'], twin2: ['roof', 'roof', 'roof', 'roof'],
  twin2con: ['console', 'console', 'roof', 'roof'],
};
const ROOF = new Set(['ceilingLoop', 'body', 'plywood', 'cloth', 'composite', 'toele', 'waistband', 'headliner', 'cabWall']);
const ON = { console: () => true, roof: m => ROOF.has(m), bulkhead: m => m === 'bulkhead' || m === 'firewall', shoulder: () => true,
             header: () => true, coaming: () => true, arch: () => true };

const fail = [];
for (const key of Object.keys(SET)) {
  const B = SET[key];
  let r;
  try { r = B.v ? LB.loadValidated(B.v) : LB.loadBuild(B.f, B.patch ? { patch: B.patch } : undefined); }
  catch (e) { fail.push(key + ': the load door failed - ' + String(e.message).slice(0, 200)); continue; }
  const p = r.probe;
  if (!p || !p.lamps) { fail.push(key + ': no probe (' + JSON.stringify(p).slice(0, 120) + ')'); continue; }
  const got = p.lamps.map(l => l.rung);
  const line = p.lamps.map(l => l.kind + ':' + l.rung + '@' + l.on).join(' ');
  console.log(key.padEnd(11) + line);
  for (const [i, l] of p.lamps.entries()) {
    const id = key + ' ' + l.kind + (l.kind === 'pax' ? '#' + i : '');
    if (l.glassTouch.length) fail.push(id + ': ON GLASS (' + l.glassTouch.join(', ') + ')');
    if (l.glassOver) fail.push(id + ': UNDER GLASS (' + l.over + ' ' + l.overT + ' m up its axis)');
    if (l.glassNear) fail.push(id + ': BESIDE GLASS (' + l.near + ' ' + l.nearD + ' m from it)');
    if (l.rung && ON[l.rung] && !ON[l.rung](l.on)) fail.push(id + ': a ' + l.rung + ' lamp sits on ' + l.on);
  }
  if (!p.lamps.some(l => l.kind === 'flood')) fail.push(key + ': no flood (the pilot has no rung)');
  const want = EXPECT[key];
  if (want && JSON.stringify(want) !== JSON.stringify(got))
    fail.push(key + ': rungs ' + JSON.stringify(got) + ', expected ' + JSON.stringify(want));
}
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE CABINLAMP: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
