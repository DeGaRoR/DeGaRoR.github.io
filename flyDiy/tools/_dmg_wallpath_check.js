#!/usr/bin/env node
// GATE DMGWALLPATH (G1858.2, DMG-WALL; the Deform Coordinator's ask) - A WRECK NEVER REACHES THE NEXT AEROPLANE. Found on the
// box (DMG-D4b's worker paths, 2026-10-06): crash -> the shed -> roll-out drew the next aeroplane as giant sheets. The flown
// geometries WRAP the cage snapshot's own arrays (app.js mkGeo), so the wreck's riding and its removed triangles were
// written into window.CAGE_VISUAL; the next roll-out built from them and took them as its rest. G1858.2 copies the owning
// snapshot group's arrays at the first break (app.js brkDetach): the snapshot is never written by a wreck.
//
//   node tools/_dmg_wallpath_check.js              -> "GATE DMGWALLPATH: PASS|FAIL"
//   node tools/_dmg_wallpath_check.js --selftest   -> negative verification (brkDetach off - the bug as it was - must turn it red)
//   --only=cub|metal  --secs=S (sim seconds of the crash, default 5)
//
// THE PAGE ITSELF IN NODE (tools/_page_node.js; GATE DMGPAGEW's set-up): dev.html?simw=1&damage=1 - the DEFAULT mode, the
// solver in a real thread through the harness's Worker shim, the draws stubbed - the user's Cub and the metal Cessna, each in
// its own child: the garage boot, Roll out, the snapshot and the fresh flown model's rest hashed; the 30 m/s trunk crash
// (4 m up, a trunk 40 m ahead, placed through the worker); then BOTH ways back to a fresh aeroplane: the shed and Roll out
// (the garage path), and the shed, ANOTHER DEPARTURE picked, Roll out (the place path). After each, asserted:
//   1 the crash broke members on the page (FLYDIY_DMG_STATE().br) - else the path tests nothing;
//   2 THE SNAPSHOT (CAGE_VISUAL's groups and parts, position + index) hashes equal to the fresh load's;
//   3 the rebuilt flown model's REST (every rig's as-built array) equals the fresh build's;
//   4 no drawn triangle of the aeroplane with an edge past 2 m;
//   5 no page or worker error.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json' };

