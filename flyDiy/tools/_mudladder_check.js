#!/usr/bin/env node
// GATE MUDLADDER (SNOW-MUD, 2026-11-15) - THE GROUND'S WEATHER LADDER: dirt -> firm mud -> soft mud, grass and sand dry / wet,
// as the soil's water says, or fixed; the bumps, the colour and the projections on the same rung.
//
// The user (15 Nov): "should we have a mud ladder? Dirt to firm mud to soft mud as a function of the weather? ... these 3 options,
// and maybe an auto setting? So we can keep doing tests, or mark a runway as always dry or muddy, and let some evolve with the
// weather", then: grass and sand the same (wet sand firmer, a little darker - "don't make the sand go too dark"), "the more soft
// the mud is, the deeper the ruts and the holes ... they sort of firm up slightly with the dry setting", "match the color of the
// projections to what we are doing here", and the Hiking Strip and the Old Community Runway on it (the New Community Runway kept
// clear: the story's). 07f GROUND_WX holds the law; this flies it.
//
//   node tools/_mudladder_check.js        -> "GATE MUDLADDER: PASS|FAIL" and the tables
//
// A. THE RUNGS: GROUND_WX's table - the soil's water S puts a weather code on its rung (dirt 6 / 11 / 12, grass 0 / 13, sand
//    7 / 14), the wear (dirt 0.85 / 1 / 1.3, sand 1 / 0.9), the darkening bounded (sand <= 10 %); a fixed code passes through.
// B. THE ISLAND (the shipped fixture): w6 (Old Community) and w8 (Hiking, the user's showcase: 'Do the hiking strip as our
//    showcase') are dirt (weather), w7 (New Community, the
//    story's) and every other strip untouched; world.setGround holds them on dry / firm / soft and lets go; THE SEASON (the
//    plan): the first storm day's 17:00 puts w6 on soft mud, and the days after walk it back down to dirt; the pilot plans on
//    the rung (world.surfaceNow).
// C. THE WHEELS: the Cub, full power from rest to 0.9 Vs, on a weather code at each rung rolls bit for bit as on that rung's
//    fixed code; dirt < firm mud < soft mud (soft at least 1.3 x dirt); wet sand shorter than dry sand; wet grass brakes longer
//    than dry grass.
// D. THE BUMPS: the Hiking Strip (chaos 0.4, the showcase): the ground on its box is the record's plus
//    (wear - 1) x the worn relief, exactly; the ruts deepest on soft mud and shallowest dry; the ceiling holds the ground on
//    every rung; off the box nothing moves; relooked sand (weather) in a copy, it firms its ruts wet (x 0.9).
// E. THE COLOUR: the drawn ground's multiplier is the projections' (PAVEMENT.groundWxColor = surfaceColor x groundWxMult), a
//    soaked dirt strip IS the mud's colour, the sand darkens by 10 % at most; the page wires it (app.js, render_world.js).
// F. THE OVERRIDE REACHES THE WORKER: setGround is replayed (sim_link / sim_host) and handed at a flight's start.
// G. THE WORLD EDITOR (A0 for the user, 16 Nov): the ladder's 17 numbers editable - world.setGroundLadder moves the rungs, the
//    ruts and the override's water at once, clamped, null resets; the worker takes them; the rail's block, its look, export
//    and reset; the editor names the weather codes; a wet grass strip keeps its tufts.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(__dirname, 'flight_core.js')), LB = require(path.join(__dirname, '_load_build.js')), IN = require(path.join(__dirname, 'island_node.js'));
const G = C.GROUND_WX, src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const t0 = Date.now(); let fails = 0, checks = 0;
const yes = (c, m, x) => { checks++; if (c) console.log('  ok   ' + m + (x != null ? ' (' + x + ')' : '')); else { fails++; console.log('  FAIL ' + m + (x != null ? ' - ' + x : '')); } };
const soil = S => ({ wet: S, cls: { dirt: S, sand: S, gravel: S, grass: S }, mud: 0 });

