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
//   7b. THE FAIRING: the leg's boot only (no wheel fairing on the trailing link) in each of its three shapes and with the
//      fitting high and low, cut so that nothing that moves comes within 3 mm of it through the stroke, detailed (seams,
//      screws), clear of the ground at full stroke on a flat tyre pitched nose-down, still hiding the strut above its
//      floor; its cache replays the same boot
//   7c. THE STRUT'S MOUNT (lvTop, a share of the leg; default 0.72 - the photographs' long strut): through the load chain,
//      over the slider's range, each stands at the charge's deflection and absorbs the limit drop without bottoming; the
//      long strut lands softer than the derived short one and does not bounce
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

console.log('7b. the fairing (the user: "an elegant fairing ... that hides a bit of this huge mechanics"; "only a fairing for the leg, not the wheel"; "the little proper cuts so the wheel articulation can move freely")');
{
  // each build on the leg with the leg-fairing row ON and the spat row asking for a spat: the parts posed through the
  // stroke as the garage poses them (GEAR_LEVER + gearNodeFrame, the preview row's rule), measured against the boot's
  // own triangles (the boot is open where it is cut: a distance, not a parity)
  const SH = require(path.join(T, '_scene_headless.js'));
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sb = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const app = (M, x) => [M[0] * x[0] + M[1] * x[1] + M[2] * x[2] + M[3], M[4] * x[0] + M[5] * x[1] + M[6] * x[2] + M[7], M[8] * x[0] + M[9] * x[1] + M[10] * x[2] + M[11]];
  // the closest point of a triangle (Ericson, Real-Time Collision Detection 5.1.5)
  const triD = (p, a, b, c) => {
    const ab = sb(b, a), ac = sb(c, a), ap = sb(p, a), d1 = dt(ab, ap), d2 = dt(ac, ap); if (d1 <= 0 && d2 <= 0) return Math.hypot(...ap);
    const bp = sb(p, b), d3 = dt(ab, bp), d4 = dt(ac, bp); if (d3 >= 0 && d4 <= d3) return Math.hypot(...bp);
    const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return Math.hypot(...sb(p, add(a, ab.map(x => x * v)))); }
    const cp = sb(p, c), d5 = dt(ab, cp), d6 = dt(ac, cp); if (d6 >= 0 && d5 <= d6) return Math.hypot(...cp);
    const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return Math.hypot(...sb(p, add(a, ac.map(x => x * w)))); }
    const va = d3 * d6 - d5 * d4; if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return Math.hypot(...sb(p, add(b, sb(c, b).map(x => x * w)))); }
    const den = 1 / (va + vb + vc), v = vb * den, w = vc * den; return Math.hypot(...sb(p, add(a, add(ab.map(x => x * v), ac.map(x => x * w))))); };
  const CELL = 0.02, CAP = 0.02;
  // the cases: each fairing shape (lvBoot: 0 trailing - the Wilga's, the default -, 1 tapered, 2 flared), and the host's
  // fitting high and low on the body (lvRootAng 50 / 110: "if you would place it lower or higher on the body, how does it fare?")
  const CUBF = 'builds/cub_2026-09-20_corrected.json', HOSTF = 'builds/cessna172_2026-09-20_corrected.json';
  const HOST = { s1Leg: 4, s1Drop: 0.80, s1R: 0.25, s1X: 1.415, s1Z: 1.45, s2Leg: 3, s2Z: 0.10, s2X: 0, s2R: 0.064, s2Steer: 1 };
  const cases = [[CUBF, { s1Leg: 4, s1Drop: 0.85, s1_lvBoot: 1 }, 'the Cub, tapered'], [CUBF, { s1Leg: 4, s1Drop: 0.85 }, 'the Cub, trailing (the default)'],
    [HOSTF, Object.assign({}, HOST, { s1_lvBoot: 1 }), 'the Wilga-class host, tapered'], [HOSTF, Object.assign({}, HOST, { s1_lvBoot: 2 }), 'the host, flared'],
    [HOSTF, HOST, 'the host, trailing (the default)'],
    [HOSTF, Object.assign({}, HOST, { s1_lvRootAng: 50 }), 'the host, trailing, fitting low (50 deg)'], [HOSTF, Object.assign({}, HOST, { s1_lvRootAng: 110 }), 'the host, trailing, fitting high (110 deg)'],
    [HOSTF, Object.assign({}, HOST, { s1_lvTop: 0.13 }), 'the host, trailing, the short strut (v1: mount 0.13)'],
    [HOSTF, Object.assign({}, HOST, { s1_lvTop: 0.40 }), 'the host, trailing, the mount half-way (0.40)']];
  let groundMin = Infinity, groundAt = '';
  for (const [file, over, who] of cases) {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')), s0 = raw.spec || raw;
    const S = SH.sceneBuild(s0, { over: Object.assign({}, over, { s1Fair: 1, s1LegFair: 1 }), garage: s0 }); S.scene.updateMatrixWorld(true);
    const meshes = (name, keep) => { let Gp = null; S.scene.traverse(o => { if (o.name === name) Gp = o; }); const out = [];
      if (Gp) Gp.traverse(o => { if (!o.isMesh || !keep(o)) return; const A = o.geometry.attributes.position.array, e = o.matrixWorld.elements, v = [];
        for (let i = 0; i < A.length; i += 3) v.push([0, 1, 2].map(r => e[r] * A[i] + e[4 + r] * A[i + 1] + e[8 + r] * A[i + 2] + e[12 + r]));
        const ix = o.geometry.index ? Array.from(o.geometry.index.array) : v.map((_, i) => i), tri = [];
        for (let i = 0; i < ix.length; i += 3) tri.push([v[ix[i]], v[ix[i + 1]], v[ix[i + 2]]]); out.push({ v, tri }); }); return out; };
    const isF = o => !!o.userData.fair, all = () => true;
    const units = (S.W.CAGE_GEAR && S.W.CAGE_GEAR.lever) || [];
    let spats = 0, boots = 0, worst = Infinity, poses = 0, nMov = 0, at = '', stats = '';
    for (const u of units) {
      spats += meshes('edLvArm' + u.kind, isF).length + meshes('edWheel' + u.kind, isF).length;
      const boot = meshes('edLeg' + u.kind, isF); boots += boot.length; if (!boot.length) continue;
      // the boot's triangles in a grid of 2 cm cells (a part's point looks at its own cell and the 26 round it)
      const grid = new Map(), key = (i, j, k) => i + ',' + j + ',' + k, cOf = x => Math.floor(x / CELL);
      for (const M of boot) for (const t of M.tri) {
        const lo = [0, 1, 2].map(r => cOf(Math.min(t[0][r], t[1][r], t[2][r]))), hi = [0, 1, 2].map(r => cOf(Math.max(t[0][r], t[1][r], t[2][r])));
        for (let i = lo[0]; i <= hi[0]; i++) for (let j = lo[1]; j <= hi[1]; j++) for (let k = lo[2]; k <= hi[2]; k++) { const q = key(i, j, k); if (!grid.has(q)) grid.set(q, []); grid.get(q).push(t); }
      }
      const near = p => { let m = CAP; const c = p.map(cOf);
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const L = grid.get(key(c[0] + i, c[1] + j, c[2] + k)); if (L) for (const t of L) m = Math.min(m, triD(p, t[0], t[1], t[2])); }
        return m; };
      const arm = meshes('edLvArm' + u.kind, all), cyl = meshes('edLvCyl' + u.kind, all), rod = meshes('edLvRod' + u.kind, all), whl = meshes('edWheel' + u.kind, all);
      const L = G.gearLeverInit({ piv: u.piv, ax: u.ax, w: u.w, axle: u.axle, horn: u.horn, top: u.top }), sw = (u.rows.ang - u.rows.comp) * D2R;
      // THE GROUND (the user: "isn't there a chance that it strikes the ground ... this sort of nose at the front?"): at full
      // stroke on a tyre flat to 0.6 of its radius, level and pitched 10 deg nose-down about the contact (hard braking)
      { const qF = G.gearLeverAt(L, sw), R0 = (over.s1R || (S.P && S.P.s1R) || 0.2), cp = [qF.axle[0], qF.axle[1] - 0.6 * R0, qF.axle[2]], a = 10 * D2R;
        for (const M of boot) for (const p of M.v) { const dy = p[1] - cp[1], dz = p[2] - cp[2], g = Math.min(dy, dy * Math.cos(a) - dz * Math.sin(a));
          if (g < groundMin) { groundMin = g; groundAt = who; } } }
      if (u.boot) stats = 'style ' + u.boot.style + ', ' + u.boot.cuts + ' cut edges, ' + u.boot.screws + ' screws' + (u.boot.chord ? ', chord ' + u.boot.chord.map(f3).join(' -> ') + ' m' : ', tube r ' + f3(u.boot.tubeR) + ' m');
      const bootOk = u.boot && u.boot.screws >= 20 && u.boot.cuts > 0; if (!bootOk) stats += ' (NO DETAIL / NO CUT)';
      for (let i = 0; i <= 12; i++) {
        const q = G.gearLeverAt(L, sw * i / 12); poses++;
        const Ta = G.gearNodeFrame([u.piv, u.axle, add(u.piv, u.ax)], [u.piv, q.axle, add(u.piv, u.ax)]),
              Tc = G.gearNodeFrame([u.top, u.horn, add(u.top, u.ax)], [u.top, q.horn, add(u.top, u.ax)]),
              Tr = G.gearNodeFrame([u.horn, u.top, add(u.horn, u.ax)], [q.horn, u.top, add(q.horn, u.ax)]);
        for (const [parts, T, nm] of [[arm, Ta, 'the arm'], [whl, Ta, 'the wheel'], [cyl, Tc, 'the cylinder'], [rod, Tr, 'the rod']])
          for (const M of parts) for (const x of M.v) { const dd = near(app(T, x)); nMov++; if (dd < worst) { worst = dd; at = nm + ' at ' + (i / 12).toFixed(2) + ' of the stroke'; } }
      }
    }
    yes(units.length === 2 && boots === 2 && spats === 0 && !/NO /.test(stats), who + ': the spat row asks for a spat and the trailing link draws none - both legs wear the boot, cut and detailed (' + stats + ')');
    yes(poses === 26 && worst >= 0.003, who + ': through the whole stroke (13 poses a side, ' + nMov + ' points of the arm, wheel, cylinder and rod) nothing comes within 3 mm of the boot - the closest ' +
        (worst >= CAP ? '> ' + mm(CAP) : mm(worst) + ' (' + at + ')'));
    // ...and it still hides the mechanism: the strut's cylinder BODY at rest (above its end collar, 2 cm), seen from either side and from ahead and
    // behind, is behind the boot (a ray from each of its points, four ways, meets a boot triangle). Its gland, at the
    // body's foot, sits just inboard of the arm's slot - the arm swings through the outboard wall there - and shows through
    // it from outboard: printed, by design (the slot is what lets the arm move)
    if (who === 'the Wilga-class host, tapered') {
      let hid = 0, tot = 0, gTot = 0, gOut = 0;
      for (const u of units) {
        const boot = meshes('edLeg' + u.kind, isF).flatMap(M => M.tri), cyl = meshes('edLvCyl' + u.kind, all);
        // (the boot's floor: its lowest point down the leg as seen from ahead - the strut leaves through it, its foot and
        // gaiter bare below, as on the Wilga; what is hidden is what lies above the floor)
        const dl = sb(u.piv, u.root).map(x => x / Math.hypot(...sb(u.piv, u.root))), sF = [dl[0], dl[1], 0].map(x => x / Math.hypot(dl[0], dl[1]));
        const floorH = Math.max(...boot.flatMap(t => t.map(p => dt(sb(p, u.root), sF))));
        const L = G.gearLeverInit({ piv: u.piv, ax: u.ax, w: u.w, axle: u.axle, horn: u.horn, top: u.top });
        const q = G.gearLeverAt(L, G.gearLeverAngOf(L, 'rise', u.rows.dSt, (u.rows.ang - u.rows.comp) * D2R));
        const Tc = G.gearNodeFrame([u.top, u.horn, add(u.top, u.ax)], [u.top, q.horn, add(u.top, u.ax)]);
        const hit = (o, dir) => boot.some(([a, b, c]) => { const e1 = sb(b, a), e2 = sb(c, a), pv = cr(dir, e2), det = dt(e1, pv); if (Math.abs(det) < 1e-12) return false;
          const tv = sb(o, a), uu = dt(tv, pv) / det; if (uu < 0 || uu > 1) return false; const qv = cr(tv, e1), vv = dt(dir, qv) / det; if (vv < 0 || uu + vv > 1) return false; return dt(e2, qv) / det > 0; });
        const Lx0 = Math.hypot(...sb(u.horn, u.top)), dir0 = sb(q.horn, u.top).map(x => x / Math.hypot(...sb(q.horn, u.top)));
        for (const M of cyl) for (const x of M.v) { const p = app(Tc, x), along = dt(sb(p, u.top), dir0);
          const all4 = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].every(dir => hit(p, dir));
          if (along <= 0.5 * Lx0 - 0.020 && dt(sb(p, u.root), sF) < floorH - 0.03) { tot++; if (all4) hid++; } else { gTot++; if (!all4) gOut++; } }
      }
      yes(tot > 0 && hid / tot >= 0.95, who + ': and the boot still hides the strut\'s cylinder at rest, above its floor, from either side, ahead and behind (' + (100 * hid / Math.max(1, tot)).toFixed(0) +
          ' % of ' + tot + ' points; below the floor - its foot and gaiter, bare as on the Wilga - ' + gOut + ' of ' + gTot + ' show)');
    }
  }
  yes(groundMin >= 0.05, 'the ground: at full stroke on a tyre flat to 0.6 R, level or 10 deg nose-down, every boot stays ' + mm(groundMin) + ' or more above it (the least: ' + groundAt + ')');
  // THE CACHE (the boot is recorded on its inputs and replayed): a second build of the same leg is the same boot, to the vertex
  { const raw = JSON.parse(fs.readFileSync(path.join(ROOT, HOSTF), 'utf8')), s0 = raw.spec || raw, bootV = () => {
      const S = SH.sceneBuild(s0, { over: Object.assign({}, HOST, { s1LegFair: 1 }), garage: s0 }); let A = null; S.scene.traverse(o => { if (o.isMesh && o.userData.fair && o.parent.name === 'edLegL') A = Array.from(o.geometry.attributes.position.array); }); return A; };
    const a = bootV(), b = bootV();
    yes(a && b && a.length === b.length && a.every((x, i) => x === b[i]), 'the boot is cached on its inputs and replayed: a second build draws the same ' + (a ? a.length / 3 : 0) + ' vertices, to the bit'); }
  // the spec agrees with the drawing: a trailing link carries no wheel fairing (the drag, the mass, the price)
  const sp = JSON.parse(JSON.stringify(SPEC)); sp.gear.fairing = 'spat'; sp.gear.legFair = 'fair';
  const cs = C.clampSpec(sp);
  yes(cs.gear.suspension === 'lever' && cs.gear.fairing === 'none' && cs.gear.legFair === 'fair', 'clampSpec: a trailing link asking for a spat flies with none, its leg fairing kept (' + cs.gear.fairing + ' / ' + cs.gear.legFair + ')');
}

