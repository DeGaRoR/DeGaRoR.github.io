#!/usr/bin/env node
// PHYSICS AUDIT (21 Nov 2026) - THE PERFORMANCE MODEL TAKEN APART, PLANE BY PLANE: where real_check.js asks "does the
// plane fly its book's figures", this asks "which TERM of the model makes it miss": the mass build-up, the parasite drag
// (and which row of it), the induced drag, the maximum lift (clean, flapped, trimmed), the propeller's efficiency at the
// climb and at the top speed. Node-only, never loaded by the game; it changes nothing in the core.
//
// It is an INDEPENDENT reading on purpose: it shares real_check's load door and load cases (so the aeroplane and its
// weight are the same) but not its probes' arithmetic - the polar is measured as CL / CD over alpha (lift taken
// PERPENDICULAR to the flight path, with and without the elevator that trims it), fitted CD = CD0 + K CL^2, and every
// performance figure is then computed from that table and the thrust law. Where the two instruments disagree the table
// says so (`rc` columns).
//
//   node tools/physics_audit.js cub c172v2 ...      the planes (keys: tools/real_refs.js PLANES); --all = the live set
//   options: --load=mtow|typ|min (default mtow: the weight most books are written at), --json=<file>,
//            --proto=<name>[,<name>] the plan's PROTOTYPES (tools/physics_audit_proto.js; absent = today's model, to the
//            bit: a prototype never touches the core, it re-computes the figures from the measured polar and thrust)
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname;
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const has = k => args.includes('--' + k);
const RC = require(path.join(T, 'real_check.js'));
const C = require(path.join(T, 'flight_core.js'));
const { PLANES, REFS } = RC;
const G = 9.81, RHO = 1.225;

