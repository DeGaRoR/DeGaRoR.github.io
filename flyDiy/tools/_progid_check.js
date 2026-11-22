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
  // a buffer's creation takes the driver `upMs` (the recorder's 'gpuup': the render slot's new GPU data)
  const baseBuf = base.bufferData;
  over.set('bufferData', function () { count('bufferData'); if (opt.upMs) T.now += opt.upMs; return baseBuf.apply(null, arguments); });
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
    // ... and the axes three writes into the BODY, after the prefix: the lights and shadows as array sizes, the tone mapping,
    // the output transfer, OPAQUE (this scene: one shadow-casting directional light and a hemisphere light, ACES, the canvas)
    ok(!!g && g.defs.indexOf('LIGHTS=1.0.0.1') >= 0 && g.defs.indexOf('SHADOWS=1.0.0') >= 0 && g.defs.indexOf('TONE=ACESFilmic') >= 0 && g.defs.indexOf('OUT=sRGB') >= 0 && g.defs.indexOf('OPAQUE') >= 0,
       '6a the variant carries the body\'s axes too: light and shadow counts, tone mapping, output transfer, OPAQUE', g && g.body ? g.body.join(' ') : 'no body tags');
    { const tgt = rows.filter(r => r.type === 'MeshDepthMaterial' && r.body), lit = rows.filter(r => r.type === 'MeshStandardMaterial' && r.body);
      ok(lit.length >= 4 && lit.every(r => r.body.some(t => /^LIGHTS=/.test(t))) && tgt.every(r => !r.body.some(t => /^TONE=/.test(t))) && B.PID.summary().bodies === rows.length && B.PID.summary().bodiesWaiting === 0,
         '6a every lit program has its light counts; a depth program (drawn into a shadow map) has no tone mapping; every text was read when the table was asked', B.PID.summary().bodies + ' texts read'); }
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
  // ---- 6h: what a frame's first draw cost: the first use of a program, the new GPU data ---------------------
  {
    const C = boot({ pendPolls: 1e9, upMs: 2 }), Wc = world(C, true);
    C.renderer.compile(Wc.sc, Wc.cam); C.T.now += 50;
    C.REC.begin(C.T.now, null); C.renderer.render(Wc.sc, Wc.cam); C.REC.end(true, null);
    const rc = C.PROGRAMS.table(), drawn = rc.filter(r => r.useT !== null), uses = C.REC.events.filter(e => e[1] === 'proguse');
    ok(drawn.length >= 8 && drawn.every(r => r.firstUseMs >= 40) && uses.length === drawn.length && uses.every(e => e[2] >= 40),
       '6h a program\'s FIRST USE has its cost: from three\'s first status query of it to the switch (here the 40 ms its link held the draw)', drawn.length + ' first uses, ' + (drawn[0] ? drawn[0].firstUseMs : '?') + ' ms');
    const up = C.REC.events.filter(e => e[1] === 'gpuup');
    ok(up.length === 1 && up[0][3].at === 'loop' && up[0][3].buf[0] >= 2 && up[0][3].buf[1] === up[0][3].buf[0] * 2 && up[0][3].buf[2] > 0 && up[0][2] === up[0][3].buf[1] && C.calls.bufferData === up[0][3].buf[0],
       '6h the frame\'s new GPU data is an event: the buffers created, their ms and KB (the calls themselves unchanged)', up[0] ? JSON.stringify(up[0][3]) : 'no gpuup event');
    // a frame that creates nothing says nothing
    const n0 = C.REC.events.length; C.T.now += 16; C.REC.begin(C.T.now, null); C.renderer.render(Wc.sc, Wc.cam); C.REC.end(true, null);
    ok(C.REC.events.slice(n0).every(e => e[1] !== 'gpuup' && e[1] !== 'proguse' && e[1] !== 'prog'), '6h the next frame, which makes nothing new, logs no program and no GPU-data event');
  }
  // ---- 6i: the uploads of a steady frame, by owner (?recup=1; off by default) ---------------------------------
  {
    const B = boot({ search: '?recup=1' }), Wd = world(B, true), THREE = B.THREE; warm(B, Wd);
    const T = B.REC.rec.traffic;
    ok(!!T && T.wrapped.every(Boolean), '6i ?recup=1 wraps the three needsUpdate setters (BufferAttribute, InterleavedBuffer, Texture)', T ? JSON.stringify(T.wrapped) : 'no traffic');
    // a mesh of its own whose positions change every frame, a table texture marked every frame with the SAME bytes, a normal marked once
    const g = new THREE.BoxGeometry(), wing = Wd.put('wing', Wd.M.hook), tab = new THREE.DataTexture(new Uint8Array(64 * 64 * 4), 64, 64);
    wing.geometry = g; Wd.M.roof.userData.table = tab; Wd.sc.updateMatrixWorld(true);
    const pos = g.attributes.position, v0 = pos.version, t0 = tab.version;
    for (let f = 0; f < 96; f++) { B.T.now += 16; B.REC.begin(B.T.now, null); pos.array[0] = f; pos.needsUpdate = true; tab.needsUpdate = true; if (f === 5) g.attributes.normal.needsUpdate = true;
      B.renderer.render(Wd.sc, Wd.cam); B.REC.end(true, null); }
    ok(pos.version === v0 + 96 && tab.version === t0 + 96, '6i the wrapped setters still do three\'s own work (the versions move as before)', (pos.version - v0) + ' / ' + (tab.version - t0));
    const U = B.PROGRAMS.uploads(), rp = U && U.rows.find(r => r.what === 'position' && /wing$/.test(r.at)), rt = U && U.rows.find(r => r.kind === 'tex' && /table/.test(r.what)), rn = U && U.rows.find(r => r.what === 'normal' && /wing$/.test(r.at));
    ok(!!rp && rp.owner === 'terrain / island ground / splat' && rp.frames === 96 && rp.per100 >= 99 && rp.KB === Math.round(pos.array.byteLength / 1024) && rp.sampled >= 2 && rp.unchanged === 0,
       '6i an attribute rewritten every frame: its mesh, its material\'s owner, every frame, its bytes, its content CHANGED', rp ? JSON.stringify(rp) : 'no row');
    ok(!!rt && rt.owner === 'town / houses / roofs' && rt.frames === 96 && rt.sampled >= 2 && rt.unchanged === rt.sampled && rt.KB === 16,
       '6i a table texture marked every frame with the same bytes: named by the material that holds it, and flagged UNCHANGED', rt ? JSON.stringify(rt) : 'no row');
    ok(!!rn && rn.frames === 1, '6i an attribute marked once is counted once', rn ? rn.frames : 'no row');
    ok(U.frames >= 96 && U.namedMB > 0 && U.namedMB <= U.MB, '6i the table says how many frames it covers and how much of the bytes it could name', U.frames + ' frames, ' + U.namedMB + ' of ' + U.MB + ' MB');
    // the default: nothing wrapped, nothing kept
    const D = boot({}), d = Object.getOwnPropertyDescriptor(D.THREE.Texture.prototype, 'needsUpdate');
    ok(D.REC.rec.traffic == null && D.PROGRAMS.uploads() === null && !/mark\(/.test(String(d.set)), '6i without the switch the setters are three\'s own and no table exists');
    const L = JSON.parse(B.REC.logParts().join(''));
    ok(L.uploads && L.uploads.rows.length >= 3 && JSON.parse(D.REC.logParts().join('')).uploads === null, '6i the saved log carries the table (null without the switch)');
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
// ---- 7: EVERY MATERIAL MADE IN THE GAME'S SOURCE SAYS WHOSE IT IS (the retrofit, and the rule for every new one) ----
// tools/program_sites.js reads src/ and the generators the build ships from tools/: a site with no declaration fails
// here with its file and line. This is how a new shader program "identifies itself": its material cannot be made
// without an owner. (The census of the standard boots - tools/perf/program_owners.json, GATE PROGRAMS 8 - is the other
// half: a material made some other way, or whose userData is wiped, shows there as an unowned program.)
function runSites(ok) {
  const PS = require('./program_sites.js'), R = PS.scan(), S = R.sites;
  const un = S.filter(s => !s.how), tagged = S.filter(s => s.how === 'tagged'), bad = S.filter(s => s.how && s.how !== 'tagged' && !PS.ownerOK(s.owner));
  ok(S.length > 250, '7 the scan finds the game\'s material sites (src/ and the shipped generators)', S.length + ' sites in ' + new Set(S.map(s => s.file)).size + ' files');
  ok(un.length === 0, '7 every material site declares its owner (userData.progOwner, MATLIB\'s owner argument, or a declaration just after)',
     un.length ? un.length + ' UNDECLARED: ' + un.slice(0, 12).map(s => s.file + ':' + s.line).join(', ') + (un.length > 12 ? ' ...' : '') : S.length - tagged.length + ' declared, ' + tagged.length + ' tagged');
  ok(bad.length === 0, '7 every owner reads feature / system / variant, its feature one of the table\'s (' + PS.FEATURES.length + ')',
     bad.length ? bad.slice(0, 8).map(s => s.file + ':' + s.line + ' "' + s.owner + '"').join(', ') : undefined);
  ok(tagged.length <= 12, '7 the sites declared by a tag (a comment: the owner is set where the scanner cannot follow) stay few, and are listed', tagged.map(s => s.file + ':' + s.line).join(', ') || 'none');
  // the declaration never reaches a program: no source file writes an owner into a material's name, key or shader text
  const fs2 = require('fs'), leaks = [];
  for (const f of new Set(S.map(s => s.file))) { const src = fs2.readFileSync(path.join(ROOT, /^tools\//.test(f) ? f : path.join('src', f)), 'utf8');
    if (/customProgramCacheKey[^\n]*progOwner|\.name\s*=[^\n;]*progOwner|SHADER_NAME[^\n]*progOwner/.test(src)) leaks.push(f); }
  ok(leaks.length === 0, '7 no file puts progOwner into a cache key, a material name or a shader', leaks.join(', ') || undefined);
}
// ---- 8: THE CENSUS OF THE STANDARD BOOTS (tools/perf/program_owners.json; `program_report.js <log> --pin <boot>`) ----
// The file is written from a real boot's flight log (A0's box). Here, in node: no boot may have an unowned program, and
// a feature whose program count rose between two pins has its written reason in the file. A boot not pinned yet is
// SAID (it cannot be judged), never passed in silence: the line lists which of the three standard boots are missing.
function runCensus(ok) {
  const PR = require('./program_report.js'), STD = ['garage-cold', 'world-noon', 'world-night'];
  let P = null; try { P = JSON.parse(fs.readFileSync(PR.PIN_FILE, 'utf8')); } catch (e) {}
  const have = P ? STD.filter(b => P.boots && P.boots[b]) : [];
  ok(true, '8 the standard boots\' census: ' + (have.length ? have.map(b => b + ' ' + P.boots[b].programs + ' programs (' + P.boots[b].build + ')').join(', ') : 'none pinned') +
     (have.length < STD.length ? ' - NOT PINNED YET: ' + STD.filter(b => have.indexOf(b) < 0).join(', ') + ' (a boot on the box, then program_report.js --pin)' : ''));
  for (const b of have) {
    const C = P.boots[b];
    ok(C.unowned === 0, '8 ' + b + ': no program without an owner', C.unowned ? C.unowned + ' UNOWNED, e.g. ' + (C.unownedList || []).slice(0, 4).map(u => '#' + u.n + ' ' + u.type + ' ' + ((u.mat || [])[0] || '') + ' @' + ((u.obj || [])[0] || '')).join('; ') : C.programs + ' programs, ' + Object.keys(C.byFeature).length + ' features');
    if (C.previous) {
      const rose = Object.keys(C.byFeature).filter(f => C.byFeature[f] > (C.previous.byFeature[f] || 0));
      const missing = rose.filter(f => !(P.reasons || []).some(r => r.boot === b && r.feature === f && r.to === C.byFeature[f] && r.why));
      ok(missing.length === 0, '8 ' + b + ': every feature whose program count rose since the pin before has its written reason', missing.length ? missing.map(f => f + ' ' + (C.previous.byFeature[f] || 0) + ' -> ' + C.byFeature[f]).join(', ') : rose.length + ' rose, each with a reason');
    }
  }
}
// ---- 9: THE WORKERS SAY WHO THEY ARE, AND THE LOG KEEPS THEIR TRAFFIC (PERF-TRACE 5) ----------------------------------
// A loading step that waits on a worker read "not proven": the recorder now counts every Worker the page makes
// (flight_recorder.js: THE WORKERS). 9a: every `new Worker(` of the game's source gives it a name (the constructor's
// standard `name` option), feature first. 9b: the wrapper on a fake page - the worker is the page's own object, its
// messages pass untouched, the traffic lands in buckets, a slow reply handler is an event, and ?recwk=0 / ?rec=0 leave
// the page's Worker alone. 9c: the timeline names a step that ends with a worker's reply, and never a worker in
// constant traffic.
function runWorkers(ok) {
  const PS = require('./program_sites.js');
  // 9a
  const sites = [];
  for (const p of PS.walk(PS.SRC, []).sort().concat(PS.shipped())) {
    const raw = fs.readFileSync(p, 'utf8'), code = PS.codeOnly(raw), re = /\bnew\s+(?:[A-Za-z_$][\w$]*\.)?Worker\s*\(/g; let m;
    while ((m = re.exec(code))) { const open = m.index + m[0].length - 1, close = PS.closeOf(raw, open), args = close > open ? raw.slice(open + 1, close) : '';
      const nm = /,\s*\{\s*name:\s*'([^']+)'/.exec(args);
      sites.push({ file: path.relative(ROOT, p).replace(/\\/g, '/'), line: raw.slice(0, m.index).split('\n').length, name: nm ? nm[1] : null }); }
  }
  const un = sites.filter(s => !s.name), badF = sites.filter(s => s.name && PS.FEATURES.indexOf(s.name.split(' / ')[0]) < 0);
  ok(sites.length >= 10, '9a the scan finds the game\'s Worker sites (src/ and the shipped tools)', sites.length + ' sites in ' + new Set(sites.map(s => s.file)).size + ' files');
  ok(un.length === 0, '9a every Worker is made with a name (new Worker(url, { name: \'feature / system / what\' }))', un.length ? 'UNNAMED: ' + un.map(s => s.file + ':' + s.line).join(', ') : sites.map(s => s.name).join(' | '));
  ok(badF.length === 0, '9a every worker\'s name begins with one of the table\'s features', badF.map(s => s.file + ':' + s.line + ' "' + s.name + '"').join(', ') || undefined);

  // 9b
  const page = search => {
    const T = { now: 1000 }, made = [];
    class FakeWorker {
      constructor(url, opts) { this.url = url; this.opts = opts; this.argc = arguments.length; this.L = []; this.on = null; this.posted = []; this.dead = 0; made.push(this); }
      postMessage(m, tr) { this.posted.push([m, tr]); return 'posted'; }
      terminate() { this.dead++; }
      addEventListener(k, f) { if (k === 'message') this.L.push(f); }
      get onmessage() { return this.on; } set onmessage(f) { this.on = f; }
      reply(data) { const e = { data }; for (const f of this.L) f.call(this, e); if (this.on) return this.on.call(this, e); }
    }
    const ctx = { console, performance: { now: () => T.now, timeOrigin: 0 }, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
      navigator: { userAgent: 'node' }, location: { search: search || '', pathname: '/gate' }, Worker: FakeWorker };
    ctx.globalThis = ctx; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'viewer', 'flight_recorder.js'), 'utf8').replace(/^'use strict';/m, ''), ctx, { filename: 'flight_recorder.js' });
    return { ctx, T, made, FakeWorker, FR: ctx.FLIGHT_REC };
  };
  {
    const P = page(''), { ctx, T, FR } = P;
    ok(ctx.Worker !== P.FakeWorker && ctx.Worker.prototype === P.FakeWorker.prototype, '9b the page\'s Worker is wrapped, on the same prototype');
    const w = new ctx.Worker('blob:a', { name: 'town / houses / builder' }), bare = new ctx.Worker('blob:b');
    ok(w instanceof P.FakeWorker && w === P.made[0] && w.opts.name === 'town / houses / builder' && bare.argc === 1,
       '9b new Worker() gives the page\'s own worker object, made with the very arguments of the site (one argument stays one)');
    const seen = []; const h = function (e) { seen.push([this === w, e.data]); if (e.data === 'slow') T.now += 20; return 'handled'; };
    w.onmessage = h;
    const msg = { job: 1 }, tr = [new ArrayBuffer(8)];
    const r1 = w.postMessage(msg, tr); T.now = 1100; w.postMessage({ job: 2 });
    ok(r1 === 'posted' && w.posted.length === 2 && w.posted[0][0] === msg && w.posted[0][1] === tr, '9b a message is passed on untouched: the same object, the same transfer list, the same return');
    T.now = 1600; const back = w.reply('slow'); T.now = 5000; w.reply('quick'); T.now = 5100; w.terminate(); w.terminate();
    ok(w.onmessage === h && back === 'handled' && seen.length === 2 && seen[0][0] && seen[0][1] === 'slow', '9b the site\'s handler is still its own: read back as set, called once a reply with the worker as this, its return kept');
    ok(w.dead === 2, '9b terminate() reaches the worker each time it is called');
    const H = FR.rec.header().workers, L = JSON.parse(FR.rec.logParts().join('')).workers, a = L && L[0], b = L && L[1];
    ok(Array.isArray(H) && H.length === 2 && H[0].name === 'town / houses / builder' && H[1].name === 'UNNAMED' && H[0].io === undefined,
       '9b the header lists the workers by name (a site without a name reads UNNAMED), without the buckets', H ? H.map(x => x.name).join(' | ') : 'none');
    ok(!!a && a.sent === 2 && a.received === 2 && a.maxOpen === 2 && a.open === 0 && a.handlerMs === 20 && a.handlerMaxMs === 20 && a.t === 1000 && a.firstSent === 1000 && a.lastReply === 5000 && a.end === 5100,
       '9b a worker\'s row: made, first sent, last reply, ended; sent, received, the most requests out, the main thread\'s ms in its handler', a ? JSON.stringify(Object.assign({}, a, { io: undefined })) : 'no row');
    ok(!!a && a.bucketMs === 250 && JSON.stringify(a.io) === JSON.stringify([4, 2, 0, 0, 2, 6, 0, 1, 20, 1, 20, 0, 1, 0, 0]),
       '9b its traffic in 250 ms buckets: [bucket, sent, received, handler ms, still out]', a ? JSON.stringify(a.io) : undefined);
    ok(!!b && b.sent === 0 && b.io.length === 0 && b.end === null, '9b a worker that never spoke has an empty row');
    const E = JSON.parse(FR.rec.logParts().join('')).events;
    const k = n => E.filter(e => e[1] === n);
    ok(k('wk').length === 2 && k('wk')[0][3] === '1 town / houses / builder' && k('wkend').length === 1 && k('wkend')[0][0] === 5100, '9b made and ended are events (ended once, however often terminate is called)');
    ok(k('wkmsg').length === 1 && k('wkmsg')[0][0] === 1600 && k('wkmsg')[0][2] === 20 && k('wkmsg')[0][3] === 'town / houses / builder',
       '9b a reply whose handler held the main thread 16 ms or more is an event, by the worker\'s name (the quick one is not)', JSON.stringify(k('wkmsg')));
    w.onmessage = null; ok(w.onmessage === null && w.on === null, '9b a handler set to null is null on the worker');
  }
  for (const [q, what] of [['?recwk=0', '?recwk=0'], ['?rec=0', '?rec=0']]) {
    const P = page(q), w = new P.ctx.Worker('blob:a', { name: 'x' });
    ok(P.ctx.Worker === P.FakeWorker && !Object.prototype.hasOwnProperty.call(w, 'postMessage') && P.FR.rec.header().workers === null && JSON.parse(P.FR.rec.logParts().join('')).workers === null,
       '9b ' + what + ' leaves the page\'s Worker untouched, and the log says null');
  }

  // 9c
  {
    const LT = require('./load_timeline.js');
    const chat = []; for (let b = 36; b < 52; b++) chat.push(b, 1, 1, 0, 1);
    const log = { header: { cols: [], slots: [], boot: { t0: 0, log: [{ k: 'show', set: 'garage' }, { k: 'step', id: 'settle', t: 1000, ms: 8000 }, { k: 'step', id: 'ring', t: 9000, ms: 4000 }, { k: 'step', id: 'upload', t: 13000, ms: 3000 }] } },
      frames: { t: [] }, events: [[1500, 'wkmsg', 40, 'town / houses / builder']], programs: [], resources: [],
      workers: [{ n: 1, name: 'town / houses / builder', t: 500, end: null, sent: 1, received: 1, handlerMs: 3, bucketMs: 250, io: [4, 1, 0, 0, 1, 35, 0, 1, 3, 0], cut: false },
                { n: 2, name: 'aircraft / flight physics / sim host', t: 8000, end: null, sent: 16, received: 16, handlerMs: 0, bucketMs: 250, io: chat, cut: false }] };
    const S = LT.timeline(log, {}).summary, st = id => S.steps.find(s => s.id === id);
    ok(st('settle').bound === 'worker' && /town \/ houses \/ builder/.test(st('settle').why), '9c a step that ends with the reply of a worker it had a request out to: bound by that worker, by name', st('settle').why);
    ok(st('ring').bound === 'not proven' && /constant traffic/.test(st('ring').why), '9c a worker in constant traffic is at every step\'s end: it is listed, never named as the bound', st('ring').why);
    ok(st('upload').bound === 'not proven' && /no worker had a request out/.test(st('upload').why), '9c a step no worker was out for says so', st('upload').why);
    ok(S.notRecorded.indexOf('workers') < 0 && S.workers.length === 2 && S.lanes.some(l => /^worker 01: town/.test(l)) && S.lanes.indexOf('main: named tasks') >= 0, '9c the timeline has a lane a worker and the slow reply handler among the named tasks', S.lanes.filter(l => /^worker/.test(l)).join(' | '));
    const old = Object.assign({}, log); delete old.workers; const SO = LT.timeline(old, {}).summary;
    ok(SO.notRecorded.indexOf('workers') >= 0 && SO.steps.find(s => s.id === 'settle').bound === 'not proven' && /workers not recorded/.test(SO.steps.find(s => s.id === 'settle').why), '9c a log without the table still says "workers not recorded", and proves nothing');
  }
}
module.exports = { run, runSites, runCensus, runWorkers, boot, world, warm };
if (require.main === module) { let fails = 0; runWorkers((c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; }); runSites((c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; }); run((c, msg, extra) => { console.log((c ? '  ok   ' : '  FAIL ') + msg + (extra !== undefined ? '  (' + extra + ')' : '')); if (!c) fails++; }); process.exit(fails ? 1 : 0); }
