// tools/tw_probe.js - TAILWHEELS (G3800): the tail contact's instrument. Each case on a FLAT field (no world but the
// ground: the surface asked of the field, grass or paved), the hand on the sim's own ctl, 60 Hz:
//   pivot   the inside toe brake (brakeD 1), full rudder, power - the turn on the spot; then the brake and the rudder
//           let go and the aeroplane rolled straight on power for 12 s: the tailwheel's state at the end (re-locked?)
//   rudder  no brake: full rudder and power from rest - the turn the steering and the prop wash give
//   roll    the take-off roll, full power, the rudder holding the heading (a P-D foot, the stick neutral): the heading's
//           worst excursion and the track's cross-offset to 25 m/s or 25 s
//   stop    from V m/s on the ground, idle, no brake (the skid IS the brake): the distance and the time to 0.3 m/s
// and the circuit case flown by the game's own host and pilot (HOME, from the line-up): the roll, the circuit, the landing
//   circuit
// Usage: node tools/tw_probe.js --build cub|jodel|rufus|dc3|tiger|camel|twin|<file> [--case pivot,rudder,roll,stop,circuit]
//        [--cage k=v,k=v] [--surface grass|paved] [--thr 0.5] [--V 12] [--secs 30] [--trace out.json] [--json out.json]
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
process.chdir(ROOT);
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const C = require(process.env.PILOT_CORE || path.join(T, 'flight_core.js'));
const LB = require('./_load_build.js');
// --scott k=v,..: TW_SCOTT's constants for this run (an instrument's sweep: defl, arc, Mf0, trailK)
if (opt('scott')) for (const q of opt('scott').split(',')) { const [k, x] = q.split('='); C.TW_SCOTT[k] = +x; }
const r2 = v => v == null || !isFinite(v) ? null : Math.round(v * 100) / 100;
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

const FILES = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json',
  rufus: 'builds/rufus_2026-10-18_certified.json', dc3: 'tools/fixtures/dc3_2026-10.json',
  tiger: 'tools/fixtures/tigermoth_2026-10.json', camel: 'tools/fixtures/camel_2026-10.json',
  twin: 'tools/fixtures/build_v8_twin-boom_2026-09-11.json' };
// the twin-boom fixture made a taildragger by the Undercarriage tile's own writes (a tailwheel a boom), and that one
// with the Empennage tile's inverted V (here at 30 deg, the tips 0.6 m apart: its tail sits tail-down on them)
const TD = { s2On: 1, s2Leg: 3, s2Z: 0.06, s2X: 0, s2R: 0.07, s2Steer: 1, s2Brake: 0, s1Z: 2.00, s1Steer: 0, s1On: 1, gearFloats: 0 };
const PRESET = { twintd: TD, twiniv: Object.assign({}, TD, { stMount: 4, stCant: 30, stX: 0, stY: 0, stZ: 0, stIvGap: 0.6, finOn: 0 }) };
FILES.twintd = FILES.twiniv = FILES.twin;
const BUILD = opt('build', 'cub'), FILE = FILES[BUILD] || BUILD;
// raw:tb / raw:iv / raw:tbpush - the generator's own default as a twin boom (a tailwheel a boom), as the inverted V on
// twin booms (its tip wheels), or as a twin-boom pusher on its tailwheels - no drawing, no join (the spec as the
// GATE GEN matrix writes it); --iv deg sets the inverted V's angle
function rawSpec(k) {
  const s = JSON.parse(JSON.stringify(C.GEN_DEFAULT));
  s.tail.type = 'twinBoom'; s.tail.boomX = 1.2; s.tail.boomLen = 3.5; s.fuselage.boom = 'twin';
  if (k === 'iv') s.tail.ivAngle = +opt('iv', 35);
  if (k === 'iv' && opt('ivdir')) s.tail.ivDir = opt('ivdir');   // G3801: downOut / upIn / upOut
  if (k === 'tbpush') s.engines[0].mount = 'pusher';
  const CG = opt('cage') ? Object.fromEntries(opt('cage').split(',').map(q => { const [kk, x] = q.split('='); return [kk, isNaN(+x) ? x : +x]; })) : {};
  if (CG.s2Steer != null) { const m = { 2: 'lock', 3: 'fixed', 4: 'skid' }[CG.s2Steer]; if (m) s.gear.twMode = m; }
  return s;
}
function specOf() {
  if (/^raw:/.test(BUILD)) return rawSpec(BUILD.slice(4));
  let CG = opt('cage') ? Object.fromEntries(opt('cage').split(',').map(q => { const [k, x] = q.split('='); return [k, isNaN(+x) ? x : +x]; })) : null;
  if (PRESET[BUILD]) CG = Object.assign({}, PRESET[BUILD], CG || {});
  const L = LB.loadBuild(FILE, CG ? { patch: j => { const sp = j.spec || j; sp.cage = Object.assign({}, sp.cage, CG); return j; } } : undefined);
  if (L.errors && L.errors.length) console.error('load errors:', L.errors.slice(0, 3));
  return L.spec;
}
const SPEC = specOf();
const SURF = opt('surface', 'grass') === 'paved' ? 5 : 0;
const flatWorld = () => ({ terrainH: () => 0, waterH: () => -1e9, surface: () => SURF, trees: [], treesNear: (x, z, q) => { q.length = 0; return q; } });