console.log('A. the rungs');
{
  const row = (c, S) => { const s = G.state(c, soil(S)); return [s.code, s.rung, s.wear]; };
  yes(row(20, 0.05).join() === '6,0,0.85' && row(20, 0.70).join() === '11,1,1' && row(20, 0.95).join() === '12,2,1.3', 'dirt (weather): dry dirt / firm mud / soft mud, the ruts x 0.85 / 1 / 1.3', [0.05, 0.7, 0.95].map(S => row(20, S).join(' ')).join(' | '));
  yes(row(21, 0.3)[0] === 0 && row(21, 0.6)[0] === 13, 'grass (weather): dry / wet', row(21, 0.3)[0] + ' / ' + row(21, 0.6)[0]);
  yes(row(22, 0.3).join() === '7,0,1' && row(22, 0.6).join() === '14,1,0.9', 'sand (weather): dry / wet (firmer: its ruts x 0.9)', row(22, 0.3).join(' ') + ' | ' + row(22, 0.6).join(' '));
  let mono = true, last = -1; for (let S = 0; S <= 1.0001; S += 0.01) { const c = G.state(20, soil(S)).rung; if (c < last) mono = false; last = c; }
  yes(mono, 'the dirt climbs the ladder as the soil wets, never back');
  yes(G.state(22, soil(1)).dark <= 0.10 + 1e-12 && G.state(21, soil(1)).dark <= 0.12 + 1e-12 && G.state(20, soil(1)).dark <= 0.30 + 1e-12, 'the darkening at saturation: sand <= 10 %, grass <= 12 %, dirt <= 30 %');
  yes([0, 5, 6, 7, 11, 12, 13, 14].every(c => G.resolve(c, soil(0.95)) === c), 'a fixed code is itself, whatever the soil');
  yes(C.GROUND_SURF[13] && C.GROUND_SURF[14] && C.GROUND_SURF[20] === C.GROUND_SURF[6] && C.GROUND_SURF[21] === C.GROUND_SURF[0] && C.GROUND_SURF[22] === C.GROUND_SURF[7],
    'the rows: wet grass and wet sand; a weather code unresolved reads its dry rung');
  yes(C.GROUND_SURF[13][1] < C.GROUND_SURF[0][1] && C.GROUND_SURF[14][0] < C.GROUND_SURF[7][0], 'wet grass brakes worse than dry, wet sand rolls easier than dry');
}

