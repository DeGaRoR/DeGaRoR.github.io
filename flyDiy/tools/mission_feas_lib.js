// mission_feas_lib.js - MISSION-FEASIBILITY: EVERY MISSION OF THE PACKS FLOWN THE WAY THE GAME FLIES IT, BEFORE THE USER
// PLAYS IT. The user (13 Nov 2026): "reasonably tested so that when I start playing I have fun and I'm not just fixing
// bugs"; THE HARD RULE: what happens in node is EXACTLY what happens in the game - start where the game starts you (the
// stand), TAXI, line up, take off, fly, land, taxi to the stand, load / unload as the game does. No teleport, no skipped
// taxi, no simplified physics.
//
// NOTHING HERE IS A NEW SIM. Every piece is the game's own code, called in the order the page calls it:
//   THE WORLD      Jolene with every solid thing within 700 m of a strip, as the page registers it (_tour_lib tourWorld,
//                  GATE TOUR's world)
//   THE AEROPLANE  the career's airframe: CONTRACT_DESIGNS' build file (76_procure procureBaseSpec) through the LOAD DOOR
//                  (tools/_load_build.js gameSpec - the join, the energy layer's tanks: the spec the game flies), damage
//                  as the page leaves it (the solver's default, GEN_DAMAGE_DEFAULT)
//   THE FLIGHT     src/viewer/sim_host.js makeSimHost - the physics worker's own host: app.js applyRoute's placement (the
//                  stand walked out of the career's main shed - standFor / playerShedDims of THIS career document -, the
//                  wheels seated, the site's departure: the taxi out), app.js mkPilot's pilot (the garage's shakedown, the
//                  nav), one step = the commands due, ap.update, sim.step(1/60), the day's tick. Each next flight is the
//                  page's FLY ON (app.js nextLeg: flightLeg's From under the aeroplane, the 'leg' command, a fresh pilot,
//                  the same sim, no reset, no teleport). TAXI-HOME (app.js arriveFor): a flight to the plane's own field
//                  (HOME) taxis in to its stand and stops there.
//   THE DAY        the career's (74_career careerDay through day_clock.js DAY_CLOCK.career: its instant, the season's
//                  weather plan), ticked every step by the host; a time window waited out on the ground the career's way
//                  (75_ careerWaitWindow -> 07b dayWaitUntil -> the host's 'setDay', the page's DAY_CLOCK.wait)
//   THE MISSION    the pack installed over CONTRACT_PROVIDERS (73b missionPackInstall, as GATE MISSIONS installs it), a
//                  fresh career (careerNew) with the mission on offer (its `after` missions in the done list, the
//                  provider's reputation at its `rep`), careerAccept - tracked
//   THE LOAD       FREIGHT-STRAP's: the tracked job's load placed by the packer (78_ freightStrapNext = the loading
//                  view's proposal, accepted) before the first roll-out and after every stop, its masses on the build that
//                  flies (freightStrapAdds -> the host's 'freight' command / init.freight); a delivered load leaves the
//                  record (77_ freightLoadSettle). Passengers only: "they board, they don't fit" - no item, as the page
//   THE STOP       app.js careerStopApply's record (75_ careerStopRecord: the aerodrome flightWhere puts it on, the gear,
//                  the build's occupants, the load, the logbook row, the fields overflown frame by frame - careerFrame,
//                  the hour, the day's dusk / dawn, Deform's structural verdict) -> careerOnStop -> the career moves or says why
//   IN FLIGHT      a step at a point / a gate / a ring: 73c's tracker (missionTrackNew / missionTrackStep every step /
//                  missionTrackEvidence in the stop's `tracks`) - the brief's "use 73c directly" (MISSIONS-LIVE wires it
//                  into the page); the aeroplane is taken through it by the game's DRAWN ROUTE (38c ROUTE-DRAW, ap.flyRoute,
//                  end 'dest'), the way a player asks the autopilot for a course
// THE SHORTCUTS THIS RIG REFUSES (the brief): the host's skip to line-up (place.lineup) is never asked; no placeAtAerodrome
// on land; no settling steps; no second sim. Each run records the host's own placement so the gate can assert it.
// WHAT THE PAGE DOES NOT HAND THE STOP TODAY (and this rig therefore cannot either): a tie-down spot (park), the minutes
// waited (wait), who got on and off (embark / disembark). A mission that needs one is BROKEN (runtime) - reported, not faked.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const T = __dirname, ROOT = path.join(T, '..');
const PT = require(path.join(T, 'pilot_trace.js'));
PT.loadPanel();
const C = require(path.join(T, 'flight_core.js'));
const IN = require(path.join(T, 'island_node.js'));
const TR = require(path.join(T, '_tour_lib.js'));
const SH = require(path.join(ROOT, 'src', 'viewer', 'sim_host.js'));

const SLOT = 'feas';                     // the career airframe's slot (the saved build the flight rides)
const DT = 1 / 60;
const r1 = v => Math.round(v * 10) / 10;
const J = o => JSON.stringify(o);

// ---- THE PLANES: the official plane list's rows the career can fly as the game flies them ---------------------------------
// The career's airframes are CONTRACT_DESIGNS' (the market, the freight cards, contractCanDo's capabilities). A design is
// in the pool when its build file is a row of builds/lists/plane_lists.json on an official list (reproduction / story -
// the player's Official list; never 'legacy' test copies, never 'wip' / 'next' / 'archive') - so twinf (its file a test
// fixture) is out. The pool's order is CONTRACT_DESIGNS' own (cub, jodel, c172, c172f): the smallest capable first.
const OFFICIAL_LISTS = ['reproduction', 'story', 'original'];
function planeList() { return JSON.parse(fs.readFileSync(path.join(ROOT, 'builds', 'lists', 'plane_lists.json'), 'utf8')).planes; }
function planePool() {
  const rows = planeList().filter(r => OFFICIAL_LISTS.includes(r.list) && r.file && !r.rides);
  const out = [];
  for (const k of Object.keys(C.CONTRACT_DESIGNS)) {
    const D = C.CONTRACT_DESIGNS[k], row = rows.find(r => r.file === D.build);
    if (!row) continue;
    if (!fs.existsSync(path.join(ROOT, D.build))) continue;
    out.push({ design: k, file: D.build, name: row.name, reg: row.reg || null, list: row.list, n: row.n, card: (C.FREIGHT_CARDS[k] && C.FREIGHT_CARDS[k].hold) ? C.FREIGHT_CARDS[k] : null });
  }
  return out;
}
// THE WIDER POOL (STORY-REVAMP 22 Nov; opts.official, the CLI's --official): EVERY official plane, not only the career's
// validated designs - "this is a game about building planes": a mission no validated design can fly may still be flown
// by an aeroplane of the Official list the player can build or copy. Each extra row is measured here the way the
// snapshots are (tools/snapshots.js: genShakedown for the design row, tools/_freight_site.js for the hold's card) and
// stands in CONTRACT_DESIGNS / FREIGHT_CARDS under 'L<list n>' FOR THIS PROCESS ONLY (the game's tables are not written).
// The validated designs come first, in their order: the smallest capable career design still flies a mission it can.
let WIDE = null;
// `also` (the user 23 Nov: "you can really try any of the official planes. If it works with the PC6 or the DC3, it's OK"):
// plane-list numbers added to the pool whatever their list - the PC-6 stands on the wip list (57 on wheels, 58 on floats)
// `builds`: TEST BUILDS that stand on no list ("there would also be many ways to build a STOL Cessna, maybe you can even build
// a quick one to clear these. The players will not be limited to existing planes, they will modify them, and that's the
// point") - build files under the repo, [{ file, name }]; measured and flown as any other row, named as test builds
function widePool(also, builds) {
  const alsoN = (also || []).map(Number).filter(n => n > 0), tb = (builds || []).filter(b => b && b.file && fs.existsSync(path.join(ROOT, b.file)));
  const wk = alsoN.join() + '|' + tb.map(b => b.file).join();
  if (WIDE && WIDE.key === wk) return WIDE.out;
  const base = planePool(), have = new Set(base.map(p => p.file)), out = base.slice();
  let FSITE = null; try { FSITE = require(path.join(T, '_freight_site.js')); } catch (e) { FSITE = null; }
  // measured once a core and a build file (minutes for the whole list: the hold is swept off the mesh): kept in the OS
  // temp dir by content, as GATE CONTRACTS keeps its designs
  const crypto = require('crypto'), os = require('os');
  const coreSha = (fs.readFileSync(path.join(T, 'flight_core.js'), 'utf8').split('\n')[1] || '').slice(0, 200);
  const measure = r => {
    const h = crypto.createHash('sha256'); h.update(coreSha + '|' + r.file + '|'); h.update(fs.readFileSync(path.join(ROOT, r.file)));
    const f = path.join(os.tmpdir(), 'flydiy-feas-wide-' + h.digest('hex').slice(0, 16) + '.json');
    try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { /* measure */ }
    // (the FULL shakedown: planeDef's is the flight's lean one - no envelope, no take-off run)
    const P = planeDef(r.file), sp = P.spec, k = 'L' + r.n, s = C.genShakedown(C.buildGen(sp));
    const D = { id: k, label: r.name, build: r.file, gear: C.stripGear(sp) === 'floats' || s.gearType === 'floats' ? 'floats' : 'wheels', seats: s.envelope.seats,
                bagKg: (sp.cabin && sp.cabin.baggage) || 0, massKg: s.mass, emptyKg: s.empty, toM: s.TORun, cruiseKmh: s.VCruise * 3.6, rangeKm: s.rangeKm, spanM: s.span,
                cost: s.cost, tankL: s.energyL, power: s.energyKind };
    let card = null; try { card = FSITE ? FSITE.freightMeasureFile(r.file, D) : null; } catch (e) { card = null; }
    const M = { D, card };
    try { fs.writeFileSync(f, JSON.stringify(M)); } catch (e) { /* a read-only temp: measured every run */ }
    return M;
  };
  const extra = planeList().filter(r => alsoN.includes(r.n) && r.file && !r.rides && fs.existsSync(path.join(ROOT, r.file)) && !OFFICIAL_LISTS.includes(r.list));
  const tests = tb.map((b, i) => ({ n: 900 + i, name: b.name || path.basename(b.file, '.json') + ' (test build)', file: b.file, list: 'test' }));
  for (const r of officialRows().concat(extra, tests)) {
    if (have.has(r.file)) continue;
    have.add(r.file);
    try {
      const M = measure(r), D = M.D, card = M.card, k = D.id;
      if (![D.seats, D.massKg, D.emptyKg, D.toM, D.rangeKm].every(v => typeof v === 'number' && isFinite(v))) continue;
      C.CONTRACT_DESIGNS[k] = D;
      if (card) C.FREIGHT_CARDS[k] = card;
      out.push({ design: k, file: r.file, name: r.name, reg: r.reg || null, list: r.list, n: r.n, card: card && card.hold ? card : null, wide: true });
    } catch (e) { (widePool.skipped = widePool.skipped || []).push(r.name + ': ' + String(e && e.message || e).slice(0, 80)); }
  }
  WIDE = { key: wk, out };
  return out;
}
// the official rows a BUILD order is judged against (every official file: the player's own design could be any of them)
function officialRows() { return planeList().filter(r => OFFICIAL_LISTS.includes(r.list) && r.file && !r.rides && fs.existsSync(path.join(ROOT, r.file))); }

