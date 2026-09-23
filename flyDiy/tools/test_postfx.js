#!/usr/bin/env node
// GATE POSTFX (POST-FX study, 2026-09-21) - the switchable post passes.
//
// THE ONE RULE: with every post row off, the frame is the frame of today. The
// user's ruling when the study was scoped: "all the effects should have on/off
// switches in the graphics menu; let's not take too much risk here, and ensure
// we can perfectly operate as of today when turning the post fx off." A node
// gate cannot look at a pixel (tools/postfx_shot.js --diff does that, on the
// GPU: 28 pixels of +/-1 between two 'off' frames, the clouds' drift); what
// it CAN hold is every way the rule has been broken or nearly broken while the
// module was written:
//
//   - every post row is 'off' in every preset and in the module's own state;
//   - with nothing on, the module installs NO hook and asks for NO target
//     (the hostile-stub run below counts the calls);
//   - the module never draws into the resolve target it is handed (G425: one
//     draw into the 8x target after render() is a second 7 ms resolve), and
//     owns no colour (no tone mapping, no exposure, no colour space - the
//     resolve's rule extends to it);
//   - aa_resolve.js is not the place any of this lives: the resolve pass keeps
//     GATE AA's clean bill, and the target's ask has ONE keeper (app.js's keyed
//     needRT) so the clouds and the passes cannot take each other's target away.
const fs = require('fs');
const path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const strip = s => s.replace(/^\s*\/\/.*$/gm, '');

const src = R('src/viewer/post_fx.js');
const gfx = R('src/viewer/gfx_settings.js');
const app = R('src/viewer/app.js');
const build = R('tools/build.js');
const dev = R('src/viewer/dev_panel.js');
const code = strip(src);

// ---- the module against a HOSTILE stub, then a counting one --------------
let threw = null, API = null;
try {
  const win = {};
  new Function('window', src)(win);
  API = win.POST_FX;
} catch (e) { threw = String(e && e.message || e); }
let hookCalls = [], rtCalls = [];
let offInstallsNothing = false, onInstalls = false, offAgainRemoves = false;
if (API) {
  const aa = { setPost: f => hookCalls.push(f), needRT: (on, key) => rtCalls.push([!!on, key]) };
  const THREE = { WebGLRenderTarget: function () {}, ShaderMaterial: function () {} };
  const renderer = { getContext: () => ({ getExtension: () => null }), capabilities: { isWebGL2: true } };
  API.init(THREE, renderer, aa);
  for (const k of API.KEYS) API.set(k, 'off');
  offInstallsNothing = hookCalls.every(f => f === null) && rtCalls.every(([on, key]) => on === false && key === 'post') && !API.active();
  API.set('bloom', 'soft');
  onInstalls = API.hooked && hookCalls[hookCalls.length - 1] === API.render && rtCalls[rtCalls.length - 1][0] === true && rtCalls[rtCalls.length - 1][1] === 'post';
  API.set('bloom', 'off');
  offAgainRemoves = !API.hooked && hookCalls[hookCalls.length - 1] === null && rtCalls[rtCalls.length - 1][0] === false && !API.active();
}

// ---- the presets ---------------------------------------------------------
const KEYS = ['bloom', 'look', 'lens', 'rays', 'ao', 'eye'];
// the EVALUATED presets (PERF 2026-09-23: the five tiers share their post rows through one block, POST_OFF -
// a source scan of each preset's line would not see them)
const PRESETS = (() => { const w = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, requestAnimationFrame: () => 1 }; w.window = w;
  require('vm').runInNewContext(gfx, Object.assign({ window: w, setInterval: () => 0, clearInterval() {} }, w)); return w.GFX ? w.GFX.PRESETS : {}; })();
const presetRows = Object.keys(PRESETS);
const everyPresetOff = presetRows.length === 5 && presetRows.every(p => KEYS.every(k => PRESETS[p][k] === 'off'));
const optionRows = KEYS.every(k => new RegExp("\\{ k: '" + k + "', label: '[^']+', steps: \\[\\s*\\{ v: 'off'").test(gfx));

