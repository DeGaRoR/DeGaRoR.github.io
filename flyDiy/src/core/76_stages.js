// ============================================================
// 76_stages.js - THE BUILDINGS THAT MISSIONS PUT UP: the career's side of the premises' `stage` (G2300-G2309 STAGES,
// GAME-2026-10-06.md §11; the record's side is 27_premises.js stageView / stageIssues, contract v1.33).
//
// A track (72_contract_data.js CONTRACT_TRACKS: field 2, minedock 4, resort 3, survey 3, clients 2) is a small integer in
// the career document (`career.tracks`), advanced by a contract's `unlock: { stage: '<track>:<n>' }` (74_career.js
// careerComplete). The world record stands an element only while its track lies in the element's band. This file:
//   stageTracksOf(doc)          the tracks a composition reads: the career's, or NULL - the sandbox, every track at its max
//   stageMaxes()                { track: max } from CONTRACT_TRACKS (the sandbox's law, stageIssues' second argument)
//   stageKey(tracks)            the composition's key ('sandbox' | 'field:1,minedock:0,...'): what the roll-out compares
//   STAGE_REVEALS               every arc unlock '<track>:<n>' -> where it is seen and what is said (a trk.* text key);
//                               world: false - nothing in the world changes at it in this train (said, never hidden)
//   stageRevealsBetween(a, b)   the unlocks a composition at b shows that one at a did not, in track order
//   stageReveal(rec, frame, u)  the camera target of one unlock: the centre of the elements that start standing (or vary)
//                               at it, in the world (a site's items, a kit, a runway's centre), and the shot's eye
//   STAGE_PHASES / stageHost()  THE QUEUE: a stage change is applied at a COMPOSITION - the load, a roll-out, a roll-in
//                               (the house worker's path) - and NEVER IN FLIGHT: noted while flying it waits, queued, for
//                               the next composition (the trip lessons, HYBRID-TRIPS / LOC-SWITCH: the world never moves
//                               under a flying aeroplane; a runway's length is physics - terrainH, surfaceAt)
// Pure: no DOM, no THREE, no storage, no clock. GATE STAGES (tools/_stages_check.js).
// ============================================================

// ---- THE REVEALS: one per arc unlock (GATE STAGES: complete over every arc of every provider) ------------------------
// at: the aerodrome the reveal plays at (the roll-out from there, or the next one anywhere); caption: the track's own
// stage text (CONTRACT_TEXT trk.*); world: whether the record changes at this value. The camera target is not written
// here - it is READ off the record (stageReveal), so a moved building moves its shot.
const STAGE_REVEALS = {
  'field:1':    { at: 'HOME',     caption: 'trk.field.1',    world: true },    // the second hangar's plot: the building site
  'field:2':    { at: 'HOME',     caption: 'trk.field.2',    world: true },    // the second hangar restored (the club's long hangar)
  'minedock:1': { at: 'mn_strip', caption: 'trk.minedock.1', world: true },    // the mill's (the headframe's) frame going up
  'minedock:2': { at: 'mn_strip', caption: 'trk.minedock.2', world: true },    // the mill and the ore shed
  'minedock:3': { at: 'SEA',      caption: 'trk.minedock.3', world: true },    // the dock's site on the shore
  'minedock:4': { at: 'SEA',      caption: 'trk.minedock.4', world: true },    // the harbour: the cannery shed (the cold store), the sheds
  'resort:1':   { at: 'tw_ski',   caption: 'trk.resort.1',   world: true },    // the lodge's site
  'resort:2':   { at: 'tw_ski',   caption: 'trk.resort.2',   world: true },    // the Summit Lodge
  'resort:3':   { at: 'tw_ski',   caption: 'trk.resort.3',   world: true },    // the altiport lengthened, 320 m -> 380 m
  'survey:1':   { at: 'nv_strip', caption: 'trk.survey.1',   world: true },    // East Point: the windsock and the tie-down spots
  'survey:2':   { at: 'nv_strip', caption: 'trk.survey.2',   world: false },   // (no station building exists today: HANDOVER G2300)
  'survey:3':   { at: 'w3',       caption: 'trk.survey.3',   world: false },   // (no mast exists today: HANDOVER G2300)
  'clients:1':  { at: 'HOME',     caption: 'trk.clients.1',  world: true },    // the flying club's house
  'clients:2':  { at: 'HOME',     caption: 'trk.clients.2',  world: false },   // (no museum hangar exists today: HANDOVER G2300)
};
// the shot's eye about its target (A0's GPU still frames it: tools/stages_shot.js): metres back, elevation, and the
// caption's time on screen
const STAGE_SHOT = { dist: 70, el: 0.32, ms: 4500 };

