#!/usr/bin/env node
// dc3_break.js - DC3-2 (G3570-G3579, cloud, 2026-10-24): WHY THE DC-3 BREAKS, THROUGH THE GAME'S PATH. A TOOL, not a gate.
// The user's page runs (damage ON, Jolene, HOME 13/31, the fixture tools/fixtures/dc3_2026-10.json at 8 527 kg):
//   run 1  taxiing under the user's hand, 29 s in: "crashed: a tail member broke", peak strain 89 %, 0.0 km
//   run 2  the pilot from the line-up: the circuit, a balloon to 7.7 m, a drop at 4.6 m/s, a rebound, 3.85 m/s, "the
//          fuselage broke", peak strain 1719 %
// DC3-BUILD's node flights (tools/dc3_build.js, PR.fly) were the bench's: the certificate stamped before the spawn. The
// page is not: it rolls out on D1a's physics limits and stamps the certificate when the bench's thread answers (app.js
// certKick: 47 s in node for this build). So each case here runs BOTH ways - `phys` (the page's first minute) and `cert`
// (the stamp landed) - through the worker's own host (src/viewer/sim_host.js via tools/_tour_lib.js gameHost: the
// stand walked out of the shed, the wheels seated, the hand's packet, one step = the commands, the pilot, sim.step).
//
//   node tools/dc3_break.js [--file <build.json>] [--cases taxi,drop,circuit] [--lim phys,cert] [--json <out>]
//        [--hands idle,sturn,power,turn,burst,stick,rough] [--secs 60] [--at stand|runway] [--stand works|club]
//        [--parked off] [--obstacles off] [--field A,lam,V] [--atts level,three,tail] [--sinks 2,3.05,3.85,4.6]
//        [--fwd 34] [--kappa 0 (the before: G3572 off)]
//     taxi     the hand from the stand: idle, a slow taxi with S-turns, full power then the brakes, a full-rudder turn
//              under power, a taxi over HOME's grass at 8 m/s (the certificate's rough ground) - 60 s each
//     drop     the airframe let fall on its mains at 34 m/s along its heading, level (23.479), no lift (the
//              certificate's own drop, damage on): 2.0, 3.05 (10 ft/s, FAR 25.473), 3.85, 4.6 m/s
//     field    A ROUGH FIELD (a real DC-3 taxis on them): the certificate's own rough ground (66_gen_cert genCertTaxi:
//              bumps of A m, lam m apart, at V m/s, the throttle and rudder held to it) with the damage LIVE, not
//              probed - --field 0.04,3,8 (the certificate's), then rougher
//     circuit  the pilot from the line-up, the whole circuit (~300 s of sim: slow)
//     home     THE WHOLE TRIP (G3574): the pilot from the works stand - the taxi out, the circuit, the landing - then
//              the taxi back to the stand on the hand (taxiBack); contacts, the least clearance (--track <file>: the plan)
//     (--cage k=v,..: the build's cage rows set first - G3575 s2Steer=2, the full-swivel tailwheel)
//     back     the taxi back alone, from where the home case's landing stopped (--from x,z, --hdg rec|own)
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
process.chdir(ROOT);
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const C = require(process.env.PILOT_CORE || path.join(T, 'flight_core.js'));
const LB = require('./_load_build.js');
const TR = require('./_tour_lib.js');
const IN = require('./island_node.js');
const r2 = v => v == null || !isFinite(v) ? null : Math.round(v * 100) / 100;

