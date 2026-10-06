#!/usr/bin/env node
// _gfx_check.js — GATE GFX: the graphics settings menu (G286) owns a saved
// choice and applies it to the world's handles - so the menu is tested as a
// contract over those handles, in a vm with stubs for every one of them.
//
//   node tools/_gfx_check.js   -> "GATE GFX: PASS|FAIL", exit 1 on FAIL
//
// 1. every preset resolves every option to one of its named steps
// 2. the pref round-trips: a saved choice is the choice at the next boot
// 3. applying a preset puts the preset's values on every handle
// 4. one option changed under a preset makes it `custom`; picking a
//    preset again rewrites every option
// 5. no pref = medium; a corrupt pref = medium
// 6. a density that does not change never re-grids the fill
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fails++; };

// ---- the stubs: every handle the menu drives, recording what it is told ----
function makeWindow(store) {
  const log = [];
  const rig = { shadowMap: 1024, farShadow: true, floor: 0.30, row: 'sunset' };
  const w = {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    requestAnimationFrame: () => 1,
    FLYDIY_AA: { _tier: 'full', setTier(t) { this._tier = t; log.push(['aa', t]); }, tier() { return this._tier; } },
    TREE_FILL: { _ng: 128, get() { return this._ng; }, set(ng) { this._ng = ng; log.push(['fill', ng]); return ng; } },
    TREE_LOD: { _b: [10, 30, 30], get() { return this._b.slice(); }, set(b) { this._b = b.slice(); log.push(['bands', b.join('/')]); } },
    WORLD_RIG: { get: () => Object.assign({}, rig),
                 set(o) { Object.assign(rig, o); log.push(['rig', JSON.stringify(o)]); },
                 row(n) { rig.row = n; rig.shadowMap = 2048; rig.floor = 0.30; log.push(['row', n]); } },
    WORLD: { sun: { castShadow: true } },
    log, rig,
  };
  w.window = w;
  return w;
}
function boot(store) {
  const w = makeWindow(store);
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'gfx_settings.js'), 'utf8');
  vm.runInNewContext(src, Object.assign({ window: w, setInterval: () => 0, clearInterval: () => {} }, w));
  return w;
}

