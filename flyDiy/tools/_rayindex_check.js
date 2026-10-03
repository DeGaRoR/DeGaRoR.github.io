// _rayindex_check.js - GATE RAYINDEX (G1281): the ray index (tools/_ray_index.js) answers EXACTLY what three's
// brute-force raycast answers. Both ways on every ray: RAY_INDEX.on = false (three's own walk over every triangle),
// then on (the hierarchy's candidates, three's own walk over them); the hit lists must be equal field by field -
// count, order, distance, point, faceIndex, face (a, b, c, normal, materialIndex), uv, normal, barycoord, object.
// Meshes: indexed and non-indexed, single- and double-sided, front/back-side materials, a transformed mesh, a
// triangle soup with slivers and degenerate faces, an InstancedMesh; rays: random, axis-aligned (the editor's probes
// are vertical), aimed exactly at vertices and edge midpoints (grazing), starting inside the box, with near/far.
// Also: the paths the index must NOT take (a material array, a partial draw range, a morph target, a small mesh) are
// three's untouched walk, and a geometry edited in place (version bump) is re-indexed, not answered from the old one.
'use strict';
const path = require('path');
const THREE = require(path.join(__dirname, '..', 'vendor', 'three.min.js'));
const { install } = require('./_ray_index.js');
const RI = install(THREE);
let fails = 0, checks = 0, rays = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; if (fails < 25) console.log('  FAIL ' + msg); } };
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const near = (a, b) => a === b || (Number.isNaN(a) && Number.isNaN(b));
const vecEq = (a, b) => (!a && !b) || (a && b && near(a.x, b.x) && near(a.y, b.y) && (a.z === undefined || near(a.z, b.z)));
function same(A, B) {
  if (A.length !== B.length) return 'count ' + A.length + ' vs ' + B.length;
  for (let i = 0; i < A.length; i++) {
    const a = A[i], b = B[i];
    if (a.object !== b.object) return i + ': object';
    if (!near(a.distance, b.distance)) return i + ': distance ' + a.distance + ' vs ' + b.distance;
    if (!vecEq(a.point, b.point)) return i + ': point';
    if (a.faceIndex !== b.faceIndex) return i + ': faceIndex ' + a.faceIndex + ' vs ' + b.faceIndex;
    if (a.instanceId !== b.instanceId) return i + ': instanceId';
    if (!a.face !== !b.face || (a.face && (a.face.a !== b.face.a || a.face.b !== b.face.b || a.face.c !== b.face.c || a.face.materialIndex !== b.face.materialIndex || !vecEq(a.face.normal, b.face.normal)))) return i + ': face';
    if (!vecEq(a.uv, b.uv) || !vecEq(a.uv1, b.uv1) || !vecEq(a.normal, b.normal) || !vecEq(a.barycoord, b.barycoord)) return i + ': uv/normal/barycoord';
  }
  return null;
}
const rc = new THREE.Raycaster();
function both(obj, o, d, nearV, farV, tag) {
  rc.set(o, d); rc.near = nearV || 0; rc.far = farV == null ? Infinity : farV;
  RI.on = false; const A = rc.intersectObject(obj, true);
  RI.on = true; const B = rc.intersectObject(obj, true);
  rays++;
  const w = same(A, B); ok(!w, tag + ': ' + w);
  return A.length;
}
function soup(n) {
  const p = [];
  for (let i = 0; i < n; i++) {
    const c = [rnd() * 4 - 2, rnd() * 2 - 1, rnd() * 6 - 3], s = rnd() < 0.1 ? 1e-4 : 0.3 * rnd();
    for (let k = 0; k < 3; k++) p.push(c[0] + (rnd() - 0.5) * s, c[1] + (rnd() - 0.5) * s * (rnd() < 0.05 ? 0 : 1), c[2] + (rnd() - 0.5) * s);
    if (rnd() < 0.02) { const L = p.length; p[L - 3] = p[L - 6]; p[L - 2] = p[L - 5]; p[L - 1] = p[L - 4]; }   // a degenerate face
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.computeVertexNormals(); return g;
}
function suite(name, mesh) {
  mesh.updateMatrixWorld(true);
  const g = mesh.geometry || (mesh.children[0] && mesh.children[0].geometry);
  const box = new THREE.Box3().setFromObject(mesh), sz = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const pt = () => new THREE.Vector3(box.min.x + rnd() * sz.x, box.min.y + rnd() * sz.y, box.min.z + rnd() * sz.z);
  let hits = 0;
  // warm the index (the first WARM asks of a geometry take the old path by design), then the rays
  for (let i = 0; i < 4; i++) both(mesh, c.clone().add(new THREE.Vector3(0, sz.y * 2, 0)), new THREE.Vector3(0, -1, 0), 0, null, name + ' warm');
  for (let i = 0; i < 150; i++) { const a = pt().add(new THREE.Vector3((rnd() - 0.5) * sz.x, (rnd() - 0.5) * sz.y, (rnd() - 0.5) * sz.z)), b = pt(); hits += both(mesh, a, b.sub(a).normalize(), 0, null, name + ' random'); }
  for (let i = 0; i < 150; i++) { const p = pt(), ax = i % 3, d = new THREE.Vector3(); d.setComponent(ax, i % 2 ? 1 : -1); p.setComponent(ax, i % 2 ? box.min.getComponent(ax) - 1 : box.max.getComponent(ax) + 1); hits += both(mesh, p, d, 0, null, name + ' axis'); }
  for (let i = 0; i < 100; i++) { const p = pt(); hits += both(mesh, p, new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), 0.01 * rnd(), rnd() < 0.3 ? sz.length() * rnd() : null, name + ' inside/near-far'); }
  // grazing: exactly at a vertex and at an edge's midpoint (world space), from outside
  const pos = g.attributes.position, idx = g.index, nT = Math.floor((idx ? idx.count : pos.count) / 3);
  const W = (mesh.isInstancedMesh ? null : mesh.matrixWorld);
  for (let i = 0; i < 120; i++) {
    const t = Math.floor(rnd() * nT), k = Math.floor(rnd() * 3), vi = idx ? idx.getX(t * 3 + k) : t * 3 + k, vj = idx ? idx.getX(t * 3 + (k + 1) % 3) : t * 3 + (k + 1) % 3;
    const v = new THREE.Vector3().fromBufferAttribute(pos, vi), u = new THREE.Vector3().fromBufferAttribute(pos, vj);
    const tgt = i % 2 ? v : v.clone().add(u).multiplyScalar(0.5); if (W) tgt.applyMatrix4(W);
    const from = i % 4 < 2 ? tgt.clone().add(new THREE.Vector3(0, sz.y + 1, 0)) : c.clone().add(new THREE.Vector3((rnd() - 0.5) * 9, (rnd() - 0.5) * 9, (rnd() - 0.5) * 9));
    hits += both(mesh, from, tgt.clone().sub(from).normalize(), 0, null, name + ' graze');
  }
  ok(hits > 50, name + ': the rays hit (' + hits + ')');
  return hits;
}
const mat = s => new THREE.MeshBasicMaterial({ side: s });
const out = [];
out.push(['sphere indexed double', suite('sphere', new THREE.Mesh(new THREE.SphereGeometry(1.3, 48, 32), mat(THREE.DoubleSide)))]);
out.push(['knot non-indexed front', suite('knot', new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.3, 160, 24).toNonIndexed(), mat(THREE.FrontSide)))]);
const bx = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 1.2, 40, 4, 20), mat(THREE.BackSide)); bx.position.set(0.3, 1.2, -0.4); bx.rotation.set(0.2, 0.7, -0.1); bx.scale.set(1.2, 0.8, 1.5);
out.push(['box transformed back', suite('box', bx)]);
out.push(['soup double', suite('soup', new THREE.Mesh(soup(4000), mat(THREE.DoubleSide)))]);
const grp = new THREE.Group(); grp.add(new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 16), mat(THREE.DoubleSide)), new THREE.Mesh(soup(800), mat(THREE.FrontSide))); grp.children[0].position.set(1, 0.5, 0);
out.push(['group of two', suite('group', grp)]);
const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 4), mat(THREE.DoubleSide), 5);
for (let i = 0; i < 5; i++) im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(i * 0.7 - 1.4, Math.sin(i), 0));
out.push(['instanced', suite('instanced', im)]);
// the paths the index must not take: three's own walk, untouched (counted by RAY_INDEX.fast)
const skip = (name, mesh) => { mesh.updateMatrixWorld(true); const f0 = RI.fast; for (let i = 0; i < 6; i++) both(mesh, new THREE.Vector3(0, 5, 0.01 * i), new THREE.Vector3(0, -1, 0), 0, null, name); ok(RI.fast === f0, name + ': took the old path'); };
const ga = new THREE.SphereGeometry(1, 32, 16); ga.addGroup(0, ga.index.count, 0); skip('material array', new THREE.Mesh(ga, [mat(THREE.DoubleSide)]));
const gd = new THREE.SphereGeometry(1, 32, 16); gd.setDrawRange(0, 600); skip('partial draw range', new THREE.Mesh(gd, mat(THREE.DoubleSide)));
const gm = new THREE.SphereGeometry(1, 32, 16); gm.morphAttributes.position = [gm.attributes.position.clone()]; const mm = new THREE.Mesh(gm, mat(THREE.DoubleSide)); mm.morphTargetInfluences = [0.5]; skip('morph target', mm);
skip('small mesh', new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(THREE.DoubleSide)));
// an edit in place: the version bumps, the index is rebuilt (the answers follow the new vertices)
{
  const g = new THREE.SphereGeometry(1, 32, 16), m = new THREE.Mesh(g, mat(THREE.DoubleSide)); m.updateMatrixWorld(true);
  for (let i = 0; i < 4; i++) both(m, new THREE.Vector3(0.1, 5, 0.1), new THREE.Vector3(0, -1, 0), 0, null, 'edit warm');
  const b0 = RI.built; const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 3); p.needsUpdate = true;
  g.computeBoundingSphere(); g.computeBoundingBox();
  for (let i = 0; i < 4; i++) both(m, new THREE.Vector3(0.1, 9, 0.1), new THREE.Vector3(0, -1, 0), 0, null, 'edit after');
  ok(RI.built > b0, 'an edited geometry is re-indexed');
}
ok(RI.fast > 1000, 'the index answered (' + RI.fast + ' fast asks, ' + RI.built + ' indexes built)');
for (const [k, h] of out) console.log('  ' + k.padEnd(26) + ' ' + h + ' hits');
console.log('  ' + rays + ' rays both ways, ' + checks + ' checks, ' + RI.built + ' indexes, ' + RI.fast + ' fast asks');
console.log('GATE RAYINDEX: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
process.exit(fails ? 1 : 0);
