// ============================================================
// THE SOUND'S NUMBERS (G1601, SOUND-2026-10-04 §2.1 / §9). PURE: no Web Audio,
// no DOM, runs in node - GATE AUDIO (tools/audio/_audio_check.js) tests this.
//
// audioParams(sim, cam, def, out, world) fills ONE preallocated Float32Array
// (out.block) from what the solver already publishes - the same `sim.*` the
// renderer reads, so the physics worker (on by default, sim_link.js mirrors
// the snapshot into the page's sim) and the inline solver read alike:
//
//   SCALARS   out.s[I.name] (I = out.I, the index of each name in AP_SCALARS)
//   ENGINES   per engine i < AP_MAX_ENG, a Float32Array view each:
//             out.rpm[i] prop rpm, out.rpmEng[i] engine rpm, out.thr[i] the
//             lever the solver applies (ctl.thr x ctl.eng[i]), running / crank /
//             key, thrustPer, and the DERIVED numbers the voices are made of:
//               fireHz  firing frequency  rpmEng/60 x cyl/2  (x cyl: two-stroke)
//               bpfHz   blade passage     rpm/60 x blades
//               tipM    tip Mach          pi D rpm/60 / c,  c from out.oatC
//               tipMh   helical tip Mach  hypot(tip speed, V) / c
//
// THE PER-AEROPLANE CONSTANTS (cylinders, stroke, blades, D, gear, family) are
// resolved ONCE per def (audioResolve; out.def is the def they were read off):
// spec.engines[i].sound = { cyl, arch, twoStroke, blades } when present (the
// join SND-ENGINE adds), else spec.prop.blades, else AP_FALLBACK below. Every
// later call writes numbers into the block and allocates nothing.
//
// THE CONTACTS are read at AP_CONTACT_HZ, not every frame: sim.wheelContacts()
// is the snapshot's object under the worker, but the INLINE solver's builds
// a fresh one per call (30_solver.js wheelContacts), and world.surface() costs
// a few terrain samples - 30 Hz is 33 ms of touchdown latency, inside a frame
// pair. onGround is derived from the contacts (the same count wheelsOnGround
// gives: mains + the tail / the floats' afterbody), so that is never called.
// ============================================================
var AUDIO_PARAMS = (function () {
  'use strict';
  const AP_MAX_ENG = 4;
  const AP_CONTACT_HZ = 30;
  // the scalars, in block order (append only: a source may hold an index)
  const AP_SCALARS = [
    'nEng', 'dt',   // (no sim time: sim.t is a getter on both paths, and a getter's double comes back boxed)
    'V', 'Veas', 'Vg', 'alpha', 'beta', 'nz', 'vs', 'alt', 'oatC', 'c', 'rho',
    'thrust', 'wash', 'starved', 'energyFrac', 'thrMaster',
    // the ground: contacts (1/0), their count, and the GROUND_SURF code under each (-1 = not touching)
    'onGround', 'main0', 'main1', 'tail', 'water', 'surf0', 'surf1', 'surfT',
    'hydroWet', 'submerged',
    'flap', 'brake', 'de', 'da', 'dr',
    // the listener: the camera mode's code (AP_CAM), interior (the cockpit eye), the shed, the pause
    'camMode', 'interior', 'inGarage', 'held', 'listenerX', 'listenerY', 'listenerZ',
    // the cabin from the build (§4: the insulation is the build's): 1 = no glazing (an open cockpit)
    'open',
  ];
  const AP_ENGINE = ['rpm', 'rpmEng', 'thr', 'running', 'crank', 'key', 'thrustPer',
                     'cyl', 'twoStroke', 'blades', 'D', 'gear', 'family',
                     'fireHz', 'bpfHz', 'tipM', 'tipMh'];
  const AP_CAM = { orbit: 0, chase: 1, wing: 2, tower: 3, cockpit: 4, free: 5 };
  const AP_KEY = { off: 0, l: 1, r: 2, both: 3, start: 4 };
  const AP_FAMILY = { four: 0, two: 1, electric: 2, turbine: 3 };
  const AP_SURF_WATER = 4;   // GROUND_SURF's WATER row (00_registry.js)
  // THE DECLARED FALLBACKS, until spec.engines[i].sound says (SND-ENGINE's join): a four-stroke is a flat four, a
  // two-stroke an inline twin (the 503 / 582; the 277 is a single), a radial nine (the Rotec, the R-985, the M-14P);
  // electric and turbine have no firing pulse (cyl 0 -> fireHz 0). A custom engine's name carries its count
  // (_cage_eng.js: "custom <arch> <n>-cyl <L> L"), which outranks the family.
  const AP_FALLBACK = { cyl: { four: 4, two: 2, radial: 9, electric: 0, turbine: 0 }, blades: 2, D: 1.8 };
  const I = {};
  AP_SCALARS.forEach((k, i) => { I[k] = i; });
  const NS = AP_SCALARS.length;
  const LEN = NS + AP_ENGINE.length * AP_MAX_ENG;

  // the block and its views: made once (a new block per AUDIO, never per frame)
  function audioParamsBlock() {
    const block = new Float32Array(LEN);
    // clk[0]: the seconds since the contacts were last read (a typed slot: a double in an object field is a fresh box per write)
    const out = { block, I, s: block.subarray(0, NS), def: null, nE: 0, clk: new Float64Array(1) };
    AP_ENGINE.forEach((k, j) => { out[k] = block.subarray(NS + j * AP_MAX_ENG, NS + (j + 1) * AP_MAX_ENG); });
    // the surfaces' wheel nodes (resolved per def): mains then tail, -1 = none
    out.wheelNode = new Int32Array(3).fill(-1);
    return out;
  }

  function registry() {
    if (typeof POWERPLANTS !== 'undefined') return POWERPLANTS;            // the page: the core's global
    return (typeof globalThis !== 'undefined' && globalThis.POWERPLANTS) || {};   // node: the gate sets it
  }
  // the engine facts the solver flies (30_solver.js: P_.engine || PP.engine, P_.prop || PP.prop)
  function engineOf(def) {
    const P = (def && def.params) || {}, PP = registry()[P.powerplant] || {};
    return { EN: P.engine || PP.engine || {}, PR: P.prop || PP.prop || {} };
  }
  function cylFallback(EN, se) {
    const nm = (se && se.custom && se.custom.name) || EN.name || '';
    const m = /(\d+)-cyl\b/.exec(nm);
    if (m) return +m[1];
    const fam = EN.family || 'four';
    if (fam === 'electric' || fam === 'turbine') return 0;
    if (EN.layout === 'radial') return AP_FALLBACK.cyl.radial;
    return AP_FALLBACK.cyl[fam] != null ? AP_FALLBACK.cyl[fam] : AP_FALLBACK.cyl.four;
  }
  // ONCE PER DEF: the constants a voice needs and the solver does not publish. Allocates (a def changes on a new
  // aeroplane, not on a frame); every engine slot past the aeroplane's count is zeroed.
  function audioResolve(def, out) {
    const spec = (def && def.spec) || {}, { EN, PR } = engineOf(def);
    const ses = Array.isArray(spec.engines) ? spec.engines : [];
    const nE = Math.max(0, Math.min(AP_MAX_ENG, (def && def.params && def.params.nEngines) || (ses.length || 1)));
    const fam = EN.family || 'four';
    for (let i = 0; i < AP_MAX_ENG; i++) {
      if (i >= nE) { for (const k of AP_ENGINE) out[k][i] = 0; continue; }
      const se = ses[i] || ses[0] || null, sd = (se && se.sound) || null;
      out.cyl[i] = sd && sd.cyl > 0 ? sd.cyl : cylFallback(EN, se);
      out.twoStroke[i] = sd && sd.twoStroke != null ? (sd.twoStroke ? 1 : 0) : (fam === 'two' ? 1 : 0);
      out.blades[i] = (sd && sd.blades > 0) ? sd.blades : (spec.prop && spec.prop.blades > 0) ? spec.prop.blades
                    : (PR.blades > 0 ? PR.blades : AP_FALLBACK.blades);
      out.D[i] = PR.D > 0 ? PR.D : AP_FALLBACK.D;
      out.gear[i] = EN.gear > 0 ? EN.gear : 1;
      out.family[i] = AP_FAMILY[fam] != null ? AP_FAMILY[fam] : 0;
    }
    const W = out.wheelNode, refs = (def && def.refs) || {};
    const mains = Array.isArray(refs.mains) ? refs.mains : [];
    W[0] = mains.length > 0 ? mains[0] : -1; W[1] = mains.length > 1 ? mains[1] : -1;
    W[2] = refs.tw != null && refs.tw >= 0 ? refs.tw : -1;
    out.s[I.open] = spec.cabin && spec.cabin.glazing === 'none' ? 1 : 0;
    out.s[I.nEng] = nE;
    out.nE = nE; out.def = def; out.clk[0] = 1e9;   // a new aeroplane reads its contacts on its first frame
  }

  const num = (x, d) => (typeof x === 'number' && x === x ? x : d);
  function surfAt(world, sim, node) {
    if (node < 0 || !world || typeof world.surface !== 'function' || !sim.p) return -1;
    // whole metres (int32: passed as small integers - a double argument to a call is a fresh box), finer than a surface
    const v = world.surface(sim.p[node * 3] | 0, sim.p[node * 3 + 2] | 0);
    return typeof v === 'number' ? v : -1;
  }

  // THE FRAME. cam: { mode, inGarage, held, p: Float64Array(3) | x, y, z } (the listener: app.js's cam.mode, the camera).
  // dt the frame's seconds (it times the contacts' sampling). Returns out.
  function audioParams(sim, cam, def, out, world, dt) {
    if (out.def !== def) audioResolve(def, out);
    const s = out.s, o = (sim && sim.out) || {}, ctl = (sim && sim.ctl) || {};
    const nE = out.nE;
    s[I.dt] = num(dt, 0);
    s[I.V] = num(o.V, 0); s[I.Veas] = num(o.Veas, 0); s[I.Vg] = num(o.Vg, 0);
    s[I.alpha] = num(o.alpha, 0); s[I.beta] = num(o.beta, 0); s[I.nz] = num(o.nz, 1); s[I.vs] = num(o.vs, 0);
    s[I.alt] = num(o.alt, 0);
    const oat = num(o.oatC, 15);
    s[I.oatC] = oat;
    const c = 20.0468 * Math.sqrt(Math.max(1, oat + 273.15));   // sqrt(1.4 x 287.05 x T)
    s[I.c] = c;
    s[I.rho] = num(o.rho, 1.225);
    s[I.thrust] = num(o.thrust, 0); s[I.wash] = num(o.wash, 0);
    s[I.starved] = o.starved ? 1 : 0; s[I.energyFrac] = num(o.energyFrac, 1);
    s[I.hydroWet] = num(o.hydroWet, 0); s[I.submerged] = o.submerged ? 1 : 0;
    const thr = num(ctl.thr, 0);
    s[I.thrMaster] = thr;
    s[I.flap] = num(ctl.flap, 0); s[I.brake] = num(ctl.brake, 0);
    s[I.de] = num(ctl.de, 0); s[I.da] = num(ctl.da, 0); s[I.dr] = num(ctl.dr, 0);
    // the engines: the solver's own numbers, then the voices' frequencies off them
    const rpmA = o.rpm, rpmEA = o.rpmEng, TP = o.thrustPer, E = sim && sim.eng, L = ctl.eng, V = s[I.V];
    for (let i = 0; i < nE; i++) {
      // array reads with a unary plus (see thrustPer below): a hole reads NaN, never a boxed undefined
      const rp0 = rpmA ? +rpmA[i] : 0, rp = rp0 === rp0 ? rp0 : 0;
      const re0 = rpmEA ? +rpmEA[i] : rp * out.gear[i], re = re0 === re0 ? re0 : rp * out.gear[i];
      out.rpm[i] = rp; out.rpmEng[i] = re;
      const le = L && L[i];
      out.thr[i] = Math.max(0, Math.min(1, thr * (le ? (le.on ? +le.thr : 0) : 1)));
      const e = E && E[i];
      out.running[i] = e ? (e.running ? 1 : 0) : 1;
      out.crank[i] = e ? num(e.crank, 0) : 0;
      out.key[i] = e && AP_KEY[e.key] != null ? AP_KEY[e.key] : AP_KEY.both;
      // (+x: the solver's thrustPer is a HOLEY double array - `Ti.length = nE` - and a plain read merges with
      // undefined, which boxes; the unary plus keeps the load a float64, a hole reading NaN -> 0)
      const tp = TP ? +TP[i] : 0;
      out.thrustPer[i] = tp === tp ? tp : 0;
      out.fireHz[i] = re / 60 * (out.twoStroke[i] ? out.cyl[i] : out.cyl[i] / 2);
      out.bpfHz[i] = rp / 60 * out.blades[i];
      const tip = Math.PI * out.D[i] * rp / 60;
      out.tipM[i] = tip / c;
      out.tipMh[i] = Math.sqrt(tip * tip + V * V) / c;
    }
    // the listener
    const md = cam && cam.mode, ig = !!(cam && cam.inGarage);
    s[I.camMode] = md != null && AP_CAM[md] != null ? AP_CAM[md] : -1;
    s[I.inGarage] = ig ? 1 : 0;
    s[I.interior] = !ig && md === 'cockpit' ? 1 : 0;
    s[I.held] = cam && cam.held ? 1 : 0;
    const lp = cam && cam.p;   // a Float64Array(3) (audio.js: no box per frame), else { x, y, z }
    if (lp) { s[I.listenerX] = lp[0]; s[I.listenerY] = lp[1]; s[I.listenerZ] = lp[2]; }
    else { s[I.listenerX] = num(cam && cam.x, 0); s[I.listenerY] = num(cam && cam.y, 0); s[I.listenerZ] = num(cam && cam.z, 0); }
    // the contacts and what is under them, at AP_CONTACT_HZ
    const clk = out.clk;
    clk[0] += num(dt, 0);
    if (clk[0] >= 1 / AP_CONTACT_HZ) {
      clk[0] = 0;
      const wc = sim && typeof sim.wheelContacts === 'function' ? sim.wheelContacts() : null;
      const m = wc && wc.mains, W = out.wheelNode;
      const m0 = m && m.length > 0 && m[0] ? 1 : 0, m1 = m && m.length > 1 && m[1] ? 1 : 0, tw = wc && wc.tw ? 1 : 0;
      const wat = wc && wc.water ? 1 : 0;
      s[I.main0] = m0; s[I.main1] = m1; s[I.tail] = tw; s[I.water] = wat;
      s[I.onGround] = m0 + m1 + tw;
      s[I.surf0] = m0 ? (wat ? AP_SURF_WATER : surfAt(world, sim, W[0])) : -1;
      s[I.surf1] = m1 ? (wat ? AP_SURF_WATER : surfAt(world, sim, W[1])) : -1;
      s[I.surfT] = tw ? (wat ? AP_SURF_WATER : surfAt(world, sim, W[2])) : -1;
    }
    return out;
  }

  return { audioParams, audioParamsBlock, audioResolve, AP_SCALARS, AP_ENGINE, AP_MAX_ENG, AP_CAM, AP_KEY, AP_FAMILY,
           AP_FALLBACK, AP_CONTACT_HZ, I };
})();
if (typeof window !== 'undefined') window.AUDIO_PARAMS = AUDIO_PARAMS;
if (typeof module !== 'undefined' && module.exports) module.exports = AUDIO_PARAMS;
