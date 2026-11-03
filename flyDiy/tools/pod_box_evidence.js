#!/usr/bin/env node
// pod_box_evidence.js - BELLY-POD-2 (G3467) ON THE BOX'S GPU: THE GARAGE STILLS AND A BELLY LANDING. The cloud session
// that built the pod cannot render: this is A0's script. A client of tools/live_driver.js (a headed Chrome on the box's
// GPU, driven over 127.0.0.1:<cmd>), the real page with the damage layer on. TAKE THE GPU LOCK FIRST
// (tools/perf/boxlock.sh take gpu <who>), drop it after.
//   UDD="$(node -p "require('path').join(require('os').tmpdir(), 'pod2')")" SPORT=8581 DPORT=9481 Q='damage=1' \
//     node tools/live_driver.js <root> default dev.html 8582 &
// (the Chrome profile under the temp dir - a short path, its own localStorage, thrown away after - never C:/<name>)
//   node tools/pod_box_evidence.js [--cmd 8582] [--out reports/evidence/POD3] [--only garage|belly]
//
// GARAGE (no damage needed): on each build, loaded with no pod, the tree's "Belly pod" node opened, fitted from the
// section's own box, sized from its volume slider, the readouts awaited (off "measuring"), the camera low on the quarter:
//   cub      the user's Cub, a 160 L pod                       garage_cub.jpg (+ _plaque: the plaque's belly-pod rows)
//   metal    the user's metal Cessna as the fixture has it     garage_metal.jpg (+ _plaque)
//            (tools/fixtures/cessnaMetal_pod_2026-10-22.json: 200 L, 2.52 x 0.63 x 0.32 m)
//   jodel    the default pod - REFUSED in red (full, the static margin negative)    garage_jodel.jpg
//   cub      unticked: the key gone from the spec, nothing drawn                      garage_cub_off.jpg
// LOOK FOR: the pod under the belly in the body's colour (the Cub yellow; the metal Cessna bare metal - its livery's rule),
// its walls into the drawn skin with no gap or step, its nose fairing and boat-tail, its shadow; the section's rows in the
// --ed look; the "cost" line (take-off / climb / cruise); the plaque's "pod cost" row.
//
// BELLY (damage on): the metal Cessna with a DEEP pod (0.45 m: 0.06 m clear level, under the ground rotated - the flare
// finds it), rolled out, the circuit flown by the autopilot; in the flare a firm arrival (+1.5 m/s sink, FLIGHT_PROBE
// .place's dv, once under 1.5 m); stills every 0.5 s from the pod's first touch to the stop, from the chase camera, then
// the integrity record (sim.damage().structural: its `pod` verdict - state, freight, worn mm, slid m) and the frame times.
// EXPECTED (node, the same core, tools/_dmg_pod_check.js's way): the pod scrapes on its aft pair, worn ~1 mm, 'ground'
// (freight safe) - or 'crushed' (freight at risk) if the arrival is harder; never 'the landing gear broke' in the card.
// LOOK FOR: the pod staying on the belly while it scrapes (the drawn shell rides its own four nodes once something breaks:
// app.js brkInhStep), the ground's scar under it (DMG-SCAR), the card's words, no frame spike at the first touch.
// -> <out>/*.jpg, <out>/pod_box.json
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const CMD = +opt('cmd', 8582), ONLY = opt('only', null);
const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(opt('out', path.join(ROOT, 'reports', 'evidence', 'POD3')));
const post = (route, body) => new Promise((res, rej) => {
  const r = http.request({ host: '127.0.0.1', port: CMD, path: route, method: 'POST' }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => res(b)); });
  r.on('error', rej); r.setTimeout(600000, () => r.destroy(new Error('timeout'))); r.end(body);
});
const get = route => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: CMD, path: route }, s => { let b = ''; s.on('data', d => b += d); s.on('end', () => res(b)); }).on('error', rej));
const run = async (fn, arg) => { const b = await post('/run', 'return await (' + fn.toString() + ')(' + JSON.stringify(arg == null ? null : arg) + ');'); try { return JSON.parse(b); } catch (e) { return b; } };
const shot = f => get('/shot?f=' + encodeURIComponent(path.join(OUT, f)));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms, arg) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await run(fn, arg) === true) return true; } catch (e) {} await sleep(500); } return false; };
// the builds as the game flies them (tools/_load_build.js: the page's own load chain - GATE JOINPARITY's rule); the fixture is
// already that (tools/pod_fixture.js writes it from the chain)
const LB = require('./_load_build.js');
const specOf = f => /fixtures\//.test(f) ? (j => j.spec || j)(JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'))) : LB.loadBuild(f).spec;

