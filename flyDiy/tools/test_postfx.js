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
const everyPresetOff = presetRows.length === 6 && presetRows.every(p => KEYS.every(k => PRESETS[p][k] === 'off' || (k === 'bloom' && PRESETS[p][k] === 'soft' && p !== 'minimum' && p !== 'potato' && p !== 'retro')));
const optionRows = KEYS.every(k => new RegExp("\\{ k: '" + k + "', label: '[^']+', steps: \\[\\s*\\{ v: 'off'").test(gfx));


// ---- G1357 THE CATCHER (v2: decided on the GPU, read only on a catch) -----------------------------------------------
// The stub GPU: the copy pass gives its slot the level we chose for the frame; the decision pass is evaluated as the
// shader does (the three slots' levels) and its "samples" go to the open occlusion query; a read fills the frame's copy
// and the means row. A one-frame spike must be caught once (a lasting step never), with ONE read in the whole run -
// no read a frame - and the eye must read at most every EYE_READ_MS.
const CATCH = (async () => {
  const out = { ok: false, events: [], reads: 0, eyeReads: 0, queries: 0, threw: null };
  try {
    const win = {}; new Function('window', src)(win);
    const P = win.POST_FX, sent = [];
    win.FLIGHT_REC = { event: (kind, ms, d) => sent.push([kind, d]), rec: { frame: 0 } };
    class V2 { constructor(x, y) { this.x = x || 0; this.y = y || 0; } set(x, y) { this.x = x; this.y = y; return this; } }
    class V3 { constructor() { this.x = this.y = this.z = 0; } fromArray() { return this; } set() { return this; } }
    class Col { constructor() {} setRGB() { return this; } }
    class Tgt { constructor(w, h, o) { this.width = w; this.height = h; this.texture = { type: o.type, colorSpace: '', level: 0 }; } dispose() {} }
    class Mat { constructor(o) { Object.assign(this, o); } dispose() {} }
    class Mesh { constructor(g, m) { this.material = m; } }
    class Scene { add(m) { this.quad = m; } }
    const THREE = { WebGLRenderTarget: Tgt, ShaderMaterial: Mat, Mesh, Scene, OrthographicCamera: function () {}, PlaneGeometry: function () {},
      Vector2: V2, Vector3: V3, Color: Col, LinearFilter: 1, LinearMipmapLinearFilter: 12, HalfFloatType: 2, UnsignedByteType: 3, RGBAFormat: 4, SRGBColorSpace: 'srgb',
      AdditiveBlending: 5, CustomBlending: 6, AddEquation: 7, OneFactor: 8, OneMinusSrcColorFactor: 9, DstColorFactor: 10, ZeroFactor: 11 };
    let target = null, openQ = null;
    const Q = new Map();   // query -> samples passed
    const lum = t => t.level;
    const gl = { ANY_SAMPLES_PASSED_CONSERVATIVE: 0x8D6A, QUERY_RESULT_AVAILABLE: 0x8867, QUERY_RESULT: 0x8866, getExtension: () => null,
      createQuery: () => ({}), beginQuery: (t, q) => { openQ = q; Q.set(q, 0); }, endQuery: () => { openQ = null; },
      getQueryParameter: (q, pn) => pn === 0x8867 ? true : Q.get(q) };
    const renderer = {
      autoClear: true, capabilities: { isWebGL2: true }, getContext: () => gl,
      getRenderTarget: () => target, setRenderTarget: t => { target = t; },
      render: (scene) => {
        const m = scene.quad && scene.quad.material, u = m && m.uniforms; if (!u || !target) return;
        if (u.tSrc && u.uTexel && !u.tA) target.texture.level = u.tSrc.value.level;   // a copy pass (the eye's or the catcher's)
        if (u.uSpike) {   // the decision, as CAT_DECIDE
          const a = lum(u.tA.value), b = lum(u.tB.value), c = lum(u.tC.value), d1 = b - a, d2 = b - c;
          const yes = Math.abs(d1) > u.uSpike.value && Math.abs(d2) > u.uSpike.value && (d1 > 0) === (d2 > 0);
          if (openQ && yes) Q.set(openQ, 1);
        }
        if (u.uH) { target.texture.means = [u.tA.value.level, u.tB.value.level, u.tC.value.level]; target.texture.level = u.tB.value.level; }
      },
      readRenderTargetPixelsAsync: (t, x, y, w, h, buf) => {
        if (t.width === 16) out.eyeReads++; else out.reads++;
        return new Promise(res => { buf.fill(Math.round(t.texture.level * 255));
          if (t.texture.means) { const o = w * (h - 1) * 4; t.texture.means.forEach((v, k) => { buf[o + k * 4] = buf[o + k * 4 + 1] = buf[o + k * 4 + 2] = Math.round(v * 255); buf[o + k * 4 + 3] = 0; }); }
          res(); });
      },
    };
    P.init(THREE, renderer, { setPost() {}, needRT() {} });
    const rt = { width: 640, height: 360, texture: { level: 0 } };
    const tick = () => new Promise(r => setTimeout(r, 0));
    const levels = [0.3, 0.3, 0.3, 0.62, 0.3, 0.3, 0.3, 0.55, 0.55, 0.55, 0.55, 0.55];   // a one-frame spike at 3, a lasting step at 7
    for (let i = 0; i < levels.length; i++) { win.FLIGHT_REC.rec.frame = 100 + i; rt.texture.level = levels[i]; P.catcher.tap(renderer, { far: 9000, near: 0.5, position: { y: 120 } }, rt); await tick(); }
    P.catcher.tap(renderer, null, rt); await tick(); await tick();
    const sm = P.catcher.summary();
    out.events = sent.filter(e => e[0] === 'catch').map(e => e[1]); out.queries = sm.queries; out.trips = sm.trips;
    // the eye: on, rendered 40 frames back to back - its reads are throttled to EYE_READ_MS
    P.set('eye', 'on'); const te0 = Date.now(); for (let i = 0; i < 40; i++) { P.render(renderer, null, rt); await tick(); } out.eyeMs = Date.now() - te0;
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
  'a one-frame spike is caught once, with its frame and neighbours (G1357 v2: decided on the GPU)':
    C.events.length === 1 && C.events[0].why === 'bright spike' && C.events[0].f === 103 && C.events[0].prev < 0.31 && C.events[0].next < 0.31 && C.events[0].mean > 0.6,
  'a lasting step is not a catch; every frame past the second was judged by a query (G1357)': !C.events.some(e => e.f >= 106) && C.queries >= 10 && C.trips === 1,
  'NO READ A FRAME: the catcher read once in the whole run - for its one catch (G1357 v2)': C.reads === 1,
  'a catch carries the state it was drawn with (far, eye, the cloud flag, the post rows) (G1357)':
    C.events.length === 1 && C.events[0].far === 9000 && 'eyeK' in C.events[0] && 'cloudShadow' in C.events[0] && !!C.events[0].post && 'jpeg' in C.events[0],
  "the eye reads at most every EYE_READ_MS, one in flight, issued from the frame (G1357, EVEN-30's long tasks)": C.eyeReads >= 1 && C.eyeReads <= Math.ceil(C.eyeMs / 250) + 1 && C.eyeReads < 10 && /EYE_READ_MS = 250/.test(code),
  'the decision is an occlusion query, the shots capped and spaced, the cost measured, the switch read (G1357)':
    /ANY_SAMPLES_PASSED_CONSERVATIVE/.test(code) && /MAX_SHOTS: 6, GAP_MS: 5000/.test(code) && /tapUs/.test(code) && /flydiy\.rec\.catch/.test(code),
  'app.js taps the catcher only with the recorder on; aa_resolve taps after the post chain (G1357)':
    /aa\.setTap\(POST_FX\.catcher\.install\(\)\)/.test(app) && /FLIGHT_REC\.off/.test(app) && /if \(S\.post\) S\.post\(renderer, camera, S\.rt\);[\s\S]{0,400}if \(S\.tap\) S\.tap\(renderer, camera, S\.rt\);/.test(R('src/viewer/aa_resolve.js')),
};

const failed = Object.keys(checks).filter(k => !checks[k]);
if (failed.length) console.log(`FAILED CHECKS: ${failed.join(', ')}`);
console.log(`${Object.keys(checks).length - failed.length}/${Object.keys(checks).length} checks`);
if (threw) console.log(`module threw: ${threw}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE POSTFX: PASS' : 'GATE POSTFX: FAIL');
if (C.threw) console.log('catcher threw: ' + C.threw);
console.log('catcher run: ' + JSON.stringify({ reads: C.reads, eyeReads: C.eyeReads, queries: C.queries, trips: C.trips, events: C.events.length, eyeMs: C.eyeMs }));
process.exitCode = pass ? 0 : 1;
});
