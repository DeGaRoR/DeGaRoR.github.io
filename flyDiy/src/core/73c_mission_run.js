// ===========================================================================
// THE MISSION RUNTIME (MISSIONS-P1/P2) — what a mission record (73b_missions.js
// read it into 73_contracts.js's record) needs at run time, beyond today's
// stop-by-stop contract: the aircraft order's preferences, its delivery (the
// airframe sold to the client, the blueprint kept) and its profit; the failure
// rules; the timers on step groups; the IN-FLIGHT TRACKER (point places, gates,
// rings: hit between two samples of the flight); the at-stop judges of the new
// verbs (photo pass park wait talk); the map's marker data.
// futureDesigns/MISSIONS-2026-10-25.md §3.1-§3.6, §7. GATE MISSIONS holds it.
// ===========================================================================
// THE SEAMS (pure everywhere; the page feeds samples and draws):
//   the flight   the page runs missionTrackNew(rec, live) at departure for each accepted contract with in-flight
//                objectives, missionTrackStep(T, sample) every sample (sample: { t s, x, z, y m MSL, agl? m }), shows
//                the step's events (a photo's shutter + its line, a gate passed, a split), and hands
//                missionTrackEvidence(T) in the stop record (`tracks: { <contract id>: evidence }`, 75_ careerStopRecord)
//   the stop     73_ contractSubOnStop asks missionStepOnStop for the new verbs and for a fly to a point; 74_
//                contractOnStop asks missionTimerOnSub for a step a timer stops on (the medal, the target); 74_
//                careerOnStop asks missionRulesJudge first (a mission failed: careerFail, offered again: the restart)
//   the order    73_ contractSubOnStop asks missionPrefsJudge of a delivery (the delivered spec on the stop record);
//                74_ careerComplete hands the airframe over (contractDelivery) and states the profit (contractProfit)
//   the map      missionMarkers(rec, live) -> what the map and the 3-D world draw (a local session draws them)
// HEADINGS are compass degrees on the island's map: 0 = north = -z, 90 = east = +x (MAP_PACK's rule: -z is north).
// (COMPETE, 13 Nov) the scoring: STOL lines (msrStolStep, missionScoreOnSub), 3-D gates (a ring's pitch, the attitude
// asked at a pass: missionAttJudge), regularity laps, the multi-leg course, the fixed ghost - HANDOVER COMPETE-SCORE.
// The sample may also carry gnd (the wheels on the ground), v (m/s), hdg / pitch / roll (deg).
// ===========================================================================

const MISSION_RUN_V = 1;
// the in-flight verbs: hit between two samples of the flight, judged at the next stop from the stop's evidence
const MISSION_FLIGHT_KINDS = ['pt', 'gate', 'ring'];
const msrClone = o => JSON.parse(JSON.stringify(o));
const msrNum = v => typeof v === 'number' && isFinite(v);
const msrDeg = (dx, dz) => ((Math.atan2(dx, -dz) * 180 / Math.PI) + 360) % 360;   // the compass heading of a motion
const msrDiff = (a, b) => { const d = Math.abs(((a - b) % 360 + 540) % 360 - 180); return d; };
const msrKind = p => (!p || typeof p !== 'object' ? null : ['pt', 'gate', 'ring', 'spot', 'site', 'field'].find(k => p[k] != null) || null);
// is a sub an in-flight objective (its place a point, a gate or a ring)
const missionInFlight = s => !!s && ['pass', 'photo', 'fly'].includes(s.do) && MISSION_FLIGHT_KINDS.includes(msrKind(s.place));

// ---- THE PREFERENCES (§3.6, §7: each item bonus | mandatory) ------------------------------------------------------------
// a spec's value for a preference kind (73b MISSION_PREF_KINDS' `of`), or null
function missionPrefOf(spec, k) {
  const S = spec || {}, E = Array.isArray(S.engines) ? S.engines : [];
  if (k === 'engines') return E.length || null;
  if (k === 'thrust') { if (!E.length) return null; const e = E[0]; return (e.mount === 'pusher' || e.aim === 'pusher') ? 'pusher' : 'tractor'; }
  if (k === 'wing') return (S.wing && S.wing.position) || null;
  if (k === 'tail') return (S.tail && S.tail.type) || null;
  if (k === 'gear') return typeof stripGear === 'function' && stripGear(S) === 'floats' ? 'floats' : ((S.gear && S.gear.type) || null);
  if (k === 'canopy') return (S.cabin && S.cabin.canopy && S.cabin.canopy.style) || null;
  if (k === 'suspension') return (S.gear && S.gear.suspension) || null;
  return null;
}
// a delivered spec against the order's preferences -> { ok, why, got: { 'pref.<k>': true }, pct, rows }. A mandatory one
// unmet refuses the delivery; a bonus one met adds its pct to the pay (73_ contractPayTotal reads got)
function missionPrefsJudge(prefs, spec) {
  const rows = [], got = {}, miss = [];
  let pct = 0;
  for (const p of prefs || []) {
    const v = missionPrefOf(spec, p.k), met = v != null && String(v) === String(p.v);
    rows.push({ k: p.k, want: p.v, got: v, need: p.need, met });
    if (met) { got['pref.' + p.k] = true; if (p.need === 'bonus') pct += p.pct || 0; }
    else if (p.need === 'mandatory') miss.push(p.k + ' ' + p.v + ' (built: ' + (v == null ? 'none' : v) + ')');
  }
  return { ok: !miss.length, why: miss.length ? 'a must: ' + miss.join(', ') : '', got, pct, rows };
}

// ---- THE DELIVERY AND THE PROFIT (§7: "we paid to manufacture the plane; it is sold to the client at a higher price
// and is no longer ours"; "the BLUEPRINT is saved automatically") -----------------------------------------------------------
// an order's delivery: the record's, else the build kind's default (sold, the blueprint kept); null for anything else
// THE HAND-OVER WAITS FOR THE PAGE (Game + A0, 27 Oct): selling the airframe takes it out of the save, so until the page
// also takes it out of the world and saves its blueprint (MUST-WIRE 5) nothing is sold - an order is delivered, paid
// and completed, and the airframe stays ours. The page calls missionHandoverWired(true) once it does both; opts.wired
// overrides it for one call (the gate, the editor's card).
let MISSION_HANDOVER_WIRED = false;
function missionHandoverWired(on) { if (on !== undefined) MISSION_HANDOVER_WIRED = !!on; return MISSION_HANDOVER_WIRED; }
function contractDelivery(rec, opts) {
  if (!rec || rec.kind !== 'build') return null;
  const D = rec.delivery && typeof rec.delivery === 'object' ? rec.delivery : {};
  const wired = opts && opts.wired != null ? !!opts.wired : MISSION_HANDOVER_WIRED;
  return { sold: wired && D.sold !== false, blueprint: wired && D.blueprint !== false, wired };
}
// the profit line: what the client pays less what the airframe cost us (the economy's price when it was made: 76_
// econMaterialise's `paid`); cost unknown -> profit null
const contractProfit = (pay, cost) => ({ pay, cost: msrNum(cost) ? cost : null, profit: msrNum(cost) ? pay - cost : null });
// the blueprint's name: the career slot's without its career tag (74_ CAREER_SLOT_TAG ' @<id>')
const missionBlueprintName = slot => String(slot || '').replace(/ @[\w.-]+$/, '');

