#!/usr/bin/env node
// GATE WILGAGEAR (WILGA-GEAR, futureDesigns/WILGA-GEAR-STUDY-2026-11.md) - the trailing-link oleo leg, the PZL-104 Wilga's
// kind (the user: "modeling the Wilga type suspension, very close to original, full integrated in the game"). Node only:
//   1. THE GEOMETRY AS RESEARCHED: the reference (GEN_RULES.lever, the study's §2) - the arm 0.400 m, its swing 62 -> 12
//      deg, 0.27 m of wheel travel on 0.115 m of strut, a motion ratio that falls and never toggles inside the travel;
//      the host's frame stands its nodes exactly on the reference's points
//   2. THE STATIC DEFLECTION AT GROSS: the Wilga-class host (1.3 t, the Wilga's track and 500 mm tyres) settled - the
//      wheel's rise from full extension is the study's 0.070 m (+-0.010) and the strut's pressure a light oleo's
//   3. A FAR 23.725-STYLE LIMIT DROP absorbed without bottoming (the 23.473(d) limit sink, no wing lift: stricter than the
//      rule's 2/3 W); the reserve drop (23.727: 1.2 x the sink) bottoms on the steel stop and the gear recovers
//   4. NO POGO after a firm landing (1.5 m/s at 0.8 Vs: the wing's lift ~2/3 W): the wheels never leave the ground for
//      more than 0.15 s and the strut is still within 3 mm 2.5 s after the touch
//   5. THE WHEEL'S PATH IS THE TRAILING ARC: through the drop the axle stays on its circle about the pivot (the arm's
//      length to 2 mm), rises AFT, and the strut's stroke is the kinematics' at the arm's angle (1.5 mm)
//   6. A BROKEN LEG DROPS: damage on, certified - one joint member let go and the leg's whole part comes off: the wing
//      tip on the ground, the crash says the gear (the drawn parts ride the same nodes, 7)
//   7. THE DRAWN LEG = THE PHYSICS LEG: through the game's own load chain (_load_build: the garage draws the leg, the join
//      measures it) the frame's nodes stand on the drawn points; and at every compression of a drop the drawn parts as
//      the garage poses them (GEAR_LEVER at the strut's stroke) sit on the physics nodes (3 mm)
//   7b. THE FAIRING: the leg's boot and the spat on the arm never meet through the stroke, and the boot hides the strut
//   8. NOTHING ELSE MOVED: a build without the leg is bit-identical to one built before it existed (its def keyless)
// Run: node tools/_wilga_gear_check.js   (one final `GATE WILGAGEAR: PASS|FAIL`)
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const C = require(path.join(T, 'flight_core.js'));
const G = C.GEAR_LEVER, LR = C.GEN_RULES.lever, D2R = Math.PI / 180;
let pass = 0, fail = 0;
const yes = (ok, msg) => { if (ok) pass++; else fail++; console.log((ok ? '  ok    ' : '  FAIL  ') + msg); };
const f3 = v => (+v).toFixed(3), mm = v => (v * 1000).toFixed(1) + ' mm';

// THE WILGA-CLASS HOST: the user's metal Cessna's airframe (1.3 t, high wing, four seats - the Wilga's class) flown as a
// taildragger on the lever gear, the Wilga's 2.83 m track (the study's [14]) and its Stomil 500 x 200 tyres ([1], [8])
function hostSpec() {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/cessna172_2026-09-20_corrected.json'), 'utf8'));
  const s = JSON.parse(JSON.stringify(raw.spec || raw));
  Object.assign(s.gear, { type: 'taildragger', suspension: 'lever', track: 2.83, wheelR: 0.25, twR: 0.128, x: null, y: null, twX: null, twY: null,
    fairing: 'none', twFairing: 'none', legFair: 'none', twLegFair: 'none', floats: null });
  delete s.gear.lever;
  return s;
}
const SPEC = hostSpec(), DEF = C.buildGen(JSON.parse(JSON.stringify(SPEC)));
const LV = DEF.parts.lever, N = DEF.nodes;
const settled = (def, secs) => { const sim = C.makeSim(def, null); sim.reset(0); for (let f = 0; f < (secs || 8) * 60; f++) sim.step(1 / 60); return sim; };
const mid = (P, a, b) => [0, 1, 2].map(k => 0.5 * (P(a)[k] + P(b)[k]));
// one side's lever record from the def's rest nodes (the frame's axes)
const leverOf = (def, sd, up) => G.gearLeverInit({ piv: mid(i => def.nodes[i].p, sd.pi, sd.po), ax: [0, 0, 1], w: 0.06,
  axle: def.nodes[sd.axle].p.slice(), horn: def.nodes[sd.h].p.slice(), top: def.nodes[sd.u].p.slice() }, up);

