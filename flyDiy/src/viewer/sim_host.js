// ============================================================
// THE SOLVER'S OWN THREAD (G810, 2026-09-27; futureDesigns/ARCH-2026-09-27.md
// §2, chantier 1, step 1). The page's loop runs `script(1/60); sim.step(1/60)`
// on the render thread (app.js loop()), so physics and render SUM: the taxi's
// 18-24 ms frame is the solver's 6-11 plus the render's 9-10, and every
// catch-up step G586 owes after a long frame makes the next frame longer. The
// node prototype (futureDesigns/ARCH-2026-09-27.probes/worker_proto.js) moved
// the solver and the pilot into a worker: the render thread's physics went
// from 3-23 ms to 0.02-0.03 ms and the worst frame from 59-125 to 18-34 ms.
//
// This file is that worker's BODY, built the way bench_worker.js is (A9): a
// Blob whose source imports this file and the built core bundle by URL next to
// the page, so it must stay a file the page can fetch. Nothing here is
// physics: the host owns
//   the WORLD   makeWorld on a TRIMMED island boot (SIM_HOST_KEYS: the height
//               tree and the grids the world's physics half reads - cover,
//               canopy, coast, lake, ttype, the lake records; not albedo,
//               tint, ori1, ndvi or the far tree, which only the renderer
//               reads; ARCH §1.6: ~70-80 MB against 638 MB for the whole
//               pack) + the premises record, fetched through the page's own
//               path (simHostFetchBoot) or handed in (the node gate);
//   the SIM     buildGen(spec) -> makeSim, reset, and the page's placement
//               (app.js applyRoute: the stance, the stand or the spawn, the
//               route, departFrom) and its pilot (mkPilot);
//   the STEP    per 1/60 s: the commands due at this step index, the
//               non-UI half of app.js script() (the hold's brake, the hand
//               under MANUAL, ap.update), sim.step(1/60), then the day's
//               physics half (world.dayTick on the sim's own clock - ARCH
//               §2.2: the climate reads the sun, so the day lives here and
//               the sky derives from snapshot t);
//   the CLOCK   its own: steps while sim time is behind wall time
//               (performance.timeOrigin + now(), the same epoch on both
//               threads), one step at a time, at most SIM_HOST_CATCH owed
//               per turn - past that the excess is let go and the DILATION
//               (G612's reading: sim seconds over wall seconds, the last
//               second) says so. Or LOCKSTEP ({cmd:'steps', n}) for a gate;
//   the SNAPSHOT a Float64Array in a TRANSFERRED ArrayBuffer (SIM_SNAP
//               layout: the head, p in float64 - ARCH §2.2, a float32 CG at
//               30 km quantizes to 2-4 mm - optionally v, the fuel nodes'
//               masses) + a small structured-clone `meta` (out, eng, fuel,
//               hydro, wheels, ctl, the pilot's snapshot). The page hands
//               each buffer back ({cmd:'release'}): no allocation per frame
//               once the pool is warm (the head counts every allocation).
//               postMessage with transfer first, as ARCH §2.2 recommends;
//               SharedArrayBuffer needs crossOriginIsolated and is a later,
//               measured option.
//
// INPUTS ARE STAMPED BY STEP INDEX. A command carries `k`, the step before
// which it applies; one that arrives late (or carries none) applies at the
// next boundary and is counted. Every application is LOGGED with the step it
// actually took ({cmd:'log'}), so a flight replays to the bit from its log in
// node (GATE SIMWORKER proves it) - ARCH §2.4's clean replay point.
//
// C1b (G815): app.js flies this behind ?simw=1 (sim_link.js is the page's
// glue). THE WORLD'S OPS: the viewer's obstacles (render_premises hitAdd, the
// club hangar, the parked aircraft - every add / move / remove / clear on the
// page world's registry) and its day / weather calls come as `obst` / `world`
// commands, stamped like any other; before the world exists they wait and
// are applied right after makeWorld, BEFORE the flight is placed. Each one
// bumps the WORLD's version (world.__simV, kept across flights on a kept
// world), which every snapshot carries (SIM_SNAP.WV) and the page asserts.
// The page's placement is the host's: the stand the page walked (standFor),
// seated on the ground under it (G700 seatOnGround, `place.seat`).
// NOT HERE YET (C1c): manualEnding's touchdown, the telemetry record(), the
// skip to line-up, editor edits.
//
// sim_view.js is the page's side: the read API the page already uses on
// `sim`, over these snapshots. GATE SIMWORKER (tools/_simworker_check.js)
// drives this host in a worker_threads Worker against the inline loop.
// ============================================================

// the trimmed boot: the manifest keys (dotted paths into the boot object, as
// src/core/world_packs.json and tools/island_node.js name them) the world's
// physics half reads. 28_island.js makeIsland takes the rest as optional.
const SIM_HOST_KEYS = ['header', 'topo', 'payload', 'grid.meta', 'grid.cover', 'grid.canopy',
                       'grid.coast', 'grid.lake', 'grid.ttype', 'grid.lakes'];
// the world's facts at points, the same on the page's world and the worker's (G815: sim_link / GATE SIMWORKER-PAGE)
function simHostProbe(world, pts, t, H, opts) {
  if (!world) return null;
  const P = o => simHostPlain(o, 3);
  const near = [];
  // island-wide FNVs of what the climate's relief raster is built from (the world's bounds, grid x grid): the
  // ground, the surface class, and the raster itself (climate.reliefAt, which builds it if it was not)
  let grid = null;
  const B = world.bounds, N = opts && opts.grid;
  if (B && N) {
    const f = new Float64Array(1), u = new Uint8Array(f.buffer), hs = { h: 2166136261, s: 2166136261, r: 2166136261 };
    const add = (k, x) => { f[0] = x; let h = hs[k]; for (let i = 0; i < 8; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0; hs[k] = h; };
    const R = world.climate && world.climate.reliefAt ? new Float32Array(16) : null;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = B.x0 + (i + 0.5) * (B.x1 - B.x0) / N, z = B.z0 + (j + 0.5) * (B.z1 - B.z0) / N;
      const hh = world.terrainH(x, z); add('h', hh); if (opts.values) (grid = grid || { hv: new Float64Array(N * N) }).hv[j * N + i] = hh;
      if (world.surface) add('s', +world.surface(x, z));
      if (R) { const o = world.climate.reliefAt(x, z, R); for (let c = 0; c < o.length; c++) add('r', o[c]); }
    }
    grid = Object.assign(grid || {}, hs);
  }
  return {
    grid, premises: world.premises && world.premises.overlay ? { n: world.premises.overlay.n, cooked: P(world.premises.overlay.rasterCooked),
                                                                  raster: !!(world.premises.overlay.raster && world.premises.overlay.raster.on) } : null,
    climate: world.climate ? { mode: world.climate.mode, rich: P(world.climate.rich), spec: P(world.climate.spec), version: world.climate.version } : null,
    day: world.day && world.day.spec ? world.day.spec() : null, atmos: P(world.atmos),
    obst: world.obstacles ? { n: world.obstacles.count, top: world.obstacles.maxTop } : null, v: world.__simV || 0,
    ctl: H ? P(H.sim.ctl) : null, started: H ? H.started : null, steps: H ? H.steps : null,
    pts: pts.map(q => ({ h: world.terrainH(q[0], q[2]), w: world.wind ? Array.from(world.wind(q[0], q[1], q[2], t)) : null,
      ws: world.climate && world.climate.sample ? world.climate.sample(q[0], q[1], q[2], t) : null,
      pm: world.premises && world.premises.overlay ? (O => { const h0 = world.premises.base.terrainH(q[0], q[2]);
        return { d: O.terrainH(q[0], q[2], h0), f: O.terrainFast ? O.terrainFast(q[0], q[2], h0) : null }; })(world.premises.overlay) : null,
      s: world.surface ? P(world.surface(q[0], q[2])) : null, wh: world.waterH ? world.waterH(q[0], q[2]) : null,
      tr: world.treesNear ? world.treesNear(q[0], q[2], near).length : null,
      ob: world.obstacles ? world.obstacles.near(q[0], q[2], near).slice() : null })),
  };
}
// the core names the worker's Blob picks out of the imported bundle
const SIM_HOST_CORE = ['ISLAND_GEN', 'makeWorld', 'buildGen', 'makeSim', 'makePilot', 'PILOT_STYLES',
                       'navMake', 'siteOf', 'placeAtStand', 'placeAtAerodrome', 'seatOnGround', 'placeAtLineup',
                       'stripSurface', 'stripGear'];
