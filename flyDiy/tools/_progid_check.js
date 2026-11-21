// _progid_check.js - GATE PROGRAMS, part 6: PROGRAM IDENTITY (PERF-TRACE, 22 Nov 2026). Run by _program_check.js.
//
// The real three (vendor/three.min.js r186) on the fake WebGL2, with the game's own flight recorder and
// src/viewer/program_id.js hooked as the page hooks them. What it holds:
//   6a  THE LINK IS TIED. Every gl.linkProgram has a row, every row a three.js program (name, type, key), and the
//       row's source fingerprint is the hash of the very text that link compiled. A three upgrade that moves the
//       rule (info.programs.push after the constructor's link; compile() returning its materials;
//       properties.get(material).programs) turns this red instead of the census quietly wrong.
//   6b  THE OWNER IS THE DECLARED ONE. Both forms of the declaration, a clone, a warm-up twin, a shared material with
//       two owners, two materials on one program; an undeclared material is UNOWNED and counted. The shadow pass's
//       depth set, warmed by PROG_WARM.depthVariants, is owned by the casters it stands for.
//   6c  THE OWNER IS NEVER IN THE PROGRAM. With and without declarations: the same cache keys, the same sources.
//   6d  A LATE PROGRAM IS SEEN. A material that first meets the renderer in a frame: ctx 'render', its object's path.
//   6e  THE BRACKET IS THREE'S OWN POLL. A driver that answers "not linked yet" k times: last-pending and
//       first-ready are the times three asked; the registry itself asks the context NOTHING (calls counted).
//   6f  DRAWN BEFORE READY is flagged, and a warmed program never drawn has no first draw.
//   6g  THE COST. The same boot with and without the registry: the links, the keys, the draws identical; its own time.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const { makeGL, THREE_SRC, ROOT } = require('./_fake_gl.js');

// a boot as _fake_gl.boot(), on a context that keeps what is assigned to it (the recorder wraps gl.linkProgram ...),
// with a driver whose links take `pendPolls` status polls, a clock the test owns, and every GL call counted
function boot(opt) {
  opt = opt || {};
  const links = [];
  const { gl: base, WebGL2RenderingContext, canvas } = makeGL({ links });
  const over = new Map(), calls = Object.create(null), pend = new WeakMap();
  const T = { now: 1000 };
  const count = k => { calls[k] = (calls[k] || 0) + 1; };
  const baseParam = base.getProgramParameter, baseLink = base.linkProgram, baseUse = base.useProgram;
  over.set('linkProgram', p => { count('linkProgram'); pend.set(p, opt.pendPolls || 0); return baseLink(p); });
  over.set('getProgramParameter', (p, pn) => { count('getProgramParameter');
    if (pn === 0x91B1) { count('poll'); const k = pend.get(p) || 0; if (k > 0) { pend.set(p, k - 1); return false; } return true; }
    return baseParam(p, pn); });
  // the first query of a program still linking (three's first use asks its info log, then its link status): the driver
  // holds the page until the link is done (40 ms here)
  over.set('getProgramInfoLog', p => { count('getProgramInfoLog'); if ((pend.get(p) || 0) > 0) { count('blockingStatus'); T.now += 40; pend.set(p, 0); } return ''; });
  over.set('useProgram', p => { count('useProgram'); return baseUse ? baseUse(p) : undefined; });
  over.set('getError', () => { count('getError'); return 0; });
  const gl = new Proxy(base, { get(t, p) { return over.has(p) ? over.get(p) : t[p]; }, set(t, p, v) { over.set(p, v); return true; },
    getPrototypeOf() { return WebGL2RenderingContext.prototype; } });
  const ctx = { console, performance: { now: () => T.now, timeOrigin: 0 }, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, WebGL2RenderingContext,
    navigator: { userAgent: 'node' }, location: { search: opt.search || '', pathname: '/gate' } };
  ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx); vm.runInContext(THREE_SRC, ctx);
  const THREE = ctx.THREE;
  canvas.getContext = () => gl;
  const renderer = new THREE.WebGLRenderer({ context: gl, canvas, reversedDepthBuffer: true });
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const load = rel => vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/^'use strict';/m, ''), ctx, { filename: rel });
  load(path.join('src', 'viewer', 'matlib.js'));
  load(path.join('src', 'viewer', 'shader_warm.js'));
  if (!opt.noRegistry) load(path.join('src', 'viewer', 'program_id.js'));
  load(path.join('src', 'viewer', 'flight_recorder.js'));
  const REC = ctx.FLIGHT_REC.make({ now: () => T.now, noGpu: true });
  if (!opt.noRecorder) REC.attach(renderer, null);
  return { THREE, renderer, links, ctx, calls, T, REC, PROGRAMS: ctx.PROGRAMS, PID: REC.rec.pid, gl };
}

