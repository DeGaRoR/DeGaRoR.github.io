// mixd.js - G1975's mix-dead proposal, measured: run once on a plain URL and once with ?mixdead=1 (DW_TAG names it).
// The snags and the living per species within 3 km of HOME, the near tier's census at the stand (triangles, draws),
// and the 300 m view over the densest stand (alt.js's eye, front-lit), noon and golden.
const fs = require('fs'), path = require('path');
module.exports = async ({ ev, shot, sleep, log, out }) => {
  const TAG = process.env.DW_TAG || 'mixd';
  fs.mkdirSync(path.join(out, 'raw'), { recursive: true });
  await ev("(()=>{const b=document.getElementById('bPause'); if (b && /pause/i.test(b.textContent)) b.click(); return 1;})()");
  await ev("(DAY_CLOCK.rate(0), 1)");
  const FR = n => ev(`(() => new Promise(res => { let k = 0; const t = () => (++k < ${n}) ? requestAnimationFrame(t) : res(k); requestAnimationFrame(t); }))()`);
  await FR(60); await sleep(2000);
  const cen = JSON.parse(await ev(`(() => { const cg = FLIGHT_PROBE.sim().cgPos(); const out = { mixDead: TREE_MIX.mixDead, census: TREE_LOD.census(), keys: {} };
    const keys = [...new Set(WORLD.treeAtlases().map(a => a.key).filter(Boolean))];
    let S = 0, L = 0;
    for (const k of keys) { const s = TREE_LOD.find(k, cg[0], cg[2], 0, 3000, 1e7, 2).length, l = TREE_LOD.find(k, cg[0], cg[2], 0, 3000, 1e7, 0).length;
      if (s || l) out.keys[k] = { snags: s, live: l }; S += s; L += l; }
    out.total = { snags: S, live: L, share: +(S / Math.max(1, S + L)).toFixed(3) }; return JSON.stringify(out); })()`));
  log(TAG, 'mixDead', cen.mixDead, 'within 3 km of HOME: snags', cen.total.snags, 'live', cen.total.live, 'snag share', cen.total.share);
  for (const k in cen.keys) log('   ' + k.padEnd(56) + ' snags ' + String(cen.keys[k].snags).padStart(6) + '  live ' + String(cen.keys[k].live).padStart(6) + '  share ' + (cen.keys[k].snags / (cen.keys[k].snags + cen.keys[k].live)).toFixed(3));
  log('   near-tier census at the stand: ' + JSON.stringify(cen.census));
  // the 300 m view (alt.js's)
  const st = JSON.parse(await ev(`(() => { const w = FLIGHT_PROBE.world(); const T = w.trees.filter(t => Math.hypot(t.x, t.z) < 2500); let best = null, bn = -1;
    for (let i = 0; i < T.length; i += 7) { const a = T[i]; let n = 0; for (const b of T) if (Math.abs(b.x - a.x) < 120 && Math.abs(b.z - a.z) < 120) n++; if (n > bn) { bn = n; best = a; } }
    return JSON.stringify({ x: best.x, z: best.z, y: w.terrainH(best.x, best.z) }); })()`));
  await ev(`(() => { const c = FLIGHT_PROBE.craft && FLIGHT_PROBE.craft(); const wu = WORLD.worldUpdate; WORLD.worldUpdate = function () { const r = wu.apply(this, arguments); const c = FLIGHT_PROBE.craft && FLIGHT_PROBE.craft(); if (c) c.visible = false; return r; }; FLIGHT_PROBE.camMode('free'); return 1; })()`);
  for (const day of ['noon', 'golden']) {
    await ev(`(DAY_CLOCK.preset('${day}'), DAY_CLOCK.rate(0), 1)`);
    const eye = JSON.parse(await ev(`(() => { const S = WORLD.SUN.clone(); const h = Math.hypot(S.x, S.z) || 1; return JSON.stringify([${st.x} + S.x / h * 1400, ${st.y} + 300, ${st.z} + S.z / h * 1400]); })()`));
    const cg = JSON.parse(await ev('JSON.stringify(FLIGHT_PROBE.sim().cgPos())'));
    await ev(`FLIGHT_PROBE.place({ by: [${eye[0] - cg[0]}, ${eye[1] + 40 - cg[1]}, ${eye[2] - cg[2]}], zeroV: true }).then(() => 1)`);
    await ev(`(() => { const C = DEV_CAM; C.pos.set(${eye.join(',')}); const d = new THREE.Vector3(${st.x - eye[0]}, 0, ${st.z - eye[2]}).normalize(); C.yaw = Math.atan2(d.x, -d.z); C.pitch = -11 * Math.PI / 180; return 1; })()`);
    await FR(90); await sleep(12000); await FR(60); await sleep(1500);
    await shot(path.join('raw', `${TAG}_300m_${day}`));
  }
  fs.writeFileSync(path.join(out, TAG + '_mixd.json'), JSON.stringify(cen, null, 1));
};
