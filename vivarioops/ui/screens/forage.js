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
// compete for the same depleting food.
//
// That changes what the ledger MEANS: from "can this creature feed itself" to
// "can it feed itself against rivals", which is the more interesting question and
// the one that makes a food field worth having. It is still L2 — real bodies,
// real fluid, no compiled records — and it is NOT D1.
//
// The cast comes from the ATLAS, so what you see here is what you kept. Capped,
// because six full-physics creatures plus 1400 food items in one shared world is
// already the frame budget.
//
// What it shows, per creature and deliberately only two numbers:
//   IN   food eaten, converted to energy
//   OUT  mechanical work done, plus the basal cost of existing
// Birth and death are D1. Until then the ledger carries the same information a
// death rule would use, without committing to one before it can be measured.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { t } from '../../trunk/i18n.js';
import { rngFrom } from '../../trunk/rng.js';
import * as store from '../../trunk/store.js';
import { seedAtlas } from '../../worlds/atlas_seed.js';
import { morphogenesis, totalMass } from '../../engine/l1/morphogen.js';
import { createArena, createSimulation, FIXED_DT } from '../../engine/l1/physics.js';
import { seedPopulation } from '../../engine/l1/breed.js';
import { deserialise } from '../../engine/l1/genome.js';
import {
  makeFood, mouthsOf, mouthPoints, forageStep, ledger, INGEST_RATE,
} from '../../engine/l2/forage.js';
import { buildCreature, disposeCreature, token, tokenNumber } from '../../render/creature.js';
import { createWater, updateWater, disposeWater, fitAtmosphere, renderOverlay } from '../../render/tank.js';
import { W1_SLICE } from '../../worlds/w1_slice.js';
import { stepBudget } from '../tank/sim.js';

/**
 * How many creatures share the tank.
 *
 * SIX, matching the Tank's population — not because the physics demands it but
 * because the player already reads six as "the cast". The cap exists for frame
 * budget: every creature is a full Rapier body tree stepped against 1400 food
 * items, and the Atlas can hold arbitrarily many.
 */
const CAST_MAX = 6;

