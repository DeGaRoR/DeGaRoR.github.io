#!/usr/bin/env node
// fleet_b.js - FLEET-PROPS B (G2225-G2229): THE FLEET'S PERF PROOF, the rig. The fleet is the player's six validated
// airframes saved as slots and tied down OUTSIDE at HOME (the ledger's rows: no hangar, aero HOME, no wear), stood on
// HOME's spots by fleet_stand.js from the garage's bakes (parked.js FLEET), behind ?fleet=1.
//   node tools/perf/fleet_b.js pre <out.js>
//        the pre-script: the six slots (flydiy.build.fleet-N-*) and the player document, written before the page's
//        first script - every run states them (rollout_perf --pre @<out.js>, live_driver env PRE)
//   node tools/perf/fleet_b.js setup
//        the garage booted with ?fleet=1 on the profile (env UDD): its roll-out screen's 'parking' step finds no bake
//        and queues the six, the garage's idle path bakes them (the real path: capture + bake + IndexedDB); waits for
//        the store to hold all six under their signatures, prints each bake's time; then blanks the page (IndexedDB
//        flushed) and quits. UNTIMED, but a browser on the GPU: under boxlock gpu.
//   node tools/perf/fleet_b.js still <preset> <outDir> [build] [--timed] [--look <slot>]
//        rolled out at HOME, the pilot taxiing, PAUSED 14 s in: THE SAME FRAME with the fleet's group shown and hidden -
//        the GPU timer (FLIGHT_REC's per-frame column) over 60 frames each, 3 rounds ABAB (--timed: 5 rounds), draws
//        and tris per frame; the still pair (CDP screenshots, the player's chase view and a wide view over the apron);
//        the census of every fleet holder (its level, its distance, drawn or held back by the count); and the CLOSE
//        STILL: the eye within the L1 ring of the nearest prop with the live aeroplane in the same frame
// env: UDD (profile, default D:/ufb), SPORT / DPORT / CPORT (ports, default 8695 / 9495 / 8696), SIZE (2216x1023)
// No --help (an unknown word runs nothing).
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..'), REPO = path.resolve(ROOT, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MODE = process.argv[2];

// ---- THE FLEET: the six validated airframes, slots fleet-1..6 tied down outside at HOME (tools/perf/fleet_b_set.js)
const SET = require('./fleet_b_set.js'), FLEET = SET.FLEET, preScript = SET.preScript;
if (MODE === 'pre') { const out = path.resolve(process.argv[3] || 'fleet_b_pre.js'); fs.writeFileSync(out, preScript()); console.log('-> ' + out); process.exit(0); }
if (MODE !== 'setup' && MODE !== 'still') { console.log('fleet_b.js: pre <out.js> | setup | still <preset> <outDir> [build] [--timed]'); process.exit(2); }