console.log('B. the island');
const JTXT = fs.readFileSync(path.join(__dirname, 'fixtures', 'island_jolene.json'), 'utf8');
const W = IN.islandWorld('jolene', { premises: JTXT });
const A = id => W.aerodromes.find(a => a.id === id);
{
  const w6 = A('w6'), w8 = A('w8'), w7 = A('w7');
  yes(w6 && w6.look === 'dirtwx' && w8 && w8.look === 'dirtwx', 'the Old Community Runway and the Hiking Strip (the showcase) are dirt (weather)', w6 && w6.look + ', ' + (w8 && w8.look));
  yes(w7 && w7.look === 'dirt', 'the New Community Runway (the story\'s) is untouched', w7 && w7.look);
  const others = W.aerodromes.filter(a => a.premises && a.id !== 'w6' && a.id !== 'w8');
  const fixedNow = () => others.map(a => W.surface(a.x, a.z)).join();
  const f0 = fixedNow(), seen = {};
  for (const lv of ['dry', 'firm', 'soft', null]) { W.setGround(lv); seen[lv] = [W.surface(w6.x, w6.z), W.surface(w8.x, w8.z), fixedNow() === f0]; }
  yes(seen.dry.join() === '6,6,true' && seen.firm.join() === '11,11,true' && seen.soft.join() === '12,12,true', 'world.setGround holds both on dirt / firm mud / soft mud; every other strip as it was',
    ['dry', 'firm', 'soft'].map(k => k + ' ' + seen[k][0] + '/' + seen[k][1]).join(', '));
  yes(seen.null[0] === 6 && W.groundForce === null, 'let go: the weather\'s (the sandbox day: dry)');
  // THE SEASON: the first storm day of the plan (rain >= 0.9) at 17:00, then the next days at 15:00 until the dirt is back
  const blocks = C.WEATHER_PLAN.BLOCKS, jdnOf = s => C.SOLAR.jdn(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10));
  const dateOf = j => { const c = C.SOLAR.civil(j); return c.y + '-' + String(c.m).padStart(2, '0') + '-' + String(c.d).padStart(2, '0'); };
  let storm = null;
  for (const B of blocks) { const j1 = jdnOf('2026-' + B.day1); for (let i = 0; i < 14 && !storm; i++) { const D = B.days[i]; if (D.rain && Math.max(...D.rain.map(r => r[1])) >= 0.9) storm = { j: j1 + i, name: D.name || D.id }; } if (storm) break; }
  yes(!!storm, 'the plan has a storm day', storm && dateOf(storm.j));
  if (storm) {
    const at = (j, h) => { W.setDay({ date: dateOf(j), localHours: h, plan: { id: 'season' } }); return [W.surface(w6.x, w6.z), W.soilNow().cls.dirt]; };
    const s0 = at(storm.j, 17), walk = [];
    let back = null;
    for (let k = 1; k <= 6; k++) { const r = at(storm.j + k, 15); walk.push('+' + k + 'd ' + r[0] + ' (' + r[1].toFixed(2) + ')'); if (back === null && r[0] === 6) back = k; }
    yes(s0[0] === 12, 'the storm day (' + dateOf(storm.j) + ') at 17:00: the Old Community Runway is soft mud', 'surface ' + s0[0] + ', the dirt\'s water ' + s0[1].toFixed(2));
    yes(back !== null && back <= 5, 'the days after walk it back to dirt (within five)', walk.join(', '));
    console.log('       the walk: storm 17:00 ' + s0[0] + ' (' + s0[1].toFixed(2) + '), ' + walk.join(', '));
    W.setDay({ plan: null });
  }
  W.setGround('soft');
  yes(W.surfaceNow(20) === 12 && W.surfaceNow(6) === 6, 'the pilot plans on the rung (world.surfaceNow: the weather code now, a fixed code itself)');
  yes(/surfNow\(to\.surface\)/.test(src('src/core/43_pilot.js')) && /surfNow\(a\.surface\)/.test(src('src/core/43_pilot.js')) && /surfNow\(from0\.surface\)/.test(src('src/core/43_pilot.js')), 'the pilot\'s three strip rows read the rung');
  W.setGround(null);
}

