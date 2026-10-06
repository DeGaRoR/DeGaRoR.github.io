#!/usr/bin/env node
// DMG-D4b (the user's review via the coordinator: "the previous crash's drawing survives the reset"): EVERY WAY BACK TO A
// FRESH AEROPLANE CLEARS THE WRECK. A client of tools/live_driver.js (a page at the stand, ?damage=1&simw=0; the GPU lock
// first). Per path: a 30 m/s trunk crash staged as the stills stage it (the wind off), the wreck checked drawn (bodies,
// released parts), then the path the player takes -
//   retry     the crash's card: `Fly again` (bGo after endFlight: fullReset);
//   garage    `The shed` (bHangar2), then `Roll out` again;
//   place     `The shed`, another departure in the route select, `Roll out`;
// then a few seconds of the game's own frames and the check: the wreck layer idle (FLYDIY_WRECK_STATS().active false), no
// debris body left in the scene (wreckDebris:*), every part object visible and on its rig (no collapsed matrix), the
// skin break idle (FLYDIY_SKINBREAK_STATS), and a still of the fresh aeroplane.
//   node tools/dmg_wreck_paths.js [--cmd 8572] [--out <dir>] [--paths retry,garage,place]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : d; };
const S = require('./dmg_wreck_stills.js'), MB = require('./master_bench.js');
const OUT = path.resolve(opt('out', '.')); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ev = async js => { const b = await S.post('/eval', js); try { return JSON.parse(b); } catch (e) { return b; } };

