#!/usr/bin/env node
// GATE DMGCERTCOST (G1890-G1892, DMG-CERTCOST) - what the certificate (66_gen_cert.js genCertify) costs, that its cuts
// changed nothing it stamps, and that a build is certified once, ever. On the user's validated builds, node:
//   1. THE COST: the game's certificate (the settle shared, the controls' lead-in shared, a wheel landing's window
//      1.2 s - G1891), its node time and its FRAMES (every frame its sims stepped: C.ms.frames - the time is the
//      machine's, the frames are the certificate's) against the budget below; the target (~5 s a build in node, D2a's
//      level) and what is left are printed;
//   2. NOTHING STAMPED MOVED: its envelope (Ft, Fc: every member's tension and compression at limit - what the stamp
//      reads) against the UNCUT certificate (D2a / D2b's: every landing settling itself, every window its full 2 s):
//      the stored reference (tools/fixtures/dmg_certcost_ref.json) while it is still the physics' answer (its rules,
//      PHYSICS_V, the spec and a fingerprint of the physics - a drop's first second, hashed - all equal), else (or
//      with --full) the uncut certificate computed here again (the slow path). The worst relative deviation, which
//      must be under 1 % (DMG-CERTCOST's acceptance; what this delivery measured: 0, to the bit);
//   3. THE STORE (bench_worker.js certStoreGet / certStorePut; app.js certKick): a record's checks (a good one reads,
//      another key / version / member count / a non-finite value / a bad checksum is refused) and the round trip:
//      in headless Chromium when Playwright is here (the bench worker computes the Cub's certificate on page 1 and the
//      page keeps it; a SECOND PAGE LOAD reads it and stamps a sim in under 50 ms, equal to node's to the bit; a
//      corrupted record and a stale one are refused and deleted), else in node on an in-memory IndexedDB.
// Run: node tools/_dmg_certcost_check.js [--full] [--builds=cub,jodel] [--no-browser]
//      node tools/_dmg_certcost_check.js --write-ref       (the uncut reference, written - minutes)
// One final `GATE DMGCERTCOST: PASS|FAIL`; the builds in parallel children (DMGCERTCOST_JOBS, default 2).
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const argv = process.argv.slice(2);
const L = require('./_treecrash_lib.js');
const REF = path.join(__dirname, 'fixtures', 'dmg_certcost_ref.json');
const BW_PATH = path.join(__dirname, '..', 'src', 'viewer', 'bench_worker.js');

// THE BUDGET (G1892): the frames this delivery's certificate steps per build (exact: a rule change that adds a case or
// a window moves them, and says so here; D2b's uncut certificate stepped 2781 / 2764 / 2769 / 3023 / 3051), and a
// node-time ceiling - the cloud box, each build alone in its process, measured 8.1 / 16.1 / 14.3 / 21.1 / 24.1 s (D2b's:
// 13.5 / 25.1 / 22.0 / 38.8 / 43.5); the ceiling is about twice that, loose on purpose (the gate runs beside others):
// the frames catch a lost cut, the ceiling a gross slowdown, neither a noisy machine
const BUDGET = {
  cub:        { frames: 1809, s: 18 },
  jodel:      { frames: 1792, s: 32 },
  metal:      { frames: 1797, s: 30 },
  floats:     { frames: 1763, s: 42 },
  twinFloats: { frames: 1791, s: 48 },
};
const TARGET_S = 5;
const f64 = a => Buffer.from(new Float64Array(a).buffer).toString('base64');
const unf64 = s => { const b = Buffer.from(s, 'base64'); return new Float64Array(b.buffer, b.byteOffset, b.length / 8).slice(); };
function fnv(h, s) { for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; return h; }
// the rules the uncut certificate was made under: GEN_CERT without the windows G1891 added, its version before them
function rulesKey(C) { const G = Object.assign({}, C.GEN_CERT); delete G.win; return fnv(0x811c9dc5, JSON.stringify(G)).toString(16); }
// the physics' fingerprint: the drop's sim settled 60 frames, every node's position hashed
function fingerprint(C, def, world) {
  const sim = C.genCertDropSim(def, world);
  for (let f = 0; f < 60; f++) sim.step(1 / 60);
  return fnv(0x811c9dc5, Array.from(sim.p, x => x.toPrecision(15)).join(',')).toString(16);
}
function worstDev(a, b) {   // [worst |a - b| / b over b > 0 (a != b where b is 0: Infinity), index]
  let w = 0, wi = -1;
  for (let i = 0; i < b.length; i++) {
    if (a[i] === b[i]) continue;
    const d = b[i] > 0 ? Math.abs(a[i] - b[i]) / b[i] : Infinity;
    if (d > w) { w = d; wi = i; }
  }
  return [w, wi];
}

