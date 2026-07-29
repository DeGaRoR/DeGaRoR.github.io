/* S16-CRASH — fuzz des flux de combat par le VRAI chemin UI.
   Chaque scénario tourne dans CE processus mais borné par le parent (timeout
   exec) : une boucle infinie devient un timeout identifiable au lieu d'un
   gel silencieux. Usage :
     node tools/fuzz_flows.js child <scenario>   (un scénario)
     node tools/fuzz_flows.js                    (orchestrateur, tous)
   Scénarios : mode × motif de résultats (V=win L=loss), saisons complètes,
   avec clics ovMain répétés y compris après fin de saison/retraite. */
const { execFileSync } = require("child_process");
const path = require("path");

const SCENARIOS = [];
for (const mode of ["qual", "exhib", "tour"])
  for (const pat of ["VVVVVVVV", "LLLLLLLL", "VLVLVLVL", "LLVVLLVV"])
    SCENARIOS.push({ kind: "libre", mode, pat });
for (const cid of ["sumoS", "sparS", "lightM"])
  for (const pat of ["VVVVVVVVVVVV", "LLLLLLLLLLLL", "VLLVLLVVVLLV"])
    SCENARIOS.push({ kind: "championnat", cid, pat });
for (const cid of ["cupS", "cupM"])
  for (const pat of ["VVVVV", "LVVVV", "VVL"])
    SCENARIOS.push({ kind: "bracket", cid, pat });

function runChild(sc) {
  const { openWorld } = require(path.join(__dirname, "world.js"));
  const w = openWorld();
  const label = JSON.stringify(sc);
  try {
    if (sc.kind !== "libre" || /S$/.test(sc.cid || "")) { /* classe selon concours */ }
    if (sc.cid && /S$/.test(sc.cid)) w.eval(`AB().chassis="tortue_s";`);
    w.eval(`S.bolts = 1e6; S.beaten = 99;`);
    if (sc.kind !== "libre") {
      const ok = w.eval(`JSON.stringify(engageConcours(${JSON.stringify(sc.cid)}))`);
      if (!JSON.parse(ok).ok) { console.log("SKIP " + label + " engagement " + ok); w.close(); return; }
      w.eval(`curVsConcours = ${JSON.stringify(sc.cid)};`);
    }
    const mode = sc.kind === "libre" ? sc.mode : sc.kind;
    for (let i = 0; i < sc.pat.length; i++) {
      const win = sc.pat[i] === "V";
      // le concours peut être terminé : on tente quand même le clic (c'est le fuzz)
      w.eval(`try{ startMatch(${JSON.stringify(mode)}); }catch(e){ throw new Error("startMatch: "+e.message); }`);
      // refus propre (concours terminé) : pas de nouveau match → fin de scénario, c'est le comportement voulu
      if (!w.eval(`!!(match && !match.over)`)) { console.log("fin propre " + label + " (manche " + i + ")"); w.close(); return; }
      w.eval(`while(!match.over) ENGINE.tick(match); match.winner = ${win ? 0 : 1};`);
      w.eval(`endToDebrief();`);
      w.eval(`$("ovMain").onclick();`);
      w.eval(`$("ovMain").onclick();`);            // double-clic nerveux (mobile)
      w.step(3);
      if (w.errors.length) break;
    }
    if (w.errors.length) console.log("ERREURS " + label + " → " + w.errors.slice(0, 2).join(" | "));
    else console.log("ok " + label);
  } catch (e) {
    console.log("EXCEPTION " + label + " → " + e.message.slice(0, 160));
  }
  w.close();
}

if (process.argv[2] === "child") {
  runChild(JSON.parse(process.argv[3]));
} else {
  let bad = 0;
  for (const sc of SCENARIOS) {
    try {
      const out = execFileSync(process.execPath, [__filename, "child", JSON.stringify(sc)],
                               { timeout: 60000, encoding: "utf8" });
      process.stdout.write(out);
      if (/ERREURS|EXCEPTION/.test(out)) bad++;
    } catch (e) {
      bad++;
      console.log((e.killed ? "GEL (timeout 60s) " : "CRASH PROCESSUS ") + JSON.stringify(sc)
                  + (e.stdout ? " | " + String(e.stdout).slice(-160) : ""));
    }
  }
  console.log("\nFUZZ: " + SCENARIOS.length + " scénarios, " + bad + " anomalie(s)");
  process.exit(bad ? 1 : 0);
}
