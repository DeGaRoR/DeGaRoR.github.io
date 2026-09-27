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
          // the SEEN surface: the pavements are transparent and write no depth, so the last drawn (the highest
          // renderOrder) is the one on top wherever several are hit; the ground otherwise
          // ...and only where the hit lies INSIDE that pavement's edge (its aPav dE > 0, by the face's barycentrics): its
          // side and its shoulder are the ground's colour at alpha 0-0.35, cut over every other strip (a turnaround's
          // shoulder lies 25 m over 13/31's end - the first cut of this probe read its 8 cm lift as "the surface")
          const inside = q => { const A = q.object.geometry.attributes.aPav, P = q.object.geometry.attributes.position, f = q.face; if (!A || !f) return true;
            const a = new THREE.Vector3().fromBufferAttribute(P, f.a), b = new THREE.Vector3().fromBufferAttribute(P, f.b), c = new THREE.Vector3().fromBufferAttribute(P, f.c), w = new THREE.Vector3();
            THREE.Triangle.getBarycoord(q.point, a, b, c, w); return w.x * A.getZ(f.a) + w.y * A.getZ(f.b) + w.z * A.getZ(f.c) > 0; };
          const hits = rc.intersectObjects(cand, true), pav = hits.filter(q => /^(pavement:|road:|pave:)/.test(q.object.name || '') && inside(q));
          const hit = pav.length ? pav.reduce((a, q) => (q.object.renderOrder > a.object.renderOrder ? q : a)) : hits[0];
          const h = world.terrainH(at[0], at[2]);
          const nm = nameOf(w), sk = hit ? kindOf(hit.object.name || (hit.object.parent && hit.object.parent.name) || '') : 'none';
          const tyreS = hit ? 1000 * (at[1] - hit.point.y) : NaN, surfH = hit ? 1000 * (hit.point.y - h) : NaN, tyreH = 1000 * (at[1] - h);
          if (hit) { put(nm + ' ' + sk + ' tyre-surface', tyreS); put(nm + ' ' + sk + ' surface-terrainH', surfH); }
          put(nm + ' tyre-terrainH', tyreH);
          row[nm] = [hit ? hit.object.name : 'none', +tyreS.toFixed(1), +surfH.toFixed(1), +at[0].toFixed(1), +at[2].toFixed(1)];
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
  // every pavement mesh's lift over terrainH deep inside it (dE > 3 m): 0 when it was built on the sunk patch
  // (sinkD0), its builder's constant lift (5-8 cm) when not
  const lifts = {};
  sc.traverse(o => { if (!o.isMesh || !/^(pavement:|road:|pave:)/.test(o.name || '')) return; const g = o.geometry, P = g.attributes.position, A = g.attributes.aPav; if (!P || !A) return;
    const v = []; for (let i = 0; i < P.count; i += 3) if (A.getZ(i) > 3) v.push(P.getY(i) - world.terrainH(P.getX(i), P.getZ(i)));
    if (v.length) { v.sort((a, b) => a - b); lifts[o.name] = +(1000 * v[v.length >> 1]).toFixed(1); } });
  // the contact shadows (G1002): drawn? how many, how strong
  let contact = null;
  sc.traverse(o => { if (o.name === 'contact:blobs') contact = { visible: o.visible, count: o.count, a: Array.from(o.userData.aA.array.slice(0, o.count)).map(v => +v.toFixed(2)), inScene: !!o.parent, program: !!(W.renderer && W.renderer.properties && W.renderer.properties.get(o.material).currentProgram) }; });
  return { wheels: parts.map(nameOf), candidates: cand.length, stats: out, lifts, contact, trace };
})()
