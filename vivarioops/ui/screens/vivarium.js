// ui/screens/vivarium.js — the tank and the forage trial, merged.
//
// THE PROBLEM THIS SOLVES. Tank and Forage were two screens doing half a job
// each. Tank bred, but its six creatures lived in six PRIVATE wrapped arenas and
// never ate — so nothing you selected on had any consequence. Forage had the
// real shared ocean, the food field, trails, a ledger and genuine selection
// pressure, but could not breed, so nothing you learned there could be acted on.
// Judging a lineage meant switching tabs and losing what you were looking at.
//
// ── BUILT FROM FORAGE, ABSORBING TANK ──────────────────────────────────────
//
// Forage owns the harder half — a shared arena, a growing food field, trails, an
// idle-throttled loop, per-creature ledger rows. Tank's breeding is bookkeeping
// and buttons on top of that. So this file IS forage.js with tank.js's breeding
// grafted in, and the merge is mostly DELETION: `layoutGrid` and the whole
// slot/grid apparatus, Seek, the three-state click cycle, two copies of `mk` and
// two incompatible copies of `chip`, and one entire screen's worth of chrome.
//
// ── WHAT CHANGED IN THE MOVE, AND WHY ──────────────────────────────────────
//
// ACES + FOG. tank.js:180 sets ACESFilmicToneMapping and a fog; forage.js set
// NEITHER. render/creature.js's materials are authored against ACES and
// compensate for its knee in the emissive path, so Forage has been rendering
// every creature under the wrong tone curve since it was written. Fixed here,
// and it changes how everything looks.
//
// SEEK IS DROPPED (tank.js:865, applySeek). It existed to prove the steering
// loop closes against a beacon at each creature's grid cell, and there are no
// cells any more. Generations spawn free-swimming on the existing ring.
//
// THE STRANGER MARK IS A GLYPH, NOT A RING. It used to be a second ring at
// radius*1.4 in a different tint at half opacity — the same geometry as
// selection, which made provenance and selection compete in the same visual
// language. Selection owns rings; provenance owns glyphs.
//
// THE GESTURE IS THE TANK'S. Forage had a three-state click cycle (tap select →
// tap details → tap release) because a long-press is a phone gesture and an
// awkward mouse one. But two screens showing the same creatures must not answer
// the same gesture differently, and the shared classifier already supports the
// tank's contract. tap = select, long-press = sheet, tap open water = clear.
//
// AQUARIUM IS DISABLED, NOT DELETED. `HABITATS` keeps both entries and `spawn()`
// keeps its bounded branch; ocean is forced and the segmented control is not
// rendered. Re-enabling it is a UI change, not a physics one.
//
// N16: no hex colours and no raw pixel values.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { t } from '../../trunk/i18n.js';
import { rngFrom, freshVivariumSeed } from '../../trunk/rng.js';
import * as store from '../../trunk/store.js';
import { seedAtlas } from '../../worlds/atlas_seed.js';
import { morphogenesis, totalMass, boundingRadius } from '../../engine/l1/morphogen.js';
import { createArena, createSimulation, FIXED_DT } from '../../engine/l1/physics.js';
import { seedPopulation, breed, strangerCount, POPULATION, KIND } from '../../engine/l1/breed.js';
import { SLICE_LIMITS } from '../../engine/l1/factory.js';
import { adaptGait } from '../../engine/l2/gait.js';
import { OBJECTIVES, scoreBy } from '../../engine/l2/objective.js';
import { genomeHash, validateGenome } from '../../engine/l1/genome.js';
import { binomial } from '../../engine/l1/naming.js';
import {
  makeFood, makeChunkedFood, mouthsOf, mouthPoints, forageStep, ledger,
  reserveAfter, INGEST_RATE, FOOD_DENSITY,
} from '../../engine/l2/forage.js';
// The beacon's two lines. The SAME pair `tools/_zlight.mjs` uses, imported rather
// than reimplemented, so what a player watches on screen and what the experiment
// measures cannot drift apart.
import { sensorTurnBias, sensorTurnBias2, sensorEffort } from '../../engine/l1/controller.js';
import { bearingTo, bearingPair } from '../../engine/l2/duel.js';
// S3 for the steering plane. Without it `bearingTo` falls back to the horizontal
// and the beacon is inert — see the note on `measureTurnPlanes`.
import { S3, S3_BIAS, SOLO_GRAVITY, SOLO_BOUNDED } from '../../engine/l2/probes.js';
import { creatureTissue } from '../../engine/l1/tissue.js';
import {
  buildCreature, disposeCreature, token, tokenNumber, rampFor, colourFrom,
  updateCreatureGlow,
} from '../../render/creature.js';
import {
  createWater, updateWater, disposeWater, fitAtmosphere, renderOverlay, dotTexture,
  fitOrbit, FIT,
} from '../../render/tank.js';
import { renderThumbnail, RENDER_TAG } from '../../render/thumbnail.js';
import { W1_SLICE } from '../../worlds/w1_slice.js';
import { stepBudget, hitRadius, classifyPointer, TAP, BREEDING_MS, STATE, BURST, burstSelection, burstKeep } from '../tank/sim.js';
import { button, mk, chip } from '../widgets.js';
import { specCard } from '../cards.js';
import { openMenu, closeMenu } from '../menu.js';
import { atlasContext, nameFor, labelFor } from '../vernacular.js';

/** Trail buffer, in samples. NOTHING IS FORGOTTEN below the ceiling: the buffer
 *  doubles instead of sliding, because seeing the WHOLE history is the point —
 *  a creature that has quartered the ocean against one that has trembled in
 *  place is the most legible thing on this screen, and a sliding window erases
 *  exactly the evidence you came for. At 4 Hz the ceiling is over two hours. */
const TRAIL_START = 2048;
const TRAIL_CEIL = 32768;

/** Forage's ladder, not the tank's: the energy multiplier separates a cast over
 *  MINUTES, and at 4x an hour of trial is a quarter-hour of staring. */
const SPEEDS = [1, 2, 4, 8, 16, 32];

/** A creature whose bodies are further apart than this has COME APART.
 *  Measured (tools/_zboom.mjs): normal poses sit at 0.5–1.5, a burst reaches 297. */
const BURST_SPREAD = 3;

/**
 * BOTH ARE KEPT. The aquarium is disabled, not deleted: `spawn()` still has its
 * bounded branch, the glass still exists, and this table still has both entries.
 * Ocean is forced and the segmented control is not rendered, so re-enabling the
 * comparison is a UI change rather than a physics one — and the comparison was
 * worth something (measured, tools/_zthrive.mjs: Darter reads 1.96x walled and
 * 6.91x open, the same animal with a different verdict).
 */
const HABITATS = [
  { id: 'aquarium', label: 'Aquarium' },
  { id: 'ocean', label: 'Open ocean' },
];
const HABITAT_ID = HABITATS[1].id;

/** A small billboarded mark. Reused for the speed readout and the stranger glyph. */
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
  if (l.last === text) return;      // only re-rasterise when the glyph changes
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
function disposeLabel(l) { l.tex.dispose(); l.mat.dispose(); }

/** The stranger glyph. A lozenge: not a ring, not a letter, and legible at 12 px. */
const STRANGER_GLYPH = '◇';

