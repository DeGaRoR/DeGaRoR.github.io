#!/usr/bin/env node
// _shadowsky_check.js — GATE SHADOWSKY (A2-SHADOW-SKY G650-G657, playtest 2026-09-26): shadows, clouds, water, pause.
//
// The code under test runs from the SHIPPED sources on the real vendor three.js under node where it can; the rest are
// source anchors (each names what it holds).
//
//   1. THE PCF LOOKUP UNDER THE REVERSED BUFFER (G650, shadow_near.js patchPCF): three r186's PCF getShadow added the bias
//      with no reversed case - every receiver behind its own depth, the stripes. After install() the PCF function
//      SUBTRACTS the bias under USE_REVERSED_DEPTH_BUFFER and adds it otherwise, and the per-pixel noise disc is gone
//      (four fixed hardware-compared bilinear taps at +-0.5 texel: no crawl without TAA, no heavier to compile). The VSM / BASIC functions are untouched.
//   2. THE CRAFT'S SHADOW AT ANY HEIGHT (G651, shadow_near.js follow): the near map's depth reaches the ground shadow
//      (far plane >= 2 x half + height / sun elevation), the bias is held in metres, the craft never joins the far map
//      while the near map is live (the trailing ghost), and joins it when the near map is off.
//   3. THE MIRROR'S CLIP UNDER THE REVERSED BUFFER (G654, water.js obliqueClip): a point on the water projects to depth
//      1 (the reversed near plane), a point above it inside (0, 1), a point under it past 1 (clipped); the OpenGL form
//      (RZ false) the same at -1 / (-1, 1) / < -1.
//   4. ANCHORS: the clouds' march takes this frame's camera (aa_resolve.js updateWorldMatrix before the pre hook) and
//      ignores a scene depth nearer than the first deck (clouds.js tIn); the canopy cover pass is off on an island
//      (render_world.js coverWanted); the pause holds the world's clocks (app.js FLYDIY_HELD from the Pause button;
//      render_world.js fdt 0 and the trams' tick 0 while held); the mirror's guard band (water.js L.margin); the shadows row's
//      'near' is the craft's map alone (G655: gfx_settings world false -> render_world SUNW, the sun's camera on an empty layer).
//   5. THREE'S OWN SHADOW WALK (G1125-G1126, NEAR-LAYER): vendor three r186's WebGLShadowMap on the fake WebGL2
//      (tools/_fake_gl.js): the 60 m box draws nearTag's casters and the craft alone (it drew the crumbs and the instanced
//      trees too - the walk tests the main camera's layers), the cascade and the far map draw what they drew, a far camera on
//      an empty layer draws nothing, and the world is whole after every pass, a throwing one included.
//
//   node tools/_shadowsky_check.js   -> "GATE SHADOWSKY: PASS|FAIL", exit 1 on FAIL
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let fails = 0;
const ok = (c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; };
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const src = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
console.log('GATE SHADOWSKY');

