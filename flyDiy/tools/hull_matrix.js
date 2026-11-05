#!/usr/bin/env node
// hull_matrix.js - THE FLYING BOAT'S TEST MATRIX (HULL-B7, a TOOL, not a gate: the user, 4 Nov, "let's test this thing
// asap ... and get the engine various configurations"). Every hull form (the Hull form tile) x every engine
// configuration (the Engine mount / Engines tiles) on the user's Cessna-on-floats build, each built the way a builder
// would - the tiles applied through the design module's own designApply, the game's load chain (_load_build.js), the
// Hull tile's fit off the flown CG and mass (two passes: cageHullFit + HYDRO.hullTipFit, GATE HULL's cycle) - then
// SETTLED on the sea and flown off the SEA lane by THE PILOT (43_pilot.js). One row per combination.
//
//   node tools/hull_matrix.js                         -> the whole matrix, 3 combinations at a time
//   node tools/hull_matrix.js --forms=classic,deep --engines=pylon,twin [--jobs=N] [--json=out.json]
//   node tools/hull_matrix.js --one=classic:pylon     -> one combination (what the children run)
//   node tools/hull_matrix.js --one=classic:pylon --save=b.json  -> also the fitted build, for tools/quick_view.js
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const T = __dirname, ROOT = path.join(T, '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const a = argv.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };

const FORMS = ['classic', 'deep', 'flat', 'soft', 'stepless'];
// the engine configurations a boat can wear, each a tile selection plus the rows a builder sets for a boat
const ENGINES = {
  pylon: { sel: { engMount: 'wingTop' }, cage: { engPylonH: 1.0, engPylonFair: 2, cowlOn: 1, noseLen: 1.3 },
           note: 'one engine on a pylon over the wing, pushing, in a pod nacelle (Lake, Seabee)' },
  // (HULL-B13, the user: "putting four times even 150 horsepower is huge power for such sports light planes" - the
  // pair and the four carry engines sized to the boat - the catalogue's preset applied as the Engine model tile does,
  // _load_build's 'engPreset:<name>' after; the Cessna's O-540 stays on the single pylon)
  twin: { sel: { engCount: 2 }, cage: { noseLen: 1.3 }, engine: 'rotax 912 (flat)',
          note: 'a pair of Rotax 912s on the wing (Che-27, LA-8)' },
  pushPull: { sel: { engCount: 'pushPull' }, cage: {}, engine: 'rotax 912 (flat)',
              note: 'a Rotax 912 in the nose and one pushing behind the cabin, the tail on twin booms (the Skymaster layout)' },
  pylonBlade: { sel: { engMount: 'wingTop' }, cage: { engPylonH: 1.0, engPylonForm: 1, cowlOn: 1, noseLen: 1.3 },
                note: 'the pylon pusher on ONE wing-section blade on the centreline (the Lake\'s, the SeaMax\'s), flown as braced' },
  aftBlade: { sel: { engMount: 'wingTop' }, engine: 'rotax 915 iS', cage: { engPylonH: 0.75, engPylonForm: 1, engBlockZ: -0.7, cowlOn: 1, noseLen: 1.3, taperW: 0.62, tailHalfW: 0.085 },
              note: 'the engine behind the cabin on a short blade, the tail cone slimmed to a boom (the Icon\'s, the SeaRey\'s silhouette on our rows)' },
  icon: { sel: { engMount: 'wingTop' }, engine: 'rotax 915 iS', cage: { engPylonAt: 1, engPylonAft: 0.15, engPylonH: 0.55, engPylonForm: 1, engPylonFair: 3, cowlOn: 1, noseLen: 1.3, taperW: 0.62, tailHalfW: 0.085 },
          note: 'the engine on the fuselage behind the cabin on a blended blade, its prop over a slim tail boom (the Icon A5, the Aventura)' },
  // (HULL-B18, the user: "an Icon puts its boom really low, keeps a large space behind the cabin and sticks the engine
  // in there"): THE TUB - the pod lengthened by an engine bay behind the cabin (paxLen), the pusher on its aft face with
  // the thrust line high on it (engY), the tail on a rod the rod fit sets LOW (under the hub's disc)
  tub: { sel: { engMount: 'pusher' }, engine: 'rotax 915 iS', cage: { paxLen: 0.6, engY: 0, noseLen: 1.3, hullTubLen: 2.2, hullTubRise: 8, cowlOn: 1, hullSpon: 1, hullSponK: 1.1, hullTips: 0 },
         note: 'the hull tub: cabin + engine bay in one pod, the pusher high on its aft face, the tail on a low rod boom (the Icon A5)' },
  fin: { sel: { engMount: 'fin' }, engine: 'rotax 915 iS', cage: { noseLen: 1.3, engFinAt: 0.55 },
         note: 'a tractor on the fin (the Seawind): a first cut, the bare engine on its tube mount' },
  // HULL-B23 (the user's recipe): the over-the-wing engine pushing, on the wing (its lowest pylon - the fit raises it
  // only for the water), the straight pod nacelle with its air inlet; the cabin as built; the tail on a rod whose
  // taper is the hull's buoyant afterbody; stub sponsons
  rodBoat: { sel: { engMount: 'wingTop' }, engine: 'rotax 915 iS',
             cage: { engPylonH: 0.8, engBlockZ: -0.25, cowlOn: 1, cw_inletOn: 1, noseLen: 1.3, paxLen: 0.15, aeroAftOn: 0, boomStyle: 1, boomTwin: 0, taperOn: 1, taperLen: 3.0, aftRoofY: -0.25, aftKeelY: -0.6, frBoomTopW: 0.22, frBoomWaistW: 0.3, frBoomBotW: 0.26, rodY: -0.42,
                     hullSpon: 1, hullSponK: 1.1, hullTips: 0 },
             note: 'the rod boat: a pusher on the wing in a pod nacelle, the tail on a rod over a buoyant taper, stub sponsons' },
  // HULL-B26: the fin engine with BUOYANT WING TIPS (the Seawind's arrangement): the wing's own drooped tip, bent and
  // filled by the fit (Wings > tip length / drop / fullness) - on the Cessna's high wing, then on a low wing (the Seawind's)
  finTips: { sel: { engMount: 'fin' }, engine: 'rotax 915 iS', cage: { noseLen: 1.3, engFinAt: 0.55, hullTips: 2, wgTip: 7 },
             note: 'the fin engine on buoyant wing tips, high wing' },
  seawind: { sel: { engMount: 'fin' }, engine: 'rotax 915 iS', cage: { noseLen: 1.3, engFinAt: 0.55, hullTips: 2, wgTip: 7, wgPos: 1, wgBrace: 1 },
             note: 'the fin engine on buoyant wing tips, a cantilever mid wing on the hull side (the Seawind)' },
  // HULL-B28: OUTRIGGER HULLS (the Adventurer 333's pontoons, the Seagull's / MVP's side hulls) on faired blades
  outrig: { sel: { engCount: 2 }, engine: 'rotax 912 (flat)', cage: { noseLen: 1.3, hullTips: 3, hullTipAt: 0.5 },
            note: 'outrigger hulls on faired blades under a twin (the side hulls of the Seagull and the MVP)' },
  outrigP: { sel: { engMount: 'wingTop' }, engine: 'rotax 915 iS', cage: { engPylonH: 1.2, engPylonForm: 1, engPylonFair: 3, cowlOn: 1, noseLen: 1.3, hullTips: 3, hullTipAt: 0.5 },
             note: 'outrigger hulls on faired blades, the pusher on a blended blade pylon (the Adventurer 333)' },
  // HULL-B29: PLANING WING ROOTS (the Be-103, the Equator P2): a cantilever low wing whose inner panels plane and float, the
  // twin on it - no tip floats, no sponsons
  roots: { sel: { engMount: 'fin' }, engine: 'rotax 915 iS', cage: { noseLen: 1.3, engFinAt: 0.55, wgPos: 2, wgBrace: 1, hullSpon: 3, hullSponK: 0.9, hullTips: 0 },
           note: 'planing wing roots on a cantilever low wing, the engine on the fin (the Equator P2: its engine in the tail)' },
  // HULL-B30: THE BE-103 - planing wing roots on a cantilever low wing, the pair on stub pylons off the rear fuselage
  be103: { sel: { engCount: 2 }, engine: 'rotax 915 iS', cage: { noseLen: 1.3, wgPos: 2, wgBrace: 1, hullSpon: 3, hullSponK: 0.9, hullTips: 0, engNacOver: 2, engPylonAft: 0.25 },
           note: 'planing wing roots, the pair on stub pylons off the rear fuselage (the Be-103)' },
  // HULL-B31: THE SUPER PETREL - a biplane boat: the lower plane mid on the hull with stub sponsons under it, the upper a
  // parasol over it (plane 0: the over-the-wing mount stands on the first plane), the pusher on its pylon over it
  petrel: { sel: { engMount: 'wingTop', planes: 'biplane' }, engine: 'rotax 915 iS',
            cage: { wgPos: 3, wgBrace: 1, w2Pos: 1, engPylonH: 0.80, cowlOn: 1, noseLen: 1.3, hullSpon: 1, hullSponK: 1.0, hullTips: 0 },
            note: 'a biplane boat, the pusher over the parasol, stub sponsons (the Super Petrel) - built, plows at Cessna size (HULL-B31)' },
  // HULL-B31: TWO STEPS (the Dornier Wal; NACA's "English-type" hull) on the pylon pusher, strut tip floats
  twoStep: { sel: { engMount: 'wingTop' }, cage: { engPylonH: 1.0, engPylonFair: 2, cowlOn: 1, noseLen: 1.3, hullSteps: 2, hullStep2Z: 1.2, hullHs2: 0.05 },
             note: 'a two-step hull under the pylon pusher (the Dornier Wal\'s hull)' },
  // HULL-B35: THE SUPER PETREL ON THE ROD BOAT'S POD (the hull tub narrowing into its boom - the real one's): the rod
  // boat's lofted buoyant pod and rod, the biplane tile's planes (a parasol over a mid plane), the pusher on its pylon
  // over the upper, stub sponsons
  petrelRod: { sel: { engMount: 'wingTop', planes: 'biplane' }, engine: 'rotax 915 iS',
               cage: { engPylonH: 0.8, engBlockZ: -0.25, cowlOn: 1, cw_inletOn: 1, noseLen: 1.3, paxLen: 0.15, aeroAftOn: 0, boomStyle: 1, boomTwin: 0, taperOn: 1, taperLen: 3.0, aftRoofY: -0.25, aftKeelY: -0.6, frBoomTopW: 0.22, frBoomWaistW: 0.3, frBoomBotW: 0.26, rodY: -0.42,
                       wgPos: 3, wgBrace: 1, w2Pos: 1, hullSpon: 1, hullSponK: 1.1, hullTips: 0 },
               note: 'the Super Petrel on the rod boat\'s pod: a biplane, the pusher over the parasol, stub sponsons' },
  // HULL-B36: THE SUPER PETREL LS AT ITS SIZE (futureDesigns/SUPER-PETREL-2026-11.md; the blueprint targets in
  // tools/ref_match/refs/super_petrel/target.json; cage rows in cage units = metres / planeScale 0.745): the tub (0.97 m
  // keel to canopy, 1.2 m beam, the bow 0.74 m to the windscreen, a 1.36 m cockpit), its afterbody closing into a 0.15 m
  // boom at 0.36 m over the keel, the boom 2 m climbing 9.5 deg; the sesquiplane (upper 8.9 x 1.0 parasol, lower 7.0 x
  // 0.8 low on the hull with 5 deg dihedral, 0.4 m aft), drooped tips; the pusher 912 iS on the roof pylon behind the
  // cockpit, under the upper wing
  superPetrel: { sel: { engMount: 'wingTop', planes: 'biplane', paxCount: 0 }, engine: 'rotax 912 (flat)',
    // (HULL-B36, the user: "keep the hull/fuselage architecture of the cessna, just get rid of the pax section. Then use
    // the pod and rod structure we've built for the icon, apply it, then match the rod orientation and length, then
    // match the fin. Your wings are OK, they need the winglet end though") - the Cessna's cabin and bow as they are, no
    // passenger bay; the rod boat's pod and rod (its lofted buoyant taper, the straight tube) with the tube's incline,
    // height and length and the fin set to the blueprint; the wings as matched, their tips turned down (the tip's own
    // length and drop rows: a downward winglet)
    // (HULL-B37, the user: "your new cabin is far too tall, get it back to the previous settings, and don't touch cabin
    // height" - the first card's section; the step in the buoyant taper under the lower wing, hullStepZ; "the engine
    // should reach the wing and intersect it. Place it further fore and high")
    cage: { keelY: -0.62, roofY: 0.68, canopy: 3, frPostBotY: -0.625, frWinBotY: -0.586, hullRocker: 0.0, hullSkirt: 0.04, wsBaseLift: 0, crewOn: 1, seatLayout: 1, seatType: 11, seatRake: 45, seatTilt: 12, seatH: 0.02, topRound: 0.6, bpStrutK: 0.5, bpCabDraw: 0, waistY: 0.05, halfW: 0.805, roofHalfW: 0.60, floorY: -0.42, bandH: 0.12, noseJointOn: 0,
            noseLen: 1.3, aeroAftOn: 0, boomStyle: 1, boomTwin: 0, taperOn: 1, taperLen: 2.46, aftRoofY: 0.12, aftKeelY: -0.52,
            hullStepZ: 0.52, hullFlute: 0.16, hullBeta: 12, hullBetaBow: 22, hullBetaA: 10, hullFluteN: 1, hullFluteAt: 0.55, hullFluteBow: 0.9, hullStrakes: 0, hullStrakeW: 0.045, hullStrakeLen: 0.85,
            frBoomTopW: 0.30, frBoomWaistW: 0.45, frBoomBotW: 0.40, rodY: -0.10, rodIncl: 5, rodD: 0.15, boomLen: 2.2,
            finHeight: 1.1, finChord: 1.05, finChordTip: 0.45, stY: 0.65, stZ: -0.35, stChord: 0.75, stChordTip: 0.6,
            wgSpan: 9.16, wgChord: 1.0, wgChordTip: 1.0, wgTipX: 0, wgDihedral: 0, wgPos: 3, wgParaH: 0.6, wgDx: -0.8, wgBrace: 1, wgCrankAt: 0,
            wgTip: 7, wgTipBow: 0.45, wgTipDroop: 0.30,
            w2On: 1, w2Pos: 1, w2Dy: -0.1, w2Span: 7.0, w2Chord: 0.8, w2ChordTip: 0.8, w2Dihedral: 8, w2Stagger: -0.05, w2Tip: 7, w2CrankAt: 0,
            engPylonAt: 1, engPylonH: 0.55, engPylonAft: -1.1, engPylonFair: 3, cowlOn: 1, cw_inletOn: 1, cw_propD: 1.25,
            hullSpon: 0, hullTips: 1, hullTipPlane: 1, hullTipAt: 0.78, hullTipKg: 25, hullTipY: 0.416 },
    note: 'the Super Petrel LS on the Cessna cabin, pod and rod (HULL-B36)' },
  tandem: { sel: { engCount: 'tandem' }, engine: 'rotax 912 (flat)', cage: { engPylonH: 1.25, noseLen: 1.3 },
            note: 'two Rotax 912s back to back on one pylon over the wing, one pulling, one pushing (the Seastar)' },
  pylonTractor: { sel: { engMount: 'wingTop', engAim: 'puller' }, cage: { engPylonH: 1.0, engPylonFair: 2, cowlOn: 1, noseLen: 1.3 },
                  note: 'one engine on a pylon over the wing, pulling (the Seabird / Osprey class)' },
  four: { sel: { engCount: 4 }, cage: { noseLen: 1.3 }, engine: 'rotax 582',
          note: 'two pairs of Rotax 582s on the wing, inner and outer (the big boats\' layout, at sport size)' },
  pusher: { sel: { engMount: 'pusher' }, cage: {},
            note: 'a pusher on the pod\'s aft bulkhead, the tail on a rod (SeaRey, Aventura)' },
  nose: { sel: {}, cage: {},
          note: 'the Cessna\'s own nose tractor (the control: a boat with its propeller at the bow)' },
};

// THE ROLL, whatever the heading: the body's lateral axis (x aft cross y up) out of the horizontal (HULL-B10: the up
// axis's world z read the roll only on the reset heading - a boat yawed by its abort read 1 deg while it turned turtle)
const rollOf = (xA, yU) => { const z1 = xA[2] * yU[0] - xA[0] * yU[2]; return Math.asin(Math.max(-1, Math.min(1, z1))) * 180 / Math.PI; };
function one(form, eng) {
  const C = require('./flight_core.js'), G = require('./_cage_gen.js'), D = require('./_cage_design.js'), LB = require('./_load_build.js');
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'bugReports', 'cessnaFloatsWOrks.json'), 'utf8'));
  const sp = raw.spec || raw, E = ENGINES[eng];
  delete sp.gear.floats;
  const ap = D.designApply(Object.assign({}, sp.cage), Object.assign({ gearLayout: 'hull', hullForm: form }, E.sel));
  sp.cage = Object.assign({}, sp.cage, ap.cage, E.cage);
  sp.gear = Object.assign({}, sp.gear, (ap.spec && ap.spec.gear) || {}, { type: 'hull' });
  const res = { form, eng, missing: ap.missing };
  const defOf = s2 => C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(s2))));
  let spec = null, errs = [], fitAll = null; const fitRows = {};
  // THE FIT CYCLE, the page's (_cage_float.js hullFitStep): build, read the flown CG / mass / propeller discs, fit
  // (_cage_gen.js cageHullFitAll: the step, the balance, the propellers' clearance, the tip floats), build again
  for (let pass = 0; pass < 4; pass++) {
    const got = LB.gameSpecFull(Object.assign(JSON.parse(JSON.stringify(raw)), { afters: ap.afters.filter(a => a !== 'CAGE_HULL_FIT_NEXT').concat(E.engine ? ['engPreset:' + E.engine] : []) }));
    spec = got.spec; errs = got.errors || [];
    if (pass === 3 || !spec.gear.hull || opt('nofit')) break;   // (HULL-B36: --nofit - the card's own rows, as drawn: a recreation measured against its blueprint)
    const d = defOf(spec); let cx = 0, cy = 0, mass = 0;
    for (const n of d.nodes) { mass += n.m; cx += n.m * n.p[0]; cy += n.m * n.p[1]; } cx /= mass; cy /= mass;
    const P = G.cageFromSpec(spec), FS = (G.CAGE_UNIT || 1) * (P.planeScale || 1);
    const TB = G.cageHullTable(G.cageHullLines(P), FS), hr = spec.gear.hull;
    if (!TB) break;
    fitAll = G.cageHullFitAll(P, { cg: [cx, cy], mass, zFw: hr.x + TB.zStep * FS, yD: TB.yStep * FS - hr.y, props: C.HYDRO.propDiscs(d),
                                tipArm: ((d.parts.floats || []).find(q => q.tip) || { K: [] }).K.reduce((a, i) => Math.max(a, Math.abs(d.nodes[i].p[2])), 0),
                                finH: (ys => ys.length ? Math.max(...ys) - Math.min(...ys) : 0)(d.nodes.filter(n => n.tag === 'VF').map(n => n.p[1])) },
                              C.HYDRO, { semi: d.nodes.reduce((a, n) => Math.max(a, Math.abs(n.p[2])), 0),
                                         tip: { joint: C.genTipJointOf(d), fit: C.genTipFit, drooped: Object.keys(C.GEN_TIPS).indexOf('drooped') } });   // (the wing's tip: the furthest node off the centreline)
    if (!fitAll) break;
    Object.assign(sp.cage, fitAll.rows); Object.assign(fitRows, fitAll.rows);
    if (process.env.HM_DEBUG) console.error("pass", pass, JSON.stringify(fitAll.rows), JSON.stringify(fitAll.rest), fitAll.notes.join("; "));
  }
  res.fit = fitAll && { rows: fitRows, rest: fitAll.rest, notes: fitAll.notes };
  res.errors = errs;
  if (opt('save')) fs.writeFileSync(opt('save'), JSON.stringify({ spec }, null, 1));   // the fitted build, for quick_view
  if (!spec.gear.hull) { res.verdict = 'NO HULL (' + spec.gear.type + ')'; return res; }
  if (opt('fitonly')) { res.verdict = 'FITTED'; return res; }   // (--fitonly: the fitted build only - for renders)
  const def = C.buildGen(C.genMigrateSpec(JSON.parse(JSON.stringify(spec))));
  let M = 0, mx = 0, my = 0; for (const n of def.nodes) { M += n.m; mx += n.m * n.p[0]; my += n.m * n.p[1]; } mx /= M; my /= M;
  const W = M * 9.81, hr = spec.gear.hull, fl = def.parts.floats;
  res.gross = +M.toFixed(0);
  res.stepDeg = +(Math.atan2(hr.x - mx, my - hr.y) * 180 / Math.PI).toFixed(1);
  res.engines = (spec.engines || []).map(e => e.mount + ':' + e.type).join('+');
  // SETTLE (the sea south of home, 0.2 m drop, idle)
  const world = C.makeWorld(), X0 = 0, Z0 = 1600, h = world.waterH(X0, Z0);
  const sim = C.makeSim(def, world); sim.reset(0);
  { const p = sim.p, v = sim.v, iK = fl[0].K[2]; const dx = X0 - p[iK * 3], dz = Z0 - p[iK * 3 + 2], dy = h + 0.2 - p[iK * 3 + 1];
    for (let i = 0; i < sim.n; i++) { p[i * 3] += dx; p[i * 3 + 1] += dy; p[i * 3 + 2] += dz; v[i * 3] = v[i * 3 + 1] = v[i * 3 + 2] = 0; } }
  sim.ctl.thr = 0;
  let tr = 0, rl = 0, n = 0, ok = true, Fy = 0, bow = Infinity, upMin = 1, wetProp = 0;
  for (let s = 0; s < 600; s++) {
    sim.step(1 / 60);
    const [xA, yU] = sim.axes();
    const trim = Math.asin(Math.max(-1, Math.min(1, -xA[1]))) * 180 / Math.PI, roll = rollOf(xA, yU);
    if (!Number.isFinite(trim)) { ok = false; break; }
    upMin = Math.min(upMin, yU[1]);                 // (a boat that turned over reads a small roll and trim - the up axis says it)
    if (sim.out && sim.out.propWet) wetProp |= sim.out.propWet;
    if (s >= 480) {
      tr += trim; rl += Math.abs(roll); n++; Fy += sim.hydro.floats.reduce((a, x) => a + x.out.F[1], 0) / W;
      const hu = sim.hydro.floats[0], dk = hu.F.sta[0]; bow = Math.min(bow, Math.min(...[dk.Dm, dk.Dp].map(i => hu.out.W[i][1])) - hu.h);
    }
  }
  res.settle = ok && upMin < 0.5 ? 'CAPSIZED' : ok ? { propWet: wetProp, trim: +(tr / n).toFixed(1), roll: +(rl / n).toFixed(1), LW: +(Fy / n).toFixed(3), bowDeck: +bow.toFixed(2) } : 'DIVERGED';
  // TAKE-OFF (the pilot, the SEA lane, calm)
  const w2 = C.makeWorld(), sea = w2.aerodromes.find(a => a.id === 'SEA');
  const s2 = C.makeSim(def, w2); s2.reset(0); C.placeAtAerodrome(s2, sea);
  const pil = C.makePilot(s2, def, w2); pil.setRoute(sea, sea);
  let Tt = 0, wasWet = true, dryFrom = null, lift = null, hump = 0, humpV = 0, hdg0 = null, swing = 0, maxRoll = 0, Vlift = 0, fin = true;
  for (let s = 0; s < 90 * 60; s++) {
    pil.update(1 / 60); s2.step(1 / 60); Tt += 1 / 60;
    const v = s2.cgVel(), [xA, yU] = s2.axes();
    if (!Number.isFinite(v[0])) { fin = false; break; }
    // (a solver that blew up flies too, at 1 km/s: a node faster than any aeroplane is a divergence, not a flight)
    if (s % 30 === 0) { let vm = 0; for (let i = 0; i < s2.n; i++) vm = Math.max(vm, Math.abs(s2.v[i * 3]) + Math.abs(s2.v[i * 3 + 1]) + Math.abs(s2.v[i * 3 + 2])); if (vm > 300) { fin = false; break; } }
    const fx = s2.hydro.floats, wet = fx.reduce((a, x) => a + x.wet, 0) > 0, V = Math.hypot(v[0], v[2]);
    const hdg = Math.atan2(-xA[0], -xA[2]) * 180 / Math.PI;
    if ((pil.phase === 'ROLL' || pil.phase === 'LIFTOFF') && wet && lift == null) {
      if (hdg0 == null) hdg0 = hdg;
      swing = Math.max(swing, Math.abs(((hdg - hdg0 + 540) % 360) - 180));
      maxRoll = Math.max(maxRoll, Math.abs(rollOf(xA, yU)));
      let Rx = 0; for (const x of fx) Rx += -(x.out.F[0] * v[0] + x.out.F[2] * v[2]) / Math.max(0.3, V);
      if (V < 14 && Rx / W > hump) { hump = Rx / W; humpV = V; }
    }
    if (process.env.HM_TRACE && s % 30 === 0) console.error('t', Tt.toFixed(1), 'V', V.toFixed(1), 'roll', rollOf(xA, yU).toFixed(1), pil.phase, 'wet', fx.map(x => x.wet ? 1 : 0).join(''), 'keel-h', (def.parts.floats || []).map((q, i) => (Math.min(...q.K.map(k => s2.p[k * 3 + 1])) - (fx[i] && fx[i].h != null ? fx[i].h : 0)).toFixed(2) + (q.tip ? (s2.p[q.K[0] * 3 + 2] > 0 ? 'R' : 'L') : 'H')).join(' '), 'Fy', fx.map(x => (x.out.F[1] / W).toFixed(2)).join(' '), 'broken', (s2.damage ? (s2.damage().broken || []).length : '?'));   // (HULL-B28: the run, every half second)
    if (!wet && wasWet && Tt > 2 && lift == null) { dryFrom = Tt; Vlift = V; }
    if (wet && !wasWet && lift == null) dryFrom = null;
    if (!wet && dryFrom != null && lift == null && Tt - dryFrom >= 2) lift = dryFrom;
    wasWet = wet;
    if (lift != null && Tt > lift + 2) break;
  }
  res.takeoff = fin ? { airborne: lift == null ? null : +lift.toFixed(1), Vlift: lift == null ? null : +Vlift.toFixed(1), hump: +hump.toFixed(3), humpV: +humpV.toFixed(1),
                        swing: +swing.toFixed(1), roll: +maxRoll.toFixed(1),
                        // (HULL-B35: the break code's verdict on the run - members broken / yielded, the user: "see if that
                        // takes off without breaking")
                        ...(s2.damage ? { breaks: s2.damage().breaks || 0, yields: s2.damage().yields || 0 } : {}) } : 'DIVERGED';
  const okSettle = typeof res.settle === 'object' && Math.abs(res.settle.LW - 1) < 0.05 && res.settle.bowDeck > 0.1 && res.settle.roll < 6;
  const okTO = typeof res.takeoff === 'object' && res.takeoff.airborne != null && res.takeoff.airborne < 60 && res.takeoff.swing < 30;
  res.verdict = !errs.length && okSettle && okTO ? 'FLIES' : [errs.length ? 'join errors' : null, okSettle ? null : 'settle', okTO ? null : 'take-off'].filter(Boolean).join(', ');
  return res;
}

