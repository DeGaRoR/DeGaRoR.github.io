// GATE ENGINELESS - THE SAILPLANE: AN AEROPLANE WITH NO POWERPLANT (the LS4, 2026-11-13).
//
// A0 for the user (13 Nov): "build an LS4 card from the motorglider ... remove the engine completely (engineless
// support: check mass/CG, the glide law, design checks, cert)"; the user: "get rid of the fuel tank obviously".
//
// The cage's engine switch (the engine page's `engOn`, drawn off) is a sailplane: the join writes one nose entry
// flagged `engines[0].none` (tools/_cage_join.js), and the core resolves it (60_gen_spec genUnpowered) to
// GEN_NO_POWERPLANT - no mass, no power, no price - with a propeller of nothing (no blades, no thrust) and no vessel;
// the drag build-up bills no cooling, no cylinder heads and no stacks (62_gen_aero genFusCdA); the energy layer draws
// no tank (tools/_cage_energy.js placeAll).
//
//   A. THE ROW: the motorglider with engOn 0 writes engines[0].none and no vessel; with it on, neither; latent - no other
//      card flies it.
//   B. THE BILL: the engine's row loses the E-811 and its installation (under 3 kg left: the nose's frame), no vessel,
//      no fuel, no propeller's mass; the empty mass falls by at least the motor; the price by at least the motor's.
//   C. THE AIR: the propeller's thrust is nothing at any throttle and speed; the body's drag rows bill no cooling, no
//      heads, no stacks.
//   D. IT FLIES: dropped at 300 m at 1.5 Vs, hands off, 10 s: every number finite, and it comes down (no thrust).
// Run: node tools/_engineless_check.js   (one final `GATE ENGINELESS: PASS|FAIL`)
'use strict';
const path = require('path');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js'));
const BJ = require(path.join(T, '_bake_joined.js')), LB = require(path.join(T, '_load_build.js'));
const L = require(path.join(T, '_treecrash_lib.js'));
const fails = [];
const ok = (c, label) => { if (!c) fails.push(label); console.log((c ? '  ok   ' : '  FAIL ') + label); };
const { D } = BJ.loadPanel();
const r1 = v => v == null ? '-' : (+v).toFixed(1), r2 = v => v == null ? '-' : (+v).toFixed(2);
const born = (key, cage) => {
  const A = D.ARCHETYPES.find(x => x.key === key);
  const over = { cage: Object.assign({}, A.over && A.over.cage, cage || {}), spec: Object.assign({}, A.over && A.over.spec) };
  const s0 = D.designBake(Object.assign({}, A.sel), over);
  return LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec;
};
const ledger = d => { const out = { empty: 0 }; for (const k in d.parts.ledger) { const e = d.parts.ledger[k]; out[k] = e.mass; if (!e.payload) out.empty += e.mass; } return out; };

console.log('A. THE ROW');
const sOn = born('motorglider'), sOff = born('motorglider', { engOn: 0 });
{ const e0 = sOff.engines[0];
  ok(sOff.engines.length === 1 && e0.none === true && Array.isArray(sOff.energy.vessels) && sOff.energy.vessels.length === 0,
     `A engOn 0 writes one entry flagged none (${JSON.stringify({ type: e0.type, none: e0.none })}) and no vessel (${sOff.energy.vessels.length})`);
  ok(!sOn.engines.some(e => 'none' in e) && sOn.energy.vessels.length > 0, `A with the engine on: no flag, its vessel kept (${sOn.energy.vessels.length})`);
  const others = D.ARCHETYPES.map(a => { try { return [a.key, born(a.key)]; } catch (e) { return [a.key, null]; } }).filter(([, s]) => s);
  const leak = others.filter(([, s]) => s.engines.some(e => e.none));
  ok(others.length > 10 && !leak.length, `A latent: none of the ${others.length} cards flies it (${leak.map(x => x[0]).join(', ') || 'none'})`); }

console.log('B. THE BILL');
const dOn = C.buildGen(JSON.parse(JSON.stringify(sOn))), dOff = C.buildGen(JSON.parse(JSON.stringify(sOff)));
const LOn = ledger(dOn), LOff = ledger(dOff);
{ const PP = C.POWERPLANTS[sOn.engines[0].type], mE = PP.engine.mass;
  ok(LOff.engines < 3 && LOn.engines > mE, `B the engine's row ${r1(LOff.engines)} kg (with the ${PP.engine.name}: ${r1(LOn.engines)})`);
  ok(!(LOff.vessel > 0) && !(LOff.fuel > 0) && dOff.spec.prop.mass === 0 && dOff.spec.prop.price === 0,
     `B no vessel (${r1(LOff.vessel)} kg), no fuel (${r1(LOff.fuel)}), a propeller of nothing (${dOff.spec.prop.mass} kg, ${dOff.spec.prop.price} cr)`);
  ok(LOn.empty - LOff.empty > mE, `B the empty mass ${r1(LOff.empty)} kg against ${r1(LOn.empty)} with the engine (the motor alone ${mE})`);
  const cost = d => { let c = 0; for (const k in d.parts.ledger) c += d.parts.ledger[k].cost || 0; return Math.round(c); };
  const pOn = cost(dOn), pOff = cost(dOff);
  ok(pOn - pOff > PP.price, `B the bill ${pOff} cr against ${pOn} (the motor ${PP.price})`); }

console.log('C. THE AIR');
{ const W = C.makeWorld(), s = C.makeSim(dOff, W); s.reset(0);
  const th = [0, 15, 30, 50].map(V => s.thrustAt(V, 0));
  const g = dOff.params.gen.drag, gOn = dOn.params.gen.drag;
  ok(th.every(t => t === 0), `C the propeller's thrust at 0 / 15 / 30 / 50 m/s: ${th.map(r2).join(' / ')} N`);
  ok(g.cool === 0 && g.heads === 0 && g.exh === 0, `C the body's drag rows: cooling ${g.cool}, heads ${g.heads}, stacks ${g.exh} (with the engine: stacks ${r2(gOn.exh)})`); }

console.log('D. IT FLIES');
{ const W0 = L.flatWorld(0), s = C.makeSim(dOff, W0.W); s.reset(0);
  C.placeAtAerodrome(s, Object.assign({}, W0.strip, { elev: 0, spawnElev: 300 }));
  const Vs = dOff.params.gen.VsMeas || dOff.params.gen.Vs, V = 1.5 * Vs, fx = Math.cos(W0.strip.hdg), fz = Math.sin(W0.strip.hdg);
  for (let i = 0; i < s.n; i++) { s.v[i * 3] = V * fx; s.v[i * 3 + 2] = V * fz; }
  const y0 = s.out.alt != null ? s.out.alt : null;
  let fin = true;
  for (let f = 0; f < 600; f++) { s.step(1 / 60); if (!s.p.every(Number.isFinite)) { fin = false; break; } }
  const cy = () => { let m = 0, y = 0; for (let i = 0; i < s.n; i++) { m += s.m[i]; y += s.m[i] * s.p[3 * i + 1]; } return y / m; };
  const h = cy();
  ok(fin && h < 300 && h > 100, `D dropped at 300 m at 1.5 Vs (${r1(V)} m/s), hands off, 10 s: finite ${fin}, the CG at ${r1(h)} m`); }

console.log(fails.length ? 'GATE ENGINELESS: FAIL (' + fails.length + ')' : 'GATE ENGINELESS: PASS');
process.exitCode = fails.length ? 1 : 0;