const checks = {
  // --- the state ------------------------------------------------------------
  'post_fx.js loads on a bare window without throwing': !threw && !!API,
  'the module starts with every effect off': !!API && API.KEYS.every(k => API.S[k] === 'off') && !API.active(),
  'every preset (potato, retro, current, gamer, ultra) says off for all six rows': everyPresetOff,
  "every post row's first step is 'off'": optionRows,
  'the menu hands each row to the module (GFX.apply -> POST_FX.set)': /W\.POST_FX\.set\(k, S\[k\]\)/.test(gfx),

  // --- off is off -------------------------------------------------------------
  'with everything off the module installs no hook and asks for no target': offInstallsNothing,
  "a row on installs the hook and asks for the target under the 'post' key": onInstalls,
  'the row off again removes the hook and lets the target go': offAgainRemoves,
  'the eye factor is 1 when the row is off (the exposure contract untouched)': !!API && API.stats.eyeK === 1 && /eyeK = 1/.test(code),

  // --- what the passes may not do --------------------------------------------
  'no pass draws into the resolve target it is handed (G425)':
    !/setRenderTarget\(\s*rt\s*\)/.test(code) && !/draw\([^)]*,\s*rt\s*\)/.test(code),
  // G448.3 (the linear split): in linear compositing the passes read RADIANCE and put picture values
  // back with the renderer's OWN two chunks, guarded by PFX_LINEAR - nothing of the module's own
  'the module owns no colour of its own: no exposure, no output space, no curve constant':
    !/toneMappingExposure|outputColorSpace|ACES|NeutralToneMapping|CineonToneMapping|0\.41666|0\.0031308/.test(code),
  "the renderer's chunks appear only inside the PFX_LINEAR guard":
    (() => { const m = /#ifdef PFX_LINEAR([\s\S]*?)#else/.exec(code); const inside = m ? m[1] : '';
             const outside = code.replace(/#ifdef PFX_LINEAR[\s\S]*?#endif/g, '');
             return /tonemapping_fragment/.test(inside) && /colorspace_fragment/.test(inside) && !/tonemapping_fragment|colorspace_fragment/.test(outside); })(),
  'a material is toneMapped only in linear mode (the chunks compiled in)': /toneMapped: linear/.test(code),
  'the eye reads back asynchronously, never a blocking readPixels': /readRenderTargetPixelsAsync/.test(code) && !/\breadPixels\(/.test(code),
  'the eye is bounded to a stop and a half round the schedule': /EYE_STOPS = 1\.5/.test(src),

  // --- the wiring ------------------------------------------------------------
  'aa_resolve.js is not touched by the passes (GATE AA keeps its bill)': !/POST_FX|post_fx/.test(R('src/viewer/aa_resolve.js')),
  "the target's ask has ONE keeper: app.js keys needRT and ORs the keys": /aa\.needRT = \(on, key\) =>/.test(app) && /Object\.keys\(wants\)\.some/.test(app),
  'app.js inits the module with the pass': /POST_FX\.init\(THREE, renderer, aa\)/.test(app),
  'post_fx.js is built before gfx_settings.js and app.js':
    build.indexOf("'post_fx.js'") > 0 && build.indexOf("'post_fx.js'") < build.indexOf("'gfx_settings.js'") && build.indexOf("'post_fx.js'") < build.indexOf("'app.js'"),
  'the exposure contract carries the eye as a third factor (base x step x eye)': /v \* \(S\.exposure \|\| 1\) \* eyeK/.test(gfx) && /setEye/.test(gfx),
  'the F8 panel reads the passes out': /POST_FX/.test(dev),
  'the contract is written where it will be looked for': /NOTHING HERE DRAWS INTO THE RESOLVE TARGET/.test(src) && /DISPLAY SPACE/.test(src),
};

const failed = Object.keys(checks).filter(k => !checks[k]);
if (failed.length) console.log(`FAILED CHECKS: ${failed.join(', ')}`);
console.log(`${Object.keys(checks).length - failed.length}/${Object.keys(checks).length} checks`);
if (threw) console.log(`module threw: ${threw}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE POSTFX: PASS' : 'GATE POSTFX: FAIL');
process.exitCode = pass ? 0 : 1;
