// render/creature.js — BodyPlan -> three.js group.
//
// 10 §A10: capsules and ellipsoids only. NO BOXES IN THE RENDER even though the
// physics proxy is a box. Boxes read as furniture; capsules read as flesh.
//
// N16: no hex colours and no raw pixel values. Colours come from genes indexed
// into the world's ramp, which lives in tokens.css. Nothing here is authored per
// creature: the genome picks the stop, the pattern, the layer weights and whether
// the animal glows. P1 holds — we author presentation, never an instance.
//
// Layer stack, outside in:
//   membrane  transmissive shell, x1.13 radius        -> reads as wet
//   flesh     generated colour/roughness/bump maps    -> the only patterned layer
//   organ     opaque ellipsoid inside each body       -> what the shell reveals
//
// Drop rungs under frame pressure via opts.detail — see FALLBACK below.

import * as THREE from 'three';

/**
 * Read a design token. NO FALLBACK ARGUMENT: a literal fallback is a second copy
 * of a token value living in a component, and it silently stops tracking the
 * token the moment either changes. A missing token is a build error.
 */
export function token(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) throw new Error(`design token ${name} is not defined in tokens.css`);
  return v;
}

function tokenNumber(name) {
  const n = Number.parseFloat(token(name));
  if (!Number.isFinite(n)) throw new Error(`design token ${name} is not numeric`);
  return n;
}

const SPHERE = new THREE.SphereGeometry(0.5, 16, 12);

const RAMP_STOPS = 6;
const BONE_STOP = 3;            // near-white: excluded from luminous draws
const MAP_W = 160, MAP_H = 80;  // generated per creature, never shipped

const rampCache = new Map();

/** The world's six-stop ramp, as THREE.Colors. Cached per world id. */
export function rampFor(worldId) {
  let ramp = rampCache.get(worldId);
  if (!ramp) {
    ramp = [];
    for (let i = 0; i < RAMP_STOPS; i++) ramp.push(new THREE.Color(token(`--pal-${worldId}-${i}`)));
    rampCache.set(worldId, ramp);
  }
  return ramp;
}

/** Call after a live token edit on the dev panel. */
export function invalidateRamps() { rampCache.clear(); }

/**
 * Generated hue -> authored colour. The gene keeps its whole range; it just lands
 * somewhere that belongs to the world.
 *
 * @param {THREE.Color[]} ramp
 * @param {number} hue         0..1, wraps
 * @param {number} valueShift  -0.5..+0.5, owns lightness
 * @param {boolean} avoidBone  luminous draws skip the near-white stop
 */
function colourFrom(ramp, hue, valueShift, avoidBone) {
  const stops = avoidBone ? ramp.filter((_, i) => i !== BONE_STOP) : ramp;
  const h = ((hue % 1) + 1) % 1;
  const c = stops[Math.min(stops.length - 1, Math.floor(h * stops.length))].clone();
  if (avoidBone) {
    c.multiplyScalar(1 + Math.max(-0.5, Math.min(0.35, valueShift)));
  } else if (valueShift > 0) {
    c.lerp(ramp[BONE_STOP], Math.min(0.6, valueShift));
  } else {
    c.multiplyScalar(1 + Math.max(-0.5, valueShift));
  }
  return c;
}

/** Emissive must hold its ramp hue: ACES desaturates hard past its knee. */
function toChroma(colour, minSat) {
  const hsl = {};
  colour.getHSL(hsl);
  return new THREE.Color().setHSL(
    hsl.h,
    Math.max(minSat, hsl.s),
    Math.min(0.52, Math.max(0.36, hsl.l)),
  );
}

