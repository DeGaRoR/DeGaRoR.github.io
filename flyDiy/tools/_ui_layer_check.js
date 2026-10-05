#!/usr/bin/env node
// GATE UILAYER (G1370, UI-LAYER) — the in-world helpers are UI (src/viewer/ui_layer.js), in node, on the real vendor
// three.js (r186), the real core (HOME's declared pattern, its sampler) and the real pattern_vis.js / shadow_near.js.
// three's own criterion is the test: the renderer draws an object for a camera iff object.layers.test(camera.layers)
// (projectObject), and the shadow walk iff that holds against the MAIN camera AND castShadow (WebGLShadowMap).
//
//   U1  THE RIBBONS ARE UI: every object of the pattern's graph / slope / targets / legs (the legs and a slope
//       rebuilt after the build too) is on the UI layer ALONE, casts nothing; the PAPI stays a world object (layer 0)
//   U2  WHO SEES THEM: the main camera (UI_LAYER.see) - yes; PHOTO MODE (see(camera, false)) - none; the water's
//       mirror camera (a fresh PerspectiveCamera, blind()) - none; the shed's probe (a CubeCamera's six) - none; an
//       orthographic map / bake camera - none. The PAPI: the eye, photo mode and the mirror all see it
//   U3  NEVER IN A SHADOW PASS: three's walk (visible, layers vs the main camera, castShadow) reaches no UI object,
//       and shadow_near's tagging (tag / tagCraft / apply's far bit) leaves a claimed object's mask alone - a claimed
//       child of the craft's group stays off layers 2 / 3 / 5 (which the main camera enables: photo mode would show it)
//   U4  THE WIRING (static, the page's sources and the BUILT index.html): ui_layer.js in the page before pattern_vis.js
//       and app.js; app.js sees the layer on `camera`, shotSet drops it, the CG group and its labels are claimed, the
//       probe's six blinded; water.js blinds the mirror camera every capture; editor.js claims its outlines
//   U5  THE VERBS WAIT FOR THE REVEAL: flight.css hides #flActs under body.rollShot; app.js rollAnimPlay sets it
//       BEFORE ROLLANIM.play, flRevealStart clears it first thing, the solo shot's end and enterGarage clear it; and
//       rollShotUi itself, run on a stub body, toggles the class (a hoisted declaration - enterGarage runs above it)
//
//   node tools/_ui_layer_check.js [--verbose]  -> "GATE UILAYER: PASS|FAIL"
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..'), V = p => path.join(ROOT, 'src', 'viewer', p);
const VERBOSE = process.argv.includes('--verbose');
const fails = [];
let nOk = 0;
const check = (ok, label, extra) => {
  if (!ok || VERBOSE) console.log((ok ? '  ok     ' : '  FAIL   ') + label + (extra ? ' — ' + extra : ''));
  if (ok) nOk++; else fails.push(label);
  return ok;
};

const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
global.THREE = THREE;
const UI = require(V('ui_layer.js'));
global.UI_LAYER = UI;
const CORE = require(path.join(T, 'flight_core.js'));
const { buildPatternVis } = require(V('pattern_vis.js'));
// shadow_near.js has no module export: evaluated as the page does (a top-level var); no window, so it installs nothing
require('vm').runInThisContext(fs.readFileSync(V('shadow_near.js'), 'utf8'), { filename: 'shadow_near.js' });
const SN = global.SHADOW_NEAR;

// ---- U1: the ribbons are UI -------------------------------------------------------------------------------------
const world = CORE.makeWorld();
const home = world.aerodromes.find(a => a.id === 'HOME') || world.aerodromes[0];
const pat = CORE.sitePattern(home, CORE.siteOf(home.id));
check(!!pat, 'HOME declares a pattern');
const pv = buildPatternVis(THREE, pat, (x, z) => world.terrainH(x, z), { patternPath: CORE.patternPath, aero: home });
pv.setLayers({ graph: true, slope: true, targets: true });
// the legs drawn after the build (as app.js does every plan) and the active slope redrawn at another angle
const legY = (home.elev || 0) + 300;
pv.setLegs([{ name: 'DOWNWIND', A: [home.x || 0, (home.z || 0) + 400], B: [(home.x || 0) + 900, (home.z || 0) + 400], h: 300 },
            { name: 'FINAL', A: [(home.x || 0) + 900, home.z || 0], B: [home.x || 0, home.z || 0], h: 300 }], legY - 300);
