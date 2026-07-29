// render/creature.js — BodyPlan -> three.js group.
//
// 10 §A10: capsules and ellipsoids only. NO BOXES IN THE RENDER even though the
// physics proxy is a box. Boxes read as furniture; capsules read as flesh. The
// box proxy keeps the placement math simple; this layer keeps it organic.
//
// N16: no hex colours and no raw pixel values. Colours come from genes (computed
// HSL) or from CSS custom properties read off the document.

import * as THREE from 'three';

/**
 * Read a design token. NO FALLBACK ARGUMENT: a literal fallback is a second copy
 * of a token value living in a component, and it silently stops tracking the
 * token the moment either changes. A missing token is a build error, not
 * something to paper over.
 */
export function token(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) throw new Error(`design token ${name} is not defined in tokens.css`);
  return v;
}

const SPHERE = new THREE.SphereGeometry(0.5, 16, 12);

/** Elongated bodies become capsules; the rest become ellipsoids. */
function geometryFor(dims) {
  const r = Math.min(dims[0], dims[1]) * 0.5;
  const straight = dims[2] - 2 * r;
  if (straight > 0.6 * r) {
    const g = new THREE.CapsuleGeometry(r, straight, 4, 12);
    g.rotateX(Math.PI / 2);          // capsule runs along Y by default; we want +Z
    return { geometry: g, scale: [dims[0] / (2 * r), dims[1] / (2 * r), 1] };
  }
  return { geometry: SPHERE, scale: dims.slice() };
}

/**
 * @param {object} plan   BodyPlan from morphogenesis()
 * @param {object} genome for MaterialGenes and per-node colorGenes
 * @returns {THREE.Group} centred on the creature's centre of mass
 */
export function buildCreature(plan, genome) {
  const group = new THREE.Group();
  const nodeById = new Map(genome.nodes.map(n => [n.id, n]));
  const m = genome.material;

  for (const b of plan.bodies) {
    const node = nodeById.get(b.nodeId);
    const { geometry, scale } = geometryFor(b.dims);

    // Hue from the genome, shifted per node, with variance by depth so a
    // recursive chain reads as one animal rather than one colour.
    const hue = (m.hue + node.colorGenes.hueShift + m.hueVariance * (b.depth * 0.17)) % 1;
    const light = Math.min(0.72, Math.max(0.18, 0.42 + node.colorGenes.valueShift));
    const colour = new THREE.Color().setHSL((hue + 1) % 1, 0.35 + 0.4 * m.patternContrast, light);

    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
      color: colour,
      flatShading: true,
      roughness: 0.55 - 0.3 * m.iridescence,
      metalness: 0.05 + 0.25 * m.iridescence,
    }));
    mesh.scale.set(scale[0], scale[1], scale[2]);
    mesh.position.set(b.position[0], b.position[1], b.position[2]);
    mesh.quaternion.set(b.rotation[0], b.rotation[1], b.rotation[2], b.rotation[3]);
    mesh.userData.bodyIndex = b.index;
    group.add(mesh);
  }
  return group;
}

export function disposeCreature(group) {
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry !== SPHERE) o.geometry.dispose();
    o.material.dispose();
  });
}