// ---- one build (a child) ---------------------------------------------------------------------------------------------
if (argv[0] === '--build') {
  const key = argv[1], C = L.core(), def = L.defOf(key);
  const world = def.parts && def.parts.floats ? C.makeWorld() : null;
  const t0 = Date.now();
  const K = C.genCertify(def, { world });
  const ms = Date.now() - t0;
  const out = { key, ms, frames: K.ms.frames, cases: K.ms.cases, static: K.ms.flight, nb: K.nb };
  const tag = { rules: rulesKey(C), cv: C.GEN_CERT_V, phys: C.PHYSICS_V, spec: fnv(0x811c9dc5, JSON.stringify(def.spec || null)).toString(16), fp: fingerprint(C, def, world) };
  let ref = null, how;
  const R = fs.existsSync(REF) ? JSON.parse(fs.readFileSync(REF, 'utf8')) : {};
  const r = R[key];
  if (!argv.includes('--full') && !argv.includes('--write-ref') && r && r.rules === tag.rules && r.cv === tag.cv && r.phys === tag.phys && r.spec === tag.spec && r.fp === tag.fp) {
    ref = { Ft: unf64(r.Ft), Fc: unf64(r.Fc), frames: r.frames, ms: r.ms }; how = 'stored';
  } else {
    const t1 = Date.now();
    const U = C.genCertify(def, { world, share: false, full: true });
    ref = { Ft: U.Ft, Fc: U.Fc, frames: U.ms.frames, ms: Date.now() - t1 };
    how = r ? 'computed (the stored reference is not this physics: ' + ['rules', 'cv', 'phys', 'spec', 'fp'].filter(k => r[k] !== tag[k]).join(', ') + ')' : 'computed';
    if (argv.includes('--write-ref')) out.write = Object.assign({}, tag, { Ft: f64(U.Ft), Fc: f64(U.Fc), frames: U.ms.frames, ms: ref.ms, when: new Date().toISOString() });
  }
  const dT = worstDev(K.Ft, ref.Ft), dC = worstDev(K.Fc, ref.Fc);
  const nm = i => i >= 0 ? def.nodes[def.beams[i].a].tag + '-' + def.nodes[def.beams[i].b].tag : null;
  Object.assign(out, { refHow: how, refFrames: ref.frames, refMs: ref.ms, devT: dT[0], devTAt: nm(dT[1]), devC: dC[0], devCAt: nm(dC[1]),
    bitEqual: dT[0] === 0 && dC[0] === 0, sum: require(BW_PATH).certSum(K.Ft, K.Fc) });
  process.stdout.write('@@' + JSON.stringify(out) + '\n');
  process.exit(0);
}