const UDD = process.env.UDD || 'D:/ufb', SPORT = process.env.SPORT || '8695', DPORT = process.env.DPORT || '9495', CPORT = +(process.env.CPORT || 8696);
const SIZE = process.env.SIZE || '2216x1023';
const sh = (c) => { try { return execSync(c, { stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch (e) { return ''; } };
for (const p of [SPORT, DPORT, String(CPORT)]) if (new RegExp(':' + p + '\\s+\\S+\\s+LISTENING').test(sh('netstat -ano -p tcp'))) { console.log('fleet_b: port ' + p + ' is taken (a stale server?) - refusing'); process.exit(2); }
const PRE = path.join(require('os').tmpdir(), 'fleet_b_pre_' + process.pid + '.js');
fs.writeFileSync(PRE, preScript());
const PRESET = MODE === 'still' ? process.argv[3] : null;
const OUT = MODE === 'still' ? path.resolve(process.argv[4] || 'fleet_b_still') : null;
const BUILD = MODE === 'still' ? (process.argv[5] && !process.argv[5].startsWith('--') ? process.argv[5] : 'builds/cub_2026-09-20_corrected.json') : 'builds/cub_2026-09-20_corrected.json';
const TIMED = process.argv.includes('--timed');
const LOOK = (i => (i > 0 ? process.argv[i + 1] : null))(process.argv.indexOf('--look'));   // the close still's prop (a slot), when within reach
const Q = 'fleet=1&gfx=' + (PRESET || 'gamer');   // (the setup on gamer: the cap 6, all six baked)
const drv = spawn(process.execPath, [path.join(ROOT, 'tools', 'live_driver.js'), REPO, BUILD, 'index.html', String(CPORT)],
  { env: Object.assign({}, process.env, { UDD, SPORT, DPORT, SIZE, PRE, Q }), stdio: ['ignore', 'pipe', 'pipe'] });
let up = false;
drv.stdout.on('data', d => { const s = d.toString(); if (/cmd on/.test(s)) up = true; for (const l of s.split('\n')) if (/^EXC|FATAL/.test(l)) console.log('  page: ' + l.slice(0, 240)); });
const quit = async () => { try { await run('location.href = "about:blank"; return 1;'); await sleep(3000); await fetch('http://127.0.0.1:' + CPORT + '/quit'); } catch (e) {} await sleep(500); try { drv.kill(); } catch (e) {} try { fs.unlinkSync(PRE); } catch (e) {} };
const post = async (p, body) => { const r = await fetch('http://127.0.0.1:' + CPORT + p, { method: 'POST', body }); return r.text(); };
const run = async body => { const t = await post('/run', body); try { return JSON.parse(t); } catch (e) { return t; } };
const until = async (cond, ms, what) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await run('return !!(' + cond + ');')) === true) return Date.now() - t0; await sleep(500); } throw new Error('timed out: ' + what); };
const frames = n => run(`await new Promise(r => { let k = ${n}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); }); return 1;`);
const held = () => run('return !!window.FLYDIY_HELD;');
const pause = async on => { if ((await held()) !== on) { await run(`document.getElementById('bPause').click(); return 1;`); await frames(4); } };
// A STILL IS EVIDENCE ONLY ONCE THE PAGE IS LOADED (the user, via the game coordinator: "you keep screenshotting loading
// screens"): the boot overlay gone - BOOT.state 'gone', #boot carrying .gone AND hidden (boot.js hides it 700 ms after) -
// read off the page's state, not off what is visible (hideUI hides the overlay too). Asserted before every still, then
// 2 s, then again; asserted after the shot too. A shot that meets the overlay is discarded (never saved) and retried.
const LOADED = `const b = document.getElementById('boot'); return !!(window.BOOT && BOOT.state === 'gone' && b && b.classList.contains('gone') && b.hidden);`;
const shot = async f => {
  for (let i = 0; i < 5; i++) {
    if ((await run(LOADED)) === true) {
      await sleep(2000); await frames(4);
      if ((await run(LOADED)) === true) {
        await fetch('http://127.0.0.1:' + CPORT + '/shot?f=' + encodeURIComponent(f));
        if ((await run(LOADED)) === true) return f;
        try { fs.unlinkSync(f); } catch (e) {}
      }
    }
    console.log('  still discarded (the page was not loaded): ' + path.basename(f) + ' - retry ' + (i + 1));
    await sleep(3000);
  }
  throw new Error('the page never stayed loaded for ' + path.basename(f) + ': no still saved');
};
const hideUI = () => run(`const c = document.getElementById('c'); document.querySelectorAll('body *').forEach(e => { if (e !== c && !e.contains(c) && e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; }); return 1;`);
// what the page says it is: the build id, the fleet's state, the bakes, the stand
const STATE = `const P = window.PARKED, F = P && P.fleet, S = window.FLEET_STAND && FLEET_STAND.state, G = window.GFX && GFX.get();
  return { build: window.FLYDIY_BUILD || null, fleetOn: !!(P && P.fleetOn && P.fleetOn()), preset: G && G.preset, gfxBuild: G && G.build,
    stats: F ? F.stats : null, queue: F ? F.queue.slice() : null, busy: F ? F.busy : null, why: F ? F.why : null,
    stand: S ? { key: S.key, n: S.holders.length, miss: S.plan ? S.plan.miss : null, stats: S.stats } : null };`;
