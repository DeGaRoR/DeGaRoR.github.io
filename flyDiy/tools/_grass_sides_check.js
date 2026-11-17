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
  ok(D.law === 'sides', "1 the default law is 'sides' (train 44, the user: grass on the sides and the grass runway); 'today' stays a dial");
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
  // (16 Nov: inside tw_ski's NARROW drawn track - trackW 2.7 m from the centreline since 16 Nov, DIRT-STRIP's L40e track - so 2.5 m off it)
  // (SKYLINE-RESORT 17 Nov: the probes by their distance from the CENTRELINE - 2.5 m and 5 m off it, as the rows say - not from the
  //  edge of an 18 m strip: tw_ski is 6 m wide since 16 Nov. On 18 m they are the same points as before: -6.5 and -4 from the edge)
  const surf = q(across(S, 2.5 - S.wid / 2)), soft = q(across(W3, 1)), wildT = q(across(S, 5 - S.wid / 2));
  ok(surf.kill === 0 && surf.surf === 1 && surf.cut === 1, "3 'sides': the grass strip's running surface is cut grass (surf 1)", 'tw_ski kill ' + surf.kill + ' surf ' + surf.surf);
  // (DIRT-STRIP 10 Nov, the user: "vegetation grows on the ruts") the trail's wheel lanes bare: a few tufts on a main lane (the fleet's
  //  mean half-track 1.098 m), fewer than everywhere else, the tail wheel's lane down the middle thinned less, none 5 m out
  const lane = q(across(S, -S.wid / 2 + 1.098)), mid = q(across(S, -S.wid / 2));
  ok(lane.kill > 0.7 && lane.surf === 1 && mid.kill > 0 && mid.kill < lane.kill && surf.kill === 0, "3 'sides': the grass strip's trail - its wheel lanes nearly bare, its middle thinned, cut grass beside", 'tw_ski lane ' + lane.kill.toFixed(2) + ', middle ' + mid.kill.toFixed(2) + ', 5 m out ' + surf.kill);
  ok(G.trackW === 2.7 && !wildT.cut && !wildT.surf && (wildT.kill || 0) === 0, "3 'sides': past the narrow drawn track (trackW " + G.trackW + ' m) the trail strip grows the wild grass', 'tw_ski 5 m off the centreline: cut ' + (wildT.cut || 0) + ' surf ' + (wildT.surf || 0));
  ok(soft.kill === 0 && soft.cut === (G.softBandK > 0 || G.mowBand > 0 ? 1 : 0), "3 'sides': a soft (gravel) strip's torn edge lets the grass in past " + G.softClear + ' m (wild since GRASS TO THE EDGE, 7)', 'w3 +1 m kill ' + soft.kill + ' cut ' + soft.cut);
  PG.grassSides({ stripGrass: 0 }); const bare = q(across(S, -4)); PG.grassSides({ stripGrass: 1 });
  ok(bare.kill === 1 && !bare.surf, "3 'sides' with stripGrass 0: the grass strip's surface bare again (G665's answer)");
  law('today'); }
// 4
{ const before = PG.grassSides(); const r = PG.grassSides({ law: 'jungle', mowBand: -5, nonsense: 3, sideClear: '2.5' });
  ok(r.law === before.law && r.mowBand === 0 && r.sideClear === 2.5 && !('nonsense' in r), '4 the dials: an unknown law and key refused, a negative clamped to 0, a number read');
  PG.grassSides(Object.assign({}, D)); ok(JSON.stringify(PG.grassSides()) === JSON.stringify(D), '4 back to GRASS_SIDES_DEF'); }