const FILE = opt('file', 'tools/fixtures/dc3_2026-10.json');
// --kappa 0: the tail cone's root as DC3-BUILD left it (GEN_RULES.shellHoldKappa off: the bare skin's buckling) - the before
if (opt('kappa') != null) C.GEN_RULES.shellHoldKappa = +opt('kappa');
let CERT = null;
function defOf(lim) {
  // --cage k=v,k=v: the build's cage rows set before the load door (G3575: --cage s2Steer=2, the full-swivel tailwheel)
  const CG = opt('cage') ? Object.fromEntries(opt('cage').split(',').map(q => { const [k, x] = q.split('='); return [k, isNaN(+x) ? x : +x]; })) : null;
  const L = LB.loadBuild(FILE, CG ? { patch: j => { const sp = j.spec || j; sp.cage = Object.assign({}, sp.cage, CG); return j; } } : undefined);
  const d = C.buildGen(JSON.parse(JSON.stringify(L.spec)));
  d.params = Object.assign({}, d.params, { damage: true });
  if (lim === 'cert') {
    if (!CERT) { const t0 = Date.now(); CERT = C.genCertify(d, {}); CERT._s = (Date.now() - t0) / 1000; }
    d.cert = CERT;
  }
  return d;
}
// the member a damage record names: its class, its group, its ends' tags
function memberOf(def, bi) {
  const b = def.beams[bi]; if (!b) return null;
  const tag = i => (def.nodes[i] && (def.nodes[i].tag || def.nodes[i].name)) || i;
  return { bi, cls: b.cls, grp: b.grp || b.group || null, a: tag(b.a), b: tag(b.b), L: r2(b.L || b.len || 0) };
}
function dmgSummary(sim, def) {
  const D = sim.damage ? sim.damage() : null; if (!D) return null;
  const fb = D.firstBreak, fp = D.firstPrimary, fy = D.firstYield;
  return { crashed: !!D.crashed, reason: D.reason, at: r2(D.at), yields: D.yields, breaks: D.breaks, primary: D.primary,
    firstYield: fy ? Object.assign({ t: r2(fy.t) }, memberOf(def, fy.beam != null ? fy.beam : fy.bi)) : null,
    firstBreak: fb ? Object.assign({ t: r2(fb.t) }, memberOf(def, fb.beam != null ? fb.beam : fb.bi)) : null,
    firstPrimary: fp ? Object.assign({ t: r2(fp.t) }, memberOf(def, fp.beam)) : null,
    brokeUp: D.brokeUp || null, gPeak: r2(D.gPeak), groups: (D.groups || []).slice(0, 8) };
}
// the members nearest their limit: each frame, a member's force k (L - L0) over its break (tension b.fu, compression
// b.fc0) - the stamped limit with the certificate, the physics without; `track` returns the per-frame sampler
function tracker(sim) {
  const pk = new Float64Array(sim.beams.length);
  const tick = () => {
    for (let bi = 0; bi < sim.beams.length; bi++) {
      const b = sim.beams[bi]; if (b.broken || !(b.L0 > 0)) continue;
      const F = b.k * b.strain * b.L0 / (b.sK || 1);
      const r = F > 0 ? (b.fu > 0 && isFinite(b.fu) ? F / b.fu : 0) : (b.fc0 > 0 && isFinite(b.fc0) ? -F / b.fc0 : 0);
      if (r > pk[bi]) pk[bi] = r;
    }
  };
  return { tick, pk };
}
function worst(sim, def, TK, k) {
  const out = [];
  for (let bi = 0; bi < TK.pk.length; bi++) if (TK.pk[bi] > 0) out.push([TK.pk[bi], bi]);
  return out.sort((x, y) => y[0] - x[0]).slice(0, k || 6).map(([r, bi]) => Object.assign({ r: r2(r), broken: !!sim.beams[bi].broken }, memberOf(def, bi)));
}

// THE SANDBOX'S ROOM (G3507): a 29 m build rolls out of the WORKS (its stand walked 7.5 m further out than the club's)
if (opt('stand', 'works') === 'works' && C.SHELLS && C.SHELLS.works) {
  const own = C.playerShedDims;
  C.playerShedDims = (doc, id, site) => id === 'HOME' ? Object.assign({}, C.SHELLS.works.dims) : own(doc, id, site);
}
const TW = TR.tourWorld(C, IN, fs);
const W = TW.W, A = id => W.aerodromes.find(q => q.id === id);
// --parked off: the parked fleet taken out of the world (29_obstacles 'aircraft' records) - the airframe alone, no
// neighbour to taxi into (the 29 m build's stand stands inside the fleet's 16 m spots: DC3-STUDY §4)
if (opt('parked', 'on') === 'off') for (const r of W.obstacles.list()) if (r.tag === 'aircraft') W.obstacles.remove(r.id);
// --obstacles off: every obstacle record out (the props, the sheds, the fleet): the airframe and the ground alone
if (opt('obstacles', 'on') === 'off') for (const r of W.obstacles.list()) W.obstacles.remove(r.id);
const HOME = A('HOME');

