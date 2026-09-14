#!/usr/bin/env node
// ============================================================
// PILOT TRACE (P0.1 of PILOT-ROADMAP-2026-09-14.md) — ONE FLIGHT, MEASURED.
//
// The scratch runner that found every G381 defect (the cub joining every leg
// 13 s late, the level segment sagging 25 m, the flare rotating 2.7 deg in
// 3 s, the tail swinging 72 deg at 17 m/s, DECRAB's sign) made a tool: any
// archetype (or a saved spec file), any aerodrome pair, any day, any style,
// the drawn tail on request — flown by THE PILOT (43_pilot.js) to a stop, and
// judged by NUMBERS, not by "it landed":
//
//   node tools/pilot_trace.js cub                        the calm HOME circuit
//   node tools/pilot_trace.js c172 --wind 2,2 --style brisk
//   node tools/pilot_trace.js stearman --from HOME --to A3 --oat 30
//   node tools/pilot_trace.js caravan --drawn-tail --csv
//   node tools/pilot_trace.js my_build.json --to A5
//   node tools/pilot_trace.js cub --slope 0.04     HOME tilted 4 % (the landing runs downhill)
//   node tools/pilot_trace.js cub --no-sheet       genAP's ladder instead of the machine sheet's (P0.4; the sheet is the default)
//   node tools/pilot_trace.js cub --no-tecs        the mode zoo instead of the total-energy law (P0.5; TECS is the default)
//   node tools/pilot_trace.js cub --no-path        the pursuit + arc instead of L1 over the filleted path (P0.6; the path is the default)
//
// Options: --from ID --to ID (aerodrome ids, HOME default; --to alone flies a
// cross-country from HOME) · --wind x,z (m/s, the air's velocity) · --gust g ·
// --oat C · --qnh Pa · --style cautious|normal|brisk · --drawn-tail (the
// headless tail build, as GATE ARCHETYPES flies it) · --max S (the clock) ·
// --csv [file] (the 0.1 s trace: t, phase, agl, aglT, V, vs, pitch, bank, e,
// xt, s, thr, de, dr, flap, offtrack, above, rem, onG, x, z) · --json file ·
// --quiet (the JSON line only).
//
// The LAST LINE of stdout is the JSON summary (`pilot_matrix.js` reads it):
//   { key, from, to, weather, style, tail, outcome, t, phases, goArounds,
//     verdicts, takeoff: { run, Vlo }, climb: { hTurn, vsMean },
//     legs: [{ name, overshoot, settleT, rollRev }], final: { aboveRms, vRms,
//     vErrMean, thrMin, thrMax, captureT }, flare: { entryAgl, entryVs, dur },
//     landing: { sink, V, VoverVs, pastAim, off, run, three, drift },
//     rollout: { maxE, zeroX, maxDr, xtEnd }, wall }
//
// PURE NODE, no THREE: the panel is loaded the way arch_fly.js loads it (the
// pre-join spec is designBake's, exactly what the birth overlay applies).
// `runTrace(opts)` is exported for the matrix.
// ============================================================
'use strict';
const path = require('path');
const fs = require('fs');
const T = __dirname;

// THE CORE UNDER TEST: `--core <file>` (or PILOT_CORE) loads that flight_core
// instead of tools/flight_core.js — every session's build.js overwrites the
// shared one from ITS sources, and a matrix that takes an hour must not read
// a file that changed under it (pilot_matrix.js snapshots it per run)
let CORE_PATH = process.env.PILOT_CORE || path.join(T, 'flight_core.js');
function coreOf() { return require(CORE_PATH); }
function loadPanel() {
  if (global.__PILOT_TRACE_PANEL) return;
  const CORE = coreOf();
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj { constructor() { this.children = []; this.position = { set: noop }; this.rotation = {}; this.scale = { set: noop, setScalar: noop }; } add() { return this; } remove() {} traverse() {} }
  global.THREE = new Proxy({}, { get: (t, k) => { if (k === 'Vector3') return function () { return { set: noop, x: 0, y: 0, z: 0 }; }; return class extends Obj {}; } });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js', '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js', '_cage_gear.js', '_fit_site.js', '_fit_gen.js', '_eng_gen.js', '_eng_mesh.js', '_eng_page.js', '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js', '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js', '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  global.window.CAGE_JOIN_ENGINES = require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES;
  global.__PILOT_TRACE_PANEL = true;
}