console.log('C. the wheels');
{
  const base = LB.loadBuild(path.join(ROOT, 'builds', 'cub_2026-09-20_corrected.json')).spec;
  const d = C.buildGen(JSON.parse(JSON.stringify(base))), Vs = d.params.gen.Vs, R = d.refs;
  function roll(surfOf, brake) {
    const sim = C.makeSim(d, { terrainH: () => 0, surface: surfOf, treesNear: () => [] });
    sim.reset(0); for (let i = 0; i < 300; i++) sim.step(1 / 60);
    const P = sim.p, hdg = () => Math.atan2((P[R.mains[0] * 3 + 2] + P[R.mains[1] * 3 + 2]) / 2 - P[R.tw * 3 + 2], (P[R.mains[0] * 3] + P[R.mains[1] * 3]) / 2 - P[R.tw * 3]);
    const h0 = hdg(), p0 = sim.cgPos(); sim.ctl.thr = 1;
    const hold = () => { let e = hdg() - h0; e = Math.atan2(Math.sin(e), Math.cos(e)); sim.ctl.dr = Math.max(-1, Math.min(1, 4 * e)); };
    let run = null, t = 0;
    for (; t < 60; t += 1 / 60) { hold(); sim.step(1 / 60); if (sim.out.V > (brake ? 0.6 : 0.9) * Vs) { const p = sim.cgPos(); run = Math.hypot(p[0] - p0[0], p[2] - p0[2]); break; } }
    if (!brake || run === null) return { run, p: sim.cgPos() };
    sim.ctl.thr = 0; sim.ctl.brake = 1; const p1 = sim.cgPos();
    for (let u = 0; u < 60; u += 1 / 60) { hold(); sim.step(1 / 60); if (sim.out.V < 1) { const p = sim.cgPos(); return { run: Math.hypot(p[0] - p1[0], p[2] - p1[2]), p }; } }
    return { run: null };
  }
  const fixed = c => roll(() => c), wx = (c, lv) => roll(() => G.resolve(c, G.forced(lv)));
  const T = { dirt: fixed(6), firm: fixed(11), soft: fixed(12) };
  const same = (a, b) => a.run === b.run && a.p && b.p && a.p.every((v, i) => v === b.p[i]);
  yes(same(wx(20, 'dry'), T.dirt) && same(wx(20, 'firm'), T.firm) && same(wx(20, 'soft'), T.soft), 'dirt (weather) on each rung rolls bit for bit as dirt / firm mud / soft mud');
  const m = q => q.run == null ? 'STUCK' : q.run.toFixed(0) + ' m';
  console.log('       the Cub to 0.9 Vs: dirt ' + m(T.dirt) + ', firm mud ' + m(T.firm) + ', soft mud ' + m(T.soft));
  // (the operational rule the soft rows were fit to, 00_registry GROUND_SOFT: soft ground lengthens a light aeroplane's take-off 20-50 %)
  yes(T.dirt.run < T.firm.run && (T.soft.run == null || T.soft.run >= 1.2 * T.dirt.run), 'dirt < firm mud < soft mud (soft at least 1.2 x dirt: soft ground costs 20-50 %)', m(T.dirt) + ' / ' + m(T.firm) + ' / ' + m(T.soft) + ', x' + (T.soft.run / T.dirt.run).toFixed(2));
  const sd = fixed(7), sw = fixed(14);
  yes(same(wx(22, 'firm'), sw) && sw.run < sd.run, 'sand (weather) wet rolls as wet sand, shorter than dry sand', m(sd) + ' dry / ' + m(sw) + ' wet');
  const gd = roll(() => 0, true), gw = roll(() => 13, true), gx = roll(() => G.resolve(21, G.forced('firm')), true);
  yes(same(gx, gw) && gw.run > gd.run, 'grass (weather) wet brakes as wet grass, longer than dry (from 0.6 Vs to a stop)', m(gd) + ' dry / ' + m(gw) + ' wet');
}

