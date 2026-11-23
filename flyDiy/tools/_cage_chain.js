// _cage_chain.js - THE POST CHAIN, FLAT (G1441, GARAGE-INSTANT 2026-10-04).
//
// Every layer file chains the editor's post hook the same way at load:
//     const prevPost = PAGE.post;  PAGE.post = ctx => { if (prevPost) prevPost(ctx); ...its own build... };
// so a build runs the layers innermost-first, in load order, and a layer can only be run together with every layer
// loaded before it. This file sits between the page's CAGE_PAGE (_cage_page5.js) and the first layer (_cage_crew.js)
// and makes `CAGE_PAGE.post` an accessor: a layer's assignment REGISTERS its function, and the `prevPost` a layer
// reads is a stub that runs the layers below it - the same nesting, the same order, the same code (a layer that
// works before its prevPost - the engine's and the floats' starters - still does). What the flat list adds:
//   - ONE LAYER CAN BE SKIPPED: its own body does not run, its group stays in the scene as its last run drew it, the
//     layers below it still get their turn. Only a PLAN skips (CAGE_CHAIN.plan, for a drag tick: G1442 in _cage_ui);
//     a build without one runs every layer, exactly as the nested closures did.
//   - EACH LAYER'S INPUTS ARE RECORDED on every run: the P keys it read (the ctx's P and CAGE_UI.P are handed out as
//     a recording view of the same object for the length of the chain - a read is the object's own value, a write
//     goes to the object) with the values it read, and its own ms (self, the layers below it subtracted).
//   - A PLAN runs a layer when a key it read last time reads differently now, when it never ran, when it is one of
//     the always-run (cheap, read every build's state), or when a layer it is FED by ran (FEEDS below: a forward read
//     of what an earlier layer publishes - CAGE_WING, CAGE_GEAR, CAGE_NOSE ...; read off each file's window.* reads).
// The plan is a PREVIEW: a skipped layer is the last run's, so anything it reads that is not a P key (another layer's
// mesh in the scene, the craft frame) may be one drag tick stale - the full build at the end of the drag (the slider's
// release, G1303's settle) runs every layer and is the build a plain build() makes. `?garage=old` or
// CAGE_CHAIN.on = false: the accessor still registers, nothing is ever skipped or recorded.
// Load order: after _cage_page5.js (it assigns window.CAGE_PAGE), before _cage_crew.js. A page without this file
// (the _cage8.html bench, the node gates' slices) keeps the plain nested property.
'use strict';
(function () {
  if (typeof window === 'undefined' || !window.CAGE_PAGE) return;
  const PAGE = window.CAGE_PAGE;
  if (Object.getOwnPropertyDescriptor(PAGE, 'post') && Object.getOwnPropertyDescriptor(PAGE, 'post').get) return;
  // THE REGISTRATION ORDER (build.js MANIFEST.editor: one entry a PAGE.post assignment; the cowl file makes two, the
  // ui's understudy pass is the last). A page whose files register in another order (a stack that names them says
  // so) gets no plans: CAGE_CHAIN.ok false, every build whole.
  const ORDER = ['crew', 'panel', 'cowl', 'cowlAft', 'eng', 'wing', 'brace', 'gear', 'float', 'fin', 'stab', 'access',
    'light', 'energy', 'hinge', 'pod', 'ext'];
  const FILE = { crew: '_cage_crew', panel: '_cage_panel', cowl: '_cage_cowl', cowlAft: '_cage_cowl', eng: '_cage_eng',
    wing: '_cage_wing', brace: '_cage_brace', gear: '_cage_gear', float: '_cage_float', fin: '_cage_fin',
    stab: '_cage_stab', access: '_cage_access', light: '_cage_light', energy: '_cage_energy', hinge: '_cage_hinge',
    pod: '_cage_pod', ext: '_cage_ui' };
  // A LAYER THAT RAN MAKES THESE RUN (the forward reads: what each file reads off window.* that an EARLIER file
  // publishes in its post - the crew's CAGE_CREW / CAGE_PANEL, the cowl's CAGE_NOSE / CAGE_COWL, the wing's
  // CAGE_WING / CAGE_BOOMS / CAGE_WING_BAY, the gear's CAGE_GEAR, the fin's CAGE_FIN*, the stab's CAGE_STAB; the
  // light and the access fittings stand on the fin and stab groups, the hinges on the wing's / fin's / stab's
  // surfaces). A read of a LATER layer's global is the previous build's by design (the order's own comments) and
  // makes no edge.
  const FEEDS = {
    crew: ['light', 'energy'],
    cowl: ['eng', 'access'], cowlAft: [], eng: ['access'],
    // (PHONE-EDIT-PERF, 2 Nov: no wing > float - the float layer reads no wing global (its step stands on the CG and the
    // airframe skin, its legs on the gear's: gear > float holds that); it re-ran on every wing tick, ~45 ms a tick on the
    // user's S20 FE, and a floatplane's release runs it anyway (_cage_ui: the float layer forced, the CG))
    wing: ['brace', 'gear', 'fin', 'stab', 'access', 'light', 'energy', 'hinge', 'pod'],
    brace: [], gear: ['float', 'fin', 'stab', 'access', 'hinge', 'pod'], float: [],
    fin: ['stab', 'access', 'light', 'hinge'], stab: ['access', 'light', 'hinge'],
    access: [], light: [], energy: [], hinge: [], pod: [], panel: [], ext: [],
  };
  // an edge that holds only while its reader uses it: the gear reads the wing for the legs it roots ON the wing (the
  // low-wing rule; CAGE_GEAR.onWing, its last run's count) - a high wing's gear stands on the fuselage alone
  const WHEN = {
    'wing>gear': () => { const G = window.CAGE_GEAR; return !(G && G.onWing === 0); },
  };
  const ALWAYS = new Set(['panel', 'cowlAft', 'ext']);   // a stat line / an early return / the understudy pass
  // G1451 (RELEASE-FAST): THE RELEASE'S OWN EDGES - what a WHOLE build reads that a preview may leave one build stale:
  // the engine's propeller-clearance check (a microtask after the chain) reads the wing's and the aft skin's probes;
  // a wing-mounted engine's faces (the cowl's engineFaces) stand on the wing; the tanks' clearance probes the engine's
  // and the cowl's meshes (HIT_LAYERS). A layer that ran under a drag's defer returned early (G1303: hidden, its reads
  // not taken) and is STALE until it runs whole.
  const REL_FEEDS = { wing: ['eng', 'cowl'], gear: ['eng'], eng: ['energy'], cowl: ['energy'] };
  const REL_WHEN = { 'wing>cowl': P => [2, 3, 5, 6].includes(Math.round(+(P && P.engMount) || 0)) };
  const DEFERS = new Set(['access', 'light', 'energy', 'hinge']);
  let SEQ = 0;
  const L = [];
  const C = window.CAGE_CHAIN = {
    on: !/(^|[?&])garage=old(&|$)/.test((typeof location !== 'undefined' && location.search) || ''),
    ok: true, why: '', layers: L, ORDER, FEEDS, REL_FEEDS, DEFERS, dirty: false,
    last: null,           // the last chain: [{name, ran, ms}]
  };
  const fileOf = () => {
    try { const s = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || new Error().stack || '';
      const m = /(_cage_[a-z0-9]+)\.js/.exec(String(s).split('\n').filter(l => !/_cage_chain\.js/.test(l)).join('\n'));
      return m ? m[1] : null; } catch (e) { return null; }
  };
  // ---- the recording view of P -------------------------------------------------------------------------------
  let CUR = null;                        // the layer whose own body is running
  let DERK = null;                       // PERF-SLIDERS: the rows a derived read's function reads (C.derived, below)
  let RUN = null;                        // ...recorded or not (G2880: whose turn another layer is placed again in)
  const ADOPT = new WeakSet();           // G2880: objects a layer added inside another layer's turn
  const snapV = v => (v !== null && typeof v === 'object') ? (() => { try { return 'json:' + JSON.stringify(v); } catch (e) { return NaN; } })() : v;
  const same = (a, b) => a === b || (a !== a && b !== b);
  const views = new WeakMap();
  const viewOf = P => {
    let v = views.get(P);
    if (!v) views.set(P, v = new Proxy(P, {
      get(t, k) { const x = t[k]; if (DERK && typeof k === 'string') DERK.add(k); if (CUR && typeof k === 'string' && !CUR.reads.has(k)) CUR.reads.set(k, snapV(x)); return x; },
      has(t, k) { if (CUR && typeof k === 'string' && !CUR.reads.has(k)) CUR.reads.set(k, snapV(t[k])); return k in t; },
      ownKeys(t) { if (CUR) CUR.all = true; return Reflect.ownKeys(t); },
      getOwnPropertyDescriptor(t, k) { if (CUR && typeof k === 'string' && !CUR.reads.has(k)) CUR.reads.set(k, snapV(t[k])); return Reflect.getOwnPropertyDescriptor(t, k); },
    }));
    return v;
  };
  // ---- the chain ---------------------------------------------------------------------------------------------
  const stubs = [];
  // G1451: the status line each layer's own body appends (ctx.stat: the text after the layers below it ran, to the
  // text after its own body) - a release that keeps a layer keeps its words
  const statTxt = ctx => (ctx && ctx.stat && typeof ctx.stat.textContent === 'string') ? ctx.stat.textContent : null;
  // ...and the scene's top-level objects each layer's own body added (a release that keeps a layer puts the layers'
  // groups back in the chain's order, as a whole build leaves them)
  const kids = ctx => (ctx && ctx.scene && ctx.scene.children) ? new Set(ctx.scene.children) : null;
  // PERF-SLIDERS (23 Nov 2026): ...AND WHAT A LAYER ADDED BEFORE IT CALLED THE LAYERS UNDER IT (`pre`). The float layer draws a
  // hull's tub, sponsons and spray strakes first thing in its body, then runs the chain below it; `objs` (what stands
  // in the scene after the layers below, less what stood before) never held them, so a release that put each layer's
  // groups back in a whole build's order (_cage_ui.js releaseSteps) left them ahead of the fuselage's own objects - the
  // Super Petrel after a tail-span drag: the same objects, three places of the scene's order off the plain build's
  // (GATE INSTANTREL, once CAGE_CHAIN.over let its releases go by the plan). A whole build adds them after the
  // fuselage's objects and before every layer's own, the outermost layer's first.
  const preOf = (n, ctx) => { const A = L[n].kidsA; if (!A || !ctx || !ctx.scene) return L[n].pre || [];
    const inner = new Set(); for (let j = 0; j < n; j++) for (const o of L[j].objs || []) inner.add(o);
    return ctx.scene.children.filter(o => !A.has(o) && !inner.has(o) && !ADOPT.has(o)); };
  const stub = n => stubs[n] || (stubs[n] = function (ctx) { if (n > 0) runLayer(n - 1, ctx); if (n > 0 && L[n]) { L[n].pre = preOf(n, ctx); L[n].kidsA = null; L[n].stat0 = statTxt(ctx); L[n].kids0 = kids(ctx); } });
  let childAcc = 0;
  // the clock (a node rig puts the machine's under the page's virtual one as window.__realNow)
  const now = () => (window.__realNow ? window.__realNow() : performance.now());
  function runLayer(i, ctx) {
    const Ly = L[i], plan = ctx && ctx.__plan;
    if (plan && !plan.run[i]) { Ly.ran = false; Ly.ms = 0; if (i > 0) runLayer(i - 1, ctx); return; }
    Ly.ran = true; Ly.seq = ++SEQ; Ly.stale = !!(ctx && ctx.defer && DEFERS.has(Ly.name)); Ly.mesh = ctx ? ctx.mesh : null;
    const rec = C.on && ctx && ctx.__rec;
    const prev = CUR, prevRun = RUN;
    RUN = Ly;
    if (rec) { CUR = Ly; Ly.reads = new Map(); Ly.der = null; Ly.all = false; Ly.allSnap = null; } else CUR = null;
    const outer = childAcc; childAcc = 0;
    const t0 = now();
    Ly.stat0 = statTxt(ctx); Ly.kids0 = kids(ctx); Ly.kidsA = Ly.kids0; Ly.pre = [];
    try { return Ly.f.call(PAGE, ctx); }
    finally {
      const k0 = Ly.kids0; Ly.kids0 = null;
      Ly.objs = k0 ? ctx.scene.children.filter(o => !k0.has(o) && !ADOPT.has(o)) : [];
      const st = statTxt(ctx);
      Ly.statApp = (st != null && Ly.stat0 != null && st.length >= Ly.stat0.length && st.slice(0, Ly.stat0.length) === Ly.stat0) ? st.slice(Ly.stat0.length) : '';
      const dt = now() - t0;
      Ly.ms = dt - childAcc; childAcc = outer + dt;
      Ly.msRan = Ly.ms;                  // PERF-SLIDERS: its last RUN's ms (ms is 0 on a skipped turn) - the drag budget's guess
      if (rec && Ly.all) Ly.allSnap = snapV(rec.P);
      CUR = prev; RUN = prevRun;
    }
  }
  Object.defineProperty(PAGE, 'post', {
    configurable: true, enumerable: true,
    get() { return L.length ? stub(L.length) : undefined; },
    set(f) {
      if (typeof f !== 'function') { C.ok = false; C.why = 'a non-function post'; return; }
      const name = ORDER[L.length] || ('layer' + L.length), file = fileOf();
      if (file && FILE[name] && file !== FILE[name]) { C.ok = false; C.why = 'registration ' + L.length + ' is ' + file + ', expected ' + FILE[name]; }
      if (L.length >= ORDER.length) { C.ok = false; C.why = 'more registrations than ORDER'; }
      L.push({ name, file, f, reads: null, all: false, allSnap: null, ran: false, ms: 0 });
    },
  });
  // ---- the build's side --------------------------------------------------------------------------------------
  // run(ctx, P, plan): the chain over ctx with P recorded (when on); `plan` from C.plan or null (every layer)
  // PERF-SLIDERS (23 Nov 2026): THE AIRFRAME OF A SHEET, ONCE. GEAR_GEN.cageAirframe(mesh, scale) - the skin's faces
  // bucketed by station, what every leg, strut, pad, float and nacelle is measured against - is asked for by the cowl
  // (up to five times), the wing (three), the gear, the floats and the access plates, each time from the SAME sheet, and
  // each time built again: ~3 ms a call on the Chinook, a dozen calls a whole build, one to three in every tick of a
  // wing or a gear row (the garage at 5120: a quarter of the Chinook's 26 ms wing tick was the struts re-deriving a
  // fuselage that had not moved). Here the answer is kept per sheet object and scale, under a STAMP of what the function
  // reads (every vertex, every face's corners, material and cut offset), so a sheet edited in place is measured again;
  // the airframe object is read-only to its callers (its one memo, __exact, is a function of it alone). Off: ?afmemo=0,
  // CAGE_CHAIN.afMemo.on = false, or RELEASE_FAST_OFF (GATE INSTANT's long way builds without it).
  const AF_OF = new WeakMap(), MAT_H = new Map();
  C.afMemo = { on: !/(^|[?&])afmemo=0(&|$)/.test((typeof location !== 'undefined' && location.search) || ''), hits: 0, built: 0 };
  const matH = m => { if (typeof m !== 'string') return +m || 0; let h = MAT_H.get(m); if (h === undefined) { h = 7; for (let i = 0; i < m.length; i++) h = (h * 31 + m.charCodeAt(i)) % 1000003; MAT_H.set(m, h); } return h; };
  const afStamp = mesh => { const V = mesh.V, F = mesh.F; let a = 0, b = 0;
    for (let i = 0; i < V.length; i++) { const p = V[i]; a += (p[0] + p[1] * 3.1 + p[2] * 7.3) * ((i % 13) + 1); }
    for (let i = 0; i < F.length; i++) { const f = F[i]; if (!f || !f.v) { b += 0.5; continue; }
      const v = f.v; let s = v.length * 31 + matH(f.m); for (let j = 0; j < v.length; j++) s += v[j] * (j + 2);
      if (f.cutOff) s += f.cutOff[0] * 1.7 + f.cutOff[1] * 2.9 + f.cutOff[2] * 5.3;
      b += s * ((i % 11) + 1); }
    return V.length + ':' + F.length + ':' + a + ':' + b; };
  const afWrap = () => { const GG = window.GEAR_GEN; if (!GG || typeof GG.cageAirframe !== 'function' || GG.cageAirframe.__memo) return;
    const f0 = GG.cageAirframe;
    const f = function (mesh, scale) {
      if (!C.afMemo.on || window.RELEASE_FAST_OFF || !mesh || !mesh.V || !mesh.F || typeof mesh !== 'object') return f0(mesh, scale);
      const k = scale || 1, st = afStamp(mesh);
      let m = AF_OF.get(mesh); if (!m) AF_OF.set(mesh, m = new Map());
      const e = m.get(k);
      if (e && e.st === st) { C.afMemo.hits++; return e.AF; }
      const AF = f0(mesh, scale); m.set(k, { st, AF }); C.afMemo.built++; return AF; };
    f.__memo = true; GG.cageAirframe = f; };
  C.run = (ctx, P, plan) => {
    const UI = window.CAGE_UI;
    afWrap();
    if (!C.on || !P) { PAGE.post && PAGE.post(ctx); return; }
    const view = viewOf(P);
    const hadUI = !!(UI && UI.P === P);
    ctx.P = view; ctx.__rec = { P }; if (plan) ctx.__plan = plan;
    if (hadUI) UI.P = view;
    if (!plan) C.dirty = false;
    try { PAGE.post(ctx); }
    catch (e) { C.dirty = true; throw e; }
    finally {
      if (hadUI) UI.P = P;
      C.last = L.map(l => ({ name: l.name, ran: l.ran, ms: +l.ms.toFixed(2) }));
    }
  };
  // the layer whose own body is running (a section stamped now is that layer's), or null
  C.cur = () => CUR;
  // G2880 (NACELLE-LAG): as(name, fn) - layer `name`'s placement run AGAIN inside the running layer's turn (the wing
  // places a unit that stood on the previous build's wing once more, _cage_wing.js CAGE_WING_EARLY): its P reads are
  // recorded as that layer's, the scene objects it adds are counted as its own and not the running layer's, its words
  // (the status line's) are its own. fn returns { added, words, delta, line } (delta: how much the line before the
  // running layer's own words grew, line: the line after - so the running layer's words stay its own)
  C.as = (name, fn) => {
    const Ly = L.find(l => l.name === name), host = RUN, prev = CUR;
    if (!Ly || Ly === host) return fn();
    CUR = prev ? (Ly.reads ? Ly : null) : null;
    let r;
    try { r = fn(); }
    finally { CUR = prev; }
    if (r && r.added) {
      for (const o of r.added) ADOPT.add(o);
      Ly.objs = (Ly.objs || []).filter(o => o.parent).concat(r.added);
    }
    if (r && typeof r.words === 'string') Ly.statApp = r.words;
    if (r && r.delta && host && host.stat0 != null && typeof r.line === 'string')
      host.stat0 = r.line.slice(0, Math.max(0, host.stat0.length + r.delta));
    return r;
  };
  // PERF-SLIDERS (23 Nov 2026): derived(P, name, fn) - A READ THROUGH A FUNCTION. A layer that depends on a row only through
  // a threshold or a class (the dash's gear selector counts ONE lamp when the mains stand on the centreline: s1X > 0.01)
  // recorded the row's raw value, so every tick of that row re-ran the layer - the DC-3's main gear station re-ran the
  // whole crew layer (its seats, its floor, its panel: 1.4 of a 2.0 s tick in the page in node) for a lamp count that
  // did not change. derived() runs fn(P) with the recording off and records fn's VALUE under `name` (and, apart, the rows
  // fn read: derivedKeys(), GATE DERIVED's walk); the plan runs the layer when fn(P) answers differently (or throws).
  // fn must be a pure function of P. ?derived=0, or CAGE_CHAIN.derivedOff = true (the gate's): the raw reads, as before.
  C.derivedOff = /(^|[?&])derived=0(&|$)/.test((typeof location !== 'undefined' && location.search) || '');
  C.derived = (P, name, fn) => {
    if (C.derivedOff || !CUR) return fn(P);
    const Ly = CUR, keys = new Set(); CUR = null; DERK = keys;
    let v; const raw = new Map();
    try { v = fn(P); for (const k of keys) raw.set(k, snapV(P[k])); } finally { CUR = Ly; DERK = null; }
    (Ly.der || (Ly.der = new Map())).set(name, { fn, v: snapV(v), keys, raw });
    return v;
  };
  // PERF-SLIDERS (23 Nov 2026): over(P, o) - P WITH A FEW ROWS LAID OVER IT, WITHOUT READING EVERY ROW OF P. A layer that
  // handed a generator `Object.assign({}, P, { engMount: m })` read every row (the copy enumerates P: the record's `all`),
  // so it re-ran on EVERY tick of ANY row - the cowl layer of every aeroplane with a nose-and-aft pair or three or four
  // engines (engMount 4-7: the Pawnee, the sailplane, the twin-boom of the list, ~70 ms of each tick in the garage at
  // 5120, whatever the slider), the wing's of one with a cabin pylon, the gear's of one carrying a spare wheel, the
  // crew's of one whose passengers sit on another seat than the pilots. over() answers an object whose own rows are o's
  // and whose every other row is read THROUGH to P (its prototype: the recording view records the rows the generator
  // asks for, one by one). The generator must not enumerate what it is handed (none of the four does: _cage_cowl.js
  // engineFaces, CAGE_PYLON.drawPylonBlade, GEAR_GEN.wheel, SEAT_GEN.build). ?derived=0 / derivedOff: the copy, as before.
  C.over = (P, o) => (C.derivedOff ? Object.assign({}, P, o) : Object.assign(Object.create(P), o));
  // derivedMoved(P): the layers one of whose derived reads stands on a row that reads differently now than when the layer
  // last ran (the function's value may be the same: the layer did not run). With the raw read the layer WOULD have run
  // in the drag - the release's rule on a crew that moved (_cage_ui.js) asks this so the release is the one it was.
  C.derivedMoved = P => { const out = [];
    for (const l of L) { if (!l.der) continue; let m = false;
      for (const d of l.der.values()) { for (const [k, v] of d.raw) if (!same(snapV(P[k]), v)) { m = true; break; } if (m) break; }
      if (m) out.push(l.name); }
    return out; };
  C.derivedKeys = () => { const out = new Set(); for (const l of L) if (l.der) for (const d of l.der.values()) for (const k of d.keys) out.add(k); return out; };
  // the run counter (each layer's `seq` is the counter at its last run)
  C.seqNow = () => SEQ;
  // only(names): a plan that runs the named layers (and the always-run ones) and skips the rest
  C.only = names => {
    if (!C.on || !C.ok || L.length !== ORDER.length) return null;
    const set = new Set(names);
    return { run: L.map(l => set.has(l.name) || ALWAYS.has(l.name)), why: L.map(l => set.has(l.name) ? 'only' : ALWAYS.has(l.name) ? 'always' : '') };
  };
  // plan(P): which layers a drag tick runs. null when no plan can be made (never on, a bad order, a layer never run)
  // G1451: plan(P, true, mesh) is a RELEASE's plan (mesh: the sheet the release's layers stand on) - the drag's plan, and every layer a preview left stale, and the release's
  // own edges (REL_FEEDS, which may point at an EARLIER layer: the pass repeats until nothing more is added)
  C.plan = (P, release, mesh) => {
    if (!C.on || !C.ok || !L.length || L.length !== ORDER.length) return null;
    if (release && C.dirty) return null;                  // a chain that threw: no basis for a skip
    let run, why;
    const fed = new Set();
    for (let pass = 0; pass < 4; pass++) {
      const n0 = fed.size;
      run = L.map(() => false); why = L.map(() => '');
      for (let i = 0; i < L.length; i++) {
        const Ly = L[i];
        if (!Ly.reads) return null;                       // never recorded: no basis for a skip
        let r = '';
        if (ALWAYS.has(Ly.name)) r = 'always';
        else if (fed.has(Ly.name)) r = 'fed';
        else if (release && Ly.stale) r = 'stale';
        else if (release && Ly.mesh !== mesh) r = 'sheet';      // it last ran on another sheet (a detail row's tick)
        else if (Ly.all && !same(snapV(P), Ly.allSnap)) r = 'all';
        else for (const [k, v] of Ly.reads) if (!same(snapV(P[k]), v)) { r = k; break; }
        // (PERF-SLIDERS: its derived reads - the value of a function of P, not the keys the function read)
        if (!r && Ly.der) for (const [n, d] of Ly.der) { let v, bad = false; try { v = snapV(d.fn(P)); } catch (e) { bad = true; } if (bad || !same(v, d.v)) { r = n; break; } }
        if (r) {
          run[i] = true; why[i] = r;
          if (r !== 'always') {
            for (const n of FEEDS[Ly.name] || []) { const w = WHEN[Ly.name + '>' + n]; if (!w || w()) fed.add(n); }
            if (release) for (const n of REL_FEEDS[Ly.name] || []) { const w = REL_WHEN[Ly.name + '>' + n]; if (!w || w(P)) fed.add(n); }
          }
        }
      }
      if (!release || fed.size === n0) break;
    }
    return { run, why };
  };
})();
