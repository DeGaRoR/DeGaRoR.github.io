#!/usr/bin/env node
// PHYSICS AUDIT - A LIGHT LAMINAR / TURBULENT SECTION MODEL (FUSELAGE-DRAG STUDY, 22 Nov 2026). A PROTOTYPE, node-side.
// Today a lifting surface's profile drag is 0.0055 + 0.018 t + a material term: a turbulent section, whatever it is
// made of. Tried here: the flat plate with ONE transition point per surface, times the section's thickness factor.
//   cd0 = 2 x Cf(Re_chord, xtr) x (1 + 2 t + 60 t^4)                                  (Hoerner, section drag)
//   Cf(Re, xtr) = Cf_turb(Re) - xtr x (Cf_turb(xtr Re) - Cf_lam(xtr Re))               (the mixed plate)
//   xtr = the share of the chord the layer stays laminar: by the surface's construction, and none behind a propeller
//         or a slat. First values: a moulded shell 0.55 on a section drawn for it; plywood or a D-tube 0.25 (to the
//         spar); riveted alloy 0.10; fabric on ribs 0.05
//   node tools/physics_audit_section.js [--audit=<physics_audit --json>]
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname, C = require(path.join(T, 'flight_core.js')), RC = require(path.join(T, 'real_check.js'));
const opt = (k, d) => { const a = process.argv.slice(2).find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const NU = 1.46e-5;
const cfT = Re => 0.455 / Math.pow(Math.log10(Re), 2.58), cfL = Re => 1.328 / Math.sqrt(Re);
const cfMix = (Re, x) => x > 0 ? cfT(Re) - x * (cfT(x * Re) - cfL(x * Re)) : cfT(Re);
const XTR = { glass: 0.55, carbon: 0.55, wood: 0.25, dtube: 0.25, alloy: 0.10, fabric: 0.05, steel: 0.05, fabricAlu: 0.05, aluTube: 0.05 };
const kT = t => 1 + 2 * t + 60 * Math.pow(t, 4);
let audit = null; try { const a = JSON.parse(fs.readFileSync(opt('audit', ''), 'utf8')); audit = Array.isArray(a) ? a : Object.values(a); } catch (e) {}
const f = (x, n = 4) => x == null || !isFinite(x) ? '-' : (+x).toFixed(n);
console.log('| plane | wing skin | chord m | Reynolds (million) | thickness | laminar to | section today | the model | wing area m² | change m² | whole aeroplane today → model | glide today → model |');
console.log('|' + '---|'.repeat(12));
for (const key of ['c172v2', 'cub', 'dc3r', 'pc6', 'jodelg', 'etrainer', 'archaeo', 'petrel42', 'tigermothm', 'stearman']) {
  const P = RC.PLANES[key]; if (!P) continue;
  const { spec } = RC.loadSpec(P), def = C.buildGen(JSON.parse(JSON.stringify(spec))), S = def.spec, g = def.params.gen;
  const w = S.wings[0], mat = C.genSurfKey ? C.genSurfKey(S, 'wing') : (w.material || S.material);
  const chord = g.Sw / g.span / (S.wings.length || 1) * (S.wings.length > 1 ? 1 : 1), t = (+String(w.naca || '2412').slice(-2) || 12) / 100;
  const Vc = 1.6 * g.Vs, Re = Vc * chord / NU;
  // behind a propeller on the nose the inner wing is in its wash: that share of the span is turbulent from the leading edge
  const unpow = C.genUnpowered && C.genUnpowered(S), nose = !unpow && (S.engines || []).length > 0 && !(S.engAt || []).some(e => e && e.mount && e.mount !== 'nose');
  const wash = nose && S.prop && S.prop.D > 0 ? Math.min(1, S.prop.D / g.span) : 0;
  const stol = w.stol && (w.stol.slat && w.stol.slat !== 'none' || w.stol.vg);
  const x0 = stol ? 0 : (XTR[mat] != null ? XTR[mat] : 0.05), xtr = x0 * (1 - wash);
  const SM = C.GEN_SURF_MATERIALS[mat] || {}, matCd0 = SM.cd0 || 0;
  // today: the core's own figure (its polar, the chord's Reynolds factor already in it)
  const today = def.params.polarWing ? def.params.polarWing.Cd0 : 0.0055 + 0.018 * t + matCd0;
  // the model: the mixed plate; the skin's own term stays where the layer is turbulent anyway (fabric's scallops, rivets)
  const model = 2 * cfMix(Re, xtr) * kT(t) + matCd0 * (1 - xtr);
  const A = audit && audit.find(x => x.key === key), dl = (model - today) * g.Sw * 1.25;       // the tail's sections with it, a quarter more area
  const ld = c => A ? 0.5 * Math.sqrt(Math.PI * A.e * A.AR * A.S / c) : null;
  console.log('| ' + [key, mat, f(chord, 2), f(Re / 1e6, 1), f(t, 2), f(xtr, 2), f(today), f(model), f(g.Sw, 1), (dl >= 0 ? '+' : '') + f(dl, 3),
    A ? f(A.CdS, 3) + ' → ' + f(A.CdS + dl, 3) : '-', A ? f(ld(A.CdS), 1) + ' → ' + f(ld(A.CdS + dl), 1) : '-'].join(' | ') + ' |');
}