// ---- 1 + 2: shadow_near.js on the vendor three ----------------------------------------------------------
const SN = new Function('THREE', src('src/viewer/shadow_near.js') + '\nreturn SHADOW_NEAR;')(THREE);
{
  const before = THREE.ShaderChunk.shadowmap_pars_fragment;
  ok(SN.install() === true && SN.pcf.bias && SN.pcf.grid, '1 install() patches the PCF lookup', JSON.stringify(SN.pcf));
  const f = THREE.ShaderChunk.shadowmap_pars_fragment;
  const pcf0 = f.indexOf('float getShadow( sampler2DShadow'), vsm0 = f.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )', pcf0);
  const pcfFn = pcf0 >= 0 && vsm0 > pcf0 ? f.slice(pcf0, vsm0) : '';
  ok(/#ifdef USE_REVERSED_DEPTH_BUFFER\s*shadowCoord\.z -= shadowBias;\s*#else\s*shadowCoord\.z \+= shadowBias;\s*#endif/.test(pcfFn), '1 PCF: the bias is subtracted under the reversed buffer, added otherwise');
  ok(pcfFn && !/interleavedGradientNoise|vogelDiskSample/.test(pcfFn) && (pcfFn.match(/texture\( shadowMap, vec3\(/g) || []).length === 4, '1 PCF: four fixed bilinear-compare taps (a 3x3 tent), no per-pixel noise disc - fewer than the five of three: no heavier to compile');
  ok(!/for \(/.test(pcfFn), '1 PCF: the taps are written out (no loop of fetches for fxc to inline)');
  ok(f.slice(vsm0) === before.slice(before.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )', before.indexOf('float getShadow( sampler2DShadow'))), '1 the VSM and BASIC lookups are untouched');
}
{
  const scene = new THREE.Scene(), L = SN.make(scene);
  const craft = new THREE.Group(), m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  m.castShadow = true; craft.add(m); scene.add(craft); SN.tagCraft(craft, craft);
  const sun = new THREE.Vector3(0.6, 0.5, 0.2).normalize(), c = L.shadow.camera;
  const cases = [[5, 'the stand'], [60, 'the circuit'], [400, 'the cruise'], [1500, 'high']];
  for (const [agl, what] of cases) {
    craft.position.set(0, agl + 10, 0); craft.updateMatrixWorld(true);   // the craft stands at its CG (the cascade's fit reads its pose)
    SN.follow(L, [0, agl + 10, 0], sun, agl, null, null);
    const reach = 2 * SN.S.half + Math.min(SN.S.slantMax, agl / sun.y);
    ok(c.far >= reach * 0.95, `2 ${what} (${agl} m AGL): the near depth reaches the ground shadow`, `far ${c.far.toFixed(0)} m >= ${reach.toFixed(0)}`);
    ok(Math.abs(L.shadow.bias * (c.far - c.near) + SN.S.biasM) < 1e-6, `2 ${what}: the bias is ${SN.S.biasM} m of depth`);
    ok(!m.layers.isEnabled(SN.FAR_LAYER) && m.layers.isEnabled(SN.CRAFT_LAYER) && !m.layers.isEnabled(SN.NEAR_LAYER), `2 ${what}: the craft is in the near map's craft cascade (CRAFT_LAYER), not the far map (FAR_LAYER), not a near caster (NEAR_LAYER; the box keeps it whole - G1125 boxCraft)`);
    // G1005 THE CRAFT'S CASCADE: fitted to the craft at the stand, grown with the slant, never past the 60 m box; its depth reaches the ground shadow too
    const C1 = SN.C1, cam1 = C1.cam, K = L.shadow.getFrameExtents().y, Sc = SN.S.size * K, tx = 2 * C1.H / Sc;   // G1410: the craft's viewport is K x the box's side
    ok(C1.H <= SN.S.half + 1e-9 && cam1.right === C1.H && cam1.far >= reach * 0.95, `2 ${what}: the craft's cascade half ${C1.H.toFixed(2)} m (<= ${SN.S.half}), its depth ${cam1.far.toFixed(0)} m reaches the ground shadow`);
    ok(Math.abs(SN.S.slant * SN.S.penumbra / tx) <= SN.S.penFitTx + 1e-6 || C1.H === SN.S.half, `2 ${what}: G1410 the sun's penumbra within penFitTx ${SN.S.penFitTx} of the craft's texels (${(SN.S.slant * SN.S.penumbra / tx).toFixed(2)} texels; the kernel crisper, capped at ${SN.S.radiusCraft})`);
    { const want = 1.1 * Math.min(SN.S.half, Math.max(SN.S.fitMin, SN.S.craftR + SN.S.fitMargin, SN.S.slant * SN.S.penumbra * Sc / (2 * SN.S.penFitTx)));
      if (agl <= 60) ok(SN.S.craftR > 0.8 && SN.S.craftR < 0.9 && Math.abs(C1.H - Math.min(SN.S.half, want)) < 1e-6, `2 ${what}: fitted to the craft's sphere and the penumbra (r ${SN.S.craftR.toFixed(3)} m -> half ${C1.H.toFixed(2)} m, ${(100 * tx).toFixed(2)} cm a texel)`); }
    if (agl >= 1500) ok(C1.H === SN.S.half, `2 ${what}: the cascade is the 60 m box again`);
    ok(L.shadow.radius >= 1 && L.shadow.radius <= SN.S.radiusMax, `2 ${what}: the kernel radius ${L.shadow.radius.toFixed(2)} in [1, ${SN.S.radiusMax}]`);
  }
  // the atlas: two viewports side by side, viewport 0 the near casters (three's camera), viewport 1 the craft + the near casters
  const sh = L.shadow;
  const AK = sh.getFrameExtents().y;
  ok(sh.getViewportCount() === 2 && AK === (SN.S.size * SN.S.craftK <= SN.S.craftMax ? SN.S.craftK : 1) && sh.getFrameExtents().x === AK + 1 && sh.getViewport(0).z === AK && sh.getViewport(1).x === AK && sh.getViewport(1).z === 1,
    `2 G1005/G1410: the near map is a ${AK + 1} x ${AK} atlas of two viewports - the craft's ${AK} x ${AK} (${SN.S.size * AK} texels), the box's 1 x 1`);
  craft.position.set(0, 15, 0); craft.updateMatrixWorld(true); SN.follow(L, [0, 15, 0], sun, 5, null, null);   // back at the stand (the loop ended 1500 m up)
  sh.updateMatrices(L);
  { const other = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial()); other.castShadow = true; other.position.set(500, 0, 0); scene.add(other);
    SN.setNear([]); const c0 = sh.getCamera(0), hid = !other.visible && craft.visible && L.visible; const c1 = sh.getCamera(1), back = other.visible;
    ok(c0.layers.isEnabled(SN.CRAFT_LAYER) && c0.layers.isEnabled(SN.NEAR_LAYER) && c1.layers.isEnabled(SN.NEAR_LAYER) && !c1.layers.isEnabled(SN.CRAFT_LAYER), '2 G1005: viewport 0 draws the craft (and the near casters in its box), viewport 1 the near casters');
    ok(hid && back, '2 G1005: the craft cascade walks the craft alone - the rest of the scene hidden for viewport 0, back for viewport 1', `hidden ${hid} restored ${back}`);
    const cg = SN.C1.tgt; SN.setNear([[cg.x, cg.y, cg.z, 2]]); sh.getCamera(0); const kept = other.visible; sh.getCamera(1);
    ok(kept, '2 G1005: a near caster in the craft box given without its object - the cascade walks everything');
    { const town = new THREE.Group(), hangar = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshStandardMaterial()), shed = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
      hangar.castShadow = shed.castShadow = true; town.add(hangar, shed); scene.add(town);
      SN.setNear([[cg.x, cg.y, cg.z, 2, hangar]]); sh.getCamera(0); const path = hangar.visible && town.visible && !shed.visible && !other.visible && craft.visible; sh.getCamera(1);
      ok(path && shed.visible && other.visible, '2 G1005: a caster in the window keeps its chain alone - its siblings and the rest of the scene hidden for the cascade, all back after', `path ${path}`);
      scene.remove(town); }
    { const far = SN.C1.tgt.clone().addScaledVector(sun, -150);   // 150 m down-sun of the craft, past its ground shadow: out of the window
      SN.setNear([[far.x, far.y, far.z, 2]]); sh.getCamera(0); const hidFar = !other.visible; sh.getCamera(1);
      ok(hidFar, '2 G1005: a near caster past the craft ground shadow (150 m down-sun) does not stop the pruning - the window, not the frustum'); }
    { const U = THREE.ShaderLib.standard.uniforms, Q = U.uNearQ.value, M = U.uNearM1.value, z = v => new THREE.Vector3().copy(v).applyMatrix4(M).z;
      const cgz = z(SN.C1.tgt), deep = z(SN.C1.tgt.clone().addScaledVector(sun, -200));
      ok(Q[0] < Q[1] && cgz > Q[0] && cgz < Q[1] && !(deep > Q[0] && deep < Q[1]), '2 G1005: the window holds the craft and stops past its ground shadow', `window ${Q[0].toFixed(3)}..${Q[1].toFixed(3)}, CG ${cgz.toFixed(3)}, 200 m down-sun ${deep.toFixed(3)}`); }
    SN.setNear(null); sh.getCamera(0); SN.follow(L, [0, 10, 0], sun, 5, null, null);
    ok(other.visible, '2 G1005: follow() restores a walk that never reached viewport 1'); scene.remove(other); }
  { const p = new THREE.Vector3(0, 10, 0), a = p.clone().applyMatrix4(sh.matrix), b = p.clone().applyMatrix4(SN.C1.cam && sh.getCamera(1) ? new THREE.Matrix4().copy(THREE.ShaderLib.standard.uniforms.uNearM1.value) : sh.matrix);
    const xs = AK / (AK + 1);
    ok(a.x > xs && a.x < 1 && a.y < 1 / AK && b.x > 0 && b.x < xs, '2 G1005: the CG maps into the box\'s viewport through the 60 m matrix and into the craft\'s (left) through uNearM1', `${a.x.toFixed(3)} / ${b.x.toFixed(3)}`); }
  { const R = THREE.ShaderChunk.lights_fragment_begin, F = THREE.ShaderChunk.shadowmap_pars_fragment;
    ok(/uNearM1 \* vec4\( cameraPosition \+/.test(R) && /in1 \? nc1 : vDirectionalShadowCoord\[ 1 \]/.test(R) && (R.match(/getShadow\( directionalShadowMap\[ 1 \]/g) || []).length === 1, '2 G1005: one near lookup - the craft cascade inside its box, the 60 m viewport elsewhere');
    ok(/vec2 pcfR = radius \* vec2\( 1\.0, texelSize\.y \/ texelSize\.x \);/.test(F), '2 G1005: the PCF taps are square in texels on the 2 x 1 atlas'); }
  SN.S.on = false; SN.follow(L, [0, 10, 0], sun, 5, null, null);
  ok(m.layers.isEnabled(SN.FAR_LAYER) && !L.castShadow, '2 near map off: the craft casts into the far map');
  SN.S.on = true; SN.follow(L, [0, 10, 0], sun, 5, null, null);
  ok(!m.layers.isEnabled(SN.FAR_LAYER), '2 near map on again: the craft leaves the far map');
  // G874 (the train-13 settings freeze): the dial applies AT ONCE, not at the next follow(): the settings screen
  // compiles before that frame, and a light left visible keyed every lit program with the old light set
  SN.S.on = false; const r0 = SN.apply();
  ok(typeof SN.apply === 'function' && r0 === 0 && !L.visible && !L.castShadow && m.layers.isEnabled(SN.FAR_LAYER),
    '2 G874: apply() - the near light hidden and not casting, the craft on the far map, before any follow()');
  SN.S.on = true; SN.apply();
  ok(L.visible && L.castShadow && !m.layers.isEnabled(SN.FAR_LAYER), '2 G874: ...and back on at once');
  { const G = src('src/viewer/gfx_settings.js'), i = G.indexOf('W.SHADOW_NEAR.S.on = !!sh.on'), j = G.indexOf('W.SHADOW_NEAR.apply()');
    ok(i > 0 && j > i && j - i < 600, '2 G874: gfx_settings applies the near light where the shadows row sets its dial'); }
  // G1080 (SHADOW-EYES; the user: after a pause "the aircraft will roll shadowless for a few meters, then the blurry
  // shadow will come first, then the clear crisp shadow"): the maps were aimed at the point worldUpdate was given - the
  // CAMERA under the free camera / the editor - and the cascade grew (blurry) to reach an aeroplane away from it, up to
  // the 30 m cap (shadowless past it). Now they are aimed at the drawn aeroplane, and aim() re-reads this frame's pose.
  { const hAt = () => 10, eye = [80, 30, 40], C1 = SN.C1, lat = p => { const d = new THREE.Vector3().subVectors(p, C1.tgt), a = d.dot(sun); return Math.sqrt(Math.max(0, d.lengthSq() - a * a)); };
    craft.position.set(0, 15, 0); craft.updateMatrixWorld(true);
    SN.S.aimDrawn = false; C1.H = 0; SN.follow(L, eye, sun, 20, null, null, hAt);
    const oldH = C1.H, oldMiss = lat(craft.position) > C1.H;
    ok(oldH === SN.S.half && oldMiss, '2 G1080 (as it was): aimed at the eye 90 m off, the cascade grew to its 30 m cap and still missed the aeroplane', `half ${oldH.toFixed(1)} m, the craft ${lat(craft.position).toFixed(1)} m across the light`);
    SN.S.aimDrawn = true; C1.H = 0; SN.follow(L, eye, sun, 20, null, null, hAt);
    ok(C1.tgt.distanceTo(craft.position) < 1e-6 && C1.H < 0.3 * SN.S.half && SN.AIM.drawn === 1, '2 G1080: aimed at the drawn aeroplane whatever the eye - the cascade fitted to the craft', `half ${C1.H.toFixed(2)} m`);
    ok(Math.abs(L.target.position.x) < 1e-6 && Math.abs(L.target.position.z) < 1e-6, '2 G1080: the 60 m box round the aeroplane too');
    const H0 = C1.H; craft.position.set(500, 15, 0);   // a teleport (Restart, the line-up skip): the pose written, its matrixWorld not yet
    ok(SN.aim() === true && C1.tgt.distanceTo(craft.position) < 1e-6 && C1.H === H0, '2 G1080: aim() after the pose - the cascade on this frame\'s aeroplane at once, not grown by the jump', `half ${C1.H.toFixed(2)} m`);
    const ap = SN.aimPoint([0, 0, 0]);
    ok(Math.abs(ap[0] - 500) < 1e-6, '2 G1080: the near casters are tagged round the drawn aeroplane (aimPoint)');
    scene.remove(craft); SN.follow(L, eye, sun, 20, null, null, hAt);
    ok(C1.tgt.distanceTo(new THREE.Vector3(80, 30, 40)) < 1e-6 && SN.AIM.drawn === 0 && SN.aim() === false, '2 G1080: an aeroplane off the stage (the scenery mode) leaves the aim with the given point');
    scene.add(craft); craft.position.set(0, 15, 0); craft.updateMatrixWorld(true); SN.follow(L, [0, 15, 0], sun, 5, null, null); }
  // G1410 CRAFT-SHADOW (the user, 3 Oct: a parked Cub, only the clouds moving, the shadow's outline redrawn in a new place
  // every frame). (a) the near map's sun is HELD under S.sunEps; (b) the texel grids are counted from the aeroplane, so a
  // turn of the sun no longer slides the craft's grid (render_world's grid, from the world's origin, slid by centimetres);
  // (c) the map is CACHED: aim() asks for a draw only when something it is drawn from changed.
  { const hAt = () => 10, C1 = SN.C1, at = [-850, 15, 1200];
    const up = new THREE.Vector3(), R = new THREE.Vector3(), U = new THREE.Vector3();
    const worldSnap = (T, half, size) => { const tx = 2 * half / size; up.set(0, 1, 0); R.crossVectors(up, SUNW).normalize(); U.crossVectors(SUNW, R); const a = T.dot(R), b = T.dot(U);
      return T.addScaledVector(R, Math.round(a / tx) * tx - a).addScaledVector(U, Math.round(b / tx) * tx - b); };   // render_world snapToTexels (it reads render_world's live SUN)
    const SUNW = sun.clone();
    craft.position.set(at[0], at[1], at[2]); craft.updateMatrixWorld(true);
    const turn = deg => sun.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), deg * Math.PI / 180);
    const go = s => { SUNW.copy(s); SN.follow(L, at, s, 5, worldSnap, null, hAt); SN.aim(); return { d: L.position.clone().sub(L.target.position).normalize(), t: C1.tgt.clone() }; };
    const s0 = go(sun), s1 = go(turn(0.004)), s2 = go(turn(0.03));
    ok(s1.d.equals(s0.d) && s2.d.angleTo(s0.d) > 0.02 * Math.PI / 180, '2 G1410: the near map\'s sun held under 0.01 deg (render_world re-reads it as the clouds\' light moves), taken past it', `${(s2.d.angleTo(s0.d) * 180 / Math.PI).toFixed(3)} deg`);
    // the craft's cascade aim on the cascade's own light-space grid: anchored, a turn of the sun moves it by (almost) nothing at the aeroplane
    const tx = 2 * C1.H / (SN.S.size * L.shadow.getFrameExtents().y), lat = (p, q, s) => { const d = p.clone().sub(q); const a = d.dot(s); return Math.sqrt(Math.max(0, d.lengthSq() - a * a)); };
    const sA = go(turn(0.06)), sB = go(turn(0.09));
    SN.S.anchor = false; const wA = go(turn(0.12)), wB = go(turn(0.15)); SN.S.anchor = true;
    const anch = lat(sA.t, sB.t, sB.d) / tx, world = lat(wA.t, wB.t, wB.d) / tx;
    ok(anch < 0.75 && world > anch, '2 G1410: a 0.03 deg turn of the sun - the craft\'s cascade counted from the aeroplane stays on its texel (render_world\'s grid, from the origin 1.5 km away, re-rolls the staircase)', `anchored ${anch.toFixed(2)} texel, world grid ${world.toFixed(2)}`);
    // the cache (only with the renderer's pass hooked)
    const hk = SN.HOOK.on; SN.HOOK.on = true; const map0 = L.shadow.map; if (!map0) L.shadow.map = { dispose() {} };   // (no renderer here: a map stands in)
    go(turn(0.3)); const d0 = L.shadow.needsUpdate; go(turn(0.3)); const d1 = L.shadow.needsUpdate;
    craft.position.x += 0.0001; craft.updateMatrixWorld(true); go(turn(0.3)); const d2 = L.shadow.needsUpdate;
    craft.position.x += 0.005; craft.updateMatrixWorld(true); go(turn(0.3)); const d3 = L.shadow.needsUpdate;
    go(turn(0.3)); const d4 = L.shadow.needsUpdate; go(turn(0.35)); const d5 = L.shadow.needsUpdate;
    m.visible = false; go(turn(0.35)); const d6 = L.shadow.needsUpdate; m.visible = true; go(turn(0.35));
    ok(d0 && !d1 && !d2 && d3 && !d4 && d5 && d6, '2 G1410: the near map drawn when it must - a new sun (0.3 deg), the aeroplane moved 5 mm, a part shown / hidden - and held when nothing moved (or 0.1 mm)', JSON.stringify([d0, d1, d2, d3, d4, d5, d6]) + ' ' + SN.CACHE.stat.why);
    SN.S.cache = false; go(turn(0.35)); const off = L.shadow.needsUpdate; SN.S.cache = true;
    SN.HOOK.on = false; go(turn(0.35)); const unhooked = L.shadow.needsUpdate; SN.HOOK.on = hk; L.shadow.map = map0;
    ok(off && unhooked, '2 G1410: S.cache off, or the pass not hooked - drawn every frame as before');
    craft.position.set(0, 15, 0); craft.updateMatrixWorld(true); SN.follow(L, [0, 15, 0], sun, 5, null, null); }
  // G1080 THE SOFT TRAILING SHADOW: three's shadow walk tests an object's layers against the MAIN camera (r186
  // WebGLShadowMap renderObject(object, camera, shadowCamera, ...)), so FAR_LAYER on the far map's camera filters nothing -
  // the aeroplane was in the world's far map (drawn every 2nd frame: a soft halo, a frame behind). The craft's top group is
  // hidden while the FAR light's map draws (its updateMatrices), shown for the near light's pass and by follow().
  { const T3 = src('vendor/three.min.js');
    ok(/function x\(T,R,v,A,I\)\{if\(T\.visible===!1\)return;if\(T\.layers\.test\(R\.layers\)/.test(T3) && /x\(R,v,Dt,X,this\.type\)/.test(T3) && /this\.render=function\(T,R,v\)/.test(T3),
      '2 G1080: three r186 - the shadow walk tests the MAIN camera\'s layers (the far map\'s camera layers filter nothing): the reason for farLight');
    const sunL = new THREE.DirectionalLight(0xffffff, 1); sunL.castShadow = true; scene.add(sunL);
    SN.farLight(sunL); SN.S.on = true; SN.apply(L);
    sunL.shadow.updateMatrices(sunL); const hidFar = !craft.visible;
    L.shadow.updateMatrices(L); const backNear = craft.visible;
    ok(hidFar && backNear, '2 G1080: the aeroplane hidden while the far map draws, shown again for the near map', `far pass hidden ${hidFar}, near pass visible ${backNear}`);
    sunL.shadow.updateMatrices(sunL); SN.follow(L, [0, 15, 0], sun, 5, null, null);
    ok(craft.visible, '2 G1080: follow() shows it again (a far pass the near one never followed)');
    SN.S.on = false; SN.apply(L); sunL.shadow.updateMatrices(sunL);
    ok(craft.visible, '2 G1080: with the near map off the aeroplane stays in the far map (its only shadow)');
    SN.S.on = true; SN.apply(L); SN.S.farHide = false; sunL.shadow.updateMatrices(sunL);
    ok(craft.visible, '2 G1080: farHide off (the A/B) - the aeroplane in the far map, as before');
    SN.S.farHide = true; scene.remove(sunL);
    ok(/SHADOW_NEAR\.farLight\(sun\)/.test(src('src/viewer/render_world.js')), '2 G1080: render_world hands the far light to farLight'); }
  ok(/if \(!inGarage && window\.SHADOW_NEAR && SHADOW_NEAR\.aim\) SHADOW_NEAR\.aim\(\);/.test(src('src/viewer/app.js')) && /SHADOW_NEAR\.follow\(sunNear, cg, SUN, agl, snapToTexels, camera, groundAt\)/.test(src('src/viewer/render_world.js')),
    '2 G1080: app.js re-aims right after poseModel; render_world hands follow() the ground under the aeroplane');
}

// ---- 3: water.js obliqueClip ---------------------------------------------------------------------------
{
  const W = require(path.join(ROOT, 'src', 'viewer', 'water.js'));
  ok(typeof W.obliqueClip === 'function', '3 water.js exports obliqueClip');
  if (typeof W.obliqueClip === 'function') for (const RZ of [true, false]) {
    const mc = new THREE.PerspectiveCamera(55, 2.1, 0.5, 4000); mc._reversedDepth = RZ;
    const wy = 12;
    mc.position.set(3, wy - 25, -4); mc.lookAt(20, wy - 8, 150); mc.updateProjectionMatrix(); mc.updateMatrixWorld(true);
    W.obliqueClip(THREE, mc, wy, RZ);
    const z = (x, y, zz) => { const v = new THREE.Vector4(x, y, zz, 1).applyMatrix4(mc.matrixWorldInverse).applyMatrix4(mc.projectionMatrix); return v.z / v.w; };
    const nearZ = RZ ? 1 : -1, farZ = RZ ? 0 : 1, inside = v => v > Math.min(nearZ, farZ) && v < Math.max(nearZ, farZ);
    const on = [z(10, wy, 60), z(-30, wy, 300)], up = [z(15, wy + 4, 90), z(40, wy + 60, 1200)], dn = z(8, wy - 6, 70);
    const tag = RZ ? 'reversed' : 'OpenGL';
    ok(on.every(v => Math.abs(v - nearZ) < 1e-4), `3 ${tag}: a point on the water is at the near plane (${nearZ})`, on.map(v => v.toFixed(5)).join(', '));
    ok(up.every(inside), `3 ${tag}: a point above the water is inside the depth range`, up.map(v => v.toFixed(4)).join(', '));
    ok(RZ ? dn > 1 : dn < -1, `3 ${tag}: a point under the water is clipped`, dn.toFixed(4));
    const inv = mc.projectionMatrixInverse.clone().multiply(mc.projectionMatrix), id = new THREE.Matrix4();
    ok(inv.elements.every((v, i) => Math.abs(v - id.elements[i]) < 1e-6), `3 ${tag}: the inverse projection follows the bent matrix`);
  }
}

// ---- 4: anchors ----------------------------------------------------------------------------------------
{
  const aa = src('src/viewer/aa_resolve.js'), cl = src('src/viewer/clouds.js'), rw = src('src/viewer/render_world.js'), app = src('src/viewer/app.js'), wa = src('src/viewer/water.js');
  ok(/if \(S\.pre\) \{ if \(camera\.updateWorldMatrix\) camera\.updateWorldMatrix\(true, false\); S\.pre\(renderer, camera, S\.rt\); \}/.test(aa), '4 aa_resolve: the camera\'s world matrix is made current before the clouds\' pre hook');
  ok(/bool thru = tScene < deckEntry\(o, d\);/.test(cl) && /thru \? dzW1\(uDZ\.x > 0\.5 \? 0\.0 : 1\.0\)/.test(cl) && /march\(o, d, thru \? 1e9 : tScene, uDials2\.x\)/.test(cl), '4 clouds: a stale depth nearer than the first deck is sky - marched through, its key the far plane (the composite hides behind this frame\'s scene)');
  ok(/const coverWanted = \(\) => !\(world && world\.island\) \|\| COVER\.island === 'on';/.test(rw) && /if \(!coverWanted\(\)\) \{ COVER\.on\.value = 0;/.test(rw) && /island: 'off' \}/.test(rw), '4 render_world: the canopy cover pass is off on an island by default');
  ok(/userPaused = !running;/.test(app) && /window\.FLYDIY_HELD = !inGarage && !running && userPaused;/.test(app), '4 app: FLYDIY_HELD is the Pause button\'s');
  ok(/window\.FLYDIY_HELD\) \? 0 :/.test(rw) && /premTramLast && !\(typeof window !== 'undefined' && window\.FLYDIY_HELD\)/.test(rw), '4 render_world: the sea, the sway and the premises\' wall clock hold while paused');
  ok(/turned > turnLim/.test(wa) && /margin \};/.test(wa) && /Math\.atan\(tv \* G\)/.test(wa), '4 water: the capture has a guard band; a turn re-captures only near its edge');
  const gx = src('src/viewer/gfx_settings.js');
  ok(/near: \{ on: true, map: 2048, far: false, world: false \}/.test(gx) && /worldShadow: sh\.world !== false/.test(gx) && /sun\.shadow\.camera\.layers\.set\(SUNW\.on \? SHADOW_NEAR\.FAR_LAYER : SUNW\.EMPTY\)/.test(rw) && /SUNW\.dirty \|\| \(SUNW\.on && /.test(rw), '4 shadows near: the sun keeps casting (no relink), its camera on an empty layer, its map drawn once - the craft map alone');
  ok(/if \(RZ\) mc\._reversedDepth = true;/.test(wa), '4 water: the mirror camera is reversed before its first draw (three would recompute its projection and wipe the clip)');
}

// ---- 5: G1125 / G1126 (NEAR-LAYER) - THREE'S OWN SHADOW WALK, on the fake WebGL2 (tools/_fake_gl.js boot) -------------
// The walk tests the MAIN camera's layers (G1080.2), so the near map's viewport 1 (the 60 m box) drew whatever the walk
// reaches. Rendered here through vendor three r186's WebGLShadowMap: what each shadow camera draws, recorded per caster by
// its onBeforeShadow (renderer, object, camera, shadowCamera) - with the box pruned (G1125) and without (as before).
{
  const FG = require(path.join(ROOT, 'tools', '_fake_gl.js'));
  const { THREE: T3, renderer, ctx, load } = FG.boot();
  load('src/viewer/shadow_near.js');
  const N = require('vm').runInContext('SHADOW_NEAR', ctx);
  ok(N.hook(renderer) === true && N.HOOK.on && N.hook(renderer) === false, '5 G1125: hook(renderer) wraps three\'s shadow pass once');
  const scene = new T3.Scene();
  const sunL = new T3.DirectionalLight(0xffffff, 1); sunL.castShadow = true; sunL.shadow.mapSize.set(256, 256);
  { const c = sunL.shadow.camera; c.left = -300; c.right = 300; c.top = 300; c.bottom = -300; c.near = 1; c.far = 3000; c.updateProjectionMatrix(); }
  scene.add(sunL); scene.add(sunL.target);
  const L = N.make(scene);
  sunL.shadow.camera.layers.set(N.FAR_LAYER); N.farLight(sunL);   // (render_world's order: the far light first, then the near one)
  const mat = new T3.MeshStandardMaterial();
  const mk = (name, x, y, z, sz, parent) => { const m = new T3.Mesh(new T3.BoxGeometry(sz, sz, sz), mat); m.name = name; m.position.set(x, y, z); m.castShadow = true; m.layers.enable(N.FAR_LAYER); (parent || scene).add(m); return m; };
  const craft = new T3.Group(); scene.add(craft);
  mk('craft', 0, 2, 0, 3, craft).layers.disable(N.FAR_LAYER);
  N.tagCraft(craft, craft);
  const town = new T3.Group(); scene.add(town);
  const hangar = mk('hangar', 12, 4, 0, 8, town); hangar.layers.enable(N.NEAR_LAYER);   // nearTag's: a plain caster >= 0.75 m within 90 m
  mk('shed', 150, 2, 0, 3, town);                                                        // the town's, far from the craft
  mk('crate', 4, 0.3, 4, 0.6);                                                           // a crumb by the craft (under NEAR_MIN_R): the far map's
  const trees = new T3.InstancedMesh(new T3.BoxGeometry(1, 6, 1), mat, 3); trees.name = 'trees'; trees.castShadow = true; trees.layers.enable(N.FAR_LAYER);
  for (let i = 0; i < 3; i++) trees.setMatrixAt(i, new T3.Matrix4().makeTranslation(-8 + i * 2, 3, -6));
  trees.computeBoundingSphere(); scene.add(trees);
  const ground = new T3.Mesh(new T3.PlaneGeometry(2000, 2000), mat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.name = 'ground'; scene.add(ground);
  const cam = new T3.PerspectiveCamera(60, 1, 0.5, 5000); cam.position.set(-30, 25, 30); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(true);
  const sd = new T3.Vector3(0.5, 0.7, 0.3).normalize();
  sunL.position.copy(sd).multiplyScalar(700); scene.updateMatrixWorld(true);
  N.follow(L, [0, 2, 0], sd, 1, null, cam, () => 0);
  const hs = new T3.Sphere().copy((hangar.geometry.computeBoundingSphere(), hangar.geometry.boundingSphere)).applyMatrix4(hangar.matrixWorld);
  const near = [[hs.center.x, hs.center.y, hs.center.z, hs.radius, hangar]];
  const log = {}, passOf = sc => sc === sunL.shadow.camera ? 'far' : sc === N.C1.cam ? 'v0' : sc === L.shadow.camera ? 'v1' : '?';
  let boom = false;
  scene.traverse(o => { if (!o.isMesh) return;
    o.onBeforeShadow = function (r, ob, c, sc) { if (boom && passOf(sc) === 'v1') throw new Error('boom'); (log[passOf(sc)] = log[passOf(sc)] || []).push(ob); };
    o.onBeforeRender = function () { (log.main = log.main || []).push(this); }; });
  const frame = (bp, list) => { for (const k of Object.keys(log)) delete log[k]; N.S.boxPrune = bp; N.setNear(list); sunL.shadow.needsUpdate = true; L.shadow.needsUpdate = true; renderer.render(scene, cam);
    const r = {}; for (const k of Object.keys(log)) r[k] = log[k].map(o => o.name).sort().join(','); return r; };
  const hidden = () => { const h = []; scene.traverse(o => { if (!o.visible) h.push(o.name || o.type); }); return h.join(',') || 'none'; };
  const was = frame(false, near), was1 = (log.v1 || []).slice();
  ok(/craft/.test(was.v1) && /crate/.test(was.v1) && /trees/.test(was.v1), '5 G1125 (as it was): the 60 m box drew the craft, a crumb and the instanced trees - a NEAR_LAYER camera filters nothing in three r186', 'v1 ' + was.v1);
  const now = frame(true, near), want = was1.filter(o => o.layers.isEnabled(N.NEAR_LAYER) || o.layers.isEnabled(N.CRAFT_LAYER)).map(o => o.name).sort().join(',');
  ok(N.S.boxCraft && now.v1 === want && want === 'craft,hangar', '5 G1125: the 60 m box draws nearTag\'s casters and the craft alone - exactly what it drew before that stands on NEAR_LAYER or CRAFT_LAYER', `v1 ${now.v1} (want ${want})`);
  N.S.boxCraft = false; const noCraft = frame(true, near); N.S.boxCraft = true;
  ok(noCraft.v1 === 'hangar' && hidden() === 'none', '5 G1125: boxCraft off - the box its near casters alone (G1005\'s letter: a receiver deeper than the cascade\'s window then loses the craft\'s shadow)', 'v1 ' + noCraft.v1);
  ok(now.v0 === was.v0 && /craft/.test(now.v0) && /hangar/.test(now.v0), '5 G1125: the craft\'s cascade draws what it drew (the craft and the near caster in its window)', 'v0 ' + now.v0);
  ok(now.far === was.far && !/craft/.test(now.far) && /shed/.test(now.far) && /trees/.test(now.far), '5 G1125: the far map draws what it drew - everything but the craft (FAR_LAYER\'s scheme)', 'far ' + now.far);
  ok(now.main === was.main && hidden() === 'none', '5 G1125: the main pass drew the same, and nothing is left hidden after the pass', `main ${now.main}; hidden ${hidden()}`);
  const n0 = N.C1.boxFull, none = frame(true, null);
  ok(none.v1 === was.v1 && N.C1.boxFull === n0 + 1, '5 G1125: before nearTag has spoken (no list) the box walks whole, as before');
  boom = true; let threw = false; try { frame(true, near); } catch (e) { threw = /boom/.test(e.message); } boom = false;
  ok(threw && hidden() === 'none', '5 G1125: a pass that throws inside the box\'s walk leaves nothing hidden (the hook)', hidden());
  sunL.shadow.camera.layers.set(31);   // G1126: render_world SUNW.EMPTY - the 'near' tier (and the A/B's 6): the far map meant empty
  const empty = frame(true, near);
  ok(!empty.far && empty.v1 === 'craft,hangar' && /craft/.test(empty.v0) && hidden() === 'none' && N.FARH.empty > 0, '5 G1126: a far camera on an empty layer draws nothing (the \'near\' tier); the near map as before; all shown again', `far ${empty.far || 'nothing'}, v1 ${empty.v1}, hidden ${hidden()}`);
  N.S.farEmpty = false; const drew = frame(true, near); N.S.farEmpty = true;
  ok(drew.far === was.far, '5 G1126 (as it was, farEmpty off): the empty layer filtered nothing - the whole world into the far map', 'far ' + drew.far);
  ok(/if \(window\.SHADOW_NEAR && SHADOW_NEAR\.hook\) SHADOW_NEAR\.hook\(renderer\);/.test(src('src/viewer/app.js')), '5 G1125: app.js hooks the renderer\'s shadow pass');
}

console.log(fails ? `GATE SHADOWSKY: FAIL (${fails})` : 'GATE SHADOWSKY: PASS');
process.exit(fails ? 1 : 0);
