// ============================================================
// THE SKIS (SKIS, 13 Nov 2026) - one ski landing gear for every aeroplane, and the soft ground it stands on.
// The user (13 Nov): "one main type and a few options, not a list of 10 ... PHYSICS STOPS ABERRATIONS: the ski's area
// sets the contact pressure, so small skis on a heavy plane sink ... no wheel brakes on straight skis ... mass, drag and
// price paid for the skis". The references: futureDesigns/SKI-REFERENCES-2026-11-13.md (A0's research; [SRC]/[EST]
// labels there), the design note futureDesigns/SKIS-2026-11-13.md.
//
// ONE SKI, THREE MOUNTINGS (gear.ski.kind). A ski is a plank of length L and width W with an upturned toe (tip, its
// height), pivoting on the existing leg's axle at `at` of its length from the toe. What differs is only where the TYRE
// stands against the ski's bottom:
//   'plain'    the wheel comes off; the ski's pedestal sits on the axle (the straight / wheel-replacement ski). No tyre,
//              no brake. `ped` is the axle's height over the ski's bottom (default the wheel's own contact radius: the
//              stance is unchanged; AC 43.13-2B: at most 130 % of the axle height with the wheel on).
//   'wheel'    the tyre pokes through a slot `prot` below the ski's bottom (the fixed wheel-penetration ski): on a hard
//              surface the tyre carries and brakes, in snow the tyre sinks until the ski bears.
//   'retract'  the hydraulic wheel-ski (the PC-6's, Wipline, Genaire): the ski moves between `prot` above the tyre's
//              bottom (UP: a penetration ski, the tyre on the runway) and `drop` below it (DOWN: the aeroplane on its
//              skis, the tyre clear of the snow), in `time` seconds, on the pilot's selector (ctl.ski: 1 down, 0 up).
// THE THIRD UNIT (gear.ski.third, { L, W, tip }): the tail ski on a taildragger's tailwheel, the nose ski on a tricycle's
// nose wheel. It is a penetration ski (the tailwheel through its slot, steered with it - patent US4390151), or a plain
// tail ski when the mains are plain (the Airglas L250 replaces the tailwheel).
// ABSENT IS AS TODAY: a build without gear.ski carries no key, its frame, def and flight are what they were, to the bit.
//
// THE SOFT GROUND IS SNOW-MUD'S (one version, agreed 15 Nov): the world's SURFACE code under the contact, its layer
// GROUND_SOFT[code] (Bekker's p = k z^n, its depth zMax over the firm base) and a ski bottom's friction GROUND_SKI_MU[code]
// (00_registry). A ski element sinks by SNOW-MUD's own laws - groundSinkPlate for the sole, groundSinkWheel for a
// wheel-ski's tyre - and pays SNOW-MUD's plough (w k z^(n+1) / (n+1)) at its rut's depth. What only a ski needs are
// OPTIONAL FIELDS ON SNOW-MUD'S OWN ROWS (their ask, 15 Nov: no second table), set below; absent = SNOW-MUD's law exactly,
// and SNOW-MUD's k, n, zMax, ski are never touched (GATE SOFTGROUND and SNOWMUDFX read those).
// Pure: no THREE, no world, no random; CORE_MATH-free arithmetic (+ - * / sqrt only: bit-identical page and worker).
// ============================================================