const SIM_HOST_DT = 1 / 60;
const SIM_HOST_CATCH = 4;          // steps owed per turn at most (G586's frame owed 4)
// G1365 (SIM-STALL): THE PAGE'S HEARTBEAT. The page beats once a drawn frame ({cmd:'beat'}, sim_view.js frame(T));
// the clock steps no further than this past the last beat it heard. A page that stops presenting frames (a main-thread
// freeze - the user's 79 s one, a tab away) HOLDS the flight there, and the next beat re-anchors the clock: the flight
// goes on from where it held, the lost wall time not owed (no catch-up, no teleport). PACE's stall (app.js) is the same 250 ms
const SIM_HOST_STALL_MS = 250;
const SIM_HOST_POOL = 7;           // snapshot buffers: the page holds up to five (sim_view.js's ring, G1100), the host writes the next, one in flight
const SIM_HOST_LOG = 8192;         // applied commands kept for {cmd:'log'}
// THE SNAPSHOT'S HEAD (float64 slots), then p (3n), then v (3n, when asked), then the fuel nodes' masses
// G1100 (POSE-SMOOTH): DUE - the wall moment the newest state was DUE on the host's own clock (its schedule: wall0 + the
// steps since the anchor, a 60th of a second each at the set rate), not when it was published (WALL: after the step's
// cost and the timer's lateness, which moved the page's drawn time by up to half a step frame to frame); WALL where no
// clock runs (a pause, a snap, lockstep)
const SIM_SNAP = { SEQ: 0, STEP: 1, T: 2, WALL: 3, STEPMS: 4, DIL: 5, WV: 6, N: 7, FLAGS: 8, CG: 9, CGV: 12,
                   TOTALM: 15, WHEELS: 16, SMAX: 17, LATE: 18, DROPPED: 19, MAXMS: 20, RAN: 21, ALLOCS: 22,
                   RATE: 23, EPOCH: 24, NF: 25, DUE: 26, HEAD: 27,
                   F_DIVERGED: 1, F_V: 2, F_RUNNING: 4, F_MANUAL: 8, F_STARTED: 16, F_CRASHED: 32 };   // F_CRASHED: G1470, the wreck at rest

const simHostGet = (o, k) => { const p = k.split('.'); for (const s of p) { if (o == null) return undefined; o = o[s]; } return o; };
const simHostSet = (o, k, v) => { const p = k.split('.'); for (let i = 0; i < p.length - 1; i++) o = (o[p[i]] = o[p[i]] || {}); o[p[p.length - 1]] = v; };

// the physics half of a boot the page (or island_node.js) assembled - the same
// arrays, not copies
function simHostTrimBoot(boot) {
  if (!boot) return null;
  const out = { id: boot.id, grid: {}, far: null, hydro: boot.hydro || 'blend' };
  if (boot.reclass != null) out.reclass = boot.reclass;
  for (const k of SIM_HOST_KEYS) { const v = simHostGet(boot, k); if (v != null) simHostSet(out, k, v); }
  return out;
}
function simHostBootBytes(boot) {
  let b = 0;
  for (const k of SIM_HOST_KEYS) { const v = simHostGet(boot, k); if (v && v.byteLength) b += v.byteLength; }
  return b;
}

// the trimmed boot fetched the way the page's loader fetches the whole one
// (tools/build.js, the island block): the manifest, then each named payload,
// ONE gzip stream each - through the same URLs, so the page's cache serves the
// worker. opts: { fetch, hydro, raster }. G815: `raster` (the page's
// FLYDIY_GROUND_RASTER) brings the island's COOKED ground-raster cells as the
// loader does (src/core/premises_packs.json -> boot.premCook): makeWorld reads
// the cooked tiles where the page does, and a tile baked here instead differs
// from the cook in the last bits - the climate's relief raster carries that
// island-wide into the rich wind. G1430 (TOWN-COOK): `variant` (the page's:
// 'town' or 'default', build.js FLYDIY_TOWN_VARIANT) takes the cells `in` that
// variant alone, as the page's loader does; without it, every cell.
function simHostFetchBoot(base, name, opts) {
  opts = opts || {};
  const F = opts.fetch || fetch;
  const gz = buf => new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer().then(b => new Uint8Array(b));
  return F(base + 'src/core/world_packs.json').then(r => (r.ok ? r.json() : { islands: [] })).then(PACK => {
    const isl = (PACK.islands || []).find(w => w.id === name);
    if (!isl) return null;
    const boot = { id: name, grid: {}, far: null, hydro: opts.hydro || 'blend' };
    return Promise.all(SIM_HOST_KEYS.map(k => {
      const r = isl.files[k];
      if (!r) return null;
      if ('json' in r) { simHostSet(boot, k, r.json); return null; }
      return F(base + r.src).then(res => { if (!res.ok) throw new Error(r.src + ' ' + res.status); return res.arrayBuffer(); })
        .then(gz).then(u => simHostSet(boot, k, r.kind === 'json' ? JSON.parse(new TextDecoder().decode(u)) : u));
    })).then(() => {
      if (!opts.raster) return boot;
      return F(base + 'src/core/premises_packs.json').then(r => (r.ok ? r.json() : { islands: [] })).then(PP => {
        const pi = (PP.islands || []).find(w => w.id === name);
        if (!pi || !pi.raster) return boot;
        const got = [];
        return Promise.all(pi.raster.cells.filter(c => !opts.variant || !c.in || c.in.indexOf(opts.variant) >= 0).map(c => F(base + c.src).then(res => { if (!res.ok) throw new Error(c.src + ' ' + res.status); return res.arrayBuffer(); })
          .then(gz).then(u => got.push({ ci: c.c[0], cj: c.c[1], sig: c.sig, bytes: u })))).then(() => { boot.premCook = { raster: got }; return boot; });
      }).catch(() => boot);   // a cook that does not arrive is a lazy raster (the page's rule)
    });
  });
}

// plain data, for a structured clone: numbers, strings, booleans, arrays and
// objects to `depth`, small typed arrays copied; functions, getters and the
// `skip` keys dropped
// G1180: a float's wet panels, flat - SIM_HOST_PANEL numbers each: index, wet, A, then c, n, Fp, Fm (3 each)
const SIM_HOST_PANEL = 15;
function simHostPanels(per) {
  let n = 0; for (const o of per) if (o.wet) n++;
  const f = new Float64Array(n * SIM_HOST_PANEL); let j = 0;
  per.forEach((o, i) => { if (!o.wet) return; f[j++] = i; f[j++] = o.wet; f[j++] = o.A;
    for (const v of [o.c, o.n, o.Fp, o.Fm]) { f[j++] = v[0]; f[j++] = v[1]; f[j++] = v[2]; } });
  return f;
}
// G2090: the wet body's contact records, trimmed to the groups in contact (null when none: a dry flight posts nothing);
// reading clears the slam peaks it hands over (the page sees each entry's splash once)
let simHostWetBuf = null;
function simHostWet(sim) {
  if (typeof sim.wetFx !== 'function') return null;
  const b = sim.wetFx(simHostWetBuf); if (!b) return null;
  simHostWetBuf = b;
  const n = b[0]; if (!(n > 0)) return null;
  const H = (typeof HYDRO !== 'undefined' && HYDRO.WFX_HEAD) || 5, R = (typeof HYDRO !== 'undefined' && HYDRO.WFX_R) || 18;
  return b.slice(0, H + n * R);
}
function simHostPlain(o, depth, skip) {
  if (o === null || typeof o !== 'object') return typeof o === 'function' ? undefined : o;
  if (ArrayBuffer.isView(o)) return o.length <= 64 ? Array.from(o) : undefined;
  if (depth <= 0) return undefined;
  if (Array.isArray(o)) return o.map(x => simHostPlain(x, depth - 1));
  const r = {};
  for (const k of Object.keys(o)) {
    if (skip && skip.indexOf(k) >= 0) continue;
    const d = Object.getOwnPropertyDescriptor(o, k);
    if (!d || d.get || typeof d.value === 'function') continue;
    const v = simHostPlain(d.value, depth - 1);
    if (v !== undefined) r[k] = v;
  }
  return r;
}

