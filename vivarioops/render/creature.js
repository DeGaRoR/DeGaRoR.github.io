// render/creature.js — BodyPlan -> three.js group.
//
// 10 §A10: capsules and ellipsoids only. NO BOXES IN THE RENDER even though the
// physics proxy is a box. Boxes read as furniture; capsules read as flesh.
//
// N16: no hex colours and no raw numeric constants. Everything comes from
// tokens.css via token()/tokenNumber(). Nothing here is authored per creature:
// the genome picks the colour, the pattern, the layer stack, the transparency
// and whether the animal glows. P1 holds — we author presentation, never an
// instance.
//
// Two rules do most of the work:
//
//   1. GEOMETRY DECIDES THE MATERIAL. Each body is classified from its own
//      dimensions, relative to the creature's largest girth. A flat body has no
//      inside, so it is not given one.
//
//   2. OPACITY = GEOMETRY x TRAIT. How thin this body is, times how unpigmented
//      the animal is. Pigment and transparency are the same axis — what makes a
//      pattern legible is exactly what stops light — so clarity is the inverse
//      of patternContrast and needs no new genome field.
//
// Translucency is ALPHA, not MeshPhysicalMaterial.transmission. Transmission
// costs a second full scene render and samples a backdrop that does not contain
// the water, so a thick transmissive body renders dark rather than clear. Alpha
// composites against what is actually on screen, and is free.
//
// Genes read here, all of which already mutate and inherit:
//   material.hue, hueVariance, valueShift
//   material.patternScale, patternContrast, stripeAnisotropy
//   material.iridescence
//   node.colorGenes.hueShift, valueShift, patternPhase
// That is the whole appearance surface. No new fields.

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

export function tokenNumber(name) {
  const n = Number.parseFloat(token(name));
  if (!Number.isFinite(n)) throw new Error(`design token ${name} is not numeric`);
  return n;
}

const RAMP_STOPS = 6;
const BONE_STOP = 3;            // near-white: excluded from luminous draws
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
 * Generated hue -> authored colour, reading the ramp as a CONTINUOUS GRADIENT
 * rather than six buckets. The gene keeps its whole range; it just lands
 * somewhere that belongs to the world, and no two draws share a colour.
 *
 * @param {THREE.Color[]} ramp
 * @param {number} hue         0..1, wraps
 * @param {number} valueShift  -0.5..+0.5, owns lightness
 * @param {boolean} avoidBone  luminous draws skip the near-white stop
 * @param {number} [satPush=1] bounded chroma push; bright water desaturates hard
 *                             through ACES and the ramp needs the headroom back
 */
