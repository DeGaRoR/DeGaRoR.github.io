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
// every post row OFF in every preset but the soft bloom, allowed from 'current' up (the default look, 2026-09-23: 0.25 ms)
const everyPresetOff = presetRows.length === 5 && presetRows.every(p => KEYS.every(k => PRESETS[p][k] === 'off' || (k === 'bloom' && PRESETS[p][k] === 'soft' && p !== 'potato' && p !== 'retro')));
const optionRows = KEYS.every(k => new RegExp("\\{ k: '" + k + "', label: '[^']+', steps: \\[\\s*\\{ v: 'off'").test(gfx));


// ---- G1357 THE CATCHER: run against a stub renderer whose frames we choose ------------------------------------------
// tap() draws the frame's 64 x 36 copy into its own slot and reads it back with readRenderTargetPixelsAsync; the stub
// fills the read with the level we gave that frame. A one-frame spike must be caught ONCE (and a lasting step never),
// with its neighbours; a slot still in flight must be skipped, never waited on; nothing may read back synchronously.
const CATCH = (async () => {
  const out = { ok: false, events: [], skipped: 0, taps: 0, reads: 0, held: false, why: null, threw: null };
  try {
    const win = {}; new Function('window', src)(win);
    const P = win.POST_FX, sent = [];
    win.FLIGHT_REC = { event: (kind, ms, d) => sent.push([kind, d]), rec: { frame: 0 } };
    class V2 { constructor(x, y) { this.x = x || 0; this.y = y || 0; } set(x, y) { this.x = x; this.y = y; return this; } }
    class V3 { constructor() { this.x = this.y = this.z = 0; } fromArray() { return this; } set() { return this; } }
    class Col { constructor() {} setRGB() { return this; } }
    class Tgt { constructor(w, h, o) { this.width = w; this.height = h; this.texture = { type: o.type, colorSpace: '' }; this.level = 0; } dispose() {} }
    class Mat { constructor(o) { Object.assign(this, o); } dispose() {} }
    class Mesh { constructor(g, m) { this.material = m; } }
    class Scene { add(m) { this.quad = m; } }
    const THREE = { WebGLRenderTarget: Tgt, ShaderMaterial: Mat, Mesh, Scene, OrthographicCamera: function () {}, PlaneGeometry: function () {},
      Vector2: V2, Vector3: V3, Color: Col, LinearFilter: 1, HalfFloatType: 2, UnsignedByteType: 3, RGBAFormat: 4, SRGBColorSpace: 'srgb',
      AdditiveBlending: 5, CustomBlending: 6, AddEquation: 7, OneFactor: 8, OneMinusSrcColorFactor: 9, DstColorFactor: 10, ZeroFactor: 11 };
    let target = null, hold = false, syncReads = 0;
    const pending = [];
    const renderer = {
      autoClear: true, capabilities: { isWebGL2: true }, getContext: () => ({ getExtension: () => null }),
      getRenderTarget: () => target, setRenderTarget: t => { target = t; },
      render: (scene) => { const m = scene.quad && scene.quad.material; if (m && m.uniforms && m.uniforms.tSrc && m.uniforms.tSrc.value && target) target.level = m.uniforms.tSrc.value.level; },
      readRenderTargetPixels: () => { syncReads++; },
      readRenderTargetPixelsAsync: (t, x, y, w, h, buf) => new Promise(res => { const go = () => { buf.fill(Math.round(t.level * 255)); res(); }; if (hold) pending.push(go); else go(); }),
    };
    P.init(THREE, renderer, { setPost() {}, needRT() {} });
    const rt = { width: 640, height: 360, texture: { level: 0 } };
    const tick = () => new Promise(r => setTimeout(r, 0));
    const levels = [0.3, 0.3, 0.3, 0.62, 0.3, 0.3, 0.3, 0.55, 0.55, 0.55, 0.55];   // a one-frame spike at 3, a lasting step at 7
    for (let i = 0; i < levels.length; i++) { win.FLIGHT_REC.rec.frame = 100 + i; rt.texture.level = levels[i]; P.catcher.tap(renderer, { far: 9000, near: 0.5, position: { y: 120 } }, rt); await tick(); }
    // a slot in flight is skipped: hold every read, tap SLOTS + 1 times - the last finds its slot busy and returns at once
    hold = true; const t0 = Date.now();
    for (let i = 0; i <= P.catcher.CAT.SLOTS; i++) P.catcher.tap(renderer, null, rt);
    out.held = Date.now() - t0 < 200;
    pending.forEach(g => g()); await tick();
    const sm = P.catcher.summary();
    out.events = sent.filter(e => e[0] === 'catch').map(e => e[1]);
    out.skipped = sm.skipped; out.taps = sm.taps; out.reads = sm.reads; out.syncReads = syncReads;
    out.why = out.events.length ? out.events[0].why : null;
    // detect() on its own: the spike, the step, the pale-sky frame
    const D = P.catcher.detect, f = (mean, sky, white) => ({ mean, sky: sky || 0, white: white || 0 });
    out.detect = D(f(0.3), f(0.45), f(0.3)) === 'bright spike' && D(f(0.4), f(0.2), f(0.41)) === 'dark spike' && D(f(0.3), f(0.33), f(0.3)) === null
      && D(f(0.3), f(0.45), f(0.45)) === null && D(f(0.3, 0.1), f(0.33, 0.85), f(0.3, 0.12)) === 'pale sky' && D(f(0.3, 0.5), f(0.33, 0.85), f(0.3, 0.5)) === null;
    out.ok = true;
  } catch (e) { out.threw = String(e && e.stack || e); }
  return out;
})();

