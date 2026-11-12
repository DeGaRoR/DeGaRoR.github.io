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
  // (the graph: vehicle_island.js vehIslandFromWorld - the gate's recipe: the roads, the runways and their taxi routes, the
  //  stands' links, the steep stretches closed; buildGraph was this file's own until phase 2)
  DM.enter = async function (ctx) {
    THREE_ = ctx.THREE; scene_ = ctx.scene; world_ = ctx.world;
    if (!sheet) { const r = await fetch(SHEET_URL); if (!r.ok) throw new Error('the car sheet: ' + r.status); sheet = await r.json(); }
    def = vehicleDef(sheet);
    const t0 = performance.now();
    const at = ctx.at || [0, 0, 0];
    const I = vehIslandFromWorld(world_, { siteOf: typeof siteOf === 'function' ? siteOf : null, fieldName: typeof fieldName === 'function' ? fieldName : null,
      town: { id: TOWN.id, site: TOWN.site, name: (typeof GAME_NAMES !== 'undefined' && GAME_NAMES.town) || 'the town' }, from: [at[0], at[2]] });
    if (!I) throw new Error('no roads in this world (the premises carry the road graph)');
    rep = I.report;
    G = vehRoadGraph(I.spec);
    DM.graphMs = performance.now() - t0;
    start = placeNear(at[0], at[2], 1e9);
    if (!start) throw new Error('no place on the roads');
    car = makeVehicle(def, world_);
    rig = buildRig(); scene_.add(rig.g);
    DM.on = true; DM.paused = false;
    const to0 = ctx.to && G.places[ctx.to] ? ctx.to : (G.places[TOWN.id] ? TOWN.id : start.id);
    place(start, to0);
    DM.setDest(to0);
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
    const L = Object.values(G.places).filter(p => p.kind === 'stop').sort((a, b) => a.name.localeCompare(b.name))
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
  // ---- THE GLIDER TOW (TOW-LAUNCH phase 3): the car as the GLIDER'S TOW, not the player's vehicle - the flight's UI
  //      stays the aeroplane's; the car and the line are actors (tow.js). The user: "when you select something without an
  //      engine ... we start at the start line with the cable and the car". app.js's TOW switch calls these:
  //      towStart(ctx) once the glider is lined up; towPre() / towPost(dt) round every 1/60 s step of the aeroplane (the
  //      line's coupling); towDraw() a frame; towStop(). The flight is inline then (sim_link.js: the line acts in the
  //      solver's substeps) - its cost: GATE TOW's +1.0 ms on the glider's frame, the car's 0.1 ms ----
  const TW = DM.tow = { active: false, line: null, car: null, D: null, rig: null, rope: null, L0: 400, Vtow: 28, why: null };
  DM.towStart = async function (ctx) {
    THREE_ = ctx.THREE; scene_ = ctx.scene; world_ = ctx.world;
    if (!sheet) { const r = await fetch(SHEET_URL); if (!r.ok) throw new Error('the car sheet: ' + r.status); sheet = await r.json(); }
    def = def || vehicleDef(sheet);
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
    TW.rope = new T.Line(gm, new T.LineBasicMaterial({ color: 0xf2e6c8 })); TW.rope.frustumCulled = false; scene_.add(TW.rope);
    TW.sim = sim; TW.active = true; TW.why = null; TW.t = 0;
    // (?towhands=1: the gate's hands fly the glider - a rig's, a player without a stick's; the player flies otherwise)
    TW.hands = /[?&]towhands=1/.test(location.search || '') ? makeTowHands(sim, { ground: world_.terrainH(cg[0], cg[2]) }) : null;
    poseRig();
    return to;
  };
  // the car sets off: the first step the aeroplane flies with the player's hands on (app.js calls it when the run starts)
  TW.start = () => { if (TW.active && !TW.go) { TW.go = true; TW.D.setDest(TW.to); } };
  DM.towPre = () => { if (!TW.active) return; if (TW.line && TW.line.on) TW.line.before(); if (TW.hands && TW.go) TW.hands(TW.line, 1 / 60); };
  DM.towPost = (dt) => {
    if (!TW.active) return;
    if (TW.line) TW.line.after(dt);
    if (TW.go) TW.D.step(dt); else { TW.car.ctl.thr = 0; TW.car.ctl.brake = 1; }
    TW.car.step(dt); TW.t += dt;
  };
  DM.towRelease = () => { if (TW.line && TW.line.on) TW.line.release(); };
  DM.towDraw = () => {
    if (!TW.active) return;
    poseRig();
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
    const L = TW.line; if (!TW.active || !L) return null;
    if (!L.on) return 'off the line: ' + L.released;
    if (!TW.go) return 'on the line behind the car, ' + Math.round(L.L0) + ' m - the car sets off when you fly';
    return 'on tow: ' + (L.T / 1000).toFixed(1) + ' kN, the line ' + Math.max(0, L.angle).toFixed(0) + '\u00b0 up, the car ' + Math.round(TW.car.out.u * 3.6) + ' km/h - R to release';
  };
  DM.towStop = () => {
    if (TW.line) TW.line.detach();
    if (TW.rope && TW.rope.parent) TW.rope.parent.remove(TW.rope);
    if (rig && rig.g.parent && !DM.on) rig.g.parent.remove(rig.g);
    Object.assign(TW, { active: false, line: null, car: null, D: null, rope: null, go: false });
  };
  // the graph's report (the joins made vehicle-side, the spans rebuilt): the console and the dev's handle
  DM.report = () => rep;
  DM.car = () => car;
  DM.driver = () => D;
})();
