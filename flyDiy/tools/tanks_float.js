#!/usr/bin/env node
// tanks_float.js - G1385 TANKS-FLOAT: A DITCHED AEROPLANE ON ITS TANKS. One flight core (this tree's, or another
// checkout's via --core) puts a validated build on the SEA lane with its tanks full, half or empty (the burn's own
// arithmetic: every mFuel node to dry + mFuel x frac through sim.setNodeMass, the vessels' litres alike; magnetos off,
// so nothing burns while it floats) and records, every half second:
//   fbL / fbR  the freeboard at the wing roots (the innermost wing strip's front spar node, each side, over the water)
//   pitch      nose-up +, deg (off the frame's own axes); roll deg
//   cg         the mass centre's depth under the surface (m, + under)
//   top        the airframe's highest node over the surface (m): under 0, the aeroplane has sunk
//   flood      the hull slices' and wing slabs' mean fill; tankAir the tanks' submerged air (L); buoy the lift (N)
// Two entries:
//   settle  set down on the water: the lowest node 5 cm over the surface, nothing moving (the floating attitude)
//   ditch   GEAR-WATER's ditch: 80 km/h, sinking 1 m/s, 0.3 m over the water (it noses over, as a Cub does)
// Writes <out>/<core label>_<build>_<entry>_<fuel>.json. Usage:
//   node tools/tanks_float.js [--core path] [--label name] [--builds cub,cubWing,metal,jodel] [--fuel full,half,empty]
//                             [--entry settle,ditch] [--secs 300] [--out reports/evidence/TANKS-FLOAT/runs]
'use strict';
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const C = require(path.resolve(opt('core', path.join(__dirname, 'flight_core.js'))));
const LABEL = opt('label', 'this');
const OUT = path.resolve(opt('out', path.join(ROOT, 'reports', 'evidence', 'TANKS-FLOAT', 'runs')));
const SECS = +opt('secs', 300);
const FUEL = { full: 1, half: 0.5, empty: 0 };
// the validated builds; cubWing is the user's Cub with its 45 L moved to the wing roots (a PA-18's layout: the
// wing-tank path on a validated airframe, nothing else changed)
const BUILDS = {
  cub: { file: 'builds/cub_2026-09-20_corrected.json' },
  cubWing: { file: 'builds/cub_2026-09-20_corrected.json', patch: s => {
    s.fuel = Object.assign({}, s.fuel, { tank: 'wing' });
    s.energy.vessels = s.energy.vessels.map(v => Object.assign({}, v, { bay: 'wingRoot', along: 0.28, lv: null })); } },
  metal: { file: 'bugReports/cessnaMetal (1).json' },
  jodel: { file: 'builds/jodel_2026-09-20_corrected.json' },
};
// G1985 (JOIN-PARITY): each flown AS THE GAME FLIES IT - the file (and cubWing's edit) through the page's load chain
const LB = require(path.join(__dirname, '_load_build.js'));
const specOf = b => { const j = JSON.parse(fs.readFileSync(path.join(ROOT, BUILDS[b].file), 'utf8'));
  const s = JSON.parse(JSON.stringify(j.spec || j)); if (BUILDS[b].patch) BUILDS[b].patch(s);
  return process.env.FLYDIY_RAW_BUILDS === '1' ? s : LB.gameSpec(s); };
const world = C.makeWorld(), sea = world.aerodromes.find(a => a.id === 'SEA');
const D = 180 / Math.PI;

function setFuel(sim, def, frac) {
  for (let i = 0; i < def.nodes.length; i++) { const nd = def.nodes[i];
    if (nd.mFuel > 0) sim.setNodeMass(i, Math.max(0.5, nd.m - nd.mFuel) + nd.mFuel * frac); }
  const F = sim.fuel; F.frac = frac; F.kg = F.kg0 * frac; F.litres = F.litres0 * frac;
  for (const vs of F.vessels) vs.litres = vs.litres0 * frac;
}