// ---- THE FAILURE RULES (§3.4: a full crash, anyone harmed, the freight harmed -> fail; damage assessed) ---------------------
// the stop record's facts: wrecked / how 'crashed'; occ [{ name, band }] (34_occupant genOccWire's bands, 0 unharmed ..
// 4); freight { harmed } (or a wreck with a load aboard); structural { damaged, why }. -> { fail: '' | why, assess }
function missionRulesJudge(rec, stop) {
  const R = rec && rec.rules, S = stop || {};
  if (!R || typeof R !== 'object') return { fail: '', assess: null };
  const crashed = !!S.wrecked || S.how === 'crashed';
  if (R.crash === 'fail' && crashed) return { fail: 'the aeroplane crashed', assess: null };
  if (R.injury != null && R.injury !== 'ignore') {
    const B = typeof GEN_OCC !== 'undefined' && GEN_OCC.bands ? GEN_OCC.bands : null;
    let thr = R.injury === 'fail' ? 1 : (R.injury && R.injury.fail);
    if (typeof thr === 'string') thr = B ? B.indexOf(thr) : -1;
    const worst = Array.isArray(S.occ) ? S.occ.reduce((a, o) => Math.max(a, (o && msrNum(o.band)) ? o.band : 0), 0) : 0;
    if (thr >= 1 && worst >= thr) return { fail: 'someone aboard was hurt' + (B ? ' (' + B[worst].toLowerCase() + ')' : ''), assess: null };
  }
  if (R.freight === 'fail') {
    const L = S.load || {}, aboard = (L.kg || 0) > 0 || (Array.isArray(L.items) && L.items.length > 0);
    if ((S.freight && S.freight.harmed) || (crashed && aboard)) return { fail: 'the freight was damaged', assess: null };
  }
  if (R.strike === 'fail') {
    const ev = S.tracks && rec && S.tracks[rec.id], n = ev && Array.isArray(ev.strikes) ? ev.strikes.length : 0;
    if (n) return { fail: n === 1 ? 'a gate or a ring was hit' : n + ' gates or rings were hit', assess: null };
  }
  const dmg = S.structural && S.structural.damaged;
  if (R.damage === 'fail' && dmg) return { fail: 'the airframe was damaged' + (S.structural.why ? ' (' + S.structural.why + ')' : ''), assess: null };
  return { fail: '', assess: R.damage === 'assess' ? { damaged: !!dmg, why: (S.structural && S.structural.why) || null } : null };
}

