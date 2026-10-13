#!/usr/bin/env node
// GATE DMGHEAL (G1859.8, DMG-WALL; the Deform Coordinator's 'torn wing on an intact wing' from DMG-TUNE's stills) - A
// WRECK'S TEARS NEVER REACH THE NEXT FLIGHT. The stills rig ran trunk-2.5 (a wing strike) and then the nose-over on ONE
// page; the nose-over's intact wing was drawn with the wing strike's torn bays (8165 torn on 8 page breaks). The skin's
// records stay on their groups and are held again at the next crash; the reset's heal cleared the tears only of the records
// HELD then, and the rig's 'before' shot (FLYDIY_SKINBREAK = false) had let them go. G1859.8 heals every record the model
// made (app.js brkState).
//
//   node tools/_dmg_heal_check.js              -> "GATE DMGHEAL: PASS|FAIL"
//   node tools/_dmg_heal_check.js --selftest   -> the heal as it was (window.FLYDIY_HEAL_HELDONLY) must turn the row red
//
// THE PAGE ITSELF IN NODE (tools/_page_node.js; DMGPAGEW's set-up): dev.html?simw=1&damage=1 - the default mode - the
// user's Cub rolled out; the 30 m/s trunk crash 4 m up, the trunk 2.5 m off the centreline (the wing strike, the stills
// rig's trunk-2.5); the skin switched off (its records let go, as the rig's 'before' shot); 'Fly again' with it off; the
// skin back on and the fresh flight run. Asserted:
//   1 the crash tore covering (else nothing is tested);
//   2 on the fresh flight, NO record holds a torn triangle of the last crash (R.dead), none is drawn with its index cut;
//   3 no page or worker error.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const BUILD = 'builds/cub_2026-09-20_corrected.json';

// ---- in the page: the records' tear state ----
function recState(W) {
  const m = W.FLIGHT_PROBE.model(), K = m && m.brk, all = (K && K.allRecs) || [];
  // (the records reachable from the model's groups and rigs too: a record made before G1859.8's list is still found)
  const seen = new Set(all);
  const add = o => { if (o && o.brkR) seen.add(o.brkR); };
  for (const r of (m && m.rigs) || []) add(r);
  for (const r of (m && m.wreckBuild && m.wreckBuild.rigsAll) || []) add(r);
  for (const L of [m && m.surfParts, m && m.strutRigs, m && m.stretchRigs, m && m.linkRigs, m && m.anchorRigs]) for (const r of L || []) add(r);
  let recs = 0, deadRecs = 0, deadTris = 0, cutIdx = 0;
  for (const R of seen) { recs++;
    if (R.dead) { let d = 0; for (let t = 0; t < R.nt; t++) if (R.dead[t] >= 2) d++; if (d) { deadRecs++; deadTris += d; } }
    if (R.idx0 && R.idx) { for (let t = 0; t < R.nt; t++) { const a = R.idx[t * 3]; if (a === R.idx[t * 3 + 1] && a === R.idx[t * 3 + 2] && !(R.idx0[t * 3] === R.idx0[t * 3 + 1] && R.idx0[t * 3] === R.idx0[t * 3 + 2])) cutIdx++; } } }
  const S = W.FLYDIY_SKINBREAK_STATS ? W.FLYDIY_SKINBREAK_STATS() : {};
  return { recs, deadRecs, deadTris, cutIdx, held: S.recs | 0, torn: S.torn | 0, healLetGo: (K && K.healLetGo) | 0 };
}

