// ENGINE GENERATOR — THE VERDICT. Runs the model against the registry's real
// engines and prints both, the way gen_ap_probe.js does for the garage: this
// is an INSTRUMENT, not a bound. It fails only on things that are actually
// wrong (a broken mesh, a negative mass), never on a percentage.
//
//   node tools/_eng_check.js
//
// The reference column is REAL published data for each engine — bore, stroke,
// cylinders, rpm — and the registry's own mass and power. Nothing here is
// tuned to make a row look good; where the model disagrees, the disagreement
// is the finding.
'use strict';
const path = require('path');
const { engResolve, engBuild, ENG_ARCH,
        ENG_AIM, engAimDeg, ENG_DEFAULT } = require('./_eng_gen.js');

const IN = 0.0254;
// bore/stroke/rpm are the manufacturers'; mass and power are the REGISTRY's,
// so the model is being asked to reproduce the numbers the fleet already flies.
const REF = [
  { key: 'a65_sensenich74', name: 'Continental A-65', arch: 'flat', cyl: 4,
    bore: 3.875 * IN, stroke: 3.625 * IN, rpm: 2300, mass: 80, powerW: 48500 },
  { key: 'o200_eprops', name: 'Continental O-200-A', arch: 'flat', cyl: 4,
    bore: 4.0625 * IN, stroke: 3.875 * IN, rpm: 2750, mass: 85, powerW: 74600 },
  { key: 'io360_mccauley', name: 'Lycoming IO-360-L2A', arch: 'flat', cyl: 4,
    bore: 5.125 * IN, stroke: 4.375 * IN, rpm: 2700, mass: 138, powerW: 134000 },
  { key: 'jabiru2200_std', name: 'Jabiru 2200A', arch: 'flat', cyl: 4,
    bore: 0.0975, stroke: 0.074, rpm: 3300, mass: 60, powerW: 63000 },
  { key: 'vw2180_wood', name: 'VW 2180 conversion', arch: 'flat', cyl: 4,
    bore: 0.0922, stroke: 0.0818, rpm: 3200, mass: 66, powerW: 44000 },
  { key: 'rotax912_warp', name: 'Rotax 912 UL', arch: 'flat', cyl: 4,
    bore: 0.079, stroke: 0.0611, rpm: 5800, mass: 58, powerW: 59600,
    geared: 1, liquid: 1 },
  { key: 'r1830_hs23e50', name: 'P&W R-1830 Twin Wasp', arch: 'radial', cyl: 9,
    bore: 5.5 * IN, stroke: 5.5 * IN, rpm: 2700, mass: 750, powerW: 895000,
    rows: 2 },
];

const pct = (a, b) => (100 * (a - b) / b);
const f = (x, n) => x.toFixed(n === undefined ? 1 : n);
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

let fail = 0;
const hard = (label, cond, extra) => {
  if (!cond) { fail++; console.log('  FAIL ' + label + (extra ? '  ' + extra : '')); }
};

console.log('ENGINE MODEL vs THE REGISTRY');
console.log('(reference bore/stroke/rpm are the manufacturers\'; mass and power' +
            ' are 00_registry.js)');
console.log();
console.log(pad('engine', 22) + padL('litres', 8) + padL('kW ref', 8) +
            padL('kW mod', 8) + padL('err', 7) + padL('kg ref', 8) +
            padL('kg mod', 8) + padL('err', 7) + padL('kg/L', 7));
console.log('-'.repeat(83));

const errP = [], errM = [];
for (const r of REF) {
  // A TWIN-ROW radial is two rows of `cyl`; the model builds one row, so the
  // reference is doubled here rather than the model being bent to fit.
  const rows = r.rows || 1;
  const R = engResolve({ arch: r.arch, cyl: r.cyl, bore: r.bore,
                         stroke: r.stroke, rpm: r.rpm,
                         geared: r.geared || 0, liquid: r.liquid || 0 });
  const powerW = R.powerW * rows, mass = R.mass * rows;
  const litres = R.litres * rows;
  const eP = pct(powerW, r.powerW), eM = pct(mass, r.mass);
  errP.push(Math.abs(eP)); errM.push(Math.abs(eM));
  console.log(pad(r.name + (rows > 1 ? ' x2row' : ''), 22) +
    padL(f(litres, 2), 8) +
    padL(f(r.powerW / 1000), 8) + padL(f(powerW / 1000), 8) +
    padL((eP >= 0 ? '+' : '') + f(eP, 0) + '%', 7) +
    padL(f(r.mass), 8) + padL(f(mass), 8) +
    padL((eM >= 0 ? '+' : '') + f(eM, 0) + '%', 7) +
    padL(f(r.mass / litres), 7));
  hard(r.name + ': positive mass', mass > 0);
  hard(r.name + ': positive power', powerW > 0);
}
const mean = a => a.reduce((s, v) => s + v, 0) / a.length;
console.log('-'.repeat(83));
console.log('mean |power err| ' + f(mean(errP)) + '%   ' +
            'mean |mass err| ' + f(mean(errM)) + '%');

