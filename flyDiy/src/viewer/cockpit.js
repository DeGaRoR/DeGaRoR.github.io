// THE COCKPIT IN FLIGHT — the panel arc, session 4 (2026-09-12).
//
// What the flown aeroplane's panel does: the READINGS every hand turns by
// (the solver's numbers, lagged the way the instrument lags), the switch
// state the cockpit's toggles / knobs / rockers / key write, the electrical
// bus (31_elec.js) that decides which of them is alive, the lamps' glow,
// and the click that works a switch in the cockpit view. app.js owns the
// model and the loop and calls in here; this file owns nothing of the
// scene except the raycast it is handed.
//
// ONE STATE FOR THE SWITCHES. `CK.sw` holds every switch the panel drew —
// `sw_<light>` 0/1 or 0..1, `sw_master`, `sw_alt`, `key` — seeded from the
// positions the design was drawn with (the snapshot's `lights`), written
// only by the cockpit's clicks, read by the lamps, the bus, the faces'
// backlight and the hands. The editor's rows are the DESIGN; this is the
// flight, and it starts where the design left the switches.
//
// THE LAWS come baked in the snapshot (the join sampled _panel_gen's
// angleOf into `stops` per hand), so nothing here needs _panel_gen loaded
// — index.html's editor block is lazy and the smoke gate never runs it.
//
// Not in the RENDER slot's execution under UISMOKE: app.js guards every
// call on `window.FLYDIY_COCKPIT`.
(() => {
'use strict';
const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const navDeg = rad => ((rad * 180 / Math.PI) % 360 + 360) % 360;
// the instruments' own lags (s), and what a dead one relaxes toward
const LAG = { ias: 0.25, alt: 0.2, vs: 2.5, rpmEng: 0.3, nz: 0.1, oilP: 1.0, oilT: 8.0,
              fuelFrac: 1.5, volts: 0.4, roll: 0.15, pitch: 0.15, r: 0.4, beta: 0.3, hdg: 0.5 };
// (a spun-down gyro leans, it does not fall over — session 4d, the user: "it
// tends to be faulty on the ground")
const REST = { ias: 0, alt: 0, vs: 0, roll: 0.20, pitch: -0.12, r: 0, hdg: null, rpmEng: 0, nz: 1,
               nzMax: 1, nzMin: 1, oilP: 0, oilT: 15, fuelFrac: 0, volts: 0, beta: 0 };
const PSI = 6894.757;
const LIGHT_AMPS = { taxi: 5, beacon: 3, land: 8, nav: 2.5, flood: 0.5, instr: 0.6, pedal: 0.3, pax: 0.5 };
const KEY_STEPS = ['off', 'l', 'r', 'both', 'start'];

function interp(stops, v) {
  if (!stops || !stops.length) return 0;
  if (v <= stops[0][0]) return stops[0][1];
  const n = stops.length;
  if (v >= stops[n - 1][0]) return stops[n - 1][1];
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (stops[m][0] <= v) lo = m; else hi = m; }
  const [v0, a0] = stops[lo], [v1, a1] = stops[hi];
  return a0 + (a1 - a0) * (v - v0) / Math.max(1e-9, v1 - v0);
}

function make(THREE) {
  const CK = {
    readings: Object.assign({ clockH: 12, clockM: 0, clockS: 0 }, REST),
    sw: {}, lightOn: true, key: 'both',
    bus: null, fit: null, model: null, sim: null,
    hidden: [], pilotKey: null,
    qnh: 0,                       // the altimeter's datum: the field's elevation
    t: 0,
  };
  const raw = {};                 // the unlagged readings
  const qA = new THREE.Quaternion(), qB = new THREE.Quaternion();
  const vA = new THREE.Vector3(), vB = new THREE.Vector3();
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();

  // ---- bind to a built aeroplane ------------------------------------------
  // model: app.js's model record (grp, meshes, gauges[], lamps[], mats);
  // data: the snapshot (its `lights`); sim: the live solver; spec: the
  // resolved spec (its `systems` decides the bus)
  CK.bind = (model, data, sim, spec, opts) => {
    CK.model = model; CK.sim = sim; CK.t = 0;
    opts = opts || {};
    const L = (data && data.lights) || {};
    CK.lightOn = L.on !== false;
    for (const k of Object.keys(LIGHT_AMPS)) CK.sw['sw_' + k] = L[k] != null ? +L[k] : 0;
    CK.sw.sw_master = 1; CK.sw.sw_alt = 1; CK.key = 'both'; CK.sw.key = 3;
    CK.qnh = opts.fieldElev || 0;
    CK.pilotKey = opts.pilotKey || null;
    // the bus from the fit
    let fit = null;
    try { if (typeof genSystemsResolve === 'function') fit = genSystemsResolve(spec || {}); } catch (e) {}
    CK.fit = fit;
    const loads = fit ? fit.loads.map(l => ({ key: l.key, amps: l.amps })) : [];
    for (const k of Object.keys(LIGHT_AMPS)) loads.push({ key: 'sw_' + k, amps: 0 });
    CK.bus = (typeof makeBus === 'function')
      ? makeBus({ battAh: fit ? fit.battAh : 0, altA: fit ? fit.altA : 0, loads,
                  altCutIn: 1100, starterA: 150 })
      : null;
    if (CK.bus) { CK.bus.master = !!CK.sw.sw_master; CK.bus.alt = !!CK.sw.sw_alt; }
    // the solver asks the bus before it cranks
    if (sim) sim.starterOk = () => !CK.bus || (fit && !fit.starter ? false : CK.bus.starterOk);
    for (const k of Object.keys(REST)) { raw[k] = REST[k]; CK.readings[k] = REST[k]; }
    raw.hdg = 0; CK.readings.hdg = 0;
    CK.lamps = model && model.lamps ? model.lamps : [];
    CK.setupLights(model);
    CK.padSwitches(model);
    return CK;
  };
  // A SWITCH IS A SMALL THING TO CLICK — a toggle's bat is two millimetres
  // across — so every switch, knob and the key gets an unseen pick pad at
  // its pivot: a sphere that draws nothing and answers the ray (the crew's
  // PICK_MAT precedent). The join never carries it; it is the flight's own.
  CK.padSwitches = model => {
    if (!model || !model.gauges || !THREE.SphereGeometry) return;
    const padMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
    for (const g of model.gauges) {
      if (!/^(switch|knob|key)$/.test(g.c.law) || !g.obj.add) continue;
      const pad = new THREE.Mesh(new THREE.SphereGeometry(g.c.law === 'key' ? 0.022 : 0.016, 8, 6), padMat);
      pad.userData.pickPad = 1;
      g.obj.add(pad);
    }
  };
  // the two real lights the flown aeroplane can carry: a landing / taxi spot
  // at the lamp's own lens, aimed ahead. (The cabin flood is owed.)
  CK.setupLights = model => {
    if (!model || !model.grp || !THREE.SpotLight) return;
    if (model.spot) { model.grp.remove(model.spot); model.grp.remove(model.spot.target); model.spot = null; }
    const lens = (model.lamps || []).find(l => l.kind === 'lens' && (l.key === 'land' || l.key === 'taxi'));
    if (!lens || !lens.mesh.geometry || !lens.mesh.geometry.boundingBox && !lens.mesh.geometry.computeBoundingBox) return;
    lens.mesh.geometry.computeBoundingBox();
    const bb = lens.mesh.geometry.boundingBox;
    if (!bb || !isFinite(bb.min.x)) return;
    const c = new THREE.Vector3().addVectors(bb.min, bb.max).multiplyScalar(0.5);
    const s = new THREE.SpotLight(0xfff2dc, 0, 120, 0.42, 0.5, 1.2);
    s.position.copy(c);
    s.target.position.set(c.x - 40, c.y - 6, c.z);       // ahead is −x, and down a little
    model.grp.add(s); model.grp.add(s.target);
    model.spot = s;
  };

  // ---- the readings, once per frame ----------------------------------------
  // ctx: { ap (its clock), out (sim.out), fuel (sim.fuel), eng (sim.eng) }
  CK.frame = (dt, sim, ap, ctx) => {
    if (!sim) return;
    ctx = ctx || {};
    CK.t += dt;
    const o = sim.out || {}, F = sim.fuel || {}, E = (sim.eng && sim.eng[0]) || { running: true, key: 'both', crank: 0 };
    const cg = sim.cgPos();
    const bus = CK.bus;
    // the switches reach the bus and the key reaches the engine
    if (bus) {
      bus.master = !!CK.sw.sw_master; bus.alt = !!CK.sw.sw_alt;
      for (const k of Object.keys(LIGHT_AMPS)) {
        const v = CK.lightOn ? +CK.sw['sw_' + k] || 0 : 0;
        bus.setLoad('sw_' + k, LIGHT_AMPS[k] * (k === 'beacon' ? 0.5 : 1) * (v > 0 ? (v > 1 ? 1 : v) : 0));
      }
      const rpmProp = (o.rpm && o.rpm[0]) || 0;
      bus.step(dt, rpmProp, E.crank > 0);
    }
    const busOk = bus ? bus.ok : true;
    // the key springs back from START once the engine has caught (or the
    // crank has been let go)
    if (CK.key === 'start' && E.crank <= 0) { CK.key = 'both'; CK.sw.key = 3; }
    // sources: suction for the gyros, the bus for the electric ones
    const fit = CK.fit;
    const ias = o.Veas != null ? o.Veas : (o.V || 0);
    const vacOk = fit ? (fit.vac === 'pump' ? E.running : fit.vac === 'venturi' ? ias > 20 : false) : true;
    const aiElec = !!(fit && fit.items && fit.items.includes('aiE'));
    const gyroOk = aiElec ? busOk : vacOk;
    CK.gyroOk = gyroOk; CK.busOk = busOk;
    // the raw numbers
    raw.ias = ias;
    raw.alt = cg[1] - CK.qnh;
    raw.vs = o.vs || 0;
    raw.roll = gyroOk ? (o.roll || 0) : REST.roll;
    raw.pitch = gyroOk ? (o.pitch || 0) : REST.pitch;
    raw.r = busOk ? (o.r || 0) : 0;
    raw.beta = o.beta || 0;
    const hdgNow = navDeg(o.hdg || 0);
    raw.hdg = hdgNow;
    raw.rpmEng = (o.rpmEng && o.rpmEng[0]) || 0;
    raw.nz = o.nz != null ? o.nz : 1; raw.nzMax = o.nzMax != null ? o.nzMax : 1; raw.nzMin = o.nzMin != null ? o.nzMin : 1;
    raw.oilP = E.running ? 62 * PSI * Math.min(1, 0.5 + 0.5 * raw.rpmEng / 2000) : 0;
    raw.oilT = E.running ? 82 : Math.max(15, (CK.readings.oilT || 15));
    raw.fuelFrac = busOk ? (F.frac != null ? F.frac : 1) : 0;
    raw.volts = bus ? bus.V : 0;
    // the electric readings die with the bus
    if (!busOk) { raw.fuelFrac = 0; }
    // the clock: 12:00 plus the flight's own clock (no day cycle yet)
    const tClock = 12 * 3600 + (ap && ap.t != null ? ap.t : CK.t);
    CK.readings.clockH = (tClock / 3600) % 12;
    CK.readings.clockM = (tClock / 60) % 60;
    CK.readings.clockS = tClock % 60;
    // the lags
    const R = CK.readings;
    for (const k of Object.keys(raw)) {
      const tau = LAG[k];
      if (k === 'hdg') {
        // the shortest way round for a heading
        let d = raw.hdg - R.hdg; while (d > 180) d -= 360; while (d < -180) d += 360;
        R.hdg = (R.hdg + d * Math.min(1, dt / (tau || 0.5)) + 360) % 360;
        continue;
      }
      if (!tau) { R[k] = raw[k]; continue; }
      R[k] += (raw[k] - R[k]) * Math.min(1, dt / tau);
    }
    if (!gyroOk && !aiElec) R.hdgDg = R.hdgDg == null ? R.hdg : R.hdgDg;   // a dead DG freezes
    else R.hdgDg = R.hdg;
    // the lamps and the faces
    CK.glow(dt);
  };
  // each lamp's lens and cup, the faces' backlight
  CK.glow = dt => {
    const busOk = CK.busOk !== false;
    const beacon = 0.12 + 0.88 * Math.pow(Math.max(0, Math.cos(2 * Math.PI * 0.75 * CK.t)), 10);
    for (const l of (CK.lamps || [])) {
      // the master / alternator buttons light with their own switch (4d),
      // the lamps with theirs when the lights are fitted
      const fitted = CK.lightOn || l.key === 'master' || l.key === 'alt';
      const v = fitted && busOk ? clamp(+CK.sw['sw_' + l.key] || 0, 0, 1) : 0;
      const gain = l.key === 'beacon' ? beacon : 1;
      if (l.mesh.material && l.mesh.material.emissive)
        l.mesh.material.emissiveIntensity = v * gain * (l.kind === 'lens' ? 2.4 : 0.55);
    }
    if (CK.model && CK.model.spot) {
      const land = CK.lightOn && busOk ? clamp(+CK.sw.sw_land || 0, 0, 1) : 0;
      const taxi = CK.lightOn && busOk ? clamp(+CK.sw.sw_taxi || 0, 0, 1) : 0;
      CK.model.spot.intensity = 4.0 * land + 1.6 * taxi;
      CK.model.spot.angle = land ? 0.30 : 0.62;
    }
    const W = typeof window !== 'undefined' ? window : {};
    const PLm = W.CAGE_PANEL && W.CAGE_PANEL.material ? W.CAGE_PANEL.material('faces') : null;
    if (PLm) PLm.emissiveIntensity = (CK.lightOn && busOk ? clamp(+CK.sw.sw_instr || 0, 0, 1) : 0) * 1.6;
  };

  // ---- the hands ---------------------------------------------------------------
  // gauges: [{obj, c}] from app.js's build; c = the join's ctl record
  CK.pose = model => {
    const G = model && model.gauges; if (!G) return;
    const R = CK.readings;
    for (const g of G) {
      const c = g.c, o = g.obj;
      if (!o || !o.quaternion || !c.ax) continue;
      let a1 = 0, a2 = 0;
      const drv = c.drive;
      switch (c.law) {
        case 'lin': {
          let v = R[drv]; if (v == null) v = 0;
          if (!CK.busOk && c.gauge && CK.fit && isElectric(c.gauge)) v = REST[drv] != null ? REST[drv] : 0;
          a1 = interp(c.stops, v) * D2R; break;
        }
        case 'turn': {
          const v = R[drv] || 0, per = c.perSI || 1;
          a1 = (((v / per) % 1) + 1) % 1 * 2 * Math.PI; break;
        }
        case 'ball': a1 = -(R.roll || 0); a2 = -(R.pitch || 0); break;
        case 'card': a1 = (drv === 'hdg' && c.gauge === 'dg' ? (R.hdgDg != null ? R.hdgDg : R.hdg) : R.hdg) * D2R; break;
        case 'switch': { const v = +CK.sw[drv] || 0; a1 = (c.k || 0.42) * (v > 0.5 ? 1 : -1); break; }
        case 'knob': { const v = clamp(+CK.sw[drv] || 0, 0, 1); a1 = (-135 + 270 * v) * D2R; break; }
        case 'key': { a1 = (c.k || Math.PI / 6) * clamp(+CK.sw.key || 0, 0, 4); break; }
        default: a1 = 0;
      }
      vA.set(c.ax[0], c.ax[1], c.ax[2]);
      qA.setFromAxisAngle(vA, (c.sgn || 1) * a1);
      if (c.ax2) {
        vB.set(c.ax2[0], c.ax2[1], c.ax2[2]);
        qB.setFromAxisAngle(vB, (c.sgn2 || 1) * a2);
        qA.multiply(qB);
      }
      o.quaternion.copy(qA);
    }
  };
  const isElectric = gauge => {
    const I = typeof GEN_INSTR !== 'undefined' ? GEN_INSTR[gauge] : null;
    return !!(I && I.power === 'elec');
  };

  // ---- the cockpit view: the pilot goes away -----------------------------------
  // The pilot is the crew layer's FIRST occupant (dums[0], the one whose
  // head the eye is published off), flown as a live character (G246:
  // model.people[0].inst, its `meshes`) or, on a build without the crew
  // characters, as the `dummy1` buckets of the bake. Both are hidden while
  // you look out of that head — the eye sits INSIDE it, and a skull around
  // the camera is a black screen. The character's meshes land async, so
  // this is asked every frame and hides what has arrived since.
  CK.cockpitView = (on, model) => {
    if (!model || !model.meshes) return;
    if (!on) { for (const m of CK.hidden) m.visible = true; CK.hidden = []; return; }
    const mats = model.mats || {};
    if (!CK.hidden.length) for (const k in model.meshes) {
      const m = mats[k] || {};
      const isPilot = (CK.pilotKey && m.char === CK.pilotKey) || m.sec === 'dummy1';
      if (isPilot && model.meshes[k].visible) { model.meshes[k].visible = false; CK.hidden.push(model.meshes[k]); }
    }
    const P = model.people && model.people[0];
    const ms = P && P.inst && P.inst.meshes;
    if (ms) for (const m of ms) if (m && m.visible) { m.visible = false; CK.hidden.push(m); }
  };

  // ---- the click: a switch, a knob, the key --------------------------------------
  CK.pick = (camera, x, y, model) => {
    if (!model || !model.gauges || !model.grp) return null;
    ndc.set(x, y);
    ray.setFromCamera(ndc, camera);
    let hits;
    try { hits = ray.intersectObject(model.grp, true); } catch (e) { return null; }
    for (const h of hits) {
      let a = h.object;
      while (a && a !== model.grp) {
        const g = model.gauges.find(q => q.obj === a);
        if (g) return g;
        a = a.parent;
      }
      // glass and its companion pass are see-through: the ray goes on; the
      // first opaque thing that is not a gauge ends it
      const mt = h.object.material;
      const clear = !mt || mt.transparent || (mt.opacity != null && mt.opacity < 1) || mt.colorWrite === false;
      if (h.object.visible && !clear) break;
    }
    return null;
  };
  // returns true when it took the click
  CK.click = (g, button) => {
    if (!g || !g.c) return false;
    const c = g.c, drv = c.drive;
    let did = false;
    if (c.law === 'switch') { CK.sw[drv] = +CK.sw[drv] > 0.5 ? 0 : 1; did = true; }
    else if (c.law === 'knob') { const v = +CK.sw[drv] || 0; CK.sw[drv] = button === 2 ? (v <= 0 ? 1 : Math.max(0, v - 0.25)) : (v >= 1 ? 0 : Math.min(1, v + 0.25)); did = true; }
    else if (c.law === 'key') {
      let i = clamp(Math.round(+CK.sw.key || 0), 0, 4);
      i = button === 2 ? Math.max(0, i - 1) : Math.min(4, i + 1);
      CK.setKey(KEY_STEPS[i]);
      did = true;
    }
    // the lamps answer the switch at once — a paused sim steps no frame,
    // and a switch that waits for the sim to move is a switch that looks dead
    if (did) CK.glow(0);
    return did;
  };
  // A ROTARY IS TURNED, NOT CLICKED (session 4e, the user: "click first,
  // then the movement up/down of the mouse should have them rotate cw/ccw"):
  // the press on a knob or the key takes hold of it, the mouse moving UP
  // turns it clockwise (a knob's value up, the key a step further), DOWN
  // the other way; a press let go without moving is the old click.
  CK.grab = null;
  CK.dragStart = (g, y) => {
    if (!g || !g.c || !/^(knob|key)$/.test(g.c.law)) return false;
    CK.grab = { g, y0: y, v0: g.c.law === 'key' ? clamp(Math.round(+CK.sw.key || 0), 0, 4) : (+CK.sw[g.c.drive] || 0), moved: false };
    return true;
  };
  CK.dragTo = y => {
    const G = CK.grab; if (!G) return false;
    const dy = G.y0 - y;                               // up is positive
    if (Math.abs(dy) > 3) G.moved = true;
    if (!G.moved) return true;
    if (G.g.c.law === 'knob') { CK.sw[G.g.c.drive] = clamp(G.v0 + dy * 0.005, 0, 1); CK.glow(0); }
    else {
      const st = clamp(Math.round(G.v0 + dy / 28), 0, 4);
      if (st !== clamp(Math.round(+CK.sw.key || 0), 0, 4)) CK.setKey(KEY_STEPS[st]);
    }
    return true;
  };
  CK.dragEnd = button => {
    const G = CK.grab; CK.grab = null;
    if (!G) return false;
    if (!G.moved) return CK.click(G.g, button);        // a press let go in place: a click
    return true;
  };
  CK.setKey = pos => {
    const i = KEY_STEPS.indexOf(pos); if (i < 0) return;
    CK.key = pos; CK.sw.key = i;
    const sim = CK.sim; if (!sim || !sim.setEngine) return;
    const n = sim.eng ? sim.eng.length : 1;
    for (let e = 0; e < n; e++) {
      if (pos === 'off') sim.setEngine(e, { key: 'off' });
      else if (pos === 'start') sim.setEngine(e, { key: 'both', start: true });
      else sim.setEngine(e, { key: pos });
    }
  };
  CK.swing = () => {                            // a hand on the prop
    const sim = CK.sim; if (!sim || !sim.setEngine) return;
    const n = sim.eng ? sim.eng.length : 1;
    for (let e = 0; e < n; e++) sim.setEngine(e, { swing: true });
  };
  return CK;
}
const API = { make, interp, LAG, REST, KEY_STEPS };
if (typeof window !== 'undefined') window.FLYDIY_COCKPIT = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