// ---- G1850 (DMG-D4a): THE BROKEN LIST, TO THE PAGE, ON CHANGE (DEFORM-AND-BREAK §2.5 / §5.1, TREE-CRASH's G1474) ----
// Under the worker the page's beams are the def's (sim_view.js `beams: def.beams`): no broken flag, no set. The damage
// view (dmg_overlay.js) and the skin (skin_break.js) read ONE state instead, the same inline and under the worker:
//   br   the broken members, in the order they broke
//   pc   each node's PIECE (DMG-D1b's union-find: the live members, the shape-matched clusters still on), 0 = the core
//        (the piece holding the body's refs) - null while the airframe is one piece
//   st   the members with a permanent set: [beam, (L0 - ks - Lr) / Lr, ...] (dmg_overlay.js setOf; |set| >= 1e-4)
// A PAYLOAD crosses only when that changed: a break (a new broken member, a cluster cut: `sB`) sends the whole state at
// once; a set alone (`sS`, every substep while a member yields) at most every SIM_DMG_SET_S of sim time, the last one
// always (it goes as soon as the window has passed, changing or not). Nothing broken, nothing set: nothing at all - no
// key in the snapshot's meta (the damage layer off, or an intact flight, costs one call and two string compares a snapshot).
// The page applies it with sim_view.js simViewDmgApply; app.js's inline sim runs the same hop with no window.
const SIM_DMG_SET_S = 0.1;
const SIM_DMG_SET_MIN = 1e-4;
function simDmgSigs(sim) {
  const D = sim.damage && sim.damage();
  if (!D) return null;
  return [D.breaks + ':' + (D.cl ? D.cl.length : 0), D.yields + ':' + D.dents];
}
// the pieces: DMG-D1b's own rule (30_solver.js pieces()), off the sim's public state - a payload's time, never a step's
function simDmgPieces(sim, coreNode) {
  const n = sim.n, P = new Int32Array(n);
  for (let i = 0; i < n; i++) P[i] = i;
  const f = i => { while (P[i] !== i) { P[i] = P[P[i]]; i = P[i]; } return i; };
  for (const b of sim.beams) { if (b.broken) continue; const x = f(b.a), y = f(b.b); if (x !== y) P[x] = y; }
  const CL = sim.clusterCuts ? sim.clusterCuts().clusters : [];
  for (const C of CL) if (!C.off && C.nodes.length) { const r0 = f(C.nodes[0]); for (const i of C.nodes) { const x = f(i); if (x !== r0) P[x] = r0; } }
  const core = f(coreNode >= 0 && coreNode < n ? coreNode : 0), lab = new Int32Array(n), id = new Map([[core, 0]]);
  for (let i = 0; i < n; i++) { const r = f(i); let k = id.get(r); if (k === undefined) { k = id.size; id.set(r, k); } lab[i] = k; }
  return id.size > 1 ? lab : null;
}
function simDmgSets(sim) {
  const st = [];
  sim.beams.forEach((b, bi) => {
    if (!(b.Lr > 0)) return;
    const s = (b.L0 - (b.ks || 0) - b.Lr) / b.Lr;
    if (Math.abs(s) >= SIM_DMG_SET_MIN) st.push(bi, Math.round(s * 1e6) / 1e6);
  });
  return st;
}
// hop: { sB, sS, t } - what the page holds; `win` the set window (s; 0 inline). Returns a payload, or null
function simDmgHop(sim, hop, coreNode, win) {
  const sg = simDmgSigs(sim);
  if (!sg) return null;
  const clk = typeof performance !== 'undefined' ? performance : Date, t0 = clk.now();
  let out = null;
  if (sg[0] !== hop.sB) {
    hop.sB = sg[0]; hop.sS = sg[1]; hop.t = sim.t;
    const D = sim.damage(), pc = D.breaks ? simDmgPieces(sim, coreNode) : null;
    out = { sB: sg[0], sS: sg[1], br: D.broken.slice(), pc: pc ? Array.from(pc) : null, st: simDmgSets(sim) };
  } else if (sg[1] !== hop.sS && !(sim.t - hop.t < (win == null ? SIM_DMG_SET_S : win))) {
    hop.sS = sg[1]; hop.t = sim.t;
    out = { sS: sg[1], st: simDmgSets(sim) };
  } else return null;
  hop.ms = clk.now() - t0;          // the payload's build (the union-find, the sets): GATE DMGSKIN reads it
  return out;
}
// the pristine hop (an intact airframe, as a new view holds it)
const simDmgHop0 = () => ({ sB: '0:0', sS: '0:0', t: -Infinity });

// the pilot's fields that are big and change rarely: sent when the object
// changes (by reference), the rest of the pilot every snapshot
const SIM_HOST_AP_RARE = ['legs', 'path', 'plan', 'taxiOut', 'site'];
const SIM_HOST_AP_SKIP = ['nav', 'sheet'];

// ---- THE WORLD'S OPS (G815): the page world's registry and day calls, replayed on this one. The page's
// obstacle ids map to this registry's own (a record the page's makeWorld made - the settle buildings - has
// the same id here: the same record, the same order). Returns true when the world changed (the version).
const SIM_HOST_WORLD_FNS = ['setDay', 'setWeather', 'setWind', 'setSea'];
const simHostIsWorldOp = c => !!c && (c.cmd === 'obst' || c.cmd === 'world' || c.cmd === 'premises');
function simHostWorldOp(world, c) {
  if (!world) return false;
  if (c.cmd === 'world') {
    if (SIM_HOST_WORLD_FNS.indexOf(c.fn) < 0 || typeof world[c.fn] !== 'function') return false;
    world[c.fn].apply(world, c.args || []);
  } else if (c.cmd === 'premises') {
    // G820 (C1c): THE WORLD EDITOR'S EDIT - the page recomposed its world (world.premises.set, render_premises'
    // composeNow on every edit and rebuild); this world recomposes on the same record, with the generators' builder
    // (the cable stations' hooks) as the page hands its own - the scripts are this worker's too (sim_link GEN_FILES)
    if (!world.premises || typeof world.premises.set !== 'function') return false;
    const G = typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : {});
    const build = r => { const GEN = G[r.gen]; return GEN && GEN.build ? GEN.build(r.P, 0) : null; };
    world.premises.set(c.rec, c.extra ? { build } : undefined);
  } else if (c.cmd === 'obst') {
    const R = world.obstacles, TH = world.treeHits; if (!R) return false;
    const ids = world.__simIds || (world.__simIds = new Map());
    const idOf = id => (ids.has(id) ? ids.get(id) : id);
    for (const o of c.ops || []) {
      // G1330 (TREE-HITBOX): the trunks the page's viewer draws (world.treeHits), a set by key
      if (o.op === 'tset') { if (TH) TH.set(o.key, o.arr); }
      else if (o.op === 'tdrop') { if (TH) TH.drop(o.key); }
      else if (o.op === 'tclear') { if (TH) TH.clear(); }
      else if (o.op === 'wsolid') { if (typeof world.setWoodSolid === 'function') world.setWoodSolid(o.on); }   // G1481
      else if (o.op === 'add') { const id = R.add({ x: o.x, z: o.z, yaw: o.yaw, y0: o.y0, shape: o.shape, tag: o.tag }); ids.set(o.id, id); }
      else if (o.op === 'move') R.move(idOf(o.id), o.x, o.z, o.yaw, o.y0);
      else if (o.op === 'remove') { R.remove(idOf(o.id)); ids.delete(o.id); }
      else if (o.op === 'clear') { R.clear(); ids.clear(); }
    }
  } else return false;
  world.__simV = (world.__simV || 0) + 1;
  return true;
}