// WHAT ONLY A SKI NEEDS ON SNOW-MUD'S SNOW (codes 8 packed, 9 powder, 10 wet) - optional fields on GROUND_SOFT's rows,
// [EST] per SKI-REFERENCES 4.1 / 4.6:
//   skis    1: a ski's ground - a wheel-ski lowers its skis here by itself (its selector unset); the mud carries none
//   vP      m/s, the planing speed: the layer stiffens as (1 + (v/vP)^2) under a running ski (it cannot compact as fast
//           as the ski crosses it: the "hump" a skiplane gets over; the FAA text: "keep enough power to stay on top")
//   lat     the ski's side grip (its edges and runners in the snow; "sideways drift in turns is normal")
//   plough  the bulldozing over SNOW-MUD's compaction: the snow a sunk ski pushes ahead, x k z^(n+1)
//   fresh   THE TWO-REGIME SNOW (SNOW-MUD's named cut, left to this session as "a row field, absent = this law"): the
//           top z metres of the layer are VIRGIN snow, { k, n, z } - the published fresh snowpack's ~200 kPa/m^n
//           (SNOW-MUD's own note: "a man sinks into it to the knee") - over SNOW-MUD's settled law. A SKI'S SOLE (a plate
//           at 5-15 kPa) compacts the fresh snow first and sinks decimetres, then meets the settled base: the
//           references' "a well-sized light ski sinks ~8 cm in fresh powder", and a ski too small for its load sinks
//           through. A TYRE does not read it: at 50-300 kPa the fresh snow collapses at once, which SNOW-MUD's fit at
//           the tyres already holds (so a wheel, and a wheel-ski's tyre, are SNOW-MUD's law exactly)
// (the fresh top only over a SETTLED base - a row stiffer than it; where SNOW-MUD's row IS the virgin law (DEEP SNOW,
//  15 Nov: powder k 2e5, wet 4e5) there is no second layer to add: the sole reads their row alone, never the law twice)
if (typeof GROUND_SOFT !== 'undefined') {
  const fresh = (c, F) => GROUND_SOFT[c].k > F.k ? { fresh: F } : {};
  Object.assign(GROUND_SOFT[8],  { skis: 1, vP: 12, lat: 0.35, plough: 0.6 });                                                  // packed (rolled: no fresh snow)
  Object.assign(GROUND_SOFT[9],  { skis: 1, vP: 7,  lat: 0.30, plough: 1.0 }, fresh(9,  { k: 2.0e5, n: 1.5, z: 0.25 }));   // powder (dry, cold: deep and light)
  Object.assign(GROUND_SOFT[10], { skis: 1, vP: 6,  lat: 0.35, plough: 1.4 }, fresh(10, { k: 4.0e5, n: 1.2, z: 0.12 }));   // wet ("worse than mud or even beach sand")
}
// a ski's side grip on the codes with no `lat` (GROUND_SURF's classes 0 grass .. 7 sand; 11 / 12 mud) [EST] - (GROUND_SURF's classes 0 grass .. 7 sand; 11 / 12 mud) [EST]
const SKI_LAT = { 0: 0.45, 1: 0.55, 2: 0.50, 3: 0.50, 4: 0.10, 5: 0.50, 6: 0.50, 7: 0.50, 11: 0.45, 12: 0.40 };
// a bare aluminium bottom on the snow (0.35-0.40: why everyone fits plastic) and a ski on the water (GROUND_SKI_MU's
// null: the water's own pass carries a ski that is in it; this only keeps it from sticking) [EST]
const SKI_ALU_MU = [0.35, 0.40], SKI_WATER_MU = [0.05, 0.08];

