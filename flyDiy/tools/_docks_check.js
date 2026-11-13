#!/usr/bin/env node
// _docks_check.js - GATE DOCKS (DOCKS-LODGE, the user 13 Nov: "very important; floatplanes have nowhere to go, not even a
// base, they spawn in the middle of the water"). A DOCK is the water's stand (27_premises.js THE DOCKS): a pier off a water
// lane's shore, its tie spots, its way out to the lane, and the floatplane's start tied at it (app.js dockStart).
//   1 THE SHAPE: laneDocks normalises a record's docks (defaults, clamps, the hand stations, draw false); dockIssues refuses
//     each bad field (doctored inputs, each must say so) and passes Jolene's record
//   2 EVERY WATER BASE HAS A DOCK: every water lane of Jolene's record (Greywater, Cedar Harbour, Cabin Lake, Hook Lagoon)
//     composes `site.docks` with at least one tie spot; Cedar Harbour's and Cabin Lake's are the scenery's own marine
//     seaplane floats (draw false: no modules), Greywater's and the lodge's a pier of the kit
//   3 THE TIES: each one DOCK_TIE.off off the dock's axis on its side, nose along the dock (toward the head), its station on
//     the dock, at the lane's level; the ties of a dock START_FREE_R (12 m) apart at least, so the start's free test tells
//     them apart
//   4 THE WATER (dockWater, the panel's check and this): every dock's head over water, every tie afloat in 1 m, every way
//     out over 1 m of water all along with a wing's room (7.5 m) of water either side, clear of the other docks, its last
//     point ON the lane's centreline; and the check SEES: a way through the breakwater (Cedar Harbour's old basin), a dock
//     turned ashore, a way across another dock each go red
//   5 THE PIER: the kit's numbers (DOCK_KIT) are tools/_house_gen.js PIER_KIT's (the deck's level, the deck's extent); the
//     modules a continuous deck from the root to the head (each starts where the last ended, to 1 mm), at the water +
//     DOCK_DECK[kind]; every key a baked prop (tools/pier_table.py); compose stands them as props with the deck's y
//   6 THE START: a float build placed at a tie (placeAtStand, the page's hydro branch) floats there - afloat, still within
//     1.5 m of the tie and 5 deg of its heading after 3 s at idle - and app.js's hydro branch asks dockStart (the first free
//     tie by START_FREE_R, the fleet's plan and the scenery's parked aeroplanes), places at the tie, falls back to the lane's
//     spawn, says which (FLYDIY_START_WHY 'dock' | 'lane-no-water-taxi' | 'no-dock' | 'dock-busy') and hands a water-taxi
//     pilot the dock as its site (source rows)
//   7 THE EDITOR: the AIRFIELD tool 'seadock', the lane's dock rows, the three discs (shore / head / way point) and their drag,
//     a dock picking its lane (source rows)
//   8 THE LODGE (Hook Lagoon, track `lodge`): bare at 0; the lane and its dock (and the lodge's lumber) at 1; the lodge's
//     buildings at 2; a short muddy strip (380 m, soft, dirt) at 3; the long strip (1000 m gravel) at 4 - its stand and entry
//     the same at 3 and 4; far from Jolene AFB (> 15 km) and off the player's Cabin Strip (> 4 km)
//   node tools/_docks_check.js   -> "GATE DOCKS: PASS|FAIL"
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; return c; };
console.log('GATE DOCKS');
const C = require(path.join(T, 'flight_core.js'));
const PG = C.PREMISES_GEN;
const IN = require(path.join(T, 'island_node.js'));
const FX = path.join(T, 'fixtures', 'island_jolene.json');
const REC = JSON.parse(fs.readFileSync(FX, 'utf8'));
const W = IN.islandWorld('jolene', { premises: JSON.stringify(REC) });
const O = W.premises.overlay;
const lanes = REC.layers.runways.filter(r => +r.surface === 4);
const near = (a, b, e) => Math.abs(a - b) <= e;

