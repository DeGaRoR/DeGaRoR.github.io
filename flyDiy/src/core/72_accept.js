// ===========================================================================
// ACCEPT (G2270-G2279) — THE ACCEPTANCE OF A BUILD: THE CHECKS THAT NEED NO
// FLIGHT, THE LEG THAT IS FLOWN, AND THE VERDICT OVER A CONTRACT'S CRITERIA.
// (futureDesigns/GAME-2026-10-06.md §6.2 is the spec; §R G-ACCEPT "certificate
// + a flown acceptance leg"; §R GQ19 "the phone runs the static items only".)
// ===========================================================================
// A build contract states what the aeroplane must DO (§6.1). Some of that the
// build can answer standing still (the seats, the ledger, the tank, the span,
// the certificate, the bench's awards); some it cannot, because the number the
// garage prints is not a measurement:
//   - CRUISE SPEED. VCruise is SOLVED (64_gen_build genTrim: the speed where
//     drag is 65 % of the thrust there) and CLAMPED to 1.55-2.2 Vs — the speed a
//     CIRCUIT is flown at. A clean fast design reads as capped.
//   - ENDURANCE / RANGE. genShakedown's is full throttle / 0.67, a rule of thumb.
// So those are FLOWN: the autopilot holds a stabilised cruise for N minutes at
// a declared throttle and altitude, and the recorder measures the true airspeed
// (the sim's own wind taken out: calm-air), the fuel or energy flow, the height
// and the steadiness. A leg counts only if the height and the speed stayed in
// their bands the whole time. The take-off and the landing at a strip are proved
// by DOING them there: the logbook's row (from, the stop's aerodrome, the run).
//
// THREE LAYERS, ALL PURE (no DOM; the leg's pilot drives an `ap` it is handed):
//   THE STATIC CHECKS   acceptStatic(crit, ev) per kind -> { k, ok, value, need,
//                       source }. NO SIMULATION: they read the ledger, the spec,
//                       the measured footprint, a certificate already computed
//                       and the bench's awarded results. acceptEvidence(def)
//                       builds that evidence off a def without running a sim
//                       (the phone may run these: GQ19). GATE ACCEPT
//                       source-scans them for a solver call.
//   THE LEG             makeAcceptLeg(opts) — the procedure (climb to the
//                       declared height on full power, settle on the declared
//                       throttle, record N minutes, hand back) as a tick on the
//                       AP box (43_pilot ap.engage: HDG + ALT + SET);
//                       makeAcceptRecorder(opts) — the samples and the maths:
//                       acceptLegMeasure(samples, opts) -> the record (tasKmh,
//                       flow, enduranceMin = usable / flow - the reserve,
//                       rangeKm = TAS x endurance, the bands, valid / why).
//                       acceptSign / acceptSigned: the record tied to the build's
//                       bench fingerprint and signed, for the build's logbook.
//   THE VERDICT         acceptVerdict(crit[], evidence) -> per criterion
//                       ok | fail | needs-flight | needs-test, the margin, and
//                       the bonus (§6.3: +10 % per criterion beaten by a stated
//                       margin, 10 % by default). The hook CONTRACT-MODEL calls.
//
// A CRITERION is §6.2 / §7.3's `{ k, op, v, at? }`. `op` defaults per kind
// (ACCEPT_KINDS). `at` is where or at what load: a string is an aerodrome id
// (takeoffAt / landAt), an object may carry { aero, occupants, payloadKg, door,
// shed }. `by` (optional) is the bonus margin (a fraction); `reserveMin`
// (optional, endurance / range) overrides the stated reserve.
// ===========================================================================

// THE RULES, STATED (the record carries the ones it was measured under)
const ACCEPT_RULES = {
  v: 1,
  legMin: 5,            // the recorded leg, minutes (§6.2's 10 for an endurance contract: a criterion may ask for more)
  thr: 0.75,            // the declared throttle: 75 %, the cruise the books quote
  altAGL: 300,          // the declared height above the departure field, m
  settleMaxS: 150,      // the settle's cap after the climb, s
  settleQuietS: 30,     // ...and how long it must be quiet first (|vs| and the speed's drift)
  sampleS: 1,           // the recorder's interval, s of flight time
  altBand: 10,          // m either side of the held height, every sample
  tasBand: 0.03,        // the TAS within 3 % of the leg's mean, every sample
  bankMax: 5,           // deg, every sample
  reserveMin: 15,       // the stated reserve taken off the endurance (§6.3's fish spotter: "+ 15 min reserve")
  usable: 1.0,          // the fraction of the tank or pack counted usable
  bonusBy: 0.10,        // §6.3: beaten by 10 % earns the bonus
  bonusPct: 10,         // ...of +10 % per criterion
  doorClr: 0.3,         // the door rule's clearance each side (71_player_bases PARK_DOOR_CLR)
};

