// ui/screens/tank.js — the tank (21 §4, 30 §4 B4).
//
// Six creatures, live, under physics. Tap to select, Breed, Undo, Pause, Speed.
// This is also the screen B3's checkpoint has been waiting for: until now
// nothing in this application had ever stepped a simulation, so "creatures move,
// and at least some undulate rather than twitch" could not be looked at.
//
// N16: no hex colours and no raw pixel values — every number here is a token
// read off the document, a world-space metre, or a unitless ratio.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { t } from '../../trunk/i18n.js';
import { rngFrom, freshVivariumSeed } from '../../trunk/rng.js';
import * as store from '../../trunk/store.js';
import { morphogenesis, totalMass, boundingRadius } from '../../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../../engine/l1/physics.js';
import { seedPopulation, breed, strangerCount, POPULATION, KIND } from '../../engine/l1/breed.js';
import { SLICE_LIMITS } from '../../engine/l1/factory.js';
import { adaptGait } from '../../engine/l2/gait.js';
import { OBJECTIVES, scoreBy } from '../../engine/l2/objective.js';
import { bearingTo } from '../../engine/l2/duel.js';
import { genomeHash, validateGenome } from '../../engine/l1/genome.js';
import { binomial } from '../../engine/l1/naming.js';
import { buildCreature, disposeCreature, token, tokenNumber, updateCreatureGlow } from '../../render/creature.js';
import { createWater, updateWater, disposeWater, fitAtmosphere, fitOrbit, FIT, renderOverlay } from '../../render/tank.js';
import { renderThumbnail, RENDER_TAG } from '../../render/thumbnail.js';
import { W1_SLICE } from '../../worlds/w1_slice.js';
import { button } from '../widgets.js';
import {
  stepBudget, hitRadius, classifyPointer,
  smoothSpeed, horizontalSpeed, nextSpeed, STATE, BREEDING_MS, TAP,
  BURST, burstSelection, burstKeep,
} from '../tank/sim.js';

/** A token that is a length, as a number. N16 forbids the literal; this reads it. */
const tokenPx = (name) => parseFloat(token(name));

/* ══ EXPERIMENT (revertible, UNCOMMITTED) — creature + tank size ══════════════
   PLAN-AFTER-B2 §1 "choose the frame". Measured with tools/_zstrouhal.mjs:
   shrinking creatures ~0.5× roughly TRIPLES body-lengths/sec.

   CAUSE CORRECTED — it is NOT the drag regime. There is no viscosity term in the
   engine, so the fluid side is exactly scale-free and has no regime to shift.
   What holds absolute speed fixed while length shrinks is the muscle/fluid
   characteristic speed sqrt(sigma/rho) = sqrt(MUSCLE_STRESS) ~ 14 cm/s: under a
   uniform scale s, muscle torque goes as s^3 against a fluid/inertial load of
   s^5, so the corpus is TORQUE-limited across the whole tested range and
   BL/s ~ 1/L. Confirmed by tools/_scale3.mjs (speed 0.112 -> 0.015 over a 64x
   size range while BL/s rises 0.004 -> 0.032). Square-cube, not Reynolds.

   This is a TANK-LOCAL trial only — the engine, worlds/w1_slice.js and the gate
   are untouched. TO REVERT: EXP_CREATURE_SCALE = 1, EXP_TANK_BOUNDS = null. */
const EXP_CREATURE_SCALE = 1;
const EXP_TANK_BOUNDS = null;   // W1_SLICE ships [16, 24, 16]

/** Uniform geometric shrink of a genome (node dims; connection scales are ratios,
 *  unaffected), so morphogenesis rebuilds a proportionally smaller body. */
function scaleGenome(genome, s) {
  if (!s || s === 1) return genome;
  const g = structuredClone(genome);
  for (const n of g.nodes) n.dims = n.dims.map((d) => d * s);
  return g;
}

/** A per-creature speed label as a billboarded Sprite, rendered IN the scene so
 *  it tracks the body in the SAME GPU frame and never desyncs from it on orbit
 *  (a DOM overlay sits on its own compositor layer and flickers directionally).
 *  Constant screen size (sizeAttenuation off); drawn white, tinted per state via
 *  the material colour so only a changed string re-rasterises the canvas. */
