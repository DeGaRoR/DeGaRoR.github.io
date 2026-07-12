"use strict";
/* tools/qc.js — engine QC runner (reconstructed 2026-07-12).
 * Extracts the @ENGINE-START@/@ENGINE-END@ + @TESTS-START@/@TESTS-END@ blocks from the
 * single-file build, evaluates them under a DOM-free stub (the engine is pure), and runs
 * every suite in QC_SUITES. Each suite gets a `t` recorder: t.ok(cond,msg) / t.report(msg).
 * Exit 0 if all assertions pass, 1 otherwise. This is the engine-scope gate. */
const fs = require("fs");
const proj = require("./_load.js").load(process.argv[2] || __dirname + "/..");
const engine = proj.engine, tests = proj.tests;

// DOM-free stubs: the engine is pure but restoreGame/career paths may touch localStorage.
const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};
const noop = () => {};
const document = new Proxy({}, { get: () => noop });
const window = new Proxy({ localStorage }, { get(t, p) { return p in t ? t[p] : noop; } });

let SUITES;
try {
  SUITES = new Function(
    "localStorage", "document", "window",
    engine + "\n;\n" + tests + "\n;return QC_SUITES;"
  )(localStorage, document, window);
} catch (err) {
  console.error("QC LOAD FAIL:", err.stack.split("\n").slice(0, 5).join("\n"));
  process.exit(1);
}

let pass = 0, fail = 0;
const failures = [];
for (const name in SUITES) {
  const t = {
    ok(cond, msg) { if (cond) { pass++; } else { fail++; failures.push(name + " :: " + msg); } },
    report(msg) { /* informational */ if (process.env.QC_VERBOSE) console.log("  · [" + name + "] " + msg); },
  };
  try {
    SUITES[name](t);
  } catch (err) {
    fail++;
    failures.push(name + " :: THREW " + (err && err.message));
  }
}

if (failures.length) {
  console.error("QC FAILURES (" + failures.length + "):");
  for (const f of failures) console.error("  FAIL " + f);
}
console.log("QC: " + pass + " checks passed, " + fail + " failed (" + Object.keys(SUITES).length + " suites).");
process.exit(fail ? 1 : 0);
