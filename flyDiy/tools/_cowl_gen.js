// COWL & PROPELLER GENERATOR — ported from the standalone tool
// (Downloads/cowl-generator-v19.html, "v3 — one continuous surface, apertures
// cut into it"). The GENERATOR is here; the scene, the panel and the CDN
// three.js stayed behind in the page.
//
// Lifted verbatim — parameters, presets, maths, the trimmed surface, lips,
// chin scoop, aft termination, nose cone and blades — so the shape this
// produces is the shape that was tuned in the browser, not a reimplementation
// of it. Vendored three.js (r128, the pinned one) replaces the CDN copy.
//
// THREE is used only INSIDE the builders, never at load, so this file can be
// required in node for anything that is only arithmetic — which is how
// cowlFitEngine below is checked.
//
// FRAME: firewall at z = 0, cowl running FORWARD in +z to the spinner. That is
// the tool's own convention and it matches the cage's (nose at +z).
'use strict';

const TAU=Math.PI*2, DEG=Math.PI/180, M2IN=39.3701;

/* ============================ PARAMETERS ============================ */
const P={
  // body — straight/tapered barrel, firewall at z = 0
  cowlLen:0.365, aftW:0.425, aftH:0.3, taperW:0.82, taperH:0.78,
  // THE FIREWALL LIP — the aft edge, which is the piece of the cowl you look
  // straight at from the cockpit. Real dimensions: a 4 mm fold, a 3 mm lap
  // over the fuselage skin, 25 mm of inner return.
  // THE LAP IS OFF BY DEFAULT: a cowl that stands proud of the fuselage needs
  // clearance the joint may not have — on the cage's own nose the skin round
  // the firewall reaches FORWARD of the flat cap the cowl is fitted to and
  // overhangs it by a couple of millimetres, and a 3 mm lap into that is two
  // surfaces fighting. Turn it up on a cowl stood off the face.
  fwLipOn:1, fwLipR:0.004, fwLipRise:0, fwLipIn:0.025,
  // section control points: width, plus independent top and bottom apex + squareness
  sqAftTop:0.82, sqAftBot:0.82, sqFrontTop:0.54, sqFrontBot:0.48,
  // FASTENERS, PARTING LINE, OIL DOOR (G94). 110 mm is the camloc pitch a
  // light aeroplane is actually built to; 16 mm is the head across the flats.
  fastOn:1, fastPitch:0.11, fastD:0.016,
  partOn:1, partY:0.0, partW:0.0022,
  oilOn:1, oilZ:0.42, oilW:0.13, oilL:0.16, oilSq:1,
  deckH:1, deckSweep:0, waist:0, waistSweep:0, keelH:0.95, keelSweep:0.55,
  // lid
  lidRise:0.06, faceRise:0.018, lidLen:0.125, lidMode:1, lidR:0.17, lidGap:0.009,
  lidRound:0.53, lidSqTop:0.62, lidSqBot:0.6, lidShoulder:0.45,
  // apertures cut into the surface
  detail:1.0,
  seamOn:1, seamType:1, seamPos:0.745, seamWidth:0.005, seamDepth:0.0022,
  apMode:3, apW:0.112, apH:0.106, apSq:0.47, apOffX:0, apOffY:0,
  pairX:0.2, pairY:0.012, pairW:0.08, pairH:0.048, pairSq:0.625,
  // lip
  lipMode:0, lipThick:0.009, lipProtrude:0.5, lipInset:0.028, lipDepth:0.055,
  lipRound:0.55, ductLen:0.12, ductFlare:0,
  // nose cone + shaft, stationed relative to the lid end
  noseOff:-0.04, spinR:0.101, spinLen:0.25, spinRound:0.6,
  shaftR:0.045, shaftLen:0.3, bladeStation:0.42,
  // lobes / cut
  lobeN:2, lobeAmp:0.022, lobeAz:0, lobeSig:34.0, lobeT:0.45, lobeTSig:0.3,
  cutSpan:0, cutAz:270.0,
  // chin scoop
  scoopOn:1, scoopZ:0, scoopW:0.065, scoopH:0.055, scoopLen:0.22, scoopDrop:0.7,
  scoopAp:0.68, scoopSq:0.5, scoopRake:0.18,
  scoopLipH:0.011, scoopLipDepth:0.032, scoopDuct:0.125,
  // aft — the fuselage is a given; the cowl inherits its section by default
  aftMode:0, stubLen:0.5, tailLen:1.5, tailDrop:0.02, pylon:1,
  inheritStub:1, stubSqTop:0.81, stubSqBot:0.79, stubDeckH:0.99, stubWaist:0.34, stubKeelH:0.98,
  // propeller
  bladeN:2, propD:1.91, rootChord:0.165, tipChord:0.05, chordBulge:0.18,
  thickRoot:0.2, thickTip:0.09, camb:0.04, sweep:0, cuff:0.22, tipRound:0.1,
  shankR:0.045, material:0, rpm:2400.0, tas:205.0, power:160.0, slip:12.0
};

// APPEND ONLY: the index is `material` in every preset above and cw_material
// in every saved build, and AERO_PROP_FIN maps finishes onto it by the same
// index (GATE SKINMAT holds the two lists to one length).
const MATERIALS=[
  // `tileK`/`detRot` (G125.1, wooden rows): a blade is carved from a stack of
  // boards, so its grain runs at BLADE pitch (tileK shrinks the sheet's tile)
  // and SPANWISE (detRot turns the triplanar detail a quarter). Verified on
  // pixels: without them the walnut blade read as one pale plank.
  {name:"Birch laminate",rho:700,col:0xc79a63,met:0.0,rgh:0.62,detRot:1},
  {name:"Beech laminate",rho:730,col:0xb08050,met:0.0,rgh:0.58,detRot:1},
  {name:"Aluminium 2025-T6",rho:2790,col:0xc9cdd2,met:0.92,rgh:0.24},
  {name:"Carbon / epoxy",rho:1550,col:0x2b2e33,met:0.15,rgh:0.38},
  {name:"Glass / epoxy",rho:1900,col:0xd9d5cc,met:0.05,rgh:0.42},
  {name:"Wood core + CFRP shell",rho:950,col:0x8a7a63,met:0.05,rgh:0.48,detRot:1},
  // G125: the scanned woods. Densities are Wood Handbook class values (hard
  // maple ~705, black walnut ~640 kg/m3), the same shelf GEN_MATERIALS cites.
  // Walnut's col is VARNISHED walnut, deliberately darker than the sheet's
  // own tan mean — the tint is what says "oiled blade" against "raw veneer".
  {name:"Maple laminate",rho:705,col:0xd9c8a8,met:0.0,rgh:0.52,tileK:0.5,detRot:1},
  {name:"Walnut laminate",rho:640,col:0x6b482c,met:0.0,rgh:0.45,tileK:0.4,detRot:1}
];

