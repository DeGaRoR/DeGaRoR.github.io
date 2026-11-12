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
  let start = null, odo = 0, last = null, track = [], hudSaved = null;
  const $ = id => document.getElementById(id);

  // ---- THE RIG: the body (and its lamps, all in the body's frame), four wheels in the body's frame ----
  // (restored 12 Nov: phase 2's graph rewrite took these four with buildGraph - the page's drive and tow modes threw on
  //  entry; GATE TRAILER's PAGE row now loads this file in node and calls them)
  function buildRig() {
    const T = THREE_, g = new T.Group(); g.name = 'drive:car'; g.matrixAutoUpdate = false;
    const pm = k => (typeof propMesh === 'function' ? propMesh(T, k) : new T.Group());
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

  // ---- THE VEHICLE (CAR, 13 Nov - the seam agreed with TOW-LAUNCH: DM.vehicleSource = { name, sheet, tune, buildRig(THREE,
  // def) }): a garage car rolled out (app.js: window.CAR_SHEET.carFromGarage - its measured sheet, its tune, a rig of its
  // OWN meshes) drives, tows and pulls the trailer; with none, the Conquer pickup (its sheet, its pack's meshes) as before.
  // A change of vehicle drops the rig (the next entry builds the new one) ----
  let conquer = null, srcNow = undefined;
  async function vehicleUp(ctx) {
    const V = (ctx && ctx.vehicle) || DM.vehicleSource || null;
    if (V !== srcNow) { if (rig && rig.g.parent) rig.g.parent.remove(rig.g); rig = null; srcNow = V; def = null; }
    if (V && V.sheet) { sheet = V.sheet; def = def || vehicleDef(sheet, V.tune); DM.name = V.name || 'the car'; return; }
    if (!conquer) { const r = await fetch(SHEET_URL); if (!r.ok) throw new Error('the car sheet: ' + r.status); conquer = await r.json(); }
    sheet = conquer; def = def || vehicleDef(sheet); DM.name = "Conquer '89 pickup";
  }
  const makeRig = () => (srcNow && srcNow.buildRig ? srcNow.buildRig(THREE_, def) : buildRig());

  // ---- THE GRAPH: the island's roads (vehicle_island.js) and the places a vehicle can be sent to ----
  // (the graph: vehicle_island.js vehIslandFromWorld - the gate's recipe: the roads, the runways and their taxi routes, the
  //  stands' links, the steep stretches closed; buildGraph was this file's own until phase 2)
  DM.enter = async function (ctx) {
    THREE_ = ctx.THREE; scene_ = ctx.scene; world_ = ctx.world;
    await vehicleUp(ctx);
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
    if (rig && rig.g.parent) rig.g.parent.remove(rig.g);
    rig = makeRig(); scene_.add(rig.g);
    DM.on = true; DM.paused = false;
    // (CAR, 13 Nov: with no To asked and no town at this budget the car waits at its start for the player's pick - it
    // drove to its own stand, round the block, before)
    const to0 = ctx.to && G.places[ctx.to] ? ctx.to : (G.places[TOWN.id] ? TOWN.id : null);
    place(start, to0);
    if (to0) DM.setDest(to0);
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
    }
    poseRig();
  };
  DM.target = () => { const c = car.toWorld(def.cg); return [c[0], c[1] + 0.6, c[2]]; };
  // (CAR, 13 Nov: a probe for the page rigs - the rig's meshes, its place in the world, the camera's target)
  DM.rigInfo = () => { if (!rig) return null; let n = 0; rig.g.traverse(o => { if (o.isMesh) n++; }); const e = rig.g.matrix.elements;
    return { meshes: n, wheels: rig.wheels.length, inScene: !!rig.g.parent, at: [e[12], e[13], e[14]].map(v => +v.toFixed(2)), target: DM.target().map(v => +v.toFixed(2)), cg: def && def.cg, garageCar: !!(srcNow && srcNow.buildRig) }; };
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
  DM.trip = () => placeName(DM.from) + ' → ' + placeName(DM.to);

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
    await vehicleUp(ctx);
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
    if (!rig) { rig = makeRig(); } if (!rig.g.parent) scene_.add(rig.g);
    const T = THREE_, gm = new T.BufferGeometry(); gm.setAttribute('position', new T.BufferAttribute(new Float32Array(25 * 3), 3));
    TW.rope = new T.Line(gm, new T.LineBasicMaterial({ color: 0xf2e6c8 })); TW.rope.frustumCulled = false; scene_.add(TW.rope);
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
    await vehicleUp(ctx);
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
    if (!rig) { rig = makeRig(); } if (!rig.g.parent) scene_.add(rig.g);
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
    if (!L || !L.on) { TW.rope.visible = false; return; }
    TW.rope.visible = true;
    const P = TW.car.toWorld(L.hitch), sim = TW.sim; let hx = 0, hy = 0, hz = 0; for (const i of L.hook) { hx += sim.p[i * 3] / L.hook.length; hy += sim.p[i * 3 + 1] / L.hook.length; hz += sim.p[i * 3 + 2] / L.hook.length; }
    // a sag the line's own weight gives it, less as it pulls (a few metres slack, a few decimetres taut)
    const sag = Math.max(0.3, 6 * (1 - Math.min(1, L.T / 1500)));
    for (let k = 0; k <= 24; k++) { const u = k / 24; A.setXYZ(k, hx + (P[0] - hx) * u, hy + (P[1] - hy) * u - sag * 4 * u * (1 - u), hz + (P[2] - hz) * u); }
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
    if (rig && rig.g.parent && !DM.on) rig.g.parent.remove(rig.g);
    Object.assign(TW, { active: false, line: null, car: null, D: null, rope: null, go: false, kind: null, launch: null, model: null, hitch: null });
  };
  // the graph's report (the joins made vehicle-side, the spans rebuilt): the console and the dev's handle
  DM.report = () => rep;
  DM.car = () => car;
  DM.driver = () => D;
})();