// the aeroplane as the game flies it, built once per file (the load door's spec, cached by _load_build)
const DEFS = {};
function planeDef(file) {
  if (DEFS[file]) return DEFS[file];
  const def = TR.defOf(C, PT, path.join(ROOT, file));
  const shake = C.genShakedown(C.buildGen(def.spec), { corners: false });
  return (DEFS[file] = { def, spec: def.spec, shake });
}

// (STORY-REVAMP, the wider pool) THE SEATS FILLED AS THE JOB ASKS. The stop counts the BUILD's occupants (the garage's seat-fill),
// and a build saved with its pilot alone is refused a passenger job it has the seats for - what a player settles in the
// garage before the flight. With opts.fill the build is flown with 1 + the job's passengers in its seats (never more than
// it has), by THE GARAGE'S OWN DOOR (balance.js / 64_ genLoadingEnvelope's corner): the spec the game flies, its cabin's
// pilots 1, pax n - 1, `occupied` null ("the first N seats"), built as any build - the mass and the pilot's speeds follow.
// (Writing cabin.occupied into the FILE does nothing: the load door's page chain rebuilds the cabin from the design - the
// first version of this did that and flew every "filled" plane with its pilot alone, 23 Nov.) The default (no fill) is the
// build as saved - GATE MISSIONFEAS's rows
function planeDefFilled(file, pax) {
  const base = planeDef(file), seats = base.spec.seats | 0, want = Math.min(seats, 1 + Math.max(0, pax | 0));
  if (!base.spec.cabin || want <= (base.spec.occupants != null ? base.spec.occupants : 1)) return base;
  const k = file + '#' + want;
  if (DEFS[k]) return DEFS[k];
  const cs = JSON.parse(JSON.stringify(base.spec));
  cs.cabin.pilots = 1; cs.cabin.pax = Math.max(0, want - 1); cs.cabin.occupied = null;
  const def = C.buildGen(cs);
  def.params = Object.assign({}, def.params, { damage: true });
  if ((def.spec.occupants | 0) !== want) return base;          // the build did not take the fill: flown as saved, and no note says otherwise
  const shake = C.genShakedown(C.buildGen(def.spec), { corners: false });
  return (DEFS[k] = { def, spec: def.spec, shake, filled: want });
}

// ---- THE PACKS ----------------------------------------------------------------------------------------------------
function readPacks(dir) {
  const D = dir || path.join(ROOT, 'src', 'missions');
  return fs.readdirSync(D).filter(f => /\.json$/.test(f)).sort().map(f => ({ file: path.relative(ROOT, path.join(D, f)).replace(/\\/g, '/'), pack: JSON.parse(fs.readFileSync(path.join(D, f), 'utf8')) }));
}
function spotsPack() {
  const w = {};
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'fleet_spots_pack.js'), 'utf8'), { window: w });
  return w.FLEET_SPOTS_PACK.aero;
}
// install a pack the way GATE MISSIONS does (the boot's merge): its contracts over the providers, its words over the text
const BASE_PROV = {};
for (const p of Object.keys(C.CONTRACT_PROVIDERS)) BASE_PROV[p] = { arc: C.CONTRACT_PROVIDERS[p].arc, builds: C.CONTRACT_PROVIDERS[p].builds, night: C.CONTRACT_PROVIDERS[p].night };
const BUILTIN = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'missions', 'builtin.json'), 'utf8'));
function installPack(pack) {
  // (STORY-REVAMP 22 Nov) THE PAGE'S OWN LOADER FIRST (73b missionPackUse, app.js CAREER_PACK): the pack's rules live
  // (no drawn job, a mission no validated design flies offered), its own clients in the providers table. A pack that
  // does not validate changes nothing there - the rig then installs it the old way so the static read can say what is
  // broken in it (the built-in pack first: no rule or client of the pack before is left standing)
  const U = typeof C.missionPackUse === 'function' ? C.missionPackUse(pack) : { ok: false };
  if (U.ok) return { providers: C.CONTRACT_PROVIDERS, held: U.held, text: {} };
  if (typeof C.missionPackUse === 'function') C.missionPackUse(BUILTIN);
  for (const p of Object.keys(BASE_PROV)) Object.assign(C.CONTRACT_PROVIDERS[p], BASE_PROV[p]);
  const I = C.missionPackInstall(pack);
  for (const p of Object.keys(I.providers)) if (C.CONTRACT_PROVIDERS[p]) for (const k of ['arc', 'builds', 'night']) C.CONTRACT_PROVIDERS[p][k] = I.providers[p][k];
  Object.assign(C.CONTRACT_TEXT, I.text);
  return I;
}

// ---- THE STATIC READ: broken before anything flies -------------------------------------------------------------------
const FLIGHT_DO = ['carry', 'fly', 'land', 'deliver', 'survey', 'photo', 'pass'];
// -> { broken: [why], blocked: [why], notes: [why] }
function staticCheck(pack, m, rec, W, spots) {
  const broken = [], blocked = [], notes = [];
  // the validator's lines that name this mission
  const why = C.missionPackValidate(pack, { spots });
  for (const w of why) if (w.indexOf(m.id) >= 0 && !broken.includes('validate: ' + w)) broken.push('validate: ' + w);
  if (!rec) { broken.push('missionToContract gave no record'); return { broken, blocked, notes }; }
  const A = id => W.aerodromes.find(a => a.id === id);
  const F = C.CONTRACT_FIELDS;
  rec.stages.forEach((st, i) => st.subs.forEach((s, j) => {
    const at = 'leg ' + (i + 1) + ' step ' + (j + 1) + ' (' + s.do + ')';
    for (const k of ['from', 'to', 'at']) if (s[k] != null && (!A(s[k]) || !F[s[k]])) broken.push(at + ': ' + k + ' ' + J(s[k]) + ' is no aerodrome of the game (' + (A(s[k]) ? 'not in CONTRACT_FIELDS' : 'not in the world') + ')');
    const P = s.place, kind = P && typeof P === 'object' ? ['pt', 'gate', 'ring', 'spot', 'site'].find(q => P[q] != null) : null;
    if (C.missionInFlight(s)) {
      if (!s.id) broken.push(at + ': an in-flight step with no id - 73c judges it by its id (hits[step id]): never done');
      const xz = kind === 'gate' ? [(P.gate[0][0] + P.gate[1][0]) / 2, (P.gate[0][1] + P.gate[1][1]) / 2] : kind === 'ring' ? [P.ring[0], P.ring[2]] : P.pt;
      const g = W.terrainH(xz[0], xz[1]), wat = W.waterH ? W.waterH(xz[0], xz[1]) : -Infinity, gnd = Math.max(g, wat);
      if (kind === 'ring' && P.ring[1] - (P.r || 8) < gnd + 2) broken.push(at + ': the ring at ' + P.ring[1] + ' m MSL is in the ground (' + r1(gnd) + ' m under it)');
      if (P.alt && P.alt.max != null) {
        const top = P.alt.ref === 'msl' ? P.alt.max : gnd + P.alt.max;
        if (top < gnd + 15) broken.push(at + ': the altitude band tops out ' + r1(top - gnd) + ' m over the ground: unflyable');
      }
      if (P.alt && P.alt.min != null && P.alt.max != null && P.alt.min >= P.alt.max) broken.push(at + ': the altitude band is empty (min ' + P.alt.min + ' >= max ' + P.alt.max + ')');
    }
    if (s.do === 'park') blocked.push(at + ': park on ' + J(P && P.spot) + ' - the page hands the stop no tie-down spot (stop.spot): never judged done');
    if (s.do === 'wait') blocked.push(at + ': wait ' + ((s.require && s.require.waitMin) || 0) + ' min - the page hands the stop no minutes waited (stop.waitedMin): never judged done');
    if (s.embark != null) blocked.push(at + ': embark ' + J(s.embark) + ' - the page hands the stop no boarding (stop.people.on)');
    if (s.disembark != null) blocked.push(at + ': disembark ' + J(s.disembark) + ' - the page hands the stop no boarding (stop.people.off)');
    if (kind === 'site' && !s.to && !s.at) broken.push(at + ': a site with no serving strip: no aerodrome to stop at');
  }));
  return { broken, blocked, notes };
}

