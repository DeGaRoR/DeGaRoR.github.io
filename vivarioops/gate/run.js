// gate/run.js — CLI gate runner. `npm run gate`.
// 20 §6: one runner, invoked from the developer screen and from the build script.
//
// THE MANIFEST BELOW IS LOAD-BEARING. Without it, a suite that throws at import
// time, or an assertion someone deletes, produces a SMALLER run that still
// reports green. A gate whose scope is defined by whatever happened to load is
// not a gate. (Found at A1: planting a violation in trunk/store.js crashed the
// runner at import and printed no failures at all.)

const MANIFEST = {
  contracts:      ['C0', 'K1', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7', 'K8'],
  'trunk-static': ['N1', 'N2', 'N3', 'N5', 'N8', 'N14', 'N16', 'V1'],
  runtime:        ['R1', 'N9', 'N10', 'R4', 'R5'],
  l1:             ['L1-1', 'L1-2', 'L1-3', 'L1-4', 'L1-5', 'L1-6', 'L1-7', 'L1-8', 'L1-9', 'L1-10', 'N6', 'N20', 'L1-11', 'L1-12', 'L1-13', 'L1-14', 'L1-15', 'L1-16'],
  motion:         ['L1-17', 'L1-18', 'L1-19', 'L1-20', 'L1-21', 'L1-22'],
  breed:          ['L1-23', 'L1-24', 'L1-25', 'L1-26', 'L1-27', 'L1-28', 'L1-29', 'L1-30', 'L1-31', 'L1-32', 'L1-33'],
};

const LOADERS = {
  contracts:      async () => (await import('./contracts.js')).runContractGate(),
  'trunk-static': async () => (await import('./trunk.js')).runStaticGate(),
  runtime:        async () => (await import('./runtime.js')).runRuntimeGate(),
  l1:             async () => (await import('./l1.js')).runL1Gate(),
  motion:         async () => (await import('./motion.js')).runMotionGate(),
  breed:          async () => (await import('./breed.js')).runBreedGate(),
};

const ICON = { pass: 'PASS', fail: 'FAIL', pending: 'PEND' };

let passed = 0, failed = 0, pending = 0, checks = 0;
const obligations = [];

for (const [name, expected] of Object.entries(MANIFEST)) {
  console.log(`\n-- gate/${name} ------------------------------------------`);

  let r;
  try {
    r = await LOADERS[name]();
  } catch (e) {
    console.log(`  [FAIL] --  suite failed to load: ${e.message}`);
    console.log(`         >>> ${expected.length} assertion(s) did not run: ${expected.join(', ')}`);
    failed += expected.length;
    continue;
  }

  for (const a of r.results) {
    console.log(`  [${ICON[a.status]}] ${a.id}  ${a.title}${a.checks ? `  (${a.checks} checks)` : ''}`);
    if (a.note) console.log(`         note: ${a.note}`);
    for (const f of a.failures) console.log(`         >>> ${f}`);
  }

  const ran = new Set(r.results.map(a => a.id));
  const missing = expected.filter(id => !ran.has(id));
  const extra = [...ran].filter(id => !expected.includes(id));
  if (missing.length) {
    console.log(`  [FAIL] --  assertions missing from gate/${name}: ${missing.join(', ')}`);
    failed += missing.length;
  }
  if (extra.length) {
    console.log(`  [FAIL] --  assertions not in the manifest: ${extra.join(', ')} -- add them to gate/run.js`);
    failed += extra.length;
  }

  for (const d of r.diagnostics || []) console.log(`         diag: ${d}`);
  passed += r.passed; failed += r.failed; pending += r.pending; checks += r.checks;
  obligations.push(...r.obligations);
}

if (obligations.length) {
  console.log(`\n-- carried obligations -----------------------------------`);
  for (const o of obligations) console.log(`  - ${o}`);
}

console.log(`\n-- summary -----------------------------------------------`);
console.log(`  ${passed + failed + pending} assertions: ${passed} passed, ${failed} failed, ${pending} pending`);
console.log(`  ${checks} underlying checks`);
console.log(`  GATE ${failed === 0 ? 'GREEN' : 'RED'}\n`);
process.exit(failed === 0 ? 0 : 1);
