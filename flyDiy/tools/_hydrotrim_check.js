#!/usr/bin/env node
// GATE HYDROTRIM (G3442, HYDRO-TRIM) — the seaplane's hump: the afterbody in the forebody's wake, the hump peaks and
// falls, and the stock 172R on Wipaire's exact float gets off the water.
//
//   node tools/_hydrotrim_check.js          -> "GATE HYDROTRIM: PASS|FAIL"
//
// G3390 found the corrected 172R (160 hp) on the catalogue-exact Wipline 2350s, at Wipaire's STC gross with the STC
// float prop, never left the water: it sat at 6-7 m/s where the water's drag met the thrust, the trim 8-15 deg and
// rising with the thrust. The causes (HANDOVER G3440-G3443): the wake behind the step was a ballistic streamline that
// sank DEEPER the higher the trim, so the afterbody dried as the bow rose and nothing held the trim down (a free float
// in GATE HYDRODYN's tank ran to 23 deg); the transom read its air off the still level, not the wake it sits in; the
// sides above a chine that sheds the flow carried skin friction; and the 'climb' propeller class's static figure of
// merit was 0.39 against 0.49-0.59 measured on props absorbing full power standing (Flight Resource, STC SA02245CH).
//
// WHAT IT ASSERTS:
//   TANK      the 172R's own 2350 hull at its loading (578 kg), trim held at 6 / 9 / 12 deg at 8.5 m/s (C_V 3.2, the hump),
//             heave free: the afterbody's share of the lift RISES with the trim and carries >= 15 % at 12 deg - the
//             wake stands on the afterbody (Savitsky & Morabito 2010), which is what limits a float's free trim at the
//             hump (Parkinson, NACA TN 563: the hump trim follows the afterbody keel angle). The H0 law (P.wakeSM 0)
//             is flown beside it: its wake sank with the trim and left the afterbody dry at the hump (under 5 %).
//   HUMP      the 172R + 2350, STC prop 82x43, the STC gross 1,157 kg, calm, the floatplane supplement's technique
//             (flaps 20, the stick back through the hump, the step attitude, the stick back at 50 KIAS): the hump
//             R/W 0.12-0.21 at C_V 2.2-4.5 (the brief: a real 172 on floats peaks at 0.15-0.20 near C_V 2.5-3), the
//             trim there under 11.5 deg, and past it the water's drag falls (R/W at 16 m/s under 0.85 of the hump).
//   LIFT-OFF  the same run airborne (both floats dry for 2 s) in 18-36 s and 250-500 m (the brief: ~20-35 s,
//             ~300-450 m; Wipaire ~335-365 m for 160-180 hp 172s); and with the G3390 rig's own technique (no flap,
//             no rotation: the wing lifts it at the step attitude) it gets off too, inside 60 s.
'use strict';
const path = require('path');
const T = __dirname;
const TT = require(path.join(T, 'hydro_trim_table.js'));
const C = TT.C, H = C.HYDRO;
let fails = 0;
const verdict = (ok, line) => { if (!ok) fails++; console.log((ok ? 'PASS ' : 'FAIL ') + line); };
const f = (v, n = 3) => (typeof v === 'number' && Number.isFinite(v)) ? v.toFixed(n) : String(v);
const G = 9.81, D2R = Math.PI / 180;

