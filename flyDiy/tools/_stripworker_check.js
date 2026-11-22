#!/usr/bin/env node
// _stripworker_check.js - GATE STRIPWORKER (PERF-WORLDBUILD, 22 Nov 2026): THE STRIPS THE HOUSE WORKER BUILT ARE THE STRIPS
// THE PAGE WOULD HAVE BUILT, BYTE FOR BYTE - asked at the load (?stripw=1) or landed after it (?nearfirst=1).
//
// render_world.js asks the house worker for every pavement strip's geometry (stripsAsk) and stands the arrays that come
// back (PAVEMENT.stripUnpack) where it built each strip itself on the main thread (PAVEMENT.stripGeometry: 10.6 s of the
// world step in node, the dearest strip a 4.5 s task). The worker builds with the page's own builder on its own composed
// world. Two page processes in node (tools/_page_node.js, the Worker shim a worker_threads thread, a cold fake IndexedDB),
// each booted through the page's ONE LOADING:
// THE LOAD (?stripw=1):
//   1. EVERY pavement strip of the island stood from the worker's arrays (none built on the page's thread, none missed);
//   2. each one EQUAL to the inline build made from the same options (render_world's tap, FLYDIY_STRIPW_TAP): every
//      attribute's array type, length and bytes, the index's, the bounding sphere's four numbers, the rows, the columns
//      and the frame;
//   3. ANOTHER SOIL RUNG: the ground held 'soft' and then 'dry' on the page (world.setGround - a weather strip's worn relief
//      scales with it, and its rows are bisected on that relief), every strip asked of the worker again with the page's
//      scales (the job's `wear`) and compared with the inline build on the held ground - and the rung MOVED a weather
//      strip's bytes (else the row proves nothing; none on the island: said, not failed);
//   4. the worker's arrays are TRANSFERRED (the stats' kept = 0).
// NEAR FIRST (?nearfirst=1, every strip but the stand's HELD coarse at the load: FLYDIY_STRIPW_HOLD):
//   5. at the end of the loading every held strip stands COARSE (its vertices the unrefined builder's count), or has landed;
//   6. every one LANDS (none lost, none built refined on the page's thread), one a task, and the landed strip is EQUAL to
//      the inline build, byte for byte (the same comparison as 2, made after the landings: nothing of the gate's is timed);
//   7. the END STATE: one mesh a strip, UNMERGED, each on its refined vertices; the longest landing task on this machine's
//      clock is printed (a report: the bar is the box's).
//   node tools/_stripworker_check.js            the verdict (two page processes one after the other, ~5 min)
//   node tools/_stripworker_check.js --only load|near       one of them
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const MODE = argv.includes('--child') ? argv[argv.indexOf('--child') + 1] : null;
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
const bad = [];
const say = s => console.log(s);
const chk = (c, m) => { if (!c) bad.push(m); return !!c; };
const bytes = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
const sha = a => crypto.createHash('sha256').update(bytes(a)).digest('hex').slice(0, 12);
const hr = () => Number(process.hrtime.bigint()) / 1e6;

