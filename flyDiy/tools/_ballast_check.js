// GATE BALLAST - THE NOSE BALLAST, A GARAGE ROW (the user, 15 Nov: "add 5 kg weight ballast in nose, make it a new
// element available from garage").
//
// The cage's `noseBallast` (kg, the configuration part, absent 0) -> the join's spec.ballast.nose -> the core
// (60_gen_spec GEN_RULES.noseBallast, the normalise's clamp; 61_gen_frame bills it on the nose ring's two bottom nodes,
// its own ledger line 'ballast', the lead's price).
//
//   A. LATENT: no card but the Archaeopteryx carries a spec.ballast or a 'ballast' ledger line.
//   B. THE BILL: the motorglider with 5 kg: the line 5 kg at the nose ring's station, the empty mass +5, the price
//      +5 x pricePerKg, the CG forward; 50 kg is clamped to the rule's ceiling.
//   C. THE JOIN: the Archaeopteryx baked through the join (BJ.bakeCard) carries spec.ballast.nose 5.
//   D. THE ROW: on the page (the configuration section), in the parts' configuration list, absent 0.
// Run: node tools/_ballast_check.js   (one final `GATE BALLAST: PASS|FAIL`)
'use strict';
const path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const BJ = require(path.join(T, '_bake_joined.js')), LB = require(path.join(T, '_load_build.js'));
const fails = [];
const ok = (c, label) => { if (!c) fails.push(label); console.log((c ? '  ok   ' : '  FAIL ') + label); };
const { D } = BJ.loadPanel();
const r2 = v => v == null ? '-' : (+v).toFixed(2);
const born = (key, cage) => {
  const A = D.ARCHETYPES.find(x => x.key === key);
  const over = { cage: Object.assign({}, A.over && A.over.cage, cage || {}), spec: JSON.parse(JSON.stringify((A.over && A.over.spec) || {})) };
  const s0 = D.designBake(Object.assign({}, A.sel), over);
  return LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec;
};
const empty = d => { let m = 0; for (const k in d.parts.ledger) if (!d.parts.ledger[k].payload) m += d.parts.ledger[k].mass; return m; };
const cost = d => { let c = 0; for (const k in d.parts.ledger) c += d.parts.ledger[k].cost || 0; return c; };
const RULE = C.GEN_RULES ? C.GEN_RULES.noseBallast : null;

console.log('A. LATENT');
{ const leak = [];
  for (const A of D.ARCHETYPES) {
    let s; try { s = born(A.key); } catch (e) { continue; }
    const d = C.buildGen(JSON.parse(JSON.stringify(s)));
    const has = !!s.ballast || !!d.parts.ledger.ballast;
    if (has !== (A.key === 'archaeopteryx')) leak.push(A.key);
  }
  ok(!leak.length, `A only the Archaeopteryx carries nose ballast (${leak.join(', ') || 'none other'})`); }

console.log('B. THE BILL');
{ const s0 = born('motorglider'), s5 = born('motorglider', { noseBallast: 5 }), s50 = born('motorglider', { noseBallast: 50 });
  const d0 = C.buildGen(JSON.parse(JSON.stringify(s0))), d5 = C.buildGen(JSON.parse(JSON.stringify(s5)));
  const L = d5.parts.ledger.ballast, xN = d5.parts.ST[0].x;
  ok(s5.ballast && s5.ballast.nose === 5 && L && Math.abs(L.mass - 5) < 1e-9 && Math.abs(L.mx / L.mass - xN) < 1e-6,
     `B the line: ${r2(L && L.mass)} kg at ${r2(L && L.mx / L.mass)} m (the nose ring ${r2(xN)})`);
  // (the structure is sized on the design gross, which the lead raises: the empty mass grows by the lead and a little)
  const pr = RULE ? RULE.pricePerKg : NaN;
  ok(empty(d5) - empty(d0) >= 5 && empty(d5) - empty(d0) < 6.5 && Math.abs((L ? L.cost : 0) - 5 * pr) < 1e-6,
     `B the empty mass ${r2(empty(d0))} -> ${r2(empty(d5))} kg (the lead and its structure), the line's bill ${r2(L && L.cost)} (5 x ${pr})`);
  const cg0 = C.defCG(d0)[0], cg5 = C.defCG(d5)[0];
  ok(cg5 < cg0, `B the CG forward: ${r2(cg0)} -> ${r2(cg5)} m`);
  const d50 = C.buildGen(JSON.parse(JSON.stringify(s50))), L50 = d50.parts.ledger.ballast;
  ok(RULE && L50 && Math.abs(L50.mass - RULE.maxKg) < 1e-9, `B 50 kg asked, ${r2(L50 && L50.mass)} kg billed (the ceiling ${RULE && RULE.maxKg})`); }

console.log('C. THE JOIN');
{ const s = BJ.bakeCard('archaeopteryx').spec;
  ok(s.ballast && s.ballast.nose === 5, `C the Archaeopteryx through the join: spec.ballast ${JSON.stringify(s.ballast)}`); }

console.log('D. THE ROW');
{ const fs = require('fs');
  const p5 = fs.readFileSync(path.join(T, '_cage_page5.js'), 'utf8'), parts = fs.readFileSync(path.join(T, '_cage_parts.js'), 'utf8');
  ok(/\['noseBallast',[^\n]*\{ absent: 0 \}\]/.test(p5), 'D the page row, absent 0');
  ok(/\['configuration', \[[^\]]*'noseBallast'/.test(parts), 'D in the configuration part'); }

console.log(fails.length ? 'GATE BALLAST: FAIL (' + fails.length + ')' : 'GATE BALLAST: PASS');
process.exitCode = fails.length ? 1 : 0;
