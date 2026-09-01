#!/usr/bin/env node
// GATE AA (G144) — the resolve pass.
//
// WHAT A NODE GATE CAN AND CANNOT SAY ABOUT ANTI-ALIASING. It cannot say the
// edges got smoother: there is no GL context here, and the numbers that settled
// that (tread 7px -> 1px, jump 64 -> 3, 8 samples where the default framebuffer
// gave 4) came off the live page and are recorded in src/viewer/aa_resolve.js.
// A gate that pretended to re-measure them would be lying.
//
// What it CAN hold, and what has actually broken during this arc, is:
//
//   THE PASS MUST NOT KILL A VIEWER THAT CANNOT RUN IT. The headless smoke
//   harness stubs THREE with no `capabilities` and no `getContext`, and half
//   the ways of writing this file throw at make() on such a stub. That is a
//   dead viewer, which is a far worse bug than a rough edge, so it is asserted
//   here against a deliberately hostile stub rather than hoped for.
//
//   THE PASS MUST OWN NO COLOUR. This is the one the user caught, minutes after
//   the first build, and it is worth stating as a rule rather than as a bug.
//   The first draft rendered into a LINEAR target and did ACES and the sRGB
//   transfer itself. Its tone curve was CORRECT — measured exact on opaque
//   pixels, zero codes of difference. It was still wrong, because a linear
//   target moves the hardware blend unit into linear light, and every
//   transparent material in the game re-composited: the editor's selection
//   highlight, a bright cyan at partial alpha, stopped being a soft wash and
//   became an almost opaque slab.
//
//   So the target carries sRGBEncoding, the materials tone-map and encode on
//   the way in exactly as they do onto the canvas, and this pass filters
//   display-space values and adds grain. The assertions below are all one
//   invariant seen from different sides: no ACES here, no transfer curve here,
//   no exposure read here, no tone-mapping override here. A correct second
//   implementation of the tone curve is still a second implementation, and the
//   way it failed was not by being wrong.
//
//   THE TIER TABLE MUST STAY HONEST. `off` must really be off (a tier that
//   quietly resolved would make the escape hatch a lie), and 2.0x must stay
//   out: it measured WORSE than 1.25x through every downsample filter tried,
//   for 44% more fill, and the temptation to "just add a higher setting" is
//   exactly what this row exists to refuse.
const fs = require('fs');
const path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const src = R('src/viewer/aa_resolve.js');
const build = R('tools/build.js');
const app = R('src/viewer/app.js');

// ---- load the module against a HOSTILE stub -------------------------------
// deliberately missing: capabilities, getContext, getRenderTarget, toneMapping,
// getDrawingBufferSize — i.e. every door the pass might reach through.
// `exports` starts as an object because that is what CommonJS hands a module,
// and the file only publishes when it finds one — an empty `{}` here would
// silently load nothing and every assertion below would fail for the wrong
// reason (it did, once).
const mod = { exports: {} };
new Function('module', 'window', src)(mod, undefined);
const API = mod.exports;

let stubRendered = 0;
const stubRenderer = { render() { stubRendered++; }, setPixelRatio() {}, setSize() {} };
const stubTHREE = { /* nothing the pass needs */ };
let made = null, threw = null;
try { made = API.make(stubTHREE, stubRenderer); } catch (e) { threw = e.message; }
if (made) {
  try { made.setSize(800, 600); made.setTier('full'); made.render({}, {}); } catch (e) { threw = threw || e.message; }
}

const T = API && API.TIERS;
const tierList = T ? Object.keys(T) : [];

