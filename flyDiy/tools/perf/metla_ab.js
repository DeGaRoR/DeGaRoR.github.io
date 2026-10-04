#!/usr/bin/env node
// metla_ab.js - METLA-RETURN (G1190-G1199): THE TOWN ON AGAINST OFF, the master bench's own scenes and rig.
// For each slot of --order (A = the town off, B = the town on: ?town=1) and each build: a page load (navigation ->
// garage), the first roll-out (garage -> world: the first flight is the two), the taxi in the chase view, the low pass
// at HOME. The same profile for every slot (warmed once, discarded). Per scene: master_bench's statistics, plus every
// frame over --long ms (default 80) with the flight recorder's slot split, and the recorder's events in the window
// (long tasks, LoAF scripts, premises built, links). --cpuprof <scene substring>: a CDP CPU profile over that scene,
// the heaviest self / inclusive functions inside its long tasks. --check: the generators (SPORT_GEN, MARINE_GEN) and
// the town's sport/marine entries built, every load. Exceptions are counted per load.
// Usage: node tools/perf/metla_ab.js --port 8651 --udd D:/um1 [--order A,B,B,A] [--builds cub,metal] [--taxi 15]
//          [--pass 15] [--over 0] [--cpuprof pass] [--out file.json]
// G1432 (TOWN-COOK): --builds takes a build file too (builds/cub_2026-09-20_corrected.json: a path is its own build);
// every row carries the raster's counters at the garage and after the roll-out (bootRaster: lazy bakes, decoded tiles,
// cooked cells taken / refused) and the raster cells the loader fetched (FLYDIY_TOWN_VARIANT, their count);
// --over <s> adds THE OVERFLIGHT after the low pass: the aeroplane placed --over-lead m (default 2500) short of
// Metlakatla's centre (--over-at x,z, the town's cooked cells' centroid) on the HOME -> town bearing, 150 m over the
// ground at 45 m/s, the pilot re-engaged as the pass does; the scene's raster delta (bakes over the town) and the closest
// the aeroplane came to the centre are logged. The commands A0 runs are in HANDOVER G1430-G1434.
'use strict';
const fs = require('fs'), path = require('path');
const MB = require('../master_bench.js');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const PORT = +opt('port', 0), UDD = opt('udd', null);
if (!PORT || !UDD) { console.error('metla_ab: --port and --udd are required'); process.exit(2); }
const ORDER = opt('order', 'A,B,B,A').split(','), WANT = opt('builds', 'cub,metal').split(',');
const SEC = { taxi: +opt('taxi', 15), pass: +opt('pass', 15), over: +opt('over', 0) }, LONG = +opt('long', 80), PROF = opt('cpuprof', null);
// (G1432) a build is a master_bench key or a build file (its own label)
const buildOf = k => MB.BUILDS[k] || (/\.json$/.test(k) ? { label: path.basename(k, '.json'), build: k } : null);
for (const k of WANT) if (!buildOf(k)) { console.error('metla_ab: no build "' + k + '" (a master_bench key or a .json path)'); process.exit(2); }
// (G1432) Metlakatla's centre (the town's own cooked raster cells' centroid, tools/perf/town_cook_node.js) and the lead in
const OVER_AT = opt('over-at', '-3058,-8445').split(',').map(Number), OVER_LEAD = +opt('over-lead', 2500);
const OUT = path.resolve(opt('out', path.join(__dirname, 'metla_ab_' + Date.now() + '.json')));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BASE = 'http://localhost:' + PORT + '/flyDiy/index.html';
const SIDE = { A: 'town=0', B: 'town=1' };   // G1408: the town is ON by default - A says off explicitly

// the recorder's frames over LONG ms in [t0, t1] with their slot split, and its events there
const RECQ = (t0, t1) => `JSON.stringify((() => { const R = window.FLIGHT_REC && FLIGHT_REC.rec; if (!R) return null;
  const out = { long: [], ev: [] }; for (let f = Math.max(0, R.frame - 60000); f < R.frame; f++) { const r = R.row(f); if (r.t < ${t0} || r.t > ${t1} || !(r.dt > ${LONG} || r.work > ${LONG})) continue;
    const s = {}; for (const k of FLIGHT_REC.SLOTS) if (r[k] > 2) s[k] = Math.round(r[k]); out.long.push({ t: Math.round(r.t), dt: Math.round(r.dt), work: Math.round(r.work), gpu: Math.round(r.gpu || 0), slots: s }); }
  out.ev = R.events.filter(e => e[0] >= ${t0} - 500 && e[0] <= ${t1} && (e[1] !== 'prem' || e[2] > 8) && e[1] !== 'cap').slice(-60); return out; })())`;