console.log('1. the geometry as researched (GEN_RULES.lever: the Wilga 80 off the Aerofly FS4 model, held to the TCDS)');
{
  const g = G.gearLeverRef(LR), L = G.gearLeverInit({ piv: g.piv, ax: [0, 0, 1], w: g.w, axle: [0, 0, 0], horn: g.horn, top: g.top });
  const arm = Math.hypot(g.piv[0], g.piv[1]), full = G.gearLeverAt(L, g.comp);
  yes(Math.abs(arm - 0.400) < 1e-9 && Math.abs(LR.ang - 62) < 1e-9 && Math.abs(LR.comp - 12) < 1e-9,
      'the arm ' + f3(arm) + ' m, extended ' + LR.ang + ' deg below level, full stroke ' + LR.comp + ' deg (the study §2.2-§3)');
  yes(Math.abs(full.rise - 0.270) < 0.005 && Math.abs(full.s - 0.115) < 0.003,
      'the wheel travels ' + mm(full.rise) + ' on ' + mm(full.s) + ' of strut (the study: 270 / 115 mm)');
  let tog = 0, best = -1, mono = true, prev = -1;
  for (let a = 0; a <= 120; a += 0.5) { const s = G.gearLeverAt(L, a * D2R).s; if (s > best) { best = s; tog = a; } if (a <= LR.ang - LR.comp && s <= prev) mono = false; prev = s; }
  const mr0 = G.gearLeverMR(L, 0), mr1 = G.gearLeverMR(L, g.comp);
  yes(mono && tog >= (LR.ang - LR.comp) + 30, 'the stroke rises through the whole travel and the linkage toggles ' + tog.toFixed(1) +
      ' deg into the swing, ' + (tog - (LR.ang - LR.comp)).toFixed(1) + ' deg past full stroke (30 at least)');
  yes(mr0 > mr1 && mr0 < 1 && mr1 > 0.2, 'the motion ratio falls ' + mr0.toFixed(2) + ' -> ' + mr1.toFixed(2) + ' (the strut sees the wheel\'s load over it)');
  // the host's frame on the reference's points
  let worst = 0;
  for (const sd of LV.sides) {
    const A = N[sd.axle].p, q = sd.side === 'L' ? -1 : 1, rel = p => [p[0] - A[0], p[1] - A[1], q * (p[2] - A[2])];
    const pm = rel(mid(i => N[i].p, sd.pi, sd.po)), h = rel(N[sd.h].p), tt = rel(N[sd.u].p);
    for (const [a, b] of [[pm, g.piv], [h, g.horn], [tt, g.top]]) worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  yes(worst < 1e-9, 'the host\'s frame stands the pivot, the horn and the strut\'s eye on the reference\'s points (' + worst.toExponential(1) + ' m)');
  const g2 = SPEC.gear;
  yes(Math.abs(DEF.spec.gear.track - 2.83) < 1e-9 && Math.abs(g2.wheelR - 0.25) < 1e-9, 'the host stands on the Wilga\'s 2.83 m track and 500 mm tyres');
}

console.log('2. the static deflection at gross');
{
  const sim = settled(DEF, 8), W = N.reduce((a, nd) => a + nd.m, 0), ol = sim.oleo();   // (the flown mass: the host at its design gross)
  for (let k = 0; k < 2; k++) {
    const sd = LV.sides[k], O = sd.O, L = leverOf(DEF, sd, [-Math.sin(LV.deck), Math.cos(LV.deck), 0]);
    const ang = G.gearLeverAngOf(L, 's', ol[k].s, LV.geom.comp), rise = G.gearLeverAt(L, ang).rise;
    yes(Math.abs(rise - LR.dSt) <= 0.010, sd.side + ': at ' + W.toFixed(0) + ' kg the wheel stands ' + mm(rise) + ' up from full extension (the study: ' +
        mm(LR.dSt) + ' +-10), the strut ' + mm(ol[k].s) + ' in');
  }
  const O = LV.sides[0].O, pst = O.Fst / O.A / 1e5, p1 = (O.P1 - G.GEAR_PA) / 1e5;
  yes(pst > 40 && pst < 120 && p1 > 10 && p1 < 40, 'the charge: ' + p1.toFixed(1) + ' bar extended, ' + pst.toFixed(1) + ' bar static on its ' +
      (Math.sqrt(O.A / Math.PI) * 2000).toFixed(0) + ' mm piston (a light oleo\'s 40-120), stage 2 at ' + ((O.P2 - G.GEAR_PA) / 1e5).toFixed(0) + ' bar');
  yes(sim.wheelsOnGround() === 3 && !sim.stats().bad, 'it stands on its three wheels');
}

// a drop from the settled attitude: lifted 3 cm, `V` down, `Vf` along its heading (0.8 Vs: the wing lifts ~2/3 W)
function fwdOf(sim, def) { const R = def.refs, m = ids => [0, 1, 2].map(k => ids.reduce((a, i) => a + sim.p[i * 3 + k], 0) / ids.length);
  const n = m(R.noseFrame), t = m(R.tailMid), d = [n[0] - t[0], n[2] - t[2]], l = Math.hypot(d[0], d[1]); return [d[0] / l, 0, d[1] / l]; }
function drop(def, V, Vf, secs, each) {
  const sim = settled(def, 8), fd = fwdOf(sim, def);
  for (let i = 0; i < sim.n; i++) { sim.p[i * 3 + 1] += 0.03; sim.v[i * 3] = Vf * fd[0]; sim.v[i * 3 + 1] = -V; sim.v[i * 3 + 2] = Vf * fd[2]; }
  sim.ctl.thr = 0; sim.oleoPeak(true);
  let air = 0, airMax = 0, touched = false;
  for (let f = 0; f < secs * 60; f++) {
    sim.step(1 / 60);
    const on = sim.wheelContacts ? sim.wheelContacts() : null, mains = on && on.mains ? on.mains.some(Boolean) : sim.wheelsOnGround() > 0;
    if (mains) { touched = true; air = 0; } else if (touched) { air += 1 / 60; airMax = Math.max(airMax, air); }
    if (each) each(sim, f);
  }
  return { sim, airMax };
}
const sink = LV.sink;
console.log('3. a FAR 23.725-style limit drop (the 23.473(d) limit sink ' + sink.toFixed(2) + ' m/s on this host - the Wilga\'s own 2.73), no wing lift');
{
  const r = drop(DEF, sink, 0, 3), ol = r.sim.oleo();
  const sMax = Math.max(ol[0].sMax, ol[1].sMax), S = ol[0].S, fMax = Math.max(ol[0].fMax, ol[1].fMax);
  yes(sMax < S && ol.every(q => !q.bottomed) && !r.sim.stats().bad, 'absorbed without bottoming: the strut ' + mm(sMax) + ' of its ' + mm(S) +
      ' (' + (100 * sMax / S).toFixed(0) + ' %), its force ' + (fMax / 1000).toFixed(1) + ' kN at most');
  const r2 = drop(DEF, 1.2 * sink, 0, 4), o2 = r2.sim.oleo(), L = leverOf(DEF, LV.sides[0]);
  const armNow = (sim, sd) => Math.hypot(...[0, 1, 2].map(k => sim.p[sd.axle * 3 + k] - 0.5 * (sim.p[sd.pi * 3 + k] + sim.p[sd.po * 3 + k])));
  const arm0 = Math.hypot(...[0, 1, 2].map(k => N[LV.sides[0].axle].p[k] - 0.5 * (N[LV.sides[0].pi].p[k] + N[LV.sides[0].po].p[k])));
  yes(!r2.sim.stats().bad && Math.abs(o2[0].s - LV.sides[0].O.sSt) < 0.015 && r2.sim.wheelsOnGround() === 3 && Math.abs(armNow(r2.sim, LV.sides[0]) - arm0) < 0.003,
      'the reserve drop (1.2 x, 23.727): it bottoms on the steel stop (' + o2[0].bottomed + ' / ' + o2[1].bottomed + ' substeps held) and stands again on its gear, the strut back to ' +
      mm(o2[0].s) + ', the arm whole');
}

console.log('4. no pogo after a firm landing (1.5 m/s at 0.8 Vs)');
{
  // (rolling on, the wing unloads as the speed decays and the strut takes the weight back SMOOTHLY - a trend, not a
  // pogo: what is judged is what is left about a straight line, and how often the strut turns round)
  const Vs = DEF.params.gen.VsFlap || DEF.params.gen.Vs, trace = [], all = [];
  const r = drop(DEF, 1.5, 0.8 * Vs, 4, (sim, f) => { all.push(sim.oleo()[0].sd); if (f >= 150) trace.push(sim.oleo()[0].s); });
  const n = trace.length, xm = (n - 1) / 2, ym = trace.reduce((a, v) => a + v, 0) / n;
  let sxy = 0, sxx = 0; trace.forEach((v, i) => { sxy += (i - xm) * (v - ym); sxx += (i - xm) * (i - xm); });
  const b = sxy / sxx, res = Math.max(...trace.map((v, i) => Math.abs(v - (ym + b * (i - xm)))));
  let turns = 0; for (let i = 61; i < all.length; i++) if (Math.abs(all[i]) > 0.002 && Math.abs(all[i - 1]) > 0.002 && Math.sign(all[i]) !== Math.sign(all[i - 1])) turns++;
  yes(r.airMax <= 0.15, 'the wheels stay on the ground (the longest lift ' + (r.airMax * 1000).toFixed(0) + ' ms, 150 at most)');
  yes(res < 0.001 && turns <= 2 && !r.sim.stats().bad, 'no pogo: after one compression and one rebound the strut turns round ' + turns + ' times past 1 s (2 at most) and in the last 1.5 s it follows the wing\'s unloading to ' +
      mm(res) + ' (under 1)');
}

console.log('5. the wheel\'s path is the trailing arc');
{
  const sd = LV.sides[1], L = leverOf(DEF, sd), arm0 = Math.hypot(...[0, 1, 2].map(k => L.axle[k] - L.piv[k]));
  let armErr = 0, sErr = 0, n = 0, aft = 0, risen = 0, prev = null;
  const legFrame = sim => { const P = i => [sim.p[i * 3], sim.p[i * 3 + 1], sim.p[i * 3 + 2]];
    return G.gearNodeFrame([P(sd.pi), P(sd.po), P(sd.u)], [N[sd.pi].p, N[sd.po].p, N[sd.u].p]); };   // live -> rest (the leg's frame)
  const app = (M, p) => [M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3], M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7], M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11]];
  drop(DEF, sink, 0, 1.2, sim => {
    const M = legFrame(sim), a = app(M, [sim.p[sd.axle * 3], sim.p[sd.axle * 3 + 1], sim.p[sd.axle * 3 + 2]]);
    armErr = Math.max(armErr, Math.abs(Math.hypot(a[0] - L.piv[0], a[1] - L.piv[1], a[2] - L.piv[2]) - arm0));
    const s = sim.oleo()[1].s, ang = G.gearLeverAngOf(L, 's', Math.max(0, s), LV.geom.comp + 0.3);
    if (s > 0.01) { const k = G.gearLeverAt(L, ang); sErr = Math.max(sErr, Math.hypot(a[0] - k.axle[0], a[1] - k.axle[1], a[2] - k.axle[2])); n++;
      if (prev && a[1] > prev[1] + 1e-4) { risen++; if (a[0] > prev[0]) aft++; } }
    prev = a;
  });
  yes(armErr < 0.002, 'the axle stays on its circle about the pivot: the arm ' + f3(arm0) + ' m to ' + mm(armErr));
  yes(risen > 5 && aft === risen, 'as it rises it moves AFT (trailing: ' + aft + ' of ' + risen + ' rising samples)');
  yes(n > 10 && sErr < 0.0015, 'the axle stands where the kinematics put it for the strut\'s stroke (' + n + ' samples, ' + mm(sErr) + ' at worst)');
}

