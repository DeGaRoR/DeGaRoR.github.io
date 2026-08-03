// tools/bench.js — BANC DE MESURE (outil manuel, HORS PORTE).
//
//   node tools/bench.js miroir     [--classe S|M] [--n 150]
//   node tools/bench.js poignees   [--classe S|M] [--n 100]
//   node tools/bench.js logiciels  [--classe S|M] [--n 150]
//   node tools/bench.js niveaux    [--classe S|M] [--n 100]
//   node tools/bench.js duel --a '{"motor":"m2"}' --b '{"motor":"m0"}' [--classe M]
//   node tools/bench.js duel --ficheA '<fiche exportée du jeu>' --ficheB '<fiche>'
//
// Trois règles, et c'est tout l'intérêt de l'outil :
//
//  1. HYDRATER OU REFUSER. Un build est passé par l'éditeur réel (autoArrange,
//     layoutValid, buildColliders, computeCG, beamCellsOf) avant d'entrer en
//     piste. Ce qui ne loge pas dans la coque n'est pas mesuré — il n'existe
//     pas. Sans cette règle on mesure des bots imaginaires (le « trio S »
//     à 1,36 kg n'entre dans aucune coque S).
//  2. LES DEUX CÔTÉS. Chaque graine est jouée A-à-gauche PUIS A-à-droite. Le
//     côté de spawn vaut aujourd'hui 8 à 12 points : une mesure d'un seul côté
//     mesure le spawn, pas le build.
//  3. LE TÉMOIN À CÔTÉ. Toute comparaison affiche le MIROIR de la référence
//     (le même build contre lui-même). Tant que ce témoin n'est pas à 50 %,
//     l'écart mesuré doit se lire avec cette réserve, affichée noir sur blanc.
//
// Déterministe : même graine de base → mêmes chiffres, à la décimale.

const path = require("path");
const { openWorld } = require("./world.js");
const E = require(path.join(__dirname, "engine.cjs"));   // artefact CommonJS produit par extract.js

/* ─────────────────────────── arguments ─────────────────────────── */
const ARGV = process.argv.slice(2);
const CMD = ARGV[0] || "aide";
const opt = (name, def) => { const i = ARGV.indexOf("--" + name);
  return i >= 0 && ARGV[i + 1] != null ? ARGV[i + 1] : def; };
const N = Math.max(10, parseInt(opt("n", 0), 10) || 0) || null;
const SEED0 = parseInt(opt("seed", "104729"), 10);
const CLASSE = (opt("classe", "M") + "").toUpperCase() === "S" ? "S" : "M";

/* ───────────────────── hydratation par l'éditeur ───────────────────── */
/* Un seul monde jsdom pour toute la session : ouvrir un monde coûte ~1 s,
   jouer un match coûte ~10 ms. On hydrate, on ferme, on mesure. */
let W = null;
const openHydrator = () => (W = W || openWorld({}));
const closeHydrator = () => { if (W) { W.close(); W = null; } };

/* hydrate(chassis, over, pilot, tolerer) → build prêt pour le moteur.
   Par défaut REFUSE un build qui ne loge pas : un bot que l'éditeur n'assemble
   pas n'a pas à figurer dans une mesure. `tolerer` sert aux adversaires
   GÉNÉRÉS, que le jeu, lui, fait combattre : depuis la garde S21 leur hitbox
   retombe sur la coque seule, donc ils sont mesurables — et le compte de
   « ne loge pas » devient un indicateur de qualité du générateur.
   `over` ne cite que les slots qu'on change ; le reste prend le stock, et les
   slots optionnels prennent null (exactement comme S.parts.equipped). */
