// ============================================================
// FLEET PERFORMANCE INSTRUMENT — the numbers the FLEET & VALIDATION ANCHORS
// table is made of, measured, in one place.
//
// WHY IT EXISTS. The table's Vs / Vmax / climb / takeoff-run figures were
// each measured by an ad-hoc probe in the session that produced them, and then
// lived only in HANDOVER.md — so "re-read every anchor off the instrument's
// own output, never hand-edit it" was a rule the fleet rows could not actually
// obey. G4.9 (the engine-count fix) had to re-anchor those rows and needed a
// repeatable reading; this is it.
//
// NOT A GATE. It asserts nothing and prints no verdict line — bounds on these
// numbers belong to the per-aircraft circuit gates. It is an instrument, like
// tools/make_probe.js, and the runner does not call it.
//
//   node tools/make_perf.js            all eight
//   node tools/make_perf.js cub pa18   named subset
//   node tools/make_perf.js --json     machine-readable, for A/B diffing
//
// Everything except the takeoff run is a FREE-AIR TUNNEL reading: makeSim with
// no world, which is how the rest of this project defines a clean number — no
// ground effect, no wind, no terrain. The takeoff run cannot be, being a ground
// roll, so it is flown by the autopilot on the validated world from the HOME
// threshold, which is how the fiches' own `ap.TORun` comments say theirs were
// taken ("measured run to 2.5 m agl").
//
// The tunnel probes work in the REST POSE, where the body axes and the world
// axes coincide (sim.reset translates, never rotates) — which is why lift and
// drag below resolve with plain sin/cos on Fx/Fy, exactly as genClMax and
// genProbeAt do in 64_gen_build.js. Rotate the aeroplane and they would not.
// ============================================================
const FC = require('./flight_core.js');
const { makeSim, makeAutopilot, makeWorld, POWERPLANTS } = FC;

const FLEET = [
  ['drone',   FC.buildDrone,   'Foam Trainer 1.4m'],
  ['chinook', FC.buildChinook, 'Birdman Chinook 1S'],
  ['cub',     FC.buildCub,     'Piper J-3 Cub'],
  ['pa18',    FC.buildPA18,    'Piper PA-18 Super Cub'],
  ['jodel',   FC.buildJodel,   'Jodel DR-1050'],
  ['c172',    FC.buildC172,    'Cessna 172S'],
  ['dc3',     FC.buildDC3,     'Douglas DC-3'],
  ['gen',     FC.buildGen,     'Garage build'],
];

const G = 9.81, RHO = 1.225;

const propOf = def => def.params.prop || POWERPLANTS[def.params.powerplant].prop;

// Static thrust as the SOLVER actually applies it, read off the sim rather than
// recomputed: one full-throttle step from rest, then ask for out.thrust. This
// is the reading that caught the mount-node/engine-count conflation.
function staticThrust(def) {
  const sim = makeSim(def, null);
  sim.reset(0);
  sim.ctl.thr = 1;
  sim.step(1 / 240);
  return sim.out.thrust;
}

// Thrust the WHOLE AEROPLANE makes at airspeed V, full throttle.
//
// The multiplier on the per-prop curve is READ OFF THE SOLVER (static thrust at
// rest divided by the prop's own Tstatic) rather than taken from params. That
// is deliberate: this instrument's whole job in G4.9 was to compare a build
// that multiplies by the engine count against one that multiplied by the mount
// count, and an instrument carrying its own opinion of that number would have
// measured its opinion instead of the aeroplane. It cannot silently disagree
// with the solver, whatever the solver does.
function thrustMultiplier(def) {
  return staticThrust(def) / Math.max(1e-9, propOf(def).Tstatic);
}
function thrustAt(def, V, mult) {
  const PR = propOf(def);
  return Math.max(0, PR.Tstatic - PR.kV2 * V * V) * mult;
}

// Prescribed-flow probe at body alpha, free air. Lift and drag in WIND axes.
// Flight path is u = (-cos a, -sin a, 0) (x is AFT, so -x is forward), so drag
// is -(F.u) = Fx cos a + Fy sin a and lift is F.(-sin a, cos a, 0). That is
// genProbeAt's expression from 64_gen_build.js reduced to the rest pose.
function probeAt(sim, V, a) {
  const ca = Math.cos(a), sa = Math.sin(a);
  const r = sim.probe([-V * ca, -V * sa, 0]);
  return { lift: -r.Fx * sa + r.Fy * ca, drag: r.Fx * ca + r.Fy * sa };
}

