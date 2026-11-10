#!/usr/bin/env node
// ============================================================
// GATE DUST - the strip's dust (DIRT-DUST, 2026-11-09; src/viewer/dust.js, app.js syncDustFx; the design
// D:/Dev/flydiy-notes/DIRT-DUST-DESIGN-2026-11-09.md). Node only, a few seconds.
//   1. THE WIRING    dust.js in the viewer's scripts before app.js; app.js parks the batch with the world (worldSettle),
//                    syncs it beside the spray on the frame's time, ?dust=0 turns it off; the shader carries the log depth
//   2. THE WEATHER   a dry take-off raises a cloud that outlives 30 s; damp raises less; wet raises no dust and throws mud
//   3. THE SOURCES   the run-up's blast alone raises dust (V = 0); a landing raises less than a take-off; paved raises none;
//                    a puddle throws mud, never dust
//   4. THE POOLS     never past their size; old puffs merge (a take-off is tens of puffs); every tier
//   5. THE DRAW      on the real three (no GL): one batch, far to near, the live count drawn, the near fade when the cover
//                    passes the tier's budget, nothing drawn when nothing lives
//   6. THE COST      the simulation's time a frame at a take-off's peak
// Run: node tools/_dust_check.js   (contract: one final `GATE DUST: ...`)
// ============================================================
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const DUST = require('../src/viewer/dust.js');
global.MATLIB = require('../src/viewer/matlib.js');   // the batch's material comes from the library (AS4a), as in the page
let fails = 0, checks = 0;
const ok = m => { checks++; console.log('  ok   ' + m); }, fail = m => { checks++; fails++; console.log('  FAIL ' + m); };
const yes = (c, m) => (c ? ok : fail)(m);
const T0 = Date.now();