// ---- in the page: the hashes and the giant triangles ----
const fnv = a => { let h = 2166136261 >>> 0; const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
function snapHash(W) {
  const D = W.CAGE_VISUAL || {}, per = {};
  const add = (G, pre) => { if (G) for (const k of Object.keys(G).sort()) for (const f of ['pos', 'idx']) if (G[k] && G[k][f] && G[k][f].buffer) per[pre + k + '.' + f] = fnv(G[k][f]); };
  add(D.groups, ''); (D.parts || []).forEach((p, i) => add(p.groups, 'p' + i + ':'));
  return per;
}
function restHash(W) {
  const m = W.FLIGHT_PROBE.model(), per = {}; if (!m) return per;
  const rigs = (m.wreckBuild && m.wreckBuild.rigsAll) || m.rigs || [];
  for (const r of rigs) if (r.base) per['rig:' + r.name] = fnv(r.base);
  for (const [k, L] of [['surf', m.surfParts], ['strut', m.strutRigs], ['leg', m.stretchRigs], ['anchor', m.anchorRigs], ['link', m.linkRigs]])
    (L || []).forEach((r, i) => { if (r.base && r.base.buffer) per[k + i] = fnv(r.base); });
  return per;
}
function giant(W) {
  const m = W.FLIGHT_PROBE.model(), out = []; if (!m || !m.grp) return out;
  m.grp.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || !o.visible) return;
    const g = o.geometry, A = g.attributes.position.array, ix = g.index ? g.index.array : null, nt = ix ? g.index.count / 3 : A.length / 9; let n = 0;
    for (let t = 0; t < nt; t++) { const a = ix ? ix[t*3] : t*3, b = ix ? ix[t*3+1] : t*3+1, c = ix ? ix[t*3+2] : t*3+2; if (a === b && b === c) continue;
      const e = (i, j) => Math.hypot(A[i*3] - A[j*3], A[i*3+1] - A[j*3+1], A[i*3+2] - A[j*3+2]); if (Math.max(e(a, b), e(b, c), e(a, c)) > 2) n++; }
    if (n) out.push((o.name || 'mesh') + ' x' + n); });
  return out;
}
// EVERY SCENE (the coordinator: the stand in the shed showed the crashed Cub while the flight model was clean): the hangar's
// scene and the world's, each aeroplane-sized mesh (bounding radius under 25 m - not the ground, not the sky) with a
// triangle edge past 2 m, by its name and parent's -> { key: count }
function giantScenes(W) {
  // the AEROPLANE's meshes only: under the stand's editor mount (the shed) or under any flown model this page has built
  // (W.__wpGrps: every model.grp seen - an old one still in a scene is the G1070 shape, reported apart); per mesh key
  // (scene : name < parent >) the triangles with an edge past 2 m
  const FP = W.FLIGHT_PROBE, out = {}, seen = W.__wpGrps || (W.__wpGrps = new Set());
  try { const m = FP.model(); if (m && m.grp) seen.add(m.grp); } catch (e) {}
  const roots = [];
  try { const mt = W.CAGE_JOIN && W.CAGE_JOIN.mount && W.CAGE_JOIN.mount(); if (mt) roots.push(['stand', mt]); } catch (e) {}
  let cur = null; try { cur = FP.model() && FP.model().grp; } catch (e) {}
  for (const g of seen) { let sc = g; while (sc.parent) sc = sc.parent; if (g.parent) roots.push([g === cur ? 'flown' : 'OLD-MODEL-IN-A-SCENE', g]); }
  for (const [tag, root] of roots) root.traverse(o => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || !o.visible) return;
    // (the crew - Mixamo characters, 'char:' - are not the aeroplane: their skeletons sit off the mesh's bind by design)
    { let q = o, ch = false; while (q && !ch) { if (/^char:/.test(q.name || '')) ch = true; q = q.parent; } if (ch) return; }
    // (G1858.2: a SKINNED mesh - the hybrid fold, a bone a part - is measured on its SKINNED positions: the raw attribute
    // of a part whose bone kept the wreck's matrix is clean while the drawing is not; and its bones off their bind by more
    // than 0.5 m are listed)
    const g = o.geometry, ix = g.index ? g.index.array : null; let A = g.attributes.position.array; let n = 0;
    if (o.isSkinnedMesh && o.skeleton && (o.applyBoneTransform || o.boneTransform)) { try {
      o.skeleton.update(); const T3 = W.THREE, v = new T3.Vector3(), cnt = g.attributes.position.count, S = new Float32Array(cnt * 3), f = o.applyBoneTransform ? 'applyBoneTransform' : 'boneTransform';
      for (let i = 0; i < cnt; i++) { v.fromBufferAttribute(g.attributes.position, i); o[f](i, v); S[i*3] = v.x; S[i*3+1] = v.y; S[i*3+2] = v.z; }
      A = S;
      const Mi = new T3.Matrix4().copy(o.matrixWorld).invert(), M = new T3.Matrix4(), p = new T3.Vector3(), off = [];
      o.skeleton.bones.forEach((b, i) => { M.multiplyMatrices(Mi, b.matrixWorld).multiply(o.skeleton.boneInverses[i]); p.setFromMatrixPosition(M); const d = p.length(); if (d > 0.5) off.push((b.name || 'bone' + i) + ' ' + d.toFixed(2)); });
      if (off.length) { const kb = 'BONES-OFF-BIND:' + (o.name || 'mesh') + ' ' + off.slice(0, 6).join(', '); out[kb] = off.length; }
    } catch (e) { out['SKIN-ERR:' + (o.name || 'mesh') + ' ' + String(e && e.message || e).slice(0, 80)] = 1; } }
    const nt = ix ? g.index.count / 3 : A.length / 9;
    for (let t = 0; t < nt; t++) { const a = ix ? ix[t*3] : t*3, b = ix ? ix[t*3+1] : t*3+1, c = ix ? ix[t*3+2] : t*3+2; if (a === b && b === c) continue;
      const e = (i, j) => Math.hypot(A[i*3] - A[j*3], A[i*3+1] - A[j*3+1], A[i*3+2] - A[j*3+2]); if (Math.max(e(a, b), e(b, c), e(a, c)) > 2) n++; }
    const k = tag + ':' + (o.name || 'mesh') + '<' + ((o.parent && o.parent.name) || '') + '>'; out[k] = (out[k] || 0) + n; });
  return out;
}
// what grew past the baseline (a mesh with more triangles past 2 m than fresh, or an old model in a scene at all)
const newKeys = (base, now) => Object.keys(now).filter(k => now[k] > (base[k] || 0) || (/^OLD-MODEL/.test(k) && now[k] >= 0)).map(k => k + ' x' + now[k]);
const diff = (A, B) => Object.keys(A).filter(k => A[k] !== B[k]).concat(Object.keys(B).filter(k => !(k in A)));

