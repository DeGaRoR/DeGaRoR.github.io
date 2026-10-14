(() => {
  // METLA-ONOFF (G3205): what a run ends on - the town's state, the heap, three's memory, GFX - and THE CENSUS (A0 14 Oct: the
  // Metlakatla-ON chantier's baseline): every visible mesh of WORLD.scene classed by its nearest named ancestor (a prop, the
  // premises' house tiers near / far / hlod / town / boxes, the town kit, the patch, the roads, lots, trees, tram...; else
  // the scene child it hangs from), with its draws (meshes), instances, triangles, shadow casters, what is in the camera's
  // frustum, and the unique geometry and texture bytes. Metlakatla's own share where an ancestor names an mk_ plot.
  // (Returns the OBJECT: rollout_perf wraps --eval in JSON.stringify(await (...)) itself.)
  const out = { town: !!(window.FLYDIY_TOWN && FLYDIY_TOWN.all), variant: window.FLYDIY_TOWN_VARIANT || null };
  try {
    const W = window.WORLD, PS = W && W.premises && W.premises.stats;
    Object.assign(out, PS ? { houses: PS.houses, houseTris: PS.houseTris, queued: PS.queued, objects: PS.objects, lights: PS.lights, bakeDraws: PS.bakeDraws, bakeMerged: PS.bakeMerged, farTris: PS.farTris, lod1Houses: PS.lod1Houses, hlodCells: PS.hlodCells, obstacles: PS.obstacles } : {});
    out.heapMB = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null;
    const R = W && W.renderer; if (R && R.info) out.gl = { geo: R.info.memory.geometries, tex: R.info.memory.textures, programs: R.info.programs ? R.info.programs.length : null, calls: R.info.render.calls, tris: R.info.render.triangles };
    out.gfx = window.GFX && GFX.get ? GFX.get() : null;
    const scene = W && W.scene; if (!scene || !window.THREE) return out;
    const cam = W.camera || (window.FLIGHT_PROBE && FLIGHT_PROBE.camera && FLIGHT_PROBE.camera()) || window.camera || null;
    let fr = null; if (cam && cam.projectionMatrix) { cam.updateMatrixWorld(); fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); }
    const KEY = /^(prop:|houses:|premises:|trees:|tree:|rail:|poles:)/;
    const C = {}, seenG = new Set(), seenT = new Set();
    const texBytes = t => { const im = t && (t.image || (t.source && t.source.data)); const w = im && (im.width || (im[0] && im[0].width)), h = im && (im.height || (im[0] && im[0].height)); return w && h ? w * h * 4 * (t.generateMipmaps === false ? 1 : 1.33) * (Array.isArray(im) ? im.length : 1) : 0; };
    const visible = o => { for (let a = o; a; a = a.parent) if (!a.visible) return false; return true; };
    scene.traverse(o => {
      if (!(o.isMesh || o.isLine || o.isPoints) || !o.geometry || !visible(o)) return;
      let cls = null, mk = false, top = o;
      for (let a = o; a && a !== scene; a = a.parent) {
        const n = typeof a.name === 'string' ? a.name : '';
        if (!cls && KEY.test(n)) cls = n.startsWith('prop:') ? 'props' : n.slice(0, 40);
        if (/(^|[^a-z])mk_/.test(n) || (a.userData && typeof a.userData.id === 'string' && a.userData.id.startsWith('mk_'))) mk = true;
        top = a;
      }
      if (!cls) cls = 'scene:' + ((top.name || top.type || '?') + '').slice(0, 30);
      const g = o.geometry, idx = g.index, pos = g.attributes && g.attributes.position;
      const inst = o.isInstancedMesh ? o.count : 1, tris = (idx ? idx.count : pos ? pos.count : 0) / 3 * inst;
      const e = C[cls] || (C[cls] = { draws: 0, inst: 0, tris: 0, shadowDraws: 0, shadowTris: 0, inView: 0, inViewTris: 0, geoMB: 0, texMB: 0, mkDraws: 0, mkTris: 0 });
      e.draws++; e.inst += inst; e.tris += tris;
      if (o.castShadow) { e.shadowDraws++; e.shadowTris += tris; }
      if (mk) { e.mkDraws++; e.mkTris += tris; }
      if (fr) { if (!g.boundingSphere) g.computeBoundingSphere(); const s = g.boundingSphere && g.boundingSphere.clone().applyMatrix4(o.matrixWorld); if (!s || o.isInstancedMesh || o.frustumCulled === false || fr.intersectsSphere(s)) { e.inView++; e.inViewTris += tris; } }
      if (!seenG.has(g.uuid)) { seenG.add(g.uuid); let b = 0; for (const k in g.attributes) b += g.attributes[k].array ? g.attributes[k].array.byteLength : 0; if (idx && idx.array) b += idx.array.byteLength; e.geoMB += b / 1e6; }
      for (const m of [].concat(o.material || [])) for (const k in m) { const t = m[k]; if (t && t.isTexture && !seenT.has(t.uuid)) { seenT.add(t.uuid); e.texMB += texBytes(t) / 1e6; } }
    });
    for (const k in C) for (const f of ['tris', 'shadowTris', 'inViewTris', 'mkTris']) C[k][f] = Math.round(C[k][f]);
    for (const k in C) { C[k].geoMB = +C[k].geoMB.toFixed(1); C[k].texMB = +C[k].texMB.toFixed(1); }
    out.census = C; out.censusCam = !!fr;
    // (A0 14 Oct: THE LOTS HELD - every mesh under the premises' lots group, drawn or not: G3210 draws them near only, they are
    // still built and held - the geometry kept, the hidden share)
    const LG = W.premises && W.premises.groups && W.premises.groups.lots;
    if (LG) { const H = { meshes: 0, hidden: 0, tris: 0, geoMB: 0, mkYards: 0 }, sg = new Set();
      LG.traverse(o => { if (typeof o.name === 'string' && o.name.startsWith('yard:mk_')) H.mkYards++;
        if (!o.isMesh || !o.geometry) return; H.meshes++; if (!visible(o)) H.hidden++; const g = o.geometry;
        H.tris += (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3;
        if (!sg.has(g.uuid)) { sg.add(g.uuid); for (const k in g.attributes) H.geoMB += g.attributes[k].array ? g.attributes[k].array.byteLength / 1e6 : 0; if (g.index && g.index.array) H.geoMB += g.index.array.byteLength / 1e6; } });
      H.tris = Math.round(H.tris); H.geoMB = +H.geoMB.toFixed(1); out.lotsHeld = H; }
    if (W.premises && W.premises.stats) out.lotsHidden = W.premises.stats.lotsHidden, out.metlaBare = W.premises.stats.metlaBare;
  } catch (e) { out.censusErr = String(e && e.message || e); }
  return out;
})()
