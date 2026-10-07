// accept_rec.js - THE ACCEPTANCE LEG ON THE PAGE (G2273, ACCEPT; futureDesigns/GAME-2026-10-06.md §6.2).
//
// A THIN WRAPPER over 72_accept.js. The leg (the procedure on the AP box, the recorder, the measurement, the signed
// record) is the core's and runs WHERE THE PILOT RUNS: on the page's own sim when the flight is inline (?simw=0), on
// the physics thread otherwise (sim_link.js accept() -> sim_host.js 'accept': the same acceptLegStart there). Either
// way the leg publishes its state on the pilot as `ap.accept` (the worker's copy reaches the page's view with the
// pilot's other fields), and this file:
//   - starts it: window.ACCEPT_REC.start({ legMin, thr, altAGL }) - in the air, the autopilot flying (the hand is not
//     a stabilised cruise), the build's roll-out fingerprint (bench.js BENCH_FP_OUT) and the day as its signature's meta;
//   - ticks it each frame when it is the page's (app.js calls frame() beside the HUD's energy cell);
//   - SIGNS IT INTO THE BUILD'S LOGBOOK when a record appears: GARAGE_SPEC.log().accept (the envelope's `log`, beside
//     `flights`; G63: a result rides beside the spec, never inside it), once per signature, with a logbook note;
//   - aborts it when the flight ends (app.js logFlight) or the hand takes the controls;
//   - answers the plaque (plaqueLeg: the last valid leg under the live fingerprint, or withdrawn) and the contract
//     model (evidence / verdict: 72_accept acceptVerdict over this build's ledger, bench, legs and logbook rows).
// Nothing here measures anything: the numbers are the core's, the same ones GATE ACCEPT flies in node.
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  const P = () => window.FLIGHT_PROBE || null;
  const today = () => new Date().toISOString().slice(0, 10);
  const fpOut = () => { try { return (window.BENCH_FP_OUT && window.BENCH_FP_OUT()) || (window.BENCH_FP && window.BENCH_FP()) || null; } catch (e) { return null; } };
  const fpLive = () => { try { return window.BENCH_FP ? window.BENCH_FP() : null; } catch (e) { return null; } };
  const logOf = () => { try { const G = window.GARAGE_SPEC; return G && G.log ? G.log() : null; } catch (e) { return null; } };
  let inline = null;          // the page's own leg (no physics worker)
  let signed = {};            // the signatures already written this session
  let lastWhy = '';

  const running = ap => { const A = ap && ap.accept; return !!A && !A.record && A.stage !== 'done' && A.stage !== 'aborted'; };
  function worker() { const S = window.FLYDIY_SIMW; return S && S.live && S.live() ? S : null; }

  // -> { ok, where?, why? }
  function start(opts) {
    opts = opts || {};
    const F = P();
    if (!F || typeof acceptLegStart !== 'function') return { ok: false, why: (lastWhy = 'no flight to fly the leg on') };
    const ap = F.ap(), sim = F.sim(), def = F.def(), W = F.world ? F.world() : null;
    if (!ap || !sim || !def) return { ok: false, why: (lastWhy = 'no flight to fly the leg on') };
    if (F.over && F.over()) return { ok: false, why: (lastWhy = 'the flight is over') };
    if (F.manual && F.manual()) return { ok: false, why: (lastWhy = 'the hand is flying: the autopilot flies the acceptance leg') };
    if (running(ap) || inline) return { ok: false, why: (lastWhy = 'a leg is already being flown') };
    const m = typeof ap.instruments === 'function' ? ap.instruments() : (ap._m || null);
    if (!m || m.onGround) return { ok: false, why: (lastWhy = 'in the air first: the leg is a cruise') };
    // the declared height: altAGL over the ground under the aeroplane, never below where it already is
    const gH = W && typeof W.terrainH === 'function' ? W.terrainH(m.x, m.z) : 0;
    const altAGL = opts.altAGL != null ? opts.altAGL : ACCEPT_RULES.altAGL;
    const o = { legMin: opts.legMin, thr: opts.thr, reserveMin: opts.reserveMin, resume: opts.resume,
                alt: opts.alt != null ? opts.alt : Math.max(m.alt, gH + altAGL),
                meta: { fp: fpOut(), when: today(), from: (ap.route && ap.route.from && (ap.route.from.id || ap.route.from)) || null } };
    const S = worker();
    if (S && S.accept) {
      if (!S.accept({ op: 'start', o })) return { ok: false, why: (lastWhy = 'the physics thread is not flying yet') };
      lastWhy = '';
      return { ok: true, where: 'worker' };
    }
    inline = acceptLegStart(sim, ap, def, o);
    lastWhy = '';
    return { ok: true, where: 'page' };
  }
  function abort(why) {
    const F = P(), ap = F && F.ap();
    if (inline) { inline.abort(ap, why || 'aborted'); inline = null; }
    else if (ap && running(ap)) { const S = worker(); if (S && S.accept) S.accept({ op: 'abort', why: why || 'aborted' }); }
    frame();
  }
  // app.js: once a frame, beside the HUD
  function frame() {
    const F = P(); if (!F) return;
    const ap = F.ap(); if (!ap) return;
    if (inline) {
      if (F.manual && F.manual()) inline.abort(ap, 'the hand took the controls');
      else inline.tick(F.sim(), ap);
      if (inline.stage === 'done' || inline.stage === 'aborted') inline = null;
    }
    const A = ap.accept;
    if (A && A.record && A.record.sig && !signed[A.record.sig]) sign(A.record);
  }
  // THE SIGNATURE INTO THE LOGBOOK: the record as the core signed it (its fingerprint the roll-out's), once
  function sign(rec) {
    signed[rec.sig] = true;
    const lg = logOf();
    if (!lg) return false;
    if (!Array.isArray(lg.accept)) lg.accept = [];
    if (lg.accept.some(r => r && r.sig === rec.sig)) return false;
    lg.accept.push(JSON.parse(JSON.stringify(rec)));
    try {
      const G = window.GARAGE_SPEC;
      if (G && G.note) G.note({ id: 'accept', ok: !!rec.valid,
        verdict: rec.valid ? 'proved in flight: ' + rec.tasKmh + ' km/h TAS, ' + rec.enduranceMin + ' min'
                           : 'leg refused: ' + ((rec.why || [])[0] || 'not valid') });
    } catch (e) {}
    try { if (typeof window.ACCEPT_CHANGED === 'function') window.ACCEPT_CHANGED(rec); } catch (e) {}
    return true;
  }
  // app.js logFlight: the flight ended - a leg still flying is refused, its record signed as such
  function flightEnd() { const F = P(), ap = F && F.ap(); if (inline || (ap && running(ap))) abort('the flight ended before the leg did'); }
  function state() {
    const F = P(), ap = F && F.ap(), A = ap && ap.accept;
    return { stage: A ? A.stage : null, alt: A ? A.alt : null, tRec: A ? A.tRec : null, legMin: A ? A.legMin : null,
             where: inline ? 'page' : (A && running(ap) ? 'worker' : null), why: lastWhy, record: A ? A.record : null };
  }
  const legs = () => { const lg = logOf(); return (lg && Array.isArray(lg.accept)) ? lg.accept : []; };
  // the plaque's row: the last valid leg under the LIVE fingerprint, { withdrawn } under another, null with none
  function plaqueLeg(fp) { return typeof acceptPlaqueLeg === 'function' ? acceptPlaqueLeg(legs(), fp !== undefined ? fp : fpLive()) : null; }
  // THE CONTRACT MODEL'S DOOR: this build's evidence and the verdict over a contract's criteria
  function evidence(extra) {
    const F = P(), def = F && F.def ? F.def() : null;
    let bench = null;
    try { const st = window.BENCH_STATE ? window.BENCH_STATE() : null; bench = st ? st.results : null; } catch (e) {}
    const lg = logOf();
    return acceptEvidence(def, Object.assign({ bench, legs: legs(), flights: (lg && lg.flights) || [], fp: fpLive(),
                                               cert: def && def.cert ? { limit: def.cert.limit, ult: def.cert.ult } : null }, extra || {}));
  }
  const verdict = (crit, extra) => acceptVerdict(crit, evidence(extra));
  window.ACCEPT_REC = { start, abort, frame, flightEnd, state, legs, plaqueLeg, evidence, verdict, sign };
})();
