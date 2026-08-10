// GATE FLEX — how bendy is this aeroplane, really?
//
// The user report that started this: "the planes twist like they're gum
// sometimes". This gate exists to turn that into numbers, because the session
// ritual says measure before hypothesizing and there was no deflection
// instrument in the battery — only the outer-panel flap ANGLE that the circuit
// harness tracks as a safety bound, which says nothing about whether the angle
// is realistic.
//
// WHAT IT MEASURES, and why each one:
//   A  tip deflection vs LOAD FACTOR, as % of semispan. The number real
//      aircraft structures are quoted in. A quasi-static elevator ramp from
//      trim gives a scatter of (n, deflection) and the SLOPE is the honest
//      single number: % of semispan per g.
//   B  wing TORSION — the change in section incidence from root to tip. This
//      is the "twist like gum" complaint directly, and it is also the quantity
//      structural rule 2 is about (elastic axis ahead of AC -> washout or
//      divergence). Measured under full aileron, which is when a wing twists.
//   C  SOFTNESS. The solver's beam law is F = k*(L-L0) with k an absolute N/m
//      per member, carrying no length and no cross-section. Physics says
//      k = EA/L. The area is not a new number — `lin` is kg/m, so A = lin/rho
//      is already implied by the mass model. This reports k_used/(EA/L0).
//   D  LOAD vs ALLOWABLE. Peak |k*(L-L0)| against sigY*A. This is the one that
//      decides whether a failure model is worth building: failure is a FORCE
//      threshold, so if the peak in-flight loads sit sensibly under yield, a
//      force-calibrated rupture model would trigger correctly and rarely even
//      though the springs are soft.
//
// VERDICT CONTRACT, deliberately weak: this gate asserts only that every
// measurement is FINITE and that the instrument is DETERMINISTIC. It does not
// assert bounds. Asserting realism targets nobody has agreed to would be
// trading a fact for a preference, and the whole point of the chantier is to
// produce the numbers that decide what the targets should be.
const { buildCub, buildDrone, buildDC3, buildJodel, buildC172, buildChinook,
        buildPA18, buildGen, makeSim, makeAutopilot, makeWorld,
        GEN_MATERIALS, GEN_DEFAULT } = require('./flight_core.js');

const world = makeWorld();
const say = s => console.log(s);
const results = {};
const D2R = 57.2957795;

// Reference figures for the comparison column. Handbook / static-test class
// values for real aeroplanes, quoted as such — nothing here is measured by this
// repo, and they are printed next to our numbers rather than asserted against.
const REALITY = [
  'REALITY (handbook / static-test class figures, for comparison only):',
  '  strut-braced light aircraft, wing tip deflection    ~0.3-1 % of semispan at 1 g',
  '                                                      ~2-4 %  at 3.8 g limit load',
  '  glass sailplane (the bendiest certified thing)      ~4-6 %  at 1 g',
  '  GA wing torsional twist, root to tip, full aileron  ~1-2 deg',
  '  elastic strain limits: 4130 0.22 %  2024-T3 0.47 %  spruce 0.36 %  carbon 1.1 %',
];

// ---------------------------------------------------------------------------
// Spar stations. Every fiche and the generator tag their front and rear spar
// nodes WF/WR, so one finder works for the whole fleet. One side only (z > 0);
// the airframes are mirrored and GATE GEN already proves the symmetry.
// ---------------------------------------------------------------------------
function stations(def) {
  const wf = [], wr = [];
  def.nodes.forEach((n, i) => {
    if (n.p[2] <= 0) return;
    if (n.tag === 'WF') wf.push(i);
    if (n.tag === 'WR') wr.push(i);
  });
  wf.sort((a, b) => def.nodes[a].p[2] - def.nodes[b].p[2]);
  // pair each front station with its nearest rear station in z
  const st = wf.map(f => {
    const z = def.nodes[f].p[2];
    let best = -1, bd = Infinity;
    for (const r of wr) {
      const d = Math.abs(def.nodes[r].p[2] - z);
      if (d < bd) { bd = d; best = r; }
    }
    return { f, r: best, z };
  }).filter(s => s.r >= 0);
  return st;
}

