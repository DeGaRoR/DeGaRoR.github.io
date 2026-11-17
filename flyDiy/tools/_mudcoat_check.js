#!/usr/bin/env node
// GATE MUDCOAT (SNOW-MUD FINISH, 2026-11-15) — MUD BUILDS UP ON THE AEROPLANE, AND RAIN AND WATER WASH IT OFF.
//
// A0 for the user (15 Nov): "mud builds up on the gear, belly and flaps after mud ops. It wears with rain or water landings".
// aeroweather.js: AERO_MUD + aeroMudStep (the law, pure) and aeroWxSetMud (the coat onto the shared weathering block: the wheel
// mud cone - gear legs, the belly and the flap undersides aft of the tyres, the tyres' grooves -, the belly dirt and the dirt in
// the depressions, raised over the macros' strengths); app.js mudCoatFrame (the mains on SURFACE 11 / 12, the solver's
// sinkage, the day's rain, water contact).
//
//   node tools/_mudcoat_check.js            -> "GATE MUDCOAT: PASS|FAIL"
//   node tools/_mudcoat_check.js --show     -> the numbers
//   node tools/_mudcoat_check.js --selftest -> negative verification
//
// A. THE LAW: nothing builds off mud, on the ground at rest, or in the air; it builds faster with speed and with sinkage
//    (soft mud over firm); it saturates under 1; rain washes it (faster flying in it), water faster still; it never goes
//    under 0 or over 1.
// B. A FLOWN ROLL: the stock Cub's take-off run on soft mud (the solver's own sinkage and contacts, the law at 60 Hz) leaves
//    it at least half caked; on firm mud less; on grass none. Ten minutes of rain parked takes off more than half; a water
//    landing's 20 s run more than three quarters.
// C. THE DRAW: at m = 0 the resolved layers are the macros' exactly (no coat, the old look); at m the wheel mud rises by m,
//    the belly by 0.6 m, the depressions by 0.3 m, nothing else moves; a coat opens the weathering branch; a pinned layer
//    (the bench) wins over the coat; the block is refreshed only when the coat moved.
// D. THE WIRING: app.js steps it every frame beside the dust, reads the mains' surface only on the ground, the solver's
//    sinkage, the day's rain, the water contact; a new aeroplane starts clean; the garage draws the build without it.
// E. THE COST: the law a frame under 1 us.
// F. THE LIVE TERM (GROUND-FX, 16 Nov): the bake (FB_HOOK) and the live shader carry the same term (the computed mud, the
//    dust film, the wetness, the rain on the skin; the cone coat the bake's fallback), the bake binds the very uniform
//    objects the page writes, its craft normal, no varnish over the mud; the JS mirror at a fragment; the rain law; the page
//    steps it after the coat, draws one mud (the grid's or the cone's), throws the live pool at the grid, makes it parked.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const C = require(path.join(__dirname, 'flight_core.js'));
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
// the shared block bakes its grunge sheet on a canvas: a stand-in that holds the pixels (the layers are what this gate reads)
if (typeof document === 'undefined') global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
  createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, drawImage() {} }) }) };
const SHOW = process.argv.includes('--show'), SELF = process.argv.includes('--selftest');
const log = s => { if (SHOW) console.log('  ' + s); };
const fresh = () => { delete require.cache[require.resolve(path.join(ROOT, 'src', 'viewer', 'aeroweather.js'))]; return require(path.join(ROOT, 'src', 'viewer', 'aeroweather.js')); };