// ---- THE DAY: the career's, as day_clock.js binds it ------------------------------------------------------------------
let DAYCTX = null;
function careerDaySpec(doc) {
  if (!DAYCTX) {
    DAYCTX = vm.createContext({ console, Math, JSON, Date });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'day_clock.js'), 'utf8') + '\n;this.DAY_CLOCK = DAY_CLOCK;', DAYCTX, { filename: 'day_clock.js' });
  }
  const w = C.makeWorld(0, {});
  DAYCTX.DAY_CLOCK.bind(w);
  DAYCTX.DAY_CLOCK.career({ get: () => C.careerDay(doc), put: () => {} });
  const sp = JSON.parse(JSON.stringify(w.day.spec()));
  DAYCTX.DAY_CLOCK.career(null);
  return sp;
}

// ---- THE CAREER WITH THE MISSION ACCEPTED ---------------------------------------------------------------------------
// the mission on offer the way a player gets there: every arc mission before it done, its `after` done, its provider's
// reputation at what it needs. -> { doc, why, effects }
function careerWith(rec, design) {
  let d = C.careerNew({ seed: 'feas' });
  d.career.airframes[SLOT] = { design, how: 'market', paid: 0 };
  const P = C.CONTRACT_PROVIDERS[rec.provider];
  const done = new Set();
  const needsOf = r => { const N = r.needs || {}; return ((N.after) || []).concat(...((N.of) || []).map(c => (c.ids || []).slice(0, c.n))); };
  const addAfter = id => { const r = C.careerContract(d, id); if (!r || done.has(id)) return; done.add(id); for (const a of needsOf(r)) addAfter(a); };
  for (const a of needsOf(rec)) addAfter(a);
  if (P && P.arc) { const i = P.arc.findIndex(r => r.id === rec.id); for (let k = 0; k < i; k++) addAfter(P.arc[k].id); }
  d.career.contracts.done = [...done].map(id => ({ id, t: 0 }));
  // (STORY-REVAMP) a project step's mission is on the board while its project stands at that step, the projects it
  // requires done (73b missionProjectNeeds, 74_ careerNeedsOk): the career as the steps before leave it
  const N0 = rec.needs || {};
  if (N0.project || (N0.projects || []).length) {
    d.career.projects = d.career.projects || {};
    if (N0.project) d.career.projects[N0.project.id] = { step: N0.project.step | 0 };
    for (const q of N0.projects || []) d.career.projects[q] = { step: 99, done: true };
  }
  if (P && d.career.providers[rec.provider]) d.career.providers[rec.provider].rep = Math.max(d.career.providers[rec.provider].rep || 0, (rec.needs && rec.needs.rep) || 0);
  d = C.careerNormalise(d); C.careerRefresh(d);
  const r = C.careerAccept(d, rec.id);
  if (!r.ok) {
    // why the game never offers it (74_ careerOfferIds' own tests, in its order)
    const N = [];
    if (!C.careerNeedsOk(d, rec)) N.push('its needs are not met with every mission before it done (' + J(rec.needs || {}) + ')');
    if (!C.contractCertifiable(rec)) N.push('held out: no certificate can answer it (73_ contractCertifiable)');
    if (P && (P.night || []).some(x => x.id === rec.id) && !C.contractFlyable(rec)) N.push('held out: no validated design can fly it (73_ contractFlyable)');
    return { doc: d, why: 'never offered in the game - ' + (N.join('; ') || r.why), offer: false, effects: [] };
  }
  return { doc: r.doc, why: '', effects: r.effects || [] };
}

// ---- WHAT THE PLAYER FLIES NEXT (the career's live state -> the next stop) ---------------------------------------------
// -> { to, route: [pts] | null, objs: [sub], blocked: why | null, why }
function nextTarget(doc, rec, cur) {
  const live = doc.career.contracts.live[rec.id];
  if (!live) return null;
  const st = rec.stages[live.stage];
  if (!st) return null;
  const open = st.subs.map((s, j) => ({ s, j })).filter(o => !live.subs[o.j]);
  const seq = st.order === 'seq';
  const cand = seq ? open.slice(0, 1) : open;
  // in-flight objectives of this leg, in order (a seq leg: the run of them at the head)
  const inflight = [];
  for (const o of (seq ? open : open)) { if (C.missionInFlight(o.s)) inflight.push(o); else if (seq) break; }
  if (inflight.length) {
    // the field the leg ends on: the first open field step after them, else where the aeroplane left from
    const after = open.find(o => !C.missionInFlight(o.s) && (o.s.to || o.s.at));
    const to = after ? (after.s.to || after.s.at) : cur;
    return { to, objs: inflight.map(o => o.s), why: 'in flight: ' + inflight.map(o => o.s.id || o.s.do).join(', ') + ', then ' + to };
  }
  for (const o of cand) {
    const s = o.s;
    if (s.do === 'park' || s.do === 'wait' || s.embark != null || s.disembark != null)
      return { blocked: 'step ' + (o.j + 1) + ' (' + s.do + (s.embark ? ' embark' : '') + (s.disembark ? ' disembark' : '') + '): the page hands the stop nothing to judge it on' };
    if (s.do === 'carry') return (live.picked[o.j] || cur === s.from) ? { to: s.to, why: 'carry ' + s.from + ' > ' + s.to } : { to: s.from, why: 'to ' + s.from + ' for the load (' + s.to + ' next)' };
    if (s.do === 'fly') return (s.from && cur !== s.from) ? { to: s.from, why: 'to ' + s.from + ' for the timed run' } : { to: s.to, why: 'fly ' + (s.from || cur) + ' > ' + s.to };
    if (s.do === 'survey') {
      if (s.from && cur !== s.from) return { to: s.from, why: 'to ' + s.from + ' for the survey' };
      return { to: s.from || cur, survey: s.at, why: 'survey ' + s.at + ' (overflown), back to ' + (s.from || cur) };
    }
    if (s.do === 'land' || s.do === 'deliver' || s.do === 'talk') return { to: s.to || s.at || cur, why: s.do + ' ' + (s.to || s.at || cur) };
    if (s.do === 'accept') return { to: cur, why: 'accept (a circuit)' };
  }
  return { blocked: 'no step of leg ' + (live.stage + 1) + ' has a flyable target' };
}