// a geometry as plain references (its arrays as they are NOW: PAVEMENT.make deletes two attributes later, the arrays live on)
function view(g) {
  const a = {}; for (const k of Object.keys(g.attributes)) a[k] = { array: g.attributes[k].array, itemSize: g.attributes[k].itemSize };
  const s = g.boundingSphere, p = g.userData.pav;
  return { a, order: Object.keys(g.attributes), index: g.index ? g.index.array : null, sphere: s ? [s.center.x, s.center.y, s.center.z, s.radius] : null,
    pav: p ? { kind: p.kind, len: p.len, wid: p.wid, shoulderW: p.shoulderW, cls: p.cls, seed: p.seed, rows: p.rows, cols: p.cols, frame: JSON.stringify([p.frame.T, p.frame.N, p.frame.cx, p.frame.cz, p.frame.halfL, p.frame.halfW]) } : null };
}
// two views, the same: -> the list of what differs (empty: equal)
function diffView(A, B) {
  const d = [];
  if (A.order.join(',') !== B.order.join(',')) d.push('attributes ' + A.order.join(',') + ' / ' + B.order.join(','));
  for (const k of A.order) { const a = A.a[k], b = B.a[k]; if (!b) continue;
    if (a.itemSize !== b.itemSize) d.push(k + ' itemSize');
    if (a.array.constructor.name !== b.array.constructor.name) d.push(k + ' type ' + a.array.constructor.name + ' / ' + b.array.constructor.name);
    if (a.array.length !== b.array.length) d.push(k + ' length ' + a.array.length + ' / ' + b.array.length);
    else if (!bytes(a.array).equals(bytes(b.array))) { let n = 0, first = -1; for (let i = 0; i < a.array.length; i++) if (!Object.is(a.array[i], b.array[i])) { n++; if (first < 0) first = i; } d.push(k + ' ' + n + ' values differ (first at ' + first + ': ' + a.array[first] + ' / ' + b.array[first] + ')'); } }
  if (!A.index || !B.index) d.push('index missing');
  else if (A.index.constructor.name !== B.index.constructor.name || A.index.length !== B.index.length || !bytes(A.index).equals(bytes(B.index))) d.push('index');
  if (!A.sphere || !B.sphere || A.sphere.some((v, i) => !Object.is(v, B.sphere[i]))) d.push('sphere');
  for (const k of ['kind', 'len', 'wid', 'shoulderW', 'cls', 'seed', 'rows', 'cols', 'frame']) if (!A.pav || !B.pav || !Object.is(A.pav[k], B.pav[k])) d.push('pav.' + k);
  return d;
}

async function boot(query, before) {
  const { openPage } = require('./_page_node.js');
  let W = null;
  const hooks = { beforeScript(n, P) { if (n === 'src/viewer/app.js') { W = P.win; before(W); } } };
  const t0 = Date.now();
  const P = await openPage({ quiet: true, hooks, query: query + (process.env.STRIPWORKER_QUERY ? '&' + process.env.STRIPWORKER_QUERY : ''), workers: /house_worker\.js/,
    idb: fs.mkdtempSync(path.join(os.tmpdir(), 'sw-idb-')), workerWaitMs: 900000 });
  W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 3600000);
  return { P, W, bootS: ((Date.now() - t0) / 1000).toFixed(0) };
}
const wantOf = world => world.aerodromes.filter(a => !(a.kind === 'meadow' || a.kind === 'water' || (a.id === 'HOME' && !a.premises)));
const warnsOf = P => P.errors.concat(P.logs || []).filter(e => /strip worker|house worker/i.test(String(e)));   // (the page's warnings are in its logs)

