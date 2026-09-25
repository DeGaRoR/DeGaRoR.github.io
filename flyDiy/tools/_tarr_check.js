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
  check(gs.fragmentShader.includes('gLitCol(vHouseLit)') && gs.fragmentShader.includes('gDress('), '1q the lit windows and the curtains are the generator\'s own GLSL');
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
  check(/const sig = HOUSES\.size \+ '\|' \+ HLOD\.bake \+ '\|' \+ HLOD\.tarr;/.test(RP), '4c the bake\'s sig carries the dials');
  check(/filter\(k => !TARR_UD\.has\(k\)\)/.test(RP) && /TARR_UD = new Set\(\['houseU', 'glassU', 'hookHouse', 'hookGlass', 'hookCloud'\]\)/.test(RP), '4d G566\'s signature leaves G574\'s handles out');
  check(/const HLOD = \{ on: true, bake: true, tarr: true,/.test(RP), '4e the dial: WORLD.premises.hlod.tarr');
  const BJ = fs.readFileSync(path.join(TOOLS, 'build.js'), 'utf8');
  check(BJ.indexOf("'house_tarr.js'") > 0 && BJ.indexOf("'house_tarr.js'") < BJ.indexOf("['src/viewer', 'render_premises.js']"), '4f build.js ships house_tarr.js before render_premises.js');
}

console.log(`${checks - fail.length}/${checks} checks`);
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE TARR: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