// ---- THE TIMERS (§3.3: a group of steps timed from a start step to a stop step) --------------------------------------------
// the subs of a record in mission order (stage by stage), with their stage and index
const msrSubs = rec => [].concat(...((rec && rec.stages) || []).map((st, i) => (st.subs || []).map((s, j) => ({ s, i, j }))));
// a place's plan point (73_ contractPlaceXZ; a ring's centre; a site's position)
const msrXZ = (p, F) => (typeof contractPlaceXZ === 'function' ? contractPlaceXZ(p, F) : null);
// a timer's target in seconds: written, or { refKmh }: the steps' places from start to stop, in order, at that speed
function missionTimerTarget(rec, t, fields) {
  if (!t) return null;
  if (msrNum(t.target)) return t.target;
  if (!t.target || !msrNum(t.target.refKmh) || !(t.target.refKmh > 0)) return null;
  const L = msrSubs(rec), a = L.findIndex(x => x.s.id === t.start), b = L.findIndex(x => x.s.id === t.stop);
  if (a < 0 || b < a) return null;
  let d = 0, prev = null;
  for (const x of L.slice(a, b + 1)) {
    const q = msrXZ(x.s.place || x.s.to || x.s.at, fields);
    if (q && prev) d += Math.hypot(q[0] - prev[0], q[1] - prev[1]);
    if (q) prev = q;
  }
  return Math.round(d / (t.target.refKmh / 3.6));
}
// ONE STEP a timer STOPS on, done at a stop, judged from the flight's lap (stop.tracks[rec.id].timers): the medal (its
// best band), or the target to beat (no medals) - over it, or no lap timed, the step is NOT done (fly it again).
// r: contractSubOnStop's result -> the result (r itself when no timer stops on the step)
// (COMPETE) a timer may be a REGULARITY lap (regularity: true: the score is the deviation from its target, the medals'
// le in seconds off it; with no medals, within tol), and may race a FIXED GHOST (ghost { s, who?, splits? }: an authored
// rival lap, the same for every player - timer.ghost { s, beat, by }, by + behind it). A stop step also judges the
// mission's STOL lines and its COURSE (missionScoreOnSub).
const msrBand = (medals, v) => medals.slice().sort((a, b) => a.le - b.le).find(x => v <= x.le) || null;
function missionTimerOnSub(rec, sub, r, stop, fields) {
  if (!r || r.st !== 'done' || !sub || !sub.id) return r;
  const ev = stop && stop.tracks && stop.tracks[rec.id];
  for (const t of (rec && rec.timers) || []) {
    if (t.stop !== sub.id) continue;
    const E = ev && ev.timers && ev.timers[t.id];
    if (!E || !msrNum(E.s)) return { st: 'no', why: 'the ' + t.id + ' timer ran no lap (' + t.start + ' to ' + t.stop + ' in one flight)' };
    const target = missionTimerTarget(rec, t, fields), timer = Object.assign({ id: t.id, s: E.s, target, splits: E.splits || [] },
      E.pen ? Object.assign({ raw: E.raw, pen: E.pen, strikes: E.strikes || 0 }, E.atts ? { atts: E.atts } : {}) : {});
    const medals = Array.isArray(t.medals) && t.medals.length ? t.medals : null;
    if (t.regularity) {
      if (!msrNum(target)) return { st: 'no', why: t.id + ': a regularity lap with no target' };
      const dev = msrR1(Math.abs(E.s - target));
      timer.dev = dev;
      if (t.ghost && msrNum(t.ghost.s)) { const gd = msrR1(Math.abs(t.ghost.s - target)); timer.ghost = { s: t.ghost.s, dev: gd, beat: dev < gd, by: msrR1(dev - gd) }; }
      if (medals) {
        const m = msrBand(medals, dev);
        if (!m) return { st: 'no', why: t.id + ': ' + E.s + ' s, ' + dev + ' s off the ' + target + ' s asked; ' + Math.max(...medals.map(x => x.le)) + ' s off or less for a medal' };
        r = Object.assign({}, r, { medal: m.medal, timer });
      } else if (dev > t.tol) return { st: 'no', why: t.id + ': ' + E.s + ' s, ' + dev + ' s off the ' + target + ' s asked (' + t.tol + ' s allowed)' };
      else r = Object.assign({}, r, { timer });
      continue;
    }
    if (t.ghost && msrNum(t.ghost.s)) timer.ghost = { s: t.ghost.s, beat: E.s < t.ghost.s, by: msrR1(E.s - t.ghost.s) };
    if (medals) {
      const m = msrBand(medals, E.s);
      if (!m) return { st: 'no', why: t.id + ': ' + E.s + ' s, ' + Math.max(...medals.map(x => x.le)) + ' s or less for a medal' };
      r = Object.assign({}, r, { medal: m.medal, timer });
    } else if (msrNum(target) && E.s > target) return { st: 'no', why: t.id + ': ' + E.s + ' s, the target is ' + target + ' s' };
    else r = Object.assign({}, r, { timer });
  }
  return missionScoreOnSub(rec, sub, r, stop);
}
// (COMPETE) is a record scored at its stops beyond its timers (a STOL line, a course): the career's seam keys on
// rec.timers, and missionToContract gives such a record its (empty) timers list so the stop judges it
const missionScored = rec => !!rec && ((Array.isArray(rec.stol) && rec.stol.length > 0) || !!rec.course);
// ONE STEP a STOL line or the COURSE stops on, done at a stop: judged from the flight's evidence -> the result (r itself
// when nothing stops on the step). STOL: the measure (not measured, or a foul: not done - fly it again), its medal
// (le metres; none: not done) or its max, the ghost (smaller is better), r.scores [{ id, kind, m, short?, ghost? }]. THE
// COURSE (rec.course { timers: [one lap per leg, in leg order], medals?, ghost?: { s, who?, legs? } }): on the last
// lap's stop step, the result is the SUM of the legs' laps (each with its penalties) - this flight's lap, the earlier
// ones carried in the evidence (missionTrackNew's live.timers) - with its per-leg splits; the course's medal replaces the
// leg's; r.course { s, legs: [{ id, s, ghost? }], ghost? }
function missionScoreOnSub(rec, sub, r, stop) {
  if (!r || r.st !== 'done' || !sub || !sub.id || !rec) return r;
  const ev = stop && stop.tracks && stop.tracks[rec.id];
  for (const S of Array.isArray(rec.stol) ? rec.stol : []) {
    if (!S || S.stop !== sub.id) continue;
    const E = ev && ev.stol && ev.stol[S.id], what = S.kind === 'takeoff' ? 'take-off' : S.kind === 'spot' ? 'spot landing' : 'landing';
    if (!E) return { st: 'no', why: 'the ' + what + ' on the ' + S.id + ' line was not measured' };
    if (E.foul) return { st: 'no', why: 'the ' + what + ' on the ' + S.id + ' line touched down ' + Math.abs(E.td) + ' m short of it' };
    const score = Object.assign({ id: S.id, kind: S.kind, m: E.m }, E.short ? { short: true } : {});
    if (S.ghost && msrNum(S.ghost.m)) score.ghost = { m: S.ghost.m, beat: E.m < S.ghost.m, by: msrR1(E.m - S.ghost.m) };
    if (Array.isArray(S.medals) && S.medals.length) {
      const m = msrBand(S.medals, E.m);
      if (!m) return { st: 'no', why: S.id + ': ' + E.m + ' m, ' + Math.max(...S.medals.map(x => x.le)) + ' m or less for a medal' };
      r = Object.assign({}, r, { medal: m.medal, scores: (r.scores || []).concat([score]) });
    } else if (msrNum(S.max) && E.m > S.max) return { st: 'no', why: S.id + ': ' + E.m + ' m, ' + S.max + ' m allowed' };
    else r = Object.assign({}, r, { scores: (r.scores || []).concat([score]) });
  }
  const C = rec.course, ids = C && Array.isArray(C.timers) ? C.timers : [];
  const last = ids.length && (rec.timers || []).find(t => t.id === ids[ids.length - 1]);
  if (last && last.stop === sub.id) {
    const legs = [];
    for (let i = 0; i < ids.length; i++) {
      const E = ev && ev.timers && ev.timers[ids[i]], s = E && msrNum(E.s) ? E.s : ev && ev.course && msrNum(ev.course[ids[i]]) ? ev.course[ids[i]] : null;
      if (s == null) return { st: 'no', why: 'the course: leg ' + (i + 1) + ' (' + ids[i] + ') has no time' };
      const L = { id: ids[i], s }, G = C.ghost && Array.isArray(C.ghost.legs) ? C.ghost.legs[i] : null;
      if (msrNum(G)) L.ghost = msrR1(s - G);
      legs.push(L);
    }
    const course = { s: msrR1(legs.reduce((a, L) => a + L.s, 0)), legs };
    if (C.ghost && msrNum(C.ghost.s)) course.ghost = { s: C.ghost.s, beat: course.s < C.ghost.s, by: msrR1(course.s - C.ghost.s) };
    if (Array.isArray(C.medals) && C.medals.length) {
      const m = msrBand(C.medals, course.s);
      if (!m) return { st: 'no', why: 'the course: ' + course.s + ' s, ' + Math.max(...C.medals.map(x => x.le)) + ' s or less for a medal' };
      r = Object.assign({}, r, { medal: m.medal, course });
    } else r = Object.assign({}, r, { course });
  }
  return r;
}
// A TIMED GROUP IS FLOWN WHOLE: when a timer's stop step is not done at this stop, every step of its group (start .. stop,
// in this stage) done at this stop is not done either - else the start would be spent and the lap could never be flown
// again. Mutates and returns res (74_ contractOnStop's)
function missionTimerGroups(rec, stage, res) {
  const st = rec && rec.stages && rec.stages[stage];
  if (!st) return res;
  for (const t of (rec.timers || [])) {
    const a = st.subs.findIndex(s => s.id === t.start), b = st.subs.findIndex(s => s.id === t.stop);
    if (a < 0 || b < a || !res[b] || res[b].st === 'done' || res[b].st === 'was') continue;
    for (let j = a; j < b; j++) if (res[j] && res[j].st === 'done') res[j] = { st: 'no', why: res[b].why || ('the ' + t.id + ' lap is flown whole') };
  }
  return res;
}
// a whole stage's results (each step a timer stops on through missionTimerOnSub); mutates and returns res
function missionTimersOnStop(rec, stage, res, stop, fields) {
  const st = rec && rec.stages && rec.stages[stage];
  if (st) st.subs.forEach((s, j) => { res[j] = missionTimerOnSub(rec, s, res[j], stop, fields); });
  return res;
}

// ---- THE IN-FLIGHT TRACKER (§3.1: point places, gates, rings) -------------------------------------------------------------
// the alt band of a place against a sample: '' inside (or no band, or the sample lacks the height asked: an unknown
// refuses nothing), else why not
function msrAltWhy(alt, smp) {
  if (!alt) return '';
  const v = alt.ref === 'msl' ? smp.y : smp.agl;
  if (!msrNum(v)) return '';
  if (msrNum(alt.min) && v < alt.min) return 'too low (' + Math.round(v) + ' m ' + (alt.ref || 'agl') + ')';
  if (msrNum(alt.max) && v > alt.max) return 'too high (' + Math.round(v) + ' m ' + (alt.ref || 'agl') + ')';
  return '';
}
const msrLerp = (a, b, u) => { const o = { t: a.t + (b.t - a.t) * u, x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u };
  for (const k of ['y', 'agl']) if (msrNum(a[k]) && msrNum(b[k])) o[k] = a[k] + (b[k] - a[k]) * u; else if (msrNum(b[k])) o[k] = b[k];
  // (COMPETE) the attitude, when the page gives it: pitch straight, heading and roll the short way round
  for (const k of ['hdg', 'pitch', 'roll']) {
    if (!(msrNum(a[k]) && msrNum(b[k]))) { if (msrNum(b[k])) o[k] = b[k]; continue; }
    const d = k === 'pitch' ? b[k] - a[k] : ((b[k] - a[k]) % 360 + 540) % 360 - 180, v = a[k] + d * u;
    o[k] = k === 'pitch' ? v : k === 'hdg' ? (v % 360 + 360) % 360 : ((v + 180) % 360 + 360) % 360 - 180;
  }
  return o; };
