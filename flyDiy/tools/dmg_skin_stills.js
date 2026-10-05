#!/usr/bin/env node
// G1854 (DMG-D4a SKIN): THE STILLS - the flown skin over a wreck, on the cloud's software GPU (tools/soft_still.js, SOFT-GPU
// G1460), the real page: the user's Cub (builds/cub_2026-09-20_corrected.json), the damage layer on (?damage=1), the
// physics inline (?simw=0: the crash is stepped in the page, the same solver the worker runs - the hop's own equality is
// GATE DMGSKIN's). One boot, two wrecks, each drawn twice - AFTER (the skin breaks: skin_break.js) and BEFORE
// (window.FLYDIY_SKINBREAK = false: the skin as it was drawn until G1851) - from the same camera on the same frame of the
// physics:
//   1. a wing torn off at a trunk: GATE TREECRASH's 30 m/s, 4 m up, the trunk 2.5 m out on the left wing
//   2. a nose-in wreck: GATE DMGINTEGRITY's severe nose-in on the ground (180 km/h, 10 m/s, 60 deg nose-down)
// The trunk is the physics' (world.treeHits, as the gates register it) and drawn here as a plain brown cylinder (the
// world's own trees are not where the gates put theirs).
//   node tools/dmg_skin_stills.js [--out reports/evidence/DMG-D4a] [--size 1280x720]   (minutes: SwiftShader)
// Also a --stage module for soft_still.js: module.exports = async (page, { frames, shot, log }).
'use strict';
const path = require('path'), fs = require('fs');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const OUT = path.resolve(opt('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-D4a')));

// ---- in the page: a wreck staged and stepped (inline sim) ----
function stagePage(o) {
  const P = window.FLIGHT_PROBE, sim = P.sim(), world = P.world();
  if (sim.dmgState) return { err: 'the physics is in the worker: open with ?simw=0' };
  const strip = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
  sim.reset(0);
  placeAtAerodrome(sim, strip);
  const n = sim.n, p = sim.p, v = sim.v, fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg);
  // a little ahead of the threshold, on the runway's own ground
  for (let i = 0; i < n; i++) { p[i*3] += 60 * fx; p[i*3+2] += 60 * fz; }
  const c0 = sim.cgPos(), ground = world.terrainH(c0[0], c0[2]);
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - (sim.r[i] || 0));
  if (o.kind === 'trunk') {
    for (let i = 0; i < n; i++) { p[i*3+1] += ground - yMin + o.agl; v[i*3] = o.V * fx; v[i*3+1] = 0; v[i*3+2] = o.V * fz; }
    const c = sim.cgPos(), tx = c[0] + fx * o.D - fz * o.off, tz = c[2] + fz * o.D + fx * o.off;
    world.treeHits.set('fill:skinstill', [tx, tz, ground, o.r, ground + o.h]);
    // the trunk drawn: a cylinder on the ground where the physics' trunk stands
    const scene = P.craft().parent;
    if (window.__skinTrunk) scene.remove(window.__skinTrunk);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r * 1.15, o.h, 20), new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 }));
    m.position.set(tx, ground + o.h / 2, tz); m.castShadow = true; scene.add(m); window.__skinTrunk = m;
  } else {
    if (window.__skinTrunk) { P.craft().parent.remove(window.__skinTrunk); window.__skinTrunk = null; }
    world.treeHits.drop && world.treeHits.drop('fill:skinstill');
    // nose-down about the CG round the body's lateral axis (the gates' groundCase), then onto the ground at the speed
    const [xA, , zR] = sim.axes(), cg = sim.cgPos(), th = -o.pitch * Math.PI / 180, k = zR, cs = Math.cos(th), sn = Math.sin(th);
    for (let i = 0; i < n; i++) {
      const d = [p[i*3] - cg[0], p[i*3+1] - cg[1], p[i*3+2] - cg[2]], kd = k[0]*d[0] + k[1]*d[1] + k[2]*d[2];
      const cr = [k[1]*d[2] - k[2]*d[1], k[2]*d[0] - k[0]*d[2], k[0]*d[1] - k[1]*d[0]];
      for (let j = 0; j < 3; j++) p[i*3+j] = cg[j] + d[j] * cs + cr[j] * sn + k[j] * kd * (1 - cs);
    }
    let y2 = Infinity; for (let i = 0; i < n; i++) y2 = Math.min(y2, p[i*3+1] - (sim.r[i] || 0));
    const hl = Math.hypot(xA[0], xA[2]);
    for (let i = 0; i < n; i++) { p[i*3+1] += ground + 0.3 - y2; v[i*3] = -o.V * xA[0] / hl; v[i*3+1] = -o.sink; v[i*3+2] = -o.V * xA[2] / hl; }
  }
  sim.ctl.thr = 0;
  const t0 = performance.now();
  for (let s = 0; s < o.steps; s++) sim.step(1 / 60);
  const D = sim.damage();
  return { ms: Math.round(performance.now() - t0), steps: o.steps, crashed: D.crashed, reason: D.reason, broken: D.broken.length,
           groups: (D.groups || []).map(g => g.key), brokeUp: !!D.brokeUp, cg: sim.cgPos().map(x => +x.toFixed(2)) };
}