// alpha that balances weight at V, secant, clamped short of the stall
function alphaForLift(sim, V, W, aMax) {
  let a0 = 0.01, a1 = 0.09;
  let f0 = probeAt(sim, V, a0).lift - W, f1 = probeAt(sim, V, a1).lift - W;
  for (let i = 0; i < 14; i++) {
    if (Math.abs(f1 - f0) < 1e-9) break;
    let a2 = a1 - f1 * (a1 - a0) / (f1 - f0);
    a2 = Math.min(aMax, Math.max(-0.08, a2));
    a0 = a1; f0 = f1; a1 = a2; f1 = probeAt(sim, V, a1).lift - W;
    if (Math.abs(f1) < 0.5) break;
  }
  return a1;
}

// CLmax by alpha sweep, free air — the scan GATE FLAPS and genClMax both use.
function clMax(def, flap) {
  const sim = makeSim(def, null);
  sim.reset(0);
  sim.ctl.flap = flap || 0;
  let Sw = 0;
  for (const st of def.strips) if (st.kind === 'wing') Sw += st.area;
  const V = 30;
  let CLmax = 0, aAt = 0;
  for (let a = 2; a <= 22; a += 0.25) {
    const al = a * Math.PI / 180;
    const r = probeAt(sim, V, al);
    const CL = r.lift / (0.5 * RHO * V * V * Sw);
    if (CL > CLmax) { CLmax = CL; aAt = al; }
  }
  return { CLmax, Sw, aStall: aAt, W: sim.totalM * G };
}

// The speed sweep every steady-flight number falls out of: at each V, trim for
// L = W and read drag, so D(V) and T(V) sit on the same axis.
function sweep(def) {
  const sim = makeSim(def, null);
  sim.reset(0);
  const W = sim.totalM * G;
  const cl = clMax(def, 0);
  const Vs = Math.sqrt(2 * W / (RHO * cl.Sw * Math.max(1e-6, cl.CLmax)));
  const PR = propOf(def);
  // past the stall, and past the speed the prop runs out of thrust at
  const V0 = Math.sqrt(PR.Tstatic / Math.max(1e-9, PR.kV2));
  const Vhi = Math.max(2.6 * Vs, 1.05 * V0);
  const mult = thrustMultiplier(def);
  const rows = [];
  const N = 200;
  for (let i = 0; i <= N; i++) {
    const V = 1.02 * Vs + (Vhi - 1.02 * Vs) * i / N;
    const a = alphaForLift(sim, V, W, cl.aStall * 0.98);
    const r = probeAt(sim, V, a);
    rows.push({ V, a, D: r.drag, L: r.lift,
                held: Math.abs(r.lift - W) < 0.02 * W,
                T: thrustAt(def, V, mult) });
  }
  return { W, Vs, rows, Sw: cl.Sw, CLmax: cl.CLmax, V0, mult };
}

// Vmax: the fastest speed at which thrust still covers drag in level flight.
function vmaxOf(sw) {
  let prev = null, out = null;
  for (const r of sw.rows) {
    if (!r.held) { prev = null; continue; }
    const e = r.T - r.D;
    if (prev && prev.e > 0 && e <= 0) out = prev.V + (r.V - prev.V) * prev.e / (prev.e - e);
    prev = { V: r.V, e };
  }
  return out === null ? { V: sw.rows[sw.rows.length - 1].V, capped: true }
                      : { V: out, capped: false };
}

// Best rate of climb and the speed it happens at. Vz = V*(T - D)/W, the
// small-angle form; at these climb angles the error is under 1%.
function climbOf(sw) {
  let best = { vz: -99, V: 0 };
  for (const r of sw.rows) {
    if (!r.held) continue;
    const vz = r.V * (r.T - r.D) / sw.W;
    if (vz > best.vz) best = { vz, V: r.V };
  }
  return best;
}

