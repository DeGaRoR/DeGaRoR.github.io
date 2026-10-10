// ===========================================================================
// THE CAREER DOCUMENT (G2240 CONTRACT-MODEL) — `flydiy.career.<id>`: a player
// document (70_player.js) with mode 'career' and a `career` block; its
// creation from the grant, its normaliser, the offers, accepting and tracking,
// and a flight's end applied to it. futureDesigns/GAME-2026-10-06.md §13.2,
// §R (GQ23 the grant, GQ26 the follow-up, GQ28 per-provider reputation,
// G-COST net pay), §11 (the tracks).
// ===========================================================================
// THE SHAPE (§13.2; the player document's v2 fields untouched, PLAYER_V unchanged — the `career` block rides
// along a v2 document exactly as any unknown field does, so no version step is spent here):
//   { what: 'flydiy-player', v, wallet, mode: 'career', here, clock, sheds, fleet, ledger,
//     career: {
//       id, seed, started, name, cv: CAREER_V,
//       day: { date: 'YYYY-MM-DD', utc: s },                            G2650 the sim clock's instant (forward only)
//       voucher: { kind: 'maker', model: 'cub', used: false },          GQ23
//       providers: { <id>: { rep: 0..5, arc: <arc contracts done> } },  GQ28
//       contracts: { offered: [id], accepted: [id], tracked: id|null, done: [ {id, at, pay, medal?} ],
//                    live: { <id>: { stage, subs: [bool], picked: [bool], got: {} } },
//                    sky: { epoch, date, cover } },                    G2665 the offers' sky (the night work's)
//       cover: 0..1,                                                    G2665 the day's cloud cover, as the page saw it
//       tracks: { field, minedock, resort, survey, clients },            §11.2 (mine + dock = one track)
//       pilots: {}, roster: [], market: { used: [], seen: 0 }, airframes: {} } }   (PILOTS / PROCURE fill these)
// A contract is NEVER stored whole: an authored one is looked up by id, a job regenerated from its id and the
// career seed, a follow-up from its chain (careerContract). `live` holds progress only.
//
// Pure: every operation works on a clone and returns { ok, doc, why, ... }; a refusal hands back the very
// document it was given, untouched. No DOM, no storage (app.js owns the localStorage glue, a later session).
// ===========================================================================
// v2 (G2650 SIM-CLOCK): the career carries its DAY - `career.day: { date, utc }`, the sim clock's instant (07_day.js
// DAY's date + UT second) - saved at a flight's end, a wait, a stop: the next session starts where the last one stopped.
// A v1 career had none; its day is the one its flown clock implies (CAREER_DAY0 + doc.clock seconds: the clock ran
// with flown time from the game's first day), lifted once by the normaliser. The career's day only moves FORWARD
// (careerDaySet refuses an earlier instant); the sandbox keeps its pref (day_clock.js) and every control.
const CAREER_V = 2;
// the career's first day: the game's day (viewer/day_clock.js GAME_DAY, 2026-06-21 16:00 AKDT) as UT
const CAREER_DAY0 = Object.freeze({ date: '2026-06-22', utc: 0 });
const CAREER_KEY = 'flydiy.career.';
const CAREER_GRANT = 60000;                                   // GQ23: the grant ...
const CAREER_VOUCHER = { kind: 'maker', model: 'cub' };      // ... and a free maker's Cub
const careerKey = id => CAREER_KEY + (id || 'main');
const crClone = o => JSON.parse(JSON.stringify(o));
const crNo = (doc, why) => ({ ok: false, doc, why });

function careerBlockDefault(o) {
  o = o || {};
  const providers = {};
  for (const p of Object.keys(CONTRACT_PROVIDERS)) providers[p] = { rep: 0, arc: 0 };
  const tracks = {};
  for (const t of Object.keys(CONTRACT_TRACKS)) tracks[t] = 0;
  return {
    id: o.id || 'main', seed: String(o.seed != null ? o.seed : 'jolene'), started: o.started || null,
    name: o.name || '', cv: CAREER_V,
    day: careerDayOk(o.day) ? careerDayNorm(o.day) : { date: CAREER_DAY0.date, utc: CAREER_DAY0.utc },
    voucher: Object.assign({}, CAREER_VOUCHER, { used: false }),
    providers,
    contracts: { offered: [], accepted: [], tracked: null, done: [], live: {} },
    tracks,
    pilots: {}, roster: [], market: { used: [], seen: 0 }, airframes: {},
  };
}

