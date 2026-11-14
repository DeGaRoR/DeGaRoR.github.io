#!/usr/bin/env node
// GATE SNOWMUDFX (SNOW-MUD FX, 2026-11-13) — THE SNOW'S CLOUD AND THE MUD'S PROJECTION, ON THE DUST'S ONE SYSTEM.
//
// The user (13 Nov): "a professional looking particle system ... snow should certainly have some snow clouds, particularly
// in the powder snow ... mud doesn't have a cloud, but it should have projection, maybe inspired by what we have for the
// water". The scout and the decision: futureDesigns/SNOW-MUD-FX-2026-11-13.md. dust.js carries four soft classes
// (mud 5, packed snow 6, powder 7, slush 8) with their own laws, three new thrown kinds (3 drift, 4 clump, 5 drop) and a
// splat ring; the dust's five classes keep theirs.
//
//   node tools/_snowmud_fx_check.js            -> "GATE SNOWMUDFX: PASS|FAIL"
//   node tools/_snowmud_fx_check.js --show     -> the numbers per class and scenario
//   node tools/_snowmud_fx_check.js --selftest -> negative verification (doctored laws go red)
//
// A. THE DUST UNCHANGED: the five dust classes' rows carry only their four keys; their albedo range a soil's.
// B. SNOW: powder's run-up cloud at least 1.5 x dirt's, packed snow's under a tenth of powder's (the thresholds: u*t
//    0.07-0.25 m/s fresh, 4-10 x that packed - Pomeroy & Gray); it SETTLES - 30 s after its peak it keeps under half what
//    dirt's keeps; the saltation skin (drift) on both snows under the jet, none on dirt; its albedo a snow's
//    (>= 0.5) where the dust's is held to a soil's (<= 0.32); powder's plough throws clumps only from a sinking wheel.
// C. MUD (and slush): NO CLOUD in any scenario; clods and drops thrown, none higher than 2 m (the legs, the wing's underside);
//    the tread sheds at speed and not at a walk (v^2/R against the adhesion); the bow wave grows with the sinkage; landed ones SPLAT and lie (still there 15 s after the aeroplane stopped); a wheel never throws past its
//    budget; a full ring of fresh splats is never overwritten.
// D. THE WIRING: the shader draws the splat in the ground's plane and the snow's own phase; app.js maps the codes 8-12
//    and lets the code decide under the pavement's snow and mud; the bench lists the four surfaces.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SHOW = process.argv.includes('--show'), SELF = process.argv.includes('--selftest');
const log = s => { if (SHOW) console.log('  ' + s); };
const fresh = () => { delete require.cache[require.resolve(path.join(ROOT, 'src', 'viewer', 'dust.js'))]; return require(path.join(ROOT, 'src', 'viewer', 'dust.js')); };