// ---- 1 the shape ---------------------------------------------------------------------------------------------------
{
  const N = PG.laneDocks({ docks: [{ id: 'a', x: 1, z: 2, hdg: 0.5 }, { id: 'b', x: 0, z: 0, hdg: 0, len: 500, kind: 'boat', side: -1, ties: [3, 99], draw: false }, { x: 0, z: 0, hdg: 0 }] });
  ok(N.length === 2 && N[0].len === PG.DOCK_DEF.len && N[0].kind === 'float' && N[0].side === 1 && N[0].draw === true && N[0].ties === null,
     '1 laneDocks: the defaults (len ' + PG.DOCK_DEF.len + ', floating, left, drawn, ties by spacing); a dock without an id dropped');
  ok(N[1].len === PG.DOCK_LEN[1] && N[1].kind === 'float' && N[1].side === -1 && N[1].draw === false && JSON.stringify(N[1].ties) === '[3]',
     '1 laneDocks: the length clamped (' + PG.DOCK_LEN.join('..') + ' m), an unknown kind floating, the hand stations kept on the dock, draw false');
  const water = { id: 'w', surface: 4 };
  const bad = [
    [{ id: 'w', surface: 4, docks: {} }, 'docks is a list'],
    [{ id: 's', surface: 0, docks: [{ id: 'd', x: 0, z: 0, hdg: 0 }] }, 'belongs to a water lane'],
    [Object.assign({}, water, { docks: [{ x: 0, z: 0, hdg: 0 }] }), 'without an id'],
    [Object.assign({}, water, { docks: [{ id: 'd', x: 0, z: 0, hdg: 0 }, { id: 'd', x: 0, z: 0, hdg: 0 }] }), 'named twice'],
    [Object.assign({}, water, { docks: [{ id: 'd', z: 0, hdg: 0 }] }), 'needs x and z'],
    [Object.assign({}, water, { docks: [{ id: 'd', x: 0, z: 0 }] }), 'hdg is radians'],
    [Object.assign({}, water, { docks: [{ id: 'd', x: 0, z: 0, hdg: 0, len: 2 }] }), 'len is'],
    [Object.assign({}, water, { docks: [{ id: 'd', x: 0, z: 0, hdg: 0, kind: 'raft' }] }), 'kind is'],
    [Object.assign({}, water, { docks: [{ id: 'd', x: 0, z: 0, hdg: 0, side: 0 }] }), 'side is'],
    [Object.assign({}, water, { docks: [{ id: 'd', x: 0, z: 0, hdg: 0, gap: 4 }] }), 'gap is'],
    [Object.assign({}, water, { docks: [{ id: 'd', x: 0, z: 0, hdg: 0, ties: [-1] }] }), 'ties is'],
    [Object.assign({}, water, { docks: [{ id: 'd', x: 0, z: 0, hdg: 0, draw: true }] }), 'draw is false'],
    [Object.assign({}, water, { docks: [{ id: 'd', x: 0, z: 0, hdg: 0, approach: [[0]] }] }), 'approach is'],
  ];
  const missed = bad.filter(([r, w]) => !PG.dockIssues(r).some(s => s.indexOf(w) >= 0)).map(q => q[1]);
  ok(!missed.length, '1 dockIssues refuses each of ' + bad.length + ' doctored docks by name', missed.length ? 'missed: ' + missed.join(', ') : undefined);
  const iss = PG.issues ? PG.issues(REC).filter(s => /dock/.test(s)) : [];
  ok(!iss.length, '1 Jolene\'s record: no dock issue', iss[0]);
}