// THE CAREER'S MAIN HANGAR (G2315 WORKS-COZY; GAME-2026-10-06 §R GQ22: "it should be updated to the largest hangar
// probably, even though I find the medium one less intimidating and warmer. Main garage should be cozy"): the WORKS
// shell at its own 40 x 40 m, every kit, stood in the `cozy` layout (26_hangar_fit HANGAR_LAYOUTS) - the bench corner,
// the woodshop bay, the office, the lounge round the build bay. The sandbox keeps today's club (GQ29).
// G2318: the HEARTH (the cozy works with the life brought to the stand) is the default; 'cozy' (the rooms along the
// walls) is kept beside it for the user's pick (GARAGE_ENV.setLayout in a career)
const CAREER_MAIN = { shell: 'works', layout: 'hearth' };
function careerMainShed() {
  const L = (typeof HANGAR_LAYOUTS !== 'undefined') ? HANGAR_LAYOUTS[CAREER_MAIN.layout] : null;
  const S = (typeof SHELLS !== 'undefined') ? SHELLS[CAREER_MAIN.shell] : null;
  if (!L || !S) return null;                                   // a core without the hangar tables: the default stands
  return { shell: CAREER_MAIN.shell, dims: Object.assign({}, S.dims), kits: L.kits.slice(), layout: CAREER_MAIN.layout,
           base: 'HOME', tenure: 'own' };
}
// a main hangar nobody has touched yet: the player default's club (no dims, no dress, the default kits, no layout) -
// what every career made before G2315 holds; careerNormalise hands it the career's main hangar, once
function careerMainUntouched(h) {
  if (!h || typeof h !== 'object' || h.shell !== 'club' || h.layout || h.dims || h.parts) return false;
  const def = (typeof HANGAR_KITS_DEFAULT !== 'undefined') ? HANGAR_KITS_DEFAULT : null;
  return !!def && Array.isArray(h.kits) && h.kits.join() === def.join();
}

// A NEW CAREER (GQ23): a fresh player document in career mode — the main hangar at HOME, an empty fleet —
// the grant written into the ledger as income (so the history says where the money came from), the voucher
// unspent, every track at 0, and the first offers.
function careerNew(o) {
  o = o || {};
  const d = playerDefault();
  d.mode = 'career';
  const main = careerMainShed();
  if (main) d.sheds.HOME = main;
  d.career = careerBlockDefault(o);
  playerCharge(d, -CAREER_GRANT, 'grant', null);
  // G2290 (PILOTS): the companion arrives with the career (76_pilots.js; §9.2 "the first pilot comes with the opening")
  if (typeof pilotsCompanion === 'function') pilotsCompanion(d);
  return careerRefresh(d);
}