// ============================================================ THE CHILD: one page
async function child() {
  const out = arg('out'), fault = arg('fault', '');
  const { openPage } = require('./_page_node.js');
  const R = { fault, errors: [] };
  const storage = { 'flydiy.wip': fs.readFileSync(path.join(ROOT, BUILD), 'utf8') };
  const P = await openPage({ quiet: true, storage, query: 'simw=1&damage=1', workers: /sim_host\.js/ });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 600000);
  if (fault === 'heldonly') W.FLYDIY_HEAL_HELDONLY = true;
  const tripN = () => (W.FLYDIY_TRIPS || []).length;
  const tripDone = (kind, n0) => { const T = W.FLYDIY_TRIPS || []; const t = T[T.length - 1]; return T.length > n0 && !!(t && t.kind === kind && t.done && W.BOOT.state === 'gone'); };
  const SW = () => W.FLYDIY_SIMW || null;
  const live = () => { const s = SW() && SW().state(); return !!(s && s.phase === 'live' && s.flight && s.flight.live); };
  { const n0 = tripN(); W.document.getElementById('bGo').click(); await P.until(() => tripDone('rollout', n0), 900000);
    const RD = W.FLIGHT_PROBE.renderer(); RD.render = function () {}; if (RD.shadowMap) RD.shadowMap.render = function () {};
    for (let i = 0; i < 600 && !live(); i++) await P.frames(1); R.live = live(); }
  if (!R.live) { R.errors = P.errors.slice(0, 20); fs.writeFileSync(out, JSON.stringify(R)); P.close(); process.exit(0); }
  const FP = W.FLIGHT_PROBE, DS = () => (W.FLYDIY_DMG_STATE ? W.FLYDIY_DMG_STATE() : null);
  // ---- the wing strike (30 m/s, 4 m up, a trunk 40 m ahead 2.5 m off the centreline)
  const strike = async () => {
    W.FLYDIY_SKINBREAK = true; FP.setManual(true);
    const sim = FP.sim(), world = FP.world(), [xA] = sim.axes(), hl = Math.hypot(xA[0], xA[2]), fx = -xA[0] / hl, fz = -xA[2] / hl;
    const c = sim.cgPos(), g = world.terrainH(c[0], c[2]); let yMin = Infinity; for (let i = 1; i < sim.p.length; i += 3) yMin = Math.min(yMin, sim.p[i]);
    let placed = false; FP.place({ at: [c[0], g + 4 + (c[1] - yMin), c[2]], zeroV: true, dv: [30 * fx, 0, 30 * fz] }).then(() => { placed = true; });
    await P.until(() => placed, 60000);
    const c2 = sim.cgPos(), tx = c2[0] + fx * 40 - fz * 2.5, tz = c2[2] + fz * 40 + fx * 2.5, gt = world.terrainH(tx, tz);
    world.treeHits.set('fill:heal', [tx, tz, gt, 0.3, gt + 10]); sim.ctl.thr = 0;
    const tA = sim.t; let br = 0;
    for (let f = 0; f < 5 * 60 + 600 && sim.t - tA < 5; f++) { await P.frames(1); const D = DS(); br = Math.max(br, D && D.br ? D.br.length : 0); }
    world.treeHits.drop ? world.treeHits.drop('fill:heal') : world.treeHits.delete && world.treeHits.delete('fill:heal');
    return Object.assign({ br }, recState(W));
  };
  R.crash = await strike();
  // ---- the rig's 'before' shot: the skin off (its records let go); 'Fly again' with it off; then on, the fresh flight
  W.FLYDIY_SKINBREAK = false; for (let i = 0; i < 3; i++) await P.frames(1);
  R.off = recState(W);
  if (!FP.over()) FP.endFlight('crashed');
  for (let i = 0; i < 5; i++) await P.frames(1);
  const go = W.document.getElementById('bGo'); if (go) go.click();
  for (let i = 0; i < 400; i++) { await P.frames(1); const D = DS(); if (!FP.over() && live() && !(D && D.br && D.br.length)) break; }
  W.FLYDIY_SKINBREAK = true;
  for (let i = 0; i < 30; i++) await P.frames(1);
  const D2 = DS();
  R.fresh = Object.assign({ over: FP.over(), live: live(), br: D2 && D2.br ? D2.br.length : null }, recState(W));
  // ---- B, THE GAME'S OWN PATH (the Deform Coordinator: does any game path let records go before a reset?): a crash, the
  // shed, Roll out - D4b's roll-out shot resets a wrecked sim and lets the records go (rollWreckReset: brkRestore). The
  // records the model then holds, and whether the flown model is the same object (a rebuilt one carries no old record)
  R.crashB = await strike();
  const m0 = FP.model(), allB = (m0 && m0.brk && m0.brk.allRecs) ? m0.brk.allRecs.slice() : [];
  { const n0 = tripN(); const b = W.document.getElementById('bHangar2'); if (b) { b.click(); await P.until(() => tripDone('rollin', n0), 900000); } for (let i = 0; i < 30; i++) await P.frames(1); }
  { const n0 = tripN(); W.document.getElementById('bGo').click(); await P.until(() => tripDone('rollout', n0), 900000); for (let i = 0; i < 600 && !live(); i++) await P.frames(1); }
  for (let i = 0; i < 30; i++) await P.frames(1);
  { let stale = 0; for (const Rr of allB) if (Rr.dead) for (let t = 0; t < Rr.nt; t++) if (Rr.dead[t] >= 2) stale++;
    R.pathB = Object.assign({ sameModel: FP.model() === m0, live: live(), oldRecsStale: stale, rollResets: W.FLYDIY_ROLL_RESETS | 0 }, recState(W)); }
  const s1 = SW() ? SW().state() : null;
  R.workerErrors = s1 && s1.errors ? s1.errors.slice(0, 10) : [];
  R.errors = P.errors.filter(e => !/impostor bake/.test(e)).slice(0, 20);
  fs.writeFileSync(out, JSON.stringify(R));
  P.close(); process.exit(0);
}