export default {
  title: t('Vivarium'),

  mount(el) {
    // ── chrome ──────────────────────────────────────────────────────────────
    const wrap = mk('tank');
    const view = mk('tank-view', wrap);
    mk('tank-scrim tank-scrim-bottom', wrap);

    const readouts = mk('tank-readouts', wrap);
    const left = mk('tank-readout-l', readouts);
    const genEl = mk('tank-gen', left);
    const worldEl = mk('tank-world', left);
    const foodEl = mk('tank-world', left);
    const selEl = mk('tank-sel', left);
    const strangersEl = mk('tank-strangers', left);
    const mixEl = mk('tank-mix', left);
    const rows = mk('forage-rows', left);

    const coach = mk('tank-coach', wrap);
    coach.textContent = t('Tap one you like → Breed → repeat');

    // Two pills and a primary row. The handover's grouping, and it is a real
    // distinction: the primary trio CHANGES the population, transport changes
    // only how fast you watch it.
    const tools = mk('tank-tools', wrap);
    const cluster = mk('tank-cluster', wrap);
    const primaryRow = mk('tank-primary', wrap);
    const primary = mk('tank-breed', primaryRow, 'button');
    primary.type = 'button';

    const scaleEl = mk('tank-scale', wrap);
    const scaleLine = mk('tank-scale-line', scaleEl);
    const scaleText = mk('tank-scale-text', scaleEl);

    const sheet = mk('tank-sheet', wrap);
    sheet.hidden = true;
    el.append(wrap);

    // ── scene ───────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    // ACES AND THE EXPOSURE TOKEN — the fix described in the header. Without
    // these the transmissive membrane and the iridescent bodies blow out, and
    // render/creature.js's emissive path (which corrects FOR the ACES knee)
    // over-corrects into the wrong hue.
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = tokenNumber('--tank-exposure');
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    // ── A LOST CONTEXT MUST NOT BE SILENT ───────────────────────────────────
    //
    // When this context goes, the tank turns black and NOTHING ELSE CHANGES:
    // the physics is Rapier on the CPU, so the clock keeps ticking, the mass
    // readouts keep updating and the creature list keeps naming animals nobody
    // can see. That is the worst possible failure shape — it looks like a
    // rendering bug in the shader, or like nothing at all.
    //
    // The cause found on 2026-08-10 was `render/thumbnail.js` leaking one
    // context per portrait (see the long note there); with 21 library portraits
    // rendered at first load it passed Chrome's cap of 16 and the browser evicted
    // the OLDEST context, which is this one. That is fixed at the source. This
    // handler is for everything else that can take a context away — a GPU reset,
    // a driver update, a phone reclaiming memory from a backgrounded tab — none
    // of which this app controls.
    //
    // `preventDefault()` is what makes restoration possible at all; without it
    // the browser will not fire `webglcontextrestored`. Rebuilding the scene
    // graph on restore is a larger piece of work and is NOT done here: what is
    // done is make the failure legible instead of invisible.
    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      console.error('[vivarium] WebGL context lost — the tank will be black until reload.'
        + ' The simulation is still running. See render/thumbnail.js for the cause found at GENOME_V 7.');
    }, false);
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.warn('[vivarium] WebGL context restored. The scene is not rebuilt automatically — reload to redraw.');
    }, false);

    view.append(renderer.domElement);
    const water = createWater(scene, W1_SLICE.palette);
    // Fog in the world's MID stop, so distance reads as depth rather than haze.
    // Near/far are re-solved against the orbit distance every frame.
    scene.fog = new THREE.Fog(water.fogColour, 1, 100);

    const glass = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(...(W1_SLICE.habitatBounds ?? W1_SLICE.tankBounds))),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(token('--forage-glass')), transparent: true,
        opacity: tokenNumber('--forage-glass-opacity'), depthWrite: false,
      }));
    scene.add(glass);

    const ramp = rampFor(W1_SLICE.palette);
    const foodColour = new THREE.Color(token('--forage-food'));
    const ringSelect = new THREE.Color(token('--c-select'));
    const ringStranger = new THREE.Color(token('--c-stranger'));
    const labelDim = new THREE.Color(token('--c-text-dim'));
    const LABEL_SCALE = [0.024, 0.012];
    const GLYPH_SCALE = [0.018, 0.009];

    // ── state ───────────────────────────────────────────────────────────────
    //
    // ONE POPULATION, NOT A CAST AND A POPULATION. This is the merge's central
    // simplification: `genomes` is the lineage (bred, undone, persisted) and the
    // swimming cast is built FROM it. Forage kept a separate cast picked out of
    // the Atlas; that becomes Import, which writes into `genomes`.
    let genomes = [], provenance = [], cast = [];
    let generation = 0;
    let vivariumSeed = 0;
    let previous = null;                 // one-step undo (21 §4.3)
    let selected = new Set();
    let pendingStranger = null;          // { genome, commonName } for the next breed only
    let state = STATE.LOADING;
    let arena = null, food = null, points = null, foodDot = null;
    let elapsed = 0, running = true, stopped = false, ready = false;
    let speed = 1, capped = false, breedingUntil = 0;
    let sheetFor = -1;                   // cast index whose sheet is open, or -1
    const habitat = HABITAT_ID;
    const HABITAT = W1_SLICE.habitatBounds ?? W1_SLICE.tankBounds;

    /** 14 §4's lineage context for naming, refreshed when the Atlas changes. */
    let nameCtx = { lineage: undefined, taken: new Set() };

    const IDLE_FPS = 8;
    let dirty = true, lastDraw = 0;
    const invalidate = () => { dirty = true; };
    let achieved = 0, achWall = 0, achSim = 0;

    function creatureColour(genome) {
      const g = genome.material ?? {};
      return colourFrom(ramp, g.hue ?? 0.5, g.valueShift ?? 0, g.iridescence > 0.82, 1.18);
    }

    // ── the food ────────────────────────────────────────────────────────────
    let foodCap = 0, foodDrawn = 0;
    function buildFood() {
      food = habitat === 'ocean'
        ? makeChunkedFood(W1_SLICE)
        : makeFood(W1_SLICE, { bounds: HABITAT });
      foodCap = Math.max(4096, food.items.length);
      foodDrawn = 0;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(foodCap * 3), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(foodCap * 3), 3));
      foodDot = foodDot ?? dotTexture();
      points = new THREE.Points(geo, new THREE.PointsMaterial({
        size: tokenNumber('--forage-food-size'), sizeAttenuation: false,
        map: foodDot, vertexColors: true, transparent: true, depthWrite: false,
        opacity: tokenNumber('--forage-food-opacity'),
        blending: THREE.AdditiveBlending,
      }));
      scene.add(points);
      paintFood();
    }

    function paintFood() {
      const nItems = food.items.length;
      if (nItems > foodCap) {                      // grow by doubling, then rewrite
        while (foodCap < nItems) foodCap *= 2;
        points.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(foodCap * 3), 3));
        points.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(foodCap * 3), 3));
        foodDrawn = 0;
      }
      const pa = points.geometry.getAttribute('position');
      const a = points.geometry.getAttribute('color');
      // Food never moves: only write positions for what is NEW.
      if (foodDrawn < nItems) {
        for (let q = foodDrawn; q < nItems; q++) {
          const it = food.items[q];
          pa.array[q * 3] = it.x; pa.array[q * 3 + 1] = it.y; pa.array[q * 3 + 2] = it.z;
        }
        foodDrawn = nItems;
        pa.needsUpdate = true;
        points.geometry.setDrawRange(0, nItems);
        points.geometry.computeBoundingSphere();
      }
      const per = food.perItem ?? (food.items[0]?.r ? (W1_SLICE.biomassBudget ?? 300) / 1400 : 1);
      for (let q = 0; q < nItems; q++) {
        const v = Math.min(1, food.items[q].mass / per);
        a.array[q * 3] = foodColour.r * v;
        a.array[q * 3 + 1] = foodColour.g * v;
        a.array[q * 3 + 2] = foodColour.b * v;
      }
      a.needsUpdate = true;
    }

    // ── the cast ────────────────────────────────────────────────────────────
    function clearCast() {
      for (const c of cast) {
        if (c.group) { scene.remove(c.group); disposeCreature(c.group); }
        if (c.mouthMark) {
          scene.remove(c.mouthMark);
          c.mouthMark.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
        }
        if (c.ring) { scene.remove(c.ring); c.ring.geometry.dispose(); c.ring.material.dispose(); }
        if (c.trail) { scene.remove(c.trail); c.trail.geometry.dispose(); c.trail.material.dispose(); }
        if (c.label) { scene.remove(c.label.sprite); disposeLabel(c.label); }
        if (c.glyph) { scene.remove(c.glyph.sprite); disposeLabel(c.glyph); }
        if (c.sim) c.sim.free();
      }
      cast = [];
      rows.replaceChildren();
      if (arena) { arena.free(); arena = null; }
      if (points) { scene.remove(points); points.geometry.dispose(); points.material.dispose(); points = null; }
    }

    /**
     * A 2-COLUMN, 3-ROW PLATE IN THE XY PLANE — the tank's opening arrangement,
     * restored, and portrait-shaped for the same reason it always was: a phone
     * frame is tall, so creatures spread across X and Z land in a thin band with
     * empty water above and below.
     *
     * IT IS A SPAWN LAYOUT, NOT A LAYOUT. This is the one thing that differs
     * from the tank and it matters. There, `layoutGrid` positioned six PRIVATE
     * wrapped arenas in render space, so a creature stayed in its cell forever
     * and the plate was permanent. Here they share one ocean with real
     * positions: the grid is where a generation ARRIVES, and within a minute
     * they have swum out of it. That is intended — the plate is for reading a
     * new generation at a glance, not for holding them still.
     *
     * Spacing follows the largest body in the generation rather than a constant,
     * so a plate of 17-body sprawlers is not overlapped and a plate of eels is
     * not lost in empty water.
     */
    const GRID_COLS = 2, GRID_ROWS = 3;
    function spawnGrid(radii, i) {
      const rMax = radii.length ? Math.max(...radii) : 1;
      const gx = rMax * 2.4, gy = rMax * 2.4;
      // A small per-column depth stagger, exactly as the tank had: with every
      // creature at z = 0 the plate is degenerate the moment you orbit it, and
      // orbiting is the first thing anyone does.
      const gz = rMax * 0.6;
      const c = i % GRID_COLS, r = Math.floor(i / GRID_COLS);
      return [
        (c - (GRID_COLS - 1) / 2) * gx,
        ((GRID_ROWS - 1) / 2 - r) * gy,     // row 0 sits at the top
        (c - (GRID_COLS - 1) / 2) * gz,
      ];
    }

    function spawn() {
      clearCast();
      arena = habitat === 'ocean'
        ? createArena(RAPIER, W1_SLICE, { bounded: false })
        : createArena(RAPIER, W1_SLICE, { bounded: true, bounds: HABITAT });
      glass.visible = habitat !== 'ocean';
      buildFood();

      // MORPHOGENESIS FIRST, FOR EVERY SLOT, BEFORE ANY OF THEM IS PLACED. The
      // grid spaces itself off the largest body in the generation, so it cannot
      // be computed one creature at a time — the first would be placed against a
      // radius the sixth had not contributed to yet. A plan that will not build
      // contributes nothing and its slot is skipped, exactly as before.
      const plans = genomes.map((genome) => {
        try { return morphogenesis(genome); } catch { return null; }
      });
      const radii = plans.filter(Boolean).map((p) => boundingRadius(p));

      genomes.forEach((genome, i) => {
        const plan = plans[i];
        if (!plan) return;              // a body that will not build is a verdict
        let sim;
        try {
          sim = createSimulation(RAPIER, plan, genome, W1_SLICE, {
            arena, wrap: false, origin: spawnGrid(radii, i),
            // GHOSTS. The rivalry that matters here is for the FOOD, which is
            // shared and finite. Contact is also the trigger for the solver
            // tear-apart, so removing it removes a failure mode.
            creatureCollision: false, collisionGroup: i,
          });
        } catch {
          return;                       // a body that will not build is a verdict
        }
        const colour = creatureColour(genome);
        const group = buildCreature(plan, genome, { worldId: W1_SLICE.palette });
        scene.add(group);

        const mouthMark = new THREE.Group();
        mouthMark.add(
          new THREE.Mesh(
            new THREE.SphereGeometry(food.radius, 14, 10),
            new THREE.MeshBasicMaterial({
              color: colour.clone(), transparent: true, side: THREE.BackSide,
              opacity: tokenNumber('--forage-mouth-opacity'),
              depthWrite: false, blending: THREE.AdditiveBlending,
            })),
          new THREE.Mesh(
            new THREE.SphereGeometry(tokenNumber('--forage-mouth-dot'), 10, 8),
            new THREE.MeshBasicMaterial({ color: colour.clone(), depthWrite: false })),
        );
        scene.add(mouthMark);

        // SELECTION OWNS RINGS. Size-invariant (see selectRadius): forage's rule
        // beats the tank's size-proportional ring, because in a shared ocean a
        // long-tentacled creature's ring covered its neighbours.
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.92, 1.0, 48),
          new THREE.MeshBasicMaterial({
            color: ringSelect.clone(), transparent: true, opacity: 0.95,
            side: THREE.DoubleSide, depthTest: false, toneMapped: false,
          }));
        ring.visible = false;
        ring.renderOrder = 10;
        scene.add(ring);

        // 21 §4.5 — one number, always visible: SPEED. Not a score, not fitness.
        const label = makeLabel();
        label.sprite.scale.set(LABEL_SCALE[0], LABEL_SCALE[1], 1);
        scene.add(label.sprite);

        // PROVENANCE OWNS GLYPHS. A small fixed-size mark above the body,
        // reusing the same sprite machinery — it cannot be mistaken for the
        // selection ring because it is not a ring.
        const glyph = makeLabel();
        glyph.sprite.scale.set(GLYPH_SCALE[0], GLYPH_SCALE[1], 1);
        glyph.mat.color.copy(ringStranger);
        glyph.sprite.visible = false;
        drawLabel(glyph, STRANGER_GLYPH);
        scene.add(glyph.sprite);

        const trailPos = new Float32Array(TRAIL_START * 3);
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
        tg.setDrawRange(0, 0);
        const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({
          color: colour.clone(), transparent: true,
          opacity: tokenNumber('--forage-trail-opacity'), depthWrite: false,
        }));
        scene.add(trail);

        // Phase-locked emissive: a luminous creature's glow becomes a READOUT of
        // its gait. Assembled from the sim's own exposed state so /engine is
        // untouched; the root body has no feeding joint and returns phase 0.
        const jointOfBody = new Int32Array(plan.bodyCount).fill(-1);
        for (const j of plan.joints) jointOfBody[j.childBody] = j.index;
        const phaseFor = (bodyIndex) => {
          const ji = jointOfBody[bodyIndex];
          if (ji < 0) return 0;
          const jt = plan.joints[ji];
          const gj = genome.controller.jointGenes[jt.nodeId];
          return gj.freqMult * (genome.controller.omega * sim.control.effort) * sim.t + sim.phases[ji];
        };

        const mouths = mouthsOf(plan);
        const row = mk('forage-row', rows);
        mk('forage-swatch', row).style.background = `#${colour.getHexString()}`;
        const text = mk('forage-text', row);
        // The row answers the SAME gesture as the creature it names.
        bindSelect(row, () => cast.findIndex((x) => x.row === row));

        cast.push({
          i, genome, plan, sim, group, mouthMark, trail, ring, label, glyph, colour, phaseFor,
          trailPos, trailN: 0, trailAt: 0, trailCap: TRAIL_START,
          mouths, mouthBuf: mouths.map(() => [0, 0, 0]),
          pose: null, eaten: 0, burst: false, speed: 0,
          mass: totalMass(plan), radius: boundingRadius(plan),
          world: new THREE.Vector3(),
          row, text,
        });
      });

      // POSE ONCE, BEFORE THE FIRST STEP. Otherwise a cast spawned into a paused
      // screen leaves every `c.world` at the origin, which is where the ray-pick
      // would look for six overlapping creatures.
      for (const c of cast) {
        syncPose(c);
        const pts = mouthPoints(c.sim, c.plan, c.mouths, c.mouthBuf);
        if (pts[0]) c.mouthMark.position.set(pts[0][0], pts[0][1], pts[0][2]);
      }
      elapsed = 0;
      sheetFor = -1;
      panOffset.set(0, 0, 0);
      // Frame the plate BEFORE the first draw, or the opening frame is the old
      // constant distance and snaps a moment later.
      fitCast();
      placeCamera();
      applyLayers();
      // In the ocean the atmosphere has no box to fill, so it is sized generously
      // and re-centred on the camera each frame (see followCast).
      fitAtmosphere(water, habitat === 'ocean' ? HABITAT.map((b) => b * 2) : HABITAT);
      // BEFORE paint(), which prints the names. Naming is pure and synchronous —
      // the only async part of it is `nameCtx`, which is loaded once at boot and
      // refreshed when the Atlas changes.
      nameCast();
      paint();
    }

    // ── readout ─────────────────────────────────────────────────────────────
    const fmtTime = (s) => (s < 60 ? `${s.toFixed(0)}s` : `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`);
    /**
     * Plain multiples, never scientific.
     *
     * THE `99+x` CEILING IS GONE. It was there on the reasoning that "above 100x
     * the exact figure is noise", which is true of PRECISION and false of
     * MAGNITUDE: Drifter measures 93.7x and the teal snarlback 87.8x, so the whole
     * interesting top of the range was being flattened into one label, and two
     * animals that differ by a factor of five looked identical.
     *
     * It also hid the thing the ledger most needs a reader to see. ROADMAP §5b's
     * first `_zselect` lesson is "never select on the ratio — it is a margin, won
     * by not spending, and the cheapest way not to spend is not to move." Drifter
     * has the best margin in the corpus and eats a third of what the snarlback
     * does. You cannot notice that if everything good reads `99+`.
     *
     * So: significant figures shrink as the number grows, and nothing is capped.
     */
    const fmtRatio = (r) => {
      if (!Number.isFinite(r)) return '∞';
      if (r === 0) return t('starving');
      if (r < 10) return `${r.toFixed(1)}×`;
      if (r < 1000) return `${r.toFixed(0)}×`;
      if (r < 10000) return `${(r / 1000).toFixed(1)}k×`;
      return `${Math.round(r / 1000)}k×`;
    };
    /** Energies are the one place scientific notation is honest — they span e6. */
    const erg = (v) => (v >= 1e5 || (v > 0 && v < 0.01) ? v.toExponential(2) : v.toFixed(2));

    /**
     * The one status function. Everything the chrome says, said in one place.
     *
     * Merged from forage's `paint()` and tank's `renderStatus()`, which between
     * them wrote the same three chips from two files.
     */
    function paint(droppedElite) {
      invalidate();
      const busy = state === STATE.BURSTING;

      genEl.textContent = ready ? `${t('Generation')} ${generation}` : t('Loading…');
      const bodies = cast.reduce((a, c) => a + c.plan.bodyCount, 0);
      worldEl.innerHTML = `${W1_SLICE.name} · <span class="num">${bodies}</span> ${t('bodies')}`
        + ` · ${fmtTime(elapsed)}`;

      if (food) {
        if (food.unbounded) {
          // "% GRAZED" IS MEANINGLESS AGAINST AN INFINITE FIELD and is not faked.
          const vol = food.chunkCount() * food.chunk ** 3;
          const rel = vol > 0 ? (food.items.length / vol) / FOOD_DENSITY : 1;
          foodEl.textContent = `${food.eatenMass().toFixed(1)} g ${t('taken')}`
            + ` · ${t('density')} ${rel.toFixed(2)}×`;
        } else {
          const pct = food.items.length ? (100 * food.eatenCount()) / food.items.length : 0;
          foodEl.textContent = `${t('Food')} ${food.remaining().toFixed(0)} g ${t('of')} ${food.initialTotal.toFixed(0)}`
            + ` · ${pct.toFixed(0)}% ${t('grazed')}`;
        }
      }

      selEl.innerHTML = `<span class="num">${selected.size}</span> ${t('of')} <span class="num">${POPULATION}</span> ${t('selected')}`;
      const strangers = generation > 0
        ? provenance.map((p, i) => (p?.kind === KIND.STRANGER ? i : -1)).filter((i) => i >= 0)
        : [];
      strangersEl.hidden = strangers.length === 0;
      strangersEl.innerHTML = strangers.length === 1
        ? `${t('Slot')} <span class="num">${strangers[0] + 1}</span> ${t('unrelated')}`
        : `<span class="num">${strangers.length}</span> ${t('unrelated')}`;

      // WHAT THE NEXT BREED WILL ACTUALLY PRODUCE, before the player commits to
      // it. Selecting three creatures does not make three-parent children, it
      // makes FEWER children — the selected keep their own slots — and each of
      // the ones it does make mixes two of the three. The five-selected dead end
      // was invisible until you tapped Breed and nothing new appeared. Derived
      // from the same two rules breed() uses, so it cannot drift from them.
      const strangerSlots = strangerCount(POPULATION);
      const elites = Math.min(selected.size, POPULATION - strangerSlots);
      const kids = POPULATION - elites - strangerSlots;
      const kidsLabel = selected.size === 1
        ? (kids === 1 ? t('child of it') : t('children of it'))
        : (kids === 1 ? t('child, mixing two of them') : t('children, each mixing two of them'));
      mixEl.hidden = selected.size === 0;
      mixEl.innerHTML = kids === 0
        ? t('no room for children — deselect one')
        : `<span class="num">${kids}</span> ${kidsLabel}`;

      for (const c of cast) {
        // THE SAME ARGUMENTS THE DETAIL SHEET USES. `braking` is optional and
        // defaults to zero, so omitting it here would have understated spend on
        // this row only — two different ratios for one creature, differing by up
        // to 28%, depending on which part of the screen you read.
        const L = ledger(W1_SLICE, c.mass, c.eaten, c.sim.workOut, elapsed,
                         null, c.sim.workEccentric);
        const k = cast.indexOf(c);
        c.text.textContent = c.burst
          ? `${c.name}  ${c.eaten.toFixed(2)} g  ${t('came apart')}`
          : `${c.name}  ${c.eaten.toFixed(2)} g  ${fmtRatio(L.ratio)}`;
        c.row.dataset.state = c.burst ? 'burst'
          : Number.isFinite(L.ratio) && L.ratio >= 1 ? 'surplus' : 'deficit';
        c.row.dataset.picked = selected.has(k) ? 'yes' : 'no';
      }

      btnPause.textContent = running ? t('Pause') : t('Play');
      btnPause.disabled = busy;
      // When the frame budget cannot deliver the setting, the chip stops claiming
      // it and reports what is actually happening instead.
      btnSpeed.textContent = capped && achieved > 0
        ? `${achieved < 10 ? achieved.toFixed(1) : achieved.toFixed(0)}×`
        : `${speed}×`;
      btnSpeed.dataset.on = capped ? 'no' : 'yes';
      btnSpeed.disabled = !running || busy;
      btnUndo.disabled = !previous || busy;
      if (!busy) btnBurst.textContent = t('Burst');
      btnBurst.disabled = !ready || busy;
      btnImport.disabled = !ready || busy;
      btnStranger.textContent = pendingStranger ? pendingStranger.commonName : t('Stranger');
      btnStranger.classList.toggle('picked', Boolean(pendingStranger));
      btnStranger.disabled = !ready || busy;

      primary.disabled = !ready || selected.size === 0 || busy || state === STATE.BREEDING;
      primary.textContent = selected.size
        ? `${t('Breed')} ${selected.size} ${t('selected')}`
        : t('Breed');
      if (droppedElite) coach.hidden = true;
    }

    // ── the specimen sheet ──────────────────────────────────────────────────
    //
    // ONE SHEET, merged. Forage's ledger rows and tank's keep-this-creature
    // block were two sheets over two views of the same animal. 14 §9: the
    // vernacular is the heading and the binomial is the italic line under it —
    // this is the screen the player points at things from, so it speaks
    // vernacular, and the Latin has room here that it does not have on a row.
    function closeSheet() {
      sheet.hidden = true;
      sheet.replaceChildren();
      sheetFor = -1;
      if (state === STATE.SHEET_OPEN) state = STATE.SIMULATING;
      paint();
    }

    function openSheet(idx) {
      const c = cast[idx];
      if (!c) return;
      sheetFor = idx;
      state = STATE.SHEET_OPEN;
      sheet.hidden = false;
      sheet.replaceChildren();

      const head = mk('spec-picker-title', sheet);
      head.textContent = c.name;
      head.style.color = `#${c.colour.getHexString()}`;
      mk('spec-binomial', sheet).textContent = c.binomial;

      // 1'.6 — THE LEDGER IS THE SELECTION INTERFACE NOW. Selection is manual
      // until L3, so every quantity the ledger knows has to be on this sheet;
      // anything it computes and does not show is a number nobody can act on.
      const tissue = creatureTissue(c.plan);
      const L = ledger(W1_SLICE, c.mass, c.eaten, c.sim.workOut, elapsed,
                       tissue, c.sim.workEccentric);
      const R = reserveAfter(W1_SLICE, c.mass, L.balance);
      const v = c.sim.centreOfMass();
      const p = provenance[idx] ?? { kind: KIND.STRANGER };
      const origin = c.genome?.origin;
      const out = [
        [t('Bodies'), `${c.plan.bodyCount}${c.plan.truncated ? t(' (capped)') : ''} · ${c.plan.jointCount} ${t('joints')}`],
        // CGS (01 §7): engine units ARE cm / g / s. Relabels, not conversions.
        [t('Mass'), `${c.mass.toFixed(2)} g`],
        [t('Radius'), `${c.radius.toFixed(2)} cm`],
        [t('Speed'), `${c.speed.toFixed(2)} cm/s`],
        [t('Mouths'), `${c.mouths.length}`],
        [t('Eaten'), `${c.eaten.toFixed(3)} g`],
        [t('Energy in'), `${erg(L.intake)} erg`],
        // A0 — the BILLED half, so this row and 'Balance' agree.
        [t('Work done'), `${erg(c.sim.workOut)} erg`],
        [t('Basal cost'), `${erg(L.basal)} erg`],
        // 1'.4 — active braking. Was free until 2026-08-09 and runs 3-28% of
        // spend, so it belongs beside the other two costs rather than inside them.
        [t('Braking cost'), `${erg(L.braking)} erg`],
        [t('Balance'), `${erg(L.balance)} erg · ${fmtRatio(L.ratio)}`],
        // ROADMAP §5b's FOURTH _zselect LESSON, on screen instead of in a comment:
        // absolute balance runs +0.50 with mass and balance/mass runs -0.86, so
        // the two crown different animals and neither is "the" answer. Showing
        // both, labelled, is the only honest way to hand this to a human — the
        // first crowns a 37 g animal with the worst net energy per gram measured,
        // the second crowns a 0.30 g filament.
        [t('Per gram'), `${erg(L.balance / Math.max(c.mass, 1e-9))} erg/g`],
        // 1'.5 — satiety. Normalised between starvation and the reproduction
        // threshold, which is the form Phase 4 will feed to the network.
        [t('Reserve'), `${R.reserve.toFixed(2)} g · ${t('satiety')} ${R.satiety.toFixed(2)}`
          + (R.starving ? t(' · STARVING') : R.canReproduce ? t(' · can breed') : '')],
        // 1'.2 — the diffusion limit. Oxygen reaches ~1 mm into unperfused tissue,
        // so anything deeper is mass that must be dragged and cannot contract.
        // Reported, NOT charged: the circulation coefficient it would need has no
        // measurable source. Median creature measures 0.47.
        [t('Dead tissue'), `${(100 * tissue.deadFraction).toFixed(0)}%`
          + ` · ${t('thinnest')} ${tissue.thinnestHalfThickness.toFixed(2)} cm`],
        // ── SENSES — and the two halves are reported SEPARATELY on purpose ────
        //
        // A receptor and the gain behind it are different genes, mutated by
        // different operators, and a lineage acquires them in either order. The
        // interesting intermediate — an organ with no wiring — is a real state
        // that `protea` is sitting in right now, and collapsing this to one
        // "can it smell" line would hide the very transition Phase 2 exists to
        // watch. So: how many eyes, and whether anything is listening.
        [t('Senses'), c.plan.receptors?.length
          ? `${c.plan.receptors.length} ${t('receptors')} · ${t('gain')} ${(c.genome.controller.chemoGain ?? 0).toFixed(2)}`
            + (Math.abs(c.genome.controller.chemoGain ?? 0) < 0.01 ? ` · ${t('UNWIRED')}` : '')
          : t('blind — no receptors')],
        [t('Depth'), `${v[1].toFixed(1)} cm`],
        // A RECOMBINANT NAMES ITS PARENTS BY SLOT, and the slots are live: N18
        // keeps every selected creature in its own slot, so "mix of 1 + 4"
        // points at two creatures still on screen.
        [t('Origin'), t(p.kind ?? KIND.STRANGER)
          // NOT `t('from')`: V2's import scan matches `from` followed by a quote
          // anywhere in the file, template literals included.
          + (p.parents?.length > 1 ? ` · ${t('mix of')} ${p.parents.map((i) => i + 1).join(' + ')}` : '')
          + (p.grafted > 0 ? t(' · grafted limb') : '')
          + (p.imported ? t(' · imported') : '')
          + (p.viable === false ? t(' · unviable, search exhausted') : '')],
        // ── 1'.0 — AUTHORED ANCESTRY, AND THIS IS THE ROW IT WAS BUILT FOR ────
        //
        // `Origin` above is per-BREED-CALL: it says how this creature reached
        // this slot, and it forgets everything one generation later. This row is
        // per-LINEAGE. Two of the six opening slots are hand-written eels, so
        // without it "evolution improved these" and "evolution DISCOVERED this"
        // look identical on screen — and only the first is a claim any run here
        // currently supports.
        //
        // A reference is not a lesser creature; it is a creature whose competence
        // was designed rather than earned, and a player choosing breeding stock is
        // entitled to know which they are looking at.
        [t('Ancestry'), origin?.founder
          ? `${t('reference')} · ${origin.founder} · ${origin.generations} ${t('gen')}`
          : t('evolved — no authored ancestor')],
      ];
      for (const [k, val] of out) {
        const r = mk('row', sheet);
        mk('row-l', r, 'span').textContent = k;
        mk('row-v', r, 'span').textContent = val;
      }

      // ── keep this creature ────────────────────────────────────────────────
      const save = mk('spec-save', sheet);
      const nameInput = mk('field spec-name', save, 'input');
      nameInput.type = 'text';
      nameInput.value = c.name;
      nameInput.setAttribute('aria-label', t('Creature name'));

      const saveBtn = button(t('Save creature'), async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = t('Saving…');
        try {
          const hash = genomeHash(c.genome);
          await store.set(store.KEY.specimen(hash), {
            genome: c.genome,
            hash,
            worldId: W1_SLICE.palette,
            binomial: c.binomial,
            // MINTED ONCE, stored with the record. 14 §4 scores slots against the
            // lineage, so recomputing later would rename a creature as its
            // neighbours changed. See ui/vernacular.js.
            vernacular: c.vernacular,
            commonName: nameInput.value.trim() || c.name,
            thumb: renderThumbnail(c.genome, { worldId: W1_SLICE.palette }),
            stats: { bodies: c.plan.bodyCount, mass: totalMass(c.plan) },
            createdAt: Date.now(),
            render: RENDER_TAG,
            // ── SAY SO, RATHER THAN BE INFERRED FROM AN ABSENCE ──────────────
            //
            // `seedAtlas` decides what it may delete by testing
            // `source !== 'authored'`, so until now a player's creature was
            // protected by a field it did NOT have. That is a dangerous way to
            // own something: any future code that defaults `source` — a
            // migration, a normaliser, a copy through a helper — would have
            // silently made every bred creature deletable.
            //
            // Records written before this still carry no `source`, and the
            // guards continue to treat missing as player for exactly that
            // reason. New ones are explicit.
            source: 'player',
          });
          saveBtn.textContent = t('Saved ✓');
          nameCtx = await atlasContext();     // the Atlas grew; renaming follows it
        } catch {
          saveBtn.disabled = false;
          saveBtn.textContent = t('Save failed — retry');
        }
      });
      save.append(saveBtn);
      sheet.append(button(t('Close'), closeSheet));
      paint();
    }

    // ── Atlas import ────────────────────────────────────────────────────────
    //
    // Forage's `Cast` picker, promoted out of the chip row and given the Atlas's
    // own CARDS instead of a list of thumbnails-and-names. It is the same card
    // component the Atlas grid uses (ui/cards.js), so a creature you recognise
    // in one place is the creature you recognise in the other.
    //
    // IMPORTING DOES NOT RESET THE LINEAGE. `generation` counts breeds, and
    // dropping creatures into the vivarium is not a breed. Each import is marked
    // `{ kind: STRANGER, imported: true }`, which the sheet already knows how to
    // say and which the stranger glyph already knows how to draw.
    async function openImport() {
      if (!ready) return;
      state = STATE.SHEET_OPEN;
      sheet.hidden = false;
      sheet.replaceChildren();
      mk('spec-picker-title', sheet).textContent = `${t('Import up to')} ${POPULATION} ${t('from the Atlas')}`;

      let specs = [];
      try {
        const keys = await store.list('specimen:');
        for (const key of keys) {
          try { const s = await store.get(key); if (s?.genome) specs.push({ key, ...s }); }
          catch { /* skip a record from a future build */ }
        }
      } catch { /* no store — the empty branch below says so */ }
      if (sheet.hidden) return;             // closed while the list was loading
      specs.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

      const chosen = new Set();
      const go = button('', () => {
        const picks = specs.filter((s) => chosen.has(s.key));
        closeSheet();
        if (picks.length) importSpecimens(picks);
      });
      const label = () => { go.textContent = `${t('Release')} ${chosen.size}`; go.disabled = chosen.size === 0; };

      if (!specs.length) {
        mk('spec-empty', sheet, 'p').textContent =
          t('No saved creatures yet. Long-press a creature and tap Save to keep one.');
      } else {
        const grid = mk('spec-grid spec-grid-sheet', sheet);
        for (const s of specs) {
          grid.append(specCard(s, {
            selectable: true, stats: false,
            onToggle: (next) => {
              // The CALLER decides whether the toggle takes: the cap is real, and
              // a card that ticked itself and was then refused would be lying.
              if (next && chosen.size >= POPULATION) return false;
              if (next) chosen.add(s.key); else chosen.delete(s.key);
              label();
              return true;
            },
          }));
        }
      }
      label();
      sheet.append(go, button(t('Cancel'), closeSheet));
    }

    function importSpecimens(picks) {
      previous = snapshot();
      const next = genomes.slice();
      const prov = provenance.slice();
      picks.slice(0, POPULATION).forEach((s, k) => {
        next[k] = s.genome;
        prov[k] = { kind: KIND.STRANGER, imported: true };
      });
      genomes = next;
      provenance = prov;
      // A slot whose occupant was replaced is no longer the creature that was
      // selected, so the selection cannot survive on it.
      selected = new Set([...selected].filter((i) => i >= picks.length));
      coach.hidden = true;
      spawn();
      paint();
      persistLineage();
    }

    // ── the stranger picker ─────────────────────────────────────────────────
    async function openStrangerPicker() {
      if (!ready) return;
      state = STATE.SHEET_OPEN;
      sheet.hidden = false;
      sheet.replaceChildren();
      mk('spec-picker-title', sheet).textContent = t('Choose a stranger for the next breed');
      sheet.append(button(t('Random (default)'), () => { pendingStranger = null; closeSheet(); }));

      let keys = [];
      try { keys = await store.list('specimen:'); } catch { keys = []; }
      if (sheet.hidden) return;

      if (!keys.length) {
        mk('spec-empty', sheet, 'p').textContent =
          t('No saved creatures yet. Long-press a creature and tap Save to keep one.');
      } else {
        const list = mk('spec-picker-list', sheet);
        for (const key of keys) {
          let spec;
          try { spec = await store.get(key); } catch { continue; }
          if (!spec?.genome) continue;
          const label = labelFor(spec);
          const item = mk('spec-picker-item', list, 'button');
          item.type = 'button';
          const img = mk('spec-picker-thumb', item, 'img');
          img.alt = '';
          if (spec.thumb) img.src = spec.thumb;
          mk('spec-picker-name', item, 'span').textContent = label;
          item.addEventListener('click', () => {
            pendingStranger = { genome: spec.genome, commonName: label };
            closeSheet();
          });
        }
      }
      sheet.append(button(t('Close'), closeSheet));
    }

    // ── controls ────────────────────────────────────────────────────────────
    //
    // LAYERS live in an overflow menu now. Both are evidence and both get in the
    // way of the other: 1400 food dots hide the trails, and six never-forgetting
    // trails eventually hide the food they were drawn on. They stay ON by
    // default — the screen exists to show foraging — and neither is touched
    // often enough to earn a permanent chip beside Breed.
    // FOOD OFF BY DEFAULT. 1400 particles over a six-creature tank read as noise
    // rather than as a field: they hide the animals, which are the thing the screen
    // is for, and the ledger now reports what was eaten far more precisely than
    // counting specks ever could. Still one tap away in the layers menu, because
    // watching a patch get stripped is worth seeing on purpose.
    const show = { trails: true, food: false };

    /**
     * ── THE BEACON. Long-press open water to drop it. ────────────────────────
     *
     * `at` is a world point; `on` gates the steering drive in the tick loop.
     * Long-press on a CREATURE still opens its sheet — the gesture is only free
     * over water, which vivarium.js's own pointerdown handler already guarantees
     * ("a finger resting on open water must not throw up a sheet").
     */
    const beacon = { on: false, at: [0, 0, 0] };
    const beaconMark = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95 }),
    );
    beaconMark.visible = false;
    scene.add(beaconMark);
    // A soft halo, so a 0.35 cm dot is findable in a 32 cm tank without making
    // the marker itself big enough to hide the creature that reaches it.
    const beaconHalo = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.13, depthWrite: false }),
    );
    beaconHalo.visible = false;
    scene.add(beaconHalo);

    /**
     * ── EVERY CREATURE'S OWN STEERING PLANE, MEASURED ON DEMAND ──────────────
     *
     * THE BEACON DOES NOT WORK WITHOUT THIS, and it fails silently, which is why
     * it is worth the two seconds. `bearingTo` takes a plane; hand it `null` and
     * it falls back to the horizontal, and B2 §5 plus SESSION-10 §85 both record
     * that these creatures DO NOT TURN IN THE HORIZONTAL — a chain bends about its
     * limbs' local X and turns in pitch.
     *
     * Measured, `eel-unison` chasing a target 6 cm to the side for 120 s:
     *
     *     its own plane (-1, 0, 0)   6.32 cm -> closest 1.00   HOMES
     *     horizontal fallback        6.32 cm -> closest 6.30   does nothing
     *     no beacon at all           6.32 cm -> closest 6.31
     *
     * The horizontal arm is indistinguishable from having no beacon. A first
     * version of this feature shipped exactly that: the marker rendered, the
     * gesture fired, the loop ran, and not one creature could have responded.
     *
     * ~2 s of wall clock for six creatures (two 8 s probe runs each, headless and
     * far faster than real time), paid once when the beacon is first placed
     * rather than at every spawn.
     */
    function measureTurnPlanes() {
      for (const c of cast) {
        if (c.turnPlane || c.burst) continue;
        try {
          const r = S3(RAPIER, {
            plan: c.plan, genome: c.genome, world: W1_SLICE,
            gravity: SOLO_GRAVITY, bounded: SOLO_BOUNDED,
            cruiseSpeed: Math.max(0.05, c.speed || 0.3),
            // ── ONE BIAS POINT. THE SWEEP BELONGS TO THE COMPILE, NOT THE TAP ──
            //
            // `S3` gained a five-point bias sweep at BRIDGE_V 8, and this call
            // site inherited it silently: placing a beacon went from 2 runs of
            // 8 s per creature to TEN, synchronously, on the main thread. Six
            // creatures is 480 s of simulation where it used to be 96, and the
            // screen froze for seconds on a tap that had been instant.
            //
            // It bought nothing. All this needs is the steering PLANE, and the
            // plane is derived from the full-bias point whatever else is swept
            // (see the note in probes.js) — so the other four points were
            // computed and discarded. The capability numbers the sweep exists
            // for belong to `compileSolo`, which is budgeted for them.
            biases: [S3_BIAS],
          });
          // A creature with no measurable plane keeps `null` and gets the
          // horizontal — which for it is as good as anything, because a zero
          // steering authority is exactly what "no measurable plane" means.
          c.turnPlane = r.valid ? [r.turnPlaneX, r.turnPlaneY, r.turnPlaneZ] : null;
        } catch { c.turnPlane = null; }
      }
    }

    function setBeacon(p) {
      if (!p) {
        beacon.on = false;
        beaconMark.visible = beaconHalo.visible = false;
        // HAND STEERING BACK. Leaving the last bias latched would make every
        // creature curl forever after the beacon was cleared, and it would look
        // like the beacon had permanently broken them.
        for (const c of cast) { c.sim.control.turnBias = 0; c.sim.control.turnBias2 = 0; }
      } else {
        // BEFORE the beacon goes live, not after: a creature steered on the wrong
        // plane for even one frame is a creature steered the wrong way.
        measureTurnPlanes();
        beacon.on = true;
        beacon.at = [p.x, p.y, p.z];
        beaconMark.position.copy(p);
        beaconHalo.position.copy(p);
        beaconMark.visible = beaconHalo.visible = true;
      }
      invalidate();
      paint();
    }

    /**
     * Screen point to a world point, on the plane through the tank centre that
     * faces the camera. A tap has no depth, so one has to be chosen; the camera
     * -facing plane through the middle of the water is the one where "where I
     * pointed" and "where it went" agree from the current view.
     */
    function waterPoint(cx, cy) {
      const r = view.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const n = new THREE.Vector3();
      camera.getWorldDirection(n);
      // THE PLANE THROUGH THE CAMERA'S OWN LOOK-AT POINT — `placeCamera` aims at
      // (pan.x, pan.y + baseTargetY, pan.z), which is the middle of the plate of
      // creatures. Any other depth and the beacon would land visually where the
      // player tapped but physically somewhere in front of or behind the animals.
      const focus = new THREE.Vector3(pan.x, pan.y + baseTargetY, pan.z);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, focus);
      const hit = new THREE.Vector3();
      return raycaster.ray.intersectPlane(plane, hit) ? hit : null;
    }
    function applyLayers() {
      invalidate();
      if (points) points.visible = show.food;
      for (const c of cast) c.trail.visible = show.trails;
    }

    const btnPause = chip(t('Pause'), () => { running = !running; paint(); });
    const btnSpeed = chip(`${speed}×`, () => {
      speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
      capped = false;
      paint();
    }, 'speed');
    const btnReset = chip(t('Reset'), () => { pan.set(0, 0, 0); spawn(); });
    /**
     * ── A FRESH RANDOM DRAW OF ALL SIX ────────────────────────────────────────
     *
     * `Reset` re-spawns the SAME six creatures — it is a camera and physics
     * reset, not a new population. Past the first few generations the only route
     * to an unrelated animal was the one stranger slot per breed, which means a
     * lineage that has converged can only be escaped one sixth at a time, over
     * many generations. There was no way to simply start again.
     *
     * `authoredSlots: 0` — no eels. `Reset`'s cast keeps whatever it had; this is
     * the button for "show me what the GENERATOR makes", and two hand-built
     * swimmers in the middle of that answer a different question. It is also the
     * honest draw for judging morphology: the opening tank is deliberately seeded
     * 2-of-6 authored because six random creatures through an honest actuator
     * barely move, and that is exactly the fact this button exposes.
     *
     * A NEW SEED EACH TIME, so pressing it twice gives two different draws rather
     * than the same one — `freshVivariumSeed` is already the project's way of
     * saying "a genuinely new world".
     */
    const btnDraw = chip(t('New draw'), () => {
      const seeded = seedPopulation({
        RAPIER, rng: rngFrom('tank', freshVivariumSeed(), 'redraw'),
        world: W1_SLICE, authoredSlots: 0,
      });
      genomes = seeded.genomes;
      provenance = seeded.provenance;
      generation = 0;
      selected = new Set();
      previous = null;
      setBeacon(null);
      spawn();
      persistLineage();
      paint();
    });
    const btnUndo = chip(t('Undo'), doUndo);
    const btnBurst = chip(t('Burst'), openBurstSheet, 'burst');
    const btnStranger = chip(t('Stranger'), openStrangerPicker, 'stranger');
    const btnImport = chip(t('Import'), openImport);
    const btnMore = chip('☰', () => openMenu(btnMore, [
      {
        label: t('Food'), on: show.food, keepOpen: true,
        state: () => show.food,
        onSelect: () => { show.food = !show.food; applyLayers(); },
      },
      {
        label: t('Trails'), on: show.trails, keepOpen: true,
        state: () => show.trails,
        onSelect: () => { show.trails = !show.trails; applyLayers(); },
      },
    ]));
    btnMore.setAttribute('aria-haspopup', 'menu');
    btnMore.setAttribute('aria-label', t('More'));

    cluster.append(btnPause, btnSpeed, btnReset, btnDraw);
    tools.append(btnStranger, btnImport, btnMore);
    // Undo and Burst flank Breed: all three CHANGE THE POPULATION, which is a
    // different kind of act from the transport pill above.
    primaryRow.prepend(btnUndo);
    primaryRow.append(btnBurst);
    primary.addEventListener('click', doBreed);

    // ── breeding ────────────────────────────────────────────────────────────
    const snapshot = () => ({ genomes, provenance, generation, selected: [...selected] });

    function doUndo() {
      if (!previous) return;
      ({ genomes, provenance, generation } = previous);
      selected = new Set(previous.selected);
      previous = null;
      spawn();
      paint();
      persistLineage();
    }

    function doBreed() {
      if (!ready || selected.size === 0 || state === STATE.BREEDING || state === STATE.BURSTING) return;
      coach.hidden = true;
      previous = snapshot();               // one-step undo, kept BEFORE the breed

      const r = breed({
        RAPIER, genomes,
        selected: [...selected],
        // H7 — every stream hangs off this lineage's own seed, so two players
        // making the same selections get different offspring. Determinism is
        // preserved WITHIN a lineage.
        // THE STREAM LABEL STAYS `'tank'` THOUGH THE SCREEN NO LONGER IS. It is
        // an rng namespace, and renaming it would re-roll every existing
        // lineage: the same seed and the same selections would stop producing
        // the same offspring, which is precisely the determinism H7 exists to
        // give. A cosmetic rename is not worth breaking a player's replay.
        rng: rngFrom('tank', vivariumSeed, 'breed', generation),
        world: W1_SLICE,
        injectStrangers: pendingStranger ? [pendingStranger.genome] : [],
      });
      genomes = r.genomes;
      provenance = r.provenance;
      generation++;
      pendingStranger = null;              // the import is spent
      // Elites keep their slot and stay selected, so repeat-breeding one lineage
      // is one tap.
      selected = new Set(r.provenance
        .map((p, i) => (p.kind === KIND.ELITE ? i : -1)).filter((i) => i >= 0));

      // 21 §4.4: the BREEDING beat is not decoration — without a visible
      // transition the player cannot tell whether anything happened.
      state = STATE.BREEDING;
      view.dataset.breeding = 'yes';
      breedingUntil = performance.now() + BREEDING_MS;
      spawn();
      paint(r.droppedElite);
      persistLineage();
    }

    /**
     * The burst sheet — states what is about to happen, then offers the objective.
     *
     * A burst spends twenty seconds and rewrites most of the vivarium. Naming the
     * pins, the round count and the measured quantity turns it from a slot
     * machine into an instruction.
     */
    function openBurstSheet() {
      if (!ready || state === STATE.BURSTING) return;
      state = STATE.SHEET_OPEN;
      sheet.hidden = false;
      sheet.replaceChildren();

      const pinned = selected.size;
      mk('spec-picker-title', sheet).textContent = !pinned
        ? t('Burst — breeds the whole vivarium')
        : pinned === 1
          ? t('Burst — keeps your pick and breeds from it')
          : `${t('Burst — keeps your')} ${pinned} ${t('picks and breeds from them')}`;
      mk('spec-empty', sheet, 'p').textContent = pinned
        ? t('Your picks come back unchanged, in their own slots. The free slots fill with the best of their descendants.')
        : t('Nothing is selected, so nothing is protected — every slot may be replaced. Select creatures first to keep them.');
      mk('spec-picker-title', sheet).textContent = t('Keep the offspring that score best on:');

      for (const o of OBJECTIVES) {
        const rounds = o.adapt ? BURST.physicsRounds : BURST.freeRounds;
        sheet.append(button(`${t(o.label)} — ${rounds} ${t('rounds')}`, () => { closeSheet(); runBurst(o); }));
        // A VISIBLE line, not a title attribute: this is a phone-first screen and
        // a tooltip needs a hover that will never happen.
        mk('spec-empty', sheet, 'p').textContent =
          o.adapt ? `${t(o.note)} · ${t('simulated, about 20 s')}` : t(o.note);
      }
      sheet.append(button(t('Close'), closeSheet));
    }

    let burstObjective = OBJECTIVES[0];

    function runBurst(objective) {
      if (!ready || state === STATE.BREEDING || state === STATE.BURSTING) return;
      burstObjective = objective ?? burstObjective;
      const obj = burstObjective;
      coach.hidden = true;
      previous = snapshot();
      state = STATE.BURSTING;
      view.dataset.breeding = 'yes';
      paint();

      // `selected` is a Set and its iteration order is the order the player
      // TAPPED, which would make an identical selection behave differently
      // depending on how it was made. Sorted, so a burst is a function of WHAT is
      // selected, not of how.
      const pinned = [...selected].sort((a, b) => a - b);
      const rounds = obj.adapt ? BURST.physicsRounds : BURST.freeRounds;
      const rng = rngFrom('tank', vivariumSeed, 'burst', generation);
      const repaint = () => new Promise((r) => {
        let fired = false; const go = () => { if (!fired) { fired = true; r(); } };
        requestAnimationFrame(go); setTimeout(go, 50);
      });
      const perRound = BURST.pool - Math.max(pinned.length, BURST.pool >> 1);
      const totalBodies = (BURST.pool - pinned.length) + rounds * Math.max(1, perRound);
      let done = 0;
      const showProgress = () => {
        btnBurst.textContent = `${Math.min(99, Math.round((100 * done) / totalBodies))}%`;
      };

      (async () => {
        let pop = genomes.slice();
        if (pop.length < BURST.pool) {
          pop = pop.concat(seedPopulation({
            RAPIER, rng: rng.fork('expand'), world: W1_SLICE,
            population: BURST.pool - pop.length, authoredSlots: 0,
          }).genomes);
        }

        const isPinned = new Set(pinned);
        const scores = new Array(pop.length).fill(0);
        // A SEPARATE FLAG, not a sentinel score, because 0 is a real result.
        let measured = new Array(pop.length).fill(false);
        for (const i of pinned) measured[i] = true;   // pins are kept, never ranked

        const scoreSlot = async (i) => {
          if (obj.adapt) {
            // Lamarckian, and only for the unpinned: a body must be judged by the
            // gait it CAN reach. Adapting a pin would hand the player back a
            // different animal than the one they pinned.
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
          if (obj.adapt || done % 8 === 0) await repaint();
        };

        for (let i = 0; i < pop.length; i++) {
          if (measured[i]) continue;
          await scoreSlot(i);
          if (stopped) return;
        }

        for (let round = 0; round < rounds; round++) {
          const selectN = Math.max(2, pop.length >> 1);
          const parents = burstSelection(pinned, scores, selectN);
          const before = pop;
          pop = breed({
            RAPIER, genomes: pop, selected: parents,
            rng: rng.fork(`breed${round}`), world: W1_SLICE,
            // Asexual, matching engine/l2/objective.js autoBurst — the burst
            // breeds from half the pool, so it would go sexual for free and stop
            // being comparable to every figure taken with tools/_zburst.mjs.
            limits: { ...SLICE_LIMITS, crossoverRate: 0 },
          }).genomes;

          // ONLY THE NEW BODIES ARE RESCORED. N18 returns an elite as the SAME
          // OBJECT REFERENCE, so identity is an exact test for "did not change".
          measured = pop.map((g, i) => (g === before[i] && measured[i]) || isPinned.has(i));
          for (let i = 0; i < pop.length; i++) {
            if (measured[i]) continue;
            await scoreSlot(i);
            if (stopped) return;
          }
        }

        const keep = burstKeep(pinned, scores, POPULATION);
        genomes = keep.map((i) => pop[i]);
        provenance = keep.map((poolIndex, slot) =>
          (isPinned.has(poolIndex) && poolIndex === slot
            ? { kind: KIND.ELITE, parent: slot, ops: [], attempts: 0, fellBack: false }
            : { kind: KIND.OFFSPRING }));
        generation++;
        // The selection SURVIVES the burst. Clearing it threw away the player's
        // curation on every run.
        selected = new Set(pinned);
        pendingStranger = null;

        btnBurst.textContent = '';
        state = STATE.BREEDING;
        breedingUntil = performance.now() + BREEDING_MS;
        spawn();
        paint();
        persistLineage();
      })().catch(() => {
        // A failed burst must not strand the vivarium frozen — restore and resume.
        btnBurst.textContent = '';
        state = STATE.SIMULATING;
        view.dataset.breeding = 'no';
        paint();
      });
    }

    // ── naming ──────────────────────────────────────────────────────────────
    //
    // 14 §9: the tank speaks vernacular, the Atlas speaks Latin. The rows and the
    // sheet heading are the vernacular; the binomial is the italic line in the
    // sheet, where there is room for it. That is the actual fix for the
    // real-estate complaint — `Scleromacrosomatus longiventissimus` is 35
    // characters on a row that also has to carry a mass and a ratio.
    //
    // The IN-SCENE sprite keeps showing SPEED and not a name. 21 §4.5 is explicit
    // that one number is always visible and that it is speed; a three-word name
    // floating over each of six creatures in a shared ocean is clutter, and the
    // name is one tap away on the row beneath.
    function nameCast() {
      const minted = new Set(nameCtx.taken);
      for (const c of cast) {
        try {
          const v = nameFor(c.genome, { lineage: nameCtx.lineage, taken: minted }, W1_SLICE.palette);
          c.vernacular = v.name;
          c.binomial = v.binomial;
          c.name = v.name;
          minted.add(v.name);
        } catch {
          // Naming must never be able to stop a creature appearing.
          c.vernacular = null;
          try { c.binomial = binomial(c.plan, c.genome).binomial; } catch { c.binomial = t('Creature'); }
          c.name = c.binomial;
        }
      }
    }

    // ── camera ──────────────────────────────────────────────────────────────
    const orbit = { yaw: 0.6, pitch: 0.12, dist: Math.max(...HABITAT) * 1.4 };
    /** Upward bias of the orbit pivot, so the plate sits in the clear water
     *  between the top readouts and the bottom controls. Solved in fitCast(). */
    let baseTargetY = 0;
    const pan = new THREE.Vector3();
    const followTarget = new THREE.Vector3();
    /** Manual displacement from the follow target. Reset on respawn. */
    const panOffset = new THREE.Vector3();
    const pointers = new Map();
    let drag = null, panning = false, pinch = null, moved = false, longPress = 0;

    /**
     * THE TANK'S CONTRACT, restored. Forage's three-state cycle (tap select → tap
     * details → tap release) is gone: two screens showing the same creatures must
     * not answer the same gesture differently, and this is now one screen.
     */
    function toggleSelect(k) {
      if (k < 0) return;
      if (selected.has(k)) selected.delete(k); else selected.add(k);
      paint();
      persistLineage();      // selection survives a reload too
    }

    /** Give any element the creature gesture: tap selects, long-press opens the
     *  sheet. `indexOf` is a thunk because a row's index moves on respawn. */
    function bindSelect(node, indexOf) {
      let at = 0, held = 0, slid = false, x0 = 0, y0 = 0;
      node.addEventListener('pointerdown', (e) => {
        at = performance.now(); slid = false; x0 = e.clientX; y0 = e.clientY;
        clearTimeout(held);
        held = setTimeout(() => { if (!slid) { at = 0; openSheet(indexOf()); } }, TAP.longPressMs);
      });
      node.addEventListener('pointermove', (e) => {
        if (Math.hypot(e.clientX - x0, e.clientY - y0) > TAP.maxMovePx) { slid = true; clearTimeout(held); }
      });
      node.addEventListener('pointerup', (e) => {
        clearTimeout(held);
        if (!at || slid) return;
        if (classifyPointer({ dx: e.clientX - x0, dy: e.clientY - y0, ms: performance.now() - at }) === 'tap') {
          toggleSelect(indexOf());
        }
        at = 0;
      });
      node.addEventListener('pointercancel', () => { clearTimeout(held); at = 0; });
    }

    const span = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const centroid = () => {
      const v = [...pointers.values()];
      return { x: v.reduce((s, p) => s + p.x, 0) / v.length, y: v.reduce((s, p) => s + p.y, 0) / v.length };
    };
    const panBy = (dx, dy) => {
      invalidate();
      const scale = orbit.dist * 0.0022;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      (habitat === 'ocean' ? panOffset : pan).addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    };

    /**
     * IN THE OCEAN THE CAMERA FOLLOWS. There is no box to frame and a fixed view
     * loses the cast within a minute — measured, a creature travels ~115 cm in an
     * hour, several times the aquarium's whole width. It follows the SELECTED
     * creature when there is one and the cast's centroid otherwise, so tapping an
     * animal is also how you choose what to watch.
     */
    function followCast(dt) {
      if (habitat !== 'ocean' || !cast.length) return;
      const sel = [...selected].filter((k) => cast[k]);
      const src = sel.length ? sel.map((k) => cast[k]) : cast;
      followTarget.set(0, 0, 0);
      for (const c of src) followTarget.add(c.world);
      followTarget.multiplyScalar(1 / src.length);
      followTarget.add(panOffset);
      pan.lerp(followTarget, Math.min(1, 1 - Math.exp(-2.5 * dt)));
      // The motes are a fixed cloud in world space; without this the player swims
      // out of the weather and the open ocean goes visibly sterile.
      water.motes.position.copy(pan);
      invalidate();
    }

    /**
     * FIT THE OPENING PLATE, and fit it to the water the chrome leaves clear.
     *
     * The old value here was `max(HABITAT) * 1.4` — a constant, which framed the
     * TANK rather than the animals in it, so six small creatures sat as specks
     * in the middle of an empty frame. `fitOrbit` projects the real mesh
     * vertices through the real camera and solves for the distance that lands
     * the worst one on a target NDC; the tank did exactly this and the Vivarium
     * inherited none of it.
     *
     * TWO THINGS THE TANK GOT RIGHT AND ARE KEPT. The fit target is scaled by
     * the WORK AREA — the band of water not covered by the top readouts or the
     * bottom controls — and the pivot is biased upward by half the chrome
     * imbalance, so the plate sits centred in the water you can actually see
     * rather than half-hidden behind the Breed button. Yaws are sampled AROUND
     * the opening angle, because the first thing anyone does is orbit it.
     *
     * Called on spawn and on resize, never per frame: it walks every vertex.
     */
    function fitCast() {
      if (!cast.length || !view.clientHeight) return;
      scene.updateMatrixWorld(true);
      const h = view.clientHeight;
      // MEASURE THE READOUTS, DO NOT TRUST `--scrim-top`. That token is 96px and
      // was right for the tank, whose top block was generation / world /
      // selection. This screen's block also carries the food line and SIX LEDGER
      // ROWS inherited from Forage — measured at 196px, more than double. Fitting
      // against the token put the top row of the plate underneath the text, which
      // is exactly the defect the work-area fit exists to prevent. The token
      // stays as a floor for the case where the rows have not been built yet.
      const topPx = Math.max(tokenNumber('--scrim-top'),
        readouts.getBoundingClientRect().height + tokenNumber('--gutter'));
      const botPx = tokenNumber('--scrim-bottom');
      const workFrac = Math.max(0.4, (h - topPx - botPx) / h);
      const target = Math.min(0.92, Math.max(0.5, workFrac * 0.95));
      const fit = fitOrbit(camera, cast.map((c) => c.group), {
        ...FIT.portrait, target, yaws: [orbit.yaw - 0.25, orbit.yaw, orbit.yaw + 0.25],
      });
      orbit.dist = Math.max(8, Math.min(400, fit.distance));
      baseTargetY = -((botPx - topPx) / h) * orbit.dist * Math.tan((camera.fov * Math.PI / 180) / 2);
      // The fit solves about the cast's own centre, which is not the origin once
      // a generation has drifted. `pan` is the pivot, so it has to start there
      // or the plate is framed correctly and then looked at from the side.
      pan.set(fit.centre.x, fit.centre.y, fit.centre.z);
      invalidate();
    }

    function placeCamera() {
      const cp = Math.cos(orbit.pitch), sp = Math.sin(orbit.pitch);
      const ty = pan.y + baseTargetY;
      camera.position.set(
        pan.x + Math.sin(orbit.yaw) * cp * orbit.dist,
        ty + sp * orbit.dist,
        pan.z + Math.cos(orbit.yaw) * cp * orbit.dist);
      camera.lookAt(pan.x, ty, pan.z);
      camera.updateMatrixWorld();
      // Fog at whatever distance the camera actually sits, so the near water
      // stays clear and the far water dissolves — at any zoom.
      scene.fog.near = Math.max(0.1, orbit.dist * 0.35);
      scene.fog.far = orbit.dist * 3.2;
    }

    /**
     * Scale bar — a round length (1/2/5 x 10^n) whose pixel width tracks the
     * zoom. `L` is in WORLD UNITS, which are CENTIMETRES (01 §7), so it is
     * printed as cm and steps DOWN to mm rather than up from metres. This bar is
     * the most direct answer the screen gives to "how big is that animal", and a
     * wrong unit here is worse than none.
     */
    let lastScaleL = -1;
    const niceLen = (v) => {
      const p = Math.pow(10, Math.floor(Math.log10(v)));
      const m = v / p;
      return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
    };
    function updateScale() {
      const h = Math.max(1, view.clientHeight);
      const wpp = (2 * orbit.dist * Math.tan((camera.fov * Math.PI / 180) / 2)) / h;
      const L = niceLen(wpp * 64);           // aim for a ~64 px bar
      scaleLine.style.width = `${(L / wpp).toFixed(0)}px`;
      if (L === lastScaleL) return;
      scaleText.textContent = L >= 100 ? `${L / 100} m` : L >= 1 ? `${L} cm` : `${Math.round(L * 10)} mm`;
      lastScaleL = L;
    }

    /**
     * THE SELECTION RADIUS — a constant number of SCREEN pixels, the same for
     * every creature, and the same number for the ring and the hit test.
     *
     * It deliberately ignores `boundingRadius`. That was right for the tank,
     * where creatures sat in their own grid cells and could not overlap; they
     * share one ocean now and crowd each other, and a creature with long
     * tentacles has a bounding radius most of a screen wide. Its ring then
     * covered its neighbours and — worse, because pick() used the same radius —
     * its hit sphere SWALLOWED them.
     */
    function selectRadius(dist) {
      return hitRadius(0, dist, (camera.fov * Math.PI) / 180,
        view.getBoundingClientRect().height, tokenNumber('--forage-select-px'));
    }

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function pick(cx, cy) {
      const r = view.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      let best = -1, bestD = Infinity;
      cast.forEach((c, k) => {
        const hit = selectRadius(camera.position.distanceTo(c.world));
        const to = c.world.clone().sub(raycaster.ray.origin);
        const along = to.dot(raycaster.ray.direction);
        if (along <= 0) return;
        const perp = Math.sqrt(Math.max(0, to.lengthSq() - along * along));
        // NEAREST-TO-CAMERA WINS, not smallest miss distance: with overlapping
        // hit spheres the front creature is the one being pointed at.
        if (perp < hit && along < bestD) { bestD = along; best = k; }
      });
      return best;
    }

    view.addEventListener('pointerdown', (e) => {
      if (state === STATE.BURSTING) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Capture is a CONVENIENCE and must never abort the handler: it throws
      // NotFoundError for a pointer id the browser is not tracking, and a throw
      // above the lines that initialise the gesture left every tap doing nothing.
      try { view.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
      if (pointers.size === 2) { drag = null; pinch = { d: span(), dist: orbit.dist, c: centroid() }; return; }
      panning = e.button === 1 || e.button === 2 || e.shiftKey;
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, at: performance.now() };
      moved = false;
      clearTimeout(longPress);
      // Arm the long press only if the finger went down ON a creature — a finger
      // resting on open water must not throw up a sheet.
      //
      // OVER WATER IT DROPS THE BEACON INSTEAD. That gesture was free precisely
      // because of the rule above, so this costs nothing and collides with
      // nothing: on a creature you still get its sheet, on water you get a light.
      if (!panning) {
        const onCreature = pick(e.clientX, e.clientY) >= 0;
        longPress = setTimeout(() => {
          if (!drag || moved) return;
          const { x, y } = drag;
          drag = null;
          if (onCreature) {
            const k = pick(x, y);
            if (k >= 0) openSheet(k);
            return;
          }
          // A second long-press clears it, so the gesture is its own undo and
          // there is no extra control to find.
          if (beacon.on) { setBeacon(null); return; }
          const p = waterPoint(x, y);
          if (p) setBeacon(p);
        }, TAP.longPressMs);
      }
    });

    view.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        invalidate();
        const d = span();
        if (pinch.d > 0) orbit.dist = Math.max(8, Math.min(400, pinch.dist * (pinch.d / d)));
        const c = centroid();
        panBy(c.x - pinch.c.x, c.y - pinch.c.y);
        pinch.c = c;
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > TAP.maxMovePx) { moved = true; clearTimeout(longPress); }
      if (panning) panBy(dx, dy);
      else {
        invalidate();
        orbit.yaw -= dx * 0.006;
        orbit.pitch = Math.max(-1.2, Math.min(1.2, orbit.pitch + dy * 0.005));
      }
      drag = { ...drag, x: e.clientX, y: e.clientY };
    });

    const endDrag = (e) => {
      clearTimeout(longPress);
      const wasSingle = pointers.size === 1 && !panning && !moved && drag;
      const at = drag;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) { drag = null; panning = false; }
      if (!wasSingle || !at) return;
      if (classifyPointer({ dx: e.clientX - at.x0, dy: e.clientY - at.y0, ms: performance.now() - at.at }) !== 'tap') return;
      const k = pick(at.x, at.y);
      if (k >= 0) toggleSelect(k);
      // TAP EMPTY WATER CLEARS THE SELECTION. The third leg of the contract, and
      // the one that makes the other two safe to experiment with.
      else { selected.clear(); if (sheetFor >= 0) closeSheet(); else paint(); }
    };
    view.addEventListener('pointerup', endDrag);
    view.addEventListener('pointercancel', endDrag);
    view.addEventListener('contextmenu', (e) => e.preventDefault());
    view.addEventListener('wheel', (e) => {
      e.preventDefault();
      invalidate();
      orbit.dist = Math.max(8, Math.min(400, orbit.dist * (1 + Math.sign(e.deltaY) * 0.1)));
    }, { passive: false });

    // ── loop ────────────────────────────────────────────────────────────────
    let raf = 0, last = 0, acc = 0, painted = 0;

    function syncPose(c) {
      c.pose = c.sim.readPose(c.pose);
      // BY bodyIndex, NOT by child order: each body carries several meshes
      // (flesh, organ, membrane).
      for (const m of c.group.children) {
        const p = c.pose[m.userData.bodyIndex];
        if (!p) continue;
        m.position.set(p.p[0], p.p[1], p.p[2]);
        m.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);
      }
      const com = c.sim.centreOfMass();
      c.world.set(com[0], com[1], com[2]);
    }

    /** Mass-weighted mean velocity IS the centre of mass's velocity, and only its
     *  horizontal part is thrust. `rb.mass()` deliberately: this is a
     *  momentum-weighted mean and wants the mass the SOLVER integrates. */
    function syncSpeed(c, dt) {
      let vx = 0, vy = 0, vz = 0, m = 0;
      for (const rb of c.sim.bodies) {
        const lv = rb.linvel(), bm = rb.mass();
        vx += lv.x * bm; vy += lv.y * bm; vz += lv.z * bm; m += bm;
      }
      if (m > 0) { vx /= m; vy /= m; vz /= m; }
      const inst = Math.hypot(vx, vz);
      const k = dt > 0 ? Math.min(1, 1 - Math.exp(-dt / 0.4)) : 0;
      c.speed += (inst - c.speed) * k;
    }

    /** Append the MOUTH's position to the trail four times a second, forever.
     *  The mouth, not the centre of mass: the trail shows where the creature
     *  could have EATEN, and on a long animal those differ by a body length. */
    function pushTrail(c) {
      if (elapsed - c.trailAt < 0.25) return;
      c.trailAt = elapsed;
      const p = c.mouthBuf[0];
      if (!p) return;
      if (c.trailN >= c.trailCap) {
        if (c.trailCap >= TRAIL_CEIL) {
          c.trailPos.copyWithin(0, 3);          // only at the ceiling do we forget
          c.trailN = c.trailCap - 1;
        } else {
          const bigger = new Float32Array(c.trailCap * 2 * 3);
          bigger.set(c.trailPos);
          c.trailPos = bigger;
          c.trailCap *= 2;
          c.trail.geometry.setAttribute('position', new THREE.BufferAttribute(bigger, 3));
        }
      }
      c.trailPos[c.trailN * 3] = p[0];
      c.trailPos[c.trailN * 3 + 1] = p[1];
      c.trailPos[c.trailN * 3 + 2] = p[2];
      c.trailN++;
      c.trail.geometry.setDrawRange(0, c.trailN);
      c.trail.geometry.getAttribute('position').needsUpdate = true;
      c.trail.geometry.computeBoundingSphere();
    }

    const projected = new THREE.Vector3();

    /**
     * Markers, every frame — NOT only on sim steps. Rings and sprites are
     * billboarded, so they must be re-aimed whenever the CAMERA moves, and the
     * camera moves while the sim is paused.
     */
    function syncMarkers() {
      // Selecting a creature selects its HISTORY too. Six never-forgetting trails
      // overlap into one scribble, and per-creature colour stops being enough to
      // follow one animal through it. The unselected are DIMMED rather than the
      // selected merely brightened — against six dense trails "slightly brighter"
      // is invisible — and they stay present, because they are the comparison.
      const anySel = selected.size > 0;
      cast.forEach((c, k) => {
        const on = selected.has(k);
        c.trail.material.opacity = tokenNumber(!anySel ? '--forage-trail-opacity'
          : on ? '--forage-trail-opacity-hi' : '--forage-trail-opacity-lo');

        projected.copy(c.world).project(camera);
        const visible = projected.z < 1 && !c.burst;

        c.ring.visible = on && visible;
        if (c.ring.visible) {
          const rad = selectRadius(camera.position.distanceTo(c.world));
          c.ring.scale.set(rad, rad, rad);
          c.ring.position.copy(c.world);
          c.ring.quaternion.copy(camera.quaternion);
        }

        c.label.sprite.visible = visible;
        if (visible) {
          drawLabel(c.label, c.speed.toFixed(1));
          c.label.sprite.position.copy(c.world);
          c.label.mat.color.copy(on ? ringSelect : labelDim);
        }

        // The stranger glyph — shown once there IS a lineage to be unrelated to.
        // On first run every creature is a stranger and six marks say nothing
        // (21 §4.4).
        const isStranger = generation > 0 && (provenance[k]?.kind ?? KIND.STRANGER) === KIND.STRANGER;
        c.glyph.sprite.visible = visible && isStranger;
        if (c.glyph.sprite.visible) {
          // Above the body by its own reach, so it clears the animal instead of
          // sitting inside it.
          c.glyph.sprite.position.copy(c.world);
          c.glyph.sprite.position.y += Math.max(c.radius, 1) * 0.9;
        }
      });
    }

    function frame(nowMs) {
      raf = requestAnimationFrame(frame);
      // NOTHING IS DRAWN UNTIL THERE ARE CREATURES TO DRAW. Before `ready` the
      // scene holds water, the food cloud and a camera that has never been
      // fitted to anything — which is precisely the "far view of an empty
      // aquarium with the food on" that used to open every warm load. The boot
      // panel covers it, and this makes sure there is nothing underneath the
      // panel to be uncovered by a mistimed reveal.
      if (!ready) return;
      const dt = last ? Math.min(0.25, (nowMs - last) / 1000) : 0;
      last = nowMs;

      if (state === STATE.BREEDING && nowMs >= breedingUntil) {
        state = STATE.SIMULATING;
        view.dataset.breeding = 'no';
        paint();
      }

      // Nothing is moving and nothing was touched: skip the whole draw. The rAF
      // itself is free; it is the render that costs.
      const simming = running && state !== STATE.BREEDING && state !== STATE.BURSTING;
      if (!simming && !dirty && nowMs - lastDraw < 1000 / IDLE_FPS) return;
      lastDraw = nowMs; dirty = false;

      if (simming && arena && cast.length) {
        const { steps, carry, dropped } = stepBudget(acc + dt * speed, FIXED_DT);
        acc = carry;
        capped = dropped;
        // Measured over a one-second wall window, not per frame: a per-frame ratio
        // is pure jitter and the chip would flicker through a decade.
        achWall += dt; achSim += steps * FIXED_DT;
        if (achWall >= 1) { achieved = achSim / achWall; achWall = 0; achSim = 0; }
        const rate = W1_SLICE.INGEST_RATE ?? INGEST_RATE;
        // A burst creature is not stepped at all: its fragments would keep
        // colliding with the survivors and take them with it.
        const sims = cast.filter((c) => !c.burst).map((c) => c.sim);
        for (let s = 0; s < steps; s++) {
          // MATERIALISE FIRST — in the ocean the food does not exist until a
          // mouth is near it, so the field must be extended BEFORE the step that
          // would eat from it.
          if (food.ensureAround) {
            for (const c of cast) food.ensureAround(mouthPoints(c.sim, c.plan, c.mouths, c.mouthBuf));
          }
          // ── THE BEACON — drive every creature's steering at it ─────────────
          //
          // Set BEFORE the solve, like every other control input, so a creature
          // is never a step behind the target.
          //
          // This is `tools/_zlight.mjs` made watchable. That harness measures
          // whether a creature closes on a light and reports a number; this puts
          // the same loop on screen so the answer can be SEEN. The two share the
          // same two lines — `bearingTo` then `sensorTurnBias` — deliberately, so
          // the screen cannot drift from the experiment.
          //
          // IT IS ALSO AN HONEST DEMO, and what "honest" means here changed on
          // 2026-08-10.
          //
          // This note used to say: "two of those have `steeringAuthority` 0.000
          // and provably never will" move toward the light. THAT WAS WRONG, and
          // wrong in the most expensive direction — it declared a body incapable
          // on the strength of a number, and the number was the instrument's.
          // `tools/_zgoal.mjs` scores `eel` and `eel-finned`, the two creatures
          // that claim was about, as the best goal-reachers in the authored
          // library: +0.65 and +0.67 control-subtracted closure, arriving in four
          // of six directions. They steer by rolling the plane they bend in onto
          // the target, which no field in the record was looking for.
          // `steeringAuthority` 0.000 is a true measurement of a real fact — those
          // bodies do not reverse their turn axis with the sign of the command —
          // and it simply does not imply what it was read to imply.
          //
          // What IS true is that the authored eels all ship `preyGain 0.600 +
          // threatGain -0.400`, a sum of 0.200, so they command a fifth of what
          // the mechanism accepts. Same bodies at gain 1.0: mean closure 0.065 ->
          // 0.153 and arrivals 2/54 -> 10/54. The two SELECTED creatures in
          // `worlds/w1_curated.js` evolved sums of 1.275 and 0.484, and reach the
          // beacon. So a player dropping a beacon now sees a split cast — some
          // creatures arrive, most drift — and that split is the real state of
          // the project rather than a uniform failure.
          if (beacon.on) {
            for (const c of cast) {
              if (c.burst) continue;
              // GENOME_V 7 — BOTH CHANNELS. `bearingPair` returns the in-plane
              // bearing and the elevation out of that plane; the second drives
              // the joints along the body's second bend axis. A creature with a
              // single bend plane — every eel in the library — has all-zero
              // actuator weights on channel B, so this is inert for it and the
              // tank is unchanged for the creatures it was tuned on.
              const { bearing, elevation } = bearingPair(c.sim, beacon.at, c.turnPlane ?? null);
              c.sim.control.turnBias = sensorTurnBias(c.genome, bearing, bearing);
              c.sim.control.turnBias2 = sensorTurnBias2(c.genome, elevation, elevation);
              // GENOME_V 8 — throttle the gait when badly aimed. `brakeGain` 0
              // returns exactly 1, so this is inert for every creature in the
              // library today and only a bred one will show it.
              c.sim.control.effort = sensorEffort(c.genome, bearing);
            }
          }
          // ALL occupants push, THEN one solve. Stepping each creature to
          // completion in turn would make the result depend on cast order.
          arena.stepAll(sims);
          for (const c of cast) {
            if (c.burst) continue;         // a corpse neither eats nor is measured
            c.eaten += forageStep(c.sim, c.plan, food, c.mouths, FIXED_DT, rate, c.mouthBuf);
          }
          elapsed += FIXED_DT;
        }

        // STRUCTURAL CHECK once per frame rather than once per step: a burst is a
        // single-step event and integrity() walks every body.
        for (const c of cast) {
          if (c.burst || c.sim.integrity().spread <= BURST_SPREAD) continue;
          c.burst = true;
          // FROZEN, NOT REMOVED. Deleting it would erase its trail and its
          // ledger — the evidence of what happened.
          for (const rb of c.sim.bodies) {
            rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
            rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
          }
          c.group.visible = false;
          c.mouthMark.visible = false;
        }

        if (steps) {
          paintFood();
          for (const c of cast) {
            syncPose(c);
            syncSpeed(c, dt);
            const pts = mouthPoints(c.sim, c.plan, c.mouths, c.mouthBuf);
            if (pts[0]) c.mouthMark.position.set(pts[0][0], pts[0][1], pts[0][2]);
            pushTrail(c);
            // A no-op on the ~5 in 6 creatures below the luminosity threshold.
            updateCreatureGlow(c.group, c.phaseFor, 1);
          }
        }
      }

      drawFrame(nowMs, dt);

      if (nowMs - painted > 150) { paint(); painted = nowMs; }
    }

    /**
     * The draw half of a frame, split out so BOOT CAN CALL IT ONCE before it
     * lowers the loading panel. Everything here is idempotent and reads the
     * current state; it steps nothing.
     */
    function drawFrame(nowMs, dt) {
      updateWater(water, nowMs / 1000);
      followCast(dt);
      placeCamera();
      updateScale();
      syncMarkers();
      renderer.render(scene, camera);
      renderOverlay(renderer, water);
    }

    function resize() {
      const w = view.clientWidth, h = view.clientHeight;
      if (!w || !h) return;
      invalidate();
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // The work area is a fraction of the HEIGHT, so a resize changes the fit
      // target and the vertical bias, not just the aspect.
      fitCast();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(view);
    resize();

    // ── lineage persistence ─────────────────────────────────────────────────
    //
    // Forage persisted NOTHING — every visit was a fresh trial. The tank's
    // lineage record carries over verbatim, so breeding progress survives a
    // reload, which is the whole reason it exists.
    function lineageRecord() {
      return {
        vivariumId: vivariumSeed,
        generation, genomes, provenance,
        selected: [...selected],
        previous: previous && {
          genomes: previous.genomes, provenance: previous.provenance,
          generation: previous.generation, selected: previous.selected,
        },
      };
    }

    /** Fire-and-forget: an unpersisted vivarium is still a working one (H7). */
    function persistLineage() {
      store.set(store.KEY.lineage(vivariumSeed), lineageRecord())
        .catch(() => { /* storage unavailable — the session still runs */ });
    }

    /** The saved lineage, or null if absent, malformed, or from a future build. */
    async function loadLineage() {
      try {
        const rec = await store.get(store.KEY.lineage(vivariumSeed));
        if (!rec || !Array.isArray(rec.genomes) || rec.genomes.length !== POPULATION) return null;
        // Reject anything structurally invalid rather than booting a broken tank.
        for (const g of rec.genomes) if (!validateGenome(g).ok) return null;
        return rec;
      } catch { return null; }   // FutureVersionError, parse failure, first run
    }

    /**
     * This lineage's seed: read it, or mint one and persist it (H7). A seed
     * regenerated on every load would make the vivarium non-reproducible in the
     * other direction — the same lineage would drift each time it was opened.
     */
    async function loadOrCreateVivariumSeed() {
      const KEY = 'vivarium:seed';
      try {
        const stored = await store.get(KEY);
        if (Number.isInteger(stored) && stored >= 0 && stored <= 0xFFFFFFFF) return stored;
      } catch { /* first run, or storage unavailable — mint below */ }
      const fresh = freshVivariumSeed();
      try { await store.set(KEY, fresh); } catch { /* unpersisted beats shared */ }
      return fresh;
    }

    // ── boot ────────────────────────────────────────────────────────────────
    //
    // THE PANEL GOES UP BEFORE ANY OF THIS, AND THE SCENE IS NOT DRAWN BEHIND
    // IT. Previously the rAF loop started here and `#boot-load` was revealed
    // only by `seedAtlas`'s first progress callback — which fires on a COLD
    // store and never again. So every subsequent load opened on the empty
    // aquarium: the far framing (there is no cast yet, so `fitCast` has nothing
    // to fit and the camera sits at its construction distance), the food point
    // cloud already painted, and no animals, for the whole of Rapier's wasm
    // instantiation plus the store read.
    //
    // Two changes, and both are needed: the panel is raised at the top of boot
    // and lowered at the very end, AND `frame()` refuses to render until
    // `ready`. The panel alone would still leave the first frame after it drops
    // to be the unframed one; the render guard alone would show the previous
    // screen's pixels. Together the first thing drawn is the fitted plate.
    const boot = (() => {
      const panel = document.getElementById('boot-load');
      const head = document.getElementById('boot-load-head');
      const track = document.getElementById('boot-load-track');
      const bar = document.getElementById('boot-load-bar');
      return {
        /** `pct` null means "no measurable progress" — the track hides itself. */
        show(text, note, pct = null) {
          if (!panel) return;
          panel.hidden = false;
          if (head) head.textContent = t(text);
          const noteEl = document.getElementById('boot-load-note');
          if (noteEl) noteEl.textContent = note ? t(note) : ' ';
          if (track) track.hidden = pct === null;
          if (bar && pct !== null) bar.style.width = `${Math.round(pct * 100)}%`;
        },
        done() { if (panel) panel.hidden = true; },
      };
    })();
    boot.show('Starting', 'Setting up the simulation.');
    genEl.textContent = t('Loading…');
    paint();
    raf = requestAnimationFrame(frame);

    (async () => {
      await RAPIER.init();
      if (stopped) return;
      boot.show('Reading your vivarium', 'Loading the lineage you left.');
      vivariumSeed = await loadOrCreateVivariumSeed();
      const saved = await loadLineage();
      if (stopped) return;
      if (saved) {
        generation = saved.generation ?? 0;
        genomes = saved.genomes;
        provenance = saved.provenance ?? genomes.map(() => ({ kind: KIND.STRANGER }));
        selected = new Set(Array.isArray(saved.selected) ? saved.selected : []);
        previous = saved.previous ? { ...saved.previous, selected: saved.previous.selected ?? [] } : null;
      } else {
        const seeded = seedPopulation({
          RAPIER, rng: rngFrom('tank', vivariumSeed, 'seed'), world: W1_SLICE,
        });
        genomes = seeded.genomes;
        provenance = seeded.provenance;
      }
      // The Atlas is the naming lineage (14 §4). Seeding it first means a fresh
      // install names its first generation against the shipped library rather
      // than against nothing.
      // ── FIRST LOAD ONLY, and now one phase of the panel rather than all of it ──
      //
      // `seedAtlas` draws one portrait per library entry and each costs about
      // 206 ms — 4321 ms for the 21 shipped specimens, measured on a cold store.
      // It yields to the event loop between them, so this is the one phase with
      // real progress to report and it is the only one that shows the bar. A
      // warm boot skips every portrait, fires no callback, and simply passes
      // through with the previous phase's text still up.
      try {
        await seedAtlas({
          onProgress: (done, total) => {
            boot.show('Building the library', 'Drawing each specimen once. First load only.',
              done / Math.max(1, total));
          },
        });
      } catch { /* the library just will not appear */ }
      if (stopped) return;
      boot.show('Growing your creatures', 'Building bodies and framing the tank.');
      nameCtx = await atlasContext();
      if (stopped) return;
      spawn();
      ready = true;
      state = STATE.SIMULATING;
      if (!saved) persistLineage();
      paint();
      // ONE FRAME, SYNCHRONOUSLY, BEFORE THE PANEL DROPS. `spawn()` fits the
      // camera but does not draw; handing back to rAF here would lower the panel
      // on a canvas still holding whatever was in it. Drawing first means the
      // reveal is of the finished plate.
      drawFrame(performance.now(), 0);
      boot.done();
    })();

    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
        clearTimeout(longPress);
        closeMenu();
        ro.disconnect();
        clearCast();
        if (arena) { arena.free(); arena = null; }
        disposeWater(water);
        renderer.dispose();
        renderer.forceContextLoss?.();
      },
    };
  },

  unmount(instance) { instance?.stop?.(); },
};