// THE RULES (sizing, mass, price, drag). Every number labelled; [EST] are fits to SKI-REFERENCES §2.1's table.
const SKI_RULES = {
  pDesign: 8000,       // Pa: the static pressure a ski is sized at by default (the references' 1.0-1.5 psi, 7-10 kPa)
  mainShare: 0.46,     // of the gross on each main ski (the third unit carries ~8 %)
  thirdShare: 0.08,
  // THE PLANFORM (skiPlan): the reference ski is the Summit Aircraft SS2300 (the user's photographs and the maker's sheet,
  // 13 Nov: 2300 lb gross, the Carbon Cub's and the Super Cub's; carbon monocoque; 18 x 79 in, 22 x 81 in with its UHMW
  // bottom skins; 27 lb a ski with rigging; 8.50x6 tyres; a single 4 in heel wheel; "option to run as straight ski").
  // The PC-6's wheel-skis are the same family (the user: "the pilatus uses similar skis"), larger. Measured off the
  // top-view photograph against its 22 x 81 in skins: the aft BEAM keeps 0.57 of the body's width on the inboard side,
  // the WHEEL'S CUTOUT starts 0.49 of the length from the toe (outboard), the pedestal (the axle) 0.585 from the toe,
  // the toe a half-round of the full width, the heel square with small radii
  ref: { L: 2.007, W: 0.457, skin: 0.051, skinL: 0.0255 },
  beam: 0.57, notchAt: 0.49, at: 0.585, aspectThird: 3.4,
  tipK: 0.045,         // the toe's upturn, x L (the SS2300's ~9 cm; light skis 4-8 in over the last 12-18 in)
  tipRun: 0.16,        // the upturn's run, x L
  heelR: 0.03,         // m: the heel's corner radii
  gap: 0.015,          // m: the tyre's sidewall off the beam's skin in the cutout
  clr: 0.03,           // m: the tyre's tread off the cutout's face, at its lowest through the ski
  deckH: 0.075,        // m: the deck's height over the skins at the reference's width (the drawing's; it scales with W)
  skinT: 0.009,        // m: the bottom skins' thickness
  inc: 3,              // deg: the rigged flight incidence (the aft check cable; +1..+6, AC 43.13-2B 0..+5)
  droop: -20,          // deg: the safety cable's stop (AC 43.13-2B -20..-35; TC AC 500-010 -15 in flight)
  prot: 0.03,          // m: the tyre below the ski's sole beside it (the SS2300 set for its 8.50x6: a hand's width under 2 in; the
                       //    take-off in powder is sensitive to it - the Carbon Cub on SS2300s 78 / 87 / 198 m at 1.5 / 3 / 5 cm: the
                       //    references' "the protruding tyre ploughs, so it is worse in deep snow")
  drop: 0.06,          // m: a wheel-ski's bottom below the tyre, skis down
  protThird: 0.06,     // m: the tailwheel / nose wheel below its ski ("a few inches": past its tyre's deflection under the tail's load)
  time: 15,            // s: a hydraulic wheel-ski's cycle ([EST] 10-20, no source)
  // MASS per ski, kg = rig + mounting x (k0 + kA x A), A the bottom skins' outline (m2), by the shell's material:
  // aluminium through the Aero M1500 / M2000 / M3000H (7.3 / 9.1 / 13.2 kg at 0.34 / 0.52 / 0.74 m2), glassfibre through
  // the Airglas LW3600 (28.6 kg with rigging at 1.16 m2, a penetration ski), carbon through the Summit SS2300 (27 lb =
  // 12.25 kg with rigging, a penetration ski: kA solved below on its own outline); the mounting x1 plain, x1.5 the
  // wheel beside it (the pedestal's reach, the heel wheel), x2.0 the hydraulic wheel-ski (Wipline C2200 / C3000: 19 / 23
  // kg a ski) plus the power pack (17 lb on a Cub, scaled by the gross)
  mats: { carbon: { k0: 1.0, kA: 0, usdK: 0.75 }, alu: { k0: 2.5, kA: 14.5, usdK: 1 }, glass: { k0: 2.5, kA: 13.7, usdK: 0.9 } },
  kgRig: 1.0, kgK: { plain: 1.0, wheel: 1.5, retract: 2.0 }, refKg: 12.25,
  packKg: g => 7.7 * Math.max(0.6, Math.min(2.2, g / 800)),
  // PRICE per ski (USD, GEN_PRICES' unit): (600 + 3000 A) x mounting (plain 1, beside 2, wheel-ski 4) x the material's
  // factor, + the pack ~$4k [EST, catalogue orders of magnitude: an Aero M2000 pair ~$4.2k, an LW3600 pair ~$16k, a
  // Wipline pair ~$30-35k]
  usd0: 600, usdA: 3000, usdK: { plain: 1, wheel: 2, retract: 4 }, packUsd: 4000,
  // DRAG per ski (axial CdA, m2): the nose - the toe's upturn and the deck's front over the skins' width - at a rounded
  // body's 0.5, the sole's friction (1.5 A x 0.006), the rigging (0.006) and the pedestal (0.4 x its height x 0.06); the
  // wheel-ski x1.6 (its jack and slide). A plain ski REPLACES the wheel's drag; the others add to it. [EST] calibrated on
  // the C185's 130 -> 115 kt on wheel-skis (+44 % of the aeroplane's CdA, ~0.12 m2 a ski) and the references' 0.15-0.3
  // m2 at Porter scale
  cdNose: 0.5, deckH: 0.075, cfSole: 0.006, cdRig: 0.006, cdPed: 0.4, cdK: { plain: 1.0, wheel: 1.15, retract: 1.6 },
  cn: 4,               // /rad: a ski's side force per unit load per radian of slip (its runners and edges as a keel) [EST]
  tyreW: 0.62,         // a tyre's width over its radius (the tyre element's footprint; a 31" tundra ~0.3 m on 0.39)
};

