// render/tank.js — the water, the light rig, the two arrangements, and framing.
//
// Everything a creature is seen THROUGH or AGAINST lives here. creature.js owns
// the animal; this file owns the tank.
//
// N16: every number and colour comes from tokens.css. See tokens.additions.css
// for the --tank-* block.

import * as THREE from 'three';
import { token, tokenNumber, rampFor } from './creature.js';

/* ───────────────────────── water ────────────────────────────────────────── */

function gradientTexture(topHex, bottomHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 8; canvas.height = 64;
  const g = canvas.getContext('2d');
  const lg = g.createLinearGradient(0, 0, 0, 64);
  lg.addColorStop(0, topHex);
  lg.addColorStop(1, bottomHex);
  g.fillStyle = lg;
  g.fillRect(0, 0, 8, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas, tex };
}

/** Soft vertical shaft. One texture, shared by every quad and every view. */
function shaftTexture() {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 256;
  const g = c.getContext('2d'), im = g.createImageData(32, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 32; x++) {
      const dx = (x - 15.5) / 15.5, o = (y * 32 + x) * 4;
      im.data[o] = im.data[o + 1] = im.data[o + 2] = 255;
      im.data[o + 3] = Math.round(255 * Math.exp(-dx * dx * 4.5) * Math.pow(1 - y / 255, 1.7));
    }
  }
  g.putImageData(im, 0, 0);
  return new THREE.CanvasTexture(c);
}

/** Round dot for motes. An untextured attenuated point renders as a filled
 *  square, and near-camera ones read as glitch pixels. */