// section incidence in body axes, degrees, nose-up positive. The chord vector
// runs front spar -> rear spar, i.e. AFT (x is aft), so a section at positive
// incidence has its rear spar LOWER and c.yB is negative.
function incidence(p, s, xB, yB) {
  const dx = p[s.r*3] - p[s.f*3], dy = p[s.r*3+1] - p[s.f*3+1], dz = p[s.r*3+2] - p[s.f*3+2];
  return Math.atan2(-(dx*yB[0] + dy*yB[1] + dz*yB[2]),
                      dx*xB[0] + dy*xB[1] + dz*xB[2]) * D2R;
}
// height of the tip station above the root station, along body up
function tipRise(p, root, tip, yB) {
  const dx = p[tip.f*3] - p[root.f*3], dy = p[tip.f*3+1] - p[root.f*3+1],
        dz = p[tip.f*3+2] - p[root.f*3+2];
  return dx*yB[0] + dy*yB[1] + dz*yB[2];
}

// least squares fit y = a + b*x
function fit(xs, ys) {
  const n = xs.length;
  if (n < 2) return { a: NaN, b: NaN };
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i]*xs[i]; sxy += xs[i]*ys[i]; }
  const den = n*sxx - sx*sx;
  if (Math.abs(den) < 1e-12) return { a: NaN, b: NaN };
  const b = (n*sxy - sx*sy) / den;
  return { a: (sy - b*sx) / n, b };
}

// ---------------------------------------------------------------------------
// C + D — the static audit. Pure arithmetic over the beam list; no simulation.
// Only possible where the beam carries a class AND the material declares its
// physical constants, i.e. generated airframes. The hand fiches assign k per
// aircraft with no material behind it, so there is nothing honest to divide by.
// ---------------------------------------------------------------------------
function audit(def, matKey) {
  const M = matKey && GEN_MATERIALS[matKey];
  if (!M || !M.phys) return null;
  const { E, rho, sigY } = M.phys;
  const byCls = {};
  for (const b of def.beams) {
    if (!b.cls) continue;
    const A = M.lin[b.cls] / rho;               // the mass model already implies it
    const kPhys = E * A / b.L;
    const g = byCls[b.cls] || (byCls[b.cls] = { A, sigY, n: 0, sSum: 0, sMin: Infinity, sMax: 0, Fy: sigY * A });
    const soft = b.k / kPhys;
    g.n++; g.sSum += soft;
    g.sMin = Math.min(g.sMin, soft); g.sMax = Math.max(g.sMax, soft);
  }
  return byCls;
}

// ---------------------------------------------------------------------------
// B2 — STATIC TORSION. Equal and opposite couples about the spanwise axis at
// the two wing tips: net force AND net moment are both zero, so the aeroplane
// does not accelerate and the wings simply twist against each other. No world,
// no aerodynamics, no autopilot — pure structure, and deterministic in 10 s.
//
// THIS IS THE HONEST TORSION NUMBER, and it exists because the in-flight one
// below is not. Measured under full aileron the chinook read 29.92 deg, which
// looked like a catastrophically soft wing; a time trace showed the twist
// tracking BANK, not aileron — the aeroplane was in a spiral dive at -89 deg
// and the number was mostly the departure. The static couple found the real
// defect underneath (132 deg/kN.m against the cub's 15.3) and, more usefully,
// found it was NON-LINEAR, which is the signature of a near-mechanism and the
// thing no single-load-case measurement can see. Run it at two torques and
// compare: a linear structure doubles its twist when you double the couple.
// ---------------------------------------------------------------------------
function statTorsion(def, torque) {
  const sim = makeSim(def, null);            // no world: free-air, gear on a flat plane
  sim.reset(0);
  const st = stations(def);
  if (st.length < 2) return null;
  const root = st[0], tip = st[st.length - 1];
  // mirror of the tip station on the other wing
  const mirror = (i) => {
    const n = def.nodes[i]; let best = -1, bd = Infinity;
    def.nodes.forEach((o, j) => {
      if (o.tag !== n.tag || o.p[2] >= 0) return;
      const d = Math.abs(o.p[2] + n.p[2]) + Math.abs(o.p[0] - n.p[0]);
      if (d < bd) { bd = d; best = j; }
    });
    return best;
  };
  const fL = mirror(tip.f), rL = mirror(tip.r);
  if (fL < 0 || rL < 0) return null;
  const arm = Math.abs(def.nodes[tip.r].p[0] - def.nodes[tip.f].p[0]);
  if (!(arm > 1e-6)) return null;
  // angle of the chord line in the x-y plane; the frame cannot rotate here
  const ang = (f, r) => Math.atan2(-(sim.p[r*3+1] - sim.p[f*3+1]), sim.p[r*3] - sim.p[f*3]) * D2R;
  const base = ang(tip.f, tip.r) - ang(root.f, root.r);
  const F = torque / arm, dt = 1 / 60;
  for (let s = 0; s < 600; s++) {            // 10 s: settled, checked
    sim.impulse(tip.f, 0,  F * dt, 0); sim.impulse(tip.r, 0, -F * dt, 0);
    sim.impulse(fL,    0, -F * dt, 0); sim.impulse(rL,    0,  F * dt, 0);
    sim.step(dt);
  }
  return Math.abs(ang(tip.f, tip.r) - ang(root.f, root.r) - base);
}