function hydrate(chassis, over, pilot, tolerer) {
  const w = openHydrator();
  const raw = w.eval(`(function(){
    const parts = {};
    for (const sl in ENGINE.PARTS) parts[sl] = OPTIONAL_SLOTS[sl] ? null : ENGINE.PARTS[sl][0].id;
    Object.assign(parts, ${JSON.stringify(over || {})});
    const b = { chassis:${JSON.stringify(chassis)}, parts, counts:{} };
    const L = autoArrange(b);
    const nofit = !L || !!L.__nofit || !layoutValid(b, L);
    if (nofit && !${tolerer ? "true" : "false"}) return JSON.stringify({ nofit:true });
    return JSON.stringify({ nofit,
      parts, colliders: buildColliders(b, L), stability: computeCG(b, L).stability,
      beamCells: beamCellsOf(b, L), kg: ENGINE.physStats(b).massKg,
      classe: chassisClassOf(${JSON.stringify(chassis)}) });})()`);
  const h = JSON.parse(raw);
  if (h.nofit && !tolerer) return { nofit: true, chassis, over };
  return { __nofit: !!h.nofit, ...E.SLICE1.playerBuild, ...(pilot || {}), chassis, parts: h.parts, counts: {},
    colliders: h.colliders, stability: h.stability, beamCells: h.beamCells,
    __kg: h.kg, __classe: h.classe };
}

/* advGenere — l'adversaire tel que le JEU le fabrique, pas tel que le moteur
   le tire. Depuis S23 l'app répare les builds qui ne logent pas (le moteur
   ignore les empreintes) : mesurer `ENGINE.genOpponent` en direct reviendrait
   à mesurer des adversaires que personne n'affronte. Le banc passe donc par
   `genOpponentFit`, dans le monde qui sert déjà à l'hydratation. */
function advGenere(seed, level, cid) {
  const w = openHydrator();
  return JSON.parse(w.eval(`(function(){
    const g = genOpponentFit(${seed | 0}, ${level | 0}, opponentOpts(${JSON.stringify(cid)}));
    return JSON.stringify({ build: g.build, archetype: g.archetype, loge: fitsOnHull(g.build) });})()`));
}

/* Le ring vient de la CLASSE, comme en jeu (CLASS_RING / CM_PER_UNIT). */
const RING_CM = { S: 60, M: 145 };
const CM_PER_UNIT = 3 / 6.2;
const ringOf = (cl) => (RING_CM[cl] || RING_CM.M) / CM_PER_UNIT / 2;

/* ─────────────────────────── statistiques ─────────────────────────── */
/* Intervalle de Wilson à 95 % : sur 200 matchs, ±7 points. Un écart annoncé
   sans son intervalle n'est pas une mesure, c'est une impression. */
function wilson(w, n) {
  if (!n) return [0, 0];
  const z = 1.959964, p = w / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const r = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return [Math.max(0, c - r) * 100, Math.min(1, c + r) * 100];
}

/* ──────────────────────────── le duel ──────────────────────────── */
/* Chaque graine jouée des DEUX côtés. Retourne le taux de victoire de A,
   son intervalle, le détail par côté et les motifs de fin. */
function duel(A, B, n, ringR) {
  let w = 0, tot = 0, wl = 0, wr = 0, sumT = 0; const reasons = {};
  for (let s = 1; s <= n; s++) {
    const seed = s * SEED0;
    for (const left of [true, false]) {
      const m = E.makeMatch(seed, left ? A : B, left ? B : A, { arenaR: ringR });
      let guard = 0;
      while (!m.over && guard++ < 20000) E.tick(m);
      const aWon = left ? m.winner === 0 : m.winner === 1;
      if (aWon) { w++; if (left) wl++; else wr++; }
      tot++; sumT += m.t; reasons[m.reason] = (reasons[m.reason] || 0) + 1;
    }
  }
  const [lo, hi] = wilson(w, tot);
  return { rate: 100 * w / tot, lo, hi, n: tot, meanT: sumT / tot,
    gauche: 100 * wl / n, droite: 100 * wr / n, reasons };
}

/* Le témoin : le build contre lui-même. Tout écart à 50 % est un biais de
   côté, pas une différence de machine. */