// 5 THE LAW IS THE WHEELS' GROUND TOO (GRASS-ON-GREEN, 16 Nov; A0's audit): `hard` moves the surface (20_world giveWay), so the
//   editor sets it through world.setGrassSides, which sim_link replays on the physics worker's world (WORLD_FNS / SIM_HOST_WORLD_FNS),
//   and a worker's world made later takes the page's law first (worldMsg opts.grassSides -> makeWorld)
{ PG.grassSides(Object.assign({}, D));
  ok(typeof J.setGrassSides === 'function' && J.setGrassSides({ hard: 0 }).hard === 0 && PG.grassSides().hard === 0 && J.setGrassSides().hard === 0,
     '5a world.setGrassSides sets and reads the premises law');
  J.setGrassSides({ hard: 1 });
  let pt = null; for (const a of J.aerodromes) { if (pt || a.surface == null || a.kind === 'meadow') continue;
    for (let u = -a.len / 2; u <= a.len / 2 && !pt; u += 10) for (const v of [2, 4, 6]) { const P = across(a, v, u); if (J.marginGrassAt(P[0], P[1])) { pt = P; break; } } }
  const sOn = pt ? J.surface(pt[0], pt[1]) : null; J.setGrassSides({ hard: 0 }); const sOff = pt ? J.surface(pt[0], pt[1]) : null, mOff = pt ? J.marginGrassAt(pt[0], pt[1]) : null; J.setGrassSides({ hard: 1 });
  ok(pt && !mOff && sOn !== sOff, "5b a margin point's wheels' ground follows the law: given way under hard 1, the strip's gravel under hard 0", pt ? 'surface ' + sOn + ' -> ' + sOff : 'no margin point found');
  const J0 = IN.islandWorld('jolene', { premises: fs.readFileSync(path.join(T, 'fixtures', 'island_jolene.json'), 'utf8'), grassSides: { hard: 0 } });
  ok(PG.grassSides().hard === 0 && (!pt || !J0.marginGrassAt(pt[0], pt[1])), "5c a world made with opts.grassSides (the worker's, sim_link worldMsg) takes the page's law first");
  PG.grassSides(Object.assign({}, D));
  const SL = fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'sim_link.js'), 'utf8'), SH = fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'sim_host.js'), 'utf8'), WR = fs.readFileSync(path.join(T, '..', 'src', 'viewer', 'world_rail.js'), 'utf8');
  const fnsOf = (src, name) => { const a = src.indexOf(name + ' = ['), b = a < 0 ? -1 : src.indexOf(']', a); return a < 0 ? '' : src.slice(a, b); };
  ok(/'setGrassSides'/.test(fnsOf(SL, 'WORLD_FNS')) && /'setGrassSides'/.test(fnsOf(SH, 'SIM_HOST_WORLD_FNS')) && /grassSides: typeof PREMISES_GEN/.test(SL),
     "5d the worker gets it: sim_link WORLD_FNS + worldMsg, sim_host SIM_HOST_WORLD_FNS");
  ok(!WR.includes('P.grassSides({') && !WR.includes('GSD().grassSides(d)') && /gsSet/.test(WR), "5e the editor's grass rows set the law through the world (gsSet), never PREMISES_GEN alone"); }

// 6 THE PAGE HAS NO process (16 Nov, the page boot: the override line read FALSE there, +false = 0, and the page shipped hard 0 while
//   every node gate saw 1): the override line run in a browser-like scope (window, no process) leaves the default; a set flag wins (process shadowed, so a run under FLYDIY_GRASS_HARD=0 cannot leak in)
{ const src = fs.readFileSync(path.join(T, '..', 'src', 'core', '27_premises.js'), 'utf8'), line = src.split(/\r?\n/).find(l => l.startsWith('try {') && l.includes('FLYDIY_GRASS_HARD'));
  const run = win => { const G = { hard: 1 }; new Function('window', 'GRASS_SIDES', 'process', line)(win, G, undefined); return G.hard; };
  ok(!!line && run({}) === 1 && run({ FLYDIY_GRASS_HARD: 0 }) === 0 && run({ FLYDIY_GRASS_HARD: '0' }) === 0 && run({ FLYDIY_GRASS_HARD: 1 }) === 1,
     "6 the page (no process): hard stays the default unless window.FLYDIY_GRASS_HARD is set", line ? [run({}), run({ FLYDIY_GRASS_HARD: 0 }), run({ FLYDIY_GRASS_HARD: '0' })].join(' / ') : 'no override line'); }