// ---- THE HOST: world, sim, pilot, the step and the snapshot; thread-agnostic
// init: { world: { boot, premises, seed, opts, day } | a world to keep,
//         spec (as buildGen takes it), place: { from, to, stand }, pilot: { kind, shakedown, nav },
//         withV, day (tick the day, default true) }
// the world alone (G820, C1c: the page's boot makes it before any flight - {cmd:'mkworld'}); `onWorld` applies the
// ops that came before it (the page's registry so far)
function simHostMakeWorld(CORE, W, onWorld) {
  const island = W.boot ? CORE.ISLAND_GEN.makeIsland(W.boot) : null;
  const wo = Object.assign({}, W.opts || {});
  if (island) wo.island = island;
  if (W.premises != null) wo.premises = W.premises;
  const world = CORE.makeWorld(W.seed || 0, wo);
  if (W.day) world.setDay(W.day);
  world.__simV = 0;
  if (onWorld) onWorld(world);   // G815: the ops that came before the world (the page's registry so far)
  return world;
}
function makeSimHost(CORE, init, keptWorld) {
  const W = init.world || {};
  let world = keptWorld || null;
  if (!world) world = simHostMakeWorld(CORE, W, init.onWorld);
  else if (init.day) world.setDay(init.day);   // G815: a kept world takes the page's day at each new flight
  // G820 (C1c): THE SAME SIM ACROSS FLIGHTS OF ONE BUILD, as the page keeps its own (fullReset, the skip, the shed's
  // round trip reset and re-place ONE sim object; a new build makes a new one). A reset is not a new sim: sim.out (the
  // airspeed, the wind, easK - read by the pilot's first update before the first step, when a flight starts `started`,
  // as the skip's does), the aerodynamics' circulation memory and the like carry over on the page, and must here
  const kept = init.keepSim || null;
  if (typeof init.damage === 'boolean') globalThis.FLYDIY_DAMAGE = init.damage;   // G1898: the page's ?damage, before makeSim reads it
  const def = kept ? kept.def : CORE.buildGen(init.spec);
  const sim = kept ? kept.sim : CORE.makeSim(def, world);
  const n = sim.n, withV = !!init.withV, dayOn = init.day !== false;
  const fuelIdx = [];
  for (let i = 0; i < n; i++) if (def.nodes[i].mFuel > 0) fuelIdx.push(i);
  const S = SIM_SNAP, LEN = S.HEAD + 3 * n * (withV ? 2 : 1) + fuelIdx.length;
  const H = { world, def, sim, ap: null, steps: 0, epoch: 0, late: 0, started: false, manual: false, hand: null,
              queue: [], log: [], logDropped: 0, n, withV, fuelIdx, len: LEN };
  const aeroById = id => world.aerodromes.find(a => a.id === id) || world.aerodromes[0];
  // app.js mkPilot
  function mkPilot() {
    const PK = init.pilot || {}, kind = PK.kind || 'auto';
    {
      // G1940 (PILOT-ONE): one pilot; 'test' / 'classic' (retired) fly its normal style
      const sd = PK.shakedown || null;
      const ST_ = CORE.PILOT_STYLES || {};
      // G2085 (PILOT-PERSONA): the page's personality (a name or the custom object) flies here as it does inline
      const p = CORE.makePilot(sim, def, world, { style: ST_[kind] ? kind : 'normal', profile: PK.profile || undefined, shakedown: () => sd });
      if (PK.nav !== false && typeof CORE.navMake === 'function') {
        // one nav for the page's life (app.js flNav, made once, kept across flights): one per world here (G815)
        if (!world.__simNav) world.__simNav = CORE.navMake({ waypoints: world.aerodromes });
        H.nav = world.__simNav;
        p.setNav(H.nav);
      }
      return p;
    }
  }
  // app.js applyRoute; `stand`: true = the site's own, an object = the page's (standFor, the player's door), false = the spawn
  function place() {
    const PL = init.place || {}, ap = H.ap;
    const from = aeroById(PL.from || 'HOME');
    const to = (PL.to == null || PL.to === 'CIRCUIT') ? from : aeroById(PL.to);
    // G1375 (app.js applyRoute): the water lane the page's route names, the old SEA when it names land
    const wet = a => a && (typeof CORE.stripSurface === 'function' ? CORE.stripSurface(a).cls === 'water' : a.kind === 'water');
    const gearK = typeof CORE.stripGear === 'function' ? CORE.stripGear(def && def.spec && def.spec.gear ? def : sim) : 'floats';
    if (sim.hydro && (wet(from) || gearK === 'floats')) {
      const sea = wet(from) ? from : ((world.aerodromes || []).find(wet) || aeroById('SEA') || { hdg: Math.PI / 2, spawn: [0, 1285], elev: 0 });
      CORE.placeAtAerodrome(sim, sea);
      ap.setRoute(sea, (PL.to == null || PL.to === 'CIRCUIT' || to === from) ? sea : to);
      return;
    }
    if (typeof sim.stance === 'function') sim.stance();
    const st = typeof CORE.siteOf === 'function' ? CORE.siteOf(from.id) : null;
    const stand = (st && PL.stand !== false) ? (PL.stand && typeof PL.stand === 'object' ? PL.stand : st.stand) : null;
    const stSite = (st && stand && stand !== st.stand) ? Object.assign({}, st, { stand }) : st;
    if (PL.lineup && PL.stand && typeof PL.stand === 'object' && lineup(from, to, PL.stand, PL.site || stSite)) return;   // (G820: the page's site, as its skip read it)
    if (stand) {
      CORE.placeAtStand(sim, from, stand);
      // app.js applyRoute (G700): the wheels on the ground under the walked stand
      if (PL.seat && typeof CORE.seatOnGround === 'function') CORE.seatOnGround(sim, (x, z) => world.terrainH(x, z), def.refs);
      ap.setRoute(from, to);
      ap.departFrom(from, to, stSite);
    } else {
      CORE.placeAtAerodrome(sim, from);
      ap.setRoute(from, to);
    }
  }
  // G820 (C1c): THE SKIP TO LINE-UP - app.js placeLinedUp, statement for statement: the question asked on the stand of a
  // pilot planning from there (its own taxi's end, ap.lineupPose), the aeroplane back to its reset pose, then onto the
  // pose (placeAtLineup), every engine running, and the flight's pilot handed the HOLD (departFrom { atHold })
  function lineup(from, to, stand, stSite) {
    if (sim.hydro || typeof CORE.placeAtLineup !== 'function') return false;
    sim.reset(0); if (typeof sim.stance === 'function') sim.stance();
    CORE.placeAtStand(sim, from, stand);
    if (typeof CORE.seatOnGround === 'function') CORE.seatOnGround(sim, (x, z) => world.terrainH(x, z), def.refs);
    const q = mkPilot();
    if (typeof q.lineupPose !== 'function') return false;
    q.setRoute(from, to); q.departFrom(from, to, stSite);
    let pose = null;
    try { pose = q.lineupPose(); } catch (e) { pose = null; }
    sim.reset(0); if (typeof sim.stance === 'function') sim.stance();
    if (!pose) return false;
    CORE.placeAtLineup(sim, from, pose, world, def.refs);
    if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'both', running: true });
    H.ap = mkPilot();
    H.ap.setRoute(from, to);
    H.ap.departFrom(from, to, stSite, { atHold: pose });
    H.lineup = pose;
    return true;
  }
  // the step index runs on across a reset (a command stamped before it keeps its place); the epoch counts them
  function fresh() {
    sim.reset(0);
    H.ap = mkPilot();
    place();
    // G820 (C1c): the bench's test card (app.js startTestFlight: ap.setCard after the placement, before the start)
    if (init.pilot && init.pilot.card && H.ap.setCard) H.ap.setCard(init.pilot.card);
    // G2120 ROUTE-DRAW: the route the page's pilot had armed when the flight was asked (sim_link.js begin)
    if (init.pilot && init.pilot.route && H.ap.flyRoute) H.ap.flyRoute(init.pilot.route);
    H.started = false; H.epoch++; H.apGen = (H.apGen || 0) + 1;
    H.end = { air: false, wasAir: false, still: 0, over: false };
  }
  fresh();
  // ...and a sim made HERE for a page whose own had lived before (the shed's load test, an earlier flight flown inline)
  // takes the page's sim.out as it stands: what the pilot's first update reads before the first step (G820)
  if (!kept && init.out && sim.out) for (const k of Object.keys(init.out)) if (k !== 'hydro') sim.out[k] = init.out[k];

  // app.js resyncPhase (the hand given back to the pilot)
  const GROUND = ['DEPART', 'TAXI', 'LINEUP', 'HOLD', 'STOP', 'ROLL', 'LIFTOFF', 'ROLLOUT', 'STOPPED', 'ABORT', 'PUTDOWN'];
  function resyncPhase() {
    const ap = H.ap, onG = sim.wheelsOnGround(), cg = sim.cgPos(), v = sim.cgVel();
    const agl = cg[1] - world.terrainH(cg[0], cg[2]);
    const Vg = Math.hypot(v[0], v[2]);
    const wasGround = GROUND.indexOf(ap.phase) >= 0;
    if (onG === 0 && agl > 10 && wasGround) return 'CLIMB';
    if (onG >= 2 && Vg < 15 && !wasGround) return 'ROLLOUT';
    return ap.phase;
  }
  // G820 (C1c): app.js manualEnding - THE ENDING WHEN IT IS YOU, in the step it ends on (the page's copy runs
  // inside its script(), every step, inline; its state - airborneSeen / wasAir / stillT - lives here as H.end, reset
  // where the page resets it: a new flight, a new leg, the hand taken; `over` is the page's flightOver, sent)
  function manualEnding(dt) {
    const ap = H.ap, E = H.end;
    if (E.over || ap.phase === 'STOPPED') return;
    const cg = sim.cgPos(), v = sim.cgVel(), onG = sim.wheelsOnGround();
    const agl = cg[1] - world.terrainH(cg[0], cg[2]);
    if (agl > 15) E.air = true;
    if (!E.air) return;
    if (onG > 0 && E.wasAir) {
      E.wasAir = false;
      const F = ap.frame, o = sim.out || {};
      if (F) {
        const rx = cg[0] - F.ox, rz = cg[2] - F.oz;
        const Vt = Math.hypot(v[0] - (o.windX || 0), v[1] - (o.windY || 0), v[2] - (o.windZ || 0));
        ap.tdInfo = { sink: -v[1], z: -rx * F.uz + rz * F.ux, x: rx * F.ux + rz * F.uz,
                      V: Vt * (o.easK || 1), drift: -v[0] * F.uz + v[2] * F.ux };
      }
    } else if (onG === 0 && agl > 2) E.wasAir = true;
    const Vg = Math.hypot(v[0], v[2]);
    E.still = (onG >= 2 && Vg < 1.0) ? E.still + dt : 0;
    if (E.still < 3) return;
    const PL = init.place || {};
    const to = (PL.to == null || PL.to === 'CIRCUIT') ? aeroById(H.legFrom || PL.from || 'HOME') : aeroById(PL.to);
    const near = !!to && Math.hypot(cg[0] - to.x, cg[2] - to.z) < 1000;
    if (!ap.report) ap.report = { verdicts: [], outcome: null, landing: null };
    if (!ap.report.outcome) ap.report.outcome = near ? 'completed' : 'landed-out';
    if (!near) ap.tdInfo = null;
    ap.phase = 'STOPPED';
  }
  function writeCtl(set) {
    const c = sim.ctl;
    for (const k of Object.keys(set)) {
      if (k !== 'eng') { c[k] = set[k]; continue; }
      c.eng = Array.isArray(set.eng) ? set.eng.map(e => (e ? Object.assign({}, e) : e)) : null;
    }
  }
  // INP.write's door: the hand's axes every step it is on; an engine lever only where the aeroplane has one
  // G2480 (HAND-CONTROLS): the toe brakes' brakeD and the water rudders' wr with them - before G2480 the hand's
  // packet stopped at the flaps, and a differential brake the page set never reached the worker's sim. wr's null is a
  // value (THE RULE), so it is written whenever the packet carries the field
  const HAND_KEYS = ['de', 'da', 'dr', 'thr', 'brake', 'brakeD', 'flap'];
  H.HAND_KEYS = HAND_KEYS;
  function writeHand(h) {
    const c = sim.ctl;
    for (const k of HAND_KEYS) if (h[k] != null) c[k] = h[k];
    if ('wr' in h) c.wr = h.wr === 0 || h.wr === 1 ? h.wr : null;
    if (Array.isArray(h.eng) && Array.isArray(c.eng))
      for (let i = 0; i < c.eng.length && i < h.eng.length; i++) if (h.eng[i] != null && c.eng[i]) c.eng[i].thr = h.eng[i];
  }
  // G2480: what only the hand writes leaves with it - the toe brakes' split (the pilot clears brakeD every update
  // anyway, outside the box) and the water rudders' handle (the pilot never knew it: THE RULE again)
  function handOff(c) { c.brakeD = 0; c.wr = null; }
  function apply(c) {
    const ap = H.ap;
    switch (c.cmd) {
      case 'ctl':
        writeCtl(c.set || {});
        // G815: a lever of one engine (the page's ctl.eng[i].k = v), after any whole-array write
        if (c.eng) for (const e of c.eng) if (Array.isArray(sim.ctl.eng) && sim.ctl.eng[e[0]]) sim.ctl.eng[e[0]][e[1]] = e[2];
        break;
      case 'hand': H.hand = c.ctl || null; break;
      case 'start': H.started = true; break;
      case 'hold': H.started = false; break;
      case 'manual':
        if (!!c.on === H.manual) break;
        H.manual = !!c.on;
        if (H.manual) H.end.still = 0;           // app.js setManual(true): stillT = 0
        if (!H.manual) {
          handOff(sim.ctl);                       // app.js setManual(false): the hand's own fields off the aeroplane (G2480)
          if (ap.reEngage) ap.reEngage({ phase: resyncPhase() });
          if (ap.budget) ap.budget = Math.max(ap.budget, ap.t + 300);
        }
        break;
      case 'setEngine': {
        // the cockpit's starterOk is the page's (the bus): the view reads it when the key turns and sends it along
        const had = Object.prototype.hasOwnProperty.call(sim, 'starterOk'), was = sim.starterOk;
        if ('starterOk' in c) sim.starterOk = () => !!c.starterOk;
        sim.setEngine(c.i, c.patch);
        if (had) sim.starterOk = was; else delete sim.starterOk;
        break;
      }
      case 'impulse': sim.impulse(c.i, c.ix || 0, c.iy || 0, c.iz || 0); break;
      case 'cert': if (typeof sim.certStamp === 'function') sim.certStamp({ Ft: c.Ft, Fc: c.Fc }); break;   // G1831 (DMG-D2a)
      case 'setCard': if (ap.setCard) ap.setCard(c.card || {}); break;
      case 'setDay': world.setDay(c.day || {}); world.__simV = (world.__simV || 0) + 1; break;
      case 'obst': case 'world': case 'premises': simHostWorldOp(world, c); break;
      // G815: the page's viewers' wind queries, replayed where they sat between the page's steps (sim_link.js): they
      // move the climate sampler's reference (09_climate.js wind), which a first substep at the same t reuses
      case 'windq': if (world.wind) for (const q of c.q || []) world.wind(q[0], q[1], q[2], q[3]); break;
      // G815: the page climate's convection cache, carried (09_climate.js convState / convSeed) - its exact inputs
      // are the first moment the page's day met the key, which this world's day never lived
      case 'conv': if (world.climate && world.climate.convSeed) H.convSeeded = world.climate.convSeed(c.s); break;
      case 'reset': fresh(); break;
      // G820 (C1c): FLY ON - app.js nextLeg: a fresh pilot departing from where the last leg ended, NO reset (the
      // aeroplane, its engines and the clock carry on); the destination as the page's select has it
      case 'leg': {
        const cur = aeroById(c.from), to = (c.to == null || c.to === 'CIRCUIT') ? cur : aeroById(c.to);
        H.ap = mkPilot();
        H.ap.departFrom(cur, to);
        H.legFrom = c.from; if (init.place) init.place = Object.assign({}, init.place, { to: c.to });
        H.apGen++;
        H.end = { air: false, wasAir: false, still: 0, over: H.end.over };
        break;
      }
      // G1945 DEST-TO: a new To (app.js setTo): the pilot's destination moves - 43_pilot.js ap.setDest, as the page's
      case 'dest': {
        const to = c.to == null ? null : aeroById(c.to);
        if (to && ap.setDest) ap.setDest(to);
        if (to && init.place) init.place = Object.assign({}, init.place, { to: c.to });
        break;
      }
      // G2120 ROUTE-DRAW: a drawn route (app.js routeFly): the pilot's flyRoute, as the page's (null leaves it)
      case 'route': if (ap.flyRoute) ap.flyRoute(c.route || null); break;
      case 'over':   // the page's flightOver (the card up): the hand's ending stands down; endFlight's outcome (G130) written as the page writes it
        H.end.over = !!c.on;
        if (c.on && c.outcome) { if (!ap.report) ap.report = { verdicts: [], outcome: c.outcome, landing: null }; else if (!ap.report.outcome) ap.report.outcome = c.outcome; }
        break;   // app.js fullReset: a fresh pilot on the same route, held until a 'start'
    }
  }
  // a command queued for step k (the next boundary when absent or past)
  H.queueCmd = c => {
    const k = c.k == null ? H.steps : c.k;
    const e = { k, c };
    let i = H.queue.length;
    while (i > 0 && H.queue[i - 1].k > k) i--;
    H.queue.splice(i, 0, e);
  };
  function applyDue() {
    while (H.queue.length && H.queue[0].k <= H.steps) {
      const e = H.queue.shift();
      if (e.c.k != null && e.c.k < H.steps) H.late++;
      if (H.log.length >= SIM_HOST_LOG) { H.log.shift(); H.logDropped++; }
      H.log.push({ k: H.steps, c: e.c });
      apply(e.c);
    }
  }
  // ONE STEP: app.js loop()'s `script(1/60); sim.step(1/60)`, the commands before it, the day after it
  // (`noDay`: the caller ticks the day itself, after a batch - H.dayTick)
  H.dayTick = dt => { if (dayOn && world.dayTick) { const cg = sim.cgPos(); world.dayTick(dt, sim.t, cg[0], cg[2]); } };
  H.step = noDay => {
    applyDue();
    const ap = H.ap, dt = SIM_HOST_DT;
    if (!H.started) sim.ctl.brake = 0.6;
    else if (H.manual) {
      if (H.hand) writeHand(H.hand);
      if (ap.box && ap.box.on) ap.update(dt); else ap.t += dt;
      manualEnding(dt);
    } else ap.update(dt);
    sim.step(dt);
    if (!noDay) H.dayTick(dt);
    H.steps++;
  };
  H.diverged = () => !Number.isFinite(sim.p[1]) || !!(sim.fault && sim.fault());   // G1801: or a node past the velocity guard
  H.crashed = () => !!(sim.damage && sim.damage().over);   // G1470 (TREE-CRASH)

  // THE SNAPSHOT: the head, p, v, the fuel masses into `f` (a Float64Array of H.len)
  H.write = (f, x) => {
    const cg = sim.cgPos(), cv = sim.cgVel();
    f[S.STEP] = H.steps; f[S.T] = sim.t; f[S.WV] = world.__simV || 0; f[S.N] = n;
    f[S.FLAGS] = (H.diverged() ? S.F_DIVERGED : 0) | (withV ? S.F_V : 0) | (x.running ? S.F_RUNNING : 0) |
                 (H.manual ? S.F_MANUAL : 0) | (H.started ? S.F_STARTED : 0) | (H.crashed() ? S.F_CRASHED : 0);
    f[S.CG] = cg[0]; f[S.CG + 1] = cg[1]; f[S.CG + 2] = cg[2];
    f[S.CGV] = cv[0]; f[S.CGV + 1] = cv[1]; f[S.CGV + 2] = cv[2];
    f[S.TOTALM] = sim.totalM; f[S.WHEELS] = sim.wheelsOnGround(); f[S.SMAX] = sim.stats().smax;
    f[S.LATE] = H.late; f[S.EPOCH] = H.epoch; f[S.NF] = fuelIdx.length;
    f[S.SEQ] = x.seq; f[S.WALL] = x.wall; f[S.DUE] = x.due != null ? x.due : x.wall; f[S.STEPMS] = x.stepMs; f[S.DIL] = x.dil; f[S.DROPPED] = x.droppedS;
    f[S.MAXMS] = x.maxMs; f[S.RAN] = x.ran; f[S.ALLOCS] = x.allocs; f[S.RATE] = x.rate;
    let o = S.HEAD;
    const p = sim.p, v = sim.v, N3 = 3 * n;
    for (let i = 0; i < N3; i++) f[o + i] = p[i];
    o += N3;
    if (withV) { for (let i = 0; i < N3; i++) f[o + i] = v[i]; o += N3; }
    for (let j = 0; j < fuelIdx.length; j++) f[o + j] = sim.m[fuelIdx[j]];
  };
  const rare = {};
  let genSent = 0;
  // G1850: the broken list's hop (what the page holds), the core's node (the body's refs)
  let dmgHop = simDmgHop0();
  const dmgCore = (def.refs && def.refs.noseFrame && def.refs.noseFrame.length) ? def.refs.noseFrame[0] : 0;
  H.dmgBytes = 0; H.dmgSends = 0; H.dmgMs = 0;   // the hop's cost, read by GATE DMGSKIN
  H.meta = () => {
    const ap = H.ap, A = {};
    // G820 (C1c): a NEW PILOT (Fly on's leg, the skip's) - every field again, and the view starts its copy afresh
    const apNew = H.apGen !== genSent;
    if (apNew) { genSent = H.apGen; for (const k of Object.keys(rare)) delete rare[k]; }
    for (const k of Object.keys(ap)) {
      if (SIM_HOST_AP_SKIP.indexOf(k) >= 0) continue;
      const d = Object.getOwnPropertyDescriptor(ap, k);
      if (!d || d.get || typeof d.value === 'function') continue;
      const v = d.value;
      if (v === null || typeof v !== 'object') { A[k] = v; continue; }
      if (k === 'route') { A.route = { from: v.from && v.from.id, to: v.to && v.to.id }; continue; }
      if (k === 'report') {
        const sig = (v.verdicts ? v.verdicts.length : 0) + ':' + (v.phases ? v.phases.length : 0) + ':' + v.outcome + ':' + !!v.landing;
        if (rare.report !== sig) { rare.report = sig; A.report = simHostPlain(v, 5); }
        continue;
      }
      if (SIM_HOST_AP_RARE.indexOf(k) >= 0) { if (rare[k] !== v) { rare[k] = v; A[k] = simHostPlain(v, 5); } continue; }
      A[k] = simHostPlain(v, 4);
    }
    for (const k of SIM_HOST_AP_RARE) if (!(k in ap) && rare[k] !== undefined) { rare[k] = undefined; A[k] = null; }
    const HY = sim.hydro;
    const dmgB = simDmgHop(sim, dmgHop, dmgCore);
    if (dmgB) { H.dmgMs += dmgHop.ms; H.dmgSends++; H.dmgBytes += JSON.stringify(dmgB).length; }
    return {
      out: simHostPlain(sim.out, 3, ['hydro']),
      eng: simHostPlain(sim.eng, 3),
      // G1470: the crash's verdict for the page's card (why), once it is one
      dmg: sim.damage && sim.damage().crashed ? (d => ({ crashed: d.crashed, over: d.over, reason: d.reason, at: d.at, brokeUp: d.brokeUp || null, propStrike: d.propStrike, members: d.members, breaks: d.breaks })) (sim.damage()) : null,
      fuel: simHostPlain(sim.fuel, 3),
      // G1180 (LOC-SWITCH): a float's tables of vectors (W, dq, per) do not survive the plain copy at depth 2 - they
      // came over as arrays of undefined and the page's spray threw on every frame under the worker (the water taxi
      // drew nothing for 16 s). They stay here: the page refills W from the mirrored nodes (ctx.fill), and gets the
      // WET panels the spray reads, flat (simHostPanels)
      hydro: HY ? { wet: HY.wet, tick: HY.tick, floats: HY.floats.map(fx => ({ side: fx.side, wet: fx.wet, out: simHostPlain(fx.out, 2, ['W', 'dq', 'per', 'd']), per: simHostPanels(fx.out.per), lam: fx.lam.slice() })) } : null,
      wheels: sim.wheelContacts ? sim.wheelContacts() : null,
      // G2090 (WATER-LOOK): the wet body's contacts (32_hydro.js wetFx), only while any - a dry flight sends nothing
      wet: simHostWet(sim),
      ctl: simHostPlain(sim.ctl, 3),
      ap: A, apNew,
      ...(dmgB ? { dmgB } : {}),   // G1850: only when it changed
    };
  };
  // the pilot's rare fields go again after a re-init of the view (a new epoch)
  H.forgetRare = () => { for (const k of Object.keys(rare)) delete rare[k]; dmgHop = simDmgHop0(); };   // (G1850: a new view holds nothing)
  H.ready = () => ({ kind: 'ready', n, substeps: def.params.substeps, withV, len: LEN, fuelIdx: fuelIdx.slice(),
                     slots: SIM_SNAP, dt: SIM_HOST_DT, defSig: simHostDefSig(def), epoch: H.epoch });
  return H;
}

