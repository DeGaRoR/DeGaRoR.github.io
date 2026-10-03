#!/usr/bin/env node
// _craftshadow_probe.js - CRAFT-SHADOW (G1410): WHAT MOVES THE CRAFT'S CASCADE WHILE NOTHING MOVES. The page in node
// (tools/_page_node.js: dev.html's scripts, the real three r186 on the recording GL, a VIRTUAL clock - deterministic), the
// stock Cub rolled out to HOME's stand, the flight LIVE (engine off, the game day's light breeze, clouds drifting). Every
// frame logs the inputs the craft's cascade is drawn and looked up with: the sun the near light was given, the cascade's
// aim (C1.tgt), half-width, uNearM1, the radius, the drawn aeroplane's pose and every craft mesh's matrix (the largest
// move since the frame before, in mm at the mesh's bounding sphere), and whether the near map was drawn that frame.
// Runs: live (the shipped page), then one input frozen at a time.
//   node tools/_craftshadow_probe.js [--frames 120] [--hour golden|noon] [--json out.json]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const FRAMES = +opt('frames', 120), HOUR = opt('hour', 'golden');
(async () => {
  const { openPage } = require('./_page_node.js');
  const P = await openPage({ quiet: true, storage: {}, query: opt('q', 'simw=0') });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  W.document.getElementById('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout'), 900000);
  const FP = W.FLIGHT_PROBE, SN = W.SHADOW_NEAR, CK = W.DAY_CLOCK;
  if (CK.preset) CK.preset(HOUR === 'noon' ? 'noon' : HOUR);
  const sim0 = FP.sim();
  if (process.env.ENGINE !== 'on') {   // parked, engine off (the user's case): the hand on the controls (the AP would taxi), the key off
    if (FP.setManual) FP.setManual(true);
    for (let i = 0; i < (sim0.eng || []).length; i++) sim0.setEngine(i, { key: 'off' });
  }
  await P.frames(Number(process.env.SETTLE || 600));   // the light's ease, the cascades settled, the aeroplane at rest
  const L = SN.AIM.L, C1 = SN.C1, scene = C1.scene;
  const craft = []; scene.traverse(o => { if (o.isMesh && o.userData.craft && o.castShadow) craft.push(o); });
  let drawn = 0; const SM = FP.renderer ? FP.renderer().shadowMap : null;
  // a near-map draw: three's shadow pass draws a light when shadow.needsUpdate || autoUpdate; count the near light's
  // updateMatrices calls (once per draw of that light)
  const um = L.shadow.updateMatrices; L.shadow.updateMatrices = function () { drawn++; return um.apply(this, arguments); };
  const prev = new Map();
  const snapF = () => {
    const sun = [L.position.x - L.target.position.x, L.position.y - L.target.position.y, L.position.z - L.target.position.z]; const n = Math.hypot(...sun); for (let i = 0; i < 3; i++) sun[i] /= n;
    let mv = 0, who = '';
    for (const m of craft) {
      const e = m.matrixWorld.elements, p = prev.get(m), r = (m.geometry.boundingSphere ? m.geometry.boundingSphere.radius : 1);
      if (p) { let d = 0; for (let i = 0; i < 12; i++) d = Math.max(d, Math.abs(e[i] - p[i]) * (i % 4 === 3 ? 0 : r)); for (let i = 12; i < 15; i++) d = Math.max(d, Math.abs(e[i] - p[i])); if (d > mv) { mv = d; who = m.name || m.parent && m.parent.name || '?'; } p.set(e); } else prev.set(m, Float32Array.from(e));
    }
    const M = SN.C1 && W.SHADOW_NEAR ? null : null;
    return { sun, tgt: [C1.tgt.x, C1.tgt.y, C1.tgt.z], H: C1.H, M1: Array.from(require_uNearM1()), r: SN.S ? null : null, mv, who, el: CK.day().sunEl };
  };
  const require_uNearM1 = () => { let m = null; scene.traverse(o => { if (!m && o.material && o.material.uniforms && o.material.uniforms.uNearM1) m = o.material.uniforms.uNearM1.value; }); return m ? m.elements : []; };
  // the uNearM1 matrix: the shared uniform object (shadow_near's nearUniforms) - reach it through ShaderLib
  const M1 = W.THREE.ShaderLib.standard.uniforms.uNearM1.value, NP = W.THREE.ShaderLib.standard.uniforms.uNearP.value;
  const frame = () => { const sun = [L.position.x - L.target.position.x, L.position.y - L.target.position.y, L.position.z - L.target.position.z]; const n = Math.hypot(...sun); for (let i = 0; i < 3; i++) sun[i] /= n;
    let mv = 0, who = '';
    for (const m of craft) {
      const e = m.matrixWorld.elements, p = prev.get(m), r = (m.geometry.boundingSphere ? m.geometry.boundingSphere.radius : 1);
      if (p) { let d = 0; for (let i = 0; i < 15; i++) { if (i % 4 === 3) continue; d = Math.max(d, Math.abs(e[i] - p[i]) * (i >= 12 ? 1 : r)); } if (d > mv) { mv = d; who = (() => { let o = m, n = ''; while (o && !n) { n = o.name; o = o.parent; } return (n || '?') + (m.isSkinnedMesh ? ' (skinned)' : ''); })(); } }
      prev.set(m, Float32Array.from(e));
    }
    let cw = null;
    if (drawn && SN.CACHE && SN.CACHE.stat.why === 'craft' && SN.CACHE.mover) { let o = SN.CACHE.mover, n = []; while (o && n.length < 4) { n.push((o.name || o.type) + (o.isBone ? '(bone)' : '')); o = o.parent; } cw = n.join('<'); }
    return { sun, tgt: [C1.tgt.x, C1.tgt.y, C1.tgt.z], H: C1.H, M1: Array.from(M1.elements), rad: NP[2], mv, who, el: CK.day().sunEl, drawn, cw };
  };
  const runs = {};
  const run = async (name, setup, undo) => {
    if (setup) setup();
    const c0 = SN.CACHE ? JSON.parse(JSON.stringify(SN.CACHE.stat)) : null;
    await P.frames(30); prev.clear(); frame();
    const rows = [];
    for (let i = 0; i < FRAMES; i++) { drawn = 0; await P.frames(1); rows.push(frame()); }
    if (undo) undo();
    // per input: how many frames it changed
    let sunCh = 0, tgtCh = 0, m1Ch = 0, mvCh = 0, drawnN = 0, mvMax = 0, sunMax = 0; const whoC = {};
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1], b = rows[i];
      const ds = Math.acos(Math.min(1, a.sun[0] * b.sun[0] + a.sun[1] * b.sun[1] + a.sun[2] * b.sun[2])) * 180 / Math.PI;
      if (ds > 0) { sunCh++; sunMax = Math.max(sunMax, ds); }
      if (a.tgt.some((v, k) => v !== b.tgt[k])) tgtCh++;
      if (a.M1.some((v, k) => v !== b.M1[k])) m1Ch++;
      if (b.mv > 1e-5) { mvCh++; whoC[b.who] = (whoC[b.who] || 0) + 1; }
      mvMax = Math.max(mvMax, b.mv);
    }
    const cws = {}; for (const r of rows) { drawnN += r.drawn ? 1 : 0; if (r.cw) cws[r.cw] = (cws[r.cw] || 0) + 1; }
    const r = { frames: rows.length, sunEl: +rows[0].el.toFixed(2), H: rows[0].H, texelCm: +(2 * rows[0].H / (SN.S.size * L.shadow.getFrameExtents().y) * 100).toFixed(2), atlas: L.shadow.getFrameExtents().toArray(), radius: +rows[0].rad.toFixed(2),
      sunChanged: sunCh, sunStepMaxDeg: +sunMax.toFixed(5), aimChanged: tgtCh, uNearM1Changed: m1Ch, craftMeshMoved: mvCh, craftMoveMaxMm: +(mvMax * 1000).toFixed(3), movers: whoC, nearMapDrawn: drawnN };
    if (c0) { const c1 = SN.CACHE.stat, w = {}; for (const k in c1.whys) if (c1.whys[k] - (c0.whys[k] || 0)) w[k] = c1.whys[k] - (c0.whys[k] || 0); r.cacheWhy = w; r.poseEpsMm = +(SN.CACHE.eps * 1000).toFixed(2); }
    r.craftMovers = cws;
    r.groundSpeed = +Math.hypot(...(FP.sim().cgVel ? FP.sim().cgVel() : [0, 0, 0])).toFixed(3);
    runs[name] = r;
    console.log(name.padEnd(14), JSON.stringify(r));
    return rows;
  };
  const sim = FP.sim();
  console.log('engines', JSON.stringify((sim.eng || []).map(e => ({ key: e.key, running: e.running }))), 'manual', FP.manual && FP.manual(), 'phase', FP.ap() && FP.ap().phase);
  console.log('stand cg', sim.cgPos().map(v => v.toFixed(2)).join(' '), 'V', (sim.out && sim.out.V || 0).toFixed(3), 'size', SN.S.size, 'craftR', SN.S.craftR.toFixed(2));
  if (process.env.TAXI === '1') {   // THE TAXI: the pilot rolls (engine on, Go pressed), counted moving
    W.document.getElementById('bGo').click();
    await P.until(() => { const v = FP.sim().cgVel(); return Math.hypot(v[0], v[2]) > 2; }, 120000);
    await run('taxi');
    if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ runs }, null, 0));
    process.exit(0);
  }
  const live = await run('live');
  await run('clockFrozen', () => CK.rate(0), () => CK.rate(1));
  const CL = W.CLOUDS, s0 = CL && CL.S ? CL.S.shadow : null;
  await run('cloudShadowOff', () => { if (CL && CL.S) CL.S.shadow = 0; }, () => { if (CL && CL.S) CL.S.shadow = s0; });
  await run('clock+clouds', () => { CK.rate(0); if (CL && CL.S) CL.S.shadow = 0; }, () => { CK.rate(1); if (CL && CL.S) CL.S.shadow = s0; });
  const bP = W.document.getElementById('bPause');
  await run('paused', () => bP.click(), () => bP.click());
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify({ runs, live }, null, 0));
  process.exit(0);
})().catch(e => { console.error('probe:', e.stack); process.exit(1); });