console.log('GATE GFX');
// 1. the presets are complete
{
  const w = boot({});
  const G = w.GFX;
  let complete = true;
  for (const p in G.PRESETS) for (const o of G.OPTIONS) if (!o.free)
    if (!o.steps.some(s => s.v === G.PRESETS[p][o.k])) { complete = false; console.log('    ' + p + '.' + o.k + ' = ' + G.PRESETS[p][o.k] + ' is not a step'); }
  ok(complete, 'every preset resolves every option to a named step (' + Object.keys(G.PRESETS).length + ' presets, ' + G.OPTIONS.filter(o => !o.free).length + ' options; the free ones apart)');
}
// 1a. THE FRAME RATE (G586) is a FREE option: no preset's options carry it, and picking a cap leaves the preset what it
// was. G1295 (EVEN-30): its DEFAULT follows the preset - a hard 30 on every preset but ultra (auto) - until the player picks
// one; an old pref's 'auto' (the old default) takes the preset's, an old 60 / 30 / uncapped stays the player's
{
  const w = boot({});
  const G = w.GFX, o = G.OPTIONS.find(x => x.k === 'fps');
  ok(!!o && o.free && o.steps.map(x => x.v).join(',') === 'auto,60,30,off' && Object.keys(G.PRESETS).every(p => !('fps' in G.PRESETS[p])),
     'the frame rate: auto / 60 / 30 / uncapped, set by no preset');
  ok(G.get().fps === 30, "the frame rate's default is 30 on gamer (" + G.get().fps + ')');
  ok(G.set('preset', 'ultra').fps === 'auto' && G.set('preset', 'potato').fps === 30 && G.set('preset', 'current').fps === 30,
     'picking a preset brings its frame rate: ultra auto, the others 30');
  G.set('preset', 'gamer');
  const before = G.get().preset;
  const after = G.set('fps', 60);
  ok(after.fps === 60 && after.preset === before && after.fpsOwn === true, 'a 60 cap leaves the preset ' + before + ' (' + after.preset + ') and is the player’s');
  ok(G.set('preset', 'ultra').fps === 60 && G.set('preset', 'retro').fps === 60, "the player's frame rate survives a preset pick");
  const w2 = boot({ 'flydiy.gfx': JSON.stringify({ preset: 'gamer', pv: 3, fps: 'bogus' }) });
  ok(w2.GFX.get().fps === 30, 'a stored frame rate that is not a step reads the preset’s (30 on gamer: ' + w2.GFX.get().fps + ')');
  const m = (st, want, what) => { const g = boot({ 'flydiy.gfx': JSON.stringify(st) }).GFX.get(); ok(g.fps === want, what + ' (' + g.fps + ')'); };
  m({ preset: 'gamer', pv: 6, fps: 'auto' }, 30, "pv 6: gamer's stored 'auto' (the old default) becomes 30");
  m(Object.assign({}, G.PRESETS.ultra, { preset: 'ultra', pv: 6, fps: 'auto' }), 'auto', "pv 6: ultra's stored 'auto' stays auto");
  m({ preset: 'custom', pv: 6, fps: 'auto', aa: 'full', density: 200 }, 30, "pv 6: a custom mix's 'auto' becomes 30 (the user's near-ultra)");
  m({ preset: 'gamer', pv: 6, fps: 60 }, 60, 'pv 6: a stored 60 stays (the player’s)');
  m({ preset: 'gamer', pv: 6, fps: 'off' }, 'off', 'pv 6: a stored uncapped stays');
  m({ preset: 'gamer', pv: 7, fps: 'auto', fpsOwn: true }, 'auto', 'pv 7: a picked auto stays');
  m({ preset: 'ultra', pv: 2 }, 'auto', 'an old pref on ultra (no frame rate stored) reads auto');
}
// 1b. the five tiers (PERF 2026-09-23): named, labelled, gamer the default, and gamer IS the medium of before
{
  const w = boot({});
  const G = w.GFX;
  // (G1524, POTATO-DEEP: the laptop rung under potato - six tiers)
  ok(Object.keys(G.PRESETS).join(',') === 'laptop,potato,retro,current,gamer,ultra' && G.DEFAULT === 'gamer',
     'six tiers, laptop .. ultra, gamer the default (' + Object.keys(G.PRESETS).join(',') + ')');
  const OLD_MEDIUM = { ground: 'far1', terrain: 1, scale: 1, drawDist: 'vis', aa: 'msaa', density: 128, bands: 'near', shadows: 'full', canopy: 'on', rails: 'on', poles: 'on', lighting: 'sunset', tone: 'cineon', exposure: 1, colour: 'managed', glare: 'on', sway: 'on', mist: 'land', clouds: 'half', bloom: 'off', look: 'off', lens: 'off', rays: 'off', ao: 'off', eye: 'off', compositing: 'linear', water: 'simple', mirror: 'off' };
  OLD_MEDIUM.cover = 'full'; OLD_MEDIUM.scenery = 'full';   // G570's rows: gamer keeps the whole of both
  OLD_MEDIUM.bloom = 'soft';   // the default look (2026-09-23): the soft bloom from 'current' up
  OLD_MEDIUM.bands = 'mid';   // G1113 'minimum', G1114.2 'mid': gamer's trees whole to 50 m, the light rung to 120 m (TREES-NEAR, the user's call)
  ok(G.OPTIONS.every(o => G.PRESETS.gamer[o.k] === OLD_MEDIUM[o.k]), 'gamer is the medium of before, option for option (plus the far ground lean, G513; simple water and no mirror since 2026-10-03, the user)');
  const w2 = boot({ 'flydiy.gfx': JSON.stringify(Object.assign({ preset: 'medium' }, OLD_MEDIUM)) });
  ok(w2.GFX.get().preset === 'gamer', 'a choice saved as medium reads as gamer');
  ok(Object.keys(G.PRESETS).every(p => G.PRESET_LABEL[p]), 'every tier has its label');
  // the pv migration (G528, G551): an old pref ON a preset is that preset as it is now; an old custom mix keeps its options
  const w3 = boot({ 'flydiy.gfx': JSON.stringify({ preset: 'medium', scale: 1, bloom: 'off', aa: 'msaa', density: 128 }) });
  ok(w3.GFX.get().preset === 'gamer' && w3.GFX.get().scale === 1 && w3.GFX.get().bloom === 'soft', 'an old pref saved on medium reads as today\'s gamer (100 %, soft bloom)');
  const w4 = boot({ 'flydiy.gfx': JSON.stringify({ preset: 'custom', scale: 1, lighting: 'alps', density: 200 }) });
  ok(w4.GFX.get().scale === 1 && w4.GFX.get().lighting === 'alps' && w4.GFX.get().density === 200, 'an old custom mix keeps its options');
  const w5 = boot({ 'flydiy.gfx': JSON.stringify(Object.assign({}, OLD_MEDIUM, { preset: 'gamer', pv: 2, scale: 'auto' })) });
  ok(w5.GFX.get().preset === 'gamer' && w5.GFX.get().scale === 1, 'a pref saved on G528\'s gamer (auto by default) reads as today\'s gamer at 100 %');
  const w6 = boot({ 'flydiy.gfx': JSON.stringify({ preset: 'custom', pv: 3, scale: 'auto' }) });
  ok(w6.GFX.get().scale === 'auto', 'a current pref\'s auto is the player\'s choice and stays');
  ok(Object.keys(G.PRESETS).every(p => G.PRESETS[p].scale !== 'auto'), 'no tier turns the auto render scale on: it is the player\'s option (G551)');
  ok(G.OPTIONS.find(o => o.k === 'scale').steps.some(st => st.v === 'auto'), 'the auto render scale is in the menu');
  ok(typeof G.autoTier === 'undefined', 'no first-launch tier probe (G551: start in standard, no wait)');
}
// 5. no pref, corrupt pref
{
  const w = boot({});
  ok(w.GFX.get().preset === 'gamer', 'no pref boots on gamer (the default tier)');
  const w2 = boot({ 'flydiy.gfx': '{not json' });
  ok(w2.GFX.get().preset === 'gamer', 'a corrupt pref boots on gamer');
  const w3 = boot({ 'flydiy.gfx': JSON.stringify({ preset: 'retro', pv: 6, aa: 'nope', density: 5 }) });   // a current pref (pv 2) with values no step has
  ok(w3.GFX.get().aa === 'msaa' && w3.GFX.get().density === 128, 'unknown steps in the pref fall back to gamer’s');
}
// 3 + 4. applying, and custom
{
  const store = {};
  const w = boot(store);
  const G = w.GFX;
  G.onWorld();
  ok(w.FLYDIY_AA.tier() === 'msaa' && w.rig.shadowMap === 2048 && w.rig.farShadow === true && w.rig.floor === 0.30,
     'gamer at boot: smooth, 2048 map, far cascade, floor on');
  const nBefore = w.log.filter(e => e[0] === 'fill').length;
  ok(nBefore === 0, 'the boot did not re-grid a fill already at gamer’s density (' + nBefore + ' re-grids)');
  G.set('preset', 'retro');
  ok(w.FLYDIY_AA.tier() === 'off' && w.TREE_FILL.get() === 100 && w.TREE_LOD.get().join('/') === '10/30/30' &&
     w.rig.shadowMap === 2048 && w.rig.worldShadow === false && w.rig.farShadow === false && w.rig.floor === 1.0 && w.WORLD.sun.castShadow === true,
     'retro (the low of before): off (the 4x tier is an option: G1250 kept no preset default - current had no MSAA, 4x would ADD 138 MiB), 100, impostor-first bands (10/30), shadows near (G655: the craft map alone at 1024, the sun map of the world empty), no cascade, floor off, sun still casts (no relink)');
  G.set('shadows', 'off');
  ok(G.get().preset === 'custom', 'one option changed under a preset makes it custom');
  ok(w.WORLD.sun.castShadow === false && w.rig.farShadow === false, 'shadows off: the sun stops casting and the cascade is off');
  G.set('preset', 'ultra');
  const s = G.get();
  ok(s.preset === 'ultra' && s.shadows === 'ultra' && s.aa === 'full' && s.density === 200,
     'picking a preset again rewrites every option');
  ok(w.WORLD.sun.castShadow === true && w.rig.shadowMap === 4096 && w.TREE_FILL.get() === 200 && w.FLYDIY_AA.tier() === 'full',
     'ultra: the sun casts again, 4096 map, 200, smoothest');
  G.set('lighting', 'alps');
  ok(w.rig.row === 'alps' && w.rig.shadowMap === 4096, 'a lighting row change re-asserts the shadow choice over the row’s own');
  // 2. the pref round-trips
  const w2 = boot(store);
  const t = w2.GFX.get();
  ok(t.preset === 'custom' && t.lighting === 'alps' && t.shadows === 'ultra' && t.density === 200,
     'the saved choice is the choice at the next boot (' + JSON.stringify(t) + ')');
  w2.GFX.onWorld();
  ok(w2.rig.row === 'alps' && w2.TREE_FILL.get() === 200 && w2.FLYDIY_AA.tier() === 'full', 'and it is applied to the handles at that boot');
}
// 6. the restart contract is stated
{
  const w = boot({});
  const r = w.GFX.restart();
  ok(r.anything === 'no restart' && Object.keys(r).length >= 7, 'every option states what changing it costs; nothing needs a restart');
}

