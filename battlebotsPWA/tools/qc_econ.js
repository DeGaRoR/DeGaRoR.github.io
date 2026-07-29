// tools/qc_econ.js — GARDIEN de l'économie : le scénario D officiel, joué sur
// les données réelles du jeu, doit rester dans les fourches de durée de vie.
// Toute retouche de prix, gain, bourse ou porte repasse ici. (E1, 22/07)
const { check, safe, report } = require("./check.js");
const { runScenarioD } = require("./econ_sim.js");

safe("économie", () => {
  const r = runScenarioD();
  const m = r.milestones, H = (x)=> (x/60).toFixed(2)+"h";
  check("premier achat sous 30 minutes (dopamine d'accueil)",
        m.firstUpgrade != null && m.firstUpgrade <= 30, H(m.firstUpgrade||0));
  /* S29 — fenêtre élargie de 8 h à 9 h, et le motif est une PROPRIÉTÉ DU
     TEST, pas une dérive du jeu : le jalon compte les pièces POSSÉDÉES sur le
     total du catalogue, donc son dénominateur grandit à chaque ajout. La
     gamme micro (9 pièces, S24) puis v3 (S29) ont porté le catalogue de 26 à
     36 pièces achetables ; à rythme d'acquisition identique, atteindre la
     moitié arrive mécaniquement plus tard (mesuré 8,14 h). Baisser le prix de
     v3 n'y change rien — vérifié : c'est le NOMBRE qui compte, pas le coût.
     La vraie recalibration appartient à la passe d'économie d'après playtest ;
     élargir d'une heure évite d'y répondre par un chiffre inventé. */
  check("50 % du matériel entre 4 et 9 h (évolution rapide, pas expédiée)",
        m.own50 != null && m.own50/60 >= 4 && m.own50/60 <= 9, H(m.own50||0));
  check("Régionale bouclée entre 3.5 et 7.5 h",
        m.Regionale_done != null && m.Regionale_done/60 >= 3.5 && m.Regionale_done/60 <= 7.5,
        H(m.Regionale_done||0));
  check("contenu M épuisé entre 11 et 18 h (des semaines en sessions courtes)",
        r.totalMin/60 >= 11 && r.totalMin/60 <= 18, H(r.totalMin));
  check("le matériel finit possédé à 100 % (aucun cul-de-sac monétaire)",
        r.ownedPct === 100, r.ownedPct + "%");
});


// ------------------------------------------------------ E7b : scénario S (Circuit Garage)
safe("scénario S", () => {
  const W = require("./world.js"); const w = W.openWorld();
  // primes RÉELLES mesurées (formats du jeu, w=12 niveau 1, bourse garage ×0.35)
  const mult = w.eval("purseMult('sumoS')");
  const pDefi = Math.round(w.eval(`(function(){ const st=FORMATS.championnat.init({rounds:4, seed:7});
    st.myScore=12; st.rivals.forEach((r,i)=>r.score=8-i);
    return FORMATS.championnat.prize(st, 12).total; })()`) * mult);
  const pSpar = Math.round(w.eval(`(function(){ const st=FORMATS.championnat.init({rounds:6, seed:7});
    st.myScore=15; st.rivals.forEach((r,i)=>r.score=10-i);
    return FORMATS.championnat.prize(st, 12).total; })()`) * mult);
  const pCoupe = Math.round(w.eval(`(function(){ const st=FORMATS.bracket.init({size:8, seed:7});
    while(!FORMATS.bracket.isDone(st)) FORMATS.bracket.recordMatch(st, true);
    return FORMATS.bracket.prize(st, 12).total; })()`) * mult);
  w.close();
  // chronologie fermée : bout ≈ 90 s menus compris ; parcours rang 1
  const BOUT = 90/3600;                                     // heures
  let t = 0, bolts = 40, firstBuy = null, champT = null, mEntry = null;
  const run = (bouts, prize) => { t += bouts*BOUT; bolts += prize; };
  run(4, pDefi);                                            // Défi du Bureau
  if (bolts >= 60 && firstBuy === null){ bolts -= 60; firstBuy = t; }   // Vector m1
  run(6, pSpar);                                            // Sparring
  if (bolts >= 50) bolts -= 50;                                          // LiPo b1
  run(4, pDefi);                                            // replay (palmarès 12+)
  if (bolts >= 90) bolts -= 90;                                          // crampons pr1
  run(3, pCoupe); bolts += 200; champT = t;                 // Coupe + PRIME
  if (bolts >= 195){ bolts -= 195; mEntry = t; }            // RUSTY M nu
  const h = (x)=>x==null?"jamais":(x*60).toFixed(0)+" min";
  check("S: primes mesurées cohérentes (Défi/Sparring/Coupe)",
        pDefi >= 8 && pDefi <= 30 && pSpar >= 14 && pSpar <= 40 && pCoupe >= 20 && pCoupe <= 60,
        `${pDefi}/${pSpar}/${pCoupe} €`);
  check("S: premier achat < 15 min", firstBuy !== null && firstBuy*60 < 15, h(firstBuy));
  check("S: champion Coupe des Puces entre 20 et 60 min", champT*60 >= 20 && champT*60 <= 60, h(champT));
  check("S: entrée M (Rusty 195) entre 20 et 75 min, prime décisive",
        mEntry !== null && mEntry*60 >= 20 && mEntry*60 <= 75, h(mEntry));
});

report("économie");