// ---- TANK -------------------------------------------------------------------------------------------------------
console.log('TANK (the 172R\'s Wipline 2350 hull, 578 kg, 8.5 m/s, trim held, heave free)');
{
  const def = TT.CASES.c172r_stc.def();
  const P0 = def.parts.floats[0].P;
  const tank = (tau, wakeSM) => {
    const P = Object.assign({}, P0, { mLoad: 578 - P0.mFloat, cgLoad: [-0.6, 1.2, 0], loadI: [150, 300, 300], wakeSM }); delete P._keel;
    const F = H.makeFloat(P), out = H.makeScratch(F), Wt = F.m * G;
    const S = H.makeBody(F, { keelY: -0.3, trim: tau, lockPitch: true });
    const dt = 1 / (60 * 45); let la = 0, lt = 0, r = 0, n = 0;
    for (let s = 0; s < 45 * 60 * 6; s++) {
      H.bodyStep(F, S, dt, H.stillWater, out, { vxHold: 8.5, F: [0, -S.v[1] * F.m * 4, 0] }, { mNode: 50, dt });
      if (s <= 45 * 60 * 4) continue;
      let a = 0;
      for (let k = 0; k < F.panels.length; k++) { const o = out.per[k]; if (!o.wet || F.panels[k].body !== 'A') continue;
        a += o.Fs[1] + o.Fp[1] + o.Ff[1] + o.Fx[1] + o.Fm[1] + o.Fr[1] + o.Fk[1]; }
      la += a; lt += out.F[1]; r += out.F[0]; n++;
    }
    return { aft: la / lt, R: r / n / Wt, L: lt / n / Wt };
  };
  const rows = [6, 9, 12].map(tau => ({ tau, now: tank(tau, 1), h0: tank(tau, 0) }));
  for (const w of rows) console.log(`   trim ${String(w.tau).padStart(2)} deg: afterbody ${f(100 * w.now.aft, 0).padStart(3)} % of the lift, R/W ${f(w.now.R)} (L/W ${f(w.now.L, 2)})` +
    `  | the H0 wake: afterbody ${f(100 * w.h0.aft, 0).padStart(3)} %, R/W ${f(w.h0.R)}`);
  verdict(rows[0].now.aft < rows[1].now.aft && rows[1].now.aft < rows[2].now.aft && rows[2].now.aft >= 0.15,
    `the afterbody's share rises with the trim (${rows.map(w => f(100 * w.now.aft, 0) + ' %').join(' -> ')}; >= 15 % at 12 deg): the wake stands on it`);
  verdict(rows[1].h0.aft < 0.05 && rows[2].h0.aft < 0.05, `...where the H0 wake left it dry at the hump (${rows.map(w => f(100 * w.h0.aft, 0) + ' %').join(' / ')}): the trim had nothing to hold it`);
  verdict(rows.every(w => Math.abs(w.now.L - 1) < 0.03 && Number.isFinite(w.now.R)), `the tank carries its load (L/W ${rows.map(w => f(w.now.L, 2)).join(' / ')}), finite`);
}

// ---- HUMP + LIFT-OFF ----------------------------------------------------------------------------------------------
console.log('\nHUMP and LIFT-OFF (172R + Wipline 2350, STC prop 82x43, 1,157 kg, calm, damage on)');
{
  const poh = TT.fly(TT.CASES.c172r_stc.def(), true);
  const rig = TT.fly(TT.CASES.c172r_stc.def(), false);
  for (const [k, r] of [['POH', poh], ['G3390 rig', rig]])
    console.log(`   ${k.padEnd(9)}: ${r.M} kg | hump R/W ${f(r.hump.R)} at ${f(r.hump.V, 1)} m/s (C_V ${f(r.hump.Cv, 2)}), trim ${f(r.hump.trim, 1)} deg | ` +
      `at 16 m/s R/W ${r.past ? f(r.past.R) : '-'} | ` + (r.air ? `lift-off ${f(r.air.t, 1)} s, ${f(r.air.V, 1)} m/s, ${Math.round(r.air.dist)} m` : 'not off') + (r.crashed ? ` | ${r.crashed}` : ''));
  verdict(poh.hump.R >= 0.12 && poh.hump.R <= 0.21 && poh.hump.Cv >= 2.2 && poh.hump.Cv <= 4.5,
    `the hump: R/W ${f(poh.hump.R)} at C_V ${f(poh.hump.Cv, 2)} (bound 0.12-0.21 at C_V 2.2-4.5)`);
  verdict(poh.hump.trim <= 11.5, `the trim at the hump ${f(poh.hump.trim, 1)} deg (bound 11.5; G3390 read 9.8-14, held there)`);
  verdict(!!poh.past && poh.past.R < 0.85 * poh.hump.R, `past the hump the drag falls: R/W ${poh.past ? f(poh.past.R) : '-'} at 16 m/s against ${f(poh.hump.R)} (bound 0.85 x)`);
  verdict(!!poh.air && poh.air.t >= 18 && poh.air.t <= 36 && poh.air.dist >= 250 && poh.air.dist <= 500 && !poh.crashed,
    `airborne in ${poh.air ? f(poh.air.t, 1) + ' s, ' + Math.round(poh.air.dist) + ' m' : 'never'} (bound 18-36 s, 250-500 m)`);
  verdict(!!rig.air && rig.air.t <= 60 && !rig.crashed, `the G3390 rig's own technique gets off too: ${rig.air ? f(rig.air.t, 1) + ' s, ' + Math.round(rig.air.dist) + ' m' : 'never'} (bound 60 s)`);
}

console.log(`\nGATE HYDROTRIM: ${fails ? 'FAIL' : 'PASS'}`);
process.exit(fails ? 1 : 0);
