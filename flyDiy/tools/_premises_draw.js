// _premises_draw.js — THE PREMISES DRAWN (G353 / GPREM): the record turned into
// a scene, per layer, with dirty tracking — shared by the bench and, at the
// port, by the game (src/viewer/render_premises.js). Nothing here is a control:
// it draws what tools/_premises_gen.js composes and publishes the HANDLES the
// editor's PIN lights, from the build, never re-derived.
//
//   RENDER_PREMISES.make(THREE, scene, world, rec, opts) -> R
//     R.rebuild(dirty)      dirty = null (everything) | { layer, bbox } in the premises frame
//     R.setRecord(rec)      the record the next rebuild reads
//     R.ghost(feature, ok)  a Group for a feature not yet committed (outline, 0.45)
//     R.handles(id)         [{ key, p: [x, y, z] }] for one feature's handles
//     R.hit(x, z)           the nearest feature at a world point (polygons: inside or within 1.5 m of an edge)
//     R.heightAt(x, z)      the COMPOSED ground (the same function the chunks sampled)
//     R.dispose()
//     R.stats               { tris, chunks, ms, layers }
//
// THE GROUND is 64 m chunks sampled from the composed terrain at `opts.cell`
// metres (1 m by default); a dirty bbox rebuilds only the chunks it touches
// plus the falloff margin. The polygons are drawn as line loops that FOLLOW
// the ground (every edge subdivided at 2 m), lifted a hand above it so they
// read through grass; the selection reads brighter; the handles are discs
// the page scales to the camera each frame.
(function () {
'use strict';
const PG = (typeof window !== 'undefined' && window.PREMISES_GEN) || (typeof require === 'function' && require('./_premises_gen.js'));

const CHUNK = 64;
const LAYER_COL = { terrain: 0xffa040, surface: 0x4fa7ff, material: 0xd28cff, exclude: 0xff5a5a, zones: 0x6fd08c, roads: 0xe0d090, runways: 0xffffff };
const LIFT = 0.18;

function make(THREE, scene, world, rec0, opts) {
  const o = Object.assign({ cell: 1, water: true, grass: null }, opts || {});
  let rec = PG.normalise(rec0 || PG.DEF());
  let O = PG.compose(rec, world);
  const root = new THREE.Group(); root.name = 'premises';
  const G = {}; for (const k of ['ground', 'water', 'outlines', 'handles', 'ghost']) { G[k] = new THREE.Group(); G[k].name = 'premises:' + k; root.add(G[k]); }
  scene.add(root);
  const stats = { tris: 0, chunks: 0, ms: 0, layers: {} };
  const bounds = world.bounds || { x0: -160, z0: -160, x1: 160, z1: 160 };

  // ---- the ground ---------------------------------------------------------
  const groundMat = new THREE.MeshStandardMaterial({ color: o.grass ? 0xffffff : 0x87906f, roughness: 0.97, metalness: 0 });
  if (o.grass) { groundMat.map = o.grass.map || null; groundMat.normalMap = o.grass.normalMap || null; }
  // the overlay canvas (surface classes, excludes) read in the shader in world metres
  const OV = document.createElement('canvas'); OV.width = OV.height = 1024;
  const ovTex = new THREE.CanvasTexture(OV); ovTex.flipY = false; ovTex.wrapS = ovTex.wrapT = THREE.ClampToEdgeWrapping;
  const uOv = { value: ovTex }, uB = { value: new THREE.Vector4(bounds.x0, bounds.z0, bounds.x1 - bounds.x0, bounds.z1 - bounds.z0) }, uOvOn = { value: 1 };
  groundMat.onBeforeCompile = sh => {
    sh.uniforms.uOv = uOv; sh.uniforms.uB = uB; sh.uniforms.uOvOn = uOvOn;
    sh.vertexShader = 'varying vec3 vPW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPW = transformed;');
    sh.fragmentShader = 'varying vec3 vPW;\nuniform sampler2D uOv;\nuniform vec4 uB;\nuniform float uOvOn;\n' +
      sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' +
        '  { vec4 ov = texture2D(uOv, (vPW.xz - uB.xy) / uB.zw);\n' +
        '    diffuseColor.rgb = mix(diffuseColor.rgb, ov.rgb, ov.a * uOvOn); }');
  };
  const chunks = new Map();      // "i,j" -> mesh
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
  // the seams: a chunk's edge normals are computed on its own vertices, so a
  // lit crease can show at a boundary; fixed by sampling one cell beyond and
  // dropping it would double the work — accepted for the bench, noted for the port

  // ---- the water ----------------------------------------------------------
  let water = null;
  function buildWater() {
    if (water) { G.water.remove(water); water.geometry.dispose(); water = null; }
    if (!o.water) return;
    const wy = world.waterH ? world.waterH(0, 0) : 0;
    if (!isFinite(wy)) return;
    const g2 = new THREE.PlaneGeometry((bounds.x1 - bounds.x0) * 1.6, (bounds.z1 - bounds.z0) * 1.6);
    g2.rotateX(-Math.PI / 2);
    water = new THREE.Mesh(g2, new THREE.MeshStandardMaterial({ color: 0x1f3a48, roughness: 0.32, metalness: 0, transparent: true, opacity: 0.86 }));
    water.position.set((bounds.x0 + bounds.x1) / 2, wy, (bounds.z0 + bounds.z1) / 2);
    water.receiveShadow = true; water.name = 'water';
    G.water.add(water);
  }

  // ---- the overlay canvas: surface classes and excludes in world metres -----
  const SURF_COL = ['rgba(120,180,80,0)', 'rgba(150,140,130,0.55)', 'rgba(160,150,140,0.55)', 'rgba(60,90,40,0.4)', 'rgba(40,80,120,0.5)', 'rgba(90,90,95,0.7)', 'rgba(150,135,110,0.7)', 'rgba(200,185,140,0.6)'];
  function paintOverlay() {
    const g = OV.getContext('2d');
    g.clearRect(0, 0, OV.width, OV.height);
    const X = x => (x - bounds.x0) / (bounds.x1 - bounds.x0) * OV.width, Z = z => (z - bounds.z0) / (bounds.z1 - bounds.z0) * OV.height;
    const F = O.frame;
    const path = poly => { g.beginPath(); poly.forEach((p, i) => { const w = F.toWorld(p[0], p[1]); i ? g.lineTo(X(w[0]), Z(w[1])) : g.moveTo(X(w[0]), Z(w[1])); }); g.closePath(); };
    for (const s of rec.layers.surface) if (s.poly && s.poly.length >= 3) { path(s.poly); g.fillStyle = SURF_COL[s.surface] || SURF_COL[6]; g.fill(); }
    for (const e of rec.layers.exclude) if (e.poly && e.poly.length >= 3) {
      path(e.poly); g.fillStyle = 'rgba(255,90,90,0.18)'; g.fill();
    }
    ovTex.needsUpdate = true;
  }

  // ---- the outlines: every polygon / polyline as a ground-following loop -----
  const LINES = new Map();       // id -> { line, layer, entry }
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
    const src = entry.poly || (entry.pts ? entry.pts.map(p => [p[0], p[1]]) : []);
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
      const line = lineFor(layer, e, LAYER_COL[layer] || 0xffffff, e.id === selectedId);
      if (!line) continue;
      G.outlines.add(line); LINES.set(e.id, { line, layer, entry: e });
      // a second, brighter loop marks the selection
      if (e.id === selectedId) { const l2 = lineFor(layer, e, 0xffffff, true); l2.material.opacity = 0.9; l2.position.y = 0.06; G.outlines.add(l2); LINES.set(e.id + ':sel', { line: l2, layer, entry: e }); }
    }
  }

  // ---- the handles: a disc per vertex of the selected feature -----------------
  const discGeo = new THREE.CircleGeometry(1, 20); discGeo.rotateX(-Math.PI / 2);
  const discMat = new THREE.MeshBasicMaterial({ color: 0xffb03a, transparent: true, opacity: 0.9, depthTest: false });
  const discMatMid = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthTest: false });
  const HANDLES = [];
  function buildHandles() {
    for (const h of HANDLES) G.handles.remove(h);
    HANDLES.length = 0;
    if (!selectedId) return;
    const L = LINES.get(selectedId);
    if (!L) return;
    const pts = worldPts(L.entry);
    const closed = !!L.entry.poly;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const m = new THREE.Mesh(discGeo, discMat);
      m.position.set(p[0], heightAt(p[0], p[1]) + LIFT + 0.05, p[1]);
      m.renderOrder = 9; m.userData.handle = { id: selectedId, key: 'v' + i, index: i };
      G.handles.add(m); HANDLES.push(m);
      if (closed || i + 1 < pts.length) {
        const q = pts[(i + 1) % pts.length], mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
        const mm = new THREE.Mesh(discGeo, discMatMid);
        mm.position.set(mx, heightAt(mx, mz) + LIFT + 0.05, mz);
        mm.renderOrder = 9; mm.userData.handle = { id: selectedId, key: 'm' + i, index: i, mid: true };
        G.handles.add(mm); HANDLES.push(mm);
      }
    }
  }
  function scaleHandles(camera, px) {
    // a disc reads the same size at any distance: radius = px pixels of the view
    for (const h of HANDLES) {
      const d = camera.position.distanceTo(h.position);
      const r = camera.isOrthographicCamera ? (camera.top - camera.bottom) / camera.zoom / (camera.userData.viewH || 600) * px
                                            : d * Math.tan((camera.fov || 40) * Math.PI / 360) * 2 / (camera.userData.viewH || 600) * px;
      h.scale.setScalar(Math.max(0.05, r) * (h.userData.handle.mid ? 0.7 : 1));
    }
  }

  // ---- the ghost: a feature not yet committed --------------------------------
  let ghostObj = null;
  function ghost(feature, ok) {
    if (ghostObj) { G.ghost.remove(ghostObj); ghostObj.geometry.dispose(); ghostObj.material.dispose(); ghostObj = null; }
    if (!feature) return null;
    const pts = worldPts(feature);
    if (pts.length < 2) return null;
    const closed = !!feature.poly && pts.length >= 3;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(groundLoop(pts, closed, LIFT + 0.1), 3));
    const mat = new THREE.LineBasicMaterial({ color: ok === false ? 0xff5a5a : ok === 'warn' ? 0xe8c15a : 0x6fd08c, transparent: true, opacity: 0.85, depthTest: false });
    ghostObj = new THREE.Line(geo, mat); ghostObj.renderOrder = 10;
    G.ghost.add(ghostObj);
    return ghostObj;
  }

  // ---- rebuild ---------------------------------------------------------------
  function rebuild(dirty) {
    const t0 = performance.now();
    O = PG.compose(rec, world);
    let tris = 0, n = 0;
    if (!dirty || !dirty.bbox) {
      for (let i = ci0; i <= ci1; i++) for (let j = cj0; j <= cj1; j++) { tris += buildChunk(i, j); n++; }
      buildWater();
    } else {
      // the dirty box is in the premises frame; turn its corners into the world
      const F = O.frame, b = dirty.bbox, pad = (dirty.pad || 0) + 2;
      const c = [F.toWorld(b.x0 - pad, b.z0 - pad), F.toWorld(b.x1 + pad, b.z0 - pad), F.toWorld(b.x1 + pad, b.z1 + pad), F.toWorld(b.x0 - pad, b.z1 + pad)];
      const wx0 = Math.min(...c.map(p => p[0])), wx1 = Math.max(...c.map(p => p[0])), wz0 = Math.min(...c.map(p => p[1])), wz1 = Math.max(...c.map(p => p[1]));
      for (let i = Math.max(ci0, Math.floor(wx0 / CHUNK)); i <= Math.min(ci1, Math.floor(wx1 / CHUNK)); i++)
        for (let j = Math.max(cj0, Math.floor(wz0 / CHUNK)); j <= Math.min(cj1, Math.floor(wz1 / CHUNK)); j++) { tris += buildChunk(i, j); n++; }
    }
    paintOverlay();
    buildOutlines();
    buildHandles();
    stats.tris = 0; for (const [, m] of chunks) stats.tris += m.geometry.index.count / 3;
    stats.chunks = chunks.size; stats.ms = performance.now() - t0; stats.rebuilt = n;
    return stats;
  }

  // ---- queries -----------------------------------------------------------------
  function hit(x, z) {
    // the smallest polygon containing the point wins; else the nearest edge within 1.5 m
    const F = O.frame, L = F.toLocal(x, z);
    let best = null, bestA = Infinity, near = null, nearD = 1.5;
    for (const [id, e] of LINES) {
      if (id.endsWith(':sel')) continue;
      const en = e.entry;
      if (en.poly) {
        if (PG.inPoly(en.poly, L[0], L[1])) { const a = Math.abs(PG.polyArea(en.poly)); if (a < bestA) { bestA = a; best = e; } }
        else { const d = PG.sdPoly(en.poly, L[0], L[1]); if (d < nearD) { nearD = d; near = e; } }
      } else if (en.pts) {
        for (let i = 0; i + 1 < en.pts.length; i++) { const d = PG.distPtSeg(L[0], L[1], en.pts[i], en.pts[i + 1]) - (en.width || 4) / 2; if (d < nearD) { nearD = d; near = e; } }
      }
    }
    const r = best || near;
    return r ? { id: r.entry.id, layer: r.layer, entry: r.entry } : null;
  }
  function handles(id) {
    const out = [];
    for (const h of HANDLES) if (h.userData.handle.id === id) out.push({ key: h.userData.handle.key, p: [h.position.x, h.position.y, h.position.z], mid: !!h.userData.handle.mid });
    return out;
  }
  function pickHandle(ray) {
    // the nearest disc along a ray, generous: the disc's world radius times 1.6
    let best = null, bestD = Infinity;
    for (const h of HANDLES) {
      const r = h.scale.x * 1.6;
      const d = ray.distanceToPoint(h.position);
      if (d < r && d < bestD) { bestD = d; best = h.userData.handle; }
    }
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
    rebuild, dispose, ghost, hit, handles, pickHandle, scaleHandles, heightAt,
    setRecord: r => { rec = PG.normalise(r); },
    get record() { return rec; },
    get overlay() { return O; },
    select: id => { selectedId = id || null; buildOutlines(); buildHandles(); },
    get selected() { return selectedId; },
    overlayOn: on => { uOvOn.value = on ? 1 : 0; },
    groundMat,
  };
  return R;
}

const API = { make, CHUNK, LAYER_COL };
if (typeof window !== 'undefined') window.RENDER_PREMISES = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