/* ============================ PRESETS ============================ */
const PRESETS={
  "Working default":{note:"Current tuned baseline: short square-shouldered cowl, raised waist, central aperture plus a pair, plain cut lips, wooden prop.",
  p:{cowlLen:0.365,aftW:0.425,aftH:0.3,taperW:0.82,taperH:0.78,sqAftTop:0.82,sqAftBot:0.82,sqFrontTop:0.54,sqFrontBot:0.48,deckH:1,deckSweep:0,waist:0,waistSweep:0,keelH:0.95,keelSweep:0.55,lidRise:0.06,faceRise:0.018,lidLen:0.125,lidMode:1,lidR:0.17,lidGap:0.009,lidRound:0.53,lidSqTop:0.62,lidSqBot:0.6,lidShoulder:0.45,apMode:3,apW:0.112,apH:0.106,apSq:0.47,apOffX:0,apOffY:0,pairX:0.2,pairY:0.012,pairW:0.08,pairH:0.048,pairSq:0.625,lipMode:0,lipThick:0.009,lipProtrude:0.5,lipInset:0.028,lipDepth:0.055,lipRound:0.55,ductLen:0.12,ductFlare:0,noseOff:-0.04,spinR:0.101,spinLen:0.25,spinRound:0.6,shaftR:0.045,shaftLen:0.3,bladeStation:0.42,lobeN:2,lobeAmp:0.022,lobeAz:0,lobeSig:34.0,lobeT:0.45,lobeTSig:0.3,cutSpan:0,cutAz:270.0,scoopOn:1,scoopW:0.065,scoopH:0.055,scoopLen:0.22,scoopDrop:0.7,scoopAp:0.68,scoopSq:0.5,scoopRake:0.18,scoopLipH:0.011,scoopLipDepth:0.032,scoopDuct:0.125,aftMode:0,stubLen:0.5,tailLen:1.5,tailDrop:0.02,pylon:1,inheritStub:1,stubSqTop:0.81,stubSqBot:0.79,stubDeckH:0.99,stubWaist:0.34,stubKeelH:0.98,bladeN:2,propD:1.91,rootChord:0.165,tipChord:0.05,chordBulge:0.18,thickRoot:0.2,thickTip:0.09,camb:0.04,sweep:0,cuff:0.22,tipRound:0.1,shankR:0.045,material:0,rpm:2400.0,tas:205.0,power:160.0,slip:12.0,seamOn:1,seamType:1,seamPos:0.745,seamWidth:0.005,seamDepth:0.0022}},

"Piper PA-18 Super Cub":{note:"O-320. Square-ish barrel with big cylinder cheeks, short blunt lid, round aperture around an exposed hub.",
  p:{detail:1,seamOn:0,seamType:1,seamPos:0.745,seamWidth:0.005,seamDepth:0.0022,inheritStub:1,stubSqTop:0.8,stubSqBot:0.8,stubDeckH:1,stubKeelH:1.0,stubWaist:0,deckH:1,deckSweep:0,waist:0,waistSweep:0,cowlLen:0.48,aftW:0.345,aftH:0.325,taperW:0.9,taperH:0.88,sqAftTop:0.8,sqAftBot:0.8,sqFrontTop:0.76,sqFrontBot:0.76,faceRise:0.01,keelSweep:0.34,lidRise:0.02,keelH:1.0,
     lidShoulder:0.5,lidLen:0.21,lidMode:1,lidGap:0.010,lidRound:0.55,lidSqTop:0.625,lidSqBot:0.625,
     apMode:1,apW:0.135,apH:0.128,apSq:0.575,apOffX:0,apOffY:0,
     lipMode:1,lipThick:0.012,lipProtrude:0.4,lipInset:0.016,lipDepth:0.030,lipRound:0.5,ductLen:0.09,
     noseOff:-0.02,spinR:0.105,spinLen:0.15,spinRound:0.30,shaftR:0.040,shaftLen:0.24,
     lobeN:2,lobeAmp:0.055,lobeAz:0,lobeSig:30,lobeT:0.40,lobeTSig:0.30,cutSpan:0,
     scoopLipH:0.009,scoopOn:1,scoopW:0.11,scoopH:0.065,scoopLen:0.26,scoopDrop:0.60,scoopAp:0.66,scoopSq:0.775,scoopRake:0.30,
     aftMode:0,shankR:0.038,bladeN:2,propD:1.93,rootChord:0.155,tipChord:0.095,material:2,rpm:2350,tas:160,power:150}},

 "Cessna 172":{note:"Wide flat barrel, top deck raked down, blunt lid faired onto the spinner, twin openings either side of it.",
  p:{detail:1,inheritStub:1,stubSqTop:0.82,stubSqBot:0.82,stubDeckH:1,stubKeelH:0.95,stubWaist:0,deckH:1,deckSweep:0,waist:0,waistSweep:0,cowlLen:0.6,aftW:0.425,aftH:0.300,taperW:0.9,taperH:0.92,sqAftTop:0.82,sqAftBot:0.82,sqFrontTop:0.75,sqFrontBot:0.75,faceRise:0.018,keelSweep:0.45,lidRise:-0.03,keelH:0.95,
     lidShoulder:0.45,lidLen:0.34,lidMode:1,lidGap:0.012,lidRound:0.72,lidSqTop:0.6,lidSqBot:0.6,
     detail:1.0,
  seamOn:1, seamType:1, seamPos:0.745, seamWidth:0.005, seamDepth:0.0022,
  apMode:2,pairX:0.228,pairY:0.012,pairW:0.072,pairH:0.062,pairSq:0.625,
     lipMode:1,lipThick:0.016,lipProtrude:0.5,lipInset:0.028,lipDepth:0.055,lipRound:0.55,ductLen:0.12,
     noseOff:-0.04,spinR:0.135,spinLen:0.25,spinRound:0.60,shaftR:0.045,shaftLen:0.30,
     lobeN:2,lobeAmp:0.022,lobeAz:0,lobeSig:34,lobeT:0.45,lobeTSig:0.30,cutSpan:0,
     scoopLipH:0.01,scoopOn:1,scoopW:0.13,scoopH:0.055,scoopLen:0.22,scoopDrop:0.72,scoopAp:0.60,scoopSq:0.675,scoopRake:0.25,
     aftMode:0,shankR:0.045,bladeN:2,propD:1.90,rootChord:0.165,tipChord:0.105,material:2,rpm:2400,tas:205,power:160}},

 "Jodel D.1050 Ambassadeur":{note:"Rounder small cowl, annular gap around a slim spinner, prominent belly scoop, wooden prop.",
  p:{detail:1,seamOn:0,seamType:1,seamPos:0.745,seamWidth:0.005,seamDepth:0.0022,inheritStub:1,stubSqTop:0.67,stubSqBot:0.67,stubDeckH:1,stubKeelH:0.99,stubWaist:0,deckH:1,deckSweep:0,waist:0,waistSweep:0,cowlLen:0.48,aftW:0.335,aftH:0.315,taperW:0.88,taperH:0.88,sqAftTop:0.67,sqAftBot:0.67,sqFrontTop:0.61,sqFrontBot:0.61,faceRise:0.008,keelSweep:0.4,lidRise:0.015,keelH:0.99,
     lidShoulder:0.5,lidLen:0.25,lidMode:1,lidGap:0.012,lidRound:0.6,lidSqTop:0.525,lidSqBot:0.525,
     apMode:1,apW:0.145,apH:0.145,apSq:0.5,apOffX:0,apOffY:0.005,
     lipMode:1,lipThick:0.013,lipProtrude:0.55,lipInset:0.018,lipDepth:0.040,lipRound:0.6,ductLen:0.10,
     noseOff:-0.03,spinR:0.100,spinLen:0.20,spinRound:0.50,shaftR:0.036,shaftLen:0.24,
     lobeN:2,lobeAmp:0.038,lobeAz:0,lobeSig:32,lobeT:0.42,lobeTSig:0.30,cutSpan:0,
     scoopLipH:0.01,scoopOn:1,scoopW:0.115,scoopH:0.085,scoopLen:0.30,scoopDrop:0.66,scoopAp:0.68,scoopSq:0.65,scoopRake:0.35,
     aftMode:0,shankR:0.034,bladeN:2,propD:1.75,rootChord:0.150,tipChord:0.105,material:0,rpm:2600,tas:175,power:100}},

 "Faired inline (Spitfire type)":{note:"No aperture: the lid runs continuously onto a long ogival spinner. Cooling lives in the wing radiators.",
  p:{detail:1,seamOn:0,seamType:1,seamPos:0.745,seamWidth:0.005,seamDepth:0.0022,inheritStub:1,stubSqTop:0.55,stubSqBot:0.55,stubDeckH:1,stubKeelH:1.0,stubWaist:0,deckH:1,deckSweep:0,waist:0,waistSweep:0,cowlLen:1.02,aftW:0.46,aftH:0.42,taperW:0.82,taperH:0.84,sqAftTop:0.55,sqAftBot:0.55,sqFrontTop:0.525,sqFrontBot:0.525,faceRise:0.01,keelSweep:0.3,lidRise:0.015,keelH:1.0,
     lidShoulder:0.62,lidLen:0.55,lidMode:1,lidGap:0.004,lidRound:0.3,lidSqTop:0.5,lidSqBot:0.5,
     apMode:0,lipMode:1,
     noseOff:0.0,spinR:0.22,spinLen:0.60,spinRound:0.32,shaftR:0.07,shaftLen:0.35,
     lobeN:2,lobeAmp:0.045,lobeAz:52,lobeSig:26,lobeT:0.55,lobeTSig:0.26,cutSpan:0,
     scoopLipH:0.014,scoopOn:1,scoopW:0.13,scoopH:0.09,scoopLen:0.5,scoopDrop:0.80,scoopAp:0.75,scoopSq:0.7,scoopRake:0.4,
     aftMode:0,shankR:0.078,bladeN:3,propD:3.27,rootChord:0.26,tipChord:0.16,material:5,rpm:1450,tas:480,power:1030}},

 "NACA cowl, radial":{note:"Full-chord ring over an air-cooled radial: circular section, very blunt lid, deep rolled lip, large annular inlet.",
  p:{detail:1,seamOn:0,seamType:1,seamPos:0.745,seamWidth:0.005,seamDepth:0.0022,inheritStub:1,stubSqTop:0.5,stubSqBot:0.5,stubDeckH:1,stubKeelH:1.0,stubWaist:0,deckH:1,deckSweep:0,waist:0,waistSweep:0,cowlLen:0.72,aftW:0.70,aftH:0.70,taperW:0.99,taperH:0.99,sqAftTop:0.5,sqAftBot:0.5,sqFrontTop:0.5,sqFrontBot:0.5,faceRise:0.0,keelSweep:0.0,lidRise:0.0,keelH:1.0,
     lidShoulder:0.3,lidLen:0.22,lidMode:0,lidR:0.16,lidRound:0.85,lidSqTop:0.5,lidSqBot:0.5,
     apMode:1,apW:0.40,apH:0.40,apSq:0.5,apOffX:0,apOffY:0,
     lipMode:1,lipThick:0.030,lipProtrude:0.7,lipInset:0.06,lipDepth:0.17,lipRound:0.75,ductLen:0.26,
     noseOff:-0.06,spinR:0.16,spinLen:0.30,spinRound:0.55,shaftR:0.06,shaftLen:0.35,
     lobeN:0,cutSpan:0,scoopOn:0,aftMode:0,
     shankR:0.056,bladeN:3,propD:2.90,rootChord:0.24,tipChord:0.15,material:2,rpm:2000,tas:290,power:600}},

 "Townend ring":{note:"Narrow-chord ring only — cylinders stay in the airflow ahead of and behind it.",
  p:{detail:1,seamOn:0,seamType:1,seamPos:0.745,seamWidth:0.005,seamDepth:0.0022,inheritStub:1,stubSqTop:0.5,stubSqBot:0.5,stubDeckH:1,stubKeelH:1.0,stubWaist:0,deckH:1,deckSweep:0,waist:0,waistSweep:0,cowlLen:0.23,aftW:0.72,aftH:0.72,taperW:1.0,taperH:1.0,sqAftTop:0.5,sqAftBot:0.5,sqFrontTop:0.5,sqFrontBot:0.5,faceRise:0.0,keelSweep:0.0,lidRise:0.0,keelH:1.0,
     lidShoulder:0.22,lidLen:0.1,lidMode:0,lidR:0.30,lidRound:0.85,lidSqTop:0.5,lidSqBot:0.5,
     apMode:1,apW:0.60,apH:0.60,apSq:0.5,
     lipMode:1,lipThick:0.022,lipProtrude:0.9,lipInset:0.03,lipDepth:0.07,lipRound:0.8,ductLen:0.07,
     noseOff:0.06,spinR:0.14,spinLen:0.24,spinRound:0.5,shaftR:0.05,shaftLen:0.3,
     lobeN:0,cutSpan:0,scoopOn:0,aftMode:0,stubLen:0.5,
     shankR:0.048,bladeN:2,propD:2.75,rootChord:0.22,tipChord:0.14,material:0,rpm:1700,tas:220,power:420}},

 "Rotary horseshoe (Camel type)":{note:"Rotary engine: bowl with the lower sector cut away so castor oil and hot air dump overboard.",
  p:{detail:1,seamOn:0,seamType:1,seamPos:0.745,seamWidth:0.005,seamDepth:0.0022,inheritStub:1,stubSqTop:0.5,stubSqBot:0.5,stubDeckH:1,stubKeelH:1.0,stubWaist:0,deckH:1,deckSweep:0,waist:0,waistSweep:0,cowlLen:0.35,aftW:0.50,aftH:0.50,taperW:0.99,taperH:0.99,sqAftTop:0.5,sqAftBot:0.5,sqFrontTop:0.5,sqFrontBot:0.5,faceRise:0.0,keelSweep:0.0,lidRise:0.0,keelH:1.0,
     lidShoulder:0.3,lidLen:0.15,lidMode:0,lidR:0.14,lidRound:0.8,lidSqTop:0.5,lidSqBot:0.5,
     apMode:1,apW:0.20,apH:0.20,apSq:0.5,
     lipMode:0,lipThick:0.014,ductLen:0.05,
     noseOff:0.02,spinR:0.08,spinLen:0.10,spinRound:0.9,shaftR:0.05,shaftLen:0.28,
     lobeN:0,cutSpan:130,cutAz:270,scoopOn:0,aftMode:0,
     shankR:0.04,bladeN:2,propD:2.60,rootChord:0.20,tipChord:0.13,material:1,rpm:1250,tas:170,power:130}},

 "Wing nacelle (twin)":{note:"Same grammar, different aft end: closes on its own tail cone above the wing instead of blending into a fuselage.",
  p:{detail:1,seamOn:0,seamType:1,seamPos:0.745,seamWidth:0.005,seamDepth:0.0022,inheritStub:1,stubSqTop:0.53,stubSqBot:0.53,stubDeckH:1,stubKeelH:1.0,stubWaist:0,deckH:1,deckSweep:0,waist:0,waistSweep:0,cowlLen:0.8,aftW:0.58,aftH:0.60,taperW:0.96,taperH:0.96,sqAftTop:0.53,sqAftBot:0.53,sqFrontTop:0.52,sqFrontBot:0.52,faceRise:0.0,keelSweep:0.0,lidRise:0.0,keelH:1.0,
     lidShoulder:0.4,lidLen:0.26,lidMode:0,lidR:0.17,lidRound:0.8,lidSqTop:0.5,lidSqBot:0.5,
     apMode:1,apW:0.34,apH:0.34,apSq:0.5,
     lipMode:1,lipThick:0.026,lipProtrude:0.7,lipInset:0.05,lipDepth:0.14,lipRound:0.7,ductLen:0.20,
     noseOff:-0.04,spinR:0.17,spinLen:0.34,spinRound:0.50,shaftR:0.055,shaftLen:0.30,
     lobeN:0,cutSpan:0,scoopOn:0,aftMode:1,tailLen:1.5,tailDrop:0.02,pylon:1,
     shankR:0.058,bladeN:3,propD:2.60,rootChord:0.22,tipChord:0.14,material:2,rpm:2200,tas:280,power:450}},

 "Sharp-edge apertures, no lip":{note:"Plain cut openings with wall thickness only — no rolled lip, no fairing onto the cone. Fibreglass homebuilt style.",
  p:{detail:1,seamOn:0,seamType:1,seamPos:0.745,seamWidth:0.005,seamDepth:0.0022,inheritStub:1,stubSqTop:0.725,stubSqBot:0.725,stubDeckH:1,stubKeelH:0.975,stubWaist:0,deckH:1,deckSweep:0,waist:0,waistSweep:0,cowlLen:0.56,aftW:0.38,aftH:0.30,taperW:0.9,taperH:0.92,sqAftTop:0.725,sqAftBot:0.725,sqFrontTop:0.65,sqFrontBot:0.65,faceRise:0.006,keelSweep:0.3,lidRise:0.0,keelH:0.975,
     lidShoulder:0.45,lidLen:0.24,lidMode:1,lidGap:0.014,lidRound:0.65,lidSqTop:0.675,lidSqBot:0.675,
     apMode:3,apW:0.15,apH:0.105,apSq:0.775,apOffX:0,apOffY:-0.02,
     pairX:0.21,pairY:0.0,pairW:0.052,pairH:0.042,pairSq:0.8,
     lipMode:0,lipThick:0.012,ductLen:0.10,
     noseOff:-0.03,spinR:0.115,spinLen:0.22,spinRound:0.55,shaftR:0.042,shaftLen:0.26,
     lobeN:0,cutSpan:0,scoopOn:0,aftMode:0,
     shankR:0.038,bladeN:2,propD:1.78,rootChord:0.15,tipChord:0.10,material:3,rpm:2700,tas:230,power:100}},

 "No cowl — faired nose":{note:"Long lid closing onto the cone with nothing cut into it: the degenerate case of the same surface.",
  p:{detail:1,seamOn:0,seamType:1,seamPos:0.745,seamWidth:0.005,seamDepth:0.0022,inheritStub:1,stubSqTop:0.525,stubSqBot:0.525,stubDeckH:1,stubKeelH:1.0,stubWaist:0,deckH:1,deckSweep:0,waist:0,waistSweep:0,cowlLen:0.66,aftW:0.40,aftH:0.38,taperW:0.86,taperH:0.86,sqAftTop:0.525,sqAftBot:0.525,sqFrontTop:0.5,sqFrontBot:0.5,faceRise:0.0,keelSweep:0.0,lidRise:0.0,keelH:1.0,
     lidShoulder:0.55,lidLen:0.46,lidMode:1,lidGap:0.003,lidRound:0.4,lidSqTop:0.5,lidSqBot:0.5,
     apMode:0,noseOff:0.0,spinR:0.19,spinLen:0.42,spinRound:0.45,shaftR:0.06,shaftLen:0.3,
     lobeN:0,cutSpan:0,scoopOn:0,aftMode:0,
     shankR:0.062,bladeN:3,propD:2.10,rootChord:0.18,tipChord:0.11,material:3,rpm:2200,tas:250,power:260}}
};

