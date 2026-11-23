// ============================================================
// THE DRIVE MODE (TOW-LAUNCH phase 1, 2026-11-11) - the page's half of the ground vehicle. The user (11 Nov): "see a
// car DRIVE, in the game, from HOME to Metlakatla" (Cedar Harbour), with "a LITTLE UI to see the car and the
// destinations - REUSE THE PLANE'S UI": the flight's top bar, its HUD card (speed, the distance to go, the status line
// from the driver's log, as the TAXI card's), its minimap with the route drawn, its chase camera, its To picker (the
// in-flight re-routing's), its menu's Pause / Restart / Graphics / Sound. AI-driven: no manual take-over (the MVP).
//
// LAZY (tools/build.js MANIFEST.lazy): fetched with the car's pack and src/vehicle/ when the player asks to drive (the
// menu's "Drive the pickup", ?drive=1). app.js owns the mode's switch (its DRIVE object: the aeroplane off the stage,
// the solver held, as the SCENERY mode does) and calls in through small hooks, each `driveOn()` - the loop's step, the
// camera's target and heading, hud(), drawMap(), flTrip(), planSet(), gmHold(), fullReset(). This file owns the car.
//
// THE COSTS, a 60 Hz frame (GATE DRIVE-TRIP measures the node's): the physics 0.11 ms (4 substeps of 1/240 s, the
// terrain read 5 times a wheel a substep), the driver 0.004 ms; the rig's pose (one body matrix, four wheels) - a few
// microseconds; the HUD at app.js's 0.1 s cadence. A new To is NOT a frame cost but a one-off: a route + a U-turn
// planned, 120-720 ms on the island in node (the junction's corridor search) - the page holds that frame (DM.planMs). Entering builds
// the island's graph once: ~170 ms (23 000 vertices). Main thread for phase 1; the physics worker hosts it next
// (the vehicle's snap / unsnap exist).
// ============================================================
(function () {
  'use strict';
  const SHEET_URL = 'src/cars/car_conquer.json';
  const TOWN = { id: 'mk_hall', site: 'mk_hall' };   // Cedar Harbour: its Town Hall's site (the map's label)
  // CAR (13 Nov; the user's must-land list: "a few CAR-ONLY destinations"): the record's named sites a car drives to -
  // the town's diner, store and dock, the hilltop coffee, the cannery (vehicle_island.js h.sites: kept when a road passes
  // within 80 m); with the town and the aerodromes on land. The runway ends are the tow's (not in the To list)
  const CAR_SITES = ['mk_cafe_als', 'mk_store_acc', 'mk_mp_west', 'mk_coffee', 'mk_mw_cannery'];
  const DM = window.DRIVE_MODE = {
    on: false, paused: false, name: "Conquer '89 pickup", chaseDist: 10, to: null, from: null, ms: 0,
  };
  let THREE_ = null, scene_ = null, world_ = null, sheet = null, def = null, car = null, G = null, D = null, rig = null, rep = null;
  let stockSheet = null, carCtx = null;   // the Conquer pickup's sheet (fetched once); the car in use (useCar)
  let start = null, odo = 0, last = null, track = [], hudSaved = null;
  const $ = id => document.getElementById(id);

  // ---- THE RIG: the body (and its lamps, all in the body's frame), four wheels in the body's frame ----
  // (restored 12 Nov: phase 2's graph rewrite took these four with buildGraph - the page's drive and tow modes threw on
  //  entry; GATE TRAILER's PAGE row now loads this file in node and calls them)
  function buildRig() {
    const T = THREE_, g = new T.Group(); g.name = 'drive:car'; g.matrixAutoUpdate = false;
    const pm = k => (typeof propMesh === 'function' ? propMesh(T, k) : new T.Group());
    const own = carCtx && carCtx.mesh;
    if (own) {
      // A GARAGE CAR (useCar): its own drawn mesh in the sheet's body frame (x forward, y up, z right, the origin the sheet's -
      // car_sheet.js measures the drawing into that frame); meshMatrix places it there when the drawing's frame differs.
      // Its wheels: its own per-wheel meshes (wheels: { <sheet wheel id>: Object3D }, each about the wheel's centre) turn and
      // steer; without them the drawn wheels stay part of the body (they do not spin - the MVP)
      if (carCtx.meshMatrix) { own.matrixAutoUpdate = false; own.matrix.copy(carCtx.meshMatrix); }
      g.add(own);
      const wheels = def.wheels.map(w => { const o = new T.Group(); o.rotation.order = 'YXZ'; const m = carCtx.wheels && carCtx.wheels[w.id]; if (m) o.add(m); g.add(o); return o; });
      return { g, wheels, lamps: {}, M: new T.Matrix4(), a: new T.Vector3(), b: new T.Vector3(), c: new T.Vector3() };
    }
    g.add(pm('car_conquer_body'));
    const lamps = {};
    for (const k of ['head', 'brake', 'reverse']) { const L = sheet.lamps && sheet.lamps[k]; if (!L || !L.prop) continue; lamps[k] = pm(L.prop); g.add(lamps[k]); }
    const wheels = def.wheels.map(w => {
      const W = sheet.wheels[w.id], o = new T.Group(); o.rotation.order = 'YXZ';
      o.add(pm(W.prop || (W.side === 'left' ? 'car_conquer_wheel_l' : 'car_conquer_wheel_r')));
      g.add(o); return o;
    });
    return { g, wheels, lamps, M: new T.Matrix4(), a: new T.Vector3(), b: new T.Vector3(), c: new T.Vector3() };
  }
  function poseRig() {
    if (!rig || !car) return;
    const A = car.axes(), o = car.toWorld([0, 0, 0]);
    rig.a.set(A.fwd[0], A.fwd[1], A.fwd[2]); rig.b.set(A.up[0], A.up[1], A.up[2]); rig.c.set(A.right[0], A.right[1], A.right[2]);
    rig.g.matrix.makeBasis(rig.a, rig.b, rig.c).setPosition(o[0], o[1], o[2]); rig.g.matrixWorldNeedsUpdate = true;
    def.wheels.forEach((w, i) => {
      const S = car.wheels[i], o2 = rig.wheels[i];
      o2.position.set(w.at[0], w.at[1] + w.bump - S.s, w.at[2]);
      o2.rotation.y = -S.delta; o2.rotation.z = -S.spin;   // + steer = right (toward +z); rolling forward = the top going forward
    });
    if (rig.lamps.brake) rig.lamps.brake.visible = car.ctl.brake > 0.05;
    if (rig.lamps.reverse) rig.lamps.reverse.visible = car.ctl.gear < 0;
  }
  // the place nearest a point (the From the top bar says)
  function placeNear(x, z, maxD) {
    let best = null, bd = maxD || 400;
    for (const id in G.places) { const p = G.places[id]; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }
  const placeName = id => (G && G.places[id] && G.places[id].name) || id;

  // ---- THE CAR IN USE (13 Nov, the user's "put the car in the garage, roll out, pick a destination, drive there"): the
  //      stock Conquer '89 pickup unless the caller hands one - ctx.sheet (a car sheet: tools/car_sheet.js's, the shell's
  //      format - src/cars/car_*.json) or ctx.sheetUrl, and ctx.mesh (its drawing, THREE.Object3D in the sheet's body frame;
  //      ctx.meshMatrix, ctx.wheels, ctx.name optional). A new car drops the old one's rig; the same car keeps it ----
  // THE STOCK CAR IS THE VAN (the user, 15 Nov: "the van is the default, with the dark blue livery"; A0: "the van is the
  // default and the tow car ... the Conquer pickup stays selectable"): with no car handed (the drive, the line tow, the
  // trailer tow), the garage-built Field Wagon in its Retro livery drives - its sheet src/cars/car_utility.json
  // (tools/car_sheet.js, measured off this very build) and its body CAPTURED by parked.js (PARKED.capture: the garage
  // editor's round trip, the build's own livery block, kept in its record for the session) and fitted into the sheet's
  // frame by its box: the long axis along +x, the front the end whose top is lower (the bonnet, not the roof), the
  // front bumper on the sheet's box front, the tyres' bottom on y = 0, centred across; rotations only (never a mirror:
  // the plate and the lettering read). Its drawn wheels stay part of the body (the garage car's MVP: they do not spin).
  // ctx.stock 'pickup' (or no PARKED / no editor - node, a gate) drives the Conquer as before.
  const VAN = { sheetUrl: 'src/cars/car_utility.json', build: 'builds/vehicles/utility_retro_2026-11.json', key: 'car:utility_retro_2026-11', name: 'Field Wagon (TOW 3)' };
  let vanSrc = null;                       // { sheet, rec } once captured; false once refused (the pickup then)
  async function stockVan() {
    if (vanSrc !== null) return vanSrc || null;
    const P = window.PARKED;
    if (!P || typeof P.capture !== 'function' || typeof P.build !== 'function' || !THREE_) return null;
    try {
      const [sh, env] = await Promise.all([VAN.sheetUrl, VAN.build].map(u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ': ' + r.status); return r.json(); })));
      const spec = env && env.spec ? env.spec : env;
      const rec = P.capture(VAN.key, spec);
      if (!rec) throw new Error('the capture refused (no editor on this page)');
      vanSrc = { sheet: sh, rec };
    } catch (e) { console.warn('drive: the stock van is not available - the pickup drives:', e && e.message); vanSrc = false; }
    return vanSrc || null;
  }
  // the captured body, a fresh holder per car (the drive owns what it is given), in the sheet's frame
  function vanMesh(src) {
    const T = THREE_, P = window.PARKED, rec = src.rec, inner = new T.Group(); inner.name = 'drive:van';
    // THE WHEELS APART (16 Nov, the user: "make the wheels spin"): parked.js merges a record's buckets per material, so a
    // drawn wheel would be welded into the body. The record's WHEEL PARTS (the join gives each of a car's four wheels its
    // own, about its own axle) are left out of the body - a copy of the record under its own key (its own cut and bake) -
    // and each is drawn on its own (PARKED.levelMeshes) in the frame build() stands the body in (the stance's pitch and
    // lift, the nose turned to +x), the tyres on CAGE_WHEELTEX's material, the rest plain in the record's colour
    const isW = q => /^mains|^tw$/.test(q.kind || '') && q.pivot && !q.stretch;
    const wParts = (rec.vis && rec.vis.parts || []).filter(isW);
    const st = rec.stance || (rec.stance = P.stance(rec.vis));
    if (wParts.length && !src.body) {
      const vis = Object.assign({}, rec.vis, { parts: rec.vis.parts.filter(q => !isW(q)) });
      let tris = 0; for (const k in vis.groups) tris += vis.groups[k].idx.length / 3; for (const q of vis.parts) for (const k in q.groups) tris += q.groups[k].idx.length / 3;
      src.body = { key: rec.key + ':body', spec: rec.spec, vis, block: rec.block, atlas: rec.atlas, panel: rec.panel, t: rec.t, far: null, tris, stance: st, geos: rec.geos };
    }
    P.build(T, src.body || rec, inner);
    const parts = [];
    if (src.body) {
      const mats = rec.vis.mats, pool = src.wheelMats || (src.wheelMats = {});
      const matFor = k => { if (pool[k]) return pool[k]; const m = mats[k] || {};
        const tm = m.tyreTex && window.CAGE_WHEELTEX ? window.CAGE_WHEELTEX.material(m.tyreTex) : null;
        return pool[k] = tm || new T.MeshStandardMaterial({ userData: { progOwner: 'vehicles / car wheels / plain fallback' }, color: m.color !== undefined ? m.color : 0x333333, metalness: m.metal !== undefined ? m.metal : 0.4, roughness: m.rough !== undefined ? m.rough : 0.5 }); };
      matFor.tint = m0 => m0;
      for (const q of wParts) {
        const lv = P.levelMeshes(T, { vis: { groups: {}, parts: [q], mats }, geos: rec.geos || (rec.geos = new Map()) }, matFor, false);
        const fr = new T.Group(); fr.rotation.z = st.pitch; fr.position.y = st.lift; fr.add(lv);
        const flip = new T.Group(); flip.rotation.y = Math.PI; flip.add(fr); inner.add(flip);
        const list = []; lv.traverse(o => { if (o.isMesh) list.push(o); }); parts.push(list);
      }
    }
    inner.updateMatrixWorld(true);
    // the vertices' extent, sampled (the LOD's near rung only: the same shape at every rung)
    const v = new T.Vector3(), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], pts = [];
    inner.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      for (let a = o; a && a !== inner; a = a.parent) if (a.isLOD) { if (a.levels && a.levels[0] && !isAncestor(a.levels[0].object, o)) return; break; }
      const A = o.geometry.attributes.position, step = Math.max(1, Math.floor(A.count / 4000));
      for (let i = 0; i < A.count; i += step) { v.fromBufferAttribute(A, i).applyMatrix4(o.matrixWorld);
        lo[0] = Math.min(lo[0], v.x); lo[1] = Math.min(lo[1], v.y); lo[2] = Math.min(lo[2], v.z);
        hi[0] = Math.max(hi[0], v.x); hi[1] = Math.max(hi[1], v.y); hi[2] = Math.max(hi[2], v.z); pts.push(v.x, v.y, v.z); }
    });
    const ax = (hi[2] - lo[2]) > (hi[0] - lo[0]) ? 2 : 0, lat = 2 - ax;
    // the front: the end whose top (within 0.4 m of it) is lower
    let topLo = -Infinity, topHi = -Infinity;
    for (let i = 0; i < pts.length; i += 3) { const a = pts[i + ax], y = pts[i + 1];
      if (a < lo[ax] + 0.4) topLo = Math.max(topLo, y); if (a > hi[ax] - 0.4) topHi = Math.max(topHi, y); }
    const fwdPlus = topHi < topLo;          // the front at the axis's + end
    // the rotation about y taking the front onto +x: +z -> +x is +90 deg, -z -> -90, +x 0, -x 180
    const yaw = ax === 2 ? (fwdPlus ? Math.PI / 2 : -Math.PI / 2) : (fwdPlus ? 0 : Math.PI);
    const front = fwdPlus ? hi[ax] : lo[ax], mid = (lo[lat] + hi[lat]) / 2;
    const rot = new T.Group(); rot.rotation.y = yaw; rot.add(inner);
    // move the body so its front is at the origin, its middle on the centreline and its tyres on the ground (before the yaw)
    inner.position.set(ax === 0 ? -front : -mid, -lo[1], ax === 2 ? -front : -mid);
    const holder = new T.Group(); holder.name = 'drive:stockVan';
    holder.position.x = src.sheet.box && src.sheet.box.hi ? src.sheet.box.hi[0] : 0;
    holder.add(rot);
    // THE WHEELS SPIN (16 Nov, the user: "make the wheels spin"): the record's wheel parts (the join gives each of a car's
    // four wheels its own part about its own axle - _cage_join.js's nearest-contact rule) are drawn by parked.js at their
    // pivots; they leave the body and become the rig's wheels, each about its hub in the sheet's frame (its axle on z:
    // the rig spins it about z and steers it about y), matched to the sheet's nearest wheel
    holder.updateMatrixWorld(true);
    // LEVEL ON THE HUBS: parked.js stood the record as an aeroplane (its resting pitch off the mains and a third wheel) -
    // the van came out ~1.8 deg nose-up (the front hubs 10 cm over the sheet's). Turned about z so the front and rear
    // hubs lie as the sheet's do, then lifted so the rear hubs sit at the sheet's rear axle height
    if (parts.length >= 2 && src.sheet.wheels) {
      const hubOf = list => { const v = new T.Vector3(); list[0].getWorldPosition(v); return v; };
      const avg = (L, f) => L.reduce((a, q) => a + f(q), 0) / L.length;
      let H = parts.map(hubOf); const xMax = Math.max(...H.map(h => h.x)), xMin = Math.min(...H.map(h => h.x));
      const SW = Object.values(src.sheet.wheels).map(w => w.centre), sMax = Math.max(...SW.map(c => c[0])), sMin = Math.min(...SW.map(c => c[0]));
      const SF = SW.filter(c => c[0] > sMax - 0.3), SR = SW.filter(c => c[0] < sMin + 0.3);
      const want = Math.atan2(avg(SF, c => c[1]) - avg(SR, c => c[1]), avg(SF, c => c[0]) - avg(SR, c => c[0]));
      const F = H.filter(h => h.x > xMax - 0.3), R = H.filter(h => h.x < xMin + 0.3);
      const have = Math.atan2(avg(F, h => h.y) - avg(R, h => h.y), avg(F, h => h.x) - avg(R, h => h.x));
      holder.rotation.z = want - have; holder.updateMatrixWorld(true);
      H = parts.map(hubOf); const R2 = H.filter(h => h.x < Math.min(...H.map(q => q.x)) + 0.3);
      holder.position.y += avg(SR, c => c[1]) - avg(R2, h => h.y); holder.updateMatrixWorld(true);
    }
    // (the holder has no parent yet: its WORLD frame is the sheet's - the rig hangs the holder in the sheet's frame as is)
    const wheels = {}, inv = new T.Matrix4(), hubW = new T.Vector3(), hubs = [];
    const ids = Object.keys(src.sheet.wheels || {});
    for (const list of parts) {
      list[0].getWorldPosition(hubW); const hub = hubW.clone().applyMatrix4(inv); hubs.push([hub.x, hub.y, hub.z].map(v => +v.toFixed(2)));
      let best = null, bd = 0.6;                     // (a wheel's hub within 0.6 m of a sheet wheel's centre)
      for (const id of ids) { const c = src.sheet.wheels[id].centre; const d = Math.hypot(c[0] - hub.x, c[1] - hub.y, c[2] - hub.z); if (d < bd) { bd = d; best = id; } }
      if (!best || wheels[best]) continue;
      const w = new T.Group(); w.name = 'drive:vanWheel' + best;
      for (const o of list) {
        const M = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld), pos = new T.Vector3(), q = new T.Quaternion(), sc = new T.Vector3();
        M.decompose(pos, q, sc);
        o.parent.remove(o); o.position.set(0, 0, 0); o.quaternion.copy(q); o.scale.copy(sc); o.updateMatrix();
        w.add(o);
      }
      wheels[best] = w;
    }
    DM.vanInfo = { parts: parts.length, hubs, matched: Object.keys(wheels) };   // (the page rigs' probe)
    return { mesh: holder, wheels: Object.keys(wheels).length === ids.length ? wheels : null, nWheels: Object.keys(wheels).length };
  }
  function isAncestor(a, o) { for (let q = o; q; q = q.parent) if (q === a) return true; return false; }
  async function useCar(ctx) {
    let sh = ctx.sheet || null;
    if (!sh && ctx.sheetUrl) { const r = await fetch(ctx.sheetUrl); if (!r.ok) throw new Error('the car sheet ' + ctx.sheetUrl + ': ' + r.status); sh = await r.json(); }
    // no car handed: THE VAN (its sheet + its captured body); the pickup when asked for, or when the van cannot be had
    if (!sh && ctx.stock !== 'pickup') {
      const V = await stockVan();
      if (V) {
        if (sheet === V.sheet && carCtx && carCtx.van) return;   // the van already: its def and rig stand
        if (rig && rig.g.parent) rig.g.parent.remove(rig.g);
        const vm = vanMesh(V);
        if (!vm.wheels) console.warn('drive: the van\'s wheels found ' + vm.nWheels + ' of 4 - they stay in the body (no spin)');
        rig = null; sheet = V.sheet; carCtx = { mesh: vm.mesh, meshMatrix: null, wheels: vm.wheels, van: true }; def = vehicleDef(sheet, sheet.tune);
        DM.name = ctx.name || VAN.name;
        return;
      }
    }
    if (!sh) { if (!stockSheet) { const r = await fetch(SHEET_URL); if (!r.ok) throw new Error('the car sheet: ' + r.status); stockSheet = await r.json(); } sh = stockSheet; }
    const next = sh === stockSheet ? null : { mesh: ctx.mesh || null, meshMatrix: ctx.meshMatrix || null, wheels: ctx.wheels || null };
    if (sh === sheet && (next ? !!carCtx && carCtx.mesh === next.mesh : !carCtx)) return;   // the same car: its def and rig stand
    if (rig && rig.g.parent) rig.g.parent.remove(rig.g);
    rig = null; sheet = sh; carCtx = next; def = vehicleDef(sheet);
    DM.name = ctx.name || sheet.name || (next ? 'the car' : "Conquer '89 pickup");
  }
  DM.useCar = useCar;

  // ---- THE START CHOOSER'S LISTS (13 Nov, the user's sandbox "Drive": a start and a destination, the car driven from one to
  //      the other - app.js FLYDIY_START): the places a car can stand at on the island's main road network (HOME's, as the
  //      drive mode's own graph from HOME), and from any one of them the places its roads reach. One graph a world, built on
  //      the first ask (~0.2-1.5 s, the drive mode's own build); no car, nothing in the scene ----
  const LG = { world: null, G: null };
  function listGraph(world) {
    if (LG.world === world && LG.G) return LG.G;
    const H = typeof siteOf === 'function' ? siteOf('HOME') : null, st = H && H.stand;
    const I = vehIslandFromWorld(world, { siteOf: typeof siteOf === 'function' ? siteOf : null, fieldName: typeof fieldName === 'function' ? fieldName : null,
      town: { id: TOWN.id, site: TOWN.site, name: (typeof GAME_NAMES !== 'undefined' && GAME_NAMES.town) || 'the town' }, from: st ? [st.x, st.z] : null,
      sites: CAR_SITES, landOnly: true });
    if (!I) throw new Error('no roads in this world (the premises carry the road graph)');
    LG.world = world; LG.G = vehRoadGraph(I.spec);
    return LG.G;
  }
  // [{ id, name, x, y, z, what }] - a car's places (no runway ends: those are the tow's and the trailer's)
  DM.placeList = function (world) {
    const G1 = listGraph(world);
    return Object.values(G1.places).filter(p => p.kind === 'stop' && p.what !== 'runway').sort((a, b) => a.name.localeCompare(b.name))
      .map(p => ({ id: p.id, name: p.name, x: p.x, y: world.terrainH(p.x, p.z), z: p.z, what: p.what }));
  };
  // the place ids a car standing at `id` can drive to (either way it faces: two passes, as the To picker's)
  DM.reachFrom = function (world, id) {
    const G1 = listGraph(world), P = G1.places[id]; if (!P) return new Set();
    const L = vehGraphLocate(G1, P.x, P.z, 0), A = vehDijkstra(G1, L.ahead, null), B = vehDijkstra(G1, L.behind, null), out = new Set();
    for (const q of Object.values(G1.places)) if (q.kind === 'stop' && q.what !== 'runway' && q.id !== id && (A.dist[q.node] < Infinity || B.dist[q.node] < Infinity)) out.add(q.id);
    return out;
  };

  // ---- THE GRAPH: the island's roads (vehicle_island.js) and the places a vehicle can be sent to ----
  // (the graph: vehicle_island.js vehIslandFromWorld - the gate's recipe: the roads, the runways and their taxi routes, the
  //  stands' links, the steep stretches closed; buildGraph was this file's own until phase 2)
  DM.enter = async function (ctx) {
    THREE_ = ctx.THREE; scene_ = ctx.scene; world_ = ctx.world;
    await useCar(ctx);
    const t0 = performance.now();
    const at = ctx.at || [0, 0, 0];
    const I = vehIslandFromWorld(world_, { siteOf: typeof siteOf === 'function' ? siteOf : null, fieldName: typeof fieldName === 'function' ? fieldName : null,
      town: { id: TOWN.id, site: TOWN.site, name: (typeof GAME_NAMES !== 'undefined' && GAME_NAMES.town) || 'the town' }, from: [at[0], at[2]],
      sites: CAR_SITES, landOnly: true });
    if (!I) throw new Error('no roads in this world (the premises carry the road graph)');
    rep = I.report;
    G = vehRoadGraph(I.spec);
    DM.graphMs = performance.now() - t0;
    start = placeNear(at[0], at[2], 1e9);
    if (!start) throw new Error('no place on the roads');
    car = makeVehicle(def, world_);
    if (!rig) rig = buildRig(); if (!rig.g.parent) scene_.add(rig.g);
    DM.on = true; DM.paused = false;
    // (CAR, 13 Nov: with no To asked and no town at this budget the car waits at its start for the player's pick - it
    // drove to its own stand, round the block, before)
    const to0 = ctx.to && G.places[ctx.to] ? ctx.to : (G.places[TOWN.id] ? TOWN.id : null);
    place(start, to0);
    if (to0) DM.setDest(to0);
    DM.loop = ctx.loop && to0 && to0 !== start.id ? { back: start.id } : null;   // (the start chooser's LOOP: out to `to`, then back here)
    return true;
  };
  // (the car stands facing the way its route leaves: a trip sets off without a U-turn - vehFaceToward)
  function place(P, to) {
    const h0 = Math.atan2(P.dz, P.dx);
    car.place(P.x, P.z, to ? vehFaceToward(G, P.x, P.z, h0, to) : h0);
    for (let i = 0; i < 30; i++) car.step(1 / 60);
    D = makeDriver(car, G, { vCruise: 20 });
    odo = 0; last = car.refPoint(); track = [[last[0], last[2]]];
    DM.from = P.id; DM.to = null;
    poseRig();
  }
  DM.leave = function () {
    if (rig && rig.g.parent) rig.g.parent.remove(rig.g);
    DM.on = false; hudRestore();
  };
  DM.restart = function () { const to = DM.to; place(start, to); DM.setDest(to); };
  DM.setDest = function (id) {
    if (!D || !G.places[id]) return 'none';
    const p = car.refPoint(), here = placeNear(p[0], p[2], 150);
    if (here && here.id !== id) DM.from = here.id;
    const t = performance.now(), r = D.setDest(id);
    DM.planMs = performance.now() - t;
    if (r !== 'none') DM.to = id;
    return r;
  };
  // (the town is ON by default; it is not built at the laptop / potato budgets nor under software rendering (G590, G1526:
  // gfx_settings townAll, world_boot.js's TOWN) and its streets go with it - its place is then listed, greyed, saying so)
  DM.choices = () => {
    if (!G) return [];
    // (a place the car cannot reach from where it stands - a closed steep stretch, a network of its own - greyed, saying so)
    let reach = null;
    try { const p = car.refPoint(), Lc = vehGraphLocate(G, p[0], p[2], car.heading()), D1 = vehDijkstra(G, Lc.ahead, null), D2 = vehDijkstra(G, Lc.behind, null); reach = n => D1.dist[n] < Infinity || D2.dist[n] < Infinity; } catch (e) {}
    // (a car's list: the fields' stands, the town, the car's own places - the runway ends only while a tow is on: those are
    //  the tow's and the trailer's; the user, 13 Nov: "the list of reachable destinations differs for a car")
    const L = Object.values(G.places).filter(p => p.kind === 'stop' && (p.what !== 'runway' || (DM.tow && DM.tow.active))).sort((a, b) => a.name.localeCompare(b.name))
      .map(p => (!reach || reach(p.node) ? { id: p.id, label: p.name, ok: true } : { id: p.id, label: p.name + ' - no drivable road there', ok: false }));
    if (!G.places[TOWN.id] && window.FLYDIY_TOWN && !window.FLYDIY_TOWN.all)
      L.push({ id: TOWN.id, label: ((typeof GAME_NAMES !== 'undefined' && GAME_NAMES.town) || 'the town') + ' - not built at this graphics budget', ok: false });
    return L;
  };

  // ---- THE FRAME (app.js's loop, after the aeroplane's block): the steps the real time owes, each 1/60 s ----
  DM.frame = function (steps) {
    if (!DM.on || !car) return;
    if (!DM.paused && !window.FLYDIY_HELD) {
      const t = performance.now();
      for (let k = 0; k < (steps | 0); k++) { D.step(1 / 60); car.step(1 / 60); }
      DM.ms += ((performance.now() - t) - DM.ms) * 0.05;
      const q = car.refPoint(); odo += Math.hypot(q[0] - last[0], q[2] - last[2]); last = q;
      const L = track[track.length - 1]; if (Math.hypot(q[0] - L[0], q[2] - L[1]) > 15) track.push([q[0], q[2]]);
      // (a LOOP - the start chooser's "out and back": arrived at the turning place, the start is the next To, once)
      if (DM.loop && D.phase === 'ARRIVED' && DM.to !== DM.loop.back) { const back = DM.loop.back; DM.loop = null; DM.setDest(back); }
    }
    poseRig();
  };
  DM.target = () => { const c = car.toWorld(def.cg); return [c[0], c[1] + 0.6, c[2]]; };
  // (CAR, 13 Nov: a probe for the page rigs - the rig's meshes, its place in the world, the camera's target)
  DM.rigInfo = () => { if (!rig) return null; let n = 0; rig.g.traverse(o => { if (o.isMesh) n++; }); const e = rig.g.matrix.elements;
    return { meshes: n, wheels: rig.wheels.length, inScene: !!rig.g.parent, at: [e[12], e[13], e[14]].map(v => +v.toFixed(2)), target: DM.target().map(v => +v.toFixed(2)), cg: def && def.cg, garageCar: !!carCtx }; };
  DM.tailAxis = () => { const f = car.axes().fwd; return [-f[0], -f[1], -f[2]]; };
  DM.upAxis = () => [0, 1, 0];

  // ---- THE WORDS: the status line (the TAXI card's way), the phase, the distance to go ----
  function legLeft() {
    if (!D || !D.leg || !D.leg.poly) return null;
    const P = D.leg.poly, p = car.refPoint();
    let bi = 0, bd = Infinity;
    for (let k = 0; k + 1 < P.length; k++) { const a = P[k], b = P[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1e-9; let f = ((p[0] - a[0]) * dx + (p[2] - a[1]) * dz) / l2; f = f < 0 ? 0 : f > 1 ? 1 : f; const d = Math.hypot(a[0] + dx * f - p[0], a[1] + dz * f - p[2]); if (d < bd) { bd = d; bi = k; } }
    let s = Math.hypot(P[bi + 1][0] - p[0], P[bi + 1][1] - p[2]);
    for (let k = bi + 1; k + 1 < P.length; k++) s += Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]);
    return s;
  }
  DM.words = function () {
    const ph = D ? D.phase : 'IDLE', to = placeName(DM.to), left = legLeft(), M = D && D.man;
    const km = v => (v >= 1000 ? (v / 1000).toFixed(1) + ' km' : Math.round(v) + ' m');
    if (ph === 'DRIVE' && D.leg && D.leg.then === 'manoeuvre' && M) return { phase: 'DRIVING', line: 'driving to a U-turn at ' + (M.apron && G.turns && G.turns[M.apron] ? G.turns[M.apron].name : 'the apron') + ' (' + M.plan.family + ') - ' + (left != null ? km(left) : '') + ', then ' + to, left };
    if (ph === 'DRIVE') return { phase: 'DRIVING', line: 'following the road to ' + to + (left != null ? ' - ' + km(left) + ' to go' : ''), left };
    if (ph === 'MANOEUVRE' && M) return { phase: 'U-TURN', line: 'U-turn (' + M.plan.family + '): move ' + (D.manI + 1) + ' of ' + M.paths.length + (M.paths[D.manI] && M.paths[D.manI].dir < 0 ? ', reversing' : ', forward') + ' - then ' + to, left: null };
    if (ph === 'ARRIVED') return { phase: 'ARRIVED', line: 'arrived at ' + to + ' - pick a new To to drive on', left: 0 };
    if (ph === 'STUCK') return { phase: 'STUCK', line: 'stuck: not moving for 20 s on the throttle - Restart, or a new To', left: null };
    const lg = D && D.log.length ? D.log[D.log.length - 1].msg : 'parked at ' + placeName(DM.from) + ' - pick a destination (the To)';
    return { phase: 'PARKED', line: lg, left: null };
  };
  DM.trip = () => placeName(DM.from) + ' → ' + (DM.to ? placeName(DM.to) : 'pick a To');

  // ---- THE HUD CARD: the flight's own cells, three of them re-labelled; the rest hidden while driving ----
  const KEEP = ['ias', 'alt', 'vs'];
  function hudTake() {
    if (hudSaved) return;
    hudSaved = { cells: [], labels: [] };
    for (const c of document.querySelectorAll('#pfdRow .rd')) { hudSaved.cells.push([c, c.hidden]); if (KEEP.indexOf(c.dataset.i) < 0) c.hidden = true; else c.hidden = false; }
    for (const k of KEEP) { const c = document.querySelector('#pfdRow .rd[data-i="' + k + '"] i'); if (c) hudSaved.labels.push([c, c.textContent]); }
    const lab = (k, t) => { const c = document.querySelector('#pfdRow .rd[data-i="' + k + '"] i'); if (c) c.textContent = t; };
    lab('ias', 'km/h'); lab('alt', 'km to go'); lab('vs', 'gear');
    document.body.classList.add('fl2Ap');   // the status line shown (FL2 shows #phWhy only with it)
  }
  function hudRestore() {
    if (!hudSaved) return;
    for (const [c, h] of hudSaved.cells) c.hidden = h;
    for (const [c, t] of hudSaved.labels) c.textContent = t;
    hudSaved = null;
  }
  DM.hud = function () {
    if (!DM.on || !car) return;
    hudTake();
    const W = DM.words(), set = (id, v) => { const e = $(id); if (e && e.textContent !== v) e.textContent = v; };
    set('r-ias', String(Math.round(Math.abs(car.out.u) * 3.6)));
    set('r-alt', W.left == null ? '-' : (W.left / 1000).toFixed(W.left >= 10000 ? 0 : 1));
    set('r-vs', car.ctl.gear < 0 ? 'R' : (car.out.u < 0.05 && car.ctl.brake > 0.5 ? 'P' : 'D'));
    set('phName', W.phase);
    set('phNext', W.line);
    set('phPlan', DM.trip() + (DM.paused || window.FLYDIY_HELD ? ' · paused' : ''));
    const rail = $('rail'); if (rail) rail.classList.toggle('held', W.phase !== 'DRIVING' && W.phase !== 'U-TURN');
  };

  // ---- THE MINIMAP: the road ahead (the leg's line, the U-turn's moves), the way come, the To ----
  DM.drawOnMap = function (g, PX, PY, mk, W2, labPut) {
    if (!DM.on || !D) return;
    const line = (pts, col, w, dash) => { if (!pts || pts.length < 2) return; g.beginPath(); g.moveTo(PX(pts[0][0], pts[0][1]), PY(pts[0][0], pts[0][1])); for (let i = 1; i < pts.length; i++) g.lineTo(PX(pts[i][0], pts[i][1]), PY(pts[i][0], pts[i][1])); g.strokeStyle = col; g.lineWidth = w * mk; g.setLineDash(dash ? dash.map(v => v * mk) : []); g.stroke(); g.setLineDash([]); };
    line(track.concat([[last[0], last[2]]]), 'rgba(251,244,234,.45)', 2);
    if (D.leg && D.leg.poly) line(D.leg.poly, '#ffb257', 2.6);
    if (D.man && D.man.paths) for (const p of D.man.paths) line(p.pts.map(q => [q.x, q.z]), '#ff7a59', 2);
    const P = DM.to && G.places[DM.to];
    if (P) {
      const sx = PX(P.x, P.z), sy = PY(P.x, P.z);
      g.beginPath(); g.arc(sx, sy, 5 * mk, 0, 6.283); g.fillStyle = '#ffb257'; g.fill();
      g.strokeStyle = 'rgba(255,178,87,.5)'; g.lineWidth = 1.5 * mk; g.beginPath(); g.arc(sx, sy, 9 * mk, 0, 6.283); g.stroke();
      if (labPut) labPut(sx, sy, P.name, 'rgba(20,14,8,.75)', '#ffd9a3');
    }
  };
  // THE DEV'S FAST-FORWARD (a rig's stills along a 20-minute drive): `sec` of driving stepped now, at the solver's 1/60 s
  // (~0.1 ms a step: a minute in ~0.4 s); stops at an arrival
  DM.ahead = function (sec) {
    if (!DM.on || !car) return null;
    for (let k = 0; k < Math.round(sec * 60) && D.phase !== 'ARRIVED' && D.phase !== 'STUCK'; k++) {
      D.step(1 / 60); car.step(1 / 60);
      const q = car.refPoint(); odo += Math.hypot(q[0] - last[0], q[2] - last[2]); last = q;
      const L = track[track.length - 1]; if (Math.hypot(q[0] - L[0], q[2] - L[1]) > 15) track.push([q[0], q[2]]);
    }
    poseRig();
    return { phase: D.phase, odo: Math.round(odo), t: +car.st.t.toFixed(1) };
  };
  // ---- THE GLIDER TOW (TOW-LAUNCH phase 3): the car as the GLIDER'S TOW, not the player's vehicle - the flight's UI
  //      stays the aeroplane's; the car and the line are actors (tow.js). The user: "when you select something without an
  //      engine ... we start at the start line with the cable and the car". app.js's TOW switch calls these:
  //      towStart(ctx) once the glider is lined up; towPre() / towPost(dt) round every 1/60 s step of the aeroplane (the
  //      line's coupling); towDraw() a frame; towStop(). The flight is inline then (sim_link.js: the line acts in the
  //      solver's substeps) - its cost: GATE TOW's +1.0 ms on the glider's frame, the car's 0.1 ms ----
  const TW = DM.tow = { active: false, kind: null, line: null, car: null, D: null, rig: null, rope: null, L0: 400, Vtow: 28, why: null, launch: null, model: null, hitch: null };
  DM.towStart = async function (ctx) {
    TW.kind = 'line';
    THREE_ = ctx.THREE; scene_ = ctx.scene; world_ = ctx.world;
    await useCar(ctx);
    const sim = ctx.sim, cg = sim.cgPos();
    if (!G) {
      const I = vehIslandFromWorld(world_, { siteOf: typeof siteOf === 'function' ? siteOf : null, fieldName: typeof fieldName === 'function' ? fieldName : null, town: null, from: [cg[0], cg[2]] });
      if (!I) throw new Error('no roads in this world');
      rep = I.report; G = vehRoadGraph(I.spec);
    }
    // the runway the glider stands on, and its end AHEAD of the nose: the car's destination
    const xA = sim.axes()[0], fx = -xA[0], fz = -xA[2], fl = Math.hypot(fx, fz) || 1, dx = fx / fl, dz = fz / fl;
    let to = null, best = -Infinity;
    for (const id in G.places) { const P = G.places[id]; if (P.what !== 'runway') continue; const a = (P.x - cg[0]) * dx + (P.z - cg[2]) * dz, side = Math.abs(-(P.x - cg[0]) * dz + (P.z - cg[2]) * dx);
      if (a > TW.L0 + 200 && side < 60 && a > best) { best = a; to = id; } }
    if (!to) throw new Error('no runway end ahead of the glider (' + TW.L0 + ' m of line and the car\'s run needed)');
    const hook = towHookNodes(sim); let hx = 0, hz = 0; for (const i of hook) { hx += sim.p[i * 3] / hook.length; hz += sim.p[i * 3 + 2] / hook.length; }
    const car1 = makeVehicle(def, world_), rear = def.foot.rear;
    car1.place(hx + dx * (TW.L0 - 2 + rear), hz + dz * (TW.L0 - 2 + rear), Math.atan2(dz, dx)); for (let i = 0; i < 30; i++) car1.step(1 / 60);
    car = car1;                                   // (the rig poses `car`: the tow's car is the one drawn)
    TW.car = car1; TW.D = makeDriver(car1, G, { vCruise: TW.Vtow }); TW.to = to; TW.go = false;
    TW.line = makeTowLine(sim, car1, { L0: TW.L0, hook, groundAt: (x, z) => world_.terrainH(x, z) });
    if (!rig) { rig = buildRig(); } if (!rig.g.parent) scene_.add(rig.g);
    const T = THREE_, gm = new T.BufferGeometry(); gm.setAttribute('position', new T.BufferAttribute(new Float32Array(25 * 3), 3));
    TW.rope = new T.Line(gm, new T.LineBasicMaterial({ userData: { progOwner: 'vehicles / tow car / rope line' }, color: 0xf2e6c8 })); TW.rope.frustumCulled = false; scene_.add(TW.rope);
    // (15 Nov: the rope's end - the Tost ring pair in the CG release's jaw, the rope spliced to it: tow.js towRingRig; a page
    //  with an older tow.js draws the rope from the hook as before)
    if (typeof towRingRig === 'function') { TW.rings = towRingRig(T); scene_.add(TW.rings.group); }
    TW.sim = sim; TW.active = true; TW.why = null; TW.t = 0;
    // (?towhands=1: the gate's hands fly the glider - a rig's, a player without a stick's; the player flies otherwise)
    // (ctx.hands: the autopilot flies the launch - app.js's LAUNCH; ?towhands=1 the rig's)
    TW.hands = ctx.hands || /[?&]towhands=1/.test(location.search || '') ? makeTowHands(sim, { ground: world_.terrainH(cg[0], cg[2]) }) : null;
    poseRig();
    return to;
  };
  // the car sets off: the first step the aeroplane flies with the player's hands on (app.js calls it when the run starts)
  TW.start = () => { if (TW.active && !TW.go) { TW.go = true; TW.D.setDest(TW.to); } };
  // ---- THE LAUNCH TRAILER (TOW-LAUNCH phase 4): a float or hull build on the trailer behind the car, at the end of the
  //      runway nearest it (the user's default: Jolene AFB 13/31), the car to the far end. trailer.js's rig (the fit, the
  //      trailer behind the ball, the cradle on the keel nodes, the latch); trailer_model.js's trailer drawn; the car's ball
  //      mount on its rig. The same hooks as the line's (towPre / towPost / towDraw / towWords / towStop): app.js's TOW
  //      switch calls trailerStart instead of towStart. Its costs a frame: the cradle's pads in the solver's substeps
  //      (GATE TRAILER's PERF), the trailer's pose and loads ~2 us, the car 0.1 ms, the model's 14 draw calls ----
  DM.trailerStart = async function (ctx) {
    THREE_ = ctx.THREE; scene_ = ctx.scene; world_ = ctx.world;
    await useCar(ctx);
    const sim = ctx.sim, cg0 = sim.cgPos();
    if (!G) {
      const I = vehIslandFromWorld(world_, { siteOf: typeof siteOf === 'function' ? siteOf : null, fieldName: typeof fieldName === 'function' ? fieldName : null, town: null, from: [cg0[0], cg0[2]] });
      if (!I) throw new Error('no roads in this world');
      rep = I.report; G = vehRoadGraph(I.spec);
    }
    // the runway: HOME's (Jolene AFB 13/31 - the user's choice, 12 Nov: "no grass strip"), its end nearest the aeroplane;
    // an island without one, the nearest runway end; the far end the car's destination
    let P0 = null, bd = Infinity;
    for (const pass of [/:HOME:/, /./]) {
      for (const id in G.places) { const P = G.places[id]; if (P.what !== 'runway' || !pass.test(id)) continue; const d = Math.hypot(P.x - cg0[0], P.z - cg0[2]); if (d < bd) { bd = d; P0 = P; } }
      if (P0) break;
    }
    if (!P0) throw new Error('no runway on this island');
    const to = P0.id.replace(/:(\d)$/, (m, k) => ':' + (1 - +k)), P1 = G.places[to];
    if (!P1) throw new Error('the runway\'s far end: ' + to);
    const l = Math.hypot(P1.x - P0.x, P1.z - P0.z), dx = (P1.x - P0.x) / l, dz = (P1.z - P0.z) / l, hdg = Math.atan2(dz, dx);
    const car1 = makeVehicle(def, world_);
    car1.place(P0.x + dx * 14, P0.z + dz * 14, hdg); for (let i = 0; i < 30; i++) car1.step(1 / 60);
    // the aeroplane onto the runway behind it (settled on its keels: the fit reads the build standing), then seated
    const aero = (world_.aerodromes || []).find(a => P0.id.split(':')[1] === a.id) || null;
    sim.reset(0); if (typeof sim.stance === 'function') sim.stance();
    placeAtLineup(sim, aero, { x: P0.x - dx * 6, z: P0.z - dz * 6, hdg }, world_, ctx.def.refs);
    for (let i = 0; i < 90; i++) sim.step(1 / 60);
    if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
    car = car1;
    const L = makeTrailerLaunch(sim, car1, world_, { def: ctx.def });
    TW.kind = 'trailer'; TW.launch = L; TW.car = car1; TW.to = to; TW.go = false; TW.why = null; TW.t = 0; TW.sim = sim;
    TW.D = makeDriver(car1, G, { vCruise: L.vCar });
    TW.model = buildTrailerModel(THREE_, L.trailer); scene_.add(TW.model.group);
    if (!rig) { rig = buildRig(); } if (!rig.g.parent) scene_.add(rig.g);
    TW.hitch = buildTowHitch(THREE_); TW.hitch.position.set(L.trailer.ball[0], L.trailer.ball[1], L.trailer.ball[2]); rig.g.add(TW.hitch);
    TW.hands = ctx.hands || /[?&]towhands=1/.test(location.search || '') ? makeTrailerHands(sim, L) : null;
    TW.active = true;
    TW.model.update(L.trailer, true); poseRig();
    return to;
  };
  DM.towPre = () => {
    if (!TW.active) return;
    if (TW.kind === 'trailer') { TW.launch.before(); if (TW.hands && TW.go) TW.hands(); return; }
    if (TW.line && TW.line.on) TW.line.before(); if (TW.hands && TW.go) TW.hands(TW.line, 1 / 60);
  };
  DM.towPost = (dt) => {
    if (!TW.active) return;
    if (TW.kind === 'trailer') {
      const L = TW.launch; L.after(dt);
      if (TW.go) TW.D.step(dt); else { TW.car.ctl.thr = 0; TW.car.ctl.brake = 1; }
      L.carCtl(TW.car); TW.car.step(dt); L.carAfter(dt); TW.t += dt;
      return;
    }
    if (TW.line) TW.line.after(dt);
    if (TW.go) TW.D.step(dt); else { TW.car.ctl.thr = 0; TW.car.ctl.brake = 1; }
    TW.car.step(dt); TW.t += dt;
  };
  DM.towRelease = () => { if (TW.line && TW.line.on) TW.line.release(); };
  DM.towDraw = () => {
    if (!TW.active) return;
    poseRig();
    if (TW.kind === 'trailer') { TW.model.update(TW.launch.trailer, TW.launch.cradle.latched); return; }
    const A = TW.rope.geometry.attributes.position, L = TW.line;
    if (!L || !L.on) { TW.rope.visible = false; if (TW.rings) TW.rings.group.visible = false; return; }
    TW.rope.visible = true;
    const P = TW.car.toWorld(L.hitch), sim = TW.sim; let hx = 0, hy = 0, hz = 0; for (const i of L.hook) { hx += sim.p[i * 3] / L.hook.length; hy += sim.p[i * 3 + 1] / L.hook.length; hz += sim.p[i * 3 + 2] / L.hook.length; }
    const R0 = TW.rings ? TW.rings.pose([hx, hy, hz], P) : [hx, hy, hz]; if (TW.rings) TW.rings.group.visible = true;   // (the rope from the rings' splice)
    // a sag the line's own weight gives it, less as it pulls (a few metres slack, a few decimetres taut)
    const sag = Math.max(0.3, 6 * (1 - Math.min(1, L.T / 1500)));
    for (let k = 0; k <= 24; k++) { const u = k / 24; A.setXYZ(k, R0[0] + (P[0] - R0[0]) * u, R0[1] + (P[1] - R0[1]) * u - sag * 4 * u * (1 - u), R0[2] + (P[2] - R0[2]) * u); }
    A.needsUpdate = true;
  };
  DM.towWords = () => {
    if (TW.active && TW.kind === 'trailer') {
      const L = TW.launch, C = L.cradle, kmh = v => Math.round(v * 3.6) + ' km/h';
      if (!TW.go) return TW.hands ? 'on the trailer behind the car - the autopilot flies the launch, the car sets off now' : 'on the trailer behind the car - open the throttle: the car sets off (' + kmh(L.vCar) + '), pull at ' + kmh(L.vRot * 1.05);
      if (TW.hands && L.phase === 'loaded') return 'the autopilot on the trailer at ' + kmh(Math.abs(TW.car.out.u)) + ': the cradle carries ' + Math.round(C.loadAvg * 100) + ' %, it pulls at ' + kmh(L.vRot * 1.05);
      if (L.phase === 'loaded') return 'on the trailer at ' + kmh(Math.abs(TW.car.out.u)) + ': the cradle carries ' + Math.round(C.loadAvg * 100) + ' % - pull at ' + kmh(L.vRot * 1.05);
      if (L.phase === 'opened') return 'the latch open (' + C.opened + ') - fly it off the bunks';
      if (L.phase === 'clear') return 'off the trailer - the car slows down and stops';
      return L.why || 'the launch abandoned';
    }
    const L = TW.line; if (!TW.active || !L) return null;
    if (!L.on) return 'off the line: ' + L.released;
    if (!TW.go) return 'on the line behind the car, ' + Math.round(L.L0) + ' m - the car sets off when you fly';
    return 'on tow: ' + (L.T / 1000).toFixed(1) + ' kN, the line ' + Math.max(0, L.angle).toFixed(0) + '\u00b0 up, the car ' + Math.round(TW.car.out.u * 3.6) + ' km/h - R to release';
  };
  DM.towStop = () => {
    if (TW.launch) TW.launch.detach();
    if (TW.model && TW.model.group.parent) TW.model.group.parent.remove(TW.model.group);
    if (TW.hitch && TW.hitch.parent) TW.hitch.parent.remove(TW.hitch);
    if (TW.line) TW.line.detach();
    if (TW.rope && TW.rope.parent) TW.rope.parent.remove(TW.rope);
    if (TW.rings && TW.rings.group.parent) TW.rings.group.parent.remove(TW.rings.group);
    if (rig && rig.g.parent && !DM.on) rig.g.parent.remove(rig.g);
    Object.assign(TW, { active: false, line: null, car: null, D: null, rope: null, rings: null, go: false, kind: null, launch: null, model: null, hitch: null });
  };
  // the graph's report (the joins made vehicle-side, the spans rebuilt): the console and the dev's handle
  DM.report = () => rep;
  DM.car = () => car;
  DM.driver = () => D;
})();
