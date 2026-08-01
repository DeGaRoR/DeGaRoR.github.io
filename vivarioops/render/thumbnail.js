// render/thumbnail.js — a still portrait of a creature, as a PNG data URL.
//
// This is what a saved specimen's card shows. It is deliberately NOT a crop of
// the tank (21 §7.2, "an isolated 3D view, not a crop of the tank"): the tank
// composites six creatures at once and the frame is never square. So this builds
// the one creature in its own scene, at rest, in its own throwaway WebGL context.
//
// No physics — a portrait is a rest pose, and morphogenesis fully determines the
// body without a sim. It reuses render/tank.js createWater() for the reef water
// and the four-light rig, so a card and the live tank cannot disagree about how
// an animal is lit or coloured. The atmosphere (sun shafts, mote layers) is turned
// off: a single specimen at close range wants a clean plate, not weather.
//
// N16: no hex, no raw px — colours/intensities are token reads via createWater,
// the size is a caller argument in device pixels (an image dimension).

import * as THREE from 'three';
import { morphogenesis, boundingRadius } from '../engine/l1/morphogen.js';
import { buildCreature, disposeCreature, tokenNumber } from './creature.js';
import { createWater, disposeWater, setMotesVisible } from './tank.js';

/**
 * Bumped whenever the render look changes (materials, water, light rig). Stamped
 * onto saved specimens so a stale thumbnail — one baked by an earlier look — can
 * be detected and re-rendered rather than shown next to the new tank.
 */
export const RENDER_TAG = 'reef-1';

/**
 * Render `genome` to a square PNG data URL.
 *
 * A fresh renderer per call, torn down before returning: a portrait is taken
 * rarely (only when the player saves, or when the authored library is seeded),
 * and a persistent second WebGL context would sit alongside the tank's for the
 * life of the app for no reason.
 *
 * @param {object} genome
 * @param {object} [opts]
 * @param {string} [opts.worldId='w1']  which world's --pal / --tank ramp to use
 * @param {number} [opts.size=512]      output edge length, device px
 * @returns {string} a `data:image/png;base64,...` URL
 */
export function renderThumbnail(genome, { worldId = 'w1', size = 512 } = {}) {
  const plan = morphogenesis(genome);
  const radius = boundingRadius(plan);

  const scene = new THREE.Scene();

  // preserveDrawingBuffer so toDataURL() sees the frame we just drew. alpha off:
  // a translucent body needs the water behind it, exactly as in the tank — a
  // transparent backdrop would leave the shell reading as glass over nothing.
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.setPixelRatio(1);   // `size` is already the pixel count we want
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = tokenNumber('--tank-exposure');
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // The tank's reef water + four-light rig, verbatim — but no drifting weather on
  // a specimen plate: hide the sun shafts and both mote layers.
  const water = createWater(scene, worldId);
  water.shafts.visible = false;
  setMotesVisible(water, false);

  // buildCreature centres the group on the creature's centre of mass, so the body
  // sits at the origin and the camera can simply look at it. Full detail — a still
  // portrait is the one place the membrane always earns its cost.
  const group = buildCreature(plan, genome, { worldId, detail: 'full' });
  scene.add(group);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
  // Frame the bounding sphere: distance = r / sin(halfFov), plus margin so the
  // creature never touches the edge. A gentle 3/4 view (above and to the side)
  // matches the tank's default orbit and reads as a specimen, not an elevation.
  const halfFov = (camera.fov * Math.PI) / 180 / 2;
  const dist = (radius / Math.sin(halfFov)) * 1.35;
  const az = 0.6, el = 0.42;   // radians — azimuth, elevation
  camera.position.set(
    dist * Math.cos(el) * Math.sin(az),
    dist * Math.sin(el),
    dist * Math.cos(el) * Math.cos(az),
  );
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');

  // Give the GPU everything back — this context does not outlive the portrait.
  disposeCreature(group);
  disposeWater(water);
  renderer.dispose();

  return url;
}