const LABEL_FS = 44;   // canvas font px (a bare number: no `NNpx` literal, N16)
function makeLabel() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 64;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex, sizeAttenuation: false, depthTest: false, transparent: true, toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 11;
  return { sprite, canvas, tex, mat, last: null };
}
function drawLabel(l, text) {
  if (l.last === text) return;      // only re-rasterise when the digits change
  l.last = text;
  const c = l.canvas, ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'white';          // tinted via material.color; 'white' avoids a hex (N16)
  ctx.font = `600 ${LABEL_FS}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, c.width / 2, c.height / 2);
  l.tex.needsUpdate = true;
}

export default {
  title: t('Tank'),

  mount(el) {
    // ── chrome ──────────────────────────────────────────────────────────────
    // Full-bleed water with floating chrome (design-style, Phase 2): the canvas
    // fills the view and the readouts, cluster and primary action float over it
    // on scrims. Small DOM helpers keep this readable — element, then text.
    const mk = (cls, parent, tag = 'div') => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (parent) parent.append(n);
      return n;
    };

    const wrap = mk('tank');
    const view = mk('tank-view', wrap);
    // NO TOP SCRIM. It was a dark gradient behind the readouts; it darkened the
    // brightest, most legible part of the water for the sake of text that can
    // hold its own contrast instead (see --c-on-water). The BOTTOM scrim stays —
    // it separates the tab bar and the primary action from the tank, which is a
    // different job. `--scrim-top` survives as the top CHROME HEIGHT, used by the
    // camera fit below to keep the grid out from under the ribbon.
    mk('tank-scrim tank-scrim-bottom', wrap);

    // Top readouts — generation/world left, selection/stranger right.
    // One top ribbon: generation/world/selection stacked at the left, the compact
    // Stranger / Burst / Seek tools at the right (built in ─controls as `tools`).
    const readouts = mk('tank-readouts', wrap);
    const readoutL = mk('tank-readout-l', readouts);
    const genEl = mk('tank-gen', readoutL);
    const worldEl = mk('tank-world', readoutL);
    const selEl = mk('tank-sel', readoutL);
    const strangersEl = mk('tank-strangers', readoutL);
    const mixEl = mk('tank-mix', readoutL);

    // First-run coach — three words, once (21 §4.6). Removed on the first breed.
    const coach = mk('tank-coach', wrap);
    coach.textContent = t('Tap one you like → Breed → repeat');

    // Control cluster (pill) and the primary action. Chips are built in ─controls.
    // The main ribbon stays pure transport — Pause / Speed / Undo. The less-used
    // Stranger / Burst / Seek live in their own pill up top (`tools`).
    const cluster = mk('tank-cluster', wrap);
    const tools = mk('tank-tools', wrap);
    const primary = mk('tank-breed', wrap, 'button');
    primary.type = 'button';

    // A scale reference — a bar whose on-screen length is a round number of
    // CENTIMETRES at the current zoom (01 §7: world units are cm), so the player
    // can read the true size of the animals — a median creature is ~7 cm and they
    // span two orders of magnitude. Updated each frame in updateScale().
    const scaleEl = mk('tank-scale', wrap);
    const scaleLine = mk('tank-scale-line', scaleEl);
    const scaleText = mk('tank-scale-text', scaleEl);

    el.append(wrap);

    const sheet = mk('tank-sheet', wrap);
    sheet.hidden = true;

    // ── scene ───────────────────────────────────────────────────────────────
    // The 3D layer owns the water: it is the scene background AND the source of
    // image-based light. A transmissive membrane needs a backdrop to refract and
    // the fog needs a colour to fade creatures into — a CSS layer behind a
    // transparent canvas would give the materials neither.
    const scene = new THREE.Scene();

    // Selection / stranger / dim colours, read once (a per-frame getComputedStyle
    // per marker would itself thrash). Rings and labels are scene objects now.
    const ringSelect = new THREE.Color(token('--c-select'));
    const ringStranger = new THREE.Color(token('--c-stranger'));
    const labelDim = new THREE.Color(token('--c-text-dim'));
    // Sprite scale for sizeAttenuation:false labels — a fraction of the viewport,
    // 2:1 to match the 128x64 canvas. Tuned by eye for ~micro-label size.
    const LABEL_SCALE = [0.024, 0.012];

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    // The design's materials are authored against ACES: without it transmission
    // and iridescence blow out and the ramp reads wrong (render/creature.js
    // compensates for the ACES knee in its emissive path).
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = tokenNumber('--tank-exposure');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    view.prepend(renderer.domElement);

    // Reef water, the four-light rig, sun shafts and two parallax mote layers —
    // all built into the scene by render/tank.js. ONE equirect gradient is both
    // background AND environment map, so a reflection can never disagree with the
    // water it is reflecting; the rim light is a ramp colour, never white.
    const water = createWater(scene, W1_SLICE.palette);

    // EXPERIMENT hook, retained but inert: the tank dimensions are UNCHANGED for
    // the 3D revamp (reshaping tankBounds would move worldHash — deferred).
    const TANK = EXP_TANK_BOUNDS ? { ...W1_SLICE, tankBounds: EXP_TANK_BOUNDS } : W1_SLICE;

    // 7a ARRANGEMENT — a tall HELIX, not a tiled grid. A portrait phone frame has
    // to spend its budget on height; six creatures wound up a helix pass in front
    // of each other, and that occlusion is what gives the tank depth. Each
    // creature still swims in its OWN W1 sim (no inter-creature collision) — the
    // helix is a render-space arrangement of the per-slot pivots, spaced by
    // creature size so the near-stationary solver-motor undulators stay composed.
    // No wireframe box (the water is the tank); the fog sits BEHIND the ensemble.
    let cells = [];              // helix position per slot, world metres
    let sceneSize = [8, 8, 8];   // bounding box of the helix, for camera framing
    let sceneRadius = 8;         // half its diagonal, for fog near/far
    scene.fog = new THREE.Fog(water.fogColour, 1, 100);

    // The opening arrangement — a 2-column x 3-row grid (invisible), so the first
    // frame is an ordered plate rather than a scatter. Cells are tight (spacing
    // scales with the largest creature) so the fit zooms them in; a small
    // per-column depth stagger keeps the plate from going degenerate on orbit.
    const GRID_COLS = 2, GRID_ROWS = 3;
    function layoutGrid() {
      const n = slots.length;
      const rMax = n ? Math.max(...slots.map((s) => s.radius)) : 1;
      const gx = rMax * 1.6, gy = rMax * 1.6, gz = rMax * 0.6;
      cells = slots.map((s, i) => {
        const c = i % GRID_COLS, r = Math.floor(i / GRID_COLS);
        return [
          (c - (GRID_COLS - 1) / 2) * gx,
          ((GRID_ROWS - 1) / 2 - r) * gy,   // row 0 sits at the top
          (c - (GRID_COLS - 1) / 2) * gz,   // stagger depth by column
        ];
      });
      for (const s of slots) s.group.position.set(cells[s.index][0], cells[s.index][1], cells[s.index][2]);
      let ex = rMax, ey = rMax, ez = rMax;
      for (const c of cells) {
        ex = Math.max(ex, Math.abs(c[0]) + rMax);
        ey = Math.max(ey, Math.abs(c[1]) + rMax);
        ez = Math.max(ez, Math.abs(c[2]) + rMax);
      }
      sceneSize = [ex * 2, ey * 2, ez * 2];
      sceneRadius = 0.5 * Math.hypot(sceneSize[0], sceneSize[1], sceneSize[2]);
      // Size the sun shafts and mote layers to the actual scene, or they stay a
      // tiny clump at the origin (they are authored in unit-space).
      fitAtmosphere(water, sceneSize);
    }

    // ── state ───────────────────────────────────────────────────────────────
    let state = STATE.LOADING;
    let generation = 0;
    let genomes = [], provenance = [], slots = [];
    let vivariumSeed = 0;   // H7 — this lineage's own seed; see loadOrCreateVivariumSeed
    let previous = null;            // one-step undo: 21 §4.3
    let selected = new Set();
    // A saved creature the player has chosen to drop into the stranger slot on the
    // NEXT breed only (N17's slot, filled by hand). Held here, not persisted: the
    // choice is "manual each breed" and resets to random once consumed.
    let pendingStranger = null;     // { genome, commonName } | null
    let speed = 1, paused = false;
    // Fallback ladder rung (render/creature.js): 'full' membrane+flesh+organ,
    // 'flesh' drops the outer translucent membrane, 'flat' drops the generated
    // maps. Default 'flesh' (rung 1) — 7a's stated six-creature phone budget: the
    // flesh layer still reads translucent and luminous creatures still glow
    // through it. Raise to 'full' on strong hardware, or wire to the dev panel.
    let detail = 'flesh';
    let accumulator = 0, lastMs = 0, raf = 0, breedingUntil = 0;
    let stopped = false;
    let ready = false;

    // Orbit, in spherical coordinates about the view target. A near-head-on angle
    // so the opening 2x3 grid reads as a plate; `dist` is solved on every resize
    // (see fitOrbit in resize()).
    const orbit = { theta: 0.4, phi: 1.36, dist: 1 };
    const HOME = { theta: 0.4, phi: 1.36, dist: 1 };
    // The orbit pivot is not the origin: `baseTargetY` biases the composition up
    // into the clear "work area" (the water not covered by the top ribbon and the
    // bottom controls), and `pan` is the user's own translation (drag/two-finger).
    const pan = new THREE.Vector3();
    let baseTargetY = 0;

    // ── creature slots ──────────────────────────────────────────────────────
    // One simulation per creature, each in its own unmodified W1 tank, drawn at
    // its cell. Rebuilt wholesale on breed and on undo — 21 §4.3 requires undo
    // to "re-instantiate from t=0", and a fresh sim is the only honest way to
    // get t=0 back.

    function disposeSlots() {
      for (const s of slots) {
        if (!s) continue;
        s.sim.free();
        scene.remove(s.group);
        // disposeCreature frees the creature group's meshes AND its generated
        // maps (group.userData.textures) — it must be given the creature group
        // (s.mesh), not the pivot (s.group), or the per-creature textures leak
        // on every breed. The ring is a separate pivot child, freed explicitly.
        disposeCreature(s.mesh);
        s.ring.geometry.dispose();
        s.ring.material.dispose();
        s.label.tex.dispose();
        s.label.mat.dispose();
      }
      slots = [];
    }

    function buildSlots() {
      disposeSlots();
      slots = genomes.map((canonical, i) => {
        // EXPERIMENT: shrink the creature for this screen's sim + render only.
        // The stored genomes[] stay canonical (breeding operates on those).
        const genome = scaleGenome(canonical, EXP_CREATURE_SCALE);
        const plan = morphogenesis(genome);
        const sim = createSimulation(RAPIER, plan, genome, TANK);
        const group = buildCreature(plan, genome, { worldId: W1_SLICE.palette, detail });
        const pivot = new THREE.Group();   // positioned on the grid by layoutGrid()
        pivot.add(group);
        scene.add(pivot);

        // Both markers — the speed label and the selection ring — are rendered
        // IN the scene, not as CSS overlays: a DOM overlay sits on its own
        // compositor layer and updates a frame out of step with the WebGL canvas,
        // so during orbit it desyncs from the body and flickers directionally.
        // Scene objects are composited in the SAME GPU frame as the creature and
        // cannot. Both draw over everything (depthTest off) and face the camera.
        const label = makeLabel();
        label.sprite.scale.set(LABEL_SCALE[0], LABEL_SCALE[1], 1);
        pivot.add(label.sprite);

        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.92, 1.0, 48),
          new THREE.MeshBasicMaterial({
            color: ringSelect.clone(), transparent: true, opacity: 0.95,
            side: THREE.DoubleSide, depthTest: false, toneMapped: false,
          }));
        ring.visible = false;
        ring.renderOrder = 10;
        pivot.add(ring);

        // C5 — the SEEK beacon: a small mark at the creature's home point (sim
        // origin = this cell's centre). Hidden unless Seek is on, when the
        // creature steers toward it and the homing is the visible proof that the
        // actuator now carries a turn. Drawn over everything, camera-facing.
        // Distinct from the selection ring (which is --c-select) so the Seek
        // beacon reads as a target, not a selection.
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 16, 12),
          new THREE.MeshBasicMaterial({ color: ringStranger.clone(), transparent: true, opacity: 0.9, depthTest: false, toneMapped: false }));
        beacon.visible = seeking;
        beacon.renderOrder = 11;
        pivot.add(beacon);

        // The instantaneous gait phase of the joint feeding each body, so a
        // luminous creature's glow is a READOUT of its gait (a travelling light
        // is a wave; six lights in unison a twitch). Assembled from the sim's own
        // exposed state — sim.phases (per-joint offset), sim.t, sim.control.effort
        // and the controller genes — so /engine stays untouched. The root body
        // has no feeding joint and never oscillates, so it returns phase 0.
        const jointOfBody = new Int32Array(plan.bodyCount).fill(-1);
        for (const j of plan.joints) jointOfBody[j.childBody] = j.index;
        const phaseFor = (bodyIndex) => {
          const ji = jointOfBody[bodyIndex];
          if (ji < 0) return 0;
          const jt = plan.joints[ji];
          const gj = genome.controller.jointGenes[jt.nodeId];
          return gj.freqMult * (genome.controller.omega * sim.control.effort) * sim.t + sim.phases[ji];
        };

        return {
          index: i, genome, plan, sim, group: pivot, mesh: group, label, ring, beacon,
          phaseFor,
          radius: boundingRadius(plan),
          // THE BIOLOGICAL MASS — sum of density x volume over the plan, in
          // grams (CGS, 01 §7). This is the number the sheet prints and the one
          // a player reasons about. It is currently EQUAL to what Rapier reports
          // per body, and that is a coincidence about to end: an added-mass term
          // (C6.2) would make rb.mass() return m + m_added, the HYDRODYNAMIC
          // mass the solver integrates. Anything user-visible must keep reading
          // totalMass(plan); anything about motion must read rb.mass(). Six call
          // sites currently do not distinguish them — see duel.js rootMass.
          mass: totalMass(plan),
          pose: sim.readPose(),
          speed: 0,
          world: new THREE.Vector3(),
        };
      });
      // Positions come from the built radii, so the grid is laid out AFTER the
      // slots exist; then reframe the camera against the new arrangement.
      layoutGrid();
      if (view.clientWidth && view.clientHeight) resize();
    }

    // ── the loop ────────────────────────────────────────────────────────────

    // C5 — SEEK: steer every creature toward its home point (sim origin). The
    // bearing runs through the same `bearingTo` the duel uses; turnBias then drives
    // the joints through TURN_AUTHORITY, so a creature that homes is closing the
    // exact loop C5 is about. Horizontal plane here (tank creatures carry no
    // compiled S3 record); a body that turns in another plane homes only partly,
    // which is C5.2's per-creature steering basis, still to come.
    let seeking = false;
    const ORIGIN = [0, 0, 0];
    function applySeek() {
      for (const s of slots) {
        s.sim.control.turnBias = seeking
          ? Math.max(-1, Math.min(1, bearingTo(s.sim, ORIGIN)))
          : 0;
      }
    }

    function stepPhysics(dtMs) {
      if (paused || state === STATE.BREEDING || state === STATE.BURSTING) return;
      accumulator += (dtMs / 1000) * speed;
      const { steps, carry } = stepBudget(accumulator, FIXED_DT);
      accumulator = carry;
      for (let n = 0; n < steps; n++) {
        if (seeking) applySeek();
        for (const s of slots) s.sim.step();
      }
    }

    let lastDt = 0;

    function syncPoses() {
      for (const s of slots) {
        s.sim.readPose(s.pose);
        // Each body now carries more than one mesh (flesh, organ, membrane), so
        // the live pose is applied by the mesh's own bodyIndex, not by child
        // order — an index-based map would drive the wrong layer onto each body.
        for (const m of s.mesh.children) {
          const p = s.pose[m.userData.bodyIndex];
          if (!p) continue;
          m.position.set(p.p[0], p.p[1], p.p[2]);
          m.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);
        }
        // 21 §4.5: one number, always visible — SPEED. Not a score, not fitness.
        // A player selecting on looks alone in a game about locomotion is
        // missing half the subject.
        //
        // Mass-weighted mean velocity IS the centre of mass's velocity, and only
        // its horizontal part is thrust — see smoothSpeed() in ui/tank/sim.js
        // for why neither the fastest body nor the full 3-D speed will do.
        let vx = 0, vy = 0, vz = 0, m = 0;
        for (const rb of s.sim.bodies) {
          // rb.mass() is deliberate here: this is a momentum-weighted mean, so it
          // wants the mass the SOLVER integrates, not the biological one. Under
          // C6.2 the two diverge and this line is already correct.
          const lv = rb.linvel(), bm = rb.mass();
          vx += lv.x * bm; vy += lv.y * bm; vz += lv.z * bm; m += bm;
        }
        if (m > 0) { vx /= m; vy /= m; vz /= m; }
        s.speed = smoothSpeed(s.speed, horizontalSpeed([vx, vy, vz]), lastDt);
        const c = s.sim.centreOfMass();
        s.world.set(c[0] + cells[s.index][0], c[1] + cells[s.index][1], c[2] + cells[s.index][2]);

        // Phase-locked emissive — a no-op on the ~5 in 6 creatures below the
        // luminosity threshold, so it is safe to call for every slot. gain 1 in
        // the tank (a single close specimen would use ~2.4).
        updateCreatureGlow(s.mesh, s.phaseFor, 1);
      }
    }

    function placeCamera() {
      const r = orbit.dist;
      const tx = pan.x, ty = baseTargetY + pan.y, tz = pan.z;
      camera.position.set(
        tx + r * Math.sin(orbit.phi) * Math.sin(orbit.theta),
        ty + r * Math.cos(orbit.phi),
        tz + r * Math.sin(orbit.phi) * Math.cos(orbit.theta));
      camera.lookAt(tx, ty, tz);
      // Fog around the tank at whatever distance the camera actually sits, so the
      // near face stays crisp and the far wall dissolves into water — at any zoom.
      scene.fog.near = Math.max(0.1, orbit.dist - sceneRadius * 1.15);
      scene.fog.far = orbit.dist + sceneRadius * 2.1;
    }

    // Scale bar — a nice round length (1/2/5 x 10^n) whose pixel width tracks the
    // zoom, so the animal sizes are legible. Cheap: two DOM writes, and the label
    // only re-rasterises when the chosen length changes.
    //
    // `L` is in WORLD UNITS, which are CENTIMETRES (01 §7, and the header of
    // engine/l1/physics.js). It is therefore printed as cm and steps DOWN to mm,
    // not up from metres — this bar is the most direct answer the screen gives to
    // "how big is that animal", so a wrong unit here is worse than none.
    let lastScaleL = -1;
    const niceLen = (v) => {
      const p = Math.pow(10, Math.floor(Math.log10(v)));
      const m = v / p;
      return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
    };
    function updateScale() {
      const wpp = (2 * orbit.dist * Math.tan((camera.fov * Math.PI / 180) / 2)) / Math.max(1, view.clientHeight);
      const L = niceLen(wpp * 64);           // aim for a ~64 px bar
      scaleLine.style.width = `${(L / wpp).toFixed(0)}px`;
      if (L !== lastScaleL) {
        // L is 1/2/5 x 10^n cm, so every branch divides exactly and never shows a
        // float. The fitted grid spans ~1 m at six creatures, so the metre branch
        // is reached at ordinary zoom-out and is not a corner case.
        scaleText.textContent = L >= 100 ? `${L / 100} m`
          : L >= 1 ? `${L} cm`
            : `${Math.round(L * 10)} mm`;
        lastScaleL = L;
      }
    }

    const projected = new THREE.Vector3();

    function syncOverlay() {
      for (const s of slots) {
        projected.copy(s.world).project(camera);
        const visible = projected.z < 1;
        const kind = provenance[s.index]?.kind ?? KIND.STRANGER;
        const isSelected = selected.has(s.index);

        // Speed label — a billboarded sprite at the creature's centre of mass,
        // in the scene so it never desyncs from the body on orbit. White text
        // tinted per state; only a changed value re-rasterises the canvas.
        s.label.sprite.visible = visible;
        if (visible) {
          drawLabel(s.label, s.speed.toFixed(1));
          s.label.sprite.position.copy(s.world).sub(s.group.position);
          s.label.mat.color.copy(
            isSelected ? ringSelect : (kind === KIND.STRANGER ? ringStranger : labelDim));
        }

        // Ring shown when selected, or for the stranger slot once there IS a
        // lineage to be unrelated to — on first run every creature is a stranger
        // and six rings say nothing (21 §4.4). A selection ring wins over the
        // quieter stranger ring on the same body. It is a world-space object:
        // scaled to the body, positioned at its centre-of-mass, and turned to
        // face the camera so it always reads as a flat circle.
        const isStranger = generation > 0 && kind === KIND.STRANGER;
        s.ring.visible = visible && (isSelected || isStranger);
        if (s.ring.visible) {
          const rad = Math.max(s.radius * 1.4, 1);
          s.ring.scale.set(rad, rad, rad);
          s.ring.position.copy(s.world).sub(s.group.position);
          s.ring.quaternion.copy(camera.quaternion);
          s.ring.material.color.copy(isSelected ? ringSelect : ringStranger);
          s.ring.material.opacity = isSelected ? 0.95 : 0.5;
        }
      }
    }

    function frame(nowMs) {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      const dt = lastMs ? Math.min(nowMs - lastMs, 250) : 0;
      lastMs = nowMs;
      // Smoothing is per real second, so it does not change with frame rate.
      // Paused means no new samples, not a decay towards zero.
      lastDt = (paused || state === STATE.BREEDING || state === STATE.BURSTING) ? 0 : dt / 1000;

      if (state === STATE.BREEDING && nowMs >= breedingUntil) {
        state = paused ? STATE.PAUSED : STATE.SIMULATING;
        view.dataset.breeding = 'no';
        renderStatus();
      }

      if (ready) {
        stepPhysics(dt);
        syncPoses();
      }
      // Water is never still — the shafts sway and the motes drift. The camera
      // holds the grid still (the swimming creatures supply the motion); the
      // player orbits, zooms and pans it themselves.
      updateWater(water, nowMs / 1000);
      placeCamera();
      updateScale();
      if (ready) syncOverlay();
      renderer.render(scene, camera);
      renderOverlay(renderer, water);   // sun shafts, drawn over the water
    }

    // ── interaction ─────────────────────────────────────────────────────────
    // 21 §4.3: implemented ONCE here, never per screen.

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null, longPressTimer = 0;

    // MULTI-TOUCH. Every active pointer is tracked, not just the first, because
    // a phone has no wheel: without this, zoom is unreachable on the primary
    // target device, and worse, a two-finger pinch feeds two independent
    // pointermove streams into the orbit handler and spins the camera at random.
    const pointers = new Map();
    let pinch = null;   // { dist, orbitDist } while two fingers are down

    const pinchSpan = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const pinchCentroid = () => {
      const [a, b] = [...pointers.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    // Pan — translate the orbit target in the camera's own screen plane, so the
    // gesture tracks the finger/cursor at any orbit angle. `worldPerPx` converts
    // a screen delta to world metres at the target depth. Two-finger drag on
    // mobile (alongside pinch), right- or middle-drag on desktop.
    const _right = new THREE.Vector3(), _up = new THREE.Vector3();
    function panBy(dxPx, dyPx) {
      const wpp = (2 * orbit.dist * Math.tan((camera.fov * Math.PI / 180) / 2)) / Math.max(1, view.clientHeight);
      _right.setFromMatrixColumn(camera.matrix, 0);
      _up.setFromMatrixColumn(camera.matrix, 1);
      pan.addScaledVector(_right, -dxPx * wpp);
      pan.addScaledVector(_up, dyPx * wpp);
    }

    function pick(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);

      const tap = tokenPx('--tapsize');
      const fov = (camera.fov * Math.PI) / 180;
      let best = null, bestDist = Infinity;
      for (const s of slots) {
        const dist = camera.position.distanceTo(s.world);
        const r = hitRadius(s.radius, dist, fov, rect.height, tap);
        // Distance from the creature's centre to the ray, in world metres.
        const toCentre = s.world.clone().sub(raycaster.ray.origin);
        const along = toCentre.dot(raycaster.ray.direction);
        if (along <= 0) continue;
        const perp = Math.sqrt(Math.max(0, toCentre.lengthSq() - along * along));
        // NEAREST-TO-CAMERA WINS (21 §4.3), not smallest miss distance: with
        // overlapping hit spheres the front creature is the one being pointed at.
        if (perp <= r && along < bestDist) { best = s; bestDist = along; }
      }
      return best;
    }

    const zoomTo = (d) => {
      orbit.dist = Math.min(HOME.dist * 2.5, Math.max(HOME.dist * 0.3, d));
    };

    view.addEventListener('pointerdown', (e) => {
      if (!ready || state === STATE.BREEDING || state === STATE.BURSTING) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Capture is a CONVENIENCE — it keeps the drag alive if the finger leaves
      // the canvas — and it must never be able to abort the handler. It throws
      // NotFoundError for any pointer id the browser is not already tracking,
      // and it sits ABOVE the lines that initialise the gesture, so a throw here
      // left `drag`/`down` unset and every subsequent tap silently did nothing.
      try { view.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }

      if (pointers.size === 2) {
        // A second finger cancels whatever the first was doing. It is the start of
        // a pinch (zoom) AND a two-finger drag (pan) — both run together.
        clearTimeout(longPressTimer);
        down = null;
        const c = pinchCentroid();
        pinch = { dist: pinchSpan(), orbitDist: orbit.dist, cx: c.x, cy: c.y };
        return;
      }
      if (pointers.size > 2) { pinch = null; down = null; clearTimeout(longPressTimer); return; }

      // Right or middle button pans on desktop; left orbits/selects.
      const panning = e.button === 2 || e.button === 1;
      down = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now(), moved: false, pan: panning, target: panning ? null : pick(e.clientX, e.clientY) };
      clearTimeout(longPressTimer);
      if (down.target) {
        longPressTimer = setTimeout(() => {
          if (down && !down.moved) { openSheet(down.target); down = null; }
        }, TAP.longPressMs);
      }
    });

    view.addEventListener('pointermove', (e) => {
      const p = pointers.get(e.pointerId);
      if (p) { p.x = e.clientX; p.y = e.clientY; }

      if (pinch && pointers.size === 2) {
        const span = pinchSpan();
        if (pinch.dist > 0 && span > 0) zoomTo(pinch.orbitDist * (pinch.dist / span));
        // Two-finger drag pans by how far the midpoint between the fingers moved.
        const c = pinchCentroid();
        panBy(c.x - pinch.cx, c.y - pinch.cy);
        pinch.cx = c.x; pinch.cy = c.y;
        return;
      }
      if (!down || e.pointerId !== down.id) return;

      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) >= TAP.maxMovePx) {
        down.moved = true;
        clearTimeout(longPressTimer);
        // A drag pans (right/middle button) or orbits (left) — never selects.
        if (down.pan) {
          panBy(dx, dy);
        } else {
          orbit.theta -= dx * 0.005;
          orbit.phi = Math.min(Math.PI - 0.15, Math.max(0.15, orbit.phi - dy * 0.005));
        }
        down.x = e.clientX; down.y = e.clientY;
      }
    });

    function endPointer(e) {
      clearTimeout(longPressTimer);
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      // Lifting one finger of a pinch must not become a tap on the way out.
      if (!down || e.pointerId !== down.id) { if (pointers.size === 0) down = null; return; }
      const kind = classifyPointer({ dx: e.clientX - down.x, dy: e.clientY - down.y, ms: performance.now() - down.at });
      if (kind === 'tap' && !down.moved && down.target) toggleSelect(down.target.index);
      down = null;
    }

    view.addEventListener('pointerup', endPointer);
    view.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); pinch = null; down = null; clearTimeout(longPressTimer); });

    view.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoomTo(orbit.dist * (1 + Math.sign(e.deltaY) * 0.12));
    }, { passive: false });

    view.addEventListener('dblclick', () => { Object.assign(orbit, HOME); pan.set(0, 0, 0); });
    // Right-drag pans, so suppress the browser context menu on the canvas.
    view.addEventListener('contextmenu', (e) => e.preventDefault());

    function toggleSelect(i) {
      if (selected.has(i)) selected.delete(i); else selected.add(i);
      renderStatus();
      persistLineage();   // selection survives a reload too
    }

    // ── specimen sheet ──────────────────────────────────────────────────────
    // The sheet now shows the derived binomial and lets the player keep the
    // creature: the binomial is a read-only fact about the structure (naming.js),
    // and the editable field below it is the common name they choose (defaulting
    // to the binomial). Saving writes a `specimen:` record with a portrait.

    function openSheet(s) {
      state = STATE.SHEET_OPEN;
      sheet.hidden = false;
      sheet.replaceChildren();
      const rows = [
        [t('Bodies'), `${s.plan.bodyCount}${s.plan.truncated ? t(' (capped)') : ''}`],
        [t('Joints'), `${s.plan.jointCount} · ${s.plan.dofCount} ${t('dof')}`],
        // CGS (01 §7, physics.js header): engine units ARE cm / g / s, so these
        // are relabels, not conversions — no arithmetic belongs on these lines.
        // `s.mass` is the GEOMETRIC mass, totalMass(plan); see the note at the
        // slot build below for why that distinction is about to matter.
        [t('Mass'), `${s.mass.toFixed(2)} g`],
        [t('Radius'), `${s.radius.toFixed(2)} cm`],
        [t('Speed'), `${s.speed.toFixed(2)} cm/s`],
        // H3b — a stranger whose viability search was exhausted is filled into
        // the slot anyway so the tank is never short, but it is never presented
        // as an ordinary creature. `viable` is absent on elites and offspring,
        // so only an explicit false says anything.
        // A RECOMBINANT NAMES ITS PARENTS BY SLOT, and the slots are live: N18
        // keeps every selected creature in its own slot, and parents are always
        // selected, so "from 1 + 4" points at two creatures still on screen. The
        // player can look from the child to both parents without remembering
        // anything. `grafted` is called out separately because it is the visible
        // half — a limb that came from the other parent, not just its colour.
        [t('Origin'), t(provenance[s.index]?.kind ?? KIND.STRANGER)
          // NOT `t('from')` here: V2's import scan matches `from` followed by a
          // quote anywhere in the file, template literals included, and reports
          // it as an undeclared bare specifier. Cheaper to say "mix of".
          + (provenance[s.index]?.parents?.length > 1
            ? ` · ${t('mix of')} ${provenance[s.index].parents.map(i => i + 1).join(' + ')}` : '')
          + (provenance[s.index]?.grafted > 0 ? t(' · grafted limb') : '')
          + (provenance[s.index]?.imported ? t(' · imported') : '')
          + (provenance[s.index]?.viable === false ? t(' · unviable, search exhausted') : '')],
      ];
      for (const [l, v] of rows) {
        const r = document.createElement('div');
        r.className = 'row';
        const a = document.createElement('span'); a.className = 'row-l'; a.textContent = l;
        const b = document.createElement('span'); b.className = 'row-v'; b.textContent = v;
        r.append(a, b);
        sheet.append(r);
      }

      // ── keep this creature ──────────────────────────────────────────────────
      // The stored genome is the CANONICAL one (genomes[index]); s.genome is the
      // tank's shrunk render copy (EXP_CREATURE_SCALE). The name and portrait are
      // both derived from the canonical body so a card matches the specimen.
      const canonical = genomes[s.index];
      const cplan = morphogenesis(canonical);
      const derived = binomial(cplan, canonical).binomial;

      const save = document.createElement('div');
      save.className = 'spec-save';

      const bino = document.createElement('div');
      bino.className = 'spec-binomial';
      bino.textContent = derived;
      save.append(bino);

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'field spec-name';
      nameInput.value = derived;
      nameInput.setAttribute('aria-label', t('Creature name'));
      save.append(nameInput);

      const saveBtn = button(t('Save creature'), async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = t('Saving…');
        try {
          const hash = genomeHash(canonical);
          const specimen = {
            genome: canonical,
            hash,
            worldId: W1_SLICE.palette,
            binomial: derived,
            commonName: nameInput.value.trim() || derived,
            thumb: renderThumbnail(canonical, { worldId: W1_SLICE.palette }),
            stats: { bodies: cplan.bodyCount, mass: totalMass(cplan) },
            createdAt: Date.now(),
            render: RENDER_TAG,
          };
          await store.set(store.KEY.specimen(hash), specimen);
          saveBtn.textContent = t('Saved ✓');
        } catch {
          saveBtn.disabled = false;
          saveBtn.textContent = t('Save failed — retry');
        }
      });
      save.append(saveBtn);
      sheet.append(save);

      sheet.append(button(t('Close'), closeSheet));
    }

    function closeSheet() {
      sheet.hidden = true;
      state = paused ? STATE.PAUSED : STATE.SIMULATING;
      renderStatus();
    }

    // ── controls ────────────────────────────────────────────────────────────
    // A pill cluster of transparent chips over the bottom scrim, plus the
    // primary Breed action. Sentence case; the speed chip is mono ("measured").
    const chip = (cls, onClick) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls ? `tank-chip ${cls}` : 'tank-chip';
      b.addEventListener('click', onClick);
      return b;
    };

    const btnPause = chip('', () => {
      paused = !paused;
      state = paused ? STATE.PAUSED : STATE.SIMULATING;
      accumulator = 0;
      renderStatus();
    });
    const btnSpeed = chip('speed', () => { speed = nextSpeed(speed); renderStatus(); });
    const btnUndo = chip('', () => {
      if (!previous) return;
      genomes = previous.genomes;
      provenance = previous.provenance;
      generation = previous.generation;
      selected = new Set(previous.selected);
      previous = null;
      buildSlots();
      renderStatus();
      persistLineage();
    });
    // The stranger chip carries the current choice for the next breed's N17 slot:
    // "random" by default, or a saved creature the player picked. Tapping opens the
    // picker; the pick applies to the next breed only, then resets to random.
    const btnStranger = chip('stranger', openStrangerPicker);
    // Burst — the breed loop run several rounds with the keeping done by a stated
    // objective. Opens a sheet first rather than running on the tap: the objective
    // is a real choice, and "it auto-selects, on what?" was a question the screen
    // could not answer. A progress % rides the chip while it runs.
    const btnBurst = chip('burst', openBurstSheet);
    // C5 — Seek toggle: show the steering loop closing. Flips every creature into
    // homing on its beacon and back.
    const btnSeek = chip('seek', () => {
      seeking = !seeking;
      for (const s of slots) s.beacon.visible = seeking;
      applySeek();               // takes effect immediately, even while paused-visible
      renderStatus();
    });
    cluster.append(btnPause, btnSpeed, btnUndo);
    tools.append(btnStranger, btnBurst, btnSeek);
    primary.addEventListener('click', doBreed);

    function updateStrangerChip() {
      // Compact for the top pill: the chosen creature's name when picked (shown in
      // --c-stranger via `.picked`), otherwise just the label.
      btnStranger.textContent = pendingStranger ? pendingStranger.commonName : t('Stranger');
      btnStranger.classList.toggle('picked', !!pendingStranger);
    }

    /**
     * The burst sheet — states what is about to happen, then offers the objective.
     *
     * The choice is the reason this is a sheet rather than a chip that just runs.
     * A burst spends twenty seconds and rewrites most of the tank; the player was
     * previously given no say in what "best" meant and no warning about what would
     * be kept. Naming the pins, the round count and the measured quantity turns it
     * from a slot machine into an instruction.
     */
    function openBurstSheet() {
      if (!ready || state === STATE.BURSTING) return;
      state = STATE.SHEET_OPEN;
      sheet.hidden = false;
      sheet.replaceChildren();

      const pinned = selected.size;
      const title = document.createElement('div');
      title.className = 'spec-picker-title';
      title.textContent = !pinned
        ? t('Burst — breeds the whole tank')
        : pinned === 1
          ? t('Burst — keeps your pick and breeds from it')
          : `${t('Burst — keeps your')} ${pinned} ${t('picks and breeds from them')}`;
      sheet.append(title);

      const what = document.createElement('p');
      what.className = 'spec-empty';
      what.textContent = pinned
        ? t('Your picks come back unchanged, in their own slots. The free slots fill with the best of their descendants.')
        : t('Nothing is selected, so nothing is protected — every slot may be replaced. Select creatures first to keep them.');
      sheet.append(what);

      const on = document.createElement('div');
      on.className = 'spec-picker-title';
      on.textContent = t('Keep the offspring that score best on:');
      sheet.append(on);

      for (const o of OBJECTIVES) {
        const rounds = o.adapt ? BURST.physicsRounds : BURST.freeRounds;
        sheet.append(button(`${t(o.label)} — ${rounds} ${t('rounds')}`, () => {
          closeSheet();
          runBurst(o);
        }));
        // The note is a VISIBLE line, not a title attribute: this is a phone-first
        // screen and a tooltip needs a hover that will never happen. It says what
        // the number actually is, and for the simulated one, what it costs.
        const note = document.createElement('p');
        note.className = 'spec-empty';
        note.textContent = o.adapt ? `${t(o.note)} · ${t('simulated, about 20 s')}` : t(o.note);
        sheet.append(note);
      }

      sheet.append(button(t('Close'), closeSheet));
    }

    /** Reuse the bottom sheet to pick a saved creature (or Random) for the slot. */
    async function openStrangerPicker() {
      if (!ready) return;
      state = STATE.SHEET_OPEN;
      sheet.hidden = false;
      sheet.replaceChildren();

      const title = document.createElement('div');
      title.className = 'spec-picker-title';
      title.textContent = t('Choose a stranger for the next breed');
      sheet.append(title);

      sheet.append(button(t('Random (default)'), () => {
        pendingStranger = null;
        updateStrangerChip();
        closeSheet();
      }));

      let keys = [];
      try { keys = await store.list('specimen:'); } catch { keys = []; }
      if (sheet.hidden) return;   // closed while the list was loading

      if (keys.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'spec-empty';
        empty.textContent = t('No saved creatures yet. Long-press a creature and Save to keep one.');
        sheet.append(empty);
      } else {
        const list = document.createElement('div');
        list.className = 'spec-picker-list';
        for (const key of keys) {
          let spec;
          try { spec = await store.get(key); } catch { continue; }
          if (!spec?.genome) continue;
          const label = spec.commonName || spec.binomial || t('Creature');
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'spec-picker-item';
          const img = document.createElement('img');
          img.className = 'spec-picker-thumb'; img.alt = '';
          if (spec.thumb) img.src = spec.thumb;
          const name = document.createElement('span');
          name.className = 'spec-picker-name'; name.textContent = label;
          item.append(img, name);
          item.addEventListener('click', () => {
            pendingStranger = { genome: spec.genome, commonName: label };
            updateStrangerChip();
            closeSheet();
          });
          list.append(item);
        }
        sheet.append(list);
      }

      sheet.append(button(t('Close'), closeSheet));
    }

    function doBreed() {
      if (!ready || selected.size === 0 || state === STATE.BREEDING || state === STATE.BURSTING) return;
      // The coach has done its job the moment the loop is used once (21 §4.6).
      coach.hidden = true;

      // One-step undo, kept BEFORE the breed. 21 §4.3: "restore previous
      // generation's genomes, re-instantiate from t=0". Cheap, and it removes
      // all anxiety from experimenting.
      previous = { genomes, provenance, generation, selected: [...selected] };

      const r = breed({
        RAPIER, genomes,
        selected: [...selected],
        // H7 — every stream hangs off this lineage's own seed, so two players
        // making the same selections get different offspring. Determinism is
        // preserved WITHIN a lineage: same vivariumSeed, same everything.
        rng: rngFrom('tank', vivariumSeed, 'breed', generation),
        world: W1_SLICE,
        // The player's chosen import fills N17's stranger slot on THIS breed only.
        injectStrangers: pendingStranger ? [pendingStranger.genome] : [],
      });
      genomes = r.genomes;
      provenance = r.provenance;
      generation++;
      // The import is spent — the stranger slot returns to a random draw next time.
      pendingStranger = null;
      updateStrangerChip();
      // Elites keep their slot and stay selected, so the player's choice
      // survives the breed and repeat-breeding one lineage is one tap.
      selected = new Set(r.provenance
        .map((p, i) => (p.kind === KIND.ELITE ? i : -1)).filter(i => i >= 0));

      buildSlots();

      // 21 §4.4: the BREEDING beat is not decoration — without a visible
      // transition the player cannot tell whether anything happened.
      state = STATE.BREEDING;
      view.dataset.breeding = 'yes';
      breedingUntil = performance.now() + BREEDING_MS;
      renderStatus(r.droppedElite);
      persistLineage();
    }

    // ── the burst ─────────────────────────────────────────────────────────────
    //
    // THE BREED LOOP, AUTOMATED — several rounds of exactly what the player does
    // by hand, with the keeping done by a stated objective instead of by eye.
    //
    // WHAT IT USED TO BE, and why that was wrong: it ignored the selection
    // completely (`selected` was read only to snapshot undo, then cleared),
    // hill-climbed every gait including the player's own creatures, and replaced
    // all six slots ranked on a speed the screen never named. A player who had
    // spent ten minutes curating three shapes lost all three to one tap, and
    // could not have known that was going to happen.
    //
    // NOW: whatever is selected is PINNED. It breeds every round, it is never
    // adapted, and it comes back byte-identical in its own slot — the same
    // promise N18 gives an elite across a single breed, held across the whole
    // burst. The free slots are filled by the best descendants under the chosen
    // objective. With nothing selected the pins are empty and the loop degrades
    // exactly to the old free-for-all, so no capability is lost.
    //
    // Scoring is in the canonical W1_SLICE, not the tank's display-scaled world,
    // so a gait adapts for the real physics. The loop YIELDS to a repaint between
    // bodies — the progress % is why, and it keeps the tab alive.
    //
    // MEASURED (tools/_xburst.mjs, and it is the reproducer for these numbers):
    //
    //     objective  pins   best score        trials  wall    pins held
    //     speed      0+2    0.214 -> 0.687     322    17.7 s  byte-identical
    //     speed      none   0.214 -> 0.766     336    18.0 s  —
    //     size       0+2    29.1  -> 39.4      130     3.5 s  byte-identical
    //     reach      0+2    4.81  -> 8.32      130     2.8 s  byte-identical
    //
    // Speed triples in less wall-clock than the OLD burst spent on two rounds,
    // because the trials go into more rounds of selection rather than into
    // re-adapting bodies that were never going to be kept. Pinning costs some of
    // the final score (0.687 against 0.766) and that is the trade being offered,
    // not a defect: two of the six slots are reserved for creatures chosen on
    // something the objective cannot see.
    //
    // gate/breed.js L1-43 and L1-44 hold the policy and the objective registry.

    /** The objective the next burst will select on. Chosen in the burst sheet. */
    let burstObjective = OBJECTIVES[0];

    function runBurst(objective) {
      if (!ready || state === STATE.BREEDING || state === STATE.BURSTING) return;
      burstObjective = objective ?? burstObjective;
      const obj = burstObjective;
      coach.hidden = true;
      previous = { genomes, provenance, generation, selected: [...selected] };  // one-step undo
      state = STATE.BURSTING;
      view.dataset.breeding = 'yes';
      renderStatus();

      // The pins, in tank-slot order. `selected` is a Set and its iteration order
      // is insertion order — the order the player TAPPED — which would make an
      // identical selection behave differently depending on the order it was
      // made. Sorted, so a burst is a function of WHAT is selected, not of how.
      const pinned = [...selected].sort((a, b) => a - b);
      const rounds = obj.adapt ? BURST.physicsRounds : BURST.freeRounds;

      const rng = rngFrom('tank', vivariumSeed, 'burst', generation);
      // Yield so the progress % paints AND the tab stays responsive. rAF gives a
      // real paint when visible; the setTimeout fallback keeps the burst advancing
      // when the tab is hidden (rAF is paused there) so it can never wedge.
      const repaint = () => new Promise((r) => {
        let fired = false; const go = () => { if (!fired) { fired = true; r(); } };
        requestAnimationFrame(go); setTimeout(go, 50);
      });
      // Bodies that will actually be scored: the initial non-pinned pool, then
      // whatever each round replaces. Pins are never scored — they are kept
      // regardless, so measuring them would be trials spent on a foregone
      // conclusion. An estimate is honest here: the exact count depends on how
      // many free slots each breed leaves.
      const perRound = BURST.pool - Math.max(pinned.length, BURST.pool >> 1);
      const totalBodies = (BURST.pool - pinned.length) + rounds * Math.max(1, perRound);
      let done = 0;
      const showProgress = () => {
        btnBurst.textContent = `${Math.min(99, Math.round((100 * done) / totalBodies))}%`;
      };

      (async () => {
        // expand to the burst pool with fresh strangers (never clones — §autoBurst)
        let pop = genomes.slice();
        if (pop.length < BURST.pool) {
          const extra = seedPopulation({
            RAPIER, rng: rng.fork('expand'), world: W1_SLICE,
            population: BURST.pool - pop.length, authoredSlots: 0,
          });
          pop = pop.concat(extra.genomes);
        }

        const isPinned = new Set(pinned);
        const scores = new Array(pop.length).fill(0);
        // A SEPARATE FLAG, not a sentinel score, because 0 is a real result: a
        // creature that will not build, or that thrashes in place, genuinely
        // scores zero and must not be confused with one that was never measured.
        let measured = new Array(pop.length).fill(false);
        for (const i of pinned) measured[i] = true;   // pins are kept, never ranked

        const scoreSlot = async (i) => {
          if (obj.adapt) {
            // Lamarckian, and only for the unpinned: the adapted controller is
            // what gets bred from, because a body must be judged by the gait it
            // CAN reach rather than the one it was born with (gait.js). A pin is
            // exempt — adapting it would hand the player back a different animal
            // than the one they pinned.
            const a = adaptGait(RAPIER, {
              genome: pop[i], world: W1_SLICE, rng: rng.fork(`b${i}:${done}`),
              candidates: BURST.candidates, iterations: BURST.iterations,
            });
            pop[i] = a.genome; scores[i] = a.score;
          } else {
            scores[i] = scoreBy(RAPIER, obj, [pop[i]], W1_SLICE)[0];
          }
          measured[i] = true;
          done++; showProgress();
          // Yield so the % paints and the tab stays alive. A geometric score is
          // a few microseconds, so yielding per body would spend more time
          // waiting for frames than measuring — batch those.
          if (obj.adapt || done % 8 === 0) await repaint();
        };

        for (let i = 0; i < pop.length; i++) {
          if (measured[i]) continue;
          await scoreSlot(i);
          if (stopped) return;
        }

        for (let round = 0; round < rounds; round++) {
          // Half the pool breeds, as before — but the pins take those places
          // first and only the remainder is decided by score.
          const selectN = Math.max(2, pop.length >> 1);
          const parents = burstSelection(pinned, scores, selectN);
          const before = pop;
          pop = breed({
            RAPIER, genomes: pop, selected: parents,
            rng: rng.fork(`breed${round}`), world: W1_SLICE,
            // Asexual, matching engine/l2/objective.js autoBurst — see the note
            // there. The burst breeds from half the pool, so it would go sexual
            // for free and stop being comparable to tools/_zburst.mjs and every
            // figure taken with it. Turning it on is its own session, with a
            // null arm; Breed is the player-facing path and it already mixes.
            limits: { ...SLICE_LIMITS, crossoverRate: 0 },
          }).genomes;

          // ONLY THE NEW BODIES ARE RESCORED. N18 returns an elite as the SAME
          // OBJECT REFERENCE, so identity is an exact test for "this creature did
          // not change" — no hashing, no comparison, no chance of a stale score
          // surviving a real change. It is most of the saving that pays for the
          // extra rounds.
          measured = pop.map((g, i) => (g === before[i] && measured[i]) || isPinned.has(i));
          for (let i = 0; i < pop.length; i++) {
            if (measured[i]) continue;
            await scoreSlot(i);
            if (stopped) return;
          }
        }

        // Pins back in their own slots, untouched; the rest filled by score.
        const keep = burstKeep(pinned, scores, POPULATION);
        genomes = keep.map(i => pop[i]);
        provenance = keep.map((poolIndex, slot) =>
          (isPinned.has(poolIndex) && poolIndex === slot
            ? { kind: KIND.ELITE, parent: slot, ops: [], attempts: 0, fellBack: false }
            : { kind: KIND.OFFSPRING }));
        generation++;
        // The selection SURVIVES the burst. Clearing it threw away the player's
        // curation on every run, which is the same defect as not honouring it.
        selected = new Set(pinned);
        pendingStranger = null; updateStrangerChip();

        buildSlots();
        btnBurst.textContent = '';
        state = STATE.BREEDING;                   // play the transition beat, then resume
        breedingUntil = performance.now() + BREEDING_MS;
        renderStatus();
        persistLineage();
      })().catch(() => {
        // A failed burst must not strand the tank frozen — restore and resume.
        btnBurst.textContent = '';
        state = paused ? STATE.PAUSED : STATE.SIMULATING;
        view.dataset.breeding = 'no';
        renderStatus();
      });
    }

    function renderStatus() {
      // Cluster chips.
      btnPause.textContent = paused ? t('Play') : t('Pause');
      btnSpeed.textContent = `${speed}×`;
      btnSpeed.classList.add('active');   // the speed chip is the measured value
      btnSpeed.disabled = paused;
      btnUndo.textContent = t('Undo');
      btnUndo.disabled = !previous || state === STATE.BURSTING;

      // The burst chip. While it runs, its label is the live % (set in runBurst),
      // so renderStatus leaves the text alone and only manages disabled state.
      const busy = state === STATE.BURSTING;
      if (!busy) btnBurst.textContent = t('Burst');
      btnBurst.disabled = !ready || busy;
      btnPause.disabled = busy;
      btnSeek.textContent = seeking ? t('Seeking') : t('Seek');
      btnSeek.classList.toggle('active', seeking);
      btnSeek.disabled = !ready || busy;

      // Primary action — always labelled with its object (never bare "Breed").
      primary.disabled = !ready || selected.size === 0 || busy;
      primary.textContent = selected.size
        ? `${t('Breed')} ${selected.size} ${t('selected')}`
        : t('Breed');

      // Top-left readout: generation, then world · body-count (numeral mono).
      genEl.textContent = ready ? `${t('Generation')} ${generation}` : t('Loading…');
      const bodies = slots.reduce((a, s) => a + s.plan.bodyCount, 0);
      worldEl.innerHTML = `${W1_SLICE.name} · <span class="num">${bodies}</span> ${t('bodies')}`;

      // Top-right readout: selection count, then the stranger slot(s). The
      // stranger line is meaningful only once there is a lineage (generation > 0).
      selEl.innerHTML = `<span class="num">${selected.size}</span> ${t('of')} <span class="num">${POPULATION}</span> ${t('selected')}`;
      const strangers = generation > 0
        ? provenance.map((p, i) => (p?.kind === KIND.STRANGER ? i : -1)).filter(i => i >= 0)
        : [];
      strangersEl.hidden = strangers.length === 0;
      strangersEl.innerHTML = strangers.length === 1
        ? `${t('Slot')} <span class="num">${strangers[0] + 1}</span> ${t('unrelated')}`
        : `<span class="num">${strangers.length}</span> ${t('unrelated')}`;

      // WHAT THE NEXT BREED WILL ACTUALLY PRODUCE, before the player commits to
      // it. This line exists because the screen could not answer the first
      // question a player asks of it: selecting three creatures does not make
      // three-parent children, it makes FEWER children — the selected keep their
      // own slots — and each of the ones it does make mixes two of the three.
      // The five-selected dead end (five elites, one stranger, no children at
      // all) was invisible until you tapped Breed and nothing new appeared.
      //
      // Derived from the same two rules breed() uses rather than from constants,
      // so it cannot drift from what actually happens.
      const strangerSlots = strangerCount(POPULATION);
      const elites = Math.min(selected.size, POPULATION - strangerSlots);
      const kids = POPULATION - elites - strangerSlots;
      // Four selected leaves exactly one free slot, so the plural is reachable in
      // ordinary play rather than a hypothetical.
      const kidsLabel = selected.size === 1
        ? (kids === 1 ? t('child of it') : t('children of it'))
        : (kids === 1 ? t('child, mixing two of them') : t('children, each mixing two of them'));
      mixEl.hidden = selected.size === 0;
      mixEl.innerHTML = kids === 0
        ? t('no room for children — deselect one')
        : `<span class="num">${kids}</span> ${kidsLabel}`;
    }

    // ── lineage persistence ──────────────────────────────────────────────────
    // The tank used to persist only its seed and re-derive generation 0 on every
    // mount, so all breeding progress was lost on reload (the "reinitialising").
    // Now the whole lineage is written after each change and hydrated on boot —
    // the design's `Lineage` shape (01 §; store's `lineage` kind, keyed by seed).

    function lineageRecord() {
      return {
        vivariumId: vivariumSeed,
        generation,
        genomes,
        provenance,
        selected: [...selected],
        previous: previous && {
          genomes: previous.genomes, provenance: previous.provenance,
          generation: previous.generation, selected: previous.selected,
        },
      };
    }

    /** Fire-and-forget: an unpersisted tank is still a working tank (H7 style). */
    function persistLineage() {
      store.set(store.KEY.lineage(vivariumSeed), lineageRecord())
        .catch(() => { /* storage unavailable — the session still runs */ });
    }

    /** The saved lineage, or null if absent, malformed, or from a future build. */
    async function loadLineage() {
      try {
        const rec = await store.get(store.KEY.lineage(vivariumSeed));
        if (!rec || !Array.isArray(rec.genomes) || rec.genomes.length !== POPULATION) return null;
        // Reject anything structurally invalid rather than booting a broken tank;
        // it falls back to a fresh seed below.
        for (const g of rec.genomes) if (!validateGenome(g).ok) return null;
        return rec;
      } catch { return null; }   // FutureVersionError, parse failure, first run
    }

    /**
     * This lineage's seed: read it, or mint one and persist it (H7).
     *
     * Persisted, because a seed regenerated on every load would make the tank
     * non-reproducible in the other direction — the same lineage would drift
     * each time it was opened, and no shared fiche could ever be replayed.
     */
    async function loadOrCreateVivariumSeed() {
      const KEY = 'vivarium:seed';
      try {
        const stored = await store.get(KEY);
        if (Number.isInteger(stored) && stored >= 0 && stored <= 0xFFFFFFFF) return stored;
      } catch { /* first run, or storage unavailable — mint below */ }
      const fresh = freshVivariumSeed();
      try { await store.set(KEY, fresh); } catch { /* unpersisted is still better than shared */ }
      return fresh;
    }

    // ── boot ────────────────────────────────────────────────────────────────
    // RAPIER.init() is async and 01 §4 forbids async inside /engine/, so the
    // screen awaits it once and hands the namespace down. Until then the tank
    // is LOADING and every control is inert.

    genEl.textContent = t('Loading…');
    renderStatus();
    updateStrangerChip();

    (async () => {
      await RAPIER.init();
      if (stopped) return;
      // 21 §4.6: first run auto-creates a lineage.
      // H7 — created once, then persisted. `rngFrom('tank', 'seed')` gave every
      // player the same six creatures; reproducibility is meant to replay ONE
      // lineage, not to issue everyone the same one.
      vivariumSeed = await loadOrCreateVivariumSeed();
      // Resume the saved lineage if there is one; otherwise seed generation 0 and
      // persist it so the next reload resumes rather than reseeds.
      const saved = await loadLineage();
      if (stopped) return;
      if (saved) {
        generation = saved.generation ?? 0;
        genomes = saved.genomes;
        provenance = saved.provenance ?? genomes.map(() => ({ kind: KIND.STRANGER }));
        selected = new Set(Array.isArray(saved.selected) ? saved.selected : []);
        previous = saved.previous
          ? { ...saved.previous, selected: saved.previous.selected ?? [] }
          : null;
      } else {
        const seeded = seedPopulation({ RAPIER, rng: rngFrom('tank', vivariumSeed, 'seed'), world: W1_SLICE });
        genomes = seeded.genomes;
        provenance = seeded.provenance;
        persistLineage();
      }
      buildSlots();
      ready = true;
      state = STATE.SIMULATING;
      updateStrangerChip();
      renderStatus();
    })();

    function resize() {
      const w = view.clientWidth, h = view.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      const aspect = w / h;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();

      // WORK AREA — the water left clear by the top ribbon and the bottom controls
      // (the Breed button + cluster). Frame the grid to fill THAT band, not the
      // whole canvas, and bias it upward so it sits centred in the clear region
      // rather than half-hidden behind the primary action.
      const topPx = tokenPx('--scrim-top');
      const botPx = tokenPx('--scrim-bottom');
      const workFrac = Math.max(0.4, (h - topPx - botPx) / h);
      const fovV = (camera.fov * Math.PI) / 180;

      // Zoom to fill: project the real bodies through the real camera and solve the
      // distance that lands the worst vertex on the target NDC — a bounding-sphere
      // fit over-frames the grid and leaves it small in an empty frame. Sample yaws
      // AROUND the opening angle so the first frame fills tightly.
      let home = HOME.dist;
      if (slots.length) {
        scene.updateMatrixWorld(true);
        const target = Math.min(0.92, Math.max(0.5, workFrac * 0.95));
        const yaws = [HOME.theta - 0.25, HOME.theta, HOME.theta + 0.25];
        home = fitOrbit(camera, slots.map((s) => s.group), { ...FIT.portrait, target, yaws }).distance;
        // Ride the composition up by half the top/bottom chrome imbalance, in world
        // units at the fitted distance, so the clear band is what it sits in.
        baseTargetY = -((botPx - topPx) / h) * home * Math.tan(fovV / 2);
      }
      const wasHome = Math.abs(orbit.dist - HOME.dist) < HOME.dist * 0.02;
      HOME.dist = home;
      // Keep the player's zoom across a resize, unless they never touched it.
      if (wasHome) orbit.dist = home;
      else zoomTo(orbit.dist);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(view);
    resize();
    raf = requestAnimationFrame(frame);

    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        clearTimeout(longPressTimer);
        ro.disconnect();
        disposeSlots();
        disposeWater(water);
        renderer.dispose();
      },
    };
  },

  unmount(instance) { instance?.stop?.(); },
};
