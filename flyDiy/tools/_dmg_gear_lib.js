// G1835-G1838 (DMG-D2b GEAR): the scenarios GATE DMGGEAR (_dmg_gear_check.js) and its evidence (dmg_gear_evidence.js)
// fly on the user's validated builds, node only, on THE CERTIFICATE (66_gen_cert: the gear's own cases and the
// ground and water loads included):
//   ORDINARY OPERATIONS under the probe (every member's peak force over its CERTIFIED yield, per substep - the
//     headroom table, dm14): the circuit, a crosswind circuit within the demonstrated component (FAR 23.233's
//     0.2 V_S0, as recalled), a taxi on grass and on a rough field, on the water at displacement speed and in a light
//     chop, touchdowns at the normal sink (1.0 m/s) and a firm one (1.5 m/s) at the touchdown speed, the build's own
//     FAR 23.473 limit sink (the certificate's own limit case: reported, must not yield);
//   THE BRACKET (damage on): the drop at the 23.473 limit sink (no set), at 1.2 x the certificate's sink (23.727's
//     reserve energy: the gear yields, nothing breaks), at the NASA 172 Test 1 point (7 m/s down, 18 m/s forward: it
//     breaks, the gear first);
//   §7.4's GEAR ROWS (damage on): the ground loop (a main folds by side load, the low wing strikes), the porpoise
//     (nose-first bounces: the nose gear collapses on the Nth), the float dig-in (the floats' strut fittings fail in
//     overload).
'use strict';
const L = require('./_treecrash_lib.js');

const finite = L.finite;
const peakOf = L.peakOf;
const clearPeak = sim => { const P = sim.damagePeak && sim.damagePeak(); if (P) { P.t.fill(0); P.c.fill(0); if (P.cl) P.cl.fill(0); if (P.tw) P.tw.fill(0); } };
// the worst member (and the worst of the gear's) from a probed sim
function worst(sim) {
  const P = sim.damagePeak(), B = sim.beams, out = { max: 0, i: -1, s: '', gear: 0, gi: -1, air: 0, ai: -1 };
  for (let i = 0; i < P.t.length; i++) for (const [s, v] of [['t', P.t[i]], ['c', P.c[i]]]) {
    if (v > out.max) { out.max = v; out.i = i; out.s = s; }
    if (B[i].cls === 'gear') { if (v > out.gear) { out.gear = v; out.gi = i; } }
    else if (v > out.air) { out.air = v; out.ai = i; }
  }
  const tag = i => (i >= 0 ? (sim._def.nodes[B[i].a].tag + '-' + sim._def.nodes[B[i].b].tag) : '');
  out.cls = out.i >= 0 ? B[out.i].cls : null; out.tags = tag(out.i); out.gtags = tag(out.gi); out.atags = tag(out.ai);
  out.vis = out.i >= 0 ? B[out.i].vis : null;
  return out;
}
const Vso = def => { const g = def.params.gen; return g.VsFlap || g.Vs; };

// a world with the ground's own bumps (a rough field: two crossed trains, `A` m, `lam` m; the trunks and obstacles
// of flatWorld's kind, none placed)
function bumpyWorld(elev, A, lam) {
  const F = L.flatWorld(elev);
  const k1 = 2 * Math.PI / lam, k2 = 2 * Math.PI / (0.43 * lam);
  F.W.terrainH = (x, z) => elev + A * Math.sin(k1 * x + 0.7) * Math.cos(0.8 * k1 * z) + 0.5 * A * Math.sin(k2 * (0.6 * x + 0.8 * z));
  return F;
}

