#!/usr/bin/env node
// GATE SIMDIVERGE (G2630 RADIAL-DIVERGE) - A DIVERGED FLIGHT NEVER BLACKS THE WORLD, AND NEVER POISONS A SAVE.
// The user (9-10 Oct): "If the sim has not converged, any subsequent attempts at loading the game gives everything
// black but the sky." The mechanism (HANDOVER G2630): a diverged sim's CG is NaN; the page fed it to the camera and to
// WF.worldUpdate, and two EASED states took it and could never leave it - render_world's cloud transmittance at the
// eye (LE.cT -> the hemisphere's intensity at the next day apply: every lit thing black, the unlit sky drawn) and
// climate_link's eye wind (the trees' sway) - for the rest of the page's life, the shed and every later roll-out
// included. Nothing persisted carried it (JSON writes NaN as null); the guards at the writers and readers make that
// a rule rather than a fact of today's fields.
//
//   node tools/_simdiverge_check.js            -> "GATE SIMDIVERGE: PASS|FAIL"
//   node tools/_simdiverge_check.js --show     -> the numbers
//   node tools/_simdiverge_check.js --selftest -> negative verification: the guards stood down (FLYDIY_NANGUARD_OFF,
//                                                the old page) - the DIVERGED rows must go red
//
// THE PAGE ITSELF IN NODE (tools/_page_node.js), the game's own physics worker (?simw=1, sim_host.js in a real thread),
// the user's Cub - ANY build: the divergence is FORCED (FLIGHT_PROBE.place with a non-finite velocity, the worker's own
// placement door), so the row holds whatever the next cause of a NaN is. Two page processes:
//   A  boot, roll out, fly 3 s, force the divergence; 12 s of frames (the day re-applies, the clouds are sampled):
//      DIVERGED   the flight ended 'sim-diverged' (the card); the camera's eye finite; the light ease (window.LIGHT_EASE:
//                 cloud transmittance, hemisphere and sun intensity, as eased and as written) finite and lit; the eye
//                 wind (CLIMATE_LINK.pub.cam) finite
//      AGAIN      the card's Fly (#bGo, fullReset): 6 s of frames - the same, and the flight live again
//      SAVED      every flydiy.* key in localStorage parses through jsonReadFinite (70_player.js), none holds 'NaN' or
//                 'Infinity', the working build's logbook carries the diverged row with a finite time
//   B  a new page on A's localStorage (the next load): boot, roll out, 6 s of frames:
//      NEXT BOOT  the camera finite, the light ease finite and lit, the flight live
//   C  the writers' guard in node: jsonFinite refuses a record holding NaN / Infinity (null back) and passes a finite
//      one byte-identical to JSON.stringify; jsonReadFinite sets aside a corrupt text and a 1e999.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const SHOW = argv.includes('--show'), SELF = argv.includes('--selftest');
const fin = x => typeof x === 'number' && Number.isFinite(x);