// the spec to fly: an archetype key, or a saved file ({ what: 'flydiy-build', spec } or a bare spec)
function specOf(key, drawnTail) {
  const D = require(path.join(T, '_cage_design.js'));
  if (/\.json$/i.test(key)) {
    const raw = JSON.parse(fs.readFileSync(key, 'utf8'));
    return { spec: raw.spec || raw, name: raw.name || path.basename(key), tail: 'file' };
  }
  const a = D.ARCHETYPES.find(x => x.key === key);
  if (!a) throw new Error('no such archetype: ' + key + '\n  keys: ' + D.ARCHETYPES.map(x => x.key).join(' '));
  const inactive = D.archInactive(a);
  if (inactive) throw new Error('archetype ' + key + ' is inactive: ' + inactive);
  const spec = D.designBake(a.sel, a.over);
  let tail = 'rule';
  if (drawnTail) {
    const TH = require(path.join(T, '_tail_headless.js'));
    const full = D.designFull(a.sel, a.over).full;
    const tb = TH.tailBuild(full, { level: 2 });
    if (!tb.approx.length) { TH.tailApply(spec, TH.tailRows(tb)); tail = 'drawn'; }
    else tail = 'rule (' + tb.approx.join('; ') + ')';
  }
  return { spec, name: a.name, tail, role: a.sel.role };
}

const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const rms = a => a.length ? Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length) : null;
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;