// ---- the scenarios (GATE DUST's kinematics: a Cub-like taildragger, 2000 N static, 1.84 m disc) --------------------
const DISC = Math.PI * 0.92 * 0.92, washOf = (V, thr) => Math.sqrt(V * V + 2 * 2000 * thr / (1.225 * DISC)) - V;
function takeoff(t, sink) {
  const st = { wheels: [], props: [], wing: null };
  const p = t < 6 ? 0 : t - 6, V = Math.min(22, 2 * p), x = p * p, air = 2 * p >= 22, y = air ? (p - 11) * 1.5 : 0, thr = t < 1 ? 0.1 : 1;
  for (const [k, z] of [[0, -0.9], [1, 0.9]]) st.wheels.push({ key: k, x, y: 0, z, vx: V, vy: 0, vz: 0, on: !air, R: 0.3, brake: 0, sink });
  st.props.push({ x: x + 1.5, y: 1.3 + y, z: 0, ax: Math.cos(0.19), ay: Math.sin(0.19), az: 0, R: 0.92, wash: washOf(V, thr) });
  st.wing = { span: 10.7, W: 5300, V: Math.max(V, 1), rho: 1.225, tips: [[x, 2 + y, -5.35], [x, 2 + y, 5.35]] };
  return st;
}
function runup(t) {
  const st = { wheels: [{ key: 0, x: 0, y: 0, z: -0.9, vx: 0, vy: 0, vz: 0, on: true, R: 0.3 }, { key: 1, x: 0, y: 0, z: 0.9, vx: 0, vy: 0, vz: 0, on: true, R: 0.3 }], props: [], wing: null };
  st.props.push({ x: 1.5, y: 1.3, z: 0, ax: Math.cos(0.19), ay: Math.sin(0.19), az: 0, R: 0.92, wash: washOf(0, t < 12 ? 0.85 : 0.1) });
  return st;
}
// a roll at constant speed V for T s, then stopped (the splats' persistence)
const roll = (V, T) => (t, sink) => ({ wheels: [0, 1].map(k => ({ key: k, x: Math.min(t, T) * V, y: 0, z: k ? 0.9 : -0.9, vx: t < T ? V : 0, vy: 0, vz: 0, on: true, R: 0.3, brake: 0, sink })), props: [], wing: null });
function run(D, scen, ci, sink, T) {
  const sys = D.makeSystem('gamer');
  const env = { groundH: () => 0, wind: () => [2, 0, 2], cls: () => ci, wet: () => 0, puddle: () => 0, k: 1 };
  const dt = 1 / 30, kinds = {}, mass = [];
  let maxH = 0, splat = [], perFrame = 0, overwrote = 0;
  for (let f = 0; f < Math.round(T * 30); f++) {
    const t = f * dt, before = new Float32Array(sys.S.age), g0 = sys.G.next;
    D.sources(sys, scen(t, sink), env, dt);
    perFrame = Math.max(perFrame, (sys.G.next - g0 + sys.G.n) % sys.G.n);
    D.step(sys, dt, env);
    for (let q = 0; q < sys.S.n; q++) if (before[q] < 0.6 * D.L.splatLife && sys.S.age[q] < before[q]) overwrote++;
    const G = sys.G;
    for (let q = 0; q < G.n; q++) if (G.age[q] < G.life[q]) { kinds[G.kind[q]] = (kinds[G.kind[q]] || 0) + 1; maxH = Math.max(maxH, G.p[q * 3 + 1]); }
    let m = 0; for (let i = 0; i < sys.P.n; i++) if (sys.P.age[i] >= 0) m += sys.P.tau[i] * Math.PI * sys.P.r[i] * sys.P.rv[i];
    mass.push(m); splat.push(sys.S.live);
  }
  const peak = Math.max(...mass), ip = mass.indexOf(peak);
  return { sys, kinds, mass, peak, after30: mass[Math.min(mass.length - 1, ip + 900)] / Math.max(1e-9, peak), maxH, splat, perFrame, overwrote, puffs: sys.stats.emitted };
}

