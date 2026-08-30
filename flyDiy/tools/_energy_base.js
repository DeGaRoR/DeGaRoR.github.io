#!/usr/bin/env node
// GATE ENERGYBASE — the energy module moved no existing aeroplane (G97-G101).
//
//   node tools/_energy_base.js            -> "GATE ENERGYBASE: PASS|FAIL"
//   node tools/_energy_base.js --bless    -> rewrite the baseline (see below)
//   node tools/_energy_base.js --show     -> print the frozen numbers
//
// WHY THIS EXISTS, AND WHY IT IS THE FIRST FILE OF THE ARC. P4 replaces
// `spec.fuel = {litres, tank}` with a section that carries real vessels, bumps
// GEN_SPEC_V 5 -> 6, and ships a migrator. Every aeroplane already saved — the
// stock build, the shelf designs, the user's own exports — goes through that
// migrator, and the ONE thing it must not do is move any of them.
//
// "Move" is not a thing anybody can see. A migration that landed the Cub's
// twelve gallons two rings aft would change the CG by a few centimetres, shift
// the main gear (genFrame places it against the CG), change the static margin,
// and look completely normal. So the aeroplanes are FROZEN AS NUMBERS, before
// the change, and the change is measured against them. Same instrument as
// GATE WINGSPLIT (G67.1), G4.4's mirror check and G48's join: a refactor that
// cannot be measured is a rewrite, whatever it is called.
//
// WHAT IS FROZEN, per case:
//   cg0        the mass centre and total mass, to a micrometre / milligram
//   nodes      a digest over EVERY node mass and EVERY node position — not a
//              sample. Two errors that cancel in the CG do not cancel here,
//              and the gear placement reads the whole lattice.
//   ledger     every section's mass, cost and payload flag. The empty/payload
//              split is exactly what this arc rewrites (a battery is empty
//              weight, fuel is payload), so a case that changes it silently is
//              the failure mode with teeth.
//   access     the fitting list: key and count. The fuel cap, the wing cap and
//              the drain all key off `tank` / `fuelL`, which become derived
//              aliases. If the aliases are right, this list does not move; if
//              they are wrong, the aeroplane loses its filler cap and nothing
//              else says so.
//
// --bless REWRITES THE BASELINE, and it is not a way to make this gate quiet.
// It is for the one case it was built for: a DELIBERATE change to what an
// aeroplane weighs or where its mass sits, where the new numbers are the new
// truth and the diff in git is the record of it.
//
// NEGATIVE VERIFICATION: `--selftest` nudges one gram onto one node, one litre
// into the tank, and one section's ledger entry, and requires each to be
// caught. A digest that cannot fail is not a digest.
'use strict';
const fs = require('fs');
const path = require('path');

const CORE = require(path.join(__dirname, 'flight_core.js'));
const { resolveSpec, clampSpec, genFrame, genAccessNeeds, genAccessList,
        GEN_DEFAULT } = CORE;

const BASE = path.join(__dirname, '_energy_base.json');
const BLESS = process.argv.includes('--bless');
const SHOW = process.argv.includes('--show');
const SELFTEST = process.argv.includes('--selftest');

const merge = (a, b) => {
  const o = JSON.parse(JSON.stringify(a));
  for (const k in b) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]))
    ? merge(o[k] || {}, b[k]) : b[k];
  return o;
};