// ---------------------------------------------------------------------------
// The flight run.
// ---------------------------------------------------------------------------
function flex(name, def, matKey) {
  const sim = makeSim(def, world);
  sim.reset(0);
  const st = stations(def);
  if (st.length < 2) { say(`  ${name}: fewer than two spar stations — skipped`); return null; }
  const root = st[0], tip = st[st.length - 1];
  const semi = def.nodes[tip.f].p[2];            // rest semispan to the tip station

  // Rest references, taken from the SIM right after reset — undeformed geometry,
  // but read through `sim.axes()` so they live in the same body frame the live
  // samples do. Taking them in the design frame instead leaves a constant bias:
  // noseFrame->tailMid is not exactly the design x, and washout means the two
  // stations do not share it. reset() only translates in y, which cancels in a
  // difference, so this is the undeformed shape and not a settled one.
  const [rxB, ryB] = sim.axes();
  const restRise = tipRise(sim.p, root, tip, ryB);
  const restTwist = incidence(sim.p, tip, rxB, ryB) - incidence(sim.p, root, rxB, ryB);

  const ap = makeAutopilot(sim, def);
  let t = 0;
  while (ap.phase !== 'CRUISE' && t < 120) { ap.update(1/60); sim.step(1/60); t += 1/60; }
  if (ap.phase !== 'CRUISE') { say(`  ${name}: never reached cruise`); return null; }

  // peak member load and strain, per class, over the whole measured run
  const peak = {};
  const track = () => {
    for (const b of sim.beams) {
      const cls = b.cls || (b.gear ? 'gear' : 'chassis');
      const F = Math.abs(b.k * b.strain * b.L0);
      const g = peak[cls] || (peak[cls] = { F: 0, strain: 0 });
      if (F > g.F) g.F = F;
      if (Math.abs(b.strain) > g.strain) g.strain = Math.abs(b.strain);
    }
  };

  let vPrev = sim.cgVel(), bad = false;
  // sample: returns [n, deflection % semispan, twist deg]
  const sample = () => {
    const [xB, yB] = sim.axes();
    const v = sim.cgVel();
    const ax = (v[0]-vPrev[0])*60, ay = (v[1]-vPrev[1])*60, az = (v[2]-vPrev[2])*60;
    vPrev = v;
    // load factor along body up: (a + g_up) . yB / g
    const n = (ax*yB[0] + (ay + 9.81)*yB[1] + az*yB[2]) / 9.81;
    const defl = 100 * (tipRise(sim.p, root, tip, yB) - restRise) / semi;
    const tw = (incidence(sim.p, tip, xB, yB) - incidence(sim.p, root, xB, yB)) - restTwist;
    if (sim.stats().bad) bad = true;
    track();
    return [n, defl, tw];
  };

  // --- SETTLE. CRUISE capture leaves a phugoid, and the first two seconds after
  // it average n = 0.72 rather than 1. Measured against two independent load
  // factors (CG acceleration, and aero Fy/mg) which agree to 0.003 once this
  // window is skipped — so the transient is real and the instrument is not the
  // problem. Discard it before taking the 1 g reference.
  for (let s = 0; s < 150; s++) { ap.update(1/60); sim.step(1/60); }
  vPrev = sim.cgVel();

  // --- HOLD: three seconds of AP-flown cruise. This is the 1 g reference, and
  // it is also what tells us whether the aeroplane is quiet in trim at all.
  let hN = 0, hD = 0, hT = 0, hC = 0, hDmin = 99, hDmax = -99;
  for (let s = 0; s < 180; s++) {
    ap.update(1/60); sim.step(1/60);
    const [n, d, tw] = sample();
    hN += n; hD += d; hT += tw; hC++;
    hDmin = Math.min(hDmin, d); hDmax = Math.max(hDmax, d);
  }
  const deTrim = sim.ctl.de, thrTrim = sim.ctl.thr;

  // --- PULL: quasi-static elevator ramp off the trim setting. Slow on purpose
  // — a step excites the structure's own ringing and measures the ring, not the
  // deflection. Four seconds to full, then held.
  const ns = [], ds = [], tws = [];
  for (let s = 0; s < 300; s++) {
    const ramp = Math.min(1, s / 240);
    sim.ctl.de = deTrim + 0.35 * ramp;
    sim.ctl.da = 0; sim.ctl.dr = 0; sim.ctl.thr = thrTrim;
    sim.step(1/60);
    const [n, d, tw] = sample();
    ns.push(n); ds.push(d); tws.push(tw);
  }
  const f = fit(ns, ds);
  const nMax = Math.max(...ns);
  const at = g => f.a + f.b * g;

  // --- ROLL: release, then full aileron. A wing twists under aileron load;
  // this is the "gum" complaint's own manoeuvre.
  for (let s = 0; s < 60; s++) { sim.ctl.de = deTrim; sim.ctl.da = 0; sim.step(1/60); sample(); }
  let twMax = 0;
  for (let s = 0; s < 120; s++) {
    sim.ctl.de = deTrim; sim.ctl.da = 0.30; sim.ctl.dr = 0; sim.ctl.thr = thrTrim;
    sim.step(1/60);
    const [, , tw] = sample();
    twMax = Math.max(twMax, Math.abs(tw));
  }

  const t200 = statTorsion(def, 200), t400 = statTorsion(def, 400);
  const out = {
    name, semi, bad, t200, t400,
    // linear structure: double the couple, double the twist. A ratio well under
    // 2 means the thing stiffened geometrically on the way, i.e. it started
    // near a mechanism. That is the tell the single-load-case number hides.
    tLin: (t200 && t400) ? t400 / t200 : NaN,
    deflHold: hD / hC, nHold: hN / hC, holdBand: hDmax - hDmin,
    slope: f.b, defl1g: at(1), defl38: at(3.8), nMax,
    twistHold: hT / hC, twistAil: twMax,
    peak, softness: audit(def, matKey), matKey,
  };
  return out;
}