pv.setActive(0, 0.07);
const UI_BIT = 1 << UI.LAYER;
const uiObjs = [], papiObjs = [];
for (const k of pv.UI_KEYS || []) pv.layers[k].traverse(o => uiObjs.push([k, o]));
pv.layers.papi.traverse(o => papiObjs.push(o));
const drawn = uiObjs.filter(([, o]) => o.isMesh || o.isLine || o.isPoints || o.isSprite);
const perKey = k => drawn.filter(([kk]) => kk === k).length;
check(perKey('graph') > 0 && perKey('slope') > 0 && perKey('targets') > 0 && perKey('legs') > 0,
  'the pattern drew all four UI layers', ['graph', 'slope', 'targets', 'legs'].map(k => k + ' ' + perKey(k)).join(', '));
const notPure = uiObjs.filter(([, o]) => o.layers.mask !== UI_BIT);
check(!notPure.length, `U1 every graph / slope / targets / legs object (${uiObjs.length}) is on the UI layer alone`, notPure.length ? notPure.length + ' not: ' + notPure.slice(0, 3).map(([k, o]) => k + ':' + (o.name || o.type) + ' mask ' + o.layers.mask).join(', ') : '');
check(uiObjs.every(([, o]) => !o.castShadow && !o.receiveShadow && UI.is(o)), 'U1 ...casts and receives nothing, marked userData.uiLayer');
check(papiObjs.length > 1 && papiObjs.every(o => o.layers.mask === 1 && !UI.is(o)), `U1 the PAPI (${papiObjs.length} objects) stays a world object on layer 0`);

// ---- U2: who sees them ------------------------------------------------------------------------------------------
const eye = UI.see(new THREE.PerspectiveCamera(46, 1, 0.5, 7000));
eye.layers.enable(SN.NEAR_LAYER); eye.layers.enable(SN.CRAFT_LAYER);       // the main camera as shadow_near.follow leaves it
const sees = (cam, list) => list.filter(o => o.layers.test(cam.layers)).length;
const uiDrawn = drawn.map(([, o]) => o);
check(sees(eye, uiDrawn) === uiDrawn.length, 'U2 the main camera sees every helper');
UI.see(eye, false);
check(sees(eye, uiDrawn) === 0, 'U2 PHOTO MODE (shotSet: the layer off the eye) sees none', sees(eye, uiDrawn) + ' seen');
check(sees(eye, papiObjs) === papiObjs.length, 'U2 ...and still sees the PAPI');
UI.see(eye, true);
const mirror = UI.blind(new THREE.PerspectiveCamera());
check(sees(mirror, uiDrawn) === 0 && sees(mirror, papiObjs) === papiObjs.length, 'U2 the water mirror camera draws no helper, and the PAPI');
const bare = new THREE.PerspectiveCamera();
check(sees(bare, uiDrawn) === 0, 'U2 ...even un-blinded (a camera is born on layer 0 alone)');
const cube = new THREE.CubeCamera(0.5, 100, new THREE.WebGLCubeRenderTarget(16));
check(cube.children.length === 6 && cube.children.every(c => sees(c, uiDrawn) === 0), 'U2 the shed probe\'s six cube faces draw no helper');
check(sees(new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 6000), uiDrawn) === 0, 'U2 an orthographic map / bake camera draws no helper');

// ---- U3: never in a shadow pass ---------------------------------------------------------------------------------
// three r186 WebGLShadowMap.renderObject: visible, object.layers.test(MAIN camera.layers), mesh/line/points, castShadow
const castIn = root => { let n = 0; const walk = o => { if (!o.visible) return; if (o.layers.test(eye.layers) && (o.isMesh || o.isLine || o.isPoints) && o.castShadow) n++; o.children.forEach(walk); }; walk(root); return n; };
check((pv.UI_KEYS || []).every(k => castIn(pv.layers[k]) === 0), 'U3 three\'s shadow walk reaches no UI object of the pattern');
// shadow_near's tagging over a craft group carrying a claimed child (app.js gGrp under `craft`)
const craft = new THREE.Group(), skin = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
skin.castShadow = true; craft.add(skin);
const cgGrp = UI.claim(new THREE.Group());
cgGrp.add(UI.claim(new THREE.Sprite(new THREE.SpriteMaterial())));
cgGrp.add(UI.claim(new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial())));
craft.add(cgGrp);
SN.tagCraft(craft, null);
SN.tag(craft);
SN.S.on = false; SN.apply({ visible: true, castShadow: true });             // the near map off: the craft's far bit set
const cgObjs = []; cgGrp.traverse(o => cgObjs.push(o));
check(cgObjs.every(o => o.layers.mask === UI_BIT), 'U3 shadow_near tagCraft / tag / apply leave a claimed child of the craft on the UI layer alone', cgObjs.map(o => o.type + ' ' + o.layers.mask).join(', '));
check(skin.layers.isEnabled(SN.CRAFT_LAYER) && skin.layers.isEnabled(SN.FAR_LAYER), 'U3 ...while the craft\'s own skin is tagged as before');
UI.see(eye, false);
check(sees(eye, cgObjs) === 0, 'U3 ...so photo mode hides the CG marks by the layer too');
UI.see(eye, true);

