// GATE SKIN — the generated build's REST FRAME (G145). The PA-18 payload's
// flex-binding half of this gate retired with the hand-written fleet
// (2026-09-05); the cage visual takes the same binding (makeSkinBinding /
// sparDeltas) against the live def, and this is the law it must obey.
const { makeSkinBinding, sparDeltas, buildGen, defBodyProject, makeSim,
        makeWorld } = require('./flight_core.js');
let ok = true, why = [];
const chk = (c, m) => { if (!c) { ok = false; why.push(m); } };
const world = makeWorld();

// ---------------------------------------------------------------------------
// THE GEN BUILD'S REST FRAME (the at-rest bent wing). rest lives in the BODY
// frame — the frame sparDeltas measures in; at zero load, before a single
// step, the deltas must be EXACTLY zero. A rest kept in raw design axes
// leaves (R_beta - I)(p - cg), beta = the design pose's nose->tail pitch:
// that read as an aft-sheared wing, a crease at the centre-section boundary
// and kinked struts on the stand, and no flight gate could see it because
// they all settle first and subtract the baseline.
// ---------------------------------------------------------------------------
const GCFG = { tags: ['WF', 'WR'], zRoot: 0, xMax: 1e9 };  // station side only
const gdef = buildGen();
const gbind = makeSkinBinding(new Float32Array(0), 0, gdef, GCFG);
const gz = gbind.zs.length;
const gd = { P: new Float32Array(gz * 3), N: new Float32Array(gz * 3) };
const gsim = makeSim(gdef, world);
gsim.reset(0);                              // solver NOT stepped: zero load
sparDeltas(gbind, gsim, gd);
const gmax = Math.max(...[...gd.P, ...gd.N].map(Math.abs));
console.log(`gen rest deltas at reset(0): max ${(gmax*1000).toFixed(4)} mm over ${gz} stations`);
chk(gmax < 1e-6, 'gen deltas non-zero at zero load (rest reference out of body frame)');

// the strut anchor nodes get the same zero (app.js's two-end strut binding
// shares this rest law — the parked strut must not skew)
const gTo = defBodyProject(gdef);
const [gxA, gyU] = gsim.axes(), gcg = gsim.bodyOrigin();   // G179: structural origin
const gzL = [gxA[1]*gyU[2]-gxA[2]*gyU[1], gxA[2]*gyU[0]-gxA[0]*gyU[2],
             gxA[0]*gyU[1]-gxA[1]*gyU[0]];
let smax = 0, snodes = 0;
for (const sd of ['R', 'L']) {
  const fw = gdef.parts && gdef.parts.wf && gdef.parts.wf[sd];
  if (!fw || fw.strutRoot == null) continue;
  for (const ni of [fw.strutRoot, fw.strutF, fw.strutR]) {
    if (ni == null) continue;
    snodes++;
    const dx = gsim.p[ni*3]-gcg[0], dy = gsim.p[ni*3+1]-gcg[1],
          dz = gsim.p[ni*3+2]-gcg[2];
    const live = [dx*gxA[0]+dy*gxA[1]+dz*gxA[2],
                  dx*gyU[0]+dy*gyU[1]+dz*gyU[2],
                  dx*gzL[0]+dy*gzL[1]+dz*gzL[2]];
    const r = gTo(gdef.nodes[ni].p);
    smax = Math.max(smax, Math.abs(live[0]-r[0]), Math.abs(live[1]-r[1]),
                    Math.abs(live[2]-r[2]));
  }
}
console.log(`gen strut anchors at reset(0): ${snodes} nodes, max ${(smax*1000).toFixed(4)} mm`);
chk(snodes >= 6, 'default gen build has no strut anchors to check');
chk(smax < 1e-6, 'strut anchor rest out of body frame');

// NEGATIVE CONTROL: a rest reference pitched 1 deg out of the body frame MUST
// be seen — this is the disease the zero assertions above are the net for
const bad = { P: { st: gbind.P.st, rest: gbind.P.rest.slice() },
              N: { st: gbind.N.st, rest: gbind.N.rest.slice() } };
