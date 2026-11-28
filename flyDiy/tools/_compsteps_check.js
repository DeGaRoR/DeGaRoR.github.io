#!/usr/bin/env node
// _compsteps_check.js - GATE COMPSTEPS (PERF-WORLDBUILD, 22 Nov 2026): THE PREMISES COMPOSED IN STEPS ARE THE PREMISES
// COMPOSED IN ONE TASK.
//
// The game's second composition (the renderer's: the record with the stations' builder and the tree pool) was one task of
// 2.6-2.9 s on the page's thread. With ?compsteps=1 the world build runs it a step a call (27_premises.js composeSteps,
// 20_world.js premises.setSteps, render_premises.js composeSteps) and hands the overlay to RENDER_PREMISES.make. Two page
// processes in node (tools/_page_node.js, the house worker on a thread), each booted through the ONE LOADING to the garage
// with the geometry's arrays kept:
//   inline   the default: make() composes
//   steps    ?compsteps=1
// CHECKS: the steps child composed in steps (FLYDIY_COMPSTEPS.used) and the inline child did not; the overlay's RECORDS
// (plots, items, trees, parks, links, issues, excludes), its aerodromes and its runways hash the same; the world's
// aerodrome list is the same; every family the world step builds from it (the patch, the strips, the roads, the paved
// polygons, the rails, the poles, the far terrain) has the same meshes, vertices, triangles and DIGEST; and WHILE the
// steps ran the standing premises stayed in force (the overlay of before, its aerodromes in the world's list) until the
// swap. REPORT (never ratcheted, node ms): the inline child's one task; the steps' count, sum, longest and every step over
// 20 ms by label - what is left to cut.
//   node tools/_compsteps_check.js                      the two children, the verdict (~4 min)
//   node tools/_compsteps_check.js --child inline|steps <out.json>
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const argv = process.argv.slice(2);
const now = () => Number(process.hrtime.bigint()) / 1e6;
const sha = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
// the composition's own labels (27_premises.js composeSteps, 20_world.js setPremisesSteps)
const OURS = /^premises: (the runways|the roads|the shelves|the overlay|the placement|a site|the links|the built links|a station|plots|the parks|the wood|a wood|the records|the swap)$/;
const AFTER = 'premises: the renderer';   // (render_world.js: yielded after the swap - make()'s own body runs under it)