function runTrace(o) {
  if (o.core) CORE_PATH = path.resolve(o.core);
  loadPanel();
  const C = coreOf();
  const t0 = Date.now();
  const S = specOf(o.key, o.drawnTail);
  const world0 = C.makeWorld();
  const weather = {};
  if (o.wind || o.gust) weather.wind = { base: [o.wind ? o.wind[0] : 0, 0, o.wind ? o.wind[1] : 0], gust: o.gust || 0, refH: 10 };
  if (o.oat != null) weather.oatC = o.oat;
  if (o.qnh != null) weather.qnhPa = o.qnh;
  if (Object.keys(weather).length) world0.setWeather(weather);
  // A FIXTURE'S HOOK: `worldMod(world)` returns a replacement world (HOTHIGH's
  // `Object.assign({}, W, { terrainH })` trick — the solver's wheels and the
  // pilot's aglT both read `world.terrainH`, the aerodrome record keeps its
  // single `elev`, which is exactly what a sloped strip tests)
  let world = world0;
  if (typeof o.worldMod === 'function') world = o.worldMod(world0) || world0;
  // --slope g: the ground under the departure aerodrome tilts along the strip's
  // axis, zero at the spawn (so the aeroplane starts on the ground), g per metre
  // toward +hdg-direction... in HOME's frame +x: g > 0 = the landing (along -x
  // in calm air, the take-off direction) runs DOWNHILL, g < 0 uphill
  if (o.slope) {
    const a0 = world.aerodromes.find(a => a.id === (o.from || 'HOME'));
    const sp = a0.spawn || [a0.x, a0.z];
    const ux = Math.cos(a0.hdg), uz = Math.sin(a0.hdg);     // +hdg direction; HOME: -x
    const base = world.terrainH;
    const tilt = (x, z) => {
      const s0 = (x - sp[0]) * ux + (z - sp[1]) * uz;          // along +hdg from the spawn
      const c0 = -(x - sp[0]) * uz + (z - sp[1]) * ux;         // across
      // the plane covers the strip and 20 % beyond each end, then fades over 40 % of the length
      const along = Math.abs(s0), inside = Math.max(0, Math.min(1, (a0.len * 1.6 - along) / (a0.len * 0.4)));
      const wide = Math.max(0, Math.min(1, (400 - Math.abs(c0)) / 200));
      return -o.slope * s0 * inside * wide;                    // g > 0: ground FALLS along -hdg... see the sign note in the summary
    };
    world = Object.assign({}, world, { terrainH: (x, z) => base(x, z) + tilt(x, z) });
  }
  const from = world.aerodromes.find(a => a.id === (o.from || 'HOME'));
  const to = o.to ? world.aerodromes.find(a => a.id === o.to) : from;
  if (!from) throw new Error('unknown aerodrome ' + o.from);
  if (!to) throw new Error('unknown aerodrome ' + o.to);
  const def = C.buildGen(S.spec);
  const sim = C.makeSim(def, world);
  sim.reset(0);
  if (from.id !== 'HOME') C.placeAtAerodrome(sim, from);
  for (let i = 0; i < 600; i++) sim.step(1 / 60);
  // the machine sheet (P0.4): the shakedown handed lazily (2 s, once), the ladder flag on request
  let shk = null;
  const ap = C.makePilot(sim, def, world, { style: o.style || 'normal', sheet: o.sheet !== false, tecs: o.tecs !== false, path: o.path !== false, shakedown: () => shk || (shk = C.genShakedown(def, { corners: false })) });
  if (from !== to || from.id !== 'HOME') ap.setRoute(from, to);
  const A = def.params.ap, G = def.params.gen;
  // V/Vs is judged against the stall in the LANDING configuration
  const FS = def.params.flaps, VsL = (FS && (FS.ldg ?? 1) > 0 && G.VsFlap) ? G.VsFlap : G.Vs;
  const Vs = G.Vs, VAppr = ap.VAppr * ({ cautious: 1.06, normal: 1, brisk: 0.97 }[o.style || 'normal'] || 1);
  const glider = S.role === 'glider';
  const maxS = o.maxS || (glider ? 640 : (from !== to ? 900 : 420));
  const rows = [], phases = [];
  let last = null, tEnd = maxS, nan = false;
  // the collectors
  let rollS0 = null, lo = null, hTurn = null, climbVs = [];
  const legs = []; let leg = null;
  let capT = null, above = [], vErr = [], thrs = [];
  let flare = null; const roll = { e: [], dr: [], xt: [] };
  for (let s = 0; s < maxS * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    const t = s / 60, d = ap.dbg, c = sim.ctl, v = sim.cgVel(), ph = ap.phase, onG = sim.wheelsOnGround();
    const cd = (ap.status && ap.status.conds) || [];
    const g = k => { const q = cd.find(x => x.what === k); return q ? q.have : null; };
    if (ph !== last) {
      phases.push({ ph, t: r1(t) });
      if (ph === 'ROLL') rollS0 = d.s;
      if (ph === 'CROSSWIND' && hTurn == null) hTurn = r1(d.agl);
      if (['CROSSWIND', 'DOWNWIND', 'BASE', 'ENROUTE', 'INBOUND'].includes(ph)) {
        if (leg) legs.push(leg);
        leg = { name: ph, t0: t, xt0: null, crossed: false, overshoot: 0, settleT: null, n: 0, bank: [] };
      } else if (leg) { legs.push(leg); leg = null; }
      if (ph === 'FLARE') flare = { entryAgl: r2(d.agl), entryVs: r2(v[1]), t0: t };
      if (ph === 'ROLLOUT' && flare && flare.dur == null) flare.dur = r1(t - flare.t0);
      last = ph;
    }
    if (ph === 'LIFTOFF' && lo == null && rollS0 != null) lo = { run: Math.round(Math.abs(d.s - rollS0)), Vlo: r1(d.V) };
    if (ph === 'CLIMB') climbVs.push(v[1]);
    if (leg) {
      // the SIGNED cross-track to the current leg (the status line carries |xt|)
      let xt = null;
      const Lg = ap.legs && ap.legs[ap.legI], cgp = sim.cgPos();
      if (Lg && Lg.A && Lg.B) {
        const dx = Lg.B[0] - Lg.A[0], dz = Lg.B[1] - Lg.A[1], ln = Math.hypot(dx, dz) || 1e-9;
        xt = (-(cgp[0] - Lg.A[0]) * dz + (cgp[2] - Lg.A[1]) * dx) / ln;
      }
      leg.bank.push(d.ph * 57.3);
      if (xt != null) {
        leg.n++;
        if (leg.xt0 == null) leg.xt0 = xt;
        // the OVERSHOOT: the largest cross-track after the aeroplane has first
        // REACHED the leg (|xt| < 15 m) — an arc that joins from a radius
        // inside reads 0; a pursuit that crosses and swings back reads its swing
        if (!leg.crossed && Math.abs(xt) < 15) leg.crossed = true;
        else if (leg.crossed) leg.overshoot = Math.max(leg.overshoot, Math.abs(xt));
        if (leg.settleT == null && t - leg.t0 > 8 && Math.abs(xt) < 20) leg.settleT = r1(t - leg.t0);
      }
    }
    if (ph === 'FINAL') {
      const ab = g('above slope');
      if (capT == null && ab != null && Math.abs(ab) < 4 && (t - (phases[phases.length - 1].t)) > 5) capT = t;
      if (capT != null) { if (ab != null) above.push(ab); vErr.push(d.V - VAppr); thrs.push(c.thr); }
    }
    if (ph === 'ROLLOUT') { roll.e.push(d.e * 57.3); roll.dr.push(c.dr); roll.xt.push(d.z); }
    if (o.csv && s % 6 === 0)
      rows.push([t.toFixed(2), ph, d.agl.toFixed(2), (ap._m ? ap._m.aglT : d.agl).toFixed(2), d.V.toFixed(2), v[1].toFixed(2),
                 (d.th * 57.3).toFixed(1), (d.ph * 57.3).toFixed(1), (d.e * 57.3).toFixed(1), d.z.toFixed(1), d.s.toFixed(0),
                 c.thr.toFixed(2), c.de.toFixed(3), c.dr.toFixed(3), (c.flap || 0).toFixed(2),
                 g('off track') ?? '', g('above slope') ?? '', g('to the turn') ?? g('to the aim') ?? '', onG,
                 ap._m ? ap._m.x.toFixed(0) : '', ap._m ? ap._m.z.toFixed(0) : '',
                 d.tecs ? d.tecs.hdotC.toFixed(2) : '', d.tecs ? d.tecs.Vc.toFixed(1) : '', d.tecs ? d.tecs.wK.toFixed(2) : '', d.tecs ? d.tecs.thC.toFixed(3) : ''].join(','));
    if (sim.stats().bad) { nan = true; tEnd = t; break; }
    if (ph === 'STOPPED' && ap.t > 5) { tEnd = t; break; }
  }
  if (leg) legs.push(leg);
  const rep = ap.report, L = rep.landing, TD = ap.tdInfo;
  let zeroX = 0;
  for (let i = 1; i < roll.e.length; i++) if (roll.e[i - 1] * roll.e[i] < 0 && Math.abs(roll.e[i]) > 0.5) zeroX++;
  const out = {
    key: o.key, name: S.name, from: from.id, to: to.id, style: o.style || 'normal', tail: S.tail, slope: o.slope || 0,
    weather: Object.keys(weather).length ? weather : null,
    outcome: nan ? 'broke-up' : (rep.outcome || 'gave-up'), phase: ap.phase, t: r1(tEnd),
    phases: phases.map(p => p.ph + '@' + p.t),
    goArounds: ap.gaN || 0,
    verdicts: rep.verdicts.map(x => x.t + 's ' + x.code + ': ' + x.note),
    takeoff: lo, climb: { hTurn, vsMean: climbVs.length ? r2(mean(climbVs)) : null },
    // rollRev: the roll LIMIT CYCLE on the leg as bank-rate REVERSALS per minute
    // with more than 2 deg of swing between them — a clean fillet (roll in,
    // hold, roll out) counts 2; the C172's 9-22 deg cycle at 2 s counted 30+
    legs: legs.map(l => { const b = l.bank; let rev = 0, dir = 0, ext = b[0] || 0;
      for (let i = 1; i < b.length; i++) { const d = b[i] - ext;
        if (dir >= 0 && d > 2) { dir = 1; ext = b[i]; } else if (dir <= 0 && d < -2) { dir = -1; ext = b[i]; }
        else if (dir > 0 && b[i] > ext) ext = b[i]; else if (dir < 0 && b[i] < ext) ext = b[i];
        else if ((dir > 0 && d < -2) || (dir < 0 && d > 2)) { rev++; dir = -dir; ext = b[i]; } }
      const mins = Math.max(0.1, b.length / 600);
      return { name: l.name, overshoot: Math.round(l.overshoot), settleT: l.settleT, rollRev: r1(rev / mins) }; }),
    final: capT == null ? null : { captureT: r1(capT), aboveRms: r1(rms(above)), vRms: r2(rms(vErr)), vErrMean: r2(mean(vErr)),
                                   thrMin: r2(Math.min(...thrs)), thrMax: r2(Math.max(...thrs)) },
    flare: flare,
    landing: L ? { sink: L.sink, V: L.V, VoverVs: r2(L.V / VsL), pastAim: L.pastAim, off: L.offCentre, run: L.run,
                   three: !!L.three, drift: TD ? r2(TD.drift) : null } : null,
    rollout: roll.e.length ? { maxE: r1(Math.max(...roll.e.map(Math.abs))), zeroX, maxDr: r2(Math.max(...roll.dr.map(Math.abs))),
                               xtEnd: r1(roll.xt[roll.xt.length - 1]) } : null,
    Vs: r1(Vs), VsLanding: r1(VsL), VAppr: r1(VAppr), mass: Math.round(sim.totalM),
    sheet: ap.useSheet ? ap.sheet.show() : null, tecs: ap.useTecs, path: ap.usePath,
    wall: Math.round((Date.now() - t0) / 1000),
  };
  if (o.csv) {
    const f = typeof o.csv === 'string' ? o.csv : (o.key.replace(/\.json$/i, '') + '_' + from.id + (to !== from ? '-' + to.id : '') + (o.wind ? '_w' : '') + '.csv');
    fs.writeFileSync(f, 't,phase,agl,aglT,V,vs,pitch,bank,e,xt,s,thr,de,dr,flap,offtrack,above,rem,onG,x,z,hdotC,Vc,wK,thC' + String.fromCharCode(10) + rows.join('\n'));
    out.csv = f;
  }
  return out;
}

