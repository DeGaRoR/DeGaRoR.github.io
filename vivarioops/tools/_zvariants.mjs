// tools/_zvariants.mjs — regenerate every instrumented copy of physics.js that
// the _z* diagnostics import. Run once after any edit to engine/l1/physics.js:
//
//     node tools/_zvariants.mjs
//
// Everything it writes is disposable and gitignorable: engine/l1/_z*.js.
// Nothing in engine/ is modified. If a replacement below fails to match, the
// anchor text in physics.js has moved — fix the anchor here, do not silence it.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const L1 = join(dirname(fileURLToPath(import.meta.url)), '..', 'engine', 'l1');
// physics.js has CRLF line endings; normalise so multi-line anchors match.
const SRC = readFileSync(join(L1, 'physics.js'), 'utf8').replace(/\r\n/g, '\n');

const DT_ANCHOR = 'export const FIXED_DT = 1 / 120;';
const IT_ANCHOR = 'export const SOLVER_ITERATIONS = 8;';
const OM_ANCHOR = 'export const OMEGA_MAX = 10;';
const APPLY_ANCHOR =
  '      rb.addForce({ x: fx * sc, y: fy * sc, z: fz * sc }, true);\n' +
  '      rb.addTorque({ x: tx * sc, y: ty * sc, z: tz * sc }, true);';

function must(s, needle, label) {
  const n = s.split(needle).length - 1;
  if (n !== 1) throw new Error(`anchor "${label}" matched ${n} times, expected 1`);
  return s;
}
must(SRC, DT_ANCHOR, 'FIXED_DT');
must(SRC, IT_ANCHOR, 'SOLVER_ITERATIONS');
must(SRC, APPLY_ANCHOR, 'addForce/addTorque');

const withDt = (s, d) => s.replace(DT_ANCHOR, `export const FIXED_DT = 1 / ${d};`);
const write = (name, body) => { writeFileSync(join(L1, `${name}.js`), body); return name; };
const made = [];

// ── 1. plain timestep variants ─────────────────────────────────────────────
// Used by: _zconv, _zdt, _zarm, _zfluid, _zdecay2, _zsolver, _zomega, _zverify
for (const d of [240, 480, 960]) made.push(write(`_zphys_${d}`, withDt(SRC, d)));

// ── 2. solver-iteration variants ───────────────────────────────────────────
// Used by: _zsolver. DISPROVEN ARM — kept so the negative can be re-run.
for (const n of [16, 32, 64, 128])
  made.push(write(`_zit_${n}`, SRC.replace(IT_ANCHOR, `export const SOLVER_ITERATIONS = ${n};`)));

// ── 3. semi-implicit drag patch ────────────────────────────────────────────
// Used by: _zv1, _zsolo4, _zverify. DISPROVEN ARM (0.622 -> 0.623, a no-op,
// because lambda_body*dt is only ~0.11). Kept so the negative can be re-run.
const SEMI_IMPLICIT = `      // DISPROVEN ARM — semi-implicit on the velocity-opposing component only.
      // Measured a no-op; see DESIGN §A1 "Disproven 2". Kept for re-testing.
      let ax = fx * sc, ay = fy * sc, az = fz * sc;
      const spd = Math.hypot(lv.x, lv.y, lv.z);
      if (spd > 1e-9) {
        const ux = lv.x / spd, uy = lv.y / spd, uz = lv.z / spd;
        const fpar = ax * ux + ay * uy + az * uz;          // < 0 when opposing v
        if (fpar < 0) {
          const g = 1 / (1 + (-fpar / (m * spd)) * FIXED_DT) - 1;
          ax += fpar * g * ux; ay += fpar * g * uy; az += fpar * g * uz;
        }
      }
      let bx = tx * sc, by = ty * sc, bz = tz * sc;
      const asp = Math.hypot(av.x, av.y, av.z);
      if (asp > 1e-9) {
        const ux = av.x / asp, uy = av.y / asp, uz = av.z / asp;
        const tpar = bx * ux + by * uy + bz * uz;
        if (tpar < 0) {
          const g = 1 / (1 + (-tpar / (I * asp)) * FIXED_DT) - 1;
          bx += tpar * g * ux; by += tpar * g * uy; bz += tpar * g * uz;
        }
      }
      rb.addForce({ x: ax, y: ay, z: az }, true);
      rb.addTorque({ x: bx, y: by, z: bz }, true);`;
const fixed = SRC.replace(APPLY_ANCHOR, SEMI_IMPLICIT);
for (const d of [120, 240, 480, 960])
  made.push(write(`_zfix_${d}`, d === 120 ? fixed : withDt(fixed, d)));

// ── 4. guard instrumentation ───────────────────────────────────────────────
// Used by: _zguard, _zguard2. DISPROVEN ARM (mean sc = 1.000, bind 0.0%).
const guard = SRC
  .replace('      if (!(sc > 0)) continue;',
           '      GUARD_N++; GUARD_SUM += sc; if (sc < 0.999) GUARD_BIND++;\n      if (!(sc > 0)) continue;')
  .replace(OM_ANCHOR, `${OM_ANCHOR}
export let GUARD_N = 0, GUARD_SUM = 0, GUARD_BIND = 0;
export function guardStats() { return { n: GUARD_N, mean: GUARD_N ? GUARD_SUM / GUARD_N : 1, bind: GUARD_N ? GUARD_BIND / GUARD_N : 0 }; }
export function guardReset() { GUARD_N = 0; GUARD_SUM = 0; GUARD_BIND = 0; }`);
for (const d of [120, 480])
  made.push(write(`_zguardphys_${d}`, d === 120 ? guard : withDt(guard, d)));

// ── 5. applied-force logger — RETIRED 2026-08-08, and this is the lesson ───
//
// `_zphlog` was a whole generated copy of physics.js whose only difference was
// three lines of logging. It is now a FLAG IN physics.js — `FLOG`, off by default
// and inert when off — so the variant is gone and `_zforce` imports the real
// module.
//
// WHY IT MATTERS BEYOND ONE FILE. Everything this generator writes is stale
// between runs, and the generator had not been run since Phase A. `_zphlog` on
// disk therefore had no `advancePhases`/`PHASE_COUPLE` — it simulated the
// PRE-PHASE-A open-loop controller — and `design/_zunits.mjs` imported it and put
// the resulting body length, mass, Reynolds and L/s figures into a design document
// as "a fresh corpus, this build". Nobody had done anything wrong except forget to
// re-run this file.
//
// So: A DIAGNOSTIC THAT CAN BE A FLAG SHOULD NOT BE A COPY. A copy is only worth
// it when the change cannot be expressed as a runtime option — a different
// FIXED_DT or SOLVER_ITERATIONS, which is what the variants above genuinely are.
// And run this generator after every physics.js edit; the variants are not
// versioned and nothing else will tell you they have drifted.

console.log(`regenerated ${made.length} variants in engine/l1/:`);
for (const m of made) console.log(`  ${m}.js`);
console.log('\nAll are disposable. Add to .gitignore:  engine/l1/_z*.js');
