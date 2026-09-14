// render_premises.js — THE PREMISES DRAWN (G353 / GPREM; the bench's tools/_premises_draw.js, ported whole at G386): the record turned into
// a scene, per layer, with dirty tracking — shared by the bench and, at the
// port, by the game (src/viewer/render_premises.js). Nothing here is a control:
// it draws what src/core/27_premises.js composes and publishes the HANDLES the
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
const PG = (typeof window !== 'undefined' && window.PREMISES_GEN) || (typeof require === 'function' && require('../src/core/27_premises.js'));

const CHUNK = 64;
const LAYER_COL = { terrain: 0xffa040, surface: 0x4fa7ff, material: 0xd28cff, exclude: 0xff5a5a, zones: 0x6fd08c, roads: 0xe0d090, runways: 0xffffff, objects: 0x9fe0ff };
const ZONE_COL = { residential: 0x6fd08c, commercial: 0x5db3ff, industrial: 0xe0a060, harbour: 0x4fc7d0, park: 0xa0e070, airfield: 0xffffff, forest: 0x2f8f4f, clear: 0xd0c090 };
const LIFT = 0.18;
const TREE_BANDS = [0, 60, 132];

// the prop registry is a script-scope const of flight_core.js (51_prop_codec), never on window: read it where it lives
const propReg = () => (typeof PROP_REG !== 'undefined' ? PROP_REG : (typeof window !== 'undefined' && window.PROP_REG) || null);
// make(THREE, scene, world, rec, opts): the bench hands a bare world and the renderer composes; the GAME
// (opts.game) hands ITS world, whose terrainH already carries the premises (20_world.js composes it) -
// the renderer then reads the world's own overlay, recomposes through world.premises.set(rec, ...)
// with its builder, draws no ground of its own but a local fine PATCH over the extent (the inner
// ring is 17.6 m polys; the graded strip and the lawns need better), road RIBBONS (the wear canvas
// is the bench's), no trees (the world's stand, its excludes applied at the make) and no strip paint
// (the world paints every registry strip); outlines and handles only while opts.editing() says so
function make(THREE, scene, world, rec0, opts) {
  const o = Object.assign({ cell: 1, water: true, grass: null, pool: () => [], onBuilt: null, game: false, editing: () => true, patchMat: null, patchUV: null }, opts || {});
  let rec = PG.normalise(rec0 || PG.DEF());
  // the stations' builder for the cable solver: the generator's build, no finish (only the hooks are read)
  const buildFor = r => { const GEN = window[r.gen]; return GEN ? GEN.build(r.P, 0) : null; };
  const composeNow = () => o.game && world.premises ? (world.premises.set(rec, { build: buildFor, pool: o.pool() }) || PG.compose(rec, world.premises.base, { pool: o.pool(), globals: window, build: buildFor }))
                                                     : PG.compose(rec, world, { pool: o.pool(), globals: window, build: buildFor });
  let O = composeNow();
  const root = new THREE.Group(); root.name = 'premises';
  const G = {}; for (const k of ['ground', 'water', 'outlines', 'plots', 'houses', 'lots', 'trees', 'runways', 'roads', 'handles', 'ghost']) { G[k] = new THREE.Group(); G[k].name = 'premises:' + k; root.add(G[k]); }
  // THE LOTS group stands at the premises frame: what the village's plan functions draw in the
  // premises frame (fences, lot patches, cars, boats) goes in here untransformed
  const placeLots = () => { const a = O.frame.anchor; G.lots.position.set(a.x, 0, a.z); G.lots.rotation.y = O.frame.yaw; };
  placeLots();
  scene.add(root);
  const stats = { tris: 0, chunks: 0, ms: 0, houses: 0, houseTris: 0, trees: 0, queued: 0, lights: 0, objects: 0 };
  // the bench's bounds are the world's window; the game's are the premises' extent in the world (+ a margin)
  const extentWorld = () => { const F = O.frame, e = O.extent, c = [F.toWorld(e.x0, e.z0), F.toWorld(e.x1, e.z0), F.toWorld(e.x1, e.z1), F.toWorld(e.x0, e.z1)]; return { x0: Math.min(...c.map(q => q[0])) - 40, z0: Math.min(...c.map(q => q[1])) - 40, x1: Math.max(...c.map(q => q[0])) + 40, z1: Math.max(...c.map(q => q[1])) + 40 }; };
  const bounds = o.game ? extentWorld() : (world.bounds || { x0: -160, z0: -160, x1: 160, z1: 160 });
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
  function heightAt(x, z) { return o.game ? world.terrainH(x, z) : O.terrainH(x, z, world.terrainH(x, z)); }
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
  // THE PATCH (game): one fine mesh over the extent, 2 m polys, its border tucked 2.2 m under the ring
  // (the strips' own W13.2 law), the world's outer texture on it; re-sampled in place on a rebuild
  let patch = null, patchKey = '';
  function buildPatch() {
    const b = extentWorld(), key = [b.x0, b.z0, b.x1, b.z1].join(',');
    const RES = 2, LX = b.x1 - b.x0, LZ = b.z1 - b.z0;
    if (!patch || patchKey !== key) {
      if (patch) { G.ground.remove(patch); patch.geometry.dispose(); }
      const g = new THREE.PlaneGeometry(LX, LZ, Math.ceil(LX / RES), Math.ceil(LZ / RES));
      g.rotateX(-Math.PI / 2); g.translate((b.x0 + b.x1) / 2, 0, (b.z0 + b.z1) / 2);
      patch = new THREE.Mesh(g, o.patchMat || new THREE.MeshLambertMaterial({ color: 0x74853c }));
      patch.receiveShadow = true; patch.name = 'premises:patch';
      G.ground.add(patch); patchKey = key;
    }
    const pa = patch.geometry.attributes.position, uv = patch.geometry.attributes.uv;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i);
      const edge = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z), r = Math.min(1, Math.max(0, edge) / 40);
      pa.setY(i, world.terrainH(x, z) - 2.2 * (1 - r) * (1 - r));
      if (o.patchUV) { const q = o.patchUV(x, z); uv.setXY(i, q[0], q[1]); }
    }
    pa.needsUpdate = true; uv.needsUpdate = true;
    patch.geometry.computeVertexNormals();
    patch.geometry.computeBoundingSphere();
  }
  // THE ROADS (game): a draped ribbon per road in its class's tone (the bench wears them into its own
  // ground canvas; the game's terrain has no such canvas) - 3 m along, the width plus a soft verge
  const ROAD_TONE = { 6: 0x8f8574, 5: 0x63636a, 7: 0xb8a57e, 0: 0x6e6a4a, 3: 0x5d5844 };
  let roadMat = null;
  function buildRoads() {
    for (const c of G.roads.children.slice()) { G.roads.remove(c); if (c.geometry) c.geometry.dispose(); }
    if (!roadMat) roadMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const rd of O.roads) {
      const pr = PG.polyRoad(rd.pts, rd.w), n = Math.max(2, Math.ceil(pr.length / 3));
      const pos = [], col = [], idx = [], hw = rd.w / 2 + 0.6;
      const tone = new THREE.Color(ROAD_TONE[rd.surface] || 0x8f8574);
      for (let k = 0; k <= n; k++) {
        const a = pr.at(pr.length * k / n);
        for (const sgn of [-1, 1]) { const lx = a.p[0] + a.n[0] * hw * sgn, lz = a.p[1] + a.n[1] * hw * sgn; const w = O.frame.toWorld(lx, lz); pos.push(w[0], heightAt(w[0], w[1]) + 0.06, w[1]); col.push(tone.r, tone.g, tone.b); }
        if (k) { const b = 2 * k; idx.push(b - 2, b, b - 1, b - 1, b, b + 1); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, roadMat); m.renderOrder = 2; m.receiveShadow = true; m.name = 'road:' + rd.id;
      G.roads.add(m);
    }
  }
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
    // the garden paths (planPath's, on the built house), the outbuildings' and the parks' footpaths
    for (const [, h] of HOUSES) { const pl = h.plot; if (!pl || !pl.path) continue; for (const sg of (pl.path || []).concat(pl.outPath || [])) { stroke([sg[0], sg[1]], 1.3, 0.35); stroke([sg[0], sg[1]], 0.7, 0.8); } }
    for (const pk of O.records.parks || []) if (pk.path) { stroke(pk.path.pts, pk.path.width + 1.0, 0.35); stroke(pk.path.pts, pk.path.width, 0.8); if (pk.plan.path) stroke(pk.plan.path.pts, pk.plan.path.width, 0.7); }
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
    const src = entry.poly || (entry.pts ? entry.pts.map(p => [p[0], p[1]]) : (entry.kind === 'tree' || entry.kind === 'prop' || entry.kind === 'billboard' ? [[entry.x, entry.z]] : (entry.c && entry.len ? (E => [E.end0, E.end1])(PG.runwayEnds(Object.assign({}, PG.RUNWAY_DEF, entry))) : [])));
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
    for (const L of O.records.links) if (L.geom && L.geom.ropes) for (const rope of L.geom.ropes) {
      // a rope from a to b (the village's frame = the premises frame, heights absolute), with the sag the motion plan draws
      const a = O.frame.toWorld(rope.a[0], rope.a[2]), b = O.frame.toWorld(rope.b[0], rope.b[2]);
      const n = 24, pos = new Float32Array((n + 1) * 3), S = 0.012 * Math.hypot(b[0] - a[0], rope.b[1] - rope.a[1], b[1] - a[1]);
      for (let i = 0; i <= n; i++) { const t = i / n; pos[i * 3] = a[0] + (b[0] - a[0]) * t; pos[i * 3 + 1] = rope.a[1] + (rope.b[1] - rope.a[1]) * t - 4 * S * t * (1 - t); pos[i * 3 + 2] = a[1] + (b[1] - a[1]) * t; }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: rope.kind === 'haul' ? 0x9aa0a8 : 0x30343a, transparent: true, opacity: 0.95 }));
      line.renderOrder = 8; line.name = 'rope:' + L.link.id;
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
      // the game paints every registry strip itself (render_world's decals); here only the pattern, while editing
      if (o.game) {
        if (o.editing() && SITE.sitePattern && window.PATTERN_VIS) {
          try {
            const pat = SITE.sitePattern(A, r.site || null);
            const pv = window.PATTERN_VIS.buildPatternVis(THREE, pat, (x, z) => heightAt(x, z), { patternPath: SITE.patternPath, siteRunway: SITE.siteRunway });
            const grp = pv.group || pv; if (pv.setLayers) pv.setLayers({ graph: true, slope: true, targets: true }); grp.name = 'pattern:' + r.id; G.runways.add(grp);
          } catch (e) { console.warn('premises pattern', r.id, e && e.message); }
        }
        return;
      }
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
      // THE STAND and its way out: the stand's disc and one per taxi point (the last stays on the centreline)
      if (f.entry.stand && f.entry.taxiOut) { put([f.entry.stand.x, f.entry.stand.z], 'stand'); f.entry.taxiOut.forEach((q, i) => put(q, 'tx' + i, true)); }
      // THE HOLDS: the pattern's two stop bars, draggable along the centreline (the pattern's hand)
      const A = O.aerodromes[O.runways.findIndex(r => r.id === selectedId)];
      if (A && SITE.sitePattern) {
        try {
          const pat = SITE.sitePattern(A, f.entry.site || null);
          for (const hid of pat.stops || []) { const nd = pat.nodes.find(n => n.id === hid); if (!nd) continue; const m = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ color: 0xe6c35c, transparent: true, opacity: 0.95, depthTest: false })); m.position.set(nd.x, heightAt(nd.x, nd.z) + LIFT + 0.08, nd.z); m.renderOrder = 9; m.userData.handle = { id: selectedId, key: 'hold:' + hid, mid: false }; G.handles.add(m); HANDLES.push(m); }
        } catch (e) {}
      }
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
    const PR = propReg(), pp = (typeof propPlace === 'function') ? propPlace : null;
    if (PR && pp) {
      if (st.pier) for (const m of st.pier.modules.concat(st.pier.boats)) if (PR.props[m.key]) grp.add(pp(THREE, m.key, m.x, m.z, m.ry, m.y));
      for (const q of st.people || []) if (PR.props[q.key]) grp.add(pp(THREE, q.key, q.x, q.z, q.ry, q.y));
      for (const q of st.yard || []) { if (!PR.props[q.key]) continue; const ob = pp(THREE, q.key, q.x, q.z, q.ry, q.y); if (q.on === 'ground' && g) tiltToGround(ob, g, q.x, q.z, q.ry); grp.add(ob); }
      if (st.lit) for (const L of st.lit.lights) if (L.prop && PR.props[L.prop]) grp.add(pp(THREE, L.prop, L.mx, L.mz, L.ry, L.my));
    }
    parent.add(grp);
    return grp;
  }
  function buildHouse(plot) {
    const VG = window.VILLAGE_GEN, HG = window.HOUSE_GEN;
    if (!VG || !HG) return null;
    const waterY = world.waterH ? world.waterH(0, 0) : -1e9;
    const Tv = { h: (lx, lz) => O.localH(lx, lz), waterY, size: Math.max(W, H) };
    const rules = Object.assign({}, PG.ZONE_RULES, (rec.layers.zones.find(z => z.id === plot.zone) || {}).rules || {});
    const V = Object.assign({}, VG.VDEF, { plotDepth: rules.plotDepth, riparian: rules.riparian, seed: rec.seed });
    const rnd = PG.mulberry32(plot.seed);
    // the pick: a preset of the house generator when the zone's tag found one; the sampler else
    let preset;
    if (plot.pick && plot.pick !== 'sampler') { const e = PG.collect(window).entries.get(plot.pick); if (e && e.gen === 'HOUSE_GEN') preset = e.preset; }
    const house = VG.placeHouse(Tv, V, plot, plot.seed % 100000, rnd, preset);   // the village's own, exported at its landing (G369.1)
    if (!SPREAD && HG.makeSpread) SPREAD = HG.makeSpread();
    if (SPREAD) house.P.spread = SPREAD;
    const F = HG.makeFinish();
    HG.applyFinish(house.P, F);
    const built = HG.build(house.P, 0, F);
    built.BAGS = HG.BAGS;
    const grp = placeBuilt(G.houses, house, built, F, HG);
    const D = dressPlot(plot, house, built, V, Tv);
    return { grp, tris: built.stats.tris + D.tris, house, built, extra: D.groups, lights: litOf(built) + D.lights };
  }
  // THE DRESSING (v5): the village's own plan functions on the BUILT house - the garden path, the
  // fences (a neighbour's fence is this fence: one edge set for the whole premises), the outbuilding,
  // the car and the boat, and the lot's ground patch reading them all; drawn in the premises frame
  // under G.lots, the outbuilding as a house of its own
  let SPREAD = null;
  const FENCED = new Set();
  const FENCE_HAND = 0.6;
  let FENCE_F = null;
  function fenceFinish() {
    if (FENCE_F) return FENCE_F;
    const HG = window.HOUSE_GEN;
    // weathered brown boards and the frame's rough timber (the village's G277/G280 rulings)
    const P = Object.assign({}, HG.DEF, { postSet: HG.SET_IDX('post', 'rough'), deckSet: HG.SET_IDX('deck', 'wornwood'), frameAge: 0.8, hand: FENCE_HAND, weather: 0.8 });
    const F = HG.makeFinish();
    HG.applyFinish(P, F);
    F.MAT.deck.color.multiplyScalar(0.5);
    F.MAT.post.color.multiplyScalar(0.6);
    FENCE_F = F;
    return F;
  }
  const litOf = built => (built && built.stats && built.stats.lit && built.stats.lit.lights ? built.stats.lit.lights.length : 0);
  // the fence segments of one plot (or park) into their own baked bags under G.lots; the posts' feet out
  function fenceGroup(segs, T, seed, posts) {
    const VG = window.VILLAGE_GEN, HG = window.HOUSE_GEN, HK = window.HOUSE_KIT, PR = propReg(), pp = typeof propPlace === 'function' ? propPlace : null;
    if (!VG || !HK || !segs || !segs.length) return null;
    const F = fenceFinish();
    const bags = { post: HK.Bag('post'), deck: HK.Bag('deck') };
    const grp = new THREE.Group(); grp.name = 'fence';
    let n = 0;
    for (const seg0 of segs) {
      const seg = VG.clipToLand(T, seg0);
      if (!seg) continue;
      if (seg.style === 'old' && pp && PR && PR.props.fence_old && HG.YARD_KIT && HG.YARD_KIT.fence_old) {
        // the scanned stretch, one prop width at a time along the edge, on the ground under its own middle, the gate's bay left out
        const L = Math.hypot(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]), tg = [(seg.b[0] - seg.a[0]) / L, (seg.b[1] - seg.a[1]) / L];
        const Wd = HG.YARD_KIT.fence_old.W, ry = Math.atan2(tg[0], tg[1]) - Math.PI / 2;
        const parts = seg.gap ? [[0, Math.max(0, seg.gap[0])], [Math.min(L, seg.gap[1]), L]] : [[0, L]];
        for (const [u0, u1] of parts) {
          if (u1 - u0 < 0.8) continue;
          const ns = Math.max(1, Math.round((u1 - u0) / Wd)), pw = (u1 - u0) / ns;
          for (let i = 0; i < ns; i++) { const tm = u0 + pw * (i + 0.5), x = seg.a[0] + tg[0] * tm, z = seg.a[1] + tg[1] * tm; const o = pp(THREE, 'fence_old', x, z, ry, T.h(x, z) - 0.03); o.scale.x = pw / Wd; grp.add(o); n++; }
        }
        if (seg.gap) n += VG.gateLeaf(bags, T, seg.a, tg, Math.max(0.3, seg.gap[0]), Math.min(L - 0.3, seg.gap[1]), 1.15, FENCE_HAND, () => 0.3, 'old');
      } else { seg.feet = posts || []; n += VG.buildFence(bags, T, seg, FENCE_HAND, seed); }
    }
    if (!n) return null;
    HK.bakeAO([bags.post, bags.deck], { strength: 0.85, range: 0.5, ground: T.h });
    for (const k in bags) bags[k].mesh(grp, F.MAT[k]);
    G.lots.add(grp);
    return grp;
  }
  function dressPlot(plot, house, built, V, Tv) {
    const VG = window.VILLAGE_GEN, HG = window.HOUSE_GEN, PR = propReg(), pp = typeof propPlace === 'function' ? propPlace : null;
    const out = { groups: [], tris: 0, lights: 0 };
    if (!VG || !VG.finishPlot) return out;
    const rd = O.roads.find(r => r.id === plot.road) || O.roads[0];
    if (!rd) return out;
    const T = { h: Tv.h, size: Tv.size, waterY: Tv.waterY };
    const vil = { rnd: PG.mulberry32(plot.seed ^ 0x5eed), V, road: { pts: rd.pts, w: rd.w }, fenced: FENCED, T, spread: SPREAD, plots: O.records.plots, houses: [] };
    try { VG.finishPlot(vil, plot, house, built); } catch (e) { console.warn('premises dress', plot.id, e && e.message); return out; }
    const posts = [];
    const fg = fenceGroup(plot.fences, T, (PG.fnv(String(plot.id)) % 1000) * 7 + 1, posts);
    if (fg) out.groups.push(fg);
    // the outbuilding: the same generator, its own finish, a house of its own in the world
    if (plot.out) {
      try {
        const F2 = HG.makeFinish(); HG.applyFinish(plot.out.P, F2);
        const b2 = HG.build(plot.out.P, 0, F2); b2.BAGS = HG.BAGS; plot.out.built = b2;
        out.groups.push(placeBuilt(G.houses, plot.out, b2, F2, HG)); out.tris += b2.stats.tris; out.lights += litOf(b2);
      } catch (e) { console.warn('premises outbuilding', plot.id, e && e.message); plot.out = null; }
    }
    // the car and the boat on the ground, tilted to it; the occluders the lot patch reads
    const grp = new THREE.Group(); grp.name = 'yard:' + plot.id;
    const occ = [];
    const toW = (hh, o) => { const w = hh.toWorld(o.x, o.z); return Object.assign({}, o, { x: w[0], z: w[1], ry: (o.ry || 0) + hh.yaw }); };
    for (const o of built.stats.groundAO || []) occ.push(toW(house, o));
    if (plot.out && plot.out.built) for (const o of plot.out.built.stats.groundAO || []) occ.push(toW(plot.out, o));
    for (const c of [plot.car, plot.boat]) if (c && pp && PR && PR.props[c.key]) {
      const o = pp(THREE, c.key, c.x, c.z, c.ry, c.y); tiltToGround(o, T.h, c.x, c.z, c.ry); grp.add(o);
      const K = plot.car === c ? (HG.YARD_KIT || {})[c.key] : (HG.PIER_KIT || {})[c.key];
      if (K) occ.push({ x: c.x, z: c.z, hx: K.W / 2, hz: K.L / 2, ry: c.ry, k: plot.car === c ? 0.65 : 0.6, soft: plot.car === c ? 1.0 : 0.9 });
    }
    for (const f of posts) if (Math.abs(f[0] - house.x) < 40 && Math.abs(f[1] - house.z) < 40) occ.push({ x: f[0], z: f[1], r: 0.07, k: 0.45, soft: 0.35 });
    if (window.LOT_GROUND && VG.lotGround) {
      try { const L = VG.lotGround(vil, plot, house, built, occ); window.LOT_GROUND.mesh(THREE, grp, L, () => { if (o.onBuilt) o.onBuilt(0, queue.length); }); }
      catch (e) { console.warn('premises lot', plot.id, e && e.message); }
    }
    G.lots.add(grp); out.groups.push(grp);
    return out;
  }
  // a placed prop or billboard (v5): a prop through propPlace on the composed ground, a billboard
  // through BIG_GEN.billboard with its own finish (the board IS the texture); in the world frame
  function buildObject(ob) {
    const PR = propReg(), pp = typeof propPlace === 'function' ? propPlace : null;
    const w = O.frame.toWorld(ob.x, ob.z), yaw = ob.yaw + O.frame.yaw;
    if (ob.kind === 'prop') {
      if (!pp || !PR || !PR.props[ob.key]) return null;
      const g = pp(THREE, ob.key, w[0], w[1], yaw, ob.y);
      if (ob.on === 'ground') tiltToGround(g, (x, z) => O.terrainAt(x, z), w[0], w[1], yaw);
      G.houses.add(g);
      let tris = 0; g.traverse(m => { if (m.isMesh && m.geometry) { const q = m.geometry; tris += (q.index ? q.index.count : (q.attributes.position ? q.attributes.position.count : 0)) / 3; } });
      return { grp: g, tris: Math.round(tris), house: ob };
    }
    if (ob.kind === 'billboard') {
      const BG = window.BIG_GEN;
      if (!BG || !BG.billboard) return null;
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      const bb = BG.billboard({ key: ob.key, w: ob.w, ground: (x, z) => O.terrainAt(w[0] + x * c + z * sn, w[1] - x * sn + z * c) - ob.y });
      const F = BG.billboardFinish(ob.key);
      const grp = new THREE.Group(); grp.position.set(w[0], ob.y, w[1]); grp.rotation.y = yaw;
      for (const k of bb.BAGS) bb.bags[k].mesh(grp, F.MAT[k]);
      if (bb.bags.aoskirt && window.HOUSE_GEN && window.HOUSE_GEN.MAT && window.HOUSE_GEN.MAT.aoskirt) { const sk = bb.bags.aoskirt.mesh(grp, window.HOUSE_GEN.MAT.aoskirt); if (sk) { sk.renderOrder = 5; sk.castShadow = false; sk.receiveShadow = false; } }
      G.houses.add(grp);
      let tris = 0; grp.traverse(m => { if (m.isMesh && m.geometry) { const q = m.geometry; tris += (q.index ? q.index.count : (q.attributes.position ? q.attributes.position.count : 0)) / 3; } });
      return { grp, tris: Math.round(tris), house: ob };
    }
    return null;
  }
  const objectSeed = ob => PG.hash32(PG.fnv(String(ob.id)), PG.fnv(JSON.stringify([ob.kind, ob.key, ob.x, ob.z, ob.yaw, ob.y, ob.w, ob.on])));
  function buildItem(it) {
    const GEN = window[it.gen];
    if (!GEN) return null;
    const F = GEN.makeFinish();
    GEN.applyFinish(it.P, F);
    const built = GEN.build(it.P, 0, F);
    built.BAGS = GEN.BAGS;
    const grp = placeBuilt(G.houses, it, built, F, GEN);
    if (built.bags.aoskirt && GEN.MAT && GEN.MAT.aoskirt) { const sk = built.bags.aoskirt.mesh(grp, GEN.MAT.aoskirt); if (sk) { sk.renderOrder = 5; sk.castShadow = false; sk.receiveShadow = false; } }
    return { grp, tris: built.stats.tris, house: it, built, lights: litOf(built) };
  }
  const itemSeed = it => PG.hash32(it.seed, PG.fnv(JSON.stringify([it.x, it.z, it.yaw, it.key, it.P.tramTo || null, it.P.floorY])));
  // a park on its plot: the totem generator's world-frame build (no ground of its own - the lawn is
  // the composed terrain, flattened by the composer); its slot's house is an item like a site's
  function buildPark(pk) {
    const TG = window[pk.gen];
    if (!TG || typeof TG.totemBuild !== 'function') return null;
    const grp = TG.totemBuild(THREE, pk.plan, { ghost: false });
    let tris = 0;
    grp.traverse(m => { if (m.isMesh && m.geometry) { const g = m.geometry; tris += (g.index ? g.index.count : (g.attributes.position ? g.attributes.position.count : 0)) / 3; } });
    G.houses.add(grp);
    const extra = [];
    const Tp = { h: (lx, lz) => O.localH(lx, lz), size: Math.max(W, H), waterY: world.waterH ? world.waterH(0, 0) : -1e9 };   // clipToLand reads waterY
    const fg = fenceGroup(pk.fences, Tp, 991, []);
    if (fg) extra.push(fg);
    return { grp, tris: Math.round(tris), house: pk, extra };
  }
  const parkSeed = pk => PG.hash32(pk.seed, PG.fnv(JSON.stringify([pk.plan.centre, pk.plan.yaw, pk.level, pk.key])));
  function syncHouses() {
    const want = new Map();
    for (const p of O.records.plots) if (p.kind !== 'park' && p.kind !== 'airfield') want.set(p.id, p);
    for (const it of O.records.items) want.set(it.id, Object.assign({ seed: itemSeed(it), isItem: true, rec: it }, { id: it.id }));
    for (const pk of O.records.parks || []) want.set(pk.id, { id: pk.id, seed: parkSeed(pk), isPark: true, rec: pk });
    for (const ob of O.records.objects || []) want.set('ob:' + ob.id, { id: 'ob:' + ob.id, seed: objectSeed(ob), isObject: true, rec: ob });
    const VGe = window.VILLAGE_GEN;
    for (const [id, h] of HOUSES) { const p = want.get(id); if (!p || p.seed !== h.seed) {
      for (const g of [h.grp].concat(h.extra || [])) if (g) { if (g.parent) g.parent.remove(g); g.traverse(c => { if (c.geometry && !c.userData.sharedGeo) c.geometry.dispose(); }); }
      if (VGe && VGe.edgeKey && h.plot && h.plot.fences) for (const sg of h.plot.fences) FENCED.delete(VGe.edgeKey(sg.a, sg.b));
      HOUSES.delete(id);
    } }
    queue.length = 0;
    for (const [id, p] of want) if (!HOUSES.has(id)) queue.push(p);
    stats.queued = queue.length;
  }
  function step(n) {
    let built = 0;
    while (queue.length && built < (n || 2)) {
      const p = queue.shift();
      try { const h = p.isPark ? buildPark(p.rec) : p.isItem ? buildItem(p.rec) : p.isObject ? buildObject(p.rec) : buildHouse(p); if (h) HOUSES.set(p.id, { seed: p.seed, grp: h.grp, tris: h.tris, plot: p, house: h.house, extra: h.extra || [], lights: h.lights || 0, isObject: !!p.isObject }); }
      catch (e) { console.warn('premises house', p.id, e && e.message); HOUSES.set(p.id, { seed: p.seed, grp: new THREE.Group(), tris: 0, plot: p, failed: true }); }
      built++;
    }
    stats.queued = queue.length; stats.houses = 0; stats.objects = 0; stats.houseTris = 0; stats.lights = 0;
    for (const [, h] of HOUSES) { stats.houseTris += h.tris || 0; stats.lights += h.lights || 0; if (h.isObject) stats.objects++; else stats.houses++; }
    if (built) paintWear();   // the garden paths are the built houses' (planPath reads the door)
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
    O = composeNow();
    let n = 0;
    const groundDirty = !dirty || !dirty.bbox || dirty.ground !== false;
    if (o.game) {
      if (groundDirty) { buildPatch(); n = 1; }
      placeLots();
      buildRoads();
      buildRunways();
      if (o.editing()) { buildOutlines(); buildHandles(); }
      else { for (const c of G.outlines.children.slice()) { G.outlines.remove(c); if (c.geometry) c.geometry.dispose(); } LINES.clear(); for (const h of HANDLES) G.handles.remove(h); HANDLES.length = 0; }
      syncHouses();
      stats.tris = patch ? patch.geometry.index.count / 3 : 0; stats.chunks = patch ? 1 : 0; stats.ms = performance.now() - t0; stats.rebuilt = n;
      return stats;
    }
    if (!dirty || !dirty.bbox) {
      if (groundDirty) { for (let i = ci0; i <= ci1; i++) for (let j = cj0; j <= cj1; j++) { buildChunk(i, j); n++; } buildWater(); }
    } else if (groundDirty) {
      const F = O.frame, b = dirty.bbox, pad = (dirty.pad || 0) + 2;
      const c = [F.toWorld(b.x0 - pad, b.z0 - pad), F.toWorld(b.x1 + pad, b.z0 - pad), F.toWorld(b.x1 + pad, b.z1 + pad), F.toWorld(b.x0 - pad, b.z1 + pad)];
      const wx0 = Math.min(...c.map(p => p[0])), wx1 = Math.max(...c.map(p => p[0])), wz0 = Math.min(...c.map(p => p[1])), wz1 = Math.max(...c.map(p => p[1]));
      for (let i = Math.max(ci0, Math.floor(wx0 / CHUNK)); i <= Math.min(ci1, Math.floor(wx1 / CHUNK)); i++)
        for (let j = Math.max(cj0, Math.floor(wz0 / CHUNK)); j <= Math.min(cj1, Math.floor(wz1 / CHUNK)); j++) { buildChunk(i, j); n++; }
    }
    placeLots();
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
    for (const ob of rec.layers.objects) if (ob.kind === 'tree' || ob.kind === 'prop' || ob.kind === 'billboard') { const d = Math.hypot(ob.x - L[0], ob.z - L[1]); if (d < td) { td = d; tree = ob; } }
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
    if (patch) { patch.geometry.dispose(); patch = null; }
    chunks.clear();
    for (const [, L] of LINES) { L.line.geometry.dispose(); L.line.material.dispose(); }
    LINES.clear();
    scene.remove(root);
  }

  const R = {
    root, groups: G, stats,
    rebuild, step, dispose, ghost, hit, handles, pickHandle, scaleHandles, heightAt,
    setRecord: r => { rec = PG.normalise(r); },
    get game() { return !!o.game; },
    get record() { return rec; },
    get overlay() { return O; },
    select: id => { selectedId = id || null; buildOutlines(); buildHandles(); },
    get selected() { return selectedId; },
    overlayOn: on => { uOvOn.value = on ? 1 : 0; },
    groundMat, plots: () => O.records.plots, houses: HOUSES, aerodromes: () => O.aerodromes, items: () => O.records.items, links: () => O.records.links,
    patternOf: id => { const i = O.runways.findIndex(r => r.id === id); if (i < 0 || !SITE.sitePattern) return null; try { return SITE.sitePattern(O.aerodromes[i], O.runways[i].site || null); } catch (e) { return null; } },
  };
  return R;
}

const API = { make, CHUNK, LAYER_COL, ZONE_COL };
if (typeof window !== 'undefined') window.RENDER_PREMISES = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