// ---- envelope + CG, which is what the cowl and the balance need ----------
console.log();
console.log('ENVELOPE AND CG (metres, about the thrustline; z = 0 is the flange face)');
console.log(pad('engine', 22) + padL('width', 8) + padL('height', 8) +
            padL('length', 8) + padL('radius', 8) + padL('cg z', 8));
console.log('-'.repeat(62));
for (const r of REF) {
  const R = engResolve({ arch: r.arch, cyl: r.cyl, bore: r.bore,
                         stroke: r.stroke, rpm: r.rpm });
  const e = R.env;
  console.log(pad(r.name, 22) + padL(f(e.width, 3), 8) + padL(f(e.height, 3), 8) +
    padL(f(e.length, 3), 8) + padL(f(e.radius, 3), 8) + padL(f(R.cgZ, 3), 8));
  hard(r.name + ': envelope is positive', e.width > 0 && e.height > 0 && e.length > 0);
  hard(r.name + ': CG is behind the flange', R.cgZ < 0, 'cgZ=' + f(R.cgZ, 3));
  hard(r.name + ': CG is inside the engine', R.cgZ > e.z0,
       'cgZ=' + f(R.cgZ, 3) + ' z0=' + f(e.z0, 3));
}

// ---- the architectures all build, and differ ----------------------------
console.log();
console.log('ARCHITECTURES (same 2.8 litres in every layout)');
console.log(pad('family', 22) + padL('cyl', 5) + padL('kW', 8) +
            padL('kg', 8) + padL('width', 8) + padL('height', 8) +
            padL('length', 8) + padL('verts', 8) + padL('quads', 8));
console.log('-'.repeat(83));
const shapes = [];
for (const [key, A] of Object.entries(ENG_ARCH)) {
  for (const n of A.counts) {
    if (key === 'electric') continue;
    // hold displacement at 2.8 L so the COMPARISON is of layout, not of size
    const target = 2.8e-3 / n;
    const bore = Math.cbrt(target / (Math.PI / 4) / 0.95);
    const R = engResolve({ arch: key, cyl: n, bore, stroke: bore * 0.95,
                           rpm: 2500 });
    const M = engBuild({ arch: key, cyl: n, bore, stroke: bore * 0.95,
                         rpm: 2500 });
    console.log(pad(A.name, 22) + padL(n, 5) + padL(f(R.powerW / 1000), 8) +
      padL(f(R.mass), 8) + padL(f(R.env.width, 3), 8) +
      padL(f(R.env.height, 3), 8) + padL(f(R.env.length, 3), 8) +
      padL(M.V.length, 8) + padL(M.F.length, 8));
    hard(A.name + ' ' + n + ': mesh built', M.V.length > 0 && M.F.length > 0);
    hard(A.name + ' ' + n + ': every face is a quad of real verts',
         M.F.every(q => q.v.length === 4 &&
           q.v.every(i => i >= 0 && i < M.V.length)));
    hard(A.name + ' ' + n + ': every vertex is finite',
         M.V.every(p => p.every(c => isFinite(c))));
    hard(A.name + ' ' + n + ': every face has a material',
         M.F.every(q => !!q.m));
    shapes.push({ key, n, w: R.env.width, h: R.env.height, l: R.env.length });
  }
}
// the point of having families at all: they must not be the same shape
const rad = shapes.find(s => s.key === 'radial');
const inl = shapes.find(s => s.key === 'inline');
const flat = shapes.find(s => s.key === 'flat' && s.n === 4);
hard('a radial is shorter than an inline of the same size', rad.l < inl.l,
     f(rad.l, 3) + ' vs ' + f(inl.l, 3));
hard('a radial is wider than an inline', rad.w > inl.w,
     f(rad.w, 3) + ' vs ' + f(inl.w, 3));
hard('a flat four is wider than it is tall', flat.w > flat.h,
     f(flat.w, 3) + ' vs ' + f(flat.h, 3));
hard('an inline is taller than it is wide', inl.h > inl.w,
     f(inl.h, 3) + ' vs ' + f(inl.w, 3));

