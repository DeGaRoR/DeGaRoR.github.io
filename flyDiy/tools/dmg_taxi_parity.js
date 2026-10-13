#!/usr/bin/env node
// DMG-D4b (the coordinator's D0 check): THE SAME TAXI, NODE AND PAGE. The page's 3 m/s taxi into a trunk (the stills
// rig's staging) did ~3x node's plastic work on the metal Cessna and broke 1-2 members where node broke none. This rig
// logs the page's run step by step - the certificate's state, the controls, the wind, the ground, the CG and its
// velocity, the trunk's hits, the damage - in variants (as staged / the wind off / the controls zeroed), dumps its start
// state, then flies node from that very state and diffs the two logs: the first quantity that parts names the cause.
//   page (untimed, under the GPU lock; a live_driver.js page on the build, at the stand, ?damage=1&simw=0):
//     node tools/dmg_taxi_parity.js page [--cmd 8572] [--out <file.json>]
//   node (from the page's dump):
//     node tools/dmg_taxi_parity.js node <file.json> [--key metal]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), mode = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };

// ---- THE PAGE SIDE (serialized into the page) ----
async function pageParity(o) {
  const P = FLIGHT_PROBE, sim = P.sim(), world = P.world();
  if (sim.dmgState) return { err: 'worker: open with ?simw=0' };
  if (!window.__d4bStep) window.__d4bStep = sim.step;
  const step = window.__d4bStep;
  sim.step = () => {};
  const b64 = a => { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
  const certAt = () => { const C = window.CERT_STATE ? window.CERT_STATE() : null; return { state: C, simCert: !!(sim.cert && sim.cert()) }; };
  const ctlOf = () => { const c = sim.ctl, r = {}; for (const k in c) { const v = c[k]; r[k] = typeof v === 'object' && v ? JSON.parse(JSON.stringify(v)) : v; } return r; };
  const out = { variant: o, certBoot: certAt(), ctlBoot: ctlOf(), n: sim.n, nb: sim.beams.length };
  let massSum = 0; for (let i = 0; i < sim.n; i++) massSum += sim.m[i]; out.mass = +massSum.toFixed(3);
  { const d = P.def(), tg = i => d.nodes[i].tag || i;
    out.defInfo = { nodes: d.nodes.length, beams: d.beams.length, engine: (d.refs.engine || []).map(tg), noseFrame: (d.refs.noseFrame || []).map(tg),
      engineRest: (d.refs.engine || []).map(i => d.nodes[i].p.map(x => +x.toFixed(3))), simIsDef: sim.n === d.nodes.length && sim.beams.length === d.beams.length }; }
  const strip = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
  sim.reset(0); placeAtAerodrome(sim, strip);
  const n = sim.n, p = sim.p, v = sim.v, fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  { const c = sim.cgPos(), dx = strip.x - 300 * fx - c[0], dz = strip.z - 300 * fz - c[2]; for (let i = 0; i < n; i++) { p[i*3] += dx; p[i*3+2] += dz; } }
  const c0 = sim.cgPos(), ground = world.terrainH(c0[0], c0[2]);
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - (sim.r[i] || 0));
  if (world.treeHits.drop) world.treeHits.drop('fill:wreckstill');
  const wind0 = world.wind;
  if (o.noWind) world.wind = null;
  if (o.zeroCtl) { sim.ctl.brake = 0; sim.ctl.dr = 0; sim.ctl.da = 0; sim.ctl.de = 0; }
  for (let i = 0; i < n; i++) p[i*3+1] += ground - yMin + 0.02;
  for (let f = 0; f < 120; f++) step(1 / 60);
  const D0 = sim.damage();
  out.settle = { yields: D0.yields, work: D0.work, broken: D0.broken.length };
  for (let i = 0; i < n; i++) { v[i*3] = 3 * fx; v[i*3+2] = 3 * fz; }
  const c = sim.cgPos(), tx = c[0] + fx * 6, tz = c[2] + fz * 6;
  world.treeHits.set('fill:wreckstill', [tx, tz, ground, 0.3, ground + 10]);
  sim.ctl.thr = 0;
  if (o.zeroCtl) { sim.ctl.brake = 0; sim.ctl.dr = 0; sim.ctl.da = 0; sim.ctl.de = 0; }
  out.start = { t: sim.t, p: b64(new Float64Array(p)), v: b64(new Float64Array(v)), hdg: strip.hdg, trunk: [tx, tz, ground], ctl: ctlOf(), cert: certAt(),
    wind: wind0 && !o.noWind ? Array.from(world.wind(c[0], c[1] + 1, c[2], sim.t)) : null,
    ground: { cg: ground, trunk: world.terrainH(tx, tz), ahead3: world.terrainH(c[0] + fx * 3, c[2] + fz * 3), side2: world.terrainH(c[0] - fz * 2, c[2] + fx * 2) } };
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const log = [];
  let moved = 0;
  for (let s = 0; s < (o.steps || 720); s += 2) {
    step(1 / 60); step(1 / 60);
    const cgA = sim.cgPos().slice();
    await raf();
    const cgB = sim.cgPos(); if (Math.hypot(cgB[0] - cgA[0], cgB[1] - cgA[1], cgB[2] - cgA[2]) > 1e-9) moved++;
    const D = sim.damage(), cv = sim.cgVel();
    log.push({ t: +sim.t.toFixed(4), cg: Array.from(cgB, x => +x.toFixed(5)), cv: Array.from(cv, x => +x.toFixed(5)), hits: sim.trunkHits(), broken: D.broken.length, work: +D.work.toFixed(2), yields: D.yields,
      brake: sim.ctl.brake, dr: sim.ctl.dr, thr: sim.ctl.thr });
  }
  if (o.noWind) world.wind = wind0;
  const D = sim.damage();
  out.end = { crashed: D.crashed, reason: D.reason, broken: D.broken.map(i => (P.def().nodes[sim.beams[i].a].tag || sim.beams[i].a) + '-' + (P.def().nodes[sim.beams[i].b].tag || sim.beams[i].b)), work: D.work, yields: D.yields, moved, cert: certAt() };
  out.log = log;
  return out;
}