// ---- U4: the wiring ---------------------------------------------------------------------------------------------
const src = f => fs.readFileSync(V(f), 'utf8');
const APP = src('app.js'), WATER = src('water.js'), ED = src('editor.js'), RW = src('render_world.js'), HG = src('hangar.js');
check(/if \(UIL\) UIL\.see\(camera\);/.test(APP), 'U4 app.js: the main camera sees the UI layer');
check(/function shotSet\(on\)[\s\S]{0,1600}UIL\.see\(camera, !on\)/.test(APP), 'U4 app.js: shotSet (photo mode) takes the layer off the eye and gives it back');
check(/UIL\.claim\(gGrp\)/.test(APP) && /gGrp\.add\(UIL \? UIL\.claim\(sp\) : sp\)/.test(APP) && /gGrp\.add\(UIL \? UIL\.claim\(gInd\) : gInd\)/.test(APP), 'U4 app.js: the CG group, its labels and its posts are claimed');
check(/new THREE\.CubeCamera\(0\.5, 100, envRT\);\s*\n\s*if \(UIL\) for \(const c of cam\.children\) UIL\.blind\(c\)/.test(APP), 'U4 app.js: the shed probe\'s six are blinded');
check(/MIR\.cam = new THREE\.PerspectiveCamera\(\);[\s\S]{0,600}UI_LAYER\.blind\(mc\)/.test(WATER) && !/mc\.layers\.(copy|mask\s*=)/.test(WATER), 'U4 water.js: the mirror camera blinded every capture, its layers never copied');
check((ED.match(/UI_LAYER\.claim\(/g) || []).length >= 2, 'U4 editor.js: the selection outlines (hiEdges, hiSilPair) are claimed');
check(/if \(o\.userData\.uiLayer\) return;/.test(RW), 'U4 render_world.js: nearWatch leaves a UI helper\'s layers alone');
check(/o\.isMesh && !\(o\.userData && o\.userData\.uiLayer\)\) o\.layers\.enable\(LAYER\)/.test(HG), 'U4 hangar.js: the craft\'s floor print skips UI helpers');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const at = s => html.indexOf(s);
const iUi = at('var UI_LAYER = (function'), iPv = at('function buildPatternVis('), iApp = at('if (UIL) UIL.see(camera);');
check(iUi >= 0 && iPv > iUi && iApp > iUi, 'U4 the BUILT index.html carries ui_layer.js before pattern_vis.js and app.js', `ui ${iUi}, pattern_vis ${iPv}, app ${iApp}`);

// ---- U5: the verbs wait for the reveal ---------------------------------------------------------------------------
const CSS = src('flight.css');
check(/body\.rollShot #flActs \{ display:none !important; \}/.test(CSS) && html.includes('body.rollShot #flActs'), 'U5 flight.css (and the built page): #flActs hidden under body.rollShot');
const fnBody = name => { const i = APP.indexOf('function ' + name + '('); if (i < 0) return ''; const j = APP.indexOf('\n  }\n', i); return APP.slice(i, j); };
const play = fnBody('rollAnimPlay');
check(play.includes('rollShotUi(true)') && play.indexOf('rollShotUi(true)') < play.indexOf('ROLLANIM.play('), 'U5 rollAnimPlay hides the verbs BEFORE the shot\'s first frame');
check(/function flRevealStart\(\) \{\s*\n\s*rollShotUi\(false\);/.test(APP), 'U5 flRevealStart gives them back first thing (the reveal hands over)');
check(fnBody('rollAnimSolo').includes('rollShotUi(false)'), 'U5 a solo shot (back to the shed) gives them back');
check(/function enterGarage\(\) \{[\s\S]{0,600}rollShotUi\(false\)/.test(APP), 'U5 enterGarage gives them back (a roll-in over the trip)');
const decl = /\n  (function rollShotUi\(on\) \{[^\n]*\})/.exec(APP);
check(!!decl, 'U5 rollShotUi is a hoisted declaration (enterGarage, above it, runs at boot)');
if (decl) {
  const cls = new Set(), document = { body: { classList: { toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); } } } };
  const rollShotUi = new Function('document', decl[1] + '\nreturn rollShotUi;')(document);
  rollShotUi(true); const during = cls.has('rollShot');
  rollShotUi(false); const after = cls.has('rollShot');
  check(during && !after, 'U5 rollShotUi toggles body.rollShot on for the shot, off at the reveal');
}

console.log(`UILAYER: ${nOk} ok, ${fails.length} failed`);
console.log('GATE UILAYER: ' + (fails.length ? 'FAIL' : 'PASS'));
process.exit(fails.length ? 1 : 0);