// ---- THE AIM TURNS THE ENVELOPE, AND THE ENVELOPE IS WHAT THE COWL FITS ---
// (G164, the user's "in line engine choice up/down/r/l".) This is the whole
// claim of the feature stated as arithmetic: a bank pointing up or down makes
// a NARROW DEEP engine and a bank pointing left or right makes a WIDE SHALLOW
// one, and `engResolve` measures both off the same placement rule the mesh
// draws from. If this ever stopped holding, a cowl would be built around a
// shape the engine does not have — which is exactly the defect G163 closed.
{
  const inlAt = i => engResolve({ arch: 'inline', cyl: 4, inlineAim: i });
  const nm = i => ENG_AIM[i].name;
  for (const i of [0, 1]) {                     // down, up
    const e = inlAt(i).env;
    hard('an inline aimed ' + nm(i) + ' is deeper than it is wide',
         e.height > e.width, f(e.height, 3) + ' vs ' + f(e.width, 3));
  }
  for (const i of [2, 3]) {                     // left, right
    const e = inlAt(i).env;
    hard('an inline aimed ' + nm(i) + ' is wider than it is deep',
         e.width > e.height, f(e.width, 3) + ' vs ' + f(e.height, 3));
  }
  // AND THE DEFAULT IS THE ENGINE THAT WAS ALREADY THERE. A default that
  // drifted would repaint every saved in-line without anyone asking.
  hard('the default aim is straight up',
       engAimDeg(ENG_DEFAULT.inlineAim) === 0,
       'deg ' + engAimDeg(ENG_DEFAULT.inlineAim));
  const dflt = engResolve({ arch: 'inline', cyl: 4 }).env;
  const up = inlAt(1).env;
  hard('an inline with no aim named draws the upright one',
       dflt.width === up.width && dflt.height === up.height);
  // THE TABLE AND THE ANGLE ARE THE SAME FACT. `engAimDeg` turns a direction
  // into an angle about the crank; walking it back through (sin, cos) has to
  // land on the direction it came from, or 'left' and 'right' have quietly
  // swapped and nothing else would notice.
  for (let i = 0; i < ENG_AIM.length; i++) {
    const r = engAimDeg(i) * Math.PI / 180;
    hard('the aim table and its angle agree about ' + nm(i),
         Math.abs(Math.sin(r) - ENG_AIM[i].v[0]) < 1e-9 &&
         Math.abs(Math.cos(r) - ENG_AIM[i].v[1]) < 1e-9,
         '[' + f(Math.sin(r), 3) + ', ' + f(Math.cos(r), 3) + '] vs [' +
         ENG_AIM[i].v + ']');
  }
}

// ---- the knobs move the right things ------------------------------------
const base = engResolve({});
const geared = engResolve({ geared: 1 });
const liquid = engResolve({ liquid: 1 });
const twoS = engResolve({ twoStroke: 1 });
const bigBore = engResolve({ bore: ENG_DEFAULT_BORE() * 1.1 });
function ENG_DEFAULT_BORE() { return require('./_eng_gen.js').ENG_DEFAULT.bore; }
hard('a gearbox adds mass', geared.mass > base.mass);
hard('a water jacket adds mass', liquid.mass > base.mass);
hard('a two-stroke of the same size makes more power', twoS.powerW > base.powerW);
hard('a bigger bore makes more power and more mass',
     bigBore.powerW > base.powerW && bigBore.mass > base.mass);
hard('displacement is the geometry', Math.abs(base.litres -
     1000 * Math.PI / 4 * base.P.bore ** 2 * base.P.stroke * 4) < 1e-9);

// ---- ELECTRIC (G25) -------------------------------------------------------
// The reference rows are REAL published machines — can dimensions, rpm,
// CONTINUOUS torque and dry motor mass (no controller: escOn 0 here, so the
// mass column is the motor law alone). The model gets only the caliper
// numbers; torque, power and mass are its to earn. Same instrument rule:
// disagreement is the finding, not a fail.
//   Data notes: RC "ratings" are bursts, so cont torque is the honest column
//   and runs ~55-60% of the sticker. FES publishes 22 kW MAX — the model's
//   cont reading low there is the burst/cont gap showing, not an error.
//   The SP260D is the DECLARED outlier of the mass law (a Siemens record
//   one-off at 5.2 kW/kg); it stays in the table so the outlier stays seen.
console.log();
console.log('ELECTRIC MODEL vs REAL MACHINES (torque/mass continuous, motor only)');
console.log(pad('motor', 24) + padL('can mm', 9) + padL('Nm ref', 8) +
            padL('Nm mod', 8) + padL('err', 7) + padL('kW mod', 8) +
            padL('kg ref', 8) + padL('kg mod', 8) + padL('err', 7));
