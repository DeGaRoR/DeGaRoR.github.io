// _ap_smooth_lib.js (G3300, AP-ADAPT) - THE SMOOTHNESS MEASURE: one leg flown by a host (tools/_tour_lib.js gameHost),
// stepped as the worker steps it, and judged on what the user SAW (18 Oct, Rufus B and the Mosquito: "it can't keep it
// straight as soon as the tail lifts up when rolling, and it struggles a lot maintaining altitude"):
//   roll    the heading off the line-up heading on the take-off roll, the worst |dpsi| and the worst after tail-up, and
//           the rudder's reversals per minute on the roll
//   level   the height against the pilot's own published plan (ap.intent.h) on the cruise legs, airborne, 40 m agl up,
//           the plan steady (|dh/dt| < 0.3 m/s): rms and peak; and the vertical speed's rms there
//   active  the surfaces' reversals per minute (pilot_trace's G630 count: a turn of the motion after > 0.03 rad) per group
//   land    the touchdown speed over the stall the sheet carries (ap.report.landing.VoverVs), the sink
'use strict';
const ACT_H = 0.03;
const GROUP = { ROLL: 'roll', LIFTOFF: 'roll', CLIMB: 'climb', FLARE: 'land', ROLLOUT: 'land' };
const LEVEL = new Set(['ENROUTE', 'INBOUND', 'TURNBACK', 'ROUTE', 'CROSSWIND', 'DOWNWIND', 'LOITER']);
const wrap = a => { while (a > 180) a -= 360; while (a < -180) a += 360; return a; };
const rms = a => a.length ? Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length) : null;
const r2 = v => v == null || !isFinite(v) ? null : Math.round(v * 100) / 100;