// THE CIRCUIT with the pilot (calm, or a crosswind of `xw` m/s from the right of the runway, or `wind` { U, th }: U m/s
// from th deg off the lane's heading - 0 along it, 90 the gate's crosswind side, DMGWIND's quarters), probed. On the
// water (G2386, DMG-RECAL2) the floats' CONTACT PHASES are counted from the first wet frame on: a run of wet frames
// after at least 3 dry ones (1/20 s) is a new contact - a skip
function circuit(key, o) {
  const C = L.core(), def = L.defOf(key, { probe: true }), world = C.makeWorld();
  const sim = C.makeSim(def, world); sim.reset(0); sim._def = def; L.lastRun.sim = sim;
  const a = world.aerodromes.find(x => x.id === (sim.hydro ? 'SEA' : 'HOME')) || world.aerodromes[0];
  if (o.xw && world.setWind) { const h = a.hdg; world.setWind({ base: [-Math.sin(h) * o.xw, 0, Math.cos(h) * o.xw], gust: 0 }); }
  if (o.wind && o.wind.U && world.setWind) {
    const h = a.hdg, U = o.wind.U, c = Math.cos(o.wind.th * Math.PI / 180), sn = Math.sin(o.wind.th * Math.PI / 180);
    world.setWind({ base: [U * (-sn * Math.sin(h) - c * Math.cos(h)), 0, U * (sn * Math.cos(h) - c * Math.sin(h))], gust: 0 });
  }
  if (sim.hydro) C.placeAtAerodrome(sim, a);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, world);
  if (sim.hydro) ap.setRoute(a, a);
  clearPeak(sim);
  // per phase: the worst member (the probe cleared at each phase change; the run's worst is the worst phase's)
  const phases = []; let s = 0, ph = null, t0 = 0;
  const close = () => { if (ph) { const w = worst(sim); phases.push({ ph, t0, t1: sim.t, max: w.max, tags: w.tags, cls: w.cls, s: w.s, gear: w.gear, gtags: w.gtags }); } clearPeak(sim); };
  const HY = sim.hydro, landing = p => p === 'FLARE' || p === 'ROLLOUT' || p === 'STOPPED';
  const touches = []; let dry = 0, cur = null;
  // (a floatplane's circuit is the longer one: the water lane's pattern and the roll-out off the step)
  for (; s < (o.maxS || (HY ? 480 : 340)) * 60; s++) {
    ap.update(1 / 60);
    if (ap.phase !== ph) { close(); ph = ap.phase; t0 = sim.t; }
    sim.step(1 / 60);
    if (HY && landing(ap.phase)) {
      let wet = false; for (const fx of HY.floats) if (fx.wet > 0.05) { wet = true; break; }
      if (wet) {
        if (!cur || dry >= 3) {
          const v = sim.cgVel(), d = ap.dbg || {};
          cur = { t: sim.t, V: Math.hypot(v[0], v[2]), sink: -v[1], pitch: (d.th || 0) * 180 / Math.PI, bank: (d.ph || 0) * 180 / Math.PI };
          touches.push(cur);
        }
        dry = 0;
      } else if (cur) dry++;
    }
    if (ap.phase === 'STOPPED' && ap.t > 3) break;
  }
  close();
  const top = phases.reduce((a, x) => (x.max > a.max ? x : a), { max: 0 }), gtop = phases.reduce((a, x) => (x.gear > a.gear ? x : a), { gear: 0 });
  const w = { max: top.max, tags: top.tags, cls: top.cls, s: top.s, phase: top.ph, gear: gtop.gear, gtags: gtop.gtags };
  return { outcome: ap.report && ap.report.outcome, landing: ap.report && ap.report.landing, t: s / 60, w, phases, finite: finite(sim),
           contacts: HY ? touches.length : null, touches: HY ? touches : null, verdicts: ap.report ? ap.report.verdicts.filter(v => /go-around|gave-up|rejected|vref/.test(v.code)) : [] };
}