// (COMPETE) A RING'S FRAME: it faces its heading `dir` tilted up by `pitch` (deg; 90 = flown straight up through it, the
// loop's vertical gate); n its facing, l across it level (the wing's way at roll 0), u its own up (n x l)
function msrRingFrame(p) {
  const r = p.dir * Math.PI / 180, e = (msrNum(p.pitch) ? p.pitch : 0) * Math.PI / 180;
  const z = v => (Math.abs(v) < 1e-12 ? 0 : v);                 // cos 90 is 6e-17: a vertical ring is exactly vertical
  const sr = z(CORE_MATH.sin(r)), cr = z(CORE_MATH.cos(r)), se = z(CORE_MATH.sin(e)), ce = z(CORE_MATH.cos(e));
  return { c: p.ring.map(Number), pitched: msrNum(p.pitch) && p.pitch !== 0,
           n: [sr * ce, se, -cr * ce], l: [-cr, 0, -sr], u: [-sr * se, ce, cr * se] };
}
const msrDot3 = (v, x, y, z) => v[0] * x + v[1] * y + v[2] * z;
// one objective between two samples a -> b: the crossing (an interpolated sample) or null
function missionHitTest(p, a, b) {
  const k = msrKind(p), dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
  if (k === 'pt') {
    const cx = +p.pt[0], cz = +p.pt[1];
    const u = L2 > 0 ? Math.max(0, Math.min(1, ((cx - a.x) * dx + (cz - a.z) * dz) / L2)) : 1;
    const q = msrLerp(a, b, u);
    return Math.hypot(q.x - cx, q.z - cz) <= p.r && !msrAltWhy(p.alt, q) ? q : null;
  }
  if (k === 'gate') {
    const [[x1, z1], [x2, z2]] = p.gate, ex = x2 - x1, ez = z2 - z1, den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) return null;
    const u = ((x1 - a.x) * ez - (z1 - a.z) * ex) / den, w = ((x1 - a.x) * dz - (z1 - a.z) * dx) / den;
    if (u < 0 || u > 1 || w < 0 || w > 1) return null;
    const q = msrLerp(a, b, u);
    if (msrAltWhy(p.alt, q)) return null;
    if (msrNum(p.dir) && msrDiff(msrDeg(dx, dz), p.dir) > 90) return null;
    return q;
  }
  if (k === 'ring') {
    const [cx, cy, cz] = p.ring.map(Number), ya = msrNum(a.y) ? a.y : cy, yb = msrNum(b.y) ? b.y : cy;
    if (!msrNum(p.dir)) {
      // no facing: a sphere of the ring's radius, its closest approach on the segment (3-D)
      const dy = yb - ya, M2 = L2 + dy * dy;
      const u = M2 > 0 ? Math.max(0, Math.min(1, ((cx - a.x) * dx + (cy - ya) * dy + (cz - a.z) * dz) / M2)) : 1, q = msrLerp(a, b, u);
      return Math.hypot(q.x - cx, (msrNum(q.y) ? q.y : cy) - cy, q.z - cz) <= p.r ? q : null;
    }
    // the ring faces its heading (COMPETE: tilted by its pitch - a tilted ring needs the heights of both samples)
    const R = msrRingFrame(p);
    if (R.pitched && !(msrNum(a.y) && msrNum(b.y))) return null;
    const sa = msrDot3(R.n, a.x - cx, ya - cy, a.z - cz), sb = msrDot3(R.n, b.x - cx, yb - cy, b.z - cz);
    if (!(sa < 0 && sb >= 0)) return null;                                     // through it, the way it faces
    const u = sa / (sa - sb), q = msrLerp(a, b, u), qy = (msrNum(q.y) ? q.y : cy) - cy;
    const lat = msrDot3(R.l, q.x - cx, qy, q.z - cz), up = msrDot3(R.u, q.x - cx, qy, q.z - cz);
    return Math.hypot(lat, up) <= p.r ? q : null;
  }
  return null;
}

