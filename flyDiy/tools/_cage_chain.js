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
    'light', 'energy', 'hinge', 'ext'];
  const FILE = { crew: '_cage_crew', panel: '_cage_panel', cowl: '_cage_cowl', cowlAft: '_cage_cowl', eng: '_cage_eng',
    wing: '_cage_wing', brace: '_cage_brace', gear: '_cage_gear', float: '_cage_float', fin: '_cage_fin',
    stab: '_cage_stab', access: '_cage_access', light: '_cage_light', energy: '_cage_energy', hinge: '_cage_hinge',
    ext: '_cage_ui' };
  // A LAYER THAT RAN MAKES THESE RUN (the forward reads: what each file reads off window.* that an EARLIER file
  // publishes in its post - the crew's CAGE_CREW / CAGE_PANEL, the cowl's CAGE_NOSE / CAGE_COWL, the wing's
  // CAGE_WING / CAGE_BOOMS / CAGE_WING_BAY, the gear's CAGE_GEAR, the fin's CAGE_FIN*, the stab's CAGE_STAB; the
  // light and the access fittings stand on the fin and stab groups, the hinges on the wing's / fin's / stab's
  // surfaces). A read of a LATER layer's global is the previous build's by design (the order's own comments) and
  // makes no edge.
  const FEEDS = {
    crew: ['light', 'energy'],
    cowl: ['eng', 'access'], cowlAft: [], eng: ['access'],
    wing: ['brace', 'gear', 'float', 'fin', 'stab', 'access', 'light', 'energy', 'hinge'],
    brace: [], gear: ['float', 'fin', 'stab', 'access', 'hinge'], float: [],
    fin: ['stab', 'access', 'light', 'hinge'], stab: ['access', 'light', 'hinge'],
    access: [], light: [], energy: [], hinge: [], panel: [], ext: [],
  };
  const ALWAYS = new Set(['panel', 'cowlAft', 'ext']);   // a stat line / an early return / the understudy pass
  const L = [];
  const C = window.CAGE_CHAIN = {
    on: !/(^|[?&])garage=old(&|$)/.test((typeof location !== 'undefined' && location.search) || ''),
    ok: true, why: '', layers: L, ORDER, FEEDS,
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
  const stub = n => stubs[n] || (stubs[n] = function (ctx) { if (n > 0) runLayer(n - 1, ctx); });
  let childAcc = 0;
  // the clock (a node rig puts the machine's under the page's virtual one as window.__realNow)
  const now = () => (window.__realNow ? window.__realNow() : performance.now());
  function runLayer(i, ctx) {
    const Ly = L[i], plan = ctx && ctx.__plan;
    if (plan && !plan.run[i]) { Ly.ran = false; Ly.ms = 0; if (i > 0) runLayer(i - 1, ctx); return; }
    Ly.ran = true;
    const rec = C.on && ctx && ctx.__rec;
    const prev = CUR;
    if (rec) { CUR = Ly; Ly.reads = new Map(); Ly.all = false; Ly.allSnap = null; } else CUR = null;
    const outer = childAcc; childAcc = 0;
    const t0 = now();
    try { return Ly.f.call(PAGE, ctx); }
    finally {
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
    try { PAGE.post(ctx); }
    finally {
      if (hadUI) UI.P = P;
      C.last = L.map(l => ({ name: l.name, ran: l.ran, ms: +l.ms.toFixed(2) }));
    }
  };
  // plan(P): which layers a drag tick runs. null when no plan can be made (never on, a bad order, a layer never run)
  C.plan = P => {
    if (!C.on || !C.ok || !L.length || L.length !== ORDER.length) return null;
    const run = L.map(() => false), why = L.map(() => '');
    const fed = new Set();
    for (let i = 0; i < L.length; i++) {
      const Ly = L[i];
      if (!Ly.reads) return null;                         // never recorded: no basis for a skip
      let r = '';
      if (ALWAYS.has(Ly.name)) r = 'always';
      else if (fed.has(Ly.name)) r = 'fed';
      else if (Ly.all && !same(snapV(P), Ly.allSnap)) r = 'all';
      else for (const [k, v] of Ly.reads) if (!same(snapV(P[k]), v)) { r = k; break; }
      if (r) { run[i] = true; why[i] = r; if (r !== 'always') for (const n of FEEDS[Ly.name] || []) fed.add(n); }
    }
    return { run, why };
  };
})();
