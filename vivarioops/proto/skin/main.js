// proto/skin/main.js — the harness. Side by side, same genome, same pose.
//
// PROTOTYPE. Nothing here is imported by the app.
//
// THE COMPARISON IS THE POINT. A fused animal on its own always looks acceptable;
// the question is whether it is better than what ships, on the same creature, at
// the same instant, under the same light. So both are built from one genome and
// driven from one pose array — the reference by walking userData.bodyIndex
// exactly as vivarium.js:1385 does, the fused one by writing the same transforms
// into bones. If the two disagree, the skinning is wrong and it is visible
// immediately rather than as a vague feeling that something moved oddly.

import * as THREE from 'three';

import { morphogenesis } from '../../engine/l1/morphogen.js';
import { createRandomGenome } from '../../engine/l1/factory.js';
import { makeRng } from '../../trunk/rng.js';
import { SEEDS } from '../../worlds/seeds.js';
import { buildCreature, disposeCreature } from '../../render/creature.js';

import { buildAnatomy } from './anatomy.js';
import { makeField } from './field.js';
import { surfaceNet } from './march.js';
import { buildShellGeometry, buildShellGroup, disposeShell } from './shell.js';
import { buildSkinnedCreature, disposeSkinnedCreature, bakeWeightColours } from './rig.js';
import { makePoseDriver } from './pose.js';

const $ = (id) => document.getElementById(id);

/* ── scene ────────────────────────────────────────────────────────────────── */

// preserveDrawingBuffer so the canvas can be read back after a render, the same
// reason render/thumbnail.js:103 sets it. Proto only — it costs a copy per frame.
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
// Same tone curve as the tank and the portrait studio. render/creature.js's
// materials are authored against ACES and compensate for its knee, so judging
// them under anything else judges the wrong thing.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#08131c');

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400);

scene.add(new THREE.HemisphereLight('#9fd8ff', '#0a1a24', 1.1));
const key = new THREE.DirectionalLight('#ffffff', 2.4);
key.position.set(-2.4, 3.4, 3.2);
scene.add(key);
const rim = new THREE.DirectionalLight('#7fd9d0', 1.4);
rim.position.set(1.6, 1.2, -3.4);
scene.add(rim);

// An environment, so MeshPhysicalMaterial's clearcoat and sheen have something
// to reflect. Without one the reference build renders flat and the comparison is
// unfair to it.
{
  const c = document.createElement('canvas');
  c.width = 8; c.height = 64;
  const g = c.getContext('2d').createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#bfe9ff');
  g.addColorStop(0.55, '#2c6d8f');
  g.addColorStop(1, '#050d14');
  const ctx = c.getContext('2d');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  scene.environment = tex;
  scene.environmentIntensity = 0.7;
}

/* ── orbit, hand-rolled (OrbitControls is not vendored) ───────────────────── */

const orbit = { theta: 0.6, phi: 1.25, dist: 8, target: new THREE.Vector3() };
let dragging = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => {
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointerup', () => { dragging = false; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  orbit.theta -= (e.clientX - lastX) * 0.008;
  orbit.phi = Math.max(0.08, Math.min(Math.PI - 0.08, orbit.phi - (e.clientY - lastY) * 0.008));
  lastX = e.clientX; lastY = e.clientY;
});
renderer.domElement.addEventListener('wheel', (e) => {
  e.preventDefault();
  orbit.dist = Math.max(0.6, Math.min(200, orbit.dist * (1 + Math.sign(e.deltaY) * 0.12)));
}, { passive: false });

function placeCamera() {
  const sp = Math.sin(orbit.phi);
  camera.position.set(
    orbit.target.x + orbit.dist * sp * Math.sin(orbit.theta),
    orbit.target.y + orbit.dist * Math.cos(orbit.phi),
    orbit.target.z + orbit.dist * sp * Math.cos(orbit.theta),
  );
  camera.lookAt(orbit.target);
}

/* ── the specimen ─────────────────────────────────────────────────────────── */

const WEIGHT_PALETTE = [
  '#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c780e8', '#ff9f45',
  '#3ddad7', '#f473b9', '#a3e635', '#38bdf8', '#fb7185', '#facc15',
];

const state = {
  plan: null, genome: null, driver: null,
  refGroup: null, skinGroup: null, innerGroup: null, skinMat: null,
  stats: null, buildMs: 0, offset: 1, shell: false,
};

function genomeFor(kind, seed) {
  if (kind === 'random') return createRandomGenome(makeRng(seed >>> 0));
  const s = SEEDS.find((e) => e.id === kind);
  if (!s) throw new Error(`unknown genome ${kind}`);
  return s.genome;
}