/** Samples per trail. ~2 minutes at 4 Hz — enough to read the space covered. */
const TRAIL_MAX = 480;

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
    const titleEl = mk('tank-gen', left);
    const foodEl = mk('tank-world', left);
    const rows = mk('forage-rows', left);

    const cluster = mk('tank-cluster', wrap);
    const primary = mk('tank-breed', wrap, 'button');
    primary.type = 'button';
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

    let arena = null, food = null, points = null;
    let cast = [];                       // one entry per creature, see spawn()
    let elapsed = 0, running = true, stopped = false;

    const foodColour = new THREE.Color(token('--tank-w1-surface'));
    const trailColour = new THREE.Color(token('--c-on-water-dim'));
    const mouthColour = new THREE.Color(token('--c-stranger'));

    // ── the food ────────────────────────────────────────────────────────────
    // FOOD IS THINGS, so it is drawn at the items' own scattered positions —
    // there is no lattice to read as graph paper. ADDITIVE + vertex colours is
    // what makes eating READ: an emptied item fades to black, and black adds
    // nothing, so it simply stops existing.
    function buildFood() {
      food = makeFood(W1_SLICE);
      const pos = new Float32Array(food.items.length * 3);
      const col = new Float32Array(food.items.length * 3);
      food.items.forEach((it, q) => {
        pos[q * 3] = it.x; pos[q * 3 + 1] = it.y; pos[q * 3 + 2] = it.z;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      points = new THREE.Points(geo, new THREE.PointsMaterial({
        size: tokenNumber('--forage-food-size'), sizeAttenuation: false,
        vertexColors: true, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      scene.add(points);
      paintFood();
    }

    function paintFood() {
      const a = points.geometry.getAttribute('color');
      const per = food.perItem || 1;
      food.items.forEach((it, q) => {
        const v = Math.min(1, it.mass / per);
        a.array[q * 3] = foodColour.r * v;
        a.array[q * 3 + 1] = foodColour.g * v;
        a.array[q * 3 + 2] = foodColour.b * v;
      });
      a.needsUpdate = true;
    }

    // ── the cast ────────────────────────────────────────────────────────────
    function clearCast() {
      for (const c of cast) {
        if (c.group) { scene.remove(c.group); disposeCreature(c.group); }
        if (c.mouthMark) { scene.remove(c.mouthMark); c.mouthMark.geometry.dispose(); c.mouthMark.material.dispose(); }
        if (c.trail) { scene.remove(c.trail); c.trail.geometry.dispose(); c.trail.material.dispose(); }
        if (c.sim) c.sim.free();
      }
      cast = [];
      // The arena owns every body in it, so it goes last and takes them with it.
      if (arena) { arena.free(); arena = null; }
      if (points) { scene.remove(points); points.geometry.dispose(); points.material.dispose(); points = null; }
    }

    /**
     * Spawn positions: a ring in the horizontal plane at a third of the tank.
     *
     * Not the origin for all of them — a shared arena means overlapping spawns
     * resolve as a violent contact, and the run would be measuring that rather
     * than foraging. Not the walls either: `fitsTank` and the wall clamp are both
     * happier away from the boundary.
     */
    function spawnRing(n, i) {
      const R = Math.min(W1_SLICE.tankBounds[0], W1_SLICE.tankBounds[2]) / 3;
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      return [Math.cos(a) * R, 0, Math.sin(a) * R];
    }

    function spawn(genomes) {
      clearCast();
      // ONE arena, shared. This is what makes them rivals rather than six
      // separate experiments — and `stepAll` is the only legal way to step it.
      arena = createArena(RAPIER, W1_SLICE, { bounded: true });
      buildFood();

      genomes.slice(0, CAST_MAX).forEach((genome, i) => {
        let plan, sim;
        try {
          plan = morphogenesis(genome);
          sim = createSimulation(RAPIER, plan, genome, W1_SLICE, {
            arena, wrap: false, origin: spawnRing(Math.min(genomes.length, CAST_MAX), i),
          });
        } catch {
          return;                       // a body that will not build is a verdict
        }
        const group = buildCreature(plan, genome, { worldId: W1_SLICE.palette });
        scene.add(group);

        // THE MOUTH, MADE VISIBLE. Ingestion happens at a point, and a point the
        // player cannot see is a rule they have to take on trust. Drawn at the
        // item radius, so what is shown IS the reach.
        const mouthMark = new THREE.Mesh(
          new THREE.SphereGeometry(food.radius, 12, 8),
          new THREE.MeshBasicMaterial({
            color: mouthColour, transparent: true,
            opacity: tokenNumber('--forage-mouth-opacity'),
            depthWrite: false, blending: THREE.AdditiveBlending,
          }));
        scene.add(mouthMark);

        // THE TRAIL. Without it there is no telling a creature that has quartered
        // the tank from one that has trembled in place — and at 0.04 cm/s those
        // look identical in any single frame.
        const trailPos = new Float32Array(TRAIL_MAX * 3);
        const tg = new THREE.BufferGeometry();
        tg.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
        tg.setDrawRange(0, 0);
        const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({
          color: trailColour, transparent: true,
          opacity: tokenNumber('--forage-trail-opacity'), depthWrite: false,
        }));
        scene.add(trail);

        const mouths = mouthsOf(plan);
        cast.push({
          i, genome, plan, sim, group, mouthMark, trail, trailPos,
          trailN: 0, trailAt: 0,
          mouths, mouthBuf: mouths.map(() => [0, 0, 0]),
          pose: null, eaten: 0, mass: totalMass(plan),
          row: mk('forage-row', rows),
        });
      });
      elapsed = 0;
      fitAtmosphere(water, W1_SLICE.tankBounds);
      paint();
    }

    // ── readout ─────────────────────────────────────────────────────────────
    const erg = (v) => (v >= 1e4 || (v > 0 && v < 1e-2) ? v.toExponential(1) : v.toFixed(1));

    function paint() {
      if (!food) return;
      titleEl.textContent = `${cast.length} ${t('foraging')} · ${elapsed.toFixed(0)} s`;
      foodEl.textContent = `${t('Food')} ${food.eatenCount()}/${food.items.length} ${t('eaten')}`
        + ` · ${food.remaining().toFixed(0)} g ${t('left')}`;
      for (const c of cast) {
        const L = ledger(W1_SLICE, c.mass, c.eaten, c.sim.work, elapsed);
        const r = L.ratio;
        const ok = Number.isFinite(r) && r >= 1;
        c.row.textContent = `${c.i + 1}  ${c.eaten.toFixed(2)} g `
          + `· ${t('in')} ${erg(L.intake)} ${t('out')} ${erg(L.spend)} `
          + `· ${Number.isFinite(r) ? `${r.toFixed(2)}x` : '—'}`;
        c.row.style.color = `var(${ok ? '--c-select' : '--c-on-water-dim'})`;
      }
      primary.textContent = running ? t('Pause') : t('Run');
    }

    // ── controls ────────────────────────────────────────────────────────────
    const chip = (label, onClick) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tank-chip'; b.textContent = label;
      b.addEventListener('click', onClick);
      return b;
    };
    let lastCast = [];
    cluster.append(
      chip(t('Reset'), () => { pan.set(0, 0, 0); rows.replaceChildren(); spawn(lastCast); }),
    );
    primary.addEventListener('click', () => { running = !running; paint(); });

    // ── camera: orbit, pan, pinch ───────────────────────────────────────────
    const orbit = { yaw: 0.6, pitch: 0.25, dist: Math.max(...W1_SLICE.tankBounds) * 1.9 };
    const pan = new THREE.Vector3();
    const pointers = new Map();
    let drag = null, panning = false, pinch = null;

    const span = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const centroid = () => {
      const v = [...pointers.values()];
      return { x: v.reduce((s, p) => s + p.x, 0) / v.length, y: v.reduce((s, p) => s + p.y, 0) / v.length };
    };
    /** Move `pan` in the CAMERA's own plane, so a drag goes where the finger goes. */
    const panBy = (dx, dy) => {
      const scale = orbit.dist * 0.0022;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      pan.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    };

    view.addEventListener('pointerdown', (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      view.setPointerCapture?.(e.pointerId);
      if (pointers.size === 2) { drag = null; pinch = { d: span(), dist: orbit.dist, c: centroid() }; return; }
      panning = e.button === 1 || e.button === 2 || e.shiftKey;
      drag = { x: e.clientX, y: e.clientY };
    });
    view.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinch) {
        const d = span();
        if (pinch.d > 0) orbit.dist = Math.max(8, Math.min(400, pinch.dist * (pinch.d / d)));
        const c = centroid();
        panBy(c.x - pinch.c.x, c.y - pinch.c.y);
        pinch.c = c;
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (panning) panBy(dx, dy);
      else {
        orbit.yaw -= dx * 0.006;
        orbit.pitch = Math.max(-1.2, Math.min(1.2, orbit.pitch + dy * 0.005));
      }
      drag = { x: e.clientX, y: e.clientY };
    });
    const endDrag = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) { drag = null; panning = false; }
    };
    view.addEventListener('pointerup', endDrag);
    view.addEventListener('pointercancel', endDrag);
    view.addEventListener('contextmenu', (e) => e.preventDefault());
    view.addEventListener('wheel', (e) => {
      e.preventDefault();
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
    }

    /**
     * Append the MOUTH's position to the trail, at most four times a second.
     *
     * The mouth, not the centre of mass: the trail shows where the creature could
     * have EATEN, and on a long animal those differ by most of a body length.
     * Once full it slides — a ring buffer would need two draw ranges or a
     * degenerate segment joining the ends, and a memmove of 480 floats four times
     * a second is free.
     */
    function pushTrail(c) {
      if (elapsed - c.trailAt < 0.25) return;
      c.trailAt = elapsed;
      const p = c.mouthBuf[0];
      if (!p) return;
      if (c.trailN >= TRAIL_MAX) { c.trailPos.copyWithin(0, 3); c.trailN = TRAIL_MAX - 1; }
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

      if (running && arena && cast.length) {
        const { steps, carry } = stepBudget(acc + dt, FIXED_DT);
        acc = carry;
        const rate = W1_SLICE.INGEST_RATE ?? INGEST_RATE;
        const sims = cast.map((c) => c.sim);
        for (let s = 0; s < steps; s++) {
          // ALL occupants push, THEN one solve. Stepping each creature to
          // completion in turn would let the first mover see a world the others
          // had not yet pushed on, and the result would depend on cast order.
          arena.stepAll(sims);
          for (const c of cast) {
            c.eaten += forageStep(c.sim, c.plan, food, c.mouths, FIXED_DT, rate, c.mouthBuf);
          }
          elapsed += FIXED_DT;
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
      const cp = Math.cos(orbit.pitch), sp = Math.sin(orbit.pitch);
      camera.position.set(
        pan.x + Math.sin(orbit.yaw) * cp * orbit.dist,
        pan.y + sp * orbit.dist,
        pan.z + Math.cos(orbit.yaw) * cp * orbit.dist);
      camera.lookAt(pan);
      camera.updateMatrixWorld();
      renderer.render(scene, camera);
      renderOverlay(renderer, water);

      if (nowMs - painted > 150) { paint(); painted = nowMs; }
    }

    function resize() {
      const w = view.clientWidth, h = view.clientHeight;
      if (!w || !h) return;
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

    /**
     * THE CAST COMES FROM THE ATLAS — what the player kept, not a fresh draw.
     * `seedAtlas()` plants the authored library on first run, exactly as the
     * Atlas screen does, so this is never empty on a clean profile. If the store
     * is unavailable at all, a seeded population stands in rather than showing an
     * empty tank with no explanation.
     */
    async function loadCast() {
      try {
        await seedAtlas();
        const keys = await store.list('specimen:');
        const out = [];
        for (const key of keys.slice(0, CAST_MAX)) {
          try {
            const spec = await store.get(key);
            if (!spec?.genome) continue;
            out.push(typeof spec.genome === 'string' ? deserialise(spec.genome) : spec.genome);
          } catch { /* skip a record from a future build rather than failing the page */ }
        }
        if (out.length) return out;
      } catch { /* fall through */ }
      return seedPopulation({
        RAPIER, rng: rngFrom('forage', 'pop'), world: W1_SLICE,
        population: CAST_MAX, authoredSlots: 2,
      }).genomes;
    }

    (async () => {
      await RAPIER.init();
      if (stopped) return;
      lastCast = await loadCast();
      if (stopped) return;
      spawn(lastCast);
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      clearCast();
      disposeWater(water);
      renderer.dispose();
    };
  },
};
