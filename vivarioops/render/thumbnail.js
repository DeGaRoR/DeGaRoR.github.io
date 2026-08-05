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
 * A fresh renderer per call, torn down before returning: a portrait is taken
 * rarely (when the player saves, when the authored library is seeded, or once
 * per specimen when the look changes), and a persistent second WebGL context
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
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.setPixelRatio(1);   // `size` is already the pixel count we want
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = tokenNumber('--tank-exposure');
  renderer.outputColorSpace = THREE.SRGBColorSpace;

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

  // Give the GPU everything back — this context does not outlive the portrait.
  disposeCreature(group);
  disposeStudio(studio);
  renderer.dispose();

  return url;
}