const miroir = (b, n, ringR) => duel(b, b, n, ringR);
/* biais(build) → amplitude du biais de spawn, en points de taux de victoire. */
/* biaisDe — le témoin n'est pas un SEUIL, c'est un TEST.
   En miroir les deux camps sont le même build : les n matchs joués « à gauche »
   et « à droite » sont les MÊMES matchs, et gauche + droite = 100 % par
   construction. La seule question est donc « le bot 0 gagne-t-il plus d'un
   match sur deux ? », et elle se tranche par l'intervalle de confiance du
   taux — jamais par un écart en points.
   Le seuil fixe à 3 points d'avant criait au loup sur du bruit pur : à 40
   graines l'intervalle fait déjà ±11 points. Mesuré : un miroir annoncé
   « biaisé » à 64/36 sur 80 graines redescend à 55/45 sur 300, parfaitement
   compatible avec 50 %. Un instrument qui signale des biais imaginaires est
   pire qu'un instrument muet. */
function biaisDe(b, n, ringR) {
  const m = miroir(b, n, ringR);
  const w0 = Math.round(m.gauche / 100 * n);          // victoires du bot 0, sur n graines
  const [lo, hi] = wilson(w0, n);
  return { pts: Math.abs(m.gauche - 50), gauche: m.gauche, lo, hi, n,
           reel: lo > 50 || hi < 50, sens: sensibilite(n) };
}
/* sensibilite(n) — le plus petit écart que l'effectif permet de VOIR
   (demi-largeur de l'intervalle à 50 %). En dessous, l'instrument est aveugle,
   et il vaut mieux l'écrire que de laisser croire à une mesure. */
function sensibilite(n) { const [lo, hi] = wilson(n / 2, n); return (hi - lo) / 2; }
const verdictBiais = (bi) => bi.reel
  ? "±" + bi.pts.toFixed(1) + " pt  \u26A0"
  : "non détecté (sensibilité ±" + bi.sens.toFixed(1) + " pt)";

/* ──────────────────────────── affichage ──────────────────────────── */
const pct = (x) => (x >= 0 ? " " : "") + x.toFixed(1) + " %";
/* Le témoin utile n'est PAS le taux global du miroir (il vaut 50 % par
   construction) mais son écart entre côtés : c'est lui qui dit de combien de
   points le spawn contamine la mesure affichée juste à côté. */
function ligne(label, r) {
  const biais = "";
  console.log("  " + String(label).padEnd(26) + pct(r.rate) +
    "  [" + r.lo.toFixed(1) + " – " + r.hi.toFixed(1) + "]" +
    "  n=" + String(r.n).padStart(4) +
    "  côtés " + r.gauche.toFixed(0) + "/" + r.droite.toFixed(0) + biais);
}
/* Le témoin est une propriété du build de RÉFÉRENCE, pas de chaque
   comparaison : il vit en tête de bloc, une fois, et non répété sur chaque
   ligne. Bénéfice annexe : un seul miroir à jouer au lieu d'un par ligne. */
function entete(titre, ref, bi) {
  console.log("\n── " + titre);
  if (ref) console.log("   référence : " + ref);
  if (bi) console.log("   témoin    : miroir de la référence, bot 0 à " + bi.gauche.toFixed(1)
    + " % [" + bi.lo.toFixed(1) + " – " + bi.hi.toFixed(1) + "] · "
    + (bi.reel ? "\u26A0 BIAIS RÉEL ±" + bi.pts.toFixed(1) + " pt — lire les écarts ci-dessous avec cette réserve"
               : "conforme (sensibilité ±" + bi.sens.toFixed(1) + " pt)"));
  console.log("");
}
function refuse(h) {
  console.log("  ⚠ NON MESURÉ — " + h.chassis + " " + JSON.stringify(h.over) +
    " ne loge pas dans la coque (autoArrange __nofit).");
}

/* ──────────────────────── jeux de référence ──────────────────────── */
/* Des builds qui LOGENT, vérifiés par l'hydratation. Ce sont des étalons
   provisoires : la Ligne Calibrage (BENCHMARKS figés) les remplacera. */