function loadedDef(spec, lc) {
  const def = C.buildGen(spec);
  for (const n of def.nodes) if (n.mFuel > 0) { n.m = Math.max(0.5, n.m - n.mFuel * (1 - lc.fuel)); n.mFuel *= lc.fuel; }
  for (const [i, kg] of lc.adds) def.nodes[i].m = Math.max(0.5, def.nodes[i].m + kg);
  return def;
}
// one probe: the aeroplane held level in the tunnel, the air from ahead and below by `a`; lift PERPENDICULAR to the
// flight path, drag along it, the pitching moment about the mass centre
function probe(sim, V, a) {
  const [xA, yU] = sim.axes();
  const ca = Math.cos(a), sa = Math.sin(a), vel = [0, 0, 0];
  for (let k = 0; k < 3; k++) vel[k] = -V * (ca * xA[k] + sa * yU[k]);
  const r = sim.probe(vel);
  const Fa = r.Fx * xA[0] + r.Fy * xA[1] + r.Fz * xA[2], Fu = r.Fx * yU[0] + r.Fy * yU[1] + r.Fz * yU[2];
  return { L: Fu * ca - Fa * sa, D: Fa * ca + Fu * sa, M: r.pitchUp };
}
// the elevator that zeroes the pitching moment at this attitude (two probes and a secant, held inside the travel)
function trimDe(sim, V, a) {
  const d0 = sim.ctl.de;
  sim.ctl.de = 0; const m0 = probe(sim, V, a).M;
  sim.ctl.de = 0.3; const m1 = probe(sim, V, a).M;
  const k = (m1 - m0) / 0.3;
  let de = Math.abs(k) < 1e-9 ? 0 : -m0 / k;
  const sat = Math.abs(de) > 1;
  de = Math.max(-1, Math.min(1, de));
  sim.ctl.de = d0;
  return { de, sat };
}
// THE POLAR: CL, CD over alpha at one speed (the model has no Reynolds term in flight, so one speed is the polar)
function polarOf(sim, S, flap, trimmed) {
  const V = 30, q = 0.5 * RHO * V * V, f0 = sim.ctl.flap, d0 = sim.ctl.de;
  sim.ctl.flap = flap || 0;
  const rows = [];
  for (let a = -0.12; a <= 0.50 + 1e-9; a += 0.005) {
    let de = 0, sat = false;
    if (trimmed) { const t = trimDe(sim, V, a); de = t.de; sat = t.sat; }
    sim.ctl.de = de;
    const r = probe(sim, V, a);
    rows.push({ a, CL: r.L / (q * S), CD: r.D / (q * S), de, sat });
  }
  sim.ctl.flap = f0; sim.ctl.de = d0;
  let iMax = 0; for (let i = 1; i < rows.length; i++) if (rows[i].CL > rows[iMax].CL) iMax = i;
  return { rows: rows.slice(0, iMax + 1), CLmax: rows[iMax].CL, aMax: rows[iMax].a, deMax: rows[iMax].de, satMax: rows[iMax].sat };
}
// CD = CD0 + K CL^2 over the working range (CL 0.15 .. 0.75 CLmax), least squares
function fitPolar(pol) {
  let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const r of pol.rows) {
    if (r.CL < 0.15 || r.CL > 0.75 * pol.CLmax) continue;
    const x = r.CL * r.CL; n++; sx += x; sy += r.CD; sxx += x * x; sxy += x * r.CD;
  }
  if (n < 4) return null;
  const K = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return { CD0: (sy - K * sx) / n, K, n };
}
// CD at a CL off the table (linear between rows; null past CLmax)
function cdAt(pol, CL) {
  const R = pol.rows;
  for (let i = 0; i < R.length - 1; i++) {
    const a = R[i], b = R[i + 1];
    if ((a.CL - CL) * (b.CL - CL) <= 0 && a.CL !== b.CL) return a.CD + (b.CD - a.CD) * (CL - a.CL) / (b.CL - a.CL);
  }
  return null;
}
// THE FIGURES from a polar, a thrust law T(V) (N, full power) and a weight. `x` the prototypes' extras:
//   dCdS  m2 added to the parasite area (a windmilling propeller in the glide: glide rows only, `dCdSGlide`)
function figures(pol, S, W, thrust, P, x) {
  x = x || {};
  const Vs = Math.sqrt(2 * W / (RHO * S * pol.CLmax));
  const out = { Vs, LD: 0, Vbg: 0, sink: 1e9, Vms: 0, roc: -1e9, Vy: 0, grad: -1e9, Vx: 0, Vmax: null, V75: null, etaVy: null, etaVmax: null, etaPeak: 0 };
  let prev = null;
  for (let V = Vs * 1.03; V <= Vs * 4.5; V += 0.25) {
    const q = 0.5 * RHO * V * V, CL = W / (q * S), cd = cdAt(pol, CL);
    if (cd == null) continue;
    const D = q * S * cd + q * (x.dCdS || 0), Dg = D + q * (x.dCdSGlide || 0);
    const Tv = thrust(V), exc = (Tv - D) * V / W;
    if (W / Dg > out.LD) { out.LD = W / Dg; out.Vbg = V; }
    if (Dg * V / W < out.sink) { out.sink = Dg * V / W; out.Vms = V; }
    if (exc > out.roc) { out.roc = exc; out.Vy = V; }
    if ((Tv - D) / W > out.grad) { out.grad = (Tv - D) / W; out.Vx = V; }
    if (P > 0 && Tv * V / P > out.etaPeak) out.etaPeak = Tv * V / P;
    if (prev) {
      for (const [k, fr] of [['Vmax', 1], ['V75', 0.75]]) {
        const fa = fr * prev.T - prev.D, fb = fr * Tv - D;
        if (fa >= 0 && fb < 0) out[k] = prev.V + (V - prev.V) * fa / (fa - fb);
      }
    }
    prev = { V, D, T: Tv };
  }
  if (P > 0) { out.etaVy = thrust(out.Vy) * out.Vy / P; if (out.Vmax) out.etaVmax = thrust(out.Vmax) * out.Vmax / P; }
  return out;
}