const checks = {
  // --- headless safety -----------------------------------------------------
  'module loads with no window': !!API && typeof API.make === 'function',
  'make() survives a stub with no capabilities': threw === null,
  'degrades to off on a stub': !!made && made.tier() === 'off' && made.able() === false,
  'setTier cannot force a tier the card cannot carry':
    !!made && made.setTier('full') === 'off',
  'render() falls through to renderer.render when not able': stubRendered > 0,

  // --- the tier table ------------------------------------------------------
  'three tiers declared': tierList.length === 3,
  'off is really off (no supersample, no samples)':
    !!T && T.off.ss === 1 && T.off.samples === 0,
  // THE DEFAULT IS THE USER'S RULING, in three acts (2026-09-01). First:
  // `full` broke the silhouette (no stencil on the target) and was parked at
  // `off`. Second, with the stencil fixed and the outline verified perfect:
  // `msaa`. Third, with the tent kernel replaced by Catmull-Rom: "update
  // defaults to smoothest" — `full`. Moving it again — any direction — is
  // the user's decision, not a session's.
  'the default tier is full (smoothest), the user\'s third ruling':
    API && API.DEF === 'full',
  'the target carries a stencil buffer (the G131 silhouette dies without it)':
    /stencilBuffer:\s*true/.test(src),
  'the pref key is aa2 (the first build persisted full under aa)':
    API && API.PREF === 'flydiy.aa2',
  'no 2.0x tier (measured worse than 1.25x)':
    !!T && !tierList.some(k => T[k].ss >= 2),
  'every tier states why it exists':
    !!T && tierList.every(k => typeof T[k].why === 'string' && T[k].why.length > 12),
  'supersample ratios are non-integer above 1 (degenerate resample)':
    !!T && tierList.every(k => T[k].ss === 1 || Math.abs(T[k].ss - Math.round(T[k].ss)) > 0.1),
  'the top tier asks for 8 samples': !!T && T.full.samples === 8,

  // --- the pass must own NO colour ----------------------------------------
  // These are the checks that would have caught the regression the user found
  // within a minute of the first build: a linear target moved every transparent
  // material in the game into linear compositing, and the editor's selection
  // highlight went from a soft wash to an opaque slab. The invariant is not
  // "the tone curve is correct" — the first draft's tone curve WAS correct,
  // measured exact on opaque pixels. The invariant is that this pass does not
  // participate in colour at all, so that blending stays where it has always
  // been and there is one ACES in the project rather than two.
  'the target is sRGB-encoded (blending stays in display space)':
    /texture\.encoding\s*=\s*THREE\.sRGBEncoding/.test(src),
  'the pass carries no ACES of its own': !/ACESInput|RRTAndODTFit|aaACES/.test(src.replace(/^\/\/.*$/gm, '')),
  'the pass carries no transfer curve of its own':
    !/0\.41666|0\.0031308/.test(src.replace(/^\s*\/\/.*$/gm, '')),
  'the pass never overrides tone mapping':
    !/NoToneMapping/.test(src.replace(/^\s*\/\/.*$/gm, '')),
  'the pass never reads exposure':
    !/toneMappingExposure/.test(src.replace(/^\s*\/\/.*$/gm, '')),
  'the target is still HALF FLOAT (precision, so dither has room to work)':
    /HalfFloatType/.test(src),

  // --- wiring --------------------------------------------------------------
  'aa_resolve.js is built before app.js':
    build.indexOf("'aa_resolve.js'") > 0 &&
    build.indexOf("'aa_resolve.js'") < build.indexOf("'app.js'"),
  'app.js routes the one default-framebuffer render through the pass':
    /aa\.render\(inGarage \? garageScene\(\) : scene, camera\)/.test(app),
  'app.js keeps the un-passed render as the fallback':
    /else renderer\.render\(inGarage \? garageScene\(\) : scene, camera\)/.test(app),
  'the pass sizes off the drawing buffer, not CSS pixels':
    /getDrawingBufferSize/.test(app),
  'the flight camera flyout offers the tier (one fact, two readers)':
    /flRow\(body, 'smoothing'\)/.test(app),

  // --- the finding that is not anti-aliasing -------------------------------
  'the blending trap is written down where it will be looked for, with numbers':
    /ALPHA BLENDING HAPPENS IN WHATEVER SPACE THE TARGET IS IN/.test(src) &&
    /delta, OPAQUE/.test(src),
};

const failed = Object.keys(checks).filter(k => !checks[k]);
if (failed.length) console.log(`FAILED CHECKS: ${failed.join(', ')}`);
console.log(`${Object.keys(checks).length - failed.length}/${Object.keys(checks).length} checks`);
if (threw) console.log(`stub make() threw: ${threw}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE AA: PASS' : 'GATE AA: FAIL');
process.exitCode = pass ? 0 : 1;