// ---- THE STRIKE: A POST OR A RING TOUCHED (MISSIONS-PROPS) -----------------------------------------------------------------
// The gate posts and the rings are fabric (tools/_mission_gen.js draws them: the air-race pylon, the balloon column, the
// helium torus): a touch NEVER harms the aeroplane - there is no collider in the flight model - it TEARS the prop (the
// page swaps in the generator's torn variant for `rearm` s; a torn prop cannot be hit again) and the mission's
// rules.strike decides: 'penalty' (the default: +pen s on every lap running then - the air race's +3 s a pylon),
// { penalty: s }, 'fail' (the mission fails at the next stop: 74_ careerOnStop's rules pass), or 'ignore'.
// The dimensions are the generator's (GATE MISSIONPROPS holds the two tables equal): a pylon is a cone h tall, r0 at its
// foot, r1 at its top; a balloon column a cylinder of the balls' radius up to the band's top (alt.max; none: h); a ring
// a torus of tube radius round its hole (the place's r). `reach` is the aeroplane's half-span (the page's, else this):
// the wing is level, so it reaches sideways - a pass a wingtip too close is a pass AND a strike.
const MISSION_PROP_DIMS = { pylons: { h: 25, r0: 2.5, r1: 0.375 }, balloons: { h: 60, r: 0.9 }, donut: { tube: 1.2 }, reach: 5, pen: 3, rearm: 30 };
const MISSION_GATE_PROP = 'pylons';                            // a gate that names no prop is an air-race gate
// a mission's strike rule -> { mode: 'penalty' | 'fail' | 'ignore', pen }
function missionStrikeRule(rec) {
  const v = rec && rec.rules && rec.rules.strike, D = MISSION_PROP_DIMS.pen;
  if (v && typeof v === 'object' && msrNum(v.penalty)) return { mode: 'penalty', pen: v.penalty };
  if (v === 'fail' || v === 'ignore') return { mode: v, pen: 0 };
  return { mode: 'penalty', pen: D };
}
// the height of a sample over a post's foot in the frame the post is measured in: AGL (a post stands on the ground)
const msrAgl = q => (msrNum(q.agl) ? q.agl : null);
// one place's posts / ring against the segment a -> b -> [{ post: 0 | 1 | 'ring', t, x, z, y }] (touched: within reach)
function missionStrikeTest(p, a, b, reach) {
  const k = msrKind(p), R = msrNum(reach) ? reach : MISSION_PROP_DIMS.reach, out = [];
  const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
  if (k === 'gate') {
    const prop = p.prop || MISSION_GATE_PROP;
    p.gate.forEach((g, i) => {
      const px = +g[0], pz = +g[1];
      const u = L2 > 0 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / L2)) : 1, q = msrLerp(a, b, u);
      const d = Math.hypot(q.x - px, q.z - pz), h = msrAgl(q);
      if (prop === 'balloons') {
        const D = MISSION_PROP_DIMS.balloons, top = p.alt && msrNum(p.alt.max) ? p.alt.max : D.h, msl = p.alt && p.alt.ref === 'msl';
        const v = msl ? q.y : h;
        if (!msrNum(v) || v > top || d > D.r + R) return;
      } else {
        const D = MISSION_PROP_DIMS.pylons, Rh = msrNum(q.roll) ? R * Math.abs(CORE_MATH.cos(q.roll * Math.PI / 180)) : R;   // (COMPETE) a knife-edge wing reaches up, not out
        if (!msrNum(h) || h > D.h || d > D.r0 + (D.r1 - D.r0) * Math.max(0, h) / D.h + Rh) return;
      }
      out.push({ post: i, t: q.t, x: q.x, z: q.z, y: msrNum(q.y) ? q.y : null });
    });
    return out;
  }
  if (k === 'ring' && msrNum(p.dir)) {
    const [cx, cy, cz] = p.ring.map(Number), F = msrRingFrame(p);
    if (!msrNum(a.y) || !msrNum(b.y)) return out;                              // no height known
    const sa = msrDot3(F.n, a.x - cx, a.y - cy, a.z - cz), sb = msrDot3(F.n, b.x - cx, b.y - cy, b.z - cz);
    if ((sa < 0) === (sb < 0)) return out;                                     // not across its plane
    const u = sa / (sa - sb), q = msrLerp(a, b, u);
    // (COMPETE) in the ring's own frame, the wing turned by the roll (level: as before; knife-edge: it reaches along u)
    const l0 = msrDot3(F.l, q.x - cx, q.y - cy, q.z - cz), u0 = msrDot3(F.u, q.x - cx, q.y - cy, q.z - cz);
    const ph = msrNum(q.roll) ? q.roll * Math.PI / 180 : 0, cph = ph ? CORE_MATH.cos(ph) : 1, sph = ph ? CORE_MATH.sin(ph) : 0;
    const lat = l0 * cph + u0 * sph, up = -l0 * sph + u0 * cph, tube = MISSION_PROP_DIMS.donut.tube, Rc = p.r + tube;
    // the wing: lat - R .. lat + R across the ring's plane at height up; its nearest and farthest reach from the centre
    const lo = lat - R, hi = lat + R, xn = lo <= 0 && hi >= 0 ? 0 : Math.min(Math.abs(lo), Math.abs(hi)), xf = Math.max(Math.abs(lo), Math.abs(hi));
    const dn = Math.hypot(xn, up), df = Math.hypot(xf, up);
    const gap = Rc >= dn && Rc <= df ? 0 : Math.min(Math.abs(dn - Rc), Math.abs(df - Rc));
    if (gap <= tube) out.push({ post: 'ring', t: q.t, x: q.x, z: q.z, y: q.y });
  }
  return out;
}
// a penalty of `pen` s on every lap running at t (started at or before it, not stopped before it), counted under `what`
// ('strikes' | 'atts') -> the laps' ids
function msrPenalise(T, t, pen, what) {
  const ids = [];
  for (const lid of Object.keys(T.laps)) {
    const L = T.laps[lid];
    if (L.t0 > t || (L.t1 != null && L.t1 < t)) continue;
    L.pen = Math.round(((L.pen || 0) + pen) * 10) / 10; L[what] = (L[what] || 0) + 1;
    if (L.s != null) L.s = Math.round((L.raw + L.pen) * 10) / 10;
    ids.push(lid);
  }
  return ids;
}
// a lap's stop event (COMPETE: against the fixed ghost, + behind it)
function msrStopEv(tm, lap) {
  const e = { k: 'timer', id: tm.id, state: 'stop', s: lap.s };
  if (tm.ghost && msrNum(tm.ghost.s)) e.ghost = Math.round((lap.s - tm.ghost.s) * 10) / 10;
  return e;
}

// ---- THE ATTITUDE AT A PASS (COMPETE: 3-D gates - a knife-edge, inverted, a loop) ----------------------------------------
// A gate or a ring may ask an attitude at the pass, att { hdg?, pitch?, roll?, tol?, pen? } (deg; pitch nose-up +, in
// -90..90; roll right wing down +, inverted 180, knife-edge +-90 - the page's convention): each asked angle within tol
// (20) of the sample's at the crossing, else a SOFT penalty of pen s (2) on the laps running - never a miss, never a fail.
// The heading of a near-vertical line (|pitch| > 70) is no heading: not judged there.
const MISSION_ATT = { tol: 20, pen: 2, vertical: 70 };
// -> null (nothing asked) | { err: { k: deg }, miss } | { unknown: [k] } (the sample lacks an angle asked: not judged)
function missionAttJudge(att, q) {
  if (!att || typeof att !== 'object' || !q) return null;
  const tol = msrNum(att.tol) ? att.tol : MISSION_ATT.tol, err = {}, unknown = [];
  let miss = false, asked = false;
  for (const k of ['hdg', 'pitch', 'roll']) {
    if (!msrNum(att[k])) continue;
    asked = true;
    if (k === 'hdg' && ((msrNum(att.pitch) && Math.abs(att.pitch) > MISSION_ATT.vertical) || (msrNum(q.pitch) && Math.abs(q.pitch) > MISSION_ATT.vertical))) continue;
    if (!msrNum(q[k])) { unknown.push(k); continue; }
    const e = k === 'pitch' ? Math.abs(q.pitch - att.pitch) : msrDiff(q[k], att[k]);
    err[k] = Math.round(e * 10) / 10;
    if (e > tol) miss = true;
  }
  if (!asked) return null;
  if (unknown.length) return { unknown };
  return { err, miss };
}