function parseArgs(argv) {
  const o = { key: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], nx = () => argv[++i];
    if (a === '--from') o.from = nx();
    else if (a === '--to') o.to = nx();
    else if (a === '--wind') o.wind = nx().split(',').map(Number);
    else if (a === '--gust') o.gust = +nx();
    else if (a === '--oat') o.oat = +nx();
    else if (a === '--qnh') o.qnh = +nx();
    else if (a === '--style') o.style = nx();
    else if (a === '--max') o.maxS = +nx();
    else if (a === '--slope') o.slope = +nx();
    else if (a === '--sheet') o.sheet = true;
    else if (a === '--tecs') o.tecs = true;
    else if (a === '--no-sheet') o.sheet = false;
    else if (a === '--no-tecs') o.tecs = false;
    else if (a === '--no-path') o.path = false;
    else if (a === '--core') o.core = nx();
    else if (a === '--drawn-tail') o.drawnTail = true;
    else if (a === '--csv') o.csv = (argv[i + 1] && !argv[i + 1].startsWith('--')) ? nx() : true;
    else if (a === '--json') o.json = nx();
    else if (a === '--quiet') o.quiet = true;
    else if (!a.startsWith('--')) o.key = a;
  }
  return o;
}

if (require.main === module) {
  const o = parseArgs(process.argv.slice(2));
  if (!o.key) { console.log('usage: node tools/pilot_trace.js <archetype|spec.json> [--from ID] [--to ID] [--wind x,z] [--gust g] [--oat C] [--qnh Pa] [--style s] [--drawn-tail] [--max S] [--csv [file]] [--json file] [--quiet]'); process.exit(1); }
  let out;
  try { out = runTrace(o); }
  catch (e) { console.log(JSON.stringify({ key: o.key, error: e.message })); process.exit(1); }
  if (!o.quiet) {
    console.log(out.name + ' (' + out.tail + ' tail) ' + out.from + (out.to !== out.from ? ' -> ' + out.to : '') +
                (out.weather ? ' ' + JSON.stringify(out.weather) : ' calm') + ' · ' + out.style);
    console.log('  ' + out.phases.join(' '));
    if (out.takeoff) console.log('  take-off: run ' + out.takeoff.run + ' m, lift-off ' + out.takeoff.Vlo + ' m/s · crosswind turn at ' + out.climb.hTurn + ' m');
    for (const l of out.legs) console.log('  ' + l.name.padEnd(9) + ' overshoot ' + String(l.overshoot).padStart(4) + ' m  settle ' + (l.settleT == null ? '  —' : l.settleT + ' s') + '  roll reversals ' + l.rollRev + '/min');
    if (out.final) console.log('  final: captured at ' + out.final.captureT + ' s · above-slope rms ' + out.final.aboveRms + ' m · V-VAppr rms ' + out.final.vRms + ' (mean ' + out.final.vErrMean + ') · thr ' + out.final.thrMin + '..' + out.final.thrMax);
    if (out.flare) console.log('  flare: from ' + out.flare.entryAgl + ' m at ' + out.flare.entryVs + ' m/s, ' + out.flare.dur + ' s');
    if (out.landing) console.log('  landing: sink ' + out.landing.sink + ' m/s · ' + out.landing.V + ' m/s = ' + out.landing.VoverVs + ' Vs · ' + out.landing.pastAim + ' m past the aim · ' + out.landing.off + ' m off · run ' + out.landing.run + ' m' + (out.landing.three ? ' · three-point' : ''));
    if (out.rollout) console.log('  rollout: max heading ' + out.rollout.maxE + ' deg, ' + out.rollout.zeroX + ' reversals, rudder ' + out.rollout.maxDr + ' · ' + out.rollout.xtEnd + ' m off at the stop');
    for (const v of out.verdicts) console.log('  ! ' + v);
    console.log('  ' + out.outcome + ' at ' + out.t + ' s (' + out.wall + ' s wall)');
  }
  if (o.json) fs.writeFileSync(o.json, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out));
}
module.exports = { runTrace, parseArgs, specOf, loadPanel };
