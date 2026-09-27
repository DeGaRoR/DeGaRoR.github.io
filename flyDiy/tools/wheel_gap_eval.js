// wheel_gap_eval.js - THE DRAWN TYRE ON THE DRAWN GROUND, live (A6-GROUND G1000-G1001), for rollout_perf's --eval:
//   node tools/rollout_perf.js --secs 12 --eval @tools/wheel_gap_eval.js [--build ...]
// One expression. For WHEEL_GAP_SECS (default 40) of the running game, every 6th frame, per drawn wheel (the flown
// model's wheel parts): the tyre's lowest vertex in world (its meshes' positions through their matrixWorld), a ray
// straight down there onto the DRAWN ground (the strips' and roads' pavement, the paved polygons, the premises' patch,
// the world's chunks - whatever mesh is hit first from 1 m above), and the core's terrainH (what the wheel stands on).
// Returns per wheel and per surface: tyre - drawn surface, drawn surface - terrainH, tyre - terrainH (mm), and a 2 Hz
// trace. Read-only.
(async () => {
  const P = window.FLIGHT_PROBE, W = window.WORLD, sc = W.scene;
  const SECS = window.WHEEL_GAP_SECS || 40;
  const world = P.world();
  const GROUND = /^(pavement:|road:|pave:|premises:patch|chunk|ring|terrain|ground|splat|far)/i;
  const cand = [];
  sc.traverse(o => { if ((o.isMesh || o.isLOD) && GROUND.test(o.name || '') && !(o.parent && o.parent.isLOD)) cand.push(o); });
  const rc = new THREE.Raycaster(); rc.far = 3;
  const dn = new THREE.Vector3(0, -1, 0), org = new THREE.Vector3(), v = new THREE.Vector3();
  const kindOf = n => /^pavement:/.test(n) ? 'strip' : /^road:/.test(n) ? 'road' : /^pave:/.test(n) ? 'apron' : /patch/.test(n) ? 'ground' : 'world';
  const tyreLow = w => {
    let yMin = Infinity, at = null;
    w.obj.updateWorldMatrix(true, true);
    w.obj.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const pa = o.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); if (v.y < yMin) { yMin = v.y; at = [v.x, v.y, v.z]; } }
    });
    return at;
  };
  const M = P.model(), def = P.def();
  const parts = (M && M.wheelParts) || [];
  const nameOf = w => w.idx === def.refs.tw ? (def.spec && def.spec.gear && def.spec.gear.type === 'tricycle' ? 'nose' : 'tail') : (def.nodes[w.idx].p[2] > 0 ? 'mainL' : 'mainR');
  const acc = {}, trace = [];
  const put = (k, x) => { const a = acc[k] = acc[k] || []; a.push(x); };
  let f = 0; const t0 = performance.now();
  await new Promise(res => {
    const tick = () => {
      if (performance.now() - t0 > SECS * 1000) return res();
      if ((f++ % 6) === 0) {
        const s = P.sim(); const cv = s.cgVel ? s.cgVel() : [0, 0, 0], V = Math.hypot(cv[0], cv[2]);
        const row = { t: +((performance.now() - t0) / 1000).toFixed(1), V: +V.toFixed(1) };
        for (const w of parts) {
          const at = tyreLow(w); if (!at) continue;
          org.set(at[0], at[1] + 1, at[2]); rc.set(org, dn);
          const hit = rc.intersectObjects(cand, true)[0];
          const h = world.terrainH(at[0], at[2]);
          const nm = nameOf(w), sk = hit ? kindOf(hit.object.name || (hit.object.parent && hit.object.parent.name) || '') : 'none';
          const tyreS = hit ? 1000 * (at[1] - hit.point.y) : NaN, surfH = hit ? 1000 * (hit.point.y - h) : NaN, tyreH = 1000 * (at[1] - h);
          if (hit) { put(nm + ' ' + sk + ' tyre-surface', tyreS); put(nm + ' ' + sk + ' surface-terrainH', surfH); }
          put(nm + ' tyre-terrainH', tyreH);
          row[nm] = [sk, +tyreS.toFixed(1), +surfH.toFixed(1)];
        }
        if ((f % 30) === 1) trace.push(row);
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const st = a => { const s = a.slice().sort((x, y) => x - y), q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))];
    return { n: s.length, mean: +(s.reduce((p, x) => p + x, 0) / s.length).toFixed(1), p5: +q(0.05).toFixed(1), p50: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), min: +s[0].toFixed(1), max: +s[s.length - 1].toFixed(1) }; };
  const out = {}; for (const k in acc) out[k] = st(acc[k]);
  return { wheels: parts.map(nameOf), candidates: cand.length, stats: out, trace };
})()
