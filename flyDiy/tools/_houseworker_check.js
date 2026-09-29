#!/usr/bin/env node
// _houseworker_check.js - GATE HOUSEWORKER (G833, C2a of QUEUE-C): THE HOUSES BUILT IN A WORKER ARE THE HOUSES THE PAGE
// BUILT, THE PAGE'S TOWN STEP GENERATES NOTHING, AND A SECOND VISIT BUILDS NOTHING.
//
// The page in node (tools/_page_node.js, GATE FRAMECOST's harness) with its Worker shim (G815's, the Blob worker a
// worker_threads thread) and a FAKE IndexedDB in the worker's thread (tools/_page_node.js `idb`: a directory,
// one file a key, values through v8's structured serializer - a second page process finds what the first stored).
// Each CHILD is one page process (~3.6 GB; they run one after another), booted through the page's own ONE LOADING
// (B8B9: the garage and the world, the town among its steps) until the loading screen is gone:
//   local    ?housew=0: the house worker off - the page generates every house itself, inline (the reference)
//   cold     the worker on, an EMPTY cache: every entry generated in the worker
//   warm     the worker on, the cache the cold child left: nothing generated
//   partial  the worker on, the cache with every third entry deleted: those alone generated, between cache hits (the
//            village's two tallies - premises_build.js - carried across the hits exactly)
// Per child, per queue entry the town built (houses, site items, site fences; the stream's too): a DIGEST of what
// stands in the scene - every object under its groups (the house, its extras: the fence, the outbuilding, the yard; its
// lod-1 far meshes) by traversal order: type, name, transform, flags, and every geometry attribute's and index's BYTES
// and array type; every material's type and values, and the uniform values of the finish that made it (the sag a
// build writes). And the GENERATION CALLS on the page's own thread by boot step (HOUSE_GEN.build by lod, the other
// generators' build, VILLAGE_GEN.placeHouse / finishPlot / lotGround / buildFence, HOUSE_KIT.bakeAO).
// CHECKS: cold, warm and partial equal local, entry by entry, bit for bit; the worker children's town step (the
// generation calls made while the page builds an entry itself are kept apart: '@here') makes ZERO house generation
// calls on the page's thread - the page builds itself only the three HANGAR_GEN items (their lod-0 shell is hangar.js's
// THREE build: canvas sheets and materials of its own; render_premises hwMainOnly); cold generates every worker entry,
// warm 0, partial exactly the deleted ones; every array the worker posts is TRANSFERRED (its buffer detached there).
// The digest leaves out `visible` and `castShadow`: the distant houses' detail cull and the shadow thrift switch them
// from the eye on the page's clock, whoever generated the house (a worker boot lands the town at another virtual time).
//   node tools/_houseworker_check.js                 the four children, the verdict
//   node tools/_houseworker_check.js --only local,cold
//   node tools/_houseworker_check.js --child <mode> --idb <dir> --out <file>   (one child; what the parent spawns)
//   HOUSEWORKER_QUERY='x=1'  an extra page query for every child; HOUSEWORKER_DETAIL=1 every object's own digest (where
//   two builds part: compare the children's JSON, --keep <file>)
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