// the scene: declared both ways, a clone, a twin's source, a shared material, two materials on one program, one undeclared
function world(B, declare) {
  const { THREE, ctx } = B, P = ctx.PROGRAMS;
  const own = (m, o) => (declare && P ? P.own(m, o) : m);
  const sc = new THREE.Scene(); sc.name = 'world';
  const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sc.add(sun); sc.add(new THREE.HemisphereLight());
  sc.fog = new THREE.Fog(0xaabbcc, 100, 5000);
  const tex = new THREE.Texture(); tex.image = { width: 4, height: 4 };
  const box = new THREE.BoxGeometry();
  const put = (name, m, parent) => { const o = new THREE.Mesh(box, m); o.name = name; o.castShadow = true; o.receiveShadow = true; (parent || sc).add(o); return o; };
  const town = new THREE.Group(); town.name = 'town'; sc.add(town);
  const M = {};
  M.wall = new THREE.MeshStandardMaterial(declare ? { map: tex, userData: { progOwner: 'town / houses / walls' } } : { map: tex });                 // the inline form
  M.roof = own(new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }), 'town / houses / roofs');                                       // the call
  M.leaf = own(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }), 'forest / near trees / leaves');
  M.leaf2 = M.leaf.clone(); M.leaf2.name = 'leafB';                                                                                                 // a clone: its source's owner
  M.shared = own(own(new THREE.MeshBasicMaterial({ color: 0x336699 }), 'ui / markers'), 'pattern / legs');                                         // two owners
  M.same1 = own(new THREE.MeshLambertMaterial({ color: 1 }), 'props / crates'); M.same1.name = 'crate';
  M.same2 = own(new THREE.MeshLambertMaterial({ color: 2 }), 'props / barrels'); M.same2.name = 'barrel';                                           // one program, two names
  M.anon = new THREE.MeshPhongMaterial({ color: 3 });                                                                                              // never declared
  M.hook = own(new THREE.MeshStandardMaterial({ color: 4 }), 'terrain / island ground / splat');
  M.hook.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.rgb *= 0.99;'); };
  M.hook.customProgramCacheKey = () => 'gate-splat';
  put('wall', M.wall, town); put('roof', M.roof, town); put('leaf', M.leaf); put('leafB', M.leaf2); put('marker', M.shared); put('crate', M.same1); put('barrel', M.same2);
  put('anon', M.anon); put('ground', M.hook);
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 1000); cam.position.set(0, 2, 8); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); sc.updateMatrixWorld(true);
  return { sc, cam, M, box, put };
}
// the boot's compile, as app.js makes it: the scene, then the shadow pass's depth set in the lit scene's lights
function warm(B, Wd) {
  const { THREE, renderer: R, ctx } = B;
  R.compile(Wd.sc, Wd.cam);
  const { helper } = ctx.PROG_WARM.depthVariants(THREE, R, [Wd.sc]);
  R.setRenderTarget(new THREE.WebGLRenderTarget(4, 4)); ctx.PROG_WARM.fogless(Wd.sc, () => R.compile(helper, Wd.cam, Wd.sc)); R.setRenderTarget(null);
}
const fnvHex = (P, s) => ('0000000' + (P.fnv(s) >>> 0).toString(16)).slice(-8);

