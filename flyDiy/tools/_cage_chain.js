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
    wing: ['brace', 'gear', 'float', 'fin', 'stab', 'access', 'light', 'energy', 'hinge', 'pod'],
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
  const REL_WHEN = { 'wing>cowl': P => Math.round(+(P && P.engMount) || 0) >= 2 };
  const DEFERS = new Set(['access', 'light', 'energy', 'hinge']);
  let SEQ = 0;
  const L = [];
  const C = window.CAGE_CHAIN = {
    on: !/(^|[?&])garage=old(&|$)/.test((typeof location !== 'undefined' && location.search) || ''),
    ok: true, why: '', layers: L, ORDER, FEEDS, REL_FEEDS, dirty: false,
    last: null,           // the last chain: [{name, ran, ms}]
  };
  const fileOf = () => {
    try { const s = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || new Error().stack || '';
      const m = /(_cage_[a-z0-9]+)\.js/.exec(String(s).split('\n').filter(l => !/_cage_chain\.js/.test(l)).join('\n'));
      return m ? m[1] : null; } catch (e) { return null; }
  };
  // ---- the recording view of P -------------------------------------------------------------------------------
  let CUR = null;                        // the layer whose own body is running
  const snapV = v => (v !== null && typeof v === 'object') ? (() => { try { return 'json:' + JSON.stringify(v); } catch (e) { return NaN; } })() : v;
  const same = (a, b) => a === b || (a !== a && b !== b);
  const views = new WeakMap();
  const viewOf = P => {
    let v = views.get(P);
    if (!v) views.set(P, v = new Proxy(P, {
      get(t, k) { const x = t[k]; if (CUR && typeof k === 'string' && !CUR.reads.has(k)) CUR.reads.set(k, snapV(x)); return x; },
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
  const stub = n => stubs[n] || (stubs[n] = function (ctx) { if (n > 0) runLayer(n - 1, ctx); if (n > 0 && L[n]) { L[n].stat0 = statTxt(ctx); L[n].kids0 = kids(ctx); } });
  let childAcc = 0;
  // the clock (a node rig puts the machine's under the page's virtual one as window.__realNow)
  const now = () => (window.__realNow ? window.__realNow() : performance.now());
  function runLayer(i, ctx) {
    const Ly = L[i], plan = ctx && ctx.__plan;
    if (plan && !plan.run[i]) { Ly.ran = false; Ly.ms = 0; if (i > 0) runLayer(i - 1, ctx); return; }
    Ly.ran = true; Ly.seq = ++SEQ; Ly.stale = !!(ctx && ctx.defer && DEFERS.has(Ly.name)); Ly.mesh = ctx ? ctx.mesh : null;
    const rec = C.on && ctx && ctx.__rec;
    const prev = CUR;
    if (rec) { CUR = Ly; Ly.reads = new Map(); Ly.all = false; Ly.allSnap = null; } else CUR = null;
    const outer = childAcc; childAcc = 0;
    const t0 = now();
    Ly.stat0 = statTxt(ctx); Ly.kids0 = kids(ctx);
    try { return Ly.f.call(PAGE, ctx); }
    finally {
      const k0 = Ly.kids0; Ly.kids0 = null;
      Ly.objs = k0 ? ctx.scene.children.filter(o => !k0.has(o)) : [];
      const st = statTxt(ctx);
      Ly.statApp = (st != null && Ly.stat0 != null && st.length >= Ly.stat0.length && st.slice(0, Ly.stat0.length) === Ly.stat0) ? st.slice(Ly.stat0.length) : '';
      const dt = now() - t0;
      Ly.ms = dt - childAcc; childAcc = outer + dt;
      if (rec && Ly.all) Ly.allSnap = snapV(rec.P);
      CUR = prev;
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
  C.run = (ctx, P, plan) => {
    const UI = window.CAGE_UI;
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