// the drawn route through the objectives (38c ROUTE-DRAW's record, end 'dest': on to the leg's To and land there)
const RUN_IN = 1800, RUN_OUT = 1200;
function routeFor(W, objs, survey, from) {
  const pts = [];
  const gnd = (x, z) => Math.max(W.terrainH(x, z), W.waterH ? W.waterH(x, z) : -Infinity);
  // (STORY-REVAMP, 23 Nov) THE COURSE'S ENTRY AND EXIT, AS A COMPETITOR FLIES THEM. Read off the flown tracks:
  //   - the entry point alone is a corner of its own: out of a field AHEAD of it (club.regular: HOME 3 km down the course)
  //     the turn onto the axis there is 160 deg, the pilot's fillet has no room, and the Jodel turned back 2 km short of
  //     the entry and joined the axis PAST the first gate (216 m wide). With `from` (the field the flight leaves) a turn
  //     of more than 75 deg at the entry is flown as a BASE TURN: a point abeam the entry on the field's side (1200 m
  //     out), moved back along the axis until the corner there is no more than ~110 deg, then the axis;
  //   - the run-in and the run-out are flown AT THE GATE'S OWN HEIGHT (msl), not 100 m over whatever ground lies there:
  //     a run-out on rising ground (club.regular's, 85 m up; club.tour's second leg, on the hill beside the strip) was a
  //     climb the profile moved EARLIER, and the last gate was crossed at 191 m (150 at most). A run-in point is never
  //     under 80 m of ground
  //   - THE PILOT'S PLANNER LOOKS 1500 m PAST EVERY LEG'S END, 300 m either side (44_vprofile.js, a leg's minimum en-route
  //     altitude), and moves a climb EARLIER: a run-out that points at high ground 1.5 km on (club.tour's second leg: the
  //     hills east of the strip, 519 m asked at the route's end) is a climb begun at the first gate - both gates crossed
  //     at 373 and 498 m. So the points added here are CHOSEN ON THE PLANNER'S OWN MEASURE (meaOf): the run-out the
  //     longest and straightest whose legs ask no more than the gate's height + 20 m (else turned 30 / 60 / 90 deg either
  //     way, else none); the base turn on the side the planner asks less of
  const meaOf = P => {
    if (!C.VPROFILE || typeof C.VPROFILE.plan !== 'function' || P.length < 2) return 0;
    try {
      const L = []; for (let k = 1; k < P.length; k++) L.push({ name: 'L' + k, A: [P[k - 1].x, P[k - 1].z], B: [P[k].x, P[k].z], hA: P[k - 1].alt, hB: P[k].alt });
      const vp = C.VPROFILE.plan(W, L, { h0: P[0].alt, margin: C.ROUTE_MARGIN || 60, gClimb: 0.06, gDesc: 0.06, gDescMax: 0.06 }, {});
      return vp ? Math.max(...vp.legs.map(l => l.mea)) : 0;
    } catch (e) { return 0; }
  };
  const axisPts = (cx, cz, dx, dz, hGate) => {
    const at = (x, z, clear) => ({ x, z, alt: Math.round(Math.max(hGate, gnd(x, z) + clear)), ref: 'msl', V: null });
    const gP = { x: cx, z: cz, alt: hGate };
    const entry = (runIn, flip) => {
      const E = { x: cx - runIn * dx, z: cz - runIn * dz }, eP = at(E.x, E.z, 80);
      if (!from || typeof from.x !== 'number') return flip ? null : [eP];
      const fx = from.x - E.x, fz = from.z - E.z, fl = Math.hypot(fx, fz) || 1;
      const turn = Math.acos(Math.max(-1, Math.min(1, (-fx * dx - fz * dz) / fl))) * 180 / Math.PI;
      if (turn <= 75) return flip ? null : [eP];
      const nx = -dz, nz = dx, lat = fx * nx + fz * nz, t = fx * dx + fz * dz, w = 1200;
      const side = (lat >= 0 ? 1 : -1) * (flip ? -1 : 1), sd = flip ? -Math.abs(lat) : Math.abs(lat);
      const b = Math.max(0, Math.round(2.75 * (w - sd) - t));
      if (b > (flip ? 1500 : 3000)) return null;               // a base turn that far back is no entry: another candidate
      const out = [at(E.x - b * dx + side * w * nx, E.z - b * dz + side * w * nz, 100)];
      if (b > 0) out.push(at(E.x - b * dx, E.z - b * dz, 80));
      return out.concat([eP]);
    };
    // the field's own side and the long run-in first; the first the planner asks no more than the gate's height + 40 m of,
    // else the one it asks least of
    let best = null, bestM = Infinity;
    for (const [runIn, flip] of [[RUN_IN, false], [1200, false], [RUN_IN, true], [1200, true]]) {
      const P = entry(runIn, flip);
      if (!P) continue;
      const m = meaOf(P.concat([gP]));
      if (m <= hGate + 40) return P;
      if (m < bestM) { best = P; bestM = m; }
    }
    return best || entry(RUN_IN, false) || [at(cx - RUN_IN * dx, cz - RUN_IN * dz, 80)];
  };
  const runOut = (cx, cz, dx, dz, hGate, trail) => {
    const g0 = { x: cx, z: cz, alt: hGate }, t0 = { x: cx + trail * dx, z: cz + trail * dz, alt: hGate };
    for (const deg of [0, 30, -30, 60, -60, 90, -90]) {
      const a = deg * Math.PI / 180, ux = dx * Math.cos(a) - dz * Math.sin(a), uz = dx * Math.sin(a) + dz * Math.cos(a);
      for (const d of (deg ? [900] : [RUN_OUT, 900, 600])) {
        const q = { x: t0.x + (d - trail) * ux, z: t0.z + (d - trail) * uz, alt: Math.round(hGate), ref: 'msl', V: null };
        if (meaOf([g0, t0, q]) <= hGate + 20) return [q];
      }
    }
    return [];
  };
  // the lead-in / lead-out: 600 m / 300 m, never more than 0.45 of the way from the objective before (no zig-zag back)
  let prev = null;
  const lead = (cx, cz, k) => { const d = prev ? 0.45 * Math.hypot(cx - prev[0], cz - prev[1]) : Infinity; prev = [cx, cz]; return Math.min(k, d); };
  const lastObj = objs.length ? objs[objs.length - 1] : null;
  for (const s of objs) {
    const P = s.place;
    if (P.gate) {
      const cx = (P.gate[0][0] + P.gate[1][0]) / 2, cz = (P.gate[0][1] + P.gate[1][1]) / 2;
      // the passing direction: the gate's `dir` (compass, 0 = -z), else across the gate line
      let dx, dz;
      if (typeof P.dir === 'number') { const a = P.dir * Math.PI / 180; dx = Math.sin(a); dz = -Math.cos(a); }
      else { const lx = P.gate[1][0] - P.gate[0][0], lz = P.gate[1][1] - P.gate[0][1], l = Math.hypot(lx, lz) || 1; dx = -lz / l; dz = lx / l; }
      const top = P.alt && P.alt.max != null ? (P.alt.ref === 'msl' ? P.alt.max - gnd(cx, cz) : P.alt.max) : 150;
      const bot = P.alt && P.alt.min != null ? (P.alt.ref === 'msl' ? P.alt.min - gnd(cx, cz) : P.alt.min) : 0;
      const agl = Math.max(bot + 10, Math.min(top - 30, 100));
      const firstObj = !prev;
      const li = lead(cx, cz, 600);
      // (STORY-REVAMP) THE FIRST GATE'S RUN-IN. The pilot flies a drawn route by its corners (43_ routeStart: the turn onto a leg
      // is a fillet), and out of the climb the turn onto the first gate's axis can be 120-150 deg: a fillet of that angle
      // rejoins the axis 2 to 4 turn radii past the corner - beyond a gate 600 m from it. Flown: club.regular's first gate
      // passed 280 to 790 m wide by four aeroplanes, club.tour's by 88 and 424 m, club.pylons' by 68 m (the Jodel). A
      // competitor lines up from far out: the first objective gets an entry point 1800 m before it on its axis (axisPts)
      if (firstObj) pts.push(...axisPts(cx, cz, dx, dz, gnd(cx, cz) + agl));
      pts.push({ x: cx - li * dx, z: cz - li * dz, alt: agl, ref: 'agl', V: null }, { x: cx, z: cz, alt: agl, ref: 'agl', V: null }, { x: cx + 0.5 * Math.min(li, 600) * dx, z: cz + 0.5 * Math.min(li, 600) * dz, alt: agl, ref: 'agl', V: null });
      // ...AND THE LAST GATE'S RUN-OUT: the route ends 300 m past its last objective and the way home begins - a turn back
      // (a fillet begun before the corner) and a climb the profile moves EARLIER for a slow climber. Flown: club.regular's
      // last gate crossed at 191 m by the Cub and the Jodel (150 m at most), at 98 m by the Cessna. An exit point on (runOut)
      if (s === lastObj) pts.push(...runOut(cx, cz, dx, dz, gnd(cx, cz) + agl, 0.5 * Math.min(li, 600)));
    } else if (P.ring) {
      let dx = 0, dz = -1;
      if (typeof P.dir === 'number') { const a = P.dir * Math.PI / 180; dx = Math.sin(a); dz = -Math.cos(a); }
      const firstObj = !prev;
      const li = lead(P.ring[0], P.ring[2], 600);
      if (firstObj) pts.push(...axisPts(P.ring[0], P.ring[2], dx, dz, P.ring[1]));
      pts.push({ x: P.ring[0] - li * dx, z: P.ring[2] - li * dz, alt: P.ring[1], ref: 'msl', V: null }, { x: P.ring[0], z: P.ring[2], alt: P.ring[1], ref: 'msl', V: null },
               { x: P.ring[0] + 0.5 * li * dx, z: P.ring[2] + 0.5 * li * dz, alt: P.ring[1], ref: 'msl', V: null });
    } else if (P.pt) {
      const A = P.alt || null;
      let alt = 300, ref = 'agl';
      if (A && A.min != null && A.max != null) { alt = (A.min + A.max) / 2; ref = A.ref || 'agl'; }
      else if (A && A.min != null) { alt = A.min + 100; ref = A.ref || 'agl'; }
      else if (A && A.max != null) { alt = Math.max(60, A.max - 50); ref = A.ref || 'agl'; }
      lead(P.pt[0], P.pt[1], 0);
      pts.push({ x: P.pt[0], z: P.pt[1], alt, ref, V: null });
    }
  }
  if (survey) { const a = W.aerodromes.find(q => q.id === survey); if (a) pts.push({ x: a.x, z: a.z, alt: 300, ref: 'agl', V: null }); }
  return pts.length ? { v: 1, id: 'feas', name: 'mission', end: 'dest', margin: C.ROUTE_MARGIN || 60, pts } : null;
}