// ---- the store, in node (an in-memory IndexedDB) ----------------------------------------------------------------------
function fakeIdb() {
  const stores = new Map(), later = f => setImmediate(f);
  const Tx = name => {
    const st = stores.get(name), tx = { oncomplete: null, onerror: null, onabort: null, n: 0 };
    const done = () => { if (--tx.n === 0) later(() => tx.oncomplete && tx.oncomplete()); };
    const req = fn => { const q = { result: undefined }; tx.n++; later(() => { q.result = fn(); done(); }); return q; };
    tx.objectStore = () => ({ get: k => req(() => st.has(k) ? structuredClone(st.get(k)) : undefined),
      put: (v, k) => { const c = structuredClone(v); return req(() => { st.set(k, c); return k; }); },
      delete: k => req(() => { st.delete(k); }), getAll: () => req(() => [...st.values()].map(v => structuredClone(v))) });
    return tx;
  };
  const db = { objectStoreNames: { contains: n => stores.has(n) }, createObjectStore: n => { stores.set(n, new Map()); }, transaction: n => Tx(n) };
  return { open: () => { const q = { result: db }; later(() => { if (q.onupgradeneeded) q.onupgradeneeded(); if (q.onsuccess) q.onsuccess(); }); return q; }, stores };
}
async function storeNode(C, cert, def) {
  const rows = [];
  const fresh = () => { delete require.cache[require.resolve(BW_PATH)]; return require(BW_PATH); };   // a new page: a new module, the same IndexedDB
  global.self = { indexedDB: fakeIdb() };
  const ver = { cert: C.GEN_CERT_V, phys: C.PHYSICS_V }, key = C.genCertKey(def), nb = def.beams.length;
  try {
    let B = fresh();
    rows.push(['a miss reads null', (await B.certStoreGet(key, nb, ver)) === null]);
    rows.push(['kept', (await B.certStorePut(key, cert, ver)) === true]);
    B = fresh();
    const t0 = performance.now(), got = await B.certStoreGet(key, nb, ver);
    const sim = C.makeSim(Object.assign({}, def, { cert: null, params: Object.assign({}, def.params, { damage: true }) }), null);
    const ok = !!got && sim.certStamp(got), dt = performance.now() - t0;
    rows.push(['the second page load stamps from the store in ' + dt.toFixed(1) + ' ms (< 50), the envelope to the bit', ok && dt < 50 && B.certSum(got.Ft, got.Fc) === B.certSum(cert.Ft, cert.Fc)]);
    const st = global.self.indexedDB.stores.get(B.CERT_DB.store), rec = st.get(key);
    const bad = (why, f) => { const r = structuredClone(rec); f(r); return [why, B.certStoreBad(r, key, nb, ver) !== null]; };
    rows.push(bad('a flipped value refused (checksum)', r => { r.Ft[3] *= 1.5; }));
    rows.push(bad('another version refused', r => { r.v = ver.cert - 1; }));
    rows.push(bad('another physics refused', r => { r.phys = 'x' + ver.phys; }));
    rows.push(bad('another member count refused', r => { r.nb = nb + 1; }));
    rows.push(bad('a NaN refused', r => { r.Fc[0] = NaN; r.sum = B.certSum(r.Ft, r.Fc); }));
    rows.push(bad('another key refused', r => { r.key = 'x'; }));
    rows.push(['the good record passes', B.certStoreBad(rec, key, nb, ver) === null]);
    const c2 = structuredClone(rec); c2.Ft[0] = c2.Ft[0] * 2 + 1; st.set(key, c2);
    rows.push(['a corrupt record reads null and is deleted', (await B.certStoreGet(key, nb, ver)) === null && !st.has(key)]);
  } finally { delete global.self; }
  return rows;
}

