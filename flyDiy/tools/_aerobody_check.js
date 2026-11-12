#!/usr/bin/env node
// GATE AEROBODY (2026-11-12, the user's ruling: "the physics flies the body the player sees"). Every OFFICIAL plane
// (builds/lists/plane_lists.json) through the game's load door (tools/_load_build.js), the drawing's own extents read
// by a probe in the page context (tools/_aerobody_probe.js: the drawn skin's ends, the cowl layer's mesh) - not off the
// join's record, which is what is under test:
//   RECORD  the join measured the drawn body (fuselage.aeroBody) and the core flies it (gen.drag.aeroBody)
//   LENGTH  the flown body - its rows' nose to its closure, the rod to its end - is the drawn one within 2 %
//   BASE    a body that ends blunt carries its base row (cdBase x its area, inside the body row); a closed one none
//   RODS    a rod is its drawn tube (cage.rodD x planeScale, 2 %), its row cfRod x pi d L, and no aero row stands
//           behind the closure (the phantom cone was 0.36-0.71 m deep where 89-113 mm are drawn)
//   FLOOR   a twin-boom pod's lattice ends at its drawn pod (60_gen_spec: no conventional tail-arm floor on booms); a
//           rod's tail arm is the joined one
//   COWL    the outfit bills a cowl only where the editor fits one (cage.cowlOn) - COWL-BILL
//   HEIGHT  (12 Nov) the rod's drawn line in the record, checked against the fin's drawn root (it stands on the rod's
//           top), and the aft row's side force acting at the drawn centroid's height; negative control: the Rufus's rod
//           read at the closure's middle (9-19 cm) must fail
// NEGATIVE CONTROL: the Chinook and the Twin with the record removed fly the frame's body (the phantom cone) and the
// LENGTH row must fail on both - the gate can see what it was written for.
//   node tools/_aerobody_check.js  -> "GATE AEROBODY: PASS|FAIL"   (cold ~2-3 min: one page load per plane, cached after)
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.FLYDIY_JOIN_PROBE = path.join(__dirname, '_aerobody_probe.js');
const LB = require('./_load_build.js');
const C = require('./flight_core.js');
const bad = [], say = s => console.log(s);
const ok = (c, m) => { if (!c) bad.push(m); return c; };
const LIST = JSON.parse(fs.readFileSync(path.join(ROOT, 'builds/lists/plane_lists.json'), 'utf8')).planes
  .filter(p => p.list === 'official' && p.file);
const TOL = 0.02;