// THE TYRE'S WIDTH as drawn (tools/_gear_gen.js TYRE: the carcass's half-width over R - standard 0.40, tundra 0.44,
// slim 0.29 - its bulge to 1.04, the cage's whBulge): the cutout and the tyre element take the drawn tyre, not a rule
function skiTyreW(R, cage) {
  const prof = Math.round(+((cage && cage.whProfile) || 0)), hw = prof === 1 ? 0.44 : prof === 2 ? 0.29 : 0.40;
  const bulge = cage && cage.whBulge != null ? Math.max(0.5, +cage.whBulge) : 1;
  return 2 * hw * 1.04 * R * (prof === 1 ? 1 : bulge);
}
// THE PLANFORM - one function the drawing and the physics share (what is drawn is what bears). o: { L, W (the shell),
// skin, skinL (the bottom skins' margin, sides and ends), at (the axle from the toe, x L), beam (the aft beam's share of
// W, inboard; 1 = no cutout, a straight plank), notchAt (the cutout's start from the toe, x L), tip (the upturn, m) }.
// Frame: s along the ski from the AXLE (+ forward), w across from the shell's centreline (+ OUTBOARD). Returns the
// shell's and the skins' edges at s, the upturn, the beam's centre and edge, the tyre's place in the cutout, the areas.
function skiPlan(o) {
  const R = SKI_RULES, L = o.L, W = o.W, m = o.skin != null ? o.skin : 0, mL = o.skinL != null ? o.skinL : 0;
  const at = o.at != null ? o.at : R.at, beam = o.beam != null ? Math.max(0.3, Math.min(1, o.beam)) : 1;
  const sToe = at * L, sHeel = -(1 - at) * L, bE = -W / 2 + beam * W, notch = beam < 0.999;
  const tN = Math.min(0.10, 0.22 * W);
  // THE CUTOUT IS THE TYRE'S (the user, 13 Nov: "the wheel has to be able to go down through the little opening"): the
  // wheel-ski moves the ski past its tyre (up: the tyre `prot` under the sole; down: the ski under the tyre), so the
  // opening must take the tyre at its lowest through the ski - its chord at the deck's top and at the skins' top, a
  // clearance, the fillet - forward of the axle; the row's start holds when it is further forward already
  const chord = d => d <= 0 ? 0 : d >= o.R ? o.R : Math.sqrt(2 * o.R * d - d * d);
  const m0 = o.skin != null ? o.skin : 0, kS0 = Math.max(0.6, Math.min(1.8, W / 0.457));
  const need = (notch && o.R > 0 && o.prot != null) ? Math.max(chord(o.prot + R.skinT + R.deckH * kS0) + R.clr + tN,
                                                                chord(o.prot + R.skinT) + R.clr + tN + m0) : 0;
  const sN = Math.max(sToe - (o.notchAt != null ? o.notchAt : R.notchAt) * L, Math.min(need, sToe - 0.25 * L));
  const sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
  const mk = (Wd, sT, sH, bEd, sNd) => (s, out) => {
    let wi = -Wd / 2, wo = notch ? Wd / 2 + (bEd - Wd / 2) * sm((sNd - s) / tN) : Wd / 2;
    const rT = Wd / 2, s0 = sT - rT;
    if (s > s0) { const u = Math.min(1, (s - s0) / rT), h = rT * Math.sqrt(Math.max(0, 1 - u * u)); if (-h > wi) wi = -h; if (h < wo) wo = h; }
    const rH = R.heelR;
    if (s < sH + rH) { const u = Math.min(rH, sH + rH - s), d = rH - Math.sqrt(Math.max(0, rH * rH - u * u)); wi += d; wo -= d; }
    out[0] = wi; out[1] = Math.max(wi, wo); return out;
  };
  const body = mk(W, sToe, sHeel, bE, sN), skin = mk(W + 2 * m, sToe + mL, sHeel - mL, bE + m, sN - m);
  const tip = o.tip != null ? o.tip : Math.max(0.03, Math.min(0.25, R.tipK * L)), sT = sToe - R.tipRun * L;
  const up = s => s > sT ? tip * Math.pow((s - sT) / (sToe + mL - sT), 2) : s < sHeel + 0.04 * L ? 0.012 * Math.pow((sHeel + 0.04 * L - s) / (0.04 * L + mL), 2) : 0;
  // the areas: the skins' outline (the mass, the drag's sole) and the BEARING area (the upturn bears less as it rises:
  // linearly to nothing at the toe - on firm snow the toe carries nothing, in powder it ploughs)
  let A = 0, Ab = 0; const N = 240, s0 = sHeel - mL, s1 = sToe + mL, q = [0, 0];
  for (let k = 0; k < N; k++) {
    const s = s0 + (s1 - s0) * (k + 0.5) / N, ds = (s1 - s0) / N; skin(s, q);
    const w = q[1] - q[0]; A += w * ds; Ab += w * ds * (s < sT ? 1 : 1 - (s - sT) / (s1 - sT));
  }
  return { L, W, m, mL, at, beam, notch, sToe, sHeel, sN, tN, bE, wc: -W / 2 + beam * W / 2, tip, sT,
           wTyre: o.bT != null ? bE + m + o.bT / 2 + R.gap : 0, body, skin, up, A, Ab, Wmax: W + 2 * m, Lmax: L + 2 * mL,
           deckH: R.deckH * kS0, skinT: R.skinT, need };
}
// the carbon shell's areal mass, solved so the SS2300 (a penetration ski) weighs its 27 lb with rigging
(() => { const R = SKI_RULES, P = skiPlan(Object.assign({ beam: R.beam, notchAt: R.notchAt, at: R.at }, R.ref));
         R.mats.carbon.kA = ((R.refKg - R.kgRig) / R.kgK.wheel - R.mats.carbon.k0) / P.A; })();