// THE NORMALISER: the player document's own (its walk first), then the career block filled where missing and
// carried verbatim where present (unknown fields ride along).
function careerNormalise(r) {
  const d = playerNormalise(playerMigrate(r && typeof r === 'object' ? r : null));
  d.mode = 'career';
  // G2315: a career made before the cozy works holds the player default's untouched club - it becomes the career's
  // main hangar (the base, the tenure and anything else on the record kept); a touched one is the player's, kept
  if (careerMainUntouched(d.sheds.HOME)) { const m = careerMainShed(); if (m) d.sheds.HOME = Object.assign({}, d.sheds.HOME, m, { base: d.sheds.HOME.base, tenure: d.sheds.HOME.tenure }); }
  const def = careerBlockDefault();
  const c = (d.career && typeof d.career === 'object') ? d.career : (d.career = def);
  for (const k of ['id', 'seed', 'name']) if (typeof c[k] !== 'string') c[k] = def[k];
  if (typeof c.cv !== 'number') c.cv = 1;
  // v1 -> v2 (G2650): the day the flown clock implies, when the career has none of its own
  if (!careerDayOk(c.day)) c.day = careerDayNorm(dayFromAbs(dayAbs(CAREER_DAY0) + Math.max(0, +d.clock || 0)));
  else c.day = careerDayNorm(c.day);
  if (c.cv < CAREER_V) c.cv = CAREER_V;
  if (!c.voucher || typeof c.voucher !== 'object') c.voucher = def.voucher;
  if (!c.providers || typeof c.providers !== 'object') c.providers = {};
  for (const p of Object.keys(def.providers)) {
    const P = c.providers[p] = (c.providers[p] && typeof c.providers[p] === 'object') ? c.providers[p] : { rep: 0, arc: 0 };
    if (typeof P.rep !== 'number' || !isFinite(P.rep)) P.rep = 0;
    P.rep = Math.max(0, Math.min(CONTRACT_GEN.repMax, P.rep));
    if (typeof P.arc !== 'number' || !isFinite(P.arc) || P.arc < 0) P.arc = 0;
  }
  const C = c.contracts = (c.contracts && typeof c.contracts === 'object') ? c.contracts : def.contracts;
  for (const k of ['offered', 'accepted', 'done']) if (!Array.isArray(C[k])) C[k] = [];
  if (typeof C.tracked !== 'string' || !C.accepted.includes(C.tracked)) C.tracked = C.accepted[0] || null;
  if (!C.live || typeof C.live !== 'object') C.live = {};
  for (const id of C.accepted) if (!C.live[id] || typeof C.live[id] !== 'object') C.live[id] = { stage: 0, subs: [], picked: [], got: {} };
  if (!c.tracks || typeof c.tracks !== 'object') c.tracks = {};
  for (const t of Object.keys(def.tracks))
    if (typeof c.tracks[t] !== 'number' || !isFinite(c.tracks[t]) || c.tracks[t] < 0) c.tracks[t] = 0;
  for (const k of ['pilots', 'airframes']) if (!c[k] || typeof c[k] !== 'object' || Array.isArray(c[k])) c[k] = {};
  if (!Array.isArray(c.roster)) c.roster = [];
  if (!c.market || typeof c.market !== 'object') c.market = def.market;
  // G2290 (PILOTS): the roster's rows (76_pilots.js pilotsBlock: unknown ids dropped, a hired pilot always has a row)
  if (typeof pilotsBlock === 'function') pilotsBlock(d);
  return d;
}

// ---- THE CAREER'S DAY (G2650 SIM-CLOCK) ---------------------------------------------------------------------------
const careerDayOk = o => !!(o && typeof o === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) && typeof o.utc === 'number' && isFinite(o.utc));
// one instant, one spelling: the utc in [0, 86400) on its own UT date (whole seconds: the document is a save)
const careerDayNorm = o => { const r = dayFromAbs(Math.round(dayAbs(o))); return { date: r.date, utc: r.utc }; };
function careerDay(doc) {
  const c = doc && doc.career;
  return careerDayOk(c && c.day) ? careerDayNorm(c.day) : careerDayNorm(dayFromAbs(dayAbs(CAREER_DAY0) + Math.max(0, +(doc && doc.clock) || 0)));
}
// the career's day moves to `o` ({date, utc}) - FORWARD ONLY: an earlier instant is refused (the career never goes
// back; a wait, a flight's end, a stop all move it on). The same instant is a no-op that still answers ok.
function careerDaySet(doc, o) {
  if (!doc || !doc.career) return crNo(doc, 'not a career');
  if (!careerDayOk(o)) return crNo(doc, 'not a day: ' + JSON.stringify(o));
  const now = careerDay(doc), to = careerDayNorm(o), dt = dayAbs(to) - dayAbs(now);
  if (dt < 0) return crNo(doc, 'the career\'s clock only moves forward (' + now.date + ' ' + Math.round(now.utc) + ' s UT, asked ' + to.date + ' ' + Math.round(to.utc) + ' s)');
  const d = crClone(doc);
  d.career.day = to;
  return { ok: true, doc: d, why: '', dt };
}

// ---- THE OFFERS' SKY (G2665 NIGHT-OPS) -----------------------------------------------------------------------------
// The night work is drawn under the sky of the day the offers were made (73_ contractSky): the career's LOCAL date
// when this epoch's offers came, and the day's cloud cover as the page last saw it (`career.cover`, 0..1: overcast = no
// moon light). Stamped as `contracts.sky = { epoch, date, cover }` by careerRefresh (a refresh that keeps the epoch keeps
// the stamp), so an offer holds while the clock moves on; a career with no stamp (or a new epoch not yet refreshed)
// reads it live off its clock. careerOfferSky(doc) -> 73_'s sky (or null: no night work).
function careerLocalDate(doc) {
  const d = careerDay(doc);
  try { return DAY.makeDay({ date: d.date, utc: d.utc }).localDate; } catch (e) { return d.date; }
}
function careerSkyStamp(doc) {
  const c = doc.career, e = contractEpoch(careerDoneIds(doc).length), S = c.contracts && c.contracts.sky;
  if (S && S.epoch === e && /^\d{4}-\d{2}-\d{2}$/.test(S.date) && typeof S.cover === 'number') return S;
  const cover = Math.max(0, Math.min(1, +c.cover || 0));
  return { epoch: e, date: careerLocalDate(doc), cover: Math.round(cover * 100) / 100 };
}
function careerOfferSky(doc) {
  if (!doc || !doc.career || typeof contractSky !== 'function') return null;
  const S = careerSkyStamp(doc);
  return contractSky(S.date, S.cover);
}