// ---- ONE FLIGHT (a leg of the game's chain) ---------------------------------------------------------------------------
// H the host; first: the roll-out's start (already placed) else the page's FLY ON; -> the leg's record
function flyOne(ctx, cur, to, o) {
  const { H, W, rec } = ctx;
  const sim = H.sim;
  const A = id => W.aerodromes.find(q => q.id === id);
  const a = A(cur), b = A(to);
  const L = { from: cur, to, t: 0, phases: [], faults: [], verdicts: [], ok: false, route: o.route ? o.route.pts.length : 0, start: null, end: null };
  const cg0 = sim.cgPos();
  L.start = { x: r1(cg0[0]), z: r1(cg0[2]) };
  const arrive = ctx.arriveFor(to);
  if (o.first) H.queueCmd({ cmd: 'start' });
  else {
    // app.js nextLeg: legHere (flightLeg's From under the aeroplane), a fresh pilot, departFrom(cur, to), SIMW.leg
    const FL = C.flightLeg(W, C.stripGear(H.def), cg0[0], cg0[2], to, { legFrom: a });
    const from = (FL && FL.from) || a;
    if (FL && FL.from && FL.from.id !== cur) L.faults.push({ k: 'where', note: 'flightLeg put the From at ' + FL.from.id + ', not ' + cur });
    H.queueCmd({ cmd: 'leg', from: from.id, to: to === from.id ? 'CIRCUIT' : to, arrive });
  }
  if (o.route) H.queueCmd({ cmd: 'route', route: o.route });
  const T0 = o.tracker || null, over = [];
  const D0 = sim.damage ? JSON.parse(JSON.stringify(sim.damage())) : null;
  const tMax = o.tMax || 3600;
  let ph0 = null, airborne = false, endHow = null;
  const hour0 = W.day.localSeconds / 3600;
  for (let k = 0; k < tMax / DT; k++) {
    H.step();
    L.t += DT;
    const ap = H.ap, ph = ap.phase;
    if (ph !== ph0) { L.phases.push(ph); ph0 = ph; }
    const cg = sim.cgPos();
    if (!isFinite(cg[0]) || !isFinite(cg[1])) { L.faults.push({ k: 'nan', note: 'the solver went NaN' }); endHow = 'crashed'; break; }
    // the page's careerFrame (every frame): the fields overflown; the mission tracker's sample (73c)
    C.careerOverflewAdd(W, cg[0], cg[2], over);
    if (T0) {
      const agl = cg[1] - Math.max(W.terrainH(cg[0], cg[2]), W.waterH ? W.waterH(cg[0], cg[2]) : -Infinity);
      // the closest pass by each objective (the evidence for a miss: how far, how high)
      for (const ob of T0.objs) {
        const P = ob.place, c = P.gate ? [(P.gate[0][0] + P.gate[1][0]) / 2, (P.gate[0][1] + P.gate[1][1]) / 2] : P.ring ? [P.ring[0], P.ring[2]] : P.pt;
        if (!c) continue;
        const d = Math.hypot(cg[0] - c[0], cg[2] - c[1]), N = (L.near = L.near || {});
        if (!N[ob.key] || d < N[ob.key].d) N[ob.key] = { d: r1(d), agl: r1(agl), msl: r1(cg[1]), t: r1(L.t) };
      }
      // (STORY-REVAMP, COMPETE) the page's sample (app.js missionLiveFrame): + the wheels on the ground, the ground speed,
      // the heading / pitch / roll - what a STOL line and a gate's attitude are judged on
      const vv = sim.cgVel(), AX = sim.axes(), xA = AX[0], yU = AX[1], zLy = xA[2] * yU[0] - xA[0] * yU[2], R2D = 180 / Math.PI;
      const ev = C.missionTrackStep(T0, { t: sim.t != null ? sim.t : L.t, x: cg[0], z: cg[2], y: cg[1], agl,
        gnd: sim.wheelsOnGround() > 0, v: Math.hypot(vv[0], vv[2]), hdg: ((Math.atan2(-xA[0], xA[2]) * R2D) + 360) % 360,
        pitch: Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * R2D, roll: Math.atan2(zLy, yU[1]) * R2D });
      for (const e of ev) if (e.k === 'hit' || e.k === 'photo' || e.k === 'strike') (L.events = L.events || []).push({ k: e.k, key: e.key, t: r1(L.t) });
        else if (e.k === 'stol') (L.events = L.events || []).push({ k: 'stol', key: e.id, kind: e.kind, m: e.m, foul: e.foul || null, t: r1(L.t) });
    }
    if (!airborne && cg[1] - W.terrainH(cg[0], cg[2]) > 15) airborne = true;
    const Dm = sim.damage ? sim.damage() : null;
    if (Dm && Dm.over) { L.faults.push({ k: 'crash', note: 'the damage ended the flight: ' + (Dm.reason || '?') }); endHow = 'crashed'; break; }
    if (ph === 'STOPPED' && ap.report && ap.report.outcome === 'declined') { L.faults.push({ k: 'declined', note: ((ap.report.verdicts || []).find(v => v.code === 'takeoff-declined') || {}).note || 'the take-off was declined' }); endHow = 'stopped'; break; }
    if (ph === 'STOPPED' && L.t > 20) { endHow = 'stopped'; break; }
    if (ph === 'ABORT' && L.t > 20 && sim.wheelsOnGround && sim.wheelsOnGround() > 0) {
      const v = sim.cgVel(); if (Math.hypot(v[0], v[2]) < 0.5) { L.faults.push({ k: 'abort', note: 'the take-off was rejected' }); endHow = 'stopped'; break; }
    }
  }
  if (!endHow) { L.faults.push({ k: 'timeout', note: 'the flight took over ' + tMax + ' s' }); endHow = 'timeout'; }
  const ap = H.ap, cg = sim.cgPos();
  L.end = { x: r1(cg[0]), z: r1(cg[2]) };
  L.phase = ap.phase;
  L.verdicts = ((ap.report && ap.report.verdicts) || []).map(v => v.code + (v.note ? ': ' + v.note : ''));
  L.outcome = (ap.report && ap.report.outcome) || null;
  L.landing = (ap.report && ap.report.landing) || null;
  L.airborne = airborne;
  const D = sim.damage ? sim.damage() : null;
  if (D && D0 && D.yields > D0.yields) L.faults.push({ k: 'yield', note: (D.yields - D0.yields) + ' member(s) yielded', soft: true });
  if (D && D0 && D.breaks > D0.breaks) L.faults.push({ k: 'break', note: (D.breaks - D0.breaks) + ' member(s) broke', soft: true });
  if (D && D.propStrike && !(D0 && D0.propStrike)) L.faults.push({ k: 'prop-strike', note: 'the propeller struck', soft: true });
  L.fuel = sim.fuel ? r1(sim.fuel.litres) : null;
  L.overflew = over;
  L.how = endHow;
  L.hour0 = r1(hour0);
  // the stop: where it stands (38b flightWhere), and whether the page would call it an aerodrome stop
  const Wh = C.flightWhere(W, cg[0], cg[2]);
  L.where = Wh ? { kind: Wh.kind, aero: Wh.aero && Wh.aero.id } : null;
  L.atAero = endHow === 'stopped' && Wh && C.flightCanDepart(Wh) ? Wh.aero.id : null;
  // the stand: did the flight to the home field end on its stand (TAXI-HOME)
  if (arrive && ctx.stand) L.standDist = r1(Math.hypot(cg[0] - ctx.stand.x, cg[2] - ctx.stand.z));
  L.structural = (D && D.structural) ? { damaged: !!D.structural.damaged, why: D.structural.why || null, podFreight: D.structural.pod ? D.structural.pod.freight : undefined } : null;
  L.wrecked = endHow === 'crashed';
  L.t = r1(L.t);
  return L;
}