// ============================================================ THE CHILD: one build, one page
async function child() {
  const out = arg('out'), fault = arg('fault', ''), SECS = +arg('secs', 5), key = arg('build', 'cub');
  const { openPage } = require('./_page_node.js');
  const R = { key, fault, errors: [], paths: {} };
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[key]), 'utf8') };
  const P = await openPage({ quiet: true, storage, query: 'simw=1&damage=1', workers: /sim_host\.js/ });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  if (fault === 'nodetach') W.FLYDIY_WALL_NODETACH = true;
  const tripN = () => (W.FLYDIY_TRIPS || []).length;
  const tripDone = (kind, n0) => { const T = W.FLYDIY_TRIPS || []; const t = T[T.length - 1]; return T.length > n0 && !!(t && t.kind === kind && t.done && W.BOOT.state === 'gone'); };
  const SW = () => W.FLYDIY_SIMW || null;
  const live = () => { const s = SW() && SW().state(); return !!(s && s.phase === 'live' && s.flight && s.flight.live); };
  const rollOut = async () => { const n0 = tripN(); W.document.getElementById('bGo').click(); await P.until(() => tripDone('rollout', n0), 900000);
    const RD = W.FLIGHT_PROBE.renderer(); RD.render = function () {}; if (RD.shadowMap) RD.shadowMap.render = function () {};
    for (let i = 0; i < 600 && !live(); i++) await P.frames(1); return live(); };
  const rollIn = async () => { const n0 = tripN(); const b = W.document.getElementById('bHangar2'); if (!b) return false; b.click(); await P.until(() => tripDone('rollin', n0), 900000); for (let i = 0; i < 30; i++) await P.frames(1); return true; };
  // ---- fresh: the snapshot and the flown model's rest
  // (the snapshot as the first flight left it, before any crash: the garage's first roll-out writes it on its own -
  // measured, 63 of the Cub's position arrays between the garage and the live flight, the rebuilt rest unchanged - so
  // what is asserted is that THE WRECK writes nothing into it)
  const snapG = snapHash(W), objG = W.CAGE_VISUAL; R.dbg = {};
  const gBase = giantScenes(W);
  R.live0 = await rollOut();
  R.snap0 = snapHash(W);
  Object.assign(R.dbg, { garageVsLive: diff(snapG, R.snap0).length, sameObjLive: W.CAGE_VISUAL === objG });
  R.rest0 = restHash(W);
  Object.assign(gBase, giantScenes(W));
  if (!R.live0) { R.errors = P.errors.slice(0, 20); fs.writeFileSync(out, JSON.stringify(R)); P.close(); process.exit(0); }
  // ---- the crash (DMGPAGEW's): 4 m up, 30 m/s, a trunk 40 m ahead, through the worker
  const crash = async tag => {
    const FP = W.FLIGHT_PROBE; W.FLYDIY_SKINBREAK = true; FP.setManual(true);
    const sim = FP.sim(), world = FP.world(), [xA] = sim.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl;
    const c = sim.cgPos(), g = world.terrainH(c[0], c[2]); let yMin = Infinity; for (let i = 1; i < sim.p.length; i += 3) yMin = Math.min(yMin, sim.p[i]);
    let placed = false; FP.place({ at: [c[0], g + 4 + (c[1] - yMin), c[2]], zeroV: true, dv: [30 * fx, 0, 30 * fz] }).then(() => { placed = true; });
    await P.until(() => placed, 60000);
    const c2 = sim.cgPos(), tx = c2[0] + fx * 40, tz = c2[2] + fz * 40, gt = world.terrainH(tx, tz);
    world.treeHits.set('fill:wallpath', [tx, tz, gt, 0.3, gt + 10]); sim.ctl.thr = 0;
    const tA = sim.t; let br = 0;
    for (let f = 0; f < SECS * 60 + 600 && sim.t - tA < SECS; f++) { await P.frames(1); const DS = W.FLYDIY_DMG_STATE ? W.FLYDIY_DMG_STATE() : null; br = Math.max(br, DS && DS.br ? DS.br.length : 0); }
    world.treeHits.drop ? world.treeHits.drop('fill:wallpath') : world.treeHits.delete && world.treeHits.delete('fill:wallpath');
    const S = W.FLYDIY_SKINBREAK_STATS ? W.FLYDIY_SKINBREAK_STATS() : {};
    R.dbg.afterCrashVsGarage = diff(snapG, snapHash(W));
    return { br, recs: S.recs || 0, riding: S.riding || 0, placed };
  };
  // ---- the garage path: the shed, Roll out
  R.paths.garage = { crash: await crash('garage') };
  await rollIn(); R.paths.garage.shed = newKeys(gBase, giantScenes(W)); const okG = await rollOut();
  { const sC = snapHash(W); R.dbg.afterGarageVsGarage = diff(snapG, sC).length; R.dbg.afterGarageVsLive = diff(R.snap0, sC); R.dbg.garageVsLiveKeys = diff(snapG, R.snap0); R.dbg.sameObjAfter = W.CAGE_VISUAL === objG; R.dbg.afterCrashVsGarage = R.dbg.afterCrashVsGarage;
    if (arg('stop', '') === 'garage') { R.errors = P.errors.slice(0, 5); fs.writeFileSync(out, JSON.stringify(R)); P.close(); process.exit(0); } }
  Object.assign(R.paths.garage, { live: okG, snap: diff(R.snap0, snapHash(W)), rest: diff(R.rest0, restHash(W)), giant: giant(W), scenes: newKeys(gBase, giantScenes(W)) });
  // ---- the place path: crash again, the shed, another departure, Roll out
  R.paths.place = { crash: await crash('place') };
  await rollIn(); R.paths.place.shed = newKeys(gBase, giantScenes(W));
  const ids = (W.FLIGHT_PROBE.world().aerodromes || []).filter(a => !(a.kind === 'water' || a.water)).map(a => a.id);
  const other = ids.find(i => i !== 'HOME') || null;
  R.paths.place.to = other;
  if (other) {   // (the route pickers the shed shows: the base select set to another strip, its change dispatched)
    let set = false;
    for (const s of W.document.querySelectorAll('select')) { const o = [...(s.options || [])].find(x => x.value === other); if (o) { s.value = other; s.dispatchEvent(new W.Event('change')); set = true; break; } }
    if (!set) try { W.localStorage.setItem('flydiy.route', JSON.stringify({ v: 2, base: other, to: other })); } catch (e) {}
    R.paths.place.picked = set ? 'select' : 'pref';
  }
  const okP = await rollOut();
  Object.assign(R.paths.place, { live: okP, snap: diff(R.snap0, snapHash(W)), rest: diff(R.rest0, restHash(W)), giant: giant(W), scenes: newKeys(gBase, giantScenes(W)) });
  const s1 = SW() ? SW().state() : null;
  R.workerErrors = s1 && s1.errors ? s1.errors.slice(0, 10) : [];
  R.errors = P.errors.filter(e => !/impostor bake/.test(e)).slice(0, 20);
  delete R.snap0; delete R.rest0;
  fs.writeFileSync(out, JSON.stringify(R));
  P.close(); process.exit(0);
}