function report(o) {
  if (!o) return;
  say(`  ${o.name.padEnd(22)} semispan ${o.semi.toFixed(2)} m`);
  // 3.8 g is EXTRAPOLATED: a hands-off ramp at de=0.35 runs out of energy around
  // n = 1.5-2.8, so the limit-load column is the fitted line carried past the
  // data, not a measurement. Legitimate for a linear structure and flagged as
  // such — the SLOPE is the measured quantity and the one to argue about.
  say(`    tip deflection   ${o.defl1g.toFixed(2).padStart(7)} % of semispan at 1 g` +
      `   ${o.defl38.toFixed(2).padStart(7)} % at 3.8 g (EXTRAP)` +
      `   slope ${o.slope.toFixed(2).padStart(6)} %/g   (n measured to ${o.nMax.toFixed(1)})`);
  say(`    cruise hold      ${o.deflHold.toFixed(2).padStart(7)} % at n=${o.nHold.toFixed(2)}` +
      `   peak-to-peak ${o.holdBand.toFixed(2)} %   twist ${o.twistHold.toFixed(2)} deg`);
  const lin = Number.isFinite(o.tLin)
    ? `${o.tLin.toFixed(2)}x  ${o.tLin < 1.8 ? '*** NON-LINEAR: near a mechanism' : 'linear'}` : '?';
  say(`    torsion (static) ${(o.t200 ?? NaN).toFixed(2).padStart(7)} deg @200 N.m` +
      `  ${(o.t400 ?? NaN).toFixed(2).padStart(7)} @400   doubling ${lin}`);
  say(`    torsion (flight) ${o.twistAil.toFixed(2).padStart(7)} deg root->tip under full aileron` +
      `   (CONFOUNDED by any departure — read the static row)`);
  const cls = Object.keys(o.peak).sort();
  for (const c of cls) {
    const p = o.peak[c];
    let line = `    ${c.padEnd(8)} peak load ${(p.F/1000).toFixed(2).padStart(8)} kN` +
               `   peak strain ${(p.strain*100).toFixed(2).padStart(6)} %`;
    const s = o.softness && o.softness[c];
    if (s) {
      // softness = k/(EA/L) varies LINEARLY with member length, because k is a
      // constant per class and EA/L is not. The spread is the second half of the
      // finding: the compliance is wrong in shape as well as in level, and the
      // short members are the softest relative to the structure they stand for.
      line += `   A ${(s.A*1e4).toFixed(2)} cm2` +
              `   soft x${(1/(s.sSum/s.n)).toFixed(0).padStart(4)}` +
              ` (x${(1/s.sMax).toFixed(0)}..x${(1/s.sMin).toFixed(0)})` +
              `   load/yield ${(100*p.F/s.Fy).toFixed(1).padStart(6)} %`;
    }
    say(line);
  }
}

