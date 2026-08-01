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
import { seedPopulation, breed, POPULATION, KIND } from '../../engine/l1/breed.js';
import { adaptGait } from '../../engine/l2/gait.js';
import { bearingTo } from '../../engine/l2/duel.js';
import { genomeHash, validateGenome } from '../../engine/l1/genome.js';
import { binomial } from '../../engine/l1/naming.js';
import { buildCreature, disposeCreature, token, rampFor, updateCreatureGlow } from '../../render/creature.js';
import { renderThumbnail } from '../../render/thumbnail.js';
import { W1_SLICE } from '../../worlds/w1_slice.js';
import { button } from '../widgets.js';
import {
  cellCentres, unionBounds, stepBudget, hitRadius, classifyPointer, gridFor,
  frameDistance, smoothSpeed, horizontalSpeed, nextSpeed, STATE, BREEDING_MS, TAP,
} from '../tank/sim.js';

/** A token that is a length, as a number. N16 forbids the literal; this reads it. */
const tokenPx = (name) => parseFloat(token(name));

/* ══ EXPERIMENT (revertible, UNCOMMITTED) — creature + tank size ══════════════
   PLAN-AFTER-B2 §1 "choose the frame". Measured with tools/_zstrouhal.mjs:
   shrinking creatures ~0.5× roughly TRIPLES body-lengths/sec (absolute speed
   holds while length halves; the drag regime is not scale-free). This is a
   TANK-LOCAL trial only — the engine, worlds/w1_slice.js and the gate are
   untouched. TO REVERT: EXP_CREATURE_SCALE = 1, EXP_TANK_BOUNDS = null. */
const EXP_CREATURE_SCALE = 0.5;
const EXP_TANK_BOUNDS = [10, 15, 10];   // W1_SLICE ships [16, 24, 16]

/** Uniform geometric shrink of a genome (node dims; connection scales are ratios,
 *  unaffected), so morphogenesis rebuilds a proportionally smaller body. */
function scaleGenome(genome, s) {
  if (!s || s === 1) return genome;
  const g = structuredClone(genome);
  for (const n of g.nodes) n.dims = n.dims.map((d) => d * s);
  return g;
}

