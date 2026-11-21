#!/usr/bin/env node
// _stripworker_check.js - GATE STRIPWORKER (PERF-WORLDBUILD, 22 Nov 2026): THE STRIPS THE HOUSE WORKER BUILT ARE THE STRIPS
// THE PAGE WOULD HAVE BUILT, BYTE FOR BYTE.
//
// render_world.js asks the house worker for every pavement strip's geometry (?stripw=1: stripsAsk) and stands the arrays
// that come back (PAVEMENT.stripUnpack) where it built each strip itself on the main thread (PAVEMENT.stripGeometry: 11.9 s
// of the world step in node, the dearest strip a 4.7 s task). The worker builds with the page's own builder on its own
// composed world. This gate boots the page in node (tools/_page_node.js, the Worker shim a worker_threads thread, a cold
// fake IndexedDB) through its ONE LOADING with ?stripw=1 and holds:
//   1. EVERY pavement strip of the island stood from the worker's arrays (none built on the page's thread, none missed);
//   2. each one EQUAL to the inline build made beside it from the same options (render_world's tap, FLYDIY_STRIPW_TAP):
//      every attribute's array type, length and bytes, the index's, the bounding sphere's four numbers, the rows, the
//      columns and the frame;
//   3. ANOTHER SOIL RUNG: the ground held 'soft' and then 'dry' on the page (world.setGround - a weather strip's worn relief
//      scales with it, and its rows are bisected on that relief), every strip asked of the worker again with the page's
//      scales (the job's `wear`) and compared with the inline build on the held ground - and the rung MOVED a weather
//      strip's bytes (else the row proves nothing; none on the island: said, not failed);
//   4. the worker's arrays are TRANSFERRED (the stats' kept = 0).
//   node tools/_stripworker_check.js            the verdict (one page process, ~3 min)
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const out = [], bad = [];
const say = s => { out.push(s); console.log(s); };
const chk = (c, m) => { if (!c) bad.push(m); return !!c; };
const bytes = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
const sha = a => crypto.createHash('sha256').update(bytes(a)).digest('hex').slice(0, 12);

// two geometries, the same: -> the list of what differs (empty: equal)
function diffGeo(A, B) {
  const d = [], ka = Object.keys(A.attributes), kb = Object.keys(B.attributes);
  if (ka.join(',') !== kb.join(',')) d.push('attributes ' + ka.join(',') + ' / ' + kb.join(','));
  for (const k of ka) { const a = A.attributes[k], b = B.attributes[k]; if (!b) continue;
    if (a.itemSize !== b.itemSize) d.push(k + ' itemSize');
    if (a.array.constructor.name !== b.array.constructor.name) d.push(k + ' type ' + a.array.constructor.name + ' / ' + b.array.constructor.name);
    if (a.array.length !== b.array.length) d.push(k + ' length ' + a.array.length + ' / ' + b.array.length);
    else if (!bytes(a.array).equals(bytes(b.array))) { let n = 0, first = -1; for (let i = 0; i < a.array.length; i++) if (!Object.is(a.array[i], b.array[i])) { n++; if (first < 0) first = i; } d.push(k + ' ' + n + ' values differ (first at ' + first + ': ' + a.array[first] + ' / ' + b.array[first] + ')'); } }
  const ia = A.index && A.index.array, ib = B.index && B.index.array;
  if (!ia || !ib) d.push('index missing');
  else if (ia.constructor.name !== ib.constructor.name || ia.length !== ib.length || !bytes(ia).equals(bytes(ib))) d.push('index');
  const sa = A.boundingSphere, sb = B.boundingSphere;
  if (!sa || !sb || !Object.is(sa.center.x, sb.center.x) || !Object.is(sa.center.y, sb.center.y) || !Object.is(sa.center.z, sb.center.z) || !Object.is(sa.radius, sb.radius)) d.push('sphere');
  const pa = A.userData.pav, pb = B.userData.pav;
  for (const k of ['kind', 'len', 'wid', 'shoulderW', 'cls', 'seed', 'rows', 'cols']) if (!pa || !pb || !Object.is(pa[k], pb[k])) d.push('pav.' + k);
  if (pa && pb && JSON.stringify([pa.frame.T, pa.frame.N, pa.frame.cx, pa.frame.cz, pa.frame.halfL, pa.frame.halfW]) !== JSON.stringify([pb.frame.T, pb.frame.N, pb.frame.cx, pb.frame.cz, pb.frame.halfL, pb.frame.halfW])) d.push('pav.frame');
  return d;
}