// what the page's own buildGen must agree with: the node count and the rest
// pose, FNV over the float64 bytes (a stale tools/flight_core.js in a cache
// would build another aeroplane - the view refuses it)
function simHostDefSig(def) {
  const a = new Float64Array(def.nodes.length * 4);
  def.nodes.forEach((nd, i) => { a[i * 4] = nd.p[0]; a[i * 4 + 1] = nd.p[1]; a[i * 4 + 2] = nd.p[2]; a[i * 4 + 3] = nd.m; });
  const u = new Uint8Array(a.buffer);
  let h = 2166136261;
  for (let i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 16777619) >>> 0;
  return def.nodes.length + ':' + h.toString(16);
}

// G1096: A RIG'S PLACEMENT (app.js FLIGHT_PROBE.place). The rigs held or carried the aeroplane by writing the page's
// sim().p / .v; under the physics worker that sim is a VIEW of the worker's, and the next snapshot undid the write
// (C3b, 2026-09-30: every view of a hold at the stand, the aeroplane still rolling). The same writes, made on the sim
// that flies - the page's own inline, the worker's at once between two of its steps: every node shifted so the CG
// stands at `at` (a null axis kept) or by `by`, the velocities zeroed (`zeroV`) and / or kicked by `dv`. -> the CG
function simHostPlace(sim, o) {
  const p = sim.p, v = sim.v, n = sim.n;
  let d = o.by || null;
  if (o.at) { const c = sim.cgPos(); d = [0, 1, 2].map(j => (o.at[j] == null ? 0 : o.at[j] - c[j])); }
  if (d) for (let i = 0; i < n; i++) { p[i * 3] += d[0]; p[i * 3 + 1] += d[1]; p[i * 3 + 2] += d[2]; }
  if (o.zeroV) for (let i = 0; i < n * 3; i++) v[i] = 0;
  if (o.dv) for (let i = 0; i < n; i++) { v[i * 3] += o.dv[0]; v[i * 3 + 1] += o.dv[1]; v[i * 3 + 2] += o.dv[2]; }
  return sim.cgPos();
}

