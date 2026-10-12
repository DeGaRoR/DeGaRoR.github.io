// FREIGHT-STRAP (G2400-G2404) — THE STRAPPED LOAD'S DRAWING. futureDesigns/game/FREIGHT-2026-10-07.md §2 (the user,
// 7 Oct: "the load will be strapped visually and physically once accepted").
//
// The accepted load (77_ freightAccepted's items, the card's frame: x aft, y up, z to the right) drawn as ONE group:
//   - each item as its FREIGHT-ASSETS model (78_ FREIGHT_LOOK: the goods' prop, else the kind's), its IN-CABIN level
//     (the load ladder's level from 2 m: <= ~2k triangles; a hangar prop with no such level as itself), fitted to its
//     box exactly as the loading view fits it (freight_load.js itemObject: the long horizontal axes together, scaled to
//     the box, the base on the box's floor) - and every item of the load wearing the same material MERGED into one
//     geometry: one draw per (prop material), whatever the number of crates;
//   - an item with no model (mail sacks, kit bags, rods, the stretcher: the gap list) a box in its kind's colour,
//     merged per kind;
//   - THE STRAPS (78_ freightStrapMesh): a ratchet strap over each stack lengthwise and one across, from a foot on the
//     floor to a foot on the floor, one draw; the buckles and the floor anchors, one draw.
// The materials are the props' own (props.js propBuild: the hangar's crates are these crates) and two MATLIB records
// (a webbing and a steel): nothing here makes a material of its own, and an aeroplane with no load has no group at
// all (zero draws, no program).
//
// LAZY (tools/build.js MANIFEST.lazy): app.js's FREIGHT-STRAP block fetches it the first time an accepted load is to
// be drawn; it owns nothing of the scene - the block hangs the group where it goes (the stand: beside the loading
// view's own frame; in flight: under the flown model through the crew's cage -> model map).
(function () {
  'use strict';
  const W = window;
  const IN_CABIN = 2.5;                  // m: the load ladder's in-cabin level stands from 2 m (G2407)

  // the level a key is drawn at in the cabin: its first cut from IN_CABIN or nearer, else itself
  function levelKey(key) {
    if (typeof propLevels !== 'function' || typeof PROP_REG === 'undefined') return key;
    const lv = propLevels(key).find(l => l.dist <= IN_CABIN && PROP_REG.props[l.key]);
    return lv ? lv.key : key;
  }
  const hasProp = key => !!(key && typeof PROP_REG !== 'undefined' && PROP_REG.props && PROP_REG.props[key] &&
                            typeof propBuild === 'function' && typeof propWarm === 'function');
  const modelOf = it => { const k = typeof freightLookKey === 'function' ? freightLookKey(it) : null; return hasProp(k) ? k : null; };

  // ---- THE MERGE: per material, positions through the item's matrix, normals through its normal matrix --------------
  function bucket(B, mat) {
    let b = B.get(mat);
    if (!b) B.set(mat, b = { mat, parts: [] });
    return b;
  }
  function mergeBucket(T, b) {
    let nv = 0, ni = 0;
    for (const q of b.parts) { nv += q.geo.attributes.position.count; ni += q.geo.index ? q.geo.index.count : q.geo.attributes.position.count; }
    const names = Object.keys(b.parts[0].geo.attributes).filter(k => k !== 'uv1' && b.parts.every(q => q.geo.attributes[k]));
    const out = {};
    for (const k of names) { const A = b.parts[0].geo.attributes[k]; out[k] = { size: A.itemSize, arr: new (A.array.constructor)(nv * A.itemSize), norm: A.normalized }; }
    const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    const v3 = new T.Vector3(), nm = new T.Matrix3();
    let v = 0, t = 0;
    for (const q of b.parts) {
      const A = q.geo.attributes, n = A.position.count;
      nm.getNormalMatrix(q.M);
      for (const k of names) {
        const a = A[k], o = out[k], s = a.itemSize;
        if (k === 'position' || k === 'normal') {
          for (let i = 0; i < n; i++) {
            v3.set(a.getX(i), a.getY(i), a.getZ(i));
            if (k === 'position') v3.applyMatrix4(q.M); else v3.applyMatrix3(nm).normalize();
            o.arr[(v + i) * 3] = v3.x; o.arr[(v + i) * 3 + 1] = v3.y; o.arr[(v + i) * 3 + 2] = v3.z;
          }
        } else o.arr.set(a.array.subarray(0, n * s), v * s);
      }
      const I = q.geo.index ? q.geo.index.array : null;
      if (I) for (let j = 0; j < I.length; j++) idx[t + j] = I[j] + v;
      else for (let j = 0; j < n; j++) idx[t + j] = v + j;
      v += n; t += I ? I.length : n;
    }
    const g = new T.BufferGeometry();
    for (const k of names) g.setAttribute(k, new T.BufferAttribute(out[k].arr, out[k].size, out[k].norm));
    if (out.uv && b.parts[0].geo.attributes.uv1) g.setAttribute('uv1', g.attributes.uv);   // props.js: aoMap reads uv1 = uv
    g.setIndex(new T.BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }
  const arraysGeo = (T, G) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(G.pos), 3));
    g.setAttribute('normal', new T.BufferAttribute(new Float32Array(G.nrm), 3));
    g.setIndex(new T.BufferAttribute(G.pos.length / 3 > 65535 ? new Uint32Array(G.idx) : new Uint16Array(G.idx), 1));
    g.computeBoundingSphere();
    return g;
  };
  const lin = (T, h) => { const c = new T.Color(h); if (c.convertSRGBToLinear) c.convertSRGBToLinear(); return c; };
  // the two records the straps wear: a woven polyester webbing (the hangar's tie-down orange) and a zinc-plated steel
  function strapMats(T) {
    const M = W.MATLIB;
    if (!M || !M.shared) return null;
    return { web: M.shared(T, 'std', { color: lin(T, 0xd9772b), roughness: 0.82, metalness: 0 }),
             steel: M.shared(T, 'std', { color: lin(T, 0x9a9ea3), roughness: 0.38, metalness: 0.85 }) };
  }

  // an item's prop, fitted to its box (freight_load.js itemObject's fit, as one matrix): the prop's bounds centred
  // across, its base on the floor, turned a quarter when its long horizontal axis lies the other way, scaled to the box
  function fitMatrix(T, bb, at) {
    const s = new T.Vector3(); bb.getSize(s);
    const L = [at.x1 - at.x0, at.y1 - at.y0, at.z1 - at.z0];
    const turn = (s.x >= s.z) !== (L[0] >= L[2]);
    const sx = turn ? s.z : s.x, sz = turn ? s.x : s.z;
    const M = new T.Matrix4().makeTranslation(0.5 * (at.x0 + at.x1), at.y0, 0.5 * (at.z0 + at.z1));
    M.multiply(new T.Matrix4().makeScale(L[0] / Math.max(1e-3, sx), L[1] / Math.max(1e-3, s.y), L[2] / Math.max(1e-3, sz)));
    if (turn) M.multiply(new T.Matrix4().makeRotationY(Math.PI / 2));
    M.multiply(new T.Matrix4().makeTranslation(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2));
    return M;
  }
  const propBox = (T, built) => {
    const bb = new T.Box3();
    for (const g of built.dgeos) { if (!g.boundingBox) g.computeBoundingBox(); bb.union(g.boundingBox); }
    return bb;
  };

  // ---- THE LOAD ------------------------------------------------------------------------------------------------
  // items: the accepted items (with `at`), card: the hold's card -> Promise<{ grp, info }>; the props are warmed first
  // (a model whose bytes do not come draws as its box), so the group lands whole, once
  function build(T, items, card) {
    const L = (items || []).filter(p => p && p.at);
    const keys = [...new Set(L.map(modelOf).filter(Boolean).map(levelKey))];
    const warm = keys.map(k => propWarm(k).then(() => k, () => null));
    return Promise.all(warm).then(ok => {
      const ready = new Set(ok.filter(Boolean));
      const keyOf = it => { const k = modelOf(it); const lk = k ? levelKey(k) : null; return lk && ready.has(lk) ? lk : null; };
      const grp = new T.Group();
      grp.name = 'freightStrap';
      const info = { items: L.length, models: 0, boxes: 0, draws: 0, tris: 0, keys: [], stacks: 0, straps: 0 };
      // the props, merged per material
      const B = new Map();
      for (const it of L) {
        const k = keyOf(it);
        if (!k) continue;
        const built = propBuild(T, k);
        const M = fitMatrix(T, propBox(T, built), it.at);
        built.dgeos.forEach((g, i) => bucket(B, built.dmats[i]).parts.push({ geo: g, M }));
        info.models++;
        if (info.keys.indexOf(k) < 0) info.keys.push(k);
      }
      const add = (geo, mat, nm) => {
        const m = new T.Mesh(geo, mat);
        m.name = nm; m.castShadow = false; m.receiveShadow = true;
        m.matrixAutoUpdate = false; m.updateMatrix();
        m.raycast = () => {};                 // the editor's pick never takes the load for a part
        m.userData.freightStrap = true;
        grp.add(m);
        info.draws++; info.tris += (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
      };
      for (const b of B.values()) add(mergeBucket(T, b), b.mat, 'frsProp');
      // the boxes with no model, the straps, the metal (78_ freightStrapMesh)
      const S = freightStrapMesh(L, card, it => !!keyOf(it));
      const mats = strapMats(T);
      for (const kind of Object.keys(S.boxes)) {
        const col = (FREIGHT_LOOK.col[kind] != null) ? FREIGHT_LOOK.col[kind] : 0xb0a080;
        const mat = W.MATLIB ? W.MATLIB.shared(T, 'std', { color: lin(T, col), roughness: 0.85, metalness: 0 }) : null;
        if (mat) add(arraysGeo(T, S.boxes[kind]), mat, 'frsBox');
      }
      info.boxes = S.count.boxes; info.stacks = S.count.stacks; info.straps = S.count.bands;
      if (mats && S.straps.pos.length) add(arraysGeo(T, S.straps), mats.web, 'frsStraps');
      if (mats && S.metal.pos.length) add(arraysGeo(T, S.metal), mats.steel, 'frsMetal');
      return { grp, info };
    });
  }
  // gives back the group's own geometry (the materials are the props' and MATLIB's: shared, kept)
  function dispose(grp) {
    if (!grp) return;
    if (grp.parent) grp.parent.remove(grp);
    grp.traverse(o => { if (o.isMesh && o.userData.freightStrap && o.geometry) o.geometry.dispose(); });
  }
  W.FREIGHT_STRAP_VIEW = { build, dispose, levelKey, fitMatrix };
})();
