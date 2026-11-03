// stage_place.js - soft_still.js --stage: the SCENERY-PLACE stills. At the stand: the flight paused, then per shot from
// shots.json ({ name, eye [x, y, z] (y above the ground under the eye when rel), yaw / pitch deg (yaw 0 = -z, 90 = +x),
// plane [x, z] }) the aeroplane parked 400 m over the place (render_premises streams within STREAM.reach = 6 km of IT, not
// of the eye), the free eye posed, and the still taken once the stream's near queue has had FRAMES frames to drain.
const fs = require('fs'), path = require('path');
const SHOTS = JSON.parse(fs.readFileSync(process.env.SHOTS || path.join(__dirname, 'shots.json'), 'utf8'));
const OUT = process.env.OUT || path.join(__dirname, 'shots');
const SETTLE = +(process.env.SETTLE || 30000), FRAMES = +(process.env.FRAMES || 24);
const sleep = ms => new Promise(r => setTimeout(r, ms));
module.exports = async (page, { frames, shot, log }) => {
  await page.evaluate(() => { const b = document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); return 1; });
  const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
  const done = [];
  let lastPlane = null;
  for (const s of SHOTS) {
    if (only && !only.test(s.name)) continue;
    const t0 = Date.now();
    const key = s.plane ? s.plane.join(',') : null;
    if (key && key !== lastPlane) {
      const r = await page.evaluate(async ([X, Z]) => { const P = window.FLIGHT_PROBE, sim = P.sim(), w = P.world(), cg = sim.cgPos(), gy = w.terrainH(X, Z);
        await P.place({ by: [X - cg[0], Math.max(gy, 0) + 400 - cg[1], Z - cg[2]], zeroV: true }); const c2 = P.sim().cgPos(); return [+c2[0].toFixed(0), +c2[1].toFixed(0), +c2[2].toFixed(0)]; }, s.plane);
      log('plane', s.name, JSON.stringify(r));
      lastPlane = key;
    }
    const pose = async () => page.evaluate(([s]) => {
      const W = window.FLIGHT_PROBE.world(), gy = W.terrainH(s.eye[0], s.eye[2]);
      const y = s.rel ? Math.max(gy, 0) + s.eye[1] : s.eye[1];
      const m = window.FLIGHT_PROBE.devFree(s.eye[0], y, s.eye[2], s.yaw * Math.PI / 180, s.pitch * Math.PI / 180);
      return { mode: m, y: +y.toFixed(1) };
    }, [s]);
    const p = await pose();
    await frames(FRAMES);
    await sleep(SETTLE);
    await pose();
    await frames(3);
    const A = await shot(path.join(OUT, s.name + '.jpg'));
    const cam = await page.evaluate(() => { const D = window.DEV_CAM; return D ? { x: +D.pos.x.toFixed(1), y: +D.pos.y.toFixed(1), z: +D.pos.z.toFixed(1), yaw: +(D.yaw * 180 / Math.PI).toFixed(1), pitch: +(D.pitch * 180 / Math.PI).toFixed(1) } : null; });
    log('SHOT', s.name, JSON.stringify(p), JSON.stringify(cam), ((Date.now() - t0) / 1000).toFixed(0) + ' s wall');
    done.push({ name: s.name, cam, coverage: A && A.coverage });
  }
  return { skipMain: true, shots: done };
};