// ---- WHICH CONTRACT AN ID IS --------------------------------------------------------------------------------
const careerDoneIds = doc => doc.career.contracts.done.map(x => x.id);
function careerContract(doc, id) {
  if (!id) return null;
  const A = contractAuthored();
  if (A[id]) return A[id];
  const c = doc && doc.career;
  // an ACCEPTED generated job is the record as it was offered (its load drew on the reputation of that moment;
  // a later contract moving the reputation must not change a job already taken)
  const L = c && c.contracts && c.contracts.live && c.contracts.live[id];
  if (L && L.rec && typeof L.rec === 'object') return L.rec;
  if (/^job:/.test(id)) {
    const m = /^job:(\w+):/.exec(id);
    return contractJobById(c ? c.seed : '', id, { rep: c && m && c.providers[m[1]] ? c.providers[m[1]].rep : 0, sky: careerOfferSky(doc) });
  }
  if (/\+\d+$/.test(id)) return contractFollowById(id, A);
  // G2260 (ECONOMY, GQ6): the Field Trust's loan job, offered below the wallet's floor (76_ econLoanJob)
  if (/^loan:/.test(id) && typeof econLoanJob === 'function') return econLoanJob(doc, id);
  return null;
}
function careerNeedsOk(doc, rec) {
  const N = rec.needs || {}, P = doc.career.providers[rec.provider] || { rep: 0 };
  if ((N.rep || 0) > P.rep + 1e-9) return false;
  const done = careerDoneIds(doc);
  return (N.after || []).every(a => done.includes(a));
}

// ---- THE OFFERS -------------------------------------------------------------------------------------------------
// Per provider: the NEXT arc contract (its needs met), its standalone build contracts (needs met, not done),
// a follow-up for each delivered build contract (GQ26: the happy client comes back), and the jobs of this
// epoch (seed + completed count). Nothing accepted or done is offered again (a job's id carries its epoch, so
// the next epoch's jobs are new ones). Reputation never hides a tab (g7): it scales the jobs' loads.
function careerOfferIds(doc) {
  const c = doc.career, C = c.contracts;
  const done = careerDoneIds(doc), taken = new Set(done.concat(C.accepted));
  const out = [];
  const A = contractAuthored(), sky = careerOfferSky(doc);
  for (const p of Object.keys(CONTRACT_PROVIDERS)) {
    const P = CONTRACT_PROVIDERS[p];
    const next = P.arc.find(r => !done.includes(r.id));
    // (G2320) a contract the certificate cannot answer is HELD OUT (73_ contractCertifiable: the aerobatic box)
    if (next && !taken.has(next.id) && careerNeedsOk(doc, A[next.id]) && contractCertifiable(A[next.id])) out.push(next.id);
    for (const b of P.builds || []) if (!taken.has(b.id) && careerNeedsOk(doc, A[b.id]) && contractCertifiable(A[b.id])) out.push(b.id);
    // (G2665 NIGHT-OPS) the provider's authored night work, each once its needs are met - held out while no validated
    // design can fly it (73_ contractFlyable: the stretcher case)
    for (const r of P.night || []) if (!taken.has(r.id) && careerNeedsOk(doc, A[r.id]) && contractFlyable(A[r.id])) out.push(r.id);
    for (const j of contractJobs(c.seed, p, done.length, { rep: c.providers[p].rep, sky })) if (!taken.has(j.id)) out.push(j.id);
  }
  // G2260 (ECONOMY, GQ6): no bankruptcy - below the floor the Field Trust offers its loan job (76_ econLoanOffer)
  const loan = typeof econLoanOffer === 'function' ? econLoanOffer(doc) : null;
  if (loan && !taken.has(loan)) out.unshift(loan);
  // follow-ups: the last of each delivered build contract's chain
  const builds = done.filter(id => { if (/^job:/.test(id)) return false; const r = careerContract(doc, id); return r && r.kind === 'build'; });
  for (const id of builds) {
    const r = careerContract(doc, id), f = contractFollowUp(r);
    if (f && !taken.has(f.id) && contractCertifiable(f)) out.push(f.id);
  }
  return out;
}
function careerRefresh(doc) {
  doc.career.contracts.sky = careerSkyStamp(doc);          // (G2665) the offers' sky, held for the epoch
  doc.career.contracts.offered = careerOfferIds(doc);
  return doc;
}
function careerOffers(doc) {
  const d = careerRefresh(crClone(doc));
  return { ok: true, doc: d, offers: d.career.contracts.offered.map(id => careerContract(d, id)).filter(Boolean), why: '' };
}

