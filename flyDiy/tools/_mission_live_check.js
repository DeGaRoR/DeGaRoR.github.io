#!/usr/bin/env node
// ============================================================================
// GATE MISSIONLIVE - A MISSION IN FLIGHT (MISSIONS-LIVE, 13 Nov 2026): src/viewer/mission_live.js, the page's half
// of 73c_mission_run.js, run in node over the REAL core (tools/_missions_lib.js loadMissions: src/core fresh over
// tools/flight_core.js) with the demo pack in use (src/missions/demo_p1.json through 73b missionPackUse, as ?pack=demo_p1).
// What is held, in blocks:
//   ARMED        a career with the demo gates mission accepted arms ONE tracker (g1, g2, r1, in order) and its markers
//                (g1 next, the rest later); a career with nothing of the kind arms nothing (due() false, tick() null).
//   THE PATH     a scripted flight (60 frames a second, the page's call pattern: due() then tick()) through g1, g2 and
//                the ring: every objective passed ONCE and IN ORDER, the timer started at g1 and stopped at g2, the
//                tracker sampled at its fixed rate (4 Hz, never per frame), the markers moving (g1 done, g2 next, ...),
//                the arrow's target following; the evidence through 75_ careerStopRecord and 74_ careerOnStop at w3:
//                the mission done, the gold medal, its lap on the done event.
//   MISSED       the same flight wide of g2: a 'missed g2' event (once), the ring not counted (a seq leg), the stop
//                refuses it with g2 "not flown yet"; a restart (arm again) flies it whole.
//   STRIKE       a pass a wingtip from g2's post (the lap running): a strike, +3 s on the lap.
//   SPLITS       the demo rally (accepted after the gates): its checkpoints in order, each split recorded with its
//                target, the lap on the done event.
//   THE DRAWING  (three.js r186 headless, no renderer) mount: one group in the scene - the posts, the ring, the
//                beacon on the next objective; done markers hidden; unmount leaves the scene as it was; nothing is
//                mounted with no mission. The frame() path with no DOM.
//   THE WIRING   app.js arms it at every departure (careerFlightStart, a chained leg, a restart), feeds it in careerFrame
//                behind one boolean, hands missionLiveStop's keys to careerStopRecord, ends it in the garage; build.js
//                lists it (and the props' generator) as lazy; map_menu.js draws the markers.
//   node tools/_mission_live_check.js             -> "GATE MISSIONLIVE: PASS|FAIL"
//   node tools/_mission_live_check.js --selftest  -> the module doctored one rule at a time; each must turn a check red
// ============================================================================
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const { loadMissions } = require('./_missions_lib.js');
const SELF = process.argv.includes('--selftest');
const LIVE_SRC = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'mission_live.js'), 'utf8');
const PACK = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'missions', 'demo_p1.json'), 'utf8'));
const THREE_SRC = fs.readFileSync(path.join(ROOT, 'vendor', 'three.min.js'), 'utf8');

