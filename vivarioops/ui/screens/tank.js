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
import { rngFrom } from '../../trunk/rng.js';
import { morphogenesis, totalMass, boundingRadius } from '../../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../../engine/l1/physics.js';
import { seedPopulation, breed, POPULATION, KIND } from '../../engine/l1/breed.js';
import { buildCreature, disposeCreature, token } from '../../render/creature.js';
import { W1_SLICE } from '../../worlds/w1_slice.js';
import { button } from '../widgets.js';
import {
  cellCentres, unionBounds, stepBudget, hitRadius, classifyPointer, gridFor,
  frameDistance, smoothSpeed, horizontalSpeed, nextSpeed, STATE, BREEDING_MS, TAP,
} from '../tank/sim.js';

/** A token that is a length, as a number. N16 forbids the literal; this reads it. */
const tokenPx = (name) => parseFloat(token(name));

export default {
  title: t('Tank'),

  mount(el) {
    // ── chrome ──────────────────────────────────────────────────────────────
    const wrap = document.createElement('div');
    wrap.className = 'tank';
    const view = document.createElement('div');
    view.className = 'tank-view';
    const labels = document.createElement('div');
    labels.className = 'tank-labels';
    view.append(labels);
    const status = document.createElement('div');
    status.className = 'tank-status';
    const controls = document.createElement('div');
    controls.className = 'tank-controls';
    const primary = document.createElement('div');
    primary.className = 'tank-primary';
    wrap.append(view, status, controls, primary);
    el.append(wrap);

    const sheet = document.createElement('div');
    sheet.className = 'tank-sheet';
    sheet.hidden = true;
    view.append(sheet);

    // ── scene ───────────────────────────────────────────────────────────────
    const bg = new THREE.Color(token('--c-bg'));
    const scene = new THREE.Scene();
    scene.background = bg;

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    view.prepend(renderer.domElement);

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 8, 3);
    scene.add(key);
    scene.add(new THREE.HemisphereLight(
      new THREE.Color(token('--c-accent')), new THREE.Color(token('--c-surface')), 0.5));

    // The wireframe is the UNION of the six real tanks (see ui/tank/sim.js), so
    // what is drawn is a true statement about where creatures can go. Both the
    // grid and the box follow the window: see gridFor().
    let grid = gridFor(1);
    let cells = cellCentres(W1_SLICE.tankBounds, grid);
    let union = unionBounds(W1_SLICE.tankBounds, grid);

    const boundsMat = new THREE.LineBasicMaterial({ color: new THREE.Color(token('--c-line')) });
    let bounds = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...union)), boundsMat);
    scene.add(bounds);
    scene.fog = new THREE.Fog(bg, union[0] * 0.5, union[0] * 2.5);

    function relayout(aspect) {
      const next = gridFor(aspect);
      if (next.cols === grid.cols && next.rows === grid.rows) return false;
      grid = next;
      cells = cellCentres(W1_SLICE.tankBounds, grid);
      union = unionBounds(W1_SLICE.tankBounds, grid);
      scene.remove(bounds);
      bounds.geometry.dispose();
      bounds = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...union)), boundsMat);
      scene.add(bounds);
      scene.fog.near = union[0] * 0.5;
      scene.fog.far = Math.max(union[0], union[2]) * 2.5;
      for (const s of slots) s.group.position.set(cells[s.index][0], cells[s.index][1], cells[s.index][2]);
      return true;
    }

    // ── state ───────────────────────────────────────────────────────────────
    let state = STATE.LOADING;
    let generation = 0;
    let genomes = [], provenance = [], slots = [];
    let previous = null;            // one-step undo: 21 §4.3
    let selected = new Set();
    let speed = 1, paused = false;
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
        disposeCreature(s.group);
        s.label.remove();
      }
      slots = [];
    }

    function buildSlots() {
      disposeSlots();
      slots = genomes.map((genome, i) => {
        const plan = morphogenesis(genome);
        const sim = createSimulation(RAPIER, plan, genome, W1_SLICE);
        const group = buildCreature(plan, genome);
        const pivot = new THREE.Group();
        pivot.position.set(cells[i][0], cells[i][1], cells[i][2]);
        pivot.add(group);
        scene.add(pivot);

        const label = document.createElement('div');
        label.className = 'tank-label';
        labels.append(label);

        // The selection ring is a world-space circle facing the camera, so it
        // stays legible at any zoom and does not need a shader.
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.92, 1, 40),
          new THREE.MeshBasicMaterial({ color: new THREE.Color(token('--c-select')), transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
        ring.visible = false;
        pivot.add(ring);

        return {
          index: i, genome, plan, sim, group: pivot, mesh: group, label, ring,
          radius: boundingRadius(plan),
          mass: totalMass(plan),
          pose: sim.readPose(),
          speed: 0,
          world: new THREE.Vector3(),
        };
      });
    }

    // ── the loop ────────────────────────────────────────────────────────────

    function stepPhysics(dtMs) {
      if (paused || state === STATE.BREEDING) return;
      accumulator += (dtMs / 1000) * speed;
      const { steps, carry } = stepBudget(accumulator, FIXED_DT);
      accumulator = carry;
      for (let n = 0; n < steps; n++) for (const s of slots) s.sim.step();
    }

    let lastDt = 0;

    function syncPoses() {
      for (const s of slots) {
        s.sim.readPose(s.pose);
        const meshes = s.mesh.children;
        for (let i = 0; i < meshes.length && i < s.pose.length; i++) {
          const p = s.pose[i], m = meshes[i];
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
      }
    }

    function placeCamera() {
      const r = orbit.dist;
      camera.position.set(
        r * Math.sin(orbit.phi) * Math.sin(orbit.theta),
        r * Math.cos(orbit.phi),
        r * Math.sin(orbit.phi) * Math.cos(orbit.theta));
      camera.lookAt(0, 0, 0);
    }

    const projected = new THREE.Vector3();

    function syncOverlay() {
      const w = view.clientWidth, h = view.clientHeight;
      for (const s of slots) {
        projected.copy(s.world).project(camera);
        const x = (projected.x * 0.5 + 0.5) * w;
        const y = (-projected.y * 0.5 + 0.5) * h;
        const visible = projected.z < 1;
        s.label.hidden = !visible;
        if (visible) {
          s.label.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
          s.label.textContent = `${s.speed.toFixed(1)}`;
        }
        s.label.dataset.kind = provenance[s.index]?.kind ?? KIND.STRANGER;
        s.label.dataset.selected = selected.has(s.index) ? 'yes' : 'no';

        // The stranger is marked only once there IS a lineage to be unrelated to.
        // On first run every creature is a stranger and six warning rings say
        // nothing.
        const isStranger = generation > 0 && provenance[s.index]?.kind === KIND.STRANGER;
        s.ring.visible = selected.has(s.index) || isStranger;
        if (s.ring.visible) {
          const rad = Math.max(s.radius * 1.4, 1);
          s.ring.scale.set(rad, rad, rad);
          s.ring.position.copy(s.world).sub(s.group.position);
          s.ring.quaternion.copy(camera.quaternion);
          // N17's slot is marked differently, or it reads as a bug (21 §4.4).
          s.ring.material.color.set(
            selected.has(s.index) ? token('--c-select') : token('--c-stranger'));
          s.ring.material.opacity = selected.has(s.index) ? 0.9 : 0.45;
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
      lastDt = (paused || state === STATE.BREEDING) ? 0 : dt / 1000;

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
      if (!ready || state === STATE.BREEDING) return;
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
    }

    // ── specimen sheet ──────────────────────────────────────────────────────
    // 10 §8 keeps naming to "function only, no UI" in the slice, so the derived
    // binomial is deliberately NOT shown here. `binomial()` exists and this is
    // the one line it would take; that is a step-F decision, not a silent one.

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
        [t('Origin'), t(provenance[s.index]?.kind ?? KIND.STRANGER)],
      ];
      for (const [l, v] of rows) {
        const r = document.createElement('div');
        r.className = 'row';
        const a = document.createElement('span'); a.className = 'row-l'; a.textContent = l;
        const b = document.createElement('span'); b.className = 'row-v'; b.textContent = v;
        r.append(a, b);
        sheet.append(r);
      }
      sheet.append(button(t('Close'), closeSheet));
    }

    function closeSheet() {
      sheet.hidden = true;
      state = paused ? STATE.PAUSED : STATE.SIMULATING;
      renderStatus();
    }

    // ── controls ────────────────────────────────────────────────────────────

    const btnPause = button(t('Pause'), () => {
      paused = !paused;
      state = paused ? STATE.PAUSED : STATE.SIMULATING;
      accumulator = 0;
      renderStatus();
    });
    const btnSpeed = button(t('Speed 1x'), () => { speed = nextSpeed(speed); renderStatus(); });
    const btnUndo = button(t('Undo'), () => {
      if (!previous) return;
      genomes = previous.genomes;
      provenance = previous.provenance;
      generation = previous.generation;
      selected = new Set(previous.selected);
      previous = null;
      buildSlots();
      renderStatus();
    });
    const btnBreed = button(t('Breed'), doBreed);
    btnBreed.classList.add('primary');
    controls.append(btnPause, btnSpeed, btnUndo);
    primary.append(btnBreed);

    function doBreed() {
      if (!ready || selected.size === 0 || state === STATE.BREEDING) return;

      // One-step undo, kept BEFORE the breed. 21 §4.3: "restore previous
      // generation's genomes, re-instantiate from t=0". Cheap, and it removes
      // all anxiety from experimenting.
      previous = { genomes, provenance, generation, selected: [...selected] };

      const r = breed({
        RAPIER, genomes,
        selected: [...selected],
        rng: rngFrom('tank', 'breed', generation),
        world: W1_SLICE,
      });
      genomes = r.genomes;
      provenance = r.provenance;
      generation++;
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
    }

    function renderStatus(droppedElite) {
      btnSpeed.textContent = `${t('Speed')} ${speed}x`;
      btnSpeed.disabled = paused;
      btnPause.textContent = paused ? t('Play') : t('Pause');
      btnUndo.disabled = !previous;
      btnBreed.disabled = !ready || selected.size === 0;

      const parts = [
        `${t('Gen')} ${generation}`,
        `${selected.size}/${POPULATION}`,
      ];
      if (droppedElite != null) {
        // N17 beats N18 at six selections, and the player is told which one went.
        parts.push(t('stranger slot took one'));
      }
      status.textContent = parts.join('  ·  ');
    }

    // ── boot ────────────────────────────────────────────────────────────────
    // RAPIER.init() is async and 01 §4 forbids async inside /engine/, so the
    // screen awaits it once and hands the namespace down. Until then the tank
    // is LOADING and every control is inert.

    status.textContent = t('Loading…');
    renderStatus();

    (async () => {
      await RAPIER.init();
      if (stopped) return;
      // 21 §4.6: first run auto-creates a lineage.
      const seeded = seedPopulation({ RAPIER, rng: rngFrom('tank', 'seed'), world: W1_SLICE });
      genomes = seeded.genomes;
      provenance = seeded.provenance;
      buildSlots();
      ready = true;
      state = STATE.SIMULATING;
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
        renderer.dispose();
      },
    };
  },

  unmount(instance) { instance?.stop?.(); },
};
