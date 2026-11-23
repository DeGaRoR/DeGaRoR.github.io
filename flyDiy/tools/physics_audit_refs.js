#!/usr/bin/env node
// PHYSICS AUDIT - THE REAL AEROPLANES' IMPLIED DRAG AND PROPELLER (21 Nov 2026): what the published figures of the
// best-documented parents say about the two terms no book prints - the parasite drag area f (CD0 x S) and the propeller's
// efficiency in the climb - set beside the model's own. Node-only; reads the audit's JSON (physics_audit.js --all --json).
//   f_real   from the level top speed: eta x P = D x V, eta = etaBlade x the actuator disc's ideal efficiency (the same
//            law the plan's propeller prototype uses; etaBlade wood 0.79, metal / composite 0.84, each +-0.03 for the
//            range), less the induced drag at that speed (the MODEL's own span efficiency - a few per cent of the total)
//   eta_Vy   the efficiency the published climb needs at the book's Vy, on the model's own polar at that weight
// THE ROWS state the weight, power and altitude each figure was flown at; a row marked `thin` is one source or a
// condition this session could not confirm.
'use strict';
const fs = require('fs'), path = require('path');
const PR = require(path.join(__dirname, 'physics_audit_proto.js'));
const C = require(path.join(__dirname, 'flight_core.js'));
const KT = 1.852, MPH = 1.609344, FPM = 0.00508;
// kg, m2, m; P kW per engine AT THE ROW'S CONDITION; Vmax km/h TAS at alt m; roc m/s at Vy km/h (CAS) at Pc kW
const ROWS = {
  c172v2:   { name: 'Cessna 172R', W: 1111, S: 16.17, b: 11.00, nE: 1, D: 1.905, mat: 'alu', P: 119.3, Vmax: 123 * KT, alt: 0, roc: 720 * FPM, Vy: 79 * KT, Pc: 119.3,
              lit: { CD0: 0.0319, LD: 11.6, src: 'Loftin, NASA SP-468 (Skyhawk)' }, src: '172R POH: 123 KTAS at sea level, 720 fpm at 79 KIAS, 2450 lb' },
  cub:      { name: 'Piper J-3C-65', W: 550, S: 16.58, b: 10.74, nE: 1, D: 1.83, mat: 'wood', P: 48.5, Vmax: 87 * MPH, alt: 0, roc: 450 * FPM, Vy: 55 * MPH, Pc: 48.5,
              lit: { CD0: 0.0373, LD: 9.6, src: 'Loftin, NASA SP-468' }, src: 'J-3C-65 sheet: 87 mph, 450 fpm (the weight not stated; read at gross)', thin: 'IAS on a 1940s ASI; weight unstated' },
  dc3r:     { name: 'Douglas DC-3A', W: 11431, S: 91.7, b: 28.96, nE: 2, D: 3.51, mat: 'alu', cs: true, P: 783, Vmax: 230 * MPH, alt: 2591, roc: 1130 * FPM, Vy: 110 * KT, Pc: 783,
              lit: { CD0: 0.0249, LD: 14.7, src: 'Loftin, NASA SP-468' }, src: 'Francillon: 230 mph at 8,500 ft; 1,130 fpm at 25,200 lb; METO 1,050 hp', thin: 'the power at 8,500 ft is taken as METO 1,050 hp' },
  pc6:      { name: 'Pilatus PC-6/B2-H4', W: 2800, S: 30.15, b: 15.87, nE: 1, D: 2.56, mat: 'alu', cs: true, P: 410, Vmax: 125 * KT, alt: 0, roc: 5.13, Vy: 75 * KT, Pc: 410,
              alt2: { P: 373, alt: 3048, note: '125 KTAS read at 10,000 ft on ~500 shp (the usual statement of the type\'s max cruise; the factsheet row states no altitude)' },
              src: 'Pilatus factsheet: max cruise 125 KTAS, 1010 fpm at 2800 kg', thin: 'the altitude and the power of the 125 KTAS are not stated; Vy assumed 75 KIAS' },
  tigermothm: { name: 'DH.82A Tiger Moth', W: 828, S: 22.2, b: 8.94, nE: 1, D: 1.93, mat: 'wood', P: 97, Vmax: 109 * MPH, alt: 0, roc: 600 * FPM, Vy: 66 * MPH, Pc: 97,
              src: 'Jackson: 109 mph; AAIB 1/2019: 500-650 fpm at 66 mph, 1,760-1,790 lb', thin: 'the top speed\'s altitude is not confirmed' },
  stearman: { name: 'Boeing-Stearman PT-17', W: 1232, S: 27.6, b: 9.80, nE: 1, D: 2.59, mat: 'alu', P: 164, Vmax: 124 * MPH, alt: 0, roc: 840 * FPM, Vy: 75 * MPH, Pc: 164,
              src: 'type sheets: 124 mph, 840 fpm at 2,717 lb', thin: 'search extracts; Vy assumed 75 mph' },
  camelm:   { name: 'Sopwith Camel F.1', W: 659, S: 21.46, b: 8.53, nE: 1, D: 2.59, mat: 'wood', P: 97, Vmax: 185, alt: 0,
              lit: { CD0: 0.0378, LD: 7.7, src: 'Loftin, NASA SP-468' }, src: '185 km/h (one database)', thin: 'one source' },
  petrel42: { name: 'Super Petrel LS', W: 600, S: 15.0, b: 8.90, nE: 1, D: 1.72, mat: 'carbon', P: 69, Vmax: 100 * KT, alt: 0, roc: 1000 * FPM, Vy: 65 * KT, Pc: 73.5,
              src: 'maker: max cruise 100 kt (912 iS at max continuous, 69 kW), 1000 fpm', thin: 'weights not stated (read at 600 kg); Vy assumed' },
  ruckus:   { name: 'Top Rudder Ruckus', W: 249, S: 11.33, b: 8.66, nE: 1, D: 1.60, mat: 'carbon', P: 27.6, Vmax: 54 * MPH, alt: 0, roc: 650 * FPM, Vy: 30 * MPH, Pc: 27.6,
              lit: { CD0: 0.13, LD: 4.6, src: 'the maker\'s own drag polar CD = 0.13 + 0.088 CL^2' }, src: 'B&B sheet: 54 mph at 37 hp, 650 fpm at 30 mph', thin: 'a designer\'s calculation (it implies a constant 57 % propeller)' },
  etrainer: { name: 'Pipistrel Velis Electro', W: 600, S: 9.51, b: 10.71, nE: 1, D: 1.64, mat: 'carbon', P: 49.2, roc: 647 * FPM, Vy: 75 * KT, Pc: 48,
              glide: { LD: 15, V: 64 * KT, prop: 'electric' }, src: 'POH-128: 647 fpm at 75 KIAS on 48 kW; best glide 15:1; VH is rpm-limited (no top-speed row)' },
};
const RHO0 = 1.225, G = 9.81;
function fReal(r, K, etaB, P, alt) {
  const sg = alt ? C.ATMOS_ISA.sigma(alt) : 1, rho = RHO0 * sg, V = r.Vmax / 3.6, q = 0.5 * rho * V * V, A = Math.PI * r.D * r.D / 4;
  const T = r.nE * PR.momentumT(P * 1000, A, V, etaB, rho), W = r.W * G, CL = W / (q * r.S);
  return { f: T / q - K * CL * CL * r.S, eta: T * V / (r.nE * P * 1000) };
}
if (require.main === module) {
  const inF = process.argv.slice(2).find(a => !a.startsWith('--'));
  if (!inF) { console.log('usage: node tools/physics_audit_refs.js <audit.json (physics_audit.js --all --proto=gearup --json=...)>'); process.exit(2); }
  const A = JSON.parse(fs.readFileSync(inF, 'utf8')), f = (v, d = 2) => v == null || !isFinite(v) ? '-' : (+v).toFixed(d);
  const L = ['| plane | real f m2 from the top speed (eta there) | literature f | model f (clean, wheels up) | model / real | eta the book\'s climb needs at Vy | model eta at Vy today | thin? |', '|---|---|---|---|---|---|---|---|'];
  const out = {};
  for (const k of Object.keys(ROWS)) {
    const r = ROWS[k], a = A.find(x => x.key === k); if (!a) continue;
    const K = a.K, fm = a.CdS + ((a.proto && a.proto.notes && a.proto.notes.gearup) || 0);
    const etaB = PR.ETA_BLADE[r.mat] || 0.79;
    let cell = '-', mid = null;
    if (r.Vmax) {
      const lo = fReal(r, K, etaB - 0.03, r.P, r.alt), hi = fReal(r, K, etaB + 0.03, r.P, r.alt), m = fReal(r, K, etaB, r.P, r.alt); mid = m.f;
      cell = f(m.f) + ' (' + f(lo.f) + '-' + f(hi.f) + '; eta ' + f(m.eta) + ')';
      if (r.alt2) { const m2 = fReal(r, K, etaB, r.alt2.P, r.alt2.alt); cell += '; at 10,000 ft ' + f(m2.f); mid = 0.5 * (m.f + m2.f); }
    } else if (r.glide) {
      // from the flown glide: (L/D)max = 1 / (2 sqrt(K CD0)) -> CD0 at a span efficiency of 0.85 (a clean cantilever
      // wing; the model's own K is what is under test there), less the idle propeller's
      const Kr = 1 / (Math.PI * (r.b * r.b / r.S) * 0.85), CD0 = 1 / (4 * Kr * r.glide.LD * r.glide.LD); mid = CD0 * r.S - PR.KW_IDLE[r.glide.prop] * Math.PI * r.D * r.D / 4;
      cell = f(mid) + ' (from the glide ' + r.glide.LD + ':1 at e 0.85, less the idle propeller)';
    }
    // the climb: eta = (W roc + D V) / P on the model's polar at the book's weight and Vy
    let etaVy = null;
    if (r.roc && r.Vy) { const V = r.Vy / 3.6, q = 0.5 * RHO0 * V * V, W = r.W * G, CL = W / (q * r.S), D = q * r.S * (a.CD0 + ((a.proto && a.proto.notes && a.proto.notes.gearup) || 0) / a.S + K * CL * CL); etaVy = (W * r.roc + D * V) / (r.nE * r.Pc * 1000); }
    const lit = r.lit ? f(r.lit.CD0 * r.S) + ' (' + r.lit.src + ')' : '-';
    L.push('| ' + r.name + ' | ' + cell + ' | ' + lit + ' | ' + f(fm) + ' | ' + (mid ? f(fm / mid) : '-') + ' | ' + f(etaVy) + ' | ' + f(a.fig.etaVy) + ' | ' + (r.thin || '') + ' |');
    out[k] = { fReal: mid, fModel: fm, etaVyNeeded: etaVy, etaVyModel: a.fig.etaVy };
  }
  console.log(L.join('\n'));
  const o = process.argv.slice(2).find(a => a.startsWith('--json=')); if (o) fs.writeFileSync(o.slice(7), JSON.stringify({ rows: ROWS, out }, null, 1) + '\n');
}
module.exports = { ROWS };