// ---------------------------------------------------------------------------
say('FLEX — deflection, torsion, softness and load margin.');
say('');
REALITY.forEach(say);
say('');

const runs = [];
say('FLEET (hand-written fiches — no material behind k, so no softness column):');
for (const [nm, build] of [['CUB', buildCub], ['DRONE', buildDrone], ['DC-3', buildDC3],
                           ['JODEL', buildJodel], ['C172', buildC172],
                           ['CHINOOK', buildChinook], ['PA-18', buildPA18]]) {
  const o = flex(nm, build());
  if (o) runs.push(o);
  report(o);
}
say('');
say('GARAGE (generated — `lin` closes to an area, so softness and yield margin follow):');
for (const m of Object.keys(GEN_MATERIALS)) {
  const spec = JSON.parse(JSON.stringify(GEN_DEFAULT));
  spec.fuselage.material = m;
  const o = flex(`GEN ${GEN_MATERIALS[m].name}`, buildGen(spec), m);
  if (o) runs.push(o);
  report(o);
}

// --- verdict: finite, no divergence, and the instrument repeats itself.
const nums = [];
for (const o of runs) {
  nums.push(o.defl1g, o.defl38, o.slope, o.deflHold, o.twistHold, o.twistAil, o.t200, o.t400);
  for (const c of Object.keys(o.peak)) nums.push(o.peak[c].F, o.peak[c].strain);
}
results['every airframe reached cruise and was measured'] = runs.length === 11;
results['every measurement is finite'] = nums.every(Number.isFinite);
results['no airframe diverged during the sweep'] = runs.every(o => !o.bad);

// determinism: the whole instrument re-run on one airframe must land on the
// same numbers. Double-generate is GATE GEN's pattern; this is its analogue.
{
  const spec = JSON.parse(JSON.stringify(GEN_DEFAULT));
  const a = flex('determinism A', buildGen(spec));
  const b = flex('determinism B', buildGen(spec));
  const same = a && b &&
    a.defl1g === b.defl1g && a.slope === b.slope &&
    a.twistAil === b.twistAil && a.deflHold === b.deflHold;
  results['instrument is deterministic'] = !!same;
  if (!same && a && b)
    say(`  determinism drift: defl1g ${a.defl1g} vs ${b.defl1g}, slope ${a.slope} vs ${b.slope}`);
}

say('');
const failed = Object.keys(results).filter(k => !results[k]);
for (const k of Object.keys(results)) say(`  ${results[k] ? 'ok  ' : 'FAIL'}  ${k}`);
const pass = failed.length === 0;
if (!pass) say(`failed: ${failed.join(' | ')}`);
say(pass ? 'GATE FLEX: PASS' : 'GATE FLEX: FAIL');
process.exitCode = pass ? 0 : 1;
