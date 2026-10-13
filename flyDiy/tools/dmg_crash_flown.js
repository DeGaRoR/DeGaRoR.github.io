#!/usr/bin/env node
// G1868 (DMG-D4b; the user: "I want to SEE the crash"): A CRASH FLOWN BY THE PAGE ITSELF, watched to its card. A client of
// tools/live_driver.js (TAKE THE GPU LOCK FIRST), the user's Cub rolled out: the flight started (Fly), the hand on the
// controls (no pilot), the aeroplane put 4 m over open ground at 30 m/s along its own heading with a trunk 40 m ahead
// (world.treeHits, drawn as a brown cylinder) - and from there the page's own loop flies it (its solver steps, its
// ending: the crash watched, the card). A frame every half second of sim time (the chase view, or the cockpit to see its
// rule cut to the orbit), the moments read off the page: the impact (the first break), the solver's 'over', the card.
//   node tools/dmg_crash_flown.js [--cmd 8572] [--out reports/evidence/DMG-D4b/flown] [--cam chase|cockpit] [--secs 16]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const R = require('./dmg_wreck_stills.js');
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-D4b', 'flown')));
const CAM = opt('cam', 'chase'), SECS = +opt('secs', 16);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function pageFly(o) {
  const P = FLIGHT_PROBE, world = P.world();
  if (window.__d4bStep) { P.sim().step = window.__d4bStep; }          // (a stills rig left the solver held: given back)
  { const h = document.getElementById('d4bHide'); if (h) h.remove(); }  // (...and the interface hidden: the card is the point here)
  window.FLYDIY_WRECK = true; window.FLYDIY_SKINBREAK = true;
  const go = document.getElementById('bGo'); if (go && !P.over() && go.offsetParent) go.click();
  await new Promise(r => setTimeout(r, 2500));
  P.setManual(true);
  P.camMode(o.cam);
  const sim = P.sim(), [xA] = sim.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl;
  const c = sim.cgPos(), g = world.terrainH(c[0], c[2]);
  await P.place({ at: [c[0], g + 4 + (c[1] - sim.p.reduce((m, v, i) => (i % 3 === 1 ? Math.min(m, v) : m), Infinity)), c[2]], zeroV: true, dv: [o.V * fx, 0, o.V * fz] });
  const c2 = sim.cgPos(), tx = c2[0] + fx * o.D, tz = c2[2] + fz * o.D, gt = world.terrainH(tx, tz);
  world.treeHits.set('fill:wreckflown', [tx, tz, gt, 0.3, gt + 10]);
  const scene = P.craft().parent;
  if (window.__d4bTrunk2) scene.remove(window.__d4bTrunk2);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 10, 20), new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 }));
  m.position.set(tx, gt + 5, tz); m.castShadow = true; scene.add(m); window.__d4bTrunk2 = m;
  sim.ctl.thr = 0;
  return { t: sim.t, cam: P.camModeNow() };
}
function pageMoment() {
  const P = FLIGHT_PROBE, sim = P.sim(), D = sim.damage ? sim.damage() : null, card = document.getElementById('arrCard'), r = card && card.getBoundingClientRect();
  const W = window.FLYDIY_WRECK_STATS ? window.FLYDIY_WRECK_STATS() : null;
  return { t: +sim.t.toFixed(2), broken: D ? D.broken.length : 0, crashed: !!(D && D.crashed), over: !!(D && D.over), at: D && D.at, flightOver: P.over(), cam: P.camModeNow(),
    card: card && !card.hidden ? { cls: card.className, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null,
    phase: (document.getElementById('phName') || {}).textContent, bodies: W ? W.bodies.length : 0, asleep: W ? W.bodies.filter(b => b.asleep || b.sunk).length : 0, eyeCut: W && W.eyeCut };
}
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const st = await R.run(pageFly, { cam: CAM, V: 30, D: 40 });
  console.log('flying', JSON.stringify(st));
  const seq = [];
  let t0 = null, last = -1, n = 0, cardAt = null;
  for (let w = 0; w < SECS * 6 && n < 60; w++) {
    const m = await R.run(pageMoment);
    if (t0 == null) t0 = m.t;
    if (m.t - last >= 0.5 || (m.flightOver && cardAt == null)) {
      last = m.t; n++;
      if (m.flightOver && cardAt == null) cardAt = m.t;
      const file = path.join(OUT, CAM + '_' + String(n).padStart(2, '0') + '.jpg');
      const tmp = file + '.png'; await R.get('/shot?f=' + encodeURIComponent(tmp));
      const png = fs.readFileSync(tmp).toString('base64'); fs.unlinkSync(tmp);
      const jpg = await R.run(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width / 2; c.height = img.height / 2; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8).slice(23); }, png);
      fs.writeFileSync(file, Buffer.from(jpg, 'base64'));
      seq.push(Object.assign({ file: path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/') }, m));
      console.log(n, JSON.stringify(m));
      if (cardAt != null && m.t - cardAt > 2) break;
    }
    await sleep(160);
  }
  const imp = seq.find(s => s.broken > 0), ov = seq.find(s => s.over);
  const R2 = { cam: CAM, impact: imp ? imp.t : null, over: ov ? ov.t : null, card: cardAt, cardBox: (seq.find(s => s.card) || {}).card || null, seq };
  fs.writeFileSync(path.join(OUT, CAM + '.json'), JSON.stringify(R2, null, 1));
  console.log('FLOWN ' + JSON.stringify({ cam: CAM, impact: R2.impact, over: R2.over, card: R2.card, cardBox: R2.cardBox }));
  process.exit(0);
})().catch(e => { console.log('FLOWN_FAIL ' + (e && e.stack || e)); process.exit(1); });
