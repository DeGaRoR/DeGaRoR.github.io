#!/usr/bin/env node
// GATE ROLLANIM (B10, G1035-G1039) — the roll-out shot (src/viewer/rollanim.js), in node, on the real
// vendor three.js (r186) and the real generated aeroplanes: every archetype of tools/_cage_design.js built
// (buildGen), stood on its wheels the way app.js enterGarage does (sim.reset + standOnWheels, copied), rigged
// the way app.js's model is (wheelParts at the axle nodes with their radius, one prop per engine carrying
// engIdx), in a room with the club shed's dims (and the works and field sheds for the eye's plan). The shot
// is driven through the HOST's two hooks, ROLLANIM.frame(dt) / ROLLANIM.camera(), as the page drives it.
//
//   G1035  THE AEROPLANE ENDS OUTSIDE: at the last frame its whole box is past the door plane, and the eye's
//          plan crosses no wall in the club shed (the path legal, the aeroplane in sight); after onDone the
//          craft is back at identity (the caller re-homes it in the world as before)
//   G1036  THE WHEELS ROLL: each wheel turned exactly rolled / R (its own radius), in poseModel's sense;
//          the roll is the plan's length; the shot lasts 4-6 s; the props held at idle through sim.out.rpm
//          and the old values put back
//   G1037  NO ALLOCATION A FRAME: the heap over 400 hooked frames (after warm-up) under a small bound
//   G1038  THE SKIP: a key (and a click) mid-shot calls onDone ONCE, at once, with the craft put back;
//          `skip: true` calls it synchronously; cancel() never calls it
//   G1039  EVERY BUILD: every archetype plays without throwing (a floatplane is SKIPPED, cleanly: onDone
//          once, a reason); the last frame's eye is the stand's first frame (flRevealStart's az / el / dist
//          round the CG, for chase, orbit and wing, both sides) - the cut reads as a continuation
//   G1064  THE CONTROL CHECK, THEN THE ROLL (POLISH-1): driven as the host drives it - the shed's sweep writing
//          sim.ctl before ROLLANIM.frame, the model's linkage stepped after it (poseModel) - every archetype:
//          the phases in order (every check frame before every roll frame, the aeroplane at rest through the
//          check), the check's length (lead + 0.65 s a stick surface + 0.9 s the flaps + settle: 3.3 s, <= 4), the
//          surfaces one at a time in the user's order (ailerons, elevator, rudder, flaps), each DRAWN to its full
//          throw (the linkage snapped: both ways for a stick surface, down and up for the flaps), and through the
//          whole roll the four drawn surfaces and the controls exactly 0 - neutral and still - over the sweep.
//          Only the drives the model draws (a flapless build skips the flaps); check: false rolls at once; a skip
//          mid-check leaves nothing deflected; no allocation a frame in the check or the roll with the linkage.
//   G1115-G1117  THE WORLD ROLL (ROLLOUT-REAL, playWorld): out of the world's own shed (a room frame stood at a stand's
//          geometry: Jolene HOME's and others, the club, works and field sheds) onto the stand - it ends on the stand's pose
//          exactly (the craft at identity) and the flight's first eye; it starts in the shed, crosses the door straight,
//          no jump a frame, the wheels rolled / R, the establishing eye clear; no allocation a frame; skip, cancel,
//          refusals. And the check alone (roll: false), and option B (follow: false: the eye fixed in the shed).
//
//   node tools/_rollanim_check.js            -> "GATE ROLLANIM: PASS|FAIL"
//   node tools/_rollanim_check.js --verbose  -> a line per build (the roll, the time, the eye's plan)
//   node tools/_rollanim_check.js --page     -> the page itself, ?rollanim=solo (by hand: ~3 min, ~3.6 GB)
'use strict';
const path = require('path');
if (typeof global.gc !== 'function') {       // G1037 needs a gc(): re-run under --expose-gc
  const r = require('child_process').spawnSync(process.execPath, ['--expose-gc', __filename, ...process.argv.slice(2)], { stdio: 'inherit' });
  process.exit(r.status == null ? 1 : r.status);
}
const T = __dirname, ROOT = path.join(T, '..');
const VERBOSE = process.argv.includes('--verbose');

// the panel shim _arch_check.js boots designBake with (its own THREE proxy), THEN the real three
function loadPanel() {
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; }
    add() { return this; } remove() {} traverse() {} }
  global.THREE = new Proxy({}, { get: (t, k) => k === 'Vector3' ? function () { return { set: noop, x: 0, y: 0, z: 0 }; } : class extends Obj {} });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    '_cage_gear.js', '_float_gen.js', '_cage_float.js', '_fit_site.js', '_fit_gen.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js', '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js',
    '_fin_gen.js', '_cage_fin.js', '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  global.window.CAGE_JOIN_ENGINES = require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES;
}
loadPanel();
const D = require(path.join(T, '_cage_design.js'));
const CORE = require(path.join(T, 'flight_core.js'));
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
global.THREE = THREE;
// a window that takes listeners (the skip's), and nothing else
global.window = new EventTarget();
require('events').setMaxListeners(0, global.window);   // (node counts every listener ever added; the skip's come and go)
const ROLLANIM = require(path.join(ROOT, 'src', 'viewer', 'rollanim.js'));

const fails = [];
let nOk = 0;
const check = (ok, label, extra) => {
  if (!ok || VERBOSE) console.log((ok ? '  ok     ' : '  FAIL   ') + label + (ok || !extra ? '' : ' — ' + extra));
  if (ok) nOk++; else fails.push(label);
  return ok;
};
const near = (a, b, e) => Math.abs(a - b) <= e;
const SHELLS = { club: { HW: 15, HD: 12.5, EAVE: 7.0 }, works: { HW: 20, HD: 20, EAVE: 9.5 }, field: { HW: 7, HD: 9, EAVE: 3.6 } };

