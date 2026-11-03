// ============================================================
// THE ELECTRICAL BUS (the panel arc, session 4, 2026-09-12) — pure, no sim,
// no THREE, no DOM. One 12 V bus with a battery, an alternator (or a
// generator) and the loads the fit declares; the switches the cockpit
// throws; the volts and amps the panel reads.
//
// WHAT IT IS, and no more: a battery has a capacity (Ah) and a state of
// charge; its open-circuit voltage falls with the charge (12.7 V full,
// 11.8 V at a fifth); the alternator holds the bus at 14.1 V once the
// engine turns fast enough for it (a belt generator cuts in above idle, an
// alternator too) AND its switch is on, and what it makes above the loads
// goes back into the battery; with the alternator off or the engine slow
// the loads drain the battery; at nothing the bus is dead and everything
// electric on the panel is dead with it. The starter is a 150 A load for as
// long as it cranks. Nothing here models a breaker, a diode or a regulator
// fault — a switch is a switch.
//
// `makeBus(cfg)`: cfg = { battAh, altA, altCutIn (prop rpm), loads: [{key,
// amps}], starterA } — genSystemsResolve's own numbers.
//   bus.master / bus.alt   the two switches (true/false)
//   bus.on[key]            per-load switches (a light, a radio), default on
//   bus.step(dt, rpm, cranking)
//   bus.V, bus.amps (net into the battery, + charging), bus.soc, bus.loadA,
//   bus.altOn (the alternator is carrying the bus), bus.ok (volts enough
//   for an instrument), bus.starterOk (volts enough to crank)
//
// THE BREAKERS AND THE AVIONICS BUS (G2801, AVIONICS-GPS phase 2). A load
// may name its breaker (`cb`) and ride the avionics bus (`av`); cfg.breakers
// [{key, A}] are the breaker panel genSystemsResolve lists.
//   bus.avionics            the avionics master (true/false): an `av` load
//                           draws nothing with it off
//   bus.cb[key]             a breaker IN (true, the default) or pulled /
//                           tripped (false): its loads draw nothing
//   bus.tripped[key]        set when a breaker opened itself: the sum of its
//                           loads went over its rating (a pilot's push resets
//                           it by setting bus.cb[key] true again)
//   bus.powered(key)        is that load alive now: the bus up, the master
//                           on, its own switch, its breaker, its bus
//   bus.alt                 the alternator's switch; with the field breaker
//                           ('field') out the alternator makes nothing either
// A load with neither field behaves exactly as before: a bus without
// breakers is the bus it always was. step() allocates nothing.
// ============================================================
const ELEC_V_FULL = 12.7, ELEC_V_LOW = 11.8, ELEC_V_ALT = 14.1;
const ELEC_MIN_V = 9.0;            // an instrument reads below this and dies
const ELEC_CRANK_V = 10.0;         // a starter turns above this

