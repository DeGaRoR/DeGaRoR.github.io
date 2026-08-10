// render/thumbnail.js — a still portrait of a creature, as a PNG data URL.
//
// This is what a saved specimen's card shows. It is deliberately NOT a crop of
// the tank (21 §7.2, "an isolated 3D view, not a crop of the tank"): the tank
// composites six creatures at once and the frame is never square. So this builds
// the one creature in its own scene, at rest, in its own throwaway WebGL context.
//
// No physics — a portrait is a rest pose, and morphogenesis fully determines the
// body without a sim.
//
// ── WHAT WAS WRONG WITH THE OLD PORTRAITS, AND WHY EACH FIX IS HERE ────────
//
// 1. IT AIMED AT THE WRONG POINT. The comment that used to sit at line 65 said
//    "buildCreature centres the group on the creature's centre of mass, so the
//    body sits at the origin". It does not. `place()` writes raw
//    `plan.bodies[i].position` and morphogenesis puts the ROOT BODY at the
//    origin (morphogen.js:74) with children growing outward — while
//    `boundingRadius(plan)` is measured about the CENTRE OF MASS
//    (morphogen.js:394). For an elongated animal the two are far apart and the
//    far end sits outside the framed sphere. That was the clipping, and it got
//    worse at A2 because the spine sub-grammar made elongated animals common.
//
// 2. THE FIT OVER-FRAMED ANYWAY. `radius / sin(halfFov) * 1.35` fits a SPHERE
//    against the vertical FOV and then adds another 35%, so even a
//    correctly-aimed portrait spent most of its pixels on empty water.
//
//    Both are fixed by the same thing, and it already existed: `fitOrbit`
//    (tank.js) projects real mesh vertices through the real camera and solves
//    for a target NDC — no analytic padding term to get wrong — and
//    `FIT.portrait` was authored for exactly this call and was referenced
//    nowhere. A still portrait visits ONE yaw, so it is fitted at one yaw;
//    fitOrbit's own doc-comment says to sample the angles the view visits.
//
// 3. THE BACKDROP COMPETED WITH THE SUBJECT. See createStudio in tank.js.
//
// N16: no hex, no raw px — colours and intensities are token reads through
// createStudio, the size is a caller argument in device pixels (an image
// dimension, not a layout one).

import * as THREE from 'three';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { buildCreature, disposeCreature, tokenNumber } from './creature.js';
import {
  createStudio, disposeStudio, placeStudioGround, renderVignette, fitOrbit, FIT,
} from './tank.js';

/**
 * Bumped whenever the render look changes (materials, backdrop, light rig).
 * Stamped onto saved specimens so a stale thumbnail — one baked by an earlier
 * look — can be detected and re-rendered rather than shown next to the new tank.
 *
 * `reef-1` -> `studio-1`: new backdrop, new rig, new framing, 1024. NOTHING BUT
 * `seedAtlas` EVER COMPARED THIS TAG, and only for authored records, so every
 * player-saved specimen kept its old photo forever. `isStale()` below is the
 * missing half; ui/screens/atlas.js re-renders on it.
 */
export const RENDER_TAG = 'studio-2';

/** Portraits are rendered at this edge length unless a caller says otherwise. */
export const PORTRAIT_SIZE = 1024;

/**
 * A single fixed yaw, and the same one every portrait uses.
 *
 * An atlas is only comparable if every plate is shot from the same angle — that
 * is the whole argument in `layoutAtlas`, and it applies at least as strongly to
 * cards seen side by side. Three-quarters, because a pure profile hides limb
 * count and a pure front hides length.
 */
const PORTRAIT_YAW = 0.62;

/**
 * True when a saved specimen's portrait was baked by an older look.
 *
 * @param {object} specimen  a stored record, or its `render` field
 */
export function isStale(specimen) {
  const tag = typeof specimen === 'string' ? specimen : specimen?.render;
  return tag !== RENDER_TAG;
}

/**
 * Render `genome` to a square PNG data URL.
 *
 * ⚠ THE NOTE THAT USED TO BE HERE IS WRONG AND IS KEPT ONLY AS A WARNING. It
 * read "a fresh renderer per call, torn down before returning", and that is what
 * the code did — but `dispose()` does not release a WebGL context, so every call
 * leaked one until the browser hit its cap and killed the TANK's context. See
 * `portraitRenderer` below for the measurement and the repair. A portrait is
 * taken rarely (when the player saves, when the authored library is seeded, or
 * once per specimen when the look changes), and a persistent second WebGL context
 * would sit alongside the tank's for the life of the app for no reason.
 *
 * @param {object} genome
 * @param {object} [opts]
 * @param {string} [opts.worldId='w1']  which world's --pal ramp to use
 * @param {number} [opts.size]          output edge length, device px
 * @returns {string} a `data:image/png;base64,...` URL
 */