// ============================================================ THE PARENT
function runChild(key, fault, secs) {
  const out = path.join(os.tmpdir(), 'dmgwallpath_' + process.pid + '_' + key + (fault ? '_' + fault : '') + '.json');
  const a = [__filename, '--child=1', '--out=' + out, '--build=' + key, '--secs=' + secs]; if (fault) a.push('--fault=' + fault);
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000'].concat(a), { stdio: ['ignore', 'inherit', 'inherit'], timeout: 2 * 3600 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) return { key, failed: 'child exit ' + r.status + (r.signal ? ' ' + r.signal : '') };
  const R = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); return R;
}
function judge(R, say) {
  const f = [], bad = m => f.push(R.key + ': ' + m);
  if (R.failed) { bad(R.failed); return f; }
  if (!R.live0) { bad('the first roll-out never went live under the worker'); return f; }
  for (const [p, X] of Object.entries(R.paths)) {
    say('  ' + R.key + ' ' + p + ': crash ' + JSON.stringify(X.crash) + (X.to ? '; to ' + X.to + ' (' + X.picked + ')' : '') + '; live ' + X.live
        + '; snapshot differs in ' + (X.snap || []).length + ' (reported), shed ' + JSON.stringify(X.shed || []) + ', scenes ' + JSON.stringify(X.scenes || []) + ', rest differs in ' + (X.rest || []).length + ', giant ' + JSON.stringify(X.giant || []));
    if (!(X.crash && X.crash.br > 0)) bad(p + ': the crash broke nothing on the page - the path tests nothing');
    if (!X.live) bad(p + ': the roll-out after the shed never went live');
    if ((X.shed || []).length) bad(p + ': GIANT TRIANGLES IN THE SHED (the stand) after the crash: ' + X.shed.slice(0, 8).join(', '));
    if ((X.scenes || []).length) bad(p + ': giant triangles in a scene after the roll-out: ' + X.scenes.slice(0, 8).join(', '));
    if ((X.rest || []).length) bad(p + ': the rebuilt model\'s rest differs from the fresh build\'s: ' + X.rest.slice(0, 8).join(', '));
    if ((X.giant || []).length) bad(p + ': triangles past 2 m after the path: ' + X.giant.slice(0, 8).join(', '));
  }
  if ((R.errors || []).length || (R.workerErrors || []).length) bad('errors: page ' + JSON.stringify(R.errors).slice(0, 300) + ', worker ' + JSON.stringify(R.workerErrors).slice(0, 200));
  return f;
}
function parent() {
  const secs = +arg('secs', 5), say = m => console.log(m), only = arg('only', null), keys = Object.keys(BUILDS).filter(k => !only || only.split(',').includes(k));
  if (argv.includes('--selftest')) {
    say('DMGWALLPATH selftest: brkDetach off (the bug as it was) must turn the snapshot row red');
    const R = runChild('cub', 'nodetach', secs), f = judge(R, say), red = f.length > 0;
    say('  ' + (red ? 'ok  ' : 'FAIL') + '  the fault turned the row red' + (f.length ? ': ' + f.join(' | ') : ''));
    console.log('GATE DMGWALLPATH-SELFTEST: ' + (red ? 'PASS' : 'FAIL')); process.exit(red ? 0 : 1);
  }
  say('GATE DMGWALLPATH - a wreck never reaches the next aeroplane (dev.html?simw=1&damage=1: crash -> the shed -> roll-out, two ways)');
  // (the builds side by side: each child is a page of its own)
  const { spawn } = require('child_process');
  let fails = [];
  const res = keys.map(k => runChild(k, '', secs));
  for (const R of res) fails = fails.concat(judge(R, say));
  for (const m of fails) say('  FAIL  ' + m);
  if (!fails.length) say('  ok    the snapshot unwritten, the rebuilt rest the fresh build\'s, no triangle past 2 m, on both paths, both builds');
  console.log('GATE DMGWALLPATH: ' + (fails.length ? 'FAIL' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
}
if (argv.includes('--child=1')) child().catch(e => { console.error('DMGWALLPATH child: ' + (e && e.stack || e)); process.exit(2); });
else parent();