CATCH.then(C => {
const checks = {
  // --- the state ------------------------------------------------------------
  'post_fx.js loads on a bare window without throwing': !threw && !!API,
  'the module starts with every effect off': !!API && API.KEYS.every(k => API.S[k] === 'off') && !API.active(),
  'every preset says off for all six rows (the soft bloom allowed from current up)': everyPresetOff,
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
  // --- G960 (A2-GLINT): the glints do not explode ------------------------------
  // the threshold pass takes each of its four pixels through a NaN / Inf guard and a luminance clamp, then Karis's
  // 1 / (1 + luma) average; every tier's gain is a third of what it was (soft linear 0.35, strong 0.6, display 0.32 / 0.7)
  'the bloom threshold pass guards NaN / Inf, clamps its input, and averages by Karis (G960)':
    (() => { const m = /const BLOOM_THR = `([\s\S]*?)`;/.exec(code); const t = m ? m[1] : '';
             return /isnan\(c\)/.test(t) && /isinf\(c\)/.test(t) && /uClamp \/ l/.test(t) && (t.match(/1\.0 \/ \(1\.0 \+ luma\(s\d\)\)/g) || []).length === 4 && /uClamp\.value = P\.clamp/.test(code); })(),
  'every bloom tier carries a clamp and a third of its old gain (G960)':
    !!API && !!API.BLOOM && ['display', 'linear'].every(c => ['soft', 'strong'].every(t => { const P = API.BLOOM[c][t]; return P && P.clamp > 0 && P.gain > 0; }))
    && API.BLOOM.linear.soft.gain <= 0.35 / 3 + 0.01 && API.BLOOM.linear.strong.gain <= 0.6 / 3 + 0.01
    && API.BLOOM.display.soft.gain <= 0.32 / 3 + 0.01 && API.BLOOM.display.strong.gain <= 0.7 / 3 + 0.01,
  'the contract is written where it will be looked for': /NOTHING HERE DRAWS INTO THE RESOLVE TARGET/.test(src) && /DISPLAY SPACE/.test(src),
  // --- G1357 the catcher ---------------------------------------------------------------------------------------
  'the catcher ran against the stub (G1357)': C.ok,
  'a one-frame spike is caught once, with its neighbours and the frame it was (G1357)':
    C.events.length === 1 && C.why === 'bright spike' && C.events[0].f === 103 && C.events[0].prev < 0.31 && C.events[0].next < 0.31 && C.events[0].mean > 0.6,
  'a lasting step is not a catch, and detect() knows a spike, a step and a pale-sky frame (G1357)': C.detect && !C.events.some(e => e.f >= 106),
  'a catch carries the state it was drawn with (far, eye, the cloud flag, the post rows) (G1357)':
    C.events.length === 1 && C.events[0].far === 9000 && 'eyeK' in C.events[0] && 'cloudShadow' in C.events[0] && !!C.events[0].post && 'jpeg' in C.events[0],
  'a slot still in flight is skipped, never waited on (G1357)': C.held && C.skipped >= 1,
  'the catcher never reads back synchronously (G1357)': C.syncReads === 0 && /readRenderTargetPixelsAsync\(T0/.test(code) && !/readRenderTargetPixels\(T0/.test(code),
  'the shots are capped and spaced, the cost measured, the switch read (G1357)': /MAX_SHOTS: 6, GAP_MS: 5000/.test(code) && /tapUs/.test(code) && /flydiy\.rec\.catch/.test(code),
  'app.js taps the catcher only with the recorder on; aa_resolve taps after the post chain (G1357)':
    /aa\.setTap\(POST_FX\.catcher\.tap\)/.test(app) && /FLIGHT_REC\.off/.test(app) && /if \(S\.post\) S\.post\(renderer, camera, S\.rt\);[\s\S]{0,400}if \(S\.tap\) S\.tap\(renderer, camera, S\.rt\);/.test(R('src/viewer/aa_resolve.js')),
};

const failed = Object.keys(checks).filter(k => !checks[k]);
if (failed.length) console.log(`FAILED CHECKS: ${failed.join(', ')}`);
console.log(`${Object.keys(checks).length - failed.length}/${Object.keys(checks).length} checks`);
if (threw) console.log(`module threw: ${threw}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE POSTFX: PASS' : 'GATE POSTFX: FAIL');
if (C.threw) console.log('catcher threw: ' + C.threw);
process.exitCode = pass ? 0 : 1;
});