// ---- ONE MISSION ON ONE AEROPLANE ---------------------------------------------------------------------------------------
// -> { ok, verdict, why, legs: [...], timeS, career: { stage, done }, ... }
function flyMission(env, rec, plane, opts) {
  const o = opts || {};
  const { W } = env;
  const P = o.fill ? planeDefFilled(plane.file, o.fill) : planeDef(plane.file);
  const out = { plane: plane.name, design: plane.design, file: plane.file, legs: [], timeS: 0, stops: [], notes: [] };
  if (P.filled) out.notes.push('the seats filled as the job asks: ' + plane.name + ' flown with ' + P.filled + ' aboard (the garage\'s seat-fill)');
  let { doc, why, effects } = careerWith(rec, plane.design);
  if (why) { out.verdict = 'broken'; out.why = why; return out; }
  out.effects = effects;
  const card = plane.card || null;
  // the career's stand: the main shed's door at HOME (app.js applyRoute: standFor the player's shed of THIS document)
  const st = C.siteOf('HOME');
  const shedD = C.playerShedDims(doc, 'HOME', st);
  const stand = C.standFor(st, shedD, (x, z) => W.terrainH(x, z));
  // app.js arriveFor: the plane's own field (the roll hangar's base, HOME) - its main plot (site null) or its plot's own
  const sh = doc.sheds.HOME, ps = C.playerPlotSite(st, 'HOME', sh);
  const arriveFor = to => (to === 'HOME' ? ((ps && ps.own) ? { fieldId: 'HOME', site: ps.site, plotId: 'HOME' } : { fieldId: 'HOME', site: null, plotId: null }) : null);
  // the load before the roll-out: the loading view's proposal, accepted (78_ freightStrapNext - what the page places after a stop)
  const loadNow = () => {
    const N = C.freightStrapNext(doc, SLOT, card);
    if (N && N.how === 'proposed') doc = N.doc;
    const A = C.freightStrapFor(doc, SLOT, card ? card.id : null);
    const R = A ? C.freightStrapAdds(P.def, A, { card }) : null;
    return { adds: R ? R.adds : null, kg: R ? r1(R.kg) : 0, pax: A ? A.pax : 0, flags: R && card ? C.freightStrapFlags(A, card).map(f => f.say) : [], how: N ? N.how : 'none', why: N ? N.why : '' };
  };
  let load = loadNow();
  const first0 = rec.stages[0] && rec.stages[0].subs[0];
  // where the first flight leaves from: the career's base (rollFromId: HOME); a water-only aeroplane rolls out on the lane
  const gearK = C.stripGear(P.def);
  const wet = a => a && C.stripSurface(a).cls === 'water';
  // (sim_host place(): a float build is put on the first water lane of the world - its departure field)
  let cur = gearK === 'floats' ? ((W.aerodromes.find(wet) || {}).id || 'SEA') : 'HOME';
  // the host: the page's placement on the walked stand (no line-up skip), the career's day, its pilot, the load aboard
  const tgt0 = nextTarget(doc, rec, cur);
  if (!tgt0 || tgt0.blocked) { out.verdict = 'broken'; out.why = tgt0 ? 'runtime: ' + tgt0.blocked : 'no first target'; return out; }
  const day = careerDaySpec(doc);
  const H = SH.makeSimHost(C, {
    spec: P.spec,
    place: { from: cur, to: tgt0.to === cur ? 'CIRCUIT' : tgt0.to, stand: JSON.parse(J(stand)), seat: true, lineup: false, arrive: arriveFor(tgt0.to) },
    pilot: { kind: 'auto', shakedown: P.shake, nav: true }, withV: false, day, freight: load.adds || null,
  }, W);
  if (gearK === 'floats') out.notes.push('a float build: the page places it on the water lane ' + cur + ' (sim_host place / app.js applyRoute), the game\'s own spawn for floats');
  out.placed = { stand: { x: r1(stand.x), z: r1(stand.z) }, lineup: !!H.lineup, cg: (c => ({ x: r1(c[0]), z: r1(c[2]) }))(H.sim.cgPos()), mass: r1(H.sim.totalM), fuel: H.sim.fuel ? r1(H.sim.fuel.litres) : null, day: { date: day.date, utc: day.utc } };
  const ctx = { H, W, rec, arriveFor, stand };
  const book = [];
  let first = true, stall = 0, lastSig = '';
  const reach = (P.def.params.gen && P.def.params.gen.span) ? P.def.params.gen.span / 2 : undefined;
  for (let n = 0; n < (o.maxFlights || 8); n++) {
    const C_ = doc.career.contracts;
    if (C_.done.some(x => x.id === rec.id)) break;
    const tgt = first ? tgt0 : nextTarget(doc, rec, cur);
    if (!tgt) { out.why = 'the career has no live state for it'; break; }
    if (tgt.blocked) { out.blocked = tgt.blocked; break; }
    if (!W.aerodromes.some(a => a.id === tgt.to)) { out.why = 'the target ' + tgt.to + ' is no aerodrome'; break; }
    // a time window: waited out on the ground, the career's way (the page's Wait: one jump of the day)
    const ww = C.careerWaitWindow(doc, W.day);
    if (ww) {
      const r = C.dayWaitUntil(W.day, ww.target);
      if (r) { H.queueCmd({ cmd: 'setDay', day: { date: r.date, utc: r.utc } }); out.notes.push('waited for the window (' + ww.words + '): ' + r.date + ' ' + Math.round(r.utc) + ' s UT'); }
    }
    if (!first) {
      const L2 = loadNow();
      if (J(L2.adds) !== J(load.adds)) H.queueCmd({ cmd: 'freight', adds: L2.adds });
      load = L2;
    }
    // the mission's in-flight tracker (73c: the page makes one at departure for a contract with objectives)
    // (COMPETE) a leg with a STOL line open is tracked too, objectives or not (mission_live.js arm)
    const TN = C.missionTrackNew(rec, doc.career.contracts.live[rec.id], { reach });
    const T0 = tgt.objs || (TN.stol && TN.stol.length) ? TN : null;
    const route = (tgt.objs || tgt.survey) ? routeFor(W, tgt.objs || [], tgt.survey, W.aerodromes.find(q => q.id === cur) || null) : null;
    // (STORY-REVAMP, COMPETE) A LANDING LINE NAMES THE WAY IT IS LANDED. 73c measures a touchdown only when it runs the line's
    // `dir` (msrStolStep: within 90 deg) and every line of the stop must be measured - so the competitor lands THAT way,
    // whatever the wind; the pilot left to itself takes the wind's end and the event is "not measured" (club.spot flown: the
    // Cub and the Jodel both landed w2 from the far end). The harness plays the competitor: for this flight the field's
    // record names the line's way (aero.landHdg, 43_pilot dirAt's one-way rule), and is put back after it
    const lineWay = (TN.stol || []).find(S => S.kind !== 'takeoff' && typeof S.dir === 'number');
    const fieldRec = lineWay ? W.aerodromes.find(q => q.id === tgt.to) : null, hdg0 = fieldRec ? fieldRec.landHdg : null;
    if (fieldRec) {
      const r = lineWay.dir * Math.PI / 180;
      fieldRec.landHdg = Math.atan2(-Math.cos(r), Math.sin(r));
      const said = 'the ' + lineWay.id + ' ' + lineWay.kind + ' line names the landing way (' + lineWay.dir + ' deg): flown that way, whatever the wind';
      if (!out.notes.includes(said)) out.notes.push(said);
    }
    const L = flyOne(ctx, cur, tgt.to, { first, route, tracker: T0, tMax: o.tMax });
    if (fieldRec) fieldRec.landHdg = hdg0;
    first = false;
    L.why = tgt.why; L.load = { kg: load.kg, pax: load.pax, flags: load.flags, how: load.how };
    out.legs.push(L);
    out.timeS += L.t;
    // THE STOP (app.js careerStopApply)
    const S = H.def.spec;
    const FA = C.freightStopItems(doc, SLOT);
    const TL = C.careerTrackedLoad(doc);
    const cargoKg = FA ? Math.round(C.freightKg(FA)) : (TL ? TL.kg : 0);
    const stopIn = {
      how: L.how === 'crashed' ? 'crashed' : L.how === 'stopped' ? 'stopped' : 'aborted', aero: L.atAero, wrecked: L.wrecked, structural: L.structural, slot: SLOT,
      gear: C.stripGear(S), occupants: S.occupants != null ? S.occupants : 1, cargoKg, items: FA,
      row: { from: cur, to: tgt.to, t: H.ap ? H.ap.t : L.t }, overflew: L.overflew,
      hour: W.day.localSeconds / 3600, ...C.dayDuskDawnH(W.day),
    };
    if (T0) stopIn.tracks = { [rec.id]: C.missionTrackEvidence(T0) };
    const stop = C.careerStopRecord(stopIn);
    // the logbook row this flight writes (the acceptance's flights: takeoffAt / landAt are proved by doing them)
    book.push({ from: cur, to: tgt.to, at: stop.aero, sink: L.landing && L.landing.sink != null ? L.landing.sink : (L.airborne ? 0 : null), run: L.landing ? L.landing.run : null,
                occ: S.occupants != null ? S.occupants : 1, payloadKg: cargoKg, outcome: stop.aero ? null : 'off' });
    const hook = C.careerAcceptHook(crit => (o.verdictOf ? o.verdictOf(crit, P, stop, book) : null));
    const res = C.careerOnStop(doc, stop, { acceptVerdict: hook });
    const before = J(doc.career.contracts.live[rec.id] || null) + J(doc.career.contracts.done);
    if (res.ok) doc = res.doc;
    doc = C.freightLoadSettle(doc);
    // the career's clock: the world's day written back (app.js: careerDaySet at the flight's end)
    { const r = C.careerDaySet(doc, { date: W.day.date, utc: W.day.utc }); if (r.ok) doc = r.doc; }
    const ev = (res.events || []).filter(e => e && (e.id === rec.id || !e.id)).map(e => e.k + (e.sub != null ? ':' + e.sub : '') + (e.stage != null ? '@' + e.stage : ''));
    const said = res.untouched && res.untouched[rec.id];
    out.stops.push({ at: stop.aero, how: stop.how, load: stop.load, events: ev, why: said || null });
    L.stop = { at: stop.aero, events: ev, why: said || null };
    if (o.log) o.log(L);
    const after = J(doc.career.contracts.live[rec.id] || null) + J(doc.career.contracts.done);
    if (L.wrecked) { out.why = 'crashed: ' + (L.faults.find(f => f.k === 'crash' || f.k === 'nan') || {}).note; break; }
    if (L.how === 'timeout') { out.why = 'the flight did not end (' + L.t + ' s)'; break; }
    if (L.atAero) cur = L.atAero;
    else if (L.how === 'stopped') { out.why = 'stopped off any aerodrome (' + J(L.where) + ')'; break; }
    if (after === before && said && /^aboard /.test(said)) { out.why = 'the stop refuses the load: ' + said; break; }
    if (after === before) {
      stall++;
      const sig = cur + '>' + tgt.to;
      if (stall >= 2 || sig === lastSig) { out.why = 'no progress: ' + (said || 'the stop moved nothing') + (L.faults.length ? ' [' + L.faults.map(f => f.k).join(', ') + ']' : ''); break; }
      lastSig = sig;
    } else { stall = 0; lastSig = ''; }
  }
  out.timeS = r1(out.timeS);
  out.book = book;
  const live = doc.career.contracts.live[rec.id];
  out.completed = doc.career.contracts.done.some(x => x.id === rec.id);
  out.career = { stage: live ? live.stage : null, subs: live ? live.subs : null, done: out.completed };
  out.endAtStand = out.legs.length && out.legs[out.legs.length - 1].standDist != null ? out.legs[out.legs.length - 1].standDist : null;
  if (out.completed) { out.verdict = 'feasible'; out.why = out.why || ''; }
  else if (out.blocked) { out.verdict = 'broken'; out.why = 'runtime: ' + out.blocked; }
  else { out.verdict = 'infeasible'; out.why = out.why || 'not completed'; }
  return out;
}