function run(liveSrc) {
  const fails = [];
  let checks = 0;
  const ok = (c, m) => { checks++; if (!c) fails.push(m); return !!c; };
  const N = loadMissions({ core: true });
  const ctx = N.__ctx;
  vm.runInContext(liveSrc, ctx, { filename: 'mission_live.js' });
  const ML = ctx.MISSION_LIVE;
  if (!ok(!!ML, 'mission_live.js publishes MISSION_LIVE')) return { fails, checks };
  const use = N.missionPackUse(PACK);
  ok(use.ok, 'the demo pack is in use (' + (use.why || '') + ')');
  const hooks = { acceptVerdict: () => ({ ok: true, got: {} }) };
  const fresh = () => { let d = N.careerNew({ seed: 'live' }); for (const p of Object.keys(d.career.providers)) d.career.providers[p].rep = 3; d = N.careerNormalise(d); N.careerRefresh(d); return d; };
  const accept = (d, id) => { const r = N.careerAccept(d, id); return r.ok ? r.doc : null; };
  const stopAt = (aero, o) => N.careerStopRecord(Object.assign({ how: 'stopped', aero, occupants: 1, cargoKg: 0, row: { from: 'HOME', to: aero, t: 300 }, hour: 12 }, o || {}));
  const OPTS = { reach: 5, fields: N.CONTRACT_FIELDS, from: 'HOME' };

  // a polyline [x, y, z] flown at v m/s, at 60 frames a second the page's way: due() then tick() with the height
  function fly(wps, v, o) {
    o = o || {};
    const ev = [], seen = [];
    let t = 0, samples = 0, frames = 0, nulls = 0;
    for (let i = 1; i < wps.length; i++) {
      const A = wps[i - 1], B = wps[i], L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), n = Math.max(1, Math.ceil(L / v * 60));
      for (let k = 0; k < n; k++, t += 1 / 60) {
        const u = k / n, x = A[0] + (B[0] - A[0]) * u, y = A[1] + (B[1] - A[1]) * u, z = A[2] + (B[2] - A[2]) * u;
        frames++;
        if (!ML.due(t)) { if (ML.tick(t, x, y, z, y) !== null) nulls = -1e9; continue; }   // between samples tick is a no-op
        samples++;
        const e = ML.tick(t, x, y, z, y);
        if (e) ev.push(...e.map(q => JSON.parse(JSON.stringify(q))));
        if (o.watch) seen.push(o.watch(t));
      }
    }
    return { ev, t, samples, frames, nulls, seen };
  }
  const dirN = 349 * Math.PI / 180, ux = Math.sin(dirN), uz = -Math.cos(dirN);
  const R1 = [-734, 120, -2000];
  const PATH = [[-441, 100, 300], [-441, 100, -500], [-636, 100, -1500], R1, [R1[0] + ux * 300, 120, R1[2] + uz * 300]];

  // ---- NOTHING ARMED WITHOUT A MISSION -----------------------------------------------------------------------------------
  {
    const d = fresh();
    ok(ML.arm(d, OPTS) === 0 && !ML.active() && !ML.due(0) && ML.tick(0, 0, 100, 0, 100) === null && ML.evidence() === null,
       'no accepted mission: nothing armed, never due, tick null, no evidence');
    const dd = accept(fresh(), 'demo.order');
    ok(dd && ML.arm(dd, OPTS) === 0 && !ML.active(), 'an accepted mission with no place to fly or draw (demo.order, a build): nothing armed');
  }
  // ---- ARMED --------------------------------------------------------------------------------------------------------------
  let d = fresh();
  ok(d.career.contracts.offered.includes('demo.gates'), 'the demo gates mission is offered (' + d.career.contracts.offered.filter(x => /^demo/.test(x)).join(', ') + ')');
  d = accept(d, 'demo.gates');
  ok(!!d, 'demo.gates accepted');
  if (!d) return { fails, checks };
  ok(ML.arm(d, OPTS) === 1, 'demo.gates arms one run');
  const r0 = ML.runs()[0];
  ok(r0 && r0.seq && r0.objs.join() === 'g1,g2,r1', 'its tracker: g1, g2, r1 in order (' + (r0 && r0.objs.join()) + ')');
  const st0 = r0 ? r0.markers.map(m => m.key + ':' + m.state).join(' ') : '';
  ok(/g1:next/.test(st0) && /g2:later/.test(st0) && /r1:later/.test(st0), 'its markers: g1 next, g2 and r1 later (' + st0 + ')');
  ok(ML.next(-441, 300) && ML.next(-441, 300).key === 'g1', 'the arrow\'s target before the flight: g1');

  // ---- THE PATH: EVERY GATE, ONCE, IN ORDER; THE TIMER; THE RATE ----------------------------------------------------------
  const F = fly(PATH, 60, { watch: () => { const n = ML.next(); return n ? n.key : '-'; } });
  const hits = F.ev.filter(e => e.k === 'hit');
  ok(hits.map(e => e.key).join() === 'g1,g2,r1', 'the scripted flight passes every objective once, in order (' + hits.map(e => e.key).join() + ')');
  ok(hits.every((e, i) => !i || e.t > hits[i - 1].t), 'the hits\' times increase');
  ok(!F.ev.some(e => e.k === 'missed' || e.k === 'strike'), 'nothing missed, nothing struck on the clean line');
  const tm = F.ev.filter(e => e.k === 'timer');
  ok(tm.length === 2 && tm[0].state === 'start' && tm[1].state === 'stop' && Math.abs(tm[1].s - (hits[1].t - hits[0].t)) < 0.15,
     'the timer starts at g1 and stops at g2 (' + tm.map(e => e.state + (e.s != null ? ' ' + e.s : '')).join(', ') + ')');
  ok(Math.abs(F.samples - F.t / ML.RATE) <= 2 && F.samples < F.frames / 10 && F.nulls === 0,
     'the tracker samples at its fixed rate: ' + F.samples + ' samples in ' + F.frames + ' frames (' + F.t.toFixed(1) + ' s at ' + ML.RATE + ' s), tick a no-op between');
  const seq = F.seen.filter((k, i) => !i || k !== F.seen[i - 1]).join('>');
  ok(seq === 'g1>g2>r1>-', 'the next objective (the beacon, the arrow) follows the flight: ' + seq);
  const st1 = ML.runs()[0].markers.map(m => m.key + ':' + m.state).join(' ');
  ok(/g1:done/.test(st1) && /g2:done/.test(st1) && /r1:done/.test(st1), 'the markers after the flight: g1, g2, r1 done (' + st1 + ')');
  const EV = ML.evidence();
  ok(EV && EV['demo.gates'] && Object.keys(EV['demo.gates'].hits).join() === 'g1,g2,r1' && EV['demo.gates'].timers.speed && EV['demo.gates'].timers.speed.s > 0,
     'the evidence: the three hits, the lap');
  {
    const res = N.careerOnStop(d, stopAt('w3', { tracks: EV }), hooks), e = res.ok && res.events.find(q => q.k === 'done' && q.id === 'demo.gates');
    ok(!!e && e.medal === 'gold' && !res.doc.career.contracts.accepted.includes('demo.gates'),
       'the stop at w3 with the evidence: demo.gates done, gold (' + (e ? e.medal : res.untouched['demo.gates'] || res.why) + ')');
    if (res.ok) d = res.doc;
  }
  ML.end();

  // ---- A MISSED GATE IS REPORTED -------------------------------------------------------------------------------------------
  {
    let d2 = accept(fresh(), 'demo.gates');
    ML.arm(d2, OPTS);
    const wide = [PATH[0], PATH[1], [-900, 100, -1500], R1, PATH[4]];
    const M = fly(wide, 60);
    const miss = M.ev.filter(e => e.k === 'missed');
    ok(miss.length === 1 && miss[0].key === 'g2' && miss[0].id === 'demo.gates', 'wide of g2: one "missed g2" event (' + miss.map(e => e.key).join() + ')');
    ok(M.ev.filter(e => e.k === 'hit').map(e => e.key).join() === 'g1', 'wide of g2: only g1 counts (the ring is not armed past a missed gate)');
    const res = N.careerOnStop(d2, stopAt('w3', { tracks: ML.evidence() }), hooks);
    ok(!res.doc.career.contracts.live['demo.gates'] || !(res.doc.career.contracts.live['demo.gates'].stage > 0) ? /g2/.test(res.untouched['demo.gates'] || '') : false,
       'the stop refuses it, naming g2 (' + (res.untouched['demo.gates'] || '') + ')');
    d2 = res.doc;
    ML.arm(d2, OPTS);
    const again = fly(PATH, 60);
    ok(again.ev.filter(e => e.k === 'hit').map(e => e.key).join() === 'g2,r1' || again.ev.filter(e => e.k === 'hit').map(e => e.key).join() === 'g1,g2,r1',
       'flown again from the start: the open objectives pass (' + again.ev.filter(e => e.k === 'hit').map(e => e.key).join() + ')');
    ML.end();
  }

  // ---- A STRIKE ------------------------------------------------------------------------------------------------------------
  {
    const d3 = accept(fresh(), 'demo.gates');
    ML.arm(d3, OPTS);
    const close = [PATH[0], PATH[1], [-693, 30, -1500], R1, PATH[4]];
    const S = fly(close, 60);
    const sk = S.ev.filter(e => e.k === 'strike');
    const lap = ML.evidence()['demo.gates'].timers.speed;
    ok(sk.length === 1 && sk[0].key === 'g2' && sk[0].post === 0 && lap && lap.pen === 3 && Math.abs(lap.s - lap.raw - 3) < 0.05,
       'a wingtip at g2\'s west post (inside the lap): one strike, +3 s on the lap (' + sk.map(e => e.key + ':' + e.post).join() + ', ' + J(lap) + ')');
    ML.end();
  }

  // ---- SPLITS: THE RALLY ------------------------------------------------------------------------------------------------------
  {
    let dr = d;
    if (!dr.career.contracts.offered.includes('demo.rally')) { N.careerRefresh(dr); }
    const okOff = dr.career.contracts.offered.includes('demo.rally');
    ok(okOff, 'after the gates, the rally is offered (the chapter in order)');
    dr = accept(dr, 'demo.rally');
    if (ok(!!dr, 'demo.rally accepted')) {
      ML.arm(dr, OPTS);
      const r = ML.runs().find(q => q.id === 'demo.rally');
      ok(r && r.seq && r.objs.join() === 'cp1,cp2,cp3,cp4', 'the rally\'s tracker: cp1..cp4 in order (' + (r && r.objs.join()) + ')');
      const RP = [[-300, 300, 200], [-300, 300, -900], [900, 300, -1700], [1500, 300, -3200], [300, 250, -3600], [0, 250, -3600]];
      const Rf = fly(RP, 70);
      const sp = Rf.ev.filter(e => e.k === 'split');
      ok(Rf.ev.filter(e => e.k === 'hit').map(e => e.key).join() === 'cp1,cp2,cp3,cp4', 'the rally flown: cp1..cp4 in order');
      const lapR = Object.values(ML.evidence()['demo.rally'].timers)[0];
      ok(sp.length >= 2 && sp.every(e => typeof e.target === 'number' && e.s > 0) && lapR && lapR.splits.length === sp.length,
         'the splits recorded with their targets (' + sp.map(e => e.key + ' ' + e.s + '/' + e.target).join(', ') + ')');
      const res = N.careerOnStop(dr, stopAt('HOME', { tracks: ML.evidence() }), hooks);
      const live = res.doc.career.contracts.live['demo.rally'];
      ok(res.ok && (res.events.some(e => e.id === 'demo.rally') || (live && live.stage >= 1)), 'the rally\'s stop moves it on (' + (res.untouched['demo.rally'] || 'moved') + ')');
      ML.end();
    }
  }

  // ---- THE DRAWING ------------------------------------------------------------------------------------------------------------
  {
    const tctx = { console }; tctx.window = tctx; tctx.self = tctx; vm.createContext(tctx);
    vm.runInContext(THREE_SRC, tctx);
    const THREE = tctx.THREE, scene = new THREE.Scene(), before = scene.children.length;
    const d4 = accept(fresh(), 'demo.gates');
    ok(ML.mount(scene, { THREE, ground: () => 0 }) === false && scene.children.length === before, 'nothing armed: nothing mounted');
    ML.arm(d4, OPTS);
    ok(ML.mount(scene, { THREE, ground: () => 0 }) === true && scene.children.length === before + 1, 'armed: one group in the scene');
    const G = scene.children[scene.children.length - 1], dr = ML.drawn();
    let meshes = 0; G.traverse(o => { if (o.isMesh) meshes++; });
    ok(dr && dr.meshes >= 3 && meshes >= 6, 'the markers drawn: ' + (dr && dr.meshes) + ' places, ' + meshes + ' meshes (2 + 2 posts, the ring, the beacon)');
    const B = G.getObjectByName('missionBeacon');
    ok(B && B.visible && Math.abs(B.position.x - (-441)) < 1 && Math.abs(B.position.z - (-500)) < 1, 'the beacon stands on g1 (' + (B && B.position.x.toFixed(0) + ', ' + B.position.z.toFixed(0)) + ')');
    const cam = new THREE.PerspectiveCamera(60, 1.6, 0.5, 7000); cam.position.set(-441, 100, 300); cam.lookAt(-441, 100, -500); cam.updateMatrixWorld();
    ML.frame(cam, 0);
    fly(PATH.slice(0, 3).concat([[-680, 110, -1720]]), 60);
    ML.frame(cam, 16);
    ok(B.visible && Math.abs(B.position.z - (-2000)) < 1, 'after g1 and g2 the beacon moves to the ring');
    let hidden = 0; G.traverse(o => { if (o !== G && o.parent === G && o !== B && !o.visible) hidden++; });
    ok(hidden === 2, 'g1 and g2 (done) hidden: ' + hidden);
    ML.end();
    ok(scene.children.length === before && ML.drawn() === null, 'end(): the scene as it was');
    // the props themselves: tools/_mission_gen.js in (the page fetches it with the module) - the balloon columns and the
    // ring are the generator's, on the finish's shared materials
    for (const f of ['tools/_house_kit.js', 'tools/_house_gen.js', 'src/viewer/sign_tex.js', 'tools/_tower_gen.js', 'tools/_mission_gen.js'])
      vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), tctx, { filename: f });
    ctx.MISSION_GEN = tctx.MISSION_GEN;
    ML.arm(accept(fresh(), 'demo.gates'), OPTS);
    ML.mount(scene, { THREE, ground: () => 0 });
    const G2 = scene.children[scene.children.length - 1], mats = new Set();
    let tris = 0;
    G2.traverse(o => { if (o.isMesh && o.name !== 'missionBeacon') { mats.add(o.material); tris += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; } });
    ok(tris > 3000 && mats.size > 1, 'with MISSION_GEN: the generator\'s props (' + Math.round(tris) + ' tris over ' + mats.size + ' materials)');
    let ringY = null; G2.traverse(o => { if (o.parent && o.parent.parent === G2 && Math.abs(o.position.z + 2000) < 1) ringY = o.position.y; });
    ok(ringY === 120, 'the ring stands at its centre\'s height (' + ringY + ' m)');
    ML.end(); delete ctx.MISSION_GEN;
    ok(scene.children.length === before, 'end(): the scene as it was (props)');
  }

  // ---- THE WIRING ----------------------------------------------------------------------------------------------------------------
  {
    const APP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), BLD = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
    const MAP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'map_menu.js'), 'utf8');
    ok(/function careerFlightStart\(\) \{[^}]*missionLiveArm\(\)/.test(APP), 'app.js arms it at the roll-out (careerFlightStart)');
    ok(/if \(CAREER_DEV\) missionLiveArm\(\);\s+\/\/ MISSIONS-LIVE: the next leg/.test(APP) && /missionLiveArm\(\);\s+\/\/ MISSIONS-LIVE: a restart/.test(APP), 'app.js arms it again at a chained leg and a restart');
    ok(/if \(MSL\.on\) missionLiveFrame\(cg\);/.test(APP) && /if \(ML\.due\(t\)\) \{/.test(APP), 'careerFrame feeds it behind one boolean; the height is read only when a sample is due');
    ok(/\.\.\.missionLiveStop\(how, /.test(APP) && /out\.tracks = tr/.test(APP) && /out\.spot = sp/.test(APP) && /out\.spec = def\.spec/.test(APP) && /out\.occ = occ/.test(APP) && /out\.people = /.test(APP),
       'the stop record takes the tracks, the spot, the spec, the occupants and the people');
    ok(/if \(CAREER_DEV\) missionLiveEnd\(\);\s+\/\/ MISSIONS-LIVE: nothing tracked, nothing drawn in the shed/.test(APP), 'the garage ends it');
    ok(/\['tools', '_mission_gen\.js'\], \['src\/viewer', 'mission_live\.js'\]\]/.test(BLD), 'build.js: mission_live.js and _mission_gen.js are lazy');
    ok(/markers: Array\.isArray\(c\.markers\)/.test(MAP) && /for \(const c of lit\) for \(const m of \(c\.markers \|\| \[\]\)\)/.test(MAP), 'map_menu.js keeps the markers and draws the lit contracts\'');
    ok(/if \(!due\(t\)\) return null;/.test(liveSrc), 'tick returns before any work between samples');
    ok(!/document|THREE/.test(liveSrc.slice(liveSrc.indexOf('// ---- THE TRACKER'), liveSrc.indexOf('// ---- THE DRAWING'))), 'the tracker half touches no DOM, no THREE');
  }
  return { fails, checks };
}
const J = o => JSON.stringify(o);

