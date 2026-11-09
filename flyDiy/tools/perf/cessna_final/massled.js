// node massled.js <build.json> [...] - the mass build-up of a build through the load door: the ledger by section (mass, centroid),
// the members by class x material (count, length, kg), the covering, empty / payload, CG, inertia
'use strict';
const path = require('path');
const TOOLS = process.env.FLYDIY_TOOLS || require('path').resolve(__dirname, '..', '..');
const L = require(path.join(TOOLS, '_treecrash_lib.js')), C = L.core(), LB = require(path.join(TOOLS, '_load_build.js'));
for (const f of process.argv.slice(2)) {
  const spec = LB.loadBuild(path.resolve(f)).spec;
  const def = C.buildGen(spec), sh = C.genShakedown(def, { slim: true });
  console.log('=== ' + path.basename(f) + '  (fuselage ' + spec.fuselage.material + ', covering ' + spec.fuselage.covering + ')');
  const led = def.parts.ledger; let E = 0, Pl = 0;
  const rows = Object.entries(led).sort((a, b) => b[1].mass - a[1].mass);
  for (const [k, e] of rows) { if (e.payload) Pl += e.mass; else E += e.mass;
    console.log('  ' + (e.payload ? 'PAYLOAD ' : '        ') + k.padEnd(14) + e.mass.toFixed(1).padStart(8) + ' kg' + (e.mx != null && e.mass > 0 ? '   x ' + (e.mx / e.mass).toFixed(2) + ' m' : '')); }
  console.log('  empty ' + E.toFixed(1) + ' kg, payload ' + Pl.toFixed(1) + ' kg, all-up ' + (E + Pl).toFixed(1) + ' (shakedown empty ' + (sh.empty != null ? sh.empty.toFixed(1) : '-') + ', mass ' + (sh.mass != null ? sh.mass.toFixed(1) : '-') + ')');
  // the members: class x material
  const by = {};
  for (const b of def.beams) {
    const a = def.nodes[b.a].p, c = def.nodes[b.b].p, len = Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
    const k = (b.cls || 'chassis') + ' / ' + (b.mat || '?') + (b.vis === false ? ' (hidden)' : '');
    const r = by[k] || (by[k] = { n: 0, len: 0, A: 0 }); r.n++; r.len += len; r.A += (b.A || 0) * len;
  }
  console.log('  members (class / material): count, total length, mean section');
  for (const [k, r] of Object.entries(by).sort((a, b) => b[1].len - a[1].len)) console.log('    ' + k.padEnd(28) + String(r.n).padStart(5) + r.len.toFixed(1).padStart(8) + ' m  A ' + (r.len ? (1e6 * r.A / r.len).toFixed(1) : '-') + ' mm2');
  // the nodes: total mass, CG, inertia about the CG (sim axes: x aft, y up, z left)
  let M = 0, cx = 0, cy = 0, cz = 0; for (const n of def.nodes) { M += n.m; cx += n.m * n.p[0]; cy += n.m * n.p[1]; cz += n.m * n.p[2]; }
  cx /= M; cy /= M; cz /= M; let Ixx = 0, Iyy = 0, Izz = 0;
  for (const n of def.nodes) { const x = n.p[0] - cx, y = n.p[1] - cy, z = n.p[2] - cz; Ixx += n.m * (y * y + z * z); Iyy += n.m * (x * x + z * z); Izz += n.m * (x * x + y * y); }
  console.log('  nodes ' + def.nodes.length + ', members ' + def.beams.length + ', all-up ' + M.toFixed(1) + ' kg, CG x ' + cx.toFixed(3) + ' y ' + cy.toFixed(3) + '; inertia roll ' + Ixx.toFixed(0) + ', yaw ' + Iyy.toFixed(0) + ', pitch ' + Izz.toFixed(0) + ' kg m2');
  console.log('  shakedown: Vs ' + (sh.Vs * 3.6).toFixed(1) + ' km/h, margin ' + (sh.staticMargin != null ? (100 * sh.staticMargin).toFixed(1) + ' %' : '-') + ', fuel ' + spec.fuel.litres + ' L, crew ' + (spec.cabin && spec.cabin.pilots));
}