function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)');
  rg.addColorStop(0.3, 'rgba(255,255,255,.4)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

let sharedShaft = null, sharedDot = null;

/**
 * Build the water, the light rig and the drifting detail into `scene`.
 *
 * ONE equirect gradient is background AND environment, so a reflection can never
 * disagree with the water it is reflecting, and the fog takes the world's mid
 * stop so distance reads as depth rather than as haze.
 *
 * @param {THREE.Scene} scene
 * @param {string} worldId
 * @returns {object} handles — pass to updateWater() each frame, disposeWater() at teardown
 */
export function createWater(scene, worldId = 'w1') {
  const ramp = rampFor(worldId);
  const surface = token(`--tank-${worldId}-surface`);
  const mid = token(`--tank-${worldId}-mid`);
  const deep = token(`--tank-${worldId}-deep`);

  const sky = gradientTexture(surface, deep);
  scene.background = sky.tex;
  scene.environment = sky.tex;
  scene.backgroundIntensity = tokenNumber('--tank-bg-intensity');
  scene.environmentIntensity = tokenNumber('--tank-env-intensity');

  // Four sources plus the image-based light, each with exactly one job.
  const sun = new THREE.DirectionalLight(0xffffff, tokenNumber('--tank-sun-intensity'));
  sun.position.set(1.4, 6, 2.2);
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(
    new THREE.Color(surface), new THREE.Color(deep), tokenNumber('--tank-hemi-intensity'));
  scene.add(hemi);

  // Off the sand, from below and behind: what stops a body silhouetting flat
  // against bright water.
  const bounce = new THREE.DirectionalLight(ramp[2].clone(), tokenNumber('--tank-bounce-intensity'));
  bounce.position.set(-2.6, -1.8, -3);
  scene.add(bounce);

  // Side-back separation. NEVER white: an out-of-ramp light paints colour onto a
  // creature that its genes cannot own, which falsifies the palette contract.
  const rim = new THREE.DirectionalLight(ramp[2].clone(), tokenNumber('--tank-rim-intensity'));
  rim.position.set(-4, 1.6, -2.2);
  scene.add(rim);

  // Sun shafts as a SCREEN-SPACE OVERLAY, drawn in their own orthographic pass on
  // top of the water (renderOverlay(), called by the tank after the main render).
  // World-space quads go edge-on and vanish as the camera orbits, and even a
  // billboard tilts and reads oddly; a screen-locked overlay is exactly "a couple
  // of shafts rendered over" — always vertical, always facing the viewer, and it
  // cannot degenerate. No volumetrics — a raymarched pass is too heavy for a phone
  // (README §7). Positions/opacity drift in updateWater(); the ortho frustum is
  // NDC (-1..1) so a plane's size is a fraction of the viewport at any aspect.
  sharedShaft = sharedShaft ?? shaftTexture();
  const shaftOpacity = tokenNumber('--tank-shaft-opacity');
  const overlayScene = new THREE.Scene();
  const overlayCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const shafts = new THREE.Group();
  const shaftCount = tokenNumber('--tank-shaft-count');
  for (let i = 0; i < shaftCount; i++) {
    const f = shaftCount > 1 ? i / (shaftCount - 1) : 0.5;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24 + 0.10 * (i % 2), 2.8),   // tall enough to overscan top & bottom
      new THREE.MeshBasicMaterial({
        map: sharedShaft, color: new THREE.Color(surface),
        blending: THREE.AdditiveBlending, transparent: true,
        opacity: shaftOpacity, depthWrite: false, depthTest: false, fog: false,
      }));
    m.position.set((f - 0.5) * 1.4, 0.3, 0);                 // spread across x, biased up
    m.rotation.z = (i - (shaftCount - 1) / 2) * 0.12;        // a faint fan
    m.userData.x0 = m.position.x;
    shafts.add(m);
  }
  overlayScene.add(shafts);

  // TWO particle layers at different depths and drift rates. One layer of
  // uniform dots reads as dirt on the lens; parallax between two reads as water.
  sharedDot = sharedDot ?? dotTexture();
  const makeLayer = (count, spread, size, opacity, seed) => {
    const pos = new Float32Array(count * 3);
    let a = seed >>> 0;
    const rnd = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rnd() - 0.5) * spread;
      pos[i * 3 + 1] = (rnd() - 0.5) * spread * 0.62;
      pos[i * 3 + 2] = (rnd() - 0.5) * spread;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(geo, new THREE.PointsMaterial({
      color: ramp[3].clone(), map: sharedDot, size, sizeAttenuation: false,
      transparent: true, opacity, depthWrite: false,
    }));
  };
  const motes = new THREE.Group();
  const far = makeLayer(tokenNumber('--tank-motes-far-count'), 15,
    tokenNumber('--tank-motes-far-size'), tokenNumber('--tank-motes-far-opacity'), 7);
  const near = makeLayer(tokenNumber('--tank-motes-near-count'), 9,
    tokenNumber('--tank-motes-near-size'), tokenNumber('--tank-motes-near-opacity'), 91);
  motes.add(far, near);
  scene.add(motes);

  return { sky, sun, hemi, bounce, rim, shafts, shaftOpacity, overlayScene, overlayCam, motes, far, near, fogColour: new THREE.Color(mid) };
}

/**
 * Water is never still. Three transform writes a frame, no per-particle work.
 * @param {object} water  from createWater()
 * @param {number} t      seconds
 */
export function updateWater(water, t) {
  water.far.position.set(Math.sin(t * 0.05) * 0.5, (t * 0.035) % 3 - 1.5, 0);
  water.near.position.set(Math.sin(t * 0.09 + 1) * 0.9, (t * 0.075) % 2.4 - 1.2, 0);
  // Screen-space shafts: each drifts sideways and breathes in opacity, slightly
  // out of phase, so the light reads as moving water rather than a fixed gradient.
  const chn = water.shafts.children;
  for (let i = 0; i < chn.length; i++) {
    const m = chn[i];
    m.position.x = m.userData.x0 + Math.sin(t * 0.08 + i * 1.3) * 0.05;
    m.material.opacity = water.shaftOpacity * (0.6 + 0.4 * Math.sin(t * 0.25 + i * 1.7));
  }
}

/**
 * Draw the sun-shaft overlay on top of the already-rendered water. Call from the
 * tank AFTER renderer.render(scene, camera). It leaves the colour buffer intact
 * (additive), clears only depth so the shafts sit over everything, and restores
 * autoClear so the next frame's main render clears normally.
 */