const out = { garage: [], belly: null, errors: [] };
async function garage() {
  const B = [
    { k: 'cub', spec: specOf('builds/cub_2026-09-20_corrected.json'), litres: 160 },
    { k: 'metal', spec: specOf('tools/fixtures/cessnaMetal_pod_2026-10-22.json'), litres: null, keep: true },
    { k: 'jodel', spec: specOf('builds/jodel_2026-09-20_corrected.json'), litres: null },
  ];
  for (const b of B) {
    const s = JSON.parse(JSON.stringify(b.spec)); if (!b.keep) delete s.pod;
    await run(sp => { window.GARAGE_SPEC.set(sp); return true; }, s);
    await until(() => !!(window.GARAGE_SPEC.resolved && window.GARAGE_SPEC.resolved()), 120000);
    await sleep(3000);
    await run(() => { const n = document.querySelector('#edTree .edN[data-p="pod"]'); if (n) n.click(); return !!n; });
    await until(() => !!document.getElementById('p_pod_on'), 20000);
    if (!b.keep) await run(() => { const c = document.getElementById('p_pod_on'); c.checked = true; c.onchange(); return true; });
    await until(() => !!window.CAGE_POD_MESH, 60000);
    if (b.litres) await run(L => { const i = document.getElementById('p_pod_litres'); i.value = L; i.oninput(); i.onchange(); return true; }, b.litres);
    await until(() => { const s = document.querySelector('.edRoot[data-panel="pod"]'); return !!s && !/measuring/.test(s.innerText); }, 180000);
    await run(() => { window.FLIGHT_PROBE.camSet(3.9, -0.1, 12); return true; });
    await sleep(2500);
    await shot('garage_' + b.k + '.jpg');
    const st = await run(() => { const sec = document.querySelector('.edRoot[data-panel="pod"]'), sp = window.GARAGE_SPEC.get();
      return { pod: sp.pod || null, panel: sec ? sec.innerText.replace(/\n+/g, ' | ') : null, red: sec ? [...sec.querySelectorAll('.podWhy.bad')].map(e => e.textContent) : [],
               mesh: window.CAGE_POD_MESH ? { nt: window.CAGE_POD_MESH.nt } : null,
               plaque: (() => { const r = document.getElementById('pqRows'); return r ? r.innerText.split('\n').filter(l => /pod/.test(l)) : []; })() }; });
    await run(() => { const p = document.getElementById('plaque'); if (p) p.scrollIntoView(); return true; });
    await sleep(800);
    await shot('garage_' + b.k + '_plaque.jpg');
    out.garage.push(Object.assign({ build: b.k }, st));
    console.log(b.k + ': ' + JSON.stringify(st).slice(0, 600));
  }
  await run(() => { const c = document.getElementById('p_pod_on'); if (c) { c.checked = false; c.onchange(); } return true; });
  await sleep(3000);
  await shot('garage_cub_off.jpg');
  out.garage.push(Object.assign({ build: 'off' }, await run(() => ({ hasPod: 'pod' in window.GARAGE_SPEC.get(), mesh: !!window.CAGE_POD_MESH }))));
}

async function belly() {
  const s = specOf('tools/fixtures/cessnaMetal_pod_2026-10-22.json'); s.pod = Object.assign({}, s.pod, { depth: 0.45 });
  await run(sp => { window.GARAGE_SPEC.set(sp); return true; }, s);
  await until(() => !!(window.GARAGE_SPEC.resolved && window.GARAGE_SPEC.resolved()), 120000);
  await sleep(3000);
  await run(() => { document.getElementById('bGo').click(); return true; });                       // roll out
  await until(() => window.BOOT && window.BOOT.state === 'gone', 600000);
  await sleep(4000);
  await run(() => { document.getElementById('bGo').click(); return true; });                       // fly the circuit
  const T = { kicked: false, first: null, shots: 0, frames: [] };
  const t0 = Date.now();
  while (Date.now() - t0 < 15 * 60000) {
    const r = await run(() => { const P = window.FLIGHT_PROBE, sim = P.sim(), ap = P.ap(), D = sim.damage ? sim.damage() : null, S = D && D.structural;
      let ymin = 1e9; for (let i = 0; i < sim.n; i++) ymin = Math.min(ymin, sim.p[i * 3 + 1]);
      const W = P.world(), c = sim.cgPos(), gH = W && W.terrainH ? W.terrainH(c[0], c[2]) : 0;   // (the lowest node over the ground)
      return { phase: ap && ap.phase, agl: ymin - gH, t: sim.t, pod: S && S.pod ? S.pod : null, why: S ? S.why : null, over: P.over() }; });
    if (!T.kicked && r.phase === 'FLARE' && r.agl != null && r.agl < 1.5) { await run(() => { window.FLIGHT_PROBE.place({ dv: [0, -1.5, 0] }); return true; }); T.kicked = true; }
    if (r.pod && r.pod.touched && T.first == null) T.first = r.t;
    if (T.first != null && T.shots < 30) { await shot('belly_' + String(T.shots).padStart(2, '0') + '.jpg'); T.shots++; T.frames.push(r); }
    if (r.phase === 'STOPPED' || r.over) { out.belly = Object.assign({ final: r }, T); break; }
    await sleep(T.first != null ? 500 : 250);
  }
  await shot('belly_end.jpg');
  console.log('belly: ' + JSON.stringify(out.belly && out.belly.final).slice(0, 800));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  if (ONLY !== 'belly') await garage();
  if (ONLY !== 'garage') await belly();
  fs.writeFileSync(path.join(OUT, 'pod_box.json'), JSON.stringify(out, null, 1));
  console.log('pod_box_evidence: wrote ' + path.join(OUT, 'pod_box.json'));
})().catch(e => { console.log(String(e && e.stack || e)); process.exitCode = 1; });
