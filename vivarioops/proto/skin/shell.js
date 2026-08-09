// proto/skin/shell.js — a transparent envelope AROUND the existing render.
//
// PROTOTYPE. Nothing here is imported by the app.
//
// EXPERIMENT 3, and the premise is different from both of the first two.
//
//   1. SDF reconstruction   replaced the bodies with one fused surface.
//                           It could not describe a fin.
//   2. Anatomy loft         replaced the bodies with one built surface.
//                           It described a fin, and it dissolved the LIMBS:
//                           everything became one smooth thing, and a limb that
//                           reads as a smooth bulge on a smooth body is not a
//                           limb any more.
//
// Both replaced. The bodies were never the problem — the SEPARATION was. So this
// keeps `buildCreature()` exactly as it ships, every body, every material, every
// organ and the whole glow readout, and wraps ONE continuous transparent surface
// around all of it.
//
// The differentiation survives because it is still there: you read the segments
// and the limbs through the envelope, the way you read a salp's viscera or the
// muscle blocks of a glass eel. And the animal reads as whole because a single
// unbroken silhouette encloses it. Neither property is bought at the other's
// expense, which is what the first two attempts kept doing.
//
// It also suits the project's own material rules. `design style/README.md`
// already asks for a translucent shell over a lit interior — "a transmissive
// shell over an occluded or unlit interior reads as plastic, not tissue" — and
// render/creature.js already builds a per-body membrane at x1.11 for exactly
// this reason. That membrane is per body, so it draws the seams it is meant to
// hide. This is that same layer, made whole.
//
// TWO SOURCES for the envelope, because they fail in opposite directions and it
// is not obvious in advance which is wanted:
//
//   'sdf'   the field from field.js at an inflated iso-level. Genuinely
//           encloses everything, merges nearby limbs into webbing, and is as
//           blobby as the inflation is large. A bell, a mantle, a jelly.
//   'loft'  the anatomy builder at inflated radii with its shaping turned down.
//           Clean quad topology, real UVs, follows each limb out to its tip
//           instead of swallowing it. A skin, not a bell.

import * as THREE from 'three';
import { makeField } from './field.js';
import { surfaceNet } from './march.js';
import { buildAnatomy } from './anatomy.js';

/**
 * @param {object} plan
 * @param {object} genome
 * @param {object} [opts]
 * @param {'sdf'|'loft'} [opts.source='sdf']
 * @param {number} [opts.inflate=0.18]  outward offset, in world units
 * @param {number} [opts.blend=0.9]     how hard neighbouring bodies merge (sdf)
 * @param {number} [opts.res=2.5]       cells per girth (sdf) / section detail (loft)
 */
export function buildShellGeometry(plan, genome, opts = {}) {
  const source = opts.source ?? 'sdf';
  const inflate = opts.inflate ?? 0.18;

  if (source === 'loft') {
    return buildAnatomy(plan, genome, {
      inflate,
      // A shell wants to be smooth, not characterful: the character is the body
      // showing through it. Waist and head bulge are shaping the INNER render
      // already does, and doing it twice reads as a double image.
      waist: 0,
      headBulge: 0.05,
      radial: Math.max(8, Math.round((opts.res ?? 2.5) * 5)),
    });
  }

  const field = makeField(plan, { blendFactor: opts.blend ?? 0.9, inflate });
  const { geometry, stats } = surfaceNet(field, {
    res: opts.res ?? 2.5,
    // A shell is smooth and thick; it does not need the resolution an anatomy
    // would, and the whole point of budgeting samples was that this is the dial.
    budget: opts.budget ?? 140000,
  });
  return { geometry, stats };
}

/**
 * Bones + two skinned copies of the shell.
 *
 * TWO PASSES, back faces then front. A single-sided transparent surface shows
 * only the wall nearest the camera, which reads as a decal stuck on the front of
 * the animal. Drawing the far wall first and the near wall over it gives the
 * envelope thickness for free — and at grazing angles both walls pile up in the
 * same pixels, which IS a Fresnel rim, without a shader and without the
 * transmission pass render/creature.js:23 already rejected.
 *
 * `depthWrite: false` on both, and a renderOrder above the body, so the inner
 * creature is never hidden by the thing that is supposed to reveal it.
 */
export function buildShellGroup(plan, geometry, opts = {}) {
  const group = new THREE.Group();

  const bones = plan.bodies.map((b) => {
    const bone = new THREE.Bone();
    bone.position.set(b.position[0], b.position[1], b.position[2]);
    bone.quaternion.set(b.rotation[0], b.rotation[1], b.rotation[2], b.rotation[3]);
    bone.userData.bodyIndex = b.index;
    group.add(bone);
    return bone;
  });

  const base = {
    color: new THREE.Color(opts.color ?? '#bfe9ff'),
    roughness: opts.roughness ?? 0.12,
    metalness: 0,
    transparent: true,
    depthWrite: false,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
    specularIntensity: 1.4,
    sheen: 1,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color(opts.sheen ?? '#dff4ff'),
  };
  const opacity = opts.opacity ?? 0.16;

  const inner = new THREE.MeshPhysicalMaterial({ ...base, side: THREE.BackSide, opacity: opacity * 0.8 });
  const outer = new THREE.MeshPhysicalMaterial({ ...base, side: THREE.FrontSide, opacity });

  const meshes = [inner, outer].map((mat, i) => {
    const m = new THREE.SkinnedMesh(geometry, mat);
    m.frustumCulled = false;
    m.renderOrder = 10 + i;
    group.add(m);
    return m;
  });

  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  for (const m of meshes) m.bind(skeleton);

  group.userData.meshes = meshes;
  group.userData.bones = bones;
  group.userData.skeleton = skeleton;
  group.userData.applyPose = function applyPose(pose) {
    for (const bone of bones) {
      const p = pose[bone.userData.bodyIndex];
      if (!p) continue;
      bone.position.set(p.p[0], p.p[1], p.p[2]);
      bone.quaternion.set(p.q[0], p.q[1], p.q[2], p.q[3]);
    }
  };
  return group;
}

export function disposeShell(group) {
  for (const m of group.userData.meshes ?? []) m.material.dispose();
  group.userData.meshes?.[0]?.geometry.dispose();
  group.userData.skeleton?.dispose?.();
  group.userData.meshes = null;
  group.userData.bones = null;
}