// ---- ACCEPT, TRACK, ABANDON ---------------------------------------------------------------------------------------
// Accept many, track one (§8.2): accepting puts the contract in the list and, when none is tracked, tracks it.
function careerAccept(doc, id) {
  const C = doc.career && doc.career.contracts;
  if (!C) return crNo(doc, 'not a career');
  if (C.accepted.includes(id)) return crNo(doc, id + ' is already accepted');
  if (!careerOfferIds(doc).includes(id)) return crNo(doc, id + ' is not on offer');
  const rec = careerContract(doc, id);
  if (!rec) return crNo(doc, 'no contract ' + id);
  const d = crClone(doc), D = d.career.contracts;
  D.accepted.push(id);
  D.live[id] = { stage: 0, subs: rec.stages[0].subs.map(() => false), picked: rec.stages[0].subs.map(() => false), got: {} };
  if (rec.kind === 'job') D.live[id].rec = rec;            // the job as offered (careerContract reads it back)
  if (!D.tracked) D.tracked = id;
  careerRefresh(d);
  return { ok: true, doc: d, why: '' };
}
function careerTrack(doc, id) {
  const C = doc.career && doc.career.contracts;
  if (!C || (id !== null && !C.accepted.includes(id))) return crNo(doc, id + ' is not accepted');
  const d = crClone(doc);
  d.career.contracts.tracked = id;
  return { ok: true, doc: d, why: '' };
}
function careerAbandon(doc, id) {
  const C = doc.career && doc.career.contracts;
  if (!C || !C.accepted.includes(id)) return crNo(doc, id + ' is not accepted');
  const d = crClone(doc), D = d.career.contracts;
  D.accepted = D.accepted.filter(x => x !== id);
  delete D.live[id];
  if (D.tracked === id) D.tracked = D.accepted[0] || null;
  careerRefresh(d);
  return { ok: true, doc: d, why: '' };
}