console.log('D. the bumps');
{
  // the Hiking Strip (chaos 0.4) as shipped - dirt (weather), the showcase: the mud ladder on a bumpy strip
  const W2 = W, a = W2.aerodromes.find(q => q.id === 'w8'), O = W2.premises.overlay;
  const c = Math.cos(a.hdg), s = Math.sin(a.hdg), pts = [];
  for (let u = -a.len / 2 + 6; u <= a.len / 2 - 6; u += 1.3) for (let v = -a.wid / 2 + 0.2; v <= a.wid / 2 - 0.2; v += 0.21) pts.push([a.x + c * u - s * v, a.z + s * u + c * v]);
  const H = lv => { W2.setGround(lv); return pts.map(p => W2.terrainH(p[0], p[1])); };
  const hF = H('firm'), hS = H('soft'), hD = H('dry'), wr = pts.map(p => O.wearAtWorld(p[0], p[1], 'w8'));
  let eS = 0, eD = 0; for (let i = 0; i < pts.length; i++) { eS = Math.max(eS, Math.abs(hS[i] - hF[i] - 0.3 * wr[i])); eD = Math.max(eD, Math.abs(hD[i] - hF[i] + 0.15 * wr[i])); }
  yes(eS < 1e-9 && eD < 1e-9, 'the ground on its box is the record\'s + (wear - 1) x the worn relief, exactly', 'soft ' + eS.toExponential(1) + ', dry ' + eD.toExponential(1) + ' m over ' + pts.length + ' points');
  const deep = h => { let m = 0; for (let i = 0; i < pts.length; i++) if (wr[i] < 0) m = Math.max(m, hF[i] - h[i] + (h === hF ? -wr[i] : 0)); return m; };
  const trough = pts.reduce((m, p, i) => (wr[i] < wr[m] ? i : m), 0);
  const dTr = h => (h[trough] - hF[trough] + (-wr[trough])) ;
  const rS = -(wr[trough]) * 1.3, rF = -(wr[trough]), rD = -(wr[trough]) * 0.85;
  yes(hS[trough] < hF[trough] && hF[trough] < hD[trough], 'the deepest trough: soft mud cuts it deeper, dry dirt firms it', 'worn ' + (rD * 100).toFixed(1) + ' / ' + (rF * 100).toFixed(1) + ' / ' + (rS * 100).toFixed(1) + ' cm (dry / firm / soft)');
  let ceil = true;
  for (const lv of ['dry', 'soft']) { W2.setGround(lv); for (let k = 0; k < 300 && ceil; k++) { const i = (k * 7919) % pts.length, p = pts[i], m = W2.groundMaxRect(p[0] - 1.5, p[1] - 1.5, p[0] + 1.5, p[1] + 1.5); if (!(m >= W2.terrainH(p[0], p[1]) - 1e-9)) ceil = false; } }
  yes(ceil, 'the ceiling holds the ground on every rung (300 rectangles a rung)');
  const off = [[a.x - s * (a.wid / 2 + 15), a.z + c * (a.wid / 2 + 15)], [a.x + s * (a.wid / 2 + 30) + c * 50, a.z - c * (a.wid / 2 + 30) + s * 50], [a.x + c * (a.len / 2 + 40), a.z + s * (a.len / 2 + 40)], [0, 0], [-811, -2397]];   // beside it, past its end, HOME, w3
  const o1 = (W2.setGround('dry'), off.map(p => W2.terrainH(p[0], p[1]))), o2 = (W2.setGround('soft'), off.map(p => W2.terrainH(p[0], p[1])));
  yes(o1.every((v, i) => v === o2[i]), 'off the box nothing moves');
  W2.setGround(null);
  // the same strip relooked sand (weather) in a copy of the record: wet sand firms its ruts (x 0.9)
  const J = JSON.parse(JTXT); const r8 = J.layers.runways.find(r => r.id === 'w8'); r8.look = 'sandwx'; r8.surface = 22;
  const W3 = IN.islandWorld('jolene', { premises: JSON.stringify(J) }), b8 = W3.aerodromes.find(q2 => q2.id === 'w8');
  let q = null, wq = 0; for (let u = -150; u <= 150 && !q; u += 0.37) { const p = [b8.x + Math.cos(b8.hdg) * u - Math.sin(b8.hdg) * 1.1, b8.z + Math.sin(b8.hdg) * u + Math.cos(b8.hdg) * 1.1], w = W3.premises.overlay.wearAtWorld(p[0], p[1], 'w8'); if (w < -0.01) { q = p; wq = w; } }
  W3.setGround('dry'); const hd = W3.terrainH(q[0], q[1]); W3.setGround('firm'); const hw = W3.terrainH(q[0], q[1]); W3.setGround(null);
  yes(Math.abs(hw - hd + 0.1 * wq) < 1e-9 && hw > hd, 'sand (weather) on the same strip: wet, its worn relief x 0.9 (the trough fills a little)', ((hw - hd) * 1000).toFixed(2) + ' mm where the relief is ' + (wq * 100).toFixed(1) + ' cm');
  yes(/wearUV/.test(src('src/core/26b_strip_micro.js')) && /glslRow\(id, wear\)/.test(src('src/core/26b_strip_micro.js')), 'the field names its worn relief and the shader rows scale by it');
}