function makeBus(cfg) {
  cfg = cfg || {};
  const battAh = Math.max(0, +cfg.battAh || 0);
  const altA = Math.max(0, +cfg.altA || 0);
  const cutIn = cfg.altCutIn > 0 ? +cfg.altCutIn : 1100;
  const starterA = cfg.starterA > 0 ? +cfg.starterA : 150;
  const loads = (cfg.loads || []).map(l => ({ key: l.key, amps: Math.max(0, +l.amps || 0),
                                              av: !!l.av, cb: l.cb != null ? String(l.cb) : null }));
  const byKey = {};
  for (const l of loads) byKey[l.key] = l;
  const breakers = (cfg.breakers || []).map(b => ({ key: String(b.key), A: Math.max(0, +b.A || 0), sum: 0 }));
  const cbOf = {};
  for (const b of breakers) cbOf[b.key] = b;
  // a load is live when its own switch, its breaker and its bus let it be (the master is the caller's test)
  const live = l => bus.on[l.key] !== false && (!l.av || bus.avionics) && (l.cb === null || bus.cb[l.cb] !== false);
  const bus = {
    master: battAh > 0 || altA > 0, alt: altA > 0, on: {},
    avionics: true, cb: {}, tripped: {}, breakers,
    soc: 1, V: 0, amps: 0, loadA: 0, altOn: false, ok: false, starterOk: false,
    battAh, altA, cutIn,
    // the battery's open-circuit voltage from its charge, a straight line
    // between the two anchors (the real curve is flatter in the middle;
    // the gauge cannot tell)
    vBatt() { return battAh > 0 && bus.soc > 0
      ? ELEC_V_LOW + (ELEC_V_FULL - ELEC_V_LOW) * Math.min(1, Math.max(0, (bus.soc - 0.2) / 0.8)) : 0; },
    setLoad(key, amps, cb) {
      const l = byKey[key];
      if (l) { l.amps = Math.max(0, +amps || 0); if (cb !== undefined) l.cb = cb != null ? String(cb) : null; }
      else { const n = { key, amps: Math.max(0, +amps || 0), av: false, cb: cb != null ? String(cb) : null };
             loads.push(n); byKey[key] = n; }
    },
    loads: () => loads.map(l => ({ key: l.key, amps: l.amps, on: bus.on[l.key] !== false, av: l.av, cb: l.cb })),
    powered(key) {
      if (!bus.ok || !bus.master) return false;
      const l = byKey[key];
      return l ? live(l) : true;
    },
    step(dt, rpm, cranking) {
      let load = 0;
      if (bus.master) {
        // each breaker's sum, then any that its loads drove over its rating opens (G2801)
        for (let i = 0; i < breakers.length; i++) breakers[i].sum = 0;
        for (let i = 0; i < loads.length; i++) {
          const l = loads[i];
          if (!live(l)) continue;
          if (l.cb !== null) { const b = cbOf[l.cb]; if (b) b.sum += l.amps; }
        }
        for (let i = 0; i < breakers.length; i++) {
          const b = breakers[i];
          if (b.A > 0 && b.sum > b.A + 1e-9 && bus.cb[b.key] !== false) { bus.cb[b.key] = false; bus.tripped[b.key] = true; }
        }
        for (let i = 0; i < loads.length; i++) if (live(loads[i])) load += loads[i].amps;
        if (cranking) load += starterA;
      }
      bus.loadA = load;
      const field = bus.cb.field !== false;        // the alternator's field breaker (G2801)
      bus.altOn = !!(bus.master && bus.alt && field && altA > 0 && rpm >= cutIn);
      if (!bus.master || battAh <= 0) {
        // no master: nothing flows. A running alternator with no battery
        // (a generator-only aeroplane) still carries its loads
        bus.altOn = !!(bus.alt && field && altA > 0 && rpm >= cutIn && battAh <= 0 && bus.master);
        bus.V = bus.altOn ? ELEC_V_ALT : 0;
        bus.amps = 0;
      } else if (bus.altOn) {
        bus.V = ELEC_V_ALT;
        // what the alternator has left after the loads charges the battery,
        // tapering as it fills; more load than the alternator makes comes
        // out of the battery
        const spare = altA - load;
        const charge = spare >= 0 ? spare * (1 - bus.soc) * 4 : spare;
        bus.amps = Math.max(-load, Math.min(altA, charge));
        bus.soc = Math.min(1, Math.max(0, bus.soc + bus.amps * dt / 3600 / battAh));
      } else {
        bus.amps = -load;
        bus.soc = Math.max(0, bus.soc - load * dt / 3600 / battAh);
        bus.V = bus.vBatt();
        // a cranking starter pulls the bus down hard
        if (cranking && bus.V > 0) bus.V = Math.max(0, bus.V - 2.5);
      }
      bus.ok = bus.V >= ELEC_MIN_V;
      bus.starterOk = bus.V >= ELEC_CRANK_V;
      return bus;
    },
  };
  return bus;
}
