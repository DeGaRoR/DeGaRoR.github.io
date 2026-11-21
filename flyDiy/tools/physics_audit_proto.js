// PHYSICS AUDIT - THE PLAN'S PROTOTYPES (21 Nov 2026). Node-only. NOTHING HERE TOUCHES THE CORE: a prototype takes the
// polar and the thrust law tools/physics_audit.js measured off today's build and re-computes the performance figures
// with one term changed. Absent (no --proto) the audit is today's model to the bit; the game never loads this file.
// Each prototype is what a core change WOULD do to the figures, so the plan's expected moves are measured, not guessed.
//
// TWO KINDS. An INSTRUMENT prototype (I*) changes how real_check should READ the aeroplane (the model is untouched: the
// gear up, the row's altitude, the row's power, the propeller as the book glides it, the trimmed stall). A MODEL
// prototype (M*) changes a term of the performance model.
//   I1 gearup    a retractable's cruise / climb / glide rows wheels UP (real_check --quick probes a reset sim: gear down)
//   I2 alt       a level-speed row stated at an altitude is read at that altitude (REFS row.alt), TAS
//   I3 power     the climb row at the power its book states (REFS poh.climbPowerK), not the take-off rating
//   I5 trim      the stall with the elevator that trims it (the probe's peak lift is untrimmed)
//   M1 prop      PROP-SYNTH 2. A FIXED PITCH keeps today's law T = T0 - k V^2 and today's static thrust (the pitch
//                class's fm: validated on the Cub's and the 172's rolls and climbs); only `k` changes - set by the thrust
//                at the aeroplane's OWN top speed, eta = etaBlade x the actuator disc's ideal efficiency there (etaBlade
//                by the blade's material: wood 0.79, metal / composite 0.84), where today V0 = 1.95 P / T0 pins the peak
//                (75 % for every propeller) at a speed set by the disc loading alone; a slow aeroplane on a big disc
//                keeps at least its top-speed thrust standing (T0 >= 1.02 Tref), and no propeller pulls more than the
//                actuator disc allows at any speed (T <= etaBlade x ideal). A CONSTANT-SPEED propeller flies the
//                actuator disc itself at every speed (etaBlade x ideal), capped standing at fm 0.65 - a governed blade
//                stays matched, which no quadratic through two points can follow (it over-reads the climb by 7-23 %)
//                (first cut, REJECTED and kept in propSynth2 for the record: the static thrust from the match too -
//                it took 12 % off the 172's static thrust and 27 % onto its roll)
//   M2 oswald    the span efficiency above aspect ratio 8: 1 / (1/0.95 + pi AR kv) where Raymer's straight-wing fit
//                (valid to AR ~10) falls away; kv by the surface (a smooth composite 0.0035, else 0.007)
//   M3 idleprop  the propeller at idle in the glide: a windmilling fixed-pitch disc CdA = 0.10 A (an electric's 0.03 A)
//   M5 targetf   NOT a prototype - a TARGET: the parasite drag area set to what the parent's own figures imply
//                (TARGET_F, from tools/physics_audit_refs.js), to show where the roster would read if the drag-row
//                study (the plan's last step) lands; only the planes whose model f is more than 10 % off
//   M4 wires     bracing wires: a biplane's flying wires are streamline (RAF) wires (Cd 0.35 on the same thickness); a
//                cantilever tail (an alloy or composite airframe) carries no tail brace wires
'use strict';
const path = require('path');
const C = require(path.join(__dirname, 'flight_core.js'));
const RHO0 = 1.225, G = 9.81;

// which planes fly a constant-speed propeller (the registry's `cs` on the turbines; the DC-3's Hamilton Standards have
// no row yet: PROP-CLASSES' class is not on master - named here so the prototype can say what the row would do)
const CS_BY_KEY = { dc3r: true, dc3: true };
// the cards whose real parent has a CANTILEVER tail (no brace wires): the core bills four tail cables on every build
const TAIL_CANT = { etrainer: true, archaeo: true, dc3r: true, dc3: true, c172v2: true, ls4: true };
// the power a row was flown at, as a fraction of the build's rated power, where the book states it (I3)
const POWER_K = { velis: { roc: 48 / 57.6, Vmax: 49.2 / 57.6, TO: 50 / 57.6, why: 'POH-128: the climb at 48 kW (MCP), VH at max continuous, the take-off at 50 kW' },
                  petrel: { Vmax: 69 / 73.5, why: 'max cruise at the 912 iS\'s max continuous 69 kW' } };