const oneArg = opt('one');
if (oneArg) {
  const [form, eng] = oneArg.split(':');
  let r;
  try { r = one(form, eng); } catch (e) { r = { form, eng, verdict: 'THREW ' + e.message }; }
  process.stdout.write('\u0001' + JSON.stringify(r) + '\n');
  process.exit(0);
}
const forms = opt('forms', FORMS.join(',')).split(','), engs = opt('engines', Object.keys(ENGINES).join(',')).split(',');
const jobs = Math.max(1, +opt('jobs', 3));
const queue = []; for (const e of engs) for (const f of forms) queue.push([f, e]);
const out = [];
let running = 0;
const f2 = v => v == null ? '-' : String(v);
function row(r) {
  const s = r.settle || {}, t = r.takeoff || {};
  return [r.form.padEnd(9), r.eng.padEnd(7), String(r.gross || '-').padStart(5), f2(r.stepDeg).padStart(6),
          (typeof s === 'object' ? [f2(s.trim), f2(s.roll), f2(s.bowDeck)].join(' / ') : s).padEnd(18),
          (typeof t === 'object' ? [f2(t.hump) + '@' + f2(t.humpV), f2(t.airborne) + 's', f2(t.swing) + 'deg'].join('  ') : t).padEnd(30),
          r.verdict + (r.errors && r.errors.length ? ' [' + r.errors.join(' | ').slice(0, 120) + ']' : '')].join(' ') +
         // what the fit moved beyond the step (the bow, the block, the hand) and what it could not
         (r.fit ? ['noseLen', 'engBlockY', 'engPylonH', 'engRotate'].filter(k => r.fit.rows[k] != null).map(k => '  ' + k + ' ' + r.fit.rows[k]).join('') +
                  (r.fit.notes.length ? '\n      ' + r.fit.notes.join('\n      ') : '') : '');
}
function next() {
  if (!queue.length) { if (!running) done(); return; }
  const [f, e] = queue.shift(); running++;
  const c = cp.spawn(process.execPath, [__filename, '--one=' + f + ':' + e], { cwd: ROOT });
  let buf = ''; c.stdout.on('data', d => buf += d); c.stderr.on('data', () => {});
  c.on('close', () => {
    running--;
    let r; try { r = JSON.parse(buf.slice(buf.indexOf('\u0001') + 1)); } catch (er) { r = { form: f, eng: e, verdict: 'NO RESULT' }; }
    out.push(r); console.log(row(r)); next();
  });
}
console.log('form      engine  gross step°  rest trim/roll/bow   hump R/W@V  airborne  swing   verdict');
for (let i = 0; i < jobs; i++) next();
function done() {
  const json = opt('json');
  if (json) fs.writeFileSync(json, JSON.stringify(out, null, 1));
  const fly = out.filter(r => r.verdict === 'FLIES').length;
  console.log(`\n${fly} of ${out.length} combinations fly (settled, then off the SEA lane under the pilot inside 60 s)`);
  for (const e of engs) console.log(`  ${e}: ${ENGINES[e].note}`);
}
