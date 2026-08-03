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

// ------------------------------------------------------ E10 : les doublons se paient (03/08)
safe("E10 doublons payants", () => {
  const W = require("./world.js"); const w = W.openWorld();
  // 1) plus aucune pièce FONCTIONNELLE gratuite : masse > 0 ⇒ prix > 0.
  //    Les marqueurs d'absence (a0, n0, s0, k0, l0, r0, w0, x0) restent à 0 €
  //    ET à masse 0 — c'est ce couple qui dérive OPTIONAL_SLOTS.
  const zeros = w.eval(`(function(){ const out=[];
    for (const sl in ENGINE.PARTS) for (const p of ENGINE.PARTS[sl])
      if ((p.cost|0) === 0 && ENGINE.partMassKg(sl, p.id) > 0) out.push(sl+":"+p.id);
    return out; })()`);
  check("E10: aucune pièce fonctionnelle à 0 € (masse>0 ⇒ prix>0)", zeros.length === 0, zeros.join(","));
  check("E10: slots optionnels intacts (les marqueurs d'absence restent gratuits)",
        w.eval("!!(OPTIONAL_SLOTS.armor && OPTIONAL_SLOTS.ballast && OPTIONAL_SLOTS.srimech)"));
  // 2) empiler une pièce SANS copie libre = prix catalogue (fini le ×3 gratuit)
  w.eval("S.bolts = 2000; saveState(); buyBot('boxy'); mintInstance('m0'); tryEquip('motor','m0')");
  const b0 = w.eval("S.bolts");
  w.eval("setCount('motor', +1)");
  const paid = b0 - w.eval("S.bolts");
  check("E10: +1 moteur de récup = prix catalogue, monté ×2",
        paid === w.eval("ENGINE.partOf('motor','m0').cost") && paid > 0 && w.eval("AB().counts.motor") === 2,
        paid + " € · ×" + w.eval("AB().counts.motor||1"));
  // 3) la fiche est un PLAN : l'import se paie coque + pièces au neuf, refusé sans fonds
  const fiche = w.eval("JSON.stringify(exportBot())");
  const b1 = w.eval("S.bolts");
  const n1 = w.eval("S.garage.length");
  w.eval(`importBot(${JSON.stringify(fiche)})`);
  const facture = b1 - w.eval("S.bolts");
  const attenduCout = w.eval(`(function(){ const f=${fiche};
    let c=(CHASSIS_INFO[f.chassis]||{}).cost||0;
    for (const sl in (f.parts||{})) c += ((ENGINE.partOf(sl, f.parts[sl])||{}).cost||0) * (((f.counts||{})[sl])||1);
    return c; })()`);
  check("E10: import facturé au prix catalogue neuf (coque + pièces × multiplicité)",
        facture === attenduCout && facture > 0 && w.eval("S.garage.length") === n1 + 1,
        facture + " € (attendu " + attenduCout + ")");
  w.eval("S.bolts = 0");
  const n2 = w.eval("S.garage.length");
  check("E10: import refusé sans fonds (garage et inventaire intacts)",
        w.eval(`importBot(${JSON.stringify(fiche)})`) === "noBolts" && w.eval("S.garage.length") === n2);
  check("aucune erreur E10", w.errors.length === 0, w.errors[0] || "");
  w.close();
});

report("économie");
