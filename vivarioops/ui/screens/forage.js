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
  makeFood, mouthsOf, mouthPoints, forageStep, ledger, INGEST_RATE,
} from '../../engine/l2/forage.js';
import {
  buildCreature, disposeCreature, token, tokenNumber, rampFor, colourFrom,
} from '../../render/creature.js';
import {
  createWater, updateWater, disposeWater, fitAtmosphere, renderOverlay, dotTexture,
} from '../../render/tank.js';
import { W1_SLICE } from '../../worlds/w1_slice.js';
import { stepBudget, hitRadius } from '../tank/sim.js';

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

    let arena = null, food = null, points = null, foodDot = null;
    let cast = [];
    let elapsed = 0, running = true, stopped = false, picked = -1;

    const ramp = rampFor(W1_SLICE.palette);
    const foodColour = new THREE.Color(token('--forage-food'));

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
      const a = points.geometry.getAttribute('color');
      const per = food.perItem || 1;
      food.items.forEach((it, q) => {
        // Brightness carries the remaining mass: an emptied item fades to black,
        // and black adds nothing, so it simply stops existing.
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
        if (c.mouthMark) {
          scene.remove(c.mouthMark);
          c.mouthMark.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
        }
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
      const [W, H] = W1_SLICE.tankBounds;
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      return [Math.cos(a) * (W / 4), Math.sin(a) * (H / 3), 0];
    }

    function spawn(entries) {
      clearCast();
      // ONE arena, shared. This is what makes them rivals rather than six
      // separate experiments — and `stepAll` is the only legal way to step it.
      arena = createArena(RAPIER, W1_SLICE, { bounded: true });
      buildFood();

      const use = entries.slice(0, CAST_MAX);
      use.forEach((entry, i) => {
        const genome = entry.genome;
        let plan, sim;
        try {
          plan = morphogenesis(genome);
          sim = createSimulation(RAPIER, plan, genome, W1_SLICE, {
            arena, wrap: false, origin: spawnRing(use.length, i),
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
        row.addEventListener('click', () => openStats(cast.findIndex((x) => x.row === row)));

        cast.push({
          i, entry, genome, plan, sim, group, mouthMark, trail, colour,
          trailPos, trailN: 0, trailAt: 0, trailCap: TRAIL_START,
          mouths, mouthBuf: mouths.map(() => [0, 0, 0]),
          pose: null, eaten: 0, mass: totalMass(plan),
          radius: boundingRadius(plan),
          world: new THREE.Vector3(),
          row, text,
        });
      });
      elapsed = 0;
      picked = -1;
      fitAtmosphere(water, W1_SLICE.tankBounds);
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
      titleEl.textContent = `${cast.length} ${t('foraging')} · ${fmtTime(elapsed)}`;
      const pctLeft = food.items.length ? (100 * food.eatenCount()) / food.items.length : 0;
      foodEl.textContent = `${t('Food')} ${food.remaining().toFixed(0)} g ${t('of')} ${food.initialTotal}`
        + ` · ${pctLeft.toFixed(0)}% ${t('grazed')}`;
      for (const c of cast) {
        const L = ledger(W1_SLICE, c.mass, c.eaten, c.sim.work, elapsed);
        c.text.textContent = `${c.entry.name}  ${c.eaten.toFixed(2)} g  ${fmtRatio(L.ratio)}`;
        c.row.dataset.state = Number.isFinite(L.ratio) && L.ratio >= 1 ? 'surplus' : 'deficit';
        c.row.dataset.picked = cast[picked] === c ? 'yes' : 'no';
      }
      primary.textContent = running ? t('Pause') : t('Run');
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

      const L = ledger(W1_SLICE, c.mass, c.eaten, c.sim.work, elapsed);
      const v = c.sim.centreOfMass();
      const rowsOut = [
        [t('Bodies'), `${c.plan.bodyCount} · ${c.plan.jointCount} ${t('joints')}`],
        [t('Mass'), `${c.mass.toFixed(2)} g`],
        [t('Radius'), `${c.radius.toFixed(2)} cm`],
        [t('Mouths'), `${c.mouths.length}`],
        [t('Eaten'), `${c.eaten.toFixed(3)} g`],
        [t('Energy in'), `${erg(L.intake)} erg`],
        [t('Work done'), `${erg(c.sim.work)} erg`],
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
    let lastCast = [];
    cluster.append(
      chip(t('Cast'), openPicker),
      chip(t('Reset'), () => { pan.set(0, 0, 0); spawn(lastCast); }),
    );
    primary.addEventListener('click', () => { running = !running; paint(); });

    // ── camera: orbit, pan, pinch, and tap-to-select ────────────────────────
    const orbit = { yaw: 0.6, pitch: 0.12, dist: Math.max(...W1_SLICE.tankBounds) * 1.9 };
    const pan = new THREE.Vector3();
    const pointers = new Map();
    let drag = null, panning = false, pinch = null, moved = false;

    const span = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const centroid = () => {
      const v = [...pointers.values()];
      return { x: v.reduce((s, p) => s + p.x, 0) / v.length, y: v.reduce((s, p) => s + p.y, 0) / v.length };
    };
    const panBy = (dx, dy) => {
      const scale = orbit.dist * 0.0022;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
      pan.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    };

    /** Nearest creature to a screen point, within a finger-sized radius. */
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function pick(cx, cy) {
      const r = view.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const fov = (camera.fov * Math.PI) / 180;
      const tap = tokenNumber('--tapsize');
      let best = -1, bestD = Infinity;
      cast.forEach((c, k) => {
        const d = camera.position.distanceTo(c.world);
        // A SMALL CREATURE IS NEVER HARDER TO SELECT THAN A LARGE ONE — the same
        // rule the tank uses, and it matters more here where they differ 6x.
        const hit = hitRadius(c.radius, d, fov, r.height, tap);
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
      view.setPointerCapture?.(e.pointerId);
      if (pointers.size === 2) { drag = null; pinch = { d: span(), dist: orbit.dist, c: centroid() }; return; }
      panning = e.button === 1 || e.button === 2 || e.shiftKey;
      drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY };
      moved = false;
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
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) moved = true;
      if (panning) panBy(dx, dy);
      else {
        orbit.yaw -= dx * 0.006;
        orbit.pitch = Math.max(-1.2, Math.min(1.2, orbit.pitch + dy * 0.005));
      }
      drag = { ...drag, x: e.clientX, y: e.clientY };
    });
    const endDrag = (e) => {
      const wasSingle = pointers.size === 1 && !panning && !moved && drag;
      const at = drag;
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (pointers.size === 0) { drag = null; panning = false; }
      // A TAP, not a drag: select the creature under the finger, or clear.
      if (wasSingle && at) {
        const k = pick(at.x, at.y);
        if (k >= 0) openStats(k);
        else if (picked >= 0) { picked = -1; closeSheet(); paint(); }
      }
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