export function renderThumbnail(genome, { worldId = 'w1', size = PORTRAIT_SIZE } = {}) {
  const plan = morphogenesis(genome);
  const scene = new THREE.Scene();

  // preserveDrawingBuffer so toDataURL() sees the frame we just drew. alpha off:
  // a translucent body needs something behind it — a transparent backdrop leaves
  // the shell reading as glass over nothing — and the studio plate is that.
  const renderer = portraitRenderer(size);

  const studio = createStudio(scene, worldId);

  // Full detail — a still portrait is the one place the membrane always earns
  // its cost.
  const group = buildCreature(plan, genome, { worldId, detail: 'full' });
  group.rotation.y = -PORTRAIT_YAW;
  scene.add(group);
  // fitOrbit reads o.matrixWorld off every mesh, so the group's transform has to
  // be resolved before it is measured.
  group.updateMatrixWorld(true);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
  // `eyeRatio`, NOT `FIT.portrait`'s `eyeHalfY` alone. fitOrbit's own note warns
  // about exactly this: an eye offset scaled from the subject's HEIGHT leaves the
  // camera in the plane of anything flat. Half this Atlas is eels — 20:1 rods
  // with almost no Y extent — so `eyeHalfY: 0.1` put the camera level with the
  // ground shadow, which then rendered as a hard horizon line across the plate.
  // A fraction of DEPTH gives every specimen the same gentle three-quarter
  // elevation whatever its own proportions are.
  const fit = fitOrbit(camera, [group], { ...FIT.portrait, eyeRatio: 0.30, yaws: [0] });
  camera.position.set(fit.centre.x, fit.eye, fit.centre.z + fit.distance);
  camera.lookAt(fit.centre);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  placeStudioGround(studio, new THREE.Box3().setFromObject(group));

  renderer.render(scene, camera);
  renderVignette(renderer, studio);
  const url = renderer.domElement.toDataURL('image/png');

  // Give the GPU back everything the PORTRAIT owned. The renderer itself is
  // shared and deliberately outlives the call — see `portraitRenderer`.
  disposeCreature(group);
  disposeStudio(studio);

  return url;
}

/**
 * ── ONE PORTRAIT RENDERER, REUSED. THIS WAS A BLACK-SCREEN BUG. ──────────────
 *
 * This function used to build `new THREE.WebGLRenderer(...)` per call and drop
 * it with `renderer.dispose()`. `dispose()` releases three.js's own GPU objects
 * and DOES NOT RELEASE THE WEBGL CONTEXT — the context lives until the canvas is
 * garbage collected, which is not prompt and is not under our control.
 *
 * Browsers cap live WebGL contexts and evict the OLDEST when the cap is passed.
 * The oldest context in this app is the tank's. So rendering enough portraits
 * silently killed the thing the player is looking at, and the tank went black
 * while the simulation kept running — which is exactly what it looked like,
 * because the physics is Rapier on the CPU and never noticed.
 *
 * MEASURED, in the shipped build: with the tank's context alive, portraits were
 * rendered one at a time and the tank's context was checked after each. It
 * survived 8 and was LOST ON THE 16TH — Chrome's cap. `seedAtlas()` renders one
 * portrait per library entry, 21 of them, in a burst at first load. That is the
 * "black on first load" report, and phones hit it harder because their cap is
 * lower and their GPU memory is smaller.
 *
 * A shared renderer fixes the cause rather than the symptom, and it is also the
 * faster answer: creating a WebGL context is expensive, and the old code paid
 * for 21 of them before the first screen appeared.
 *
 * `preserveDrawingBuffer` is required so `toDataURL()` sees the frame that was
 * just drawn; it is set once here rather than per portrait.
 */
let _portrait = null;
function portraitRenderer(size) {
  // A context can still be lost for reasons outside this file — GPU reset, a
  // backgrounded tab on a phone reclaiming memory. Rebuild rather than hand back
  // a dead renderer and return a blank portrait.
  if (_portrait && _portrait.getContext().isContextLost?.()) {
    try { _portrait.dispose(); } catch { /* already gone */ }
    _portrait = null;
  }
  if (!_portrait) {
    _portrait = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    _portrait.setPixelRatio(1);            // `size` is already the pixel count
    _portrait.toneMapping = THREE.ACESFilmicToneMapping;
    _portrait.outputColorSpace = THREE.SRGBColorSpace;
  }
  // Per call: the exposure token can change with the theme, and callers may ask
  // for different sizes.
  _portrait.setSize(size, size, false);
  _portrait.toneMappingExposure = tokenNumber('--tank-exposure');
  return _portrait;
}

/**
 * Release the shared portrait context. Nothing calls this in the app — the
 * renderer is meant to live for the session — but a harness that tears the
 * module down should have a way to hand the context back rather than rely on GC,
 * which is the whole mistake this file just came out of.
 */
export function disposePortraitRenderer() {
  if (!_portrait) return;
  try { _portrait.forceContextLoss?.(); } catch { /* best effort */ }
  try { _portrait.dispose(); } catch { /* best effort */ }
  _portrait = null;
}