// A TAXI: `V` m/s held on the throttle, the heading held on the rudder (and the brakes off), `secs` s, on a flat field
// (grass), a rough one (`rough`: bumps of A m at lam m), or the water (a floatplane: the sea lane, `chop` m/s of wind)
function taxi(key, o) {
  const C = L.core(), def = L.defOf(key, { probe: true });
  let W, strip, sim;
  const probe0 = C.makeSim(def, null);
  if (probe0.hydro) {
    W = C.makeWorld(); if (o.chop && W.setWind) W.setWind({ base: [o.chop, 0, 0], gust: 0 });
    strip = W.aerodromes.find(a => a.id === 'SEA'); sim = C.makeSim(def, W); sim.reset(0); C.placeAtAerodrome(sim, strip);
  } else {
    ({ W, strip } = o.rough ? bumpyWorld(0, o.rough.A, o.rough.lam) : L.flatWorld(0));
    sim = C.makeSim(def, W); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 }));
  }
  sim._def = def; L.lastRun.sim = sim;
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  // the nose's way (the body's -x), and the heading held on it: the rudder's sense found, not assumed (`sgn`)
  const x0 = sim.axes()[0], hl = Math.hypot(x0[0], x0[2]), fx = -x0[0] / hl, fz = -x0[2] / hl;
  clearPeak(sim);
  let I = 0, yawMax = 0;
  const h0 = Math.atan2(fz, fx), sgn = o.rudSgn || 1;
  for (let f = 0; f < (o.secs || 20) * 60; f++) {
    const v = sim.cgVel(), Vg = v[0] * fx + v[2] * fz, e = o.V - Vg; I = Math.max(-2, Math.min(2, I + e / 60));
    sim.ctl.thr = Math.max(0, Math.min(1, 0.25 + 0.15 * e + 0.1 * I));
    const xA = sim.axes()[0], h = Math.atan2(-xA[2], -xA[0]); let dh = h - h0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    yawMax = Math.max(yawMax, Math.abs(dh));
    sim.ctl.dr = Math.max(-1, Math.min(1, sgn * 3 * dh)); sim.ctl.brake = 0;
    sim.step(1 / 60);
  }
  const v = sim.cgVel();
  return { V: v[0] * fx + v[2] * fz, yawMax: yawMax * 180 / Math.PI, w: worst(sim), finite: finite(sim) };
}

// A TOUCHDOWN: L.hardLanding's drop at `sink`, with the touchdown speed (V_S0) along the heading (a floatplane onto
// the sea lane; `chop`: the sea of that wind)
function touchdown(key, o) {
  const C = L.core(), def = L.defOf(key, { probe: true });
  const r = L.hardLanding(key, { probe: true, sink: o.sink, fwd: o.fwd == null ? Vso(def) : o.fwd });
  const sim = L.lastRun.sim; sim._def = def;
  return { nz: r.gMax, w: worst(sim), finite: r.finite };
}

// ---- THE BRACKET (damage on, the certificate): a drop at `sink` (and `fwd`), what the gear and the airframe did
function bracketDrop(key, o) {
  const C = L.core(), def = L.defOf(key, {});
  const r = L.hardLanding(key, { sink: o.sink, fwd: o.fwd || 0, frames: o.frames || 150 });
  const sim = L.lastRun.sim, D = sim.damage(), B = sim.beams;
  const set = { gear: 0, other: 0 }, brk = { gear: 0, other: 0 };
  B.forEach(b => { if (b.yielded && !b.broken) set[b.cls === 'gear' ? 'gear' : 'other']++; });
  D.broken.forEach(i => brk[B[i].cls === 'gear' ? 'gear' : 'other']++);
  const fb = D.firstBreak, g0 = D.groups && D.groups[0];
  return { sink: o.sink, fwd: o.fwd || 0, nz: r.gMax, set, brk, setMax: D.setMax, groups: (D.groups || []).map(G => G.key), firstGroup: g0 ? g0.key : null,
    firstBreak: fb ? { cls: fb.cls, seam: fb.seam, how: fb.how, tags: def.nodes[B[fb.beam].a].tag + '-' + def.nodes[B[fb.beam].b].tag } : null,
    crashed: D.crashed, reason: D.reason, finite: r.finite };
}