// the finish's uniform sets (the ones a build or a finish writes: premises_build.js uniGroups' top level)
const finGroups = F => { const out = []; for (const k of ['SHADE_U', 'GLASS_U', 'SMOKE_U', 'GROUND_U']) { if (F[k]) out.push([k, F[k]]); if (F.HF && F.HF[k]) out.push(['HF.' + k, F.HF[k]]); } return out; };
// ---- the digest of what an entry stands in the scene ----------------------------------------------------------------
function digestEntry(W, h, detail) {
  let H = crypto.createHash('sha256');
  const parts = detail ? [] : null;
  const num = v => (typeof v === 'number' ? (Object.is(v, -0) ? '-0' : String(v)) : String(v));
  const buf = a => Buffer.from(a.buffer, a.byteOffset, a.byteLength);
  const seenF = new Set();
  const mat = m => {
    if (!m) { H.update('m:null'); return; }
    H.update('m:' + m.type + '|' + (m.name || '') + '|' + [m.side, m.transparent, m.opacity, m.alphaTest, m.depthWrite, m.roughness, m.metalness, m.vertexColors, m.polygonOffset].map(num).join(','));
    if (m.color) H.update('c' + m.color.getHexString());
    for (const k of Object.keys(m.userData || {}).sort()) { const g = m.userData[k]; if (g && typeof g === 'object') for (const n of Object.keys(g).sort()) { const u = g[n]; if (u && typeof u === 'object' && 'value' in u) { const v = u.value; H.update(k + '.' + n + '=' + (typeof v === 'number' ? num(v) : v && v.toArray ? v.toArray().map(num).join(',') : typeof v)); } } }
    const F = m.userData && m.userData.__hwF;
    if (F && !seenF.has(F)) { seenF.add(F); for (const [g, U] of finGroups(F)) for (const n of Object.keys(U).sort()) { const u = U[n]; if (u && typeof u === 'object' && 'value' in u) { const v = u.value; H.update('F' + g + '.' + n + '=' + (typeof v === 'number' || typeof v === 'boolean' ? num(v) : v && v.toArray ? v.toArray().map(num).join(',') : typeof v)); } } }
  };
  const obj = o => {
    // (not `visible` nor `castShadow`: the distant houses' detail cull and the shadow thrift switch them from the eye,
    // on the page's clock - G557 / PERF 2026-09-23 - whoever generated the house)
    H.update('o:' + o.type + '|' + (o.name || '') + '|' + [o.position.x, o.position.y, o.position.z, o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w, o.scale.x, o.scale.y, o.scale.z, o.renderOrder, o.receiveShadow].map(num).join(','));
    const g = o.geometry;
    if (g && g.attributes) {
      for (const n of Object.keys(g.attributes)) { const a = g.attributes[n]; H.update('a:' + n + ':' + a.itemSize + ':' + (a.array && a.array.constructor.name)); if (a.array) H.update(buf(a.array)); }
      if (g.index) { H.update('i:' + g.index.array.constructor.name); H.update(buf(g.index.array)); }
    }
    if (o.material) for (const m of [].concat(o.material)) mat(m);
  };
  // a PROP (props.js propPlace: userData.prop) is its key and its pose: its rungs arrive on the asset loader's clock and
  // its ladder is cut by the thrift (G557) on the page's - timing, not generation; everything else whole
  const walk = o => {
    if (o.userData && o.userData.prop) { H.update('prop:' + (o.userData.prop.key || o.name) + '|' + [o.position.x, o.position.y, o.position.z, o.quaternion.x, o.quaternion.y, o.quaternion.z, o.quaternion.w, o.scale.x, o.scale.y, o.scale.z].map(num).join(',')); return; }
    if (o.isLOD) { H.update('lod|' + [o.position.x, o.position.y, o.position.z, o.quaternion.w].map(num).join(',')); return; }   // a ladder (a parked aeroplane's holder, a prop's): filled on its own clock
    if (parts) {
      const H0 = H; H = crypto.createHash('sha256'); obj(o); let t = (o.name || o.type) + ':' + H.digest('hex').slice(0, 10);
      const g = o.geometry, hs = a => crypto.createHash('sha256').update(buf(a)).digest('hex').slice(0, 6);
      if (g && g.attributes) t += ' [' + Object.keys(g.attributes).map(n => n + '=' + hs(g.attributes[n].array)).join(' ') + (g.index ? ' i=' + hs(g.index.array) : '') + ']';
      if (o.material) { H = crypto.createHash('sha256'); seenF.clear(); for (const m of [].concat(o.material)) mat(m); t += ' m=' + H.digest('hex').slice(0, 6); seenF.clear(); }
      parts.push(t); H = H0;
    }
    obj(o); for (const c of o.children) walk(c);
  };
  const groups = [h.grp].concat(h.extra || []).filter(Boolean);
  for (const g of groups) walk(g);
  const L1 = h.grp && h.grp.userData && h.grp.userData.lod1;
  if (L1) { H.update('lod1:' + L1.length + ':' + L1.tris); for (const m of L1) obj(m); }
  if (h.built && h.built.stats) H.update('tris:' + h.built.stats.tris + ':lights:' + (h.lights || 0));
  const d = H.digest('hex').slice(0, 24);
  return parts ? { d, parts } : d;
}