function clearSpecimen() {
  for (const key of ['refGroup', 'innerGroup']) {
    if (state[key]) { scene.remove(state[key]); disposeCreature(state[key]); state[key] = null; }
  }
  if (state.skinGroup) {
    scene.remove(state.skinGroup);
    (state.shell ? disposeShell : disposeSkinnedCreature)(state.skinGroup);
    state.skinGroup = null;
  }
}

function rebuild() {
  const kind = $('genome').value;
  const seed = Number($('seed').value) || 0;
  const blendFactor = Number($('blend').value);
  const res = Number($('res').value);
  const mode = $('mode').value;

  clearSpecimen();

  const genome = genomeFor(kind, seed);
  const plan = morphogenesis(genome);
  state.genome = genome;
  state.plan = plan;
  state.driver = makePoseDriver(plan, genome);
  state.shell = mode.startsWith('shell');

  // Shell offset is given RELATIVE TO THE ANIMAL'S GIRTH, not in world units: a
  // fixed offset is a tight film on a whale and a balloon on a shrimp, and the
  // corpus contains both.
  const girthRef = Math.max(...plan.bodies.map((b) => Math.min(b.dims[0], b.dims[1]))) * 0.5;
  const inflate = Number($('inflate').value) * girthRef;

  const t0 = performance.now();
  let geometry, stats;
  if (mode === 'sdf') {
    // Experiment 1, kept for the comparison that retired it.
    const field = makeField(plan, { blendFactor });
    ({ geometry, stats } = surfaceNet(field, { res }));
  } else if (mode === 'anatomy') {
    ({ geometry, stats } = buildAnatomy(plan, genome, {
      waist: blendFactor * 0.36,       // the blend slider becomes the waist depth
      radial: Math.max(6, Math.round(res * 4)),
    }));
  } else {
    ({ geometry, stats } = buildShellGeometry(plan, genome, {
      source: mode === 'shell-loft' ? 'loft' : 'sdf',
      inflate, blend: blendFactor, res,
    }));
  }
  state.buildMs = performance.now() - t0;
  state.stats = stats;

  if (state.shell) {
    state.skinGroup = buildShellGroup(plan, geometry, { opacity: Number($('opacity').value) });
    // THE POINT OF THIS EXPERIMENT: the shipped render, untouched, INSIDE the
    // envelope. Not a replacement for it.
    state.innerGroup = buildCreature(plan, genome, { worldId: 'w1', detail: innerDetail() });
    state.skinGroup.add(state.innerGroup);
  } else {
    const mat = new THREE.MeshPhysicalMaterial({
      color: '#7fb6a8',
      roughness: 0.45,
      metalness: 0.02,
      sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color('#cfe9ff'),
      clearcoat: 0.35, clearcoatRoughness: 0.35,
      // Not DoubleSide: a one-sided render is the honest test. A hole in the
      // surface has to look like a hole, or the whole point of a watertight mesh
      // goes unverified.
      side: THREE.FrontSide,
    });
    state.skinMat = mat;
    bakeWeightColours(geometry, WEIGHT_PALETTE);
    state.skinGroup = buildSkinnedCreature(plan, geometry, mat);
  }
  scene.add(state.skinGroup);

  state.refGroup = buildCreature(plan, genome, { worldId: 'w1', detail: 'full' });
  scene.add(state.refGroup);

  // Separate the two by the animal's own size, and frame on the pair.
  //
  // The plan's root sits at the origin and the body grows away from it, so the
  // creature's CENTRE is nowhere near (0,0,0) — a camera aimed at the origin
  // frames an eel half off the screen. Aim at the bounding sphere instead.
  geometry.computeBoundingSphere();
  const bs = geometry.boundingSphere;
  const r = Math.max(0.4, bs.radius);
  state.offset = r * 1.15;
  state.refGroup.position.x = -state.offset;
  state.skinGroup.position.x = state.offset;
  state.centre = bs.center.clone();
  orbit.target.set(bs.center.x, bs.center.y, bs.center.z);
  // Fit the BOX, not the sphere. An eel's bounding sphere is its own length in
  // every direction, so fitting it frames a stripe in a field of black.
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const hx = (bb.max.x - bb.min.x) * 0.5 + state.offset;
  const hy = (bb.max.y - bb.min.y) * 0.5;
  const hz = (bb.max.z - bb.min.z) * 0.5;
  orbit.dist = Math.max(hx, hy, hz)
    / Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * 1.25;
  state.fitDist = orbit.dist;

  applyToggles();
  hud();
}

function innerDetail() {
  const v = $('inner').value;
  return v === 'none' ? 'flat' : v;
}

