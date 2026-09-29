#!/usr/bin/env node
// _roundtrip_check.js - GATE ROUNDTRIP (G1022, B9) and GATE SETUP (G1026, B8): the one loading, the instant round trips,
// the loading screen as a setup screen - PROVED IN NODE, on the page itself (tools/_page_node.js, FRAMECOST's harness:
// dev.html's own scripts, the real three.js on the recording GL, the virtual clock).
//
// THE USER (2026-09-28): "ONE LOADING FOR THE WHOLE GAME, THEN INSTANT ROUND TRIPS ... no impact on performance below
// 30 fps. Maybe a slightly longer loading upfront is the way to go." and "THE LOADING SCREEN IS A SETUP SCREEN".
//
// CHILD `trips`, TWICE - the default Cub (a first boot) and the metal Cessna (bugReports/cessnaMetal (1).json in the
// working slot: a saved build, the player's usual case), the loading untouched:
//   boot -> roll out -> back to the shed -> change the build (a slider of the editor) -> roll out -> back -> roll out
//   with no change. For every trip: which steps RAN and which were SKIPPED (the page's own log, window.FLYDIY_TRIPS,
//   each step with its key), and what the trip cost (program links, GL calls, draws, buffer / texture bytes, the
//   world's terrainH), in all and step by step (the steps' rows, FRAMECOST's marks). THE VERDICT:
//   - the boot ran the world's steps (world .. frames) and the aeroplane's programs in the world's light ('craft');
//   - the FIRST roll-out after the boot, and the THIRD (no change), run NO step and link NO program;
//   - the SECOND (a slider moved) runs only the aircraft's steps (snapshot, [bake], spec, craft) - no world step;
//   - NOTHING TICKS THE WORLD IN THE SHED: over every stretch spent in the shed (after each roll-in, the slider's
//     rebuild included) the world's update door (WF.worldUpdate), the premises' tick and the world scene's
//     updateMatrixWorld are counted and must be 0 (and are > 0 in flight: the counters can see);
//   - every way back to the shed is logged, and runs no world step.
// CHILD `setup` (a second first boot, the loading screen TOUCHED):
//   - ONE REGISTRY: every section the setup screen mounts is the rail's (FLYDIY_RAIL), every row and pill of it is
//     reached through the rail's own census of that item, every graphics option that does not reload is on it, and
//     the options that reload (towns, colour management, the map, the storage's refresh) are not;
//   - LIVE BOTH WAYS: a pick on the setup screen shows in the rail's flyout, a pick in the flyout shows on the screen;
//   - THE AUTO-START: untouched (the `trips` child) the screen lifts by itself; touched, the load finishes and the screen
//     WAITS (BOOT 'waiting', Fly lit) for frames on end; a graphics row picked while it waits is compiled BEFORE the
//     lift (the settle chain: the world's, the aeroplane's and the shed's programs), and after the lift nothing links.
//
//   node tools/_roundtrip_check.js                  the gate (three children, one after the other: ~3.6-4.4 GB each, ~13 min)
//   node tools/_roundtrip_check.js --only trips|trips:cub|trips:cessna|setup   a part of it
//   node tools/_roundtrip_check.js --child trips|setup   one child, its JSON on stdout's last line (ROUNDTRIP_BUILD=<file>)
//   ROUNDTRIP_WHO=1   (trips) every GARAGE_SPEC.update - a rebuild of the flying aeroplane - with its caller and what it changed
//   node tools/_roundtrip_check.js --json out.json  also write both children's reports
// The counts are this harness's (exact, repeatable), not a browser's; the TIMING of the same trips (the first load, a
// round trip, the garage's fps fresh and after a round trip, a slider's latency, no frame under 30 fps while loading)
// is the coordinator's, on the GPU box - HANDOVER G1020-G1029 says how.
'use strict';
const fs = require('fs'), path = require('path');
const { spawn } = require('child_process');
const FC = require('./_framecost_check.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

const newC = () => ({ who: null, obr: 0, oar: 0, obs: 0, mobr: 0, umw: 0, um: 0, frustum: 0, terrainH: 0, grHeight: 0, renders: 0, pick: null });
const AIRCRAFT = ['snapshot', 'bake', 'spec', 'craft'];
const WORLD = ['world', 'town', 'parking', 'trees', 'ring', 'settle', 'images', 'upload', 'worldCompile', 'frames'];
const COST = ['links', 'gl.calls', 'draws.total', 'bytes.bufferData', 'bytes.bufferSubData', 'bytes.texImage2D', 'bytes.texImage3D', 'world.terrainH', 'three.updateMatrixWorld'];
const pick = r => { const o = {}; for (const k of COST) if (r && r[k]) o[k] = r[k]; return o; };

// ---- the page, with FRAMECOST's counters and the world's tick counters --------------------------------------------
async function openCounted(extraHooks) {
  const { openPage } = require('./_page_node.js');
  const C = FC.bootMark.C = newC();
  const T = { watch: false, wu: 0, prem: 0, worldUmw: 0, scene: null };
  const base = FC.pageHooks(C, () => null);
  const hooks = {
    beforeScript(name, P) { base.beforeScript(name, P); if (extraHooks && extraHooks.beforeScript) extraHooks.beforeScript(name, P); },
    afterScript(name, P) {
      base.afterScript(name, P);
      if (name === 'vendor/three.min.js') {
        // the world scene's matrices, counted while watched (a walk to the root per call: the shed's stretches only)
        const O = P.win.THREE.Object3D.prototype, umw = O.updateMatrixWorld;
        O.updateMatrixWorld = function (f) { if (T.watch && T.scene) { let r = this; while (r.parent) r = r.parent; if (r === T.scene) T.worldUmw++; } return umw.call(this, f); };
      }
      if (extraHooks && extraHooks.afterScript) extraHooks.afterScript(name, P);
    },
  };
  // ROUNDTRIP_BUILD=<file.json>: a saved build in the working slot (the page's WIP), as FRAMECOST's metal Cessna
  const storage = {}; if (process.env.ROUNDTRIP_BUILD) storage['flydiy.wip'] = fs.readFileSync(path.resolve(process.env.ROUNDTRIP_BUILD), 'utf8');
  // G820 (C1c): THE PHYSICS WORKER IS THE PAGE'S OWN DEFAULT (app.js SIMW_DEFAULT): the harness gives the page its Worker
  // (the G815 shim, a real thread) so the round trips run what ships; ROUNDTRIP_QUERY=simw=0 flies them inline
  const P = await openPage({ quiet: true, storage, hooks, query: process.env.ROUNDTRIP_QUERY || '', workers: /sim_host\.js/ });
  const W = P.win;
  // the world's doors, wrapped as the world comes to exist (the boot builds it now): its update, the premises' tick
  const wrapWorld = () => {
    const WF = W.WORLD; if (!WF) return;
    if (!WF.__rt) { WF.__rt = true; T.scene = WF.scene;
      const wu = WF.worldUpdate; WF.worldUpdate = function () { T.wu++; return wu.apply(this, arguments); }; }
    const PR = WF.premises;   // the premises' renderer (its trams, traffic, animals and the scenery's life: tick)
    if (PR && !PR.__rt && typeof PR.tick === 'function') { PR.__rt = true; const tk = PR.tick; PR.tick = function () { T.prem++; return tk.apply(this, arguments); }; }
  };
  P.onFrame(ph => { if (ph === 'start') wrapWorld(); });
  const snap = () => ({ rec: P.rec.snapshot(), c: Object.assign({}, C, { pick: null, drawn: null, lastDrawn: null }) });
  return { P, W, C, T, snap, wrapWorld };
}
const inShed = W => !!(W.document.body && W.document.body.classList && W.document.body.classList.contains('mode-ws'));
const lastTrip = W => { const L = W.FLYDIY_TRIPS || []; return L[L.length - 1]; };

// one trip: the press, until the page's log says the trip is done and no screen is up; its steps and its costs
async function trip(ctx, kind, press) {
  const { P, W, snap } = ctx;
  FC.bootMark.close(); FC.bootMark.rows = {};
  // (a diagnosis, printed when a build step runs: where the export differs from the build last committed)
  let exportDiff = null;
  if (kind === 'rollout' && W.CAGE_JOIN && W.FLYDIY_TRIP_KEYS) { try { exportDiff = firstDiff(W.FLYDIY_TRIP_KEYS.snapshot, canon(W.CAGE_JOIN.export())); } catch (e) { exportDiff = 'export threw: ' + e.message; } }
  const n0 = (W.FLYDIY_TRIPS || []).length, a = snap(), f0 = P.frameNo;
  press();
  const ok = await P.until(() => { const L = W.FLYDIY_TRIPS || []; const t = L[L.length - 1]; return L.length > n0 && t.kind === kind && t.done && W.BOOT.state === 'gone'; }, 900000);
  FC.bootMark.close();
  const t = lastTrip(W), total = FC.diff(a, snap());
  const rows = {}; for (const [k, v] of Object.entries(FC.bootMark.rows)) rows[k] = pick(v);
  return { kind, ok, frames: P.frameNo - f0, ms: t && t.ms, anim: t && t.anim, total: pick(total), exportDiff,
    ran: t ? t.steps.filter(s => s.ran).map(s => s.id) : [], skipped: t ? t.steps.filter(s => !s.ran).map(s => s.id) : [],
    why: t ? t.steps.filter(s => s.ran).map(s => s.id + ':' + s.why) : [], rows,
    keys: t ? t.steps.filter(s => s.ran && s.why === 'key').map(s => ({ id: s.id, diff: firstDiff(s.was, s.key) })) : [] };
}
// app.js's specKey, restated: the design as canonical JSON
const canon = spec => JSON.stringify(spec, function (k, v) {
  if (typeof v === 'number') return Number.isFinite(v) ? +v.toPrecision(10) : String(v);
  if (v && typeof v === 'object' && !Array.isArray(v)) { const o = {}; for (const kk of Object.keys(v).sort()) o[kk] = v[kk]; return o; }
  return v;
});
const firstDiff = (a, b) => { if (a === b) return null; if (typeof a !== 'string') return 'no key recorded (' + a + ')'; let i = 0; while (i < a.length && a[i] === b[i]) i++; return '@' + i + ': ' + a.slice(Math.max(0, i - 80), i + 60) + '  VS  ' + b.slice(Math.max(0, i - 80), i + 60); };
// a stretch of frames in the shed, the world's ticks counted
async function shedStretch(ctx, n, during) {
  const { P, T } = ctx;
  T.watch = true; T.wu = 0; T.prem = 0; T.worldUmw = 0;
  try { if (during) await during(); await P.frames(n); } finally { T.watch = false; }
  return { frames: n, worldUpdate: T.wu, premTick: T.prem, worldUmw: T.worldUmw };
}
// a slider of the editor moved by a step, as a drag does (its oninput: the parameter, the rebuild, CAGE_ON_BUILD)
function moveSlider(W) {
  const U = W.CAGE_UI, doc = W.document;
  const keys = ['span', 'wingSpan', 'chord', 'rootChord', 'fuseLen', 'len', 'noseLen', 'tailArm'].concat(U && U.P ? Object.keys(U.P) : []);
  for (const k of keys) {
    const r = doc.getElementById('p_' + k);
    if (!r || r.type !== 'range' || r.disabled || typeof r.oninput !== 'function') continue;
    const lo = +r.min, hi = +r.max, st = +r.step || (hi - lo) / 100, v = +r.value;
    if (!(hi > lo)) continue;
    const nv = v + st <= hi ? v + st : v - st;
    r.value = String(nv); r.oninput({ target: r });
    return { key: k, from: v, to: nv };
  }
  return null;
}

async function childTrips() {
  // who re-commits the aeroplane (GARAGE_SPEC.update: a model rebuild) and when - stderr, ROUNDTRIP_WHO=1
  const WHO = process.env.ROUNDTRIP_WHO ? [] : null;
  const ctx = await openCounted(WHO ? { afterScript(name, P) { const G = P.win.GARAGE_SPEC; if (G && G.update && !G.__who) { G.__who = 1; const u = G.update;
    G.update = function (j) { const B = P.win.BOOT; try { const had = G.get(); for (const k of Object.keys(j || {})) { const d = firstDiff(canon(had[k]), canon(j[k])); if (d) WHO.push('   ' + k + ' ' + d.slice(0, 400)); } } catch (e) {} WHO.push((B ? B.state + ':' + (B.current ? B.current.id : '-') : '?') + ' f' + P.frameNo + ' ' + (new Error().stack || '').split('\n').slice(2, 7).map(l => l.trim().replace(/^at /, '').replace(/\(.*[\/\\]/, '(')).join(' < ')); return u.apply(this, arguments); }; } } } : null);
  const { P, W } = ctx;
  const out = { errors: [], trips: [], shed: [], flight: null };
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  FC.bootMark.close();
  ctx.wrapWorld();
  const boot = lastTrip(W) && W.FLYDIY_TRIPS.find(t => t.kind === 'boot');
  const bootRows = {}; for (const [k, v] of Object.entries(FC.bootMark.rows)) bootRows[k] = pick(v);
  out.settle = W.FLYDIY_WORLD_SETTLE || null;
  out.boot = { ran: boot ? boot.steps.filter(s => s.ran).map(s => s.id) : [], skipped: boot ? boot.steps.filter(s => !s.ran).map(s => s.id) : [],
    log: W.BOOT.log.filter(e => /^(hold|waiting|go|ready|fail)$/.test(e.k)).map(e => e.k), rows: bootRows, programs: W.FLYDIY_RENDERER.info.programs.length };
  out.shed.push(Object.assign({ at: 'after the boot' }, await shedStretch(ctx, 30)));
  const bGo = () => W.document.getElementById('bGo').click();
  const back = () => W.document.getElementById('bHangar2').click();
  // the first 40 frames of each flight: the world ticks (the counters can see), and what they link (the reveal)
  out.reveal = [];
  const fly = async label => { const T = ctx.T, a = ctx.snap(), p0 = new Set(W.FLYDIY_RENDERER.info.programs);
    // who asks for a new program in these frames (the pass outside the world scene): the stack at its creation
    const PA = W.FLYDIY_RENDERER.info.programs, push0 = PA.push, made = [];
    try { W.Error.stackTraceLimit = 80; Error.stackTraceLimit = 80; } catch (e) {}
    PA.push = function () { made.push((new Error().stack || '').split('\n').slice(2, 30).map(l => l.trim().replace(/^at /, '').replace(/\(.*[\/\\]/, '(')).filter(l => !/three\.min|_fake_gl|_page_node|_framecost|_roundtrip/.test(l)).slice(0, 4).join(' < ')); return push0.apply(this, arguments); };
    T.watch = true; T.wu = 0; T.worldUmw = 0; try { await P.frames(40); } finally { PA.push = push0; } T.watch = false;
    out.flight = out.flight || { frames: 40, worldUpdate: T.wu, worldUmw: T.worldUmw, at: label };
    const fresh = new Set(W.FLYDIY_RENDERER.info.programs.filter(p => !p0.has(p))), who = {}, keyDiffs = [];
    // who wears them: the objects of the world scene (and the craft) whose material holds a new program
    const scenes = [['', W.WORLD.scene]].concat([['far:', W.WORLD.far && W.WORLD.far.scene], ['cover:', W.WORLD.cover && W.WORLD.cover.scene], ['shed:', W.FLIGHT_PROBE && W.FLIGHT_PROBE.hangarScene && W.FLIGHT_PROBE.hangarScene()]].filter(x => x[1] && x[1].traverse));
    if (fresh.size) for (const [tag, sc] of scenes) { const R = W.FLYDIY_RENDERER; sc.traverse(o => { for (const m of (o.material ? [].concat(o.material) : [])) { if (!m) continue; const pr = R.properties.get(m); const ps = [pr.currentProgram].concat(pr.programs ? [...pr.programs.values()] : []);
      if (ps.some(x => fresh.has(x)) && keyDiffs.length < 4 && pr.programs && pr.programs.size > 1) { const ks = [...pr.programs.keys()], ov = [...pr.programs.values()];
        const iN = ov.findIndex(x => fresh.has(x)), iO = ov.findIndex(x => !fresh.has(x)); if (iN >= 0 && iO >= 0) keyDiffs.push((m.name || m.type) + ': ' + firstDiff(ks[iO], ks[iN]).slice(0, 360)); }
      if (ps.some(x => fresh.has(x))) { let n = o, path = []; while (n && path.length < 3) { if (n.name) path.push(n.name); n = n.parent; } const k = tag + (path.reverse().join('/') || o.type) + ' | ' + (m.name || m.type) + (o.userData && o.userData.craft ? ' [craft]' : ''); who[k] = (who[k] || 0) + 1; } } }); }
    out.reveal.push({ at: label, cost: pick(FC.diff(a, ctx.snap())), keyDiffs, made: made.slice(0, 12), who: Object.entries(who).sort((x, y) => y[1] - x[1]).slice(0, 25).map(([k, v]) => v + ' ' + k),
      progs: [...fresh].map(p => p.name + ' ' + String(p.cacheKey).slice(0, 50)).slice(0, 20) }); };
  out.trips.push(await trip(ctx, 'rollout', bGo)); await fly('after roll-out 1');
  out.trips.push(await trip(ctx, 'rollin', back));
  let slid = null;
  out.shed.push(Object.assign({ at: 'the shed, the slider moved in it' }, await shedStretch(ctx, 40, async () => { slid = moveSlider(W); await P.frames(20); })));
  out.slider = slid;
  out.trips.push(await trip(ctx, 'rollout', bGo)); await fly('after roll-out 2');
  out.trips.push(await trip(ctx, 'rollin', back));
  out.shed.push(Object.assign({ at: 'the shed, untouched' }, await shedStretch(ctx, 40)));
  out.trips.push(await trip(ctx, 'rollout', bGo)); await fly('after roll-out 3');
  out.programs = W.FLYDIY_RENDERER.info.programs.length;
  // G820 (C1c): the physics worker's word on the three flights (null: the page flew inline - ?simw=0 or no worker)
  const SWs = W.FLYDIY_SIMW && !W.FLYDIY_SIMW.dead() ? W.FLYDIY_SIMW.state() : null;
  out.simw = SWs ? { flights: SWs.flights, inline: SWs.inline, reason: SWs.reason, phase: SWs.phase, placeOk: SWs.placeOk, wvBad: SWs.wvBad, strays: SWs.strays,
                     errors: SWs.errors, prewarmed: SWs.prewarmed, worldMs: SWs.worldMs, readyWaitFrames: SWs.readyWaitFrames } : null;
  if (WHO) process.stderr.write('GARAGE_SPEC.update calls:\n' + WHO.map(x => '  ' + x).join('\n') + '\n');
  out.errors = P.errors.filter(e => /^(script |timer: |frame: |FLYDIY_BOOT)/.test(e)).slice(0, 8);
  return out;
}

// ---- the setup child ---------------------------------------------------------------------------------------------
// the pills that follow the row labelled `label` in a host (the rail's vocabulary: div.fr > span.k, then div.fpills)
function pillsOf(host, label) {
  const rows = host.querySelectorAll('.fr');
  for (const r of rows) {
    const k = r.querySelector('span.k'); if (!k || k.textContent !== label) continue;
    let n = r.nextSibling; while (n && !(n.classList && n.classList.contains('fpills'))) n = n.nextSibling;
    return n ? [...n.querySelectorAll('button')] : [];
  }
  return [];
}
const onOf = ps => (ps.find(b => b.classList.contains('on')) || {}).textContent;
async function childSetup() {
  const ctx = await openCounted();
  const { P, W, snap } = ctx;
  const doc = W.document, out = { errors: [] };
  const box = () => doc.getElementById('bootSetup');
  await P.until(() => box() && !box().hidden, 600000);
  out.openedAt = (W.BOOT.current && W.BOOT.current.id) || W.BOOT.state;
  const S = W.FLYDIY_SETUP, R = W.FLYDIY_RAIL, G = W.GFX;
  // THE REGISTRY: the setup's census against the rail's, item by item
  const sc = S.census();
  out.setup = { sections: sc.sections, rows: sc.rows.length, pills: sc.pills.length, errors: sc.errors };
  const railRows = new Set(), railPills = new Set(), railSecs = new Set();
  for (const it of R.items()) { if (it.dev) continue; const c = R.census(it.k); for (const x of c.rows) railRows.add(x); for (const x of c.pills) railPills.add(x); for (const x of c.sections) railSecs.add(x); }
  out.missingInRail = { sections: sc.sections.filter(x => !railSecs.has(x)), rows: [...new Set(sc.rows)].filter(x => !railRows.has(x)), pills: [...new Set(sc.pills)].filter(x => !railPills.has(x)) };
  const noReload = G.OPTIONS.filter(o => !o.reload).map(o => o.label), reload = G.OPTIONS.filter(o => o.reload).map(o => o.label);
  out.gfxMissing = noReload.filter(l => sc.rows.indexOf(l) < 0);
  out.reloadPresent = reload.concat(['world', 'storage']).filter(l => sc.rows.indexOf(l) >= 0);
  out.reloadRail = reload.filter(l => !railRows.has(l));   // (the rail keeps them)
  out.items = S.items();
  // LIVE BOTH WAYS. (a) a pick on the screen -> the rail: the anti-aliasing row's first pill that is not on (the
  // performance group, the one GRAPHICS fold open by default)
  const host = doc.getElementById('bootSetupBody');
  const ROW = 'anti-aliasing';
  const bloomSet = pillsOf(host, ROW), was = onOf(bloomSet);
  const tgt = bloomSet.find(b => !b.classList.contains('on') && !b.disabled);
  out.touchBefore = S.state();
  const logN = W.BOOT.log.length;
  if (tgt) tgt.click();
  out.touched = S.touched(); out.holdLogged = W.BOOT.log.slice(logN).some(e => e.k === 'hold');
  out.touchAfter = S.state();   // G1065: Fly pulses once touched
  R.open('graphics');
  const fly = doc.getElementById('flFlyBody');
  out.aToRail = { row: ROW, picked: tgt && tgt.textContent, was, setupNow: onOf(pillsOf(host, ROW)), railNow: onOf(pillsOf(fly, ROW)), gfx: G.get().aa };
  // (b) a pick in the rail -> the screen: the level-horizon switch of VIEW > camera, then the camera's framing pill
  R.open('view');
  const lv = (() => { for (const r of fly.querySelectorAll('.fr')) { const k = r.querySelector('span.k'); if (k && k.textContent === 'level horizon') return r.querySelector('input'); } return null; })();
  const lvHost = () => { for (const r of host.querySelectorAll('.fr')) { const k = r.querySelector('span.k'); if (k && k.textContent === 'level horizon') return r.querySelector('input'); } return null; };
  const before = lvHost() && lvHost().checked;
  if (lv) { lv.checked = !lv.checked; lv.onchange({ target: lv }); }
  out.bToSetup = { railNow: lv && lv.checked, setupBefore: before, setupNow: lvHost() && lvHost().checked };
  R.open(null);
  // THE HOLD: the load finishes, the screen waits for Fly
  await P.until(() => W.BOOT.state === 'waiting' || W.BOOT.state === 'gone', 900000);
  out.stateAtEnd = W.BOOT.state;
  await P.frames(60);
  out.after60 = { state: W.BOOT.state, fly: S.state().fly, pulse: S.state().pulse, flyText: doc.getElementById('bootFly').textContent };
  // a graphics row picked WHILE IT WAITS (shadows: re-keys the lit programs) - compiled before the lift
  const shadowsWas = G.get().shadows;
  G.set('shadows', shadowsWas === 'full' ? 'off' : 'full');
  if (typeof W.FLYDIY_SETTLE === 'function') W.FLYDIY_SETTLE('shadows');   // (the menu's own path: under a screen it stands down)
  out.shadows = { was: shadowsWas, now: G.get().shadows };
  const a = snap(), nT = W.FLYDIY_TRIPS.length;
  FC.bootMark.close(); FC.bootMark.rows = {};
  doc.getElementById('bootFly').click();
  await P.until(() => W.BOOT.state === 'gone', 900000);
  FC.bootMark.close();
  const settle = W.FLYDIY_TRIPS.slice(nT).find(t => t.kind === 'settle');
  out.settle = { ran: settle ? settle.steps.filter(s => s.ran).map(s => s.id) : [], cost: pick(FC.diff(a, snap())), rows: Object.fromEntries(Object.entries(FC.bootMark.rows).map(([k, v]) => [k, pick(v)])) };
  const b = snap(), progs0 = new Set(W.FLYDIY_RENDERER.info.programs); await P.frames(30);
  out.afterLift = pick(FC.diff(b, snap()));
  out.afterLiftProgs = W.FLYDIY_RENDERER.info.programs.filter(p => !progs0.has(p)).map(p => p.name + ' ' + String(p.cacheKey).slice(0, 60)).slice(0, 30);
  out.setupHidden = box().hidden;
  out.errors = P.errors.filter(e => /^(script |timer: |frame: |FLYDIY_BOOT)/.test(e)).slice(0, 8);
  return out;
}

// ---- the parent -----------------------------------------------------------------------------------------------------
const BUILDS = { cub: null, cessna: 'bugReports/cessnaMetal (1).json' };   // FRAMECOST's two: the first boot, a saved metal build
function child(kind, build) {
  return new Promise(res => {
    const env = Object.assign({}, process.env); if (build && BUILDS[build]) env.ROUNDTRIP_BUILD = path.join(__dirname, '..', BUILDS[build]); else delete env.ROUNDTRIP_BUILD;
    const p = spawn(process.execPath, ['--max-old-space-size=6144', __filename, '--child', kind], { stdio: ['ignore', 'pipe', 'pipe'], env });
    let o = '', e = '';
    p.stdout.on('data', d => o += d); p.stderr.on('data', d => e += d);
    p.on('close', code => { const line = o.trim().split('\n').pop(); try { res(JSON.parse(line)); } catch (x) { res({ failed: 'exit ' + code + ': ' + (e || o).slice(-1200) }); } });
  });
}
async function main() {
  if (argv.includes('--child')) {
    const k = opt('child', 'trips');
    const r = k === 'setup' ? await childSetup() : await childTrips();
    process.stdout.write('\n' + JSON.stringify(r) + '\n'); process.exit(0);
  }
  console.log('GATE ROUNDTRIP');
  const t0 = Date.now();
  let fails = 0;
  const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
  const only = opt('only', '');
  const fmt = o => Object.entries(o || {}).map(([k, v]) => k + ' ' + v).join(', ') || 'nothing';
  const RS = {};
  for (const b of Object.keys(BUILDS)) if (!only || only === 'trips' || only === 'trips:' + b) RS[b] = await child('trips', b);
  const S = !only || only === 'setup' ? await child('setup') : null;
  for (const [bn, R] of Object.entries(RS)) {
    console.log('  ---- the trips, ' + bn + (BUILDS[bn] ? ' (' + BUILDS[bn] + ')' : ' (the first boot)'));
    ok(!R.failed, bn + ': the page booted and made its five trips', R.failed);
    if (!R.failed) {
      ok(WORLD.every(id => R.boot.ran.includes(id)) && R.boot.ran.includes('craft'), 'the ONE LOADING ran the world\'s steps and the aeroplane\'s programs in its light', 'ran ' + R.boot.ran.join(' '));
      ok(!R.boot.log.includes('hold') && !R.boot.log.includes('waiting'), 'untouched, the loading screen lifted by itself (no hold, no wait)', R.boot.log.join(' '));
      console.log('  the world settled at the stand: ' + JSON.stringify(R.settle));
      console.log('  boot rows (the world\'s, now in the one loading):');
      for (const id of WORLD.concat(['craft', 'compile', 'firstFrame'])) { const r = R.boot.rows['garage:' + id]; if (r) console.log('    ' + id.padEnd(14) + fmt(r)); }
      const [t1, i1, t2, i2, t3] = R.trips;
      for (const [n, t] of [['roll-out 1 (after the boot)', t1], ['back 1', i1], ['roll-out 2 (a slider moved)', t2], ['back 2', i2], ['roll-out 3 (no change)', t3]]) {
        console.log('  ' + n + ': ran [' + t.ran.join(' ') + '] skipped [' + t.skipped.join(' ') + '] anim ' + t.anim + ', ' + t.frames + ' frames; cost ' + fmt(t.total));
        if (t.exportDiff && t.ran.includes('snapshot')) console.log('      the export against the build last committed: ' + t.exportDiff);
        for (const k of (t.keys || [])) if (k.id !== 'snapshot' && k.id !== 'spec') console.log('      ' + k.id + ' re-keyed: ' + k.diff);
        for (const [k, v] of Object.entries(t.rows)) console.log('      ' + k.padEnd(22) + fmt(v));
        ok(t.ok, n + ': done');
      }
      ok(t1.ran.length === 0 && !(t1.total.links > 0), 'roll-out 1 after the boot runs NO step and links nothing', 'ran ' + (t1.ran.join(' ') || 'none') + ', links ' + (t1.total.links || 0));
      ok(t3.ran.length === 0 && !(t3.total.links > 0), 'roll-out 3 with no change runs NO step and links nothing', 'ran ' + (t3.ran.join(' ') || 'none') + ', links ' + (t3.total.links || 0));
      ok(!!R.slider, 'a slider of the editor was moved in the shed', R.slider ? R.slider.key + ' ' + R.slider.from + ' -> ' + R.slider.to : 'no slider found');
      ok(t2.ran.includes('snapshot') && t2.ran.includes('spec') && t2.ran.includes('craft') && t2.ran.every(id => AIRCRAFT.includes(id)),
         'roll-out 2 (a slider moved) runs ONLY the aircraft\'s steps', 'ran ' + t2.why.join(' '));
      ok(!t2.ran.some(id => WORLD.includes(id)), 'roll-out 2 runs no world step', t2.ran.filter(id => WORLD.includes(id)).join(' ') || 'none');
      // (the aeroplane's own placement reads the ground under its wheels: ~3 100 terrainH a placement; the ring alone is ~700 000)
      ok(!(t2.total['bytes.texImage2D'] > 0) && !(t2.total['world.terrainH'] > 20000), 'roll-out 2 uploads no world texture and samples no ground en masse', fmt(t2.total));
      for (const t of [i1, i2]) ok(t.ran.every(id => ['shed', 'board', 'frames'].includes(id)), 'the way back runs the shed\'s three steps only', t.ran.join(' '));
      for (const s of R.shed) ok(s.worldUpdate === 0 && s.premTick === 0 && s.worldUmw === 0, 'NOTHING TICKS THE WORLD IN THE SHED - ' + s.at, 'worldUpdate ' + s.worldUpdate + ', premises tick ' + s.premTick + ', world updateMatrixWorld ' + s.worldUmw + ' over ' + s.frames + ' frames');
      for (const r of R.reveal || []) { console.log('  the first 40 frames ' + r.at + ': ' + fmt(r.cost) + (r.progs.length ? '; new programs: ' + r.progs.join(' | ') : ''));
        if (r.who && r.who.length) console.log('      worn by: ' + r.who.join(' ; '));
        for (const d of (r.keyDiffs || [])) console.log('      old key -> new key: ' + d);
        for (const d of (r.made || [])) console.log('      made by: ' + d); }
      const rv = (R.reveal || []).map(r => r.cost.links || 0);
      ok(rv.length === 3 && rv.every(n => n === 0), 'the first 40 frames of each flight link nothing (the one loading drew the world once, the craft compiled in its light)', 'links ' + rv.join(' / '));
      // NO BACKGROUND LOADING IN FLIGHT: the world resident and at rest, the first frames of a flight upload no world
      // (roll-out 2's are its new aeroplane's own buffers, first drawn outside: the aircraft's cost)
      const up = (R.reveal || []).map(r => Math.round((r.cost['bytes.bufferData'] || 0) / 1e6));
      ok(up.length === 3 && up[0] < 16 && up[2] < 16, 'no background loading in flight: the first 40 frames after roll-outs 1 and 3 upload under 16 MB of buffers', 'MB ' + up.join(' / ') + ' (roll-out 2: the new aeroplane\'s own)');
      ok(R.settle && R.settle.rest, 'the one loading let the world come to rest at the stand (the stream\'s near queue empty, the fill idle)', JSON.stringify(R.settle));
      ok(R.flight && R.flight.worldUpdate > 0, 'the counters can see: in flight the world ticks', R.flight && ('worldUpdate ' + R.flight.worldUpdate + ', world updateMatrixWorld ' + R.flight.worldUmw + ' over ' + R.flight.frames + ' frames'));
      ok(!R.errors.length, 'trips: no script, timer or frame of the page threw', R.errors.join(' | ') || undefined);
      if (R.simw) ok(R.simw.inline === 0 && R.simw.phase === 'live' && R.simw.placeOk === true && !R.simw.wvBad && !R.simw.strays && !(R.simw.errors || []).length,
        'the physics worker (the default candidate) flew every flight: placed, live, the world version held', JSON.stringify(R.simw));
      else console.log('  (the flights flew inline: ?simw=0, or no worker for the page)');
    }
  }
  if (S) {
    ok(!S.failed, 'setup: the page booted touched and lifted on Fly', S.failed);
    if (!S.failed) {
      ok(S.setup.sections.length > 0 && !S.setup.errors.length, 'the setup screen mounts the rail\'s sections', S.setup.sections.join(' ') + '; ' + S.setup.rows + ' rows, ' + S.setup.pills + ' pills' + (S.setup.errors.length ? '; errors ' + S.setup.errors.join(' | ') : ''));
      ok(!S.missingInRail.sections.length && !S.missingInRail.rows.length && !S.missingInRail.pills.length, 'ONE REGISTRY: every section, row and pill of the setup screen is the rail\'s', JSON.stringify(S.missingInRail));
      ok(!S.gfxMissing.length, 'every graphics option that does not reload is on the setup screen', S.gfxMissing.join(', ') || 'all');
      ok(!S.reloadPresent.length && !S.reloadRail.length, 'the options that reload the page are LEFT OUT of the setup screen (the rail keeps them)', 'present ' + (S.reloadPresent.join(', ') || 'none') + '; missing from the rail ' + (S.reloadRail.join(', ') || 'none'));
      const want = { fly: ['route', 'start', 'engines', 'controls'], view: ['camera', 'instruments', 'map', 'trace', 'screen'], sky: ['night', 'weather'], graphics: ['graphics'] };
      ok(JSON.stringify(S.items) === JSON.stringify(Object.entries(want).map(([k, secs]) => ({ k, secs }))), 'the setup screen\'s sections: FLY route/start/engines/controls, VIEW, SKY & WORLD time/weather, GRAPHICS', JSON.stringify(S.items));
      ok(!S.touchBefore.touched && S.touched && S.holdLogged, 'a touch on the setup screen holds the auto-start', 'before ' + JSON.stringify(S.touchBefore) + ', hold logged ' + S.holdLogged);
      ok(!S.touchBefore.pulse && S.touchAfter && S.touchAfter.pulse && S.after60.pulse, 'G1065 Fly pulses once the setup is touched (not before; still when the load is done and it waits)', 'before ' + JSON.stringify(S.touchBefore) + ', after ' + JSON.stringify(S.touchAfter) + ', 60 frames on ' + JSON.stringify(S.after60));
      ok(S.aToRail.picked && S.aToRail.setupNow === S.aToRail.picked && S.aToRail.railNow === S.aToRail.picked, 'LIVE: a pick on the setup screen shows in the rail', JSON.stringify(S.aToRail));
      ok(S.bToSetup.railNow !== undefined && S.bToSetup.setupNow === S.bToSetup.railNow && S.bToSetup.setupBefore !== S.bToSetup.setupNow, 'LIVE: a switch flipped in the rail shows on the setup screen', JSON.stringify(S.bToSetup));
      ok(S.stateAtEnd === 'waiting' && S.after60.state === 'waiting' && S.after60.fly, 'touched: the load finishes and the screen WAITS, Fly lit (60 frames on)', JSON.stringify(S.after60));
      ok(S.settle.ran.includes('worldCompile') && S.settle.ran.includes('craft'), 'a graphics row picked while it waited is compiled BEFORE the lift', 'shadows ' + S.shadows.was + ' -> ' + S.shadows.now + '; the settle ran ' + S.settle.ran.join(' ') + '; ' + fmt(S.settle.cost));
      ok(!(S.afterLift.links > 0), 'after the lift, nothing links (30 frames)', fmt(S.afterLift) + (S.afterLiftProgs && S.afterLiftProgs.length ? '; new programs: ' + S.afterLiftProgs.join(' | ') : ''));
      ok(S.setupHidden, 'the setup screen goes with the loading screen');
      ok(!S.errors.length, 'setup: no script, timer or frame of the page threw', S.errors.join(' | ') || undefined);
    }
  }
  if (opt('json')) { fs.writeFileSync(opt('json'), JSON.stringify({ trips: RS, setup: S }, null, 1)); console.log('  report -> ' + opt('json')); }
  console.log('  wall ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  console.log('GATE ROUNDTRIP: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
}
main().catch(e => { console.log('  FAIL ' + (e && e.stack || e)); console.log('GATE ROUNDTRIP: FAIL'); process.exit(1); });
