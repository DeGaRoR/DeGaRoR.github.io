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
  const loads = (cfg.loads || []).map(l => ({ key: l.key, amps: Math.max(0, +l.amps || 0) }));
  const bus = {
    master: battAh > 0 || altA > 0, alt: altA > 0, on: {},
    soc: 1, V: 0, amps: 0, loadA: 0, altOn: false, ok: false, starterOk: false,
    battAh, altA, cutIn,
    // the battery's open-circuit voltage from its charge, a straight line
    // between the two anchors (the real curve is flatter in the middle;
    // the gauge cannot tell)
    vBatt() { return battAh > 0 && bus.soc > 0
      ? ELEC_V_LOW + (ELEC_V_FULL - ELEC_V_LOW) * Math.min(1, Math.max(0, (bus.soc - 0.2) / 0.8)) : 0; },
    setLoad(key, amps) {
      const l = loads.find(q => q.key === key);
      if (l) l.amps = Math.max(0, +amps || 0); else loads.push({ key, amps: Math.max(0, +amps || 0) });
    },
    loads: () => loads.map(l => ({ key: l.key, amps: l.amps, on: bus.on[l.key] !== false })),
    step(dt, rpm, cranking) {
      let load = 0;
      if (bus.master) {
        for (const l of loads) if (bus.on[l.key] !== false) load += l.amps;
        if (cranking) load += starterA;
      }
      bus.loadA = load;
      bus.altOn = !!(bus.master && bus.alt && altA > 0 && rpm >= cutIn);
      if (!bus.master || battAh <= 0) {
        // no master: nothing flows. A running alternator with no battery
        // (a generator-only aeroplane) still carries its loads
        bus.altOn = !!(bus.alt && altA > 0 && rpm >= cutIn && battAh <= 0 && bus.master);
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
