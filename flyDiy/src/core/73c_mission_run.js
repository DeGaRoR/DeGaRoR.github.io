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
function contractDelivery(rec) {
  if (!rec || rec.kind !== 'build') return null;
  const D = rec.delivery && typeof rec.delivery === 'object' ? rec.delivery : {};
  return { sold: D.sold !== false, blueprint: D.blueprint !== false };
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
function missionTimerOnSub(rec, sub, r, stop, fields) {
  if (!r || r.st !== 'done' || !sub || !sub.id) return r;
  const ev = stop && stop.tracks && stop.tracks[rec.id];
  for (const t of (rec && rec.timers) || []) {
    if (t.stop !== sub.id) continue;
    const E = ev && ev.timers && ev.timers[t.id];
    if (!E || !msrNum(E.s)) return { st: 'no', why: 'the ' + t.id + ' timer ran no lap (' + t.start + ' to ' + t.stop + ' in one flight)' };
    const target = missionTimerTarget(rec, t, fields), timer = { id: t.id, s: E.s, target, splits: E.splits || [] };
    if (Array.isArray(t.medals) && t.medals.length) {
      const m = t.medals.slice().sort((a, b) => a.le - b.le).find(x => E.s <= x.le);
      if (!m) return { st: 'no', why: t.id + ': ' + E.s + ' s, ' + Math.max(...t.medals.map(x => x.le)) + ' s or less for a medal' };
      r = Object.assign({}, r, { medal: m.medal, timer });
    } else if (msrNum(target) && E.s > target) return { st: 'no', why: t.id + ': ' + E.s + ' s, the target is ' + target + ' s' };
    else r = Object.assign({}, r, { timer });
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
  for (const k of ['y', 'agl']) if (msrNum(a[k]) && msrNum(b[k])) o[k] = a[k] + (b[k] - a[k]) * u; else if (msrNum(b[k])) o[k] = b[k]; return o; };
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
    const r = p.dir * Math.PI / 180, nx = Math.sin(r), nz = -Math.cos(r);       // the ring faces its heading
    const sa = (a.x - cx) * nx + (a.z - cz) * nz, sb = (b.x - cx) * nx + (b.z - cz) * nz;
    if (!(sa < 0 && sb >= 0)) return null;                                     // through it, the way it faces
    const u = sa / (sa - sb), q = msrLerp(a, b, u);
    const lat = (q.x - cx) * nz - (q.z - cz) * nx, up = (msrNum(q.y) ? q.y : cy) - cy;
    return Math.hypot(lat, up) <= p.r ? q : null;
  }
  return null;
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
function missionTrackNew(rec, live) {
  const O = missionObjectives(rec, live);
  return { v: MISSION_RUN_V, id: rec.id, stage: (live && live.stage) || 0, seq: O.seq, objs: O.objs, timers: msrClone(rec.timers || []),
           hits: {}, laps: {}, last: null };
}
// one sample of the flight -> the events it made [{ k: 'hit' | 'photo' | 'split' | 'timer', key, ... }]. Mutates T.
// In a seq leg only the first objective not yet hit is armed; after a hit the REST of the segment is tested against the
// next one (a fast sample across two close gates counts both, in order). Any order: every objective on the segment.
function missionTrackStep(T, smp) {
  if (!T || !smp || !msrNum(smp.t) || !msrNum(smp.x) || !msrNum(smp.z)) return [];
  const a = T.last, out = [];
  T.last = { t: smp.t, x: smp.x, z: smp.z, y: smp.y, agl: smp.agl };
  if (!a) return out;
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
        else if (lap && lap.s == null && tm.stop === o.key) { lap.s = Math.round((t - lap.t0) * 10) / 10; out.push({ k: 'timer', id: tm.id, state: 'stop', s: lap.s }); }
        else if (lap && lap.s == null && o.split != null) { const sp = { key: o.key, s: Math.round((t - lap.t0) * 10) / 10, target: o.split }; lap.splits.push(sp); out.push(Object.assign({ k: 'split', id: tm.id }, sp)); }
      }
    }
    if (T.seq) from = q;                                       // the rest of the segment, for the next one in order
  }
  return out;
}
// what the stop record carries for this contract (75_ careerStopRecord `tracks[id]`)
function missionTrackEvidence(T) {
  if (!T) return null;
  const timers = {};
  for (const id of Object.keys(T.laps)) timers[id] = msrClone(T.laps[id]);
  return { v: MISSION_RUN_V, id: T.id, stage: T.stage, hits: msrClone(T.hits), timers };
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
      if (k === 'gate') { m.posts = msrClone(p.gate); if (p.alt) m.alt = msrClone(p.alt); if (p.prop) m.prop = p.prop; if (msrNum(p.dir)) m.dir = p.dir; }
      if (k === 'ring') { m.y = +p.ring[1]; m.r = p.r; if (msrNum(p.dir)) m.dir = p.dir; m.prop = p.prop || 'donut'; }
      if (k === 'spot') { m.spot = p.spot; const i0 = String(p.spot).indexOf(':'), a = String(p.spot).slice(0, i0), id = String(p.spot).slice(i0 + 1), sp = opts.spots && opts.spots[a] && opts.spots[a].find(z => z[3] === id); if (sp) { m.x = sp[0]; m.z = sp[1]; m.dir = sp[2]; } }
      if (k === 'site') m.site = p.site;
      if (k === 'field') m.field = p.field;
      if (s.split != null) m.split = s.split;
      out.push(m);
    });
  });
  return out;
}