async function child(side, out) {
  const { openPage } = require('./_page_node.js');
  const STEPS = [], HELD = { looks: 0, bad: [] }, SKYL = new Set(), UP = [];
  let built = false;   // (the build's own uploads only: what a host hands the GPU after the generator has ended is not the build's)
  let world = null, O0 = null, inlineMs = null;
  const hooks = { afterScript(n, P) { const W = P.win;
    if (typeof W.GPU_ONLY_GEO === 'function' && !W.GPU_ONLY_GEO.__keep) { W.GPU_ONLY_GEO = function () {}; W.GPU_ONLY_GEO.__keep = true; }   // the arrays kept for the digest
    // (COMPSTEPS_BUDGET=<ms>: the steps side under a host's budget that always answers that - 0 = "yield now" at every
    //  guard of the build: the most yields a host can ever ask for, the records and the families still the default's)
    if (side === 'steps' && process.env.COMPSTEPS_BUDGET !== undefined && !W.FLYDIY_WORLD_BUDGET) { const ms = +process.env.COMPSTEPS_BUDGET; W.FLYDIY_WORLD_BUDGET = { left: () => ms }; }
    const orig = W.buildWorldSceneSteps; if (typeof orig !== 'function' || orig.__cs) return;
    const wrapped = function () {
      // the build's big data textures as they go up (renderer.initTexture: the island ground's - the albedo, the tint, the
      // fields, the types with their one-code flags; the bytes are dropped at the upload, so they are hashed on the way)
      { const rdr = arguments[2]; if (rdr && typeof rdr.initTexture === 'function' && !rdr.__cs) { const it = rdr.initTexture.bind(rdr); rdr.__cs = true;
          rdr.initTexture = t => { const d = t && t.image && t.image.data; if (!built && d && d.buffer && d.length >= 1e6) UP.push(t.image.width + 'x' + t.image.height + ' ' + d.length + ' ' + crypto.createHash('sha256').update(Buffer.from(d.buffer, d.byteOffset, d.byteLength)).digest('hex').slice(0, 16)); return it(t); }; } }
      const g = orig.apply(this, arguments); world = arguments[1]; let label = 'setup';
      return { next(v) { const t = now(), r = g.next(v), d = now() - t; if (r.done) built = true;
          // the work just done was opened by `label`: the composition's steps by their own labels, the inline child's one task by 'premises'
          if (OURS.test(String(label))) STEPS.push([String(label).slice(10), +d.toFixed(2)]);
          else if (label === AFTER) STEPS.push(['the renderer (make)', +d.toFixed(2)]);
          else if (label === 'premises' || label === 'premises: the generators') { if (inlineMs === null || d > inlineMs) inlineMs = +d.toFixed(1); }
          if (!r.done && r.value !== undefined) label = r.value;
          if (!r.done && /^(sky|ground|island ground|far terrain|water|roads|houses|ring|trees): /.test(String(r.value))) SKYL.add(String(r.value));   // (the labels only a host's budget asks for)
          // between two of the composition's steps: the premises of BEFORE stand, whole
          if (!r.done && OURS.test(String(r.value)) && world && world.premises) {
            const ov = world.premises.overlay; if (!O0) O0 = ov; HELD.looks++;
            if (!ov) HELD.bad.push('no overlay at "' + r.value + '"');
            else if (ov !== O0) HELD.bad.push('another overlay at "' + r.value + '"');
            else if (!world.aerodromes.some(a => a.premises)) HELD.bad.push('no premises aerodrome in the list at "' + r.value + '"');
          }
          return r; },
        return(v) { return g.return ? g.return(v) : { done: true, value: v }; }, throw(e) { return g.throw(e); }, [Symbol.iterator]() { return this; } }; };
    wrapped.__cs = true; W.buildWorldSceneSteps = wrapped; } };
  const P = await openPage({ quiet: true, hooks, query: side === 'steps' ? 'compsteps=1' + (process.env.COMPSTEPS_QUERY ? '&' + process.env.COMPSTEPS_QUERY : '') : '', workers: /house_worker\.js/, idb: fs.mkdtempSync(path.join(os.tmpdir(), 'cs-idb-')), workerWaitMs: 900000 });
  const W = P.win;
  await P.until(() => W.BOOT && W.BOOT.state === 'gone', 3600000);
  // ---- the families' digests (as GATE PATCHWORKER)
  const census = {}, seen = new Set();
  const fam = o => { const n = o.name || ''; if (o.userData && o.userData.farTerrain) return 'far terrain'; const m = /^(premises:patch|pavement|road|pave|rail|poles|townkit|town:far)/.exec(n); return m ? m[1] : null; };   // (townkit, town:far: the town's batch and its far cells - the host in steps)
  W.WORLD.scene.traverse(o => { if (!(o.isMesh || o.isLine || o.isPoints) || !o.geometry || seen.has(o.geometry)) return; const f = fam(o); if (!f) return; seen.add(o.geometry);
    const g = o.geometry, e = census[f] || (census[f] = { meshes: 0, verts: 0, tris: 0, parts: [] }); e.meshes++;
    const h = crypto.createHash('sha256'); h.update(o.name || '');
    for (const k of Object.keys(g.attributes).sort()) { const a = g.attributes[k].array; if (!a || !a.buffer) { h.update(k + ':freed'); continue; } h.update(k); h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); }
    const pa = g.attributes.position; if (pa) { e.verts += pa.count; e.tris += g.index ? g.index.count / 3 : pa.count / 3; }
    if (g.index && g.index.array) { const a = g.index.array; h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); }
    e.parts.push(h.digest('hex').slice(0, 16)); });
  for (const k of Object.keys(census)) { const e = census[k]; e.digest = sha(e.parts.sort().join(',')); delete e.parts; e.tris = Math.round(e.tris); }
  // ---- the overlay's records and the world's aerodromes
  const w = W.FLIGHT_PROBE.world(), O = w.premises && w.premises.overlay, rec = {};
  const plain = v => JSON.stringify(v, (k, x) => (typeof x === 'function' ? undefined : (x && x.buffer instanceof ArrayBuffer) ? Array.from(x) : x));
  if (O) {
    for (const k of Object.keys(O.records || {}).sort()) { let s; try { s = plain(O.records[k]); } catch (e) { s = 'unserialisable: ' + (e && e.message); } rec['records.' + k] = { n: Array.isArray(O.records[k]) ? O.records[k].length : null, sha: sha(String(s)) }; }
    for (const k of ['aerodromes', 'runways']) { let s; try { s = plain(O[k]); } catch (e) { s = 'unserialisable: ' + (e && e.message); } rec[k] = { n: Array.isArray(O[k]) ? O[k].length : null, sha: sha(String(s)) }; }
  }
  // (the records themselves beside the result: the parent names the first paths that differ)
  { const full = {}; if (O) { for (const k of Object.keys(O.records || {})) { try { full['records.' + k] = JSON.parse(plain(O.records[k])); } catch (e) { full['records.' + k] = null; } }
      for (const k of ['aerodromes', 'runways']) { try { full[k] = JSON.parse(plain(O[k])); } catch (e) { full[k] = null; } } }
    fs.writeFileSync(out.replace(/\.json$/, '.rec.json'), JSON.stringify(full)); }
  const aero = w.aerodromes.map(a => [a.id, a.kind || '', !!a.premises, +a.x, +a.z, +a.len, +a.wid, +a.hdg]);
  fs.writeFileSync(out, JSON.stringify({ side, build: W.FLYDIY_BUILD, labels: [...SKYL], sw: (() => { const g = o => (o ? { on: !!o.on, asked: o.asked | 0, used: o.used | 0, near: !!o.near } : null); return { stripw: g(W.FLYDIY_STRIPW), patchw: g(W.FLYDIY_PATCHW), roadw: g(W.FLYDIY_ROADW) }; })(), flag: W.FLYDIY_COMPSTEPS || null, census, uploads: UP, rec, aero: { n: aero.length, sha: sha(JSON.stringify(aero)) },
    zoneMemo: O && O.zoneMemo || null, swapped: !!(O0 && O && O !== O0), held: HELD, steps: STEPS, inlineMs,
    warns: P.errors.concat(P.logs || []).filter(e => /compsteps|premises: the swap|world build:/i.test(String(e))) }));
  process.exit(0);
}