export function renderOverlay(renderer, water) {
  const prev = renderer.autoClear;
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(water.overlayScene, water.overlayCam);
  renderer.autoClear = prev;
}

export function setMotesVisible(water, on) { water.motes.visible = on; }

/**
 * Size the atmosphere (sun shafts + mote layers) to the scene it sits in.
 *
 * The shafts and motes are authored in a small unit-space; a metre-scale tank
 * leaves them tiny and clumped at the origin. This scales both groups to fill a
 * given [w, h, d] box, and lifts the shafts so their bright top edge sits ABOVE
 * the frame — otherwise the hard edge reads as a visible "origin" for the rays.
 * Call after the arrangement is laid out, and again whenever it changes.
 *
 * @param {object} water  from createWater()
 * @param {number[]} size [w, h, d] world extent the atmosphere should fill
 */
export function fitAtmosphere(water, [w, h, d]) {
  // Shafts are a screen-space overlay now (fixed in NDC), so nothing to size here.
  // Motes authored in a ~15-wide box with a compressed Y. Scale to fill the whole
  // volume so they read as suspended water, not a clump at the centre.
  water.motes.scale.set(w / 13, h / 11, d / 13);
}

export function disposeWater(water) {
  water.sky.tex.dispose();
  // Each shaft mesh owns its geometry + material; the shared shaft/dot textures
  // persist for reuse across rebuilds (module-level), so they are not disposed.
  water.shafts.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  water.motes.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
}

/* ───────────────────────── arrangements ─────────────────────────────────── */

/**
 * MAIN SCREEN. Portrait, six specimens, camera orbits slowly.
 *
 * A tall HELIX, not a ring: a portrait frame has to spend its budget on height,
 * and a ring seen on a phone collapses into a band across the middle. Radius
 * must stay under half the vertical spread — in a 2:1 portrait the horizontal
 * half-FOV is half the vertical, so a wide helix makes X bind the camera fit and
 * leaves the height unspent.
 *
 * Bodies passing in front of each other is intended here: occlusion is what
 * gives the tank depth, once the arrangement is no longer a comparison plate.
 */
export function layoutPortrait(groups) {
  groups.forEach((g, i) => {
    const a = i * 2.12 + 0.3;
    const rad = 0.6 + (i % 3) * 0.3;
    g.position.set(Math.cos(a) * rad, (i - 2.5) * 1.65, Math.sin(a) * rad);
    g.rotation.y = -a + Math.PI / 2 + 0.3;
    g.scale.setScalar(0.76 + ((i * 29) % 4) * 0.12);
  });
}

/**
 * ATLAS PLATE. Columns in X, rows in Y, camera on +Z, near-static.
 *
 * Same cell, same distance, same yaw for every specimen — that is what makes an
 * atlas comparable rather than a collage.
 *
 * Cells are size-NORMALISED: measured off the built mesh and scaled so the
 * longest axis fills the cell. A plate that shows true relative size wastes five
 * cells on the largest animal and makes the smallest a speck; real size belongs
 * in the entry as a number.
 *
 * @param {THREE.Group[]} groups  up to cols*rows
 */
export function layoutAtlas(groups, cols = 3, rows = 2, cell = 2.7) {
  const box = new THREE.Box3(), size = new THREE.Vector3();
  groups.forEach((g, i) => {
    g.position.set(0, 0, 0);
    g.scale.setScalar(1);
    g.rotation.set(0, -1.35, 0);
    g.updateMatrixWorld(true);
    box.setFromObject(g).getSize(size);
    g.scale.setScalar(cell / Math.max(size.x, size.y, size.z, 1e-3));
    g.position.set(
      ((i % cols) - (cols - 1) / 2) * (cell * 1.33),
      ((rows - 1) / 2 - Math.floor(i / cols)) * (cell * 0.89),
      0,
    );
  });
}

/* ───────────────────────── framing ──────────────────────────────────────── */

