#!/usr/bin/env node
// fiche_bake.js - PLANE-RENDERS R3: THE OFFICIAL PLANES' FICHES, BAKED (the user, 7 Nov: official planes ship with their fiche, "a
// loading time that not everybody has, at the price of a few pictures. That's acceptable").
//
// The plane list's player classes (builds/lists/plane_lists.json: reproduction, story, original, wip - PLANE-LIST, the user 10 Nov) drawn by the game's own generator (plane_fiche.js
// PLANE_FICHE.generate, store off) in ONE garage page (tools/plane_shot.js --probe ... --probe-out), each plane loaded by the
// user's door (the fleet's Import), its fiche's pictures handed back as base64 and written to
//   media/fiches/<key>/<view>.webp   + media/fiches/index.json { what: 'flydiy-fiches', fiches: { <list key>: { name, data, pics: { view: file } } } }
// keyed by the list's picture key (design:cub, list:5, cand:<file>, stock:<name>) - the key fiche_board.js and the All planes
// screen ask by. The fiche's name is the list's. A plane that fails keeps its old fiche (nothing pruned after a miss).
//
//   node tools/fiche_bake.js --gpu [--secs 900] [--only <key,key>] [--keep <dir>] [--hydro-secs 150] [--busy-secs 60]   (a box run: one Chrome, the graphics card)
//   node tools/fiche_bake.js --dry                                                  the list and the files, no browser
//
// A SEAPLANE'S TAKE-OFF (FICHE-WATER, 10 Nov): a float build's fiche prints the hydroplane test's lift-off, never the land
// estimate (plane_fiche.js numbers: data.sea, specs.TORun = results.hydro.lift.dist, else specs.TOWater). So before its fiche
// draws, the probe runs the bench's own Hydroplane row (window.BENCH_RUN('hydro'): computed, no card) and waits for it to
// settle (HYDRO_MS). The row is offered only for a build with floats (bench.js 'hydro' when: api.hasFloats), so BENCH_RUN
// returns false on a land build and touches nothing: a land plane bakes exactly as before. A run still going at HYDRO_MS
// leaves the fiche on "see the hydroplane test". The bake's line names each run (hydro: lift-off m / verdict / none).
// THE NODE RUN (AIRCRAFT-LOOKS' 23:25 bake, 10 Nov: REFUSED on all three float cards): plane_shot opens the page on the PHONE
// profile, whose benchOff takes the hydro row away (profile.js 'phone': xwind, load, hydro), so the page can never run it.
// The run is the core's own - app.js htStart/htPoll: a second sim placed on the world's sea aerodrome, the game's Pilot routed
// sea to sea, the lift-off the first frame the floats leave the water above 12 m/s - so the bake runs it in node (nodeHydro,
// the same steps, the same world) for a float build whose page run did not lift off, and writes the lift-off into the baked
// fiche's numbers (specs.TORun "N m on water"; data.hydroNode { t, V, dist }). No lift-off in node leaves the page's row.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');
const FLY = path.join(__dirname, '..'), OUT = path.join(FLY, 'media', 'fiches');
const argv = process.argv.slice(2), flag = k => argv.includes('--' + k);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] != null && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const L = JSON.parse(fs.readFileSync(path.join(FLY, 'builds', 'lists', 'plane_lists.json'), 'utf8'));
const only = opt('only', '') ? opt('only').split(',') : null;
const rows = L.planes.filter(p => ['reproduction', 'story', 'original', 'wip'].includes(p.list) && p.file && p.thumb && (!only || only.includes(p.thumb)));
const safe = k => k.replace(/[^\w.-]+/g, '_');
if (flag('dry')) { for (const r of rows) console.log(r.thumb.padEnd(40), r.name.padEnd(28), r.file); process.exit(0); }
const keep = opt('keep', null), work = keep || fs.mkdtempSync(path.join(os.tmpdir(), 'fiche_bake_'));
fs.mkdirSync(work, { recursive: true });
// the node hydroplane run (app.js htStart/htPoll's steps on the core): { lift: { t, V, dist } | null, t, why }
let CORE = null, LBD = null;
function nodeHydro(file) {
  try {
    CORE = CORE || require(path.join(FLY, 'tools', 'flight_core.js')); LBD = LBD || require(path.join(FLY, 'tools', '_load_build.js'));
    const spec = LBD.gameSpecFull(JSON.parse(fs.readFileSync(path.join(FLY, file), 'utf8'))).spec;
    const def = CORE.buildGen(JSON.parse(JSON.stringify(spec))), world = CORE.makeWorld();
    const sea = (world.aerodromes || []).find(a => a.kind === 'water');
    if (!sea || !def.parts || !def.parts.floats) return { lift: null, t: 0, why: !sea ? 'no sea lane' : 'no floats' };
    const sim = CORE.makeSim(def, world); sim.reset(0); CORE.placeAtAerodrome(sim, sea);
    const ap = CORE.makePilot(sim, def, world); ap.setRoute(sea, sea);
    const fl = sim.hydro && sim.hydro.floats; let t = 0, x0 = null, dist = 0, lift = null, wetLast = 1;
    while (t <= 75) {
      ap.update(1 / 60); sim.step(1 / 60); t += 1 / 60;
      if (sim.stats().bad) return { lift: null, t, why: 'the sim broke' };
      const cg = sim.cgPos(), v = sim.cgVel(), V = Math.hypot(v[0], v[2]);
      if (!x0) x0 = [cg[0], cg[2]];
      dist = Math.hypot(cg[0] - x0[0], cg[2] - x0[1]);
      let wet = 0; if (fl) for (const x of fl) wet += x.wet;
      if (wet === 0 && wetLast > 0 && V > 12 && lift == null) lift = { t, V, dist };
      wetLast = wet;
      const ph = ap.phase;
      if (lift != null && t > lift.t + 2 && (ph === 'CLIMB' || ph === 'LIFTOFF' || cg[1] > 5)) break;
      if (ph === 'ABORT' || ph === 'STOPPED') break;
    }
    return { lift, t, why: lift ? '' : 'stayed on the water' };
  } catch (e) { return { lift: null, t: 0, why: 'threw: ' + String(e && e.message || e).slice(0, 80) }; }
}
const HYDRO_MS = 1000 * +opt('hydro-secs', '150');   // the hydroplane run's wait inside one plane's probe (its --probe-secs is 300)
const BUSY_MS = 1000 * +opt('busy-secs', '60');      // a float build's wait for a busy bench to take the row
// the probe: the plane on the stand, its fiche drawn (no store), its pictures and numbers handed back
const PROBE = `(async () => {
  const P = window.PLANE_FICHE; if (!P) return { error: 'no PLANE_FICHE' };
  try { if (window.NEW_PLANE && NEW_PLANE.isOpen()) NEW_PLANE.close(); } catch (e) {}
  const t0 = performance.now();
  // FICHE-WATER: the hydroplane test first - a float build only (BENCH_RUN is false where the row is not offered)
  let hydro = null;
  const hy = () => { try { const B = window.BENCH_STATE && window.BENCH_STATE(); return (B && B.results && B.results.hydro) || null; } catch (e) { return null; } };
  // a BUSY bench (a row still running, a flight pending - AIRCRAFT-LOOKS' 14:42 rig) also answers false: on a float or hull
  // build (the stand's spec, plane_fiche.js's own test) the probe asks again for up to BUSY_MS; a land build asks once, as before
  let sea = false; try { const sp = window.GARAGE_SPEC && window.GARAGE_SPEC.get();
    sea = !!sp && (/float|hull/i.test(String((sp.gear && sp.gear.type) || '')) || +(sp.cage && sp.cage.hullOn) > 0); } catch (e) { sea = false; }
  const tb = performance.now();
  let asked = typeof window.BENCH_RUN === 'function' && window.BENCH_RUN('hydro');
  while (!asked && sea && typeof window.BENCH_RUN === 'function' && performance.now() - tb < ${BUSY_MS}) {
    await new Promise(r => setTimeout(r, 500)); asked = window.BENCH_RUN('hydro'); }
  if (!asked && sea) hydro = { ms: Math.round(performance.now() - tb), done: false, ok: false, verdict: 'not offered or busy', lift: null, refused: true };
  if (asked) {
    const t1 = performance.now();
    while (performance.now() - t1 < ${HYDRO_MS}) { const h = hy(); if (h && !h.running) break; await new Promise(r => setTimeout(r, 250)); }
    const h = hy();
    hydro = { ms: Math.round(performance.now() - t1), waited: Math.round(t1 - tb), done: !!(h && !h.running), ok: !!(h && h.ok), verdict: h ? String(h.verdict || h.running || '') : 'no result',
              lift: (h && h.lift) || null };
  }
  const rec = await P.generate({ name: 'bake', store: false });
  const b64 = b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(b); });
  const files = {}; for (const [k, b] of Object.entries(rec.pics)) files[k] = await b64(b);
  return { ms: Math.round(performance.now() - t0), time: P.lastTime, data: rec.data, files, hydro };
})()`;
const probeFile = path.join(work, 'fiche_probe.js'); fs.writeFileSync(probeFile, PROBE);
const builds = rows.map(r => path.join(FLY, r.file));
const secs = +opt('secs', '900');
const args = [path.join(__dirname, 'plane_shot.js'), '--secs', String(secs), '--views', '', '--out', work, '--build', builds.join(','),
              '--probe', probeFile, '--probe-out', '--probe-secs', '300'].concat(flag('gpu') ? ['--gpu'] : []);
