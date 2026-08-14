// gen_ap_probe.js — GARAGE autopilot INSTRUMENT. Asserts nothing, like
// make_perf.js: it flies a spread of generated aeroplanes and prints where the
// loops SATURATE, which is the only readout that tells you why a circuit went
// wrong rather than that it did.
//
// Why it exists: GATE GEN flies exactly ONE build — buildGen() on GEN_DEFAULT,
// which is deliberately Cub-like, i.e. sitting on the generator's own
// calibration point. The panel reaches 293-1095 kg, wing loading 15.9-70.4,
// cruise 22.5-47.4 m/s and L/D 4.6-15.2, and NONE of that is flown by any gate.
//
// It also exists because partial fixes are dangerous here: fixing the INBOUND
// speed alone takes a fast build from "stumbles into a landing 2.8 m off" to
// "142 m off at 10.7 m/s sink", because holding altitude EXPOSES the cross-track
// the ground-skimming was hiding. Every change has to be judged on the same
// table, not on one aeroplane.
//
//   node tools/gen_ap_probe.js            all specs
//   node tools/gen_ap_probe.js fastLowWing bigSlow    a subset
//   node tools/gen_ap_probe.js --trace stock          per-phase trace as well
const { buildGen, genShakedown, makeSim, makeWorld, makeAutopilot,
        GEN_DEFAULT, POWERPLANTS } = require('./flight_core.js');

// ---------------------------------------------------------------------------
// THE ENVELOPE. Each entry is a legal panel state, chosen to sit at a corner of
// what the garage can build rather than near the preset. Keep them legal:
// clampSpec is the authority and will quietly pull anything out of range.
// ---------------------------------------------------------------------------
// EVERY ENTRY IS BALANCED. Changing the wing alone walks the static margin
// straight out of the 5-35% band GATE GEN accepts (a 6.5 m wing at the default
// station reads 43%, the radial 68%), and an aeroplane that far out of balance
// flies badly for reasons that have nothing to do with the autopilot — the
// first version of this file spent a whole pass chasing those as AP bugs. So
// each spec carries the wing station that puts it back near 20%, which is what
// a builder would do in the panel anyway. `place.dx` is the slider that moves
// it, and the table prints SM so an out-of-band build is never read as an AP
// failure.
const SPECS = [
  ['stock', () => {}],
  ['bigSlow', s => {                       // big soft wing, small engine
    s.wings[0].span = 14; s.wings[0].chord = 2.0;
    s.engines[0].type = 'o200_eprops';
    s.wings[0].place.dx = 0.5;
  }],
  ['fastLowWing', s => {                   // small clean wing, big engine, trike
    s.wings[0].span = 8.0; s.wings[0].chord = 1.2;
    s.engines[0].type = 'io360_mccauley';
    s.gear.type = 'tricycle'; s.bracing.type = 'cantilever';
    s.controls.flap.type = 'plain';
    s.wings[0].place.dx = -0.5;
  }],
  // The radial needs the stiff gear: on the default suspension this build
  // FOLDS ITS UNDERCARRIAGE and never stands up (genShakedown onWheels false,
  // gearFolded true). That is a gear-rules failure, not an autopilot one, and
  // the table reports it as NOGEAR so it is never scored against the AP.
  ['heavyFast', s => {                     // over-powered heavy: thrCruise 0.24
    s.wings[0].span = 12; s.wings[0].chord = 1.8;
    s.engines[0].type = 'r1830_hs23e50';
    s.cabin.seating = 'side2'; s.cabin.pilots = 2;
    s.controls.flap.type = 'slotted';
    s.gear.stiffness = 3.0; s.wings[0].place.dx = -1.0;
  }],
  ['heavyLoad', s => {                     // UNDER-powered heavy: thrCruise 0.83
    s.wings[0].span = 11; s.wings[0].chord = 1.7;
    s.engines[0].type = 'io360_mccauley';
    s.cabin.seating = 'side2'; s.cabin.pilots = 2;
    s.controls.flap.type = 'slotted';
    s.fuel.litres = 140; s.cargo.kg = 200; s.gear.stiffness = 2.0;
    s.wings[0].place.dx = 0.2;
  }],
  ['lowPower', s => {
    s.engines[0].type = 'rotax277_pusher'; s.wings[0].place.dx = 0.3;
  }],
  ['flapped', s => { s.controls.flap.type = 'fowler'; }],
  ['shortSpan', s => {
    s.wings[0].span = 6.5; s.wings[0].chord = 1.15;
    s.wings[0].place.dx = -0.3;
  }],
  ['trikeStock', s => { s.gear.type = 'tricycle'; }],
];