console.log('6. a broken leg drops (damage on, the certificate stamped)');
{
  const def = Object.assign({}, DEF, { params: Object.assign({}, DEF.params, { damage: true }) });
  def.cert = C.genCertify(C.buildGen(JSON.parse(JSON.stringify(SPEC))), {});
  const GR = def.parts.dmg.groups, gl = GR.find(g => g.key === 'gearL:gear');
  yes(!!gl && GR.some(g => g.key === 'gearR:gear') && !def.parts.dmg.issues.length, 'each leg is one breakable part (' + GR.filter(g => /:gear$/.test(g.key)).map(g => g.key + ' ' + g.t0.length).join(', ') + '), no group issue');
  const W0 = C.makeWorld(0, {}), W = Object.assign({}, W0, { terrainH: () => 0, trees: [], treesNear: (x, z, q) => { q.length = 0; return q; } });
  const strip = W0.aerodromes.find(a => a.id === 'HOME') || W0.aerodromes[0];
  const roll = () => { const sim = C.makeSim(def, W); sim.reset(0); C.placeAtAerodrome(sim, Object.assign({}, strip, { elev: 0, spawnElev: 0 }));
    for (let f = 0; f < 240; f++) sim.step(1 / 60);
    for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = 15 * Math.cos(strip.hdg); sim.v[i * 3 + 2] = 15 * Math.sin(strip.hdg); } sim.ctl.thr = 0; return sim; };
  { const sim = roll(); for (let f = 0; f < 300; f++) sim.step(1 / 60); const D = sim.damage(); yes(!D.breaks && !D.crashed, 'rolling at 15 m/s nothing breaks'); }
  const span = DEF.params.gen.span, tips = []; N.forEach((nd, i) => { if ((nd.tag === 'WF' || nd.tag === 'WR') && nd.p[2] < -0.8 * span / 2) tips.push(i); });
  const sim = roll(); for (let f = 0; f < 30; f++) sim.step(1 / 60);
  const tipY = () => tips.reduce((a, i) => a + sim.p[i * 3 + 1], 0) / tips.length, y0 = tipY();
  sim.damageBreak(gl.t0[0], 'tension'); let lo = 9;
  for (let f = 0; f < 360; f++) { sim.step(1 / 60); lo = Math.min(lo, tipY()); }
  const D = sim.damage(), sd = LV.sides.find(q => q.side === 'L'), body = N.findIndex(n => n.tag === 'S0BL');
  const gone = Math.hypot(...[0, 1, 2].map(k => sim.p[sd.pi * 3 + k] - sim.p[body * 3 + k])) - Math.hypot(...[0, 1, 2].map(k => N[sd.pi].p[k] - N[body].p[k]));
  yes((D.groups || []).some(g => g.key === 'gearL:gear') && D.crashed && D.structural.why === 'the landing gear broke',
      'one joint member let go (' + N[DEF.beams[gl.t0[0]].a].tag + '-' + N[DEF.beams[gl.t0[0]].b].tag + '): the leg\'s part comes off, "' + D.structural.why + '"');
  yes(lo < 0.15 && gone > 0.5, 'and DROPS: the left tip ' + f3(y0) + ' -> ' + f3(lo) + ' m (on the ground), the leg ' + f3(gone) + ' m away from its fitting');
}