function auditPlane(key, loadId, protos) {
  const P = PLANES[key], R = REFS[P.ref];
  const { spec } = RC.loadSpec(P);
  const def0 = C.buildGen(spec), F = RC.loadFacts(def0);
  const lc = RC.cases(def0, F, R, P, false).find(c => c.id === loadId);
  const def = loadedDef(spec, lc);
  const sim = C.makeSim(def, null); sim.reset(0);
  const W = sim.totalM * G, g = def.params.gen, S = g.Sw, b = g.span, AR = b * b / S;
  const poh = R.poh || {};
  const fl = def.spec.controls && def.spec.controls.flap;
  const frac = deg => (!deg || !fl || !fl.type || fl.type === 'none' || !def.params.flaps) ? 0 : Math.min(1, deg * Math.PI / 180 / C.genTravel('flap', fl.type));
  const fTO = frac(poh.flapTO), fL = frac(poh.flapLDG);
  const clean = polarOf(sim, S, 0, false), cleanT = polarOf(sim, S, 0, true);
  const ldg = fL ? polarOf(sim, S, fL, false) : null, ldgT = fL ? polarOf(sim, S, fL, true) : null;
  const fit = fitPolar(clean), fitT = fitPolar(cleanT);
  const nE = def.params.nEngines || 1, Psh = ((def.params.engine && def.params.engine.powerW) || 0) * nE * sim.probeAir().power;
  const thrust = V => sim.thrustAt(V, 0);
  const fig = figures(clean, S, W, thrust, Psh), figT = figures(cleanT, S, W, thrust, Psh);
  const L = def0.parts.ledger || {}, ledger = {}; let empty = 0;
  for (const k in L) if (!L[k].payload) { ledger[k] = L[k].mass; empty += L[k].mass; }
  const dr = g.drag || {};
  const out = {
    key, ref: P.ref, label: P.label, load: loadId, mass: sim.totalM, W, S, span: b, AR, empty, ledger,
    engine: def.params.engine && def.params.engine.name, P: Psh, nE, T0: thrust(0),
    prop: def.params.prop ? { D: def.params.prop.D, blades: def.params.prop.blades, pitch: def.params.prop.pitchUsed || def.params.prop.pitch, V0: def.params.prop.V0, fm: def.params.prop.fm } : null,
    CLmax: clean.CLmax, CLmaxTrim: cleanT.CLmax, deAtCLmax: cleanT.deMax, deSat: cleanT.satMax,
    CLmaxLdg: ldg && ldg.CLmax, CLmaxLdgTrim: ldgT && ldgT.CLmax, deSatLdg: ldgT && ldgT.satMax, flapLdg: fL, flapTO: fTO,
    CD0: fit && fit.CD0, K: fit && fit.K, e: fit && 1 / (Math.PI * AR * fit.K), CdS: fit && fit.CD0 * S,
    CD0Trim: fitT && fitT.CD0, eTrim: fitT && 1 / (Math.PI * AR * fitT.K),
    drag: { axial: dr.axial, body: dr.body, cool: dr.cool, heads: dr.heads, screen: dr.screen, junct: dr.junct, exh: dr.exh, gear: dr.gear, brace: dr.brace,
            surfaces: fit && dr.axial != null ? fit.CD0 * S - dr.axial : null, swet: dr.swet },
    fig, figT,
    Vs0: ldg ? Math.sqrt(2 * W / (RHO * S * ldg.CLmax)) : null, Vs0Trim: ldgT ? Math.sqrt(2 * W / (RHO * S * ldgT.CLmax)) : null,
  };
  if (protos && protos.length) {
    const PR = require(path.join(T, 'physics_audit_proto.js'));
    out.proto = PR.apply(protos, { key, P, R, def, sim, spec, S, W, Psh, nE, clean, cleanT, ldg, ldgT, thrust, figures, base: out });
  }
  return out;
}

const kmh = v => v == null ? null : v * 3.6;
const f = (v, d = 0) => (v == null || typeof v !== 'number' || !isFinite(v)) ? '-' : v.toFixed(d);
function line(o) {
  const a = o.fig, t = o.figT;
  return [o.key.padEnd(12), f(o.mass).padStart(5), 'S ' + f(o.S, 1), 'AR ' + f(o.AR, 1), '| CD0 ' + f(o.CD0, 4), 'CdS ' + f(o.CdS, 3), 'e ' + f(o.e, 2),
          '| CLmax ' + f(o.CLmax, 2) + '/' + f(o.CLmaxTrim, 2) + (o.deSat ? '*' : ''), o.CLmaxLdg ? 'ldg ' + f(o.CLmaxLdg, 2) + '/' + f(o.CLmaxLdgTrim, 2) + (o.deSatLdg ? '*' : '') : '',
          '| Vs ' + f(kmh(a.Vs)) + '/' + f(kmh(t.Vs)), 'L/D ' + f(a.LD, 1) + '@' + f(kmh(a.Vbg)), 'sink ' + f(a.sink, 2) + '@' + f(kmh(a.Vms)),
          '| ROC ' + f(a.roc, 2) + '@' + f(kmh(a.Vy)), 'Vmax ' + f(kmh(a.Vmax)), 'V75 ' + f(kmh(a.V75)),
          '| eta Vy ' + f(a.etaVy, 2), 'Vmax ' + f(a.etaVmax, 2), 'peak ' + f(a.etaPeak, 2)].join('  ');
}

if (require.main === module) {
  let keys = args.filter(a => !a.startsWith('--'));
  if (has('all')) keys = require(path.join(T, '_real_stamp.js')).liveKeys(PLANES);
  if (!keys.length) { console.log('usage: node tools/physics_audit.js <key>... | --all  [--load=mtow|typ|min] [--json=f] [--proto=a,b]'); process.exit(2); }
  const protos = opt('proto', '').split(',').filter(Boolean), res = [];
  for (const k of keys) {
    if (!PLANES[k]) { console.log('no plane ' + k); continue; }
    try { const o = auditPlane(k, opt('load', 'mtow'), protos); res.push(o); console.log(line(o)); }
    catch (e) { console.log(k + ': FAILED ' + (e && e.stack || e)); }
  }
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(res, null, 1));
}
module.exports = { auditPlane, polarOf, fitPolar, figures, cdAt, probe, loadedDef };
