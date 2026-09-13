// _premises_draw.js — THE PREMISES DRAWN (G353 / GPREM): the record turned into
// a scene, per layer, with dirty tracking — shared by the bench and, at the
// port, by the game (src/viewer/render_premises.js). Nothing here is a control:
// it draws what tools/_premises_gen.js composes and publishes the HANDLES the
// editor's PIN lights, from the build, never re-derived.
//
//   RENDER_PREMISES.make(THREE, scene, world, rec, opts) -> R
//     R.rebuild(dirty)      dirty = null (everything) | { layer, bbox } in the premises frame
//     R.step(n)             build up to n queued houses (the host's tick calls it)
//     R.setRecord(rec)      the record the next rebuild reads
//     R.ghost(feature, ok)  a Group for a feature not yet committed (outline, 0.45)
//     R.handles(id)         [{ key, p: [x, y, z] }] for one feature's handles
//     R.hit(x, z)           the nearest feature at a world point
//     R.heightAt(x, z)      the COMPOSED ground (the same function the chunks sampled)
//     R.dispose()
//     R.stats               { tris, chunks, ms, houses, trees, queued }
//
// THE GROUND is 64 m chunks sampled from the composed terrain at `opts.cell`
// metres; a dirty bbox rebuilds only the chunks it touches plus the falloff
// margin. THE ROADS are worn into a canvas the ground shader reads (the
// village's uWear: roads tint, they never cut — the grading is the core's).
// THE PLOTS are thin outlines; THE HOUSES come through the house generator,
// two per tick, each cached by its plot and seed; THE TREES through the tree
// payload's rungs in a THREE.LOD (a cone when the payload is not here).
(function () {
'use strict';
const PG = (typeof window !== 'undefined' && window.PREMISES_GEN) || (typeof require === 'function' && require('./_premises_gen.js'));

const CHUNK = 64;
const LAYER_COL = { terrain: 0xffa040, surface: 0x4fa7ff, material: 0xd28cff, exclude: 0xff5a5a, zones: 0x6fd08c, roads: 0xe0d090, runways: 0xffffff, objects: 0x9fe0ff };
const ZONE_COL = { residential: 0x6fd08c, commercial: 0x5db3ff, industrial: 0xe0a060, harbour: 0x4fc7d0, park: 0xa0e070, airfield: 0xffffff, forest: 0x2f8f4f, clear: 0xd0c090 };
const LIFT = 0.18;
const TREE_BANDS = [0, 60, 132];

function make(THREE, scene, world, rec0, opts) {
  const o = Object.assign({ cell: 1, water: true, grass: null, pool: () => [], onBuilt: null }, opts || {});
  let rec = PG.normalise(rec0 || PG.DEF());
  let O = PG.compose(rec, world, { pool: o.pool(), globals: window });
  const root = new THREE.Group(); root.name = 'premises';
  const G = {}; for (const k of ['ground', 'water', 'outlines', 'plots', 'houses', 'trees', 'runways', 'handles', 'ghost']) { G[k] = new THREE.Group(); G[k].name = 'premises:' + k; root.add(G[k]); }
  scene.add(root);
  const stats = { tris: 0, chunks: 0, ms: 0, houses: 0, houseTris: 0, trees: 0, queued: 0 };
  const bounds = world.bounds || { x0: -160, z0: -160, x1: 160, z1: 160 };
  const W = bounds.x1 - bounds.x0, H = bounds.z1 - bounds.z0;

  // ---- the ground, with the overlay and the wear -----------------------------
  const groundMat = new THREE.MeshStandardMaterial({ color: o.grass ? 0xffffff : 0x87906f, roughness: 0.97, metalness: 0 });
  if (o.grass) { groundMat.map = o.grass.map || null; groundMat.normalMap = o.grass.normalMap || null; }
  const OV = document.createElement('canvas'); OV.width = OV.height = 1024;
  const ovTex = new THREE.CanvasTexture(OV); ovTex.flipY = false; ovTex.wrapS = ovTex.wrapT = THREE.ClampToEdgeWrapping;
  const WR = document.createElement('canvas'); WR.width = WR.height = 1024;
  const wearTex = new THREE.CanvasTexture(WR); wearTex.flipY = false; wearTex.wrapS = wearTex.wrapT = THREE.ClampToEdgeWrapping;
  const uOv = { value: ovTex }, uWear = { value: wearTex }, uB = { value: new THREE.Vector4(bounds.x0, bounds.z0, W, H) }, uOvOn = { value: 1 }, uWaterY = { value: world.waterH ? world.waterH(0, 0) : -1e9 };
  groundMat.onBeforeCompile = sh => {
    sh.uniforms.uOv = uOv; sh.uniforms.uWear = uWear; sh.uniforms.uB = uB; sh.uniforms.uOvOn = uOvOn; sh.uniforms.uWaterY = uWaterY;
    sh.vertexShader = 'varying vec3 vPW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPW = transformed;');
    sh.fragmentShader = 'varying vec3 vPW;\nuniform sampler2D uOv, uWear;\nuniform vec4 uB;\nuniform float uOvOn, uWaterY;\n' +
      'float pHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
      'float pNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);\n' +
      '  return mix(mix(pHash(i), pHash(i + vec2(1, 0)), f.x), mix(pHash(i + vec2(0, 1)), pHash(i + vec2(1, 1)), f.x), f.y); }\n' +
      sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' +
        '  { vec2 uvw = (vPW.xz - uB.xy) / uB.zw;\n' +
        // the roads worn to earth (the village's wear canvas, verbatim in spirit)
        '    float wr = texture2D(uWear, uvw).r;\n' +
        '    float n = pNoise(vPW.xz * 3.1) * 0.6 + pNoise(vPW.xz * 9.7) * 0.4;\n' +
        '    float wear = smoothstep(0.15, 0.75, wr * (0.75 + 0.5 * n));\n' +
        '    vec3 earth = vec3(0.31, 0.26, 0.19) * (0.8 + 0.4 * pNoise(vPW.xz * 13.0));\n' +
        '    diffuseColor.rgb = mix(diffuseColor.rgb, earth, wear * 0.9);\n' +
        // the beach below a step above the tide
        '    float beach = 1.0 - smoothstep(uWaterY + 0.25, uWaterY + 1.1, vPW.y);\n' +
        '    vec3 sand = vec3(0.42, 0.39, 0.33) * (0.85 + 0.3 * pNoise(vPW.xz * 5.0));\n' +
        '    diffuseColor.rgb = mix(diffuseColor.rgb, sand, beach * 0.85);\n' +
        // the editor's overlay: surface classes, no-tree polygons
        '    vec4 ov = texture2D(uOv, uvw);\n' +
        '    diffuseColor.rgb = mix(diffuseColor.rgb, ov.rgb, ov.a * uOvOn); }');
  };
  const chunks = new Map();
  const ci0 = Math.floor(bounds.x0 / CHUNK), ci1 = Math.ceil(bounds.x1 / CHUNK) - 1, cj0 = Math.floor(bounds.z0 / CHUNK), cj1 = Math.ceil(bounds.z1 / CHUNK) - 1;
  function heightAt(x, z) { return O.terrainH(x, z, world.terrainH(x, z)); }
  function buildChunk(i, j) {
    const k = i + ',' + j;
    const old = chunks.get(k);
    if (old) { G.ground.remove(old); old.geometry.dispose(); }
    const x0 = Math.max(bounds.x0, i * CHUNK), z0 = Math.max(bounds.z0, j * CHUNK);
    const x1 = Math.min(bounds.x1, (i + 1) * CHUNK), z1 = Math.min(bounds.z1, (j + 1) * CHUNK);
    const nx = Math.max(1, Math.round((x1 - x0) / o.cell)), nz = Math.max(1, Math.round((z1 - z0) / o.cell));
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2);
    let p = 0, u = 0;
    for (let a = 0; a <= nx; a++) for (let b = 0; b <= nz; b++) {
      const x = x0 + (x1 - x0) * a / nx, z = z0 + (z1 - z0) * b / nz;
      pos[p++] = x; pos[p++] = heightAt(x, z); pos[p++] = z;
      uv[u++] = x / 2.4; uv[u++] = z / 2.4;
    }
    const idx = new (pos.length / 3 > 65535 ? Uint32Array : Uint16Array)(nx * nz * 6);
    let q = 0;
    for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
      const v = a * (nz + 1) + b;
      idx[q++] = v; idx[q++] = v + 1; idx[q++] = v + nz + 2; idx[q++] = v; idx[q++] = v + nz + 2; idx[q++] = v + nz + 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, groundMat);
    m.receiveShadow = true; m.castShadow = false; m.name = 'chunk:' + k; m.userData.chunk = [i, j];
    G.ground.add(m); chunks.set(k, m);
    return nx * nz * 2;
  }

  // ---- the water --------------------------------------------------------------
  let water = null;
  function buildWater() {
    if (water) { G.water.remove(water); water.geometry.dispose(); water = null; }
    if (!o.water) return;
    const wy = world.waterH ? world.waterH(0, 0) : 0;
    if (!isFinite(wy)) return;
    const g2 = new THREE.PlaneGeometry(W * 1.6, H * 1.6);
    g2.rotateX(-Math.PI / 2);
    water = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ color: 0x1f3a48, roughness: 0.32, metalness: 0, transparent: true, opacity: 0.86 }));
    water.position.set((bounds.x0 + bounds.x1) / 2, wy, (bounds.z0 + bounds.z1) / 2);
    water.receiveShadow = true; water.name = 'water';
    G.water.add(water);
  }

  // ---- the canvases: the overlay (classes) and the wear (roads) -----------------
  const SURF_COL = ['rgba(120,180,80,0)', 'rgba(150,140,130,0.55)', 'rgba(160,150,140,0.55)', 'rgba(60,90,40,0.4)', 'rgba(40,80,120,0.5)', 'rgba(90,90,95,0.7)', 'rgba(150,135,110,0.7)', 'rgba(200,185,140,0.6)'];
  const X = x => (x - bounds.x0) / W * 1024, Z = z => (z - bounds.z0) / H * 1024;
  function paintOverlay() {
    const g = OV.getContext('2d');
    g.clearRect(0, 0, 1024, 1024);
    const F = O.frame;
    const path = poly => { g.beginPath(); poly.forEach((p, i) => { const w = F.toWorld(p[0], p[1]); i ? g.lineTo(X(w[0]), Z(w[1])) : g.moveTo(X(w[0]), Z(w[1])); }); g.closePath(); };
    for (const s of rec.layers.surface) if (s.poly && s.poly.length >= 3) { path(s.poly); g.fillStyle = SURF_COL[s.surface] || SURF_COL[6]; g.fill(); }
    for (const e of rec.layers.exclude) if (e.poly && e.poly.length >= 3) { path(e.poly); g.fillStyle = 'rgba(255,90,90,0.18)'; g.fill(); }
    for (const z of rec.layers.zones) if (z.kind === 'clear' && z.poly && z.poly.length >= 3) { path(z.poly); g.fillStyle = 'rgba(208,192,144,0.18)'; g.fill(); }
    for (const r of O.runways) { path(PG.runwayBox(r, 0)); g.fillStyle = SURF_COL[r.surface] && r.surface !== 0 ? SURF_COL[r.surface] : 'rgba(110,125,60,0.35)'; g.fill(); }
    ovTex.needsUpdate = true;
  }
  function paintWear() {
    const g = WR.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const F = O.frame;
    const stroke = (pts, w, a) => {
      g.strokeStyle = 'rgba(255,255,255,' + a + ')'; g.lineWidth = w / W * 1024;
      g.beginPath(); pts.forEach((p, i) => { const q = F.toWorld(p[0], p[1]); i ? g.lineTo(X(q[0]), Z(q[1])) : g.moveTo(X(q[0]), Z(q[1])); }); g.stroke();
    };
    for (const r of O.roads) { stroke(r.pts, r.w + 2.0, 0.45); stroke(r.pts, r.w, 0.95); }
    wearTex.needsUpdate = true;
  }

  // ---- the outlines ------------------------------------------------------------
  const LINES = new Map();
  let selectedId = null;
  function groundLoop(pts, closed, lift) {
    const out = [];
    const n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.max(1, Math.ceil(L / 2));
      for (let s = 0; s < steps; s++) {
        const t = s / steps, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        out.push(x, heightAt(x, z) + lift, z);
      }
    }
    if (closed) out.push(out[0], out[1], out[2]);
    else { const e = pts[n - 1]; out.push(e[0], heightAt(e[0], e[1]) + lift, e[1]); }
    return new Float32Array(out);
  }
  function worldPts(entry) {
    const F = O.frame;
    const src = entry.poly || (entry.pts ? entry.pts.map(p => [p[0], p[1]]) : (entry.kind === 'tree' ? [[entry.x, entry.z]] : (entry.c && entry.len ? (E => [E.end0, E.end1])(PG.runwayEnds(Object.assign({}, PG.RUNWAY_DEF, entry))) : [])));
    return src.map(p => F.toWorld(p[0], p[1]));
  }
  function lineFor(layer, entry, colour, sel) {
    const pts = worldPts(entry);
    if (pts.length < 2) return null;
    const closed = !!entry.poly;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(groundLoop(pts, closed, LIFT), 3));
    const mat = new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity: sel ? 1 : 0.8, depthTest: false });
    const line = new THREE.Line(geo, mat);
    line.renderOrder = 8; line.name = layer + ':' + entry.id; line.userData.premId = entry.id;
    return line;
  }
  function buildOutlines() {
    for (const [, L] of LINES) { G.outlines.remove(L.line); L.line.geometry.dispose(); L.line.material.dispose(); }
    LINES.clear();
    for (const layer of ['terrain', 'surface', 'material', 'exclude', 'zones', 'roads']) for (const e of rec.layers[layer] || []) {
      const col = layer === 'zones' ? (ZONE_COL[e.kind] || LAYER_COL.zones) : (LAYER_COL[layer] || 0xffffff);
      const line = lineFor(layer, e, col, e.id === selectedId);
      if (!line) continue;
      G.outlines.add(line); LINES.set(e.id, { line, layer, entry: e });
      if (e.id === selectedId) { const l2 = lineFor(layer, e, 0xffffff, true); l2.material.opacity = 0.9; l2.position.y = 0.06; G.outlines.add(l2); LINES.set(e.id + ':sel', { line: l2, layer, entry: e }); }
    }
    // the site items' feet (cyan) and the links (a line from hook to hook)
    for (const it of O.records.items) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(groundLoop(it.foot.map(q => O.frame.toWorld(q[0], q[1])), true, LIFT * 0.8), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x4fc7d0, transparent: true, opacity: it.site === selectedId ? 0.95 : 0.5, depthTest: false }));
      line.renderOrder = 8; line.name = 'item:' + it.id;
      G.plots.add(line);
    }
    for (const L of O.records.links) if (L.geom && L.geom.from) {
      const a = O.frame.toWorld(L.geom.from[0], L.geom.from[2]), b = O.frame.toWorld(L.geom.to[0], L.geom.to[2]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([a[0], L.geom.from[1], a[1], b[0], L.geom.to[1], b[1]]), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: L.ok ? 0xffd060 : 0xff5a5a, transparent: true, opacity: 0.9, depthTest: false }));
      line.renderOrder = 8; line.name = 'link:' + L.link.id;
      G.plots.add(line);
    }
    // the plots: thin, dim, not hittable
    for (const c of G.plots.children.slice()) { G.plots.remove(c); c.geometry.dispose(); c.material.dispose(); }
    for (const p of O.records.plots) {
      const F = O.frame, pts = p.poly.map(q => F.toWorld(q[0], q[1]));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(groundLoop(pts, true, LIFT * 0.6), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: p.side === 'water' ? 0x4fc7d0 : 0x8fd0a0, transparent: true, opacity: 0.45, depthTest: false }));
      line.renderOrder = 7; line.name = 'plot:' + p.id;
      G.plots.add(line);
    }
  }

  // ---- the runways: the strip's paint over the composed ground, the pattern overlay ---
  // sitePaintStrip / siteRunway / sitePattern / patternPath come from the core
  // (flight_core.js in the page); with none the strip is a bare quad
  const SITE = o.site || {};
  function buildRunways() {
    for (const c of G.runways.children.slice()) { G.runways.remove(c); c.traverse(m => { if (m.geometry && !m.userData.sharedGeo) m.geometry.dispose(); if (m.material && m.material.map && m.userData.ownMap) m.material.map.dispose(); }); }
    O.runways.forEach((r, i) => {
      const A = O.aerodromes[i];
      const R = SITE.siteRunway ? SITE.siteRunway(A) : null;
      // the strip as a ribbon following the composed ground, 4 m along, 3 across
      const dx = Math.cos(A.hdg), dz = Math.sin(A.hdg), nx = -dz, nz = dx, hl = A.len / 2, hw = A.wid / 2;
      const na = Math.max(2, Math.ceil(A.len / 4)), nc = 2;
      const pos = new Float32Array((na + 1) * (nc + 1) * 3), uv = new Float32Array((na + 1) * (nc + 1) * 2);
      let k = 0, u = 0;
      for (let a = 0; a <= na; a++) for (let c = 0; c <= nc; c++) {
        const t = -hl + A.len * a / na, w = -hw + A.wid * c / nc;
        const x = A.x + dx * t + nx * w, z = A.z + dz * t + nz * w;
        pos[k++] = x; pos[k++] = heightAt(x, z) + 0.04; pos[k++] = z;
        // the paint canvas runs from end1 (u = 0) to end0 (u = 1) in sitePaintStrip's frame
        uv[u++] = 1 - a / na; uv[u++] = c / nc;
      }
      const idx = [];
      for (let a = 0; a < na; a++) for (let c = 0; c < nc; c++) { const v = a * (nc + 1) + c; idx.push(v, v + 1, v + nc + 2, v, v + nc + 2, v + nc + 1); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      let mat;
      if (R && SITE.sitePaintStrip) {
        const RW = 2048, RH = Math.max(64, Math.round(RW * A.wid / A.len));
        const cv = document.createElement('canvas'); cv.width = RW; cv.height = RH;
        SITE.sitePaintStrip(cv.getContext('2d'), R, RW, RH, true);
        const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
        mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      } else mat = new THREE.MeshStandardMaterial({ color: 0x9a9a8c, transparent: true, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.renderOrder = 6; m.name = 'runway:' + r.id; m.userData.premId = r.id; m.userData.ownMap = true;
      G.runways.add(m);
      // the pattern the pilot reads, drawn by the game's own builder when it is here
      if (SITE.sitePattern && window.PATTERN_VIS) {
        try {
          const pat = SITE.sitePattern(A, r.site || null);
          const pv = window.PATTERN_VIS.buildPatternVis(THREE, pat, (x, z) => heightAt(x, z), { patternPath: SITE.patternPath, siteRunway: SITE.siteRunway });
          const grp = pv.group || pv;
          if (pv.setLayers) pv.setLayers({ graph: true, slope: true, targets: true });
          grp.name = 'pattern:' + r.id;
          G.runways.add(grp);
        } catch (e) { console.warn('premises pattern', r.id, e && e.message); }
      }
    });
    stats.runways = O.runways.length;
  }

  // ---- the handles ----------------------------------------------------------------
  const discGeo = new THREE.CircleGeometry(1, 20); discGeo.rotateX(-Math.PI / 2);
  const discMat = new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 0.9, depthTest: false });
  const discMatMid = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthTest: false });
  const HANDLES = [];
  function buildHandles() {
    for (const h of HANDLES) G.handles.remove(h);
    HANDLES.length = 0;
    if (!selectedId) return;
    const f = PG.findById(rec, selectedId);
    if (!f) return;
    if (f.layer === 'sites') {
      const F = O.frame, SF = PG.siteFrame(f.entry);
      const put = (lp, key, mid) => { const w = F.toWorld(lp[0], lp[1]); const m = new THREE.Mesh(discGeo, mid ? discMatMid : discMat); m.position.set(w[0], heightAt(w[0], w[1]) + LIFT + 0.05, w[1]); m.renderOrder = 9; m.userData.handle = { id: selectedId, key, mid: !!mid }; G.handles.add(m); HANDLES.push(m); };
      put([SF.at.x, SF.at.z], 'at');
      for (const it of f.entry.items || []) put(SF.toLocal(it.x || 0, it.z || 0), 'i:' + it.id, true);
      return;
    }
    if (f.layer === 'runways') {
      const E = PG.runwayEnds(Object.assign({}, PG.RUNWAY_DEF, f.entry)), F = O.frame;
      const put = (lp, key, mid) => { const w = F.toWorld(lp[0], lp[1]); const m = new THREE.Mesh(discGeo, mid ? discMatMid : discMat); m.position.set(w[0], heightAt(w[0], w[1]) + LIFT + 0.05, w[1]); m.renderOrder = 9; m.userData.handle = { id: selectedId, key, mid: !!mid }; G.handles.add(m); HANDLES.push(m); };
      put(E.end0, 'e0'); put(E.end1, 'e1'); put(f.entry.c, 'c', true);
      return;
    }
    const pts = worldPts(f.entry);
    const closed = !!f.entry.poly;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const m = new THREE.Mesh(discGeo, discMat);
      m.position.set(p[0], heightAt(p[0], p[1]) + LIFT + 0.05, p[1]);
      m.renderOrder = 9; m.userData.handle = { id: selectedId, key: 'v' + i, index: i };
      G.handles.add(m); HANDLES.push(m);
      if (pts.length > 1 && (closed || i + 1 < pts.length)) {
        const q = pts[(i + 1) % pts.length], mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
        const mm = new THREE.Mesh(discGeo, discMatMid);
        mm.position.set(mx, heightAt(mx, mz) + LIFT + 0.05, mz);
        mm.renderOrder = 9; mm.userData.handle = { id: selectedId, key: 'm' + i, index: i, mid: true };
        G.handles.add(mm); HANDLES.push(mm);
      }
    }
  }
  function scaleHandles(camera, px) {
    for (const h of HANDLES) {
      const d = camera.position.distanceTo(h.position);
      const r = camera.isOrthographicCamera ? (camera.top - camera.bottom) / camera.zoom / (camera.userData.viewH || 600) * px
                                            : d * Math.tan((camera.fov || 40) * Math.PI / 360) * 2 / (camera.userData.viewH || 600) * px;
      h.scale.setScalar(Math.max(0.05, r) * (h.userData.handle.mid ? 0.7 : 1));
    }
  }

  // ---- the ghost ---------------------------------------------------------------------
  let ghostObj = null;
  function ghost(feature, ok) {
    if (ghostObj) { G.ghost.remove(ghostObj); ghostObj.geometry.dispose(); ghostObj.material.dispose(); ghostObj = null; }
    if (!feature) return null;
    const pts = worldPts(feature);
    if (pts.length < 1) return null;
    const closed = !!feature.poly && pts.length >= 3;
    const geo = new THREE.BufferGeometry();
    if (pts.length === 1) { const p = pts[0], h = heightAt(p[0], p[1]); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([p[0], h, p[1], p[0], h + 6, p[1]]), 3)); }
    else geo.setAttribute('position', new THREE.BufferAttribute(groundLoop(pts, closed, LIFT + 0.1), 3));
    const mat = new THREE.LineBasicMaterial({ color: ok === false ? 0xff5a5a : ok === 'warn' ? 0xe8c15a : 0x6fd08c, transparent: true, opacity: 0.85, depthTest: false });
    ghostObj = new THREE.Line(geo, mat); ghostObj.renderOrder = 10;
    G.ghost.add(ghostObj);
    return ghostObj;
  }

  // ---- the houses: the generator on every sown plot, two per tick, cached ---------------
  const HOUSES = new Map();     // plot id -> { seed, grp, tris }
  const queue = [];
  function tiltToGround(obj, g, x, z, ry) {
    const e = 0.12;
    const gx = (g(x + e, z) - g(x - e, z)) / (2 * e), gz = (g(x, z + e) - g(x, z - e)) / (2 * e);
    const n = new THREE.Vector3(-gx, 1, -gz).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    obj.quaternion.copy(q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry || 0)));
  }
  // the village bench's placeBuilt, less the point lights and the lot patch
  function placeBuilt(parent, house, built, F, HG) {
    const grp = new THREE.Group();
    const w = O.frame.toWorld(house.x, house.z);
    grp.position.set(w[0], house.y, w[1]);
    grp.rotation.y = house.yaw + O.frame.yaw;
    for (const k of (built.BAGS || HG.BAGS)) if (built.bags[k] && F.MAT[k]) built.bags[k].mesh(grp, F.MAT[k]);
    if (built.bags.smoke && F.MAT.smoke) { const sm = built.bags.smoke.mesh(grp, F.MAT.smoke); if (sm) { sm.renderOrder = 10; sm.castShadow = false; sm.receiveShadow = false; } }
    const st = built.stats, g = st.ground;
    const PR = (typeof window !== 'undefined' && window.PROP_REG) || null, pp = (typeof propPlace === 'function') ? propPlace : null;
    if (PR && pp) {
      if (st.pier) for (const m of st.pier.modules.concat(st.pier.boats)) if (PR.props[m.key]) grp.add(pp(THREE, m.key, m.x, m.z, m.ry, m.y));
      for (const q of st.people || []) if (PR.props[q.key]) grp.add(pp(THREE, q.key, q.x, q.z, q.ry, q.y));
      for (const q of st.yard || []) { if (!PR.props[q.key]) continue; const ob = pp(THREE, q.key, q.x, q.z, q.ry, q.y); if (q.on === 'ground' && g) tiltToGround(ob, g, q.x, q.z, q.ry); grp.add(ob); }
      if (st.lit) for (const L of st.lit.lights) if (L.prop && PR.props[L.prop]) grp.add(pp(THREE, L.prop, L.mx, L.mz, L.ry, L.my));
    }
    parent.add(grp);
    return grp;
  }
  // placeHouse — VERBATIM from tools/_village_gen.js (the village does not export
  // it, and that file is the house session's until its landing; then this
  // becomes `VILLAGE_GEN.placeHouse` and one export line there). The sampler's
  // house made to fit its plot and to stand on the composed ground.
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function placeHouse(T, V, plot, seed, rnd, preset) {
    const HG = window.HOUSE_GEN;
    const P = preset ? Object.assign({}, HG.DEF, HG.PRESETS[preset]) : HG.randomHouse(seed);
    if (preset) P.preset = preset;
    const n = plot.n, tg = plot.tg;
    const face = plot.side === 'water' ? [n[0], n[1]] : [-n[0], -n[1]];
    const yaw = Math.atan2(face[0], face[1]);
    const maxL = plot.w - 7, maxW = Math.min(plot.depth - 12, 9);
    P.L = clamp(P.L, 5, Math.max(5.5, maxL));
    P.w = clamp(P.w, 4, Math.max(4.2, maxW));
    if (P.porchD > plot.depth * 0.12) P.porchD = plot.depth * 0.12;
    P.slopeX = 0; P.slopeZ = 0;
    const cl = d => [plot.front[0] + n[0] * d, plot.front[1] + n[1] * d];
    let d, c;
    if (plot.side === 'water') {
      d = 6;
      while (d < plot.depth - V.riparian + 2 && T.h(cl(d)[0], cl(d)[1]) > T.waterY + 0.12) d += 0.5;
      c = cl(d);
      P.water = 1; P.stance = 3;
      P.porch = 1; P.stairs = 1; P.pier = 1;
      P.backDoor = 1; P.backPorch = 1; P.lean = 0;
    } else {
      d = 8 + rnd() * 4;
      c = cl(d);
      P.water = 0; P.pier = 0;
    }
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    let toWorld = (lx, lz) => [c[0] + lx * cy + lz * sy, c[1] - lx * sy + lz * cy];
    const fits = () => [[-1, -1], [1, -1], [1, 1], [-1, 1]].every(q => { const w = toWorld(q[0] * P.L / 2, q[1] * P.w / 2); return PG.inPoly(plot.poly, w[0], w[1]); });
    for (let it = 0; it < 30 && !fits(); it++) {
      if (P.L > 5.6) P.L *= 0.92;
      else if (P.w > 4.3) P.w *= 0.92;
      else { d -= 1; c = cl(d); toWorld = (lx, lz) => [c[0] + lx * cy + lz * sy, c[1] - lx * sy + lz * cy]; }
    }
    const oy = T.h(c[0], c[1]);
    const ground = (lx, lz) => { const w = toWorld(lx, lz); return T.h(w[0], w[1]) - oy; };
    P.ground = ground;
    P.waterY = T.waterY - oy;
    let hiC = -1e9, loC = 1e9;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const g = ground(sx * P.L / 2, sz * P.w / 2); hiC = Math.max(hiC, g); loC = Math.min(loC, g); }
    const rise = hiC;
    if (plot.side === 'water') P.floorY = Math.max(rise + 0.6, 1.8 + rnd() * 0.8);
    else {
      if (hiC - loC > 0.55 && P.stance < 2) P.stance = 2;
      P.floorY = rise + (P.stance === 0 ? 0.25 + rnd() * 0.15 : 0.45 + rnd() * 0.6);
    }
    P.skirt = HG.SKIRT_OK(P) && P.stance >= 1 && P.stance <= 3 && rnd() < 0.7 ? 1 : 0;
    return { P, x: c[0], z: c[1], y: oy, yaw, toWorld, ground, seed };
  }
  function buildHouse(plot) {
    const VG = window.VILLAGE_GEN, HG = window.HOUSE_GEN;
    if (!VG || !HG) return null;
    const waterY = world.waterH ? world.waterH(0, 0) : -1e9;
    const Tv = { h: (lx, lz) => O.localH(lx, lz), waterY, size: Math.max(W, H) };
    const rules = Object.assign({}, PG.ZONE_RULES, (rec.layers.zones.find(z => z.id === plot.zone) || {}).rules || {});
    const V = Object.assign({}, VG.VDEF, { plotDepth: rules.plotDepth, riparian: rules.riparian, seed: rec.seed });
    const rnd = PG.mulberry32(plot.seed);
    const house = (VG.placeHouse || placeHouse)(Tv, V, plot, plot.seed % 100000, rnd);
    const F = HG.makeFinish();
    HG.applyFinish(house.P, F);
    const built = HG.build(house.P, 0, F);
    built.BAGS = HG.BAGS;
    const grp = placeBuilt(G.houses, house, built, F, HG);
    return { grp, tris: built.stats.tris, house, built };
  }
  function buildItem(it) {
    const GEN = window[it.gen];
    if (!GEN) return null;
    const F = GEN.makeFinish();
    GEN.applyFinish(it.P, F);
    const built = GEN.build(it.P, 0, F);
    built.BAGS = GEN.BAGS;
    const grp = placeBuilt(G.houses, it, built, F, GEN);
    if (built.bags.aoskirt && GEN.MAT && GEN.MAT.aoskirt) { const sk = built.bags.aoskirt.mesh(grp, GEN.MAT.aoskirt); if (sk) { sk.renderOrder = 5; sk.castShadow = false; sk.receiveShadow = false; } }
    return { grp, tris: built.stats.tris, house: it, built };
  }
  const itemSeed = it => PG.hash32(it.seed, PG.fnv(JSON.stringify([it.x, it.z, it.yaw, it.key, it.P.tramTo || null, it.P.floorY])));
  function syncHouses() {
    const want = new Map();
    for (const p of O.records.plots) if (p.kind !== 'park' && p.kind !== 'airfield') want.set(p.id, p);
    for (const it of O.records.items) want.set(it.id, Object.assign({ seed: itemSeed(it), isItem: true, rec: it }, { id: it.id }));
    for (const [id, h] of HOUSES) { const p = want.get(id); if (!p || p.seed !== h.seed) { G.houses.remove(h.grp); h.grp.traverse(c => { if (c.geometry && !c.userData.sharedGeo) c.geometry.dispose(); }); HOUSES.delete(id); } }
    queue.length = 0;
    for (const [id, p] of want) if (!HOUSES.has(id)) queue.push(p);
    stats.queued = queue.length;
  }
  function step(n) {
    let built = 0;
    while (queue.length && built < (n || 2)) {
      const p = queue.shift();
      try { const h = p.isItem ? buildItem(p.rec) : buildHouse(p); if (h) HOUSES.set(p.id, { seed: p.seed, grp: h.grp, tris: h.tris, plot: p, house: h.house }); }
      catch (e) { console.warn('premises house', p.id, e && e.message); HOUSES.set(p.id, { seed: p.seed, grp: new THREE.Group(), tris: 0, plot: p, failed: true }); }
      built++;
    }
    stats.queued = queue.length; stats.houses = HOUSES.size; stats.houseTris = 0;
    for (const [, h] of HOUSES) stats.houseTris += h.tris || 0;
    if (built && o.onBuilt) o.onBuilt(built, queue.length);
    return built;
  }

  // ---- the trees: the payload's rungs in a THREE.LOD, a cone until it lands -----------------
  const TREE_DEPTH = new Map();
  const stubGeo = new THREE.ConeGeometry(2.2, 9, 7); stubGeo.translate(0, 6.5, 0);
  const stubTrunk = new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6); stubTrunk.translate(0, 1.2, 0);
  const stubMat = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.95 }), trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.95 });
  function treeDepth(mat) {
    let d = TREE_DEPTH.get(mat);
    if (d) return d;
    d = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: mat.map, alphaTest: Math.max(0.3, mat.userData && mat.userData.uCut ? mat.userData.uCut.value : 0.5), side: THREE.DoubleSide });
    TREE_DEPTH.set(mat, d);
    return d;
  }
  function buildTrees() {
    for (const c of G.trees.children.slice()) { G.trees.remove(c); c.traverse(m => { if (m.geometry && !m.userData.sharedGeo && m.geometry !== stubGeo && m.geometry !== stubTrunk) m.geometry.dispose(); }); }
    const ready = typeof treeBuild === 'function' && typeof treeReady === 'function' && treeReady();
    let tris = 0;
    const F = O.frame;
    for (const t of O.records.trees) {
      const w = F.toWorld(t.x, t.z);
      let obj;
      if (ready && t.key && t.key !== 'stub|tree') {
        obj = new THREE.LOD(); obj.name = 'tree:' + t.key;
        for (let r = 0; r < 3; r++) {
          const B = treeBuild(THREE, t.key, r, 'rungs');
          const g = new THREE.Group();
          for (const p of B.parts) { const m = new THREE.Mesh(p.geo, p.mat); m.castShadow = true; m.receiveShadow = true; m.userData.sharedGeo = true; if (p.cutout) m.customDepthMaterial = treeDepth(p.mat); g.add(m); }
          obj.addLevel(g, TREE_BANDS[r]);
          if (r === 0) tris += B.tris;
        }
        obj.scale.setScalar(t.size);
        obj.position.set(w[0], t.y - 0.05 - (t.sink || 0) * t.size, w[1]);
      } else {
        obj = new THREE.Group(); obj.name = 'tree:stub';
        const c = new THREE.Mesh(stubGeo, stubMat), k = new THREE.Mesh(stubTrunk, trunkMat);
        c.castShadow = k.castShadow = true; c.userData.sharedGeo = k.userData.sharedGeo = true;
        obj.add(c, k);
        obj.scale.setScalar((t.h || 12) / 11);
        obj.position.set(w[0], t.y, w[1]);
        tris += 30;
      }
      obj.rotation.y = t.yaw + F.yaw;
      obj.userData.tree = t;
      G.trees.add(obj);
    }
    stats.trees = O.records.trees.length; stats.treeTris = tris;
  }

  // ---- rebuild ---------------------------------------------------------------------------------
  function rebuild(dirty) {
    const t0 = performance.now();
    O = PG.compose(rec, world, { pool: o.pool(), globals: window });
    let n = 0;
    const groundDirty = !dirty || !dirty.bbox || dirty.ground !== false;
    if (!dirty || !dirty.bbox) {
      if (groundDirty) { for (let i = ci0; i <= ci1; i++) for (let j = cj0; j <= cj1; j++) { buildChunk(i, j); n++; } buildWater(); }
    } else if (groundDirty) {
      const F = O.frame, b = dirty.bbox, pad = (dirty.pad || 0) + 2;
      const c = [F.toWorld(b.x0 - pad, b.z0 - pad), F.toWorld(b.x1 + pad, b.z0 - pad), F.toWorld(b.x1 + pad, b.z1 + pad), F.toWorld(b.x0 - pad, b.z1 + pad)];
      const wx0 = Math.min(...c.map(p => p[0])), wx1 = Math.max(...c.map(p => p[0])), wz0 = Math.min(...c.map(p => p[1])), wz1 = Math.max(...c.map(p => p[1]));
      for (let i = Math.max(ci0, Math.floor(wx0 / CHUNK)); i <= Math.min(ci1, Math.floor(wx1 / CHUNK)); i++)
        for (let j = Math.max(cj0, Math.floor(wz0 / CHUNK)); j <= Math.min(cj1, Math.floor(wz1 / CHUNK)); j++) { buildChunk(i, j); n++; }
    }
    paintOverlay();
    paintWear();
    buildOutlines();
    buildRunways();
    buildHandles();
    syncHouses();
    buildTrees();
    stats.tris = 0; for (const [, m] of chunks) stats.tris += m.geometry.index.count / 3;
    stats.chunks = chunks.size; stats.ms = performance.now() - t0; stats.rebuilt = n;
    return stats;
  }

  // ---- queries --------------------------------------------------------------------------------
  function hit(x, z) {
    const F = O.frame, L = F.toLocal(x, z);
    let best = null, bestA = Infinity, near = null, nearD = 1.5;
    for (const [id, e] of LINES) {
      if (id.endsWith(':sel')) continue;
      const en = e.entry;
      if (en.poly) {
        if (PG.inPoly(en.poly, L[0], L[1])) { const a = Math.abs(PG.polyArea(en.poly)); if (a < bestA) { bestA = a; best = e; } }
        else { const d = PG.sdPoly(en.poly, L[0], L[1]); if (d < nearD) { nearD = d; near = e; } }
      } else if (en.pts) {
        for (let i = 0; i + 1 < en.pts.length; i++) { const d = PG.distPtSeg(L[0], L[1], en.pts[i], en.pts[i + 1]) - (en.w || en.width || 4) / 2; if (d < nearD) { nearD = d; near = e; } }
      }
    }
    for (const r of O.runways) if (PG.inPoly(PG.runwayBox(r, 2), L[0], L[1])) return { id: r.id, layer: 'runways', entry: PG.findById(rec, r.id).entry };
    for (const it of O.records.items) if (PG.inPoly(it.foot, L[0], L[1])) { const f = PG.findById(rec, it.site); if (f) return { id: it.site, layer: 'sites', entry: f.entry, item: it.item }; }
    // a hand-placed tree within two metres wins over the polygon under it
    let tree = null, td = 2.5;
    for (const ob of rec.layers.objects) if (ob.kind === 'tree') { const d = Math.hypot(ob.x - L[0], ob.z - L[1]); if (d < td) { td = d; tree = ob; } }
    if (tree) return { id: tree.id, layer: 'objects', entry: tree };
    const r = near || best;
    return r ? { id: r.entry.id, layer: r.layer, entry: r.entry } : null;
  }
  function handles(id) {
    const out = [];
    for (const h of HANDLES) if (h.userData.handle.id === id) out.push({ key: h.userData.handle.key, p: [h.position.x, h.position.y, h.position.z], mid: !!h.userData.handle.mid });
    return out;
  }
  function pickHandle(ray) {
    let best = null, bestD = Infinity;
    for (const h of HANDLES) { const r = h.scale.x * 1.6; const d = ray.distanceToPoint(h.position); if (d < r && d < bestD) { bestD = d; best = h.userData.handle; } }
    return best;
  }
  function dispose() {
    for (const [, m] of chunks) m.geometry.dispose();
    chunks.clear();
    for (const [, L] of LINES) { L.line.geometry.dispose(); L.line.material.dispose(); }
    LINES.clear();
    scene.remove(root);
  }

  const R = {
    root, groups: G, stats,
    rebuild, step, dispose, ghost, hit, handles, pickHandle, scaleHandles, heightAt,
    setRecord: r => { rec = PG.normalise(r); },
    get record() { return rec; },
    get overlay() { return O; },
    select: id => { selectedId = id || null; buildOutlines(); buildHandles(); },
    get selected() { return selectedId; },
    overlayOn: on => { uOvOn.value = on ? 1 : 0; },
    groundMat, plots: () => O.records.plots, houses: HOUSES, aerodromes: () => O.aerodromes, items: () => O.records.items, links: () => O.records.links,
  };
  return R;
}

const API = { make, CHUNK, LAYER_COL, ZONE_COL };
if (typeof window !== 'undefined') window.RENDER_PREMISES = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