/* ============================ MATH ============================ */
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smooth=t=>t*t*(3-2*t);
/* 0 = straight faces (n=1, a true polygon edge), 0.5 = ellipse (n=2),
   1 = flat face with tight corners (n=10). Below 0.5 was unreachable before,
   which is why no setting could ever produce a facet. */
const sqExp=s=>{s=clamp(s,0,1); return s<0.5 ? lerp(1,2,s/0.5) : 2*Math.pow(5,(s-0.5)/0.5);};
function superPt(th,a,b,n){
  const c=Math.cos(th),s=Math.sin(th),e=2/n;
  return [Math.sign(c)*Math.pow(Math.abs(c),e)*a, Math.sign(s)*Math.pow(Math.abs(s),e)*b];
}
function angDiff(a,b){let d=(a-b)%TAU; if(d>Math.PI)d-=TAU; if(d<-Math.PI)d+=TAU; return d;}

/* ============================ SURFACE DEFINITION ============================ */
const SEG=112;
const zEnd=()=>P.cowlLen+P.lidLen;
function lidRadius(){ return P.lidMode===1 ? P.spinR+P.lidGap : P.lidR; }
/* THE FIREWALL EDGE IS NOT AT z = 0 WHEN IT IS A LIP. The aft plane of the
   cowl is still z = 0 — that is the firewall, and the cowl must not grow into
   the fuselage — so the LIP occupies the last few millimetres of it and the
   barrel's skin starts where the lip's lap begins. `aftStart` is that station,
   and every consumer that used to walk the barrel from zero reads it: the mesh
   stations, the parting line, the aft row of camlocs. */
// ONE PLACE DECIDES THE LIP'S DIMENSIONS, because `aftStart` and the profile
// have to agree exactly or the band leaves a crack at the skin's aft row.
// NO LAP, NO RAMP: at rise 0 the flare is a zero-height strip coincident with
// the skin, so it is not built at all and the fold's tangent station IS the
// skin's aft row.
// AND THE LIP MAY NOT EAT THE BARREL: on a 50 mm cowl a 14 mm fold with a
// 16 mm lap is 62 mm of edge on a 50 mm panel, which leaves the surface with
// no stations at all. Quarter of the cowl is the cap, and the fold, the lap
// and the return scale together into it so the shape stays a fold.
function fwGeom(){
  const cl=Math.max(P.cowlLen,1e-3);
  let r=Math.max(0.0015,P.fwLipR), p=Math.max(0,P.fwLipRise);
  let sr=p>0?Math.max(0.005,p*3):0;
  const cap=cl*0.25;
  if(r+sr>cap){ const k=cap/(r+sr); r*=k; p*=k; sr*=k; }
  return {r, p, sr, L:Math.min(Math.max(0.004,P.fwLipIn), cl*0.5)};
}
function aftStart(){ if(!P.fwLipOn) return 0; const g=fwGeom(); return g.r+g.sr; }
/* No spine curvature. The barrel is a straight ruled surface from the firewall
   loop to the lid loop; the lid axis then runs straight to the face, which can
   be lifted independently of the barrel-end offset. */
function spineY(z){
  if(z<=0) return 0;
  if(z<=P.cowlLen) return P.lidRise*clamp(z/Math.max(P.cowlLen,1e-4),0,1);
  return P.lidRise + P.faceRise*clamp((z-P.cowlLen)/Math.max(P.lidLen,1e-4),0,1);
}

/* The meridian is one continuous curve: a straight barrel, then a cubic that
   leaves it along its own tangent and arrives at the lid plane almost normal
   to the axis. No shoulder, no S.
   The keel gets its own copy of that curve, allowed to start bending earlier
   than the barrel end, so the underside can sweep up into the lid while the
   top deck stays straight. Both curves finish on the same lid radius, so the
   end ring is still circular about the cone. */
const bez=(p,u)=>{const v=1-u;
  return v*v*v*p[0]+3*v*v*u*p[1]+3*v*u*u*p[2]+u*u*u*p[3];};
function mkCurve(pz,pv){
  const N=192, tz=new Float64Array(N+1);
  for(let i=0;i<=N;i++) tz[i]=bez(pz,i/N);
  return {pz,pv,tz,N,
    uOf(z){
      if(z<=this.tz[0])return 0; if(z>=this.tz[this.N])return 1;
      let lo=0,hi=this.N;
      while(hi-lo>1){const m=(lo+hi)>>1; if(this.tz[m]<=z)lo=m;else hi=m;}
      const d=this.tz[hi]-this.tz[lo];
      return (lo+(d>1e-12?(z-this.tz[lo])/d:0))/this.N;
    },
    at(z){ return bez(this.pv,this.uOf(z)); }};
}
let LID=null;
/* The cowl section is defined by four control points — the two sides at +/-a,
   the top apex and the bottom apex — plus a squareness per half that says how
   the arcs between them are filled. Top and bottom each get their own meridian
   curve, so the deck and the keel can bend at different stations. Both finish
   on the lid radius, keeping the closing ring circular about the cone. */
const eSqAftTop=()=>P.inheritStub?P.stubSqTop:P.sqAftTop;
const eSqAftBot=()=>P.inheritStub?P.stubSqBot:P.sqAftBot;
const eDeckH   =()=>P.inheritStub?P.stubDeckH:P.deckH;
const eKeelH   =()=>P.inheritStub?P.stubKeelH:P.keelH;

const eWaist   =()=>P.inheritStub?P.stubWaist:P.waist;

function prepareLid(){
  const cl=Math.max(P.cowlLen,1e-4), ze=zEnd(), L=Math.max(P.lidLen,1e-4), lr=lidRadius();
  const a0=P.aftW, h0=P.aftH, a1=P.aftW*P.taperW, h1=P.aftH*P.taperH;
  const sa=(a1-a0)/cl, sh=(h1-h0)/cl;
  const c1=clamp(P.lidShoulder,0,0.92), c2=clamp(P.lidRound,0,1);
  const pz=[cl, cl+L*c1, ze-L*0.05, ze];
  const A=mkCurve(pz,[a1, a1+sa*L*c1, lr+(a1-lr)*c2, lr]);
  // one recipe, used for the deck and the keel with their own scale and sweep
  const half=(k,sweep,end)=>{
    const z0=cl-clamp(sweep,0,0.95)*cl, Lh=ze-z0;
    const v0=k*lerp(h0,h1,z0/cl), sv=sh*k;
    return {z0, k, c:mkCurve([z0, z0+Lh*c1, ze-Lh*0.05, ze],
                             [v0, v0+sv*Lh*c1, end+(v0-end)*c2, end])};
  };
  const kT=eDeckH(), kB=eKeelH();
  // the waist is the height of the widest line; it must return to the axis by
  // the lid end, otherwise the closing ring would not be circular on the cone
  const kW=clamp(eWaist(),-0.85*kB,0.85*kT);
  const T=half(kT, P.deckSweep, lr);
  const K=half(kB, P.keelSweep, lr);
  const W=half(kW, P.waistSweep, 0);
  LID={pz,A,T,K,W,cl};
}
/* Panel seam. Real cowls are several panels, so the face is a separate skin
   from the barrel and there is a visible joint. This is a small radial inset
   applied to the section itself rather than a decal, so the implicit field,
   the aperture rim solver and the scoop trim all see the same surface.
   Type 0 = symmetric groove. Type 1 = step, with the aft panel set in and the
   face panel proud, which is how a lapped joint reads. */
function seamInset(z){
  if(!P.seamOn||!seamOn2) return 0;
  const w=Math.max(P.seamWidth,5e-4), z0=clamp(P.seamPos,0,1)*zEnd();
  if(P.seamType===0){
    const t=Math.abs(z-z0)/w;
    return t>=1 ? 0 : P.seamDepth*(1-t);
  }
  return P.seamDepth*clamp((z0+w*0.5-z)/w,0,1);
}
function sectionAtZ(z){
  if(!LID) prepareLid();
  const cy=spineY(z), cl=Math.max(P.cowlLen,1e-4);
  let a,nT,nB;
  if(z<=cl){
    const u=clamp(z/cl,0,1);                       // straight: constant slope
    a=lerp(P.aftW,P.aftW*P.taperW,u);
    nT=sqExp(lerp(eSqAftTop(),P.sqFrontTop,u));
    nB=sqExp(lerp(eSqAftBot(),P.sqFrontBot,u));
  }else{
    const u=LID.A.uOf(z);
    a=Math.max(LID.A.at(z),0.003);
    nT=sqExp(lerp(P.sqFrontTop,P.lidSqTop,u));
    nB=sqExp(lerp(P.sqFrontBot,P.lidSqBot,u));
  }
  const hLin=lerp(P.aftH,P.aftH*P.taperH,clamp(z/cl,0,1));
  let bT = z<=LID.T.z0 ? LID.T.k*hLin : Math.max(LID.T.c.at(z),0.003);
  let bB = z<=LID.K.z0 ? LID.K.k*hLin : Math.max(LID.K.c.at(z),0.003);
  const yw = z<=LID.W.z0 ? LID.W.k*hLin : LID.W.c.at(z);
  const si=seamInset(z);
  if(si){ a=Math.max(a-si,0.003); bT=Math.max(bT-si,0.003); bB=Math.max(bB-si,0.003); }
  return {a,bT,bB,nT,nB,cy,yw:clamp(yw,-bB*0.9,bT*0.9),b:bT};
}
/* one section point, given the four control values */
/* Six control points, not four: the sides now sit at the waist height yw
   rather than on the spine, so each half spans from the waist to its own apex.
   yw = 0 reproduces the old rounded-rectangle section exactly. */
function sectPt(th,s){
  const c=Math.cos(th), sn=Math.sin(th), up=sn>=0;
  const yw=s.yw||0, n=up?s.nT:s.nB, e=2/n;
  const h=Math.max(up?s.bT-yw:s.bB+yw,0.002);
  return [Math.sign(c)*Math.pow(Math.abs(c),e)*s.a,
          yw+(up?1:-1)*Math.pow(Math.abs(sn),e)*h];
}
function lobeAt(th,z){
  if(P.lobeN<1||P.lobeAmp<=0) return 0;
  const t=clamp(z/Math.max(zEnd(),1e-4),0,1);
  const w=Math.exp(-Math.pow((t-P.lobeT)/Math.max(0.03,P.lobeTSig),2));
  if(w<0.008) return 0;
  const azs=[P.lobeAz*DEG]; if(P.lobeN>=2) azs.push(Math.PI-P.lobeAz*DEG);
  let d=0;
  for(const az of azs) d+=P.lobeAmp*w*Math.exp(-Math.pow(angDiff(th,az)/(P.lobeSig*DEG),2));
  return d;
}
function surfPoint(th,z){
  const s=sectionAtZ(z);
  let [x,y]=sectPt(th,s);
  const d=lobeAt(th,z);
  if(d){const L=Math.hypot(x,y)||1; x+=x/L*d; y+=y/L*d;}
  return [x, s.cy+y];
}
/* implicit: <1 inside the section at that z (lobes ignored — they live on the barrel flanks) */
function sectF(x,y,z){
  const s=sectionAtZ(z);
  const dy=y-s.cy-s.yw, up=dy>=0;
  const h=Math.max(up?s.bT-s.yw:s.bB+s.yw,0.002), n=up?s.nT:s.nB;
  return Math.pow(Math.abs(x/s.a),n)+Math.pow(Math.abs(dy/h),n);
}
/* where does the Z-line through (px,py) pierce the surface? */
function pierceZ(px,py){
  let lo=0, hi=zEnd();
  if(sectF(px,py,hi)<1) return hi;
  if(sectF(px,py,lo)>1) return null;
  for(let i=0;i<40;i++){const m=(lo+hi)/2; if(sectF(px,py,m)<1) lo=m; else hi=m;}
  return (lo+hi)/2;
}