// ---- TAXI: the hand from the stand ------------------------------------------------------------------------------
const HANDS = {
  idle:   t => ({ thr: 0, brake: 0, dr: 0, de: 0, da: 0 }),
  sturn:  t => ({ thr: t < 3 ? 0.15 : 0.32, brake: 0, dr: Math.sin(t * 2 * Math.PI / 8), de: -0.3, da: 0 }),
  power:  t => ({ thr: t < 14 ? 1 : 0, brake: t < 14 ? 0 : 1, dr: 0, de: -0.5, da: 0 }),
  turn:   t => ({ thr: 0.55, brake: 0, dr: 1, de: -0.3, da: 0 }),
  burst:  t => ({ thr: (t % 10) < 4 ? 1 : 0.1, brake: (t % 10) >= 7 ? 1 : 0, dr: ((t / 10) | 0) % 2 ? 1 : -1, de: 0, da: 0 }),
  stick:  t => ({ thr: 0.5, brake: t > 15 ? 1 : 0, dr: 0, de: 1, da: 0 }),
  // G3575: THE PIVOT a DC-3 crew turns on - the inside (right) toe brake on, power, full rudder, the stick back (a full-swivel
  // tailwheel breaks out; the steered one holds the tail)
  pivot:  t => ({ thr: t < 2 ? 0 : 0.45, brake: 0, brakeD: 1, dr: 1, de: -0.4, da: 0 }),
  // the certificate's rough taxi (23.491): straight at ~8 m/s, the throttle held to it (a hand on the lever)
  rough:  (t, sim) => { const v = sim.cgVel(), V = Math.hypot(v[0], v[2]); return { thr: V < 8 ? 0.45 : 0.08, brake: 0, dr: 0, de: -0.3, da: 0 }; },
};
function taxi(lim, hand, secs) {
  const def = defOf(lim);
  const H = TR.gameHost(C, W, def, HOME, HOME, { damage: true });
  const sim = H.sim;
  // --at runway: THE SAME HAND IN THE OPEN - the aeroplane on HOME's runway (placeAtAerodrome: the spawn, lined up),
  // nothing within its turning circle but the strip and the grass beside it; the stand's neighbours (the parked fleet,
  // the props, the sheds 7-40 m off a 29 m build) out of reach
  if (opt('at', 'stand') === 'runway') { sim.reset(0); if (sim.stance) sim.stance(); C.placeAtAerodrome(sim, HOME); H.ap.setRoute(HOME, HOME); }
  H.queueCmd({ cmd: 'manual', on: true }); H.queueCmd({ cmd: 'start' });
  if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) H.queueCmd({ cmd: 'setEngine', i, patch: { key: 'both', running: true } });
  let smax = 0, vmax = 0, d = 0, nzMax = 0, last = sim.cgPos(), tEnd = null, obstAt = null;
  const hdg = () => { const a = sim.axes()[0]; return Math.atan2(-a[2], -a[0]); }, h0 = hdg(), c00 = sim.cgPos();
  let turned = 0, hPrev = h0, rMax = 0;
  const TK = tracker(sim);
  for (let k = 0; k < 60 * secs; k++) {
    const t = k / 60;
    H.queueCmd({ cmd: 'hand', ctl: HANDS[hand](t, sim) });
    H.step(); TK.tick();
    const s = sim.stats().smax; if (s > smax) smax = s;
    const cg = sim.cgPos(), v = sim.cgVel(); vmax = Math.max(vmax, Math.hypot(v[0], v[2]));
    d += Math.hypot(cg[0] - last[0], cg[2] - last[2]); last = cg;
    nzMax = Math.max(nzMax, (sim.out && sim.out.nz) || 0);
    if (sim.out && sim.out.obst > 0 && obstAt == null) obstAt = r2(t);
    { const h = hdg(); let dh = h - hPrev; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI; turned += dh; hPrev = h; rMax = Math.max(rMax, Math.hypot(cg[0] - c00[0], cg[2] - c00[2])); }
    if (H.crashed()) { tEnd = t; break; }
  }
  return { case: 'taxi:' + hand, lim, t: tEnd, obstAt, dist: r2(d), vmax: r2(vmax), turnedDeg: Math.round(turned * 180 / Math.PI), cgOffMax: r2(rMax), nzMax: r2(nzMax), smaxPct: r2(smax * 100), dmg: dmgSummary(sim, def), worst: worst(sim, def, TK) };
}