function srgbBytes(colour) {
  const s = colour.getHexString();
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

/**
 * Colour + roughness + bump maps from genes that already exist. One set per
 * creature, shared by every body — a chain must read as one animal.
 *
 * patternScale      band frequency along and around the body
 * stripeAnisotropy  rings <-> longitudinal stripes, continuously
 * patternContrast   edge hardness: smudge to hard-edged livery
 */
function generateMaps(base, accent, m) {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = MAP_W; c.height = MAP_H;
    return c;
  };
  const cc = make(), rc = make(), bc = make();
  const cg = cc.getContext('2d'), rg = rc.getContext('2d'), bg = bc.getContext('2d');
  const ci = cg.createImageData(MAP_W, MAP_H);
  const ri = rg.createImageData(MAP_W, MAP_H);
  const bi = bg.createImageData(MAP_W, MAP_H);

  const b = srgbBytes(base), a = srgbBytes(accent);
  const scale = m.patternScale ?? 1;
  const su = 1 + scale * 3, sv = 1 + scale * 5;
  const aniso = m.stripeAnisotropy ?? 0.5;
  const k = 1 + (m.patternContrast ?? 0.4) * 7;
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const u = x / MAP_W, v = y / MAP_H, o = (y * MAP_W + x) * 4;
      let f = aniso * Math.sin(v * Math.PI * 2 * sv) + (1 - aniso) * Math.sin(u * Math.PI * 2 * su);
      f += 0.3 * Math.sin((u * 1.7 + v * 2.3) * Math.PI * 2 * scale);
      f = f * 0.5 + 0.5;
      f = f * 0.84 + hash(Math.floor(u * su * 7), Math.floor(v * sv * 7)) * 0.16;
      let t = Math.max(0, Math.min(1, (f - 0.5) * k + 0.5));
      t = t * t * (3 - 2 * t);

      ci.data[o] = b[0] + (a[0] - b[0]) * t;
      ci.data[o + 1] = b[1] + (a[1] - b[1]) * t;
      ci.data[o + 2] = b[2] + (a[2] - b[2]) * t;
      ci.data[o + 3] = 255;

      const rough = 235 - 120 * t;
      ri.data[o] = ri.data[o + 1] = ri.data[o + 2] = rough;
      ri.data[o + 3] = 255;

      const bump = 128 + (t - 0.5) * 90;
      bi.data[o] = bi.data[o + 1] = bi.data[o + 2] = bump;
      bi.data[o + 3] = 255;
    }
  }
  cg.putImageData(ci, 0, 0); rg.putImageData(ri, 0, 0); bg.putImageData(bi, 0, 0);

  const tex = (canvas, isColour) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (isColour) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: tex(cc, true), roughnessMap: tex(rc), bumpMap: tex(bc) };
}

/** Elongated bodies become capsules; the rest become ellipsoids. */
function geometryFor(dims, radiusMul = 1) {
  const r = Math.min(dims[0], dims[1]) * 0.5 * radiusMul;
  const straight = dims[2] - 2 * r;
  if (straight > 0.6 * r) {
    const g = new THREE.CapsuleGeometry(r, straight, 4, 14);
    g.rotateX(Math.PI / 2);          // capsule runs along Y by default; we want +Z
    return { geometry: g, scale: [dims[0] * radiusMul / (2 * r), dims[1] * radiusMul / (2 * r), 1] };
  }
  return { geometry: SPHERE, scale: dims.map(d => d * radiusMul) };
}

function place(mesh, body) {
  mesh.position.set(body.position[0], body.position[1], body.position[2]);
  mesh.quaternion.set(body.rotation[0], body.rotation[1], body.rotation[2], body.rotation[3]);
  mesh.userData.bodyIndex = body.index;
}

/**
 * @param {object} plan     BodyPlan from morphogenesis()
 * @param {object} genome   for MaterialGenes and per-node colorGenes
 * @param {object} [opts]
 * @param {string} [opts.worldId='w1']  which --pal-<id>-* ramp to index
 * @param {'full'|'flesh'|'flat'} [opts.detail='full']
 *        FALLBACK ladder, in drop order:
 *          full   membrane + flesh(maps) + organ
 *          flesh  flesh(maps) + organ        (rung 1: membrane dropped)
 *          flat   flesh(flat ramp colour)    (rung 2: generated maps dropped)
 * @returns {THREE.Group} centred on the creature's centre of mass
 */
