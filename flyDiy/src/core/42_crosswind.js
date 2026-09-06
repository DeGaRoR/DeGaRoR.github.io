// ============================================================
// THE CROSSWIND LIMIT (G193.2, 2026-09-05, the user: "Put the crosswind
// limit on the plaque").
//
// A take-off roll in a crosswind is the one certificate number that needs
// the PILOT: the swing is the tailwheel unloading and the rudder holding
// what it can, so genShakedown's still-air integrals cannot measure it. It
// is measured the way the test flight measures the landing run — a second
// sim, the test pilot, offscreen — and it rides on the same report.
//
// THE DEFINITION. The crosswind limit is the strongest crosswind, from the
// right (+z, the side GATE TAKEOFF found the worse on the twin), in which
// the test pilot keeps the take-off roll between the base strip's painted
// edge lines (|cross-track| <= R.half - 2.5, the lines 25_airfield paints)
// and gets airborne, without a rejected take-off. The heading as the wheels
// leave is REPORTED beside it, not judged: a tail-up taildragger weathervanes
// into wind on its scrubbing mains and a flying aeroplane crabs on purpose,
// and neither is what the strip's edge cares about.
// The band is the STRIP'S, so the number means "this aeroplane leaves this
// field straight in this much wind" — the plaque's own runway, the way the
// take-off run is judged against the strip's length. G193.1 recorded why no
// pilot gain moves it: the rudder is at its stop through the swing and the
// tail is lifted by the aeroplane; the number belongs to the builder (mains,
// fin, thrust line).
//
// THE MEASUREMENT. A ladder (2, 4, 6, 8, 10 m/s) until the first failure,
// then a bisection between the last pass and that failure to 0.5 m/s; a
// failure on the first rung adds a calm-air departure so "cannot take off
// straight at all" is measured rather than assumed. Four to seven departures
// from the runway (no taxi), ~40 s of sim each — MEASURED 17 s of wall clock
// for the ultralight fixture (4 departures) and 20 s for the default
// aeroplane in node, budgeted per poll like the circuit so the panel never
// freezes. Above the cap the limit is reported as "> cap": the strip has no
// wind that strong on offer. The heading is judged as the wheels leave, not
// at the safe height, because a crosswind climb is crabbed on purpose.
//
// `makeCrosswindProbe(def, opts)` is the steppable form the page polls;
// `genCrosswindLimit(def, opts)` runs it to the end for the gates. Both are
// pure of THREE and of the page. opts: { world, band, step, res, cap, maxS }.
// ============================================================
function makeCrosswindProbe(def, opts) {
  opts = opts || {};
  const world = opts.world || makeWorld();
  const a = world.aerodromes[0];
  const site = (typeof siteOf === 'function') ? siteOf(a.id || 'HOME') : null;
  const R = siteRunway(a);
  const band = opts.band != null ? opts.band : Math.max(3, R.half - 2.5);
  const hSafe = (def.params && def.params.ap && def.params.ap.hSafe) || 8;
  const maxS = opts.maxS || 150;
  const step = opts.step || 2;
  const res = opts.res || 0.5;
  const cap = opts.cap || 10;
  const runs = [];
  let cur = null, lo = 0, hi = null, calmTried = false, result = null;

  function start(w) {
    if (world.setWind) world.setWind({ base: [0, 0, w], gust: 0 });
    const sim = makeSim(def, world);
    sim.reset(0);
    for (let i = 0; i < 600; i++) sim.step(1 / 60);       // parked settle
    placeAtAerodrome(sim, a);
    const ap = makePilot(sim, def, world);
    ap.setRoute(a, a);
    ap.departFrom(a, a, site);
    cur = { w, sim, ap, t: 0, roll: 0, e: 0, fin: null };
  }
  // one 1/60 s step of the departure in flight; true when it is decided
  function stepOne() {
    const c = cur;
    c.ap.update(1 / 60); c.sim.step(1 / 60); c.t += 1 / 60;
    const d = c.ap.dbg || {};
    if (c.ap.phase === 'ROLL') c.roll = Math.max(c.roll, Math.abs(d.z || 0));
    // the heading is read AS THE WHEELS LEAVE: once flying in a crosswind the
    // pilot crabs into it on purpose (11 deg at 4 m/s across a 20 m/s climb),
    // which is airmanship, not a swing
    if (c.ap.phase === 'LIFTOFF' && c.eLift == null) c.eLift = Math.abs(d.e || 0);
    if (c.sim.stats && c.sim.stats().bad) { c.fin = { ok: false, why: 'broke-up' }; return true; }
    const rep = c.ap.report;
    if (rep && (rep.outcome === 'rejected-takeoff' ||
        (rep.verdicts && rep.verdicts.length &&
         rep.verdicts[rep.verdicts.length - 1].code === 'rejected-takeoff'))) {
      c.fin = { ok: false, why: 'rejected-takeoff' }; return true;
    }
    if ((c.ap.phase === 'LIFTOFF' || c.ap.phase === 'CLIMB') && (d.agl || 0) > hSafe) {
      c.e = c.eLift != null ? c.eLift : Math.abs(d.e || 0);
      // THE BAND IS THE VERDICT; the heading is reported, not judged. As the
      // wheels leave, a tail-up taildragger has weathervaned into wind on its
      // scrubbing mains (the ultralight: 13 deg at 2 m/s, the swing G193.1
      // recorded), and once flying the pilot crabs on purpose (the default
      // aeroplane: 10 deg at 4 m/s). What the strip cares about is its edge.
      const inBand = c.roll <= band;
      c.fin = { ok: inBand, why: inBand ? null : 'off the edge line' };
      return true;
    }
    if (c.ap.phase === 'STOPPED') { c.fin = { ok: false, why: 'stopped' }; return true; }
    if (c.t > maxS) { c.fin = { ok: false, why: 'never airborne' }; return true; }
    return false;
  }
  // the next rung, or the verdict
  function plan() {
    if (hi == null) {
      const w = runs.length ? lo + step : step;
      if (w > cap + 1e-9) return finish(null);
      return w;
    }
    if (hi - lo <= res + 1e-9) return finish(lo);
    return Math.round(((lo + hi) / 2) / res) * res;
  }
  function finish(limit) {
    const at = limit == null ? runs.filter(r => r.ok).slice(-1)[0]
             : runs.filter(r => r.ok && Math.abs(r.w - limit) < 1e-9)[0] || null;
    const first = runs.filter(r => !r.ok).sort((p, q) => p.w - q.w)[0] || null;
    result = { limit, cap, band: Math.round(band * 10) / 10,
               roll: at ? at.roll : null, e: at ? at.e : null,
               failW: first ? first.w : null, failWhy: first ? first.why : null,
               failRoll: first ? first.roll : null,
               runs: runs.map(r => ({ w: r.w, ok: r.ok, roll: r.roll, e: r.e, why: r.why })),
               side: '+z' };
    return null;
  }
  function record() {
    const c = cur, f = c.fin;
    runs.push({ w: c.w, ok: f.ok, roll: Math.round(c.roll * 100) / 100,
                e: Math.round(c.e * 1000) / 1000, why: f.why });
    if (f.ok) lo = Math.max(lo, c.w);
    else {
      hi = hi == null ? c.w : Math.min(hi, c.w);
      // a failure on the first rung: is calm air even straight?
      if (runs.length === 1 && !calmTried) { calmTried = true; cur = null; return 0; }
    }
    cur = null;
    return null;
  }
  // poll(ms): step for up to `ms` of wall clock; { done:false, w, frac } or
  // { done:true, result }
  function poll(ms) {
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const now = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    while (!result) {
      if (!cur) {
        const w = plan();
        if (result) break;
        start(w);
      }
      let decided = false;
      for (let i = 0; i < 60 && !decided; i++) decided = stepOne();
      if (decided) {
        const calm = record();
        if (calm === 0) { start(0); }
      }
      if (ms != null && now() - t0 >= ms) break;
    }
    if (result) return { done: true, result };
    return { done: false, w: cur ? cur.w : 0, t: cur ? cur.t : 0,
             frac: Math.min(0.95, runs.length / 6) };
  }
  return { poll, get result() { return result; }, band, cap };
}

// the whole measurement at once (the gates)
function genCrosswindLimit(def, opts) {
  const p = makeCrosswindProbe(def, opts);
  let r;
  do { r = p.poll(null); } while (!r.done);
  return r.result;
}