/* ---------------------------------------------------------------------------
   Adaptive sampling. Samples are placed at equal increments of a weight that
   mixes arc length with sqrt(turning x arc), which is the equal-sagitta rule:
   chord error is constant along the curve rather than piling up at the corners.
   Measured against uniform spacing at matched counts this is only ~6% better,
   because a superellipse parametrised in theta already clusters reasonably —
   but it holds up when the section is asymmetric (raised waist, different
   exponents top and bottom), where uniform does not.
   The seam is added afterwards: its profile is a step, not a curve. */
let AZ=[], ZS=[], NDISC=4, seamOn2=true;
function equalise(w,N,M){
  const cum=new Float64Array(M+1);
  for(let i=0;i<M;i++) cum[i+1]=cum[i]+w[i];
  const tot=cum[M]||1, out=[];
  for(let k=0;k<N;k++){
    const t=k*tot/N;
    let lo=0,hi=M;
    while(hi-lo>1){const m=(lo+hi)>>1; if(cum[m]<=t)lo=m;else hi=m;}
    const d=cum[lo+1]-cum[lo];
    out.push((lo+(d>1e-12?(t-cum[lo])/d:0))/M);
  }
  return out;
}
function prepareMesh(){
  const d=clamp(P.detail,0.35,2), ze=zEnd();
  seamOn2=false;                                   // tables ignore the seam step

  // --- azimuth: weighted by turning of the squarest section in the cowl ---
  const probe=[0,0.5,1].map(t=>sectionAtZ(t*P.cowlLen));
  const rep=probe.reduce((a,b)=>(b.nT+b.nB>a.nT+a.nB?b:a));
  const M=512, pt=[];
  for(let i=0;i<M;i++) pt.push(sectPt(i/M*TAU,rep));
  const R=(rep.a+rep.bT)*0.5, w=new Float64Array(M);
  for(let i=0;i<M;i++){
    const a=pt[(i-1+M)%M],b=pt[i],c=pt[(i+1)%M];
    const seg=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const t1=Math.atan2(b[1]-a[1],b[0]-a[0]), t2=Math.atan2(c[1]-b[1],c[0]-b[0]);
    let dt=Math.abs(t2-t1); if(dt>Math.PI)dt=TAU-dt;
    w[i]=0.15*seg+Math.sqrt(dt*seg*R);   // equal sagitta: density ~ sqrt(kappa)
  }
  AZ=equalise(w,Math.max(28,Math.round(60*d)),M).map(u=>u*TAU);

  // --- stations: weighted by turning of the deck meridian ---
  const MZ=480, mp=[];
  for(let i=0;i<=MZ;i++){const z=i/MZ*ze, sc=sectionAtZ(z); mp.push([z,sc.cy+sc.bT]);}
  const wz=new Float64Array(MZ);
  for(let i=0;i<MZ;i++){
    const a=mp[Math.max(i-1,0)],b=mp[i],c=mp[i+1];
    const seg=Math.hypot(b[0]-a[0],b[1]-a[1])+Math.hypot(c[0]-b[0],c[1]-b[1]);
    const t1=Math.atan2(b[1]-a[1],b[0]-a[0]), t2=Math.atan2(c[1]-b[1],c[0]-b[0]);
    let dt=Math.abs(t2-t1); if(dt>Math.PI)dt=TAU-dt;
    wz[i]=0.15*seg+Math.sqrt(dt*seg*ze*0.3);
  }
  ZS=equalise(wz,Math.max(12,Math.round(26*d)),MZ).map(u=>u*ze);
  ZS.push(ze);
  seamOn2=true;

  if(P.seamOn){                                    // a step needs its own rows
    const sw=Math.max(P.seamWidth,5e-4), z0=clamp(P.seamPos,0,1)*ze;
    // rows sit either side of each crease; a step has two, a groove three
    const off = P.seamType===1
      ? [-1.2,-0.51,-0.5,-0.49,0,0.49,0.5,0.51,1.2]
      : [-1.3,-1.01,-1,-0.99,-0.4,0,0.4,0.99,1,1.01,1.3];
    for(const t of off){ const z=z0+t*sw; if(z>1e-4&&z<ze-1e-4) ZS.push(z); }
  }
  ZS.sort((p,q)=>p-q);
  for(let i=ZS.length-1;i>0;i--) if(ZS[i]-ZS[i-1]<1e-6) ZS.splice(i,1);
  // the barrel's skin stops where the lip's lap begins; the lip band draws the
  // rest, and its first ring IS this row (same azimuths, zero offset), so the
  // two meshes share an edge rather than meet at one
  const z0=aftStart();
  if(z0>0){ ZS=ZS.filter(z=>z>z0+1e-5); ZS.unshift(z0); }
  NDISC=Math.max(3,Math.round(4*d));
}

/* apertures, fitted so they always stay inside the barrel-end section */
function apertureList(){
  const list=[], ax={x:P.apOffX,y:spineY(zEnd())+P.apOffY};
  if(P.apMode===1||P.apMode===3) list.push({cx:ax.x,cy:ax.y,w:P.apW,h:P.apH,n:sqExp(P.apSq)});
  if(P.apMode===2||P.apMode===3)
    for(const s of [1,-1]) list.push({cx:ax.x+s*P.pairX,cy:ax.y+P.pairY,w:P.pairW,h:P.pairH,n:sqExp(P.pairSq)});
  for(const o of list) fitAperture(o);
  return list;
}
function fitAperture(o){
  for(let it=0;it<26;it++){
    let mx=0;
    for(let j=0;j<28;j++){
      const th=j/28*TAU,[px,py]=superPt(th,o.w,o.h,o.n);
      mx=Math.max(mx,sectF(o.cx+px,o.cy+py,P.cowlLen));
    }
    if(mx<=0.80) break;
    o.cx*=0.94; o.cy=spineY(zEnd())+(o.cy-spineY(zEnd()))*0.94;
    o.w*=0.96; o.h*=0.96;
  }
}
const apG=(o,x,y)=>Math.pow(Math.abs((x-o.cx)/o.w),o.n)+Math.pow(Math.abs((y-o.cy)/o.h),o.n)-1;

