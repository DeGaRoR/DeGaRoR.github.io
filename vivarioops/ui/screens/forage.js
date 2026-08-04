// ui/screens/forage.js — A CAST OF CREATURES, ONE FIELD OF FOOD, AND A LEDGER.
//
// WHY THIS IS ITS OWN SCREEN. The tank is the breeding loop and it works; the
// food trial is a different question. Folding it into the tank would entangle the
// only end-to-end thing the project has.
//
// AND WHY IT IS NOT THE `World` TAB. World is reserved for L3 — many point
// agents, no physics, a compiled Species record. This is full-physics creatures
// in a real fluid, which L3 cannot represent. Putting it under World would
// re-create exactly the layer confusion ROADMAP.md §1 exists to undo.
//
// ── ONE SHARED TANK, AND WHAT THAT CHANGES ───────────────────────────────────
//
// The Tank screen gives every creature its own PRIVATE arena, tiled, precisely
// so they cannot touch. Here they share one, through `createArena` + `stepAll` —
// the same machinery duels use. So they collide, they block each other, and they
// compete for the same depleting food. That changes what the ledger MEANS: from
// "can this creature feed itself" to "can it feed itself against rivals".
//
// It is still L2 — real bodies, real fluid, no compiled records — and NOT D1.
//
// Birth and death are D1. Until then the ledger carries the same information a
// death rule would use, without committing to one before it can be measured.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { t } from '../../trunk/i18n.js';
import { rngFrom } from '../../trunk/rng.js';
import * as store from '../../trunk/store.js';
import { seedAtlas } from '../../worlds/atlas_seed.js';
import { morphogenesis, totalMass, boundingRadius } from '../../engine/l1/morphogen.js';
import { createArena, createSimulation, FIXED_DT } from '../../engine/l1/physics.js';
import { seedPopulation } from '../../engine/l1/breed.js';
import { binomial } from '../../engine/l1/naming.js';
import {
  makeFood, makeChunkedFood, mouthsOf, mouthPoints, forageStep, ledger,
  INGEST_RATE, FOOD_DENSITY,
} from '../../engine/l2/forage.js';
import {
  buildCreature, disposeCreature, token, tokenNumber, rampFor, colourFrom,
} from '../../render/creature.js';
import {
  createWater, updateWater, disposeWater, fitAtmosphere, renderOverlay, dotTexture,
} from '../../render/tank.js';
import { W1_SLICE } from '../../worlds/w1_slice.js';
import { stepBudget, hitRadius, classifyPointer, TAP } from '../tank/sim.js';

/**
 * How many creatures share the tank. Six matches the Tank's population, and the
 * cap is a frame budget: every creature is a full Rapier body tree stepped
 * against 1400 food items, and the Atlas can hold arbitrarily many.
 */
const CAST_MAX = 6;

/**
 * Trail buffer, in samples. NOTHING IS FORGOTTEN — the buffer doubles instead of
 * sliding, because the whole value of the trail is seeing the WHOLE history: a
 * creature that has quartered the tank against one that has trembled in place is
 * the single most legible thing on this screen, and a sliding window erases
 * exactly the evidence you came for. At 4 Hz the ceiling is over two hours.
 */
const TRAIL_START = 2048;
const TRAIL_CEIL = 32768;

/**
 * Time multipliers. The tank's ladder stops at 4x (`SPEEDS` in ui/tank/sim.js) and
 * that is right for it — you are watching six creatures wiggle and deciding which
 * to breed, which is a decision you make in seconds.
 *
 * FORAGE IS A DIFFERENT TIMESCALE and the ladder has to say so. The energy
 * multiplier only separates the cast over minutes: at 300 s the field is 2%
 * grazed, and a creature that starves and one that thrives are still both "about
 * 1x". An hour of sim is the trial that actually discriminates, and at 4x that is
 * a quarter of an hour of staring.
 *
 * The high rungs are ASPIRATIONAL, not guaranteed. `stepBudget` caps the steps a
 * single frame may run — deliberately, so one stalled frame cannot spiral — so
 * asking for 32x on a heavy cast gets whatever the frame can deliver. That is why
 * the chip marks itself when it is being capped: a speed control that silently
 * lies about the rate makes every long trial unreproducible.
 */
const FORAGE_SPEEDS = [1, 2, 4, 8, 16, 32];

/**
 * A creature whose bodies are further apart than this, over its own rest radius,
 * HAS COME APART and is no longer simulating an animal.
 *
 * Measured (tools/_zboom.mjs): a normal pose sits at 0.5–1.5 and cannot reach 3;
 * a burst creature reaches 297. Between the two is nothing, so the threshold is
 * not a tuning knob — anything from 2 to 50 gives the identical verdict.
 *
 * WHY IT MUST BE CAUGHT. In a bounded tank a burst creature is merely wrong. In
 * the OPEN OCEAN its fragments sweep at the speed ceiling forever: they unlock
 * food chunks without limit until the screen is unusable, and they report an
 * intake that is pure fiction — a 300-minute run had one at 7864 g against 31–49
 * for its five rivals. One creature ruins the trial for all six.
 */
const BURST_SPREAD = 3;

/**
 * THE TWO HABITATS, and why they are one screen rather than two tabs.
 *
 * They share the cast picker, the ledger, the trails, selection, the speed
 * control and the stats sheet — everything except the arena, the food field, the
 * glass and the camera. Two tabs would duplicate ~900 lines that would drift, and
 * six entries is too many for a phone tab bar.
 *
 * And COMPARING THEM IS THE FEATURE. Measured over an hour (tools/_zthrive.mjs),
 * Darter reads 1.96x walled and 6.91x open — the same animal, a different verdict.
 * One tap between arms is the point.
 *
 * Switching RESPAWNS. It has to: different arena, different field. The two are
 * not the same trial and pretending the clock carries over would be a lie.
 */
