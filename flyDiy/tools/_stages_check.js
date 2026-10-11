#!/usr/bin/env node
// GATE STAGES (G2300-G2309, STAGES; contract v1.33; GAME-2026-10-06.md §11) - THE BUILDINGS THAT MISSIONS PUT UP.
//
//   node tools/_stages_check.js              -> "GATE STAGES: PASS|FAIL"
//   node tools/_stages_check.js --selftest   -> every rule turned red on a doctored input (negative verification)
//   node tools/_stages_check.js --show       -> every line, passed ones too
//
//   1 THE SANDBOX IS TODAY'S ISLAND, BYTE FOR BYTE: Jolene's record composed with no career (every track at its max)
//     hashes to the island cook's recorded `record` for BOTH variants (src/core/premises_packs.json - the cook of today's
//     fixture, made before any stage existed: sha256 of the composed record); every track AT ITS MAX composes the same
//     record and the same world (the terrain over the stages' places, the aerodromes); the record's stages obey the
//     sandbox's law (stageIssues with CONTRACT_TRACKS' maxes: a band through the max is open) and issues() is empty
//   2 EVERY STAGE COMPOSES: every value of every track (the others at their max) and every track at 0 - the staged
//     record valid, no compose issue the sandbox lacks, every kit's props in the prop registry and its frame a catalogue
//     entry, the village's plots the sandbox's at every value (a zone below its band still sows), the altiport 320 m
//     below resort:3 with its top end and stand where they were, East Point with no windsock and no tie-down spots
//     below survey:1, every staged site's pattern sound (sitePatternIssues)
//   3 TAXICLEAR AT EVERY STAGE (MILL-TAXI's census, tools/_taxiclear_lib.js): every stand, parked box and route of
//     every runway, for every validated build, keeps its half-span + 3 m off every solid thing - today's (the cook's
//     places) AND the stage's kits (their props' boxes, the frame's) - at every stage value composed in 2
//   4 NEVER IN FLIGHT: stageHost - a change noted in flight is queued, the flight phase applies nothing, the next
//     roll-out applies it once with its reveals; in the page (app.js) the stop's unlock reaches the host as 'flight' and
//     the only recompose is the 'stages' trip step (and world_boot.js at load) - a source check
//   5 THE UNLOCK -> STAGE MAPPING IS COMPLETE: every `unlock` of every provider's arc and builds has a STAGE_REVEALS
//     entry; every entry that says the world changes has elements in the record and a camera target; every band edge
//     in the record belongs to an entry that says so; the dev career's whole journey (every track 0 -> max) lists them
//   6 THE KITS ARE DATA OF EXISTING PROPS (GQ18): every kit prop is a key of tools/props_table.py or tools/pier_table.py
//     with a registry box; the frame is a catalogue key of an existing generator; no new asset
//   7 THE EDITOR'S SAVE: stageRestore(stageView(rec, t)) is the whole record at every stage value
// ~1-2 min (the island composed ~16 times, the census at each).
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const T = __dirname, ROOT = path.join(T, '..');
const SELFTEST = process.argv.includes('--selftest'), SHOW = process.argv.includes('--show');
const K = require(path.join(T, 'premises_cook.js'));
const { C, PG, GENS, CAT } = K.headless();
const L = require(path.join(T, '_taxiclear_lib.js'));
const FX = path.join(T, 'fixtures', 'island_jolene.json');

let bad = 0;
const check = (ok, what, detail) => {
  if (!ok) bad++;
  if (!ok || SHOW) console.log((ok ? '  ok   ' : '  FAIL ') + what + (detail ? '  (' + detail + ')' : ''));
  return ok;
};
const sha = o => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 16);
const MAX = C.stageMaxes();
const VARIANTS = K.VARIANTS;
const PACK = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'core', 'premises_packs.json'), 'utf8')).islands.find(i => i.id === 'jolene');

