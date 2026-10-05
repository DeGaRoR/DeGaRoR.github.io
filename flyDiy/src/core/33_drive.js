// ============================================================
// THE DRIVETRAIN'S LIMITS AND HOW IT FAILS (G1826, DMG-DRIVE; the user, 2026-10-05: "tests on the drivetrains to see
// when they break / fail, and we'll have to compare this to real numbers").
//
// Until this file the drivetrain could fail one way: TREE-CRASH's prop strike (30_solver propStrike), binary - the nose
// ring or an engine node on the ground, or a trunk in the disc, SEIZED the engine for good. Nothing limited the shaft
// speed (a full-throttle dive to 1.1 V_D turned the Cub's A-65 at 2796 rpm against its 2300 redline and nothing happened), the
// propeller's own disc never met the ground (only the nose's nodes did - the tips had been 0.4-0.9 m into it by then),
// nothing told a brushed tip from a sudden stoppage, a floatplane's disc never met the water, and no load the engine
// itself makes (its torque, the propeller's gyroscopic couple, a lost blade's imbalance) reached its mount.
//
// What is modelled here, at the level the game needs - a STATE and a few numbers per engine, never a crankshaft FEM -
// all of it behind the damage layer (30_solver: DMG_ON; with it off nothing here runs and the solver flies the base's
// bits). The real numbers (reports/evidence/DMG-DRIVE/real_numbers.json) are AS RECALLED - A0 to open each source:
//   OVERSPEED (Lycoming SB 369's bands, applied to every piston until A0 opens Continental's and Rotax's): the engine's
//     rpm over its MAXIMUM (the registry's rated, or the row's own max: the 582's 6800 over its 6500 rated):
//       <= +10 %   'logged'   - the bulletin's no-action band: the peak and the seconds go in the logbook
//       +10..20 %  'inspect'  - the prop off, the flange's run-out, the valve train (a bill line)
//       > +20 %    'overhaul' - the engine comes out (a teardown); it runs rough (GAME: 0.85 x thrust, vibration)
//       'failed'   - a GAME CHOICE past the bulletins' last band (they stop at 'overhaul'): a dose of (ratio - 1.25) x s
//                    past 0.25 (35 % over for 2.5 s, 50 % for 1 s) throws a rod or a valve: the engine stops
//     each band entered only after GEN_DRIVE.os.filt s above it (a frame's tick on a 60 Hz sim is not an overspeed);
//   A GRADED PROP STRIKE (Lycoming SB 533, Continental's propeller-strike bulletin, Rotax's manual: ANY strike that needs
//     the prop repaired, any sudden stoppage, a lost blade or tip = a teardown before the next flight), graded on the
//     BITE (how far the obstruction reaches into the disc, over its radius) and the blade's TIP SPEED at contact:
//       'brush'      the tips (bite <= 4 % of R): dressed; the engine runs on; the teardown is still owed
//       'bent'       a deeper bite into a surface that gives (the ground to 15 %, the water to 25 %; a rigid trunk only
//                    to 4 %): the blades bent - vibration, 0.6 x thrust; the engine may run
//       'stoppage'   past those: the prop stopped by the impact - the engine stops (seized, as TREE-CRASH's)
//       'separation' a blade (or its outer part) broken off: the strike's bite past 'bent' while the tip moved faster
//                    than the material takes (wood / carbon 120 m/s, alloy 200 m/s - GAME numbers): if the shaft was
//                    stopped, debris only (in the water past 1.6 x that); if not (a brittle tip lost to a brush at power), the prop turns on with a
//                    blade short - a rotating force m e w^2 on the engine's thrust nodes, every substep, which can tear
//                    the mount (and the engine leaves: D4b's debris)
//     the teardown finds INTERNAL damage on a seeded 15 % of strikes (AOPA 2007's 10-20 %, a summary's ratio: the bill's
//     overhaul line, never a gate);
//   THE GEARBOX (a geared engine): a strike past 'brush', or the overhaul band, marks it 'damaged' (Rotax: the gearbox is
//     inspected after either); a SUDDEN STOPPAGE with the engine pulling over half its power shears the drive: 'failed' -
//     the prop disconnects (it windmills, no thrust) and the engine runs UNLOADED, over-revving to its failure tier
//     unless the throttle is closed;
//   THE MOUNT under FAR 23.361's torque, 23.363's side load and 23.371's gyroscopic couple: certificate cases (66_gen_cert
//     genCertDrive), so the mount is certified for them; and a lost blade's imbalance as the dynamic load (above).
// sim.damage().drive[k] carries every field (named for D4b's look, D5's bill and the Sound Coordinator: HANDOVER G1826).
// ============================================================
const GEN_DRIVE = {
  // per registry row (the powerplant key a build names): the cylinder count (FAR 23.361(c)'s factor) and, where the
  // maximum is not the rated, the maximum engine rpm (the operator's manual's 5-minute figure)
  eng: {
    a65_sensenich74: { cyl: 4 }, o200_eprops: { cyl: 4 }, io360_mccauley: { cyl: 4 }, o320_mccauley: { cyl: 4 },
    o540_hartzell: { cyl: 6 }, io550_hartzell3: { cyl: 6 }, io720_hartzell3: { cyl: 8 }, vw2180_wood: { cyl: 4 },
    jabiru2200_std: { cyl: 4 }, mikron3_wood: { cyl: 4 }, gipsymajor1_wood: { cyl: 4 }, ranger440_wood: { cyl: 6 },
    hirth508_wood: { cyl: 8 }, argus10c_wood: { cyl: 8 },
    rotax912_warp: { cyl: 4 }, rotax915_carbon: { cyl: 4 },
    rotax582_ivo: { cyl: 2, rpmMax: 6800 }, rotax503_wood: { cyl: 2 }, rotax277_pusher: { cyl: 1 },
    r1830_hs23e50: { cyl: 14 }, r985_hs2b20: { cyl: 9 }, r1340_hs12d40: { cyl: 9 }, r755_hs2b: { cyl: 7 }, w670_hs2b: { cyl: 7 },
    m14p_v530: { cyl: 9 }, verner7u_wood: { cyl: 7 }, rotec3600_std: { cyl: 9 },
  },
  famCyl: { four: 4, two: 2 },        // a custom engine's count when the row says nothing (a radial: 7)
  // OVERSPEED: the bands on the ratio engine rpm / max (SB 369 as recalled), the filter (s), the failure dose (a GAME
  // choice: past the overhaul band, s x (ratio - fail)), the overhaul band's rough running
  os: { insp: 1.10, ovh: 1.20, filt: 1.0, fail: 1.25, dose: 0.25, ovhK: 0.85, ovhVib: 0.3 },
  // THE STRIKE: the bite over R per surface ('soft' the ground, 'water', 'rigid' a trunk) where 'bent' ends and the prop
  // stops; the tips' band; the tip speed past which a blade breaks off rather than bends (m/s, GAME numbers by material);
  // a bent prop's thrust; the vibration of each tier
  // (turf: a disc on soft ground mows the grass's top `turf` m before its tips meet the soil - not a strike; the metal
  // Cessna's disc sits 1.1 cm into the ground settled on its nosewheel, 4.2 cm in the spawn's settle, HANDOVER G1824)
  strike: { turf: 0.05, brush: 0.04, stop: { soft: 0.15, water: 0.25, rigid: 0.04 }, sep: { wood: 120, maple: 120, walnut: 120, carbon: 120, alu: 200 },
            sepWater: 1.6,   // the water gives more than the soil: a blade breaks there only past 1.6 x its tip speed (an
                             // ordinary bow-in at 0.2 throttle dipped the twin's carbon tips 4.6 % of R at 128 m/s)
            bentK: 0.6, vib: { brush: 0.1, bent: 0.6, stoppage: 0, separation: 1 } },
  // a lost blade: the share of one blade's mass gone and where its centre was (x R): the rotating force m e w^2
  imb: { frac: 0.35, at: 0.75 },
  internalP: 0.15,                    // the seeded share of teardowns that find internal damage (AOPA 2007, 10-20 %)
  gear: { stopPow: 0.5, runaway: 1.45 }, // a stoppage past half power shears a geared drive; the unloaded engine's rpm / max at full throttle
  // the certificate's loads (66_gen_cert genCertDrive; FAR 23 as recalled): 23.361's factor by cylinders, the condition A
  // share it acts with (the take-off torque with 75 %, the maximum continuous with 100 %: the same torque on a piston),
  // 23.363's side load, 23.371's rates and load factor
  far: { tq: { turbine: 1.25, many: 1.33, 4: 2, 3: 3, 2: 4, 1: 4 }, side: 1.33, yaw: 2.5, pitch: 1.0, gyroNz: 2.5 },
  // the propeller's polar moment of inertia about its shaft: a blade as a tapered bar, I = k m R^2 (k 0.25 for a blade
  // whose mass falls off outboard; a uniform rod would be 1/3) - the registry has the mass (60_gen_spec prop.mass)
  Ik: 0.25,
};
// 23.361(c)'s factor for an engine of `cyl` cylinders (a turbine 1.25; an electric motor has no cylinders: 1.25, its
// torque being as smooth as a turbine's - not the regulation's, which predates them)
function genDriveTorqueFactor(cyl, family) {
  const F = GEN_DRIVE.far.tq;
  if (family === 'turbine' || family === 'electric') return F.turbine;
  if (cyl >= 5) return F.many;
  return F[Math.max(1, cyl | 0)] || F[4];
}
// THE DRIVETRAIN OF A DEF: per engine its limits and its propeller (what 30_solver and 66_gen_cert read)
function genDriveSpec(def) {
  const P = (def && def.params) || {}, PP = typeof POWERPLANTS !== 'undefined' ? POWERPLANTS[P.powerplant] : null;
  const E = P.engine || (PP && PP.engine) || {}, PR = P.prop || (PP && PP.prop) || {}, SP = (def && def.spec && def.spec.prop) || {};
  const row = GEN_DRIVE.eng[P.powerplant] || {};
  const rated = E.rpm > 0 ? E.rpm : 2300, gear = E.gear > 0 ? E.gear : 1;
  const cyl = row.cyl || (E.layout === 'radial' ? 7 : GEN_DRIVE.famCyl[E.family] || 4);
  const D = PR.D > 0 ? PR.D : 1.8, R = D / 2;
  const mass = SP.mass > 0 ? SP.mass : (2 * 2.4 * Math.pow(D / 1.88, 2.5));
  const blades = SP.blades > 0 ? SP.blades : 2, mat = SP.material || 'wood';
  const omegaR = 2 * Math.PI * (rated / gear) / 60;
  const Q = (E.powerW || 0) / (2 * Math.PI * rated / 60);       // the engine's mean torque at rated (N m, crank)
  return { rated, rpmMax: row.rpmMax || rated, gear, cyl, family: E.family || 'four', cs: !!E.cs, powerW: E.powerW || 0,
           Q, Qprop: Q * gear, tqK: genDriveTorqueFactor(cyl, E.family), D, R, mass, blades, mat, omegaR,
           I: GEN_DRIVE.Ik * mass * R * R, sepTip: GEN_DRIVE.strike.sep[mat] || GEN_DRIVE.strike.sep.wood };
}
// a fresh per-engine state (the fields sim.damage().drive[k] carries)
function genDriveState() {
  return { os: null, osPeak: 0, osSec: 0, osExc: 0, osDose: 0, osT: [0, 0, 0],
           strike: null, strikeAt: null, bladeLost: 0, gearbox: null, failed: false, why: null,
           teardown: false, internal: false, thrustK: 1, vib: 0, tipMach: 0, imbN: 0, rpmMax: 0, gapMin: Infinity };
}
// OVERSPEED, one frame: `st` the state, `ratio` engine rpm / max, `dt` s. Bands entered after GEN_DRIVE.os.filt s above
// them (each band's own clock); the failure on the dose. Returns true when the engine has just failed
const GEN_DRIVE_OS = ['logged', 'inspect', 'overhaul', 'failed'];
function genDriveOverspeed(st, ratio, dt) {
  const O = GEN_DRIVE.os;
  if (!(ratio > 1)) return false;
  if (ratio > st.osPeak) st.osPeak = ratio;
  st.osSec += dt;
  if (ratio > O.insp) st.osExc += dt;
  const th = [1, O.insp, O.ovh];
  let lvl = GEN_DRIVE_OS.indexOf(st.os);
  for (let b = 0; b < 3; b++) if (ratio > th[b]) { st.osT[b] += dt; if (st.osT[b] >= O.filt && lvl < b) lvl = b; }
  if (ratio > O.fail) st.osDose += (ratio - O.fail) * dt;
  let failed = false;
  if (st.osDose >= O.dose && lvl < 3) { lvl = 3; failed = true; }
  st.os = lvl >= 0 ? GEN_DRIVE_OS[lvl] : st.os;
  if (lvl >= 2) st.teardown = true;
  return failed;
}
// THE STRIKE'S TIER from the bite (m), the disc's radius, the surface ('soft' | 'water' | 'rigid') and the tip speed at
// contact (m/s) against the blade's own (genDriveSpec sepTip): 1 brush, 2 bent, 3 stoppage, 4 separation
const GEN_DRIVE_STRIKE = [null, 'brush', 'bent', 'stoppage', 'separation'];
function genDriveStrikeTier(bite, R, surf, tip, sepTip) {
  const S = GEN_DRIVE.strike, r = bite / (R || 1);
  if (!(r > 0)) return 0;
  if (r <= S.brush) return tip > sepTip && surf === 'rigid' ? 4 : 1;
  const stop = S.stop[surf] != null ? S.stop[surf] : S.stop.soft;
  if (tip > sepTip * (surf === 'water' ? S.sepWater : 1)) return 4;
  return r > stop ? 3 : 2;
}