// M5 targetf: the clean parasite drag area (m2) the parent's figures imply (physics_audit_refs.js; the PC-6: the middle
// of 1.73 at sea level and 1.96 at 10,000 ft; the gliders from their best glide at e 0.85)
const TARGET_F = { pc6: 1.85, pc6f: 1.85 + 0.115, petrel42: 0.59, stearman: 1.12, camelm: 0.82, tigermothm: 0.88, etrainer: 0.28, archaeo: 0.157, ls4: 0.091 };
// the pitch class moves a fixed propeller's design speed (the fraction of the aeroplane's own top speed it is cut for)
const PITCH_K = { climb: 0.85, standard: 1.0, cruise: 1.10, seaplane: 0.75 };
const ETA_BLADE = { wood: 0.79, maple: 0.79, walnut: 0.79, alu: 0.84, carbon: 0.84 };
const KW_IDLE = { piston: 0.10, electric: 0.03, turbine: 0.02 };

// the actuator disc: the thrust a propeller absorbing P at V makes at blade efficiency etaB
function momentumT(P, A, V, etaB, rho) {
  if (!(V > 0.5)) return Math.cbrt(2 * rho * A) * Math.pow(etaB * P, 2 / 3);
  let Tv = etaB * P / V;
  for (let i = 0; i < 12; i++) {
    const q = 0.5 * rho * V * V, etaI = 2 / (1 + Math.sqrt(1 + Tv / (q * A)));
    Tv = 0.5 * Tv + 0.5 * etaB * etaI * P / V;
  }
  return Tv;
}
// PROP-SYNTH 2: { T0, k } per propeller for a design speed Vref
function propSynth2(o) {
  const A = Math.PI * o.D * o.D / 4, ideal = Math.cbrt(2 * RHO0 * A) * Math.pow(o.P, 2 / 3);
  const vh = Math.cbrt(o.P / (2 * RHO0 * A)), lam = o.Vref / vh;
  const bl = 1 + 0.055 * ((o.blades || 2) - 2);
  const fm = (o.cs ? 0.65 : Math.max(0.40, Math.min(0.65, 0.689 - 0.107 * lam))) * bl;
  let T0 = fm * ideal;
  const Tref = momentumT(o.P, A, o.Vref, o.etaB, RHO0);
  if (T0 < 1.02 * Tref) T0 = 1.02 * Tref;             // a slow aeroplane on a big disc: the thrust is nearly flat
  return { T0, k: (T0 - Tref) / (o.Vref * o.Vref), fm: T0 / ideal, lam, Tref, etaRef: Tref * o.Vref / o.P };
}
function raymerE(AR) { return 1.78 * (1 - 0.045 * Math.pow(AR, 0.68)) - 0.64; }
function physE(AR, kv) { return 1 / (1 / 0.95 + Math.PI * AR * kv); }

