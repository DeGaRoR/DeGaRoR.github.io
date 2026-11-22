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
//        the key in the material's own literal:   { userData: { progOwner: 'town / houses / walls' }, color: ..., ... }
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
//      - FIRST DRAWN: the first gl.useProgram of it (three calls it on a program SWITCH, not a draw), and what that
//        first use COST: from the first status query three makes of it to the switch (the uniforms read back). A program whose
//        readiness was first learnt by a status query that WAITED held that frame (`blocked`, with the ms); one never
//        drawn was warmed for nothing.
//      - WHAT IT IS: three's type and name, the hash of its cache key, the hash and the size of its final vertex and
//        fragment source (the fingerprint: the same text links the same program on any boot), and the VARIANT,
//        readable: the #defines of three's prefix (USE_FOG, USE_SHADOWMAP, USE_INSTANCING, ...) and the axes three
//        writes into the body (LIGHTS=, SHADOWS=, TONE=, OUT=, OPAQUE, DITHERING, a hook's DMG_SCUFF: bodyTags).
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

  // THE VARIANT'S OTHER AXES ARE IN THE BODY (PERF-LEAD's reading of the skin family, 22 Nov: 75 programs for 24
  // prefixes). Three writes the light and shadow counts into the text as array sizes (`directionalLights[ 2 ]`), and
  // the tone mapping, the output transfer, OPAQUE and DITHERING after the fragment prefix's first uniform - where
  // defsOf stops; a game hook's own switch (DMG_SCUFF) is a #define in the body too. bodyTags() reads them off the
  // FRAGMENT text with one pass of one regex and gives them as tags beside the prefix defines:
  //   LIGHTS=dir.point.spot.hemi   SHADOWS=dir.point.spot   CLIP=n   TONE=<function>   OUT=sRGB|linear   OPAQUE
  //   DITHERING   DMG_SCUFF   (and any other #define DMG_* / GD_* / BAND_* a hook wrote)
  // ~1 ms a 200 KB text: it is NOT done at the link. The texts wait in a queue read in the page's idle time
  // (requestIdleCallback), and what is left when a table is asked for is read then.
  const BODY = /(directionalLights|pointLights|spotLights|hemisphereLights|directionalLightShadows|pointLightShadows|spotLightShadows|clippingPlanes)\[ ?(\d+) ?\]|vec3 toneMapping\( vec3 color \) \{ return (\w+)|linearToOutputTexel\( vec4 value \) \{\s*return \(?\s*(\w+)|#define[ \t]+(TONE_MAPPING|OPAQUE|DITHERING|(?:DMG|GD|BAND)_\w+)\b|uniform float (uFbFade)\b/g;
  function bodyTags(src) {
    const n = { directionalLights: -1, pointLights: -1, spotLights: -1, hemisphereLights: -1, directionalLightShadows: -1, pointLightShadows: -1, spotLightShadows: -1, clippingPlanes: -1 };
    let tone = null, out = null; const flags = new Set(); let m; BODY.lastIndex = 0;
    while ((m = BODY.exec(src))) {
      if (m[1]) { const v = +m[2]; if (v > n[m[1]]) n[m[1]] = v; }
      else if (m[3]) tone = m[3].replace(/ToneMapping$/, '');
      else if (m[4]) out = /sRGB/.test(m[4]) ? 'sRGB' : 'linear';
      else if (m[5] && m[5] !== 'TONE_MAPPING') flags.add(m[5]);
      else if (m[6]) flags.add('FLOWN_FADE');   // (flown_bake.js: the live / band twins' dither is a uniform, uFbFade, not a define)
    }
    const z = k => Math.max(0, n[k]), tags = [];
    if (n.directionalLights >= 0 || n.pointLights >= 0 || n.spotLights >= 0 || n.hemisphereLights >= 0) tags.push('LIGHTS=' + z('directionalLights') + '.' + z('pointLights') + '.' + z('spotLights') + '.' + z('hemisphereLights'));
    if (n.directionalLightShadows >= 0 || n.pointLightShadows >= 0 || n.spotLightShadows >= 0) tags.push('SHADOWS=' + z('directionalLightShadows') + '.' + z('pointLightShadows') + '.' + z('spotLightShadows'));
    if (n.clippingPlanes > 0) tags.push('CLIP=' + n.clippingPlanes);
    if (tone) tags.push('TONE=' + tone); if (out) tags.push('OUT=' + out);
    for (const f of [...flags].sort()) tags.push(f);
    return tags;
  }

  // ---- 2. the registry ----------------------------------------------------------------------------------------
  let H = null;                                       // the one hook of the page (a second renderer keeps the first's)
  function hook(renderer, gl, clock, event) {
    if (MODE === 0 || !renderer || !gl) return null;
    if (H) return H.renderer === renderer ? H : null;
    const props = renderer.properties;
    const rows = [], byGL = new WeakMap(), byThree = new WeakMap(), SH = new WeakMap(), PSH = new WeakMap();
    let fresh = [];                                   // rows whose three program is known and whose material is not yet
    const self = { hashMs: 0, resolveMs: 0, resolves: 0, walked: 0, bodyMs: 0, bodies: 0 };
    // the fragment texts waiting for bodyTags(), read when the page is idle
    const bodyQ = []; let bodyT = 0;
    const bodyRun = dl => { bodyT = 0; const t0 = clock(); let first = !!(dl && dl.didTimeout);   // (a page busy for 4 s: one text all the same, so the queue cannot only grow)
      while (bodyQ.length && (first || (dl && typeof dl.timeRemaining === 'function' ? dl.timeRemaining() > 2 : clock() - t0 < 4))) { first = false; const e = bodyQ.pop(), t = clock(); e[0].body = bodyTags(e[1]); self.bodyMs += clock() - t; self.bodies++; }
      if (bodyQ.length) bodySoon(); };
    const bodySoon = () => { if (bodyT) return; try { bodyT = typeof W.requestIdleCallback === 'function' ? W.requestIdleCallback(bodyRun, { timeout: 4000 }) : setTimeout(bodyRun, 200); } catch (e) { bodyT = 0; } };
    const bodyFlush = () => { while (bodyQ.length) { const e = bodyQ.pop(), t = clock(); e[0].body = bodyTags(e[1]); self.bodyMs += clock() - t; self.bodies++; } };
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
            if (MODE === 2) { const t = clock(); SH.set(s, { len: src.length, h: fnv(src), defs: defsOf(src), src }); self.hashMs += clock() - t; }   // (src: kept to the link only, for the body's tags)
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
      // THE FIRST USE'S OWN COST: three's first use of a program asks its info log and link status (the wait on its link,
      // if it is still linking), then reads every uniform and attribute back from the driver, then switches to it - one
      // synchronous run from the first of those queries (fu0, waited()) to this call. Its ms is the event's.
      if (r.fu0 !== null && r.useT - r.fu0 < 60000) r.firstUseMs = r.useT - r.fu0;
      event('proguse', r.useT, r.firstUseMs, r.n);
    }

    // compile(): the Set of materials it keyed is three's own answer to "who asked for these programs"
    let inCompile = 0;
    try {
      const compile = renderer.compile;
      if (typeof compile === 'function') renderer.compile = function (scene, camera, targetScene) {
        inCompile++;
        let set;
        try { set = targetScene === undefined ? compile.call(this, scene, camera) : compile.call(this, scene, camera, targetScene); } finally { inCompile--; }
        if (fresh.length && set && typeof set.forEach === 'function') { const t = clock(); set.forEach(m => holds(m, null));
          // a program nobody answers for: the compiled objects are asked too, so that its row at least says who wears it
          if (fresh.some(r => r.found && !r.owners.length && !r.objs.length)) walk(scene);
          close(false); self.resolveMs += clock() - t; self.resolves++; }
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
    // (the cold captures of 22 Nov: 61 unowned programs read '<MeshStandardMaterial>' and nothing else. A material with
    //  no owner now says what can be said of it: its userData's keys, its colour, its map's name - the trail to its maker)
    const describe = m => { let s = (m.name || '') + '<' + m.type + '>';
      try { if (!ownersOf(m).length) { const k = Object.keys(m.userData || {}).slice(0, 8).join(','); s += '{' + (k ? 'ud:' + k + ' ' : '') + (m.color && m.color.getHexString ? '#' + m.color.getHexString() : '') +
        (m.map ? ' map:' + (m.map.name || (m.map.isCanvasTexture ? 'canvas' : m.map.isDataTexture ? 'data' : m.map.isCompressedTexture ? 'ktx' : 'tex')) : '') + (m.vertexColors ? ' vc' : '') + (m.transparent ? ' transp' : '') + '}'; } } catch (e) {}
      return s; };
    // a compile's stand-in (PROG_WARM.standIn: an object whose prototype is the real one, its parent cut) stands for it
    const realOf = o => { try { const p = Object.getPrototypeOf(o); return o.parent === null && p && p.isObject3D ? p : o; } catch (e) { return o; } };
    function attribute(r, m, o) {
      for (const w of ownersOf(m)) if (r.owners.indexOf(w) < 0) r.owners.push(w);
      const mn = describe(m); if (o) o = realOf(o);
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
        if (!r.owners.length) {   // three's own: by its name whether a scene of three's held it (the PMREM bakes) or none did
          const w = THREE_OWN[r.name] || (!r.found ? THREE_TYPE[r.type] : null);
          if (w) { r.owners.push(w); if (!r.found) r.mats.push('(three) ' + (r.name || r.type)); }
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
          body: null, ctx: ctxNow(), step: bootStep(), rt: null, owners: [], mats: [], objs: [], open: false, found: false,
          polls: 0, pendT: null, readyT: null, via: null, waitMs: null, fu0: null, firstUseMs: null, useT: null, useCtx: null, blocked: false, relink: byGL.has(p) };
        rows.push(r); byGL.set(p, r);
        if (fs && fs.src) { bodyQ.push([r, fs.src]); fs.src = null; bodySoon(); }
        if (vs && vs.src) vs.src = null;
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
        r.waitMs = (r.waitMs || 0) + ms; if (r.fu0 === null) r.fu0 = t;
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
        P.flush(roots); bodyFlush();
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
            defs: r.defs ? (r.body && r.body.length ? r.defs.concat(r.body) : r.defs) : null, body: r.body, ctx: r.ctx, step: r.step, rt: r.rt, t: r1(r.t), linkMs: r.linkMs === null ? null : r1(r.linkMs), polls: r.polls, pendT: r.pendT === null ? null : r1(r.pendT),
            readyT: r.readyT === null ? null : r1(r.readyT), via: r.via, waitMs: r.waitMs === null ? null : r1(r.waitMs), useT: r.useT === null ? null : r1(r.useT), useCtx: r.useCtx, firstUseMs: r.firstUseMs === null ? null : r1(r.firstUseMs),
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
          hashMs: r1(self.hashMs), resolveMs: r1(self.resolveMs), resolves: self.resolves, walked: self.walked, bodyMs: r1(self.bodyMs), bodies: self.bodies, bodiesWaiting: bodyQ.length };
      },
    };
    return P;
  }
  function merge(a, b) { const s = new Set(a); for (const x of b) s.add(x); return [...s].sort(); }

  // ---- 3. THE UPLOADS OF A STEADY FRAME, BY OWNER (?recup=1; PERF-LEAD, 22 Nov) ---------------------------------------
  // The 07:00 captures: in flight the game sends ~4 MB to the GPU EVERY frame (73 buffer updates, 54 buffer creations,
  // ~70 texture calls). The GL counters say how much; this says WHOSE. Three uploads a buffer or a texture when its
  // `version` moved, and the version moves through the `needsUpdate` setter of BufferAttribute, InterleavedBuffer and
  // Texture: with ?recup=1 those three setters are wrapped (the original is called first, unchanged) and each object
  // marked is counted - its marks, the FRAMES it was marked in, its bytes (the attribute's array, or its update
  // ranges; a texture's width x height x layers) - and, on one frame in 32, a SAMPLE of its content is hashed at the
  // frame's end (1 024 elements across the array): an object marked again with the same sample was very likely
  // re-uploaded UNCHANGED. Nothing is asked of the GL. WHOSE it is is found when the table is asked for, not during
  // the frames: the scenes the renderer drew are walked once - geometry attributes, instance matrices and colours, the
  // index, morph and bone textures -> the mesh's path and its material's owner; a material's maps and uniforms -> the
  // texture. An object no scene holds any more keeps its own name, or is 'gone'. OFF by default: nothing is wrapped.
  // The counters restart at each reveal (the flight's own), so the table is the flight's, not the loading's.
  const TRAFFIC_ON = /[?&]recup=1(?:&|$)/.test(q);
  let TR = null;
  function traffic(THREE, frameOf) {
    if (!TRAFFIC_ON || TR || !THREE) return TR;
    const recs = new WeakMap(), list = [], WR = typeof WeakRef === 'function';
    let frame0 = frameOf(), marked = [], lastF = -1;
    const bytesOf = (o, kind) => { try {
      if (kind === 'tex') { const im = o.image; if (!im) return 0; if (im.data && im.data.byteLength) return im.data.byteLength; return (im.width || 0) * (im.height || 0) * (im.depth || 1) * 4; }
      const a = o.array; if (!a) return 0; const ur = o.updateRanges;
      if (ur && ur.length) { let n = 0; for (let i = 0; i < ur.length; i++) n += ur[i].count; return n * a.BYTES_PER_ELEMENT; }
      return a.byteLength; } catch (e) { return 0; } };
    const mark = (o, kind) => {
      let r = recs.get(o);
      if (r === undefined) { r = { kind, marks: 0, frames: 0, lastF: -1, bytes: 0, max: 0, hash: null, same: 0, diff: 0, ref: WR ? new WeakRef(o) : null, name: (o.name || '') }; recs.set(o, r); if (list.length < 20000) list.push(r); }
      const f = frameOf(); r.marks++; const b = bytesOf(o, kind); r.bytes += b; if (b > r.max) r.max = b;
      if (r.lastF !== f) { r.lastF = f; r.frames++; if (f !== lastF) { lastF = f; marked.length = 0; } marked.push(r); }
    };
    const wrap = (proto, kind) => { const d = proto && Object.getOwnPropertyDescriptor(proto, 'needsUpdate');
      if (!d || typeof d.set !== 'function') return false;
      Object.defineProperty(proto, 'needsUpdate', { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { d.set.call(this, v); if (v === true) mark(this, kind); } }); return true; };
    const wrapped = [wrap(THREE.BufferAttribute && THREE.BufferAttribute.prototype, 'attr'), wrap(THREE.InterleavedBuffer && THREE.InterleavedBuffer.prototype, 'attr'), wrap(THREE.Texture && THREE.Texture.prototype, 'tex')];
    // a sample of an object's content: 1 024 elements across its array (a canvas or an image has none: not judged)
    const sample = o => { const a = o && (o.array || (o.image && o.image.data)); if (!a || !a.length) return null;
      const n = a.length, st = Math.max(1, Math.floor(n / 1024)); let h = 0x811c9dc5;
      for (let i = 0; i < n; i += st) { h ^= (a[i] * 4096) | 0; h = imul(h, 16777619); } return h >>> 0; };
    TR = { on: true, wrapped,
      // the frame is over: on one frame in 32, what was marked in it is sampled and compared with its last sample
      frameEnd(f) { if ((f & 31) !== 0 || lastF !== f) return;
        for (let i = 0; i < marked.length; i++) { const r = marked[i], o = r.ref ? r.ref.deref() : null; if (!o) continue; const h = sample(o); if (h === null) continue;
          if (r.hash !== null) { if (r.hash === h) r.same++; else r.diff++; } r.hash = h; } },
      reset() { frame0 = frameOf(); for (const r of list) { r.marks = 0; r.frames = 0; r.bytes = 0; r.max = 0; r.same = 0; r.diff = 0; r.hash = null; r.lastF = -1; } },
      // the table: whose each marked object is, from the scenes given
      table(roots) {
        const who = new Map();   // object -> { owner, path, what }
        const put = (o, owner, path, what) => { if (o && !who.has(o)) who.set(o, { owner, path, what }); };
        const pathOf = m => { let s = m.name || m.type, p = m.parent, k = 0; while (p && k++ < 5) { if (p.name) s = p.name + '/' + s; p = p.parent; } return s; };
        const texOf = (m, owner, path) => { try { for (const k in m) { const v = m[k]; if (v && v.isTexture) put(v, owner, path, k); }
          const U = m.uniforms; if (U) for (const k in U) { const v = U[k] && U[k].value; if (v && v.isTexture) put(v, owner, path, 'uniform ' + k); else if (Array.isArray(v)) for (const x of v) if (x && x.isTexture) put(x, owner, path, 'uniform ' + k); }
          const ud = m.userData; if (ud) for (const k in ud) { const v = ud[k]; if (v && v.isTexture) put(v, owner, path, 'userData ' + k); else if (v && v.value && v.value.isTexture) put(v.value, owner, path, 'userData ' + k); } } catch (e) {} };
        for (const sc of (roots || [])) if (sc && sc.traverse) sc.traverse(o => {
          const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [], owner = (mats[0] && ownersOf(mats[0])[0]) || null, path = pathOf(o), g = o.geometry;
          if (g) { const A = g.attributes || {}; for (const k in A) { const a = A[k]; put(a.isInterleavedBufferAttribute ? a.data : a, owner, path, k); } if (g.index) put(g.index, owner, path, 'index');
            const MA = g.morphAttributes || {}; for (const k in MA) for (const a of MA[k]) put(a, owner, path, 'morph ' + k); }
          if (o.instanceMatrix) put(o.instanceMatrix, owner, path, 'instanceMatrix'); if (o.instanceColor) put(o.instanceColor, owner, path, 'instanceColor');
          if (o.morphTexture) put(o.morphTexture, owner, path, 'morphTexture'); if (o.skeleton && o.skeleton.boneTexture) put(o.skeleton.boneTexture, owner, path, 'boneTexture');
          if (o._matricesTexture) put(o._matricesTexture, owner, path, 'batch matrices'); if (o._colorsTexture) put(o._colorsTexture, owner, path, 'batch colours');
          for (const m of mats) if (m) texOf(m, ownersOf(m)[0] || null, path);
        });
        const frames = Math.max(1, frameOf() - frame0), rows = [];
        let tot = 0, named = 0;
        for (const r of list) { if (!r.marks) continue; const o = r.ref ? r.ref.deref() : null, w = o ? who.get(o) : null; tot += r.bytes; if (w) named += r.bytes;
          rows.push({ kind: r.kind, what: w ? w.what : (r.name || (o ? (o.isTexture ? 'texture' : 'attribute') : 'gone')), owner: w ? w.owner : null, at: w ? w.path : (o ? 'not in a drawn scene' : 'gone'), name: r.name || null,
            marks: r.marks, frames: r.frames, per100: Math.round(1000 * r.frames / frames) / 10, KB: Math.round(r.max / 1024), MB: Math.round(r.bytes / 104857.6) / 10, sampled: r.same + r.diff, unchanged: r.same }); }
        rows.sort((a, b) => b.MB - a.MB);
        return { frames, objects: rows.length, MB: Math.round(tot / 104857.6) / 10, namedMB: Math.round(named / 104857.6) / 10, perFrameKB: Math.round(tot / 1024 / frames), wrapped, rows: rows.slice(0, 300) };
      },
    };
    return TR;
  }

  const API = { own, ownersOf, hook, THREE_OWN, THREE_TYPE, defsOf, bodyTags, fnv, get mode() { return MODE; },
    traffic, get trafficOn() { return TRAFFIC_ON; }, uploads: () => (TR && H ? TR.table(H.scenes()) : null),
    table: roots => (H ? H.table(roots) : []), summary: () => (H ? H.summary() : null), awaiting: t => (H ? H.awaiting(t) : []), flush: roots => { if (H) H.flush(roots); },
    _reset: () => { H = null; } };
  W.PROGRAMS = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