// ---- §7.4 THE GROUND LOOP (damage on): rolling at `V` m/s on the flat with the aeroplane yawed `yaw` deg off its track
// (the swing a ground loop is, at the moment the mains skid sideways), the rudder against it, `secs` s. What broke,
// in which order, and the lowest wingtip over the ground
function groundLoop(key, o) {
  const C = L.core(), def = L.defOf(key, {}), { W, strip } = L.flatWorld(0);
  const sim = C.makeSim(def, W); sim.reset(0); L.lastRun.sim = sim;
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 }));
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  const n = sim.n, c0 = sim.cgPos(), th = (o.yaw || 0) * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
  // turn the aeroplane about the vertical through its CG; the velocity stays along the strip
  for (let i = 0; i < n; i++) { const dx = sim.p[i*3] - c0[0], dz = sim.p[i*3+2] - c0[2]; sim.p[i*3] = c0[0] + dx * cs - dz * sn; sim.p[i*3+2] = c0[2] + dx * sn + dz * cs; }
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg), w = (o.rate || 0) * Math.PI / 180;
  // ...and swinging: a yaw rate `rate` deg/s about the vertical through the CG (the ground loop's own turn)
  for (let i = 0; i < n; i++) { const rx = sim.p[i*3] - c0[0], rz = sim.p[i*3+2] - c0[2];
    sim.v[i*3] = o.V * fx + w * rz; sim.v[i*3+2] = o.V * fz - w * rx; sim.v[i*3+1] = 0; }
  sim.ctl.thr = 0; sim.ctl.dr = -Math.sign(o.yaw || o.rate || 1);
  const tips = []; def.nodes.forEach((nd, i) => { if ((nd.tag === 'WF' || nd.tag === 'WR') && Math.abs(nd.p[2]) > 0.8 * def.params.gen.span / 2) tips.push(i); });
  let tipMin = Infinity, tipT = null;
  for (let f = 0; f < (o.secs || 4) * 60; f++) {
    sim.step(1 / 60);
    for (const i of tips) { const h = sim.p[i*3+1] - (W.terrainH ? W.terrainH(sim.p[i*3], sim.p[i*3+2]) : 0); if (h < tipMin) { tipMin = h; } if (h < 0.05 && tipT == null) tipT = sim.t; }
  }
  const D = sim.damage(), B = sim.beams, fb = D.firstBreak;
  return { V: o.V, yaw: o.yaw, rate: o.rate || 0, groups: (D.groups || []).map(G => G.key), firstGroup: D.groups && D.groups[0] ? D.groups[0].key : null,
    firstBreak: fb ? { cls: fb.cls, seam: fb.seam, how: fb.how, t: fb.t, tags: def.nodes[B[fb.beam].a].tag + '-' + def.nodes[B[fb.beam].b].tag } : null,
    gearBroken: D.broken.filter(i => B[i].cls === 'gear').length, wingBroken: D.broken.filter(i => B[i].cls === 'wing').length,
    set: D.members, tipMin, tipStrike: tipT, crashed: D.crashed, reason: D.reason, finite: finite(sim) };
}

// ---- §7.4 THE PORPOISE (damage on; a tricycle): nose-first touchdowns at `V` m/s forward, `sink` m/s down, pitched
// `pitch` deg nose-down, `n` times in a row on the same airframe (each a bounce: the aeroplane put back over the
// runway with the same speeds, its damage kept). The nose leg's set after each, and the bounce it collapsed on
function porpoise(key, o) {
  const C = L.core(), def = L.defOf(key, {}), { W, strip } = L.flatWorld(0);
  const sim = C.makeSim(def, W); sim.reset(0); L.lastRun.sim = sim;
  C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 }));
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  const tw = def.refs.tw, n = sim.n, B = sim.beams;
  const legs = []; B.forEach((b, i) => { if (b.cls === 'gear' && b.vis === 'leg' && (b.a === tw || b.b === tw)) legs.push(i); });
  const fx = Math.cos(strip.hdg), fz = Math.sin(strip.hdg), out = [];
  let collapsed = null;
  const sinks = o.sinks || Array(o.n || 3).fill(o.sink);
  for (let k = 1; k <= sinks.length; k++) {
    // the pose: level, then pitched nose-down about the CG (a positive turn about the body's right axis raises the
    // nose: the frame is left-handed), the lowest wheel 2 cm over the ground
    const [xA, , zR] = sim.axes(), c0 = sim.cgPos();
    const deck = Math.asin(Math.max(-1, Math.min(1, -xA[1]))), th = -deck - (o.pitch || 4) * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th), kk = zR;
    for (let i = 0; i < n; i++) {
      const d = [sim.p[i*3] - c0[0], sim.p[i*3+1] - c0[1], sim.p[i*3+2] - c0[2]], kd = kk[0]*d[0] + kk[1]*d[1] + kk[2]*d[2];
      const cr = [kk[1]*d[2] - kk[2]*d[1], kk[2]*d[0] - kk[0]*d[2], kk[0]*d[1] - kk[1]*d[0]];
      for (let j = 0; j < 3; j++) sim.p[i*3+j] = c0[j] + d[j] * Math.cos(th) + cr[j] * Math.sin(th) + kk[j] * kd * (1 - Math.cos(th));
    }
    let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, sim.p[i*3+1] - def.nodes[i].r);
    for (let i = 0; i < n; i++) { sim.p[i*3+1] += 0.02 - yMin; sim.v[i*3] = o.V * fx; sim.v[i*3+1] = -sinks[k - 1]; sim.v[i*3+2] = o.V * fz; }
    sim.ctl.thr = 0; sim.ctl.de = 0;
    for (let f = 0; f < 60; f++) sim.step(1 / 60);
    const D = sim.damage();
    const set = legs.map(i => (B[i].Lr > 0 ? (B[i].Lr - B[i].L0) / B[i].Lr : 0));
    const broken = legs.some(i => B[i].broken);
    out.push({ bounce: k, sink: sinks[k - 1], legSet: Math.max(...set), legBroken: broken, groups: (D.groups || []).map(G => G.key), set: D.members, breaks: D.breaks });
    if (broken && collapsed == null) { collapsed = k; break; }
  }
  const D = sim.damage();
  return { V: o.V, sinks, pitch: o.pitch, bounces: out, collapsed, propStrike: D.propStrike, crashed: D.crashed, reason: D.reason, finite: finite(sim) };
}