if (SELF) {
  const sub = (a, b) => s => { if (!s.includes(a)) throw new Error('selftest: not found: ' + a); return s.replace(a, b); };
  const MUT = [
    ['the rate limit dropped (a sample every frame)', sub('? S.tNext + RATE : t + RATE;', '? t : t;')],
    ['the missed-gate report dropped', sub("(out = out || []).push({ k: 'missed', id: R.id, key: open[0].key, t });", '')],
    ['the markers never restated', sub("if (ev.some(e => e.k === 'hit' || e.k === 'photo')) restate(R);", '')],
    ['the evidence empty', sub('for (const R of S.runs) if (R.T) { out[R.id] = missionTrackEvidence(R.T); n++; }', '')],
    ['the reach not passed to the core', sub('missionTrackNew(rec, L, { reach: o.reach })', 'missionTrackNew(rec, L, { reach: 0 })')],
    ['done markers stay drawn', sub("g.visible = m.state !== 'done';", 'g.visible = true;')],
    ['the beacon never moves', sub('D.beacon.position.set(n.x, y0, n.z);', '')],
    ['end() leaves the props in the scene', sub('if (D.scene) D.scene.remove(D.group);', '')],
    ['armed with no objectives', sub('if (!O.objs.length && !markers.length) continue;', '')],
  ];
  let red = 0;
  for (const [name, f] of MUT) {
    let r;
    try { r = run(f(LIVE_SRC)); } catch (e) { r = { fails: ['threw: ' + e.message] }; }
    const isRed = r.fails.length > 0;
    if (isRed) red++;
    console.log((isRed ? '  red   ' : '  GREEN ') + name + (isRed ? ' (' + r.fails[0].slice(0, 90) + ')' : ''));
  }
  console.log('SELFTEST: ' + red + '/' + MUT.length + ' red');
  console.log('GATE MISSIONLIVE SELFTEST: ' + (red === MUT.length ? 'PASS' : 'FAIL'));
  process.exit(red === MUT.length ? 0 : 1);
}
const r = run(LIVE_SRC);
for (const f of r.fails) console.log('  FAIL ' + f);
console.log(r.checks + ' checks, ' + r.fails.length + ' failed');
console.log('GATE MISSIONLIVE: ' + (r.fails.length ? 'FAIL' : 'PASS'));
process.exit(r.fails.length ? 1 : 0);
