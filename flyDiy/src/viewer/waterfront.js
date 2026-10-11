// waterfront.js — THE WATERFRONT DRAWN (G3033; futureDesigns/WATERFRONT-2026-10-12.md §3).
//
// tools/_waterfront_gen.js builds a feature headless - plain meshes (the core, the crest track, the timber, the
// steel) and BATCHES (the armour's stones, the boats, the logs: a few prototypes at three rungs + per-instance
// matrices). This turns one or many built features into THREE objects:
//
//   * every plain mesh of one name across the features -> ONE merged BufferGeometry (positions, normals, colours),
//     one material per name: 'core', 'track', 'steel', 'deck', 'body', 'pile', 'buoy';
//   * every batch of one name -> TWO BatchedMeshes (cover_ring.js's idiom: per-instance frustum culling, matrices
//     never re-uploaded): NEAR - rung 0, casting (a stone within 40 m is the only one bigger than a sun-map texel) -
//     and FAR - rungs 1-2, no shadow. An instance is visible in exactly one of them or neither.
//   * THE PER-CAMERA PASS `update(cam)`: when the eye has moved > MOVE m, each instance gets its rung by distance and
//     the BACK-FLANK cut (its surface normal faces away from the eye: hidden by the convex mound) - spread over frames
//     (SLICE instances a call), so no frame pays for a whole harbour.
//   * THE WET BAND: the stones, the core, the piles and the floats' bodies darken and green from under the water up
//     through `tide` - MARINE_GEN's weed band in world y (the world has no tide; it is visual). Own program cache key
//     and ONE uniform set handed to every material that uses it, no per-material uniform at all (a cache-hit program
//     keeps the last compile's uniforms: the G1521 trap).
//
// The waterline foam ribbon is OFF by default and behind WATERFRONT_VIEW.set({ foam: 1 }) (the user's "white bands"
// ruling, G798); it is drawn only when asked.
'use strict';
const WATERFRONT_VIEW = (() => {
  const MOVE = 4, SLICE = 6000;
  const S = { foam: 0, tide: 1.8, wet: 0.62, algae: 0.45 };
  let U = null;                               // the shared wet-band uniforms (made with the first material)

  function wetHook(T, mat, k) {
    if (!U) U = { uWfWaterY: { value: 0 }, uWfTide: { value: S.tide }, uWfWet: { value: S.wet }, uWfAlgae: { value: S.algae }, uWfAlgaeCol: { value: new T.Color(0x3c4a3a) } };
    mat.userData.wfWet = k;
    mat.onBeforeCompile = sh => {
      for (const n in U) sh.uniforms[n] = U[n];
      sh.vertexShader = 'varying vec3 vWfP;\n' + sh.vertexShader.replace('#include <project_vertex>', [
        '#include <project_vertex>',
        'vec4 wfP = vec4(transformed, 1.0);',
        '#ifdef USE_BATCHING', 'wfP = batchingMatrix * wfP;', '#endif',
        '#ifdef USE_INSTANCING', 'wfP = instanceMatrix * wfP;', '#endif',
        'vWfP = (modelMatrix * wfP).xyz;'].join('\n'));
      sh.fragmentShader = 'varying vec3 vWfP;\nuniform float uWfWaterY, uWfTide, uWfWet, uWfAlgae;\nuniform vec3 uWfAlgaeCol;\n' + sh.fragmentShader.replace('#include <color_fragment>', [
        '#include <color_fragment>',
        // a ragged line: the band's top wanders by a hand with the stones
        'float wfN = sin(vWfP.x * 1.3 + vWfP.z * 0.7) * sin(vWfP.x * 0.4 - vWfP.z * 1.1);',
        'float wfH = vWfP.y - uWfWaterY;',
        'float wfWet = 1.0 - smoothstep(0.0, uWfTide * (0.85 + 0.15 * wfN), wfH);',
        'float wfAlg = wfWet * (1.0 - smoothstep(0.25, uWfTide * 0.6, wfH)) * uWfAlgae;',   // the weed in the lower half of the wet band
        'diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uWfWet, wfWet);',
        'diffuseColor.rgb = mix(diffuseColor.rgb, uWfAlgaeCol * (0.8 + 0.2 * wfN), clamp(wfAlg, 0.0, 1.0));'].join('\n'));
    };
    mat.customProgramCacheKey = () => 'wf-wet-1';
    return mat;
  }

  const LOOKS = {
    core: { roughness: 1.0, metalness: 0, wet: 1 }, track: { roughness: 0.98, metalness: 0, wet: 0 },
    steel: { roughness: 0.5, metalness: 0.55, wet: 0 }, deck: { roughness: 0.94, metalness: 0, wet: 0 },
    body: { roughness: 0.75, metalness: 0.05, wet: 1 }, pile: { roughness: 0.96, metalness: 0, wet: 1 },
    buoy: { roughness: 0.7, metalness: 0, wet: 0 },
    stone: { roughness: 0.96, metalness: 0, wet: 1 }, boat: { roughness: 0.6, metalness: 0.05, wet: 0 }, log: { roughness: 0.95, metalness: 0, wet: 1 },
  };
  function material(T, name) {
    const L = LOOKS[name] || LOOKS.core;
    const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: L.roughness, metalness: L.metalness });
    m.name = 'wf:' + name;
    return L.wet ? wetHook(T, m, 1) : m;
  }

  function geomOf(T, parts) {       // merge Mesh()es (tools/_waterfront_gen.js) into one indexed BufferGeometry
    let nv = 0, ni = 0;
    for (const m of parts) { nv += m.pos.length / 3; ni += m.idx.length; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0, oi = 0;
    for (const m of parts) {
      pos.set(m.pos, ov * 3); nor.set(m.nor, ov * 3); col.set(m.col, ov * 3);
      for (let i = 0; i < m.idx.length; i++) idx[oi + i] = m.idx[i] + ov;
      ov += m.pos.length / 3; oi += m.idx.length;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('normal', new T.BufferAttribute(nor, 3));
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    g.setIndex(new T.BufferAttribute(idx, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }

  // build(features, THREE, { waterY }) -> { group, update(camPos), set(o), dispose(), stats() }
  function build(features, T, opts) {
    const o = Object.assign({ waterY: 0 }, opts || {});
    const group = new T.Group(); group.name = 'waterfront';
    const mats = [], geos = [];
    // ---- the plain meshes, merged by name
    const byName = new Map();
    for (const f of features) for (const k in f.meshes) { const m = f.meshes[k]; if (!m.tris) continue; if (!byName.has(k)) byName.set(k, []); byName.get(k).push(m); }
    for (const [k, parts] of byName) {
      const g = geomOf(T, parts), mat = material(T, k);
      const mesh = new T.Mesh(g, mat);
      mesh.name = 'wf:' + k; mesh.matrixAutoUpdate = false;
      mesh.castShadow = k !== 'track'; mesh.receiveShadow = true;
      group.add(mesh); mats.push(mat); geos.push(g);
    }
    // ---- the batches: per name, a NEAR (rung 0, casting) and a FAR (rungs 1-2) BatchedMesh holding every instance
    const sets = [];
    const byBatch = new Map();
    for (const f of features) for (const k in f.batches) { const b = f.batches[k]; if (!b.inst.n) continue; if (!byBatch.has(k)) byBatch.set(k, []); byBatch.get(k).push(b); }
    const M4 = new T.Matrix4(), C = new T.Color();
    for (const [k, list] of byBatch) {
      const rings = (window.WATERFRONT_GEN && WATERFRONT_GEN.RINGS[k]) || [40, 120, 450];
      // the prototypes: every feature of one kind built its own set; keep each, keyed by the object
      const rung = [[], [], []];
      const protoGeo = new Map();
      const geoOf = m => { let g = protoGeo.get(m); if (!g) { g = geomOf(T, [m]); protoGeo.set(m, g); geos.push(g); } return g; };
      let nInst = 0;
      for (const b of list) { nInst += b.inst.n; for (let r = 0; r < 3; r++) for (const m of (r === 0 ? b.proto0 : r === 1 ? b.proto1 : (b.proto2 || b.proto1))) if (!rung[r].includes(m)) rung[r].push(m); }
      const mk = (protos, cast, name) => {
        let nv = 0, ni = 0; for (const m of protos) { nv += m.pos.length / 3; ni += m.idx.length; }
        const mat = material(T, k);
        const bm = new T.BatchedMesh(nInst, nv, ni, mat);
        bm.userData.ids = new Map(protos.map(m => [m, bm.addGeometry(geoOf(m))]));
        bm.perObjectFrustumCulled = true; bm.sortObjects = false; bm.frustumCulled = false;
        bm.matrixAutoUpdate = false; bm.castShadow = cast; bm.receiveShadow = true; bm.name = 'wf:' + k + ':' + name;
        group.add(bm); mats.push(mat);
        return bm;
      };
      const near = mk(rung[0], true, 'near'), far = mk(rung[1].concat(rung[2].filter(m => !rung[1].includes(m))), false, 'far');
      // the instance table: one row a stone/boat/log: its ids in both batches, its prototypes at each rung, its centre, normal
      const n = nInst, cx = new Float32Array(n), cy = new Float32Array(n), cz = new Float32Array(n), nr = new Float32Array(n * 3), hasN = new Uint8Array(n);
      const idN = new Int32Array(n), idF = new Int32Array(n), p0 = [], p1 = [], p2 = [], state = new Int8Array(n).fill(-1);
      let j = 0; const f1i = [];
      for (const b of list) {
        const I = b.inst;
        for (let i = 0; i < I.n; i++, j++) {
          M4.fromArray(I.mat, i * 16);
          const q = I.proto[i];
          p0[j] = near.userData.ids.get(b.proto0[q]); p1[j] = far.userData.ids.get(b.proto1[q]); p2[j] = far.userData.ids.get((b.proto2 || b.proto1)[q]);
          idN[j] = near.addInstance(p0[j]); idF[j] = far.addInstance(p1[j]); f1i.push(p1[j]);
          near.setMatrixAt(idN[j], M4); far.setMatrixAt(idF[j], M4);
          C.setRGB(I.col[i * 3], I.col[i * 3 + 1], I.col[i * 3 + 2]); near.setColorAt(idN[j], C); far.setColorAt(idF[j], C);
          near.setVisibleAt(idN[j], false); far.setVisibleAt(idF[j], false);
          cx[j] = I.mat[i * 16 + 12]; cy[j] = I.mat[i * 16 + 13]; cz[j] = I.mat[i * 16 + 14];
          if (I.nrm) { nr[j * 3] = I.nrm[i * 3]; nr[j * 3 + 1] = I.nrm[i * 3 + 1]; nr[j * 3 + 2] = I.nrm[i * 3 + 2]; hasN[j] = 1; }
        }
      }
      sets.push({ k, rings, near, far, n, cx, cy, cz, nr, hasN, idN, idF, p0, p1, p2, state, cursor: 0, f1: Int32Array.from(f1i) });
    }
    if (U) U.uWfWaterY.value = o.waterY;

    // ---- the per-camera pass
    let ex = Infinity, ey = Infinity, ez = Infinity, pending = 0;
    function update(cam) {
      if (Math.hypot(cam.x - ex, cam.y - ey, cam.z - ez) > MOVE) { ex = cam.x; ey = cam.y; ez = cam.z; pending = 0; for (const s of sets) { s.cursor = 0; pending += s.n; } }
      if (!pending) return;
      let budget = SLICE;
      for (const s of sets) {
        while (s.cursor < s.n && budget > 0) {
          const j = s.cursor++; budget--; pending--;
          const dx = s.cx[j] - ex, dy = s.cy[j] - ey, dz = s.cz[j] - ez, d = Math.hypot(dx, dy, dz);
          let r = d <= s.rings[0] ? 0 : d <= s.rings[1] ? 1 : d <= s.rings[2] ? 2 : 3;
          if (r < 3 && s.hasN[j] && (-(dx * s.nr[j * 3] + dy * s.nr[j * 3 + 1] + dz * s.nr[j * 3 + 2]) / (d || 1)) < -0.15) r = 3;   // the back flank
          if (r === s.state[j]) continue;
          s.near.setVisibleAt(s.idN[j], r === 0);
          s.far.setVisibleAt(s.idF[j], r === 1 || r === 2);
          if (r === 1 || r === 2) { const g = r === 1 ? s.p1[j] : s.p2[j]; if (s.f1[j] !== g) { s.far.setGeometryIdAt(s.idF[j], g); s.f1[j] = g; } }
          s.state[j] = r;
        }
      }
    }
    function set(v) { Object.assign(S, v || {}); if (U) { U.uWfTide.value = S.tide; U.uWfWet.value = S.wet; U.uWfAlgae.value = S.algae; } }
    function stats() {
      const out = { meshes: byName.size, batches: sets.length * 2, inst: [0, 0, 0, 0] };
      for (const s of sets) for (let j = 0; j < s.n; j++) if (s.state[j] >= 0) out.inst[s.state[j]]++;
      return out;
    }
    function dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); for (const s of sets) { s.near.dispose && s.near.dispose(); s.far.dispose && s.far.dispose(); } group.clear(); }
    return { group, update, set, stats, dispose };
  }
  return { build, set: v => Object.assign(S, v || {}), S };
})();
if (typeof window !== 'undefined') window.WATERFRONT_VIEW = WATERFRONT_VIEW;