// ---- §7.4 THE FLOAT DIG-IN (damage on): TREECRASH's water case at `V` km/h, `sink` m/s, `pitch` deg nose-down; the
// floats' strut groups that let go, and what went first
function digIn(key, o) {
  const def = L.defOf(key, {});
  const r = L.waterCase(key, Object.assign({ secs: 4 }, o, { V: o.V / 3.6 }));
  const sim = L.lastRun.sim, D = sim.damage(), B = sim.beams, fb = D.firstBreak;
  const G = (D.groups || []).map(x => x.key);
  return { V: o.V, sink: o.sink, pitch: o.pitch, groups: G, floatStruts: G.filter(k => /^float/.test(k)), firstGroup: G[0] || null,
    firstBreak: fb ? { cls: fb.cls, seam: fb.seam, how: fb.how, t: fb.t, tags: def.nodes[B[fb.beam].a].tag + '-' + def.nodes[B[fb.beam].b].tag } : null,
    set: D.members, breaks: D.breaks, crashed: D.crashed, reason: D.reason, gPeak: D.gPeak, finite: r.finite };
}

// ---- THE BRACKET'S STAMP: per gear joint of the build, its envelope, its limits and its travel (the certified sim)
function bracket(key) {
  const C = L.core(), def = L.defOf(key, {}), sim = C.makeSim(def, null); sim.reset(0);
  const phys = C.makeSim(L.defOf(key, { cert: false }), null); phys.reset(0);
  const cert = def.cert, rows = [], link = new Set();
  for (const Gr of (def.parts && def.parts.dmg ? def.parts.dmg.groups : [])) for (const j of Gr.t1) link.add(j);
  const floor = C.GEN_CERT.leg.floorW * def.nodes.reduce((a, nd) => a + nd.m, 0) * 9.81, flt = i => /^FL[KD]/.test(def.nodes[i].tag || '');
  sim.beams.forEach((b, i) => {
    if (b.cls !== 'gear') return;
    const p = phys.beams[i], stamped = b.fy0 !== p.fy0 || b.fc0 !== p.fc0 || b.fu !== p.fu;
    rows.push({ i, tags: def.nodes[b.a].tag + '-' + def.nodes[b.b].tag, vis: b.vis, seam: b.seam, link: link.has(i), float: flt(b.a) || flt(b.b), tens: !!b.tens, floor,
      stamped, Ft: cert ? cert.Ft[i] : null, Fc: cert ? cert.Fc[i] : null,
      by: cert && cert.names ? [cert.names[cert.byT[i]], cert.names[cert.byC[i]]] : null, fy: b.fy0, fu: b.fu, fc: b.fc0, etu: b.etu, ecu: b.ecu, phys: [p.fy0, p.fu, p.fc0] });
  });
  return { arch: def.spec.gear.suspension, type: def.spec.gear.type, rows };
}

module.exports = { L, worst, circuit, taxi, touchdown, bracketDrop, groundLoop, porpoise, digIn, bracket, bumpyWorld, Vso };