// 7. G760: THE GROUPS - the rails' folds (the user: "The graphics option is too long and lacks structure"). Every
//    option in exactly one of the seven groups PLAYTEST-2026-09-26 §3 names, and NO ROW LOST: the rows (and every
//    pill under them) the menu mounts as the one flat list it was, counted, against the rows the grouped menu mounts
//    with every fold open plus the three rows the hosts now place themselves (the map, the fps meter, the flight log)
{
  // the 32 options of the menu the day it was regrouped (base 5d55dbf) - a row that leaves OPTIONS fails here
  const BASE = ['fps', 'aa', 'scale', 'density', 'bands', 'shadows', 'canopy', 'glare', 'sway', 'drawDist', 'ground', 'terrain',
                'mist', 'clouds', 'bloom', 'look', 'lens', 'rays', 'ao', 'eye', 'cover', 'scenery', 'town', 'rails', 'poles',
                'water', 'mirror', 'lighting', 'compositing', 'tone', 'exposure', 'colour'];
  const w = boot({});
  w.FLYDIY_WORLDS = [{ id: 'none', name: 'the analytic world' }, { id: 'jolene', name: 'Jolene' }]; w.FLYDIY_WORLD = 'jolene';
  w.STORAGE = { line: () => 'build x', checkServer: () => Promise.resolve(), measure: () => Promise.resolve(), refresh() {} };
  w.FLIGHT_REC = { mount(b, H) { this.mountMeter(b, H); this.mountLog(b, H); },
                   mountMeter(b, H) { H.row(b, 'fps meter'); H.pills(b, [{ label: 'off' }, { label: 'on' }], () => false, () => {}); },
                   mountLog(b, H) { H.row(b, 'flight log'); H.note(b, ''); H.pills(b, [{ label: 'save log' }, { label: 'previous session' }], () => false, () => {}); } };
  const G = w.GFX;
  const keys = G.OPTIONS.map(o => o.k);
  ok(BASE.every(k => keys.includes(k)), 'every option of the menu as it was regrouped is still an option (' + BASE.length + ' of ' + keys.length + ')' +
     (BASE.some(k => !keys.includes(k)) ? ' - lost: ' + BASE.filter(k => !keys.includes(k)).join(', ') : ''));
  const inG = [].concat(...G.GROUPS.map(g => g.rows));
  const twice = inG.filter((k, i) => inG.indexOf(k) !== i), none = keys.filter(k => !inG.includes(k)), alien = inG.filter(k => !keys.includes(k));
  ok(!twice.length && !none.length && !alien.length, 'every option in exactly one group' +
     (twice.length ? ' - twice: ' + twice.join(', ') : '') + (none.length ? ' - in none: ' + none.join(', ') : '') + (alien.length ? ' - not an option: ' + alien.join(', ') : ''));
  ok(G.GROUPS.map(g => g.label).join('|') === 'performance|light & shadows|terrain & vegetation|water|sky|post-fx|town',
     'the seven groups of PLAYTEST-2026-09-26 §3, in its order: ' + G.GROUPS.map(g => g.label).join(' · '));
  ok(G.GROUPS[0].rows.slice(0, 3).join() === 'fps,scale,aa', 'performance carries the frame rate, the scale and the smoothing (the preset heads it)');
  const collect = grouped => {
    const got = { rows: [], pills: [], secs: [] };
    const el = () => ({ appendChild() {}, classList: { add() {} }, set textContent(v) {}, get isConnected() { return false; } });
    const H = { row: (h, l) => { got.rows.push(l); return el(); }, pills: (h, list) => { for (const o of list) got.pills.push(o.label); return el(); },
                note: () => el() };
    if (grouped) H.section = (h, k) => { got.secs.push(k); return el(); };
    return { got, H };
  };
  const A = collect(false); G.mount({}, A.H);
  const B = collect(true); G.mount({}, B.H); G.mountWorld({}, B.H); w.FLIGHT_REC.mountMeter({}, B.H); w.FLIGHT_REC.mountLog({}, B.H);
  const norm = a => a.slice().sort().join('\n');
  ok(A.got.rows.length === B.got.rows.length && norm(A.got.rows) === norm(B.got.rows),
     'no row lost: ' + A.got.rows.length + ' rows flat, ' + B.got.rows.length + ' grouped (' + B.got.secs.length + ' folds) + the map, the meter and the log placed by the hosts' +
     (norm(A.got.rows) !== norm(B.got.rows) ? ' - flat only: ' + A.got.rows.filter(r => !B.got.rows.includes(r)).join(', ') + '; grouped only: ' + B.got.rows.filter(r => !A.got.rows.includes(r)).join(', ') : ''));
  ok(A.got.pills.length === B.got.pills.length && norm(A.got.pills) === norm(B.got.pills), 'and no pill: ' + A.got.pills.length + ' flat, ' + B.got.pills.length + ' grouped');
  ok(B.got.secs.join() === G.GROUPS.map(g => 'gfx.' + g.k).join(), 'a host with sections gets one per group, keyed gfx.<group>');
}

