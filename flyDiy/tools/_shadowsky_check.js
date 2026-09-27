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
  m.castShadow = true; craft.add(m); scene.add(craft); SN.tagCraft(craft);
  const sun = new THREE.Vector3(0.6, 0.5, 0.2).normalize(), c = L.shadow.camera;
  const cases = [[5, 'the stand'], [60, 'the circuit'], [400, 'the cruise'], [1500, 'high']];
  for (const [agl, what] of cases) {
    SN.follow(L, [0, agl + 10, 0], sun, agl, null, null);
    const reach = 2 * SN.S.half + Math.min(SN.S.slantMax, agl / sun.y);
    ok(c.far >= reach * 0.95, `2 ${what} (${agl} m AGL): the near depth reaches the ground shadow`, `far ${c.far.toFixed(0)} m >= ${reach.toFixed(0)}`);
    ok(Math.abs(L.shadow.bias * (c.far - c.near) + SN.S.biasM) < 1e-6, `2 ${what}: the bias is ${SN.S.biasM} m of depth`);
    ok(!m.layers.isEnabled(SN.FAR_LAYER) && m.layers.isEnabled(SN.NEAR_LAYER), `2 ${what}: the craft is in the near map, not the far map`);
    ok(L.shadow.radius >= 1 && L.shadow.radius <= SN.S.radiusMax, `2 ${what}: the kernel radius ${L.shadow.radius.toFixed(2)} in [1, ${SN.S.radiusMax}]`);
  }
  SN.S.on = false; SN.follow(L, [0, 10, 0], sun, 5, null, null);
  ok(m.layers.isEnabled(SN.FAR_LAYER) && !L.castShadow, '2 near map off: the craft casts into the far map');
  SN.S.on = true; SN.follow(L, [0, 10, 0], sun, 5, null, null);
  ok(!m.layers.isEnabled(SN.FAR_LAYER), '2 near map on again: the craft leaves the far map');
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

console.log(fails ? `GATE SHADOWSKY: FAIL (${fails})` : 'GATE SHADOWSKY: PASS');
process.exit(fails ? 1 : 0);