// the stock Cub's run from rest to 0.9 Vs on flat ground of code sc, the coat stepped as app.js does
function rollCoat(W, sc) {
  const def = C.buildGen(), Vs = def.params.gen.Vs, sim = C.makeSim(def, { terrainH: () => 0, surface: () => sc, treesNear: () => [] }); sim.reset(0);
  const M = def.refs.mains, P = sim.p; let m = 0;
  const hdg = () => { const a = M[0], b = M[1], t = def.refs.tw; return Math.atan2((P[a * 3 + 2] + P[b * 3 + 2]) / 2 - P[t * 3 + 2], (P[a * 3] + P[b * 3]) / 2 - P[t * 3]); };
  const h0 = hdg(); sim.ctl.thr = 1;
  for (let s = 0; s < 60 * 60; s++) {
    let e = hdg() - h0; e = Math.atan2(Math.sin(e), Math.cos(e)); sim.ctl.dr = Math.max(-1, Math.min(1, 4 * e));
    sim.step(1 / 60);
    const WC = sim.wheelContacts(); let mud = 0; for (let k = 0; k < M.length; k++) if (WC.mains[k] && (sc === 11 || sc === 12)) mud++;
    const v = sim.cgVel();
    m = W.aeroMudStep(m, 1 / 60, { mud: mud / M.length, V: Math.hypot(v[0], v[2]), sink: sim.out.softZ > 0 ? sim.out.softZ : 0, rain: 0, water: false });
    if (sim.out.V > 0.9 * Vs) break;
  }
  return m;
}
function run(W, o) {
  const fail = [], yes = (ok, label, extra) => { if (!ok) fail.push(label + (extra != null ? ' - ' + extra : '')); };
  const st = (m, secs, x) => { for (let s = 0; s < secs * 60; s++) m = W.aeroMudStep(m, 1 / 60, x); return m; };
  // A
  yes(st(0, 60, { mud: 0, V: 15, sink: 0 }) === 0, 'A nothing builds off mud');
  yes(st(0, 60, { mud: 1, V: 0, sink: 0.06 }) === 0, 'A nothing builds standing still on mud');
  const firm = st(0, 20, { mud: 1, V: 10, sink: 0.012 }), soft = st(0, 20, { mud: 1, V: 10, sink: 0.065 }), slow = st(0, 20, { mud: 1, V: 4, sink: 0.065 });
  yes(soft > 1.2 * firm && soft > 1.2 * slow && firm > 0, 'A it builds faster deeper in and faster at speed', 'firm ' + firm.toFixed(2) + ', soft ' + soft.toFixed(2) + ', soft at 4 m/s ' + slow.toFixed(2));
  const sat = st(0, 600, { mud: 1, V: 20, sink: 0.1 });
  yes(sat <= 1 && sat > 0.95, 'A it saturates at 1', sat.toFixed(3));
  const rp = st(0.8, 600, { rain: 1, V: 0 }), rf = st(0.8, 600, { rain: 1, V: 50 }), dry = st(0.8, 600, { rain: 0, V: 0 });
  yes(dry === 0.8 && rp < 0.8 && rf < rp, 'A rain washes it, flying in it faster; dry, it stays', 'parked ' + rp.toFixed(2) + ', flying ' + rf.toFixed(2) + ', dry ' + dry.toFixed(2));
  const wt = st(0.8, 20, { water: true, V: 10 });
  yes(wt < 0.2 * 0.8, 'A a water run washes it fast (20 s)', wt.toFixed(3));
  yes(W.aeroMudStep(2, 1, { mud: 1, V: 20, sink: 1 }) === 1 && W.aeroMudStep(-1, 1, {}) === 0, 'A clamped to 0..1');
  log('A 20 s at 10 m/s: firm ' + firm.toFixed(2) + ', soft ' + soft.toFixed(2) + '; 10 min rain parked 0.8 -> ' + rp.toFixed(2) + ', flying ' + rf.toFixed(2) + '; 20 s water 0.8 -> ' + wt.toFixed(3));
  // B
  if (o.flown) {
    const R = o.flown;
    yes(R.soft >= 0.5 && R.firm > 0.1 && R.firm < R.soft && R.grass === 0, 'B a take-off run cakes it on soft mud (>= 0.5), less on firm, none on grass', 'soft ' + R.soft.toFixed(2) + ', firm ' + R.firm.toFixed(2) + ', grass ' + R.grass);
    log('B the stock Cub\'s take-off run: soft mud ' + R.soft.toFixed(2) + ', firm ' + R.firm.toFixed(2) + ', grass ' + R.grass);
  }
  // C
  const NLY = W.AERO_WX_LAYERS.length, L0 = Array.from(W.aeroWxResolve()).slice(0, NLY), U = W.aeroWxSharedU(THREE), lay = () => U.uWxL.value.flatMap(v => [v.x, v.y, v.z, v.w]).slice(0, NLY);
  W.aeroWxSetMud(THREE, 0); W.aeroWxRefresh();
  const at0 = lay();
  yes(at0.every((v, i) => Math.abs(v - L0[i]) < 1e-6) && !W.AERO_WX.live, 'C no coat: the macros\' layers exactly');
  W.aeroWxSetMud(THREE, 0.5);
  const at5 = lay(), K = W.AERO_WX_LAYERS.map(l => l.k), d = i => at5[i] - at0[i];
  const exp = { mud: 0.5, belly: 0.5 * W.AERO_MUD.belly, dep: 0.5 * W.AERO_MUD.dep };
  yes(K.every((k, i) => Math.abs(d(i) - Math.min(1 - at0[i], exp[k] || 0)) < 1e-6), 'C the coat raises the wheel mud, the belly, the depressions - nothing else', K.map((k, i) => d(i) ? k + ' +' + d(i).toFixed(2) : null).filter(Boolean).join(', '));
  yes(W.AERO_MUD.belly >= 0.3 && W.AERO_MUD.dep >= 0.1, 'C the belly and the depressions take their share (>= 0.3, >= 0.1 of it)', W.AERO_MUD.belly + ' / ' + W.AERO_MUD.dep);
  yes(U.uWear.value.x >= 1e-3, 'C a coat opens the weathering branch');
  W.aeroWxPin(THREE, 'mud', 0.1); yes(Math.abs(lay()[K.indexOf('mud')] - 0.1) < 1e-6, 'C a pinned layer (the bench) wins over the coat'); W.aeroWxPin(THREE, 'mud', null);
  let n = 0; const r0 = W.aeroWxRefresh; W.AERO_WX.live.m = 0.5;
  const before = JSON.stringify(W.AERO_WX.live); W.aeroWxSetMud(THREE, 0.501); yes(JSON.stringify(W.AERO_WX.live) === before, 'C the block is refreshed only when the coat moved (a step under 0.004 is not a refresh)');
  W.aeroWxSetMud(THREE, 0); yes(!W.AERO_WX.live && lay().every((v, i) => Math.abs(v - L0[i]) < 1e-6), 'C cleaned: the old look again');
  // D
  if (o.src) {
    const a = o.src;
    yes(/syncDustFx\(running \? fdt : 0\);[^\n]*\n\s*mudCoatFrame\(running \? fdt : 0\);/.test(a), 'D stepped every frame beside the dust');
    yes(/if \(WC && !WC\.water && world && typeof world\.surface === 'function'\)\s*\n\s*for \(let k = 0; k < M\.length; k\+\+\) if \(WC\.mains\[k\]\)/.test(a), 'D the mains\' surface read only on the ground');
    yes(/sink: o\.softZ > 0 \? o\.softZ : 0/.test(a) && /rain: soilNow \? soilNow\.rainNow : 0/.test(a) && /water: !!\(WC && WC\.water\) \|\| o\.hydroWet > 0/.test(a), 'D the solver\'s sinkage, the day\'s rain, the water contact');
    yes(/if \(def !== mudCoatDef\) \{ mudCoatDef = def; mudCoat = 0; \}/.test(a) && /if \(inGarage\) \{ AEROWX\.aeroWxSetMud\(THREE, 0\); return; \}/.test(a), 'D a new aeroplane starts clean; the garage draws the build without it');
  }
  // E
  const t0 = process.hrtime.bigint(), N = 200000; let m = 0.3;
  for (let k = 0; k < N; k++) m = W.aeroMudStep(m, 1 / 60, { mud: 0.5, V: 10, sink: 0.03, rain: 0.2, water: false });
  const us = Number(process.hrtime.bigint() - t0) / 1e3 / N;
  yes(us < 1, 'E the law a frame under 1 us', us.toFixed(3) + ' us');
  log('E ' + us.toFixed(3) + ' us a frame');
  if (!o.noLive) for (const f of liveTerm(W, o)) fail.push(f);
  return fail;
}
// ---- F. THE LIVE TERM (GROUND-FX, 16 Nov; the design's section 7: the bake froze the weathering at roll-out and dropped the
// live coat - DIRT-DUST's run 3: coat 0.58 in the uniforms, nothing on screen). aeroweather's aeroGdFs spliced into BOTH the
// live shader and flown_bake.js's FB_HOOK; the page's gdFrame writes the shared block; ground_deposit's rain law.
function liveTerm(W, o) {
  const fail = [], yes = (c, m, x) => { if (!c) fail.push(m + (x ? ' (' + x + ')' : '')); else log('ok   ' + m + (x ? ' - ' + x : '')); };
  const GD = require(path.join(ROOT, 'src', 'viewer', 'ground_deposit.js'));
  const U = W.aeroWxSharedU(THREE);
  const KEYS = ['tGdMud', 'tGdFw', 'uGdBox', 'uGdDim', 'uGdMudC', 'uGdDustC', 'uGdPbr', 'uGdRain', 'uGdSp', 'uGdSp2'];
  yes(KEYS.every(k => U[k]), 'F the shared block carries the term\'s uniforms', KEYS.filter(k => !U[k]).join(', '));
  // the baked material: FB_HOOK on the physical shader three ships
  globalThis.THREE = THREE; globalThis.AEROWX = W;
  const fbPath = path.join(ROOT, 'src', 'viewer', 'flown_bake.js');
  let FBM = null;
  if (o.fbSrc) { const vm = require('vm'); vm.runInThisContext(o.fbSrc, { filename: 'flown_bake_doctored.js' }); FBM = globalThis.FLOWN_BAKE; }
  else { delete require.cache[require.resolve(fbPath)]; require(fbPath); FBM = globalThis.FLOWN_BAKE; }
  const d = Object.assign({ uCraftInv: { value: new THREE.Matrix4() } }, U);
  const mat = new THREE.MeshPhysicalMaterial({ clearcoat: 1 }); mat.userData.aeroD = d;
  const sh = { uniforms: {}, vertexShader: THREE.ShaderLib.physical.vertexShader, fragmentShader: THREE.ShaderLib.physical.fragmentShader };
  FBM.FB_HOOK.call(mat, sh);
  const fs_ = sh.fragmentShader, iT = fs_.indexOf('float gdMudK'), iE = fs_.indexOf('#include <emissivemap_fragment>');
  yes(iT > 0 && iT < iE && /textureLod\(tGdMud, gdUvw, 0\.0\)/.test(fs_) && /gdSpatter\(gdP\)/.test(fs_) && /uGdMudC\.w > 0\.0/.test(fs_),
    'F the bake carries the term (the grid, the spatter, the cone coat as its fallback), before the emissive: after the normal maps');
  yes(/vFbCraftN = mat3\(uCraftInv \* modelMatrix\) \* objectNormal;/.test(sh.vertexShader) && /normalize\(vFbCraftN\) \* faceDirection/.test(fs_), 'F the bake\'s craft normal (both faces)');
  yes(/material\.clearcoat \*= 1\.0 - gdMudK;/.test(fs_), 'F no varnish over the mud on the bake');
  const ident = KEYS.concat(['uWxW', 'uWxWd', 'uWxN']).filter(k => sh.uniforms[k] !== U[k]);
  yes(!ident.length, 'F the bake binds the very objects the page writes (identity, not copies)', ident.join(', '));
  // the live shader: the same term at the surface pass's tail, its uniforms declared
  yes(/gdSpatter\(gdP\)/.test(W.AERO_WX_SURF_FS) && W.AERO_WX_SURF_FS.lastIndexOf('float gdMudK') > W.AERO_WX_SURF_FS.lastIndexOf('uWxDbg') && !/uGdMudC\.w > 0\.0/.test(W.AERO_WX_SURF_FS)
      && /uniform highp sampler3D tGdMud;/.test(W.AERO_WX_PARS_FS), 'F the live shader carries the same term (the cone drawn by its layers, not twice)');
  // the slot's lessons (17 Nov): the atlas bake never takes the term (GD_OFF before the live hook's), no varnish over the mud
  // in the live shader either (GD_TERM), and the grid gathered with the parked live meshes put back (withKept)
  const fbText = o.fbSrc || fs.readFileSync(fbPath, 'utf8');
  yes(/sh\.fragmentShader = '#define GD_OFF\\nuniform float uFbOut;/.test(fbText) && /#ifndef GD_OFF/.test(W.AERO_WX_SURF_FS) && /#ifdef GD_TERM\n  material\.clearcoat \*= 1\.0 - gdMudK;/.test(W.AERO_WX_CC_FS),
    'F the atlas bake never freezes the term (GD_OFF); the live shader\'s clear coat goes with the mud (GD_TERM)');
  // the 16:05 re-shoot (17 Nov): the scuffed program passed the GPU's 16 texture units with the term's two samplers - it
  // compiles the term out (GD_OFF), so its unit count is master's
  { const sc = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'skin_scuff.js'), 'utf8');
    yes(/const def = '#define DMG_SCUFF 1\\n#define GD_OFF 1\\n'/.test(o.scuffSrc || sc), 'F the scuffed program compiles the term out (GD_OFF: under the 16 texture units, as master)'); }
  if (o.src) yes(/FBk \? FBk\(\(\) => gdGather\(U\)\) : gdGather\(U\)/.test(o.src), 'F the grid gathered with the bake\'s parked live meshes put back (FLOWN_BAKE.withKept: the slot saw 3686 of 12457 cells)');
  // the JS mirror at a fragment's point: a plate, mud arriving up at its middle -> the underside takes it, the top none
  const T = [], part = [];
  for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { const x = i * 0.1 - 0.5, y = j * 0.1 - 0.5;
    T.push(x, y, 0.5, x + 0.1, y, 0.5, x, y + 0.1, 0.5, x + 0.1, y, 0.5, x + 0.1, y + 0.1, 0.5, x, y + 0.1, 0.5); part.push(1, 1); }
  const G = GD.make(Float32Array.from(T), Uint8Array.from(part), { h: 0.08, zLow: 0 });
  const c = G.occ.findIndex((v, i) => v === 1 && Math.abs((i % G.nx) - G.nx / 2) < 2 && Math.abs((Math.floor(i / G.nx) % G.ny) - G.ny / 2) < 2);
  GD.deposit(G, c, 0, 0.2, 1, 2, 1); GD.smooth(G);
  const px = G.o[0] + ((c % G.nx) + 0.5) * G.h, py = G.o[1] + ((Math.floor(c / G.nx) % G.ny) + 0.5) * G.h, pz = 0.5;
  const under = GD.sample(G, px, py, pz, 0, 0, -1), top = GD.sample(G, px, py, pz, 0, 0, 1);
  yes(under > 0.3 && top === 0, 'F the mirror at the fragment: the underside takes the mud, the top none', 'under ' + under.toFixed(2) + ', top ' + top.toFixed(2));
  // the rain on the skin: wets toward the rain over tWet, holds a drizzle at its own level, dries over tDry after
  const R = GD.RAIN; let w = 0; for (let k = 0; k < 60 * 60; k++) w = GD.rainStep(w, 1 / 60, 1);
  const wet60 = w; for (let k = 0; k < 600; k++) w = GD.rainStep(w, 1, 0);
  const dry10 = w; let wd = 0; for (let k = 0; k < 600; k++) wd = GD.rainStep(wd, 1, 0.3);
  yes(wet60 > 0.9 && dry10 < 0.5 * wet60 && dry10 > 0.1 && Math.abs(wd - 0.3) < 0.15 && GD.rainStep(2, 1, 5) <= 1 && GD.rainStep(-1, 1, 0) >= 0,
    'F rain on the skin: wet through in a minute of rain, half dry ten minutes after, a drizzle holds its level', 'a minute ' + wet60.toFixed(2) + ', then 10 min dry ' + dry10.toFixed(2) + ', drizzle 0.3 from dry -> ' + wd.toFixed(2));
  yes(R.darken > 0 && R.gloss > 0 && R.sides < 1, 'F wet skin darker and glossier, the top more than the sides', JSON.stringify(R));
  // the page
  if (o.src) {
    const a = o.src;
    yes(/mudCoatFrame\(running \? fdt : 0\);[^\n]*\n\s*gdFrame\(running \? fdt : 0\);/.test(a), 'F the page steps it every frame after the coat');
    yes(/AEROWX\.aeroWxSetMud\(THREE, GDX\.G \? 0 : mudCoat\);/.test(a) && /U\.uGdMudC\.value\.set\(mc\[0\], mc\[1\], mc\[2\], G \? 0 : mudCoat\)/.test(a),
      'F one mud drawn: the grid\'s, or the cone coat (the live layers, the bake\'s fallback) - never both');
    yes(/GROUND_DEPOSIT\.collide\(G, F\.sys\.G, inv, v, dt, wet, 1\)/.test(a) && /GROUND_DEPOSIT\.dustRays\(G, F\.sys\.P, inv, v,/.test(a) && /U\.uGdRain\.value\.set\(GDX\.rainW, RN\.darken, RN\.gloss, RN\.sides\)/.test(a),
      'F the page throws the live pool at the grid, films it, writes the rain');
    yes(/if \(GDX\.parkT > 0\.5 \|\| GDX\.mudT > 1\.5\)/.test(a) && /if \(t === 'laptop' \|\| t === 'potato' \|\| t === 'phone'\) return 0;/.test(a),
      'F the grid is made parked (or after 1.5 s on mud), on retro and gamer only');
  }
  return fail;
}

