#!/usr/bin/env node
// hull_matrix.js - THE FLYING BOAT'S TEST MATRIX (HULL-B7, a TOOL, not a gate: the user, 4 Nov, "let's test this thing
// asap ... and get the engine various configurations"). Every hull form (the Hull form tile) x every engine
// configuration (the Engine mount / Engines tiles) on the user's Cessna-on-floats build, each built the way a builder
// would - the tiles applied through the design module's own designApply, the game's load chain (_load_build.js), the
// Hull tile's fit off the flown CG and mass (two passes: cageHullFit + HYDRO.hullTipFit, GATE HULL's cycle) - then
// SETTLED on the sea and flown off the SEA lane by THE PILOT (43_pilot.js). One row per combination.
//
//   node tools/hull_matrix.js                         -> the whole matrix, 3 combinations at a time
//   node tools/hull_matrix.js --forms=classic,deep --engines=pylon,twin [--jobs=N] [--json=out.json]
//   node tools/hull_matrix.js --one=classic:pylon     -> one combination (what the children run)
//   node tools/hull_matrix.js --one=classic:pylon --save=b.json  -> also the fitted build, for tools/quick_view.js
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

const FORMS = ['classic', 'deep', 'flat', 'soft', 'stepless'];
// the engine configurations a boat can wear, each a tile selection plus the rows a builder sets for a boat
const ENGINES = {
  pylon: { sel: { engMount: 'wingTop' }, cage: { engPylonH: 1.0, engPylonFair: 2, cowlOn: 1, noseLen: 1.3 },
           note: 'one engine on a pylon over the wing, pushing, in a pod nacelle (Lake, Seabee)' },
  // (HULL-B13, the user: "putting four times even 150 horsepower is huge power for such sports light planes" - the
  // pair and the four carry engines sized to the boat - the catalogue's preset applied as the Engine model tile does,
  // _load_build's 'engPreset:<name>' after; the Cessna's O-540 stays on the single pylon)
  twin: { sel: { engCount: 2 }, cage: { noseLen: 1.3 }, engine: 'rotax 912 (flat)',
          note: 'a pair of Rotax 912s on the wing (Che-27, LA-8)' },
  pushPull: { sel: { engCount: 'pushPull' }, cage: {}, engine: 'rotax 912 (flat)',
              note: 'a Rotax 912 in the nose and one pushing behind the cabin, the tail on twin booms (the Skymaster layout)' },
  pylonBlade: { sel: { engMount: 'wingTop' }, cage: { engPylonH: 1.0, engPylonForm: 1, cowlOn: 1, noseLen: 1.3 },
                note: 'the pylon pusher on ONE wing-section blade on the centreline (the Lake\'s, the SeaMax\'s), flown as braced' },
  aftBlade: { sel: { engMount: 'wingTop' }, engine: 'rotax 915 iS', cage: { engPylonH: 0.75, engPylonForm: 1, engBlockZ: -0.7, cowlOn: 1, noseLen: 1.3, taperW: 0.62, tailHalfW: 0.085 },
              note: 'the engine behind the cabin on a short blade, the tail cone slimmed to a boom (the Icon\'s, the SeaRey\'s silhouette on our rows)' },
  icon: { sel: { engMount: 'wingTop' }, engine: 'rotax 915 iS', cage: { engPylonAt: 1, engPylonAft: 0.15, engPylonH: 0.55, engPylonForm: 1, engPylonFair: 3, cowlOn: 1, noseLen: 1.3, taperW: 0.62, tailHalfW: 0.085 },
          note: 'the engine on the fuselage behind the cabin on a blended blade, its prop over a slim tail boom (the Icon A5, the Aventura)' },
  // (HULL-B18, the user: "an Icon puts its boom really low, keeps a large space behind the cabin and sticks the engine
  // in there"): THE TUB - the pod lengthened by an engine bay behind the cabin (paxLen), the pusher on its aft face with
  // the thrust line high on it (engY), the tail on a rod the rod fit sets LOW (under the hub's disc)
  tub: { sel: { engMount: 'pusher' }, engine: 'rotax 915 iS', cage: { paxLen: 0.6, engY: 0, noseLen: 1.3, hullTubLen: 2.2, hullTubRise: 8, cowlOn: 1, hullSpon: 1, hullTips: 0 },
         note: 'the hull tub: cabin + engine bay in one pod, the pusher high on its aft face, the tail on a low rod boom (the Icon A5)' },
  tandem: { sel: { engCount: 'tandem' }, engine: 'rotax 912 (flat)', cage: { engPylonH: 1.25, noseLen: 1.3 },
            note: 'two Rotax 912s back to back on one pylon over the wing, one pulling, one pushing (the Seastar)' },
  pylonTractor: { sel: { engMount: 'wingTop', engAim: 'puller' }, cage: { engPylonH: 1.0, engPylonFair: 2, cowlOn: 1, noseLen: 1.3 },
                  note: 'one engine on a pylon over the wing, pulling (the Seabird / Osprey class)' },
  four: { sel: { engCount: 4 }, cage: { noseLen: 1.3 }, engine: 'rotax 582',
          note: 'two pairs of Rotax 582s on the wing, inner and outer (the big boats\' layout, at sport size)' },
  pusher: { sel: { engMount: 'pusher' }, cage: {},
            note: 'a pusher on the pod\'s aft bulkhead, the tail on a rod (SeaRey, Aventura)' },
  nose: { sel: {}, cage: {},
          note: 'the Cessna\'s own nose tractor (the control: a boat with its propeller at the bow)' },
};