// ---- the store, in Chromium (the real IndexedDB, the real bench worker) ------------------------------------------------
async function storeBrowser(C, cert, spec) {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (e) {
    try { ({ chromium } = require(path.join(cp.execSync('npm root -g').toString().trim(), 'playwright'))); } catch (e2) { return null; }
  }
  const http = require('http'), ROOT = path.join(__dirname, '..');
  const PAGE = '<!doctype html><meta charset="utf-8"><title>cert store</title><script src="tools/flight_core.js"></script><script src="src/viewer/bench_worker.js"></script>';
  const srv = http.createServer((q, r) => {
    const u = decodeURIComponent(q.url.split('?')[0]);
    if (u === '/__certstore.html') { r.writeHead(200, { 'content-type': 'text/html' }); r.end(PAGE); return; }
    const f = path.join(ROOT, u);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise(res => srv.listen(0, res));
  const url = 'http://localhost:' + srv.address().port + '/__certstore.html';
  let br;
  try { br = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}); } catch (e) { srv.close(); return null; }
  const rows = [];
  try {
    const ctx = await br.newContext(), pg = await ctx.newPage();
    pg.on('pageerror', e => rows.push(['the page threw: ' + e.message, false]));
    await pg.goto(url);
    // page 1: empty store, the worker computes, the page keeps it
    const p1 = await pg.evaluate(spec => new Promise(res => {
      const d = indexedDB.deleteDatabase('flydiy.cert');
      d.onsuccess = d.onerror = d.onblocked = async () => {
        const def = buildGen(spec), key = genCertKey(def), ver = { cert: GEN_CERT_V, phys: PHYSICS_V }, W = window.BENCH_WORKER;
        const miss = (await W.certGet(key, def.beams.length, ver)) === null;
        const t0 = performance.now();
        const w = W.start(async m => {
          if (!m || m.kind !== 'cert' && !m.error) return; w.kill();
          if (m.error) { res({ error: m.error }); return; }
          const kept = await W.certPut(key, m, ver);
          res({ miss, kept, ms: performance.now() - t0, sum: W.certSum(m.Ft, m.Fc), key, Ft: Array.from(m.Ft), Fc: Array.from(m.Fc) });
        }, why => res({ error: why }));
        w.post({ kind: 'cert', spec, seq: 1 });
      };
    }), spec);
    if (p1.error) { rows.push(['page 1: ' + p1.error, false]); return rows; }
    rows.push(['page 1: a miss, the worker computed it in ' + (p1.ms / 1000).toFixed(1) + ' s and the page kept it', p1.miss && p1.kept]);
    // (the browser's V8 is not node's: its Math rounds a few members' last bits apart - 2.1e-8 at most on the Cub,
    // the same on DMG-D2b's code; within 1e-6 is the same certificate)
    const dw = Math.max(worstDev(p1.Ft, cert.Ft)[0], worstDev(p1.Fc, cert.Fc)[0]);
    rows.push([`the worker's certificate is node's (the same key; worst relative difference ${dw.toExponential(1)}, < 1e-6: the two V8s' last bits)`,
      dw < 1e-6 && p1.key === C.genCertKey(C.buildGen(spec))]);
    // page 2: a new page load reads it and stamps
    await pg.reload();
    const p2 = await pg.evaluate(async spec => {
      const def = buildGen(spec), key = genCertKey(def), ver = { cert: GEN_CERT_V, phys: PHYSICS_V }, W = window.BENCH_WORKER;
      const sim = makeSim(Object.assign({}, def, { params: Object.assign({}, def.params, { damage: true }) }), null);
      const t0 = performance.now();
      const C = await W.certGet(key, def.beams.length, ver);
      const ok = !!C && sim.certStamp(C), ms = performance.now() - t0;
      const out = { ok, ms, sum: C ? W.certSum(C.Ft, C.Fc) : null };
      // a corrupted record (a value changed, the checksum kept), then a stale one (another version): refused, deleted
      const raw = (mode, fn) => new Promise(r => { const q = indexedDB.open('flydiy.cert', 1); q.onsuccess = () => { const tx = q.result.transaction('cert', mode); const rq = fn(tx.objectStore('cert')); tx.oncomplete = () => { r(rq && rq.result); q.result.close(); }; }; });
      const rec = await raw('readonly', st => st.get(key));
      const bad = Object.assign({}, rec, { Ft: rec.Ft.slice() }); bad.Ft[5] = bad.Ft[5] * 1.25 + 1;
      await raw('readwrite', st => st.put(bad, key));
      out.corrupt = (await W.certGet(key, def.beams.length, ver)) === null && (await raw('readonly', st => st.get(key))) === undefined;
      const old = Object.assign({}, rec, { v: ver.cert - 1 });
      await raw('readwrite', st => st.put(old, key));
      out.stale = (await W.certGet(key, def.beams.length, ver)) === null && (await raw('readonly', st => st.get(key))) === undefined;
      return out;
    }, spec);
    rows.push(['page 2: read from the store and stamped in ' + p2.ms.toFixed(1) + ' ms (< 50), the same envelope', p2.ok && p2.ms < 50 && p2.sum === p1.sum]);
    rows.push(['a corrupted record is refused and deleted', p2.corrupt]);
    rows.push(['a stale record (another GEN_CERT_V) is refused and deleted', p2.stale]);
  } finally { await br.close(); srv.close(); }
  return rows;
}