function stageMaxes() {
  const out = {};
  if (typeof CONTRACT_TRACKS === 'object') for (const t of Object.keys(CONTRACT_TRACKS)) out[t] = CONTRACT_TRACKS[t].max;
  return out;
}
// the tracks a composition reads: a career document's (the page's dev career, a v2 player document with `career`, or
// the career block itself), else null - the sandbox
function stageTracksOf(doc) {
  const c = doc && (doc.career || (doc.tracks ? doc : null));
  if (!c || !c.tracks || typeof c.tracks !== 'object') return null;
  const out = {};
  for (const t of Object.keys(stageMaxes())) out[t] = Math.max(0, Math.floor(+c.tracks[t] || 0));
  return out;
}
function stageKey(tracks) {
  if (!tracks) return 'sandbox';
  return Object.keys(tracks).sort().map(t => t + ':' + tracks[t]).join(',');
}
const stageVal = (tracks, t) => (tracks && isFinite(+tracks[t]) ? +tracks[t] : (stageMaxes()[t] !== undefined ? stageMaxes()[t] : Infinity));
function stageRevealsBetween(a, b) {
  const out = [], M = stageMaxes();
  for (const t of Object.keys(M)) {
    const va = stageVal(a, t), vb = stageVal(b, t);
    for (let n = Math.max(1, va + 1); n <= Math.min(vb, M[t]); n++) out.push(Object.assign({ unlock: t + ':' + n, track: t, n }, STAGE_REVEALS[t + ':' + n] || { at: null, caption: null, world: false }));
  }
  return out;
}
// THE ELEMENTS OF ONE UNLOCK, read off the WHOLE record: every element (or item) of the track whose band, or one of
// whose vary bands, starts at n or ends at n - 1 - what the composition at n shows that the one at n - 1 did not
function stageElementsAt(rec, track, n) {
  const PG = typeof PREMISES_GEN !== 'undefined' ? PREMISES_GEN : null;
  const band = s => (PG ? PG.stageBand(s) : [s.show ? s.show[0] : 0, s.show ? s.show[1] : null]);
  const hits = (st) => {
    if (!st || st.track !== track) return false;
    const b = band(st);
    if (b[0] === n || (b[1] !== null && b[1] === n - 1)) return true;
    for (const q of st.vary || []) { const v = band(q); if (v[0] === n || (v[1] !== null && v[1] === n - 1)) return true; }
    return false;
  };
  const out = [];
  for (const L of Object.keys(rec.layers || {})) for (const e of rec.layers[L] || []) {
    if (!e) continue;
    if (hits(e.stage)) out.push({ layer: L, e });
    if (L === 'sites') for (const it of e.items || []) if (it && hits(it.stage)) out.push({ layer: 'items', site: e, e: it });
  }
  return out;
}
// an element's point in the record's frame (the site's frame law: siteFrame)
function stagePointOf(h) {
  const e = h.e;
  if (h.layer === 'items') { const a = h.site.at || { x: 0, z: 0, yaw: 0 }, c = Math.cos(a.yaw || 0), s = Math.sin(a.yaw || 0); return [a.x + e.x * c + e.z * s, a.z - e.x * s + e.z * c]; }
  if (h.layer === 'sites') return e.at ? [e.at.x, e.at.z] : null;
  if (h.layer === 'runways') return e.c ? [e.c[0], e.c[1]] : null;
  if (e.poly && e.poly.length) { let x = 0, z = 0; for (const q of e.poly) { x += q[0] / e.poly.length; z += q[1] / e.poly.length; } return [x, z]; }
  return isFinite(+e.x) && isFinite(+e.z) ? [+e.x, +e.z] : null;
}
// the reveal of one unlock: the target (the centre of what changes, in the world: `frame` = a composed overlay's frame,
// toWorld; absent - the record's frame), the eye (STAGE_SHOT, looking from the south-east of it unless `az` given),
// the caption key; null when nothing in the record changes at it (world: false)
function stageReveal(rec, frame, unlock) {
  const m = /^(\w+):(\d+)$/.exec(unlock || ''); if (!m) return null;
  const R = STAGE_REVEALS[unlock] || {};
  const hs = stageElementsAt(rec, m[1], +m[2]), pts = hs.map(stagePointOf).filter(Boolean);
  if (!pts.length) return null;
  let x = 0, z = 0; for (const p of pts) { x += p[0] / pts.length; z += p[1] / pts.length; }
  const w = frame && frame.toWorld ? frame.toWorld(x, z) : [x, z];
  return { unlock, at: R.at || null, caption: R.caption || null, x: +w[0].toFixed(2), z: +w[1].toFixed(2), y: null,
           ids: hs.map(h => (h.layer === 'items' ? h.site.id + '/' : '') + h.e.id), dist: STAGE_SHOT.dist, el: STAGE_SHOT.el, az: 0.8, ms: STAGE_SHOT.ms };
}

// ---- THE QUEUE: never in flight -----------------------------------------------------------------------------------
// The page holds one: stageHost({ tracks: the tracks composed at load }). note(tracks, phase) when the career's tracks
// change (careerOnStop's unlock events) - in 'flight' it only queues; at('load' | 'rollout' | 'rollin') answers what to
// compose: { apply: tracks | null, reveals: [...] } and takes the queue. A flight's stop is still 'flight' (the world
// the aeroplane stands in is the one it flew in); the next roll-out or roll-in composes.
const STAGE_PHASES = ['load', 'rollout', 'rollin', 'flight'];
function stageHost(o) {
  const st = { composed: (o && o.tracks) || null, pending: null, log: [] };
  return {
    get composed() { return st.composed; }, get pending() { return st.pending; }, log: st.log,
    note(tracks, phase) {
      if (STAGE_PHASES.indexOf(phase) < 0) throw new Error('stages: unknown phase ' + phase);
      const want = tracks || null;
      if (stageKey(want) === stageKey(st.pending || st.composed)) return { queued: false, apply: null };
      if (phase === 'flight') { st.pending = want; st.log.push({ phase, key: stageKey(want), queued: true }); return { queued: true, apply: null }; }
      st.pending = want; return this.at(phase);
    },
    at(phase) {
      if (STAGE_PHASES.indexOf(phase) < 0) throw new Error('stages: unknown phase ' + phase);
      if (phase === 'flight' || !st.pending || stageKey(st.pending) === stageKey(st.composed)) { if (phase !== 'flight') st.pending = null; return { apply: null, reveals: [] }; }
      const from = st.composed, to = st.pending;
      st.composed = to; st.pending = null;
      st.log.push({ phase, key: stageKey(to), applied: true });
      return { apply: to, reveals: stageRevealsBetween(from, to) };
    },
  };
}