export function buildCreature(plan, genome, opts = {}) {
  const worldId = opts.worldId ?? 'w1';
  const detail = opts.detail ?? 'full';
  const ramp = rampFor(worldId);
  const m = genome.material;
  const nodeById = new Map(genome.nodes.map(n => [n.id, n]));

  const lumThreshold = tokenNumber('--creature-lum-threshold');
  const membraneScale = tokenNumber('--creature-membrane-scale');
  const luminous = (m.iridescence ?? 0) > lumThreshold;

  const group = new THREE.Group();
  group.userData.luminous = luminous;
  group.userData.textures = [];
  group.userData.glow = [];   // per-body materials updateCreatureGlow() writes to

  // One map set per creature. Luminous bodies skip the bone stop entirely.
  const baseColour = colourFrom(ramp, m.hue, 0, luminous);
  const accentColour = colourFrom(ramp, m.hue + m.hueVariance, 0, luminous).multiplyScalar(1.45);
  const glowColour = toChroma(accentColour, 0.6);

  let maps = null;
  if (detail !== 'flat') {
    maps = generateMaps(baseColour, accentColour, m);
    group.userData.textures.push(maps.map, maps.roughnessMap, maps.bumpMap);
  }

  for (const b of plan.bodies) {
    const node = nodeById.get(b.nodeId);

    // Hue shifted per node, variance by depth, so a recursive chain reads as one
    // animal rather than one colour — but across ADJACENT stops only.
    const hue = m.hue + node.colorGenes.hueShift + m.hueVariance * (b.depth * 0.17);
    const bodyColour = colourFrom(ramp, hue, node.colorGenes.valueShift, luminous);

    // ── flesh ────────────────────────────────────────────
    // Per-body material instance on luminous creatures: a shared instance means
    // the last body's phase wins and the whole animal pulses in unison.
    const flesh = new THREE.MeshPhysicalMaterial({
      color: detail === 'flat' ? bodyColour : undefined,
      map: maps?.map ?? null,
      roughnessMap: maps?.roughnessMap ?? null,
      bumpMap: maps?.bumpMap ?? null,
      bumpScale: 0.015,
      roughness: maps ? 1 : 0.55 - 0.2 * m.iridescence,
      metalness: 0.03,
      sheen: 0.35,
      sheenColor: ramp[2].clone(),
      sheenRoughness: 0.55,
      iridescence: (m.iridescence ?? 0) * 0.8,
      iridescenceIOR: 1.32,
      iridescenceThicknessRange: [120, 420],
      clearcoat: 0.2,
      clearcoatRoughness: 0.5,
      emissive: glowColour.clone(),
      emissiveIntensity: 0,
    });
    if (detail === 'flat') flesh.color = bodyColour;
    // Low, and zero when glowing: a transmissive surface leaks emissive away and
    // the glow never reaches the camera.
    if (detail !== 'flat' && !luminous) {
      flesh.transmission = 0.14;
      flesh.thickness = 0.4;
      flesh.ior = 1.38;
      flesh.transparent = true;
    }

    const fleshGeo = geometryFor(b.dims);
    const fleshMesh = new THREE.Mesh(fleshGeo.geometry, flesh);
    fleshMesh.scale.set(...fleshGeo.scale);
    place(fleshMesh, b);
    group.add(fleshMesh);

    // ── organ ────────────────────────────────────────────
    // What the shell reveals, and what carries the glow. Drop the membrane if you
    // drop this: a shell over nothing reads as plastic.
    let organMat = null;
    if (detail !== 'flat') {
      organMat = new THREE.MeshStandardMaterial({
        color: accentColour.clone().multiplyScalar(1.2),
        roughness: 0.8,
        metalness: 0,
        emissive: glowColour.clone(),
        emissiveIntensity: 0.12,
      });
      const organ = new THREE.Mesh(SPHERE, organMat);
      organ.scale.set(b.dims[0] * 0.34, b.dims[1] * 0.3, b.dims[2] * 0.55);
      place(organ, b);
      group.add(organ);
    }

    // ── membrane ─────────────────────────────────────────
    if (detail === 'full') {
      const membrane = new THREE.MeshPhysicalMaterial({
        color: bodyColour.clone().lerp(ramp[BONE_STOP], 0.5),
        transmission: 0.8,
        thickness: 0.3,
        ior: 1.36,
        roughness: 0.14,
        metalness: 0,
        transparent: true,
        depthWrite: false,
        sheen: 1,
        sheenColor: ramp[2].clone(),
      });
      const mGeo = geometryFor(b.dims, membraneScale);
      const mMesh = new THREE.Mesh(mGeo.geometry, membrane);
      mMesh.scale.set(...mGeo.scale);
      place(mMesh, b);
      group.add(mMesh);
    }

    if (luminous) group.userData.glow.push({ index: b.index, flesh, organ: organMat });
  }

  return group;
}

/**
 * Phase-locked emissive. Call once per frame from the tank with the controller's
 * own phase for each body, so the glow is a READOUT OF THE GAIT rather than
 * decoration: a travelling light is a wave, all bodies blinking together is a
 * twitch. This is what makes phaseLag legible (B3).
 *
 * No-op on creatures whose iridescence is below threshold, so it is safe to call
 * for every creature in the tank.
 *
 * @param {THREE.Group} group
 * @param {(bodyIndex: number) => number} phaseFor  radians, from the oscillator
 * @param {number} [gain=1]  1 in the tank, ~2.4 for a single close specimen
 */
export function updateCreatureGlow(group, phaseFor, gain = 1) {
  const glow = group.userData.glow;
  if (!glow || glow.length === 0) return;

  // A real floor, not zero: with 3-4 bodies at ~0.95 rad lag there are instants
  // when every one sits in the wave's negative half and the body goes dark.
  const floor = tokenNumber('--creature-emissive-floor');

  for (const g of glow) {
    const p = Math.max(0, Math.sin(phaseFor(g.index)));
    const lit = p * p;
    g.flesh.emissiveIntensity = floor + 0.62 * gain * lit;
    if (g.organ) g.organ.emissiveIntensity = 0.25 + 1.1 * gain * lit;
  }
}

export function disposeCreature(group) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry !== SPHERE) o.geometry.dispose();
    o.material.dispose();
  });
  // Generated maps are per creature and are not shared with anything: a rebuild
  // that abandons them accumulates GPU allocations until the context is lost.
  for (const t of group.userData.textures ?? []) t.dispose();
  group.userData.textures = [];
  group.userData.glow = [];
}