const args = process.argv.slice(2);
const trace = args.includes('--trace');
const want = args.filter(a => !a.startsWith('--'));

// ---------------------------------------------------------------------------
// THE FLIGHT. One HOME circuit, instrumented. Nothing here asserts; everything
// here is OBSERVABLE from sim.ctl and ap.dbg — no reaching into the autopilot's
// closures, so the instrument survives the autopilot being edited.
// ---------------------------------------------------------------------------
const CRUISEY = ['CRUISE', 'ENROUTE', 'TURNBACK', 'INBOUND'];
const FINALY = ['INBOUND', 'APPROACH'];

function fly(def, maxS = 420) {
  const world = makeWorld();
  const sim = makeSim(def, world);
  sim.reset(0);
  for (let f = 0; f < 5 * 60; f++) sim.step(1 / 60);   // settle on the wheels
  const ap = makeAutopilot(sim, def, world);
  const A = def.params.ap;
  const thrFloor = A.thrFloor ?? 0.12;
  // THE FLAPS-DOWN stall, because the margin being judged is the one on final
  // and the approach is flown with the flaps out. Against the clean stall a
  // Fowler-flapped build read 1.06 and looked like it was mushing when it was
  // actually flying a textbook 1.42 VsFlap.
  const Vs = def.params.gen.VsFlap || def.params.gen.Vs;

  const m = {
    log: [], phaseT: {}, minAgl: {}, td: null, stopX: null, stopZ: null,
    maxAlt: -1e9, altTgt: A.hCruise, nan: false, t: 0,
    thrPin: 0, thrPinN: 0,          // throttle on its floor through the descent
    deSat: 0, deSatN: 0,            // elevator against its stop on final
    climbPin: 0, climbPinN: 0,      // above target altitude and STILL going up
    minVratio: 9,                   // worst V/Vs once committed to the arrival
    reached: {},
  };
  let last = '';

  for (let f = 0; f < maxS * 60; f++) {
    const t = f / 60;
    m.t = t;
    ap.update(1 / 60); sim.step(1 / 60);
    if (sim.stats().bad) { m.nan = true; break; }

    const ph = ap.phase, d = ap.dbg, cg = sim.cgPos(), vcg = sim.cgVel();
    if (!m.reached[ph]) m.reached[ph] = t;
    m.phaseT[ph] = (m.phaseT[ph] || 0) + 1 / 60;
    if (d.agl !== undefined)
      m.minAgl[ph] = Math.min(m.minAgl[ph] === undefined ? 9e9 : m.minAgl[ph], d.agl);
    m.maxAlt = Math.max(m.maxAlt, cg[1]);

    // SATURATION. The three instruments that name the three failure modes.
    if (CRUISEY.includes(ph)) {
      m.climbPinN++;
      // above the altitude the AP is asking for, and still climbing: this is
      // the holdVS pitch command pinned on vsFloor (chinook fiche, verbatim)
      if (cg[1] > A.hCruise + 5 && vcg[1] > 0.3) m.climbPin++;
    }
    if (FINALY.includes(ph)) {
      m.thrPinN++;
      if (sim.ctl.thr <= thrFloor + 1e-6) m.thrPin++;
      if (d.V > 1) m.minVratio = Math.min(m.minVratio, d.V / Vs);
    }
    if (ph === 'APPROACH' || ph === 'FLARE') {
      m.deSatN++;
      // holdPitch clamps de to [-0.30, +0.35]; against the stop = out of elevator
      if (sim.ctl.de >= 0.3325 || sim.ctl.de <= -0.285) m.deSat++;
    }

    if (ph !== last) {
      m.log.push(`  t=${t.toFixed(1).padStart(6)} -> ${ph.padEnd(9)}` +
                 ` V=${d.V.toFixed(1).padStart(5)} alt=${d.alt.toFixed(0).padStart(4)}` +
                 ` s=${d.s.toFixed(0).padStart(6)} z=${d.z.toFixed(1).padStart(7)}`);
      last = ph;
    }
    if (ph === 'STOPPED' && !m.stopX) { m.stopX = cg[0]; m.stopZ = cg[2]; }
    if (ph === 'STOPPED' && m.phaseT.STOPPED > 3) break;
  }
  m.td = ap.tdInfo;
  m.xAim = ap.xAim;
  m.endPhase = ap.phase;
  // THE HEADLINE SYMPTOM, measured: how long the aeroplane spent getting to
  // the top of the climb. CLIMB only ever exits on reaching hCruise-8, so a
  // build that cannot reach the Cub's 100 m stays there until the clock runs
  // out — which is what "it keeps climbing forever" actually is.
  m.toCruise = m.reached.CRUISE ?? m.reached.ENROUTE ?? null;
  m.upT = (m.phaseT.LIFTOFF || 0) + (m.phaseT.CLIMB || 0) + (m.phaseT.ROLL || 0);
  return m;
}

