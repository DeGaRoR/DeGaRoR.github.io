// tools/temoin.js — LE MATCH-TÉMOIN.
//
//   node tools/temoin.js --generer   régénère tools/temoin.json (acte DÉLIBÉRÉ)
//   node tools/temoin.js             vérifie — c'est ce que la porte appelle
//
// À quoi ça sert. Le chantier pilote va découper `control()` en perception,
// décision et actionnement. Un refactor de cette taille se juge à une seule
// question : le jeu joue-t-il EXACTEMENT pareil ? Le témoin y répond au tick
// près, sur 200 matchs de graines fixes.
//
// Ce qui est figé, et pourquoi chaque champ compte :
//
//   winner / reason / t / duels  l'issue. Nécessaire, très insuffisant : deux
//                                pilotes différents gagnent souvent pareil.
//   ticks                        la durée en pas de simulation.
//   draws[0] / draws[1]          le nombre de TIRAGES D'ALÉA consommés PAR BOT.
//                                C'est le champ le plus traître du lot : la
//                                consommation dépend du MODE — `escape` et
//                                `hold` sortent de control() avant le tremblé
//                                de conduite et ne tirent rien. Un refactor qui
//                                déplacerait le tirage hors de ces branches
//                                garderait des issues identiques pendant des
//                                dizaines de matchs, puis désynchroniserait
//                                tout, sans que rien ne l'explique.
//   sig                          empreinte de TOUTES les transitions de mode,
//                                des deux bots, avec leur tick. C'est le champ
//                                sensible : il change dès qu'un bot pense
//                                différemment, même s'il gagne pareil.
//
// Les builds sont HYDRATÉS (colliders, CG, longerons) à la génération et
// stockés tels quels : la vérification rejoue la vraie géométrie de jeu sans
// avoir besoin de jsdom, donc reste rapide et utilisable dans la porte.

const fs = require("fs");
const path = require("path");
const E = require(path.join(__dirname, "engine.cjs"));   // artefact CommonJS produit par extract.js

const REF = path.join(__dirname, "temoin.json");
const N_CAS = 200;
const SEED0 = 2654435761;

/* ─────────────────── le jeu de builds du témoin ─────────────────── */
/* Choisis pour COUVRIR les branches de control(), pas pour être équilibrés :
   une embuscade (mode hold, zéro tirage), un logiciel v3 face à un lourd
   (mode escape), un contre (mode orbit), des gardes au bord opposées, les
   deux classes et leurs deux rings. Un témoin qui n'exerce qu'une branche ne
   protège qu'une branche. */
const CAS_BUILDS = [
  // -- classe M --
  { cl:"M", ch:"boxy",    over:{ motor:"m2", battery:"b1", propulsion:"pr1", cpu:"c1", sensors:"n1" },
    pilot:{ strategy:"adaptive", aggression:"balanced", edgeGuard:"normal" } },
  { cl:"M", ch:"marteau", over:{ motor:"m3", battery:"b1", propulsion:"pr1", cpu:"c2", sensors:"n2", software:"s2" },
    pilot:{ strategy:"pressure", aggression:"fierce", edgeGuard:"daredevil", power:"torque" } },
  { cl:"M", ch:"tortue",  over:{ motor:"m1", propulsion:"pr1", cpu:"c0", sensors:"n0" },
    pilot:{ strategy:"ambush", aggression:"cautious", edgeGuard:"fearful", chargeDist:"short" } },
  { cl:"M", ch:"losange", over:{ motor:"m2", battery:"b1", propulsion:"pr2", cpu:"c1", sensors:"n1", software:"s1" },
    pilot:{ strategy:"counter", aggression:"balanced", approach:"flank", handling:"nervous" } },
  { cl:"M", ch:"fleche",  over:{ motor:"m4", battery:"b1", propulsion:"pr2", cpu:"c2", sensors:"n2", software:"s2" },
    pilot:{ strategy:"pressure", aggression:"fierce", approach:"opportunist", power:"speed", handling:"drift" } },
  { cl:"M", ch:"boxy",    over:{ motor:"m0", battery:"b0", propulsion:"pr0", cpu:"c0", sensors:"n0" },
    pilot:{ strategy:"adaptive", aggression:"cautious", edgeGuard:"fearful", chargeDist:"long" } },
  // -- classe S (petit ring : la garde au bord et la cage y jouent bien plus) --
  { cl:"S", ch:"tortue_s", over:{ propulsion:"pr4" },
    pilot:{ strategy:"adaptive", aggression:"balanced", edgeGuard:"normal" } },
  { cl:"S", ch:"hex_s",    over:{ motor:"m5", propulsion:"pr6", cpu:"c1", sensors:"n1" },
    pilot:{ strategy:"pressure", aggression:"fierce", edgeGuard:"daredevil" } },
  { cl:"S", ch:"coin_s",   over:{ motor:"m6", propulsion:"pr7", cpu:"c1", sensors:"n1", software:"s1" },
    pilot:{ strategy:"ambush", aggression:"cautious", chargeDist:"short" } },
  { cl:"S", ch:"losange_s",over:{ motor:"m5", propulsion:"pr5", srimech:"r3", software:"s2" },
    pilot:{ strategy:"counter", aggression:"balanced", approach:"flank" } },
  { cl:"S", ch:"totem_s",  over:{ motor:"m6", propulsion:"pr8", cpu:"c2", sensors:"n2", software:"s2" },
    pilot:{ strategy:"pressure", aggression:"fierce", power:"torque", approach:"opportunist" } },
  { cl:"S", ch:"tortue_s", over:{ propulsion:"pr9", ballast:"l1" },
    pilot:{ strategy:"adaptive", aggression:"balanced", edgeGuard:"fearful", handling:"drift" } },
];