// ---- the parent ----------------------------------------------------------------------------------------------------
const KEYS = ((argv.find(a => a.startsWith('--builds=')) || '').slice(9) || Object.keys(L.BUILDS).join(',')).split(',');
const JOBS = +(process.env.DMGCERTCOST_JOBS || 2);
const pass = [];
const check = (ok, line) => { pass.push(!!ok); console.log((ok ? '  ok   ' : '  FAIL ') + line); };
function child(k) {
  return new Promise(res => {
    const ch = cp.spawn(process.execPath, [__filename, '--build', k].concat(argv.filter(a => a === '--full' || a === '--write-ref')), { stdio: ['ignore', 'pipe', 'inherit'] });
    let o = ''; ch.stdout.on('data', d => { o += d; });
    ch.on('exit', code => { const m = /^@@(.*)$/m.exec(o); res(code === 0 && m ? JSON.parse(m[1]) : { key: k, error: 'exit ' + code + '\n' + o }); });
  });
}
(async () => {
  console.log('GATE DMGCERTCOST (G1890-G1892): the certificate\'s cost, its envelope against the uncut one, the store');
  const res = {}, q = KEYS.slice();
  await Promise.all(Array.from({ length: JOBS }, async () => { for (let k; (k = q.shift());) res[k] = await child(k); }));
  const write = {};
  for (const k of KEYS) {
    const r = res[k], B = BUDGET[k];
    console.log(`${L.BUILDS[k].label}:`);
    if (r.error) { check(false, 'the child failed: ' + r.error); continue; }
    const cs = Object.entries(r.cases).map(([a, b]) => a + ' ' + (b / 1000).toFixed(1)).join(', ');
    check(r.frames <= B.frames, `1. ${r.frames} frames stepped (budget ${B.frames}; the uncut certificate ${r.refFrames})`);
    check(r.ms <= B.s * 1000, `1. ${(r.ms / 1000).toFixed(1)} s in node (ceiling ${B.s} s; the uncut ${(r.refMs / 1000).toFixed(1)} s; the target ~${TARGET_S} s: ` +
      (r.ms <= TARGET_S * 1000 ? 'reached' : `${((r.ms - TARGET_S * 1000) / 1000).toFixed(1)} s over`) + `) - static ${(r.static / 1000).toFixed(1)}, ${cs}`);
    check(r.devT < 0.01 && r.devC < 0.01, `2. the envelope against the uncut (${r.refHow}): ` + (r.bitEqual ? 'equal to the bit' :
      `tension ${(100 * r.devT).toFixed(4)} % (${r.devTAt}), compression ${(100 * r.devC).toFixed(4)} % (${r.devCAt})`));
    if (r.write) write[k] = r.write;
  }
  if (argv.includes('--write-ref')) {
    const R = fs.existsSync(REF) ? JSON.parse(fs.readFileSync(REF, 'utf8')) : {};
    Object.assign(R, write); fs.writeFileSync(REF, JSON.stringify(R, null, 1) + '\n');
    console.log('REPORT: the uncut reference written for ' + Object.keys(write).join(', ') + ' (' + REF + ')');
  }
  // 3. the store
  const C = L.core(), def = L.defOf('cub');
  const cert = C.genCertify(def, {});
  console.log('3. the store (node, an in-memory IndexedDB):');
  for (const [line, ok] of await storeNode(C, cert, def)) check(ok, line);
  if (!argv.includes('--no-browser')) {
    let j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', L.BUILDS.cub.build), 'utf8'));
    const spec = C.genMigrateSpec ? C.genMigrateSpec(j.spec || j) : (j.spec || j);
    const rows = await storeBrowser(C, cert, spec);
    if (!rows) console.log('3. REPORT: no Playwright / Chromium here - the round trip in a browser not run (a cloud session runs it)');
    else { console.log('3. the store (headless Chromium, the bench worker):'); for (const [line, ok] of rows) check(ok, line); }
  }
  const ok = pass.every(Boolean);
  console.log(`GATE DMGCERTCOST: ${ok ? 'PASS' : 'FAIL'}`);
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); console.log('GATE DMGCERTCOST: FAIL'); process.exit(1); });