// ---- one child: one page, one boot ------------------------------------------------------------------------------------
const GEN_OTHER = ['BIG_GEN', 'SHED_GEN', 'HANGAR_GEN', 'TOWER_GEN', 'TRAM_GEN', 'TOTEM_GEN', 'SPORT_GEN', 'MARINE_GEN'];
async function child(mode, idbDir, outFile) {
  const { openPage } = require('./_page_node.js');
  const q = [mode === 'local' ? 'housew=0' : '', process.env.HOUSEWORKER_QUERY || ''].filter(Boolean).join('&');
  const calls = {};   // step -> name -> n
  let step = 'garage:scripts';
  let WIN = null, PG = null;
  // each boot step's WALL time in this process, and the part of it the harness spent BLOCKED on the worker thread (the
  // shim's waits): wall - waited is the page thread's own (node, this box: not a browser's milliseconds)
  const wall = {}; let stepT0 = Date.now(), stepW0 = 0;
  const waitedNow = () => (PG && PG.workers ? PG.workers().reduce((a, w) => a + (w.waitedMs || 0), 0) : 0);
  const stepTo = k => { const t = Date.now(), w = waitedNow(), r = wall[step] || (wall[step] = { ms: 0, waited: 0 }); r.ms += t - stepT0; r.waited += w - stepW0; step = k; stepT0 = t; stepW0 = w; };
  // a call made while the page builds an entry itself (a HANGAR_GEN barrier, a miss: render_premises FLYDIY_HW_HERE) is kept apart
  const count = k => { if (WIN && WIN.FLYDIY_HW_HERE) k += '@here'; const s = calls[step] || (calls[step] = {}); s[k] = (s[k] || 0) + 1; };
  const wrap = (o, k, name) => { if (!o || typeof o[k] !== 'function' || o[k].__hw) return; const f = o[k]; o[k] = function () { count(name); return f.apply(this, arguments); }; o[k].__hw = true; };
  const tagF = (G, W) => { if (!G || typeof G.makeFinish !== 'function' || G.makeFinish.__hwF) return; const mk = G.makeFinish; G.makeFinish = function () { const F = mk.apply(this, arguments); if (F && F.MAT) for (const k of Object.keys(F.MAT)) { const m = F.MAT[k]; if (m && m.userData) m.userData.__hwF = F; } return F; }; G.makeFinish.__hwF = true; };
  const t0 = Date.now();
  const hooks = {
    afterScript(name, P) {
      const W = WIN = P.win;
      if (name === 'src/viewer/boot.js' && W.BOOT) {
        const run = W.BOOT.run, show = W.BOOT.show;
        const mark = (steps, set) => { for (const s of steps || []) { if (!s || s.__hw) continue; const fn = s.fn; s.__hw = true; s.fn = function () { stepTo(set + ':' + s.id); return typeof fn === 'function' ? fn.apply(this, arguments) : undefined; }; } };
        W.BOOT.run = function (steps, o) { mark(steps, (o && o.set) || 'boot'); return run.apply(this, arguments); };
        if (typeof show === 'function') W.BOOT.show = function (set, o) { if (o && o.steps) mark(o.steps, o.set || set); return show.apply(this, arguments); };
      }
      if (name === 'tools/_house_kit.js') wrap(W.HOUSE_KIT, 'bakeAO', 'HOUSE_KIT.bakeAO');
      if (name === 'tools/_house_gen.js' && W.HOUSE_GEN) { const HG = W.HOUSE_GEN, b = HG.build; HG.build = function (P, lod) { count('HOUSE_GEN.build' + (lod ? 1 : 0)); return b.apply(this, arguments); }; tagF(HG, W); }
      if (name === 'tools/_village_gen.js') for (const k of ['placeHouse', 'finishPlot', 'lotGround', 'buildFence']) wrap(W.VILLAGE_GEN, k, 'VILLAGE_GEN.' + k);
      for (const g of GEN_OTHER) if (W[g] && !W[g].__hwTag) { W[g].__hwTag = true; wrap(W[g], 'build', g + '.build'); tagF(W[g], W); }
    },
  };
  const P = await openPage({ quiet: true, hooks, query: q, workers: /house_worker\.js/, idb: idbDir || null, workerWaitMs: 900000 });
  const W = P.win; PG = P;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 1800000);
  stepTo('after');
  const R = W.WORLD && W.WORLD.premises;
  const out = { mode, query: q, wall: Date.now() - t0, entries: {}, calls, stepWall: wall, errors: P.errors.slice(0, 20), errorsN: P.errors.length };
  if (!R) { out.fail = 'no premises renderer'; fs.writeFileSync(outFile, JSON.stringify(out)); return; }
  const DET = !!process.env.HOUSEWORKER_DETAIL;
  for (const [id, h] of R.houses) out.entries[id] = { d: DET ? digestEntry(W, h, true).d : digestEntry(W, h), parts: DET ? digestEntry(W, h, true).parts : undefined, kind: h.plot && h.plot.isItem ? 'item' : h.plot && h.plot.isFence ? 'fence' : h.plot && h.plot.isObject ? 'object' : h.plot && h.plot.isPark ? 'park' : 'house', failed: !!h.failed };
  out.queued = R.stats.queued;
  out.thrown = P.errors.filter(e => /^(script |timer: |frame: |FLYDIY_BOOT)/.test(e)).slice(0, 10);
  // and the scene DRAWN after the loading: a few frames of the page's own loop in the shed (the world's buffers, the
  // worker's arrays among them, uploaded by then: the loading's warm draw) - a refused array would throw here
  await P.frames(3);
  out.thrown = P.errors.filter(e => /^(script |timer: |frame: |FLYDIY_BOOT)/.test(e)).slice(0, 10);
  out.hwLogs = P.logs.filter(l => /house worker/.test(l)).slice(0, 40);
  out.worker = W.HOUSE_WORKER && W.HOUSE_WORKER.stats ? W.HOUSE_WORKER.stats() : null;
  if (out.worker && R.hw) Object.assign(out.worker, { dispatched: R.hw.dispatched, placed: R.hw.placed, here: R.hw.local, prefetch: R.hw.prefetch, tallyMiss: R.hw.tallyMiss || 0 });
  out.threads = P.workers ? P.workers() : null;
  out.mem = process.memoryUsage().rss;
  fs.writeFileSync(outFile, JSON.stringify(out));
  if (P.close) P.close();
}