// THE KINDS this file answers: where each is verified and its default op.
// `src`: 'static' (no flight; the phone may run it) | 'flown' (a leg or the logbook).
const ACCEPT_KINDS = {
  seats:        { src: 'static', op: '>=', unit: 'seats',  what: 'occupied seats at their stations (the capacity drawn)' },
  emptyKg:      { src: 'static', op: '<=', unit: 'kg',     what: 'empty mass: the ledger, nobody aboard, no fuel' },
  powertrain:   { src: 'static', op: '==', unit: '',       what: "the powertrain kind: 'electric' | 'piston' | 'turbine'" },
  tankL:        { src: 'static', op: '<=', unit: 'L',      what: 'the fuel tank, litres' },
  batteryKWh:   { src: 'static', op: '<=', unit: 'kWh',    what: 'the pack, kWh' },
  spanM:        { src: 'static', op: '<=', unit: 'm',      what: 'the span as built (the measured plan); with `at.door` / `at.shed`, through that door' },
  costMax:      { src: 'static', op: '<=', unit: '',       what: 'the build cost: the ledger' },
  ultimateG:    { src: 'static', op: '>=', unit: 'g',      what: 'the structural certificate’s ultimate load factor' },
  xwindKt:      { src: 'static', op: '>=', unit: 'kt',     what: 'the bench’s awarded crosswind limit' },
  hydro:        { src: 'static', op: '==', unit: '',       what: 'the bench’s hydroplane test: lifts off the water' },
  tasKmh:       { src: 'flown',  op: '>=', unit: 'km/h',   what: 'true airspeed in a stabilised cruise at the load, calm air' },
  enduranceMin: { src: 'flown',  op: '>=', unit: 'min',    what: 'usable tank / the measured flow, minus the reserve' },
  rangeKm:      { src: 'flown',  op: '>=', unit: 'km',     what: 'TAS x the endurance, still air' },
  takeoffAt:    { src: 'flown',  op: '==', unit: '',       what: 'a take-off from that strip, in the logbook' },
  landAt:       { src: 'flown',  op: '==', unit: '',       what: 'a landing and a stop on that strip, in the logbook' },
};

const acceptNum = v => (typeof v === 'number' && isFinite(v)) ? v : null;
function acceptCmp(op, a, b) {
  if (a == null) return false;
  switch (op) {
    case '>=': return a >= b; case '>': return a > b;
    case '<=': return a <= b; case '<': return a < b;
    case '!=': return a !== b;
    default: return a === b;
  }
}
// a criterion's aerodrome (a string `at`, an `at.aero`, or a string `v`) and load
function acceptAeroOf(c) {
  if (!c) return null;
  if (typeof c.at === 'string') return c.at;
  if (c.at && typeof c.at.aero === 'string') return c.at.aero;
  if (typeof c.v === 'string') return c.v;
  return null;
}
function acceptLoadOf(c) {
  const a = c && c.at && typeof c.at === 'object' ? c.at : null;
  const o = {};
  if (a && acceptNum(a.occupants) != null) o.occupants = a.occupants;
  if (a && acceptNum(a.pax) != null && o.occupants == null) o.occupants = a.pax + 1;
  if (a && acceptNum(a.payloadKg) != null) o.payloadKg = a.payloadKg;
  return o;
}
// does a flown load satisfy the criterion's? (none asked: any load counts)
function acceptLoadOk(need, got) {
  if (!need) return true;
  if (need.occupants != null && !((got && got.occupants) >= need.occupants)) return false;
  if (need.payloadKg != null && !((got && got.payloadKg) >= need.payloadKg - 0.5)) return false;
  return true;
}

// ---- THE EVIDENCE OFF A DEF (no simulation) --------------------------------
// The ledger (61_gen_frame: payload rows = cabin, fuel, cargo), the resolved
// spec, the engine's family, the plan measured off the built nodes
// (71_player_bases playerFootOfDef — the door rule's own footprint). `extra`
// adds what the def cannot carry: { cert, bench, legs, flights, fp }.
function acceptEvidence(def, extra) {
  const ev = Object.assign({}, extra || {});
  if (!def) return ev;
  const S = def.spec || {}, P = def.parts || {}, L = P.ledger;
  if (L) {
    let empty = 0, payload = 0, cost = 0;
    for (const k in L) { const e = L[k]; if (!e) continue; cost += e.cost || 0; if (e.payload) payload += e.mass || 0; else empty += e.mass || 0; }
    ev.emptyKg = empty; ev.payloadKg = payload; ev.cost = cost;
  }
  ev.seats = acceptNum(S.seats);
  ev.occupants = acceptNum(S.occupants);
  const EN = (def.params && def.params.engine) || null;
  const fam = EN && EN.family;
  const E = def.params && def.params.energy;
  const battery = (E && E.kind === 'battery') || (S.energy && S.energy.kind === 'battery') || fam === 'electric';
  ev.powertrain = battery || fam === 'electric' ? 'electric' : fam === 'turbine' ? 'turbine' : fam ? 'piston' : null;
  ev.engineFamily = fam || null;
  ev.tankL = battery ? 0 : acceptNum(S.fuel && S.fuel.litres);
  ev.batteryKWh = battery ? acceptNum((S.energy && S.energy.kWh) || (E && E.kWh)) : 0;
  const F = typeof playerFootOfDef === 'function' ? playerFootOfDef(def) : null;
  ev.foot = F;
  ev.spanM = F ? 2 * F.half : acceptNum(def.params && def.params.gen && def.params.gen.span);
  if (!ev.cert && def.cert && acceptNum(def.cert.ult) != null) ev.cert = { limit: def.cert.limit, ult: def.cert.ult };
  return ev;
}