const REF = {
  S: { chassis: "tortue_s", over: { propulsion: "pr1" } },
  M: { chassis: "boxy", over: { motor: "m2", battery: "b1", propulsion: "pr1", cpu: "c1", sensors: "n1" } },
};
const COQUES = { S: ["tortue_s", "hex_s", "coin_s", "losange_s", "totem_s"],
                 M: ["boxy", "fleche", "marteau", "tortue", "losange", "disque"] };

/* ──────────────────────────── commandes ──────────────────────────── */
function cmdMiroir(n) {
  const R = ringOf(CLASSE);
  /* Sur un miroir, afficher le taux GLOBAL n'apprend rien : il vaut 50 % par
     construction. Ce qui se mesure ici, c'est le taux du bot 0 (le côté
     gauche — toujours le joueur en combat) et son intervalle. */
  entete("MIROIR — le même build des deux côtés. Le bot 0 doit gagner 1 match sur 2.",
    "classe " + CLASSE + ", ring " + R.toFixed(1) + " u, " + n + " graines · "
    + "sensibilité de l'effectif : ±" + sensibilite(n).toFixed(1) + " pt");
  let alerte = 0;
  for (const ch of COQUES[CLASSE]) {
    const b = hydrate(ch, REF[CLASSE].over);
    if (b.nofit) { refuse(b); continue; }
    const bi = biaisDe(b, n, R);
    if (bi.reel) alerte++;
    console.log("  " + (ch + " (" + b.__kg.toFixed(2) + " kg)").padEnd(26)
      + "bot 0 : " + bi.gauche.toFixed(1) + " %"
      + "  [" + bi.lo.toFixed(1) + " – " + bi.hi.toFixed(1) + "]"
      + "  n=" + String(bi.n).padStart(4) + "  "
      + (bi.reel ? "\u26A0 BIAIS RÉEL (±" + bi.pts.toFixed(1) + " pt)" : "conforme"));
  }
  console.log("\n  « conforme » = l'intervalle contient 50 %. Un écart affiché sans alerte est du\n" +
              "  bruit d'échantillonnage : monter --n le fera fondre. Pour trancher un cas\n" +
              "  douteux, 300 graines donnent ±" + sensibilite(300).toFixed(1) + " pt.");
  if (alerte) console.log("  " + alerte + " coque(s) hors tolérance.");
}

function cmdPoignees(n) {
  const R = ringOf(CLASSE), ref = REF[CLASSE];
  const base = hydrate(ref.chassis, ref.over);
  if (base.nofit) return refuse(base);
  entete("POIGNÉES — chaque valeur contre le réglage par défaut, matériel identique.",
    ref.chassis + " " + base.__kg.toFixed(2) + " kg, classe " + CLASSE + ", " + n + " graines × 2 côtés",
    biaisDe(base, n, R));
  for (const key of Object.keys(E.OPTS)) {
    const def = E.SLICE1.playerBuild[key];
    for (const val of E.OPTS[key]) {
      if (val === def) continue;
      const a = hydrate(ref.chassis, ref.over, { [key]: val });
      if (a.nofit) { refuse(a); continue; }
      ligne(key + " = " + val, duel(a, base, n, R));
    }
  }
  console.log("\n  (défauts : " + Object.keys(E.OPTS).map(k => k + "=" + E.SLICE1.playerBuild[k]).join(", ") + ")");
}

function cmdLogiciels(n) {
  const R = ringOf(CLASSE); let ref = REF[CLASSE];
  const ids = E.PARTS.software.map(p => p.id);
  /* Le palier logiciel se mesure AVEC les capteurs qu'il réclame : la
     référence montait un n1, or les modules du palier haut lisent la vision.
     Mesurer v3 aveugle revenait à truquer la comparaison contre lui. */
  ref = { ...ref, over: { ...ref.over, sensors:"n2" } };
  const base = hydrate(ref.chassis, { ...ref.over, software: ids[0] });
  if (base.nofit) return refuse(base);
  entete("LOGICIELS — chaque palier contre le précédent ET contre le stock, matériel identique.",
    ref.chassis + ", classe " + CLASSE + ", " + n + " graines × 2 côtés · cible de conception : 55-75 % par barreau",
    biaisDe(base, n, R));
  for (let i = 1; i < ids.length; i++) {
    const a = hydrate(ref.chassis, { ...ref.over, software: ids[i] });
    const p = hydrate(ref.chassis, { ...ref.over, software: ids[i - 1] });
    if (a.nofit || p.nofit) { refuse(a.nofit ? a : p); continue; }
    ligne(ids[i] + " vs " + ids[i - 1], duel(a, p, n, R));
    ligne(ids[i] + " vs " + ids[0], duel(a, base, n, R));
  }
}