function run(ok) {
  // ---- 6a / 6b: the link tied, the owner declared ---------------------------------------------------------
  {
    const B = boot(), Wd = world(B, true), P = B.PROGRAMS;
    warm(B, Wd);
    const rows = P.table([Wd.sc]);
    ok(!!B.PID && rows.length === B.links.length && rows.length > 10 && rows.every((r, i) => r.n === i + 1),
       '6a every gl.linkProgram has a row, numbered as the recorder numbers its link events', rows.length + ' rows, ' + B.links.length + ' links');
    const live = B.renderer.info.programs;
    ok(rows.every(r => r.three && r.type && r.key) && live.every(p => rows.some(r => r.id === p.id && r.name === (p.name || '') && r.type === p.type)),
       '6a every row is a three.js program (type, name, key) and every live three.js program has its row', live.length + ' live programs');
    const fpOK = rows.every((r, i) => r.fp === fnvHex(P, B.links[i].vs) + fnvHex(P, B.links[i].fs) && r.vs === B.links[i].vs.length && r.fs === B.links[i].fs.length);
    ok(fpOK, '6a a row\'s fingerprint and sizes are those of the very source its link compiled');
    const by = o => rows.filter(r => r.own.indexOf(o) >= 0);
    ok(by('town / houses / walls').length >= 1 && by('town / houses / roofs').length >= 1 && by('terrain / island ground / splat').length >= 1,
       '6b the inline form (userData.progOwner in the constructor) and PROGRAMS.own() both name the material\'s programs');
    ok(by('forest / near trees / leaves').some(r => r.mat.join().indexOf('leafB') >= 0 || r.heldNames && r.heldNames.indexOf('leafB') >= 0),
       '6b a clone is its source\'s (Material.copy carries userData)');
    const sh = rows.find(r => r.own.indexOf('ui / markers') >= 0);
    ok(!!sh && sh.own.indexOf('pattern / legs') >= 0, '6b a material with two owners gives its program both');
    const two = rows.find(r => r.own.indexOf('props / crates') >= 0);
    ok(!!two && two.own.indexOf('props / barrels') >= 0 && two.held === 2 && two.heldNames.length === 2,
       '6b two materials on ONE program: both owners, and the census counts 2 holders under 2 names (three writes the first one\'s name into the source)', two ? two.heldNames.join(' / ') : undefined);
    const un = rows.filter(r => !r.own.length);
    ok(un.length >= 1 && un.every(r => /MeshPhongMaterial/.test(r.mat.join()) || r.type === 'MeshPhongMaterial') && B.PID.summary().unowned === un.length,
       '6b an undeclared material\'s programs are UNOWNED, and counted', un.length + ' unowned: ' + un.map(r => r.type).join(', '));
    const depth = rows.filter(r => r.type === 'MeshDepthMaterial');
    ok(depth.length >= 2 && depth.every(r => r.own.length > 0 && r.own.some(o => /^shadow pass \/ depth <- /.test(o))),
       '6b the shadow pass\'s depth programs are owned by the casters they are warmed for', depth.length + ' depth programs: ' + (depth[0] ? depth[0].own[0] : ''));
    ok(rows.every(r => r.ctx === 'compile') && rows.some(r => /4x4$/.test(r.rt)) && rows.some(r => r.rt === 'canvas'), '6a each row says how it was made (compile) and into which target');
    const g = rows.find(r => r.own.indexOf('terrain / island ground / splat') >= 0 && r.type === 'MeshStandardMaterial');
    ok(!!g && Array.isArray(g.defs) && g.defs.indexOf('USE_FOG') >= 0 && g.defs.indexOf('USE_SHADOWMAP') >= 0 && !g.defs.some(d => /^SHADER_(NAME|TYPE)/.test(d)),
       '6a the variant is readable: the #defines of three\'s prefix', g && g.defs ? g.defs.slice(0, 6).join(' ') + ' ... (' + g.defs.length + ')' : undefined);
    // the events: one 'prog' a program with its owner, its link number the 'link' event's
    const ev = B.REC.events, progs = ev.filter(e => e[1] === 'prog'), linksEv = ev.filter(e => e[1] === 'link');
    ok(progs.length === rows.length && linksEv.length === rows.length && progs.every(e => linksEv.some(l => l[3] === e[3].n)) && progs.some(e => e[3].own === 'town / houses / walls'),
       '6a the log has one prog event a program (owner, fingerprint, step) joined to its link event by number');
    // the first frame after the warm-up links nothing; every program it draws with gets its first draw
    const n0 = B.links.length; B.renderer.render(Wd.sc, Wd.cam);
    const after = P.table();
    ok(B.links.length === n0 && after.filter(r => r.useT !== null).length >= 8 && after.every(r => !r.blocked) && ev.filter(e => e[1] === 'proguse').length === after.filter(r => r.useT !== null).length,
       '6f the first frame links nothing more; each program it draws with has its first draw logged, none before it was ready', after.filter(r => r.useT !== null).length + ' drawn of ' + after.length);
  }
  // ---- 6c: the owner is never in the program -----------------------------------------------------------
  {
    const sig = declare => { const B = boot(), Wd = world(B, declare); warm(B, Wd); B.renderer.render(Wd.sc, Wd.cam);
      return { keys: B.renderer.info.programs.map(p => p.cacheKey).sort(), srcs: B.links.map(l => l.vs + '\u0000' + l.fs).sort() }; };
    const a = sig(true), b = sig(false);
    ok(a.keys.length > 10 && JSON.stringify(a.keys) === JSON.stringify(b.keys) && JSON.stringify(a.srcs) === JSON.stringify(b.srcs),
       '6c declared or not: the same program keys and the same sources (the owner is in neither)', a.keys.length + ' programs');
    ok(!a.srcs.some(s => /progOwner|town \/ houses/.test(s)) && !a.keys.some(k => /progOwner|town \/ houses/.test(k)), '6c no owner string in any key or source');
  }
  // ---- 6d: a late program ---------------------------------------------------------------------------------
  {
    const B = boot(), Wd = world(B, true), P = B.PROGRAMS; warm(B, Wd); B.renderer.render(Wd.sc, Wd.cam);
    const n0 = B.links.length;
    const grp = new B.THREE.Group(); grp.name = 'pier'; Wd.sc.add(grp);
    Wd.put('lamp', P.own(new B.THREE.MeshToonMaterial({ color: 5 }), 'pier / lamps'), grp);       // never compiled: its first frame links it
    Wd.put('stray', new B.THREE.MeshMatcapMaterial({ color: 6 }), grp);                             // and one nobody declared
    Wd.sc.updateMatrixWorld(true); B.renderer.render(Wd.sc, Wd.cam);
    const late = P.table().slice(n0);
    const lamp = late.find(r => r.own.indexOf('pier / lamps') >= 0), stray = late.find(r => r.type === 'MeshMatcapMaterial');
    ok(late.length >= 2 && !!lamp && lamp.ctx === 'render' && /pier\/lamp$/.test(lamp.obj.join()) && lamp.useT !== null,
       '6d a program first made by a frame is LATE: made in a render, owned, with the object that drew it', lamp ? lamp.ctx + ' ' + lamp.obj.join() : late.length + ' late');
    ok(!!stray && !stray.own.length && /pier\/stray$/.test(stray.obj.join()), '6d a late program nobody declared is unowned, and the row still says which object drew it', stray ? stray.obj.join() : undefined);
    const lateDepth = late.filter(r => r.type === 'MeshDepthMaterial');
    ok(lateDepth.every(r => r.ctx === 'shadow' && r.own.indexOf('three / shadow pass / depth') >= 0), '6d a depth program the warm-up missed is named as the shadow pass\'s (made in the shadow pass)', lateDepth.length + ' late depth');
  }
  // ---- 6e: the bracket is three's own poll; the registry asks the context nothing --------------------
  {
    const run1 = (noRegistry) => { const B = boot({ pendPolls: 3, noRegistry }), Wd = world(B, true);
      B.renderer.compile(Wd.sc, Wd.cam);
      const progs = B.renderer.info.programs.slice();
      // three's poll, as compileAsync / the shaders' screen make it: every program asked each tick, 10 ms apart
      for (let k = 0; k < 6; k++) { B.T.now += 10; for (const p of progs) p.isReady(); }
      return { B, Wd, progs }; };
    const A = run1(false), Z = run1(true);
    const rows = A.B.PROGRAMS.table();
    const t0 = 1000;
    ok(rows.length === A.progs.length && rows.every(r => r.polls === 3 && r.pendT === t0 + 30 && r.readyT === t0 + 40 && r.via === 'poll'),
       '6e a link the driver finishes after 3 polls: last seen pending and first seen ready are the times three asked', rows[0] ? rows[0].pendT + ' / ' + rows[0].readyT : undefined);
    ok(JSON.stringify(A.B.calls) === JSON.stringify(Z.B.calls) && A.B.calls.poll === A.progs.length * 4 && !A.B.calls.getError,
       '6e with the registry the context is asked exactly what it is asked without it (no status poll, no getError added)', JSON.stringify(A.B.calls));
    const ready = A.B.REC.events.filter(e => e[1] === 'progready');
    ok(ready.length === rows.length && ready.every(e => e[2] === 40 && e[3][1] === t0 + 30 && e[3][2] === 'poll'), '6e a progready event a program: ms since its link, the last pending time, how it was seen');
    ok(A.B.PROGRAMS.awaiting(t0 + 20).length === rows.length && A.B.PROGRAMS.awaiting(t0 + 40).length === 0, '6e awaiting(t): the programs submitted and not yet seen ready at t');
    // drawn before ready: a draw of a program still linking waits on it (the recorder's linkwait), and the row says so
    const C = boot({ pendPolls: 1e9 }), Wc = world(C, true);
    C.renderer.compile(Wc.sc, Wc.cam); C.T.now += 50; C.renderer.render(Wc.sc, Wc.cam);
    const rc = C.PROGRAMS.table(), drawn = rc.filter(r => r.useT !== null);
    const lw = C.REC.events.filter(e => e[1] === 'linkwait');
    ok(drawn.length >= 8 && drawn.every(r => r.blocked && r.via === 'status' && r.waitMs === 40 && r.readyT === r.useT) && rc.filter(r => r.useT === null).every(r => !r.blocked)
       && lw.length === drawn.length && lw.every(e => drawn.some(r => r.n === e[3])),
       '6f a program a draw WAITED on is flagged with the ms, its readiness ended by that status query, and the recorder\'s linkwait event names it', drawn.length + ' held draws, ' + (drawn[0] ? drawn[0].waitMs : '?') + ' ms each');
  }
  // ---- 6g: the cost -----------------------------------------------------------------------------------------
  {
    const one = (o) => { const B = boot(o), Wd = world(B, true); const t = process.hrtime.bigint(); warm(B, Wd); for (let i = 0; i < 200; i++) B.renderer.render(Wd.sc, Wd.cam);
      return { B, ms: Number(process.hrtime.bigint() - t) / 1e6, keys: B.renderer.info.programs.map(p => p.cacheKey).sort().join('\n'), links: B.links.length, uses: B.calls.useProgram }; };
    // (interleaved, the best of 4 each: a boot is a fresh vm context, and the first ones pay three's own lazy compile)
    const O = [{}, { search: '?progid=0' }, { search: '?progid=lite' }], bestOf = [null, null, null];
    for (let i = 0; i < 4; i++) O.forEach((o, k) => { const r = one(o); if (!bestOf[k] || r.ms < bestOf[k].ms) bestOf[k] = r; });
    const on = bestOf[0], off = bestOf[1], lite = bestOf[2];
    ok(off.B.PID === null && on.keys === off.keys && on.links === off.links && on.uses === off.uses && lite.keys === on.keys,
       '6g ?progid=0 leaves the page unhooked: the same links, keys and program switches on, off and lite', on.links + ' links, ' + on.uses + ' switches');
    const S = on.B.PID.summary();
    // the hash on its own, on the real clock: every source of this boot, the best of 5
    const srcs = []; for (const l of on.B.links) srcs.push(l.vs, l.fs);
    const chars = srcs.reduce((a, s) => a + s.length, 0); let hb = Infinity;
    for (let i = 0; i < 5; i++) { const t = process.hrtime.bigint(); for (const s of srcs) { on.B.PROGRAMS.fnv(s); on.B.PROGRAMS.defsOf(s); } hb = Math.min(hb, Number(process.hrtime.bigint() - t) / 1e6); }
    const perProg = hb / on.links, nsChar = hb * 1e6 / chars;
    ok(nsChar < 12 && S.resolves <= 4, '6g the registry\'s own cost: the hash of both sources a link, an owner look-up a compile that made programs',
       perProg.toFixed(3) + ' ms a program (' + Math.round(chars / on.links / 1024) + ' KB of GLSL, ' + nsChar.toFixed(1) + ' ns a char); ' + S.resolves + ' owner look-ups; warm + 200 frames: on ' + on.ms.toFixed(0) + ' ms, off ' + off.ms.toFixed(0) + ' ms, lite ' + lite.ms.toFixed(0) + ' ms');
    ok(lite.B.PID.table().every(r => r.fp === null && r.defs === null && r.vs > 0), '6g ?progid=lite: no source hash, no defines; the sizes and the owners stay');
  }
}
module.exports = { run, boot, world, warm };
if (require.main === module) { let fails = 0; run((c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; }); process.exit(fails ? 1 : 0); }