// the bench's crosswind: the settled row (bench.js `results.xwind`, ok or not:
// a limit is a measurement), m/s. `limit` when the row carries it, else read off
// its verdict ('CROSSWIND LIMIT 6.2 m/s' / 'CROSSWIND LIMIT > 10 m/s')
function acceptBenchXwind(bench) {
  const r = bench && bench.xwind;
  if (!r || r.stale || r.running) return null;
  if (acceptNum(r.limit) != null) return { ms: r.limit, capped: !!r.capped };
  const m = /CROSSWIND LIMIT\s*(>)?\s*([0-9.]+)\s*m\/s/.exec(String(r.verdict || ''));
  return m ? { ms: +m[2], capped: !!m[1] } : null;
}
const ACCEPT_MS_KT = 1.943844;

// ---- THE STATIC CHECKS -----------------------------------------------------
// -> { k, ok, value, need, source } ; value null = no evidence (a test to run).
// NO SIMULATION in here (GQ19): GATE ACCEPT scans these bodies for a solver call.
function acceptStatic(c, ev) {
  ev = ev || {};
  const K = ACCEPT_KINDS[c.k] || {};
  const op = c.op || K.op || '>=';
  const out = (value, source, extra) => Object.assign(
    { k: c.k, ok: value != null && acceptCmp(op, value, c.v), value, need: (op === '==' ? '' : op + ' ') + c.v, source }, extra || {});
  switch (c.k) {
    case 'seats': return out(ev.seats, 'the spec: cabin.seats (the capacity drawn), each at its station mass', { occupants: ev.occupants });
    case 'emptyKg': return out(ev.emptyKg != null ? Math.round(ev.emptyKg * 10) / 10 : null, 'the ledger: every non-payload row (nobody aboard, no fuel)');
    case 'powertrain': return out(ev.powertrain, 'the energy module: the engine family / the pack', { family: ev.engineFamily });
    case 'tankL': return out(ev.tankL, ev.powertrain === 'electric' ? 'electric: no fuel tank' : 'the spec: fuel.litres');
    case 'batteryKWh': return out(ev.batteryKWh, ev.powertrain === 'electric' ? 'the spec: energy.kWh' : 'not electric: no pack');
    case 'costMax': return out(ev.cost != null ? Math.round(ev.cost) : null, 'the ledger: the parts and the covering as built');
    case 'spanM': {
      const at = c.at && typeof c.at === 'object' ? c.at : null;
      const span = ev.spanM != null ? Math.round(ev.spanM * 10) / 10 : null;
      if (at && at.shed && typeof hangarDoorWhy === 'function') {
        const why = hangarDoorWhy(at.shed, ev.foot);
        const door = typeof hangarDoor === 'function' ? hangarDoor(at.shed) : null;
        return { k: c.k, ok: span != null && !why && (c.v == null || acceptCmp(op, span, c.v)), value: span,
                 need: 'through the ' + (door ? door.w.toFixed(1) + ' m ' : '') + 'door' + (c.v != null ? ', ' + op + ' ' + c.v : ''),
                 source: 'the measured plan through hangarDoor (71_player_bases)', why: why || '' };
      }
      if (at && acceptNum(at.door) != null) {
        const ok = span != null && span + 2 * ACCEPT_RULES.doorClr <= at.door && (c.v == null || acceptCmp(op, span, c.v));
        return { k: c.k, ok, value: span, need: 'through a ' + at.door + ' m door (' + ACCEPT_RULES.doorClr + ' m a side)',
                 source: 'the measured plan (playerFootOfDef) and the door rule' };
      }
      return out(span, 'the measured plan: the built nodes (playerFootOfDef)');
    }
    case 'ultimateG': {
      const C = ev.cert;
      return out(C && acceptNum(C.ult) != null ? C.ult : null,
        C ? 'the structural certificate (66_gen_cert: limit ' + C.limit + ' g, ultimate ' + C.ult + ' g)' : 'no certificate yet: the bench computes it at the roll-out');
    }
    case 'xwindKt': {
      const X = acceptBenchXwind(ev.bench);
      return out(X ? Math.round(X.ms * ACCEPT_MS_KT * 10) / 10 : null,
        X ? 'the bench’s crosswind ladder (' + (X.capped ? '> ' : '') + X.ms + ' m/s)' : 'the bench’s crosswind test has not been run', X ? { capped: X.capped } : null);
    }
    case 'hydro': {
      const r = ev.bench && ev.bench.hydro;
      const settled = r && !r.stale && !r.running;
      const v = settled ? !!r.ok : null;
      return { k: c.k, ok: v === true && (c.v == null || c.v === true), value: v, need: 'lifts off the water',
               source: settled ? 'the bench’s hydroplane test: ' + (r.verdict || '') : 'the bench’s hydroplane test has not been run (a float build only)' };
    }
  }
  return { k: c.k, ok: false, value: null, need: String(c.v), source: 'not a static kind' };
}

