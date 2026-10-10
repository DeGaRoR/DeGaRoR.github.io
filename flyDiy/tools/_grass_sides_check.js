#!/usr/bin/env node
// GATE GRASSSIDES (GRASS-DENSE G2565) - the grass beside and on the runways: the premises' coverAt under its two laws
// (src/core/27_premises.js GRASS_SIDES), on Jolene (the shipped island and its premises fixture).
//
// The user (8 Oct): "I want grass on the runway sides if the material says it does. And short grass on the grass runway."
//
//   1. 'today' IS TODAY: the default law, and under it the full query answers as it always has - no `cut`, no `surf`; a strip's
//      surface and its whole band bare (HOME's 40 m), the grass strip's surface bare (G665).
//   2. THE PAVE HALF NEVER MOVES: coverAt(x, z, 1) - what the rocks, the debris and the trees ('today') read - is the same
//      answer under both laws at every probe (the law is the grass's alone).
//   3. 'sides': on a paved strip and within its drawn side (sideClear) bare; across the band and the mow band CUT (kill 0,
//      cut 1); past the blend wild (cut 0); a grass strip's running surface cut grass (surf 1, kill 0), bare again with
//      stripGrass 0; an ordinary road keeps today's kill on its band.
//   4. THE DIALS: grassSides() clamps and refuses what it does not know; the defaults are GRASS_SIDES_DEF.
//
//   node tools/_grass_sides_check.js   -> "GATE GRASSSIDES: PASS|FAIL"
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
console.log('GATE GRASSSIDES');
const PG = C.PREMISES_GEN;
const J = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8') });
if (!J || !PG || !PG.grassSides) { ok(false, 'Jolene composes with the premises and the law is exported'); console.log('GATE GRASSSIDES: FAIL (' + fails + ')'); process.exit(1); }
const A = id => J.aerodromes.find(a => a.id === id);
// a point v metres past a strip's EDGE (across, at u metres along from its centre); v < 0 inside
const across = (a, v, u) => { const d = [Math.cos(a.hdg), Math.sin(a.hdg)], p = [-d[1], d[0]], w = a.wid / 2 + v, s = u || 0; return [a.x + d[0] * s + p[0] * w, a.z + d[1] * s + p[1] * w]; };
const q = (P, pave) => J.coverAt(P[0], P[1], pave) || { kill: 0, boost: 0, kind: null };
const law = l => PG.grassSides({ law: l });
const D = PG.GRASS_SIDES_DEF;
// 1
{ law('today'); const H = A('HOME'), S = A('tw_ski');
  const on = q(across(H, -5)), band = q(across(H, 30)), past = q(across(H, 60, 300)), strip = q(across(S, -4));
  ok(PG.grassSides().law === 'today' && D.law === 'today', "1 the default law is 'today'");
  ok(on.kill === 1 && band.kill === 1 && !('cut' in on) && !('cut' in band) && strip.kill === 1 && !('surf' in strip),
     "1 under 'today': HOME bare on its surface and across its 40 m band, the grass strip's surface bare (G665), no cut / surf in the answer", 'HOME +30 m kill ' + band.kill + ', tw_ski surface kill ' + strip.kill); }
// 2
{ const probes = []; for (const id of ['HOME', 'w2', 'w3', 'mn_strip', 'nv_strip', 'tw_ski']) { const a = A(id); for (const v of [-3, 0.5, 1, 2, 5, 10, 20, 40, 45, 50, 55, 60, 70, 90]) for (const u of [0, a.len * 0.3]) probes.push(across(a, v, u)); }
  law('today'); const t = probes.map(P => JSON.stringify(J.coverAt(P[0], P[1], 1)));
  law('sides'); const s = probes.map(P => JSON.stringify(J.coverAt(P[0], P[1], 1)));
  law('today');
  ok(t.every((x, i) => x === s[i]), "2 the pave half (rocks, debris, trees) answers the same under both laws", probes.length + ' probes'); }
// 3
{ law('sides'); const G = PG.grassSides(), H = A('HOME'), S = A('tw_ski'), W3 = A('w3');
  // a station along HOME where nothing but HOME is paved within 25 m of the probes (a road or a taxiway would answer too)
  const PO = J.premises && J.premises.overlay, vs = [30, H.band + G.mowBand - 1, H.band + G.mowBand + G.mowBlend + 2];
  let u = 0; for (let k = -8; k <= 8; k++) { const uu = k / 20 * H.len; if (vs.every(v => { const P = across(H, v, uu); return !PO || !PO.pavedNear(P[0], P[1], 25, 'HOME'); })) { u = uu; break; } }
  const on = q(across(H, -5, u)), side = q(across(H, G.sideClear * 0.5, u)), band = q(across(H, vs[0], u)), mow = q(across(H, vs[1], u)), wild = q(across(H, vs[2], u));
  ok(on.kill === 1 && side.kill === 1, "3 'sides': HOME bare on its surface and its drawn side (" + G.sideClear + ' m)', 'at ' + u.toFixed(0) + ' m along: surface ' + on.kill + ', +' + (G.sideClear * 0.5).toFixed(1) + ' m ' + side.kill);
  ok(band.kill === 0 && band.cut === 1 && mow.kill === 0 && mow.cut === 1, "3 'sides': cut grass across the 40 m band and the " + G.mowBand + ' m mow band past it', '+30 m cut ' + band.cut + ', +' + (H.band + G.mowBand - 1) + ' m cut ' + mow.cut);
  ok(!wild.cut && (wild.kill || 0) === 0, "3 'sides': wild past the blend", '+' + (H.band + G.mowBand + G.mowBlend + 2) + ' m cut ' + (wild.cut || 0));
  const surf = q(across(S, -4)), soft = q(across(W3, 1));
  ok(surf.kill === 0 && surf.surf === 1 && surf.cut === 1, "3 'sides': the grass strip's running surface is cut grass (surf 1)", 'tw_ski kill ' + surf.kill + ' surf ' + surf.surf);
  ok(soft.kill === 0 && soft.cut === 1, "3 'sides': a soft (gravel) strip's torn edge lets the cut grass in past " + G.softClear + ' m', 'w3 +1 m kill ' + soft.kill + ' cut ' + soft.cut);
  PG.grassSides({ stripGrass: 0 }); const bare = q(across(S, -4)); PG.grassSides({ stripGrass: 1 });
  ok(bare.kill === 1 && !bare.surf, "3 'sides' with stripGrass 0: the grass strip's surface bare again (G665's answer)");
  law('today'); }
// 4
{ const before = PG.grassSides(); const r = PG.grassSides({ law: 'jungle', mowBand: -5, nonsense: 3, sideClear: '2.5' });
  ok(r.law === before.law && r.mowBand === 0 && r.sideClear === 2.5 && !('nonsense' in r), '4 the dials: an unknown law and key refused, a negative clamped to 0, a number read');
  PG.grassSides(Object.assign({}, D)); ok(JSON.stringify(PG.grassSides()) === JSON.stringify(D), '4 back to GRASS_SIDES_DEF'); }

console.log('GATE GRASSSIDES: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