// ---- STOL: THE SHORTEST TAKE-OFF, THE SHORTEST LANDING, THE SPOT (COMPETE) -----------------------------------------------
// A mission's stol: [{ id, kind: 'takeoff' | 'landing' | 'spot', line: [[x1, z1], [x2, z2]], dir, stop: <step id>,
// medals?: [{ medal, le: m }], max?: m, ghost?: { m, who? } }] - a line marked across a strip, run the way `dir` faces.
// The measure is the tour's (tools/_tour_lib.js, the take-off from the roll to the lift-off, the landing from the
// touchdown to the stop - the retired CHINOOK gate's), read off the page's samples: `gnd` (the wheels on the ground:
// true | a count of wheels), `v` (m/s over the ground; else the samples' own), x z the aeroplane's position (the page
// feeds the main wheels' when it can).
//   takeoff  stopped (v < 1 m/s) with the wheels on the line (0-3 m behind it, inside its length): the distance from
//            the line to the lift-off (the midpoint of the last sample on the ground and the first off it), the
//            lift-off held 1 s (a hop: the roll goes on)
//   landing  the first touchdown inside the line's length, 0-300 m either side of it, after 5 s in the air: before
//            the line a FOUL (Valdez: touched short); past it, the distance from the line to the stop (v < 1 m/s). Up
//            again for 5 s: a go-around, the attempt dropped
//   spot     the distance from the line at the first touchdown (short or long, the same; `short` says which)
// The first measure of a flight stands (the step is flown again on the next flight when it is not good enough).
const MISSION_STOL = { gap: 3, still: 1, hold: 1, flown: 5, zone: 300 };
const MISSION_STOL_KINDS = ['takeoff', 'landing', 'spot'];
// a line's frame: s the distance from the line the way dir runs (+ past it), c along the line from its middle
function msrLineFrame(S) {
  const [[x1, z1], [x2, z2]] = S.line, mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, L = Math.hypot(x2 - x1, z2 - z1) || 1;
  const ux = (x2 - x1) / L, uz = (z2 - z1) / L, r = S.dir * Math.PI / 180;
  let nx = -uz, nz = ux;
  if (nx * CORE_MATH.sin(r) - nz * CORE_MATH.cos(r) < 0) { nx = -nx; nz = -nz; }
  return { s: (x, z) => (x - mx) * nx + (z - mz) * nz, c: (x, z) => (x - mx) * ux + (z - mz) * uz, half: L / 2 };
}
const msrGnd = q => (q.gnd == null ? null : msrNum(q.gnd) ? q.gnd > 0 : !!q.gnd);
const msrR1 = v => Math.round(v * 10) / 10;
function msrStolStep(T, a, b, out) {
  const ga = msrGnd(a), gb = msrGnd(b);
  if (ga == null || gb == null) return;
  const K = MISSION_STOL, dt = b.t - a.t, v = msrNum(b.v) ? b.v : (dt > 0 ? Math.hypot(b.x - a.x, b.z - a.z) / dt : 0);
  const m = { t: (a.t + b.t) / 2, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };   // a transition's moment: midway
  if (ga === false && T.airSince == null) T.airSince = a.t;
  const lift = ga && !gb, tdn = !ga && gb, flown = tdn && T.airSince != null ? m.t - T.airSince : 0;
  const along = S => Math.hypot(b.x - a.x, b.z - a.z) > 0 && msrDiff(msrDeg(b.x - a.x, b.z - a.z), S.dir) <= 90;
  const put = (S, r) => { T.stolRes[S.id] = r; out.push(Object.assign({ k: 'stol', id: S.id, kind: S.kind }, r)); };
  for (const S of T.stol) {
    if (T.stolRes[S.id]) continue;
    const F = msrLineFrame(S), st = T.stolSt[S.id] || (T.stolSt[S.id] = { ph: 'wait' });
    if (S.kind === 'takeoff') {
      if (gb && v < K.still) {                                  // stopped: on the line, or not
        const s = F.s(b.x, b.z);
        st.ph = s >= -K.gap && s <= 0 && Math.abs(F.c(b.x, b.z)) <= F.half ? 'armed' : 'wait'; st.s0 = s; st.lift = null;
        continue;
      }
      if (st.ph === 'armed' && lift) { st.ph = 'lift'; st.lift = m; continue; }
      if (st.ph === 'lift') {
        if (gb) { st.ph = 'armed'; st.lift = null; continue; }   // a hop: the roll goes on
        if (b.t - st.lift.t >= K.hold) {
          const s = F.s(st.lift.x, st.lift.z);
          if (s > st.s0) put(S, { m: msrR1(Math.max(0, s)), t: Math.round(st.lift.t * 100) / 100 });
          else st.ph = 'wait';
        }
      }
      continue;
    }
    // landing | spot
    if (st.ph === 'wait' && tdn && flown >= K.flown && along(S)) {
      const s = F.s(m.x, m.z);
      if (Math.abs(F.c(m.x, m.z)) > F.half || Math.abs(s) > K.zone) continue;   // a landing somewhere else
      const t = Math.round(m.t * 100) / 100;
      if (S.kind === 'spot') { put(S, Object.assign({ m: msrR1(Math.abs(s)), t }, s < 0 ? { short: true } : {})); continue; }
      if (s < 0) { put(S, { foul: 'short', td: msrR1(s), t }); continue; }
      st.ph = 'roll'; st.td = msrR1(s);
      continue;
    }
    if (st.ph === 'roll') {
      if (!gb && T.airSince != null && b.t - T.airSince >= K.flown) { st.ph = 'wait'; continue; }   // a go-around
      if (gb && v < K.still) put(S, { m: msrR1(Math.max(0, F.s(b.x, b.z))), td: st.td, t: Math.round(b.t * 100) / 100 });
    }
  }
  if (lift) T.airSince = m.t;
  if (gb) T.airSince = null;
}