// ---- THE LEG: THE MEASUREMENT ----------------------------------------------
// samples: [{ t, x, z, alt, tas, gs, vs, bank (rad), E (kg | kWh left), kind,
//             thr, starved, box, ground }] at ACCEPT_RULES.sampleS.
// opts: { thr, alt, legMin, E0 (the tank or pack at departure), kind, load,
//         reserveMin, usable }
// -> { tasKmh, gsKmh, flow (kg/h | kW), flowUnit, usable, grossMin,
//      enduranceMin, rangeKm, bands, valid, why[] }
function acceptLegMeasure(samples, opts) {
  opts = opts || {};
  const R = ACCEPT_RULES;
  const why = [];
  const n = samples ? samples.length : 0;
  const out = { n, valid: false, why };
  if (n < 2) { why.push('no leg recorded'); return out; }
  const s0 = samples[0], s1 = samples[n - 1];
  const dur = s1.t - s0.t;
  out.t0 = s0.t; out.t1 = s1.t; out.durS = dur;
  const want = (opts.legMin != null ? opts.legMin : R.legMin) * 60;
  if (dur < want - 1.5 * R.sampleS) why.push('the leg is ' + (dur / 60).toFixed(1) + ' min, ' + (want / 60).toFixed(1) + ' asked');
  let tas = 0, gs = 0, altMin = Infinity, altMax = -Infinity, tasMin = Infinity, tasMax = -Infinity, bankMax = 0, altMean = 0;
  let flags = { starved: false, box: true, ground: false, thr: false };
  for (const s of samples) {
    tas += s.tas; gs += s.gs; altMean += s.alt;
    altMin = Math.min(altMin, s.alt); altMax = Math.max(altMax, s.alt);
    tasMin = Math.min(tasMin, s.tas); tasMax = Math.max(tasMax, s.tas);
    bankMax = Math.max(bankMax, Math.abs(s.bank || 0) * 180 / Math.PI);
    if (s.starved) flags.starved = true;
    if (s.box === false) flags.box = false;
    if (s.ground) flags.ground = true;
    if (opts.thr != null && s.thr != null && Math.abs(s.thr - opts.thr) > 0.005) flags.thr = true;
  }
  tas /= n; gs /= n; altMean /= n;
  const altRef = opts.alt != null ? opts.alt : altMean;
  out.tasKmh = Math.round(tas * 36) / 10;
  out.gsKmh = Math.round(gs * 36) / 10;
  out.alt = Math.round(altMean * 10) / 10;
  out.bands = {
    alt: [Math.round((altMin - altRef) * 10) / 10, Math.round((altMax - altRef) * 10) / 10], altBand: R.altBand,
    tas: [Math.round((tasMin / tas - 1) * 1000) / 1000, Math.round((tasMax / tas - 1) * 1000) / 1000], tasBand: R.tasBand,
    bankMax: Math.round(bankMax * 10) / 10, bankBand: R.bankMax,
  };
  if (altMax - altRef > R.altBand || altRef - altMin > R.altBand)
    why.push('the height left its band: ' + (altMin - altRef).toFixed(1) + '..+' + (altMax - altRef).toFixed(1) + ' m of ±' + R.altBand);
  if (tasMax > tas * (1 + R.tasBand) || tasMin < tas * (1 - R.tasBand))
    why.push('the speed left its band: ' + ((tasMin / tas - 1) * 100).toFixed(1) + '..+' + ((tasMax / tas - 1) * 100).toFixed(1) + ' % of ±' + (R.tasBand * 100) + ' %');
  if (bankMax > R.bankMax) why.push('banked ' + bankMax.toFixed(1) + '° (±' + R.bankMax + '°)');
  if (flags.starved) why.push('the engine starved');
  if (!flags.box) why.push('the autopilot was disengaged');
  if (flags.ground) why.push('on the ground');
  if (flags.thr) why.push('the throttle moved off the declared ' + opts.thr);
  // THE FLOW: least squares of the energy left against time (the burn is
  // smooth; the fit takes the reading's quantisation out), per hour
  let st = 0, sE = 0, stt = 0, stE = 0;
  for (const s of samples) { const t = s.t - s0.t; st += t; sE += s.E; stt += t * t; stE += t * s.E; }
  const den = n * stt - st * st;
  const slope = den > 0 ? (n * stE - st * sE) / den : 0;    // E per s (negative)
  const kind = opts.kind || s0.kind || 'fuel';
  const flow = -slope * 3600;                                 // kg/h | kW
  out.kind = kind;
  out.flow = Math.round(flow * 1000) / 1000;
  out.flowUnit = kind === 'battery' ? 'kW' : 'kg/h';
  const E0 = opts.E0 != null ? opts.E0 : s0.E;
  const usableK = opts.usable != null ? opts.usable : R.usable;
  const reserve = opts.reserveMin != null ? opts.reserveMin : R.reserveMin;
  out.usable = Math.round(E0 * usableK * 1000) / 1000;
  out.usableUnit = kind === 'battery' ? 'kWh' : 'kg';
  if (kind !== 'battery' && opts.kgL > 0) { out.flowLh = Math.round(flow / opts.kgL * 100) / 100; out.usableL = Math.round(E0 * usableK / opts.kgL * 10) / 10; }
  if (flow > 1e-6) {
    out.grossMin = Math.round(out.usable / flow * 600) / 10;
    out.reserveMin = reserve;
    out.enduranceMin = Math.round((out.usable / flow * 60 - reserve) * 10) / 10;
    out.rangeKm = Math.round(tas * 3.6 * Math.max(0, out.enduranceMin) / 60 * 10) / 10;
  } else { why.push('no measurable flow'); out.grossMin = out.enduranceMin = out.rangeKm = null; }
  out.valid = why.length === 0;
  return out;
}