// ---- DROP: the certificate's own drop (66_gen_cert genCertDrop), with the damage live ----------------------------
// `att`: 'level' (23.479: on the mains, the three-point deck taken out), 'three' (25.481's tail-down landing: the
// three-point attitude as it sits), 'tail' (tail first: 3 deg past the three-point - a balloon's stall dropped onto
// the tailwheel)
function drop(lim, sink, fwd, att) {
  const def = defOf(lim);
  const sim = C.makeSim(def, null);
  sim.reset(0);
  if (sim.stance) sim.stance();                     // on its three wheels (a bare reset is level on the mains: the tail 2.75 m up)
  if (lim === 'cert' && sim.certStamp) sim.certStamp(def.cert);
  if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'off' });
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  const D0 = dmgSummary(sim, def);
  const n = sim.n, [xA, , zR] = sim.axes(), c0 = sim.cgPos();
  let y0 = Infinity; for (let i = 0; i < n; i++) y0 = Math.min(y0, sim.p[i * 3 + 1] - def.nodes[i].r);
  // level on the mains (23.479): the three-point deck taken out, about the CG
  const deck = Math.asin(Math.max(-1, Math.min(1, -xA[1]))), th = att === 'three' ? 0 : att === 'tail' ? 3 * Math.PI / 180 : -deck, cs = Math.cos(th), sn = Math.sin(th), k = zR;
  for (let i = 0; i < n; i++) {
    const d = [sim.p[i*3] - c0[0], sim.p[i*3+1] - c0[1], sim.p[i*3+2] - c0[2]], kd = k[0]*d[0] + k[1]*d[1] + k[2]*d[2];
    const cr = [k[1]*d[2] - k[2]*d[1], k[2]*d[0] - k[0]*d[2], k[0]*d[1] - k[1]*d[0]];
    for (let j = 0; j < 3; j++) sim.p[i*3+j] = c0[j] + d[j] * cs + cr[j] * sn + k[j] * kd * (1 - cs);
  }
  let y1 = Infinity; for (let i = 0; i < n; i++) y1 = Math.min(y1, sim.p[i * 3 + 1] - def.nodes[i].r);
  const hl = Math.hypot(xA[0], xA[2]) || 1;
  for (let i = 0; i < n; i++) { sim.p[i*3+1] += y0 - y1 + 0.02; sim.v[i*3] = -fwd * xA[0] / hl; sim.v[i*3+1] = -sink; sim.v[i*3+2] = -fwd * xA[2] / hl; }
  let smax = 0, nzMax = 0;
  const TK = tracker(sim);
  for (let f = 0; f < 60 * 4; f++) {
    sim.step(1 / 60); TK.tick();
    smax = Math.max(smax, sim.stats().smax); nzMax = Math.max(nzMax, (sim.out && sim.out.nz) || 0);
  }
  return { case: 'drop:' + (att || 'level') + ':' + sink, lim, fwd, settled: D0 && { yields: D0.yields, breaks: D0.breaks }, nzMax: r2(nzMax), smaxPct: r2(smax * 100), dmg: dmgSummary(sim, def), worst: worst(sim, def, TK) };
}

// ---- FIELD: the certificate's rough taxi with the damage live ---------------------------------------------------
function field(lim, A, lam, V, secs) {
  const def = defOf(lim);
  const k1 = 2 * Math.PI / lam, k2 = 2 * Math.PI / (0.43 * lam);
  const Wf = { terrainH: (x, z) => A * Math.sin(k1 * x + 0.7) * Math.cos(0.8 * k1 * z) + 0.5 * A * Math.sin(k2 * (0.6 * x + 0.8 * z)),
               waterH: () => -1e9, trees: [], treesNear: (x, z, q) => { q.length = 0; return q; } };
  const sim = C.makeSim(def, Wf); sim.reset(0); if (sim.stance) sim.stance();
  if (lim === 'cert' && sim.certStamp) sim.certStamp(def.cert);
  if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
  for (let f = 0; f < 120; f++) sim.step(1 / 60);
  const x0 = sim.axes()[0], hl = Math.hypot(x0[0], x0[2]) || 1, fx = -x0[0] / hl, fz = -x0[2] / hl, h0 = Math.atan2(fz, fx);
  for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = V * fx; sim.v[i * 3 + 2] = V * fz; }
  const TK = tracker(sim); let I = 0, nzMax = 0, tEnd = null;
  for (let f = 0; f < secs * 60; f++) {
    const v = sim.cgVel(), e = V - (v[0] * fx + v[2] * fz); I = Math.max(-2, Math.min(2, I + e / 60));
    sim.ctl.thr = Math.max(0, Math.min(1, 0.25 + 0.15 * e + 0.1 * I));
    const xA = sim.axes()[0]; let dh = Math.atan2(-xA[2], -xA[0]) - h0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    sim.ctl.dr = Math.max(-1, Math.min(1, 3 * dh));
    sim.step(1 / 60); TK.tick(); nzMax = Math.max(nzMax, (sim.out && sim.out.nz) || 0);
    const D = sim.damage(); if (D && D.crashed) { tEnd = r2(f / 60); break; }
  }
  return { case: 'field:' + A + ',' + lam + ',' + V, lim, t: tEnd, nzMax: r2(nzMax), dmg: dmgSummary(sim, def), worst: worst(sim, def, TK) };
}