// ---- THE LOAD -----------------------------------------------------------------------------------------------------------
async function load() {
  const TAPS = [];   // { id, sd, verts, diff, posSha }
  // render_world's tap: a strip stood from the worker's arrays - the inline build made beside it, the two compared here
  const { P, W, bootS } = await boot('stripw=1', Wn => { Wn.FLYDIY_STRIPW_TAP = (id, sd, g) => {
    let diff; try { const ref = Wn.PAVEMENT.stripGeometry(Wn.THREE, sd); diff = diffView(view(g), view(ref)); ref.dispose(); } catch (e) { diff = ['the inline build threw: ' + (e && e.message)]; }
    TAPS.push({ id, sd, verts: g.attributes.position.count, diff, posSha: sha(g.attributes.position.array) }); }; });
  const S = W.FLYDIY_STRIPW, world = W.FLIGHT_PROBE.world(), PAV = W.PAVEMENT;
  say('THE LOAD (?stripw=1) - the page booted in ' + bootS + ' s (build ' + W.FLYDIY_BUILD + ')');
  if (!chk(!!S, 'no FLYDIY_STRIPW: render_world has no strip worker')) return;
  // ---- 1. every pavement strip from the worker
  const want = wantOf(world);
  say('1. asked ' + S.asked + ' (' + S.why + '), stood from the worker ' + S.used + ', built on the page ' + S.inline + ', missed ' + S.missed + '; the worker ' + Math.round(S.workerMs) + ' ms; strips of the island ' + want.length);
  chk(S.why === 'asked', 'the strips were not asked of the worker (' + S.why + ')');
  chk(S.used > 0 && S.used === S.asked, 'not every asked strip stood from the worker (' + S.used + ' of ' + S.asked + ')');
  chk(S.inline === want.length - S.asked, 'a pavement strip was built on the page\'s thread (' + S.inline + ' inline, ' + (want.length - S.asked) + ' are not pavement strips)');
  chk(S.missed === 0, S.missed + ' answers were missed');
  // ---- 2. each equal to the inline build
  let v = 0;
  for (const t of TAPS) { v += t.verts; if (t.diff.length) bad.push('strip ' + t.id + ' differs from the inline build: ' + t.diff.slice(0, 4).join('; ')); }
  say('2. compared ' + TAPS.length + ' strips, ' + v + ' vertices: ' + TAPS.filter(t => !t.diff.length).length + ' equal byte for byte' + (TAPS.some(t => t.diff.length) ? ' - DIFFER: ' + TAPS.filter(t => t.diff.length).map(t => t.id).join(', ') : ''));
  chk(TAPS.length === S.used, 'the tap saw ' + TAPS.length + ' strips, the build stood ' + S.used);
  // ---- 2b. THE TABLE PROGRAM'S STAND-IN (PAVEMENT.warmMesh, the generator's 'pavement program' yield): what a host hands
  // to the compiler ~40 s before the first strip is drawn must key the SAME program as the drawn pavement: the one
  // material object, a mesh flagged as the drawn ones are, and the attribute names three's key and the hook read
  {
    const wm = PAV.warmMesh ? PAV.warmMesh(W.THREE) : null, names = g => Object.keys(g.attributes).sort().join(',');
    if (chk(!!wm, 'PAVEMENT.warmMesh gave no stand-in (the table path is the one the game draws with)')) {
      chk(PAV.warmMesh(W.THREE) === wm, 'warmMesh made a second stand-in');
      chk(!wm.parent, 'the stand-in is in a scene (it is handed over, never drawn)');
      chk(wm.geometry.attributes.position.count === 3 && !wm.geometry.index, 'the stand-in is not one bare triangle');
      const drawn = []; W.WORLD.scene.traverse(o => { if (o.isMesh && o.material === wm.material) drawn.push(o); });
      const sets = new Map(); for (const o of drawn) { const k = names(o.geometry) + ' | receiveShadow ' + !!o.receiveShadow + ' | morph ' + Object.keys(o.geometry.morphAttributes || {}).length; sets.set(k, (sets.get(k) || 0) + 1); }
      const mine = names(wm.geometry) + ' | receiveShadow ' + !!wm.receiveShadow + ' | morph 0';
      say('2b. the stand-in: ' + mine + '; the scene draws ' + drawn.length + ' meshes on its material: ' + [...sets].map(([k, n]) => n + ' x ' + k).join(' || '));
      chk(drawn.length > 0, 'no drawn mesh is on the material of the stand-in (the table material is not the one the strips draw with)');
      for (const [k, n] of sets) chk(k === mine, n + ' drawn pavement meshes differ from the stand-in (' + k + '): an early link would key another program');
      let steps = null; try { steps = /yield 'pavement program';\s*yield 'terrain';/.test(String(W.buildWorldSceneSteps)); } catch (e) {}
      chk(steps === true, 'buildWorldSceneSteps has no "pavement program" yield just before "terrain" (after the probe and the lights)');
    }
  }
  // ---- 3. another rung: the ground held, every strip asked again with the page's scales
  const HWK = W.HOUSE_WORKER, HQ = W.WORLD.premises.hw;
  let moved = 0, asked2 = 0, equal2 = 0;
  if (chk(HWK && HWK.ok() && HQ && HQ.epoch >= 0, 'the house worker is not there for the second rung')) {
    for (const level of ['soft', 'dry']) {
      world.setGround(level);
      const wear = world.wearScales(), got = new Map(); let seq = 9000;
      HWK.onStrip = m => got.set(m.seq, m);
      const jobs = TAPS.map(t => { const data = {}; for (const k of Object.keys(t.sd)) if (typeof t.sd[k] !== 'function') data[k] = t.sd[k];
        return { seq: ++seq, id: t.id, micro: t.sd.heightAt !== world.terrainH, lift: !!t.sd.liftAt, sd: Object.assign({ fadeW: PAV.recipe.fadeW, reuseRefine: !!(PAV.REFINE && PAV.REFINE.reuseHeight) }, data), t }; });
      HWK.post({ cmd: 'strips', epoch: HQ.epoch, wear, jobs: jobs.map(j => ({ seq: j.seq, id: j.id, micro: j.micro, lift: j.lift, sd: j.sd })) });
      await P.until(() => got.size >= jobs.length, 1800000);
      let mv = 0;
      for (const j of jobs) { asked2++;
        const m = got.get(j.seq);
        if (!m || !m.r) { bad.push('rung ' + level + ': strip ' + j.id + ' had no answer (' + (m && m.miss) + ')'); continue; }
        const ref = PAV.stripGeometry(W.THREE, j.t.sd), g = PAV.stripUnpack(W.THREE, j.t.sd, m.r), d = diffView(view(g), view(ref));
        if (d.length) bad.push('rung ' + level + ': strip ' + j.id + ' differs: ' + d.slice(0, 4).join('; ')); else equal2++;
        if (sha(ref.attributes.position.array) !== j.t.posSha || ref.attributes.position.count !== j.t.verts) mv++;
        ref.dispose(); g.dispose(); }
      moved += mv;
      say('3. the ground held ' + level + ' (scales ' + JSON.stringify(wear) + '): ' + jobs.length + ' strips asked again, ' + mv + ' differ from the boot\'s rung');
    }
    world.setGround(null);
    const wxN = (world.premises && world.premises.overlay && world.premises.overlay.wxMicroN) || 0;
    say('   equal ' + equal2 + ' of ' + asked2 + '; weather strips with a worn relief on the island: ' + wxN);
    chk(equal2 === asked2, 'a strip built at another rung differs from the inline build');
    if (wxN > 0) chk(moved > 0, 'no weather strip moved with the rung: the second rung proves nothing');
  }
  // ---- 4. transferred
  const st = HWK && HWK.stats ? HWK.stats() : {};
  say('4. the worker: ' + JSON.stringify({ strips: st.strips, stripMs: st.stripMs, moved: st.moved, kept: st.kept, mb: st.mb }));
  chk(st.kept === 0, 'the worker copied ' + st.kept + ' arrays instead of transferring them');
  const errs = warnsOf(P);
  chk(!errs.length, 'the page warned: ' + errs.slice(0, 3).join(' | '));
}