// ============================================================ THE PARENT
function runChild(fault) {
  const out = path.join(os.tmpdir(), 'dmgheal_' + process.pid + (fault ? '_' + fault : '') + '.json');
  const a = [__filename, '--child=1', '--out=' + out]; if (fault) a.push('--fault=' + fault);
  const r = spawnSync(process.execPath, ['--max-old-space-size=6000'].concat(a), { stdio: ['ignore', 'inherit', 'inherit'], timeout: 3600 * 1000 });
  if (r.status !== 0 || !fs.existsSync(out)) return { failed: 'child exit ' + r.status + (r.signal ? ' ' + r.signal : '') };
  const R = JSON.parse(fs.readFileSync(out, 'utf8')); fs.unlinkSync(out); return R;
}
function judge(R, say, rows) {
  const f = [], bad = (row, m) => { f.push(m); rows[row] = false; };
  if (R.failed) { bad('page', R.failed); return f; }
  if (!R.live) { bad('page', 'the roll-out never went live under the worker'); return f; }
  say('  crash 1 (the wing strike): ' + JSON.stringify(R.crash));
  say('  the skin off: ' + JSON.stringify(R.off));
  say('  the fresh flight, the skin on: ' + JSON.stringify(R.fresh));
  if (!(R.crash && R.crash.br > 0 && R.crash.deadTris > 0)) bad('crash', 'the crash tore nothing - the gate tests nothing');
  if (!(R.fresh && R.fresh.live && !R.fresh.over && !R.fresh.br)) bad('fresh', 'no fresh flight after Fly again: ' + JSON.stringify(R.fresh));
  say('  path B (crash -> the shed -> roll out): ' + JSON.stringify(R.pathB || null));
  if (R.pathB && R.pathB.sameModel && (R.pathB.deadTris > 0 || R.pathB.oldRecsStale > 0)) bad('heal', 'THE GAME PATH (crash -> the shed -> roll out) KEEPS THE LAST CRASH TEARS on the same flown model: ' + R.pathB.deadTris + ' torn held, ' + R.pathB.oldRecsStale + ' in its records');
  if (R.fresh && (R.fresh.deadTris > 0 || R.fresh.cutIdx > 0)) bad('heal', 'THE LAST CRASH\'S TEARS ON THE FRESH FLIGHT: ' + R.fresh.deadTris + ' torn in ' + R.fresh.deadRecs + ' records, ' + R.fresh.cutIdx + ' triangles cut from the drawn index');
  if ((R.errors || []).length || (R.workerErrors || []).length) bad('errors', 'errors: page ' + JSON.stringify(R.errors).slice(0, 300) + ', worker ' + JSON.stringify(R.workerErrors).slice(0, 200));
  return f;
}
function parent() {
  const say = m => console.log(m);
  if (argv.includes('--selftest')) {
    say('DMGHEAL selftest: the heal as it was (held records only) must turn the heal row red');
    const rows = {}, R = runChild('heldonly'), f = judge(R, say, rows), red = rows.heal === false;
    say('  ' + (red ? 'ok  ' : 'FAIL') + '  the fault turned the heal row red' + (f.length ? ': ' + f.join(' | ') : ''));
    console.log('GATE DMGHEAL-SELFTEST: ' + (red ? 'PASS' : 'FAIL')); process.exit(red ? 0 : 1);
  }
  say('GATE DMGHEAL - a wreck\'s tears never reach the next flight (dev.html?simw=1&damage=1, the user\'s Cub)');
  const rows = {}, R = runChild(''), fails = judge(R, say, rows);
  for (const m of fails) say('  FAIL  ' + m);
  if (!fails.length) say('  ok    the wing strike tore covering; the skin let go and Fly again: the fresh flight holds none of it');
  console.log('GATE DMGHEAL: ' + (fails.length ? 'FAIL' : 'PASS'));
  process.exit(fails.length ? 1 : 0);
}
if (argv.includes('--child=1')) child().catch(e => { console.error('DMGHEAL child: ' + (e && e.stack || e)); process.exit(2); });
else parent();