function flyAndMeasure(H, o) {
  const sim = H.sim, max = (o && o.max) || 900;
  H.queueCmd({ cmd: 'start' });
  const act = {}, rows = [];
  const actStep = (g, k, v) => {
    const G = act[g] || (act[g] = { n: 0, da: { r: 0, d: 0, x: null }, dr: { r: 0, d: 0, x: null }, de: { r: 0, d: 0, x: null } });
    const R = G[k];
    if (R.x == null) { R.x = v; return; }
    const dv = v - R.x;
    if (R.d === 0) { if (Math.abs(dv) > ACT_H) { R.d = Math.sign(dv); R.x = v; } }
    else if (R.d * dv > 0) R.x = v;
    else if (-R.d * dv > ACT_H) { R.r++; R.d = -R.d; R.x = v; }
  };
  let t = 0, psi0 = null, tailUpT = null, liftT = null, rollMax = 0, rollMaxTU = 0, ph0 = null, phases = [];
  let hP0 = null, lvl = [], lvlVs = [], lvlN = 0, stopped = false, maxBankLvl = 0;
  // G3306 (APSMOOTH's first HOME circuit, 20 Oct): each level leg is judged FROM ITS FIRST CAPTURE of the plan (within
  // CAP_M). The Jodel's crosswind leg is still the climb to circuit height (-36.8 -> -1.3 m at 3 m/s: 24 m rms) while its
  // downwind holds 0.44 m. A leg that never captures is judged whole (a hold that never arrives is not hidden). The part
  // before the capture (its seconds and worst gap) and the overshoot past the plan after it are kept as INFO
  // JUDGED too (the Pilot coordinator's review): the approach to the capture must CLOSE - its seconds <= the gap at its
  // start / CAP_CLOSE + CAP_SLACK, the gap never growing more than CAP_GROW past its smallest - and the overshoot past the
  // plan after the capture (the side away from where it came from; either side when it started captured) <= the gate's
  const CAP_M = 5, CAP_CLOSE = 1.0, CAP_SLACK = 30, CAP_GROW = 10;
  let legPh = null, legCap = false, legPre = [], legSide = 0, preS = 0, preMax = 0, overshoot = 0, uncapS = 0;
  const capBreach = [];
  const closeLeg = () => {
    if (legPre.length) {
      const g0 = Math.abs(legPre[0].e), sec = legPre.length / 60;
      let gMin = Infinity, grow = 0; for (const q of legPre) { const g = Math.abs(q.e); gMin = Math.min(gMin, g); grow = Math.max(grow, g - gMin); }
      if (legCap && sec > g0 / CAP_CLOSE + CAP_SLACK) capBreach.push(legPh + ': ' + r2(sec) + ' s to capture a ' + r2(g0) + ' m gap (allowed ' + r2(g0 / CAP_CLOSE + CAP_SLACK) + ' s)');
      if (grow > CAP_GROW) capBreach.push(legPh + ': the gap grew ' + r2(grow) + ' m before the capture (allowed ' + CAP_GROW + ')');
    }
    if (!legCap && legPre.length) { for (const q of legPre) { lvl.push(q.e); lvlVs.push(q.vs); lvlN++; maxBankLvl = Math.max(maxBankLvl, q.b); } uncapS += legPre.length / 60; }
    else if (legCap) { preS += legPre.length / 60; for (const q of legPre) preMax = Math.max(preMax, Math.abs(q.e)); }
    legPre = []; legCap = false; legSide = 0; };
  for (let k = 0; k < 60 * max; k++) {
    H.step(); t += 1 / 60;
    const ap = H.ap, ph = ap.phase, m = ap._m || {}, D = ap.dbg || {};
    if (ph !== ph0) { phases.push(ph + '@' + t.toFixed(1)); ph0 = ph; }
    const onG = !!m.onGround;
    const g = GROUP[ph] || (LEVEL.has(ph) ? 'level' : (ph === 'FINAL' || ph === 'BASE' ? 'appr' : null));
    if (g && !(g === 'roll' && !onG && ph === 'LIFTOFF' && liftT != null)) {
      act[g] = act[g] || null; actStep(g, 'da', sim.ctl.da || 0); actStep(g, 'dr', sim.ctl.dr || 0); actStep(g, 'de', sim.ctl.de || 0);
      act[g].n++;
    }
    if (ph === 'ROLL' && psi0 == null && m.hdg != null) psi0 = m.hdg;
    if (psi0 != null && liftT == null && (ph === 'ROLL' || ph === 'LIFTOFF')) {
      if (!onG && ph === 'LIFTOFF') liftT = t;
      else {
        const dpsi = Math.abs(wrap(m.hdg - psi0));
        rollMax = Math.max(rollMax, dpsi);
        if (D.tailUp && tailUpT == null) tailUpT = t;
        if (tailUpT != null) rollMaxTU = Math.max(rollMaxTU, dpsi);
      }
    }
    const hP = ap.intent && ap.intent.h;
    if (ph !== legPh) { closeLeg(); legPh = ph; }
    if (LEVEL.has(ph) && !onG && m.agl > 40 && hP != null && isFinite(hP)) {
      const dh = hP0 == null ? 0 : (hP - hP0) * 60;
      if (Math.abs(dh) < 0.3) {
        const e = m.alt - hP;
        if (!legCap && Math.abs(e) < CAP_M) { legCap = true; legSide = legPre.length ? Math.sign(legPre[0].e) : 0; }
        if (legCap) { lvl.push(e); lvlVs.push(m.vs); lvlN++; maxBankLvl = Math.max(maxBankLvl, Math.abs(m.bank || 0)); overshoot = Math.max(overshoot, legSide ? -legSide * e : Math.abs(e)); }
        else legPre.push({ e, vs: m.vs, b: Math.abs(m.bank || 0) });
      } else closeLeg();   // the plan stepped (a new height asked - the crosswind's first row still carries the climb's): a new capture
    }
    hP0 = hP;
    // G3305: the speed the energy loop asks (TECS Vc: iasF + the adaptations), the air's velocity at the CG (sim.out)
    const extra = () => { const tc = D.tecs || {}, so = sim.out || {}; return [r2(tc.Vc), r2(so.windX), r2(so.windZ)]; };
    if (k % 6 === 0) {
      // G3304: where, and (o.terrain: the world) the highest ground 1500 m ahead along the leg flown (43 legAlt's own look:
      // seven samples, the leg's direction A->B) - the floor the circuit legs' height is raised to
      let fl = null;
      if (o && o.terrain && /^(CROSSWIND|DOWNWIND|BASE)$/.test(ph) && ap.legs && ap.legs[ap.legI] && ap.legs[ap.legI].A) {
        const L = ap.legs[ap.legI], dx = L.B[0] - L.A[0], dz = L.B[1] - L.A[1], ln = Math.hypot(dx, dz) || 1e-9, ux = dx / ln, uz = dz / ln;
        let h = -1e9; for (let q = 0; q <= 6; q++) { const d = 1500 * q / 6; h = Math.max(h, o.terrain(m.x + ux * d, m.z + uz * d)); }
        fl = r2(h);
        const rem = (L.B[0] - m.x) * ux + (L.B[1] - m.z) * uz;
        rows.push([r2(t), ph, onG ? 1 : 0, D.tailUp ? 1 : 0, r2(m.hdg), r2(m.ias), r2(m.alt), r2(hP), r2(m.agl), r2((m.pitch || 0) * 57.3), r2((m.bank || 0) * 57.3), r2(m.vs), r2(sim.ctl.da), r2(sim.ctl.de), r2(sim.ctl.dr), r2(sim.ctl.thr), r2(m.x), r2(m.z), fl, r2(rem), ...extra()]);
      } else rows.push([r2(t), ph, onG ? 1 : 0, D.tailUp ? 1 : 0, r2(m.hdg), r2(m.ias), r2(m.alt), r2(hP), r2(m.agl), r2((m.pitch || 0) * 57.3), r2((m.bank || 0) * 57.3), r2(m.vs), r2(sim.ctl.da), r2(sim.ctl.de), r2(sim.ctl.dr), r2(sim.ctl.thr), r2(m.x), r2(m.z), null, null, ...extra()]);
    }
    if (ph === 'STOPPED' && liftT != null) { stopped = true; break; }
  }
  closeLeg();
  const ap = H.ap, L = ap.report && ap.report.landing;
  const actOut = {};
  for (const [g, G] of Object.entries(act)) { if (!G) continue; const mins = Math.max(0.5, G.n / 3600); actOut[g] = { s: Math.round(G.n / 60), da: r2(G.da.r / mins), dr: r2(G.dr.r / mins), de: r2(G.de.r / mins) }; }
  const mean = lvl.length ? lvl.reduce((s, v) => s + v, 0) / lvl.length : 0;
  return {
    stopped, t: r2(t), phases,
    roll: { hdgMax: r2(rollMax), hdgMaxTailUp: r2(rollMaxTU), tailUpT: r2(tailUpT), liftT: r2(liftT) },
    level: { s: Math.round(lvlN / 60), hRms: r2(rms(lvl)), hStd: r2(rms(lvl.map(v => v - mean))), hPeak: r2(lvl.reduce((s, v) => Math.max(s, Math.abs(v)), 0)), vsRms: r2(rms(lvlVs)), bankMax: r2(maxBankLvl * 57.3),
             preS: r2(preS), preMax: r2(preMax), overshoot: r2(overshoot), uncapS: r2(uncapS), capBreach },   // (G3306: before the capture, past the plan after it, legs never captured; capBreach judged)
    active: actOut,
    // (VoverVs: pilot_trace's own - the landing flap's stall when the flaps land, else the clean one)
    land: L ? Object.assign(JSON.parse(JSON.stringify(L)), (() => { const d = H.def, G = d && d.params && d.params.gen, FS = d && d.params.flaps;
      const VsL = G ? ((FS && (FS.ldg ?? 1) > 0 && G.VsFlap) ? G.VsFlap : G.Vs) : null; return { VoverVs: VsL && L.V ? r2(L.V / VsL) : null }; })()) : null,
    verdicts: (ap.report && ap.report.verdicts || []).map(v => v.code),
    verdictNotes: (ap.report && ap.report.verdicts || []).map(v => Math.round(v.t || 0) + ' ' + v.code + ': ' + (v.note || '')),   // (G3305: the go-arounds' reasons)
    rows, cols: 't,ph,onG,tailUp,hdg,V,alt,hP,agl,pitch,bank,vs,da,de,dr,thr,x,z,ground1500,legRem,Vc,windX,windZ',
    appr: ap.report && ap.report.appr ? JSON.parse(JSON.stringify(ap.report.appr)) : null, stab: ap.report && ap.report.stab ? JSON.parse(JSON.stringify(ap.report.stab)) : null,
    gsDef: H.def && H.def.params && H.def.params.ap ? H.def.params.ap.gs : null,
  };
}
module.exports = { flyAndMeasure };