export function colourFrom(ramp, hue, valueShift, avoidBone, satPush = 1) {
  const stops = avoidBone ? ramp.filter((_, i) => i !== BONE_STOP) : ramp;
  const n = stops.length;
  const h = ((hue % 1) + 1) % 1;
  const f = h * n, i0 = Math.floor(f) % n;
  const c = stops[i0].clone().lerp(stops[(i0 + 1) % n], f - Math.floor(f));

  if (avoidBone) {
    c.multiplyScalar(1 + Math.max(-0.45, Math.min(0.3, valueShift)));
  } else if (valueShift > 0) {
    c.lerp(ramp[BONE_STOP], Math.min(0.55, valueShift));
  } else {
    c.multiplyScalar(1 + Math.max(-0.45, valueShift));
  }
  if (satPush !== 1) {
    const hsl = {};
    c.getHSL(hsl);
    c.setHSL(hsl.h, Math.min(0.9, hsl.s * satPush), hsl.l);
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

/* ───────────────────────── generated maps ─────────────────────────────────
 * Colour + roughness + bump from genes that already exist. One set per creature,
 * shared by every body — a chain must read as one animal. Three canvases at
 * 160x80, roughly 38 kB of GPU, and no texture files to ship.
 *
 * Frequencies are INTEGER so the map TILES: UVs are scaled per body (see
 * uvScale), and a fractional band count leaves a seam down every repeat.
 *
 * Pattern AMPLITUDE, not just edge hardness, follows patternContrast — a gene
 * near zero has to mean "no pigment pattern", or a clear animal still arrives
 * wearing full-strength livery and the clarity trait contradicts itself.
 * ------------------------------------------------------------------------ */
function generateMaps(base, accent, m) {
  const W = tokenNumber('--creature-map-w');
  const H = tokenNumber('--creature-map-h');
  const make = () => {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    return c;
  };
  const cc = make(), rc = make(), bc = make();
  const cg = cc.getContext('2d'), rg = rc.getContext('2d'), bg = bc.getContext('2d');
  const ci = cg.createImageData(W, H);
  const ri = rg.createImageData(W, H);
  const bi = bg.createImageData(W, H);

  const contrast = m.patternContrast ?? 0.4;
  const scale = m.patternScale ?? 1;
  const aniso = m.stripeAnisotropy ?? 0.5;
  const amp = Math.min(1, contrast * 1.8);

  const b = srgbBytes(base);
  const a = srgbBytes(accent.clone().lerp(base, (1 - amp) * 0.78));

  const su = Math.max(1, Math.round(1 + scale * 3));
  const sv = Math.max(1, Math.round(1 + scale * 5));
  const sd = Math.max(1, Math.round(scale));
  const k = 1 + contrast * 7;
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H, o = (y * W + x) * 4;
      let f = aniso * Math.sin(v * Math.PI * 2 * sv) + (1 - aniso) * Math.sin(u * Math.PI * 2 * su);
      f += 0.3 * Math.sin((u * 2 + v * 3) * Math.PI * 2 * sd);
      f = f * 0.5 + 0.5;
      f = f * 0.84 + hash(Math.floor(u * su * 7) % (su * 7), Math.floor(v * sv * 7) % (sv * 7)) * 0.16;
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

/* ───────────────────────── geometry ─────────────────────────────────────── */

/**
 * Band spacing becomes a physical size: UVs scale with the body, so a small body
 * is not wearing a giant's stripes. Free — no second texture.
 *
 * patternPhase slides the map per body. The map tiles, so this is seamless, and
 * without it every segment's bands line up and the animal looks extruded.
 */
function uvScale(geo, dims, phase = 0) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  const ref = tokenNumber('--creature-uv-ref');
  const su = Math.max(1, Math.min(4, Math.round(dims[2] / ref)));
  const sv = Math.max(1, Math.min(4, Math.round((dims[0] + dims[1]) * 0.5 / ref)));
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su + phase, uv.getY(i) * sv + phase * 0.37);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * A10: capsules and ellipsoids only. Elongated round bodies become capsules;
 * anything flat or blobby takes the ellipsoid — a capsule stretched hard on one
 * axis reads as a BAR, flat-topped with hard ends.
 */
function bodyGeo(dims, mul, ellipsoid, phase) {
  const r = Math.min(dims[0], dims[1]) * 0.5 * mul;
  const straight = dims[2] * mul - 2 * r;
  if (!ellipsoid && straight > 0.5 * r) {
    const geo = new THREE.CapsuleGeometry(r, straight, 5, 16);
    geo.rotateX(Math.PI / 2);          // capsule runs along Y by default; we want +Z
    uvScale(geo, dims, phase);
    return { geo, scale: [dims[0] * mul / (2 * r), dims[1] * mul / (2 * r), 1] };
  }
  const geo = new THREE.SphereGeometry(0.5, 16, 12);
  uvScale(geo, dims, phase);
  return { geo, scale: [dims[0] * mul, dims[1] * mul, dims[2] * mul] };
}

/**
 * Which kind of thing is this body? Measured off its own dimensions relative to
 * the creature's largest girth, so the rule is scale-free. No gene, nothing
 * authored per creature.
 *
 *   strand  thin in BOTH cross-sections — a limb. Near-opaque, high clearcoat.
 *   vane    flat — a fin. One double-sided sheet, no organ, no shell.
 *   mass    everything else. The only class with an inside worth revealing.
 */
export function partClass(dims, girthRef) {
  const [mn, mid, mx] = [...dims].sort((a, b) => a - b);
  const gThin = tokenNumber('--creature-strand-girth');
  const gRound = tokenNumber('--creature-strand-round');
  const gLong = tokenNumber('--creature-strand-long');
  const gFlat = tokenNumber('--creature-vane-flat');
  if (mn < gThin * girthRef && mid < gRound * mn && mx > gLong * mn) return 'strand';
  if (mn < gFlat * mid) return 'vane';
  return 'mass';
}

/* ───────────────────────── materials ────────────────────────────────────── */

function surfaceFor(cls, dims, g, ctx, girthRef, ramp) {
  const mn = Math.min(...dims);
  const clar = g.clarity;

  // A luminous body that is not glass stays fully opaque: alpha would bleed its
  // emissive into the water behind it and the travelling wave would lose its
  // edge.
  const opaqueLum = g.luminous && !g.glass;

  const thin = Math.max(0, Math.min(1, mn / Math.max(1e-4, girthRef)));
  const base = tokenNumber('--creature-opacity-base');
  const span = tokenNumber('--creature-opacity-span');
  const trait = tokenNumber('--creature-opacity-trait');
  const floor = tokenNumber('--creature-opacity-floor');
  const opacity = opaqueLum ? 1
    : Math.max(floor, (base + span * thin) * (1 - trait * clar));
  const solid = opacity > 0.97;

  const common = {
    map: ctx.maps.map,
    roughnessMap: ctx.maps.roughnessMap,
    bumpMap: ctx.maps.bumpMap,
    roughness: 1 - 0.55 * clar,
    metalness: 0.02,
    // Specular is independent of albedo, which is how a dark body still reads wet.
    specularColor: ramp[2].clone().lerp(ramp[BONE_STOP], 0.55),
    sheenColor: ramp[2].clone(),
    emissive: ctx.glowColour.clone(),
    emissiveIntensity: 0,
    transparent: !solid,
    opacity,
    depthWrite: solid,
  };

  if (cls === 'vane') {
    return new THREE.MeshPhysicalMaterial({ ...common,
      bumpScale: 0.006 + 0.006 * (1 - clar),
      side: THREE.DoubleSide,
      sheen: 1, sheenRoughness: 0.4, specularIntensity: 1.2,
      clearcoat: 0.5 + 0.35 * clar, clearcoatRoughness: 0.2,
      iridescence: g.iridescence * 0.5, iridescenceIOR: 1.3,
    });
  }
  if (cls === 'strand') {
    return new THREE.MeshPhysicalMaterial({ ...common,
      bumpScale: 0.009 * (1 - clar * 0.6),
      sheen: 0.55, sheenRoughness: 0.6, specularIntensity: 1,
      clearcoat: 0.35 + 0.45 * clar, clearcoatRoughness: 0.3,
      iridescence: g.iridescence * 0.6, iridescenceIOR: 1.32,
    });
  }
  const m = new THREE.MeshPhysicalMaterial({ ...common,
    bumpScale: 0.02 * (1 - clar * 0.65),
    sheen: 0.4, sheenRoughness: 0.55, specularIntensity: 0.95,
    clearcoat: 0.22 + 0.4 * clar, clearcoatRoughness: 0.5,
    iridescence: g.iridescence * 0.8, iridescenceIOR: 1.32,
    iridescenceThicknessRange: [120, 420],
  });
  // Grain along the body. Mass bodies only: it is the one channel that needs a
  // tangent frame, and a vane is too thin to show it.
  m.anisotropy = 0.12 + g.stripeAnisotropy * 0.38;
  m.anisotropyRotation = g.stripeAnisotropy * Math.PI;
  return m;
}

/* ───────────────────────── build ────────────────────────────────────────── */

/**
 * @param {object} plan     BodyPlan from morphogenesis()
 * @param {object} genome   MaterialGenes + per-node colorGenes
 * @param {object} [opts]
 * @param {string} [opts.worldId='w1']  which --pal-<id>-* ramp to index
 * @param {'full'|'flesh'|'flat'} [opts.detail='full']
 *        FALLBACK ladder, in drop order:
 *          full   membrane + flesh(maps) + organ
 *          flesh  flesh(maps) + organ        (rung 1: membrane dropped)
 *          flat   flesh(flat ramp colour)    (rung 2: generated maps dropped)
 * @param {number} [opts.haloGain=1]  corona size; a single close specimen wants more
 * @returns {THREE.Group}
 */
export function buildCreature(plan, genome, opts = {}) {
  const worldId = opts.worldId ?? 'w1';
  const detail = opts.detail ?? 'full';
  const ramp = rampFor(worldId);
  const m = genome.material;
  const nodeById = new Map(genome.nodes.map(n => [n.id, n]));

  const lumThreshold = tokenNumber('--creature-lum-threshold');
  const clarityK = tokenNumber('--creature-clarity-k');
  const glassThreshold = tokenNumber('--creature-glass-threshold');
  const membraneScale = tokenNumber('--creature-membrane-scale');
  const membraneOpacity = tokenNumber('--creature-membrane-opacity');

  const g = {
    hue: m.hue,
    hueVariance: m.hueVariance ?? 0.1,
    valueShift: m.valueShift ?? 0,
    stripeAnisotropy: m.stripeAnisotropy ?? 0.5,
    iridescence: m.iridescence ?? 0,
    luminous: (m.iridescence ?? 0) > lumThreshold,
    // Pigment and transparency are the same axis. No new genome field.
    clarity: Math.max(0, Math.min(1, 1 - (m.patternContrast ?? 0.4) * clarityK)),
  };
  g.glass = g.clarity > glassThreshold;

  const group = new THREE.Group();
  group.userData.luminous = g.luminous;
  group.userData.glass = g.glass;
  group.userData.textures = [];
  group.userData.glow = [];   // per-body handles updateCreatureGlow() writes to

  // Bright water desaturates hard through ACES, so both ends of the pattern get
  // a bounded chroma push. Luminous bodies skip the bone stop entirely.
  const baseColour = colourFrom(ramp, g.hue, g.valueShift, g.luminous, 1.18);
  const accentColour = colourFrom(ramp, g.hue + g.hueVariance, 0.2, g.luminous, 1.3);
  const glowColour = toChroma(accentColour, 0.62);

  let maps = null;
  if (detail !== 'flat') {
    maps = generateMaps(baseColour, accentColour, m);
    group.userData.textures.push(maps.map, maps.roughnessMap, maps.bumpMap);
  }
  const ctx = { maps, base: baseColour, accent: accentColour, glowColour };

  const girthRef = Math.max(...plan.bodies.map(b => Math.min(b.dims[0], b.dims[1])));

  for (const b of plan.bodies) {
    const node = nodeById.get(b.nodeId);
    const cg = node?.colorGenes ?? {};
    const cls = partClass(b.dims, girthRef);
    const blobby = cls === 'vane' || (b.tag === 'bulb');

    // ── flesh ──────────────────────────────────────────────
    let flesh;
    if (detail === 'flat') {
      flesh = new THREE.MeshStandardMaterial({
        color: colourFrom(ramp, g.hue + (cg.hueShift ?? 0), g.valueShift + (cg.valueShift ?? 0), g.luminous),
        roughness: 0.55, metalness: 0.03,
        emissive: glowColour.clone(), emissiveIntensity: 0,
      });
    } else {
      flesh = surfaceFor(cls, b.dims, g, ctx, girthRef, ramp);
      // Per-node hue as a WASH over the shared map, normalised to full value
      // first: multiplying a map by a ramp colour darkens it, and eight darkened
      // bodies read as dirt rather than as eight related colours. hueShift is
      // bounded by hueVariance, so a recursive chain stays one animal.
      const tint = colourFrom(ramp,
        g.hue + (cg.hueShift ?? 0),
        g.valueShift + (cg.valueShift ?? 0),
        g.luminous, 1.2);
      const mx = Math.max(tint.r, tint.g, tint.b) || 1;
      flesh.color = new THREE.Color(1, 1, 1).lerp(tint.multiplyScalar(1 / mx), 0.66);
    }

    const fg = bodyGeo(b.dims, 1, blobby, cg.patternPhase ?? 0);
    const fleshMesh = new THREE.Mesh(fg.geo, flesh);
    fleshMesh.scale.set(...fg.scale);
    if (flesh.anisotropy) {
      try { fg.geo.computeTangents(); } catch (e) { flesh.anisotropy = 0; }
    }
    place(fleshMesh, b);
    group.add(fleshMesh);

    // ── organ ──────────────────────────────────────────────
    // Mass bodies only: the class with an inside. A transmissive-looking body
    // shows whatever is behind it, which is its own organ — so on a GLASS animal
    // the organ gets smaller and brighter, or the creature reads as a dark solid
    // instead of clear tissue around a core.
    let organMat = null;
    if (detail !== 'flat' && cls === 'mass') {
      organMat = new THREE.MeshStandardMaterial({
        color: accentColour.clone().multiplyScalar(1.15 + g.clarity * 0.3),
        roughness: 0.8 - g.clarity * 0.35,
        metalness: 0,
        emissive: glowColour.clone(),
        emissiveIntensity: tokenNumber('--creature-organ-emissive-floor') * 0.6,
      });
      const organ = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 9), organMat);
      const k = 1 - g.clarity * 0.38;
      organ.scale.set(b.dims[0] * 0.38 * k, b.dims[1] * 0.34 * k, b.dims[2] * 0.52 * k);
      place(organ, b);
      group.add(organ);

      // ── membrane ─────────────────────────────────────────
      if (detail === 'full') {
        const mg = bodyGeo(b.dims, membraneScale, blobby, cg.patternPhase ?? 0);
        const mMesh = new THREE.Mesh(mg.geo, new THREE.MeshPhysicalMaterial({
          color: baseColour.clone().lerp(ramp[BONE_STOP], 0.45),
          roughness: 0.13, metalness: 0,
          transparent: true, opacity: membraneOpacity, depthWrite: false,
          specularIntensity: 1.3, sheen: 1, sheenColor: ramp[2].clone(),
        }));
        mMesh.scale.set(...mg.scale);
        place(mMesh, b);
        group.add(mMesh);
      }
    }

    if (g.luminous) group.userData.glow.push({ index: b.index, flesh, organ: organMat });
  }

  return group;
}