// ---- THE LEG: THE RECORDER --------------------------------------------------
// The samples, on the leg's own clock: feed it every frame (`frame(sample)`),
// it keeps one every sampleS while recording. `result()` -> the measurement.
function makeAcceptRecorder(opts) {
  opts = Object.assign({}, opts || {});
  const R = ACCEPT_RULES;
  const samples = [];
  let next = -Infinity, on = false;
  return {
    opts, samples,
    start(t) { on = true; samples.length = 0; next = t; },
    stop() { on = false; },
    get on() { return on; },
    frame(s) {
      if (!on || !s || !(s.t >= next - 1e-3)) return;   // (1 ms: the flight's clock is a sum of 1/60 s steps)
      samples.push(s);
      next = Math.round((next + R.sampleS) * 1e6) / 1e6;
      if (s.t >= next) next = s.t + R.sampleS;
    },
    result() { return acceptLegMeasure(samples, opts); },
  };
}

// a sample off the flight (the sim and the pilot the page or a gate flies):
// the pilot's own instruments (its TAS is |v_cg - wind| with the sim's wind,
// 43_pilot: calm-air), the energy left off the solver's fuel state
function acceptSampleOf(sim, ap) {
  const m = ap.instruments ? ap.instruments() : (ap._m || {});
  const F = sim.fuel || {};
  const bat = F.kind === 'battery';
  return { t: m.t != null ? m.t : ap.t, x: m.x, z: m.z, alt: m.alt, tas: m.tas, gs: m.gs, vs: m.vs, bank: m.bank,
           E: bat ? (F.soc || 0) * (F.kWh || 0) : (F.kg || 0), kind: bat ? 'battery' : 'fuel',
           thr: sim.ctl ? sim.ctl.thr : null, starved: !!F.starved, box: !!(ap.box && ap.box.on), ground: !!m.onGround };
}
// what is aboard as the leg flies: the occupants (the spec's), the payload and
// the mass, and the tank or pack at departure
function acceptLoadOfSim(sim, def) {
  const F = sim.fuel || {}, S = (def && def.spec) || {};
  let payload = 0;
  const L = def && def.parts && def.parts.ledger;
  if (L) for (const k in L) if (L[k] && L[k].payload) payload += L[k].mass || 0;
  return { occupants: acceptNum(S.occupants), payloadKg: Math.round(payload * 10) / 10,
           massKg: Math.round((sim.totalM || 0) * 10) / 10,
           E0: F.kind === 'battery' ? (F.kWh || 0) : (F.kg0 || 0), kind: F.kind === 'battery' ? 'battery' : 'fuel',
           kgL: F.kind === 'battery' ? null : ((F.litres0 > 0 && F.kg0 > 0) ? F.kg0 / F.litres0 : null) };
}

