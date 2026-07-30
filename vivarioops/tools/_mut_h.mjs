// tools/_mut_h.mjs — mutation test for the Tier 0 hardening pass (H5–H8).
import { runMutants } from './_mutate.mjs';

const MUTANTS = [
  // H5 — the typed envelope
  ['trunk/store.js', "return Object.prototype.hasOwnProperty.call(SCHEMA_OF, prefix) ? prefix : 'opaque';",
   "return 'genome';", 'every key is treated as a genome again', 'N9'],
  ['trunk/store.js', '  record:   BRIDGE_V,', '  record:   GENOME_V,',
   'records stamped with the genome schema again', 'N9'],
  ['trunk/store.js', 'const step = MIGRATIONS.get(`${kind}:${k}`);', 'const step = MIGRATIONS.get(`genome:${k}`);',
   'every kind migrates through the genome chain', 'N10'],

  // H6 — genome hydration
  ['engine/l1/genome.js', 'if (!Array.isArray(n.joint?.angleLimits) || n.joint.angleLimits.length !== ANGLE_AXES) {',
   'if (false) {', 'missing angleLimits passes validation again', 'L1-5'],
  ['engine/l1/genome.js', "e.push(`connection ${c.id}: ${field} must be ${arity} values, got ${arr?.length ?? 'none'}`);",
   '', 'wrong-arity connection fields pass again', 'L1-5'],
  ['engine/l1/genome.js', 'if (!Number.isInteger(g.seed) || g.seed < 0 || g.seed > 0xFFFFFFFF)',
   'if (!Number.isInteger(g.seed) || g.seed < 0)', 'a seed above uint32 passes again', 'L1-5'],
  ['engine/l1/genome.js', '  const v = validateGenome(hydrated);\n  if (!v.ok) throw new Error(`genome is not valid: ${v.errors.join(\'; \')}`);\n  return hydrated;',
   '  return hydrated;', 'deserialise stops validating', 'L1-5'],
];

runMutants({ label: 'Tier 0 hardening', suiteModule: 'run-all.js', runner: 'runAll', mutants: MUTANTS });