// ---- A BUILD ORDER: which official planes answer its criteria (72_accept's static judge), then its delivery flown ---------
function buildCandidates(rec) {
  const crit = rec.stages.map(st => st.subs.map(s => s.crit || [])).flat(2).filter(Boolean);
  const rows = [];
  for (const r of officialRows()) {
    let P;
    try { P = planeDef(r.file); } catch (e) { rows.push({ name: r.name, file: r.file, err: String(e && e.message || e) }); continue; }
    const ev = C.acceptEvidence(P.def, { shake: P.shake, design: P.shake && P.shake.design, cert: P.def.cert ? { limit: P.def.cert.limit, ult: P.def.cert.ult } : undefined });
    const V = C.acceptVerdict(crit, ev);
    // ok: every criterion met; false: one FAILS; null: none fails, some wait on a flight (the logbook / the acceptance leg) or the bench
    const st = V.ok ? true : V.rows.some(x => x.status === 'fail') ? false : null;
    rows.push({ name: r.name, file: r.file, list: r.list, ok: st, rows: (V.rows || []).map(x => ({ k: x.k, state: x.status, value: x.value, need: x.need })) });
  }
  return { crit, rows };
}

// ---- THE PLAN FOR ONE MISSION: classify, choose, fly -------------------------------------------------------------------
function judgeMission(env, packRow, m, opts) {
  const o = opts || {};
  const { W, spots } = env;
  const pack = packRow.pack;
  const R = { pack: packRow.file, id: m.id, kind: m.kind || null, verdict: null, why: '', plane: null, timeS: 0, attempts: [], notes: [] };
  if (m.tutorial) { R.verdict = 'listing'; R.why = 'a tutorial listing (read-only: 79_story beat ' + m.tutorial + '), not a mission to fly'; return R; }
  installPack(pack);
  let rec = null;
  try { rec = C.careerContract(C.careerNew({ seed: 'feas' }), m.id) || C.missionToContract(m, { pack }); } catch (e) { R.verdict = 'broken'; R.why = 'the record: ' + (e && e.message); return R; }
  const S = staticCheck(pack, m, rec, W, spots);
  R.static = S;
  if (S.broken.length) { R.verdict = 'broken'; R.why = S.broken.join('; '); return R; }
  const subs = C.contractSubsOf(rec);
  const pool = o.official ? widePool(o.also, o.builds) : planePool();
  R.pool = pool.map(p => p.design);
  // on offer at all? (the career's own offer list, with everything before it done) - an order is judged on it first; a
  // job after the game's capability rule (its reason - the load, the gear, the strip - is the more specific one)
  const offerWhy = () => { const cw = careerWith(rec, pool[0].design); return cw.offer === false ? cw.why : ''; };
  if (rec.kind === 'build') { const w = offerWhy(); if (w) { R.verdict = 'infeasible'; R.why = w; return R; } }
  const isBuild = rec.kind === 'build';
  let order = [], paxAsk = 0;
  if (isBuild) {
    // the client's own airframe (startFrom: a design) is the one delivered; else the official planes that answer the order
    const BC = buildCandidates(rec);
    R.build = BC;
    if (rec.startFrom && C.CONTRACT_DESIGNS[rec.startFrom]) order = pool.filter(p => p.design === rec.startFrom);
    else {
      const okFiles = BC.rows.filter(r => r.ok === true).map(r => r.file);
      const maybe = BC.rows.filter(r => r.ok !== false && r.ok !== true).map(r => r.file);
      // ...that can fly the delivery at all (73_ contractCanDo on the delivery as a landing there: floats for the water)
      const flyable = p => C.contractCanDo(C.CONTRACT_DESIGNS[p.design], subs.map(s => (s.do === 'deliver' && s.to ? { do: 'land', to: s.to } : s)).filter(s => s.do !== 'deliver' && s.do !== 'accept'), C.CONTRACT_FIELDS).ok;
      order = pool.filter(p => okFiles.includes(p.file) && flyable(p)).concat(pool.filter(p => maybe.includes(p.file) && flyable(p)));
      if (!order.length) {
        const anyOk = BC.rows.some(r => r.ok === true), anyMaybe = BC.rows.some(r => r.ok !== false && r.ok !== true);
        R.verdict = anyOk ? 'feasible' : anyMaybe ? 'untested' : 'infeasible';
        const best = k => { const v = BC.rows.map(r => (r.rows || []).find(x => x.k === k)).filter(Boolean); const okR = BC.rows.filter(r => (r.rows || []).some(x => x.k === k && x.state === 'ok')).map(r => r.name);
          return k + ' ' + (okR.length ? 'met by ' + okR.slice(0, 3).join(' / ') : 'met by none (' + v.slice(0, 4).map(x => x.state + (x.value != null ? ' ' + x.value : '')).join(', ') + ')'); };
        const okNames = BC.rows.filter(r => r.ok !== false).map(r => r.name);
        R.why = anyOk ? 'an official plane answers every criterion (' + okNames.join(', ') + '; not a career design: its delivery is not flown here)'
          : anyMaybe ? 'no criterion fails on ' + okNames.join(', ') + ' (not a career design: untested here - ' + BC.crit.map(c => c.k).join(', ') + ')'
          : 'no official plane meets the order (' + BC.rows.length + ' planes): ' + BC.crit.map(c => best(c.k)).join('; ');
        if (!anyOk && !anyMaybe) return R;
        R.untested = true;
        return R;
      }
    }
  } else {
    const doers = C.contractDoers(subs, C.CONTRACT_FIELDS, Object.fromEntries(pool.map(p => [p.design, C.CONTRACT_DESIGNS[p.design]])));
    R.doers = doers;
    order = pool.filter(p => doers.includes(p.design));
    // (the wider pool) the career's designs first, as before; then the others THE SHORTEST TAKE-OFF RUN FIRST - what a short
    // strip asks for is tried before what merely carries the load
    if (o.official) order = order.filter(p => !p.wide).concat(order.filter(p => p.wide).sort((a, b) => C.CONTRACT_DESIGNS[a.design].toM - C.CONTRACT_DESIGNS[b.design].toM));
    // THE SEATS THE STOP COUNTS: app.js careerStopApply hands careerStopRecord the BUILD's occupants (spec.occupants - the
    // garage's seat-fill), not the job's passengers (a passengers-only job has no loading-view door: "they board, they
    // don't fit"). A plane that seats too few for the job's passengers is tried last, and said
    const paxNeed = Math.max(0, ...subs.map(s => (s.load && s.load.pax) || 0));
    paxAsk = paxNeed;
    if (paxNeed > 0) {
      // (the wider pool fills the seats: what counts there is the seats the build HAS)
      const seatsOk = p => { const P = planeDef(p.file); return Math.max(0, (o.official ? (P.spec.seats | 0) : (P.spec.occupants != null ? P.spec.occupants : 1)) - 1) >= paxNeed; };
      const short = order.filter(p => !seatsOk(p));
      if (short.length) R.notes.push('the stop counts the build\'s occupants: ' + short.map(p => p.name + ' flies with ' + planeDef(p.file).spec.occupants + ' aboard (' + paxNeed + ' passenger(s) asked)').join('; '));
      order = order.filter(seatsOk).concat(short);
    }
    if (!order.length) {
      R.verdict = 'infeasible';
      const whys = pool.map(p => p.design + ': ' + C.contractCanDo(C.CONTRACT_DESIGNS[p.design], subs, C.CONTRACT_FIELDS).why);
      R.why = 'no official plane can do it (73_ contractCanDo): ' + whys.join('; ');
      return R;
    }
  }
  if (!isBuild) { const w = offerWhy(); if (w) { R.verdict = 'infeasible'; R.why = w; return R; } }
  if (S.blocked.length) R.notes.push(...S.blocked);
  if (o.dry) { R.verdict = 'unflown'; R.plane = order[0].name; R.why = 'would fly: ' + order.map(p => p.design).join(', '); return R; }
  const tries = Math.max(1, o.tries || 2);
  for (const plane of order.slice(0, tries)) {
    const verdictOf = (crit, Pd, stop, book) => {
      const ev = C.acceptEvidence(Pd.def, { shake: Pd.shake, design: Pd.shake && Pd.shake.design, cert: Pd.def.cert ? { limit: Pd.def.cert.limit, ult: Pd.def.cert.ult } : undefined,
                                             flights: book.slice() });
      return C.acceptVerdict(crit, ev);
    };
    const A = flyMission(env, rec, plane, { log: o.log, tMax: o.tMax, maxFlights: o.maxFlights, verdictOf, fill: o.official ? paxAsk : 0 });
    R.attempts.push(A);
    finalize({ attempts: [A] });
    if (A.verdict === 'feasible' || A.verdict === 'broken') break;
  }
  for (const A of R.attempts) finalize({ attempts: [A] });
  const best = R.attempts.find(a => a.verdict === 'feasible') || R.attempts.find(a => a.verdict === 'broken') || R.attempts[R.attempts.length - 1];
  R.verdict = best.verdict; R.why = best.why; R.plane = best.plane; R.timeS = best.timeS;
  if (isBuild && R.verdict !== 'feasible' && R.build && best.book) {
    // the order's criteria over what this plane proved (the static judge + the logbook these flights wrote): a criterion
    // that FAILS is infeasible; one that waits on the acceptance leg or the bench (not flown by this rig) is UNTESTED
    const Pd = planeDef(best.file), crit = R.build.crit;
    const V = C.acceptVerdict(crit, C.acceptEvidence(Pd.def, { shake: Pd.shake, design: Pd.shake && Pd.shake.design, cert: Pd.def.cert ? { limit: Pd.def.cert.limit, ult: Pd.def.cert.ult } : undefined, flights: best.book.slice() }));
    const fails = V.rows.filter(x => x.status === 'fail'), waits = V.rows.filter(x => x.status === 'needs-flight' || x.status === 'needs-test');
    const deliveredAt = best.stops.some(st => rec.stages.some(g => g.subs.some(u => u.do === 'deliver' && u.to === st.at)));
    R.criteria = V.rows.map(x => ({ k: x.k, status: x.status, value: x.value, need: x.need }));
    if (fails.length) { R.verdict = 'infeasible'; R.why = best.plane + ' fails the order: ' + fails.map(x => x.k + ' ' + x.value + ' (' + x.need + ')').join(', '); }
    else if (deliveredAt && waits.length) { R.verdict = 'feasible'; R.untested = true; R.why = 'delivery flown; untested here: ' + waits.map(x => x.k + ' ' + x.status + ' (' + x.need + ')').join(', '); }
  }
  return R;
}