// 7 GRASS TO THE EDGE (16 Nov eve, the user: "the best looking is ... wild grass coming close up"): a SOFT strip's own cut band x
//   softBandK (0: the wild grass runs to its drawn edge, past softClear and the mowBlend metre), the slight cut band mowBand (0 m);
//   the paved fields keep their 40 m mown band; softBandK 1 puts the old cut back
{ law('sides'); const G0 = PG.grassSides(), W1 = A('w1'), H = A('HOME');
  ok(G0.softBandK === 0 && G0.mowBand === 1.5, '7a the defaults: softBandK 0, mowBand 1.5 m (the user\'s refinement: a narrow TALL cut band, then the wild grass)', 'softBandK ' + G0.softBandK + ', mowBand ' + G0.mowBand);
  const at = (a, v) => q(across(a, v, a.len * 0.2));
  const w2 = at(W1, 3), w3 = at(W1, 4), h20 = at(H, 20), w1c = at(W1, 1);
  ok(!w2.cut && (w2.kill || 0) === 0 && !w3.cut && (w3.kill || 0) === 0, '7b Cabin Strip (gravel, its own band 4 m): wild grass 3 m and 4 m past the edge (past mowBand 1.5 + the 1 m blend) - no cut, no kill', '+3 m cut ' + (w2.cut || 0) + ' kill ' + (w2.kill || 0) + ', +4 m cut ' + (w3.cut || 0));
  ok(w1c.cut === 1 && w1c.tall === 1 && !h20.tall, '7f 1 m past a soft strip the cut is TALL (the field draws it at tallH); HOME\'s lawn is not', '+1 m cut ' + w1c.cut + ' tall ' + w1c.tall + ', HOME +20 m tall ' + (h20.tall || 0));
  ok(h20.cut === 1 && (h20.kill || 0) === 0, '7c HOME (old concrete): its 40 m band stays cut', '+20 m cut ' + h20.cut);
  PG.grassSides({ softBandK: 1 }); const back = at(W1, 3.5); PG.grassSides({ mowBand: 3, softBandK: 0 }); const slight = at(W1, 2), past = at(W1, 4.5);
  PG.grassSides({ softBandK: G0.softBandK, mowBand: G0.mowBand });
  ok(back.cut === 1 && slight.cut === 1 && !past.cut, '7d softBandK 1 puts the strip\'s own cut band back; mowBand 3 m cuts a slight band and no further', '+3.5 m cut ' + back.cut + ' (K 1), +2 m ' + slight.cut + ' / +4.5 m ' + (past.cut || 0) + ' (mowBand 3)');
  ok(at(W1, 3.5).surf === 0 || at(W1, 3.5).surf == null, '7e look only: past the edge the surface is never the strip\'s (the wheels read the ground)'); }

// 8 TOWN LAWNS (16 Nov eve, the user via A0: they "can be anything" - none, to save the frame; a little grass along the street verges):
//   (then "if it's cheap it's OK and no exception then": townLawn 1, the lawn, the default) townLawn 0 - a town plot plants nothing, a road's mown verge on it keeps its cut grass
{ const R = J.premises.overlay.records, Z = J.premises.rec.layers.zones, zs = {}; for (const z of Z) zs[z.id] = z;
  const town = R.plots.filter(p => p.poly && zs[p.zone] && /residential|commercial|park/.test(zs[p.zone].kind) && !p.noGround);
  let lawn1 = 0, none0 = 0, verge = 0, n = 0;
  for (const p of town.slice(0, 120)) { const b = PG.polyBBox(p.poly); for (let x = b.x0; x <= b.x1; x += 2) for (let z = b.z0; z <= b.z1; z += 2) { if (!PG.inPoly(p.poly, x, z)) continue; n++;
    PG.grassSides({ townLawn: 0 }); const c = J.coverAt(x, z); PG.grassSides({ townLawn: 1 }); const a = J.coverAt(x, z);
    if (a && a.kind === 'lawn') lawn1++; if (c && c.kind === 'none') none0++; if (c && !c.kind && c.cut > 0 && c.kill < 1) verge++; } }
  ok(PG.grassSides().townLawn === 1 && n > 500 && none0 > n * 0.7 && verge > 0 && lawn1 > n * 0.7,
     '8 town plots: the lawn by default (townLawn 1); townLawn 0 none on ' + Math.round(100 * none0 / Math.max(1, n)) + ' %), the street verge keeps its cut grass (' + verge + ' points), townLawn 1 the lawn back (' + Math.round(100 * lawn1 / Math.max(1, n)) + ' %)', n + ' points on ' + Math.min(120, town.length) + ' plots'); }

console.log('GATE GRASSSIDES: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