// the page's own frames again (the stills rig holds the sim's step; the paths need the game's loop)
function pageFree() { const sim = FLIGHT_PROBE.sim(); if (window.__d4bStep) { sim.step = window.__d4bStep; delete window.__d4bStep; } return 1; }
// the wreck as drawn now
// THE GIANT SHEETS (the user: "giant sheets after a crash" in the fresh aeroplane's shots): every drawn mesh of the model,
// its triangles with an edge past 2 m, and its longest edge against the longest it has as built (wreckBuild's meshes0
// copy where there is one) - which geometry holds them, by name and bucket section
function pageGiant() {
  // EVERY scene the page draws (the world's and the hangar's), not only the flight's model: a crashed aeroplane drawn in
  // the hangar after a reset path was no mesh of FLIGHT_PROBE.model() (16:30 / 17:12: the model clean, the sheets drawn)
  const P = FLIGHT_PROBE, m = P.model(), out = [];
  const scenes = [['world', P.craft() && P.craft().parent], ['hangar', P.hangarScene ? P.hangarScene() : null]];
  const inModel = new Set(); if (m && m.grp) m.grp.traverse(o => inModel.add(o));
  const recGeos = new Set(); try { for (const R of (window.FLYDIY_SKINBREAK_RECS ? FLYDIY_SKINBREAK_RECS() : [])) for (const g of (R.geos || [])) recGeos.add(g); } catch (e) {}
  const seen = new Set();
  for (const [sn, sc] of scenes) {
    if (!sc) continue;
    sc.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || seen.has(o)) return; seen.add(o);
      let vis = o.visible; for (let q = o.parent; q && vis; q = q.parent) vis = q.visible; if (!vis) return;
      const g = o.geometry, pa = g.attributes.position.array, ix = g.index ? g.index.array : null, nt = ix ? g.index.count / 3 : pa.length / 9;
      let big = 0, worst = 0;
      for (let t = 0; t < nt; t++) {
        const a = ix ? ix[t * 3] : t * 3, b = ix ? ix[t * 3 + 1] : t * 3 + 1, c = ix ? ix[t * 3 + 2] : t * 3 + 2;
        if (a === b && b === c) continue;
        const e = (i, j) => Math.hypot(pa[i * 3] - pa[j * 3], pa[i * 3 + 1] - pa[j * 3 + 1], pa[i * 3 + 2] - pa[j * 3 + 2]);
        const L = Math.max(e(a, b), e(b, c), e(c, a)); if (L > worst) worst = L; if (L > 2) big++;
      }
      if (!big) return;
      const chain = []; for (let q = o; q && chain.length < 6; q = q.parent) chain.push(q.name || q.type);
      const mt = Array.isArray(o.material) ? o.material[0] : o.material;
      out.push({ scene: sn, chain: chain.join(' < '), inFlightModel: inModel.has(o), key: m && m.wreckBuild && m.wreckBuild.keyOf ? (m.wreckBuild.keyOf.get(o) || null) : null,
        sec: (m && m.mats && o.name && m.mats[o.name] && m.mats[o.name].sec) || null, tris: nt | 0, big, worst: +worst.toFixed(2),
        kind: o.isSkinnedMesh ? 'skinned' : (o.isInstancedMesh ? 'instanced' : (recGeos.has(g) ? 'skin-break record (bound)' : 'static')),
        material: mt ? (mt.name || mt.type) + (mt.color ? ' #' + mt.color.getHexString() : '') : null });
    });
  }
  return { meshes: out.sort((a, b) => b.big - a.big).slice(0, 16) };
}
// THE CRASHED MODEL AFTER THE PATH (17:24: the census over the flight's model clean, a crashed Cub still drawn at the
// stand): the model the crash was drawn on, kept before the path - is it still the page's model, is its group still in a
// scene and visible, and how many of its triangles are past 2 m
function pageOldMark() { window.__d4bOld = FLIGHT_PROBE.model(); return !!window.__d4bOld; }
function pageOld() {
  const O = window.__d4bOld, m = FLIGHT_PROBE.model(); if (!O || !O.grp) return { none: true };
  let sc = null, vis = O.grp.visible; for (let q = O.grp.parent; q; q = q.parent) { if (q.isScene) sc = q; vis = vis && q.visible; }
  let big = 0, tris = 0, meshes = 0;
  O.grp.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || !o.visible) return; meshes++;
    const g = o.geometry, pa = g.attributes.position.array, ix = g.index ? g.index.array : null, nt = ix ? g.index.count / 3 : pa.length / 9; tris += nt;
    for (let t = 0; t < nt; t++) { const a = ix ? ix[t * 3] : t * 3, b = ix ? ix[t * 3 + 1] : t * 3 + 1, c = ix ? ix[t * 3 + 2] : t * 3 + 2; if (a === b && b === c) continue;
      const e = (i, j) => Math.hypot(pa[i * 3] - pa[j * 3], pa[i * 3 + 1] - pa[j * 3 + 1], pa[i * 3 + 2] - pa[j * 3 + 2]); if (Math.max(e(a, b), e(b, c), e(c, a)) > 2) big++; } });
  return { sameModel: O === m, inScene: !!sc, scene: sc ? (sc === (FLIGHT_PROBE.hangarScene ? FLIGHT_PROBE.hangarScene() : null) ? 'hangar' : 'world') : null, visible: vis, meshes, tris: tris | 0, big };
}
// THE SCENES' GROUPS (A0: "list scene.children by name, uuid and triangle count after the rebuild, and diff against a fresh
// load"): every group down to depth 3 of the world's scene and the hangar's, its drawn triangles (visible meshes under it)
// and how many are past 2 m. A group after a path that a fresh load did not have, holding giant triangles, is the survivor
function pageScene() {
  const P = FLIGHT_PROBE, out = [];
  const tri = o => { let n = 0, big = 0; o.traverse(q => { if (!q.isMesh || !q.geometry || !q.geometry.attributes.position) return;
      let vis = q.visible; for (let a = q.parent; a && a !== o.parent && vis; a = a.parent) vis = a.visible; if (!vis) return;
      const g = q.geometry, pa = g.attributes.position.array, ix = g.index ? g.index.array : null, nt = ix ? g.index.count / 3 : pa.length / 9; n += nt;
      if (nt > 200000) return;
      for (let t = 0; t < nt; t++) { const a = ix ? ix[t * 3] : t * 3, b = ix ? ix[t * 3 + 1] : t * 3 + 1, c = ix ? ix[t * 3 + 2] : t * 3 + 2; if (a === b && b === c) continue;
        const e = (i, j) => Math.hypot(pa[i * 3] - pa[j * 3], pa[i * 3 + 1] - pa[j * 3 + 1], pa[i * 3 + 2] - pa[j * 3 + 2]); if (Math.max(e(a, b), e(b, c), e(c, a)) > 2) big++; } });
    return [n | 0, big]; };
  const walk = (sn, o, path, d) => { for (const c of o.children) { const nm = c.name || c.type, pth = path + '/' + nm; const [n, big] = tri(c);
      if (n) out.push({ scene: sn, path: pth, uuid: c.uuid, visible: c.visible, tris: n, big, isModel: c === (P.model() && P.model().grp) });
      if (d < 3 && c.children && c.children.length && c.children.length < 60) walk(sn, c, pth, d + 1); } };
  const W = P.craft() && P.craft().parent, H = P.hangarScene ? P.hangarScene() : null;
  if (W) walk('world', W, '', 1); if (H && H !== W) walk('hangar', H, '', 1);
  return out;
}
// THE AEROPLANE SNAPSHOT (the coordinator: the flown geometries wrapped CAGE_VISUAL's own arrays - a crash written into the
// snapshot draws the wreck in every view built from it): (1) the snapshot's own triangles past 2 m - it is pristine or
// it is not; (2) every visible mesh of every scene whose position / index shares a buffer with the snapshot, its
// triangles past 2 m - 'built from the aeroplane snapshot' instead of by size
function pageSnap() {
  const CV = window.CAGE_VISUAL, P = FLIGHT_PROBE; if (!CV || !CV.groups) return { none: true };
  const bufs = new Set(); let snapTris = 0, snapBig = 0;
  const giant = (pa, ix, nt) => { let big = 0; for (let t = 0; t < nt; t++) { const a = ix ? ix[t * 3] : t * 3, b = ix ? ix[t * 3 + 1] : t * 3 + 1, c = ix ? ix[t * 3 + 2] : t * 3 + 2; if (a === b && b === c) continue;
    const e = (i, j) => Math.hypot(pa[i * 3] - pa[j * 3], pa[i * 3 + 1] - pa[j * 3 + 1], pa[i * 3 + 2] - pa[j * 3 + 2]); if (Math.max(e(a, b), e(b, c), e(c, a)) > 2) big++; } return big; };
  for (const k in CV.groups) { const g = CV.groups[k]; if (!g || !g.pos) continue;
    for (const a of [g.pos, g.nrm, g.idx]) if (a && a.buffer) bufs.add(a.buffer);
    const nt = g.idx ? g.idx.length / 3 : g.pos.length / 9; snapTris += nt; snapBig += giant(g.pos, g.idx || null, nt); }
  const out = [], m = P.model();
  const scenes = [['world', P.craft() && P.craft().parent], ['hangar', P.hangarScene ? P.hangarScene() : null]];
  const seen = new Set();
  for (const [sn, sc] of scenes) { if (!sc) continue;
    sc.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position || seen.has(o)) return; seen.add(o);
      const pa = o.geometry.attributes.position.array, ix = o.geometry.index ? o.geometry.index.array : null;
      if (!(bufs.has(pa.buffer) || (ix && bufs.has(ix.buffer)))) return;
      let vis = o.visible; for (let q = o.parent; q && vis; q = q.parent) vis = q.visible;
      const nt = ix ? ix.length / 3 : pa.length / 9, big = giant(pa, ix, nt);
      let inModel = false; for (let q = o; q; q = q.parent) if (m && q === m.grp) { inModel = true; break; }
      const chain = []; for (let q = o; q && chain.length < 6; q = q.parent) chain.push(q.name || q.type);
      out.push({ scene: sn, visible: vis, inFlightModel: inModel, chain: chain.join(' < '), tris: nt | 0, big, sharesPos: bufs.has(pa.buffer) }); }); }
  const drawn = out.filter(e => e.visible);
  return { snapTris: snapTris | 0, snapBig, meshes: drawn.length, meshesBig: drawn.filter(e => e.big).length, bigNotModel: drawn.filter(e => e.big && !e.inFlightModel).slice(0, 12), bigInModel: drawn.filter(e => e.big && e.inFlightModel).length };
}
// THE GPU'S COPY (19:15: a crashed Cub still drawn at the stand while every CPU array of the aeroplane is clean - with and
// without DMG-WALL's copy on the first break): (1) the skinned meshes whose bones stand away from their bind pose (the
// flown bake's fold poses a bone per part: the shader would draw a wreck the CPU arrays never hold); (2) then every
// attribute and index of every visible mesh flagged for upload again - a still after it tells a stale upload apart
function pageBones() {
  const P = FLIGHT_PROBE, out = [], seen = new Set();
  for (const sc of [P.craft() && P.craft().parent, P.hangarScene ? P.hangarScene() : null]) { if (!sc) continue;
    sc.traverse(o => { if (!o.isSkinnedMesh || !o.skeleton || seen.has(o)) return; seen.add(o);
      let vis = o.visible; for (let q = o.parent; q && vis; q = q.parent) vis = q.visible; if (!vis) return;
      const B = o.skeleton.bones; let far = 0, worst = 0;
      // (the bones' spread: the distance from each bone's world place to the mesh's own - a wreck flings them apart)
      const c = new THREE.Vector3(); o.getWorldPosition(c); const bp = new THREE.Vector3();
      for (const b of B) { b.getWorldPosition(bp); const d = bp.distanceTo(c); if (d > worst) worst = d; if (d > 8) far++; }
      const chain = []; for (let q = o; q && chain.length < 5; q = q.parent) chain.push(q.name || q.type);
      out.push({ chain: chain.join(' < '), bones: B.length, farBones: far, worstBoneM: +worst.toFixed(2) }); }); }
  return out;
}
function pageReupload() {
  const P = FLIGHT_PROBE; let n = 0;
  for (const sc of [P.craft() && P.craft().parent, P.hangarScene ? P.hangarScene() : null]) { if (!sc) continue;
    sc.traverse(o => { if (!o.isMesh || !o.geometry) return; const g = o.geometry;
      for (const k in g.attributes) { const a = g.attributes[k]; if (a && !a.isInterleavedBufferAttribute) { a.needsUpdate = true; n++; } }
      if (g.index) g.index.needsUpdate = true; }); }
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(n))));
}
// THE SKINNED POSITIONS (the coordinator: a CPU-clean geometry drawn stretched is a skinned one - read it AS DRAWN): every
// visible SkinnedMesh's vertices through its bones (three's getVertexPosition), its triangles past 2 m, the bones those
// triangles ride (their part's name, their scale: a part collapsed by a debris release reads ~1e-6) - no GPU needed
function pageSkinned() {
  const P = FLIGHT_PROBE, out = [], seen = new Set(), v = new THREE.Vector3(), sc3 = new THREE.Vector3(), p3 = new THREE.Vector3(), q4 = new THREE.Quaternion();
  for (const sc of [P.craft() && P.craft().parent, P.hangarScene ? P.hangarScene() : null]) { if (!sc) continue;
    sc.traverse(o => { if (!o.isSkinnedMesh || !o.skeleton || seen.has(o) || typeof o.getVertexPosition !== 'function') return; seen.add(o);
      let vis = o.visible; for (let q = o.parent; q && vis; q = q.parent) vis = q.visible; if (!vis) return;
      const g = o.geometry, n = g.attributes.position.count, X = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { o.getVertexPosition(i, v); X[i * 3] = v.x; X[i * 3 + 1] = v.y; X[i * 3 + 2] = v.z; }
      const ix = g.index ? g.index.array : null, nt = ix ? ix.length / 3 : n / 3, SI = g.attributes.skinIndex ? g.attributes.skinIndex.array : null;
      let big = 0, worst = 0; const bonesHit = new Map();
      for (let t = 0; t < nt; t++) { const a = ix ? ix[t * 3] : t * 3, b = ix ? ix[t * 3 + 1] : t * 3 + 1, c = ix ? ix[t * 3 + 2] : t * 3 + 2; if (a === b && b === c) continue;
        const e = (i, j) => Math.hypot(X[i * 3] - X[j * 3], X[i * 3 + 1] - X[j * 3 + 1], X[i * 3 + 2] - X[j * 3 + 2]);
        const L = Math.max(e(a, b), e(b, c), e(c, a)); if (L > worst) worst = L;
        if (L > 2) { big++; if (SI) for (const k of [a, b, c]) { const bi = SI[k * 4]; bonesHit.set(bi, (bonesHit.get(bi) || 0) + 1); } } }
      const parts = (o.userData && o.userData.flownMerge) || {};
      const bl = [...bonesHit.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8).map(([bi, c]) => { const B = o.skeleton.bones[bi]; if (!B) return { bone: bi, c };
        B.matrixWorld.decompose(p3, q4, sc3); return { bone: bi, c, scale: +Math.max(sc3.x, sc3.y, sc3.z).toExponential(2), at: [p3.x, p3.y, p3.z].map(x => +x.toFixed(2)) }; });
      const chain = []; for (let q = o; q && chain.length < 4; q = q.parent) chain.push(q.name || q.type);
      out.push({ chain: chain.join(' < '), verts: n, tris: nt | 0, big, worst: +worst.toFixed(2), bones: o.skeleton.bones.length, merge: parts, bonesOfBig: bl });
    }); }
  return out;
}
function pageWreck() {
  const P = FLIGHT_PROBE, m = P.model(), scene = P.craft().parent, W = window.FLYDIY_WRECK_STATS ? FLYDIY_WRECK_STATS() : {};
  const debris = scene.children.filter(c => /^wreckDebris:/.test(c.name || '')).length;
  let hidden = 0, collapsed = 0;
  const parts = [].concat((m.engRigs || []).map(e => e.obj), m.props || [], (m.wheelParts || []).map(w => w.obj), m.castorRig ? [m.castorRig.obj] : []);
  for (const o of parts) { if (!o) continue; if (!o.visible) hidden++; const e = o.matrix.elements; if (Math.abs(e[0]) < 1e-4 && Math.abs(e[5]) < 1e-4 && Math.abs(e[10]) < 1e-4) collapsed++; }
  const SB = window.FLYDIY_SKINBREAK_STATS ? FLYDIY_SKINBREAK_STATS() : null, D = P.sim().damage ? P.sim().damage() : null;
  return { active: !!W.active, bodies: (W.bodies || []).length, gone: (W.parts || []).filter(p => p.gone).map(p => p.kind + ':' + p.why), debris, parts: parts.length, hidden, collapsed,
           skinRecs: SB ? (SB.recs != null ? SB.recs : SB.n) : null, broken: (P.sim().dmgState ? (P.sim().dmgState().br || []).length : (D ? D.broken.length : null)), t: +P.sim().t.toFixed(2), garage: document.body.classList.contains('mode-ws') };
}
const waitFor = async (js, ms) => { const t = Date.now() + ms; while (Date.now() < t) { if (await ev(js) === true) return true; await sleep(500); } return false; };
const inWorld = "(window.BOOT ? BOOT.state === 'gone' : true) && !document.body.classList.contains('mode-ws') && !!(window.FLIGHT_PROBE && FLIGHT_PROBE.sim())";
const inShed = "document.body.classList.contains('mode-ws')";