// ---- CIRCUIT: the pilot from the line-up -------------------------------------------------------------------------
function circuit(lim) {
  const def = defOf(lim);
  const H = TR.gameHost(C, W, def, HOME, HOME, { damage: true, lineup: true });
  const sim = H.sim; H.queueCmd({ cmd: 'start' });
  let smax = 0, agl = 0, wasAir = false, tds = [], ph = null, phases = [];
  const TK = tracker(sim);
  for (let k = 0; k < 60 * 420; k++) {
    H.step(); TK.tick();
    const ap = H.ap; if (ap.phase !== ph) { ph = ap.phase; phases.push(ph + '@' + (k / 60).toFixed(0)); }
    smax = Math.max(smax, sim.stats().smax);
    const onG = sim.wheelsOnGround(), v = sim.cgVel(), cg = sim.cgPos(), h = cg[1] - W.terrainH(cg[0], cg[2]);
    if (onG === 0 && h > 3) wasAir = true;
    if (onG > 0 && wasAir) { tds.push({ t: r2(k / 60), sink: r2(-v[1]), V: r2(Math.hypot(v[0], v[2])) }); wasAir = false; }
    if (H.crashed() || ap.phase === 'STOPPED') break;
  }
  return { case: 'circuit', lim, phases: phases.join(' '), touchdowns: tds.slice(0, 6), smaxPct: r2(smax * 100), dmg: dmgSummary(sim, def), worst: worst(sim, def, TK) };
}

// ---- HOME: THE WHOLE TRIP (the user, 25 Oct: "it should be able to complete a circuit including taxi from and to the hangar
// without hitting anything") - the pilot from the stand walked out of the shed (the works, G3507's room for a 29 m build):
// the taxi out, the take-off, the circuit, the landing, the roll-out; then THE TAXI BACK, which the pilot does not fly (it
// stops on the runway): a scripted hand (pure pursuit) on along the centreline to the hold ahead, then the way out that ends
// there, backwards, to the stand. On the ground every 0.25 s: the airframe's least PLAN clearance (every node) to the nearest
// footprint GATE TAXICLEAR measures (tools/_taxiclear_lib.js: the cooked places, their props, the dressing's cars, the parked
// aeroplanes, the trunks); in the world, every obstacle contact (out.obst) and trunk hit
const TL = require('./_taxiclear_lib.js');
function home(lim) {
  const TRACK = opt('track') ? [] : null;
  const def = defOf(lim);
  const H = TR.gameHost(C, W, def, HOME, HOME, { damage: true });
  const sim = H.sim; H.queueCmd({ cmd: 'start' });
  const SHP = TL.islandObstacles(C, 'jolene', 'town').concat(TL.treeTrunks(W)).concat(TL.registryObstacles(W)), IX = TL.index(SHP);
  const TK = tracker(sim);
  const R = { case: 'home', lim, phases: [], touchdowns: [], contacts: [], clear: { out: null, back: null }, stand: H.game.stand };
  const clearNow = leg => {
    let w = null;
    for (let i = 0; i < sim.n; i++) { const x = sim.p[i * 3], z = sim.p[i * 3 + 2], q = IX.nearest(x, z, 25); const d = q ? q.d : 25;
      if (!w || d < w.d) w = { d: r2(d), node: def.nodes[i].tag, what: q ? TL.fmtWhat(q.s) : 'nothing', at: [r2(x), r2(z)] }; }
    if (!R.clear[leg] || w.d < R.clear[leg].d) R.clear[leg] = Object.assign({ t: r2(sim.t) }, w);
  };
  const contact = leg => { if (sim.out && sim.out.obst > 0 && R.contacts.length < 20) R.contacts.push({ leg, t: r2(sim.t), nodes: sim.out.obst }); };
  let ph = null, wasAir = false, k = 0;
  for (; k < 60 * 1300; k++) {
    H.step(); TK.tick();
    const ap = H.ap; if (ap.phase !== ph) { ph = ap.phase; R.phases.push(ph + '@' + (k / 60).toFixed(0)); if (ph === 'GOAROUND') (R.goArounds = R.goArounds || []).push(ap.gaWhy || null); }
    const onG = sim.wheelsOnGround(), v = sim.cgVel(), cg = sim.cgPos(), h = cg[1] - W.terrainH(cg[0], cg[2]);
    if (onG === 0 && h > 3) wasAir = true;
    if (onG > 0 && wasAir) { R.touchdowns.push({ t: r2(k / 60), sink: r2(-v[1]), V: r2(Math.hypot(v[0], v[2])) }); wasAir = false; }
    if (onG > 0 && k % 15 === 0) clearNow(R.touchdowns.length ? 'back' : 'out');
    if (TRACK && k % 15 === 0) { const c = sim.cgPos(); TRACK.push([r2(c[0]), r2(c[2]), r2(k / 60), onG]); }
    contact(R.touchdowns.length ? 'back' : 'out');
    if (H.crashed() || ap.phase === 'STOPPED') break;
  }
  R.stopped = ph === 'STOPPED';
  if (R.stopped && !H.crashed()) R.taxiBack = taxiBack(H, sim, def, TK, clearNow, contact, TRACK, k / 60);
  R.trunkHits = sim.trunkHits ? sim.trunkHits() : null;
  R.dmg = dmgSummary(sim, def); R.worst = worst(sim, def, TK);
  if (TRACK) fs.writeFileSync(opt('track'), JSON.stringify(TRACK));   // --track file: the cg's plan every 0.25 s [x, z, t, wheels]
  return R;
}