// ---- THE THREAD: messages, the clock, the buffers --------------------------
// port: { post(msg, transfer), on(fn(msg)), close() } - self in a browser
// worker, parentPort under node's worker_threads (the gate)
function simHostBody(CORE, SH, port) {
  const S = SH.SIM_SNAP;
  const wallNow = () => performance.timeOrigin + performance.now();
  let H = null, world = null, bootInfo = null;
  let preWorld = [], dropped = 0;   // G815: world ops before the world exists; commands that found no flight
  let making = false, held = [];    // G820: a boot being fetched - what arrives meanwhile waits for it, in order
  let pool = [], allocs = 0, seq = 0;
  let running = false, wall0 = 0, step0 = 0, rate = 1, timer = null;
  let beatAt = 0, stalled = false;  // G1365: the last page beat heard (wall ms); the clock held for want of one
  // G612's readings: a step's cost (ms, eased), the dilation's window (sim s at the set rate over wall s,
  // decaying over a second) and the sim time let go when the physics cannot hold real time
  const P = { stepMs: 0, simW: 0, wallW: 0, lastWall: 0, droppedS: 0, guarded: 0, stalls: 0, stallS: 0, stallAt: 0 };
  const dil = () => (P.wallW > 0.2 ? P.simW / P.wallW : 1);
  const post = (m, tr) => { try { port.post(m, tr || []); } catch (e) { /* the page is gone */ } };
  // (due: G1100, the newest state's moment on the clock's schedule - the pump's; none = now)
  function publish(ran, maxMs, due) {
    let buf = null;
    while (pool.length && !buf) { const b = pool.pop(); if (b.byteLength === H.len * 8) buf = b; }
    if (!buf) { buf = new ArrayBuffer(H.len * 8); allocs++; }
    const wall = wallNow();
    H.write(new Float64Array(buf), { seq: seq++, wall, due: due != null ? due : wall, stepMs: P.stepMs, dil: dil(), droppedS: P.droppedS,
                                     maxMs, ran, allocs, rate, running });
    post({ kind: 'snap', buf, meta: H.meta() }, [buf]);
  }
  function stepTimed(noDay) {
    const s0 = performance.now();
    H.step(noDay);
    const ms = performance.now() - s0;
    P.stepMs = P.stepMs ? P.stepMs + 0.1 * (ms - P.stepMs) : ms;
    return ms;
  }
  function anchor() { wall0 = wallNow(); step0 = H.steps; P.lastWall = wall0; }
  function pump() {
    timer = null;
    if (!running || !H) return;
    let t = wallNow();
    // G1365: the page has drawn nothing for SIM_HOST_STALL_MS - the clock runs to that moment and holds (the next beat
    // goes on from here: beat() below)
    const cut = beatAt + SIM_HOST_STALL_MS, hold = t > cut;
    if (hold) t = cut;
    const dW = Math.min(0.25, Math.max(0, (t - P.lastWall) / 1000));
    P.lastWall = t;
    let owed = Math.floor((t - wall0) / 1000 * 60 * rate) - (H.steps - step0);
    if (owed > SIM_HOST_CATCH) {
      // the physics cannot hold real time: the excess is let go, and the dilation says so
      const drop = owed - SIM_HOST_CATCH;
      wall0 += drop / (60 * rate) * 1000; P.droppedS += drop / 60; P.guarded++;
      owed = SIM_HOST_CATCH;
    }
    let ran = 0, maxMs = 0;
    while (ran < owed) {
      const ms = stepTimed(); ran++;
      if (ms > maxMs) maxMs = ms;
      if (H.diverged()) { running = false; break; }
    }
    const k = Math.exp(-dW);
    P.simW = P.simW * k + ran / 60 / rate; P.wallW = P.wallW * k + dW;
    if (ran) publish(ran, maxMs, wall0 + (H.steps - step0) / (60 * rate) * 1000);   // one snapshot a turn: the newest state (G1100: stamped with when it was due)
    if (!running) return;
    if (hold) { stalled = true; P.stalls++; P.stallAt = cut; return; }   // held: no timer until a beat
    const next = wall0 + (H.steps - step0 + 1) / (60 * rate) * 1000;
    timer = setTimeout(pump, Math.max(0, next - wallNow()));
  }
  function stopClock() { running = false; stalled = false; if (timer) { clearTimeout(timer); timer = null; } }
  // G1365: the page drew a frame. A held clock re-anchors on now: the wall time it spent held is let go, not owed
  function beat() {
    beatAt = wallNow();
    if (!running || !stalled || !H) return;
    stalled = false; P.stallS += (beatAt - P.stallAt) / 1000;
    anchor(); pump();
  }
  function initHost(m) {
    stopClock();
    const keep = m.world === 'keep' ? world : null;
    // G815: the world's ops the last flight had queued and never reached (sent between flights) are the world's now
    if (H && keep) for (const e of H.queue) if (SH.simHostIsWorldOp(e.c)) SH.simHostWorldOp(world, e.c);
    const t0 = performance.now();
    const onWorld = w => { for (const c of preWorld) SH.simHostWorldOp(w, c); preWorld = []; };
    // G820 (C1c): the page's sim is the one it flew last (`keepSim`) and the build is the same: this one too
    const specStr = JSON.stringify(m.spec);
    const keepSim = m.keepSim && H && keep && H.world === keep && H.specStr === specStr ? { def: H.def, sim: H.sim } : null;
    H = SH.makeSimHost(CORE, Object.assign({}, m, { onWorld, keepSim }), keep);
    H.specStr = specStr; H.keptSim = !!keepSim;
    world = H.world;
    pool = []; seq = 0;
    for (let i = 0; i < SIM_HOST_POOL; i++) pool.push(new ArrayBuffer(H.len * 8));
    allocs = 0;
    const r = H.ready();
    r.initMs = performance.now() - t0; r.boot = bootInfo; r.keptSim = H.keptSim;
    post(r);
    publish(0, 0);
  }
  // a command with no flight to take it: a world op waits for (or goes straight to) the world; the rest is dropped
  function orphan(c) {
    if (!SH.simHostIsWorldOp(c)) { dropped++; return; }
    if (world) SH.simHostWorldOp(world, c); else preWorld.push(c);
  }
  // the trimmed boot through the page's URLs, then `then(boot)`; everything else that arrives waits (held)
  function fetchThen(F, then) {
    const t0 = performance.now();
    making = true;
    SH.simHostFetchBoot(F.base, F.name, { hydro: F.hydro, raster: F.raster, variant: F.variant }).then(boot => {
      bootInfo = { fetchMs: performance.now() - t0, bytes: boot ? SH.simHostBootBytes(boot) : 0,
                   cooked: boot && boot.premCook ? boot.premCook.raster.length : 0 };
      try { then(boot); } catch (err) { post({ kind: 'error', error: String(err && err.stack || err) }); }
    }).catch(err => post({ kind: 'error', error: String(err && err.stack || err) })).then(() => {
      making = false;
      const q = held; held = [];
      for (const x of q) onMsg(x);
    });
  }
  function onMsg(m) {
    if (!m) return;
    if (making && m.cmd !== 'release' && m.cmd !== 'state' && m.cmd !== 'ping') { held.push(m); return; }
    try {
      switch (m.cmd) {
        case 'mkworld': {
          // G820 (C1c): the world before any flight (the page's boot); the next init keeps it
          const mk = boot => {
            const t0 = performance.now();
            world = SH.simHostMakeWorld(CORE, Object.assign({}, m.world, { boot, fetch: null }), w => { for (const c of preWorld) SH.simHostWorldOp(w, c); preWorld = []; });
            post({ kind: 'world', ms: performance.now() - t0, boot: bootInfo, v: world.__simV });
          };
          if (m.world && m.world.fetch) fetchThen(m.world.fetch, mk); else mk(m.world && m.world.boot || null);
          return;
        }
        case 'init':
          if (m.world === 'keep' && !world) { post({ kind: 'error', error: 'init: keep, but no world here' }); return; }
          if (m.world && m.world.fetch) {
            fetchThen(m.world.fetch, boot => initHost(Object.assign({}, m, { world: Object.assign({}, m.world, { boot, fetch: null }) })));
            return;
          }
          if (m.world && m.world.boot) bootInfo = { bytes: SH.simHostBootBytes(m.world.boot) };
          initHost(m);
          return;
        case 'release': if (m.buf) pool.push(m.buf); return;
        case 'run': if (H && !running) { running = true; beatAt = wallNow(); anchor(); pump(); } return;
        case 'beat': beat(); return;
        case 'pause': stopClock(); if (H) publish(0, 0); return;
        // G1096: a rig's placement - at once, at this step boundary (lockstep: after every step the page posted; real
        // time: between two turns), the snapshot published, then the word the page's promise waits for
        case 'place': { const cg = H ? SH.simHostPlace(H.sim, m) : null; if (H) publish(0, 0); post({ kind: 'placed', id: m.id, cg }); return; }
        case 'rate': rate = m.x > 0 ? m.x : 1; if (running) anchor(); return;
        case 'steps': {
          // LOCKSTEP: exactly n steps now, a snapshot after each (`every`) or after the last. `dayBatch` (G815, the
          // page's rig clock): the day ticks ONCE after the n steps, n/60 s - app.js loop() ticks DAY_CLOCK once a
          // frame after the frame's steps, and a day ticked twice by 1/60 is not the day ticked once by 2/60 to the bit
          if (!H) return;
          stopClock();
          const n = m.n | 0, each = !!m.every, batch = !!m.dayBatch;
          let maxMs = 0, ran = 0;
          while (ran < n) {
            const ms = stepTimed(batch); ran++;
            if (ms > maxMs) maxMs = ms;
            if (each && !batch) publish(1, ms);
            if (H.diverged()) break;
          }
          if (batch && ran) H.dayTick(ran / 60);   // app.js: DAY_CLOCK.tick(nStep / 60)
          if (!each || batch) publish(ran, maxMs);
          return;
        }
        case 'snap': if (H) publish(0, 0); return;
        // G815: THE WORLD'S FACTS at the page's points (the page asks its own world the same - a divergence's triage):
        // the day, the air, and per point the ground, the wind at sim time t, the surface, the trees and obstacles near
        case 'probe':
          // (G820: real time - the world's ops sent unstamped while the clock stood are the world's before the next step;
          // a probe answers for the world that step will meet. Lockstep's stamped ones keep their step)
          if (H && world) H.queue = H.queue.filter(e => { if (e.c.k == null && SH.simHostIsWorldOp(e.c)) { SH.simHostWorldOp(world, e.c); return false; } return true; });
          post({ kind: 'probe', tag: m.tag, facts: SH.simHostProbe(world, m.pts || [], m.t || 0, H, m.opts) }); return;
        case 'resend': if (H) { H.forgetRare(); publish(0, 0); } return;   // a new view: the pilot's rare fields again
        case 'log': if (H) { post({ kind: 'log', list: H.log.slice(), dropped: H.logDropped, late: H.late }); if (m.clear) H.log.length = 0; } return;
        case 'ping': post({ kind: 'pong', t: m.t, tw: wallNow(), buf: m.buf }, m.buf ? [m.buf] : []); return;
        case 'state': post({ kind: 'state', running, rate, stepMs: P.stepMs, dilation: dil(), droppedS: P.droppedS, guarded: P.guarded, stalls: P.stalls, stallS: P.stallS, stalled,
                             allocs, steps: H ? H.steps : 0, late: H ? H.late : 0, queued: H ? H.queue.length : 0,
                             worldV: world ? world.__simV || 0 : 0, preWorld: preWorld.length, dropped }); return;
        case 'stop': stopClock(); H = null; world = null; if (port.close) port.close(); return;
        case 'batch': for (const c of m.list || []) { if (H) H.queueCmd(c); else orphan(c); } return;
        default: if (H) H.queueCmd(m); else orphan(m);
      }
    } catch (err) {
      post({ kind: 'error', error: String(err && err.stack || err) });
    }
  }
  port.on(onMsg);
}