// ---- 2 every water base has a dock ---------------------------------------------------------------------------------
const WANT = { SEA: 'kit', mk_sea: 'scenery', cb_sea: 'scenery', lg_sea: 'kit' };
ok(lanes.length >= 4 && lanes.every(r => WANT[r.id]), '2 Jolene\'s water lanes are the four bases (' + lanes.map(r => r.id).join(', ') + ')');
for (const r of lanes) {
  const s = C.siteOf(r.id), D = s && Array.isArray(s.docks) ? s.docks : [];
  const ties = D.reduce((a, d) => a + d.ties.length, 0);
  ok(D.length >= 1 && ties >= 1, '2 ' + r.id + ' (' + (r.name || '') + '): ' + D.length + ' dock(s), ' + ties + ' tie spot(s)');
  if (WANT[r.id] === 'scenery') ok(D.every(d => d.draw === false && d.mods.length === 0), '2 ' + r.id + ': the scenery\'s own seaplane float (draw false, no modules)');
  if (WANT[r.id] === 'kit') ok(D.every(d => d.draw !== false && d.mods.length >= 4), '2 ' + r.id + ': a pier of the kit (' + D.map(d => d.mods.length + ' modules, ' + d.kind).join('; ') + ')');
}
// the scenery's floats ARE where the docks stand: a marine/seaplane float item within 15 m of each draw-false dock's middle
{
  const floats = [];
  for (const st of REC.layers.sites) for (const it of st.items || []) if (/^marine\/seaplane float/.test(it.key || '')) {
    const a = st.at, c = Math.cos(a.yaw || 0), sn = Math.sin(a.yaw || 0);
    floats.push([a.x + it.x * c + it.z * sn, a.z - it.x * sn + it.z * c]);
  }
  for (const r of lanes) for (const d of (C.siteOf(r.id).docks || [])) if (d.draw === false) {
    const m = [(d.x + d.head[0]) / 2, (d.z + d.head[1]) / 2], dm = Math.min(...floats.map(f => Math.hypot(f[0] - m[0], f[1] - m[1])));
    ok(dm < 15, '2 ' + r.id + ' ' + d.id + ': on the scenery\'s seaplane float (' + dm.toFixed(1) + ' m from its middle)');
  }
}

// ---- 3 the ties ----------------------------------------------------------------------------------------------------
for (const r of lanes) for (const d of (C.siteOf(r.id).docks || [])) {
  const A = W.aerodromes.find(a => a.id === r.id), ux = Math.cos(d.hdg), uz = Math.sin(d.hdg);
  let worst = 0, apart = Infinity;
  for (const t of d.ties) {
    const along = (t.x - d.x) * ux + (t.z - d.z) * uz, across = -(t.x - d.x) * uz + (t.z - d.z) * ux;
    worst = Math.max(worst, Math.abs(across - d.side * PG.DOCK_TIE.off), Math.abs(along - t.s), Math.abs(t.hdg - d.hdg), Math.abs(t.elev - A.elev), t.s < 0 || t.s > d.len ? 99 : 0);
  }
  for (let i = 0; i < d.ties.length; i++) for (let j = 0; j < i; j++) apart = Math.min(apart, Math.hypot(d.ties[i].x - d.ties[j].x, d.ties[i].z - d.ties[j].z));
  ok(worst < 0.01 && apart >= 12, '3 ' + r.id + ' ' + d.id + ': ' + d.ties.length + ' tie(s) ' + PG.DOCK_TIE.off + ' m off the axis on side ' + d.side + ', nose along the dock, at the lane\'s level' + (d.ties.length > 1 ? ', ' + apart.toFixed(1) + ' m apart' : ''), worst >= 0.01 ? 'off by ' + worst.toFixed(3) : undefined);
}

// ---- 4 the water ---------------------------------------------------------------------------------------------------
const wetOf = A => (x, z) => { const w = W.waterH(x, z), h = W.terrainH(x, z); return isFinite(w) ? w - h : A.elev - h; };
for (const r of lanes) {
  const s = C.siteOf(r.id), A = W.aerodromes.find(a => a.id === r.id), wet = wetOf(A);
  const iss = []; for (const d of s.docks) for (const i of PG.dockWater(d, wet, s.docks)) iss.push(i);
  ok(!iss.length, '4 ' + r.id + ': heads over water, ties afloat, every way out clear to the lane (' + s.docks.reduce((a, d) => a + d.ties.length, 0) + ' ways)', iss[0]);
  const R0 = Object.assign({}, PG.RUNWAY_DEF || {}, r), E = { d: [Math.cos(r.hdg), Math.sin(r.hdg)] };
  let off = 0; for (const d of s.docks) for (const t of d.ties) { const q = t.approach[t.approach.length - 1]; off = Math.max(off, Math.abs(-(q[0] - r.c[0]) * E.d[1] + (q[1] - r.c[1]) * E.d[0])); }
  ok(off < 0.01, '4 ' + r.id + ': every way out ends ON the lane\'s centreline (' + (off * 1000).toFixed(1) + ' mm)');
  void R0;
}
// the check sees: three doctored docks, each must go red
{
  const bad = [
    ['mk_sea', { id: 'x', x: -3924.2, z: -8641.1, hdg: -1.745, len: 32 }, 'meets', 'a way out through Cedar Harbour\'s breakwater'],
    ['SEA', { id: 'x', x: 871.1, z: -2860.2, hdg: -1.134 + Math.PI, len: 20 }, 'head is not over water', 'a dock turned ashore'],
    ['SEA', { id: 'x', x: 840, z: -2880, hdg: 0, len: 20 }, 'crosses another dock', 'a way out across the real dock'],
  ];
  for (const [lid, dk, word, what] of bad) {
    const r = Object.assign({}, PG.RUNWAY_DEF || {}, lanes.find(q => q.id === lid)), A = W.aerodromes.find(a => a.id === lid);
    const F = O.frame, D = PG.dockWorld(r, PG.laneDocks({ docks: [dk] })[0], F, A.elev);
    const all = [D].concat(C.siteOf(lid).docks);
    const iss = PG.dockWater(D, wetOf(A), all);
    ok(iss.some(s => s.indexOf(word) >= 0), '4 the check sees ' + what, iss[0] || 'silent');
  }
}