console.log('7. the drawn leg = the physics leg (the game\'s load chain: the garage draws, the join measures)');
{
  const LB = require(path.join(T, '_load_build.js'));
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/cub_2026-09-20_corrected.json'), 'utf8'));
  const s0 = JSON.parse(JSON.stringify(raw.spec || raw)); Object.assign(s0.cage, { s1Leg: 4, s1Drop: 0.85 });
  const r = LB.gameSpecFull({ spec: s0 }), gs = r.spec.gear;
  yes(!r.errors.length && gs.suspension === 'lever' && gs.lever && Array.isArray(gs.lever.piv), 'the Cub with the mains\' leg set to the trailing link: the join writes suspension \'lever\' and the drawn leg (' + r.errors.length + ' layer errors)');
  const def = C.buildGen(JSON.parse(JSON.stringify(r.spec))), Lv = def.parts.lever;
  let worst = 0;
  for (const sd of Lv.sides) {
    const A = def.nodes[sd.axle].p, q = sd.side === 'L' ? -1 : 1, rel = p => [p[0] - A[0], p[1] - A[1], q * (p[2] - A[2])];
    const pm = rel(mid(i => def.nodes[i].p, sd.pi, sd.po));
    for (const [a, b] of [[pm, gs.lever.piv], [rel(def.nodes[sd.h].p), gs.lever.horn], [rel(def.nodes[sd.u].p), gs.lever.top]]) worst = Math.max(worst, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
  }
  yes(worst < 1e-6, 'the frame stands its pivot, horn and strut eye on the drawn points (' + worst.toExponential(1) + ' m)');
  // at every compression of a drop: the parts as the garage poses them (GEAR_LEVER at the strut's stroke, in the leg's
  // frame) against the physics nodes the flight poses them by
  const sd = Lv.sides[0], L = leverOf(def, sd), app = (M, p) => [M[0] * p[0] + M[1] * p[1] + M[2] * p[2] + M[3], M[4] * p[0] + M[5] * p[1] + M[6] * p[2] + M[7], M[8] * p[0] + M[9] * p[1] + M[10] * p[2] + M[11]];
  let err = 0, n = 0, sTop = 0;
  drop(def, def.parts.lever.sink, 0, 1.2, sim => {
    const P = i => [sim.p[i * 3], sim.p[i * 3 + 1], sim.p[i * 3 + 2]], M = G.gearNodeFrame([P(sd.pi), P(sd.po), P(sd.u)], [def.nodes[sd.pi].p, def.nodes[sd.po].p, def.nodes[sd.u].p]);
    const s = sim.oleo()[0].s; if (s < 0.005) return;
    const k = G.gearLeverAt(L, G.gearLeverAngOf(L, 's', s, Lv.geom.comp + 0.3));
    err = Math.max(err, Math.hypot(...[0, 1, 2].map(c => app(M, P(sd.axle))[c] - k.axle[c])), Math.hypot(...[0, 1, 2].map(c => app(M, P(sd.h))[c] - k.horn[c]))); n++;
    sTop = Math.max(sTop, s);
  });
  // the garage says when the drawn leg cannot work: a tyre that enters the body at full stroke turns the drop red
  const SH = require(path.join(T, '_scene_headless.js'));
  const red = o => { const S = SH.sceneBuild(s0, { over: Object.assign({ s1Leg: 4 }, o), garage: s0 }); return S.W.CAGE_ROW_BAD() || {}; };
  const rOk = red({ s1Drop: 0.85 }), rBad = red({ s1Drop: 0.46, s1X: 0.35 });
  yes(!rOk.s1Drop && !!rBad.s1Drop && !!rBad.s1_lvComp, 'the garage turns the drop red when the tyre meets the body at full stroke (a 0.35 m half track: "' +
      (rBad.s1Drop || '-') + '") and not on the Cub\'s own track');
  yes(n > 10 && err < 0.003, 'through a limit drop (' + n + ' frames, the strut to ' + mm(sTop) + ') the drawn arm and horn sit on the physics nodes to ' + mm(err));
}

console.log('7b. the fairing (the user: "an elegant fairing ... that hides a bit of this huge mechanics"): the leg\'s boot and the spat on the arm');
{
  // each build on the leg with the leg-fairing row and the spat: the parts posed through the stroke as the garage poses them
  // (GEAR_LEVER + gearNodeFrame, the preview row's rule); a point is inside a closed shell by a ray's parity
  const SH = require(path.join(T, '_scene_headless.js'));
  // two builds: the Cub (8 in tyres) and the Wilga-class host of the pictures (500 mm tyres on the metal Cessna, the
  // reference's geometry) - the host is where a symmetric boot met the spat in the last fifth of the stroke
  for (const [file, over, who] of [['builds/cub_2026-09-20_corrected.json', { s1Leg: 4, s1Drop: 0.85 }, 'the Cub'],
    ['builds/cessna172_2026-09-20_corrected.json', { s1Leg: 4, s1Drop: 0.80, s1R: 0.25, s1X: 1.415, s1Z: 1.45, s2Leg: 3, s2Z: 0.10, s2X: 0, s2R: 0.064, s2Steer: 1 }, 'the Wilga-class host']]) {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')), s0 = raw.spec || raw;
  const S = SH.sceneBuild(s0, { over: Object.assign({}, over, { s1Fair: 1, s1LegFair: 1 }), garage: s0 }); S.scene.updateMatrixWorld(true);
  const shell = (name, keep) => { let Gp = null; S.scene.traverse(o => { if (o.name === name) Gp = o; }); const out = [];
    if (Gp) Gp.traverse(o => { if (!o.isMesh || !keep(o)) return; const a = o.geometry.attributes.position.array, e = o.matrixWorld.elements, v = [];
      for (let i = 0; i < a.length; i += 3) v.push([0, 1, 2].map(r => e[r] * a[i] + e[4 + r] * a[i + 1] + e[8 + r] * a[i + 2] + e[12 + r]));
      const ix = o.geometry.index ? Array.from(o.geometry.index.array) : v.map((_, i) => i), tri = [];
      for (let i = 0; i < ix.length; i += 3) tri.push([ix[i], ix[i + 1], ix[i + 2]]); out.push({ v, tri }); }); return out; };
  const inside = (Ms, q) => { const d = [0.3171, 0.8137, 0.4870]; let n = 0;
    for (const M of Ms) for (const t of M.tri) { const a = M.v[t[0]], e1 = [0, 1, 2].map(k => M.v[t[1]][k] - a[k]), e2 = [0, 1, 2].map(k => M.v[t[2]][k] - a[k]);
      const p = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
      if (Math.abs(det) < 1e-12) continue; const sv = [0, 1, 2].map(k => q[k] - a[k]), u = (sv[0] * p[0] + sv[1] * p[1] + sv[2] * p[2]) / det; if (u < 0 || u > 1) continue;
      const qq = [sv[1] * e1[2] - sv[2] * e1[1], sv[2] * e1[0] - sv[0] * e1[2], sv[0] * e1[1] - sv[1] * e1[0]], w = (d[0] * qq[0] + d[1] * qq[1] + d[2] * qq[2]) / det;
      if (w < 0 || u + w > 1) continue; if ((e2[0] * qq[0] + e2[1] * qq[1] + e2[2] * qq[2]) / det > 0) n++; }
    return n & 1; };
  const app = (M, x) => [M[0] * x[0] + M[1] * x[1] + M[2] * x[2] + M[3], M[4] * x[0] + M[5] * x[1] + M[6] * x[2] + M[7], M[8] * x[0] + M[9] * x[1] + M[10] * x[2] + M[11]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], isF = o => !!o.userData.fair;
  const units = (S.W.CAGE_GEAR && S.W.CAGE_GEAR.lever) || [];
  let clash = 0, poses = 0, gap = 9, hidRest = 1, hidFull = 1, nB = 0, nS = 0;
  for (const u of units) {
    const boot = shell('edLeg' + u.kind, isF), spat = shell('edLvArm' + u.kind, isF), cyl = shell('edLvCyl' + u.kind, () => true);
    nB += boot.length; nS += spat.length; if (!boot.length || !spat.length) continue;
    const L = G.gearLeverInit({ piv: u.piv, ax: u.ax, w: u.w, axle: u.axle, horn: u.horn, top: u.top }), sw = (u.rows.ang - u.rows.comp) * D2R;
    const aSt = G.gearLeverAngOf(L, 'rise', u.rows.dSt, sw), bv = boot.flatMap(M => M.v);
    for (let i = 0; i <= 10; i++) {
      const q = G.gearLeverAt(L, sw * i / 10), Ta = G.gearNodeFrame([u.piv, u.axle, add(u.piv, u.ax)], [u.piv, q.axle, add(u.piv, u.ax)]); poses++;
      for (const M of spat) for (const x of M.v) { const y = app(Ta, x); if (inside(boot, y)) clash++;
        for (const b of bv) gap = Math.min(gap, Math.hypot(b[0] - y[0], b[1] - y[1], b[2] - y[2])); }
    }
    for (const [ang, set] of [[aSt, v => { hidRest = Math.min(hidRest, v); }], [sw, v => { hidFull = Math.min(hidFull, v); }]]) {
      const q = G.gearLeverAt(L, ang), Tc = G.gearNodeFrame([u.top, u.horn, add(u.top, u.ax)], [u.top, q.horn, add(u.top, u.ax)]);
      let n = 0, t = 0; for (const M of cyl) for (const x of M.v) { t++; if (inside(boot, app(Tc, x))) n++; } set(t ? n / t : 0);
    }
  }
  yes(units.length === 2 && nB >= 2 && nS >= 2, who + ' with the leg-fairing row and the spat: both legs wear a boot and a spat on the arm');
  yes(poses === 22 && clash === 0 && gap > 0.008, 'through the whole stroke (11 poses a side) the spat never enters the boot: ' + clash + ' points inside, the closest ' + mm(gap));
  yes(hidRest === 1 && hidFull === 1, 'the boot hides the strut\'s cylinder at rest and at full stroke (' + (100 * hidRest).toFixed(0) + ' % / ' + (100 * hidFull).toFixed(0) + ' %)');
  }
}

console.log('8. nothing else moved');
{
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/cessna172_2026-09-20_corrected.json'), 'utf8'));
  const d = C.buildGen(JSON.parse(JSON.stringify(raw.spec || raw)));
  yes(!('lever' in d.parts) && !('lever' in d.spec.gear) && d.spec.gear.suspension !== 'lever' && !d.nodes.some(n => /^AXLE[PHUK]/.test(n.tag || '')),
      'a build without the leg carries no lever key, node or member (its bit-identity: GATE BUILD / JOINPARITY and the study\'s §8)');
  const sim = C.makeSim(d, null); yes(sim.oleo() === null, 'and its solver runs no oleo pass');
}

console.log(pass + ' ok, ' + fail + ' failed');
console.log('GATE WILGAGEAR: ' + (fail ? 'FAIL' : 'PASS'));
process.exit(fail ? 1 : 0);