function run(b, entry, fk) {
  const def = C.buildGen(specOf(b)), sim = C.makeSim(def, world);
  sim.reset(0); C.placeAtAerodrome(sim, sea);
  for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'off' });
  sim.ctl.thr = 0;
  setFuel(sim, def, FUEL[fk]);
  const n = def.nodes.length, p = sim.p, v = sim.v, [xA] = sim.axes(), c0 = sim.cgPos(), wh = world.waterH(c0[0], c0[2]);
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i * 3 + 1] - def.nodes[i].r);
  const hl = Math.hypot(xA[0], xA[2]);
  const V = entry === 'ditch' ? 80 / 3.6 : 0, sink = entry === 'ditch' ? 1 : 0, gap = entry === 'ditch' ? 0.3 : 0.05;
  for (let i = 0; i < n; i++) { p[i * 3 + 1] += wh + gap - yMin; v[i * 3] = -V * xA[0] / hl; v[i * 3 + 1] = -sink; v[i * 3 + 2] = -V * xA[2] / hl; }
  // the wing roots: plane 0's innermost wing strip each side, its front spar node
  const ws = (def.strips || []).filter(s => s.kind === 'wing' && !(s.plane > 0) && def.nodes[s.fIn]);
  const rootOf = sgn => { let best = null; for (const s of ws) { const z = def.nodes[s.fIn].p[2];
    if (Math.sign(z) === sgn && (!best || Math.abs(z) < Math.abs(def.nodes[best].p[2]))) best = s.fIn; } return best; };
  const rL = rootOf(-1), rR = rootOf(1);
  const mass = sim.totalM;
  const rows = [];
  let tRootsUnder = null, tSunk = null, finite = true;
  for (let s = 0; s < SECS * 60; s++) {
    sim.step(1 / 60);
    if ((s + 1) % 30) continue;
    const t = (s + 1) / 60, c = sim.cgPos(), [x2, y2, z2] = sim.axes();
    if (!Number.isFinite(c[1])) { finite = false; break; }
    const W = (x, z) => world.waterH(x, z, sim.t);
    const fb = i => i == null ? null : p[i * 3 + 1] - W(p[i * 3], p[i * 3 + 2]);
    let top = -Infinity; for (let i = 0; i < n; i++) top = Math.max(top, p[i * 3 + 1] - W(p[i * 3], p[i * 3 + 2]));
    const WB = sim.wetBody;
    let tankAir = 0;
    if (WB && WB.tanks) for (const T of WB.tanks) {
      const FV = WB.fuel && WB.fuel.vessels && WB.fuel.vessels[T.k];
      const vf = Math.min(T.vol, FV ? FV.litres / 1000 * T.share : T.fuel0);
      tankAir += 1000 * (T.vol - vf) * Math.max(0, T.wetS - T.f);
    }
    const r = { t, fbL: fb(rL), fbR: fb(rR), pitch: -Math.asin(Math.max(-1, Math.min(1, x2[1]))) * D,
                roll: Math.asin(Math.max(-1, Math.min(1, z2[1]))) * D, up: y2[1], cg: W(c[0], c[2]) - c[1], top,
                flood: sim.out.wetFlood || 0, tankAir, buoy: sim.out.wetBuoy || 0 };
    for (const k in r) if (typeof r[k] === 'number') r[k] = +r[k].toFixed(k === 'buoy' ? 0 : k === 't' ? 2 : 3);   // mm, 0.001 deg: the evidence stays small
    if ((s + 1) % 60 === 0) rows.push(r);           // stored a second apart; the moments below are found every half second
    const fbMax = Math.max(r.fbL == null ? -Infinity : r.fbL, r.fbR == null ? -Infinity : r.fbR);
    if (tRootsUnder == null && t > 2 && fbMax < 0) tRootsUnder = t;
    if (tSunk == null && top < 0) tSunk = t;
  }
  const WB = sim.wetBody;
  const tanks = WB && WB.tanks ? WB.tanks.map(T => ({ litres: +(1000 * T.vol).toFixed(1), host: T.slab ? 'wing slab' : T.host >= 0 ? 'hull slice ' + T.host : 'its own (ahead of the firewall)', holed: T.br })) : null;
  return { core: LABEL, build: b, entry, fuel: fk, frac: FUEL[fk], mass, fuelKg: sim.fuel.kg, secs: SECS, finite,
           tRootsUnder, tSunk, tanks, rows };
}

fs.mkdirSync(OUT, { recursive: true });
for (const b of opt('builds', 'cub,cubWing,metal,jodel').split(','))
  for (const entry of opt('entry', 'settle,ditch').split(','))
    for (const fk of opt('fuel', 'full,half,empty').split(',')) {
      const t0 = Date.now(), R = run(b, entry, fk);
      fs.writeFileSync(path.join(OUT, `${LABEL}_${b}_${entry}_${fk}.json`), JSON.stringify(R));
      const at = s => R.rows.find(r => r.t >= s) || R.rows[R.rows.length - 1] || {};
      const q = (s) => { const r = at(s); return `${s}s fb ${(r.fbL ?? NaN).toFixed(2)}/${(r.fbR ?? NaN).toFixed(2)} pitch ${(r.pitch ?? NaN).toFixed(0)} roll ${(r.roll ?? NaN).toFixed(0)} top ${(r.top ?? NaN).toFixed(2)}`; };
      console.log(`${LABEL} ${b} ${entry} ${fk}: ${R.mass.toFixed(0)} kg, roots under ${R.tRootsUnder ?? 'never'}, sunk ${R.tSunk ?? 'never'} | ${q(10)} | ${q(60)} | ${q(SECS)} | tanks ${JSON.stringify(R.tanks)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    }