// ---- NEAR FIRST ---------------------------------------------------------------------------------------------------------
async function near() {
  const TAPS = [], LANDS = []; let tL = 0, Wp = null;
  const { P, W, bootS } = await boot('nearfirst=1', Wn => { Wp = Wn;
    Wn.FLYDIY_STRIPW_HOLD = true;
    Wn.FLYDIY_STRIPW_TAP = (id, sd, g) => { TAPS.push({ id, sd, v: view(g), verts: g.attributes.position.count }); };   // (references only: compared after the landings)
    Wn.FLYDIY_STRIPW_LAND = (id, ph) => { if (!ph) tL = hr(); else LANDS.push({ id, ms: hr() - tL }); }; });
  const S = W.FLYDIY_STRIPW, world = W.FLIGHT_PROBE.world(), PAV = W.PAVEMENT;
  say('NEAR FIRST (?nearfirst=1, held) - the page booted in ' + bootS + ' s (build ' + W.FLYDIY_BUILD + ')');
  if (!chk(!!S && S.near === true, 'render_world is not in its near-first mode')) return;
  // ---- 5. coarse at the end of the loading (or landed since: the landings start with the strips' stage)
  const stoodNow = () => { const out = new Map(); W.WORLD.scene.traverse(o => { if (o.isMesh && o.userData && o.userData.pavMat && /^pavement:/.test(o.name || '')) out.set(o.name.slice(9), o); }); return out; };
  const here = S.asked - S.coarse;
  say('5. asked ' + S.asked + ' (' + S.why + '), stood coarse at the load ' + S.coarse + ', refined at the load ' + here + ' (the strip the aeroplane stands on, if any); at the end of the loading ' + S.landed + ' landed, ' + S.late.size + ' still coarse');
  chk(S.why === 'asked' && S.asked > 0, 'the strips were not asked of the worker (' + S.why + ')');
  chk(S.coarse >= S.asked - 1 && S.coarse > 0, 'the load did not stand the held strips coarse (' + S.coarse + ' of ' + S.asked + ')');
  chk(S.inline === wantOf(world).length - S.asked, S.inline + ' strips were built refined on the page\'s thread');
  // ---- 6. every one lands, equal to the inline build
  await P.until(() => S.late.size === 0 && !S.pumpT, 1800000);
  chk(S.landed === S.coarse && S.lost === 0, 'landed ' + S.landed + ' of ' + S.coarse + ' coarse strips, lost ' + S.lost);
  let eq = 0, v = 0;
  for (const t of TAPS) { let d; try { const ref = PAV.stripGeometry(W.THREE, t.sd); d = diffView(t.v, view(ref)); ref.dispose(); } catch (e) { d = ['the inline build threw: ' + (e && e.message)]; }
    v += t.verts; if (d.length) bad.push('strip ' + t.id + ' differs from the inline build: ' + d.slice(0, 4).join('; ')); else eq++; }
  say('6. landed ' + S.landed + ', lost ' + S.lost + ', asked again ' + S.reasked + '; compared ' + TAPS.length + ' strips, ' + v + ' vertices: ' + eq + ' equal byte for byte');
  chk(TAPS.length === S.asked, 'the tap saw ' + TAPS.length + ' refined strips, ' + S.asked + ' were asked');
  // ---- 7. the end state: one mesh a strip, unmerged, refined
  const end = stoodNow(); let merged = 0; W.WORLD.scene.traverse(o => { if (o.name === 'pavement:merged') merged++; });
  let refined = 0; for (const t of TAPS) { const m = end.get(t.id); if (m && m.geometry.attributes.position.count === t.verts) refined++; }
  const lmax = LANDS.reduce((a, l) => Math.max(a, l.ms), 0), lsum = LANDS.reduce((a, l) => a + l.ms, 0);
  say('7. the end state: ' + end.size + ' strip meshes, ' + merged + ' merged, ' + refined + ' on their refined vertices; ' + LANDS.length + ' landings, ' + Math.round(lsum) + ' ms in all, the longest ' + lmax.toFixed(1) + ' ms (' + (LANDS.slice().sort((a, b) => b.ms - a.ms)[0] || {}).id + ') on this machine');
  chk(merged === 0, merged + ' merged strip meshes under near-first');
  chk(end.size === S.asked && refined === S.asked, 'not every strip ends on its refined mesh (' + refined + ' of ' + S.asked + ', ' + end.size + ' meshes)');
  const st = W.HOUSE_WORKER && W.HOUSE_WORKER.stats ? W.HOUSE_WORKER.stats() : {};
  chk(st.kept === 0, 'the worker copied ' + st.kept + ' arrays instead of transferring them');
  const errs = warnsOf(P);
  chk(!errs.length, 'the page warned: ' + errs.slice(0, 3).join(' | '));
}

(async () => {
  if (MODE) {
    await (MODE === 'near' ? near() : load());
    for (const b of bad) say('  FAIL ' + b);
    say('CHILD ' + MODE + ': ' + (bad.length ? 'FAIL' : 'PASS'));
    process.exit(bad.length ? 1 : 0);
  }
  say('GATE STRIPWORKER');
  let ok = true;
  for (const m of ['load', 'near']) {
    if (ONLY && ONLY !== m) continue;
    const r = spawnSync(process.execPath, ['--max-old-space-size=6144', __filename, '--child', m], { stdio: ['ignore', 'inherit', 'inherit'], maxBuffer: 1 << 28 });
    if (r.status !== 0) ok = false;
  }
  say('GATE STRIPWORKER: ' + (ok ? 'PASS' : 'FAIL'));
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('  FAIL ' + (e && e.stack || e)); console.log('GATE STRIPWORKER: FAIL'); process.exit(1); });