function place(mesh, body) {
  mesh.position.set(body.position[0], body.position[1], body.position[2]);
  mesh.quaternion.set(body.rotation[0], body.rotation[1], body.rotation[2], body.rotation[3]);
  mesh.userData.bodyIndex = body.index;
}

/**
 * Phase-locked emissive. Call once per frame from the tank with the controller's
 * own phase for each body, so the glow is a READOUT OF THE GAIT rather than
 * decoration: a travelling light is a wave, all bodies blinking together is a
 * twitch. This is what makes phaseLag legible (B3).
 *
 * No-op on creatures below the iridescence threshold, so it is safe to call for
 * every creature in the tank.
 *
 * On a GLASS animal the flesh floor drops and the organ carries the light: a
 * lantern, seen through tissue, rather than a bulb.
 *
 * @param {THREE.Group} group
 * @param {(bodyIndex: number) => number} phaseFor  radians, from the oscillator
 * @param {number} [gain=1]  1 in the tank, ~1.3 for a single close specimen
 */
export function updateCreatureGlow(group, phaseFor, gain = 1) {
  const glow = group.userData.glow;
  if (!glow || glow.length === 0) return;

  const glass = group.userData.glass;
  const floor = tokenNumber(glass ? '--creature-emissive-floor-glass' : '--creature-emissive-floor');
  const fleshGain = tokenNumber('--creature-emissive-gain');
  const organFloor = tokenNumber('--creature-organ-emissive-floor');
  const organGain = tokenNumber(glass ? '--creature-organ-gain-glass' : '--creature-organ-gain');

  for (const item of glow) {
    const p = Math.max(0, Math.sin(phaseFor(item.index)));
    const lit = p * p;
    item.flesh.emissiveIntensity = floor + fleshGain * gain * lit;
    if (item.organ) item.organ.emissiveIntensity = organFloor + organGain * gain * lit;
  }
}

export function disposeCreature(group) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    o.material.dispose();
  });
  // Generated maps are per creature and shared with nothing: a rebuild that
  // abandons them accumulates GPU allocations until the context is lost.
  for (const t of group.userData.textures ?? []) t.dispose();
  group.userData.textures = [];
  group.userData.glow = [];
}
