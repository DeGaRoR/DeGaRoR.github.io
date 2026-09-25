// ===========================================================================
// THE ROCK MAP — the rocks' far tier as their own image on the ground (2026-09-22,
// the user: "I'm not so sure from far away. Maybe we should have impostor for
// all rocks, or have them simply impact the texture by projecting their own
// image on it?").
// ===========================================================================
// The cover ring plants the shore's rocks (cobbles, the coast scans) as
// instanced meshes within 220 m of the eye and thins them to nothing by then;
// past it the shore was texture again. This draws the rocks' TOP VIEW into a
// map the ground shader reads where the meshes have faded: the same rocks, the
// same places (cover_ring.js placeRocks on the rock species' own stream, read
// again here through rockPlan), as albedo the ground lights like its own.
//
//   ROCK_SPRITES  every rock subject rendered ONCE from above into a slot of an
//                 atlas (an orthographic camera over its footprint, the plain
//                 albedo, the row's `cut` honoured: the sand skirt is the ground's)
//   THE MAP       a 2048 px render target over 2 km round the eye (1 m a texel):
//                 one instanced quad per subject wearing its slot, placed by the
//                 plan's x z yaw size (and the cobbles' tint as instanceColor),
//                 drawn top-down with alpha; re-centred when the eye has moved
//                 350 m; the cells re-planned as they come into range, a budget
//                 a frame, only the mixes that ask (`rockMap` on the mix)
//   THE READ      render_world's island ground hook: t = mix(t, map.rgb, map.a *
//                 (1 - meshK) * edge) after the splat, meshK the cover ring's own
//                 fade law at the fragment's distance (trees.js FADE_VS), so the
//                 meshes thin and the map fills in by the same curve
//
// SAMPLERS: one (uRockMap) on the near ring, the fine tiles and the outer ring
// - 13 / 15 of 16 (tools/sampler_census.js); the premises patch does not read it.
'use strict';
var ROCK_MAP = (() => {
  function make(THREE, ctx) {
    const { renderer, world, cover, camera, gU } = ctx;
    const S = { on: true, half: 1000, px: 2048, recentre: 350, cell: 32, budgetMs: 3, slot: 256, off: (typeof location !== 'undefined' && /[?&]rockmap=0/.test(location.search)) };
    const STAT = { planned: 0, rocks: 0, renders: 0, sprites: 0, lastPlanMs: 0 };
    const plans = new Map();          // 'cx,cz' -> records | null
    let cx0 = NaN, cz0 = NaN, dirty = false, ready = false, complete = false;

    // ---- the sprites: each subject's top view in a slot ----------------------------------
    const ATLAS = new THREE.WebGLRenderTarget(S.px, S.px, { depthBuffer: true, stencilBuffer: false });
    ATLAS.texture.colorSpace = THREE.NoColorSpace; ATLAS.texture.minFilter = THREE.LinearMipmapLinearFilter; ATLAS.texture.generateMipmaps = true;
    const slots = new Map();          // proto key -> { u0, v0, du, dv, r0 }
    const perRow = S.px / S.slot;
    function bakeSprites() {
      const protos = cover.rockProtos();
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
      const sc = new THREE.Scene();
      const old = renderer.getRenderTarget(), oldVp = renderer.getViewport(new THREE.Vector4()), oldSc = renderer.getScissor(new THREE.Vector4()), oldSt = renderer.getScissorTest();
      const oldCol = renderer.getClearColor(new THREE.Color()), oldA = renderer.getClearAlpha();
      renderer.setRenderTarget(ATLAS); renderer.setClearColor(0x000000, 0); renderer.clear();
      let k = 0;
      // G578: THE MATERIALS ARE KEPT FOR THE WHOLE BAKE. One made and disposed per part released its program with
      // it, and the next part linked the same program again - the census: 30 links of 2 programs in one roll-out.
      // Now one material per (map, cut), all alive until the atlas is drawn: the two programs link once each
      const kinds = new Map();
      const spriteMat = (map, cut) => {
        const key = (map ? map.uuid : '-') + '|' + (cut > 0 ? cut : 0);
        let m = kinds.get(key);
        if (!m) {
          m = new THREE.MeshBasicMaterial({ map: map || null, toneMapped: false });
          if (cut > 0) { const uCut = { value: cut }; m.onBeforeCompile = sh => { sh.uniforms.uCut = uCut;
            sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + String.fromCharCode(10) + 'varying float vRockY;').replace('#include <begin_vertex>', '#include <begin_vertex>' + String.fromCharCode(10) + 'vRockY = position.y;');
            sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + String.fromCharCode(10) + 'varying float vRockY; uniform float uCut;').replace('#include <map_fragment>', 'if (vRockY < uCut) discard;' + String.fromCharCode(10) + '#include <map_fragment>'); };
            m.customProgramCacheKey = () => 'rockmap-cut'; }
          kinds.set(key, m);
        }
        return m;
      };
      for (const { c, P } of protos) for (const p of P) {
        if (k >= perRow * perRow) break;
        const place = c.place || {}, cut = place.cut || 0, r0 = Math.max(0.05, p.r0 || 1);
        const meshes = p.parts.map(part => new THREE.Mesh(part.geo, spriteMat(part.mat.map, cut)));
        sc.clear(); meshes.forEach(m => sc.add(m));
        // from above: right = +x, up = -z (the world's north), the footprint [-r0, r0]
        cam.left = -r0; cam.right = r0; cam.top = r0; cam.bottom = -r0; cam.updateProjectionMatrix();
        cam.position.set(0, 100, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
        const i = k % perRow, j = Math.floor(k / perRow), x = i * S.slot, y = j * S.slot;
        renderer.setViewport(x, y, S.slot, S.slot); renderer.setScissor(x, y, S.slot, S.slot); renderer.setScissorTest(true);
        renderer.render(sc, cam);
        slots.set(p.key, { u0: x / S.px, v0: y / S.px, du: S.slot / S.px, dv: S.slot / S.px, r0, proto: p, c });
        k++;
      }
      for (const m of kinds.values()) m.dispose();
      renderer.setRenderTarget(old); renderer.setViewport(oldVp); renderer.setScissor(oldSc); renderer.setScissorTest(oldSt); renderer.setClearColor(oldCol, oldA);
      STAT.sprites = k;
    }

    // ---- the map ---------------------------------------------------------------------------
    const MAP = new THREE.WebGLRenderTarget(S.px, S.px, { depthBuffer: false, stencilBuffer: false });
    MAP.texture.colorSpace = THREE.NoColorSpace; MAP.texture.minFilter = THREE.LinearMipmapLinearFilter; MAP.texture.generateMipmaps = true;
    const mapScene = new THREE.Scene();
    const mapCam = new THREE.OrthographicCamera(-S.half, S.half, S.half, -S.half, 1, 4000);
    mapCam.up.set(0, 0, -1);
    const quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);   // local +y (texture up) -> -z, as the bake
    let meshes = [];
    const T = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    // ONE MATERIAL FOR EVERY SPRITE OF THE MAP (G578): they were identical, made per species and disposed at every
    // rebuild - so a recentre let the program go and linked it again
    const mapMat = new THREE.MeshBasicMaterial({ map: ATLAS.texture, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, alphaTest: 0.05 });
    function rebuild() {
      for (const m of meshes) { mapScene.remove(m); m.geometry.dispose(); }
      meshes = [];
      const by = new Map();   // proto key -> records
      let total = 0;
      for (const [key, recs] of plans) { if (!recs) continue;
        for (const r of recs) { let a = by.get(r.p.key); if (!a) { a = []; by.set(r.p.key, a); } a.push(r); total++; } }
      for (const [pk, recs] of by) {
        const sl = slots.get(pk); if (!sl) continue;
        const g = quad.clone();
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, sl.u0 + uv.getX(i) * sl.du, sl.v0 + uv.getY(i) * sl.dv);
        const m = new THREE.InstancedMesh(g, mapMat, recs.length);
        let anyCol = false;
        for (let i = 0; i < recs.length; i++) { const r = recs[i];
          Q.setFromAxisAngle(UP, r.yaw); V.set(r.x, 0, r.z); SC.set(2 * sl.r0 * r.s, 1, 2 * sl.r0 * r.s);
          T.compose(V, Q, SC); m.setMatrixAt(i, T);
          if (r.col) anyCol = true; }
        if (anyCol) { const col = new Float32Array(recs.length * 3); for (let i = 0; i < recs.length; i++) { const c = recs[i].col || [1, 1, 1]; col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2]; }
          m.instanceColor = new THREE.InstancedBufferAttribute(col, 3); }
        m.frustumCulled = false; m.instanceMatrix.needsUpdate = true;
        mapScene.add(m); meshes.push(m);
      }
      STAT.rocks = total;
    }
    function render() {
      const old = renderer.getRenderTarget(), oldCol = renderer.getClearColor(new THREE.Color()), oldA = renderer.getClearAlpha();
      mapCam.position.set(cx0, 2000, cz0); mapCam.lookAt(cx0, 0, cz0); mapCam.updateMatrixWorld();
      renderer.setRenderTarget(MAP); renderer.setClearColor(0x000000, 0); renderer.clear();
      renderer.render(mapScene, mapCam);
      renderer.setRenderTarget(old); renderer.setClearColor(oldCol, oldA);
      STAT.renders++;
      // the rect the ground reads: x0 z0 size on
      gU.uRockRect.value.set(cx0 - S.half, cz0 - S.half, 2 * S.half, 1);
    }

    // ---- per frame -------------------------------------------------------------------------
    function update() {
      if (!S.on || S.off) { gU.uRockRect.value.w = 0; return; }
      // A BAKE BEFORE ITS MAPS IS BLACK (G437's trap, met again here: the first atlas was black blobs on the shore):
      // the sprites bake once every rock subject's texture has an image, not before
      if (!ready) { const protos = cover.rockProtos(); if (!protos.length) return;
        const loaded = protos.every(({ P }) => P.every(p => p.parts.every(part => !part.mat.map || (part.mat.map.image && (part.mat.map.image.width || part.mat.map.image.complete)))));
        if (!loaded) return;
        try { bakeSprites(); } catch (e) { console.warn('rock map: the sprites did not bake', e); S.on = false; return; } gU.uRockMap.value = MAP.texture; ready = true; }
      const ex = camera.position.x, ez = camera.position.z;
      if (!(Math.hypot(ex - cx0, ez - cz0) <= S.recentre)) {
        cx0 = ex; cz0 = ez; dirty = true; complete = false;
        for (const key of [...plans.keys()]) { const [cx, cz] = key.split(',').map(Number); if (Math.hypot((cx + 0.5) * S.cell - cx0, (cz + 0.5) * S.cell - cz0) > S.half + 400) plans.delete(key); }
      }
      // the cells within the rect, nearest first, a budget a frame - and NOTHING once they are all
      // planned (PERF 2026-09-23: the rings were walked as full squares filtered to their edge, ~48 000
      // keys built and looked up every frame of the flight after the last cell was planned: 1.2 ms)
      const t0 = performance.now(), C = S.cell, n = Math.ceil(S.half / C) + 1;
      const cxc = Math.floor(cx0 / C), czc = Math.floor(cz0 / C);
      let planned = 0, cut = false;
      if (!complete) {
        const visit = (dx, dz) => {
          const key = (cxc + dx) + ',' + (czc + dz); if (plans.has(key)) return true;
          if (performance.now() - t0 > S.budgetMs) { cut = true; return false; }
          const recs = cover.rockPlan(cxc + dx, czc + dz);
          plans.set(key, recs && recs.length ? recs : null); planned++; STAT.planned++;
          if (recs && recs.length) dirty = true;
          return true;
        };
        outer: for (let r = 0; r <= n; r++) {
          if (!r) { if (!visit(0, 0)) break; continue; }
          // the ring's edge only, in the order the square walk met it (row by row)
          for (let dz = -r; dz <= r; dz++) {
            if (dz === -r || dz === r) { for (let dx = -r; dx <= r; dx++) if (!visit(dx, dz)) break outer; }
            else { if (!visit(-r, dz) || !visit(r, dz)) break outer; }
          }
        }
        if (!cut) complete = true;
      }
      STAT.lastPlanMs = performance.now() - t0;
      if (dirty && !planned) { rebuild(); render(); dirty = false; }   // once the frame has nothing left to plan
      else if (dirty && STAT.renders === 0) { rebuild(); render(); }   // and the first picture as soon as there is one
      // the mesh fade law (the cover ring's) for the read: near, reach, taper, aglK
      // the ring's own fade law, read from it: near, reach, taper, and the height term - times 0 when the ring
      // plants no rocks at all (F8's `rocks` at 0, the ablation: the map then stands alone instead of being
      // suppressed by meshes that are not there - 2026-09-22, the user: "I see nothing on the right side either")
      const cs = cover.get ? cover.get() : {}, st = cover.stat ? cover.stat() : {};
      const aglK = st.aglK === undefined ? 1 : st.aglK;
      gU.uRockFade.value.set(cs.near || 50, cs.reach || 220, cs.taper === undefined ? 0.5 : cs.taper, (cs.rocks === 0 ? 0 : aglK));
    }
    const api = { get: () => Object.assign({}, S), stat: () => Object.assign({ plans: plans.size }, STAT), set: o => { Object.assign(S, o || {}); complete = false; return api.get(); },
                  replan: () => { plans.clear(); dirty = true; complete = false; }, atlas: () => ATLAS.texture, map: () => MAP.texture, rt: () => MAP, atlasRT: () => ATLAS,
                  // the instrument: the map's coverage over a box in WORLD metres (the rigs read it; trace before hypothesis)
                  probe: (x0, z0, side) => { const n = Math.max(1, Math.round(side)); const buf = new Uint8Array(n * n * 4);
                    const u = Math.round((x0 - (cx0 - S.half)) / (2 * S.half) * S.px), v = Math.round((z0 - (cz0 - S.half)) / (2 * S.half) * S.px);
                    try { renderer.readRenderTargetPixels(MAP, u, S.px - v - n, n, n, buf); } catch (e) { return { err: e.message }; }
                    let a = 0, amax = 0, lit = 0, rgb = [0, 0, 0];
                    for (let i = 0; i < n * n; i++) { const A = buf[i * 4 + 3] / 255; a += A; if (A > amax) amax = A; if (A > 0.1) { lit++; rgb[0] += buf[i * 4]; rgb[1] += buf[i * 4 + 1]; rgb[2] += buf[i * 4 + 2]; } }
                    return { n: n * n, aMean: +(a / (n * n)).toFixed(3), aMax: +amax.toFixed(3), lit, rgbLit: lit ? rgb.map(c => Math.round(c / lit)) : null }; } };
    return { update, api };
  }
  return { make };
})();
if (typeof window !== 'undefined') window.ROCK_MAP = ROCK_MAP;
