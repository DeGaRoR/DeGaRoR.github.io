#!/usr/bin/env node
// _shedshadow_check.js - GATE SHEDSHADOW (G2071, GARAGE-LAPTOP 2026-10-06): THE SHED'S SHADOW CACHE DRAWS WHAT THE FULL PASS
// DRAWS. src/viewer/shed_shadow.js bakes each shed light's static casters into a depth of its own and, per frame, copies it
// into the live map and draws only the casters that move. A depth buffer keeps the nearest fragment whatever the order,
// so the map is the full pass's EXACTLY when, for every light, the casters drawn into its map over the bake and the live
// pass are the full pass's casters, each once. In the page in node (tools/_page_node.js; the Jodel - the laptop's
// aeroplane - on retro, where the five lamps and the key cast), every draw into a shadow map is recorded by light and by
// the map's binding (the bake's binding, then the frame's):
//   1 AT REST: 30 frames, no bake; each map takes its copy and the movers only (the beacon's rotor, the pilot)
//   2 EXACT: the full pass's casters per light (the cache off) == the bake's + the live pass's at the next bake, disjoint
//   3 A PROP MOVED (0.3 m): that frame re-bakes ('moved') without it, it draws live, the union still the full pass's;
//     still again, it joins the static depth ('joined') within 2 x 2K frames
//   4 A PROP HIDDEN: re-baked at once ('gone'); drawn nowhere; shown again, drawn live, then joined
//   5 A LAMP MOVED (5 cm): that light alone re-bakes ('light'); the other maps keep their static depth (one binding)
//   6 THE KEY HELD: the day moved 2 s (0.01 deg of sun) - the key's pose and its static depth kept; a jump of 30 min re-bakes it
//   7 OFF (?shedshadow=0 / S.on false): the full pass every frame, the static depths released
//   8 THE COUNT: retro's shed frame draws < 40 % of the full pass's (the reason it exists)
//   9 THE GLASS PASS (G2072, shed_shadow.js G): the transmission target takes under half its draws; INDEPENDENTLY, rays from
//     the eye through ten points of every transmissive triangle cross no object left out past the pane; the outdoors still
//     drawn; a transmissive card stood in the room: what is behind it drawn again (the same ray check); the eye on a pane:
//     the full pass
// Usage: node tools/_shedshadow_check.js [--build jodel] (it re-runs itself with a 6 GB heap). Exit 1 on any FAIL. No --help.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const BUILDS = { cub: 'builds/cub_2026-09-20_corrected.json', jodel: 'builds/jodel_2026-09-20_corrected.json', metal: 'bugReports/cessnaMetal (1).json' };
const BK = opt('build', 'jodel');
// the page in node wants ~5 GB of heap: under the runner (no flag) the gate re-runs itself with it
if (require('v8').getHeapStatistics().heap_size_limit < 5e9 && !process.env.SHEDSHADOW_CHILD) {
  const r = require('child_process').spawnSync(process.execPath, ['--max-old-space-size=6144', __filename].concat(argv), { stdio: 'inherit', env: Object.assign({}, process.env, { SHEDSHADOW_CHILD: '1' }) });
  process.exit(r.status == null ? 1 : r.status);
}
let fails = 0;
const ok = (c, msg, detail) => { if (!c) fails++; console.log((c ? '  PASS ' : '  FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); };

(async () => {
  const { openPage } = require('./_page_node.js');
  const hooks = { afterScript(name, P) { if (/gfx_settings\.js/.test(name) && P.win.GFX) P.win.GFX.set('preset', 'retro'); } };
  const P = await openPage({ quiet: true, hooks, query: 'gfx=retro', storage: { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILDS[BK] || BK), 'utf8') } });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 900000);
  await P.frames(30);
  const SS = W.SHED_SHADOW, FP = W.FLIGHT_PROBE, R = FP.renderer(), SC = FP.hangarScene();
  ok(!!SS, 'the page has SHED_SHADOW');
  if (!SS) process.exit(1);
  const lightsNow = () => { const a = []; SC.traverse(o => { if (o.isLight && o.castShadow && o.shadow && o.visible) a.push(o); }); return a; };
  // the recorder: per light, the bindings of its map in the frame, each a list of the objects drawn into it
  let rec = null, cur = null;
  const rt0 = R.setRenderTarget, rbd = R.renderBufferDirect;
  R.setRenderTarget = function (t) {
    if (rec) { cur = null; if (t) for (const L of lightsNow()) if (L.shadow.map === t) { const b = rec.get(L) || (rec.set(L, []), rec.get(L)); b.push([]); cur = b[b.length - 1]; } }
    return rt0.apply(this, arguments);
  };
  R.renderBufferDirect = function (cam, sc, g, m, o) { if (rec && cur) cur.push(o); return rbd.apply(this, arguments); };
  const frame = async () => { rec = new Map(); cur = null; await P.frames(1); const r = rec; rec = null; return r; };
  const isCopy = o => !!(o.userData && o.userData.shedShadowCopy);
  const st = () => SS.stat();
  const nameOf = o => o.name || (o.parent && o.parent.name) || o.type;
  // the full pass: per light, the set of objects (the cache off)
  const fullSets = async () => { SS.S.on = false; await P.frames(2); const r = await frame(); const out = new Map();
    for (const [L, b] of r) out.set(L, new Set(b.flat())); SS.S.on = true; return out; };
  // the frame that bakes: wait for a bake with `why` (max n frames), return its record
  const untilBake = async (why, n) => { const w0 = (st().whys[why] || 0); for (let i = 0; i < n; i++) { const r = await frame(); if ((st().whys[why] || 0) > w0) return r; } return null; };
  // EXACT: in a bake frame each light's FIRST binding is the bake, its LAST the live pass
  const exact = (r, full, tag, Lonly) => {
    let bad = [], n = 0;
    for (const [L, F] of full) {
      const b = r.get(L) || [];
      if (Lonly && L !== Lonly) continue;
      const bake = b.length >= 2 ? b[0] : [], live = (b[b.length - 1] || []).filter(o => !isCopy(o));
      const U = new Set(bake.concat(live)); n++;
      const dup = bake.filter(o => live.indexOf(o) >= 0);
      const miss = [...F].filter(o => !U.has(o)), extra = [...U].filter(o => !F.has(o));
      if (dup.length || miss.length || extra.length) bad.push((L.name || L.type) + ': ' + dup.length + ' twice, ' + miss.length + ' missing (' + miss.slice(0, 3).map(nameOf).join(',') + '), ' + extra.length + ' extra');
      if (b.length < 2) bad.push((L.name || L.type) + ': ' + b.length + ' binding(s)');
    }
    ok(!bad.length && n > 0, tag + ': every light\'s bake + live pass == the full pass, each caster once (' + n + ' lights)', bad.slice(0, 4).join('; '));
  };

  // 1 AT REST
  { const s0 = st(); let maxLive = 0, copies = 0, frames = 0;
    for (let i = 0; i < 30; i++) { const r = await frame(); frames++;
      for (const [, b] of r) { const last = b[b.length - 1] || []; maxLive = Math.max(maxLive, last.filter(o => !isCopy(o)).length); copies += last.filter(isCopy).length; } }
    const s1 = st();
    ok(s1.bakes === s0.bakes && s1.lightBakes === s0.lightBakes, '1 at rest: 30 frames, no bake', 'bakes ' + s0.bakes + ' -> ' + s1.bakes + ', light bakes ' + s0.lightBakes + ' -> ' + s1.lightBakes + ', why ' + s1.why);
    ok(s1.baked >= 300 && s1.live <= 6, '1 at rest: the shed\'s casters baked, the movers live', 'baked ' + s1.baked + ', live ' + s1.live + ' (' + SS.liveList().map(x => x.name).join(', ') + ')');
    ok(maxLive <= 2 * Math.max(1, s1.live) + 4, '1 at rest: a map takes the movers only', 'most live draws into one map ' + maxLive);
    ok(copies === frames * s1.lights || copies > 0, '1 at rest: each map takes its static depth\'s copy', copies + ' copies over ' + frames + ' frames, ' + s1.lights + ' lights'); }
  // 2 EXACT (the next bake after a release: the cache off then on)
  const full = await fullSets();
  ok(full.size >= 6, '2 the full pass: retro\'s shed casts six maps (five lamps and the key)', full.size + ' maps; casters ' + [...full.values()].map(s => s.size).join('/'));
  { const r = await untilBake('joined', 60); ok(!!r, '2 the cache on again bakes within 60 frames'); if (r) exact(r, full, '2 EXACT'); }
  // 3 A PROP MOVED
  let prop = null; SC.traverse(o => { if (!prop && o.isMesh && o.castShadow && /^prop:(crate|drum|stool|jerrycan|box)/.test(nameOf(o))) prop = o; });
  ok(!!prop, '3 a shed prop to move', prop ? nameOf(prop) : 'none');
  if (prop) {
    const g = prop.parent && /^prop:/.test(prop.parent.name || '') ? prop.parent : prop;
    await P.frames(4);
    ok(SS.liveList().every(x => x.name !== nameOf(prop)), '3 before: the prop is in the static depth');
    const w0 = st().whys.moved || 0;
    g.position.x += 0.3;
    const r = await frame();
    ok((st().whys.moved || 0) === w0 + 1, '3 the prop moved: re-baked at once (moved)', JSON.stringify(st().whys));
    const live = SS.liveList().map(x => x.name);
    ok(live.indexOf(nameOf(prop)) >= 0, '3 the moved prop draws live', live.join(', '));
    exact(r, await fullSets(), '3 EXACT on the frame the prop moved');
    // (fullSets turned the cache off and on: it starts over, the prop at its new place joins with the rest)
    const r2 = await untilBake('joined', 60);
    ok(!!r2 && SS.liveList().every(x => x.name !== nameOf(prop)), '3 still again, the prop is in the static depth (joined)');
    // a second move against a warm cache whose prop has moved once: it waits 2K frames to join again (the back-off)
    g.position.x -= 0.3; await frame();
    let k = 0; while (k < 60 && SS.liveList().some(x => x.name === nameOf(prop))) { await frame(); k++; }
    ok(k >= 2 * 8 - 2 && k < 60, '3 moved twice, it joins after the doubled stillness', k + ' frames');
  }
  // 4 A PROP HIDDEN
  if (prop) {
    await untilBake('joined', 80); await P.frames(4);
    const g0 = st().whys.gone || 0;
    prop.visible = false;
    const r = await frame();
    ok((st().whys.gone || 0) === g0 + 1, '4 a prop hidden: re-baked at once (\'gone\')', JSON.stringify(st().whys));
    let drawn = 0; for (const [, b] of r) for (const seg of b) drawn += seg.filter(o => o === prop).length;
    ok(drawn === 0, '4 the hidden prop is drawn into no map', drawn + ' draws');
    prop.visible = true;
    const r2 = await frame(); let live = 0; for (const [, b] of r2) live += (b[b.length - 1] || []).filter(o => o === prop).length;
    ok(live > 0, '4 shown again: it draws live at once', live + ' live draws');
    const j = await untilBake('joined', 40); ok(!!j, '4 ...and joins the static depth');
  }
  // 5 A LAMP MOVED
  { const spots = lightsNow().filter(L => L.isSpotLight);
    ok(spots.length >= 5, '5 the shed\'s lamps cast', spots.length + ' spot lights');
    if (spots.length) {
      await P.frames(10);
      const L = spots[0], s0 = st();
      L.position.y += 0.05;
      const r = await frame(); const s1 = st();
      ok(s1.lightBakes === s0.lightBakes + 1 && s1.bakes === s0.bakes, '5 a lamp moved: that light re-baked alone (\'light\')', 'light bakes ' + s0.lightBakes + ' -> ' + s1.lightBakes + ', bakes ' + s0.bakes + ' -> ' + s1.bakes);
      const others = [...r].filter(([X]) => X !== L).map(([, b]) => b.length);
      ok((r.get(L) || []).length === 2 && others.every(n => n === 1), '5 the lamp\'s map bound twice (bake, frame), every other map once', 'lamp ' + (r.get(L) || []).length + ', others ' + others.join(','));
      exact(r, await (async () => { const f = await fullSets(); return f; })(), '5 EXACT for the moved lamp', L);
      L.position.y -= 0.05; await P.frames(3);
    }
  }
  // 6 THE KEY HELD
  { const world = W.FLIGHT_PROBE.world ? W.FLIGHT_PROBE.world() : null;
    const key = lightsNow().find(L => L.isDirectionalLight);
    if (world && world.setDay && world.day && key) {
      await untilBake('joined', 40); await P.frames(10);
      const s0 = st(), p0 = key.position.clone(), utc = world.day.utc;
      world.setDay({ utc: utc + 2 }); await P.frames(3);
      const s1 = st();
      ok(key.position.equals(p0) && s1.lightBakes === s0.lightBakes, '6 the day moved 2 s: the key\'s pose and static depth kept', 'light bakes ' + s0.lightBakes + ' -> ' + s1.lightBakes);
      world.setDay({ utc: utc + 1800 }); await P.frames(3);
      const s2 = st();
      ok(!key.position.equals(p0) && s2.lightBakes + s2.bakes > s1.lightBakes + s1.bakes, '6 the day moved 30 min: the key moved and its depth re-baked', 'light bakes ' + s1.lightBakes + ' -> ' + s2.lightBakes + ', bakes ' + s1.bakes + ' -> ' + s2.bakes + ' ' + JSON.stringify(s2.whys));
      world.setDay({ utc }); await P.frames(3);
    } else ok(false, '6 the world\'s day and the key', 'world ' + !!world + ', setDay ' + !!(world && world.setDay) + ', key ' + !!key);
  }
  // 7 OFF
  { SS.S.on = false; await P.frames(2); const r = await frame(); let copies = 0, n = 0; for (const [, b] of r) for (const seg of b) { copies += seg.filter(isCopy).length; n += seg.length; }
    ok(copies === 0 && n > 3000 && !SS.held(), '7 off: the full pass every frame, the static depths released', n + ' shadow draws, ' + copies + ' copies, held ' + SS.held());
    SS.S.on = true; }
  // 9 THE GLASS PASS (G2072): the transmission target's draws, by object, the skip off and on, in the same pose
  { const room = W.GARAGE_ENV && W.GARAGE_ENV._debug ? W.GARAGE_ENV._debug().hangar : null;
    ok(!!(room && room.group), '9 the shed hands its room (its group)');
    const TH = W.THREE, isT = t => !!(t && t.texture && t.texture.generateMipmaps && t.samples >= 4 && !t.depthTexture);
    // the draws three makes into the transmission target over one frame, and the objects (the counter wraps outside the
    // frame: the glass skip's own wrapper sits on top of it, so a skipped object never reaches it - this is what three drew)
    const transDraws = async () => { let inT = false, cnt = 0; const objs = new Set();
      const s1 = R.setRenderTarget; R.setRenderTarget = function (t) { inT = isT(t); return s1.apply(this, arguments); };
      const b1 = R.renderBufferDirect; R.renderBufferDirect = function (c, sc, g, m, o) { if (inT) { cnt++; objs.add(o); } return b1.apply(this, arguments); };
      try { await P.frames(1); } finally { R.setRenderTarget = s1; R.renderBufferDirect = b1; }
      return { cnt, objs }; };
    // THE INDEPENDENT CHECK: rays from the eye through 10 points of every transmissive triangle (its corners, its edges'
    // middles and thirds, its centre), past the triangle: none may cross the world box of an object left out
    const glassTris = () => { const out = []; SC.traverse(o => { if (!o.isMesh || !o.visible) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
      if (!ms.some(m => m && m.visible && m.transmission > 0)) return; let v = o; while (v) { if (!v.visible) return; v = v.parent; }
      const g = o.geometry, pa = g.attributes.position, idx = g.index ? g.index.array : null, n = idx ? g.index.count : pa.count, p = i => new TH.Vector3().fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld);
      for (let t = 0; t + 2 < n; t += 3) out.push([p(idx ? idx[t] : t), p(idx ? idx[t + 1] : t + 1), p(idx ? idx[t + 2] : t + 2)]); }); return out; };
    const behind = (eye, skipped) => { const tris = glassTris(), hits = new Set(); const boxes = [...skipped].map(o => { const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); return [o, g.boundingBox.clone().applyMatrix4(o.matrixWorld)]; });
      const ray = new TH.Ray(), at = new TH.Vector3();
      for (const [a, b, c] of tris) { const pts = [a, b, c, a.clone().lerp(b, .5), b.clone().lerp(c, .5), c.clone().lerp(a, .5), a.clone().lerp(b, 1 / 3), b.clone().lerp(c, 1 / 3), c.clone().lerp(a, 1 / 3), a.clone().add(b).add(c).multiplyScalar(1 / 3)];
        for (const q of pts) { const d = q.clone().sub(eye), tq = d.length(); ray.set(eye, d.normalize());
          for (const [o, bx] of boxes) if (!hits.has(o) && ray.intersectBox(bx, at) && at.distanceTo(eye) > tq + 1e-4) hits.add(o);
          // (intersectBox gives the near hit; a box the ray is inside of at the pane gives the pane's point: test its far side too)
          for (const [o, bx] of boxes) if (!hits.has(o) && bx.containsPoint(q.clone().addScaledVector(ray.direction, 1e-3))) hits.add(o); } }
      return [...hits].map(nameOf); };
    if (room) {
      SS.G.on = false; await P.frames(2); const full = await transDraws();
      SS.G.on = true; await P.frames(2); const skip = await transDraws(); const gs = SS.glassStat();
      ok(full.cnt > 200 && skip.cnt < 0.5 * full.cnt && gs.ok > 0 && !gs.why, '9 the glass pass: what no pane shows left out of the transmission target', full.cnt + ' -> ' + skip.cnt + ' draws (skipped ' + gs.skipped + ', ' + gs.panes + ' panes, why "' + gs.why + '")');
      const left = new Set([...full.objs].filter(o => !skip.objs.has(o)));
      const eye = new TH.Vector3().setFromMatrixPosition(FP.camera().matrixWorld);
      const bad = behind(eye, left);
      ok(!bad.length, '9 no object left out lies behind a pane (rays from the eye through every pane triangle)', bad.length + ' behind: ' + bad.slice(0, 5).join(', '));
      ok(skip.cnt > 0, '9 the outdoors still drawn into the target (the sky, the field through the door)', skip.cnt + ' draws');
      // a pane standing in the room (a 1 x 1 m transmissive card, the eye's side of it): the skip goes on, but what is behind
      // the card is drawn again - the same ray check, with the card among the panes
      const pane = new TH.Mesh(new TH.PlaneGeometry(1.5, 1.5), new TH.MeshPhysicalMaterial({ transmission: 0.9, transparent: true }));
      const cam = FP.camera(), fwd = new TH.Vector3(); cam.getWorldDirection(fwd);
      pane.position.copy(eye).addScaledVector(fwd, 2.5); pane.lookAt(eye); SC.add(pane); pane.updateMatrixWorld(true);
      await P.frames(2); const withCard = await transDraws(); const gs2 = SS.glassStat();
      const left2 = new Set([...full.objs].filter(o => !withCard.objs.has(o)));
      const bad2 = behind(eye, left2);
      ok(!gs2.why && !bad2.length && withCard.cnt > skip.cnt, '9 a pane in the room: what lies behind it drawn again, nothing behind any pane left out', withCard.cnt + ' draws (was ' + skip.cnt + '), ' + bad2.length + ' behind, why "' + gs2.why + '"');
      SC.remove(pane); pane.geometry.dispose(); pane.material.dispose(); await P.frames(2);
      // the eye inside a pane's box: the full pass (the cache handed an eye on a window's glass)
      const tri = glassTris().find(t => t[0].distanceTo(t[1]) > 0.3);
      if (tri) { const camIn = FP.camera().clone(); camIn.position.copy(tri[0]).lerp(tri[1], .5).lerp(tri[2], .2); camIn.updateMatrixWorld(true);
        SS.pre(R, SC, camIn, room); const gs3 = SS.glassStat(); SS.post();
        ok(/^eye (in a pane|past)/.test(gs3.why), '9 the eye on a pane: the full transmission pass', 'why "' + gs3.why + '"'); }
    }
  }
  // 8 THE COUNT
  { await untilBake('joined', 40); await P.frames(4);
    const count = async () => { let c0 = 0; const f = R.renderBufferDirect; let n = 0; R.renderBufferDirect = function () { n++; return f.apply(this, arguments); }; await P.frames(1); R.renderBufferDirect = f; return n; };
    const on = await count(); SS.S.on = false; await P.frames(2); const off = await count(); SS.S.on = true; await P.frames(2);
    ok(on > 0 && on < 0.4 * off, '8 retro\'s shed frame: the cache draws under 40 % of the full pass', on + ' vs ' + off + ' draws (' + (100 * on / off).toFixed(0) + ' %)'); }
  console.log(fails ? 'GATE SHEDSHADOW: ' + fails + ' FAIL' : 'GATE SHEDSHADOW: PASS');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