/* ============================ TRIMMED SURFACE ============================ */
function buildSurface(group,mats,aps){
  const ze=zEnd(), lr=lidRadius(), NC=NDISC, zs=ZS, SEG=AZ.length;
  const R=zs.length+NC;

  // vertex grid
  const px=[],py=[],pz=[];
  for(let i=0;i<zs.length;i++){
    const z=zs[i], rx=[],ry=[],rz=[];
    for(let j=0;j<SEG;j++){
      const th=AZ[j], [x,y]=surfPoint(th,z);
      rx.push(x); ry.push(y); rz.push(z);
    }
    px.push(rx); py.push(ry); pz.push(rz);
  }
  // closing panel at the lid end, in the same plane the rim solver reports
  const cyE=spineY(ze);
  for(let i=1;i<=NC;i++){
    const f=1-i/NC, r=Math.max(lr*f,0.004);
    const rx=[],ry=[],rz=[];
    for(let j=0;j<SEG;j++){const th=AZ[j];
      rx.push(Math.cos(th)*r); ry.push(cyE+Math.sin(th)*r); rz.push(ze);}
    px.push(rx); py.push(ry); pz.push(rz);
  }

  // smooth normals from the grid
  const nx=[],ny=[],nz=[];
  const NROW=zs.length;
  for(let i=0;i<R;i++){
    const a=[],b=[],c=[];
    for(let j=0;j<SEG;j++){
      if(i>=NROW){ a.push(0); b.push(0); c.push(1); continue; }
      const i0=Math.max(0,i-1), i1=Math.min(NROW-1,i+1);
      const j0=(j-1+SEG)%SEG, j1=(j+1)%SEG;
      const tu=[px[i1][j]-px[i0][j], py[i1][j]-py[i0][j], pz[i1][j]-pz[i0][j]];
      const tv=[px[i][j1]-px[i][j0], py[i][j1]-py[i][j0], pz[i][j1]-pz[i][j0]];
      let n=[tv[1]*tu[2]-tv[2]*tu[1], tv[2]*tu[0]-tv[0]*tu[2], tv[0]*tu[1]-tv[1]*tu[0]];
      const L=Math.hypot(n[0],n[1],n[2])||1; n=[n[0]/L,n[1]/L,n[2]/L];
      if(n[0]*px[i][j]+n[1]*(py[i][j]-cyE)<0) n=[-n[0],-n[1],-n[2]];
      a.push(n[0]); b.push(n[1]); c.push(n[2]);
    }
    nx.push(a); ny.push(b); nz.push(c);
  }

  // per-vertex aperture fields
  const G=aps.map(o=>{
    const g=[];
    for(let i=0;i<R;i++){const r=[];
      for(let j=0;j<SEG;j++) r.push(apG(o,px[i][j],py[i][j]));
      g.push(r);}
    return g;
  });

  const cutA=P.cutSpan*DEG, cutC=P.cutAz*DEG;
  const pos=[], nor=[];
  const V=(i,j)=>[px[i][j],py[i][j],pz[i][j],nx[i][j],ny[i][j],nz[i][j]];
  const mix=(A,B,t)=>A.map((v,k)=>v+(B[k]-v)*t);

  for(let i=0;i<R-1;i++){
    for(let j=0;j<SEG;j++){
      if(cutA>0 && Math.abs(angDiff(AZ[j]+angDiff(AZ[(j+1)%SEG],AZ[j])/2,cutC))<cutA/2) continue;
      const j2=(j+1)%SEG;
      let poly=[V(i,j),V(i,j2),V(i+1,j2),V(i+1,j)];
      let gv=[[i,j],[i,j2],[i+1,j2],[i+1,j]];
      for(let k=0;k<aps.length && poly.length;k++){
        const g=G[k];
        let vals = gv ? gv.map(q=>g[q[0]][q[1]]) : null;
        if(vals && vals.every(v=>v>=0)) continue;       // wholly outside: keep
        if(vals && vals.every(v=>v<0)){ poly=[]; break; } // wholly inside: drop
        const out=[], N=poly.length;
        const gAt=(idx)=>vals?vals[idx]:apG(aps[k],poly[idx][0],poly[idx][1]);
        const gcache=[]; for(let q=0;q<N;q++) gcache.push(gAt(q));
        for(let q=0;q<N;q++){
          const A=poly[q], B=poly[(q+1)%N], ga=gcache[q], gb=gcache[(q+1)%N];
          if(ga>=0) out.push(A);
          if((ga>=0)!==(gb>=0)) out.push(mix(A,B,ga/(ga-gb)));
        }
        poly=out; gv=null;
      }
      for(let q=1;q+1<poly.length;q++){
        for(const v of [poly[0],poly[q],poly[q+1]]){
          pos.push(v[0],v[1],v[2]); nor.push(v[3],v[4],v[5]);
        }
      }
    }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  group.add(new THREE.Mesh(g,mats.skin));
}

/* ======================== THE FIREWALL LIP ========================
   THE ONE EDGE OF THE COWL YOU LOOK STRAIGHT AT. Everything else on this shell
   is seen from outside and from some way off; the aft edge is a hand's breadth
   from the windscreen, and it was a cut in a zero-thickness surface — a razor
   with the inside of the same skin showing through it, because the material is
   DoubleSide. No amount of shading fixes that: what is missing is not light,
   it is the edge itself.

   SO IT IS BUILT THE WAY THE PART IS. A cowl skin does not stop at a firewall,
   it laps over the fuselage and its edge is FOLDED — rolled back on itself so
   there is no cut aluminium anywhere a hand goes. The profile here is that
   fold, in three pieces, working aft along the skin and then forward again
   inside it:

     LAP    a smoothstep flare three times its own height long, standing the
            skin `fwLipRise` proud so it laps the fuselage instead of butting
            it. This is what gives the joint a highlight and a shadow; a flush
            edge has neither. OFF by default — see `fwLipRise` in P.
     FOLD   a half-round of radius `fwLipR` whose aft-most point sits exactly
            on z = 0. The fold is the whole reason the plane is z = 0 and not
            the skin's own end: the cowl may not grow into the firewall.
     RETURN `fwLipIn` of INNER skin running forward, 2 r inboard of the outer
            surface. This is the "couple of centimetres inside" — enough that
            the eye reads depth and darkness behind the fold, and no more.
            A full inner shell is not modelled and is not wanted: nothing can
            see it, and it would double the cowl's triangles.

   The band's first ring is the skin's own aft row — same azimuths, zero
   offset, same `surfPoint` — so there is no seam to crack open when the
   section, the taper or a cheek moves. Normals are ANALYTIC (the profile knows
   its own tangent), not averaged off the grid: an averaged fold of this radius
   smears into a chamfer, and the tight highlight along the roll is the entire
   effect. */
/* THE INSIDE OF THE COWL IS NOT THE OUTSIDE OF IT (2026-09-11, the user: "make
   the interior of the cowl very dark ... same shade as the cowl, but much,
   much darker, almost black"). Every inward-facing surface here was wearing
   the SKIN material, so the fold's return and the inlet throats caught the sky
   and beamed like painted topsides. A real cowl's inside is bare primer or
   zinc chromate gone sooty — and until there is an occlusion pass, a dark
   albedo is what stands in for the light that never reaches in there.
   `mats.inner` is the cowl's own colour taken down to near-black (built in
   _cage_cowl.js so it follows the livery); the fallbacks keep this module
   loadable by a bench that predates it. */
// EVERY interior takes it, not just the fold: the inlet duct's closing disc
// and the chin scoop's throat were on the neutral `dark`, which under a warm
// cowl reads faintly blue. One colour for the inside of one part.
const innerMat=mats=>mats.inner||mats.dark||mats.skin;
function fwLipProfile(){
  const d=clamp(P.detail,0.35,2);
  const g=fwGeom(), r=g.r, p=g.p, sr=g.sr, zA=g.r, L=g.L;
  const prof=[];
  // 1. the lap. Its outward normal tilts FORWARD, like any surface whose
  //    radius grows aft — which is what puts the light on it from the cockpit.
  if(sr>0){
    const NR=Math.max(2,Math.round(4*d));
    for(let k=0;k<=NR;k++){
      const u=k/NR, sp=6*u*(1-u);                  // d/du of smooth()
      const nzc=p*sp, ndc=sr, L1=Math.hypot(nzc,ndc)||1;
      prof.push({d:p*smooth(u), z:zA+sr*(1-u), nd:ndc/L1, nz:nzc/L1});
    }
  }else prof.push({d:0, z:zA, nd:1, nz:0});        // the skin's aft row itself
  // 2. the fold, centred at (d = p - r, z = zA): tangent to the lap at phi 0,
  //    aft-most exactly on z = 0 at phi = pi/2, inner surface at phi = pi
  // EVEN, so one sample lands exactly on phi = pi/2 and the fold's aft-most
  // ring is exactly the firewall plane. Odd counts left it 0.06 mm forward of
  // z = 0, which is not a shape anybody would see but is a plane the whole
  // cowl is measured from.
  const NF=2*Math.max(3,Math.round(4*d));
  for(let k=1;k<=NF;k++){
    const ph=k/NF*Math.PI;
    prof.push({d:(p-r)+r*Math.cos(ph), z:zA-r*Math.sin(ph),
               nd:Math.cos(ph), nz:-Math.sin(ph)});
  }
  // 3. the return, facing inboard
  // ONE ROW: it is a straight strip of constant normal, so subdividing it
  // adds triangles to the one part of the cowl nothing can see closely.
  prof.push({d:p-2*r, z:zA+L, nd:-1, nz:0});
  return prof;
}
/* the section's own outward normal in the z plane — the direction the lip is
   offset along. NOT `cowlNormalAt`, which carries the taper's axial tilt: the
   fold is a 2D profile swept round the section, so its offsets must stay in
   the plane or the band leans and the fold stops being circular. */
function sectNormal2(th,z){
  const e=0.004;
  const a=surfPoint(th-e,z), b=surfPoint(th+e,z);
  let nx=b[1]-a[1], ny=-(b[0]-a[0]);
  const L=Math.hypot(nx,ny)||1; nx/=L; ny/=L;
  const q=surfPoint(th,z);
  if(nx*q[0]+ny*(q[1]-spineY(z))<0){ nx=-nx; ny=-ny; }
  return [nx,ny];
}
/* WHERE THE PAINT STOPS. The outer band is lofted in the skin, the inner one
   in `inner`, and they share a row so there is no crack. The break is ONE
   fold-step past the aft-most ring — the paint wraps over the edge and stops
   just inside it, which is where it stops on a real folded panel and is the
   one place on the profile where a material change cannot be seen, because
   the surface has already turned away from anything outside. */
function fwLipSplit(prof){
  let k=0, zBack=Infinity;
  for(let i=0;i<prof.length;i++) if(prof[i].z<zBack){ zBack=prof[i].z; k=i; }
  return Math.min(k+1,prof.length-2);
}
function buildFirewallLip(group,mats){
  if(!P.fwLipOn) return;
  if(!LID) prepareLid();
  if(!AZ.length) prepareMesh();
  const prof=fwLipProfile(), S=AZ.length, R=prof.length;
  const cutA=P.cutSpan*DEG, cutC=P.cutAz*DEG;
  const V=[];
  for(let i=0;i<R;i++){
    const s=prof[i], z=Math.max(s.z,0), row=[];
    for(let j=0;j<S;j++){
      const th=AZ[j], b=surfPoint(th,z), n2=sectNormal2(th,z);
      row.push([b[0]+n2[0]*s.d, b[1]+n2[1]*s.d, s.z,
                n2[0]*s.nd, n2[1]*s.nd, s.nz]);
    }
    V.push(row);
  }
  const kS=fwLipSplit(prof);
  const OUT={pos:[],nor:[]}, IN={pos:[],nor:[]};
  let cur=OUT;
  const push=(...vs)=>{ for(const v of vs){ cur.pos.push(v[0],v[1],v[2]);
                                            cur.nor.push(v[3],v[4],v[5]); } };
  // WOUND PER TRIANGLE, against the mean of its own three shading normals.
  // The profile turns through 180 degrees at the fold, so one fixed winding
  // has the return facing the wrong way — and on a DoubleSide material that is
  // not a hole, it is a back face whose normal three.js flips, which lights
  // the inside of the cowl as if it were the outside. Per TRIANGLE rather than
  // per quad because the quads are warped: 300 mm round the section and one
  // millimetre along the profile on a wide short cowl, where a quad's normal
  // and its two triangles' normals are not the same vector.
  const tri=(A,B,C)=>{
    const ux=B[0]-A[0], uy=B[1]-A[1], uz=B[2]-A[2];
    const vx=C[0]-A[0], vy=C[1]-A[1], vz=C[2]-A[2];
    const gx=uy*vz-uz*vy, gy=uz*vx-ux*vz, gz=ux*vy-uy*vx;
    const mx=A[3]+B[3]+C[3], my=A[4]+B[4]+C[4], mz=A[5]+B[5]+C[5];
    if(gx*mx+gy*my+gz*mz >= 0) push(A,B,C); else push(A,C,B);
  };
  for(let i=0;i<R-1;i++){
    cur = i<kS ? OUT : IN;
    for(let j=0;j<S;j++){
      if(cutA>0 && Math.abs(angDiff(AZ[j]+angDiff(AZ[(j+1)%S],AZ[j])/2,cutC))<cutA/2) continue;
      const j2=(j+1)%S;
      const A=V[i][j], B=V[i][j2], C=V[i+1][j2], D=V[i+1][j];
      tri(A,B,C); tri(A,C,D);
    }
  }
  const emit=(b,m)=>{
    if(!b.pos.length) return;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(b.pos,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(b.nor,3));
    group.add(new THREE.Mesh(g,m));
  };
  emit(OUT,mats.skin); emit(IN,innerMat(mats));
}

/* ============================ LIP ============================ */
function lipProfile(){
  const prof=[], t=Math.max(0.004,P.lipThick);
  prof.push({d:-0.0025,dz:0});                     // slight overlap onto the cut edge
  if(P.lipMode===0){
    prof.push({d:t*0.5,dz:0});
    prof.push({d:t,dz:-t*0.4});
    prof.push({d:t,dz:-Math.max(0.01,P.ductLen)});
  }else{
    const K=Math.max(5,Math.round(7*clamp(P.detail,0.35,2)));
    for(let k=0;k<K;k++){const a=k/(K-1)*Math.PI;
      prof.push({d:t*0.5*(1-Math.cos(a)), dz:t*Math.sin(a)*P.lipProtrude});}
    const K2=Math.max(4,Math.round(7*clamp(P.detail,0.35,2))), e=lerp(2.6,0.9,clamp(P.lipRound,0,1));
    for(let k=1;k<=K2;k++){const u=k/K2;
      prof.push({d:t+P.lipInset*Math.pow(u,e), dz:-P.lipDepth*u});}
    const dl=Math.max(0.005,P.ductLen);
    prof.push({d:t+P.lipInset-P.ductFlare*dl, dz:-P.lipDepth-dl});
  }
  return prof;
}
function buildLips(group,mats,aps){
  const prof=lipProfile(), d=clamp(P.detail,0.35,2);
  const SO=Math.max(20,Math.round(40*d));
  const cutA=P.cutSpan*DEG, cutC=P.cutAz*DEG;
  for(const o of aps){
    const rimZ=[], ok=[];
    for(let j=0;j<SO;j++){
      const th=j/SO*TAU,[x,y]=superPt(th,o.w,o.h,o.n);
      const z=pierceZ(o.cx+x,o.cy+y);
      ok.push(z!==null); rimZ.push(z===null?zEnd():z);
    }
    if(!ok.some(v=>v)) continue;
    const rings=prof.map(s=>{
      const w=Math.max(0.005,o.w-s.d), h=Math.max(0.005,o.h-s.d), ring=[];
      for(let j=0;j<SO;j++){
        const th=j/SO*TAU,[x,y]=superPt(th,w,h,o.n);
        let z;
        if(s.d<0){                       // sits outside the cut: solve its own rim
          const zz=pierceZ(o.cx+x,o.cy+y);
          z=(zz===null?rimZ[j]:zz)+s.dz;
        }else z=rimZ[j]+s.dz;
        ring.push(new THREE.Vector3(o.cx+x,o.cy+y,z));
      }
      return ring;
    });
    const skip=cutA>0?(i,j)=>Math.abs(angDiff((j+0.5)/SO*TAU,cutC))<cutA/2:null;
    // PAINT TO THE CREST, PRIMER BEYOND IT. The whole lip — the rolled edge
    // AND the throat and duct behind it — was one skin loft, so looking into
    // the inlets you saw the cowl's own topside colour lit like topsides,
    // which is the same fault as the fold's return. The break is the crest
    // (the profile's furthest-forward ring): outside it is the lip you see
    // from in front, inside it is duct.
    let kC=0; for(let k=1;k<prof.length;k++) if(prof[k].dz>prof[kC].dz) kC=k;
    kC=Math.min(Math.max(kC,1),rings.length-2);
    group.add(new THREE.Mesh(loftRings(rings.slice(0,kC+1),skip),mats.skin));
    group.add(new THREE.Mesh(loftRings(rings.slice(kC),
      skip?(i,j)=>skip(i+kC,j):null),innerMat(mats)));
    const last=rings[rings.length-1];
    const zc=last.reduce((s,v)=>s+v.z,0)/last.length;
    group.add(new THREE.Mesh(fan(last,new THREE.Vector3(o.cx,o.cy,zc),false,skip?j=>skip(0,j):null),innerMat(mats)));
  }
}
function loftRings(rings,skip){
  const R=rings.length,S=rings[0].length,pos=[],idx=[];
  for(const r of rings) for(const v of r) pos.push(v.x,v.y,v.z);
  for(let i=0;i<R-1;i++) for(let j=0;j<S;j++){
    if(skip&&skip(i,j))continue;
    const j2=(j+1)%S,a=i*S+j,b=i*S+j2,c=(i+1)*S+j2,d=(i+1)*S+j;
    idx.push(a,b,c,a,c,d);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function fan(ring,center,flip,skip){
  const pos=[center.x,center.y,center.z],idx=[];
  for(const v of ring)pos.push(v.x,v.y,v.z);
  for(let j=0;j<ring.length;j++){
    if(skip&&skip(j))continue;
    const a=1+j,b=1+(j+1)%ring.length;
    if(flip)idx.push(0,b,a);else idx.push(0,a,b);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

/* ============================ CHIN SCOOP ============================ */
function buildScoop(group,mats){
  if(!P.scoopOn) return;
  const d=clamp(P.detail,0.35,2), ze=zEnd(), rings=[], inside=[];
  const NS=Math.max(9,Math.round(14*d)), SS=Math.max(18,Math.round(32*d));
  const baseY=spineY(ze*0.6)-sectionAtZ(P.cowlLen*0.5).bB*P.scoopDrop;
  // THE STATION (2026-09-05): scoopZ slides the mouth from the lid (0, the
  // line every cowl before it was drawn from — byte-identical there) back to
  // the firewall (1), where a reverse-flow turbine takes its air
  const zMouth0=P.cowlLen+P.lidLen*0.35;
  const z1=zMouth0-(P.scoopZ||0)*(zMouth0-P.scoopLen), z0=z1-P.scoopLen;
  const n=sqExp(P.scoopSq);
  for(let i=0;i<NS;i++){
    const t=i/(NS-1), e=smooth(t);
    const a=P.scoopW*lerp(0.5,1,e), b=P.scoopH*lerp(0.30,1,e);
    const y=baseY-P.scoopH*P.scoopRake*e, z=lerp(z0,z1,t);
    const ring=[],ins=[];
    for(let j=0;j<SS;j++){
      const th=j/SS*TAU,[x,yy]=superPt(th,a,b,n);
      let vx=x, vy=y+yy;
      const f=sectF(vx,vy,z), isIn=(f<1 && z>=0 && z<=ze);
      if(isIn){
        const s=sectionAtZ(z), dy=vy-s.cy-s.yw, nn=dy<0?s.nB:s.nT;
        const k=Math.pow(Math.max(f,1e-6),-1/nn)*1.003;
        vx*=k; vy=s.cy+s.yw+dy*k;
      }
      ins.push(isIn); ring.push(new THREE.Vector3(vx,vy,z));
    }
    rings.push(ring); inside.push(ins);
  }
  const skip=(i,j)=>{const j2=(j+1)%SS;
    return inside[i][j]&&inside[i][j2]&&inside[i+1][j]&&inside[i+1][j2];};
  group.add(new THREE.Mesh(loftRings(rings,skip),mats.skin));

  /* Mouth lip: same cross-section idea as the aperture lip — a rounded edge of
     real thickness, then a converging throat, then a duct. Offsets are applied
     to the actual mouth ring, so it still works where the scoop was trimmed. */
  const cyF=baseY-P.scoopH*P.scoopRake, mouth=rings[NS-1];
  const off=(d,dz)=>mouth.map(v=>{
    const dx=v.x, dy=v.y-cyF, r=Math.hypot(dx,dy)||1e-6, f=Math.max(0.06,(r-d)/r);
    return new THREE.Vector3(dx*f, cyF+dy*f, v.z+dz);
  });
  const th0=Math.max(0.002,P.scoopLipH);
  const inset=Math.max(0,(1-clamp(P.scoopAp,0.05,0.99))*P.scoopH-th0);
  const dep=Math.max(0.002,P.scoopLipDepth);
  const KL=Math.max(5,Math.round(6*d)), lipP=[{d:0,dz:0}];
  for(let k=1;k<KL;k++){const a=k/(KL-1)*Math.PI;
    lipP.push({d:th0*0.5*(1-Math.cos(a)), dz:th0*0.55*Math.sin(a)});}
  const outer=lipP.map(s=>off(s.d,s.dz));
  group.add(new THREE.Mesh(loftRings(outer,null),mats.skin));
  const inP=[lipP[lipP.length-1]];
  const KI=Math.max(3,Math.round(5*d));
  for(let k=1;k<=KI;k++){const u=k/KI;
    inP.push({d:th0+inset*Math.pow(u,1.4), dz:-dep*u});}
  inP.push({d:th0+inset, dz:-dep-Math.max(0.005,P.scoopDuct)});
  const innerR=inP.map(s=>off(s.d,s.dz));
  group.add(new THREE.Mesh(loftRings(innerR,null),innerMat(mats)));
  const last=innerR[innerR.length-1];
  const zc=last.reduce((s,v)=>s+v.z,0)/last.length;
  group.add(new THREE.Mesh(fan(last,new THREE.Vector3(0,cyF,zc),false,null),innerMat(mats)));
}

/* ==================== FASTENERS, PARTING LINE, OIL DOOR ====================
   A COWL IS A PANEL YOU TAKE OFF, and until now nothing here said so. This
   generator could draw the shape of a cowl in twelve ways and every one of
   them came out as a moulded blob, because the three things that actually
   identify a cowl were all missing: the row of fasteners that holds it on,
   the line it comes apart along, and the little door you check the oil
   through. They are also the first things the eye finds, because they are the
   only straight lines on a curved object.

   EVERYTHING IS PLACED ON THE SURFACE, through `surfPoint` — the same
   function the shell is lofted from — so a fastener cannot drift off the cowl
   when the section, the taper or a lobe moves under it. That is the pitot
   rule from G5 and the fitPad rule from the undercarriage, applied here.

   THE PITCH IS A REAL DIMENSION. Camlocs go in at 100-120 mm on a light
   aeroplane: close enough that the panel does not oil-can between them, far
   enough apart that you are not turning forty of them to check the oil. The
   default is 110 mm and the row COUNT falls out of the cowl's own girth. */
function cowlNormalAt(th,z){
  const e=0.004, ez=Math.max(0.004,P.cowlLen*0.02);
  const a=surfPoint(th-e,z), b=surfPoint(th+e,z);
  const c=surfPoint(th,Math.max(0,z-ez)), d=surfPoint(th,z+ez);
  const t1=[b[0]-a[0],b[1]-a[1],0];                 // along the section
  const t2=[d[0]-c[0],d[1]-c[1],2*ez];              // along the axis
  const n=[t1[1]*t2[2]-0*t2[1], 0*t2[0]-t1[0]*t2[2], t1[0]*t2[1]-t1[1]*t2[0]];
  const L=Math.hypot(n[0],n[1],n[2])||1;
  const p=surfPoint(th,z);
  const out=(p[0]*n[0]+(p[1]-spineY(z))*n[1])>=0?1:-1;   // point it outward
  return [out*n[0]/L,out*n[1]/L,out*n[2]/L];
}
/* one camloc: a shallow disc standing proud of the skin, with a slot in it.
   The slot is what makes it read as a fastener rather than a rivet, and it is
   two triangles. */
function camlocInto(pos,idx,th,z,r,rise){
  const p=surfPoint(th,z), n=cowlNormalAt(th,z);
  const c=[p[0],p[1],z];
  const t=[-n[1],n[0],0], L0=Math.hypot(t[0],t[1])||1;
  const e1=[t[0]/L0,t[1]/L0,0];
  const e2=[n[1]*e1[2]-n[2]*e1[1],n[2]*e1[0]-n[0]*e1[2],n[0]*e1[1]-n[1]*e1[0]];
  const SEG=10, base=pos.length/3;
  const at=(k,rr,h)=>{
    const a=2*Math.PI*k/SEG,cs=Math.cos(a),sn=Math.sin(a);
    pos.push(c[0]+e1[0]*cs*rr+e2[0]*sn*rr+n[0]*h,
             c[1]+e1[1]*cs*rr+e2[1]*sn*rr+n[1]*h,
             c[2]+e1[2]*cs*rr+e2[2]*sn*rr+n[2]*h);
  };
  for(let k=0;k<SEG;k++) at(k,r,0);
  for(let k=0;k<SEG;k++) at(k,r*0.92,rise);
  const ctr=pos.length/3;
  pos.push(c[0]+n[0]*rise,c[1]+n[1]*rise,c[2]+n[2]*rise);
  for(let k=0;k<SEG;k++){
    const j=(k+1)%SEG;
    idx.push(base+k,base+j,base+SEG+j, base+k,base+SEG+j,base+SEG+k);
    idx.push(base+SEG+k,base+SEG+j,ctr);
  }
}
function buildDetail(group,mats){
  const ze=zEnd(), d=clamp(P.detail,0.35,2);
  /* ---- THE PARTING LINE, along the waist ------------------------------
     Where the two halves come apart. It is a NARROW DARK STRIP rather than a
     modelled gap: a real parting line is a 2 mm shadow, and geometry that
     thin is worse than a strip at every distance the cowl is ever seen from. */
  /* ...AND IT ENDS AT THE PANEL JOINT (G213, the user: "the parting line
     should stop at the seam between the face and the body"). The nose bowl
     is one piece: the halves that part along this line are the barrel
     panels, so the line runs from the firewall to the aft edge of the joint
     — a step's set-in edge, a groove's aft shoulder — and no further. With
     no joint drawn the line runs the whole length, as it always did. */
  const zP=(()=>{
    if(!P.seamOn) return ze;
    const w=Math.max(P.seamWidth,5e-4), z0=clamp(P.seamPos,0,1)*ze;
    return clamp(z0-(P.seamType===0?w:w*0.5),ze*0.05,ze);
  })();
  if(P.partOn){
    const th0=P.partY*Math.PI*0.5;                 // 0 = the waist, +-1 = pole
    const NZ=Math.max(6,Math.round(22*d)), w=Math.max(0.0015,P.partW);
    // ...and it starts on the SKIN, not in the lip's fold: `surfPoint` still
    // answers below `aftStart`, but the surface down there is the lip, which
    // is up to `fwLipRise` proud of it — so a strip laid on the bare section
    // would sink into the lap it is supposed to run over.
    const zL=aftStart();
    for(const sgn of [1,-1]){
      const rings=[];
      for(let i=0;i<=NZ;i++){
        const z=lerp(zL,zP,i/NZ);
        const row=[];
        for(const o of [-w,w]){
          const th=sgn>0?(th0+o):(Math.PI-th0-o);
          const p=surfPoint(th,z), n=cowlNormalAt(th,z);
          row.push(new THREE.Vector3(p[0]+n[0]*0.0006,p[1]+n[1]*0.0006,
                                     z+n[2]*0.0006));
        }
        rings.push(row);
      }
      const pos=[],idx=[];
      for(const r of rings) for(const v of r) pos.push(v.x,v.y,v.z);
      for(let i=0;i<NZ;i++){
        const a=i*2,b=i*2+1,c=(i+1)*2+1,e=(i+1)*2;
        idx.push(a,b,c,a,c,e);
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      g.setIndex(idx); g.computeVertexNormals();
      group.add(new THREE.Mesh(g,mats.dark));
    }
  }
  /* ---- THE FASTENERS -------------------------------------------------
     Two rows, and both are where a real cowl has them: round the AFT EDGE,
     which is the row that carries the whole panel onto the firewall, and
     along the PARTING LINE, which holds the halves to each other. */
  if(P.fastOn){
    const pos=[],idx=[], r=Math.max(0.004,P.fastD*0.5), pitch=Math.max(0.04,P.fastPitch);
    // the aft edge: pitch measured round the section's own girth
    {
      // clear of the lip: a camloc half-buried in the fold reads as a dent
      const zA=Math.max(Math.min(ze*0.06,0.02),aftStart()+r*1.2);
      let girth=0; const NG=64;
      let prev=surfPoint(0,zA);
      for(let k=1;k<=NG;k++){
        const p=surfPoint(2*Math.PI*k/NG,zA);
        girth+=Math.hypot(p[0]-prev[0],p[1]-prev[1]); prev=p;
      }
      const n=Math.max(6,Math.round(girth/pitch));
      for(let k=0;k<n;k++) camlocInto(pos,idx,2*Math.PI*k/n,zA,r,r*0.35);
    }
    // and along the split line, both flanks — as far as the line goes
    if(P.partOn){
      const th0=P.partY*Math.PI*0.5;
      const n=Math.max(2,Math.round(zP/pitch));
      for(const sgn of [1,-1])
        for(let k=1;k<=n;k++){
          const z=zP*k/(n+1);
          camlocInto(pos,idx,sgn>0?th0:Math.PI-th0,z,r,r*0.35);
        }
    }
    if(idx.length){
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      g.setIndex(idx); g.computeVertexNormals();
      group.add(new THREE.Mesh(g,mats.steel));
    }
  }
  /* ---- THE OIL DOOR ---------------------------------------------------
     On the top deck, aft of the middle, where you can reach it standing on
     the ground. Drawn as a proud panel with its own hinge line, because that
     is what you see: the door sits a millimetre off the skin and the hinge is
     the one straight edge on it. */
  if(P.oilOn){
    /* THE OUTLINE IS A SUPERELLIPSE, and it was a rectangle by omission (user,
       2026-08-31: "the trap on the cowl is blocky, I guess it's real, but
       wouldn't that be better if it were a circle?"). There was never an
       outline OBJECT here: the door was the boundary of a tensor grid at a
       constant angular half-extent, so its shape was not a choice anybody had
       made. `oilSq` is the same 0..1 roundness the sections, the apertures and
       the scoop already speak (sqExp / superPt) — 1 a rounded rectangle, 0.5 a
       true ellipse (a CIRCLE when the two half-extents match on the surface),
       0 a diamond. Default 1, which differs from the old sharp rectangle only
       by the corner radius sqExp(1) = n:10 implies: 1 - 0.5^(1/10) = 6.7% of
       the half-size, about 4 mm on the stock 130 mm door.
       The mesh is a DISC now (a centre point and NR rings) rather than a grid,
       because a grid cannot close a round outline without collapsing its end
       rows into slivers. */
    const zc=ze*clamp(P.oilZ,0.05,0.95), hw=Math.max(0.02,P.oilW*0.5);
    const hl=Math.max(0.02,P.oilL*0.5);
    const nSq=sqExp(P.oilSq===undefined?1:P.oilSq);
    const NA=24, NR=3, rings=[];
    const p0=surfPoint(Math.PI/2,zc);
    /* THE WIDTH IS MEASURED ON THE SECTION (G213). The angular half-extent
       used to be hw over hypot(x, 1) — a radius of ONE METRE, whatever the
       cowl's — so the door came out at a third of the width its row said
       (39 mm for the stock 130 mm on a 0.3 m half-height). Bisected now
       for the angle whose arc from the deck centre spans hw on the surface
       the door is actually drawn on. */
    const halfAng=(()=>{
      let lo=0, hi=Math.PI*0.33;
      for(let i=0;i<24;i++){
        const m=(lo+hi)/2, q=surfPoint(Math.PI/2+m,zc);
        if(Math.hypot(q[0]-p0[0],q[1]-p0[1])<hw) lo=m; else hi=m;
      }
      return (lo+hi)/2;
    })();
    /* the outline in the surface's own (angle, station) parameters, then
       walked inward: one point per ring per angle, plus the centre. */
    const at=(u,v)=>{
      const th=clamp(Math.PI/2+u*halfAng,0,Math.PI);
      const z=clamp(zc+v*hl,0.002,ze-0.002);
      const q=surfPoint(th,z), n=cowlNormalAt(th,z);
      return new THREE.Vector3(q[0]+n[0]*0.0015,q[1]+n[1]*0.0015,z+n[2]*0.0015);
    };
    const edge=[];
    for(let j=0;j<NA;j++) edge.push(superPt(TAU*j/NA,1,1,nSq));
    for(let r=1;r<=NR;r++){
      const f=r/NR, row=[];
      for(let j=0;j<NA;j++) row.push(at(edge[j][0]*f, edge[j][1]*f));
      rings.push(row);
    }
    const pos=[],idx=[];
    const ctr=at(0,0); pos.push(ctr.x,ctr.y,ctr.z);          // index 0
    for(const r2 of rings) for(const v of r2) pos.push(v.x,v.y,v.z);
    for(let j=0;j<NA;j++) idx.push(0, 1+((j+1)%NA), 1+j);    // the centre fan
    for(let r=0;r<NR-1;r++) for(let j=0;j<NA;j++){
      const a=1+r*NA+j, b=1+r*NA+(j+1)%NA;
      const c=1+(r+1)*NA+(j+1)%NA, e=1+(r+1)*NA+j;
      idx.push(a,b,c,a,c,e);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setIndex(idx); g.computeVertexNormals();
    group.add(new THREE.Mesh(g,mats.skin));
    /* THE GAP ROUND THE DOOR (G213, the user: "the oil door is invisible, I
       can barely see a few pixels moving behind the cowl"). The panel above
       is the cowl's own skin lifted a millimetre and a half, and a panel in
       the same paint on the same surface has no outline: what says "door"
       on a real cowl is the shadow line of the gap round it. So the gap is
       drawn the way the split line is — a narrow dark strip on the skin —
       between the outline and an offset of it 2.5 mm out, in the surface's
       own (angle, station) parameters. The door itself is unchanged
       (GATE COWL measures it: first skin mesh, disc topology, roundness). */
    {
      const gw=0.0025, fu=1+gw/Math.max(hw,0.01), fv=1+gw/Math.max(hl,0.01);
      // the strip sits between the panel (1.5 mm) and the skin: 0.6 mm
      // proud like the split line, so it is never behind either
      const atH=(u,v,h)=>{
        const th=clamp(Math.PI/2+u*halfAng,0,Math.PI), z=clamp(zc+v*hl,0.002,ze-0.002);
        const q=surfPoint(th,z), n=cowlNormalAt(th,z);
        return [q[0]+n[0]*h,q[1]+n[1]*h,z+n[2]*h];
      };
      const gp=[],gi=[];
      for(let j=0;j<NA;j++){
        const e=edge[j];
        gp.push(...atH(e[0],e[1],0.0006), ...atH(e[0]*fu,e[1]*fv,0.0006));
      }
      for(let j=0;j<NA;j++){
        const a=j*2,b=j*2+1,c=((j+1)%NA)*2+1,e=((j+1)%NA)*2;
        gi.push(a,b,c,a,c,e);
      }
      const gg=new THREE.BufferGeometry();
      gg.setAttribute('position',new THREE.Float32BufferAttribute(gp,3));
      gg.setIndex(gi); gg.computeVertexNormals();
      group.add(new THREE.Mesh(gg,mats.dark));
    }
    /* THE LATCH, on the aft edge, opposite the hinge: one quarter-turn
       fastener like the camlocs, because a door with a hinge and no latch is
       a flap. Placed at 70 % of the way aft, where the outline still spans
       something (the same reasoning as the hinge below). */
    {
      const lp=[],li=[];
      camlocInto(lp,li,Math.PI/2,clamp(zc-0.70*hl,0.002,ze-0.002),0.007,0.0035);
      const gl=new THREE.BufferGeometry();
      gl.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));
      gl.setIndex(li); gl.computeVertexNormals();
      group.add(new THREE.Mesh(gl,mats.steel));
    }
    /* THE HINGE, on the forward edge — and it moves INBOARD with the roundness.
       It used to be a straight chord at the door's forward extreme across the
       full angular width, which is a station where a round door has no width
       at all. It sits where the outline still spans something: 70% of the way
       forward, at that row's own half-extent. */
    const hp=[],hi=[];
    const hv=0.70;
    const hu=Math.pow(Math.max(0,1-Math.pow(hv,nSq)),1/nSq);
    const NH=Math.max(2,Math.round(NA/3));
    const hz=clamp(zc+hv*hl,0.002,ze-0.002);
    for(let j=0;j<=NH;j++){
      const th=Math.PI/2+halfAng*hu*(2*j/NH-1);
      const p=surfPoint(th,hz), n=cowlNormalAt(th,hz);
      hp.push(p[0]+n[0]*0.0022,p[1]+n[1]*0.0022,hz+n[2]*0.0022);
      hp.push(p[0]+n[0]*0.0022,p[1]+n[1]*0.0022,hz+n[2]*0.0022-0.008);
    }
    for(let j=0;j<NH;j++){
      const a=j*2,b=j*2+1,c=(j+1)*2+1,e=(j+1)*2;
      hi.push(a,b,c,a,c,e);
    }
    const gh=new THREE.BufferGeometry();
    gh.setAttribute('position',new THREE.Float32BufferAttribute(hp,3));
    gh.setIndex(hi); gh.computeVertexNormals();
    group.add(new THREE.Mesh(gh,mats.steel));
  }
}

/* ============================ AFT ============================ */
function buildAft(group,mats){
  const s0=sectionAtZ(0);
  if(P.aftMode===0){
    /* The fuselage is a given, not a consequence of the cowl: a constant
       section carried aft from the firewall loop. Its size comes from the
       firewall half-width and half-height and nothing else. */
    const L=Math.max(P.stubLen,1e-4);
    const a=P.aftW;
    const bT=P.aftH*P.stubDeckH, bB=P.aftH*P.stubKeelH;
    const nT=sqExp(P.stubSqTop), nB=sqExp(P.stubSqBot);
    const yw=clamp(P.stubWaist,-0.85,0.85)*P.aftH;
    const sect={a,bT,bB,nT,nB,yw};
    const NS=4, rings=[];
    for(let i=0;i<NS;i++){
      const z=-i/(NS-1)*L, ring=[];
      for(let j=0;j<AZ.length;j++){
        const th=AZ[j];
        const [x,y]=sectPt(th,sect);
        ring.push(new THREE.Vector3(x,y,z));
      }
      rings.push(ring);
    }
    // WOUND OUTWARD (G243.1): these rings march AFT, which turns loftRings'
    // fixed winding inside out relative to every forward loft on the cowl.
    // Harmless while every material was DoubleSide; the skin is one-sided now.
    group.add(new THREE.Mesh(loftRings(rings.slice().reverse(),null),mats.host));
  }else{
    const NS=22,rings=[];
    for(let i=0;i<NS;i++){
      const e=smooth(i/(NS-1)), k=Math.sqrt(Math.max(0,1-Math.pow(e,2.2))), ring=[];
      for(let j=0;j<AZ.length;j++){
        const th=AZ[j];
        const [x,y]=sectPt(th,{a:Math.max(s0.a*k,0.012),bT:Math.max(s0.bT*k,0.012),
          bB:Math.max(s0.bB*k,0.012),nT:lerp(s0.nT,2,e),nB:lerp(s0.nB,2,e),
          yw:s0.yw*k*(1-e)});
        ring.push(new THREE.Vector3(x,s0.cy-P.tailDrop*e+y,-e*P.tailLen));
      }
      rings.push(ring);
    }
    group.add(new THREE.Mesh(loftRings(rings.slice().reverse(),null),mats.skin));
    if(P.pylon){
      const w=s0.a*0.42,h=s0.bT*1.5;
      const m=new THREE.Mesh(new THREE.BoxGeometry(w*2,h,P.tailLen*0.75),mats.host);
      m.position.set(0,s0.cy-h*0.55,-P.tailLen*0.42); group.add(m);
      const wg=new THREE.Mesh(new THREE.BoxGeometry(3.2,0.10,1.1),mats.host);
      wg.position.set(0,s0.cy-h*0.95,-P.tailLen*0.45); group.add(wg);
    }
  }
}

/* ============================ NOSE CONE + SHAFT ============================ */
function spinProfile(u){
  const k=lerp(1.0,2.8,clamp(P.spinRound,0,1)), e=lerp(1.0,0.5,clamp(P.spinRound,0,1));
  return Math.pow(Math.max(0,1-Math.pow(u,k)),e);
}
function coneBaseZ(){ return zEnd()+P.noseOff; }
function axisXY(){ return {x:P.apOffX, y:spineY(zEnd())+P.apOffY}; }
function bladePlaneZ(){ return coneBaseZ()+P.spinLen*clamp(P.bladeStation,0.02,0.95); }
function coneRadiusAtBlade(){ return P.spinR*spinProfile(clamp(P.bladeStation,0.02,0.95)); }

function buildNose(group,mats){
  const d=clamp(P.detail,0.35,2), ax=axisXY(), z0=coneBaseZ();
  const NS=Math.max(10,Math.round(16*d)), SA=Math.max(20,Math.round(40*d)), rings=[];
  for(let i=0;i<NS;i++){
    const u=i/(NS-1), r=P.spinR*spinProfile(u), z=z0+u*P.spinLen, ring=[];
    for(let j=0;j<SA;j++){const th=j/SA*TAU;
      ring.push(new THREE.Vector3(ax.x+Math.cos(th)*r,ax.y+Math.sin(th)*r,z));}
    rings.push(ring);
  }
  group.add(new THREE.Mesh(loftRings(rings,null),mats.prop));
  group.add(new THREE.Mesh(fan(rings[0],new THREE.Vector3(ax.x,ax.y,z0),true,null),mats.prop));
  const sr=Math.min(P.shaftR,P.spinR*0.9), zA=z0-P.shaftLen, a=[],b=[];
  const SS2=Math.max(14,Math.round(24*d));
  for(let j=0;j<SS2;j++){const th=j/SS2*TAU;
    a.push(new THREE.Vector3(ax.x+Math.cos(th)*sr,ax.y+Math.sin(th)*sr,z0));
    b.push(new THREE.Vector3(ax.x+Math.cos(th)*sr*1.3,ax.y+Math.sin(th)*sr*1.3,zA));}
  group.add(new THREE.Mesh(loftRings([a,b],null),mats.steel));
  group.add(new THREE.Mesh(fan(b,new THREE.Vector3(ax.x,ax.y,zA),true,null),mats.steel));
}

/* ============================ BLADES ============================ */
function naca(m,p,t,x){
  const yt=5*t*(0.2969*Math.sqrt(x)-0.1260*x-0.3516*x*x+0.2843*x*x*x-0.1036*x*x*x*x);
  let yc,dy;
  if(x<p){yc=m/(p*p)*(2*p*x-x*x); dy=2*m/(p*p)*(p-x);}
  else{yc=m/((1-p)*(1-p))*((1-2*p)+2*p*x-x*x); dy=2*m/((1-p)*(1-p))*(p-x);}
  const th=Math.atan(dy);
  return [x-yt*Math.sin(th),yc+yt*Math.cos(th),x+yt*Math.sin(th),yc-yt*Math.cos(th)];
}
function airfoilLoop(m,t,NPT){
  const up=[],lo=[];
  for(let i=0;i<NPT;i++){
    const x=0.5*(1-Math.cos(i/(NPT-1)*Math.PI));
    const [xu,yu,xl,yl]=naca(m,0.42,t,x);
    up.push([xu,yu]); lo.push([xl,yl]);
  }
  return up.concat(lo.slice(1,NPT-1).reverse());
}
function propGeometry(){
  const R=P.propD/2, d=clamp(P.detail,0.35,2);
  const rh=coneRadiusAtBlade()*0.82;             // root buried inside the cone
  const NPT=Math.max(10,Math.round(16*d));
  const NS=Math.max(14,Math.round(22*d)), stations=[], rings=[];
  const V=P.tas/3.6, n=P.rpm/60;
  const Pgeo=V/Math.max(n,1)/(1-clamp(P.slip,0,40)/100);
  const uc=1-clamp(P.tipRound,0.01,0.35);        // where the rounded tip cap starts
  for(let i=0;i<NS;i++){
    const q=i/(NS-1);
    const u=0.5-0.5*Math.cos(Math.PI*q);          // dense at root cuff and tip
    const r=lerp(rh,R,u);
    let c=lerp(P.rootChord,P.tipChord,smooth(u))*(1+P.chordBulge*Math.sin(Math.PI*u));
    let t=lerp(P.thickRoot,P.thickTip,u);
    let scale=1;
    if(u>uc){ const q=(u-uc)/(1-uc); scale=Math.sqrt(Math.max(0,1-q*q)); }
    const beta=Math.atan2(Pgeo,TAU*r);
    const loop=airfoilLoop(P.camb,t,NPT);
    const cuffU=clamp(P.cuff,0.001,0.6);
    const blend=u<cuffU?Math.pow(1-u/cuffU,1.7):0;
    const shank=clamp(P.shankR,0.012,coneRadiusAtBlade()*0.92);
    const sw=P.sweep*R*u*u, ring=[];
    const cEff=Math.max(c*scale,0.0015);
    const L=loop.length;
    const pts=new Array(L);
    for(let j=0;j<L;j++) pts[j]=[(loop[j][0]-0.35)*cEff, loop[j][1]*cEff];
    if(blend>0){
      /* Blend to the round shank by arc-length position, not by index. The
         airfoil loop is cosine-spaced from the leading edge, so an index-based
         mapping sends the LE to the far side of the circle and the section
         twists through itself — that was the root pinch. Index 0 is the LE,
         and the loop runs LE -> upper -> TE -> lower, i.e. clockwise, so the
         target angle starts at pi and decreases. */
      const seg=new Array(L); let tot=0;
      for(let j=0;j<L;j++){
        const a=pts[j], b=pts[(j+1)%L];
        seg[j]=Math.hypot(b[0]-a[0],b[1]-a[1]); tot+=seg[j];
      }
      let acc=0;
      for(let j=0;j<L;j++){
        const ang=Math.PI-(acc/Math.max(tot,1e-9))*TAU; acc+=seg[j];
        pts[j][0]=lerp(pts[j][0],Math.cos(ang)*shank,blend);
        pts[j][1]=lerp(pts[j][1],Math.sin(ang)*shank,blend);
      }
    }
    const cb=Math.cos(beta),sb=Math.sin(beta);
    for(let j=0;j<L;j++){
      const xc=pts[j][0], yc=pts[j][1];
      ring.push(new THREE.Vector3(xc*cb-yc*sb+sw,r,xc*sb+yc*cb));
    }
    rings.push(ring); stations.push({r,c:cEff,t:t*cEff});
  }
  return {geom:loftRings(rings,null),
          root:fan(rings[0],new THREE.Vector3(0,rh,0),true,null),
          tip:fan(rings[NS-1],new THREE.Vector3(0,R,0),false,null),
          stations,Pgeo,rh};
}

// ---------------------------------------------------------------------------
// THE COWL IS WRAPPED AROUND AN ENGINE (chantier 4).
//
// The presets encode this implicitly and always did — the C172 row is a "wide
// flat barrel" BECAUSE it covers a flat four, and the Spitfire row is faired
// BECAUSE it covers a V12. That reasoning lived in the numbers. This makes it
// a rule, and it is the one G20d already established for the wheel spat:
//
//     the fairing is the GREATER of two shapes — the streamlined form it
//     wants to be, and the thing inside it plus clearance
//
// A spat shallower than its tyre had the wheel punch through it. A cowl
// shallower than its engine has the cylinders punch through it, which is the
// same defect and takes the same cure.
//
// `env` is _eng_gen.js's envelope (metres, about the THRUSTLINE — G4.7's
// datum ruling, and the reason the cowl does not reference the firewall's
// centre). Returns the fields it would set; it does not write P itself, so a
// caller can show the builder what fitting the engine would cost before it
// happens.
function cowlFitEngine(env, opt) {
  if (!env) return null;
  const o = opt || {};
  const gap = o.clearance == null ? 0.030 : o.clearance;   // m, all round
  const nose = o.noseGap == null ? 0.055 : o.noseGap;      // ahead of the case
  // The envelope is the BARE engine (see _eng_gen.js): induction and the
  // accessories above it are not in it, so the clearance is doing double duty
  // over the deck and is deliberately generous there.
  const deck = o.deckGap == null ? gap * 2.2 : o.deckGap;
  // `aftW` AND `aftH` ARE HALF-DIMENSIONS — the superellipse's semi-axes (see
  // sectionAtZ, where `a` lerps from aftW and the panel labels them "Half-width
  // at firewall"). The first cut of this function handed them FULL width and
  // height and built every cowl at twice the size it needed; measuring the
  // emitted section rather than trusting the parameter name is what caught it,
  // and the check now does exactly that.
  // Measured over the SILHOUETTE where the engine publishes one — the points
  // actually occupied, looking down the crank axis. A bounding box would make
  // a radial demand a cowl big enough for the empty corners between its
  // cylinders, which is how a round engine ends up in a square cowl.
  const hull = env.hull && env.hull.length ? env.hull
    : [[env.x0, env.y0], [env.x0, env.y1], [env.x1, env.y0], [env.x1, env.y1]];
  let hx = 0, hyT = 0, hyB = 0;
  for (const [x, y] of hull) {
    hx = Math.max(hx, Math.abs(x));
    hyT = Math.max(hyT, y);
    hyB = Math.min(hyB, y);
  }
  const want = {
    aftW: hx + gap,
    aftH: Math.max(hyT + deck, Math.abs(hyB) + gap),
    cowlLen: env.length + nose,
  };
  // what the cowl currently is, so a caller can report the difference rather
  // than silently resize the builder's aeroplane
  const now = { aftW: P.aftW, aftH: P.aftH, cowlLen: P.cowlLen };
  const fits = now.aftW >= want.aftW - 1e-9 &&
               now.aftH >= want.aftH - 1e-9 &&
               now.cowlLen >= want.cowlLen - 1e-9;
  return { want, now, fits,
           grow: { aftW: Math.max(0, want.aftW - now.aftW),
                   aftH: Math.max(0, want.aftH - now.aftH),
                   cowlLen: Math.max(0, want.cowlLen - now.cowlLen) } };
}

// TWO INTENTS, and they are genuinely different jobs.
//
// CLEAR the engine: only ever grow. A builder who wants a big loose cowl on a
// small engine is not making a mistake; one whose cylinders are outside the
// cowl is. This is the safety rule and it is what a slider change should call.
function cowlApplyEngine(env, opt) {
  const r = cowlFitEngine(env, opt);
  if (!r) return null;
  P.aftW = Math.max(P.aftW, r.want.aftW);
  P.aftH = Math.max(P.aftH, r.want.aftH);
  P.cowlLen = Math.max(P.cowlLen, r.want.cowlLen);
  return r;
}

// SIZE to the engine: set, not max. This is the one that makes an inline six
// narrow — grow-only cannot, because the cowl it starts from is already wider
// than the engine, and the result was a slim engine in a fat barrel. Changing
// the ENGINE should re-cut the cowl around it; that is the whole claim of the
// two being connected, and it needs an intent that can shrink.
function cowlSizeToEngine(env, opt) {
  const r = cowlFitEngine(env, opt);
  if (!r) return null;
  P.aftW = r.want.aftW;
  P.aftH = r.want.aftH;
  P.cowlLen = r.want.cowlLen;
  return r;
}

const COWL_API = { TAU, P, MATERIALS, PRESETS, lerp, clamp, smooth, sqExp, superPt, angDiff, SEG, zEnd, lidRadius, spineY, bez, mkCurve, eSqAftTop, eSqAftBot, eDeckH, eKeelH, eWaist, prepareLid, seamInset, sectionAtZ, sectPt, lobeAt, surfPoint, sectF, pierceZ, equalise, prepareMesh, apertureList, fitAperture, apG, buildSurface, aftStart, fwGeom, fwLipProfile, sectNormal2, buildFirewallLip, lipProfile, buildLips, buildDetail, cowlNormalAt, loftRings, fan, buildScoop, buildAft, spinProfile, coneBaseZ, axisXY, bladePlaneZ, coneRadiusAtBlade, buildNose, naca, airfoilLoop, propGeometry, cowlFitEngine, cowlApplyEngine, cowlSizeToEngine };
if (typeof module !== 'undefined') module.exports = COWL_API;
if (typeof window !== 'undefined') window.COWL_GEN = COWL_API;