/** A vertical equirectangular gradient as a CanvasTexture — top colour at the
 *  surface, bottom colour at depth. Used as the scene background (water) and,
 *  through PMREM, as the image-based lighting the physical materials read.
 *  Equirectangular so the gradient follows the camera's pitch as it orbits. */
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
    mk('tank-scrim tank-scrim-top', wrap);
    mk('tank-scrim tank-scrim-bottom', wrap);

    // Top readouts — generation/world left, selection/stranger right.
    const readouts = mk('tank-readouts', wrap);
    const readoutL = mk('tank-readout-l', readouts);
    const genEl = mk('tank-gen', readoutL);
    const worldEl = mk('tank-world', readoutL);
    const readoutR = mk('tank-readout-r', readouts);
    const selEl = mk('tank-sel', readoutR);
    const strangersEl = mk('tank-strangers', readoutR);

    // First-run coach — three words, once (21 §4.6). Removed on the first breed.
    const coach = mk('tank-coach', wrap);
    coach.textContent = t('Tap one you like → Breed → repeat');

    // Control cluster (pill) and the primary action. Chips are built in ─controls.
    const cluster = mk('tank-cluster', wrap);
    const primary = mk('tank-breed', wrap, 'button');
    primary.type = 'button';

    el.append(wrap);

    const sheet = mk('tank-sheet', wrap);
    sheet.hidden = true;

    // ── scene ───────────────────────────────────────────────────────────────
    // The 3D layer owns the water: it is the scene background AND the source of
    // image-based light. A transmissive membrane needs a backdrop to refract and
    // the fog needs a colour to fade creatures into — a CSS layer behind a
    // transparent canvas would give the materials neither.
    const bg = new THREE.Color(token('--c-bg'));
    const ramp = rampFor(W1_SLICE.palette);
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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    view.prepend(renderer.domElement);

    // Water background — the two --c-water stops, lighter toward the surface.
    // backgroundIntensity lifts the backdrop out of the ACES shadow crush so the
    // water reads as deep water rather than near-black — it brightens only the
    // background, not the creature lighting (that is environmentIntensity).
    const waterTex = equirectGradient(new THREE.Color(token('--c-water-0')), bg);
    scene.background = waterTex;
    scene.backgroundIntensity = 2.6;

    // Image-based lighting from the ramp, never a chrome literal. PMREM so the
    // physical materials get a correct roughness response, not a mirror.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envSource = equirectGradient(ramp[2], bg);
    const envRT = pmrem.fromEquirectangular(envSource);
    scene.environment = envRT.texture;
    envSource.dispose();
    pmrem.dispose();

    // Lights — key + hemi + a rim taken FROM THE RAMP (creature presentation):
    // a hard-coded accent paints out-of-ramp light onto a warm-silt animal.
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(2.5, 5, 3);
    scene.add(key);
    scene.add(new THREE.HemisphereLight(ramp[1].clone(), bg.clone(), 0.75));
    const rim = new THREE.DirectionalLight(ramp[2].clone(), 1.7);
    rim.position.set(-2, 1.2, -4);
    scene.add(rim);

    // EXPERIMENT: a tank-local world with the trial bounds (see EXP_* at top). The
    // engine/gate still use the shipped W1_SLICE; only this screen's sims + render
    // see the smaller tank. Revert = EXP_TANK_BOUNDS null.
    const TANK = EXP_TANK_BOUNDS ? { ...W1_SLICE, tankBounds: EXP_TANK_BOUNDS } : W1_SLICE;

    // The wireframe is the UNION of the six real tanks (see ui/tank/sim.js), so
    // what is drawn is a true statement about where creatures can go. Both the
    // grid and the box follow the window: see gridFor().
    let grid = gridFor(1);
    let cells = cellCentres(TANK.tankBounds, grid);
    let union = unionBounds(TANK.tankBounds, grid);
    let unionRadius = 0.5 * Math.hypot(union[0], union[1], union[2]);

    const boundsMat = new THREE.LineBasicMaterial({ color: new THREE.Color(token('--c-line')) });
    let bounds = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...union)), boundsMat);
    scene.add(bounds);
    // Fog fades creatures into the water. Near/far track the LIVE camera distance
    // every frame (placeCamera), not the union size: the camera sits far enough
    // back to frame the union that a union-scaled far plane put the whole scene
    // beyond the fog and rendered it flat to the background colour.
    scene.fog = new THREE.Fog(bg, 1, 100);

    function relayout(aspect) {
      const next = gridFor(aspect);
      if (next.cols === grid.cols && next.rows === grid.rows) return false;
      grid = next;
      cells = cellCentres(TANK.tankBounds, grid);
      union = unionBounds(TANK.tankBounds, grid);
      scene.remove(bounds);
      bounds.geometry.dispose();
      bounds = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...union)), boundsMat);
      scene.add(bounds);
      unionRadius = 0.5 * Math.hypot(union[0], union[1], union[2]);
      for (const s of slots) s.group.position.set(cells[s.index][0], cells[s.index][1], cells[s.index][2]);
      return true;
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
    // 'flesh' drops the transmissive membrane, 'flat' drops the generated maps.
    // 'full' — the design's translucent shell over the organ, with luminous
    // creatures glowing through it. Held ~56 fps at six creatures on desktop;
    // drop to 'flesh' (or wire this to the dev-panel quality control) if a
    // weaker GPU can't sustain the transmission passes.
    let detail = 'full';
    let accumulator = 0, lastMs = 0, raf = 0, breedingUntil = 0;
    let stopped = false;
    let ready = false;

    // Orbit, in spherical coordinates about the tank centre. `home` is computed
    // from the window on every resize rather than being a multiplier that
    // happened to look right once — see frameDistance().
    const orbit = { theta: 0.6, phi: 1.15, dist: 1 };
    const HOME = { theta: 0.6, phi: 1.15, dist: 1 };

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
        const pivot = new THREE.Group();
        pivot.position.set(cells[i][0], cells[i][1], cells[i][2]);
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
          mass: totalMass(plan),
          pose: sim.readPose(),
          speed: 0,
          world: new THREE.Vector3(),
        };
      });
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
      camera.position.set(
        r * Math.sin(orbit.phi) * Math.sin(orbit.theta),
        r * Math.cos(orbit.phi),
        r * Math.sin(orbit.phi) * Math.cos(orbit.theta));
      camera.lookAt(0, 0, 0);
      // Fog around the tank at whatever distance the camera actually sits, so the
      // near face stays crisp and the far wall dissolves into water — at any zoom.
      scene.fog.near = Math.max(0.1, orbit.dist - unionRadius);
      scene.fog.far = orbit.dist + unionRadius * 1.6;
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
      placeCamera();
      if (ready) syncOverlay();
      renderer.render(scene, camera);
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
      view.setPointerCapture?.(e.pointerId);

      if (pointers.size === 2) {
        // A second finger cancels whatever the first was doing. It is not a tap,
        // not a long press and not an orbit — it is the start of a pinch.
        clearTimeout(longPressTimer);
        down = null;
        pinch = { dist: pinchSpan(), orbitDist: orbit.dist };
        return;
      }
      if (pointers.size > 2) { pinch = null; down = null; clearTimeout(longPressTimer); return; }

      down = { id: e.pointerId, x: e.clientX, y: e.clientY, at: performance.now(), moved: false, target: pick(e.clientX, e.clientY) };
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
        return;
      }
      if (!down || e.pointerId !== down.id) return;

      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (Math.hypot(dx, dy) >= TAP.maxMovePx) {
        down.moved = true;
        clearTimeout(longPressTimer);
        // Background drag orbits (21 §4.3). Dragging always orbits, whether or
        // not it started on a creature — a drag is never a selection.
        orbit.theta -= dx * 0.005;
        orbit.phi = Math.min(Math.PI - 0.15, Math.max(0.15, orbit.phi - dy * 0.005));
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

    view.addEventListener('dblclick', () => { Object.assign(orbit, HOME); });

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
        [t('Mass'), `${s.mass.toFixed(2)} kg`],
        [t('Radius'), `${s.radius.toFixed(2)} m`],
        [t('Speed'), `${s.speed.toFixed(2)} m/s`],
        // H3b — a stranger whose viability search was exhausted is filled into
        // the slot anyway so the tank is never short, but it is never presented
        // as an ordinary creature. `viable` is absent on elites and offspring,
        // so only an explicit false says anything.
        [t('Origin'), t(provenance[s.index]?.kind ?? KIND.STRANGER)
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
    // C3 — teach the whole tank to swim. Freezes the six, runs the gait inner loop
    // (adaptGait) over an expanded population, breeds on the ADAPTED speed, and
    // returns the best six. Long — a progress % rides the chip while it runs.
    const btnBurst = chip('burst', runBurst);
    // C5 — Seek toggle: show the steering loop closing. Flips every creature into
    // homing on its beacon and back.
    const btnSeek = chip('seek', () => {
      seeking = !seeking;
      for (const s of slots) s.beacon.visible = seeking;
      applySeek();               // takes effect immediately, even while paused-visible
      renderStatus();
    });
    cluster.append(btnPause, btnSpeed, btnUndo, btnStranger, btnBurst, btnSeek);
    primary.addEventListener('click', doBreed);

    function updateStrangerChip() {
      btnStranger.textContent = pendingStranger
        ? `${t('Stranger')}: ${pendingStranger.commonName}`
        : `${t('Stranger')}: ${t('random')}`;
      btnStranger.classList.toggle('picked', !!pendingStranger);
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

    // ── the gait burst (C3) ───────────────────────────────────────────────────
    // "A body is judged by its ADAPTED gait, never its birth gait." The player's
    // six are frozen; the population is expanded with fresh strangers; every body
    // has its controller hill-climbed by adaptGait (morphology frozen) and is bred
    // on that adapted speed, Lamarckian; the best six come back swimming.
    //
    // Modest by design: a full burst is many seconds of blocking sim, so the loop
    // YIELDS to a repaint between bodies (the progress % is why) and the numbers
    // are the small end of the plan's range. Scoring is in the canonical W1_SLICE,
    // not the tank's display-scaled world, so a gait adapts for the real physics.
    const BURST_POP = 12, BURST_GENS = 2, BURST_CAND = 4, BURST_ITER = 2;

    function runBurst() {
      if (!ready || state === STATE.BREEDING || state === STATE.BURSTING) return;
      coach.hidden = true;
      previous = { genomes, provenance, generation, selected: [...selected] };  // one-step undo
      state = STATE.BURSTING;
      view.dataset.breeding = 'yes';
      renderStatus();

      const rng = rngFrom('tank', vivariumSeed, 'burst', generation);
      // Yield so the progress % paints AND the tab stays responsive. rAF gives a
      // real paint when visible; the setTimeout fallback keeps the burst advancing
      // when the tab is hidden (rAF is paused there) so it can never wedge.
      const repaint = () => new Promise((r) => {
        let fired = false; const go = () => { if (!fired) { fired = true; r(); } };
        requestAnimationFrame(go); setTimeout(go, 50);
      });
      const totalBodies = BURST_POP * (BURST_GENS + 1);
      let done = 0;
      const showProgress = () => { btnBurst.textContent = `${Math.round((100 * done) / totalBodies)}%`; };

      (async () => {
        // expand to BURST_POP with fresh strangers (never clones — §autoBurst)
        let pop = genomes.slice();
        if (pop.length < BURST_POP) {
          const extra = seedPopulation({
            RAPIER, rng: rng.fork('expand'), world: W1_SLICE,
            population: BURST_POP - pop.length, authoredSlots: 0,
          });
          pop = pop.concat(extra.genomes);
        }

        let scores = [];
        for (let gen = 0; gen <= BURST_GENS; gen++) {
          const adapted = []; scores = [];
          for (let i = 0; i < pop.length; i++) {
            const a = adaptGait(RAPIER, {
              genome: pop[i], world: W1_SLICE, rng: rng.fork(`g${gen}b${i}`),
              candidates: BURST_CAND, iterations: BURST_ITER,
            });
            adapted.push(a.genome); scores.push(a.score);
            done++; showProgress();
            await repaint();                      // yield so the % paints and the tab stays alive
            if (stopped) return;
          }
          pop = adapted;                          // Lamarckian: adapted controllers survive
          if (gen === BURST_GENS) break;          // final pass adapts only, no breed
          const order = scores.map((s, i) => ({ s, i })).sort((x, y) => y.s - x.s);
          const survivors = order.slice(0, Math.max(2, pop.length >> 1)).map((x) => x.i);
          pop = breed({
            RAPIER, genomes: pop, selected: survivors,
            rng: rng.fork(`breed${gen}`), world: W1_SLICE, population: BURST_POP,
          }).genomes;
        }

        // keep the best POPULATION by adapted speed
        const ranked = scores.map((s, i) => ({ s, i })).sort((x, y) => y.s - x.s);
        genomes = ranked.slice(0, POPULATION).map((x) => pop[x.i]);
        provenance = genomes.map(() => ({ kind: KIND.OFFSPRING }));
        generation++;
        selected = new Set();
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

      // Grid first: it changes the union, which changes the framing.
      const rotated = relayout(aspect);
      const fovV = (camera.fov * Math.PI) / 180;
      const home = frameDistance(union, fovV, aspect);
      const wasHome = Math.abs(orbit.dist - HOME.dist) < HOME.dist * 0.02;
      HOME.dist = home;
      // Keep the player's zoom across a resize, unless they had never touched it
      // or the grid just rotated under them — in which case their old distance
      // frames a box that no longer exists.
      if (wasHome || rotated) orbit.dist = home;
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
        waterTex.dispose();
        envRT.dispose();
        renderer.dispose();
      },
    };
  },

  unmount(instance) { instance?.stop?.(); },
};