/** World-space vertex sample of the actual bodies — the silhouette, not a box.
 *  Sprites are excluded: a halo is several times the body's size and would frame
 *  the luminous specimen smallest of the set. */
function meshPoints(groups, stride = 7) {
  const pts = [];
  for (const g of groups) {
    g.traverse(o => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i += stride) {
        pts.push(new THREE.Vector3(a.getX(i), a.getY(i), a.getZ(i)).applyMatrix4(o.matrixWorld));
      }
    });
  }
  return pts;
}

/**
 * Solve the orbit distance by PROJECTING real mesh vertices through the real
 * camera at every yaw the view will actually visit, and scaling until the worst
 * one lands on the target NDC. No analytic padding term to get wrong, and no
 * hand-tuned distance constant.
 *
 * TWO THINGS TO GET RIGHT, both of which we got wrong first:
 *   - Sample the yaws the view VISITS. Fitting a near-static plate over ±0.6 rad
 *     solves for angles never seen and leaves the subject small in an empty frame.
 *   - Match the subject's aspect to the frame's. The fit drives the WORST of
 *     |NDC.x| / |NDC.y| to target, so a subject far wider than the frame
 *     satisfies X and leaves Y under-filled.
 *
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.Group[]} groups
 * @param {object} [o]
 * @param {number[]} [o.yaws]     radians to sample; default a full 16-step orbit
 * @param {number} [o.target=0.92] NDC the worst vertex should land on
 * @param {number} [o.eyeRatio]   camera height above centre, as a fraction of depth
 * @returns {{distance, centre, eye, near, far}}  near/far are ready for THREE.Fog
 */
export function fitOrbit(camera, groups, o = {}) {
  const yaws = o.yaws ?? Array.from({ length: 16 }, (_, i) => i * Math.PI / 8);
  const target = o.target ?? 0.92;

  const pts = meshPoints(groups);
  const box = new THREE.Box3().setFromPoints(pts);
  box.expandByScalar(0.12);                 // slack for fin flutter and the bob
  const centre = box.getCenter(new THREE.Vector3());
  const halfY = (box.max.y - box.min.y) / 2;
  const depth = Math.hypot(box.max.x - centre.x, box.max.z - centre.z);

  // A ring has almost no Y extent, so an eye offset scaled from halfY leaves the
  // camera IN its plane and it projects as a line. Look down on arrangements;
  // stay level with plates.
  const eyeOff = (o.eyeRatio ?? 0) * depth + (o.eyeHalfY ?? 0) * halfY;

  let d = 0;
  for (const q of pts) d = Math.max(d, q.distanceTo(centre) * 2.5);
  const view = new THREE.Vector3(), clip = new THREE.Vector3();
  for (let it = 0; it < 30; it++) {
    let worst = 0;
    for (const th of yaws) {
      camera.position.set(centre.x + Math.sin(th) * d, centre.y + eyeOff, centre.z + Math.cos(th) * d);
      camera.lookAt(centre);
      camera.updateMatrixWorld(true);
      for (const q of pts) {
        view.copy(q).applyMatrix4(camera.matrixWorldInverse);
        if (-view.z <= camera.near) continue;   // behind the near plane: |NDC| explodes
        clip.copy(view).applyMatrix4(camera.projectionMatrix);
        worst = Math.max(worst, Math.abs(clip.x), Math.abs(clip.y));
      }
    }
    if (!isFinite(worst) || worst <= 0) break;
    if (Math.abs(worst - target) < 0.005) break;
    d *= Math.pow(worst / target, 0.8);
  }

  return {
    distance: d,
    centre,
    eye: centre.y + eyeOff,
    // Fog sits BEHIND the ensemble in bright water, or every body is veiled and
    // the chroma the ramp bought is spent on haze.
    near: d + depth * 0.15,
    far: d + depth * 4,
  };
}

/** Recommended fit arguments per arrangement. */
export const FIT = {
  portrait: { target: 0.97, eyeHalfY: 0.1 },
  atlas: { target: 0.94, yaws: [-0.07, -0.035, 0, 0.035, 0.07] },
};
