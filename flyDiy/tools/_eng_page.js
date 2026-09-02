// ENGINE — THE PAGE MODEL, shared. Lifted VERBATIM out of _engine.html so
// the bench and the cage editor's engine layer read ONE palette, one default
// construction and one preset table — the _gear_page.js move (G21§2: a hand
// copy is exactly the second home this file exists to remove). Nothing here
// draws or knows about THREE: geometry is _eng_mesh.js, panels are each
// page's own.
//
// Load after _eng_gen.js and _eng_mesh.js.
'use strict';
(() => {
const EG = window.ENG_GEN, EMOD = window.ENG_MESH;

/* ---- the palette: realistic when `sections` is on, plain steel when off.
   One colour per module material, so the legend is the parts list. */
const COL = {
  emCase: '#8d949c', emRidge: '#7b828a', emSump: '#6a7078', emAcc: '#666d75',
  emPad: '#79818a',
  emBarrel: '#4a5058', emFin: '#585f67', emHead: '#9aa3ad', emRocker: '#b9a659',
  emRod: '#a3abb4', emIntake: '#7a8a5f', emExhaust: '#4b4844',
  emPlug: '#d8dde4', emCeramic: '#e9e4d8', emLead: '#31363d',
  emMag: '#4a525b', emMagCap: '#2e343b',
  emGen: '#59616a', emOil: '#c9a227', emCarb: '#7f8087', emAir: '#9ba3ab',
  emFilter: '#b0512b',
  emSpider: '#a08c4a', emFlange: '#c3cad2', emMount: '#2f6f3f',
  emPuck: '#1d2126', emFirewall: '#aab3bd', emMark: '#22262b',
  emFuel: '#b04a3a', emThrottle: '#20242a',
  emEsc: '#3a4148', emPhase: '#c4611f',      // HV orange, the real convention
  emBottle: '#ded9c4',                       // the translucent coolant bottle
  emCopper: '#b3622f',                       // the windings through the slots
};
const NEUTRAL = '#8d949c';

/* not everything is polished aluminium: pipes are scaled steel, leads and
   pucks are rubber — kill the metallic bloom that read exhaust as brass */
const PROPS = {
  emCeramic: [0.02, 0.32], emFilter: [0.0, 0.85], emAir: [0.30, 0.70],
  emExhaust: [0.30, 0.72], emLead: [0.05, 0.90], emPuck: [0.05, 0.95],
  emFuel: [0.10, 0.80], emThrottle: [0.10, 0.90], emIntake: [0.40, 0.60],
  emFirewall: [0.75, 0.35],
  emEsc: [0.30, 0.55], emPhase: [0.05, 0.80],    // anodised box, rubber HV
  emBottle: [0.0, 0.45],                          // plastic, a little sheen
  emCopper: [0.90, 0.38],                         // enamelled winding wire
};

/* ---- parameters ---------------------------------------------------------
   One dict drives engResolve AND the visual builder; unknown keys ride
   through, which is the module's own contract. */
const engDefaults = () => Object.assign(
  { bore: EG.ENG_DEFAULT.bore, stroke: EG.ENG_DEFAULT.stroke,
    rpm: EG.ENG_DEFAULT.rpm, cyl: 4, finN: EG.ENG_DEFAULT.finN,
    finR: EG.ENG_DEFAULT.finR,
    // the architecture axes are engResolve's OWN flags — mass and power
    // in the readout follow them because the physics reads the same dict
    twoStroke: EG.ENG_DEFAULT.twoStroke, liquid: EG.ENG_DEFAULT.liquid,
    geared: EG.ENG_DEFAULT.geared, arch: 'flat', finN: 14,
    // the electric fiche (G25) rides the same dict
    eStyle: EG.ENG_DEFAULT.eStyle, canD: EG.ENG_DEFAULT.canD,
    canL: EG.ENG_DEFAULT.canL, volts: EG.ENG_DEFAULT.volts,
    escOn: EG.ENG_DEFAULT.escOn },
  JSON.parse(JSON.stringify(EMOD.ENGM_DEFAULT)));

const IN = 0.0254;
// bore/stroke are the manufacturers' (audited G24.12): A-65 3.875x3.625in,
// O-200 4.0625x3.875in, IO-360 5.125x4.375in, Jabiru 97.5x74, VW 2180
// 92x82 (=2180cc), 912 79.5x61 (=1211cc), 277 72x68 (=277cc), 582 76x64
// (=581cc)
const PRESETS = {
  'continental A-65': {},
  'continental O-200': { bore: 4.0625 * IN, stroke: 3.875 * IN, rpm: 2750 },
  'lycoming IO-360': { bore: 5.125 * IN, stroke: 4.375 * IN, rpm: 2700,
    injected: 1, rodPos: 1 },
  'jabiru 2200': { bore: 0.0975, stroke: 0.074, rpm: 3300 },
  'VW 2180': { bore: 0.0922, stroke: 0.0818, rpm: 3200, genOn: 0,
    rockerSpan: 1 },
  'flat twin': { cyl: 2 },
  'flat six': { cyl: 6, exStyle: 2 },
  'rotax 912 (flat)': { bore: 0.0795, stroke: 0.0611, rpm: 5800,
    liquid: 1, geared: 1, airStyle: 1 },
  'rotax 277': { arch: 'inline', cyl: 1, twoStroke: 1, geared: 1,
    exStyle: 3, bore: 0.072, stroke: 0.068, rpm: 6250, finR: 1.5 },
  'rotax 582': { arch: 'inline', cyl: 2, twoStroke: 1, geared: 1,
    liquid: 1, exStyle: 3, bore: 0.076, stroke: 0.064, rpm: 6500 },
  // G157: the amateur radials. Bore and stroke are the real displacements
  // (2.25 L over seven, 3.61 L over nine — the published 2260 cc and 3600 cc),
  // and they take the R-1830's own radial treatment: no under-slung carb and
  // no airbox, because a radial breathes through its rear spider. The firewall
  // is sized from the engine the resolve actually builds — 0.59 m and 0.63 m
  // across the heads, measured, not guessed.
  'Verner Scarlett 7U': { arch: 'radial', cyl: 7, exStyle: 2,
    bore: 0.080, stroke: 0.064, rpm: 2350, finR: 1.3,
    fwW: 0.66, fwH: 0.66, carbOn: 0, airbox: 0, plumb: 0 },
  'Rotec R3600': { arch: 'radial', cyl: 9, exStyle: 2,
    bore: 0.088, stroke: 0.066, rpm: 2500, finR: 1.3,
    fwW: 0.72, fwH: 0.72, carbOn: 0, airbox: 0, plumb: 0 },
  'P&W R-1830': { arch: 'radial', cyl: 14, radialRows: 2, geared: 1,
    exStyle: 2, bore: 5.5 * IN, stroke: 5.5 * IN, rpm: 2700,
    finR: 1.4, mountGap: 1.2, fwW: 1.35, fwH: 1.35,
    // a radial breathes through its rear spider — no under-slung carb
    carbOn: 0, airbox: 0, plumb: 0 },
  // THE ELECTRIC LADDER (G25) — the registry's seven new rows plus the
  // anchor. Can dims are the manufacturers' where published (2212 = 28x26,
  // EMRAX 228 = 228x86, 268 would be 268x91, E-811 268 dia, SP260D 418
  // dia); volts are the real pack classes (3S/12S/e-PPG 24S, FES 116 V,
  // EMRAX 400 V, Velis 345 V, SP260D 580 V). The plate is per-aeroplane:
  // a park flyer's ply square up to a trainer bulkhead.
  'RC 2212 outrunner': { arch: 'electric', eStyle: 0, canD: 0.0278,
    canL: 0.026, rpm: 8500, volts: 11.1, fwW: 0.16, fwH: 0.14 },
  'RC 6374 outrunner': { arch: 'electric', eStyle: 0, canD: 0.063,
    canL: 0.074, rpm: 4600, volts: 44.4, fwW: 0.22, fwH: 0.20 },
  'e-PPG 12 kW': { arch: 'electric', eStyle: 0, canD: 0.208, canL: 0.115,
    rpm: 2600, volts: 88.8, fwW: 0.42, fwH: 0.42 },
  'FES sustainer': { arch: 'electric', eStyle: 0, canD: 0.20, canL: 0.09,
    rpm: 4500, volts: 116, fwW: 0.32, fwH: 0.32 },
  'EMRAX 228': { arch: 'electric', eStyle: 1, canD: 0.228, canL: 0.086,
    rpm: 5000, volts: 400, fwW: 0.60, fwH: 0.55 },
  'pipistrel E-811': { arch: 'electric', eStyle: 2, canD: 0.268, canL: 0.19,
    rpm: 2500, volts: 345, liquid: 1, fwW: 0.70, fwH: 0.65 },
  'SP260D-class': { arch: 'electric', eStyle: 2, canD: 0.418, canL: 0.30,
    rpm: 2500, volts: 580, liquid: 1, fwW: 0.85, fwH: 0.80 },
  'bare engine': { mount: 0, fwOn: 0, plumb: 0 },
};

// ---- the panel table (G31) ------------------------------------------------
// The bench's OWN groups, lifted verbatim so the cage editor's engine layer
// renders the same parameter surface — every row, same labels, same ranges.
// Row: [key, label, 'check' | 'drop' | lo, (opts | hi), step?, fmt?].
// A group may carry a `show` predicate over the parameter dict.
const mm = x => (x * 1000).toFixed(0);
const sFmt = x => x ? x : 'auto';
const isElec = p => p.arch === 'electric';
const isPiston = p => p.arch !== 'electric';
const ENG_GROUPS = [
  ['electric', [
    ['eStyle',  'style', 'drop', [[0, 'outrunner (RC / FES)'],
                                  [1, 'axial pancake (EMRAX)'],
                                  [2, 'housed (certified)']]],
    ['canD',    'can dia mm',    0.020, 0.450, 0.001, mm],
    ['canL',    'can length mm', 0.015, 0.350, 0.001, mm],
    ['rpm',     'rpm',           500, 12000, 50],
    ['volts',   'pack volts',    7, 800, 0.1, x => x.toFixed(0)],
    ['eFins',   'vents/ribs/fins', 0, 24, 1, sFmt],
    ['escOn',   'controller',    'check'],
    ['leads',   'phase cables',  'check'],
    ['plumb',   'DC pair',       'check'],
    ['liquid',  'liquid cooled', 'check'],
    ['geared',  'reduction drive', 'check'],
  ], isElec],
  ['polycount', [
    ['quality',    'density',      0.3, 2, 0.02],
    ['sideCyl',    'cyl sides',    0, 32, 2, sFmt],
    ['sideShaft',  'shaft sides',  0, 32, 2, sFmt],
    ['sideAcc',    'acc sides',    0, 32, 2, sFmt],
    ['sidePipe',   'pipe sides',   0, 32, 2, sFmt],
    ['sideDetail', 'detail sides', 0, 32, 2, sFmt],
    ['screws',     'screws',       'check'],
  ]],
  ['engine', [
    ['arch',    'layout',    'drop', [['flat', 'flat (boxer)'],
                                      ['inline', 'inline (2-stroke)'],
                                      ['radial', 'radial']]],
    ['cyl',     'cylinders', 'drop', [[1, 'single'], [2, 'twin'],
                                      [4, 'four'], [6, 'six'],
                                      [5, 'five (radial)'],
                                      [7, 'seven (radial)'],
                                      [9, 'nine (radial)'],
                                      [14, 'fourteen (radial)']]],
    ['radialRows', 'two-row radial', 'drop', [[1, 'one row'],
                                              [2, 'two rows']]],
    ['bore',    'bore mm',   0.05, 0.16, 0.001, mm],
    ['stroke',  'stroke mm', 0.04, 0.14, 0.001, mm],
    ['rpm',     'rpm',       1800, 6500, 50],
    ['stagger', 'stagger',   0, 0.5, 0.01],
  ], isPiston],
  ['architecture', [
    ['twoStroke', 'two-stroke',    'check'],
    ['liquid',    'liquid cooled', 'check'],
    ['geared',    'gearbox',       'check'],
  ], isPiston],
  ['cylinder dress', [
    ['finN',     'barrel fins', 4, 18, 1],
    ['finR',     'fin dia /b',  1.1, 1.7, 0.01],
    ['headFins', 'head fins',   0, 10, 1],
    ['rockerW',  'rocker w /b', 0.6, 1.2, 0.01],
    ['rockerH',  'rocker h /b', 0.4, 0.9, 0.01],
    ['rockerR',  'rocker corner', 0.10, 0.40, 0.01],
    ['rockerBoss', 'boss height', 0, 0.20, 0.01],
    ['rockerBossW', 'boss size', 0.30, 0.80, 0.01],
    ['rodPos',   'pushrods',    'drop', [[-1, 'below (Continental)'],
                                         [1, 'above (Lycoming)']]],
    ['finShape', 'barrel fin shape', 'drop', [[0, 'discs'],
                                              [1, 'square (912)']]],
    ['rockerSpan', 'bank rocker cover', 'check'],
    ['baseFins', 'barrel fins on', 'check'],
  ], isPiston],
  ['induction + exhaust', [
    ['injected','induction',  'drop', [[0, 'carburettor'],
                                       [1, 'fuel injection']]],
    ['airStyle','air filtration', 'drop', [[0, 'canister airbox'],
                                           [1, 'twin cones (912)']]],
    ['airbox',  'air filter', 'check'],
    ['intake',  'intake risers', 'check'],
    ['exStyle', 'exhaust',    'drop', [[0, 'off'], [1, 'stacks'],
                                       [2, 'collector'], [3, 'expansion']]],
    ['exDrop',  'stack drop', 0.6, 2.6, 0.02],
    // G155: the collector's OUTLET. Where the pipe leaves is a real choice on
    // a real aeroplane and was one hardcoded point here.
    ['exOut',   'collectors', 'drop', [[2, 'one under each bank'],
                                       [1, 'one, both banks into it']]],
    ['exAim',   'outlet points', 'drop', [[0, 'down'], [1, 'up'],
                                          [2, 'left'], [3, 'right']]],
    ['exOutX',  'outlet left/right', -2, 2, 0.05],
    ['exOutY',  'outlet up/down',    -2, 2, 0.05],
    ['exOutZ',  'outlet fore/aft',   -2, 2, 0.05],
  ], isPiston],
  ['ignition + accessories', [
    ['leads',   'plug leads', 'check'],
    ['leadR',   'lead r /b',  0.02, 0.06, 0.002],
    ['mags',    'magnetos',   'check'],
    ['genOn',   'alternator', 'check'],
    ['oilFill', 'oil filler', 'check'],
  ], isPiston],
  ['radiator (liquid)', [
    ['radX', 'lateral',   -1.0, 1.0, 0.02],
    ['radY', 'height +/-', -1.5, 1.6, 0.02],
    ['radZ', 'fore-aft',  -0.5, 2.5, 0.02],
    ['radW', 'width',     1.2, 3.5, 0.02],
    ['radH', 'core height', 0.4, 1.6, 0.02],
    ['radD', 'depth',     0.2, 0.8, 0.02],
  ], isPiston],
  ['engine bay', [
    ['starter',   'starter motor', 'check'],
    ['oilFilter', 'oil filter',    'check'],
    ['battOn',    'battery',       'check'],
    ['ecuOn',     'ECU box',       'check'],
  ], isPiston],
  ['services (entry points)', [
    ['fuelX', 'fuel entry x',     -0.9, 0.9, 0.01],
    ['fuelY', 'fuel entry y',     -0.9, 0.9, 0.01],
    ['thrX',  'throttle entry x', -0.9, 0.9, 0.01],
    ['thrY',  'throttle entry y', -0.9, 0.9, 0.01],
  ], isPiston],
  ['mount + firewall', [
    ['mount',    'mount',      'check'],
    ['mountX',   'diagonals',  'check'],
    ['mountGap', 'stand-off',  0.4, 2.0, 0.01],
    ['mountR',   'tube radius ×', 0.5, 2.2, 0.02],
    ['fwOn',     'firewall',   'check'],
    ['fwW',      'fw width m', 0.4, 1.4, 0.01, x => x.toFixed(2)],
    ['fwH',      'fw height m', 0.4, 1.4, 0.01, x => x.toFixed(2)],
    // 0.8..3.6 (was 1.1..2.2 — G32, the cage wants a wide fixation cage;
    // the fwPtsOf clamp eased with it)
    ['fwSpread', 'fw spread',  0.8, 3.6, 0.01],
    ['ruler',    'metre strip', 'check'],
    ['plumb',    'fuel+throttle', 'check'],
  ]],
];

window.ENG_PAGE = { COL, NEUTRAL, PROPS, engDefaults, PRESETS,
                    GROUPS: ENG_GROUPS, isElec, isPiston };
})();