function cmdNiveaux(n) {
  const R = ringOf(CLASSE), ref = REF[CLASSE];
  const me = hydrate(ref.chassis, ref.over);
  if (me.nofit) return refuse(me);
  entete("NIVEAUX — la référence contre les adversaires générés, hydratés eux aussi.",
    ref.chassis + " " + me.__kg.toFixed(2) + " kg, classe " + CLASSE + ", " + n + " graines × 2 côtés",
    biaisDe(me, n, R));
  const CID = CLASSE === "S" ? "sumoS" : "lightM";      // le concours qui porte les règles de la classe
  for (let lvl = 1; lvl <= 5; lvl++) {
    let w = 0, tot = 0, skipped = 0, wl = 0, wr = 0, pairs = 0;
    for (let s = 1; s <= n; s++) {
      const g = advGenere(s * 31337 + lvl, lvl, CID);
      const foe = hydrate(g.build.chassis, g.build.parts, g.build, true);
      if (foe.__nofit) skipped++;
      const seed = s * SEED0; pairs++;
      for (const left of [true, false]) {
        const m = E.makeMatch(seed, left ? me : foe, left ? foe : me, { arenaR: R });
        let guard = 0; while (!m.over && guard++ < 20000) E.tick(m);
        if (left ? m.winner === 0 : m.winner === 1) { w++; if (left) wl++; else wr++; }
        tot++;
      }
    }
    const [lo, hi] = wilson(w, tot);
    ligne("niveau " + lvl + (skipped ? " (" + skipped + " hors coque)" : ""),
      { rate: 100 * w / tot, lo, hi, n: tot,
        gauche: 100 * wl / Math.max(1, pairs), droite: 100 * wr / Math.max(1, pairs) });
  }
  console.log("\n  Adversaires produits comme en jeu (genOpponentFit : tirage moteur + réparation\n" +
              "  de placement S23). « hors coque » doit rester à zéro — sinon la réparation a\n" +
              "  laissé passer un cas, et la mesure porte sur un bot que le joueur ne voit pas.");
}

function cmdEtalon(n) {
  const R = ringOf(CLASSE);
  const ids = Object.keys(E.BENCHMARKS).filter(k => k[0] === CLASSE);
  const hy = {};
  for (const id of ids) {
    const b = E.BENCHMARKS[id].build;
    hy[id] = hydrate(b.chassis, b.parts, b);
    if (hy[id].nofit) { refuse(hy[id]); return; }
  }
  entete("LIGNE ÉTALON — chaque barreau contre le précédent. Une échelle doit MONTER.",
    "classe " + CLASSE + ", ring " + R.toFixed(1) + " u, " + n + " graines × 2 côtés",
    biaisDe(hy[ids[0]], n, R));
  for (let i = 1; i < ids.length; i++)
    ligne(ids[i] + " vs " + ids[i - 1], duel(hy[ids[i]], hy[ids[i - 1]], n, R));
  console.log("");
  for (let i = 1; i < ids.length; i++)
    ligne(ids[i] + " vs " + ids[0], duel(hy[ids[i]], hy[ids[0]], n, R));
  console.log("\n  Une ligne étalon saine : chaque barreau au-dessus de 55 % contre le précédent,\n" +
              "  et la colonne « vs " + ids[0] + " » strictement croissante.");
}

