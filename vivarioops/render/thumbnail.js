// render/thumbnail.js — a still portrait of a creature, as a PNG data URL.
//
// This is what a saved specimen's card shows. It is deliberately NOT a crop of
// the tank (21 §7.2, "an isolated 3D view, not a crop of the tank"): the tank
// composites six creatures at once and the frame is never square. So this builds
// the one creature in its own scene, at rest, in its own throwaway WebGL context.
//
// No physics — a portrait is a rest pose, and morphogenesis fully determines the
// body without a sim. The lighting mirrors ui/screens/tank.js (its key/hemi/rim +
// PMREM IBL) so the portrait reads like the animal the player just chose.
//
// N16: no hex, no raw px — colours are ramp/token reads, the size is a caller
// argument in device pixels (an image dimension, not a layout literal).

import * as THREE from 'three';
import { morphogenesis, boundingRadius } from '../engine/l1/morphogen.js';
import { buildCreature, disposeCreature, token, rampFor } from './creature.js';

/** A vertical equirectangular gradient CanvasTexture — mirrors tank.js's water. */
function equirectGradient(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, `#${top.getHexString()}`);
  grad.addColorStop(1, `#${bottom.getHexString()}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/**
 * Render `genome` to a square PNG data URL.
 *
 * A fresh renderer per call, torn down before returning: a portrait is taken
 * rarely (only when the player saves), and a persistent second WebGL context
 * would sit alongside the tank's for the life of the app for no reason.
 *
 * @param {object} genome
 * @param {object} [opts]
 * @param {string} [opts.worldId='w1']  which --pal-<id>-* ramp to light/colour with
 * @param {number} [opts.size=512]      output edge length, device px
 * @returns {string} a `data:image/png;base64,...` URL
 */
export function renderThumbnail(genome, { worldId = 'w1', size = 512 } = {}) {
  const plan = morphogenesis(genome);
  const radius = boundingRadius(plan);

  const bg = new THREE.Color(token('--c-bg'));
  const ramp = rampFor(worldId);
  const scene = new THREE.Scene();

  // preserveDrawingBuffer so toDataURL() sees the frame we just drew. alpha off:
  // the membrane is transmissive and needs the water behind it to refract, exactly
  // as in the tank — a transparent backdrop would leave the shell reading as glass
  // over nothing.
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.setPixelRatio(1);   // `size` is already the pixel count we want
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Water background + PMREM IBL from the ramp — the tank's setup, verbatim.
  const waterTex = equirectGradient(new THREE.Color(token('--c-water-0')), bg);
  scene.background = waterTex;
  scene.backgroundIntensity = 2.6;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envSource = equirectGradient(ramp[2], bg);
  const envRT = pmrem.fromEquirectangular(envSource);
  scene.environment = envRT.texture;
  envSource.dispose();
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2.5, 5, 3);
  scene.add(key);
  scene.add(new THREE.HemisphereLight(ramp[1].clone(), bg.clone(), 0.75));
  const rim = new THREE.DirectionalLight(ramp[2].clone(), 1.7);
  rim.position.set(-2, 1.2, -4);
  scene.add(rim);

  // buildCreature centres the group on the creature's centre of mass, so the body
  // sits at the origin and the camera can simply look at it.
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
  waterTex.dispose();
  envRT.dispose();
  renderer.dispose();

  return url;
}