// the objectives of a contract's CURRENT leg (stage) not done yet -> [{ key, j, do, place, split?, say? }]; `seq` when the
// leg's steps run in order (only the next one is armed)
function missionObjectives(rec, live) {
  const L = live || { stage: 0, subs: [] }, st = rec && rec.stages && rec.stages[L.stage];
  if (!st) return { seq: false, objs: [] };
  const objs = [];
  st.subs.forEach((s, j) => { if (!(L.subs || [])[j] && missionInFlight(s) && s.id) objs.push(Object.assign({ key: s.id, j, do: s.do, place: s.place },
    s.split != null ? { split: s.split } : {}, s.say ? { say: s.say } : {})); });
  return { seq: st.order === 'seq', objs };
}
// a tracker for one contract's flight (the page makes one at departure, per accepted contract with objectives)
// opts.reach: the aeroplane's half-span (m; MISSION_PROP_DIMS.reach when the page gives none)
function missionTrackNew(rec, live, opts) {
  const O = missionObjectives(rec, live), o = opts || {};
  const T = { v: MISSION_RUN_V, id: rec.id, stage: (live && live.stage) || 0, seq: O.seq, objs: O.objs, timers: msrClone(rec.timers || []),
           hits: {}, laps: {}, last: null, reach: msrNum(o.reach) && o.reach >= 0 ? o.reach : MISSION_PROP_DIMS.reach,
           strike: missionStrikeRule(rec), strikes: [], torn: {} };
  // (COMPETE) the STOL lines this leg's open steps are judged on, and the course's earlier legs (live.timers: 74_ keeps
  // every lap a step was judged on) carried into this flight's evidence
  const st = rec && rec.stages && rec.stages[T.stage], open = {};
  if (st) st.subs.forEach((s, j) => { if (s.id && !((live && live.subs) || [])[j]) open[s.id] = 1; });
  T.stol = (Array.isArray(rec.stol) ? rec.stol : []).filter(S => S && open[S.stop]).map(msrClone);
  T.stolSt = {}; T.stolRes = {}; T.airSince = null; T.atts = [];
  if (rec.course && Array.isArray(rec.course.timers)) {
    T.prior = {};
    const LT = (live && live.timers) || {};
    for (const id of rec.course.timers) if (LT[id] && msrNum(LT[id].s)) T.prior[id] = LT[id].s;
  }
  return T;
}
// one sample of the flight -> the events it made [{ k: 'hit' | 'photo' | 'split' | 'timer', key, ... }]. Mutates T.
// In a seq leg only the first objective not yet hit is armed; after a hit the REST of the segment is tested against the
// next one (a fast sample across two close gates counts both, in order). Any order: every objective on the segment.
function missionTrackStep(T, smp) {
  if (!T || !smp || !msrNum(smp.t) || !msrNum(smp.x) || !msrNum(smp.z)) return [];
  const a = T.last, out = [];
  T.last = { t: smp.t, x: smp.x, z: smp.z, y: smp.y, agl: smp.agl };
  for (const k of ['gnd', 'v', 'hdg', 'pitch', 'roll']) if (smp[k] != null) T.last[k] = smp[k];   // (COMPETE) on the ground, the speed, the attitude
  if (!a) return out;
  if (T.stol && T.stol.length) msrStolStep(T, a, T.last, out);
  let from = a;
  for (const o of T.objs) {
    if (T.hits[o.key]) continue;
    const q = missionHitTest(o.place, from, T.last);
    if (!q) { if (T.seq) break; continue; }
    {
      const t = Math.round(q.t * 100) / 100;
      T.hits[o.key] = { t, x: Math.round(q.x), z: Math.round(q.z), y: msrNum(q.y) ? Math.round(q.y) : null };
      out.push({ k: o.do === 'photo' ? 'photo' : 'hit', key: o.key, do: o.do, t, say: o.say || null });
      for (const tm of T.timers) {
        const lap = T.laps[tm.id];
        if (tm.start === o.key && !lap) { T.laps[tm.id] = { t0: t, splits: [] }; out.push({ k: 'timer', id: tm.id, state: 'start', t }); }
        else if (lap && lap.s == null && tm.stop === o.key) { lap.raw = Math.round((t - lap.t0) * 10) / 10; lap.t1 = t; lap.s = Math.round((lap.raw + (lap.pen || 0)) * 10) / 10; out.push(msrStopEv(tm, lap)); }
        else if (lap && lap.s == null && (o.split != null || (tm.ghost && tm.ghost.splits && msrNum(tm.ghost.splits[o.key])))) {
          const sp = Object.assign({ key: o.key, s: Math.round((t - lap.t0) * 10) / 10 }, o.split != null ? { target: o.split } : {}), G = tm.ghost && tm.ghost.splits;
          if (G && msrNum(G[o.key])) sp.ghost = Math.round((sp.s - G[o.key]) * 10) / 10;   // (COMPETE) + behind the ghost, - ahead
          lap.splits.push(sp); out.push(Object.assign({ k: 'split', id: tm.id }, sp));
        }
      }
      // (COMPETE) THE ATTITUDE ASKED AT THE PASS (a knife-edge, inverted, a loop's vertical gate): outside its tolerance a
      // soft penalty on every lap running (the timer starting or stopping here among them), never a miss
      const aj = missionAttJudge(o.place && o.place.att, q);
      if (aj) {
        T.hits[o.key].att = aj;
        if (aj.miss) {
          const pen = msrNum(o.place.att.pen) ? o.place.att.pen : MISSION_ATT.pen, laps = msrPenalise(T, t, pen, 'atts');
          T.atts.push({ key: o.key, t, err: aj.err });
          out.push({ k: 'attitude', key: o.key, t, err: aj.err, pen, laps });
          for (const e of out) if (e.k === 'timer' && e.state === 'stop' && laps.includes(e.id)) Object.assign(e, msrStopEv(T.timers.find(x => x.id === e.id), T.laps[e.id]));
        } else out.push({ k: 'attitude', key: o.key, t, err: aj.err, ok: true });
      }
    }
    if (T.seq) from = q;                                       // the rest of the segment, for the next one in order
  }
  // THE STRIKES: every post and ring of this leg's objectives (passed or not: they still stand), not torn now
  if (T.strikes) for (const o of T.objs) {
    for (const h of missionStrikeTest(o.place, a, T.last, T.reach)) {
      const id = o.key + ':' + h.post, t = Math.round(h.t * 100) / 100;
      if (T.torn[id] != null && T.torn[id] > t) continue;
      T.torn[id] = t + MISSION_PROP_DIMS.rearm;
      const e = { k: 'strike', key: o.key, post: h.post, t, prop: msrKind(o.place) === 'ring' ? (o.place.prop || 'donut') : (o.place.prop || MISSION_GATE_PROP), until: T.torn[id] };
      if (T.strike.mode === 'penalty' && T.strike.pen > 0) {
        // every lap running at that moment (started at or before it, not stopped before it) takes the penalty
        const laps = msrPenalise(T, t, T.strike.pen, 'strikes');
        if (laps.length) { e.pen = T.strike.pen; e.laps = laps; }
      }
      if (T.strike.mode === 'fail') e.fail = true;
      T.strikes.push({ key: o.key, post: h.post, t });
      out.push(e);
    }
  }
  return out;
}
// what the stop record carries for this contract (75_ careerStopRecord `tracks[id]`)
function missionTrackEvidence(T) {
  if (!T) return null;
  const timers = {};
  for (const id of Object.keys(T.laps)) timers[id] = msrClone(T.laps[id]);
  const ev = { v: MISSION_RUN_V, id: T.id, stage: T.stage, hits: msrClone(T.hits), timers };
  if (T.strikes && T.strikes.length) ev.strikes = msrClone(T.strikes);
  if (T.atts && T.atts.length) ev.atts = msrClone(T.atts);
  if (T.stolRes && Object.keys(T.stolRes).length) ev.stol = msrClone(T.stolRes);
  if (T.prior) ev.course = msrClone(T.prior);
  return ev;
}

// ---- THE NEW VERBS AT A STOP (73_ contractSubOnStop asks) -------------------------------------------------------------------
// -> { st: 'done' | 'no', why, say? }. In flight (pass, a photo or a fly to a point / gate / ring): the flight's evidence
// (stop.tracks[rec.id].hits[step id]); park: the stop's tie-down spot (stop.spot '<field>:<spot id>', the page's nearest
// by 25_ fleetSpotDist); wait: a stop at its field after waiting require.waitMin (stop.waitedMin, the page's Wait); talk:
// a stop at its field (or anywhere without one): its line is the event
function missionStepOnStop(rec, sub, prog, stop) {
  const S = stop || {}, nm = id => (typeof CONTRACT_FIELDS !== 'undefined' && CONTRACT_FIELDS[id] ? CONTRACT_FIELDS[id].name : id || 'nowhere');
  if (missionInFlight(sub)) {
    const ev = S.tracks && S.tracks[rec.id], h = sub.id && ev && ev.hits && ev.hits[sub.id];
    return h ? { st: 'done', why: '', at: h } : { st: 'no', why: sub.do + ' ' + (sub.id || '') + ': not flown yet' };
  }
  if (sub.do === 'park') {
    const want = sub.place && sub.place.spot;
    return S.spot === want ? { st: 'done', why: '' } : { st: 'no', why: 'parked ' + (S.spot ? 'at ' + S.spot : 'on no tie-down spot') + ', not ' + want };
  }
  if (sub.do === 'wait') {
    if (sub.at && S.aero !== sub.at) return { st: 'no', why: 'stopped at ' + nm(S.aero) + ', not ' + nm(sub.at) };
    const need = (sub.require && sub.require.waitMin) || 0, got = msrNum(S.waitedMin) ? S.waitedMin : 0;
    return got >= need ? { st: 'done', why: '' } : { st: 'no', why: 'waited ' + got + ' min of ' + need };
  }
  if (sub.do === 'talk') {
    if (sub.at && S.aero !== sub.at) return { st: 'no', why: 'stopped at ' + nm(S.aero) + ', not ' + nm(sub.at) };
    return { st: 'done', why: '', say: sub.say || null };
  }
  return { st: 'no', why: 'no runtime for ' + sub.do + ' at a ' + (msrKind(sub.place) || 'place') };
}