(async () => {
  const R = { at: new Date().toISOString(), paths: {} };
  const pl0 = await ev(MB.A.places), places = typeof pl0 === 'string' ? JSON.parse(pl0) : pl0;
  const strips = places.filter(p => p.kind === 'strip');
  R.fresh = await S.run(pageScene);   // (a fresh load: the stand, before any crash)
  R.freshSnap = await S.run(pageSnap); console.log('fresh load: the snapshot ' + JSON.stringify(R.freshSnap));
  for (const k of opt('paths', 'retry,garage,place').split(',')) {
    const r = { path: k };
    // (a staged crash that breaks nothing proves nothing about the path: staged once more, the why kept - the hits, the
    // steps, the sim's clock - and the path marked NOT EXERCISED if it still breaks nothing)
    const crashOnce = async () => { const x = await S.run(S.pageStage, S.CASES['trunk-0'].o);
      const why = await ev("JSON.stringify({ hits: FLIGHT_PROBE.sim().trunkHits ? FLIGHT_PROBE.sim().trunkHits() : null, t: FLIGHT_PROBE.sim().t, held: !!window.__d4bStep, world: !!FLIGHT_PROBE.world().treeHits })");
      return { broken: x.worker ? (x.pageBr || 0) : x.broken, worker: !!x.worker, reason: x.reason, steps: x.steps, why: typeof why === 'string' ? JSON.parse(why) : why }; };
    r.crash = await crashOnce();
    if (!r.crash.broken) { r.crash0 = r.crash; await S.run(pageFree); r.crash = await crashOnce(); }
    r.exercised = r.crash.broken > 0;
    await S.run(pageFree);
    r.wreck = await S.run(pageWreck);
    await S.run(pageOldMark);
    if (k === 'retry') {
      r.act = await ev("(() => { FLIGHT_PROBE.endFlight('crashed'); document.getElementById('bGo').click(); return 'ok'; })()");
      await sleep(4000);
    } else {
      r.rollIn = await ev(MB.A.rollIn); r.shed = await waitFor(inShed, 120000); await sleep(3000);
      if (k === 'place') { const other = strips.find(p => p.id !== 'HOME') || strips[0]; r.from = other && other.id; r.set = await ev(MB.A.setFrom(r.from)); }
      r.rollOut = await ev(MB.A.rollOut); r.world = await waitFor(inWorld, 300000); await sleep(5000);
    }
    r.after = await S.run(pageWreck);
    r.giant = await S.run(pageGiant);
    r.old = await S.run(pageOld);
    r.snap = await S.run(pageSnap);
    r.bones = await S.run(pageBones);
    r.skinned = await S.run(pageSkinned);
    console.log('  ' + k + ' skinned meshes as drawn (positions through their bones): ' + JSON.stringify(r.skinned.filter(x => x.big).slice(0, 8)) + ' (' + r.skinned.length + ' skinned, ' + r.skinned.filter(x => x.big).length + ' with triangles past 2 m)');
    console.log('  ' + k + ' skinned meshes and their bones: ' + JSON.stringify(r.bones.slice(0, 12)));
    console.log('  ' + k + ' the aeroplane snapshot after the path: ' + JSON.stringify(r.snap));
    r.scene = await S.run(pageScene);
    { const key = e => e.scene + e.path + '#' + e.tris, F = new Set((R.fresh || []).map(key)), U = new Set((R.fresh || []).map(e => e.uuid));
      r.survivors = r.scene.filter(e => e.big > 0 && !F.has(key(e))).map(e => Object.assign({ newUuid: !U.has(e.uuid) }, e));
      console.log('  ' + k + ' groups with giant triangles not in a fresh load: ' + JSON.stringify(r.survivors.slice(0, 20))); }
    console.log('  ' + k + ' the crashed model after the path: ' + JSON.stringify(r.old));
    console.log('  ' + k + ' giant triangles (an edge past 2 m): ' + JSON.stringify(r.giant));
    r.ok = r.exercised && !r.after.active && r.after.bodies === 0 && r.after.debris === 0 && r.after.hidden === 0 && r.after.collapsed === 0 && !r.after.broken;
    // (two views of the fresh aeroplane, far enough to see all of it: a front quarter and from above-behind)
    r.shots = [];
    for (const [i, cam] of [[150, 14, 14], [235, 30, 18]].entries()) {
      await S.run(S.pageView, cam); await sleep(800);
      const f = path.join(OUT, 'path_' + k + '_after_' + (i + 1) + '.png'); await S.get('/shot?f=' + encodeURIComponent(f)); r.shots.push(f);
    }
    r.reuploaded = await S.run(pageReupload);
    await S.run(S.pageView, [235, 30, 18]); await sleep(800);
    { const f = path.join(OUT, 'path_' + k + '_after_reupload.png'); await S.get('/shot?f=' + encodeURIComponent(f)); r.shots.push(f); }
    console.log('  ' + k + ' re-uploaded ' + r.reuploaded + ' attributes, a still again: path_' + k + '_after_reupload.png');
    console.log(k + ': crash ' + JSON.stringify(r.crash) + ' wreck ' + JSON.stringify(r.wreck) + ' -> after ' + JSON.stringify(r.after) + ' ' + (!r.exercised ? 'NOT EXERCISED (the staged crash broke nothing)' : r.ok ? 'CLEAN' : 'LEFT OVER'));
    R.paths[k] = r;
    // (back to the home strip for the next path)
    if (k === 'place') { await ev(MB.A.rollIn); await waitFor(inShed, 120000); await ev(MB.A.setFrom('HOME')); await ev(MB.A.rollOut); await waitFor(inWorld, 300000); await sleep(4000); }
  }
  fs.writeFileSync(path.join(OUT, 'paths.json'), JSON.stringify(R, null, 1));
  console.log('WRECK_PATHS ' + Object.entries(R.paths).map(([k, r]) => k + ' ' + (!r.exercised ? 'NOT EXERCISED' : r.ok ? 'CLEAN' : 'LEFT OVER')).join(', '));
})().catch(e => { console.log('WRECK_PATHS_FAIL ' + (e && e.stack || e)); process.exit(1); });