function applyToggles() {
  if (!state.skinGroup) return;
  const skins = state.skinGroup.userData.meshes ?? [state.skinGroup.userData.mesh];
  for (const mesh of skins) {
    mesh.material.wireframe = $('wire').checked;
    if (!state.shell) mesh.material.vertexColors = $('weights').checked;
    mesh.material.opacity = state.shell ? Number($('opacity').value) * (mesh.material.side === THREE.BackSide ? 0.8 : 1) : mesh.material.opacity;
    mesh.material.needsUpdate = true;
  }
  if (state.innerGroup) state.innerGroup.visible = $('inner').value !== 'none';
  state.refGroup.visible = $('showRef').checked;
  // Recentre when the reference is hidden: the pair straddles the origin, one
  // specimen alone does not.
  if (state.centre) {
    orbit.target.x = state.centre.x + ($('showRef').checked ? 0 : state.offset);
  }
  for (const b of state.skinGroup.userData.bones) {
    if ($('bones').checked && !b.userData.helper) {
      const h = new THREE.AxesHelper(0.25);
      h.userData.helper = true;
      b.add(h);
      b.userData.helper = h;
    } else if (!$('bones').checked && b.userData.helper) {
      b.remove(b.userData.helper);
      b.userData.helper.dispose();
      b.userData.helper = null;
    }
  }
}

/* ── frame ────────────────────────────────────────────────────────────────── */

let t = 0, lastMs = performance.now(), fps = 0;

function frame(nowMs) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (nowMs - lastMs) / 1000);
  lastMs = nowMs;
  fps += ((dt > 0 ? 1 / dt : 0) - fps) * 0.08;

  if (state.driver) {
    t += dt * Number($('speed').value);
    const hold = $('holdOn').checked ? Number($('hold').value) : null;
    const pose = state.driver.poseAt(t, { drive: Number($('drive').value), hold });

    state.skinGroup.userData.applyPose(pose);
    // The reference — and the inner body inside a shell — take the SAME pose the
    // same way the tank takes it, so any difference on screen is the skinning and
    // not the driver.
    for (const group of [state.refGroup, state.innerGroup]) {
      if (!group) continue;
      for (const m of group.children) {
        const p = pose[m.userData.bodyIndex];
        if (!p) continue;
        m.position.set(p.p[0], p.p[1], p.p[2]);
        m.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);
      }
    }
  }

  placeCamera();
  renderer.render(scene, camera);
  if ((nowMs | 0) % 8 === 0) hud();
}

function hud() {
  const s = state.stats;
  if (!s) return;
  const info = renderer.info.render;
  const detail = s.grid
    ? `grid <b>${s.grid.join('×')}</b>  cell <b>${s.cell.toFixed(3)}</b>${s.coarsened ? ` (coarse ×${s.coarsened})` : ''}\n`
    + `field evals <b>${(s.evals / 1000).toFixed(0)}k</b> for <b>${(s.samples / 1000).toFixed(0)}k</b> samples\n`
    : `chains <b>${s.chains}</b>  spine <b>${s.spineLength}</b> bodies\n`;
  $('hud').innerHTML =
    `bodies <b>${state.plan.bodyCount}</b>  joints <b>${state.plan.jointCount}</b>\n` +
    detail +
    `verts <b>${s.vertices}</b>  tris <b>${s.triangles}</b>\n` +
    `build <b>${state.buildMs.toFixed(1)} ms</b>\n` +
    `draw calls <b>${info.calls}</b>  fps <b>${fps.toFixed(0)}</b>`;
}

/* ── wiring ───────────────────────────────────────────────────────────────── */

{
  const sel = $('genome');
  for (const s of SEEDS) {
    const o = document.createElement('option');
    o.value = s.id; o.textContent = s.name;
    sel.appendChild(o);
  }
  const o = document.createElement('option');
  o.value = 'random'; o.textContent = 'random';
  sel.appendChild(o);
  sel.value = 'eel';
}

const REBUILDERS = ['genome', 'seed', 'blend', 'res', 'mode', 'inflate', 'inner'];
for (const id of REBUILDERS) $(id).addEventListener('input', () => { syncOutputs(); rebuild(); });
for (const id of ['wire', 'weights', 'showRef', 'bones']) $(id).addEventListener('change', applyToggles);
for (const id of ['drive', 'speed', 'hold']) $(id).addEventListener('input', syncOutputs);
$('opacity').addEventListener('input', () => { syncOutputs(); applyToggles(); });
$('reroll').addEventListener('click', () => {
  $('genome').value = 'random';
  $('seed').value = String((Number($('seed').value) || 0) + 1);
  syncOutputs();
  rebuild();
});