// --pp k=v,k=v: def.params overrides (an instrument's: params.twDefl, the steering springs' give)
const PP = opt('pp') ? Object.fromEntries(opt('pp').split(',').map(q => { const [k, x] = q.split('='); return [k, +x]; })) : null;
const buildDef = () => { const d = C.buildGen(JSON.parse(JSON.stringify(SPEC))); if (PP) Object.assign(d.params, PP); return d; };
function ready() {
  const def = buildDef();
  const sim = C.makeSim(def, flatWorld());
  sim.reset(0); if (sim.stance) sim.stance();
  if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
  for (let f = 0; f < 180; f++) sim.step(1 / 60);
  return { def, sim };
}
const hdgOf = sim => { const a = sim.axes()[0]; return Math.atan2(-a[2], -a[0]); };
const gV = sim => { const v = sim.cgVel(); return Math.hypot(v[0], v[2]); };
const twState = sim => sim.out && sim.out.twState ? sim.out.twState.slice() : null;
const TRACE = opt('trace') ? [] : null;

const LOCK = opt('lock') != null ? +opt('lock') : null;   // a lockable wheel's lock for pivot / rudder (the reset's 1 else)
function pivot() {
  const { sim, def } = ready(), thr = +opt('thr', 0.5), secs = +opt('secs', 25);
  if (LOCK != null) sim.ctl.twLock = LOCK;
  const c0 = sim.cgPos(), h0 = hdgOf(sim);
  let turned = 0, hp = h0, rMax = 0, t180 = null, castAt = null;
  for (let k = 0; k < 60 * secs; k++) {
    const t = k / 60;
    Object.assign(sim.ctl, { thr: t < 1 ? 0 : thr, brake: 0, brakeD: 1, dr: 1, de: -0.3, da: 0 });
    sim.step(1 / 60);
    const h = hdgOf(sim); turned += wrap(h - hp); hp = h;
    const cg = sim.cgPos(); rMax = Math.max(rMax, Math.hypot(cg[0] - c0[0], cg[2] - c0[2]));
    const ts = twState(sim); if (castAt == null && ts && ts[0] === 1) castAt = r2(t);
    if (t180 == null && Math.abs(turned) >= Math.PI) t180 = r2(t);
    if (TRACE && k % 6 === 0) TRACE.push({ t: r2(t), x: r2(cg[0] - c0[0]), z: r2(cg[2] - c0[2]), hdg: r2(turned * 180 / Math.PI), tw: ts, ang: r2((sim.out.twAng || [0])[0] * 180 / Math.PI) });
    if (t180 != null && t > t180 + 0.5) break;
  }
  // let go, roll straight 12 s on power: does the wheel re-lock?
  // (the foot stops the swing - the rudder against the yaw rate, dr > 0 turns this heading down - and then holds the line
  // it settled on; the toe brakes off)
  let hRel = null, hErrMax = 0, hp2 = hdgOf(sim), relockAt = null;
  for (let k = 0; k < 60 * 12; k++) {
    // a pilot's release: both brakes and the power off 2 s (the swing stopped), the pedals centred, then a little power
    // to roll forward and let the wheel trail, the line held on the toe brakes (brakeD > 0 turns this heading down)
    const h = hdgOf(sim), r = wrap(h - hp2) * 60, tR = k / 60; hp2 = h;
    if (tR >= 2 && hRel == null) hRel = h;
    // (the pedals and the toe brakes both hold the line - a pilot's; the pedals ease to centre as the line is held)
    const eh = hRel == null ? 0 : 2 * wrap(h - hRel) + 1.0 * r;
    const bd = Math.max(-0.5, Math.min(0.5, eh)), drH = Math.max(-1, Math.min(1, 1.5 * eh));
    Object.assign(sim.ctl, tR < 2 ? { thr: 0, brake: 1, brakeD: 0, dr: 0, de: -0.3 } : { thr: Math.max(0.15, Math.min(0.8, 0.35 + 0.4 * (1.5 - gV(sim)))), brake: 0, brakeD: bd, dr: drH, de: -0.3 });
    sim.step(1 / 60);
    if (LOCK != null) sim.ctl.twLock = 1;            // (a lockable wheel: the lock back in for the roll)
    const ts2 = twState(sim); if (relockAt == null && ts2 && ts2[0] !== 1 && ts2[1] !== 1) relockAt = r2(k / 60);
    if (hRel != null) hErrMax = Math.max(hErrMax, Math.abs(wrap(hdgOf(sim) - hRel)));
    if (TRACE && k % 6 === 0) { const cg = sim.cgPos(); TRACE.push({ t: r2(secs + k / 60), x: r2(cg[0] - c0[0]), z: r2(cg[2] - c0[2]), tw: twState(sim), phase: 'release' }); }
  }
  const D = sim.damage ? sim.damage() : null;
  return { case: 'pivot', build: BUILD, twTrackMaxOfArc: sim.out.twFmax ? r2(Math.max(...sim.out.twFmax) / C.TW_SCOTT.arc) : null, thr, t180, turnedDeg: Math.round(turned * 180 / Math.PI), cgOffMax: r2(rMax),
           spanM: r2(def.params.gen && def.params.gen.span), withinSpans: r2(rMax / ((def.params.gen && def.params.gen.span) || 10)),
           castAt, relockAfterReleaseS: relockAt, endState: twState(sim), drift12sDeg: r2(hErrMax * 180 / Math.PI), Vend: r2(gV(sim)), crashed: !!(D && D.crashed) };
}
function rudder() {
  const { sim, def } = ready(), thr = +opt('thr', 0.6), secs = +opt('secs', 40);
  if (LOCK != null) sim.ctl.twLock = LOCK;
  const c0 = sim.cgPos(), h0 = hdgOf(sim);
  let turned = 0, hp = h0, rMax = 0, t180 = null, castAt = null, vMax = 0;
  for (let k = 0; k < 60 * secs; k++) {
    const t = k / 60;
    Object.assign(sim.ctl, { thr: t < 1 ? 0 : thr, brake: 0, brakeD: 0, dr: 1, de: -0.5, da: 0 });
    sim.step(1 / 60);
    const h = hdgOf(sim); turned += wrap(h - hp); hp = h;
    const cg = sim.cgPos(); rMax = Math.max(rMax, Math.hypot(cg[0] - c0[0], cg[2] - c0[2])); vMax = Math.max(vMax, gV(sim));
    const ts = twState(sim); if (castAt == null && ts && ts[0] === 1) castAt = r2(t);
    if (t180 == null && Math.abs(turned) >= Math.PI) t180 = r2(t);
    if (TRACE && k % 6 === 0) TRACE.push({ t: r2(t), x: r2(cg[0] - c0[0]), z: r2(cg[2] - c0[2]), hdg: r2(turned * 180 / Math.PI), tw: ts });
    if (t180 != null && t > t180 + 0.5) break;
  }
  const D = sim.damage ? sim.damage() : null;
  return { case: 'rudder', build: BUILD, twTrackMaxOfArc: sim.out.twFmax ? r2(Math.max(...sim.out.twFmax) / C.TW_SCOTT.arc) : null, thr, t180, turnedDeg: Math.round(turned * 180 / Math.PI), diamM: r2(rMax), vMax: r2(vMax), castAt,
           spanM: r2(def.params.gen && def.params.gen.span), crashed: !!(D && D.crashed) };
}
function roll() {
  const { sim, def } = ready(), secs = +opt('secs', 25);
  const c0 = sim.cgPos(), h0 = hdgOf(sim), ux = Math.cos(h0), uz = Math.sin(h0);
  let hMax = 0, crMax = 0, t25 = null, castAt = null, eP = 0;
  for (let k = 0; k < 60 * secs; k++) {
    const t = k / 60, e = wrap(hdgOf(sim) - h0), de = (e - eP) * 60; eP = e;
    Object.assign(sim.ctl, { thr: 1, brake: 0, brakeD: 0, dr: Math.max(-1, Math.min(1, 3 * e + 1.2 * de)), de: 0, da: 0 });
    sim.step(1 / 60);
    const cg = sim.cgPos(), cr = -(cg[0] - c0[0]) * uz + (cg[2] - c0[2]) * ux;
    hMax = Math.max(hMax, Math.abs(e)); crMax = Math.max(crMax, Math.abs(cr));
    const ts = twState(sim); if (castAt == null && ts && ts[0] === 1) castAt = r2(t);
    if (TRACE && k % 6 === 0) TRACE.push({ t: r2(t), V: r2(gV(sim)), hdg: r2(e * 180 / Math.PI), cr: r2(cr), tw: ts });
    if (gV(sim) > 25 || sim.wheelsOnGround() === 0) { t25 = r2(t); break; }
  }
  const D = sim.damage ? sim.damage() : null;
  return { case: 'roll', build: BUILD, twTrackMaxOfArc: sim.out.twFmax ? r2(Math.max(...sim.out.twFmax) / C.TW_SCOTT.arc) : null, tEnd: t25, Vend: r2(gV(sim)), hdgMaxDeg: r2(hMax * 180 / Math.PI), crossMaxM: r2(crMax), castAt, crashed: !!(D && D.crashed) };
}
function stop() {
  const { sim } = ready(), V = +opt('V', 12), secs = +opt('secs', 30);
  const x0 = sim.axes()[0], hl = Math.hypot(x0[0], x0[2]) || 1, fx = -x0[0] / hl, fz = -x0[2] / hl;
  for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = V * fx; sim.v[i * 3 + 2] = V * fz; }
  const c0 = sim.cgPos(); let tStop = null, dStop = null;
  for (let k = 0; k < 60 * secs; k++) {
    Object.assign(sim.ctl, { thr: 0, brake: 0, brakeD: 0, dr: 0, de: -0.5, da: 0 });
    sim.step(1 / 60);
    const cg = sim.cgPos();
    if (TRACE && k % 6 === 0) TRACE.push({ t: r2(k / 60), V: r2(gV(sim)), d: r2(Math.hypot(cg[0] - c0[0], cg[2] - c0[2])) });
    if (gV(sim) < 0.3) { tStop = r2(k / 60); dStop = r2(Math.hypot(cg[0] - c0[0], cg[2] - c0[2])); break; }
  }
  return { case: 'stop', build: BUILD, V0: V, surface: SURF === 5 ? 'paved' : 'grass', tStop, dStop };
}
function circuit() {
  const TR = require('./_tour_lib.js'), IN = require('./island_node.js');
  const TW = TR.tourWorld(C, IN, fs), W = TW.W, HOME = W.aerodromes.find(q => q.id === 'HOME');
  const def = buildDef();
  const H = TR.gameHost(C, W, def, HOME, HOME, { damage: true, lineup: true });
  const sim = H.sim; H.queueCmd({ cmd: 'start' });
  const FR = {}, breaks = []; let wasC = false;
  let ph = null, phases = [], tds = [], wasAir = false, rollH = 0, rollH0 = null, roH0 = null, roH = 0, roll0 = null, rollD = null, lockMis = 0;
  for (let k = 0; k < 60 * 480; k++) {
    H.step();
    const ap = H.ap; if (ap.phase !== ph) { ph = ap.phase; phases.push(ph + '@' + (k / 60).toFixed(0));
      if (ph === 'ROLL') { rollH0 = hdgOf(sim); roll0 = sim.cgPos(); } if (ph === 'LIFTOFF' && roll0) { const c = sim.cgPos(); rollD = r2(Math.hypot(c[0] - roll0[0], c[2] - roll0[2])); }
      if (ph === 'ROLLOUT') roH0 = hdgOf(sim); }
    if (ph === 'ROLL' && rollH0 != null && gV(sim) > 3) rollH = Math.max(rollH, Math.abs(wrap(hdgOf(sim) - rollH0)));
    if (ph === 'ROLLOUT' && roH0 != null) roH = Math.max(roH, Math.abs(wrap(hdgOf(sim) - roH0)));
    if (TRACE && (ph === 'ROLLOUT' || ph === 'FLARE') && k % 6 === 0) TRACE.push({ t: r2(k / 60), ph, V: r2(gV(sim)), hdg: r2(wrap(hdgOf(sim) - (roH0 == null ? hdgOf(sim) : roH0)) * 57.3),
      tw: twState(sim), ang: (sim.out.twAng || []).map(a => r2(a * 57.3)), onG: sim.wheelsOnGround(), dr: r2(sim.ctl.dr), bd: r2(sim.ctl.brakeD), br: r2(sim.ctl.brake) });
    if ((ph === 'ROLL' || ph === 'ROLLOUT') && sim.ctl.twLock === 0) lockMis++;
    // the steerable wheel's side force over its pawl's hold, worst per phase, and every breakout's phase
    if (sim.out.twF) { const f = Math.max(sim.out.twF[0], sim.out.twF[1] || 0); FR[ph] = Math.max(FR[ph] || 0, f); }
    if (sim.out.twState) { const c = sim.out.twState[0] === 1 || sim.out.twState[1] === 1; if (c && !wasC) breaks.push(ph + '@' + r2(k / 60)); wasC = c; }
    const onG = sim.wheelsOnGround(), v = sim.cgVel(), cg = sim.cgPos(), h = cg[1] - W.terrainH(cg[0], cg[2]);
    if (onG === 0 && h > 3) wasAir = true;
    if (onG > 0 && wasAir) { tds.push({ t: r2(k / 60), sink: r2(-v[1]), V: r2(Math.hypot(v[0], v[2])) }); wasAir = false; }
    if (H.crashed() || ap.phase === 'STOPPED') break;
  }
  const D = sim.damage ? sim.damage() : null;
  return { case: 'circuit', build: BUILD, phases: phases.join(' '), rollDist: rollD, rollHdgMaxDeg: r2(rollH * 180 / Math.PI),
           rolloutHdgMaxDeg: r2(roH * 180 / Math.PI), touchdowns: tds.slice(0, 4),
           twFoverHold: Object.fromEntries(Object.entries(FR).map(([k, v]) => [k, r2(v)])), breakouts: breaks, lockUnlockedOnRunwaySteps: lockMis, crashed: !!(D && D.crashed), reason: D && D.reason };
}
// stand: parked 4 s on the field - every tail contact's clearance (m), the deck (deg, nose up +), the contacts down
function stand() {
  const { sim, def } = ready();
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  const tw = [def.refs.tw, def.refs.tw2].filter(i => i != null && i >= 0);
  const clr = tw.map(i => r2(sim.p[i * 3 + 1] - sim.r[i]));
  // the deck: the pitch the stand took against the design datum - the mains-to-tail-contact line's rotation (tail down +;
  // a body axis off the nodes is not the datum: a twin's short pod reads 6 deg nose-up on the design frame)
  const M = def.refs.mains, ang = P => { let ax = 0, ay = 0, az = 0; for (const i of M) { ax += P(i)[0]; ay += P(i)[1]; az += P(i)[2]; }
    const k = M.length, t = tw[0], q = P(t); return Math.atan2(q[1] - ay / k, Math.hypot(q[0] - ax / k, q[2] - az / k)); };
  const deck = (ang(i => def.nodes[i].p) - ang(i => [sim.p[i * 3], sim.p[i * 3 + 1], sim.p[i * 3 + 2]])) * 57.3;
  return { case: 'stand', build: BUILD, tailContacts: tw.length, tailClear: clr, deckDeg: r2(deck),
           contacts: sim.wheelContacts(), smaxPct: r2(sim.stats().smax * 100), mode: def.params.twMode || 1, tailType: def.spec.tail.type,
           iv: def.spec.tail.ivAngle != null ? def.spec.tail.ivAngle : null };
}
const CASES = { pivot, rudder, roll, stop, circuit, stand };
const out = [];
for (const c of opt('case', 'pivot,rudder,roll').split(',')) { const r = CASES[c](); out.push(r); console.log(JSON.stringify(r)); }
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(out, null, 1));
if (TRACE) fs.writeFileSync(opt('trace'), JSON.stringify(TRACE));