(async () => {
  const { openPage } = require('./_page_node.js');
  const TAPS = [];   // { id, sd, verts, diff, posSha }
  let W = null;
  const hooks = {
    beforeScript(n, P) {
      if (n !== 'src/viewer/app.js') return;
      W = P.win;
      // render_world's tap: a strip stood from the worker's arrays - the inline build made beside it, the two compared here
      W.FLYDIY_STRIPW_TAP = (id, sd, g) => {
        let diff; try { const ref = W.PAVEMENT.stripGeometry(W.THREE, sd); diff = diffGeo(g, ref); ref.dispose(); } catch (e) { diff = ['the inline build threw: ' + (e && e.message)]; }
        TAPS.push({ id, sd, verts: g.attributes.position.count, diff, posSha: sha(g.attributes.position.array) });
      };
    },
  };
  const t0 = Date.now();
  const P = await openPage({ quiet: true, hooks, query: 'stripw=1' + (process.env.STRIPWORKER_QUERY ? '&' + process.env.STRIPWORKER_QUERY : ''), workers: /house_worker\.js/,
    idb: fs.mkdtempSync(path.join(os.tmpdir(), 'sw-idb-')), workerWaitMs: 900000 });
  W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 3600000);
  const S = W.FLYDIY_STRIPW, world = W.FLIGHT_PROBE.world(), PAV = W.PAVEMENT;
  say('GATE STRIPWORKER - the page booted in ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s (build ' + W.FLYDIY_BUILD + ')');
  if (!chk(!!S, 'no FLYDIY_STRIPW: render_world has no strip worker')) { say('GATE STRIPWORKER: FAIL'); process.exit(1); }
  // ---- 1. every pavement strip from the worker ----------------------------------------------------------------------
  const want = world.aerodromes.filter(a => !(a.kind === 'meadow' || a.kind === 'water' || (a.id === 'HOME' && !a.premises)));
  say('1. asked ' + S.asked + ' (' + S.why + '), stood from the worker ' + S.used + ', built on the page ' + S.inline + ', missed ' + S.missed + '; the worker ' + Math.round(S.workerMs) + ' ms; strips of the island ' + want.length);
  chk(S.why === 'asked', 'the strips were not asked of the worker (' + S.why + ')');
  chk(S.used > 0 && S.used === S.asked, 'not every asked strip stood from the worker (' + S.used + ' of ' + S.asked + ')');
  chk(S.inline === want.length - S.asked, 'a pavement strip was built on the page\'s thread (' + S.inline + ' inline, ' + (want.length - S.asked) + ' are not pavement strips)');
  chk(S.missed === 0, S.missed + ' answers were missed');
  // ---- 2. each equal to the inline build ------------------------------------------------------------------------------
  let v = 0;
  for (const t of TAPS) { v += t.verts; if (t.diff.length) bad.push('strip ' + t.id + ' differs from the inline build: ' + t.diff.slice(0, 4).join('; ')); }
  say('2. compared ' + TAPS.length + ' strips, ' + v + ' vertices: ' + TAPS.filter(t => !t.diff.length).length + ' equal byte for byte' + (TAPS.some(t => t.diff.length) ? ' - DIFFER: ' + TAPS.filter(t => t.diff.length).map(t => t.id).join(', ') : ''));
  chk(TAPS.length === S.used, 'the tap saw ' + TAPS.length + ' strips, the build stood ' + S.used);
  // ---- 3. another rung: the ground held, every strip asked again with the page's scales -----------------------------
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
        const ref = PAV.stripGeometry(W.THREE, j.t.sd), g = PAV.stripUnpack(W.THREE, j.t.sd, m.r), d = diffGeo(g, ref);
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
  // ---- 4. transferred ---------------------------------------------------------------------------------------------------
  const st = HWK && HWK.stats ? HWK.stats() : {};
  say('4. the worker: ' + JSON.stringify({ strips: st.strips, stripMs: st.stripMs, moved: st.moved, kept: st.kept, mb: st.mb }));
  chk(st.kept === 0, 'the worker copied ' + st.kept + ' arrays instead of transferring them');
  const errs = P.errors.concat(P.logs || []).filter(e => /strip worker|house worker/i.test(String(e)));   // (the page's warnings are in its logs)
  chk(!errs.length, 'the page warned: ' + errs.slice(0, 3).join(' | '));
  for (const b of bad) say('  FAIL ' + b);
  say('GATE STRIPWORKER: ' + (bad.length ? 'FAIL' : 'PASS'));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('  FAIL ' + (e && e.stack || e)); console.log('GATE STRIPWORKER: FAIL'); process.exit(1); });
