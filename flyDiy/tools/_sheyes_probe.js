#!/usr/bin/env node
// _sheyes_probe.js - SHADOW-EYES (G1080) THE CRAFT'S SHADOWS, PROBED IN THE PAGE IN NODE (tools/_page_node.js, GATE
// FRAMECOST's harness: no GPU, a virtual clock, ~2-4 min and ~3.5 GB).
//
//   node --max-old-space-size=6144 tools/_sheyes_probe.js [cub|cessna] [out.json]
//
// S1  THE FAR MAP'S AIRCRAFT MESHES: after the roll-out, every mesh that casts a shadow and stands on the flying
//     aeroplane (under the craft group, or its world sphere inside the craft's) - its path, whether it is under the
//     craft group, and its layers (FAR_LAYER 2 = the world's 1 km map; CRAFT_LAYER 5 = the craft's cascade).
// H2  THE CASCADE'S FIT THROUGH THE SITUATIONS: per frame, where the craft's cascade is aimed (C1.tgt), its half-width
//     (C1.H), the drawn aeroplane's sphere centre (model.grp's matrixWorld) and whether the cascade covers it - over
//     a taxi, a pause + resume, a restart, a skip to the line-up, the free camera, the world editor.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const BUILD = process.argv[2] || 'cub', OUT = process.argv[3] || null;
const BUILDS = { cub: null, cessna: 'bugReports/cessnaMetal (1).json' };

