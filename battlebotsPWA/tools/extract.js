// tools/extract.js — engine.js est un FICHIER SOURCE (pwa/engine.js).
// Ici : validation (marqueurs, IIFE, autonomie) + artefact CommonJS pour les suites.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "pwa", "engine.js");
const OUT = path.join(ROOT, "engine.js");

const body = fs.readFileSync(SRC, "utf8");
if (!body.includes("// ENGINE-START") || !body.includes("// ENGINE-END")) {
  console.error("FATAL: marqueurs ENGINE-START/ENGINE-END absents de pwa/engine.js"); process.exit(1);
}
if (!/const ENGINE\s*=\s*\(\(\)\s*=>/.test(body)) {
  console.error("FATAL: le bloc ENGINE n'a pas la forme IIFE attendue"); process.exit(1);
}
// autonomie : le moteur ne doit référencer ni data.js ni app.js
for (const forbidden of ["STRINGS", "CHASSIS_SPRITES", "TIER_BY_ID"]) {
  if (new RegExp("\\b" + forbidden + "\\b").test(body)) {
    console.error("FATAL: engine.js référence " + forbidden + " (dépendance interdite)"); process.exit(1);
  }
}
fs.writeFileSync(OUT, body + "\nmodule.exports = ENGINE;\n");

const E = require(OUT);
const need = ["makeMatch","tick","runHeadless","derivedStats","statBars","genOpponent","genTournament",
              "tendencyKey","CHASSIS","OPTS","DEFAULT_BUILD","SLICE1","PARTS","partOf",
              "ARENA_R","TICK","SUDDEN_DEATH_T","PHYS","physStats","partMassKg"];
const missing = need.filter(k => E[k] === undefined);
if (missing.length) { console.error("FATAL: exports manquants:", missing.join(", ")); process.exit(1); }
console.log(`extract: pwa/engine.js validé, ${need.length} exports OK`);