// THE CASES. Each varies something the energy module touches, and each was
// chosen because it exercises a branch the others do not: the three tank
// stations, both ends of the litres clamp, the seating layouts (which decide
// which rings the crew mass lands on), the cargo bay (which moves the tail
// arm), an electric powerplant (whose battery is the whole point of the arc),
// and the two materials at the ends of the density range.
//
// A CASE LIST THAT DOES NOT VARY WHAT IT CLAIMS TO VARY is the same failure as
// a test whose failure looks like its pass — so `--show` prints the cg0 of
// every case and any two that match are a bug in this list, not a coincidence.
const CASES = [
  ['stock', {}],
  // 70, not 50: GEN_DEFAULT is already a 50 litre nose tank, so `{litres:50,
  // tank:'nose'}` restates the stock aeroplane and freezes it twice. The
  // duplicate check below caught exactly that on the first bless.
  ['nose tank', { fuel: { litres: 70, tank: 'nose' } }],
  ['wing tank', { fuel: { litres: 50, tank: 'wing' } }],
  ['panel tank', { fuel: { litres: 90, tank: 'panel' } }],
  ['dry', { fuel: { litres: 0, tank: 'nose' } }],
  ['brimmed', { fuel: { litres: 140, tank: 'wing' } }],
  ['side by side', { cabin: { seating: 'side2', pilots: 2 } }],
  // two-up, so the second occupant lands on F[2] — the tandem rear ring. A
  // solo tandem IS the stock aeroplane and froze nothing.
  ['tandem two-up', { cabin: { seating: 'tandem2', pilots: 2 } }],
  ['freighter', { cargo: { len: 0.9, kg: 120 }, cabin: { baggage: 40 } }],
  ['ifr panel', { systems: { fit: 'ifr' } }],
  ['electric', { engines: [{ type: 'e811_velis', mount: 'nose',
                             place: { dx: 0, dy: 0 } }] }],
  ['alloy', { fuselage: { material: 'alloy' } }],
  ['carbon', { fuselage: { material: 'carbon' } }],
  ['tricycle', { gear: { type: 'tricycle' } }],
];