// THE ROLL, whatever the heading: the body's lateral axis (x aft cross y up) out of the horizontal (HULL-B10: the up
// axis's world z read the roll only on the reset heading - a boat yawed by its abort read 1 deg while it turned turtle)
const rollOf = (xA, yU) => { const z1 = xA[2] * yU[0] - xA[0] * yU[2]; return Math.asin(Math.max(-1, Math.min(1, z1))) * 180 / Math.PI; };
function one(form, eng) {
  const C = require('./flight_core.js'), G = require('./_cage_gen.js'), D = require('./_cage_design.js'), LB = require('./_load_build.js');
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'bugReports', 'cessnaFloatsWOrks.json'), 'utf8'));
  const sp = raw.spec || raw, E = ENGINES[eng];
  delete sp.gear.floats;
  const ap = D.designApply(Object.assign({}, sp.cage), Object.assign({ gearLayout: 'hull', hullForm: form }, E.sel));
  sp.cage = Object.assign({}, sp.cage, ap.cage, E.cage);
  sp.gear = Object.assign({}, sp.gear, (ap.spec && ap.spec.gear) || {}, { type: 'hull' });
  const res = { form, eng, missing: ap.missing };
  const defOf = s2 => C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(s2))));
  let spec = null, errs = [], fitAll = null; const fitRows = {};
  // THE FIT CYCLE, the page's (_cage_float.js hullFitStep): build, read the flown CG / mass / propeller discs, fit
  // (_cage_gen.js cageHullFitAll: the step, the balance, the propellers' clearance, the tip floats), build again
  for (let pass = 0; pass < 4; pass++) {
    const got = LB.gameSpecFull(Object.assign(JSON.parse(JSON.stringify(raw)), { afters: ap.afters.filter(a => a !== 'CAGE_HULL_FIT_NEXT').concat(E.engine ? ['engPreset:' + E.engine] : []) }));
    spec = got.spec; errs = got.errors || [];
    if (pass === 3 || !spec.gear.hull) break;
    const d = defOf(spec); let cx = 0, cy = 0, mass = 0;
    for (const n of d.nodes) { mass += n.m; cx += n.m * n.p[0]; cy += n.m * n.p[1]; } cx /= mass; cy /= mass;
    const P = G.cageFromSpec(spec), FS = (G.CAGE_UNIT || 1) * (P.planeScale || 1);
    const TB = G.cageHullTable(G.cageHullLines(P), FS), hr = spec.gear.hull;
    if (!TB) break;
    fitAll = G.cageHullFitAll(P, { cg: [cx, cy], mass, zFw: hr.x + TB.zStep * FS, yD: TB.yStep * FS - hr.y, props: C.HYDRO.propDiscs(d),
                                tipArm: ((d.parts.floats || []).find(q => q.tip) || { K: [] }).K.reduce((a, i) => Math.max(a, Math.abs(d.nodes[i].p[2])), 0) },
                              C.HYDRO, { semi: d.nodes.reduce((a, n) => Math.max(a, Math.abs(n.p[2])), 0) });   // (the wing's tip: the furthest node off the centreline)
    if (!fitAll) break;
    Object.assign(sp.cage, fitAll.rows); Object.assign(fitRows, fitAll.rows);
    if (process.env.HM_DEBUG) console.error("pass", pass, JSON.stringify(fitAll.rows), JSON.stringify(fitAll.rest), fitAll.notes.join("; "));
  }
  res.fit = fitAll && { rows: fitRows, rest: fitAll.rest, notes: fitAll.notes };
  res.errors = errs;
  if (opt('save')) fs.writeFileSync(opt('save'), JSON.stringify({ spec }, null, 1));   // the fitted build, for quick_view
  if (!spec.gear.hull) { res.verdict = 'NO HULL (' + spec.gear.type + ')'; return res; }
  if (opt('fitonly')) { res.verdict = 'FITTED'; return res; }   // (--fitonly: the fitted build only - for renders)
  const def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
  let M = 0, mx = 0, my = 0; for (const n of def.nodes) { M += n.m; mx += n.m * n.p[0]; my += n.m * n.p[1]; } mx /= M; my /= M;
  const W = M * 9.81, hr = spec.gear.hull, fl = def.parts.floats;
  res.gross = +M.toFixed(0);
  res.stepDeg = +(Math.atan2(hr.x - mx, my - hr.y) * 180 / Math.PI).toFixed(1);
  res.engines = (spec.engines || []).map(e => e.mount + ':' + e.type).join('+');
  // SETTLE (the sea south of home, 0.2 m drop, idle)
  const world = C.makeWorld(), X0 = 0, Z0 = 1600, h = world.waterH(X0, Z0);
  const sim = C.makeSim(def, world); sim.reset(0);
  { const p = sim.p, v = sim.v, iK = fl[0].K[2]; const dx = X0 - p[iK * 3], dz = Z0 - p[iK * 3 + 2], dy = h + 0.2 - p[iK * 3 + 1];
    for (let i = 0; i < sim.n; i++) { p[i * 3] += dx; p[i * 3 + 1] += dy; p[i * 3 + 2] += dz; v[i * 3] = v[i * 3 + 1] = v[i * 3 + 2] = 0; } }
  sim.ctl.thr = 0;
  let tr = 0, rl = 0, n = 0, ok = true, Fy = 0, bow = Infinity, upMin = 1, wetProp = 0;
  for (let s = 0; s < 600; s++) {
    sim.step(1 / 60);
    const [xA, yU] = sim.axes();
    const trim = Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 180 / Math.PI, roll = rollOf(xA, yU);
    if (!Number.isFinite(trim)) { ok = false; break; }
    upMin = Math.min(upMin, yU[1]);                 // (a boat that turned over reads a small roll and trim - the up axis says it)
    if (sim.out && sim.out.propWet) wetProp |= sim.out.propWet;
    if (s >= 480) {
      tr += trim; rl += Math.abs(roll); n++; Fy += sim.hydro.floats.reduce((a, x) => a + x.out.F[1], 0) / W;
      const hu = sim.hydro.floats[0], dk = hu.F.sta[0]; bow = Math.min(bow, Math.min(...[dk.Dm, dk.Dp].map(i => hu.out.W[i][1])) - hu.h);
    }
  }
  res.settle = ok && upMin < 0.5 ? 'CAPSIZED' : ok ? { propWet: wetProp, trim: +(tr / n).toFixed(1), roll: +(rl / n).toFixed(1), LW: +(Fy / n).toFixed(3), bowDeck: +bow.toFixed(2) } : 'DIVERGED';
  // TAKE-OFF (the pilot, the SEA lane, calm)
  const w2 = C.makeWorld(), sea = w2.aerodromes.find(a => a.id === 'SEA');
  const s2 = C.makeSim(def, w2); s2.reset(0); C.placeAtAerodrome(s2, sea);
  const pil = C.makePilot(s2, def, w2); pil.setRoute(sea, sea);
  let Tt = 0, wasWet = true, dryFrom = null, lift = null, hump = 0, humpV = 0, hdg0 = null, swing = 0, maxRoll = 0, Vlift = 0, fin = true;
  for (let s = 0; s < 90 * 60; s++) {
    pil.update(1 / 60); s2.step(1 / 60); Tt += 1 / 60;
    const v = s2.cgVel(), [xA, yU] = s2.axes();
    if (!Number.isFinite(v[0])) { fin = false; break; }
    // (a solver that blew up flies too, at 1 km/s: a node faster than any aeroplane is a divergence, not a flight)
    if (s % 30 === 0) { let vm = 0; for (let i = 0; i < s2.n; i++) vm = Math.max(vm, Math.abs(s2.v[i * 3]) + Math.abs(s2.v[i * 3 + 1]) + Math.abs(s2.v[i * 3 + 2])); if (vm > 300) { fin = false; break; } }
    const fx = s2.hydro.floats, wet = fx.reduce((a, x) => a + x.wet, 0) > 0, V = Math.hypot(v[0], v[2]);
    const hdg = Math.atan2(-xA[0], -xA[2]) * 180 / Math.PI;
    if ((pil.phase === 'ROLL' || pil.phase === 'LIFTOFF') && wet && lift == null) {
      if (hdg0 == null) hdg0 = hdg;
      swing = Math.max(swing, Math.abs(((hdg - hdg0 + 540) % 360) - 180));
      maxRoll = Math.max(maxRoll, Math.abs(rollOf(xA, yU)));
      let Rx = 0; for (const x of fx) Rx += -(x.out.F[0] * v[0] + x.out.F[2] * v[2]) / Math.max(0.3, V);
      if (V < 14 && Rx / W > hump) { hump = Rx / W; humpV = V; }
    }
    if (!wet && wasWet && Tt > 2 && lift == null) { dryFrom = Tt; Vlift = V; }
    if (wet && !wasWet && lift == null) dryFrom = null;
    if (!wet && dryFrom != null && lift == null && Tt - dryFrom >= 2) lift = dryFrom;
    wasWet = wet;
    if (lift != null && Tt > lift + 2) break;
  }
  res.takeoff = fin ? { airborne: lift == null ? null : +lift.toFixed(1), Vlift: lift == null ? null : +Vlift.toFixed(1), hump: +hump.toFixed(3), humpV: +humpV.toFixed(1),
                        swing: +swing.toFixed(1), roll: +maxRoll.toFixed(1) } : 'DIVERGED';
  const okSettle = typeof res.settle === 'object' && Math.abs(res.settle.LW - 1) < 0.05 && res.settle.bowDeck > 0.1 && res.settle.roll < 6;
  const okTO = typeof res.takeoff === 'object' && res.takeoff.airborne != null && res.takeoff.airborne < 60 && res.takeoff.swing < 30;
  res.verdict = !errs.length && okSettle && okTO ? 'FLIES' : [errs.length ? 'join errors' : null, okSettle ? null : 'settle', okTO ? null : 'take-off'].filter(Boolean).join(', ');
  return res;
}