console.log('-'.repeat(87));
const REF_E = [
  { name: '2212 outrunner', style: 0, canD: 0.0278, canL: 0.026, rpm: 8500,
    torque: 0.16, mass: 0.057 },
  { name: '6374 outrunner', style: 0, canD: 0.063, canL: 0.074, rpm: 4600,
    torque: 2.5, mass: 0.72 },
  { name: 'M50-class e-PPG', style: 0, canD: 0.208, canL: 0.115, rpm: 2600,
    torque: 45, mass: 6.2 },
  { name: 'FES (LZ Design)', style: 0, canD: 0.20, canL: 0.09, rpm: 4500,
    torque: 47, mass: 7.3 },
  { name: 'EMRAX 228', style: 1, canD: 0.228, canL: 0.086, rpm: 5000,
    torque: 96, mass: 12.3 },
  { name: 'EMRAX 268', style: 1, canD: 0.268, canL: 0.091, rpm: 4500,
    torque: 200, mass: 20.3 },
  { name: 'Pipistrel E-811', style: 2, canD: 0.268, canL: 0.19, rpm: 2500,
    liquid: 1, torque: 220, mass: 22.7 },
  { name: 'SP260D (outlier)', style: 2, canD: 0.418, canL: 0.30, rpm: 2500,
    liquid: 1, torque: 1000, mass: 50 },
];
const errT = [], errEM = [];
for (const r of REF_E) {
  const R = engResolve({ arch: 'electric', eStyle: r.style, canD: r.canD,
                         canL: r.canL, rpm: r.rpm, liquid: r.liquid || 0,
                         escOn: 0 });
  const eT = pct(R.torque, r.torque), eM = pct(R.mass, r.mass);
  errT.push(Math.abs(eT)); errEM.push(Math.abs(eM));
  console.log(pad(r.name, 24) +
    padL(f(r.canD * 1000, 0) + 'x' + f(r.canL * 1000, 0), 9) +
    padL(f(r.torque, r.torque < 1 ? 2 : 0), 8) +
    padL(f(R.torque, R.torque < 1 ? 2 : 0), 8) +
    padL((eT >= 0 ? '+' : '') + f(eT, 0) + '%', 7) +
    padL(f(R.powerW / 1000, R.powerW < 2000 ? 2 : 1), 8) +
    padL(f(r.mass, r.mass < 1 ? 3 : 1), 8) +
    padL(f(R.mass, R.mass < 1 ? 3 : 1), 8) +
    padL((eM >= 0 ? '+' : '') + f(eM, 0) + '%', 7));
  hard(r.name + ': positive torque/power/mass',
       R.torque > 0 && R.powerW > 0 && R.mass > 0);
  hard(r.name + ': envelope is positive',
       R.env.width > 0 && R.env.height > 0 && R.env.length > 0);
  hard(r.name + ': CG is behind the flange and inside the motor',
       R.cgZ < 0 && R.cgZ > R.env.z0, 'cgZ=' + f(R.cgZ, 3));
}
console.log('-'.repeat(87));
console.log('mean |torque err| ' + f(mean(errT)) + '%   ' +
            'mean |mass err| ' + f(mean(errEM)) + '%');

// the electric knobs move the right things
{
  const e0 = engResolve({ arch: 'electric' });
  const big = engResolve({ arch: 'electric', canD: 0.0278 * 1.2 });
  const fast = engResolve({ arch: 'electric', rpm: 8500 * 1.3 });
  const liq = engResolve({ arch: 'electric', liquid: 1 });
  const noEsc = engResolve({ arch: 'electric', escOn: 0 });
  hard('electric anchor is the 2212 (spec-silent rpm defaults 8500)',
       e0.rpm === 8500 && Math.abs(e0.motorMass - 0.057) < 0.015,
       f(e0.motorMass, 3) + ' kg');
  hard('a bigger can makes more torque and more mass',
       big.torque > e0.torque && big.mass > e0.mass);
  hard('rpm buys power, not torque',
       Math.abs(fast.torque - e0.torque) < 1e-12 && fast.powerW > e0.powerW);
  hard('liquid cooling buys shear (power up, mass up a little)',
       liq.torque > e0.torque && liq.mass > e0.mass);
  hard('the controller is a declared addition', noEsc.mass < e0.mass);
  hard('electric torque is the geometry', Math.abs(e0.torque -
       2 * e0.sigma * Math.PI / 4 * e0.place.rotorD ** 2 * e0.place.rotorL)
       < 1e-12);
}

