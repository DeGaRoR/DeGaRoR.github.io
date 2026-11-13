#!/usr/bin/env node
// GATE TESTFIELD (G3790-G3794, PHONE-TESTFLIGHT): THE TEST FIELD - the flat world the phone's test flight flies on and the
// desktop's GRAPHICS > World pills offer ("Test field"). The user, 27 Oct: "On the phone, I think I'd still like a test
// flight ... 1 building, 1 runway, and some infinite thing. Only ability is to do a circuit ... We should also be able to
// run the checks."
//
// What is held:
//   THE WORLD     makeWorld(0, { flat: true }): the ground 0 at the strip, at the domain's corners and past them; HOME
//                 alone (the analytic record: the same place, heading, length, touchdown zone and site, whose hangar is
//                 the one building); no water anywhere (waterH -Infinity, no reach, no lake), no settlement, road or
//                 building box, no generated strip, no tree; every surface off the strip GRASS; world.flat says so.
//                 SMALL: made in < 100 ms with < 8 MB of heap (the phone's ceiling - the island's ~2 GB killed Chrome
//                 on the S20, 2 Oct); the analytic world's made beside it for the number.
//   THE TRUNK     without the switch the analytic world is untouched (its HOME, its SEA lane, its trees, its water:
//                 GATE WORLD holds the goldens; this checks the switch is not on by default).
//   THE CIRCUITS  the Cub, the Jodel and the Cessna 172 (the validated builds, as the game loads them) each fly the
//                 pilot's own circuit off HOME on the flat world and ARRIVE: STOPPED, outcome completed, stopped at HOME,
//                 no crash, a touchdown under 3 m/s. And the Cub flies the SAME circuit on the analytic world: the
//                 flat field flies as the field the pilot was tuned on (arrival time within 3 s, the same phases).
//   THE PAGE      the loader publishes { id: 'testfield', name: 'Test field' } and boots it (no island fetched); the
//                 world's boot passes flat; the physics worker makes the same flat world (sim_link's world message);
//                 the phone profile's flight variant boots the test field.
//
//   node tools/_testfield_check.js            the gate
//   node tools/_testfield_check.js --fly <k>  one flight, as a JSON line (the gate's child process; k: cub, jodel, c172, cubA)
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');

const FILES = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
                c172: 'tools/fixtures/test_copies/cessna172_2026-09-20_corrected.json' };
const FLIGHTS = { cub: { build: 'cub', flat: true }, jodel: { build: 'jodel', flat: true }, c172: { build: 'c172', flat: true },
                  cubA: { build: 'cub', flat: false } };

// ONE FLIGHT: the pilot's own circuit off HOME, as GATE ACCEPT's flight starts one (settled 10 s, makePilot)
function fly(name) {
  const K = FLIGHTS[name];
  if (!K) throw new Error('unknown flight ' + name);
  const L = require(path.join(T, '_treecrash_lib.js')), LB = require(path.join(T, '_load_build.js')), C = L.core();
  const wall0 = Date.now();
  const def = C.buildGen(C.genMigrateSpec(LB.loadBuild(FILES[K.build]).spec));
  const W = K.flat ? C.makeWorld(0, { flat: true }) : C.makeWorld();
  const sim = C.makeSim(def, W); sim.reset(0);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, W);
  const phases = [];
  let n = 0, last = '', bad = false;
  while (ap.phase !== 'STOPPED' && n++ < 60 * 900) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (sim.stats().bad) { bad = true; break; }
    if (ap.phase !== last) { last = ap.phase; phases.push([Math.round(ap.t), last]); }
  }
  const cg = sim.cgPos(), td = ap.tdInfo, D = sim.damage ? sim.damage() : null;
  return { name, flat: K.flat, bad, phase: ap.phase, outcome: (ap.report && ap.report.outcome) || null, t: Math.round(ap.t),
           at: C.acceptStopAt ? C.acceptStopAt(W, cg[0], cg[2]) : null, sink: td ? +td.sink.toFixed(2) : null,
           V: td ? +(td.V * 3.6).toFixed(0) : null, crashed: !!(D && D.crashed), reason: D ? D.reason : null, phases,
           wallMs: Date.now() - wall0 };
}