// THE RUT (per element: a ski's sole or a wheel-ski's tyre). SNOW-MUD's laws are quasi-static (the sinkage the load
// gives); a contact in the solver is a spring. THE MOVING DATUM (SNOW-MUD's own named next step): each element keeps the
// depth of its rut zc - its ground is the snow's top lowered by zc, met on the node's own spring (the solver's stiffness
// stays the gear's: the snow's k, 10^6-10^7 Pa/m^n over a square metre, would be a stiff loop) - and zc follows the
// quasi-static sinkage of the load it carries, PLASTICALLY: it deepens (filtered over tau) and never springs back
// while the element stands; running into fresh snow relaxes it over one bearing length (x 1/(1 + ds / Lb)).
const SKI_SOFT = {
  tau: 0.06,                                     // s, the rut's filter (the sinkage follows the load, not the spring's buzz)
  S: { k: 0, n: 1, zMax: 0, f: 1 },              // the scratch layer at speed, f its planing factor (no allocation in the loop)
  // the layer under a running element: SNOW-MUD's row, its k stiffened by the planing term (no ski fields: the row)
  at(SO, X, vr) {
    const q = X && X.vP > 0 ? vr / X.vP : 0, S = SKI_SOFT.S;
    S.f = 1 + q * q; S.k = SO.k * S.f; S.n = SO.n; S.zMax = SO.zMax; return S;
  },
  relax(e, vr, dt) { const ds = (vr < 0 ? -vr : vr) * dt; if (e.zc > 0) e.zc = e.zc / (1 + ds / e.Lb); },
  // deepen the rut toward the target zt (m), filtered
  sink(e, zt, dt) { if (zt > e.zc) { const a = dt / SKI_SOFT.tau; e.zc += (zt - e.zc) * (a < 1 ? a : 1); } },
  // A SKI'S SOLE: the sinkage of pressure p (Pa) at speed q2 = (v/vP)^2 - the fresh snow (X.fresh, its top) and SNOW-MUD's
  // settled layer under it, in series (each carries p), never past the layer's depth zMax; GROUND_SINK holds it
  plate(SO, X, N, A, w, vr) {
    const S = SKI_SOFT.at(SO, X, vr), F = X && X.fresh;
    groundSinkPlate(S, N, A, w);
    if (F && N > 0 && A > 0) {
      let zf = CORE_MATH.pow(N / A / (F.k * S.f), 1 / F.n); if (zf > F.z) zf = F.z;
      let z = zf + GROUND_SINK.z; if (z > SO.zMax) z = SO.zMax;
      GROUND_SINK.z = z;
    }
    return GROUND_SINK.z;
  },
  // the motion resistance (N) of an element w wide in its rut z: the work of compacting the trench per metre - SNOW-MUD's
  // w k z^(n+1) / (n+1) of each layer it went through (the fresh top first, for a sole), + the plough's bulldozing
  resist(S, X, w, z, sole) {
    if (!(z > 0)) return 0;
    const pl = X ? X.plough : 0, F = sole && X && X.fresh;
    if (!F) return w * S.k * CORE_MATH.pow(z, S.n + 1) * (1 / (S.n + 1) + pl);
    const k0 = F.k * S.f, zf = z < F.z ? z : F.z, zs = z - zf;   // (the fresh k at the same speed as S's)
    return w * (k0 * CORE_MATH.pow(zf, F.n + 1) * (1 / (F.n + 1) + pl) + (zs > 0 ? S.k * CORE_MATH.pow(zs, S.n + 1) * (1 / (S.n + 1) + pl) : 0));
  },
};