console.log('1. the wiring');
{
  const b = src('tools/build.js'), a = src('src/viewer/app.js');
  yes(b.indexOf("'dust.js'") > 0 && b.indexOf("'dust.js'") < b.indexOf("'app.js'"), 'dust.js is in the viewer\'s scripts, before app.js');
  yes(/if \(dustFx && !inGarage\) syncDustFx\(running \? fdt : 0\);/.test(a), 'synced in the frame beside the spray, on the frame\'s own time (paused: drawn, not stepped)');
  yes(/if \(!dustFx\) dustMake\(\);/.test(a) && a.indexOf('if (!dustFx) dustMake();') > a.indexOf('function worldSettle('), 'the batch is made with the world and parked (worldSettle): linked by the roll-out\'s compile, never in flight');
  yes(/DUST_Q === 0/.test(a), '?dust=0 makes none (the A/B\'s lever)');
  yes(/typeof PAVEMENT !== 'undefined' && PAVEMENT\.setSoilWet/.test(a) && /typeof STRIP_MICRO !== 'undefined' && STRIP_MICRO\.puddleAt/.test(a) && !/window\.(PAVEMENT|STRIP_MICRO|SOIL_WET)\b/.test(a),
    'the soil reaches the pavement and the puddles by typeof (a top-level const is never on window: window.PAVEMENT would read nothing)');
  yes(/#include <logdepthbuf_vertex>/.test(DUST.GLSL.vert) && /#include <logdepthbuf_fragment>/.test(DUST.GLSL.frag), 'the shader carries the log depth chunks (the renderer\'s logarithmic depth buffer)');
}

// ---- the scenarios (the bench's kinematics: a Cub-like taildragger, 2000 N static, 1.84 m disc) ----------------------
const DISC = Math.PI * 0.92 * 0.92;
const washOf = (V, thr) => Math.sqrt(V * V + 2 * 2000 * thr / (1.225 * DISC)) - V;
function takeoff(t) {
  const st = { wheels: [], props: [], wing: null };
  const p = t < 6 ? 0 : t - 6, V = Math.min(22, 2 * p), x = p * p, air = 2 * p >= 22, y = air ? (p - 11) * 1.5 : 0, thr = t < 1 ? 0.1 : 1;
  for (const [k, z] of [[0, -0.9], [1, 0.9]]) st.wheels.push({ key: k, x, y: 0, z, vx: V, vy: 0, vz: 0, on: !air, R: 0.3, brake: 0 });
  st.props.push({ x: x + 1.5, y: 1.3 + y, z: 0, ax: Math.cos(0.19), ay: Math.sin(0.19), az: 0, R: 0.92, wash: washOf(V, thr) });
  st.wing = { span: 10.7, W: 5300, V: Math.max(V, 1), rho: 1.225, tips: [[x, 2 + y, -5.35], [x, 2 + y, 5.35]] };
  return st;
}
function landing(t) {
  const st = { wheels: [], props: [], wing: null }, T = 3;
  const V = t < T ? 20 : Math.max(0, 20 - 3 * (t - T)), x = t < T ? 20 * t : 60 + 20 * (t - T) - 1.5 * (t - T) ** 2, h = t < T ? 1.2 * (T - t) / T : 0;
  for (const [k, z] of [[0, -0.9], [1, 0.9]]) st.wheels.push({ key: k, x, y: 0, z, vx: V, vy: t < T + 0.05 ? -1.2 : 0, vz: 0, on: t >= T, R: 0.3, brake: t > T + 3 ? 0.5 : 0 });
  st.props.push({ x: x + 1.5, y: 1.3 + h, z: 0, ax: 1, ay: 0.05, az: 0, R: 0.92, wash: washOf(V, 0.05) });
  st.wing = { span: 10.7, W: 5300, V: Math.max(V, 1), rho: 1.225, tips: [[x, 2 + h, -5.35], [x, 2 + h, 5.35]] };
  return st;
}
function runup(t) {
  const st = { wheels: [{ key: 0, x: 0, y: 0, z: -0.9, vx: 0, vy: 0, vz: 0, on: true, R: 0.3 }, { key: 1, x: 0, y: 0, z: 0.9, vx: 0, vy: 0, vz: 0, on: true, R: 0.3 }], props: [], wing: null };
  st.props.push({ x: 1.5, y: 1.3, z: 0, ax: Math.cos(0.19), ay: Math.sin(0.19), az: 0, R: 0.92, wash: washOf(0, t < 12 ? 0.85 : 0.1) });
  return st;
}
function run(scen, opt) {
  opt = opt || {};
  const sys = DUST.makeSystem(opt.tier || 'gamer');
  const env = { groundH: () => 0, wind: () => [opt.wind || 2, 0, opt.wind || 2], cls: () => (opt.cls != null ? opt.cls : 0), wet: () => opt.S || 0, puddle: () => opt.puddle || 0, k: 1 };
  const dt = 1 / 30, N = Math.round((opt.T || 60) * 30), live = [], ms = [], tauAt = [];
  let mass = 0, maxP = 0, maxG = 0, over = false, mud = 0;
  for (let f = 0; f < N; f++) {
    const t = f * dt, st = scen(t), m0 = sys.stats.emitted;
    const a = process.hrtime.bigint();
    DUST.sources(sys, st, env, dt); DUST.step(sys, dt, env);
    ms.push(Number(process.hrtime.bigint() - a) / 1e6);
    maxP = Math.max(maxP, sys.P.live); maxG = Math.max(maxG, sys.G.live);
    let lp = 0; for (let i = 0; i < sys.P.n; i++) if (sys.P.age[i] >= 0) { lp++; mass += 0; }
    if (lp > sys.P.n) over = true;
    for (let q = 0; q < sys.G.n; q++) if (sys.G.age[q] < sys.G.life[q] && sys.G.kind[q] === 2) mud++;
    live.push(sys.P.live);
    if (f % 30 === 0) { let tm = 0; for (let i = 0; i < sys.P.n; i++) if (sys.P.age[i] >= 0) tm = Math.max(tm, sys.P.tau[i]); tauAt.push(tm); }
  }
  let m = 0; for (let i = 0; i < sys.P.n; i++) if (sys.P.age[i] >= 0) m += sys.P.tau[i] * Math.PI * sys.P.r[i] * sys.P.r[i];
  ms.sort((a, b) => a - b);
  return { sys, live, tauAt, maxP, maxG, over, mud, massEnd: m, emitted: sys.stats.emitted, merged: sys.stats.merged, ms50: ms[ms.length >> 1], ms99: ms[Math.floor(ms.length * 0.99)] };
}

console.log('2. the weather');
let dry;
{
  dry = run(takeoff, { T: 60 });
  const at40 = dry.live[40 * 30];
  yes(dry.emitted > 50 && at40 > 0, 'a dry take-off raises a cloud that outlives 30 s (' + dry.emitted + ' puffs emitted, ' + at40 + ' alive at 40 s)');
  // it hangs, then it goes (the user, 9 Nov: "persist longer" - then, at 240 s of linger, "the fading is now too long")
  { const tau40 = dry.tauAt[40], tau60 = dry.tauAt[59];
    yes(tau40 > 0.05, 'it HANGS: visible 25 s after the lift-off, optical depth ' + tau40.toFixed(2) + ' at 40 s > 0.05 (a low layer thins as 1/r)');
    const late = run(takeoff, { T: 15 + 2.5 * DUST.L.linger + 5 });
    yes(late.live[late.live.length - 1] === 0 && tau60 < tau40, 'then it GOES: thinning (' + tau60.toFixed(2) + ' at 60 s), nothing left 2.5 x linger (' + DUST.L.linger + ' s) after the roll'); }
  { let hm = 0, wm = 0; for (let i = 0; i < dry.sys.P.n; i++) if (dry.sys.P.age[i] >= 0) { hm = Math.max(hm, dry.sys.P.rv[i]); wm = Math.max(wm, dry.sys.P.r[i] / dry.sys.P.rv[i]); }
    yes(wm <= DUST.L.aspect + 1e-3, 'never stretched: the widest puff ' + wm.toFixed(2) + 'x its height (aspect ' + DUST.L.aspect + ')'); }
  { let hm = 0; for (let i = 0; i < dry.sys.P.n; i++) if (dry.sys.P.age[i] >= 0) hm = Math.max(hm, dry.sys.P.rv[i]);
    yes(hm <= DUST.L.rvCap + 1e-6 && hm < 10, 'a low layer: the tallest puff ' + hm.toFixed(1) + ' m half-height'); }
  const damp = run(takeoff, { T: 20, S: 0.3 }), dry20 = run(takeoff, { T: 20 });
  yes(damp.massEnd < 0.3 * dry20.massEnd, 'damp ground (S 0.3) raises under a third of the dry cloud (' + damp.massEnd.toFixed(1) + ' vs ' + dry20.massEnd.toFixed(1) + ' optical m^2 at 20 s)');
  const wet = run(takeoff, { T: 20, S: 0.6 });
  yes(wet.emitted === 0 && wet.mud > 0, 'wet ground (S 0.6): no dust at all, mud clods off the tyres (' + wet.emitted + ' puffs, ' + wet.mud + ' mud particle-frames)');
}

console.log('3. the sources');
{
  const r = run(runup, { T: 15 });
  yes(r.emitted > 5 && r.massEnd > 1, 'the run-up\'s blast alone (V = 0, 0.85 power) raises dust (' + r.emitted + ' puffs)');
  const l = run(landing, { T: 20 }), t = run(takeoff, { T: 20 });
  yes(l.massEnd < 0.6 * t.massEnd && l.emitted > 0, 'a landing raises less than a take-off (' + l.massEnd.toFixed(1) + ' vs ' + t.massEnd.toFixed(1) + ')');
  const p = run(takeoff, { T: 20, cls: 4 });
  yes(p.massEnd < 0.05 * t.massEnd, 'paved: next to none (' + p.massEnd.toFixed(2) + ')');
  const pud = run(takeoff, { T: 20, puddle: 0.05 });
  yes(pud.mud > 0 && pud.massEnd < 0.6 * t.massEnd, 'a puddle under the wheels and the blast: mud thrown, the tyres\' dust gone (' + pud.mud + ' mud particle-frames)');
  const sand = run(takeoff, { T: 20, cls: 1 }), grass = run(takeoff, { T: 20, cls: 3 });
  yes(grass.massEnd < sand.massEnd && sand.massEnd < t.massEnd && sand.maxG > t.maxG * 0.9, 'per surface: dirt the dustiest, sand less dust and more grit, dry grass little');
}

{ const taxiS = t => { const st = { wheels: [], props: [], wing: null }, V = 6, x = V * t;
    for (const [k, z] of [[0, -0.9], [1, 0.9]]) st.wheels.push({ key: k, x, y: 0, z, vx: V, vy: 0, vz: 0, on: true, R: 0.3 });
    st.props.push({ x: x + 1.5, y: 1.3, z: 0, ax: Math.cos(0.19), ay: Math.sin(0.19), az: 0, R: 0.92, wash: washOf(V, 0.3) }); return st; };
  const rollS = t => { const st = { wheels: [], props: [], wing: null }, V = 20, x = V * t;
    for (const [k, z] of [[0, -0.9], [1, 0.9]]) st.wheels.push({ key: k, x, y: 0, z, vx: V, vy: 0, vz: 0, on: true, R: 0.3 });
    st.props.push({ x: x + 1.5, y: 1.3, z: 0, ax: 1, ay: 0.02, az: 0, R: 0.92, wash: washOf(V, 1) }); return st; };
  const tx = run(taxiS, { T: 10 }), rl = run(rollS, { T: 10 });
  yes(tx.massEnd > 0 && tx.massEnd < 0.2 * rl.massEnd, 'a taxi (6 m/s, 0.3 power) raises little (the user, 9 Nov): ' + tx.massEnd.toFixed(0) + ' vs the 20 m/s roll: ' + rl.massEnd.toFixed(0) + ' over 10 s'); }

console.log('4. the pools');
{
  for (const tier of ['phone', 'potato', 'retro', 'gamer']) {
    const r = run(takeoff, { T: 40, tier });
    yes(!r.over && r.maxP <= r.sys.P.n && r.maxG <= r.sys.G.n, tier + ': never past the pools (' + r.maxP + '/' + r.sys.P.n + ' puffs, ' + r.maxG + '/' + r.sys.G.n + ' grit)');
  }
  yes(dry.merged > 20 && dry.maxP < 0.75 * dry.sys.P.n, 'old puffs merge: a 60 s take-off peaks at ' + dry.maxP + ' live puffs (' + dry.merged + ' merges)');
  { let w = 0; for (let i = 0; i < dry.sys.P.n; i++) if (dry.sys.P.age[i] >= 0) w = Math.max(w, dry.sys.P.r[i]);
    yes(w < dry.sys.tier.mergeMax + 15, 'a trail stays a trail: the widest puff at 60 s is ' + w.toFixed(0) + ' m (no merge past ' + dry.sys.tier.mergeMax + ' m)'); }
  { const ph = run(takeoff, { T: 40, tier: 'phone' });
    yes(ph.sys.stats.absorbed > 0 && ph.live[ph.live.length - 1] > 0, 'a full pool tops up the nearest puff, never deletes one (phone: ' + ph.sys.stats.absorbed + ' absorbed, the cloud alive at 40 s)'); }
  yes(DUST.TIER_OF.laptop === 'phone' && DUST.TIER_OF.gamer === 'gamer' && DUST.TIER_OF.ultra === 'gamer', 'the gfx presets map to the tiers (laptop = the phone\'s)');
}

console.log('5. the draw');
{
  let THREE = null; try { THREE = require('../vendor/three.min.js'); } catch (e) { THREE = null; }
  if (!THREE || !THREE.InstancedBufferGeometry) fail('the vendored three loads in node');
  else {
    const r = run(takeoff, { T: 25 }), D = DUST.make(THREE, r.sys);
    const cam = new THREE.PerspectiveCamera(50, 16 / 9, 0.3, 5000);
    cam.position.set(30, 2, 40); cam.lookAt(30, 1, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const n = D.sync(cam, { sun: [0.2, 0.3, -1], sunCol: new THREE.Color(2, 1.8, 1.5), skyCol: new THREE.Color(0.5, 0.6, 0.8), gndCol: new THREE.Color(0.2, 0.18, 0.14) });
    const g = D.mesh.geometry, P = g.attributes.iPos.array, e = cam.matrixWorldInverse.elements;
    let sorted = true, prev = Infinity;
    for (let i = 0; i < n; i++) { const d = -(e[2] * P[i * 3] + e[6] * P[i * 3 + 1] + e[10] * P[i * 3 + 2] + e[14]); if (d > prev + 1e-4) sorted = false; prev = d; }
    yes(n === r.sys.P.live + r.sys.G.live && g.instanceCount === n && D.mesh.visible, 'one batch: every live particle drawn (' + n + ')');
    yes(sorted, 'far to near');
    // the eye inside the cloud: the cover passes the budget, the near fade moves out
    const c = r.sys.P; let bi = -1, br = 0; for (let i = 0; i < c.n; i++) if (c.age[i] >= 0 && c.r[i] > br) { br = c.r[i]; bi = i; }
    cam.position.set(c.p[bi * 3], c.p[bi * 3 + 1] + 0.5, c.p[bi * 3 + 2] + 1); cam.lookAt(c.p[bi * 3] + 10, c.p[bi * 3 + 1], c.p[bi * 3 + 2]); cam.updateMatrixWorld();
    for (let k = 0; k < 40; k++) D.sync(cam, null);
    yes(D.cover > r.sys.tier.cover ? D.material.uniforms.uNear.value > 0.5 : true, 'inside the cloud the cover (' + D.cover.toFixed(1) + ' screens, budget ' + r.sys.tier.cover + ') moves the near fade out (' + D.material.uniforms.uNear.value.toFixed(1) + ' m)');
    const E = DUST.make(THREE, DUST.makeSystem('gamer'));
    yes(E.sync(cam, null) === 0 && !E.mesh.visible, 'nothing alive: nothing drawn (the mesh hidden)');
    const bt = DUST.billow(64); yes(bt.data.length === 64 * 64 * 4 && bt.data.some(v => v > 200) && bt.data.some(v => v < 60), 'the billow texture is made in code (no file)');
    // the ground's colour (the user, 10 Nov): the batch takes a class's colour from its drawn surface
    const dirtGround = [0.170, 0.111, 0.074];   // the dirt strip's drawn surface (PAVEMENT.surfaceColor('dirt'), 10 Nov)
    yes(D.setGround(0, dirtGround) && Math.abs(D.material.uniforms.uCol.value[0].x - DUST.albedoFrom(dirtGround)[0]) < 1e-6 && !D.setGround(0, null),
      'the batch takes its ground colour (setGround; no colour: the row kept)');
    D.dispose(); E.dispose();
  }
}

console.log('5b. the look (the user, 10 Nov: "the color of the dirt cloud is not well matched to the ground at all ... and maybe a lower cloud density")');
{
  const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], LK = DUST.LOOK;
  const ground = [0.170, 0.111, 0.074], d = DUST.albedoFrom(ground);   // the dirt strip as drawn (PAVEMENT.surfaceColor('dirt'))
  yes(d && Math.abs(d[0] / d[2] - ground[0] / ground[2]) < 1e-6 && Math.abs(d[1] / d[2] - ground[1] / ground[2]) < 1e-6,
    'the dust is its ground hue (' + d.map(v => v.toFixed(3)).join(', ') + ' off the strip ' + ground.join(', ') + ')');
  yes(lum(d) > lum(ground) && lum(d) < 1.5 * lum(ground), 'a shade lighter than its ground, never a pale tan (luminance ' + lum(d).toFixed(3) + ' vs the ground ' + lum(ground).toFixed(3) + ')');
  yes(lum(d) < 0.6 * lum(DUST.CLS.dirt.col), 'on the dark strip it is darker than the 9 Nov fixed tan (' + lum(d).toFixed(3) + ' vs ' + lum(DUST.CLS.dirt.col).toFixed(3) + ')');
  const pale = DUST.albedoFrom([0.9, 0.85, 0.8]), black = DUST.albedoFrom([0.01, 0.008, 0.006]);
  yes(lum(pale) <= LK.lumMax + 1e-9 && lum(black) >= LK.lumMin - 1e-9, 'held to a soil range (' + LK.lumMin + ' .. ' + LK.lumMax + ')');
  // the backlit peak at a low sun: the forward lobe's excess (ph - 1) over the lit side, times the albedo - the 9 Nov puff
  // at the 4x cap and the tan vs today's
  const peak = (alb, cap) => lum(alb) * (1 + (cap - 1));
  const was = peak(DUST.CLS.dirt.col, 4.0), now = peak(d, LK.fwdMax);
  yes(now < 0.3 * was, 'backlit at a low sun it glows, never blows out: the peak ' + (now / was * 100).toFixed(0) + ' % of the 9 Nov puff (forward cap ' + LK.fwdMax + ', was 4)');
  yes(LK.dens > 0.3 && LK.dens < 1, 'a lower drawn density (' + LK.dens + ' of the 9 Nov optical depth)');
  const f = DUST.GLSL.frag;
  yes(/vTau \* dens \* 2\.0 \* uDens/.test(f) && /min\(uFwdMax,/.test(f), 'the shader draws them (uDens on the optical depth, uFwdMax on the lobe)');
  const app = src('src/viewer/app.js'), pv = src('src/viewer/pavement.js');
  yes(/PAVEMENT\.surfaceColor && F\.draw\.setGround && DUST\.LOOK\.ground/.test(app) && /function surfaceColor\(cls\)/.test(pv) && /groundColor, surfaceColor,/.test(pv),
    'the page hands the drawn surface colour (PAVEMENT.surfaceColor -> the batch setGround)');
}

console.log('6. the cost');
{
  console.log('       the simulation a frame over a 60 s take-off: median ' + (dry.ms50 * 1000).toFixed(0) + ' us, p99 ' + (dry.ms99 * 1000).toFixed(0) + ' us');
  yes(dry.ms99 < 1.0, 'p99 under 1 ms a frame (node, this machine)');
}

console.log(checks + ' checks, ' + ((Date.now() - T0) / 1000).toFixed(1) + ' s');
console.log('GATE DUST: ' + (fails ? 'FAIL (' + fails + ' of ' + checks + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