// ---- the rules, each a function of its inputs (so --selftest can hand each a doctored one) ----------------------------
const R = {};
// 1 the composed sandbox record's hash against the cook's
R.sandboxHash = (txt, variant) => {
  const V = VARIANTS.find(v => v.name === variant);
  const { O } = K.composeVariant('jolene', V, txt);
  const want = PACK.variants.find(v => v.name === variant).record;
  return { ok: sha(O.rec) === want, got: sha(O.rec), want, O };
};
R.sandboxLaw = rec => PG.stageIssues(rec, MAX).concat(PG.issues(rec));
// 4 the queue
R.queue = (H) => {
  const why = [];
  const h = H || C.stageHost({ tracks: { field: 0, minedock: 0, resort: 0, survey: 0, clients: 0 } });
  const n1 = h.note({ field: 1, minedock: 0, resort: 0, survey: 0, clients: 0 }, 'flight');
  if (!n1.queued || n1.apply) why.push('a change noted in flight was not only queued');
  const f = h.at('flight');
  if (f.apply) why.push('the flight phase applied a stage');
  if (C.stageKey(h.composed) !== C.stageKey({ field: 0, minedock: 0, resort: 0, survey: 0, clients: 0 })) why.push('the composition moved in flight');
  const r = h.at('rollout');
  if (!r.apply || r.apply.field !== 1 || !r.reveals.some(q => q.unlock === 'field:1')) why.push('the roll-out did not apply the queued stage with its reveal');
  const r2 = h.at('rollout');
  if (r2.apply) why.push('a second roll-out applied it again');
  const n2 = h.note({ field: 2, minedock: 0, resort: 0, survey: 0, clients: 0 }, 'rollin');
  if (!n2.apply || n2.apply.field !== 2) why.push('a change noted at a roll-in (a composition) was not applied there');
  return why;
};
// 4 the page: the unlock reaches the host as 'flight'; the recompose lives in the trip step and at load alone
R.pageSource = (app, boot) => {
  const why = [];
  if (!/stageNote\(res\.doc\)/.test(app) || !/STAGE_Q\.note\(stageTracksOf\(doc\), 'flight'\)/.test(app)) why.push('app.js: the stop\'s unlock does not reach the host as a flight-phase note');
  const calls = (app.match(/stageCompose\('(\w+)'\)/g) || []);
  if (calls.length !== 1 || calls[0] !== "stageCompose('rollout')") why.push('app.js: stageCompose is called ' + JSON.stringify(calls) + ' - only the roll-out\'s trip step may recompose');
  if (!/\{ id: 'stages', part: 'world'[^\n]*\n[^\n]*fn: \(\) => stageCompose\('rollout'\)/.test(app)) why.push('app.js: the stages trip step is not where the recompose is');
  if (/world\.premises\.set\(V\.rec\)/.test(app) && !/else world\.premises\.set\(V\.rec\)/.test(app)) why.push('app.js: a world.premises.set of a stage outside stageCompose');
  if (!/PREMISES_GEN\.stageView\(U\.rec, S\.tracks\)/.test(boot) || !/premisesPlaced = STAGE\.text \|\| premisesPlaced/.test(boot)) why.push('world_boot.js: the load does not compose the staged record');
  return why;
};
// 5 the mapping
R.mapping = (rec, REV, providers) => {
  const why = [], unlocks = new Set();
  for (const p of Object.values(providers)) for (const c of (p.arc || []).concat(p.builds || [])) if (c.unlock && c.unlock.stage) unlocks.add(c.unlock.stage);
  for (const u of unlocks) if (!REV[u]) why.push('unlock ' + u + ' has no STAGE_REVEALS entry');
  for (const u of Object.keys(REV)) {
    const m = /^(\w+):(\d+)$/.exec(u);
    if (!m || !(m[1] in MAX) || +m[2] < 1 || +m[2] > MAX[m[1]]) { why.push('STAGE_REVEALS ' + u + ' is not <track>:<1..max>'); continue; }
    const els = C.stageElementsAt(rec, m[1], +m[2]);
    if (REV[u].world && !els.length) why.push(u + ' says the world changes and no element of the record changes at it');
    if (!REV[u].world && els.length) why.push(u + ' says nothing changes and ' + els.length + ' elements do');
    if (REV[u].world && !C.stageReveal(rec, null, u)) why.push(u + ' has no camera target');
    if (!REV[u].caption || !C.contractTextOk(REV[u].caption)) why.push(u + ': its caption key does not resolve');
  }
  // every band edge in the record belongs to an entry
  const edge = (st, n) => { if (n >= 1 && !REV[st.track + ':' + n]) why.push('a band edge at ' + st.track + ':' + n + ' has no STAGE_REVEALS entry'); };
  const walk = st => { if (!st) return; const b = PG.stageBand(st); edge(st, b[0]); if (b[1] !== null) edge(st, b[1] + 1); for (const q of st.vary || []) { const v = PG.stageBand(q); edge(st, v[0]); if (v[1] !== null) edge(st, v[1] + 1); } };
  for (const Lr of Object.keys(rec.layers)) for (const e of rec.layers[Lr] || []) { if (!e) continue; walk(e.stage); if (Lr === 'sites') for (const it of e.items || []) walk(it && it.stage); }
  return why;
};
// 6 the kits
const tableKeys = f => new Set((fs.readFileSync(path.join(T, f), 'utf8').match(/P\('([a-z0-9_]+)'/g) || []).map(s => s.slice(3, -1)));
const PROPS_OK = new Set([...tableKeys('props_table.py'), ...tableKeys('pier_table.py')]);
const BB = L.propBoxes(C);
R.kits = KITS => {
  const why = [];
  for (const k of Object.keys(KITS)) {
    for (const p of KITS[k].props) { if (!PROPS_OK.has(p[0])) why.push('kit ' + k + ': ' + p[0] + ' is not an existing prop (props_table.py / pier_table.py)'); else if (!BB.has(p[0])) why.push('kit ' + k + ': ' + p[0] + ' has no registry box'); }
    if (KITS[k].fence && !PROPS_OK.has(PG.STAGE_FENCE.key)) why.push('kit ' + k + ': the fence ' + PG.STAGE_FENCE.key + ' is not an existing prop');
    const fk = KITS[k].frame ? PG.stageFrameKey(KITS[k].frame) : null;
    if (KITS[k].frame && !(fk && CAT.entries.get(CAT.aliases[fk] || fk))) why.push('kit ' + k + ': the frame ' + fk + ' is no catalogue entry');
  }
  return why;
};
// 3 the kits' solids for the census
const kitShapes = rec => {
  const out = [];
  for (const o of rec.layers.objects || []) {
    const m = /^(.+):(\d+|frame)$/.exec(String(o.id)); if (!m || !/^sg_/.test(m[1])) continue;
    if (o.kind === 'prop') { const b = BB.get(o.key); if (b) out.push(L.boxShape(o.id, 'kit', o.x, o.z, o.yaw || 0, b[0], b[2], b[3], b[5], b[4], 0)); }
    else if (o.P) { const hl = (+o.P.L || 4) / 2 + 0.3, hw = (+o.P.w || 3) / 2 + 0.3; out.push(L.boxShape(o.id, 'kit', o.x, o.z, o.yaw || 0, -hl, -hw, hl, hw, 3.5, 0)); }
  }
  return out;
};

if (SELFTEST) selftest(); else main();

function compose(W, rec, tracks) {
  return W.premises.set(rec, { catalogue: CAT, globals: GENS, build: r => (GENS[r.gen] ? GENS[r.gen].build(r.P, 0) : null), pool: [], tracks });
}
function vectors() {
  const out = [{ name: 'every track at 0', t: Object.fromEntries(Object.keys(MAX).map(k => [k, 0])) }];
  for (const k of Object.keys(MAX)) for (let v = 0; v < MAX[k]; v++) out.push({ name: k + ':' + v, t: Object.assign({}, MAX, { [k]: v }) });
  return out;
}

function main() {
  console.log('GATE STAGES');
  const t0 = Date.now(), txt = fs.readFileSync(FX, 'utf8'), whole = PG.normalise(JSON.parse(txt));
  // 1
  const sb = {};
  for (const v of ['default', 'town']) {
    const r = R.sandboxHash(txt, v); sb[v] = r;
    check(r.ok, '1 the sandbox (' + v + ') composes today\'s record byte for byte: the cook\'s hash', r.got + ' vs ' + r.want);
  }
  const law = R.sandboxLaw(whole);
  check(!law.length, '1 the record\'s stages obey the sandbox\'s law (a band through the max is open) and issues() is empty', law[0] || '');
  const VD = VARIANTS.find(v => v.name === 'default');
  const W = K.islandWorld('jolene', VD, txt);
  const recD = PG.dropPlaces(whole, VD.drop).rec;
  const O0 = sb.default.O, rec0 = O0.rec;
  const plotsOf = (O, z) => JSON.stringify(O.records.plots.filter(p => p.zone === z).map(p => [p.id, p.poly, p.pick]));
  const aeroOf = O => JSON.stringify(O.aerodromes.map(a => [a.id, a.x, a.z, a.len, a.wid, a.elev, a.surface, a.sock, a.ties]));
  const villageSandbox = plotsOf(O0, 'z_village'), aeroSandbox = aeroOf(O0);
  const OM = compose(W, recD, Object.assign({}, MAX));
  check(sha(OM.rec) === sha(rec0) && aeroOf(OM) === aeroSandbox, '1 every track at its max composes the sandbox (the record, the aerodromes)', sha(OM.rec));
  let samples = 0, diff = 0;
  for (const o of whole.layers.objects.filter(o => o.kind === 'kit')) for (let i = 0; i < 25; i++) { const x = o.x + (i % 5 - 2) * 8, z = o.z + (Math.floor(i / 5) - 2) * 8; samples++; if (OM.terrainAt(x, z) !== O0.terrainAt(x, z)) diff++; }
  check(diff === 0, '1 every track at its max: the ground over every stage\'s place is the sandbox\'s', samples + ' points, ' + diff + ' differ');
  // 6
  const kw = R.kits(PG.STAGE_KITS);
  check(!kw.length, '6 the kits are data of existing props and an existing generator: no new asset (GQ18: 0 of the 2 allowed)', kw[0] || Object.keys(PG.STAGE_KITS).join(', '));
  // 4
  const q = R.queue();
  check(!q.length, '4 never in flight: noted in flight it queues; the next roll-out applies it once, with its reveal; a roll-in composes', q[0] || '');
  const ps = R.pageSource(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'world_boot.js'), 'utf8'));
  check(!ps.length, '4 the page: the stop\'s unlock is a flight note; the recompose is the roll-out\'s trip step (and the load)', ps[0] || '');
  // 5
  const mp = R.mapping(whole, C.STAGE_REVEALS, C.CONTRACT_PROVIDERS);
  check(!mp.length, '5 every arc unlock maps to its stage; every band edge to an unlock; every world change has a camera target', mp[0] || Object.keys(C.STAGE_REVEALS).length + ' unlocks');
  const all = C.stageRevealsBetween(Object.fromEntries(Object.keys(MAX).map(k => [k, 0])), null);
  check(all.length === Object.values(MAX).reduce((a, b) => a + b, 0), '5 the whole journey (every track 0 -> max) reveals every stage once', all.length + ' reveals: ' + all.filter(r => r.world).length + ' with a building, ' + all.filter(r => !r.world).map(r => r.unlock).join(' ') + ' said, none drawn');
  // 2, 3, 7
  const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
  const VB = L.BUILDS.map(B => { const def = C.buildGen(PT.specOf(B.key).spec); return Object.assign({}, B, { def, dims: L.buildDims(C, def) }); });
  const SH = L.islandObstacles(C, 'jolene', 'default');
  const issues0 = new Set(O0.records.issues);
  let rows = 0, kitsSeen = 0;
  const skiTop = (() => { const r = whole.layers.runways.find(q => q.id === 'tw_ski'); return PG.runwayEnds(Object.assign({}, PG.RUNWAY_DEF, r)).end1; })();
  for (const V of vectors()) {
    const SV = PG.stageView(recD, V.t), O = compose(W, recD, V.t), tag = '[' + V.name + ']';
    const iss = PG.issues(SV.rec);
    check(!iss.length, '2 ' + tag + ' the staged record is valid', iss[0] || '');
    const newIss = O.records.issues.filter(i => !issues0.has(i));
    check(!newIss.length, '2 ' + tag + ' composes with no issue the sandbox lacks', newIss[0] || O.records.issues.length + ' (the sandbox\'s ' + issues0.size + ')');
    const kits = SV.rec.layers.objects.filter(o => /^sg_k_/.test(String(o.id)));
    kitsSeen += kits.length;
    check(kits.every(o => (o.kind === 'prop' ? BB.has(o.key) : !!CAT.entries.get(o.key))), '2 ' + tag + ' every kit object resolves (a registry prop, a catalogue frame)', kits.length + ' objects');
    check(plotsOf(O, 'z_village') === villageSandbox, '2 ' + tag + ' the village stands the sandbox\'s plots', O.records.plots.length + ' plots');
    const ski = O.aerodromes.find(a => a.id === 'tw_ski'), east = O.aerodromes.find(a => a.id === 'nv_strip');
    const wantLen = V.t.resort < 3 ? 320 : 380;
    const top = (() => { const r = SV.rec.layers.runways.find(q => q.id === 'tw_ski'); return PG.runwayEnds(Object.assign({}, PG.RUNWAY_DEF, r)).end1; })();
    check(ski && ski.len === wantLen && Math.hypot(top[0] - skiTop[0], top[1] - skiTop[1]) < 0.01, '2 ' + tag + ' the altiport is ' + wantLen + ' m, its top end where it was', ski ? ski.len + ' m' : 'missing');
    const eastBare = V.t.survey < 1;
    const spots = C.fleetSpots(east, C.siteOf('nv_strip'), {});
    check(!!east && (east.sock === false) === eastBare && (east.ties === false) === eastBare && (eastBare ? spots.spots.length === 0 : true), '2 ' + tag + ' East Point ' + (eastBare ? 'has no windsock and no tie-down spot' : 'has its windsock and its tie-downs'), 'sock ' + east.sock + ', ties ' + east.ties + ', ' + spots.spots.length + ' spots');
    for (const a of O.aerodromes) { const s = C.siteOf(a.id); if (!s || !s.stand) continue; const P = C.sitePattern(a, s, {}); const pi = C.sitePatternIssues(P, a, s, 6, C.patternPath); check(!pi.length, '2 ' + tag + ' ' + a.id + ' pattern sound', pi[0] || ''); }
    // 3 the census: today's solids + this stage's kits
    const IX = L.index(SH.concat(kitShapes(SV.rec)));
    const cen = L.census(C, W, IX, VB).filter(r => r.need !== null);
    rows += cen.length;
    const worst = cen.filter(r => !r.ok);
    check(!worst.length, '3 ' + tag + ' TAXICLEAR: every stand, parked box and route keeps its half-span + 3 m off every solid thing', worst.length ? worst[0].id + ' ' + worst[0].build + ' ' + worst[0].what + ' ' + worst[0].d.toFixed(2) + ' m to ' + worst[0].near : cen.length + ' rows');
    // 7
    const back = PG.stageRestore(JSON.parse(JSON.stringify(SV.rec)), SV);
    check(JSON.stringify(PG.normalise(back)) === JSON.stringify(PG.normalise(recD)), '7 ' + tag + ' the editor\'s save restores the whole record');
  }
  check(kitsSeen > 50 && rows > 500, '2/3 the stages were composed and censused', kitsSeen + ' kit objects, ' + rows + ' census rows over ' + vectors().length + ' stage values');
  compose(W, recD, undefined);   // the shared world back on the sandbox
  console.log('  ' + vectors().length + ' stage values composed and censused (' + rows + ' rows) in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
  console.log('GATE STAGES: ' + (bad ? 'FAIL (' + bad + ')' : 'PASS'));
  process.exit(bad ? 1 : 0);
}

// ---- NEGATIVE VERIFICATION: each rule red on a doctored input ---------------------------------------------------------
function selftest() {
  console.log('GATE STAGES --selftest');
  const txt = fs.readFileSync(FX, 'utf8'), whole = PG.normalise(JSON.parse(txt));
  let n = 0, red = 0;
  const must = (isRed, what) => { n++; if (isRed) red++; console.log((isRed ? '  red  ' : '  MISS ') + what); };
  const doc = f => { const r = JSON.parse(JSON.stringify(whole)); f(r); return r; };
  // 1: an added entry with no stage stands in the sandbox -> the cook's hash moves
  { const r = doc(r => r.layers.objects.push({ id: 'sg_doctored', kind: 'prop', key: 'drum_steel', x: 0, z: 0, yaw: 0 }));
    must(!R.sandboxHash(JSON.stringify(r), 'default').ok, '1 an entry added without a stage stands in the sandbox: the hash moves'); }
  // 1: a band through the max that is not open
  must(R.sandboxLaw(doc(r => { r.layers.sites.find(s => s.id === 's_club').items.find(i => i.id === 'hangar_long').stage.show = [2, 2]; })).length > 0, '1 a band closed at the max is refused (the sandbox and the max would differ)');
  must(R.sandboxLaw(doc(r => { r.layers.runways.find(q => q.id === 'tw_ski').stage.vary[0].show = [0, 3]; })).length > 0, '1 a vary through the max is refused');
  must(R.sandboxLaw(doc(r => { r.layers.runways.find(q => q.id === 'nv_strip').stage.vary[0].hdg = 1; })).length > 0, '1 a runway vary of a field a stage may not change is refused');
  must(R.sandboxLaw(doc(r => { r.layers.runways.find(q => q.id === 'tw_ski').stage.vary[0].len = 120; })).length > 0, '1 a varied strip under 150 m is refused');
  must(R.sandboxLaw(doc(r => { r.layers.objects.find(o => o.id === 'sg_k_mill').kit = 'crane'; })).length > 0, '1 a kit that is not data is refused');
  must(R.sandboxLaw(doc(r => { r.layers.links.push({ id: 'tw_l_doc', kind: 'cable', from: { site: 'mn_s_mine', item: 'mill', hook: 'a' }, to: { site: 'mn_s_mine', item: 'shop', hook: 'b' } }); })).length > 0, '1 a link to a staged item without a stage is refused');
  // 4: a host that applies in flight
  const leaky = { note: () => ({ queued: false, apply: { field: 1 } }), at: () => ({ apply: { field: 1 }, reveals: [] }), get composed() { return { field: 1 }; } };
  must(R.queue(leaky).length > 0, '4 a host that applies a stage in flight is caught');
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), boot = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'world_boot.js'), 'utf8');
  must(R.pageSource(app.replace("stageCompose('rollout') },", "stageCompose('rollout') },\n    ") + "\n  function flFrameX() { stageCompose('flight'); }", boot).length > 0, '4 a recompose called from the flight frame is caught');
  must(R.pageSource(app.replace("STAGE_Q.note(stageTracksOf(doc), 'flight')", "STAGE_Q.note(stageTracksOf(doc), 'rollout')"), boot).length > 0, '4 the stop\'s unlock applied at once (not queued) is caught');
  must(R.pageSource(app, boot.replace('premisesPlaced = STAGE.text || premisesPlaced', 'premisesPlaced = premisesPlaced')).length > 0, '4 a load that composes the whole record is caught');
  // 5: the mapping
  const REV = Object.assign({}, C.STAGE_REVEALS); delete REV['minedock:3'];
  must(R.mapping(whole, REV, C.CONTRACT_PROVIDERS).length > 0, '5 an arc unlock with no reveal entry is caught');
  must(R.mapping(whole, Object.assign({}, C.STAGE_REVEALS, { 'survey:2': Object.assign({}, C.STAGE_REVEALS['survey:2'], { world: true }) }), C.CONTRACT_PROVIDERS).length > 0, '5 a reveal that claims a building the record lacks is caught');
  must(R.mapping(doc(r => { r.layers.sites.find(s => s.id === 's_club').items.find(i => i.id === 'tools').stage = { track: 'clients', show: [2, null] }; }), Object.assign({}, C.STAGE_REVEALS, { 'clients:2': Object.assign({}, C.STAGE_REVEALS['clients:2'], { world: false }) }), C.CONTRACT_PROVIDERS).length > 0, '5 a band edge no reveal says is caught');
  // 6: a kit prop that is a download
  must(R.kits({ build: { fence: true, props: [['scaffold_tower', 0, 0, 0]] } }).length > 0, '6 a kit prop that does not exist (a scaffold to download) is caught');
  must(R.kits({ build: { fence: false, props: [], frame: { gen: 'CRANE_GEN', preset: 'tower', P: {}, at: [0, 0, 0] } } }).length > 0, '6 a frame no generator makes is caught');
  // 3: a kit on HOME's stand -> the census
  { const VD = VARIANTS.find(v => v.name === 'default'), W = K.islandWorld('jolene', VD, txt), recD = PG.dropPlaces(whole, VD.drop).rec;
    const r = JSON.parse(JSON.stringify(recD)); const k = r.layers.objects.find(o => o.id === 'sg_k_hangar'); const st = C.siteOf('HOME').stand; k.x = st.x + 12; k.z = st.z + 6;
    const t = Object.assign({}, MAX, { field: 1 }), SV = PG.stageView(r, t); compose(W, r, t);
    const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
    const VB = L.BUILDS.slice(0, 1).map(B => { const def = C.buildGen(PT.specOf(B.key).spec); return Object.assign({}, B, { def, dims: L.buildDims(C, def) }); });
    const cen = L.census(C, W, L.index(L.islandObstacles(C, 'jolene', 'default').concat(kitShapes(SV.rec))), VB).filter(q => q.need !== null);
    must(cen.some(q => !q.ok && /\bsg_k_hangar:/.test(q.near)), '3 a construction kit moved onto HOME\'s stand is caught by the census');
    compose(W, recD, undefined); }
  // 7: a restore that loses the cut entries
  { const SV = PG.stageView(whole, Object.fromEntries(Object.keys(MAX).map(k => [k, 0]))); const lossy = Object.assign({}, SV, { cut: {} });
    must(JSON.stringify(PG.normalise(PG.stageRestore(JSON.parse(JSON.stringify(SV.rec)), lossy))) !== JSON.stringify(whole), '7 a save that loses the cut stages is caught'); }
  console.log('GATE STAGES --selftest: ' + red + ' / ' + n + ' rules red' + (red === n ? ' - PASS' : ' - FAIL'));
  process.exit(red === n ? 0 : 1);
}
