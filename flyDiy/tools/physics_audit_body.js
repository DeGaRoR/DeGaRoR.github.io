#!/usr/bin/env node
// PHYSICS AUDIT - THE FUSELAGE STUDY (22 Nov 2026; reports/FUSELAGE-DRAG-STUDY-2026-11-22.md). A PROTOTYPE, node-side:
// nothing in the core reads it. It asks what a fuselage law built from the SHAPE the card already carries would bill,
// beside what the core bills today (62_gen_aero genFusCdA: wetted area x a per-material coefficient x a fineness form
// factor x a box factor that is 1.058 on every card).
//
// THE LAW TRIED (each term a known piece of handbook physics; the constants are first values, to be calibrated):
//   friction  Swet x Cf_turbulent(Re of the body's own length at its own cruise speed)
//             x (1 - lam x 0.85)        lam = the share of the wetted area ahead of the largest section that can stay
//                                       laminar: a moulded skin, no propeller on the nose, a round section
//             x kSkin                   what the construction leaves on the surface (moulded 1.08 ... tent cloth 1.6)
//   form      x FF(fineness)            the core's own 1 + 60 / f3 + f / 400
//   section   x kSec                    1 + K_CORNER x (1 - roundness)^2: sharp corners, from the card's topRound /
//                                       botRound rows and its tumblehome (roofHalfW / halfW) - rows the core never reads
//   screen    + cWs x the windscreen's frontal step (its width x its height over the cowl deck), by its style (0.12 a
//             raked wrap-round screen: the value that leaves the Cessna 172 where it is; 0.05 a blown canopy)
//   (cross)   the cross-flow drag of the planform at the climb's incidence, printed apart: a sharp box against a tube
//
//   node tools/physics_audit_body.js [--audit=<physics_audit --json file>]
'use strict';
const path = require('path'), fs = require('fs');
const T = __dirname;
const C = require(path.join(T, 'flight_core.js')), RC = require(path.join(T, 'real_check.js'));
const opt = (k, d) => { const a = process.argv.slice(2).find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const NU = 1.46e-5;
const K = { lamCf: 0.85, corner: 0.6, kSkin: { glass: 1.08, carbon: 1.08, wood: 1.20, alloy: 1.30, tubeFabric: 1.40, aluTube: 1.40, softShell: 1.60 },
            ws: { screen: 0.12, bubble: 0.05 }, crossSharp: 2.0, crossRound: 0.6 };
const cfT = Re => 0.455 / Math.pow(Math.log10(Re), 2.58);
const KEYS = ['c172v2', 'cub', 'dc3r', 'jodelg', 'carboncubss', 'chinookm', 'pc6', 'etrainer', 'archaeo', 'petrel42', 'tigermothm', 'stearman', 'camelm', 'pa18f', 'ruckus'];
let audit = null; try { const a = JSON.parse(fs.readFileSync(opt('audit', ''), 'utf8')); audit = Array.isArray(a) ? a : Object.values(a); } catch (e) {}
const rows = [];
for (const key of KEYS) {
  const P = RC.PLANES[key]; if (!P) continue;
  const { spec } = RC.loadSpec(P), def = C.buildGen(JSON.parse(JSON.stringify(spec)));
  const S = def.spec, g = def.params.gen, d = g.drag, ST = def.parts.ST, cg = spec.cage || {};
  const Vc = 1.6 * g.Vs, Re = Vc * d.L / NU;
  // the card's own shape rows
  const rT = Math.max(0, Math.min(1, +cg.topRound || 0)), rB = Math.max(0, Math.min(1, +cg.botRound || 0));
  const tumble = cg.halfW > 0 && cg.roofHalfW > 0 ? Math.min(1, cg.roofHalfW / cg.halfW) : 1;
  // roundness: the two rows, and shoulders pulled in count as half a rounding of the top
  const round = Math.min(1, 0.5 * (Math.max(rT, 0.5 * (1 - tumble) / 0.6) + rB));
  // the forebody: the wetted share ahead of the largest section
  let iMax = 0; for (let i = 0; i < ST.length; i++) if (ST[i].w * (ST[i].yt - ST[i].yb) > ST[iMax].w * (ST[iMax].yt - ST[iMax].yb)) iMax = i;
  const fore = Math.max(0.1, Math.min(0.5, (ST[iMax].x - ST[0].x + (S.cowl && S.cowl.len || 0)) / d.L));
  const eng = (def.params.engine) || {}, unpow = typeof C.genUnpowered === 'function' && C.genUnpowered(S);
  const nosProp = !unpow && !(S.engAt || []).some(e => e && e.mount && e.mount !== 'nose') && (S.engines || []).length > 0;
  const moulded = S.material === 'glass' || S.material === 'carbon';
  const lam = moulded && !nosProp ? fore * Math.max(0.3, round) / 1 : 0;
  const kSkin = K.kSkin[S.material] || 1.4;
  const kSec = 1 + K.corner * (1 - round) * (1 - round);
  const fric = d.swet * cfT(Re) * (1 - lam * K.lamCf) * kSkin * d.FF * (d.hullK || 1);
  const sect = fric * (kSec - 1);
  // the windscreen's frontal step: the cabin's width x its height over the cowl deck
  const cb = S.cab || {}, cn = cb.canopy || {}, fu = S.fuse || {};
  const hCab = Math.max(...ST.map(s => s.yt - s.yb)), wCab = 2 * Math.max(...ST.map(s => s.w));
  const style = cb.glazing === 'none' ? 'none' : cn.style === 'bubble' ? 'bubble' : 'screen';
  const aWs = style === 'none' ? 0 : wCab * hCab * (1 - (fu.cowlDeck == null ? 0.66 : fu.cowlDeck));
  // (an open cockpit keeps the core's own figure: the hole and its occupants, not a screen)
  const ws = style === 'none' ? d.screen : K.ws[style] * aWs * (0.5 + 0.5 * (1 - round));          // a rounded body wraps its screen
  // the cross-flow at the climb (6 deg of local incidence): not in the cruise figure
  const plan = d.L * wCab * 0.7, sin3 = Math.pow(Math.sin(6 * Math.PI / 180), 3);
  const cross = (K.crossRound + (K.crossSharp - K.crossRound) * (1 - round) * (1 - round)) * plan * sin3;
  const today = d.body + d.screen, now = fric + sect + ws;
  const A = audit && audit.find(x => x.key === key);
  rows.push({ key, mat: S.material, swet: d.swet, front: d.frontal, f: d.f, rT, rB, tumble, round, lam, kSec, aWs, style,
              today, fric, sect, ws, now, cross, CdS: A && A.CdS, S: A && A.S, AR: A && A.AR, e: A && A.e, LD: A && A.fig && A.fig.LD });
}
const f = (x, n = 3) => x == null || !isFinite(x) ? '-' : (+x).toFixed(n);
console.log('| plane | skin | Swet | fineness | round top / bottom | shoulders | roundness | laminar share | body + screen TODAY | Cd on frontal | friction x form | corners | windscreen | THE LAW | Cd on frontal | change m² | whole aeroplane m² | glide today → law | (cross-flow at the climb) |');
console.log('|' + '---|'.repeat(19));
for (const r of rows) {
  const dl = r.now - r.today, cds = r.CdS != null ? r.CdS + dl : null;
  const ld = (cd0S) => r.S && r.e && r.AR ? 0.5 * Math.sqrt(Math.PI * r.e * r.AR * r.S / cd0S) : null;
  console.log('| ' + [r.key, r.mat, f(r.swet, 1), f(r.f, 1), f(r.rT, 2) + ' / ' + f(r.rB, 2), f(r.tumble, 2), f(r.round, 2), f(r.lam, 2), f(r.today), f(r.today / r.front),
    f(r.fric), f(r.sect), f(r.ws) + ' (' + f(r.aWs, 2) + ' m², ' + r.style + ')', '**' + f(r.now) + '**', f(r.now / r.front), (dl >= 0 ? '+' : '') + f(dl),
    r.CdS != null ? f(r.CdS) + ' → ' + f(cds) : '-', r.CdS != null ? f(ld(r.CdS), 1) + ' → ' + f(ld(cds), 1) : '-', f(r.cross)].join(' | ') + ' |');
}