// Best glide ratio and its speed. Thrust plays no part, so this does NOT move
// with the engine count — it is the control in any thrust A/B.
function glideOf(sw) {
  let best = { ld: 0, V: 0 };
  for (const r of sw.rows) {
    if (!r.held) continue;
    const ld = r.L / Math.max(1e-6, r.D);
    if (ld > best.ld) best = { ld, V: r.V };
  }
  return best;
}

// TAKEOFF RUN, flown: settle on the HOME threshold, engage, and read the
// distance travelled when the CG first stands 2.5 m above where it started.
function takeoffRun(def, world) {
  const sim = makeSim(def, world);
  sim.reset(0);
  for (let s = 0; s < 5 * 60; s++) sim.step(1 / 60);     // settle on the gear
  const ap = makeAutopilot(sim, def, world);
  const c0 = sim.cgPos();
  let t = 0;
  while (t < 120) {
    ap.update(1 / 60); sim.step(1 / 60);
    t += 1 / 60;
    if (sim.stats().bad) return { run: null, vLof: null, why: 'NaN' };
    const c = sim.cgPos();
    if (c[1] - c0[1] >= 2.5)
      return { run: Math.hypot(c[0] - c0[0], c[2] - c0[2]), vLof: sim.out.V, t };
  }
  return { run: null, vLof: null, why: 'never reached 2.5 m in 120 s' };
}

const fmt = (x, n = 1) => (x === null || x === undefined || !isFinite(x)) ? '-' : x.toFixed(n);

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const want = argv.filter(a => !a.startsWith('--'));
const list = want.length ? FLEET.filter(f => want.includes(f[0])) : FLEET;

const world = makeWorld();
const out = {};
const rows = [];
for (const [key, build, label] of list) {
  const def = build();
  const sw = sweep(def);
  const vm = vmaxOf(sw), cb = climbOf(sw), gl = glideOf(sw);
  const to = takeoffRun(def, world);
  const rec = {
    key, label,
    mass: sw.W / G,
    nEngines: def.params.nEngines || 1,
    engineMounts: def.refs.engine.length,
    propTstatic: propOf(def).Tstatic,
    staticThrust: staticThrust(def),
    Vs: sw.Vs, VsKmh: sw.Vs * 3.6, CLmax: sw.CLmax,
    Vmax: vm.V, VmaxKmh: vm.V * 3.6, VmaxCapped: vm.capped,
    climbBest: cb.vz, climbBestFpm: cb.vz * 196.85, climbAtV: cb.V,
    LDmax: gl.ld, LDatV: gl.V,
    TORunFlown: to.run, TOVlof: to.vLof, TOWhy: to.why || null,
    TORunParam: def.params.ap.TORun,
  };
  out[key] = rec; rows.push(rec);
}

if (asJson) {
  console.log(JSON.stringify(out, null, 1));
} else {
  console.log('FLEET PERFORMANCE — free-air tunnel; takeoff run flown on the validated world');
  console.log('');
  console.log('aircraft | mass kg |eng|mnt| T static N | Vs km/h | Vmax km/h | best climb | at V | L/D max | TO run m | ap.TORun');
  console.log('---------|---------|---|---|------------|---------|-----------|------------|------|---------|----------|---------');
  for (const r of rows)
    console.log(
      `${r.key.padEnd(8)} | ${fmt(r.mass, 1).padStart(7)} |${String(r.nEngines).padStart(3)}|` +
      `${String(r.engineMounts).padStart(3)}| ${fmt(r.staticThrust, 0).padStart(10)} | ` +
      `${fmt(r.VsKmh, 1).padStart(7)} | ${(fmt(r.VmaxKmh, 1) + (r.VmaxCapped ? '*' : '')).padStart(9)} | ` +
      `${(fmt(r.climbBestFpm, 0) + ' fpm').padStart(10)} | ${fmt(r.climbAtV, 1).padStart(4)} | ` +
      `${fmt(r.LDmax, 2).padStart(7)} | ${fmt(r.TORunFlown, 0).padStart(8)} | ${String(r.TORunParam).padStart(8)}`);
  console.log('');
  console.log('eng = params.nEngines, mnt = refs.engine.length — the two used to be read as one number.');
  console.log('* = thrust never ran out inside the sweep; the figure is the top of the sweep, not a Vmax.');
  console.log('L/D max is thrust-free and is the control: it must not move in a thrust-only change.');
}