// ---- a build, stood in the shed the way app.js stands it ----------------------------------------------
function standOnWheels(def, sim) {                 // app.js standOnWheels, verbatim in its arithmetic
  const P = def.parts, iM = P.GAL, iT = P.TW;
  if (iM == null || iT == null || iT < 0) return;
  const x0 = sim.p[iM * 3], y0 = sim.p[iM * 3 + 1];
  const rM = def.nodes[iM].r, rT = def.nodes[iT].r;
  const ux = sim.p[iT * 3] - x0, uy = sim.p[iT * 3 + 1] - y0;
  const h = Math.hypot(ux, uy), R = rT - rM;
  if (h < 1e-6 || Math.abs(R) > h) return;
  const q = Math.asin(R / h), phi = Math.atan2(uy, ux);
  const wrap = v => Math.atan2(Math.sin(v), Math.cos(v));
  const r1 = wrap(q - phi), r2 = wrap(Math.PI - q - phi);
  const a = Math.abs(r1) <= Math.abs(r2) ? r1 : r2;
  const c = Math.cos(a), s = Math.sin(a);
  for (let i = 0; i < sim.n; i++) {
    const dx = sim.p[i * 3] - x0, dy = sim.p[i * 3 + 1] - y0;
    sim.p[i * 3] = x0 + dx * c - dy * s; sim.p[i * 3 + 1] = y0 + dx * s + dy * c;
  }
}
function garage(arch, shellKey) {
  const def = CORE.buildGen(D.designBake(arch.sel, arch.over));
  const sim = CORE.makeSim(def, null);
  sim.reset(0); standOnWheels(def, sim);
  const iM = def.parts.GAL;
  let groundY = iM == null ? 0 : sim.p[iM * 3 + 1] - (def.nodes[iM].r || 0);
  let lo = Infinity;                               // app.js G439: the floor never stands inside the aeroplane
  for (let i = 0; i < sim.n; i++) if (!(def.nodes[i].r > 0)) lo = Math.min(lo, sim.p[i * 3 + 1]);
  if (Number.isFinite(lo) && lo - 0.06 < groundY) groundY = lo - 0.06;
  // the craft: the airframe as one mesh over its nodes (its box is the aeroplane's), the drawn wheels at
  // their axle nodes, one prop per engine ahead of the nose (the model's props carry engIdx, G194)
  const scene = new THREE.Scene(), craft = new THREE.Group();
  scene.add(craft);
  const pos = new Float32Array(sim.n * 3);
  for (let i = 0; i < sim.n * 3; i++) pos[i] = sim.p[i];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const body = new THREE.Mesh(g, new THREE.MeshBasicMaterial()); craft.add(body);
  const grp = new THREE.Group(); craft.add(grp);
  const wheelParts = [];
  for (let i = 0; i < sim.n; i++) if (def.nodes[i].r > 0) {
    const o = new THREE.Object3D(); o.position.set(sim.p[i * 3], sim.p[i * 3 + 1], sim.p[i * 3 + 2]); grp.add(o);
    wheelParts.push({ obj: o, idx: i, R: def.nodes[i].r });
  }
  let xNose = Infinity; for (let i = 0; i < sim.n; i++) xNose = Math.min(xNose, sim.p[i * 3]);
  const props = [];
  const nE = Math.max(1, (def.params.engines || []).length);
  for (let e = 0; e < nE; e++) { const p = new THREE.Object3D(); p.position.set(xNose - 0.1, 1, (e - (nE - 1) / 2) * 3); p.userData = { engIdx: e, spinAxis: [1, 0, 0] }; grp.add(p); props.push(p); }
  const model = { wheelParts: wheelParts.length ? wheelParts : null, props, link: CORE.makeLinkage(0.15) };   // G1064: app.js's LINK_TAU
  const dims = SHELLS[shellKey || 'club'];
  const room = new THREE.Group(); room.position.y = groundY; scene.add(room);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial()); room.add(quad);
  const mobile = new THREE.Group(); room.add(mobile);
  const hangar = { dims, group: room, doorAxis: -1, floorY: 0,
    door: { w: Math.max(6, 2 * dims.HW - 5), h: shellKey === 'field' ? dims.EAVE - 0.5 : Math.min(6.4, dims.EAVE - 1.4) },
    craftPrint: () => quad, mobileGroup: mobile, dayCard: null };
  // the shed's camera where the boot's framing puts it (az -2.5, el 0.22, dist 14, round the CG), clamped
  // into the room the way placeCamera clamps it
  const cam = new THREE.PerspectiveCamera(46, 16 / 9, 0.1, 5000);
  const cg = sim.cgPos(), az = -2.5, el = 0.22, dist = 14, m = cam.near + 0.31;
  let x = cg[0] + dist * Math.cos(el) * Math.cos(az), y = cg[1] + dist * Math.sin(el), z = cg[2] + dist * Math.cos(el) * Math.sin(az);
  x = Math.max(-(dims.HD - m), Math.min(dims.HD - m, x)); z = Math.max(-(dims.HW - m), Math.min(dims.HW - m, z));
  y = Math.max(groundY + 0.12, Math.min(groundY + dims.EAVE - 0.5, y));
  cam.position.set(x, y, z); cam.lookAt(cg[0], cg[1], cg[2]); cam.updateMatrixWorld(true);
  return { def, sim, scene, craft, model, hangar, cam, quad, mobile, groundY, cg };
}
// the host's frame loop, as app.js runs it: frame(dt) before the pose, camera() after its own placement
function drive(h, dt, n, spoil) {
  let k = 0;
  while (!h.done && k < n) {
    const went = ROLLANIM.frame(dt);
    if (spoil) spoil();                            // the host's placeCamera writing its own eye
    ROLLANIM.camera();
    k++;
    if (!went) break;
  }
  return k;
}
const tick = () => new Promise(r => setImmediate(r));
// G1064: THE HOST'S FRAME AROUND THE HOOK - app.js's shed sweep writes sim.ctl at the top of the loop (in the garage),
// ROLLANIM.frame runs just before poseModel, and poseModel steps the linkage off sim.ctl. rec(): a row a frame
const SWEEP = (ctl, t) => { ctl.de = 0.30 * Math.sin(t * 0.90); ctl.da = 0.35 * Math.sin(t * 0.62 + 1.0); ctl.dr = 0.35 * Math.sin(t * 0.45 + 2.0); ctl.flap = 0.5 - 0.5 * Math.cos(t * 0.33); };
const CK_KEYS = ['da', 'de', 'dr', 'flap'];
function hostFrame(G, h, dt, clock, rows) {
  clock.t += dt;
  SWEEP(G.sim.ctl, clock.t);
  const went = ROLLANIM.frame(dt);
  const L = G.model.link.step(G.sim.ctl, dt);
  if (rows && went) rows.push({ ph: h.phase === 'done' && went ? 'roll' : h.phase, tc: h.tCheck, t: h.t, rolled: h.rolled, x: G.craft.position.x,
    link: CK_KEYS.map(k => L[k] || 0), ctl: CK_KEYS.map(k => G.sim.ctl[k] || 0) });
  return went;
}
// the G1064 checks on one shot's rows
function checkRows(name, h, rows, want) {
  const P = h.plan, CK = P.check;
  const iRoll = rows.findIndex(r => r.ph === 'roll'), lastCheck = rows.map(r => r.ph).lastIndexOf('check');
  check(iRoll > 0 && lastCheck === iRoll - 1 && rows.slice(0, iRoll).every(r => r.ph === 'check') && rows.slice(iRoll).every(r => r.ph === 'roll'),
    name + ': G1064 the check first, then the roll (' + iRoll + ' check frames, ' + (rows.length - iRoll) + ' roll frames)', 'roll from ' + iRoll + ', last check ' + lastCheck);
  const segs = CK.segs.map(g => g.drive).join(',');
  check(segs === want.join(','), name + ': G1064 the surfaces checked in the user\'s order: ' + segs, segs + ' / ' + want.join(','));
  const S = ROLLANIM.S, Tw = S.checkLead + S.checkSeg * want.filter(k => k !== 'flap').length + (want.indexOf('flap') >= 0 ? S.checkFlap : 0) + S.checkSettle;
  check(near(CK.T, Tw, 1e-9) && CK.T >= 1.5 && CK.T <= 4 && near(P.Ttotal, CK.T + P.T.T, 1e-9), name + ': G1064 the check lasts ' + CK.T.toFixed(2) + ' s (brisk), the shot ' + P.Ttotal.toFixed(2) + ' s', CK.T);
  check(Math.abs(iRoll / 60 - CK.T) < 2 / 60, name + ': G1064 the roll starts when the check ends (' + (iRoll / 60).toFixed(2) + ' s)', iRoll / 60);
  check(rows.slice(0, iRoll).every(r => r.rolled === 0 && r.x === 0), name + ': G1064 the aeroplane at rest through the check');
  // one surface at a time, each drawn to its throw, in its own window
  let two = 0;
  for (const r of rows.slice(0, iRoll)) if (r.link.filter(v => Math.abs(v) > 1e-12).length > 1) two++;
  check(two === 0, name + ': G1064 one surface moves at a time', two + ' frames with two');
  let order = -1, ok = true, why = '';
  for (const g of CK.segs) {
    const j = CK_KEYS.indexOf(g.drive), xs = rows.slice(0, iRoll).map(r => r.link[j]);
    const mx = Math.max(...xs), mn = Math.min(...xs), iPk = xs.indexOf(g.drive === 'flap' ? mx : mx);
    const inWin = rows.slice(0, iRoll).every((r, i) => Math.abs(r.link[j]) < 1e-12 || (r.tc > g.t0 - 1e-9 && r.tc < g.t1 + 1e-9));
    const throwOk = g.drive === 'flap' ? mx > 0.95 * g.amp && mn > -1e-12 : mx > 0.95 * g.amp && mn < -0.95 * g.amp;
    if (!throwOk || !inWin || iPk < order) { ok = false; why += g.drive + ' [' + mn.toFixed(3) + ', ' + mx.toFixed(3) + '] in its window ' + inWin + '; '; }
    order = iPk;
  }
  check(ok, name + ': G1064 each surface drawn to its full throw and back (the linkage snapped: ailerons, elevator, rudder both ways, the flaps down and up), in its turn', why);
  // THE ROLL: neutral and still, over the host's sweep
  let moved = 0, worst = 0;
  for (const r of rows.slice(iRoll)) for (let j = 0; j < 4; j++) { const v = Math.max(Math.abs(r.link[j]), Math.abs(r.ctl[j])); if (v > 0) moved++; worst = Math.max(worst, v); }
  check(moved === 0, name + ': G1064 through the roll the four surfaces are neutral and still (drawn and commanded exactly 0, over the shed\'s sweep)', moved + ' non-zero, worst ' + worst);
}

