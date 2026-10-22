#!/usr/bin/env node
// G1824 (DMG-DRIVE): WHAT THE DRIVETRAIN DOES - measured on the user's validated builds, node only, with the damage layer on
// (the certificate stamped: the game's state from train 36), before and after DMG-DRIVE's models (the same rig on either
// core: a core without sim.damage().drive reads its drive state as none).
//   node tools/dmg_drive_probe.js [--build=cub,jodel,...] [--what=dive,nose,trunk,mount] [--out=<dir>] [--no-cert]
// One process per build (a certificate is 12-40 s); `--merge` prints the table from the per-build JSONs in <dir>.
//   THE DIVES: held at V_NE (0.9 V_D, genCertSpeeds) and 1.1 V_D at full throttle, at V_NE at the build's cruise throttle
//     (params.ap.thrCruise), at idle and with the key off (windmilling): the propeller's and the engine's rpm against the
//     engine's rated, the helical tip Mach
//   THE NOSE-OVERS at 2 / 4 / 8 m/s (the disc's lowest point falling at that speed, the engine at a taxi's 0.2)
//   A TRUNK IN THE DISC at 3 / 10 / 30 m/s (taxied at 3 and 10, flown 4 m up at 30)
//   THE MOUNT under the probe: full power tied down, a flown 3.8 g pull, a snap-roll entry, FAR 23.473's sink and 1.5 x it
'use strict';
const path = require('path'), fs = require('fs');
// DRIVE_CORE=<a flight_core.js>: the same rig on another core (the base's, for the before / after) - put in require's cache
// under tools/flight_core.js before the scenario libraries load it
if (process.env.DRIVE_CORE) { const m = require(path.resolve(process.env.DRIVE_CORE)), k = require.resolve('./flight_core.js'); require.cache[k] = { id: k, filename: k, loaded: true, exports: m }; }
const L = require('./_treecrash_lib.js');
const D = require('./_dmg_drive_lib.js');
const arg = (k, d) => { const a = process.argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const OUT = arg('out', path.join(__dirname, '..', 'reports', 'evidence', 'DMG-DRIVE', 'probe'));
const CERT = !process.argv.includes('--no-cert');
const r3 = x => (x == null || !isFinite(x) ? x : Math.round(x * 1000) / 1000);
const rpmOf = def => { const E = def.params.engine || {}; return { rated: E.rpm, gear: E.gear || 1, name: E.name }; };

function probeBuild(key, what) {
  const C = L.core(), def = L.defOf(key), VS = C.genCertSpeeds(def), E = rpmOf(def), res = { key, label: L.BUILDS[key].label, engine: E,
    speeds: { VNE: r3(0.9 * VS.VD), VD: r3(VS.VD) }, thrCruise: r3(def.params.ap && def.params.ap.thrCruise) };
  const o = CERT ? { cert: true } : {};
  if (what.includes('dive')) {
    res.dive = [];
    const VNE = 0.9 * VS.VD, cases = [['VNE full', VNE, 1, false], ['1.1 VD full', 1.1 * VS.VD, 1, false], ['VNE cruise', VNE, def.params.ap.thrCruise, false],
      ['VNE idle', VNE, 0, false], ['VNE off', VNE, 0, true]];
    for (const [nm, V, thr, off] of cases) {
      const r = D.dive(key, Object.assign({ V, thr, off, hold: 8, secs: 60 }, o));
      res.dive.push({ case: nm, V: r3(V), thr: r3(thr), reached: r.reached != null, rpmProp: Math.round(r.rpmMax), rpmEng: Math.round(r.rpmEngMax),
        ratio: r3(r.rpmEngMax / E.rated), tipMach: r3(r.tipMach), nz: [r3(r.nzMin), r3(r.nzMax)], running: r.running, seized: r.seized,
        drive: r.drive, yields: r.yields, breaks: r.breaks, crashed: r.crashed, finite: r.finite });
    }
  }
  const hydro = !!(def.parts && def.parts.floats);
  if (what.includes('nose') && hydro) {
    // a floatplane's nose-over is the bow digging in (A0's water case: the ordinary one and TREECRASH's severe 90 km/h one)
    res.noseIn = [];
    for (const c of [{ V: 20, sink: 1.5, pitch: 8 }, { V: 25, sink: 5, pitch: 20 }]) {
      const r = D.noseIn(key, Object.assign({ thr: 0.2 }, c, o));
      res.noseIn.push(Object.assign({}, c, { propStrike: r.propStrike, propAt: r.propAt, running: r.running, seized: r.seized, drive: r.drive, groups: r.groups,
        breaks: r.breaks, crashed: r.crashed, reason: r.reason, gPeak: r3(r.gPeak), finite: r.finite }));
    }
  }
  if (what.includes('nose') && !hydro) {
    res.nose = [];
    for (const V of [2, 4, 8]) {
      const r = D.noseOver(key, Object.assign({ V, thr: 0.2, secs: 2 }, o));
      res.nose.push({ V, first: r.at, pitch0: r3(r.pitch0), strikeT: r3(r.strikeT), discT: r3(r.discT), bite: r3(r.bite), R: r3(r.R), rpm0: r.rpm0.map(Math.round), rpm: r.rpm.map(Math.round), running: r.running,
        seized: r.seized, propStrike: r.propStrike, propAt: r.propAt, drive: r.drive, yields: r.yields, breaks: r.breaks, groups: r.groups,
        crashed: r.crashed, reason: r.reason, gPeak: r3(r.gPeak), finite: r.finite, tl: r.tl });
    }
  }
  if (what.includes('trunk')) {
    res.trunk = [];
    for (const V of [3, 10, 30]) {
      const r = D.trunkStrike(key, Object.assign({ V }, o));
      if (r.na) { res.trunk.push({ V, na: r.na }); continue; }
      res.trunk.push({ V, flown: r.flown, propStrike: r.propStrike, propAt: r.propAt, running: r.running, seized: r.seized, drive: r.drive,
        groups: r.groups, breaks: r.breaks, crashed: r.crashed, reason: r.reason, gPeak: r3(r.gPeak), finite: r.finite });
    }
  }
  if (what.includes('mount')) {
    const m = D.mountLoads(key, o);
    res.mount = {};
    for (const k of Object.keys(m)) res.mount[k] = { max: r3(m[k].max), at: m[k].at, body: r3(m[k].body), nz: r3(m[k].nz), sink: r3(m[k].sink), wMax: m[k].wMax && m[k].wMax.map(r3), nzMax: r3(m[k].nzMax) };
  }
  return res;
}

function merge(dir) {
  const rows = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const order = Object.keys(L.BUILDS); rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  const tierS = d => d ? (d.strike ? d.strike + (d.strikeAt ? ' (bite ' + r3(d.strikeAt.biteR) + ' R, tip ' + Math.round(d.strikeAt.tip) + ' m/s)' : '') : '-') + (d.os ? ' os:' + d.os + ' ' + r3(d.osPeak) : '') + (d.gearbox ? ' gb:' + d.gearbox : '') + (d.failed ? ' FAILED(' + d.why + ')' : '') + (d.internal ? ' internal' : '') : 'n/a';
  const L1 = [];
  L1.push('### Dives (engine rpm over its rated; helical tip Mach)');
  L1.push('| build | engine (rated) | V_NE / V_D m/s | VNE full | 1.1 VD full | VNE cruise (thr) | VNE idle | VNE key off | drive state after |');
  L1.push('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) if (r.dive) {
    const c = n => { const d = r.dive.find(x => x.case === n); return d ? (d.reached ? '' : '(not reached) ') + d.rpmEng + ' (' + (d.ratio * 100 - 100).toFixed(1) + ' %), M ' + d.tipMach : '-'; };
    const st = r.dive.map(d => d.case + ': ' + tierS(d.drive && d.drive[0])).join('; ');
    L1.push(`| ${r.label} | ${r.engine.name} (${r.engine.rated}${r.engine.gear > 1 ? ', gear ' + r.engine.gear : ''}) | ${r.speeds.VNE} / ${r.speeds.VD} | ${c('VNE full')} | ${c('1.1 VD full')} | ${c('VNE cruise')} (${r.thrCruise}) | ${c('VNE idle')} | ${c('VNE off')} | ${st} |`);
  }
  L1.push('', '### Nose-overs (the nose falling at V; engine at 0.2)');
  L1.push('| build | V | first contact | disc touches at s | strike registered at s | deepest bite into the disc (m, of R) | engine after | drive | broke (groups) | crashed |');
  L1.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) if (r.nose) for (const n of r.nose)
    L1.push(`| ${r.label} | ${n.V} | ${n.first} | ${n.discT == null ? '-' : n.discT} | ${n.strikeT == null ? 'NO STRIKE' : n.strikeT} | ${n.bite} (${n.R}) | ${n.running.map((x, i) => x ? 'running' : (n.seized[i] ? 'seized' : 'stopped')).join(', ')} | ${(n.drive || [null]).map(tierS).join(', ')} | ${n.breaks} (${n.groups.join(', ') || '-'}) | ${n.crashed ? n.reason : 'no'} |`);
  L1.push('', '### A floatplane\'s nose-in (the bow digs in; engine at 0.2)');
  L1.push('| build | V m/s, sink m/s, pitch deg | strike | engine after | drive | broke (groups) | crashed |');
  L1.push('|---|---|---|---|---|---|---|');
  for (const r of rows) if (r.noseIn) for (const n of r.noseIn)
    L1.push(`| ${r.label} | ${n.V}, ${n.sink}, ${n.pitch} | ${n.propStrike ? n.propAt.what : 'NO'} | ${n.running.map((x, i) => x ? 'running' : (n.seized[i] ? 'seized' : 'stopped')).join(', ')} | ${(n.drive || [null]).map(tierS).join(', ')} | ${n.breaks} (${n.groups.slice(0, 4).join(', ') || '-'}${n.groups.length > 4 ? ' ...' : ''}) | ${n.crashed ? n.reason : 'no'} |`);
  L1.push('', '### A trunk in the disc');
  L1.push('| build | V | strike | engine after | drive | broke (groups) | crashed |');
  L1.push('|---|---|---|---|---|---|---|');
  for (const r of rows) if (r.trunk) for (const n of r.trunk) if (n.na) L1.push(`| ${r.label} | ${n.V} | n/a (${n.na}) | | | | |`); else
    L1.push(`| ${r.label} | ${n.V}${n.flown ? ' (flown)' : ''} | ${n.propStrike ? n.propAt.what + ' @' + r3(n.propAt.t) : 'NO'} | ${n.running.map((x, i) => x ? 'running' : (n.seized[i] ? 'seized' : 'stopped')).join(', ')} | ${(n.drive || [null]).map(tierS).join(', ')} | ${n.breaks} (${n.groups.slice(0, 4).join(', ') || '-'}${n.groups.length > 4 ? ' ...' : ''}) | ${n.crashed ? n.reason : 'no'} |`);
  L1.push('', '### The mount (worst mount member\'s peak over its certified yield; the engine body\'s own members apart)');
  L1.push('| build | full power tied down | 3.8 g pull at full power | snap-roll entry (rates rad/s: roll, yaw, pitch) | 23.473 sink | 1.5 x sink |');
  L1.push('|---|---|---|---|---|---|');
  for (const r of rows) if (r.mount) {
    const M = r.mount, c = k => M[k] ? M[k].max + ' (' + (M[k].at ? M[k].at.tag + ' ' + M[k].at.s : '-') + ')' : '-';
    L1.push(`| ${r.label} | ${c('fullPower')} | ${c('pull')} nz ${M.pull && M.pull.nz} | ${c('snap')} w ${M.snap && M.snap.wMax && M.snap.wMax.join('/')} | ${c('land473')} | ${c('land473x15')} |`);
  }
  return L1.join('\n');
}

if (require.main === module) {
  if (process.argv.includes('--merge')) { console.log(merge(OUT)); process.exit(0); }
  fs.mkdirSync(OUT, { recursive: true });
  const builds = arg('build', Object.keys(L.BUILDS).join(',')).split(',');
  const what = arg('what', 'dive,nose,trunk,mount').split(',');
  for (const k of builds) {
    const t0 = Date.now();
    const r = probeBuild(k, what);
    r.ms = Date.now() - t0;
    const f = path.join(OUT, k + '.json');
    let prev = {}; try { prev = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {}
    fs.writeFileSync(f, JSON.stringify(Object.assign(prev, r), null, 1));
    console.log(k, 'done', r.ms + ' ms');
  }
}
module.exports = { probeBuild, merge };