// FNV-1a over the floats, quantised to a micrometre — the same function GATE
// WINGSPLIT uses, and for the same reason. Bit-exact would also fail on a
// compiler reordering that changed nothing anybody could measure; a micrometre
// on an aeroplane is not a change by any definition.
function digest(arr, h) {
  h = h === undefined ? 0x811c9dc5 : h;
  if (!arr) return h;
  for (let i = 0; i < arr.length; i++) {
    const v = Math.round(arr[i] * 1e6) | 0;
    for (let b = 0; b < 4; b++) {
      h ^= (v >>> (b * 8)) & 255;
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

const r6 = v => Math.round(v * 1e6) / 1e6;
const r3 = v => Math.round(v * 1e3) / 1e3;

// one case -> the frozen record. `nudge` is the selftest's hook and is never
// set in anger.
function measure(over, nudge) {
  const spec0 = merge(JSON.parse(JSON.stringify(GEN_DEFAULT)), over);
  // THE LITRE GOES IN BEFORE resolveSpec, and the first version of this probe
  // put it after — where it changed nothing, because `61_gen_frame` reads the
  // FLAT alias `S.fuelL` that `genAlias` derives during resolveSpec, not
  // `S.fuel.litres`. That is G48's lesson arriving unprompted: flat aliases are
  // derived, so anything written past the resolve is a write to a key nothing
  // consumes. The v6 migrator must write the SECTION and let the alias derive.
  if (nudge === 'litre') spec0.fuel.litres += 1;
  const spec = clampSpec(spec0);
  const RS = resolveSpec(spec);
  const S = RS.spec;
  const fr = genFrame(S);
  if (nudge === 'gram') fr.nodes[0].m += 0.001;
  // the ledger rides on `parts`, not on the frame's own root
  const ledger = fr.parts.ledger;
  if (nudge === 'ledger' && ledger.fuel) ledger.fuel.mass += 0.001;

  const cg = nudge === 'gram' || nudge === 'ledger'
    ? (() => { let x = 0, y = 0, z = 0, m = 0;
        for (const n of fr.nodes) { x += n.p[0]*n.m; y += n.p[1]*n.m; z += n.p[2]*n.m; m += n.m; }
        return [x/m, y/m, z/m, m]; })()
    : fr.cg0;

  const mass = [], pos = [];
  for (const n of fr.nodes) { mass.push(n.m); pos.push(n.p[0], n.p[1], n.p[2]); }

  const led = {};
  for (const k of Object.keys(ledger).sort()) {
    const e = ledger[k];
    led[k] = [r3(e.mass), Math.round(e.cost), e.payload ? 1 : 0];
  }

  // the fittings the aeroplane asks for. genAccessNeeds REQUIRES a resolved
  // spec — cabin.h, cabin.len and fuselage.tailArm are null in GEN_DEFAULT and
  // null means "derive it" (the G48 lesson, and GATE FIT's `derived` counter
  // exists for exactly this).
  const R = genAccessNeeds(S);
  const acc = genAccessList(R).map(r => r.key + ':' + r.n).sort();

  return {
    cg: [r6(cg[0]), r6(cg[1]), r6(cg[2]), r6(cg[3])],
    n: fr.nodes.length,
    mass: digest(mass),
    pos: digest(pos),
    ledger: led,
    access: acc,
    derived: R.derived === undefined ? -1 : R.derived,
  };
}

function capture(nudge, only) {
  const out = {};
  for (const [name, over] of CASES) {
    if (only && name !== only) continue;
    out[name] = measure(over, nudge);
  }
  return out;
}

// ---------------------------------------------------------------------------
const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};

if (BLESS) {
  const now = capture();
  fs.writeFileSync(BASE, JSON.stringify(now, null, 1) + '\n');
  console.log('  blessed ' + Object.keys(now).length + ' cases -> ' +
              path.basename(BASE));
  for (const k of Object.keys(now))
    console.log('    ' + k.padEnd(14) + ' ' + now[k].cg[3].toFixed(1) + ' kg  cg ' +
                now[k].cg[0].toFixed(4) + '  ' + now[k].access.length + ' fittings');
  console.log('GATE ENERGYBASE: PASS');
  process.exit(0);
}

if (!fs.existsSync(BASE)) {
  console.log('  no baseline at ' + path.basename(BASE) + ' — run --bless first');
  console.log('GATE ENERGYBASE: FAIL');
  process.exit(1);
}

const base = JSON.parse(fs.readFileSync(BASE, 'utf8'));
const now = capture();

if (SHOW) {
  for (const k of Object.keys(now))
    console.log('  ' + k.padEnd(14) + ' ' + now[k].cg[3].toFixed(1) + ' kg  cg [' +
                now[k].cg.slice(0, 3).map(v => v.toFixed(4)).join(', ') + ']  ' +
                now[k].n + ' nodes  ' + now[k].access.length + ' fittings');
}

// every frozen case must still exist, and no case may have quietly appeared
check(Object.keys(base).sort().join(',') === Object.keys(now).sort().join(','),
      'the case list changed', 'baseline has ' + Object.keys(base).length +
      ', this run has ' + Object.keys(now).length);

for (const k of Object.keys(base)) {
  const a = base[k], b = now[k];
  if (!b) continue;
  check(JSON.stringify(a.cg) === JSON.stringify(b.cg), k + ': cg0 moved',
        JSON.stringify(a.cg) + ' -> ' + JSON.stringify(b.cg));
  check(a.n === b.n, k + ': node count changed', a.n + ' -> ' + b.n);
  check(a.mass === b.mass, k + ': node masses moved');
  check(a.pos === b.pos, k + ': node positions moved');
  check(JSON.stringify(a.ledger) === JSON.stringify(b.ledger), k + ': ledger moved');
  check(JSON.stringify(a.access) === JSON.stringify(b.access),
        k + ': the fitting list moved',
        a.access.join(' ') + ' -> ' + b.access.join(' '));
  check(a.derived === b.derived, k + ': the derived counter moved',
        a.derived + ' -> ' + b.derived);
}

// no two cases may be the same aeroplane — otherwise this list is not
// measuring the spread it claims to
const seen = new Map();
for (const k of Object.keys(now)) {
  const sig = now[k].mass + '/' + now[k].pos;
  if (seen.has(sig)) check(false, 'cases "' + seen.get(sig) + '" and "' + k +
    '" are the same aeroplane', 'the case list does not vary what it claims to');
  seen.set(sig, k);
}

if (SELFTEST) {
  // each nudge must be CAUGHT by the comparison above. A digest that cannot
  // fail is not a digest.
  const probes = [
    ['one gram on one node', 'gram'],
    ['one litre in the tank', 'litre'],
    ['one gram in the ledger', 'ledger'],
  ];
  for (const [label, nudge] of probes) {
    const bad = capture(nudge, 'stock').stock;
    const b0 = base.stock;
    const caught = JSON.stringify(bad.cg) !== JSON.stringify(b0.cg) ||
                   bad.mass !== b0.mass || bad.pos !== b0.pos ||
                   JSON.stringify(bad.ledger) !== JSON.stringify(b0.ledger) ||
                   JSON.stringify(bad.access) !== JSON.stringify(b0.access);
    check(caught, 'SELFTEST not caught: ' + label);
  }
  console.log('  selftest: ' + probes.length + ' negative probes');
}

console.log('  ' + Object.keys(now).length + ' aeroplanes held against the baseline, ' +
            Object.values(now).reduce((s, c) => s + c.n, 0) + ' nodes, ' +
            Object.values(now).reduce((s, c) => s + c.access.length, 0) + ' fittings');
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE ENERGYBASE: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