// ---- THE LEG: THE PROCEDURE ON THE AP BOX ----------------------------------
// tick(sim, ap) once per physics step (or per frame on the page) after the
// aeroplane is airborne. Stages: 'climb' (ALT at the declared height, FULL) ->
// 'settle' (SET the declared throttle; until |vs| < 0.15 m/s and the TAS has
// drifted < 0.5 % over settleQuietS, or settleMaxS) -> 'record' (legMin) ->
// 'done' (the box disengaged, the pilot resumes the phase it was in, or
// opts.resume). The heading is the one it had when the leg began.
// opts: { thr, alt (absolute) | altAGL + fieldElev, legMin, resume, rec }
function makeAcceptLeg(opts) {
  opts = Object.assign({}, opts || {});
  const R = ACCEPT_RULES;
  const thr = opts.thr != null ? opts.thr : R.thr;
  const legMin = opts.legMin != null ? opts.legMin : R.legMin;
  const L = { stage: 'idle', thr, legMin, alt: null, hdg: null, resume: null, t0: null, tRec: null, quiet: 0, hist: [], result: null, record: null };
  const rec = opts.rec || makeAcceptRecorder({ thr, legMin });
  L.rec = rec;
  // THE LEG'S STATE ON THE PILOT: `ap.accept`, a NEW object at every stage (so
  // sim_host's rare-field copy carries it to the page's view only on a change);
  // `record` is the signed record once the leg is done or aborted
  const pub = ap => {
    if (L.stage === 'done' || L.stage === 'aborted')
      L.record = acceptSign(L.result, Object.assign({}, L.meta || {}, { thr, alt: L.alt, legMin, load: L.load || null }));
    if (ap) ap.accept = { stage: L.stage, thr, legMin, alt: L.alt, t0: L.t0, tRec: L.tRec, record: L.record };
  };
  L.tick = (sim, ap) => {
    const st0 = L.stage;
    const st = tick(sim, ap);
    if (st !== st0) pub(ap);
    return st;
  };
  const tick = (sim, ap) => {
    const m = ap.instruments();
    if (L.stage === 'idle') {
      if (m.onGround) return L.stage;
      L.alt = opts.alt != null ? opts.alt : (opts.fieldElev || 0) + (opts.altAGL != null ? opts.altAGL : R.altAGL);
      L.hdg = m.hdg * Math.PI / 180;
      L.resume = opts.resume || ap.phase;
      L.t0 = m.t; L.x0 = m.x; L.z0 = m.z;
      L.budgetLeft = typeof ap.budget === 'number' ? Math.max(0, ap.budget - m.t) : null;
      ap.engage({ lat: 'HDG', vert: 'ALT', thr: 'FULL' }, { hdg: L.hdg, alt: L.alt });
      L.stage = 'climb';
      return L.stage;
    }
    if (L.stage === 'climb') {
      if (Math.abs(m.alt - L.alt) < 5) { ap.engage({ thr: 'SET' }, { thr }); L.stage = 'settle'; L.tSet = m.t; L.quiet = 0; L.hist.length = 0; }
      return L.stage;
    }
    if (L.stage === 'settle') {
      L.hist.push([m.t, m.tas]);
      while (L.hist.length && m.t - L.hist[0][0] > R.settleQuietS) L.hist.shift();
      const drift = L.hist.length > 1 ? Math.abs(m.tas - L.hist[0][1]) / Math.max(1, m.tas) : 1;
      const quiet = m.t - L.tSet >= R.settleQuietS && Math.abs(m.vs) < 0.15 && drift < 0.005 && Math.abs(m.alt - L.alt) < 3;
      if (quiet || m.t - L.tSet > R.settleMaxS) {
        L.stage = 'record'; L.tRec = m.t; L.settledQuiet = quiet;
        rec.opts.alt = L.alt;
        rec.start(m.t);
      }
      return L.stage;
    }
    if (L.stage === 'record') {
      rec.frame(acceptSampleOf(sim, ap));
      if (m.t - L.tRec >= legMin * 60 - 1e-3) {
        rec.stop();
        L.result = rec.result();
        L.stage = 'done';
        handBack(ap);
      }
      return L.stage;
    }
    return L.stage;
  };
  L.abort = (ap, why) => {
    if (L.stage === 'done' || L.stage === 'aborted') return;
    rec.stop(); L.result = Object.assign(rec.result(), { valid: false }); L.result.why.push(why || 'aborted');
    const engaged = L.stage !== 'idle';
    L.stage = 'aborted';
    if (engaged && ap && ap.box && ap.box.on) handBack(ap);
    pub(ap);
  };
  // THE HAND-BACK: the pilot resumes, and the leg costs it none of its watchdog budget - what it had left when the leg
  // took over, plus the way back from where the leg ended (43_pilot routeBudget's own 1.6 x distance / VCruise).
  // Measured without it: the user's Cub, 10 km out after its leg, landed at HOME as 'gave-up' (the page would have
  // ended that flight in the air)
  function handBack(ap) {
    if (typeof ap.budget === 'number' && L.budgetLeft != null && ap._m) {
      const d = Math.hypot((ap._m.x || 0) - (L.x0 || 0), (ap._m.z || 0) - (L.z0 || 0));
      ap.budget = Math.max(ap.budget, ap.t + L.budgetLeft + 1.6 * d / Math.max(15, ap.VCruise || 30) + 120);
    }
    ap.disengage(L.resume || 'auto');
  }
  return L;
}
// THE LEG ON A FLIGHT: the load as it flies (the tank or pack at departure),
// the recorder, the procedure; `o.meta` { fp, when, from } signs the record.
// The page (accept_rec.js) and the physics thread (sim_host.js 'accept') both
// start it here, so the leg is the same leg wherever the pilot flies.
function acceptLegStart(sim, ap, def, o) {
  o = Object.assign({}, o || {});
  const R = ACCEPT_RULES;
  const load = acceptLoadOfSim(sim, def);
  const thr = o.thr != null ? o.thr : R.thr;
  const rec = makeAcceptRecorder({ E0: load.E0, kind: load.kind, kgL: load.kgL, thr,
    legMin: o.legMin != null ? o.legMin : R.legMin, reserveMin: o.reserveMin });
  const L = makeAcceptLeg(Object.assign({}, o, { thr, rec }));
  L.load = load; L.meta = o.meta || {};
  if (ap) ap.accept = { stage: 'idle', thr, legMin: L.legMin, alt: null, t0: null, tRec: null, record: null };
  return L;
}