// RESOLVE a spec's ski record against the build (gross kg, the mains' wheel contact radius, the third wheel's radius,
// the gear type): every dimension the spec leaves out is sized at pDesign from the gross. Returns null without skis.
function skiResolve(S, gross) {
  const K = S && S.gear && S.gear.ski;
  if (!K || typeof K !== 'object') return null;
  const R = SKI_RULES, g = (gross > 0 ? gross : 700) * 9.81;
  const kind = K.kind === 'wheel' || K.kind === 'retract' ? K.kind : 'plain';
  const mat = R.mats[K.mat] ? K.mat : 'carbon', MT = R.mats[mat];
  const wR = S.gear.contactR || S.gear.wheelR || 0.2;
  // a dimension the spec leaves out: the reference ski scaled until it bears its share at pDesign (its own proportions)
  const ref = skiPlan(Object.assign({ beam: R.beam, notchAt: R.notchAt, at: R.at }, R.ref));
  const kM = Math.sqrt(R.mainShare * g / R.pDesign / ref.Ab);
  const plan = (o, third, k) => skiPlan({ L: o.L > 0 ? o.L : (third ? 0.55 : R.ref.L * k), W: o.W > 0 ? o.W : (third ? 0.55 / R.aspectThird : R.ref.W * k),
    skin: o.skin != null ? o.skin : (third ? 0.02 : R.ref.skin * Math.min(1.5, k)), skinL: o.skinL != null ? o.skinL : (third ? 0.01 : R.ref.skinL * Math.min(1.5, k)),
    at: o.at != null ? o.at : (third ? 0.55 : R.at), beam: third ? 1 : (o.beam != null ? o.beam : R.beam),
    notchAt: o.notchAt != null ? o.notchAt : R.notchAt, tip: o.tip, bT: third ? null : skiTyreW(wR, S.cage),
    R: third ? 0 : wR, prot: third ? null : (kind === 'plain' ? null : (K.prot != null ? K.prot : R.prot)) });
  const unit = (P, k, third) => ({ L: P.L, W: P.W, Wmax: P.Wmax, Lmax: P.Lmax, tip: P.tip, at: P.at, A: P.Ab, Aplan: P.A, beam: P.beam,
    notchAt: (P.sToe - P.sN) / P.L, skin: P.m, skinL: P.mL, wTyre: P.wTyre, wc: P.wc, kind: k, third });
  const M = unit(plan(K, false, kM), kind, false);
  M.ped = kind === 'plain' ? (K.ped > 0 ? K.ped : wR) : wR;
  M.prot = kind === 'plain' ? 0 : (K.prot != null ? K.prot : R.prot);
  M.drop = kind === 'retract' ? (K.drop != null ? K.drop : R.drop) : 0;
  M.bT = skiTyreW(wR, S.cage);
  let T = null;
  if (K.third && typeof K.third === 'object') {
    // the tail / nose ski: a straight plank (no cutout: its wheel runs through it), sized for its share when unsized
    const kT = Math.sqrt(R.thirdShare * g / R.pDesign / (0.55 * (0.55 / R.aspectThird) * 0.9));
    const t = Object.assign({}, K.third); if (!(t.L > 0)) t.L = 0.55 * kT; if (!(t.W > 0)) t.W = 0.55 / R.aspectThird * kT;
    const tk = kind === 'plain' ? 'plain' : 'wheel';
    T = unit(plan(t, true, kT), tk, true);
    T.prot = tk === 'plain' ? 0 : (K.third.prot != null ? K.third.prot : R.protThird);
    T.bT = R.tyreW * (S.gear.twR || 0.1);
  }
  const kg = (o, k) => R.kgRig + R.kgK[k] * (MT.k0 + MT.kA * o.Aplan);
  const usd = (o, k) => (R.usd0 + R.usdA * o.Aplan) * R.usdK[k] * MT.usdK;
  const cda = (o, k, ped) => (R.cdNose * (o.tip + R.deckH) * o.Wmax + R.cfSole * 1.5 * o.Aplan + R.cdRig + R.cdPed * ped * 0.06) * R.cdK[k];
  M.kg = kg(M, kind); M.usd = usd(M, kind); M.cdA = cda(M, kind, M.ped);
  if (T) { T.kg = kg(T, T.kind); T.usd = usd(T, T.kind); T.cdA = cda(T, T.kind, S.gear.twR || 0.1); }
  const packKg = kind === 'retract' ? R.packKg(gross > 0 ? gross : 700) : 0;
  return { kind, mat, mains: M, third: T, time: kind === 'retract' ? (K.time > 0 ? K.time : R.time) : 0,
           inc: K.inc != null ? K.inc : R.inc, droop: R.droop, bottom: K.bottom === 'alu' ? 'alu' : 'uhmw',
           packKg, packUsd: kind === 'retract' ? R.packUsd : 0,
           kg: 2 * M.kg + (T ? T.kg : 0) + packKg, usd: 2 * M.usd + (T ? T.usd : 0) + (kind === 'retract' ? R.packUsd : 0),
           cdA: 2 * M.cdA + (T ? T.cdA : 0) };
}