if (mode === 'page') (async () => {
  process.argv.push('--cmd', opt('cmd', '8572'));
  const S = require('./dmg_wreck_stills.js');
  const R = { at: new Date().toISOString(), runs: {} };
  for (const [k, o] of [['staged', {}], ['noWind', { noWind: true }], ['noWindZeroCtl', { noWind: true, zeroCtl: true }], ['staged2', {}]]) {
    const r = await S.run(pageParity, o);
    R.runs[k] = r;
    const e = r && r.end;
    console.log(k + ': ' + (e ? `crashed ${e.crashed} (${e.reason}) broken ${e.broken.length} [${e.broken.join(' ')}] work ${(e.work / 1000).toFixed(2)} kJ; settle ${JSON.stringify(r.settle)}; cert ${JSON.stringify(r.start.cert)}; wind ${JSON.stringify(r.start.wind)}; ctl ${JSON.stringify(r.start.ctl)}; moved-between-steps ${e.moved}` : JSON.stringify(r).slice(0, 400)));
  }
  const f = path.resolve(opt('out', 'taxi_parity_page.json'));
  fs.writeFileSync(f, JSON.stringify(R));
  console.log('wrote ' + f);
})().catch(e => { console.error(e); process.exit(1); });

// ---- THE NODE SIDE: the page's start state, flown in node's flat world (the same ground height, the same trunk) ----
if (mode === 'node') {
  const L = require('./_treecrash_lib.js'), C = L.core();
  const R = JSON.parse(fs.readFileSync(argv[1], 'utf8')), key = opt('key', 'metal');
  const f64 = s => new Float64Array(new Uint8Array(Buffer.from(s, 'base64')).buffer);
  for (const [k, r] of Object.entries(R.runs)) {
    if (!r || !r.start) continue;
    const cert = !!(r.start.cert && r.start.cert.simCert);
    const def = L.defOf(key, { cert });
    const { W, TH } = L.flatWorld(r.start.trunk[2]);
    if (r.start.wind) { const w = r.start.wind; W.wind = () => w; } else W.wind = null;
    const sim = C.makeSim(def, W); sim.reset(0);
    { const tg = i => def.nodes[i].tag || i;
      console.log(k + ': def page ' + JSON.stringify(r.defInfo));
      console.log('   def node ' + JSON.stringify({ nodes: def.nodes.length, beams: def.beams.length, engine: def.refs.engine.map(tg), noseFrame: def.refs.noseFrame.map(tg), engineRest: def.refs.engine.map(i => def.nodes[i].p.map(x => +x.toFixed(3))) })); }
    if (sim.n !== r.n || sim.beams.length !== r.nb) { console.log(k + `: DEF DIFFERS: node n ${sim.n} nb ${sim.beams.length}, page n ${r.n} nb ${r.nb}`); continue; }
    let mass = 0; for (let i = 0; i < sim.n; i++) mass += sim.m[i];
    // (the page's exact start state - after its settle - on a fresh sim: the settle's own yields are not carried, the
    // page's are logged in r.settle)
    sim.p.set(f64(r.start.p)); sim.v.set(f64(r.start.v));
    TH.set('fill:test', [r.start.trunk[0], r.start.trunk[1], r.start.trunk[2], 0.3, r.start.trunk[2] + 10]);
    for (const q in r.start.ctl) if (typeof r.start.ctl[q] !== 'object') sim.ctl[q] = r.start.ctl[q];
    let first = null;
    const nlog = [];
    for (let s = 0; s < r.log.length * 2; s += 2) {
      sim.step(1 / 60); sim.step(1 / 60);
      const D = sim.damage(), cg = sim.cgPos(), cv = sim.cgVel(), pg = r.log[s / 2];
      const row = { t: sim.t, cg, cv, hits: sim.trunkHits(), broken: D.broken.length, work: D.work };
      nlog.push(row);
      if (!first) {
        const dcg = Math.hypot(cg[0] - pg.cg[0], cg[1] - pg.cg[1], cg[2] - pg.cg[2]), dcv = Math.hypot(cv[0] - pg.cv[0], cv[1] - pg.cv[1], cv[2] - pg.cv[2]);
        if (dcg > 1e-3 || dcv > 1e-2 || row.hits !== pg.hits || Math.abs(row.work - pg.work) > 5)
          first = { step: s, t: +sim.t.toFixed(4), dcg: +dcg.toFixed(5), dcv: +dcv.toFixed(5), hits: [row.hits, pg.hits], work: [+row.work.toFixed(1), pg.work], cvNode: cv.map(x => +x.toFixed(4)), cvPage: pg.cv, ctlPage: { brake: pg.brake, dr: pg.dr, thr: pg.thr } };
      }
    }
    const D = sim.damage();
    console.log(`${k}: node from the page's start (cert ${cert}, wind ${JSON.stringify(r.start.wind)}, mass node ${mass.toFixed(2)} page ${r.mass}): crashed ${D.crashed} (${D.reason}) broken ${D.broken.length} work ${(D.work / 1000).toFixed(2)} kJ | page: crashed ${r.end.crashed} broken ${r.end.broken.length} work ${(r.end.work / 1000).toFixed(2)} kJ`);
    console.log('   first parting: ' + (first ? JSON.stringify(first) : 'none (the same to 1 mm / 1 cm/s / the hits / 5 J)'));
  }
}
