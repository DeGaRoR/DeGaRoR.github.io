// G1857 (DMG-D4c THE WALL): the flown cage snapshot of a saved build, HEADLESS, with its fuselage sections - what GATE
// DMGWALL measures the wall on. tools/_bake_joined.js runs the page's drawing layers and the join under node
// (tools/_scene_headless.js: the real three.js); what it leaves out is the cage's own sheet (the covering, the liners,
// the frames, the sills, the door pads, the firewall, the dash), which only _cage_ui.js (a document) adds to the scene.
// This adds it the way _cage_ui.js meshFrom does - one indexed mesh, a draw group per SECTION, `userData.matNames` the
// section names in group order, scaled by FS - so CAGE_JOIN.snapshot bakes it into one payload group per section
// (mats[key].sec), in the flown model frame, exactly as the page's snapshot carries them. The materials are plain (the
// geometry is what is measured): `aeroInside` set by aeroskin's own section rule, as matOf sets it.
//   snapshotOf(buildFile) -> { snap, spec, def, groups: [{ key, sec, pos, idx, nv, nrm }], rest (the nodes in the
//                              visual frame, as app.js brkCage's K.rest), o, ms }
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname;
const AS = require(path.join(T, '..', 'src', 'viewer', 'aeroskin.js'));

function sheetMesh(THREE, M, FS) {
  const pos = new Float32Array(M.V.length * 3);
  M.V.forEach((v, i) => { pos[i * 3] = v[0]; pos[i * 3 + 1] = v[1]; pos[i * 3 + 2] = v[2]; });
  const byMat = new Map();
  for (const f of M.F) {
    if (!byMat.has(f.m)) byMat.set(f.m, []);
    const t = byMat.get(f.m);
    for (let i = 1; i + 1 < f.v.length; i++) t.push(f.v[0], f.v[i], f.v[i + 1]);
  }
  const idx = [], names = [], groups = [];
  for (const [name, tris] of byMat) { groups.push([idx.length, tris.length, names.length]); for (const i of tris) idx.push(i); names.push(name); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (M.N && M.N.length === M.V.length) {
    const nor = new Float32Array(M.V.length * 3);
    M.N.forEach((n, i) => { if (n) { nor[i * 3] = n[0]; nor[i * 3 + 1] = n[1]; nor[i * 3 + 2] = n[2]; } });
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  } else g.computeVertexNormals();
  g.setIndex(idx);
  for (const [s, c, mi] of groups) g.addGroup(s, c, mi);
  const mats = names.map((nm, i) => { const m = new THREE.MeshLambertMaterial({ color: 0x404040 + i * 1031, side: THREE.DoubleSide });
    m.userData = AS.aeroIsInside(nm) ? { aeroInside: 1 } : {}; return m; });
  const mesh = new THREE.Mesh(g, mats);
  mesh.userData.matNames = names;
  mesh.scale.setScalar(FS);
  return mesh;
}

function snapshotOf(file, opts) {
  opts = opts || {};
  const t0 = Date.now();
  const SH = require(path.join(T, '_scene_headless.js'));
  const BJ = require(path.join(T, '_bake_joined.js'));
  const C = require(path.join(T, 'flight_core.js'));
  let j = JSON.parse(fs.readFileSync(path.isAbsolute(file) ? file : path.join(T, '..', file), 'utf8'));
  if (opts.patch) j = opts.patch(j);
  const spec0 = JSON.parse(JSON.stringify(j.spec || j));
  // _bake_joined.js bakeJoined's steps, with the sheet added to the scene before the join reads it (as the page has it)
  const r = SH.sceneBuild(spec0, { garage: spec0 });
  const W = r.W, THREE = W.THREE, P = r.P;
  const s = r.built.sheet;
  const GLASSM = new Set(['windshield', 'pilotWindow', 'pasengerWindow', 'drawnPane', 'skyWindows']);
  const INTSTRUCT = new Set(['tube', 'woodFrame', 'aluminium', 'bulkhead', 'firewall', 'reveal']);
  const skinCull = nm => !GLASSM.has(nm) && !INTSTRUCT.has(nm) && nm !== 'joint' && nm !== 'doorSeal' && nm !== 'paneEdge';
  const sd0 = (P.skinOn == null || P.skinOn) ? s : Object.assign({}, s, { F: s.F.filter(f => !skinCull(f.m)) });
  const sd = (P.glazeOn == null || +P.glazeOn) ? sd0 : Object.assign({}, sd0, { F: sd0.F.filter(f => !GLASSM.has(f.m) && f.m !== 'paneEdge') });
  r.scene.add(sheetMesh(THREE, sd, r.FS));
  const outer = new THREE.Group(), inner = new THREE.Group();
  for (const ch of r.scene.children.slice()) inner.add(ch);
  outer.add(inner); r.scene.add(outer); r.scene.updateMatrixWorld(true);
  W.CAGE_UI = { P };
  if (!W.CAGE_JOIN) { W.CAGE_UI_LAZY = true; require('vm').runInContext(fs.readFileSync(path.join(T, '_cage_join.js'), 'utf8'), W, { filename: '_cage_join.js' }); }
  const J = W.CAGE_JOIN.export();
  const spec = BJ.merge(spec0, JSON.parse(JSON.stringify(J)));
  const snap = W.CAGE_JOIN.snapshot(spec);   // (one payload group per section: the page's mergeStill folds some by material - app.js brkCage poses those merged meshes alike)
  // the physics' def: the saved build's (as GATE TREECRASH / DMGSKIN fly it)
  const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec0) : spec0);
  // the nodes in the flown visual's frame (app.js brkCage K.rest: B^-1 (p - origin) - o, o = off + oRest)
  const N = def.nodes, R2 = def.refs;
  const avg = ids => { const q = [0, 0, 0]; for (const i of ids) for (let k = 0; k < 3; k++) q[k] += N[i].p[k] / ids.length; return q; };
  const nrm = a => { const L = Math.hypot(a[0], a[1], a[2]) || 1e-9; return [a[0] / L, a[1] / L, a[2] / L]; };
  const t1 = avg(R2.noseFrame), t2 = avg(R2.tailMid), u1 = avg(R2.upLo), u2 = avg(R2.upHi);
  const X = nrm([t2[0] - t1[0], t2[1] - t1[1], t2[2] - t1[2]]), Y = nrm([u2[0] - u1[0], u2[1] - u1[1], u2[2] - u1[2]]);
  const oR = C.defBodyProject(def)(C.defCG(def)), off = snap.off || [0, 0];
  const o = [(off[0] || 0) + oR[0], (off[1] || 0) + oR[1], oR[2]];
  const Mi = inv3(X, Y), org = avg(R2.origin || R2.noseFrame);
  const toVis = (p, out, at) => { const x = p[0] - org[0], y = p[1] - org[1], z = p[2] - org[2];
    out[at] = Mi[0] * x + Mi[1] * y + Mi[2] * z - o[0]; out[at + 1] = Mi[3] * x + Mi[4] * y + Mi[5] * z - o[1]; out[at + 2] = Mi[6] * x + Mi[7] * y + Mi[8] * z - o[2]; };
  const rest = new Float64Array(N.length * 3); N.forEach((nd, i) => toVis(nd.p, rest, i * 3));
  const groups = Object.keys(snap.groups).map(key => { const g = snap.groups[key], m = snap.mats[key] || {};
    return { key, sec: m.sec || null, inside: !!m.inside, pos: Float32Array.from(g.pos), idx: Uint32Array.from(g.idx), nv: g.pos.length / 3, nrm: g.nrm ? Float32Array.from(g.nrm) : null }; });
  return { snap, spec, spec0, def, groups, rest, o, X, Y, org, Mi, toVis, ms: Date.now() - t0, errors: W.CAGE_JOIN.errors(), sceneErrors: r.errors };
}
// the 3x3 inverse of the pose's oblique basis (columns X, Y, X x Y) - app.js brkCage's inv3, verbatim in its algebra
function inv3(X, Y) {
  const Z = [X[1] * Y[2] - X[2] * Y[1], X[2] * Y[0] - X[0] * Y[2], X[0] * Y[1] - X[1] * Y[0]];
  const a = X[0], b = Y[0], c = Z[0], d = X[1], e = Y[1], f = Z[1], g = X[2], h = Y[2], k = Z[2];
  const det = a * (e * k - f * h) - b * (d * k - f * g) + c * (d * h - e * g) || 1e-9;
  return [(e * k - f * h) / det, (c * h - b * k) / det, (b * f - c * e) / det, (f * g - d * k) / det, (a * k - c * g) / det,
          (c * d - a * f) / det, (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det];
}
module.exports = { snapshotOf, sheetMesh, inv3, AS };
