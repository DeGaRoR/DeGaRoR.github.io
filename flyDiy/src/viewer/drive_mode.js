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
  const DM = window.DRIVE_MODE = {
    on: false, paused: false, name: "Conquer '89 pickup", chaseDist: 10, to: null, from: null, ms: 0,
  };
  let THREE_ = null, scene_ = null, world_ = null, sheet = null, def = null, car = null, G = null, D = null, rig = null, rep = null;
  let start = null, odo = 0, last = null, track = [], hudSaved = null;
  const $ = id => document.getElementById(id);

  // ---- THE GRAPH: the island's roads (vehicle_island.js) and the places a vehicle can be sent to ----
  function buildGraph(world) {
    const P = world.premises, O = P && P.overlay;
    if (!O || typeof O.roadGraph !== 'function') return null;
    const RG = O.roadGraph();
    const aero = (world.aerodromes || []).filter(a => a.kind !== 'meadow').map(a => {
      const s = typeof siteOf === 'function' ? siteOf(a.id) : null;
      return { id: a.id, name: typeof fieldName === 'function' ? fieldName(a.id, a.name) : a.name, x: a.x, z: a.z, stand: s && s.stand };
    });
    const sites = [];
    const hall = ((P.rec && P.rec.layers && P.rec.layers.sites) || []).find(s => s.id === TOWN.site);
    if (hall && hall.at) sites.push({ id: TOWN.id, name: (typeof GAME_NAMES !== 'undefined' && GAME_NAMES.town) || 'the town', x: hall.at.x, z: hall.at.z, kind: 'town' });
    return { aero, sites, RG, O, rec: P.rec };
  }
  // ---- THE RIG: the body (and its lamps, all in the body's frame), four wheels in the body's frame ----
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

  // ---- ENTER / LEAVE (app.js's DRIVE object calls them) ----
  // ctx: { THREE, scene, world, at: [x, y, z] (where the aeroplane is: the car starts at the nearest place), to? }
  DM.enter = async function (ctx) {
    THREE_ = ctx.THREE; scene_ = ctx.scene; world_ = ctx.world;
    if (!sheet) { const r = await fetch(SHEET_URL); if (!r.ok) throw new Error('the car sheet: ' + r.status); sheet = await r.json(); }
    def = vehicleDef(sheet);
    const t0 = performance.now();
    const B = buildGraph(world_); if (!B) throw new Error('no roads in this world (the premises carry the road graph)');
    const at = ctx.at || [0, 0, 0];
    const I = vehIslandSpec(B.RG, { rec: B.rec, toWorld: (x, z) => B.O.frame.toWorld(x, z), aerodromes: B.aero, sites: B.sites, from: [at[0], at[2]] });
    rep = I.report;
    G = vehRoadGraph(I.spec);
    DM.graphMs = performance.now() - t0;
    start = placeNear(at[0], at[2], 1e9);
    if (!start) throw new Error('no place on the roads');
    car = makeVehicle(def, world_);
    rig = buildRig(); scene_.add(rig.g);
    DM.on = true; DM.paused = false;
    place(start);
    DM.setDest(ctx.to && G.places[ctx.to] ? ctx.to : (G.places[TOWN.id] ? TOWN.id : start.id));
    return true;
  };
  function place(P) {
    car.place(P.x, P.z, Math.atan2(P.dz, P.dx));
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
  DM.restart = function () { const to = DM.to; place(start); DM.setDest(to); };
  DM.setDest = function (id) {
    if (!D || !G.places[id]) return 'none';
    const p = car.refPoint(), here = placeNear(p[0], p[2], 150);
    if (here && here.id !== id) DM.from = here.id;
    const t = performance.now(), r = D.setDest(id);
    DM.planMs = performance.now() - t;
    if (r !== 'none') DM.to = id;
    return r;
  };
  DM.choices = () => (G ? Object.values(G.places).filter(p => p.kind === 'stop').sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ id: p.id, label: p.name })) : []);

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
    const lg = D && D.log.length ? D.log[D.log.length - 1].msg : 'parked';
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
  // the graph's report (the joins made vehicle-side, the spans rebuilt): the console and the dev's handle
  DM.report = () => rep;
  DM.car = () => car;
  DM.driver = () => D;
})();