const HABITATS = [
  { id: 'aquarium', label: 'Aquarium' },
  { id: 'ocean', label: 'Open ocean' },
];

export default {
  title: t('Forage'),

  mount(el) {
    const mk = (cls, parent, tag = 'div') => {
      const n = document.createElement(tag);
      if (cls) n.className = cls;
      if (parent) parent.append(n);
      return n;
    };

    const wrap = mk('tank');
    const view = mk('tank-view', wrap);
    mk('tank-scrim tank-scrim-bottom', wrap);

    const readouts = mk('tank-readouts', wrap);
    const left = mk('tank-readout-l', readouts);
    // The habitat is not an adjustment like Trails or Food — it is WHICH
    // EXPERIMENT is running — so it sits in the title row, not the chip cluster,
    // and the readout under it names the arm so a screenshot is self-describing.
    const habitatEl = mk('forage-habitat', left);
    const titleEl = mk('tank-gen', left);
    const foodEl = mk('tank-world', left);
    const rows = mk('forage-rows', left);

    const cluster = mk('tank-cluster', wrap);
    const primary = mk('tank-breed', wrap, 'button');
    primary.type = 'button';
    const sheet = mk('tank-sheet', wrap);
    sheet.hidden = true;
    el.append(wrap);

    // ── scene ───────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    // 42 to match ui/screens/tank.js — the two views must frame a creature the
    // same way or the same animal reads as two different sizes across tabs.
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    view.append(renderer.domElement);
    const water = createWater(scene, W1_SLICE.palette);

    // ── THE GLASS ───────────────────────────────────────────────────────────
    //
    // The tank has real walls here and they were invisible, so a creature that
    // had run into one just looked broken — "everyone is stuck" with nothing on
    // screen to say what they were stuck ON.
    //
    // They are visible ONLY on this screen, and that is not an oversight. The
    // Tank gives each creature a private, WRAPPED world (physics.js:697, the
    // torus): a finite volume with no boundary, adopted precisely because "the
    // tank boundary is ABSORBING... a creature random-walks, reaches a wall, and
    // has no mechanism to leave". There is no wall there to draw. Forage shares
    // one arena, and the same note says wrapping is safe only while creatures do
    // not interact — so Forage must run bounded, and the boundary it runs into
    // has to be something the player can see.
    //
    // Edges only, no faces: a translucent box would tint every creature behind
    // it and dim the water, and the corner lines are enough to read a volume.
    const glass = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(...(W1_SLICE.habitatBounds ?? W1_SLICE.tankBounds))),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(token('--forage-glass')), transparent: true,
        opacity: tokenNumber('--forage-glass-opacity'), depthWrite: false,
      }));
    scene.add(glass);

    let arena = null, food = null, points = null, foodDot = null;
    let cast = [];
    let elapsed = 0, running = true, stopped = false, picked = -1;
    let speed = 1, capped = false;
    let habitat = 'aquarium';
    /** The volume the player watches. Unhashed, therefore free to change. */
    const HABITAT = W1_SLICE.habitatBounds ?? W1_SLICE.tankBounds;
    /**
     * PAUSED MUST BE NEARLY FREE. A paused screen still drew the full scene 60
     * times a second — six creature trees, the food field, two mote layers and a
     * second overlay pass — to show a picture that had not changed.
     *
     * `dirty` is set by anything that alters what is on screen (camera, selection,
     * a layer toggle, a respawn) and forces an immediate frame, so dragging the
     * water stays responsive. With nothing happening the screen falls back to
     * IDLE_FPS, which keeps the water alive rather than freezing it solid — a
     * frozen aquarium reads as a crash, and this is ~87% of the cost either way.
     */
    const IDLE_FPS = 8;
    let dirty = true, lastDraw = 0;
    const invalidate = () => { dirty = true; };
    // ACHIEVED rate, sim-seconds per wall-second, smoothed. `capped` says the
    // setting is not being met; on a heavy cast 32x can deliver 5x, and "not
    // met" is far less useful than "you are getting 5x" when the question is how
    // long you must wait for an hour of trial.
    let achieved = 0, achWall = 0, achSim = 0;

    /**
     * WHO IS SELECTED — a Set of cast indices, exactly as the tank keeps it.
     *
     * Selection was a mess here because it was a DIFFERENT GESTURE from the tank's:
     * a tap threw a modal sheet over the aquarium, so choosing a creature to watch
     * meant reading a sheet and dismissing it, and there was no persistent mark
     * saying which one you had chosen. The tank had already solved this — tap
     * toggles a ring, long-press opens the sheet — and two screens showing the same
     * creatures must not answer the same gesture differently.
     *
     * What selection MEANS differs (the tank pins for breeding; here it marks who
     * you are watching), but the interface is the same one, deliberately.
     */
    const selected = new Set();

    const ramp = rampFor(W1_SLICE.palette);
    const foodColour = new THREE.Color(token('--forage-food'));
    const ringSelect = new THREE.Color(token('--c-select'));

    /**
     * A creature's OWN colour, from its own genes — the same `colourFrom` call
     * `buildCreature` uses for its base material. So the trail, the readout
     * swatch and the animal are one colour, and "which one is number 3" stops
     * being a question the screen cannot answer.
     */
    function creatureColour(genome) {
      const g = genome.material ?? {};
      return colourFrom(ramp, g.hue ?? 0.5, g.valueShift ?? 0, g.iridescence > 0.82, 1.18);
    }

    // ── the food ────────────────────────────────────────────────────────────
    // THE OCEAN'S FIELD GROWS. `makeFood` fills a box once and is done; the
    // chunked field materialises items as mouths reach new water, so the buffer
    // has to double rather than be sized once — the same rule the trail follows,
    // and for the same reason: a fixed buffer would silently stop drawing food
    // that the creature can nonetheless eat, which is worse than not drawing it.
    let foodCap = 0, foodDrawn = 0;
    function buildFood() {
      food = habitat === 'ocean'
        ? makeChunkedFood(W1_SLICE)
        : makeFood(W1_SLICE, { bounds: HABITAT });
      foodCap = Math.max(4096, food.items.length);
      foodDrawn = 0;
      const pos = new Float32Array(foodCap * 3);
      const col = new Float32Array(foodCap * 3);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      // A SOFT ROUND DOT, not a hard square. An untextured point renders as a
      // filled square and 1400 of them in near-white on additive blending is a
      // wall of harsh pixels. Same texture the water motes use.
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
      // POSITIONS ONLY FOR WHAT IS NEW. Food never moves, so rewriting every
      // position each frame would be tens of thousands of pointless writes once
      // the ocean has been explored for a while.
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
        // Brightness carries the remaining mass: an emptied item fades to black,
        // and black adds nothing, so it simply stops existing.
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
        if (c.sim) c.sim.free();
      }
      cast = [];
      rows.replaceChildren();
      // The arena owns every body in it, so it goes last and takes them with it.
      if (arena) { arena.free(); arena = null; }
      if (points) { scene.remove(points); points.geometry.dispose(); points.material.dispose(); points = null; }
    }

    /**
     * Spawn positions: a ring in the VERTICAL plane (XY), not the horizontal one.
     *
     * A horizontal ring is the obvious choice and it is wrong for the device this
     * game is for: on a portrait phone the frame is tall and narrow, so creatures
     * spread across X and Z land in a thin horizontal band with empty water above
     * and below. Spreading them up the Y axis fills the frame the player actually
     * has. The tank is 24 cm tall against 32 wide, so the ring is squashed to fit.
     */
    function spawnRing(n, i) {
      const [W, H] = HABITAT;
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      return [Math.cos(a) * (W / 4), Math.sin(a) * (H / 3), 0];
    }

    function spawn(entries) {
      clearCast();
      // ONE arena, shared. This is what makes them rivals rather than six
      // separate experiments — and `stepAll` is the only legal way to step it.
      // THE ONE PHYSICS DIFFERENCE. `bounded: false` was already supported
      // (physics.js:255, "false builds an open volume") — the wall colliders are
      // simply not created, creatures still collide with each other, and because
      // nothing wraps there is no periodic broad-phase to write. The open ocean
      // was never blocked by physics; it was blocked by food.
      arena = habitat === 'ocean'
        ? createArena(RAPIER, W1_SLICE, { bounded: false })
        : createArena(RAPIER, W1_SLICE, { bounded: true, bounds: HABITAT });
      glass.visible = habitat !== 'ocean';
      buildFood();

      const use = entries.slice(0, CAST_MAX);
      use.forEach((entry, i) => {
        const genome = entry.genome;
        let plan, sim;
        try {
          plan = morphogenesis(genome);
          sim = createSimulation(RAPIER, plan, genome, W1_SLICE, {
            arena, wrap: false, origin: spawnRing(use.length, i),
            // GHOSTS. This screen measures foraging, and foraging does not need
            // creatures to bump into each other — they compete for the FOOD, which
            // is shared and finite, and that is the rivalry that matters here.
            // Contact is also the trigger for the solver tear-apart, so removing
            // it removes a failure mode rather than raising the bar against it.
            creatureCollision: false, collisionGroup: i,
          });
        } catch {
          return;                       // a body that will not build is a verdict
        }
        const colour = creatureColour(genome);
        const group = buildCreature(plan, genome, { worldId: W1_SLICE.palette });
        scene.add(group);

        // THE MOUTH: a bright POINT plus a faint shell of its reach.
        //
        // A filled additive sphere was wrong twice over — front and back faces
        // accumulate, so the middle blows out into a bright ball, and six of
        // those hide the animals they belong to. BackSide draws only the far
        // hemisphere, which reads as a shell you can see the creature through,
        // and the solid dot inside says unambiguously where the mouth IS. Both
        // take the creature's own colour, so the mouth, the trail and the row
        // swatch are one identity.
        const mouthMark = new THREE.Group();
        const shell = new THREE.Mesh(
          new THREE.SphereGeometry(food.radius, 14, 10),
          new THREE.MeshBasicMaterial({
            color: colour.clone(), transparent: true, side: THREE.BackSide,
            opacity: tokenNumber('--forage-mouth-opacity'),
            depthWrite: false, blending: THREE.AdditiveBlending,
          }));
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(tokenNumber('--forage-mouth-dot'), 10, 8),
          new THREE.MeshBasicMaterial({ color: colour.clone(), depthWrite: false }));
        mouthMark.add(shell, dot);
        scene.add(mouthMark);

        // THE SELECTION RING — same geometry, same token, same rules as
        // tank.js:318. A scene object rather than a DOM overlay because a DOM
        // overlay sits on its own compositor layer and lags the WebGL canvas by a
        // frame, so it visibly slides off the creature while you orbit. Scaled to
        // the body and turned to face the camera every frame, so it always reads
        // as a flat circle around the animal whatever angle you are at.
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.92, 1.0, 48),
          new THREE.MeshBasicMaterial({
            color: ringSelect.clone(), transparent: true, opacity: 0.95,
            side: THREE.DoubleSide, depthTest: false, toneMapped: false,
          }));
        ring.visible = false;
        ring.renderOrder = 10;
        scene.add(ring);

        // The trail takes the CREATURE'S colour, which is the whole point: six
        // identical grey threads say nothing about who went where.
        const trailPos = new Float32Array(TRAIL_START * 3);
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
        tg.setDrawRange(0, 0);
        const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({
          color: colour.clone(), transparent: true,
          opacity: tokenNumber('--forage-trail-opacity'), depthWrite: false,
        }));
        scene.add(trail);

        const mouths = mouthsOf(plan);
        const row = mk('forage-row', rows);
        const swatch = mk('forage-swatch', row);
        swatch.style.background = `#${colour.getHexString()}`;
        const text = mk('forage-text', row);
        // The row answers the SAME gesture as the creature it names: tap to
        // select, long-press for the sheet. A row that behaved differently from
        // the body it points at would be the original defect in miniature.
        bindSelect(row, () => cast.findIndex((x) => x.row === row));

        cast.push({
          i, entry, genome, plan, sim, group, mouthMark, trail, ring, colour,
          trailPos, trailN: 0, trailAt: 0, trailCap: TRAIL_START,
          mouths, mouthBuf: mouths.map(() => [0, 0, 0]),
          pose: null, eaten: 0, burst: false, mass: totalMass(plan),
          radius: boundingRadius(plan),
          world: new THREE.Vector3(),
          row, text,
        });
      });
      // POSE ONCE, BEFORE THE FIRST STEP. `syncPose` otherwise runs only when the
      // sim advances, so a cast spawned into a paused screen leaves every
      // `c.world` at the origin — which is where the selection ring would draw
      // and, worse, where the ray-pick would look for six overlapping creatures.
      // Spawning and then pausing is an ordinary thing to do; it must not break
      // selection until the player presses Run.
      for (const c of cast) {
        syncPose(c);
        const pts = mouthPoints(c.sim, c.plan, c.mouths, c.mouthBuf);
        if (pts[0]) c.mouthMark.position.set(pts[0][0], pts[0][1], pts[0][2]);
      }
      elapsed = 0;
      picked = -1;
      selected.clear();
      panOffset.set(0, 0, 0);
      placeCamera();
      applyLayers();     // a respawn rebuilds `points` and every trail from scratch
      // In the ocean the atmosphere has no box to fill, so it is sized generously
      // and re-centred on the camera each frame (see the follow block).
      fitAtmosphere(water, habitat === 'ocean' ? HABITAT.map((b) => b * 2) : HABITAT);
      paint();
    }

    // ── readout ─────────────────────────────────────────────────────────────
    //
    // WHAT THIS DELIBERATELY DOES NOT SHOW. It used to print intake and spend in
    // ergs, in scientific notation, four numbers a row across six rows. Nobody
    // can read that, and the two raw energies are not the question — the question
    // is "is it paying its way", which is their RATIO. The ergs are still there,
    // one creature at a time, in the stats sheet.
    function paint() {
      if (!food) return;
      invalidate();
      titleEl.textContent = `${cast.length} ${t('foraging')} · ${fmtTime(elapsed)}`;
      if (food.unbounded) {
        // "% GRAZED" IS MEANINGLESS AGAINST AN INFINITE FIELD and is deliberately
        // not faked. What can honestly be said: how much has been taken, and how
        // rich the VISITED water is against the aquarium's density.
        const vol = food.chunkCount() * food.chunk ** 3;
        const rel = vol > 0 ? (food.items.length / vol) / FOOD_DENSITY : 1;
        foodEl.textContent = `${t('Open ocean')} · ${food.eatenMass().toFixed(1)} g ${t('taken')}`
          + ` · ${t('density')} ${rel.toFixed(2)}×`;
      } else {
        const pctLeft = food.items.length ? (100 * food.eatenCount()) / food.items.length : 0;
        foodEl.textContent = `${t('Food')} ${food.remaining().toFixed(0)} g ${t('of')} ${food.initialTotal.toFixed(0)}`
          + ` · ${pctLeft.toFixed(0)}% ${t('grazed')}`;
      }
      for (const c of cast) {
        const L = ledger(W1_SLICE, c.mass, c.eaten, c.sim.workOut, elapsed);
        c.text.textContent = c.burst
          ? `${c.entry.name}  ${c.eaten.toFixed(2)} g  ${t('came apart')}`
          : `${c.entry.name}  ${c.eaten.toFixed(2)} g  ${fmtRatio(L.ratio)}`;
        c.row.dataset.state = c.burst ? 'burst'
          : Number.isFinite(L.ratio) && L.ratio >= 1 ? 'surplus' : 'deficit';
        c.row.dataset.picked = selected.has(cast.indexOf(c)) ? 'yes' : 'no';
      }
      primary.textContent = running ? t('Pause') : t('Run');
      // When the frame budget cannot deliver the setting, the chip stops claiming
      // it and reports what is actually happening instead.
      chipSpeed.textContent = capped && achieved > 0
        ? `${achieved < 10 ? achieved.toFixed(1) : achieved.toFixed(0)}×`
        : `${speed}×`;
      chipSpeed.dataset.on = capped ? 'no' : 'yes';
    }

    const fmtTime = (s) => (s < 60 ? `${s.toFixed(0)}s` : `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`);
    /** Plain multiples, never scientific. Above 100x the exact figure is noise. */
    const fmtRatio = (r) => {
      if (!Number.isFinite(r)) return '—';
      if (r === 0) return t('starving');
      if (r >= 100) return '99+×';
      return `${r < 10 ? r.toFixed(1) : r.toFixed(0)}×`;
    };
    /** Energies are the one place scientific notation is honest — they span e6. */
    const erg = (v) => (v >= 1e5 || (v > 0 && v < 0.01) ? v.toExponential(2) : v.toFixed(2));

    // ── stats sheet ─────────────────────────────────────────────────────────
    function closeSheet() { sheet.hidden = true; sheet.replaceChildren(); }

    function openStats(idx) {
      const c = cast[idx];
      if (!c) return;
      picked = idx;
      sheet.hidden = false;
      sheet.replaceChildren();

      const head = mk('spec-picker-title', sheet);
      head.textContent = c.entry.name;
      head.style.color = `#${c.colour.getHexString()}`;

      const L = ledger(W1_SLICE, c.mass, c.eaten, c.sim.workOut, elapsed);
      const v = c.sim.centreOfMass();
      const rowsOut = [
        [t('Bodies'), `${c.plan.bodyCount} · ${c.plan.jointCount} ${t('joints')}`],
        [t('Mass'), `${c.mass.toFixed(2)} g`],
        [t('Radius'), `${c.radius.toFixed(2)} cm`],
        [t('Mouths'), `${c.mouths.length}`],
        [t('Eaten'), `${c.eaten.toFixed(3)} g`],
        [t('Energy in'), `${erg(L.intake)} erg`],
        // A0 — the BILLED half, so this row and 'Balance' below it agree. The
        // absorbed half is real but is energy the water put into the animal.
        [t('Work done'), `${erg(c.sim.workOut)} erg`],
        [t('Basal cost'), `${erg(L.basal)} erg`],
        [t('Balance'), `${erg(L.balance)} erg · ${fmtRatio(L.ratio)}`],
        [t('Depth'), `${v[1].toFixed(1)} cm`],
      ];
      for (const [k, val] of rowsOut) {
        const r = mk('row', sheet);
        mk('row-l', r).textContent = k;
        mk('row-v', r).textContent = val;
      }
      const close = document.createElement('button');
      close.type = 'button'; close.className = 'btn'; close.textContent = t('Close');
      close.addEventListener('click', () => { picked = -1; closeSheet(); paint(); });
      sheet.append(close);
      paint();
    }

    // ── the cast picker ─────────────────────────────────────────────────────
    //
    // THE ATLAS IS THE SOURCE, so the screen has to let you choose from it. It
    // used to silently take the first six keys, which meant a player with a full
    // Atlas had no way to say who swims.
    let atlas = [];                     // [{ key, genome, name, thumb }]
    let chosen = new Set();             // keys

    async function openPicker() {
      sheet.hidden = false;
      sheet.replaceChildren();
      const title = mk('spec-picker-title', sheet);
      title.textContent = `${t('Choose up to')} ${CAST_MAX} ${t('to forage')}`;

      if (!atlas.length) {
        const empty = mk('spec-empty', sheet, 'p');
        empty.textContent = t('No saved creatures yet. In the Tank, long-press a creature and tap Save to keep it here.');
      } else {
        const list = mk('spec-picker-list', sheet);
        for (const a of atlas) {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'spec-picker-item';
          item.dataset.on = chosen.has(a.key) ? 'yes' : 'no';
          const img = document.createElement('img');
          img.className = 'spec-picker-thumb'; img.alt = '';
          if (a.thumb) img.src = a.thumb;
          const name = document.createElement('span');
          name.className = 'spec-picker-name'; name.textContent = a.name;
          const tick = document.createElement('span');
          tick.className = 'forage-tick';
          item.append(img, name, tick);
          item.addEventListener('click', () => {
            if (chosen.has(a.key)) chosen.delete(a.key);
            else if (chosen.size < CAST_MAX) chosen.add(a.key);
            item.dataset.on = chosen.has(a.key) ? 'yes' : 'no';
            go.textContent = `${t('Release')} ${chosen.size || CAST_MAX}`;
          });
          list.append(item);
        }
      }

      const go = document.createElement('button');
      go.type = 'button'; go.className = 'btn';
      go.textContent = `${t('Release')} ${chosen.size || CAST_MAX}`;
      go.addEventListener('click', () => {
        closeSheet();
        const picks = chosen.size
          ? atlas.filter((a) => chosen.has(a.key))
          : atlas.slice(0, CAST_MAX);
        spawn(picks.length ? picks : lastCast);
      });
      sheet.append(go);

      const cancel = document.createElement('button');
      cancel.type = 'button'; cancel.className = 'btn'; cancel.textContent = t('Cancel');
      cancel.addEventListener('click', closeSheet);
      sheet.append(cancel);
    }

    // ── controls ────────────────────────────────────────────────────────────
    const chip = (label, onClick) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tank-chip'; b.textContent = label;
      b.addEventListener('click', onClick);
      return b;
    };

    /**
     * LAYERS. Both of these are evidence, and both get in the way of the other
     * thing you might be looking at: 1400 food dots hide the trails, and six
     * never-forgetting trails eventually hide the food they were drawn on. They
     * are also the two answers to different questions — "where has it been" and
     * "what is left" — so which one is on IS the question you are asking.
     *
     * They stay on by default: the screen exists to show foraging, and a player
     * who has not touched a toggle should see it.
     */
    const show = { trails: true, food: true };
    const toggle = (key, label) => {
      const b = chip(label, () => { show[key] = !show[key]; applyLayers(); });
      b.dataset.on = 'yes';
      return b;
    };
    function applyLayers() {
      invalidate();
      if (points) points.visible = show.food;
      for (const c of cast) c.trail.visible = show.trails;
      for (const b of cluster.children) {
        if (b.dataset.layer) b.dataset.on = show[b.dataset.layer] ? 'yes' : 'no';
      }
    }

    const chipSpeed = chip(`${speed}×`, () => {
      speed = FORAGE_SPEEDS[(FORAGE_SPEEDS.indexOf(speed) + 1) % FORAGE_SPEEDS.length];
      capped = false;
      paint();
    });

    // THE HABITAT CONTROL. Segments, not a chip: it selects the experiment.
    for (const h of HABITATS) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'forage-seg'; b.textContent = t(h.label);
      b.dataset.on = h.id === habitat ? 'yes' : 'no';
      b.dataset.habitat = h.id;
      b.addEventListener('click', () => {
        if (habitat === h.id) return;
        habitat = h.id;
        for (const q of habitatEl.children) q.dataset.on = q.dataset.habitat === habitat ? 'yes' : 'no';
        pan.set(0, 0, 0);
        spawn(lastCast);              // a habitat change is a NEW TRIAL, not a view
      });
      habitatEl.append(b);
    }

    let lastCast = [];
    const chipTrails = toggle('trails', t('Trails'));
    const chipFood = toggle('food', t('Food'));
    chipTrails.dataset.layer = 'trails';
    chipFood.dataset.layer = 'food';
    cluster.append(
      chip(t('Cast'), openPicker),
      chipTrails,
      chipFood,
      chipSpeed,
      chip(t('Reset'), () => { pan.set(0, 0, 0); spawn(lastCast); }),
    );
    primary.addEventListener('click', () => { running = !running; paint(); });

    // ── camera: orbit, pan, pinch, and tap-to-select ────────────────────────
    const orbit = { yaw: 0.6, pitch: 0.12, dist: Math.max(...HABITAT) * 1.4 };
    const pan = new THREE.Vector3();
    const pointers = new Map();
    let drag = null, panning = false, pinch = null, moved = false, longPress = 0;

    /**
     * ONE GESTURE, THREE STATES: tap to select, tap again for the details, tap
     * once more to let it go.
     *
     * The tank puts the sheet behind a 400 ms long-press, and copying that
     * wholesale hid the details: a long-press is a natural phone gesture and an
     * unnatural mouse one, so on desktop the stats simply stopped being
     * reachable. This keeps the tank's tap-selects rule — the thing that was
     * actually wrong before was the sheet firing on the FIRST tap, over an
     * unselected creature, with nothing to say which one you had chosen — while
     * putting the details back one tap away. The long-press still works, so the
     * phone gesture is unchanged.
     *
     * A cycle rather than a toggle because every state has to be exitable with
     * the same finger: select -> details -> release -> select.
     */
    function toggleSelect(k) {
      if (k < 0) return;
      if (!selected.has(k)) { selected.add(k); paint(); return; }
      if (picked !== k || sheet.hidden) { openStats(k); return; }   // 2nd tap: details
      selected.delete(k); picked = -1; closeSheet(); paint();       // 3rd tap: release
    }

    /**
     * Give any DOM element the creature gesture: tap selects, long-press opens
     * the sheet. `indexOf` is a thunk because a row's index moves when the cast
     * is re-spawned, and binding the index itself would go stale.
     */
    function bindSelect(el, indexOf) {
      let at = 0, held = 0, slid = false, x0 = 0, y0 = 0;
      el.addEventListener('pointerdown', (e) => {
        at = performance.now(); slid = false; x0 = e.clientX; y0 = e.clientY;
        clearTimeout(held);
        held = setTimeout(() => { if (!slid) { at = 0; openStats(indexOf()); } }, TAP.longPressMs);
      });
      el.addEventListener('pointermove', (e) => {
        if (Math.hypot(e.clientX - x0, e.clientY - y0) > TAP.maxMovePx) { slid = true; clearTimeout(held); }
      });
      const up = (e) => {
        clearTimeout(held);
        if (!at || slid) return;
        const kind = classifyPointer({ dx: e.clientX - x0, dy: e.clientY - y0, ms: performance.now() - at });
        if (kind === 'tap') toggleSelect(indexOf());
        at = 0;
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', () => { clearTimeout(held); at = 0; });
    }

    /**
     * Ring upkeep, every frame — NOT only on sim steps. The ring is billboarded,
     * so it has to be re-aimed whenever the CAMERA moves, and the camera moves
     * while the sim is paused. Tying this to `steps` would freeze the rings
     * edge-on the moment you paused and orbited.
     */
    function syncRings() {
      // THE TRAIL IS THE POINT OF THIS SCREEN, so selecting a creature has to
      // select its HISTORY, not just its body. Six never-forgetting trails
      // eventually overlap into one scribble and the per-creature colour stops
      // being enough to follow a single animal through it.
      //
      // Dimming the others rather than only brightening the chosen one: against
      // six dense trails, "slightly brighter" is invisible. The unselected stay
      // present — they are the comparison, and hiding them would answer a
      // different question than the one you asked by tapping.
      const anySel = selected.size > 0;
      cast.forEach((c, k) => {
        const on = selected.has(k);
        c.trail.material.opacity = tokenNumber(!anySel ? '--forage-trail-opacity'
          : on ? '--forage-trail-opacity-hi' : '--forage-trail-opacity-lo');
        c.ring.visible = on;
        if (!on) return;
        const rad = selectRadius(camera.position.distanceTo(c.world));
        c.ring.scale.set(rad, rad, rad);
        c.ring.position.copy(c.world);
        c.ring.quaternion.copy(camera.quaternion);
      });
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
      // PANNING WORKS IN BOTH HABITATS. It was disabled in the ocean on the theory
      // that a pan offset and a follow target would fight every frame. They do not
      // — they only fight if the pan writes to the same vector the follow writes
      // to. Keeping the manual displacement in its OWN vector and adding it to the
      // follow target lets you look around while still being carried along, which
      // is what a camera following a fish should do. Taking panning away was the
      // wrong fix for a problem that did not need one.
      invalidate();
      const scale = orbit.dist * 0.0022;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      const target = habitat === 'ocean' ? panOffset : pan;
      target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    };

    /**
     * Put the camera where the orbit says it is. Extracted from `frame()` because
     * `pick()` RAYCASTS FROM IT: if the first gesture arrives before the first
     * animation frame, the camera is still at its constructor default at the
     * origin and every hit test is nonsense. Same defect class as posing the cast
     * at spawn — anything the pointer path reads must be valid before rAF runs.
     */
    /**
     * IN THE OCEAN THE CAMERA FOLLOWS. There is no box to frame, and a fixed view
     * loses the cast within a minute — measured, a creature travels ~115 cm in an
     * hour, several times the aquarium's whole width.
     *
     * It follows the SELECTED creature when there is one and the cast's centroid
     * otherwise, so tapping an animal is also how you choose what to watch. Orbit
     * and zoom stay manual; only the centre is taken over, and manual pan is
     * ignored in the ocean because a pan offset and a follow target fight each
     * other every frame. Smoothed per REAL second, so it does not snap and does
     * not change behaviour with frame rate.
     */
    const followTarget = new THREE.Vector3();
    /** Manual displacement from the follow target. Ocean only; reset on respawn. */
    const panOffset = new THREE.Vector3();
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

    function placeCamera() {
      const cp = Math.cos(orbit.pitch), sp = Math.sin(orbit.pitch);
      camera.position.set(
        pan.x + Math.sin(orbit.yaw) * cp * orbit.dist,
        pan.y + sp * orbit.dist,
        pan.z + Math.cos(orbit.yaw) * cp * orbit.dist);
      camera.lookAt(pan);
      camera.updateMatrixWorld();
    }

    /**
     * THE SELECTION RADIUS — a constant number of SCREEN pixels, the same for
     * every creature, and the same number for the ring and the hit test.
     *
     * It deliberately ignores `boundingRadius`, which is what the tank uses. That
     * rule is right for the tank, where creatures sit in their own grid cells and
     * cannot overlap; here they share one tank and crowd each other, and a
     * creature with long tentacles has a bounding radius most of a screen wide.
     * Its ring then covers its neighbours and — worse, because pick() used the
     * same radius — its hit sphere SWALLOWED them: tapping the small animal in
     * front of a big one selected the big one. Size-invariant fixes both, and it
     * makes selection exactly fair, which is the property the tank's tap-size
     * floor was reaching for in the first place.
     *
     * `hitRadius(0, ...)` is that floor with nothing to beat it, so this is the
     * project's one hit-testing rule reused, not a second one invented here.
     */
    function selectRadius(dist) {
      return hitRadius(0, dist, (camera.fov * Math.PI) / 180,
        view.getBoundingClientRect().height, tokenNumber('--forage-select-px'));
    }

    /** Nearest creature to a screen point, within a finger-sized radius. */
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function pick(cx, cy) {
      const r = view.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      let best = -1, bestD = Infinity;
      cast.forEach((c, k) => {
        // EVERY CREATURE IS THE SAME SIZE TO THE FINGER, and it is the size the
        // ring draws — so what you see is exactly what you can hit.
        const hit = selectRadius(camera.position.distanceTo(c.world));
        const to = c.world.clone().sub(raycaster.ray.origin);
        const along = to.dot(raycaster.ray.direction);
        if (along <= 0) return;
        const perp = Math.sqrt(Math.max(0, to.lengthSq() - along * along));
        if (perp < hit && along < bestD) { bestD = along; best = k; }
      });
      return best;
    }

    view.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Capture is a CONVENIENCE — it keeps the drag alive if the finger leaves
      // the canvas — and it must never be able to abort the handler. It throws
      // NotFoundError for any pointer id the browser is not already tracking,
      // and it sits ABOVE the lines that initialise the gesture, so a throw here
      // left `drag`/`down` unset and every subsequent tap silently did nothing.
      try { view.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
      if (pointers.size === 2) { drag = null; pinch = { d: span(), dist: orbit.dist, c: centroid() }; return; }
      panning = e.button === 1 || e.button === 2 || e.shiftKey;
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, at: performance.now() };
      moved = false;
      // Arm the long press only if the finger actually went down on a creature —
      // otherwise resting a finger on open water would throw up a sheet.
      clearTimeout(longPress);
      if (!panning && pick(e.clientX, e.clientY) >= 0) {
        longPress = setTimeout(() => {
          if (drag && !moved) { const k = pick(drag.x, drag.y); drag = null; if (k >= 0) openStats(k); }
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
      // TAP TOGGLES THE RING; the sheet is the long press. This is tank.js:691
      // verbatim in behaviour — the sheet used to fire on tap here, which is why
      // selecting anything meant dismissing a modal first.
      if (classifyPointer({ dx: e.clientX - at.x0, dy: e.clientY - at.y0, ms: performance.now() - at.at }) !== 'tap') return;
      const k = pick(at.x, at.y);
      if (k >= 0) toggleSelect(k);
      else { selected.clear(); if (picked >= 0) { picked = -1; closeSheet(); } paint(); }
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
      // (flesh, organ, membrane). Same rule as tank.js syncPoses.
      for (const m of c.group.children) {
        const p = c.pose[m.userData.bodyIndex];
        if (!p) continue;
        m.position.set(p.p[0], p.p[1], p.p[2]);
        m.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);
      }
      const com = c.sim.centreOfMass();
      c.world.set(com[0], com[1], com[2]);
    }

    /**
     * Append the MOUTH's position to the trail, four times a second, FOREVER.
     *
     * The mouth, not the centre of mass: the trail shows where the creature could
     * have EATEN, and on a long animal those differ by most of a body length.
     * The buffer doubles rather than sliding — see TRAIL_START.
     */
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

    function frame(nowMs) {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.25, (nowMs - last) / 1000) : 0;
      last = nowMs;

      // Nothing is moving and nothing was touched: skip the whole draw. The rAF
      // itself is free; it is the render that costs.
      if (!running && !dirty && nowMs - lastDraw < 1000 / IDLE_FPS) return;
      lastDraw = nowMs; dirty = false;

      if (running && arena && cast.length) {
        const { steps, carry, dropped } = stepBudget(acc + dt * speed, FIXED_DT);
        acc = carry;
        capped = dropped;
        // Measured over a one-second wall window, not per frame: a per-frame
        // ratio is pure jitter and the chip would flicker through a decade.
        achWall += dt; achSim += steps * FIXED_DT;
        if (achWall >= 1) { achieved = achSim / achWall; achWall = 0; achSim = 0; }
        const rate = W1_SLICE.INGEST_RATE ?? INGEST_RATE;
        // A burst creature is not stepped at all. Leaving it in would let its
        // fragments keep colliding with the survivors and take them with it.
        const sims = cast.filter((c) => !c.burst).map((c) => c.sim);
        for (let s = 0; s < steps; s++) {
          // MATERIALISE FIRST. In the ocean the food does not exist until a mouth
          // is near it, so the field must be extended BEFORE the step that would
          // eat from it — otherwise a creature swims through water that is empty
          // only because nobody asked for it yet.
          if (food.ensureAround) {
            for (const c of cast) food.ensureAround(mouthPoints(c.sim, c.plan, c.mouths, c.mouthBuf));
          }
          // ALL occupants push, THEN one solve. Stepping each creature to
          // completion in turn would let the first mover see a world the others
          // had not yet pushed on, and the result would depend on cast order.
          arena.stepAll(sims);
          for (const c of cast) {
            if (c.burst) continue;         // a corpse neither eats nor is measured
            c.eaten += forageStep(c.sim, c.plan, food, c.mouths, FIXED_DT, rate, c.mouthBuf);
          }
          elapsed += FIXED_DT;
        }
        // STRUCTURAL CHECK, once per frame rather than once per step: the burst is
        // a single-step event but nothing is gained by noticing it 240 times a
        // second, and integrity() walks every body.
        for (const c of cast) {
          if (c.burst || c.sim.integrity().spread <= BURST_SPREAD) continue;
          c.burst = true;
          // FROZEN, NOT REMOVED. Deleting it would erase its trail and its ledger
          // — the evidence of what happened — and the trail is the most useful
          // thing on this screen. It stops being stepped, stops eating, and says
          // so in its row.
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
            const pts = mouthPoints(c.sim, c.plan, c.mouths, c.mouthBuf);
            if (pts[0]) c.mouthMark.position.set(pts[0][0], pts[0][1], pts[0][2]);
            pushTrail(c);
          }
        }
      }

      updateWater(water, nowMs / 1000);
      followCast(dt);
      placeCamera();
      syncRings();
      renderer.render(scene, camera);
      renderOverlay(renderer, water);

      if (nowMs - painted > 150) { paint(); painted = nowMs; }
    }

    function resize() {
      const w = view.clientWidth, h = view.clientHeight;
      if (!w || !h) return;
      invalidate();
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(view);
    resize();

    // ── boot ────────────────────────────────────────────────────────────────
    // RAPIER.init() is async and 01 §4 forbids async inside /engine/, so the
    // screen awaits it once and hands the namespace down — same pattern as
    // ui/screens/tank.js. Touching RAPIER before it resolves throws inside the
    // wasm glue, which is a boot failure rather than a caught error.
    titleEl.textContent = t('Loading…');
    raf = requestAnimationFrame(frame);

    async function loadAtlas() {
      try {
        await seedAtlas();
        const keys = await store.list('specimen:');
        const out = [];
        for (const key of keys) {
          try {
            const spec = await store.get(key);
            if (!spec?.genome) continue;
            out.push({
              key,
              genome: spec.genome,
              name: spec.commonName || spec.binomial || t('Creature'),
              thumb: spec.thumb,
            });
          } catch { /* skip a record from a future build rather than failing */ }
        }
        if (out.length) return out;
      } catch { /* fall through */ }
      // No store at all: a seeded population stands in rather than an empty tank
      // with no explanation.
      return seedPopulation({
        RAPIER, rng: rngFrom('forage', 'pop'), world: W1_SLICE,
        population: CAST_MAX, authoredSlots: 2,
      }).genomes.map((genome, i) => {
        let name = `${t('Creature')} ${i + 1}`;
        try { name = binomial(morphogenesis(genome), genome).binomial; } catch { /* keep the fallback */ }
        return { key: `seed:${i}`, genome, name, thumb: null };
      });
    }

    (async () => {
      await RAPIER.init();
      if (stopped) return;
      atlas = await loadAtlas();
      if (stopped) return;
      lastCast = atlas.slice(0, CAST_MAX);
      spawn(lastCast);
    })();

    // `{ stop }`, NOT a bare function, because that is the shape trunk/nav.js
    // hands back to `unmount(instance)` and the shape tank.js already uses. This
    // screen used to return the function itself AND declare no `unmount`, so
    // nav had nothing to call: leaving the tab tore down the DOM and left the
    // rAF loop, six Rapier simulations and a live WebGL context running forever,
    // rendering into a detached canvas. Every revisit started another one.
    return {
      stop() {
        stopped = true;
        cancelAnimationFrame(raf);
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