const src = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8');
if (SELF) {
  const bad = [];
  const doctor = (name, mut, o) => { const W = fresh(); mut(W); const f = run(W, Object.assign({ src }, o || {})); console.log('  selftest ' + name + ': ' + (f.length ? 'red (' + f[0] + ')' : 'STILL GREEN')); if (!f.length) bad.push(name); };
  doctor('rain does not wash', W => { W.AERO_MUD.kRain = 0; });
  doctor('water does not wash', W => { W.AERO_MUD.kWater = 0; });
  doctor('sinkage ignored', W => { W.AERO_MUD.sinkRef = 1e9; });
  doctor('the coat on the wrong layer', W => { W.AERO_MUD.belly = 0; });
  doctor('not wired', () => {}, { src: src.replace('mudCoatFrame(running ? fdt : 0);', '') });
  const fb = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'flown_bake.js'), 'utf8'), GDm = require(path.join(ROOT, 'src', 'viewer', 'ground_deposit.js'));
  doctor('the bake without the term', () => {}, { src, fbSrc: fb.replace("(GW ? GW.aeroGdFs('vFbCraft', 'normalize(vFbCraftN) * faceDirection', true) : '')", "''") });
  doctor('the bake binds copies', () => {}, { src, fbSrc: fb.replace('if (GW) for (const k of GD_KEYS) if (d[k]) sh.uniforms[k] = d[k];', 'if (GW) for (const k of GD_KEYS) if (d[k]) sh.uniforms[k] = { value: d[k].value };') });
  doctor('the skin never dries', () => { GDm.RAIN.tDry = 1e9; }); GDm.RAIN.tDry = 600;
  doctor('the live term not stepped', () => {}, { src: src.replace('gdFrame(running ? fdt : 0);', '') });
  doctor('the bake freezes the term', () => {}, { src, fbSrc: fb.replace("sh.fragmentShader = '#define GD_OFF\\nuniform float uFbOut;", "sh.fragmentShader = 'uniform float uFbOut;") });
  doctor('the grid misses the parked meshes', () => {}, { src: src.replace('gat = FBk ? FBk(() => gdGather(U)) : gdGather(U);', 'gat = gdGather(U);') });
  doctor('the scuff keeps the term', () => {}, { src, scuffSrc: fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'skin_scuff.js'), 'utf8').replace('#define GD_OFF 1', '') });
  doctor('both muds drawn', () => {}, { src: src.replace('AEROWX.aeroWxSetMud(THREE, GDX.G ? 0 : mudCoat);', 'AEROWX.aeroWxSetMud(THREE, mudCoat);') });
  console.log('GATE MUDCOAT selftest: ' + (bad.length ? 'FAIL (' + bad.join(', ') + ' stayed green)' : 'PASS (every doctored law went red)'));
  process.exit(bad.length ? 1 : 0);
}
const t0 = Date.now(), W = fresh();
const flown = { soft: rollCoat(W, 12), firm: rollCoat(W, 11), grass: rollCoat(W, 0) };
const fail = run(W, { flown, src });
for (const f of fail) console.log('  FAIL ' + f);
console.log('  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
console.log('GATE MUDCOAT: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