// ---------------------------------------------------------------------------
const rows = [];
for (const [name, mut] of SPECS) {
  if (want.length && !want.includes(name)) continue;
  const spec = JSON.parse(JSON.stringify(GEN_DEFAULT));
  mut(spec);
  let def, sk;
  try { def = buildGen(spec); sk = genShakedown(def); }
  catch (e) { console.log(`${name}: BUILD FAILED — ${e.message}`); continue; }
  const A = def.params.ap, g = def.params.gen;
  // An aeroplane whose undercarriage has COLLAPSED cannot be flown by anybody.
  // Score it separately or the gear rules read as an autopilot bug — which is
  // exactly what happened the first time this instrument was run.
  // The test is `gearFolded` (susShift > 0.5: geometric, catches the snap-through
  // that no strain gate sees, 64_gen_build.js L226-236) and NOT `onWheels`,
  // which requires BOTH axles within 6 cm of the ground and so reads false for
  // a perfectly serviceable trike that simply sits nose-high.
  if (sk.gearFolded) {
    console.log(`\n=== ${name} ===\n  NOGEAR: undercarriage folded` +
      ` (rests on ${sk.restsOn}, susShift ${sk.susShift.toFixed(2)}, ${sk.mass.toFixed(0)} kg).` +
      ` Not an autopilot failure — skipped.`);
    rows.push({ name, mass: sk.mass, Vs: g.Vs, VC: A.VCruise, VA: A.VAppr, LD: sk.LD,
                sm: sk.staticMargin * 100, bad: 'NOGEAR',
                climb: '  -', thrPin: '  -', deSat: '  -' });
    continue;
  }
  // Nor can one be flown by an autopilot if it has no performance to fly WITH.
  // Both numbers come straight out of the tunnel pass.
  if (!sk.flyableCircuit) {
    console.log(`\n=== ${name} ===\n  NOFLY: cannot fly a circuit` +
      ` (climb gradient ${sk.climbGrad.toFixed(4)} = ${sk.climbRate.toFixed(2)} m/s,` +
      ` TORun ${sk.TORun} m against HOME's 1100). Airframe limit, not an` +
      ` autopilot failure — skipped.`);
    rows.push({ name, mass: sk.mass, Vs: g.Vs, VC: A.VCruise, VA: A.VAppr, LD: sk.LD,
                sm: sk.staticMargin * 100, bad: 'NOFLY',
                climb: '  -', thrPin: '  -', deSat: '  -' });
    continue;
  }
  const m = fly(def);

  const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '  -';
  const tdS = m.td ? m.td.x : null;
  rows.push({
    name,
    mass: sk.mass, wl: sk.wingLoad, Vs: g.Vs, VC: A.VCruise, VA: A.VAppr,
    LD: sk.LD, thrC: A.thrCruise, TORun: A.TORun, sm: sk.staticMargin * 100,
    ok: !!m.td && m.stopX !== null && !m.nan,
    dx: tdS === null ? null : tdS - m.xAim,
    dz: m.td ? m.td.z : null,
    sink: m.td ? m.td.sink : null,
    climb: pct(m.climbPin, m.climbPinN),
    thrPin: pct(m.thrPin, m.thrPinN),
    deSat: pct(m.deSat, m.deSatN),
    vr: m.minVratio === 9 ? null : m.minVratio,
    maxAlt: m.maxAlt, hC: A.hCruise, nan: m.nan, t: m.t,
    minAglCruise: (() => {
      const v = Math.min(...CRUISEY.map(p => m.minAgl[p] === undefined ? Infinity : m.minAgl[p]));
      return isFinite(v) ? v : null;
    })(),
    upT: m.upT, toCruise: m.toCruise, endPhase: m.endPhase,
    smBad: sk.staticMargin <= 0.05 || sk.staticMargin >= 0.35,
    m,
  });

  console.log(`\n=== ${name} ===`);
  console.log(`  ${sk.mass.toFixed(0)} kg · S=${sk.Sw.toFixed(1)} m2 · w/l ${sk.wingLoad.toFixed(1)}` +
    ` · Vs ${g.Vs.toFixed(1)} · VCruise ${A.VCruise} · VAppr ${A.VAppr} · VTurn ${A.VTurn ?? '(default)'}` +
    ` · L/D ${sk.LD.toFixed(1)} · SM ${(sk.staticMargin * 100).toFixed(0)}% · thrCruise ${A.thrCruise.toFixed(2)}` +
    ` · TORun ${A.TORun} m`);
  console.log(`  gs ${A.gs} · thrFloor ${A.thrFloor ?? 0.12} · thrAppr ${A.thrAppr}` +
    ` · vsFloor ${A.vsFloor ?? -0.08} · thMax ${A.thMax} · bankLim ${A.bankLim ?? 0.30}` +
    ` · look ${A.lookRoll ?? 25}/${A.lookAppr ?? 100}/${A.lookCruise ?? 150}` +
    ` · hCruise ${A.hCruise} xTurn ${A.xTurn} xAim ${A.xAim}`);
  if (trace) console.log(m.log.join('\n'));
}