// every fleet holder: its slot, the level it draws (index into its LOD; -1 none), its distance to the eye, its drawn tris
const CENSUS = `const S = FLEET_STAND.state, cam = FLIGHT_PROBE.camera ? FLIGHT_PROBE.camera() : null;
  const out = []; for (const h of S.holders) { const lod = h.children[0]; const e = h.matrixWorld.elements;
    const lv = lod ? lod.levels.findIndex(l => l.object.visible) : -1;
    out.push({ slot: h.userData.fleetSlot, filled: !!lod, level: lv, ladder: lod ? lod.levels.map(l => Math.round(l.distance)) : null,
      d: cam ? +Math.hypot(e[12] - cam.position.x, e[13] - cam.position.y, e[14] - cam.position.z).toFixed(1) : null,
      tris: lod ? Math.round(PARKED.trisOf(h)) : 0 }); }
  return out;`;

(async () => {
  for (let i = 0; i < 100 && !up; i++) await sleep(300);
  if (!up) throw new Error('the driver did not come up');
  const t0 = Date.now();
  await until(`window.BOOT && BOOT.state === 'gone'`, 900000, 'the garage boot');
  console.log('garage up in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s; ' + JSON.stringify(await run(STATE)));
  if (MODE === 'setup') {
    // THE BAKES: the boot's 'parking' step asked for six bakes that did not exist; the garage's idle path makes them
    // the bakes' own cost in the garage: every main-thread task over 50 ms from now on (the capture is ONE task by design)
    await run(`window.__fbLT = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__fbLT.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask' }); } catch (e) {} window.__fbT0 = performance.now(); return 1;`);
    const tb = Date.now();
    await until(`(() => { const F = PARKED.fleet; return !F.busy && !F.queue.length && !F.timer && (F.stats.stored + F.stats.hits) >= 6; })()`, 600000, 'the six bakes');
    console.log('bakes drained in ' + ((Date.now() - tb) / 1000).toFixed(1) + ' s');
    const lt = await run(`return (window.__fbLT || []).filter(t => t[0] >= window.__fbT0).sort((a, b) => b[1] - a[1]);`);
    console.log('garage long tasks while baking: ' + lt.length + ', worst ' + (lt[0] ? lt[0][1] : 0) + ' ms; over 1 s: ' + lt.filter(t => t[1] > 1000).length + '; all: ' + JSON.stringify(lt.slice(0, 20)));
    // the store holds all six under the slots' signatures now
    const chk = await run(`const P = PARKED, out = {}; for (const n of ${JSON.stringify(FLEET.map(f => f[0]))}) { const k = 'mine:' + n, sp = P.specOf(k);
      const sig = P.fleetSig(sp, GARAGE_SPEC.slotImages(n)); const v = await new Promise(res => { const rq = indexedDB.open('flydiy.parked'); rq.onsuccess = () => { const d = rq.result;
        try { const g = d.transaction('fleet', 'readonly').objectStore('fleet').get(k); g.onsuccess = () => res(g.result || null); g.onerror = () => res(null); } catch (e) { res(null); } }; rq.onerror = () => res(null); });
      out[n] = v ? { ok: v.sig === sig, kb: Math.round(v.n / 1024), gz: Math.round(v.bytes.byteLength / 1024 || v.bytes.length / 1024) } : null; } return out;`);
    console.log('store: ' + JSON.stringify(chk));
    console.log('boot log (fleet): ' + JSON.stringify(await run(`return (window.BOOT && BOOT.log || []).filter(e => /fleet|bake/.test(JSON.stringify(e))).slice(-20);`)));
    console.log('state: ' + JSON.stringify(await run(STATE)));
    // THE BOUND (the game coordinator): a 40-build sandbox - 34 more saves through the garage's own door (the lift ties
    // the ones past the hangar's slots down outside at HOME, after the six by name) - must queue no bake (the drawn set is
    // the six), and the wait shows no capture; the extra slots are deleted after (the profile stays the six)
    const B = await run(`const F = PARKED.fleet, S = F.stats, G = GARAGE_SPEC, q0 = S.queued, c0 = S.captures, n0 = S.notWanted, t0 = performance.now();
      for (let i = 1; i <= 34; i++) G.save('zz-' + String(i).padStart(2, '0'));
      const sv = performance.now() - t0;
      await new Promise(r => setTimeout(r, 12000));
      const d = FLYDIY_PLAYER.doc(), out = Object.keys(d.fleet).filter(n => !d.fleet[n].hangar && d.fleet[n].aero === 'HOME').length;
      const r = { saves: 34, slots: Object.keys(d.fleet).length, outsideAtHome: out, queued: S.queued - q0, captures: S.captures - c0, notWanted: S.notWanted - n0, saveMs: Math.round(sv),
        wants: Object.keys(d.fleet).filter(n => FLEET_STAND.wants('mine:' + n)) };
      for (let i = 1; i <= 34; i++) localStorage.removeItem('flydiy.build.zz-' + String(i).padStart(2, '0'));
      return r;`);
    console.log('THE BOUND, a 40-build sandbox: ' + JSON.stringify(B));
    const bad = Object.values(chk).filter(v => !v || !v.ok).length;
    console.log('FLEET-B SETUP: ' + (bad ? 'INCOMPLETE (' + bad + ' of 6 not baked)' : 'six bakes stored'));
    await quit(); process.exit(bad ? 1 : 0);
  }
  // ---- STILL: roll out at HOME, the pilot taxiing, paused 14 s in --------------------------------------------------------
  fs.mkdirSync(OUT, { recursive: true });
  const info = { date: new Date().toISOString(), preset: PRESET, build: BUILD, timed: TIMED, size: SIZE, rounds: [], shots: [] };
  await run(`const b = document.getElementById('bGo'); b.style.visibility = ''; b.click(); return 1;`);
  await until(`window.BOOT && BOOT.state === 'gone' && /Fly the circuit/.test((document.getElementById('bGo') || {}).textContent || '') && window.FLIGHT_PROBE && FLIGHT_PROBE.model()`, 900000, 'the roll-out');
  info.state = await run(STATE);
  console.log('rolled out; ' + JSON.stringify(info.state));
  await frames(90); await sleep(2000);
  await run(`try { DAY_CLOCK.preset('noon'); DAY_CLOCK.set({ rate: 0 }); } catch (e) {} return 1;`);
  // THE CLOSE STILL first, on the stand: the eye toward the nearest prop, 9 m off the live aeroplane (inside L1's 30 m)
  await pause(true); await hideUI(); await frames(20);
  const near = await run(`const s = FLIGHT_PROBE.sim(), cg = s.cgPos(); let best = null;
    const want = ${JSON.stringify(LOOK)};
    for (const h of FLEET_STAND.state.holders) { const e = h.matrixWorld.elements, d = Math.hypot(e[12] - cg[0], e[14] - cg[2]);
      const pref = want && h.userData.fleetSlot === want && d < 28;
      if (!best || pref || (!best.pref && d < best.d)) best = { slot: h.userData.fleetSlot, d, x: e[12], z: e[14], pref }; }
    if (!best) return null; best.az = Math.atan2(best.z - cg[2], best.x - cg[0]); return best;`);
  info.near = near;
  if (near) {
    // the eye on the far side of the live aeroplane from the prop, a little round: both in the frame, the prop inside L1's ring
    await run(`FLIGHT_PROBE.camSet(${near.az} + 2.6, 0.10, 7); return 1;`);   // the eye 7 m out, 149 deg off the prop: ~28 m from a prop 22 m off (L1), ~24 deg off the axis await frames(30); await sleep(400);
    info.close = await run(CENSUS);
    info.shots.push({ f: 'close_l1_' + PRESET + '.png', census: info.close }); await shot(path.join(OUT, 'close_l1_' + PRESET + '.png'));
    console.log('close still: nearest prop ' + near.slot + ' at ' + near.d.toFixed(1) + ' m from the aeroplane; ' + JSON.stringify(info.close.filter(c => c.slot === near.slot)));
  }
  // THE TAXI: the pilot's circuit, paused 14 s in
  await pause(false);
  await run(`try { FLIGHT_PROBE.camMode('chase'); } catch (e) {} const b = document.getElementById('bGo'); b.click(); return 1;`);
  await sleep(14000);
  await pause(true); await hideUI(); await frames(30); await sleep(500);
  const N = 60, rounds = TIMED ? 5 : 3;
  const measure = async on => {
    await run(`FLEET_STAND.state.grp.visible = ${on}; return 1;`);
    await frames(20);
    return run(`const R = FLIGHT_REC.rec, f0 = R.frame; await new Promise(r => { let k = ${N}; const f = () => (--k > 0 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); });
      const g = [], c = [], t = []; for (let f = f0; f < R.frame; f++) { const r = R.row(f); if (r.gpu === r.gpu) g.push(r.gpu); c.push(r.calls); t.push(r.tris); }
      const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
      return { on: ${on}, n: g.length, gpu: med(g) != null ? +med(g).toFixed(3) : null, gpuMean: g.length ? +(g.reduce((a, b) => a + b, 0) / g.length).toFixed(3) : null, calls: med(c), tris: med(t) };`);
  };
  // the timing too only on a LOADED page (the overlay gone): waited for, else the run says so
  for (let i = 0; i < 30 && (await run(LOADED)) !== true; i++) await sleep(1000);
  info.loadedAtTiming = (await run(LOADED)) === true;
  if (!info.loadedAtTiming) throw new Error('the page is not loaded (the boot overlay): no timing taken');
  for (const view of ['chase', 'apron']) {
    if (view === 'apron') {
      // the wide view: the eye up and back over the apron, toward the props' centre
      await run(`const s = FLIGHT_PROBE.sim(), cg = s.cgPos(); let x = 0, z = 0, n = 0; for (const h of FLEET_STAND.state.holders) { const e = h.matrixWorld.elements; x += e[12]; z += e[14]; n++; }
        const az = n ? Math.atan2(z / n - cg[2], x / n - cg[0]) : 0; FLIGHT_PROBE.camSet(az + Math.PI, 0.32, 40); return 1;`);
      await frames(30);
    }
    for (let r = 0; r < rounds; r++) for (const on of r % 2 ? [false, true] : [true, false]) { const m = await measure(on); m.view = view; m.round = r; info.rounds.push(m); }
    // the still pair: the same held frame, the fleet shown then hidden
    for (const on of [true, false]) {
      await run(`FLEET_STAND.state.grp.visible = ${on}; return 1;`); await frames(12); await sleep(300);
      const f = 'taxi_' + view + '_' + PRESET + '_' + (on ? 'fleet6' : 'fleet0') + '.png';
      await shot(path.join(OUT, f)); info.shots.push({ f, on, view });
    }
    await run(`FLEET_STAND.state.grp.visible = true; return 1;`); await frames(12);
    info['census_' + view] = await run(CENSUS);
  }
  // the numbers: per view, the median of the rounds' medians, shown - hidden
  const med = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  info.summary = {};
  for (const view of ['chase', 'apron']) {
    const R = info.rounds.filter(m => m.view === view);
    const on = R.filter(m => m.on), off = R.filter(m => !m.on);
    info.summary[view] = { gpuOn: med(on.map(m => m.gpu)), gpuOff: med(off.map(m => m.gpu)), dGpu: +(med(on.map(m => m.gpu)) - med(off.map(m => m.gpu))).toFixed(3),
      callsOn: med(on.map(m => m.calls)), callsOff: med(off.map(m => m.calls)), trisOn: med(on.map(m => m.tris)), trisOff: med(off.map(m => m.tris)),
      drawn: (info['census_' + view] || []).filter(c => c.level >= 0).length, levels: (info['census_' + view] || []).map(c => c.slot.replace('fleet-', '') + ':L' + (c.level >= 0 ? c.level : '-')).join(' ') };
    console.log(view + ': GPU ' + info.summary[view].gpuOn + ' ms with the fleet, ' + info.summary[view].gpuOff + ' without (' + (info.summary[view].dGpu >= 0 ? '+' : '') + info.summary[view].dGpu + ' ms); calls ' + info.summary[view].callsOff + ' -> ' + info.summary[view].callsOn + '; tris ' + info.summary[view].trisOff + ' -> ' + info.summary[view].trisOn + '; drawn ' + info.summary[view].drawn + ' [' + info.summary[view].levels + ']');
  }
  info.stateEnd = await run(STATE);
  const jf = path.join(OUT, 'still_' + PRESET + '.json');
  fs.writeFileSync(jf, JSON.stringify(info, null, 1));
  console.log('-> ' + jf);
  await quit(); process.exit(0);
})().catch(async e => { console.error('fleet_b: ' + (e && e.stack || e)); try { console.log('state: ' + JSON.stringify(await run(STATE))); } catch (e2) {} await quit(); process.exit(1); });