// the Blob's source: this file and the built core bundle, by URL next to the
// page, then the body. `ver` busts a stale cache: FLYDIY_BUILD for this file,
// FLYDIY_CORE_SHA for the core (the inlined core's own hash). `pre` (G815): the
// scripts the page's premises catalogue comes from (vendor three, the
// generators - PREMISES_GEN.collect reads them off `window`), imported first
// with `self.window = self`, so the worker composes the premises with the
// page's catalogue: without it a park's lawn and the like are not modifiers
// here, and the cooked raster cells they sign go stale.
function simHostSource(base, ver, coreVer, pre) {
  const q = v => (v ? '?v=' + encodeURIComponent(v) : '');
  const imp = (pre || []).map(f => 'importScripts(' + JSON.stringify(base + f + q(ver)) + ');\n').join('');
  return (imp ? 'self.window = self;\n' + imp : '') + 'self.module = { exports: {} };\n' +
    'importScripts(' + JSON.stringify(base + 'src/viewer/sim_host.js' + q(ver)) + ');\n' +
    'const SH = self.module.exports; self.module = { exports: {} };\n' +
    'importScripts(' + JSON.stringify(base + 'tools/flight_core.js' + q(coreVer)) + ');\n' +
    'const CORE = { ' + SIM_HOST_CORE.map(k => k + ": typeof " + k + " !== 'undefined' ? " + k + ' : undefined').join(', ') + ' };\n' +
    'SH.simHostBody(CORE, SH, { post: function (m, tr) { self.postMessage(m, tr || []); },\n' +
    '  on: function (f) { self.onmessage = function (e) { f(e.data); }; }, close: function () { self.close(); } });\n';
}