// ============================================================ THE CHILD: one page
async function child() {
  const phase = arg('child'), out = arg('out'), off = argv.includes('--off');
  const { openPage } = require('./_page_node.js');
  const storage = arg('storage') ? JSON.parse(fs.readFileSync(arg('storage'), 'utf8')) : {};
  const R = { phase, rows: {}, errors: [] };
  const P = await openPage({ quiet: true, storage, query: 'simw=1', workers: /sim_host\.js/ });
  const W = P.win;
  if (off) W.FLYDIY_NANGUARD_OFF = true;
  const frames = async n => { for (let i = 0; i < n; i++) await P.frames(1); };
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  W.document.getElementById('bGo').click();
  const tripDone = () => { const T = W.FLYDIY_TRIPS; const t = T && T[T.length - 1]; return !!(t && t.kind === 'rollout' && t.done && W.BOOT.state === 'gone'); };
  await P.until(() => (W.FLYDIY_TRIPS ? tripDone() : (W.BOOT.state === 'gone' && W.BOOT.set === 'rollout')), 900000);
  const FP = W.FLIGHT_PROBE;
  const RD = FP.renderer(); RD.render = function () {}; if (RD.shadowMap) RD.shadowMap.render = function () {};
  const read = () => {
    const LE = W.LIGHT_EASE || {}, cam = FP.camGet(), CL = W.CLIMATE_LINK && W.CLIMATE_LINK.pub;
    const ap = FP.ap();
    return { eye: cam.eye, cT: LE.cT, hemiI: LE.hemiI, sunI: LE.sunI, setHemiI: LE.setHemiI, setSunI: LE.setSunI,
             camWind: CL && CL.cam ? CL.cam.slice(0, 3) : null, over: FP.over(), outcome: ap && ap.report ? ap.report.outcome : null,
             cg: FP.sim().cgPos().slice() };
  };
  await frames(180);                                   // 3 s of the flight
  R.rows.before = read();
  if (phase === 'A') {
    // THE FORCED DIVERGENCE: the worker's own placement door, a non-finite velocity on every node
    await FP.place({ dv: [NaN, NaN, NaN] });
    await frames(720);                                 // 12 s: the card, the day re-applies, the clouds sampled at 4 Hz
    R.rows.diverged = read();
    W.document.getElementById('bGo').click();          // the card's Fly: fullReset
    await frames(360);
    R.rows.again = read();
    // the next load's storage, and what it holds
    const LS = W.localStorage, dump = {};
    for (let i = 0; i < LS.length; i++) { const k = LS.key(i); if (/^flydiy\./.test(k)) dump[k] = LS.getItem(k); }
    R.storage = dump;
    let wip = null; try { wip = JSON.parse(dump['flydiy.wip'] || 'null'); } catch (e) {}
    const fl = wip && wip.log && wip.log.flights || [];
    R.lastRow = fl.length ? fl[fl.length - 1] : null;
    R.readOk = Object.keys(dump).filter(k => { const t = dump[k]; if (!/^[\[{]/.test(t)) return true; return W.jsonReadFinite(t, k) != null; }).length;
    R.keys = Object.keys(dump).length;
    R.nanText = Object.keys(dump).filter(k => /\bNaN\b|\bInfinity\b/.test(dump[k]));
  } else {
    await frames(360);
    R.rows.next = read();
  }
  R.errors = P.errors.filter(e => !/impostor bake/.test(e)).slice(0, 12);
  fs.writeFileSync(out, JSON.stringify(R));
  P.close();
  process.exit(0);
}

function runChild(phase, extra) {
  const out = path.join(os.tmpdir(), 'simdiverge_' + process.pid + '_' + phase + (extra.off ? '_off' : '') + '.json');
  const a = [__filename, '--child=' + phase, '--out=' + out];
  if (extra.off) a.push('--off');
  if (extra.storage) a.push('--storage=' + extra.storage);
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000'].concat(a), { stdio: ['ignore', 'inherit', 'inherit'], timeout: 3 * 3600 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) return { failed: 'child ' + phase + ' exit ' + r.status };
  const R = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out);
  return R;
}

// ---- the judgement of one read: the eye finite, the light ease finite and LIT (a day: > 0), the eye wind finite
function lit(r) {
  if (!r) return 'no read';
  const bad = [];
  if (!(r.eye && r.eye.every(fin))) bad.push('eye ' + JSON.stringify(r.eye));
  for (const k of ['cT', 'hemiI', 'sunI', 'setHemiI']) if (!fin(r[k])) bad.push(k + ' ' + r[k]);
  if (fin(r.hemiI) && !(r.hemiI > 0)) bad.push('hemiI ' + r.hemiI + ' (dark)');
  if (r.camWind && !r.camWind.every(fin)) bad.push('eye wind ' + JSON.stringify(r.camWind));
  return bad.length ? bad.join(', ') : null;
}

function writersInNode(check) {
  const C = require(path.join(__dirname, 'flight_core.js'));
  const warn = console.warn; console.warn = () => {};
  try {
    const good = { a: 1, b: [0.5, -2, null], c: { d: 'x' } };
    check(C.jsonFinite(good, 't') === JSON.stringify(good), 'C: jsonFinite passes a finite record byte-identical');
    check(C.jsonFinite({ a: 1, b: { c: NaN } }, 't') === null, 'C: jsonFinite refuses a NaN deep in a record');
    check(C.jsonFinite({ a: [1, Infinity] }, 't') === null, 'C: jsonFinite refuses an Infinity');
    check(C.jsonReadFinite('{"a":', 't') === null, 'C: jsonReadFinite sets aside a corrupt text');
    check(C.jsonReadFinite('{"a":1e999}', 't') === null, 'C: jsonReadFinite sets aside a non-finite number');
    check(JSON.stringify(C.jsonReadFinite('{"a":[1,2]}', 't')) === '{"a":[1,2]}', 'C: jsonReadFinite reads a good record');
  } finally { console.warn = warn; }
}

function main() {
  let fail = [];
  const check = (ok, label, extra) => { if (!ok) fail.push(label + (extra != null ? ' - ' + extra : '')); if (SHOW) console.log((ok ? '  ok   ' : '  FAIL ') + label + (extra != null ? '  (' + extra + ')' : '')); return ok; };
  if (SELF) {
    const A = runChild('A', { off: true });
    if (A.failed) { console.log('GATE SIMDIVERGE selftest: the page failed - ' + A.failed); process.exit(1); }
    if (SHOW) console.log('  ' + JSON.stringify(A.rows.diverged));
    const why = lit(A.rows.diverged);
    console.log('GATE SIMDIVERGE selftest: ' + (why ? 'CAUGHT (the old page after the divergence: ' + why + ')' : 'MISSED (the old page read lit after a divergence)'));
    process.exit(why ? 0 : 1);
  }
  writersInNode(check);
  const A = runChild('A', {});
  if (!check(!A.failed, 'A: the page ran', A.failed)) return finish(fail);
  if (SHOW) for (const k of Object.keys(A.rows)) console.log('    A ' + k + ' ' + JSON.stringify(A.rows[k]));
  check(lit(A.rows.before) == null, 'A: the flight before the divergence is lit and finite', lit(A.rows.before));
  check(A.rows.diverged.outcome === 'sim-diverged' && A.rows.diverged.over, 'DIVERGED: the flight ended sim-diverged', A.rows.diverged.outcome);
  check(!(A.rows.diverged.cg || []).every(fin), 'DIVERGED: the forced divergence is real (the sim CG is not finite)', JSON.stringify(A.rows.diverged.cg));
  check(lit(A.rows.diverged) == null, 'DIVERGED: the eye, the light ease and the eye wind finite and lit', lit(A.rows.diverged));
  check(lit(A.rows.again) == null && (A.rows.again.cg || []).every(fin) && !A.rows.again.over, 'AGAIN: the card\'s Fly - finite, lit, flying', lit(A.rows.again) || JSON.stringify(A.rows.again.cg));
  check(A.readOk === A.keys && A.keys > 0, 'SAVED: every flydiy.* record reads through jsonReadFinite', A.readOk + ' / ' + A.keys);
  check(!A.nanText.length, 'SAVED: no record holds NaN or Infinity as text', A.nanText.join(', '));
  check(A.lastRow && A.lastRow.outcome === 'sim-diverged' && fin(A.lastRow.t), 'SAVED: the logbook holds the diverged flight with a finite time', JSON.stringify(A.lastRow));
  const sf = path.join(os.tmpdir(), 'simdiverge_ls_' + process.pid + '.json');
  fs.writeFileSync(sf, JSON.stringify(A.storage));
  const B = runChild('B', { storage: sf });
  try { fs.unlinkSync(sf); } catch (e) {}
  if (check(!B.failed, 'B: the next load ran', B.failed)) {
    if (SHOW) console.log('    B next ' + JSON.stringify(B.rows.next));
    check(lit(B.rows.next) == null && (B.rows.next.cg || []).every(fin) && !B.rows.next.over, 'NEXT BOOT: the world lit, the eye finite, the flight live', lit(B.rows.next));
  }
  for (const e of [].concat(A.errors || [], B.errors || [])) if (SHOW) console.log('    page error: ' + e);
  finish(fail);
}
function finish(fail) {
  for (const x of fail) console.log('  FAIL ' + x);
  console.log('GATE SIMDIVERGE: ' + (fail.length ? 'FAIL (' + fail.length + ')' : 'PASS'));
  process.exit(fail.length ? 1 : 0);
}
if (arg('child')) child().catch(e => { console.error(e); process.exit(2); }); else main();
