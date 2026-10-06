// _patch_law.js (G1541, GROUND-LATTICE) - THE PREMISES' GROUND PATCH AS render_premises.js BUILDS IT, LIFTED FROM THE
// SOURCE for the node rigs (tools/ground_drawn.js, tools/ground_surface.js) - never a copy kept here.
//
//   const PL = require('./_patch_law.js')(O, PG, heightAt)   // O: the premises overlay, PG: PREMISES_GEN
//   PL.covers(x, z)   the 64 m chunk is built (activeChunks)
//   PL.vertex(x, z)   a NEAR-LEVEL patch vertex (the 2 m level, the one drawn under the aeroplane): heightAt - patchDrop r
//                     - tuck (1 - r)^2 - the near level's sink (render_premises buildPatchSteps' Y1, G2115: the deep sink
//                     SINK0_IN further in; its law read off the source: a change there is a change here)
//   PL.sinkOf(x, z)   the coarse levels' sink (Y: the deep sink from the opaque line, G660 / G1001 / G1542);
//   PL.sink0Of(x, z)  the near level's (Y1)
//   PL.at(x, z)       the patch's surface: the 2 m world grid, the triangles (a, cc, b2), (b2, cc, dd)
//   PL.patchDepth, PL.ringSink, PL.PATCH_TUCK, PL.patchDrop, PL.sinkOf, PL.act
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const lift = (src, a, b) => { const i = src.indexOf(a), j = i < 0 ? -1 : src.indexOf(b, i); if (i < 0 || j < 0) throw new Error('_patch_law: lift failed at ' + a); return src.slice(i, j); };

module.exports = function patchLaw(O, PG, heightAt) {
  const RP = fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'render_premises.js'), 'utf8');
  const PAV = require(path.join(ROOT, 'src', 'viewer', 'pavement.js'));
  const ext = lift(RP, '  const extentWorld = () =>', '\n');
  const ac = lift(RP, RP.indexOf('  const PATCH_OVERRUN = ') >= 0 ? '  const PATCH_OVERRUN = ' : '  function activeChunks(b) {', '  // THE PATCH IN BLOCKS');   // (G2115: the over-runs' box with it)
  const laws = lift(RP, '  const PATCH_TUCK = ', '  function buildPatch() {');
  // the vertex law as buildPatchSteps writes it: Y0 = groundB(x, z) - <drop> * r - PATCH_TUCK.tuck * (1 - r) * (1 - r)
  const m = /Y0\[v\] = groundB\(x, z\) - (.+?) \* r - PATCH_TUCK\.tuck \* \(1 - r\) \* \(1 - r\);/.exec(RP);
  if (!m) throw new Error('_patch_law: the patch vertex law moved (render_premises.js buildPatchSteps)');
  const S = new Function('O', 'PG', 'PCH', 'PAVEMENT', 'let patchAct = null; const PL = { res: [2] };\n' + ext + '\n' + ac + '\n' + laws +
    '\nconst b = extentWorld(); patchAct = activeChunks(b); patchB = b;' +
    '\nreturn { patchDepth, ringSink, PATCH_TUCK, act: patchAct, b, dropAt: (x, z) => ' + m[1] + ', patchDrop: typeof patchDrop === "function" ? patchDrop : null };')(O, PG, 64, PAV);
  // the pavement's sink under the patch (render_premises sinkOf, G660 / G1001), the kind argument as the page passes it
  const pavR = PAV.resolve(null, O.rec, null).recipe;
  const tlOf = q => (PAV.translucent && PAV.translucent(q.cls, q.kind) ? PAV.SINK.tl : 0);   // (G2115: a grass road's margin, the source's)
  const sinkOf = (x, z) => { const q = O.pavedAt(x, z); return q ? PAV.sinkAt(q.d, PAV.opaqueDepth(q.cls, q.halfW, pavR, q.kind), q.dPre, tlOf(q)) : 0; };
  // the near level's (G2115): the deep sink SINK0_IN further in, lifted (the patch's grid R below is the source's PL.res[0])
  const m0 = /const sink0In = \(\) => (.+?);/.exec(RP), SINK0_IN = m0 ? new Function('PL', 'return ' + m0[1])({ res: [2] }) : 0;
  // ...under the pavements that refine their rows (render_premises refinedPave, lifted with nearRunway): the town's keep the sink from the line
  const ir = RP.indexOf('  const REFINE_NEAR = '), jr = RP.indexOf('  const pavSeed = ', ir);
  const refinedPave = ir > 0 && jr > ir ? new Function('O', 'PG', RP.slice(ir, jr) + 'return refinedPave;')(O, PG) : () => true;
  const sink0Of = (x, z) => { const q = O.pavedAt(x, z); return q ? PAV.sinkAt(q.d - (refinedPave(q.id) ? SINK0_IN : 0), PAV.opaqueDepth(q.cls, q.halfW, pavR, q.kind), q.dPre, tlOf(q)) : 0; };
  const covers = (x, z) => S.act.act.has(S.act.key(Math.floor(x / 64), Math.floor(z / 64)));
  const vertex = (x, z) => { const r = Math.min(1, S.patchDepth(x, z) / S.PATCH_TUCK.tuckW);
    return heightAt(x, z) - S.dropAt(x, z) * r - S.PATCH_TUCK.tuck * (1 - r) * (1 - r) - sink0Of(x, z); };
  const R = 2;
  const at = (x, z) => {
    const i = Math.floor(x / R), j = Math.floor(z / R), fu = x / R - i, fv = z / R - j, x0 = i * R, z0 = j * R;
    if (fu + fv <= 1) return vertex(x0, z0) * (1 - fu - fv) + vertex(x0 + R, z0) * fu + vertex(x0, z0 + R) * fv;
    return vertex(x0 + R, z0 + R) * (fu + fv - 1) + vertex(x0 + R, z0) * (1 - fv) + vertex(x0, z0 + R) * (1 - fu);
  };
  return { covers, vertex, at, R, sinkOf, sink0Of, SINK0_IN, dropAt: S.dropAt, patchDrop: S.patchDrop, patchDepth: S.patchDepth, ringSink: S.ringSink, PATCH_TUCK: S.PATCH_TUCK, act: S.act };
};