(async () => {
  if (argv.includes('--child')) return child(argv[argv.indexOf('--child') + 1], argv[argv.indexOf('--child') + 2]);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'compsteps-')), R = {}, bad = [];
  for (const side of ['inline', 'steps']) {
    const f = path.join(dir, side + '.json');
    const r = spawnSync(process.execPath, ['--max-old-space-size=6144', __filename, '--child', side, f], { stdio: ['ignore', 'inherit', 'pipe'], maxBuffer: 1 << 28 });
    if (r.status || !fs.existsSync(f)) { console.log('  FAIL the ' + side + ' child: exit ' + r.status + ' ' + String(r.stderr).slice(-1200)); console.log('GATE COMPSTEPS: FAIL'); process.exit(1); }
    R[side] = JSON.parse(fs.readFileSync(f, 'utf8'));
  }
  const A = R.inline, B = R.steps;
  console.log('GATE COMPSTEPS - build ' + B.build + '; inline ' + JSON.stringify(A.flag) + ', steps ' + JSON.stringify(B.flag) + (process.env.COMPSTEPS_QUERY ? ' - THE STEPS SIDE ALSO WITH ' + process.env.COMPSTEPS_QUERY + ' (COMPSTEPS_QUERY: a set of switches against the default world)' : '')
    + (process.env.COMPSTEPS_BUDGET !== undefined ? ' - UNDER A HOST BUDGET THAT ALWAYS ANSWERS ' + process.env.COMPSTEPS_BUDGET + ' ms (COMPSTEPS_BUDGET; the labels seen: ' + [...new Set(B.labels || [])].join(', ') + ')' : ''));
  // ---- 0. the workers' switches (23 Nov: on by default under a host's budget, off without a host - render_world wbSwitch)
  { const f = S => ['stripw', 'patchw', 'roadw'].map(k => k + ' ' + (S && S[k] ? (S[k].on ? 'on ' + S[k].used + '/' + S[k].asked : 'off') : '-')).join(', ');
    console.log('0. the workers\' switches: inline ' + f(A.sw) + ' | steps ' + f(B.sw) + (B.sw && B.sw.stripw && B.sw.stripw.near ? ' (near first)' : ''));
    for (const k of ['stripw', 'patchw', 'roadw']) if (A.sw && A.sw[k] && A.sw[k].on) bad.push('the inline child (no host, no switch) has ' + k + ' on: a page without a host must keep it off');
    if (process.env.COMPSTEPS_BUDGET !== undefined && !process.env.COMPSTEPS_QUERY) {
      for (const k of ['stripw', 'patchw', 'roadw']) if (!(B.sw && B.sw[k] && B.sw[k].on && B.sw[k].used > 0)) bad.push('under a host\'s budget ' + k + ' is not on and used by default (' + JSON.stringify(B.sw && B.sw[k]) + ')');
      if (B.sw && B.sw.stripw && B.sw.stripw.near) bad.push('near first is on by default under a host\'s budget: it has a visible state and stays a switch'); } }
  // ---- 1. who composed how
  if (!(A.flag && A.flag.on === false && A.flag.used === false)) bad.push('the inline child composed in steps (' + JSON.stringify(A.flag) + ')');
  if (!(B.flag && B.flag.on === true && B.flag.used === true)) bad.push('the steps child did not compose in steps (' + JSON.stringify(B.flag) + ')');
  if (A.steps.length) bad.push('the inline child ran ' + A.steps.length + ' of the composition\'s steps');
  if (!(B.steps.length >= 12)) bad.push('the steps child ran only ' + B.steps.length + ' steps of the composition');
  // ---- 2. the standing premises in force until the swap
  console.log('1. the standing premises while the steps ran: looked at ' + B.held.looks + ' yields, ' + B.held.bad.length + ' without them' + (B.swapped ? '; swapped at the end' : ''));
  if (!(B.held.looks >= 12)) bad.push('the gate never looked at the world between two steps');
  for (const b of B.held.bad.slice(0, 4)) bad.push('the standing premises were not in force: ' + b);
  if (!B.swapped) bad.push('the stepped composition\'s overlay was never swapped in');
  // ---- 3. the overlay: its records, aerodromes, runways; the world's aerodromes
  const keys = [...new Set([...Object.keys(A.rec), ...Object.keys(B.rec)])].sort();
  const diff = keys.filter(k => !A.rec[k] || !B.rec[k] || A.rec[k].sha !== B.rec[k].sha || A.rec[k].n !== B.rec[k].n);
  console.log('2. the overlay: ' + keys.map(k => k.replace(/^records\./, '') + ' ' + (B.rec[k] ? B.rec[k].n : '-')).join(', ') + ' - ' + (keys.length - diff.length) + ' of ' + keys.length + ' hash the same' + (diff.length ? '; DIFFER: ' + diff.join(', ') : ''));
  if (!keys.length) bad.push('no overlay records were read: the gate compared nothing');
  // the first paths that differ, by walking the two records (a number's two values, a missing key, a length)
  const where = (a, b, p, out) => { if (out.length >= 6) return;
    if (a === b) return;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') { out.push(p + ': ' + JSON.stringify(a === undefined ? '(none)' : a).slice(0, 60) + ' / ' + JSON.stringify(b === undefined ? '(none)' : b).slice(0, 60)); return; }
    if (Array.isArray(a) !== Array.isArray(b)) { out.push(p + ': an array / an object'); return; }
    if (Array.isArray(a) && a.length !== b.length) { out.push(p + ': length ' + a.length + ' / ' + b.length); }
    for (const k of (Array.isArray(a) ? Array.from({ length: Math.min(a.length, b.length) }, (x, i) => i) : [...new Set([...Object.keys(a), ...Object.keys(b)])])) where(a[k], b[k], p + (Array.isArray(a) ? '[' + k + ']' : '.' + k), out); };
  let FA = null, FB = null; if (diff.length) { try { FA = JSON.parse(fs.readFileSync(path.join(dir, 'inline.rec.json'), 'utf8')); FB = JSON.parse(fs.readFileSync(path.join(dir, 'steps.rec.json'), 'utf8')); } catch (e) { FA = FB = null; } }
  for (const k of diff) { const w = []; if (FA && FB) where(FA[k], FB[k], k, w);
    bad.push('the overlay\'s ' + k + ' differ (' + JSON.stringify(A.rec[k]) + ' / ' + JSON.stringify(B.rec[k]) + ')' + (w.length ? ' - first: ' + w.join(' | ') : '')); }
  if (!(A.aero.sha === B.aero.sha && A.aero.n === B.aero.n)) bad.push('the world\'s aerodromes differ (' + A.aero.n + ' ' + A.aero.sha + ' / ' + B.aero.n + ' ' + B.aero.sha + ')');
  console.log('   the world\'s aerodromes: ' + A.aero.n + ' / ' + B.aero.n + ', ' + (A.aero.sha === B.aero.sha ? 'the same' : 'DIFFER') + '; the zones\' memo: inline ' + JSON.stringify(A.zoneMemo) + ', steps ' + JSON.stringify(B.zoneMemo));
  // ---- 4. what the world step built from it
  console.log('3. family           meshes    vertices   triangles   digest inline      digest steps');
  for (const k of [...new Set([...Object.keys(A.census), ...Object.keys(B.census)])].sort()) {
    const a = A.census[k] || {}, b = B.census[k] || {}, same = a.digest === b.digest && a.meshes === b.meshes && a.verts === b.verts && a.tris === b.tris;
    console.log('   ' + k.padEnd(16) + String(b.meshes).padStart(7) + String(b.verts).padStart(12) + String(b.tris).padStart(12) + '   ' + a.digest + '   ' + b.digest + (same ? '' : '   DIFFER'));
    if (!same) bad.push(k + ': the two builds differ (' + a.meshes + ' / ' + b.meshes + ' meshes, ' + a.verts + ' / ' + b.verts + ' vertices, ' + a.digest + ' / ' + b.digest + ')');
  }
  // the build's big texture uploads (the island ground's): the same textures, the same bytes
  { const UA = (A.uploads || []).slice().sort(), UB = (B.uploads || []).slice().sort();
    console.log('   the build\'s big texture uploads: ' + UA.length + ' / ' + UB.length + (UA.join('|') === UB.join('|') ? ', the same bytes' : ', DIFFER') + ' (' + UB.join(', ') + ')');
    if (!(UB.length >= 3)) bad.push('only ' + UB.length + ' big texture uploads were seen (the island ground\'s tint, fields and types): the gate compared nothing');
    else if (UA.join('|') !== UB.join('|')) bad.push('the build\'s texture uploads differ (' + UA.join(', ') + ' / ' + UB.join(', ') + ')'); }
  for (const k of ['premises:patch', 'pavement', 'road', 'pave']) if (!B.census[k] || !(B.census[k].verts > 0)) bad.push('no ' + k + ' geometry was built: the gate compared nothing');
  if (B.warns && B.warns.length) bad.push('the page warned: ' + B.warns.slice(0, 3).join(' | '));
  // ---- the report: the one task against the steps (node ms, never ratcheted)
  const sum = B.steps.reduce((a, s) => a + s[1], 0), worst = B.steps.reduce((a, s) => (s[1] > a[1] ? s : a), ['-', 0]);
  const by = {}; for (const [l, ms] of B.steps) { const e = by[l] || (by[l] = { n: 0, ms: 0, max: 0 }); e.n++; e.ms += ms; if (ms > e.max) e.max = ms; }
  console.log('4. REPORT (node ms): inline, the one task ' + A.inlineMs + ' ms | in steps: ' + B.steps.length + ' steps, ' + Math.round(sum) + ' ms in all, the longest ' + Math.round(worst[1]) + ' ms (' + worst[0] + '), ' + B.steps.filter(s => s[1] > 20).length + ' over 20 ms, ' + B.steps.filter(s => s[1] > 50).length + ' over 50 ms');
  console.log('   by label (n, sum, longest): ' + Object.keys(by).sort((p, q) => by[q].max - by[p].max).map(l => l + ' ' + by[l].n + ' / ' + Math.round(by[l].ms) + ' / ' + Math.round(by[l].max)).join(' | '));
  for (const b of bad) console.log('  FAIL ' + b);
  console.log('GATE COMPSTEPS: ' + (bad.length ? 'FAIL' : 'PASS'));
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.log('  FAIL ' + (e && e.stack || e)); console.log('GATE COMPSTEPS: FAIL'); process.exit(1); });
