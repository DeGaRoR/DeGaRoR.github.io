// mixd2.js - the user's mix-dead screenshots (A0, 2026-10-06): run once plain and once with ?mixdead=1 (DW_TAG off|on), gamer.
// The SAME frames in both (every pose derived from the world, which mixDead does not move): the stand (the chase camera as
// the roll-out leaves it), a forest edge from the taxi's eye height, 300 m and 1 km over the densest stand near HOME
// (front-lit), each at noon and golden. Plus the census: snags / living per species within 3 km of HOME.
const fs = require('fs'), path = require('path');
module.exports = async ({ ev, shot, sleep, log, out }) => {
  const TAG = process.env.DW_TAG || 'x';
  fs.mkdirSync(path.join(out, 'raw'), { recursive: true });
  await ev("(()=>{const b=document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); return 1;})()");
  await ev("(DAY_CLOCK.rate(0), FLIGHT_PROBE.camSettle(), 1)");
  // the pictures without the HUD (every element hidden but the canvas: visibility, never display - the renderer keeps its size)
  await ev("(() => { const st = document.createElement('style'); st.textContent = 'body * { visibility: hidden !important; } canvas { visibility: visible !important; }'; document.head.appendChild(st); return 1; })()");
  const FR = n => ev(`(() => new Promise(res => { let k = 0; const t = () => (++k < ${n}) ? requestAnimationFrame(t) : res(k); requestAnimationFrame(t); }))()`);
  await FR(60); await sleep(2000);
  const cen = JSON.parse(await ev(`(() => { const cg = FLIGHT_PROBE.sim().cgPos(); const out = { mixDead: TREE_MIX.mixDead, cg, census: TREE_LOD.census(), keys: {} };
    const keys = [...new Set(WORLD.treeAtlases().map(a => a.key).filter(Boolean))]; let S = 0, L = 0;
    for (const k of keys) { const s = TREE_LOD.find(k, cg[0], cg[2], 0, 3000, 1e7, 2).length, l = TREE_LOD.find(k, cg[0], cg[2], 0, 3000, 1e7, 0).length;
      if (s || l) out.keys[k] = { snags: s, live: l }; S += s; L += l; }
    out.total = { snags: S, live: L, share: +(S / Math.max(1, S + L)).toFixed(3) }; return JSON.stringify(out); })()`));
  log(TAG, 'mixDead', cen.mixDead, 'snags', cen.total.snags, 'live', cen.total.live, 'share', cen.total.share, 'census', JSON.stringify(cen.census));
  const cg0 = cen.cg;
  // 1. THE STAND: the chase camera as the roll-out left it, noon and golden
  for (const day of ['noon', 'golden']) {
    await ev(`(DAY_CLOCK.preset('${day}'), DAY_CLOCK.rate(0), FLIGHT_PROBE.camSettle(), 1)`); await FR(60); await sleep(2500);
    await shot(path.join('raw', `mx_${TAG}_1stand_${day}`));
  }
  // the free camera from here; the craft hidden and moved with the eye (the shadow camera follows it)
  await ev(`(() => { const wu = WORLD.worldUpdate; WORLD.worldUpdate = function () { const r = wu.apply(this, arguments); const c = FLIGHT_PROBE.craft && FLIGHT_PROBE.craft(); if (c) c.visible = false; return r; }; FLIGHT_PROBE.camMode('free'); return 1; })()`);
  // 2. THE FOREST EDGE from the stand at eye height: the sector (5 deg) holding the most trees 80-450 m out with none inside 60 m
  const edge = JSON.parse(await ev(`(() => { const W = FLIGHT_PROBE.world(), cg = ${JSON.stringify(cg0)}; const all = TREE_LOD.drawn(cg[0], cg[2], 450); let best = null;
    for (let a = 0; a < 72; a++) { const az = a * 5 * Math.PI / 180, dx = Math.sin(az), dz = -Math.cos(az); let n = 0, near = 0;
      for (let i = 0; i < all.length; i += 4) { const x = all[i] - cg[0], z = all[i + 2] - cg[2], d = Math.hypot(x, z); if (d < 1) continue;
        const c = (x * dx + z * dz) / d; if (c < Math.cos(5 * Math.PI / 180)) continue; if (d < 60) near++; else if (d < 450) n++; }
      if (!near && (!best || n > best.n)) best = { az, n }; }
    const ey = W.terrainH(cg[0], cg[2]) + 1.8; return JSON.stringify({ eye: [cg[0], ey, cg[2]], yaw: best.az, n: best.n }); })()`));
  log(TAG, 'edge', JSON.stringify(edge));
  for (const day of ['noon', 'golden']) {
    await ev(`(DAY_CLOCK.preset('${day}'), DAY_CLOCK.rate(0), 1)`);
    await ev(`(() => { const C = DEV_CAM; C.pos.set(${edge.eye.join(',')}); C.yaw = ${edge.yaw}; C.pitch = 2 * Math.PI / 180; return 1; })()`);
    await FR(60); await sleep(2500); await shot(path.join('raw', `mx_${TAG}_2edge_${day}`));
  }
  // 3. 300 m and 1 km over the densest stand within 2.5 km (imp_audit's rule), front-lit
  const st = JSON.parse(await ev(`(() => { const w = FLIGHT_PROBE.world(); const T = w.trees.filter(t => Math.hypot(t.x, t.z) < 2500); let best = null, bn = -1;
    for (let i = 0; i < T.length; i += 7) { const a = T[i]; let n = 0; for (const b of T) if (Math.abs(b.x - a.x) < 120 && Math.abs(b.z - a.z) < 120) n++; if (n > bn) { bn = n; best = a; } }
    return JSON.stringify({ x: best.x, z: best.z, y: w.terrainH(best.x, best.z) }); })()`));
  for (const [agl, hd, pitch, tag] of [[300, 1400, -11, '3alt300'], [1000, 3200, -17, '4alt1000']]) {
    for (const day of ['noon', 'golden']) {
      await ev(`(DAY_CLOCK.preset('${day}'), DAY_CLOCK.rate(0), 1)`);
      const eye = JSON.parse(await ev(`(() => { const S = WORLD.SUN.clone(); const h = Math.hypot(S.x, S.z) || 1; return JSON.stringify([${st.x} + S.x / h * ${hd}, ${st.y} + ${agl}, ${st.z} + S.z / h * ${hd}]); })()`));
      const cg = JSON.parse(await ev('JSON.stringify(FLIGHT_PROBE.sim().cgPos())'));
      await ev(`FLIGHT_PROBE.place({ by: [${eye[0] - cg[0]}, ${eye[1] + 40 - cg[1]}, ${eye[2] - cg[2]}], zeroV: true }).then(() => 1)`);
      await ev(`(() => { const C = DEV_CAM; C.pos.set(${eye.join(',')}); const d = new THREE.Vector3(${st.x - eye[0]}, 0, ${st.z - eye[2]}).normalize(); C.yaw = Math.atan2(d.x, -d.z); C.pitch = ${pitch} * Math.PI / 180; return 1; })()`);
      await FR(90); await sleep(9000); await FR(60); await sleep(1500);
      await shot(path.join('raw', `mx_${TAG}_${tag}_${day}`));
    }
  }
  fs.writeFileSync(path.join(out, `mx_${TAG}_census.json`), JSON.stringify(cen, null, 1));
};