function check(D, o) {
  const fail = [], yes = (ok, label, extra) => { if (!ok) fail.push(label + (extra != null ? ' - ' + extra : '')); };
  const C = D.CLASSES, CLS = D.CLS;
  // A
  yes(C.slice(0, 5).join() === 'dirt,sand,gravel,grass,paved' && C.slice(5).join() === 'mud,snow,powder,slush', 'A the classes: the dust\'s five, then mud, snow, powder, slush', C.join());
  for (const k of C.slice(0, 5)) yes(Object.keys(CLS[k]).sort().join() === 'col,fines,loose,ut', 'A the dust class ' + k + ' carries only its own four laws', Object.keys(CLS[k]).join());
  const white = [0.8, 0.82, 0.86], lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  yes(lum(D.albedoFrom(white, 0)) <= 0.32 + 1e-9 && lum(D.albedoFrom(white)) <= 0.32 + 1e-9, 'A the dust\'s albedo still a soil\'s (<= 0.32)');
  // B
  yes(lum(D.albedoFrom(white, 7)) >= 0.5 && lum(D.albedoFrom(white, 6)) >= 0.5, 'B a snow cloud is white (>= 0.5)', lum(D.albedoFrom(white, 7)).toFixed(2));
  const R = o.R;
  yes(R.powderRun.peak >= 1.5 * R.dirtRun.peak, 'B powder\'s run-up cloud at least 1.5 x dirt\'s', (R.powderRun.peak / R.dirtRun.peak).toFixed(2));
  yes(R.snowRun.peak <= 0.1 * R.powderRun.peak, 'B packed snow hardly clouds (< 0.1 x powder)', (R.snowRun.peak / R.powderRun.peak).toFixed(3));
  yes(R.powderRun.after30 < 0.5 * R.dirtRun.after30 && R.dirtRun.after30 > 0.2, 'B the snow cloud settles: 30 s after its peak under half of what dirt\'s keeps (dirt > 20 %)', R.powderRun.after30.toFixed(2) + ' vs ' + R.dirtRun.after30.toFixed(2));
  yes((R.snowRun.kinds[3] || 0) > 100 && (R.powderRun.kinds[3] || 0) > 100 && !R.dirtRun.kinds[3], 'B the saltation skin (drift) on both snows under the jet, none on dirt');
  yes(R.powderRun.maxH < 0.4, 'B the drift stays low (< 0.4 m)', R.powderRun.maxH.toFixed(2));
  yes((R.powderTo.kinds[4] || 0) > 50 && !R.powderTo0.kinds[4], 'B powder\'s plough: clumps from a sinking wheel, none from one that does not sink');
  // C
  for (const nm of ['mudTo', 'mudRun', 'slushTo', 'mudTaxi']) yes(R[nm].puffs === 0, 'C no cloud off mud / slush (' + nm + ')', R[nm].puffs);
  yes((R.mudTo.kinds[2] || 0) > 100 && (R.mudTo.kinds[5] || 0) > 100, 'C mud throws clods and drops');
  for (const nm of ['mudTo', 'slushTo', 'mudFast']) yes(R[nm].maxH <= 2.0, 'C nothing thrown over 2 m (' + nm + ')', R[nm].maxH.toFixed(2));
  yes((R.mudWalk.kinds[2] || 0) + (R.mudWalk.kinds[5] || 0) === 0, 'C the tread holds its mud at a walk (1.5 m/s, no sink)', JSON.stringify(R.mudWalk.kinds));
  yes((R.mudFast.kinds[2] || 0) + (R.mudFast.kinds[5] || 0) > 200, 'C the tread sheds at speed (18 m/s)', JSON.stringify(R.mudFast.kinds));
  const tot = r => (r.kinds[2] || 0) + (r.kinds[5] || 0);
  yes(tot(R.mudTaxi) > 3 * tot(R.mudTaxi0), 'C the bow wave grows with the sinkage (5 m/s: sinking 6 cm against not sinking - the tread alone)', tot(R.mudTaxi0) + ' -> ' + tot(R.mudTaxi));
  const sp = R.mudStop.splat, stopF = 6 * 30;
  yes(Math.max(...sp) > 20 && sp[stopF + 15 * 30] >= 0.8 * sp[stopF], 'C landed mud splats and lies (15 s after the stop, >= 80 % still there)', sp[stopF] + ' -> ' + sp[stopF + 15 * 30]);
  yes(R.mudTo.perFrame <= Math.ceil(D.L.projMax / 30) * 2 + 4 && R.slushTo.perFrame <= Math.ceil(D.L.projMax / 30) * 2 + 4, 'C a wheel throws within its budget (' + D.L.projMax + ' a second)', R.mudTo.perFrame + ' / ' + R.slushTo.perFrame + ' a frame for two wheels');
  yes(R.mudTo.overwrote === 0 && R.slushTo.overwrote === 0, 'C a full ring of fresh splats is never overwritten (no pop)', R.mudTo.overwrote);
  // D
  if (o.src) {
    const V = D.GLSL.vert, F = D.GLSL.frag;
    yes(/iA\.w > 5\.5/.test(V) && /iPos \+ vec3\(cr \* c\.x - sr \* c\.y, 0\.035/.test(V), 'D the splat lies in the ground\'s plane');
    yes(/uniform vec3 uCol\[9\]/.test(V) && /mix\(uG, 0\.8, vSnow\)/.test(F) && /alpha erosion/.test(F), 'D nine class colours, snow\'s own phase, the splat\'s erosion');
    const a = o.src.app;
    yes(/const DUST_SURF = \[[^\]]*'snow', 'powder', 'slush', 'mud', 'mud'\]/.test(a) && /DUST_BY_CODE\[q\.cls\]/.test(a) && /sink: sim\.out && sim\.out\.softZ > 0/.test(a), 'D app.js maps 8-12, lets the code decide under the pavement\'s snow / mud, hands the sinkage');
    yes(/data-v="7"[^>]*>Powder/.test(o.src.bench) && /data-v="5"[^>]*>Mud/.test(o.src.bench), 'D the bench lists the soft surfaces');
  }
  return fail;
}