const oneArg = opt('one');
if (oneArg) {
  const [form, eng] = oneArg.split(':');
  let r;
  try { r = one(form, eng); } catch (e) { r = { form, eng, verdict: 'THREW ' + e.message }; }
  process.stdout.write('\u0001' + JSON.stringify(r) + '\n');
  process.exit(0);
}
const forms = opt('forms', FORMS.join(',')).split(','), engs = opt('engines', Object.keys(ENGINES).join(',')).split(',');
const jobs = Math.max(1, +opt('jobs', 3));
const queue = []; for (const e of engs) for (const f of forms) queue.push([f, e]);
const out = [];
let running = 0;
const f2 = v => v == null ? '-' : String(v);
function row(r) {
  const s = r.settle || {}, t = r.takeoff || {};
  return [r.form.padEnd(9), r.eng.padEnd(7), String(r.gross || '-').padStart(5), f2(r.stepDeg).padStart(6),
          (typeof s === 'object' ? [f2(s.trim), f2(s.roll), f2(s.bowDeck)].join(' / ') : s).padEnd(18),
          (typeof t === 'object' ? [f2(t.hump) + '@' + f2(t.humpV), f2(t.airborne) + 's', f2(t.swing) + 'deg'].join('  ') : t).padEnd(30),
          r.verdict + (r.errors && r.errors.length ? ' [' + r.errors.join(' | ').slice(0, 120) + ']' : '')].join(' ') +
         // what the fit moved beyond the step (the bow, the block, the hand) and what it could not
         (r.fit ? ['noseLen', 'engBlockY', 'engPylonH', 'engRotate'].filter(k => r.fit.rows[k] != null).map(k => '  ' + k + ' ' + r.fit.rows[k]).join('') +
                  (r.fit.notes.length ? '\n      ' + r.fit.notes.join('\n      ') : '') : '');
}
function next() {
  if (!queue.length) { if (!running) done(); return; }
  const [f, e] = queue.shift(); running++;
  const c = cp.spawn(process.execPath, [__filename, '--one=' + f + ':' + e], { cwd: ROOT });
  let buf = ''; c.stdout.on('data', d => buf += d); c.stderr.on('data', () => {});
  c.on('close', () => {
    running--;
    let r; try { r = JSON.parse(buf.slice(buf.indexOf('\u0001') + 1)); } catch (er) { r = { form: f, eng: e, verdict: 'NO RESULT' }; }
    out.push(r); console.log(row(r)); next();
  });
}
console.log('form      engine  gross step°  rest trim/roll/bow   hump R/W@V  airborne  swing   verdict');
for (let i = 0; i < jobs; i++) next();
function done() {
  const json = opt('json');
  if (json) fs.writeFileSync(json, JSON.stringify(out, null, 1));
  const fly = out.filter(r => r.verdict === 'FLIES').length;
  console.log(`\n${fly} of ${out.length} combinations fly (settled, then off the SEA lane under the pilot inside 60 s)`);
  for (const e of engs) console.log(`  ${e}: ${ENGINES[e].note}`);
}