console.log('7c. the strut\'s mount up the leg (lvTop, a share of the leg - the user: "how far on the leg does the shock mount ... definitely V2"): the default 0.72, the photographs\' long strut, and the slider\'s range');
{
  // through the game's own load chain (the garage draws, the join measures, the frame and the strut's design follow), on
  // the host at mounts 0.13 (v1, the derived short strut) .. 0.85: each stands at the charge's deflection and absorbs the
  // limit drop without bottoming; the long strut (the default) lands softer than the short one and does not bounce
  const LB = require(path.join(T, '_load_build.js'));
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/cessna172_2026-09-20_corrected.json'), 'utf8'));
  const peakG = (def, V) => { const sim = settled(def, 8), M = def.nodes.reduce((a, n) => a + n.m, 0);
    for (let i = 0; i < sim.n; i++) { sim.p[i * 3 + 1] += 0.03; sim.v[i * 3] = 0; sim.v[i * 3 + 1] = -V; sim.v[i * 3 + 2] = 0; }
    sim.ctl.thr = 0; sim.oleoPeak(true);
    const vy = () => { let a = 0; for (let i = 0; i < sim.n; i++) a += def.nodes[i].m * sim.v[i * 3 + 1]; return a / M; };
    let prev = vy(), n = 0; for (let f = 0; f < 360; f++) { sim.step(1 / 120); const v = vy(); n = Math.max(n, 1 + (v - prev) * 120 / 9.81); prev = v; }
    return { n, ol: sim.oleo(), bad: sim.stats().bad }; };
  const res = {};
  for (const fr of [null, 0.13, 0.40, 0.85]) {
    const sp0 = JSON.parse(JSON.stringify(raw.spec || raw));
    Object.assign(sp0.cage, { s1Leg: 4, s1Drop: 0.80, s1R: 0.25, s1X: 1.415, s1Z: 1.45, s2Leg: 3, s2Z: 0.10, s2X: 0, s2R: 0.064, s2Steer: 1 }, fr == null ? {} : { s1_lvTop: fr });
    const r = LB.gameSpecFull({ spec: sp0 }), def = C.buildGen(JSON.parse(JSON.stringify(r.spec))), Lv = def.parts.lever;
    const who = fr == null ? 'the default (0.72)' : 'mount ' + fr.toFixed(2);
    if (!Lv) { yes(false, who + ': no trailing link in the joined build (' + r.errors.length + ' errors)'); continue; }
    const sd = Lv.sides[0], O = sd.O, lenS = Math.hypot(...[0, 1, 2].map(k => def.nodes[sd.u].p[k] - def.nodes[sd.h].p[k]));
    const sim = settled(def, 8), ol = sim.oleo(), L = leverOf(def, sd, [-Math.sin(Lv.deck), Math.cos(Lv.deck), 0]);
    const rise = G.gearLeverAt(L, G.gearLeverAngOf(L, 's', ol[0].s, Lv.geom.comp)).rise;
    const d = peakG(def, Lv.sink), used = Math.max(d.ol[0].sMax, d.ol[1].sMax) / O.S;
    res[fr == null ? 'def' : fr] = { n: d.n, lenS, def };
    yes(!r.errors.length && Math.abs(rise - LR.dSt) <= 0.010 && sim.wheelsOnGround() === 3 && d.ol.every(q => !q.bottomed) && !d.bad,
        who + ': ' + f3(lenS) + ' m eye to eye, ' + mm(O.S) + ' of stroke, ' + ((O.P1 - G.GEAR_PA) / 1e5).toFixed(1) + ' / ' + (O.Fst / O.A / 1e5).toFixed(1) + ' bar; stands ' + mm(rise) +
        ' deflected (70 +-10); the limit drop (' + Lv.sink.toFixed(2) + ' m/s) on ' + (100 * used).toFixed(0) + ' % of its stroke, no bottoming, ' + d.n.toFixed(2) + ' g at the CG');
  }
  if (res.def && res[0.13]) yes(res.def.n < res[0.13].n - 0.5, 'the long strut lands softer: ' + res.def.n.toFixed(2) + ' g against the short strut\'s ' + res[0.13].n.toFixed(2) + ' (its leverage near constant over the stroke; the wheel\'s 270 mm stays the energy budget)');
  if (res.def) { const Vs = (res.def.def.params && res.def.def.params.ap && res.def.def.params.ap.Vs) || 25, d3 = drop(res.def.def, 1.5, 0.8 * Vs, 4);
    yes(d3.airMax <= 0.15, 'the default: a firm landing (1.5 m/s at 0.8 Vs) does not bounce - ' + d3.airMax.toFixed(2) + ' s off the ground at most'); }
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