// THE TAXI BACK (G3574): off the runway to the stand the flight left from, the hand on the keys. The way out that passes
// nearest the aeroplane (out[0]'s own leg runs down the runway: the backtrack to its hold) is followed from its nearest
// point back to the stand. When that way lies BEHIND (the aeroplane rolled past its turn-off) it turns round first on the
// runway and its graded band - a pivot does not work here (full rudder, the inside wheel locked and the outside engine
// up turn the DC-3 3 deg in 10 s: the tailwheel's steering holds the tail), so a TEARDROP: over to one side
// (--tdOff, 12 m), then a half circle (--tdR, 22 m) to the other, onto the way back
function taxiBack(H, sim, def, TK, clearNow, contact, TRACK, t0) {
  const st = C.siteOf('HOME'), shedD = C.playerShedDims(C.playerDefault(), 'HOME', st), stand = C.standFor(st, shedD, (x, z) => W.terrainH(x, z));
  const P = C.sitePattern(HOME, Object.assign({}, st, { stand }), { half: def.params.gen.span / 2 });
  const c0 = sim.cgPos(), ax0 = sim.axes()[0], fl = Math.hypot(ax0[0], ax0[2]), fx = -ax0[0] / fl, fz = -ax0[2] / fl;
  const nearest = (r, x, z) => { let b = null; r.pts.forEach((q, i) => { const d = Math.hypot(q.x - x, q.z - z); if (!b || d < b.d) b = { i, d }; }); return b; };
  let best = null;
  for (const r of TL.routesOf(C, P).filter(q => q.name.startsWith('out'))) { const n = nearest(r, c0[0], c0[2]); if (!best || n.d < best.d) best = Object.assign({ r }, n); }
  const out = { route: best.r.name, joinAt: r2(best.d), turn: null, parked: false, s: null };
  // the way back from the nearest point: does it start along the heading or against it?
  const q0 = best.r.pts[best.i], q1 = best.r.pts[Math.max(0, best.i - 20)];
  const along = (q1.x - q0.x) * fx + (q1.z - q0.z) * fz;
  let path = best.r.pts.slice(0, best.i + 1).reverse();
  // G3575: a FULL-SWIVEL tailwheel PIVOTS round on the inside toe brake (below) - no teardrop; the steered one cannot
  const SW = !!def.params.twSwivel;
  if (along < 0 && SW) out.turn = { kind: 'pivot' };
  if (along < 0 && !SW) {
    const off = +opt('tdOff', 12), rad = +opt('tdR', 22), lx = -fz, lz = fx;   // (lx, lz): the left of the heading
    const pre = [];
    for (let s = 2; s <= 40; s += 2) { const o = off * Math.min(1, s / 30); pre.push({ x: c0[0] + fx * s - lx * o, z: c0[2] + fz * s - lz * o }); }
    const e = pre[pre.length - 1], cx = e.x + lx * rad, cz = e.z + lz * rad;      // the half circle to the left
    for (let a = 0; a <= Math.PI; a += 2 / rad) pre.push({ x: cx - lx * rad * Math.cos(a) + fx * rad * Math.sin(a), z: cz - lz * rad * Math.cos(a) + fz * rad * Math.sin(a) });
    const end = pre[pre.length - 1], j = nearest(best.r, end.x, end.z);
    path = pre.concat(best.r.pts.slice(0, Math.min(j.i, best.i) + 1).reverse());
    out.turn = { kind: 'teardrop', off, rad, joinAt: r2(j.d) };
  }
  out.metres = path.length;
  H.queueCmd({ cmd: 'manual', on: true });
  let ip = 0, I = 0, pivOn = false, dhPrev = 0;
  for (let f = 0; f < 60 * +opt('backSecs', 900); f++) {
    const cg = sim.cgPos(), v = sim.cgVel(), V = Math.hypot(v[0], v[2]);
    // the point steered to: 10 m on - or past any point already BEHIND the aeroplane within 30 m (a corner inside the DC-3's
    // turning circle: steered at, it is circled, never reached)
    { const ax1 = sim.axes()[0];
      const ahead = q => (q.x - cg[0]) * -ax1[0] + (q.z - cg[2]) * -ax1[2];
      while (ip < path.length - 1) { const d = Math.hypot(path[ip].x - cg[0], path[ip].z - cg[2]); if (d < 10 || (d < 30 && ahead(path[ip]) < 0)) ip++; else break; } }
    const tg = path[ip], last = ip >= path.length - 1, dEnd = Math.hypot(path[path.length - 1].x - cg[0], path[path.length - 1].z - cg[2]);
    const ax = sim.axes()[0], hNow = Math.atan2(-ax[2], -ax[0]);
    let dh = hNow - Math.atan2(tg.z - cg[2], tg.x - cg[0]); while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    // (a corner ahead - the way turning more than 35 deg within 40 m - is met at a walk: at 6 m/s the DC-3 ran wide of the
    //  runway's turn-off and went round it once)
    const pa = path[Math.min(path.length - 1, ip + 20)], pb = path[Math.min(path.length - 1, ip + 40)];
    let turnA = Math.atan2(pb.z - pa.z, pb.x - pa.x) - Math.atan2(pa.z - tg.z, pa.x - tg.x); while (turnA > Math.PI) turnA -= 2 * Math.PI; while (turnA < -Math.PI) turnA += 2 * Math.PI;
    // (G3575: on a full swivel the rudder steers the wheel only until it breaks out - the toe brake on the inside does the
    //  rest, a walk, the way a DC-3 is turned; past 1 rad off, the pivot: power against the inside brake)
    // (the pivot from 0.8 rad off to 0.3, the toe brake damped on the error's rate - the castoring DC-3 has no tail force to
    //  stop its swing, so the brake stops it: an undamped pivot overshot into the next one, a slalom up the taxiway)
    //  ...and it ends only once the swing has stopped too: a castoring DC-3 let go at 0.3 rad swung on into the next pivot)
    const dhRate = (dh - dhPrev) * 60; dhPrev = dh;
    if (SW) { if (!pivOn && Math.abs(dh) > 0.8) pivOn = true; else if (pivOn && Math.abs(dh) < 0.3 && Math.abs(dhRate) < 0.05) pivOn = false; }
    const piv = SW && pivOn;
    const Vt = piv ? 1.0 : last && dEnd < 25 ? Math.max(0, dEnd / 8) : Math.abs(dh) > 0.35 || Math.abs(turnA) > 0.6 ? 2.5 : 6;
    const e2 = Vt - V; I = Math.max(-2, Math.min(2, I + e2 / 60));
    const dr = Math.max(-1, Math.min(1, 2.5 * dh));
    const thr = piv ? (V < 0.6 ? 0.3 : 0.12) : Math.max(0, Math.min(0.6, 0.12 + 0.12 * e2 + 0.05 * I)), brake = !piv && (e2 < -1.5 || (last && dEnd < 3)) ? 0.6 : 0;
    // (the toe brake only in the pivot: on every error it broke the wheel out again and again and the DC-3 weaved)
    const brakeD = piv ? Math.max(-1, Math.min(1, 1.2 * dh + 2.0 * dhRate)) : 0;
    H.queueCmd({ cmd: 'hand', ctl: SW ? { thr, brake, brakeD, dr, de: -0.4, da: 0 } : { thr, brake, dr, de: -0.4, da: 0 } });
    H.step(); TK.tick();
    if (f % 15 === 0) clearNow('back'); contact('back');
    if (TRACK && f % 15 === 0) { const c = sim.cgPos(); TRACK.push([r2(c[0]), r2(c[2]), r2(t0 + f / 60), 9]); }
    if (LOG && f % 600 === 0) console.error('back ' + r2(f / 60) + ' s  at ' + r2(cg[0]) + ',' + r2(cg[2]) + '  V ' + r2(V) + '  dh ' + r2(dh) + '  ip ' + ip + '/' + path.length);
    if (H.crashed()) break;
    if (last && dEnd < 4 && V < 0.3) { out.parked = true; out.s = r2(f / 60); break; }
  }
  const cg = sim.cgPos(); out.endFromStand = r2(Math.hypot(cg[0] - path[path.length - 1].x, cg[2] - path[path.length - 1].z));
  return out;
}
// --cases back: THE TAXI BACK ALONE, from where the home case's landing stopped (--from x,z: its STOPPED point; the
// aeroplane on the runway's line, landing heading --hdg the runway's own or 'rec' its reciprocal)
function back(lim) {
  const def = defOf(lim);
  const H = TR.gameHost(C, W, def, HOME, HOME, { damage: true });
  const sim = H.sim, TK = tracker(sim), TRACK = opt('track') ? [] : null;
  const [x, z] = opt('from', '-441.5,102.2').split(',').map(Number);
  sim.reset(0); if (sim.stance) sim.stance();
  C.placeAtAerodrome(sim, { hdg: HOME.hdg + (opt('hdg', 'rec') === 'rec' ? Math.PI : 0), spawn: [x, z], elev: W.terrainH(x, z) });
  if (C.seatOnGround) C.seatOnGround(sim, (px, pz) => W.terrainH(px, pz), def.refs);
  H.queueCmd({ cmd: 'start' });
  if (sim.eng) for (let i = 0; i < sim.eng.length; i++) H.queueCmd({ cmd: 'setEngine', i, patch: { key: 'both', running: true } });
  for (let f = 0; f < 120; f++) { H.queueCmd({ cmd: 'manual', on: true }); H.queueCmd({ cmd: 'hand', ctl: { thr: 0, brake: 1, dr: 0, de: -0.4, da: 0 } }); H.step(); }
  const SHP = TL.islandObstacles(C, 'jolene', 'town').concat(TL.treeTrunks(W)).concat(TL.registryObstacles(W)), IX = TL.index(SHP);
  const R = { case: 'back', lim, from: [x, z], contacts: [], clear: { back: null } };
  const ax = sim.axes()[0]; R.hdgDeg = Math.round(Math.atan2(-ax[2], -ax[0]) * 180 / Math.PI);
  const clearNow = leg => {
    let w = null;
    for (let i = 0; i < sim.n; i++) { const px = sim.p[i * 3], pz = sim.p[i * 3 + 2], q = IX.nearest(px, pz, 25); const d = q ? q.d : 25;
      if (!w || d < w.d) w = { d: r2(d), node: def.nodes[i].tag, what: q ? TL.fmtWhat(q.s) : 'nothing', at: [r2(px), r2(pz)] }; }
    if (!R.clear[leg] || w.d < R.clear[leg].d) R.clear[leg] = Object.assign({ t: r2(sim.t) }, w);
  };
  const contact = leg => { if (sim.out && sim.out.obst > 0 && R.contacts.length < 20) R.contacts.push({ leg, t: r2(sim.t), nodes: sim.out.obst }); };
  R.taxiBack = taxiBack(H, sim, def, TK, clearNow, contact, TRACK, 0);
  R.dmg = dmgSummary(sim, def);
  if (TRACK) fs.writeFileSync(opt('track'), JSON.stringify(TRACK));
  return R;
}

const LOG = argv.includes('--log');
const cases = opt('cases', 'taxi,drop').split(','), lims = opt('lim', 'phys,cert').split(',');
const hands = opt('hands', Object.keys(HANDS).join(',')).split(','), sinks = opt('sinks', '2.0,3.05,3.85,4.6').split(',').map(Number);
const all = [];
const say = r => { all.push(r); console.log(JSON.stringify(r)); };
for (const lim of lims) {
  if (cases.includes('taxi')) for (const h of hands) say(taxi(lim, h, +opt('secs', 60)));
  if (cases.includes('drop')) for (const a of opt('atts', 'level').split(',')) for (const s of sinks) say(drop(lim, s, +opt('fwd', 34), a));
  if (cases.includes('field')) for (const fl of opt('field', '0.04,3,8').split(';')) { const [A, lam, V] = fl.split(',').map(Number); say(field(lim, A, lam, V, +opt('secs', 20))); }
  if (cases.includes('circuit')) say(circuit(lim));
  if (cases.includes('home')) say(home(lim));
  if (cases.includes('back')) say(back(lim));
}
if (CERT) console.log('certificate: ' + CERT._s.toFixed(1) + ' s');
if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(all, null, 1));
module.exports = { HANDS };