// ---------------------------------------------------------------------------
console.log('\n' + '-'.repeat(118));
console.log('spec          mass    Vs   VCru  VApp   L/D   SM  | toCru  end        dAim     dZ  sink' +
            '  |  climbPin thrPin deSat  minV/Vs  minAgl');
for (const r of rows) {
  const f = (v, w, d = 1) => v === null || v === undefined || !isFinite(v)
    ? '-'.padStart(w) : v.toFixed(d).padStart(w);
  console.log(
    `${r.name.padEnd(13)}${f(r.mass, 5, 0)} ${f(r.Vs, 5)} ${f(r.VC, 5)} ${f(r.VA, 5)} ${f(r.LD, 5)}` +
    ` ${f(r.sm, 3, 0)}${r.smBad ? '!' : ' '}` +
    `  | ${f(r.toCruise, 5, 0)} ${(r.bad || (r.nan ? 'NaN' : r.endPhase)).padEnd(9)}` +
    ` ${f(r.dx, 6, 0)} ${f(r.dz, 6)} ${f(r.sink, 5, 2)}` +
    `  |  ${r.climb.padStart(6)} ${r.thrPin.padStart(6)} ${r.deSat.padStart(5)}` +
    `   ${f(r.vr, 6, 2)}  ${f(r.minAglCruise, 6, 0)}`);
}
console.log('-'.repeat(118));
console.log('toCru    = seconds from brakes-off to the top of the climb ("-" = NEVER got there;');
console.log('           CLIMB only exits on reaching hCruise-8, so "-" IS the endless climb)');
console.log('end      = phase when the run ended · dAim = touchdown minus aim, m (+ long) · dZ = cross-track');
console.log('climbPin = share of the cruise legs spent above target altitude STILL climbing (vsFloor pinned)');
console.log('thrPin   = share of INBOUND+APPROACH with the throttle on its floor (no decel margin: floats)');
console.log('deSat    = share of APPROACH+FLARE with the elevator against its stop (out of trim on final)');
console.log('minV/Vs  = worst airspeed margin on the arrival, against the FLAPS-DOWN stall');
console.log('           (doctrine: the AP flies 1.25 Vs approaches; 1.13 stalled the Chinook)');
console.log('minAgl   = lowest height above the field on the CRUISE legs (should never approach hSafe)');