// ---- the parent: the children in sequence, the verdict ---------------------------------------------------------------
function main() {
  const only = (arg('--only') || 'local,cold,warm,partial').split(',');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'houseworker-'));
  const idb = path.join(tmp, 'idb');
  fs.mkdirSync(idb, { recursive: true });
  const res = {};
  let fails = 0;
  const ok = (c, msg) => { console.log((c ? '  ok   ' : '  FAIL ') + msg); if (!c) fails++; };
  console.log('GATE HOUSEWORKER');
  for (const mode of only) {
    if (mode === 'partial') {
      // every third cached entry deleted (the cache's own two stores: the result and its tallies' delta)
      const files = fs.existsSync(path.join(idb, 'r')) ? fs.readdirSync(path.join(idb, 'r')).sort() : [];
      let n = 0; files.forEach((f, i) => { if (i % 3 === 1) { fs.rmSync(path.join(idb, 'r', f), { force: true }); fs.rmSync(path.join(idb, 'd', f), { force: true }); n++; } });
      res.deleted = n;
    }
    const outFile = path.join(tmp, mode + '.json');
    const t = Date.now();
    const r = spawnSync(process.execPath, ['--max-old-space-size=8192', __filename, '--child', mode, '--idb', idb, '--out', outFile], { stdio: ['ignore', 'inherit', 'inherit'], env: process.env });
    if (r.status !== 0 || !fs.existsSync(outFile)) { ok(false, mode + ': the child failed (' + r.status + ')'); continue; }
    res[mode] = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    const c = res[mode];
    console.log('  ' + mode + ': ' + Object.keys(c.entries).length + ' entries, ' + ((Date.now() - t) / 1000).toFixed(0) + ' s' + (c.worker ? ', worker ' + JSON.stringify(c.worker) : '') + (c.errorsN ? ', page errors ' + c.errorsN : ''));
    if (c.errorsN) for (const e of c.errors.slice(0, 5)) console.log('     ' + String(e).slice(0, 300));
  }
  if (arg('--keep')) { fs.writeFileSync(arg('--keep'), JSON.stringify(res)); console.log('  (kept: ' + arg('--keep') + ')'); }
  verdict(res, ok);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('GATE HOUSEWORKER: ' + (fails ? 'FAIL (' + fails + ')' : 'PASS'));
  process.exit(fails ? 1 : 0);
}
const HOUSE_CALLS = ['HOUSE_GEN.build0', 'HOUSE_GEN.build1', 'VILLAGE_GEN.placeHouse', 'VILLAGE_GEN.finishPlot', 'VILLAGE_GEN.lotGround', 'VILLAGE_GEN.buildFence', 'HOUSE_KIT.bakeAO'];
function sumCalls(calls, re) { const t = {}; for (const [s, m] of Object.entries(calls || {})) if (!re || re.test(s)) for (const [k, v] of Object.entries(m)) t[k] = (t[k] || 0) + v; return t; }
function verdict(res, ok) {
  const L = res.local;
  const thrown = C => (C.thrown || []);
  for (const m of ['local', 'cold', 'warm', 'partial']) if (res[m]) ok(!thrown(res[m]).length, m + ': no script, timer or frame of the page threw' + (thrown(res[m]).length ? ' (' + thrown(res[m]).length + ': ' + String(thrown(res[m])[0]).slice(0, 160) + ')' : ''));
  if (L) {
    const t = sumCalls(L.calls, /:town$/);
    console.log('  local: the town step\'s generation on the page\'s thread ' + JSON.stringify(t));
    ok(Object.keys(L.entries).length > 100 && !L.fail, 'local: the premises built (' + Object.keys(L.entries).length + ' entries)');
  }
  for (const m of ['cold', 'warm', 'partial']) {
    const C = res[m];
    if (!C) continue;
    if (L) {
      const ids = Object.keys(L.entries).sort(), bad = ids.filter(id => !C.entries[id] || C.entries[id].d !== L.entries[id].d);
      const extra = Object.keys(C.entries).filter(id => !L.entries[id]);
      ok(!bad.length && !extra.length, m + ': every entry bit-identical to the page\'s own build (' + (ids.length - bad.length) + ' / ' + ids.length + (bad.length ? '; differ: ' + bad.slice(0, 8).join(', ') : '') + (extra.length ? '; extra: ' + extra.slice(0, 5).join(', ') : '') + ')');
    }
    const town = sumCalls(C.calls, /:town$/), all = sumCalls(C.calls);
    for (const k of ['garage:town', 'garage:settle']) if (C.stepWall && C.stepWall[k]) console.log('  ' + m + ': ' + k + ' ' + C.stepWall[k].ms + ' ms wall here, ' + C.stepWall[k].waited + ' ms of it waiting on the worker' + (L && L.stepWall && L.stepWall[k] ? ' (local: ' + L.stepWall[k].ms + ' ms)' : ''));
    const houseTown = HOUSE_CALLS.reduce((a, k) => a + (town[k] || 0), 0), houseAll = HOUSE_CALLS.reduce((a, k) => a + (all[k] || 0), 0);
    console.log('  ' + m + ': the page\'s generation calls - town step ' + JSON.stringify(town) + ', whole boot ' + JSON.stringify(all));
    ok(houseTown === 0, m + ': the town step makes no house generation call on the page\'s thread (' + houseTown + ')');
    const W = C.worker || {};
    ok(W.on === true, m + ': the house worker ran (' + (W.why || 'on') + ')');
    ok(W.moved > 0 && W.kept === 0, m + ': every array the worker sent was transferred, not copied (' + W.moved + ' buffers, ' + W.mb + ' MB; ' + W.kept + ' copied)');
    if (m === 'cold') ok(W.built > 0 && W.hits === 0, 'cold: the worker generated every entry (' + W.built + ' built, ' + W.hits + ' from the cache)');
    if (m === 'warm') ok(W.built === 0 && W.hits > 0, 'warm: a second visit builds nothing (' + W.built + ' built, ' + W.hits + ' from the cache)');
    if (m === 'partial') ok(W.built === res.deleted && W.hits > 0, 'partial: exactly the deleted entries generated (' + W.built + ' built of ' + res.deleted + ' deleted, ' + W.hits + ' from the cache)');
  }
}

if (require.main !== module) module.exports = { digestEntry, child, verdict };
else if (arg('--child')) child(arg('--child'), arg('--idb'), arg('--out')).then(() => process.exit(0), e => { console.error(e && e.stack || e); process.exit(2); });
else main();