function flyAll() {
  const names = Object.keys(FLIGHTS), out = {};
  return Promise.all(names.map(name => new Promise(res => {
    const p = cp.spawn(process.execPath, [__filename, '--fly', name], { stdio: ['ignore', 'pipe', 'pipe'] });
    let so = '', se = '';
    p.stdout.on('data', d => { so += d; }); p.stderr.on('data', d => { se += d; });
    p.on('close', code => {
      const line = so.trim().split('\n').filter(s => s.startsWith('{')).pop();
      try { out[name] = JSON.parse(line); } catch (e) { out[name] = { name, error: 'exit ' + code + ': ' + (se || so).trim().split('\n').slice(-3).join(' | ') }; }
      res();
    });
  }))).then(() => out);
}

async function main() {
  const L = require(path.join(T, '_treecrash_lib.js')), C = L.core();
  let checks = 0, fails = 0;
  const check = (ok, what) => { checks++; if (!ok) fails++; console.log('  ' + (ok ? 'ok  ' : 'FAIL') + ' ' + what); };

  // ---- THE WORLD
  console.log('THE WORLD');
  const flights = flyAll();   // the four in their own processes meanwhile
  if (global.gc) global.gc();
  const h0 = process.memoryUsage().heapUsed, t0 = Date.now();
  const F = C.makeWorld(0, { flat: true });
  const msF = Date.now() - t0, mbF = (process.memoryUsage().heapUsed - h0) / 1e6;
  const t1 = Date.now(), A = C.makeWorld(), msA = Date.now() - t1;
  console.log('  made in ' + msF + ' ms, ' + mbF.toFixed(1) + ' MB of heap (the analytic world: ' + msA + ' ms)');
  check(F.flat === true && A.flat === false, 'world.flat: true on the test field, false on the analytic world');
  check(msF < 100, 'the test field is made in < 100 ms (' + msF + ')');
  check(mbF < 8, 'the test field takes < 8 MB of heap (' + mbF.toFixed(1) + ')');
  const pts = [[-520, 0], [0, 0], [3000, -5000], [-6460, -2680], [0, 2000], [11999, 11999], [-12000, 12000], [30000, -40000]];
  check(pts.every(([x, z]) => F.terrainH(x, z) === 0), 'the ground is 0 at the strip, the old peak, the old sea, the corners and past them');
  check(pts.every(([x, z]) => F.waterH(x, z) === -Infinity), 'no water anywhere (waterH -Infinity)');
  check(F.aerodromes.length === 1 && F.aerodromes[0].id === 'HOME', 'HOME alone in the registry (' + F.aerodromes.map(a => a.id).join(', ') + ')');
  const hA = A.aerodromes.find(a => a.id === 'HOME'), hF = F.aerodromes[0];
  check(['x', 'z', 'hdg', 'len', 'wid', 'elev', 'surface'].every(k => hF[k] === hA[k]) && JSON.stringify(hF.tdz) === JSON.stringify(hA.tdz),
        'HOME is the analytic record: place, heading, length, width, elevation, surface, touchdown zone');
  const site = typeof C.siteOf === 'function' ? C.siteOf('HOME') : (typeof C.AIRFIELD_SITE !== 'undefined' ? C.AIRFIELD_SITE : null);
  if (site) check(!!site.hangar && (site.buildings || []).length === 0, 'its site: the hangar, the one building');
  check(F.trees.length === 0 && F.treesNear(-520, 0, []).length === 0, 'no tree (' + F.trees.length + ')');
  check(F.settlements.length === 0 && F.roadNet.roads.length === 0 && F.roadNet.buildings.length === 0, 'no settlement, road or building box');
  check(F.genStrips.n === 0 && F.hydro.rivers.length === 0 && F.hydro.lakeCount === 0, 'no generated strip, no river, no lake');
  check(pts.every(([x, z]) => F.surface(x, z) === F.SURFACE.GRASS), 'grass everywhere off the strip and on it (HOME is a grass strip)');
  // ---- THE TRUNK
  console.log('THE TRUNK');
  check(!!A.aerodromes.find(a => a.id === 'SEA') && A.trees.length > 1000 && A.hydro.rivers.length > 0 && A.terrainH(-6460, -2680) > 100,
        'without the switch the analytic world stands whole (SEA, ' + A.trees.length + ' trees, ' + A.hydro.rivers.length + ' reaches, the peak)');
  const B = C.makeWorld(0, {});
  check(B.flat === false && B.aerodromes.length === A.aerodromes.length, 'makeWorld(0, {}) is the analytic world');

  // ---- THE PAGE (the source the page runs)
  console.log('THE PAGE');
  const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const build = rd('tools/build.js'), wb = rd('src/viewer/world_boot.js'), link = rd('src/viewer/sim_link.js'), prof = rd('src/viewer/profile.js');
  check(/\{ id: 'testfield', name: 'Test field' \}/.test(build), 'the loader publishes the Test field in FLYDIY_WORLDS');
  check(/name === 'testfield'/.test(build), 'the loader boots the test field (no island fetched)');
  check(/flat: window\.FLYDIY_WORLD === 'testfield'/.test(wb), 'the world\'s boot passes flat on the test field');
  check(/flat: !!world\.flat/.test(link), 'the physics worker makes the same flat world');
  check(/boot: 'testfield'/.test(prof) && /flydiy\.phone\.fly/.test(prof), 'the phone\'s flight variant boots the test field (the sessionStorage intent)');

  // ---- THE CIRCUITS
  console.log('THE CIRCUITS');
  const R = await flights;
  for (const k of ['cub', 'jodel', 'c172']) {
    const f = R[k];
    if (f.error) { check(false, k + ': ' + f.error); continue; }
    console.log('  ' + k + ': ' + f.phase + ' ' + f.outcome + ' at ' + f.at + ', ' + f.t + ' s, touchdown ' + f.sink + ' m/s at ' + f.V + ' km/h (' + (f.wallMs / 1000).toFixed(0) + ' s wall)');
    check(!f.bad && !f.crashed && f.phase === 'STOPPED' && f.outcome === 'completed' && f.at === 'HOME' && f.sink != null && f.sink < 3,
          k + ' flies the circuit on the test field and arrives' + (f.crashed ? ' (crashed: ' + f.reason + ')' : ''));
  }
  const a = R.cubA, f = R.cub;
  if (a && !a.error && f && !f.error) {
    console.log('  cub on the analytic world: ' + a.phase + ' ' + a.outcome + ' at ' + a.at + ', ' + a.t + ' s');
    check(Math.abs(a.t - f.t) <= 3 && a.phases.map(p => p[1]).join() === f.phases.map(p => p[1]).join(),
          'the Cub flies the same circuit on the analytic world (' + a.t + ' s vs ' + f.t + ' s, the same phases)');
  } else check(false, 'the Cub A/B: ' + ((a && a.error) || (f && f.error) || 'no flight'));
  try { fs.mkdirSync(path.join(ROOT, 'reports', 'evidence', 'TESTFIELD'), { recursive: true });
        fs.writeFileSync(path.join(ROOT, 'reports', 'evidence', 'TESTFIELD', 'flights.json'), JSON.stringify(R, null, 1)); } catch (e) {}

  console.log('  ' + checks + ' checks, ' + fails + ' failed');
  console.log('GATE TESTFIELD: ' + (fails === 0 ? 'PASS' : 'FAIL'));
  process.exitCode = fails === 0 ? 0 : 1;
}

if (process.argv[2] === '--fly') { console.log(JSON.stringify(fly(process.argv[3]))); }
else main().catch(e => { console.log(String(e && e.stack || e)); console.log('GATE TESTFIELD: FAIL'); process.exitCode = 1; });