function measure(D) {
  return {
    dirtRun: run(D, runup, 0, 0, 60), snowRun: run(D, runup, 6, 0, 60), powderRun: run(D, runup, 7, 0, 60),
    powderTo: run(D, takeoff, 7, 0.10, 25), powderTo0: run(D, takeoff, 7, 0, 25),
    mudTo: run(D, takeoff, 5, 0.06, 25), mudRun: run(D, runup, 5, 0, 20), slushTo: run(D, takeoff, 8, 0.07, 25),
    mudWalk: run(D, roll(1.5, 20), 5, 0, 20), mudFast: run(D, roll(18, 10), 5, 0, 10),
    mudTaxi: run(D, roll(5, 20), 5, 0.06, 20), mudTaxi0: run(D, roll(5, 20), 5, 0, 20), mudStop: run(D, roll(16, 6), 5, 0.06, 30),
  };
}
const src = { app: fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'app.js'), 'utf8'), bench: fs.readFileSync(path.join(ROOT, 'tools', '_dust.html'), 'utf8') };

if (SELF) {
  const bad = [];
  const doctor = (name, mut) => { const D = fresh(); mut(D); const f = check(D, { R: measure(D) }); console.log('  selftest ' + name + ': ' + (f.length ? 'red (' + f[0] + ')' : 'STILL GREEN')); if (!f.length) bad.push(name); };
  doctor('powder as hard to lift as dirt', D => { D.CLS.powder.ut = 4; D.CLS.powder.fines = 0.3; });
  doctor('snow hangs like dust', D => { D.CLS.powder.fall = null; });
  doctor('mud clouds (thrown as dirt)', D => { D.CLS.mud.proj = null; D.CLS.mud.wet = 0; D.CLS.mud.fines = 0.5; });
  doctor('mud flies to the treetops', D => { D.L.projUp = 30; });
  doctor('the tread sheds at a walk', D => { D.CLS.mud.proj.adh = 0.01; });
  doctor('no aftermath', D => { D.L.splatLife = 3; });
  doctor('no drift', D => { D.CLS.snow.drift = 0; D.CLS.powder.drift = 0; });
  console.log('GATE SNOWMUDFX selftest: ' + (bad.length ? 'FAIL (' + bad.join(', ') + ' stayed green)' : 'PASS (every doctored law went red)'));
  process.exit(bad.length ? 1 : 0);
}
const t0 = Date.now(), D = fresh(), R = measure(D);
for (const k in R) { const r = R[k]; log(k.padEnd(10) + ' cloud peak ' + r.peak.toFixed(0).padStart(5) + ' (30 s on ' + (r.after30 * 100).toFixed(0).padStart(3) + ' %)  thrown ' + JSON.stringify(r.kinds) + '  highest ' + r.maxH.toFixed(2) + ' m  splats max ' + Math.max(...r.splat)); }
const fail = check(D, { R, src });
for (const f of fail) console.log('  FAIL ' + f);
console.log('  (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
console.log('GATE SNOWMUDFX: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
process.exit(fail.length ? 1 : 0);