// 8. G1210 (WELCOME, FRIENDLY-WELCOME-BUDGETS.md §3 layer 1): src/viewer/welcome.js's pure half in a vm - the GPU table on
//    sample names, the memory class, the rule (the lower of the two), the device gate's detection on stubbed navigators,
//    the rigs never seeing either screen - and its pick reaching the menu the way ?gfx= does
{
  const wsrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'welcome.js'), 'utf8');
  const ww = { navigator: {} }; ww.window = ww;
  vm.runInNewContext(wsrc, Object.assign({ window: ww }, ww));
  const WL = ww.WELCOME, G0 = boot({}).GFX;
  ok(!!WL && WL.ORDER.join() === Object.keys(G0.PRESETS).join(), "welcome.js's preset order is the menu's (" + (WL && WL.ORDER.join()) + ')');
  ok(!ww.FLYDIY_WELCOME, 'with no document it shows nothing and holds nothing');
  const GPUS = [
    ['ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'laptop', 'Intel(R) UHD Graphics 620'],
    ['ANGLE (Intel, Intel(R) HD Graphics 4000 Direct3D11 vs_5_0 ps_5_0, D3D11)', 'laptop'],
    ['Intel(R) Iris(R) Xe Graphics', 'potato'],
    ['Mesa Intel(R) UHD Graphics 630 (CFL GT2)', 'laptop'],
    ['ANGLE (NVIDIA, NVIDIA GeForce GTX 660 (0x000011C0) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'potato', 'NVIDIA GeForce GTX 660'],
    ['NVIDIA GeForce GTX 970/PCIe/SSE2', 'potato'],
    ['ANGLE (NVIDIA, NVIDIA GeForce GTX 980 Ti Direct3D11 vs_5_0 ps_5_0, D3D11)', 'potato'],
    ['Adreno (TM) 650', 'laptop'], ['Mali-G57 MC2', 'laptop'], ['ANGLE (Qualcomm, Adreno (TM) 618, OpenGL ES 3.2)', 'laptop'],
    ['ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 3GB (0x00001C02) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'retro'],
    ['NVIDIA GeForce GTX 1080 Ti', 'retro'], ['GeForce GTX 1660 SUPER', 'retro'],
    ['ANGLE (AMD, Radeon RX 580 Series (0x000067DF) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'retro'], ['AMD Radeon RX 470', 'retro'],
    ['NVIDIA GeForce RTX 2060', 'current'], ['NVIDIA GeForce RTX 2080 Ti', 'current'],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'current'], ['NVIDIA GeForce RTX 3060 Ti', 'current'],
    ['NVIDIA GeForce RTX 3070', 'gamer'],
    ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 (0x00002206) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'gamer', 'NVIDIA GeForce RTX 3080'],
    ['NVIDIA GeForce RTX 4090', 'gamer'], ['NVIDIA GeForce RTX 4060', 'current'],
    ['AMD Radeon RX 6700 XT', 'current'], ['AMD Radeon RX 6800 XT', 'gamer'], ['AMD Radeon RX 7900 XTX', 'gamer'],
    ['AMD Radeon(TM) Graphics', 'laptop'],
    ['Google SwiftShader', 'potato'], ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', 'potato'],
    ['Apple M2 Pro', 'current'], ['', 'current'], ['Some Future Card 9000', 'current'],
  ];
  const bad = GPUS.filter(([n, c, clean]) => WL.gpuClass(n).cls !== c || (clean && WL.cleanGpu(n) !== clean));
  for (const [n, c] of bad) console.log('    ' + JSON.stringify(n) + ' -> ' + WL.gpuClass(n).cls + ' (' + WL.cleanGpu(n) + '), want ' + c);
  ok(!bad.length, 'the GPU table on ' + GPUS.length + ' sample names: Intel HD/UHD, AMD integrated, Mali/Adreno laptop; Iris Xe, GTX 6xx-9xx potato; GTX 10xx, RX 4xx/5xx retro; RTX 20xx / below a 3070 current; 3070+ / RX 6800+ gamer; unknown current');
  ok(WL.memClass({ mobile: true, mem: 8 }).cls === 'potato' && WL.memClass({ mem: 4 }).cls === 'potato' && WL.memClass({ mem: 2 }).cls === 'potato' &&
     WL.memClass({ mem: 8 }).cls === 'gamer' && WL.memClass({ mem: 0 }).cls === 'gamer', 'the memory class: a phone or 4 GB or less caps at potato; 8 GB, or nothing said, caps nothing');
  // the decision: (env, store, query, navigator)
  const store = o => ({ getItem: k => (o && k in o ? o[k] : null) });
  const desk = (gpu, x) => Object.assign({ gpu, webgl2: true, mem: 8, threads: 16, mobile: false, uaMobile: false, ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140', coarse: false, fine: true, minSide: 1440 }, x || {});
  const D = (env, st, q, nav) => WL.decide(env, store(st), q || '', nav || { userAgent: 'Mozilla/5.0 Chrome/140' });
  ok(D(desk('NVIDIA GeForce RTX 3080')).screen === 'welcome' && D(desk('NVIDIA GeForce RTX 3080')).suggest === 'gamer', 'a first visit on a 3080 with 8 GB: the welcome, gamer suggested');
  ok(D(desk('NVIDIA GeForce RTX 3080', { mem: 4 })).suggest === 'potato', 'the lower wins: a 3080 with 4 GB of memory is potato');
  ok(D(desk('NVIDIA GeForce GTX 1060 3GB', { mem: 8 })).suggest === 'retro', '...and a GTX 1060 with 8 GB is retro (the card the lower)');
  ok(D(desk('Intel(R) UHD Graphics 620', { mem: 0 })).suggest === 'laptop', '...and an Intel UHD with no memory said is laptop (G1524)');
  const seen = { 'flydiy.welcome': JSON.stringify({ gpu: 'NVIDIA GeForce RTX 3080', preset: 'ultra' }) };
  ok(D(desk('ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 (0x00002206) Direct3D11 vs_5_0 ps_5_0, D3D11)'), seen).screen === 'none', 'remembered per card: the same card (its ANGLE name) is not asked again');
  ok(D(desk('NVIDIA GeForce RTX 4090'), seen).screen === 'welcome', '...a new card is');
  ok(D(desk('NVIDIA GeForce RTX 3080'), { 'flydiy.gfx': '{"preset":"retro"}' }).screen === 'none' && D(desk('NVIDIA GeForce RTX 3080'), { 'flydiy.gfx': '{"preset":"retro"}' }).adopt,
     "the player's choice wins: a preset already saved in the menu is kept, no welcome (the card adopted)");
  ok(D(desk('NVIDIA GeForce RTX 3080'), {}, '?gfx=potato').screen === 'none', '?gfx= skips it');
  ok(D(desk('NVIDIA GeForce RTX 3080'), seen, '?welcome=1').screen === 'welcome', '?welcome=1 forces it');
  // A0 2026-10-03: the box's rigs (headed, webdriver off) load from localhost - the welcome held train 27's whole gate
  const DH = (env, q, host) => WL.decide(env, store({}), q || '', { userAgent: 'Mozilla/5.0 Chrome/140' }, host);
  ok(DH(desk('NVIDIA GeForce RTX 3080'), '', 'localhost').screen === 'none' && DH(desk('NVIDIA GeForce RTX 3080'), '', '127.0.0.1').screen === 'none', 'localhost skips it (the rigs, a dev server)');
  ok(DH(desk('NVIDIA GeForce RTX 3080'), '?welcome=1', 'localhost').screen === 'welcome', '...?welcome=1 still forces it there');
  ok(DH(desk('NVIDIA GeForce RTX 3080'), '', 'degaror.github.io').screen === 'welcome', '...and Pages still shows it');
  // the device gate on stubbed navigators
  const phone = desk('Adreno (TM) 650', { uaMobile: true, coarse: true, fine: false, minSide: 412, mem: 8 });
  const ipad = desk('Apple GPU', { uaMobile: undefined, ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605', coarse: true, fine: false, minSide: 820, mem: 0 });
  const touchLaptop = desk('Intel(R) Iris(R) Xe Graphics', { coarse: true, fine: true, minSide: 900 });
  const firefoxAndroid = desk('Mali-G78', { uaMobile: undefined, ua: 'Mozilla/5.0 (Android 14; Mobile; rv:130.0) Gecko/130.0 Firefox/130.0', minSide: 0 });
  ok(!!WL.mobileWhy(phone) && !!WL.mobileWhy(ipad) && !!WL.mobileWhy(firefoxAndroid) && !WL.mobileWhy(touchLaptop) && !WL.mobileWhy(desk('x')),
     'the phone / tablet test: userAgentData.mobile, an iPad (a coarse pointer on 820 px, no mouse), Firefox on Android by its UA - and not a touch laptop nor a desktop');
  ok(D(phone).screen === 'gate' && D(ipad).screen === 'gate', 'a phone and a tablet get the device gate');
  ok(D(desk('', { webgl2: false })).screen === 'gate' && /WebGL2/.test(D(desk('', { webgl2: false })).why), 'a browser without WebGL2 gets the device gate');
  ok(D(phone, { 'flydiy.welcome': JSON.stringify({ gpu: 'Adreno (TM) 650', preset: 'potato', tried: true }) }).screen === 'none', '"try anyway" is remembered (no gate the next time)');
  // G2100 (MOBILE-GARAGE 1): "Build on this phone" is remembered too, as the phone profile - and only on a phone
  { const phoneRec = { 'flydiy.welcome': JSON.stringify({ gpu: 'Adreno (TM) 650', preset: 'laptop', tried: true, profile: 'phone' }) };
    const dp = D(phone, phoneRec), dd = D(desk('NVIDIA GeForce RTX 3080'), phoneRec), dt = D(phone, { 'flydiy.welcome': JSON.stringify({ gpu: 'Adreno (TM) 650', preset: 'potato', tried: true }) });
    ok(dp.screen === 'none' && dp.profile === 'phone' && !dd.profile && dt.profile === undefined && D(desk('NVIDIA GeForce RTX 3080')).profile === undefined,
       '"build on this phone" remembered: the phone profile again with no gate; a desktop, "try anyway" and a first visit never get it'); }
  // THE RIGS NEVER SEE EITHER SCREEN
  const rigs = [{ webdriver: true, userAgent: 'Mozilla/5.0 Chrome/140' }, { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/140.0' }];
  ok(rigs.every(n => D(desk('NVIDIA GeForce RTX 3080'), {}, '', n).screen === 'none' && D(phone, {}, '', n).screen === 'none' && D(desk('', { webgl2: false }), {}, '', n).screen === 'none'),
     'the rigs (navigator.webdriver, HeadlessChrome) never see the welcome nor the gate - a phone or no WebGL2 included');
  ok(WL.isRig(rigs[0]) && WL.isRig(rigs[1]) && !WL.isRig({ userAgent: 'Mozilla/5.0 Chrome/140' }), "the rig test is gfx_settings.js's (G528): webdriver or HeadlessChrome");
  // the pick reaches the menu the way ?gfx= does, and ?gfx= wins over it
  const wp = makeWindow({}); wp.WELCOME = { pick: 'potato', RIG: false, recheck: () => Promise.resolve('retro') };
  const gsrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'gfx_settings.js'), 'utf8');
  vm.runInNewContext(gsrc, Object.assign({ window: wp, setInterval: () => 0, clearInterval: () => {} }, wp));
  ok(wp.GFX.get().preset === 'potato' && JSON.parse(wp.localStorage.getItem('flydiy.gfx')).preset === 'potato', "the welcome's pick is the menu's preset, saved");
  const wq = makeWindow({}); wq.WELCOME = { pick: 'potato', RIG: false }; wq.location = { search: '?gfx=retro' };
  vm.runInNewContext(gsrc, Object.assign({ window: wq, setInterval: () => 0, clearInterval: () => {} }, wq));
  ok(wq.GFX.get().preset === 'retro', '?gfx= wins over a pick (' + wq.GFX.get().preset + ')');
  const rows = []; const e = () => ({ appendChild() {}, classList: { add() {} }, set textContent(v) {}, get isConnected() { return false; } });
  wp.GFX.mount({}, { row: (h, l) => { rows.push(l); return e(); }, pills: () => e(), note: () => e() });
  const rows2 = []; wp.GFX.mount({}, { row: (h, l) => { rows2.push(l); return e(); }, pills: () => e(), note: () => e(), noReload: true });
  ok(rows.includes('this computer') && !rows2.includes('this computer'), 'the menu carries "re-check my computer" (not on the loading screen)');
  // the page: the welcome's block right after boot.js's, ahead of the vendor; the island loader waits on it
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const iB = html.indexOf('window.BOOT = B'), iW = html.indexOf('W.WELCOME = {'), iV = html.indexOf('function makePilot('), iL = html.indexOf('return window.FLYDIY_WELCOME;');
  ok(iB > 0 && iW > iB && iW < iV && iL > iW && iL < html.indexOf("fetch('src/core/world_packs.json')"),
     'index.html: welcome.js after boot.js and before the core; the island loader holds on FLYDIY_WELCOME before its first fetch');
}

// 9. G1460 (SOFT-GPU) THE SOFTWARE RUNG IS INERT ON A GRAPHICS CARD. welcome.js's isSoftware on the GPU table (only the
//    software renderers), gfx_settings.js's GFX.soft() null on every card - and then the resolved options, the saved
//    choice and the presets table are, key for key, a boot without the rung's code; on SwiftShader it starts on potato,
//    and a player's saved choice, ?gfx= and ?soft=0 win over it. Every place the game changes for the rung asks
//    GFX.soft() in a conditional (listed and counted below) - so a null answer is the old path, by construction.
{
  const wsrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'welcome.js'), 'utf8');
  const ww = { navigator: {} }; ww.window = ww;
  vm.runInNewContext(wsrc, Object.assign({ window: ww }, ww));
  const WL = ww.WELCOME;
  const SW = ['Google SwiftShader', 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'llvmpipe (LLVM 15.0.7, 256 bits)', 'Mesa softpipe', 'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)'];
  const HW = ['ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 (0x00002206) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'NVIDIA GeForce GTX 660/PCIe/SSE2',
    'ANGLE (Intel, Intel(R) UHD Graphics 620 (0x00005917) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'AMD Radeon RX 6800 XT', 'Apple M2', 'Adreno (TM) 650', 'Mali-G57 MC2', ''];
  ok(SW.every(n => WL.isSoftware(n)) && HW.every(n => !WL.isSoftware(n)), 'isSoftware: the ' + SW.length + ' software renderers yes, the ' + HW.length + ' cards (an empty name included) no');
  ok(SW.every(n => WL.gpuClass(n).cls === 'potato'), "...and gpuClass still classes them potato (G1210's table, through isSoftware)");
  const gsrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'gfx_settings.js'), 'utf8');
  const bootG = (store, welcome, search) => { const w = makeWindow(store); if (welcome) w.WELCOME = welcome; if (search) w.location = { search };
    vm.runInNewContext(gsrc, Object.assign({ window: w, setInterval: () => 0, clearInterval: () => {} }, w)); return w; };
  const card = gpu => ({ RIG: true, SOFT: WL.isSoftware(gpu), env: { gpu }, pick: null });
  const CASES = [[{}, ''], [{}, '?gfx=potato'], [{}, '?gfx=ultra'], [{ 'flydiy.gfx': JSON.stringify({ preset: 'retro', pv: 6 }) }, ''],
    [{ 'flydiy.gfx': JSON.stringify({ preset: 'custom', pv: 6, shadows: 'off', aa: 'msaa4' }) }, ''], [{ 'flydiy.gfx': '{corrupt' }, '']];
  let same = true, nulls = true;
  for (const gpu of HW) for (const [st, q] of CASES) {
    const A = bootG(Object.assign({}, st), null, q), B = bootG(Object.assign({}, st), card(gpu), q);
    if (B.GFX.soft() !== null) nulls = false;
    if (JSON.stringify(A.GFX.get()) !== JSON.stringify(B.GFX.get()) || A.localStorage.getItem('flydiy.gfx') !== B.localStorage.getItem('flydiy.gfx')
        || JSON.stringify(A.GFX.PRESETS) !== JSON.stringify(B.GFX.PRESETS)) { same = false; console.log('    differs: ' + gpu + ' ' + JSON.stringify(st) + ' ' + q); }
  }
  ok(nulls, 'GFX.soft() is null on every card (' + HW.length + ' names x ' + CASES.length + ' starts)');
  ok(same, 'on a card the resolved options, the saved choice and the presets table are those of a boot without the rung (' + HW.length * CASES.length + ' boots compared)');
  const S0 = bootG({}, card(SW[1]), '');
  const PICK = o => Object.fromEntries(S0.GFX.OPTIONS.filter(x => !x.free).map(x => [x.k, o[x.k]]));
  ok(S0.GFX.soft() && S0.GFX.soft().tier === 'software' && S0.GFX.get().preset === 'potato' && JSON.stringify(PICK(S0.GFX.get())) === JSON.stringify(PICK(S0.GFX.PRESETS.potato)),
     'on SwiftShader with nothing chosen: the software rung, on potato\'s options (' + (S0.GFX.soft() && S0.GFX.soft().tier) + ', ' + S0.GFX.get().preset + ')');
  ok(S0.localStorage.getItem('flydiy.gfx') === null, '...and nothing saved for it (the rung is not a player\'s choice)');
  ok(bootG({ 'flydiy.gfx': JSON.stringify({ preset: 'gamer', pv: 6 }) }, card(SW[1]), '').GFX.get().preset === 'gamer', 'a saved choice wins over the rung (gamer stays gamer)');
  ok(bootG({}, card(SW[1]), '?gfx=retro').GFX.get().preset === 'retro', '?gfx= wins over the rung');
  ok(bootG({}, card(SW[1]), '?soft=0').GFX.soft() === null && bootG({}, card(SW[1]), '?soft=0').GFX.get().preset === 'gamer', '?soft=0 turns the rung off (the default preset, as before G1460)');
  ok(!!bootG({}, card(HW[0]), '?soft=1').GFX.soft(), '?soft=1 turns it on over a card (A0\'s A/B on the box)');
  ok(bootG({}, null, '').GFX.soft() === null, 'no welcome.js (a harness, an old page): no rung');
  // every site the rung changes asks GFX.soft() in a conditional, nowhere else
  const SITES = { 'boot.js': 1, 'render_world.js': 1, 'hangar.js': 1, 'app.js': 1, 'aa_resolve.js': 1 };   // train 31: the cover ring's re-apply runs on every machine now (the user: fix for all)
  const sites = [];
  for (const f of Object.keys(SITES)) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', f), 'utf8');
    src.split('\n').forEach((l, i) => { if (/GFX\.soft\(\)/.test(l) && !/^\s*\/\//.test(l)) sites.push([f, i + 1, /GFX\.soft && [\w.]*GFX\.soft\(\)\s*(\)|&&|\?|;)/.test(l)]); });
  }
  const per = f => sites.filter(s => s[0] === f).length;
  ok(sites.every(s => s[2]) && Object.keys(SITES).every(f => per(f) >= SITES[f]),
     'every rung site is a conditional on GFX.soft() (' + sites.map(s => s[0] + ':' + s[1]).join(', ') + ')');
}

// 10. POTATO-DEEP (G1520-G1529): THE DESKTOP PRESETS UNTOUCHED, POTATO AND THE LAPTOP RUNG UNDER IT
{
  // the rows and the build budgets of retro .. ultra as train 31 shipped them (the user: "desktop presets must not change at all")
  const FROZEN = {"retro":{"ground":"lean","scale":0.85,"cover":"lean","scenery":"lean","drawDist":"vis","terrain":2,"aa":"off","density":100,"bands":"near","shadows":"near","canopy":"off","rails":"on","poles":"off","glare":"on","sway":"off","mist":"on","clouds":"off","water":"simple","mirror":"off","lighting":"sunset","tone":"cineon","exposure":1,"colour":"managed","bloom":"off","look":"off","lens":"off","rays":"off","ao":"off","eye":"off","compositing":"linear"},"current":{"ground":"far1","scale":1,"cover":"full","scenery":"full","drawDist":"vis","terrain":2,"aa":"off","density":128,"bands":"near","shadows":"full","canopy":"on","rails":"on","poles":"on","glare":"on","sway":"on","mist":"on","clouds":"half","water":"simple","mirror":"off","lighting":"sunset","tone":"cineon","exposure":1,"colour":"managed","bloom":"soft","look":"off","lens":"off","rays":"off","ao":"off","eye":"off","compositing":"linear"},"gamer":{"ground":"far1","scale":1,"cover":"full","scenery":"full","drawDist":"vis","terrain":1,"aa":"msaa","density":128,"bands":"mid","shadows":"full","canopy":"on","rails":"on","poles":"on","glare":"on","sway":"on","mist":"land","clouds":"half","water":"simple","mirror":"off","lighting":"sunset","tone":"cineon","exposure":1,"colour":"managed","bloom":"soft","look":"off","lens":"off","rays":"off","ao":"off","eye":"off","compositing":"linear"},"ultra":{"ground":"full","scale":1,"cover":"full","scenery":"full","drawDist":"vis","terrain":1,"aa":"full","density":200,"bands":"mid","shadows":"ultra","canopy":"on","rails":"on","poles":"on","glare":"on","sway":"on","mist":"banks","clouds":"full","water":"full","mirror":"off","lighting":"sunset","tone":"cineon","exposure":1,"colour":"managed","bloom":"soft","look":"off","lens":"off","rays":"off","ao":"off","eye":"off","compositing":"linear"}};
  // (G1529, A0's call 2026-10-05: retro's BUILD budget moved - no flown bake - after the user's i5-9300H / GTX 1660 Ti laptop loaded
  // the garage in 120.5 s on retro (the bake 38.5 s + 31.3 s at the roll-out); townBoot stays 4000 (1500 streamed houses into the
  // taxi: 217-250 ms hitches); retro's drawn ROWS are untouched, current / gamer / ultra's budgets too)
  const FROZEN_B = {"retro":{"heapMB":1500,"mipSkip":0,"townBoot":4000,"townReach":6000,"parked":true,"forestK":1,"flownBake":false},"current":{"heapMB":1500,"mipSkip":0,"townBoot":4000,"townReach":6000,"parked":true,"forestK":1},"gamer":{"heapMB":2000,"mipSkip":0,"townBoot":4000,"townReach":6000,"parked":true,"forestK":1},"ultra":{"heapMB":2000,"mipSkip":0,"townBoot":4000,"townReach":6000,"parked":true,"forestK":1}};
  const G = boot({}).GFX;
  ok(['retro', 'current', 'gamer', 'ultra'].every(k => JSON.stringify(G.PRESETS[k]) === JSON.stringify(FROZEN[k])), 'retro, current, gamer, ultra: every row as train 31 shipped it');
  ok(['retro', 'current', 'gamer', 'ultra'].every(k => JSON.stringify(G.BUDGETS[k]) === JSON.stringify(FROZEN_B[k])), '...and their build budgets (none of the new levers; retro: G1529 no flown bake - the user’s laptop load)');
  ok(G.PRESETS.potato.ground === 'plain' && G.PRESETS.laptop.ground === 'plain' && G.PRESETS.retro.ground === 'lean', "potato and laptop draw the plain ground; retro keeps 'lean'");
  const BP = G.BUDGETS.potato, BL = G.BUDGETS.laptop;
  ok(BP.impTile === 64 && BP.aeroAtlas === 2048 && BP.flownBake === false && BP.shedLamps === false && BP.shedGlass === false && BP.msaa === undefined,
     "potato builds: impostor tile 64, aero atlas 2048, no flown bake, no lamp maps, no shed glass, the tier's own MSAA");
  ok(BL.msaa === 0 && BL.townReach < BP.townReach && BL.forestK < BP.forestK && G.PRESETS.laptop.scale === 0.5 && G.PRESETS.laptop.terrain >= G.PRESETS.potato.terrain && G.PRESETS.potato.terrain === 6,
     'laptop builds and draws less again: no target MSAA, the town and the forest nearer, half the resolution; both on the rough terrain (G1525)');
  // the pref's pv 8: a player ON potato (saved before this session: the lean ground) reads potato as it is now, not custom
  const old = { preset: 'potato', pv: 7, fps: 30, ground: 'lean', scale: 0.67, cover: 'off', scenery: 'low', terrain: 3 };
  const wp = boot({ 'flydiy.gfx': JSON.stringify(old) });
  ok(wp.GFX.get().preset === 'potato' && wp.GFX.get().ground === 'plain' && wp.GFX.get().pv === 8, 'a potato saved at pv 7 reads potato, the plain ground (pv 8)');
  const wg = boot({ 'flydiy.gfx': JSON.stringify(Object.assign({}, FROZEN.gamer, { preset: 'gamer', pv: 7, fps: 30 })) });
  ok(wg.GFX.get().preset === 'gamer' && Object.keys(FROZEN.gamer).every(k => wg.GFX.get()[k] === FROZEN.gamer[k]), '...a gamer saved at pv 7 reads gamer, every row the same');
  const wc = boot({ 'flydiy.gfx': JSON.stringify(Object.assign({}, FROZEN.gamer, { preset: 'custom', pv: 7, fps: 30, shadows: 'off' })) });
  ok(wc.GFX.get().preset === 'custom' && wc.GFX.get().shadows === 'off', '...a custom mix keeps its rows');
  // the live hooks: the plain ground (the splat's plain()), the shed glass (FLYDIY_SHED), the MSAA cap (FLYDIY_AA.setMsaaCap)
  const hook = q => { const w = makeWindow({}); const calls = { plain: [], msaa: [] };
    let pl = false; calls.reload = 0;   // the splat's plain state (a real page builds it as the budget's row says)
    w.WORLD.ground = { splat: () => ({ blend() {}, plain: v => { if (v === undefined) return pl; calls.plain.push(v); pl = !!v; return pl; } }) };
    w.location = Object.assign({ search: '', reload: () => { calls.reload++; } }, w.location || {});
    const glass = { isMeshPhysicalMaterial: true, transmission: 0.9 }; w.FLYDIY_SHED = () => ({ mats: { glass } }); calls.glass = glass;
    w.FLYDIY_AA.setMsaaCap = n => { calls.msaa.push(n); return n; };
    if (q) w.location.search = q;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'gfx_settings.js'), 'utf8'), Object.assign({ window: w, setInterval: () => 0, clearInterval: () => {} }, w));
    w.GFX.onWorld(); return { w, calls }; };
  const hp = hook('?gfx=potato'), hg = hook(''), hl = hook('?gfx=laptop');
  ok(hp.calls.plain[0] === true && hg.calls.plain[0] === false && hl.calls.plain[0] === true, 'the plain ground reaches the splat: potato and laptop plain, gamer not');
  ok(hp.calls.glass.transmission === 0 && hg.calls.glass.transmission === 0.9, "the shed's glass: no transmission on potato, gamer's as it was");
  hp.w.GFX.set('preset', 'gamer');
  // G1531: both ways LIVE, no reload (the root fix: render_world's ground hook, the same uniforms in every state - GATE SPLAT)
  ok(hp.calls.reload === 0 && hp.calls.plain[hp.calls.plain.length - 1] === false && hp.calls.glass.transmission === 0.9, '...potato -> gamer: the textured ground and the glass back LIVE (no reload, G1531)');
  { const h2 = hook('?gfx=gamer'); h2.w.GFX.set('ground', 'plain'); h2.w.GFX.set('ground', 'lean'); ok(h2.calls.reload === 0 && h2.calls.plain.slice(-2).join() === 'true,false', '...textured -> plain -> textured, live both ways'); }
  ok(hl.calls.msaa[0] === 0 && hg.calls.msaa.length === 0 && hp.calls.msaa.length === 0, 'the MSAA cap: laptop 0; potato and gamer never set one');
  hl.w.GFX.set('preset', 'gamer');
  ok(hl.calls.msaa[hl.calls.msaa.length - 1] === null, '...laptop -> gamer lifts it');
  // G1526 (A0, train 32: the 'town' row's default becomes 'all'): potato, laptop and the software rung never build Metlakatla
  // (the row is set live: a saved 'town' does not reload into the menu on train 31 - S has no 'town' key when the pref is read;
  // reported to A0 for G1408)
  const town = (pref, q) => { const w = makeWindow(pref ? { 'flydiy.gfx': JSON.stringify(pref) } : {}); if (q) w.location = { search: q };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'gfx_settings.js'), 'utf8'), Object.assign({ window: w, setInterval: () => 0, clearInterval: () => {} }, w));
    if (pref && pref.town) w.GFX.set('town', pref.town);
    return w.GFX.townAll(); };
  ok(G.BUDGETS.potato.town === 'nearby' && G.BUDGETS.laptop.town === 'nearby', "potato's and laptop's budgets cap the town at 'nearby'");
  ok(G.BUDGETS.potato.patchTolPx === 6 && G.BUDGETS.laptop.patchTolPx === 6, "G1528: potato's and laptop's premises patch at 6 px (the taxi's largest owner: 780 k -> 205 k triangles; the sink and the pavement tolerance in render_premises)");
  ok(town(Object.assign({}, G.PRESETS.potato, { preset: 'potato', pv: 8, town: 'all' })) === false && town(Object.assign({}, G.PRESETS.laptop, { preset: 'laptop', pv: 8, town: 'all' })) === false
     && town({ town: 'all', pv: 8 }, '?gfx=potato') === false && town({ town: 'all', pv: 8 }, '?gfx=laptop') === false,
     "...the row at 'all' builds no Metlakatla on potato or laptop (saved or ?gfx=)");
  ok(town(Object.assign({}, FROZEN.gamer, { preset: 'gamer', pv: 8, town: 'all' })) === true && town(Object.assign({}, FROZEN.gamer, { preset: 'gamer', pv: 8, town: 'nearby' })) === false,
     "...gamer builds what its row says ('all' on, 'nearby' off)");
  { const w = makeWindow({ 'flydiy.gfx': JSON.stringify(Object.assign({}, FROZEN.gamer, { preset: 'gamer', pv: 8, town: 'all' })) }); w.WELCOME = { SOFT: true, RIG: false };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'gfx_settings.js'), 'utf8'), Object.assign({ window: w, setInterval: () => 0, clearInterval: () => {} }, w));
    w.GFX.set('town', 'all');
    ok(w.GFX.townAll() === false, '...the software rung builds none either (a saved gamer + all on SwiftShader)'); }
  const wb = fs.readFileSync(path.join(__dirname, '..', 'src', 'viewer', 'world_boot.js'), 'utf8'), bj = fs.readFileSync(path.join(__dirname, 'build.js'), 'utf8');
  ok(/window\.GFX\.townAll \? window\.GFX\.townAll\(\)/.test(wb) && /if \(gb === 'potato' \|\| gb === 'laptop'\) townOn = false;/.test(bj),
     "the world's TOWN and the loader's raster variant both read the cap (world_boot.js GFX.townAll, build.js potato / laptop -> 'default')");
}

console.log(fails ? 'GATE GFX: FAIL' : 'GATE GFX: PASS');
process.exit(fails ? 1 : 0);