async function stage(page, { frames, shot, log }) {
  const R = { shots: [] };
  const scenes = [
    { id: 'wing', label: 'a wing torn off at a trunk (30 m/s, 4 m up, the trunk 2.5 m out on the left wing)', o: { kind: 'trunk', D: 40, agl: 4, V: 30, off: 2.5, r: 0.3, h: 10, steps: 150 },
      cams: [[200, 22, 16], [250, 35, 22]] },
    { id: 'nosein', label: 'a nose-in wreck (180 km/h, 10 m/s, 60 deg nose-down, on the ground)', o: { kind: 'ground', V: 50, sink: 10, pitch: 60, steps: 150 },
      cams: [[150, 20, 12], [235, 28, 14]] },
  ];
  for (const sc of scenes) {
    const st = await page.evaluate(stagePage, sc.o);
    log('staged', sc.id, JSON.stringify(st));
    if (st.err) { R.err = st.err; return R; }
    // the page's own frames carry the wreck on (and pose it); then each camera, the skin broken and as it was
    await page.evaluate(() => { window.FLYDIY_SKINBREAK = true; });
    await frames(3);
    for (let ci = 0; ci < sc.cams.length; ci++) {
      const [az, el, dist] = sc.cams[ci];
      await page.evaluate(([a, e, d]) => FLIGHT_PROBE.camSet(a * Math.PI / 180, e * Math.PI / 180, d), [az, el, dist]);
      for (const on of [true, false]) {
        await page.evaluate(x => { window.FLYDIY_SKINBREAK = x; }, on);
        await frames(2);
        const stats = await page.evaluate(() => (window.FLYDIY_SKINBREAK_STATS ? FLYDIY_SKINBREAK_STATS() : null));
        const file = path.join(OUT, sc.id + '_' + (ci + 1) + '_' + (on ? 'after' : 'before') + '.jpg');
        const A = await shot(file);
        R.shots.push({ scene: sc.id, label: sc.label, cam: [az, el, dist], skinBreak: on, file: path.relative(path.join(__dirname, '..'), file), stats, picture: A, physics: st });
      }
    }
    await page.evaluate(() => { window.FLYDIY_SKINBREAK = true; });
  }
  R.skipMain = true;
  return R;
}
module.exports = stage;

if (require.main === module) {
  const S = require('./soft_still.js');
  const size = opt('size', '1280x720').split('x').map(Number);
  const o = Object.assign(S.parse(), { build: path.join(__dirname, '..', 'builds', 'cub_2026-09-20_corrected.json'), q: 'damage=1&simw=0&fog=0', size,
    stage: __filename, out: path.join(OUT, 'stand.jpg'), secs: +opt('secs', 5400), day: 'noon' });
  fs.mkdirSync(OUT, { recursive: true });
  S.still(o).then(R => {
    fs.writeFileSync(path.join(OUT, 'stills.json'), JSON.stringify(R, null, 1));
    console.log('SKIN_STILLS ' + JSON.stringify({ shots: (R.stage && R.stage.shots || []).map(s => [s.file, s.stats]), errors: R.errors, err: R.stage && R.stage.err, t: R.t }));
    process.exit(R.stage && !R.stage.err ? 0 : 1);
  }, e => { console.log('SKIN_STILLS_FAIL ' + (e && e.stack || e)); process.exit(1); });
}