// THE SOLVER'S SIDE: one record per sim (null without skis - the solver's ground pass never asks then). `def.parts.ski`
// is the resolved record the frame published; the contacts are the mains (0, 1) and the third unit (2), each with its
// elements' heights below the axle node, set at reset from the node's own contact radius (the drawn tyre, G661's share).
function skiSimMake(def, n) {
  const R = def.parts && def.parts.ski;
  if (!R) return null;
  const refs = def.refs || {}, M = refs.mains || [], tw = refs.tw;
  const of = new Int8Array(n).fill(-1), C = [];
  const mk = (node, rec, kind, third) => ({ node, third, kind, L: rec.L, W: rec.Wmax || rec.W, A: rec.A, at: rec.at, tip: rec.tip,
    prot: rec.prot || 0, drop: third ? 0 : (rec.drop || 0), ped: rec.ped || 0, bT: rec.bT || 0.1,
    hT: 0, hS: 0, hS0: 0, R: 0,
    eS: { zc: 0, Lb: 0.85 * rec.L }, eT: { zc: 0, Lb: 0.3 }, fnS: 0, fnT: 0, z: 0, load: 0, pitch: 0, on: 0 });
  for (let k = 0; k < M.length && k < 2; k++) if (M[k] >= 0 && M[k] < n) { of[M[k]] = C.length; C.push(mk(M[k], R.mains, R.kind, false)); }
  if (R.third && tw != null && tw >= 0 && tw < n) { of[tw] = C.length; C.push(mk(tw, R.third, R.third.kind, true)); }
  return { R, of, C, kind: R.kind, pos: 1, time: R.time, inc: R.inc * Math.PI / 180, droop: R.droop * Math.PI / 180,
           alu: R.bottom === 'alu' };
}
// the ski's bottom below the axle node at the selector's position (the tyre's, hT, is the node's own)
function skiHeight(SK, c) {
  if (c.kind === 'plain') return c.hT;                       // (the plain ski's pedestal IS the node's contact radius)
  if (c.kind === 'wheel' || c.third) return c.hT - c.prot;
  return c.hT - c.prot + SK.pos * (c.prot + c.drop);         // 'retract': up (-prot) .. down (+drop)
}