console.log('fiche_bake:', rows.length, 'official plane(s) ->', path.relative(FLY, OUT));
const p = spawnSync(process.execPath, args, { cwd: FLY, stdio: 'inherit', timeout: (secs + 60) * 1000 });
// the index: the old one kept for a plane that failed
let index = { what: 'flydiy-fiches', fiches: {} };
try { const o = JSON.parse(fs.readFileSync(path.join(OUT, 'index.json'), 'utf8')); if (o && o.fiches) index.fiches = o.fiches; } catch (e) {}
let done = 0, kb = 0; const missed = [];
for (const r of rows) {
  const base = path.basename(r.file).replace(/\.json$/i, ''), pf = path.join(work, base + '_probe.json');
  let v = null; try { v = JSON.parse(fs.readFileSync(pf, 'utf8')); } catch (e) {}
  if (!v || v.error || !v.files || !v.files.hero) { missed.push(r.thumb + (v && v.error ? ' (' + String(v.error).slice(0, 80) + ')' : '')); continue; }
  const dir = safe(r.thumb), pics = {};
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  for (const [view, b] of Object.entries(v.files)) { const f = dir + '/' + view + '.webp', buf = Buffer.from(b, 'base64'); fs.writeFileSync(path.join(OUT, f), buf); pics[view] = f; kb += buf.length / 1024; }
  const data = Object.assign({}, v.data, { name: r.name });
  // a float build the page could not run (the phone profile): the node run's lift-off on the fiche
  let nh = null;
  if (data.sea && !(v.hydro && v.hydro.lift)) {
    nh = nodeHydro(r.file);
    if (nh.lift) { data.specs = Object.assign({}, data.specs, { TORun: Math.round(nh.lift.dist), TOWater: null });
                   data.hydroNode = { t: +nh.lift.t.toFixed(1), V: +nh.lift.V.toFixed(1), dist: Math.round(nh.lift.dist) }; }
  }
  // `file`: the build file's own internal name - a plane loaded from it carries that as its save's name, and the board shows
  // the list's name for it, never the key (fiche_board.js titleOf; the user 9 Nov: "piperCub" on a fiche)
  let file = ''; try { file = JSON.parse(fs.readFileSync(path.join(FLY, r.file), 'utf8')).name || ''; } catch (e) {}
  index.fiches[r.thumb] = { name: r.name, file, data, pics };
  done++;
  console.log('fiche_bake:', r.thumb, r.name, v.ms + ' ms', Object.keys(pics).join(','), 'worst task ' + JSON.stringify(v.time && v.time.worst),
    'hydro: ' + (!v.hydro ? 'none' : v.hydro.refused ? 'REFUSED for ' + v.hydro.ms + ' ms on a float build (the bench busy, or no row - the fiche says see the hydroplane test)' : !v.hydro.done ? 'unsettled after ' + v.hydro.ms + ' ms (the fiche says see the hydroplane test)'
      : v.hydro.lift ? 'lift-off ' + Math.round(v.hydro.lift.dist) + ' m in ' + v.hydro.ms + ' ms' : v.hydro.verdict + ' (' + v.hydro.ms + ' ms)'),
    'node hydro: ' + (!nh ? '-' : nh.lift ? 'lift-off ' + Math.round(nh.lift.dist) + ' m at ' + nh.lift.t.toFixed(1) + ' s, ' + Math.round(nh.lift.V * 3.6) + ' km/h' : nh.why),
    'take-off row: ' + JSON.stringify(data.specs ? (data.specs.TOWater ? 'on water: ' + data.specs.TOWater : data.specs.TORun + (data.sea ? ' m on water' : ' m')) : null));
}
{ const n = {}; for (const e of Object.values(index.fiches)) if (e.file) n[e.file] = (n[e.file] || 0) + 1;   // a name two files share ("build") names neither
  for (const e of Object.values(index.fiches)) if (e.file && n[e.file] > 1) e.file = ''; }
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n');
console.log('fiche_bake: ' + done + ' of ' + rows.length + ' baked, ' + Math.round(kb) + ' KB' + (missed.length ? '; missed: ' + missed.join(', ') : '') + (p.status ? '; plane_shot exit ' + p.status : ''));
if (!keep) try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) {}
process.exit(done === rows.length ? 0 : 2);