console.log();
console.log('A-65 identity (the fleet\'s anchor): ' +
  f(base.litres, 2) + ' L, ' + f(base.powerW / 1000) + ' kW, ' +
  f(base.mass) + ' kg  (registry: 2.80 L, 48.5 kW, 80 kg)');
{
  const e = engResolve({ arch: 'electric' });
  console.log('2212 identity (the electric anchor): ' +
    f(e.torque, 2) + ' Nm, ' + f(e.powerW, 0) + ' W cont / ' +
    f(e.powerPeakW, 0) + ' W burst, ' + f(e.motorMass * 1000, 0) +
    ' g motor  (registry: 180 W, 100 g w/ mount+ESC)');
}

// ---- THE IN-LINE ROW IS FITTED NOW, AND THIS IS THE FIT (G165) -----------
// `kM` and `bmep` carried "UNVALIDATED — there is no registry example" from
// the day they were written. There are two now, both well documented, and the
// numbers in the table were chosen against them — so the table's claim is
// checkable and this is the check. The bands are the fit's OWN residuals
// rounded out, not aspirations: mass is the weak half (the shared exponent
// over-predicts big engines and under-predicts small ones, which two points
// cannot honestly correct), and power is the strong one.
{
  const REAL = [
    ['Walter Mikron III', { bore: 0.090, stroke: 0.096, cyl: 4, rpm: 2600 }, 48000, 74],
    ['Gipsy Major 1',     { bore: 0.118, stroke: 0.140, cyl: 4, rpm: 2100 }, 97000, 139],
  ];
  for (const [nm, s, pw, kg] of REAL) {
    const r = engResolve(Object.assign({ arch: 'inline', twoStroke: 0 }, s));
    const em = 100 * (r.mass - kg) / kg, ep = 100 * (r.powerW - pw) / pw;
    hard('the in-line mass law is within 10% on ' + nm,
         Math.abs(em) <= 10, f(r.mass, 1) + ' kg vs ' + kg + ' (' + f(em, 1) + '%)');
    hard('the in-line bmep is within 6% on ' + nm,
         Math.abs(ep) <= 6,
         f(r.powerW / 1000, 1) + ' kW vs ' + (pw / 1000) + ' (' + f(ep, 1) + '%)');
  }
  // and the row must not go back to calling itself a guess
  const fs3 = require('fs');
  const GEN = fs3.readFileSync(path.join(__dirname, '_eng_gen.js'), 'utf8');
  // THE MARKER IS A TRAILING COMMENT ON THE DEFINITION LINE — the way `vee`
  // still carries it — so this looks THERE and not in the prose, which is
  // allowed to say what the row used to be. Pinning the word anywhere in the
  // row failed on this chantier's own comment explaining that it no longer
  // applies, which is a check reading the story instead of the fact.
  const defLine = GEN.slice(GEN.indexOf("    name: 'Inline'")).split('\n')[0];
  hard('the in-line row still marks itself unvalidated',
       defLine.indexOf('UNVALIDATED') < 0, defLine.trim());
}

// ---- ONE TABLE OF DIRECTIONS (G164) --------------------------------------
// The exhaust OUTLET and the in-line BANK both answer "which way does it
// point", and before this row they answered from two different literals. An
// index that means 'left' in one row and 'right' in the other is a defect no
// picture would explain and no other check would catch, so both derive from
// ENG_AIM and the panel generates BOTH drops from it.
{
  const fs2 = require('fs');
  const rd = f2 => fs2.readFileSync(path.join(__dirname, f2), 'utf8');
  const MESH = rd('_eng_mesh.js'), PAGE = rd('_eng_page.js');
  hard('aim: the mesh keeps its own copy of the four directions',
       MESH.indexOf('const AIM = [[0, -1], [0, 1], [-1, 0], [1, 0]]') < 0);
  hard('aim: the exhaust outlet does not read the shared table',
       MESH.indexOf('EG.ENG_AIM[') >= 0);
  const nGen = PAGE.split('EG.ENG_AIM.map(').length - 1;
  hard('aim: a "points" row types its own option list instead of generating ' +
       'it from the table', nGen === 2, nGen + ' of 2 generated');
}
console.log(fail ? '\nENG CHECK: FAIL (' + fail + ')' : '\nENG CHECK: OK');
process.exit(fail ? 1 : 0);