// ---- THE SIGNATURE: the record tied to the build ---------------------------
// FNV-1a over the canonical JSON of the record without its `sig` — the same
// hash family as the bench's fingerprint (bench.js benchHash), so a record
// edited after the flight no longer verifies and is not counted.
function acceptCanon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(acceptCanon).join(',') + ']';
  const ks = Object.keys(v).filter(k => v[k] !== undefined).sort();
  return '{' + ks.map(k => JSON.stringify(k) + ':' + acceptCanon(v[k])).join(',') + '}';
}
function acceptHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('0000000' + h.toString(16)).slice(-8);
}
// the logbook's leg record: { v, fp, when, decl, load, rules, ...measure, sig }
function acceptSign(measure, meta) {
  meta = meta || {};
  const R = ACCEPT_RULES;
  const rec = Object.assign({ v: R.v, fp: meta.fp || null, when: meta.when || null, from: meta.from || null,
    decl: { thr: meta.thr != null ? meta.thr : R.thr, alt: meta.alt != null ? Math.round(meta.alt) : null, legMin: meta.legMin != null ? meta.legMin : R.legMin },
    load: meta.load ? { occupants: meta.load.occupants, payloadKg: meta.load.payloadKg, massKg: meta.load.massKg } : null,
    rules: { altBand: R.altBand, tasBand: R.tasBand, bankMax: R.bankMax, reserveMin: measure.reserveMin != null ? measure.reserveMin : R.reserveMin, usable: R.usable } },
    JSON.parse(JSON.stringify(measure)));
  delete rec.sig;
  rec.sig = acceptHash(acceptCanon(rec));
  return rec;
}
function acceptSigned(rec) {
  if (!rec || typeof rec !== 'object' || !rec.sig) return false;
  const c = Object.assign({}, rec); delete c.sig;
  return acceptHash(acceptCanon(c)) === rec.sig;
}

// the logbook's flight row, the part ACCEPT reads (app.js logFlight writes the
// same fields): where it STOPPED (flightWhere: a strip, a lane, a stand, an
// apron) and what was aboard
function acceptStopAt(world, x, z) {
  if (typeof flightWhere !== 'function') return null;
  const w = flightWhere(world, x, z);
  return (typeof flightCanDepart === 'function' ? flightCanDepart(w) : !!(w && w.aero)) ? w.id : null;
}