// ---- 5 the pier ----------------------------------------------------------------------------------------------------
{
  const hg = fs.readFileSync(path.join(T, '_house_gen.js'), 'utf8');
  const kitOk = Object.entries(PG.DOCK_KIT).every(([k, K]) => {
    const m = new RegExp(k + ':\\s*\\{[^}]*deck:\\s*\\[([-\\d.]+),\\s*([-\\d.]+)\\][^}]*dz:\\s*\\[([-\\d.]+),\\s*([-\\d.]+)\\]').exec(hg);
    return m && near(K.deck, (+m[1] + +m[2]) / 2, 0.006) && near(K.dz[0], +m[3], 1e-6) && near(K.dz[1], +m[4], 1e-6);
  });
  ok(kitOk, '5 DOCK_KIT is PIER_KIT\'s (tools/_house_gen.js): the deck\'s level and its extent, ' + Object.keys(PG.DOCK_KIT).join(', '));
  const table = fs.readFileSync(path.join(T, 'pier_table.py'), 'utf8');
  ok(Object.keys(PG.DOCK_KIT).every(k => table.indexOf("'" + k + "'") >= 0 || table.indexOf('"' + k + '"') >= 0), '5 every module a baked prop of tools/pier_table.py');
  for (const kind of PG.DOCK_KINDS) for (const len of [12, 26, 41]) {
    const dk = PG.laneDocks({ docks: [{ id: 'k', x: 10, z: 20, hdg: 0.7, len, kind }] })[0], M = PG.dockMods(dk, 1.5);
    const ux = Math.cos(0.7), uz = Math.sin(0.7);
    let s = 0, gap = 0, yBad = 0;
    for (const m of M) {
      const K = PG.DOCK_KIT[m.key], c = (m.x - 10) * ux + (m.z - 20) * uz;
      gap = Math.max(gap, Math.abs((c + K.dz[0]) - s)); s = c + K.dz[1];
      yBad = Math.max(yBad, Math.abs(m.y + K.deck - 1.5));
    }
    ok(gap < 0.001 && yBad < 0.001 && s >= len - 0.5 && s <= len + 3.6 && M[M.length - 1].key === (kind === 'fixed' ? 'pier_head' : 'pier_deck'),
       '5 a ' + kind + ' dock of ' + len + ' m: ' + M.length + ' modules, one deck from the root to ' + s.toFixed(2) + ' m, at the deck\'s level', gap >= 0.001 ? 'gap ' + gap.toFixed(4) : undefined);
  }
  const props = O.records.objects.filter(o => o.dock);
  const want = lanes.reduce((a, r) => a + (C.siteOf(r.id).docks || []).reduce((b, d) => b + d.mods.length, 0), 0);
  ok(props.length === want && props.every(p => p.kind === 'prop' && typeof p.y === 'number' && p.on === 'water' && PG.DOCK_KIT[p.key]),
     '5 compose stands the modules as props (' + props.length + ' of ' + want + '), y the deck\'s, never the ground');
}