const cb = Math.cos(Math.PI/180), sbn = Math.sin(Math.PI/180);
for (const S of ['P', 'N']) for (let k = 0; k < gz; k++) {
  const x = bad[S].rest[k*3], y = bad[S].rest[k*3+1];
  bad[S].rest[k*3] = x*cb - y*sbn; bad[S].rest[k*3+1] = x*sbn + y*cb;
}
sparDeltas(bad, gsim, gd);
const bmax = Math.max(...[...gd.P, ...gd.N].map(Math.abs));
console.log(`negative control (rest pitched 1 deg): max ${(bmax*1000).toFixed(2)} mm`);
chk(bmax > 0.003, 'instrument blind to a rest reference out of the body frame');

// PARKED AND SETTLED: droop (y) is real sag and stays legal; in-plane (x, z)
// must stay small — nothing pulls a standing aeroplane's wing aft. The bound
// is not zero because bodyAxes reads a FLEXIBLE fuselage: the tail sinks on
// its wheel, the frame pitches with it, and the wing above the CG picks up a
// few real millimetres of apparent fore-aft — bounded, not denied.
for (let s = 0; s < 10*60; s++) gsim.step(1/60);
sparDeltas(gbind, gsim, gd);
let inPlane = 0, droop = 0;
for (const S of ['P', 'N']) for (let k = 0; k < gz; k++) {
  inPlane = Math.max(inPlane, Math.abs(gd[S][k*3]), Math.abs(gd[S][k*3+2]));
  droop = Math.max(droop, Math.abs(gd[S][k*3+1]));
}
console.log(`gen parked 10 s: in-plane max ${(inPlane*1000).toFixed(2)} mm, droop max ${(droop*1000).toFixed(2)} mm`);
chk(inPlane < 0.015, 'parked wing displaced in-plane (aft/spanwise shear at rest)');

// a cantilever build satisfies the same zero (no strut to blame)
const cdef = buildGen({ bracing: { type: 'cantilever' } });
const cbind = makeSkinBinding(new Float32Array(0), 0, cdef, GCFG);
const cz = cbind.zs.length;
const cd = { P: new Float32Array(cz * 3), N: new Float32Array(cz * 3) };
const csim = makeSim(cdef, world);
csim.reset(0);
sparDeltas(cbind, csim, cd);
const cmax = Math.max(...[...cd.P, ...cd.N].map(Math.abs));
console.log(`cantilever rest deltas at reset(0): max ${(cmax*1000).toFixed(4)} mm`);
chk(cmax < 1e-6, 'cantilever gen deltas non-zero at zero load');