// ---- THE VERDICT ------------------------------------------------------------
// evidence = acceptEvidence(def, { cert, bench, legs, flights, fp }):
//   legs     the logbook's signed leg records (GARAGE_SPEC.log().accept)
//   flights  the logbook's flight rows (log().flights): { from, to, at, sink, run, occ, fp, outcome }
//   fp       the live fingerprint: a leg or a row under another is WITHDRAWN (the bench's stickers' rule)
// -> { rows: [{ k, op, v, at, status, ok, value, need, margin, marginPct, beat, source, why? }],
//      ok, needsFlight, needsTest, beaten, bonusPct }
function acceptLegsFor(ev, need) {
  const legs = (ev && ev.legs) || [];
  return legs.filter(r => acceptSigned(r) && r.valid && (ev.fp == null || r.fp === ev.fp) && acceptLoadOk(need, r.load));
}
function acceptVerdict(crit, evidence) {
  const ev = evidence || {};
  const rows = [];
  for (const c0 of crit || []) {
    const c = Object.assign({}, c0);
    const K = ACCEPT_KINDS[c.k];
    const op = c.op || (K && K.op) || '>=';
    const row = { k: c.k, op, v: c.v, at: c.at, status: 'fail', ok: false, value: null, need: '', margin: null, marginPct: null, beat: false, source: '' };
    if (!K) { row.status = 'fail'; row.source = 'unknown criterion kind'; rows.push(row); continue; }
    if (K.src === 'static') {
      const s = acceptStatic(Object.assign({}, c, { op }), ev);
      Object.assign(row, { value: s.value, need: s.need, source: s.source, ok: s.ok });
      if (s.why) row.why = s.why;
      row.status = s.ok ? 'ok' : s.value == null ? 'needs-test' : 'fail';
    } else if (c.k === 'tasKmh' || c.k === 'enduranceMin' || c.k === 'rangeKm') {
      const need = acceptLoadOf(c);
      const legs = acceptLegsFor(ev, need);
      const leg = legs[legs.length - 1];
      row.need = op + ' ' + c.v + (need.occupants != null ? ' with ' + need.occupants + ' aboard' : '') + (need.payloadKg != null ? ', ' + need.payloadKg + ' kg' : '');
      if (!leg) {
        const any = ((ev.legs) || []).filter(r => acceptSigned(r));
        row.status = 'needs-flight';
        row.source = !any.length ? 'no acceptance leg in the logbook'
          : any.every(r => ev.fp != null && r.fp !== ev.fp) ? 'every leg was flown before the build changed (withdrawn)'
          : any.every(r => !r.valid) ? 'no VALID leg: ' + ((any[any.length - 1].why || []).join('; ') || 'rejected')
          : 'no valid leg at that load';
      } else {
        let val = leg[c.k];
        // a criterion with its own reserve: the gross endurance less that one
        if ((c.k === 'enduranceMin' || c.k === 'rangeKm') && acceptNum(c.reserveMin) != null && acceptNum(leg.grossMin) != null) {
          const end = Math.round((leg.grossMin - c.reserveMin) * 10) / 10;
          val = c.k === 'enduranceMin' ? end : Math.round(leg.tasKmh * Math.max(0, end) / 60 * 10) / 10;
        }
        row.value = acceptNum(val);
        row.ok = row.value != null && acceptCmp(op, row.value, c.v);
        row.status = row.ok ? 'ok' : 'fail';
        row.source = 'the acceptance leg of ' + (leg.when || '?') + ' (' + leg.decl.legMin + ' min at ' + Math.round(leg.decl.thr * 100) + ' % throttle, '
          + (leg.load && leg.load.occupants != null ? leg.load.occupants + ' aboard, ' : '') + 'sig ' + leg.sig + ')';
        row.leg = leg.sig;
      }
    } else {
      // takeoffAt / landAt: the logbook's rows under this fingerprint
      const id = acceptAeroOf(c), need = acceptLoadOf(c);
      row.need = (c.k === 'takeoffAt' ? 'a take-off from ' : 'a landing and stop at ') + id + (need.occupants != null ? ' with ' + need.occupants + ' aboard' : '');
      const rowsF = ((ev.flights) || []).filter(f => f && (ev.fp == null || f.fp === ev.fp) && acceptLoadOk(need, { occupants: f.occ, payloadKg: f.payloadKg }));
      const hit = rowsF.filter(f => c.k === 'takeoffAt'
        ? f.from === id && f.sink != null                                   // it left that strip and arrived somewhere
        : f.at === id && f.sink != null && !f.outcome);                     // it landed and stopped there
      const last = hit[hit.length - 1];
      row.ok = !!last; row.value = last ? id : null;
      row.status = last ? 'ok' : 'needs-flight';
      row.source = last ? 'the logbook: ' + (last.from || '?') + ' → ' + (last.at || last.to || '?') + ' on ' + (last.on || '?') + (last.run != null ? ', landing run ' + last.run + ' m' : '')
                        : 'not yet done there' + (((ev.flights) || []).some(f => f && ev.fp != null && f.fp !== ev.fp) ? ' (earlier flights were of another build)' : '');
    }
    // THE MARGIN, for the bonus: how far past the line, as a fraction of it
    if (row.ok && acceptNum(row.value) != null && acceptNum(c.v) != null && op !== '==' && c.v !== 0) {
      row.margin = Math.round((op[0] === '>' ? row.value - c.v : c.v - row.value) * 100) / 100;
      row.marginPct = Math.round(row.margin / Math.abs(c.v) * 1000) / 1000;
      row.beat = row.marginPct >= (acceptNum(c.by) != null ? c.by : ACCEPT_RULES.bonusBy) - 1e-9;
    }
    rows.push(row);
  }
  const beaten = rows.filter(r => r.beat).length;
  return { rows, ok: rows.length > 0 && rows.every(r => r.ok), needsFlight: rows.filter(r => r.status === 'needs-flight').map(r => r.k),
           needsTest: rows.filter(r => r.status === 'needs-test').map(r => r.k), beaten, bonusPct: beaten * ACCEPT_RULES.bonusPct };
}

// the plaque's "proved in flight" row: the last valid leg under the live
// fingerprint, or { withdrawn } when every leg is another build's (null: none)
function acceptPlaqueLeg(legs, fp) {
  const signed = (legs || []).filter(r => acceptSigned(r) && r.valid);
  if (!signed.length) return null;
  const mine = signed.filter(r => fp == null || r.fp === fp);
  if (mine.length) return { leg: mine[mine.length - 1], n: mine.length };
  return { withdrawn: true, leg: signed[signed.length - 1] };
}