/* Une FICHE exportée du jeu (réglages → Exporter le bot) est acceptée telle
   quelle : c'est ce qui permet d'échanger un build EXACT entre le jeu et le
   banc. Sinon --a/--b restent des surcharges de pièces sur la référence. */
function depuisFiche(txt, ref) {
  const o = JSON.parse(txt || "{}");
  if (o && o.chassis && o.parts) return { chassis: o.chassis, over: o.parts, pilot: o.pilot || null };
  return { chassis: ref.chassis, over: { ...ref.over, ...o }, pilot: null };
}
/* rapport — la batterie complète pour une classe. C'est la commande à relancer
   après toute passe d'équilibrage : elle produit le même tableau, à la même
   graine, donc comparable ligne à ligne avec la fois précédente. */
function cmdRapport(n) {
  console.log("\n══ RAPPORT DE BANC — classe " + CLASSE + " · " + n + " graines par comparaison ══");
  cmdMiroir(n); cmdEtalon(n); cmdLogiciels(n); cmdPoignees(n); cmdNiveaux(n);
}

function cmdDuel(n) {
  const R = ringOf(CLASSE), ref = REF[CLASSE];
  const fa = depuisFiche(opt("ficheA", null) || opt("a", "{}"), ref);
  const fb = depuisFiche(opt("ficheB", null) || opt("b", "{}"), ref);
  const A = hydrate(opt("chassisA", fa.chassis), fa.over, fa.pilot);
  const B = hydrate(opt("chassisB", fb.chassis), fb.over, fb.pilot);
  if (A.nofit) return refuse(A);
  if (B.nofit) return refuse(B);
  entete("DUEL", "A " + A.__kg.toFixed(2) + " kg vs B " + B.__kg.toFixed(2) + " kg, ring " + R.toFixed(1) + " u",
    biaisDe(A, n, R));
  const r = duel(A, B, n, R);
  ligne("A vs B", r);
  console.log("  durée moyenne " + r.meanT.toFixed(1) + " s · motifs " + JSON.stringify(r.reasons));
}

/* ────────────────────────────── main ────────────────────────────── */
const AIDE = `
banc de mesure — outil manuel, hors porte

  node tools/bench.js miroir     [--classe S|M] [--n 150]
  node tools/bench.js poignees   [--classe S|M] [--n 100]
  node tools/bench.js logiciels  [--classe S|M] [--n 150]
  node tools/bench.js niveaux    [--classe S|M] [--n 100]
  node tools/bench.js etalon     [--classe S|M] [--n 120]
  node tools/bench.js rapport    [--classe S|M] [--n 60]     (la batterie complète)
  node tools/bench.js duel --a '{"motor":"m2"}' --b '{"motor":"m0"}'

Options : --n graines (chaque graine = 2 matchs), --seed base de graine,
--classe S ou M (choisit le ring et le jeu de coques).
`;

/* Le CLI ne tourne que si le fichier est LANCÉ ; requis comme module (banc de
   mesure réutilisé par un test), il n'expose que ses primitives. */
const t0 = Date.now();
if (require.main === module) try {
  switch (CMD) {
    case "miroir":    cmdMiroir(N || 150); break;
    case "poignees":  cmdPoignees(N || 100); break;
    case "logiciels": cmdLogiciels(N || 150); break;
    case "niveaux":   cmdNiveaux(N || 100); break;
    case "etalon":    cmdEtalon(N || 120); break;
    case "rapport":   cmdRapport(N || 60); break;
    case "duel":      cmdDuel(N || 150); break;
    default: console.log(AIDE);
  }
  if (CMD !== "aide" && AIDE.indexOf(CMD) >= 0 || ["miroir","poignees","logiciels","niveaux","etalon","rapport","duel"].includes(CMD))
    console.log("\n(" + ((Date.now() - t0) / 1000).toFixed(1) + " s · graine de base " + SEED0 + " — rejouable à l'identique)");
} finally {
  closeHydrator();
}

module.exports = { hydrate, duel, miroir, wilson, ringOf, REF, COQUES };