const CHECK = `JSON.stringify((() => { const P = WORLD && WORLD.premises; const T = window.FLYDIY_TOWN || {};
  let sport = 0, marine = 0; try { for (const it of (P && P.items ? P.items() : []) || []) { const k = String(it.key || ''); if (k.startsWith('sport/')) sport++; if (k.startsWith('marine/')) marine++; } } catch (e) {}
  return { town: !!T.all, cut: T.n || 0, SPORT_GEN: !!window.SPORT_GEN, MARINE_GEN: !!window.MARINE_GEN, sportEntries: sport, marineEntries: marine,
    stats: P && P.stats ? { houses: P.stats.houses, objects: P.stats.objects, queued: P.stats.queued } : null, kit: P && P.kitTownStats ? (() => { try { return P.kitTownStats(); } catch (e) { return 'err ' + e.message; } })() : null }; })())`;

(async () => {
  if (await MB.serveRoot(PORT)) { console.error('metla_ab: port ' + PORT + ' is taken'); process.exit(4); }
  const srv = MB.serve(PORT, null); await sleep(800);
  const root = await MB.serveRoot(PORT);
  if (!root || path.resolve(root) !== path.resolve(__dirname, '..', '..', '..')) { console.error('metla_ab: the server serves ' + root); try { srv.kill(); } catch (e) {} process.exit(4); }
  const done = () => { try { srv.kill(); require('child_process').execSync('taskkill /PID ' + srv.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
  process.on('exit', done);
  const fresh = !fs.existsSync(UDD);
  // G1220: a fresh Chrome per slot (the same profile): in ONE session the ground's heaviest programs hit and miss the
  // program cache on alternate navigations, whatever the build - metla_ab1's 'metal +20 s' was its slot (CESSNA-LINKS).
  // --one-chrome: the old single session
  let b = await MB.browser(UDD);
  const R = { date: new Date().toISOString(), order: ORDER, builds: WANT, udd: UDD, fresh, rows: [] };
  const log = s => console.log('  ' + s);
  const now = () => b.ev('performance.now()');
  const pull = async () => JSON.parse(await b.ev('JSON.stringify({ fr: __MB.fr.slice(-30000), lt: __MB.lt, sc: __MB.sc || [] })', 20000));
  const trip = async () => {   // the roll-out: press, wait for the trip's done and the screen gone
    const n0 = await b.ev(MB.A.trips), t0 = await now(), w0 = Date.now(); await b.ev(MB.A.rollOut);
    let d = null; const tEnd = Date.now() + 300000;
    while (Date.now() < tEnd) { d = JSON.parse(await b.ev(MB.A.lastTrip, 30000)); if (d.n > n0 && d.kind === 'rollout' && d.done && d.boot === 'gone') break; d = null; await sleep(150); }
    const t1 = await now(), fr = await pull();
    return { ms: d ? d.ms : null, wall: +((Date.now() - w0) / 1000).toFixed(1), frames: MB.stat(fr.fr, fr.lt, t0, t1, fr.sc) };
  };
  const scene = async (name, sec, prof) => {
    if (prof) { await b.cmd('Profiler.enable'); await b.cmd('Profiler.setSamplingInterval', { interval: +opt("cpuus", 1000) }); await b.cmd('Profiler.start'); }
    const RS = "JSON.stringify((() => { const P = FLIGHT_PROBE.world().premises, O = P && P.overlay; return O ? Object.assign({ cooked: O.rasterCooked || null }, O.raster) : null; })())";
    const r0 = JSON.parse(await b.ev(RS).catch(() => 'null'));
    const t0 = await now(); await sleep(sec * 1000); const t1 = await now();
    const r1 = JSON.parse(await b.ev(RS).catch(() => 'null'));
    const raster = r0 && r1 ? { baked: r1.baked - r0.baked, bakeMs: +(r1.bakeMs - r0.bakeMs).toFixed(1), evicted: r1.evicted - r0.evicted, decoded: r1.decoded - r0.decoded, tiles: r1.tiles, mb: +(r1.bytes / 1048576).toFixed(1), cookedCells: r1.cookedCells, cooked: r1.cooked, total: { baked: r1.baked, bakeMs: Math.round(r1.bakeMs), evicted: r1.evicted } } : null;
    let cpu = null; if (prof) { const p = await b.cmd('Profiler.stop'); cpu = p.result && p.result.profile; }
    const d = await pull(), st = MB.stat(d.fr, d.lt, t0, t1, d.sc);
    const rec = JSON.parse(await b.ev(RECQ(t0, t1), 20000));
    const tasks = d.lt.filter(x => x[0] + x[1] > t0 && x[0] < t1).sort((a, c) => c[1] - a[1]).slice(0, 5);
    return { scene: name, st, rec, tasks, t0, raster, cpu: cpu ? hot(cpu, tasks.filter(x => x[1] >= 100), t0) : null };
  };
  const flying = async () => { await sleep(1500); const a = await b.ev(MB.A.simT); await sleep(1200); const c = await b.ev(MB.A.simT); if (!(c > a)) await b.ev(MB.A.run); };
  let home = null;
  if (fresh) { log('== warm-up (discarded) ' + UDD); await b.load(BASE + '?town=1', MB.preScript('default', null)); await trip(); await sleep(3000); }
  for (const side of ORDER) for (const bk of WANT) {
    const B = buildOf(bk); log('== ' + side + ' (' + (SIDE[side] || 'town off') + ') ' + B.label);
    if (R.rows.length && !argv.includes('--one-chrome')) { await b.close(); b = await MB.browser(UDD); }
    const e0 = b.exc.length;
    // (G1432) every premises overlay the page makes is kept (a composition is a new overlay with its own counters: the boot's
    // first, generator-less one is gone by the garage) - bootRaster sums them
    const OVS = ";window.__ovs=[];setInterval(function(){try{var W=window.FLIGHT_PROBE&&FLIGHT_PROBE.world?FLIGHT_PROBE.world():window.WORLD,O=W&&W.premises&&W.premises.overlay;if(O&&window.__ovs.indexOf(O)<0)window.__ovs.push(O);}catch(e){}},20);";
    const l = await b.load(BASE + (SIDE[side] ? '?' + SIDE[side] : ''), MB.preScript(B.build, null, B.patch) + OVS);
    const lk = await b.links(0, 1e12);
    if (!home) { const pl = JSON.parse(await b.ev('(async () => { for (let i = 0; i < 100 && !(window.FLIGHT_PROBE && FLIGHT_PROBE.world && FLIGHT_PROBE.world()); i++) await new Promise(r => setTimeout(r, 100)); return ' + MB.A.places + '; })()')); home = pl.find(p => p.id === 'HOME'); }
    await sleep(1500);
    const RB = "JSON.stringify((() => { const L = (window.__ovs || []).map(O => ({ c: O.rasterCooked || null, x: O.raster || {} })), sum = k => L.reduce((s, o) => s + (+o.x[k] || 0), 0);"
      + " return { variant: window.FLYDIY_TOWN_VARIANT || null, fetched: window.ISLAND_BOOT && ISLAND_BOOT.premCook && ISLAND_BOOT.premCook.raster ? ISLAND_BOOT.premCook.raster.length : 0, overlays: L.map(o => [o.c, o.x.baked | 0]),"
      + " baked: sum('baked'), bakeMs: Math.round(sum('bakeMs')), decoded: sum('decoded'), evicted: sum('evicted') }; })())";
    const rbGarage = JSON.parse(await b.ev(RB).catch(() => 'null'));
    const tr = await trip(); await flying();
    const rbRoll = JSON.parse(await b.ev(RB).catch(() => 'null'));
    const row = { side, build: bk, garage: l.sec, rollout: tr.wall, firstFlight: +(l.sec + tr.wall).toFixed(1), rollFrames: tr.frames, links: lk, bootRaster: { garage: rbGarage, rollout: rbRoll } };
    log('raster at the garage ' + JSON.stringify(rbGarage) + ' / after the roll-out ' + JSON.stringify(rbRoll));
    log('garage ' + l.sec + ' s, roll-out ' + tr.wall + ' s, first flight ' + row.firstFlight + ' s (links ' + lk.n + ', worst ' + lk.worstS + ' s, ' + lk.over5s + ' > 5 s)');
    await b.ev(MB.A.cam('chase'));
    row.taxi = await scene('taxi', SEC.taxi, PROF && 'taxi'.includes(PROF));
    const ph = await b.ev(MB.A.pass(home, 42), 20000).catch(e => 'error ' + e.message); await sleep(3000);
    row.pass = await scene('pass', SEC.pass, PROF && 'pass'.includes(PROF)); row.pass.pilot = ph;
    if (SEC.over > 0) {   // (G1432) THE OVERFLIGHT of Metlakatla
      const ox = OVER_AT[0], oz = OVER_AT[1], bx = ox - home.x, bz = oz - home.z, bl = Math.hypot(bx, bz), hx = bx / bl, hz = bz / bl;
      const op = await b.ev("(async () => { const W = FLIGHT_PROBE.world(), x = " + ox + " - " + hx + " * " + OVER_LEAD + ", z = " + oz + " - " + hz + " * " + OVER_LEAD + "; const h = W.terrainH ? W.terrainH(x, z) : 0;"
        + " await FLIGHT_PROBE.place({ at: [x, Math.max(h, 0) + 150, z], zeroV: true, dv: [" + hx + " * 45, 0, " + hz + " * 45] }); FLIGHT_PROBE.setManual(true); FLIGHT_PROBE.setManual(false); return FLIGHT_PROBE.ap().phase; })()", 20000).catch(e => 'error ' + e.message);
      let closest = Infinity; const track = [];
      const samp = (async () => { const tEnd = Date.now() + SEC.over * 1000; while (Date.now() < tEnd) { const p = JSON.parse(await b.ev('JSON.stringify(FLIGHT_PROBE.sim().cgPos())').catch(() => 'null')); if (p) { const d = Math.hypot(p[0] - ox, p[2] - oz); closest = Math.min(closest, d); track.push([Math.round(p[0]), Math.round(p[1]), Math.round(p[2])]); } await sleep(2000); } })();
      row.over = await scene('over', SEC.over, PROF && 'over'.includes(PROF)); await samp;
      row.over.pilot = op; row.over.closestM = Math.round(closest); row.over.track = track;
    }
    row.check = JSON.parse(await b.ev(CHECK, 20000).catch(() => 'null'));
    row.exceptions = b.exc.slice(e0);
    for (const s of [row.taxi, row.pass, row.over].filter(Boolean)) { const x = s.st || {};
      log(s.scene.padEnd(5) + ' ' + x.fps + ' fps, uneven ' + (100 * x.uneven).toFixed(0) + ' %, p99 ' + x.p99 + ', worst ' + x.worst + ' ms, >100 ' + x.over100 + ', worst task ' + x.taskWorst
        + (s.rec && s.rec.long.length ? '  LONG ' + s.rec.long.map(f => f.dt + '(' + Object.entries(f.slots).map(([k, v]) => k + ' ' + v).join(',') + ')').join(' ') : ''));
      if (s.raster) log('  raster ' + JSON.stringify(s.raster));
      if (s.closestM != null) log('  over: closest to the town\'s centre ' + s.closestM + ' m, pilot ' + s.pilot);
      if (s.cpu) log('  cpu in long tasks: ' + s.cpu.self.slice(0, 12).map(h => h[0] + ' ' + h[1]).join(' | ')); }
    log('check ' + JSON.stringify(row.check) + ' exceptions ' + row.exceptions.length + (row.exceptions.length ? ': ' + row.exceptions.slice(0, 3).join(' || ') : ''));
    R.rows.push(row); fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
  }
  await b.close(); done();
  // the table: per side and build, the medians of its runs
  const med = a => { const s = a.filter(x => x != null).sort((p, q) => p - q); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
  console.log('\nside build  | garage  first-flight | TAXI fps uneven p99 worst task | PASS fps uneven p99 worst task | boot bakes (garage / roll-out) | OVER fps uneven worst bakes (each: the runs\' median; worst = the max)');
  for (const bk of WANT) for (const side of ['A', 'B']) { const rs = R.rows.filter(r => r.side === side && r.build === bk); if (!rs.length) continue;
    const g = (k, s) => rs.map(r => r[s] && r[s].st ? r[s].st[k] : null), mx = a => Math.max(...a.filter(x => x != null));
    console.log([side, bk.padEnd(5), med(rs.map(r => r.garage)), med(rs.map(r => r.firstFlight)), '|', med(g('fps', 'taxi')), med(g('uneven', 'taxi')), med(g('p99', 'taxi')), mx(g('worst', 'taxi')), mx(g('taskWorst', 'taxi')),
      '|', med(g('fps', 'pass')), med(g('uneven', 'pass')), med(g('p99', 'pass')), mx(g('worst', 'pass')), mx(g('taskWorst', 'pass')),
      '|', med(rs.map(r => r.bootRaster && r.bootRaster.garage ? r.bootRaster.garage.baked : null)), med(rs.map(r => r.bootRaster && r.bootRaster.rollout ? r.bootRaster.rollout.baked : null)),
      '|', med(g('fps', 'over')), med(g('uneven', 'over')), mx(g('worst', 'over')), med(rs.map(r => r.over && r.over.raster ? r.over.raster.baked : null))].join(' ')); }
  console.log('\n  -> ' + OUT);
  process.exit(0);
})().catch(e => { console.error('metla_ab: ' + (e && e.stack || e)); process.exit(1); });

// a CPU profile's samples inside the given long tasks (page clock): self time by function, top 20
function hot(p, tasks, t0page) {
  if (!p || !p.samples) return null;
  const byId = new Map(p.nodes.map(n => [n.id, n]));
  // the profile's clock is microseconds on its own origin: the first sample is ~ the start of the scene (t0page)
  let t = p.startTime; const at = []; for (const d of p.timeDeltas) { t += d; at.push(t); }
  const off = t0page - p.startTime / 1000;
  const inTask = ms => tasks.some(x => ms >= x[0] && ms <= x[0] + x[1]);
  const self = new Map(), incl = new Map(), stacks = new Map();
  const name = n => (n.callFrame.functionName || '(anon)') + '@' + (n.callFrame.url || '').split('/').pop().split('?')[0] + ':' + (n.callFrame.lineNumber + 1);
  const parent = new Map(); for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const bake = new Map();   // every sample under grBake, the whole scene: who asked (the stack down to it)
  for (let i = 0; i < p.samples.length; i++) { const n = byId.get(p.samples[i]); if (!n) continue; const path = []; for (let id = n.id; id != null; id = parent.get(id)) path.push(byId.get(id).callFrame.functionName || '(anon)');
    const k = path.indexOf('grBake'); if (k < 0) continue; const sk = path.slice(k).reverse().slice(1).join('>'); bake.set(sk, (bake.get(sk) || 0) + (p.timeDeltas[i + 1] || 1000) / 1000); }
  for (let i = 0; i < p.samples.length; i++) { const ms = at[i] / 1000 + off; if (!inTask(ms)) continue; const dt = (p.timeDeltas[i + 1] || 250) / 1000;
    const n = byId.get(p.samples[i]); if (!n) continue; const k = name(n); self.set(k, (self.get(k) || 0) + dt);
    const path = []; for (let id = n.id; id != null; id = parent.get(id)) path.push(byId.get(id).callFrame.functionName || '(anon)'); const sk = path.reverse().slice(1).join('>'); stacks.set(sk, (stacks.get(sk) || 0) + dt);
    const seen = new Set(); for (let id = n.id; id != null; id = parent.get(id)) { const kk = name(byId.get(id)); if (seen.has(kk)) continue; seen.add(kk); incl.set(kk, (incl.get(kk) || 0) + dt); } }
  const top = m => [...m.entries()].sort((a, c) => c[1] - a[1]).slice(0, 25).map(([k, v]) => [k, +v.toFixed(1)]);
  return { self: top(self), incl: top(incl), stacks: [...stacks.entries()].sort((a, c) => c[1] - a[1]).slice(0, 40).map(([k, v]) => [+v.toFixed(1), k]), bake: [...bake.entries()].sort((a, c) => c[1] - a[1]).slice(0, 30).map(([k, v]) => [+v.toFixed(1), k]), tasks };
}