function judge(name, r, opts) {
  const o = opts || {}, sp = JSON.parse(JSON.stringify(r.spec));
  if (o.strip) delete sp.fuselage.aeroBody;
  const pr = typeof r.probe === 'string' ? JSON.parse(r.probe) : r.probe;
  const def = C.buildGen(sp), S = def.spec, D = def.params.gen.drag, AB = S.fuse.aeroBody, c = sp.cage || {};
  const out = { name, fails: [] };
  const f = (cnd, m) => { if (!cnd) out.fails.push(m); };
  f(pr && pr.fwOk && pr.af, 'the probe read the drawing (the drawn skin and the datum)');
  if (!pr || !pr.af) return out;
  // the drawing's extents, x from the firewall
  const zF = pr.zFw, xs = [zF - pr.af.z1, zF - pr.af.z0];
  if (pr.cowl) xs.push(zF - pr.cowl.z1, zF - pr.cowl.z0);
  const dNose = Math.min(...xs), dTail = Math.max(...xs), dL = dTail - dNose;
  // the flown body: the record's when the core flies it, else the frame's (the cowl ahead of ring 0, ST to its end)
  let fNose, fTail;
  if (AB && D.aeroBody) { fNose = AB.rows[0].x; fTail = AB.rod ? AB.rod.x1 : AB.closeX; }
  else { fNose = -(S.cowl && S.cowl.len || 0); fTail = def.parts.ST[def.parts.ST.length - 1].x; }
  const fL = fTail - fNose;
  out.dL = dL; out.fL = fL; out.err = fL / dL - 1;
  f(Math.abs(out.err) <= TOL, `LENGTH: flown ${fL.toFixed(2)} m (x ${fNose.toFixed(2)}..${fTail.toFixed(2)}) against drawn ${dL.toFixed(2)} m (x ${dNose.toFixed(2)}..${dTail.toFixed(2)}): ${(100 * out.err).toFixed(1)} %`);
  f(!!AB && !!D.aeroBody, 'RECORD: the join measured the drawn body and the core flies it');
  if (AB && D.aeroBody) {
    f(Math.abs(D.L - (AB.rows[AB.rows.length - 1].x - AB.rows[0].x)) < 1e-6, 'RECORD: the drag walks the record\'s rows');
    if (D.aeroBody === 'based') {
      f(D.baseA > 0 && Math.abs(D.base - C.GEN_DRAG.body.cdBase * D.baseA) < 1e-9, `BASE: a blunt body carries its base row (${D.baseA.toFixed(3)} m2)`);
    } else f(!D.base && !D.baseA, 'BASE: a closed body carries none');
    if (S.fuse.boom === 'rod' && !+c.boomTwin) {
      const d = (+c.rodD > 0 ? +c.rodD : 0.12) * (+c.planeScale || 1);
      f(AB.rod && Math.abs(AB.rod.d / d - 1) <= TOL, `RODS: the rod is its drawn tube (${AB.rod ? (1000 * AB.rod.d).toFixed(0) : '-'} mm against ${(1000 * d).toFixed(0)})`);
      f(AB.rod && Math.abs(D.rod - C.GEN_DRAG.body.cfRod * Math.PI * AB.rod.d * (AB.rod.x1 - AB.rod.x0)) < 1e-9, 'RODS: its row is the tube\'s');
      f(AB.rows.every(q => q.x <= AB.closeX + 1e-6), 'RODS: no aero row behind the closure');
      f(Math.abs(S.fuse.tailArm - r.spec.fuselage.tailArm) < 1e-9 || r.spec.fuselage.tailArm == null, 'FLOOR: a rod\'s tail arm is the joined one');
      // HEIGHT (12 Nov, the user: "the model ignores that setting and positions it in the middle"): the record carries
      // the drawn rod's line, and where the fin stands on the rod its root is the rod's top (median within 3 cm)
      const R0 = AB.rod;
      f(R0 && Number.isFinite(R0.y0) && Number.isFinite(R0.y1), 'HEIGHT: the record carries the drawn rod\'s line (y0, y1)');
      if (R0 && Number.isFinite(R0.y0) && pr.finRoot) {
        const top = x => R0.y0 + (R0.y1 - R0.y0) * (x - R0.x0) / (R0.x1 - R0.x0) + R0.d / 2;
        const g = pr.finRoot.filter(q => q[0] > R0.x0 + 0.05 && q[0] < R0.x1 - 0.05).map(q => Math.abs(top(q[0]) - q[1])).sort((a, b) => a - b);
        out.hGap = g.length ? g[g.length >> 1] : null;
        f(g.length >= 4 && out.hGap <= 0.03, `HEIGHT: the fin's drawn root sits on the rod's top (median ${out.hGap != null ? (100 * out.hGap).toFixed(1) : '-'} cm over ${g.length} stations)`);
      }
      // ...and the aft row's force line is at the drawn centroid's height (61_gen_frame fusDragAftW, the solver's blob)
      const AE = C.genAeroBody(S), W = def.refs.fusDragAftW, ids = def.refs.fusDragAft;
      if (AE && AE.aftY != null) {
        const yl = W ? ids.reduce((a, i, j) => a + W[j] * def.nodes[i].p[1], 0) : null;
        const yB = 0.5 * (def.nodes[ids[0]].p[1] + def.nodes[ids[1]].p[1]), yT = 0.5 * (def.nodes[ids[2]].p[1] + def.nodes[ids[3]].p[1]);
        const want = Math.max(yB, Math.min(yT, AE.aftY));
        f(W && Math.abs(yl - want) < 1e-3, `HEIGHT: the aft side force acts at the drawn centroid (${yl != null ? yl.toFixed(3) : '-'} m against ${AE.aftY.toFixed(3)})`);
      }
    }
    if (S.tail.type === 'twinBoom') {
      f(def.parts.ST[def.parts.ST.length - 1].x <= AB.closeX + 0.05, `FLOOR: the pod's lattice ends at its drawn pod (${def.parts.ST[def.parts.ST.length - 1].x.toFixed(2)} against ${AB.closeX.toFixed(2)})`);
      f(!!def.refs.boomDrag && !!def.params.boomCdAAft, 'FLOOR: the booms\' side force acts on the booms');
    }
  }
  // COWL-BILL: no cowl in the outfit's bill where the editor fits none
  if (c.cowlOn != null && !+c.cowlOn) {
    const s2 = JSON.parse(JSON.stringify(sp)); s2.cage = Object.assign({}, s2.cage, { cowlOn: 1 });
    const m0 = def.nodes.reduce((a, n) => a + n.m, 0), m1 = C.buildGen(s2).nodes.reduce((a, n) => a + n.m, 0);
    f(m1 > m0 + 0.5, `COWL: no cowl billed where none is fitted (the same build with one: +${(m1 - m0).toFixed(2)} kg)`);
  }
  return out;
}