function syncOutputs() {
  $('blendOut').textContent = Number($('blend').value).toFixed(2);
  $('resOut').textContent = Number($('res').value).toFixed(1);
  $('driveOut').textContent = Number($('drive').value).toFixed(2);
  $('speedOut').textContent = Number($('speed').value).toFixed(2);
  $('inflateOut').textContent = `${Number($('inflate').value).toFixed(2)}× girth`;
  $('opacityOut').textContent = Number($('opacity').value).toFixed(2);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

resize();
syncOutputs();
rebuild();
requestAnimationFrame(frame);

/* ── contact sheet ────────────────────────────────────────────────────────
 * A grid of specimens in one frame. Judging a body plan generator one creature
 * at a time is how you convince yourself it works: the failures are the
 * unusual genomes, and you only meet those in bulk.
 * ---------------------------------------------------------------------- */
let sheet = null;

export function gallery(seeds, opts = {}) {
  if (sheet) { scene.remove(sheet); sheet.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
  sheet = new THREE.Group();
  scene.add(sheet);
  state.refGroup.visible = false;
  state.skinGroup.visible = false;

  const cols = opts.cols ?? Math.ceil(Math.sqrt(seeds.length));
  const cell = opts.cell ?? 10;
  const info = [];

  const mode = $('mode').value;
  const isShell = mode.startsWith('shell');

  seeds.forEach((s, n) => {
    const genome = typeof s === 'string'
      ? SEEDS.find((e) => e.id === s).genome
      : createRandomGenome(makeRng(s >>> 0));
    const plan = morphogenesis(genome);
    const girthRef = Math.max(...plan.bodies.map((b) => Math.min(b.dims[0], b.dims[1]))) * 0.5;

    const t0 = performance.now();
    let geometry, stats;
    if (isShell) {
      ({ geometry, stats } = buildShellGeometry(plan, genome, {
        source: mode === 'shell-loft' ? 'loft' : 'sdf',
        inflate: Number($('inflate').value) * girthRef,
        blend: Number($('blend').value),
        res: Number($('res').value),
      }));
    } else if (mode === 'sdf') {
      ({ geometry, stats } = surfaceNet(makeField(plan, { blendFactor: Number($('blend').value) }),
        { res: Number($('res').value) }));
    } else {
      ({ geometry, stats } = buildAnatomy(plan, genome, {
        waist: Number($('blend').value) * 0.36,
        radial: Math.max(6, Math.round(Number($('res').value) * 4)),
      }));
    }
    const ms = performance.now() - t0;

    let g;
    if (isShell) {
      g = buildShellGroup(plan, geometry, { opacity: Number($('opacity').value) });
      if ($('inner').value !== 'none') g.add(buildCreature(plan, genome, { worldId: 'w1', detail: innerDetail() }));
    } else {
      const mat = new THREE.MeshPhysicalMaterial({
        color: opts.color ?? '#7fb6a8', roughness: 0.45, metalness: 0.02,
        sheen: 0.5, sheenRoughness: 0.5, sheenColor: new THREE.Color('#cfe9ff'),
        clearcoat: 0.35, clearcoatRoughness: 0.35, side: THREE.FrontSide,
        wireframe: !!opts.wire,
      });
      g = buildSkinnedCreature(plan, geometry, mat);
    }

    // Normalise each specimen into its own cell so a giant does not hide a
    // shrimp — this is a shape review, not a size review.
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const size = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 1;
    const k = (cell * 0.82) / size;
    const holder = new THREE.Group();
    holder.add(g);
    g.scale.setScalar(k);
    g.position.set(
      -((bb.min.x + bb.max.x) * 0.5) * k,
      -((bb.min.y + bb.max.y) * 0.5) * k,
      -((bb.min.z + bb.max.z) * 0.5) * k,
    );
    holder.position.set((n % cols) * cell, -Math.floor(n / cols) * cell, 0);
    sheet.add(holder);
    info.push({ s, bodies: plan.bodyCount, tris: stats.triangles, ms: +ms.toFixed(1) });
  });

  const rows = Math.ceil(seeds.length / cols);
  orbit.target.set((cols - 1) * cell * 0.5, -(rows - 1) * cell * 0.5, 0);
  orbit.dist = Math.max(cols, rows) * cell * 1.35;
  state.fitDist = orbit.dist;
  return info;
}

export function galleryOff() {
  if (sheet) { scene.remove(sheet); sheet = null; }
  state.refGroup.visible = $('showRef').checked;
  state.skinGroup.visible = true;
}

// Handles for driving the page from a console or a test harness. Proto only.
window.proto = { THREE, scene, camera, renderer, state, rebuild, orbit, placeCamera, frame, gallery, galleryOff };