// ---- 6 the start ---------------------------------------------------------------------------------------------------
{
  const spec = require(path.join(T, '_load_build.js')).loadValidated('twinFloats').spec;
  const def = C.buildGen(C.genMigrateSpec(spec));
  for (const id of ['SEA', 'cb_sea', 'lg_sea']) {
    const A = W.aerodromes.find(a => a.id === id), t = C.siteOf(id).docks[0].ties[0];
    const sim = C.makeSim(def, W); sim.reset(0);
    C.placeAtStand(sim, A, { x: t.x, z: t.z, hdg: t.hdg, elev: t.elev });
    const c0 = sim.cgPos();
    let fin = true;
    for (let k = 0; k < 180; k++) { if (sim.ctl) sim.ctl.thr = 0; sim.step(1 / 60); const c = sim.cgPos(); if (!Number.isFinite(c[0] + c[1] + c[2])) { fin = false; break; } }
    const c = sim.cgPos(), [xA] = sim.axes(), hdg = Math.atan2(-xA[2], -xA[0]);
    const wet = sim.hydro && sim.hydro.floats.reduce((a, f) => a + f.wet, 0) > 0;
    const dh = Math.abs(Math.atan2(Math.sin(hdg - t.hdg), Math.cos(hdg - t.hdg))) * 57.3;
    ok(fin && wet && Math.hypot(c[0] - c0[0], c[2] - c0[2]) < 1.5 && dh < 5, '6 the twin on floats tied at ' + id + ' ' + t.id + ': afloat after 3 s at idle, ' + Math.hypot(c[0] - c0[0], c[2] - c0[2]).toFixed(2) + ' m and ' + dh.toFixed(1) + ' deg from where it was put');
  }
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
  const hb = app.slice(app.indexOf('if (sim.hydro && (wet(from) || gearNow === \'floats\')) {'), app.indexOf('if (typeof sim.stance === \'function\') sim.stance();'));
  ok(/const dk = dockStart\(sea\)/.test(hb) && /placeAtStand\(sim, sea, dk\.stand\)/.test(hb) && /else placeAtAerodrome\(sim, sea\)/.test(hb), '6 app.js\'s hydro branch: dockStart, placed at the tie, else the lane\'s spawn');
  ok(/startWhy = dockOk \? 'dock' : dk\.stand \? 'lane-no-water-taxi' : dk\.why/.test(hb) && /ap\.departFrom\(sea, seaTo, dk\.site\)/.test(hb) && /ap && ap\.waterTaxi/.test(hb), '6 ...says which (FLYDIY_START_WHY), and a water-taxi pilot gets the dock as its site');
  const ds = app.slice(app.indexOf('function dockStart(sea)'), app.indexOf('let lastStart = null, skipAir = false;'));
  ok(/START_FREE_R/.test(ds) && /FLEET_STAND/.test(ds) && /st\.parked/.test(ds) && /'dock-busy'/.test(ds) && /'no-dock'/.test(ds) && /taxiOut: tie\.approach\.slice\(1\)/.test(ds), '6 dockStart: the first free tie by the start chain\'s test (START_FREE_R, the fleet\'s plan, the parked); busy / none said; the site\'s taxiOut the way out');
}

