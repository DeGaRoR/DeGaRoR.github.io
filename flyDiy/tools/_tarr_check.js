#!/usr/bin/env node
// _tarr_check.js — GATE TARR: the town on texture arrays (G574, src/viewer/house_tarr.js), headless under the real
// vendor three.js and the real house generator (no library payload: the flat colours, every layer -1).
//
//   1  THE EDITS: the house generator's own hooks (shadeHouse + cloudWeather; shadeGlass) run on r186's standard
//      program, then editPlain / editGlass: nothing missed; every finish uniform the hook declares is a global the
//      slot fills (none left a uniform, each assigned in tLoad); the map / roughness / metalness / normal-map chunks
//      and the material colour are the arrays' and the slot's; the ridge sag is a constant 0; envMapIntensity
//      untouched (r186 gives it the scene's); tLoad after every global it fills; both arrays sampled once each and outside any branch (ANGLE/D3D: implicit texture() only);
//      a program without the chunk reports the miss (negative)
//   2  CLASSIFY: a real house's shaded bags are plain / glass by the hook's identity; a bag whose hook was wrapped
//      again (a steel mix), a transparent one, a clone (its hook dropped by the JSON) and the smoke are not
//   3  THE MERGE: positions are the source's matrixWorld applied to its position with the ridge sag (hSag) taken
//      off first, to 1e-4 m; normals unit; aSlot constant over each source and the slot's row carries its finish
//      (colour, roughness, metalness, paint, dirt, the house's dirt line and punch); the index points inside; the
//      same finish on two houses is one slot, a different dirt line two
//   4  THE HOST: render_premises declares TARR above LAMPS (G570's TDZ), the lamps drive the lit factor, the
//      bake's sig carries the dials, G566's material signature leaves G574's handles out; build.js ships the
//      module before render_premises.js
//   5  LOD 1 PAST 150 M (G800-G802): render_premises' HLOD block lifted and run - a house's lod 1 as the far town's source
//      (opaque bags, position + normal, walls and roof its box, a fraction of lod 0); the dithered band's GLSL
//      TRANSPILED to JS and swept 0-1400 m (the lod-0 rung leaving and the lod-1 rung arriving draw exactly one of them
//      per pixel; whole outside the band; the vertex cull never drops a fragment the band would draw); the programs (the
//      far town's, the TARR material with and without the band, a G566 clone = the house's own program + the band, a
//      basic material untouched, the boxes' and the items' G559 plain one); the URL flags; the host's wiring.
//      G1395 (HOUSE-LOD): lod 1 keeps the town shader's channels (every bag rides house_tarr: the far town on the town's
//      own shader), its shells marked; the band swept again BY PROJECTED SIZE (each radius its own edge, the far town's
//      detail leaving at its b band, the shells never), the vertex cull transpiled and swept, the far variant's program
//
// Usage: node tools/_tarr_check.js          (prints GATE TARR: PASS|FAIL)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS = __dirname, ROOT = path.join(TOOLS, '..');
const fail = []; let checks = 0;
const check = (ok, label, extra) => { checks++; if (!ok) fail.push(label + (extra ? ' — ' + extra : '')); return ok; };

const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const TARR = require(path.join(ROOT, 'src', 'viewer', 'house_tarr.js'));
const W = { THREE, console, Math, JSON, Object, Array, Map, Set, WeakMap, Float32Array, Uint16Array, Uint32Array, Int32Array, Uint8Array,
            Number, String, Boolean, isFinite, Infinity, NaN, Error, Promise, setTimeout, performance };
W.window = W; W.globalThis = W;
vm.createContext(W);
for (const f of ['_house_kit.js', '_house_gen.js']) vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), W, { filename: f });
const HG = W.HOUSE_GEN;
check(!!HG && !!HG.shadeHouse && !!HG.cloudWeather, 'the house generator loads headless');

