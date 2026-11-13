// mission_live.js - A MISSION IN FLIGHT (MISSIONS-LIVE, 13 Nov 2026): the page's half of 73c_mission_run.js.
// window.MISSION_LIVE, fetched lazily (build.js MANIFEST.lazy: FLYDIY_LAZY('mission_live')) by the career's page half the
// first time a flight departs with an accepted mission that has in-flight objectives or places (app.js missionLiveArm);
// the sandbox, a career with no such mission and the phone with none never fetch it. ONE code path, desktop and phone.
//
// TWO HALVES:
//   THE TRACKER (pure: no THREE, no DOM, no clock - GATE MISSIONLIVE runs it in node over the real core):
//     arm(doc, o)         a tracker (73c missionTrackNew) per accepted contract whose current leg has in-flight
//                         objectives, and the markers (73c missionMarkers) of every accepted contract with places.
//                         o: { reach (half-span m), fields, spots (FLEET_SPOTS_PACK.aero), from (departure aerodrome) }
//     tick(t, x, y, z, agl)  EVERY FRAME is fine: it returns at once (no allocation) until RATE s of t have passed, then
//                         feeds ONE sample to every tracker (missionTrackStep tests the whole segment, so 4 Hz still
//                         catches a gate a fast aeroplane crosses between two samples) -> the events of that sample
//                         (null between samples); a hit moves the markers' states (done / next / later)
//     evidence()          { <contract id>: missionTrackEvidence } for the stop record's `tracks` (null: nothing tracked)
//     aboard()            the named people the flight carries (the accepted steps' load / embark ids, boarded at `from`)
//     end()               nothing tracked, nothing drawn
//   Events beyond the core's: { k: 'missed', id, key } - a seq leg's armed objective skipped (a LATER one of the same leg
//   was crossed first): once per objective, the HUD says "missed: <key>" (the core already refuses it at the stop).
//   THE DRAWING (THREE + DOM, only while a mission runs; nothing exists, nothing is drawn otherwise):
//     mount(scene, o)     the markers as static meshes: the props of tools/_mission_gen.js when MISSION_GEN is in (the
//                         air-race pylon, the balloon column, the ring, the marker flag, the tie-down spot; built once,
//                         lod 1), else plain stand-ins (a post, a torus, a column); the NEXT objective under a pulsing
//                         beacon (a tall translucent column, one shared material); done hidden, later dimmed.
//                         o: { THREE, ground (x, z) -> m, ui (the #ui element) }
//     frame(camera, now)  the beacon's pulse, the screen-edge ARROW to the next objective when it is off-screen, the
//                         timer (running lap, splits, penalty) and the last event line - no allocation per frame
//     unmount()
// HEADINGS: 73c's (compass degrees, 0 = north = -z, 90 = east = +x). A ring faces (sin dir, -cos dir); the generator's
// ring is through -z at yaw 0, so rotation.y = -dir (radians).
(() => {
'use strict';
const W = typeof window !== 'undefined' ? window : globalThis;
const RATE = 0.25;                     // s of flight between two tracker samples
const FLIGHT = { pt: 1, gate: 1, ring: 1 };
const num = v => typeof v === 'number' && isFinite(v);
const S = { runs: [], tNext: -Infinity, smp: { t: 0, x: 0, z: 0, y: 0, agl: 0 }, aboard: [], from: null, opts: null, rev: 0, last: null, lastAt: 0 };

// ---- THE TRACKER ------------------------------------------------------------------------------------------------------
function liveOf(doc, id) {
  const C = doc && doc.career && doc.career.contracts, L = C && C.live && C.live[id];
  return { stage: (L && L.stage) | 0, subs: ((L && L.subs) || []).slice(), picked: ((L && L.picked) || []).slice() };
}
function arm(doc, o) {
  end();
  o = o || {};
  S.opts = o; S.from = o.from || null;
  const C = doc && doc.career && doc.career.contracts;
  if (!C || typeof careerContract !== 'function' || typeof missionMarkers !== 'function') return 0;
  for (const id of C.accepted || []) {
    const rec = careerContract(doc, id);
    if (!rec || !rec.stages) continue;
    const L = liveOf(doc, id);
    const O = missionObjectives(rec, L);
    const markers = missionMarkers(rec, L, { fields: o.fields, spots: o.spots }).filter(m => m.state !== 'done' && m.kind !== 'field');   // an aerodrome is in the world already
    if (!O.objs.length && !markers.length) continue;
    const T = O.objs.length ? missionTrackNew(rec, L, { reach: o.reach }) : null;
    S.runs.push({ id, rec, L, T, markers, missed: {}, tracked: id === C.tracked });
  }
  // the tracked one first (its next objective is the arrow's)
  S.runs.sort((a, b) => (b.tracked ? 1 : 0) - (a.tracked ? 1 : 0));
  S.aboard = aboardOf(doc, S.from);
  S.rev++;
  return S.runs.length;
}
// the named people this flight carries: every accepted contract's open steps of its current leg that load people here
// (a step's `from` is this aerodrome, or it names none) - their load.pax ids and their embark ids
function aboardOf(doc, from) {
  const out = [], C = doc && doc.career && doc.career.contracts;
  if (!C || typeof careerContract !== 'function') return out;
  for (const id of C.accepted || []) {
    const rec = careerContract(doc, id), L = liveOf(doc, id), st = rec && rec.stages && rec.stages[L.stage];
    if (!st) continue;
    st.subs.forEach((s, j) => {
      if (L.subs[j] || (s.from && from && s.from !== from)) return;
      const ids = [].concat((s.load && Array.isArray(s.load.pax) ? s.load.pax : []), Array.isArray(s.embark) ? s.embark : []);
      for (const p of ids) if (typeof p === 'string' && !out.includes(p)) out.push(p);
    });
  }
  return out;
}
// is a sample due at t (the page computes the height over the ground only then)
const due = t => S.runs.length > 0 && (t >= S.tNext || t < S.smp.t);
function tick(t, x, y, z, agl) {
  if (!due(t)) return null;
  // a clock that went BACK (a new leg's pilot restarts at 0 without an arm): the segment starts again here
  if (t < S.smp.t) for (const R of S.runs) if (R.T) R.T.last = null;
  // a fixed rate, not "RATE after the last frame": the next sample is due RATE after this one was (a frame late is not
  // carried into the next), and a clock that jumped starts again from now
  S.tNext = S.tNext > -Infinity && t - S.tNext < RATE && t >= S.smp.t ? S.tNext + RATE : t + RATE;
  const q = S.smp;
  q.t = t; q.x = x; q.z = z; q.y = y; q.agl = num(agl) ? agl : undefined;
  let out = null;
  for (const R of S.runs) {
    if (!R.T) continue;
    const a = R.T.last;
    const ev = missionTrackStep(R.T, q);
    // a seq leg's armed objective skipped: a later one of the leg crossed on this segment while it is still open
    if (R.T.seq && a && typeof missionHitTest === 'function') {
      const open = R.T.objs.filter(ob => !R.T.hits[ob.key]);
      if (open.length > 1) for (let i = 1; i < open.length; i++) {
        if (missionHitTest(open[i].place, a, R.T.last) && !R.missed[open[0].key]) {
          R.missed[open[0].key] = true;
          (out = out || []).push({ k: 'missed', id: R.id, key: open[0].key, t });
          break;
        }
      }
    }
    if (!ev.length) continue;
    for (const e of ev) { e.id = R.id; (out = out || []).push(e); }
    if (ev.some(e => e.k === 'hit' || e.k === 'photo')) restate(R);
  }
  if (out) { S.last = out[out.length - 1]; S.rev++; }
  return out;
}
// a hit moves the markers' states: the leg's live progress as the flight has it (the core judges it at the stop)
function restate(R) {
  const L = { stage: R.L.stage, subs: R.L.subs.slice(), picked: R.L.picked };
  for (const ob of R.T.objs) if (R.T.hits[ob.key]) L.subs[ob.j] = true;
  const o = S.opts || {};
  const M = missionMarkers(R.rec, L, { fields: o.fields, spots: o.spots });
  for (const m of R.markers) { const q = M.find(z => z.key === m.key); if (q) m.state = q.state; }
}
// the next objective to fly to: the tracked contract's (else the first run's) first marker in state next, in flight
// kinds; an any-order leg: the nearest of them to (x, z)
function next(x, z) {
  for (const R of S.runs) {
    let best = null, bd = Infinity;
    for (const m of R.markers) {
      if (m.state !== 'next' || !FLIGHT[m.kind] || !num(m.x)) continue;
      const d = num(x) ? (m.x - x) * (m.x - x) + (m.z - z) * (m.z - z) : 0;
      if (d < bd) { bd = d; best = m; }
      if (R.T && R.T.seq) break;
    }
    if (best) return best;
  }
  return null;
}
function evidence() {
  const out = {};
  let n = 0;
  for (const R of S.runs) if (R.T) { out[R.id] = missionTrackEvidence(R.T); n++; }
  return n ? out : null;
}
// the running timers, for the HUD: [{ id, key: contract id, t0, s (stopped), raw, pen, strikes, splits }]
function timers() {
  const out = [];
  for (const R of S.runs) if (R.T) for (const id of Object.keys(R.T.laps)) out.push(Object.assign({ id, run: R.id }, R.T.laps[id]));
  return out;
}
function end() {
  S.runs = []; S.tNext = -Infinity; S.smp.t = 0; S.aboard = []; S.last = null; S.rev++;
  unmount();
}

// ---- THE DRAWING -------------------------------------------------------------------------------------------------------
const D = { group: null, THREE: null, beacon: null, beaconMat: null, byKey: new Map(), cache: new Map(), ui: null, el: null, rev: -1,
            v: null, pulse: 0, arrow: null, timer: null, line: null, lineAt: 0, groundFn: null, finish: null };
const MG = () => W.MISSION_GEN || null;
function propOf(m, THREE) {
  const G = MG(), grp = new THREE.Group();
  const P = G ? G.forMarker(m, { agl: m.kind === 'ring' && D.groundFn && num(m.y) ? Math.max(0, m.y - D.groundFn(m.x, m.z)) : 0 }) : null;
  if (G && P) {
    // one build per distinct preset in a mount (a gate's two posts, a course of like gates: the geometry shared)
    const key = JSON.stringify(P), hit = D.cache.get(key);
    if (hit) return hit.clone();
    if (!D.finish) { D.finish = G.makeFinish(); G.applyFinish({}, D.finish); }
    const r = G.build(P, 1, D.finish);
    for (const k of G.BAGS) { const mesh = r.bags[k].mesh(grp, D.finish.MAT[k]); if (mesh) { mesh.castShadow = k !== 'aoskirt'; mesh.matrixAutoUpdate = false; mesh.updateMatrix(); } }
    D.cache.set(key, grp);
    return grp.clone();
  }
  // stand-ins (the generator not in): plain shapes in the obstacle orange
  const mat = D.standMat || (D.standMat = new THREE.MeshStandardMaterial({ color: 0xe0652a, roughness: 0.7 }));
  if (m.kind === 'gate') { const h = (m.alt && m.alt.max) || 25; const g = new THREE.CylinderGeometry(0.4, 2.2, h, 12); g.translate(0, h / 2, 0); grp.add(new THREE.Mesh(g, mat)); }
  else if (m.kind === 'ring') grp.add(new THREE.Mesh(new THREE.TorusGeometry(m.r || 8, 1.2, 10, 40), mat));
  else if (m.kind === 'pt') { const g = new THREE.CylinderGeometry(0.15, 0.15, 12, 6); g.translate(0, 6, 0); grp.add(new THREE.Mesh(g, mat)); }
  else if (m.kind === 'spot') { const g = new THREE.BoxGeometry(10, 0.1, 10); grp.add(new THREE.Mesh(g, mat)); }
  else return null;
  return grp;
}
function place(m, THREE) {
  const gy = (x, z) => (D.groundFn ? D.groundFn(x, z) : 0);
  const out = [];
  if (m.kind === 'gate' && Array.isArray(m.posts)) {
    for (const p of m.posts) { const o = propOf(m, THREE); if (!o) continue; o.position.set(p[0], gy(p[0], p[1]), p[1]); out.push(o); }
    // the band between the posts: a faint line at the band's top (MSL or AGL)
    const [a, b] = m.posts, top = (m.alt && num(m.alt.max)) ? m.alt.max : 60;
    const ya = m.alt && m.alt.ref === 'msl' ? top : gy(a[0], a[1]) + top, yb = m.alt && m.alt.ref === 'msl' ? top : gy(b[0], b[1]) + top;
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0], ya, a[1]), new THREE.Vector3(b[0], yb, b[1])]);
    const line = new THREE.Line(lg, D.lineMat || (D.lineMat = new THREE.LineBasicMaterial({ color: 0xf4efe6, transparent: true, opacity: 0.45, depthWrite: false })));
    out.push(line);
  } else if (m.kind === 'ring') {
    const o = propOf(m, THREE); if (o) { o.position.set(m.x, num(m.y) ? m.y : gy(m.x, m.z) + 60, m.z); if (num(m.dir)) o.rotation.y = -m.dir * Math.PI / 180; out.push(o); }
  } else if (m.kind === 'pt' || m.kind === 'spot') {
    const o = propOf(m, THREE); if (o) { o.position.set(m.x, gy(m.x, m.z), m.z); if (m.kind === 'spot' && num(m.dir)) o.rotation.y = m.dir; out.push(o); }
  }
  for (const o of out) { o.matrixAutoUpdate = false; o.updateMatrix(); }
  return out;
}
function mount(scene, o) {
  unmount();
  o = o || {};
  const THREE = o.THREE || W.THREE;
  if (!scene || !THREE || !S.runs.length) return false;
  D.THREE = THREE; D.groundFn = o.ground || null; D.ui = o.ui || null; D.scene = scene;
  D.group = new THREE.Group(); D.group.name = 'missionLive';
  for (const R of S.runs) for (const m of R.markers) {
    if (!num(m.x) && !(m.kind === 'gate' && m.posts)) continue;
    const objs = place(m, THREE);
    if (!objs.length) continue;
    const g = new THREE.Group(); for (const ob of objs) g.add(ob);
    g.matrixAutoUpdate = false; g.updateMatrix();
    D.group.add(g); D.byKey.set(R.id + '|' + m.key, { g, m });
  }
  // THE BEACON: one tall translucent column, moved onto the next objective (its centre between a gate's posts)
  D.beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const bg = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true); bg.translate(0, 0.5, 0);
  D.beacon = new THREE.Mesh(bg, D.beaconMat); D.beacon.name = 'missionBeacon'; D.beacon.renderOrder = 5; D.beacon.frustumCulled = false;
  D.group.add(D.beacon);
  scene.add(D.group);
  D.v = new THREE.Vector3();
  // THE HUD: a plate on the flight layer (flight.css #msLive), the arrow beside the screen's edge
  const ui = D.ui || (typeof document !== 'undefined' ? document.getElementById('ui') : null);
  if (ui && typeof document !== 'undefined') {
    D.el = document.createElement('div'); D.el.id = 'msLive'; D.el.hidden = true;
    D.el.innerHTML = '<b class="msT"></b><span class="msS"></span><span class="msE"></span>';
    D.timer = D.el.querySelector('.msT'); D.splits = D.el.querySelector('.msS'); D.line = D.el.querySelector('.msE');
    D.arrow = document.createElement('div'); D.arrow.id = 'msArrow'; D.arrow.hidden = true;
    D.arrow.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 L18 5 L14 12 L18 19 Z"/></svg><i></i>';
    D.arrowTxt = D.arrow.querySelector('i');
    ui.appendChild(D.el); ui.appendChild(D.arrow);
  }
  D.rev = -1;
  restyle();
  return true;
}
// the states: done hidden, later dimmed (its props' materials are the generator's, shared: the group is hidden or not,
// never a material changed), next under the beacon
function restyle() {
  if (!D.group) return;
  for (const { g, m } of D.byKey.values()) g.visible = m.state !== 'done';
  const n = next(S.smp.x, S.smp.z);
  if (D.beacon) {
    if (!n) D.beacon.visible = false;
    else {
      D.beacon.visible = true;
      const gy = D.groundFn ? D.groundFn(n.x, n.z) : 0;
      let r = 6, h = 140, y0 = gy;
      if (n.kind === 'gate' && n.posts) { r = Math.max(4, Math.hypot(n.posts[1][0] - n.posts[0][0], n.posts[1][1] - n.posts[0][1]) / 2); h = n.alt && num(n.alt.max) ? (n.alt.ref === 'msl' ? n.alt.max - gy : n.alt.max) : 150; }
      else if (n.kind === 'ring') { r = (n.r || 8) + 1.5; y0 = (num(n.y) ? n.y : gy + 60) - (n.r || 8); h = 2 * (n.r || 8); }
      else if (n.kind === 'pt') { r = Math.max(8, Math.min(n.r || 30, 400)); if (n.alt) { const msl = n.alt.ref === 'msl'; if (num(n.alt.min)) y0 = msl ? n.alt.min : gy + n.alt.min; if (num(n.alt.max)) h = (msl ? n.alt.max : gy + n.alt.max) - y0; } }
      D.beacon.position.set(n.x, y0, n.z); D.beacon.scale.set(r, Math.max(4, h), r);
    }
  }
  D.rev = S.rev;
}
const fmt = s => (num(s) ? s.toFixed(1) : '-') + ' s';
function frame(camera, now) {
  if (!D.group) return;
  if (D.rev !== S.rev) restyle();
  // the pulse: one shared material's opacity
  if (D.beaconMat) { const ph = ((now || 0) % 1600) / 1600; D.beaconMat.opacity = 0.14 + 0.16 * (0.5 + 0.5 * Math.cos(ph * 2 * Math.PI)); }
  if (!D.el) return;
  // THE TIMER: the first lap running (else the last held), its splits, the penalty - the text at 10 Hz
  let lap = null, lapId = '';
  for (const R of S.runs) if (R.T) for (const id in R.T.laps) { const L = R.T.laps[id]; if (L.s == null) { lap = L; lapId = id; break; } else if (!lap) { lap = L; lapId = id; } }
  const show = !!lap || (!!S.last && (now || 0) - S.lastAt < 4000);
  if (D.el.hidden === show) D.el.hidden = !show;
  const tq = Math.floor((now || 0) / 100);
  if (lap && (tq !== D.tq || D.hudRev !== S.rev)) {
    D.tq = tq;
    const run = lap.s == null ? Math.max(0, S.smp.t - lap.t0) + (lap.pen || 0) : lap.s;
    D.timer.textContent = lapId.toUpperCase() + '  ' + fmt(run) + (lap.pen ? '  +' + lap.pen + ' s' : '');
    if (D.hudRev !== S.rev) D.splits.textContent = (lap.splits || []).slice(-3).map(q => q.key + ' ' + fmt(q.s) + (num(q.target) ? ' (' + q.target + ')' : '')).join(' · ');
  } else if (!lap && D.timer.textContent) { D.timer.textContent = ''; D.splits.textContent = ''; }
  D.hudRev = S.rev;
  // THE LAST EVENT'S LINE (4 s)
  if (S.last && S.last !== D.lastShown) {
    D.lastShown = S.last; S.lastAt = now || 0;
    const e = S.last;
    D.line.textContent = e.k === 'hit' ? 'Through ' + e.key : e.k === 'photo' ? 'Photo taken' + (e.say && e.say.text ? ': ' + (typeof contractText === 'function' ? contractText(e.say.text) : e.say.text) : '') : e.k === 'split' ? e.key + ': ' + fmt(e.s) + (num(e.target) ? ' (target ' + e.target + ' s)' : '')
      : e.k === 'strike' ? (e.fail ? 'Hit! The mission fails' : 'Hit' + (e.pen ? ': +' + e.pen + ' s' : '')) : e.k === 'missed' ? 'Missed ' + e.key
      : e.k === 'timer' ? (e.state === 'start' ? 'Timer started' : 'Time: ' + fmt(e.s)) : '';
    D.line.className = 'msE' + (e.k === 'strike' || e.k === 'missed' ? ' warn' : '');
  }
  // THE ARROW: the next objective off-screen (or behind) -> a chevron on the screen's edge pointing to it, its distance
  const n = next(S.smp.x, S.smp.z);
  if (!n || !camera || !D.arrow) { if (D.arrow && !D.arrow.hidden) D.arrow.hidden = true; return; }
  const gy = D.groundFn ? D.groundFn(n.x, n.z) : 0;
  D.v.set(n.x, n.kind === 'ring' && num(n.y) ? n.y : gy + 40, n.z).project(camera);
  const behind = D.v.z > 1, on = !behind && Math.abs(D.v.x) <= 0.92 && Math.abs(D.v.y) <= 0.88;
  if (on) { if (!D.arrow.hidden) D.arrow.hidden = true; return; }
  let ax = D.v.x, ay = D.v.y;
  if (behind) { ax = -ax; ay = -ay; }
  const k = 1 / Math.max(Math.abs(ax) / 0.9, Math.abs(ay) / 0.84, 1e-6);
  ax *= k; ay *= k;
  const vw = typeof innerWidth === 'number' ? innerWidth : 1280, vh = typeof innerHeight === 'number' ? innerHeight : 720;
  const px = (ax * 0.5 + 0.5) * vw, py = (-ay * 0.5 + 0.5) * vh, ang = Math.atan2(-ay, ax) * 180 / Math.PI + 180;
  D.arrow.style.transform = 'translate(' + px.toFixed(0) + 'px,' + py.toFixed(0) + 'px) translate(-50%,-50%)';
  D.arrow.firstChild.style.transform = 'rotate(' + ang.toFixed(0) + 'deg)';
  const dist = Math.hypot(n.x - S.smp.x, n.z - S.smp.z), dt = dist >= 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist / 10) * 10 + ' m';
  if (D.arrowTxt.textContent !== dt) D.arrowTxt.textContent = dt;
  if (D.arrow.hidden) D.arrow.hidden = false;
}
function unmount() {
  if (D.group) {
    if (D.scene) D.scene.remove(D.group);
    // the props' materials are the finish's (kept for the next mount); the geometries are ours
    D.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    for (const g of D.cache.values()) g.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    if (D.beaconMat) D.beaconMat.dispose();
  }
  if (D.el) D.el.remove(); if (D.arrow) D.arrow.remove();
  D.group = null; D.beacon = null; D.beaconMat = null; D.byKey.clear(); D.cache.clear(); D.el = null; D.arrow = null; D.scene = null;
}

W.MISSION_LIVE = {
  RATE, arm, due, tick, evidence, timers, next, end, mount, frame, unmount, aboard: () => S.aboard.slice(),
  runs: () => S.runs.map(R => ({ id: R.id, tracked: R.tracked, seq: !!(R.T && R.T.seq), objs: R.T ? R.T.objs.map(o => o.key) : [], hits: R.T ? Object.assign({}, R.T.hits) : {},
                                 missed: Object.keys(R.missed), markers: R.markers.map(m => ({ key: m.key, kind: m.kind, state: m.state, x: m.x, z: m.z })) })),
  drawn: () => (D.group ? { meshes: D.byKey.size, beacon: !!(D.beacon && D.beacon.visible), arrow: !!(D.arrow && !D.arrow.hidden), hud: !!(D.el && !D.el.hidden) } : null),
  active: () => S.runs.length > 0,
};
})();
