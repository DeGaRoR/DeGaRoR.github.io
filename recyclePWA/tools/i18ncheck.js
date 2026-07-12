// tools/i18ncheck.js — translation coverage gate.
// Every tr("...") literal in shipping code (outside test blocks) must resolve to a French entry
// in LANG.fr, OR be an intentional self-map (technical terms identical in FR). Exit 1 on any gap.
const fs = require("fs");
const proj = require("./_load.js").load(process.argv[2] || __dirname + "/..");
const code = proj.shipping; // shipping code only (tests never load in the browser)

// resolve the LANG.fr dictionary
let LANG;
eval(code.match(/const LANG=\{[\s\S]*?\n\};/)[0].replace("const LANG=", "LANG = "));
const fr = LANG.fr;

// collect every tr("...") / tr('...') literal, resolved through JS escapes
const lits = new Set();
const re = /tr\(\s*(["'])((?:\\.|(?!\1).)*)\1/g;
let m;
while ((m = re.exec(code))) { try { lits.add(eval(m[1] + m[2] + m[1])); } catch (e) {} }

// technical terms deliberately identical in French
const selfOK = new Set(["Bunker", "Feeder", "Bulk", "Phase", "Film", "Alu", "Mode", "Tonnage", "PET", "PVC", "NIR"]);

const missing = [...lits].filter(s => !(s in fr) && !selfOK.has(s));
// also flag any FR value that still contains a literal "\u" escape (double-escaped display bug)
const badVal = Object.entries(fr).filter(([k, v]) => typeof v === "string" && /\\u[0-9a-fA-F]{4}/.test(v)).map(([k]) => k);

if (missing.length || badVal.length) {
  if (missing.length) {
    console.error("MISSING FR (" + missing.length + "):");
    for (const s of missing.sort()) console.error("  - " + JSON.stringify(s));
  }
  if (badVal.length) {
    console.error("DOUBLE-ESCAPED FR VALUES (" + badVal.length + "):");
    for (const s of badVal.sort()) console.error("  - " + JSON.stringify(s));
  }
  process.exit(1);
}
console.log("I18N: " + lits.size + " tr() literals, all covered (fr).");