function apply(names, ctx) {
  const has = n => names.includes(n) || (names.includes('all') && n !== 'targetf') || (names.includes('instr') && /^(gearup|alt|power|trim)$/.test(n))
                   || (names.includes('model') && /^(prop|oswald|idleprop|wires)$/.test(n));
  const { def, sim, S, W, nE, key, R, P } = ctx;
  const g = def.params.gen, sp = def.spec, eng = def.params.engine || {}, pr = def.params.prop || {};
  const notes = {};
  let dCdS = 0, dK = 0, dCdSGlide = 0;
  // I1: the wheels up
  const RET = def.params.retract;
  if (has('gearup') && RET && RET.cdA > 0) { const d = -RET.cdA * (RET.frac > 0 && RET.frac < 1 ? RET.frac : 1); dCdS += d; notes.gearup = d; }
  // M4: the wires
  if (has('wires')) {
    let wing = 0, tail = 0;
    for (const b of def.beams) {
      if (!b.ext || b.cls !== 'wire') continue;
      const t = /^HT|^FIN/.test(def.nodes[b.a].tag || '') || /^HT|^FIN/.test(def.nodes[b.b].tag || '');
      if (t) tail += b.L; else wing += b.L;
    }
    const wD = C.GEN_RULES.wireD, mat = sp.material;
    const cant = !!TAIL_CANT[key];
    const dW = (sp.wings || []).length > 1 ? -(1.0 - 0.35) * wing * wD : 0, dT = cant ? -1.0 * tail * wD : 0;
    dCdS += dW + dT; notes.wires = { wing: dW, tail: dT };
  }
  // M2: the span efficiency above AR 8 (monoplanes)
  if (has('oswald') && (sp.wings || []).length === 1) {
    const ARw = ctx.base.AR, eOld = def.params.polarWing.eAR / (Math.PI * ARw);
    const surf = (sp.wings[0] && (sp.wings[0].material || sp.wings[0].surf)) || sp.material;
    const smooth = /glass|carbon|dtube/.test(String(surf)) || /glass|carbon|softShell/.test(String(sp.material));
    const r = physE(ARw, smooth ? 0.0035 : 0.007) / raymerE(ARw);
    if (r > 1) { const eNew = Math.min(0.95, eOld * r); dK = (1 / eNew - 1 / eOld) / (Math.PI * ARw); notes.oswald = { eOld, eNew }; }
  }
  // M5: the target drag area (the clean aeroplane's, wheels up)
  if (has('targetf') && TARGET_F[key] != null) {
    const gu = RET && RET.cdA > 0 ? -RET.cdA * (RET.frac > 0 && RET.frac < 1 ? RET.frac : 1) : 0;
    const d = TARGET_F[key] - (ctx.base.CdS + gu); dCdS = (has('gearup') ? gu : 0) + d; notes.targetf = { f: TARGET_F[key], d };
  }
  // the polar the figures are computed from (I5: trimmed)
  const src = has('trim') ? ctx.cleanT : ctx.clean;
  const pol = { CLmax: src.CLmax, rows: src.rows.map(r => ({ a: r.a, CL: r.CL, CD: r.CD + dCdS / S + dK * r.CL * r.CL })) };
  // I2 / I3: the row's altitude and power
  const rowV = R.rows.Vmax || {}, hV = has('alt') && rowV.alt > 0 ? rowV.alt : 0;
  const PK = has('power') ? (POWER_K[P.ref] || {}) : {};
  const kP = has('power') && R.poh && R.poh.climbPowerK > 0 ? R.poh.climbPowerK : (PK.roc || 1);
  const ATM = C.ATMOS_ISA;
  // M1: the propeller
  let thrust = ctx.thrust, thrustAt = (V, h) => sim.thrustAt(V, 0, h);
  if (has('prop') && pr.Tstatic > 0 && eng.powerW > 0) {
    const cs = !!eng.cs || !!CS_BY_KEY[key];
    const mat = (sp.prop && sp.prop.material) || 'wood';
    const o = { P: eng.powerW, D: pr.D, blades: (sp.prop && sp.prop.blades) || 2, cs, etaB: ETA_BLADE[mat] || 0.79 };
    // the design speed: the aeroplane's own top speed on this propeller (a fixed point, five passes)
    const A = Math.PI * o.D * o.D / 4, ideal = Math.cbrt(2 * RHO0 * A) * Math.pow(o.P, 2 / 3);
    if (cs) {
      // the actuator disc at every speed, in the air of the altitude asked (the power by the core's own lapse)
      const T0cs = 0.65 * (1 + 0.055 * (o.blades - 2)) * ideal;
      thrustAt = (V, h) => {
        const sg = h ? ATM.sigma(h) : 1, pw = Math.pow(sim.thrustAt(0, 0, h) / Math.max(1e-9, sim.thrustAt(0, 0, 0)) / Math.cbrt(sg), 1.5);
        return nE * Math.min(T0cs * Math.cbrt(sg) * Math.pow(pw, 2 / 3), momentumT(o.P * pw, A, V, o.etaB, RHO0 * sg));
      };
      notes.prop = { cs, mat, T0: T0cs, T0old: pr.Tstatic };
    } else {
      // the design speed: the aeroplane's own top speed on this propeller (a fixed point)
      const kp = PITCH_K[(sp.prop && (sp.prop.pitchUsed || sp.prop.pitch)) || 'standard'] || 1;
      let Vtop = 2.2 * ctx.base.fig.Vs, Vref = kp * Vtop, T0 = pr.Tstatic, k = pr.kV2, Tref = 0;
      for (let i = 0; i < 8; i++) {
        Tref = momentumT(o.P, A, Vref, o.etaB, RHO0);
        T0 = Math.max(pr.Tstatic, 1.02 * Tref); k = (T0 - Tref) / (Vref * Vref);
        const f = ctx.figures(pol, S, W, V => nE * Math.min(Math.max(0, T0 - k * V * V), momentumT(o.P, A, V, o.etaB, RHO0)), ctx.Psh);
        if (!f.Vmax) break;
        Vtop = 0.5 * Vtop + 0.5 * f.Vmax; Vref = kp * Vtop;
      }
      const T0f = T0, kf = k;
      // (never above the actuator disc: past its design speed a propeller cannot beat etaBlade x ideal)
      thrustAt = (V, h) => {
        const sg = h ? ATM.sigma(h) : 1, r0 = sim.thrustAt(0, 0, h) / Math.max(1e-9, sim.thrustAt(0, 0, 0)), pw = Math.pow(r0 / Math.cbrt(sg), 1.5);
        return nE * Math.min(Math.max(0, T0f * r0 - kf * sg * V * V), momentumT(o.P * pw, A, V, o.etaB, RHO0 * sg));
      };
      notes.prop = { cs, mat, T0: T0f, T0old: pr.Tstatic, Vref, etaRef: Tref * Vref / o.P };
    }
    thrust = V => thrustAt(V, 0);
  }
  // M3: the propeller at idle in the glide
  if (has('idleprop') && pr.D > 0 && eng.powerW > 0) {
    const fam = eng.aspiration === 'electric' ? 'electric' : (eng.family === 'turbine' || eng.cs || CS_BY_KEY[key]) ? 'turbine' : 'piston';   // (a governed propeller feathers or goes coarse)
    dCdSGlide = KW_IDLE[fam] * Math.PI * pr.D * pr.D / 4 * nE; notes.idleprop = dCdSGlide;
  }
  const fig = ctx.figures(pol, S, W, thrust, ctx.Psh, { dCdSGlide });
  // the climb at the book's power; the top speed at the row's altitude (TAS)
  if (kP !== 1) { const f2 = ctx.figures(pol, S, W, V => kP * thrust(V), ctx.Psh * kP); fig.roc = f2.roc; fig.Vy = f2.Vy; fig.etaVy = f2.etaVy; notes.power = kP; }
  if (PK.Vmax && !hV) { const f3 = ctx.figures(pol, S, W, V => PK.Vmax * thrust(V), ctx.Psh * PK.Vmax); fig.Vmax = f3.Vmax; notes.powerVmax = PK.Vmax; }
  if (hV) {
    const sg = ATM.sigma(hV), polH = { CLmax: pol.CLmax, rows: pol.rows };
    // at altitude: the same polar at EAS, the thrust the core gives there; solved in EAS then converted to TAS
    const fH = ctx.figures(polH, S, W, Ve => thrustAt(Ve / Math.sqrt(sg), hV), ctx.Psh);
    if (fH.Vmax) { fig.Vmax = fH.Vmax / Math.sqrt(sg); notes.alt = hV; }
  }
  // the take-off roll: a plain ground-roll integral, used as a RATIO on real_check's own analytic roll
  const roll = (T, pl) => {
    const CLg = 0.5, fit = ctx.fitPolar(pl) || { CD0: 0.04, K: 0.06 };
    const CdSg = (fit.CD0 + fit.K * CLg * CLg) * S, mu = 0.05, m = W / G, Vlof = 1.04 * Math.sqrt(2 * W / (RHO0 * S * pl.CLmax));
    let s = 0;
    for (let V = 0.25; V <= Vlof; V += 0.5) { const q = 0.5 * RHO0 * V * V, a = (T(V) - q * (CdSg - mu * CLg * S) - mu * W) / m; if (a <= 0) return Infinity; s += V * 0.5 / a; }
    return s;
  };
  fig.rollRatio = roll(V => (PK.TO || 1) * thrust(V), pol) / roll(ctx.thrust, ctx.clean);
  return { fig, notes, pol, CLmax: pol.CLmax };
}
module.exports = { apply, propSynth2, momentumT, raymerE, physE, ETA_BLADE, KW_IDLE, CS_BY_KEY, TAIL_CANT, POWER_K, TARGET_F, PITCH_K };
