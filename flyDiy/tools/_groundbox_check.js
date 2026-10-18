#!/usr/bin/env node
// GATE GROUNDBOX - THE RING'S NORMALS FOR THE EDIT'S BOX (G3100 EDITOR-PERF).
//   node tools/_groundbox_check.js
// Every ground edit of the scenery editor re-samples the island ring's vertices under its box (render_world
// refreshGroundSteps) and computed the WHOLE ring's normals again (513 x 513 vertices). It now rewrites only the normals
// that can change - the moved vertices and every vertex of a face touching one - summed in three's own order and
// arithmetic. This gate LIFTS the page's helpers (between 'GROUND BOX (G3100) BEGIN / END' in src/viewer/render_world.js)
// and holds them against three itself (vendor/three.min.js r186):
//   1  on a PlaneGeometry (the ring's own build: rotated, heights set), after a box of its vertices moved, the box's normals
//      written over the old ones are the very normals computeVertexNormals makes for the whole geometry - every vertex,
//      bit for bit (the box's and the untouched ones'), for boxes inside, on the edge, at a corner, one vertex, flat ground
//   2  the faces of each vertex (groundAdj) are its faces in index order; the count rewritten is the moved vertices' one-ring
//   3  the page: the box path for an indexed ring under a quarter moved, the whole call otherwise, ?groundbox=0 the old
// Exits non-zero on any red; prints GATE GROUNDBOX: PASS / FAIL.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const THREE = require(path.join(ROOT, 'vendor', 'three.min.js'));
const SRC = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_world.js'), 'utf8');
const fail = []; let checks = 0;
const check = (ok, what, detail) => { checks++; if (!ok) fail.push(what + (detail ? ' - ' + detail : '')); return ok; };

const a = SRC.indexOf('// ---- GROUND BOX (G3100) BEGIN'), b = SRC.indexOf('// ---- GROUND BOX (G3100) END');
if (!check(a >= 0 && b > a, '0 the page has the GROUND BOX helpers between their markers')) { for (const f of fail) console.log('  ! ' + f); console.log('GATE GROUNDBOX: FAIL'); process.exit(1); }
const ctx = { Math, Uint32Array, Float32Array, Set };
vm.createContext(ctx);
vm.runInContext(SRC.slice(a, b) + '\n;this.H = { groundAdj, groundNormalsBox };', ctx);
const H = ctx.H;

let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const hAt = (x, z, k) => 40 * Math.sin(x / 180 + k) + 25 * Math.cos(z / 130 - k) + 6 * Math.sin((x + z) / 23) + (rnd() - 0.5) * 2;
function ring(seg, size, flat) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, flat ? 3 : hAt(p.getX(i), p.getZ(i), 0));
  g.computeVertexNormals(); return g;
}
// 1 a box moved: the box path over the old normals = three's whole call, every vertex
function trial(name, seg, size, box, flat) {
  const g = ring(seg, size, flat), p = g.attributes.position, moved = [];
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); if (x >= box[0] && x <= box[2] && z >= box[1] && z <= box[3]) { p.setY(i, flat ? 3 : hAt(x, z, 1.3)); moved.push(i); } }
  const ref = g.clone(); ref.computeVertexNormals();
  const A = H.groundAdj(g.index.array, p.count), n = H.groundNormalsBox(p.array, g.attributes.normal.array, g.index.array, A, moved);
  const R = ref.attributes.normal.array, N = g.attributes.normal.array; let bad = 0, first = -1;
  for (let k = 0; k < N.length; k++) if (N[k] !== R[k]) { bad++; if (first < 0) first = k; }
  check(moved.length > 0 && bad === 0, '1 ' + name + ': ' + moved.length + ' moved, ' + n + ' normals rewritten - every normal of the ring the whole call\'s, bit for bit', bad + ' differ' + (first >= 0 ? ' (first at vertex ' + Math.floor(first / 3) + ': ' + N[first] + ' vs ' + R[first] + ')' : ''));
  return { moved: moved.length, n, A, g };
}
trial('a box inside', 128, 4000, [-400, -300, 250, 380]);
trial('a box on the edge', 128, 4000, [1700, -500, 2100, 500]);
trial('a box at a corner', 96, 4000, [-2100, -2100, -1500, -1600]);
trial('one vertex', 64, 2000, [-1, -1, 1, 1]);
trial('flat ground', 64, 2000, [-300, -300, 300, 300], true);
const big = trial('a large box', 256, 18000, [-3000, -2500, 4000, 2600]);

// 2 the adjacency: each vertex's faces in index order, each face listed by its three vertices; the one-ring count
{
  const g = ring(32, 1000), I = g.index.array, A = H.groundAdj(I, g.attributes.position.count);
  let bad = 0; for (let v = 0; v < g.attributes.position.count; v++) { let last = -1; for (let k = A.start[v]; k < A.start[v + 1]; k++) { const f = A.fac[k]; if (!(f > last) || (I[f] !== v && I[f + 1] !== v && I[f + 2] !== v)) bad++; last = f; } }
  check(bad === 0 && A.start[g.attributes.position.count] === I.length, '2 each vertex\'s faces are its own, in index order (' + I.length / 3 + ' faces)', bad + ' wrong');
  const p = g.attributes.position, mid = (16 * 33 + 16), n = H.groundNormalsBox(p.array, g.attributes.normal.array, I, A, [mid]);
  check(n === 7, '2 one inner vertex moved rewrites its one-ring: itself and its six neighbours (PlaneGeometry\'s diagonal)', n + ' rewritten');
}

// 3 the page
{
  check(/const box = GBOX\.on && g\.index && g\.attributes\.normal \? \[\] : null;/.test(SRC) && /if \(box && n < pa\.count \/ 4\)/.test(SRC) && /\} else g\.computeVertexNormals\(\);/.test(SRC), '3 refreshGroundSteps: the box path for an indexed ring under a quarter moved, the whole call otherwise');
  check(/\[\?&\]groundbox=0\(&\|\$\)/.test(SRC) && /g\.attributes\.normal\.needsUpdate = true;/.test(SRC), '3 ?groundbox=0 the old way; the normals uploaded again');
}

if (fail.length) { for (const f of fail) console.log('  ! ' + f); console.log('GATE GROUNDBOX: FAIL (' + fail.length + ')'); process.exit(1); }
console.log('  ' + checks + ' checks (a large box: ' + big.moved + ' moved, ' + big.n + ' normals of ' + big.g.attributes.position.count + ')');
console.log('GATE GROUNDBOX: PASS');
