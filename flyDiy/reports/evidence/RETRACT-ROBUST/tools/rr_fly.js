// RETRACT-ROBUST flight (test-only): a build + cage rows -> the LOAD DOOR's spec (LB.gameSpec) -> the game's host
// (_tour_lib flyTour {game}: the page's placement, the Expert, the game's day and its breeze, damage ON), one leg,
// the gear's position sampled: when it went up, how long, down and locked at the flare, the touchdown, the breaks.
//   node reports/evidence/RETRACT-ROBUST/tools/rr_fly.js <build.json | key:<arch>> ['{"row":v}'] [--order HOME,w3] [--json out]
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..'), T = path.join(ROOT, 'tools');
const argv = process.argv.slice(2);
const SRC = argv[0], OVER = JSON.parse(argv[1] && argv[1][0] === '{' ? argv[1] : '{}');
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const order = opt('order', 'HOME,w3').split(',');
const LB = require(path.join(T, '_load_build.js'));
let raw;
if (SRC.startsWith('key:')) { const BJ = require(path.join(T, '_bake_joined.js')); const { D } = BJ.loadPanel();
  const a = D.ARCHETYPES.find(x => x.key === SRC.slice(4)); const s0 = D.designBake(a.sel, a.over); raw = { v: s0.v, spec: LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec }; }
else { raw = JSON.parse(fs.readFileSync(path.resolve(ROOT, SRC), 'utf8')); if (!raw.spec) raw = { spec: raw }; }
raw = JSON.parse(JSON.stringify(raw)); raw.spec.cage = Object.assign({}, raw.spec.cage || {}, OVER);
const spec = LB.gameSpec(raw);
const C = require(path.join(T, 'flight_core.js')), IN = require(path.join(T, 'island_node.js')), TR = require(path.join(T, '_tour_lib.js'));
const PT = require(path.join(T, 'pilot_trace.js')); PT.loadPanel();
const def = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(spec) : spec); def.params = Object.assign({}, def.params, { damage: true });
const TW = TR.tourWorld(C, IN, fs), W = TW.W;
const R = { src: SRC, over: OVER, retract: spec.gear && spec.gear.retract || null, type: spec.gear && spec.gear.type, mass: null, gear: [] };
// the sampler: wrap makeSim's step through the host's sim once the tour has made it
const t0 = Date.now();
const TS = TR.flyTour;
let sim = null; const G = { upT0: null, upT1: null, downT0: null, downT1: null, minPos: 1, flareLocked: null, cycles: 0, last: null };
const orig = C.makeSim; C.makeSim = function () { const s = orig.apply(this, arguments); sim = s; const st = s.step;
  s.step = function (dt) { st.call(this, dt); const g = s.gear && s.gear(); if (!g) return; const t = s.t != null ? s.t : 0;
    if (G.last != null) { if (G.last >= 0.999 && g.pos < 0.999) { G.cycles++; if (G.upT0 == null) G.upT0 = t; }
      if (G.upT0 != null && G.upT1 == null && g.pos <= 0.001) G.upT1 = t;
      if (G.upT1 != null && G.downT0 == null && g.pos > 0.001) G.downT0 = t;
      if (G.downT0 != null && G.downT1 == null && g.pos >= 0.999) G.downT1 = t; }
    G.minPos = Math.min(G.minPos, g.pos); G.last = g.pos; };
  return s; };
const out = TS(C, W, def, order, { game: { damage: true } });
const L = out.legs[0] || {};
R.leg = { ok: L.ok, t: L.t, faults: (L.faults || []).map(f => f.k + ': ' + f.note), verdicts: L.verdicts, landing: L.arr && L.arr.landing, damage: L.damage, phases: L.ok ? undefined : L.phases };
R.gearLog = { cycles: G.cycles, minPos: +G.minPos.toFixed(3), upAt: G.upT0, upTook: G.upT1 != null ? +(G.upT1 - G.upT0).toFixed(2) : null, downTook: G.downT1 != null ? +(G.downT1 - G.downT0).toFixed(2) : null, endPos: G.last };
R.game = out.game; R.wallS = Math.round((Date.now() - t0) / 1000);
console.log(JSON.stringify(R, null, 1));
if (opt('json', null)) fs.writeFileSync(opt('json'), JSON.stringify(R, null, 1));
