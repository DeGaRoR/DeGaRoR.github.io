// render_premises.js — THE PREMISES DRAWN (G353 / GPREM; the bench's tools/_premises_draw.js, ported whole at G386): the record turned into
// a scene, per layer, with dirty tracking — shared by the bench and, at the
// port, by the game (src/viewer/render_premises.js). Nothing here is a control:
// it draws what src/core/27_premises.js composes and publishes the HANDLES the
// editor's PIN lights, from the build, never re-derived.
//
//   RENDER_PREMISES.make(THREE, scene, world, rec, opts) -> R
//     R.rebuild(dirty)      dirty = null (everything) | { layer, bbox } in the premises frame
//     R.step(n)             build up to n queued houses (the bench; a live edit in the game)
//     R.stream(x, z)        the game's stream (G591): the queue by distance to the aircraft at (x, z), built within
//                           R.streamState.reach on a time bank of .budget ms a frame
//     R.prewarm(x, z, reach, ms)  the roll-out's share: what lies within reach, in slices of ms (G591)
//     R.cellLive(key)       a 256 m cell with nothing queued in it (its merges and far town run, G592)
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
  // (G830: the tree pool the game's recompose took is kept - the house worker recomposes with the same, hwCompose)
  let composedPool = null;
  const composeNow = () => {
    if (o.game && world.premises) { composedPool = o.pool(); return world.premises.set(rec, { build: buildFor, pool: composedPool }) || PG.compose(rec, world.premises.base, { pool: o.pool(), globals: window, build: buildFor }); }
    composedPool = null;
    return PG.compose(rec, world, { pool: o.pool(), globals: window, build: buildFor });
  };
  let O = composeNow();
  // THE BOOT COMPOSED IT TWICE (2026-09-24): render_world makes this and calls rebuild() on the next
  // line, which composed the same record over the same world again - 2.5 s of Metlakatla's roll-out,
  // the same answer. In the game the first bare rebuild() after the make keeps this O; an edit, a
  // setRecord and every later rebuild compose as before (the bench composes always: its tree pool
  // may land between the make and the rebuild)
  let composedFresh = !!o.game;
  const root = new THREE.Group(); root.name = 'premises';
  const G = {}; for (const k of ['ground', 'water', 'outlines', 'plots', 'houses', 'lots', 'trees', 'runways', 'roads', 'tram', 'traffic', 'animals', 'handles', 'ghost']) { G[k] = new THREE.Group(); G[k].name = 'premises:' + k; root.add(G[k]); }
  // THE STATIC SUBTREES LEAVE THE MATRIX WALK (PERF 2026-09-23). The frame is CPU-bound on Jolene (three's render()
  // was 22 ms of the 24 at 300 m over the field), and 12 % of it was updateMatrixWorld: 20 500 objects composed
  // and multiplied every frame, 17 400 of them the premises' - houses (8 000), lots, roads, the ground - none of
  // which ever moves once built (an edit REBUILDS them). A built child of these groups is posed once and then
  // skips both (matrixAutoUpdate composes, matrixWorldAutoUpdate multiplies); three still visits it. What moves
  // stays out: the trams, the traffic, the animals, the handles and the ghost.
  const FROZEN_GROUPS = ['ground', 'water', 'plots', 'houses', 'lots', 'trees', 'runways', 'roads'];
  // (a prop's rungs arrive AFTER its placeholder was frozen - the asset loads - so a frozen child is walked again
  // for anything that came in since: re-posed whole, frozen again; the tick runs it every 60 frames)
  // THE BOOT'S SQUARE (G554, 2026-09-24, the user: "loading times are exploding"): the boot drains the build queue
  // four at a time and every step froze - so every step RE-WALKED every frozen child and RE-MERGED every lot of the
  // premises. Harmless at Jolene's 60 plots; at Metlakatla's 450 it was 28 s of a 106 s roll-out. Now a step
  // freezes only what is new (`walk` - the frozen children re-walked for a late rung - is the tick's and the
  // rebuild's), and the lots are merged ONCE, when the queue is empty.
  let freezeTick = 0, STREAMING = false;
  function freezeStatic(walk) {
    let n = 0, lots = BATCH.pending, roads = BATCH_R.pending;
    for (const k of FROZEN_GROUPS) for (const c of G[k].children) {
      if (!c.updateMatrixWorld) continue;
      let fresh = !c.userData.frozen;
      // a SETTLED house (settleTick: every prop landed, nothing posed since) is not re-walked (G592): the tick's walk was
      // every premises object every 60 frames - the periodic lag the playtest felt
      if (!fresh && walk && !c.userData.skipWalk) c.traverse(o => { if (o.matrixAutoUpdate) fresh = true; });
      if (!fresh) continue;
      c.traverse(o => { o.matrixWorldAutoUpdate = true; });
      THREE.Object3D.prototype.updateMatrixWorld.call(c, true);
      if (c.userData.skipWalk) { c.updateMatrixWorld = THREE.Object3D.prototype.updateMatrixWorld; c.userData.skipWalk = false; }   // fresh again: walked until settled
      c.traverse(o => { o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; });
      c.userData.frozen = true; n++;
      if (k === 'lots' && !c.userData.batch) lots = true;
      if (k === 'roads' && !c.userData.batch && o.game) roads = true;
      if (k === 'lots' && o.game) c.traverse(m => { if (m.isMesh) m.castShadow = false; });   // the yards' fences, patches and cars cast none (G557)
      if (k === 'houses' && c.userData.thrift) houseThrift(c);   // a late prop rung (G557)
    }
    // merged per cell as each cell goes live (G592: batchGroup leaves `pending` for a cell still streaming, and the
    // tick's walk comes back to it) - the boot's square of G554 stays gone: a step re-merges only the cells it touched
    // (a frame of the stream only marks them: the merge walks the whole group, so the tick's walk does it, every 60 frames)
    if (lots) { if (walk || !STREAMING) batchLots(); else BATCH.pending = true; }
    if (roads && o.game) { if (walk || !STREAMING) batchGroup(G.roads, BATCH_R, 'roads'); else BATCH_R.pending = true; }
    return n;
  }
  // THE LOTS BATCHED (PERF 2026-09-23). The fences share ONE finish (fenceFinish: every post bag and every deck
  // bag of the premises is the same two materials) and the yards' ground patches one material - 261 meshes, 261
  // draws, on a frame CPU-bound on its draw count. Meshes of G.lots that share a material are merged per 256 m
  // cell (world-space positions, normals through the normal matrix, every other attribute as is - the AO, the lit,
  // the window and the splat channels ride along), the sources hidden (they stay for picking and for the next
  // merge). A prop (its LOD, its shared geometry) is never merged. Re-merged whenever the set of sources changes.
  const BATCH = { cell: 256, group: null, sig: '', pending: false };
  function mergeInto(list) {
    const g0 = list[0].geometry, names = Object.keys(g0.attributes);
    let nV = 0, nI = 0;
    for (const m of list) { nV += m.geometry.attributes.position.count; nI += m.geometry.index.count; }
    const out = new THREE.BufferGeometry(), arrays = {};
    for (const k of names) { const a = g0.attributes[k]; arrays[k] = new a.array.constructor(nV * a.itemSize); }
    const idx = new Uint32Array(nI), nm = new THREE.Matrix3();
    let vo = 0, io = 0;
    for (const m of list) {
      const g = m.geometry, n = g.attributes.position.count;
      nm.getNormalMatrix(m.matrixWorld);
      const e = m.matrixWorld.elements, q = nm.elements;   // column-major, as three keeps them
      for (const k of names) {
        const a = g.attributes[k], dst = arrays[k], s = a.itemSize, A = a.array;
        if (k === 'position') for (let i = 0, o = vo * 3; i < n * 3; i += 3, o += 3) {
          const x = A[i], y = A[i + 1], z = A[i + 2], w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
          dst[o] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w; dst[o + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w; dst[o + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
        } else if (k === 'normal') for (let i = 0, o = vo * 3; i < n * 3; i += 3, o += 3) {
          const x = A[i], y = A[i + 1], z = A[i + 2];
          const X = q[0] * x + q[3] * y + q[6] * z, Y = q[1] * x + q[4] * y + q[7] * z, Z = q[2] * x + q[5] * y + q[8] * z, l = Math.hypot(X, Y, Z) || 1;
          dst[o] = X / l; dst[o + 1] = Y / l; dst[o + 2] = Z / l;
        }
        else dst.set(A.subarray(0, n * s), vo * s);
      }
      const ix = g.index.array;
      for (let i = 0; i < g.index.count; i++) idx[io + i] = ix[i] + vo;
      vo += n; io += g.index.count;
    }
    for (const k of names) { const a = g0.attributes[k]; out.setAttribute(k, new THREE.BufferAttribute(arrays[k], a.itemSize, a.normalized)); }
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere();
    return out;
  }
  // THE ROADS TOO (G563): 696 road draws over the airfield, the same few pavement finishes - merged the lots' way
  const BATCH_R = { cell: 256, group: null, sig: '', pending: false };
  function batchLots() { return batchGroup(G.lots, BATCH, 'lots'); }
  function batchGroup(GR, BATCH, tag) {
    if (!THREE.Matrix3 || !THREE.BufferAttribute) return 0;
    const src = [];
    GR.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.sharedGeo || o.userData.batch || !o.geometry || !o.geometry.index || Array.isArray(o.material)) return;
      if (Object.values(o.geometry.attributes).some(a => a.isInterleavedBufferAttribute)) return;
      for (let p = o.parent; p && p !== GR; p = p.parent) if (p.isLOD || p.userData.batch) return;
      src.push(o);
    });
    // PER CELL (G592): a cell's merge is its own - made when the cell is LIVE (nothing queued in it, cellLive) and
    // its set of sources changed, left as it stands otherwise; a cell still streaming keeps its sources whole (and
    // BATCH.pending, so the tick comes back). It was one merge of the whole group, made when the WHOLE queue was
    // empty - with the far premises streaming by proximity, never.
    if (BATCH.group && BATCH.group.parent !== GR) { BATCH.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); BATCH.group = null; BATCH.cells = null; }
    if (!BATCH.group) { BATCH.group = new THREE.Group(); BATCH.group.name = tag + ':batches'; BATCH.group.userData.batch = true; GR.add(BATCH.group); }
    const CELLS = BATCH.cells || (BATCH.cells = new Map());
    const byCell = new Map(), c = new THREE.Vector3();
    for (const m of src) {
      m.updateWorldMatrix(true, false);
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      c.copy(m.geometry.boundingSphere.center).applyMatrix4(m.matrixWorld);
      const ck = Math.floor(c.x / BATCH.cell) + ',' + Math.floor(c.z / BATCH.cell);
      let L = byCell.get(ck); if (!L) byCell.set(ck, L = []); L.push(m);
    }
    for (const ck of CELLS.keys()) if (!byCell.has(ck)) byCell.set(ck, []);
    let n = 0, made = 0, pend = false;
    for (const [ck, list] of byCell) {
      const sig = list.map(m => m.id).join(','), was = CELLS.get(ck);
      if (was && was.sig === sig) { n += was.meshes.length; continue; }
      if (!cellLive(ck)) { pend = true; if (was) n += was.meshes.length; continue; }
      if (was) { for (const mesh of was.meshes) { BATCH.group.remove(mesh); mesh.geometry.dispose(); } for (const m of was.src) if (m.parent) m.visible = true; }
      const buckets = new Map();
      for (const m of list) {
        const key = m.material.uuid + '|' + m.castShadow + ',' + m.receiveShadow + ',' + m.renderOrder +
          '|' + Object.keys(m.geometry.attributes).sort().map(k => k + ':' + m.geometry.attributes[k].itemSize + ':' + m.geometry.attributes[k].array.constructor.name).join(',');
        let b = buckets.get(key); if (!b) buckets.set(key, b = []); b.push(m);
      }
      const cell = { sig, meshes: [], src: [] };
      for (const bl of buckets.values()) {
        if (bl.length < 2) { bl[0].visible = true; continue; }
        const mesh = new THREE.Mesh(mergeInto(bl), bl[0].material);
        mesh.castShadow = bl[0].castShadow; mesh.receiveShadow = bl[0].receiveShadow; mesh.renderOrder = bl[0].renderOrder;
        mesh.userData.batch = true; mesh.name = tag + ':batch';
        BATCH.group.add(mesh); cell.meshes.push(mesh);
        for (const m of bl) { m.visible = false; cell.src.push(m); }
      }
      if (list.length) CELLS.set(ck, cell); else CELLS.delete(ck);
      n += cell.meshes.length; made++;
    }
    BATCH.pending = pend;
    stats[tag + 'Batches'] = n; stats[tag + 'Batched'] = 0; for (const cl of CELLS.values()) stats[tag + 'Batched'] += cl.src.length;
    return made;
  }

  // THE LOTS group stands at the premises frame: what the village's plan functions draw in the
  // premises frame (fences, lot patches, cars, boats) goes in here untransformed
  const placeLots = () => { const a = O.frame.anchor; G.lots.position.set(a.x, 0, a.z); G.lots.rotation.y = O.frame.yaw; };
  placeLots();
  scene.add(root);
  const stats = { tris: 0, chunks: 0, ms: 0, houses: 0, houseTris: 0, trees: 0, queued: 0, lights: 0, objects: 0, litNow: 0, animals: 0, animalsShown: 0 };
  // THE LIFE (SCENERY LIFE, 2026-09-23): src/viewer/scenery_life.js stands people, wall clutter, rubbish, parked cars, small
  // structures and antennas round what is BUILT here, by laws from the record's seed (rec.life, contract v1.22); drawn in a
  // handful of instanced draws, every kind cut by distance. It reads the built houses' own reports (HOUSES[].built)
  const LIFE = (typeof window !== 'undefined' && window.SCENERY_LIFE) ? window.SCENERY_LIFE.make(THREE, {
    root, game: !!o.game, record: () => rec, frame: () => O.frame, heightAt: (x, z) => heightAt(x, z), waterY: () => (world.waterH ? world.waterH(0, 0) : -1e9), waterAt: (x, z) => (world.waterH ? world.waterH(x, z) : -1e9),
    houses: () => HOUSES, plots: () => O.records.plots, roads: () => O.roads, runways: () => O.runways, zones: () => rec.layers.zones,
    aprons: () => (rec.layers.surface || []).filter(e => e.apron && e.poly && e.poly.length > 2).map(e => e.poly),
    objects: () => (rec.layers.objects || []).filter(e => e.kind !== 'aircraft' && isFinite(e.x)).map(e => { const w = O.frame.toWorld(e.x, e.z); return { x: w[0], z: w[1], r: e.kind === 'billboard' ? (+e.w || 3) / 2 + 0.6 : e.kind === 'tree' ? 1.5 : 1.3 }; }),
    aircraft: () => (rec.layers.objects || []).filter(e => e.kind === 'aircraft').map(e => { const w = O.frame.toWorld(e.x, e.z); return { x: w[0], z: w[1], yaw: (e.yaw || 0) + O.frame.yaw }; }),
    sites: () => (rec.layers.sites || []).filter(st => st.at && O.runways.some(r => r.c && Math.hypot(r.c[0] - st.at.x, r.c[1] - st.at.z) < (r.len || 1000) / 2 + 900)).map(st => { let rw = null, rd = Infinity; for (const r of O.runways) if (r.c) { const d = Math.hypot(r.c[0] - st.at.x, r.c[1] - st.at.z) - (r.len || 1000) / 2; if (d < rd) { rd = d; rw = r.id; } } return { x: st.at.x, z: st.at.z, id: st.id, runway: rw }; }),
    items: () => O.records.items,   // the site items' feet (a site's own life covers them, v1.22.1)
    cover: (x, z) => (world.coverAt ? world.coverAt(x, z, 1) : null),   // the pavement law (v1.17.1): nothing stands on a road
    pavedNear: O.pavedNear ? (x, z, m, skip) => O.pavedNear(x, z, m, skip) : null,   // G1003: any pavement here or within m, but `skip`
    eye: () => (o.eye ? o.eye() : null), lampsOn: () => LAMPS.on, queued: () => (o.game && !(o.editing && o.editing()) ? STREAM.near : queue.length), obstacles: () => OBS(), onTraffic: () => { syncTraffic(); },
  }) : null;
  // THE LAMP POOL (G449 - G417's account, whose code never reached the tree: the commit carried the
  // HANDOVER, the doc and the F8 dial only). Every built thing publishes its lights (HOUSE_GEN
  // stats.lit.lights: the bulb's place in the house frame, colour, level k, reach; the fixtures
  // are GEOMETRY placed by placeBuilt, the day says whether they glow). A CONSTANT pool of eight
  // PointLights on the premises root - a count that changes recompiles every lit material
  // (cockpit.js's own note) - is re-assigned every 30 frames to the published lamps nearest the
  // eye within 500 m; `on` = (2 deg - sunEl) / 4 clamped (they fade in through the horizon); the
  // level is the village bench's night (k x 2.2 x 1.1 x gain 2, judged at exposure ~1) DIVIDED by
  // the live exposure base - a source judged at one exposure under a schedule that opens 15
  // stops. The lit panes follow: each finish's glass uniform uLitK (its base the generator's
  // lightK) x on x the runway lenses' colour-keeping dimmer. The world switchboard declares it
  // as `lamps` (render_world) and the mute is honoured here. F8: `village lamps` reads .gain.
  let TARR = null;   // the town's texture arrays (G574, hlodBuild) - above LAMPS, which reads it (G570: no TDZ)
  const LAMPS = { pool: [], pub: [], glass: new Map(), smoke: new Set(), glowKeys: new Set(), gain: 2, on: 0, litNow: 0, frame: 0, muted: false, N: 8, reach: 500 };
  const lampPoolInit = () => {
    if (LAMPS.pool.length) return;
    for (let i = 0; i < LAMPS.N; i++) { const l = new THREE.PointLight(0xffffff, 0, 10, 1.6); l.castShadow = false; l.visible = false; l.name = 'premises:lamp' + i; root.add(l); LAMPS.pool.push(l); }
  };
  const _lp = new THREE.Vector3();
  // eye: a Vector3; on: the day's 0..1; ex: the live exposure base
  LAMPS.update = (eye, on, ex) => {
    lampPoolInit();
    LAMPS.on = on;
    const kGlass = 0.45 * Math.pow(0.92 / Math.max(0.92, ex), 1.0), kLamp = 2.2 * 1.1 * LAMPS.gain / Math.max(1, ex);
    // the panes: the generator's lightK (judged on the bench by DAY, 2.2) x 0.45 x the exposure's inverse - a lit window at night is warm, not white (at the lenses' 0.9 the mill's windows saturated)
    for (const [u, base] of LAMPS.glass) u.value = base * on * kGlass * (LAMPS.muted ? 0 : 1);
    LAMPS.kLit = on * kGlass * (LAMPS.muted ? 0 : 1); if (TARR) TARR.lit.value = LAMPS.kLit;   // the town's lit panes (G574): the base rides the slot
    // the chimney smoke is lit by the sky: its unlit colour dimmed back through the exposure schedule (a haze, not a lamp)
    // the fixtures' own glass (G456): the author's emissive x on x the lenses' colour-keeping dimmer, every placement of a lit prop key together
    if (typeof propSetGlowOf === 'function') { const kFix = LAMPS.muted ? 0 : on * Math.pow(0.92 / Math.max(0.92, ex), 0.9); for (const key of LAMPS.glowKeys) propSetGlowOf(key, kFix); }
    const kSmoke = Math.pow(0.92 / Math.max(0.92, ex), 1.35);   // 1.35: at the night's 6444 the haze sits at ~5 % of its day grey - the moonlit ground's own level (1.1 left a 40 % column over every chimney)
    for (const u of LAMPS.smoke) u.value = kSmoke;
    LAMPS.smokeK = kSmoke;                                   // the animals' plume takes the same hand (animal_run.js)
    if (on <= 0 || LAMPS.muted) { for (const l of LAMPS.pool) { l.intensity = 0; l.visible = false; } LAMPS.litNow = stats.litNow = 0; return; }
    if ((LAMPS.frame++ % 30) === 0 || !LAMPS.near) {
      // the published lamps of the groups still standing, in the world, the nearest first
      const pub = LAMPS.pub = LAMPS.pub.filter(e => e.grp.parent);
      for (const e of pub) if (!e.wp || e.move) { e.grp.updateWorldMatrix(true, false); _lp.set(e.p[0], e.p[1], e.p[2]); e.grp.localToWorld(_lp); e.wp = [_lp.x, _lp.y, _lp.z]; }
      const r2 = LAMPS.reach * LAMPS.reach;
      LAMPS.near = pub.map(e => { const dx = e.wp[0] - eye.x, dy = e.wp[1] - eye.y, dz = e.wp[2] - eye.z; return [dx * dx + dy * dy + dz * dz, e]; })
        .filter(q => q[0] < r2).sort((a, b) => a[0] - b[0]).slice(0, LAMPS.N).map(q => q[1]);
    }
    const near = LAMPS.near;
    for (let i = 0; i < LAMPS.pool.length; i++) {
      const l = LAMPS.pool[i], e = near[i];
      if (!e) { l.intensity = 0; l.visible = false; continue; }
      if (e.move) { e.grp.updateWorldMatrix(true, false); _lp.set(e.p[0], e.p[1], e.p[2]); e.grp.localToWorld(_lp); e.wp = [_lp.x, _lp.y, _lp.z]; }   // GTRAM: a cabin's lamp rides with it
      l.position.set(e.wp[0], e.wp[1], e.wp[2]);
      l.color.setRGB(e.col[0], e.col[1], e.col[2]);
      l.distance = e.range; l.intensity = e.k * kLamp * on; l.visible = true;
    }
    LAMPS.litNow = stats.litNow = near.length;
  };
  LAMPS.mute = () => { LAMPS.muted = true; for (const l of LAMPS.pool) { l.intensity = 0; l.visible = false; } for (const [u] of LAMPS.glass) u.value = 0; LAMPS.kLit = 0; if (TARR) TARR.lit.value = 0; if (typeof propSetGlowOf === 'function') for (const key of LAMPS.glowKeys) propSetGlowOf(key, 0); };
  LAMPS.unmute = () => { LAMPS.muted = false; };
  // the bench's bounds are the world's window; the game's are the premises' extent in the world (+ a margin)
  const extentWorld = () => { const F = O.frame, e = O.extent, c = [F.toWorld(e.x0, e.z0), F.toWorld(e.x1, e.z0), F.toWorld(e.x1, e.z1), F.toWorld(e.x0, e.z1)]; return { x0: Math.min(...c.map(q => q[0])) - 40, z0: Math.min(...c.map(q => q[1])) - 40, x1: Math.max(...c.map(q => q[0])) + 40, z1: Math.max(...c.map(q => q[1])) + 40 }; };
  const bounds = o.game ? extentWorld() : (world.bounds || { x0: -160, z0: -160, x1: 160, z1: 160 });
  let W = bounds.x1 - bounds.x0, H = bounds.z1 - bounds.z0;

  // ---- the ground, with the overlay and the wear -----------------------------
  const groundMat = new THREE.MeshStandardMaterial({ color: o.grass ? 0xffffff : 0x87906f, roughness: 0.97, metalness: 0 });
  if (o.grass) { groundMat.map = o.grass.map || null; groundMat.normalMap = o.grass.normalMap || null; }
  // THE MATERIAL MAP (v8): the material polygons composited in priority order into four SLOTS (the
  // map's four channels, one PBR set each - a premises wears up to four sets); the ground shader
  // mixes the sets in by the slot weights, tiled in world metres
  // a DATA texture, not a canvas: a 2D canvas premultiplies its colour by its alpha on store, and a slot in the
  // alpha channel at 0 wiped the other three - four honest bytes per pixel
  // THE MAP'S OWN BOUNDS (G434): the game paints it over the UNION of the material polygons (+ their
  // fades), not over the extent - an extent that spans a field, a village 4 km off and the road
  // between would give a 45 m taxiway four texels; 1024 in the game, the bench keeps its 512 window
  const MMN = o.game ? 1024 : 512, MMD = new Uint8Array(MMN * MMN * 4);
  const mb = { x0: 0, z0: 0, x1: 1, z1: 1 };           // the map's bounds in the world; W/H below when not the game
  let MW = 1, MH = 1;
  const matTex = new THREE.DataTexture(MMD, MMN, MMN, THREE.RGBAFormat); matTex.flipY = false; matTex.wrapS = matTex.wrapT = THREE.ClampToEdgeWrapping; matTex.minFilter = THREE.LinearFilter; matTex.magFilter = THREE.LinearFilter; matTex.needsUpdate = true;
  const SLOTS = [null, null, null, null];   // set keys by slot
  const uMat = { value: matTex }, uMatOn = { value: 0 }, uTile = { value: new THREE.Vector4(2.4, 2.4, 2.4, 2.4) }, uMB = { value: new THREE.Vector4(0, 0, 1, 1) };
  const uSet = [0, 1, 2, 3].map(() => ({ value: null }));
  const SET_TEX = {};
  const texSets = () => Object.assign({}, (typeof LOT_TEX_SETS !== 'undefined' && LOT_TEX_SETS) || {}, (typeof SITE_TEX_SETS !== 'undefined' && SITE_TEX_SETS) || {});
  function setTex(key) {
    if (SET_TEX[key]) return SET_TEX[key];
    const S = texSets()[key]; if (!S || !S.diff) return null;
    const t = new THREE.Texture(S.diff); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
    if (S.diff.complete && S.diff.naturalWidth) t.needsUpdate = true; else S.diff.addEventListener('load', () => { t.needsUpdate = true; if (o.onBuilt) o.onBuilt(0, 0); });
    SET_TEX[key] = t; return t;
  }
  // the injection: after the map, the slots' sets mixed in by their weights (both the bench ground and the game patch)
  // THE SLOTS A PROGRAM DECLARES ARE THE SLOTS IN USE (G527.1): the map + four sets were five texture units
  // on every ground that took the injection, and the inner ring's patch twin is eleven - sixteen, the
  // limit, nothing to spare: one sampler more on a graphics tier and the link failed and no premises
  // ground drew at all (the perf session, 2026-09-23). A record paints with one or two sets (Jolene: one);
  // the program declares the map and those alone, keyed by the count, recompiled when an edit changes it
  let NSLOT = 0;
  const CH4 = ['r', 'g', 'b', 'a'], TL4 = ['x', 'y', 'z', 'w'];
  function injectMaterials(sh) {
    const n = NSLOT; if (!n) return;   // no set painted: no unit spent
    sh.uniforms.uMat = uMat; sh.uniforms.uMatOn = uMatOn; sh.uniforms.uTile = uTile; sh.uniforms.uMB = uMB;
    for (let i = 0; i < n; i++) sh.uniforms['uSet' + i] = uSet[i];
    if (sh.vertexShader.indexOf('varying vec3 vPW;') < 0) sh.vertexShader = 'varying vec3 vPW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vPW = transformed;');
    sh.fragmentShader = (sh.fragmentShader.indexOf('varying vec3 vPW;') < 0 ? 'varying vec3 vPW;\n' : '') + 'uniform sampler2D uMat, ' + [0, 1, 2, 3].slice(0, n).map(i => 'uSet' + i).join(', ') + ';\nuniform vec4 uMB, uTile;\nuniform float uMatOn;\n' +
      // AFTER THE GROUND'S OWN STACK (G434): the island's ground hook appends its albedo (class, tint,
      // radar, shade, snow) right after map_fragment and that overwrote every material painted there -
      // on Jolene no material polygon had ever shown. The mix goes in ahead of color_fragment now, the
      // last stop before the lighting, whatever a ground hook did to the map's colour before it.
      sh.fragmentShader.replace('#include <color_fragment>', '\n' +
        '  if (uMatOn > 0.5) { vec4 mw = texture2D(uMat, (vPW.xz - uMB.xy) / uMB.zw);\n' +
        [0, 1, 2, 3].slice(0, n).map(i => '    if (mw.' + CH4[i] + ' > 0.001) diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(uSet' + i + ', vPW.xz / uTile.' + TL4[i] + ').rgb, mw.' + CH4[i] + ');\n').join('') +
        '  }\n#include <color_fragment>');
  }
  // the map painted: every material polygon in priority order, "over" per pixel with its fade weight
  function paintMaterials() {
    const mats = O.materials || [], F = O.frame, N = MMN;
    const D = MMD; D.fill(0);
    // the bounds: the bench's window; the game's the polygons' union with their fades and a texel's margin
    if (o.game && mats.length) {
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const m of mats) for (const q of [[m.bbox.x0, m.bbox.z0], [m.bbox.x1, m.bbox.z0], [m.bbox.x1, m.bbox.z1], [m.bbox.x0, m.bbox.z1]]) { const w = F.toWorld(q[0], q[1]); x0 = Math.min(x0, w[0] - m.fade - 4); z0 = Math.min(z0, w[1] - m.fade - 4); x1 = Math.max(x1, w[0] + m.fade + 4); z1 = Math.max(z1, w[1] + m.fade + 4); }
      mb.x0 = x0; mb.z0 = z0; mb.x1 = x1; mb.z1 = z1;
    } else { mb.x0 = bounds.x0; mb.z0 = bounds.z0; mb.x1 = bounds.x1; mb.z1 = bounds.z1; }
    MW = Math.max(1, mb.x1 - mb.x0); MH = Math.max(1, mb.z1 - mb.z0);
    uMB.value.set(mb.x0, mb.z0, MW, MH);
    for (let i = 0; i < 4; i++) SLOTS[i] = null;
    const slotOf = key => { let k = SLOTS.indexOf(key); if (k < 0) { k = SLOTS.indexOf(null); if (k < 0) return -1; SLOTS[k] = key; } return k; };
    let any = false;
    for (const m of mats) {
      const k = slotOf(m.set); if (k < 0) { console.warn('premises: a fifth material set (' + m.set + ') has no slot'); continue; }
      const tile = m.tile || (texSets()[m.set] || {}).tile || 2.4;
      uTile.value.setComponent(k, tile);
      // the pixels the polygon and its fade band cover, in the bounds' raster
      const bb = m.bbox, f = m.fade;
      // (a turned frame: the four corners of the local box, not two of them)
      const cw = [[bb.x0, bb.z0], [bb.x1, bb.z0], [bb.x1, bb.z1], [bb.x0, bb.z1]].map(q => F.toWorld(q[0], q[1]));
      const px0 = Math.max(0, Math.floor((Math.min(...cw.map(q => q[0])) - mb.x0) / MW * N) - 2), px1 = Math.min(N - 1, Math.ceil((Math.max(...cw.map(q => q[0])) - mb.x0) / MW * N) + 2);
      const pz0 = Math.max(0, Math.floor((Math.min(...cw.map(q => q[1])) - mb.z0) / MH * N) - 2), pz1 = Math.min(N - 1, Math.ceil((Math.max(...cw.map(q => q[1])) - mb.z0) / MH * N) + 2);
      const lo = Math.min(px0, px1) - Math.ceil(f / MW * N) - 1, hi = Math.max(px0, px1) + Math.ceil(f / MW * N) + 1, lz = Math.min(pz0, pz1) - Math.ceil(f / MH * N) - 1, hz = Math.max(pz0, pz1) + Math.ceil(f / MH * N) + 1;
      for (let j = Math.max(0, lz); j <= Math.min(N - 1, hz); j++) for (let i = Math.max(0, lo); i <= Math.min(N - 1, hi); i++) {
        const wx = mb.x0 + (i + 0.5) / N * MW, wz = mb.z0 + (j + 0.5) / N * MH, L = F.toLocal(wx, wz);
        const w = O.materialWeight(m, L[0], L[1]); if (w <= 0) continue;
        const at = (j * N + i) * 4;
        for (let c = 0; c < 4; c++) D[at + c] = Math.round(D[at + c] * (1 - w));
        D[at + k] = Math.min(255, D[at + k] + Math.round(255 * w));
        any = true;
      }
    }
    for (let i = 0; i < 4; i++) uSet[i].value = SLOTS[i] ? setTex(SLOTS[i]) : null;
    uMatOn.value = any ? 1 : 0;
    // the slot count the programs declare (G527.1): a change recompiles every ground that takes the injection
    const used = SLOTS.filter(Boolean).length;
    if (used !== NSLOT) { NSLOT = used; groundMat.needsUpdate = true; for (const M of patchMatOwn) if (M) M.needsUpdate = true; }
    matTex.needsUpdate = true;
    stats.materials = mats.length;
  }
  const OV = document.createElement('canvas'); OV.width = OV.height = 1024;
  const ovTex = new THREE.CanvasTexture(OV); ovTex.flipY = false; ovTex.wrapS = ovTex.wrapT = THREE.ClampToEdgeWrapping;
  const WR = document.createElement('canvas'); WR.width = WR.height = 1024;
  const wearTex = new THREE.CanvasTexture(WR); wearTex.flipY = false; wearTex.wrapS = wearTex.wrapT = THREE.ClampToEdgeWrapping;
  const uOv = { value: ovTex }, uWear = { value: wearTex }, uB = { value: new THREE.Vector4(bounds.x0, bounds.z0, W, H) }, uOvOn = { value: 1 }, uWaterY = { value: world.waterH ? world.waterH(0, 0) : -1e9 };
  // the game's bounds follow the extent (the material map is painted over them): refreshed on a rebuild
  const refreshBounds = () => { if (!o.game) return; const b = extentWorld(); bounds.x0 = b.x0; bounds.z0 = b.z0; bounds.x1 = b.x1; bounds.z1 = b.z1; W = bounds.x1 - bounds.x0; H = bounds.z1 - bounds.z0; uB.value.set(bounds.x0, bounds.z0, W, H); };
  groundMat.onBeforeCompile = sh => {
    if (typeof ATMO !== 'undefined') ATMO.inject(sh);   // S4: the aerial-perspective sampler (a hook of its own loses the prototype's)
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
    injectMaterials(sh);
  };
  groundMat.customProgramCacheKey = () => 'premises-ground-s' + NSLOT;   // the slot count is in the source (G527.1)
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
  // ...IN CHUNKS (G434): 64 m chunks over the extent, and only the ones the record TOUCHES are built - a
  // modifier's box (a grade, a flatten, a shelf), a surface or material polygon, a road, a strip and
  // its shoulder, a zone (its plots), a site, an object - each with its falloff's margin. An extent
  // spanning a field, a village 4 km away and the road between built 5 M vertices over the muskeg
  // in between where nothing was composed; the chunks the record touches are a tenth of that. The
  // border of the built region tucks 2.2 m under the ring as the whole patch did: a vertex reads its
  // distance to the nearest UNBUILT neighbour chunk (the 40 m fade fits inside one chunk).
  let patch = null, patchKey = '', patchAct = null;
  const patchMatOwn = [null, null];   // G527: [the patchMat's clone, the patchMat2's] - see patchKind
  const PCH = 64;
  function activeChunks(b) {
    const F = O.frame, rec = O.rec, L = rec.layers, act = new Set(), key = (i, j) => i + ',' + j;
    const i0 = Math.floor(b.x0 / PCH), i1 = Math.floor(b.x1 / PCH), j0 = Math.floor(b.z0 / PCH), j1 = Math.floor(b.z1 / PCH);
    // a chunk is marked when its CENTRE lies within `m` + half the chunk's diagonal of the feature
    // (a polygon's edge, a road's segment) - never by a bounding box: a diagonal 2 km road or strip
    // boxes a square kilometre of muskeg it never touches
    const HALFD = PCH * 0.7072;
    const eachChunk = (bb, m, test) => {   // bb LOCAL; test(lx, lz) at the chunk centre in LOCAL coords
      const c = [[bb.x0 - m, bb.z0 - m], [bb.x1 + m, bb.z0 - m], [bb.x1 + m, bb.z1 + m], [bb.x0 - m, bb.z1 + m]].map(q => F.toWorld(q[0], q[1]));
      const x0 = Math.min(...c.map(q => q[0])), x1 = Math.max(...c.map(q => q[0])), z0 = Math.min(...c.map(q => q[1])), z1 = Math.max(...c.map(q => q[1]));
      for (let i = Math.max(i0, Math.floor(x0 / PCH)); i <= Math.min(i1, Math.floor(x1 / PCH)); i++) for (let j = Math.max(j0, Math.floor(z0 / PCH)); j <= Math.min(j1, Math.floor(z1 / PCH)); j++) {
        const k = key(i, j); if (act.has(k)) continue;
        const lc = F.toLocal((i + 0.5) * PCH, (j + 0.5) * PCH);
        if (test(lc[0], lc[1])) act.add(k);
      }
    };
    const markBox = (bb, m) => eachChunk(bb, m, (lx, lz) => lx >= bb.x0 - m - HALFD && lx <= bb.x1 + m + HALFD && lz >= bb.z0 - m - HALFD && lz <= bb.z1 + m + HALFD);
    const markPoly = (poly, m) => { if (poly && poly.length >= 3) eachChunk(PG.polyBBox(poly), m, (lx, lz) => PG.sdPoly(poly, lx, lz) <= m + HALFD); };
    const markLine = (pts, m) => { for (let s = 1; s < pts.length; s++) { const a = pts[s - 1], b = pts[s]; eachChunk({ x0: Math.min(a[0], b[0]), z0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), z1: Math.max(a[1], b[1]) }, m, (lx, lz) => PG.distPtSeg(lx, lz, a, b) <= m + HALFD); } };
    for (const t of L.terrain) { if (t.poly) markPoly(t.poly, (+t.falloff || 6) + 4); else if (t.pts) markLine(t.pts, (+t.width || 4) / 2 + (+t.falloff || 6) + 4); }
    for (const s of L.surface) markPoly(s.poly, 4);
    for (const m of L.material) markPoly(m.poly, (+m.fade || 0) + 4);
    for (const r of L.roads) if (r.pts && r.pts.length >= 2) markLine(r.pts, (+r.w || 3.6) / 2 + (+r.falloff || 6) + 6);
    for (const r of O.runways || []) { if (PG.runwayIsWater && PG.runwayIsWater(r)) continue; markPoly(PG.runwayBox(r, PG.runwayShoulder(r) + 30), 4); }
    for (const z of L.zones) markPoly(z.poly, 40);
    for (const st of L.sites) { const a = st.at || { x: 0, z: 0 }; let r = 80; for (const it of st.items || []) r = Math.max(r, Math.hypot(it.x || 0, it.z || 0) + 40); if (st.yard) r = Math.max(r, Math.hypot(st.yard.x1 || 0, st.yard.z1 || 0) + 40, Math.hypot(st.yard.x0 || 0, st.yard.z0 || 0) + 40); markBox({ x0: a.x - r, z0: a.z - r, x1: a.x + r, z1: a.z + r }, 0); }
    for (const ob of L.objects) markBox({ x0: ob.x, z0: ob.z, x1: ob.x, z1: ob.z }, 30);
    for (const sh of O.shelves || []) if (sh.poly) markPoly(sh.poly, (+sh.falloff || 6) + 4); else if (sh.rect && sh.c) markBox({ x0: sh.c[0] - 60, z0: sh.c[1] - 60, x1: sh.c[0] + 60, z1: sh.c[1] + 60 }, 0);
    return { act, i0, i1, j0, j1, key };
  }
  // THE PATCH IN BLOCKS, BY DISTANCE (PERF 2026-09-23). One mesh over every active chunk was 1.5 M triangles on
  // Jolene - drawn whole every frame (one bounding sphere round three square kilometres is always in view) and at
  // 2 m however far: a 2 m quad a kilometre out is a pixel, and a pixel-sized triangle shades the ground's whole
  // splat in a 2x2 quad for one covered sample. Now the active chunks are gathered in blocks of 8x8 (512 m; 4x4 was 87 draws at 300 m on a CPU-bound frame), each
  // a THREE.LOD of four meshes - 2, 4, 8 and 16 m - every one a subsample of the ONE 2 m sampling (the same
  // heights, the same normals, the same uvs: a coarse vertex is a fine vertex). A level is used from the distance
  // where its worst height error over the block (measured against the 2 m grid) is under a pixel on a 1440-line
  // screen, and never nearer than 25 of its quads; a chunk's four edges hang a skirt (its own heights 0.5-3 m down,
  // its surface's normals) so two neighbours at different levels never open a crack onto the sunk ring below.
  const PL = { res: [2, 4, 8, 16], block: 8, focal: 1160, tolPx: 1, minQuads: 25, skirt: [0.5, 1, 2, 3] };
  // HOW DEEP INSIDE THE PATCH (x, z) LIES: metres to the extent's edge or to the nearest UNBUILT neighbour chunk, 0
  // outside the patch. The patch's border tucks under the ring over its last 40 m by it, and (G752) the rings sink
  // under the patch by it (ringSink) - not within PATCH_TUCK.ring0 of the edge, so a ring triangle crossing the border keeps
  // both its vertices at the ground (a vertex sunk 4 m at the border dragged the triangles on both sides of it down:
  // a 2-4 m trench along every chunk edge, the playtest's "DEM seams" - 145815, 152402)
  // THE BORDER'S TWO LAWS, SIDE BY SIDE (G752). The patch tucks `tuck` m under the ground at its edge, back to the ground
  // `tuckW` m in; the rings sink 0 within `ring0` m of the edge, rising (smoothstep) to `sink` by `ring1` m. Where the ring
  // is at the ground the patch is under it, where the patch is at the ground the ring is 4 m under, and the one crossing
  // between is the only dip the eye can see: measured on Jolene's field borders 1.3-2.4 m before (the patch's 2.2 m over
  // 40 m and a ring vertex sunk 4 m wherever its chunk was built), a few decimetres after. Every feature that paints the
  // patch lies >= 12 m inside it (activeChunks' margins: a road's falloff + 6, a runway's shoulder + 30, a zone's 40),
  // where the ring is already a metre or more under - the G434.1 rule (no ring chord through a road or a pad) holds.
  const PATCH_TUCK = { tuck: 0.8, tuckW: 12, ring0: 4, ring1: 28, sink: 4 };   // (GATE LOOKS walks every phase of the ring's grid: worst dip 0.51 m, the old laws 3.85; the ring 1.04 m under a road 12 m in)
  const ringSink = (x, z) => { const d = patchDepth(x, z), P = PATCH_TUCK; if (d <= P.ring0) return 0; const t = Math.min(1, (d - P.ring0) / (P.ring1 - P.ring0)); return P.sink * t * t * (3 - 2 * t); };
  let patchB = null;
  function patchDepth(x, z) {
    const A = patchAct, b = patchB; if (!A || !b) return 0;
    // (the chunk the point is IN, a shared edge the upper chunk's: a point on an unbuilt chunk's edge is 0 deep. The
    // patch's inline walk took floor((x - 0.01) / 64) and skipped that chunk itself, so a vertex on a chunk's low x or
    // low z edge never measured the unbuilt chunk it lay on: it stood at the ground, a column 2 m over its tucked
    // neighbour 2 m in - a thin wall along two of every border's four sides)
    const ei = Math.floor(x / PCH), ej = Math.floor(z / PCH);
    if (!A.act.has(A.key(ei, ej))) return 0;
    let edge = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      if (!di && !dj) continue;
      if (A.act.has(A.key(ei + di, ej + dj))) continue;
      const nx0 = (ei + di) * PCH, nz0 = (ej + dj) * PCH;
      const dx = Math.max(nx0 - x, x - nx0 - PCH, 0), dz = Math.max(nz0 - z, z - nz0 - PCH, 0);
      edge = Math.min(edge, Math.hypot(dx, dz));
    }
    return Math.max(0, edge);
  }
  // G680: the patch in slices (a chunk batch of the ground sampling, a block of the LODs, a yield each) - the
  // roll-out's world step drives it through rebuildSteps; an edit's rebuild runs it to the end at once
  function buildPatch() { const g = buildPatchSteps(); while (!g.next().done); }
  function* buildPatchSteps() {
    const b = extentWorld();
    const A = activeChunks(b), list = [...A.act].sort();
    const key = [b.x0, b.z0, b.x1, b.z1].join(',') + '|' + list.join(';');
    const RES = PL.res[0], n = PCH / RES, per = (n + 1) * (n + 1);
    if (patch) { G.ground.remove(patch); patch.traverse(m => { if (m.geometry) m.geometry.dispose(); }); patch = null; }
    patchAct = A; patchB = b;   // the world's rings read it (patchCovers, patchDepth): the ring sinks under the patch (G434.1)
    // the patch's material: the ring's own (its baked map, its grain), CLONED so the material polygons can
    // be mixed in on top of it; its own program key (a different onBeforeCompile must not share a program)
    const matOwn = k => {
      if (patchMatOwn[k]) return patchMatOwn[k];
      const base = (k ? o.patchMat2 : o.patchMat) || o.patchMat || new THREE.MeshLambertMaterial({ color: 0x74853c });
      const M = base.clone(), inner = base.onBeforeCompile;
      // the material polygons ride in on top - unless the host says this ground has no units left for them
      // (patchInject2 false: the far terrain's material is 12 samplers and the polygons' map + four sets are
      // five more - 17 > MAX_TEXTURE_IMAGE_UNITS 16 fails the link and the chunks draw BLACK; G424's census)
      const inj = !(k && o.patchInject2 === false);
      M.onBeforeCompile = sh => { if (typeof ATMO !== 'undefined') ATMO.inject(sh); if (inner) inner(sh); if (inj) injectMaterials(sh); };   // S4
      M.customProgramCacheKey = () => 'premises-patch-materials' + (k ? '-2' : '') + (inj ? '-s' + NSLOT : '');
      return (patchMatOwn[k] = M);
    };
    // TWO GROUNDS UNDER ONE PATCH (G527): a chunk wears the ground it lies on - the host's patchPick says
    // which (the game: the inner ring's material and uv law inside the ring, the far terrain's past it). It
    // was ONE material for the whole record, chosen by its extent: the day a place was put 4.5 km out,
    // the airfield's patch changed material with it, and the far chunks sampled the island's maps through
    // the analytic world's uv law - the deep sea bed, unpainted: black
    const kindOf = (x0, z0) => (o.patchPick && o.patchPick(x0, z0, x0 + PCH, z0 + PCH)) ? 1 : 0;
    // ---- the ONE sampling: every active chunk a (n + 1)^2 grid at 2 m, its own vertices (the seams sample the same ground)
    const act = A.act, ck = A.key;
    // THE GROUND UNDER THE PAVEMENT IS SUNK (G660): under a pavement's opaque interior the patch drops
    // PAVEMENT.SINK.S (0.8 m, twice the worst LOD error measured) and the pavement is drawn at terrainH there
    // (its builders' sinkD0) - nothing can pierce it from any distance, and the wheels meet it. Y0 is the
    // ground as it was: the LOD errors and the normals are measured on it (the sink is never seen)
    const PAVs = (typeof PAVEMENT !== 'undefined') ? PAVEMENT : null;
    const pavR = PAVs && O.pavedAt ? PAVs.resolve(null, O.rec, null).recipe : null;
    const sinkOf = pavR ? (x, z) => { const q = O.pavedAt(x, z); return q ? PAVs.sinkAt(q.d, PAVs.opaqueDepth(q.cls, q.halfW, pavR)) : 0; } : null;
    let sunk = 0;
    const Y = new Float32Array(list.length * per), Y0 = sinkOf ? new Float32Array(list.length * per) : Y, UV = new Float32Array(list.length * per * 2), KIND = new Uint8Array(list.length);
    for (let c = 0; c < list.length; c++) {
      const [ci, cj] = list[c].split(',').map(Number), cx0 = ci * PCH, cz0 = cj * PCH;
      const kc = KIND[c] = kindOf(cx0, cz0), uvOf = (kc && o.patchUV2) || o.patchUV;
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
        const v = c * per + j * (n + 1) + i, x = cx0 + i * RES, z = cz0 + j * RES;
        // the fade: the extent's edge, and the nearest unbuilt neighbour chunk's edge (patchDepth, G752)
        const r = Math.min(1, patchDepth(x, z) / PATCH_TUCK.tuckW);
        // 2 cm UNDER the ground (G434.2): the lot patches sit at the ground and the 4 cm lift had buried them; the
        // ring sinks 4 m under the patch now, so no fight there (G434: the border tucks under the ring - G752's PATCH_TUCK)
        Y0[v] = world.terrainH(x, z) - 0.02 * r - PATCH_TUCK.tuck * (1 - r) * (1 - r);
        if (sinkOf) { const sk = sinkOf(x, z); Y[v] = Y0[v] - sk; if (sk > 0) sunk++; }
        if (uvOf) { const q = uvOf(x, z); UV[v * 2] = q[0]; UV[v * 2 + 1] = q[1]; }
      }
      if ((c & 7) === 7) yield 'patch ground';
    }
    // the fine normals: each chunk's own grid, as computeVertexNormals made them on the one mesh
    const NRM = new Float32Array(list.length * per * 3);
    for (let c = 0; c < list.length; c++) for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const at = (ii, jj) => Y0[c * per + Math.max(0, Math.min(n, jj)) * (n + 1) + Math.max(0, Math.min(n, ii))];
      const i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(n, j + 1);
      const gx = (at(i1, j) - at(i0, j)) / ((i1 - i0) * RES), gz = (at(i, j1) - at(i, j0)) / ((j1 - j0) * RES);
      const l = Math.hypot(gx, 1, gz), v = (c * per + j * (n + 1) + i) * 3;
      NRM[v] = -gx / l; NRM[v + 1] = 1 / l; NRM[v + 2] = -gz / l;
    }
    // ---- the blocks
    const blocks = new Map();
    for (let c = 0; c < list.length; c++) {
      const [ci, cj] = list[c].split(',').map(Number), bk = KIND[c] + '|' + Math.floor(ci / PL.block) + ',' + Math.floor(cj / PL.block);   // a block is one material (G527)
      let B = blocks.get(bk); if (!B) blocks.set(bk, B = { cs: [], k: KIND[c], x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity });
      B.cs.push(c); B.x0 = Math.min(B.x0, ci * PCH); B.z0 = Math.min(B.z0, cj * PCH); B.x1 = Math.max(B.x1, (ci + 1) * PCH); B.z1 = Math.max(B.z1, (cj + 1) * PCH);
    }
    const group = new THREE.Group(); group.name = 'premises:patch';
    let tris0 = 0, trisAll = 0;
    for (const B of blocks.values()) {
      yield 'patch block';
      const cx = (B.x0 + B.x1) / 2, cz = (B.z0 + B.z1) / 2, half = Math.hypot(B.x1 - B.x0, B.z1 - B.z0) / 2;
      const lod = new THREE.LOD(); lod.position.set(cx, 0, cz); lod.name = 'premises:patch';
      let yLo = Infinity, yHi = -Infinity;
      for (const c of B.cs) for (let v = c * per; v < (c + 1) * per; v++) { yLo = Math.min(yLo, Y[v]); yHi = Math.max(yHi, Y[v]); }
      lod.position.y = (yLo + yHi) / 2;
      let dPrev = 0;
      for (let L = 0; L < PL.res.length; L++) {
        const s = PL.res[L] / RES, m = n / s;   // index stride into the fine grid, quads a side
        // the level's worst error over the block: every fine vertex against the coarse grid's bilinear surface
        let err = 0;
        if (s > 1) for (const c of B.cs) for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
          const I = Math.min(Math.floor(i / s), m - 1), J = Math.min(Math.floor(j / s), m - 1), fu = i / s - I, fv = j / s - J;
          const g = (ii, jj) => Y0[c * per + jj * s * (n + 1) + ii * s];
          const h = (g(I, J) * (1 - fu) + g(I + 1, J) * fu) * (1 - fv) + (g(I, J + 1) * (1 - fu) + g(I + 1, J + 1) * fu) * fv;
          err = Math.max(err, Math.abs(h - Y0[c * per + j * (n + 1) + i]));
        }
        const d = L === 0 ? 0 : Math.max(dPrev, half + Math.max(err * PL.focal / PL.tolPx, PL.res[L] * PL.minQuads));
        dPrev = d;
        // the geometry: the chunk grids at stride s, plus a skirt round each chunk
        const drop = PL.skirt[L], vPer = (m + 1) * (m + 1) + 4 * (m + 1);
        const nV = B.cs.length * vPer, pos = new Float32Array(nV * 3), nrm = new Float32Array(nV * 3), uv = new Float32Array(nV * 2), idx = [];
        let v = 0;
        const put = (c, i, j, dy) => {   // a fine-grid vertex (i, j in fine units) of chunk c, dy down
          const [ci, cj] = list[c].split(',').map(Number), f = c * per + j * (n + 1) + i;
          pos[v * 3] = ci * PCH + i * RES - cx; pos[v * 3 + 1] = Y[f] - dy - lod.position.y; pos[v * 3 + 2] = cj * PCH + j * RES - cz;
          nrm[v * 3] = NRM[f * 3]; nrm[v * 3 + 1] = NRM[f * 3 + 1]; nrm[v * 3 + 2] = NRM[f * 3 + 2];
          uv[v * 2] = UV[f * 2]; uv[v * 2 + 1] = UV[f * 2 + 1];
          return v++;
        };
        for (const c of B.cs) {
          const base = v;
          for (let j = 0; j <= m; j++) for (let i = 0; i <= m; i++) put(c, i * s, j * s, 0);
          for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) { const a = base + j * (m + 1) + i, b2 = a + 1, cc = a + m + 1, dd = cc + 1; idx.push(a, cc, b2, b2, cc, dd); }
          if (drop > 0) {
            // the four edges, each walked so its skirt faces outward (the material is front-sided)
            const E = [[k => [k, 0], false], [k => [m, k], false], [k => [m - k, m], false], [k => [0, m - k], false]];
            for (const [at] of E) {
              const top = [], bot = [];
              for (let k = 0; k <= m; k++) { const [i, j] = at(k); top.push(base + j * (m + 1) + i); bot.push(put(c, i * s, j * s, drop)); }
              for (let k = 0; k < m; k++) idx.push(top[k], top[k + 1], bot[k], top[k + 1], bot[k + 1], bot[k]);
            }
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3));
        g.setAttribute('normal', new THREE.BufferAttribute(nrm.subarray(0, v * 3), 3));
        g.setAttribute('uv', new THREE.BufferAttribute(uv.subarray(0, v * 2), 2));
        g.setIndex(idx); g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, matOwn(B.k));
        mesh.receiveShadow = true; mesh.name = 'premises:patch'; mesh.renderOrder = -0.3;   // the ground, after the occluders (render_world.js ORDER_NOTE)
        mesh.matrixAutoUpdate = false;
        lod.addLevel(mesh, d);
        if (L === 0) tris0 += idx.length / 3;
        trisAll += idx.length / 3;
      }
      lod.updateMatrix(); lod.matrixAutoUpdate = false;
      group.add(lod);
    }
    group.userData.chunks = list; group.userData.neighbours = A; group.userData.tris = tris0; group.userData.trisAll = trisAll; group.userData.blocks = blocks.size; group.userData.sunk = sunk;
    patch = group; patchKey = key;
    G.ground.add(patch);
  }
  // THE ROADS (game): a draped ribbon per road in its class's tone (the bench wears them into its own
  // ground canvas; the game's terrain has no such canvas) - 3 m along, the width plus a soft verge
  const ROAD_TONE = { 6: 0x8f8574, 5: 0x63636a, 7: 0xb8a57e, 0: 0x6e6a4a, 3: 0x5d5844 };
  let roadMat = null;
  // THE PAVEMENT (contract v1.16, 2026-09-22): when src/viewer/pavement.js is on the page every road, every
  // paved polygon and (in the bench) every strip is a PAVEMENT mesh - the one material, the class from the
  // look, the recipe resolved through PAVEMENT.resolve (the module's, the look's preset, the premises',
  // the entry's); the tone ribbon below is the page-without-the-module fallback
  const PAV = (typeof PAVEMENT !== 'undefined') ? PAVEMENT : null;
  const pavKeys = () => { const cls = new Set(); for (const rd of O.roads) { const L = PG.RUNWAY_LOOKS[rd.look]; if (L && L.cls) cls.add(L.cls); } for (const p of O.pavePolys || []) cls.add(PG.RUNWAY_LOOKS[p.look].cls); for (const r of O.runways) { const L = PG.RUNWAY_LOOKS[r.look]; if (L && L.cls) cls.add(L.cls); } return PAV.keysFor(Array.from(cls)); };
  const pavLib = () => PAV.sharedLib(THREE, pavKeys(), () => { if (o.onBuilt) o.onBuilt(0, 0); });
  const pavSeed = id => { let h = 2166136261; for (const ch of String(id)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return (h % 1000) / 37; };
  // a road crossing a strip's box draws no band over the concrete (the bench's rule)
  // A STRIP'S BAND DOES NOT LIE OVER ANOTHER PAVEMENT (2026-09-23, the user: "where the 2 runways
  // cross, the sides of the runway on top render on top of the runway at the bottom ... it does not
  // make sense to have dirt or sand over a runway, even if they cross"). The band and the pavement
  // are ONE mesh, so no draw order can separate them - the band is faded out where it crosses another
  // strip's pavement or an apron, which is the rule a road's band already keeps (stripKeep below).
  const pavedKeep = self => (x, z) => {
    const L = O.frame.toLocal(x, z); let k = 1;
    for (const r of O.runways) {
      if (r === self || PG.runwayIsWater(r)) continue;
      const box = PG.runwayBox(r, 0), d = PG.sdPoly(box, L[0], L[1]);      // + outside the pavement
      if (d <= 0) return 0;
      k = Math.min(k, Math.max(0, Math.min(1, (d - 1) / 4)));              // and a 4 m fade off its edge
    }
    for (const pp of O.pavePolys || []) {
      const d = PG.sdPoly(pp.poly, L[0], L[1]);
      if (d <= 0) return 0;
      k = Math.min(k, Math.max(0, Math.min(1, (d - 1) / 4)));
    }
    return k;
  };
  const stripKeep = (x, z) => { const L = O.frame.toLocal(x, z); let k = 1; for (const r of O.runways) { if (PG.runwayIsWater(r)) continue; const box = PG.runwayBox(r, 0); if (PG.inPoly(box, L[0], L[1])) return 0; const d = -PG.sdPoly(box, L[0], L[1]); k = Math.min(k, Math.max(0, Math.min(1, (-d - 1) / 4))); }
    // G981: nor over an apron - the taxiways' bands crossed the pad
    for (const pp of O.pavePolys || []) { const d = PG.sdPoly(pp.poly, L[0], L[1]); if (d <= 0) return 0; k = Math.min(k, Math.max(0, Math.min(1, (d - 1) / 4))); }
    return k; };
  const disposePav = m => { if (m.material && m.material.userData && m.material.userData.pav && PAV) PAV.dispose(m.material); };
  // THE GUARDRAIL (2026-09-22): the W-beam module decides WHERE from the ground itself (the drop past
  // the shoulder, the bend's outside); this says where one may not stand - the user's "the large road
  // sections with nothing but forest": not over a plot or within 8 m of one (a frontage, a drive), not
  // in a junction (within a road's own width of another road's centreline), not on a strip's pavement.
  const RAIL = (typeof GUARDRAIL !== 'undefined') ? GUARDRAIL : null;
  function railKeep(rd) {
    return (lx, lz) => {
      // INSIDE a plot only (2026-09-22): "8 m clear of one" read well in the abstract and left the
      // island with thirty metres of rail - the banks that warrant one on Jolene are the shore road's,
      // which has frontages along it. A rail on the verge in front of a house is what the coast looks like.
      for (const p of O.records.plots) if (p.poly && PG.sdPoly(p.poly, lx, lz) < 1.5) return false;
      for (const o2 of O.roads) if (o2 !== rd && o2.pts && o2.pts.length > 1 && PG.roadDist(o2, lx, lz) < o2.w / 2 + 6) return false;   // a junction
      for (const r of O.runways) if (!PG.runwayIsWater(r) && PG.sdPoly(PG.runwayBox(r, 0), lx, lz) < 8) return false;                   // a strip
      return true;
    };
  }
  function buildRail(rd, pr) {
    if (!RAIL || rd.rail === 'off') return null;
    const F = O.frame, hL = (lx, lz) => { const W = F.toWorld(lx, lz); return heightAt(W[0], W[1]); };
    const m = RAIL.build(THREE, { path: pr, w: rd.w, mode: rd.rail || 'auto', name: 'rail:' + rd.id,
      hAt: hL, heightAt, toWorld: (x, z) => F.toWorld(x, z), seed: PG.fnv(String(rd.id)) % 997,
      waterY: world.waterH ? ((lx, lz) => { const W2 = F.toWorld(lx, lz); return world.waterH(W2[0], W2[1]); }) : null,
      keep: railKeep(rd) });
    if (m) { m.userData.premId = rd.id; G.roads.add(m); }
    return m;
  }
  // THE POWER LINE (2026-09-22, the user with a photograph of a Revillagigedo road: "do we have the
  // electric poles?"): the yard kit's poles every ~34 m along one verge with the cable strung between
  // them, and the street lamp that already existed on every second one. A pole may not stand INSIDE a
  // plot (it belongs on the verge in front of a frontage, which is the village's own rule - unlike the
  // guardrail, which keeps 8 m clear of one), nor in a junction, nor on a strip.
  const PWR = (typeof POWERLINE !== 'undefined') ? POWERLINE : null;
  function poleKeep(rd) {
    return (lx, lz) => {
      for (const p of O.records.plots) if (p.poly && PG.inPoly(p.poly, lx, lz)) return false;                                    // a garden
      for (const o2 of O.roads) if (o2 !== rd && o2.pts && o2.pts.length > 1 && PG.roadDist(o2, lx, lz) < o2.w / 2 + 4) return false;   // a junction
      for (const r of O.runways) if (!PG.runwayIsWater(r) && PG.sdPoly(PG.runwayBox(r, 0), lx, lz) < 4) return false;            // a strip
      for (const pp2 of O.pavePolys || []) if (PG.sdPoly(pp2.poly, lx, lz) < 3) return false;                                    // an apron, a pad, a turnaround
      return true;
    };
  }
  let LAMP_F = null;
  function lampFinish() {
    if (LAMP_F) return LAMP_F;
    const HG = window.HOUSE_GEN;
    const F = HG.makeFinish();
    HG.applyFinish(Object.assign({}, HG.DEF, { metalSet: HG.SET_IDX('metal', 'galv') }), F);   // the bench's galvanised (G370)
    LAMP_F = F;
    return F;
  }
  function buildLine(rd, pr, railG) {
    if (!PWR || rd.poles === 'off') return null;
    const VG = window.VILLAGE_GEN, HG = window.HOUSE_GEN, HK = window.HOUSE_KIT, PR = propReg(), pp = typeof propPlace === 'function' ? propPlace : null;
    if (!VG || !HG || !HK || !pp || !PR) return null;
    const F = O.frame, LF = lampFinish();
    const bags = { metal: HK.Bag('metal'), glass: HK.Bag('glass') };
    const lit = [];
    // the verge the guardrail did NOT take, when it took exactly one (the photograph's arrangement)
    const rs = railG && railG.userData.guardrail ? railG.userData.guardrail.sides : null;
    const side = (rd.polesSide ? +rd.polesSide : 0) || (rs && rs.length === 1 ? -rs[0] : 0);
    const g = PWR.build(THREE, { path: pr, w: rd.w, mode: rd.poles || 'auto', name: 'poles:' + rd.id,
      side, seed: PG.fnv(String(rd.id)) % 997, toWorld: (x, z) => F.toWorld(x, z), heightAt,
      keep: poleKeep(rd),
      place: q => { if (!PR.props[q.key]) return null; const o = pp(THREE, q.key, q.x, q.z, q.ry, q.y); if (q.scale) o.scale.setScalar(q.scale); tiltToGround(o, (x, z) => O.terrainAt(x, z), q.x, q.z, q.ry); return o; },
      lamp: q => { const L = VG.streetLamp(bags, q); if (L) lit.push(L); } });
    if (!g) return null;
    PWR.own(bags.metal.mesh(g, LF.MAT.metal));                                  // the lamps' geometry is the line's to free
    const gm = PWR.own(bags.glass.mesh(g, HG.MAT.glass)); if (gm) gm.castShadow = false;
    // the lens follows the night like every other glass (the finish's uLitK), and each head joins the
    // lamp pool - the nearest eight of the world's lamps get one of the eight point lights
    if (LF.GLASS_U && LF.GLASS_U.uLitK && !LAMPS.glass.has(LF.GLASS_U.uLitK)) { LAMPS.glass.set(LF.GLASS_U.uLitK, LF.GLASS_U.uLitK.value); LF.GLASS_U.uLitK.value = LF.GLASS_U.uLitK.value * LAMPS.on; }
    for (const L of lit) if (isFinite(L.x) && isFinite(L.y) && isFinite(L.z)) LAMPS.pub.push({ grp: g, p: [L.x, L.y, L.z], col: L.col || [1, 0.92, 0.74], k: L.k == null ? 1 : L.k, range: L.range || 30, kind: L.kind });
    g.userData.premId = rd.id;
    g.userData.lamps = lit.length;
    G.roads.add(g);
    return g;
  }
  // G995 (A5-LOAD): the roads a yield each (their ribbons sample the ground's raster: 1.3 s in one task of the
  // roll-out's world step on Jolene); buildRoads runs it to the end
  function buildRoads() { const g = buildRoadsSteps(); while (!g.next().done); }
  function* buildRoadsSteps() {
    for (const c of G.roads.children.slice()) {
      if (RAIL && c.userData.guardrail) { RAIL.dispose(c); continue; }
      if (PWR && c.userData.powerline) { PWR.dispose(c); continue; }      // the cable's own geometry; the poles are shared prop meshes
      G.roads.remove(c); if (c.geometry) c.geometry.dispose(); disposePav(c);
    }
    if (PAV) {
      const lib = pavLib();
      for (const rd of O.roads) {
        if (rd.ribbon === false) continue;   // a taxiway under its own material polygon (G434) - or a paved polygon now
        const L = PG.RUNWAY_LOOKS[rd.look]; if (!L || !L.cls) continue;
        const RS = PAV.resolve(rd, O.rec, L);
        const pr = PG.polyRoad(rd.pts, rd.w);
        const geo = PAV.roadGeometry(THREE, { road: pr, w: rd.w, shoulderW: PAV.shoulderFor(RS.band, RS.recipe), cls: RS.cls, seed: pavSeed(rd.id), toWorld: (x, z) => O.frame.toWorld(x, z), heightAt, lift: 0.07, step: 3, resV: Math.max(0.5, rd.w / 6), shoulderK: stripKeep,
          sinkD0: o.game ? PAV.opaqueDepth(RS.cls, rd.w / 2, RS.recipe) : null });   // the patch is sunk under it (G660)
        const marks = RS.marks === 'none' ? { rects: [], segs: [], wid: rd.w } : PAV.roadMarks(pr.length, rd.w, RS.cls, RS.recipe);
        if (RS.marks === 'edges') marks.rects = marks.rects.filter(r => !(r[5] > 0)); else if (RS.marks === 'centre') marks.rects = marks.rects.filter(r => r[5] > 0);
        const rb = geo.boundingSphere, rKeep = rb ? stripBoxesNear(rb.center.x - rb.radius, rb.center.z - rb.radius, rb.center.x + rb.radius, rb.center.z + rb.radius, null) : [];
        const mat = PAV.make(THREE, { lib, cls: RS.cls, marks, road: true, recipe: RS.recipe, band: RS.band, keep: rKeep, fadeA: rd.fadeA, fadeB: rd.fadeB, side: !!rd.taxiway });   // G981: the junctions; G980: a taxiway's sides
        const m = new THREE.Mesh(geo, mat); m.renderOrder = 3; m.receiveShadow = true; m.name = 'road:' + rd.id;   // culled by its own sphere (G663) m.userData.premId = rd.id;
        G.roads.add(m);
        buildLine(rd, pr, buildRail(rd, pr));
        yield 'roads';
      }
      yield* buildPolysSteps();
      return;
    }
    if (!roadMat) roadMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const rd of O.roads) {
      if (rd.ribbon === false) continue;   // a taxiway under its own material polygon (G434)
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
      buildLine(rd, pr, buildRail(rd, pr));
    }
  }
  // THE PAVED POLYGONS (v1.16): an apron, a turnaround, a pad - a material polygon with a look; drawn under
  // the roads group (renderOrder 2: a road crossing an apron draws over it), the lanes turned by its yaw
  // the strips near a world box, as PAVEMENT keep boxes (G664): a side fading over a strip's surface is cut there
  const stripBoxesNear = (x0, z0, x1, z1, self) => {
    const out = [];
    O.runways.forEach((r, i) => { const A = O.aerodromes[i]; if (!A || r === self || PG.runwayIsWater(r)) return;
      const R = Math.hypot(A.len, A.wid) / 2, dx = Math.max(x0 - A.x, A.x - x1, 0), dz = Math.max(z0 - A.z, A.z - z1, 0), d = Math.hypot(dx, dz);
      if (d < R + 15) out.push({ d, cx: A.x, cz: A.z, hdg: A.hdg, halfL: A.len / 2, halfW: A.wid / 2 }); });
    return out.sort((a, b) => a.d - b.d);
  };
  function* buildPolysSteps() {
    if (!PAV) return;
    const lib = pavLib();
    for (const pp of O.pavePolys || []) {
      const L = PG.RUNWAY_LOOKS[pp.look]; if (!L || !L.cls) continue;
      const RS = PAV.resolve(pp, O.rec, L);
      const poly = pp.poly.map(q => O.frame.toWorld(q[0], q[1]));
      const geo = PAV.polyGeometry(THREE, { poly, cls: RS.cls, seed: pavSeed(pp.id), shoulderW: PAV.shoulderFor(RS.band, RS.recipe), heightAt, lift: 0.08, res: 2, yaw: (pp.yaw || 0) + O.frame.yaw,
        sinkD0: o.game ? PAV.opaqueDepth(RS.cls, 1e3, RS.recipe) : null });
      // an apron may be a PARKING AREA: its stands' lead-in lines and nose stops, in its own frame
      const marks = pp.stands ? PAV.standMarks(pp.stands, (geo.userData.pav || {}).halfW || 0) : { rects: [], segs: [] };
      const bs = geo.boundingSphere, keep = bs ? stripBoxesNear(bs.center.x - bs.radius, bs.center.z - bs.radius, bs.center.x + bs.radius, bs.center.z + bs.radius, null) : [];
      const mat = PAV.make(THREE, { lib, cls: RS.cls, marks, poly: true, recipe: RS.recipe, band: RS.band, keep });
      const m = new THREE.Mesh(geo, mat); m.renderOrder = 2 + (pp.z || 0) * 0.01; m.receiveShadow = true; m.name = 'pave:' + pp.id; m.userData.premId = pp.id;
      G.roads.add(m);
      yield 'paved';
    }
  }
  function buildWater() {
    if (water) { G.water.remove(water); water.geometry.dispose(); water = null; }
    if (!o.water) return;
    const wy = world.waterH ? world.waterH(0, 0) : 0;
    if (!isFinite(wy)) return;
    const g2 = new THREE.PlaneGeometry(W * 1.6, H * 1.6);
    g2.rotateX(-Math.PI / 2);
    // G460: the one water material (body 3, the premises row: glassy, its own depth) when the
    // page carries it; the editor's own sheet otherwise
    const WSH = (typeof WATER !== 'undefined' && THREE.MeshPhysicalMaterial) ? WATER : null;
    water = new THREE.Mesh(WSH ? WSH.tag(THREE, g2, 3, false) : g2,
      WSH ? WSH.make(THREE) : new THREE.MeshStandardMaterial({ color: 0x1f3a48, roughness: 0.32, metalness: 0, transparent: true, opacity: 0.86 }));
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
    const src = entry.poly || (entry.pts ? entry.pts.map(p => [p[0], p[1]]) : (entry.kind === 'tree' || entry.kind === 'prop' || entry.kind === 'billboard' || entry.kind === 'aircraft' || entry.kind === 'animal' ? [[entry.x, entry.z]] : (entry.c && entry.len ? (E => [E.end0, E.end1])(PG.runwayEnds(Object.assign({}, PG.RUNWAY_DEF, entry))) : [])));
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
    // THE SELECTED STRIP (v9): its box in white and its SHOULDER - the radius of terraforming, where the
    // grade's bank has come back to the terrain - as a fainter loop around it
    const rSel = selectedId ? O.runways.find(r => r.id === selectedId) : null;
    if (rSel) {
      const F = O.frame;
      const loop = (poly, col, op, lift, what) => { const pts = poly.map(q => F.toWorld(q[0], q[1])); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(groundLoop(pts, true, LIFT + lift), 3)); const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: op, depthTest: false })); line.renderOrder = 8; line.name = 'runway:' + rSel.id + ':' + what; line.userData.premId = rSel.id; return line; };
      const box = loop(PG.runwayBox(rSel, 0), 0xffffff, 0.9, 0.06, 'box'), sh = loop(PG.runwayBox(rSel, PG.runwayShoulder(rSel)), 0xffb03a, 0.8, 0.04, 'shoulder');
      G.outlines.add(box); LINES.set(rSel.id + ':box', { line: box, layer: 'runways', entry: rSel });
      G.outlines.add(sh); LINES.set(rSel.id + ':shoulder', { line: sh, layer: 'runways', entry: rSel });
    }
    // the site items' feet (cyan) and the links (a line from hook to hook)
    for (const it of O.records.items) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(groundLoop(it.foot.map(q => O.frame.toWorld(q[0], q[1])), true, LIFT * 0.8), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x4fc7d0, transparent: true, opacity: it.site === selectedId ? 0.95 : 0.5, depthTest: false }));
      line.renderOrder = 8; line.name = 'item:' + it.id;
      G.plots.add(line);
    }
    // the plots: thin, dim, not hittable
    for (const c of G.plots.children.slice()) { G.plots.remove(c); c.geometry.dispose(); c.material.dispose(); }
    for (const L of O.records.links) if (L.geom && L.geom.from) {
      const a = O.frame.toWorld(L.geom.from[0], L.geom.from[2]), b = O.frame.toWorld(L.geom.to[0], L.geom.to[2]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([a[0], L.geom.from[1], a[1], b[0], L.geom.to[1], b[1]]), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: L.ok ? 0xffd060 : 0xff5a5a, transparent: true, opacity: 0.9, depthTest: false }));
      line.renderOrder = 8; line.name = 'link:' + L.link.id;
      G.plots.add(line);
    }
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
    for (const c of G.runways.children.slice()) { G.runways.remove(c); c.traverse(m => { if (m.geometry && !m.userData.sharedGeo) m.geometry.dispose(); if (m.material && m.material.map && m.userData.ownMap) m.material.map.dispose(); if (m.userData.pavMat) disposePav(m); }); }
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
      const LKp = PG.RUNWAY_LOOKS[r.look];
      if (PAV && R && SITE.sitePaintStrip && LKp && LKp.cls && !PG.runwayIsWater(r)) {
        // THE PAVEMENT STRIP (v1.16): what the game will stand - the same builder, the same recipe
        const RS = PAV.resolve(r, O.rec, LKp);
        const geo = PAV.stripGeometry(THREE, { len: A.len, wid: A.wid, hdg: A.hdg, cx: A.x, cz: A.z, shoulderW: PAV.shoulderFor(RS.band, RS.recipe), cls: RS.cls, seed: pavSeed(r.id), heightAt, lift: 0.07, resU: 6, resV: 3, shoulderK: pavedKeep(r) });
        const keep = stripBoxesNear(A.x - A.len / 2, A.z - A.len / 2, A.x + A.len / 2, A.z + A.len / 2, r);
        const mat = PAV.make(THREE, { lib: pavLib(), cls: RS.cls, marks: RS.marks === 'none' ? { rects: [], segs: [] } : PAV.marksOf(R, SITE.sitePaintStrip), recipe: RS.recipe, band: RS.band, keep });
        const pm = new THREE.Mesh(geo, mat); pm.renderOrder = 2; pm.receiveShadow = true; pm.name = 'runway:' + r.id; pm.userData.premId = r.id; pm.userData.pavMat = true;
        G.runways.add(pm);
        if (SITE.sitePattern && window.PATTERN_VIS) {
          try { const pat = SITE.sitePattern(A, r.site || null); const pv = window.PATTERN_VIS.buildPatternVis(THREE, pat, (x, z) => heightAt(x, z), { patternPath: SITE.patternPath, siteRunway: SITE.siteRunway }); const grp = pv.group || pv; if (pv.setLayers) pv.setLayers({ graph: true, slope: true, targets: true }); grp.name = 'pattern:' + r.id; G.runways.add(grp); } catch (e) { console.warn('premises pattern', r.id, e && e.message); }
        }
        return;
      }
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
      // THE LOOK (v9): a set of the site's or the lot's under the markings; 'none' and 'grass' the bare
      // ribbon with the markings (the bench's ground carries the grass; the game paints its own)
      const LK = PG.RUNWAY_LOOKS && r.look ? PG.RUNWAY_LOOKS[r.look] : null;
      if (LK && LK.set) {
        const sets = Object.assign({}, (typeof LOT_TEX_SETS !== 'undefined' && LOT_TEX_SETS) || {}, (typeof SITE_TEX_SETS !== 'undefined' && SITE_TEX_SETS) || {});
        const S = sets[LK.set];
        if (S && S.diff) {
          const t = new THREE.Texture(S.diff); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
          const tile = S.tile || 4; t.repeat.set(Math.max(1, Math.round(A.len / tile)), Math.max(1, Math.round(A.wid / tile)));
          if (S.diff.complete && S.diff.naturalWidth) t.needsUpdate = true; else S.diff.addEventListener('load', () => { t.needsUpdate = true; }, { once: true });
          const gm = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
          gm.receiveShadow = true; gm.renderOrder = 5; gm.name = 'runway:' + r.id + ':look'; gm.userData.premId = r.id; gm.userData.ownMap = true;
          G.runways.add(gm);
        }
      }
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

  // ---- THE ANIMALS (2026-09-22) -------------------------------------------------------------
  // Every `animal` object of the record is a HOTSPOT: n of a species within r metres. The herd,
  // the pod or the flock is animal_run.js's; this owns only the hand-off - the hotspots in WORLD
  // coordinates (the premises frame applied) and the host contract that module asks for: the
  // composed ground (never the world's raw terrain - an elk stands on the flattened meadow), the
  // world's water, the eye for the cull, and the aeroplane's own water effects where they exist.
  let ANIM = null;
  function animalCtx() {
    return {
      scene: G.animals, ground: (x, z) => O.terrainAt(x, z),
      waterH: (x, z) => (world.waterH ? world.waterH(x, z) : -Infinity),
      eye: o.eye || null,
      // THE WATER IS THE AEROPLANE'S OWN (the user: "the whales should trigger the water surface
      // effects, just like the planes, wake and splashes, they're there and available"): the H7
      // interaction field, which is only ON while the aircraft is itself near water - which is
      // exactly the close range the ask names.
      stamp: (x, z, r, amp, foam, kind) => (window.WATER && WATER.field && WATER.field.on
        ? WATER.stamp(x, z, r, amp, foam, kind) : false),
      spray: (kind, x, y, z, vx, vy, vz) => { if (typeof window.FLYDIY_SPRAY === 'function') window.FLYDIY_SPRAY(kind, x, y, z, vx, vy, vz); },
      // ...and the animals may ASK for the field, so a landplane low over a pod gets the wake too
      // (app.js's syncWaterFx block reads WATER.field.ask; the ask expires in half a second)
      wantWater: () => { if (window.WATER && WATER.field) WATER.field.ask = performance.now(); },
      lit: () => (LAMPS.smokeK === undefined ? 1 : LAMPS.smokeK),     // the day's haze factor, the chimneys' own
      // world.wind(x, y, z, t) is the world's own sampler (clouds.js reads it the same way)
      wind: () => { if (typeof world.wind !== 'function') return [0, 0]; const w = world.wind(0, 20, 0, 0); return w ? [w[0], w[2]] : [0, 0]; },
    };
  }
  // THE AMBIENT FLOCKS (the user: "flocks of birds ... should probably just go across the map"):
  // not a record's - the world's. They are born outside 1.2 km of the eye, cross and die at 1.6,
  // and they belong here only because the premises runner is the one clock the world already
  // turns. In the EDITOR they are off: a flock crossing the plan view is noise.
  // window.FLYDIY_FLOCKS sets how many (0 turns them off entirely).
  const AMBIENT = () => (typeof window !== 'undefined' && window.FLYDIY_FLOCKS !== undefined
    ? (window.FLYDIY_FLOCKS | 0) : 2);
  function syncAnimals() {
    const spots = (O.records && O.records.animals) || [];
    const air = window.ANIMALS && window.ANIMALS.list ? (window.ANIMALS.list('air')[0] || null) : null;
    const nAmb = (o.game && air) ? AMBIENT() : 0;
    if (!ANIM && (!(spots.length || nAmb) || !window.ANIMAL_RUN || !window.ANIMALS)) { stats.animals = 0; return; }
    if (!ANIM) { try { ANIM = window.ANIMAL_RUN.make(THREE, animalCtx()); } catch (e) { console.warn('premises animals', e && e.message); return; } }
    const F = O.frame;
    ANIM.sync(spots.map(sp => { const w = F.toWorld(sp.x, sp.z);
      return { id: sp.id, key: sp.key, x: w[0], z: w[1], n: sp.n, r: sp.r, yaw: (sp.yaw || 0) + (F.yaw || 0), dy: sp.dy }; }));
    if (air) ANIM.ambient(nAmb, air.key);
    // the tick's own gate reads this (render_world): a world with only ambient flocks still runs
    stats.animals = ANIM.stats.animals + nAmb;
  }

  // ---- THE TRAM RUNS (G398.3): a cable link's stations tied by their ropes as tubes and two cabins in a
  // jig-back - the village's tram_run on the solved line (its geom is vil.tram's shape: docks, ropes,
  // slots, in the premises frame with absolute heights) - ticked by the host's clock (R.tick). Rebuilt
  // only when the solved line changes; the cabins are the cabin pack's when it is here, else the rope
  // curves alone. The group carries the frame's transform, so the run works in premises coordinates.
  const TRAMS = new Map();
  const tramKey = L => JSON.stringify([L.geom.docks.map(d => [d.p, d.yaw]), L.geom.ropes.map(r => [r.a, r.b, r.kind, r.line])]);
  function syncTrams() {
    const TR = window.TRAM_RUN, CB = window.CABIN, F = O.frame;
    const want = new Map();
    if (TR) for (const L of O.records.links) if (L.ok && L.geom && L.geom.docks && L.geom.ropes && L.geom.ropes.length >= 2) want.set(L.link.id, L);
    for (const [id, t] of TRAMS) { const L = want.get(id); if (!L || tramKey(L) !== t.key) { G.tram.remove(t.grp); t.grp.traverse(m => { if (m.geometry) m.geometry.dispose(); }); TRAMS.delete(id); } }
    for (const [id, L] of want) {
      if (TRAMS.has(id)) continue;
      const grp = new THREE.Group(); grp.name = 'tram:' + id; grp.position.set(F.anchor.x, 0, F.anchor.z); grp.rotation.y = F.yaw || 0;
      const cabs = [0, 1].map(() => (CB ? { pivot: CB.PIVOT, ropeUp: CB.ROPE_UP } : null));
      let run = null;
      try { run = TR.make(L.geom, cabs, { sag: 0.012, v: +L.link.speed > 0 ? +L.link.speed : 6.0 }); } catch (e) { console.warn('premises tram', id, e && e.message); continue; }   // GTRAM: the link's `speed`, the village's 6 m/s without one
      const ropeMat = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.6, metalness: 0.7 });
      L.geom.ropes.forEach((rp, k) => {
        const Ln = run.lines[rp.line === undefined ? (k >> 1) : rp.line];
        const rc = TR.ropeCurve(rp.a, rp.b, 0.012, Ln.rope.t0, Ln.rope.t1);
        const pts = []; for (let i = 0; i <= 48; i++) { const q = rc.at(i / 48); pts.push(new THREE.Vector3(q[0], q[1], q[2])); }
        const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, rp.kind === 'track' ? 0.055 : 0.035, 6, false);
        const m = new THREE.Mesh(geo, ropeMat); m.castShadow = true; grp.add(m);
      });
      // GTRAM: THE CABINS AT NIGHT - built lit (the panes glow on the finish's night uniform, the lamps' glass too) but without their
      // own PointLights (a count that changes recompiles every lit material); their ceiling lights and markers join the lamp pool
      // as MOVING lamps, re-read off the cabin every frame while they are among the nearest
      const onLights = (lights, c) => { for (const Lc of lights || []) LAMPS.pub.push({ grp: c, p: [Lc.x, Lc.y, Lc.z], col: Lc.col || [1, 0.92, 0.74], k: Lc.k == null ? 1 : Lc.k, range: Lc.range || 8, kind: 'cabin', move: true }); LAMPS.near = null; };
      if (CB) { try { const objs = [0, 1].map(i => { const c = CB.build(THREE, { livery: i ? 'admiralty' : 'chatham', lit: 1, points: false, onLights }); grp.add(c); return c; }); run.attach(objs); } catch (e) { console.warn('premises tram cabins', id, e && e.message); } }
      G.tram.add(grp); TRAMS.set(id, { key: tramKey(L), grp, run });
    }
    stats.trams = TRAMS.size;
  }
  // ---- PROTO TRAFFIC (G432, the user: "possibly generate some proto traffic"): a road whose record says
  // `traffic` (vehicles per km) runs that many everyday vehicles up and down it - each an AUTO prop
  // (propPlace: the LOD ladder rides along), on the right-hand side of its direction of travel at a
  // quarter of the road's width off the centreline, at 35-55 km/h, turning round at the road's ends,
  // keeping its distance from the one ahead. The ground is read every tick (heightAt + the tilt), so a
  // car follows a graded road's own profile. Deterministic from the road's id: the same cars, the same
  // way round, at every boot. Rebuilt when the road's line, width or count changes.
  const TRAFFIC = new Map();       // road id -> { key, cars: [{ grp, key, s, dir, v, v0, K }], pr, w, L }
  const trafficOf = rd => (rd.traffic > 0 ? rd.traffic : (LIFE ? LIFE.trafficOf(rd) : 0));   // the record's, else the life's (SCENERY LIFE)
  const trafficKey = rd => JSON.stringify([rd.pts, rd.w, trafficOf(rd)]);
  const trafficMenu = () => {
    const HG = window.HOUSE_GEN, VG = window.VILLAGE_GEN, PR = propReg();
    const m = VG && VG.autoMenu ? VG.autoMenu('carpark').concat(HG && HG.AUTO_KEYS ? HG.AUTO_KEYS(['truck', 'bus']) : []) : [];
    return m.filter(k => PR && PR.props[k]);
  };
  function syncTraffic() {
    const pp = typeof propPlace === 'function' ? propPlace : null, HG = window.HOUSE_GEN;
    const want = new Map();
    if (pp) for (const rd of O.roads) if (trafficOf(rd) > 0 && rd.pts.length >= 2) want.set(rd.id, rd);
    for (const [id, t] of TRAFFIC) { const rd = want.get(id); if (!rd || trafficKey(rd) !== t.key) { for (const c of t.cars) { hitDrop(c.grp); G.traffic.remove(c.grp); } TRAFFIC.delete(id); } }
    const menu = trafficMenu();
    for (const [id, rd] of want) {
      if (TRAFFIC.has(id) || !menu.length) continue;
      const pr = PG.polyRoad(rd.pts, rd.w), L = pr.length;
      const n = Math.max(1, Math.round(trafficOf(rd) * L / 1000));
      const rnd = PG.mulberry32(PG.fnv(String(id)) ^ 0x7a4f);
      const cars = [];
      for (let i = 0; i < n; i++) {
        const key = menu[Math.floor(rnd() * menu.length)];
        const K = (HG && HG.YARD_KIT && HG.YARD_KIT[key]) || { L: 4.5, W: 1.8 };
        const dir = i % 2 ? -1 : 1, v0 = (35 + rnd() * 20) / 3.6 * (K.L > 7 ? 0.8 : 1);
        const grp = pp(THREE, key, 0, 0, 0, 0); grp.name = 'traffic:' + id + ':' + i;
        G.traffic.add(grp);
        const car = { grp, key, K, s: (i + 0.5) * L / n, dir, v: v0, v0, hit: 0 };
        if (TRAFFIC_HITBOX) hitAdd(grp, 'traffic', 0.5, id => { car.hit = id; });
        cars.push(car);
      }
      TRAFFIC.set(id, { key: trafficKey(rd), cars, pr, w: rd.w, L });
      moveTraffic(TRAFFIC.get(id), 0);
    }
    stats.traffic = 0; for (const [, t] of TRAFFIC) stats.traffic += t.cars.length;
  }
  function moveTraffic(t, dt) {
    const F = O.frame, off = Math.max(0.9, Math.min(1.6, t.w / 4));
    for (const c of t.cars) {
      // the one ahead in my direction: slow to its speed inside two lengths, else my own
      let gap = Infinity, vAhead = c.v0;
      for (const d of t.cars) if (d !== c && d.dir === c.dir) { let g = (d.s - c.s) * c.dir; if (g < 0) g += t.L; if (g < gap) { gap = g; vAhead = d.v; } }
      const tgt = gap < c.K.L + 6 ? Math.min(c.v0, vAhead * 0.9) : c.v0;
      c.v += (tgt - c.v) * Math.min(1, dt * 1.5);
      c.s += c.dir * c.v * dt;
      if (c.s > t.L) { c.s = 2 * t.L - c.s; c.dir = -1; } else if (c.s < 0) { c.s = -c.s; c.dir = 1; }
      const a = t.pr.at(c.s), tx = a.tg[0] * c.dir, tz = a.tg[1] * c.dir;
      const rx = -tz, rz = tx;                                    // the right-hand side of the direction of travel (x right, z toward the viewer, y up)
      const w = F.toWorld(a.p[0] + rx * off, a.p[1] + rz * off);
      const ry = Math.atan2(tx, tz) + (F.yaw || 0);
      const gy = heightAt(w[0], w[1]);
      c.grp.position.set(w[0], gy, w[1]);
      tiltToGround(c.grp, heightAt, w[0], w[1], ry);
      if (c.hit) { const R = OBS(); if (R) R.move(c.hit, w[0], w[1], ry, gy); }
    }
  }
  // the clock: the host's dt in seconds; the cabins and the traffic move
  // A DISTANT HOUSE DRAWS ITS WALLS AND ROOF (PERF 2026-09-23). A house is ~11 bag meshes, each its own finish
  // (no two houses share a material, so nothing batches), and the frame is CPU-bound on the draw count: at 300 m
  // over the field the village's houses were 1 023 draws of the 2 470, every one of them 4-15 px tall. Under
  // DETAIL.px of projected diameter a house hides its SMALLEST opaque bags - smallest by SURFACE AREA, as many as
  // together make DETAIL.area of the house's (a bag gathers one finish from all over the house, so its sphere is
  // the house's: area is the size of what it draws). That is trim, frames, steps, rails, the chimney - ~4 of 11
  // draws, all sub-pixel there; the walls and the roof stay, and so does all that LIGHTS the village or moves in
  // it: glass, the lit panes, emissive, transparent (the smoke), the props.
  const DETAIL = { px: 16, area: 0.08, hyst: 0.1, px2: 60, keep2: 3, props: true };
  // THE SECOND CUT (G557): under px2 (a 14 m house past ~270 m at 1080p) a house keeps only its keep2 largest plain
  // bags - the walls, the roof - and whatever is glass or lit; the trims, sills, doors and boards go (Metlakatla's
  // 641 houses drew ~2 800 bags over the town)
  const areaOf = g => {
    const p = g.attributes.position, ix = g.index, n = ix ? ix.count : p.count;
    let a = 0;
    for (let i = 0; i < n; i += 3) {
      const i0 = ix ? ix.getX(i) : i, i1 = ix ? ix.getX(i + 1) : i + 1, i2 = ix ? ix.getX(i + 2) : i + 2;
      const ax = p.getX(i0), ay = p.getY(i0), az = p.getZ(i0);
      const ux = p.getX(i1) - ax, uy = p.getY(i1) - ay, uz = p.getZ(i1) - az, vx = p.getX(i2) - ax, vy = p.getY(i2) - ay, vz = p.getZ(i2) - az;
      a += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
    return a;
  };
  function detailOf(grp) {
    let D = grp.userData.detail;
    if (D) return D;
    const bags = grp.children.filter(c => c.isMesh && !c.userData.sharedGeo && c.geometry);
    let R = 0;
    for (const m of bags) { if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere(); R = Math.max(R, m.geometry.boundingSphere.radius); }
    const plain = m => { const mt = m.material;
      return !Array.isArray(mt) && mt.type === 'MeshStandardMaterial' && !mt.transparent && (!mt.emissive || mt.emissive.getHex() === 0) && !mt.emissiveMap; };
    const cand = bags.filter(plain).map(m => [m, areaOf(m.geometry)]).sort((a, b) => a[1] - b[1]);
    const total = cand.reduce((t, x) => t + x[1], 0), list = [];
    let acc = 0;
    for (const [m, a] of cand) { if (acc + a > DETAIL.area * total) break; acc += a; list.push(m); }
    const list2 = cand.slice(0, Math.max(0, cand.length - DETAIL.keep2)).map(x => x[0]).filter(m => !list.includes(m));
    const big = bags.find(m => m.geometry.boundingSphere.radius === R);
    const c = new THREE.Vector3(); if (big) c.copy(big.geometry.boundingSphere.center).applyMatrix4(big.matrixWorld); else grp.getWorldPosition(c);
    const keep = cand.map(x => x[0]).filter(m => !list.includes(m) && !list2.includes(m));
    D = grp.userData.detail = { list, list2, keep, plain: cand.map(x => x[0]), c, R, on: true, on2: true };
    return D;
  }
  // THE FAR TOWN (G559, HLOD): past HLOD.near from a 256 m cell's edge, the cell's houses are ONE mesh - each house's
  // kept bags (walls, roof: what the second cut leaves) merged in world space with a vertex colour = the bag's
  // material colour x its map's mean (linear), one shared plain material; their plain bags hide. Glass and lit bags
  // stay the house's own. Built per cell once the cell is live (G592: it waited for the whole queue), rebuilt when its houses change.
  const HLOD = { on: true, bake: true, tarr: true, cell: 256, near: 150, far2: 1200, dirt: 0.35, gain: 0.2, sig: '', cells: [], cellMap: new Map(), todo: [], warm: [], group: null,
                 lod1: true, outLod: 1, fadeW: 40 };
  // LOD 1 PAST HLOD.near (G800, C0 of QUEUE-C; ARCH-2026-09-27 §1.2 / §5 interim 1 / §9 rows 2-3). The far town merged
  // each house's lod-0 kept bags (its three largest: 10x the generator's own far mesh). Now every house is ALSO built at
  // lod 1 - the generator's "TWO MESHES, ONE CONSTRUCTION" far mesh, 10 % of the triangles at 15 % of the build, in the
  // same build call under the loading screen (buildHouse), never in the scene - and the far town is merged from it: its
  // opaque bags whole (the windows are panes proud of an unpierced wall), the box rung's extent from its walls and roof.
  // Lod 0 stays near (the house and its TARR bake). The outbuilding is built at lod 1 only (outLod). Dials:
  // WORLD.premises.hlod.{lod1, outLod, near, fadeW} (lod1 / outLod are read at the build: set before the roll-out).
  // THE SWAP IS A DITHERED BAND (G801), the trees' (render_world DITHER_GLSL, A2's fade family): screen-space
  // interleaved-gradient noise against a weight that runs 0 -> 1 across fadeW metres of fragment distance centred on
  // the rung's edge; the rung leaving keeps n < 1 - t, the rung arriving n >= 1 - t - complementary, a pixel draws one
  // rung. The near rung (lod 0: the TARR bake and G566's merges of a house) leaves at `near`, the far town (lod 1)
  // arrives there. The far town's vertices carry their house's centre and radius (aHC), so a house wholly inside the
  // band's near side is dropped in the vertex stage (no fragment work under the lod-0 house at the stand). Visibility is
  // then only a superset (a rung is drawn wherever the band can want it); fadeW 0 is the hard switch of before, per
  // cell with hysteresis. The boxes (G594, past far2 = 1.2 km) keep G559's plain program and their hard switch: a band
  // there was a program more in every pass that draws the town from the stand (the mirror's and the probes' too) for
  // houses a few pixels tall.
  //   ?houselod=0   the lod-0 far town and the lod-0 outbuildings of before (the A/B's "before")
  //   ?houselod=1   the lod-1 far town from 0 m (what the far rung looks like, up close)
  //   ?houselod=N   (N > 1) the near/far edge at N metres
  //   ?lodfade=0    the hard per-cell switch (no band)
  //   ?outlod=0|1   the outbuildings at lod 0 / lod 1, whatever houselod says
  if (typeof location !== 'undefined' && location.search) {
    const q = /[?&]houselod=([\d.]+)/.exec(location.search);
    if (q) { const v = +q[1]; if (v === 0) { HLOD.lod1 = false; HLOD.outLod = 0; } else if (v === 1) HLOD.near = -100; else if (v > 1) HLOD.near = v; }   // 1: the edge behind the eye
    if (/[?&]lodfade=0/.test(location.search)) HLOD.fadeW = 0;
    const qo = /[?&]outlod=([01])\b/.exec(location.search); if (qo) HLOD.outLod = +qo[1];   // the outbuildings alone (after houselod)
  }
  let IN_STREAM = false;   // a build the in-flight stream makes (stream(): no lod 1 there); declared up here, no TDZ (G570)
  const LOD_U = { uLodA: { value: HLOD.near }, uLodB: { value: HLOD.far2 }, uLodW: { value: HLOD.fadeW }, uLodOn: { value: HLOD.fadeW > 0 ? 1 : 0 } };
  const LOD_DECL = 'uniform float uLodA, uLodB, uLodW, uLodOn;';
  // the fragment half: `edges` 'in:A' / 'out:A' (at near; 'in:B' / 'out:B' at far2, unused) - where this rung arrives or leaves
  const lodDither = edges => ['if (uLodOn > 0.5) {',
    '  float _ln = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));',
    '  float _ld = length(vViewPosition), _lw = max(uLodW, 1e-3), _lh = 0.5 * uLodW;']
    .concat(edges.map(e => { const [how, at] = e.split(':'), E = at === 'A' ? 'uLodA' : 'uLodB', t = 'clamp((_ld - (' + E + ' - _lh)) / _lw, 0.0, 1.0)';
      return how === 'in' ? '  if (_ln < 1.0 - ' + t + ') discard;' : '  if (_ln >= 1.0 - ' + t + ') discard;'; }))
    .concat(['}']).join('\n');
  // the far rungs' material: the plain vertex colour of G559, plus the band ('mid' = the lod-1 town; 'hard' = G559's
  // own, no band: the boxes, the items' far town)
  function lodMat(rung) {
    const k = rung === 'hard' ? 'matHard' : 'mat';
    if (HLOD[k]) return HLOD[k];
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    if (rung === 'hard') return (HLOD[k] = m);
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, LOD_U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + LOD_DECL + '\nattribute vec4 aHC;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n' +
          '{ float _hd = distance(cameraPosition, aHC.xyz); if (uLodOn > 0.5 && _hd + aHC.w < uLodA - 0.5 * uLodW) gl_Position = vec4(0.0, 0.0, 2.0, 1.0); }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + LOD_DECL)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + lodDither(['in:A']));
    };
    m.customProgramCacheKey = () => 'hlod:' + rung;
    return (HLOD[k] = m);
  }
  // THE NEAR RUNG'S OTHER BAGS (G801): what G566 merges per distinct material (a site item's finishes, a bag the arrays
  // could not take yet) leaves at the same edge as the TARR bake - a clone of the canonical material with the band after
  // its own hook (its userData shared, as the trees' bandMat does), one program variant per distinct program. A material
  // whose fragment has no view position (a basic one) or no clipping chunk keeps its program and switches per cell.
  function bandOf(cm) {
    if (!cm || cm.isShaderMaterial || typeof cm.clone !== 'function') return cm;
    const B = HLOD.band || (HLOD.band = new Map()); let c = B.get(cm); if (c) return c;
    const h = Object.prototype.hasOwnProperty.call(cm, 'onBeforeCompile') ? cm.onBeforeCompile : (cm._atmoHook || null);
    c = cm.clone(); c.userData = cm.userData;
    c.onBeforeCompile = function (sh, r) {
      if (h) h.call(this, sh, r);
      if (sh.fragmentShader.indexOf('vViewPosition') < 0 || sh.fragmentShader.indexOf('#include <clipping_planes_fragment>') < 0) return;
      Object.assign(sh.uniforms, LOD_U);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + LOD_DECL)
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n' + lodDither(['out:A']));
    };
    c.customProgramCacheKey = () => cm.customProgramCacheKey() + '|hlod:out';
    B.set(cm, c); return c;
  }
  // the generator's lod 1 of a house, as meshes that never join the scene (the far town's source): its opaque bags, the
  // channels the merge does not read dropped; `box` marks the walls and roof (the G594 box's extent)
  // (G830: `b0`, the lod 1 already generated - inline by premises_build.js genHouse, or by the house worker)
  function lod1Bags(HG, P, F, b0) {
    const b = b0 || HG.build(P, 1, F), tmp = new THREE.Group(), out = [];
    for (const k of (b.BAGS || HG.BAGS)) {
      const bg = b.bags[k], mt = F.MAT[k];
      if (!bg || !mt || !mt.isMeshStandardMaterial || mt.transparent) continue;
      const m = bg.mesh(tmp, mt); if (!m) continue;
      for (const a of ['uv', 'aHouseAO', 'aHouseLit', 'aHouseWin']) if (m.geometry.attributes[a]) m.geometry.deleteAttribute(a);
      m.name = k; m.userData.box = /^(siding|roof)/.test(k); out.push(m);
    }
    out.tris = b.stats ? b.stats.tris : 0;
    return out;
  }
  const texMean = new Map(); let texCv = null;
  function meanOf(tex) {
    const img = tex && tex.image; if (!img || !img.width) return null;
    if (texMean.has(img)) return texMean.get(img);
    let c = null;
    try {
      if (!texCv) { texCv = document.createElement('canvas'); texCv.width = texCv.height = 4; }
      const x = texCv.getContext('2d', { willReadFrequently: true }); x.clearRect(0, 0, 4, 4); x.drawImage(img, 0, 0, 4, 4);
      const d = x.getImageData(0, 0, 4, 4).data; let r = 0, g = 0, b = 0;
      for (let i = 0; i < 64; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      c = new THREE.Color().setRGB(r / 4080, g / 4080, b / 4080, THREE.SRGBColorSpace);
    } catch (err) { c = null; }
    texMean.set(img, c); return c;
  }
  // THE NEAR TOWN, BAKED (G566, the user: "these assets are fixed ... could be joined and baked"): the 7 805 house
  // materials are 1 447 distinct - a house's finishes are clones carrying the same values. Once the queue is empty,
  // each cell's house bags are merged per DISTINCT material (one shared canonical material, the render flags and the
  // attribute set - the AO / lit / window channels ride along) into world-space meshes; the sources hide. Glass, lamps,
  // smoke, the parked aeroplanes and anything transparent stay the house's own. While editing, the houses are whole.
  const uval = v => v && v.isColor ? v.getHexString() : v && v.isVector2 ? v.x + ',' + v.y : v && v.isTexture ? v.uuid : (typeof v === 'number' ? +v.toFixed(4) : v && v.value !== undefined ? uval(v.value) : v && typeof v === 'object' ? Object.keys(v).map(k => k + '=' + uval(v[k])).join(';') : String(v));
  const matSig = m => [m.type, m.map && m.map.uuid, m.normalMap && m.normalMap.uuid, m.roughnessMap && m.roughnessMap.uuid, m.aoMap && m.aoMap.uuid, m.color && m.color.getHexString(), m.roughness, m.metalness, m.side, m.alphaTest, m.vertexColors, m.flatShading, m.customProgramCacheKey ? m.customProgramCacheKey() : '', Object.keys(m.userData || {}).filter(k => !TARR_UD.has(k)).sort().map(k => k + ':' + uval(m.userData[k])).join('|')].join('#');
  const TARR_UD = new Set(['houseU', 'glassU', 'hookHouse', 'hookGlass', 'hookCloud']);   // G574's handles: G566's signature is as it was

  // the stack (G574): made on first use. Its ready signal (a layer the bake asked for is in the stack now) marks the
  // cells that baked without it (cl.tarrShort) for a rebake - one cell a frame, like every bake (G593: it cleared the
  // signature and the WHOLE town rebaked twice in a row at the end of the queue). TARR is declared by LAMPS.
  function tarr() {
    if (TARR || typeof window === 'undefined' || !window.HOUSE_TARR || !THREE.DataArrayTexture) return TARR;
    TARR = window.HOUSE_TARR.make(THREE, { px: HLOD.px || 512, onReady: () => { for (const cl of HLOD.cellMap.values()) if (cl.tarrShort) cl.sig = ''; hlodHouses = -1; },
                                           lod: { U: LOD_U, decl: LOD_DECL, glsl: lodDither(['out:A']) } });   // G801: the near rung leaves at near
    TARR.lit.value = LAMPS.kLit === undefined ? 1 : LAMPS.kLit;
    TARR.begin();   // the slot table lives as long as the stack: a cell's rebake re-uses the rows it had (same values, same slot)
    return TARR;
  }
  // THE FAR TOWN PER CELL (G592): a 256 m cell of houses is baked on its own, once the cell is LIVE (nothing queued
  // in or around it) and when its set of houses changed - one cell a frame at most, so the bake never bursts. It was
  // one hlodBuild of every cell, run when the WHOLE build queue was empty, and redone whole for any change.
  function hlodCellDrop(cl) {
    for (const g of cl.houses) { for (const m of g.children) if (m.userData.merged) { m.userData.merged = false; m.visible = true; } if (g.userData.far) { g.userData.far = false; const D = detailOf(g); D.on = true; D.on2 = true; } }
    for (const x of [cl.mesh, cl.box, cl.near, cl.meshH, cl.boxH, cl.nearH]) if (x) { if (x.parent) x.parent.remove(x); x.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }
    cl.mesh = cl.box = cl.near = cl.meshH = cl.boxH = cl.nearH = null; cl.casters = []; cl.far = false; cl.far2 = false;
  }
  function hlodDropAll() {
    for (const cl of HLOD.cellMap.values()) hlodCellDrop(cl);
    HLOD.cellMap.clear(); HLOD.cells = []; HLOD.todo = [];
  }
  // the houses by cell, as they stand now (thrifty and posed)
  function hlodScan() {
    const byCell = new Map();
    for (const g of G.houses.children) {
      if (!g.userData.thrift || !g.userData.frozen || g.userData.batch) continue;
      const D = detailOf(g); if (!D.keep.length) continue;
      const k = Math.floor(D.c.x / HLOD.cell) + ',' + Math.floor(D.c.z / HLOD.cell);
      let L = byCell.get(k); if (!L) byCell.set(k, L = []); L.push(g);
    }
    return byCell;
  }
  // a house takes the band when it has its lod 1 (G801); a site item, a park, an object (no lod 1: their far version
  // is their lod-0 kept bags) keeps the hard per-cell switch of before, every rung of it, in meshes of its own
  const banded = g => !!(HLOD.lod1 && g.userData.lod1 && g.userData.lod1.length);
  function hlodCell(key, houses) {
    const cl = { key, sig: houses.map(g => g.id).join(','), houses, x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity, y: 0, far: false, far2: false, mesh: null, box: null, near: null,
                 meshH: null, boxH: null, nearH: null, farTris: 0, casters: [], castOn: true, tarrShort: false, bake: null };
    for (const g of houses) { const D = detailOf(g); cl.y += D.c.y / houses.length; cl.x0 = Math.min(cl.x0, D.c.x - D.R); cl.x1 = Math.max(cl.x1, D.c.x + D.R); cl.z0 = Math.min(cl.z0, D.c.z - D.R); cl.z1 = Math.max(cl.z1, D.c.z + D.R); }
    // G800: a house's lod 1 (its walls and roof make its box) into the banded far town; the rest's lod-0 kept bags (G559)
    // into the hard one
    const bagsB = [], bagsH = [];
    for (const g of houses) {
      const D = detailOf(g);
      if (banded(g)) { for (const m of g.userData.lod1) if (m.geometry.index) bagsB.push({ m, M: g.matrixWorld, h: g, box: m.userData.box, D }); }
      else for (const m of D.keep) if (m.geometry.index) bagsH.push({ m, M: m.matrixWorld, h: m.parent, box: true, D });
    }
    const B = hlodMerge(bagsB, lodMat('mid'), true), H = hlodMerge(bagsH, lodMat('hard'), false);
    if (B) { cl.mesh = B.mesh; cl.box = hlodBoxes(B.HB, lodMat('hard')); cl.farTris += B.tris; }
    if (H) { cl.meshH = H.mesh; cl.boxH = hlodBoxes(H.HB, lodMat('hard')); cl.farTris += H.tris; }
    if (HLOD.bake) hlodBake(cl);
    return cl;
  }
  // bags -> one world-space mesh (vertex colour = the bag's material colour x its map's mean), and each house's box
  // (HB); `hc`: each vertex carries its house's centre and radius (aHC, the banded far town's vertex cull)
  function hlodMerge(bags, mat, hc) {
    if (!bags.length) return null;
    const col = new THREE.Color(), paintC = new THREE.Color(), nm = new THREE.Matrix3();
    {
      let nV = 0, nI = 0; for (const { m } of bags) { nV += m.geometry.attributes.position.count; nI += m.geometry.index.count; }
      const P = new Float32Array(nV * 3), N = new Float32Array(nV * 3), C = new Float32Array(nV * 3), I = new Uint32Array(nI), HC = hc ? new Float32Array(nV * 4) : null;
      // THE COARSEST RUNG (G594, screens 150029/150123: the far town was flickering coloured pixels): past HLOD.far2 a
      // house is a BOX - its kept bags' extent in its own frame, the walls the mean colour of what faces sideways,
      // the top the mean of what faces up, the top at 85 % of the ridge. Ten triangles a house, no sub-pixel trims.
      const HB = new Map();   // house -> { b: Box3 (house frame), wall: [r, g, b, n], roof: [r, g, b, n] }
      const inv = new THREE.Matrix4(), rel = new THREE.Matrix4(), bx = new THREE.Box3();
      let vo = 0, io = 0;
      for (const { m, M, h, box, D } of bags) {
        const g = m.geometry, A = g.attributes.position.array, AN = g.attributes.normal ? g.attributes.normal.array : null, n = g.attributes.position.count;
        const vc = m.material.vertexColors && g.attributes.color ? g.attributes.color : null;
        col.copy(m.material.color || col.setRGB(1, 1, 1)); const mm = meanOf(m.material.map);
        const pt = m.material.userData && m.material.userData.paint;   // the house's paint is a uniform (uPaintCol) over a pale map
        if (pt && pt.uPaintMode && pt.uPaintMode.value > 0 && pt.uPaintCol) { col.multiply(paintC.set(pt.uPaintCol.value)); if (mm) col.multiplyScalar(Math.min(1.2, (mm.r + mm.g + mm.b) / 1.5)); }
        else if (mm) col.multiply(mm);
        // the house shader weathers and dirties what the map says (uDirtOwn, the AO): measured against the drawn town
        // from 150 m (side by side, the far town on and off), the far colour is the mean pulled a third toward the house's
        // own dirt and taken to a fifth: the plain merged surface has no AO, no dirt line, no weathering to darken it
        const dt = m.material.userData && m.material.userData.dirt;
        if (dt && dt.uDirtOwn) col.lerp(paintC.set(dt.uDirtOwn.value), HLOD.dirt);
        col.multiplyScalar(HLOD.gain);
        const e = M.elements; nm.getNormalMatrix(M); const q = nm.elements;
        let up = 0, side = 0;
        for (let i = 0; i < n; i++) {
          const x = A[i * 3], y = A[i * 3 + 1], z = A[i * 3 + 2], o3 = (vo + i) * 3;
          P[o3] = e[0] * x + e[4] * y + e[8] * z + e[12]; P[o3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; P[o3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
          if (AN) { const a = AN[i * 3], b = AN[i * 3 + 1], c = AN[i * 3 + 2]; const X = q[0] * a + q[3] * b + q[6] * c, Y = q[1] * a + q[4] * b + q[7] * c, Z = q[2] * a + q[5] * b + q[8] * c, l = Math.hypot(X, Y, Z) || 1; N[o3] = X / l; N[o3 + 1] = Y / l; N[o3 + 2] = Z / l; if (Y / l > 0.45) up++; else side++; } else N[o3 + 1] = 1;
          const f = vc ? [vc.getX(i), vc.getY(i), vc.getZ(i)] : null;
          C[o3] = col.r * (f ? f[0] : 1); C[o3 + 1] = col.g * (f ? f[1] : 1); C[o3 + 2] = col.b * (f ? f[2] : 1);
          if (HC) { const o4 = (vo + i) * 4; HC[o4] = D.c.x; HC[o4 + 1] = D.c.y; HC[o4 + 2] = D.c.z; HC[o4 + 3] = D.R; }
        }
        const ix = g.index.array; for (let i = 0; i < g.index.count; i++) I[io + i] = ix[i] + vo;
        vo += n; io += g.index.count;
        // the box: the bag's extent in its house's frame, its colour to the walls or the roof by where its vertices face
        if (!h || !box) continue;
        let hb = HB.get(h); if (!hb) HB.set(h, hb = { b: new THREE.Box3(), wall: [0, 0, 0, 0], roof: [0, 0, 0, 0] });
        if (!g.boundingBox) g.computeBoundingBox();
        inv.copy(h.matrixWorld).invert(); rel.multiplyMatrices(inv, M);
        hb.b.union(bx.copy(g.boundingBox).applyMatrix4(rel));
        hb.wall[0] += col.r * side; hb.wall[1] += col.g * side; hb.wall[2] += col.b * side; hb.wall[3] += side;
        hb.roof[0] += col.r * up; hb.roof[1] += col.g * up; hb.roof[2] += col.b * up; hb.roof[3] += up;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
      if (HC) geo.setAttribute('aHC', new THREE.BufferAttribute(HC, 4));
      geo.setIndex(new THREE.BufferAttribute(I, 1)); geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = false; mesh.receiveShadow = true; mesh.visible = false; mesh.matrixAutoUpdate = false; mesh.userData.batch = true; mesh.name = 'houses:far';
      HLOD.group.add(mesh);
      return { mesh, HB, tris: nI / 3 };
    }
  }
  // five faces a house (no floor), world space, flat normals, the walls' and the roof's colours
  const BOX_F = [[[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1], [1, 0, 0]], [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0], [-1, 0, 0]],
                 [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1], [0, 0, 1]], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0], [0, 0, -1]],
                 [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]]];
  function hlodBoxes(HB, mat) {
    const nH = HB.size; if (!nH) return null;
    const P = new Float32Array(nH * 20 * 3), N = new Float32Array(nH * 20 * 3), C = new Float32Array(nH * 20 * 3), I = new Uint32Array(nH * 30);
    const v = new THREE.Vector3(), nrm = new THREE.Vector3(), nmx = new THREE.Matrix3();
    let vi = 0, ii = 0;
    for (const [h, hb] of HB) {
      if (hb.b.isEmpty()) continue;
      const lo = hb.b.min, hi = hb.b.max, top = lo.y + 0.85 * (hi.y - lo.y);
      const wc = hb.wall[3] ? hb.wall.slice(0, 3).map(x => x / hb.wall[3]) : null, rc = hb.roof[3] ? hb.roof.slice(0, 3).map(x => x / hb.roof[3]) : null;
      const Wc = wc || rc || [0.1, 0.1, 0.1], Rc = rc || Wc;
      nmx.getNormalMatrix(h.matrixWorld);
      for (let f = 0; f < 5; f++) {
        const face = BOX_F[f], c = f === 4 ? Rc : Wc, b0 = vi;
        nrm.fromArray(face[4]).applyMatrix3(nmx).normalize();
        for (let k = 0; k < 4; k++) {
          const s = face[k];
          v.set(s[0] ? hi.x : lo.x, s[1] ? top : lo.y, s[2] ? hi.z : lo.z).applyMatrix4(h.matrixWorld);
          P[vi * 3] = v.x; P[vi * 3 + 1] = v.y; P[vi * 3 + 2] = v.z; N[vi * 3] = nrm.x; N[vi * 3 + 1] = nrm.y; N[vi * 3 + 2] = nrm.z;
          C[vi * 3] = c[0]; C[vi * 3 + 1] = c[1]; C[vi * 3 + 2] = c[2]; vi++;
        }
        I[ii++] = b0; I[ii++] = b0 + 1; I[ii++] = b0 + 2; I[ii++] = b0; I[ii++] = b0 + 2; I[ii++] = b0 + 3;
      }
    }
    if (!vi) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P.slice(0, vi * 3), 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N.slice(0, vi * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(C.slice(0, vi * 3), 3));
    geo.setIndex(new THREE.BufferAttribute(I.slice(0, ii), 1)); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = false; mesh.receiveShadow = true; mesh.visible = false; mesh.matrixAutoUpdate = false; mesh.userData.batch = true; mesh.name = 'houses:boxes';
    HLOD.group.add(mesh);
    return mesh;
  }
  function hlodBake(cl) {
    const canon = HLOD.canon || (HLOD.canon = new Map()); let nd = 0, nm = 0, td = 0, tm = 0;
    // THE TOWN ON TEXTURE ARRAYS (G574, house_tarr.js): a bag whose finish can ride the stack goes into one of a
    // cell's few town meshes (plain / glass x side x whether it casts) whatever its material; the rest merge per
    // distinct material as G566 does. Until the stack holds every layer the bake asked for, the bags it could not
    // place go G566's way too, and the stack's ready signal rebakes that cell.
    const TA = HLOD.tarr ? tarr() : null;
    const litBase = u => (LAMPS.glass.has(u) ? LAMPS.glass.get(u) : u.value);
    const buckets = new Map(), tb = new Map();
    for (const g of cl.houses) {
      const cast = new Set(g.userData.casters || []), bd = banded(g) ? '|b' : '';   // G801: a banded house's bags merge apart
      for (const m of g.children) {
        if (!m.isMesh || !m.geometry || !m.geometry.index || Array.isArray(m.material)) continue;
        const mt = m.material, ud = mt.userData || {};
        const c = TA && TA.classify(m);
        if (c) {
          const k = c.key + '|' + m.renderOrder + '|' + m.receiveShadow + '|' + cast.has(m) + bd;
          let b = tb.get(k); if (!b) tb.set(k, b = { c, cast: cast.has(m), band: !!bd, list: [] }); b.list.push(m);
          continue;
        }
        if (mt.transparent || ud.lampKey || ud.lampCol || ud.emis0 || ud.glassShaded || ud.smokeShaded || ud.parked || ud.aeroskin) continue;
        const ga = m.geometry.attributes, an = Object.keys(ga).sort();
        if (an.some(k => ga[k].isInterleavedBufferAttribute)) continue;
        const sg = matSig(mt); let cm = canon.get(sg); if (!cm) canon.set(sg, cm = mt);
        const k = sg + '|' + m.renderOrder + m.castShadow + m.receiveShadow + '|' + an.map(k => k + ga[k].itemSize + ga[k].array.constructor.name + ga[k].normalized).join(',') + bd;
        let b = buckets.get(k); if (!b) buckets.set(k, b = { mat: cm, band: !!bd, list: [] }); b.list.push(m);
      }
    }
    // the near rung: the banded houses' merges (ng, leaving at near) and the rest's (ngH, the hard switch)
    const ng = new THREE.Group(); ng.name = 'houses:near'; ng.userData.batch = true;
    const ngH = new THREE.Group(); ngH.name = 'houses:near'; ngH.userData.batch = true;
    for (const b of tb.values()) {
      const r = TA.merge(b.list, b.c.kind, litBase), m0 = b.list[0], mat = r.geo && TA.material(b.c.kind, b.c.side, m0.material.dithering, !b.band);
      const usedS = new Set(r.used), left = b.list.filter(m => !usedS.has(m));
      if (left.length) cl.tarrShort = true;
      if (r.geo && mat) {
        const mesh = new THREE.Mesh(r.geo, mat);
        mesh.castShadow = b.cast; mesh.receiveShadow = m0.receiveShadow; mesh.renderOrder = m0.renderOrder; mesh.matrixAutoUpdate = false; mesh.userData.batch = true; mesh.name = 'houses:town';
        if (b.cast) cl.casters.push(mesh);
        (b.band ? ng : ngH).add(mesh); td++;
        for (const m of r.used) { m.userData.merged = true; m.visible = false; tm++; }
      } else if (r.geo) r.geo.dispose();
      // not (yet) on the stack: G566's way, the glass as the house's own
      for (const m of (r.geo && mat) ? left : b.list) {
        const mt = m.material; if (mt.userData.glassShaded) continue;
        const ga = m.geometry.attributes, an = Object.keys(ga).sort();
        const sg = matSig(mt); let cm = canon.get(sg); if (!cm) canon.set(sg, cm = mt);
        const k = sg + '|' + m.renderOrder + m.castShadow + m.receiveShadow + '|' + an.map(k => k + ga[k].itemSize + ga[k].array.constructor.name + ga[k].normalized).join(',') + (b.band ? '|b' : '');
        let bb = buckets.get(k); if (!bb) buckets.set(k, bb = { mat: cm, band: b.band, list: [] }); bb.list.push(m);
      }
    }
    for (const b of buckets.values()) {
      const m0 = b.list[0], mesh = new THREE.Mesh(mergeInto(b.list), b.band ? bandOf(b.mat) : b.mat);
      mesh.castShadow = m0.castShadow; mesh.receiveShadow = m0.receiveShadow; mesh.renderOrder = m0.renderOrder; mesh.matrixAutoUpdate = false; mesh.userData.batch = true;
      (b.band ? ng : ngH).add(mesh); nd++;
      for (const m of b.list) { m.userData.merged = true; m.visible = false; nm++; }
    }
    if (TA && tb.size && !TA.end()) cl.tarrShort = true;
    cl.castOn = true;
    if (ng.children.length) { cl.near = ng; HLOD.group.add(ng); HLOD.warm.push(ng); }     // its programs linked off the frame (hlodWarm)
    if (ngH.children.length) { cl.nearH = ngH; HLOD.group.add(ngH); HLOD.warm.push(ngH); }
    cl.bake = { nd, nm, td, tm };
  }
  // THE BAKE'S PROGRAMS OFF THE FRAME (G593): a town material's first variant, or a canonical finish no house had
  // drawn with, linked synchronously on the first frame that drew the cell. compileAsync (KHR_parallel_shader_compile)
  // links them in the background; three reuses the program on the draw.
  function hlodWarm() {
    const R = o.renderer && o.renderer(), cam = o.camera && o.camera();
    if (!HLOD.warm.length || !R || !cam || typeof R.compileAsync !== 'function') { HLOD.warm.length = 0; return; }
    for (const ng of HLOD.warm.splice(0)) { try { const p = R.compileAsync(ng, cam, scene); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  }
  function hlodStats() {
    let nd = 0, nm = 0, td = 0, tm = 0;
    for (const cl of HLOD.cellMap.values()) if (cl.bake) { nd += cl.bake.nd; nm += cl.bake.nm; td += cl.bake.td; tm += cl.bake.tm; }
    stats.bakeDraws = nd; stats.bakeMerged = nm; stats.bakeMats = HLOD.canon ? HLOD.canon.size : 0; stats.hlodCells = HLOD.cellMap.size;
    let ft = 0, l1 = 0; for (const cl of HLOD.cellMap.values()) { ft += cl.farTris || 0; for (const g of cl.houses) if (HLOD.lod1 && g.userData.lod1) l1++; }
    stats.farTris = ft; stats.lod1Houses = l1;   // G800: the far town's triangles, the houses it took at lod 1
    if (TARR) Object.assign(stats, { tarrDraws: td, tarrMerged: tm, tarrSlots: TARR.stats.slots, tarrLayers: TARR.stats.layers + '+' + TARR.stats.nrLayers, tarrMB: TARR.stats.mb });
  }
  let hlodFrame = 0, hlodHouses = -1;
  function hlodTick(e) {
    if (!HLOD.on || !o.game || (o.editing && o.editing())) {
      if (HLOD.cellMap.size) { hlodDropAll(); HLOD.sig = ''; hlodStats(); }   // whole houses; rebaked on the way back
      return;
    }
    if (!HLOD.group || HLOD.group.parent !== G.houses) { HLOD.group = new THREE.Group(); HLOD.group.name = 'houses:hlod'; HLOD.group.userData.batch = true; G.houses.add(HLOD.group); }
    const sig = HLOD.bake + '|' + HLOD.tarr + '|' + HLOD.lod1;   // a dial flipped (F8 / WORLD.premises.hlod) rebakes every cell
    if (sig !== HLOD.sig) { HLOD.sig = sig; hlodDropAll(); hlodHouses = -1; }
    // the band's edges follow the dials (G801)
    const hw = HLOD.fadeW > 0 ? HLOD.fadeW / 2 : 0;
    LOD_U.uLodA.value = HLOD.near; LOD_U.uLodB.value = HLOD.far2; LOD_U.uLodW.value = HLOD.fadeW; LOD_U.uLodOn.value = hw > 0 ? 1 : 0;
    // the cells whose houses changed - re-read when a house came or went, and every 30 frames: ONE live cell a frame
    if (HOUSES.size !== hlodHouses || ++hlodFrame % 30 === 0) {
      hlodHouses = HOUSES.size;
      const byCell = hlodScan();
      HLOD.todo = [];
      for (const [k, list] of byCell) { const cl = HLOD.cellMap.get(k); if (!cl || cl.sig !== list.map(g => g.id).join(',')) HLOD.todo.push([k, list]); }
      for (const [k, cl] of HLOD.cellMap) if (!byCell.has(k)) { hlodCellDrop(cl); HLOD.cellMap.delete(k); }
      HLOD.cells = [...HLOD.cellMap.values()];
    }
    for (let i = 0; i < HLOD.todo.length; i++) {
      const [k, list] = HLOD.todo[i];
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const g of list) { const c = detailOf(g).c; x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); }
      if (!boxLive(x0 - 60, z0 - 60, x1 + 60, z1 + 60)) continue;   // still streaming there: its houses stay whole
      HLOD.todo.splice(i, 1);
      const old = HLOD.cellMap.get(k); if (old) hlodCellDrop(old);
      HLOD.cellMap.set(k, hlodCell(k, list)); HLOD.cells = [...HLOD.cellMap.values()];
      hlodStats(); hlodWarm();
      break;
    }
    for (const cl of HLOD.cells) {
      if (!cl.mesh && !cl.meshH) continue;
      const dx = Math.max(cl.x0 - e.x, 0, e.x - cl.x1), dz = Math.max(cl.z0 - e.z, 0, e.z - cl.z1), d = Math.hypot(dx, dz, e.y - cl.y);   // 3D (G563): from 300 m up the houses below are far
      // the houses' own bags (glass, lamps, smoke: what no bake took) and their per-house cuts switch per cell with
      // hysteresis, at the band's far side when there is a band (G801)
      const far = d > (HLOD.near + hw) * (cl.far ? 0.9 : 1.1);
      if (far !== cl.far) hlodSet(cl, far);
      // the coarsest rung (G594): the boxes past far2, a hard switch for every house (G801)
      const far2 = far && !!(cl.box || cl.boxH) && d > HLOD.far2 * (cl.far2 ? 0.9 : 1.1);
      if (far2 !== cl.far2) cl.far2 = far2;
      // the items' rungs (no lod 1): the hard switch of before
      if (cl.nearH && cl.nearH.visible !== !far) cl.nearH.visible = !far;
      if (cl.meshH && cl.meshH.visible !== (far && !(far2 && cl.boxH))) cl.meshH.visible = far && !(far2 && cl.boxH);
      if (cl.boxH && cl.boxH.visible !== far2) cl.boxH.visible = far2;
      // THE RUNGS DRAWN (G801): with a band, each wherever a fragment of the cell can want it (the shader dithers the
      // rest; df the cell's farthest reach, its houses' heights allowed for); without, the hard switch of before
      let vNear = !far, vMid = far && !(far2 && cl.box), vBox = far2;
      if (hw > 0) {
        const df = Math.hypot(Math.max(Math.abs(e.x - cl.x0), Math.abs(e.x - cl.x1)), Math.max(Math.abs(e.z - cl.z0), Math.abs(e.z - cl.z1)), Math.abs(e.y - cl.y) + 40);
        vNear = d < HLOD.near + hw; vMid = df > HLOD.near - hw && !(far2 && cl.box);   // (the boxes: the hard switch at far2)
      }
      if (cl.near && cl.near.visible !== vNear) cl.near.visible = vNear;
      if (cl.mesh && cl.mesh.visible !== vMid) cl.mesh.visible = vMid;
      if (cl.box && cl.box.visible !== vBox) cl.box.visible = vBox;
      // the town meshes that cast (G574): a house's own casters go at HOUSE_CAST_FAR (detailTick), the cell's at its box's
      if (cl.casters && cl.casters.length) { const on = d < HOUSE_CAST_FAR * (cl.castOn ? 1.1 : 0.9); if (on !== cl.castOn) { cl.castOn = on; for (const m of cl.casters) m.castShadow = on; } }
    }
  }
  function hlodSet(cl, far) {
    cl.far = far; cl.far2 = false;   // (the rungs' own visibility: hlodTick, G801)
    for (const g of cl.houses) {
      const D = detailOf(g); g.userData.far = far;
      // every bag goes, glass and lit too (G560): from the airfield, 9 km off, the town's 641 houses still drew
      // ~1 500 window bags a few hundredths of a pixel wide
      for (const m of g.children) if (m.isMesh) m.visible = !far && !m.userData.merged;
      if (!far) { D.on = true; D.on2 = true; }   // the per-house cuts re-decide from full
    }
  }
  // THE MATRIX WALK (G561): three composes and visits every object every frame, frozen or not - ~75 000 premises
  // objects, 21 % of the frame over the airfield. Once the boot is done (the queue empty), a thrifty house whose
  // props have all landed (no propPending) is SETTLED and skipped by the walk; freezeStatic's periodic walk
  // re-poses it with the prototype and walks it again if anything came in. G558's first try skipped during the
  // boot and the renderer's heap ran to 18 GB: not during the boot.
  const SKIP_UMW = function () {};
  let settleAt = 0;
  function settleTick() {
    if (!o.game || (o.editing && o.editing()) || ++settleAt % 30) return;
    for (const g of G.houses.children) {
      if (!g.userData.thrift || !g.userData.frozen || g.userData.skipWalk || g.userData.batch) continue;
      // per cell (G592): a house settles once nothing is queued round it - it waited for the WHOLE queue
      if (queue.length) { const D = detailOf(g); if (!boxLive(D.c.x - 60, D.c.z - 60, D.c.x + 60, D.c.z + 60)) continue; }
      let pending = false, fresh = false;
      g.traverse(x => { if (x.userData && x.userData.propPending) pending = true; if (x.matrixAutoUpdate) fresh = true; });
      if (pending || fresh) continue;
      g.updateMatrixWorld = SKIP_UMW; g.userData.skipWalk = true;
    }
  }
  function detailTick() {
    const e = o.eye && o.eye(); if (!e || !o.focalPx) return;
    const K = o.focalPx();
    hlodTick(e);
    if (HLOD.skip !== false) settleTick();
    for (const g of G.houses.children) {
      if (!g.userData.frozen || g.userData.batch) continue;   // posed (its matrixWorld is final) before its centre is read
      const D = detailOf(g);
      if (g.userData.thrift) {
        const d = e.distanceTo(D.c), on = d < HOUSE_CAST_FAR * (g.userData.castOn ? 1.1 : 0.9);
        if (on !== g.userData.castOn) { g.userData.castOn = on; for (const m of g.userData.casters) m.castShadow = on; }
        const pOn = !DETAIL.props || d < HOUSE_PROP_GONE * (g.userData.propsOn ? 1.35 : 1.15);
        if (pOn !== g.userData.propsOn) { g.userData.propsOn = pOn; for (const x of g.userData.props) x.visible = pOn; if (typeof propInstTouch === 'function') propInstTouch(); }
      }
      if (g.userData.far || (!D.list.length && !D.list2.length)) continue;
      const px = 2 * D.R * K / Math.max(1, e.distanceTo(D.c)), on = px >= DETAIL.px * (D.on ? 1 - DETAIL.hyst : 1 + DETAIL.hyst);
      if (on !== D.on) { D.on = on; for (const m of D.list) if (!m.userData.merged) m.visible = on; }
      const on2 = !(DETAIL.px2 > 0) || px >= DETAIL.px2 * (D.on2 ? 1 - DETAIL.hyst : 1 + DETAIL.hyst);
      if (on2 !== D.on2) { D.on2 = on2; for (const m of D.list2) if (!m.userData.merged) m.visible = on2; }
    }
  }
  function tick(dt) { if (RISE.list.length) riseTick(); if (++freezeTick % 60 === 0) freezeStatic(true); detailTick(); if (LIFE) LIFE.tick(); hitPendingStep(); for (const [, t] of TRAMS) t.run.tick(dt).apply(); for (const [, t] of TRAFFIC) moveTraffic(t, dt); if (ANIM) stats.animalsShown = ANIM.tick(dt); return TRAMS.size + TRAFFIC.size + (ANIM ? ANIM.stats.animals : 0); }

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
      if (f.entry.stand && f.entry.taxiOut) { put([f.entry.stand.x, f.entry.stand.z], 'stand'); f.entry.taxiOut.forEach((q, i) => put(q, 'tx' + i, true));
        (f.entry.taxiOut1 || []).forEach((q, i) => put(q, 'ty' + i, true)); }   // G772: the way out toward end1
      // THE CLUB HANGAR (G434): its disc moves the garage's shell; the inspector turns it
      if (f.entry.hangar) put([f.entry.hangar.x, f.entry.hangar.z], 'hangar');
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

  // ---- THE OBSTACLES (G433, the user: "hitbox for static car props ... audit hitboxes for everything
  // ... no more than 1 meter discrepancy with the visual mesh"): everything this renderer stands in
  // the GAME is registered with the world's registry (29_obstacles.js) as a column grid rasterised
  // from the very meshes drawn - a house with its deck, its people and its yard props at 1 m cells,
  // a prop, a car, a parked aeroplane at 0.5 m - and taken down with it. The bench registers nothing
  // (its world flies nothing). The traffic's cars move theirs every tick (TRAFFIC_HITBOX; the cost is
  // a re-bin when a car crosses a 64 m line - nothing the frame sees).
  const TRAFFIC_HITBOX = true;
  const OBS = () => (o.game && world && world.obstacles && typeof OBSTACLES !== 'undefined') ? world.obstacles : null;
  const HIT_SKIP = /^(hitbox:|smoke|aoskirt)/;
  const OBST_IDS = new Set();
  function shapeOf(grp, cell) {
    grp.updateMatrixWorld(true);
    const e = grp.matrixWorld.elements, yaw = Math.atan2(e[8], e[0]), px = e[12], py = e[13], pz = e[14];
    const inv = new THREE.Matrix4().makeRotationY(yaw).setPosition(px, py, pz).invert();
    const pos = [], idx = [], M = new THREE.Matrix4(), v = new THREE.Vector3();
    const walk = obj => {
      if (obj.isLOD) { const l0 = obj.levels.length ? obj.levels[0].object : null; if (l0) walk(l0); return; }   // the full level only
      // an INSTANCED prop (props.js proxy, G934) has no meshes: its full level's geometry at the proxy's matrix, as the
      // LOD's level 0 would have been
      const full = typeof propInstFull === 'function' ? propInstFull(obj) : undefined;
      if (full) { for (let i = 0; i < full.dgeos.length; i++) addMesh(full.dgeos[i], full.dmats[i], obj.matrixWorld); return; }
      if (obj.isMesh && obj.geometry && obj.geometry.attributes.position && !HIT_SKIP.test(obj.name || '')) addMesh(obj.geometry, obj.material, obj.matrixWorld);
      for (const c of obj.children) walk(c);
    };
    function addMesh(geometry, mt, matrixWorld) {
      {
        const ghost = mt && mt.transparent && (mt.opacity < 0.5 || mt.depthWrite === false);   // smoke, skirts, glows
        if (!ghost) {
          M.multiplyMatrices(inv, matrixWorld);
          const P = geometry.attributes.position, base = pos.length / 3;
          let y0 = Infinity, y1 = -Infinity;
          // the arrays read directly (G591: three's per-vertex accessors were 1.3 s of the roll-out's 150 items), the
          // same arithmetic as applyMatrix4 (its w divide included), so the raster is the same bits
          if (!P.isInterleavedBufferAttribute && !P.normalized && P.itemSize === 3) {
            const A = P.array, m = M.elements, n = P.count;
            for (let i = 0; i < n; i++) {
              const x = A[i * 3], y = A[i * 3 + 1], z = A[i * 3 + 2], w = 1 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
              const X = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w, Y = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w, Z = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
              pos.push(X, Y, Z); if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
            }
          } else for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(M); pos.push(v.x, v.y, v.z); if (v.y < y0) y0 = v.y; if (v.y > y1) y1 = v.y; }
          if (y1 - y0 < 0.15) pos.length = base * 3;                                              // a flat thing (a lot patch, a slab) is the ground's
          else { const I = geometry.index; if (I && !I.isInterleavedBufferAttribute) { const IA = I.array; for (let i = 0; i < I.count; i++) idx.push(base + IA[i]); } else if (I) for (let i = 0; i < I.count; i++) idx.push(base + I.getX(i)); else for (let i = 0; i < P.count; i++) idx.push(base + i); }
        }
      }
    }
    walk(grp);
    if (!idx.length) return null;
    const shape = OBSTACLES.rasterise(pos, idx, cell);
    return shape ? { x: px, z: pz, yaw, y0: py, shape } : null;
  }
  // a prop's bytes may still be on the wire (props.js propPending) and a parked aeroplane's holder
  // fills when its capture lands: a group not ready is queued and registered by the first tick that
  // finds its full level standing; `then(id)` tells the caller (the traffic keeps the id to move it)
  const PENDING_HIT = [];
  function hitReady(grp) {
    let meshes = 0, pending = false;
    const walk = obj => { if (obj.userData && obj.userData.propPending) pending = true;
      if (obj.userData && obj.userData.propInst && typeof propInstFull === 'function') { const f = propInstFull(obj); if (f) meshes += f.dgeos.length; else pending = true; return; }   // G934: a proxy is ready when its bytes are
      if (obj.isLOD) { const l0 = obj.levels.length ? obj.levels[0].object : null; if (l0) walk(l0); return; } if (obj.isMesh) meshes++; for (const c of obj.children) walk(c); };
    walk(grp);
    return !pending && meshes > 0;
  }
  // A PARKED AEROPLANE'S HITBOX FROM ITS SPEC (G1060, the user: "the hitbox of the wing of the cub is a few
  // centimeters too long compared to the wing mesh ... you have literal parameters like wingspan, chord and incidence
  // ... and you also have the original cage, for the fuselage at least"): the 0.5 m raster let a wingtip's cell
  // overhang the tip by up to a cell (15 cm on the Cub, 50 on the 172). OBSTACLES.aircraftShape cuts convex pieces
  // from the physics frame of the build's own spec (the wing's loft rows, the tail's stations, the cage, the struts,
  // the wheels, the engines) and carries them into this object's frame the way the capture was carried; ~30 ms, once
  // per key (every placement of a key shares it). Anything it cannot stand (no capture record, no mains: a float
  // plane) keeps the raster below.
  const AIR_SHAPES = new Map();
  function aircraftOf(grp) {
    const PK = window.PARKED, key = grp.userData && grp.userData.parkedKey;
    const rec = PK && PK.records && key ? PK.records[key] : null;
    const spec = rec && (rec.spec || rec.shapeSpec), vis = rec && (rec.vis || rec.shapeVis);   // G1063: a cooked record carries its shape's inputs
    if (!spec || !vis || !OBSTACLES.aircraftShape) return null;
    let lod = null; grp.traverse(o => { if (!lod && o.userData && o.userData.stance) lod = o; });
    if (!lod) return null;
    let shape = AIR_SHAPES.get(key);
    if (shape === undefined) { shape = OBSTACLES.aircraftShape(spec, OBSTACLES.parkedDrawn(vis, lod.userData.stance)) || null; AIR_SHAPES.set(key, shape); }
    if (!shape) return null;
    grp.updateMatrixWorld(true);
    const e = grp.matrixWorld.elements;
    return { x: e[12], z: e[14], yaw: Math.atan2(e[8], e[0]), y0: e[13], shape };
  }
  function hitAdd(grp, tag, cell, then) {
    const R = OBS(); if (!R || !grp) return 0;
    if (!hitReady(grp)) { PENDING_HIT.push({ grp, tag, cell: cell || 0.5, then }); return 0; }
    let air = null;
    if (tag === 'aircraft') try { air = aircraftOf(grp); } catch (e) { console.warn('obstacle: the spec hitbox of', grp.userData && grp.userData.parkedKey, e && e.message); }
    try { const s = air || shapeOf(grp, cell || 0.5); if (!s) return 0; s.tag = tag; const id = R.add(s); (grp.userData.obst = grp.userData.obst || []).push(id); OBST_IDS.add(id); if (then) then(id); return id; }
    catch (e) { console.warn('obstacle', tag, e && e.message); return 0; }
  }
  function hitPendingStep() {
    if (!PENDING_HIT.length) return;
    for (let i = PENDING_HIT.length - 1; i >= 0; i--) {
      const q = PENDING_HIT[i];
      if (!q.grp.parent) { PENDING_HIT.splice(i, 1); continue; }     // torn down before it landed
      if (!hitReady(q.grp)) continue;
      PENDING_HIT.splice(i, 1);
      hitAdd(q.grp, q.tag, q.cell, q.then);
      // G680: ONE A TICK. A parked aeroplane's full level at 0.5 m is ~0.8 s of rasterising, and the three Jolene
      // captures landing together (G682's batch) registered in one tick: a 2.5 s task. The next waits for the next tick.
      return;
    }
  }
  function hitDrop(grp) {
    const R = OBS(); if (!R || !grp) return;
    grp.traverse(g => { if (g.userData && g.userData.obst) { for (const id of g.userData.obst) { R.remove(id); OBST_IDS.delete(id); } g.userData.obst = null; } });
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
    // a sports ground's grass (G393): the lot patch's record in the item's frame, over its flat turf
    if (st.turf && typeof LOT_GROUND !== 'undefined' && LOT_GROUND) LOT_GROUND.mesh(THREE, grp, st.turf, null);
    const PR = propReg(), pp = (typeof propPlace === 'function') ? propPlace : null;
    if (PR && pp) {
      if (st.pier) for (const m of st.pier.modules.concat(st.pier.boats)) if (PR.props[m.key]) grp.add(pp(THREE, m.key, m.x, m.z, m.ry, m.y));
      // the people and the yard's dressing may be INSTANCED (props.js PROP_INST_REPEAT, AS5b G934: the last argument)
      for (const q of st.people || []) if (PR.props[q.key]) grp.add(pp(THREE, q.key, q.x, q.z, q.ry, q.y, true));
      for (const q of st.yard || []) { if (!PR.props[q.key]) continue; const ob = pp(THREE, q.key, q.x, q.z, q.ry, q.y, true); if (q.on === 'ground' && g) tiltToGround(ob, g, q.x, q.z, q.ry); grp.add(ob); }
      if (st.lit) for (const L of st.lit.lights) if (L.prop && PR.props[L.prop]) grp.add(pp(THREE, L.prop, L.mx, L.mz, L.ry, L.my));
    }
    parent.add(grp);
    // G581: the dirt line is drawn in the house's frame (uDirtTop) against a world height - lift it by where it stands
    if (F && F.SHADE_U && F.SHADE_U.uDirtY0) { grp.updateWorldMatrix(true, false); F.SHADE_U.uDirtY0.value = grp.matrixWorld.elements[13]; }
    // G449: the lamps this thing published, for the pool (world positions resolved when first assigned);
    // its finish's lit panes for the day's hand (the base is the generator's lightK, set at build)
    if (st.lit && st.lit.lights) for (const L of st.lit.lights) if (isFinite(L.x) && isFinite(L.y) && isFinite(L.z)) { LAMPS.pub.push({ grp, p: [L.x, L.y, L.z], col: L.col || [1, 0.85, 0.6], k: L.k == null ? 1 : L.k, range: L.range || 10, kind: L.kind }); if (L.prop) LAMPS.glowKeys.add(L.prop); }
    if (F && F.GLASS_U && F.GLASS_U.uLitK && !LAMPS.glass.has(F.GLASS_U.uLitK)) { LAMPS.glass.set(F.GLASS_U.uLitK, F.GLASS_U.uLitK.value); F.GLASS_U.uLitK.value = F.GLASS_U.uLitK.value * LAMPS.on; }
    if (F && F.SMOKE_U) { if (!F.SMOKE_U.uSmokeLit) F.SMOKE_U.uSmokeLit = { value: 1 }; LAMPS.smoke.add(F.SMOKE_U.uSmokeLit); }
    return grp;
  }
  // G830 (C2a): A HOUSE IS ITS GENERATION + ITS PLACEMENT. The generation - placeHouse, the finish, HOUSE_GEN.build
  // (lod 0 and lod 1), the plot's dressing plan and bags - is src/viewer/premises_build.js genHouse, run inline here
  // (R absent) or in the house worker (R its result, unpacked: RemoteBags, the finish's build-written uniforms in
  // R.fin). What follows is the page's: the materials, the meshes, the props, the obstacle.
  function buildHouse(plot, R) {
    const HG = window.HOUSE_GEN;
    if (!window.VILLAGE_GEN || !HG) return null;
    R = R || BLD.genHouse(plot);
    if (!R) return null;
    const house = R.house, built = R.built;
    let F = R.F;
    if (!F) { F = HG.makeFinish(); HG.applyFinish(house.P, F); PB.uniApply(F, R.fin); }
    const grp = placeBuilt(G.houses, house, built, F, HG);
    // G800: its lod 1 (generated with it, under the loading screen), for the far town; the bench keeps none, nor does
    // the in-flight stream (G591's items past the roll-out's reach): no merge added to a frame in flight - such a
    // house keeps G559's lod-0 far town and the hard switch
    if (HLOD.lod1 && o.game && !IN_STREAM && R.lod1) { try { grp.userData.lod1 = lod1Bags(HG, house.P, F, R.lod1); } catch (e) { console.warn('premises lod 1', plot.id, e && e.message); } }
    hitAdd(grp, 'house', 1.0);
    const D = placeDress(plot, built, R.dress, R.Tv);
    return { grp, tris: built.stats.tris + D.tris, house, built, extra: D.groups, lights: litOf(built) + D.lights };
  }
  // THE DRESSING (v5): the village's own plan functions on the BUILT house - the garden path, the
  // fences (a neighbour's fence is this fence: one edge set for the whole premises), the outbuilding,
  // the car and the boat, and the lot's ground patch reading them all; drawn in the premises frame
  // under G.lots, the outbuilding as a house of its own
  // G830: THE TWO TALLIES (SPREAD, FENCED) ARE THE BUILDER'S (src/viewer/premises_build.js makeBuilder - its header says
  // why they travel with the work); the page reads them here, and syncHouses takes a torn-down plot's edges back
  const PB = window.PREMISES_BUILD;
  const BLD = PB.makeBuilder({ G: window, PG, get O() { return O; }, get rec() { return rec; },
    waterY: () => (world.waterH ? world.waterH(0, 0) : -1e9), size: () => Math.max(W, H), game: !!o.game,
    get lod1() { return HLOD.lod1; }, get outLod() { return HLOD.outLod; },
    props: { has: k => { const PR = propReg(); return !!(PR && PR.props[k]); } },
    get pp() { return typeof propPlace === 'function'; }, get lotGround() { return !!window.LOT_GROUND; } });
  const FENCED = BLD.S.fenced;
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
  // the fence segments of one plot (or park): generated (premises_build.js genFence: the bags, baked; the scanned
  // stretches as placements) and stood under G.lots; the posts' feet out
  function fenceGroup(segs, T, seed, posts) { return placeFence(BLD.genFence(segs, T, seed, posts)); }
  function placeFence(fr) {
    if (!fr) return null;
    const pp = typeof propPlace === 'function' ? propPlace : null;
    const F = fenceFinish();
    const grp = new THREE.Group(); grp.name = 'fence';
    for (const q of fr.props) { const ob = pp(THREE, 'fence_old', q.x, q.z, q.ry, q.y); ob.scale.x = q.sx; grp.add(ob); }
    for (const k in fr.bags) fr.bags[k].mesh(grp, F.MAT[k]);
    G.lots.add(grp);
    return grp;
  }
  // a plot's dressing, placed: the plan (finishPlot's, on the plot), the fence, the outbuilding as a house of its own,
  // the car and the boat on the ground, tilted to it, and the lot's ground patch (D: premises_build.js genDress)
  function placeDress(plot, built, D, Tv) {
    const HG = window.HOUSE_GEN, PR = propReg(), pp = typeof propPlace === 'function' ? propPlace : null;
    const out = { groups: [], tris: 0, lights: 0 };
    if (!D || !D.ok) return out;
    const fg = placeFence(D.fence);
    if (fg) out.groups.push(fg);
    if (D.out && plot.out) {
      try {
        let F2 = D.out.F;
        if (!F2) { F2 = HG.makeFinish(); HG.applyFinish(plot.out.P, F2); PB.uniApply(F2, D.out.fin); }
        const b2 = D.out.built; plot.out.built = b2;
        const og = placeBuilt(G.houses, plot.out, b2, F2, HG); hitAdd(og, 'outbuilding', 1.0);
        out.groups.push(og); out.tris += b2.stats.tris; out.lights += litOf(b2);
      } catch (e) { console.warn('premises outbuilding', plot.id, e && e.message); plot.out = null; }
    }
    const h = Tv.h;
    const grp = new THREE.Group(); grp.name = 'yard:' + plot.id;
    // THE LOT SLAB (G401): a commercial car park or an official forecourt in weathered concrete, its
    // bay lines, and the cars in the bays - the composer's per category (VILLAGE_GEN.planLot)
    if (plot.lot && plot.lot.kind === 'concrete' && plot.lot.poly) { const sl = slabMesh(plot.lot, h); if (sl) grp.add(sl); }
    const lotCars = plot.lot && plot.lot.cars ? plot.lot.cars : [];
    for (const c of [plot.car, plot.boat].concat(lotCars)) if (c && pp && PR && PR.props[c.key]) {
      const ob = pp(THREE, c.key, c.x, c.z, c.ry, c.y); tiltToGround(ob, h, c.x, c.z, c.ry); grp.add(ob);
      hitAdd(ob, plot.boat === c ? 'boat' : 'car', 0.5);
    }
    if (D.lot && window.LOT_GROUND) {
      try { window.LOT_GROUND.mesh(THREE, grp, D.lot, () => { if (o.onBuilt) o.onBuilt(0, queue.length); }); }
      catch (e) { console.warn('premises lot', plot.id, e && e.message); }
    }
    G.lots.add(grp); out.groups.push(grp);
    return out;
  }
  // THE SLAB (G401): a polygon of weathered concrete laid on the terrain in 1 m cells (the site set
  // `cracked`, diff + normal + roughness), a hair over the ground with a polygon offset so it wins
  // the depth fight with the lot patch, and its bay lines as thin white quads over it
  let SLAB_MAT = null, BAY_MAT = null;
  function slabMesh(lot, h) {
    const S = texSets().cracked; if (!S || !S.diff) return null;
    if (!SLAB_MAT) {
      const tex = (img, srgb) => { const t = new THREE.Texture(img); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; const ok = () => { t.needsUpdate = true; if (o.onBuilt) o.onBuilt(0, 0); }; if (img.complete && img.naturalWidth) t.needsUpdate = true; else img.addEventListener('load', ok); return t; };
      SLAB_MAT = new THREE.MeshStandardMaterial({ color: 0xb4b0a8, roughness: 0.95, metalness: 0, map: tex(S.diff, true), normalMap: S.nor ? tex(S.nor, false) : null, roughnessMap: S.rough ? tex(S.rough, false) : null,
                                                  polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
      BAY_MAT = new THREE.MeshStandardMaterial({ color: 0xe8e6de, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
    }
    const tile = S.tile || 2.8, poly = lot.poly;
    // the polygon is a rectangle in the plot's frame: a grid along its own two edges
    const a = poly[0], b = poly[1], d = poly[3];
    const ex = [b[0] - a[0], b[1] - a[1]], ez = [d[0] - a[0], d[1] - a[1]];
    const nx = Math.max(1, Math.ceil(Math.hypot(ex[0], ex[1]) / 1.0)), nz = Math.max(1, Math.ceil(Math.hypot(ez[0], ez[1]) / 1.0));
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const u = i / nx, v = j / nz, x = a[0] + ex[0] * u + ez[0] * v, z = a[1] + ex[1] * u + ez[1] * v;
      pos.push(x, h(x, z) + 0.035, z); uv.push(x / tile, z / tile);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const q = j * (nx + 1) + i; idx.push(q, q + nx + 1, q + 1, q + 1, q + nx + 1, q + nx + 2); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    const g = new THREE.Group(); g.name = 'slab';
    const m = new THREE.Mesh(geo, SLAB_MAT); m.receiveShadow = true; m.castShadow = false; m.renderOrder = 2; g.add(m);
    if (lot.bays && lot.bays.length) {
      const bp = [], bi = [];
      for (const [p0, p1] of lot.bays) {
        const dx = p1[0] - p0[0], dz = p1[1] - p0[1], L = Math.hypot(dx, dz) || 1, nx2 = -dz / L * 0.06, nz2 = dx / L * 0.06;
        const k = bp.length / 3;
        for (const [x, z] of [[p0[0] - nx2, p0[1] - nz2], [p1[0] - nx2, p1[1] - nz2], [p1[0] + nx2, p1[1] + nz2], [p0[0] + nx2, p0[1] + nz2]]) bp.push(x, h(x, z) + 0.05, z);
        bi.push(k, k + 2, k + 1, k, k + 3, k + 2);
      }
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bp), 3)); bg.setIndex(bi); bg.computeVertexNormals();
      const bm = new THREE.Mesh(bg, BAY_MAT); bm.renderOrder = 3; bm.castShadow = false; g.add(bm);
    }
    return g;
  }
  // a placed prop or billboard (v5): a prop through propPlace on the composed ground, a billboard
  // through BIG_GEN.billboard with its own finish (the board IS the texture); in the world frame
  function buildObject(ob) {
    const PR = propReg(), pp = typeof propPlace === 'function' ? propPlace : null;
    const w = O.frame.toWorld(ob.x, ob.z), yaw = ob.yaw + O.frame.yaw;
    // THE GROUND IS THE DEFAULT HEIGHT (2026-09-23): the editor writes a prop as { x, z, yaw, dy,
    // on: 'ground' } and no `y` at all, so an authored or hand-placed object stood at y = 0 - the sea.
    // A number in `y` still wins (a thing on a roof, a raft); otherwise it is the composed ground plus
    // the entry's own `dy`.
    const obY = (typeof ob.y === 'number') ? ob.y : (O.terrainAt(w[0], w[1]) + (+ob.dy || 0));
    if (ob.kind === 'prop') {
      if (!pp || !PR || !PR.props[ob.key]) return null;
      const g = pp(THREE, ob.key, w[0], w[1], yaw, obY, true);   // a repeated key is instanced (G934)
      if (ob.on === 'ground') tiltToGround(g, (x, z) => O.terrainAt(x, z), w[0], w[1], yaw);
      G.houses.add(g);
      hitAdd(g, 'prop', 0.5);
      if (g.userData.propInst) return { grp: g, tris: (PR.props[ob.key] && PR.props[ob.key].nt) || 0, house: ob };   // no meshes of its own: the full level's count
      let tris = 0; g.traverse(m => { if (m.isMesh && m.geometry) { const q = m.geometry; tris += (q.index ? q.index.count : (q.attributes.position ? q.attributes.position.count : 0)) / 3; } });
      return { grp: g, tris: Math.round(tris), house: ob };
    }
    // A PARKED AEROPLANE (G411): src/viewer/parked.js stands the build the key names - captured
    // through the editor at the boot's `parked` step (or now, once that step ran) - as a THREE.LOD
    // with its own ladder; the holder comes back at once and fills when the capture lands
    if (ob.kind === 'aircraft') {
      const PK = window.PARKED;
      if (!PK || !PK.place) return null;
      const g = PK.place(THREE, ob.key, w[0], obY, w[1], yaw);
      G.houses.add(g);
      // the holder fills when the capture lands: registered then (step() looks for it)
      hitAdd(g, 'aircraft', 0.5);
      return { grp: g, tris: Math.round(PK.trisOf ? PK.trisOf(g) : 0), house: ob };
    }
    if (ob.kind === 'billboard') {
      const BG = window.BIG_GEN;
      if (!BG || !BG.billboard) return null;
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      const bb = BG.billboard({ key: ob.key, w: ob.w, ground: (x, z) => O.terrainAt(w[0] + x * c + z * sn, w[1] - x * sn + z * c) - obY });
      const F = BG.billboardFinish(ob.key);
      const grp = new THREE.Group(); grp.position.set(w[0], obY, w[1]); grp.rotation.y = yaw;
      for (const k of bb.BAGS) bb.bags[k].mesh(grp, F.MAT[k]);
      if (bb.bags.aoskirt && window.HOUSE_GEN && window.HOUSE_GEN.MAT && window.HOUSE_GEN.MAT.aoskirt) { const sk = bb.bags.aoskirt.mesh(grp, window.HOUSE_GEN.MAT.aoskirt); if (sk) { sk.renderOrder = 5; sk.castShadow = false; sk.receiveShadow = false; } }
      G.houses.add(grp);
      hitAdd(grp, 'billboard', 0.5);
      let tris = 0; grp.traverse(m => { if (m.isMesh && m.geometry) { const q = m.geometry; tris += (q.index ? q.index.count : (q.attributes.position ? q.attributes.position.count : 0)) / 3; } });
      return { grp, tris: Math.round(tris), house: ob };
    }
    return null;
  }
  const objectSeed = ob => PG.hash32(PG.fnv(String(ob.id)), PG.fnv(JSON.stringify([ob.kind, ob.key, ob.x, ob.z, ob.yaw, ob.y, ob.w, ob.on])));
  // a site's item (G830: its generation - the build and the synthetic plot's dressing plan - is premises_build.js
  // genItem, inline or the house worker's R; the placement is here)
  function buildItem(it, R) {
    const GEN = window[it.gen];
    if (!GEN) return null;
    R = R || BLD.genItem(it);
    if (!R) return null;
    const built = R.built;
    let F = R.F;
    if (!F) { F = GEN.makeFinish(); GEN.applyFinish(it.P, F); PB.uniApply(F, R.fin); }
    const grp = placeBuilt(G.houses, it, built, F, GEN);
    hitAdd(grp, 'item', 1.0);
    if (built.bags.aoskirt && GEN.MAT && GEN.MAT.aoskirt) { const sk = built.bags.aoskirt.mesh(grp, GEN.MAT.aoskirt); if (sk) { sk.renderOrder = 5; sk.castShadow = false; sk.receiveShadow = false; } }
    // A HAND-PLACED SITE ITEM DRESSES LIKE A PLOT (G401, the user: "the ground textures of all lots"): a
    // synthetic plot round its foot - the frontage on its +z side, the road a line 6 m in front - through
    // the same dressing a zoned plot gets, so the category's law lays its ground (the sports ground
    // brings its own; the tram, the mill and the parks stand as they are). The plan is genItem's.
    const extra = [];
    if (R.dress && R.plot) {
      try { const D = placeDress(R.plot, built, R.dress, R.Tv); for (const g2 of D.groups) extra.push(g2); }
      catch (e) { console.warn('premises site lot', it.id, e && e.message); }
    }
    return { grp, tris: built.stats.tris, house: it, built, lights: litOf(built), extra };
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
  function buildSiteFences(st, R) {
    R = R || BLD.genFences(st.fences, (PG.fnv(String(st.id)) % 1000) * 7 + 3);
    const fg = placeFence(R.fence);
    return { grp: fg || new THREE.Group(), tris: 0, house: st, extra: [] };
  }
  const parkSeed = pk => PG.hash32(pk.seed, PG.fnv(JSON.stringify([pk.plan.centre, pk.plan.yaw, pk.level, pk.key])));
  function syncHouses() {
    const want = new Map();
    for (const p of O.records.plots) if (p.kind !== 'park' && p.kind !== 'airfield') want.set(p.id, p);
    for (const it of O.records.items) want.set(it.id, Object.assign({ seed: itemSeed(it), isItem: true, rec: it }, { id: it.id }));
    for (const pk of O.records.parks || []) want.set(pk.id, { id: pk.id, seed: parkSeed(pk), isPark: true, rec: pk });
    for (const ob of O.records.objects || []) want.set('ob:' + ob.id, { id: 'ob:' + ob.id, seed: objectSeed(ob), isObject: true, rec: ob });
    // a site's own fences (G393.3): the theme's segments in premises coordinates, the village's fence
    for (const st of rec.layers.sites || []) if (st.fences && st.fences.length) want.set('sf:' + st.id, { id: 'sf:' + st.id, seed: PG.fnv(JSON.stringify(st.fences)), isFence: true, rec: st });
    const VGe = window.VILLAGE_GEN;
    for (const [id, h] of HOUSES) { const p = want.get(id); if (!p || p.seed !== h.seed) {
      for (const g of [h.grp].concat(h.extra || [])) if (g) { hitDrop(g); if (g.parent) g.parent.remove(g); g.traverse(c => { if (c.geometry && !c.userData.sharedGeo) c.geometry.dispose(); }); }
      if (VGe && VGe.edgeKey && h.plot && h.plot.fences) for (const sg of h.plot.fences) { FENCED.delete(VGe.edgeKey(sg.a, sg.b)); HWQ.needState = true; }
      HOUSES.delete(id);
    } }
    hwCancel();   // G830: what the worker still owes is re-queued below with the rest
    queue.length = 0;
    for (const [id, p] of want) if (!HOUSES.has(id)) { p._w = undefined; p._d = undefined; queue.push(p); }
    queueCells(); STREAM.cx = NaN;   // the stream re-sorts from the aircraft at its next call
    stats.queued = queue.length;
  }
  // A HOUSE'S THRIFT (G557, 2026-09-24): over Metlakatla (641 houses) the shadow pass drew the houses ~8 000 times and
  // the view ~5 000 - every dressing prop of a yard (a LOD ladder with no end) and every small bag cast into every
  // cascade. In the game a house's dressing props cast no shadow and are culled past HOUSE_PROP_GONE; a bag under
  // HOUSE_CAST_R of radius (trims, sills, pipes) casts none. The walls and roofs keep their shadows.
  // A house past HOUSE_CAST_FAR from the eye casts nothing at all (detailTick): its shadow is a few pixels of the far
  // cascade, and it was most of the shadow pass. Props arrive after the house (their rungs load): freezeStatic runs
  // this again on a thrifty house with fresh content, so a late rung is thrifty too.
  const HOUSE_PROP_GONE = 200, HOUSE_CAST_R = 2, HOUSE_CAST_FAR = 600;
  // light (G563): a site's item, object, fence or park - the shadow cuts, the far town and the walk skip, never the
  // prop ladder's cut (a boat, a totem, a hangar's own ladder stay as authored); they were 1 296 draws over the field
  function houseThrift(grp, light) {
    grp.userData.thrift = true; if (light) grp.userData.light = true; light = grp.userData.light;
    grp.traverse(obj => {
      // an INSTANCED dressing prop (G934): the same two rules, told to the instancer - gone at HOUSE_PROP_GONE, no shadow
      if (obj.userData.propInst && !light) { obj.userData.instGone = HOUSE_PROP_GONE; obj.userData.instCast = false; if (typeof propInstTouch === 'function') propInstTouch(); return; }
      if (obj.isLOD && obj !== grp && !light) {
        // the ladder is cut at HOUSE_PROP_GONE: a prop's own end (a propane bottle's 533 m, a person's 1 392 m) comes
        // in, a rung past it goes, and an empty level ends it
        const keep = [];
        for (const l of obj.levels) {
          if (l.distance < HOUSE_PROP_GONE) keep.push(l);
          else if (l.object.children.length || l.object.isMesh) { obj.remove(l.object); }
        }
        obj.levels.length = 0; keep.forEach(l => obj.levels.push(l));
        if (!obj.userData.gone) { obj.userData.gone = new THREE.Group(); obj.add(obj.userData.gone); }
        obj.levels.push({ distance: HOUSE_PROP_GONE, hysteresis: 0, object: obj.userData.gone });
        obj.traverse(m => { if (m.isMesh) m.castShadow = false; });
      }
    });
    for (const m of grp.children) if (m.isMesh && m.geometry && m.castShadow) {
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      if (m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) < HOUSE_CAST_R) m.castShadow = false;
    }
    if (light) grp.traverse(m => {   // a parked aeroplane's or a site object's nested crumbs (G564): under 30 cm, no shadow
      if (!m.isMesh || !m.castShadow || !m.geometry) return; if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      if (m.geometry.boundingSphere.radius * Math.max(m.scale.x, m.scale.y, m.scale.z) < 0.3) m.castShadow = false; });
    grp.userData.casters = grp.children.filter(m => m.isMesh && m.castShadow);
    grp.userData.castOn = true;
    // THE WALKS (G558): past the props' reach a house's whole dressing is switched off at its top, so neither the
    // view's walk nor each shadow cascade's walks through its prop ladders (3 735 over Metlakatla)
    const props = []; grp.traverse(x => { if ((x.isLOD || x.userData.propInst) && x !== grp) { for (let p = x.parent; p && p !== grp; p = p.parent) if (p.isLOD) return; props.push(x); } });
    grp.userData.props = light ? [] : props; if (grp.userData.propsOn === undefined) grp.userData.propsOn = true;
  }
  // THE BOOT BUILDS WHAT IS NEAR (G562, the user: "keep loading assets as we go ... that's how MSFS does it"): the
  // queue is sorted by distance from (cx, cz) and built while the next entry stands within R; the rest waits, nearest
  // first, for the game's own step (render_world: one every third frame). Metlakatla's 641 houses were 38 s of the
  // roll-out's screen.
  function posOf(p) {
    const r = p.rec || p; let x = r.x, z = r.z;
    if (!isFinite(x) && r.at) { x = r.at.x; z = r.at.z; }
    if (!isFinite(x) && r.c) { x = r.c[0]; z = r.c[1]; }
    const poly = r.poly || r.pts;
    if (!isFinite(x) && poly && poly.length) { x = 0; z = 0; for (const q of poly) { x += Array.isArray(q) ? q[0] : q.x; z += Array.isArray(q) ? q[1] : q.z; } x /= poly.length; z /= poly.length; }
    return isFinite(x) && isFinite(z) ? O.frame.toWorld(x, z) : null;
  }
  // THE QUEUE BY CELL (G592): what is still to build, counted per LIVE_CELL square of the world (the far town's and the
  // lots' 256 m cells). A cell with nothing queued in it is LIVE: its optimizations (the far town, the near bake, the
  // lot and road merges, the walk skip) run for it while the rest of the map still streams - they used to wait for
  // the WHOLE queue, which with the far premises streaming by proximity is never empty
  const LIVE_CELL = 256;
  const CELLQ = new Map();
  const cellKey = (x, z) => Math.floor(x / LIVE_CELL) + ',' + Math.floor(z / LIVE_CELL);
  const qPos = p => { if (p._w === undefined) p._w = posOf(p) || null; return p._w; };
  const qCell = p => { const w = qPos(p); return w ? cellKey(w[0], w[1]) : '*'; };
  function queueCells() { CELLQ.clear(); for (const p of queue) { const k = qCell(p); CELLQ.set(k, (CELLQ.get(k) || 0) + 1); } }
  const cellLive = k => !(CELLQ.get(k) > 0) && !(CELLQ.get('*') > 0);
  // a box (world x0..x1, z0..z1) is live when no cell it touches has anything queued
  function boxLive(x0, z0, x1, z1) {
    if (!queue.length) return true;
    if (CELLQ.get('*') > 0) return false;
    for (let i = Math.floor(x0 / LIVE_CELL); i <= Math.floor(x1 / LIVE_CELL); i++) for (let j = Math.floor(z0 / LIVE_CELL); j <= Math.floor(z1 / LIVE_CELL); j++) if (CELLQ.get(i + ',' + j) > 0) return false;
    return true;
  }
  function drainNear(cx, cz, R) {
    sortFrom(cx, cz);
    let n = 0;
    while (queue.length && queue[0]._d <= R) { buildOne(queue.shift()); n++; }
    afterBuilt(n);   // once for the whole drain (G591): it ran per item - a 1024^2 wear repaint and a freeze walk each
    return queue.length;
  }
  function sortFrom(cx, cz) {
    for (const p of queue) { const w = qPos(p); p._d = w ? Math.hypot(w[0] - cx, w[1] - cz) : 0; }
    queue.sort((a, b) => a._d - b._d);
  }
  // THE STREAM (G591, the 2026-09-26 playtest): the far premises came in one item every third rendered frame, from
  // any distance, parked or not - 18-29 ms a frame over the taxi, a house being ~45 ms. Now the host hands the
  // AIRCRAFT's position each frame: the queue is ordered by distance to it (re-sorted every STREAM.resort metres),
  // only what lies within STREAM.reach (what the next minutes of flight can reach) is built, and on a time BANK -
  // STREAM.budget ms credited a frame, an item built while the bank is positive and its cost (and the frame's
  // post-work) taken off. A cheap item (a fence, an object) goes several to a frame; a house, which cannot be cut,
  // goes once the bank has paid for it - the stream averages the budget whatever the item.
  // THE RISE (G673, A2-FADES; the user: "transitions (fading or growing) for everything that appears or
  // disappears"). An item the STREAM builds after the roll-out (a house, a site item, a parked aeroplane, a
  // fence) rises out of the ground over RISE.secs instead of appearing whole. Only its DRAW is scaled: each mesh's
  // onBeforeRender multiplies its matrixWorld by the rise (about the item's foot, world up) and onAfterRender puts
  // it back, so everything that READS the scene - the hit raster, the obstacle shapes, the lot and road merges, the
  // far-town bake, the near shadow registry's frozen spheres, the shadow pass itself (which calls no
  // onBeforeRender) - sees the item as built. The hooks are removed when the rise ends. A merge made mid-rise
  // hides its sources (they simply stop drawing); a rung that lands mid-rise is not hooked (it appears whole).
  // What the roll-out's prewarm builds is under the loading screen and does not rise.
  const RISE = { on: true, secs: 0.6, list: [], n: 0 };
  function riseAdd(grp) {
    if (!RISE.on || !o.game || !grp || !THREE.Matrix4 || !grp.traverse) return;
    const R = { grp, t0: performance.now(), e: 0, S: new THREE.Matrix4(), hooks: [] };
    grp.traverse(m => {
      if (!(m.isMesh || m.isLine || m.isPoints)) return;
      const pb = m.onBeforeRender, pa = m.onAfterRender, save = new THREE.Matrix4();
      let on = false;
      m.onBeforeRender = function () { pb.apply(this, arguments); on = R.e < 1; if (on) { save.copy(this.matrixWorld); this.matrixWorld.premultiply(R.S); } };
      m.onAfterRender = function () { if (on) { this.matrixWorld.copy(save); on = false; } pa.apply(this, arguments); };
      R.hooks.push([m, pb, pa]);
    });
    if (!R.hooks.length) return;
    RISE.list.push(R); RISE.n++; riseSet(R, 0);
  }
  // the rise's matrix: y scaled by e about the item's foot (its group's world position), x and z untouched
  function riseSet(R, e) {
    R.e = e;
    const w = R.grp.matrixWorld.elements, y0 = w[13], k = Math.max(0.02, e);
    R.S.set(1, 0, 0, 0,  0, k, 0, y0 * (1 - k),  0, 0, 1, 0,  0, 0, 0, 1);
  }
  function riseTick() {
    const t = performance.now();
    for (let i = RISE.list.length - 1; i >= 0; i--) {
      const R = RISE.list[i], k = Math.min(1, (t - R.t0) / (RISE.secs * 1000));
      riseSet(R, 1 - Math.pow(1 - k, 3));   // out-cubic: most of the height in the first third
      if (k >= 1) { for (const [m, pb, pa] of R.hooks) { m.onBeforeRender = pb; m.onAfterRender = pa; } RISE.list.splice(i, 1); }
    }
  }
  const STREAM = { reach: 6000, budget: 3, cap: 12, resort: 60, bank: 0, cx: NaN, cz: NaN, near: 0, ms: 0, built: 0, slow: [] };   // slow: the last builds over 60 ms [id, ms]
  function stream(cx, cz) {
    if (hwOn()) return streamW(cx, cz);
    if (HWQ.order.length) hwCancel(true);   // the worker gone (or the editor open): what it owed builds here, first
    const S = STREAM;
    if (!queue.length) { S.near = 0; return 0; }
    if (!(Math.abs(cx - S.cx) + Math.abs(cz - S.cz) < S.resort) || queue[0]._d === undefined) {
      sortFrom(cx, cz); S.cx = cx; S.cz = cz;
      let k = 0; while (k < queue.length && queue[k]._d <= S.reach) k++; S.near = k;
    }
    S.bank = Math.min(S.cap, S.bank + S.budget);
    if (!(queue[0]._d <= S.reach) || S.bank <= 0) return 0;
    const t0 = performance.now();
    let n = 0;
    while (queue.length && S.bank > 0 && queue[0]._d <= S.reach) {
      const t = performance.now(), p = queue.shift(); IN_STREAM = true; try { buildOne(p); } finally { IN_STREAM = false; } n++; S.near = Math.max(0, S.near - 1);
      const h = HOUSES.get(p.id); if (h && !h.failed) { riseAdd(h.grp); for (const g of h.extra || []) riseAdd(g); }   // G673
      S.bank -= performance.now() - t;
    }
    const t1 = performance.now(); STREAMING = true; try { afterBuilt(n); } finally { STREAMING = false; } S.bank -= performance.now() - t1;
    const t2 = performance.now(); S.ms += t2 - t0; S.built += n;
    if (t2 - t0 > (S.worst ? S.worst[0] : 0)) S.worst = [Math.round(t2 - t0), n, Math.round(t2 - t1), queue.length ? Math.round(queue[0]._d) : -1];   // the dearest frame of the stream: [ms, items, post-work ms, next item metres]
    return n;
  }
  // THE ROLL-OUT'S SHARE (G591): what lies within `reach` of the aircraft, built under the roll-out screen in slices
  // of `budgetMs` (app.js's 'town' step calls it until done) - it was one synchronous drain inside the world step, the
  // 15-18 s main-thread task behind Chrome's "page unresponsive". The merges wait for the last slice.
  // G999 (A5-LOAD): AN OBSTACLE'S REGISTRATION HAS A SLICE OF ITS OWN. A slice built its item(s) and then
  // afterBuilt registered one pending obstacle (hitPendingStep: a parked aeroplane's hitbox is ~0.8 s of
  // rasterising) - with a house in the same slice, a 1.0 s task of the town step. A slice that starts with a ready
  // obstacle registers it and builds nothing; a slice that builds leaves the registration to the next.
  const hitPendingReady = () => PENDING_HIT.some(q => q.grp.parent && hitReady(q.grp));
  function prewarm(cx, cz, reach, budgetMs) {
    if (hwOn()) return prewarmW(cx, cz, reach, budgetMs);
    if (HWQ.order.length) hwCancel(true);
    sortFrom(cx, cz); STREAM.cx = cx; STREAM.cz = cz;
    const t0 = performance.now();
    let n = 0;
    if (hitPendingReady()) {
      hitPendingStep(); stats.obstacles = OBST_IDS.size;
      let near0 = 0; while (near0 < queue.length && queue[near0]._d <= reach) near0++;
      return { done: false, built: 0, near: near0, queued: queue.length, ms: performance.now() - t0 };
    }
    STREAMING = true;
    try { while (queue.length && queue[0]._d <= reach && (n === 0 || performance.now() - t0 < budgetMs)) { buildOne(queue.shift()); n++; } }
    finally { STREAMING = false; }
    let near = 0; while (near < queue.length && queue[near]._d <= reach) near++;
    if (near || hitPendingReady()) { STREAMING = true; try { afterBuilt(n, true); } finally { STREAMING = false; } if (!near) return { done: false, built: n, near: 0, queued: queue.length, ms: performance.now() - t0 }; }
    else { afterBuilt(n); freezeStatic(true); }   // the last slice: the lots and roads of every live cell merged now
    let k = 0; while (k < queue.length && queue[k]._d <= STREAM.reach) k++; STREAM.near = k;
    return { done: !near, built: n, near, queued: queue.length, ms: performance.now() - t0 };
  }
  // (G830: R, the entry's generation when the house worker made it - premises_build.js unpack)
  function buildOne(p, R) {
    const k = qCell(p), c = CELLQ.get(k) || 0; if (c > 1) CELLQ.set(k, c - 1); else CELLQ.delete(k);
    const tb = performance.now();
    try { buildOne0(p, R); } finally { const ms = performance.now() - tb; if (ms > 60) { const L = STREAM.slow; L.push([p.id, Math.round(ms)]); if (L.length > 60) L.shift(); } }
  }
  function buildOne0(p, R) {
    try { const h = p.isPark ? buildPark(p.rec) : p.isItem ? buildItem(p.rec, R) : p.isObject ? buildObject(p.rec) : p.isFence ? buildSiteFences(p.rec, R) : buildHouse(p, R); if (h && o.game) houseThrift(h.grp, !!(p.isPark || p.isItem || p.isObject || p.isFence)); if (h) HOUSES.set(p.id, { seed: p.seed, grp: h.grp, tris: h.tris, plot: p, house: h.house, built: h.built || null, extra: h.extra || [], lights: h.lights || 0, isObject: !!p.isObject }); }
    catch (e) { console.warn('premises house', p.id, e && e.message); HOUSES.set(p.id, { seed: p.seed, grp: new THREE.Group(), tris: 0, plot: p, failed: true }); }
  }
  // what a batch of builds owes once (not once an item)
  function afterBuilt(built, noHit) {
    stats.queued = queue.length + HWQ.order.length; stats.houses = 0; stats.objects = 0; stats.houseTris = 0; stats.lights = 0;
    for (const [, h] of HOUSES) { stats.houseTris += h.tris || 0; stats.lights += h.lights || 0; if (h.isObject) stats.objects++; else stats.houses++; }
    if (!noHit) hitPendingStep();   // (G999: the prewarm gives it its own slice)
    stats.obstacles = OBST_IDS.size;
    // the garden paths are the built houses' (planPath reads the door) - on the BENCH's ground: the game draws no
    // premises chunk (its patch is the ring's material), so its 1024^2 repaint an item was work nobody read (G591)
    if (built && !o.game) paintWear();
    if (built && o.onBuilt) o.onBuilt(built, queue.length);
    if (built && LIFE) LIFE.dirty();
    if (built) freezeStatic();
    return built;
  }
  function step(n) {
    // G830: what the worker owes goes first, in its order; the editor (step's caller while it is open) builds inline
    if (HWQ.order.length) { if (hwOn()) return afterBuilt(hwPlace(0, performance.now())); hwCancel(true); }
    let built = 0;
    while (queue.length && built < (n || 2)) { buildOne(queue.shift()); built++; }
    return afterBuilt(built);
  }

  // ---- THE HOUSE WORKER (G830-G832, C2a): the queue's generation in src/viewer/house_worker.js -------------------
  // The queue keeps its order (the prewarm's by distance from the stand, the stream's from the aircraft) and the page
  // PLACES in that order; what changes is who generates. An entry the prewarm or the stream takes is DISPATCHED - a
  // job { seq, kind, id, seed } in a batch to the worker - and placed when its result is in and every entry before it
  // is placed, with buildOne(p, R). Only houses, site items and site fences are generated there; an object (a prop, a
  // parked aeroplane, a billboard) or a park is placed here at its turn as before.
  // THE TALLIES (premises_build.js): the page applies each result's delta as it places it, so its copy is the worker's
  // at every batch boundary; a batch carries the page's copy (`state`) whenever the worker's may differ - the first,
  // and after anything generated HERE that moves them: a HANGAR_GEN item (its lod-0 shell is hangar.js's THREE build,
  // canvas sheets and materials of its own: MAIN_ONLY) is a BARRIER - nothing past it is sent until it is built; a
  // result the worker could not give (not found, an error, a cache entry gone) is built here and everything after it
  // is sent again (`gen` bumped: the late answers are dropped).
  const HWK = (o.game && window.HOUSE_WORKER && window.HOUSE_WORKER.ok()) ? window.HOUSE_WORKER : null;
  const HWQ = { order: [], jobs: new Map(), arrived: new Map(), seq: 0, gen: 0, epoch: -1, needState: true, dead: false,
                dispatched: 0, placed: 0, local: 0, errors: 0 };
  const hwOn = () => !!(HWK && !HWQ.dead && HWQ.epoch >= 0 && HWK.ok() && !o.editing());
  const hwKind = p => (p.isPark || p.isObject ? null : p.isFence ? 'fence' : p.isItem ? 'item' : 'house');
  const hwMainOnly = p => !!(p.isItem && p.rec.gen === 'HANGAR_GEN' && !(p.rec.P && p.rec.P.restated) && typeof document !== 'undefined' && typeof genHangarBuild === 'function');
  function hwCompose() {
    if (!HWK || !HWK.ok()) return;
    hwCancel(true);
    const lazy = ['SPORT_GEN', 'MARINE_GEN'].filter(g => !!window[g]);
    HWQ.epoch = HWK.compose(rec, composedPool || [], lazy);
    HWQ.needState = true;
  }
  if (HWK) {
    HWK.onResult = m => { if (m.epoch === HWQ.epoch && m.gen === HWQ.gen && HWQ.jobs.has(m.seq)) HWQ.arrived.set(m.seq, m); };
    HWK.onFail = () => { HWQ.dead = true; for (const [, j] of HWQ.jobs) j.remote = false; };   // the rest builds here, in the same order
    if (o.game && world.premises) hwCompose();
  }
  // what the worker is still owed (the pending entries back at the head of the queue, when asked)
  function hwCancel(requeue) {
    if (!HWQ.order.length) return;
    const back = HWQ.order.map(s => HWQ.jobs.get(s).p);
    HWQ.order.length = 0; HWQ.jobs.clear(); HWQ.arrived.clear(); HWQ.gen++; HWQ.needState = true;
    if (requeue) { queue.unshift(...back); queueCells(); }
  }
  function hwDispatch(list) {
    for (const p of list) {
      const seq = ++HWQ.seq, kind = hwKind(p), barrier = kind === 'item' && hwMainOnly(p);
      HWQ.jobs.set(seq, { seq, p, kind, barrier, remote: !!kind && !barrier && !HWQ.dead, sent: false });
      HWQ.order.push(seq);
    }
    hwPump();
  }
  function hwPump() {
    if (!hwOn()) return;
    const jobs = [];
    for (const seq of HWQ.order) {
      const j = HWQ.jobs.get(seq);
      if (j.barrier) break;                      // nothing past a page-built entry that moves the tallies
      if (!j.remote || j.sent) continue;
      j.sent = true; jobs.push({ seq, kind: j.kind, id: j.p.id, seed: j.p.seed });
    }
    if (!jobs.length) return;
    const PR = propReg();
    HWK.post({ cmd: 'jobs', epoch: HWQ.epoch, gen: HWQ.gen, state: HWQ.needState ? BLD.getState() : null, jobs,
               size: Math.max(W, H), lod1: HLOD.lod1, outLod: HLOD.outLod, pp: typeof propPlace === 'function', lotGround: !!window.LOT_GROUND,
               props: PR ? Object.keys(PR.props) : [] });
    HWQ.needState = false; HWQ.dispatched += jobs.length;
  }
  // everything after `seq` is asked again (the page's tallies are the truth; the worker's answers past it are dropped)
  function hwResend(seq) {
    HWQ.gen++; HWQ.needState = true;
    for (const [s, j] of HWQ.jobs) if (s > seq) { j.sent = false; HWQ.arrived.delete(s); }
  }
  // place what has arrived, in order, within `budgetMs` (at least one when one is ready); `each(p)` after each
  function hwPlace(budgetMs, t0, each) {
    let n = 0;
    while (HWQ.order.length) {
      if (n > 0 && performance.now() - t0 >= budgetMs) break;
      const seq = HWQ.order[0], j = HWQ.jobs.get(seq);
      let R, miss = false;
      if (j.remote && !HWQ.dead) {
        const m = HWQ.arrived.get(seq);
        if (!m) break;
        if (m.miss || !m.r) {
          miss = true; if (m.miss) console.warn('house worker: ' + j.p.id + ' (' + m.miss + ') - built here');
          // a worker that keeps failing is let go: the rest builds here, in the same order
          if (/^error/.test(m.miss || '') && ++HWQ.errors >= 3) { HWQ.dead = true; for (const [, jj] of HWQ.jobs) jj.remote = false; console.warn('house worker: three errors - the page builds the rest itself'); }
        }
        else { BLD.applyDelta(m.d); R = BLD.unpack(m.r, THREE, j.kind === 'item' ? j.p.rec : j.kind === 'house' ? j.p : null); }
      }
      HWQ.order.shift(); HWQ.jobs.delete(seq); HWQ.arrived.delete(seq);
      const here = !R && !!j.kind;   // generated on this thread (a barrier, a miss, the worker gone)
      if (here) { HWQ.local++; window.FLYDIY_HW_HERE = (window.FLYDIY_HW_HERE || 0) + 1; }
      try { buildOne(j.p, R); }
      finally { if (here) window.FLYDIY_HW_HERE--; }
      n++; HWQ.placed++;
      if (each) each(j.p);
      if (miss) hwResend(seq);
      if (j.barrier || miss) hwPump();
    }
    return n;
  }
  // a promise that settles when the worker next answers (the town step waits on it rather than spinning)
  const hwWait = () => (HWQ.order.length && !HWQ.arrived.has(HWQ.order[0]) && hwOn() ? HWK.next() : null);
  // THE ROLL-OUT'S SHARE, the worker's way: everything within reach dispatched at once (in the order the page builds),
  // then placed as it arrives, a budget a slice
  function prewarmW(cx, cz, reach, budgetMs) {
    sortFrom(cx, cz); STREAM.cx = cx; STREAM.cz = cz;
    const t0 = performance.now();
    const pend = () => HWQ.order.length;
    if (hitPendingReady()) {
      hitPendingStep(); stats.obstacles = OBST_IDS.size;
      let near0 = 0; while (near0 < queue.length && queue[near0]._d <= reach) near0++;
      return { done: false, built: 0, near: near0 + pend(), queued: queue.length + pend(), ms: performance.now() - t0 };
    }
    const take = []; while (queue.length && queue[0]._d <= reach) take.push(queue.shift());
    if (take.length) hwDispatch(take);
    let n = 0;
    STREAMING = true;
    try { n = hwPlace(budgetMs, t0); } finally { STREAMING = false; }
    const near = pend();
    if (near || hitPendingReady()) { STREAMING = true; try { afterBuilt(n, true); } finally { STREAMING = false; } if (!near) return { done: false, built: n, near: 0, queued: queue.length, ms: performance.now() - t0 }; }
    else { afterBuilt(n); freezeStatic(true); }
    let k = 0; while (k < queue.length && queue[k]._d <= STREAM.reach) k++; STREAM.near = k + pend();
    return { done: !near, built: n, near, queued: queue.length + near, ms: performance.now() - t0, wait: n ? null : hwWait() };
  }
  // THE STREAM, the worker's way: what the aircraft's reach takes is dispatched in the stream's order; what has arrived
  // is placed on the stream's own bank (an upload's worth, not a generation's) and rises (G673)
  function streamW(cx, cz) {
    const S = STREAM;
    if (!queue.length && !HWQ.order.length) { S.near = 0; return 0; }
    if (queue.length && (!(Math.abs(cx - S.cx) + Math.abs(cz - S.cz) < S.resort) || queue[0]._d === undefined)) { sortFrom(cx, cz); S.cx = cx; S.cz = cz; }
    const take = []; while (queue.length && queue[0]._d <= S.reach) take.push(queue.shift());
    if (take.length) hwDispatch(take);
    S.near = HWQ.order.length;
    S.bank = Math.min(S.cap, S.bank + S.budget);
    if (!HWQ.order.length || S.bank <= 0) return 0;
    const t0 = performance.now();
    let n = 0;
    while (HWQ.order.length && S.bank > 0) {
      const t = performance.now();
      IN_STREAM = true;
      let k; try { k = hwPlace(0, t, p => { const h = HOUSES.get(p.id); if (h && !h.failed) { riseAdd(h.grp); for (const g of h.extra || []) riseAdd(g); } }); } finally { IN_STREAM = false; }
      if (!k) break;
      n += k; S.bank -= performance.now() - t;
    }
    S.near = HWQ.order.length;
    if (!n) return 0;
    const t1 = performance.now(); STREAMING = true; try { afterBuilt(n); } finally { STREAMING = false; } S.bank -= performance.now() - t1;
    const t2 = performance.now(); S.ms += t2 - t0; S.built += n;
    if (t2 - t0 > (S.worst ? S.worst[0] : 0)) S.worst = [Math.round(t2 - t0), n, Math.round(t2 - t1), queue.length ? Math.round(queue[0]._d) : -1];
    return n;
  }


  // ---- the trees: the payload's rungs in a THREE.LOD, a cone until it lands -----------------
  const TREE_DEPTH = new Map();
  const TREE_GONE = 900;          // a record tree's cull distance (m)
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
    // THE RECORD TREES INSTANCED (G556, 2026-09-24, the user: "unplayable, and unacceptable performance drop for a
    // single town"): Metlakatla placed 3 644 trees and each was its own THREE.LOD of ~6 meshes - 21 864 draws (and as
    // many in the shadow pass) over the town. In the game they go by CELL: the trees of a 64 m cell, per species, one
    // InstancedMesh per rung part, the cell a THREE.LOD on the same bands and cull as a tree had (the rung is the
    // cell's, from its centre - +-45 m on a band edge). The rungs' shared geometry and materials are the ones the
    // cover ring already instances. The bench keeps a LOD a tree (the editor's own path).
    if (o.game && ready) {
      const CELL = 64, cells = new Map(), mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      for (const t of O.records.trees) {
        if (!t.key || t.key === 'stub|tree') continue;
        const w = F.toWorld(t.x, t.z), ck = Math.floor(w[0] / CELL) + ',' + Math.floor(w[1] / CELL);
        let c = cells.get(ck); if (!c) cells.set(ck, c = { x: (Math.floor(w[0] / CELL) + 0.5) * CELL, z: (Math.floor(w[1] / CELL) + 0.5) * CELL, keys: new Map() });
        let l = c.keys.get(t.key); if (!l) c.keys.set(t.key, l = []);
        l.push([w[0], t.y - 0.05 - (t.sink || 0) * t.size, w[1], t.yaw + F.yaw, t.size]);
      }
      const rungs = new Map();
      const rungOf = (key, r) => { const k = key + '#' + r; if (!rungs.has(k)) { let B = null; try { B = treeBuild(THREE, key, r, 'rungs'); } catch (e) {} rungs.set(k, B); } return rungs.get(k); };
      for (const c of cells.values()) {
        const lod = new THREE.LOD(); lod.name = 'trees:cell'; lod.position.set(c.x, 0, c.z);
        for (let r = 0; r < 3; r++) {
          const g = new THREE.Group();
          for (const [key, list] of c.keys) {
            const B = rungOf(key, r); if (!B || !B.parts) continue;
            if (r === 0) tris += B.tris * list.length;
            for (const p of B.parts) {
              const m = new THREE.InstancedMesh(p.geo, p.mat, list.length);
              list.forEach((e, i) => { pos.set(e[0] - c.x, e[1], e[2] - c.z); q.setFromAxisAngle(up, e[3]); sc.setScalar(e[4]); m.setMatrixAt(i, mtx.compose(pos, q, sc)); });
              m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
              m.castShadow = r < 2; m.receiveShadow = true; m.userData.sharedGeo = true;   // the far rung (132-900 m) casts none (G557)
              if (p.cutout) m.customDepthMaterial = treeDepth(p.mat);
              g.add(m);
            }
          }
          lod.addLevel(g, TREE_BANDS[r]);
        }
        lod.addLevel(new THREE.Group(), TREE_GONE);
        G.trees.add(lod);
      }
      stats.trees = O.records.trees.length; stats.treeTris = tris; stats.treeCells = cells.size;
      return;
    }
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
        // ...AND A CULL LEVEL. The ladder was 0 / 60 / 132 m with no end, so the
        // 132 m rung drew at ANY distance: at Metlakatla's 744 trees that is
        // thousands of draws for things a few pixels across, and the perf session
        // names record trees as the premises' biggest unhandled item. A garden tree
        // past TREE_GONE is not what you are looking at, and the island's own fill
        // and stand cards carry the wood's impression out there.
        obj.addLevel(new THREE.Group(), TREE_GONE);
        obj.scale.setScalar(t.size);
        obj.position.set(w[0], t.y - 0.05 - (t.sink || 0) * t.size, w[1]);
      } else {
        obj = new THREE.Group(); obj.name = 'tree:stub';
        obj.visible = !o.game;      // a stub cone is a BENCH placeholder; the game waits for the pack
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
  // G680: rebuildSteps is the rebuild as a generator - the game's first rebuild runs under the roll-out screen a
  // slice per task (render_world's buildWorldSceneSteps: yield*); rebuild() runs it to the end (an edit, the bench)
  function rebuild(dirty) { const g = rebuildSteps(dirty); for (;;) { const r = g.next(); if (r.done) return r.value; } }
  function* rebuildSteps(dirty) {
    const t0 = performance.now();
    if (!(composedFresh && dirty === undefined)) { O = composeNow(); hwCompose(); }
    composedFresh = false;
    refreshBounds();
    let n = 0;
    const groundDirty = !dirty || !dirty.bbox || dirty.ground !== false;
    if (o.game) {
      if (groundDirty) { yield* buildPatchSteps(); n = 1; }
      yield 'materials';
      paintMaterials();
      yield 'lots';
      placeLots();
      yield 'roads';
      yield* buildRoadsSteps();
      yield 'runways';
      buildRunways();
      yield 'trams';
      syncTrams();   // the trams run in the game whether or not the editor is open (G398.3)
      syncTraffic();
      syncAnimals();
      yield 'houses';
      if (o.editing()) { buildOutlines(); buildHandles(); }
      else { for (const c of G.outlines.children.slice()) { G.outlines.remove(c); if (c.geometry) c.geometry.dispose(); } LINES.clear(); for (const h of HANDLES) G.handles.remove(h); HANDLES.length = 0; }
      syncHouses();
      // THE GAME HAD NEVER DRAWN A RECORD TREE (2026-09-23, the user: "I can see no
      // trees in no garden nor empty lots"). This early return is the game's whole
      // rebuild, and `buildTrees()` sat below it in the BENCH path only - so
      // `planForest` composed its trees into the record, the gate counted them, the
      // panel reported them, and the renderer walked past the list. Nobody had noticed
      // because until this week no record carried one.
      yield 'trees';
      buildTrees();
      if (LIFE) { LIFE.set(rec.life); LIFE.dirty(); stats.life = 1; }
      yield 'freeze';
      freezeStatic(true);
      stats.tris = patch ? patch.userData.tris : 0; stats.chunks = patch ? patch.userData.chunks.length : 0; stats.patchBlocks = patch ? patch.userData.blocks : 0; stats.ms = performance.now() - t0; stats.rebuilt = n;
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
    paintMaterials();
    buildOutlines();
    syncTrams();
    syncTraffic();
    syncAnimals();
    buildRunways();
    buildHandles();
    syncHouses();
    if (LIFE) { LIFE.set(rec.life); LIFE.dirty(); stats.life = 1; }
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
    for (const p of O.pavePolys || []) if (PG.inPoly(p.poly, L[0], L[1])) return { id: p.id, layer: 'material', entry: PG.findById(rec, p.id).entry };
    for (const it of O.records.items) if (PG.inPoly(it.foot, L[0], L[1])) { const f = PG.findById(rec, it.site); if (f) return { id: it.site, layer: 'sites', entry: f.entry, item: it.item }; }
    // a hand-placed tree within two metres wins over the polygon under it
    let tree = null, td = 2.5;
    for (const ob of rec.layers.objects) if (ob.kind === 'tree' || ob.kind === 'prop' || ob.kind === 'billboard' || ob.kind === 'aircraft' || ob.kind === 'animal') { const d = Math.hypot(ob.x - L[0], ob.z - L[1]); if (d < td) { td = d; tree = ob; } }
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
    if (LIFE) LIFE.dispose();
    if (ANIM) { ANIM.dispose(); ANIM = null; }
    { const R = OBS(); if (R) for (const id of OBST_IDS) R.remove(id); OBST_IDS.clear(); }
    for (const [, m] of chunks) m.geometry.dispose();
    if (patch) { patch.traverse(m => { if (m.geometry) m.geometry.dispose(); }); patch = null; }
    chunks.clear();
    for (const [, L] of LINES) { L.line.geometry.dispose(); L.line.material.dispose(); }
    LINES.clear();
    scene.remove(root);
  }

  const R = {
    root, groups: G, stats,
    rebuild, rebuildSteps, step, dispose, ghost, hit, handles, pickHandle, scaleHandles, heightAt, tick, trams: () => Array.from(TRAMS.keys()),
    animals: () => (ANIM ? ANIM.list() : []),
    animalRun: () => ANIM,
    traffic: () => Array.from(TRAFFIC, ([id, t]) => ({ road: id, cars: t.cars.map(c => ({ key: c.key, s: c.s, dir: c.dir, v: c.v, x: c.grp.position.x, y: c.grp.position.y, z: c.grp.position.z, hit: c.hit })) })),
    obstacles: () => { const R = OBS(); return R ? R.list().filter(r => OBST_IDS.has(r.id)).map(r => ({ id: r.id, tag: r.tag, x: r.x, z: r.z, yaw: r.yaw, y0: r.y0, top: r.shape.top, cells: r.shape.cells, cell: r.shape.cell })) : []; },
    setRecord: r => { rec = PG.normalise(r); composedFresh = false; },
    lamps: LAMPS,                                                    // G449: the pool (update / mute / gain / litNow)
    // the material map as painted (a probe for scripts and the gate's eyes): the slots, whether their textures
    // arrived, and the map's weights at a world point
    // WHERE THE FINE PATCH IS (G434.1): the world's ring sinks its vertices under it - the ring's 17 m
    // chords sat above the true ground wherever it is concave and cut through every road, lot and pad
    // laid on the composed height (the user: "roads clip through terrain, the terrain shows through the
    // house patches"); `world` here so the rings can ask
    pavedAt: (x, z) => (O.pavedAt ? O.pavedAt(x, z) : null),       // G660: the patch is sunk under a pavement's opaque interior by it
    patchCovers: (x, z) => !!(patchAct && patchAct.act.has(patchAct.key(Math.floor(x / PCH), Math.floor(z / PCH)))),
    patchDepth, ringSink, tuck: PATCH_TUCK,   // G752: metres inside the patch (0 outside); the rings' sink by it (0 at the border); the two laws' dials
    patchBounds: () => (patch ? extentWorld() : null),
    life: LIFE,       // SCENERY LIFE: .set(rec.life), .stats, .items(cat), .masts()
    drainNear, stream, prewarm, streamState: STREAM, cellLive, hwWait, hw: HWQ,   // G830: the house worker's pending answer (a promise, or null); its queue's state   // G591/G592: the aircraft-centred stream, its dials and state; a cell with nothing queued
    detail: DETAIL, hlod: HLOD,   // the distant houses' detail cull: px (0 = off), area, hyst (PERF 2026-09-23)
    materialMap: () => ({ on: uMatOn.value, bounds: Object.assign({}, mb), n: MMN, slots: SLOTS.slice(), loaded: uSet.map(u => !!(u.value && u.value.image && u.value.image.complete)), at: (x, z) => { const i = Math.floor((x - mb.x0) / MW * MMN), j = Math.floor((z - mb.z0) / MH * MMN); if (i < 0 || j < 0 || i >= MMN || j >= MMN) return null; const k = (j * MMN + i) * 4; return [MMD[k], MMD[k + 1], MMD[k + 2], MMD[k + 3]]; } }),
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