(async () => {
  const { openPage } = require('./_page_node.js');
  const storage = {};
  if (BUILDS[BUILD]) storage['flydiy.wip'] = fs.readFileSync(path.join(ROOT, BUILDS[BUILD]), 'utf8');
  const hooks = { afterScript(name, P) { const W = P.win; if (name === 'src/viewer/gfx_settings.js' && W.GFX) { W.GFX.set('preset', 'gamer'); W.GFX.set('shadows', 'full'); } } };
  const P = await openPage({ quiet: true, storage, hooks, query: process.env.SHEYES_QUERY || '' });
  const W = P.win, log = s => process.stderr.write(s + '\n');
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  log('garage up');
  W.document.getElementById('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout'), 900000);
  log('rolled out');
  await P.frames(20);
  const FP = W.FLIGHT_PROBE, SN = W.SHADOW_NEAR, THREE = W.THREE;
  const scene = W.WORLD && W.WORLD.scene;
  const model = FP.model(), grp = model && model.grp;
  let craft = grp; while (craft && craft.parent && craft.parent !== scene) craft = craft.parent;
  const out = { build: BUILD, S: Object.assign({}, SN.S), census: null, trace: [] };
  // ---- S1: the census ----
  const census = () => {
    grp.updateWorldMatrix(true, true);
    const all = new THREE.Sphere(), sp = new THREE.Sphere(); let n = 0;
    grp.traverse(m => { if (m.isMesh && m.geometry) { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); sp.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld); if (n++) all.union(sp); else all.copy(sp); } });
    const rows = [];
    const pathOf = o => { const a = []; for (let p = o; p && p !== scene; p = p.parent) a.push((p.name || p.type) + (p.userData && p.userData.craft ? '*' : '')); return a.reverse().join('/'); };
    const underCraft = o => { for (let p = o; p; p = p.parent) if (p === craft) return true; return false; };
    scene.traverse(o => {
      if (!(o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) || !o.geometry) return;
      const under = underCraft(o);
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      if (!o.geometry.boundingSphere) return;
      sp.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      const d = sp.center.distanceTo(all.center);
      if (!under && !(d < all.radius + 1 && sp.radius < 3 * all.radius)) return;   // not on the aeroplane
      let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) { vis = false; break; }
      rows.push({ path: pathOf(o), under, vis, cast: !!o.castShadow, recv: !!o.receiveShadow, far: o.layers.isEnabled(SN.FAR_LAYER), craftL: o.layers.isEnabled(SN.CRAFT_LAYER), nearL: o.layers.isEnabled(SN.NEAR_LAYER),
        l0: o.layers.isEnabled(0), d: +d.toFixed(2), r: +sp.radius.toFixed(2), nearOnly: !!(o.material && (Array.isArray(o.material) ? o.material : [o.material]).every(m => m.defines && m.defines.CRAFT_NEAR_ONLY)) });
    });
    return { sphere: [all.center.x, all.center.y, all.center.z, all.radius].map(v => +v.toFixed(2)), rows };
  };
  out.census = census();
  const bad = out.census.rows.filter(r => r.vis && r.cast && r.far);
  log('S1 census: ' + out.census.rows.length + ' meshes on the aeroplane; visible casters on FAR_LAYER: ' + bad.length);
  for (const r of bad.slice(0, 40)) log('   FAR ' + JSON.stringify(r));
  // ---- H2: the trace ----
  const v = new THREE.Vector3();
  const snap = tag => {
    const sim = FP.sim(), cg = sim.cgPos(), C1 = SN.C1;
    grp.updateWorldMatrix(true, false);
    const s = out.census.sphere; // (the pose-frame sphere of tagCraft is private: the drawn grp origin + the census offset)
    v.setFromMatrixPosition(grp.matrixWorld);
    const tgt = C1.tgt, dx = v.x - tgt.x, dz = v.z - tgt.z, dy = v.y - tgt.y;
    // the drawn craft's position across the sun (the cascade's footprint is a square across the light)
    const L = C1.dir, along = dx * L.x + dy * L.y + dz * L.z, lat = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
    const row = { tag, f: P.frameNo, cg: cg.map(q => +q.toFixed(2)), grp: [v.x, v.y, v.z].map(q => +q.toFixed(2)), tgt: [tgt.x, tgt.y, tgt.z].map(q => +q.toFixed(2)), H: +C1.H.toFixed(2), lat: +lat.toFixed(2),
      covered: lat + SN.S.craftR < C1.H * 1.0, tx_cm: +(200 * C1.H / SN.S.size).toFixed(2), held: !!W.FLYDIY_HELD, craftR: +SN.S.craftR.toFixed(2) };
    out.trace.push(row);
    return row;
  };
  const run = async (tag, n, every) => { for (let i = 0; i < n; i++) { await P.frames(1); if (!every || i % every === 0 || i === n - 1) snap(tag); } };
  const bP = W.document.getElementById('bPause');
  const setCam = m => { FP.camMode(m); return FP.camModeNow(); };
  const reset = W.document.getElementById('bReset');
  // THE SCENARIO, run twice: as today (S.aimDrawn false) and with G1080's aim (true)
  const scenario = async pre => {
    await run(pre + 'stand', 30, 10);
    await run(pre + 'taxi', 400, 20);
    if (bP) bP.click(); log(pre + 'paused: ' + (bP && bP.textContent) + ' held ' + W.FLYDIY_HELD);
    await run(pre + 'paused', 120, 20);
    if (bP) bP.click();
    await run(pre + 'resumed', 120, 4);
    log(pre + 'free cam: ' + setCam('free'));
    await run(pre + 'free', 200, 5);
    log(pre + 'chase cam: ' + setCam('chase'));
    await run(pre + 'chase', 60, 4);
    if (reset) { reset.click(); await run(pre + 'reset', 60, 2); }
  };
  for (const on of [false, true]) { SN.S.aimDrawn = on; await scenario(on ? 'NEW:' : 'OLD:'); }
  const bad2 = out.trace.filter(r => !r.covered);
  log('H2: frames where the cascade misses the drawn craft: ' + bad2.length + ' of ' + out.trace.length);
  for (const r of out.trace.filter((r, i) => i % 5 === 0 || !r.covered).slice(0, 400)) log('   ' + JSON.stringify(r));
  out.census2 = census().rows.filter(r => r.vis && r.cast && r.far);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  log('errors: ' + P.errors.slice(0, 5).join(' | '));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