// ---- 7 the editor --------------------------------------------------------------------------------------------------
{
  const ui = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'premises_ui.js'), 'utf8');
  const rp = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
  ok(/'stand', 'seadock', 'probe'/.test(ui) && /if \(tool === 'seadock'\)/.test(ui) && /seadock: 'a dock \(floatplanes\)'/.test(ui), '7 the AIRFIELD tool "a dock (floatplanes)": a click by a shore near a water lane');
  ok(/if \(WATER\) dockRows\(insp, e, id, ed\)/.test(ui) && /function dockRows\(/.test(ui) && /function dockNear\(/.test(ui), '7 a water lane\'s inspector: its docks (kind, place, heading, length, side, ties, the scenery\'s float, the way points)');
  ok(/\/\^d\[kha\]:\/\.test\(drag\.runway\)/.test(ui) && /'dk:' \+ q\.id/.test(rp) && /'dh:' \+ q\.id/.test(rp) && /'da:' \+ q\.id/.test(rp), '7 the shore / head / way point discs and their drag');
  ok(/function onDock\(r, L\)/.test(rp) && (rp.match(/onDock\(r, L\)/g) || []).length >= 3, '7 a dock picks its lane (the click and the cycle)');
}

// ---- 8 the lodge ---------------------------------------------------------------------------------------------------
{
  const max = {}; for (const k of Object.keys(C.CONTRACT_TRACKS)) max[k] = C.CONTRACT_TRACKS[k].max;
  ok(C.CONTRACT_TRACKS.lodge && C.CONTRACT_TRACKS.lodge.max === 4 && [1, 2, 3, 4].every(n => C.STAGE_REVEALS['lodge:' + n]), '8 the track `lodge` (max 4) and its four reveals');
  const at = n => PG.stageView(REC, Object.assign({}, max, { lodge: n })).rec;
  const has = (R, L, id) => (R.layers[L] || []).some(e => e && e.id === id);
  const site = R => (R.layers.sites || []).find(e => e.id === 'lg_s_lodge');
  const strip = R => (R.layers.runways || []).find(e => e.id === 'lg_strip');
  const kit = R => (R.layers.objects || []).some(e => e && (e.id === 'lg_k_lodge' || String(e.id).indexOf('lg_k_lodge:') === 0));
  const R0 = at(0), R1 = at(1), R2 = at(2), R3 = at(3), R4 = at(4);
  ok(!has(R0, 'runways', 'lg_sea') && !strip(R0) && !site(R0) && !kit(R0), '8 lodge 0: a bare shore (no lane, no strip, no lodge, no kit)');
  ok(has(R1, 'runways', 'lg_sea') && (R1.layers.runways.find(e => e.id === 'lg_sea').docks || []).length === 1 && !site(R1) && !strip(R1) && kit(R1), '8 lodge 1: the lane and its dock, the lodge\'s lumber on its plot');
  const items = site(R2) ? site(R2).items.map(i => i.id) : [];
  ok(['lodge', 'cabin1', 'cabin2', 'cabin3', 'boathouse'].every(i => items.indexOf(i) >= 0) && !strip(R2) && !kit(R2), '8 lodge 2: the lodge (' + items.join(', ') + '), no kit');
  const s3 = strip(R3), s4 = strip(R4);
  ok(s3 && s3.len === 380 && +s3.surface === 0 && s3.look === 'dirt' && s3.wid === 12, '8 lodge 3: a short muddy strip (' + (s3 ? s3.len + ' m, surface ' + s3.surface + ', ' + s3.look : 'none') + ')');
  ok(s4 && s4.len === 1000 && +s4.surface === 6 && s4.look === 'gravel', '8 lodge 4: the long strip (' + (s4 ? s4.len + ' m of ' + s4.look : 'none') + ')');
  const onLine = (S, q) => { const d = [Math.cos(S.hdg), Math.sin(S.hdg)], along = (q[0] - S.c[0]) * d[0] + (q[1] - S.c[1]) * d[1], across = -(q[0] - S.c[0]) * d[1] + (q[1] - S.c[1]) * d[0]; return Math.abs(across) < 0.05 && Math.abs(along) <= S.len / 2 - 20; };
  ok(s3 && s4 && JSON.stringify(s3.stand) === JSON.stringify(s4.stand) && onLine(s3, s3.taxiOut[0]) && onLine(s4, s4.taxiOut[0]), '8 the strip\'s stand and entry the same at 3 and 4, the entry on both centrelines');
  const lane = REC.layers.runways.find(e => e.id === 'lg_sea'), cab = REC.layers.runways.find(e => e.id === 'w1');
  const dA = Math.hypot(lane.c[0], lane.c[1]), dC = cab.stand ? Math.hypot(lane.docks[0].x - cab.stand.x, lane.docks[0].z - cab.stand.z) : 0;
  ok(dA > 15000 && dC > 4000, '8 Hook Lagoon: ' + (dA / 1000).toFixed(1) + ' km from Jolene AFB, ' + (dC / 1000).toFixed(1) + ' km from the Cabin Strip');
  const A1 = W.aerodromes.find(a => a.id === 'lg_strip');
  ok(!!A1 && A1.kind === 'strip' && C.siteOf('lg_strip') && C.siteOf('lg_strip').stand, '8 the sandbox (every track at its max) composes the lodge\'s strip with its stand');
}

console.log('GATE DOCKS: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
