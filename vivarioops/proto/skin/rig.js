// proto/skin/rig.js — BodyPlan + fused geometry -> one SkinnedMesh.
//
// PROTOTYPE. Nothing here is imported by the app.
//
// THE BONES ARE FLAT. One Bone per body, all direct children of the group, none
// parented to another. That looks wrong for a skeleton and is exactly right here:
// the simulation is a set of independent rigid bodies and readPose() hands back a
// WORLD transform for every one of them (physics.js:2062). A parented hierarchy
// would mean converting each world pose back into its parent's frame every frame,
// for no gain — the bones would end up in the same places.
//
// The payoff is that the per-frame contract is unchanged from the shipped tank.
// vivarium.js:1385 walks something keyed by userData.bodyIndex and writes
// position and quaternion into it. applyPose() below is that same loop, and a
// trunk port would be a substitution rather than a rewrite.
//
// The one ordering trap: Skeleton computes its bone inverses from the bones'
// CURRENT world matrices, so the group must be walked with updateMatrixWorld
// BEFORE the Skeleton is constructed. Skip it and every bone binds against the
// identity, which shows up as the mesh collapsing to the origin the moment a pose
// is applied — a long way from its cause.

import * as THREE from 'three';

/**
 * @param {object} plan               BodyPlan from morphogenesis()
 * @param {THREE.BufferGeometry} geometry  from surfaceNet(), already carrying
 *                                    skinIndex/skinWeight in the same rest space
 * @param {THREE.Material} material
 * @returns {THREE.Group} group, with userData.{mesh, bones, applyPose}
 */
export function buildSkinnedCreature(plan, geometry, material) {
  const group = new THREE.Group();

  const bones = plan.bodies.map((b) => {
    const bone = new THREE.Bone();
    bone.position.set(b.position[0], b.position[1], b.position[2]);
    bone.quaternion.set(b.rotation[0], b.rotation[1], b.rotation[2], b.rotation[3]);
    bone.userData.bodyIndex = b.index;
    group.add(bone);
    return bone;
  });

  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.frustumCulled = false;   // the bind pose bound is not the animated bound
  group.add(mesh);

  // Rest pose resolved before binding — see the header.
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  // The geometry was generated in the same space the rest bones sit in, so the
  // bind matrix is the identity and bind() needs no second argument.
  mesh.bind(skeleton);

  group.userData.mesh = mesh;
  group.userData.bones = bones;
  group.userData.skeleton = skeleton;

  /**
   * @param {Array<{p:number[], q:number[]}>} pose  indexed by body index — the
   *        exact shape physics.js readPose() returns
   */
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

export function disposeSkinnedCreature(group) {
  const mesh = group.userData.mesh;
  if (mesh) {
    mesh.geometry.dispose();
    mesh.material.dispose();
    mesh.skeleton?.dispose?.();
  }
  group.userData.mesh = null;
  group.userData.bones = null;
  group.userData.skeleton = null;
}

/**
 * Paint each vertex by its dominant bone, as a debug view. Skin weights are the
 * half of this technique that is invisible when it works and unreadable when it
 * does not: a limb that swings wrong is a weight bug, and no amount of staring at
 * the silhouette will say which body claimed the vertices.
 */
export function bakeWeightColours(geometry, palette) {
  const idx = geometry.getAttribute('skinIndex');
  const wgt = geometry.getAttribute('skinWeight');
  const n = idx.count;
  const colours = new Float32Array(n * 3);
  const c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    let r = 0, g = 0, b = 0;
    for (let s = 0; s < 4; s++) {
      const w = wgt.getComponent(i, s);
      if (w <= 0) continue;
      c.set(palette[idx.getComponent(i, s) % palette.length]);
      r += c.r * w; g += c.g * w; b += c.b * w;
    }
    colours[i * 3] = r; colours[i * 3 + 1] = g; colours[i * 3 + 2] = b;
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
}
