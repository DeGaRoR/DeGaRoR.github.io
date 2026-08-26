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

window.ENG_PAGE = { COL, NEUTRAL, PROPS, engDefaults, PRESETS };
})();