// ---- the page's side --------------------------------------------------------
// One worker per flight. Null when there is no worker to be had (file://, no
// Worker) - the caller keeps the inline loop, byte for byte (ARCH §2.3).
function simHostStart(onMessage, onError, opts) {
  try {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' ||
        typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return null;
    const base = new URL('.', location.href).href;
    const W = typeof window !== 'undefined' ? window : {};
    const url = URL.createObjectURL(new Blob([simHostSource(base, W.FLYDIY_BUILD, W.FLYDIY_CORE_SHA, opts && opts.pre)], { type: 'text/javascript' }));
    const w = new Worker(url);
    const kill = () => { try { w.terminate(); } catch (e) {} try { URL.revokeObjectURL(url); } catch (e) {} };
    w.onmessage = e => { try { onMessage(e.data); } catch (err) { console.warn('sim worker message:', err); } };
    w.onerror = err => { kill(); if (onError) onError(err && err.message || 'worker failed'); };
    return {
      post: (m, tr) => { try { w.postMessage(m, tr || []); return true; } catch (e) { return false; } },
      base, kill,
    };
  } catch (e) { return null; }
}

if (typeof window !== 'undefined') {
  window.SIM_HOST = { start: simHostStart, source: simHostSource, trimBoot: simHostTrimBoot, fetchBoot: simHostFetchBoot, probe: simHostProbe,
                      place: simHostPlace, KEYS: SIM_HOST_KEYS, SNAP: SIM_SNAP,
                      dmgHop: simDmgHop, dmgHop0: simDmgHop0 };   // G1850: app.js's inline sim runs the same hop
}
if (typeof module !== 'undefined' && module.exports)
  module.exports = { SIM_HOST_KEYS, SIM_HOST_CORE, SIM_HOST_DT, SIM_HOST_CATCH, SIM_HOST_STALL_MS, SIM_SNAP, simHostTrimBoot, simHostBootBytes, simHostWorldOp, simHostIsWorldOp, simHostMakeWorld, simHostProbe, simHostPlace,
                     simHostFetchBoot, simHostPlain, makeSimHost, simHostDefSig, simHostBody, simHostSource, simHostStart,
                     simDmgHop, simDmgHop0, simDmgPieces, simDmgSets, SIM_DMG_SET_S };