// ---- --page: THE PAGE ITSELF (by hand, ~2-4 min and ~3.6 GB: tools/_page_node.js, FRAMECOST's harness) ----
// dev.html's own scripts on the real three and a recording GL, ?rollanim=solo: the shed boots with the
// player's default aeroplane (the Cub), the shot plays through app.js's own hooks (the frame loop's two
// ROLLANIM lines, the solo call site), and it is held to the same things on the REAL model: out past the door,
// the drawn wheels turned rolled / R, the props spun by poseModel off the held rpm, the eye on the stand's
// frame at the last frame over placeCamera's, onDone once, the aeroplane put back, no page error.
async function pageCheck() {
  const { openPage } = require('./_page_node.js');
  const cap = { calls: [], frames: 0, last: null, mid: null, phases: '', rollCtl: 0, checkMax: [0, 0, 0, 0] };
  const hooks = { afterScript(name, P) {
    if (name !== 'src/viewer/rollanim.js' || !P.win.ROLLANIM) return;
    const R = P.win.ROLLANIM, play = R.play;
    R.play = function (o) {
      const rec = { o, wheels0: null, onDone: 0 };
      const mw = o.model && o.model.wheelParts;
      rec.wheels0 = mw ? mw.map(w => w.obj.rotation.z) : [];
      const od = o.onDone; o.onDone = h => { rec.onDone++; rec.craftAtDone = o.craft.position.x; if (od) od(h); };
      rec.h = play.call(this, o); cap.calls.push(rec); return rec.h;
    };
  } };
  const P = await openPage({ quiet: true, hooks, query: 'rollanim=solo' });
  const W = P.win;
  P.onFrame(ph => {
    const rec = cap.calls[0];
    if (ph !== 'end' || !rec || rec.h.done) return;
    cap.frames++;
    const o = rec.o;
    o.craft.updateMatrixWorld(true);
    const bx = new W.THREE.Box3().setFromObject(o.craft);
    cap.last = { box: bx, cam: o.camera.position.clone(), t: rec.h.t, rolled: rec.h.rolled, wheels: o.model.wheelParts.map(w => w.obj.rotation.z) };
    if (!cap.mid && rec.h.t > 2) cap.mid = { spin: (o.model.props || []).map(p => (p.userData && p.userData.spinRate) || 0) };
    // G1064: the phases as the page played them; the controls through the roll (after poseModel: the host's sweep, the
    // shot's neutral), the largest deflection each drive reached in the check
    const phs = rec.h.phase; if (cap.phases.slice(-5) !== phs.slice(0, 5)) cap.phases += (cap.phases ? '>' : '') + phs.slice(0, 5);
    const c = o.sim.ctl, v = [c.da || 0, c.de || 0, c.dr || 0, c.flap || 0];
    if (phs === 'roll') cap.rollCtl = Math.max(cap.rollCtl, ...v.map(Math.abs));
    else if (phs === 'check') v.forEach((x, i) => { cap.checkMax[i] = Math.max(cap.checkMax[i], Math.abs(x)); });
  });
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  await P.until(() => cap.calls.length && cap.calls[0].h.done, 120000);
  await P.frames(3);
  const rec = cap.calls[0];
  if (!check(!!rec, 'page: ?rollanim=solo played the shot once the shed was up')) return;
  const h = rec.h, Pl = h.plan;
  check(!h.skipped && h.done && rec.onDone === 1, 'page: the shot ran to its end, onDone once', 'skipped ' + h.skipped + ', onDone ' + rec.onDone);
  check(cap.frames >= Pl.Ttotal * 55, 'page: ' + cap.frames + ' hooked frames for a ' + Pl.Ttotal.toFixed(2) + ' s shot (the page\'s 60 Hz clock)');
  check(cap.phases === 'check>roll', 'page: G1064 the control check, then the roll (' + cap.phases + ')', cap.phases);
  check(Pl.check.segs.every(g => cap.checkMax[['da', 'de', 'dr', 'flap'].indexOf(g.drive)] > 0.9 * g.amp), 'page: G1064 every drawn surface of the Cub checked to its throw (' + Pl.check.segs.map(g => g.drive).join(', ') + ')', JSON.stringify(cap.checkMax));
  check(cap.rollCtl === 0, 'page: G1064 the controls neutral through the roll, over the shed\'s sweep', cap.rollCtl);
  const door = Pl.xDoor;
  check(cap.last.box.max.x < door - 1.0, 'page: G1035 the Cub ends past the door plane', 'tail ' + cap.last.box.max.x.toFixed(2) + ', door ' + door.toFixed(2));
  check(Pl.bad === 0, 'page: G1035 the eye crosses no wall', Pl.bad);
  check(Math.abs(rec.craftAtDone) < 1e-12, 'page: the aeroplane put back when onDone runs');
  let worst = 0;
  rec.o.model.wheelParts.forEach((w, i) => { worst = Math.max(worst, Math.abs(cap.last.wheels[i] - rec.wheels0[i] - Pl.L / w.R)); });
  check(rec.o.model.wheelParts.length >= 3 && worst < 1e-6, 'page: G1036 the drawn wheels (' + rec.o.model.wheelParts.length + ') turned rolled / R', 'worst ' + worst);
  check(cap.mid && cap.mid.spin.length > 0 && cap.mid.spin.every(v => v > 30), 'page: the prop spun by poseModel at idle (' + (cap.mid ? cap.mid.spin.map(v => (v * 60 / 2 / Math.PI).toFixed(0)).join(', ') : '-') + ' rpm)');
  const F = W.ROLLANIM.standFraming(Pl.mode, Pl.D, Pl.side), c = cap.last.cam, cg = Pl.cg;
  const ex = c.x - (cg[0] - Pl.L), ey = c.y - cg[1], ez = c.z - cg[2], dE = Math.hypot(ex, ey, ez);
  check(Math.abs(dE - F.dist) < 1e-4 && Math.abs(Math.atan2(ez, ex) - F.az) < 1e-4, 'page: G1039 the last frame\'s eye is the stand\'s first (' + Pl.mode + ', side ' + Pl.side + ')',
    'd ' + dE.toFixed(3) + '/' + F.dist.toFixed(3) + ' az ' + Math.atan2(ez, ex).toFixed(4) + '/' + F.az.toFixed(4));
  const errs = P.errors.filter(e => !/sheet EMPTY/.test(e));
  check(errs.length === 0, 'page: no page error', errs.slice(0, 3).join(' | '));
  console.log('  page: L ' + Pl.L.toFixed(1) + ' m, T ' + Pl.T.T.toFixed(2) + ' s, ' + cap.frames + ' frames, the Cub\'s wheels ' + rec.o.model.wheelParts.map(w => w.R.toFixed(3)).join(' / ') + ' m');
}