// ---- THE HOLLOW PASS: the page ends ANY flight that STOPS as a stop (app.js: STOPPED -> playerFlightEnd('stopped')), so
// a flight that never left the ground still hands the career a stop where it stands - and a 'land' step there is judged
// done on stop.aero alone. A mission completed that way is not flyable: the row says which flight stayed down and why.
function finalize(R) {
  if (!R || !R.attempts || !R.attempts.length) return R;
  for (const A of R.attempts) {
    const down = (A.legs || []).filter(L => !L.airborne);
    A.grounded = down.map(L => ({ from: L.from, to: L.to, t: L.t, phases: L.phases.slice(-6).join('>'), said: (L.verdicts || []).filter(v => /hold|lineup|taxi|declin|stuck|gave|wait/i.test(v)).slice(-2) }));
    if (A.verdict === 'feasible' && down.length) {
      A.verdict = 'infeasible';
      A.why = 'never took off on ' + down.map(L => L.from + ' > ' + L.to + ' (' + Math.round(L.t) + ' s on the ground: ' + L.phases.slice(-6).join('>') + ')').join('; ') +
        ' - the page ended it as a stop and the career counted it (a step judged on stop.aero alone)';
    }
  }
  const best = R.attempts.find(a => a.verdict === 'feasible');
  if (R.verdict === 'feasible' && !best) { const a = R.attempts[R.attempts.length - 1]; R.verdict = a.verdict; R.why = a.why; R.plane = a.plane; R.timeS = a.timeS; }
  return R;
}

// ---- THE ENVIRONMENT (built once a process) ------------------------------------------------------------------------------
function makeEnv() {
  const TW = TR.tourWorld(C, IN, fs);
  return { W: TW.W, obstacles: TW.obstacles, trunks: TW.trunks, spots: spotsPack() };
}

// ---- THE TABLE ------------------------------------------------------------------------------------------------------
const fmtT = s => (s ? Math.floor(s / 60) + ' min ' + String(Math.round(s % 60)).padStart(2, '0') + ' s' : '-');
function legLine(L) {
  return (L.from + ' > ' + L.to).padEnd(20) + ' ' + String(Math.round(L.t)).padStart(5) + ' s  ' + (L.stop && L.stop.at ? 'stop ' + L.stop.at : 'no stop') +
    (L.stop && L.stop.events.length ? ' [' + L.stop.events.join(' ') + ']' : '') + (L.stop && L.stop.why ? ' (' + L.stop.why + ')' : '') +
    (L.load && (L.load.kg || L.load.pax) ? ' | aboard ' + L.load.kg + ' kg + ' + L.load.pax + ' pax' + (L.load.flags.length ? ' (' + L.load.flags.join('; ') + ')' : '') : '') +
    (L.standDist != null ? ' | ' + L.standDist + ' m from the stand' : '') + (L.faults.length ? ' | ' + L.faults.map(f => f.k).join(', ') : '');
}
function mdTable(rows) {
  const out = ['| pack | mission | kind | verdict | why | plane | time flown | flights |', '|---|---|---|---|---|---|---|---|'];
  for (const R of rows) {
    const att = R.attempts && R.attempts.length ? R.attempts.find(a => a.plane === R.plane) || R.attempts[0] : null;
    out.push('| ' + R.pack.replace(/^src\/missions\//, '') + ' | ' + R.id + ' | ' + (R.kind || '-') + ' | **' + R.verdict + '**' + (R.untested ? ' (untested criteria)' : '') + ' | ' +
      (R.why || '').replace(/\|/g, '/').slice(0, 400) + (R.notes && R.notes.length ? ' NOTE: ' + R.notes.join('; ').replace(/\|/g, '/').slice(0, 300) : '') + ' | ' + (R.plane || '-') + ' | ' + fmtT(R.timeS) + ' | ' +
      (att ? att.legs.map(L => L.from + '>' + L.to + (L.stop && L.stop.at ? '' : '(x)')).join(' ') : '-') + ' |');
  }
  return out.join('\n');
}

module.exports = { C, TR, SH, SLOT, planePool, widePool, officialRows, planeDef, planeDefFilled, readPacks, spotsPack, installPack, staticCheck, careerDaySpec, careerWith,
  nextTarget, routeFor, flyOne, flyMission, buildCandidates, judgeMission, finalize, makeEnv, mdTable, legLine, fmtT };