console.log('E. the colour');
{
  const P = require(path.join(ROOT, 'src', 'viewer', 'pavement.js'));
  const D = P.surfaceColor('dirt'), M = P.surfaceColor('mud'), S = P.surfaceColor('sand');
  yes(!!(D && M && S && P.groundWxColor && P.groundWxMult && P.setGroundWx), 'the pavement names the rung\'s colour (groundWxMult, groundWxColor, setGroundWx)');
  if (D && M && S && P.groundWxColor) {
    const soak = P.groundWxColor('dirt', G.state(20, soil(0.97)));
    yes(soak.every((v, i) => Math.abs(v - M[i]) < 1e-9), 'a soaked dirt strip is drawn - and throws - the mud\'s own colour', soak.map(v => v.toFixed(3)).join(' ') + ' = mud ' + M.map(v => v.toFixed(3)).join(' '));
    const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], sw = P.groundWxColor('sand', G.state(22, soil(1)));
    yes(lum(sw) >= 0.9 * lum(S) - 1e-9, 'wet sand a shade darker, no more (<= 10 %)', (100 * (1 - lum(sw) / lum(S))).toFixed(1) + ' %');
    const fm = P.groundWxColor('dirt', G.state(20, soil(0.7)));
    yes(lum(fm) < lum(D) && lum(fm) > lum(M), 'firm mud drawn between the dirt and the mud', lum(D).toFixed(3) + ' > ' + lum(fm).toFixed(3) + ' > ' + lum(M).toFixed(3));
  }
  const app = src('src/viewer/app.js'), rw = src('src/viewer/render_world.js');
  yes(/PAVEMENT\.groundWxColor\(W\.cls, W\)/.test(app) && /world\.wxAt\(/.test(app), 'the projections take the strip\'s rung colour (app.js: world.wxAt -> PAVEMENT.groundWxColor -> the dust\'s setGround)');
  yes(/if \(sc === 11 \|\| sc === 12\) return DUST_CLS\.mud/.test(app), 'a weather dirt strip on a mud rung throws mud');
  yes(/world\.soilNow\(\)/.test(app), 'the dust and the puddles read the world\'s soil (the override included)');
  yes(/PAV\.setGroundWx\(THREE, W\.part, st\)/.test(rw) && /wxGroundFrame\(\)/.test(rw) && /O\.wearAtWorld/.test(rw), 'the drawn strip follows its rung (render_world: the row re-applied, a bumpy one re-draped)');
  // the aprons, pads and roads of a weather look (the user: "the aprons around should probably follow the same trend")
  const rp = src('src/viewer/render_premises.js'), LK = C.PREMISES_GEN.RUNWAY_LOOKS;
  const P2 = require(path.join(ROOT, 'src', 'viewer', 'pavement.js')), RSx = P2.resolve(null, null, LK.sandwx), RSf = P2.resolve(null, null, LK.sand);
  yes(RSx.wx === 22 && RSf.wx === 0, 'a weather look\'s pavement carries its code (PAVEMENT.resolve -> make\'s wx), a fixed one none', RSx.wx + ' / ' + RSf.wx);
  yes((rp.match(/wx: RS\.wx/g) || []).length === 3 && /wx: RS\.wx/.test(rw) && /PAV\.groundWxTick\(THREE/.test(rw) && /pavWxOwned = true/.test(rw), 'every pavement of a weather look is re-tinted on its rung - the strips by their owner (re-draped), the aprons, pads and roads by the tick');
}

console.log('F. the override reaches the worker');
{
  const sl = src('src/viewer/sim_link.js'), sh = src('src/viewer/sim_host.js');
  yes(/'setSea', 'setGround'[,\]]/.test(sl) && /'setSea', 'setGround'[,\]]/.test(sh), 'setGround is replayed on the physics worker\'s world (as setDay)');
  yes(/ground: world\.groundForce/.test(sl) && /world\.setGround\(W\.ground\)/.test(sh), 'and handed at a flight\'s start');
  const W3 = C.makeWorld(0, {}); W3.setGround('soft'); const k = W3.soilNow(); W3.setGround('bogus');
  yes(k && k.cls.dirt === 0.95 && W3.groundForce === null, 'a bad level lets go (the weather\'s)');
}