(async () => {
  if (process.argv.includes('--page')) {
    await pageCheck();
    if (fails.length) { console.log('GATE ROLLANIM --page: FAIL (' + fails.join('; ') + ')'); process.exit(1); }
    console.log('GATE ROLLANIM --page: PASS'); process.exit(0);
  }
  const archs = D.ARCHETYPES.filter(a => !D.archInactive(a));
  console.log('GATE ROLLANIM: ' + archs.length + ' archetypes, the club shed; the eye planned in the works and field sheds too');
  let floatsSeen = 0, rolled = 0, worstBad = { club: 0, works: 0, field: 0 }, planned = { works: 0, field: 0 };
  const Ls = [], Ts = [];
  for (const a of archs) {
    let G;
    try { G = garage(a, 'club'); } catch (e) { check(false, a.name + ': built and stood in the shed', e.message); continue; }
    const hasWheels = G.def.nodes.some(n => n.r > 0);
    let calls = 0, h, lastBox = null, lastCam = null, rpmMid = null;
    try {
      h = ROLLANIM.play({ craft: G.craft, scene: G.scene, camera: G.cam, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim,
                          camMode: 'orbit', fov: 46, onDone: () => { calls++; } });
    } catch (e) { check(false, a.name + ': play() does not throw', e.stack); continue; }
    if (!hasWheels) {
      floatsSeen++;
      check(h.done && calls === 1 && !!h.skipped, a.name + ': no wheel (floats) -> skipped cleanly, onDone once', 'done ' + h.done + ' calls ' + calls + ' why ' + h.skipped);
      check(!ROLLANIM.busy(), a.name + ': nothing left playing');
      continue;
    }
    const P = h.plan;
    Ls.push(P.L); Ts.push(P.T.T);
    let n = 0, threw = null;
    const rows = [], clock = { t: 0 };
    try {
      while (!h.done && n < 2000) {
        const went = hostFrame(G, h, 1 / 60, clock, rows);   // (the shed's sweep, the hook, the linkage: G1064)
        G.cam.position.set(0, 3, 0);                // the host's placeCamera, overwritten by camera() below
        ROLLANIM.camera();
        n++;
        if (n === 90) rpmMid = G.sim.out.rpm.slice();
        if (!went) break;
      }
      // the last frame, before the microtask puts it back: where the aeroplane and the eye are
      G.craft.updateMatrixWorld(true);
      lastBox = new THREE.Box3().setFromObject(G.craft);
      lastCam = G.cam.position.clone();
      const dir = new THREE.Vector3(); G.cam.getWorldDirection(dir); lastCam.dir = dir;
      await tick();
    } catch (e) { threw = e; }
    if (!check(!threw, a.name + ': the shot plays without throwing', threw && threw.stack)) continue;
    rolled++;
    const xDoor = -G.hangar.dims.HD;
    // G1035
    check(lastBox.max.x < xDoor - 1.0, a.name + ': G1035 the whole aeroplane ends past the door plane', 'tail at ' + lastBox.max.x.toFixed(2) + ', door at ' + xDoor);
    check(P.bad === 0, a.name + ': G1035 the eye crosses no wall and keeps the aeroplane in sight (club shed)', P.bad + ' bad samples');
    worstBad.club = Math.max(worstBad.club, P.bad);
    check(h.done && calls === 1, a.name + ': onDone once at the end', 'calls ' + calls);
    check(G.craft.position.lengthSq() === 0 && G.craft.quaternion.w === 1, a.name + ': G1035 the craft put back at identity after onDone');
    check(G.quad.position.x === 0, a.name + ': the print put back');
    // G1036
    check(near(h.rolled, P.L, 1e-9), a.name + ': G1036 rolled the plan\'s length', h.rolled + ' vs ' + P.L);
    let worst = 0;
    G.model.wheelParts.forEach((w, i) => { worst = Math.max(worst, Math.abs(w.obj.rotation.z - P.L / w.R), Math.abs(h.spun[i] - P.L / w.R)); });
    check(worst < 1e-9, a.name + ': G1036 each wheel turned rolled / R (' + G.model.wheelParts.map(w => (P.L / w.R).toFixed(1)).join(', ') + ' rad)', 'worst error ' + worst);
    check(P.T.T >= 4 - 1e-9 && P.T.T <= 6 + 1e-9, a.name + ': G1036 4-6 s', P.T.T.toFixed(2) + ' s');
    check(rpmMid && G.model.props.every(p => rpmMid[p.userData.engIdx] > 300), a.name + ': the props held at idle through sim.out.rpm', JSON.stringify(rpmMid));
    check(G.sim.out.rpm.length === 0, a.name + ': sim.out.rpm put back', JSON.stringify(G.sim.out.rpm));
    checkRows(a.name, h, rows, CK_KEYS);
    // G1039: the last frame's eye is the stand's first frame round the CG
    const cgE = [G.cg[0] - P.L, G.cg[1], G.cg[2]], F = ROLLANIM.standFraming('orbit', G.def.params.viewDist, P.side);
    const ex = lastCam.x - cgE[0], ey = lastCam.y - cgE[1], ez = lastCam.z - cgE[2], dE = Math.hypot(ex, ey, ez);
    const azE = Math.atan2(ez, ex), elE = Math.asin(ey / dE);   // the tail's direction here is +x: hdg 0
    check(near(dE, F.dist, 1e-6) && near(azE, F.az, 1e-6) && near(elE, F.el, 1e-6),
      a.name + ': G1039 the last frame is flRevealStart\'s first (orbit, side ' + P.side + ')', 'az ' + azE.toFixed(4) + '/' + F.az.toFixed(4) + ' el ' + elE.toFixed(4) + ' d ' + dE.toFixed(3) + '/' + F.dist.toFixed(3));
    const toCg = new THREE.Vector3(-ex, -ey, -ez).normalize();
    check(toCg.dot(lastCam.dir) > 1 - 1e-9, a.name + ': G1039 aimed at the CG at the cut');
    if (VERBOSE) console.log('         ' + a.name + ': L ' + P.L.toFixed(1) + ' m (min ' + P.Lmin.toFixed(1) + '), T ' + P.T.T.toFixed(2) + ' s, v ' + P.T.v.toFixed(1) + ' m/s, side ' + P.side + ', lag ' + P.lag + ', ' + n + ' frames');
    // the eye's plan in the other sheds (reported; the field shed's 3.6 m eave may leave a clamp)
    for (const sk of ['works', 'field']) {
      const G2 = garage(a, sk);
      const P2 = ROLLANIM.plan({ craft: G2.craft, scene: G2.scene, camera: G2.cam, hangar: G2.hangar, model: G2.model, def: G2.def, sim: G2.sim, camMode: 'orbit' });
      worstBad[sk] = Math.max(worstBad[sk], P2.bad); planned[sk]++;
      check(P2.bad < 100, a.name + ': the stand\'s eye is legal at the stop (' + sk + ' shed)', P2.bad);
      if (sk === 'works') check(P2.bad === 0, a.name + ': the eye crosses no wall (works shed)', P2.bad);
    }
  }
  check(floatsSeen >= 1, 'a floatplane archetype was met and skipped', floatsSeen);
  check(rolled >= 20, 'the wheeled archetypes rolled (' + rolled + ')', rolled);
  console.log('  rolls ' + Math.min(...Ls).toFixed(1) + '-' + Math.max(...Ls).toFixed(1) + ' m, shots ' + Math.min(...Ts).toFixed(2) + '-' + Math.max(...Ts).toFixed(2) +
              ' s; the eye\'s worst plan: club ' + worstBad.club + ', works ' + worstBad.works + ', field ' + worstBad.field + ' bad samples of 49 (clamped per frame)');

  // ---- G1039: the framings and sides, on the Cub, the C172 and a twin ----------------------------------
  for (const name of ['Cub-alike', 'C172-alike', 'DA62-alike', 'Tiger Moth-alike']) {
    const a = archs.find(x => x.name === name);
    if (!check(!!a, name + ': is an archetype')) continue;
    for (const mode of ['chase', 'orbit', 'wing']) for (const side of [1, -1]) {
      const G = garage(a, 'club');
      let calls = 0;
      const h = ROLLANIM.play({ craft: G.craft, scene: G.scene, camera: G.cam, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim, camMode: mode, side, onDone: () => calls++ });
      drive(h, 1 / 60, 2000, () => G.cam.position.set(0, 3, 0));
      const P = h.plan, F = ROLLANIM.standFraming(mode, G.def.params.viewDist, side);
      const ex = G.cam.position.x - (G.cg[0] - P.L), ey = G.cam.position.y - G.cg[1], ez = G.cam.position.z - G.cg[2], dE = Math.hypot(ex, ey, ez);
      const dAz = Math.atan2(Math.sin(Math.atan2(ez, ex) - F.az), Math.cos(Math.atan2(ez, ex) - F.az));
      const ok = near(dE, F.dist, 1e-6) && Math.abs(dAz) < 1e-6 && near(Math.asin(ey / dE), F.el, 1e-6);
      check(ok, name + ': G1039 ' + mode + ' side ' + side + ' ends on the stand\'s first frame' + (P.bad ? ' (' + P.bad + ' clamped samples)' : ''), 'dAz ' + dAz + ' d ' + dE + '/' + F.dist);
      await tick();
      check(calls === 1, name + ': ' + mode + ' ' + side + ' onDone once', calls);
    }
  }
  // ANY START: the shed's orbit may leave the eye anywhere in the room - 40 random eyes (seeded) round the Cub
  // and the twin bush hauler plan a path that crosses no wall; and an eye INSIDE the aeroplane (a fresh
  // profile's chooser leaves the camera at the origin: seen in Chromium) starts from the shed's boot framing
  {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const name of ['Cub-alike', 'Twin bush hauler']) {
      const a = archs.find(x => x.name === name), G = garage(a, 'club'), d = G.hangar.dims;
      let worst = 0, Lmax = 0;
      for (let i = 0; i < 20; i++) {
        G.cam.position.set(-d.HD + 0.7 + rnd() * (2 * d.HD - 1.4), G.groundY + 0.3 + rnd() * (d.EAVE - 1), -d.HW + 0.7 + rnd() * (2 * d.HW - 1.4));
        G.cam.lookAt(G.cg[0], G.cg[1], G.cg[2]); G.cam.updateMatrixWorld(true);
        const P = ROLLANIM.plan({ craft: G.craft, scene: G.scene, camera: G.cam, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim, camMode: 'orbit' });
        worst = Math.max(worst, P.bad); Lmax = Math.max(Lmax, P.L);
      }
      check(worst === 0 && Lmax < 40, name + ': 20 random shed eyes all plan a legal path (the longest roll ' + Lmax.toFixed(1) + ' m)', 'worst ' + worst + ', L ' + Lmax);
      G.cam.position.set(0, 0, 0); G.cam.lookAt(0, 0, -1); G.cam.updateMatrixWorld(true);
      let calls = 0;
      const h = ROLLANIM.play({ craft: G.craft, scene: G.scene, camera: G.cam, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim, camMode: 'orbit', onDone: () => calls++ });
      drive(h, 1 / 60, 2000); await tick();
      check(h.plan.fresh && h.plan.bad === 0 && calls === 1, name + ': an eye inside the aeroplane starts from the boot framing and plays', JSON.stringify({ fresh: h.plan.fresh, bad: h.plan.bad, calls }));
    }
  }
  // the framing table IS flRevealStart's (app.js): read the source, so a change there breaks this
  {
    const src = require('fs').readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
    const i0 = src.indexOf('function flRevealStart'), body = src.slice(i0, src.indexOf('flReveal = FL_REVEAL_FRAMES;', i0));
    check(/az = tgt \+ s \* 0\.45; el = 0\.16; dist = D \* 1\.7;/.test(body) && /astern \+ \(cam\.mode === 'orbit' \? s \* 0\.55 : 0\)/.test(body)
          && /cam\.mode === 'wing' \? hdg - Math\.PI \/ 2/.test(body),
      'G1039 flRevealStart still frames the stand as standFraming assumes (tgt + s*0.45, el 0.16, 1.7 D; orbit +0.55, wing -PI/2)');
  }

  // ---- G1038: the skip ---------------------------------------------------------------------------------
  {
    const a = archs.find(x => x.name === 'Cub-alike');
    for (const kind of ['keydown', 'pointerdown']) {
      const G = garage(a, 'club');
      let calls = 0, putBackAtCall = null;
      const h = ROLLANIM.play({ craft: G.craft, scene: G.scene, camera: G.cam, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim,
        onDone: () => { calls++; putBackAtCall = G.craft.position.lengthSq() === 0; } });
      drive(h, 1 / 60, 120);
      const ev = new Event(kind, { cancelable: true });
      let reached = false;
      const late = () => { reached = true; };
      window.addEventListener(kind, late);          // a listener the skip must shadow (it takes the capture phase)
      window.dispatchEvent(ev);
      window.removeEventListener(kind, late);
      check(calls === 1 && h.done, 'G1038 a ' + kind + ' mid-shot: onDone at once, once', 'calls ' + calls);
      check(putBackAtCall === true, 'G1038 ' + kind + ': the craft already put back when onDone runs');
      check(!reached && ev.defaultPrevented, 'G1038 ' + kind + ': the skip takes the event (nothing else sees it)');
      window.dispatchEvent(new Event(kind)); drive(h, 1 / 60, 50); await tick();
      check(calls === 1 && !ROLLANIM.busy(), 'G1038 ' + kind + ': a second input / frame does not call it again', calls);
    }
    {
      let calls = 0;
      const G = garage(a, 'club');
      const h = ROLLANIM.play({ craft: G.craft, camera: G.cam, scene: G.scene, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim, skip: true, onDone: () => calls++ });
      check(calls === 1 && h.done && !!h.skipped, 'G1038 skip: true -> onDone synchronously, once', calls);
    }
    {
      let calls = 0;
      const G = garage(a, 'club');
      const h = ROLLANIM.play({ craft: G.craft, camera: G.cam, scene: G.scene, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim, onDone: () => calls++ });
      drive(h, 1 / 60, 100); h.cancel(); drive(h, 1 / 60, 500); await tick();
      window.dispatchEvent(new Event('keydown'));
      check(calls === 0 && G.craft.position.lengthSq() === 0 && !ROLLANIM.busy(), 'G1038 cancel(): no onDone, the craft put back, no listener left', calls);
    }
    {
      // a second play() over a running one cancels the first (no onDone for it)
      let c1 = 0, c2 = 0;
      const G = garage(a, 'club');
      const h1 = ROLLANIM.play({ craft: G.craft, camera: G.cam, scene: G.scene, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim, onDone: () => c1++ });
      drive(h1, 1 / 60, 60);
      const h2 = ROLLANIM.play({ craft: G.craft, camera: G.cam, scene: G.scene, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim, onDone: () => c2++ });
      drive(h2, 1 / 60, 2000); await tick();
      check(c1 === 0 && c2 === 1, 'a play() over a running shot cancels it (onDone for the second only)', c1 + ' / ' + c2);
    }
  }

  // ---- G1064: the drives the model draws; no check; a skip mid-check ----------------------------------------
  {
    const a = archs.find(x => x.name === 'Cub-alike');
    const shot = (G, extra) => {
      let calls = 0; const rows = [], clock = { t: 0 };
      const h = ROLLANIM.play(Object.assign({ craft: G.craft, camera: G.cam, scene: G.scene, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim, onDone: () => calls++ }, extra || {}));
      return { h, rows, clock, calls: () => calls };
    };
    for (const [label, moving, want] of [
      ['a flapless V-tail build (ailerons, ruddervators)', [{ c: { drive: 'da' } }, { c: { drive: 'de', drive2: 'dr' } }, { c: { drive: 'trim' } }], ['da', 'de', 'dr']],
      ['a flying wing (elevons)', [{ c: { drive: 'da', drive2: 'de' } }], ['da', 'de']]]) {
      const G = garage(a, 'club'); G.model.moving = moving;
      const R = shot(G);
      while (!R.h.done && R.rows.length < 2000) { if (!hostFrame(G, R.h, 1 / 60, R.clock, R.rows)) break; }
      await tick();
      checkRows(label, R.h, R.rows, want);
      check(R.calls() === 1, label + ': onDone once', R.calls());
    }
    {
      const G = garage(a, 'club'), R = shot(G, { check: false });
      hostFrame(G, R.h, 1 / 60, R.clock, R.rows);
      check(R.h.plan.check.T === 0 && R.rows[0].ph === 'roll' && R.rows[0].rolled === 0 && near(R.h.plan.Ttotal, R.h.plan.T.T, 0),
        'G1064 check: false - no check, the roll at once (the shed\'s sweep left alone)', JSON.stringify({ T: R.h.plan.check.T, ph: R.rows[0].ph }));
      check(R.rows[0].ctl.some(v => v !== 0), 'G1064 check: false - the shot does not touch the controls', JSON.stringify(R.rows[0].ctl));
      R.h.cancel();
    }
    {
      const G = garage(a, 'club'), R = shot(G);
      for (let i = 0; i < 70; i++) hostFrame(G, R.h, 1 / 60, R.clock, R.rows);    // 1.17 s: the elevator's turn
      const mid = R.rows[R.rows.length - 1];
      window.dispatchEvent(new Event('keydown', { cancelable: true }));
      const L = G.model.link.step(G.sim.ctl, 0);
      check(mid.ph === 'check' && mid.link[1] !== 0 && R.h.done && R.calls() === 1 && CK_KEYS.every(k => G.sim.ctl[k] === 0 && L[k] === 0) && G.craft.position.lengthSq() === 0,
        'G1064 a skip mid-check: onDone at once, every surface neutral (the linkage snapped), the aeroplane put back', JSON.stringify({ ph: mid.ph, calls: R.calls(), ctl: CK_KEYS.map(k => G.sim.ctl[k]), link: CK_KEYS.map(k => L[k]) }));
    }
  }

  // ---- THE KIT IN THE WAY --------------------------------------------------------------------------------
  {
    const a = archs.find(x => x.name === 'C172-alike');   // a high wing: a jerrycan passes under it, a hand truck on the centreline does not
    const G = garage(a, 'club');
    const bx = new THREE.Box3().setFromObject(G.craft);
    const mk = (x, z, h) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.4, h, 0.4), new THREE.MeshBasicMaterial()); m.position.set(x, h / 2, z); G.mobile.add(m); return m; };
    const onLine = mk(bx.min.x - 1, 0, 1.2), wide = mk(bx.min.x - 1, bx.max.z + 3, 1.2), under = mk(bx.min.x - 1, bx.max.z - 0.6, 0.35);
    let calls = 0;
    const h = ROLLANIM.play({ craft: G.craft, camera: G.cam, scene: G.scene, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim, onDone: () => calls++ });
    // the test mesh is the aeroplane's whole node cloud (one box), so `under` is inside it here: the real
    // model's meshes are tested one by one (a wing over a jerrycan). What is held: in the path -> hidden,
    // beside it -> kept, all put back
    check(!onLine.visible && wide.visible, 'the mobile prop in the path is hidden, the one beside it is not', onLine.visible + ' / ' + wide.visible);
    drive(h, 1 / 60, 2000); await tick();
    check(onLine.visible && wide.visible && under.visible && calls === 1, 'the hidden kit comes back at the end');
  }

  // ---- G1115-G1117 THE WORLD ROLL (ROLLOUT-REAL): playWorld out of the world's own shed onto the stand -----------------
  // The aeroplane stood as the shed stands it is THE STAND here (its nose along -x; the sim's frame is the world's); a shed
  // node is stood so its door faces the stand at a given angle and distance (render_world's: a room frame, door at local -x,
  // the slab at local y 0). The host's hooks drive it as app.js does. Held:
  //   G1115  IT ENDS ON THE FLIGHT: the last frame's craft is at identity (the stand's pose, exactly), the eye on
  //          opts.end.eye aimed at opts.end.look; onDone once; nothing left moved (the contact mesh too)
  //   G1116  IT STARTS IN THE SHED: the first frame's drawn aeroplane is behind the door plane and inside the opening's
  //          width; it crosses the door plane on the straight (its heading the door's) with the wings inside the opening;
  //          no jump a frame (the CG moves at most the profile's speed, the heading turns smoothly); the wheels turn
  //          rolled / R; the eye's plan is clear (outside the building, off the footprint, the aeroplane in sight)
  //   G1117  NO ALLOCATION A FRAME (bound 64, as the shed's roll); a skip goes to the stand at once; cancel() puts back
  //          without onDone; a stand behind the door or too close is REFUSED cleanly (onDone once, a reason)
  {
    const S = ROLLANIM.S;
    const standUp = (a, deg, out, lat, shellKey) => {
      const G = garage(a, shellKey || 'club');
      const dims = SHELLS[shellKey || 'club'];
      // the stand: the mains' midpoint and the nose's heading (-x)
      const rig = ROLLANIM.appRig(G.model, G.def, G.sim);
      let mx = 0, mz = 0, n = 0; for (const w of rig.wheels) if (Math.abs(w.z - G.cg[2]) > 0.2) { mx += w.x; mz += w.z; n++; }
      mx /= n; mz /= n;
      // the door's outward heading psi0 = the stand's heading (pi) - deg; the door plane `out` m behind the mains, `lat` aside
      const psi0 = Math.PI - deg * Math.PI / 180, ux = Math.cos(psi0), uz = Math.sin(psi0);
      const dx = mx - ux * out - uz * lat, dz = mz - uz * out + ux * lat;   // (a point on the door plane)
      const node = new THREE.Group();
      node.position.set(dx - ux * dims.HD, G.groundY, dz - uz * dims.HD);
      node.rotation.y = Math.atan2(uz, -ux);
      G.scene.add(node); node.updateMatrixWorld(true);
      const shed = { node, dims, door: { w: Math.max(6, 2 * dims.HW - 5), h: Math.min(6.4, dims.EAVE - 1.4) }, doorAxis: -1 };
      // the flight's first frame as the host draws it: flRevealStart's chase framing behind the tail, on the side whose eye
      // stands further from the shed's centre, and placeCamera's keepOutOfShed - an eye in the shed's box (grown by the
      // near plane + 0.35) pulled back along its line to the CG onto the box's face
      const cg = G.cg, inv = node.matrixWorld.clone().invert(), m = 0.5 + 0.35;   // (app.js CAM_NEAR 0.5)
      const eyeOf = sd => { const F = ROLLANIM.standFraming('chase', G.def.params.viewDist, sd);
        return [cg[0] + F.dist * Math.cos(F.el) * Math.cos(F.az), cg[1] + F.dist * Math.sin(F.el), cg[2] + F.dist * Math.cos(F.el) * Math.sin(F.az)]; };
      const cen = new THREE.Vector3(0, 0, 0).applyMatrix4(node.matrixWorld);
      const far = e => Math.hypot(e[0] - cen.x, e[2] - cen.z);
      let eye = far(eyeOf(1)) >= far(eyeOf(-1)) ? eyeOf(1) : eyeOf(-1);
      {
        const a0 = new THREE.Vector3(cg[0], cg[1], cg[2]).applyMatrix4(inv), a1 = new THREE.Vector3(eye[0], eye[1], eye[2]).applyMatrix4(inv);
        const lo = [-dims.HD - m, -1, -dims.HW - m], hi = [dims.HD + m, dims.EAVE + 2.6 + m, dims.HW + m], d = [a1.x - a0.x, a1.y - a0.y, a1.z - a0.z], p0 = [a0.x, a0.y, a0.z];
        let t0 = 0, t1 = 1, hit = true;
        for (let k = 0; k < 3 && hit; k++) {
          if (Math.abs(d[k]) < 1e-9) { if (p0[k] < lo[k] || p0[k] > hi[k]) hit = false; continue; }
          let u = (lo[k] - p0[k]) / d[k], v = (hi[k] - p0[k]) / d[k]; if (u > v) { const w = u; u = v; v = w; }
          t0 = Math.max(t0, u); t1 = Math.min(t1, v); if (t0 > t1) hit = false;
        }
        if (hit && t0 > 0.02) { const q = new THREE.Vector3(p0[0] + d[0] * t0, p0[1] + d[1] * t0, p0[2] + d[2] * t0).applyMatrix4(node.matrixWorld); eye = [q.x, q.y, q.z]; }
      }
      const end = { eye, look: cg.slice(), fov: 52 };
      const contact = new THREE.Object3D(); G.scene.add(contact);
      return { G, shed, end, contact, mains: [mx, mz], ground: () => G.groundY };
    };
    const playW = (R, extra) => {
      let calls = 0;
      const h = ROLLANIM.playWorld(Object.assign({ craft: R.G.craft, camera: R.G.cam, model: R.G.model, def: R.G.def, sim: R.G.sim, shed: R.shed, end: R.end,
        ground: R.ground, contact: R.contact, onDone: () => calls++ }, extra || {}));
      return { h, calls: () => calls };
    };
    const toRoom = (R, x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(R.shed.node.matrixWorld.clone().invert());
    let nW = 0, worstEye = 0, refused = [];
    const Lw = [], Tw = [];
    for (const a of archs) {
      const G0 = garage(a, 'club');
      if (!G0.def.nodes.some(nd => nd.r > 0)) {       // floats: refused cleanly
        const R = standUp(a, 54, 23.5, 0); const P = playW(R);
        check(P.h.done && P.calls() === 1 && !!P.h.skipped, a.name + ': G1117 the world roll refuses floats cleanly (' + P.h.skipped + ')');
        continue;
      }
      const R = standUp(a, 54, 23.5, 0);               // Jolene HOME: the stand 23.5 m out, turned 54 deg off the door's axis
      const P = playW(R);
      if (!check(!P.h.done && !!P.h.plan, a.name + ': G1115 the world roll plans (Jolene HOME\'s geometry)', P.h.skipped)) continue;
      const W = P.h.plan; nW++; Lw.push(W.L); Tw.push(W.T.T);
      worstEye = Math.max(worstEye, W.eye0.bad);
      check(W.eye0.bad === 0, a.name + ': G1116 the establishing eye\'s plan is clear (' + W.eye0.u + ' m out, ' + W.eye0.lat + ' m aside)', W.eye0.bad + ' faults');
      // the first frame (play() posed it): the whole drawn aeroplane in the shed, inside the opening's width
      R.G.craft.updateMatrixWorld(true);
      const bx = new THREE.Box3(), c8 = new THREE.Vector3();
      R.G.craft.traverse(o => { if (!o.isMesh) return; const b = o.geometry.boundingBox || (o.geometry.computeBoundingBox(), o.geometry.boundingBox);
        for (let i = 0; i < 8; i++) { c8.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(o.matrixWorld); bx.expandByPoint(toRoom(R, c8.x, c8.y, c8.z)); } });
      const HD = R.shed.dims.HD, dW = R.shed.door.w;
      check(bx.min.x > -HD + S.noseIn - 0.05 && bx.max.x < HD && Math.max(-bx.min.z, bx.max.z) < dW / 2, a.name + ': G1116 it starts in the shed, the nose ' + (bx.min.x + HD).toFixed(2) + ' m inside the door plane, within the opening',
        JSON.stringify({ min: bx.min, max: bx.max }));
      // the frames: the CG's steps, the heading's, the door crossing
      const cgNow = () => new THREE.Vector3(R.G.cg[0], R.G.cg[1], R.G.cg[2]).applyMatrix4(R.G.craft.matrixWorld);
      let prev = cgNow(), jump = 0, crossBad = 0, frames = 0, lastQ = R.G.craft.quaternion.clone(), turn = 0;
      const vmax = W.T.v;
      while (!P.h.done && frames < 2000) {
        const went = ROLLANIM.frame(1 / 60);
        R.G.cam.position.set(0, 3, 0); ROLLANIM.camera();
        R.G.craft.updateMatrixWorld(true);
        const c = cgNow();
        jump = Math.max(jump, c.distanceTo(prev) / (vmax / 60));
        turn = Math.max(turn, 2 * Math.acos(Math.min(1, Math.abs(lastQ.dot(R.G.craft.quaternion)))));
        prev = c; lastQ.copy(R.G.craft.quaternion);
        // while the mains are within a metre of the door plane, the heading is the door's and the wings in the opening
        const s = P.h.rolled;
        if (Math.abs(s - W.sMain) < 1 && W.ext.half >= dW / 2) crossBad++;
        if (Math.abs(s - W.sMain) < 1 && s > W.Ls) crossBad++;
        frames++;
        if (!went) break;
        if (P.h.t >= W.T.T) break;
      }
      // the last frame, before the microtask: the stand's pose exactly, the flight's eye
      const q = R.G.craft.quaternion, pz = R.G.craft.position;
      const lastOk = pz.x === 0 && pz.y === 0 && pz.z === 0 && q.x === 0 && q.y === 0 && q.z === 0 && q.w === 1;
      const cam = R.G.cam.position, e = R.end.eye;
      const dir = new THREE.Vector3(); R.G.cam.getWorldDirection(dir);
      const toL = new THREE.Vector3(R.end.look[0] - cam.x, R.end.look[1] - cam.y, R.end.look[2] - cam.z).normalize();
      await tick();
      check(lastOk && R.contact.position.lengthSq() === 0 && R.contact.quaternion.w === 1, a.name + ': G1115 the last frame is the stand\'s pose exactly (the craft and the contact shadows at identity)', JSON.stringify({ p: pz, q }));
      check(cam.x === e[0] && cam.y === e[1] && cam.z === e[2] && toL.dot(dir) > 1 - 1e-9, a.name + ': G1115 the last frame\'s eye is the flight\'s first, aimed at its CG');
      check(P.calls() === 1 && P.h.done && !ROLLANIM.busy(), a.name + ': G1115 onDone once, nothing left playing', P.calls());
      check(jump < 1.25 && turn < 0.05, a.name + ': G1116 no jump a frame (the CG\'s worst step ' + jump.toFixed(2) + ' x the cruise\'s; the heading ' + (turn * 180 / Math.PI).toFixed(2) + ' deg a frame at most)', jump + ' / ' + turn);
      check(crossBad === 0, a.name + ': G1116 it crosses the door plane straight, the wings inside the opening', crossBad);
      let wworst = 0;
      R.G.model.wheelParts.forEach((w, i) => { wworst = Math.max(wworst, Math.abs(P.h.spun[i] - W.L / w.R)); });
      check(wworst < 1e-9 && near(P.h.rolled, W.L, 1e-9), a.name + ': G1116 rolled the path (' + W.L.toFixed(1) + ' m), each wheel turned rolled / R', wworst);
      check(W.T.T >= S.wTmin - 1e-9 && W.T.T <= S.wTmax + 1e-9, a.name + ': the world roll lasts ' + W.T.T.toFixed(2) + ' s (' + S.wTmin + '-' + S.wTmax + ')', W.T.T);
      check(R.G.sim.out.rpm.length === 0, a.name + ': sim.out.rpm put back');
      if (VERBOSE) console.log('         ' + a.name + ': world L ' + W.L.toFixed(1) + ' m (straight ' + W.Ls.toFixed(1) + '), T ' + W.T.T.toFixed(2) + ' s, v ' + W.T.v.toFixed(1) + ' m/s, eye ' + W.eye0.u + '/' + W.eye0.lat + '/' + W.eye0.side + ', ' + frames + ' frames');
    }
    check(nW >= 20, 'G1115 the wheeled archetypes rolled out of the world\'s shed (' + nW + ')', nW);
    console.log('  world rolls ' + Math.min(...Lw).toFixed(1) + '-' + Math.max(...Lw).toFixed(1) + ' m, ' + Math.min(...Tw).toFixed(2) + '-' + Math.max(...Tw).toFixed(2) + ' s; the establishing eye\'s worst plan ' + worstEye + ' faults');
    // OTHER STANDS AND SHEDS: straight out, a hard turn either way, far, the works and field sheds
    for (const [deg, out, lat, sk] of [[0, 23.5, 0, 'club'], [-80, 18, 4, 'club'], [100, 25, -3, 'club'], [30, 60, 10, 'club'], [54, 23.5, 0, 'works'], [20, 15, 0, 'field']]) for (const name of ['Cub-alike', 'C172-alike', 'Twin bush hauler']) {
      const a = archs.find(x => x.name === name), R = standUp(a, deg, out, lat, sk), P = playW(R);
      if (!check(!!P.h.plan, name + ': the world roll plans (' + sk + ', ' + deg + ' deg, ' + out + ' m out)', P.h.skipped)) continue;
      drive(P.h, 1 / 60, 3000, () => R.G.cam.position.set(0, 3, 0));
      await tick();
      check(P.h.plan.eye0.bad === 0 && P.calls() === 1 && R.G.craft.position.lengthSq() === 0, name + ': ' + sk + ' ' + deg + ' deg ' + out + ' m: the eye clear, it ends on the stand', JSON.stringify({ bad: P.h.plan.eye0.bad, calls: P.calls() }));
    }
    // REFUSED: a stand too close to the door, one behind the shed's door line
    for (const [deg, out, why] of [[0, 3, 'too close'], [170, 20, 'facing back in']]) {
      const a = archs.find(x => x.name === 'Cub-alike'), R = standUp(a, deg, out, 0), P = playW(R);
      check(P.h.done && P.calls() === 1 && !!P.h.skipped && !P.h.plan, 'G1117 a stand ' + why + ' is refused cleanly (' + P.h.skipped + ')', P.h.skipped);
    }
    // the skip, cancel
    {
      const a = archs.find(x => x.name === 'Cub-alike');
      const R = standUp(a, 54, 23.5, 0), P = playW(R);
      drive(P.h, 1 / 60, 90);
      const ev = new Event('keydown', { cancelable: true }); window.dispatchEvent(ev);
      check(P.calls() === 1 && P.h.done && R.G.craft.position.lengthSq() === 0 && R.G.cam.position.x === R.end.eye[0], 'G1117 a key mid-roll: at once on the stand with the flight\'s eye, onDone once');
      const R2 = standUp(a, 54, 23.5, 0), P2 = playW(R2);
      drive(P2.h, 1 / 60, 90); P2.h.cancel(); drive(P2.h, 1 / 60, 50); await tick();
      check(P2.calls() === 0 && R2.G.craft.position.lengthSq() === 0 && !ROLLANIM.busy() && !ROLLANIM.world(), 'G1117 cancel(): the stand\'s pose back, no onDone');
    }
    // no allocation a frame
    {
      const a = archs.find(x => x.name === 'DA62-alike');
      global.gc(); global.gc();
      const R = standUp(a, 54, 23.5, 0), P = playW(R);
      drive(P.h, 1 / 6000, 20000);
      let per = -1;
      for (let k = 0; k < 3 && per < 0; k++) { const h0 = process.memoryUsage().heapUsed; drive(P.h, 1 / 60000, 3000); per = (process.memoryUsage().heapUsed - h0) / 3000; }
      check(per >= 0 && per < 64 && !P.h.done, 'G1117 no allocation a frame, THE WORLD ROLL: ' + per.toFixed(1) + ' bytes / frame over 3000 hooked frames (bound 64)', per.toFixed(1));
      P.h.cancel();
    }
    // THE CHECK ALONE (roll: false) ends when the check does, the aeroplane never moved; OPTION B (follow: false) holds its eye
    {
      const a = archs.find(x => x.name === 'Cub-alike');
      const G = garage(a, 'club'); let calls = 0;
      const h = ROLLANIM.play({ craft: G.craft, camera: G.cam, scene: G.scene, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim, roll: false, onDone: () => calls++ });
      const n = drive(h, 1 / 60, 2000); await tick();
      check(calls === 1 && h.rolled === 0 && Math.abs(n / 60 - h.plan.check.T) < 3 / 60 && G.craft.position.lengthSq() === 0, 'G1115 roll: false - the check alone (' + (n / 60).toFixed(2) + ' s), nothing rolled, onDone once', JSON.stringify({ calls, n, T: h.plan.check.T }));
      const G2 = garage(a, 'club'); let c2 = 0; const eyes = [];
      const h2 = ROLLANIM.play({ craft: G2.craft, camera: G2.cam, scene: G2.scene, hangar: G2.hangar, model: G2.model, def: G2.def, sim: G2.sim, follow: false, onDone: () => c2++ });
      while (!h2.done && eyes.length < 3000) { const w = ROLLANIM.frame(1 / 60); G2.cam.position.set(0, 3, 0); ROLLANIM.camera(); eyes.push({ p: G2.cam.position.clone(), t: h2.t + h2.tCheck }); if (!w) break; }
      await tick();
      const held = eyes.filter(e => e.t > S.bEase + 0.02), moved = held.length ? Math.max(...held.map(e => e.p.distanceTo(held[0].p))) : 1;
      const P2 = h2.plan, eye = P2.fixed && P2.fixed.eye;
      check(c2 === 1 && held.length > 200 && moved < 1e-9 && !!eye && ROLLANIM._eyeOk(P2.room, eye[0], eye[1], eye[2]), 'OPTION B follow: false - the eye fixed in the shed (' + held.length + ' held frames), the aeroplane rolled ' + P2.L.toFixed(1) + ' m out past the door', JSON.stringify({ c2, moved, eye }));
    }
  }

  // ---- G1037: no allocation a frame ----------------------------------------------------------------------
  // One long shot (a tiny dt), warmed until its code is optimised, then the heap over N hooked frames with
  // no gc() between (a gc() drops optimised code that embedded a collected object - "weak objects" - and
  // the frames after it run in the interpreter, which boxes every double). The shot's frame code keeps its
  // doubles in a typed array and hands none to a call (rollanim.js advance / frameCam): measured 16 bytes a
  // frame (one boxed double at the THREE setters' edge), from 100-300 before. The bound is 64 (four).
  // G1064: TWO PHASES, each measured. THE ROLL: the shot's frame alone, bound 64 as before. THE CHECK: the shot also snaps
  // the host's linkage every frame (model.link.snap, 50_model_codec.js: a keyed write of the twelve drives, each double
  // boxed on its way - the host's own link.step does the same every frame of the game, ~385 B), so its bound is 64 +
  // what snap alone costs, measured here on the same linkage
  {
    const a = archs.find(x => x.name === 'DA62-alike');   // two props, three wheels
    const run = () => { const G = garage(a, 'club'); const h = ROLLANIM.play({ craft: G.craft, camera: G.cam, scene: G.scene, hangar: G.hangar, model: G.model, def: G.def, sim: G.sim, onDone: () => {} }); return { G, h }; };
    const snapCost = (() => {
      const L = CORE.makeLinkage(0.15), c = { de: 0, da: 0, dr: 0, flap: 0 }; let t = 0;
      const f = () => { t += 1e-4; c.da = 0.9 * Math.sin(t); L.snap(c); };
      for (let i = 0; i < 100000; i++) f();
      const h0 = process.memoryUsage().heapUsed; for (let i = 0; i < 3000; i++) f(); return Math.max(0, (process.memoryUsage().heapUsed - h0) / 3000);
    })();
    global.gc(); global.gc();
    const N = 3000;
    {
      const { h } = run();
      drive(h, 1 / 6000, Math.floor(0.85 * h.plan.check.T * 6000));   // (warm, still inside the check)
      // (a young-generation scavenge inside the window reads negative: the snap's garbage fills it sooner - up to three
      // windows, the first clean one)
      let per = -1;
      for (let k = 0; k < 3 && per < 0; k++) { const h0 = process.memoryUsage().heapUsed; drive(h, 1 / 60000, N); per = (process.memoryUsage().heapUsed - h0) / N; }
      check(per >= 0 && per < 64 + snapCost && !h.done && h.phase === 'check', "G1037 no allocation a frame, THE CHECK: " + per.toFixed(1) + " bytes / frame over " + N + " hooked frames (bound 64 + the linkage's snap " + snapCost.toFixed(1) + ")", per.toFixed(1) + ' ' + h.phase);
      h.cancel();
    }
    global.gc(); global.gc();
    const { h } = run();
    drive(h, 1 / 60, Math.ceil(h.plan.check.T * 60) + 2);   // through the check
    drive(h, 1 / 6000, 20000);
    let per = -1;
    for (let k = 0; k < 3 && per < 0; k++) { const h0 = process.memoryUsage().heapUsed; drive(h, 1 / 60000, N); per = (process.memoryUsage().heapUsed - h0) / N; }
    check(per >= 0 && per < 64 && !h.done && h.phase === 'roll', "G1037 no allocation a frame, THE ROLL: " + per.toFixed(1) + " bytes / frame over " + N + " hooked frames (bound 64)", per.toFixed(1) + ' ' + h.phase);
    h.cancel();
    // and the time: the tick is nothing next to a 33 ms frame
    const { h: h2 } = run();
    const t0 = process.hrtime.bigint(); const k = drive(h2, 1 / 600, 1000); const us = Number(process.hrtime.bigint() - t0) / 1e3 / k;
    check(us < 200, 'a hooked frame costs ' + us.toFixed(1) + ' us (bound 200)', us);
    h2.cancel();
  }

  if (fails.length) { console.log('GATE ROLLANIM: FAIL (' + fails.length + ' of ' + (fails.length + nOk) + ': ' + fails.slice(0, 3).join('; ') + ')'); process.exit(1); }
  console.log('  ' + nOk + ' checks');
  console.log('GATE ROLLANIM: PASS');
})().catch(e => { console.log(e && e.stack); console.log('GATE ROLLANIM: FAIL (' + (e && e.message) + ')'); process.exit(1); });
