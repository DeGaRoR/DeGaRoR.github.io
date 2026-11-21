// program_id.js - PROGRAM IDENTITY: EVERY WebGL PROGRAM NAMED BY ITS OWNER (PERF-TRACE, 22 Nov 2026)
//
// The user (21-22 Nov): "requiring new shader programs to identify themselves and their dependencies"; "retro fit
// shader identity and force the new ones to explicitly declare themselves". The independent review (reports/
// ARCHITECTURE-PERF-REVIEW-2026-11-20.md, section 2) named the gap: the flight recorder numbered every gl.linkProgram
// and listed three's program names, and nothing tied THAT GL program to its three.js program, its material, its
// feature. This file is the tie, and the place a material says whose it is.
//
// 1. THE DECLARATION. A material says whose it is where it is made, one of two equal forms:
//        PROGRAMS.own(material, 'terrain / island ground / splat')        (returns the material)
//        new THREE.MeshStandardMaterial({ userData: { progOwner: 'town / houses / walls' }, ... })
//    Both write material.userData.progOwner: a string 'feature / system / variant', or an array of them (a shared
//    material has several owners; own() on an owned material ADDS). It is DIAGNOSTIC METADATA: never in
//    customProgramCacheKey (the key decides which materials share a program), never in the GLSL, never in
//    material.name (three r186 writes the name into every program's source: `#define SHADER_NAME <material.name>` -
//    a label there would change the text the browser's program cache is keyed on). Material.copy() clones userData,
//    PROG_WARM.twin() shares it: a clone and a warm-up twin are their source's.
//    GATE PROGRAMS (tools/_program_check.js) holds every material made in src/ to a declaration.
//
// 2. THE REGISTRY (PROGRAMS.hook, called by the flight recorder when it wraps the context; nothing under ?rec=0 or
//    ?progid=0). One ROW a gl.linkProgram, in link order (n = the recorder's 'link' event's number):
//      - THE LINK -> THE THREE PROGRAM: three pushes its WebGLProgram to renderer.info.programs right after the
//        constructor that linked it, and its `.program` IS the GL object the link saw. Exact, no guess.
//      - THE THREE PROGRAM -> ITS MATERIAL(S) -> THE OWNER(S): renderer.compile() returns the Set of materials it
//        keyed (the compile steps' path: almost every program), and three keeps properties.get(material).programs,
//        cacheKey -> program. After a compile that made programs, that Set is read for them; after a render that made
//        programs (a LATE program: a draw found no program), the rendered scene is walked for them. Three's own
//        materials no scene holds (the shadow pass's depth set, the background, the PMREM bakes) are named from a
//        table (THREE_OWN). A program nobody answers for is UNOWNED, and says so.
//      - WHEN: submitted (the link call), then the bracket of its readiness on the driver's threads - the LAST time
//        three's own poll (program.isReady(): getProgramParameter COMPLETION_STATUS_KHR, asked by compileAsync, the
//        shaders' screen and the pacing) answered false, and the FIRST time it answered true. NO GL CALL IS ADDED:
//        a program nobody polls has no bracket, and says so (a status poll of its own changed the benchmark it
//        measured: Codex, reports/PERFORMANCE-REPORT.md). A blocking wait (the first LINK_STATUS / info-log query,
//        the recorder's 'linkwait') ends the bracket too, with its milliseconds.
//      - FIRST DRAWN: the first gl.useProgram of it (three calls it on a program SWITCH, not a draw). A program whose
//        readiness was first learnt by a status query that WAITED held that frame (`blocked`, with the ms); one never
//        drawn was warmed for nothing.
//      - WHAT IT IS: three's type and name, the hash of its cache key, the hash and the size of its final vertex and
//        fragment source (the fingerprint: the same text links the same program on any boot), and the #defines of
//        three's prefix (USE_FOG, USE_SHADOWMAP, USE_INSTANCING, ...): the VARIANT, readable.
//      - WHERE: the boot step it was made in, compile / render / shadow, the render target.
//    Rows go to the recorder's log as events ('prog' when its owner is known, 'progready', 'proguse') and whole, with
//    the defines, in the downloaded log's `programs`. tools/program_report.js reads them.
//
// THE COST, NAMED: nothing on a draw. A WeakMap read on each gl.useProgram (a program switch) and on each of three's
// own status polls; per link, one hash of the two source strings (FNV-1a over ~0.1-0.3 MB: ~0.2 ms a program,
// ~0.1 s over a 450-program boot; ?progid=lite = no source hash, no defines) and one event; a walk of the rendered
// scene only on a frame that made a program. GATE PROGRAMS measures it on and off, and the header says what it took.
(function () {
  'use strict';
  const W = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : null);
  if (!W) return;
  const q = (W.location && W.location.search) || '';
  const MODE = /[?&]progid=0(?:&|$)/.test(q) ? 0 : /[?&]progid=lite(?:&|$)/.test(q) ? 1 : 2;

  // ---- 1. the declaration ---------------------------------------------------------------------------------------
  function own(m, owner) {
    if (!m || owner === undefined || owner === null || owner === '') return m;
    if (Array.isArray(m)) { for (const x of m) own(x, owner); return m; }
    const ud = m.userData || (m.userData = {}), cur = ud.progOwner, add = Array.isArray(owner) ? owner : [owner];
    if (cur === undefined || cur === null || cur === '') { ud.progOwner = add.length === 1 ? add[0] : add.slice(); return m; }
    const list = Array.isArray(cur) ? cur : [cur];
    for (const o of add) if (list.indexOf(o) < 0) list.push(o);
    ud.progOwner = list.length === 1 ? list[0] : list;
    return m;
  }
  function ownersOf(m) {
    const o = m && m.userData ? m.userData.progOwner : undefined;
    return o === undefined || o === null || o === '' ? [] : Array.isArray(o) ? o.filter(x => x) : [String(o)];
  }
  // three's own materials, which no scene of ours holds (vendor/three.min.js r186: the names it gives them)
  const THREE_OWN = {
    BackgroundMaterial: 'three / scene background / texture', BackgroundCubeMaterial: 'three / scene background / cube',
    SphericalGaussianBlur: 'three / PMREM / blur', PMREMGGXConvolution: 'three / PMREM / GGX', EquirectangularToCubeUV: 'three / PMREM / equirect to cube',
    CubemapToCubeUV: 'three / PMREM / cube to cube', CubemapFromEquirect: 'three / cube target / from equirect',
  };
  const THREE_TYPE = { MeshDepthMaterial: 'three / shadow pass / depth', MeshDistanceMaterial: 'three / shadow pass / distance' };

  // ---- the hashes ---------------------------------------------------------------------------------------------
  const hex = h => ('0000000' + (h >>> 0).toString(16)).slice(-8);
  const imul = Math.imul;                              // (held: a global read a character is 100x the hash in node's vm, where the gates run)
  function fnv(s) { let a = 0x811c9dc5; for (let i = 0, n = s.length; i < n; i++) { a ^= s.charCodeAt(i); a = imul(a, 16777619); } return a >>> 0; }
  // the #defines of three's prefix: from SHADER_NAME to the first uniform (a RawShaderMaterial has no prefix: its head)
  const DEF = /#define[ \t]+(\w+)(?:[ \t]+([^\n]*))?/g;
  function defsOf(src) {
    let a = src.indexOf('#define SHADER_NAME'), b;
    if (a < 0) { a = 0; b = Math.min(src.length, 1500); }
    else { b = src.indexOf('\nuniform ', a); if (b < 0 || b - a > 12000) b = Math.min(src.length, a + 12000); }
    const out = []; DEF.lastIndex = a; let m;
    while ((m = DEF.exec(src)) && m.index < b) {
      if (m[1] === 'SHADER_NAME' || m[1] === 'SHADER_TYPE') continue;
      const v = m[2] ? m[2].trim() : '';
      out.push(v ? m[1] + '=' + v : m[1]);
    }
    return out;
  }

  // ---- 2. the registry ----------------------------------------------------------------------------------------
  let H = null;                                       // the one hook of the page (a second renderer keeps the first's)
  function hook(renderer, gl, clock, event) {
    if (MODE === 0 || !renderer || !gl) return null;
    if (H) return H.renderer === renderer ? H : null;
    const props = renderer.properties;
    const rows = [], byGL = new WeakMap(), byThree = new WeakMap(), SH = new WeakMap(), PSH = new WeakMap();
    let fresh = [];                                   // rows whose three program is known and whose material is not yet
    const self = { hashMs: 0, resolveMs: 0, resolves: 0, walked: 0 };
    const r1 = x => Math.round(x * 10) / 10;
    const bootStep = () => { const B = W.BOOT; return B ? (B.set || '') + ':' + ((B.current && B.current.id) || (B.state === 'gone' ? '-' : B.state || '')) : ''; };
    const rtName = () => { let rt = null; try { rt = renderer.getRenderTarget(); } catch (e) {}
      return rt ? (((rt.texture && rt.texture.name) || rt.name || 'rt') + ' ' + rt.width + 'x' + rt.height) : 'canvas'; };

    // the sources, as three hands them to the driver (vertex attached first: three's WebGLProgram)
    try {
      const ss = gl.shaderSource, at = gl.attachShader;
      if (typeof ss === 'function' && typeof at === 'function') {
        gl.shaderSource = function (s, src) {
          if (s && typeof src === 'string') {
            if (MODE === 2) { const t = clock(); SH.set(s, { len: src.length, h: fnv(src), defs: defsOf(src) }); self.hashMs += clock() - t; }
            else SH.set(s, { len: src.length, h: 0, defs: null });
          }
          return ss.call(gl, s, src);
        };
        gl.attachShader = function (p, s) { if (p && s) { const a = PSH.get(p); if (a) a.push(s); else PSH.set(p, [s]); } return at.call(gl, p, s); };
      }
    } catch (e) {}
    // the first draw with a program (three's state.useProgram: on a switch)
    try {
      const use = gl.useProgram;
      if (typeof use === 'function') gl.useProgram = function (p) {
        if (p) { const r = byGL.get(p); if (r !== undefined && r.useT === null) used(r); }
        return use.call(gl, p);
      };
    } catch (e) {}
    function used(r) {
      r.useT = clock(); r.useCtx = ctxNow();
      event('proguse', r.useT, null, r.n);
    }

    // compile(): the Set of materials it keyed is three's own answer to "who asked for these programs"
    let inCompile = 0;
    try {
      const compile = renderer.compile;
      if (typeof compile === 'function') renderer.compile = function (scene, camera, targetScene) {
        inCompile++;
        let set;
        try { set = targetScene === undefined ? compile.call(this, scene, camera) : compile.call(this, scene, camera, targetScene); } finally { inCompile--; }
        if (fresh.length && set && typeof set.forEach === 'function') { const t = clock(); set.forEach(m => holds(m, null)); close(false); self.resolveMs += clock() - t; self.resolves++; }
        return set;
      };
    } catch (e) {}
    const ctxNow = () => inCompile > 0 ? 'compile' : P.inShadow > 0 ? 'shadow' : P.inRender > 0 ? 'render' : 'other';

    // does this material hold one of the fresh programs? (three: properties.get(material).programs, cacheKey -> program)
    function holds(m, o) {
      if (!m || !props || !props.has(m)) return;
      const mp = props.get(m), ps = mp && mp.programs;
      if (!ps || typeof ps.forEach !== 'function') return;
      ps.forEach(pr => { const r = byThree.get(pr); if (r !== undefined && r.open) attribute(r, m, o); });
    }
    function attribute(r, m, o) {
      for (const w of ownersOf(m)) if (r.owners.indexOf(w) < 0) r.owners.push(w);
      const mn = (m.name || '') + '<' + m.type + '>';
      if (r.mats.length < 4 && r.mats.indexOf(mn) < 0) r.mats.push(mn);
      if (o && r.objs.length < 2) { let s = o.name || o.type, p = o.parent, k = 0; while (p && k++ < 6) { if (p.name) s = p.name + '/' + s; p = p.parent; } if (r.objs.indexOf(s) < 0) r.objs.push(s); }
      r.found = true;
    }
    function walk(root) {
      if (!root || typeof root.traverse !== 'function') return;
      root.traverse(o => {
        self.walked++;
        const m = o.material;
        if (m) { if (Array.isArray(m)) for (const x of m) holds(x, o); else holds(m, o); }
        if (o.customDepthMaterial) holds(o.customDepthMaterial, o);
        if (o.customDistanceMaterial) holds(o.customDistanceMaterial, o);
      });
      if (root.overrideMaterial) holds(root.overrideMaterial, null);
    }
    // the fresh rows that found their material are closed (logged); `all`: the rest too, named from three's own table
    function close(all) {
      const keep = [];
      for (const r of fresh) {
        if (!r.found && !all) { keep.push(r); continue; }
        if (!r.found) {
          const w = THREE_OWN[r.name] || THREE_TYPE[r.type];
          if (w) { r.owners.push(w); r.mats.push('(three) ' + (r.name || r.type)); }
        }
        r.open = false;
        event('prog', r.t0, null, { n: r.n, id: r.id, name: r.name, type: r.type, own: r.owners.join(' | ') || null, mat: r.mats.join(' | ') || null,
          obj: r.objs.join(' | ') || null, key: r.key, fp: r.fp, vs: r.vsLen, fs: r.fsLen, ctx: r.ctx, step: r.step, rt: r.rt });
      }
      fresh = keep;
    }

    // the scenes this renderer drew (weakly: a bake's scene is not kept alive), for the census
    let lastScene = null;
    const known = new WeakSet(), refs = [], WR = typeof WeakRef === 'function';
    function note(scene) { lastScene = scene; if (WR && scene && typeof scene === 'object' && !known.has(scene)) { known.add(scene); if (refs.length < 64) refs.push(new WeakRef(scene)); } }
    function alive() { const out = []; for (const r of refs) { const s = r.deref(); if (s) out.push(s); } return out; }

    const P = H = {
      renderer, mode: MODE, rows, self, inShadow: 0, inRender: 0,
      // gl.linkProgram returned: link number n (the recorder's), at t, the call's own ms
      linked(p, n, t, ms) {
        const sh = PSH.get(p) || [], vs = sh[0] ? SH.get(sh[0]) : null, fs = sh[1] ? SH.get(sh[1]) : null;
        const r = { n, t, linkMs: ms, t0: t, id: null, name: null, type: null, key: null, keyLen: 0,
          fp: vs && fs && MODE === 2 ? hex(vs.h) + hex(fs.h) : null, vsLen: vs ? vs.len : null, fsLen: fs ? fs.len : null,
          defs: vs && fs && vs.defs ? merge(vs.defs, fs.defs) : null,
          ctx: ctxNow(), step: bootStep(), rt: null, owners: [], mats: [], objs: [], open: false, found: false,
          polls: 0, pendT: null, readyT: null, via: null, waitMs: null, useT: null, useCtx: null, blocked: false, relink: byGL.has(p) };
        rows.push(r); byGL.set(p, r);
      },
      // three made a WebGLProgram (renderer.info.programs.push): its .program is the GL object just linked
      created(pr) {
        if (!pr) return;
        let r = pr.program ? byGL.get(pr.program) : undefined;
        if (r === undefined) { P.linked(pr.program || {}, null, clock(), null); r = rows[rows.length - 1]; }
        const ck = String(pr.cacheKey || '');
        r.id = pr.id; r.name = pr.name || ''; r.type = pr.type || ''; r.key = hex(fnv(ck)); r.keyLen = ck.length;
        r.t0 = clock(); r.ctx = ctxNow(); r.step = bootStep(); r.rt = rtName(); r.open = true;
        byThree.set(pr, r); fresh.push(r);
      },
      // three's own readiness poll answered (COMPLETION_STATUS_KHR)
      polled(p, ok, t) {
        const r = byGL.get(p);
        if (r === undefined) return;
        if (ok) { if (r.readyT === null) { r.readyT = t; r.via = 'poll'; event('progready', t, t - r.t, [r.n, r.pendT === null ? null : r1(r.pendT), 'poll', r.polls]); } }
        else { r.pendT = t; r.polls++; }
      },
      // the page was held on this program's link (the recorder's 'linkwait': LINK_STATUS / the info log, first asked)
      waited(p, t, ms) {
        const r = byGL.get(p);
        if (r === undefined) return null;
        r.waitMs = (r.waitMs || 0) + ms;
        // nobody's poll had seen it ready: the page learnt it by WAITING (three's first use of a program asks its link
        // status, and that query blocks until the link is done) - over 1 ms, the draw was held on this program
        if (r.readyT === null) { if (ms > 1) r.blocked = true; r.readyT = t + ms; r.via = 'status'; event('progready', t + ms, t + ms - r.t, [r.n, r.pendT === null ? null : r1(r.pendT), 'status', r.polls]); }
        return r.n;
      },
      // a render returned: the programs it made (late ones: a draw found none) are looked for in what it drew
      rendered(scene) {
        if (scene !== lastScene) note(scene);
        if (!fresh.length) return;
        const t = clock();
        walk(scene); close(P.inRender === 0);          // (a render inside a render: the outer one's programs wait for its own walk)
        self.resolveMs += clock() - t; self.resolves++;
      },
      scenes: alive,
      flush(roots) { if (fresh.length) { for (const s of (roots === true ? alive() : roots || [])) walk(s); close(true); } },
      awaiting(t) { const out = []; for (const r of rows) if (r.t <= t && (r.readyT === null || r.readyT > t)) out.push(r.n); return out; },
      // the rows, plain (the log's `programs`); a CENSUS over `roots` adds every material that holds each program now
      table(roots) {
        if (roots === true) roots = alive();
        P.flush(roots);
        let holders = null;
        if (roots && roots.length && props) {
          holders = new Map();
          const seen = new Set();
          const add = m => { if (!m || seen.has(m) || !props.has(m)) return; seen.add(m);
            const ps = props.get(m).programs; if (!ps || !ps.forEach) return;
            ps.forEach(pr => { const r = byThree.get(pr); if (r === undefined) return; let h = holders.get(r); if (!h) holders.set(r, h = { n: 0, names: new Set(), owners: new Set(), unowned: 0 });
              h.n++; h.names.add(m.name || ''); const ow = ownersOf(m); if (!ow.length) h.unowned++; for (const w of ow) h.owners.add(w); }); };
          for (const s of roots) if (s && s.traverse) { s.traverse(o => { const m = o.material; if (m) { if (Array.isArray(m)) m.forEach(add); else add(m); } add(o.customDepthMaterial); add(o.customDistanceMaterial); }); add(s.overrideMaterial); }
        }
        return rows.map(r => {
          const o = { n: r.n, id: r.id, name: r.name, type: r.type, own: r.owners.slice(), mat: r.mats.slice(), obj: r.objs.slice(), key: r.key, keyLen: r.keyLen, fp: r.fp, vs: r.vsLen, fs: r.fsLen,
            defs: r.defs, ctx: r.ctx, step: r.step, rt: r.rt, t: r1(r.t), linkMs: r.linkMs === null ? null : r1(r.linkMs), polls: r.polls, pendT: r.pendT === null ? null : r1(r.pendT),
            readyT: r.readyT === null ? null : r1(r.readyT), via: r.via, waitMs: r.waitMs === null ? null : r1(r.waitMs), useT: r.useT === null ? null : r1(r.useT), useCtx: r.useCtx,
            blocked: r.blocked, relink: r.relink, three: r.id !== null };
          const h = holders && holders.get(r);
          if (h) { o.held = h.n; o.heldNames = [...h.names]; o.heldOwners = [...h.owners]; o.heldUnowned = h.unowned; }
          return o;
        });
      },
      summary() {
        let three = 0, owned = 0, ready = 0, drawn = 0, late = 0, blocked = 0;
        for (const r of rows) { if (r.id !== null) three++; if (r.owners.length) owned++; if (r.readyT !== null) ready++; if (r.useT !== null) drawn++; if (r.ctx !== 'compile') late++; if (r.blocked) blocked++; }
        return { mode: MODE, links: rows.length, three, owned, unowned: three - owned, pendingOwner: fresh.length, seenReady: ready, drawn, notCompiled: late, drawnBeforeReady: blocked,
          hashMs: r1(self.hashMs), resolveMs: r1(self.resolveMs), resolves: self.resolves, walked: self.walked };
      },
    };
    return P;
  }
  function merge(a, b) { const s = new Set(a); for (const x of b) s.add(x); return [...s].sort(); }

  const API = { own, ownersOf, hook, THREE_OWN, THREE_TYPE, defsOf, fnv, get mode() { return MODE; },
    table: roots => (H ? H.table(roots) : []), summary: () => (H ? H.summary() : null), awaiting: t => (H ? H.awaiting(t) : []), flush: roots => { if (H) H.flush(roots); },
    _reset: () => { H = null; } };
  W.PROGRAMS = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