console.log('G. the world editor (A0 for the user, 16 Nov: every new world setting editable in the world rail)');
{
  const D = G.LADDER_DEF, v0 = G.version;
  yes(Object.isFrozen(D) && Object.keys(D).length === 17 && Object.keys(D).every(k => G.LADDER_RANGE[k] && D[k] >= G.LADDER_RANGE[k][0] && D[k] <= G.LADDER_RANGE[k][1]), 'the ladder\'s 17 numbers, each with its range, the shipped ones inside it');
  const R = soil(0.7);
  yes(G.resolve(20, R) === 11, 'shipped: S 0.7 is firm mud');
  W.setGroundLadder({ mudFirm: 0.9 });
  yes(G.resolve(20, R) === 6 && G.version > v0, 'world.setGroundLadder moves the rung (firm mud from 0.9: S 0.7 is dirt) and counts a version');
  W.setGroundLadder({ mudSoft: 0.1, bogus: 3, darkSand: 9 });
  const L = G.ladder();
  yes(L.mudSoft === L.mudFirm && !('bogus' in L) && L.darkSand === G.LADDER_RANGE.darkSand[1], 'clamped: soft mud never under firm, an unknown key ignored, a value held to its range', JSON.stringify({ mudFirm: L.mudFirm, mudSoft: L.mudSoft, darkSand: L.darkSand }));
  W.setGroundLadder(null);
  yes(JSON.stringify(G.ladder()) === JSON.stringify(D) && G.resolve(20, R) === 11, 'null: back to the shipped ladder');
  // the wear knob reaches the ground the wheels stand on (the showcase's box), and the override's water its knob
  const a = A('w8'), c = Math.cos(a.hdg), s2 = Math.sin(a.hdg), O = W.premises.overlay;
  let q = null, wq = 0; for (let u = -150; u <= 150 && !q; u += 0.37) { const p = [a.x + c * u - s2 * 1.1, a.z + s2 * u + c * 1.1], w = O.wearAtWorld(p[0], p[1], 'w8'); if (w < -0.01) { q = p; wq = w; } }
  W.setGround('soft'); const h13 = W.terrainH(q[0], q[1]); W.setGroundLadder({ wearDirtSoft: 1.6 }); const h16 = W.terrainH(q[0], q[1]);
  yes(Math.abs(h16 - h13 - 0.3 * wq) < 1e-9, 'the soft-mud ruts knob (1.3 -> 1.6) deepens the showcase\'s trough by 0.3 x its worn relief, at once', ((h13 - h16) * 1000).toFixed(1) + ' mm');
  W.setGroundLadder({ forceSoft: 0.7 }); const Rf = W.soilNow();
  yes(Rf.cls.dirt === 0.7 && W.surface(a.x, a.z) === 11, 'the override\'s water is a knob (\'soft\' held at 0.7 instead: the strip is firm mud)');
  W.setGroundLadder(null); W.setGround(null);
  const sl = src('src/viewer/sim_link.js'), sh = src('src/viewer/sim_host.js'), wr = src('src/viewer/world_rail.js'), pu = src('src/viewer/premises_ui.js'), rw2 = src('src/viewer/render_world.js');
  yes(/'setGround', 'setGroundLadder'\]/.test(sl) && /'setGround', 'setGroundLadder'\]/.test(sh) && /ladder: typeof GROUND_WX/.test(sl) && /world\.setGroundLadder\(W\.ladder\)/.test(sh), 'the ladder reaches the physics worker: replayed, and handed at a flight\'s start');
  yes(/function ladderRows\(body\)/.test(wr) && /ladderRows\(body\);/.test(wr) && /w\.setGroundLadder\(o\)/.test(wr), 'the world rail\'s RUNWAYS carries a \'weather ladder\' block, set through the world');
  yes(/o\.ladder = GWX\(\)\.ladder\(\)/.test(wr) && /put\('ladder', deltaOf\(N\.ladder, DEF\.ladder\)\)/.test(wr) && /ladderSet\(d\)/.test(wr), 'kept in THE LOOK (the delta against the shipped) and put back at boot / import');
  yes(/diff\(DEF\.ladder, out\.ladder, 'ladder'\)/.test(wr) && /ladder: 'src\/core\/07f_ground_wx\.js LADDER_DEF/.test(wr) && /'the weather ladder', \(\) => \{ ladderSet\(null\)/.test(wr), 'exported (its changes and where they go) and reset');
  yes(/GROUND_WX\.version/.test(rw2) && /GROUND_WX\.version/.test(src('src/viewer/pavement.js')), 'the drawn strips and aprons re-apply when the numbers move (the version in their keys)');
  const PG = C.PREMISES_GEN;
  yes(PG.surfaceName(20) === 'DIRT_WX' && PG.surfaceName(13) === 'GRASS_WET' && !/PG\.SURFACE_NAMES\[\+/.test(pu) && /SURFACE_WX_NAMES/.test(pu), 'the editor names a weather code (a wheels property on one no longer reads \'?\') and offers it');
  yes(/s === world\.SURFACE\.GRASS_WET/.test(rw2), 'a wet grass strip keeps its tufts (the cover\'s landBy takes GRASS_WET)');
  // the editor's save keeps the ladder (A0, 16 Nov: "If a save in the editor drops or rewrites the ladder on w6/w8, their edits
  // break the ladder"): the record through envelope / unwrap, composed, and saved again - w6 and w8 still dirt (weather), w8's bumps
  const pick = r => ['w6', 'w8'].map(id => { const w = r.layers.runways.find(q => q.id === id); return w.look + '/' + w.surface + (w.micro ? '/' + w.micro.chaos : ''); }).join(' ');
  const e1 = PG.envelope('jolene', PG.unwrap(JTXT).rec), r2 = W.premises && W.premises.rec, e2 = r2 ? PG.envelope('jolene', r2) : null;
  const p1 = pick(PG.unwrap(e1).rec), p2 = e2 ? pick(PG.unwrap(e2).rec) : '-';
  yes(p1 === 'dirtwx/20 dirtwx/20/0.4' && p2 === p1, 'the editor\'s save keeps the ladder on w6 and w8 (saved, composed, saved again)', p1 + ' | ' + p2);
  // the shipped scenery's manifest names the change (SCENERYED 15: the save is the user's, byte for byte; the ladder a field patch after the ship)
  const MF = JSON.parse(src('tools/fixtures/scenery_ship_afb19.json'));
  yes(['w6', 'w8'].every(id => MF.fieldPatches[id] && MF.fieldPatches[id].look === 'dirtwx' && MF.fieldPatches[id].surface === 20) && /SNOW-MUD LADDER/.test(MF.fieldPatchesWhyLadder || ''),
    'the scenery ship\'s manifest carries the ladder as a field patch on w6 and w8, with its why');
}

console.log('  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s, ' + checks + ' checks)');
console.log('GATE MUDLADDER: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