// ---- THE STOP'S OWN CONDITIONS ON A STEP (MISSIONS-P3: the bush missions) ------------------------------------------------------
// A step done at a stop is judged further, when it says so (74_ contractOnStop asks):
//   require.maxMin   the flight that ended here took at most that many minutes (the logbook row's t)
//   require.depart   that flight left inside a local-hour window: { after: h } | { before: h } | { at: [h0, h1] } (wraps
//                    midnight); its departure hour is stop.departHour (the page's), else the stop's hour less the flight
//   embark           these people got on here (stop.people.on: [person ids]; a number: that many got on)
//   disembark        these people got off here (stop.people.off)
// -> the result (r when nothing fails), or { st: 'no', why }
const msrHourIn = (h, D) => { if (!D) return true; if (msrNum(D.after)) return h >= D.after; if (msrNum(D.before)) return h < D.before;
  if (Array.isArray(D.at)) { const [a, b] = D.at; return a < b ? h >= a && h < b : h >= a || h < b; } return true; };
function missionStopChecks(rec, sub, r, stop) {
  if (!r || r.st !== 'done' || !sub) return r;
  const S = stop || {}, R = sub.require || {}, row = S.row || {};
  if (msrNum(R.maxMin) && msrNum(row.t) && row.t > R.maxMin * 60) return { st: 'no', why: 'the flight took ' + Math.round(row.t / 60) + ' min, ' + R.maxMin + ' allowed' };
  if (R.depart) {
    const h = msrNum(S.departHour) ? S.departHour : (msrNum(S.hour) && msrNum(row.t) ? ((S.hour - row.t / 3600) % 24 + 24) % 24 : null);
    if (h != null && !msrHourIn(h, R.depart)) return { st: 'no', why: 'it left at ' + h.toFixed(1) + ' h, outside its departure window' };
  }
  const P = S.people || {};
  for (const [k, list] of [['embark', P.on], ['disembark', P.off]]) {
    const want = sub[k];
    if (want == null) continue;
    const got = Array.isArray(list) ? list : [];
    const ids = (Array.isArray(want) ? want : []).filter(x => typeof x === 'string'), n = Array.isArray(want) ? want.filter(x => typeof x === 'number').reduce((a, x) => a + x, 0) : +want || 0;
    const miss = ids.filter(id => !got.includes(id)), name = id => (typeof peopleName === 'function' ? peopleName(id) : id);
    if (miss.length) return { st: 'no', why: (k === 'embark' ? 'waiting for ' : 'still aboard: ') + miss.map(name).join(', ') };
    if (got.length < ids.length + n) return { st: 'no', why: (k === 'embark' ? 'on board here: ' : 'off here: ') + got.length + ' of ' + (ids.length + n) };
  }
  return r;
}
// a leg's steps all done - or, a choose:N leg, N of them (MISSIONS-P3)
function missionLegDone(st, subsDone) {
  const m = /^choose:(\d+)$/.exec(String((st && st.order) || ''));
  const n = (subsDone || []).filter(Boolean).length;
  return m ? n >= +m[1] : (st.subs || []).every((s, j) => (subsDone || [])[j]);
}

// ---- THE MAP'S MARKERS (what a local session draws: the map's symbols, the 3-D props) -------------------------------------
// -> [{ key, n, do, kind, x, z, y?, r?, posts?, dir?, prop?, alt?, spot?, site?, field?, split?, label, state }]: every
// step of every leg with a place, in mission order; state 'done' (its sub done), 'next' (the current leg's armed one: the
// first open step of a seq leg, every open step of an any leg), 'later' (a leg still to come). opts.spots: the fleet
// spot pack's `aero` table (a spot's position), opts.fields
function missionMarkers(rec, live, opts) {
  opts = opts || {};
  const L = live || { stage: 0, subs: [] }, out = [], F = opts.fields;
  let n = 0;
  ((rec && rec.stages) || []).forEach((st, i) => {
    let armed = false;
    (st.subs || []).forEach((s, j) => {
      const p = s.place || (s.to ? { field: s.to } : s.at ? { field: s.at } : null), k = msrKind(p);
      if (!k) return;
      n++;
      const done = i < L.stage || (i === L.stage && (L.subs || [])[j]);
      let state = done ? 'done' : i > L.stage ? 'later' : 'next';
      if (state === 'next' && st.order === 'seq') { if (armed) state = 'later'; armed = true; }
      const m = { key: s.id || ('s' + i + '.' + j), n, do: s.do, kind: k, state, label: (s.id || s.do) };
      const q = msrXZ(p, F);
      if (q) { m.x = q[0]; m.z = q[1]; }
      if (k === 'pt') { m.r = p.r; if (p.alt) m.alt = msrClone(p.alt); }
      if (k === 'gate') { m.posts = msrClone(p.gate); if (p.alt) m.alt = msrClone(p.alt); m.prop = p.prop || MISSION_GATE_PROP; if (msrNum(p.dir)) m.dir = p.dir; }
      if (k === 'ring') { m.y = +p.ring[1]; m.r = p.r; if (msrNum(p.dir)) m.dir = p.dir; if (msrNum(p.pitch)) m.pitch = p.pitch; m.prop = p.prop || 'donut'; }
      if ((k === 'gate' || k === 'ring') && p.att) m.att = msrClone(p.att);   // (COMPETE) the attitude asked
      if (k === 'spot') { m.spot = p.spot; const i0 = String(p.spot).indexOf(':'), a = String(p.spot).slice(0, i0), id = String(p.spot).slice(i0 + 1), sp = opts.spots && opts.spots[a] && opts.spots[a].find(z => z[3] === id); if (sp) { m.x = sp[0]; m.z = sp[1]; m.dir = sp[2]; } }
      if (k === 'site') m.site = p.site;
      if (k === 'field') m.field = p.field;
      if (s.split != null) m.split = s.split;
      out.push(m);
    });
  });
  // (COMPETE) the STOL lines: a line across the strip, its run's way; its state its stop step's
  for (const S of Array.isArray(rec && rec.stol) ? rec.stol : []) {
    let i = -1, j = -1;
    ((rec && rec.stages) || []).forEach((st, a) => (st.subs || []).forEach((s, b) => { if (s.id === S.stop) { i = a; j = b; } }));
    if (i < 0) continue;
    const done = i < L.stage || (i === L.stage && (L.subs || [])[j]);
    out.push({ key: 'stol:' + S.id, do: 'stol', kind: 'line', stol: S.kind, posts: msrClone(S.line), dir: S.dir,
               x: (S.line[0][0] + S.line[1][0]) / 2, z: (S.line[0][1] + S.line[1][1]) / 2,
               state: done ? 'done' : i > L.stage ? 'later' : 'next', label: S.id });
  }
  return out;
}