// ---- 1 the edits ---------------------------------------------------------------------------------------------
const SH = () => ({ uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader });
const rawHook = TARR.rawHook;
{
  const dp = new THREE.MeshStandardMaterial(); HG.shadeHouse(dp, HG.makeShadeU()); HG.cloudWeather(dp, 0.4, 0);
  const sh = SH(); rawHook(dp)(sh);
  const declared = [...sh.fragmentShader.matchAll(/uniform\s+(?:float|vec3)\s+([\w\s,]+);/g)].flatMap(m => m[1].split(',').map(s => s.trim()));
  const house = declared.filter(n => /^u[A-Z]/.test(n));
  check(house.includes('uDirtTop') && house.includes('uCloudK') && house.includes('uPaintMode'), '1a the hook declares the finish uniforms', house.join(' '));
  const miss = []; TARR.editPlain(sh, miss, THREE.ShaderChunk);
  check(!miss.length, '1b the plain edits all land', miss.join(' | '));
  const f = sh.fragmentShader, v = sh.vertexShader;
  const left = house.filter(n => new RegExp('uniform\\s+(?:float|vec3)[^;]*\\b' + n + '\\b').test(f));
  check(!left.length, '1c no finish uniform is left a uniform', left.join(' '));
  const load = f.slice(f.indexOf('void tLoad()'), f.indexOf('}', f.indexOf('void tLoad()')));
  const unset = house.filter(n => !new RegExp('\\b' + n + '\\s*=').test(load));
  check(!unset.length, '1d every finish uniform is filled by tLoad', unset.join(' '));
  check(!/#include <(map|roughnessmap|metalnessmap|normal_fragment_maps)_?fragment>|#include <normal_fragment_maps>/.test(f), '1e the map chunks are the arrays\'');
  check(f.includes('vec4 diffuseColor = vec4( tCol, opacity );') && !f.includes('vec4( diffuse, opacity )'), '1f the colour is the slot\'s');
  check(v.includes('const float uSag = 0.0') && !/uniform float uSag/.test(v) && v.includes('vSlot = aSlot'), '1g the sag is baked (0 in the shader), the slot travels');
  check(!/envMapIntensity\s*=/.test(f), '1h envMapIntensity untouched (r186 feeds it the scene\'s environmentIntensity: a house material has no envMap)');
  // G581: the dirt line is lifted by where the house stands (uDirtY0), which the slot folds into its dirt line
  check(/uDirtTop \+ uDirtY0 - vHouseY/.test(f) && /uDirtY0 = 0\.0;/.test(load), '1t the dirt line is in the house\'s frame (uDirtY0), folded into the slot');
  check(/uWander = l\.w;/.test(load) && /tUvT\.y \+= uWander \* \(hNoise\(/.test(load), '1u the courses\' wander rides the slot\'s spare .w onto the array uv');
  const main = f.slice(f.indexOf('void main() {'));
  const tex = [...main.matchAll(/texture\(\s*(tAlb|tNR)\b/g)].map(m => m[1]);
  check(tex.length === 2 && tex[0] === 'tAlb' && tex[1] === 'tNR', '1i each array sampled once in main', tex.join(','));
  const lines = main.split('\n').filter(l => /texture\(\s*t(Alb|NR)/.test(l));
  check(lines.every(l => !/\bif\s*\(/.test(l)), '1j the array samples are outside any branch');
  check(main.indexOf('tLoad();') < main.indexOf('diffuseColor') && f.indexOf('texelFetch(tTab') > 0, '1k the slot is loaded before the colour');
  check(!/textureGrad|textureLod/.test(f), '1l no textureGrad / textureLod (fxc)');
  // GLSL declares before use: tLoad assigns the hook's globals and the envmap chunk's, so it must come after them all
  // (the first cut prepended it to the head and the program did not compile: the town drew only its shadows)
  const iL = f.indexOf('void tLoad()'), decl = n => f.search(new RegExp('^(?:float|vec3)[^;(]*\\b' + n + '\\b[^;(]*;', 'm'));
  const early = house.filter(n => !(decl(n) >= 0 && decl(n) < iL));
  check(iL > 0 && !early.length, '1r tLoad follows every global it assigns', early.join(' '));
  // the cloud block and the house block stay in the order the hooks wrote them: the map, the clouds, the house
  const iA = f.indexOf('texture(tAlb'), iC = f.indexOf('uCloudMode < 0.5'), iH = f.indexOf('uPaintMode > 0.5');
  check(iA > 0 && iC > iA && iH > iC, '1m map -> clouds -> paint/dirt, the hooks\' order');
  const neg = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: 'void main() {\n}' }; const nm = [];
  TARR.editPlain(neg, nm, THREE.ShaderChunk);
  check(nm.length >= 4, '1n (negative) a program without the chunks reports the misses', nm.length);

  const F = HG.makeFinish(); HG.applyFinish(Object.assign({}, HG.DEF), F);
  const gs = SH(); rawHook(F.MAT.glass)(gs); const gm = [];
  TARR.editGlass(gs, gm, THREE.ShaderChunk);
  check(!gm.length, '1o the glass edits all land', gm.join(' | '));
  check(!/uniform float uGlassWave|uniform float uLitK/.test(gs.fragmentShader) && /uLitK = c\.x \* tLit/.test(gs.fragmentShader), '1p the glass dials are the slot\'s, the lit pane x the lamps\' factor');
  { const g = gs.fragmentShader, iL = g.indexOf('void tLoad()'), bad = ['uGlassWave', 'uGlassRough', 'uGlassFres', 'uLitK'].filter(n => { const d = g.search(new RegExp('^float[^;(]*\\b' + n + '\\b[^;(]*;', 'm')); return !(d >= 0 && d < iL); });
    check(iL > 0 && !bad.length, '1s the glass tLoad follows its globals', bad.join(' ')); }
  check(/uGlassEnvK = c\.y;/.test(gs.fragmentShader) && !/uniform float uGlassEnvK/.test(gs.fragmentShader) && /gEnvK = mix\(uGlassEnvK, 1\.0, gFarK\);\s*radiance \*= gEnvK; iblIrradiance \*= gEnvK;/.test(gs.fragmentShader),
        '1v the glass\'s own envMapIntensity scales what the environment adds (G581), from its slot in the town');
  check(gs.fragmentShader.includes('gLitCol(vHouseLit)') && gs.fragmentShader.includes('gDress('), '1q the lit windows and the curtains are the generator\'s own GLSL');
  // G960 (A2-GLINT): the pane a few pixels wide is rough, without its Fresnel lift or its own environment gain - in the
  // town's program as in the house's; gFarK is set (in the roughness block) before the lights read it
  { const g = gs.fragmentShader, iK = g.indexOf('gFarK = smoothstep(0.06, 0.4, length(fwidth(vGlassP)))'), iE = g.indexOf('gEnvK = mix(uGlassEnvK, 1.0, gFarK)'), iF = g.indexOf('uGlassFres * gf * (1.0 - gFarK)');
    check(/^float gFarK = 0\.0;/m.test(g) && iK > 0 && iE > iK && iF > iK && /max\(roughnessFactor, 0\.5\), gFarK\)/.test(g), '1y the far pane fades its glint: rough, no Fresnel lift, no env gain (G960)', [iK, iE, iF].join(' ')); }
}

// G581: THE WANDER DRAWS. r186 runs onBeforeCompile before it resolves the #includes, so the hook's text holds no
// map uv to rewrite; the macros at the top of main rename them once the chunks are pasted. Resolved here as three
// does it (recursively from ShaderChunk): the varying is declared above the macros, every map read below them.
{
  const m = new THREE.MeshStandardMaterial(); m.map = new THREE.Texture(); m.normalMap = new THREE.Texture(); m.roughnessMap = new THREE.Texture();
  HG.shadeHouse(m, HG.makeShadeU()); const sh = SH(); rawHook(m)(sh);
  const inc = src => src.replace(/^[ \t]*#include +<([\w\d./]+)>/gm, (a, n) => inc(THREE.ShaderChunk[n] || ''));
  const f = inc(sh.fragmentShader), iM = f.indexOf('void main() {'), iD = f.indexOf('#define vMapUv hUv');
  const iV = f.search(/varying vec2 vMapUv;/), uses = ['texture2D( map, vMapUv )', 'texture2D( normalMap, vNormalMapUv )', 'texture2D( roughnessMap, vRoughnessMapUv )'].map(u => f.indexOf(u));
  check(iV >= 0 && iV < iM && iM < iD && f.indexOf('vec2 hUv = vMapUv * uUvK') > iM && f.indexOf('vec2 hUv = vMapUv * uUvK') < iD &&
        uses.every(u => u > iD) && /#define vNormalMapUv hUv/.test(f) && /#define vRoughnessMapUv hUv/.test(f),
        '1w the wander and the map scale reach every map read (the macros sit between the varyings and the chunks)', [iV, iM, iD, ...uses].join(','));
  const m0 = new THREE.MeshStandardMaterial(); HG.shadeHouse(m0, HG.makeShadeU()); const s0 = SH(); rawHook(m0)(s0);
  check(!/#define vMapUv/.test(s0.fragmentShader), '1x a material with no map declares no map uv: no wander (the flag, G309; the town\'s base)');
}

// ---- 2 classify + 3 merge on real houses ------------------------------------------------------------------------
const T = TARR.make(THREE, { HG });
function house(seed, x, z, yaw, tweak) {
  const P = HG.randomHouse(seed); if (tweak) tweak(P);
  const F = HG.makeFinish(); HG.applyFinish(P, F);
  const b = HG.build(P, 0, F), grp = new THREE.Group();
  grp.position.set(x, 3.5, z); grp.rotation.y = yaw;
  const bags = {}; for (const k of HG.BAGS) if (b.bags[k] && F.MAT[k]) { const m = b.bags[k].mesh(grp, F.MAT[k]); if (m) bags[k] = m; }
  grp.updateMatrixWorld(true);
  return { P, F, grp, bags };
}
const A = house(1234, 40, -20, 0.6, P => { P.sag = 0.12; });
const B = house(1234, -60, 15, -1.1, P => { P.sag = 0.12; });
const C = house(1234, 5, 80, 0.2, P => { P.sag = 0.12; P.dirtH = 1.7; });
{
  const kinds = {}; for (const k in A.bags) { const c = T.classify(A.bags[k]); kinds[k] = c ? c.kind : null; }
  check(kinds.siding === 'plain' && kinds.roof === 'plain' && kinds.trim === 'plain', '2a the wall, roof and trim are plain', JSON.stringify(kinds));
  check(!A.bags.glass || kinds.glass === 'glass', '2b the glass is glass', kinds.glass);
  check(!A.bags.smoke || kinds.smoke === null, '2c the smoke is not');
  const st = new THREE.Mesh(A.bags.siding.geometry, new THREE.MeshStandardMaterial()); HG.shadeHouse(st.material, A.F.SHADE_U); HG.steelMix(st.material, null, 0.5);
  check(T.classify(st) === null, '2d (negative) a hook wrapped over the house\'s (a steel mix) is not plain');
  const tr = new THREE.Mesh(A.bags.siding.geometry, A.bags.siding.material.clone()); tr.material.transparent = true;
  check(T.classify(tr) === null, '2e (negative) a transparent bag is not');
  const cl = new THREE.Mesh(A.bags.siding.geometry, A.bags.siding.material.clone());
  check(T.classify(cl) === null, '2f (negative) a clone (its hook not the one it was shaded with) is not');
}
{
  T.begin();
  const list = [A.bags.siding, B.bags.siding, C.bags.siding, A.bags.roof];
  const r = T.merge(list, 'plain');
  T.end();
  check(!!r.geo && r.used.length === 4, '3a four bags merge', r.used.length);
  const pos = r.geo.attributes.position.array, nor = r.geo.attributes.normal.array, sl = r.geo.attributes.aSlot.array, ix = r.geo.index.array;
  let worst = 0, off = 0, slotsOk = true, nOk = true; const slots = [];
  const v = new THREE.Vector3();
  for (const m of list) {
    const SU = m.material.userData.houseU, g = m.geometry.attributes.position, n = g.count;
    const s0 = sl[off]; slots.push(s0);
    for (let i = 0; i < n; i++) {
      let x = g.getX(i), y = g.getY(i), z = g.getZ(i);
      const bx = Math.max(0, 1 - x * x / Math.max(SU.uSagL.value ** 2, 0.01)), ky = Math.min(1, Math.max(0, (y - SU.uSagY0.value) / Math.max(SU.uSagY1.value - SU.uSagY0.value, 0.01)));
      y -= SU.uSag.value * bx * ky * ky;
      v.set(x, y, z).applyMatrix4(m.matrixWorld);
      worst = Math.max(worst, Math.abs(v.x - pos[(off + i) * 3]), Math.abs(v.y - pos[(off + i) * 3 + 1]), Math.abs(v.z - pos[(off + i) * 3 + 2]));
      if (sl[off + i] !== s0) slotsOk = false;
      if (Math.abs(Math.hypot(nor[(off + i) * 3], nor[(off + i) * 3 + 1], nor[(off + i) * 3 + 2]) - 1) > 1e-4) nOk = false;
    }
    off += n;
  }
  check(worst < 1e-4, '3b world positions with the sag baked, to 0.1 mm', worst.toExponential(2));
  const sagMoved = A.bags.roof.material.userData.houseU.uSag.value > 0.1;
  check(sagMoved, '3c the fixture sags (0.12)');
  check(slotsOk && nOk, '3d one slot over each source, unit normals');
  let maxI = 0; for (let i = 0; i < ix.length; i++) maxI = Math.max(maxI, ix[i]);
  check(maxI < r.geo.attributes.position.count, '3e the index points inside');
  check(slots[0] === slots[1], '3f the same finish on two houses is one slot', slots.join(','));
  check(slots[0] !== slots[2] && slots[0] !== slots[3], '3g another dirt line, another bag: other slots', slots.join(','));
  const row = s => Array.from(T.U.tTab.value.image.data.subarray(s * TARR.NS * 4, s * TARR.NS * 4 + 36));   // the live table: end() replaces it
  const m = A.bags.siding.material, R = row(slots[0]), SU = m.userData.houseU;
  const near = (a, b) => Math.abs(a - b) < 1e-5;
  check(near(R[0], m.color.r) && near(R[3], m.roughness) && near(R[4], m.metalness) && R[7] === -1 && R[8] === -1, '3h the row carries the colour, roughness, metalness; no layer headless');
  check(near(R[15], m.userData.paint.uPaintMode.value) && near(R[19], m.userData.dirt.uDirtGain.value) && near(R[25], SU.uDirtTop.value) && near(R[28], SU.uSat.value),
        '3i ... the paint, the dirt, the house\'s dirt line and punch');
  check(T.stats.slots === 3, '3j three slots in the table', T.stats.slots);
  // G581: where the house stands lifts its slot's dirt line (placeBuilt's uDirtY0)
  { const D = house(1234, 90, 40, 0.3, P => { P.sag = 0.12; }); (D.F.SHADE_U.uDirtY0 || (D.F.SHADE_U.uDirtY0 = { value: 0 })).value = 3.5;
    T.begin(); const rd = T.merge([D.bags.siding], 'plain'); T.end();
    const Rd = row(rd.geo.attributes.aSlot.array[0]);
    check(near(Rd[25], D.F.SHADE_U.uDirtTop.value + 3.5), '3l the house\'s world height is folded into its slot\'s dirt line', Rd[25]); }
  if (A.bags.glass) {
    T.begin(); const g = T.merge([A.bags.glass, B.bags.glass], 'glass', u => u.value * 2); T.end();
    const gr = row(g.geo.attributes.aSlot.array[0]);
    check(!!g.geo && g.geo.attributes.aHouseLit && g.geo.attributes.aHouseWin && near(gr[8], A.F.GLASS_U.uLitK.value * 2),
          '3k the glass keeps its lit / window channels; its lit base (the lamps\' base) in the slot');
  }
}

// ---- 4 the host ---------------------------------------------------------------------------------------------------
{
  const RP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
  check(RP.indexOf('let TARR = null;') > 0 && RP.indexOf('let TARR = null;') < RP.indexOf('const LAMPS = {'), '4a TARR is declared above LAMPS (G570: no TDZ)');
  check(/LAMPS\.kLit = on \* kGlass/.test(RP) && /TARR\.lit\.value = LAMPS\.kLit/.test(RP) && /TARR\.lit\.value = 0/.test(RP), '4b the lamps drive the town\'s lit panes, the mute too');
  check(/const sig = HLOD\.bake \+ '\|' \+ HLOD\.tarr \+ '\|' \+ HLOD\.lod1;/.test(RP) && /if \(sig !== HLOD\.sig\) \{ HLOD\.sig = sig; hlodDropAll\(\);/.test(RP), '4c the bake\'s sig carries the dials (a flip rebakes every cell, per cell since G592; the lod-1 far town since G800)');
  check(/filter\(k => !TARR_UD\.has\(k\)\)/.test(RP) && /TARR_UD = new Set\(\['houseU', 'glassU', 'hookHouse', 'hookGlass', 'hookCloud'\]\)/.test(RP), '4d G566\'s signature leaves G574\'s handles out');
  check(/const HLOD = \{ on: true, bake: true, tarr: true,/.test(RP), '4e the dial: WORLD.premises.hlod.tarr');
  check(/F\.SHADE_U\.uDirtY0\.value = grp\.matrixWorld\.elements\[13\]/.test(RP), '4g placeBuilt stands the dirt line where it stands the house (G581)');
  const BJ = fs.readFileSync(path.join(TOOLS, 'build.js'), 'utf8');
  check(BJ.indexOf("'house_tarr.js'") > 0 && BJ.indexOf("'house_tarr.js'") < BJ.indexOf("['src/viewer', 'render_premises.js']"), '4f build.js ships house_tarr.js before render_premises.js');
}

// ---- 5 LOD 1 PAST 150 M AND THE DITHERED BAND (G800-G802, C0 of QUEUE-C) ----------------------------------------------
// render_premises.js's HLOD block LIFTED (the dials, the URL flags, the band's uniforms and GLSL, lodMat, bandOf,
// lod1Bags) and run here on the vendor three and the real generator; the band's GLSL TRANSPILED to JS and swept
{
  const RP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
  const i0 = RP.indexOf('  const HLOD = { on: true,'), i1 = RP.indexOf('  const texMean = new Map();');
  check(i0 > 0 && i1 > i0, '5 the HLOD block found (HLOD .. texMean)');
  const block = RP.slice(i0, i1);
  const run = search => { const c = vm.createContext({ THREE, Math, Object, Map, console, location: search === undefined ? undefined : { search } });
    vm.runInContext((search === undefined ? 'var location = undefined;\n' : '') + block + '\nthis.X = { HLOD, LOD_U, LOD_DECL, LOD_VDECL, LOD_VDECL_FAR, LOD_VNEAR, LOD_VMID, LOD_E, lodDither, lodMat, bandOf, lod1Bags };', c); return c.X; };
  const X = run();
  // 5a lod 1 as the far town's source: opaque standard bags, the merge's channels only, walls and roof the box
  { const P = HG.randomHouse(4321), F = HG.makeFinish(); HG.applyFinish(P, F);
    const b0 = HG.build(P, 0, F), L = X.lod1Bags(HG, P, F), TL0 = TARR.make(THREE, { HG });
    const tris = L.reduce((t, m) => t + m.geometry.index.count / 3, 0);
    check(L.length > 0 && L.every(m => m.material.isMeshStandardMaterial && !m.material.transparent && !m.parent.parent), '5a lod 1: opaque standard bags, never in a scene', L.map(m => m.name).join(' '));
    check(L.every(m => ['position', 'normal', 'uv', 'aHouseAO'].every(k => m.geometry.attributes[k])) && L.every(m => TL0.classify(m)) && L.root && L.every(m => m.parent === L.root),
          '5b ... carrying the town shader\'s channels: every bag rides house_tarr (G1395: the far town on the town\'s shader)', L.filter(m => !TL0.classify(m)).map(m => m.name).join(' '));
    check(L.filter(m => m.userData.shell).map(m => m.name).every(k => /^(siding|roof|stone|log|floor)/.test(k)) && L.some(m => m.userData.shell) && L.some(m => !m.userData.shell), '5b2 ... the shells (walls, roof, chimney, logs, floor) stay past the detail band; the rest is detail', L.map(m => m.name + (m.userData.shell ? '' : '*')).join(' '));
    check(L.filter(m => m.userData.box).map(m => m.name).every(k => /^(siding|roof)/.test(k)) && L.some(m => m.userData.box), '5c ... the walls and the roof make the box');
    check(tris > 0 && tris < 0.25 * b0.stats.tris, '5d ... a fraction of lod 0\'s triangles', tris + ' vs ' + b0.stats.tris); }
  // 5e the band, transpiled: three rungs, one draws each pixel at every distance
  const fns = 'const fract = x => x - Math.floor(x), dot = (a, b) => a[0] * b[0] + a[1] * b[1], length = v => Math.hypot(v[0], v[1], v[2]), max = Math.max, abs = Math.abs, clamp = (x, a, b) => Math.min(b, Math.max(a, x));';
  // (G1395: + the house's radius vLodR and the projection's uLodS / uLodSB; 0 = fixed metres, G801's band exactly)
  const toJs0 = g => new Function('FC', 'vViewPosition', 'uLodA', 'uLodB', 'uLodW', 'uLodOn', 'vLodR', 'uLodS', 'uLodSB', fns + '\n' + g.replace(/\bfloat\s+/g, 'let ').replace(/vec2\(([^)]*)\)/g, '[$1]').replace(/gl_FragCoord\.xy/g, 'FC').replace(/discard;/g, 'return false;') + '\nreturn true;');
  const toJs = g => { const f = toJs0(g); return (FC, v, A, B, Wd, on, r, S, SB) => f(FC, v, A, B, Wd, on, r === undefined ? 8 : r, S || 0, SB || 0); };
  const near = toJs(X.lodDither(['out:A'])), mid = toJs(X.lodDither(['in:A', 'out:B']));
  { const A = 150, B = 1200, Wd = 40; let bad = 0, onlyNear = true, onlyMid = true, mono = true, prev = -1, part = 0;
    for (let d = 0; d <= 1400; d += 0.5) {
      let nm = 0;
      for (let px = 0; px < 64; px++) {
        const FC = [px * 7.3 + 0.5, px * 3.1 + 0.5], v = [0, 0, d], a = near(FC, v, A, B, Wd, 1), b = mid(FC, v, A, B, Wd, 1);
        if (a + b !== 1) bad++;
        if (d < A - Wd / 2 && !a) onlyNear = false; if (d > A + Wd / 2 && !b) onlyMid = false;
        if (b) nm++;
      }
      if (d > A - Wd / 2 && d < A + Wd / 2) { if (nm < prev) mono = false; prev = nm; if (nm > 0 && nm < 64) part++; }
    }
    check(!bad, '5e the band is complementary: exactly one rung draws each pixel, 0-1400 m', bad + ' pixel-distances with 0 or 2 rungs');
    check(onlyNear && onlyMid && part > 50, '5f outside the band the rung is whole (lod 0 < 130 m, lod 1 > 170 m); inside it both share the pixels', part);
    check(mono, '5g across the edge the arriving rung takes the pixels monotonically');
    const off = [near, mid].every(f => f([10.5, 3.5], [0, 0, 150], 150, 1200, 40, 0));
    check(off, '5h the band off (uLodOn 0): no discard, the per-cell hard switch decides'); }
  // 5e2 BY PROJECTED SIZE (G1395): with the projection on (S = 1272 px / 48, SB = 1272 / 9: 1080p at 46 deg), every
  // radius has its own edge - complementary at every distance, each house's band where its radius stands swapPx tall
  // (clamped to LOD_E), a big house later than a small one; the detail (aHC.w < 0) leaves at its b band, the shell never
  { const S = 1272 / 48, SB = 1272 / 9; let bad = 0, where = [], detailGone = true, shellStays = true, detailNear = true;
    for (const r of [3, 5.2, 8.3, 15.7, 40]) {
      const E = Math.min(X.LOD_E[1], Math.max(X.LOD_E[0], r * S)), Wd = E * 40 / 150; let first = -1, last = -1;
      for (let d = 0; d <= 2600; d += 1) for (let px = 0; px < 32; px++) {
        const FC = [px * 7.3 + 0.5, px * 3.1 + 0.5], v = [0, 0, d], a = near(FC, v, 150, 1200, 40, 1, r, S, SB), b = mid(FC, v, 150, 1200, 40, 1, r, S, SB);
        if (a + b !== 1) bad++;
        if (b && first < 0) first = d; if (a) last = d;
        if (d > 1.06 * Math.max(r * SB, E + Wd) && mid(FC, v, 150, 1200, 40, 1, -r, S, SB)) detailGone = false;
        if (d < 0.94 * Math.max(r * SB, E + Wd) && d > E + Wd && !mid(FC, v, 150, 1200, 40, 1, -r, S, SB)) detailNear = false;
        if (d > E + Wd && !b) shellStays = false;
      }
      if (!(first >= E - Wd / 2 - 1 && last <= E + Wd / 2 + 1)) where.push(r + ': ' + first + '-' + last + ' vs ' + E.toFixed(0));
    }
    check(!bad && !where.length, '5e2 by projected size: one rung a pixel, each radius banded about its own edge (R x F / swapPx, clamped)', bad + ' bad; ' + where.join('; '));
    check(detailGone && detailNear && shellStays, '5e3 ... the far town\'s detail leaves at its b band (R x F / detailPx), whole before it; the shells never leave'); }
  // 5i the far rung's program: lod 1 culls a house wholly on the band's near side in the vertex stage (its fragments would
  // all be discarded) and arrives at near; the boxes and the items' far town keep G559's plain program
  { const SHs = () => ({ uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader });
    const mM = X.lodMat('mid'), sM = SHs(); mM.onBeforeCompile(sM);
    check(/attribute vec4 aHC;/.test(sM.vertexShader) && sM.vertexShader.includes(X.LOD_VMID) && sM.vertexShader.indexOf('_hd') > sM.vertexShader.indexOf('#include <project_vertex>'), '5i lod 1: the house centre and radius per vertex, the cull after project_vertex');
    // the cull, transpiled: safe - a culled house's every fragment (centre +- radius) is one the band discards (the near
    // side of its edge; past its b band for the detail), fixed and projected
    { const cb = X.LOD_VMID.slice(X.LOD_VMID.indexOf('{')).replace('distance(cameraPosition, aHC.xyz)', 'HD').replace(/aHC\.w/g, 'AW').replace(/\bfloat\s+/g, 'let ').replace('gl_Position = vec4(0.0, 0.0, 2.0, 1.0);', 'return true;');
      const culled = new Function('HD', 'AW', 'uLodA', 'uLodB', 'uLodW', 'uLodOn', 'uLodS', 'uLodSB', fns + '\n' + cb + '\nreturn false;');
      let ok = true, n = 0;
      for (const [S, SB] of [[0, 0], [1272 / 48, 1272 / 9]]) for (let hd = 0; hd < 2600; hd += 2) for (const R of [3, 8, 20]) for (const sg of [1, -1]) if (culled(hd, sg * R, 150, 1200, 40, 1, S, SB)) {
        n++; for (let f = Math.max(0, hd - R); f <= hd + R; f += 0.5) for (let px = 0; px < 8; px++) if (mid([px * 3.5 + 0.5, 9.5], [0, 0, f], 150, 1200, 40, 1, sg * R, S, SB)) ok = false; }
      check(ok && n > 100, '5i2 ... a culled house (or its culled detail) has no fragment the band would draw', n + ' culls tried'); }
    check(sM.fragmentShader.includes(X.lodDither(['in:A', 'out:B'])) && sM.uniforms.uLodA === X.LOD_U.uLodA && sM.uniforms.uLodS === X.LOD_U.uLodS && sM.uniforms.uLodW === X.LOD_U.uLodW, '5j ... its fragment arrives at the house\'s edge, its detail leaves at b, on the host\'s shared uniforms');
    const mH = X.lodMat('hard');
    check(!Object.prototype.hasOwnProperty.call(mH, 'onBeforeCompile') && mH.vertexColors && mH !== mM && X.lodMat('hard') === mH, '5k the boxes and the items\' far town: G559\'s plain material, no band (their program as before)'); }
  // 5l the near rung: the town material and G566's clones leave at near, after their own hooks
  { const TL = TARR.make(THREE, { HG, lod: { U: X.LOD_U, decl: X.LOD_DECL, glsl: X.lodDither(['out:A']), vdecl: X.LOD_VDECL, vert: X.LOD_VNEAR, far: { glsl: X.lodDither(['in:A', 'out:B']), vdecl: X.LOD_VDECL_FAR, vert: X.LOD_VMID } } }), m = TL.material('plain', 0, 0), sh = SH(); m.onBeforeCompile(sh);
    const f = sh.fragmentShader, i = f.indexOf(X.lodDither(['out:A']));
    { const mf = TL.material('glass', 0, 0, false, true), sf = SH(); mf.onBeforeCompile(sf);
      check(sh.vertexShader.includes(X.LOD_VNEAR) && sh.vertexShader.includes('attribute float aHR;') && sf.vertexShader.includes('attribute vec4 aHC;') && !sf.vertexShader.includes('aHR') && /:lodfar$/.test(mf.customProgramCacheKey()) && mf !== TL.material('glass', 0, 0) &&
            sf.fragmentShader.includes(X.lodDither(['in:A', 'out:B'])) && sf.vertexShader.includes(X.LOD_VMID) && !sf.fragmentShader.includes(X.lodDither(['out:A'])),
            '5l0 the town material carries the house\'s radius (aHC); its FAR variant (G1395: the lod-1 far town on the town\'s shader) arrives, culls and sheds its detail as lod 1 does, a program of its own'); }
    const mb = TL.material('plain', 0, 0, true), shb = SH(); mb.onBeforeCompile(shb);
    check(i > f.indexOf('#include <clipping_planes_fragment>') && f.includes(X.LOD_DECL) && sh.uniforms.uLodA === X.LOD_U.uLodA && /:lod$/.test(m.customProgramCacheKey()) && T.material('plain', 0, 0).customProgramCacheKey() === 'house_tarr:plain:0:0',
          '5l the town material (TARR) leaves at near, a program of its own (a TARR made without the band keeps its key)');
    check(mb !== m && mb.customProgramCacheKey() === 'house_tarr:plain:0:0' && !shb.fragmentShader.includes('uLodA'), '5l2 ... an item\'s bags (bare) ride the town material of before');
    const Hm = house(99, 0, 0, 0), cm = Hm.bags.siding.material, c = X.bandOf(cm), s2 = SH(); c.onBeforeCompile(s2);
    const s0 = SH(); rawHook(cm)(s0);
    check(c !== cm && c.userData === cm.userData && X.bandOf(cm) === c && c.customProgramCacheKey() === cm.customProgramCacheKey() + '|hlod:out' && s2.vertexShader.includes(X.LOD_VNEAR), '5m a G566 bucket\'s material: one banded clone per canonical, its userData shared, its own key, the house\'s radius in');
    check(s2.fragmentShader.includes(X.lodDither(['out:A'])) && s2.fragmentShader.replace('#include <common>\n' + X.LOD_DECL, '#include <common>').replace('\n' + X.lodDither(['out:A']), '') === s0.fragmentShader,
          '5n ... its program is the house\'s own plus the band, nothing else');
    const bm = X.bandOf(new THREE.MeshBasicMaterial()), s3 = { uniforms: {}, vertexShader: THREE.ShaderLib.basic.vertexShader, fragmentShader: THREE.ShaderLib.basic.fragmentShader }; bm.onBeforeCompile(s3);
    check(!s3.fragmentShader.includes('uLodA'), '5o (negative) a basic material (no view position) keeps its program'); }
  // 5p the URL flags
  { const a = run('?houselod=0'), b = run('?x=1&houselod=1'), c = run('?houselod=300&lodfade=0'), d = run(''), e = run('?houselod=0&outlod=1'), f = run('?outlod=0');
    check(!a.HLOD.lod1 && a.HLOD.outLod === 0 && b.HLOD.near < 0 && b.HLOD.lod1 && c.HLOD.near === 300 && c.HLOD.fadeW === 0 && c.LOD_U.uLodOn.value === 0 &&
          d.HLOD.lod1 && d.HLOD.outLod === 1 && d.HLOD.near === 150 && d.HLOD.fadeW === 40 && d.LOD_U.uLodOn.value === 1 && !e.HLOD.lod1 && e.HLOD.outLod === 1 && f.HLOD.lod1 && f.HLOD.outLod === 0 &&
          d.HLOD.proj && !b.HLOD.proj && !c.HLOD.proj && run('?lodpx=30').HLOD.swapPx === 30 && d.HLOD.swapPx === 48,
          '5p ?houselod=0 (lod 0 far and outbuildings: before), =1 (lod 1 from 0 m), =N (the edge at N m, no projection), ?lodfade=0 (hard), ?outlod=0|1, ?lodpx=N; the defaults (projected)'); }
  // 5q the host
  // (G830: the generation moved to src/viewer/premises_build.js - the lod 1 built with the lod 0 there, kept here unless
  // the stream placed it, inline or from the house worker; the outbuilding's build at outLod there)
  const PBS = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'premises_build.js'), 'utf8');
  check(/if \(HLOD\.lod1 && o\.game && !IN_STREAM && R\.lod1\) \{ try \{ grp\.userData\.lod1 = lod1Bags\(HG, house\.P, F, R\.lod1\)/.test(RP) && /IN_STREAM = true; try \{ buildOne\(p\); \} finally \{ IN_STREAM = false; \}/.test(RP) && /IN_STREAM = true;\n\s*let k; try \{ k = hwPlace\(/.test(RP) &&
        /if \(C\.lod1 && C\.game\) \{ try \{ lod1 = HG\.build\(house\.P, 1, F\)/.test(PBS) && /get lod1\(\) \{ return HLOD\.lod1; \}, get outLod\(\) \{ return HLOD\.outLod; \}/.test(RP) && /HG\.build\(plot\.out\.P, \(C\.outLod && C\.game\) \? 1 : 0, F2\)/.test(PBS) && /const banded = g => !!\(HLOD\.lod1 && g\.userData\.lod1 && g\.userData\.lod1\.length\)/.test(RP) &&
        /const bagsP = TA && bagsB\.length \? hlodFarTarr\(cl, TA, bagsB\) : bagsB;\n\s*const B = hlodMerge\(bagsP, lodMat\('mid'\), true\), H = hlodMerge\(bagsH, lodMat\('hard'\), false\);/.test(RP) && /TA\.material\(G\.c\.kind, G\.c\.side, G\.dith, false, true\)/.test(RP) && /cl\.box = hlodBoxes\(B\.HB, lodMat\('hard'\)\)/.test(RP) && /cl\.boxH = hlodBoxes\(H\.HB, lodMat\('hard'\)\)/.test(RP) &&
        /lod: \{ U: LOD_U, decl: LOD_DECL, glsl: lodDither\(\['out:A'\]\), vdecl: LOD_VDECL, vert: LOD_VNEAR,/.test(RP) && /if \(b\.band\) hcOf\(r\.geo, r\.used, m => \[detailOf\(m\.parent\), 1\], true, true\);/.test(RP) && /if \(b\.band\) hcOf\(geo, b\.list, m => \[detailOf\(m\.parent\), 1\], true, false\);/.test(RP) && /TA\.material\(b\.c\.kind, b\.c\.side, m0\.material\.dithering, !b\.band\)/.test(RP) && /b\.band \? bandOf\(b\.mat\) : b\.mat/.test(RP),
        '5q the host: a house builds its lod 1 with its lod 0 (not in the in-flight stream), the outbuilding at outLod; the banded far town merges lod 1, its near rung (TARR, G566) and boxes wear the band; an item keeps G559\'s rungs');
}

// ---- 6 THE PASS OFF THE MAIN THREAD (G845) ----------------------------------------------------------------------------
// packDrawer + packStack are the page's pass AND the worker's source (their own text): run here on a recording 2D canvas
// whose pixels are a function of the image, the transform and the smoothing quality, (a) the module's packStack, (b) the
// same text compiled alone in a bare context (self-contained: no free name), (c) the worker body (PACK_WORKER after the
// two functions' text) in a vm with an OffscreenCanvas of the same canvas - the three stacks byte-identical; the layout
// (alpha 255; a flat layer its colour; no normal map = 128,128,255; the rough map's GREEN in alpha; no rough map = 255);
// every draw flipped; a map drawn already passes as it is; a bitmap smaller than the layer drawn 'low', an <img> 'high';
// the host's wiring (the worker when it can, the maps it shrinks drawn on the page a task each, the page on ?tarrw=0 /
// no API / any failure). tools/tarr_worker_check.js is the same on the real maps in Chrome.
const gate6 = (async () => {
  const px = 8, S = px * px * 4, log = [];
  const canvasOf = () => {
    let T = null;
    const ctx = { imageSmoothingQuality: 'low', set imageSmoothingEnabled(v) { log.push('smooth:' + v); },
      setTransform(...a) { T = a.join(','); }, clearRect() {}, drawImage(img, x, y, w, h) { log.push('draw:' + img.id + ':' + T + ':' + w + 'x' + h + ':' + this.imageSmoothingQuality); this.img = img; },
      getImageData(x, y, w, h) { const d = new Uint8ClampedArray(w * h * 4); for (let j = 0; j < d.length; j++) d[j] = (this.img.id * 37 + j * 11 + (T === '1,0,0,-1,0,' + px ? 0 : 99) + (this.imageSmoothingQuality === 'high' ? 0 : 50)) & 255; return { data: d }; } };
    return { width: 1, height: 1, getContext: (k, o) => { log.push('ctx:' + k + ':' + !!(o && o.willReadFrequently)); return ctx; } };
  };
  const img = id => ({ id, width: px, height: px, closed: false });
  const bmp = (id, w) => ({ id, width: w, height: w, closed: false, close() { this.closed = true; } });
  const pre = id => { const d = new Uint8ClampedArray(S); for (let j = 0; j < S; j++) d[j] = (id * 37 + j * 11) & 255; return d; };
  const mkIn = () => ({ A: [img(1), [10, 20, 30], img(2)], N: [[img(3), img(4)], [null, img(5)], [img(6), null], [null, null]] });
  const doc = { createElement: () => canvasOf() };
  const I = mkIn(), R1 = TARR.packStack(px, doc, I.A, I.N);
  const SRC = 'const packDrawer = ' + TARR.packDrawer.toString() + ';\nconst packStack = ' + TARR.packStack.toString() + ';\n';
  const bare = vm.createContext({ Uint8Array, Uint8ClampedArray, ArrayBuffer, Math, Array });
  const R2 = vm.runInContext(SRC + 'packStack', bare)(px, doc, mkIn().A, mkIn().N);
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  check(R1.dA.length === S * 3 && R1.dN.length === S * 4 && same(R1.dA, R2.dA) && same(R1.dN, R2.dN), '6a packDrawer + packStack\'s own text, compiled alone in a bare context, packs the same bytes (self-contained: the worker\'s source)');
  const px0 = (id, j) => (id * 37 + j * 11) & 255;
  let lay = true;
  for (let j = 0; j < S; j++) {
    if (R1.dA[j] !== ((j & 3) === 3 ? 255 : px0(1, j))) lay = false;
    if (R1.dA[S + j] !== [10, 20, 30, 255][j & 3]) lay = false;
    if (R1.dA[2 * S + j] !== ((j & 3) === 3 ? 255 : px0(2, j))) lay = false;
    if (R1.dN[j] !== ((j & 3) === 3 ? px0(4, j - 2) : px0(3, j))) lay = false;
    if (R1.dN[S + j] !== ((j & 3) === 3 ? px0(5, j - 2) : [128, 128, 255][j & 3])) lay = false;
    if (R1.dN[2 * S + j] !== ((j & 3) === 3 ? 255 : px0(6, j))) lay = false;
    if (R1.dN[3 * S + j] !== [128, 128, 255, 255][j & 3]) lay = false;
  }
  check(lay, '6b the layout: colour alpha 255, a flat layer its colour, no normal map 128,128,255, the rough map\'s green in alpha, no rough map 255');
  const draws = log.filter(s => s.indexOf('draw:') === 0);
  check(draws.length === 2 * 6 && draws.every(s => s.indexOf(':1,0,0,-1,0,' + px + ':' + px + 'x' + px + ':high') > 0) && log.indexOf('ctx:2d:true') >= 0 && log.indexOf('smooth:true') >= 0,
    '6c every draw on a willReadFrequently 2D canvas, smoothing on, an <img> at high, the rows flipped, px x px', draws.length + '');
  log.length = 0;
  const R3 = TARR.packStack(px, doc, [pre(1), bmp(2, px / 2), bmp(7, px)], []);
  const d3 = log.filter(s => s.indexOf('draw:') === 0);
  let ok3 = d3.length === 2 && d3[0].endsWith(':low') && d3[1].endsWith(':high');
  for (let j = 0; j < S; j++) { if (R3.dA[j] !== ((j & 3) === 3 ? 255 : px0(1, j))) ok3 = false; if (R3.dA[S + j] !== ((j & 3) === 3 ? 255 : (px0(2, j) + 50) & 255)) ok3 = false; }
  check(ok3, '6d a map drawn already passes as it is (no draw); a bitmap smaller than the layer is drawn low (Chrome scales an <img> up bilinear), one the layer\'s size high', d3.join(' '));
  // the worker body, as the page writes it (the bitmaps it is handed closed; the Blobs it decodes made and closed there)
  const posted = [], WI = mkIn();
  const wctx = vm.createContext({ Uint8Array, Uint8ClampedArray, ArrayBuffer, Math, Array, String, Promise, OffscreenCanvas: function () { return canvasOf(); }, postMessage: (m, tr) => posted.push({ m, tr }) });
  vm.runInContext(SRC + TARR.PACK_WORKER, wctx);
  WI.A[0].close = function () { this.closed = true; }; WI.N[0][1].close = function () { this.closed = true; };
  await wctx.onmessage({ data: { px, A: WI.A, N: WI.N } });
  const P = posted[0];
  check(posted.length === 1 && P.m.dA && same(P.m.dA, R1.dA) && same(P.m.dN, R1.dN) && P.tr.length === 2 && P.tr[0] === P.m.dA.buffer && P.tr[1] === P.m.dN.buffer &&
        WI.A[0].closed && WI.N[0][1].closed, '6e the worker body packs the same bytes, transfers both stacks and closes the bitmaps it was handed');
  posted.length = 0;
  const bad = vm.createContext({ Uint8Array, Uint8ClampedArray, ArrayBuffer, Math, Array, String, Promise, OffscreenCanvas: function () { throw new Error('no 2d'); }, postMessage: (m, tr) => posted.push({ m, tr }) });
  vm.runInContext(SRC + TARR.PACK_WORKER, bad); await bad.onmessage({ data: { px, A: [img(1)], N: [] } });
  check(posted.length === 1 && posted[0].m.err === 'no 2d' && !posted[0].m.dA, '6f a worker that cannot draw answers with its error (the page then draws)');
  const HT = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'house_tarr.js'), 'utf8');
  check(/return packOff\(px, okA, okN\.map\(\(\[, p\]\) => p\)\)\.then\(D => finish\(D, okA, okN, mA, mN, src\)\);/.test(HT) && /\[\?&\]tarrw=0/.test(HT) &&
        /typeof Worker === 'undefined' \|\| typeof OffscreenCanvas === 'undefined' \|\|\s*typeof createImageBitmap !== 'function'/.test(HT) && /if \(off\) return Promise\.resolve\(local\(\)\);/.test(HT) &&
        /x\.naturalWidth > 0 && x\.naturalWidth <= px && x\.naturalHeight <= px/.test(HT) && /fetch\(x\.src\)\.then\(r => \{ if \(!r\.ok\) throw new Error\(r\.status\); return r\.blob\(\); \}\)\.catch\(\(\) => here\(x\)\) : here\(x\)/.test(HT) &&
        /const here = x => new Promise\(r => setTimeout\(\(\) => \{ const t = now\(\); r\(pd\(x\)\);/.test(HT) && HT.indexOf('new Blob([PACK_WORKER_SRC()]') > 0 &&
        /stats\.workerErr = String\(err && err\.message\); return local\(\);/.test(HT) && /\[\?&\]tarrcheck=1/.test(HT) && (HT.match(/getImageData/g) || []).length === 1,
    '6g the host: build() packs through packOff - the worker (its source the two functions\' text) when the page has Worker + OffscreenCanvas + createImageBitmap; a map at most the layer\'s size as its file, one the layer shrinks (or a canvas, or a failed fetch) drawn on the page a task each; the page on ?tarrw=0, without them or on any failure; ?tarrcheck=1; one getImageData in the file');
})();

gate6.catch(e => check(false, '6 threw', e && e.stack)).then(() => {
  console.log(`${checks - fail.length}/${checks} checks`);
  for (const f of fail) console.log('  FAIL ' + f);
  console.log('GATE TARR: ' + (fail.length ? 'FAIL' : 'PASS'));
  process.exit(fail.length ? 1 : 0);
});