const t0 = Date.now();
const res = {};
for (const p of LIST) {
  let r;
  try { r = LB.loadBuild(p.file); } catch (e) { ok(false, `${p.name}: the load door failed (${e.message})`); continue; }
  if (typeof r.probe === 'string' && /^ERR/.test(r.probe)) { ok(false, `${p.name}: the probe failed (${r.probe})`); continue; }
  res[p.name] = r;
  const o = judge(p.name, r);
  say(`  ${o.fails.length ? 'FAIL' : 'ok  '} ${p.name.padEnd(26)} drawn ${o.dL != null ? o.dL.toFixed(2) : '-'} m, flown ${o.fL != null ? o.fL.toFixed(2) : '-'} m (${o.err != null ? (100 * o.err).toFixed(1) : '-'} %)`);
  for (const m of o.fails) ok(false, `${p.name}: ${m}`);
}
// the negative control: the phantom body must fail LENGTH
for (const n of ['Chinook', 'Twin busher floats 4b']) {
  if (!res[n]) { ok(false, `negative control: ${n} is not on the official list`); continue; }
  const o = judge(n, res[n], { strip: true });
  const sees = o.fails.some(m => /^LENGTH/.test(m));
  say(`  ${sees ? 'ok  ' : 'FAIL'} negative control: ${n} without the record flies ${o.fL.toFixed(2)} m against ${o.dL.toFixed(2)} drawn (${(100 * o.err).toFixed(1)} %) - LENGTH ${sees ? 'fails, as it must' : 'PASSES: the gate is blind'}`);
  ok(sees, `negative control: ${n} without the record must fail LENGTH`);
}
// the HEIGHT row's negative control: the Rufus's rod read at the closure's middle (the first record's mistake, 9-19 cm)
if (res['Rufus']) {
  const r = JSON.parse(JSON.stringify(res['Rufus'])), A = r.spec.fuselage.aeroBody;
  const q = A.rows[A.rows.length - 1]; A.rod.y0 = 0.5 * (q.yb + q.yt);
  const o = judge('Rufus', r), sees = o.fails.some(m => /^HEIGHT: the fin/.test(m));
  say(`  ${sees ? 'ok  ' : 'FAIL'} negative control: the Rufus's rod read at the closure's middle - its fin root ${o.hGap != null ? (100 * o.hGap).toFixed(1) : '-'} cm off - HEIGHT ${sees ? 'fails, as it must' : 'DOES NOT FAIL'}`);
  ok(sees, 'negative control: the Rufus with its rod read at the closure must fail HEIGHT');
} else ok(false, 'negative control: the Rufus is not on the official list');
for (const b of bad) say('  FAIL ' + b);
say(`(${LIST.length} official planes, ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
say(`GATE AEROBODY: ${bad.length ? 'FAIL' : 'PASS'}`);   // (run_gates reads the verdict line exactly)
process.exit(bad.length ? 1 : 0);
