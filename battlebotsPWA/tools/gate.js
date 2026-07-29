// tools/gate.js — the single command. Green means 0. Anything else blocks delivery.
//   node tools/gate.js         run everything
//   node tools/gate.js ui      run only suites whose name matches
const { execFileSync } = require("child_process");
const path = require("path");

const SUITES = [
  ["pwa",      "qc_pwa.js",      30_000],
  ["extract",  "extract.js",     30_000],
  ["moteur",   "qc_engine.js",  240_000],
  ["éditeur",  "qc_editor.js",  600_000],
  ["interface","qc_ui.js",      300_000],
  ["parcours", "qc_journeys.js",600_000],
  ["économie", "qc_econ.js", 120_000],
];

const filter = process.argv[2];
const verbose = process.argv.includes("-v");
let totalFails = 0;
const rows = [];

for (const [name, file, timeout] of SUITES) {
  if (filter && !name.includes(filter) && !file.includes(filter)) continue;
  const t0 = Date.now();
  let out = "", code = 0;
  try {
    out = execFileSync(process.execPath, [path.join(__dirname, file)],
                       { encoding: "utf8", timeout, cwd: path.join(__dirname, "..") });
  } catch (e) {
    out = (e.stdout || "") + (e.stderr || "");
    code = e.status == null ? 1 : e.status;
    if (e.signal) out += `\n[interrompu: ${e.signal} après ${timeout / 1000}s]`;
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  const m = out.match(/ÉCHECS \((\d+)\)/);
  const fails = m ? +m[1] : (code ? 1 : 0);
  const passed = (out.match(/^OK   /gm) || []).length;
  totalFails += fails;
  rows.push({ name, fails, passed, secs });

  if (verbose || fails) process.stdout.write(out.split("\n").filter(l => verbose || !l.startsWith("OK   ")).join("\n") + "\n");
}

console.log("\n" + "=".repeat(52));
for (const r of rows)
  console.log(`  ${r.fails ? "✗" : "✓"} ${r.name.padEnd(11)} ${String(r.passed).padStart(3)} OK   ${String(r.fails).padStart(2)} échecs   ${r.secs}s`);
console.log("=".repeat(52));
console.log(`PORTE: ÉCHECS (${totalFails})`);
process.exit(totalFails ? 1 : 0);