// ---------------------------------------------------------------------------
// G576: THE STILL AIRFRAME, ONE DRAW PER MATERIAL. app.js mergeStill, lifted
// out of the page and run on the real vendor three.js over a synthetic flown
// group in the cage payload's shape. The merge may take ONLY what nothing
// moves - a bucket whose rig binds no vertex and turns no hinge - and must
// leave the flex, the hinges, the lamps, the crew, the glass and anything
// posed exactly as they were; what it merges must be the members' own bytes,
// in their own frame, one mesh per material. Then the three places the
// flown model leans on it, read off the source.
// ---------------------------------------------------------------------------
{
  const fs = require('fs'), path = require('path'), vm = require('vm');
  const ROOT = path.join(__dirname, '..');
  const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
  const app = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8').replace(/\r\n/g, '\n');
  const a0 = app.indexOf('  const STILL_CRUMB'), a1 = app.indexOf('  // curDef is only read on the GARAGE path');
  chk(a0 > 0 && a1 > a0, 'G576: mergeStill not found in app.js');
  const ctx = { THREE, window: {} };
  vm.createContext(ctx);
  vm.runInContext(app.slice(a0, a1) + '\nthis.mergeStill = mergeStill; this.STILL_CRUMB = STILL_CRUMB;', ctx);
  const mergeStill = ctx.mergeStill;
  // a bucket: nv vertices of a box of half-size s about c, its own index,
  // uv, normal, the surface field (optional) and the baked cavity
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const mk = (mat, nv, s, c, field) => {
    const g = new THREE.BufferGeometry(), P = new Float32Array(nv * 3);
    for (let i = 0; i < nv * 3; i++) P[i] = c[i % 3] + (rnd() * 2 - 1) * s;
    const A = (n) => Float32Array.from({ length: nv * n }, () => rnd());
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(A(2), 2));
    g.setAttribute('normal', new THREE.BufferAttribute(A(3), 3));
    if (field) g.setAttribute('aStruct', new THREE.BufferAttribute(A(4), 4));
    g.setAttribute('aCav', new THREE.BufferAttribute(A(1), 1));
    const ix = new Uint16Array((nv - 2) * 3); for (let t = 0; t < nv - 2; t++) { ix[t*3] = 0; ix[t*3+1] = t + 1; ix[t*3+2] = t + 2; }
    g.setIndex(new THREE.BufferAttribute(ix, 1));
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.matrixAutoUpdate = false;
    return m;
  };
  const M1 = new THREE.MeshStandardMaterial(), M2 = new THREE.MeshStandardMaterial(),
        M3 = new THREE.MeshStandardMaterial(), M4 = new THREE.MeshStandardMaterial(),
        M5 = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.2 });
  const build = () => {
    const grp = new THREE.Group(), meshes = {}, mats = {}, rigs = [], lamps = [];
    const add = (name, mesh, rec, rig) => { meshes[name] = mesh; mats[name] = rec || {}; grp.add(mesh);
      rigs.push(Object.assign({ name, hb: null, bind: { bound: new Int32Array(0) } }, rig || {})); };
    add('B1', mk(M1, 40, 2, [0, 0, 3], true), {}, { bind: { bound: Int32Array.from([0, 1, 2]) } });   // the wing: the flex binds it
    add('A1', mk(M1, 30, 1, [0, 0, 0], true));
    add('H1', mk(M1, 20, 1, [2, 0, 0], true), {}, { hb: { per: [], hinged: new Uint8Array(20) } });  // a hinge id
    add('A2', mk(M1, 50, 1, [1, 0, 0], true));
    add('C1', mk(M2, 24, 1, [0, 1, 0], true));
    add('C2', mk(M2, 24, 1, [0, 2, 0], false));             // no surface field: a different attribute set
    add('L1', mk(M3, 12, 1, [0, 3, 0]), { lampCup: 'nav' }); lamps.push({ mesh: meshes.L1 });
    add('L2', mk(M3, 12, 1, [0, 4, 0]), { lamp: 'nav' });
    add('P1', mk(M4, 12, 0.5, [1, 1, 0]), { char: 'pilot' });
    add('P2', mk(M4, 12, 0.5, [1, 2, 0]), { sec: 'dummy1' });
    add('G1', mk(M5, 12, 1, [3, 1, 0]), { opacity: 0.2, fin: 'glass' });
    add('G2', mk(M5, 12, 1, [3, 2, 0]), { opacity: 0.2, fin: 'glass' });
    add('A3', mk(M1, 70, 1, [0, 0, 1], true));
    add('K1', mk(M1, 9, 0.03, [0, -1, 0], true));             // crumbs (G564): under 15 cm
    add('K2', mk(M1, 9, 0.05, [0, -1, 1], true));
    const D1 = mk(M1, 12, 1, [0, 0, 5], true); D1.position.set(0.5, 0, 0); D1.updateMatrix(); add('D1', D1);   // posed by the build
    const part = new THREE.Group(); part.add(mk(M1, 16, 1, [4, 0, 0], true)); grp.add(part);   // a part: not a bucket
    return { grp, meshes, mats, rigs, lamps, part };
  };
  const F = build(), orig = Object.assign({}, F.meshes), childrenBefore = F.grp.children.slice();
  const R = mergeStill(F.grp, F.meshes, F.mats, F.rigs, F.lamps);
  chk(!!R, 'G576: mergeStill returned nothing on a cage group');
  const drawn = []; F.grp.traverse(o => { if (o.isMesh) drawn.push(o); });
  console.log(`still airframe: ${childrenBefore.length - 1} buckets -> ${drawn.length - 1} meshes (merged ${R && R.from} into ${R && R.to}), skipped ${JSON.stringify(R && R.skip)}`);
  // what it took: A1, A2, A3 (one mesh, M1), K1 + K2 (one crumb mesh, M1) - and nothing else
  const mA = F.meshes.A1, mK = F.meshes.K1;
  chk(R && R.to === 2 && R.from === 5, 'G576: expected 5 buckets merged into 2 meshes');
  chk(mA !== orig.A1 && F.meshes.A2 === mA && F.meshes.A3 === mA && mA.material === M1 && mA.parent === F.grp, 'G576: A1-A3 are not one mesh on their material');
  chk(mK !== orig.K1 && F.meshes.K2 === mK && mK !== mA, 'G576: the crumbs merged with the big buckets, or not at all');
  chk(mK.userData.crumbR != null && mK.userData.crumbR < ctx.STILL_CRUMB && mA.userData.crumbR == null, 'G576: the crumb mesh does not carry its biggest member (G564)');
  for (const n of ['B1', 'H1', 'C1', 'C2', 'L1', 'L2', 'P1', 'P2', 'G1', 'G2', 'D1'])
    chk(F.meshes[n] === orig[n] && orig[n].parent === F.grp, 'G576: ' + n + ' must stay its own mesh');
  chk(F.part.children[0].parent === F.part && F.part.parent === F.grp, 'G576: a part was touched');
  chk(R && R.skip.moves === 2 && R.skip.lamp === 2 && R.skip.crew === 2 && R.skip.clear === 2 && R.skip.posed === 1, 'G576: the skip reasons are not the fixture\'s');
  for (const n of ['A1', 'A2', 'A3', 'K1', 'K2']) chk(!orig[n].parent, 'G576: ' + n + ' still drawn beside its merge');
  // the bytes: each member's own attributes, in its own frame, and its own triangles
  const exact = (list, mesh) => {
    let vo = 0, io = 0, good = true;
    const g = mesh.geometry;
    for (const n of list) {
      const s = orig[n].geometry, c = s.attributes.position.count;
      for (const k in s.attributes) {
        const A = s.attributes[k], B = g.attributes[k];
        if (!B) { good = false; continue; }
        for (let i = 0; i < c * A.itemSize; i++) if (A.array[i] !== B.array[vo * A.itemSize + i]) { good = false; break; }
      }
      for (let i = 0; i < s.index.count; i++) if (g.index.array[io + i] !== s.index.array[i] + vo) { good = false; break; }
      vo += c; io += s.index.count;
    }
    return good && vo === g.attributes.position.count && io === g.index.count;
  };
  chk(exact(mA.userData.still, mA) && mA.userData.still.join() === 'A1,A2,A3', 'G576: the merged mesh is not its members\' own bytes');
  chk(exact(mK.userData.still, mK), 'G576: the crumb mesh is not its members\' own bytes');
  chk(mA.castShadow && mA.renderOrder === orig.A1.renderOrder && mA.matrix.equals(new THREE.Matrix4()), 'G576: the merged mesh lost a flag or its frame');
  chk(F.grp.children.indexOf(mA) === childrenBefore.indexOf(orig.A1), 'G576: the merged mesh left the first member\'s place in the draw list');
  // the A/B dial
  ctx.window.FLYDIY_CRAFT_MERGE = 0;
  const F0 = build(), n0 = F0.grp.children.length;
  chk(mergeStill(F0.grp, F0.meshes, F0.mats, F0.rigs, F0.lamps) === null && F0.grp.children.length === n0, 'G576: FLYDIY_CRAFT_MERGE = 0 still merged');
  // the flown model leans on three lines: the merge runs in buildModel on the
  // cage path with the rigs bound; poseModel skips a rig that binds nothing
  // (the merge's premise); the first rig (sparDeltas' station table) is kept;
  // the roll-out's crumb rule reads the merged crumb's radius
  const ib = app.indexOf('const rigs = rigNames.filter'), im = app.indexOf('const still = data.cage ? mergeStill(');
  chk(ib > 0 && im > ib && /const still = data\.cage \? mergeStill\(grp, meshes, mats, rigs, lamps\) : null;/.test(app), 'G576: buildModel does not merge after the rigs are bound, on the cage path');
  chk(/if \(!r\.hb && !r\.bind\.bound\.length\) continue;/.test(app), 'G576: poseModel no longer skips a rig that binds nothing - the merge\'s premise is gone');
  chk(/rigs: still \? rigs\.filter\(\(r, i\) => i === 0 \|\| !still\.names\.has\(r\.name\)\) : rigs/.test(app), 'G576: the model\'s rigs lost the first rig or kept the merged ones');
  chk(/m\.userData\.crumbR != null \? m\.userData\.crumbR : m\.geometry\.boundingSphere\.radius/.test(app), 'G576: the roll-out\'s crumb rule does not read a merged crumb\'s radius');
}

console.log(why.join('\n'));
console.log(ok ? 'GATE SKIN: PASS' : 'GATE SKIN: FAIL');
process.exit(ok ? 0 : 1);