// ---- A FLIGHT'S END, ON ONE CONTRACT ------------------------------------------------------------------------------
// contractOnStop(career, contract, stopRecord, hooks) -> { ok, doc, why, events }
//   ok true: the document ADVANCED (a sub done or a load picked up, a stage, the contract completed: paid, the
//   reputation, the stage unlock, the follow-up offered); ok false: the very document handed in, untouched,
//   with the reason. A build contract's criteria are never judged here: hooks.acceptVerdict (ACCEPT) is asked,
//   and a missing hook is "pending" (events carry { k: 'pending' }).
function contractOnStop(doc, contract, stop, hooks) {
  if (!doc || !doc.career) return crNo(doc, 'not a career');
  const id = typeof contract === 'string' ? contract : contract && contract.id;
  const C = doc.career.contracts;
  if (!id || !C.accepted.includes(id)) return crNo(doc, (id || 'no contract') + ' is not accepted');
  const rec = (typeof contract === 'object' && contract) ? contractNormalise(contract) : careerContract(doc, id);
  if (!rec) return crNo(doc, 'no contract ' + id);
  if (!stop || typeof stop !== 'object') return crNo(doc, 'no stop record');
  if (stop.wrecked) return crNo(doc, 'the aeroplane is wrecked: nothing is delivered');
  if (!stop.aero) return crNo(doc, 'stopped off an aerodrome: nothing is delivered');
  const L = C.live[id] || { stage: 0, subs: [], picked: [], got: {} };
  const st = rec.stages[L.stage];
  if (!st) return crNo(doc, id + ' has no stage ' + L.stage);
  const res = st.subs.map((s, j) => L.subs[j] ? { st: 'was' } : contractSubOnStop(rec, s, { picked: !!L.picked[j] }, stop, hooks, doc));
  if (!res.some(r => r.st === 'done' || r.st === 'picked')) {
    const r = res.find(x => x.st === 'no') || { why: 'nothing to do here' };
    const out = crNo(doc, r.why);
    if (r.pending) out.events = [{ k: 'pending', id, why: r.why }];
    return out;
  }
  const d = crClone(doc), D = d.career.contracts;
  const live = D.live[id] = D.live[id] || { stage: 0, subs: [], picked: [], got: {} };
  const events = [];
  let medal = live.medal || null;
  res.forEach((r, j) => {
    if (r.st === 'done') {
      live.subs[j] = true; live.picked[j] = false;
      Object.assign(live.got, r.got || {});
      if (r.medal) medal = live.medal = r.medal;
      events.push({ k: 'sub', id, stage: live.stage, sub: j });
    } else if (r.st === 'picked') {
      live.picked[j] = true;
      events.push({ k: 'picked', id, stage: live.stage, sub: j, at: stop.aero });
    }
  });
  if (st.subs.every((s, j) => live.subs[j])) {
    events.push({ k: 'stage', id, stage: live.stage });
    live.stage++;
    if (live.stage < rec.stages.length) {
      live.subs = rec.stages[live.stage].subs.map(() => false);
      live.picked = rec.stages[live.stage].subs.map(() => false);
    } else {
      careerComplete(d, rec, live, medal, events);
    }
  }
  return { ok: true, doc: d, why: '', events };
}
// the contract completed: paid net (G-COST), the provider's reputation (GQ28), the arc, the stage unlock (§11),
// the done list (the completed count the generator reads), and the offers refreshed (the follow-up among them)
function careerComplete(d, rec, live, medal, events) {
  const c = d.career, C = c.contracts;
  const pay = contractPayTotal(rec, live.got, medal);
  playerCharge(d, -pay, rec.loan ? 'loan' : 'contract', rec.id);   // G2260: the Trust's loan job writes a `loan` line
  const P = c.providers[rec.rep.provider] || (c.providers[rec.rep.provider] = { rep: 0, arc: 0 });
  P.rep = Math.max(0, Math.min(CONTRACT_GEN.repMax, +(P.rep + (rec.rep.gain || 0)).toFixed(3)));
  const prov = CONTRACT_PROVIDERS[rec.provider];
  if (prov && prov.arc.some(r => r.id === rec.id)) c.providers[rec.provider].arc++;
  let unlocked = null;
  if (rec.unlock && rec.unlock.stage) {
    const m = /^(\w+):(\d+)$/.exec(rec.unlock.stage);
    if (m) { c.tracks[m[1]] = Math.max(c.tracks[m[1]] || 0, +m[2]); unlocked = rec.unlock.stage; }
  }
  const row = { id: rec.id, at: Math.round(d.clock || 0), pay };
  if (medal) row.medal = medal;
  C.done.push(row);
  C.accepted = C.accepted.filter(x => x !== rec.id);
  delete C.live[rec.id];
  if (C.tracked === rec.id) C.tracked = C.accepted[0] || null;
  careerRefresh(d);
  events.push({ k: 'done', id: rec.id, pay, medal: medal || null, unlock: unlocked,
                followUp: rec.kind === 'build' ? ((contractFollowUp(rec) || {}).id || null) : null });
}

// ---- A FLIGHT'S END, ON THE CAREER -----------------------------------------------------------------------------------
// Every accepted contract (the tracked one first) meets the stop; the document comes back advanced by each that
// moved, with every event and, for those that did not move, why.
function careerOnStop(doc, stop, hooks) {
  if (!doc || !doc.career) return crNo(doc, 'not a career');
  const C = doc.career.contracts;
  const order = (C.tracked ? [C.tracked] : []).concat(C.accepted.filter(x => x !== C.tracked));
  let d = doc, moved = false;
  const events = [], why = {};
  for (const id of order) {
    const r = contractOnStop(d, id, stop, hooks);
    if (r.ok) { d = r.doc; moved = true; events.push(...r.events); }
    else { why[id] = r.why; if (r.events) events.push(...r.events); }
  }
  return moved ? { ok: true, doc: d, why: '', events, untouched: why } : { ok: false, doc, why: 'no contract moved', events, untouched: why };
}