const RING_CM = { S: 60, M: 145 }, CM_PER_UNIT = 3 / 6.2;
const ringOf = (cl) => (RING_CM[cl] || RING_CM.M) / CM_PER_UNIT / 2;

/* ─────────────────── mesure d'un cas ─────────────────── */
/* Empreinte FNV-1a des transitions de mode. 32 bits suffisent : on cherche à
   détecter une différence, pas à résister à un adversaire. */
function fnv(str){
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

function joue(seed, A, B, ringR){
  const m = E.makeMatch(seed, A, B, { arenaR: ringR });
  /* On compte les tirages SANS toucher au moteur : chaque bot porte son propre
     flux depuis S22, on l'enveloppe ici. Le flux de match (m.rng) ne sert plus
     qu'au spawn, on le compte aussi — un changement de spawn doit se voir. */
  const draws = [0, 0]; let mDraws = 0;
  m.bots.forEach((bot, i) => { const brut = bot.rng; bot.rng = () => { draws[i]++; return brut(); }; });
  { const brut = m.rng; m.rng = () => { mDraws++; return brut(); }; }

  const modes = []; let ticks = 0;
  let prev = [m.bots[0].mode, m.bots[1].mode];
  let garde = 0;
  while (!m.over && garde++ < 20000){
    E.tick(m); ticks++;
    for (let i = 0; i < 2; i++){
      const md = m.bots[i].mode;
      if (md !== prev[i]){ modes.push(m.n + ":" + i + ":" + md); prev[i] = md; }
    }
  }
  return {
    winner: m.winner, reason: m.reason,
    t: +m.t.toFixed(6), duels: m.duels.slice(), ticks,
    draws, mDraws, sig: fnv(modes.join("|")), nModes: modes.length,
  };
}

/* ─────────────────── génération (jsdom, une fois) ─────────────────── */
async function generer(){
  const { openWorld } = require("./world.js");
  const w = openWorld({});
  const builds = CAS_BUILDS.map((c) => {
    const raw = w.eval(`(function(){
      const parts = {};
      for (const sl in ENGINE.PARTS) parts[sl] = OPTIONAL_SLOTS[sl] ? null : ENGINE.PARTS[sl][0].id;
      Object.assign(parts, ${JSON.stringify(c.over)});
      const b = { chassis:${JSON.stringify(c.ch)}, parts, counts:{} };
      const L = autoArrange(b);
      if (!L || L.__nofit || !layoutValid(b, L)) return JSON.stringify({ nofit:true });
      return JSON.stringify({ parts, colliders: buildColliders(b, L),
        stability: computeCG(b, L).stability, beamCells: beamCellsOf(b, L) });})()`);
    const h = JSON.parse(raw);
    if (h.nofit) throw new Error("le build témoin " + c.ch + " ne loge pas — corrige-le AVANT de figer");
    return { ...E.SLICE1.playerBuild, ...c.pilot, chassis: c.ch, parts: h.parts, counts: {},
             colliders: h.colliders, stability: h.stability, beamCells: h.beamCells, __cl: c.cl };
  });
  w.close();

  const cas = [];
  for (let k = 0; k < N_CAS; k++){
    /* Appariements DÉTERMINISTES et intra-classe (on ne fait jamais combattre
       un S contre un M : ce n'est pas le jeu, et le ring serait faux). */
    const memeClasse = (i, j) => builds[i].__cl === builds[j].__cl;
    let i = k % builds.length, j = (k * 7 + 3) % builds.length, garde = 0;
    while ((i === j || !memeClasse(i, j)) && garde++ < 50) j = (j + 1) % builds.length;
    const seed = (Math.imul(k + 1, SEED0) >>> 0) || 1;
    const r = joue(seed, builds[i], builds[j], ringOf(builds[i].__cl));
    cas.push({ k, seed, a: i, b: j, ...r });
  }
  const doc = { version: 1, engineRev: revMoteur(), n: cas.length, builds, cas };
  fs.writeFileSync(REF, JSON.stringify(doc));
  return doc;
}

/* Tampon de révision moteur : une empreinte du fichier engine.js. Il ne SERT
   pas à invalider (le témoin doit justement survivre à un refactor sans
   changement de comportement) — il sert à DATER la référence dans le rapport. */
function revMoteur(){
  try { return fnv(fs.readFileSync(path.join(__dirname, "..", "engine.js"), "utf8")); }
  catch(e){ return "?"; }
}

/* ─────────────────── vérification (pure, sans DOM) ─────────────────── */
const CHAMPS = ["winner","reason","t","ticks","mDraws","sig","nModes"];
function verifier(){
  if (!fs.existsSync(REF)) return { ok:false, absent:true, ecarts:[] };
  const doc = JSON.parse(fs.readFileSync(REF, "utf8"));
  const ecarts = [];
  for (const c of doc.cas){
    const A = doc.builds[c.a], B = doc.builds[c.b];
    const r = joue(c.seed, A, B, ringOf(A.__cl));
    for (const f of CHAMPS)
      if (r[f] !== c[f]) ecarts.push(`cas ${c.k} (${A.chassis} vs ${B.chassis}) ${f}: ${c[f]} → ${r[f]}`);
    if (r.duels.join() !== c.duels.join())
      ecarts.push(`cas ${c.k} duels: ${c.duels} → ${r.duels}`);
    if (r.draws.join() !== c.draws.join())
      ecarts.push(`cas ${c.k} tirages par bot: ${c.draws} → ${r.draws}`);
    if (ecarts.length > 12) break;                 // au-delà, la liste n'aide plus
  }
  return { ok: ecarts.length === 0, ecarts, n: doc.cas.length, rev: doc.engineRev };
}

module.exports = { verifier, generer, joue, N_CAS, REF };

/* ─────────────────────────── CLI ─────────────────────────── */
if (require.main === module){
  if (process.argv.includes("--generer")){
    generer().then((doc) => {
      const modes = doc.cas.reduce((n, c) => n + c.nModes, 0);
      const tirages = doc.cas.reduce((n, c) => n + c.draws[0] + c.draws[1], 0);
      console.log(`témoin figé : ${doc.n} cas · ${doc.builds.length} builds hydratés`);
      console.log(`  ${modes} transitions de mode · ${tirages} tirages d'aléa comptés`);
      console.log(`  révision moteur ${doc.engineRev} · ${REF}`);
      console.log("\n  ⚠ Régénérer le témoin EFFACE le filet. À ne faire que lorsqu'un");
      console.log("    changement de comportement est VOULU, assumé et mesuré.");
    }).catch(e => { console.error("FATAL:", e.message); process.exit(1); });
  } else {
    const r = verifier();
    if (r.absent){ console.error("FATAL: témoin absent — `node tools/temoin.js --generer`"); process.exit(1); }
    console.log(r.ok ? `témoin: ${r.n} cas rejoués à l'identique (révision ${r.rev})`
                     : `témoin: ${r.ecarts.length}+ ÉCART(S)\n  ` + r.ecarts.join("\n  "));
    process.exit(r.ok ? 0 : 1);
  }
}
